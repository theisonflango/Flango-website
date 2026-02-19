// shift-timer.js - Bytte-timer for ekspedient-skift
// Håndterer nedtælling (tid) og optælling (salg) med blocking popup ved timeout

const STORAGE_KEY = 'flango_shift_timer';

let state = {
    active: false,
    timeEnabled: false,
    timeMinutes: 15,
    timeRemainingSec: 0,
    salesEnabled: false,
    salesMax: 10,
    salesCount: 0,
    nextClerkName: ''
};

let timerInterval = null;
let pillElement = null;
let modalElement = null;
let blockingPopupElement = null;

// Eksponér openShiftTimerModal globalt med det samme (for velkomst-dialog)
// Funktionen defineres senere, men referencen opdateres automatisk
window.__flangoOpenShiftTimer = () => {
    if (typeof openModal === 'function') {
        openModal();
    }
};

// ============================================================================
// STATE PERSISTENCE (sessionStorage)
// ============================================================================

function saveState() {
    try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.warn('[shift-timer] Could not save state:', e);
    }
}

function loadState() {
    try {
        const saved = sessionStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            state = { ...state, ...parsed };
        }
    } catch (e) {
        console.warn('[shift-timer] Could not load state:', e);
    }
}

function resetState() {
    state = {
        active: false,
        timeEnabled: false,
        timeMinutes: 15,
        timeRemainingSec: 0,
        salesEnabled: false,
        salesMax: 10,
        salesCount: 0,
        nextClerkName: ''
    };
    saveState();
    stopTimerInterval();
    updatePillDisplay();
}

// ============================================================================
// TIMER INTERVAL LOGIC
// ============================================================================

function startTimerInterval() {
    if (timerInterval) return;
    timerInterval = setInterval(() => {
        if (!state.active || !state.timeEnabled) return;

        if (state.timeRemainingSec > 0) {
            state.timeRemainingSec--;
            saveState();
            updatePillDisplay();

            if (state.timeRemainingSec <= 0) {
                triggerSwapPopup('time');
            }
        }
    }, 1000);
}

function stopTimerInterval() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

// ============================================================================
// SALE COUNTING (hook fra purchase-flow)
// ============================================================================

function handleSaleCompleted() {
    if (!state.active || !state.salesEnabled) return;

    state.salesCount++;
    saveState();
    updatePillDisplay();

    if (state.salesCount >= state.salesMax) {
        triggerSwapPopup('sales');
    }
}

// Lyt på custom event
window.addEventListener('flango:saleCompleted', handleSaleCompleted);

// ============================================================================
// FLIP-CLOCK STYLE HELPERS
// ============================================================================

function createFlipDigit(value, label = '') {
    return `
        <div class="flip-unit">
            <div class="flip-card">
                <div class="flip-card-inner">
                    <span class="flip-digit">${value}</span>
                </div>
            </div>
            ${label ? `<span class="flip-label">${label}</span>` : ''}
        </div>
    `;
}

function formatTimeFlip(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const minStr = mins.toString().padStart(2, '0');
    const secStr = secs.toString().padStart(2, '0');
    return { mins: minStr, secs: secStr };
}

// ============================================================================
// PILL DISPLAY (header element) - FLIP CLOCK STYLE
// ============================================================================

