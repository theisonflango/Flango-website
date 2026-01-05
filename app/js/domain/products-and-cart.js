// Produkt-helpers: ikon-konstanter og helper-funktioner
import { getChildProductLimitSnapshot, canChildPurchase, invalidateTodaysSalesCache, getRefillEligibility, invalidateLimitsCache } from './purchase-limits.js';
import { getCurrentCustomer } from './cafe-session-store.js';
import { MAX_ITEMS_PER_ORDER } from '../core/constants.js';

export const CUSTOM_ICON_PREFIX = '::icon::';

const SUPABASE_STORAGE_URL = 'https://jbknjgbpghrbrstqwoxj.supabase.co/storage/v1/object/public/product-icons/standard';

export const PRODUCT_ICON_MAP = {
    'toast': `${SUPABASE_STORAGE_URL}/Toast.webp`,
    'pizza': `${SUPABASE_STORAGE_URL}/Pizza.webp`,
    'sushi': `${SUPABASE_STORAGE_URL}/Sushi.webp`,
    'nøddemix': `${SUPABASE_STORAGE_URL}/Noddemix.webp`,
    'frugt': `${SUPABASE_STORAGE_URL}/Frugt.webp`,
    'saft': `${SUPABASE_STORAGE_URL}/Saft.webp`,
    'suppe': `${SUPABASE_STORAGE_URL}/Suppe.webp`
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
    // KRITISK: Fjern evt. eksisterende refill-data fra click-handler
    // så vi altid bruger den aktuelle eligibility-check
    delete productToAdd._isRefill;
    delete productToAdd._effectivePrice;
    delete productToAdd._effectiveName;

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
            } else {
                // KRITISK: Hvis IKKE berettiget til refill, brug original pris/navn
                // (kan ske hvis brugeren har nået max refills)
                productToAdd.name = effectiveData.originalName;
                productToAdd.price = effectiveData.originalPrice;
                console.log('[addProductToOrder] Refill-grænse nået, bruger normal pris:', effectiveData.originalName, effectiveData.originalPrice);
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
    invalidateLimitsCache(); // Also invalidate the limits memory cache
}

// Bruges til at sikre, at kun seneste apply-call opdaterer UI (undgår race på tværs af async fetches).
let latestApplyRequestId = 0;

export async function preloadChildProductLimitSnapshot(childId) {
    return await ensureChildLimitSnapshot(childId);
}

