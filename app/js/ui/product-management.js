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

export async function renderProductsGrid(allProducts, productsContainer, onProductClick, currentCustomer = null) {
    if (!productsContainer) return;

    productsContainer.innerHTML = '';
    const visibleProducts = allProducts.filter(p => p.is_visible !== false && p.is_enabled !== false);

    // Pre-beregn refill-berettigelse hvis der er en kunde
    const effectiveProducts = new Map();
    if (currentCustomer?.id) {
        console.log('[renderProductsGrid] Beregner refill for kunde:', currentCustomer.name, currentCustomer.id);
        const { getEffectiveProductForChild } = await import('../domain/products-and-cart.js');
        const childContext = {
            childId: currentCustomer.id,
            institutionId: currentCustomer.institution_id
        };

        // Batch alle refill checks parallelt for performance
        const refillChecks = visibleProducts.map(async (product) => {
            try {
                console.log('[renderProductsGrid] Tjekker refill for produkt:', product.name, 'refill_enabled:', product.refill_enabled);
                const effective = await getEffectiveProductForChild(product, childContext);
                console.log('[renderProductsGrid] Effective result for', product.name, ':', effective);
                return { productId: product.id, effective };
            } catch (err) {
                console.warn('[renderProductsGrid] Fejl ved refill-check for produkt:', product.id, err);
                return {
                    productId: product.id,
                    effective: {
                        price: product.price,
                        name: product.name,
                        isRefill: false
                    }
                };
            }
        });

        const results = await Promise.all(refillChecks);
        results.forEach(({ productId, effective }) => {
            effectiveProducts.set(String(productId), effective);
        });
    } else {
        console.log('[renderProductsGrid] Ingen kunde valgt, springer refill over');
    }

    visibleProducts.forEach((product, index) => {
        const productBtn = document.createElement('button');
        productBtn.dataset.productId = String(product.id);
        const productNameLower = product.name ? product.name.trim().toLowerCase() : '';

        // Hent effektive værdier (med refill hvis berettiget)
        const effectiveData = effectiveProducts.get(String(product.id));
        const displayName = effectiveData?.name || product.name;
        const displayPrice = effectiveData?.price ?? product.price;
        const isRefill = effectiveData?.isRefill || false;

        let visualMarkup;
        let customClass = PRODUCT_ICON_CLASS_MAP[productNameLower] || '';

        const iconInfo = getProductIconInfo(product);
        if (iconInfo) {
            customClass = PRODUCT_ICON_CLASS_MAP[productNameLower] || '';
            visualMarkup = `<img src="${iconInfo.path}" alt="${iconInfo.alt}" class="product-icon">`;
        } else {
            visualMarkup = `<div class="product-emoji">${product.emoji || '❓'}</div>`;
        }

        productBtn.className = `product-btn${customClass}${isRefill ? ' product-refill' : ''}`;

        // Beregn timer info for refill med tidsbegrænsning
        let timerMarkup = '';
        if (isRefill && product.refill_enabled && product.refill_time_limit_minutes > 0 && effectiveData?.lastPurchaseTime) {
            // Gem timer data på knappen så vi kan opdatere den
            const lastPurchaseMs = new Date(effectiveData.lastPurchaseTime).getTime();
            productBtn.dataset.refillTimerMinutes = product.refill_time_limit_minutes;
            productBtn.dataset.refillLastPurchase = lastPurchaseMs;
            timerMarkup = `<div class="refill-timer" data-product-id="${product.id}">⏱ <span class="timer-value">--:--</span></div>`;
        }

        productBtn.innerHTML = `
            <div class="product-btn-inner">
                ${timerMarkup}
                ${visualMarkup}
                <div class="product-info-box">
                    <span class="product-name">${displayName}</span>
                    <span class="product-price${isRefill ? ' refill-price' : ''}">${displayPrice.toFixed(2)} DKK</span>
                </div>
                ${index < 10 ? `<div class="product-shortcut">${index === 9 ? 0 : index + 1}</div>` : ''}
            </div>
            <div class="avatar-lock-overlay">
                <img src="Icons/webp/Function/Lock.webp" alt="locked">
            </div>`;

        if (typeof onProductClick === 'function') {
            productBtn.addEventListener('click', (evt) => {
                // Hvis det er et refill-køb, skal vi sende den effektive data med
                const productToAdd = isRefill && effectiveData ? {
                    ...product,
                    _effectivePrice: displayPrice,
                    _effectiveName: displayName,
                    _isRefill: true
                } : product;
                onProductClick(productToAdd, evt);
            });
        }

        productsContainer.appendChild(productBtn);
    });

    // Start refill timer updater hvis der er produkter med timere
    startRefillTimerUpdater(productsContainer);
}

