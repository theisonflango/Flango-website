import { logDebugEvent } from '../core/debug-flight-recorder.js';

export function setupKeyboardShortcuts({
    getAllProducts,
    getCurrentOrder,
    setCurrentOrder,
    orderListElement,
    totalPriceElement,
    updateSelectedUserInfo,
    selectUserButton,
    completePurchaseButton,
    addToOrder,
    removeLastItemFromOrder,
    closeTopMostOverlay,
    onOrderChanged,
}) {
    // Flight recorder: log keyboard shortcuts setup
    window._flangoKeyboardShortcutsSetupCount = (window._flangoKeyboardShortcutsSetupCount || 0) + 1;
    let callerTag = 'unknown';
    try {
        const stack = new Error().stack?.split('\n') || [];
        const candidate = stack[2] || stack[1] || '';
        callerTag = candidate.replace('at ', '').trim().slice(0, 120) || callerTag;
    } catch (e) { /* ignore */ }
    logDebugEvent('keyboard_shortcuts_setup', {
        callCount: window._flangoKeyboardShortcutsSetupCount,
        caller: callerTag,
    });

    // Remove previous handlers if any (avoid duplicates and stale closures)
    const prevHandlers = window.__flangoKeyboardShortcutsHandlers;
    if (prevHandlers) {
        document.removeEventListener('keydown', prevHandlers.main);
        document.removeEventListener('keydown', prevHandlers.escape);
        document.removeEventListener('keydown', prevHandlers.general);
        document.removeEventListener('keydown', prevHandlers.admin);
    }

    const mainKeydownHandler = (event) => {
        if (event.defaultPrevented) return;
        // Deaktiver shortcuts hvis man er i reorder-mode eller redigerer i et felt
        const isInReorderMode = document.body.classList.contains('reorder-mode');
        const isEditing = event.target.tagName === 'INPUT' || 
                         event.target.tagName === 'TEXTAREA' ||
                         event.target.isContentEditable ||
                         event.target.closest('[contenteditable="true"]');
        
        const isCustomAlertOpen = document.getElementById('custom-alert-modal')?.style?.display === 'flex';
        if (document.querySelector('.modal[style*="display: flex"]') || isCustomAlertOpen || isEditing || isInReorderMode) {
            return;
        }
        
        if (event.key >= '0' && event.key <= '9') {
            if (event.repeat) return;
            event.preventDefault();
            const productIndex = event.key === '0' ? 9 : parseInt(event.key, 10) - 1;
            const visibleProducts = getAllProducts().filter(p => p.is_visible !== false && p.is_enabled !== false);
            if (productIndex < visibleProducts.length) {
                addToOrder(
                    visibleProducts[productIndex],
                    getCurrentOrder(),
                    orderListElement,
                    totalPriceElement,
                    updateSelectedUserInfo,
                    { onOrderChanged }
                );
            }
        } else if (event.key === 'Enter') {
            // Flight recorder: log Enter key in main handler
            logDebugEvent('keyboard_enter_pressed', {
                btnDisabled: completePurchaseButton?.disabled,
                modalOpen: !!document.querySelector('.modal[style*="display: flex"]'),
                willTriggerPurchase: completePurchaseButton && !completePurchaseButton.disabled,
            });
            event.preventDefault();
            if (completePurchaseButton && !completePurchaseButton.disabled) {
                completePurchaseButton.click();
            }
        } else if (event.key === '+' || event.key === 'Tab') {
            event.preventDefault();
            if (selectUserButton) {
                selectUserButton.click();
            }
        } else if (event.key === 'Backspace' || event.key === '-') {
            event.preventDefault();
            const currentOrder = getCurrentOrder();
            if (currentOrder.length > 0) {
                removeLastItemFromOrder(currentOrder, orderListElement, totalPriceElement, updateSelectedUserInfo, onOrderChanged);
                if (typeof setCurrentOrder === 'function') {
                    setCurrentOrder(currentOrder);
                }
            }
        }
    };

    const escapeKeydownHandler = (event) => {
        if (event.defaultPrevented) return;
        // Tillad Escape selv i edit mode (for at lukke modals/overlays)
        if (event.key === 'Escape') {
            // Men ikke hvis man er i midten af at redigere navn/pris
            const isEditing = event.target.isContentEditable || 
                             event.target.tagName === 'INPUT' ||
                             event.target.closest('.product-edit-name, .product-edit-price-input');
            if (!isEditing) {
                closeTopMostOverlay();
            }
        }
    };

    // Generelle keyboard shortcuts (for alle brugere)
    const generalKeydownHandler = (event) => {
        if (event.defaultPrevented) return;
        const key = event.key.toLowerCase();
        const isInReorderMode = document.body.classList.contains('reorder-mode');
        const isTyping = event.target.tagName === 'INPUT' || 
                        event.target.tagName === 'TEXTAREA' ||
                        event.target.isContentEditable ||
                        event.target.closest('[contenteditable="true"]');
        
        // Deaktiver shortcuts i reorder-mode
        if (isInReorderMode) return;

        // H: Åbn/luk historik
        if (key === 'h') {
            const historyModal = document.getElementById('sales-history-modal');
            const isHistoryOpen = historyModal && historyModal.style.display === 'flex';

            // Hvis historik er åben, luk den (selv hvis man skriver i et felt)
            if (isHistoryOpen) {
                event.preventDefault();
                historyModal.style.display = 'none';
                return;
            }

            // Hvis man prøver at åbne, check om vi skriver i et felt
            if (isTyping) return;

            // Åbn historik (kun hvis ingen anden modal er åben)
            event.preventDefault();
            const anyModalOpen = document.querySelector('.modal[style*="display: flex"]');
            if (!anyModalOpen) {
                const historyBtn = document.getElementById('toolbar-history-btn');
                if (historyBtn) {
                    historyBtn.click();
                }
            }
        }
        // S: Åbn/luk indstillinger
        else if (key === 's') {
            const settingsModal = document.getElementById('settings-modal-backdrop');
            const isSettingsOpen = settingsModal && settingsModal.style.display !== 'none' && settingsModal.style.display !== '';

            // Hvis indstillinger er åben, luk den (selv hvis man skriver i et felt)
            if (isSettingsOpen) {
                event.preventDefault();
                settingsModal.style.display = 'none';
                return;
            }

            // Hvis man prøver at åbne, check om vi skriver i et felt
            if (isTyping) return;

            // Åbn indstillinger (kun hvis ingen anden modal er åben)
            event.preventDefault();
            const anyModalOpen = document.querySelector('.modal[style*="display: flex"], .settings-modal-backdrop[style*="display: flex"]');
            if (!anyModalOpen) {
                const settingsBtn = document.getElementById('toolbar-gear-btn');
                if (settingsBtn) {
                    settingsBtn.click();
                }
            }
        }
        // M: Åbn/luk Min Flango
        else if (key === 'm') {
            const myFlangoModal = document.getElementById('avatar-picker-modal');
            const isMinFlangoOpen = myFlangoModal && myFlangoModal.style.display === 'flex';

            // Hvis Min Flango er åben, luk den (selv hvis man skriver i et felt)
            if (isMinFlangoOpen) {
                event.preventDefault();
                myFlangoModal.style.display = 'none';
                return;
            }

            // Hvis man prøver at åbne, check om vi skriver i et felt
            if (isTyping) return;

            // Åbn Min Flango (kun hvis ingen anden modal er åben)
            event.preventDefault();
            const anyModalOpen = document.querySelector('.modal[style*="display: flex"], .settings-modal-backdrop[style*="display: flex"]');
            if (!anyModalOpen) {
                const myFlangoBtn = document.getElementById('logged-in-user-avatar-container');
                if (myFlangoBtn) {
                    myFlangoBtn.click();
                }
            }
        }
    };

    // Admin-only keyboard shortcuts
    const adminKeydownHandler = (event) => {
        if (event.defaultPrevented) return;
        // Skip if typing in input, contenteditable, reorder-mode or modal is open
        const isInReorderMode = document.body.classList.contains('reorder-mode');
        const isEditing = event.target.tagName === 'INPUT' ||
                         event.target.tagName === 'TEXTAREA' ||
                         event.target.isContentEditable ||
                         event.target.closest('[contenteditable="true"]');
        
        if (isEditing || isInReorderMode || document.querySelector('.modal[style*="display: flex"]')) {
            return;
        }

        // Check if admin is logged in
        const isAdmin = window.currentUserIsAdmin === true;
        if (!isAdmin) return;

        const key = event.key.toLowerCase();

        // R eller I: Åbn "Rediger Brugere" / Indbetaling (kun admin)
        if (key === 'r' || key === 'i') {
            event.preventDefault();
            if (typeof window.__flangoOpenAdminUserManager === 'function') {
                window.__flangoOpenAdminUserManager('customers');
            }
        }
    };

    document.addEventListener('keydown', mainKeydownHandler);
    document.addEventListener('keydown', escapeKeydownHandler);
    document.addEventListener('keydown', generalKeydownHandler);
    document.addEventListener('keydown', adminKeydownHandler);

    window.__flangoKeyboardShortcutsHandlers = {
        main: mainKeydownHandler,
        escape: escapeKeydownHandler,
        general: generalKeydownHandler,
        admin: adminKeydownHandler,
    };
}
