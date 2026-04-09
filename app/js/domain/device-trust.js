/**
 * Device Trust Module
 *
 * Manages device tokens in localStorage for "Remember this device" + Quick PIN unlock.
 * Stores array of { token, userId, firstName } in localStorage under 'flango_device_users'.
 *
 * Token is a 128-char hex string (64 bytes random).
 * Server stores SHA-256 hash; client stores raw token.
 */

import { supabaseClient } from '../core/config-and-supabase.js?v=3.0.65';
import { getOrCreateDeviceId } from './mfa-utils.js?v=3.0.65';

const DEVICE_USERS_KEY = 'flango_device_users';
const DEVICE_USERS_COOKIE = 'flango_device_users_bk';
const SUPABASE_URL = supabaseClient.supabaseUrl || 'https://jbknjgbpghrbrstqwoxj.supabase.co';
const SUPABASE_ANON_KEY = supabaseClient.supabaseKey || supabaseClient.rest?.headers?.apikey || '';

// ─── Cookie helpers (for device users backup) ──────────────────

function _setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Strict; Secure`;
}

function _getCookie(name) {
    return document.cookie.split('; ').find(r => r.startsWith(name + '='))?.split('=')[1] || null;
}

/** Backup device users summary til cookie (kun navne, ikke tokens — pga 4KB cookie limit) */
function _backupDeviceUsersToCookie(users) {
    try {
        const summary = users.map(u => ({ u: u.userId, f: u.firstName, i: u.institutionId }));
        _setCookie(DEVICE_USERS_COOKIE, btoa(JSON.stringify(summary)), 365);
    } catch {}
}

/** Hent device users backup fra cookie. Returnerer kun summary (uden tokens). */
function _getDeviceUsersFromCookie() {
    try {
        const raw = _getCookie(DEVICE_USERS_COOKIE);
        if (!raw) return [];
        const parsed = JSON.parse(atob(raw));
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

// ─── localStorage helpers ───────────────────────────────────────

/**
 * Get all stored device users for this device.
 * @returns {Array<{token: string, userId: string, firstName: string, institutionId: string}>}
 */
export function getDeviceUsers() {
    try {
        const raw = localStorage.getItem(DEVICE_USERS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

/**
 * Check if device previously had registered users (via cookie backup).
 * Useful when localStorage is cleared but cookie persists.
 * @returns {boolean}
 */
export function hadDeviceUsers() {
    return _getDeviceUsersFromCookie().length > 0;
}

/**
 * Check if any device users are registered on this device.
 */
export function hasDeviceUsers() {
    return getDeviceUsers().length > 0;
}

/**
 * Add a device user after successful registration.
 */
export function addDeviceUser({ token, userId, firstName, institutionId }) {
    const users = getDeviceUsers();
    // Remove existing entry for same user (re-registration)
    const filtered = users.filter(u => u.userId !== userId);
    filtered.unshift({ token, userId, firstName, institutionId });
    try {
        localStorage.setItem(DEVICE_USERS_KEY, JSON.stringify(filtered));
    } catch (e) {
        console.error('[device-trust] Failed to save device user:', e);
    }
    // Cookie backup (navne only, ikke tokens)
    _backupDeviceUsersToCookie(filtered);
}

/**
 * Remove a specific device user (after lockout or manual revoke).
 */
export function removeDeviceUser(userId) {
    const users = getDeviceUsers().filter(u => u.userId !== userId);
    try {
        localStorage.setItem(DEVICE_USERS_KEY, JSON.stringify(users));
    } catch (e) {
        console.error('[device-trust] Failed to remove device user:', e);
    }
    _backupDeviceUsersToCookie(users);
}

/**
 * Clear all device users (full reset).
 */
export function clearAllDeviceUsers() {
    try {
        localStorage.removeItem(DEVICE_USERS_KEY);
    } catch {}
    _backupDeviceUsersToCookie([]);
}

// ─── Token hashing (client-side SHA-256 for lookup) ─────────────

/**
 * SHA-256 hash a token string (for sending hashes to get_device_users_for_institution).
 */
async function sha256(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Server interactions ────────────────────────────────────────

/**
 * Register a device token after successful email+password login.
 * Must be called while the user has an active Supabase session.
 * @param {string} pin - 4-digit PIN chosen by the user
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function registerDeviceToken(pin) {
    const deviceName = _getDeviceName();
    const deviceId = getOrCreateDeviceId();
    const { data, error } = await supabaseClient.rpc('register_device_token', {
        p_pin: pin,
        p_device_name: deviceName,
        p_device_id: deviceId,
    });

    if (error) {
        console.error('[device-trust] register error:', error);
        return { success: false, error: error.message };
    }

    if (!data?.token) {
        return { success: false, error: data?.error || 'Registration failed' };
    }

    // Get current user info
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        return { success: false, error: 'No active session' };
    }

    const { data: profile } = await supabaseClient
        .from('users')
        .select('name, institution_id')
        .eq('user_id', session.user.id)
        .single();

    if (!profile) {
        return { success: false, error: 'Profile not found' };
    }

    // Store raw token in localStorage
    addDeviceUser({
        token: data.token,
        userId: session.user.id,
        firstName: profile.name ? profile.name.split(' ')[0] : 'Admin',
        institutionId: profile.institution_id,
    });

    return { success: true };
}

/**
 * Verify PIN for quick unlock via Edge Function.
 * Returns hashed_token for magic link verification if successful.
 * @param {string} userId - The user ID to unlock
 * @param {string} pin - 4-digit PIN
 * @returns {Promise<{success: boolean, hashedToken?: string, locked?: boolean, error?: string}>}
 */
export async function verifyDevicePin(userId, pin) {
    const users = getDeviceUsers();
    const deviceUser = users.find(u => u.userId === userId);
    if (!deviceUser) {
        return { success: false, error: 'No device token for this user' };
    }

    try {
        // Get anon key from supabase client
        let anonKey = SUPABASE_ANON_KEY;
        if (!anonKey) {
            // Fallback: try to extract from the client
            try {
                anonKey = supabaseClient.rest?.headers?.apikey
                    || supabaseClient.realtime?.params?.apikey
                    || '';
            } catch {}
        }

        const response = await fetch(`${SUPABASE_URL}/functions/v1/verify-device-pin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': anonKey,
            },
            body: JSON.stringify({
                token: deviceUser.token,
                pin: pin,
            }),
        });

        const result = await response.json();

        if (!response.ok || result.error) {
            if (result.locked) {
                // Token is locked — remove from local storage
                removeDeviceUser(userId);
                return { success: false, locked: true, error: 'Account locked on this device' };
            }
            return { success: false, error: result.error || 'Verification failed' };
        }

        // Success — we have a hashed_token for magic link auth
        return {
            success: true,
            hashedToken: result.hashed_token,
            institutionId: result.institution_id,
        };
    } catch (e) {
        console.error('[device-trust] verifyDevicePin error:', e);
        return { success: false, error: 'Network error' };
    }
}

