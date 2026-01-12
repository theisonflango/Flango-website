/**
 * Keyboard Usage Tip Module
 * 
 * Tracks mouse vs keyboard usage and shows a friendly tip from Hr. Flango
 * encouraging keyboard shortcuts when users rely heavily on the mouse.
 */

import { openHelpManually } from './help.js';

const STORAGE_KEY = 'flango-keyboard-tip-dismissed';

// Configuration
const CONFIG = {
    // Minimum mouse clicks to trigger
    MIN_MOUSE_CLICKS: 10,
    // Time window in milliseconds (5 minutes)
    TIME_WINDOW_MS: 300000, // 5 minutes = 300000 ms
};

let mouseClicks = [];
let keyboardPresses = [];
let isTracking = false;

/**
 * Check if tip has been permanently dismissed
 */
function isDismissed() {
    try {
        return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
        return false;
    }
}

/**
 * Check if tip has been shown this session
 * Note: Removed - tip can now show multiple times per session
 */
// Removed session check - tip can show multiple times per session

/**
 * Mark tip as permanently dismissed
 */
function markDismissed() {
    try {
        localStorage.setItem(STORAGE_KEY, 'true');
    } catch {}
}

/**
 * Record a mouse click on a tracked element
 */
function recordMouseClick(type) {
    if (!isTracking || isDismissed()) return;
    
    const now = Date.now();
    mouseClicks.push({ type, timestamp: now });
    
    // Clean old clicks outside time window
    const cutoff = now - CONFIG.TIME_WINDOW_MS;
    mouseClicks = mouseClicks.filter(click => click.timestamp > cutoff);
    
    checkTrigger();
}

/**
 * Record a keyboard press
 */
function recordKeyboardPress(key) {
    if (!isTracking || isDismissed()) return;
    
    const now = Date.now();
    keyboardPresses.push({ key, timestamp: now });
    
    // Clean old presses outside time window
    const cutoff = now - CONFIG.TIME_WINDOW_MS;
    keyboardPresses = keyboardPresses.filter(press => press.timestamp > cutoff);
}

/**
 * Check if trigger conditions are met
 * 
 * Trigger logic:
 * - If user has >= 10 mouse clicks on tracked actions (products, select user, complete purchase)
 * - Within the last 5 minutes
 * -> Show the tip
 * 
 * This indicates the user is relying heavily on the mouse instead of keyboard shortcuts.
 */
function checkTrigger() {
    if (isDismissed()) return;
    
    const now = Date.now();
    const cutoff = now - CONFIG.TIME_WINDOW_MS;
    
    // Count clicks within time window
    const recentClicks = mouseClicks.filter(click => click.timestamp > cutoff);
    
    // Trigger if user has >= 10 mouse clicks within the last 5 minutes
    if (recentClicks.length >= CONFIG.MIN_MOUSE_CLICKS) {
        // Trigger tip
        showTip();
        // Clear tracked events to avoid immediate re-trigger
        mouseClicks = [];
        keyboardPresses = [];
    }
}

/**
 * Show the keyboard usage tip
 * Can be shown multiple times per session (only respects permanent dismissal)
 */
function showTip() {
    if (isDismissed()) return;
    
    const title = 'Hr. Flango har et tip! 😄';
    const body = `
        <div style="display: flex; align-items: center; gap: 20px;">
            <img src="Icons/webp/Avatar/Ekspedient-mand-Flango1.webp" alt="Hr. Flango" style="width: 120px; height: auto; flex-shrink: 0;">
            <div style="text-align: left; line-height: 1.6;">
                Du er hurtig med musen! 😄 Vil du være endnu hurtigere?<br><br>
                <strong>Prøv tastaturet:</strong><br>
                • Åben brugerliste med <kbd style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px; border: 1px solid #ccc;">TAB</kbd> eller <kbd style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px; border: 1px solid #ccc;">+</kbd><br>
                • Vælg produkter med <kbd style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px; border: 1px solid #ccc;">1-9</kbd><br>
                • Gennemfør køb med <kbd style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px; border: 1px solid #ccc;">ENTER</kbd>
            </div>
        </div>
    `;
    
    showKeyboardTipModal(title, body);
}

