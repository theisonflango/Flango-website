// Historik- og rapporthåndtering

import { showAlert, showCustomAlert } from '../ui/sound-and-alerts.js';
import { supabaseClient } from '../core/config-and-supabase.js';
import { getInstitutionId, getCurrentClerk } from './session-store.js';
import { getProductIconInfo } from './products-and-cart.js';
import { initHistoryStore, loadSalesHistory } from './history-store.js';
import { formatKr, buildAdjustmentTexts, showConfirmModal } from '../ui/confirm-modals.js';
import { updateCustomerBalanceGlobally } from '../core/balance-manager.js';

const HISTORY_DEBUG = false;

let fullSalesHistory = [];
let getAllUsersAccessor = () => [];

const safeNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
};

function isHistoryAdmin() {
    let clerk = null;
    try {
        clerk = typeof getCurrentClerk === 'function' ? getCurrentClerk() : null;
    } catch (e) {
        clerk = null;
    }

    const clerkRole = (clerk && clerk.role ? String(clerk.role) : '').toLowerCase();
    if (clerkRole === 'admin') {
        return true;
    }
    if (clerkRole && clerkRole !== 'admin') {
        return false;
    }

    const roleFromWindow = (window.__flangoCurrentClerkRole || '').toLowerCase();
    const adminProfileRole = ((window.__flangoCurrentAdminProfile && window.__flangoCurrentAdminProfile.role) || '').toLowerCase();
    const clerkProfileRole = ((window.__flangoCurrentClerkProfile && window.__flangoCurrentClerkProfile.role) || '').toLowerCase();

    if (window.currentUserIsAdmin === true) return true;
    if (roleFromWindow === 'admin') return true;
    if (adminProfileRole === 'admin') return true;
    if (clerkProfileRole === 'admin') return true;
    return false;
}

let currentEditSaleEvent = null;
let currentItemCorrections = [];
let currentManualAdjustment = 0;

export function configureHistoryModule({ getAllUsers } = {}) {
    if (typeof getAllUsers === 'function') {
        getAllUsersAccessor = getAllUsers;
    }
    initHistoryStore({
        supabaseClient,
        getInstitutionId,
    });
}

export async function showSalesHistory() {
    const salesHistoryModal = document.getElementById('sales-history-modal');
    if (!salesHistoryModal) return;

    const closeBtn = salesHistoryModal.querySelector('.close-btn');
    if (closeBtn) closeBtn.onclick = () => salesHistoryModal.style.display = 'none';

    const filterDepositsBtn = salesHistoryModal.querySelector('#filter-deposits-btn');
    const printReportBtn = salesHistoryModal.querySelector('#print-report-btn');
    const printNegativeBtn = salesHistoryModal.querySelector('#print-negative-balance-btn');
    const searchInput = salesHistoryModal.querySelector('#search-history-input');
    const historyStartDate = salesHistoryModal.querySelector('#history-start-date');
    const historyEndDate = salesHistoryModal.querySelector('#history-end-date');
    const printAllBalancesBtn = salesHistoryModal.querySelector('#print-all-balances-btn');
    const undoLastSaleBtn = salesHistoryModal.querySelector('#history-undo-last-sale-btn');
    const filterBtn = salesHistoryModal.querySelector('#history-filter-btn');
    const filterPanel = salesHistoryModal.querySelector('#history-filter-panel');
    const filterSelectAll = salesHistoryModal.querySelector('#history-filter-select-all');
    const filterDeselectAll = salesHistoryModal.querySelector('#history-filter-deselect-all');
    const filterCheckboxes = Array.from(salesHistoryModal.querySelectorAll('.history-filter-checkbox'));

    if (!filterDepositsBtn || !printReportBtn || !printNegativeBtn || !searchInput || !historyStartDate || !historyEndDate) {
        return;
    }

    filterDepositsBtn.onclick = () => {
        const isActive = filterDepositsBtn.classList.toggle('active');
        if (isActive) {
            filterDepositsBtn.textContent = 'Vis Alle Hændelser';
            renderSalesHistory(fullSalesHistory, null, 'DEPOSIT');
        } else {
            filterDepositsBtn.textContent = 'Vis Kun Indbetalinger';
            renderSalesHistory(fullSalesHistory);
        }
    };

    printReportBtn.onclick = handlePrintReport;
    searchInput.oninput = () => {
        const isActive = filterDepositsBtn.classList.contains('active');
        renderSalesHistory(fullSalesHistory, null, isActive ? 'DEPOSIT' : null);
    };
    printNegativeBtn.onclick = handlePrintNegativeBalance;
    if (printAllBalancesBtn) {
        printAllBalancesBtn.onclick = handlePrintAllBalances;
    }
    if (undoLastSaleBtn) {
        undoLastSaleBtn.onclick = () => {
            const handler = window.__flangoUndoLastSale;
            if (typeof handler === 'function') {
                handler();
            } else {
                showAlert('Fortryd-funktionen er ikke klar.');
            }
        };
    }
    if (filterBtn && filterPanel) {
        filterBtn.onclick = () => {
            const isVisible = filterPanel.style.display === 'block';
            filterPanel.style.display = isVisible ? 'none' : 'block';
            filterBtn.classList.toggle('active', !isVisible);
        };
    }
    if (filterSelectAll && filterCheckboxes.length) {
        filterSelectAll.onclick = () => {
            filterCheckboxes.forEach(cb => { cb.checked = true; });
            const isActive = filterDepositsBtn.classList.contains('active');
            renderSalesHistory(fullSalesHistory, null, isActive ? 'DEPOSIT' : null);
        };
    }
    if (filterDeselectAll && filterCheckboxes.length) {
        filterDeselectAll.onclick = () => {
            filterCheckboxes.forEach(cb => { cb.checked = false; });
            const isActive = filterDepositsBtn.classList.contains('active');
            renderSalesHistory(fullSalesHistory, null, isActive ? 'DEPOSIT' : null);
        };
    }
    if (filterCheckboxes.length) {
        filterCheckboxes.forEach(cb => {
            cb.checked = true;
            // Tilføj event listener for at re-render når filter ændres
            cb.onchange = () => {
                const isActive = filterDepositsBtn.classList.contains('active');
                renderSalesHistory(fullSalesHistory, null, isActive ? 'DEPOSIT' : null);
            };
        });
    }

    // Find or create the test users checkbox
    let showTestUsersCheckbox = salesHistoryModal.querySelector('#show-test-users-checkbox');
    if (!showTestUsersCheckbox) {
        if (filterPanel) {
            // Create checkbox container
            const checkboxContainer = document.createElement('div');
            checkboxContainer.style.marginTop = '16px';
            checkboxContainer.style.paddingTop = '16px';
            checkboxContainer.style.borderTop = '1px solid var(--border-color, #e0e0e0)';
            checkboxContainer.innerHTML = `
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px;">
                    <input type="checkbox" id="show-test-users-checkbox" style="cursor: pointer;">
                    <span>Vis testbrugere (Snoop Dog, Test Aladin)</span>
                </label>
            `;
            filterPanel.appendChild(checkboxContainer);

            // Get reference after creation
            showTestUsersCheckbox = document.getElementById('show-test-users-checkbox');
        }
    }

    // Wire up event listener to refetch history when toggled
    if (showTestUsersCheckbox) {
        showTestUsersCheckbox.onchange = fetchHistory;
    }

    salesHistoryModal.style.display = 'flex';

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;

    historyStartDate.value = today;
    historyEndDate.value = today;
    historyStartDate.onchange = fetchHistory;
    historyEndDate.onchange = fetchHistory;
    await fetchHistory();
    filterDepositsBtn.classList.remove('active');
    filterDepositsBtn.textContent = 'Vis Kun Indbetalinger';
}

