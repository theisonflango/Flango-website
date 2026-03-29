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

import { supabaseClient } from '../core/config-and-supabase.js';
import { rememberInstitution, ensureActiveInstitution, fetchInstitutions } from './institution-store.js';
import { performLogin, getCurrentUserProfile } from './auth-and-session.js';
import { showScreen } from '../ui/shell-and-theme.js';
import { logAuditEvent } from '../core/audit-events.js';
import {
    hasDeviceUsers,
    getDeviceUsers,
    verifyDevicePin,
    completeDevicePinAuth,
    registerDeviceToken,
    removeDeviceUser,
    clearAllDeviceUsers,
} from './device-trust.js';

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

        const { success } = await performLogin(email, password);

        if (!success) {
            errorEl.textContent = 'Forkert e-mail eller kodeord.';
            loginBtn.disabled = false;
            loginBtn.textContent = 'Log ind';
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
        if (!adminProfile || adminProfile.role !== 'admin') {
            errorEl.textContent = 'Denne bruger er ikke administrator.';
            await supabaseClient.auth.signOut();
            loginBtn.disabled = false;
            loginBtn.textContent = 'Log ind';
            return;
        }

        // Auto-set institution from admin profile
        if (adminProfile.institution_id) {
            const institutions = await fetchInstitutions();
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

        setupRememberDeviceScreen(adminProfile);
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
        if (!adminProfile || adminProfile.role !== 'admin') {
            errorEl.textContent = 'Bruger er ikke administrator.';
            await supabaseClient.auth.signOut();
            unlockBtn.disabled = false;
            unlockBtn.textContent = 'Lås op';
            return;
        }

        // Restaurant mode from saved preference
        localStorage.getItem('flango_device_restaurant_mode'); // already saved

        // Go to admin welcome screen
        const { setupAdminLoginScreen } = await import('./app-main.js');
        setupAdminLoginScreen(adminProfile);
    };

    // "Log ind med email" button
    emailBtn.onclick = () => {
        setupFullLoginScreen({ fromDeviceUnlock: true });
    };

    // "Fjern denne enhed" button
    const removeBtn = document.getElementById('device-remove-btn');
    if (removeBtn) {
        removeBtn.onclick = () => {
            if (confirm('Fjern alle gemte profiler fra denne enhed?')) {
                clearAllDeviceUsers();
                setupFullLoginScreen();
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
        const { setupAdminLoginScreen } = await import('./app-main.js');
        setupAdminLoginScreen(adminProfile);
    };

    noBtn.onclick = async () => {
        // Skip device registration, go straight to admin welcome
        const { setupAdminLoginScreen } = await import('./app-main.js');
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

        const { success } = await performLogin(email, password);

        if (!success) {
            errorEl.textContent = 'Forkert e-mail eller kodeord.';
            loginBtn.disabled = false;
            loginBtn.textContent = 'Log ind';
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
        if (!adminProfile || adminProfile.role !== 'admin') {
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

        // Offer to remember device again
        setupRememberDeviceScreen(adminProfile);
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

        // Proceed to remember device screen
        setupRememberDeviceScreen(adminProfile);
    };

    confirmInput.onkeydown = (e) => {
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
