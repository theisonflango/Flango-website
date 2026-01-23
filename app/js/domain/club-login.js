import { supabaseClient } from '../core/config-and-supabase.js';
import { rememberInstitution, clearSavedInstitution, ensureActiveInstitution, fetchInstitutions } from './institution-store.js';
import { performLogin } from './auth-and-session.js';
import { fetchAdminsForInstitution } from './users-and-admin.js';
import { showScreen } from '../ui/shell-and-theme.js';

const CLUB_LOGIN_CODE_KEY = 'flango_club_login_code';
let lastClubLoginCode = null;

export async function setupClubLoginScreen() {
    const institutions = await fetchInstitutions();
    showScreen('screen-club-login');
    const selectEl = document.getElementById('club-institution-select');
    const codeInput = document.getElementById('club-code-input');
    const loginBtn = document.getElementById('club-login-btn');
    const errorEl = document.getElementById('club-login-error');
    if (!selectEl || !codeInput || !loginBtn || !errorEl) return;

    errorEl.textContent = '';
    lastClubLoginCode = null;
    try {
        sessionStorage.removeItem(CLUB_LOGIN_CODE_KEY);
    } catch {}
    codeInput.value = '';
    loginBtn.disabled = true;
    loginBtn.textContent = 'Fortsæt';
    selectEl.innerHTML = '<option value="">Henter institutioner...</option>';

    if (!institutions || !institutions.length) {
        selectEl.innerHTML = '<option value="">Ingen institutioner fundet</option>';
        errorEl.textContent = 'Kunne ikke hente institutioner. Prøv igen senere.';
        return;
    }

    selectEl.innerHTML = '<option value="">— Vælg institution —</option>';
    institutions.forEach(inst => {
        const opt = document.createElement('option');
        opt.value = inst.id;
        opt.textContent = inst.name;
        selectEl.appendChild(opt);
    });

    loginBtn.disabled = false;

    loginBtn.onclick = async () => {
        errorEl.textContent = '';
        const chosenId = selectEl.value;
        const code = (codeInput.value || '').trim();

        if (!chosenId) {
            errorEl.textContent = 'Vælg institution først.';
            return;
        }
        if (!code) {
            errorEl.textContent = 'Indtast klubbens login-kode.';
            return;
        }
        const inst = institutions.find(i => String(i.id) === String(chosenId));
        if (!inst) {
            errorEl.textContent = 'Vælg institution først.';
            return;
        }

        // SIKKERHED: login_code må ikke ligge i klienten. Verificér via RPC.
        try {
            const { data: ok, error } = await supabaseClient.rpc('verify_club_login', {
                p_institution_id: inst.id,
                p_code: code,
            });
            if (error || ok !== true) {
                errorEl.textContent = 'Forkert klubkode. Prøv igen, eller spørg en voksen i klubben.';
                return;
            }
        } catch (e) {
            errorEl.textContent = 'Kunne ikke bekræfte klubkoden. Prøv igen.';
            return;
        }

        // Gem kode til admin-email autofill og send den videre til locked screen
        lastClubLoginCode = code;
        try {
            sessionStorage.setItem(CLUB_LOGIN_CODE_KEY, code);
        } catch {}
        rememberInstitution(inst);
        await setupLockedScreen(code);
    };
}

export async function setupLockedScreen(clubLoginCode = null) {
    const club = await ensureActiveInstitution();
    if (!club) {
        await supabaseClient.auth.signOut();
        return setupClubLoginScreen();
    }
    showScreen('screen-locked');
    const emailInput = document.getElementById('admin-email-input');
    const passwordInput = document.getElementById('admin-password-input');
    const loginBtn = document.getElementById('admin-login-btn');
    const developerLoginBtn = document.getElementById('developer-login-btn');
    const errorEl = document.getElementById('locked-screen-error');
    const clubLabel = document.getElementById('active-club-label');
    const switchClubBtn = document.getElementById('switch-club-btn');
    const adminSelect = document.getElementById('admin-user-select');

    if (clubLabel) {
        clubLabel.textContent = `Aktiv klub: ${club.name}`;
    }
    if (switchClubBtn) {
        switchClubBtn.style.display = 'inline-block';
        switchClubBtn.onclick = async () => {
            clearSavedInstitution();
            try {
                sessionStorage.removeItem(CLUB_LOGIN_CODE_KEY);
            } catch {}
            await supabaseClient.auth.signOut();
            await fetchInstitutions(true);
            await setupClubLoginScreen();
        };
    }

    if (adminSelect) {
        adminSelect.disabled = true;
        adminSelect.innerHTML = '<option value="">Henter administratorer...</option>';
        if (clubLoginCode) {
            lastClubLoginCode = clubLoginCode;
            try {
                sessionStorage.setItem(CLUB_LOGIN_CODE_KEY, clubLoginCode);
            } catch {}
        } else if (!lastClubLoginCode) {
            try {
                lastClubLoginCode = sessionStorage.getItem(CLUB_LOGIN_CODE_KEY);
            } catch {}
        }
        fetchAdminsForInstitution(club.id, { loginCode: lastClubLoginCode }).then(admins => {
            if (!adminSelect) return;
            if (!admins.length) {
                adminSelect.innerHTML = '<option value="">Ingen administratorer fundet</option>';
                adminSelect.disabled = true;
                emailInput.value = '';
                return;
            }
            adminSelect.disabled = false;
            adminSelect.innerHTML = '<option value="">— Vælg administrator —</option>';
            admins.forEach(admin => {
                const opt = document.createElement('option');
                opt.value = admin.email || admin.id || '';
                opt.textContent = admin.name || admin.email || 'Admin';
                adminSelect.appendChild(opt);
            });
            adminSelect.onchange = () => {
                // Vi autofylder ikke email længere (skal indtastes manuelt).
                const selectedId = adminSelect.value;
                if (selectedId) {
                    // Hvis vi fik email fra RPC, brug den; ellers tom og fokus.
                    if (selectedId.includes('@')) {
                        emailInput.value = selectedId;
                        passwordInput.focus();
                    } else {
                        emailInput.value = '';
                        emailInput.focus();
                    }
                } else {
                    emailInput.value = '';
                    emailInput.focus();
                }
            };
        });
    }

    emailInput.focus();

    loginBtn.onclick = async () => {
        errorEl.textContent = '';
        const email = emailInput.value;
        const password = passwordInput.value;
        if (!email.trim() || !password.trim()) {
            errorEl.textContent = 'Indtast venligst både e-mail og adgangskode.';
            return;
        }

        loginBtn.disabled = true;
        loginBtn.textContent = 'Logger ind...';

        const { success } = await performLogin(email, password);

        if (success) {
            location.reload();
        } else {
            errorEl.textContent = 'Forkert adgangskode. Prøv igen.';
            loginBtn.disabled = false;
            loginBtn.textContent = 'Lås op & Log ind';
        }
    };

    developerLoginBtn.onclick = async () => {
        errorEl.textContent = '';
        developerLoginBtn.disabled = true;
        developerLoginBtn.textContent = 'Logger ind...';

        const { success } = await performLogin('authadmin@flango.dk', '123456');

        if (success) {
            location.reload();
        } else {
            errorEl.textContent = 'Developer login fejlede. Er brugeren oprettet?';
            developerLoginBtn.disabled = false;
            developerLoginBtn.textContent = 'Developer Login';
        }
    };
}