// Global timer interval reference
let refillTimerInterval = null;

/**
 * Start eller genstart refill timer opdatering
 * @param {HTMLElement} productsContainer - Container med produkter
 */
function startRefillTimerUpdater(productsContainer) {
    // Stop eksisterende timer
    if (refillTimerInterval) {
        clearInterval(refillTimerInterval);
        refillTimerInterval = null;
    }

    // Find produkter med timere
    const updateTimers = () => {
        const buttons = productsContainer.querySelectorAll('.product-btn[data-refill-timer-minutes]');
        if (buttons.length === 0) {
            // Ingen timere, stop interval
            if (refillTimerInterval) {
                clearInterval(refillTimerInterval);
                refillTimerInterval = null;
            }
            return;
        }

        const now = Date.now();
        buttons.forEach(btn => {
            const timerMinutes = parseInt(btn.dataset.refillTimerMinutes, 10);
            const lastPurchaseMs = parseInt(btn.dataset.refillLastPurchase, 10);

            if (!timerMinutes || !lastPurchaseMs) return;

            // Beregn tid tilbage
            const expiryMs = lastPurchaseMs + (timerMinutes * 60 * 1000);
            const remainingMs = expiryMs - now;

            const timerValueEl = btn.querySelector('.timer-value');
            if (!timerValueEl) return;

            if (remainingMs <= 0) {
                timerValueEl.textContent = '0:00';
                // Kunne evt. auto-refresh produktgrid her, men det kan være forstyrrende
            } else {
                const minutes = Math.floor(remainingMs / 60000);
                const seconds = Math.floor((remainingMs % 60000) / 1000);
                timerValueEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            }
        });
    };

    // Kør første opdatering med det samme
    updateTimers();

    // Start interval (hver sekund)
    refillTimerInterval = setInterval(updateTimers, 1000);
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
        const existingRefillEnabled = isEditing && product?.refill_enabled === true;
        const existingRefillPrice = isEditing && Number.isFinite(product?.refill_price)
            ? product.refill_price
            : '';
        const existingRefillTimeLimit = isEditing && Number.isFinite(product?.refill_time_limit_minutes)
            ? product.refill_time_limit_minutes
            : 0;
        const existingRefillMaxRefills = isEditing && Number.isFinite(product?.refill_max_refills)
            ? product.refill_max_refills
            : 0;
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
                <div class="refill-row">
                    <label class="refill-option">
                        <input type="checkbox" id="product-refill-enabled" ${existingRefillEnabled ? 'checked' : ''}>
                        Aktiver rabat ved Refill/Genopfyldning
                    </label>
                </div>
                <div id="refill-fields" class="refill-fields ${existingRefillEnabled ? '' : 'hidden'}">
                    <div class="refill-field">
                        <label for="product-refill-price-input" class="refill-label" data-label-base="Pris for genopfyldning">Pris for genopfyldning (kr)</label>
                        <input type="number" id="product-refill-price-input" class="refill-price-input" data-placeholder-base="Pris i kr" placeholder="Pris i kr (fx 1.50)" min="0" step="0.5" value="${existingRefillPrice === '' ? '' : existingRefillPrice}">
                    </div>
                    <div class="refill-field">
                        <label for="product-refill-time-limit-input" class="refill-label" data-label-base="Tidsgrænse">Tidsgrænse (minutter)</label>
                        <input type="number" id="product-refill-time-limit-input" data-placeholder-base="Minutter" placeholder="Minutter (0 = resten af dagen)" min="0" step="1" value="${existingRefillTimeLimit}">
                    </div>
                    <div class="refill-field">
                        <label for="product-refill-max-input" class="refill-label" data-label-base="Maks antal genopfyldninger">Maks antal genopfyldninger</label>
                        <input type="number" id="product-refill-max-input" data-placeholder-base="Antal" placeholder="Antal (0 = ubegrænset)" min="0" step="1" value="${existingRefillMaxRefills}">
                    </div>
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
            { label: 'Dagens ret', path: 'Icons/webp/Food/Dagensret.webp' },
            { label: 'Stegt flæsk', path: 'Icons/webp/Food/stegt_flaesk.webp' }
        ];
        const emojiInput = document.getElementById('product-emoji-input');
        let selectedCustomIcon = existingCustomIcon;

        // OPTIMERING: Opret elementer uden individuelle event listeners
        customIconOptions.forEach(icon => {
            const option = document.createElement('div');
            option.className = 'custom-icon-option';
            option.innerHTML = `<img src="${icon.path}" alt="${icon.label}"><span>${icon.label}</span>`;
            option.dataset.path = icon.path;
            customIconGrid.appendChild(option);
        });

        // OPTIMERING: Event delegation i stedet for individuelle listeners (forhindrer memory leaks)
        const handleCustomIconClick = (e) => {
            const option = e.target.closest('.custom-icon-option');
            if (!option) return;

            selectedCustomIcon = option.dataset.path;
            emojiInput.value = `${CUSTOM_ICON_PREFIX}${selectedCustomIcon}`;
            updateCustomIconSelection();
            emojiInput.focus();
        };
        customIconGrid.addEventListener('click', handleCustomIconClick);

        const updateCustomIconSelection = () => {
            document.querySelectorAll('.custom-icon-option').forEach(opt => {
                opt.classList.toggle('selected', !!selectedCustomIcon && opt.dataset.path === selectedCustomIcon);
            });
        };
        updateCustomIconSelection();
        const refillEnabledCheckbox = document.getElementById('product-refill-enabled');
        const refillFields = document.getElementById('refill-fields');
        const refillPriceInput = document.getElementById('product-refill-price-input');
        const refillTimeLimitInput = document.getElementById('product-refill-time-limit-input');
        const refillMaxInput = document.getElementById('product-refill-max-input');

        const updateLabelText = (inputEl, zeroText) => {
            if (!inputEl) return;
            const base = inputEl.dataset.placeholderBase || '';
            const raw = inputEl.value;
            const num = raw === '' ? 0 : Number(raw);

            // Når værdien er 0 eller tom: vis status-tekst i feltet og lad værdien være tom,
            // så placeholderen viser "Base (Status)" ligesom Købsgrænse (Ubegrænset)
            if (!raw || !Number.isFinite(num) || num === 0) {
                inputEl.value = '';
                if (base) {
                    inputEl.placeholder = `${base} (${zeroText})`;
                } else {
                    inputEl.placeholder = zeroText;
                }
            } else {
                // Ved andre værdier viser vi kun grundteksten
                inputEl.placeholder = base || '';
            }
        };

        const syncRefillState = () => {
            if (!refillEnabledCheckbox) return;
            const enabled = refillEnabledCheckbox.checked;
            if (refillFields) {
                refillFields.classList.toggle('hidden', !enabled);
            }
            [refillPriceInput, refillTimeLimitInput, refillMaxInput].forEach((el) => {
                if (!el) return;
                el.disabled = !enabled;
                if (enabled && el.value === '') {
                    el.value = '0';
                }
            });
            updateLabelText(refillPriceInput, 'Gratis');
            updateLabelText(refillTimeLimitInput, 'Resten af dagen');
            updateLabelText(refillMaxInput, 'Ubegrænset');
        };
        if (refillEnabledCheckbox) {
            if (!existingRefillEnabled) {
                syncRefillState();
            }
            refillEnabledCheckbox.addEventListener('change', syncRefillState);
        }
        [refillPriceInput, refillTimeLimitInput, refillMaxInput].forEach((el) => {
            if (!el) return;
            const zeroText = el === refillPriceInput
                ? 'Gratis'
                : el === refillTimeLimitInput
                    ? 'Resten af dagen'
                    : 'Ubegrænset';
            updateLabelText(el, zeroText);
            el.addEventListener('input', () => updateLabelText(el, zeroText));
        });
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
            const refillEnabled = !!(refillEnabledCheckbox?.checked);
            const parseNumber = (el, fallback = 0) => {
                if (!el) return fallback;
                const num = Number(el.value);
                return Number.isFinite(num) ? num : fallback;
            };
            const refillPrice = parseNumber(refillPriceInput, 0);
            const refillTimeLimitMinutes = parseNumber(refillTimeLimitInput, 0);
            const refillMaxRefills = parseNumber(refillMaxInput, 0);
            if (isEditing) {
                await handleEditProduct(product.id, {
                    name,
                    priceStr,
                    emoji: emoji,
                    maxPerDay,
                    allergens: allergenSelections,
                    institutionId,
                    refillEnabled,
                    refillPrice,
                    refillTimeLimitMinutes,
                    refillMaxRefills,
                });
            } else {
                await handleAddProduct({
                    name,
                    priceStr,
                    emoji: emoji,
                    maxPerDay,
                    allergens: allergenSelections,
                    institutionId,
                    refillEnabled,
                    refillPrice,
                    refillTimeLimitMinutes,
                    refillMaxRefills,
                });
            }
            closeEditProductModal();
        };
        const closeBtn = modal.querySelector('.close-btn');
        const closeEditProductModal = () => {
            modal.style.display = 'none';
            saveBtn.onclick = null;
            // OPTIMERING: Cleanup event listener for at forhindre memory leaks
            customIconGrid.removeEventListener('click', handleCustomIconClick);
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
        const {
            name,
            priceStr,
            emoji,
            maxPerDay,
            allergens = [],
            institutionId = null,
            refillEnabled = false,
            refillPrice = null,
            refillTimeLimitMinutes = null,
            refillMaxRefills = null,
        } = productData;
        const price = parseFloat(priceStr.replace(",", "."));
        if (isNaN(price)) return showAlert("Ugyldig pris.");
        const products = getProducts();
        const refillEnabledValue = refillEnabled === true;
        const { data, error } = await supabaseClient.from("products").insert([{
            name,
            price,
            emoji,
            max_per_day: maxPerDay,
            refill_enabled: refillEnabledValue,
            refill_price: refillEnabledValue ? refillPrice : null,
            refill_time_limit_minutes: refillEnabledValue ? refillTimeLimitMinutes : null,
            refill_max_refills: refillEnabledValue ? refillMaxRefills : null,
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
        const {
            name,
            priceStr,
            emoji,
            maxPerDay,
            allergens = [],
            institutionId = null,
            refillEnabled = false,
            refillPrice = null,
            refillTimeLimitMinutes = null,
            refillMaxRefills = null,
        } = productData;
        const products = getProducts();
        const product = products.find(p => p.id === productId);
        if (!product) return;
        const price = parseFloat(priceStr.replace(",", "."));
        if (isNaN(price)) return showAlert("Ugyldig pris.");
        const refillEnabledValue = refillEnabled === true;
        const { error } = await supabaseClient.from("products").update({
            name,
            price,
            emoji,
            max_per_day: maxPerDay,
            refill_enabled: refillEnabledValue,
            refill_price: refillEnabledValue ? refillPrice : null,
            refill_time_limit_minutes: refillEnabledValue ? refillTimeLimitMinutes : null,
            refill_max_refills: refillEnabledValue ? refillMaxRefills : null,
        }).eq("id", productId);
        if (error) return showAlert(`Fejl: ${error.message}`);
        Object.assign(product, {
            name,
            price,
            emoji,
            max_per_day: maxPerDay,
            refill_enabled: refillEnabledValue,
            refill_price: refillEnabledValue ? refillPrice : null,
            refill_time_limit_minutes: refillEnabledValue ? refillTimeLimitMinutes : null,
            refill_max_refills: refillEnabledValue ? refillMaxRefills : null,
        });
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
