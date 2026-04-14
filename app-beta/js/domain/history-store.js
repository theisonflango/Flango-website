import { runWithAuthRetry } from '../core/auth-retry.js';

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

    const buildQuery = () => {
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
        return query;
    };

    const { data, error } = await runWithAuthRetry('loadSalesHistory', buildQuery);
    if (error) {
        return { rows: [], error };
    }
    const rows = data || [];
    // Enrich rows with clerk/admin IDs from events table (events_view doesn't include them)
    const eventIds = rows.map(row => row.id).filter(Boolean);
    if (eventIds.length > 0) {
        const chunkSize = 200;
        const chunks = [];
        for (let i = 0; i < eventIds.length; i += chunkSize) {
            chunks.push(eventIds.slice(i, i + chunkSize));
        }

        const byId = new Map();
        for (const chunk of chunks) {
            const { data: eventRows, error: eventsError } = await runWithAuthRetry('loadSalesHistoryEvents', () => {
                let query = _supabaseClient
                    .from('events')
                    .select('id, clerk_user_id, admin_user_id, session_admin_id')
                    .in('id', chunk);
                return query;
            });

            if (eventsError) {
                continue;
            }
            if (Array.isArray(eventRows)) {
                eventRows.forEach(evt => byId.set(evt.id, evt));
            }
        }

        rows.forEach(row => {
            const evt = byId.get(row.id);
            if (!evt) return;
            row.clerk_user_id = row.clerk_user_id || evt.clerk_user_id || null;
            row.admin_user_id = row.admin_user_id || evt.admin_user_id || null;
            row.session_admin_id = row.session_admin_id || evt.session_admin_id || null;
        });
    }

    return { rows, error: null };
}
