import { supabaseClient, INSTITUTION_ID_KEY, INSTITUTION_NAME_KEY } from '../core/config-and-supabase.js';

let activeInstitution = null;
let institutionsCache = [];

// ============================================================================
// INSTITUTION CACHE (session-niveau - reducer institutions queries)
// ============================================================================
// Eksponér cache via window så andre moduler kan bruge den
if (typeof window !== 'undefined') {
    window.__flangoGetInstitutionById = (id) => {
        if (!id) return null;
        const strId = String(id);
        return institutionsCache.find(inst => String(inst.id) === strId) || null;
    };
    window.__flangoGetAllInstitutions = () => institutionsCache;
}

export async function fetchInstitutions(forceRefresh = false) {
    // Undgå re-fetch hvis vi allerede har data (og ikke force)
    if (!forceRefresh && institutionsCache.length > 0) {
        return institutionsCache;
    }

    const doFetch = async (retryCount = 0) => {
        // VIGTIGT SIKKERHED:
        // - login_code må ikke hentes til klienten.
        // - For "klub login" (ingen auth session) henter vi kun id/name/is_active.
        // - Efter admin-login (auth session) henter vi institutions settings (stadig uden login_code).
        let isAuthed = false;
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            isAuthed = !!session;
        } catch (sessionErr) {
            // Hvis getSession fejler med AbortError, prøv igen efter kort pause
            const isAbort = sessionErr?.name === 'AbortError' || (sessionErr?.message || '').includes('aborted');
            if (isAbort && retryCount < 2) {
                console.warn(`[institution-store] getSession AbortError, retry ${retryCount + 1}/2...`);
                await new Promise(r => setTimeout(r, 300 * (retryCount + 1)));
                return doFetch(retryCount + 1);
            }
            // Fallback: antag ikke-authed og fortsæt med minimal query
            console.warn('[institution-store] getSession fejlede, fortsætter som anon:', sessionErr?.message);
            isAuthed = false;
        }

        // For anon (login-flow): brug RPC der filtrerer på institution_apps (kun café-aktiverede)
        // For authed (efter admin-login): hent fuld settings for valgt institution
        let data, error;
        if (isAuthed) {
            ({ data, error } = await supabaseClient
                .from('institutions')
                .select(`
                    id, name, is_active,
                    sugar_policy_enabled, sugar_policy_max_unhealthy_per_day,
                    sugar_policy_max_per_product_per_day, sugar_policy_max_unhealthy_enabled,
                    sugar_policy_max_per_product_enabled,
                    balance_limit_enabled, balance_limit_amount,
                    balance_limit_exempt_admins, balance_limit_exempt_test_users,
                    spending_limit_enabled, spending_limit_amount,
                    spending_limit_applies_to_regular_users, spending_limit_applies_to_admins,
                    spending_limit_applies_to_test_users,
                    show_admins_in_user_list, admins_purchase_free, shift_timer_enabled
                `)
                .order('name'));
        } else {
            ({ data, error } = await supabaseClient
                .rpc('get_institutions_for_app', { p_app_name: 'cafe' }));
        }

        if (error) {
            // Hvis query fejler med AbortError, prøv igen
            const isAbort = error?.name === 'AbortError' || (error?.message || '').includes('aborted');
            if (isAbort && retryCount < 2) {
                console.warn(`[institution-store] Query AbortError, retry ${retryCount + 1}/2...`);
                await new Promise(r => setTimeout(r, 300 * (retryCount + 1)));
                return doFetch(retryCount + 1);
            }
            console.error('[institution-store] Supabase fejl:', error);
            throw error;
        }
        return data ?? [];
    };

    try {
        const result = await doFetch();
        institutionsCache = result;
        console.log(`[institution-store] Hentet ${result.length} institutioner`);
        return result;
    } catch (err) {
        const isAbort = err?.name === 'AbortError' || (err?.message || '').includes('aborted');
        console.error('[institution-store] Kunne ikke hente institutioner:', err?.message || err);
        if (isAbort) {
            console.warn('[institution-store] AbortError – har du flere faner med Flango/forældreportal åbne? Luk andre faner og prøv igen.');
        }
        console.error('[institution-store] Fejl detaljer:', {
            message: err?.message,
            code: err?.code,
            details: err?.details,
            hint: err?.hint
        });
        if (forceRefresh) institutionsCache = [];
        return [];
    }
}

export function rememberInstitution(inst) {
    if (!inst) return;
    activeInstitution = inst;
    localStorage.setItem(INSTITUTION_ID_KEY, String(inst.id));
    localStorage.setItem(INSTITUTION_NAME_KEY, inst.name || '');
}

export function clearSavedInstitution() {
    activeInstitution = null;
    localStorage.removeItem(INSTITUTION_ID_KEY);
    localStorage.removeItem(INSTITUTION_NAME_KEY);
}

export async function ensureActiveInstitution() {
    if (activeInstitution) return activeInstitution;
    const savedId = localStorage.getItem(INSTITUTION_ID_KEY);
    if (!savedId) return null;
    if (!institutionsCache.length) {
        institutionsCache = await fetchInstitutions();
    }
    activeInstitution = institutionsCache.find(inst => String(inst.id) === String(savedId)) || null;
    if (!activeInstitution) clearSavedInstitution();
    return activeInstitution;
}

export function getActiveInstitution() {
    return activeInstitution;
}

/**
 * Opdater en institution i cache'en (fx efter at have gemt shift_timer_enabled)
 * @param {string} institutionId
 * @param {object} updates - Felter der skal opdateres
 */
export function updateInstitutionCache(institutionId, updates) {
    if (!institutionId || !updates) return;
    const strId = String(institutionId);
    const index = institutionsCache.findIndex(inst => String(inst.id) === strId);
    if (index !== -1) {
        institutionsCache[index] = { ...institutionsCache[index], ...updates };
    }
}
