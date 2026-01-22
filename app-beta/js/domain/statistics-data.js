/**
 * Statistics Data Module
 *
 * Handles data fetching and aggregation for the Statistics view.
 * Supports three modes:
 *   1. 'kunder' (Customers) - purchases and balance
 *   2. 'ekspedienter' (Clerks) - sales made as clerk
 *   3. 'personale' (Staff) - admin supervisor time and assisted sales
 *
 * ============================================================
 * PERFORMANCE NOTES (undgå N+1):
 * ============================================================
 * 
 * Database Structure:
 * - 'events' table has: admin_user_id, clerk_user_id, session_admin_id, 
 *   target_user_id, details (JSONB), event_type, created_at
 * - 'events_view' has denormalized names (clerk_name, admin_name, etc.)
 *   and computed 'items' array, but NOT the raw IDs for clerk
 * 
 * We use 'events' table directly for clerk/admin aggregation
 * and 'events_view' only for Kunder (where target_user_id is available)
 * 
 * Mode 1 (Kunder): 2 queries total
 *   - 1x users (with balance)
 *   - 1x events_view (SALE type) aggregated by target_user_id (customer)
 *
 * Mode 2 (Ekspedienter): 2 queries total
 *   - 1x users (with total_minutes_worked, total_sales_count)
 *   - 1x events (SALE type) aggregated by clerk_user_id/admin_user_id
 *
 * Mode 3 (Personale): 3-4 queries total
 *   - 1x users (admins only)
 *   - 1x events (SALE type) where clerk = admin (self sales)
 *   - 1x events (SALE type) where session_admin_id = admin (assisted sales)
 *   - 1x events for supervisor time intervals (LOGIN/LOGOUT/CAFE_UNLOCKED/CAFE_LOCKED)
 *
 * All filtering (børn/voksne toggles) and sorting is done CLIENT-SIDE
 * on the fetched data to minimize database roundtrips.
 * ============================================================
 */

import { supabaseClient } from '../core/config-and-supabase.js';
import { runWithAuthRetry } from '../core/auth-retry.js';

// ============================================================
// STATE
// ============================================================
let _institutionId = null;
let _currentMode = 'kunder'; // 'kunder' | 'ekspedienter' | 'personale'
let _currentPeriod = 'all'; // 'all' | '30' | '7'
let _showChildren = true; // Børn toggle (default ON)
let _showStaff = false; // Personale/Admins toggle (default OFF)
let _showAll = false; // Alle toggle (default OFF)
let _sortColumn = 'name'; // Current sort column
let _sortDirection = 'asc'; // 'asc' | 'desc'

// ============================================================
// DATA CACHE
// ============================================================
let _dataCache = {
    period: null,
    institutionId: null,
    kunderData: null,
    ekspedienterData: null,
    personaleData: null
};

// Level definitions (same as before)
const LEVELS = [
    { name: 'Nybegynder', hours: 0, sales: 0, stars: '' },
    { name: 'Øvet', hours: 6, sales: 100, stars: '⭐' },
    { name: 'Expert', hours: 12, sales: 200, stars: '⭐⭐' },
    { name: 'Pro', hours: 18, sales: 300, stars: '⭐⭐⭐' },
    { name: 'Legendarisk', hours: 30, sales: 500, stars: '👑' }
];

// ============================================================
// INITIALIZATION
// ============================================================
export function initStatistics(institutionId) {
    _institutionId = institutionId;
    console.log('[statistics-data] Initialized with institution:', institutionId);
}

// ============================================================
// STATE GETTERS/SETTERS
// ============================================================
export function getStatisticsMode() { return _currentMode; }
export function setStatisticsMode(mode) {
    if (['kunder', 'ekspedienter', 'personale'].includes(mode)) {
        _currentMode = mode;
    }
}

export function getPeriod() { return _currentPeriod; }
export function setPeriod(period) {
    if (['all', '30', '7'].includes(period)) {
        _currentPeriod = period;
    }
}

export function getShowChildren() { return _showChildren; }
export function setShowChildren(show) { _showChildren = !!show; }

