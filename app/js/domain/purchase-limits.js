import { supabaseClient } from '../core/config-and-supabase.js';
import { CACHE_TTL_MS } from '../core/constants.js';

const LIMITS_DEBUG = false;

// Cache for getTodaysSalesForChild to avoid duplicate queries
const todaysSalesCache = new Map();
let cacheTimestamp = 0;

function getCacheKey(childId, institutionId) {
    return `${childId}:${institutionId || 'null'}`;
}

export function invalidateTodaysSalesCache() {
    todaysSalesCache.clear();
    cacheTimestamp = Date.now();
    if (LIMITS_DEBUG) console.log('[limits] Cache invalidated');
}

const safeNumber = (value, fallback = 0) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
};

// Brug lokal kalenderdag (ikke UTC) så grænser følger caféens tidszone.
function buildTodayRangeLocal() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // lokal 00:00
    const end = new Date(start);
    end.setDate(end.getDate() + 1); // næste lokale dag 00:00
    return { startIso: start.toISOString(), endIso: end.toISOString() };
}

async function getProductById(productId) {
    const { data, error } = await supabaseClient
        .from('products')
        .select('id, name, price, max_per_day, unhealthy, is_enabled')
        .eq('id', productId)
        .single();
    if (error) {
        if (LIMITS_DEBUG) console.warn('[canChildPurchase] Produkt slået op med fejl:', error?.message);
        return { product: null, error };
    }
    return { product: data, error: null };
}

async function getParentLimit(childId, productId) {
    const { data, error } = await supabaseClient
        .from('parent_limits')
        .select('id, parent_id, child_id, product_id, max_per_day')
        .eq('child_id', childId)
        .eq('product_id', productId)
        .maybeSingle();
    if (error) {
        if (LIMITS_DEBUG) console.warn('[canChildPurchase] Forældrebegrænsning lookup fejlede:', error?.message);
        return { parentLimit: null, error };
    }
    return { parentLimit: data, error: null };
}

async function getChildProfile(childId) {
    const { data, error } = await supabaseClient
        .from('users')
        .select('id, daily_spend_limit, institution_id')
        .eq('id', childId)
        .single();
    if (error) {
        if (LIMITS_DEBUG) console.warn('[canChildPurchase] Bruger slået op med fejl:', error?.message);
        return { child: null, error };
    }
    return { child: data, error: null };
}

async function getTodaysSalesForChild(childId, institutionIdOverride = null) {
    // Check cache expiration and invalidate if needed
    const now = Date.now();
    if (now - cacheTimestamp > CACHE_TTL_MS) {
        invalidateTodaysSalesCache();
    }

    // Resolve institutionId
    let institutionId = institutionIdOverride;
    if (!institutionId) {
        const { child } = await getChildProfile(childId);
        institutionId = child?.institution_id || null;
    }

    // Check cache
    const cacheKey = getCacheKey(childId, institutionId);
    if (todaysSalesCache.has(cacheKey)) {
        if (LIMITS_DEBUG) console.log('[limits] CACHE HIT for getTodaysSalesForChild', { childId, institutionId });
        return todaysSalesCache.get(cacheKey);
    }

    // Cache miss - fetch from database
    if (LIMITS_DEBUG) console.log('[limits] CACHE MISS - fetching getTodaysSalesForChild', { childId, institutionId });

    const { startIso, endIso } = buildTodayRangeLocal();

    // KRITISK: Hent fra sales + sale_items for at få is_refill data
    let query = supabaseClient
        .from('sales')
        .select(`
            id,
            created_at,
            customer_id,
            institution_id,
            sale_items (
                product_id,
                quantity,
                price_at_purchase,
                is_refill,
                product_name_at_purchase
            )
        `)
        .eq('customer_id', childId)
        .gte('created_at', startIso)
        .lt('created_at', endIso);

    if (institutionId) {
        query = query.eq('institution_id', institutionId);
    }

    const { data, error } = await query;
    if (error) {
        if (LIMITS_DEBUG) console.warn('[canChildPurchase] Fejl ved hentning af dagens køb:', error?.message);
        return { rows: [], error };
    }

    // Transform data til samme format som events_view for bagud-kompatibilitet
    const rows = Array.isArray(data) ? data.map(sale => ({
        event_type: 'SALE',
        created_at: sale.created_at,
        target_user_id: sale.customer_id,
        institution_id: sale.institution_id,
        // Map sale_items til items format med is_refill
        items: (sale.sale_items || []).map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
            price: item.price_at_purchase,
            is_refill: item.is_refill || false,
            product_name: item.product_name_at_purchase
        })),
        details: {
            items: (sale.sale_items || []).map(item => ({
                product_id: item.product_id,
                quantity: item.quantity,
                price: item.price_at_purchase,
                is_refill: item.is_refill || false,
                product_name: item.product_name_at_purchase
            }))
        }
    })) : [];

    // Store in cache
    const result = { rows, error: null };
    todaysSalesCache.set(cacheKey, result);
    if (LIMITS_DEBUG) console.log('[limits] Stored in cache - getTodaysSalesForChild result', { childId, institutionId, rowCount: rows.length });

    return result;
}

