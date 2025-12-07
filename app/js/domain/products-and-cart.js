// Produkt-helpers: ikon-konstanter og helper-funktioner
import { getChildProductLimitSnapshot, canChildPurchase } from './purchase-limits.js';
import { getCurrentCustomer } from './cafe-session-store.js';

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
    const customIcon = getCustomIconPath(product.emoji);
    if (customIcon) {
        return { path: customIcon, alt: product.name || 'Produkt' };
    }
    const nameLower = (product.name || '').trim().toLowerCase();
    if (PRODUCT_ICON_MAP[nameLower]) {
        return { path: PRODUCT_ICON_MAP[nameLower], alt: product.name || 'Produkt', className: PRODUCT_ICON_CLASS_MAP[nameLower] || '' };
    }
    return null;
}

export async function addProductToOrder(order, product, maxItems = 10) {
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
    order.push(product);
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

    // Brug for-loop så vi kan await et backend-fallback pr. knap uden at fyre alle kald parallelt.
    for (const btn of buttons) {
        if (!btn) return;
        const pidRaw = btn.dataset.productId;
        const pid = pidRaw != null ? String(pidRaw) : null;
        if (!pid) return;

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

        // Fallback: hvis snapshot ikke viser lås, så spørg backend direkte, så vi fanger evt. mismatch mellem ID-typer.
        if (!isAtLimit && childId && productMap.has(pid)) {
            try {
                const product = productMap.get(pid);
                const backendCheck = await canChildPurchase(product.id, childId, currentOrder, institutionId, product.name);
                if (backendCheck && backendCheck.allowed === false) {
                    isAtLimit = true;
                }
            } catch (err) {
                console.warn('[applyProductLimitsToButtons] backend fallback fejl:', err);
            }
        }

        if (isAtLimit) {
            btn.classList.add('product-limit-reached');
            btn.dataset.limitState = 'reached';
        } else {
            btn.classList.remove('product-limit-reached');
            btn.dataset.limitState = 'ok';
        }
    }
}
