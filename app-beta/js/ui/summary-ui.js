// UI rendering for Summary/Opsummering feature
import { getSummaryState } from '../domain/summary-store.js';

/**
 * Render summary table based on current state
 * @param {HTMLElement} tableContainer - Container for the table
 */
export function renderSummaryTable(tableContainer) {
    const state = getSummaryState();
    const { viewMode, data, loading, error } = state;

    if (!tableContainer) {
        console.error('[summary-ui] No table container provided');
        return;
    }

    // Clear container
    tableContainer.innerHTML = '';

    // Show loading state
    if (loading) {
        tableContainer.innerHTML = `
            <div style="padding: 40px; text-align: center;">
                <div class="spinner"></div>
                <p>Henter data...</p>
            </div>
        `;
        return;
    }

    // Show error state
    if (error) {
        tableContainer.innerHTML = `
            <div style="padding: 20px; color: #f44336; text-align: center;">
                <p><strong>Fejl:</strong> ${error}</p>
            </div>
        `;
        return;
    }

    // Show empty state
    if (!data || data.length === 0) {
        tableContainer.innerHTML = `
            <div style="padding: 40px; text-align: center; color: #666;">
                <p>Ingen data at vise for denne periode</p>
            </div>
        `;
        return;
    }

    // Render table based on view mode
    const table = document.createElement('table');
    table.className = 'summary-table';
    table.id = 'summary-table';

    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');
    const tfoot = document.createElement('tfoot');

    thead.id = 'summary-table-head';
    tbody.id = 'summary-table-body';
    tfoot.id = 'summary-table-foot';

    table.appendChild(thead);
    table.appendChild(tbody);
    table.appendChild(tfoot);

    tableContainer.appendChild(table);

    // Render specific view
    switch (viewMode) {
        case 'day':
            renderDayView(thead, tbody, tfoot, data);
            break;
        case 'week':
            renderWeekView(thead, tbody, tfoot, data);
            break;
        case 'month':
            renderMonthView(thead, tbody, tfoot, data);
            break;
        case 'year':
            renderYearView(thead, tbody, tfoot, data);
            break;
        case 'employee':
            renderEmployeeView(thead, tbody, tfoot, data);
            break;
        default:
            console.error(`[summary-ui] Unknown view mode: ${viewMode}`);
    }
}

/**
 * Render day view
 */
function renderDayView(thead, tbody, tfoot, data) {
    // Header
    thead.innerHTML = `
        <tr>
            <th>Dato</th>
            <th>Voksen ansvarlig</th>
            <th>Børne-ekspedienter</th>
            <th>🥇 Dagens ret</th>
            <th>💰 Omsætning</th>
        </tr>
    `;

    // Body
    let totalRevenue = 0;
    let lastWeek = null;

    const rows = data.map((day, index) => {
        totalRevenue += parseFloat(day.revenue) || 0;

        // Check if new week (for separator line)
        const date = new Date(day.sale_date + 'T00:00:00');
        const weekNumber = getWeekNumber(date);
        const isNewWeek = lastWeek !== null && weekNumber !== lastWeek;
        lastWeek = weekNumber;

        // Get child clerks (non-admin)
        const childClerks = (day.clerks || [])
            .filter(c => c.role !== 'admin')
            .map(c => c.name)
            .join(', ') || 'Ingen';

        const weekClass = isNewWeek ? 'week-separator' : '';

        const row = document.createElement('tr');
        row.className = `period-day ${weekClass}`;
        row.dataset.date = day.sale_date;

        row.innerHTML = `
            <td>${formatDate(date)}</td>
            <td>${day.adult_supervisor || 'Ingen'}</td>
            <td>${childClerks}</td>
            <td>${day.top_product?.name || 'Ingen'} ${day.top_product?.count ? `(${day.top_product.count})` : ''}</td>
            <td>${day.revenue.toFixed(2)} kr</td>
        `;

        return row;
    });

    rows.forEach(row => tbody.appendChild(row));

    // Footer (total)
    tfoot.innerHTML = `
        <tr>
            <td colspan="4" style="text-align: right; font-weight: bold;">Total:</td>
            <td style="font-weight: bold;">${totalRevenue.toFixed(2)} kr</td>
        </tr>
    `;
}

/**
 * Render week view
 */
function renderWeekView(thead, tbody, tfoot, data) {
    thead.innerHTML = `
        <tr>
            <th>Uge</th>
            <th>Periode</th>
            <th>Voksne ansvarlige</th>
            <th>🥇 Ugens bestseller</th>
            <th>💰 Omsætning</th>
        </tr>
    `;

    let totalRevenue = 0;

    const rows = data.map(week => {
        totalRevenue += parseFloat(week.revenue) || 0;

        const adults = (week.clerks || [])
            .filter(c => c.role === 'admin')
            .map(c => c.name)
            .join(', ') || 'Ingen';

        const row = document.createElement('tr');
        row.className = 'period-week';
        row.dataset.week = week.week_number;
        row.dataset.year = week.year;

        row.innerHTML = `
            <td>Uge ${week.week_number}, ${week.year}</td>
            <td>${formatDate(new Date(week.week_start))} - ${formatDate(new Date(week.week_end))}</td>
            <td>${adults}</td>
            <td>${week.top_product?.name || 'Ingen'} ${week.top_product?.count ? `(${week.top_product.count})` : ''}</td>
            <td>${week.revenue.toFixed(2)} kr</td>
        `;

        return row;
    });

    rows.forEach(row => tbody.appendChild(row));

    tfoot.innerHTML = `
        <tr>
            <td colspan="4" style="text-align: right; font-weight: bold;">Total:</td>
            <td style="font-weight: bold;">${totalRevenue.toFixed(2)} kr</td>
        </tr>
    `;
}

