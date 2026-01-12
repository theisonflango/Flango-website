let _supabaseClient = null;
let _getInstitutionId = null;

export function initHistoryStore({ supabaseClient, getInstitutionId }) {
    _supabaseClient = supabaseClient;
    _getInstitutionId = getInstitutionId || null;
}

export async function loadSalesHistory({ from, to, includeTestUsers = false, onlyTestUsers = false } = {}) {
    if (!_supabaseClient) {
        throw new Error('History store not initialized.');
    }

    const start = from ? new Date(`${from}T00:00:00`) : null;
    const end = to ? new Date(`${to}T23:59:59.999`) : null;
    const startIso = start ? start.toISOString() : null;
    const endIso = end ? end.toISOString() : null;

    let query = _supabaseClient
        .from('events_view')
        .select('*')
        .order('created_at', { ascending: false });

    const instId = typeof _getInstitutionId === 'function' ? _getInstitutionId() : null;
    if (instId) {
        query = query.eq('institution_id', instId);
    }
    if (startIso) {
        query = query.gte('created_at', startIso);
    }
    if (endIso) {
        query = query.lte('created_at', endIso);
    }

    // Filter test users based on mode
    if (onlyTestUsers) {
        // ONLY show test users
        query = query.eq('target_is_test_user', true);
    } else if (!includeTestUsers) {
        // Exclude test users (default)
        query = query.or('target_is_test_user.is.null,target_is_test_user.eq.false');
    }
    // If includeTestUsers=true and onlyTestUsers=false, no filter (show all)

    const { data, error } = await query;
    if (error) {
        return { rows: [], error };
    }
    return { rows: data || [], error: null };
}
