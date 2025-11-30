// Produkt-helpers: ikon-konstanter og helper-funktioner

export const CUSTOM_ICON_PREFIX = '::icon::';

export const PRODUCT_ICON_MAP = {
    'toast': 'Icons/Food/Toast.png',
    'pizza': 'Icons/Food/Pizza.png',
    'sushi': 'Icons/Food/Sushi.png',
    'nøddemix': 'Icons/Food/Nøddemix.png',
    'frugt': 'Icons/Food/Frugt.png',
    'saft': 'Icons/Food/Saft.png',
    'suppe': 'Icons/Food/Suppe.png'
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

export function addProductToOrder(order, product, maxItems = 10) {
    if (!Array.isArray(order) || !product) return { success: false, reason: 'invalid' };
    if (order.length >= maxItems) return { success: false, reason: 'limit' };
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