export function getShowStaff() { return _showStaff; }
export function setShowStaff(show) { _showStaff = !!show; }

export function getShowAll() { return _showAll; }
export function setShowAll(show) { _showAll = !!show; }

export function getSortColumn() { return _sortColumn; }
export function getSortDirection() { return _sortDirection; }
export function setSort(column, direction) {
    _sortColumn = column;
    _sortDirection = direction === 'desc' ? 'desc' : 'asc';
}

// ============================================================
// CACHE MANAGEMENT
// ============================================================
export function invalidateStatisticsCache() {
    _dataCache = {
        period: null,
        institutionId: null,
        kunderData: null,
        ekspedienterData: null,
        personaleData: null
    };
    console.log('[statistics-data] Cache invalidated');
}

function isCacheValid(mode) {
    return _dataCache.period === _currentPeriod &&
           _dataCache.institutionId === _institutionId &&
           _dataCache[`${mode}Data`] !== null;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get date filter based on period
 */
function getDateFilter(period) {
    if (period === 'all') return null;

    const d = new Date();
    if (period === '7') {
        d.setDate(d.getDate() - 7);
    } else if (period === '30') {
        d.setDate(d.getDate() - 30);
    }
    return d.toISOString();
}

/**
 * Calculate user level based on hours worked and sales count
 */
export function calculateLevel(totalMinutes, totalSales) {
    const hours = Math.floor((totalMinutes || 0) / 60);
    const sales = totalSales || 0;

    let currentLevel = LEVELS[0];
    for (const level of LEVELS) {
        if (hours >= level.hours || sales >= level.sales) {
            currentLevel = level;
        }
    }
    return currentLevel;
}

/**
 * Format amount as Danish currency
 */
export function formatAmount(amount) {
    return `${(amount || 0).toFixed(2).replace('.', ',')} kr`;
}

/**
 * Format minutes as hours and minutes
 */
export function formatMinutes(minutes) {
    if (!minutes || minutes <= 0) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) {
        return `${hours}t ${mins}m`;
    }
    if (hours > 0) {
        return `${hours}t`;
    }
    return `${mins}m`;
}

/**
 * Sort rows by column and direction
 */
function sortRows(rows, column, direction) {
    const multiplier = direction === 'desc' ? -1 : 1;

    // Stars ranking for level sorting
    const starsRank = { '': 0, '⭐': 1, '⭐⭐': 2, '⭐⭐⭐': 3, '👑': 4 };

    return [...rows].sort((a, b) => {
        let valA = a[column];
        let valB = b[column];

        // Handle null/undefined
        if (valA == null) valA = column === 'name' ? '' : 0;
        if (valB == null) valB = column === 'name' ? '' : 0;

        // String comparison for name and role
        if (column === 'name' || column === 'role') {
            return multiplier * String(valA).toLowerCase().localeCompare(String(valB).toLowerCase(), 'da');
        }

        // Level sorting: use stars rank
        if (column === 'level') {
            const rankA = starsRank[a.stars] || 0;
            const rankB = starsRank[b.stars] || 0;
            return multiplier * (rankA - rankB);
        }

        // Numeric comparison for everything else
        return multiplier * (valA - valB);
    });
}

export function sortStatisticsRows(rows, column, direction) {
    return sortRows(rows || [], column, direction);
}

/**
 * Filter rows based on toggles
 */
function filterRows(rows) {
    // "All" shows everything
    if (_showAll) {
        return rows;
    }

    return rows.filter(row => {
        if (row.isChild && _showChildren) return true;
        if (!row.isChild && _showStaff) return true;
        return false;
    });
}

function setCache(mode, baseRows) {
    _dataCache.period = _currentPeriod;
    _dataCache.institutionId = _institutionId;
    _dataCache[`${mode}Data`] = { baseRows };
}

function finalizeResult(baseRows, columns, totalsBuilder, { filter = true } = {}) {
    let rows = baseRows || [];
    if (filter) {
        rows = filterRows(rows);
    }
    rows = sortRows(rows, _sortColumn, _sortDirection);
    const totals = totalsBuilder ? totalsBuilder(rows) : null;
    return { rows, columns, totals, error: null };
}

