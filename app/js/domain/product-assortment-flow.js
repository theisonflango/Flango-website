import { getCurrentCustomer } from './cafe-session-store.js';
import { applyProductLimitsToButtons, getProductIconInfo } from './products-and-cart.js';

let flangoReorderMode = false;
let flangoLongPressTimer = null;
let flangoDraggedCard = null;

function enableReorderMode() {
    if (flangoReorderMode) return;
    flangoReorderMode = true;
    document.body.classList.add('reorder-mode');
    document.querySelectorAll('#products .product-btn').forEach(card => {
        card.setAttribute('draggable', 'true');
    });
}

function disableReorderMode() {
    if (!flangoReorderMode) return;
    flangoReorderMode = false;
    document.body.classList.remove('reorder-mode');
    document.querySelectorAll('#products .product-btn').forEach(card => {
        card.removeAttribute('draggable');
        card.classList.remove('dragging');
    });
    if (flangoDraggedCard) {
        flangoDraggedCard.classList.remove('dragging');
        flangoDraggedCard = null;
    }
    if (flangoLongPressTimer) {
        clearTimeout(flangoLongPressTimer);
        flangoLongPressTimer = null;
    }
}

function handleLongPressStart(e) {
    if (flangoReorderMode) return;
    if (flangoLongPressTimer) {
        clearTimeout(flangoLongPressTimer);
    }
    flangoLongPressTimer = window.setTimeout(() => {
        flangoLongPressTimer = null;
        enableReorderMode();
    }, 2000);
}

function handleLongPressEnd() {
    if (flangoLongPressTimer) {
        clearTimeout(flangoLongPressTimer);
        flangoLongPressTimer = null;
    }
}

document.addEventListener('keydown', (e) => {
    if (flangoReorderMode && e.key === 'Enter') {
        e.preventDefault();
        if (typeof e.stopImmediatePropagation === 'function') {
            e.stopImmediatePropagation();
        } else {
            e.stopPropagation();
        }
        disableReorderMode();
        return;
    }
    if (e.key === 'Escape') {
        disableReorderMode();
    }
});

