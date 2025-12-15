// State management for Opsummering (Summary) feature

let currentSummaryState = {
    viewMode: 'day', // 'day' | 'week' | 'month' | 'year' | 'employee'
    employeeRole: 'admin', // 'admin' | 'kunde' - for employee view only
    dateRange: {
        from: null, // Will be set to default on init
        to: null    // Will be set to default on init
    },
    includeTestUsers: false, // Whether to include test users in summary
    data: null,
    loading: false,
    error: null
};

/**
 * Get current summary state
 */
export function getSummaryState() {
    return currentSummaryState;
}

/**
 * Set summary view mode
 * @param {'day'|'week'|'month'|'year'|'employee'} mode
 */
export function setSummaryViewMode(mode) {
    const validModes = ['day', 'week', 'month', 'year', 'employee'];
    if (!validModes.includes(mode)) {
        console.warn(`[summary-store] Invalid view mode: ${mode}, defaulting to 'day'`);
        currentSummaryState.viewMode = 'day';
        return;
    }
    currentSummaryState.viewMode = mode;
}

/**
 * Set employee role filter (for employee view)
 * @param {'admin'|'kunde'} role
 */
export function setEmployeeRole(role) {
    const validRoles = ['admin', 'kunde'];
    if (!validRoles.includes(role)) {
        console.warn(`[summary-store] Invalid employee role: ${role}, defaulting to 'admin'`);
        currentSummaryState.employeeRole = 'admin';
        return;
    }
    currentSummaryState.employeeRole = role;
}

/**
 * Set summary date range
 * @param {string} from - ISO date string (YYYY-MM-DD)
 * @param {string} to - ISO date string (YYYY-MM-DD)
 */
export function setSummaryDateRange(from, to) {
    currentSummaryState.dateRange = { from, to };
}

/**
 * Set whether to include test users
 * @param {boolean} include
 */
export function setIncludeTestUsers(include) {
    currentSummaryState.includeTestUsers = !!include;
}

/**
 * Set summary data
 * @param {Array|null} data
 */
export function setSummaryData(data) {
    currentSummaryState.data = data;
}

/**
 * Set loading state
 * @param {boolean} loading
 */
export function setSummaryLoading(loading) {
    currentSummaryState.loading = loading;
}

/**
 * Set error state
 * @param {string|null} error
 */
export function setSummaryError(error) {
    currentSummaryState.error = error;
}

/**
 * Get default date range (last 30 days)
 * @returns {{from: string, to: string}}
 */
export function getDefaultDateRange() {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);

    return {
        from: from.toISOString().split('T')[0],
        to: to.toISOString().split('T')[0]
    };
}

/**
 * Initialize summary state with defaults
 */
export function initSummaryState() {
    const defaultRange = getDefaultDateRange();
    setSummaryDateRange(defaultRange.from, defaultRange.to);
    setSummaryViewMode('day');
    setSummaryData(null);
    setSummaryLoading(false);
    setSummaryError(null);
}

/**
 * Reset summary state to defaults
 */
export function resetSummaryState() {
    initSummaryState();
}
