/**
 * profile-picture-cache.js
 * In-memory cache for profile picture signed URLs (private bucket).
 * Library-type pictures use local paths and bypass the cache.
 */

import { supabaseClient } from './config-and-supabase.js?v=3.0.65';
import { escapeHtml } from './escape-html.js?v=3.0.65';

const BUCKET = 'profile-pictures';
const SIGNED_URL_TTL_MS = 55 * 60 * 1000; // 55 min (URLs valid 60 min)
const SIGNED_URL_DURATION_SEC = 3600;      // 60 min

// Map<userId, { url, expiresAt }>
const signedUrlCache = new Map();

/**
 * Returns a displayable URL for a user's profile picture.
 * - Library type: returns the path directly (local static file)
 * - Storage types (upload/camera/ai_avatar): returns a signed URL from cache or generates one
 */
export async function getProfilePictureUrl(user) {
    if (!user || !user.profile_picture_url) return null;
    if (user.profile_picture_opt_out) return null;

    // Library avatars are local paths — no signed URL needed
    if ((user.profile_picture_type === 'library' || user.profile_picture_type === 'icon')) {
        return user.profile_picture_url;
    }

    // Full URLs (e.g. AI avatars in public bucket) — use directly
    if (user.profile_picture_url.startsWith('http')) {
        return user.profile_picture_url;
    }

    // Check cache
    const cached = signedUrlCache.get(user.id);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.url;
    }

    // Generate signed URL
    try {
        const { data, error } = await supabaseClient.storage
            .from(BUCKET)
            .createSignedUrl(user.profile_picture_url, SIGNED_URL_DURATION_SEC);

        if (error || !data?.signedUrl) {
            console.warn('[profile-picture-cache] Signed URL fejl:', error?.message);
            return null;
        }

        signedUrlCache.set(user.id, {
            url: data.signedUrl,
            expiresAt: Date.now() + SIGNED_URL_TTL_MS,
        });

        return data.signedUrl;
    } catch (err) {
        console.warn('[profile-picture-cache] Fejl:', err.message);
        return null;
    }
}

/**
 * Batch pre-warm signed URLs for multiple users.
 * Filters to only users with storage-based profile pictures (not library).
 * Returns Map<userId, signedUrl>.
 */
export async function batchPreWarmProfilePictures(users) {
    if (!Array.isArray(users) || users.length === 0) return new Map();

    const needsUrl = users.filter(u =>
        u.profile_picture_url &&
        !u.profile_picture_opt_out &&
        u.profile_picture_type !== 'library' &&
        u.profile_picture_type !== 'icon' &&
        // Full URLs (public bucket) don't need signed URLs
        !u.profile_picture_url.startsWith('http') &&
        // Skip if already cached and valid
        !(signedUrlCache.has(u.id) && signedUrlCache.get(u.id).expiresAt > Date.now())
    );

    if (needsUrl.length === 0) return getCachedUrls(users);

    // Batch create signed URLs
    try {
        const paths = needsUrl.map(u => u.profile_picture_url);
        const { data, error } = await supabaseClient.storage
            .from(BUCKET)
            .createSignedUrls(paths, SIGNED_URL_DURATION_SEC);

        if (!error && data) {
            const now = Date.now();
            data.forEach((item, i) => {
                if (item.signedUrl) {
                    signedUrlCache.set(needsUrl[i].id, {
                        url: item.signedUrl,
                        expiresAt: now + SIGNED_URL_TTL_MS,
                    });
                }
            });
        }
    } catch (err) {
        console.warn('[profile-picture-cache] Batch fejl:', err.message);
    }

    return getCachedUrls(users);
}

/**
 * Get cached URL for a single user (sync). Returns null if not cached.
 */
export function getCachedProfilePictureUrl(user) {
    if (!user || !user.profile_picture_url || user.profile_picture_opt_out) return null;
    if ((user.profile_picture_type === 'library' || user.profile_picture_type === 'icon')) return user.profile_picture_url;
    if (user.profile_picture_url.startsWith('http')) return user.profile_picture_url;

    const cached = signedUrlCache.get(user.id);
    if (cached && cached.expiresAt > Date.now()) return cached.url;
    return null;
}

/** Invalidate cache for a single user */
export function invalidateProfilePictureCache(userId) {
    signedUrlCache.delete(userId);
}

/** Clear entire cache */
export function clearProfilePictureCache() {
    signedUrlCache.clear();
    defaultImageSignedUrl = null;
    defaultImageSignedUrlExpires = 0;
}

