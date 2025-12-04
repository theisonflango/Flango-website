import { supabaseClient } from '../core/config-and-supabase.js';

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

// Returner YYYY-MM-DD for lokal dag (matcher created_at_local_date i events_view).
function buildTodayLocalDateString() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

async function getProductById(productId) {
    const { data, error } = await supabaseClient
        .from('products')
        .select('id, name, price, max_per_day, unhealthy, is_enabled')
        .eq('id', productId)
        .single();
    if (error) {
        console.warn('[canChildPurchase] Produkt slået op med fejl:', error?.message);
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
        console.warn('[canChildPurchase] Forældrebegrænsning lookup fejlede:', error?.message);
        return { parentLimit: null, error };
    }
    return { parentLimit: data, error: null };
}

async function getChildProfile(childId) {
    const { data, error } = await supabaseClient
        .from('users')
        .select('id, parent_daily_budget')
        .eq('id', childId)
        .single();
    if (error) {
        console.warn('[canChildPurchase] Bruger slået op med fejl:', error?.message);
        return { child: null, error };
    }
    return { child: data, error: null };
}

async function getTodaysSalesForChild(childId) {
    const today = buildTodayLocalDateString();
    const { data, error } = await supabaseClient
        .from('events_view')
        .select('event_type, created_at, items, target_user_id, created_at_local_date')
        .eq('event_type', 'SALE')
        .eq('target_user_id', childId)
        .eq('created_at_local_date', today);
    if (error) {
        console.warn('[canChildPurchase] Fejl ved hentning af dagens køb:', error?.message);
        return { rows: [], error };
    }
    return { rows: Array.isArray(data) ? data : [], error: null };
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

async function getTodaysQuantityForProduct(childId, productId) {
    const { rows, error } = await getTodaysSalesForChild(childId);
    if (error) return 0;
    let total = 0;
    rows.forEach((row) => {
        const items = Array.isArray(row?.items) ? row.items : [];
        items.forEach((item) => {
            if (String(extractProductId(item)) === String(productId)) {
                total += extractQuantity(item);
            }
        });
    });
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
            console.warn('[getUnhealthyPurchasesSnapshot] Fejl fra sugar-policy:', error?.message);
            return { boughtUnhealthyProductIds: [] };
        }
        return { boughtUnhealthyProductIds: data?.boughtUnhealthyProductIds || [] };
    } catch (err) {
        console.warn('[getUnhealthyPurchasesSnapshot] Uventet fejl:', err);
        return { boughtUnhealthyProductIds: [] };
    }
}

async function getTodaysTotalSpend(childId) {
    const { rows, error } = await getTodaysSalesForChild(childId);
    if (error) return 0;
    let total = 0;
    rows.forEach((row) => {
        const items = Array.isArray(row?.items) ? row.items : [];
        items.forEach((item) => {
            total += extractPrice(item) * extractQuantity(item);
        });
    });
    return total;
}

/**
 * Tjek om et barn må købe et givent produkt ud fra institution- og forældrebegrænsninger.
 * @param {string} productId
 * @param {string} childId
 * @param {object} [options] - Ekstra options, f.eks. { orderItems: [...] } for at inkludere kurven.
 * @returns {Promise<{ allowed: boolean, message: string | null, reason?: string }>}
 */
