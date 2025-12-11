// js/domain/order-ui.js
import { getOrderTotal, setOrder } from './order-store.js';
import { getProductIconInfo, addProductToOrder, removeProductFromOrder } from './products-and-cart.js';
import { canChildPurchase } from './purchase-limits.js';
import { playSound } from '../ui/sound-and-alerts.js';
import { getCurrentCustomer, clearEvaluation } from './cafe-session-store.js';
import { MAX_ITEMS_PER_ORDER } from '../core/constants.js';

export function updateTotalPrice(totalPriceEl) {
    const total = getOrderTotal();
    totalPriceEl.textContent = `Total: ${total.toFixed(2)} DKK`;
}

export function renderOrder(orderListEl, currentOrder, totalPriceEl, updateSelectedUserInfo) {
    if (currentOrder.length === 0) {
        // OPTIMERING: replaceChildren() i stedet for innerHTML = '' (atomic operation)
        orderListEl.replaceChildren();
        updateTotalPrice(totalPriceEl);
        if (typeof updateSelectedUserInfo === 'function') {
            updateSelectedUserInfo();
        }
        return;
    }

    // Use DocumentFragment for batched DOM insertion (reduces reflows)
    const fragment = document.createDocumentFragment();
    currentOrder.forEach((item, index) => {
        const iconInfo = getProductIconInfo(item);
        const visualMarkup = iconInfo
            ? `<img src="${iconInfo.path}" alt="${item.name}" class="cart-product-icon">`
            : `<span class="cart-product-emoji">${item.emoji || '❓'}</span>`;
        const listItem = document.createElement('li');
        listItem.innerHTML = `
            <span class="cart-product-line">${visualMarkup}<span>${item.name} - ${item.price.toFixed(2)} DKK</span></span>
            <span class="remove-item-btn" data-index="${index}" title="Fjern vare">
                <img src="Icons/webp/Function/Papirkurv.webp" alt="Fjern" class="cart-remove-icon">
            </span>`;
        fragment.appendChild(listItem);
    });
    // OPTIMERING: replaceChildren(fragment) i stedet for innerHTML = '' + appendChild
    orderListEl.replaceChildren(fragment);

    updateTotalPrice(totalPriceEl);
    if (typeof updateSelectedUserInfo === 'function') {
        updateSelectedUserInfo();
    }
}

export function handleOrderListClick(event, currentOrder, rerender, onOrderChanged) {
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
    if (typeof onOrderChanged === 'function') {
        // Skip snapshot refresh on remove - it only unlocks products, doesn't lock them
        onOrderChanged({ skipSnapshotRefresh: true });
    }
}

export async function addToOrder(product, currentOrder, orderListEl, totalPriceEl, updateSelectedUserInfo, options = {}) {
    const productsContainer = document.getElementById('products');
    const onOrderChanged = options.onOrderChanged;

    // 1) Hvis produktet allerede er låst visuelt, skal klik kun give feedback
    if (productsContainer && product && product.id != null) {
        const pid = String(product.id);
        const btn = productsContainer.querySelector(`.product-btn[data-product-id="${pid}"]`);
        if (btn && btn.classList.contains('product-limit-reached')) {
            const overlay = btn.querySelector('.avatar-lock-overlay, .product-lock-overlay');
            if (overlay) {
                overlay.classList.add('shake');
                overlay.addEventListener('animationend', () => overlay.classList.remove('shake'), { once: true });
            }
            try { playSound('error'); } catch {}
            return { success: false, reason: 'product-limit' };
        }
    }

    // 2) Tjek med backend om barnet overhovedet må købe denne vare i dag
    const customer = typeof getCurrentCustomer === 'function' ? getCurrentCustomer() : null;
    const childId = customer?.id || null;
    const institutionId = customer?.institution_id || null;
    const productId = product?.id ?? null;

    if (childId && productId != null) {
        try {
            // VIGTIGT: Send `currentOrder` med, så tjekket inkluderer varer i kurven.
            const result = await canChildPurchase(productId, childId, currentOrder, institutionId, product?.name);
            if (result && result.allowed === false) {
                // Barnet har allerede ramt grænsen for denne vare i dag – lås knappen og giv feedback
                if (productsContainer) {
                    const pid = String(productId);
                    const btn = productsContainer.querySelector(`.product-btn[data-product-id="${pid}"]`);
                    if (btn) {
                        btn.classList.add('product-limit-reached');
                        const overlay = btn.querySelector('.avatar-lock-overlay, .product-lock-overlay');
                        if (overlay) {
                            overlay.classList.add('shake');
                            overlay.addEventListener('animationend', () => overlay.classList.remove('shake'), { once: true });
                        }
                    }
                }
                try { playSound('error'); } catch {}
                return { success: false, reason: 'product-limit-backend' };
            }
        } catch (err) {
            console.warn('[addToOrder] canChildPurchase fejl – bruger lokal logik som fallback:', err);
        }
    }

    // Hvis vi ikke har et gyldigt barn eller produkt-id, bruger vi bare normal logik
    return await proceedAdd();

    async function proceedAdd() {
        const result = await addProductToOrder(currentOrder, product);
        if (!result.success) {
            if (result.reason === 'limit') {
                // Begrænsning på antal varer i kurven
                window.__flangoShowAlert?.(`Du kan højst have ${MAX_ITEMS_PER_ORDER} varer i kurven ad gangen.`);
            } else if (result.reason === 'product-limit') {
                try { playSound('error'); } catch {}
            }
            return result;
        }

        try {
            setOrder(currentOrder);
        } catch (err) {
            console.warn('[order-store] sync failed after currentOrder mutation:', err);
        }

        // Clear stale evaluation when cart changes
        clearEvaluation();

        playSound('addItem');
        renderOrder(orderListEl, currentOrder, totalPriceEl, updateSelectedUserInfo);
        if (typeof onOrderChanged === 'function') {
            onOrderChanged();
        }
        return result;
    }
}

export function removeLastItemFromOrder(currentOrder, orderListEl, totalPriceEl, updateSelectedUserInfo, onOrderChanged) {
    const removed = removeProductFromOrder(currentOrder);
    if (!removed) return;

    try {
        setOrder(currentOrder);
    } catch (err) {
        console.warn('[order-store] sync failed after currentOrder mutation:', err);
    }

    // Clear stale evaluation when cart changes
    clearEvaluation();

    playSound('removeItem');
    renderOrder(orderListEl, currentOrder, totalPriceEl, updateSelectedUserInfo);
    if (typeof onOrderChanged === 'function') {
        // Skip snapshot refresh on remove - it only unlocks products, doesn't lock them
        onOrderChanged({ skipSnapshotRefresh: true });
    }
}