function extractProductId(item) {
    return item?.product_id ?? item?.productId ?? item?.id ?? null;
}

function extractQuantity(item) {
    return safeNumber(item?.quantity, 1);
}

function extractPrice(item) {
    return safeNumber(item?.price, 0);
}

function extractProductName(item) {
    return item?.product_name ?? item?.name ?? null;
}

function normalizeItems(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;

    if (typeof raw === 'object') {
        if (Array.isArray(raw.items)) return raw.items;
        const values = Object.values(raw);
        if (values.length && values.every(v => typeof v === 'object')) return values;
    }

    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return normalizeItems(parsed);
        } catch {
            return [];
        }
    }

    return [];
}

async function getTodaysQuantityForProduct(childId, productId, institutionId = null, productName = null) {
    const { rows, error } = await getTodaysSalesForChild(childId, institutionId);
    if (error) return 0;

    // OPTIMERING: Flatten nested loops med flatMap for bedre performance
    const allItems = rows.flatMap(row => normalizeItems(row?.items ?? row?.details));

    let total = 0;
    allItems.forEach((item) => {
        const rawId = extractProductId(item);
        const pid = rawId != null ? String(rawId) : null;
        const name = extractProductName(item);

        const matchesById =
            pid &&
            pid !== 'null' &&
            pid !== 'undefined' &&
            String(productId) &&
            pid === String(productId);

        const matchesByName =
            !matchesById &&
            productName &&
            name &&
            name === productName;

        if (matchesById || matchesByName) {
            total += extractQuantity(item);
        }
    });
    if (LIMITS_DEBUG) console.log('[limits] getTodaysQuantityForProduct', { childId, productId, productName, todaysQty: total });
    return total;
}

/**
 * Hent dagens køb af "usunde" varer via sugar-policy funktionen.
 * Returnerer en liste over produkt-ids, der allerede er købt i dag.
 */
export async function getUnhealthyPurchasesSnapshot(childId) {
    if (!childId) return { boughtUnhealthyProductIds: [] };
    try {
        const { data, error } = await supabaseClient.functions.invoke('check-sugar-policy', {
            body: { user_id: childId },
        });
        if (error) {
            if (LIMITS_DEBUG) console.warn('[getUnhealthyPurchasesSnapshot] Fejl fra sugar-policy:', error?.message);
            return { boughtUnhealthyProductIds: [] };
        }
        return { boughtUnhealthyProductIds: data?.boughtUnhealthyProductIds || [] };
    } catch (err) {
        if (LIMITS_DEBUG) console.warn('[getUnhealthyPurchasesSnapshot] Uventet fejl:', err);
        return { boughtUnhealthyProductIds: [] };
    }
}

async function getTodaysTotalSpend(childId, institutionId = null) {
    const { rows, error } = await getTodaysSalesForChild(childId, institutionId);
    if (error) return 0;

    // OPTIMERING: Brug reduce i stedet for forEach + accumulator
    const total = rows.reduce((sum, row) => {
        const details = row?.details ?? {};

        // Primært: brug total_amount fra details, hvis det findes
        if (typeof details.total_amount === 'number') {
            return sum + details.total_amount;
        }

        // Fallback: summér pris * antal fra items
        const items = normalizeItems(row?.items ?? row?.details);
        const rowTotal = items.reduce((itemSum, item) => {
            return itemSum + (extractPrice(item) * extractQuantity(item));
        }, 0);

        return sum + rowTotal;
    }, 0);

    if (LIMITS_DEBUG) {
        console.log('[limits] getTodaysTotalSpend', {
            childId,
            institutionId,
            rows: rows.length,
            total,
        });
    }

    return total;
}