/**
 * Show keyboard tip modal with custom buttons
 */
function showKeyboardTipModal(title, body) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('keyboard-tip-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'keyboard-tip-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h2 id="keyboard-tip-title">${title}</h2>
                    <span class="close-btn">&times;</span>
                </div>
                <div id="keyboard-tip-body" style="padding: 20px;"></div>
                <div id="keyboard-tip-buttons" style="display: flex; gap: 10px; padding: 20px; justify-content: flex-end; border-top: 1px solid #ddd;">
                    <button id="keyboard-tip-guide-btn" class="action-button" style="background-color: var(--info-color);">Se guide</button>
                    <button id="keyboard-tip-dismiss-btn" class="action-button secondary-action">Vis ikke igen</button>
                    <button id="keyboard-tip-close-btn" class="action-button">Luk</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Add event listeners
        const closeBtn = modal.querySelector('.close-btn');
        const guideBtn = document.getElementById('keyboard-tip-guide-btn');
        const dismissBtn = document.getElementById('keyboard-tip-dismiss-btn');
        const closeBtn2 = document.getElementById('keyboard-tip-close-btn');
        
        const close = () => {
            modal.style.display = 'none';
        };
        
        closeBtn?.addEventListener('click', close);
        closeBtn2?.addEventListener('click', close);
        
        guideBtn?.addEventListener('click', () => {
            close();
            // Open help modal
            openHelpManually();
        });
        
        dismissBtn?.addEventListener('click', () => {
            markDismissed();
            close();
        });
    }
    
    // Update content
    const titleEl = document.getElementById('keyboard-tip-title');
    const bodyEl = document.getElementById('keyboard-tip-body');
    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.innerHTML = body;
    
    // Show modal
    modal.style.display = 'flex';
}

/**
 * Initialize tracking for product buttons
 */
function trackProductButtons(productsContainer) {
    if (!productsContainer) return;
    
    // Use event delegation on the container
    productsContainer.addEventListener('click', (event) => {
        const btn = event.target.closest('.product-btn');
        if (btn && !btn.disabled) {
            recordMouseClick('product');
        }
    }, true);
}

/**
 * Initialize tracking for select user button
 */
function trackSelectUserButton(button) {
    if (!button) return;
    
    button.addEventListener('click', () => {
        recordMouseClick('selectUser');
    }, true);
}

/**
 * Initialize tracking for complete purchase button
 */
function trackCompletePurchaseButton(button) {
    if (!button) return;
    
    button.addEventListener('click', () => {
        recordMouseClick('completePurchase');
    }, true);
}

/**
 * Initialize keyboard tracking
 */
function initKeyboardTracking() {
    document.addEventListener('keydown', (event) => {
        // Only track when no modal is open and not typing in input
        if (document.querySelector('.modal[style*="display: flex"]') || 
            event.target.tagName === 'INPUT' || 
            event.target.tagName === 'TEXTAREA') {
            return;
        }
        
        // Track digits 1-9
        if (event.key >= '1' && event.key <= '9') {
            recordKeyboardPress(event.key);
        }
        // Track Enter key
        else if (event.key === 'Enter') {
            recordKeyboardPress('Enter');
        }
    }, true);
}

/**
 * Initialize the keyboard usage tip system
 */
export function initKeyboardUsageTip(options = {}) {
    const {
        productsContainer,
        selectUserButton,
        completePurchaseButton,
    } = options;
    
    if (isDismissed()) {
        return; // Don't track if permanently dismissed
    }
    
    isTracking = true;
    
    // Initialize tracking
    if (productsContainer) {
        trackProductButtons(productsContainer);
    }
    
    if (selectUserButton) {
        trackSelectUserButton(selectUserButton);
    }
    
    if (completePurchaseButton) {
        trackCompletePurchaseButton(completePurchaseButton);
    }
    
    initKeyboardTracking();
}
