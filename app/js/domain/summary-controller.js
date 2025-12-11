// Controller for Summary/Opsummering feature
import { fetchSummaryData, invalidateSummaryData } from './summary-data.js';
import { renderSummaryTable } from '../ui/summary-ui.js';
import {
    setSummaryViewMode,
    setSummaryDateRange,
    getDefaultDateRange,
    getSummaryState,
    initSummaryState
} from './summary-store.js';

let institutionId = null;

/**
 * Setup summary modal and event listeners
 * @param {string} currentInstitutionId - Current institution UUID
 */
export function setupSummaryModal(currentInstitutionId) {
    institutionId = currentInstitutionId;

    const viewButtons = document.querySelectorAll('.summary-view-btn');
    const applyFilterBtn = document.getElementById('summary-apply-filter');
    const resetFilterBtn = document.getElementById('summary-reset-filter');
    const fromDateInput = document.getElementById('summary-from-date');
    const toDateInput = document.getElementById('summary-to-date');
    const tableContainer = document.getElementById('summary-table-container');

    // View mode switcher
    viewButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            // Update active state
            viewButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update state and fetch
            const viewMode = btn.dataset.view;
            setSummaryViewMode(viewMode);
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

    console.log('[summary-controller] Setup complete');
}

/**
 * Open summary modal
 * @param {string} currentInstitutionId - Current institution UUID
 */
export async function openSummaryModal(currentInstitutionId) {
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

    // Set default view mode button as active
    document.querySelectorAll('.summary-view-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.view === 'day') {
            btn.classList.add('active');
        }
    });

    // Show modal
    modal.style.display = 'block';

    // Fetch initial data (day view, last 30 days)
    await fetchSummaryData(institutionId);
    renderSummaryTable(tableContainer);

    console.log('[summary-controller] Modal opened');
}

/**
 * Close summary modal
 */
export function closeSummaryModal() {
    const modal = document.getElementById('summary-modal');
    if (modal) {
        modal.style.display = 'none';
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
