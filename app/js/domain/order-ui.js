// js/domain/order-ui.js
import { getOrderTotal, setOrder, getOrder } from './order-store.js';
import { getProductIconInfo, addProductToOrder, removeProductFromOrder, getBulkDiscountSummary } from './products-and-cart.js';
import { canChildPurchase } from './purchase-limits.js';
import { playSound } from '../ui/sound-and-alerts.js';
import { getCurrentCustomer, clearEvaluation } from './cafe-session-store.js';
import { MAX_ITEMS_PER_ORDER } from '../core/constants.js';
import { formatKr } from '../ui/confirm-modals.js';
import { getCurrentTheme } from '../ui/theme-loader.js';
import { updateKlartCartCountBadge } from './app-ui-updates.js';

/**
 * Tjekker om den nuværende kunde er en admin med gratis-køb
 */
function isCurrentCustomerFreeAdmin() {
    const customer = getCurrentCustomer();
    if (!customer || customer.role !== 'admin') return false;
    return window.__flangoInstitutionSettings?.adminsPurchaseFree || false;
}

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
    const isFreeAdmin = isCurrentCustomerFreeAdmin() && currentOrder.length > 0;
    const isKlart = getCurrentTheme() === 'klart';

    totalPriceEl.replaceChildren();

    if (isMobile) {
        if (isFreeAdmin) {
            const mobileNode = buildMiniReceiptNode(total);
            const totalValueEl = mobileNode.querySelector('#total-price-value');
            if (totalValueEl) {
                totalValueEl.textContent = '';
                const strikeEl = document.createElement('s');
                strikeEl.style.opacity = '0.5';
                strikeEl.textContent = `${total.toFixed(2)} DKK`;
                totalValueEl.appendChild(document.createTextNode('Total: '));
                totalValueEl.appendChild(strikeEl);
                totalValueEl.appendChild(document.createTextNode(' '));
                const badge = document.createElement('span');
                badge.className = 'free-admin-badge-inline';
                badge.textContent = 'GRATIS';
                totalValueEl.appendChild(badge);
            }
            totalPriceEl.appendChild(mobileNode);
        } else {
            totalPriceEl.appendChild(buildMiniReceiptNode(total));
        }
        return;
    }

    if (isKlart) {
        // Klart: mini emoji icons + total value in Fraunces
        const iconsWrap = document.createElement('div');
        iconsWrap.className = 'klart-total-icons';

        if (currentOrder.length > 0) {
            currentOrder.forEach((item, idx) => {
                if (idx > 0) {
                    const plus = document.createElement('span');
                    plus.className = 'klart-total-plus';
                    plus.textContent = '+';
                    iconsWrap.appendChild(plus);
                }
                const miniIcon = document.createElement('span');
                miniIcon.className = 'klart-total-mini-icon';
                const iconInfo = getProductIconInfo(item);
                if (iconInfo?.path) {
                    const img = document.createElement('img');
                    img.src = iconInfo.path;
                    img.alt = '';
                    miniIcon.appendChild(img);
                } else {
                    miniIcon.textContent = item?.emoji || '❓';
                }
                iconsWrap.appendChild(miniIcon);
            });
            const eq = document.createElement('span');
            eq.className = 'klart-total-equals';
            eq.textContent = '=';
            iconsWrap.appendChild(eq);
        } else {
            const dash = document.createElement('span');
            dash.style.color = 'var(--klart-ink-muted)';
            dash.style.fontSize = '13px';
            dash.textContent = '—';
            iconsWrap.appendChild(dash);
        }

        totalPriceEl.appendChild(iconsWrap);

        const totalAmount = document.createElement('div');
        totalAmount.className = 'klart-total-amount';

        if (isFreeAdmin) {
            const strikeEl = document.createElement('s');
            strikeEl.style.opacity = '0.5';
            strikeEl.className = 'klart-total-val';
            strikeEl.textContent = `${total.toFixed(0)} kr.`;
            totalAmount.appendChild(strikeEl);
            const badge = document.createElement('span');
            badge.className = 'free-admin-badge-inline';
            badge.textContent = 'GRATIS';
            totalAmount.appendChild(badge);
        } else {
            const valSpan = document.createElement('span');
            valSpan.className = 'klart-total-val';
            valSpan.textContent = `${total.toFixed(0)} kr.`;
            totalAmount.appendChild(valSpan);
        }
        totalPriceEl.appendChild(totalAmount);
        return;
    }

    // Default theme rendering
    const summary = buildProductIconSummaryNode(currentOrder);
    if (summary) totalPriceEl.appendChild(summary);

    if (isFreeAdmin) {
        const totalWrap = document.createElement('span');
        totalWrap.className = 'total-text';
        totalWrap.appendChild(document.createTextNode('Total: '));
        const strikeEl = document.createElement('s');
        strikeEl.style.opacity = '0.5';
        strikeEl.textContent = `${total.toFixed(2)} DKK`;
        totalWrap.appendChild(strikeEl);
        totalWrap.appendChild(document.createTextNode(' '));
        const badge = document.createElement('span');
        badge.className = 'free-admin-badge-inline';
        badge.textContent = 'GRATIS';
        totalWrap.appendChild(badge);
        totalPriceEl.appendChild(totalWrap);
    } else {
        const totalText = document.createElement('span');
        totalText.className = 'total-text';
        totalText.textContent = `Total: ${total.toFixed(2)} DKK`;
        totalPriceEl.appendChild(totalText);
    }
}