/**
 * Render month view
 */
function renderMonthView(thead, tbody, tfoot, data) {
    thead.innerHTML = `
        <tr>
            <th>Måned</th>
            <th>Cafépersonale</th>
            <th>🥇 Månedens bestseller</th>
            <th>💰 Omsætning</th>
        </tr>
    `;

    let totalRevenue = 0;

    const rows = data.map(month => {
        totalRevenue += parseFloat(month.revenue) || 0;

        // Get top 3 most active staff
        const topStaff = (month.clerks || [])
            .slice(0, 3)
            .map(c => c.name)
            .join(', ') || 'Ingen';

        const row = document.createElement('tr');
        row.className = 'period-month';
        row.dataset.month = month.month_number;
        row.dataset.year = month.year;

        row.innerHTML = `
            <td>${month.month_name?.trim() || 'Ukendt'} ${month.year}</td>
            <td>${topStaff}</td>
            <td>${month.top_product?.name || 'Ingen'} ${month.top_product?.count ? `(${month.top_product.count})` : ''}</td>
            <td>${month.revenue.toFixed(2)} kr</td>
        `;

        return row;
    });

    rows.forEach(row => tbody.appendChild(row));

    tfoot.innerHTML = `
        <tr>
            <td colspan="3" style="text-align: right; font-weight: bold;">Total:</td>
            <td style="font-weight: bold;">${totalRevenue.toFixed(2)} kr</td>
        </tr>
    `;
}

/**
 * Render year view
 */
function renderYearView(thead, tbody, tfoot, data) {
    thead.innerHTML = `
        <tr>
            <th>År</th>
            <th>Cafépersonale</th>
            <th>🥇 Årets bestseller</th>
            <th>💰 Omsætning</th>
        </tr>
    `;

    let totalRevenue = 0;

    const rows = data.map(year => {
        totalRevenue += parseFloat(year.revenue) || 0;

        const topStaff = (year.clerks || [])
            .slice(0, 5)
            .map(c => c.name)
            .join(', ') || 'Ingen';

        const row = document.createElement('tr');
        row.className = 'period-year';
        row.dataset.year = year.year;

        row.innerHTML = `
            <td>${year.year}</td>
            <td>${topStaff}</td>
            <td>${year.top_product?.name || 'Ingen'} ${year.top_product?.count ? `(${year.top_product.count})` : ''}</td>
            <td>${year.revenue.toFixed(2)} kr</td>
        `;

        return row;
    });

    rows.forEach(row => tbody.appendChild(row));

    tfoot.innerHTML = `
        <tr>
            <td colspan="3" style="text-align: right; font-weight: bold;">Total:</td>
            <td style="font-weight: bold;">${totalRevenue.toFixed(2)} kr</td>
        </tr>
    `;
}

/**
 * Render employee view
 */
function renderEmployeeView(thead, tbody, tfoot, data) {
    thead.innerHTML = `
        <tr>
            <th>#</th>
            <th>Navn</th>
            <th>Rolle</th>
            <th>Produkter solgt</th>
            <th>Antal salg</th>
            <th>💰 Total omsætning</th>
        </tr>
    `;

    let totalSales = 0;
    let totalRevenue = 0;

    const rows = data.map((employee, index) => {
        totalSales += employee.total_sales || 0;
        totalRevenue += parseFloat(employee.total_revenue) || 0;

        // Format products list (top 3)
        const productsList = (employee.products_sold || [])
            .slice(0, 3)
            .map(p => `${p.name || 'Ukendt'} (${p.count})`)
            .join(', ') || 'Ingen';

        const moreProducts = (employee.products_sold?.length || 0) > 3
            ? `... +${employee.products_sold.length - 3} flere`
            : '';

        const roleEmoji = employee.clerk_role === 'admin' ? '👨‍💼' : '👦';
        const roleLabel = employee.clerk_role === 'admin' ? 'Voksen' : 'Barn';

        const row = document.createElement('tr');
        row.dataset.clerkId = employee.clerk_id;

        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${employee.clerk_name}</td>
            <td>${roleEmoji} ${roleLabel}</td>
            <td>${productsList}${moreProducts}</td>
            <td>${employee.total_sales}</td>
            <td>${employee.total_revenue.toFixed(2)} kr</td>
        `;

        return row;
    });

    rows.forEach(row => tbody.appendChild(row));

    tfoot.innerHTML = `
        <tr>
            <td colspan="4" style="text-align: right; font-weight: bold;">Total:</td>
            <td style="font-weight: bold;">${totalSales}</td>
            <td style="font-weight: bold;">${totalRevenue.toFixed(2)} kr</td>
        </tr>
    `;
}

// Helper functions

/**
 * Format date to Danish format with day name
 * @param {Date} date
 * @returns {string} e.g., "Søn 11/12/2025"
 */
function formatDate(date) {
    const days = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];
    const day = days[date.getDay()];
    const dateStr = date.toLocaleDateString('da-DK', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    return `${day} ${dateStr}`;
}

/**
 * Get ISO week number
 * @param {Date} date
 * @returns {number}
 */
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
