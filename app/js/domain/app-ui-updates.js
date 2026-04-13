// js/domain/app-ui-updates.js
// UI update funktioner fra app-main.js
// Refactored to accept dependencies as parameters instead of using closures

import { getCurrentSessionAdmin } from './session-store.js?v=3.0.69';
import { getCurrentTheme } from '../ui/theme-loader.js?v=3.0.69';
import { getCurrentCustomer } from './cafe-session-store.js?v=3.0.69';
import { getOrderTotal } from './order-store.js?v=3.0.69';
import { getFinancialState } from './cafe-session-store.js?v=3.0.69';
import { calculateLevel } from './statistics-data.js?v=3.0.69';
import { getProfilePictureUrl, getCachedProfilePictureUrl, getDefaultProfilePicture, getDefaultProfilePictureAsync } from '../core/profile-picture-cache.js?v=3.0.69';
import { renderKlartTotalDivider } from './order-ui.js?v=3.0.69';

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

    // --- Cleanup: remove ALL theme-specific elements before rendering current theme ---
    if (sessionBanner) {
        sessionBanner.querySelectorAll('.session-sticky-note').forEach(el => el.remove());
    }
    const header = document.querySelector('.sidebar-main-header');
    if (header) {
        header.querySelectorAll('.aurora-institution-info, .aurora-user-info, .klart-institution-info, .klart-user-info, .klart-session-cards').forEach(el => el.remove());
    }
    // Reset visibility (Aurora/Klart hide these)
    if (userDisplay) userDisplay.style.display = '';
    if (sessionBanner) sessionBanner.style.display = '';

    // Create sticky notes only for Unstoppable theme
    if (sessionBanner && getCurrentTheme() === 'flango-unstoppable') {

        // Create clerk sticky note — show first name + level stars/crown
        const clerkFirstName = clerkName.split(' ')[0];
        const clerkLevel = calculateLevel(
            clerkProfile?.total_minutes_worked || 0,
            clerkProfile?.total_sales_count || 0
        );
        const levelIndicator = clerkLevel.stars ? ` ${clerkLevel.stars}` : '';
        const clerkNote = document.createElement('div');
        clerkNote.className = 'session-sticky-note clerk-note';
        clerkNote.innerHTML = `
            <div class="sticky-label">Ekspedient:</div>
            <div class="sticky-name">${clerkFirstName}${levelIndicator}</div>
        `;

        // Create adult sticky note
        const adultNote = document.createElement('div');
        adultNote.className = 'session-sticky-note adult-note';
        adultNote.innerHTML = `
            <div class="sticky-label">🔐 Voksen:</div>
            <div class="sticky-name">${adultName}</div>
        `;

        sessionBanner.appendChild(clerkNote);
        sessionBanner.appendChild(adultNote);

        // Reposition shift-timer pill between clerk and adult notes (if it exists)
        const shiftTimerPill = document.getElementById('shift-timer-pill');
        if (shiftTimerPill) {
            sessionBanner.insertBefore(shiftTimerPill, adultNote);
        }
    
    } else if (sessionBanner && getCurrentTheme() === 'aurora') {
        userDisplay.style.display = 'none';
        sessionBanner.style.display = 'none';

        if (header) {

            const institutionName = localStorage.getItem('flango_institution_name') || '';
            const isClerkMode = clerkProfile?.role !== 'admin';
            
            // Get level and stars
            const minutes = clerkProfile?.total_minutes_worked || 0;
            const sales = clerkProfile?.total_sales_count || 0;
            const levelInfo = typeof calculateLevel === 'function' ? calculateLevel(minutes, sales) : { name: 'Nybegynder', stars: '' };
            const starsHtml = levelInfo.stars ? `<span class="aurora-stars">${levelInfo.stars}</span>` : '';

            const instInfo = document.createElement('div');
            instInfo.className = 'aurora-institution-info';
            instInfo.innerHTML = `
                <div class="aurora-inst-icon">🏢</div>
                <div class="aurora-inst-text">
                    <div class="aurora-inst-name">${institutionName}</div>
                    <div class="aurora-inst-meta">Flango System</div>
                </div>
            `;
            header.insertBefore(instInfo, header.firstChild);

            // Clerk and Adult info next to avatar
            const userInfo = document.createElement('div');
            userInfo.className = 'aurora-user-info';
            userInfo.innerHTML = `
                <div class="aurora-user-role">
                    <div class="aurora-role-label">Ekspedient</div>
                    <div class="aurora-role-name">${clerkName} ${starsHtml}</div>
                </div>
                <div class="aurora-user-role adult-role">
                    <div class="aurora-role-label">🔐 Ansvarlig</div>
                    <div class="aurora-role-name">${adultName}</div>
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

            const shiftTimerPill = document.getElementById('shift-timer-pill');
            if (shiftTimerPill && headerActions) {
                // Sørg for at den ligger pænt blandt de andre action-knapper, fx før historik
                const historyBtn = headerActions.querySelector('#toolbar-history-btn');
                if (historyBtn) {
                    headerActions.insertBefore(shiftTimerPill, historyBtn);
                } else {
                    headerActions.appendChild(shiftTimerPill);
                }
            }
        }
} else if (sessionBanner && getCurrentTheme() === 'klart') {
        // Klart theme: same pattern as Aurora — user info in header-actions
        userDisplay.style.display = 'none';
        sessionBanner.style.display = 'none';

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

            // Clerk and Adult info in header-actions (before avatar) — same as Aurora
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
        }

        // Add "Ryd kurv" button to sidebar header
        setupKlartClearCartButton();
        // Add SVG icons to footer buttons
        decorateKlartFooterButtons();
        // Render initial empty total-divider
        renderKlartTotalDivider([], 0);

    }

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

/**
 * Opdaterer visningen af valgt bruger info (saldo, navn, etc.)
 */
export function updateSelectedUserInfo() {
    try {
        const userInfoEl = document.getElementById('selected-user-info');
        console.log('[app-main] updateSelectedUserInfo START - element:', userInfoEl);

        if (!userInfoEl) {
            console.error('[app-main] CRITICAL: #selected-user-info element not found!');
            return;
        }

        const selectedUser = getCurrentCustomer();
        console.log('[app-main] selectedUser:', selectedUser);

        const createInfoBox = (labelText, valueText, { valueClass = '', boxStyle = '' } = {}) => {
            const box = document.createElement('div');
            box.className = 'info-box';
            if (boxStyle) box.style.cssText = boxStyle;

            const label = document.createElement('span');
            label.className = 'info-box-label';
            label.textContent = labelText;

            const value = document.createElement('span');
            value.className = 'info-box-value';
            if (valueClass) value.classList.add(valueClass);
            value.textContent = valueText;

            box.appendChild(label);
            box.appendChild(value);
            return box;
        };

        const currentTheme = getCurrentTheme();
        const isKlart = currentTheme === 'klart';
        const isAurora = currentTheme === 'aurora';

        if (!selectedUser) {
            console.log('[app-main] No user selected - showing empty state');
            if (isKlart) {
                // Remove customer card from checkout-stack if present
                document.querySelector('#checkout-stack .klart-customer-card')?.remove();

                // Build empty card using exact same structure as selected customer
                const checkoutStack = document.getElementById('checkout-stack');
                if (checkoutStack && !checkoutStack.querySelector('.klart-customer-empty')) {
                    const customerCard = document.createElement('div');
                    customerCard.className = 'klart-customer-card klart-customer-empty';

                    const avatarWrap = document.createElement('div');
                    avatarWrap.className = 'klart-customer-avatar-wrap';
                    const avatarRing = document.createElement('div');
                    avatarRing.className = 'klart-customer-avatar-ring klart-avatar-empty';
                    avatarRing.textContent = '?';
                    avatarWrap.appendChild(avatarRing);
                    customerCard.appendChild(avatarWrap);

                    const infoDiv = document.createElement('div');
                    infoDiv.className = 'klart-customer-info';

                    const nameEl = document.createElement('div');
                    nameEl.className = 'klart-customer-name klart-name-empty';
                    nameEl.textContent = 'Vælg Kunde';
                    infoDiv.appendChild(nameEl);

                    const balanceRow = document.createElement('div');
                    balanceRow.className = 'klart-balance-row';
                    balanceRow.style.opacity = '0.35';

                    const col1 = document.createElement('div');
                    col1.className = 'klart-balance-col';
                    const label1 = document.createElement('div');
                    label1.className = 'klart-balance-label';
                    label1.textContent = 'Saldo';
                    const val1 = document.createElement('div');
                    val1.className = 'klart-balance-val';
                    val1.textContent = '— kr.';
                    col1.appendChild(label1);
                    col1.appendChild(val1);

                    const col2 = document.createElement('div');
                    col2.className = 'klart-balance-col klart-balance-new';
                    const label2 = document.createElement('div');
                    label2.className = 'klart-balance-label';
                    label2.textContent = 'Ny saldo';
                    const val2 = document.createElement('div');
                    val2.className = 'klart-balance-val';
                    val2.textContent = '— kr.';
                    col2.appendChild(label2);
                    col2.appendChild(val2);

                    const arrow = document.createElement('div');
                    arrow.className = 'klart-balance-arrow';
                    arrow.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="14 7 19 12 14 17"/></svg>`;

                    balanceRow.appendChild(col1);
                    balanceRow.appendChild(arrow);
                    balanceRow.appendChild(col2);
                    infoDiv.appendChild(balanceRow);

                    customerCard.appendChild(infoDiv);

                    customerCard.style.cursor = 'pointer';
                    customerCard.addEventListener('click', () => {
                        document.getElementById('select-customer-main-btn')?.click();
                    });

                    checkoutStack.insertBefore(customerCard, checkoutStack.firstChild);
                }
            } else if (isAurora) {
                // Aurora: no customer card when empty
                document.querySelector('#checkout-stack .klart-customer-card')?.remove();
            }
            userInfoEl.replaceChildren();
            if (isAurora) {
                userInfoEl.style.setProperty('display', 'none', 'important');
            } else if (!isKlart) {
                const box = createInfoBox('Ingen kunde valgt', 'Vælg en kunde for at se saldo..', {
                    boxStyle: 'grid-column: 1 / -1;'
                });
                userInfoEl.appendChild(box);
                userInfoEl.style.display = 'grid';
            }
            console.log('[app-main] Empty state rendered');
            return;
        }

        // Fjerne empty-state klassen hvis der er valgt en bruger
        userInfoEl.classList.remove('empty-state');
        userInfoEl.style.removeProperty('display');
        // Remove empty customer placeholder if present
        document.querySelector('#checkout-stack .klart-customer-empty')?.remove();

        // Brug den centrale order-store til totalen
        const total = getOrderTotal();
        console.log('[app-main] Order total:', total);

        // Brug cafe-session-store til den finansielle tilstand
        const finance = getFinancialState(total);
        console.log('[app-main] Financial state:', finance);

        // Robust udregning af nuværende saldo og ny saldo
        const currentBalance = Number.isFinite(finance.balance)
            ? finance.balance
            : (Number.isFinite(selectedUser.balance) ? selectedUser.balance : 0);

        const newBalance = Number.isFinite(finance.newBalance)
            ? finance.newBalance
            : currentBalance - total;

        console.log(`[app-main] ABOUT TO SET HTML - currentBalance: ${currentBalance}, newBalance: ${newBalance}`);

        userInfoEl.replaceChildren();

        const name = selectedUser?.name ?? 'Ukendt';
        const number = selectedUser?.number ? String(selectedUser.number) : '';

        // --- Shared: resolve avatar content for an element ---
        const inst = window.__flangoGetInstitutionById?.(selectedUser.institution_id);
        const hasProfilePic = inst?.profile_pictures_enabled
            && selectedUser.profile_picture_url
            && !selectedUser.profile_picture_opt_out;

        function populateAvatar(el, imgClass) {
            if (hasProfilePic) {
                const cachedUrl = getCachedProfilePictureUrl(selectedUser);
                if (cachedUrl) {
                    el.innerHTML = `<img src="${cachedUrl}" alt="" class="${imgClass}">`;
                } else {
                    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                    el.textContent = initials;
                    getProfilePictureUrl(selectedUser).then(url => {
                        if (url && el.isConnected) {
                            el.textContent = '';
                            el.innerHTML = `<img src="${url}" alt="" class="${imgClass}">`;
                        }
                    });
                }
            } else {
                const avatarKey = `flango-avatar-${selectedUser.id}`;
                const savedAvatar = localStorage.getItem(avatarKey);
                if (savedAvatar) {
                    el.innerHTML = `<img src="${savedAvatar}" alt="" class="${imgClass}">`;
                } else {
                    // Use institution default profile picture setting
                    const def = getDefaultProfilePicture(name, inst);
                    if (def.type === 'anonymous') {
                        el.textContent = '👤';
                    } else if (def.type === 'image' && def.value) {
                        el.innerHTML = `<img src="${def.value}" alt="" class="${imgClass}">`;
                    } else if (def.type === 'image') {
                        // Need async resolution for signed URL
                        el.textContent = '...';
                        getDefaultProfilePictureAsync(name, inst).then(res => {
                            if (res.type === 'image' && res.value && el.isConnected) {
                                el.innerHTML = `<img src="${res.value}" alt="" class="${imgClass}">`;
                            } else if (el.isConnected) {
                                el.textContent = res.value || '?';
                            }
                        });
                    } else {
                        el.textContent = def.value; // initials
                    }
                }
            }
        }

        if (isKlart) {
            // --- Klart layout: customer card + balance card ---

            // 1) Customer card with large avatar, number badge, name
            const customerCard = document.createElement('div');
            customerCard.className = 'klart-customer-card';

            // Avatar wrap (large avatar + number badge)
            const avatarWrap = document.createElement('div');
            avatarWrap.className = 'klart-customer-avatar-wrap';

            const avatarRing = document.createElement('div');
            avatarRing.className = 'klart-customer-avatar-ring';
            populateAvatar(avatarRing, 'klart-avatar-img');
            avatarWrap.appendChild(avatarRing);

            // Number badge below avatar
            if (number) {
                const badge = document.createElement('div');
                badge.className = 'klart-customer-number-badge';
                badge.textContent = `#${number}`;
                avatarWrap.appendChild(badge);
            }
            customerCard.appendChild(avatarWrap);

            // Customer info (name + balance row inside card)
            const infoDiv = document.createElement('div');
            infoDiv.className = 'klart-customer-info';
            const nameEl = document.createElement('div');
            nameEl.className = 'klart-customer-name';
            nameEl.textContent = name;
            infoDiv.appendChild(nameEl);

            // Balance row (inside customer card, below name)
            const balanceRow = document.createElement('div');
            balanceRow.className = 'klart-balance-row';

            const col1 = document.createElement('div');
            col1.className = 'klart-balance-col';
            const label1 = document.createElement('div');
            label1.className = 'klart-balance-label';
            label1.textContent = 'Saldo';
            const val1 = document.createElement('div');
            val1.className = 'klart-balance-val';
            val1.textContent = `${currentBalance.toFixed(0)} kr.`;
            col1.appendChild(label1);
            col1.appendChild(val1);

            const col2 = document.createElement('div');
            col2.className = 'klart-balance-col klart-balance-new';
            const label2 = document.createElement('div');
            label2.className = 'klart-balance-label';
            label2.textContent = 'Ny saldo';
            const val2 = document.createElement('div');
            val2.className = 'klart-balance-val';
            if (newBalance < 0) val2.classList.add('negative');
            val2.textContent = `${newBalance.toFixed(0)} kr.`;
            col2.appendChild(label2);
            col2.appendChild(val2);

            // Arrow between saldo columns
            const arrow = document.createElement('div');
            arrow.className = 'klart-balance-arrow';
            arrow.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="14 7 19 12 14 17"/></svg>`;

            balanceRow.appendChild(col1);
            balanceRow.appendChild(arrow);
            balanceRow.appendChild(col2);
            infoDiv.appendChild(balanceRow);

            customerCard.appendChild(infoDiv);

            // Close/deselect button (top-right of customer info box)
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '&times;';
            closeBtn.className = 'deselect-user-btn';
            closeBtn.title = 'Fjern valgt bruger';
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deselectUser();
            });
            infoDiv.appendChild(closeBtn);

            // Make customer card clickable to open customer selector
            customerCard.style.cursor = 'pointer';
            customerCard.addEventListener('click', (e) => {
                if (e.target.closest('.deselect-user-btn')) return;
                document.getElementById('select-customer-main-btn')?.click();
            });

            // Render customer card into checkout-stack (unified bottom panel)
            const checkoutStack = document.getElementById('checkout-stack');
            if (checkoutStack) {
                // Remove previous klart customer card
                checkoutStack.querySelector('.klart-customer-card')?.remove();
                // Insert at the top of checkout-stack
                checkoutStack.insertBefore(customerCard, checkoutStack.firstChild);
            }

            // Auto-scale name if it overflows its container
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
        } else if (isAurora) {
            // --- Aurora layout: 2-row grid with small avatar ---
            // Row 1: [Avatar] [Name + Number] [×]
            // Row 2: [Avatar] [Saldo → Ny Saldo] [×]

            const avatar = document.createElement('div');
            avatar.className = 'customer-avatar';
            populateAvatar(avatar, 'profile-pic-selected');

            const nameBlock = document.createElement('div');
            nameBlock.className = 'customer-name-block';
            const nameEl = document.createElement('span');
            nameEl.className = 'customer-name';
            nameEl.textContent = name;
            nameBlock.appendChild(nameEl);
            if (number) {
                const numEl = document.createElement('span');
                numEl.className = 'customer-number';
                numEl.textContent = `#${number}`;
                nameBlock.appendChild(numEl);
            }

            const saldoContainer = document.createElement('div');
            saldoContainer.className = 'customer-saldo-container';

            const currentBox = createInfoBox('Saldo:', `${currentBalance.toFixed(0)} kr.`);
            const arrowEl = document.createElement('span');
            arrowEl.className = 'saldo-arrow';
            arrowEl.textContent = '→';
            const newBox = createInfoBox('Ny:', `${newBalance.toFixed(0)} kr.`, {
                valueClass: newBalance < 0 ? 'negative' : ''
            });

            saldoContainer.appendChild(currentBox);
            saldoContainer.appendChild(arrowEl);
            saldoContainer.appendChild(newBox);

            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '&times;';
            closeBtn.className = 'deselect-user-btn';
            closeBtn.title = 'Fjern valgt bruger';
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deselectUser();
            });

            userInfoEl.appendChild(avatar);
            userInfoEl.appendChild(nameBlock);
            userInfoEl.appendChild(saldoContainer);
            userInfoEl.appendChild(closeBtn);
            userInfoEl.style.display = 'grid';
        } else {
            // --- Default/Unstoppable layout: 3-column grid with small avatar ---
            const avatar = document.createElement('div');
            avatar.className = 'unstoppable-customer-avatar';
            populateAvatar(avatar, 'unstoppable-avatar-img');

            const nameLine = number ? `${name} (${number})` : name;
            const valgtBox = createInfoBox('Valgt:', nameLine);

            userInfoEl.appendChild(avatar);
            userInfoEl.appendChild(valgtBox);
            userInfoEl.appendChild(createInfoBox('Nuværende Saldo:', `${currentBalance.toFixed(2)} kr.`));
            userInfoEl.appendChild(createInfoBox('Ny Saldo:', `${newBalance.toFixed(2)} kr.`, {
                valueClass: newBalance < 0 ? 'negative' : ''
            }));
            userInfoEl.style.display = 'grid';

            // Close button — positioned top-right of the entire container
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '&times;';
            closeBtn.className = 'deselect-user-btn';
            closeBtn.style.cssText = `
                position: absolute;
                right: -8px;
                top: -8px;
                background: #fff;
                border: 1px solid #d6e8f8;
                border-radius: 50%;
                width: 22px;
                height: 22px;
                cursor: pointer;
                font-size: 14px;
                line-height: 1;
                color: #666;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0;
                transition: all 0.2s;
                z-index: 15;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            `;
            closeBtn.title = 'Fjern valgt bruger';
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deselectUser();
            });
            userInfoEl.appendChild(closeBtn);
        }

        console.log('[app-main] RENDERED! Children count:', userInfoEl.children.length);
    } catch (error) {
        console.error('[app-main] ERROR in updateSelectedUserInfo:', error);
        console.error('[app-main] Error stack:', error.stack);
    }
}
