// Produkt-helpers: ikon-konstanter og helper-funktioner
import { getChildProductLimitSnapshot, canChildPurchase, invalidateTodaysSalesCache, getRefillEligibility } from './purchase-limits.js';
import { getCurrentCustomer } from './cafe-session-store.js';
import { MAX_ITEMS_PER_ORDER } from '../core/constants.js';

export const CUSTOM_ICON_PREFIX = '::icon::';

export const PRODUCT_ICON_MAP = {
    'toast': 'Icons/webp/Food/Toast.webp',
    'pizza': 'Icons/webp/Food/Pizza.webp',
    'sushi': 'Icons/webp/Food/Sushi.webp',
    'nøddemix': 'Icons/webp/Food/Nøddemix.webp',
    'frugt': 'Icons/webp/Food/Frugt.webp',
    'saft': 'Icons/webp/Food/Saft.webp',
    'suppe': 'Icons/webp/Food/Suppe.webp'
};

export const PRODUCT_ICON_CLASS_MAP = {
    'toast': ' toast-product',
    'pizza': ' pizza-product',
    'sushi': ' sushi-product',
    'nøddemix': ' noddemix-product',
    'frugt': ' frugt-product',
    'saft': ' saft-product',
    'suppe': ' suppe-product'
};

export function getCustomIconPath(value) {
    if (typeof value !== 'string') return null;
    return value.startsWith(CUSTOM_ICON_PREFIX) ? value.slice(CUSTOM_ICON_PREFIX.length) : null;
}

export function getProductIconInfo(product) {
    if (!product) return null;

    // OPTIMERING: Cache icon info på produktobjektet for 30-50ms cumulativ besparelse
    // Invalidér cache hvis icon_url er ændret
    const cacheKey = `${product.icon_url || ''}_${product.icon_updated_at || ''}_${product.emoji || ''}`;
    if (product._iconInfo !== undefined && product._iconInfoCacheKey === cacheKey) {
        return product._iconInfo;
    }

    // PRIORITY 1: Custom uploaded icon (icon_url)
    if (product.icon_url) {
        const timestamp = product.icon_updated_at
            ? new Date(product.icon_updated_at).getTime()
            : Date.now();
        product._iconInfo = {
            path: `${product.icon_url}?v=${timestamp}`,
            alt: product.name || 'Produkt',
            isCustomUploaded: true
        };
        product._iconInfoCacheKey = cacheKey;
        return product._iconInfo;
    }

    // PRIORITY 2: Standard icon via CUSTOM_ICON_PREFIX in emoji field
    const customIcon = getCustomIconPath(product.emoji);
    if (customIcon) {
        product._iconInfo = { path: customIcon, alt: product.name || 'Produkt' };
        product._iconInfoCacheKey = cacheKey;
        return product._iconInfo;
    }

    // PRIORITY 3: Auto-match by product name
    const nameLower = (product.name || '').trim().toLowerCase();
    if (PRODUCT_ICON_MAP[nameLower]) {
        product._iconInfo = { path: PRODUCT_ICON_MAP[nameLower], alt: product.name || 'Produkt', className: PRODUCT_ICON_CLASS_MAP[nameLower] || '' };
        product._iconInfoCacheKey = cacheKey;
        return product._iconInfo;
    }

    product._iconInfo = null;
    product._iconInfoCacheKey = cacheKey;
    return null;
}

/**
 * Beregn den effektive pris og navn for et produkt baseret på refill-berettigelse
 * @param {object} product - Produktdata med refill-felter
 * @param {object} childContext - { childId, institutionId }
 * @returns {Promise<{ price: number, name: string, isRefill: boolean, originalPrice: number, originalName: string }>}
 */
export async function getEffectiveProductForChild(product, childContext = null) {
    if (!product) {
        return {
            price: 0,
            name: 'Ukendt produkt',
            isRefill: false,
            originalPrice: 0,
            originalName: 'Ukendt produkt'
        };
    }

    const originalPrice = product.price || 0;
    const originalName = product.name || 'Produkt';

    // Hvis ingen barn-kontekst eller refill ikke er aktiveret, returner normal pris
    if (!childContext?.childId || !product.refill_enabled) {
        return {
            price: originalPrice,
            name: originalName,
            isRefill: false,
            originalPrice,
            originalName
        };
    }

    // Tjek om barnet er berettiget til refill
    try {
        const eligibility = await getRefillEligibility(
            childContext.childId,
            product.id,
            product,
            childContext.institutionId
        );

        if (eligibility.eligible) {
            // Barnet er berettiget til refill-pris
            const refillPrice = product.refill_price ?? 0; // 0 hvis ikke sat (gratis)
            const refillName = `${originalName} Refill`;

            return {
                price: refillPrice,
                name: refillName,
                isRefill: true,
                originalPrice,
                originalName,
                refillsUsed: eligibility.refillsUsed,
                purchaseCount: eligibility.purchaseCount,
                lastPurchaseTime: eligibility.lastPurchaseTime
            };
        }
    } catch (err) {
        console.warn('[getEffectiveProductForChild] Fejl ved tjek af refill-berettigelse:', err);
    }

    // Fallback: normal pris
    return {
        price: originalPrice,
        name: originalName,
        isRefill: false,
        originalPrice,
        originalName
    };
}

