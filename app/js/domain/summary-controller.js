// Controller for Summary/Opsummering feature
import { fetchSummaryData, invalidateSummaryData } from './summary-data.js';
import { renderSummaryTable } from '../ui/summary-ui.js';
import {
    setSummaryViewMode,
    setSummaryDateRange,
    getDefaultDateRange,
    getSummaryState,
    initSummaryState,
    setIncludeTestUsers,
    setOnlyTestUsers,
    setEmployeeRole
} from './summary-store.js';
import { setupPurchaseProfilesUI, openPurchaseProfilesView, closePurchaseProfilesView } from '../ui/purchase-profiles-ui.js';
import { initStatisticsUI, renderStatisticsView, refreshStatistics } from '../ui/statistics-ui.js';
import { setSelectedUserId } from './purchase-profiles.js';

let institutionId = null;
let getAllUsersAccessor = null;

/**
 * Setup summary modal and event listeners
 * @param {string} currentInstitutionId - Current institution UUID
 * @param {object} options - Optional configuration
 * @param {function} options.getAllUsers - Function to get all users (for purchase profiles)
 */
export function setupSummaryModal(currentInstitutionId, options = {}) {
    institutionId = currentInstitutionId;
    
    // Store getAllUsers accessor for purchase profiles
    if (options.getAllUsers) {
        getAllUsersAccessor = options.getAllUsers;
        // Initialize purchase profiles UI
        setupPurchaseProfilesUI({
            getAllUsers: getAllUsersAccessor,
            institutionId: currentInstitutionId
        });
    }

    // Initialize Statistics UI (admin-only)
    initStatisticsUI('statistics-view-container', currentInstitutionId, (userId) => {
        // Callback when clicking a customer row to open their purchase profile
        setSelectedUserId(userId);

        // Switch to purchase profiles view
        document.querySelectorAll('.summary-view-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.view === 'purchase-profiles') {
                btn.classList.add('active');
            }
        });

        // Open purchase profiles view
        openPurchaseProfilesView();

        // Hide statistics container
        const statisticsContainer = document.getElementById('statistics-view-container');
        if (statisticsContainer) statisticsContainer.style.display = 'none';
    });

    const viewButtons = document.querySelectorAll('.summary-view-btn');
    const roleButtons = document.querySelectorAll('.summary-role-btn');
    const periodButtons = document.querySelectorAll('.segment-btn[data-period]');
    const roleSelector = document.getElementById('employee-role-selector');
    const periodSegmentControl = document.getElementById('period-segment-control');
    const applyFilterBtn = document.getElementById('summary-apply-filter');
    const resetFilterBtn = document.getElementById('summary-reset-filter');
    const fromDateInput = document.getElementById('summary-from-date');
    const toDateInput = document.getElementById('summary-to-date');
    const tableContainer = document.getElementById('summary-table-container');
    const testUsersCheckbox = document.getElementById('summary-show-test-users-checkbox');

    // Track current period for the unified period view
    let currentPeriod = 'day';

    // Period segment switcher (Dag/Uge/Måned/År)
    periodButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            // Update active state
            periodButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update current period and view mode
            currentPeriod = btn.dataset.period;
            setSummaryViewMode(currentPeriod);

            // Fetch and render
            await fetchSummaryData(institutionId);
            renderSummaryTable(tableContainer);
        });
    });

    // View mode switcher
    viewButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            // Update active state
            viewButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update state and fetch
            let viewMode = btn.dataset.view;

            // If "period" view is selected, use the current period (day/week/month/year)
            if (viewMode === 'period') {
                viewMode = currentPeriod;
            }
            setSummaryViewMode(viewMode);

            // Show/hide role selector based on view mode
            if (roleSelector) {
                roleSelector.style.display = viewMode === 'employee' ? 'flex' : 'none';
            }

            // Show/hide period segment control
            if (periodSegmentControl) {
                periodSegmentControl.style.display = btn.dataset.view === 'period' ? 'flex' : 'none';
            }

            // Switch between overview, transactions, purchase-profiles, statistics and summary table views
            const overviewContainer = document.getElementById('overview-view-container');
            const transactionsContainer = document.getElementById('transactions-view-container');
            const summaryTableContainer = document.getElementById('summary-table-view-container');
            const purchaseProfilesContainer = document.getElementById('purchase-profiles-view-container');
            const statisticsContainer = document.getElementById('statistics-view-container');
            const sharedControls = document.getElementById('shared-history-controls');

            // Skjul alle containers først
            if (overviewContainer) overviewContainer.style.display = 'none';
            if (transactionsContainer) transactionsContainer.style.display = 'none';
            if (summaryTableContainer) summaryTableContainer.style.display = 'none';
            if (purchaseProfilesContainer) purchaseProfilesContainer.style.display = 'none';
            if (statisticsContainer) statisticsContainer.style.display = 'none';

            // Vis/skjul delte kontroller baseret på view mode
            if (sharedControls) {
                sharedControls.style.display = (viewMode === 'overview' || viewMode === 'transactions') ? 'block' : 'none';
            }

            if (viewMode === 'overview') {
                // Vis oversigt-view (kun opsummering og diagram)
                if (overviewContainer) overviewContainer.style.display = 'block';

                // Load overview data
                if (typeof window.__flangoLoadOverviewInSummary === 'function') {
                    window.__flangoLoadOverviewInSummary();
                }
            } else if (viewMode === 'transactions') {
                // Vis transaktioner-view (kun posteringsliste)
                if (transactionsContainer) transactionsContainer.style.display = 'block';

                // Load transaction history
                if (typeof window.__flangoLoadTransactionsInSummary === 'function') {
                    window.__flangoLoadTransactionsInSummary();
                }
            } else if (viewMode === 'purchase-profiles') {
                // Vis købsprofiler-view
                openPurchaseProfilesView();
            } else if (viewMode === 'statistics') {
                // Vis statistik-view (admin-only)
                if (statisticsContainer) {
                    statisticsContainer.style.display = 'flex';
                    statisticsContainer.style.flex = '1';
                    statisticsContainer.style.minHeight = '0';
                    statisticsContainer.style.flexDirection = 'column';
                    statisticsContainer.style.overflow = 'hidden';
                }
                await renderStatisticsView();
            } else {
                // Vis summary table (dag, uge, måned, år, personale)
                if (summaryTableContainer) summaryTableContainer.style.display = 'block';

                // Load summary data
                await fetchSummaryData(institutionId);
                renderSummaryTable(tableContainer);
            }
        });
    });

    // Employee role switcher
    roleButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            // Update active state
            roleButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update state and fetch
            const role = btn.dataset.role;
            setEmployeeRole(role);
            await fetchSummaryData(institutionId);
            renderSummaryTable(tableContainer);
        });
    });

    // Apply filter
    applyFilterBtn.addEventListener('click', async () => {
        const from = fromDateInput.value;
        const to = toDateInput.value;

        if (!from || !to) {
            alert('Vælg venligst både fra- og til-dato');
            return;
        }

        if (new Date(from) > new Date(to)) {
            alert('Fra-dato skal være før til-dato');
            return;
        }

        setSummaryDateRange(from, to);
        await fetchSummaryData(institutionId);
        renderSummaryTable(tableContainer);
    });

    // Reset filter
    resetFilterBtn.addEventListener('click', async () => {
        const defaultRange = getDefaultDateRange();
        fromDateInput.value = defaultRange.from;
        toDateInput.value = defaultRange.to;
        setSummaryDateRange(defaultRange.from, defaultRange.to);
        await fetchSummaryData(institutionId);
        renderSummaryTable(tableContainer);
    });

    // Test users toggle
    const onlyTestUsersBtn = document.getElementById('summary-only-test-users-btn');

    if (testUsersCheckbox) {
        testUsersCheckbox.addEventListener('change', async () => {
            // If "include test users" is checked, remove "only" mode
            if (onlyTestUsersBtn) {
                onlyTestUsersBtn.classList.remove('active');
                onlyTestUsersBtn.textContent = 'Vis KUN testbrugere';
            }
            setOnlyTestUsers(false);
            setIncludeTestUsers(testUsersCheckbox.checked);
            await fetchSummaryData(institutionId);
            renderSummaryTable(tableContainer);
        });
    }

    if (onlyTestUsersBtn) {
        onlyTestUsersBtn.addEventListener('click', async () => {
            const isActive = onlyTestUsersBtn.classList.toggle('active');
            onlyTestUsersBtn.textContent = isActive ? '✓ Kun testbrugere' : 'Vis KUN testbrugere';
            // If "only test users" is active, uncheck the include checkbox
            if (isActive && testUsersCheckbox) {
                testUsersCheckbox.checked = false;
            }
            setIncludeTestUsers(isActive); // Need to include them first before filtering
            setOnlyTestUsers(isActive);
            await fetchSummaryData(institutionId);
            renderSummaryTable(tableContainer);
        });
    }

    console.log('[summary-controller] Setup complete');
}

