// js/ui/db-history.js
// DB-Historik modal UI - Superadmin feature for tracking database usage

/**
 * Check if current user is authadmin (based on email)
 * @returns {boolean}
 */
export function isAuthAdminUser() {
    // Check admin profile first (from session-store or window)
    const admin = typeof window !== 'undefined' ? (window.__flangoCurrentAdminProfile || null) : null;
    if (admin?.email) {
        return admin.email.toLowerCase() === 'authadmin@flango.dk';
    }

    // Check clerk profile (if admin is logged in as clerk)
    const clerk = typeof window !== 'undefined' ? (window.__flangoCurrentClerkProfile || null) : null;
    if (clerk?.email) {
        return clerk.email.toLowerCase() === 'authadmin@flango.dk';
    }

    return false;
}

/**
 * Calculate percentage for progress bar
 * @param {number} used - Used amount
 * @param {number} limit - Limit amount
 * @returns {number} Percentage (0-100)
 */
function calculatePercentage(used, limit) {
    if (!limit || limit === 0) return 0;
    return Math.min(100, Math.max(0, (used / limit) * 100));
}

/**
 * Get progress bar class based on percentage
 * @param {number} percentage - Usage percentage
 * @returns {string} CSS class name
 */
function getProgressBarClass(percentage) {
    if (percentage < 50) return 'low';
    if (percentage < 80) return 'medium';
    return 'high';
}

/**
 * Format bytes to human readable format
 * @param {number} bytes - Bytes
 * @returns {string} Formatted string (e.g., "0.031 GB")
 */
function formatBytes(bytes) {
    if (bytes >= 1024 * 1024 * 1024) {
        return (bytes / (1024 * 1024 * 1024)).toFixed(3) + ' GB';
    }
    if (bytes >= 1024 * 1024) {
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }
    if (bytes >= 1024) {
        return (bytes / 1024).toFixed(2) + ' KB';
    }
    return bytes.toFixed(0) + ' B';
}

/**
 * Get current DB statistics from window.__flangoDbStats
 * @returns {Object} Statistics object
 */
function getDbStats() {
    if (typeof window === 'undefined' || !window.__flangoDbStats) {
        return {
            totalCalls: 0,
            byType: { from: 0, rpc: 0, functions: 0, auth: 0 },
            byTable: {},
            byRpc: {},
            byFunction: {},
        };
    }
    return window.__flangoDbStats;
}

/**
 * Calculate total Edge Function invocations
 * @param {Object} stats - DB stats object
 * @returns {number} Total invocations
 */
function getTotalEdgeFunctionInvocations(stats) {
    const byFunction = stats.byFunction || {};
    return Object.values(byFunction).reduce((sum, count) => sum + (count || 0), 0);
}

/**
 * Render DB-Historik modal
 */
