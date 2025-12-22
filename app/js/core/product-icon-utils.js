// js/core/product-icon-utils.js
// Helper functions for product icon handling
// Supports both standard local icons and custom uploaded icons

import { supabaseClient, SUPABASE_URL } from './config-and-supabase.js';
import { CUSTOM_ICON_PREFIX, getCustomIconPath } from '../domain/products-and-cart.js';

// Standard icons available from Supabase Storage
const SUPABASE_STORAGE_URL = 'https://jbknjgbpghrbrstqwoxj.supabase.co/storage/v1/object/public/product-icons/standard';

export const STANDARD_ICONS = [
    { key: 'Toast.webp', label: 'Toast', path: `${SUPABASE_STORAGE_URL}/Toast.webp` },
    { key: 'Saft.webp', label: 'Saft', path: `${SUPABASE_STORAGE_URL}/Saft.webp` },
    { key: 'Sushi.webp', label: 'Sushi', path: `${SUPABASE_STORAGE_URL}/Sushi.webp` },
    { key: 'Noddemix.webp', label: 'Nøddemix', path: `${SUPABASE_STORAGE_URL}/Noddemix.webp` },
    { key: 'Frugt.webp', label: 'Frugt', path: `${SUPABASE_STORAGE_URL}/Frugt.webp` },
    { key: 'Frugter.webp', label: 'Frugter', path: `${SUPABASE_STORAGE_URL}/Frugter.webp` },
    { key: 'Suppe.webp', label: 'Suppe', path: `${SUPABASE_STORAGE_URL}/Suppe.webp` },
    { key: 'Pizza.webp', label: 'Pizza', path: `${SUPABASE_STORAGE_URL}/Pizza.webp` },
    { key: 'stegt_flaesk.webp', label: 'Stegt flæsk', path: `${SUPABASE_STORAGE_URL}/stegt_flaesk.webp` },
    { key: 'smorrebrod.webp', label: 'Smørrebrød', path: `${SUPABASE_STORAGE_URL}/smorrebrod.webp` },
    { key: 'pizzatoast.webp', label: 'Pizza Toast', path: `${SUPABASE_STORAGE_URL}/pizzatoast.webp` },
];

/**
 * Get the icon source URL for a product
 * Priority: custom icon_url > standard icon via emoji field > fallback
 * @param {object} product - Product object with icon_url, icon_updated_at, emoji fields
 * @returns {string|null} Icon URL or null if no icon
 */
export function getProductIconSrc(product) {
    if (!product) return null;

    // Priority 1: Custom uploaded icon (icon_url)
    if (product.icon_url) {
        // Add cache-busting query param
        const timestamp = product.icon_updated_at
            ? new Date(product.icon_updated_at).getTime()
            : Date.now();
        return `${product.icon_url}?v=${timestamp}`;
    }

    // Priority 2: Standard icon via CUSTOM_ICON_PREFIX in emoji field
    const customIconPath = getCustomIconPath(product.emoji);
    if (customIconPath) {
        return customIconPath;
    }

    // Priority 3: No icon (will use emoji or default)
    return null;
}

/**
 * Check if product is using a custom uploaded icon
 * @param {object} product
 * @returns {boolean}
 */
export function hasCustomIcon(product) {
    return !!(product?.icon_url);
}

/**
 * Check if product is using a standard local icon
 * @param {object} product
 * @returns {boolean}
 */
export function hasStandardIcon(product) {
    if (!product) return false;
    if (product.icon_url) return false; // Custom takes precedence
    return !!getCustomIconPath(product.emoji);
}

/**
 * Get standard icon path from emoji field
 * @param {object} product
 * @returns {string|null}
 */
export function getStandardIconPath(product) {
    if (!product?.emoji) return null;
    return getCustomIconPath(product.emoji);
}

/**
 * Process image file: resize to 256x256, convert to WebP, compress
 * @param {File} file - Original image file
 * @returns {Promise<Blob>} Processed WebP blob
 */
