/**
 * Login Flow Module — Device Trust + Quick PIN
 *
 * Replaces the old club-login.js with 4 login states:
 *   State 1: Full email+password login (new device / no registered admins)
 *   State 2: Admin-picker + PIN (device has registered admins)
 *   State 3: Remember device modal (after full login — PIN setup)
 *   State 4: PIN locked (3 failed attempts — must do full login)
 *   + Force password change screen
 *
 * The flow:
 *   App load → hasDeviceUsers?
 *     YES → State 2 (admin-picker + PIN)
 *     NO  → State 1 (full login)
 *
 *   State 1 success → force_password_change?
 *     YES → Force password change screen → State 3
 *     NO  → State 3 (remember device)
 *
 *   State 2 PIN ok → session created → setupAdminLoginScreen()
 *   State 2 PIN locked → State 4
 *
 *   State 3 "Yes" → register device token → setupAdminLoginScreen()
 *   State 3 "No"  → setupAdminLoginScreen()
 */

import { supabaseClient } from '../core/config-and-supabase.js?v=3.0.80';
import { rememberInstitution, ensureActiveInstitution, fetchInstitutions } from './institution-store.js?v=3.0.80';
import { getInstitutionId } from './session-store.js?v=3.0.80';
import { performLogin, getCurrentUserProfile } from './auth-and-session.js?v=3.0.80';
import { showScreen } from '../ui/shell-and-theme.js?v=3.0.80';
import { logAuditEvent } from '../core/audit-events.js?v=3.0.80';
import {
    hasDeviceUsers,
    getDeviceUsers,
    verifyDevicePin,
    completeDevicePinAuth,
    registerDeviceToken,
    removeDeviceUser,
    clearAllDeviceUsers,
} from './device-trust.js?v=3.0.80';
import {
    getMfaFactors,
    enrollTotp,
    challengeAndVerify,
    shouldRequireMfa,
    setMfaDeviceTrustedDurable,
    isMfaDeviceTrusted,
    checkServerMfaTrust,
} from './mfa-utils.js?v=3.0.80';

// ─── Turnstile verification helper ──────────────────────────────

