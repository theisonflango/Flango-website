// Data fetcher for Summary/Opsummering feature
import { supabaseClient } from '../core/config-and-supabase.js';
import {
    setSummaryData,
    setSummaryLoading,
    setSummaryError,
    getSummaryState
} from './summary-store.js';

/**
 * Fetch summary data based on current state
 * @param {string} institutionId - Institution UUID
 * @returns {Promise<void>}
 */
export async function fetchSummaryData(institutionId) {
    const state = getSummaryState();
    const { viewMode, dateRange, includeTestUsers, employeeRole } = state;

    if (!institutionId) {
        console.error('[summary-data] No institution ID provided');
        setSummaryError('Ingen institution ID');
        return;
    }

    if (!dateRange.from || !dateRange.to) {
        console.error('[summary-data] Invalid date range');
        setSummaryError('Ugyldig dato-interval');
        return;
    }

    setSummaryLoading(true);
    setSummaryError(null);

    try {
        let rpcFunction;
        switch (viewMode) {
            case 'day':
                rpcFunction = 'get_daily_summary';
                break;
            case 'week':
                rpcFunction = 'get_weekly_summary';
                break;
            case 'month':
                rpcFunction = 'get_monthly_summary';
                break;
            case 'year':
                // Year view uses monthly data and aggregates client-side
                rpcFunction = 'get_monthly_summary';
                break;
            case 'employee':
                rpcFunction = 'get_employee_summary';
                break;
            default:
                throw new Error(`Unknown view mode: ${viewMode}`);
        }

        console.log(`[summary-data] Fetching ${viewMode} data from ${dateRange.from} to ${dateRange.to} (includeTestUsers: ${includeTestUsers}${viewMode === 'employee' ? `, employeeRole: ${employeeRole}` : ''})`);

        const rpcParams = {
            p_institution_id: institutionId,
            p_from_date: dateRange.from,
            p_to_date: dateRange.to,
            p_include_test_users: includeTestUsers
        };

        // Add employee role parameter for employee view
        if (viewMode === 'employee') {
            rpcParams.p_employee_role = employeeRole;
        }

        const { data, error } = await supabaseClient.rpc(rpcFunction, rpcParams);

        if (error) throw error;

        // For year view, post-process monthly data into years
        if (viewMode === 'year') {
            const yearData = aggregateMonthsToYears(data);
            setSummaryData(yearData);
        } else {
            setSummaryData(data);
        }

        console.log(`[summary-data] Fetched ${data?.length || 0} ${viewMode} records`);

    } catch (error) {
        console.error('[summary-data] Error fetching summary:', error);
        setSummaryError(error.message || 'Fejl ved hentning af data');
        setSummaryData(null);
    } finally {
        setSummaryLoading(false);
    }
}

/**
 * Aggregate monthly data into yearly summaries
 * @param {Array} monthlyData - Data from get_monthly_summary
 * @returns {Array} Yearly aggregated data
 */
function aggregateMonthsToYears(monthlyData) {
    if (!monthlyData || monthlyData.length === 0) return [];

    const yearMap = new Map();

    monthlyData.forEach(month => {
        const year = month.year;

        if (!yearMap.has(year)) {
            yearMap.set(year, {
                year,
                revenue: 0,
                item_count: 0,
                sale_count: 0,
                top_product: null,
                clerks: new Map() // Use Map to dedupe clerks
            });
        }

        const yearData = yearMap.get(year);
        yearData.revenue += parseFloat(month.revenue) || 0;
        yearData.item_count += month.item_count || 0;
        yearData.sale_count += month.sale_count || 0;

        // Merge clerks (deduplicate by ID)
        if (Array.isArray(month.clerks)) {
            month.clerks.forEach(clerk => {
                if (clerk && clerk.id) {
                    yearData.clerks.set(clerk.id, clerk);
                }
            });
        }
    });

    // Convert Map back to array and find top product per year
    // Note: Finding accurate top product per year would require separate query
    // For now, we use the top product from the first month of the year
    const yearArray = Array.from(yearMap.values()).map(yearData => {
        // Convert clerks Map to array
        const clerksArray = Array.from(yearData.clerks.values());

        // Find top product from months in this year (simplified - uses first month's top product)
        const firstMonth = monthlyData.find(m => m.year === yearData.year);

        return {
            year: yearData.year,
            revenue: yearData.revenue,
            item_count: yearData.item_count,
            sale_count: yearData.sale_count,
            top_product: firstMonth?.top_product || null,
            clerks: clerksArray
        };
    });

    // Sort by year descending
    return yearArray.sort((a, b) => b.year - a.year);
}

/**
 * Invalidate any cached summary data
 * Call this when sales data changes (new sale, refund, etc.)
 */
export function invalidateSummaryData() {
    setSummaryData(null);
    console.log('[summary-data] Summary data cache invalidated');
}