async function fetchHistory() {
    const salesHistoryModal = document.getElementById('sales-history-modal');
    if (!salesHistoryModal) return;
    const searchInput = salesHistoryModal.querySelector('#search-history-input');
    const historyStartDate = salesHistoryModal.querySelector('#history-start-date');
    const historyEndDate = salesHistoryModal.querySelector('#history-end-date');
    const testUsersCheckbox = document.getElementById('show-test-users-checkbox');
    if (!searchInput || !historyStartDate || !historyEndDate) return;

    searchInput.value = '';
    const startDateStr = historyStartDate.value;
    const endDateStr = historyEndDate.value;
    const includeTestUsers = testUsersCheckbox ? testUsersCheckbox.checked : false;  // Default false

    const { rows, error } = await loadSalesHistory({
        from: startDateStr,
        to: endDateStr,
        includeTestUsers
    });

    if (error) {
        fullSalesHistory = [];
        renderSalesHistory(fullSalesHistory, `Fejl: ${error.message}`);
        return;
    }
    fullSalesHistory = rows;
    if (HISTORY_DEBUG) console.log(
        'DEBUG history names:',
        fullSalesHistory.slice(0, 10).map(e => ({
            type: e.event_type,
            target: e.target_user_name,
            admin_name: e.admin_name,
            clerk_name: e.clerk_name,
            session_admin_name: e.session_admin_name,
        })),
    );
    const filterDepositsBtn = salesHistoryModal.querySelector('#filter-deposits-btn');
    const isActive = filterDepositsBtn?.classList.contains('active');
    renderSalesHistory(fullSalesHistory, null, isActive ? 'DEPOSIT' : null);
}

const getEventTimestamp = (event) => event?.created_at;

function getEventAmount(event) {
    const details = event.details || {};

    if (event.event_type === 'SALE') {
        const explicitAmount = safeNumber(details.amount);
        if (explicitAmount > 0) return explicitAmount;

        if (Array.isArray(event.items)) {
            return event.items.reduce((sum, item) => {
                const qty = safeNumber(item.quantity);
                const price = safeNumber(item.price_at_purchase);
                return sum + qty * price;
            }, 0);
        }
        return 0;
    }

    if (event.event_type === 'DEPOSIT') {
        return safeNumber(details.amount);
    }

    return 0;
}

function renderSalesHistory(salesData, errorMessage = null, eventTypeFilter = null) {
    const salesHistoryModal = document.getElementById('sales-history-modal');
    if (!salesHistoryModal) return;
    const salesList = salesHistoryModal.querySelector('#sales-history-list');
    const salesSummaryEl = salesHistoryModal.querySelector('#sales-summary');
    const searchInput = salesHistoryModal.querySelector('#search-history-input');
    if (!salesList || !salesSummaryEl || !searchInput) return;

    const searchTerm = searchInput.value.toLowerCase();
    if (errorMessage) {
        salesList.innerHTML = `<p style="color:var(--danger-color); text-align:center; padding: 20px;">${errorMessage}</p>`;
        salesSummaryEl.replaceChildren();
        return;
    }

    let preFilteredData = salesData;
    if (eventTypeFilter === 'DEPOSIT') {
        preFilteredData = salesData.filter(e => e.event_type === 'DEPOSIT' || e.event_type === 'BALANCE_EDIT');
    } else if (eventTypeFilter) {
        preFilteredData = salesData.filter(e => e.event_type === eventTypeFilter);
    } else {
        // Anvend checkbox-filteret hvis der ikke er et specifikt eventTypeFilter
        const filterCheckboxes = Array.from(salesHistoryModal.querySelectorAll('.history-filter-checkbox'));
        if (filterCheckboxes.length > 0) {
            const checkedEventTypes = filterCheckboxes
                .filter(cb => cb.checked)
                .map(cb => cb.value);

            // Filtrer baseret på valgte event types
            if (checkedEventTypes.length === 0) {
                // Hvis ingen er valgt, vis ingenting
                preFilteredData = [];
            } else if (checkedEventTypes.length < filterCheckboxes.length) {
                // Kun filtrer hvis ikke alle er valgt (for performance)
                preFilteredData = salesData.filter(e => {
                    const eventType = e.event_type;
                    // Map event types til checkbox values
                    if (eventType === 'BALANCE_EDIT') return checkedEventTypes.includes('BALANCE_ADJUSTMENT');
                    if (eventType === 'SALE_ADJUSTMENT') return checkedEventTypes.includes('SALE_EDIT');
                    return checkedEventTypes.includes(eventType);
                });
            }
        }
    }

    const filteredEvents = preFilteredData.filter(sale => {
        const targetName = (sale.target_user_name || '').toLowerCase();
        const adminName = (sale.admin_name || '').toLowerCase();
        const detailsString = JSON.stringify(sale.details).toLowerCase();
        return targetName.includes(searchTerm) || adminName.includes(searchTerm) || detailsString.includes(searchTerm);
    });
    if (filteredEvents.length === 0) {
        const message = searchTerm ? 'Ingen salg matcher din søgning.' : 'Der er ingen salg i den valgte periode.';
        salesList.innerHTML = `<p style="text-align:center; padding: 20px;">${message}</p>`;
        salesSummaryEl.replaceChildren();
        return;
    }

    // ### Layout Ændring ###
    // Injicer CSS for det nye kolonne-layout for historik-rækkerne.
    // Gøres kun én gang for at undgå duplikerede styles.
    if (!document.getElementById('history-row-styles')) {
        const style = document.createElement('style');
        style.id = 'history-row-styles';
        style.textContent = `
            .history-row {
                display: grid;
                grid-template-columns: 1.4fr 1.4fr 0.8fr 1fr 1.1fr 1.1fr 0.6fr;
                align-items: center;
                gap: 10px;
                padding: 10px 12px;
                border-bottom: 1px solid #eee;
                transition: background-color 0.15s ease-out;
            }
            .history-row:hover {
                background-color: #fafafa;
            }
            .history-row > div { font-size: 14px; overflow: hidden; text-overflow: ellipsis; }
            .history-primary {
                font-weight: 500;
                margin-bottom: 2px;
            }
            .history-secondary {
                font-size: 12px;
                color: #666;
            }
            .history-edit-btn {
                padding: 6px 10px;
                border-radius: 6px;
                background-color: #efefef;
                border: 1px solid #ccc;
                cursor: pointer;
                font-size: 13px;
                white-space: nowrap;
                transition: background-color 0.2s;
            }
            .history-edit-btn:hover { background-color: #e4e4e4; }
        `;
        document.head.appendChild(style);
    }

    if (filteredEvents.length > 0) {
        const summaryHTML = buildSalesHistorySummaryHTML(preFilteredData, filteredEvents);
        salesSummaryEl.innerHTML = summaryHTML;
        // Initialiser chart-karussellen efter at have sat HTML'en.
        initHistoryChartCarousel(salesSummaryEl);

        salesList.replaceChildren();
        const adjustmentsBySaleId = new Map();
        filteredEvents.forEach(ev => {
            if (ev.event_type === 'SALE_ADJUSTMENT' && ev.details?.adjusted_sale_id) {
                const saleId = ev.details.adjusted_sale_id;
                const list = adjustmentsBySaleId.get(saleId) || [];
                list.push(ev);
                adjustmentsBySaleId.set(saleId, list);
            }
        });

        filteredEvents.forEach(event => {
            const adjustedSaleId = event.details?.adjusted_sale_id;
            const isChildAdjustment = event.event_type === 'SALE_ADJUSTMENT' && adjustedSaleId;
            if (isChildAdjustment) return;

            const entryEl = buildSalesHistoryEntryElement(event);
            salesList.appendChild(entryEl);

            const eventId = event.id || event.event_id || null;
            if (event.event_type === 'SALE' && eventId) {
                const children = adjustmentsBySaleId.get(eventId) || [];
                children.forEach(adjEvent => {
                    const childEl = buildSalesHistoryEntryElement(adjEvent, { isAdjustmentChild: true });
                    salesList.appendChild(childEl);
                });
            }
        });
    } else {
        salesSummaryEl.replaceChildren(); // Ryd oversigten, hvis der ingen resultater er
        const message = searchTerm ? 'Ingen salg matcher din søgning.' : 'Der er ingen salg i den valgte periode.';
        salesList.innerHTML = `<p style="text-align:center; padding: 20px;">${message}</p>`;
    }
}

