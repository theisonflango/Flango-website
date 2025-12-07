// js/ui/product-management.js
import { getProductIconInfo, PRODUCT_ICON_CLASS_MAP } from '../domain/products-and-cart.js';

export function renderProductsInModal(allProducts, modalProductList) {
    if (!modalProductList) return;

    modalProductList.innerHTML = '';
    allProducts.forEach((product) => {
        const productDiv = document.createElement('div');
        productDiv.className = 'modal-entry';
        const isActive = product.is_enabled !== false;

        const iconInfo = getProductIconInfo(product);
        const emojiDisplay = iconInfo
            ? `<img src="${iconInfo.path}" alt="${product.name}" class="product-icon-small">`
            : (product.emoji || '❓');

        productDiv.innerHTML = `
            <div class="modal-entry-info">
                <span>${emojiDisplay}</span> ${product.name} - ${product.price.toFixed(2)} DKK
            </div>
            <div class="action-icons">
                <span class="action-icon edit-icon" data-id="${product.id}" title="Rediger produkt">✍️</span>
                <span class="action-icon toggle-icon" data-id="${product.id}" title="${isActive ? 'Skjul fra Rediger Sortiment' : 'Vis i Rediger Sortiment'}">${isActive ? '🟢' : '🔴'}</span>
                <span class="action-icon delete-icon" data-id="${product.id}" title="Slet produkt">🗑️</span>
            </div>
        `;

        modalProductList.appendChild(productDiv);
    });
}

export function renderProductsGrid(allProducts, productsContainer, onProductClick) {
    if (!productsContainer) return;

    productsContainer.innerHTML = '';
    const visibleProducts = allProducts.filter(p => p.is_visible !== false && p.is_enabled !== false);

    visibleProducts.forEach((product, index) => {
        const productBtn = document.createElement('button');
        productBtn.dataset.productId = String(product.id);
        const productNameLower = product.name ? product.name.trim().toLowerCase() : '';

        let visualMarkup;
        let customClass = PRODUCT_ICON_CLASS_MAP[productNameLower] || '';

        const iconInfo = getProductIconInfo(product);
        if (iconInfo) {
            customClass = PRODUCT_ICON_CLASS_MAP[productNameLower] || '';
            visualMarkup = `<img src="${iconInfo.path}" alt="${iconInfo.alt}" class="product-icon">`;
        } else {
            visualMarkup = `<div class="product-emoji">${product.emoji || '❓'}</div>`;
        }

        productBtn.className = `product-btn${customClass}`;
        productBtn.innerHTML = `
            <div class="product-btn-inner">
                ${visualMarkup}
                <div class="product-info-box">
                    <span class="product-name">${product.name}</span>
                    <span class="product-price">${product.price.toFixed(2)} DKK</span>
                </div>
                ${index < 10 ? `<div class="product-shortcut">${index === 9 ? 0 : index + 1}</div>` : ''}
            </div>
            <div class="avatar-lock-overlay">
                <img src="Icons/webp/Function/Lock.webp" alt="locked">
            </div>`;

        if (typeof onProductClick === 'function') {
            productBtn.addEventListener('click', (evt) => onProductClick(product, evt));
        }

        productsContainer.appendChild(productBtn);
    });
}