// ============================================================
// MODE 1: KUNDER (Customers)
// ============================================================

/**
 * Fetch data for Kunder mode
 * Shows: Navn, Saldo, Køb beløb, Antal varer købt
 */
export async function fetchKunderData() {
    if (!_institutionId) {
        return { rows: [], columns: [], totals: null, error: 'Ingen institution ID' };
    }

    try {
        const columns = [
            { key: 'name', label: 'Navn', sortable: true },
            { key: 'balance', label: 'Saldo', sortable: true },
            { key: 'purchaseAmount', label: 'Køb beløb', sortable: true },
            { key: 'purchaseCount', label: 'Antal varer', sortable: true }
        ];
        const buildTotals = (rows) => ({
            balance: rows.reduce((sum, r) => sum + r.balance, 0),
            purchaseAmount: rows.reduce((sum, r) => sum + r.purchaseAmount, 0),
            purchaseCount: rows.reduce((sum, r) => sum + r.purchaseCount, 0)
        });

        if (isCacheValid('kunder')) {
            return finalizeResult(_dataCache.kunderData.baseRows, columns, buildTotals, { filter: true });
        }

        const fromDate = getDateFilter(_currentPeriod);

        // Single aggregated query: fetch all users with their purchase data
        const { data: users, error: userError } = await runWithAuthRetry('fetchKunderStats', () => {
            let query = supabaseClient
                .from('users')
                .select('id, name, role, balance')
                .eq('institution_id', _institutionId)
                .not('is_test_user', 'eq', true);
            return query;
        });

        if (userError) throw userError;

        // Get user IDs
        const userIds = (users || []).map(u => u.id);

        // Fetch purchase aggregates using events_view
        // SALE events contain target_user_id (customer) and details/items with sale info
        let purchaseAggregates = {};
        if (userIds.length > 0) {
            const { data: saleEvents, error: salesError } = await runWithAuthRetry('fetchKunderPurchases', () => {
                let query = supabaseClient
                    .from('events_view')
                    .select('target_user_id, details, items')
                    .eq('institution_id', _institutionId)
                    .eq('event_type', 'SALE')
                    .in('target_user_id', userIds);

                if (fromDate) {
                    query = query.gte('created_at', fromDate);
                }
                return query;
            });

            if (salesError) throw salesError;

            // Aggregate by target_user_id (customer)
            (saleEvents || []).forEach(event => {
                const customerId = event.target_user_id;
                if (!customerId) return;
                if (!purchaseAggregates[customerId]) {
                    purchaseAggregates[customerId] = { amount: 0, itemCount: 0 };
                }

                // Get amount: prefer details.total_amount, fallback to calculating from items
                const details = event.details || {};
                const items = event.items || [];
                let saleAmount = 0;

                if (typeof details.total_amount === 'number') {
                    saleAmount = details.total_amount;
                } else if (items.length > 0) {
                    // Calculate from items: price_at_purchase * quantity
                    saleAmount = items.reduce((sum, item) => {
                        const price = parseFloat(item.price_at_purchase || item.price || 0);
                        const qty = parseInt(item.quantity || item.qty || 1, 10);
                        return sum + (price * qty);
                    }, 0);
                }
                purchaseAggregates[customerId].amount += saleAmount;

                // Get item count from items array
                const itemCount = items.reduce((sum, item) => sum + (item.quantity || item.qty || 1), 0);
                purchaseAggregates[customerId].itemCount += itemCount;
            });
        }

        // Build base rows (before filters/sort)
        const baseRows = (users || []).map(user => {
            const purchases = purchaseAggregates[user.id] || { amount: 0, itemCount: 0 };
            return {
                id: user.id,
                name: user.name || 'Ukendt',
                isChild: user.role === 'kunde',
                balance: parseFloat(user.balance) || 0,
                purchaseAmount: purchases.amount,
                purchaseCount: purchases.itemCount
            };
        });

        setCache('kunder', baseRows);
        return finalizeResult(baseRows, columns, buildTotals, { filter: true });

    } catch (err) {
        console.error('[statistics-data] Error fetching Kunder data:', err);
        return { rows: [], columns: [], totals: null, error: err.message };
    }
}