/**
 * Generates product icon summary showing Icon + Icon = total
 */
function buildProductIconSummaryNode(currentOrder) {
    if (!currentOrder || currentOrder.length === 0) {
        return null;
    }

    let hasBulkDiscount = false;
    const productCounts = new Map();
    const sampleById = new Map();
    const bulkDisabledById = new Map();
    currentOrder.forEach((item) => {
        const productId = item?.product_id || item?.productId || item?.id;
        if (productId == null) return;
        const qty = Number.isFinite(item?.quantity) ? item.quantity : 1;
        const key = String(productId);
        productCounts.set(key, (productCounts.get(key) || 0) + qty);
        if (!sampleById.has(key)) {
            sampleById.set(key, item);
        }
        if (item?._bulkDiscountDisabled === true) {
            bulkDisabledById.set(key, true);
        }
    });
    productCounts.forEach((count, key) => {
        const product = sampleById.get(key);
        const summary = getBulkDiscountSummary(product, count, { disableDiscount: bulkDisabledById.get(key) === true });
        if (summary.discountAmount > 0) {
            hasBulkDiscount = true;
        }
    });

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

    if (hasBulkDiscount) {
        const plus = document.createElement('span');
        plus.className = 'plus-sign';
        plus.textContent = '+';
        wrap.appendChild(plus);

        const tag = document.createElement('span');
        tag.className = 'discount-tag-icon';
        tag.textContent = '🏷️';
        wrap.appendChild(tag);
    }

    const eq = document.createElement('span');
    eq.className = 'equals-sign';
    eq.textContent = '=';
    wrap.appendChild(eq);

    return wrap;
}

/**
 * Renders the klart total-divider bar in checkout-stack (permanent separator)
 */
export function renderKlartTotalDivider(items, total) {
    if (getCurrentTheme() !== 'klart') return;
    const checkoutStack = document.getElementById('checkout-stack');
    if (!checkoutStack) return;

    checkoutStack.querySelector('.klart-total-spacer')?.remove();
    checkoutStack.querySelector('.klart-total-divider')?.remove();

    const spacer = document.createElement('div');
    spacer.className = 'klart-total-divider klart-total-spacer';

    const totalDiv = document.createElement('div');
    totalDiv.className = 'klart-total-divider';

    const iconsWrap = document.createElement('div');
    iconsWrap.className = 'klart-total-icons';
    if (items.length > 0) {
        items.forEach((item, idx) => {
            if (idx > 0) {
                const plus = document.createElement('span');
                plus.className = 'klart-total-plus';
                plus.textContent = '+';
                iconsWrap.appendChild(plus);
            }
            const miniIcon = document.createElement('span');
            miniIcon.className = 'klart-total-mini-icon';
            const iconInfo = getProductIconInfo(item);
            if (iconInfo?.path) {
                const img = document.createElement('img');
                img.src = iconInfo.path;
                img.alt = '';
                miniIcon.appendChild(img);
            } else {
                miniIcon.textContent = item?.emoji || '❓';
            }
            iconsWrap.appendChild(miniIcon);
        });
        const eq = document.createElement('span');
        eq.className = 'klart-total-equals';
        eq.textContent = '=';
        iconsWrap.appendChild(eq);
    } else {
        const dash = document.createElement('span');
        dash.style.cssText = 'color:var(--klart-ink-muted);font-size:13px';
        dash.textContent = '—';
        iconsWrap.appendChild(dash);
    }
    totalDiv.appendChild(iconsWrap);

    const totalAmount = document.createElement('div');
    totalAmount.className = 'klart-total-amount';
    const isFreeAdminCheck = isCurrentCustomerFreeAdmin() && items.length > 0;
    if (isFreeAdminCheck) {
        const strikeEl = document.createElement('s');
        strikeEl.style.opacity = '0.5';
        strikeEl.className = 'klart-total-val';
        strikeEl.textContent = `${total.toFixed(0)} kr.`;
        totalAmount.appendChild(strikeEl);
        const badge = document.createElement('span');
        badge.className = 'free-admin-badge-inline';
        badge.textContent = 'GRATIS';
        totalAmount.appendChild(badge);
    } else {
        const valSpan = document.createElement('span');
        valSpan.className = 'klart-total-val';
        valSpan.textContent = `${total.toFixed(0)} kr.`;
        totalAmount.appendChild(valSpan);
    }
    totalDiv.appendChild(totalAmount);

    const btnArea = checkoutStack.querySelector('#user-selection-area');
    if (btnArea) {
        btnArea.parentNode.insertBefore(totalDiv, btnArea);
        totalDiv.parentNode.insertBefore(spacer, totalDiv);
    } else {
        checkoutStack.appendChild(spacer);
        checkoutStack.appendChild(totalDiv);
    }
}