/**
 * Open summary modal
 * @param {string} currentInstitutionId - Current institution UUID
 * @param {string} initialView - Initial view to show ('transactions', 'day', 'week', etc.) - defaults to 'transactions'
 */
export async function openSummaryModal(currentInstitutionId, initialView = 'overview') {
    institutionId = currentInstitutionId;

    if (!institutionId) {
        console.error('[summary-controller] No institution ID provided');
        alert('Kunne ikke finde institution ID');
        return;
    }

    const modal = document.getElementById('summary-modal');
    const fromDateInput = document.getElementById('summary-from-date');
    const toDateInput = document.getElementById('summary-to-date');
    const tableContainer = document.getElementById('summary-table-container');
    const testUsersCheckbox = document.getElementById('summary-show-test-users-checkbox');
    const transactionsContainer = document.getElementById('transactions-view-container');
    const summaryTableContainer = document.getElementById('summary-table-view-container');

    if (!modal) {
        console.error('[summary-controller] Summary modal not found in DOM');
        return;
    }

    // Initialize state
    initSummaryState();

    // Set default date range in inputs
    const defaultRange = getDefaultDateRange();
    fromDateInput.value = defaultRange.from;
    toDateInput.value = defaultRange.to;
    setSummaryDateRange(defaultRange.from, defaultRange.to);

    // Set initial checkbox/button states (unchecked/inactive by default)
    const onlyTestUsersBtn = document.getElementById('summary-only-test-users-btn');
    if (testUsersCheckbox) {
        testUsersCheckbox.checked = false;
        setIncludeTestUsers(false);
    }
    if (onlyTestUsersBtn) {
        onlyTestUsersBtn.classList.remove('active');
        onlyTestUsersBtn.textContent = 'Vis KUN testbrugere';
        setOnlyTestUsers(false);
    }

    // Determine if initialView is a period view (day/week/month/year)
    const periodViews = ['day', 'week', 'month', 'year'];
    const isPeriodView = periodViews.includes(initialView);
    const effectiveView = isPeriodView ? 'period' : initialView;
    const effectiveViewMode = isPeriodView ? initialView : initialView;

    // Set default view mode button as active
    document.querySelectorAll('.summary-view-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === effectiveView) {
            btn.classList.add('active');
        }
    });

    // Set active segment button if period view
    const periodSegmentControl = document.getElementById('period-segment-control');
    if (periodSegmentControl) {
        periodSegmentControl.style.display = isPeriodView ? 'flex' : 'none';
        if (isPeriodView) {
            document.querySelectorAll('.segment-btn[data-period]').forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.period === initialView) {
                    btn.classList.add('active');
                }
            });
        }
    }

    // Show modal
    modal.style.display = 'block';

    // Hent alle view containers
    const overviewContainer = document.getElementById('overview-view-container');
    const purchaseProfilesContainer = document.getElementById('purchase-profiles-view-container');
    const statisticsContainer = document.getElementById('statistics-view-container');
    const sharedControls = document.getElementById('shared-history-controls');
    const roleSelector = document.getElementById('employee-role-selector');

    // Skjul alle containers først
    if (overviewContainer) overviewContainer.style.display = 'none';
    if (transactionsContainer) transactionsContainer.style.display = 'none';
    if (summaryTableContainer) summaryTableContainer.style.display = 'none';
    if (purchaseProfilesContainer) purchaseProfilesContainer.style.display = 'none';
    if (statisticsContainer) statisticsContainer.style.display = 'none';

    // Vis/skjul delte kontroller baseret på initial view
    if (sharedControls) {
        sharedControls.style.display = (initialView === 'overview' || initialView === 'transactions') ? 'block' : 'none';
    }

    // Vis/skjul role selector
    if (roleSelector) {
        roleSelector.style.display = initialView === 'employee' ? 'flex' : 'none';
    }

    // Show correct view container based on initialView
    if (initialView === 'overview') {
        // Vis oversigt-view (kun opsummering og diagram)
        if (overviewContainer) overviewContainer.style.display = 'block';

        // Load overview data
        if (typeof window.__flangoLoadOverviewInSummary === 'function') {
            window.__flangoLoadOverviewInSummary();
        }
    } else if (initialView === 'transactions') {
        // Vis transaktioner-view (kun posteringsliste)
        if (transactionsContainer) transactionsContainer.style.display = 'block';

        // Load transaction history
        if (typeof window.__flangoLoadTransactionsInSummary === 'function') {
            window.__flangoLoadTransactionsInSummary();
        }
    } else if (initialView === 'purchase-profiles') {
        // Vis købsprofiler-view
        openPurchaseProfilesView();
    } else if (initialView === 'statistics') {
        // Vis statistik-view (admin-only)
        if (statisticsContainer) statisticsContainer.style.display = 'block';
        await renderStatisticsView();
    } else {
        // Vis summary table view (dag, uge, måned, år, personale)
        if (summaryTableContainer) summaryTableContainer.style.display = 'block';

        // Set view mode in state
        setSummaryViewMode(effectiveViewMode);

        // Fetch initial data
        await fetchSummaryData(institutionId);
        renderSummaryTable(tableContainer);
    }

    console.log(`[summary-controller] Modal opened with ${initialView} view`);
}

