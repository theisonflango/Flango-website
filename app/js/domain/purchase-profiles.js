/**
 * Purchase Profiles (Købsprofiler) - Domain Module
 * 
 * IMPLEMENTATION NOTES:
 * - Navigation: Added "Købsprofiler" button in summary modal view selector (index.html)
 * - ANTAL metric: Uses `quantity` field from sale_items (total units bought, not number of transactions)
 *   This is more meaningful as it shows how many of each product the user has actually consumed.
 * - "Dagens ret" detection: Uses product.is_daily_special boolean field (already exists in products table)
 *   All products with is_daily_special=true are grouped into a single "Dagens ret" bar.
 * - "Andre varer" computation: After grouping "Dagens ret" and selecting top 10, remaining products
 *   (excluding daily specials already counted in "Dagens ret") are aggregated into "Andre varer".
 */

import { supabaseClient } from '../core/config-and-supabase.js';
import { runWithAuthRetry } from '../core/auth-retry.js';

// ============================================================
// STATE
// ============================================================
let _institutionId = null;
let _selectedUserId = null;
let _period = 'all'; // 'all' | '30' | '7'
let _sortBy = 'antal'; // 'antal' | 'kr'
let _cachedProducts = null; // Cache products to detect "dagens ret"

// ============================================================
// INITIALIZATION
// ============================================================
export function initPurchaseProfiles(institutionId) {
    _institutionId = institutionId;
    console.log('[purchase-profiles] Initialized with institution:', institutionId);
}

// ============================================================
// STATE GETTERS/SETTERS
// ============================================================
export function getSelectedUserId() {
    return _selectedUserId;
}

export function setSelectedUserId(userId) {
    _selectedUserId = userId;
}

export function getPeriod() {
    return _period;
}

export function setPeriod(period) {
    if (['all', '30', '7'].includes(period)) {
        _period = period;
    }
}

export function getSortBy() {
    return _sortBy;
}

export function setSortBy(sortBy) {
    if (['antal', 'kr'].includes(sortBy)) {
        _sortBy = sortBy;
    }
}

// ============================================================
// DAGENS RET HELPER
// ============================================================
/**
 * Determines if a product is "Dagens ret" (daily special).
 * 
 * Detection strategy:
 * 1. PRIMARY: Check is_daily_special boolean field on product
 * 2. FALLBACK: Not implemented - relies on is_daily_special field
 * 
 * This helper can easily be extended if detection rules change.
 * 
 * @param {object} product - Product object with is_daily_special field
 * @returns {boolean} - True if product is a daily special
 */
export function isDagensRet(product) {
    if (!product) return false;
    // Primary detection: use the is_daily_special boolean field
    return product.is_daily_special === true;
}

/**
 * Creates a lookup map of product_id -> is_daily_special status
 * @param {Array} products - Array of product objects
 * @returns {Map<string, boolean>}
 */
function buildDagensRetLookup(products) {
    const lookup = new Map();
    if (!Array.isArray(products)) return lookup;
    
    products.forEach(product => {
        if (product && product.id) {
            lookup.set(product.id, isDagensRet(product));
        }
    });
    return lookup;
}

// ============================================================
// DATA FETCHING
// ============================================================

/**
 * Fetch all products for the institution (used for is_daily_special lookup)
 */
async function fetchProducts() {
    if (_cachedProducts) return _cachedProducts;
    
    const buildQuery = () => {
        let query = supabaseClient
            .from('products')
            .select('id, name, is_daily_special, icon_url, emoji');
        
        if (_institutionId) {
            query = query.eq('institution_id', _institutionId);
        }
        return query;
    };
    
    const { data, error } = await runWithAuthRetry('fetchProductsForProfiles', buildQuery);
    
    if (error) {
        console.error('[purchase-profiles] Error fetching products:', error);
        return [];
    }
    
    _cachedProducts = data || [];
    return _cachedProducts;
}

/**
 * Invalidate products cache (call when products change)
 */
export function invalidateProductsCache() {
    _cachedProducts = null;
}

/**
 * Fetch purchase data for a specific user within a date range.
 * Uses a single aggregated query for performance.
 * 
 * @param {string} userId - User ID
 * @param {string} period - 'all' | '30' | '7'
 * @returns {Promise<{total: number, items: Array}>}
 */