function updatePillDisplay() {
    if (!pillElement) return;

    if (!state.active) {
        // Inactive state: Vis kun et ur-ikon som kan klikkes for at åbne settings
        pillElement.innerHTML = `<span style="font-size:22px;">🕐</span>`;
        pillElement.style.background = 'linear-gradient(135deg, #f8fafc, #f1f5f9)';
        pillElement.style.borderColor = '#e2e8f0';
        pillElement.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)';
        pillElement.style.padding = '8px 12px';
        pillElement.classList.remove('shift-timer-active');
    } else {
        // Active state: Farverige bobler til tid og salg
        let parts = [];

        if (state.timeEnabled) {
            const { mins, secs } = formatTimeFlip(state.timeRemainingSec);
            // Varm koral/orange boble for tid
            parts.push(`
                <span style="display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,#fed7aa,#fdba74);padding:6px 12px;border-radius:20px;border:2px solid #fb923c;box-shadow:0 2px 8px rgba(251,146,60,0.25);">
                    <span style="font-size:16px;">⏱️</span>
                    <span style="font-family:'Poppins',sans-serif;font-size:15px;font-weight:700;color:#c2410c;">${mins}:${secs}</span>
                </span>
            `);
        }

        if (state.salesEnabled) {
            const countStr = state.salesCount.toString();
            const maxStr = state.salesMax.toString();
            // Frisk grøn/teal boble for salg
            parts.push(`
                <span style="display:inline-flex;align-items:center;gap:6px;background:linear-gradient(135deg,#a7f3d0,#6ee7b7);padding:6px 12px;border-radius:20px;border:2px solid #34d399;box-shadow:0 2px 8px rgba(52,211,153,0.25);">
                    <span style="font-size:16px;">🛒</span>
                    <span style="font-family:'Poppins',sans-serif;font-size:15px;font-weight:700;color:#047857;">${countStr}/${maxStr}</span>
                </span>
            `);
        }

        pillElement.innerHTML = parts.join('');
        // Active container: lys lilla baggrund
        pillElement.style.background = 'linear-gradient(135deg, #faf5ff, #f3e8ff)';
        pillElement.style.borderColor = '#c4b5fd';
        pillElement.style.boxShadow = '0 4px 12px rgba(139,92,246,0.2)';
        pillElement.classList.add('shift-timer-active');
    }
}

// ============================================================================
// MODAL (konfiguration)
// ============================================================================

