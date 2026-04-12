// js/ui/product-management.js
import { getProductIconInfo, PRODUCT_ICON_CLASS_MAP } from '../domain/products-and-cart.js?v=3.0.67';
import { isCurrentUserAdmin } from '../domain/session-store.js?v=3.0.67';
import { getOrder } from '../domain/order-store.js?v=3.0.67';
import { refetchAllProducts } from '../core/data-refetch.js?v=3.0.67';
import { runWithAuthRetry } from '../core/auth-retry.js?v=3.0.67';
import {
    formatIconUpdateTime,
    fetchInstitutionIconLibrary,
    fetchSharedIconLibrary,
    deleteInstitutionIcon,
    renameInstitutionIcon,
    fetchIconSharingSettings,
} from '../core/product-icon-utils.js?v=3.0.67';

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
            : (product.emoji || '🛒');

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
        const { getEffectiveProductForChild } = await import('../domain/products-and-cart.js?v=3.0.67');
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
            const adminPlaceholder = isCurrentUserAdmin();
            productBtn.innerHTML = `
                <div class="product-btn-inner placeholder-inner">
                    <div class="product-info-box">
                    </div>
                    ${adminPlaceholder ? `<div class="placeholder-actions">
                        <button type="button" class="placeholder-action-btn" data-placeholder-action="select" data-placeholder-id="${productBtn.dataset.placeholderId}">Vælg Produkt</button>
                        <button type="button" class="placeholder-action-btn" data-placeholder-action="create" data-placeholder-id="${productBtn.dataset.placeholderId}">Opret Nyt Produkt</button>
                    </div>` : ''}
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
        } else if (product.emoji) {
            visualMarkup = `<div class="product-emoji">${product.emoji}</div>`;
        } else {
            visualMarkup = `<div class="product-title-visual" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:16px;gap:8px;z-index:0;overflow:hidden;"><span style="font-size:clamp(1.4rem,4vw,2.6rem);font-weight:800;line-height:1.1;word-break:break-word;">${displayName}</span><span style="font-size:clamp(1.8rem,5vw,3.5rem);">🛒</span></div>`;
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
        const canEditDetails = isReorderMode && isCurrentUserAdmin();
        const nameMarkup = canEditDetails
            ? `<span class="product-name-wrapper">
                <span class="product-edit-icon">✎</span>
                <span class="product-name product-edit-name" contenteditable="true" data-product-id="${product.id}">${displayName || ''}</span>
               </span>`
            : `<span class="product-name">${displayName}</span>`;
        const priceMarkup = canEditDetails
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
            ${isCurrentUserAdmin() ? `<div class="product-edit-pencil" data-product-id="${product.id}">
                <span>✏️</span>
            </div>` : ''}`;

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
            .select('parent_portal_allergens, parent_portal_vegetarian_only, parent_portal_no_pork, parent_portal_diet, parent_portal_sugar_policy, sugar_policy_enabled, restaurant_mode_enabled')
            .eq('id', institutionId)
            .single();

        const dietEnabled = portalSettings?.parent_portal_diet !== false;
        const showAllergens = portalSettings?.parent_portal_allergens !== false;
        const showVegetarian = dietEnabled && portalSettings?.parent_portal_vegetarian_only !== false;
        const showPork = dietEnabled && portalSettings?.parent_portal_no_pork !== false;
        // Only show "Usund Vare" checkbox if sugar policy is enabled on both institution and portal level
        const showUnhealthy = portalSettings?.sugar_policy_enabled === true || portalSettings?.parent_portal_sugar_policy === true;
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
                <!-- Produktikon -->
                <div style="padding: 12px 0;">
                    <div id="icon-preview-container" style="display: flex; align-items: center; gap: 16px; padding: 14px; background: var(--secondary-bg, #f5f5f5); border-radius: 12px;">
                        <div id="icon-preview" style="width: 64px; height: 64px; flex-shrink: 0; border-radius: 10px; overflow: visible; background: #fff; position: relative; display: ${isEditing && (product.icon_url || product.emoji) ? 'flex' : 'none'}; align-items: center; justify-content: center; border: 2px solid #e0e0e0;">
                            ${isEditing && product.emoji ? `<span style="font-size: 32px;">${product.emoji}</span>` : isEditing && product.icon_url ? `<img src="${product.icon_url}" style="width:100%;height:100%;object-fit:cover;">` : ''}
                            <button type="button" id="icon-remove-btn" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;border:none;background:#ef4444;color:white;font-size:12px;line-height:20px;text-align:center;cursor:pointer;padding:0;z-index:1;" title="Fjern ikon">✕</button>
                        </div>
                        <div style="flex: 1; min-width: 0;">
                            <div style="display: flex; gap: 10px;">
                                <button type="button" id="open-icon-picker-btn" style="flex:1; padding: 14px 20px; background: linear-gradient(135deg, #3b82f6, #2563eb); color: white; border: none; border-radius: 10px; font-weight: 600; font-size: 15px; cursor: pointer; white-space: nowrap;">📁 Vælg ikon</button>
                                <button type="button" id="open-icon-create-btn" style="flex:1; padding: 14px 20px; background: linear-gradient(135deg, #7c3aed, #a78bfa); color: white; border: none; border-radius: 10px; font-weight: 600; font-size: 15px; cursor: pointer; white-space: nowrap;">🪄 Opret ikon</button>
                            </div>
                        </div>
                    </div>
                    <input type="hidden" id="product-emoji-input" value="${isEditing && product.emoji ? product.emoji : ''}">
                </div>
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
                `;
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
        // ===== ICON SECTION SETUP (via product-icon-picker) =====
        const emojiInput = document.getElementById('product-emoji-input');
        const iconPreview = document.getElementById('icon-preview');
        const iconRemoveBtn = document.getElementById('icon-remove-btn');

        // Track current state
        let selectedStandardIcon = existingCustomIcon;
        let currentIconUrl = isEditing ? product?.icon_url : null;
        let currentIconStoragePath = isEditing ? product?.icon_storage_path : null;
        let currentIconUpdatedAt = isEditing ? product?.icon_updated_at : null;

        // Update icon preview
        const updateIconPreview = () => {
            let iconSrc = null;

            if (currentIconUrl) {
                const timestamp = currentIconUpdatedAt ? new Date(currentIconUpdatedAt).getTime() : Date.now();
                iconSrc = `${currentIconUrl}?v=${timestamp}`;
            } else if (selectedStandardIcon) {
                iconSrc = selectedStandardIcon;
            } else if (emojiInput?.value && !emojiInput.value.startsWith(CUSTOM_ICON_PREFIX)) {
                iconPreview.style.display = 'flex';
                iconPreview.innerHTML = `<span style="font-size: 40px;">${emojiInput.value}</span><button type="button" id="icon-remove-btn" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;border:none;background:#ef4444;color:white;font-size:12px;line-height:20px;text-align:center;cursor:pointer;padding:0;z-index:1;" title="Fjern ikon">✕</button>`;
                bindIconRemoveBtn();
                return;
            }

            if (iconSrc) {
                iconPreview.style.display = 'flex';
                iconPreview.innerHTML = `<img src="${iconSrc}" alt="Produkt ikon" style="width: 100%; height: 100%; object-fit: contain;"><button type="button" id="icon-remove-btn" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;border:none;background:#ef4444;color:white;font-size:12px;line-height:20px;text-align:center;cursor:pointer;padding:0;z-index:1;" title="Fjern ikon">✕</button>`;
                bindIconRemoveBtn();
            } else {
                iconPreview.style.display = 'none';
                iconPreview.innerHTML = '';
            }
        };

        // Remove icon handler
        const removeIcon = () => {
            currentIconUrl = null;
            currentIconStoragePath = null;
            currentIconUpdatedAt = null;
            selectedStandardIcon = null;
            if (emojiInput) emojiInput.value = '';
            updateIconPreview();
        };

        const bindIconRemoveBtn = () => {
            const btn = document.getElementById('icon-remove-btn');
            btn?.addEventListener('click', (e) => { e.stopPropagation(); removeIcon(); });
        };

        // Bind initial remove button (if icon exists on load)
        bindIconRemoveBtn();

        // ===== "Vælg ikon" button → opens product-icon-picker modal =====
        const openIconPickerBtn = document.getElementById('open-icon-picker-btn');
        openIconPickerBtn?.addEventListener('click', async () => {
            const { openProductIconPicker } = await import('./product-icon-picker.js?v=3.0.67');
            openProductIconPicker({
                mode: 'product',
                institutionId,
                productId: currentProduct?.id,
                productName: document.getElementById('product-name-input')?.value?.trim() || product?.name || '',
                currentIcon: currentIconUrl ? { url: currentIconUrl, storagePath: currentIconStoragePath } : null,
                adminProfile,
                showCustomAlert,
                playSound,
                onResult: (result) => {
                    if (result.type === 'emoji') {
                        if (emojiInput) emojiInput.value = result.emoji;
                        selectedStandardIcon = null;
                        currentIconUrl = null;
                        currentIconUpdatedAt = null;
                    } else if (result.type === 'standard' || result.type === 'icon') {
                        if (emojiInput) emojiInput.value = result.emoji || '';
                        selectedStandardIcon = result.url;
                        currentIconUrl = null;
                        currentIconUpdatedAt = null;
                    } else if (result.type === 'upload' || result.type === 'ai') {
                        currentIconUrl = result.url;
                        currentIconStoragePath = result.storagePath || null;
                        currentIconUpdatedAt = result.updatedAt || null;
                        selectedStandardIcon = null;
                    }
                    updateIconPreview();
                },
            });
        });

        // "Opret ikon" button → opens picker directly on AI tab
        const openIconCreateBtn = document.getElementById('open-icon-create-btn');
        openIconCreateBtn?.addEventListener('click', async () => {
            const { openProductIconPicker } = await import('./product-icon-picker.js?v=3.0.67');
            openProductIconPicker({
                mode: 'product',
                institutionId,
                productId: currentProduct?.id,
                productName: document.getElementById('product-name-input')?.value?.trim() || product?.name || '',
                currentIcon: currentIconUrl ? { url: currentIconUrl, storagePath: currentIconStoragePath } : null,
                adminProfile,
                showCustomAlert,
                playSound,
                defaultSource: 'ai',
                onResult: (result) => {
                    if (result.type === 'emoji') {
                        if (emojiInput) emojiInput.value = result.emoji;
                        selectedStandardIcon = null;
                        currentIconUrl = null;
                        currentIconUpdatedAt = null;
                    } else if (result.type === 'standard' || result.type === 'icon') {
                        if (emojiInput) emojiInput.value = result.emoji || '';
                        selectedStandardIcon = result.url;
                        currentIconUrl = null;
                        currentIconUpdatedAt = null;
                    } else if (result.type === 'upload' || result.type === 'ai') {
                        currentIconUrl = result.url;
                        currentIconStoragePath = result.storagePath || null;
                        currentIconUpdatedAt = result.updatedAt || null;
                        selectedStandardIcon = null;
                    }
                    updateIconPreview();
                },
            });
        });

        // Initial icon preview
        updateIconPreview();


        // ===== BULK DISCOUNT, REFILL, etc. =====
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

        // Tilbage-knap: luk redigér-modal og åbn produktoversigt igen
        const backBtn = document.getElementById('product-form-back-btn');
        if (backBtn) {
            backBtn.onclick = () => {
                modal.style.display = 'none';
                const sugarModal = document.getElementById('sugar-policy-modal');
                if (sugarModal) {
                    sugarModal.style.display = 'flex';
                    // Re-render tabellen for at vise evt. ændringer
                    if (typeof renderProductRulesTable === 'function') renderProductRulesTable();
                    else if (typeof window.__flangoRenderProductRulesTable === 'function') window.__flangoRenderProductRulesTable();
                }
            };
        }

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
                iconUrl: currentIconUrl,
                iconUpdatedAt: currentIconUpdatedAt,
                iconStoragePath: currentIconStoragePath,
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
            iconUrl = undefined,
            iconUpdatedAt = undefined,
            iconStoragePath = undefined,
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
            icon_url: iconUrl || null,
            icon_storage_path: iconStoragePath || null,
            icon_updated_at: iconUrl ? iconUpdatedAt : null,
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
            icon_url: iconUrl || null,
            icon_storage_path: iconStoragePath || null,
            icon_updated_at: iconUrl ? iconUpdatedAt : null,
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

        // Opryd produktikon fra Storage (fire-and-forget)
        if (product.icon_storage_path) {
            supabaseClient.storage.from('product-icons').remove([product.icon_storage_path])
                .then(({ error: storageErr }) => {
                    if (storageErr) console.warn('[handleDeleteProduct] Icon storage cleanup failed:', storageErr.message);
                    else console.log('[handleDeleteProduct] Product icon cleaned from Storage:', product.icon_storage_path);
                });
        }

        // REFETCH PATTERN: Hent fresh data fra database for at sikre UI er synkroniseret
        console.log('[handleDeleteProduct] Refetching products from database...');
        await refetchAllProducts();

        await fetchAndRenderProducts?.();
        renderProductsInModalFn?.(getProducts(), modalProductList);
        console.log('[handleDeleteProduct] Product deleted and UI refreshed');
    }

    // ===== ICON MANAGEMENT MODAL (v2 — search, filter, preview, create, edit) =====
    const manageIconsBtn = document.getElementById('manage-icons-btn');
    const iconMgmtModal = document.getElementById('icon-management-modal');

    if (manageIconsBtn && iconMgmtModal) {
        const iconMgmtCloseBtn = iconMgmtModal.querySelector('.close-btn');
        const iconMgmtCloseFooter = document.getElementById('icon-mgmt-close-btn');
        const iconMgmtGrid = document.getElementById('icon-mgmt-grid');
        const iconMgmtEmpty = document.getElementById('icon-mgmt-empty');
        const iconMgmtCounter = document.getElementById('icon-mgmt-counter');
        const iconMgmtSearch = document.getElementById('icon-mgmt-search');
        const iconMgmtFilters = document.getElementById('icon-mgmt-filters');
        const iconMgmtEditBtn = document.getElementById('icon-mgmt-edit-btn');
        const iconMgmtCreateBtn = document.getElementById('icon-mgmt-create-btn');

        let allIcons = [];           // combined from all sources
        let allInstitutionIcons = []; // just institution's own
        let allProducts_cached = null;
        let iconLimit = 50;
        let activeCategory = 'all';   // 'all', 'institution', 'standard', 'emoji', 'shared'
        let activeFilter = 'all';
        let searchQuery = '';
        let editModeActive = false;
        let searchDebounceTimer = null;
        let listViewActive = false;
        // Open icon create modal via product-icon-picker
        const openIconCreateModal = async (existingIcon) => {
            const { openProductIconPicker } = await import('./product-icon-picker.js?v=3.0.67');
            openProductIconPicker({
                mode: existingIcon ? 'library' : 'product',
                defaultSource: existingIcon ? undefined : 'ai',
                institutionId: adminProfile?.institution_id,
                productName: existingIcon?.name || '',
                editingIcon: existingIcon || undefined,
                adminProfile,
                showCustomAlert,
                playSound,
                onResult: () => {
                    // Reload icon grid after creating/editing
                    loadIconManagementGrid();
                },
            });
        };

        let _iconMgmtReturnTo = null; // tracks where to go back to

        const closeIconMgmt = () => {
            iconMgmtModal.style.display = 'none';
            editModeActive = false;
            iconMgmtGrid?.classList.remove('edit-mode');
            iconMgmtEditBtn?.classList.remove('active');
        };
        iconMgmtCloseBtn?.addEventListener('click', () => { _iconMgmtReturnTo = null; closeIconMgmt(); });
        iconMgmtCloseFooter?.addEventListener('click', () => { _iconMgmtReturnTo = null; closeIconMgmt(); });
        document.getElementById('icon-mgmt-back-btn')?.addEventListener('click', () => {
            const returnFn = _iconMgmtReturnTo;
            _iconMgmtReturnTo = null;
            closeIconMgmt();
            if (typeof returnFn === 'function') returnFn();
        });

        const openIconLibrary = async (returnTo) => {
            _iconMgmtReturnTo = typeof returnTo === 'function' ? returnTo : null;
            iconMgmtModal.style.display = 'flex';
            searchQuery = '';
            activeFilter = 'all';
            if (iconMgmtSearch) iconMgmtSearch.value = '';
            // Reset filter chips
            iconMgmtFilters?.querySelectorAll('.icon-mgmt-chip').forEach(c => {
                c.classList.toggle('active', c.dataset.filter === 'all');
            });
            await loadIconManagementGrid();
        };
        manageIconsBtn.addEventListener('click', () => openIconLibrary(null));
        window.__flangoOpenIconLibrary = openIconLibrary;

        // --- Search ---
        iconMgmtSearch?.addEventListener('input', () => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                searchQuery = iconMgmtSearch.value.trim().toLowerCase();
                renderFilteredIcons();
            }, 300);
        });

        // --- Category filter ---
        const iconMgmtCategories = document.getElementById('icon-mgmt-categories');
        iconMgmtCategories?.addEventListener('click', (e) => {
            const chip = e.target.closest('.icon-mgmt-cat-chip');
            if (!chip) return;
            activeCategory = chip.dataset.category;
            iconMgmtCategories.querySelectorAll('.icon-mgmt-cat-chip').forEach(c => c.classList.toggle('active', c.dataset.category === activeCategory));
            renderFilteredIcons();
        });

        // --- Type filter chips ---
        iconMgmtFilters?.addEventListener('click', (e) => {
            const chip = e.target.closest('.icon-mgmt-chip');
            if (!chip) return;
            const filter = chip.dataset.filter;
            if (filter === 'all') {
                activeFilter = 'all';
                iconMgmtFilters.querySelectorAll('.icon-mgmt-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
            } else {
                // Toggle this chip
                const allChip = iconMgmtFilters.querySelector('[data-filter="all"]');
                if (chip.classList.contains('active')) {
                    chip.classList.remove('active');
                    // If no chips active, revert to "all"
                    const anyActive = iconMgmtFilters.querySelector('.icon-mgmt-chip.active:not([data-filter="all"])');
                    if (!anyActive) {
                        activeFilter = 'all';
                        allChip?.classList.add('active');
                    } else {
                        activeFilter = getActiveFilters();
                    }
                } else {
                    chip.classList.add('active');
                    allChip?.classList.remove('active');
                    activeFilter = getActiveFilters();
                }
            }
            renderFilteredIcons();
        });

        function getActiveFilters() {
            const chips = iconMgmtFilters?.querySelectorAll('.icon-mgmt-chip.active:not([data-filter="all"])') || [];
            return Array.from(chips).map(c => c.dataset.filter);
        }

        function filterIcons(icons) {
            let filtered = icons;

            // Category filter
            if (activeCategory !== 'all') {
                filtered = filtered.filter(i => i._category === activeCategory);
            }

            // Search filter (also search tags)
            if (searchQuery) {
                filtered = filtered.filter(i =>
                    i.name.toLowerCase().includes(searchQuery) ||
                    (i.tags || '').toLowerCase().includes(searchQuery) ||
                    (i._emoji || '').includes(searchQuery)
                );
            }

            // Chip filters
            if (activeFilter !== 'all' && Array.isArray(activeFilter) && activeFilter.length > 0) {
                filtered = filtered.filter(icon => {
                    return activeFilter.some(f => {
                        const [type, val] = f.split(':');
                        if (type === 'source') return icon.source === val;
                        if (type === 'style') return icon.ai_style === val;
                        if (type === 'mode') return icon.ai_photo_mode === val;
                        if (type === 'prompt') return icon.ai_prompt_mode === val;
                        return false;
                    });
                });
            }

            return filtered;
        }

        function getIconMetaLabel(icon) {
            const parts = [];
            if (icon.source === 'uploaded') parts.push('📤 Upload');
            else parts.push('🪄 AI');
            if (icon.ai_style) parts.push(icon.ai_style === 'clay' ? 'Clay' : icon.ai_style === 'pixar' ? 'Pixar' : 'Fri prompt');
            if (icon.ai_photo_mode) {
                const modeMap = { reference: 'Reference', motiv: 'Motiv', avatar: 'Avatar', portrait: 'Mad Portræt' };
                parts.push(modeMap[icon.ai_photo_mode] || icon.ai_photo_mode);
            }
            return parts.join(' · ');
        }

        function renderFilteredIcons() {
            if (!iconMgmtGrid) return;
            const filtered = filterIcons(allIcons);

            iconMgmtGrid.innerHTML = '';
            if (iconMgmtCounter) iconMgmtCounter.textContent = `${filtered.length} ikoner · ${allInstitutionIcons.length} / ${iconLimit} egne`;

            if (filtered.length === 0) {
                if (iconMgmtEmpty) { iconMgmtEmpty.style.display = 'block'; iconMgmtEmpty.textContent = searchQuery ? 'Ingen ikoner matcher søgningen.' : 'Ingen ikoner fundet.'; }
                return;
            }
            if (iconMgmtEmpty) iconMgmtEmpty.style.display = 'none';

            if (listViewActive) {
                iconMgmtGrid.classList.remove('icon-mgmt-grid');
                renderIconListView(filtered);
                return;
            }

            iconMgmtGrid.classList.add('icon-mgmt-grid');
            iconMgmtGrid.classList.remove('icon-mgmt-list');
            const isEdit = editModeActive;

            filtered.forEach(icon => {
                const card = document.createElement('div');
                card.className = 'icon-mgmt-card';
                card.dataset.iconId = icon.id;
                card.style.cssText = 'position:relative;display:flex;flex-direction:column;align-items:center;padding:12px 8px 8px;border:2px solid rgba(255,255,255,0.08);border-radius:12px;background:rgba(255,255,255,0.04);cursor:default;overflow:visible;min-width:0;transition:border-color 0.15s,transform 0.15s;';

                const isReadonly = icon._readonly;
                const badgeMap = { uploaded: { bg: '#dbeafe', color: '#1d4ed8', label: '📤' }, ai_generated: { bg: '#ede9fe', color: '#6d28d9', label: '🪄' }, standard: { bg: '#d1fae5', color: '#065f46', label: '📁' }, emoji: { bg: '#fef3c7', color: '#92400e', label: '😀' } };
                const badge = badgeMap[icon.source] || badgeMap.uploaded;
                const catLabel = icon._categoryLabel || '';

                const imgHtml = icon._emoji
                    ? `<span style="font-size:48px;line-height:1;">${icon._emoji}</span>`
                    : `<img src="${icon.icon_url}" alt="${icon.name}" loading="lazy" style="width:80px;height:80px;object-fit:cover;border-radius:10px;flex-shrink:0;">`;

                card.innerHTML = `
                    <span style="position:absolute;top:4px;left:4px;font-size:10px;padding:1px 5px;border-radius:8px;font-weight:600;line-height:1.4;background:${badge.bg};color:${badge.color};">${badge.label}</span>
                    ${!isReadonly ? `<button type="button" class="icon-mgmt-preview-btn" title="Forstør"
                        style="position:absolute;top:4px;right:4px;width:24px;height:24px;border-radius:50%;background:rgba(255,255,255,0.15);border:none;cursor:pointer;font-size:13px;display:${isEdit ? 'none' : 'flex'};align-items:center;justify-content:center;opacity:0;transition:opacity 0.15s;z-index:5;">🔍</button>` : ''}
                    ${!isReadonly ? `<button type="button" class="icon-mgmt-download-btn" data-url="${icon.icon_url}" data-name="${icon.name}" title="Download"
                        style="position:absolute;bottom:4px;left:4px;width:24px;height:24px;border-radius:50%;background:rgba(255,255,255,0.15);border:none;cursor:pointer;font-size:13px;display:${isEdit ? 'none' : 'flex'};align-items:center;justify-content:center;opacity:0;transition:opacity 0.15s;z-index:5;">⬇️</button>` : ''}
                    ${!isReadonly && isEdit ? `<button type="button" class="icon-mgmt-delete-btn" data-icon-id="${icon.id}" title="Slet ikon"
                        style="position:absolute;top:-1px;right:-1px;width:24px;height:24px;border-radius:50%;background:#ef4444;color:white;border:2px solid rgba(0,0,0,0.2);font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;z-index:10;box-shadow:0 1px 3px rgba(0,0,0,0.3);">✕</button>` : ''}
                    ${!isReadonly && isEdit ? `<button type="button" class="icon-mgmt-settings-btn" data-icon-id="${icon.id}" title="Redigér med AI"
                        style="position:absolute;bottom:2px;right:2px;width:24px;height:24px;border-radius:50%;background:#475569;color:white;border:2px solid rgba(0,0,0,0.2);font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;z-index:10;box-shadow:0 1px 3px rgba(0,0,0,0.3);">⚙️</button>` : ''}
                    ${imgHtml}
                    <span class="icon-mgmt-card-name" style="font-size:11px;color:#94a3b8;margin-top:6px;text-align:center;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:${isEdit && !isReadonly ? 'none' : 'block'};">${icon.name}${catLabel ? `<br><small style="color:#64748b">${catLabel}</small>` : ''}</span>
                    ${!isReadonly ? `<input type="text" class="icon-mgmt-rename-input" value="${icon.name}" data-icon-id="${icon.id}" maxlength="60"
                        style="width:100%;padding:3px 4px;border:1px solid rgba(255,255,255,0.15);border-radius:4px;font-size:11px;text-align:center;margin-top:4px;box-sizing:border-box;background:rgba(255,255,255,0.06);color:inherit;display:${isEdit ? 'block' : 'none'};">` : ''}
                `;
                // Hover effect for preview btn
                card.addEventListener('mouseenter', () => {
                    card.style.borderColor = 'rgba(255,255,255,0.2)';
                    card.style.transform = 'translateY(-1px)';
                    if (!editModeActive) {
                        const previewBtn = card.querySelector('.icon-mgmt-preview-btn');
                        const dlBtn = card.querySelector('.icon-mgmt-download-btn');
                        if (previewBtn) previewBtn.style.opacity = '1';
                        if (dlBtn) dlBtn.style.opacity = '1';
                    }
                });
                card.addEventListener('mouseleave', () => {
                    card.style.borderColor = 'rgba(255,255,255,0.08)';
                    card.style.transform = '';
                    const previewBtn = card.querySelector('.icon-mgmt-preview-btn');
                    const dlBtn = card.querySelector('.icon-mgmt-download-btn');
                    if (previewBtn) previewBtn.style.opacity = '0';
                    if (dlBtn) dlBtn.style.opacity = '0';
                });
                iconMgmtGrid.appendChild(card);
            });

            // Maintain edit-mode class
            if (editModeActive) iconMgmtGrid.classList.add('edit-mode');
            else iconMgmtGrid.classList.remove('edit-mode');
        }

        let listSortCol = null; // 'name', 'type', 'tags', 'product'
        let listSortDir = 'asc';

        function renderTagPills(tagsStr) {
            if (!tagsStr) return '';
            return tagsStr.split(',').map(t => t.trim()).filter(Boolean)
                .map(t => `<span class="icon-tag-pill">${t}<button type="button" class="icon-tag-remove" data-tag="${t}">✕</button></span>`)
                .join('');
        }

        async function saveIconTags(iconId, tagsStr) {
            const icon = allIcons.find(i => i.id === iconId);
            if (!icon || icon._readonly) return;
            icon.tags = tagsStr;
            await supabaseClient.from('institution_icons').update({ tags: tagsStr }).eq('id', iconId);
        }

        function getIconTags(iconId) {
            const icon = allIcons.find(i => i.id === iconId);
            return (icon?.tags || '').split(',').map(t => t.trim()).filter(Boolean);
        }

        function renderIconListView(filtered) {
            iconMgmtGrid.classList.remove('icon-mgmt-grid');
            iconMgmtGrid.classList.add('icon-mgmt-list');

            // Sort
            if (listSortCol) {
                filtered = [...filtered].sort((a, b) => {
                    let va, vb;
                    if (listSortCol === 'name') { va = a.name.toLowerCase(); vb = b.name.toLowerCase(); }
                    else if (listSortCol === 'type') { va = getIconMetaLabel(a); vb = getIconMetaLabel(b); }
                    else if (listSortCol === 'tags') { va = (a.tags || '').toLowerCase(); vb = (b.tags || '').toLowerCase(); }
                    else if (listSortCol === 'product') {
                        va = getProductsUsingIcon(a).map(p => p.name).join(',');
                        vb = getProductsUsingIcon(b).map(p => p.name).join(',');
                    }
                    if (va < vb) return listSortDir === 'asc' ? -1 : 1;
                    if (va > vb) return listSortDir === 'asc' ? 1 : -1;
                    return 0;
                });
            }

            const sortClass = (col) => listSortCol === col ? (listSortDir === 'asc' ? 'sorted-asc' : 'sorted-desc') : '';

            const table = document.createElement('table');
            table.className = 'icon-list-table';
            table.innerHTML = `
                <thead>
                    <tr>
                        <th style="width:60px;cursor:default">Ikon</th>
                        <th data-sort="name" class="${sortClass('name')}">Navn</th>
                        <th data-sort="type" class="${sortClass('type')}">Type</th>
                        <th data-sort="tags" class="${sortClass('tags')}">Tags</th>
                        <th data-sort="product" class="${sortClass('product')}">Produkt</th>
                        <th style="width:50px;cursor:default">Download</th>
                        <th style="width:50px;cursor:default">Slet</th>
                    </tr>
                </thead>
                <tbody></tbody>
            `;

            const tbody = table.querySelector('tbody');

            filtered.forEach(icon => {
                const products = getProductsUsingIcon(icon);
                const productNames = products.map(p => p.name).join(', ') || '—';
                const typeLabel = getIconMetaLabel(icon);
                const tagsValue = icon.tags || '';
                const isReadonly = icon._readonly;

                const imgCell = icon._emoji
                    ? `<span style="font-size:32px">${icon._emoji}</span>`
                    : `<img src="${icon.icon_url}" alt="${icon.name}" style="width:44px;height:44px;object-fit:cover;border-radius:8px;">`;

                const tr = document.createElement('tr');
                tr.dataset.iconId = icon.id;
                tr.innerHTML = `
                    <td>${imgCell}</td>
                    <td>${isReadonly
                        ? `<span style="font-weight:600;font-size:13px">${icon.name}</span>`
                        : `<input type="text" class="icon-list-editable" data-field="name" data-icon-id="${icon.id}" value="${icon.name}" maxlength="60">`}</td>
                    <td style="font-size:12px;color:#94a3b8">${typeLabel}</td>
                    <td>${isReadonly
                        ? '<span style="color:#64748b;font-size:12px">—</span>'
                        : `<div class="icon-tags-cell" data-icon-id="${icon.id}">${renderTagPills(tagsValue)}<input type="text" class="icon-tag-input" placeholder="+ tag" data-icon-id="${icon.id}"></div>`}</td>
                    <td style="font-size:12px;color:${products.length ? '#22c55e' : '#64748b'}">${productNames}</td>
                    <td>${icon.icon_url ? `<button type="button" class="icon-mgmt-download-btn" data-url="${icon.icon_url}" data-name="${icon.name}" title="Download">⬇️</button>` : ''}</td>
                    <td>${!isReadonly ? `<button type="button" class="icon-list-delete-btn" data-icon-id="${icon.id}" title="Slet ikon">🗑️</button>` : ''}</td>
                `;
                tbody.appendChild(tr);
            });

            iconMgmtGrid.appendChild(table);

            // Sort click on headers
            table.querySelectorAll('th[data-sort]').forEach(th => {
                th.addEventListener('click', () => {
                    const col = th.dataset.sort;
                    if (listSortCol === col) {
                        listSortDir = listSortDir === 'asc' ? 'desc' : 'asc';
                    } else {
                        listSortCol = col;
                        listSortDir = 'asc';
                    }
                    renderFilteredIcons();
                });
            });

            // Inline edit — name and tags
            // Use input event to track changes, save on blur
            const pendingEdits = new Map();

            table.addEventListener('input', (e) => {
                const input = e.target.closest('.icon-list-editable');
                if (!input) return;
                pendingEdits.set(input, { iconId: input.dataset.iconId, field: input.dataset.field, value: input.value.trim() });
            });

            table.addEventListener('focusout', async (e) => {
                const input = e.target.closest('.icon-list-editable');
                if (!input || !pendingEdits.has(input)) return;
                const { iconId, field, value } = pendingEdits.get(input);
                pendingEdits.delete(input);
                if (!iconId || !value) return;

                const icon = allIcons.find(i => i.id === iconId);
                if (!icon || icon._readonly) return;

                console.log(`[icon-list] Saving ${field}="${value}" for icon ${iconId}`);

                if (field === 'name' && value !== icon.name) {
                    icon.name = value;
                    await renameInstitutionIcon(iconId, value);
                }
            });

            table.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.target.classList.contains('icon-list-editable')) {
                    e.preventDefault();
                    e.target.blur();
                }
                // Tag input: Enter or comma adds tag
                const tagInput = e.target.closest('.icon-tag-input');
                if (tagInput && (e.key === 'Enter' || e.key === ',')) {
                    e.preventDefault();
                    const newTag = tagInput.value.replace(/,/g, '').trim();
                    if (!newTag) return;
                    const iconId = tagInput.dataset.iconId;
                    const tags = getIconTags(iconId);
                    if (!tags.includes(newTag)) {
                        tags.push(newTag);
                        const tagsStr = tags.join(', ');
                        saveIconTags(iconId, tagsStr);
                        // Re-render pills
                        const cell = tagInput.closest('.icon-tags-cell');
                        if (cell) {
                            tagInput.value = '';
                            // Remove old pills, keep input
                            cell.querySelectorAll('.icon-tag-pill').forEach(p => p.remove());
                            tagInput.insertAdjacentHTML('beforebegin', renderTagPills(tagsStr));
                        }
                    } else {
                        tagInput.value = '';
                    }
                }
            });

            // Remove tag pill
            table.addEventListener('click', (e) => {
                const removeBtn = e.target.closest('.icon-tag-remove');
                if (!removeBtn) return;
                const pill = removeBtn.closest('.icon-tag-pill');
                const cell = removeBtn.closest('.icon-tags-cell');
                if (!pill || !cell) return;
                const iconId = cell.dataset.iconId;
                const tagToRemove = removeBtn.dataset.tag;
                const tags = getIconTags(iconId).filter(t => t !== tagToRemove);
                const tagsStr = tags.join(', ');
                saveIconTags(iconId, tagsStr);
                pill.remove();
            });

            // Edit & Delete buttons
            table.addEventListener('click', async (e) => {
                const editBtn = e.target.closest('.icon-list-edit-btn');
                if (editBtn) {
                    const icon = allIcons.find(i => i.id === editBtn.dataset.iconId);
                    if (icon) openIconCreateModal(icon);
                    return;
                }
                const deleteBtn = e.target.closest('.icon-list-delete-btn');
                if (deleteBtn) {
                    const iconId = deleteBtn.dataset.iconId;
                    const confirmed = await showCustomAlert('Slet ikon?', 'Ikonet fjernes fra biblioteket. Produkter der bruger det beholder deres kopi.', 'confirm');
                    if (!confirmed) return;
                    const result = await deleteInstitutionIcon(iconId);
                    if (result.success) {
                        allIcons = allIcons.filter(i => i.id !== iconId);
                        renderFilteredIcons();
                    } else {
                        showAlert?.(result.error || 'Kunne ikke slette ikonet');
                    }
                    return;
                }
            });
        }

        async function loadIconManagementGrid() {
            const institutionId = adminProfile?.institution_id;
            if (!institutionId) return;

            if (iconMgmtGrid) iconMgmtGrid.innerHTML = '<div style="text-align:center;padding:20px;color:#94a3b8;">Indlæser...</div>';

            const instName = localStorage.getItem('flango_institution_name') || 'Klubben';

            const [icons, settings, products, sharedIcons] = await Promise.all([
                fetchInstitutionIconLibrary(institutionId),
                fetchIconSharingSettings(institutionId),
                supabaseClient.from('products').select('id, name, icon_url, icon_storage_path, emoji').eq('institution_id', institutionId).then(r => r.data || []),
                fetchSharedIconLibrary(institutionId).catch(() => []),
            ]);

            allInstitutionIcons = icons;
            allProducts_cached = products;
            iconLimit = settings.icon_limit || 50;

            // Build combined list with _category marker
            allIcons = [];

            // Institution's own
            icons.forEach(ic => allIcons.push({ ...ic, _category: 'institution', _categoryLabel: instName }));

            // Standard Flango icons
            const { STANDARD_ICONS } = await import('../core/product-icon-utils.js?v=3.0.67');
            STANDARD_ICONS.forEach(ic => allIcons.push({
                id: 'std_' + ic.label,
                name: ic.label,
                icon_url: ic.path,
                source: 'standard',
                tags: '',
                _category: 'standard',
                _categoryLabel: 'Standard',
                _readonly: true,
            }));

            // Emojis
            const EMOJIS = [
                { emoji: '🍫', name: 'Chokolade' }, { emoji: '🍽️', name: 'Tallerken' }, { emoji: '🍷', name: 'Glas' },
                { emoji: '🍎', name: 'Æble' }, { emoji: '🥜', name: 'Nødder' }, { emoji: '🥪', name: 'Sandwich' },
                { emoji: '🍕', name: 'Pizza' }, { emoji: '🥤', name: 'Sodavand' }, { emoji: '🍚', name: 'Ris' },
                { emoji: '🍣', name: 'Sushi' }, { emoji: '🥢', name: 'Spisepinde' }, { emoji: '🍞', name: 'Brød' },
                { emoji: '🥝', name: 'Kiwi' }, { emoji: '🍇', name: 'Vindruer' }, { emoji: '🍐', name: 'Pære' },
                { emoji: '🍉', name: 'Vandmelon' }, { emoji: '🍙', name: 'Risbolle' }, { emoji: '🍲', name: 'Gryde' },
                { emoji: '🥘', name: 'Pande' }, { emoji: '🫘', name: 'Bønner' }, { emoji: '🍔', name: 'Burger' },
                { emoji: '🌶️', name: 'Chili' }, { emoji: '🧄', name: 'Hvidløg' }, { emoji: '🍳', name: 'Stegepande' },
                { emoji: '🔥', name: 'Ild' }, { emoji: '😋', name: 'Lækkert' }, { emoji: '🍰', name: 'Kage' },
                { emoji: '♨️', name: 'Varmt' }, { emoji: '🍪', name: 'Småkage' },
            ];
            EMOJIS.forEach(e => allIcons.push({
                id: 'emoji_' + e.emoji,
                name: e.name,
                icon_url: null,
                _emoji: e.emoji,
                source: 'emoji',
                tags: '',
                _category: 'emoji',
                _categoryLabel: 'Emoji',
                _readonly: true,
            }));

            // Shared
            if (settings.icon_use_shared_enabled && sharedIcons.length) {
                sharedIcons.forEach(ic => allIcons.push({ ...ic, _category: 'shared', _categoryLabel: 'Delt', _readonly: true }));
            }

            renderFilteredIcons();
        }

        // --- Event delegation on grid ---
        iconMgmtGrid?.addEventListener('click', async (e) => {
            // Delete
            const deleteBtn = e.target.closest('.icon-mgmt-delete-btn');
            if (deleteBtn) {
                e.stopPropagation();
                const iconId = deleteBtn.dataset.iconId;
                if (!iconId) return;
                const confirmed = await showCustomAlert('Slet ikon?', 'Ikonet fjernes fra biblioteket. Produkter der bruger det beholder deres kopi.', 'confirm');
                if (!confirmed) return;
                const result = await deleteInstitutionIcon(iconId);
                if (result.success) {
                    allIcons = allIcons.filter(i => i.id !== iconId);
                    renderFilteredIcons();
                } else {
                    showAlert?.(result.error || 'Kunne ikke slette ikonet');
                }
                return;
            }

            // Settings (open in create modal with icon as reference)
            const settingsBtn = e.target.closest('.icon-mgmt-settings-btn');
            if (settingsBtn) {
                e.stopPropagation();
                const iconId = settingsBtn.dataset.iconId;
                const icon = allIcons.find(i => i.id === iconId);
                if (icon) openIconCreateModal(icon);
                return;
            }

            // Preview (lightbox)
            const previewBtn = e.target.closest('.icon-mgmt-preview-btn');
            if (previewBtn) {
                e.stopPropagation();
                const card = previewBtn.closest('.icon-mgmt-card');
                const iconId = card?.dataset.iconId;
                const filtered = filterIcons(allIcons);
                const index = filtered.findIndex(i => i.id === iconId);
                if (index >= 0) showIconPreviewModal(filtered, index);
                return;
            }

            // Download
            const downloadBtn = e.target.closest('.icon-mgmt-download-btn');
            if (downloadBtn) {
                e.stopPropagation();
                const url = downloadBtn.dataset.url;
                const name = downloadBtn.dataset.name || 'ikon';
                if (url) {
                    fetch(url)
                        .then(r => r.blob())
                        .then(blob => {
                            const a = document.createElement('a');
                            a.href = URL.createObjectURL(blob);
                            a.download = `${name.replace(/[^a-zA-Z0-9æøåÆØÅ _-]/g, '')}.webp`;
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            URL.revokeObjectURL(a.href);
                        })
                        .catch(err => console.error('[downloadIcon]', err));
                }
                return;
            }
        });

        // --- Rename (blur/enter on input) ---
        let gridRenamePending = null;
        iconMgmtGrid?.addEventListener('input', (e) => {
            const input = e.target.closest('.icon-mgmt-rename-input');
            if (input) gridRenamePending = { iconId: input.dataset.iconId, value: input.value.trim() };
        });
        iconMgmtGrid?.addEventListener('focusout', async (e) => {
            const input = e.target.closest('.icon-mgmt-rename-input');
            if (!input || !gridRenamePending) return;
            const { iconId, value } = gridRenamePending;
            gridRenamePending = null;
            if (!iconId || !value) return;
            const icon = allIcons.find(i => i.id === iconId);
            if (icon && !icon._readonly && icon.name !== value) {
                icon.name = value;
                console.log(`[icon-grid] Saving name="${value}" for icon ${iconId}`);
                await renameInstitutionIcon(iconId, value);
            }
        });

        iconMgmtGrid?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.classList.contains('icon-mgmt-rename-input')) {
                e.target.blur();
            }
        });

        // --- Edit mode toggle ---
        iconMgmtEditBtn?.addEventListener('click', () => {
            editModeActive = !editModeActive;
            iconMgmtEditBtn.classList.toggle('active', editModeActive);
            iconMgmtEditBtn.textContent = editModeActive ? '✅ Færdig' : '✏️ Redigér';
            renderFilteredIcons();
        });

        // --- View toggle (grid / list) ---
        const viewToggleBtn = document.getElementById('icon-mgmt-view-toggle');
        viewToggleBtn?.addEventListener('click', () => {
            listViewActive = !listViewActive;
            viewToggleBtn.textContent = listViewActive ? '▦ Grid' : '☰ Liste';
            renderFilteredIcons();
        });

        // --- Get products using each icon (for list view) ---
        function getProductsUsingIcon(icon) {
            if (!allProducts_cached) return [];
            return allProducts_cached.filter(p => {
                if (p.icon_url && p.icon_url === icon.icon_url) return true;
                if (p.icon_storage_path && icon.storage_path && p.icon_storage_path === icon.storage_path) return true;
                return false;
            });
        }

        // --- Lightbox preview ---
        function showIconPreviewModal(icons, startIndex = 0) {
            const modal = document.createElement('div');
            modal.style.cssText = 'position:fixed;inset:0;z-index:10001;display:flex;align-items:center;justify-content:center;';
            modal.innerHTML = `
                <div style="position:absolute;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);" data-backdrop></div>
                <div style="position:relative;max-width:80vw;max-height:80vh;">
                    <button data-nav="prev" style="position:absolute;left:-60px;top:50%;transform:translateY(-50%);width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,0.15);border:none;color:#fff;font-size:28px;cursor:pointer;display:flex;align-items:center;justify-content:center;">‹</button>
                    <img data-img style="width:100%;height:100%;max-width:80vw;max-height:80vh;object-fit:contain;border-radius:16px;">
                    <button data-nav="next" style="position:absolute;right:-60px;top:50%;transform:translateY(-50%);width:50px;height:50px;border-radius:50%;background:rgba(255,255,255,0.15);border:none;color:#fff;font-size:28px;cursor:pointer;display:flex;align-items:center;justify-content:center;">›</button>
                    <button data-close style="position:absolute;top:-15px;right:-15px;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.2);border:none;color:#fff;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;">×</button>
                    <div style="position:absolute;bottom:-44px;left:50%;transform:translateX(-50%);text-align:center;color:#fff;white-space:nowrap;">
                        <div data-name style="font-size:16px;font-weight:700;"></div>
                        <div data-meta style="font-size:12px;opacity:0.7;margin-top:2px;"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            const imgEl = modal.querySelector('[data-img]');
            const nameEl = modal.querySelector('[data-name]');
            const metaEl = modal.querySelector('[data-meta]');
            let currentIndex = ((startIndex % icons.length) + icons.length) % icons.length;

            const updateImage = () => {
                const icon = icons[currentIndex];
                imgEl.src = icon.icon_url;
                nameEl.textContent = icon.name;
                metaEl.textContent = getIconMetaLabel(icon);
            };

            const navigate = (dir) => {
                currentIndex = (currentIndex + dir + icons.length) % icons.length;
                updateImage();
            };

            const closeModal = () => {
                document.removeEventListener('keydown', handleKeydown);
                modal.remove();
            };

            const handleKeydown = (evt) => {
                if (evt.key === 'ArrowRight') navigate(1);
                else if (evt.key === 'ArrowLeft') navigate(-1);
                else if (evt.key === 'Escape') closeModal();
            };

            modal.querySelector('[data-nav="prev"]').onclick = (evt) => { evt.stopPropagation(); navigate(-1); };
            modal.querySelector('[data-nav="next"]').onclick = (evt) => { evt.stopPropagation(); navigate(1); };
            modal.querySelector('[data-close]').onclick = closeModal;
            modal.querySelector('[data-backdrop]').onclick = closeModal;

            document.addEventListener('keydown', handleKeydown);
            updateImage();
            modal.style.display = 'flex';
        }

        // ===== ICON CREATE — now uses product-icon-picker.js =====
        {
            // "+ Opret" button in icon management modal
            iconMgmtCreateBtn?.addEventListener('click', () => openIconCreateModal(null));
        }

        // Expose globally
        window.__flangoLoadIconManagementGrid = loadIconManagementGrid;
    }
}
