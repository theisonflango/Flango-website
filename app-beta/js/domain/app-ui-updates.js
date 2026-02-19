// js/domain/app-ui-updates.js
// UI update funktioner fra app-main.js
// Refactored to accept dependencies as parameters instead of using closures

import { getCurrentSessionAdmin } from './session-store.js';
import { getCurrentTheme } from '../ui/theme-loader.js';
import { getCurrentCustomer } from './cafe-session-store.js';
import { getOrderTotal } from './order-store.js';
import { getFinancialState } from './cafe-session-store.js';
import { calculateLevel } from './statistics-data.js';

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

    // Create sticky notes only for Unstoppable theme
    if (sessionBanner && getCurrentTheme() === 'flango-unstoppable') {
        // Remove existing sticky notes if any
        sessionBanner.querySelectorAll('.session-sticky-note').forEach(el => el.remove());

        // Create clerk sticky note
        const clerkNote = document.createElement('div');
        clerkNote.className = 'session-sticky-note clerk-note';
        clerkNote.innerHTML = `
            <div class="sticky-label">Ekspedient:</div>
            <div class="sticky-name">${clerkName}</div>
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
    } else if (sessionBanner && getCurrentTheme() === 'klart') {
        // Klart theme: Simple header — institution info (left) + action buttons (right)
        // Avatar stays inside header-actions. Timer becomes a button in header-actions.
        sessionBanner.querySelectorAll('.session-sticky-note').forEach(el => el.remove());

        // Hide the default logged-in-user text and session banner
        userDisplay.style.display = 'none';
        sessionBanner.style.display = 'none';

        const header = document.querySelector('.sidebar-main-header');
        if (header) {
            // Remove any previous Klart header elements (institution-info only)
            header.querySelectorAll('.klart-institution-info').forEach(el => el.remove());

            // Institution info — left side of header
            const institutionName = localStorage.getItem('flango_institution_name') || '';
            const isClerkMode = clerkProfile?.role !== 'admin';
            const roleLabel = isClerkMode ? `${clerkName} · Voksen: ${adultName}` : adultName;

            const instInfo = document.createElement('div');
            instInfo.className = 'klart-institution-info';
            instInfo.innerHTML = `
                <span class="klart-inst-icon">🏠</span>
                <div class="klart-inst-text">
                    <div class="klart-inst-name">${institutionName}</div>
                    <div class="klart-inst-meta">${roleLabel}</div>
                </div>
            `;
            header.insertBefore(instInfo, header.firstChild);

            // Move shift-timer pill into header-actions (before avatar)
            const headerActions = header.querySelector('.header-actions');
            const shiftTimerPill = document.getElementById('shift-timer-pill');
            if (shiftTimerPill && headerActions) {
                const avatarBtn = headerActions.querySelector('#logged-in-user-avatar-container');
                if (avatarBtn) {
                    headerActions.insertBefore(shiftTimerPill, avatarBtn);
                } else {
                    headerActions.prepend(shiftTimerPill);
                }
            }
        }

        // Add "Ryd kurv" button to sidebar header
        setupKlartClearCartButton();

    } else if (sessionBanner) {
        // Remove sticky notes for other themes
        sessionBanner.querySelectorAll('.session-sticky-note').forEach(el => el.remove());
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
 * Tilføjer "Ryd kurv" knap i sidebar-header for Klart-temaet
 */
function setupKlartClearCartButton() {
    const sidebarHeader = document.querySelector('#sidebar .sidebar-header');
    if (!sidebarHeader || sidebarHeader.querySelector('.klart-clear-cart-btn')) return;

    const clearBtn = document.createElement('button');
    clearBtn.className = 'klart-clear-cart-btn';
    clearBtn.textContent = 'Ryd kurv';
    clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Use the global clear cart function exposed from app-main.js
        if (typeof window.__flangoClearCart === 'function') {
            window.__flangoClearCart();
        }
    });
    sidebarHeader.appendChild(clearBtn);
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

        const isKlart = getCurrentTheme() === 'klart';

        if (!selectedUser) {
            console.log('[app-main] No user selected - showing empty state');
            userInfoEl.replaceChildren();
            const box = createInfoBox('Ingen kunde valgt', 'Vælg en kunde for at se saldo..', {
                boxStyle: isKlart ? '' : 'grid-column: 1 / -1;'
            });
            userInfoEl.appendChild(box);
            userInfoEl.style.display = isKlart ? 'flex' : 'grid';
            console.log('[app-main] Empty state rendered, children count:', userInfoEl.children.length);
            return;
        }

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

        if (isKlart) {
            // --- Klart layout: avatar + name (left) | saldo box (right) | close btn ---

            // 1) Avatar
            const avatarDiv = document.createElement('div');
            avatarDiv.className = 'customer-avatar';
            const avatarKey = `flango-avatar-${selectedUser.id}`;
            const savedAvatar = localStorage.getItem(avatarKey);
            if (savedAvatar) {
                avatarDiv.innerHTML = `<img src="${savedAvatar}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
            } else {
                avatarDiv.textContent = '👦';
            }
            userInfoEl.appendChild(avatarDiv);

            // 2) Name + number
            const nameDiv = document.createElement('div');
            nameDiv.className = 'customer-name-block';
            const nameSpan = document.createElement('div');
            nameSpan.className = 'customer-name';
            nameSpan.textContent = name;
            nameDiv.appendChild(nameSpan);
            if (number) {
                const numSpan = document.createElement('span');
                numSpan.className = 'customer-number';
                numSpan.textContent = `(${number})`;
                nameSpan.appendChild(document.createTextNode(' '));
                nameSpan.appendChild(numSpan);
            }
            userInfoEl.appendChild(nameDiv);

            // 3) Saldo container (saldo → ny saldo)
            const saldoContainer = document.createElement('div');
            saldoContainer.className = 'customer-saldo-container';

            const saldoBox = createInfoBox('Saldo', `${currentBalance.toFixed(2)}`);
            saldoBox.className = 'info-box saldo-current';
            saldoContainer.appendChild(saldoBox);

            const arrowSpan = document.createElement('div');
            arrowSpan.className = 'saldo-arrow';
            arrowSpan.textContent = '→';
            saldoContainer.appendChild(arrowSpan);

            const nySaldoBox = createInfoBox('Ny saldo', `${newBalance.toFixed(2)}`);
            nySaldoBox.className = 'info-box saldo-new';
            if (newBalance < 0) {
                nySaldoBox.querySelector('.info-box-value').classList.add('negative');
            }
            saldoContainer.appendChild(nySaldoBox);

            userInfoEl.appendChild(saldoContainer);

            // 4) Close button
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '&times;';
            closeBtn.className = 'deselect-user-btn';
            closeBtn.title = 'Fjern valgt bruger';
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deselectUser();
            });
            userInfoEl.appendChild(closeBtn);

            userInfoEl.style.display = 'flex';
        } else {
            // --- Default/Unstoppable layout: 3-column grid ---
            const nameLine = number ? `${name} (${number})` : name;

            const valgtBox = createInfoBox('Valgt:', nameLine);
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '&times;';
            closeBtn.className = 'deselect-user-btn';
            closeBtn.style.cssText = `
                position: absolute;
                left: 8px;
                top: 50%;
                transform: translateY(-50%);
                background: rgba(0, 0, 0, 0.1);
                border: none;
                border-radius: 50%;
                width: 24px;
                height: 24px;
                cursor: pointer;
                font-size: 20px;
                line-height: 1;
                color: #666;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 0;
                transition: all 0.2s;
            `;
            closeBtn.title = 'Fjern valgt bruger';
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deselectUser();
            });
            valgtBox.style.position = 'relative';
            valgtBox.style.paddingLeft = '32px';
            valgtBox.appendChild(closeBtn);

            userInfoEl.appendChild(valgtBox);
            userInfoEl.appendChild(createInfoBox('Nuværende Saldo:', `${currentBalance.toFixed(2)} kr.`));
            userInfoEl.appendChild(createInfoBox('Ny Saldo:', `${newBalance.toFixed(2)} kr.`, {
                valueClass: newBalance < 0 ? 'negative' : ''
            }));
            userInfoEl.style.display = 'grid';
        }

        console.log('[app-main] RENDERED! Children count:', userInfoEl.children.length);
    } catch (error) {
        console.error('[app-main] ERROR in updateSelectedUserInfo:', error);
        console.error('[app-main] Error stack:', error.stack);
    }
}