// Kaldes efter innerHTML er sat for at initialisere carousel-funktionaliteten,
// da scripts i innerHTML ikke eksekveres af browseren.
function initHistoryChartCarousel(rootEl) {
    const modes = [
        { id: 'revenue-chart-panel', label: 'Fordeling af Omsætning' },
        { id: 'count-chart-panel', label: 'Fordeling af Antal' }
    ];
    let currentIndex = 0;

    const prevBtn = rootEl.querySelector('#chart-prev-btn');
    const nextBtn = rootEl.querySelector('#chart-next-btn');
    const labelEl = rootEl.querySelector('#chart-mode-label');
    const panels = modes.map(m => rootEl.querySelector(`#${m.id}`));

    // Hvis elementerne ikke findes (fx ingen salg), skal vi ikke gøre noget.
    if (!prevBtn || !nextBtn || !labelEl || !panels.every(p => p)) {
        return;
    }

    function updateView() {
        labelEl.textContent = modes[currentIndex].label;
        panels.forEach((panel, index) => {
            panel.classList.toggle('active', index === currentIndex);
        });
    }

    prevBtn.onclick = () => {
        currentIndex = (currentIndex - 1 + modes.length) % modes.length;
        updateView();
    };
    nextBtn.onclick = () => {
        currentIndex = (currentIndex + 1) % modes.length;
        updateView();
    };

    // Initialiser visning
    updateView();
}

function buildSaleAdjustmentSummary(event) {
    const details = event.details || {};
    if (details && details.adjustment_amount !== undefined) {
        console.debug('DEBUG SALE_ADJUSTMENT details:', details);
    }

    const adjustmentAmount = Number(details.adjustment_amount) || 0;
    const manualAdjustment = Number(details.manual_adjustment) || 0;
    const editedItems = Array.isArray(details.edited_items) ? details.edited_items : [];

    function formatCurrency(amount) {
        return amount.toFixed(2).replace('.', ',') + ' kr';
    }

    let text = 'Ændring: ' + formatCurrency(adjustmentAmount);

    const changedItems = editedItems
        .map((item) => {
            const name =
                item.product_name ??
                item.productName ??
                item.name ??
                item.product ??
                'Vare';

            const fromCandidates = [
                item.old_qty,
                item.originalQty,
                item.original_quantity,
                item.quantity_before,
                item.fromQty,
                item.from_quantity,
            ];
            const toCandidates = [
                item.new_qty,
                item.newQty,
                item.new_quantity,
                item.quantity_after,
                item.toQty,
                item.to_quantity,
            ];

            let from = fromCandidates.find(v => v !== undefined && v !== null && v !== '');
            let to = toCandidates.find(v => v !== undefined && v !== null && v !== '');

            if (from !== undefined && from !== null) from = Number(from);
            if (to !== undefined && to !== null) to = Number(to);

            if ((from === undefined || from === null) && (to === undefined || to === null)) {
                if (item.originalQty !== undefined && item.diffQty !== undefined) {
                    const base = Number(item.originalQty);
                    const diff = Number(item.diffQty);
                    from = base;
                    to = base + diff;
                }
            }

            if (Number.isNaN(from)) from = null;
            if (Number.isNaN(to)) to = null;

            // Fallback: hvis vi har old_qty og diffQty men mangler new_qty
            if (from !== null && (to === null || to === undefined) && typeof item.diffQty === 'number') {
                to = from + Number(item.diffQty);
            }
            // Eller omvendt: har new_qty og diffQty men mangler old_qty
            if (to !== null && (from === null || from === undefined) && typeof item.diffQty === 'number') {
                from = to - Number(item.diffQty);
            }

            return { name, from, to };
        })
        .filter(i => typeof i.from === 'number' && typeof i.to === 'number' && i.from !== i.to);

    if (changedItems.length) {
        const itemTexts = changedItems.map(i => `${i.name} ${i.from} → ${i.to}`);
        text += ' (' + itemTexts.join(', ') + ')';
    }

    if (manualAdjustment) {
        text += `${changedItems.length ? ', ' : ' ('}inkl. ${formatCurrency(manualAdjustment)} manuel korrektion`;
        if (!changedItems.length) {
            text += ')';
        }
    }

    // Fallback: hvis vi ingen valide vare-linjer har, eller teksten ender med NaN, brug en simpel tekst
    const hasValidItems = changedItems.length > 0;
    const textHasNaN = text.toLowerCase().includes('nan');
    if (!hasValidItems || textHasNaN) {
        text = `Ændring: ${formatCurrency(adjustmentAmount)}`;
        if (manualAdjustment) {
            text += ` (inkl. ${formatCurrency(manualAdjustment)} manuel korrektion)`;
        }
    }

    return text;
}

function buildSalesHistoryEntryElement(event, options = {}) {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'history-row';
    if (options.isAdjustmentChild) {
        rowDiv.classList.add('history-entry-adjustment-child');
        rowDiv.style.paddingLeft = '26px';
    }

    const saleDate = new Date(getEventTimestamp(event));
    const formattedDate = saleDate.toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const formattedTime = saleDate.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });

    // Felt 1: Handling/Kunde
    let actionLabel = 'Handling:';
    let customerName = event.target_user_name || 'Ukendt';
    if (event.event_type === 'SALE') {
        actionLabel = 'Salg til:';
    } else if (event.event_type === 'DEPOSIT') {
        actionLabel = 'Indbetaling til:';
    } else if (event.event_type === 'BALANCE_EDIT') {
        actionLabel = 'Saldo ændret for:';
    } else if (event.event_type === 'SALE_ADJUSTMENT') {
        // Modpostering for et tidligere salg (justering)
        actionLabel = '🔧 Justering af salg';
    }

    // Felt 2: Produkter (SALE)
    let itemsText = '—';
    if (event.event_type === 'SALE' && event.items && Array.isArray(event.items) && event.items.length > 0) {
        itemsText = event.items.map(item => {
            const iconInfo = getProductIconInfo(item);
            let visualMarkup = iconInfo ? `<img src="${iconInfo.path}" alt="${item.product_name}" class="product-icon-small" style="height: 1em; vertical-align: -0.1em;"> ` : (item.emoji ? `${item.emoji} ` : '');
            return `<span style="white-space: nowrap;">${item.quantity} × ${visualMarkup}${item.product_name}</span>`;
        }).join(', ');
    } else if (event.event_type === 'SALE_ADJUSTMENT') {
        itemsText = buildSaleAdjustmentSummary(event);
    }

    // Felt 3: Beløb
    let amount = getEventAmount(event);
    if (event.event_type === 'SALE_ADJUSTMENT') {
        const adj = event.details?.adjustment_amount;
        if (typeof adj === 'number' && Number.isFinite(adj)) {
            amount = adj;
        }
    }
    const amountText = `${amount.toFixed(2)} kr.`;

    // Felt 4: Dato/Tid
    const datetimeHtml = `<div class="history-primary">${formattedDate}</div><div class="history-secondary">${formattedTime}</div>`;

    // Felt 5: Ekspedient
    const clerkName = event.clerk_name || null;
    const adminName = event.admin_name || null;
    const displayClerkName = clerkName || adminName || '(ukendt)';
    const ekspedientHtml = `<div class="history-primary">Ekspedient:</div><div class="history-secondary">${displayClerkName}</div>`;

    // Felt 6: Voksen ansvarlig
    const sessionAdminName = event.session_admin_name || null;
    let displaySessionAdmin = '';
    if (event.event_type === 'SALE' && sessionAdminName) {
        if (sessionAdminName !== displayClerkName) {
            displaySessionAdmin = sessionAdminName;
        }
    }
    const adultHtml = displaySessionAdmin
        ? `<div class="history-primary">Voksen ansvarlig:</div><div class="history-secondary">${displaySessionAdmin}</div>`
        : `<div class="history-primary"></div><div class="history-secondary"></div>`;

    // Felt 7: Rediger-knap
    const editBtnHtml = (event.event_type === 'SALE' && !options.isAdjustmentChild && isHistoryAdmin())
        ? `<button class="history-edit-btn">Rediger</button>`
        : '';

    rowDiv.innerHTML = `
        <div class="history-col-action">
            <div class="history-primary">${actionLabel}</div>
            <div class="history-secondary">${customerName}</div>
        </div>
        <div class="history-col-items">
            <div class="history-primary">${event.event_type === 'SALE' ? 'Produkter:' : ''}</div>
            <div class="history-secondary">${itemsText !== '—' ? itemsText : '—'}</div>
        </div>
        <div class="history-col-amount">
            <div class="history-primary">Beløb:</div>
            <div class="history-secondary">${amountText}</div>
        </div>
        <div class="history-col-datetime">
            ${datetimeHtml}
        </div>
        <div class="history-col-staff">
            ${ekspedientHtml}
        </div>
        <div class="history-col-adult">
            ${adultHtml}
        </div>
        <div class="history-col-edit">
            ${editBtnHtml}
        </div>
    `;

    // Bind klik til rediger-knap efter injection
    const btn = rowDiv.querySelector('.history-edit-btn');
    if (btn) {
        btn.onclick = () => openEditSaleModal(event);
    }

    return rowDiv;
}

