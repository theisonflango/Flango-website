/**
 * mfa-utils.js — TOTP MFA hjælpefunktioner
 *
 * Wrapper-funktioner for Supabase Auth MFA API + localStorage device trust.
 * Bruges af café-app login-flow og admin settings.
 */

import { supabaseClient } from '../core/config-and-supabase.js';

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

// ─── Device trust (localStorage) ──────────────────────────────────

const TRUST_PREFIX = 'flango_mfa_trusted_';

/** Tjek om denne enhed er trusted for den givne app */
export function isMfaDeviceTrusted(appKey) {
    try {
        const val = localStorage.getItem(TRUST_PREFIX + appKey);
        return val === 'true';
    } catch {
        return false;
    }
}

/** Markér enheden som trusted */
export function setMfaDeviceTrusted(appKey) {
    try {
        localStorage.setItem(TRUST_PREFIX + appKey, 'true');
    } catch {
        // localStorage kan være utilgængelig
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
 * Afgør om MFA skal kræves baseret på policy og device trust.
 * @param {'off'|'always'|'new_device'} policy
 * @param {string} appKey - 'admin', 'parent', 'superadmin'
 * @returns {boolean}
 */
export function shouldRequireMfa(policy, appKey) {
    if (policy === 'off') return false;
    if (policy === 'always') return true;
    if (policy === 'new_device') return !isMfaDeviceTrusted(appKey);
    return false;
}
