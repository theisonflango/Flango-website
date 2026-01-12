// js/domain/order-ui.js
import { getOrderTotal, setOrder, getOrder } from './order-store.js';
import { getProductIconInfo, addProductToOrder, removeProductFromOrder } from './products-and-cart.js';
import { canChildPurchase } from './purchase-limits.js';
import { playSound } from '../ui/sound-and-alerts.js';
import { getCurrentCustomer, clearEvaluation } from './cafe-session-store.js';
import { MAX_ITEMS_PER_ORDER } from '../core/constants.js';

/**
 * Genererer mini-kvittering med chips til mobil
 */
function buildMiniReceiptNode(total) {
    const currentOrder = getOrder();

    // Group by product name and count quantities
    const grouped = {};
    currentOrder.forEach(item => {
        if (!grouped[item.name]) {
            grouped[item.name] = 0;
        }
        grouped[item.name]++;
    });

    const entries = Object.entries(grouped);
    const maxChips = 5;
    const visibleEntries = entries.slice(0, maxChips);
    const overflow = entries.length - maxChips;

    const root = document.createElement('div');

    const chipsWrap = document.createElement('div');
    chipsWrap.id = 'mini-receipt-chips';

    if (visibleEntries.length === 0) {
        const empty = document.createElement('span');
        empty.style.opacity = '0.6';
        empty.textContent = 'Tom kurv';
        chipsWrap.appendChild(empty);
    } else {
        visibleEntries.forEach(([name, qty]) => {
            const chip = document.createElement('span');
            chip.className = 'order-chip';
            // IMPORTANT: set dataset via DOM to avoid HTML injection
            chip.dataset.productName = String(name);

            const qtyEl = document.createElement('span');
            qtyEl.className = 'order-chip-qty';
            qtyEl.textContent = `${qty}×`;
            chip.appendChild(qtyEl);

            chip.appendChild(document.createTextNode(` ${name} `));

            const remove = document.createElement('span');
            remove.className = 'order-chip-remove';
            remove.textContent = '×';
            chip.appendChild(remove);

            chipsWrap.appendChild(chip);
        });

        if (overflow > 0) {
            const more = document.createElement('span');
            more.className = 'order-chip order-chip-overflow';
            more.textContent = `+${overflow} flere`;
            chipsWrap.appendChild(more);
        }
    }

    const totalEl = document.createElement('div');
    totalEl.id = 'total-price-value';
    totalEl.textContent = `Total: ${total.toFixed(2)} DKK`;

    root.appendChild(chipsWrap);
    root.appendChild(totalEl);
    return root;
}

export function updateTotalPrice(totalPriceEl) {
    const total = getOrderTotal();
    const isMobile = window.innerWidth <= 767;
    const currentOrder = getOrder();

    // Avoid innerHTML injection: build DOM instead
    totalPriceEl.replaceChildren();

    if (isMobile) {
        totalPriceEl.appendChild(buildMiniReceiptNode(total));
        return;
    }

    const summary = buildProductIconSummaryNode(currentOrder);
    if (summary) totalPriceEl.appendChild(summary);

    const totalText = document.createElement('span');
    totalText.className = 'total-text';
    totalText.textContent = `Total: ${total.toFixed(2)} DKK`;
    totalPriceEl.appendChild(totalText);
}

/**
 * Generates product icon summary showing Icon + Icon = total
 */