export async function applyProductLimitsToButtons(allProducts, productsContainer, currentOrder = [], childIdOverride = null, sugarData = null) {
    if (!productsContainer) return;
    const requestId = ++latestApplyRequestId;
    const customer = typeof getCurrentCustomer === 'function' ? getCurrentCustomer() : null;
    const childId = childIdOverride || customer?.id || null;
    const institutionId = customer?.institution_id || null;

    if (!childId) {
        // Hvis ingen kunde er valgt, skal alle låse, counters OG refill-styling fjernes.
        productsContainer.querySelectorAll('.product-btn').forEach(btn => {
            btn.classList.remove('product-limit-reached');
            btn.classList.remove('product-refill');
            delete btn.dataset.sugarLocked;
            delete btn.dataset.limitState;
            delete btn.dataset.refillTimerMinutes;
            delete btn.dataset.refillLastPurchase;
            // Skjul limit counter og fjern hover
            const limitCounter = btn.querySelector('.product-limit-counter');
            if (limitCounter) {
                limitCounter.textContent = '';
                limitCounter.style.display = 'none';
                limitCounter.onmouseenter = null;
                limitCounter.onmouseleave = null;
            }
            // Fjern refill timer element
            const refillTimer = btn.querySelector('.refill-timer');
            if (refillTimer) {
                refillTimer.remove();
            }
            // Fjern tooltip
            const tooltip = btn.querySelector('.limit-tooltip');
            if (tooltip) {
                tooltip.remove();
            }
        });
        return;
    }
    // OPTIMERING: Brug cachet snapshot hvis tilgængeligt (ensureChildLimitSnapshot håndterer childId-skift)
    // Dette reducerer redundante DB-kald når vi allerede har hentet snapshot for denne bruger.
    const snapshot = await ensureChildLimitSnapshot(childId, institutionId);
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
        let isAtLimit = snapshotEntry?.is_at_limit ?? computedIsAtLimit;
        let sugarLocked = false;

        // REFILL LIMIT: Tjek om produktet har en refill-grænse der er nået
        let refillUsed = null;
        let refillMax = null;
        let refillLimitReached = false;

        const product = productMap.get(pid);

        // DEBUG: Log refill felter for at forstå hvad vi har
        if (product?.refill_enabled) {
            console.log(`[applyProductLimitsToButtons] Refill product check for ${product.name}:`, {
                refill_enabled: product.refill_enabled,
                refill_max_refills: product.refill_max_refills,
                typeOfMax: typeof product.refill_max_refills,
                condition: product.refill_max_refills > 0,
                childId: !!childId
            });
        }

        if (product?.refill_enabled && product?.refill_max_refills > 0 && childId) {
            try {
                const eligibility = await getRefillEligibility(childId, pid, product, institutionId);

                // KUN vis refill counter hvis kunden er i refill-mode (har lavet første køb)
                // Ellers skal counteren ikke vises da refill ikke er aktiveret endnu
                if (eligibility.purchaseCount > 0) {
                    refillMax = product.refill_max_refills;
                    refillUsed = eligibility.refillsUsed || 0;

                    // Tæl også refills i kurven (ikke kun completed sales)
                    const refillsInCart = (currentOrder || []).reduce((count, item) => {
                        const lineId = item?.product_id || item?.productId || item?.id;
                        if (String(lineId) === pid && item._isRefill === true) {
                            return count + 1;
                        }
                        return count;
                    }, 0);

                    refillUsed = refillUsed + refillsInCart;

                    console.log(`[applyProductLimitsToButtons] Refill status for ${product.name}:`, {
                        refillsFromDB: eligibility.refillsUsed,
                        refillsInCart,
                        totalRefillUsed: refillUsed,
                        refillMax,
                        eligible: eligibility.eligible,
                        purchaseCount: eligibility.purchaseCount
                    });

                    // Hvis barnet har brugt alle refills (fra DB + kurv)
                    if (refillUsed >= refillMax) {
                        refillLimitReached = true;
                        isAtLimit = true;
                        console.log(`[applyProductLimitsToButtons] Refill limit REACHED for ${product.name}: ${refillUsed}/${refillMax}`);
                    }
                } else {
                    console.log(`[applyProductLimitsToButtons] ${product.name}: Ingen køb endnu, refill counter skjules`);
                }
            } catch (err) {
                console.warn('[applyProductLimitsToButtons] Refill check fejl:', err);
            }
        }

        // SUKKERPOLITIK: Tjek om produktet er usundt og låst af forældre-sukkerpolitik
        // Også beregn sugar policy counter data til visning
        let sugarPerProductUsed = null;
        let sugarPerProductMax = null;

        if (sugarData?.policy) {
            const product = productMap.get(pid);
            console.log(`[applyProductLimitsToButtons] Sugar check for ${pid}: product.unhealthy=${product?.unhealthy}, policy=`, sugarData.policy, 'snapshot=', sugarData.snapshot);
            if (product?.unhealthy === true) {
                const { policy, snapshot: sugarSnapshot } = sugarData;

                // KURV-TÆLLING: Tæl usunde produkter i kurven (client-side, ingen API-kald)
                let unhealthyInCartTotal = 0;
                let thisProductInCart = 0;
                for (const line of (currentOrder || [])) {
                    const lineId = line?.product_id || line?.productId || line?.id;
                    if (lineId == null) continue;
                    const lineProduct = productMap.get(String(lineId));
                    if (lineProduct?.unhealthy === true) {
                        const qty = typeof line?.quantity === 'number' && Number.isFinite(line.quantity) ? line.quantity : 1;
                        unhealthyInCartTotal += qty;
                        if (String(lineId) === pid) {
                            thisProductInCart += qty;
                        }
                    }
                }

                // Kombinér allerede-købte (snapshot) + kurv-indhold
                const unhealthyTotal = (sugarSnapshot?.unhealthyTotal ?? 0) + unhealthyInCartTotal;
                const perProduct = (sugarSnapshot?.unhealthyPerProduct?.[pid] ?? 0) + thisProductInCart;

                // Gem sugar policy data til counter visning
                if (policy.maxUnhealthyPerProductPerDay != null && policy.maxUnhealthyPerProductPerDay > 0) {
                    sugarPerProductUsed = perProduct;
                    sugarPerProductMax = policy.maxUnhealthyPerProductPerDay;
                }

                console.log(`[applyProductLimitsToButtons] ${pid} is unhealthy. Purchased: ${sugarSnapshot?.unhealthyTotal ?? 0}, InCart: ${unhealthyInCartTotal}, Total: ${unhealthyTotal}, perProduct: ${perProduct}, maxPerDay: ${policy.maxUnhealthyPerDay}, maxPerProduct: ${policy.maxUnhealthyPerProductPerDay}`);

                if (!isAtLimit) {
                    if (policy.blockUnhealthy === true) {
                        console.log(`[applyProductLimitsToButtons] ${pid} BLOCKED: blockUnhealthy=true`);
                        isAtLimit = true;
                        sugarLocked = true;
                    } else if (policy.maxUnhealthyPerDay != null && policy.maxUnhealthyPerDay > 0 && unhealthyTotal >= policy.maxUnhealthyPerDay) {
                        // Kun blokér hvis grænsen er > 0 (0 eller null = ingen grænse)
                        console.log(`[applyProductLimitsToButtons] ${pid} BLOCKED: ${unhealthyTotal} >= ${policy.maxUnhealthyPerDay}`);
                        isAtLimit = true;
                        sugarLocked = true;
                    } else if (policy.maxUnhealthyPerProductPerDay != null && policy.maxUnhealthyPerProductPerDay > 0 && perProduct >= policy.maxUnhealthyPerProductPerDay) {
                        // Kun blokér hvis grænsen er > 0 (0 eller null = ingen grænse)
                        console.log(`[applyProductLimitsToButtons] ${pid} BLOCKED: perProduct ${perProduct} >= ${policy.maxUnhealthyPerProductPerDay}`);
                        isAtLimit = true;
                        sugarLocked = true;
                    } else {
                        console.log(`[applyProductLimitsToButtons] ${pid} allowed (under limit)`);
                    }
                }
            }
        } else if (!isAtLimit) {
            console.log(`[applyProductLimitsToButtons] ${pid}: No sugar policy or already at limit`);
        }

        // TOOLTIP: Saml alle begrænsninger med kilde-information
        const restrictions = [];

        // 1. Klub-grænse
        const clubMaxPerDay = snapshotEntry?.clubMaxPerDay;
        if (clubMaxPerDay != null) {
            const used = todaysQty + qtyInCart;
            restrictions.push({
                type: 'club',
                icon: '🏢',
                label: 'Klub-grænse',
                message: clubMaxPerDay === 0
                    ? 'Dette produkt er ikke tilgængeligt i klubben'
                    : `<strong>${used}/${clubMaxPerDay}</strong> af dette produkt i dag`,
                isAtLimit: clubMaxPerDay === 0 || used >= clubMaxPerDay
            });
        }

        // 2. Forældre-grænse
        const parentMaxPerDay = snapshotEntry?.parentMaxPerDay;
        if (parentMaxPerDay != null) {
            const used = todaysQty + qtyInCart;
            restrictions.push({
                type: 'parent',
                icon: '👨‍👩‍👧',
                label: 'Forældre-grænse',
                message: parentMaxPerDay === 0
                    ? 'Dine forældre har spærret dette produkt'
                    : `<strong>${used}/${parentMaxPerDay}</strong> af dette produkt i dag`,
                isAtLimit: parentMaxPerDay === 0 || used >= parentMaxPerDay
            });
        }

        // 3. Sukkerpolitik (klub og forælder)
        if (sugarData?.policy && product?.unhealthy === true) {
            const { policy, snapshot: sugarSnapshot, parentPolicy, institutionPolicy } = sugarData;

            // Kurv-tælling for sugar policy
            let unhealthyInCartTotal = 0;
            let thisProductInCart = 0;
            for (const line of (currentOrder || [])) {
                const lineId = line?.product_id || line?.productId || line?.id;
                if (lineId == null) continue;
                const lineProduct = productMap.get(String(lineId));
                if (lineProduct?.unhealthy === true) {
                    const qty = typeof line?.quantity === 'number' && Number.isFinite(line.quantity) ? line.quantity : 1;
                    unhealthyInCartTotal += qty;
                    if (String(lineId) === pid) {
                        thisProductInCart += qty;
                    }
                }
            }
            const unhealthyTotal = (sugarSnapshot?.unhealthyTotal ?? 0) + unhealthyInCartTotal;
            const perProduct = (sugarSnapshot?.unhealthyPerProduct?.[pid] ?? 0) + thisProductInCart;

            // Klub sukkerpolitik (total)
            if (institutionPolicy?.maxUnhealthyPerDay != null && institutionPolicy.maxUnhealthyPerDay > 0) {
                restrictions.push({
                    type: 'sugar',
                    icon: '🍬',
                    label: 'Klub-sukkerpolitik',
                    message: `<strong>${unhealthyTotal}/${institutionPolicy.maxUnhealthyPerDay}</strong> usunde varer i dag (i alt)`,
                    isAtLimit: unhealthyTotal >= institutionPolicy.maxUnhealthyPerDay
                });
            }

            // Klub sukkerpolitik (per produkt)
            if (institutionPolicy?.maxUnhealthyPerProductPerDay != null && institutionPolicy.maxUnhealthyPerProductPerDay > 0) {
                restrictions.push({
                    type: 'sugar',
                    icon: '🍭',
                    label: 'Klub-sukkerpolitik',
                    message: `<strong>${perProduct}/${institutionPolicy.maxUnhealthyPerProductPerDay}</strong> af dette produkt i dag`,
                    isAtLimit: perProduct >= institutionPolicy.maxUnhealthyPerProductPerDay
                });
            }

            // Forælder sukkerpolitik (total)
            if (parentPolicy?.maxUnhealthyPerDay != null && parentPolicy.maxUnhealthyPerDay > 0) {
                restrictions.push({
                    type: 'parent',
                    icon: '🍬',
                    label: 'Forældre-sukkerpolitik',
                    message: `<strong>${unhealthyTotal}/${parentPolicy.maxUnhealthyPerDay}</strong> usunde varer i dag (i alt)`,
                    isAtLimit: unhealthyTotal >= parentPolicy.maxUnhealthyPerDay
                });
            }

            // Forælder sukkerpolitik (per produkt)
            if (parentPolicy?.maxUnhealthyPerProductPerDay != null && parentPolicy.maxUnhealthyPerProductPerDay > 0) {
                restrictions.push({
                    type: 'parent',
                    icon: '🍭',
                    label: 'Forældre-sukkerpolitik',
                    message: `<strong>${perProduct}/${parentPolicy.maxUnhealthyPerProductPerDay}</strong> af dette produkt i dag`,
                    isAtLimit: perProduct >= parentPolicy.maxUnhealthyPerProductPerDay
                });
            }

            // Bloker usunde helt
            if (policy?.blockUnhealthy === true) {
                restrictions.push({
                    type: 'sugar',
                    icon: '🚫',
                    label: 'Sukkerpolitik',
                    message: 'Usunde varer er ikke tilladt',
                    isAtLimit: true
                });
            }
        }

        // 4. Refill-grænse
        if (refillMax != null && refillMax > 0 && snapshotEntry?.todaysQty > 0) {
            restrictions.push({
                type: 'refill',
                icon: '🔄',
                label: 'Refill-grænse',
                message: `<strong>${refillUsed || 0}/${refillMax}</strong> genopfyldninger brugt`,
                isAtLimit: refillLimitReached
            });
        }

        buttonData.push({
            btn,
            pid,
            isAtLimit,
            sugarLocked,
            needsFallbackCheck: !isAtLimit && childId && productMap.has(pid),
            // Data for limit counter display
            todaysQty,
            qtyInCart,
            effectiveMaxPerDay,
            // TOOLTIP: Separate kilder
            clubMaxPerDay,
            parentMaxPerDay,
            // Sugar policy counter data (for unhealthy products)
            sugarPerProductUsed,
            sugarPerProductMax,
            // Refill limit counter data
            refillUsed,
            refillMax,
            refillLimitReached,
            // TOOLTIP: Alle begrænsninger med kilder
            restrictions
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
            // Marker om låsning skyldes sukkerpolitik (til evt. UI feedback)
            if (data.sugarLocked) {
                data.btn.dataset.sugarLocked = 'true';
            } else {
                delete data.btn.dataset.sugarLocked;
            }
        } else {
            data.btn.classList.remove('product-limit-reached');
            data.btn.dataset.limitState = 'ok';
            delete data.btn.dataset.sugarLocked;
        }

        // Opdater limit counter (vises hvis produktet har en købsgrænse, inkl. 0=blokeret)
        // Counter er i HTML-templaten som direkte barn af .product-btn (efter lock-overlay)
        // Styling sættes inline fordi CSS-klasser ikke virkede pålideligt
        const limitCounter = data.btn.querySelector('.product-limit-counter');
        if (limitCounter) {
            const hasRegularLimit = data.effectiveMaxPerDay != null;
            const hasSugarLimit = data.sugarPerProductMax != null;

            // Base styling (inline for at sikre det virker på tværs af alle browsere)
            const baseStyle = 'display:inline-flex;align-items:center;justify-content:center;position:absolute;top:6px;left:50%;transform:translateX(-50%);padding:2px 10px;font-size:12px;font-weight:700;font-family:Poppins,sans-serif;border-radius:12px;pointer-events:none;white-space:nowrap;z-index:50;';
            const normalStyle = 'background:linear-gradient(135deg,#f0f9ff 0%,#e0f2fe 100%);border:1.5px solid #7dd3fc;color:#0369a1;box-shadow:0 2px 6px rgba(14,165,233,0.2);';
            const atLimitStyle = 'background:linear-gradient(135deg,#fef2f2 0%,#fee2e2 100%);border:1.5px solid #f87171;color:#b91c1c;box-shadow:0 2px 6px rgba(239,68,68,0.25);';
            // Sukkerpolitik styling (lilla/pink for at skelne fra almindelig grænse)
            const sugarNormalStyle = 'background:linear-gradient(135deg,#fdf4ff 0%,#fae8ff 100%);border:1.5px solid #e879f9;color:#a21caf;box-shadow:0 2px 6px rgba(192,38,211,0.2);';
            const sugarAtLimitStyle = 'background:linear-gradient(135deg,#fef2f2 0%,#fee2e2 100%);border:1.5px solid #f87171;color:#b91c1c;box-shadow:0 2px 6px rgba(239,68,68,0.25);';
            // Refill styling (grøn/teal for at matche refill-produkt styling)
            const refillNormalStyle = 'background:linear-gradient(135deg,#ecfdf5 0%,#d1fae5 100%);border:1.5px solid #34d399;color:#047857;box-shadow:0 2px 6px rgba(52,211,153,0.2);';
            // Today-only styling (neutral grå - kun info, ingen begrænsning)
            const todayOnlyStyle = 'background:linear-gradient(135deg,#f8fafc 0%,#f1f5f9 100%);border:1.5px solid #cbd5e1;color:#475569;box-shadow:0 2px 6px rgba(100,116,139,0.15);';

            if (hasRegularLimit) {
                // Almindelig købsgrænse har prioritet
                const used = data.todaysQty + data.qtyInCart;
                const maxPerDay = data.effectiveMaxPerDay;

                if (maxPerDay === 0) {
                    // Produktet er helt blokeret af forælder
                    limitCounter.textContent = '🚫';
                    limitCounter.style.cssText = baseStyle + atLimitStyle;
                } else {
                    limitCounter.textContent = `${used}/${maxPerDay}`;
                    if (used >= maxPerDay) {
                        limitCounter.style.cssText = baseStyle + atLimitStyle;
                    } else {
                        limitCounter.style.cssText = baseStyle + normalStyle;
                    }
                }
            } else if (hasSugarLimit) {
                // Sukkerpolitik-grænse (for usunde produkter)
                const used = data.sugarPerProductUsed;
                const maxPerDay = data.sugarPerProductMax;

                limitCounter.textContent = `🍬 ${used}/${maxPerDay}`;
                if (used >= maxPerDay) {
                    limitCounter.style.cssText = baseStyle + sugarAtLimitStyle;
                } else {
                    limitCounter.style.cssText = baseStyle + sugarNormalStyle;
                }
            } else if (data.refillMax != null && data.refillMax > 0) {
                // Refill-grænse (for produkter med refill aktiveret)
                const used = data.refillUsed || 0;
                const maxRefills = data.refillMax;

                limitCounter.textContent = `🔄 ${used}/${maxRefills}`;
                if (data.refillLimitReached) {
                    limitCounter.style.cssText = baseStyle + atLimitStyle;
                } else {
                    limitCounter.style.cssText = baseStyle + refillNormalStyle;
                }
            } else if (data.todaysQty > 0) {
                // TODAY-COUNTER: Ingen grænse, men barnet har købt dette produkt i dag
                // Vis antal købt med neutral styling (grå) for hurtigt overblik
                limitCounter.textContent = `${data.todaysQty}`;
                limitCounter.style.cssText = baseStyle + todayOnlyStyle;
                // Marker som "today-only" så vi kan tilføje simpel tooltip
                data.isTodayOnly = true;
            } else {
                // Ingen grænse OG intet købt i dag - skjul counter
                limitCounter.textContent = '';
                limitCounter.style.display = 'none';
                // Fjern evt. tooltip når counter er skjult (tooltip er på btn, ikke counter)
                const oldTooltip = data.btn.querySelector('.limit-tooltip');
                if (oldTooltip) oldTooltip.remove();
                limitCounter.onmouseenter = null;
                limitCounter.onmouseleave = null;
                continue; // Spring tooltip-generering over når counter er skjult
            }

            // TOOLTIP: Generer og tilføj tooltip hvis der er begrænsninger OG counter er synlig
            // Tooltip er et SEPARAT element på product-btn niveau (ikke inde i counter)
            const existingTooltip = data.btn.querySelector('.limit-tooltip');
            if (existingTooltip) {
                existingTooltip.remove();
            }

            // Bestem om der skal vises tooltip
            const hasRestrictions = data.restrictions && data.restrictions.length > 0;
            const showTooltip = hasRestrictions || data.isTodayOnly;

            if (showTooltip) {
                // Aktiver pointer-events for hover på counter
                limitCounter.style.pointerEvents = 'auto';
                limitCounter.style.cursor = 'help';

                // Farvekoder for kilder
                const sourceColors = {
                    club: '#60a5fa',    // Blå
                    parent: '#a78bfa',  // Lilla
                    sugar: '#f472b6',   // Pink
                    allergy: '#fb923c', // Orange
                    refill: '#34d399',  // Grøn
                    info: '#94a3b8'     // Grå (neutral info)
                };

                // Byg tooltip HTML med inline styles
                let tooltipBlocks;

                if (data.isTodayOnly && !hasRestrictions) {
                    // Simpel "købt i dag" tooltip for produkter uden begrænsninger
                    tooltipBlocks = `
                        <div>
                            <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;display:flex;align-items:center;gap:5px;color:${sourceColors.info};">
                                <span style="font-size:11px;">📊</span>
                                KØBT I DAG
                            </div>
                            <div style="font-size:12px;font-weight:400;color:#f1f5f9;line-height:1.4;"><strong>${data.todaysQty}</strong> stk. købt i dag</div>
                        </div>
                    `;
                } else {
                    // Normale begrænsnings-tooltips
                    tooltipBlocks = data.restrictions.map((r, idx) => {
                        const color = sourceColors[r.type] || '#94a3b8';
                        const isLast = idx === data.restrictions.length - 1;
                        return `
                            <div style="margin-bottom:${isLast ? '0' : '10px'};padding-bottom:${isLast ? '0' : '10px'};border-bottom:${isLast ? 'none' : '1px solid rgba(255,255,255,0.1)'};">
                                <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;display:flex;align-items:center;gap:5px;color:${color};">
                                    <span style="font-size:11px;">${r.icon}</span>
                                    ${r.label.toUpperCase()}
                                </div>
                                <div style="font-size:12px;font-weight:400;color:#f1f5f9;line-height:1.4;">${r.message}</div>
                            </div>
                        `;
                    }).join('');
                }

                // Opret tooltip med ALLE styles inline
                const tooltip = document.createElement('div');
                tooltip.innerHTML = tooltipBlocks;
                // Alle styles inline for at sikre de virker
                tooltip.style.cssText = `
                    display: none;
                    position: absolute;
                    top: 36px;
                    left: 50%;
                    transform: translateX(-50%);
                    min-width: 220px;
                    max-width: 280px;
                    padding: 12px 14px;
                    background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
                    border-radius: 10px;
                    box-shadow: 0 8px 24px rgba(0,0,0,0.25), 0 4px 8px rgba(0,0,0,0.15);
                    z-index: 1000;
                    pointer-events: none;
                    font-family: 'Poppins', sans-serif;
                `;
                data.btn.appendChild(tooltip);

                // Hover event listeners på counter
                limitCounter.onmouseenter = () => {
                    tooltip.style.display = 'block';
                };
                limitCounter.onmouseleave = () => {
                    tooltip.style.display = 'none';
                };
            } else {
                // Ingen begrænsninger - fjern hover
                limitCounter.style.pointerEvents = 'none';
                limitCounter.style.cursor = '';
                limitCounter.onmouseenter = null;
                limitCounter.onmouseleave = null;
            }
        }
    }
}
