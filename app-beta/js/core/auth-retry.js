// js/core/auth-retry.js
// Central helper: refresh Supabase session and retry once on auth errors.
import { supabaseClient } from './config-and-supabase.js';

function isAuthError(error) {
    if (!error) return false;
    const status = Number(error.status || error.code || 0);
    const message = String(error.message || '').toLowerCase();
    return (
        status === 401 ||
        status === 403 ||
        message.includes('jwt') ||
        message.includes('token') ||
        message.includes('not authorized') ||
        message.includes('permission denied')
    );
}

export async function runWithAuthRetry(label, callFn) {
    if (typeof callFn !== 'function') {
        return { data: null, error: new Error('runWithAuthRetry: callFn mangler') };
    }
    try {
        const initial = await callFn();
        if (!initial?.error || !isAuthError(initial.error)) {
            return initial;
        }

        console.warn(`[auth-retry] ${label} auth-fejl, forsøger session refresh...`);
        const { error: refreshError } = await supabaseClient.auth.refreshSession();
        if (refreshError) {
            console.warn('[auth-retry] refreshSession fejlede:', refreshError?.message || refreshError);
            return initial;
        }

        return await callFn();
    } catch (err) {
        return { data: null, error: err };
    }
}