function createModal() {
    if (modalElement) return;

    modalElement = document.createElement('div');
    modalElement.id = 'shift-timer-modal';
    // INLINE STYLES for guaranteed centering (bypass CSS conflicts)
    modalElement.style.cssText = `
        display: none;
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        background: rgba(15, 23, 42, 0.7) !important;
        align-items: center !important;
        justify-content: center !important;
        z-index: 9999999 !important;
        backdrop-filter: blur(4px);
    `;
    modalElement.innerHTML = `
        <div style="background: linear-gradient(180deg, #ffffff, #f8fafc); padding: 32px; border-radius: 20px; max-width: 400px; width: 90%; box-shadow: 0 25px 60px rgba(0,0,0,0.3); font-family: 'Poppins', sans-serif;">
            <h2 style="font-size: 24px; font-weight: 700; color: #7c3aed; margin: 0 0 24px 0; text-align: center;">🕒 Bytte-timer</h2>

            <div style="margin-bottom: 20px;">
                <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; margin-bottom: 12px;">
                    <input type="checkbox" id="shift-time-enabled" style="width: 20px; height: 20px; cursor: pointer;">
                    <span style="font-size: 16px; font-weight: 600; color: #334155;">Tid</span>
                </label>
                <div id="shift-time-row" style="display: flex; align-items: center; gap: 10px; padding-left: 32px;">
                    <input type="number" id="shift-time-minutes" min="1" max="120" value="15" style="width: 70px; padding: 8px 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 16px; font-weight: 600; text-align: center;">
                    <span style="color: #64748b; font-size: 14px;">minutter</span>
                </div>
            </div>

            <div style="margin-bottom: 20px;">
                <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; margin-bottom: 12px;">
                    <input type="checkbox" id="shift-sales-enabled" style="width: 20px; height: 20px; cursor: pointer;">
                    <span style="font-size: 16px; font-weight: 600; color: #334155;">Salg</span>
                </label>
                <div id="shift-sales-row" style="display: flex; align-items: center; gap: 10px; padding-left: 32px;">
                    <input type="number" id="shift-sales-max" min="1" max="100" value="10" style="width: 70px; padding: 8px 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 16px; font-weight: 600; text-align: center;">
                    <span style="color: #64748b; font-size: 14px;">salg</span>
                </div>
            </div>

            <div style="margin-bottom: 24px;">
                <label style="display: block; font-size: 14px; font-weight: 600; color: #64748b; margin-bottom: 8px;">Næste ekspedient (valgfrit)</label>
                <input type="text" id="shift-next-clerk" placeholder="Navn på næste ekspedient" style="width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 15px; box-sizing: border-box;">
            </div>

            <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                <button id="shift-timer-start" style="flex: 1; padding: 14px 20px; border: none; border-radius: 12px; font-size: 15px; font-weight: 700; cursor: pointer; background: linear-gradient(135deg, #7c3aed, #6d28d9); color: white; min-width: 120px;">Start timer</button>
                <button id="shift-timer-stop" style="display: none; flex: 1; padding: 14px 20px; border: none; border-radius: 12px; font-size: 15px; font-weight: 700; cursor: pointer; background: linear-gradient(135deg, #ef4444, #dc2626); color: white; min-width: 80px;">Slå fra</button>
                <button id="shift-timer-cancel" style="flex: 1; padding: 14px 20px; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 15px; font-weight: 700; cursor: pointer; background: #f8fafc; color: #64748b; min-width: 100px;">Annuller</button>
            </div>
        </div>
    `;
    document.body.appendChild(modalElement);

    // Event listeners
    const timeCheckbox = modalElement.querySelector('#shift-time-enabled');
    const salesCheckbox = modalElement.querySelector('#shift-sales-enabled');
    const timeRow = modalElement.querySelector('#shift-time-row');
    const salesRow = modalElement.querySelector('#shift-sales-row');
    const startBtn = modalElement.querySelector('#shift-timer-start');
    const stopBtn = modalElement.querySelector('#shift-timer-stop');
    const cancelBtn = modalElement.querySelector('#shift-timer-cancel');

    // Toggle input visibility
    timeCheckbox.addEventListener('change', () => {
        timeRow.style.opacity = timeCheckbox.checked ? '1' : '0.5';
        timeRow.style.pointerEvents = timeCheckbox.checked ? 'auto' : 'none';
    });
    salesCheckbox.addEventListener('change', () => {
        salesRow.style.opacity = salesCheckbox.checked ? '1' : '0.5';
        salesRow.style.pointerEvents = salesCheckbox.checked ? 'auto' : 'none';
    });

    // Start/Update button
    startBtn.addEventListener('click', () => {
        const timeEnabled = timeCheckbox.checked;
        const salesEnabled = salesCheckbox.checked;

        if (!timeEnabled && !salesEnabled) {
            alert('Vælg mindst én mulighed (tid eller salg)');
            return;
        }

        const timeMinutes = parseInt(modalElement.querySelector('#shift-time-minutes').value) || 15;
        const salesMax = parseInt(modalElement.querySelector('#shift-sales-max').value) || 10;
        const nextClerkName = modalElement.querySelector('#shift-next-clerk').value.trim();

        // Hvis timer allerede er aktiv, behold salesCount
        const keepSalesCount = state.active ? state.salesCount : 0;

        state.active = true;
        state.timeEnabled = timeEnabled;
        state.timeMinutes = timeMinutes;
        state.timeRemainingSec = timeEnabled ? timeMinutes * 60 : 0;
        state.salesEnabled = salesEnabled;
        state.salesMax = salesMax;
        state.salesCount = keepSalesCount;
        state.nextClerkName = nextClerkName;

        saveState();
        updatePillDisplay();
        startTimerInterval();
        closeModal();
    });

    // Stop button
    stopBtn.addEventListener('click', () => {
        resetState();
        closeModal();
    });

    // Cancel button
    cancelBtn.addEventListener('click', closeModal);

    // Click outside to close
    modalElement.addEventListener('click', (e) => {
        if (e.target === modalElement) closeModal();
    });
}

