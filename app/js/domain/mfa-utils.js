/**
 * mfa-utils.js — TOTP MFA hjælpefunktioner
 *
 * Wrapper-funktioner for Supabase Auth MFA API + durable device trust.
 * Device trust lagres i 3 lag: localStorage (hurtig) → cookie (overlever cache-rydning) → server (permanent).
 * Bruges af café-app login-flow og admin settings.
 */

import { supabaseClient } from '../core/config-and-supabase.js?v=3.0.79';

// ─── Supabase MFA API wrappers ────────────────────────────────────

/** Hent brugerens enrollede TOTP-faktorer */
export async function getMfaFactors() {
    const { data, error } = await supabaseClient.auth.mfa.listFactors();
    if (error) {
        console.error('[mfa-utils] listFactors fejl:', error.message);
        return [];
    }
    return data?.totp ?? [];
}

/** Start TOTP enrollment → returnerer { factorId, qrCodeUri, secret } */
export async function enrollTotp() {
    const { data, error } = await supabaseClient.auth.mfa.enroll({
        factorType: 'totp',
    });
    if (error) {
        console.error('[mfa-utils] enroll fejl:', error.message);
        return { error: error.message };
    }
    return {
        factorId: data.id,
        qrCodeUri: data.totp.uri,
        secret: data.totp.secret,
    };
}

/** Challenge + verify i ét kald. Returnerer { success } eller { error } */
export async function challengeAndVerify(factorId, code) {
    const { data: challengeData, error: challengeError } =
        await supabaseClient.auth.mfa.challenge({ factorId });
    if (challengeError) {
        console.error('[mfa-utils] challenge fejl:', challengeError.message);
        return { error: challengeError.message };
    }

    const { data, error: verifyError } = await supabaseClient.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: code.trim(),
    });
    if (verifyError) {
        return { error: verifyError.message };
    }
    return { success: true };
}

/** Hent AAL-niveau */
export async function getAssuranceLevel() {
    const { data, error } = await supabaseClient.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) {
        console.error('[mfa-utils] AAL fejl:', error.message);
        return { currentLevel: 'aal1', nextLevel: 'aal1' };
    }
    return data;
}

// ─── Cookie helpers ───────────────────────────────────────────────

function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Strict; Secure`;
}

function getCookie(name) {
    return document.cookie.split('; ').find(r => r.startsWith(name + '='))?.split('=')[1] || null;
}

const DEVICE_ID_COOKIE = 'flango_device_id';
const DEVICE_ID_LS_KEY = 'flango_device_id_backup';

// ─── Device ID (cookie-baseret, overlever localStorage-rydning) ──

/** Hent device UUID fra cookie eller localStorage. Returnerer null hvis ukendt enhed. */
export function getDeviceId() {
    return getCookie(DEVICE_ID_COOKIE) || _tryLs(DEVICE_ID_LS_KEY) || null;
}

/** Hent eller opret device UUID. Gemmer i både cookie og localStorage. */
export function getOrCreateDeviceId() {
    let deviceId = getCookie(DEVICE_ID_COOKIE) || _tryLs(DEVICE_ID_LS_KEY);
    if (!deviceId) {
        deviceId = crypto.randomUUID();
    }
    // Skriv altid til begge lag
    setCookie(DEVICE_ID_COOKIE, deviceId, 365);
    try { localStorage.setItem(DEVICE_ID_LS_KEY, deviceId); } catch {}
    return deviceId;
}

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

function _tryLs(key) {
    try { return localStorage.getItem(key); } catch { return null; }
}

// ─── Device trust (3-lags: localStorage → cookie → server) ───────

const TRUST_PREFIX = 'flango_mfa_trusted_';

/** Hurtig synkron check: er enheden trusted i localStorage? */
export function isMfaDeviceTrusted(appKey) {
    try {
        const val = localStorage.getItem(TRUST_PREFIX + appKey);
        return val === 'true';
    } catch {
        return false;
    }
}

/** Markér enheden som trusted (kun localStorage — hurtig cache) */
export function setMfaDeviceTrusted(appKey) {
    try {
        localStorage.setItem(TRUST_PREFIX + appKey, 'true');
    } catch {
        // localStorage kan være utilgængelig
    }
}

/**
 * Durable MFA trust — gemmer i alle 3 lag:
 * 1. localStorage (hurtig synkron check)
 * 2. Cookie (overlever localStorage-rydning)
 * 3. Server-side (overlever alt)
 */
export async function setMfaDeviceTrustedDurable(appKey) {
    // 1. localStorage
    setMfaDeviceTrusted(appKey);

    // 2. Cookie — sørg for at device ID er sat
    const deviceId = getOrCreateDeviceId();

    // 3. Server-side
    try {
        await supabaseClient.rpc('register_mfa_device', {
            p_device_id: deviceId,
            p_device_name: _getDeviceName(),
        });
    } catch (err) {
        console.warn('[mfa-utils] register_mfa_device fejl:', err);
        // Fail-open: MFA trust er stadig gemt i localStorage + cookie
    }
}

/**
 * Async server-side fallback: tjek om device er MFA-trusted.
 * Bruges kun når localStorage er tom (efter cache-rydning).
 * Gendanner localStorage cache ved succes.
 */
export async function checkServerMfaTrust(appKey) {
    const deviceId = getDeviceId();
    if (!deviceId) return false;

    try {
        const { data, error } = await supabaseClient.rpc('check_device_mfa_trusted', {
            p_device_id: deviceId,
        });
        if (error || !data?.trusted) return false;

        // Gendan localStorage cache så næste check er hurtig
        setMfaDeviceTrusted(appKey);
        return true;
    } catch {
        return false; // fail-open
    }
}

/** Fjern trust-markering */
export function clearMfaDeviceTrust(appKey) {
    try {
        localStorage.removeItem(TRUST_PREFIX + appKey);
    } catch {
        // ignore
    }
}

// ─── Policy beslutning ────────────────────────────────────────────

/**
 * Synkron hurtig-check: afgør om MFA skal kræves baseret på policy og localStorage.
 * For 'new_device' policy: hvis dette returnerer true, bør kalderen også prøve
 * checkServerMfaTrust() som async fallback før MFA vises.
 */
export function shouldRequireMfa(policy, appKey) {
    if (policy === 'off') return false;
    if (policy === 'always') return true;
    if (policy === 'new_device') return !isMfaDeviceTrusted(appKey);
    return false;
}
