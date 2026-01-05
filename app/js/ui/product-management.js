// js/ui/product-management.js
import { getProductIconInfo, PRODUCT_ICON_CLASS_MAP } from '../domain/products-and-cart.js';
import { getOrder } from '../domain/order-store.js';
import { refetchAllProducts } from '../core/data-refetch.js';
import {
    STANDARD_ICONS,
    uploadProductIcon,
    removeProductIcon,
    formatIconUpdateTime
} from '../core/product-icon-utils.js';

console.log('🔥🔥🔥 product-management.js LOADED - Version with REFETCH + Custom Icon Upload 🔥🔥🔥');

export function renderProductsInModal(allProducts, modalProductList) {
    if (!modalProductList) return;

    modalProductList.innerHTML = '';
    const sortedProducts = [...allProducts].sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
    sortedProducts.forEach((product) => {
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
    const visibleProducts = allProducts
        .filter(p => p.is_visible !== false && p.is_enabled !== false)
        .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)); // Eksplicit sortering efter sort_order

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
        console.log(`[renderProductsGrid] Created button for product ${product.name} (id: ${product.id}), dataset.productId = "${productBtn.dataset.productId}"`);
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

        // Beregn antal i kurv for dette produkt
        const currentOrder = getOrder();
        const qtyInCart = currentOrder.filter(item => item.id === product.id).length;

        // Sæt data-quantity attribute for CSS styling
        productBtn.dataset.quantity = qtyInCart;

        // Badge: På mobil vis kurv-antal, på desktop vis keyboard shortcut
        const isMobile = window.innerWidth <= 767;
        let badgeMarkup = '';
        if (isMobile) {
            // Mobil: Vis kun badge hvis der er produkter i kurven
            if (qtyInCart > 0) {
                badgeMarkup = `<div class="product-badge">${qtyInCart}</div>`;
            }
        } else {
            // Desktop: Vis keyboard shortcut (1-9, 0)
            if (index < 10) {
                badgeMarkup = `<div class="product-shortcut">${index === 9 ? 0 : index + 1}</div>`;
            }
        }

        productBtn.innerHTML = `
            <div class="product-btn-inner">
                ${timerMarkup}
                ${visualMarkup}
                <div class="product-info-box">
                    <span class="product-name">${displayName}</span>
                    <span class="product-price${isRefill ? ' refill-price' : ''}">${displayPrice.toFixed(2)} DKK</span>
                </div>
                ${badgeMarkup}
                <div class="product-quantity-badge"><span class="cart-icon">🛒</span><span class="cart-qty">${qtyInCart}</span></div>
            </div>
            <div class="avatar-lock-overlay">
                <img src="Icons/webp/Function/Lock.webp" alt="locked">
            </div>
            <div class="product-limit-counter" aria-hidden="true"></div>`;

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

    // Build mobile product pages (wrap 6 products per page for swipe paging)
    buildMobileProductPages(productsContainer);

    // Initialize page dots for mobile paging (only on mobile)
    initializeProductPageDots(productsContainer, visibleProducts.length);
}

/**
 * Opdater quantity badges på alle produkt-knapper baseret på nuværende kurv
 * Kaldes når kurven ændres for at holde badge-tallene synkroniseret
 */
export function updateProductQuantityBadges() {
    const currentOrder = getOrder();
    const productButtons = document.querySelectorAll('.product-btn');

    console.log('[updateProductQuantityBadges] Opdaterer badges, antal knapper:', productButtons.length, 'kurv items:', currentOrder.length);

    productButtons.forEach((btn, idx) => {
        const productId = btn.dataset.productId; // UUID as string - don't parseInt!
        if (!productId) {
            console.log(`[updateProductQuantityBadges] Button ${idx}: Skipping (no productId)`);
            return;
        }

        // Beregn antal af dette produkt i kurven (compare UUIDs as strings)
        const qtyInCart = currentOrder.filter(item => item.id === productId).length;

        // Opdater data-quantity attribute
        btn.dataset.quantity = qtyInCart;

        // Opdater badge tal og visibility med CSS class
        const badge = btn.querySelector('.product-quantity-badge');
        if (badge) {
            const qtySpan = badge.querySelector('.cart-qty');
            if (qtySpan) {
                qtySpan.textContent = qtyInCart;
            }
            // Vis badge hvis quantity > 0 ved at tilføje 'visible' class
            if (qtyInCart > 0) {
                badge.classList.add('visible');
            } else {
                badge.classList.remove('visible');
            }
        }
    });
}

