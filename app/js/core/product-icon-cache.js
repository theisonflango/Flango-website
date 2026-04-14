/**
 * product-icon-cache.js
 * In-memory cache for product icon signed URLs (private bucket).
 * Standard icons and custom uploaded icons both resolve through this cache.
 * Pattern matches profile-picture-cache.js.
 */

import { supabaseClient } from './config-and-supabase.js?v=3.0.78';

const BUCKET = 'product-icons';
const SIGNED_URL_TTL_MS = 55 * 60 * 1000;   // 55 min (URLs valid 60 min)
const SIGNED_URL_DURATION_SEC = 3600;         // 60 min

// Map<storagePath, { url, expiresAt }>
const signedUrlCache = new Map();

/**
 * Get a signed URL for a product icon storage path.
 * Returns cached URL if valid, otherwise creates a new signed URL.
 * @param {string} storagePath — e.g. '{institutionId}/products/{productId}.webp'
 * @returns {Promise<string|null>}
 */
export async function getProductIconUrl(storagePath) {
    if (!storagePath) return null;

    const cached = signedUrlCache.get(storagePath);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.url;
    }

    try {
        const { data, error } = await supabaseClient.storage
            .from(BUCKET)
            .createSignedUrl(storagePath, SIGNED_URL_DURATION_SEC);

        if (error || !data?.signedUrl) {
            console.warn('[product-icon-cache] Signed URL fejl:', error?.message);
            return null;
        }

        signedUrlCache.set(storagePath, {
            url: data.signedUrl,
            expiresAt: Date.now() + SIGNED_URL_TTL_MS,
        });

        return data.signedUrl;
    } catch (err) {
        console.warn('[product-icon-cache] Fejl:', err.message);
        return null;
    }
}

/**
 * Batch pre-warm signed URLs for products with icon_storage_path.
 * Also handles institution_icons with storage_path.
 * @param {Array<{icon_storage_path?: string, storage_path?: string}>} items
 */
export async function batchPreWarmProductIcons(items) {
    if (!Array.isArray(items) || items.length === 0) return;

    const now = Date.now();
    const paths = [];

    for (const item of items) {
        const p = item.icon_storage_path || item.storage_path;
        if (!p) continue;
        const cached = signedUrlCache.get(p);
        if (cached && cached.expiresAt > now) continue;
        if (!paths.includes(p)) paths.push(p);
    }

    if (paths.length === 0) return;

    try {
        const { data, error } = await supabaseClient.storage
            .from(BUCKET)
            .createSignedUrls(paths, SIGNED_URL_DURATION_SEC);

        if (!error && data) {
            data.forEach((item, i) => {
                if (item.signedUrl) {
                    signedUrlCache.set(paths[i], {
                        url: item.signedUrl,
                        expiresAt: now + SIGNED_URL_TTL_MS,
                    });
                }
            });
        }
    } catch (err) {
        console.warn('[product-icon-cache] Batch fejl:', err.message);
    }
}

/**
 * Pre-warm signed URLs for the 11 standard icons.
 * Call once at app init. Standard icons never change so they cache well.
 */
const STANDARD_ICON_PATHS = [
    'standard/Toast.webp',
    'standard/Saft.webp',
    'standard/Sushi.webp',
    'standard/Noddemix.webp',
    'standard/Frugt.webp',
    'standard/Frugter.webp',
    'standard/Suppe.webp',
    'standard/Pizza.webp',
    'standard/stegt_flaesk.webp',
    'standard/smorrebrod.webp',
    'standard/pizzatoast.webp',
];

let standardIconsWarmed = false;

export async function preWarmStandardIcons() {
    if (standardIconsWarmed) return;
    standardIconsWarmed = true;
    await batchPreWarmProductIcons(
        STANDARD_ICON_PATHS.map(p => ({ icon_storage_path: p }))
    );
}

/**
 * Get cached URL synchronously. Returns null if not yet cached.
 * @param {string} storagePath
 * @returns {string|null}
 */
export function getCachedProductIconUrl(storagePath) {
    if (!storagePath) return null;
    const cached = signedUrlCache.get(storagePath);
    if (cached && cached.expiresAt > Date.now()) return cached.url;
    return null;
}

/**
 * Inject a signed URL into cache (e.g. from Edge Function response).
 * @param {string} storagePath
 * @param {string} signedUrl
 */
export function setCachedProductIconUrl(storagePath, signedUrl) {
    if (!storagePath || !signedUrl) return;
    signedUrlCache.set(storagePath, {
        url: signedUrl,
        expiresAt: Date.now() + SIGNED_URL_TTL_MS,
    });
}

/** Invalidate cache for a single path */
export function invalidateProductIconCache(storagePath) {
    if (storagePath) signedUrlCache.delete(storagePath);
}

/** Clear entire cache */
export function clearProductIconCache() {
    signedUrlCache.clear();
    standardIconsWarmed = false;
}