async function verifyTurnstileToken(widgetId) {
    // Skip Turnstile on localhost (not available outside production)
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.')) return { ok: true };
    let token = null;
    try {
        token = typeof turnstile !== 'undefined' ? turnstile.getResponse(widgetId) : null;
    } catch (e) {
        console.warn('[login] Turnstile getResponse error:', e?.message, '— fail-open');
        return { ok: true };
    }
    if (!token) {
        console.warn('[login] Turnstile token missing — skipping verification (fail-open)');
        return { ok: true };
    }
    try {
        // Timeout: fail-open efter 5 sekunder hvis Edge Function hænger
        const res = await Promise.race([
            supabaseClient.functions.invoke('verify-turnstile', { body: { token } }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
        ]);
        if (res.error || !res.data?.success) {
            if (typeof turnstile !== 'undefined') turnstile.reset(widgetId);
            return { ok: false, error: 'Sikkerhedsverifikation fejlede. Prøv igen.' };
        }
        return { ok: true };
    } catch {
        console.warn('[login] Turnstile verification failed/timed out — fail-open');
        return { ok: true }; // Fail-open: tillad login hvis Edge Function er nede eller timeout
    }
}

// ─── State 1: Full Login ────────────────────────────────────────

export async function setupFullLoginScreen({ fromDeviceUnlock = false } = {}) {
    showScreen('screen-full-login');

    const emailInput = document.getElementById('login-email-input');
    const passwordInput = document.getElementById('login-password-input');
    const loginBtn = document.getElementById('full-login-btn');
    const backBtn = document.getElementById('full-login-back-btn');
    const errorEl = document.getElementById('full-login-error');
    if (!emailInput || !passwordInput || !loginBtn || !errorEl) return;

    errorEl.textContent = '';
    loginBtn.disabled = false;
    loginBtn.textContent = 'Log ind';

    // Show back button only if navigated from device-unlock screen
    if (backBtn) {
        backBtn.style.display = fromDeviceUnlock ? '' : 'none';
        backBtn.onclick = () => setupDeviceUnlockScreen();
    }

    emailInput.focus();

    loginBtn.onclick = async () => {
        errorEl.textContent = '';
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            errorEl.textContent = 'Indtast e-mail og kodeord.';
            return;
        }

        loginBtn.disabled = true;
        loginBtn.textContent = 'Logger ind...';

        // Turnstile verifikation
        const turnstileCheck = await verifyTurnstileToken('turnstile-full-login');
        if (!turnstileCheck.ok) {
            errorEl.textContent = turnstileCheck.error;
            loginBtn.disabled = false;
            loginBtn.textContent = 'Log ind';
            return;
        }

        const { success } = await performLogin(email, password);

        if (!success) {
            logAuditEvent('FAILED_LOGIN', {
                institutionId: getInstitutionId(),
                details: { email, reason: 'invalid_credentials', method: 'email_password' },
            });
            errorEl.textContent = 'Forkert e-mail eller kodeord.';
            loginBtn.disabled = false;
            loginBtn.textContent = 'Log ind';
            if (typeof turnstile !== 'undefined') turnstile.reset('turnstile-full-login');
            return;
        }

        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            errorEl.textContent = 'Login fejlede. Prøv igen.';
            loginBtn.disabled = false;
            loginBtn.textContent = 'Log ind';
            return;
        }

        const adminProfile = await getCurrentUserProfile(session);
        if (!adminProfile || adminProfile.role !== 'admin' && adminProfile.role !== 'superadmin') {
            errorEl.textContent = 'Denne bruger er ikke administrator.';
            await supabaseClient.auth.signOut();
            loginBtn.disabled = false;
            loginBtn.textContent = 'Log ind';
            return;
        }

        // Auto-set institution from admin profile — forceRefresh for fuld data (authed)
        if (adminProfile.institution_id) {
            const institutions = await fetchInstitutions(true);
            const inst = institutions.find(i => String(i.id) === String(adminProfile.institution_id));
            if (inst) rememberInstitution(inst);

            // Show restaurant mode toggle if enabled for this institution
            const rmLabel = document.getElementById('restaurant-mode-login-label');
            const rmCheckbox = document.getElementById('restaurant-mode-login-checkbox');
            if (rmLabel && rmCheckbox && inst?.restaurant_mode_enabled) {
                rmLabel.style.display = '';
                rmCheckbox.checked = localStorage.getItem('flango_device_restaurant_mode') === 'true';
                if (rmCheckbox) {
                    localStorage.setItem('flango_device_restaurant_mode', rmCheckbox.checked ? 'true' : 'false');
                }
            }
        }

        logAuditEvent('LOGIN_FULL', {
            institutionId: adminProfile.institution_id,
            adminUserId: adminProfile.user_id,
            details: { admin_name: adminProfile.name, login_method: 'email_password' },
        });

        if (adminProfile.force_password_change) {
            setupForcePasswordScreen(adminProfile);
            return;
        }

        // ── MFA TOTP check ──
        const mfaNeeded = await handleMfaGate(adminProfile);
        if (mfaNeeded) return;

        // Skip "Remember device" if this admin already has a device token on this device
        const existingDeviceUsers = getDeviceUsers();
        const alreadyRegistered = existingDeviceUsers.some(u => u.userId === session.user.id);
        if (alreadyRegistered) {
            const { setupAdminLoginScreen } = await import('./app-main.js?v=3.0.80');
            setupAdminLoginScreen(adminProfile);
        } else {
            setupRememberDeviceScreen(adminProfile);
        }
    };

    passwordInput.onkeydown = (e) => {
        if (e.key === 'Enter') loginBtn.click();
    };
}