// Global timer interval reference
let refillTimerInterval = null;

/**
 * Build mobile product pages - wraps every 6 products in a .product-page div for swipe paging
 * @param {HTMLElement} productsContainer - The #products container
 */
function buildMobileProductPages(productsContainer) {
    if (!productsContainer) return;

    const isMobile = window.innerWidth <= 767;
    if (!isMobile) {
        // On desktop, unwrap any existing pages back to flat structure
        const existingPages = productsContainer.querySelectorAll('.product-page');
        if (existingPages.length > 0) {
            const allButtons = Array.from(productsContainer.querySelectorAll('.product-btn'));
            productsContainer.innerHTML = '';
            allButtons.forEach(btn => productsContainer.appendChild(btn));
        }
        return;
    }

    // Get all product buttons (they're direct children at this point)
    const allButtons = Array.from(productsContainer.querySelectorAll('.product-btn'));

    // If already wrapped in pages, skip
    if (productsContainer.querySelector('.product-page')) {
        return;
    }

    if (allButtons.length === 0) return;

    // Clear container
    productsContainer.innerHTML = '';

    // Group into pages of 6 (3×2 grid)
    const productsPerPage = 6;
    const pageCount = Math.ceil(allButtons.length / productsPerPage);

    for (let i = 0; i < pageCount; i++) {
        const page = document.createElement('div');
        page.className = 'product-page';

        // Get 6 products for this page
        const startIdx = i * productsPerPage;
        const endIdx = Math.min(startIdx + productsPerPage, allButtons.length);
        const pageButtons = allButtons.slice(startIdx, endIdx);

        // Add buttons to page
        pageButtons.forEach(btn => page.appendChild(btn));

        productsContainer.appendChild(page);
    }

    console.log(`[buildMobileProductPages] Created ${pageCount} pages with ${allButtons.length} products`);
}

// Handle window resize to rebuild pages
let pagingResizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(pagingResizeTimeout);
    pagingResizeTimeout = setTimeout(() => {
        const productsContainer = document.getElementById('products');
        if (productsContainer) {
            // Get all buttons from pages or flat structure
            const allButtons = Array.from(productsContainer.querySelectorAll('.product-btn'));

            // Clear and rebuild
            productsContainer.innerHTML = '';
            allButtons.forEach(btn => productsContainer.appendChild(btn));

            // Rebuild paging structure
            buildMobileProductPages(productsContainer);

            // Rebuild dots
            initializeProductPageDots(productsContainer, allButtons.length);
        }
    }, 250);
});

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

/**
 * Initialize and manage page indicator dots for mobile product grid paging
 * @param {HTMLElement} productsContainer - The #products container
 * @param {number} productCount - Total number of visible products
 */