function ensureEditSaleModal() {
    let backdrop = document.getElementById('edit-sale-modal-backdrop');
    if (backdrop) return backdrop;

    if (!document.getElementById('edit-sale-modal-style')) {
        const style = document.createElement('style');
        style.id = 'edit-sale-modal-style';
        style.textContent = `
            #edit-sale-modal-backdrop {
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.35);
                display: none;
                align-items: center;
                justify-content: center;
                z-index: 99990;
            }
            #edit-sale-modal-backdrop .edit-sale-modal {
                max-width: 780px;
                width: min(95vw, 780px);
                max-height: 90vh;
                display: flex;
                flex-direction: column;
            }
        `;
        document.head.appendChild(style);
    }

    backdrop = document.createElement('div');
    backdrop.id = 'edit-sale-modal-backdrop';
    backdrop.className = 'modal-backdrop';
    backdrop.style.display = 'none';

    const modal = document.createElement('div');
    modal.className = 'modal-content edit-sale-modal'; // Genbrug .modal-content for konsistent stil

    modal.innerHTML = `
        <div class="modal-header">
            <h2>Rediger salg</h2>
            <button class="close-btn edit-sale-close-btn">&times;</button>
        </div>
        <div class="modal-body">
            <div class="edit-sale-section edit-sale-original"></div>
            <div class="edit-sale-section edit-sale-items"></div>
            <div class="edit-sale-section edit-sale-adjustment"></div>
        </div>
        <div class="modal-footer">
            <button class="edit-sale-revert-btn danger-btn">Fortryd hele salget</button>
            <div style="flex-grow: 1;"></div>
            <button class="edit-sale-reset-btn">Nulstil</button>
            <button class="edit-sale-save-btn primary-btn">Gem ændring</button>
        </div>
    `;

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    // Tilføj styling for de nye sektioner
    const style = document.createElement('style');
    style.textContent = `
        .edit-sale-section { padding: 12px 0; border-bottom: 1px solid #eee; }
        .edit-sale-section:last-of-type { border-bottom: none; }
    `;
    modal.appendChild(style);

    backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
            closeEditSaleModal();
        }
    });

    return backdrop;
}

function closeEditSaleModal() {
    const backdrop = document.getElementById('edit-sale-modal-backdrop');
    if (backdrop) {
        backdrop.style.display = 'none';
    }
    const historyModal = document.getElementById('sales-history-modal');
    if (historyModal) {
        historyModal.style.zIndex = '';
    }
    currentEditSaleEvent = null;
    currentItemCorrections = [];
    currentManualAdjustment = 0;
}

function openEditSaleModal(historyEvent) {
    if (!historyEvent || historyEvent.event_type !== 'SALE') return;

    const historyModal = document.getElementById('sales-history-modal');
    if (historyModal) {
        historyModal.style.zIndex = '9000';
    }

    const backdrop = ensureEditSaleModal();
    const modal = backdrop.querySelector('.edit-sale-modal');
    const originalSection = modal.querySelector('.edit-sale-original');
    const itemsSection = modal.querySelector('.edit-sale-items');
    const adjustmentSection = modal.querySelector('.edit-sale-adjustment');
    const saveBtn = modal.querySelector('.edit-sale-save-btn');
    const resetBtn = modal.querySelector('.edit-sale-reset-btn');
    const revertBtn = modal.querySelector('.edit-sale-revert-btn');
    const closeBtn = modal.querySelector('.edit-sale-close-btn');

    currentEditSaleEvent = historyEvent;
    currentItemCorrections = [];
    currentManualAdjustment = 0;

    const dateStr = new Date(getEventTimestamp(historyEvent)).toLocaleString('da-DK', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const amount = getEventAmount(historyEvent).toFixed(2);
    originalSection.innerHTML = `
        <div><strong>Kunde:</strong> ${historyEvent.target_user_name || 'Ukendt'}</div>
        <div><strong>Beløb:</strong> ${amount} kr.</div>
        <div><strong>Tidspunkt:</strong> ${dateStr}</div>
        <div><strong>Ekspedient:</strong> ${historyEvent.admin_name || historyEvent.clerk_name || 'Ukendt'}</div>
        <div><strong>Voksen ansvarlig:</strong> ${historyEvent.session_admin_name || historyEvent.admin_name || '(ukendt)'}</div>
    `;

    const items = Array.isArray(historyEvent.items) ? historyEvent.items : [];
    const table = document.createElement('table');
    table.className = 'edit-sale-items-table';
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.innerHTML = `
        <thead>
            <tr>
                <th style="text-align:left;">Vare</th>
                <th>Oprindeligt antal</th>
                <th>Korrektion</th>
                <th>Nyt resultat</th>
                <th>Pris-diff</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');

    currentItemCorrections = items.map((item, idx) => {
        const originalQty = safeNumber(item.quantity);
        const unitPrice = safeNumber(item.price_at_purchase);
        const entry = {
            itemIndex: idx,
            productName: item.product_name || item.name || 'Ukendt',
            originalQty,
            diffQty: 0,
            unitPrice,
            rowElements: {
                resultCell: null,
                diffCell: null,
                priceCell: null,
            },
        };

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.emoji ? `${item.emoji} ` : ''}${entry.productName}</td>
            <td style="text-align:center;">${originalQty}</td>
            <td style="text-align:center;"></td>
            <td style="text-align:center;">${originalQty}</td>
            <td style="text-align:center;">0,00 kr</td>
        `;

        const corrTd = tr.children[2];
        const resultTd = tr.children[3];
        const priceTd = tr.children[4];

        const minusBtn = document.createElement('button');
        minusBtn.textContent = '−';
        minusBtn.style.marginRight = '6px';
        const plusBtn = document.createElement('button');
        plusBtn.textContent = '+';
        plusBtn.style.marginLeft = '6px';
        const diffValue = document.createElement('span');
        diffValue.textContent = '0';

        corrTd.appendChild(minusBtn);
        corrTd.appendChild(diffValue);
        corrTd.appendChild(plusBtn);

        entry.rowElements.resultCell = resultTd;
        entry.rowElements.diffCell = priceTd;
        entry.rowElements.counterCell = diffValue;

        minusBtn.onclick = () => {
            entry.diffQty -= 1;
            updateEditSaleSummary();
        };
        plusBtn.onclick = () => {
            entry.diffQty += 1;
            updateEditSaleSummary();
        };

        tbody.appendChild(tr);
        return entry;
    });

    itemsSection.replaceChildren(table);

    adjustmentSection.innerHTML = `
        <div style="margin-bottom:8px;">
            <strong>Yderligere manuel beløbskorrektion (kr):</strong>
            <div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
                <button class="manual-minus-btn">-1 kr</button>
                <span class="manual-amount-display">0,00 kr</span>
                <button class="manual-plus-btn">+1 kr</button>
            </div>
        </div>
        <div class="edit-sale-summary">
            <div>Varer: <span class="items-diff-display">0,00 kr</span></div>
            <div>Manuel korrektion: <span class="manual-diff-display">0,00 kr</span></div>
            <div><strong>Total korrektion: <span class="total-diff-display">0,00 kr</span></strong></div>
        </div>
    `;

    const manualMinus = adjustmentSection.querySelector('.manual-minus-btn');
    const manualPlus = adjustmentSection.querySelector('.manual-plus-btn');
    const manualDisplay = adjustmentSection.querySelector('.manual-amount-display');

    manualMinus.onclick = () => {
        currentManualAdjustment -= 1;
        manualDisplay.textContent = `${currentManualAdjustment.toFixed(2).replace('.', ',')} kr`;
        updateEditSaleSummary();
    };
    manualPlus.onclick = () => {
        currentManualAdjustment += 1;
        manualDisplay.textContent = `${currentManualAdjustment.toFixed(2).replace('.', ',')} kr`;
        updateEditSaleSummary();
    };

    saveBtn.onclick = async () => {
        updateEditSaleSummary();
        const saleId = historyEvent.id || historyEvent.event_id || null;
        const customerId = historyEvent.target_user_id || historyEvent.customer_id || null;
        const itemsTotal = currentItemCorrections.reduce((sum, entry) => sum + (entry.diffQty * entry.unitPrice), 0);
        const totalAdjustmentAmount = itemsTotal + currentManualAdjustment;
        const originalTotal = getEventAmount(historyEvent);
        const newTotal = originalTotal + totalAdjustmentAmount;

        if (totalAdjustmentAmount === 0) {
            showCustomAlert('Info', 'Der er ingen ændringer at gemme.');
            return;
        }

        const editedItems = currentItemCorrections
            .filter(entry => entry.diffQty !== 0)
            .map(entry => ({
                itemIndex: entry.itemIndex,
                productName: entry.productName,
                diffQty: entry.diffQty,
                unitPrice: entry.unitPrice,
                old_qty: entry.originalQty ?? 0,
                new_qty: (entry.originalQty ?? 0) + entry.diffQty,
            }));

        const payload = {
            adjusted_sale_id: saleId,
            new_total: newTotal,
            old_total: originalTotal,
            edited_items: editedItems,
            manual_adjustment: currentManualAdjustment,
        };

        const customerName = historyEvent.target_user_name || 'kunden';
        const result = await applySaleAdjustmentWithConfirm(customerId, customerName, totalAdjustmentAmount, payload);
        if (result?.ok) {
            closeEditSaleModal();
            await fetchHistory();
        }
    };

    resetBtn.onclick = () => {
        currentManualAdjustment = 0;
        currentItemCorrections.forEach(entry => {
            entry.diffQty = 0;
        });
        const manualDisplaySpan = adjustmentSection.querySelector('.manual-amount-display');
        if (manualDisplaySpan) manualDisplaySpan.textContent = '0,00 kr';
        updateEditSaleSummary();
    };

    revertBtn.onclick = () => {
        const originalAmount = getEventAmount(historyEvent);
        const payload = {
            originalEventId: historyEvent.id || historyEvent.event_id || null,
            fullReversal: true,
            suggestedTotalReversalAmount: -originalAmount,
        };
        console.log('FULL SALE REVERSAL:', payload);
        showCustomAlert('Info', 'Fortrydelse af hele salget er registreret (TODO: send til Supabase).');
        closeEditSaleModal();
    };

    closeBtn.onclick = () => {
        closeEditSaleModal();
    };

    updateEditSaleSummary();
    backdrop.style.display = 'flex';
}