export function renderOrder(orderListEl, currentOrder, totalPriceEl, updateSelectedUserInfo) {
    const isKlart = getCurrentTheme() === 'klart';

    // Update klart count badge
    if (isKlart) {
        updateKlartCartCountBadge(currentOrder.length);
    }

    if (currentOrder.length === 0) {
        orderListEl.replaceChildren();
        if (isKlart) {
            // Klart empty state
            const emptyEl = document.createElement('li');
            emptyEl.className = 'klart-cart-empty';
            const icon = document.createElement('div');
            icon.className = 'klart-cart-empty-icon';
            icon.textContent = '🛒';
            const text = document.createElement('div');
            text.textContent = 'Kurven er tom';
            emptyEl.appendChild(icon);
            emptyEl.appendChild(text);
            orderListEl.appendChild(emptyEl);

            // Render empty total-divider (permanent separator)
            renderKlartTotalDivider([], 0);
        }
        updateTotalPrice(totalPriceEl);
        if (typeof updateSelectedUserInfo === 'function') {
            updateSelectedUserInfo();
        }
        return;
    }

    const fragment = document.createDocumentFragment();

    // Gratis admin-køb banner
    if (isCurrentCustomerFreeAdmin() && currentOrder.length > 0) {
        const banner = document.createElement('li');
        banner.className = isKlart ? 'klart-admin-free-banner' : 'admin-free-banner';
        banner.innerHTML = '<span style="font-size: 18px;">&#x267E;</span> <span>Gratis &mdash; Medarbejdere betaler ikke</span>';
        fragment.appendChild(banner);
    }

    // Klart: "Valgte varer" section label
    if (isKlart) {
        const label = document.createElement('li');
        label.className = 'klart-cart-section-label';
        label.textContent = 'Valgte varer';
        fragment.appendChild(label);
    }

    const productCounts = new Map();
    const remainingById = new Map();
    const sampleById = new Map();
    const bulkDisabledById = new Map();
    currentOrder.forEach((item) => {
        const productId = item?.product_id || item?.productId || item?.id;
        if (productId == null) return;
        const qty = Number.isFinite(item?.quantity) ? item.quantity : 1;
        const key = String(productId);
        productCounts.set(key, (productCounts.get(key) || 0) + qty);
        remainingById.set(key, (remainingById.get(key) || 0) + qty);
        if (!sampleById.has(key)) {
            sampleById.set(key, item);
        }
        if (item?._bulkDiscountDisabled === true) {
            bulkDisabledById.set(key, true);
        }
    });

    currentOrder.forEach((item, index) => {
        const listItem = document.createElement('li');

        if (isKlart) {
            // --- Klart card-style item ---
            listItem.className = 'klart-cart-item';
            listItem.style.animationDelay = `${index * 50}ms`;

            // Emoji/icon box
            const iconBox = document.createElement('div');
            iconBox.className = 'klart-cart-icon-box';
            const iconInfo = getProductIconInfo(item);
            if (iconInfo?.path) {
                const img = document.createElement('img');
                img.src = iconInfo.path;
                img.alt = item?.name || 'Produkt';
                img.className = 'klart-cart-icon-img';
                iconBox.appendChild(img);
            } else {
                iconBox.textContent = item?.emoji || '❓';
            }

            // Text block: name only
            const textBlock = document.createElement('div');
            textBlock.className = 'klart-cart-text';
            const nameEl = document.createElement('div');
            nameEl.className = 'klart-cart-item-name';
            nameEl.textContent = item.name || 'Ukendt';
            textBlock.appendChild(nameEl);

            // Price
            const priceEl = document.createElement('div');
            priceEl.className = 'klart-cart-item-price';
            priceEl.textContent = `${Number(item.price || 0).toFixed(0)} kr.`;

            // Circle X remove button
            const removeBtn = document.createElement('button');
            removeBtn.className = 'klart-cart-remove-btn remove-item-btn';
            removeBtn.dataset.index = String(index);
            removeBtn.title = 'Fjern vare';
            removeBtn.type = 'button';
            // X icon as SVG
            removeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

            listItem.appendChild(iconBox);
            listItem.appendChild(textBlock);
            listItem.appendChild(priceEl);
            listItem.appendChild(removeBtn);
        } else {
            // --- Default rendering ---
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
        }

        fragment.appendChild(listItem);

        // Bulk discount line (shared logic, both themes)
        const productId = item?.product_id || item?.productId || item?.id;
        if (productId != null) {
            const key = String(productId);
            if (remainingById.has(key)) {
                const qty = Number.isFinite(item?.quantity) ? item.quantity : 1;
                const remaining = (remainingById.get(key) || 0) - qty;
                remainingById.set(key, remaining);
                if (remaining <= 0) {
                    const count = productCounts.get(key) || 0;
                    const product = sampleById.get(key) || item;
                    const summary = getBulkDiscountSummary(product, count, { disableDiscount: bulkDisabledById.get(key) === true });
                    if (summary.discountAmount > 0) {
                        const discountItem = document.createElement('li');
                        discountItem.className = isKlart ? 'klart-cart-item klart-cart-discount' : '';
                        const discountLine = document.createElement('span');
                        discountLine.className = 'cart-product-line';
                        const bundleLabel = summary.bundlePrice != null
                            ? formatKr(summary.bundlePrice).replace(' kr', '')
                            : '';
                        const label = bundleLabel
                            ? `🏷️ Rabat (${summary.qtyRule} for ${bundleLabel})`
                            : `🏷️ Rabat`;
                        const discountText = document.createElement('span');
                        discountText.textContent = `${label}: -${formatKr(summary.discountAmount)}`;
                        discountLine.appendChild(discountText);

                        const discountRemoveBtn = document.createElement('span');
                        discountRemoveBtn.className = 'remove-item-btn';
                        discountRemoveBtn.dataset.index = String(index);
                        discountRemoveBtn.dataset.action = 'disable-bulk';
                        discountRemoveBtn.dataset.productId = key;
                        discountRemoveBtn.title = 'Fjern vare';

                        const discountTrash = document.createElement('img');
                        discountTrash.src = 'Icons/webp/Function/Papirkurv.webp';
                        discountTrash.alt = 'Fjern';
                        discountTrash.className = 'cart-remove-icon';
                        discountRemoveBtn.appendChild(discountTrash);

                        discountItem.appendChild(discountLine);
                        discountItem.appendChild(discountRemoveBtn);
                        fragment.appendChild(discountItem);
                    }
                }
            }
        }
    });

    orderListEl.replaceChildren(fragment);

    // Klart: render total-divider in checkout-stack (before buttons)
    if (isKlart) {
        renderKlartTotalDivider(currentOrder, getOrderTotal());
    }

    updateTotalPrice(totalPriceEl);
    if (typeof updateSelectedUserInfo === 'function') {
        updateSelectedUserInfo();
    }
}