// ============================================================
// MODE 2: EKSPEDIENTER (Clerks)
// ============================================================

/**
 * Fetch data for Ekspedienter mode
 * Shows: Navn, Saldo, Salg beløb, Antal salg, Antal produkter solgt, Tid som ekspedient, Flango level
 * Extra when staff toggle ON: Rolle
 */
export async function fetchEkspedienterData() {
    if (!_institutionId) {
        return { rows: [], columns: [], totals: null, error: 'Ingen institution ID' };
    }

    try {
        const buildColumns = () => {
            const cols = [
                { key: 'name', label: 'Navn', sortable: true },
                { key: 'balance', label: 'Saldo', sortable: true },
                { key: 'salesAmount', label: 'Salg beløb', sortable: true },
                { key: 'salesCount', label: 'Antal salg', sortable: true },
                { key: 'itemsSold', label: 'Produkter solgt', sortable: true },
                { key: 'clerkTime', label: 'Tid som ekspedient', sortable: true },
                { key: 'level', label: 'Flango Level', sortable: true }
            ];

            if (_showStaff || _showAll) {
                cols.splice(1, 0, { key: 'role', label: 'Rolle', sortable: false });
            }
            return cols;
        };
        const buildTotals = (rows) => ({
            balance: rows.reduce((sum, r) => sum + r.balance, 0),
            salesAmount: rows.reduce((sum, r) => sum + r.salesAmount, 0),
            salesCount: rows.reduce((sum, r) => sum + r.salesCount, 0),
            itemsSold: rows.reduce((sum, r) => sum + r.itemsSold, 0),
            clerkTime: rows.reduce((sum, r) => sum + r.clerkTime, 0)
        });

        if (isCacheValid('ekspedienter')) {
            return finalizeResult(_dataCache.ekspedienterData.baseRows, buildColumns(), buildTotals, { filter: true });
        }

        const fromDate = getDateFilter(_currentPeriod);

        // Fetch users with clerk stats
        const { data: users, error: userError } = await runWithAuthRetry('fetchEkspedienterStats', () => {
            let query = supabaseClient
                .from('users')
                .select('id, name, role, balance, total_minutes_worked, total_sales_count')
                .eq('institution_id', _institutionId)
                .not('is_test_user', 'eq', true);
            return query;
        });

        if (userError) throw userError;

        const userIds = (users || []).map(u => u.id);

        // Fetch sales made BY users as clerks
        // Use 'events' table - clerk_user_id is the clerk who made the sale
        // Note: We use COALESCE logic - if clerk_user_id is null, admin_user_id is the clerk
        let clerkSalesAggregates = {};
        if (userIds.length > 0) {
            const { data: saleEvents, error: salesError } = await runWithAuthRetry('fetchClerkSalesFromEvents', () => {
                let query = supabaseClient
                    .from('events')
                    .select('clerk_user_id, admin_user_id, details')
                    .eq('institution_id', _institutionId)
                    .eq('event_type', 'SALE');

                if (fromDate) {
                    query = query.gte('created_at', fromDate);
                }
                return query;
            });

            if (salesError) throw salesError;

            // Aggregate by clerk (clerk_user_id, fallback to admin_user_id)
            (saleEvents || []).forEach(event => {
                // The actual clerk is clerk_user_id, or admin_user_id if no clerk
                const clerkId = event.clerk_user_id || event.admin_user_id;
                if (!clerkId) return;
                // Only count if this clerk is in our user list
                if (!userIds.includes(clerkId)) return;

                if (!clerkSalesAggregates[clerkId]) {
                    clerkSalesAggregates[clerkId] = { salesCount: 0, amount: 0, itemCount: 0 };
                }
                clerkSalesAggregates[clerkId].salesCount += 1;

                // Get amount from details - use total_amount (correct field)
                const details = event.details || {};
                const saleAmount = parseFloat(details.total_amount || details.amount || 0);
                clerkSalesAggregates[clerkId].amount += saleAmount;

                // Item count: details may have sale_id, we'd need to query sale_items
                // For now, estimate from amount or set to salesCount as placeholder
                // TODO: If accurate item count is needed, join with sale_items
                clerkSalesAggregates[clerkId].itemCount += 1; // 1 sale = at least 1 item
            });
        }

        // Build base rows (before filters/sort)
        let baseRows = (users || []).map(user => {
            const sales = clerkSalesAggregates[user.id] || { salesCount: 0, amount: 0, itemCount: 0 };
            const level = calculateLevel(user.total_minutes_worked, user.total_sales_count);
            
            return {
                id: user.id,
                name: user.name || 'Ukendt',
                isChild: user.role === 'kunde',
                role: user.role === 'admin' ? 'Voksen' : 'Barn',
                balance: parseFloat(user.balance) || 0,
                salesAmount: sales.amount,
                salesCount: sales.salesCount,
                itemsSold: sales.itemCount,
                clerkTime: user.total_minutes_worked || 0,
                level: level.name,
                stars: level.stars
            };
        });

        // Filter out users with 0 clerk time (never worked as clerk)
        baseRows = baseRows.filter(r => r.clerkTime > 0);

        setCache('ekspedienter', baseRows);
        return finalizeResult(baseRows, buildColumns(), buildTotals, { filter: true });

    } catch (err) {
        console.error('[statistics-data] Error fetching Ekspedienter data:', err);
        return { rows: [], columns: [], totals: null, error: err.message };
    }
}

