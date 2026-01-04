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

    try {
        const { data, error } = await supabaseClient
            .from('institutions')
            .select(`
                id, name, login_code,
                sugar_policy_enabled, sugar_policy_max_unhealthy_per_day,
                sugar_policy_max_per_product_per_day, sugar_policy_max_unhealthy_enabled,
                sugar_policy_max_per_product_enabled,
                balance_limit_enabled, balance_limit_amount,
                balance_limit_exempt_admins, balance_limit_exempt_test_users,
                spending_limit_enabled, spending_limit_amount,
                spending_limit_applies_to_regular_users, spending_limit_applies_to_admins,
                spending_limit_applies_to_test_users,
                show_admins_in_user_list, admins_purchase_free
            `)
            .order('name');
        if (error) throw error;
        const result = data || [];
        institutionsCache = result;
        return result;
    } catch (err) {
        console.error('Kunne ikke hente institutioner:', err);
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
