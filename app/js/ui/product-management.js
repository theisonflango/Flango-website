// js/ui/product-management.js
import { getProductIconInfo, PRODUCT_ICON_CLASS_MAP } from '../domain/products-and-cart.js';

export function renderProductsInModal(allProducts, modalProductList) {
    if (!modalProductList) return;

    modalProductList.innerHTML = '';
    allProducts.forEach((product) => {
        const productDiv = document.createElement('div');
        productDiv.className = 'modal-entry';

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
                <span class="action-icon delete-icon" data-id="${product.id}" title="Slet produkt">🗑️</span>
            </div>
        `;

        modalProductList.appendChild(productDiv);
    });
}

export function renderProductsGrid(allProducts, productsContainer, onProductClick) {
    if (!productsContainer) return;

    productsContainer.innerHTML = '';
    const visibleProducts = allProducts.filter(p => p.is_visible !== false);

    visibleProducts.forEach((product, index) => {
        const productBtn = document.createElement('button');
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
            ${visualMarkup}
            <div class="product-info-box">
                <span class="product-name">${product.name}</span>
                <span class="product-price">${product.price.toFixed(2)} DKK</span>
            </div>
            ${index < 10 ? `<div class="product-shortcut">${index === 9 ? 0 : index + 1}</div>` : ''}`;

        if (typeof onProductClick === 'function') {
            productBtn.addEventListener('click', () => onProductClick(product));
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

    function showAddEditProductModal(product = null) {
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
        fieldsContainer.innerHTML = `
                <input type="text" id="product-name-input" placeholder="Produktnavn" value="${isEditing ? product.name : ''}">
                <input type="number" id="product-price-input" placeholder="Pris (f.eks. 4.50)" step="0.01" value="${isEditing ? product.price.toFixed(2) : ''}">
                <h4>Vælg eller indtast Emoji</h4>
                <input type="text" id="product-emoji-input" placeholder="Indtast emoji her..." value="${isEditing && product.emoji ? product.emoji : ''}">
                <div id="product-emoji-grid" class="emoji-grid" style="padding-top: 10px;"></div>
                <h4>Vælg Custom Icon</h4>
                <div id="custom-icon-grid" class="custom-icon-grid"></div>`;
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
            { label: 'Toast', path: 'Icons/Food/Toast.png' },
            { label: 'Saft', path: 'Icons/Food/Saft.png' },
            { label: 'Sushi', path: 'Icons/Food/Sushi.png' },
            { label: 'Nøddemix', path: 'Icons/Food/Nøddemix.png' },
            { label: 'Frugt', path: 'Icons/Food/Frugt.png' },
            { label: 'Frugter', path: 'Icons/Food/Frugter.png' },
            { label: 'Suppe', path: 'Icons/Food/Suppe.png' },
            { label: 'Pizza', path: 'Icons/Food/Pizza.png' },
            { label: 'Dagens ret', path: 'Icons/Food/Dagensret.png' }
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
            const emoji = document.getElementById('product-emoji-input').value;
            if (!name || !priceStr) {
                return showCustomAlert('Fejl', 'Udfyld venligst både produktnavn og pris.');
            }
            if (isEditing) {
                await handleEditProduct(product.id, { name, priceStr, emoji: emoji });
            } else {
                await handleAddProduct({ name, priceStr, emoji: emoji });
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
        }
    }

    async function handleAddProduct(productData) {
        const { name, priceStr, emoji } = productData;
        const price = parseFloat(priceStr.replace(",", "."));
        if (isNaN(price)) return showAlert("Ugyldig pris.");
        const products = getProducts();
        const { data, error } = await supabaseClient.from("products").insert([{ name, price, emoji, institution_id: adminProfile.institution_id, sort_order: products.length }]).select().single();
        if (error) return showAlert(`Fejl: ${error.message}`);
        const nextProducts = [...products, data];
        setProducts(nextProducts);
        playSound?.('productCreate');
        await fetchAndRenderProducts?.();
        renderProductsInModalFn?.(getProducts(), modalProductList);
    }

    async function handleEditProduct(productId, productData) {
        const { name, priceStr, emoji } = productData;
        const products = getProducts();
        const product = products.find(p => p.id === productId);
        if (!product) return;
        const price = parseFloat(priceStr.replace(",", "."));
        if (isNaN(price)) return showAlert("Ugyldig pris.");
        const { error } = await supabaseClient.from("products").update({ name, price, emoji }).eq("id", productId);
        if (error) return showAlert(`Fejl: ${error.message}`);
        Object.assign(product, { name, price, emoji });
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