function buildProductIconSummaryNode(currentOrder) {
    if (!currentOrder || currentOrder.length === 0) {
        return null;
    }

    const wrap = document.createElement('div');
    wrap.className = 'total-product-summary';

    currentOrder.forEach((item, idx) => {
        const iconInfo = getProductIconInfo(item);
        if (iconInfo?.path) {
            const img = document.createElement('img');
            img.src = iconInfo.path;
            img.alt = item?.name || 'Produkt';
            wrap.appendChild(img);
        } else {
            const emoji = document.createElement('span');
            emoji.style.fontSize = '20px';
            emoji.textContent = item?.emoji || '❓';
            wrap.appendChild(emoji);
        }

        if (idx < currentOrder.length - 1) {
            const plus = document.createElement('span');
            plus.className = 'plus-sign';
            plus.textContent = '+';
            wrap.appendChild(plus);
        }
    });

    const eq = document.createElement('span');
    eq.className = 'equals-sign';
    eq.textContent = '=';
    wrap.appendChild(eq);

    return wrap;
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
        const listItem = document.createElement('li');

        const line = document.createElement('span');
        line.className = 'cart-product-line';

        const iconInfo = getProductIconInfo(item);
        if (iconInfo?.path) {
            const img = document.createElement('img');
            img.src = iconInfo.path;
            img.alt = item?.name || 'Produkt';
            img.className = 'cart-product-icon';
            line.appendChild(img);
        } else {
            const emoji = document.createElement('span');
            emoji.className = 'cart-product-emoji';
            emoji.textContent = item?.emoji || '❓';
            line.appendChild(emoji);
        }

        const text = document.createElement('span');
        text.textContent = `${item.name || 'Ukendt'} - ${Number(item.price || 0).toFixed(2)} DKK`;
        line.appendChild(text);

        const removeBtn = document.createElement('span');
        removeBtn.className = 'remove-item-btn';
        removeBtn.dataset.index = String(index);
        removeBtn.title = 'Fjern vare';

        const trash = document.createElement('img');
        trash.src = 'Icons/webp/Function/Papirkurv.webp';
        trash.alt = 'Fjern';
        trash.className = 'cart-remove-icon';
        removeBtn.appendChild(trash);

        listItem.appendChild(line);
        listItem.appendChild(removeBtn);
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
        // Deterministic sync: avoid sharing mutable array reference
        setOrder([...currentOrder]);
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

    // 3) SUKKERPOLITIK: SYNKRONT client-side check FØRST (ingen server-kald, blokerer race conditions)
    if (childId && productId != null && product?.unhealthy === true) {
        const sugarData = typeof window.__flangoGetSugarData === 'function' ? window.__flangoGetSugarData() : null;
        if (sugarData?.policy) {
            const { policy, snapshot: sugarSnapshot } = sugarData;

            // Tæl usunde produkter allerede i kurven (synkront, ingen API-kald)
            const allProducts = typeof window.__flangoGetAllProducts === 'function' ? window.__flangoGetAllProducts() : [];
            const productMap = new Map(allProducts.map(p => [String(p.id), p]));

            let unhealthyInCart = 0;
            let thisProductInCart = 0;
            for (const line of currentOrder) {
                const lineId = line?.product_id || line?.productId || line?.id;
                if (lineId == null) continue;
                const lineProduct = productMap.get(String(lineId));
                if (lineProduct?.unhealthy === true) {
                    unhealthyInCart++;
                    if (String(lineId) === String(productId)) {
                        thisProductInCart++;
                    }
                }
            }

            // Kombinér snapshot (allerede købt i dag) + kurv
            const totalUnhealthy = (sugarSnapshot?.unhealthyTotal ?? 0) + unhealthyInCart;
            const thisProductTotal = (sugarSnapshot?.unhealthyPerProduct?.[String(productId)] ?? 0) + thisProductInCart;

            // SYNKRONT CHECK: Blokér øjeblikkeligt hvis grænsen er nået
            let blocked = false;
            let blockReason = '';

            if (policy.blockUnhealthy === true) {
                blocked = true;
                blockReason = 'Usunde produkter er blokeret';
            } else if (policy.maxUnhealthyPerDay != null && policy.maxUnhealthyPerDay > 0 && totalUnhealthy >= policy.maxUnhealthyPerDay) {
                blocked = true;
                blockReason = `Maks ${policy.maxUnhealthyPerDay} usunde produkter pr. dag`;
            } else if (policy.maxUnhealthyPerProductPerDay != null && policy.maxUnhealthyPerProductPerDay > 0 && thisProductTotal >= policy.maxUnhealthyPerProductPerDay) {
                blocked = true;
                blockReason = `Maks ${policy.maxUnhealthyPerProductPerDay} af dette produkt pr. dag`;
            }

            if (blocked) {
                // Lås knappen visuelt
                if (productsContainer) {
                    const pid = String(productId);
                    const btn = productsContainer.querySelector(`.product-btn[data-product-id="${pid}"]`);
                    if (btn) {
                        btn.classList.add('product-limit-reached');
                        btn.dataset.sugarLocked = 'true';
                        const overlay = btn.querySelector('.avatar-lock-overlay, .product-lock-overlay');
                        if (overlay) {
                            overlay.classList.add('shake');
                            overlay.addEventListener('animationend', () => overlay.classList.remove('shake'), { once: true });
                        }
                    }
                }
                try { playSound('error'); } catch {}
                return { success: false, reason: 'sugar-policy-sync', message: blockReason };
            }
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
            // Deterministic sync: avoid sharing mutable array reference
            setOrder([...currentOrder]);
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
        // Deterministic sync: avoid sharing mutable array reference
        setOrder([...currentOrder]);
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

/**
 * Fjerner én vare fra kurven baseret på produktnavn (til mini-kurv chips)
 * VIGTIGT: Modtager currentOrder som parameter for at opdatere den lokale variabel i app-main.js
 */
export function removeOneItemByName(productName, currentOrder, orderListEl, totalPriceEl, updateSelectedUserInfo, onOrderChanged) {
    // Find sidste forekomst af produktet med dette navn
    const indexToRemove = currentOrder.map(item => item.name).lastIndexOf(productName);

    if (indexToRemove === -1) {
        console.warn('[removeOneItemByName] Produkt ikke fundet:', productName);
        return false;
    }

    // Fjern varen (muterer currentOrder direkte - opdaterer den lokale variabel i app-main.js)
    currentOrder.splice(indexToRemove, 1);

    try {
        // Deterministic sync: avoid sharing mutable array reference
        setOrder([...currentOrder]);
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

    return true;
}
