// Domain-lag: Arrangementer (club_events, event_registrations, event_payments)
// Alle Supabase-kald og RPC-wrappere for tilmeldingsmodulet.

import { supabaseClient } from '../core/config-and-supabase.js';

// ============================================================================
// Helpers: datetime-local ↔ (event_date, start_time / end_time) konvertering
// ============================================================================

/**
 * Splitter en datetime-local string ("2026-03-15T14:30") til { date, time }.
 */
export function splitDatetimeLocal(dtl) {
    if (!dtl) return { date: null, time: null };
    const [date, time] = dtl.split('T');
    return { date: date || null, time: time || null };
}

/**
 * Samler event_date + time til datetime-local format.
 */
export function joinDatetimeLocal(date, time) {
    if (!date || !time) return '';
    // Sørg for at time har format HH:MM (trim eventuelle sekunder)
    const shortTime = time.length > 5 ? time.substring(0, 5) : time;
    return `${date}T${shortTime}`;
}

/**
 * Formaterer event_date til dansk datoformat (dd/mm/yyyy).
 */
export function formatEventDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

/**
 * Formaterer time (HH:MM:SS eller HH:MM) til HH:MM.
 */
export function formatTime(timeStr) {
    if (!timeStr) return '';
    return timeStr.length > 5 ? timeStr.substring(0, 5) : timeStr;
}

// ============================================================================
// Fetch: Events + registreringsantal
// ============================================================================

/**
 * Henter events for en institution med registreringsantal.
 * @param {string} institutionId
 * @param {'active'|'past'|'cancelled'} filter
 * @returns {Promise<{events: Array, error: string|null}>}
 */
export async function fetchEvents(institutionId, filter = 'active') {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const nowTime = now.toTimeString().substring(0, 5); // "HH:MM"

    let query = supabaseClient
        .from('club_events')
        .select('*')
        .eq('institution_id', institutionId);

    if (filter === 'active') {
        query = query.eq('status', 'active').gte('event_date', today).order('event_date', { ascending: true }).order('start_time', { ascending: true });
    } else if (filter === 'past') {
        // Afsluttede: aktive events med dato <= i dag + arkiverede (vi filtrerer dagens events client-side)
        query = query.or(`and(status.eq.active,event_date.lte.${today}),status.eq.archived`).order('event_date', { ascending: false });
    } else if (filter === 'cancelled') {
        query = query.eq('status', 'cancelled').order('event_date', { ascending: false });
    }

    const { data: events, error: eventsError } = await query;
    if (eventsError) return { events: [], error: eventsError.message };

    // Filtrér dagens events baseret på slut-/starttid så de flyttes til korrekt liste
    if (events && events.length > 0 && (filter === 'active' || filter === 'past')) {
        const isEventEndedToday = (ev) => {
            if (ev.event_date !== today) return false;
            const endOrStart = ev.end_time ? ev.end_time.substring(0, 5) : ev.start_time ? ev.start_time.substring(0, 5) : null;
            return endOrStart ? endOrStart <= nowTime : false;
        };
        if (filter === 'active') {
            // Fjern dagens events der allerede er afsluttet
            const filtered = events.filter(ev => !isEventEndedToday(ev));
            events.length = 0;
            events.push(...filtered);
        } else if (filter === 'past') {
            // Fjern dagens events der endnu ikke er afsluttet
            const filtered = events.filter(ev => ev.event_date !== today || isEventEndedToday(ev));
            events.length = 0;
            events.push(...filtered);
        }
    }

    if (!events || events.length === 0) return { events: [], error: null };

    // Hent registreringsantal for alle events i ét kald
    const eventIds = events.map(e => e.id);
    const { data: regCounts, error: regError } = await supabaseClient
        .from('event_registrations')
        .select('event_id')
        .in('event_id', eventIds)
        .eq('registration_status', 'registered');

    if (!regError && regCounts) {
        const countMap = {};
        regCounts.forEach(r => {
            countMap[r.event_id] = (countMap[r.event_id] || 0) + 1;
        });
        events.forEach(e => {
            e._registeredCount = countMap[e.id] || 0;
        });
    } else {
        events.forEach(e => { e._registeredCount = 0; });
    }

    return { events, error: null };
}

// ============================================================================
// Fetch: Event detaljer + registreringer med brugerdata
// ============================================================================

/**
 * Henter ét event med alle registreringer og brugerdata.
 * @param {string} eventId
 * @returns {Promise<{event: object|null, registrations: Array, error: string|null}>}
 */