async function getProductLimit(institutionId, productId) {
    if (!institutionId || !productId) return null;
    try {
        const { data, error } = await supabaseClient
            .from('product_limits')
            .select('max_per_day')
            .eq('institution_id', institutionId)
            .eq('product_id', productId)
            .maybeSingle();
        if (error) {
            if (LIMITS_DEBUG) console.warn('[limits] lookup fejl:', error?.message);
            return null;
        }
        const val = data?.max_per_day;
        return Number.isFinite(val) && val > 0 ? val : null;
    } catch (err) {
        if (LIMITS_DEBUG) console.warn('[limits] lookup uventet fejl:', err);
        return null;
    }
}

/**
 * Tjek om et barn må købe et givent produkt ud fra institution- og forældrebegrænsninger.
 * @param {string} productId
 * @param {string} childId
 * @param {Array} [orderItems] - nuværende kurv
 * @param {string} institutionId
 * @param {string} [productNameFallback]
 * @param {boolean} [isFinalCheck=false] - true når vi checker hele ordren ved checkout (undgå dobbelt-tælling)
 * @returns {Promise<{ allowed: boolean, message: string | null, reason?: string }>}
 */
export async function canChildPurchase(productId, childId, orderItems = [], institutionId = null, productNameFallback = null, isFinalCheck = false) {
    if (!productId || !childId) {
        return { allowed: false, message: 'Produkt eller bruger mangler.' };
    }
    if (!institutionId) {
        if (LIMITS_DEBUG) console.warn('[limits] mangler institutionId – fail-open');
        return { allowed: true, message: null };
    }

    const qtyInCart = orderItems.reduce((sum, item) => {
        return String(extractProductId(item)) === String(productId) ? sum + extractQuantity(item) : sum;
    }, 0);
    const qtyInCartEffective = isFinalCheck ? 0 : qtyInCart;

    // 1) Slå produktet op
    const { product, error: productError } = await getProductById(productId);
    if (productError || !product) {
        return { allowed: false, message: 'Produktet findes ikke.' };
    }
    if (product.is_enabled === false) {
        return { allowed: false, message: 'Produktet er ikke aktivt i øjeblikket.' };
    }

    const productName = product?.name || productNameFallback || 'produktet';

    // 2-3) Standard klub-grænse + evt. forældre override
    const clubMax = await getProductLimit(institutionId, productId); // null = ubegrænset
    if (LIMITS_DEBUG) console.log('[limits] club limit lookup', { institutionId, productId, clubMax });
    const { parentLimit } = await getParentLimit(childId, productId);
    const parentMax = parentLimit?.max_per_day ?? null;
    if (parentLimit) {
        if (LIMITS_DEBUG) console.log('[limits] parent limit found', parentLimit);
    }

    // parent_limits overstyrer klub-grænsen hvis sat (inkl. 0 = blokeret).
    const effectiveMaxPerDay = parentMax ?? clubMax; // kommentaren markerer tydeligt, hvor override sker

    // 4) Tæl dagens køb af produktet
    const todaysQty = await getTodaysQuantityForProduct(childId, productId, institutionId, productName);
    if (LIMITS_DEBUG) console.log('[limits] todays qty + cart', { todaysQty, qtyInCart: qtyInCartEffective, effectiveMaxPerDay, isFinalCheck });

    // 5) Antals-regel
    if (effectiveMaxPerDay !== null && effectiveMaxPerDay !== undefined) {
        if (effectiveMaxPerDay === 0) {
            return { allowed: false, message: 'Denne vare er spærret for dig – det er en aftale med dine forældre.' };
        }
        if (todaysQty + qtyInCartEffective >= effectiveMaxPerDay) {
            if (parentLimit) {
                return { allowed: false, message: 'Du har nået grænsen for, hvor mange du må købe af denne vare i dag. Det er aftalt med dine forældre.' };
            }
            return {
                allowed: false,
                message: `I dag må man højst købe ${effectiveMaxPerDay} stk. af ${productName}. Barnet har allerede nået grænsen.`,
            };
        }
    }

    // 6) Dagligt beløb (daily_spend_limit)
    const { child } = await getChildProfile(childId);
    const dailyBudget = child?.daily_spend_limit ?? null;
    if (dailyBudget !== null && dailyBudget !== undefined) {
        const todaysTotalSpend = await getTodaysTotalSpend(childId, institutionId);
        const price = safeNumber(product.price, 0);
        if (LIMITS_DEBUG) {
            console.log('[limits] daily budget check', {
                childId,
                dailyBudget,
                todaysTotalSpend,
                price,
                combined: todaysTotalSpend + price,
            });
        }
        // Dagligt beløb tjek
        if (todaysTotalSpend + price > safeNumber(dailyBudget, 0)) {
            return { allowed: false, message: 'Du har nået dit daglige max-beløb i caféen. Tal med en voksen, hvis der er noget, du er i tvivl om.' };
        }
    }

    // 7) OK
    return { allowed: true, message: null };
}