function openModal() {
    if (!modalElement) createModal();

    // Populate current values
    const timeCheckbox = modalElement.querySelector('#shift-time-enabled');
    const salesCheckbox = modalElement.querySelector('#shift-sales-enabled');
    const timeMinutesInput = modalElement.querySelector('#shift-time-minutes');
    const salesMaxInput = modalElement.querySelector('#shift-sales-max');
    const nextClerkInput = modalElement.querySelector('#shift-next-clerk');
    const timeRow = modalElement.querySelector('#shift-time-row');
    const salesRow = modalElement.querySelector('#shift-sales-row');
    const startBtn = modalElement.querySelector('#shift-timer-start');
    const stopBtn = modalElement.querySelector('#shift-timer-stop');

    timeCheckbox.checked = state.timeEnabled;
    salesCheckbox.checked = state.salesEnabled;
    timeMinutesInput.value = state.timeMinutes;
    salesMaxInput.value = state.salesMax;
    nextClerkInput.value = state.nextClerkName;

    timeRow.style.opacity = state.timeEnabled ? '1' : '0.5';
    timeRow.style.pointerEvents = state.timeEnabled ? 'auto' : 'none';
    salesRow.style.opacity = state.salesEnabled ? '1' : '0.5';
    salesRow.style.pointerEvents = state.salesEnabled ? 'auto' : 'none';

    // Show/hide buttons based on state
    if (state.active) {
        startBtn.textContent = 'Opdatér timer';
        stopBtn.style.display = 'flex';
        stopBtn.style.flex = '1';
    } else {
        startBtn.textContent = 'Start timer';
        stopBtn.style.display = 'none';
    }

    modalElement.style.display = 'flex';
}

function closeModal() {
    if (modalElement) {
        modalElement.style.display = 'none';
    }
}

// ============================================================================
// BLOCKING POPUP (bytte-tid) - CENTRERET MODAL
// ============================================================================

