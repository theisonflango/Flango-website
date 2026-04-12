/**
 * Audit-event logging modul
 *
 * Logger sikkerhedsrelevante hændelser til events-tabellen.
 * Fire-and-forget — fejl logges til console men blokerer ikke UI.
 */

import { supabaseClient } from './config-and-supabase.js?v=3.0.66';

/**
 * Log en audit-event til events-tabellen.
 * @param {string} eventType - LOGIN, FAILED_LOGIN, USER_CREATED, USER_DELETED, SETTINGS_CHANGE osv.
 * @param {object} opts
 * @param {string} opts.institutionId
 * @param {string} [opts.adminUserId] - auth.uid()
 * @param {string} [opts.targetUserId]
 * @param {object} [opts.details] - JSONB
 */
export async function logAuditEvent(eventType, { institutionId, adminUserId, targetUserId, details } = {}) {
    if (!institutionId) return;
    try {
        await supabaseClient.from('events').insert({
            event_type: eventType,
            institution_id: institutionId,
            admin_user_id: adminUserId ?? null,
            target_user_id: targetUserId ?? null,
            details: details ?? null,
        });
    } catch (e) {
        console.error('[audit-events]', eventType, e?.message);
    }
}
