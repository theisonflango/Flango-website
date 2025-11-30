// js/domain/order-ui.js
import { getOrderTotal, setOrder } from './order-store.js';
import { getProductIconInfo, addProductToOrder, removeProductFromOrder } from './products-and-cart.js';
import { playSound } from '../ui/sound-and-alerts.js';

export function updateTotalPrice(totalPriceEl) {
    const total = getOrderTotal();
    totalPriceEl.textContent = `Total: ${total.toFixed(2)} DKK`;
}

export function renderOrder(orderListEl, currentOrder, totalPriceEl, updateSelectedUserInfo) {
    orderListEl.innerHTML = '';
    currentOrder.forEach((item, index) => {
        const iconInfo = getProductIconInfo(item);
        const visualMarkup = iconInfo
            ? `<img src="${iconInfo.path}" alt="${item.name}" class="cart-product-icon">`
            : `<span class="cart-product-emoji">${item.emoji || '❓'}</span>`;
        const listItem = document.createElement('li');
        listItem.innerHTML = `
            <span class="cart-product-line">${visualMarkup}<span>${item.name} - ${item.price.toFixed(2)} DKK</span></span>
            <span class="remove-item-btn" data-index="${index}" title="Fjern vare">
                <img src="Icons/Function/Papirkurv.png" alt="Fjern" class="cart-remove-icon">
            </span>`;
        orderListEl.appendChild(listItem);
    });
    updateTotalPrice(totalPriceEl);
    if (typeof updateSelectedUserInfo === 'function') {
        updateSelectedUserInfo();
    }
}

export function handleOrderListClick(event, currentOrder, rerender) {
    const removeBtn = event.target.closest('.remove-item-btn');
    if (!removeBtn) return;

    const indexToRemove = parseInt(removeBtn.dataset.index, 10);
    if (isNaN(indexToRemove)) return;

    playSound('removeItem');

    currentOrder.splice(indexToRemove, 1);
    try {
        setOrder(currentOrder);
    } catch (err) {
        console.warn('[order-store] sync failed after currentOrder mutation:', err);
    }

    if (typeof rerender === 'function') {
        rerender();
    }
}

export function addToOrder(product, currentOrder, orderListEl, totalPriceEl, updateSelectedUserInfo) {
    const result = addProductToOrder(currentOrder, product);
    if (!result.success) {
        if (result.reason === 'limit') {
            // Begrænsning på antal varer i kurven
            window.__flangoShowAlert?.('Du kan højst have 10 varer i kurven ad gangen.');
        }
        return;
    }

    try {
        setOrder(currentOrder);
    } catch (err) {
        console.warn('[order-store] sync failed after currentOrder mutation:', err);
    }

    playSound('addItem');
    renderOrder(orderListEl, currentOrder, totalPriceEl, updateSelectedUserInfo);
}

export function removeLastItemFromOrder(currentOrder, orderListEl, totalPriceEl, updateSelectedUserInfo) {
    const removed = removeProductFromOrder(currentOrder);
    if (!removed) return;

    try {
        setOrder(currentOrder);
    } catch (err) {
        console.warn('[order-store] sync failed after currentOrder mutation:', err);
    }

    playSound('removeItem');
    renderOrder(orderListEl, currentOrder, totalPriceEl, updateSelectedUserInfo);
}
