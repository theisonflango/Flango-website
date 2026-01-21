/**
 * Statistics UI Module
 *
 * Renders the Statistics view with 3 modes:
 * 1. Kunder (Customers) - purchases and balance
 * 2. Ekspedienter (Clerks) - sales made as clerk
 * 3. Personale (Staff) - admin supervisor time and assisted sales
 *
 * Modern, colorful Flango design with sortable tables.
 */

import {
    initStatistics,
    getStatisticsMode, setStatisticsMode,
    getPeriod, setPeriod,
    getShowChildren, setShowChildren,
    getShowStaff, setShowStaff,
    getShowAll, setShowAll,
    getSortColumn, getSortDirection, setSort,
    fetchKunderData,
    fetchEkspedienterData,
    fetchPersonaleData,
    formatAmount,
    formatMinutes,
    invalidateStatisticsCache
} from '../domain/statistics-data.js';

// ============================================================
// DOM REFERENCES
// ============================================================
let _container = null;
let _institutionId = null;
let _onOpenPurchaseProfile = null;

// Current state
let _currentMode = 'kunder'; // 'kunder' | 'ekspedienter' | 'personale'

// Styles are now in features.css

// ============================================================
// INITIALIZATION
// ============================================================
export function initStatisticsUI(containerId, institutionId, onOpenPurchaseProfile) {
    _container = document.getElementById(containerId);
    _institutionId = institutionId;
    _onOpenPurchaseProfile = onOpenPurchaseProfile;

    if (!_container) {
        console.error('[statistics-ui] Container not found:', containerId);
        return;
    }

    initStatistics(institutionId);
    console.log('[statistics-ui] Initialized');
}

// ============================================================
// MAIN RENDER
// ============================================================
export async function renderStatisticsView() {
    if (!_container) return;

    const period = getPeriod();
    const showChildren = getShowChildren();
    const showStaff = getShowStaff();
    const showAll = getShowAll();

    _container.innerHTML = `
        <div class="statistics-view">
            <!-- Compact Controls Row (like Produktoversigt) -->
            <div class="stat-controls-row">
                <!-- Mode Buttons -->
                <div class="stat-mode-buttons">
                    <button class="stat-mode-btn ${_currentMode === 'kunder' ? 'active' : ''}" data-mode="kunder">👥 Kunder</button>
                    <button class="stat-mode-btn ${_currentMode === 'ekspedienter' ? 'active' : ''}" data-mode="ekspedienter">🛒 Ekspedienter</button>
                    <button class="stat-mode-btn ${_currentMode === 'personale' ? 'active' : ''}" data-mode="personale">👨‍💼 Personale</button>
                </div>

                <!-- Period Dropdown -->
                <div class="stat-period-group">
                    <span>Periode:</span>
                    <select id="stat-period-select">
                        <option value="7" ${period === '7' ? 'selected' : ''}>7 dage</option>
                        <option value="30" ${period === '30' ? 'selected' : ''}>30 dage</option>
                        <option value="all" ${period === 'all' ? 'selected' : ''}>Alle</option>
                    </select>
                </div>

                <!-- Toggles -->
                <div class="stat-toggles" id="stat-toggles-container">
                    ${renderTogglesForMode(_currentMode, showChildren, showStaff, showAll)}
                </div>
            </div>

            <!-- Info Row (like Produktoversigt subtitle) -->
            <div class="stat-info-row" id="stat-info-row">
                <!-- Will be populated by loadAndRenderTable -->
            </div>

            <!-- Table Container -->
            <div class="statistics-table-container" id="statistics-table-container">
                <div class="statistics-loading">Indlæser...</div>
            </div>
        </div>
    `;

    attachEventListeners();
    await loadAndRenderTable();
}

/**
 * Get empty state message based on mode
 */
function getEmptyMessage(mode) {
    switch (mode) {
        case 'kunder':
            return {
                icon: '👥',
                title: 'Ingen kunder at vise',
                hint: 'Prøv at slå "Børn" eller "Personale/Admins" til'
            };
        case 'ekspedienter':
            return {
                icon: '🛒',
                title: 'Ingen ekspedienter at vise',
                hint: 'Prøv at ændre filtre eller periode'
            };
        case 'personale':
            return {
                icon: '👨‍💼',
                title: 'Ingen voksne ansvarlige fundet',
                hint: 'Der er ingen admin-brugere i denne institution'
            };
        default:
            return {
                icon: '📊',
                title: 'Ingen data at vise',
                hint: 'Prøv at ændre filtre eller periode'
            };
    }
}

/**
 * Render toggles based on current mode
 */
