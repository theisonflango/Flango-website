/**
 * profile-picture-utils.js
 * Image processing, upload, and delete for profile pictures.
 * Reuses patterns from product-icon-utils.js but with profile-picture-specific params.
 */

import { supabaseClient } from './config-and-supabase.js?v=3.0.67';
import { runWithAuthRetry } from './auth-retry.js?v=3.0.67';
import { invalidateProfilePictureCache } from './profile-picture-cache.js?v=3.0.67';

const BUCKET = 'profile-pictures';
const TARGET_SIZE = 400;         // 400x400px
const MAX_FILE_SIZE = 50 * 1024; // 50KB
const QUALITIES = [0.80, 0.70, 0.60, 0.50, 0.40, 0.30, 0.20];

/** Generate unique storage path: {institutionId}/{userId}_{timestamp}.webp */
function uniqueStoragePath(institutionId, userId) {
    return `${institutionId}/${userId}_${Date.now()}.webp`;
}

/**
 * Save entry to profile_picture_library and deactivate previous active.
 * @param {object} opts
 */
export async function saveToLibrary({ institutionId, userId, userName, storagePath, pictureType, aiStyle, aiPrompt, isActive = true }) {
    try {
        // Deactivate previous active picture for this user (only if new one will be active)
        if (isActive) {
            await supabaseClient
                .from('profile_picture_library')
                .update({ is_active: false })
                .eq('user_id', userId)
                .eq('is_active', true);
        }

        // Insert new entry
        await supabaseClient
            .from('profile_picture_library')
            .insert({
                institution_id: institutionId,
                user_id: userId,
                user_name: userName,
                storage_path: storagePath,
                picture_type: pictureType,
                ai_style: aiStyle || null,
                ai_prompt: aiPrompt || null,
                is_active: isActive,
            });
    } catch (err) {
        console.warn('[profile-picture-utils] Library save fejl:', err?.message || err);
    }
}

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
 * @param {string} [userName] - User's name (for library metadata)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function uploadProfilePicture(blob, institutionId, userId, pictureType, userName = '') {
    const storagePath = uniqueStoragePath(institutionId, userId);

    try {
        // 1. Upload to storage
        const { error: uploadError } = await supabaseClient.storage
            .from(BUCKET)
            .upload(storagePath, blob, {
                contentType: 'image/webp',
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

        // 3. Save to library
        await saveToLibrary({ institutionId, userId, userName, storagePath, pictureType });

        // 4. Invalidate cache so fresh signed URL is fetched
        invalidateProfilePictureCache(userId);

        return { success: true, storagePath };
    } catch (err) {
        console.error('[profile-picture-utils] Fejl:', err);
        return { success: false, error: err.message };
    }
}

/**
 * Save a library avatar as profile picture (no storage upload needed).
 * @param {string} userId
 * @param {string} avatarPath - Local path like 'Icons/webp/Avatar/...'
 * @param {string} [type] - 'library' | 'icon'
 * @param {object} [meta] - { institutionId, userName } for library metadata
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function saveLibraryProfilePicture(userId, avatarPath, type = 'library', meta = {}) {
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

        // Save to library
        if (meta.institutionId && meta.userName) {
            await saveToLibrary({
                institutionId: meta.institutionId,
                userId,
                userName: meta.userName,
                storagePath: avatarPath,
                pictureType: type,
            });
        }

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
        // Clear user record via RPC (billedet beholdes i storage)
        const { data, error } = await runWithAuthRetry(
            'remove_profile_picture',
            () => supabaseClient.rpc('remove_profile_picture', {
                p_user_id: userId,
            })
        );

        if (error) return { success: false, error: error?.message || String(error) };
        if (data && data.success === false) return { success: false, error: data.error || 'Ukendt fejl' };

        invalidateProfilePictureCache(userId);
        return { success: true };
    } catch (err) {
        return { success: false, error: err?.message || String(err) };
    }
}

/**
 * Fetch all profile pictures for a user from the library.
 * If the user has a current picture not in the library, migrate it first.
 * @param {string} userId
 * @param {object} [user] - User object with profile_picture_url, profile_picture_type, name, institution_id
 * @returns {Promise<Array>}
 */
export async function fetchUserProfilePictures(userId, user) {
    try {
        let { data, error } = await supabaseClient
            .from('profile_picture_library')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.warn('[profile-picture-utils] Library fetch fejl:', error.message);
            return [];
        }

        const entries = data || [];

        // Migrate pre-library picture if user has one that's not in the library
        if (user?.profile_picture_url && !user.profile_picture_opt_out) {
            const alreadyInLibrary = entries.some(e => e.storage_path === user.profile_picture_url);
            if (!alreadyInLibrary) {
                try {
                    const { data: inserted } = await supabaseClient
                        .from('profile_picture_library')
                        .insert({
                            institution_id: user.institution_id,
                            user_id: userId,
                            user_name: user.name || '',
                            storage_path: user.profile_picture_url,
                            picture_type: user.profile_picture_type || 'upload',
                            is_active: true,
                        })
                        .select()
                        .single();

                    if (inserted) {
                        entries.unshift(inserted);
                    }
                } catch (migErr) {
                    console.warn('[profile-picture-utils] Migration fejl:', migErr?.message);
                }
            }
        }

        return entries;
    } catch (err) {
        console.warn('[profile-picture-utils] Library fetch fejl:', err?.message);
        return [];
    }
}

/**
 * Apply a profile picture from the library to a user.
 * Updates user record + is_active flags in library.
 * Pass null to clear profile picture.
 * @param {string} userId
 * @param {object|null} entry - Library entry { id, storage_path, picture_type } or null to clear
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function applyProfilePicture(userId, entry) {
    try {
        if (!entry) {
            // Clear profile picture
            const { data, error } = await runWithAuthRetry(
                'remove_profile_picture',
                () => supabaseClient.rpc('remove_profile_picture', { p_user_id: userId })
            );
            if (error) return { success: false, error: error?.message || String(error) };
            if (data && data.success === false) return { success: false, error: data.error || 'Ukendt fejl' };

            // Deactivate all in library
            await supabaseClient
                .from('profile_picture_library')
                .update({ is_active: false })
                .eq('user_id', userId)
                .eq('is_active', true);

            invalidateProfilePictureCache(userId);
            return { success: true };
        }

        // Apply selected picture
        // RPC only accepts institution-enabled types — map 'aula' to 'upload' for validation
        const rpcType = entry.picture_type === 'aula' ? 'upload' : entry.picture_type;
        const { data, error } = await runWithAuthRetry(
            'update_profile_picture',
            () => supabaseClient.rpc('update_profile_picture', {
                p_user_id: userId,
                p_picture_url: entry.storage_path,
                p_picture_type: rpcType,
            })
        );

        if (error) return { success: false, error: error?.message || String(error) };
        if (data && data.success === false) return { success: false, error: data.error || 'Ukendt fejl' };

        // Update is_active flags
        await supabaseClient
            .from('profile_picture_library')
            .update({ is_active: false })
            .eq('user_id', userId)
            .eq('is_active', true);

        await supabaseClient
            .from('profile_picture_library')
            .update({ is_active: true })
            .eq('id', entry.id);

        invalidateProfilePictureCache(userId);
        return { success: true };
    } catch (err) {
        return { success: false, error: err?.message || String(err) };
    }
}