function triggerSwapPopup(reason) {
    stopTimerInterval();

    // Fjern eksisterende popup hvis den findes
    const existingPopup = document.getElementById('shift-swap-popup');
    if (existingPopup) existingPopup.remove();

    // Opret ny popup med INLINE STYLES for garanteret centrering
    blockingPopupElement = document.createElement('div');
    blockingPopupElement.id = 'shift-swap-popup';
    // KRITISK: Inline styles for at sikre centrering virker
    blockingPopupElement.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        background: rgba(15, 23, 42, 0.9) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        z-index: 99999 !important;
        backdrop-filter: blur(8px);
    `;
    document.body.appendChild(blockingPopupElement);

    const reasonText = reason === 'time' ? 'Tiden er udløbet!' : 'Salgsgrænsen er nået!';
    const nextClerkHtml = state.nextClerkName
        ? `<div style="background:linear-gradient(135deg,#dbeafe,#bfdbfe);padding:16px 20px;border-radius:14px;margin-bottom:24px;border:2px solid #93c5fd;">
               <div style="font-size:13px;color:#3b82f6;font-weight:600;">👉 Næste ekspedient:</div>
               <div style="font-size:22px;font-weight:800;color:#1e40af;">${state.nextClerkName}</div>
           </div>`
        : '';

    blockingPopupElement.innerHTML = `
        <div style="background:linear-gradient(180deg,#ffffff,#f1f5f9);padding:40px 36px;border-radius:24px;max-width:420px;width:90%;text-align:center;box-shadow:0 30px 80px rgba(0,0,0,0.4);">
            <div style="font-size:72px;margin-bottom:16px;animation:spin 3s ease-in-out infinite;">🔄</div>
            <h2 style="font-size:32px;font-weight:800;color:#1e293b;margin:0 0 12px 0;">Bytte-tid!</h2>
            <div style="display:inline-block;font-size:14px;font-weight:700;color:#92400e;background:linear-gradient(135deg,#fef3c7,#fde68a);padding:8px 16px;border-radius:20px;margin-bottom:16px;border:1px solid #fcd34d;">${reasonText}</div>
            <p style="font-size:16px;color:#475569;line-height:1.6;margin:0 0 20px 0;">Log ud så den næste Flango-ekspedient kan logge ind.</p>
            ${nextClerkHtml}
            <div style="display:flex;gap:14px;">
                <button id="shift-swap-logout" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:16px 24px;border:none;border-radius:14px;font-size:17px;font-weight:700;cursor:pointer;background:linear-gradient(135deg,#10b981,#059669);color:white;box-shadow:0 6px 20px rgba(16,185,129,0.4);">
                    <span style="font-size:20px;">🚪</span> Log ud
                </button>
                <button id="shift-swap-continue" style="flex:1;padding:16px 24px;border:2px solid #e2e8f0;border-radius:14px;font-size:17px;font-weight:700;cursor:pointer;background:#f1f5f9;color:#475569;">
                    Jeg fortsætter
                </button>
            </div>
        </div>
    `;

    // Event listeners
    const logoutBtn = blockingPopupElement.querySelector('#shift-swap-logout');
    const continueBtn = blockingPopupElement.querySelector('#shift-swap-continue');

    logoutBtn.onclick = () => {
        blockingPopupElement.remove();
        resetState();
        const logoutBtnEl = document.getElementById('logout-btn');
        if (logoutBtnEl) logoutBtnEl.click();
    };

    continueBtn.onclick = () => {
        blockingPopupElement.remove();
        if (state.timeEnabled) {
            state.timeRemainingSec = state.timeMinutes * 60;
        }
        state.salesCount = 0;
        saveState();
        updatePillDisplay();
        startTimerInterval();
    };
}

// ============================================================================
// INITIALIZATION & EXPORTS
// ============================================================================

export function initShiftTimer(sessionBanner) {
    loadState();

    // Tjek om bytte-timer er aktiveret for institutionen (kun eksplicit true)
    const isEnabled = window.__flangoInstitutionSettings?.shiftTimerEnabled === true;

    // GUARD: Prevent duplicate pill creation
    const existingPill = document.getElementById('shift-timer-pill');
    if (existingPill) {
        pillElement = existingPill;
        // Opdater visibility baseret på setting
        pillElement.style.display = isEnabled ? 'inline-flex' : 'none';
        updatePillDisplay();
        return;
    }

    // Create pill element with inline styles for guaranteed layout
    pillElement = document.createElement('div');
    pillElement.id = 'shift-timer-pill';
    pillElement.className = 'shift-timer-pill';
    pillElement.style.cssText = `
        display: ${isEnabled ? 'inline-flex' : 'none'};
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        background: linear-gradient(135deg, #faf5ff, #f3e8ff);
        border: 2px solid #d8b4fe;
        border-radius: 16px;
        cursor: pointer;
        font-family: 'Poppins', sans-serif;
        font-size: 14px;
        font-weight: 600;
        color: #6b7280;
        transition: all 0.2s ease;
        margin: 0 12px;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(168,139,250,0.15);
    `;
    pillElement.addEventListener('click', openModal);

    // Insert pill into the appropriate location based on theme
    const headerActions = document.querySelector('.sidebar-main-header .header-actions');
    if (headerActions) {
        // Klart theme: Insert into header-actions bar, before the avatar
        const avatarBtn = headerActions.querySelector('#logged-in-user-avatar-container');
        if (avatarBtn) {
            headerActions.insertBefore(pillElement, avatarBtn);
        } else {
            headerActions.prepend(pillElement);
        }
    } else if (sessionBanner) {
        // Other themes: Insert into session banner BETWEEN clerk-note and adult-note
        const adultNote = sessionBanner.querySelector('.adult-note');
        if (adultNote) {
            sessionBanner.insertBefore(pillElement, adultNote);
        } else {
            sessionBanner.appendChild(pillElement);
        }
    }

    updatePillDisplay();

    // Resume timer if active
    if (state.active && state.timeEnabled && state.timeRemainingSec > 0) {
        startTimerInterval();
    }

    // Check if already at limit
    if (state.active) {
        if (state.timeEnabled && state.timeRemainingSec <= 0) {
            triggerSwapPopup('time');
        } else if (state.salesEnabled && state.salesCount >= state.salesMax) {
            triggerSwapPopup('sales');
        }
    }

    createModal();
}

export function resetShiftTimer() {
    resetState();
}

export function getShiftTimerState() {
    return { ...state };
}

// Eksportér openModal så den kan kaldes fra velkomst-skærm
export function openShiftTimerModal() {
    openModal();
}