// ─── State 2: Admin-picker + PIN ────────────────────────────────

export async function setupDeviceUnlockScreen() {
    const deviceUsers = getDeviceUsers();
    if (!deviceUsers.length) {
        // No device users → fall back to full login
        return setupFullLoginScreen();
    }

    showScreen('screen-device-unlock');

    const selectEl = document.getElementById('device-admin-select');
    const pinInput = document.getElementById('device-pin-input');
    const unlockBtn = document.getElementById('device-unlock-btn');
    const emailBtn = document.getElementById('device-email-login-btn');
    const errorEl = document.getElementById('device-unlock-error');
    if (!selectEl || !pinInput || !unlockBtn || !emailBtn || !errorEl) return;

    errorEl.textContent = '';
    pinInput.value = '';
    unlockBtn.disabled = false;
    unlockBtn.textContent = 'Lås op';

    // Populate admin dropdown with device users (sorted by most recently used)
    selectEl.innerHTML = '';
    deviceUsers.forEach((user, i) => {
        const opt = document.createElement('option');
        opt.value = user.userId;
        opt.textContent = user.firstName;
        selectEl.appendChild(opt);
    });

    // Auto-select first user
    if (deviceUsers.length === 1) {
        pinInput.focus();
    } else {
        selectEl.focus();
    }

    selectEl.onchange = () => {
        pinInput.value = '';
        errorEl.textContent = '';
        pinInput.focus();
    };

    unlockBtn.onclick = async () => {
        errorEl.textContent = '';
        const userId = selectEl.value;
        const pin = pinInput.value.trim();

        if (!userId) {
            errorEl.textContent = 'Vælg en profil.';
            return;
        }
        if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
            errorEl.textContent = 'Indtast din 4-cifrede PIN.';
            return;
        }

        unlockBtn.disabled = true;
        unlockBtn.textContent = 'Verificerer...';

        const result = await verifyDevicePin(userId, pin);

        if (!result.success) {
            if (result.locked) {
                // PIN locked → show State 4
                const user = deviceUsers.find(u => u.userId === userId);
                setupPinLockedScreen(user?.firstName || 'Bruger');
                return;
            }
            errorEl.textContent = 'Forkert PIN. Prøv igen.';
            pinInput.value = '';
            pinInput.focus();
            unlockBtn.disabled = false;
            unlockBtn.textContent = 'Lås op';
            return;
        }

        // Complete the magic link auth
        const authResult = await completeDevicePinAuth(result.hashedToken);
        if (!authResult.success) {
            errorEl.textContent = 'Login fejlede. Prøv med email.';
            unlockBtn.disabled = false;
            unlockBtn.textContent = 'Lås op';
            return;
        }

        // Success! Ensure institution is set
        if (result.institutionId) {
            const institutions = await fetchInstitutions();
            const inst = institutions.find(i => String(i.id) === String(result.institutionId));
            if (inst) rememberInstitution(inst);
        }

        // Get admin profile and proceed
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            errorEl.textContent = 'Session fejlede. Prøv igen.';
            unlockBtn.disabled = false;
            unlockBtn.textContent = 'Lås op';
            return;
        }

        const adminProfile = await getCurrentUserProfile(session);
        if (!adminProfile || adminProfile.role !== 'admin' && adminProfile.role !== 'superadmin') {
            errorEl.textContent = 'Bruger er ikke administrator.';
            await supabaseClient.auth.signOut();
            unlockBtn.disabled = false;
            unlockBtn.textContent = 'Lås op';
            return;
        }

        // Restaurant mode from saved preference
        localStorage.getItem('flango_device_restaurant_mode'); // already saved

        // Go to admin welcome screen
        const { setupAdminLoginScreen } = await import('./app-main.js?v=3.0.80');
        setupAdminLoginScreen(adminProfile);
    };

    // "Log ind med email" button
    emailBtn.onclick = () => {
        setupFullLoginScreen({ fromDeviceUnlock: true });
    };

    // "Glem mig på denne enhed" button — fjerner kun den valgte profil
    const removeBtn = document.getElementById('device-remove-btn');
    if (removeBtn) {
        removeBtn.onclick = () => {
            const userId = selectEl.value;
            const user = deviceUsers.find(u => u.userId === userId);
            const name = user?.firstName || 'denne profil';
            if (confirm(`Glem "${name}" på denne enhed?`)) {
                removeDeviceUser(userId);
                // Hvis der stadig er andre profiler, genindlæs picker
                const remaining = getDeviceUsers();
                if (remaining.length > 0) {
                    setupDeviceUnlockScreen();
                } else {
                    setupFullLoginScreen();
                }
            }
        };
    }

    // Handle Enter key on PIN input
    pinInput.onkeydown = (e) => {
        if (e.key === 'Enter') unlockBtn.click();
    };
}