// Opdater lokal bruger-balance, så UI kan vise den nye saldo med det samme
function updateCustomerBalanceLocally(customerId, delta) {
    // Opdater lokal bruger-balance, så UI kan vise den nye saldo med det samme
    if (!customerId || !delta || typeof getAllUsersAccessor !== 'function') return;

    try {
        const allUsers = getAllUsersAccessor();
        if (!Array.isArray(allUsers)) return;

        const user = allUsers.find(u =>
            u && (
                u.id === customerId ||
                u.user_id === customerId ||
                u.uuid === customerId ||
                u.institution_user_id === customerId
            )
        );
        if (!user) return;

        const oldBalance = safeNumber(user.balance);
        const newBalance = oldBalance + (Number(delta) || 0);

        // Use unified balance manager instead of orphaned hook
        updateCustomerBalanceGlobally(customerId, newBalance, delta, 'history-adjustment');
    } catch (err) {
        console.warn('updateCustomerBalanceLocally: fejl ved lokal saldo-opdatering', err);
    }
}

// Helper function to apply sale adjustment with confirmation
async function applySaleAdjustmentWithConfirm(customerId, customerName, delta, payload) {
    if (!customerId) {
        console.warn('applySaleAdjustmentWithConfirm: missing customerId');
        showCustomAlert('Fejl', 'Kunne ikke gemme ændring: kunden kunne ikke identificeres.');
        return { ok: false, reason: 'missing_customer' };
    }

    // Byg tekster til confirm-modal
    const { title, message, confirmLabel, cancelLabel } = buildAdjustmentTexts(customerName || 'kunden', delta);

    // Vis modal med OK / Annuller
    const confirmed = await showConfirmModal({
        title,
        message,
        confirmText: confirmLabel,
        cancelText: cancelLabel,
    });

    if (!confirmed) {
        // Brugeren valgte "Annuller"
        return { ok: false, reason: 'cancelled' };
    }

    // Kald Supabase RPC for at gemme justeringen
    try {
        const { error } = await supabaseClient.rpc('register_sale_adjustment', {
            p_customer_id: customerId,
            p_adjustment_amount: delta,
            p_payload: payload,
        });

        if (error) {
            console.error('register_sale_adjustment error', error);
            showCustomAlert('Fejl', 'Kunne ikke gemme ændring: ' + (error.message || error));
            return { ok: false, error };
        }
        // Opdater den berørte brugers saldo lokalt, så UI afspejler ændringen med det samme
        updateCustomerBalanceLocally(customerId, delta);
        // Lav en kort og tydelig bekræftelse
        const absAmount = Math.abs(delta);
        const prettyAmount = formatKr(absAmount);
        let sentencePart;
        if (delta < 0) {
            sentencePart = `har fået ${prettyAmount} retur på saldoen.`;
        } else if (delta > 0) {
            sentencePart = `har fået trukket ${prettyAmount} ekstra fra saldoen.`;
        } else {
            sentencePart = 's saldo er uændret.';
        }

        const safeName = customerName || 'Kunden';
        showCustomAlert(
            'Justering gemt',
            `Ændringen er gemt – ${safeName} ${sentencePart}`
        );

        return { ok: true };
    } catch (e) {
        console.error('register_sale_adjustment exception', e);
        showCustomAlert('Fejl', 'Noget gik galt under forsøg på at gemme justeringen.');
        return { ok: false, error: e };
    }
}

function updateEditSaleSummary() {
    const backdrop = document.getElementById('edit-sale-modal-backdrop');
    if (!backdrop || !currentItemCorrections) return;
    const modal = backdrop.querySelector('.edit-sale-modal');
    const itemsDiffEl = modal.querySelector('.items-diff-display');
    const manualDiffEl = modal.querySelector('.manual-diff-display');
    const totalDiffEl = modal.querySelector('.total-diff-display');

    let itemsDiff = 0;
    currentItemCorrections.forEach(entry => {
        itemsDiff += entry.diffQty * entry.unitPrice;
        if (entry.rowElements.resultCell) {
            entry.rowElements.resultCell.textContent = String(entry.originalQty + entry.diffQty);
        }
        if (entry.rowElements.counterCell) {
            entry.rowElements.counterCell.textContent = String(entry.diffQty);
        }
        if (entry.rowElements.diffCell) {
            entry.rowElements.diffCell.textContent = `${(entry.diffQty * entry.unitPrice).toFixed(2).replace('.', ',')} kr`;
        }
    });

    const totalDiff = itemsDiff + currentManualAdjustment;
    if (itemsDiffEl) itemsDiffEl.textContent = `${itemsDiff.toFixed(2).replace('.', ',')} kr`;
    if (manualDiffEl) manualDiffEl.textContent = `${currentManualAdjustment.toFixed(2).replace('.', ',')} kr`;
    if (totalDiffEl) totalDiffEl.textContent = `${totalDiff.toFixed(2).replace('.', ',')} kr`;
}

