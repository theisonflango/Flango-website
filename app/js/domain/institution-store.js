import { supabaseClient, INSTITUTION_ID_KEY, INSTITUTION_NAME_KEY } from '../core/config-and-supabase.js';

let activeInstitution = null;
let institutionsCache = [];

export async function fetchInstitutions(forceRefresh = false) {
    try {
        const { data, error } = await supabaseClient
            .from('institutions')
            .select('id,name,login_code')
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