export async function addProductToOrder(order, product, maxItems = MAX_ITEMS_PER_ORDER) {
    if (!Array.isArray(order) || !product) return { success: false, reason: 'invalid' };
    if (order.length >= maxItems) return { success: false, reason: 'limit' };
    const customer = typeof getCurrentCustomer === 'function' ? getCurrentCustomer() : null;
    const childId = customer?.id || null;
    const institutionId = customer?.institution_id || null;
    const pid = product?.id;
    if (childId && pid) {
        await ensureChildLimitSnapshot(childId, institutionId);
        const snapshot = currentChildLimitSnapshot?.byProductId || {};
        const limitInfo = snapshot[String(pid)] || { effectiveMaxPerDay: null, todaysQty: 0 };
        const effectiveMaxPerDay = limitInfo.effectiveMaxPerDay;
        const todaysQty = limitInfo.todaysQty || 0;
        const qtyInCart = order.reduce((sum, line) => {
            const lineId = line?.product_id || line?.productId || line?.id;
            if (String(lineId) === String(pid)) {
                const qty = typeof line?.quantity === 'number' ? line.quantity : 1;
                return sum + (Number.isFinite(qty) ? qty : 1);
            }
            return sum;
        }, 0);
        if (effectiveMaxPerDay !== null && effectiveMaxPerDay !== undefined) {
            if (effectiveMaxPerDay === 0) {
                return { success: false, reason: 'product-limit' };
            }
            if (todaysQty + qtyInCart >= effectiveMaxPerDay) {
                return { success: false, reason: 'product-limit' };
            }
        }
    }

    // REFILL FIX: Hent effektive produkt-data før tilføjelse til kurv
    let productToAdd = { ...product };
    if (childId && pid && product.refill_enabled) {
        try {
            const effectiveData = await getEffectiveProductForChild(product, {
                childId,
                institutionId
            });

            // Tag produktet med effektive værdier så de kan gemmes i databasen
            if (effectiveData.isRefill) {
                productToAdd._effectivePrice = effectiveData.price;
                productToAdd._effectiveName = effectiveData.name;
                productToAdd._isRefill = true;
                // Opdater visningsnavn og pris i kurven
                productToAdd.name = effectiveData.name;
                productToAdd.price = effectiveData.price;
                console.log('[addProductToOrder] Tilføjer refill:', effectiveData.name, effectiveData.price);
            }
        } catch (err) {
            console.warn('[addProductToOrder] Fejl ved hentning af refill-data:', err);
            // Fortsæt med normal pris hvis refill-check fejler
        }
    }

    order.push(productToAdd);
    return { success: true };
}

export function removeProductFromOrder(order, index = order.length - 1) {
    if (!Array.isArray(order) || order.length === 0) return null;
    const targetIndex = typeof index === 'number' ? index : order.length - 1;
    if (targetIndex < 0 || targetIndex >= order.length) return null;
    const [removed] = order.splice(targetIndex, 1);
    return removed ?? null;
}

export function clearOrder(order) {
    if (!Array.isArray(order)) return;
    order.length = 0;
}

export function calculateOrderTotal(order) {
    if (!Array.isArray(order)) return 0;
    return order.reduce((sum, item) => sum + (item?.price || 0), 0);
}

let currentChildLimitSnapshot = null;
let currentChildLimitSnapshotChildId = null;

async function ensureChildLimitSnapshot(childId, institutionId = null) {
    if (!childId) {
        currentChildLimitSnapshot = null;
        currentChildLimitSnapshotChildId = null;
        return null;
    }
    if (currentChildLimitSnapshot && currentChildLimitSnapshotChildId === childId) {
        return currentChildLimitSnapshot;
    }
    try {
        const snapshot = await getChildProductLimitSnapshot(childId, institutionId);
        currentChildLimitSnapshot = snapshot || { byProductId: {} };
        currentChildLimitSnapshotChildId = childId;
        return currentChildLimitSnapshot;
    } catch (err) {
        console.warn('[getChildProductLimitSnapshot] fejl i UI:', err);
        currentChildLimitSnapshot = null;
        currentChildLimitSnapshotChildId = null;
        return null;
    }
}