function renderTogglesForMode(mode, showChildren, showStaff, showAll) {
    if (mode === 'kunder') {
        // Kunder: Børn (default ON), Personale/Admins (default OFF)
        return `
            <label class="stat-toggle-pill children ${showChildren ? 'active' : ''}" data-toggle="children">
                <span class="toggle-icon">👧</span>
                <span>Børn</span>
            </label>
            <label class="stat-toggle-pill staff ${showStaff ? 'active' : ''}" data-toggle="staff">
                <span class="toggle-icon">👨‍💼</span>
                <span>Personale/Admins</span>
            </label>
        `;
    } else if (mode === 'ekspedienter') {
        // Ekspedienter: Børn (default ON), Personale/Admins (default OFF), Alle (default OFF)
        return `
            <label class="stat-toggle-pill children ${showChildren ? 'active' : ''}" data-toggle="children">
                <span class="toggle-icon">👧</span>
                <span>Børn</span>
            </label>
            <label class="stat-toggle-pill staff ${showStaff ? 'active' : ''}" data-toggle="staff">
                <span class="toggle-icon">👨‍💼</span>
                <span>Personale/Admins</span>
            </label>
            <label class="stat-toggle-pill ${showAll ? 'active' : ''}" data-toggle="all">
                <span class="toggle-icon">👥</span>
                <span>Alle</span>
            </label>
        `;
    } else if (mode === 'personale') {
        // Personale: No toggles (only shows admins)
        return `<span style="color: #64748b; font-size: 13px;">Viser kun voksne ansvarlige</span>`;
    }
    return '';
}

// ============================================================
// EVENT LISTENERS
// ============================================================
function attachEventListeners() {
    // Mode buttons
    _container.querySelectorAll('.stat-mode-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const mode = btn.dataset.mode;
            if (mode !== _currentMode) {
                _currentMode = mode;
                setStatisticsMode(mode);

                // Reset toggles to defaults for new mode
                if (mode === 'kunder' || mode === 'ekspedienter') {
                    setShowChildren(true);
                    setShowStaff(false);
                    setShowAll(false);
                }

                // Re-render entire view to update toggles
                await renderStatisticsView();
            }
        });
    });

    // Period select
    const periodSelect = _container.querySelector('#stat-period-select');
    if (periodSelect) {
        periodSelect.addEventListener('change', async () => {
            setPeriod(periodSelect.value);
            invalidateStatisticsCache();
            await loadAndRenderTable();
        });
    }

    // Toggles
    _container.querySelectorAll('.stat-toggle-pill').forEach(pill => {
        pill.addEventListener('click', async () => {
            const toggle = pill.dataset.toggle;
            
            if (toggle === 'children') {
                const newValue = !getShowChildren();
                setShowChildren(newValue);
                pill.classList.toggle('active', newValue);
                // If "All" is on and we toggle something else, turn off "All"
                if (getShowAll()) {
                    setShowAll(false);
                    _container.querySelector('[data-toggle="all"]')?.classList.remove('active');
                }
            } else if (toggle === 'staff') {
                const newValue = !getShowStaff();
                setShowStaff(newValue);
                pill.classList.toggle('active', newValue);
                if (getShowAll()) {
                    setShowAll(false);
                    _container.querySelector('[data-toggle="all"]')?.classList.remove('active');
                }
            } else if (toggle === 'all') {
                const newValue = !getShowAll();
                setShowAll(newValue);
                pill.classList.toggle('active', newValue);
                if (newValue) {
                    // "All" overrides individual toggles
                    setShowChildren(true);
                    setShowStaff(true);
                    _container.querySelector('[data-toggle="children"]')?.classList.add('active');
                    _container.querySelector('[data-toggle="staff"]')?.classList.add('active');
                }
            }
            
            await loadAndRenderTable();
        });
    });
}

// ============================================================
// TABLE RENDERING
// ============================================================
async function loadAndRenderTable() {
    const tableContainer = _container.querySelector('#statistics-table-container');
    const infoRow = _container.querySelector('#stat-info-row');
    if (!tableContainer) return;

    tableContainer.innerHTML = '<div class="statistics-loading">Indlæser...</div>';
    if (infoRow) infoRow.innerHTML = '';

    try {
        let result;

        if (_currentMode === 'kunder') {
            result = await fetchKunderData();
        } else if (_currentMode === 'ekspedienter') {
            result = await fetchEkspedienterData();
        } else if (_currentMode === 'personale') {
            result = await fetchPersonaleData();
        }

        if (result.error) {
            tableContainer.innerHTML = `<p style="color: #c00; padding: 20px;">Fejl: ${result.error}</p>`;
            return;
        }

        if (!result.rows || result.rows.length === 0) {
            const emptyMessage = getEmptyMessage(_currentMode);
            if (infoRow) infoRow.innerHTML = `<span style="color: #666;">${emptyMessage.title}</span>`;
            tableContainer.innerHTML = '';
            return;
        }

        // Update info row (like Produktoversigt subtitle)
        const modeLabel = _currentMode === 'kunder' ? 'kunder' :
                          _currentMode === 'ekspedienter' ? 'ekspedienter' : 'personale';
        if (infoRow) {
            infoRow.innerHTML = `${result.rows.length} ${modeLabel} <span style="color: #888; margin-left: 10px;">Klik på kolonneoverskrift for at sortere</span>`;
        }

        renderTable(tableContainer, result.rows, result.columns, result.totals);

    } catch (err) {
        console.error('[statistics-ui] Error loading data:', err);
        tableContainer.innerHTML = `<p style="color: #c00; padding: 20px;">Fejl: ${err.message}</p>`;
    }
}

