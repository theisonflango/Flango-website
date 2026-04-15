// js/domain/app-ui-updates.js
// UI update funktioner fra app-main.js
// Refactored to accept dependencies as parameters instead of using closures

import { getCurrentSessionAdmin } from './session-store.js?v=3.0.81';
// getCurrentTheme always returns 'klart' — kept for reference but no longer checked
// import { getCurrentTheme } from '../ui/theme-loader.js?v=3.0.81';
import { getCurrentCustomer } from './cafe-session-store.js?v=3.0.81';
import { getOrderTotal } from './order-store.js?v=3.0.81';
import { getFinancialState } from './cafe-session-store.js?v=3.0.81';
import { calculateLevel } from './statistics-data.js?v=3.0.81';
import { resolveAvatarSource } from '../core/profile-picture-cache.js?v=3.0.81';
import { renderKlartTotalDivider } from './order-ui.js?v=3.0.81';

/**
 * Deselect user function - exposed via window for use in UI
 */
function deselectUser() {
    // Call global deselect function if available
    if (typeof window.__flangoDeselectUser === 'function') {
        window.__flangoDeselectUser();
    }
}

/**
 * Opdaterer visningen af den logged-in bruger (ekspedient/voksen info + avatar)
 * @param {Object} clerkProfile - Ekspedient profil
 * @param {Map} avatarCache - In-memory cache for avatars
 * @param {Object} constants - { AVATAR_STORAGE_PREFIX, DEFAULT_AVATAR_URL }
 */
export function updateLoggedInUserDisplay(clerkProfile, avatarCache, constants) {
    const { AVATAR_STORAGE_PREFIX, DEFAULT_AVATAR_URL } = constants;
    
    const userDisplay = document.getElementById('logged-in-user');
    const avatarContainer = document.getElementById('logged-in-user-avatar-container');
    const sessionBanner = document.getElementById('user-session-banner');
    if (!userDisplay || !avatarContainer) return;

    const sessionAdmin = getCurrentSessionAdmin();
    const adultName = sessionAdmin?.name || '(ukendt)';
    const clerkName = clerkProfile?.name || adultName;
    userDisplay.textContent = `👤 ${clerkName}  |  🔐 ${adultName}`;

    // --- Cleanup: remove previous klart elements before re-rendering ---
    const header = document.querySelector('.sidebar-main-header');
    if (header) {
        header.querySelectorAll('.klart-institution-info, .klart-user-info, .klart-session-cards').forEach(el => el.remove());
    }

    // Klart theme: user info in header-actions
    if (userDisplay) userDisplay.style.display = 'none';
    if (sessionBanner) sessionBanner.style.display = 'none';

    if (header) {
        // Institution info — left side of header
        const institutionName = localStorage.getItem('flango_institution_name') || '';

        const instInfo = document.createElement('div');
        instInfo.className = 'klart-institution-info';
        instInfo.innerHTML = `
            <div class="klart-inst-icon">🏠</div>
            <div class="klart-inst-text">
                <div class="klart-inst-name">${institutionName}</div>
                <div class="klart-inst-meta">Flango System</div>
            </div>
        `;
        header.insertBefore(instInfo, header.firstChild);

        // Clerk and Adult info in header-actions (before avatar)
        const clerkFirstName = clerkName.split(' ')[0];
        const clerkLevel = calculateLevel(
            clerkProfile?.total_minutes_worked || 0,
            clerkProfile?.total_sales_count || 0
        );
        const starsHtml = clerkLevel.stars ? `<span class="klart-stars">${clerkLevel.stars}</span>` : '';

        const userInfo = document.createElement('div');
        userInfo.className = 'klart-user-info';
        userInfo.innerHTML = `
            <div class="klart-user-role">
                <div class="klart-role-label">Ekspedient</div>
                <div class="klart-role-name">${clerkFirstName} ${starsHtml}</div>
            </div>
            <div class="klart-user-role klart-adult-role">
                <div class="klart-role-label">🔐 Ansvarlig</div>
                <div class="klart-role-name">${adultName}</div>
            </div>
        `;

        const headerActions = header.querySelector('.header-actions');
        if (headerActions) {
            const avatarBtn = headerActions.querySelector('#logged-in-user-avatar-container');
            if (avatarBtn) {
                headerActions.insertBefore(userInfo, avatarBtn);
            } else {
                headerActions.prepend(userInfo);
            }
        }

        // Move shift-timer pill into header-actions
        const shiftTimerPill = document.getElementById('shift-timer-pill');
        if (shiftTimerPill && headerActions) {
            const historyBtn = headerActions.querySelector('#toolbar-history-btn');
            if (historyBtn) {
                headerActions.insertBefore(shiftTimerPill, historyBtn);
            } else {
                headerActions.appendChild(shiftTimerPill);
            }
        }

        // Place RM badge right after userInfo
        const rmBadge = document.getElementById('restaurant-mode-badge');
        if (rmBadge) userInfo.appendChild(rmBadge);
    }

    // Add "Ryd kurv" button to sidebar header
    setupKlartClearCartButton();
    // Add SVG icons to footer buttons
    decorateKlartFooterButtons();
    // Render initial empty total-divider
    renderKlartTotalDivider([], 0);

    const userId = clerkProfile.id;
    const storageKey = `${AVATAR_STORAGE_PREFIX}${userId}`;

    // OPTIMERING: Brug in-memory cache i stedet for synkron localStorage
    let savedAvatar;
    if (avatarCache.has(userId)) {
        savedAvatar = avatarCache.get(userId);
    } else {
        savedAvatar = localStorage.getItem(storageKey);
        if (!savedAvatar) {
            savedAvatar = DEFAULT_AVATAR_URL;
            localStorage.setItem(storageKey, savedAvatar);
        }
        avatarCache.set(userId, savedAvatar);
    }

    avatarContainer.innerHTML = `<img src="${savedAvatar}" alt="Valgt avatar" id="logged-in-user-avatar">`;

    const avatarImg = avatarContainer.querySelector('#logged-in-user-avatar');
    if (avatarImg) {
        avatarContainer.onclick = () => window.__flangoOpenAvatarPicker?.();
    }
}

