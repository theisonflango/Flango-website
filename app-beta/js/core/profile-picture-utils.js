/**
 * profile-picture-utils.js
 * Image processing, upload, and delete for profile pictures.
 * Reuses patterns from product-icon-utils.js but with profile-picture-specific params.
 */

import { supabaseClient } from './config-and-supabase.js';
import { runWithAuthRetry } from './auth-retry.js';
import { invalidateProfilePictureCache } from './profile-picture-cache.js';

const BUCKET = 'profile-pictures';
const TARGET_SIZE = 400;         // 400x400px
const MAX_FILE_SIZE = 50 * 1024; // 50KB
const QUALITIES = [0.80, 0.70, 0.60, 0.50, 0.40, 0.30, 0.20];

/**
 * Process an image file for profile picture upload.
 * Center-crops to square, resizes to 400x400, converts to WebP, compresses to <50KB.
 * @param {File|Blob} file - Input image
 * @returns {Promise<Blob>} - Processed WebP blob
 */
export function processImageForProfilePicture(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = TARGET_SIZE;
                    canvas.height = TARGET_SIZE;

                    // Center-crop to square
                    const sourceAspect = img.width / img.height;
                    let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;
                    if (sourceAspect > 1) {
                        sWidth = img.height;
                        sx = (img.width - sWidth) / 2;
                    } else if (sourceAspect < 1) {
                        sHeight = img.width;
                        sy = (img.height - sHeight) / 2;
                    }

                    ctx.clearRect(0, 0, TARGET_SIZE, TARGET_SIZE);
                    ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, TARGET_SIZE, TARGET_SIZE);

                    const tryCompress = (quality) => {
                        return new Promise((res) => {
                            canvas.toBlob((blob) => res(blob), 'image/webp', quality);
                        });
                    };

                    (async () => {
                        for (const quality of QUALITIES) {
                            const blob = await tryCompress(quality);
                            if (blob && blob.size <= MAX_FILE_SIZE) {
                                resolve(blob);
                                return;
                            }
                        }
                        // Last resort — return at lowest quality even if over limit
                        const lastBlob = await tryCompress(QUALITIES[QUALITIES.length - 1]);
                        if (lastBlob) {
                            resolve(lastBlob);
                        } else {
                            reject(new Error('Kunne ikke komprimere billedet'));
                        }
                    })();
                } catch (err) {
                    reject(err);
                }
            };
            img.onerror = () => reject(new Error('Kunne ikke læse billedet'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('Kunne ikke læse filen'));
        reader.readAsDataURL(file);
    });
}

/**
 * Upload a processed profile picture blob to Supabase Storage + update user record via RPC.
 * @param {Blob} blob - Processed WebP image
 * @param {string} institutionId
 * @param {string} userId - The user (child) ID
 * @param {string} pictureType - 'upload' | 'camera'
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function uploadProfilePicture(blob, institutionId, userId, pictureType) {
    const storagePath = `${institutionId}/${userId}.webp`;

    try {
        // 1. Upload to storage (upsert overwrites previous)
        const { error: uploadError } = await supabaseClient.storage
            .from(BUCKET)
            .upload(storagePath, blob, {
                contentType: 'image/webp',
                upsert: true,
                cacheControl: '31536000',
            });

        if (uploadError) {
            console.error('[profile-picture-utils] Upload fejl:', uploadError);
            return { success: false, error: uploadError.message };
        }

        // 2. Update user record via RPC
        const { data, error: rpcError } = await runWithAuthRetry(
            'update_profile_picture',
            () => supabaseClient.rpc('update_profile_picture', {
                p_user_id: userId,
                p_picture_url: storagePath,
                p_picture_type: pictureType,
            })
        );

        if (rpcError) {
            console.error('[profile-picture-utils] RPC fejl:', rpcError);
            return { success: false, error: rpcError.message };
        }

        if (data && data.success === false) {
            return { success: false, error: data.error };
        }

        // 3. Invalidate cache so fresh signed URL is fetched
        invalidateProfilePictureCache(userId);

        return { success: true };
    } catch (err) {
        console.error('[profile-picture-utils] Fejl:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Save a library avatar as profile picture (no storage upload needed).
 * @param {string} userId
 * @param {string} avatarPath - Local path like 'Icons/webp/Avatar/...'
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function saveLibraryProfilePicture(userId, avatarPath, type = 'library') {
    try {
        const { data, error } = await runWithAuthRetry(
            'update_profile_picture',
            () => supabaseClient.rpc('update_profile_picture', {
                p_user_id: userId,
                p_picture_url: avatarPath,
                p_picture_type: type,
            })
        );

        if (error) return { success: false, error: error.message };
        if (data && data.success === false) return { success: false, error: data.error };

        invalidateProfilePictureCache(userId);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * Remove profile picture: delete from storage + clear user record.
 * @param {string} userId
 * @param {string} institutionId
 * @param {string|null} currentType - Current picture type (skip storage delete for 'library')
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function removeProfilePicture(userId, institutionId, currentType) {
    try {
        // Delete from storage if not library/icon type (those are local/external paths)
        if (currentType && currentType !== 'library' && currentType !== 'icon') {
            const storagePath = `${institutionId}/${userId}.webp`;
            const { error: deleteError } = await supabaseClient.storage
                .from(BUCKET)
                .remove([storagePath]);

            if (deleteError) {
                console.warn('[profile-picture-utils] Storage delete fejl:', deleteError.message);
                // Continue anyway — clearing the DB reference is more important
            }
        }

        // Clear user record via RPC
        const { data, error } = await runWithAuthRetry(
            'remove_profile_picture',
            () => supabaseClient.rpc('remove_profile_picture', {
                p_user_id: userId,
            })
        );

        if (error) return { success: false, error: error.message };
        if (data && data.success === false) return { success: false, error: data.error };

        invalidateProfilePictureCache(userId);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}