function buildSalesHistorySummaryHTML(preFilteredData, filteredEvents) {
    const totalRevenue = filteredEvents
        .filter(e => e.event_type === 'SALE')
        .reduce((sum, sale) => sum + getEventAmount(sale), 0);

    const totalDeposits = filteredEvents
        .filter(e => e.event_type === 'DEPOSIT')
        .reduce((sum, deposit) => sum + safeNumber(deposit.details?.amount), 0);

    const productSummaryData = {};
    filteredEvents.forEach(sale => {
        if (sale.event_type === 'SALE' && sale.items) {
            (sale.items || []).forEach(item => {
                productSummaryData[item.product_name] = productSummaryData[item.product_name] || { count: 0, total: 0, emoji: item.emoji };
                productSummaryData[item.product_name].count += item.quantity;
                productSummaryData[item.product_name].total += item.quantity * safeNumber(item.price_at_purchase);
            });
        }
    });

    let summaryHTML = `
        <h3>Oversigt for den viste periode</h3>
        ${totalRevenue > 0 ? `<p><strong>Total Omsætning (salg):</strong> ${totalRevenue.toFixed(2)} kr.</p>` : ''}
        ${totalDeposits > 0 ? `<p><strong>Total Indbetalinger:</strong> ${totalDeposits.toFixed(2)} kr.</p>` : ''}
        `;

    // Tilføj nye stilarter for carousel-funktionaliteten
    const chartStyles = `
        <style>
            .chart-carousel {
                display: flex;
                flex-direction: column;
            }
            .chart-controls {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }
            .chart-arrow-btn {
                background: none; border: none; font-size: 24px; cursor: pointer; padding: 0 8px;
            }
            .chart-panel { display: none; }
            .chart-panel.active { display: block; }
            .summary-chart-container {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 16px;
            }
            .pie-chart {
                width: 150px;
                height: 150px;
                border-radius: 50%;
                border: 1px solid #eee;
                box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            }
            .pie-chart-legend {
                list-style: none;
                padding: 0;
                margin: 0;
                font-size: 12px;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .pie-chart-legend li {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .legend-color {
                display: inline-block;
                width: 12px;
                height: 12px;
                border-radius: 3px;
            }
        </style>
    `;

    // Forbered data til cirkeldiagram
    if (Object.keys(productSummaryData).length > 0) {
        // totalRevenueForChart bruges KUN til diagrammet, så procentfordelingen matcher de viste varer i tabellen.
        // Den oprindelige totalRevenue bruges stadig til den overordnede tekst-oversigt.
        const totalRevenueForChart = Object.values(productSummaryData).reduce((sum, data) => sum + data.total, 0);
        const totalCount = Object.values(productSummaryData).reduce((sum, data) => sum + data.count, 0);
        const chartColors = ['#4CAF50', '#FFC107', '#2196F3', '#F44336', '#9C27B0', '#FF9800', '#00BCD4', '#8BC34A'];

        const chartData = Object.entries(productSummaryData)
            .map(([productName, data]) => ({
                label: productName,
                revenuePercentage: totalRevenueForChart > 0 ? (data.total / totalRevenueForChart) * 100 : 0,
                countPercentage: totalCount > 0 ? (data.count / totalCount) * 100 : 0,
                total: data.total,
                count: data.count,
                emoji: data.emoji,
            }))
            .sort((a, b) => b.total - a.total)
            .map((item, index) => ({ ...item, color: chartColors[index % chartColors.length] }));

        const buildChartHTML = (data, type) => {
            const chartTitle = type === 'count' ? 'Antal solgte varer' : 'Omsætning (kr.)';
            const sortedData = type === 'count' ? [...data].sort((a, b) => b.count - a.count) : data;
            let currentAngle = 0;
            const gradientParts = sortedData.map(item => {
                const percentage = type === 'count' ? item.countPercentage : item.revenuePercentage;
                const startAngle = currentAngle;
                const endAngle = currentAngle + percentage;
                currentAngle = endAngle;
                const finalColor = percentage < 1 ? `${item.color}99` : item.color;
                return `${finalColor} ${startAngle}% ${endAngle}%`;
            });
            const legendItems = sortedData.map(item => {
                const percentage = type === 'count' ? item.countPercentage : item.revenuePercentage;
                return `<li><span class="legend-color" style="background-color: ${item.color};"></span>${item.label} (${percentage.toFixed(1)}%)</li>`;
            });

            return `
                <div class="summary-chart-container">
                    <h4 style="margin: 0 0 8px 0; text-align: center;">${chartTitle}</h4>
                    <div class="pie-chart" style="background: conic-gradient(${gradientParts.join(', ')});"></div>
                    <ul class="pie-chart-legend">${legendItems.join('')}</ul>
                </div>
            `;
        };

        const revenueChartHTML = buildChartHTML(chartData, 'revenue');
        const countChartHTML = buildChartHTML(chartData, 'count');

        summaryHTML += `
            ${chartStyles}
            <div class="summary-layout" style="display: flex; gap: 20px; margin-top: 16px;">
                <div class="summary-table-container" style="flex: 2; border-right: 1px solid #e0e0e0; padding-right: 20px;">
                    <table class="summary-table">
                        <thead>
                            <tr>
                                <th>Vare</th>
                                <th style="text-align: right;">Antal</th>
                                <th style="text-align: right;">Omsætning</th>
                            </tr>
                        </thead>
                        <tbody>`;

        chartData.forEach(item => {
            const iconInfo = getProductIconInfo({ name: item.label, emoji: item.emoji });
            let visualMarkup = '';
            if (iconInfo) {
                visualMarkup = `<img src="${iconInfo.path}" alt="${item.label}" class="product-icon-small" style="height: 1.1em; vertical-align: middle; margin-right: 4px;">`;
            } else if (item.emoji) {
                visualMarkup = `<span style="margin-right: 4px; display: inline-block; width: 1.2em; text-align: center;">${item.emoji}</span>`;
            }
            summaryHTML += `
                <tr>
                    <td style="display: flex; align-items: center;">${visualMarkup}${item.label}</td>
                    <td style="text-align: right;">${item.count}</td>
                    <td style="text-align: right;"><strong>${item.total.toFixed(2)} kr.</strong></td>
                </tr>`;
        });

        summaryHTML += `
                        </tbody>
                    </table>
                </div>
                <div class="chart-carousel" style="flex: 1;">
                    <div class="chart-controls">
                        <button id="chart-prev-btn" class="chart-arrow-btn">◀</button>
                        <span id="chart-mode-label" style="font-weight: 600;"></span>
                        <button id="chart-next-btn" class="chart-arrow-btn">▶</button>
                    </div>
                    <div id="revenue-chart-panel" class="chart-panel active">
                        ${revenueChartHTML}
                    </div>
                    <div id="count-chart-panel" class="chart-panel">
                        ${countChartHTML}
                    </div>
                </div>
            </div>
        `;
    }

    summaryHTML += '<hr>';
    return summaryHTML;
}