/**
 * Complete the magic link auth flow after successful PIN verification.
 * @param {string} hashedToken - The hashed_token from verify-device-pin
 * @returns {Promise<{success: boolean, session?: object, error?: string}>}
 */
export async function completeDevicePinAuth(hashedToken) {
    try {
        const { data, error } = await supabaseClient.auth.verifyOtp({
            token_hash: hashedToken,
            type: 'magiclink',
        });

        if (error) {
            console.error('[device-trust] verifyOtp error:', error);
            return { success: false, error: error.message };
        }

        return { success: true, session: data?.session };
    } catch (e) {
        console.error('[device-trust] completeDevicePinAuth error:', e);
        return { success: false, error: e.message };
    }
}

/**
 * Get the list of device tokens for the current user (for "My Devices" UI).
 * Requires an active session.
 */
export async function getMyDeviceTokens() {
    const { data, error } = await supabaseClient.rpc('get_device_tokens');
    if (error) {
        console.error('[device-trust] getMyDeviceTokens error:', error);
        return [];
    }
    return data || [];
}

/**
 * Revoke a specific device token.
 */
export async function revokeDeviceToken(tokenId) {
    const { data, error } = await supabaseClient.rpc('revoke_device_token', {
        p_token_id: tokenId,
    });
    if (error) {
        console.error('[device-trust] revokeDeviceToken error:', error);
        return { success: false, error: error.message };
    }
    return data || { success: false };
}

/**
 * Revoke all device tokens for current user.
 */
export async function revokeAllDeviceTokens() {
    const { data, error } = await supabaseClient.rpc('revoke_all_device_tokens');
    if (error) {
        console.error('[device-trust] revokeAllDeviceTokens error:', error);
        return { success: false, error: error.message };
    }
    // Also clear local storage
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        removeDeviceUser(session.user.id);
    }
    return data || { success: false };
}

// ─── Helpers ────────────────────────────────────────────────────

function _getDeviceName() {
    const ua = navigator.userAgent;
    if (/iPad/.test(ua)) return 'iPad';
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/Android/.test(ua)) return 'Android';
    if (/Mac/.test(ua)) return 'Mac';
    if (/Windows/.test(ua)) return 'Windows';
    if (/Linux/.test(ua)) return 'Linux';
    return 'Ukendt enhed';
}