export async function fetchEventDetail(eventId) {
    const { data: event, error: eventError } = await supabaseClient
        .from('club_events')
        .select('*')
        .eq('id', eventId)
        .single();

    if (eventError) return { event: null, registrations: [], error: eventError.message };

    const { data: registrations, error: regError } = await supabaseClient
        .from('event_registrations')
        .select('*, users!event_registrations_user_id_fkey(id, name, number, grade_level, balance, role, is_test_user)')
        .eq('event_id', eventId)
        .order('registered_at', { ascending: true });

    if (regError) {
        console.error('[event-management] Kunne ikke hente registreringer:', regError);
        return { event, registrations: [], error: null };
    }

    return { event, registrations: registrations || [], error: null };
}

// ============================================================================
// CRUD: Events
// ============================================================================

/**
 * Opretter et nyt arrangement.
 * @param {object} eventData - { institution_id, title, description, price, event_date, start_time, end_time, allowed_classes, capacity, created_by }
 */
export async function createEvent(eventData) {
    const { data, error } = await supabaseClient
        .from('club_events')
        .insert(eventData)
        .select()
        .single();
    return { data, error };
}

/**
 * Opdaterer et eksisterende arrangement.
 * @param {string} eventId
 * @param {object} updates
 */
export async function updateEvent(eventId, updates) {
    const { data, error } = await supabaseClient
        .from('club_events')
        .update(updates)
        .eq('id', eventId)
        .select()
        .single();
    return { data, error };
}

// ============================================================================
// RPC: Tilmelding, framelding, betaling, aflysning
// ============================================================================

/**
 * Tilmelder en bruger til et arrangement via RPC.
 * Returnerer JSONB med { success, error?, registration_id?, ... }.
 */
export async function registerUserForEvent(eventId, userId, adminOverride = false) {
    const { data, error } = await supabaseClient.rpc('register_for_event', {
        p_event_id: eventId,
        p_user_id: userId,
        p_admin_override: adminOverride,
    });
    if (error) return { success: false, error: error.message };
    return data; // JSONB: { success, error?, registration_id?, ... }
}

/**
 * Framelder en bruger fra et arrangement via RPC.
 * Returnerer JSONB med { success, refunded, refund_amount }.
 */
export async function cancelRegistration(eventId, userId) {
    const { data, error } = await supabaseClient.rpc('cancel_event_registration', {
        p_event_id: eventId,
        p_user_id: userId,
    });
    if (error) return { success: false, error: error.message };
    return data;
}

/**
 * Betaler en eksisterende tilmelding via RPC.
 * payment_type i event_payments tillader kun: balance, stripe, mobilepay, other.
 * 'manual' (kontant/manuelt) mappes til 'other'.
 */
export async function payRegistration(registrationId, paymentType = 'balance') {
    const allowed = ['balance', 'stripe', 'mobilepay', 'other'];
    const pType = allowed.includes(paymentType) ? paymentType : 'other';
    const { data, error } = await supabaseClient.rpc('pay_event_registration', {
        p_registration_id: registrationId,
        p_payment_type: pType,
    });
    if (error) return { success: false, error: error.message };
    return data;
}

/**
 * Aflyser et arrangement med masserefund via RPC.
 * Returnerer JSONB med { success, refund_count, total_refunded }.
 */
export async function cancelEventWithRefunds(eventId) {
    const { data, error } = await supabaseClient.rpc('cancel_event_with_mass_refund', {
        p_event_id: eventId,
    });
    if (error) return { success: false, error: error.message };
    return data;
}

// ============================================================================
// Utility: Klassetjek
// ============================================================================

/**
 * Henter institutions saldogrænse-indstillinger (til "Betal med saldo"-tjek).
 * @param {string} institutionId
 * @returns {Promise<{ balance_limit_enabled?: boolean, balance_limit_amount?: number, balance_limit_exempt_admins?: boolean, balance_limit_exempt_test_users?: boolean }|null>}
 */
export async function fetchInstitutionBalanceLimit(institutionId) {
    if (!institutionId) return null;
    const { data, error } = await supabaseClient
        .from('institutions')
        .select('balance_limit_enabled, balance_limit_amount, balance_limit_exempt_admins, balance_limit_exempt_test_users')
        .eq('id', institutionId)
        .single();
    if (error) return null;
    return data;
}

/**
 * Tjekker om en brugers klassetrin matcher et arrangements tilladte klasser.
 * @param {number|null} userGradeLevel
 * @param {number[]|null} allowedClasses
 * @returns {{ match: boolean, reason: string|null }}
 */
export function checkClassMatch(userGradeLevel, allowedClasses) {
    // Null = alle klasser tilladt
    if (!allowedClasses || allowedClasses.length === 0) {
        return { match: true, reason: null };
    }
    if (userGradeLevel === null || userGradeLevel === undefined) {
        return { match: false, reason: 'Barnet har ingen klasse angivet' };
    }
    if (!allowedClasses.includes(userGradeLevel)) {
        return { match: false, reason: `Barnet er i ${userGradeLevel}. klasse, men arrangementet er kun for ${allowedClasses.map(c => c + '. kl.').join(', ')}` };
    }
    return { match: true, reason: null };
}