export function handleOrderListClick(event, currentOrder, rerender, onOrderChanged) {
    const removeBtn = event.target.closest('.remove-item-btn');
    if (!removeBtn) return;

    const action = removeBtn.dataset.action || '';
    if (action === 'disable-bulk') {
        const productId = removeBtn.dataset.productId;
        if (!productId) return;
        let changed = false;
        currentOrder.forEach((item) => {
            const itemId = item?.product_id || item?.productId || item?.id;
            if (itemId != null && String(itemId) === String(productId)) {
                if (item._bulkDiscountDisabled !== true) {
                    item._bulkDiscountDisabled = true;
                    changed = true;
                }
            }
        });
        if (changed) {
            try {
                setOrder([...currentOrder]);
            } catch (err) {
                console.warn('[order-store] sync failed after bulk discount disable:', err);
            }
            clearEvaluation();
            if (typeof rerender === 'function') {
                rerender();
            }
            if (typeof onOrderChanged === 'function') {
                onOrderChanged({ skipSnapshotRefresh: true });
            }
        }
        return;
    }

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

    // === CALCULATOR ITEMS: Skip ALLE limit-checks ===
    if (product && product.is_calculator_item) {
        currentOrder.push(product);
        try { setOrder([...currentOrder]); } catch {}
        clearEvaluation();
        playSound('addItem');
        renderOrder(orderListEl, currentOrder, totalPriceEl, updateSelectedUserInfo);
        if (typeof onOrderChanged === 'function') onOrderChanged();
        return { success: true };
    }

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
