// js/ui/product-management.js
import { getProductIconInfo, PRODUCT_ICON_CLASS_MAP } from '../domain/products-and-cart.js';
import { getOrder } from '../domain/order-store.js';
import { refetchAllProducts } from '../core/data-refetch.js';
import { runWithAuthRetry } from '../core/auth-retry.js';
import {
    STANDARD_ICONS,
    uploadProductIcon,
    removeProductIcon,
    formatIconUpdateTime,
    fetchInstitutionIconLibrary,
    fetchSharedIconLibrary,
    getInstitutionIconCount,
    deleteInstitutionIcon,
    fetchIconSharingSettings,
    processImageForUpload,
    takeProductPhoto,
} from '../core/product-icon-utils.js';

// Sæt til true ved fejlsøgning; hold false i prod for mindre console-støj
const PRODUCT_MANAGEMENT_DEBUG = false;

if (PRODUCT_MANAGEMENT_DEBUG) {
    console.log('🔥🔥🔥 product-management.js LOADED - Version with REFETCH + Custom Icon Upload 🔥🔥🔥');
}

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
    // Vis placeholders altid
    const visibleProducts = allProducts
        .filter(p => (p?.is_placeholder === true) || (p.is_visible !== false && p.is_enabled !== false))
        .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)); // Eksplicit sortering efter sort_order

    // Pre-beregn refill-berettigelse hvis der er en kunde
    const effectiveProducts = new Map();
    if (currentCustomer?.id) {
        if (PRODUCT_MANAGEMENT_DEBUG) console.log('[renderProductsGrid] Beregner refill for kunde:', currentCustomer.name, currentCustomer.id);
        const { getEffectiveProductForChild } = await import('../domain/products-and-cart.js');
        const childContext = {
            childId: currentCustomer.id,
            institutionId: currentCustomer.institution_id
        };

        // Batch alle refill checks parallelt for performance
        const refillChecks = visibleProducts.map(async (product) => {
            if (product?.is_placeholder) {
                return {
                    productId: product.placeholder_id || product.id || 'placeholder',
                    effective: { price: 0, name: product.name || 'Tom plads', isRefill: false }
                };
            }
            try {
                if (PRODUCT_MANAGEMENT_DEBUG) console.log('[renderProductsGrid] Tjekker refill for produkt:', product.name, 'refill_enabled:', product.refill_enabled);
                const effective = await getEffectiveProductForChild(product, childContext);
                if (PRODUCT_MANAGEMENT_DEBUG) console.log('[renderProductsGrid] Effective result for', product.name, ':', effective);
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
        if (PRODUCT_MANAGEMENT_DEBUG) console.log('[renderProductsGrid] Ingen kunde valgt, springer refill over');
    }

    const isReorderMode = document.body.classList.contains('reorder-mode');
    visibleProducts.forEach((product, index) => {
        const isPlaceholder = product?.is_placeholder === true;
        const productBtn = document.createElement('button');
        if (!isPlaceholder) {
            productBtn.dataset.productId = String(product.id);
        } else {
            const placeholderId = product?.placeholder_id || product?.id || `placeholder-${index}`;
            productBtn.dataset.placeholderId = String(placeholderId);
        }
        if (PRODUCT_MANAGEMENT_DEBUG) console.log(`[renderProductsGrid] Created button for product ${product.name} (id: ${product.id}), dataset.productId = "${productBtn.dataset.productId}"`);
        const productNameLower = product.name ? product.name.trim().toLowerCase() : '';

        if (isPlaceholder) {
            productBtn.className = 'product-btn product-placeholder';
            productBtn.innerHTML = `
                <div class="product-btn-inner placeholder-inner">
                    <div class="product-info-box">
                    </div>
                    <div class="placeholder-actions">
                        <button type="button" class="placeholder-action-btn" data-placeholder-action="select" data-placeholder-id="${productBtn.dataset.placeholderId}">Vælg Produkt</button>
                        <button type="button" class="placeholder-action-btn" data-placeholder-action="create" data-placeholder-id="${productBtn.dataset.placeholderId}">Opret Nyt Produkt</button>
                    </div>
                </div>
                <div class="product-remove-overlay" data-placeholder-id="${productBtn.dataset.placeholderId}">
                    <span class="product-remove-x">✕</span>
                </div>`;
            productBtn.addEventListener('click', (evt) => {
                // Tillad remove-overlay clicks at gå gennem
                if (evt.target.closest('.product-remove-overlay')) return;
                if (evt.target.closest('.placeholder-action-btn')) return;
                evt.preventDefault();
                evt.stopPropagation();
            });
            productsContainer.appendChild(productBtn);
            return;
        }

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

        const priceInWholeKr = Math.round(Number(displayPrice ?? 0));
        const nameMarkup = isReorderMode
            ? `<span class="product-name-wrapper">
                <span class="product-edit-icon">✎</span>
                <span class="product-name product-edit-name" contenteditable="true" data-product-id="${product.id}">${displayName || ''}</span>
               </span>`
            : `<span class="product-name">${displayName}</span>`;
        const priceMarkup = isReorderMode
            ? `<span class="product-price${isRefill ? ' refill-price' : ''} product-edit-price-wrap">
                    <span class="product-edit-icon">✎</span>
                    <input type="number" class="product-edit-price-input" data-product-id="${product.id}" value="${priceInWholeKr}" min="0" step="1" inputmode="numeric">
                    <span class="product-edit-price-currency">DKK</span>
               </span>`
            : `<span class="product-price${isRefill ? ' refill-price' : ''}">${displayPrice.toFixed(2)} DKK</span>`;

        productBtn.innerHTML = `
            <div class="product-btn-inner">
                ${timerMarkup}
                ${visualMarkup}
                <div class="product-info-box">
                    ${nameMarkup}
                    ${priceMarkup}
                </div>
                ${badgeMarkup}
                <div class="product-quantity-badge"><span class="cart-icon">🛒</span><span class="cart-qty">${qtyInCart}</span></div>
            </div>
            <div class="avatar-lock-overlay">
                <img src="Icons/webp/Function/Lock.webp" alt="locked">
            </div>
            <div class="product-limit-counter" aria-hidden="true"></div>
            <div class="product-remove-overlay" data-product-id="${product.id}">
                <span class="product-remove-x">✕</span>
            </div>
            <div class="product-edit-pencil" data-product-id="${product.id}">
                <span>✏️</span>
            </div>`;

        if (typeof onProductClick === 'function') {
            // Debounce state per produkt-knap for at forhindre dobbeltklik og repeat-klik
            let isProcessing = false;
            let lastClickTime = 0;
            const CLICK_DEBOUNCE_MS = 300; // Minimum tid mellem klik (300ms = ~3 klik/sekund max)
            
            productBtn.addEventListener('click', async (evt) => {
                if (evt.target.closest('.product-remove-overlay')) {
                    evt.preventDefault();
                    return;
                }
                if (evt.target.closest('.product-edit-pencil')) {
                    evt.preventDefault();
                    return; // Handled by event delegation in product-assortment-flow.js
                }
                
                // Forhindre dobbeltklik og repeat-klik
                const now = Date.now();
                const timeSinceLastClick = now - lastClickTime;
                
                if (isProcessing) {
                    evt.preventDefault();
                    evt.stopPropagation();
                    return;
                }
                
                if (timeSinceLastClick < CLICK_DEBOUNCE_MS) {
                    evt.preventDefault();
                    evt.stopPropagation();
                    return;
                }
                
                // Marker som processing og opdater tid
                isProcessing = true;
                lastClickTime = now;
                
                try {
                    // Hvis det er et refill-køb, skal vi sende den effektive data med
                    const productToAdd = isRefill && effectiveData ? {
                        ...product,
                        _effectivePrice: displayPrice,
                        _effectiveName: displayName,
                        _isRefill: true
                    } : product;
                    
                    await onProductClick(productToAdd, evt);
                } finally {
                    // Reset processing flag efter en kort forsinkelse
                    setTimeout(() => {
                        isProcessing = false;
                    }, CLICK_DEBOUNCE_MS);
                }
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

    // Eksponér showAddEditProductModal til window så andre moduler kan åbne den
    window.__flangoOpenEditProductModal = (product) => showAddEditProductModal(product);

    async function showAddEditProductModal(product = null) {
        const isEditing = product !== null;
        let currentProduct = product;
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
        const existingBulkDiscountEnabled = isEditing && product?.bulk_discount_enabled === true;
        const existingBulkDiscountQty = isEditing && Number.isFinite(product?.bulk_discount_qty)
            ? product.bulk_discount_qty
            : '';
        const existingBulkDiscountPrice = isEditing && Number.isFinite(product?.bulk_discount_price_ore)
            ? (product.bulk_discount_price_ore / 100)
            : '';
        const existingDailySpecial = isEditing && product?.is_daily_special === true;
        const existingCoreAssortment = isEditing && product?.is_core_assortment === true;

        // Load parent portal settings and sugar policy to determine which fields to show
        const { data: portalSettings } = await supabaseClient
            .from('institutions')
            .select('parent_portal_allergens, parent_portal_vegetarian_only, parent_portal_no_pork, sugar_policy_enabled, restaurant_mode_enabled')
            .eq('id', institutionId)
            .single();

        const showAllergens = portalSettings?.parent_portal_allergens !== false;
        const showVegetarian = portalSettings?.parent_portal_vegetarian_only !== false;
        const showPork = portalSettings?.parent_portal_no_pork !== false;
        // Only show "Usund Vare" checkbox if sugar policy is enabled
        const showUnhealthy = portalSettings?.sugar_policy_enabled === true;
        const showRestaurantVariants = portalSettings?.restaurant_mode_enabled === true;
        // Hent eksisterende varianter fra produktet
        let restaurantVariantsArray = isEditing && Array.isArray(product?.restaurant_variants)
            ? [...product.restaurant_variants]
            : [];

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
                        <input type="checkbox" id="product-bulk-discount-enabled" ${existingBulkDiscountEnabled ? 'checked' : ''}>
                        Aktiver mængderabat
                    </label>
                </div>
                <div id="bulk-discount-fields" class="refill-fields ${existingBulkDiscountEnabled ? '' : 'hidden'}">
                    <div class="refill-field">
                        <label for="product-bulk-discount-qty">Antal (fx 2)</label>
                        <input type="number" id="product-bulk-discount-qty" min="2" step="1" placeholder="Antal (fx 2)" value="${existingBulkDiscountQty}">
                    </div>
                    <div class="refill-field">
                        <label for="product-bulk-discount-price">Pris for antal (fx 10,00)</label>
                        <input type="number" id="product-bulk-discount-price" class="refill-price-input" min="0" step="0.01" placeholder="Pris for antal (fx 10,00)" value="${existingBulkDiscountPrice === '' ? '' : existingBulkDiscountPrice}">
                    </div>
                    <div class="refill-help">Gælder kun når de købes samtidigt i samme ordre.</div>
                    <div id="bulk-discount-preview" class="refill-help"></div>
                    <div id="bulk-discount-warning" class="refill-help"></div>
                </div>
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
                <div class="refill-row">
                    <label class="refill-option">
                        <input type="checkbox" id="product-is-daily-special" ${existingDailySpecial ? 'checked' : ''}>
                        Dagens ret
                    </label>
                </div>
                <div class="refill-row">
                    <label class="refill-option">
                        <input type="checkbox" id="product-is-core-assortment" ${existingCoreAssortment ? 'checked' : ''}>
                        Fast sortiment
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
                ${showRestaurantVariants ? `
                <div class="collapsible-section">
                    <h4 class="collapsible-header" data-target="restaurant-variants-content" style="cursor: pointer; user-select: none; padding: 10px; background: var(--secondary-bg, #f5f5f5); border-radius: 8px; margin: 10px 0;">
                        <span class="collapse-arrow" style="display: inline-block; transition: transform 0.2s; margin-right: 8px;">▶</span> 🍽️ Restaurant-varianter
                    </h4>
                    <div id="restaurant-variants-content" class="collapsible-content" style="display: none; padding: 10px 0;">
                        <div class="rv-help">Opret faste varianter som tjeneren kan vælge ved bestilling (fx "gul", "grøn" for myslibar).</div>
                        <div class="rv-tags" id="rv-tags-container"></div>
                        <div class="rv-add-row">
                            <input type="text" id="rv-new-tag-input" placeholder="Ny variant (fx 'gul')" maxlength="30">
                            <button type="button" id="rv-add-tag-btn" class="rv-add-btn">+ Tilføj</button>
                        </div>
                    </div>
                </div>` : ''}
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

                        <!-- Icon Type Selection (5 tabs, wrapping) -->
                        <div id="icon-type-selector" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 15px;">
                            <label class="icon-type-card" style="flex: 1 1 calc(33% - 6px); min-width: 90px; padding: 10px 6px; border: 2px solid #e0e0e0; border-radius: 10px; cursor: pointer; text-align: center; transition: all 0.2s;">
                                <input type="radio" name="icon-type" value="standard" style="display: none;">
                                <div style="font-size: 20px; margin-bottom: 3px;">📁</div>
                                <div style="font-weight: 600; font-size: 11px;">Standard</div>
                            </label>
                            <label class="icon-type-card" style="flex: 1 1 calc(33% - 6px); min-width: 90px; padding: 10px 6px; border: 2px solid #e0e0e0; border-radius: 10px; cursor: pointer; text-align: center; transition: all 0.2s;">
                                <input type="radio" name="icon-type" value="institution" style="display: none;">
                                <div style="font-size: 20px; margin-bottom: 3px;">🏠</div>
                                <div style="font-weight: 600; font-size: 11px;" id="institution-icons-tab-label">Jeres ikoner</div>
                            </label>
                            <label class="icon-type-card" style="flex: 1 1 calc(33% - 6px); min-width: 90px; padding: 10px 6px; border: 2px solid #e0e0e0; border-radius: 10px; cursor: pointer; text-align: center; transition: all 0.2s;">
                                <input type="radio" name="icon-type" value="shared" style="display: none;">
                                <div style="font-size: 20px; margin-bottom: 3px;">🌐</div>
                                <div style="font-weight: 600; font-size: 11px;">Fra andre</div>
                            </label>
                            <label class="icon-type-card" style="flex: 1 1 calc(33% - 6px); min-width: 90px; padding: 10px 6px; border: 2px solid #e0e0e0; border-radius: 10px; cursor: pointer; text-align: center; transition: all 0.2s;">
                                <input type="radio" name="icon-type" value="camera" style="display: none;">
                                <div style="font-size: 20px; margin-bottom: 3px;">📸</div>
                                <div style="font-weight: 600; font-size: 11px;">Tag Billede</div>
                            </label>
                            <label class="icon-type-card" style="flex: 1 1 calc(33% - 6px); min-width: 90px; padding: 10px 6px; border: 2px solid #e0e0e0; border-radius: 10px; cursor: pointer; text-align: center; transition: all 0.2s;">
                                <input type="radio" name="icon-type" value="custom" style="display: none;">
                                <div style="font-size: 20px; margin-bottom: 3px;">📤</div>
                                <div style="font-weight: 600; font-size: 11px;">Upload</div>
                            </label>
                            <label class="icon-type-card" style="flex: 1 1 calc(33% - 6px); min-width: 90px; padding: 10px 6px; border: 2px solid #e0e0e0; border-radius: 10px; cursor: pointer; text-align: center; transition: all 0.2s;">
                                <input type="radio" name="icon-type" value="ai" style="display: none;">
                                <div style="font-size: 20px; margin-bottom: 3px;">🪄</div>
                                <div style="font-weight: 600; font-size: 11px;">AI Generer</div>
                            </label>
                        </div>

                        <!-- Standard Icon Section (Flango Standard only) -->
                        <div id="standard-icon-section" style="display: none;">
                            <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #4682b4;">Flango Standard</label>
                            <div id="standard-icon-grid" class="custom-icon-grid"></div>

                            <label style="margin-top: 15px; display: block; font-weight: 500;">Eller vælg emoji</label>
                            <input type="text" id="product-emoji-input" placeholder="Indtast emoji her..." value="${isEditing && product.emoji ? product.emoji : ''}" style="margin-top: 5px;">
                            <div id="product-emoji-grid" class="emoji-grid" style="padding-top: 10px;"></div>
                        </div>

                        <!-- Institution Icons Section (own uploaded + AI-generated) -->
                        <div id="institution-icons-section" style="display: none;">
                            <label id="institution-icons-heading" style="display: block; font-weight: 600; margin-bottom: 8px; color: #7c3aed;">Jeres ikoner</label>
                            <div id="institution-icons-grid" class="custom-icon-grid"></div>
                            <div id="institution-icons-empty" style="display: none; padding: 15px; text-align: center; color: #94a3b8; font-size: 13px; background: #f8f9fa; border-radius: 8px;">
                                Ingen egne ikoner endnu — upload eller generer via AI.
                            </div>
                        </div>

                        <!-- Shared Icons from Other Institutions -->
                        <div id="shared-icons-section" style="display: none;">
                            <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #059669;">Ikoner fra andre institutioner</label>
                            <div id="shared-icons-grid" class="custom-icon-grid"></div>
                            <div id="shared-icons-empty" style="display: none; padding: 15px; text-align: center; color: #94a3b8; font-size: 13px; background: #f8f9fa; border-radius: 8px;">
                                Ingen delte ikoner tilgængelige.
                            </div>
                        </div>

                        <!-- Camera Capture Section -->
                        <div id="camera-section" style="display: none;">
                            <div id="camera-preview-area" style="text-align: center;">
                                <div id="camera-placeholder" style="border: 2px dashed #60a5fa; border-radius: 12px; padding: 30px 20px; background: #eff6ff; cursor: pointer; transition: all 0.2s;">
                                    <div style="font-size: 40px; margin-bottom: 10px;">📸</div>
                                    <div style="font-weight: 600; margin-bottom: 5px; color: #1e40af;">Klik for at tage billede</div>
                                    <div style="font-size: 12px; color: #64748b;">Billedet konverteres automatisk til ikon-format</div>
                                </div>
                                <div id="camera-captured-preview" style="display: none; margin-top: 12px;">
                                    <div style="position: relative; display: inline-block;">
                                        <img id="camera-captured-img" style="width: 120px; height: 120px; object-fit: cover; border-radius: 12px; border: 3px solid #60a5fa;">
                                        <button type="button" id="camera-retake-btn" style="position: absolute; top: -8px; right: -8px; width: 26px; height: 26px; border-radius: 50%; background: #ef4444; color: white; border: none; font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center;">&#10005;</button>
                                    </div>
                                </div>
                            </div>

                            <div id="camera-actions" style="display: none; margin-top: 15px; flex-direction: column; gap: 10px;">
                                <button type="button" id="camera-use-as-icon-btn" style="display: none; width: 100%; padding: 12px 20px; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; border: none; border-radius: 10px; font-weight: 600; font-size: 14px; cursor: pointer; transition: opacity 0.2s;">
                                    Brug som ikon
                                </button>
                                <button type="button" id="camera-use-as-ai-ref-btn" style="display: none; width: 100%; padding: 12px 20px; background: linear-gradient(135deg, #7c3aed, #a78bfa); color: white; border: none; border-radius: 10px; font-weight: 600; font-size: 14px; cursor: pointer; transition: opacity 0.2s;">
                                    Brug som AI-reference
                                </button>
                            </div>

                            <div id="camera-progress" style="display: none; margin-top: 15px; padding: 15px; background: #e3f2fd; border-radius: 8px; text-align: center;">
                                <div style="font-size: 14px; color: #1976d2;">Behandler billede...</div>
                            </div>

                            <div id="camera-error" style="display: none; margin-top: 15px; padding: 15px; background: #ffebee; border-radius: 8px; text-align: center;">
                                <div style="font-size: 14px; color: #c62828;"></div>
                            </div>
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

                        <!-- AI Icon Generation Section -->
                        <div id="ai-icon-section" style="display: none;">
                            <label style="font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 6px; display: block;">Produktnavn</label>
                            <input type="text" id="ai-icon-input" placeholder="fx Pasta med kødsovs" maxlength="100" style="width: 100%; padding: 10px 14px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 14px; margin-bottom: 12px; box-sizing: border-box;">

                            <!-- Stil-vaelger (Clay / Pixar / Fri prompt) -->
                            <label style="font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 6px; display: block;">Stil</label>
                            <div id="ai-style-selector" style="display: flex; gap: 8px; margin-bottom: 12px;">
                                <button type="button" class="ai-style-btn" data-style="clay" style="flex: 1; padding: 10px 12px; border: 2px solid #7c3aed; background: #f5f3ff; border-radius: 10px; cursor: pointer; text-align: center; font-weight: 600; font-size: 13px; color: #7c3aed; transition: all 0.2s;">
                                    Clay
                                </button>
                                <button type="button" class="ai-style-btn" data-style="pixar" style="flex: 1; padding: 10px 12px; border: 2px solid #e0e0e0; background: #fff; border-radius: 10px; cursor: pointer; text-align: center; font-weight: 600; font-size: 13px; color: #64748b; transition: all 0.2s;">
                                    Pixar
                                </button>
                                <button type="button" class="ai-style-btn" data-style="custom" style="flex: 1; padding: 10px 12px; border: 2px solid #e0e0e0; background: #fff; border-radius: 10px; cursor: pointer; text-align: center; font-weight: 600; font-size: 13px; color: #64748b; transition: all 0.2s;">
                                    Fri prompt
                                </button>
                            </div>

                            <!-- Fri prompt textarea (kun synlig naar 'custom' er valgt) -->
                            <div id="ai-custom-prompt-section" style="display: none; margin-bottom: 12px;">
                                <label style="font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 6px; display: block;">Din prompt</label>
                                <textarea id="ai-custom-prompt" maxlength="500" placeholder="A golden crispy croissant floating in space with sparkles" style="width: 100%; min-height: 80px; padding: 10px 14px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 13px; font-family: inherit; resize: vertical; box-sizing: border-box;"></textarea>
                                <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">Prompten sendes direkte til AI — ingen automatisk stil tilføjes</div>
                            </div>

                            <!-- Foto-reference (valgfrit) -->
                            <label style="font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
                                📷 Foto
                                <span style="font-size: 11px; font-weight: 500; color: #94a3b8; background: #f1f5f9; padding: 1px 8px; border-radius: 8px;">valgfrit</span>
                            </label>
                            <div id="ai-photo-upload-area" style="margin-bottom: 12px;">
                                <input type="file" id="ai-reference-file" accept="image/*" style="display: none;">
                                <div id="ai-photo-dropzone" style="border: 2px dashed #d1d5db; border-radius: 10px; padding: 14px; text-align: center; cursor: pointer; transition: all 0.2s; background: #fafafa;">
                                    <div style="font-size: 13px; color: #64748b;">📸 Klik eller træk et foto hertil</div>
                                </div>
                                <div id="ai-reference-preview" style="display: none; margin-top: 8px; position: relative;">
                                    <img id="ai-reference-img" style="width: 80px; height: 80px; object-fit: cover; border-radius: 10px; border: 2px solid #e0e0e0;">
                                    <button type="button" id="ai-remove-photo-btn" style="position: absolute; top: -6px; right: -6px; width: 22px; height: 22px; border-radius: 50%; background: #ef4444; color: white; border: none; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1;">✕</button>
                                </div>
                            </div>

                            <!-- Foto-tilstand (Reference / Motiv) — kun synlig naar foto er uploadet -->
                            <div id="ai-photo-mode-selector" style="display: none; margin-bottom: 12px;">
                                <label style="font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 6px; display: block;">Foto-tilstand</label>
                                <div style="display: flex; gap: 8px;">
                                    <button type="button" class="ai-photo-mode-btn" data-mode="reference" style="flex: 1; padding: 8px 10px; border: 2px solid #7c3aed; background: #f5f3ff; border-radius: 10px; cursor: pointer; text-align: center; transition: all 0.2s;">
                                        <div style="font-weight: 600; font-size: 12px; color: #7c3aed;">Reference</div>
                                        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Identificer maden</div>
                                    </button>
                                    <button type="button" class="ai-photo-mode-btn" data-mode="motiv" style="flex: 1; padding: 8px 10px; border: 2px solid #e0e0e0; background: #fff; border-radius: 10px; cursor: pointer; text-align: center; transition: all 0.2s;">
                                        <div style="font-weight: 600; font-size: 12px; color: #64748b;">Motiv</div>
                                        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Genskab komposition</div>
                                    </button>
                                    <button type="button" class="ai-photo-mode-btn" data-mode="portrait" style="flex: 1; padding: 8px 10px; border: 2px solid #e0e0e0; background: #fff; border-radius: 10px; cursor: pointer; text-align: center; transition: all 0.2s;">
                                        <div style="font-weight: 600; font-size: 12px; color: #64748b;">Portræt</div>
                                        <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Animeret version</div>
                                    </button>
                                </div>
                            </div>

                            <button type="button" id="ai-generate-btn" style="width: 100%; padding: 12px 20px; background: linear-gradient(135deg, #7c3aed, #a78bfa); color: white; border: none; border-radius: 10px; font-weight: 600; font-size: 14px; cursor: pointer; transition: opacity 0.2s; margin-bottom: 12px; position: relative; z-index: 2; -webkit-tap-highlight-color: rgba(124, 58, 237, 0.3); touch-action: manipulation;">
                                ✨ Generer
                            </button>

                            <div id="ai-icon-preview" style="min-height: 0; text-align: center; transition: all 0.3s;"></div>
                            <div id="ai-icon-actions" style="display: none; margin-top: 12px; gap: 10px;">
                                <button type="button" id="ai-icon-accept-btn" style="flex: 1; padding: 10px; background: #22c55e; color: white; border: none; border-radius: 10px; font-weight: 600; cursor: pointer;">
                                    Brug dette ikon
                                </button>
                                <button type="button" id="ai-icon-retry-btn" style="flex: 1; padding: 10px; background: #f1f5f9; color: #334155; border: 1px solid #e2e8f0; border-radius: 10px; font-weight: 600; cursor: pointer;">
                                    🔄 Prøv igen
                                </button>
                            </div>
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

        // ── Restaurant-varianter tag-manager ──
        const rvTagsContainer = document.getElementById('rv-tags-container');
        const rvNewTagInput = document.getElementById('rv-new-tag-input');
        const rvAddTagBtn = document.getElementById('rv-add-tag-btn');

        function renderVariantTags() {
            if (!rvTagsContainer) return;
            rvTagsContainer.innerHTML = '';
            restaurantVariantsArray.forEach((tag, idx) => {
                const span = document.createElement('span');
                span.className = 'rv-tag';
                span.innerHTML = `${tag} <button type="button" class="rv-tag-remove" data-idx="${idx}">✕</button>`;
                rvTagsContainer.appendChild(span);
            });
            // Attach remove handlers
            rvTagsContainer.querySelectorAll('.rv-tag-remove').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const idx = parseInt(e.target.dataset.idx, 10);
                    restaurantVariantsArray.splice(idx, 1);
                    renderVariantTags();
                });
            });
        }

        function addVariantTag() {
            if (!rvNewTagInput) return;
            const val = rvNewTagInput.value.trim();
            if (!val) return;
            if (restaurantVariantsArray.includes(val)) {
                rvNewTagInput.value = '';
                return; // Undgå dubletter
            }
            restaurantVariantsArray.push(val);
            rvNewTagInput.value = '';
            renderVariantTags();
            rvNewTagInput.focus();
        }

        if (rvAddTagBtn) rvAddTagBtn.addEventListener('click', addVariantTag);
        if (rvNewTagInput) rvNewTagInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); addVariantTag(); }
        });
        renderVariantTags(); // Render eksisterende tags

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
        const institutionIconsSection = document.getElementById('institution-icons-section');
        const sharedIconsSection = document.getElementById('shared-icons-section');
        const customUploadSection = document.getElementById('custom-upload-section');
        const uploadDropzone = document.getElementById('upload-dropzone');
        const iconFileInput = document.getElementById('icon-file-input');
        const uploadProgress = document.getElementById('upload-progress');
        const uploadError = document.getElementById('upload-error');
        const removeCustomIconBtn = document.getElementById('remove-custom-icon-btn');
        const iconTypeCards = document.querySelectorAll('.icon-type-card');

        // Set institution name in tab label and heading
        const instName = localStorage.getItem('flango_institution_name') || 'Jeres';
        const instTabLabel = document.getElementById('institution-icons-tab-label');
        const instHeading = document.getElementById('institution-icons-heading');
        if (instTabLabel) instTabLabel.textContent = `${instName}s`;
        if (instHeading) instHeading.textContent = `${instName}s ikoner`;

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

        // Switch between standard, institution, shared, camera, custom, and AI icon sections
        const aiIconSection = document.getElementById('ai-icon-section');
        const cameraSection = document.getElementById('camera-section');
        const switchIconType = (type) => {
            iconTypeCards.forEach(card => {
                const radio = card.querySelector('input[type="radio"]');
                const isSelected = radio.value === type;
                radio.checked = isSelected;
                card.style.borderColor = isSelected ? '#4682b4' : '#e0e0e0';
                card.style.background = isSelected ? '#e3f2fd' : '#fff';
            });

            standardIconSection.style.display = type === 'standard' ? 'block' : 'none';
            if (institutionIconsSection) institutionIconsSection.style.display = type === 'institution' ? 'block' : 'none';
            if (sharedIconsSection) sharedIconsSection.style.display = type === 'shared' ? 'block' : 'none';
            if (cameraSection) cameraSection.style.display = type === 'camera' ? 'block' : 'none';
            customUploadSection.style.display = type === 'custom' ? 'block' : 'none';
            if (aiIconSection) aiIconSection.style.display = type === 'ai' ? 'block' : 'none';

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
                const type = radio.value;
                switchIconType(type);
                // Lazy-load shared icons on first visit
                if (type === 'shared' && !sharedIconsLoaded) {
                    sharedIconsLoaded = true;
                    loadSharedIcons();
                }
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
            // Clear custom icon_url so the selected standard/institution/shared icon takes priority in preview
            currentIconUrl = null;
            currentIconUpdatedAt = null;
            updateStandardIconSelection();
            updateIconPreview();
        };
        standardIconGrid.addEventListener('click', handleStandardIconClick);

        // ===== INSTITUTION ICONS (own uploaded + AI-generated) =====
        const institutionIconsGrid = document.getElementById('institution-icons-grid');
        const institutionIconsEmpty = document.getElementById('institution-icons-empty');

        const loadInstitutionIcons = async () => {
            if (!institutionIconsGrid) return;
            institutionIconsGrid.innerHTML = '';

            const libraryIcons = await fetchInstitutionIconLibrary(institutionId);

            if (libraryIcons.length === 0) {
                if (institutionIconsEmpty) institutionIconsEmpty.style.display = 'block';
                return;
            }
            if (institutionIconsEmpty) institutionIconsEmpty.style.display = 'none';

            libraryIcons.forEach(icon => {
                const option = document.createElement('div');
                option.className = 'custom-icon-option';
                option.dataset.path = icon.icon_url;
                const sourceTag = icon.source === 'uploaded' ? '📤' : '🪄';
                option.innerHTML = `<img src="${icon.icon_url}" alt="${icon.name}"><span>${sourceTag} ${icon.name}</span>`;
                institutionIconsGrid.appendChild(option);
            });

            updateStandardIconSelection();
        };

        // Click handler for institution icons grid
        institutionIconsGrid?.addEventListener('click', handleStandardIconClick);

        // Load institution icons
        loadInstitutionIcons();

        // ===== SHARED ICONS (from other institutions) =====
        const sharedIconsGrid = document.getElementById('shared-icons-grid');
        const sharedIconsEmpty = document.getElementById('shared-icons-empty');

        const loadSharedIcons = async () => {
            if (!sharedIconsGrid) return;
            sharedIconsGrid.innerHTML = '';

            // Check if our institution has "use shared" enabled
            const settings = await fetchIconSharingSettings(institutionId);
            if (!settings.icon_use_shared_enabled) {
                if (sharedIconsEmpty) {
                    sharedIconsEmpty.textContent = 'Brug af delte ikoner er ikke aktiveret. Slå det til under Institutionsindstillinger.';
                    sharedIconsEmpty.style.display = 'block';
                }
                return;
            }

            const sharedIcons = await fetchSharedIconLibrary(institutionId);

            if (sharedIcons.length === 0) {
                if (sharedIconsEmpty) sharedIconsEmpty.style.display = 'block';
                return;
            }
            if (sharedIconsEmpty) sharedIconsEmpty.style.display = 'none';

            sharedIcons.forEach(icon => {
                const option = document.createElement('div');
                option.className = 'custom-icon-option';
                option.dataset.path = icon.icon_url;
                option.innerHTML = `<img src="${icon.icon_url}" alt="${icon.name}"><span>${icon.name}</span>`;
                sharedIconsGrid.appendChild(option);
            });

            updateStandardIconSelection();
        };

        // Click handler for shared icons grid
        sharedIconsGrid?.addEventListener('click', handleStandardIconClick);

        // Load shared icons (lazy — only when tab is opened for the first time)
        let sharedIconsLoaded = false;

        const updateStandardIconSelection = () => {
            const allOptions = [
                ...standardIconGrid.querySelectorAll('.custom-icon-option'),
                ...(institutionIconsGrid?.querySelectorAll('.custom-icon-option') || []),
                ...(sharedIconsGrid?.querySelectorAll('.custom-icon-option') || []),
            ];
            allOptions.forEach(opt => {
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

                // Process image client-side: resize to 256x256, convert to WebP, compress
                const processedBlob = await processImageForUpload(file);
                const processedFile = new File([processedBlob], `${currentProduct.id}.webp`, { type: 'image/webp' });

                const result = await uploadProductIcon(processedFile, institutionId, currentProduct.id, adminUserId);

                if (result.success) {
                    currentIconUrl = result.icon_url;
                    currentIconUpdatedAt = result.icon_updated_at;
                    updateIconPreview();
                    removeCustomIconBtn.style.display = 'block';
                    playSound?.('success');
                    // Refresh institution icons grid (upload also saves to library)
                    loadInstitutionIcons();
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
            if (!currentProduct?.id || !currentIconUrl) return;

            removeCustomIconBtn.disabled = true;
            removeCustomIconBtn.textContent = 'Fjerner...';

            try {
                const result = await removeProductIcon(currentProduct.id);
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

        // ===== CAMERA CAPTURE HANDLERS =====
        const cameraPlaceholder = document.getElementById('camera-placeholder');
        const cameraCapturedPreview = document.getElementById('camera-captured-preview');
        const cameraCapturedImg = document.getElementById('camera-captured-img');
        const cameraRetakeBtn = document.getElementById('camera-retake-btn');
        const cameraUseAsIconBtn = document.getElementById('camera-use-as-icon-btn');
        const cameraUseAsAiRefBtn = document.getElementById('camera-use-as-ai-ref-btn');
        const cameraActions = document.getElementById('camera-actions');
        const cameraProgress = document.getElementById('camera-progress');
        const cameraError = document.getElementById('camera-error');
        let cameraCapturedFile = null;
        let _injectPhotoToAiRef = null; // Set later when AI section initializes

        const resetCameraUI = () => {
            cameraCapturedFile = null;
            if (cameraCapturedImg?.src?.startsWith('blob:')) URL.revokeObjectURL(cameraCapturedImg.src);
            if (cameraCapturedImg) cameraCapturedImg.src = '';
            if (cameraCapturedPreview) cameraCapturedPreview.style.display = 'none';
            if (cameraPlaceholder) cameraPlaceholder.style.display = 'block';
            if (cameraActions) cameraActions.style.display = 'none';
            if (cameraUseAsIconBtn) cameraUseAsIconBtn.style.display = 'none';
            if (cameraUseAsAiRefBtn) cameraUseAsAiRefBtn.style.display = 'none';
            if (cameraProgress) cameraProgress.style.display = 'none';
            if (cameraError) cameraError.style.display = 'none';
        };

        const showCameraPreview = (file) => {
            cameraCapturedFile = file;
            if (cameraCapturedImg) cameraCapturedImg.src = URL.createObjectURL(file);
            if (cameraCapturedPreview) cameraCapturedPreview.style.display = 'block';
            if (cameraPlaceholder) cameraPlaceholder.style.display = 'none';
            if (cameraActions) cameraActions.style.display = 'flex';
            if (cameraUseAsIconBtn) cameraUseAsIconBtn.style.display = 'block';
            if (cameraUseAsAiRefBtn) cameraUseAsAiRefBtn.style.display = 'block';
        };

        const triggerCameraCapture = async () => {
            if (cameraError) cameraError.style.display = 'none';
            try {
                const file = await takeProductPhoto({ showCustomAlert });
                if (file) showCameraPreview(file);
            } catch (err) {
                console.error('[cameraCapture] Error:', err);
                if (cameraError) {
                    cameraError.style.display = 'block';
                    const errDiv = cameraError.querySelector('div');
                    if (errDiv) errDiv.textContent = 'Kunne ikke tage billede: ' + (err.message || 'Ukendt fejl');
                }
            }
        };

        cameraPlaceholder?.addEventListener('click', triggerCameraCapture);
        cameraRetakeBtn?.addEventListener('click', () => {
            resetCameraUI();
            triggerCameraCapture();
        });

        // "Brug som ikon" — process + upload directly
        cameraUseAsIconBtn?.addEventListener('click', async () => {
            if (!cameraCapturedFile || !isEditing || !currentProduct?.id) {
                if (!isEditing) showCustomAlert('Gem produkt', 'Produktet skal gemmes inden du kan tilfoeje et ikon.');
                return;
            }
            if (cameraError) cameraError.style.display = 'none';
            if (cameraProgress) cameraProgress.style.display = 'block';
            cameraUseAsIconBtn.disabled = true;
            cameraUseAsAiRefBtn.disabled = true;

            try {
                const adminUserId = adminProfile?.user_id;
                if (!adminUserId) throw new Error('Admin bruger ID ikke fundet');

                const processedBlob = await processImageForUpload(cameraCapturedFile);
                const processedFile = new File([processedBlob], `${currentProduct.id}.webp`, { type: 'image/webp' });
                const result = await uploadProductIcon(processedFile, institutionId, currentProduct.id, adminUserId);

                if (result.success) {
                    currentIconUrl = result.icon_url;
                    currentIconUpdatedAt = result.icon_updated_at;
                    updateIconPreview();
                    playSound?.('success');
                    loadInstitutionIcons();
                    resetCameraUI();
                } else {
                    throw new Error(result.error || 'Upload fejlede');
                }
            } catch (err) {
                console.error('[cameraUseAsIcon] Error:', err);
                if (cameraError) {
                    cameraError.style.display = 'block';
                    const errDiv = cameraError.querySelector('div');
                    if (errDiv) errDiv.textContent = err.message || 'Kunne ikke uploade billede';
                }
                playSound?.('error');
            } finally {
                if (cameraProgress) cameraProgress.style.display = 'none';
                cameraUseAsIconBtn.disabled = false;
                cameraUseAsAiRefBtn.disabled = false;
            }
        });

        // "Brug som AI-reference" — switch to AI tab and insert the captured photo
        cameraUseAsAiRefBtn?.addEventListener('click', () => {
            if (!cameraCapturedFile) return;
            // Switch to AI tab
            switchIconType('ai');
            // Insert captured file into AI photo reference using the existing showPhotoPreview
            // (showPhotoPreview is defined in the AI photo reference section below)
            if (_injectPhotoToAiRef) _injectPhotoToAiRef(cameraCapturedFile);
            resetCameraUI();
        });

        // ===== AI ICON GENERATION =====
        const aiIconInput = document.getElementById('ai-icon-input');
        const aiGenerateBtn = document.getElementById('ai-generate-btn');
        const aiIconPreview = document.getElementById('ai-icon-preview');
        const aiIconActions = document.getElementById('ai-icon-actions');
        const aiIconAcceptBtn = document.getElementById('ai-icon-accept-btn');
        const aiIconRetryBtn = document.getElementById('ai-icon-retry-btn');
        let aiGeneratedUrl = null;
        let aiIsGenerating = false;

        // Pre-fill AI input with product name
        if (isEditing && product?.name && aiIconInput) {
            aiIconInput.value = product.name;
        }

        // ===== AI STYLE SELECTOR (Clay / Pixar / Fri prompt) =====
        let aiSelectedStyle = 'clay'; // 'clay', 'pixar', or 'custom'
        const aiStyleBtns = document.querySelectorAll('.ai-style-btn');
        const aiCustomPromptSection = document.getElementById('ai-custom-prompt-section');
        const aiCustomPromptInput = document.getElementById('ai-custom-prompt');
        const aiProductNameSection = document.getElementById('ai-icon-input')?.parentElement ? document.getElementById('ai-icon-input') : null;
        const aiProductNameLabel = aiProductNameSection?.previousElementSibling;
        const aiPhotoUploadArea = document.getElementById('ai-photo-upload-area');
        const aiPhotoLabel = aiPhotoUploadArea?.previousElementSibling;

        const updateStyleBtns = () => {
            aiStyleBtns.forEach(btn => {
                const isActive = btn.dataset.style === aiSelectedStyle;
                btn.style.borderColor = isActive ? '#7c3aed' : '#e0e0e0';
                btn.style.background = isActive ? '#f5f3ff' : '#fff';
                btn.style.color = isActive ? '#7c3aed' : '#64748b';
            });
            // Show/hide custom prompt section
            const isCustom = aiSelectedStyle === 'custom';
            if (aiCustomPromptSection) aiCustomPromptSection.style.display = isCustom ? 'block' : 'none';
            // Hide product name input when custom (user writes full prompt)
            if (aiProductNameSection) aiProductNameSection.style.display = isCustom ? 'none' : '';
            if (aiProductNameLabel) aiProductNameLabel.style.display = isCustom ? 'none' : '';
            // Photo upload stays visible in custom mode (optional photo)
            // But photo label text changes
            if (aiPhotoLabel && aiPhotoLabel.tagName === 'LABEL') {
                const photoLabelSpan = aiPhotoLabel.querySelector('span');
                if (photoLabelSpan) photoLabelSpan.textContent = 'valgfrit';
            }
            // Hide photo-mode selector when custom
            updatePhotoModeVisibility(!!aiSelectedPhoto);
            // If portrait was selected but we switched to Clay, reset to reference
            updatePortraitAvailability();
        };
        aiStyleBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                aiSelectedStyle = btn.dataset.style;
                updateStyleBtns();
            });
        });

        // ===== AI PHOTO MODE SELECTOR (Reference / Motiv / Portrait) =====
        let aiSelectedPhotoMode = 'reference';
        const aiPhotoModeSelector = document.getElementById('ai-photo-mode-selector');
        const aiPhotoModeBtns = document.querySelectorAll('.ai-photo-mode-btn');
        const portraitBtn = document.querySelector('.ai-photo-mode-btn[data-mode="portrait"]');

        const updatePortraitAvailability = () => {
            // Portrait is only available with Pixar style (or custom — hidden anyway)
            if (portraitBtn) {
                const isAvailable = aiSelectedStyle === 'pixar';
                portraitBtn.style.display = isAvailable ? '' : 'none';
                // If portrait was selected but Clay is now active, reset to reference
                if (!isAvailable && aiSelectedPhotoMode === 'portrait') {
                    aiSelectedPhotoMode = 'reference';
                }
            }
            updatePhotoModeBtns();
        };

        const updatePhotoModeBtns = () => {
            aiPhotoModeBtns.forEach(btn => {
                if (btn.style.display === 'none') return; // skip hidden portrait
                const isActive = btn.dataset.mode === aiSelectedPhotoMode;
                btn.style.borderColor = isActive ? '#7c3aed' : '#e0e0e0';
                btn.style.background = isActive ? '#f5f3ff' : '#fff';
                const titleDiv = btn.querySelector('div:first-child');
                if (titleDiv) titleDiv.style.color = isActive ? '#7c3aed' : '#64748b';
            });
        };
        aiPhotoModeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                aiSelectedPhotoMode = btn.dataset.mode;
                updatePhotoModeBtns();
            });
        });

        // Show/hide photo-mode selector when photo is added/removed
        const updatePhotoModeVisibility = (hasPhoto) => {
            if (aiPhotoModeSelector) {
                // Hide when custom mode or no photo
                const show = hasPhoto && aiSelectedStyle !== 'custom';
                aiPhotoModeSelector.style.display = show ? 'block' : 'none';
            }
        };

        // Initial portrait availability
        updatePortraitAvailability();

        // ===== PHOTO REFERENCE HANDLERS =====
        const aiReferenceFile = document.getElementById('ai-reference-file');
        const aiPhotoDropzone = document.getElementById('ai-photo-dropzone');
        const aiReferencePreview = document.getElementById('ai-reference-preview');
        const aiReferenceImg = document.getElementById('ai-reference-img');
        const aiRemovePhotoBtn = document.getElementById('ai-remove-photo-btn');
        let aiSelectedPhoto = null; // Store file reference directly (iOS can lose input.files)

        const showPhotoPreview = (file) => {
            if (!file || !aiReferenceImg || !aiReferencePreview || !aiPhotoDropzone) return;
            aiSelectedPhoto = file;
            aiReferenceImg.src = URL.createObjectURL(file);
            aiReferencePreview.style.display = 'block';
            aiPhotoDropzone.style.display = 'none';
            updatePhotoModeVisibility(true);
        };

        // Bridge: allows camera section to inject a captured photo into the AI reference
        _injectPhotoToAiRef = showPhotoPreview;

        const removePhotoPreview = () => {
            aiSelectedPhoto = null;
            if (aiReferenceFile) aiReferenceFile.value = '';
            if (aiReferencePreview) aiReferencePreview.style.display = 'none';
            if (aiPhotoDropzone) aiPhotoDropzone.style.display = 'block';
            updatePhotoModeVisibility(false);
            if (aiReferenceImg) {
                if (aiReferenceImg.src.startsWith('blob:')) URL.revokeObjectURL(aiReferenceImg.src);
                aiReferenceImg.src = '';
            }
        };

        aiPhotoDropzone?.addEventListener('click', () => aiReferenceFile?.click());
        aiReferenceFile?.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file) showPhotoPreview(file);
        });
        aiRemovePhotoBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            removePhotoPreview();
        });

        // Drag & drop on photo dropzone
        aiPhotoDropzone?.addEventListener('dragover', (e) => {
            e.preventDefault();
            aiPhotoDropzone.style.borderColor = '#7c3aed';
            aiPhotoDropzone.style.background = '#f5f3ff';
        });
        aiPhotoDropzone?.addEventListener('dragleave', (e) => {
            e.preventDefault();
            aiPhotoDropzone.style.borderColor = '#d1d5db';
            aiPhotoDropzone.style.background = '#fafafa';
        });
        aiPhotoDropzone?.addEventListener('drop', (e) => {
            e.preventDefault();
            aiPhotoDropzone.style.borderColor = '#d1d5db';
            aiPhotoDropzone.style.background = '#fafafa';
            const file = e.dataTransfer?.files?.[0];
            if (file && file.type.startsWith('image/')) {
                showPhotoPreview(file);
            }
        });

        // ===== AI GENERATE HANDLER =====
        const handleAiGenerate = async () => {
            if (aiIsGenerating) return;
            if (!currentProduct?.id) {
                // Product not yet saved — offer to save first so we can generate an icon
                const nameVal = document.getElementById('product-name-input')?.value?.trim();
                const priceVal = document.getElementById('product-price-input')?.value?.trim();
                if (!nameVal || !priceVal) {
                    showCustomAlert('Manglende felter', 'Udfyld produktnavn og pris før du genererer et ikon.');
                    return;
                }
                const confirmed = await showCustomAlert(
                    'Gem produkt',
                    'Produktet skal gemmes før et AI-ikon kan genereres.',
                    {
                        type: 'confirm',
                        okText: 'Gem og Generer Ikon',
                        cancelText: 'Annuller',
                    }
                );
                if (!confirmed) return;
                // Save product to get an ID for icon generation
                saveBtn.disabled = true;
                saveBtn.textContent = 'Gemmer...';
                try {
                    const formData = await collectFormData();
                    if (!formData) {
                        saveBtn.disabled = false;
                        saveBtn.textContent = 'Gem Produkt';
                        return;
                    }
                    const savedData = await handleAddProduct(formData);
                    if (!savedData) {
                        saveBtn.disabled = false;
                        saveBtn.textContent = 'Gem Produkt';
                        return;
                    }
                    currentProduct = savedData;
                    title.textContent = 'Rediger Produkt';
                } catch (err) {
                    showAlert?.('Fejl ved gemning: ' + (err.message || 'Ukendt fejl'));
                    return;
                } finally {
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Gem Produkt';
                }
            }
            const isCustomMode = aiSelectedStyle === 'custom';
            const name = aiIconInput?.value?.trim();
            const customPrompt = aiCustomPromptInput?.value?.trim();
            const referenceFile = aiSelectedPhoto || aiReferenceFile?.files?.[0] || null;

            if (isCustomMode) {
                if (!customPrompt) {
                    showAlert?.('Skriv en prompt i tekstfeltet');
                    return;
                }
            } else if (!name && !referenceFile) {
                showAlert?.('Skriv et produktnavn eller upload et foto');
                return;
            }

            aiIsGenerating = true;
            aiGenerateBtn.disabled = true;
            aiGenerateBtn.textContent = referenceFile ? '⏳ Analyserer foto...' : '⏳ Genererer...';
            aiIconPreview.innerHTML = `<div style="padding: 30px; text-align: center;"><div style="font-size: 32px; animation: pulse 1.5s infinite;">🪄</div><div style="font-size: 13px; color: #64748b; margin-top: 8px;">${referenceFile ? 'Analyserer foto og genererer ikon...' : 'Genererer ikon...'}</div></div>`;
            aiIconActions.style.display = 'none';
            aiGeneratedUrl = null;

            try {
                const adminUserId = adminProfile?.user_id;
                if (!adminUserId) throw new Error('Admin bruger ID ikke fundet');

                const { data: { session } } = await supabaseClient.auth.getSession();
                const accessToken = session?.access_token || '';

                const supabaseUrl = supabaseClient.supabaseUrl || supabaseClient.rest?.url?.replace('/rest/v1', '') || 'https://jbknjgbpghrbrstqwoxj.supabase.co';

                // Build request — FormData if photo, JSON if text-only
                let body;
                const headers = {
                    'Authorization': `Bearer ${accessToken}`,
                    'x-admin-user-id': adminUserId,
                };

                if (referenceFile) {
                    // Photo-mode: FormData (no Content-Type — browser sets boundary)
                    body = new FormData();
                    body.append('product_id', currentProduct.id);
                    body.append('product_name', name || '');
                    body.append('reference_image', referenceFile);
                    if (isCustomMode) {
                        body.append('prompt_mode', 'custom');
                        body.append('custom_prompt', customPrompt);
                    } else {
                        body.append('style', aiSelectedStyle);
                        body.append('photo_mode', aiSelectedPhotoMode);
                    }
                } else {
                    // Text-mode: JSON (backward compatible)
                    headers['Content-Type'] = 'application/json';
                    if (isCustomMode) {
                        body = JSON.stringify({
                            product_id: currentProduct.id,
                            product_name: name || '',
                            prompt_mode: 'custom',
                            custom_prompt: customPrompt,
                        });
                    } else {
                        body = JSON.stringify({
                            product_name: name,
                            product_id: currentProduct.id,
                            style: aiSelectedStyle,
                            photo_mode: aiSelectedPhotoMode,
                        });
                    }
                }

                const response = await fetch(
                    `${supabaseUrl}/functions/v1/generate-product-icon`,
                    { method: 'POST', headers, body }
                );

                const result = await response.json();
                if (!result.success) throw new Error(result.error || 'Generering fejlede');

                aiGeneratedUrl = result.icon_url;
                currentIconUrl = result.icon_url;
                currentIconUpdatedAt = result.icon_updated_at;

                // Show preview — build mode label
                const timestamp = result.icon_updated_at ? new Date(result.icon_updated_at).getTime() : Date.now();
                let modeLabel;
                if (result.prompt_mode === 'custom') {
                    modeLabel = result.mode?.includes('photo') ? '🎨 Fri prompt + foto' : '🎨 Fri prompt';
                } else if (result.mode === 'photo-portrait') {
                    modeLabel = '🎭 Portræt';
                } else if (result.mode === 'photo-reference') {
                    modeLabel = '📷 Reference';
                } else if (result.mode === 'photo-motiv') {
                    modeLabel = '📷 Motiv';
                } else {
                    modeLabel = '✏️ Tekst';
                }
                const styleLabel = result.prompt_mode === 'custom' ? '' : ` · ${result.style === 'pixar' ? '🎬 Pixar' : '🏺 Clay'}`;
                aiIconPreview.innerHTML = `
                    <div style="padding: 15px; background: #f8f9fa; border-radius: 12px; text-align: center;">
                        <img src="${result.icon_url}?v=${timestamp}" alt="${name || customPrompt}" style="width: 128px; height: 128px; border-radius: 12px; background: #fff; padding: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <div style="font-size: 11px; color: #94a3b8; margin-top: 6px;">${modeLabel}${styleLabel}</div>
                    </div>`;
                aiIconActions.style.display = 'flex';
                updateIconPreview();
                playSound?.('success');

            } catch (err) {
                console.error('[AI Icon] Error:', err);
                aiIconPreview.innerHTML = `<div style="padding: 15px; background: #fef2f2; border-radius: 8px; text-align: center; color: #dc2626; font-size: 13px;">${err.message || 'Generering fejlede'}</div>`;
                playSound?.('error');
            } finally {
                aiIsGenerating = false;
                aiGenerateBtn.disabled = false;
                aiGenerateBtn.textContent = '✨ Generer';
            }
        };

        aiGenerateBtn?.addEventListener('click', handleAiGenerate);
        aiIconRetryBtn?.addEventListener('click', handleAiGenerate);

        aiIconAcceptBtn?.addEventListener('click', () => {
            if (!aiGeneratedUrl) return;
            // Icon is already saved by Edge Function — just update preview and close AI section
            updateIconPreview();
            aiIconActions.style.display = 'none';
            aiIconPreview.innerHTML = '<div style="padding: 10px; text-align: center; color: #22c55e; font-weight: 600;">✅ Ikon gemt!</div>';
            playSound?.('success');
            // Refresh institution icons grid to include the new icon
            loadInstitutionIcons();
        });

        // Initial preview update
        updateIconPreview();
        const bulkDiscountEnabledCheckbox = document.getElementById('product-bulk-discount-enabled');
        const bulkDiscountFields = document.getElementById('bulk-discount-fields');
        const bulkDiscountQtyInput = document.getElementById('product-bulk-discount-qty');
        const bulkDiscountPriceInput = document.getElementById('product-bulk-discount-price');
        const bulkDiscountPreview = document.getElementById('bulk-discount-preview');
        const bulkDiscountWarning = document.getElementById('bulk-discount-warning');
        const priceInput = document.getElementById('product-price-input');
        const refillEnabledCheckbox = document.getElementById('product-refill-enabled');
        const unhealthyCheckbox = document.getElementById('product-unhealthy-enabled');
        const containsPorkCheckbox = document.getElementById('product-contains-pork');
        const isVegetarianCheckbox = document.getElementById('product-is-vegetarian');
        const isDailySpecialCheckbox = document.getElementById('product-is-daily-special');
        const isCoreAssortmentCheckbox = document.getElementById('product-is-core-assortment');
        const refillFields = document.getElementById('refill-fields');
        const refillPriceInput = document.getElementById('product-refill-price-input');
        const refillTimeLimitInput = document.getElementById('product-refill-time-limit-input');
        const refillMaxInput = document.getElementById('product-refill-max-input');

        const parseMoneyToOre = (raw) => {
            if (raw === null || raw === undefined || raw === '') return null;
            const num = Number(String(raw).replace(',', '.'));
            if (!Number.isFinite(num) || num <= 0) return null;
            return Math.round(num * 100);
        };

        const parseBulkQty = (raw) => {
            const num = Number(raw);
            if (!Number.isFinite(num) || !Number.isInteger(num) || num < 2) return null;
            return num;
        };

        const formatOreToDkk = (ore) => {
            const num = Number(ore);
            if (!Number.isFinite(num)) return '';
            return (num / 100).toFixed(2);
        };

        const setBulkPreview = ({ qty, priceOre, unitPriceOre }) => {
            if (!bulkDiscountPreview) return;
            if (!qty || !priceOre) {
                bulkDiscountPreview.textContent = '';
                return;
            }
            const example = `Eksempel: ${qty} for ${formatOreToDkk(priceOre)}`;
            let savings = '';
            if (Number.isFinite(unitPriceOre)) {
                const normalTotal = qty * unitPriceOre;
                const savedOre = normalTotal - priceOre;
                if (savedOre > 0) {
                    savings = ` • Spar ${formatOreToDkk(savedOre)}`;
                }
            }
            bulkDiscountPreview.textContent = `${example}${savings}`;
        };

        const syncBulkDiscountState = () => {
            if (!bulkDiscountEnabledCheckbox) return { valid: true };
            const enabled = bulkDiscountEnabledCheckbox.checked;
            if (bulkDiscountFields) {
                bulkDiscountFields.classList.toggle('hidden', !enabled);
            }
            if (bulkDiscountWarning) {
                bulkDiscountWarning.textContent = '';
            }
            if (!enabled) {
                setBulkPreview({ qty: null, priceOre: null, unitPriceOre: null });
                if (saveBtn) saveBtn.disabled = false;
                return { valid: true, enabled: false };
            }

            const qty = parseBulkQty(bulkDiscountQtyInput?.value);
            const priceOre = parseMoneyToOre(bulkDiscountPriceInput?.value);
            const unitPriceOre = parseMoneyToOre(priceInput?.value);

            if (!qty || !priceOre) {
                if (bulkDiscountWarning) {
                    bulkDiscountWarning.textContent = 'Udfyld både antal og pris (antal min. 2).';
                }
                if (saveBtn) saveBtn.disabled = true;
                setBulkPreview({ qty, priceOre, unitPriceOre });
                return { valid: false, enabled: true };
            }

            if (Number.isFinite(unitPriceOre) && priceOre >= qty * unitPriceOre) {
                if (bulkDiscountWarning) {
                    bulkDiscountWarning.textContent = 'Giver ingen rabat ift. normalpris';
                }
            } else if (bulkDiscountWarning) {
                bulkDiscountWarning.textContent = '';
            }

            if (saveBtn) saveBtn.disabled = false;
            setBulkPreview({ qty, priceOre, unitPriceOre });
            return { valid: true, enabled: true, qty, priceOre };
        };

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
        if (bulkDiscountEnabledCheckbox) {
            syncBulkDiscountState();
            bulkDiscountEnabledCheckbox.addEventListener('change', syncBulkDiscountState);
        }
        [bulkDiscountQtyInput, bulkDiscountPriceInput, priceInput].forEach((el) => {
            if (!el) return;
            el.addEventListener('input', syncBulkDiscountState);
        });
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

        // Shared form data collection — used by both save button and AI-generate flow
        const collectFormData = async () => {
            const name = document.getElementById('product-name-input').value;
            const priceStr = document.getElementById('product-price-input').value;
            const maxPerDayStr = document.getElementById('product-max-per-day-input').value;
            const emoji = document.getElementById('product-emoji-input').value;
            const allergenSelections = Array.from(document.querySelectorAll('.allergen-checkbox'))
                .filter(cb => cb.checked)
                .map(cb => cb.value);
            if (!name || !priceStr) {
                await showCustomAlert('Fejl', 'Udfyld venligst både produktnavn og pris.');
                return null;
            }
            const maxPerDay = maxPerDayStr === '' ? null : Number(maxPerDayStr);
            if (maxPerDay !== null && (!Number.isFinite(maxPerDay) || maxPerDay < 0)) {
                await showCustomAlert('Fejl', 'Købsgrænse skal være et ikke-negativt tal eller tom for ubegrænset.');
                return null;
            }
            const bulkEnabled = !!(bulkDiscountEnabledCheckbox?.checked);
            let bulkDiscountQty = null;
            let bulkDiscountPriceOre = null;
            if (bulkEnabled) {
                bulkDiscountQty = parseBulkQty(bulkDiscountQtyInput?.value);
                bulkDiscountPriceOre = parseMoneyToOre(bulkDiscountPriceInput?.value);
                if (!bulkDiscountQty || !bulkDiscountPriceOre) {
                    console.warn('[bulk-discount] Ugyldig mængderabat-konfiguration', {
                        qty: bulkDiscountQtyInput?.value,
                        price: bulkDiscountPriceInput?.value,
                    });
                    await showCustomAlert('Fejl', 'Udfyld gyldigt antal (min. 2) og pris for mængderabat.');
                    return null;
                }
            }
            const refillEnabled = !!(refillEnabledCheckbox?.checked);
            const unhealthyVal = !!(unhealthyCheckbox?.checked);
            const containsPorkVal = !!(containsPorkCheckbox?.checked);
            const isVegetarianVal = !!(isVegetarianCheckbox?.checked);
            const isDailySpecialVal = !!(isDailySpecialCheckbox?.checked);
            const isCoreAssortmentVal = !!(isCoreAssortmentCheckbox?.checked);
            const parseNumber = (el, fallback = 0) => {
                if (!el) return fallback;
                const num = Number(el.value);
                return Number.isFinite(num) ? num : fallback;
            };
            const refillPrice = parseNumber(refillPriceInput, 0);
            const refillTimeLimitMinutes = parseNumber(refillTimeLimitInput, 0);
            const refillMaxRefills = parseNumber(refillMaxInput, 0);
            return {
                name,
                priceStr,
                emoji,
                maxPerDay,
                allergens: allergenSelections,
                institutionId,
                unhealthy: unhealthyVal,
                containsPork: containsPorkVal,
                isVegetarian: isVegetarianVal,
                isDailySpecial: isDailySpecialVal,
                isCoreAssortment: isCoreAssortmentVal,
                bulkDiscountEnabled: bulkEnabled,
                bulkDiscountQty,
                bulkDiscountPriceOre,
                refillEnabled,
                refillPrice,
                refillTimeLimitMinutes,
                refillMaxRefills,
                restaurantVariants: restaurantVariantsArray.length > 0 ? [...restaurantVariantsArray] : null,
            };
        };

        saveBtn.onclick = async () => {
            // KRITISK: Prevent double-click under async operation
            if (saveBtn.disabled) return;

            const formData = await collectFormData();
            if (!formData) return;

            // Disable og vis loading state
            saveBtn.disabled = true;
            const originalText = saveBtn.textContent;
            saveBtn.textContent = 'Gemmer...';

            try {
                if (currentProduct?.id) {
                    await handleEditProduct(currentProduct.id, formData);
                } else {
                    const savedData = await handleAddProduct(formData);
                    if (savedData) currentProduct = savedData;
                }
                closeEditProductModal();
            } catch (err) {
                console.error('[save product] Error:', err);
                showAlert?.('Fejl ved gemning: ' + (err.message || 'Ukendt fejl'));
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = originalText;
            }
        };
        const closeBtn = modal.querySelector('.close-btn');
        const closeEditProductModal = () => {
            modal.style.display = 'none';
            saveBtn.onclick = null;
            // OPTIMERING: Cleanup event listener for at forhindre memory leaks
            standardIconGrid?.removeEventListener('click', handleStandardIconClick);
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
            isDailySpecial = false,
            isCoreAssortment = false,
            bulkDiscountEnabled = false,
            bulkDiscountQty = null,
            bulkDiscountPriceOre = null,
            refillEnabled = false,
            refillPrice = null,
            refillTimeLimitMinutes = null,
            refillMaxRefills = null,
            restaurantVariants = null,
        } = productData;
        const price = parseFloat(priceStr.replace(",", "."));
        if (isNaN(price)) return showAlert("Ugyldig pris.");
        const products = getProducts();
        const refillEnabledValue = refillEnabled === true;
        const { data, error } = await runWithAuthRetry(
            'addProduct',
            () => supabaseClient.from("products").insert([{
            name,
            price,
            emoji,
            max_per_day: maxPerDay,
            unhealthy,
            contains_pork: containsPork,
            is_vegetarian: isVegetarian,
            is_daily_special: isDailySpecial,
            is_core_assortment: isCoreAssortment,
                bulk_discount_enabled: bulkDiscountEnabled === true,
                bulk_discount_qty: bulkDiscountEnabled ? bulkDiscountQty : null,
                bulk_discount_price_ore: bulkDiscountEnabled ? bulkDiscountPriceOre : null,
            refill_enabled: refillEnabledValue,
            refill_price: refillEnabledValue ? refillPrice : null,
            refill_time_limit_minutes: refillEnabledValue ? refillTimeLimitMinutes : 0,
            refill_max_refills: refillEnabledValue ? refillMaxRefills : 0,
            restaurant_variants: restaurantVariants,
            institution_id: adminProfile.institution_id,
            sort_order: products.length,
            is_visible: true,  // FIX: Sæt is_visible til true som standard, så nye produkter er synlige
            is_enabled: true   // FIX: Sæt is_enabled til true som standard, så nye produkter er aktive
            }]).select().single()
        );
        if (error) return showAlert(`Fejl: ${error.message}`);
        await saveProductAllergens(data.id, allergens);
        if (institutionId) {
            await saveProductLimit(institutionId, data.id, (maxPerDay === null ? null : Math.floor(maxPerDay)));
        }

        // Hook: Hvis vi er i placeholder-flow, erstat placeholder med nyt produkt
        if (typeof window !== 'undefined' && typeof window.__flangoAssignPlaceholderProduct === 'function') {
            try {
                await window.__flangoAssignPlaceholderProduct(data);
            } catch (err) {
                console.warn('[placeholder] Kunne ikke tilknytte nyt produkt til placeholder:', err);
            }
        }

        // REFETCH PATTERN: Hent fresh data fra database for at sikre UI er synkroniseret
        console.log('[handleAddProduct] Refetching products from database...');
        await refetchAllProducts();

        playSound?.('productCreate');
        await fetchAndRenderProducts?.();
        renderProductsInModalFn?.(getProducts(), modalProductList);
        console.log('[handleAddProduct] Product added and UI refreshed');
        return data;
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
            isDailySpecial = false,
            isCoreAssortment = false,
            bulkDiscountEnabled = false,
            bulkDiscountQty = null,
            bulkDiscountPriceOre = null,
            restaurantVariants = null,
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
        const { error } = await runWithAuthRetry(
            'editProduct',
            () => supabaseClient.from("products").update({
            name,
            price,
            emoji,
            max_per_day: maxPerDay,
            unhealthy,
            contains_pork: containsPork,
            is_vegetarian: isVegetarian,
            is_daily_special: isDailySpecial,
            is_core_assortment: isCoreAssortment,
                bulk_discount_enabled: bulkDiscountEnabled === true,
                bulk_discount_qty: bulkDiscountEnabled ? bulkDiscountQty : null,
                bulk_discount_price_ore: bulkDiscountEnabled ? bulkDiscountPriceOre : null,
            refill_enabled: refillEnabledValue,
            refill_price: refillEnabledValue ? refillPrice : null,
            refill_time_limit_minutes: refillEnabledValue ? refillTimeLimitMinutes : 0,
            refill_max_refills: refillEnabledValue ? refillMaxRefills : 0,
            restaurant_variants: restaurantVariants,
            }).eq("id", productId)
        );
        if (error) return showAlert(`Fejl: ${error.message}`);
        Object.assign(product, {
            name,
            price,
            emoji,
            max_per_day: maxPerDay,
            unhealthy,
            contains_pork: containsPork,
            is_vegetarian: isVegetarian,
            is_daily_special: isDailySpecial,
            is_core_assortment: isCoreAssortment,
            bulk_discount_enabled: bulkDiscountEnabled === true,
            bulk_discount_qty: bulkDiscountEnabled ? bulkDiscountQty : null,
            bulk_discount_price_ore: bulkDiscountEnabled ? bulkDiscountPriceOre : null,
            refill_enabled: refillEnabledValue,
            refill_price: refillEnabledValue ? refillPrice : null,
            refill_time_limit_minutes: refillEnabledValue ? refillTimeLimitMinutes : 0,
            refill_max_refills: refillEnabledValue ? refillMaxRefills : 0,
            restaurant_variants: restaurantVariants,
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
        const { error } = await runWithAuthRetry(
            'toggleProductStatus',
            () => supabaseClient
                .from("products")
                .update({ is_enabled: nextEnabled })
                .eq("id", productId)
        );
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
        const { error } = await runWithAuthRetry(
            'deleteProduct',
            () => supabaseClient.from("products").delete().eq("id", productId)
        );
        if (error) return showAlert(`Fejl: ${error.message}`);

        // REFETCH PATTERN: Hent fresh data fra database for at sikre UI er synkroniseret
        console.log('[handleDeleteProduct] Refetching products from database...');
        await refetchAllProducts();

        await fetchAndRenderProducts?.();
        renderProductsInModalFn?.(getProducts(), modalProductList);
        console.log('[handleDeleteProduct] Product deleted and UI refreshed');
    }

    // ===== ICON MANAGEMENT MODAL =====
    const manageIconsBtn = document.getElementById('manage-icons-btn');
    const iconMgmtModal = document.getElementById('icon-management-modal');

    if (manageIconsBtn && iconMgmtModal) {
        const iconMgmtCloseBtn = iconMgmtModal.querySelector('.close-btn');
        const iconMgmtCloseFooter = document.getElementById('icon-mgmt-close-btn');

        const closeIconMgmt = () => { iconMgmtModal.style.display = 'none'; };
        iconMgmtCloseBtn?.addEventListener('click', closeIconMgmt);
        iconMgmtCloseFooter?.addEventListener('click', closeIconMgmt);

        manageIconsBtn.addEventListener('click', async () => {
            iconMgmtModal.style.display = 'flex';
            await loadIconManagementGrid();
        });

        async function loadIconManagementGrid() {
            const counter = document.getElementById('icon-mgmt-counter');
            const uploadedGrid = document.getElementById('icon-mgmt-uploaded-grid');
            const uploadedEmpty = document.getElementById('icon-mgmt-uploaded-empty');
            const aiGrid = document.getElementById('icon-mgmt-ai-grid');
            const aiEmpty = document.getElementById('icon-mgmt-ai-empty');

            if (!uploadedGrid || !aiGrid) return;

            uploadedGrid.innerHTML = '';
            aiGrid.innerHTML = '';

            const institutionId = adminProfile?.institution_id;
            if (!institutionId) return;

            const [icons, settings] = await Promise.all([
                fetchInstitutionIconLibrary(institutionId),
                fetchIconSharingSettings(institutionId),
            ]);

            const iconLimit = settings.icon_limit || 50;
            if (counter) counter.textContent = `${icons.length} / ${iconLimit} ikoner brugt`;

            const uploaded = icons.filter(i => i.source === 'uploaded');
            const aiGenerated = icons.filter(i => i.source !== 'uploaded');

            const renderIconGrid = (iconList, gridEl, emptyEl) => {
                gridEl.innerHTML = '';
                if (iconList.length === 0) {
                    if (emptyEl) emptyEl.style.display = 'block';
                    return;
                }
                if (emptyEl) emptyEl.style.display = 'none';

                iconList.forEach(icon => {
                    const option = document.createElement('div');
                    option.className = 'custom-icon-option';
                    option.style.position = 'relative';
                    option.innerHTML = `
                        <img src="${icon.icon_url}" alt="${icon.name}">
                        <span style="font-size: 11px;">${icon.name}</span>
                        <button type="button" class="icon-mgmt-delete-btn" data-icon-id="${icon.id}" title="Slet ikon"
                            style="position: absolute; top: -4px; right: -4px; width: 20px; height: 20px; border-radius: 50%; background: #ef4444; color: white; border: none; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1; z-index: 5;">✕</button>
                    `;
                    gridEl.appendChild(option);
                });
            };

            renderIconGrid(uploaded, uploadedGrid, uploadedEmpty);
            renderIconGrid(aiGenerated, aiGrid, aiEmpty);

            // Delete handlers (event delegation)
            const handleDelete = async (e) => {
                const btn = e.target.closest('.icon-mgmt-delete-btn');
                if (!btn) return;
                e.stopPropagation();
                const iconId = btn.dataset.iconId;
                if (!iconId) return;

                const confirmed = await showCustomAlert('Slet ikon?', 'Ikonet fjernes fra biblioteket. Produkter der bruger det beholder deres kopi.', 'confirm');
                if (!confirmed) return;

                const result = await deleteInstitutionIcon(iconId);
                if (result.success) {
                    await loadIconManagementGrid();
                } else {
                    showAlert?.(result.error || 'Kunne ikke slette ikonet');
                }
            };

            uploadedGrid.addEventListener('click', handleDelete);
            aiGrid.addEventListener('click', handleDelete);
        }

        // Expose globally so icon sharing settings can open this modal
        window.__flangoLoadIconManagementGrid = loadIconManagementGrid;
    }
}
