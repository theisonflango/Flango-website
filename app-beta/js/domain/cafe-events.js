// Domain-lag: Café Event Strip
// Henter events relevante for valgt barn i café-view og cacher resultater.

import { supabaseClient } from '../core/config-and-supabase.js';
import { checkClassMatch, registerUserForEvent, formatEventDate, formatTime } from './event-management.js';
import { updateInstitutionCache } from './institution-store.js';

// ============================================================================
// In-memory cache: childId → { events, fetchedAt }
// ============================================================================
const cafeEventsCache = new Map();

/**
 * Henter café event display settings fra institutions-tabellen.
 * @param {string} institutionId
 * @returns {Promise<{ cafe_events_enabled: boolean, cafe_events_days_ahead: number, cafe_events_as_products: boolean }>}
 */
export async function getCafeEventSettings(institutionId) {
    if (!institutionId) return { cafe_events_enabled: false, cafe_events_days_ahead: 14, cafe_events_as_products: false };

    // Tjek window cache først
    const cached = typeof window !== 'undefined' && typeof window.__flangoGetInstitutionById === 'function'
        ? window.__flangoGetInstitutionById(institutionId)
        : null;

    if (cached && 'cafe_events_enabled' in cached) {
        return {
            cafe_events_enabled: cached.cafe_events_enabled === true,
            cafe_events_days_ahead: cached.cafe_events_days_ahead ?? 14,
            cafe_events_as_products: cached.cafe_events_as_products === true,
        };
    }

    // Fallback: hent fra DB
    const { data, error } = await supabaseClient
        .from('institutions')
        .select('cafe_events_enabled, cafe_events_days_ahead, cafe_events_as_products')
        .eq('id', institutionId)
        .single();

    if (error || !data) {
        return { cafe_events_enabled: false, cafe_events_days_ahead: 14, cafe_events_as_products: false };
    }

    // Opdater cache
    updateInstitutionCache(institutionId, {
        cafe_events_enabled: data.cafe_events_enabled,
        cafe_events_days_ahead: data.cafe_events_days_ahead,
        cafe_events_as_products: data.cafe_events_as_products,
    });

    return {
        cafe_events_enabled: data.cafe_events_enabled === true,
        cafe_events_days_ahead: data.cafe_events_days_ahead ?? 14,
        cafe_events_as_products: data.cafe_events_as_products === true,
    };
}

/**
 * Gem café event settings til institutions-tabellen.
 */
export async function saveCafeEventSettings(institutionId, settings) {
    const { error } = await supabaseClient
        .from('institutions')
        .update({
            cafe_events_enabled: settings.cafe_events_enabled,
            cafe_events_days_ahead: settings.cafe_events_days_ahead,
            cafe_events_as_products: settings.cafe_events_as_products,
        })
        .eq('id', institutionId);

    if (!error) {
        updateInstitutionCache(institutionId, {
            cafe_events_enabled: settings.cafe_events_enabled,
            cafe_events_days_ahead: settings.cafe_events_days_ahead,
            cafe_events_as_products: settings.cafe_events_as_products,
        });
    }

    return { error };
}

/**
 * Henter events for et barn i café-view.
 * Returnerer events med registreringsantal + barnets egen registration.
 *
 * @param {object} params
 * @param {string} params.institutionId
 * @param {string} params.childId
 * @param {number|null} params.childGradeLevel
 * @param {number} params.daysAhead - Antal dage frem (default 14)
 * @returns {Promise<{ events: Array, error: string|null }>}
 */