/**
 * Tilføjer count-badge og "Ryd kurv" pill-knap i sidebar-header for Klart-temaet
 */
function setupKlartClearCartButton() {
    const sidebarHeader = document.querySelector('#sidebar .sidebar-header');
    if (!sidebarHeader || sidebarHeader.querySelector('.klart-clear-cart-btn')) return;

    // Count badge (appended to the h2)
    const h2 = sidebarHeader.querySelector('h2');
    if (h2 && !h2.querySelector('.klart-cart-count-badge')) {
        const badge = document.createElement('span');
        badge.className = 'klart-cart-count-badge';
        badge.textContent = '0';
        badge.style.display = 'none';
        h2.appendChild(badge);
    }

    // "Ryd kurv" pill button with trash SVG
    const clearBtn = document.createElement('button');
    clearBtn.className = 'klart-clear-cart-btn';
    clearBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>Ryd kurv`;
    clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof window.__flangoClearCart === 'function') {
            window.__flangoClearCart();
        }
    });
    sidebarHeader.appendChild(clearBtn);
}

/**
 * Opdaterer kurv count-badge i klart header
 */
export function updateKlartCartCountBadge(count) {
    const badge = document.querySelector('.klart-cart-count-badge');
    if (!badge) return;
    badge.textContent = String(count);
    badge.style.display = count > 0 ? '' : 'none';
}

/**
 * Dekorerer footer-knapper med SVG-ikoner for Klart-temaet
 */
function decorateKlartFooterButtons() {
    const selectBtn = document.getElementById('select-customer-main-btn');
    if (selectBtn && !selectBtn.querySelector('svg')) {
        const text = selectBtn.textContent.trim();
        selectBtn.textContent = '';
        selectBtn.insertAdjacentHTML('afterbegin',
            `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`
        );
        selectBtn.appendChild(document.createTextNode(text));
    }

    const purchaseBtn = document.getElementById('complete-purchase');
    if (purchaseBtn && !purchaseBtn.querySelector('svg')) {
        const span = purchaseBtn.querySelector('span');
        const text = span ? span.textContent.trim() : purchaseBtn.textContent.trim();
        purchaseBtn.textContent = '';
        purchaseBtn.insertAdjacentHTML('afterbegin',
            `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
        );
        purchaseBtn.appendChild(document.createTextNode(text));
    }
}