function initializeProductPageDots(productsContainer, productCount) {
    if (!productsContainer) return;

    const isMobile = window.innerWidth <= 767;
    if (!isMobile) {
        // Remove dots container if exists on desktop
        const existingDots = document.getElementById('products-page-dots');
        if (existingDots) {
            existingDots.remove();
        }
        return;
    }

    const productsPerPage = 6; // 2 rows × 3 columns
    const totalPages = Math.ceil(productCount / productsPerPage);

    // Only show dots if more than 1 page
    if (totalPages <= 1) {
        const existingDots = document.getElementById('products-page-dots');
        if (existingDots) {
            existingDots.remove();
        }
        return;
    }

    // Find or create dots container
    let dotsContainer = document.getElementById('products-page-dots');
    if (!dotsContainer) {
        dotsContainer = document.createElement('div');
        dotsContainer.id = 'products-page-dots';

        // Insert after #products (before footer in products-area)
        const productsArea = productsContainer.parentElement;
        if (productsArea) {
            productsArea.insertBefore(dotsContainer, productsContainer.nextSibling);
        }
    }

    // Clear and rebuild dots
    dotsContainer.innerHTML = '';
    for (let i = 0; i < totalPages; i++) {
        const dot = document.createElement('div');
        dot.className = 'page-dot';
        dot.dataset.page = i;

        // Click handler to scroll to page
        dot.addEventListener('click', () => {
            const pageWidth = productsContainer.clientWidth;
            productsContainer.scrollTo({
                left: i * pageWidth,
                behavior: 'smooth'
            });
        });

        dotsContainer.appendChild(dot);
    }

    // Update active dot based on scroll position
    const updateActiveDot = () => {
        const pageWidth = productsContainer.clientWidth;
        const scrollLeft = productsContainer.scrollLeft;
        const activePage = Math.round(scrollLeft / pageWidth);

        const dots = dotsContainer.querySelectorAll('.page-dot');
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === activePage);
        });
    };

    // Initial update
    updateActiveDot();

    // Remove old scroll listener if exists (prevent duplicate listeners)
    if (productsContainer._dotScrollListener) {
        productsContainer.removeEventListener('scroll', productsContainer._dotScrollListener);
    }

    // Listen to scroll events with debouncing for performance
    let scrollTimeout;
    const scrollHandler = () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(updateActiveDot, 50);
    };
    productsContainer._dotScrollListener = scrollHandler;
    productsContainer.addEventListener('scroll', scrollHandler, { passive: true });

    // Handle resize/rotation (cleanup old listeners first)
    if (window._dotResizeListener) {
        window.removeEventListener('resize', window._dotResizeListener);
        window.removeEventListener('orientationchange', window._dotResizeListener);
    }

    let resizeTimeout;
    const resizeHandler = () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            const newIsMobile = window.innerWidth <= 767;
            if (newIsMobile) {
                // Recalculate and rebuild
                const newProductCount = productsContainer.querySelectorAll('.product-btn').length;
                initializeProductPageDots(productsContainer, newProductCount);
            } else {
                // Remove dots on desktop
                const dots = document.getElementById('products-page-dots');
                if (dots) {
                    dots.remove();
                }
            }
        }, 250);
    };
    window._dotResizeListener = resizeHandler;
    window.addEventListener('resize', resizeHandler);
    window.addEventListener('orientationchange', resizeHandler);
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
        const existingUnhealthy = isEditing && product?.unhealthy === true;

        // Load parent portal settings and sugar policy to determine which fields to show
        const { data: portalSettings } = await supabaseClient
            .from('institutions')
            .select('parent_portal_allergens, parent_portal_vegetarian_only, parent_portal_no_pork, sugar_policy_enabled')
            .eq('id', institutionId)
            .single();

        const showAllergens = portalSettings?.parent_portal_allergens !== false;
        const showVegetarian = portalSettings?.parent_portal_vegetarian_only !== false;
        const showPork = portalSettings?.parent_portal_no_pork !== false;
        // Only show "Usund Vare" checkbox if sugar policy is enabled
        const showUnhealthy = portalSettings?.sugar_policy_enabled === true;

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
                ${showAllergens ? `
                <div class="collapsible-section">
                    <h4 class="collapsible-header" data-target="allergen-content" style="cursor: pointer; user-select: none; padding: 10px; background: var(--secondary-bg, #f5f5f5); border-radius: 8px; margin: 10px 0;">
                        <span class="collapse-arrow" style="display: inline-block; transition: transform 0.2s; margin-right: 8px;">▶</span> Allergener
                    </h4>
                    <div id="allergen-content" class="collapsible-content" style="display: none; padding: 10px 0; max-height: 300px; overflow-y: auto;">
                        <div class="allergen-grid">
                            ${allergensHTML}
                        </div>
                    </div>
                </div>` : ''}
                <div class="refill-row">
                    <label class="refill-option">
                        <input type="checkbox" id="product-refill-enabled" ${existingRefillEnabled ? 'checked' : ''}>
                        Aktiver rabat ved Refill/Genopfyldning
                    </label>
                </div>
                ${showUnhealthy ? `<div class="refill-row">
                    <label class="refill-option">
                        <input type="checkbox" id="product-unhealthy-enabled" ${existingUnhealthy ? 'checked' : ''}>
                        Usund Vare
                    </label>
                </div>` : ''}
                ${showPork ? `<div class="refill-row">
                    <label class="refill-option">
                        <input type="checkbox" id="product-contains-pork" ${product?.contains_pork === true ? 'checked' : ''}>
                        Indeholder svinekød
                    </label>
                </div>` : ''}
                ${showVegetarian ? `<div class="refill-row">
                    <label class="refill-option">
                        <input type="checkbox" id="product-is-vegetarian" ${product?.is_vegetarian === true ? 'checked' : ''}>
                        Vegetarisk
                    </label>
                </div>` : ''}
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
                <div class="collapsible-section">
                    <h4 class="collapsible-header" data-target="icon-section-content" style="cursor: pointer; user-select: none; padding: 10px; background: var(--secondary-bg, #f5f5f5); border-radius: 8px; margin: 10px 0;">
                        <span class="collapse-arrow" style="display: inline-block; transition: transform 0.2s; margin-right: 8px;">▶</span> Produktikon
                    </h4>
                    <div id="icon-section-content" class="collapsible-content" style="display: none; padding: 10px 0;">

                        <!-- Icon Preview -->
                        <div id="icon-preview-container" style="text-align: center; margin-bottom: 15px; padding: 15px; background: #f8f9fa; border-radius: 12px;">
                            <div id="icon-preview" style="width: 80px; height: 80px; margin: 0 auto 10px; border-radius: 10px; overflow: hidden; background: #fff; display: flex; align-items: center; justify-content: center; border: 2px solid #e0e0e0;">
                                <span style="font-size: 40px;">❓</span>
                            </div>
                            <div id="icon-status" style="font-size: 12px; color: #666;"></div>
                        </div>

                        <!-- Icon Type Selection -->
                        <div id="icon-type-selector" style="display: flex; gap: 10px; margin-bottom: 15px;">
                            <label class="icon-type-card" style="flex: 1; padding: 12px; border: 2px solid #e0e0e0; border-radius: 10px; cursor: pointer; text-align: center; transition: all 0.2s;">
                                <input type="radio" name="icon-type" value="standard" style="display: none;">
                                <div style="font-size: 24px; margin-bottom: 5px;">📁</div>
                                <div style="font-weight: 600; font-size: 13px;">Standard ikon</div>
                            </label>
                            <label class="icon-type-card" style="flex: 1; padding: 12px; border: 2px solid #e0e0e0; border-radius: 10px; cursor: pointer; text-align: center; transition: all 0.2s;">
                                <input type="radio" name="icon-type" value="custom" style="display: none;">
                                <div style="font-size: 24px; margin-bottom: 5px;">📤</div>
                                <div style="font-weight: 600; font-size: 13px;">Upload eget</div>
                            </label>
                        </div>

                        <!-- Standard Icon Section -->
                        <div id="standard-icon-section" style="display: none;">
                            <label style="display: block; font-weight: 500; margin-bottom: 8px;">Vælg standard ikon</label>
                            <div id="standard-icon-grid" class="custom-icon-grid"></div>

                            <label style="margin-top: 15px; display: block; font-weight: 500;">Eller vælg emoji</label>
                            <input type="text" id="product-emoji-input" placeholder="Indtast emoji her..." value="${isEditing && product.emoji ? product.emoji : ''}" style="margin-top: 5px;">
                            <div id="product-emoji-grid" class="emoji-grid" style="padding-top: 10px;"></div>
                        </div>

                        <!-- Custom Upload Section -->
                        <div id="custom-upload-section" style="display: none;">
                            <div id="upload-dropzone" style="border: 2px dashed #ccc; border-radius: 12px; padding: 30px 20px; text-align: center; cursor: pointer; transition: all 0.2s; background: #fafafa;">
                                <div style="font-size: 40px; margin-bottom: 10px;">🖼️</div>
                                <div style="font-weight: 600; margin-bottom: 5px;">Træk billede hertil</div>
                                <div style="font-size: 12px; color: #666; margin-bottom: 10px;">eller klik for at vælge fil</div>
                                <div style="font-size: 11px; color: #999;">WebP, PNG, JPEG • Konverteres automatisk til 256×256 WebP</div>
                                <input type="file" id="icon-file-input" accept=".webp,.png,.jpg,.jpeg,image/webp,image/png,image/jpeg" style="display: none;">
                            </div>

                            <!-- Background Removal Option -->
                            <label id="remove-bg-option" style="display: flex; align-items: flex-start; gap: 10px; margin-top: 15px; padding: 12px; background: #f8f9fa; border-radius: 8px; cursor: pointer; user-select: none;">
                                <input type="checkbox" id="remove-bg-checkbox" style="margin-top: 2px; width: 18px; height: 18px; cursor: pointer;">
                                <div>
                                    <div style="font-weight: 600; font-size: 14px; color: #333;">Forsøg at fjerne baggrund</div>
                                    <div style="font-size: 12px; color: #666; margin-top: 3px;">Virker bedst på billeder med ensfarvet baggrund (fx hvid). Resultatet kan variere.</div>
                                </div>
                            </label>

                            <div id="upload-progress" style="display: none; margin-top: 15px; padding: 15px; background: #e3f2fd; border-radius: 8px; text-align: center;">
                                <div style="font-size: 14px; color: #1976d2;">Uploader...</div>
                            </div>

                            <div id="upload-error" style="display: none; margin-top: 15px; padding: 15px; background: #ffebee; border-radius: 8px; text-align: center;">
                                <div style="font-size: 14px; color: #c62828;"></div>
                            </div>

                            <button type="button" id="remove-custom-icon-btn" style="display: none; margin-top: 15px; width: 100%; padding: 10px; background: #ffebee; color: #c62828; border: 1px solid #ffcdd2; border-radius: 8px; cursor: pointer; font-weight: 500;">
                                🗑️ Fjern custom ikon
                            </button>
                        </div>

                    </div>
                </div>`;
        // Setup collapsible sections
        document.querySelectorAll('.collapsible-header').forEach(header => {
            header.addEventListener('click', () => {
                const targetId = header.dataset.target;
                const content = document.getElementById(targetId);
                const arrow = header.querySelector('.collapse-arrow');

                if (content.style.display === 'none') {
                    content.style.display = 'block';
                    arrow.style.transform = 'rotate(90deg)';
                } else {
                    content.style.display = 'none';
                    arrow.style.transform = 'rotate(0deg)';
                }
            });
        });

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
        // ===== ICON SECTION SETUP =====
        const emojiGrid = document.getElementById('product-emoji-grid');
        const emojiInput = document.getElementById('product-emoji-input');
        const standardIconGrid = document.getElementById('standard-icon-grid');
        const iconPreview = document.getElementById('icon-preview');
        const iconStatus = document.getElementById('icon-status');
        const standardIconSection = document.getElementById('standard-icon-section');
        const customUploadSection = document.getElementById('custom-upload-section');
        const uploadDropzone = document.getElementById('upload-dropzone');
        const iconFileInput = document.getElementById('icon-file-input');
        const uploadProgress = document.getElementById('upload-progress');
        const uploadError = document.getElementById('upload-error');
        const removeCustomIconBtn = document.getElementById('remove-custom-icon-btn');
        const iconTypeCards = document.querySelectorAll('.icon-type-card');

        // Track current state
        let selectedStandardIcon = existingCustomIcon;
        let currentIconUrl = isEditing ? product?.icon_url : null;
        let currentIconUpdatedAt = isEditing ? product?.icon_updated_at : null;
        let isUploading = false;

        // Update icon preview
        const updateIconPreview = () => {
            let iconSrc = null;
            let statusText = '';

            if (currentIconUrl) {
                // Custom uploaded icon
                const timestamp = currentIconUpdatedAt ? new Date(currentIconUpdatedAt).getTime() : Date.now();
                iconSrc = `${currentIconUrl}?v=${timestamp}`;
                statusText = `✅ Custom ikon (uploadet ${formatIconUpdateTime(currentIconUpdatedAt)})`;
            } else if (selectedStandardIcon) {
                // Standard icon from emoji field
                iconSrc = selectedStandardIcon;
                statusText = '📁 Bruger standard ikon';
            } else if (emojiInput?.value && !emojiInput.value.startsWith(CUSTOM_ICON_PREFIX)) {
                // Emoji
                iconPreview.innerHTML = `<span style="font-size: 40px;">${emojiInput.value}</span>`;
                iconStatus.textContent = '😀 Bruger emoji';
                return;
            }

            if (iconSrc) {
                iconPreview.innerHTML = `<img src="${iconSrc}" alt="Produkt ikon" style="width: 100%; height: 100%; object-fit: contain;">`;
            } else {
                iconPreview.innerHTML = `<span style="font-size: 40px;">❓</span>`;
                statusText = 'Intet ikon valgt';
            }
            iconStatus.textContent = statusText;
        };

        // Switch between standard and custom icon sections
        const switchIconType = (type) => {
            iconTypeCards.forEach(card => {
                const radio = card.querySelector('input[type="radio"]');
                const isSelected = radio.value === type;
                radio.checked = isSelected;
                card.style.borderColor = isSelected ? '#4682b4' : '#e0e0e0';
                card.style.background = isSelected ? '#e3f2fd' : '#fff';
            });

            standardIconSection.style.display = type === 'standard' ? 'block' : 'none';
            customUploadSection.style.display = type === 'custom' ? 'block' : 'none';

            // Show/hide remove button
            removeCustomIconBtn.style.display = (type === 'custom' && currentIconUrl) ? 'block' : 'none';
        };

        // Initialize icon type based on current state
        const initIconType = currentIconUrl ? 'custom' : 'standard';
        switchIconType(initIconType);

        // Icon type card click handlers
        iconTypeCards.forEach(card => {
            card.addEventListener('click', () => {
                const radio = card.querySelector('input[type="radio"]');
                switchIconType(radio.value);
            });
        });

        // ===== STANDARD ICON GRID =====
        const suggestions = ['🍫', '🍽️', '🍷', '🍎', '🥜', '🥪', '🍕', '🥤', '🍚', '🍣', '🥢', '🍞', '🥝', '🍇', '🍐', '🍉', '🍙', '🍲', '🥘', '🫘', '🍔', '🌶️', '🧄', '🍳', '🔥', '😋', '🍰', '♨️', '🍪'];
        suggestions.forEach(emoji => {
            const emojiSpan = document.createElement('span');
            emojiSpan.textContent = emoji;
            emojiSpan.onclick = () => {
                emojiInput.value = emoji;
                selectedStandardIcon = null;
                updateStandardIconSelection();
                updateIconPreview();
            };
            emojiGrid.appendChild(emojiSpan);
        });

        // Standard icons from STANDARD_ICONS constant
        STANDARD_ICONS.forEach(icon => {
            const option = document.createElement('div');
            option.className = 'custom-icon-option';
            option.innerHTML = `<img src="${icon.path}" alt="${icon.label}"><span>${icon.label}</span>`;
            option.dataset.path = icon.path;
            standardIconGrid.appendChild(option);
        });

        // Standard icon grid click handler (event delegation)
        const handleStandardIconClick = (e) => {
            const option = e.target.closest('.custom-icon-option');
            if (!option) return;

            selectedStandardIcon = option.dataset.path;
            emojiInput.value = `${CUSTOM_ICON_PREFIX}${selectedStandardIcon}`;
            updateStandardIconSelection();
            updateIconPreview();
        };
        standardIconGrid.addEventListener('click', handleStandardIconClick);

        const updateStandardIconSelection = () => {
            standardIconGrid.querySelectorAll('.custom-icon-option').forEach(opt => {
                opt.classList.toggle('selected', !!selectedStandardIcon && opt.dataset.path === selectedStandardIcon);
            });
        };
        updateStandardIconSelection();

        // Emoji input change handler
        emojiInput?.addEventListener('input', () => {
            if (!emojiInput.value.startsWith(CUSTOM_ICON_PREFIX)) {
                selectedStandardIcon = null;
                updateStandardIconSelection();
            }
            updateIconPreview();
        });

        // ===== CUSTOM UPLOAD HANDLERS =====
        const removeBgCheckbox = document.getElementById('remove-bg-checkbox');

        const handleFileUpload = async (file) => {
            if (!file || !isEditing) return;

            // Validate file type
            const validTypes = ['image/webp', 'image/png', 'image/jpeg'];
            if (!validTypes.includes(file.type)) {
                uploadError.style.display = 'block';
                uploadError.querySelector('div').textContent = 'Ugyldig filtype. Brug WebP, PNG eller JPEG.';
                return;
            }

            // Hide error, show progress
            uploadError.style.display = 'none';
            uploadProgress.style.display = 'block';
            uploadDropzone.style.opacity = '0.5';
            uploadDropzone.style.pointerEvents = 'none';
            isUploading = true;

            try {
                // Get admin user ID
                const adminUserId = adminProfile?.user_id;
                if (!adminUserId) {
                    throw new Error('Admin bruger ID ikke fundet');
                }

                // Determine background removal mode from checkbox
                const removeBackgroundMode = removeBgCheckbox?.checked ? 'simple' : 'none';

                const result = await uploadProductIcon(file, institutionId, product.id, adminUserId, {
                    removeBackgroundMode
                });

                if (result.success) {
                    currentIconUrl = result.icon_url;
                    currentIconUpdatedAt = result.icon_updated_at;
                    updateIconPreview();
                    removeCustomIconBtn.style.display = 'block';
                    playSound?.('success');
                } else {
                    throw new Error(result.error || 'Upload fejlede');
                }

            } catch (err) {
                console.error('[handleFileUpload] Error:', err);
                uploadError.style.display = 'block';
                uploadError.querySelector('div').textContent = err.message || 'Upload fejlede';
                playSound?.('error');
            } finally {
                uploadProgress.style.display = 'none';
                uploadDropzone.style.opacity = '1';
                uploadDropzone.style.pointerEvents = 'auto';
                isUploading = false;
            }
        };

        // Dropzone click → trigger file input
        uploadDropzone?.addEventListener('click', () => {
            if (!isUploading) iconFileInput?.click();
        });

        // File input change
        iconFileInput?.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
            e.target.value = ''; // Reset for same file selection
        });

        // Drag & drop handlers
        uploadDropzone?.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadDropzone.style.borderColor = '#4682b4';
            uploadDropzone.style.background = '#e3f2fd';
        });

        uploadDropzone?.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadDropzone.style.borderColor = '#ccc';
            uploadDropzone.style.background = '#fafafa';
        });

        uploadDropzone?.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadDropzone.style.borderColor = '#ccc';
            uploadDropzone.style.background = '#fafafa';

            const file = e.dataTransfer?.files?.[0];
            if (file) handleFileUpload(file);
        });

        // Remove custom icon button
        removeCustomIconBtn?.addEventListener('click', async () => {
            if (!isEditing || !currentIconUrl) return;

            removeCustomIconBtn.disabled = true;
            removeCustomIconBtn.textContent = 'Fjerner...';

            try {
                const result = await removeProductIcon(product.id);
                if (result.success) {
                    currentIconUrl = null;
                    currentIconUpdatedAt = null;
                    updateIconPreview();
                    removeCustomIconBtn.style.display = 'none';
                    playSound?.('success');
                } else {
                    throw new Error(result.error);
                }
            } catch (err) {
                console.error('[removeCustomIcon] Error:', err);
                showAlert?.('Kunne ikke fjerne ikon: ' + err.message);
            } finally {
                removeCustomIconBtn.disabled = false;
                removeCustomIconBtn.textContent = '🗑️ Fjern custom ikon';
            }
        });

        // Initial preview update
        updateIconPreview();
        const refillEnabledCheckbox = document.getElementById('product-refill-enabled');
        const unhealthyCheckbox = document.getElementById('product-unhealthy-enabled');
        const containsPorkCheckbox = document.getElementById('product-contains-pork');
        const isVegetarianCheckbox = document.getElementById('product-is-vegetarian');
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
            const unhealthy = !!(unhealthyCheckbox?.checked);
            const containsPork = !!(containsPorkCheckbox?.checked);
            const isVegetarian = !!(isVegetarianCheckbox?.checked);
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
                    unhealthy,
                    containsPork,
                    isVegetarian,
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
                    unhealthy,
                    containsPork,
                    isVegetarian,
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
            unhealthy = false,
            containsPork = false,
            isVegetarian = false,
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
            unhealthy,
            contains_pork: containsPork,
            is_vegetarian: isVegetarian,
            refill_enabled: refillEnabledValue,
            refill_price: refillEnabledValue ? refillPrice : null,
            refill_time_limit_minutes: refillEnabledValue ? refillTimeLimitMinutes : 0,
            refill_max_refills: refillEnabledValue ? refillMaxRefills : 0,
            institution_id: adminProfile.institution_id,
            sort_order: products.length
        }]).select().single();
        if (error) return showAlert(`Fejl: ${error.message}`);
        await saveProductAllergens(data.id, allergens);
        if (institutionId) {
            await saveProductLimit(institutionId, data.id, (maxPerDay === null ? null : Math.floor(maxPerDay)));
        }

        // REFETCH PATTERN: Hent fresh data fra database for at sikre UI er synkroniseret
        console.log('[handleAddProduct] Refetching products from database...');
        await refetchAllProducts();

        playSound?.('productCreate');
        await fetchAndRenderProducts?.();
        renderProductsInModalFn?.(getProducts(), modalProductList);
        console.log('[handleAddProduct] Product added and UI refreshed');
    }

    async function handleEditProduct(productId, productData) {
        const {
            name,
            priceStr,
            emoji,
            maxPerDay,
            allergens = [],
            institutionId = null,
            unhealthy = false,
            containsPork = false,
            isVegetarian = false,
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
            unhealthy,
            contains_pork: containsPork,
            is_vegetarian: isVegetarian,
            refill_enabled: refillEnabledValue,
            refill_price: refillEnabledValue ? refillPrice : null,
            refill_time_limit_minutes: refillEnabledValue ? refillTimeLimitMinutes : 0,
            refill_max_refills: refillEnabledValue ? refillMaxRefills : 0,
        }).eq("id", productId);
        if (error) return showAlert(`Fejl: ${error.message}`);
        Object.assign(product, {
            name,
            price,
            emoji,
            max_per_day: maxPerDay,
            unhealthy,
            refill_enabled: refillEnabledValue,
            refill_price: refillEnabledValue ? refillPrice : null,
            refill_time_limit_minutes: refillEnabledValue ? refillTimeLimitMinutes : 0,
            refill_max_refills: refillEnabledValue ? refillMaxRefills : 0,
        });
        await saveProductAllergens(productId, allergens);
        if (institutionId) {
            await saveProductLimit(institutionId, productId, (maxPerDay === null ? null : Math.floor(maxPerDay)));
        }

        // REFETCH PATTERN: Hent fresh data fra database for at sikre UI er synkroniseret
        console.log('[handleEditProduct] Refetching products from database...');
        await refetchAllProducts();

        await fetchAndRenderProducts?.();
        renderProductsInModalFn?.(getProducts(), modalProductList);
        console.log('[handleEditProduct] Product edited and UI refreshed');
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

        // REFETCH PATTERN: Hent fresh data fra database for at sikre UI er synkroniseret
        console.log('[handleToggleProductStatus] Refetching products from database...');
        await refetchAllProducts();

        await fetchAndRenderProducts?.();
        renderProductsInModalFn?.(getProducts(), modalProductList);
        console.log('[handleToggleProductStatus] Product status toggled and UI refreshed');
    }

    async function handleDeleteProduct(productId) {
        const products = getProducts();
        const product = products.find(p => p.id === productId);
        if (!product) return;
        const confirmed = await showCustomAlert('Bekræft Sletning', `Er du sikker på, du vil slette <strong>${product.name}</strong> permanent?`, 'confirm');
        if (!confirmed) return;
        const { error } = await supabaseClient.from("products").delete().eq("id", productId);
        if (error) return showAlert(`Fejl: ${error.message}`);

        // REFETCH PATTERN: Hent fresh data fra database for at sikre UI er synkroniseret
        console.log('[handleDeleteProduct] Refetching products from database...');
        await refetchAllProducts();

        await fetchAndRenderProducts?.();
        renderProductsInModalFn?.(getProducts(), modalProductList);
        console.log('[handleDeleteProduct] Product deleted and UI refreshed');
    }
}