// ============================================================
// MODE 3: PERSONALE (Staff)
// ============================================================

/**
 * Fetch data for Personale mode
 * Shows admin-only data:
 *   - Navn
 *   - Tid som ekspedient
 *   - Tid som voksen ansvarlig
 *   - Tid i caféen i alt
 *   - Selv salg beløb (sales by admin themselves)
 *   - Assisteret salg beløb (child clerk sales while admin was supervisor)
 *   - Salg i alt beløb
 *
 * ============================================================
 * BEREGNINGSLOGIK (dokumenteret som krævet):
 * ============================================================
 * 
 * 1. "Tid som ekspedient" = users.total_minutes_worked
 *    - Akkumuleres via increment_user_stats() når ekspedient logger ud
 *
 * 2. "Tid som voksen ansvarlig" beregnes fra events:
 *    - Søger efter LOGIN/LOGOUT og CAFE_UNLOCKED/CAFE_LOCKED events
 *    - Beregner tid mellem start (LOGIN/CAFE_UNLOCKED) og slut (LOGOUT/CAFE_LOCKED)
 *    - FALLBACK: Hvis ingen events findes, bruges total_minutes_worked som approximation
 *    - NOTE v1: Dette er en pragmatisk tilnærmelse. Ideel løsning ville kræve 
 *      eksplicit supervisor-session tracking i databasen.
 *
 * 3. "Assisteret salg beløb" beregnes fra sales tabellen:
 *    - Finder alle salg hvor session_admin_id = admin's id
 *    - EKSKLUDERER salg hvor clerk_id = admin's id (det er selv-salg, ikke assisteret)
 *    - Summerer total_amount for de resterende (børne-ekspedienters salg)
 *    - NOTE: session_admin_id sættes i purchase-flow.js når et salg gennemføres
 *
 * 4. "Salg i alt" = Selv salg + Assisteret salg
 * ============================================================
 */
