/**
 * Inaktivitets-timeout modul
 *
 * Efter 10 minutters inaktivitet logges admin ud og café-appen
 * falder tilbage til admin-login-skærmen.
 * POS-mode (børn handler) fungerer stadig — kun admin-sessionen invalideres.
 */

import { supabaseClient } from './config-and-supabase.js';

const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutter

let _timeoutId = null;
let _active = false;

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'];

function _resetTimer() {
    if (!_active) return;
    clearTimeout(_timeoutId);
    _timeoutId = setTimeout(_onInactive, INACTIVITY_TIMEOUT_MS);
}

async function _onInactive() {
    if (!_active) return;
    console.warn('[inactivity-timeout] 10 min inaktivitet — logger admin ud');

    stopInactivityTimeout();

    // Sign out the admin session
    try {
        await supabaseClient.auth.signOut();
    } catch (e) {
        console.error('[inactivity-timeout] signOut fejl:', e?.message);
    }

    // Reload to show the appropriate login screen
    // (app.js will check hasDeviceUsers and show admin-picker or full login)
    location.reload();
}

/**
 * Start inaktivitets-timeren. Kald efter admin login / startApp().
 */
export function startInactivityTimeout() {
    // Skip inaktivitets-timeout under lokal udvikling
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        console.log('[inactivity-timeout] Deaktiveret på localhost');
        return;
    }
    if (_active) return;
    _active = true;
    ACTIVITY_EVENTS.forEach(evt => document.addEventListener(evt, _resetTimer, { passive: true }));
    _resetTimer();
}

/**
 * Stop timeren. Kald ved logout eller app-nedlukning.
 */
export function stopInactivityTimeout() {
    _active = false;
    clearTimeout(_timeoutId);
    ACTIVITY_EVENTS.forEach(evt => document.removeEventListener(evt, _resetTimer));
}