/**
 * Close summary modal
 */
export function closeSummaryModal() {
    const modal = document.getElementById('summary-modal');
    if (modal) {
        modal.style.display = 'none';
    }

    // Close purchase profiles view if open
    closePurchaseProfilesView();

    // Reset shared history controls for next opening
    if (typeof window.__flangoResetSharedHistoryControls === 'function') {
        window.__flangoResetSharedHistoryControls();
    }
}

/**
 * Refresh summary data (call when sales data changes)
 */
export async function refreshSummaryData() {
    if (!institutionId) {
        console.warn('[summary-controller] Cannot refresh - no institution ID');
        return;
    }

    invalidateSummaryData();
    const tableContainer = document.getElementById('summary-table-container');

    if (tableContainer && tableContainer.offsetParent !== null) {
        // Modal is visible, refresh data
        await fetchSummaryData(institutionId);
        renderSummaryTable(tableContainer);
        console.log('[summary-controller] Summary data refreshed');
    }

    // Also refresh statistics if visible
    const statisticsContainer = document.getElementById('statistics-view-container');
    if (statisticsContainer && statisticsContainer.offsetParent !== null) {
        refreshStatistics();
        console.log('[summary-controller] Statistics data refreshed');
    }
}

/**
 * Export summary data to CSV
 */
