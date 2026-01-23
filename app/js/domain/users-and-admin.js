// Midlertidigt ikke i brug – user/admin-logik ligger igen i app.js.
// TODO: Users/Admin modul er udskudt.
// Al user/admin-logik lever lige nu i app.js af hensyn til stabilitet.

import { supabaseClient } from '../core/config-and-supabase.js';
import { escapeHtml } from '../core/escape-html.js';

const adminCacheByInstitutionUsers = {};

export function getCurrentInstitutionId(adminProfile, clerkProfile) {
    if (adminProfile && adminProfile.institution_id) {
        return adminProfile.institution_id;
    }
    if (clerkProfile && clerkProfile.institution_id) {
        return clerkProfile.institution_id;
    }
    return null;
}

export function mergeUsersWithParentNotifications(usersData, parentNotifications) {
    const notifMap = new Map();
    (parentNotifications || []).forEach(row => {
        notifMap.set(row.user_id, row);
    });

    return (usersData || []).map(user => {
        user._parentNotification = notifMap.get(user.id) || null;
        return user;
    });
}

export function buildUserAdminTableRows(users, selectedIndex = 0) {
    if (!Array.isArray(users) || users.length === 0) return '';

    const safeNumber = (value) => {
        if (value === null || value === undefined || value === '') return '—';
        return value;
    };

    const safeBalance = (value) => {
        const num = typeof value === 'number' ? value : parseFloat(value) || 0;
        return num.toFixed(2);
    };

    return users.map((user, index) => {
        const highlightClass = index === selectedIndex ? ' highlight' : '';
        const balanceClass = (user.balance || 0) < 0 ? 'negative' : 'positive';
        return `
            <div class="modal-entry">
                <div class="modal-entry-info${highlightClass}" data-index="${index}" data-user-id="${user.id}">
                    <span class="user-list-name">${escapeHtml(user.name)}</span>
                    <span class="user-list-number">${escapeHtml(safeNumber(user.number))}</span>
                    <span class="user-list-balance ${balanceClass}">${safeBalance(user.balance)} kr.</span>
                    <div class="admin-action-column">
                        <button type="button" class="admin-action-btn" data-user-action="deposit" data-id="${user.id}">Opdater Saldo</button>
                    </div>
                </div>
            </div>`;
    }).join('');
}

export function buildCustomerSelectionEntryElement(user, index, isHighlighted) {
    const userElement = document.createElement('div');
    userElement.className = 'modal-entry';
    userElement.innerHTML = `
        <div class="modal-entry-info ${isHighlighted ? 'highlight' : ''}" data-user-id="${user.id}" data-user-role="${user.role}" style="cursor: pointer;">
            <span class="user-list-name">${escapeHtml(user.name)}</span>
            <span class="user-list-number">${escapeHtml(user.number || '—')}</span>
            <span class="user-list-balance ${user.balance < 0 ? 'negative' : 'positive'}">${user.balance.toFixed(2)} kr.</span>
        </div>`;
    return userElement;
}

export async function fetchAdminsForInstitution(instId, options = {}) {
    if (!instId) return [];
    if (adminCacheByInstitutionUsers?.[instId]) return adminCacheByInstitutionUsers[instId];
    try {
        const { loginCode } = options || {};
        // Hvis vi har verificeret klubkode i denne session, kan vi hente emails via secure RPC.
        const rpcName = loginCode ? 'get_admin_directory_for_login' : 'get_admin_directory_public';
        const params = loginCode
            ? { p_institution_id: instId, p_code: loginCode }
            : { p_institution_id: instId };

        const { data, error } = await supabaseClient.rpc(rpcName, params);
        if (error) throw error;
        adminCacheByInstitutionUsers[instId] = data || [];
    } catch (err) {
        console.error('Kunne ikke hente admin-brugere:', err);
        adminCacheByInstitutionUsers[instId] = [];
    }
    return adminCacheByInstitutionUsers[instId];
}

export async function updateUserCoreFields(userId, updates) {
    return supabaseClient
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
}

export async function depositToUser(userId, amount) {
    return supabaseClient.rpc('make_deposit', {
        p_target_user_id: userId,
        p_amount: amount,
    });
}

export async function setUserBalanceDirectly(userId, newBalance) {
    return supabaseClient.rpc('edit_balance', {
        p_target_user_id: userId,
        p_new_balance: newBalance,
    });
}

export async function updateUserPin(userId, pin) {
    return supabaseClient
        .from('users')
        .update({ pin })
        .eq('id', userId);
}

export async function updateUserBadgeLabel(userId, badgeLabel) {
    return supabaseClient
        .from('users')
        .update({ badge_label: badgeLabel })
        .eq('id', userId);
}
