// UI-modul: Event Admin (Arrangementer)
// Tre views i én modal: event-liste, event-detalje, opret/rediger form.

import { escapeHtml } from '../core/escape-html.js';
import { showAlert, showCustomAlert } from './sound-and-alerts.js';
import { showConfirmModal } from './confirm-modals.js';
import {
    fetchEvents,
    fetchEventDetail,
    createEvent,
    updateEvent,
    registerUserForEvent,
    cancelRegistration,
    cancelEventWithRefunds,
    payRegistration,
    checkClassMatch,
    fetchInstitutionBalanceLimit,
    splitDatetimeLocal,
    joinDatetimeLocal,
    formatEventDate,
    formatTime,
} from '../domain/event-management.js';

/**
 * Setup function — kaldt én gang fra admin-flow.js.
 */
export function setupEventAdminModule(config) {
    const { adminProfile, institutionId } = config;

    // DOM references
    const modal = document.getElementById('event-admin-modal');
    if (!modal) return;

    const closeBtn = modal.querySelector('.close-btn');
    const modalTitleEl = modal.querySelector('#event-admin-title');
    const backBtn = modal.querySelector('#event-admin-back-btn');
    const listView = modal.querySelector('#event-list-view');
    const detailView = modal.querySelector('#event-detail-view');
    const formView = modal.querySelector('#event-form-view');

    // List view elements
    const filterBar = modal.querySelector('.event-filter-bar');
    const listContainer = modal.querySelector('#event-list-container');
    const listEmpty = modal.querySelector('#event-list-empty');
    const createBtn = modal.querySelector('#event-create-btn');

    // Detail view elements
    const detailHeader = modal.querySelector('#event-detail-header');
    const detailSummary = modal.querySelector('#event-detail-summary');
    const detailActions = modal.querySelector('#event-detail-actions');
    const regList = modal.querySelector('#event-reg-list');

    // Form view elements
    const formSubtitle = modal.querySelector('#event-form-subtitle');
    const formTitle = modal.querySelector('#event-form-title');
    const formDescription = modal.querySelector('#event-form-description');
    const formPrice = modal.querySelector('#event-form-price');
    const formCapacity = modal.querySelector('#event-form-capacity');
    const formStart = modal.querySelector('#event-form-start');
    const formEnd = modal.querySelector('#event-form-end');
    const formClassesContainer = modal.querySelector('#event-form-classes');
    const formSaveBtn = modal.querySelector('#event-form-save-btn');
    const formCancelBtn = modal.querySelector('#event-form-cancel-btn');

    // State
    let currentFilter = 'active';
    let currentEvents = [];
    let currentEventId = null;      // Event being viewed in detail
    let currentEvent = null;        // Full event object (for modal title)
    let editingEventId = null;       // Event being edited (null = creating new)
    let formReturnView = 'list';     // 'list' or 'detail' — where to go back from form
    let currentView = 'list';

    // Registration table sort state
    let regSortColumn = 'name';
    let regSortDirection = 'asc';
    let currentRegs = [];
    let currentRegEvent = null;

    // ========================================================================
    // Populate class checkboxes (once)
    // ========================================================================
    if (formClassesContainer) {
        formClassesContainer.innerHTML = '';
        for (let i = 0; i <= 9; i++) {
            const label = document.createElement('label');
            label.className = 'event-class-checkbox';
            label.innerHTML = `<input type="checkbox" value="${i}"> ${i}. kl.`;
            formClassesContainer.appendChild(label);
        }
    }

    // ========================================================================
    // View switching
    // ========================================================================
    function updateModalHeader() {
        if (currentView === 'list') {
            modalTitleEl.textContent = 'Arrangementer';
            backBtn.classList.add('event-admin-back-hidden');
        } else if (currentView === 'detail') {
            const t = currentEvent?.title;
            modalTitleEl.textContent = (t != null && t !== '') ? t : (currentEvent ? 'Arrangement' : 'Indlæser…');
            backBtn.classList.remove('event-admin-back-hidden');
        } else if (currentView === 'form') {
            modalTitleEl.textContent = formSubtitle?.textContent ?? 'Arrangement';
            backBtn.classList.remove('event-admin-back-hidden');
        }
    }

    function showView(view) {
        currentView = view;
        listView.style.display = view === 'list' ? 'flex' : 'none';
        detailView.style.display = view === 'detail' ? 'flex' : 'none';
        formView.style.display = view === 'form' ? 'flex' : 'none';
        updateModalHeader();
    }

    // ========================================================================
    // Open modal
    // ========================================================================
    function openEventAdmin() {
        currentFilter = 'active';
        currentView = 'list';
        currentEvent = null;
        showView('list');
        updateFilterButtons();
        loadEventList();
        modal.style.display = 'flex';
    }

    // ========================================================================
    // Close modal
    // ========================================================================
    function closeModal() {
        modal.style.display = 'none';
    }

    closeBtn.addEventListener('click', closeModal);

    // ========================================================================
    // Filter buttons
    // ========================================================================
    function updateFilterButtons() {
        const buttons = filterBar.querySelectorAll('.event-filter-btn');
        buttons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === currentFilter);
        });
    }

    filterBar.addEventListener('click', (e) => {
        const btn = e.target.closest('.event-filter-btn');
        if (!btn || !btn.dataset.filter) return;
        currentFilter = btn.dataset.filter;
        updateFilterButtons();
        loadEventList();
    });

    // ========================================================================
    // Load & render event list
    // ========================================================================
    async function loadEventList() {
        listContainer.innerHTML = '<p style="text-align:center;color:#999;padding:20px;">Indlæser...</p>';
        listEmpty.style.display = 'none';

        const { events, error } = await fetchEvents(institutionId, currentFilter);
        if (error) {
            listContainer.innerHTML = '';
            listEmpty.style.display = 'block';
            listEmpty.querySelector('p').textContent = 'Fejl: ' + error;
            return;
        }

        currentEvents = events;
        renderEventList();
    }

    function renderEventList() {
        listContainer.innerHTML = '';

        if (currentEvents.length === 0) {
            listEmpty.style.display = 'block';
            listEmpty.querySelector('p').textContent = currentFilter === 'active'
                ? 'Ingen kommende arrangementer.'
                : currentFilter === 'past'
                    ? 'Ingen afsluttede arrangementer.'
                    : 'Ingen aflyste arrangementer.';
            return;
        }
        listEmpty.style.display = 'none';

        const fragment = document.createDocumentFragment();
        currentEvents.forEach(event => {
            const item = document.createElement('div');
            item.className = 'event-list-item';
            item.dataset.eventId = event.id;

            const capacityText = event.capacity ? `${event._registeredCount}/${event.capacity}` : `${event._registeredCount}`;
            const priceText = parseFloat(event.price) > 0 ? `${parseFloat(event.price).toFixed(2)} kr.` : 'Gratis';

            const today = new Date().toISOString().split('T')[0];
            let statusClass = 'upcoming';
            let statusLabel = 'Kommende';
            if (event.status === 'cancelled') {
                statusClass = 'cancelled';
                statusLabel = 'Aflyst';
            } else if (event.event_date < today || event.status === 'archived') {
                statusClass = 'past';
                statusLabel = 'Afsluttet';
            }

            item.innerHTML = `
                <div class="event-list-item-info">
                    <div class="event-list-item-title">${escapeHtml(event.title)}</div>
                    <div class="event-list-item-meta">${formatEventDate(event.event_date)} kl. ${formatTime(event.start_time)} &middot; ${priceText}</div>
                </div>
                <div class="event-list-item-stats">
                    <div class="event-reg-count">${capacityText} tilmeldt</div>
                    <span class="event-status-badge ${statusClass}">${statusLabel}</span>
                </div>`;
            fragment.appendChild(item);
        });
        listContainer.appendChild(fragment);
    }

    // Click on event list item → open detail
    listContainer.addEventListener('click', (e) => {
        const item = e.target.closest('.event-list-item');
        if (!item) return;
        openEventDetail(item.dataset.eventId);
    });

    // ========================================================================
    // Event detail view
    // ========================================================================
    async function openEventDetail(eventId) {
        currentEventId = eventId;
        showView('detail');

        detailHeader.innerHTML = '<p style="color:#999;">Indlæser...</p>';
        detailSummary.innerHTML = '';
        detailActions.innerHTML = '';
        regList.innerHTML = '';

        const { event, registrations, error } = await fetchEventDetail(eventId);
        if (error || !event) {
            detailHeader.innerHTML = `<p style="color:#e74c3c;">Fejl: ${error || 'Arrangement ikke fundet'}</p>`;
            currentEvent = null;
            updateModalHeader();
            return;
        }

        currentEvent = event;
        modalTitleEl.textContent = event.title != null && event.title !== '' ? event.title : 'Arrangement';
        renderEventDetail(event, registrations);
        updateModalHeader();
    }

    function renderEventDetail(event, registrations) {
        const today = new Date().toISOString().split('T')[0];
        const priceText = parseFloat(event.price) > 0 ? `${parseFloat(event.price).toFixed(2)} kr.` : 'Gratis';
        const timeRange = event.end_time
            ? `${formatTime(event.start_time)} – ${formatTime(event.end_time)}`
            : `${formatTime(event.start_time)}`;
        const classText = event.allowed_classes && event.allowed_classes.length > 0
            ? event.allowed_classes.map(c => c + '. kl.').join(', ')
            : 'Alle klasser';

        const dateLabel = formatEventDate(event.event_date);

        // Beregn dage til start
        const eventDateObj = new Date(event.event_date + 'T00:00:00');
        const todayObj = new Date(today + 'T00:00:00');
        const diffMs = eventDateObj - todayObj;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        let daysLabel;
        if (diffDays < 0) daysLabel = 'Afsluttet';
        else if (diffDays === 0) daysLabel = 'I dag';
        else if (diffDays === 1) daysLabel = '1 dag';
        else daysLabel = `${diffDays} dage`;

        detailHeader.innerHTML = `
            ${event.description ? `<div class="event-description">${escapeHtml(event.description)}</div>` : ''}
            <div class="event-meta-badges">
                <span class="event-meta-badge">
                    <span class="event-meta-badge-label">Dato</span>
                    <span class="event-meta-badge-value">${escapeHtml(dateLabel)}</span>
                </span>
                <span class="event-meta-badge">
                    <span class="event-meta-badge-label">Tidspunkt</span>
                    <span class="event-meta-badge-value">${escapeHtml(timeRange)}</span>
                </span>
                <span class="event-meta-badge">
                    <span class="event-meta-badge-label">Dage til start</span>
                    <span class="event-meta-badge-value">${escapeHtml(daysLabel)}</span>
                </span>
                <span class="event-meta-badge">
                    <span class="event-meta-badge-label">Klasser</span>
                    <span class="event-meta-badge-value">${escapeHtml(classText)}</span>
                </span>
                <span class="event-meta-badge">
                    <span class="event-meta-badge-label">Pris</span>
                    <span class="event-meta-badge-value">${escapeHtml(priceText)}</span>
                </span>
            </div>`;

        // Summary cards
        const activeRegs = registrations.filter(r => r.registration_status === 'registered');
        const paidCount = activeRegs.filter(r => r.payment_status === 'paid').length;
        const notPaidCount = activeRegs.filter(r => r.payment_status === 'not_paid').length;
        const totalPaidAmount = activeRegs
            .filter(r => r.payment_status === 'paid')
            .reduce((sum, r) => sum + parseFloat(r.price_at_signup || 0), 0);

        detailSummary.innerHTML = `
            <div class="event-summary-card">
                <div class="summary-label">Tilmeldte</div>
                <div class="summary-value">${activeRegs.length}${event.capacity ? ' / ' + event.capacity : ''}</div>
            </div>
            <div class="event-summary-card">
                <div class="summary-label">Betalt</div>
                <div class="summary-value">${paidCount} / ${activeRegs.length}</div>
                ${totalPaidAmount > 0 ? `<div class="summary-sub">${totalPaidAmount.toFixed(2)} kr.</div>` : ''}
            </div>
            ${notPaidCount > 0 ? `<div class="event-summary-card">
                <div class="summary-label">Afventer betaling</div>
                <div class="summary-value">${notPaidCount}</div>
            </div>` : ''}`;

        // Action buttons
        const isActive = event.status === 'active' && event.event_date >= today;
        detailActions.innerHTML = '';
        if (isActive) {
            detailActions.innerHTML = `
                <button class="event-action-btn primary" data-action="register">Tilmeld Bruger</button>
                <button class="event-action-btn secondary" data-action="edit">Rediger</button>
                <button class="event-action-btn danger" data-action="cancel">Aflys Arrangement</button>`;
        } else if (event.status === 'active') {
            // Past but not cancelled
            detailActions.innerHTML = `
                <button class="event-action-btn secondary" data-action="edit">Rediger</button>`;
        }

        // Registration list
        renderRegistrationList(registrations, event);
    }

    function renderRegistrationList(registrations, event) {
        currentRegs = registrations;
        currentRegEvent = event;
        renderRegTable();
    }

    const PAYMENT_SORT_ORDER = { paid: 0, not_paid: 1, not_required: 2, refunded: 3 };

    function sortRegistrations(registrations) {
        const sorted = [...registrations];
        const dir = regSortDirection === 'asc' ? 1 : -1;
        sorted.sort((a, b) => {
            const ua = a.users || {};
            const ub = b.users || {};
            switch (regSortColumn) {
                case 'name': return dir * (ua.name || '').localeCompare(ub.name || '');
                case 'number': return dir * (ua.number || '').localeCompare(ub.number || '');
                case 'grade': {
                    const ga = ua.grade_level != null ? ua.grade_level : 999;
                    const gb = ub.grade_level != null ? ub.grade_level : 999;
                    return dir * (ga - gb);
                }
                case 'balance': return dir * ((ua.balance || 0) - (ub.balance || 0));
                case 'payment': {
                    const pa = PAYMENT_SORT_ORDER[a.payment_status] ?? 99;
                    const pb = PAYMENT_SORT_ORDER[b.payment_status] ?? 99;
                    return dir * (pa - pb);
                }
                default: return 0;
            }
        });
        return sorted;
    }

    function updateRegSortIndicators() {
        const headers = regList.querySelectorAll('.event-reg-sortable');
        headers.forEach(th => {
            const indicator = th.querySelector('.sort-indicator');
            if (!indicator) return;
            indicator.textContent = th.dataset.sort === regSortColumn
                ? (regSortDirection === 'asc' ? ' ▲' : ' ▼')
                : '';
        });
    }

    function renderRegTable() {
        regList.innerHTML = '';

        if (currentRegs.length === 0) {
            regList.innerHTML = '<p style="color:#999;text-align:center;padding:16px;">Ingen tilmeldinger endnu.</p>';
            return;
        }

        const event = currentRegEvent;
        const today = new Date().toISOString().split('T')[0];
        const isUpcoming = event.status === 'active' && event.event_date >= today;
        const sorted = sortRegistrations(currentRegs);

        const table = document.createElement('table');
        table.className = 'event-reg-table';

        const thead = document.createElement('thead');
        thead.innerHTML = `<tr>
            <th class="event-reg-sortable" data-sort="name" style="width:26%">Navn <span class="sort-indicator"></span></th>
            <th class="event-reg-sortable" data-sort="number" style="width:7%">Nr. <span class="sort-indicator"></span></th>
            <th class="event-reg-sortable" data-sort="grade" style="width:7%">Kl. <span class="sort-indicator"></span></th>
            <th class="event-reg-sortable" data-sort="balance" style="width:11%">Saldo <span class="sort-indicator"></span></th>
            <th class="event-reg-sortable" data-sort="payment" style="width:10%">Betaling <span class="sort-indicator"></span></th>
            <th style="width:32%">Handlinger</th>
            <th class="event-reg-unregister-col" style="width:7%"></th>
        </tr>`;
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        sorted.forEach(reg => {
            const user = reg.users || {};
            const isActive = reg.registration_status === 'registered';
            const tr = document.createElement('tr');
            if (!isActive) tr.className = 'reg-cancelled';

            const gradeTxt = user.grade_level !== null && user.grade_level !== undefined
                ? user.grade_level + '. kl.' : '—';
            const balanceTxt = typeof user.balance === 'number'
                ? user.balance.toFixed(2) + ' kr.' : '—';

            const paymentLabels = {
                not_required: 'Gratis',
                not_paid: 'Afventer',
                paid: 'Betalt',
                refunded: 'Refunderet',
            };
            const payLabel = paymentLabels[reg.payment_status] || reg.payment_status;

            const showPayBtns = isActive && reg.payment_status === 'not_paid';
            const showPayBtnsDisabled = isActive && reg.payment_status === 'paid';
            const price = parseFloat(reg.price_at_signup || 0);
            const userBalance = typeof user.balance === 'number' ? user.balance : 0;

            let actionsHtml = '';
            if (!isActive) {
                actionsHtml += '<span class="event-reg-status-badge cancelled">Frameldt</span>';
            }
            if (showPayBtns) {
                actionsHtml += `<button class="event-reg-pay-btn manual" title="Registrer Betaling" data-reg-id="${reg.id}" data-user-name="${escapeHtml(user.name || '')}" data-price="${price}" data-event-id="${event.id}">Registrer Betaling</button>`;
                actionsHtml += `<button class="event-reg-pay-btn balance" title="Betal med saldo" data-reg-id="${reg.id}" data-user-name="${escapeHtml(user.name || '')}" data-price="${price}" data-user-balance="${userBalance}" data-user-role="${escapeHtml(user.role || '')}" data-user-is-test-user="${user.is_test_user === true ? '1' : '0'}" data-event-id="${event.id}">Betal</button>`;
            } else if (showPayBtnsDisabled) {
                actionsHtml += `<button type="button" class="event-reg-pay-btn manual disabled" disabled title="Registrer Betaling">Registrer Betaling</button>`;
                actionsHtml += `<button type="button" class="event-reg-pay-btn balance disabled" disabled title="Betal">Betal</button>`;
            }

            let unregisterHtml = '';
            if (isActive && isUpcoming) {
                unregisterHtml = `<button type="button" class="event-reg-cancel-btn" title="Frameld" data-event-id="${event.id}" data-user-id="${user.id}" data-user-name="${escapeHtml(user.name || '')}" aria-label="Frameld">&times;</button>`;
            }

            tr.innerHTML = `
                <td class="reg-name">${escapeHtml(user.name || '—')}</td>
                <td class="reg-number">${escapeHtml(user.number || '—')}</td>
                <td class="reg-grade">${gradeTxt}</td>
                <td class="reg-balance">${balanceTxt}</td>
                <td><span class="event-payment-badge ${reg.payment_status}">${payLabel}</span></td>
                <td class="reg-actions"><span class="event-reg-actions-inner">${actionsHtml}</span></td>
                <td class="reg-unregister">${unregisterHtml}</td>`;
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        regList.appendChild(table);
        updateRegSortIndicators();
    }

    // Shared back button (header)
    function goBack() {
        if (currentView === 'form') {
            if (formReturnView === 'detail' && currentEventId) {
                showView('detail');
                openEventDetail(currentEventId);
            } else {
                showView('list');
                loadEventList();
            }
        } else if (currentView === 'detail') {
            currentEventId = null;
            currentEvent = null;
            showView('list');
            loadEventList();
        }
    }

    backBtn.addEventListener('click', goBack);

    // Detail view: action buttons (register, edit, cancel)
    detailActions.addEventListener('click', async (e) => {
        const btn = e.target.closest('.event-action-btn');
        if (!btn) return;

        const action = btn.dataset.action;
        if (action === 'register') {
            await handleRegisterUser();
        } else if (action === 'edit') {
            openEventForm(currentEventId);
        } else if (action === 'cancel') {
            await handleCancelEvent();
        }
    });

    // Detail view: cancel registration buttons
    regList.addEventListener('click', async (e) => {
        const btn = e.target.closest('.event-reg-cancel-btn');
        if (!btn) return;

        const eventId = btn.dataset.eventId;
        const userId = btn.dataset.userId;
        const userName = btn.dataset.userName;

        const confirmed = await showConfirmModal({
            title: 'Frameld bruger',
            message: `Er du sikker på, at du vil framelde ${userName || 'denne bruger'}? Hvis brugeren har betalt, refunderes beløbet automatisk til saldoen.`,
            confirmText: 'Frameld',
            cancelText: 'Annuller',
        });

        if (!confirmed) return;

        const result = await cancelRegistration(eventId, userId);
        if (!result.success) {
            showAlert(result.error || 'Kunne ikke framelde bruger.');
            return;
        }

        const refundMsg = result.refunded
            ? ` (${parseFloat(result.refund_amount).toFixed(2)} kr. refunderet til saldo)`
            : '';
        showCustomAlert('Frameldt', `Bruger frameldt${refundMsg}.`);
        openEventDetail(eventId); // Refresh
    });

    // Detail view: payment buttons (Registrer Betaling / Betal med saldo)
    regList.addEventListener('click', async (e) => {
        const btn = e.target.closest('.event-reg-pay-btn');
        if (!btn) return;
        if (btn.disabled || btn.classList.contains('disabled')) return;

        const regId = btn.dataset.regId;
        const userName = btn.dataset.userName;
        const price = parseFloat(btn.dataset.price);
        const eventId = btn.dataset.eventId;
        const isManual = btn.classList.contains('manual');

        if (isManual) {
            // "Registrer Betaling" — manual/kontant betaling
            const confirmed = await showConfirmModal({
                title: 'Registrer betaling',
                message: `Er du sikker på, at ${userName} har betalt ${price.toFixed(2)} kr.?`,
                confirmText: 'Registrer som betalt',
                cancelText: 'Annuller',
            });
            if (!confirmed) return;

            const result = await payRegistration(regId, 'manual');
            if (!result.success) {
                showAlert(result.error || 'Kunne ikke registrere betaling.');
                return;
            }
            showCustomAlert('Betalt', `Betaling registreret for ${userName}.`);
            openEventDetail(eventId);
        } else {
            // "Betal med saldo" — træk fra cafékonto (respekter institutions saldogrænse + undtagelser)
            const userBalance = parseFloat(btn.dataset.userBalance);
            const userRole = btn.dataset.userRole || '';
            const isTestUser = btn.dataset.userIsTestUser === '1';

            const settings = await fetchInstitutionBalanceLimit(institutionId);
            const balanceLimitEnabled = settings?.balance_limit_enabled !== false;
            if (balanceLimitEnabled && settings) {
                const isAdmin = userRole === 'admin';
                const isExempt = (isAdmin && settings.balance_limit_exempt_admins) ||
                    (isTestUser && settings.balance_limit_exempt_test_users);
                if (!isExempt) {
                    const balanceLimit = settings.balance_limit_amount ?? -10;
                    const newBalance = userBalance - price;
                    if (newBalance < balanceLimit) {
                        const available = userBalance - balanceLimit;
                        showAlert(`${userName} har ikke nok saldo til dette køb. Tilgængeligt: ${available.toFixed(2)} kr. (grænse ${balanceLimit} kr.). Pris: ${price.toFixed(2)} kr.`);
                        return;
                    }
                }
            } else if (userBalance < price) {
                showAlert(`${userName} har ikke nok saldo. Saldo: ${userBalance.toFixed(2)} kr., pris: ${price.toFixed(2)} kr.`);
                return;
            }

            const remaining = userBalance - price;
            const confirmed = await showConfirmModal({
                title: 'Betal med cafékonto',
                message: `${userName} betaler ${price.toFixed(2)} kr. for tilmelding.\nDer vil efter betaling være ${remaining.toFixed(2)} kr. tilbage på saldoen.`,
                confirmText: 'Tilmeld og Betal',
                cancelText: 'Annuller',
            });
            if (!confirmed) return;

            const result = await payRegistration(regId, 'balance');
            if (!result.success) {
                showAlert(result.error || 'Kunne ikke gennemføre betaling.');
                return;
            }
            showCustomAlert('Betalt', `${userName} har betalt ${price.toFixed(2)} kr. fra saldo.`);
            openEventDetail(eventId);
        }
    });

    // Registration list: sort header clicks
    regList.addEventListener('click', (e) => {
        const th = e.target.closest('.event-reg-sortable');
        if (!th) return;
        const col = th.dataset.sort;
        if (regSortColumn === col) {
            regSortDirection = regSortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            regSortColumn = col;
            regSortDirection = 'asc';
        }
        renderRegTable();
    });

    // ========================================================================
    // Register user flow (reuses existing customer picker modal)
    // ========================================================================
    async function handleRegisterUser() {
        if (!window.__flangoPickUser) {
            showAlert('Brugervælger er ikke tilgængelig.');
            return;
        }

        // Get current event for class check
        const eventId = currentEventId;
        const { event } = await fetchEventDetail(eventId);
        if (!event) return;

        // Hide event modal, show customer picker
        modal.style.display = 'none';
        const selectedUser = await window.__flangoPickUser();
        modal.style.display = 'flex';

        if (!selectedUser) return; // Cancelled

        // Class match check
        const classCheck = checkClassMatch(selectedUser.grade_level, event.allowed_classes);
        let adminOverride = false;

        if (!classCheck.match) {
            const override = await showConfirmModal({
                title: 'Klasse-advarsel',
                message: `${classCheck.reason}. Vil du tilmelde alligevel (admin override)?`,
                confirmText: 'Tilmeld alligevel',
                cancelText: 'Annuller',
            });
            if (!override) return;
            adminOverride = true;
        }

        // Register
        const result = await registerUserForEvent(eventId, selectedUser.id, adminOverride);
        if (!result.success) {
            showAlert(result.error || 'Kunne ikke tilmelde bruger.');
            return;
        }

        showCustomAlert('Tilmeldt', `${selectedUser.name} er tilmeldt!`);
        openEventDetail(eventId); // Refresh
    }

    // ========================================================================
    // Cancel event flow
    // ========================================================================
    async function handleCancelEvent() {
        if (!currentEventId) return;

        // Hent detaljer for at vise antal berørte
        const { event, registrations } = await fetchEventDetail(currentEventId);
        if (!event) return;

        const activeRegs = registrations.filter(r => r.registration_status === 'registered');
        const paidRegs = activeRegs.filter(r => r.payment_status === 'paid');
        const totalRefund = paidRegs.reduce((sum, r) => sum + parseFloat(r.price_at_signup || 0), 0);

        let message = `Er du sikker på, at du vil aflyse "${event.title}"?`;
        if (activeRegs.length > 0) {
            message += `\n\n${activeRegs.length} tilmeldte vil blive frameldt.`;
        }
        if (paidRegs.length > 0) {
            message += `\n${paidRegs.length} betalte tilmeldinger refunderes (i alt ${totalRefund.toFixed(2)} kr.).`;
        }

        const confirmed = await showConfirmModal({
            title: 'Aflys arrangement',
            message,
            confirmText: 'Aflys',
            cancelText: 'Behold',
        });

        if (!confirmed) return;

        const result = await cancelEventWithRefunds(currentEventId);
        if (!result.success) {
            showAlert(result.error || 'Kunne ikke aflyse arrangement.');
            return;
        }

        const refundInfo = result.refund_count > 0
            ? ` ${result.refund_count} refunderet (${parseFloat(result.total_refunded).toFixed(2)} kr.)`
            : '';
        showCustomAlert('Aflyst', `Arrangement aflyst.${refundInfo}`);

        // Go back to list
        currentEventId = null;
        currentEvent = null;
        showView('list');
        loadEventList();
    }

    // ========================================================================
    // Event form (create/edit)
    // ========================================================================
    createBtn.addEventListener('click', () => {
        openEventForm(null); // null = create new
        formReturnView = 'list';
    });

    function openEventForm(eventId) {
        editingEventId = eventId;

        if (eventId) {
            // Edit mode — prefill from current event data
            formSubtitle.textContent = 'Rediger Arrangement';
            formReturnView = 'detail';

            const event = currentEvents.find(e => e.id === eventId);
            if (event) {
                prefillForm(event);
            } else {
                // Fetch event if not in cache (e.g. opened from detail view)
                fetchEventDetail(eventId).then(({ event: fetchedEvent }) => {
                    if (fetchedEvent) prefillForm(fetchedEvent);
                });
            }
        } else {
            // Create mode — clear form
            formSubtitle.textContent = 'Opret Arrangement';
            clearForm();
        }

        showView('form');
    }

    function prefillForm(event) {
        formTitle.value = event.title || '';
        formDescription.value = event.description || '';
        formPrice.value = parseFloat(event.price) || 0;
        formCapacity.value = event.capacity || '';
        formStart.value = joinDatetimeLocal(event.event_date, event.start_time);
        formEnd.value = event.end_time ? joinDatetimeLocal(event.event_date, event.end_time) : '';

        // Class checkboxes
        const checkboxes = formClassesContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => {
            const val = parseInt(cb.value, 10);
            cb.checked = event.allowed_classes && event.allowed_classes.includes(val);
        });
    }

    function clearForm() {
        formTitle.value = '';
        formDescription.value = '';
        formPrice.value = '0.00';
        formCapacity.value = '';
        formStart.value = '';
        formEnd.value = '';

        const checkboxes = formClassesContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(cb => { cb.checked = false; });
    }

    // Form: cancel button (same as back)
    formCancelBtn.addEventListener('click', goBack);

    // Form: save button
    formSaveBtn.addEventListener('click', async () => {
        const title = formTitle.value.trim();
        if (!title) {
            showAlert('Titel er påkrævet.');
            formTitle.focus();
            return;
        }

        const startVal = formStart.value;
        if (!startVal) {
            showAlert('Startdato og -tid er påkrævet.');
            formStart.focus();
            return;
        }

        const { date: eventDate, time: startTime } = splitDatetimeLocal(startVal);
        const { time: endTime } = splitDatetimeLocal(formEnd.value);

        const priceVal = parseFloat(formPrice.value.replace(',', '.')) || 0;
        const capacityVal = formCapacity.value ? parseInt(formCapacity.value, 10) : null;

        // Gather allowed classes from checkboxes
        const checkedClasses = [];
        formClassesContainer.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
            checkedClasses.push(parseInt(cb.value, 10));
        });
        const allowedClasses = checkedClasses.length > 0 ? checkedClasses : null;

        const eventData = {
            title,
            description: formDescription.value.trim() || null,
            price: priceVal,
            event_date: eventDate,
            start_time: startTime,
            end_time: endTime || null,
            allowed_classes: allowedClasses,
            capacity: capacityVal,
        };

        if (editingEventId) {
            // Update existing
            const { error } = await updateEvent(editingEventId, eventData);
            if (error) {
                showAlert('Fejl ved opdatering: ' + error.message);
                return;
            }
            showCustomAlert('Opdateret', 'Arrangement opdateret.');
            // Return to detail
            showView('detail');
            openEventDetail(editingEventId);
        } else {
            // Create new
            eventData.institution_id = institutionId;
            eventData.created_by = adminProfile.id;

            const { error } = await createEvent(eventData);
            if (error) {
                showAlert('Fejl ved oprettelse: ' + error.message);
                return;
            }
            showCustomAlert('Oprettet', 'Arrangement oprettet!');
            showView('list');
            loadEventList();
        }
    });

    // ========================================================================
    // Window hook (called from shell-and-theme.js)
    // ========================================================================
    window.__flangoOpenEventAdmin = openEventAdmin;
}