export function invalidateChildLimitSnapshot() {
    currentChildLimitSnapshot = null;
    currentChildLimitSnapshotChildId = null;
    invalidateTodaysSalesCache(); // Also invalidate the sales cache
}

// Bruges til at sikre, at kun seneste apply-call opdaterer UI (undgår race på tværs af async fetches).
let latestApplyRequestId = 0;

export async function preloadChildProductLimitSnapshot(childId) {
    return await ensureChildLimitSnapshot(childId);
}

export async function applyProductLimitsToButtons(allProducts, productsContainer, currentOrder = [], childIdOverride = null) {
    if (!productsContainer) return;
    const requestId = ++latestApplyRequestId;
    const customer = typeof getCurrentCustomer === 'function' ? getCurrentCustomer() : null;
    const childId = childIdOverride || customer?.id || null;
    const institutionId = customer?.institution_id || null;
    
    if (!childId) {
        // Hvis ingen kunde er valgt, skal alle låse fjernes.
        productsContainer.querySelectorAll('.product-btn').forEach(btn => btn.classList.remove('product-limit-reached'));
        return;
    }
    // VIGTIGT: Tving genhentning af et helt friskt snapshot for den specifikke bruger for at undgå race conditions.
    // Dette sikrer, at vi ikke bruger en forældet cache fra et tidligere brugervalg.
    const snapshot = await getChildProductLimitSnapshot(childId, institutionId);
    // En nyere apply-start betyder, at denne respons er forældet og ikke må overskrive UI.
    if (requestId !== latestApplyRequestId) return;
    const byProductId = snapshot?.byProductId || {};

    const buttons = Array.from(productsContainer.querySelectorAll('button.product-btn'));
    const productMap = new Map(
        (allProducts || []).map(p => [String(p.id), p])
    );

    // OPTIMERING: Først beregn snapshot-status for alle knapper, derefter batch backend fallback checks
    const buttonData = [];

    for (const btn of buttons) {
        if (!btn) continue;
        const pidRaw = btn.dataset.productId;
        const pid = pidRaw != null ? String(pidRaw) : null;
        if (!pid) continue;

        const snapshotEntry =
            byProductId[pid] ??
            byProductId[String(pid)] ??
            byProductId[Number.isFinite(Number(pid)) ? Number(pid) : pid] ??
            null;

        const effectiveMaxPerDay = snapshotEntry?.effectiveMaxPerDay;
        const todaysQty = snapshotEntry?.todaysQty || 0;
        const qtyInCart = (currentOrder || []).reduce((sum, line) => {
            const lineId = line?.product_id || line?.productId || line?.id;
            if (lineId == null) return sum;
            if (String(lineId) === pid) {
                const qty = typeof line?.quantity === 'number' ? line.quantity : 1;
                return sum + (Number.isFinite(qty) ? qty : 1);
            }
            return sum;
        }, 0);

        const computedIsAtLimit = (effectiveMaxPerDay !== null && effectiveMaxPerDay !== undefined)
            ? (effectiveMaxPerDay === 0 || todaysQty + qtyInCart >= effectiveMaxPerDay)
            : false;
        const isAtLimit = snapshotEntry?.is_at_limit ?? computedIsAtLimit;

        buttonData.push({
            btn,
            pid,
            isAtLimit,
            needsFallbackCheck: !isAtLimit && childId && productMap.has(pid)
        });
    }

    // BATCH alle fallback checks parallelt for 60-80% speedup (2s → 400ms)
    const fallbackChecks = buttonData
        .filter(data => data.needsFallbackCheck)
        .map(data => ({
            data,
            promise: (async () => {
                try {
                    const product = productMap.get(data.pid);
                    return await canChildPurchase(product.id, childId, currentOrder, institutionId, product.name);
                } catch (err) {
                    console.warn('[applyProductLimitsToButtons] backend fallback fejl:', err);
                    return null;
                }
            })()
        }));

    const fallbackResults = await Promise.allSettled(fallbackChecks.map(fc => fc.promise));

    // Anvend fallback resultater
    fallbackChecks.forEach((fc, idx) => {
        const result = fallbackResults[idx];
        if (result.status === 'fulfilled' && result.value?.allowed === false) {
            fc.data.isAtLimit = true;
        }
    });

    // Opdater UI for alle knapper
    for (const data of buttonData) {
        if (data.isAtLimit) {
            data.btn.classList.add('product-limit-reached');
            data.btn.dataset.limitState = 'reached';
        } else {
            data.btn.classList.remove('product-limit-reached');
            data.btn.dataset.limitState = 'ok';
        }
    }
}
