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

    const doFetch = async () => {
        // VIGTIGT SIKKERHED:
        // - login_code må ikke hentes til klienten.
        // - For "klub login" (ingen auth session) henter vi kun id/name/is_active.
        // - Efter admin-login (auth session) henter vi institutions settings (stadig uden login_code).
        const { data: { session } } = await supabaseClient.auth.getSession();
        const isAuthed = !!session;

        const selectFields = isAuthed ? `
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
            ` : `
                id, name, is_active
            `;

        // Prøv direkte fetch først for at se den faktiske HTTP response
        if (!isAuthed) {
            try {
                const SUPABASE_URL = 'https://jbknjgbpghrbrstqwoxj.supabase.co';
                const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impia25qZ2JwZ2hyYnJzdHF3b3hqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2MjIwNjMsImV4cCI6MjA3ODE5ODA2M30.ZMlxQyzmXuy43EcKIN6-eO8pJZs2F6kfDw_cfaks9qQ';
                const url = `${SUPABASE_URL}/rest/v1/institutions?select=id,name,is_active&order=name.asc`;
                console.log('[institution-store] Prøver direkte fetch:', url);
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    }
                });
                console.log('[institution-store] Direkte fetch response:', {
                    status: response.status,
                    statusText: response.statusText,
                    ok: response.ok,
                    headers: Object.fromEntries(response.headers.entries())
                });
                if (!response.ok) {
                    const text = await response.text();
                    console.error('[institution-store] Direkte fetch fejl:', text);
                    throw new Error(`HTTP ${response.status}: ${text}`);
                }
                const data = await response.json();
                console.log('[institution-store] Direkte fetch succes:', data.length, 'institutioner');
                return data;
            } catch (directFetchErr) {
                console.error('[institution-store] Direkte fetch fejlede, prøver Supabase client:', directFetchErr);
                // Fortsæt til Supabase client som fallback
            }
        }

        const query = supabaseClient
            .from('institutions')
            .select(selectFields)
            .order('name');

        const { data, error } = await query;

        if (error) {
            console.error('[institution-store] Supabase fejl:', error);
            console.error('[institution-store] Fejl detaljer:', {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint,
                status: error.status,
                statusCode: error.statusCode
            });
            throw error;
        }
        return data ?? [];
    };

    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const result = await doFetch();
            institutionsCache = result;
            console.log(`[institution-store] Hentet ${result.length} institutioner`);
            return result;
        } catch (err) {
            const isAbort = err?.name === 'AbortError' || (err?.message || '').includes('aborted');
            console.error(`[institution-store] Hent institutioner forsøg ${attempt}/3:`, err?.message || err);
            console.error('[institution-store] Fejl objekt:', err);
            
            // Hvis det er AbortError, prøv igen med længere delay
            if (attempt < 3 && isAbort) {
                const delay = attempt * 1000; // 1s, 2s
                console.warn(`[institution-store] AbortError – prøver igen om ${delay} ms`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            
            // Hvis det ikke er AbortError, eller vi har prøvet 3 gange, log detaljeret fejl
            console.error('[institution-store] Fejl detaljer:', {
                name: err?.name,
                message: err?.message,
                code: err?.code,
                status: err?.status,
                statusCode: err?.statusCode,
                details: err?.details,
                hint: err?.hint,
                stack: err?.stack
            });
            
            // Hvis det ikke er AbortError, stop retry loop
            if (!isAbort) {
                break;
            }
        }
    }
    if (forceRefresh) institutionsCache = [];
    return [];
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