export async function fetchUserPurchaseData(userId, period = 'all') {
    if (!userId || !_institutionId) {
        console.warn('[purchase-profiles] Missing userId or institutionId');
        return { total: 0, items: [], error: 'Missing required parameters' };
    }
    
    // Build date filter
    let fromDate = null;
    if (period === '7') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        fromDate = d.toISOString();
    } else if (period === '30') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        fromDate = d.toISOString();
    }
    
    const buildQuery = () => {
        // Query sales with sale_items joined
        // This gives us product_id, quantity, price_at_purchase per item
        let query = supabaseClient
            .from('sales')
            .select(`
                id,
                created_at,
                sale_items (
                    product_id,
                    quantity,
                    price_at_purchase,
                    product_name_at_purchase
                )
            `)
            .eq('customer_id', userId)
            .eq('institution_id', _institutionId)
            .order('created_at', { ascending: false });
        
        if (fromDate) {
            query = query.gte('created_at', fromDate);
        }
        
        return query;
    };
    
    const { data: salesData, error } = await runWithAuthRetry('fetchUserPurchases', buildQuery);
    
    if (error) {
        console.error('[purchase-profiles] Error fetching purchases:', error);
        return { total: 0, items: [], error: error.message };
    }
    
    // Fetch products to get is_daily_special status
    const products = await fetchProducts();
    const dagensRetLookup = buildDagensRetLookup(products);
    const productInfoMap = new Map(products.map(p => [p.id, p]));
    
    // Aggregate items by product
    // Key: product_id (or 'DAGENS_RET' for daily specials)
    const aggregated = new Map();
    let totalSpend = 0;
    
    // Special key for aggregated daily specials
    const DAGENS_RET_KEY = '__DAGENS_RET__';
    
    (salesData || []).forEach(sale => {
        (sale.sale_items || []).forEach(item => {
            const productId = item.product_id;
            const quantity = item.quantity || 1;
            const price = item.price_at_purchase || 0;
            const itemTotal = quantity * price;
            
            totalSpend += itemTotal;
            
            // Determine aggregation key
            const isDailySpecial = dagensRetLookup.get(productId) || false;
            const aggKey = isDailySpecial ? DAGENS_RET_KEY : productId;
            
            if (!aggregated.has(aggKey)) {
                if (isDailySpecial) {
                    aggregated.set(aggKey, {
                        productId: DAGENS_RET_KEY,
                        name: 'Dagens ret',
                        antal: 0,
                        kr: 0,
                        isDagensRet: true,
                        icon: null, // Will use neutral icon
                        subProducts: new Map() // Track individual daily specials
                    });
                } else {
                    const productInfo = productInfoMap.get(productId);
                    aggregated.set(aggKey, {
                        productId,
                        name: item.product_name_at_purchase || productInfo?.name || 'Ukendt produkt',
                        antal: 0,
                        kr: 0,
                        isDagensRet: false,
                        icon: productInfo?.icon_url || productInfo?.emoji || null
                    });
                }
            }
            
            const agg = aggregated.get(aggKey);
            agg.antal += quantity;
            agg.kr += itemTotal;
            
            // For daily specials, also track sub-products for potential tooltip
            if (isDailySpecial && agg.subProducts) {
                const subKey = productId;
                if (!agg.subProducts.has(subKey)) {
                    const productInfo = productInfoMap.get(productId);
                    agg.subProducts.set(subKey, {
                        productId,
                        name: item.product_name_at_purchase || productInfo?.name || 'Ukendt produkt',
                        antal: 0,
                        kr: 0
                    });
                }
                const sub = agg.subProducts.get(subKey);
                sub.antal += quantity;
                sub.kr += itemTotal;
            }
        });
    });
    
    // Convert map to array
    const items = Array.from(aggregated.values()).map(item => ({
        ...item,
        subProducts: item.subProducts ? Array.from(item.subProducts.values()) : undefined
    }));
    
    return {
        total: totalSpend,
        items,
        error: null
    };
}

/**
 * Get top 10 products + "Andre varer" aggregation based on current sort mode.
 * 
 * @param {Array} items - Aggregated purchase items
 * @param {string} sortBy - 'antal' | 'kr'
 * @returns {{top10: Array, andreVarer: object|null}}
 */
export function computeTop10AndAndreVarer(items, sortBy = 'antal') {
    if (!Array.isArray(items) || items.length === 0) {
        return { top10: [], andreVarer: null };
    }
    
    // Sort by selected metric descending
    const sorted = [...items].sort((a, b) => {
        const valA = sortBy === 'kr' ? a.kr : a.antal;
        const valB = sortBy === 'kr' ? b.kr : b.antal;
        return valB - valA;
    });
    
    // Take top 10
    const top10 = sorted.slice(0, 10);
    
    // Aggregate the rest into "Andre varer" (excluding items already in top 10)
    const rest = sorted.slice(10);
    
    if (rest.length === 0) {
        return { top10, andreVarer: null };
    }
    
    // "Andre varer" should NOT include "Dagens ret" products
    // (they belong to the "Dagens ret" bar which may or may not be in top 10)
    // Actually, by this point "Dagens ret" is already aggregated as a single item
    // So we just sum up whatever is in "rest"
    const andreVarer = {
        productId: '__ANDRE_VARER__',
        name: 'Andre varer',
        antal: 0,
        kr: 0,
        isAndreVarer: true,
        icon: null,
        subProducts: rest.map(item => ({
            productId: item.productId,
            name: item.name,
            antal: item.antal,
            kr: item.kr
        }))
    };
    
    rest.forEach(item => {
        andreVarer.antal += item.antal;
        andreVarer.kr += item.kr;
    });
    
    return { top10, andreVarer };
}

/**
 * Get chart data for rendering.
 * Combines top 10 + "Andre varer" into a single array.
 * 
 * @param {string} userId 
 * @param {string} period 
 * @param {string} sortBy 
 * @returns {Promise<{total: number, chartData: Array, error: string|null}>}
 */
export async function getChartData(userId, period = 'all', sortBy = 'antal') {
    const { total, items, error } = await fetchUserPurchaseData(userId, period);
    
    if (error) {
        return { total: 0, chartData: [], error };
    }
    
    if (items.length === 0) {
        return { total: 0, chartData: [], error: null };
    }
    
    const { top10, andreVarer } = computeTop10AndAndreVarer(items, sortBy);
    
    // Combine into chart data
    const chartData = [...top10];
    if (andreVarer) {
        chartData.push(andreVarer);
    }
    
    // Calculate max value for height normalization
    const maxValue = Math.max(...chartData.map(d => sortBy === 'kr' ? d.kr : d.antal));
    
    // Add normalized height (0-100%)
    chartData.forEach(d => {
        const value = sortBy === 'kr' ? d.kr : d.antal;
        d.normalizedHeight = maxValue > 0 ? (value / maxValue) * 100 : 0;
        d.displayValue = sortBy === 'kr' ? `${d.kr.toFixed(2)} kr` : d.antal;
    });
    
    return { total, chartData, error: null };
}

// ============================================================
// UTILITY EXPORTS
// ============================================================
export function formatKr(amount) {
    return `${amount.toFixed(2).replace('.', ',')} kr`;
}
