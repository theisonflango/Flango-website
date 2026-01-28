// js/core/data-refetch.js
// Unified data refetch functions for ensuring UI stays in sync with database
// Part of "Refetch After Write" pattern for failsafe data consistency

import { supabaseClient } from './config-and-supabase.js';
import { runWithAuthRetry } from './auth-retry.js';
import { safeDbCall } from './safe-db-call.js';
import { getCurrentCustomer, setCustomerBalance } from '../domain/cafe-session-store.js';

// Race condition protection: Track in-flight requests
let usersRefetchToken = 0;
let productsRefetchToken = 0;

/**
 * Refetch all users for current institution from database
 * Updates window.__flangoAllUsers cache
 * Race-safe: Newer requests invalidate older ones
 * @returns {Promise<Array|null>} Array of users or null on error
 */
export async function refetchAllUsers() {
    // Race protection: Increment token, capture for this request
    const myToken = ++usersRefetchToken;
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

    // Race protection: Check if a newer request was started while we were fetching
    if (myToken !== usersRefetchToken) {
        console.log('[data-refetch] Users refetch superseded by newer request, discarding');
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

const REFRESH_BALANCES_THROTTLE_MS = 2 * 60 * 1000; // 2 min
let lastRefreshBalancesAt = 0;

/**
 * Refresh only id+balance for all users in current institution (lightweight fallback for realtime).
 * Throttled: max 1 call per REFRESH_BALANCES_THROTTLE_MS.
 * @returns {Promise<boolean>} true if ran, false if skipped (throttle) or error
 */
export async function refreshBalances() {
    const now = Date.now();
    if (now - lastRefreshBalancesAt < REFRESH_BALANCES_THROTTLE_MS) {
        console.log('[data-refetch] refreshBalances throttled');
        return false;
    }
    lastRefreshBalancesAt = now;
    const adminProfile = window.__flangoCurrentAdminProfile;
    const institutionId = adminProfile?.institution_id;
    if (!institutionId) {
        console.warn('[data-refetch] refreshBalances: No institution ID');
        return false;
    }
    const result = await safeDbCall(
        'refreshBalances',
        () => runWithAuthRetry('refreshBalances', () => supabaseClient
            .from('users')
            .select('id, balance')
            .eq('institution_id', institutionId)),
        { retry: 1, critical: false }
    );
    if (!result.ok) {
        console.warn('[data-refetch] refreshBalances error:', result.error);
        return false;
    }
    const rows = result.data || [];
    const setAllUsers = window.__flangoSetAllUsers;
    if (typeof setAllUsers !== 'function') return true;
    const allUsers = window.__flangoAllUsers;
    if (!Array.isArray(allUsers)) return true;
    let changed = false;
    const next = allUsers.map((u) => {
        const row = rows.find((r) => r.id === u.id);
        if (!row || row.balance === u.balance) return u;
        changed = true;
        return { ...u, balance: row.balance };
    });
    if (changed) {
        setAllUsers(next);
        console.log('[data-refetch] refreshBalances merged', rows.length, 'rows');
    }
    return true;
}

const REFRESH_PRODUCTS_THROTTLE_MS = 2 * 60 * 1000; // 2 min
let lastRefreshProductsAt = 0;

/**
 * Refresh products + daily assortment (throttled fallback for realtime).
 * Max 1 call per REFRESH_PRODUCTS_THROTTLE_MS.
 * @returns {Promise<Array|null>}
 */
export async function refreshProductsAndAssortment() {
    const now = Date.now();
    if (now - lastRefreshProductsAt < REFRESH_PRODUCTS_THROTTLE_MS) {
        console.log('[data-refetch] refreshProductsAndAssortment throttled');
        return null;
    }
    lastRefreshProductsAt = now;
    return refetchAllProducts();
}

/**
 * Merge one product into in-memory cache (realtime INSERT/UPDATE).
 * Does not refetch; triggers UI re-render via window.__flangoRenderProductsFromCache.
 * @param {Object} product - Full product row
 */
export function mergeProductIntoCache(product) {
    if (!product || product.id == null) return;
    const getter = window.__flangoGetAllProducts;
    const setter = window.__flangoSetAllProducts;
    if (typeof getter !== 'function' || typeof setter !== 'function') return;
    const list = getter() || [];
    const id = String(product.id);
    const idx = list.findIndex((p) => String(p?.id) === id);
    const next = idx >= 0
        ? list.map((p, i) => (i === idx ? { ...p, ...product } : p))
        : [...list, { ...product }];
    setter(next);
    console.log('[data-refetch] mergeProductIntoCache', id, idx >= 0 ? 'UPDATE' : 'INSERT');
    if (typeof window.__flangoRenderProductsFromCache === 'function') {
        window.__flangoRenderProductsFromCache().catch((err) => console.warn('[data-refetch] render after merge:', err));
    }
}

/**
 * Remove one product from in-memory cache (realtime DELETE).
 * @param {string} productId
 */
export function removeProductFromCache(productId) {
    if (!productId) return;
    const getter = window.__flangoGetAllProducts;
    const setter = window.__flangoSetAllProducts;
    if (typeof getter !== 'function' || typeof setter !== 'function') return;
    const list = getter() || [];
    const id = String(productId);
    const next = list.filter((p) => String(p?.id) !== id);
    if (next.length === list.length) return;
    setter(next);
    console.log('[data-refetch] removeProductFromCache', id);
    if (typeof window.__flangoRenderProductsFromCache === 'function') {
        window.__flangoRenderProductsFromCache().catch((err) => console.warn('[data-refetch] render after remove:', err));
    }
}

/**
 * Refetch all products for current institution from database
 * Updates allProducts cache via window.__flangoSetAllProducts
 * Race-safe: Newer requests invalidate older ones
 * @returns {Promise<Array|null>} Array of products or null on error
 */
export async function refetchAllProducts() {
    // Race protection: Increment token, capture for this request
    const myToken = ++productsRefetchToken;
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

    // Race protection: Check if a newer request was started while we were fetching
    if (myToken !== productsRefetchToken) {
        console.log('[data-refetch] Products refetch superseded by newer request, discarding');
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
