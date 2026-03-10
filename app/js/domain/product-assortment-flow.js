import { getCurrentCustomer } from './cafe-session-store.js';
import { runWithAuthRetry } from '../core/auth-retry.js';
import { applyProductLimitsToButtons, getProductIconInfo } from './products-and-cart.js';
let flangoReorderMode = false;
let flangoLongPressTimer = null;
let flangoDraggedCard = null;
let placeholderSlots = [];
let placeholderCounter = 0;
let placeholderSelection = null;
let pendingPlaceholderCreate = null;
let updateReorderUiState = () => {};
let ensureReorderHintActions = () => null;
let rerenderGridForReorderMode = () => Promise.resolve();

function enableReorderMode() {
    if (flangoReorderMode) return;
    flangoReorderMode = true;
    document.body.classList.add('reorder-mode');
    document.querySelectorAll('#products .product-btn').forEach(card => {
        card.setAttribute('draggable', 'true');
    });
    updateReorderUiState(true);
    ensureReorderHintActions();
    rerenderGridForReorderMode().catch((err) => {
        console.warn('[reorder] Kunne ikke re-render grid i edit mode:', err);
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
    updateReorderUiState(false);
    rerenderGridForReorderMode().catch((err) => {
        console.warn('[reorder] Kunne ikke re-render grid ved exit:', err);
    });
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
    const PLACEHOLDER_NAME = 'Tom plads';
    const REORDER_TOOLTIP_TEXT = 'Træk i produkter for at ændre placering. Tryk ENTER for at fortsætte.';

    const createPlaceholderSlot = (sortOrder) => ({
        placeholder_id: `placeholder-${Date.now()}-${placeholderCounter++}`,
        sort_order: Number.isFinite(sortOrder) ? sortOrder : 9999,
        is_placeholder: true,
        name: PLACEHOLDER_NAME,
        is_visible: true,
        is_enabled: true,
    });

    const buildGridItems = (allProducts) => {
        const visibleProducts = (allProducts || [])
            .filter(p => p?.is_visible !== false && p?.is_enabled !== false)
            .map(p => ({ ...p, is_placeholder: false }));
        // Vis placeholders altid, ikke kun i reorder mode
        const placeholders = placeholderSlots.map(slot => ({
            ...slot,
            name: PLACEHOLDER_NAME,
            is_placeholder: true,
            is_visible: true,
            is_enabled: true,
        }));
        const combined = [...visibleProducts, ...placeholders];
        combined.sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999));
        return combined;
    };

    const ensureGridControls = () => {
        const productsArea = document.getElementById('products-area');
        if (!productsArea) return null;
        let controls = productsArea.querySelector('.product-grid-controls');
        if (controls) return controls;
        controls = document.createElement('div');
        controls.className = 'product-grid-controls';

        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'product-grid-toggle';
        toggleBtn.setAttribute('aria-label', 'Rediger layout');
        toggleBtn.textContent = '⚙️';
        toggleBtn.addEventListener('click', (evt) => {
            evt.preventDefault();
            evt.stopPropagation();
            if (flangoReorderMode) {
                disableReorderMode();
            } else {
                enableReorderMode();
            }
        });

        controls.appendChild(toggleBtn);
        productsArea.appendChild(controls);
        return controls;
    };

    updateReorderUiState = (isActive) => {
        ensureGridControls();
        const hint = document.getElementById('product-reorder-hint');
        if (!hint) return;
        hint.textContent = REORDER_TOOLTIP_TEXT;
    };

    ensureReorderHintActions = () => {
        const hint = document.getElementById('product-reorder-hint');
        if (!hint) return null;
        let addBtn = hint.querySelector('.product-reorder-add-btn');
        if (addBtn) return addBtn;
        addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'product-reorder-add-btn';
        addBtn.textContent = 'Tilføj Produkt (+)';
        addBtn.addEventListener('click', async (evt) => {
            evt.preventDefault();
            evt.stopPropagation();
            if (!flangoReorderMode) return;
            const allProducts = typeof getAllProducts === 'function' ? (getAllProducts() || []) : [];
            const gridItems = buildGridItems(allProducts);
            const sortOrder = gridItems.length;
            const slot = createPlaceholderSlot(sortOrder);
            placeholderSlots.push(slot);
            await renderProductsFromLocalState(allProducts);
        });
        hint.appendChild(addBtn);
        return addBtn;
    };

    rerenderGridForReorderMode = async () => {
        const allProducts = getAllProducts() || [];
        if (!allProducts.length) return;
        await renderProductsFromLocalState(allProducts);
        // Ensure drag handlers are set up after re-render
        initProductReorder();
    };

    const updatePlaceholderOrderFromDom = (cards) => {
        if (!Array.isArray(cards) || placeholderSlots.length === 0) return;
        const next = [];
        cards.forEach((card, index) => {
            const placeholderId = card.dataset.placeholderId;
            if (!placeholderId) return;
            const slot = placeholderSlots.find(p => p.placeholder_id === placeholderId);
            if (!slot) {
                console.warn('[placeholder] Ukendt placeholder i DOM:', placeholderId);
                return;
            }
            next.push({ ...slot, sort_order: index });
        });
        if (next.length > 0) {
            placeholderSlots = next;
        }
    };

    const hideProductFromGrid = async (productId) => {
        if (!productId) {
            console.warn('[grid] Mangler productId ved fjern');
            return;
        }
        try {
            // OPTIMISTISK UPDATE: Gem gammel state til rollback, opdater cache FØRST
            const previousProducts = getAllProducts() || [];
            const updated = previousProducts.map(p =>
                String(p.id) === String(productId) ? { ...p, is_visible: false } : p
            );
            setAllProducts(updated);
            await renderProductsFromLocalState(updated);

            // Send til database asynkront
            const { error } = await supabaseClient
                .from('products')
                .update({ is_visible: false })
                .eq('id', productId);

            if (error) {
                // Rollback ved fejl
                console.warn('[grid] Kunne ikke skjule produkt:', error.message);
                setAllProducts(previousProducts);
                await renderProductsFromLocalState(previousProducts);
                showAlert?.(`Kunne ikke skjule produkt: ${error.message}`);
                return;
            }
        } catch (err) {
            console.warn('[grid] Uventet fejl ved skjul produkt:', err);
        }
    };

    const assignProductToPlaceholder = async (productId, placeholderId) => {
        const slot = placeholderSlots.find(p => p.placeholder_id === placeholderId);
        if (!slot) {
            console.warn('[placeholder] Mangler placeholder for selection:', placeholderId);
            return;
        }
        if (!productId) {
            console.warn('[placeholder] Mangler productId ved selection');
            return;
        }
        const sortOrder = Number.isFinite(slot.sort_order) ? slot.sort_order : 0;
        try {
            // OPTIMISTISK UPDATE: Gem gammel state til rollback, opdater cache FØRST
            const previousProducts = getAllProducts() || [];
            const previousPlaceholders = [...placeholderSlots];
            const updated = previousProducts.map(p =>
                String(p.id) === String(productId)
                    ? { ...p, is_visible: true, sort_order: sortOrder }
                    : p
            );
            setAllProducts(updated);
            placeholderSlots = placeholderSlots.filter(p => p.placeholder_id !== placeholderId);
            await renderProductsFromLocalState(updated);

            // Send til database asynkront
            const { error } = await supabaseClient
                .from('products')
                .update({ is_visible: true, sort_order: sortOrder })
                .eq('id', productId);

            if (error) {
                // Rollback ved fejl
                console.warn('[placeholder] Kunne ikke indsætte produkt:', error.message);
                setAllProducts(previousProducts);
                placeholderSlots = previousPlaceholders;
                await renderProductsFromLocalState(previousProducts);
                showAlert?.(`Kunne ikke indsætte produkt: ${error.message}`);
                return;
            }
        } catch (err) {
            console.warn('[placeholder] Uventet fejl ved indsæt produkt:', err);
        }
    };
    async function saveProductOrder() {
        const container = document.getElementById('products');
        if (!container) return;
        const cards = Array.from(container.querySelectorAll('.product-btn'));
        const currentProducts = typeof getAllProducts === 'function' ? (getAllProducts() || []) : [];
        const seen = new Set();
        const updates = [];

        cards.forEach((card, index) => {
            const productId = card.dataset.productId;
            if (card.dataset.placeholderId) {
                return;
            }
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
            // OPTIMISTISK UPDATE: Gem gammel state til rollback, opdater cache FØRST
            const previousProducts = [...currentProducts];
            const productMap = new Map(currentProducts.map(p => [String(p.id), p]));
            const reordered = updates
                .map(({ id, sort_order }) => {
                    const product = productMap.get(String(id));
                    if (!product) return null;
                    return { ...product, sort_order };
                })
                .filter(Boolean);

            if (typeof setAllProducts === 'function') {
                setAllProducts(reordered);
            }
            updatePlaceholderOrderFromDom(cards);

            // Send til database asynkront
            const results = await Promise.all(
                updates.map(({ id, sort_order }) =>
                    supabaseClient.from('products').update({ sort_order }).eq('id', id)
                )
            );
            const firstError = results.find(res => res?.error)?.error;
            if (firstError) {
                // Rollback ved fejl
                console.warn('[product reorder] save error:', firstError.message);
                if (typeof setAllProducts === 'function') {
                    setAllProducts(previousProducts);
                }
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
        const cards = Array.from(container.querySelectorAll('.product-btn')).filter(card => !card.dataset.placeholderId);
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
            // KRITISK FIX: Fjern eksisterende listeners før nye tilføjes
            // Dette forhindrer memory leak ved gentagne renderinger
            card.removeEventListener('mousedown', handleLongPressStart);
            card.removeEventListener('touchstart', handleLongPressStart);
            card.removeEventListener('mouseup', handleLongPressEnd);
            card.removeEventListener('mouseleave', handleLongPressEnd);
            card.removeEventListener('touchend', handleLongPressEnd);
            card.removeEventListener('touchcancel', handleLongPressEnd);
            card.removeEventListener('dragstart', handleDragStart);
            card.removeEventListener('dragover', handleDragOver);
            card.removeEventListener('drop', handleDrop);
            card.removeEventListener('dragend', handleDragEnd);

            // Tilføj nye listeners
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

    // Render produkter fra lokal state (uden DB fetch)
    // Genbruger samme render-logik som fetchAndRenderProducts
    async function renderProductsFromLocalState(allProducts) {
        const currentCustomer = getCurrentCustomer();
        const childId = currentCustomer?.id || null;

        const gridItems = buildGridItems(allProducts);
        await renderProductsGrid(
            gridItems,
            productsContainer,
            async (product, evt) => {
                if (flangoReorderMode) return null;
                if (product?.is_placeholder) return null;
                const result = await addToOrder(product, getCurrentOrder(), orderList, totalPriceEl, updateSelectedUserInfo, { sourceEvent: evt });
                const currentChildId = getCurrentCustomer()?.id || null;
                const sugarData = typeof window.__flangoGetSugarData === 'function' ? window.__flangoGetSugarData() : null;
                await applyProductLimitsToButtons(allProducts, productsContainer, getCurrentOrder(), currentChildId, sugarData);
                return result;
            },
            currentCustomer
        );

        // Lock-overlays
        productsContainer.querySelectorAll('.product-btn').forEach(btn => {
            if (!btn.querySelector('.product-lock-overlay')) {
                const overlay = document.createElement('div');
                overlay.className = 'avatar-lock-overlay product-lock-overlay';
                btn.appendChild(overlay);
            }
        });

        initProductReorder();
        const sugarDataForLocks = typeof window.__flangoGetSugarData === 'function' ? window.__flangoGetSugarData() : null;
        await applyProductLimitsToButtons(allProducts, productsContainer, getCurrentOrder(), childId, sugarDataForLocks);
        renderProductsInModal(allProducts, modalProductList);
        ensureGridControls();
        ensureReorderHintActions();
    }

    async function fetchAndRenderProducts() {
        const { data, error } = await runWithAuthRetry(
            'fetchProducts',
            () => supabaseClient
                .from('products')
                .select('*')
                .eq('institution_id', adminProfile.institution_id)
                .order('sort_order')
        );
        if (error) {
            showAlert('Fejl ved hentning af produkter: ' + error.message);
            return;
        }
        setAllProducts(data);
        const allProducts = getAllProducts();
        const currentCustomer = getCurrentCustomer();
        const childId = currentCustomer?.id || null;
        const gridItems = buildGridItems(allProducts);

        // renderProductsGrid er nu async og tager currentCustomer parameter
        await renderProductsGrid(
            gridItems,
            productsContainer,
            async (product, evt) => {
                if (flangoReorderMode) return null;
                if (product?.is_placeholder) return null;
                const result = await addToOrder(product, getCurrentOrder(), orderList, totalPriceEl, updateSelectedUserInfo, { sourceEvent: evt });
                // VIGTIGT: Brug altid den opdaterede kurv her, og hent childId på ny.
                const currentChildId = getCurrentCustomer()?.id || null;
                const sugarData = typeof window.__flangoGetSugarData === 'function' ? window.__flangoGetSugarData() : null;
                await applyProductLimitsToButtons(allProducts, productsContainer, getCurrentOrder(), currentChildId, sugarData);
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
        const sugarDataForLocks = typeof window.__flangoGetSugarData === 'function' ? window.__flangoGetSugarData() : null;
        await applyProductLimitsToButtons(allProducts, productsContainer, getCurrentOrder(), childId, sugarDataForLocks);
        renderProductsInModal(allProducts, modalProductList);
        ensureGridControls();
        ensureReorderHintActions();
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

                try {
                    // OPTIMISTISK UPDATE: Gem gammel state til rollback, opdater cache FØRST
                    const previousProducts = getAllProducts();
                    const productMap = new Map(previousProducts.map(p => [String(p.id), p]));
                    const reorderedProducts = reorderedIds.map((id, index) => {
                        const prod = productMap.get(String(id));
                        return prod ? { ...prod, sort_order: index } : null;
                    }).filter(Boolean);
                    // Behold skjulte/disabled produkter med højere sort_order
                    const hiddenProducts = previousProducts
                        .filter(p => !reorderedIds.includes(String(p.id)))
                        .map((p, i) => ({ ...p, sort_order: reorderedIds.length + i }));
                    const allUpdated = [...reorderedProducts, ...hiddenProducts]
                        .sort((a, b) => a.sort_order - b.sort_order);

                    setAllProducts(allUpdated);
                    await renderProductsFromLocalState(allUpdated);

                    // Send til database asynkront
                    const updates = reorderedIds.map((id, index) =>
                        supabaseClient.from('products').update({ sort_order: index }).eq('id', id)
                    );
                    const results = await Promise.all(updates);
                    const firstError = results.find(res => res?.error)?.error;
                    if (firstError) {
                        // Rollback ved fejl
                        console.error('[assortment] Fejl ved opdatering af produkt rækkefølge:', firstError);
                        setAllProducts(previousProducts);
                        await renderProductsFromLocalState(previousProducts);
                        renderAssortmentModal(); // Re-render modal med gammel state
                        showAlert(`Kunne ikke opdatere rækkefølge: ${firstError.message}`);
                        return;
                    }
                } catch (err) {
                    console.error('[assortment] Uventet fejl ved opdatering af rækkefølge:', err);
                    showAlert('Der opstod en fejl ved opdatering af rækkefølgen');
                }
            }
        });

        assortmentList.onclick = async (e) => {
            const target = e.target;
            const checkbox = target.matches('input[type="checkbox"]') ? target : null;
            const productId = checkbox?.dataset.productId || target.closest('.item')?.dataset.productId;

            if (placeholderSelection?.placeholderId && productId) {
                await assignProductToPlaceholder(productId, placeholderSelection.placeholderId);
                placeholderSelection = null;
                assortmentModal.style.display = 'none';
                return;
            }

            if (checkbox) {
                const isVisible = checkbox.checked;

                // OPTIMISTISK UPDATE: Gem gammel state til rollback, opdater cache FØRST
                const previousProducts = getAllProducts();
                const updatedProducts = previousProducts.map(p =>
                    String(p.id) === String(productId) ? { ...p, is_visible: isVisible } : p
                );
                setAllProducts(updatedProducts);
                await renderProductsFromLocalState(updatedProducts);

                // Send til database asynkront
                const { error } = await supabaseClient
                    .from('products')
                    .update({ is_visible: isVisible })
                    .eq('id', productId);

                if (error) {
                    // Rollback ved fejl
                    console.error('[assortment] Fejl ved opdatering af produkt synlighed:', error);
                    setAllProducts(previousProducts);
                    await renderProductsFromLocalState(previousProducts);
                    checkbox.checked = !isVisible;
                    showAlert(`Kunne ikke opdatere produkt: ${error.message}`);
                    return;
                }
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

    window.__flangoAssignPlaceholderProduct = async (product, placeholderIdOverride = null) => {
        const placeholderId = placeholderIdOverride || pendingPlaceholderCreate?.placeholderId || placeholderSelection?.placeholderId;
        if (!placeholderId) {
            console.warn('[placeholder] Mangler placeholderId ved create');
            return;
        }
        if (!product?.id) {
            console.warn('[placeholder] Mangler product data ved create');
            return;
        }
        pendingPlaceholderCreate = null;
        placeholderSelection = null;
        await assignProductToPlaceholder(product.id, placeholderId);
    };

    if (productsContainer) {
        productsContainer.addEventListener('click', async (event) => {
                const removeOverlay = event.target.closest('.product-remove-overlay');
                if (removeOverlay) {
                    event.preventDefault();
                    event.stopPropagation();
                    // Placeholders kan kun fjernes i reorder mode
                    const placeholderId = removeOverlay.dataset.placeholderId;
                    if (placeholderId) {
                        if (!flangoReorderMode) {
                            // Kryds virker kun i reorder mode for placeholders
                            return;
                        }
                        // I reorder mode - fjern placeholder
                        const before = placeholderSlots.length;
                        placeholderSlots = placeholderSlots.filter(p => p.placeholder_id !== placeholderId);
                        if (before === placeholderSlots.length) {
                            console.warn('[grid] Placeholder ikke fundet:', placeholderId);
                        }
                        const allProducts = getAllProducts() || [];
                        await renderProductsFromLocalState(allProducts);
                        return;
                    }
                    // For almindelige produkter, kræv reorder mode
                    if (!flangoReorderMode) return;
                    const pid = removeOverlay.dataset.productId;
                    if (!pid) {
                        console.warn('[grid] Mangler productId på remove overlay');
                        return;
                    }
                    await hideProductFromGrid(pid);
                    return;
                }

                // ── Edit pencil button (reorder mode only) ──
                const editPencil = event.target.closest('.product-edit-pencil');
                if (editPencil) {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!flangoReorderMode) return;
                    const pid = editPencil.dataset.productId;
                    if (!pid) return;
                    const allProducts = getAllProducts() || [];
                    const product = allProducts.find(p => p.id === pid);
                    if (product && typeof window.__flangoOpenEditProductModal === 'function') {
                        window.__flangoOpenEditProductModal(product);
                    }
                    return;
                }

            const placeholderBtn = event.target.closest('[data-placeholder-action]');
            if (placeholderBtn) {
                event.preventDefault();
                event.stopPropagation();
                const placeholderId = placeholderBtn.dataset.placeholderId;
                const action = placeholderBtn.dataset.placeholderAction;
                if (!placeholderId) {
                    console.warn('[placeholder] Mangler placeholderId');
                    return;
                }
                if (action === 'select') {
                    placeholderSelection = { placeholderId };
                    if (assortmentModal) {
                        renderAssortmentModal();
                        assortmentModal.style.display = 'flex';
                    } else {
                        console.warn('[placeholder] assortmentModal mangler');
                    }
                } else if (action === 'create') {
                    pendingPlaceholderCreate = { placeholderId };
                    const editMenuOriginalBtn = document.getElementById('edit-menu-original-btn');
                    const addProductBtn = document.getElementById('add-btn-modal');
                    if (editMenuOriginalBtn) {
                        editMenuOriginalBtn.click();
                    } else {
                        console.warn('[placeholder] edit-menu-original-btn mangler');
                    }
                    if (addProductBtn) {
                        addProductBtn.click();
                    } else {
                        console.warn('[placeholder] add-btn-modal mangler');
                    }
                }
            }
        });

        productsContainer.addEventListener('focusin', (event) => {
            const editableName = event.target.closest('.product-edit-name');
            const priceInput = event.target.closest('.product-edit-price-input');
            const target = editableName || priceInput;
            if (!target) return;
            if (!target.dataset.prevValue) {
                target.dataset.prevValue = editableName ? editableName.textContent : target.value;
            }
        });

        const commitInlineEdit = async (target, kind) => {
            const productId = target?.dataset.productId;
            if (!productId) {
                console.warn('[edit] Mangler productId ved inline edit');
                return;
            }
            const allProducts = getAllProducts() || [];
            const product = allProducts.find(p => String(p.id) === String(productId));
            if (!product) {
                console.warn('[edit] Produkt ikke fundet:', productId);
                return;
            }
            const prev = target.dataset.prevValue ?? '';
            const raw = kind === 'name' ? String(target.textContent || '') : String(target.value || '');
            if (raw === prev) return;

            let updates = null;
            if (kind === 'name') {
                const name = raw.trim();
                // Tillad tomme navne - de kan rettes senere
                updates = { name: name || '' };
            } else if (kind === 'price') {
                const num = Number(raw.replace(',', '.'));
                if (!Number.isFinite(num) || num < 0) {
                    console.warn('[edit] Ugyldig pris:', raw);
                    const priceInWholeKr = Math.round(Number(product.price || 0));
                    target.value = priceInWholeKr;
                    return;
                }
                // Gem som hele kr
                updates = { price: Math.round(num) };
            }

            const { error } = await runWithAuthRetry(
                'inlineProductEdit',
                () => supabaseClient.from('products').update(updates).eq('id', productId)
            );
            if (error) {
                console.warn('[edit] Kunne ikke gemme ændring:', error.message);
                return;
            }
            const updated = allProducts.map(p =>
                String(p.id) === String(productId) ? { ...p, ...updates } : p
            );
            setAllProducts(updated);
            // Opdater prevValue korrekt
            if (kind === 'name') {
                target.dataset.prevValue = target.textContent || '';
            } else {
                const priceInWholeKr = Math.round(Number(updates.price || 0));
                target.value = priceInWholeKr;
                target.dataset.prevValue = String(priceInWholeKr);
            }
        };

        productsContainer.addEventListener('blur', (event) => {
            const editableName = event.target.closest('.product-edit-name');
            const priceInput = event.target.closest('.product-edit-price-input');
            if (editableName) {
                commitInlineEdit(editableName, 'name');
            } else if (priceInput) {
                commitInlineEdit(priceInput, 'price');
            }
        }, true);

        productsContainer.addEventListener('change', (event) => {
            const priceInput = event.target.closest('.product-edit-price-input');
            if (priceInput) {
                commitInlineEdit(priceInput, 'price');
            }
        });

        productsContainer.addEventListener('keydown', (event) => {
            // Gem ved Enter i edit mode
            if (event.key === 'Enter') {
                const editableName = event.target.closest('.product-edit-name');
                const priceInput = event.target.closest('.product-edit-price-input');
                if (editableName) {
                    event.preventDefault();
                    event.stopPropagation();
                    commitInlineEdit(editableName, 'name');
                    editableName.blur();
                } else if (priceInput) {
                    event.preventDefault();
                    event.stopPropagation();
                    commitInlineEdit(priceInput, 'price');
                    priceInput.blur();
                }
            }
        });
    }

    if (assortmentModal) {
        assortmentModal.addEventListener('click', (event) => {
            if (event.target === assortmentModal || event.target.closest('.close-btn')) {
                placeholderSelection = null;
            }
        });
    }

    return {
        fetchAndRenderProducts,
        // OPTIMERING: Eksporter renderFromCache til brug hvor produkter allerede er loadet (0 DB kald)
        renderFromCache: async () => {
            const allProducts = getAllProducts();
            if (allProducts && allProducts.length > 0) {
                await renderProductsFromLocalState(allProducts);
            } else {
                // Fallback: hent fra DB hvis cache er tom
                await fetchAndRenderProducts();
            }
        },
        initProductReorder, // Eksporter så den kan kaldes efter user selection
    };
}