// ─── State 3: Remember Device Modal ─────────────────────────────

export function setupRememberDeviceScreen(adminProfile) {
    showScreen('screen-remember-device');

    const pinInput = document.getElementById('remember-pin-input');
    const confirmInput = document.getElementById('remember-pin-confirm');
    const yesBtn = document.getElementById('remember-device-yes-btn');
    const noBtn = document.getElementById('remember-device-no-btn');
    const errorEl = document.getElementById('remember-device-error');
    if (!pinInput || !confirmInput || !yesBtn || !noBtn || !errorEl) return;

    errorEl.textContent = '';
    pinInput.value = '';
    confirmInput.value = '';
    yesBtn.disabled = false;
    pinInput.focus();

    yesBtn.onclick = async () => {
        errorEl.textContent = '';
        const pin = pinInput.value.trim();
        const confirm = confirmInput.value.trim();

        if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
            errorEl.textContent = 'PIN skal være nøjagtigt 4 cifre.';
            return;
        }
        if (pin !== confirm) {
            errorEl.textContent = 'PIN-koderne er ikke ens.';
            confirmInput.value = '';
            confirmInput.focus();
            return;
        }

        yesBtn.disabled = true;
        yesBtn.textContent = 'Registrerer...';

        const result = await registerDeviceToken(pin);

        if (!result.success) {
            errorEl.textContent = result.error || 'Kunne ikke registrere enheden.';
            yesBtn.disabled = false;
            yesBtn.textContent = 'Husk mig på denne enhed';
            return;
        }

        // Audit: device registered
        logAuditEvent('DEVICE_REGISTERED', {
            institutionId: adminProfile.institution_id,
            adminUserId: adminProfile.user_id,
            details: { admin_name: adminProfile.name },
        });

        // Proceed to admin welcome
        const { setupAdminLoginScreen } = await import('./app-main.js?v=3.0.80');
        setupAdminLoginScreen(adminProfile);
    };

    noBtn.onclick = async () => {
        // Skip device registration, go straight to admin welcome
        const { setupAdminLoginScreen } = await import('./app-main.js?v=3.0.80');
        setupAdminLoginScreen(adminProfile);
    };

    // Handle Enter key
    confirmInput.onkeydown = (e) => {
        if (e.key === 'Enter') yesBtn.click();
    };
}

// ─── State 4: PIN Locked ────────────────────────────────────────