export function renderDbHistoryModal() {
    const modal = document.getElementById('db-history-modal');
    if (!modal) return;

    const stats = getDbStats();
    const totalEdgeFunctions = getTotalEdgeFunctionInvocations(stats);
    const totalRpcCalls = stats.byType?.rpc || 0;
    const totalDbQueries = stats.byType?.from || 0;

    // Supabase Free Tier limits
    const FREE_TIER_LIMITS = {
        databaseSize: 0.5, // GB
        cachedEgress: 5, // GB
        egress: 5, // GB
        edgeFunctionInvocations: 500000,
    };

    // Current usage (placeholder for database size and egress, real for functions)
    const usage = {
        databaseSize: 0, // Cannot track precisely without Supabase API
        cachedEgress: 0, // Cannot track precisely without Supabase API
        egress: 0, // Cannot track precisely without Supabase API
        edgeFunctionInvocations: totalEdgeFunctions,
    };

    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>DB-Historik (Supabase Free Tier)</h2>
                <span class="close-btn" id="db-history-close-btn">&times;</span>
            </div>
            <div class="modal-body" style="overflow-y: auto; flex: 1;">
                <div class="db-history-metrics">
                    <!-- Database Size -->
                    <div class="db-history-metric">
                        <div class="db-history-metric-header">
                            <span>Database Size</span>
                        </div>
                        <div class="db-history-metric-values">
                            <span class="db-history-metric-used">${usage.databaseSize.toFixed(3)} GB</span>
                            <span class="db-history-metric-limit">/ ${FREE_TIER_LIMITS.databaseSize} GB</span>
                        </div>
                        <div class="db-history-progress-container">
                            <div class="db-history-progress-bar low" style="width: 0%"></div>
                        </div>
                        <div class="db-history-metric-note">
                            Præcis værdi kan ses i Supabase Dashboard
                        </div>
                    </div>

                    <!-- Cached Egress -->
                    <div class="db-history-metric">
                        <div class="db-history-metric-header">
                            <span>Cached Egress</span>
                        </div>
                        <div class="db-history-metric-values">
                            <span class="db-history-metric-used">${usage.cachedEgress.toFixed(3)} GB</span>
                            <span class="db-history-metric-limit">/ ${FREE_TIER_LIMITS.cachedEgress} GB</span>
                        </div>
                        <div class="db-history-progress-container">
                            <div class="db-history-progress-bar low" style="width: 0%"></div>
                        </div>
                        <div class="db-history-metric-note">
                            Præcis værdi kan ses i Supabase Dashboard
                        </div>
                    </div>

                    <!-- Egress -->
                    <div class="db-history-metric">
                        <div class="db-history-metric-header">
                            <span>Egress</span>
                        </div>
                        <div class="db-history-metric-values">
                            <span class="db-history-metric-used">${usage.egress.toFixed(3)} GB</span>
                            <span class="db-history-metric-limit">/ ${FREE_TIER_LIMITS.egress} GB</span>
                        </div>
                        <div class="db-history-progress-container">
                            <div class="db-history-progress-bar low" style="width: 0%"></div>
                        </div>
                        <div class="db-history-metric-note">
                            Præcis værdi kan ses i Supabase Dashboard
                        </div>
                    </div>

                    <!-- Edge Function Invocations -->
                    <div class="db-history-metric">
                        <div class="db-history-metric-header">
                            <span>Edge Function Invocations</span>
                        </div>
                        <div class="db-history-metric-values">
                            <span class="db-history-metric-used">${usage.edgeFunctionInvocations.toLocaleString()}</span>
                            <span class="db-history-metric-limit">/ ${FREE_TIER_LIMITS.edgeFunctionInvocations.toLocaleString()}</span>
                        </div>
                        <div class="db-history-progress-container">
                            <div class="db-history-progress-bar ${getProgressBarClass(calculatePercentage(usage.edgeFunctionInvocations, FREE_TIER_LIMITS.edgeFunctionInvocations))}" 
                                 style="width: ${calculatePercentage(usage.edgeFunctionInvocations, FREE_TIER_LIMITS.edgeFunctionInvocations)}%"></div>
                        </div>
                    </div>

                    <!-- RPC Calls (Additional Info) -->
                    <div class="db-history-metric">
                        <div class="db-history-metric-header">
                            <span>RPC Calls (Session)</span>
                        </div>
                        <div class="db-history-metric-values">
                            <span class="db-history-metric-used">${totalRpcCalls.toLocaleString()}</span>
                            <span class="db-history-metric-limit"></span>
                        </div>
                    </div>

                    <!-- Database Queries (Additional Info) -->
                    <div class="db-history-metric">
                        <div class="db-history-metric-header">
                            <span>Database Queries (Session)</span>
                        </div>
                        <div class="db-history-metric-values">
                            <span class="db-history-metric-used">${totalDbQueries.toLocaleString()}</span>
                            <span class="db-history-metric-limit"></span>
                        </div>
                    </div>
                </div>
            </div>
            <div class="db-history-actions">
                <button class="db-history-refresh-btn" id="db-history-refresh-btn">Opdater</button>
            </div>
        </div>
    `;

    // Close button
    const closeBtn = document.getElementById('db-history-close-btn');
    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };
    }

    // Refresh button
    const refreshBtn = document.getElementById('db-history-refresh-btn');
    if (refreshBtn) {
        refreshBtn.onclick = () => {
            renderDbHistoryModal(); // Re-render to update stats
        };
    }

    // Close on backdrop click
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
}

/**
 * Open DB-Historik modal
 */
export function openDbHistoryModal() {
    const modal = document.getElementById('db-history-modal');
    if (!modal) return;
    renderDbHistoryModal();
    modal.style.display = 'flex';
}
