// Ansvar: forældre-portal tekstskabelon, admin-overblik, RPC-save/load, notifikationer.

import { supabaseClient } from '../core/config-and-supabase.js';
import { getCurrentInstitutionId } from '../domain/users-and-admin.js';
import { showAlert, showCustomAlert } from '../ui/sound-and-alerts.js';

export async function loadParentPortalTemplateFromDatabase(currentTemplate, adminProfile, clerkProfile) {
    const institutionId = getCurrentInstitutionId(adminProfile, clerkProfile);
    if (!institutionId) return currentTemplate;

    try {
        const { data, error } = await supabaseClient
            .from('institutions')
            .select('parent_portal_message_template')
            .eq('id', institutionId)
            .single();

        if (error) {
            console.warn('Kunne ikke hente parent_portal_message_template:', error);
            return currentTemplate;
        }

        if (data?.parent_portal_message_template) {
            return data.parent_portal_message_template;
        }

        return currentTemplate;
    } catch (e) {
        console.error('Uventet fejl ved hentning:', e);
        return currentTemplate;
    }
}

export async function saveParentPortalTemplateToDatabase(template, adminProfile, clerkProfile) {
    const institutionId = getCurrentInstitutionId(adminProfile, clerkProfile);
    if (!institutionId || !template) return false;

    try {
        const { error } = await supabaseClient.rpc('set_parent_portal_template', {
            p_institution_id: institutionId,
            p_template: template,
        });

        if (error) {
            console.error('Fejl ved gemning:', error);
            showAlert('Fejl: Kunne ikke gemme skabelonen.');
            return false;
        }

        showCustomAlert('Gemt', 'Standardbeskeden er blevet opdateret.');
        return true;
    } catch (e) {
        console.error('Uventet fejl ved gemning:', e);
        return false;
    }
}

export function renderParentPortalMessageFromTemplate(template, childName, pin) {
    const message = template || '';
    if (!message) return '';
    return message
        .replace(/{{\s*child_name\s*}}/g, childName)
        .replace(/{{\s*pin\s*}}/g, pin);
}

export function buildParentPortalAdminTableRows(children, selectedParentId = null) {
    if (!Array.isArray(children) || children.length === 0) return '';

    const escapeText = (value) => {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    };

    const rows = children.map((child) => {
        const notif = child._parentNotification || null;
        let saldoText = '—';
        if (notif) {
            if (notif.notify_at_zero && notif.notify_at_ten) {
                saldoText = '🔔 0 kr + 10 kr';
            } else if (notif.notify_at_zero) {
                saldoText = '🔔 0 kr';
            } else if (notif.notify_at_ten) {
                saldoText = '🔔 10 kr';
            }
        }

        const rowClass = selectedParentId && String(selectedParentId) === String(child.id)
            ? ' class="selected-parent-row"'
            : '';

        return `
            <tr${rowClass}>
                <td>${escapeText(child.name)}</td>
                <td>${child.parent_pin_hash ? '✔' : '—'}</td>
                <td>${child.last_parent_login_at ? '✔' : '—'}</td>
                <td>${child.parent_pin_is_custom ? '✔' : '—'}</td>
                <td>${saldoText}</td>
                <td><button type="button">Ny kode</button></td>
            </tr>
        `;
    });

    return rows.join('');
}