// canChildPurchase er klar til at blive brugt i evaluatePurchase

/**
 * Tjek om et barn er berettiget til refill-pris for et produkt
 * @param {string} childId
 * @param {string} productId
 * @param {object} product - Produktdata med refill-felter
 * @param {string} institutionId
 * @returns {Promise<{ eligible: boolean, purchaseCount: number, refillsUsed: number }>}
 */
export async function getRefillEligibility(childId, productId, product, institutionId = null) {
    // Hvis refill ikke er aktiveret for produktet, return false
    if (!product?.refill_enabled) {
        return { eligible: false, purchaseCount: 0, refillsUsed: 0 };
    }

    const timeLimitMinutes = safeNumber(product.refill_time_limit_minutes, 0);
    const maxRefills = safeNumber(product.refill_max_refills, 0);

    console.log('[getRefillEligibility] Produkt refill config:', {
        productName: product.name,
        refill_enabled: product.refill_enabled,
        refill_price: product.refill_price,
        refill_time_limit_minutes: product.refill_time_limit_minutes,
        timeLimitMinutes, // efter safeNumber
        refill_max_refills: product.refill_max_refills,
        maxRefills // efter safeNumber
    });

    // Hent barnets køb for dette produkt
    const { rows, error } = await getTodaysSalesForChild(childId, institutionId);
    if (error) {
        console.warn('[getRefillEligibility] Kunne ikke hente dagens køb:', error?.message);
        return { eligible: false, purchaseCount: 0, refillsUsed: 0 };
    }

    console.log('[getRefillEligibility] Dagens salg rows:', rows.length, 'rows');
    if (rows.length > 0) {
        console.log('[getRefillEligibility] Første salg:', {
            created_at: rows[0].created_at,
            items: rows[0].items,
            details: rows[0].details
        });
    }

    const now = new Date();
    let cutoffTime;

    if (timeLimitMinutes === 0) {
        // 0 = resten af dagen (samme som dagens køb)
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        cutoffTime = start;
    } else {
        // Specifik tidsvindue i minutter
        cutoffTime = new Date(now.getTime() - timeLimitMinutes * 60 * 1000);
    }

    // Tæl køb af produktet inden for tidsvinduet
    let totalPurchases = 0;
    let refillPurchases = 0;
    let mostRecentPurchaseTime = null;

    rows.forEach(row => {
        const created = row?.created_at ? new Date(row.created_at) : null;
        if (!created || created < cutoffTime) return;

        const items = normalizeItems(row?.items ?? row?.details);
        items.forEach(item => {
            const pid = String(extractProductId(item));
            if (pid === String(productId)) {
                const qty = extractQuantity(item);
                totalPurchases += qty;

                // Track most recent purchase time
                if (!mostRecentPurchaseTime || created > mostRecentPurchaseTime) {
                    mostRecentPurchaseTime = created;
                }

                // Tæl refill-køb (hvis sale_items har is_refill flag)
                if (item?.is_refill === true) {
                    refillPurchases += qty;
                }
            }
        });
    });

    if (LIMITS_DEBUG) {
        console.log('[getRefillEligibility]', {
            childId,
            productId,
            productName: product?.name,
            timeLimitMinutes,
            maxRefills,
            totalPurchases,
            refillPurchases,
            cutoffTime: cutoffTime.toISOString()
        });
    }

    // Logik:
    // - Hvis barnet har mindst 1 køb i perioden, er de berettiget til refill
    // - Men hvis maxRefills > 0, må de kun have maxRefills refills
    const hasInitialPurchase = totalPurchases > 0;
    const withinRefillLimit = maxRefills === 0 || refillPurchases < maxRefills;

    const eligible = hasInitialPurchase && withinRefillLimit;

    console.log('[getRefillEligibility] Resultat:', {
        productName: product.name,
        totalPurchases,
        refillPurchases,
        hasInitialPurchase,
        withinRefillLimit,
        maxRefills,
        eligible,
        cutoffTime: cutoffTime.toISOString()
    });

    return {
        eligible,
        purchaseCount: totalPurchases,
        refillsUsed: refillPurchases,
        lastPurchaseTime: mostRecentPurchaseTime
    };
}

