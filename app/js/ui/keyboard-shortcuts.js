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
}) {
    document.addEventListener('keydown', (event) => {
        if (document.querySelector('.modal[style*="display: flex"]') || event.target.tagName === 'INPUT') {
            return;
        }
        if (event.key >= '0' && event.key <= '9') {
            event.preventDefault();
            const productIndex = event.key === '0' ? 9 : parseInt(event.key, 10) - 1;
            const visibleProducts = getAllProducts().filter(p => p.is_visible !== false);
            if (productIndex < visibleProducts.length) {
                addToOrder(visibleProducts[productIndex], getCurrentOrder(), orderListElement, totalPriceElement, updateSelectedUserInfo);
            }
        } else if (event.key === 'Enter') {
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
                removeLastItemFromOrder(currentOrder, orderListElement, totalPriceElement, updateSelectedUserInfo);
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
}