export function setupPinLockedScreen(adminName) {
    showScreen('screen-pin-locked');

    const messageEl = document.getElementById('pin-locked-message');
    const emailInput = document.getElementById('locked-email-input');
    const passwordInput = document.getElementById('locked-password-input');
    const loginBtn = document.getElementById('locked-login-btn');
    const backBtn = document.getElementById('locked-back-btn');
    const errorEl = document.getElementById('locked-login-error');
    if (!messageEl || !emailInput || !passwordInput || !loginBtn || !backBtn || !errorEl) return;

    messageEl.textContent = `${adminName} er låst på denne enhed. Log ind med email og kodeord.`;
    errorEl.textContent = '';
    emailInput.value = '';
    passwordInput.value = '';
    loginBtn.disabled = false;
    loginBtn.textContent = 'Log ind';
    emailInput.focus();

    loginBtn.onclick = async () => {
        errorEl.textContent = '';
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            errorEl.textContent = 'Indtast e-mail og kodeord.';
            return;
        }

        loginBtn.disabled = true;
        loginBtn.textContent = 'Logger ind...';

        // Turnstile verifikation
        const turnstileCheck = await verifyTurnstileToken('turnstile-locked-login');
        if (!turnstileCheck.ok) {
            errorEl.textContent = turnstileCheck.error;
            loginBtn.disabled = false;
            loginBtn.textContent = 'Log ind';
            return;
        }

        const { success } = await performLogin(email, password);

        if (!success) {
            logAuditEvent('FAILED_LOGIN', {
                institutionId: getInstitutionId(),
                details: { email, reason: 'invalid_credentials', method: 'email_password_after_lockout' },
            });
            errorEl.textContent = 'Forkert e-mail eller kodeord.';
            loginBtn.disabled = false;
            loginBtn.textContent = 'Log ind';
            if (typeof turnstile !== 'undefined') turnstile.reset('turnstile-locked-login');
            return;
        }

        // Ensure institution is set
        await ensureActiveInstitution();

        const { data: { session } } = await supabaseClient.auth.getSession();
        if (!session) {
            errorEl.textContent = 'Login fejlede.';
            loginBtn.disabled = false;
            loginBtn.textContent = 'Log ind';
            return;
        }

        const adminProfile = await getCurrentUserProfile(session);
        if (!adminProfile || adminProfile.role !== 'admin' && adminProfile.role !== 'superadmin') {
            errorEl.textContent = 'Denne bruger er ikke administrator.';
            await supabaseClient.auth.signOut();
            loginBtn.disabled = false;
            loginBtn.textContent = 'Log ind';
            return;
        }

        // Audit
        logAuditEvent('LOGIN_FULL', {
            institutionId: adminProfile.institution_id,
            adminUserId: adminProfile.user_id,
            details: { admin_name: adminProfile.name, login_method: 'email_password_after_lockout' },
        });

        // Check force password change
        if (adminProfile.force_password_change) {
            setupForcePasswordScreen(adminProfile);
            return;
        }

        // ── MFA TOTP check ──
        const mfaNeeded = await handleMfaGate(adminProfile);
        if (mfaNeeded) return;

        // Skip "Remember device" if this admin already has a device token on this device
        const existingDeviceUsers = getDeviceUsers();
        const alreadyRegistered = existingDeviceUsers.some(u => u.userId === session.user.id);
        if (alreadyRegistered) {
            const { setupAdminLoginScreen: startAdmin } = await import('./app-main.js?v=3.0.80');
            startAdmin(adminProfile);
        } else {
            setupRememberDeviceScreen(adminProfile);
        }
    };

    backBtn.onclick = () => {
        // Go back to device unlock (if there are still device users)
        if (hasDeviceUsers()) {
            setupDeviceUnlockScreen();
        } else {
            setupFullLoginScreen();
        }
    };

    passwordInput.onkeydown = (e) => {
        if (e.key === 'Enter') loginBtn.click();
    };
}

// ─── Force Password Change ──────────────────────────────────────