export function exportToCSV() {
    const state = getSummaryState();
    const { data, viewMode } = state;

    if (!data || data.length === 0) {
        alert('Ingen data at eksportere');
        return;
    }

    let csv = '';
    const filename = `flango-opsummering-${viewMode}-${new Date().toISOString().split('T')[0]}.csv`;

    // Generate CSV based on view mode
    switch (viewMode) {
        case 'day':
            csv = 'Dato,Voksen ansvarlig,Børne-ekspedienter,Dagens ret,Omsætning\n';
            data.forEach(day => {
                const childClerks = (day.clerks || [])
                    .filter(c => c.role !== 'admin')
                    .map(c => c.name)
                    .join('; ');
                csv += `${day.sale_date},"${day.adult_supervisor || 'Ingen'}","${childClerks}","${day.top_product?.name || 'Ingen'}",${day.revenue}\n`;
            });
            break;

        case 'week':
            csv = 'Uge,År,Start,Slut,Voksne,Bestseller,Omsætning\n';
            data.forEach(week => {
                const adults = (week.clerks || [])
                    .filter(c => c.role === 'admin')
                    .map(c => c.name)
                    .join('; ');
                csv += `${week.week_number},${week.year},${week.week_start},${week.week_end},"${adults}","${week.top_product?.name || 'Ingen'}",${week.revenue}\n`;
            });
            break;

        case 'month':
            csv = 'Måned,År,Personale,Bestseller,Omsætning\n';
            data.forEach(month => {
                const staff = (month.clerks || []).map(c => c.name).join('; ');
                csv += `${month.month_name?.trim()},${month.year},"${staff}","${month.top_product?.name || 'Ingen'}",${month.revenue}\n`;
            });
            break;

        case 'year':
            csv = 'År,Personale,Bestseller,Omsætning\n';
            data.forEach(year => {
                const staff = (year.clerks || []).map(c => c.name).join('; ');
                csv += `${year.year},"${staff}","${year.top_product?.name || 'Ingen'}",${year.revenue}\n`;
            });
            break;

        case 'employee':
            csv = 'Navn,Rolle,Produkter,Antal salg,Omsætning\n';
            data.forEach(emp => {
                const products = (emp.products_sold || [])
                    .map(p => `${p.name}(${p.count})`)
                    .join('; ');
                csv += `"${emp.clerk_name}",${emp.clerk_role},"${products}",${emp.total_sales},${emp.total_revenue}\n`;
            });
            break;
    }

    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();

    console.log(`[summary-controller] Exported ${data.length} rows to ${filename}`);
}
