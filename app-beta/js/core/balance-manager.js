import { supabaseClient } from './config-and-supabase.js';
import { safeDbCall } from './safe-db-call.js';
import { setCustomerBalance, getCurrentCustomer } from '../domain/cafe-session-store.js';

// Event listeners for balance changes
const balanceChangeListeners = new Map();

/**
 * Register a listener for balance changes
 * @param {string} listenerId - Unique ID for listener
 * @param {function} callback - Called with { userId, newBalance, delta, source }
 */
export function onBalanceChange(listenerId, callback) {
    balanceChangeListeners.set(listenerId, callback);
}

/**
 * Unregister a balance change listener
 * @param {string} listenerId - Listener ID to remove
 */
export function offBalanceChange(listenerId) {
    balanceChangeListeners.delete(listenerId);
}

/**
 * Broadcast balance change to all listeners
 * @param {object} event - { userId, newBalance, delta, source }
 */
function broadcastBalanceChange(event) {
    balanceChangeListeners.forEach(callback => {
        try {
            callback(event);
        } catch (err) {
            console.error('[balance-manager] Listener error:', err);
        }
    });
}

/**
 * Update customer balance in all relevant caches
 * @param {string} userId - Customer ID
 * @param {number} newBalance - New balance value
 * @param {number} delta - Change amount (for logging)
 * @param {string} source - Source of change (for debugging)
 * @param {object} [options] - Extra metadata for event consumers
 * @param {'provisional'|'confirmed'} [options.status='confirmed'] - Lifecycle state
 * @param {string|null} [options.nonce=null] - Correlates provisional/confirmed
 * @returns {boolean} Success
 */
export function updateCustomerBalanceGlobally(userId, newBalance, delta = 0, source = 'unknown', options = {}) {
    const { status = 'confirmed', nonce = null } = options || {};

    // 1. Update allUsers array (if exists)
    const allUsers = window.__flangoAllUsers || [];
    const user = allUsers.find(u => u.id === userId);
    if (user) {
        user.balance = newBalance;
        console.log(`[balance-manager] Updated ${user.name} balance = ${newBalance} kr (${source})`);
    } else {
        console.warn(`[balance-manager] WARNING: User not found! userId=${userId}, allUsers.length=${allUsers.length}`);
    }

    // 2. Update currentCustomer cache (if this user is selected) - use canonical source
    const currentCustomer = getCurrentCustomer();
    if (currentCustomer && currentCustomer.id === userId) {
        setCustomerBalance(newBalance);
        console.log(`[balance-manager] Updated currentCustomer = ${newBalance} kr (${source})`);
    }

    // 3. Broadcast event
    broadcastBalanceChange({ userId, newBalance, delta, source, status, nonce });

    return true;
}

/**
 * Refresh customer balance from database
 * @param {string} userId - Customer ID
 * @param {object} [options]
 * @param {'provisional'|'confirmed'} [options.status='confirmed']
 * @param {string|null} [options.nonce=null]
 * @param {number} [options.retry=1] - transient retry attempts
 * @returns {Promise<number|null>} New balance or null on error
 */
export async function refreshCustomerBalanceFromDB(userId, options = {}) {
    const { status = 'confirmed', nonce = null, retry = 1 } = options || {};

    const result = await safeDbCall('refreshUserBalance', () => supabaseClient
        .from('users')
        .select('balance')
        .eq('id', userId)
        .single(), { retry, critical: true });

    if (!result.ok) {
        console.error('[balance-manager] Error fetching balance:', result.error);
        return null;
    }

    const newBalance = result.data.balance;
    updateCustomerBalanceGlobally(userId, newBalance, 0, 'db-refresh', { status, nonce });
    return newBalance;
}
