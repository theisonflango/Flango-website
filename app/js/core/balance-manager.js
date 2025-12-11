import { supabaseClient } from './config-and-supabase.js';
import { setCustomerBalance } from '../domain/cafe-session-store.js';

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
 * @returns {boolean} Success
 */
export function updateCustomerBalanceGlobally(userId, newBalance, delta = 0, source = 'unknown') {
    // 1. Update allUsers array (if exists)
    const allUsers = window.__flangoAllUsers || [];
    const user = allUsers.find(u => u.id === userId);
    if (user) {
        user.balance = newBalance;
        console.log(`[balance-manager] Updated ${user.name} balance = ${newBalance} kr (${source})`);
    } else {
        console.warn(`[balance-manager] WARNING: User not found! userId=${userId}, allUsers.length=${allUsers.length}`);
    }

    // 2. Update currentCustomer cache (if this user is selected)
    const currentCustomer = window.__flangoCurrentCustomer;
    if (currentCustomer && currentCustomer.id === userId) {
        setCustomerBalance(newBalance);
        console.log(`[balance-manager] Updated currentCustomer = ${newBalance} kr (${source})`);
    }

    // 3. Broadcast event
    broadcastBalanceChange({ userId, newBalance, delta, source });

    return true;
}

/**
 * Refresh customer balance from database
 * @param {string} userId - Customer ID
 * @returns {Promise<number|null>} New balance or null on error
 */
export async function refreshCustomerBalanceFromDB(userId) {
    const { data, error } = await supabaseClient
        .from('customers')
        .select('balance')
        .eq('id', userId)
        .single();

    if (error) {
        console.error('[balance-manager] Error fetching balance:', error);
        return null;
    }

    const newBalance = data.balance;
    updateCustomerBalanceGlobally(userId, newBalance, 0, 'db-refresh');
    return newBalance;
}