export async function fetchCafeEventsForChild({ institutionId, childId, childGradeLevel, daysAhead = 14 }) {
    if (!institutionId || !childId) return { events: [], error: null };

    // Tjek cache
    const cached = cafeEventsCache.get(childId);
    if (cached && (Date.now() - cached.fetchedAt) < 60000) {
        return { events: cached.events, error: null };
    }

    const today = new Date().toISOString().split('T')[0];
    const toDate = new Date();
    toDate.setDate(toDate.getDate() + daysAhead);
    const toDateStr = toDate.toISOString().split('T')[0];

    // Query 1: Hent aktive events indenfor tidsvindue
    const { data: events, error: eventsError } = await supabaseClient
        .from('club_events')
        .select('id, title, price, event_date, start_time, capacity, allowed_classes, status')
        .eq('institution_id', institutionId)
        .eq('status', 'active')
        .gte('event_date', today)
        .lte('event_date', toDateStr)
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true });

    if (eventsError) return { events: [], error: eventsError.message };
    if (!events || events.length === 0) return { events: [], error: null };

    // Filtrer efter klassetrin
    const filteredEvents = events.filter(event => {
        const classResult = checkClassMatch(childGradeLevel, event.allowed_classes);
        // Hvis barnet ikke har grade_level, vis kun events med allowed_classes = null
        if (childGradeLevel === null || childGradeLevel === undefined) {
            return !event.allowed_classes || event.allowed_classes.length === 0;
        }
        return classResult.match;
    });

    if (filteredEvents.length === 0) {
        cafeEventsCache.set(childId, { events: [], fetchedAt: Date.now() });
        return { events: [], error: null };
    }

    // Query 2: Hent registreringer for disse events + barnets egne
    const eventIds = filteredEvents.map(e => e.id);
    const { data: regs, error: regError } = await supabaseClient
        .from('event_registrations')
        .select('event_id, user_id, registration_status, payment_status, id')
        .in('event_id', eventIds)
        .eq('registration_status', 'registered');

    if (regError) {
        console.warn('[cafe-events] Kunne ikke hente registreringer:', regError);
    }

    // Byg registreringsdata
    const regCountMap = {};
    let childRegMap = {};
    (regs || []).forEach(r => {
        regCountMap[r.event_id] = (regCountMap[r.event_id] || 0) + 1;
        if (r.user_id === childId) {
            childRegMap[r.event_id] = {
                registration_id: r.id,
                payment_status: r.payment_status,
            };
        }
    });

    // Berig events med data
    const enrichedEvents = filteredEvents.map(event => {
        const registeredCount = regCountMap[event.id] || 0;
        const capacity = event.capacity || null;
        const remaining = capacity ? Math.max(0, capacity - registeredCount) : null;
        const childReg = childRegMap[event.id] || null;
        const isFull = capacity !== null && remaining === 0;
        const isRegistered = !!childReg;

        return {
            ...event,
            registered_count: registeredCount,
            capacity,
            remaining,
            is_full: isFull,
            is_registered: isRegistered,
            child_registration: childReg,
        };
    });

    cafeEventsCache.set(childId, { events: enrichedEvents, fetchedAt: Date.now() });
    return { events: enrichedEvents, error: null };
}

/**
 * Invalidér cache for et barn (efter registrering/betaling/aflysning).
 */
export function invalidateCafeEventsCache(childId) {
    if (childId) {
        cafeEventsCache.delete(childId);
    } else {
        cafeEventsCache.clear();
    }
}

/**
 * Registrerer et barn for et event via café-flow.
 * @param {string} eventId
 * @param {string} childId
 * @param {boolean} payNow - true = betal med saldo, false = betal senere
 * @returns {Promise<{ success: boolean, error?: string, registration_id?: string }>}
 */
export async function cafeRegisterForEvent(eventId, childId, payNow = false) {
    // Trin 1: Registrér barnet
    const regResult = await registerUserForEvent(eventId, childId, true); // admin override = true (café admin)
    if (!regResult.success) {
        return { success: false, error: regResult.error || 'Tilmelding fejlede' };
    }

    const registrationId = regResult.registration_id;

    if (payNow && registrationId) {
        // Trin 2: Betal med saldo
        const { data: payData, error: payError } = await supabaseClient.rpc('pay_event_registration', {
            p_registration_id: registrationId,
            p_payment_type: 'balance',
        });

        if (payError) {
            return {
                success: true,
                registration_id: registrationId,
                payment_error: payError.message,
                payment_status: 'not_paid',
            };
        }

        const payResult = payData || {};
        if (!payResult.success) {
            return {
                success: true,
                registration_id: registrationId,
                payment_error: payResult.error || 'Betaling fejlede',
                payment_status: 'not_paid',
            };
        }

        return {
            success: true,
            registration_id: registrationId,
            payment_status: 'paid',
            new_balance: payResult.new_balance,
        };
    }

    return {
        success: true,
        registration_id: registrationId,
        payment_status: payNow ? 'not_paid' : 'not_paid', // Ikke betalt endnu
    };
}

/**
 * Betaler en eksisterende registrering via café-flow.
 * @param {string} registrationId
 * @returns {Promise<{ success: boolean, payment_status: string, new_balance?: number, error?: string }>}
 */
export async function cafePayExistingRegistration(registrationId) {
    const { data: payData, error: payError } = await supabaseClient.rpc('pay_event_registration', {
        p_registration_id: registrationId,
        p_payment_type: 'balance',
    });

    if (payError) {
        return { success: false, error: payError.message, payment_status: 'not_paid' };
    }

    const payResult = payData || {};
    if (!payResult.success) {
        return { success: false, error: payResult.error || 'Betaling fejlede', payment_status: 'not_paid' };
    }

    return {
        success: true,
        payment_status: 'paid',
        new_balance: payResult.new_balance,
    };
}

// Hjælpere: re-export formattering
export { formatEventDate, formatTime };