/**
 * Opdaterer avatar storage (både localStorage og cache)
 * @param {string} userId - Bruger ID
 * @param {string} avatarUrl - Avatar URL
 * @param {Map} avatarCache - In-memory cache for avatars
 * @param {string} AVATAR_STORAGE_PREFIX - Prefix for localStorage key
 */
export function updateAvatarStorage(userId, avatarUrl, avatarCache, AVATAR_STORAGE_PREFIX) {
    const storageKey = `${AVATAR_STORAGE_PREFIX}${userId}`;
    localStorage.setItem(storageKey, avatarUrl);
    avatarCache.set(userId, avatarUrl);
}

const BALANCE_ARROW_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="14 7 19 12 14 17"/></svg>`;

/**
 * Bygger balance-rækken (saldo → ny saldo) brugt i både empty og filled state.
 */
function buildBalanceRow(currentText, newText, { dimmed = false, negativeNew = false } = {}) {
    const row = document.createElement('div');
    row.className = 'klart-balance-row';
    if (dimmed) row.style.opacity = '0.35';

    const col1 = document.createElement('div');
    col1.className = 'klart-balance-col';
    const label1 = document.createElement('div');
    label1.className = 'klart-balance-label';
    label1.textContent = 'Saldo';
    const val1 = document.createElement('div');
    val1.className = 'klart-balance-val';
    val1.textContent = currentText;
    col1.appendChild(label1);
    col1.appendChild(val1);

    const col2 = document.createElement('div');
    col2.className = 'klart-balance-col klart-balance-new';
    const label2 = document.createElement('div');
    label2.className = 'klart-balance-label';
    label2.textContent = 'Ny saldo';
    const val2 = document.createElement('div');
    val2.className = 'klart-balance-val';
    if (negativeNew) val2.classList.add('negative');
    val2.textContent = newText;
    col2.appendChild(label2);
    col2.appendChild(val2);

    const arrow = document.createElement('div');
    arrow.className = 'klart-balance-arrow';
    arrow.innerHTML = BALANCE_ARROW_SVG;

    row.appendChild(col1);
    row.appendChild(arrow);
    row.appendChild(col2);
    return row;
}

/**
 * Bygger empty-state kundekort (ingen bruger valgt).
 */
function buildEmptyCustomerCard() {
    const card = document.createElement('div');
    card.className = 'klart-customer-card klart-customer-empty';

    const avatarWrap = document.createElement('div');
    avatarWrap.className = 'klart-customer-avatar-wrap';
    const avatarRing = document.createElement('div');
    avatarRing.className = 'klart-customer-avatar-ring klart-avatar-empty';
    avatarRing.textContent = '?';
    avatarWrap.appendChild(avatarRing);
    card.appendChild(avatarWrap);

    const infoDiv = document.createElement('div');
    infoDiv.className = 'klart-customer-info';
    const nameEl = document.createElement('div');
    nameEl.className = 'klart-customer-name klart-name-empty';
    nameEl.textContent = 'Vælg Kunde';
    infoDiv.appendChild(nameEl);
    infoDiv.appendChild(buildBalanceRow('— kr.', '— kr.', { dimmed: true }));
    card.appendChild(infoDiv);

    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
        document.getElementById('select-customer-main-btn')?.click();
    });
    return card;
}

/**
 * Udfylder et avatar-element med profilbillede, gamification-avatar eller initialer.
 */
function populateAvatar(el, imgClass, user, name, inst) {
    const src = resolveAvatarSource(user, inst);
    if (src.type === 'img') {
        el.innerHTML = `<img src="${src.value}" alt="" class="${imgClass}">`;
    } else if (src.type === 'async') {
        el.textContent = src.value;
        src.load().then(url => {
            if (url && el.isConnected) {
                el.textContent = '';
                el.innerHTML = `<img src="${url}" alt="" class="${imgClass}">`;
            }
        });
    } else {
        el.textContent = src.value;
    }
}

/**
 * Bygger kundekort med avatar, navn, saldo og deselect-knap.
 */
function buildCustomerCard(user, currentBalance, newBalance) {
    const name = user?.name ?? 'Ukendt';
    const number = user?.number ? String(user.number) : '';
    const inst = window.__flangoGetInstitutionById?.(user.institution_id);

    const card = document.createElement('div');
    card.className = 'klart-customer-card';

    // Avatar wrap
    const avatarWrap = document.createElement('div');
    avatarWrap.className = 'klart-customer-avatar-wrap';
    const avatarRing = document.createElement('div');
    avatarRing.className = 'klart-customer-avatar-ring';
    populateAvatar(avatarRing, 'klart-avatar-img', user, name, inst);
    avatarWrap.appendChild(avatarRing);

    if (number) {
        const badge = document.createElement('div');
        badge.className = 'klart-customer-number-badge';
        badge.textContent = `#${number}`;
        avatarWrap.appendChild(badge);
    }
    card.appendChild(avatarWrap);

    // Customer info
    const infoDiv = document.createElement('div');
    infoDiv.className = 'klart-customer-info';
    const nameEl = document.createElement('div');
    nameEl.className = 'klart-customer-name';
    nameEl.textContent = name;
    infoDiv.appendChild(nameEl);

    infoDiv.appendChild(buildBalanceRow(
        `${currentBalance.toFixed(0)} kr.`,
        `${newBalance.toFixed(0)} kr.`,
        { negativeNew: newBalance < 0 }
    ));

    // Deselect button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.className = 'deselect-user-btn';
    closeBtn.title = 'Fjern valgt bruger';
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deselectUser();
    });
    infoDiv.appendChild(closeBtn);

    card.appendChild(infoDiv);

    // Clickable to open customer selector
    card.style.cursor = 'pointer';
    card.addEventListener('click', (e) => {
        if (e.target.closest('.deselect-user-btn')) return;
        document.getElementById('select-customer-main-btn')?.click();
    });

    // Auto-scale long names
    requestAnimationFrame(() => {
        if (!nameEl.isConnected) return;
        const container = nameEl.parentElement;
        if (!container) return;
        const containerWidth = container.clientWidth;
        const nameWidth = nameEl.scrollWidth;
        if (nameWidth > containerWidth && containerWidth > 0) {
            const scale = Math.max(0.6, containerWidth / nameWidth);
            nameEl.style.fontSize = `${19 * scale}px`;
        }
    });

    return card;
}