export async function fetchPersonaleData() {
    if (!_institutionId) {
        return { rows: [], columns: [], totals: null, error: 'Ingen institution ID' };
    }

    try {
        const columns = [
            { key: 'name', label: 'Navn', sortable: true },
            { key: 'clerkTime', label: 'Tid som ekspedient', sortable: true },
            { key: 'supervisorTime', label: 'Tid som voksen ansvarlig', sortable: true },
            { key: 'totalTime', label: 'Tid i caféen', sortable: true },
            { key: 'selfSalesAmount', label: 'Selv salg', sortable: true },
            { key: 'assistedSalesAmount', label: 'Assisteret salg', sortable: true },
            { key: 'totalSalesAmount', label: 'Salg i alt', sortable: true }
        ];
        const buildTotals = (rows) => ({
            clerkTime: rows.reduce((sum, r) => sum + r.clerkTime, 0),
            supervisorTime: rows.reduce((sum, r) => sum + r.supervisorTime, 0),
            totalTime: rows.reduce((sum, r) => sum + r.totalTime, 0),
            selfSalesAmount: rows.reduce((sum, r) => sum + r.selfSalesAmount, 0),
            assistedSalesAmount: rows.reduce((sum, r) => sum + r.assistedSalesAmount, 0),
            totalSalesAmount: rows.reduce((sum, r) => sum + r.totalSalesAmount, 0)
        });

        if (isCacheValid('personale')) {
            return finalizeResult(_dataCache.personaleData.baseRows, columns, buildTotals, { filter: false });
        }

        const fromDate = getDateFilter(_currentPeriod);

        // Fetch admin users only
        const { data: admins, error: adminError } = await runWithAuthRetry('fetchPersonaleUsers', () => {
            let query = supabaseClient
                .from('users')
                .select('id, name, total_minutes_worked')
                .eq('institution_id', _institutionId)
                .eq('role', 'admin')
                .not('is_test_user', 'eq', true);
            return query;
        });

        if (adminError) throw adminError;

        const adminIds = (admins || []).map(u => u.id);

        // Fetch self sales (sales where admin was clerk)
        // Use 'events' table - clerk_user_id or admin_user_id is the clerk
        let selfSalesAggregates = {};
        if (adminIds.length > 0) {
            const { data: selfSaleEvents, error: selfSalesError } = await runWithAuthRetry('fetchAdminSelfSales', () => {
                let query = supabaseClient
                    .from('events')
                    .select('clerk_user_id, admin_user_id, details')
                    .eq('institution_id', _institutionId)
                    .eq('event_type', 'SALE');

                if (fromDate) {
                    query = query.gte('created_at', fromDate);
                }
                return query;
            });

            if (selfSalesError) throw selfSalesError;

            (selfSaleEvents || []).forEach(event => {
                // The actual clerk is clerk_user_id, or admin_user_id if no clerk
                const clerkId = event.clerk_user_id || event.admin_user_id;
                if (!clerkId) return;
                // Only count if this clerk is one of our admins
                if (!adminIds.includes(clerkId)) return;

                if (!selfSalesAggregates[clerkId]) {
                    selfSalesAggregates[clerkId] = 0;
                }
                const details = event.details || {};
                selfSalesAggregates[clerkId] += parseFloat(details.total_amount || details.amount || 0);
            });
        }

        // Fetch assisted sales (child sales where session_admin_id = admin)
        // This represents sales made by children while the admin was supervising
        // Use 'events' table - session_admin_id is the supervisor
        let assistedSalesAggregates = {};
        if (adminIds.length > 0) {
            // Query events where session_admin_id matches one of our admins
            const { data: assistedSaleEvents, error: assistedError } = await runWithAuthRetry('fetchAssistedSales', () => {
                let query = supabaseClient
                    .from('events')
                    .select('clerk_user_id, admin_user_id, session_admin_id, details')
                    .eq('institution_id', _institutionId)
                    .eq('event_type', 'SALE')
                    .in('session_admin_id', adminIds);

                if (fromDate) {
                    query = query.gte('created_at', fromDate);
                }
                return query;
            });

            if (assistedError) {
                console.warn('[statistics-data] Could not fetch assisted sales:', assistedError);
            } else {
                // Filter: only count if clerk is NOT the session_admin (that's self-sale)
                (assistedSaleEvents || []).forEach(event => {
                    // The actual clerk is clerk_user_id, or admin_user_id if no clerk
                    const clerkId = event.clerk_user_id || event.admin_user_id;
                    const sessionAdminId = event.session_admin_id;
                    
                    // Skip if admin was the clerk (that's self-sale, not assisted)
                    if (!sessionAdminId) return;
                    if (clerkId === sessionAdminId) return;
                    
                    if (!assistedSalesAggregates[sessionAdminId]) {
                        assistedSalesAggregates[sessionAdminId] = 0;
                    }
                    const details = event.details || {};
                    assistedSalesAggregates[sessionAdminId] += parseFloat(details.total_amount || details.amount || 0);
                });
            }
        }

        // Try to get supervisor time intervals
        // Look for cafe unlock/lock events or use total_minutes_worked as fallback
        let supervisorTimeMap = {};
        if (adminIds.length > 0) {
            // First try to find cafe_unlocked / cafe_locked events
            // Use 'events' table - admin_user_id is the user who performed the action
            const { data: cafeEvents, error: cafeEventsError } = await runWithAuthRetry('fetchCafeEvents', () => {
                let query = supabaseClient
                    .from('events')
                    .select('admin_user_id, event_type, created_at')
                    .eq('institution_id', _institutionId)
                    .in('admin_user_id', adminIds)
                    .in('event_type', ['CAFE_UNLOCKED', 'CAFE_LOCKED', 'LOGIN', 'LOGOUT']);

                if (fromDate) {
                    query = query.gte('created_at', fromDate);
                }
                return query.order('created_at', { ascending: true });
            });

            if (!cafeEventsError && cafeEvents && cafeEvents.length > 0) {
                // Calculate supervisor intervals
                // Simplified: count time between LOGIN and LOGOUT or CAFE_UNLOCKED and CAFE_LOCKED
                const sessionsByAdmin = {};
                
                (cafeEvents || []).forEach(evt => {
                    const adminId = evt.admin_user_id;
                    if (!sessionsByAdmin[adminId]) {
                        sessionsByAdmin[adminId] = { startTime: null, totalMinutes: 0 };
                    }
                    
                    const evtTime = new Date(evt.created_at);
                    
                    if (evt.event_type === 'LOGIN' || evt.event_type === 'CAFE_UNLOCKED') {
                        sessionsByAdmin[adminId].startTime = evtTime;
                    } else if ((evt.event_type === 'LOGOUT' || evt.event_type === 'CAFE_LOCKED') && sessionsByAdmin[adminId].startTime) {
                        const duration = (evtTime - sessionsByAdmin[adminId].startTime) / 60000; // minutes
                        sessionsByAdmin[adminId].totalMinutes += duration;
                        sessionsByAdmin[adminId].startTime = null;
                    }
                });
                
                Object.entries(sessionsByAdmin).forEach(([adminId, data]) => {
                    supervisorTimeMap[adminId] = Math.round(data.totalMinutes);
                });
            }
        }

        // Build base rows (before sort)
        const baseRows = (admins || []).map(admin => {
            const selfSales = selfSalesAggregates[admin.id] || 0;
            const assistedSales = assistedSalesAggregates[admin.id] || 0;
            const clerkTime = admin.total_minutes_worked || 0;
            
            // Supervisor time: use calculated or fallback to clerk time
            // NOTE: This is a v1 approximation. Ideally we'd have explicit supervisor session tracking.
            const supervisorTime = supervisorTimeMap[admin.id] || clerkTime;
            
            // Total cafe time = max of clerk time and supervisor time (they overlap)
            const totalTime = Math.max(clerkTime, supervisorTime);
            
            return {
                id: admin.id,
                name: admin.name || 'Ukendt',
                isChild: false,
                clerkTime: clerkTime,
                supervisorTime: supervisorTime,
                totalTime: totalTime,
                selfSalesAmount: selfSales,
                assistedSalesAmount: assistedSales,
                totalSalesAmount: selfSales + assistedSales
            };
        });

        setCache('personale', baseRows);
        return finalizeResult(baseRows, columns, buildTotals, { filter: false });

    } catch (err) {
        console.error('[statistics-data] Error fetching Personale data:', err);
        return { rows: [], columns: [], totals: null, error: err.message };
    }
}
