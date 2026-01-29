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
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/061553fc-00e4-4d47-b4a3-265f30951c0a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'institution-store.js:19',message:'fetchInstitutions entry',data:{forceRefresh,hasCache:institutionsCache.length>0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        
        // VIGTIGT SIKKERHED:
        // - login_code må ikke hentes til klienten.
        // - For "klub login" (ingen auth session) henter vi kun id/name/is_active.
        // - Efter admin-login (auth session) henter vi institutions settings (stadig uden login_code).
        const { data: { session } } = await supabaseClient.auth.getSession();
        const isAuthed = !!session;
        
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/061553fc-00e4-4d47-b4a3-265f30951c0a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'institution-store.js:32',message:'fetchInstitutions session check',data:{isAuthed,hasSession:!!session},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion

        const { data, error } = await supabaseClient
            .from('institutions')
            .select(isAuthed ? `
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
            `)
            .order('name');
            
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/061553fc-00e4-4d47-b4a3-265f30951c0a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'institution-store.js:49',message:'fetchInstitutions query result',data:{hasError:!!error,error:error?.message||null,errorCode:error?.code||null,dataLength:data?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
            
        if (error) {
            console.error('[institution-store] Supabase fejl:', error);
            // #region agent log
            fetch('http://127.0.0.1:7243/ingest/061553fc-00e4-4d47-b4a3-265f30951c0a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'institution-store.js:51',message:'fetchInstitutions error path',data:{error:error?.message||String(error),code:error?.code||null,details:error?.details||null,hint:error?.hint||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            throw error;
        }
        const result = data || [];
        institutionsCache = result;
        console.log(`[institution-store] Hentet ${result.length} institutioner`);
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/061553fc-00e4-4d47-b4a3-265f30951c0a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'institution-store.js:56',message:'fetchInstitutions success',data:{resultLength:result.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        return result;
    } catch (err) {
        console.error('[institution-store] Kunne ikke hente institutioner:', err);
        console.error('[institution-store] Fejl detaljer:', {
            message: err?.message,
            code: err?.code,
            details: err?.details,
            hint: err?.hint
        });
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/061553fc-00e4-4d47-b4a3-265f30951c0a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'institution-store.js:59',message:'fetchInstitutions catch block',data:{error:err?.message||String(err),code:err?.code||null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
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