export function setupProductAssortmentFlow({
    adminProfile,
    supabaseClient,
    showAlert,
    getAllProducts,
    setAllProducts,
    getCurrentOrder,
    productsContainer,
    orderList,
    totalPriceEl,
    updateSelectedUserInfo,
    renderProductsGrid,
    renderProductsInModal,
    modalProductList,
    assortmentModal,
    parentPortalAdminUI,
    addToOrder,
}) {
    async function saveProductOrder() {
        const container = document.getElementById('products');
        if (!container) return;
        const cards = Array.from(container.querySelectorAll('.product-btn'));
        const currentProducts = typeof getAllProducts === 'function' ? (getAllProducts() || []) : [];
        const seen = new Set();
        const updates = [];

        cards.forEach((card, index) => {
            const productId = card.dataset.productId;
            if (!productId) return;
            const normalizedId = String(productId);
            updates.push({ id: normalizedId, sort_order: index });
            seen.add(normalizedId);
        });

        let orderIndex = updates.length;
        currentProducts.forEach(product => {
            const pid = product?.id;
            if (pid == null) return;
            const normalizedId = String(pid);
            if (seen.has(normalizedId)) return;
            updates.push({ id: normalizedId, sort_order: orderIndex });
            orderIndex += 1;
        });

        if (updates.length === 0) return;

        try {
            const results = await Promise.all(
                updates.map(({ id, sort_order }) =>
                    supabaseClient.from('products').update({ sort_order }).eq('id', id)
                )
            );
            const firstError = results.find(res => res?.error)?.error;
            if (firstError) {
                console.warn('[product reorder] save error:', firstError.message);
            }
            if (typeof getAllProducts === 'function' && typeof setAllProducts === 'function') {
                const productMap = new Map(currentProducts.map(p => [String(p.id), p]));
                const reordered = updates
                    .map(({ id, sort_order }) => {
                        const product = productMap.get(String(id));
                        if (!product) return null;
                        return { ...product, sort_order };
                    })
                    .filter(Boolean);
                setAllProducts(reordered);
            }
        } catch (err) {
            console.warn('[product reorder] unexpected save error:', err);
        }
    }

    function handleDragStart(e) {
        if (!flangoReorderMode) {
            e.preventDefault();
            return;
        }
        flangoDraggedCard = e.currentTarget;
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', '');
        }
        flangoDraggedCard.classList.add('dragging');
    }

    function handleDragOver(e) {
        if (!flangoReorderMode || !flangoDraggedCard) return;
        e.preventDefault();
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'move';
        }
    }

    async function handleDrop(e) {
        if (!flangoReorderMode || !flangoDraggedCard) return;
        e.preventDefault();
        const target = e.currentTarget;
        if (!target || target === flangoDraggedCard) return;
        const container = document.getElementById('products');
        if (!container) return;
        const cards = Array.from(container.children);
        const draggedIndex = cards.indexOf(flangoDraggedCard);
        const targetIndex = cards.indexOf(target);
        if (draggedIndex === -1 || targetIndex === -1) return;

        if (draggedIndex < targetIndex) {
            container.insertBefore(flangoDraggedCard, target.nextSibling);
        } else {
            container.insertBefore(flangoDraggedCard, target);
        }
        await saveProductOrder();

        // KRITISK: Opdater produkt-numre efter drag-and-drop
        updateProductShortcutNumbers(container);
    }

    function updateProductShortcutNumbers(container) {
        if (!container) return;
        const cards = Array.from(container.querySelectorAll('.product-btn'));
        cards.forEach((card, index) => {
            const shortcut = card.querySelector('.product-shortcut');
            if (shortcut && index < 10) {
                // Opdater nummeret til den nye position
                shortcut.textContent = index === 9 ? 0 : index + 1;
            } else if (shortcut && index >= 10) {
                // Fjern numre for produkter efter position 10
                shortcut.remove();
            } else if (!shortcut && index < 10) {
                // Tilføj nummer hvis produktet nu er i top 10
                const inner = card.querySelector('.product-btn-inner');
                if (inner) {
                    const newShortcut = document.createElement('div');
                    newShortcut.className = 'product-shortcut';
                    newShortcut.textContent = index === 9 ? 0 : index + 1;
                    inner.appendChild(newShortcut);
                }
            }
        });
    }

    function handleDragEnd() {
        if (flangoDraggedCard) {
            flangoDraggedCard.classList.remove('dragging');
            flangoDraggedCard = null;
        }
    }

    function initProductReorder() {
        if (!productsContainer) return;
        const cards = productsContainer.querySelectorAll('.product-btn');
        cards.forEach(card => {
            card.addEventListener('mousedown', handleLongPressStart);
            card.addEventListener('touchstart', handleLongPressStart, { passive: true });
            card.addEventListener('mouseup', handleLongPressEnd);
            card.addEventListener('mouseleave', handleLongPressEnd);
            card.addEventListener('touchend', handleLongPressEnd);
            card.addEventListener('touchcancel', handleLongPressEnd);
            card.addEventListener('dragstart', handleDragStart);
            card.addEventListener('dragover', handleDragOver);
            card.addEventListener('drop', handleDrop);
            card.addEventListener('dragend', handleDragEnd);
            if (flangoReorderMode) {
                card.setAttribute('draggable', 'true');
            }
        });
        if (!flangoReorderMode) {
            cards.forEach(card => card.removeAttribute('draggable'));
        }
    }

    async function fetchAndRenderProducts() {
        const { data, error } = await supabaseClient
            .from('products')
            .select('*')
            .eq('institution_id', adminProfile.institution_id)
            .order('sort_order');
        if (error) {
            showAlert('Fejl ved hentning af produkter: ' + error.message);
            return;
        }
        setAllProducts(data);
        const allProducts = getAllProducts();
        const currentCustomer = getCurrentCustomer();
        const childId = currentCustomer?.id || null;

        // renderProductsGrid er nu async og tager currentCustomer parameter
        await renderProductsGrid(
            allProducts,
            productsContainer,
            async (product, evt) => {
                if (flangoReorderMode) return null;
                const result = await addToOrder(product, getCurrentOrder(), orderList, totalPriceEl, updateSelectedUserInfo, { sourceEvent: evt });
                // VIGTIGT: Brug altid den opdaterede kurv her, og hent childId på ny.
                const currentChildId = getCurrentCustomer()?.id || null;
                await applyProductLimitsToButtons(allProducts, productsContainer, getCurrentOrder(), currentChildId);
                return result;
            },
            currentCustomer // Send currentCustomer så refill kan beregnes
        );
        // Sørg for at alle knapper har et låse-overlay, så CSS kan virke
        productsContainer.querySelectorAll('.product-btn').forEach(btn => {
            if (!btn.querySelector('.product-lock-overlay')) {
                const overlay = document.createElement('div');
                // Brug BEGGE klasser for at matche både avatar- og produkt-specifikke regler
                overlay.className = 'avatar-lock-overlay product-lock-overlay';
                btn.appendChild(overlay);
            }
        });
        initProductReorder();
        await applyProductLimitsToButtons(allProducts, productsContainer, getCurrentOrder(), childId);
        renderProductsInModal(allProducts, modalProductList);
    }

    function renderAssortmentModal() {
        const assortmentSettings = document.getElementById('assortment-settings');
        const assortmentList = document.getElementById('assortment-list');
        const sortedProducts = [...getAllProducts()]
            .filter(p => p.is_enabled !== false)
            .sort((a, b) => a.sort_order - b.sort_order);

        // OPTIMERING: Brug DocumentFragment + replaceChildren for bedre performance
        const fragment = document.createDocumentFragment();
        sortedProducts.forEach(product => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'item';
            itemDiv.dataset.productId = product.id;
            const iconInfo = getProductIconInfo(product);
            const visualMarkup = iconInfo
                ? `<img src="${iconInfo.path}" alt="${product.name || 'Produkt'}" class="product-icon-small">`
                : `<span class="assortment-emoji">${product.emoji || '❓'}</span>`;
            itemDiv.innerHTML = `<label for="assortment-${product.id}">${visualMarkup} ${product.name}</label><input type="checkbox" id="assortment-${product.id}" data-product-id="${product.id}" ${product.is_visible !== false ? 'checked' : ''}>`;
            fragment.appendChild(itemDiv);
        });
        assortmentList.replaceChildren(fragment);

        new Sortable(assortmentList, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: async (evt) => {
                const reorderedIds = Array.from(evt.target.children).map(item => item.dataset.productId);
                const updates = reorderedIds.map((id, index) =>
                    supabaseClient.from('products').update({ sort_order: index }).eq('id', id)
                );

                try {
                    const results = await Promise.all(updates);
                    const firstError = results.find(res => res?.error)?.error;
                    if (firstError) {
                        console.error('[assortment] Fejl ved opdatering af produkt rækkefølge:', firstError);
                        showAlert(`Kunne ikke opdatere rækkefølge: ${firstError.message}`);
                        return;
                    }
                    await fetchAndRenderProducts();
                } catch (err) {
                    console.error('[assortment] Uventet fejl ved opdatering af rækkefølge:', err);
                    showAlert('Der opstod en fejl ved opdatering af rækkefølgen');
                }
            }
        });

        assortmentList.onclick = async (e) => {
            if (e.target.matches('input[type="checkbox"]')) {
                const productId = e.target.dataset.productId;
                const isVisible = e.target.checked;

                // Opdater database og tjek for fejl
                const { error } = await supabaseClient
                    .from('products')
                    .update({ is_visible: isVisible })
                    .eq('id', productId);

                if (error) {
                    console.error('[assortment] Fejl ved opdatering af produkt synlighed:', error);
                    showAlert(`Kunne ikke opdatere produkt: ${error.message}`);
                    // Revert checkbox til den gamle værdi
                    e.target.checked = !isVisible;
                    return;
                }

                // Kun hvis opdateringen lykkedes, hent produkterne igen
                await fetchAndRenderProducts();
            }
        };
    }

    window.__flangoOpenAssortmentModal = () => {
        const assortmentSettings = document.getElementById('assortment-settings');
        if (!assortmentModal) {
            showAlert('Dagens sortiment kan ikke åbnes.');
            return;
        }
        if (parentPortalAdminUI && assortmentSettings) {
            parentPortalAdminUI.setupParentPortalSettings(assortmentSettings);
        }
        renderAssortmentModal();
        assortmentModal.style.display = 'flex';
    };

    return {
        fetchAndRenderProducts,
        initProductReorder, // Eksporter så den kan kaldes efter user selection
    };
}