/**
 * Render table with data - matching Produktoversigt style with inline styles
 */
function renderTable(container, rows, columns, totals) {
    const sortCol = getSortColumn();
    const sortDir = getSortDirection();

    // Build table with inline styles (like Produktoversigt)
    const table = document.createElement('table');
    table.style.cssText = 'width: 100%; border-collapse: collapse; font-size: 14px;';

    // Header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.style.cssText = 'background: #f5f5f5; border-bottom: 2px solid #ddd;';

    columns.forEach(col => {
        const th = document.createElement('th');
        const isSorted = col.key === sortCol;
        const sortIndicator = isSorted ? (sortDir === 'asc' ? '↑' : '↓') : '↕';

        th.style.cssText = 'padding: 10px 8px; text-align: left; font-weight: 600; font-size: 13px; color: #333; white-space: nowrap;';

        if (col.sortable) {
            th.style.cursor = 'pointer';
            th.innerHTML = `${col.label}<span style="margin-left: 4px; opacity: ${isSorted ? '1' : '0.4'}; color: ${isSorted ? '#6366f1' : '#666'};">${sortIndicator}</span>`;
            th.dataset.column = col.key;
            th.classList.add('sortable');
        } else {
            th.textContent = col.label;
        }

        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');

    rows.forEach((row, idx) => {
        const tr = document.createElement('tr');
        const isEven = idx % 2 === 1;
        tr.style.cssText = `border-bottom: 1px solid #eee; background: ${isEven ? '#fafafa' : 'white'};`;
        tr.dataset.userId = row.id;

        // Hover effect
        tr.addEventListener('mouseenter', () => { tr.style.background = '#f0f7ff'; });
        tr.addEventListener('mouseleave', () => { tr.style.background = isEven ? '#fafafa' : 'white'; });

        // Click handler for Kunder mode
        if (row.isChild && _currentMode === 'kunder') {
            tr.style.cursor = 'pointer';
            tr.addEventListener('click', () => {
                if (_onOpenPurchaseProfile) {
                    _onOpenPurchaseProfile(row.id);
                }
            });
        }

        columns.forEach(col => {
            const td = document.createElement('td');
            td.style.cssText = 'padding: 8px; vertical-align: middle;';
            td.innerHTML = formatCell(row, col.key);
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });

    table.appendChild(tbody);

    // Clear and append
    container.innerHTML = '';
    container.appendChild(table);

    // Attach sort listeners
    container.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', async () => {
            const column = th.dataset.column;
            const currentDir = getSortDirection();
            const newDir = (column === getSortColumn() && currentDir === 'asc') ? 'desc' : 'asc';
            setSort(column, newDir);
            await loadAndRenderTable();
        });
    });
}

/**
 * Format cell value for display
 */
function formatCell(row, key) {
    const value = row[key];

    switch (key) {
        case 'name':
            return `<span class="stat-name">${escapeHtml(value || 'Ukendt')}</span>`;

        case 'role':
            if (row.isChild) {
                return '<span class="stat-badge stat-badge-child">Barn</span>';
            }
            return '<span class="stat-badge stat-badge-admin">Voksen</span>';

        case 'balance':
            const balanceClass = value < 0 ? 'negative' : '';
            return `<span class="stat-amount ${balanceClass}">${formatAmount(value)}</span>`;

        case 'purchaseAmount':
        case 'salesAmount':
        case 'selfSalesAmount':
        case 'assistedSalesAmount':
        case 'totalSalesAmount':
            return `<span class="stat-amount">${formatAmount(value)}</span>`;

        case 'purchaseCount':
        case 'salesCount':
        case 'itemsSold':
            return `<span class="stat-number">${value || 0}</span>`;

        case 'clerkTime':
        case 'supervisorTime':
        case 'totalTime':
            return `<span class="stat-time">${formatMinutes(value)}</span>`;

        case 'level':
            if (row.stars) {
                return `<span class="stat-level"><span class="stat-stars">${row.stars}</span><span class="stat-level-name">${value}</span></span>`;
            }
            return `<span class="stat-level-name">${value || 'Nybegynder'}</span>`;

        default:
            if (value === null || value === undefined) {
                return '<span class="stat-empty">-</span>';
            }
            return escapeHtml(String(value));
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================
// EXPORTS
// ============================================================
export async function refreshStatistics() {
    invalidateStatisticsCache();
    await loadAndRenderTable();
}