export async function canChildPurchase(productId, childId, options = {}) {
    if (!productId || !childId) {
        return { allowed: false, message: 'Produkt eller bruger mangler.' };
    }

    const orderItems = options?.orderItems || [];
    const qtyInCart = orderItems.reduce((sum, item) => {
        return String(extractProductId(item)) === String(productId) ? sum + extractQuantity(item) : sum;
    }, 0);

    // 1) Slå produktet op
    const { product, error: productError } = await getProductById(productId);
    if (productError || !product) {
        return { allowed: false, message: 'Produktet findes ikke.' };
    }
    if (product.is_enabled === false) {
        return { allowed: false, message: 'Produktet er ikke aktivt i øjeblikket.' };
    }

    // 2-3) Standard klub-grænse + evt. forældre override
    const clubMax = product.max_per_day; // kan være null
    const { parentLimit } = await getParentLimit(childId, productId);
    const parentMax = parentLimit?.max_per_day ?? null;

    // parent_limits overstyrer klub-grænsen hvis sat (inkl. 0 = blokeret).
    const effectiveMaxPerDay = parentMax ?? clubMax; // kommentaren markerer tydeligt, hvor override sker

    // 4) Tæl dagens køb af produktet
    const todaysQty = await getTodaysQuantityForProduct(childId, productId);

    // 5) Antals-regel
    if (effectiveMaxPerDay !== null && effectiveMaxPerDay !== undefined) {
        if (effectiveMaxPerDay === 0) {
            return { allowed: false, message: 'Denne vare er spærret for dig – det er en aftale med dine forældre.' };
        }
        if (todaysQty + qtyInCart >= effectiveMaxPerDay) {
            if (parentLimit) {
                return { allowed: false, message: 'Du har nået grænsen for, hvor mange du må købe af denne vare i dag. Det er aftalt med dine forældre.' };
            }
            return { allowed: false, message: 'Du har nået klubbens grænse for, hvor mange du må købe af denne vare i dag.' };
        }
    }

    // 6) Dagligt beløb (parent_daily_budget)
    const { child } = await getChildProfile(childId);
    const dailyBudget = child?.parent_daily_budget ?? null;
    if (dailyBudget !== null && dailyBudget !== undefined) {
        const todaysTotalSpend = await getTodaysTotalSpend(childId);
        const price = safeNumber(product.price, 0);
        // Dagligt beløb tjek
        if (todaysTotalSpend + price > safeNumber(dailyBudget, 0)) {
            return { allowed: false, message: 'Du har nået dit daglige max-beløb i caféen. Tal med en voksen, hvis der er noget, du er i tvivl om.' };
        }
    }

    // 7) OK
    return { allowed: true, message: null };
}

// canChildPurchase er klar til at blive brugt i evaluatePurchase

export async function getChildProductLimitSnapshot(childId) {
    if (!childId) {
        return { byProductId: {} };
    }

    try {
        const { rows, error: todaysError } = await getTodaysSalesForChild(childId);
        if (todaysError) {
            console.warn('[getChildProductLimitSnapshot] Fejl ved hentning af dagens køb:', todaysError?.message);
            return { byProductId: {} };
        }

        const todaysQtyByProductId = {};
        rows.forEach((row) => {
            const items = Array.isArray(row?.items) ? row.items : [];
            items.forEach((item) => {
                const pid = String(extractProductId(item));
                if (!pid || pid === 'null' || pid === 'undefined') return;
                todaysQtyByProductId[pid] = (todaysQtyByProductId[pid] || 0) + extractQuantity(item);
            });
        });

        const { data: products, error: productsError } = await supabaseClient
            .from('products')
            .select('id, max_per_day, is_enabled');
        if (productsError) {
            console.warn('[getChildProductLimitSnapshot] Fejl ved hentning af produkter:', productsError?.message);
            return { byProductId: {} };
        }

        const { data: parentLimits, error: parentLimitsError } = await supabaseClient
            .from('parent_limits')
            .select('product_id, max_per_day')
            .eq('child_id', childId);
        if (parentLimitsError) {
            console.warn('[getChildProductLimitSnapshot] Fejl ved hentning af parent_limits:', parentLimitsError?.message);
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

        const byProductId = {};
        (products || []).forEach((product) => {
            const pid = String(product.id);
            const clubMax = product.max_per_day;
            const parentMax = parentMaxByProductId[pid] ?? null;
            // parent_limits overstyrer klub-grænsen hvis sat (inkl. 0 = blokeret).
            const effectiveMaxPerDay = parentMax ?? clubMax;
            const todaysQty = todaysQtyByProductId[pid] || 0;

            byProductId[pid] = {
                effectiveMaxPerDay: effectiveMaxPerDay != null ? effectiveMaxPerDay : null,
                todaysQty,
            };
        });

        return { byProductId };
    } catch (err) {
        console.warn('[getChildProductLimitSnapshot] Uventet fejl', err);
        return { byProductId: {} };
    }
}