/**
 * Opdaterer visningen af valgt bruger info (saldo, navn, etc.)
 */
export function updateSelectedUserInfo() {
    try {
        const userInfoEl = document.getElementById('selected-user-info');
        if (!userInfoEl) {
            console.error('[app-main] CRITICAL: #selected-user-info element not found!');
            return;
        }

        const selectedUser = getCurrentCustomer();
        const checkoutStack = document.getElementById('checkout-stack');

        if (!selectedUser) {
            document.querySelector('#checkout-stack .klart-customer-card')?.remove();
            if (checkoutStack && !checkoutStack.querySelector('.klart-customer-empty')) {
                checkoutStack.insertBefore(buildEmptyCustomerCard(), checkoutStack.firstChild);
            }
            userInfoEl.replaceChildren();
            return;
        }

        userInfoEl.classList.remove('empty-state');
        userInfoEl.style.removeProperty('display');
        document.querySelector('#checkout-stack .klart-customer-empty')?.remove();

        const total = getOrderTotal();
        const finance = getFinancialState(total);

        const currentBalance = Number.isFinite(finance.balance)
            ? finance.balance
            : (Number.isFinite(selectedUser.balance) ? selectedUser.balance : 0);
        const newBalance = Number.isFinite(finance.newBalance)
            ? finance.newBalance
            : currentBalance - total;

        userInfoEl.replaceChildren();

        const customerCard = buildCustomerCard(selectedUser, currentBalance, newBalance);

        if (checkoutStack) {
            checkoutStack.querySelector('.klart-customer-card')?.remove();
            checkoutStack.insertBefore(customerCard, checkoutStack.firstChild);
        }
    } catch (error) {
        console.error('[app-main] ERROR in updateSelectedUserInfo:', error);
    }
}
