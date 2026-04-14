/**
 * Kitchen view authentication.
 * Reuses verify_club_login RPC for institution-level access.
 */
import { supabaseClient } from '../core/config-and-supabase.js?v=3.0.76';

const KITCHEN_INSTITUTION_KEY = 'flango_kitchen_institution_id';
const KITCHEN_INSTITUTION_NAME_KEY = 'flango_kitchen_institution_name';

export function getKitchenInstitutionId() {
    return localStorage.getItem(KITCHEN_INSTITUTION_KEY);
}

export function getKitchenInstitutionName() {
    return localStorage.getItem(KITCHEN_INSTITUTION_NAME_KEY);
}

/**
 * Renders login screen and returns when authenticated.
 * @returns {Promise<{institutionId: string, institutionName: string}>}
 */
export async function authenticateKitchen() {
    // Check if already logged in
    const savedId = getKitchenInstitutionId();
    const savedName = getKitchenInstitutionName();
    if (savedId && savedName) {
        return { institutionId: savedId, institutionName: savedName };
    }

    // Fetch institutions (anon access via RPC)
    const { data: institutions, error } = await supabaseClient
        .rpc('get_institutions_for_app', { p_app_name: 'cafe' });

    if (error || !institutions?.length) {
        throw new Error('Kunne ikke hente institutioner');
    }

    const loginEl = document.getElementById('kitchen-login');
    loginEl.style.display = 'flex';

    return new Promise((resolve, reject) => {
        const optionsHtml = institutions.map(i =>
            `<option value="${i.id}">${i.name}</option>`
        ).join('');

        loginEl.innerHTML = `
            <div class="kitchen-login-card">
                <div class="kitchen-login-logo">🍽️</div>
                <h1>Flango Køkkenskærm</h1>
                <p>Log ind med din institutions login-kode</p>
                <select id="kitchen-inst-select">
                    <option value="">— Vælg institution —</option>
                    ${optionsHtml}
                </select>
                <input type="text" id="kitchen-code-input" placeholder="Login-kode" maxlength="8" autocomplete="off">
                <button id="kitchen-login-btn">Log ind</button>
                <div id="kitchen-login-error" class="kitchen-login-error"></div>
            </div>
        `;

        const selectEl = loginEl.querySelector('#kitchen-inst-select');
        const codeInput = loginEl.querySelector('#kitchen-code-input');
        const loginBtn = loginEl.querySelector('#kitchen-login-btn');
        const errorEl = loginEl.querySelector('#kitchen-login-error');

        const doLogin = async () => {
            errorEl.textContent = '';
            const chosenId = selectEl.value;
            const code = (codeInput.value || '').trim();

            if (!chosenId) {
                errorEl.textContent = 'Vælg institution først.';
                return;
            }
            if (!code) {
                errorEl.textContent = 'Indtast login-kode.';
                return;
            }

            loginBtn.disabled = true;
            loginBtn.textContent = 'Logger ind...';

            try {
                const { data: ok, error: rpcError } = await supabaseClient.rpc('verify_club_login', {
                    p_institution_id: chosenId,
                    p_code: code,
                });
                if (rpcError || ok !== true) {
                    errorEl.textContent = 'Forkert login-kode. Prøv igen.';
                    loginBtn.disabled = false;
                    loginBtn.textContent = 'Log ind';
                    return;
                }
            } catch (e) {
                errorEl.textContent = 'Fejl ved login. Prøv igen.';
                loginBtn.disabled = false;
                loginBtn.textContent = 'Log ind';
                return;
            }

            const inst = institutions.find(i => String(i.id) === String(chosenId));
            const name = inst?.name || 'Institution';

            localStorage.setItem(KITCHEN_INSTITUTION_KEY, chosenId);
            localStorage.setItem(KITCHEN_INSTITUTION_NAME_KEY, name);

            loginEl.style.display = 'none';
            resolve({ institutionId: chosenId, institutionName: name });
        };

        loginBtn.addEventListener('click', doLogin);
        codeInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') doLogin();
        });
    });
}

export function logoutKitchen() {
    localStorage.removeItem(KITCHEN_INSTITUTION_KEY);
    localStorage.removeItem(KITCHEN_INSTITUTION_NAME_KEY);
    location.reload();
}
