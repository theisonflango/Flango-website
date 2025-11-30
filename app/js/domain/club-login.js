import { supabaseClient } from '../core/config-and-supabase.js';
import { rememberInstitution, clearSavedInstitution, ensureActiveInstitution, fetchInstitutions } from './institution-store.js';
import { performLogin } from './auth-and-session.js';
import { fetchAdminsForInstitution } from './users-and-admin.js';
import { showScreen } from '../ui/shell-and-theme.js';

export async function setupClubLoginScreen() {
    const institutions = await fetchInstitutions();
    showScreen('screen-club-login');
    const selectEl = document.getElementById('club-institution-select');
    const codeInput = document.getElementById('club-code-input');
    const loginBtn = document.getElementById('club-login-btn');
    const errorEl = document.getElementById('club-login-error');
    if (!selectEl || !codeInput || !loginBtn || !errorEl) return;

    errorEl.textContent = '';
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
        if (!inst || inst.login_code !== code) {
            errorEl.textContent = 'Forkert klubkode. Prøv igen, eller spørg en voksen i klubben.';
            return;
        }
        rememberInstitution(inst);
        await setupLockedScreen();
    };
}

export async function setupLockedScreen() {
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
            await supabaseClient.auth.signOut();
            await fetchInstitutions(true);
            await setupClubLoginScreen();
        };
    }

    if (adminSelect) {
        adminSelect.disabled = true;
        adminSelect.innerHTML = '<option value="">Henter administratorer...</option>';
        fetchAdminsForInstitution(club.id).then(admins => {
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
                opt.value = admin.email || '';
                opt.textContent = admin.name || admin.email || 'Admin';
                adminSelect.appendChild(opt);
            });
            adminSelect.onchange = () => {
                const selectedEmail = adminSelect.value;
                if (selectedEmail) {
                    emailInput.value = selectedEmail;
                    passwordInput.focus();
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