export function setupForcePasswordScreen(adminProfile) {
    showScreen('screen-force-password');

    const newPwInput = document.getElementById('force-pw-new');
    const confirmInput = document.getElementById('force-pw-confirm');
    const submitBtn = document.getElementById('force-pw-btn');
    const errorEl = document.getElementById('force-pw-error');
    if (!newPwInput || !confirmInput || !submitBtn || !errorEl) return;

    errorEl.textContent = '';
    newPwInput.value = '';
    confirmInput.value = '';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Gem ny adgangskode';
    newPwInput.focus();

    submitBtn.onclick = async () => {
        errorEl.textContent = '';
        const newPw = newPwInput.value;
        const confirm = confirmInput.value;

        // Validate: min 10 chars, letters + numbers
        if (newPw.length < 10) {
            errorEl.textContent = 'Kodeordet skal være mindst 10 tegn.';
            return;
        }
        if (!/[a-zA-ZæøåÆØÅ]/.test(newPw) || !/\d/.test(newPw)) {
            errorEl.textContent = 'Kodeordet skal indeholde både bogstaver og tal.';
            return;
        }
        if (newPw !== confirm) {
            errorEl.textContent = 'Kodeordene er ikke ens.';
            confirmInput.value = '';
            confirmInput.focus();
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Gemmer...';

        // Update password via Supabase Auth
        const { error } = await supabaseClient.auth.updateUser({ password: newPw });
        if (error) {
            errorEl.textContent = error.message || 'Kunne ikke ændre kodeord.';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Gem ny adgangskode';
            return;
        }

        // Clear the force_password_change flag
        const { error: updateError } = await supabaseClient
            .from('users')
            .update({ force_password_change: false })
            .eq('user_id', adminProfile.user_id);

        if (updateError) {
            console.error('[login-flow] Failed to clear force_password_change:', updateError);
        }

        // Audit
        logAuditEvent('PASSWORD_CHANGE_FORCED', {
            institutionId: adminProfile.institution_id,
            adminUserId: adminProfile.user_id,
            details: { admin_name: adminProfile.name },
        });

        // ── MFA TOTP check (after password change) ──
        const mfaNeeded = await handleMfaGate(adminProfile);
        if (mfaNeeded) return;

        // Proceed to remember device screen
        setupRememberDeviceScreen(adminProfile);
    };

    confirmInput.onkeydown = (e) => {
        if (e.key === 'Enter') submitBtn.click();
    };
}

// ─── MFA TOTP Gate ─────────────────────────────────────────────────

/**
 * Tjekker om MFA er påkrævet for denne admin og viser enrollment/challenge.
 * Returnerer true hvis MFA-skærm vises (flow pauset), false hvis MFA springes over.
 */
async function handleMfaGate(adminProfile) {
    // Skip MFA on localhost (Supabase MFA challenge requires production origin)
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.')) return false;
    try {
        // Hent institution MFA-policy
        const { data: inst } = await supabaseClient
            .from('institutions')
            .select('admin_mfa_policy')
            .eq('id', adminProfile.institution_id)
            .single();

        const policy = inst?.admin_mfa_policy || 'off';
        if (policy === 'off') return false;

        if (policy === 'new_device') {
            // Hurtig check: localStorage
            if (isMfaDeviceTrusted('admin')) return false;

            // Fallback: cookie + server-side check (overlever cache-rydning)
            const serverTrusted = await checkServerMfaTrust('admin');
            if (serverTrusted) return false;
        }
        // policy === 'always' falder igennem til MFA

        // Tjek om brugeren har enrollet TOTP
        const factors = await getMfaFactors();
        if (factors.length === 0) {
            setupMfaEnrollScreen(adminProfile);
        } else {
            setupMfaChallengeScreen(adminProfile, factors[0].id);
        }
        return true;
    } catch (err) {
        console.error('[login-flow] MFA gate fejl:', err);
        return false; // fail-open: tillad login ved fejl
    }
}

/** MFA Enrollment: Vis QR-kode, scan, verificer */
function setupMfaEnrollScreen(adminProfile) {
    showScreen('screen-mfa-enroll');

    const qrImage = document.getElementById('mfa-qr-image');
    const secretDisplay = document.getElementById('mfa-secret-display');
    const codeInput = document.getElementById('mfa-enroll-code');
    const submitBtn = document.getElementById('mfa-enroll-btn');
    const errorEl = document.getElementById('mfa-enroll-error');
    if (!qrImage || !codeInput || !submitBtn || !errorEl) return;

    errorEl.textContent = '';
    codeInput.value = '';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Indlaeser...';

    let factorId = null;

    // Start enrollment
    (async () => {
        const result = await enrollTotp();
        if (result.error) {
            errorEl.textContent = result.error;
            submitBtn.textContent = 'Aktiver';
            return;
        }
        factorId = result.factorId;
        // Render QR-kode via Google Charts API (simpel, ingen dependencies)
        qrImage.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(result.qrCodeUri)}`;
        if (secretDisplay) {
            secretDisplay.textContent = 'Manuel kode: ' + result.secret;
        }
        submitBtn.disabled = false;
        submitBtn.textContent = 'Aktiver';
        codeInput.focus();
    })();

    submitBtn.onclick = async () => {
        errorEl.textContent = '';
        const code = codeInput.value.trim();
        if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
            errorEl.textContent = 'Indtast en 6-cifret kode.';
            return;
        }
        if (!factorId) {
            errorEl.textContent = 'QR-kode ikke indlaest endnu. Vent venligst.';
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Verificerer...';

        const result = await challengeAndVerify(factorId, code);
        if (result.error) {
            errorEl.textContent = 'Forkert kode. Proev igen.';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Aktiver';
            codeInput.value = '';
            codeInput.focus();
            return;
        }

        // Succes — gem MFA trust i alle 3 lag (localStorage + cookie + server)
        await setMfaDeviceTrustedDurable('admin');
        logAuditEvent('MFA_ENROLLED', {
            institutionId: adminProfile.institution_id,
            adminUserId: adminProfile.user_id,
            details: { admin_name: adminProfile.name, method: 'totp' },
        });

        setupRememberDeviceScreen(adminProfile);
    };

    codeInput.onkeydown = (e) => {
        if (e.key === 'Enter') submitBtn.click();
    };
}

/** MFA Challenge: Indtast 6-cifret kode fra authenticator-app */
function setupMfaChallengeScreen(adminProfile, factorId) {
    showScreen('screen-mfa-challenge');

    const codeInput = document.getElementById('mfa-challenge-code');
    const submitBtn = document.getElementById('mfa-challenge-btn');
    const errorEl = document.getElementById('mfa-challenge-error');
    if (!codeInput || !submitBtn || !errorEl) return;

    errorEl.textContent = '';
    codeInput.value = '';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Bekraeft';
    codeInput.focus();

    submitBtn.onclick = async () => {
        errorEl.textContent = '';
        const code = codeInput.value.trim();
        if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
            errorEl.textContent = 'Indtast en 6-cifret kode.';
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Verificerer...';

        const result = await challengeAndVerify(factorId, code);
        if (result.error) {
            errorEl.textContent = 'Forkert kode. Proev igen.';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Bekraeft';
            codeInput.value = '';
            codeInput.focus();
            return;
        }

        // Succes — gem MFA trust i alle 3 lag (localStorage + cookie + server)
        await setMfaDeviceTrustedDurable('admin');
        logAuditEvent('MFA_VERIFIED', {
            institutionId: adminProfile.institution_id,
            adminUserId: adminProfile.user_id,
            details: { admin_name: adminProfile.name, method: 'totp' },
        });

        setupRememberDeviceScreen(adminProfile);
    };

    codeInput.onkeydown = (e) => {
        if (e.key === 'Enter') submitBtn.click();
    };
}

// ─── Helpers ────────────────────────────────────────────────────

function _updateRestaurantMode(institutionId, institutions, labelEl, checkboxEl) {
    if (!labelEl || !checkboxEl) return;
    const inst = (institutions || []).find(i => String(i.id) === String(institutionId));
    labelEl.style.display = inst?.restaurant_mode_enabled ? '' : 'none';
    checkboxEl.checked = localStorage.getItem('flango_device_restaurant_mode') === 'true';
}