export async function getChildProductLimitSnapshot(childId, institutionId = null) {
    if (!childId) {
        return { byProductId: {} };
    }

    try {
        let resolvedInstitutionId = institutionId;
        if (!resolvedInstitutionId) {
            const { child } = await getChildProfile(childId);
            resolvedInstitutionId = child?.institution_id || null;
        }
        const { rows, error: todaysError } = await getTodaysSalesForChild(childId, resolvedInstitutionId);
        if (todaysError) {
            if (LIMITS_DEBUG) console.warn('[getChildProductLimitSnapshot] Fejl ved hentning af dagens køb:', todaysError?.message);
            return { byProductId: {} };
        }

        const todaysQtyByProductId = {};
        rows.forEach((row) => {
            const items = normalizeItems(row?.items ?? row?.details);
            items.forEach((item) => {
                const pid = String(extractProductId(item));
                if (!pid || pid === 'null' || pid === 'undefined') return;
                todaysQtyByProductId[pid] = (todaysQtyByProductId[pid] || 0) + extractQuantity(item);
            });
        });

        const { data: products, error: productsError } = await supabaseClient
            .from('products')
            .select('id, is_enabled, refill_enabled, refill_price, refill_time_limit_minutes, refill_max_refills');
        if (productsError) {
            if (LIMITS_DEBUG) console.warn('[getChildProductLimitSnapshot] Fejl ved hentning af produkter:', productsError?.message);
            return { byProductId: {} };
        }

        let productLimits = [];
        if (resolvedInstitutionId) {
            const { data: limitsData, error: limitsError } = await supabaseClient
                .from('product_limits')
                .select('product_id, max_per_day')
                .eq('institution_id', resolvedInstitutionId);
            if (limitsError) {
                if (LIMITS_DEBUG) console.warn('[getChildProductLimitSnapshot] Fejl ved hentning af product_limits:', limitsError?.message);
            } else {
                productLimits = Array.isArray(limitsData) ? limitsData : [];
            }
        }

        const { data: parentLimits, error: parentLimitsError } = await supabaseClient
            .from('parent_limits')
            .select('product_id, max_per_day')
            .eq('child_id', childId);
        if (parentLimitsError) {
            if (LIMITS_DEBUG) console.warn('[getChildProductLimitSnapshot] Fejl ved hentning af parent_limits:', parentLimitsError?.message);
        }
        const parentMaxByProductId = {};
        if (Array.isArray(parentLimits)) {
            parentLimits.forEach((row) => {
                const pid = String(row.product_id);
                if (pid && pid !== 'null' && pid !== 'undefined') {
                    parentMaxByProductId[pid] = row.max_per_day;
                }
            });
        }

        const clubMaxByProductId = {};
        productLimits.forEach(row => {
            const pid = String(row.product_id);
            if (pid) clubMaxByProductId[pid] = row.max_per_day;
        });

        const byProductId = {};
        (products || []).forEach((product) => {
            const pid = String(product.id);
            const clubMax = clubMaxByProductId[pid] ?? null;
            const parentMax = parentMaxByProductId[pid] ?? null;
            // parent_limits overstyrer klub-grænsen hvis sat (inkl. 0 = blokeret).
            const effectiveMaxPerDay = parentMax ?? clubMax;
            const todaysQty = todaysQtyByProductId[pid] || 0;

            byProductId[pid] = {
                effectiveMaxPerDay: effectiveMaxPerDay != null ? effectiveMaxPerDay : null,
                todaysQty,
                // Include refill info for UI
                refillEnabled: product.refill_enabled || false,
                refillPrice: product.refill_price,
                refillTimeLimitMinutes: product.refill_time_limit_minutes || 0,
                refillMaxRefills: product.refill_max_refills || 0,
            };
        });

        return { byProductId };
    } catch (err) {
        if (LIMITS_DEBUG) console.warn('[getChildProductLimitSnapshot] Uventet fejl', err);
        return { byProductId: {} };
    }
}
