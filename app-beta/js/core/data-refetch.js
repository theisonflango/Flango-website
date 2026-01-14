// js/core/data-refetch.js
// Unified data refetch functions for ensuring UI stays in sync with database
// Part of "Refetch After Write" pattern for failsafe data consistency

import { supabaseClient } from './config-and-supabase.js';
import { runWithAuthRetry } from './auth-retry.js';
import { safeDbCall } from './safe-db-call.js';
import { getCurrentCustomer, setCustomerBalance } from '../domain/cafe-session-store.js';

/**
 * Refetch all users for current institution from database
 * Updates window.__flangoAllUsers cache
 * @returns {Promise<Array|null>} Array of users or null on error
 */
export async function refetchAllUsers() {
    const adminProfile = window.__flangoCurrentAdminProfile;
    const institutionId = adminProfile?.institution_id;

    if (!institutionId) {
        console.warn('[data-refetch] refetchAllUsers: No institution ID available');
        return null;
    }

    console.log('[data-refetch] Refetching all users for institution:', institutionId);

    const result = await safeDbCall(
        'refetchAllUsers',
        () => runWithAuthRetry('refetchAllUsers', () => supabaseClient
            .from('users')
            .select('*, last_parent_login_at, parent_pin_is_custom')
            .eq('institution_id', institutionId)
            .order('name')),
        { retry: 1, critical: true }
    );

    if (!result.ok) {
        console.error('[data-refetch] Error loading users:', result.error);
        return null;
    }
    const data = result.data;

    // Update global cache via setter if available
    if (typeof window.__flangoSetAllUsers === 'function') {
        window.__flangoSetAllUsers(data);
        console.log('[data-refetch] Users refreshed via setter:', data.length, 'users');
    } else {
        // Fallback: update window global directly
        window.__flangoAllUsers = data;
        console.log('[data-refetch] Users refreshed (direct):', data.length, 'users');
    }

    return data;
}

/**
 * Refetch all products for current institution from database
 * Updates allProducts cache via window.__flangoSetAllProducts
 * @returns {Promise<Array|null>} Array of products or null on error
 */
export async function refetchAllProducts() {
    const adminProfile = window.__flangoCurrentAdminProfile;
    const institutionId = adminProfile?.institution_id;

    if (!institutionId) {
        console.warn('[data-refetch] refetchAllProducts: No institution ID available');
        return null;
    }

    console.log('[data-refetch] Refetching all products for institution:', institutionId);

    const result = await safeDbCall(
        'refetchAllProducts',
        () => runWithAuthRetry('refetchAllProducts', () => supabaseClient
            .from('products')
            .select('*')
            .eq('institution_id', institutionId)
            .order('sort_order')),
        { retry: 1, critical: true }
    );

    if (!result.ok) {
        console.error('[data-refetch] Error loading products:', result.error);
        return null;
    }
    const data = result.data;

    // Update cache via setter if available
    if (typeof window.__flangoSetAllProducts === 'function') {
        window.__flangoSetAllProducts(data);
        console.log('[data-refetch] Products refreshed via setter:', data.length, 'products');
    } else {
        console.warn('[data-refetch] window.__flangoSetAllProducts not available');
    }

    return data;
}

/**
 * Refetch single user's balance from database
 * Updates the user in window.__flangoAllUsers cache
 * @param {string} userId - UUID of the user
 * @returns {Promise<number|null>} New balance or null on error
 */
export async function refetchUserBalance(userId) {
    if (!userId) {
        console.warn('[data-refetch] refetchUserBalance: No userId provided');
        return null;
    }

    console.log('[data-refetch] Refetching balance for user:', userId);

    const result = await safeDbCall(
        'refetchUserBalance',
        () => runWithAuthRetry('refetchUserBalance', () => supabaseClient
            .from('users')
            .select('balance')
            .eq('id', userId)
            .single()),
        { retry: 1, critical: true }
    );

    if (!result.ok) {
        console.error('[data-refetch] Error loading balance:', result.error);
        return null;
    }

    const newBalance = result.data.balance;

    // Update in window.__flangoAllUsers
    const users = window.__flangoAllUsers;
    if (Array.isArray(users)) {
        const user = users.find(u => u.id === userId);
        if (user) {
            user.balance = newBalance;
            // Trigger setter to ensure UI updates
            if (typeof window.__flangoSetAllUsers === 'function') {
                window.__flangoSetAllUsers([...users]);
            }
            console.log('[data-refetch] Balance updated in cache:', { userId, newBalance });
        }
    }

    // Also update currentCustomer if it's the same user - use canonical source
    const currentCustomer = getCurrentCustomer();
    if (currentCustomer && currentCustomer.id === userId) {
        setCustomerBalance(newBalance);
        console.log('[data-refetch] Balance updated for current customer:', newBalance);
    }

    return newBalance;
}

/**
 * Refetch single product from database
 * Updates the product in the products cache
 * @param {string} productId - UUID of the product
 * @returns {Promise<Object|null>} Updated product or null on error
 */
export async function refetchSingleProduct(productId) {
    if (!productId) {
        console.warn('[data-refetch] refetchSingleProduct: No productId provided');
        return null;
    }

    console.log('[data-refetch] Refetching product:', productId);

    const result = await safeDbCall(
        'refetchSingleProduct',
        () => runWithAuthRetry('refetchSingleProduct', () => supabaseClient
            .from('products')
            .select('*')
            .eq('id', productId)
            .single()),
        { retry: 1 }
    );

    if (!result.ok) {
        console.error('[data-refetch] Error loading product:', result.error);
        return null;
    }

    console.log('[data-refetch] Product refreshed:', result.data.name);
    return result.data;
}

// Debug helper: Log current cache state
export function logCacheState() {
    const users = window.__flangoAllUsers;
    const products = typeof window.__flangoGetAllProducts === 'function'
        ? window.__flangoGetAllProducts()
        : [];

    console.log('[data-refetch] Cache state:', {
        usersCount: Array.isArray(users) ? users.length : 0,
        productsCount: products.length,
        hasSetAllUsers: typeof window.__flangoSetAllUsers === 'function',
        hasSetAllProducts: typeof window.__flangoSetAllProducts === 'function',
    });
}