export async function processImageForUpload(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
            img.onload = () => {
                try {
                    // Create canvas for resizing
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    const TARGET_SIZE = 256;
                    canvas.width = TARGET_SIZE;
                    canvas.height = TARGET_SIZE;

                    // Calculate crop to cover 256x256 (center crop)
                    const sourceAspect = img.width / img.height;
                    let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;

                    if (sourceAspect > 1) {
                        // Wider than tall: crop sides
                        sWidth = img.height;
                        sx = (img.width - sWidth) / 2;
                    } else if (sourceAspect < 1) {
                        // Taller than wide: crop top/bottom
                        sHeight = img.width;
                        sy = (img.height - sHeight) / 2;
                    }

                    // Clear canvas with transparency
                    ctx.clearRect(0, 0, TARGET_SIZE, TARGET_SIZE);

                    // Draw resized image
                    ctx.drawImage(
                        img,
                        sx, sy, sWidth, sHeight,
                        0, 0, TARGET_SIZE, TARGET_SIZE
                    );

                    // Try to compress to under 200KB
                    const tryCompress = (quality) => {
                        return new Promise((res) => {
                            canvas.toBlob(
                                (blob) => res(blob),
                                'image/webp',
                                quality
                            );
                        });
                    };

                    // Start with quality 0.85, reduce if needed
                    const compress = async () => {
                        const qualities = [0.85, 0.75, 0.65, 0.55, 0.45];
                        const MAX_SIZE = 200 * 1024; // 200KB

                        for (const quality of qualities) {
                            const blob = await tryCompress(quality);
                            if (blob && blob.size <= MAX_SIZE) {
                                console.log(`[processImage] Compressed to ${(blob.size / 1024).toFixed(1)}KB at quality ${quality}`);
                                return blob;
                            }
                        }

                        // If still too large, return lowest quality
                        const finalBlob = await tryCompress(0.35);
                        if (finalBlob && finalBlob.size > MAX_SIZE) {
                            throw new Error('Billedet er for detaljeret – prøv et andet eller mindre billede');
                        }
                        return finalBlob;
                    };

                    compress().then(resolve).catch(reject);

                } catch (err) {
                    reject(err);
                }
            };

            img.onerror = () => reject(new Error('Kunne ikke læse billedfilen'));
            img.src = e.target.result;
        };

        reader.onerror = () => reject(new Error('Kunne ikke læse filen'));
        reader.readAsDataURL(file);
    });
}

/**
 * Upload a product icon to Supabase Storage via Edge Function
 * @param {File} file - Image file to upload
 * @param {string} institutionId - Institution UUID
 * @param {string} productId - Product UUID
 * @param {string} adminUserId - Admin user UUID for authorization
 * @param {object} options - Optional settings
 * @param {string} options.removeBackgroundMode - 'none' | 'simple' (default: 'none')
 * @returns {Promise<{success: boolean, icon_url?: string, icon_updated_at?: string, error?: string}>}
 */
export async function uploadProductIcon(file, institutionId, productId, adminUserId, options = {}) {
    try {
        const removeBackgroundMode = options.removeBackgroundMode || 'none';
        console.log('[uploadProductIcon] Starting upload...', { removeBackgroundMode });

        // Create form data - send original file, server handles processing
        const formData = new FormData();
        formData.append('file', file, file.name || `${productId}.webp`);
        formData.append('productId', productId);
        formData.append('institutionId', institutionId);
        formData.append('removeBackgroundMode', removeBackgroundMode);

        // Get auth token
        const { data: { session } } = await supabaseClient.auth.getSession();
        const accessToken = session?.access_token || '';

        // Call Edge Function
        const response = await fetch(
            `${SUPABASE_URL}/functions/v1/upload-product-icon`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'x-admin-user-id': adminUserId,
                },
                body: formData,
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Upload fejlede');
        }

        console.log('[uploadProductIcon] Success:', result);
        return result;

    } catch (error) {
        console.error('[uploadProductIcon] Error:', error);
        return {
            success: false,
            error: error.message || 'Ukendt fejl ved upload',
        };
    }
}

/**
 * Remove custom icon from a product
 * @param {string} productId - Product UUID
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function removeProductIcon(productId) {
    try {
        const { error } = await supabaseClient
            .from('products')
            .update({
                icon_url: null,
                icon_updated_at: null,
            })
            .eq('id', productId);

        if (error) {
            throw new Error(error.message);
        }

        console.log('[removeProductIcon] Custom icon removed for product:', productId);
        return { success: true };

    } catch (error) {
        console.error('[removeProductIcon] Error:', error);
        return {
            success: false,
            error: error.message || 'Kunne ikke fjerne ikon',
        };
    }
}

/**
 * Format icon update timestamp for display
 * @param {string} isoTimestamp
 * @returns {string} Formatted date string
 */
export function formatIconUpdateTime(isoTimestamp) {
    if (!isoTimestamp) return '';
    const date = new Date(isoTimestamp);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}/${month} kl ${hours}:${minutes}`;
}
