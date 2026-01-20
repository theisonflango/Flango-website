// js/domain/app-ui-updates.js
// UI update funktioner fra app-main.js
// Refactored to accept dependencies as parameters instead of using closures

import { getCurrentSessionAdmin } from './session-store.js';
import { getCurrentTheme } from '../ui/theme-loader.js';
import { getCurrentCustomer } from './cafe-session-store.js';
import { getOrderTotal } from './order-store.js';
import { getFinancialState } from './cafe-session-store.js';

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

        if (!selectedUser) {
            console.log('[app-main] No user selected - showing empty state');
            // Vis boks med "Ingen kunde valgt" i stedet for at skjule
            userInfoEl.replaceChildren();
            const box = createInfoBox('Ingen kunde valgt', 'Vælg en kunde for at se saldo..', {
                boxStyle: 'grid-column: 1 / -1;'
            });
            userInfoEl.appendChild(box);
            userInfoEl.style.display = 'grid';
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
        const nameLine = number ? `${name} (${number})` : name;

        // Create "Valgt:" info box with close button
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
            e.stopPropagation(); // Prevent triggering parent click (customer selection modal)
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

        console.log('[app-main] RENDERED! Children count:', userInfoEl.children.length);
    } catch (error) {
        console.error('[app-main] ERROR in updateSelectedUserInfo:', error);
        console.error('[app-main] Error stack:', error.stack);
    }
}