/**
 * Pre-warm the default profile picture signed URL for an institution.
 * Call this at app init so sync getDefaultProfilePicture() works immediately.
 */
export async function preWarmDefaultProfilePicture(inst) {
    if (inst?.default_profile_picture_mode === 'image' && inst?.default_profile_picture_url) {
        try {
            const { data } = await supabaseClient.storage
                .from(BUCKET)
                .createSignedUrl(inst.default_profile_picture_url, SIGNED_URL_DURATION_SEC);
            if (data?.signedUrl) {
                defaultImageSignedUrl = data.signedUrl;
                defaultImageSignedUrlExpires = Date.now() + SIGNED_URL_TTL_MS;
            }
        } catch (err) {
            console.warn('[profile-picture-cache] Pre-warm default fejl:', err.message);
        }
    }
}

// --- Default profile picture for users without one ---

// Cache for default image signed URL
let defaultImageSignedUrl = null;
let defaultImageSignedUrlExpires = 0;

/**
 * Returns the default profile picture info for a user without their own picture.
 * @param {string} userName - User's display name (for initials)
 * @param {object} inst - Institution object (from __flangoGetInstitutionById)
 * @returns {{ type: 'initials'|'anonymous'|'image', value: string }}
 */
export function getDefaultProfilePicture(userName, inst) {
    const mode = inst?.default_profile_picture_mode || 'initials';
    if (mode === 'anonymous') return { type: 'anonymous', value: '👤' };
    if (mode === 'image' && inst?.default_profile_picture_url) {
        // Return cached signed URL if available
        if (defaultImageSignedUrl && defaultImageSignedUrlExpires > Date.now()) {
            return { type: 'image', value: defaultImageSignedUrl };
        }
        return { type: 'image', value: null }; // URL needs async resolution
    }
    const initials = (userName || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return { type: 'initials', value: initials };
}

/**
 * Async version that resolves signed URL for image-type default pictures.
 */
export async function getDefaultProfilePictureAsync(userName, inst) {
    const mode = inst?.default_profile_picture_mode || 'initials';
    if (mode === 'anonymous') return { type: 'anonymous', value: '👤' };
    if (mode === 'image' && inst?.default_profile_picture_url) {
        if (defaultImageSignedUrl && defaultImageSignedUrlExpires > Date.now()) {
            return { type: 'image', value: defaultImageSignedUrl };
        }
        try {
            const { data } = await supabaseClient.storage
                .from(BUCKET)
                .createSignedUrl(inst.default_profile_picture_url, SIGNED_URL_DURATION_SEC);
            if (data?.signedUrl) {
                defaultImageSignedUrl = data.signedUrl;
                defaultImageSignedUrlExpires = Date.now() + SIGNED_URL_TTL_MS;
                return { type: 'image', value: data.signedUrl };
            }
        } catch (err) {
            console.warn('[profile-picture-cache] Default image URL fejl:', err.message);
        }
    }
    const initials = (userName || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return { type: 'initials', value: initials };
}

/**
 * Renders default profile picture HTML for a given size.
 */
export function renderDefaultProfilePictureHtml(userName, inst, size = 26, imgClass = '') {
    const def = getDefaultProfilePicture(userName, inst);
    if (def.type === 'anonymous') {
        return `<span class="pp-inline-default" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.55)}px;">👤</span>`;
    }
    if (def.type === 'image' && def.value) {
        return `<img src="${escapeHtml(def.value)}" alt="" class="${imgClass || 'pp-inline-thumb'}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;">`;
    }
    // Initials or image-without-url fallback
    const fontSize = Math.round(size * 0.28);
    const initials = (userName || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return `<span style="display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:50%;background:rgba(99,102,241,0.15);font-weight:700;font-size:${fontSize}px;color:#6366f1;flex-shrink:0;">${initials}</span>`;
}

// --- Internal ---

function getCachedUrls(users) {
    const result = new Map();
    const now = Date.now();
    for (const u of users) {
        if (!u.profile_picture_url || u.profile_picture_opt_out) continue;
        if ((u.profile_picture_type === 'library' || u.profile_picture_type === 'icon') || u.profile_picture_url.startsWith('http')) {
            result.set(u.id, u.profile_picture_url);
        } else {
            const cached = signedUrlCache.get(u.id);
            if (cached && cached.expiresAt > now) {
                result.set(u.id, cached.url);
            }
        }
    }
    return result;
}