function handlePrintReport() {
    const salesHistoryModal = document.getElementById('sales-history-modal');
    if (!salesHistoryModal) return;
    const historyStartDate = salesHistoryModal.querySelector('#history-start-date');
    const historyEndDate = salesHistoryModal.querySelector('#history-end-date');
    const filterDepositsBtn = salesHistoryModal.querySelector('#filter-deposits-btn');
    const searchInput = document.getElementById('search-history-input');
    if (!historyStartDate || !historyEndDate || !filterDepositsBtn || !searchInput) return;

    const startDate = new Date(historyStartDate.value).toLocaleDateString('da-DK');
    const endDate = new Date(historyEndDate.value).toLocaleDateString('da-DK');
    const eventTypeFilter = filterDepositsBtn.classList.contains('active') ? 'DEPOSIT' : null;

    let preFilteredData = fullSalesHistory;
    if (eventTypeFilter === 'DEPOSIT') {
        preFilteredData = fullSalesHistory.filter(e => e.event_type === 'DEPOSIT' || e.event_type === 'BALANCE_EDIT');
    }

    const searchTerm = searchInput.value.toLowerCase();
    const filteredEvents = preFilteredData.filter(sale => {
        const targetName = (sale.target_user_name || '').toLowerCase();
        const adminName = (sale.admin_name || '').toLowerCase();
        const detailsString = JSON.stringify(sale.details).toLowerCase();
        return targetName.includes(searchTerm) || adminName.includes(searchTerm) || detailsString.includes(searchTerm);
    });

    if (filteredEvents.length === 0) return showAlert('Der er intet at printe.');

    const totalRevenue = filteredEvents.filter(e => e.event_type === 'SALE').reduce((sum, sale) => sum + getEventAmount(sale), 0);
    const totalDeposits = filteredEvents.filter(e => e.event_type === 'DEPOSIT').reduce((sum, deposit) => sum + safeNumber(deposit.details?.amount), 0);

    const productSummaryData = {};
    filteredEvents.forEach(event => {
        if (event.event_type === 'SALE' && event.items) {
            (event.items || []).forEach(item => {
                productSummaryData[item.product_name] = productSummaryData[item.product_name] || { count: 0, total: 0, emoji: item.emoji };
                productSummaryData[item.product_name].count += item.quantity;
                productSummaryData[item.product_name].total += item.quantity * safeNumber(item.price_at_purchase);
            });
        }
    });

    let transactionList = '\n--- Alle Transaktioner ---\n';
    filteredEvents.forEach(event => {
        const date = new Date(getEventTimestamp(event)).toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit' });
        const time = new Date(getEventTimestamp(event)).toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
        let description = '';

        const details = event.details || {};
        if (event.event_type === 'SALE') {
            const amount = getEventAmount(event);
            description = `Salg til ${event.target_user_name || 'Ukendt'} på ${amount.toFixed(2)} kr.`;
        } else if (event.event_type === 'DEPOSIT') {
            const amount = safeNumber(details.amount);
            description = `Indbetaling til ${event.target_user_name || 'Ukendt'} på ${amount.toFixed(2)} kr.`;
        } else if (event.event_type === 'BALANCE_EDIT') {
            const oldBalance = safeNumber(details.old_balance);
            const newBalance = safeNumber(details.new_balance);
            description = `Saldo for ${event.target_user_name || 'Ukendt'} redigeret fra ${oldBalance.toFixed(2)} til ${newBalance.toFixed(2)} kr.`;
        }

        transactionList += `\n${description}\n(${date} kl. ${time} af ${event.admin_name || 'Ukendt'})\n------------------------\n`;
    });

    let productSummary = '--- Salg pr. Vare ---\n';
    for (const [productName, data] of Object.entries(productSummaryData)) {
        productSummary += `${data.count} stk. - ${data.emoji || ''} ${productName} = ${data.total.toFixed(2)} kr.\n`;
    }
    let reportContent = `Rapport for perioden: ${startDate} - ${endDate}\n\n--- Opsummering ---\n`;
    if (totalRevenue > 0) reportContent += `Total Omsætning (salg): ${totalRevenue.toFixed(2)} kr.\n`;
    if (totalDeposits > 0) reportContent += `Total Indbetalinger: ${totalDeposits.toFixed(2)} kr.\n`;
    if (Object.keys(productSummaryData).length > 0) reportContent += `\n${productSummary}`;
    reportContent += `\n${transactionList}`;

    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `salgsrapport_${startDate}_til_${endDate}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function handlePrintAllBalances() {
    const allUsers = getAllUsersAccessor();
    if (!allUsers || allUsers.length === 0) {
        return showCustomAlert('Info', 'Der er ingen brugere at vise saldo for.');
    }

    const sortedUsers = [...allUsers].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    let reportContent = `Komplet Saldo-liste - ${new Date().toLocaleDateString('da-DK')}\n\n----------------------------------------\n`;
    sortedUsers.forEach(user => {
        const balance = safeNumber(user.balance);
        reportContent += `Navn:   ${user.name}\nNummer: ${user.number || 'N/A'}\nSaldo:  ${balance.toFixed(2)} DKK\n----------------------------------------\n`;
    });

    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `komplet_saldo_liste_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function handlePrintNegativeBalance() {
    const allUsers = getAllUsersAccessor();
    const negativeBalanceUsers = allUsers.filter(user => safeNumber(user.balance) < 0).sort((a, b) => safeNumber(a.balance) - safeNumber(b.balance));
    if (negativeBalanceUsers.length === 0) return showCustomAlert('Info', 'Godt arbejde! Ingen brugere har negativ saldo.');
    let reportContent = `Rapport over Negativ Saldo - ${new Date().toLocaleDateString('da-DK')}\n\n----------------------------------------\n`;
    negativeBalanceUsers.forEach(user => {
        const balance = safeNumber(user.balance);
        reportContent += `Navn:   ${user.name}\nNummer: ${user.number || 'N/A'}\nSaldo:  ${balance.toFixed(2)} DKK\n----------------------------------------\n`;
    });
    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `negativ_saldo_rapport_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Load transaction history in summary modal (Transaktioner view)
 * This function initializes and displays the transaction history within the summary modal
 */
export async function showTransactionsInSummary() {
    // Get all elements with -summary suffix
    const filterDepositsBtn = document.getElementById('filter-deposits-btn-summary');
    const printReportBtn = document.getElementById('print-report-btn-summary');
    const printNegativeBtn = document.getElementById('print-negative-balance-btn-summary');
    const searchInput = document.getElementById('search-history-input-summary');
    const historyStartDate = document.getElementById('history-start-date-summary');
    const historyEndDate = document.getElementById('history-end-date-summary');
    const printAllBalancesBtn = document.getElementById('print-all-balances-btn-summary');
    const undoLastSaleBtn = document.getElementById('history-undo-last-sale-btn-summary');
    const filterBtn = document.getElementById('history-filter-btn-summary');
    const filterPanel = document.getElementById('history-filter-panel-summary');
    const filterSelectAll = document.getElementById('history-filter-select-all-summary');
    const filterDeselectAll = document.getElementById('history-filter-deselect-all-summary');
    const filterCheckboxes = Array.from(document.querySelectorAll('.history-filter-checkbox-summary'));

    if (!filterDepositsBtn || !printReportBtn || !printNegativeBtn || !searchInput || !historyStartDate || !historyEndDate) {
        console.error('[history-and-reports] Missing required elements in summary modal');
        return;
    }

    // Setup filter deposits button
    filterDepositsBtn.onclick = () => {
        const isActive = filterDepositsBtn.classList.toggle('active');
        if (isActive) {
            filterDepositsBtn.textContent = 'Vis Alle Hændelser';
            renderSalesHistoryInSummary(fullSalesHistory, null, 'DEPOSIT');
        } else {
            filterDepositsBtn.textContent = 'Vis Kun Indbetalinger';
            renderSalesHistoryInSummary(fullSalesHistory);
        }
    };

    // Setup other buttons
    printReportBtn.onclick = handlePrintReport;
    printNegativeBtn.onclick = handlePrintNegativeBalance;
    if (printAllBalancesBtn) printAllBalancesBtn.onclick = handlePrintAllBalances;
    if (undoLastSaleBtn) {
        undoLastSaleBtn.onclick = () => {
            const handler = window.__flangoUndoLastSale;
            if (typeof handler === 'function') {
                handler();
            } else {
                showAlert('Fortryd funktion er ikke tilgængelig');
            }
        };
    }

    // Setup filter button
    if (filterBtn && filterPanel) {
        filterBtn.onclick = () => {
            const isVisible = filterPanel.style.display === 'block';
            filterPanel.style.display = isVisible ? 'none' : 'block';
        };
    }

    // Setup filter select/deselect all
    if (filterSelectAll) {
        filterSelectAll.onclick = () => {
            filterCheckboxes.forEach(cb => cb.checked = true);
            fetchHistoryInSummary();
        };
    }

    if (filterDeselectAll) {
        filterDeselectAll.onclick = () => {
            filterCheckboxes.forEach(cb => cb.checked = false);
            fetchHistoryInSummary();
        };
    }

    // Setup filter checkboxes
    filterCheckboxes.forEach(cb => {
        cb.onchange = () => fetchHistoryInSummary();
    });

    // Setup search input
    searchInput.oninput = () => {
        const isActive = filterDepositsBtn.classList.contains('active');
        if (isActive) {
            renderSalesHistoryInSummary(fullSalesHistory, searchInput.value, 'DEPOSIT');
        } else {
            renderSalesHistoryInSummary(fullSalesHistory, searchInput.value);
        }
    };

    // Find or create the test users checkbox
    let showTestUsersCheckbox = document.getElementById('show-test-users-checkbox-summary');
    if (!showTestUsersCheckbox) {
        if (filterPanel) {
            // Create checkbox container
            const checkboxContainer = document.createElement('div');
            checkboxContainer.style.marginTop = '16px';
            checkboxContainer.style.paddingTop = '16px';
            checkboxContainer.style.borderTop = '1px solid var(--border-color, #e0e0e0)';
            checkboxContainer.innerHTML = `
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px;">
                    <input type="checkbox" id="show-test-users-checkbox-summary" style="cursor: pointer;">
                    <span>Vis testbrugere (Snoop Dog, Test Aladin)</span>
                </label>
            `;
            filterPanel.appendChild(checkboxContainer);

            // Get reference after creation
            showTestUsersCheckbox = document.getElementById('show-test-users-checkbox-summary');
        }
    }

    // Wire up event listener to refetch history when toggled
    if (showTestUsersCheckbox) {
        showTestUsersCheckbox.onchange = fetchHistoryInSummary;
    }

    // Setup date inputs
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    historyStartDate.value = thirtyDaysAgo;
    historyEndDate.value = today;
    historyStartDate.onchange = fetchHistoryInSummary;
    historyEndDate.onchange = fetchHistoryInSummary;

    // Load initial data
    await fetchHistoryInSummary();
    filterDepositsBtn.classList.remove('active');
    filterDepositsBtn.textContent = 'Vis Kun Indbetalinger';
}

/**
 * Fetch history data for summary modal transactions view
 */
async function fetchHistoryInSummary() {
    const searchInput = document.getElementById('search-history-input-summary');
    const historyStartDate = document.getElementById('history-start-date-summary');
    const historyEndDate = document.getElementById('history-end-date-summary');
    const testUsersCheckbox = document.getElementById('show-test-users-checkbox-summary');
    const filterCheckboxes = Array.from(document.querySelectorAll('.history-filter-checkbox-summary'));

    if (!searchInput || !historyStartDate || !historyEndDate) return;

    searchInput.value = '';
    const startDateStr = historyStartDate.value;
    const endDateStr = historyEndDate.value;
    const includeTestUsers = testUsersCheckbox ? testUsersCheckbox.checked : false;  // Default false
    const selectedEventTypes = filterCheckboxes.filter(cb => cb.checked).map(cb => cb.value);

    // Load history from database
    const { rows, error } = await loadSalesHistory({
        from: startDateStr,
        to: endDateStr,
        includeTestUsers
    });

    if (error) {
        console.error('[history-and-reports] Error fetching history in summary:', error);
        fullSalesHistory = [];
        renderSalesHistoryInSummary(fullSalesHistory);
        showAlert('Fejl ved hentning af historik');
        return;
    }

    // Filter by event types client-side
    fullSalesHistory = rows.filter(event => selectedEventTypes.includes(event.event_type));

    renderSalesHistoryInSummary(fullSalesHistory);
}

/**
 * Render sales history in summary modal
 */
function renderSalesHistoryInSummary(history, searchQuery = null, eventTypeFilter = null) {
    const salesHistoryList = document.getElementById('sales-history-list-summary');
    const salesSummary = document.getElementById('sales-summary-summary');
    const searchInput = document.getElementById('search-history-input-summary');

    if (!salesHistoryList || !salesSummary) {
        console.error('[history-and-reports] Missing required summary elements');
        return;
    }

    const searchTerm = searchQuery || (searchInput ? searchInput.value.toLowerCase() : '');

    // Apply pre-filter for event types
    let preFilteredData = history;
    if (eventTypeFilter === 'DEPOSIT') {
        preFilteredData = history.filter(e => e.event_type === 'DEPOSIT' || e.event_type === 'BALANCE_EDIT');
    } else if (eventTypeFilter) {
        preFilteredData = history.filter(e => e.event_type === eventTypeFilter);
    } else {
        // Apply checkbox-based filter
        const filterCheckboxes = Array.from(document.querySelectorAll('.history-filter-checkbox-summary'));
        if (filterCheckboxes.length > 0) {
            const checkedEventTypes = filterCheckboxes
                .filter(cb => cb.checked)
                .map(cb => cb.value);

            if (checkedEventTypes.length === 0) {
                preFilteredData = [];
            } else if (checkedEventTypes.length < filterCheckboxes.length) {
                preFilteredData = history.filter(e => {
                    const eventType = e.event_type;
                    if (eventType === 'BALANCE_EDIT') return checkedEventTypes.includes('BALANCE_ADJUSTMENT');
                    if (eventType === 'SALE_ADJUSTMENT') return checkedEventTypes.includes('SALE_EDIT');
                    return checkedEventTypes.includes(eventType);
                });
            }
        }
    }

    // Apply search filter
    const filteredEvents = preFilteredData.filter(sale => {
        const targetName = (sale.target_user_name || '').toLowerCase();
        const adminName = (sale.admin_name || '').toLowerCase();
        const detailsString = JSON.stringify(sale.details).toLowerCase();
        return targetName.includes(searchTerm) || adminName.includes(searchTerm) || detailsString.includes(searchTerm);
    });

    if (filteredEvents.length === 0) {
        const message = searchTerm ? 'Ingen salg matcher din søgning.' : 'Der er ingen salg i den valgte periode.';
        salesHistoryList.innerHTML = `<p style="text-align:center; padding: 20px;">${message}</p>`;
        salesSummary.replaceChildren();
        return;
    }

    // Inject CSS for history row layout (same as original)
    if (!document.getElementById('history-row-styles')) {
        const style = document.createElement('style');
        style.id = 'history-row-styles';
        style.textContent = `
            .history-row {
                display: grid;
                grid-template-columns: 1.4fr 1.4fr 0.8fr 1fr 1.1fr 1.1fr 0.6fr;
                align-items: center;
                gap: 10px;
                padding: 10px 12px;
                border-bottom: 1px solid #eee;
                transition: background-color 0.15s ease-out;
            }
            .history-row:hover {
                background-color: #fafafa;
            }
            .history-row > div { font-size: 14px; overflow: hidden; text-overflow: ellipsis; }
            .history-primary {
                font-weight: 500;
                margin-bottom: 2px;
            }
            .history-secondary {
                font-size: 12px;
                color: #666;
            }
            .history-edit-btn {
                padding: 6px 10px;
                border-radius: 6px;
                background-color: #efefef;
                border: 1px solid #ccc;
                cursor: pointer;
                font-size: 13px;
                white-space: nowrap;
                transition: background-color 0.2s;
            }
            .history-edit-btn:hover { background-color: #e4e4e4; }
        `;
        document.head.appendChild(style);
    }

    if (filteredEvents.length > 0) {
        // Build summary HTML with charts (same as original)
        const summaryHTML = buildSalesHistorySummaryHTML(preFilteredData, filteredEvents);
        salesSummary.innerHTML = summaryHTML;

        // Initialize chart carousel after setting HTML
        initHistoryChartCarousel(salesSummary);

        // Render transaction list
        salesHistoryList.replaceChildren();

        // Group adjustments by sale ID
        const adjustmentsBySaleId = new Map();
        filteredEvents.forEach(ev => {
            if (ev.event_type === 'SALE_ADJUSTMENT' && ev.details?.adjusted_sale_id) {
                const saleId = ev.details.adjusted_sale_id;
                const list = adjustmentsBySaleId.get(saleId) || [];
                list.push(ev);
                adjustmentsBySaleId.set(saleId, list);
            }
        });

        // Render each event with full detail columns
        filteredEvents.forEach(event => {
            const adjustedSaleId = event.details?.adjusted_sale_id;
            const isChildAdjustment = event.event_type === 'SALE_ADJUSTMENT' && adjustedSaleId;
            if (isChildAdjustment) return;

            const entryEl = buildSalesHistoryEntryElement(event);
            salesHistoryList.appendChild(entryEl);

            const eventId = event.id || event.event_id || null;
            if (event.event_type === 'SALE' && eventId) {
                const children = adjustmentsBySaleId.get(eventId) || [];
                children.forEach(adjEvent => {
                    const childEl = buildSalesHistoryEntryElement(adjEvent, { isAdjustmentChild: true });
                    salesHistoryList.appendChild(childEl);
                });
            }
        });
    } else {
        salesSummary.replaceChildren();
        const message = searchTerm ? 'Ingen salg matcher din søgning.' : 'Der er ingen salg i den valgte periode.';
        salesHistoryList.innerHTML = `<p style="text-align:center; padding: 20px;">${message}</p>`;
    }
}