export function createProductManagementUI(options = {}) {
    const {
        getAllProducts,
        setAllProducts,
        adminProfile,
        supabaseClient,
        productModal,
        productModalCloseBtn,
        modalProductList,
        addProductBtn,
        suspendSettingsReturn,
        resumeSettingsReturn,
        showAlert,
        showCustomAlert,
        playSound,
        CUSTOM_ICON_PREFIX,
        getCustomIconPath,
        renderProductsInModal: renderProductsInModalFn,
        fetchAndRenderProducts,
    } = options || {};

    if (!productModal || !productModalCloseBtn || !modalProductList || !addProductBtn) return;

    const getProducts = () => (typeof getAllProducts === 'function' ? getAllProducts() || [] : []);
    const setProducts = (next) => {
        if (typeof setAllProducts === 'function') {
            setAllProducts(next);
        }
    };

    async function fetchProductAllergens(productId) {
        if (!productId) return [];
        const { data, error } = await supabaseClient
            .from('product_allergens')
            .select('allergen')
            .eq('product_id', productId);
        if (error) {
            console.warn('[product allergens] fetch error:', error?.message);
            return [];
        }
        return Array.isArray(data) ? data.map(row => row.allergen) : [];
    }

    async function saveProductAllergens(productId, allergens) {
        if (!productId) return;
        const deleteResult = await supabaseClient
            .from('product_allergens')
            .delete()
            .eq('product_id', productId);
        if (deleteResult.error) {
            showAlert?.(`Kunne ikke opdatere allergener: ${deleteResult.error.message}`);
            return;
        }
        if (allergens.length === 0) return;
        const { error } = await supabaseClient
            .from('product_allergens')
            .insert(allergens.map(allergen => ({ product_id: productId, allergen })));
        if (error) {
            showAlert?.(`Kunne ikke gemme allergener: ${error.message}`);
        }
    }

    async function fetchProductLimit(institutionId, productId) {
        if (!institutionId || !productId) return null;
        try {
            const { data, error } = await supabaseClient
                .from('product_limits')
                .select('max_per_day')
                .eq('institution_id', institutionId)
                .eq('product_id', productId)
                .maybeSingle();
            if (error) {
                console.warn('[limits] fetchProductLimit error:', error?.message);
                return null;
            }
            return data?.max_per_day ?? null;
        } catch (err) {
            console.warn('[limits] fetchProductLimit unexpected error:', err);
            return null;
        }
    }

    async function saveProductLimit(institutionId, productId, maxPerDay) {
        if (!institutionId || !productId) {
            console.warn('[limits] saveProductLimit mangler institutionId eller productId');
            return;
        }
        try {
            if (maxPerDay === null) {
                // Tomt felt = ubegrænset => slet række hvis den findes
                const { error } = await supabaseClient
                    .from('product_limits')
                    .delete()
                    .eq('institution_id', institutionId)
                    .eq('product_id', productId);
                if (error) {
                    console.warn('[limits] delete product_limit fejlede:', error?.message);
                }
                return;
            }
            const { error } = await supabaseClient
                .from('product_limits')
                .upsert(
                    {
                        institution_id: institutionId,
                        product_id: productId,
                        max_per_day: maxPerDay,
                        updated_at: new Date().toISOString(),
                    },
                    {
                        onConflict: 'institution_id,product_id',
                    }
                );
            if (error) {
                console.warn('[limits] upsert product_limit fejlede:', error?.message);
            }
        } catch (err) {
            console.warn('[limits] saveProductLimit uventet fejl:', err);
        }
    }

    const closeProductModal = () => {
        productModal.style.display = 'none';
        productModal.dataset.returnToSettings = '';
    };

    productModalCloseBtn.addEventListener('click', closeProductModal);

    addProductBtn.addEventListener('click', () => {
        if (productModal.style.display === 'flex') {
            suspendSettingsReturn?.(productModal);
        }
        productModal.dataset.returnToList = 'true';
        productModal.style.display = 'none';
        showAddEditProductModal();
    });

    modalProductList.addEventListener('click', handleProductListClick);

    async function showAddEditProductModal(product = null) {
        const isEditing = product !== null;
        const modal = document.getElementById('add-edit-product-modal');
        const title = document.getElementById('product-form-title');
        const fieldsContainer = document.getElementById('product-form-fields');
        const saveBtn = document.getElementById('save-product-btn');
        const returnToProductModal = productModal.dataset.returnToList === 'true' || productModal.style.display === 'flex';
        if (returnToProductModal) {
            suspendSettingsReturn?.(productModal);
            productModal.style.display = 'none';
            productModal.dataset.returnToList = '';
        }
        title.textContent = isEditing ? 'Rediger Produkt' : 'Tilføj Produkt';
        const existingCustomIcon = isEditing ? getCustomIconPath(product.emoji) : null;
        const institutionId = adminProfile?.institution_id || null;
        const limitValue = isEditing && institutionId
            ? await fetchProductLimit(institutionId, product.id)
            : null;
        const maxPerDayValue = limitValue != null ? limitValue : '';
        const allergenOptions = [
            { value: 'peanuts', label: '🥜 Jordnødder (peanuts)' },
            { value: 'tree_nuts', label: '🥜 Trænødder: cashew, mandel, valnød, hasselnød, pistacie eller andre.' },
            { value: 'milk', label: '🥛 Mælk' },
            { value: 'egg', label: '🥚 Æg' },
            { value: 'gluten', label: '🌾 Gluten' },
            { value: 'fish', label: '🐠 Fisk' },
            { value: 'shellfish', label: '🦐 Skaldyr' },
            { value: 'sesame', label: '🌰 Sesam' },
            { value: 'soy', label: '🫘 Soja' },
        ];
        const allergensHTML = allergenOptions.map(opt => (
            `<label class="allergen-option"><input type="checkbox" class="allergen-checkbox" value="${opt.value}"> ${opt.label}</label>`
        )).join('');
        fieldsContainer.innerHTML = `
                <input type="text" id="product-name-input" placeholder="Produktnavn" value="${isEditing ? product.name : ''}">
                <input type="number" id="product-price-input" placeholder="Pris (kr)" step="1" value="${isEditing ? product.price.toFixed(2) : ''}">
                <input type="number" id="product-max-per-day-input" placeholder="Købsgrænse (Ubegrænset)" step="1" value="${maxPerDayValue}">
                <h4>Allergener</h4>
                <div class="allergen-grid">
                    ${allergensHTML}
                </div>
                <h4>Vælg eller indtast Emoji</h4>
                <input type="text" id="product-emoji-input" placeholder="Indtast emoji her..." value="${isEditing && product.emoji ? product.emoji : ''}">
                <div id="product-emoji-grid" class="emoji-grid" style="padding-top: 10px;"></div>
                <h4>Vælg Custom Icon</h4>
                <div id="custom-icon-grid" class="custom-icon-grid"></div>`;
        // Prefill allergener ved redigering
        if (isEditing) {
            const existingAllergens = await fetchProductAllergens(product.id);
            if (existingAllergens.length) {
                document.querySelectorAll('.allergen-checkbox').forEach(cb => {
                    cb.checked = existingAllergens.includes(cb.value);
                });
            }
        }
        const maxPerDayInput = document.getElementById('product-max-per-day-input');
        if (maxPerDayInput) {
            const normalizeMaxPerDay = () => {
                const raw = maxPerDayInput.value;
                if (raw === '') return;
                const num = Number(raw);
                if (!Number.isFinite(num) || num < 0) {
                    maxPerDayInput.value = '';
                } else {
                    maxPerDayInput.value = String(Math.floor(num));
                }
            };
            maxPerDayInput.addEventListener('change', normalizeMaxPerDay);
            maxPerDayInput.addEventListener('blur', normalizeMaxPerDay);
            maxPerDayInput.addEventListener('input', () => {
                const raw = maxPerDayInput.value;
                if (raw === '') return;
                const num = Number(raw);
                if (!Number.isFinite(num) || num < 0) {
                    maxPerDayInput.value = '';
                } else {
                    maxPerDayInput.value = String(Math.floor(num));
                }
            });
            maxPerDayInput.addEventListener('keydown', (evt) => {
                if (evt.key === 'ArrowDown') {
                    const current = Number(maxPerDayInput.value);
                    if (!maxPerDayInput.value || !Number.isFinite(current) || current <= 0) {
                        evt.preventDefault();
                        maxPerDayInput.value = '';
                    }
                }
            });
        }
        const emojiGrid = document.getElementById('product-emoji-grid');
        const suggestions = ['🍫', '🍽️', '🍷', '🍎', '🥜', '🥪', '🍕', '🥤', '🍚', '🍣', '🥢', '🍞', '🥝', '🍇', '🍐', '🍉', '🍙', '🍲', '🥘', '🫘', '🍔', '🌶️', '🧄', '🍳', '🔥', '😋', '🍰', '♨️', '🍪'];
        suggestions.forEach(emoji => {
            const emojiSpan = document.createElement('span');
            emojiSpan.textContent = emoji;
            const emojiInput = document.getElementById('product-emoji-input');
            emojiSpan.onclick = () => {
                emojiInput.value += emoji;
                emojiInput.focus();
            };
            emojiGrid.appendChild(emojiSpan);
        });
        const customIconGrid = document.getElementById('custom-icon-grid');
        const customIconOptions = [
            { label: 'Toast', path: 'Icons/webp/Food/Toast.webp' },
            { label: 'Saft', path: 'Icons/webp/Food/Saft.webp' },
            { label: 'Sushi', path: 'Icons/webp/Food/Sushi.webp' },
            { label: 'Nøddemix', path: 'Icons/webp/Food/Nøddemix.webp' },
            { label: 'Frugt', path: 'Icons/webp/Food/Frugt.webp' },
            { label: 'Frugter', path: 'Icons/webp/Food/Frugter.webp' },
            { label: 'Suppe', path: 'Icons/webp/Food/Suppe.webp' },
            { label: 'Pizza', path: 'Icons/webp/Food/Pizza.webp' },
            { label: 'Dagens ret', path: 'Icons/webp/Food/Dagensret.webp' }
        ];
        const emojiInput = document.getElementById('product-emoji-input');
        let selectedCustomIcon = existingCustomIcon;
        customIconOptions.forEach(icon => {
            const option = document.createElement('div');
            option.className = 'custom-icon-option';
            option.innerHTML = `<img src="${icon.path}" alt="${icon.label}"><span>${icon.label}</span>`;
            option.onclick = () => {
                selectedCustomIcon = icon.path;
                emojiInput.value = `${CUSTOM_ICON_PREFIX}${icon.path}`;
                updateCustomIconSelection();
                emojiInput.focus();
            };
            option.dataset.path = icon.path;
            customIconGrid.appendChild(option);
        });
        const updateCustomIconSelection = () => {
            document.querySelectorAll('.custom-icon-option').forEach(opt => {
                opt.classList.toggle('selected', !!selectedCustomIcon && opt.dataset.path === selectedCustomIcon);
            });
        };
        updateCustomIconSelection();
        emojiInput.addEventListener('input', () => {
            const path = getCustomIconPath(emojiInput.value);
            selectedCustomIcon = path;
            updateCustomIconSelection();
        });
        modal.style.display = 'flex';
        saveBtn.onclick = async () => {
            const name = document.getElementById('product-name-input').value;
            const priceStr = document.getElementById('product-price-input').value;
            const maxPerDayStr = document.getElementById('product-max-per-day-input').value;
            const emoji = document.getElementById('product-emoji-input').value;
            const allergenSelections = Array.from(document.querySelectorAll('.allergen-checkbox'))
                .filter(cb => cb.checked)
                .map(cb => cb.value);
            if (!name || !priceStr) {
                return showCustomAlert('Fejl', 'Udfyld venligst både produktnavn og pris.');
            }
            const maxPerDay = maxPerDayStr === '' ? null : Number(maxPerDayStr);
            if (maxPerDay !== null && (!Number.isFinite(maxPerDay) || maxPerDay < 0)) {
                return showCustomAlert('Fejl', 'Købsgrænse skal være et ikke-negativt tal eller tom for ubegrænset.');
            }
            if (isEditing) {
                await handleEditProduct(product.id, { name, priceStr, emoji: emoji, maxPerDay, allergens: allergenSelections, institutionId });
            } else {
                await handleAddProduct({ name, priceStr, emoji: emoji, maxPerDay, allergens: allergenSelections, institutionId });
            }
            closeEditProductModal();
        };
        const closeBtn = modal.querySelector('.close-btn');
        const closeEditProductModal = () => {
            modal.style.display = 'none';
            saveBtn.onclick = null;
            if (returnToProductModal) {
                renderProductsInModalFn?.(getProducts(), modalProductList);
                productModal.style.display = 'flex';
                resumeSettingsReturn?.(productModal);
            }
        };
        closeBtn.onclick = closeEditProductModal;
    }

    function handleProductListClick(event) {
        const target = event.target.closest('.action-icon');
        if (!target) return;
        const productId = target.dataset.id;
        if (target.classList.contains('edit-icon')) {
            productModal.dataset.returnToList = 'true';
            suspendSettingsReturn?.(productModal);
            productModal.style.display = 'none';
            showAddEditProductModal(getProducts().find(p => p.id === productId));
        } else if (target.classList.contains('delete-icon')) {
            handleDeleteProduct(productId);
        } else if (target.classList.contains('toggle-icon')) {
            handleToggleProductStatus(productId);
        }
    }

    async function handleAddProduct(productData) {
        const { name, priceStr, emoji, maxPerDay, allergens = [], institutionId = null } = productData;
        const price = parseFloat(priceStr.replace(",", "."));
        if (isNaN(price)) return showAlert("Ugyldig pris.");
        const products = getProducts();
        const { data, error } = await supabaseClient.from("products").insert([{
            name,
            price,
            emoji,
            max_per_day: maxPerDay,
            institution_id: adminProfile.institution_id,
            sort_order: products.length
        }]).select().single();
        if (error) return showAlert(`Fejl: ${error.message}`);
        await saveProductAllergens(data.id, allergens);
        if (institutionId) {
            await saveProductLimit(institutionId, data.id, (maxPerDay === null ? null : Math.floor(maxPerDay)));
        }
        const nextProducts = [...products, data];
        setProducts(nextProducts);
        playSound?.('productCreate');
        await fetchAndRenderProducts?.();
        renderProductsInModalFn?.(getProducts(), modalProductList);
    }

    async function handleEditProduct(productId, productData) {
        const { name, priceStr, emoji, maxPerDay, allergens = [], institutionId = null } = productData;
        const products = getProducts();
        const product = products.find(p => p.id === productId);
        if (!product) return;
        const price = parseFloat(priceStr.replace(",", "."));
        if (isNaN(price)) return showAlert("Ugyldig pris.");
        const { error } = await supabaseClient.from("products").update({ name, price, emoji, max_per_day: maxPerDay }).eq("id", productId);
        if (error) return showAlert(`Fejl: ${error.message}`);
        Object.assign(product, { name, price, emoji, max_per_day: maxPerDay });
        await saveProductAllergens(productId, allergens);
        if (institutionId) {
            await saveProductLimit(institutionId, productId, (maxPerDay === null ? null : Math.floor(maxPerDay)));
        }
        setProducts([...products]);
        await fetchAndRenderProducts?.();
        renderProductsInModalFn?.(getProducts(), modalProductList);
    }

    async function handleToggleProductStatus(productId) {
        const products = getProducts();
        const product = products.find(p => p.id === productId);
        if (!product) return;
        const currentlyEnabled = product.is_enabled !== false;
        const nextEnabled = !currentlyEnabled;
        const { error } = await supabaseClient
            .from("products")
            .update({ is_enabled: nextEnabled })
            .eq("id", productId);
        if (error) return showAlert(`Fejl: ${error.message}`);
        Object.assign(product, { is_enabled: nextEnabled });
        setProducts([...products]);
        await fetchAndRenderProducts?.();
        renderProductsInModalFn?.(getProducts(), modalProductList);
    }

    async function handleDeleteProduct(productId) {
        const products = getProducts();
        const product = products.find(p => p.id === productId);
        if (!product) return;
        const confirmed = await showCustomAlert('Bekræft Sletning', `Er du sikker på, du vil slette <strong>${product.name}</strong> permanent?`, 'confirm');
        if (!confirmed) return;
        const { error } = await supabaseClient.from("products").delete().eq("id", productId);
        if (error) return showAlert(`Fejl: ${error.message}`);
        const nextProducts = products.filter(p => p.id !== productId);
        setProducts(nextProducts);
        await fetchAndRenderProducts?.();
        renderProductsInModalFn?.(getProducts(), modalProductList);
    }
}
