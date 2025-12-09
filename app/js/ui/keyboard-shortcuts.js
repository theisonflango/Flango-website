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
    document.addEventListener('keydown', (event) => {
        if (document.querySelector('.modal[style*="display: flex"]') || event.target.tagName === 'INPUT') {
            return;
        }
        if (event.key >= '0' && event.key <= '9') {
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
            event.preventDefault();
            if (document.body.classList.contains('reorder-mode')) {
                return;
            }
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
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeTopMostOverlay();
        }
    });

    // Admin-only keyboard shortcuts
    document.addEventListener('keydown', (event) => {
        // Skip if typing in input or modal is open
        if (event.target.tagName === 'INPUT' ||
            event.target.tagName === 'TEXTAREA' ||
            document.querySelector('.modal[style*="display: flex"]')) {
            return;
        }

        // Check if admin is logged in
        const isAdmin = window.currentUserIsAdmin === true;
        if (!isAdmin) return;

        const key = event.key.toLowerCase();

        // R eller I: Åbn "Rediger Brugere" / Indbetaling
        if (key === 'r' || key === 'i') {
            event.preventDefault();
            if (typeof window.__flangoOpenAdminUserManager === 'function') {
                window.__flangoOpenAdminUserManager('customers');
            }
        }
        // H: Åbn historik
        else if (key === 'h') {
            event.preventDefault();
            const historyBtn = document.getElementById('toolbar-history-btn');
            if (historyBtn) {
                historyBtn.click();
            }
        }
        // S: Åbn indstillinger
        else if (key === 's') {
            event.preventDefault();
            const settingsBtn = document.getElementById('toolbar-gear-btn');
            if (settingsBtn) {
                settingsBtn.click();
            }
        }
        // M: Åbn Min Flango
        else if (key === 'm') {
            event.preventDefault();
            const myFlangoBtn = document.getElementById('logged-in-user-avatar-container');
            if (myFlangoBtn) {
                myFlangoBtn.click();
            }
        }
    });
}
