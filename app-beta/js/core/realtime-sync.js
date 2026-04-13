// js/core/realtime-sync.js
// Realtime subscriptions for users (balance) and products (sortiment).
// Event-based invalidation; throttled fallback on disconnect/visibility only.

import { supabaseClient } from './config-and-supabase.js';
import { updateCustomerBalanceGlobally } from './balance-manager.js';
import { refreshBalances, refreshProductsAndAssortment, mergeProductIntoCache, removeProductFromCache } from './data-refetch.js';
import { showBalanceToast, updateBalanceForToast } from '../ui/toast-notifications.js';

let usersChannel = null;
let productsChannel = null;
let eventsChannel = null;
let visibilityBound = false;
let lastRealtimeStatus = { users: null, products: null, events: null };
let pendingDepositEvents = new Map(); // userId -> { event, retryAt }
let subscribedInstitutionId = null;
let eventsResubscribeTimer = null;
let eventsResubscribeCount = 0;
const MAX_EVENTS_RESUBSCRIBE_ATTEMPTS = 3;

function getInstitutionId() {
    const p = typeof window !== 'undefined' && window.__flangoCurrentAdminProfile;
    return p?.institution_id || null;
}

function runThrottledFallback() {
    console.log('[realtime-sync] Running throttled fallback (disconnect/visibility)');
    refreshBalances().then((ran) => {
        if (ran) console.log('[realtime-sync] refreshBalances done');
    });
    refreshProductsAndAssortment().then((data) => {
        if (data) console.log('[realtime-sync] refreshProductsAndAssortment done', data.length, 'products');
    });
}

function onUsersStatus(status) {
    lastRealtimeStatus.users = status;
    console.log('[realtime-sync] users channel status:', status);
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        runThrottledFallback();
    }
}

function onEventsStatus(status) {
    lastRealtimeStatus.events = status;
    console.log('[realtime-sync] events channel status:', status);

    // Reset retry count on successful subscription
    if (status === 'SUBSCRIBED') {
        eventsResubscribeCount = 0;
        return;
    }

    // Events-channel påvirker kun UI-toasts (ingen DB kald), så vi kan trygt forsøge resubscribe.
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        // Stop infinite loop: max 3 resubscribe attempts
        if (eventsResubscribeCount >= MAX_EVENTS_RESUBSCRIBE_ATTEMPTS) {
            console.warn('[realtime-sync] events channel failed after', MAX_EVENTS_RESUBSCRIBE_ATTEMPTS, 'attempts, giving up (toasts disabled)');
            return;
        }
        if (eventsResubscribeTimer) return;
        eventsResubscribeTimer = setTimeout(() => {
            eventsResubscribeTimer = null;
            if (!subscribedInstitutionId) return;
            // Skip resubscribe if channel is now healthy
            if (lastRealtimeStatus.events === 'SUBSCRIBED') {
                return;
            }
            eventsResubscribeCount++;
            console.warn('[realtime-sync] events channel unhealthy → resubscribing (attempt', eventsResubscribeCount, 'of', MAX_EVENTS_RESUBSCRIBE_ATTEMPTS + ')');
            subscribeEvents(subscribedInstitutionId);
        }, 1500);
    }
}

function onProductsStatus(status) {
    lastRealtimeStatus.products = status;
    console.log('[realtime-sync] products channel status:', status);
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        runThrottledFallback();
    }
}

/**
 * Subscribe to public.users UPDATE for current institution; merge balance into allUsers + currentCustomer.
 */
function subscribeUsers(institutionId) {
    if (usersChannel) {
        supabaseClient.removeChannel(usersChannel);
        usersChannel = null;
    }
    if (!institutionId) return;
    const filter = `institution_id=eq.${institutionId}`;
    usersChannel = supabaseClient
        .channel(`users:${institutionId}`)
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'users', filter },
            (payload) => {
                const row = payload?.new;
                if (!row || row.id == null) return;
                const balance = row.balance;
                if (typeof balance !== 'number' && typeof balance !== 'string') return;
                const num = Number(balance);
                if (!Number.isFinite(num)) return;
                console.log('[realtime-sync] users UPDATE merge', row.id, 'balance=', num);
                updateCustomerBalanceGlobally(row.id, num, 0, 'realtime');
                // Update toast balance if toast exists for this user
                updateBalanceForToast(row.id, num);
            }
        )
        .subscribe((status) => onUsersStatus(status));
}

/**
 * Subscribe to public.products INSERT/UPDATE/DELETE for current institution; merge into cache and re-render.
 */
function subscribeProducts(institutionId) {
    if (productsChannel) {
        supabaseClient.removeChannel(productsChannel);
        productsChannel = null;
    }
    if (!institutionId) return;
    const filter = `institution_id=eq.${institutionId}`;
    productsChannel = supabaseClient
        .channel(`products:${institutionId}`)
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'products', filter },
            (payload) => {
                const row = payload?.new;
                if (!row) return;
                console.log('[realtime-sync] products INSERT merge', row.id);
                mergeProductIntoCache(row);
            }
        )
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'products', filter },
            (payload) => {
                const row = payload?.new;
                if (!row) return;
                console.log('[realtime-sync] products UPDATE merge', row.id);
                mergeProductIntoCache(row);
            }
        )
        .on(
            'postgres_changes',
            { event: 'DELETE', schema: 'public', table: 'products', filter },
            (payload) => {
                const row = payload?.old;
                const id = row?.id;
                if (!id) return;
                console.log('[realtime-sync] products DELETE remove', id);
                removeProductFromCache(id);
            }
        )
        .subscribe((status) => onProductsStatus(status));
}

function getUserFromCache(userId) {
    const allUsers = typeof window !== 'undefined' && window.__flangoAllUsers;
    if (!Array.isArray(allUsers)) return null;
    return allUsers.find((u) => u.id === userId) || null;
}

function processDepositEvent(eventRow) {
    const eventType = eventRow.event_type;
    if (eventType !== 'DEPOSIT' && eventType !== 'BALANCE_ADJUSTMENT') return;

    const userId = eventRow.target_user_id;
    if (!userId) return;

    const details = eventRow.details || {};
    const amount = details.amount != null ? details.amount : eventRow.amount;
    const amountNum = Number(amount);
    if (amount == null || !Number.isFinite(amountNum) || amountNum <= 0) {
        console.warn('[realtime-sync] Ignoring deposit event with invalid amount:', {
            eventId: eventRow.id,
            eventType,
            userId,
            amount,
        });
        return;
    }

    const source = details.source || '';
    const variant = source === 'stripe_portal' ? 'parent' : 'admin';

    const user = getUserFromCache(userId);
    if (!user) {
        // Race condition: user not in cache yet. Queue for retry in 2 sec.
        const retryAt = Date.now() + 2000;
        pendingDepositEvents.set(userId, { event: eventRow, retryAt, amount, variant });
        console.log('[realtime-sync] DEPOSIT event queued (user not in cache):', userId);
        setTimeout(() => {
            const pending = pendingDepositEvents.get(userId);
            if (!pending) return;
            pendingDepositEvents.delete(userId);
            const retryUser = getUserFromCache(userId);
            if (retryUser) {
                processDepositEvent(eventRow);
            } else {
                console.warn('[realtime-sync] DEPOSIT event dropped (user still not in cache):', userId);
            }
        }, 2000);
        return;
    }

    const userName = user.name || 'Barn';
    const newBalance = typeof user.balance === 'number' ? user.balance : null;

    console.log('[realtime-sync] DEPOSIT event processed:', { userId, userName, amount: amountNum, variant, newBalance });
    showBalanceToast({
        userId,
        userName,
        delta: Math.abs(amountNum),
        newBalance,
        variant,
    });
}

/**
 * Subscribe to public.events INSERT for current institution; show toast on DEPOSIT events.
 */
function subscribeEvents(institutionId) {
    if (eventsChannel) {
        supabaseClient.removeChannel(eventsChannel);
        eventsChannel = null;
    }
    if (!institutionId) return;
    const filter = `institution_id=eq.${institutionId}`;
    eventsChannel = supabaseClient
        .channel(`events:${institutionId}`)
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'events', filter },
            (payload) => {
                const row = payload?.new;
                if (!row) return;
                console.log('[realtime-sync] events INSERT', row.event_type, row.id);
                processDepositEvent(row);
            }
        )
        .subscribe((status) => onEventsStatus(status));
}

function onVisibilityChange() {
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
    runThrottledFallback();
}

/**
 * Start realtime sync for current institution.
 * Call once after login when institution is set.
 * @param {Object} [opts]
 * @param {function} [opts.onBalanceMerged] - Called when balance was merged (e.g. to refresh selected-user box)
 */
export function startRealtimeSync(opts = {}) {
    const institutionId = getInstitutionId();
    if (!institutionId) {
        console.warn('[realtime-sync] startRealtimeSync: No institution ID, skipping');
        return;
    }
    subscribedInstitutionId = institutionId;
    eventsResubscribeCount = 0; // Reset retry count on fresh start
    subscribeUsers(institutionId);
    subscribeProducts(institutionId);
    subscribeEvents(institutionId);
    if (!visibilityBound) {
        visibilityBound = true;
        document.addEventListener('visibilitychange', onVisibilityChange);
    }
    // Debug helpers (safe in prod; used only from console)
    window.__flangoGetRealtimeStatus = getRealtimeStatus;
    console.log('[realtime-sync] Subscribed to users + products + events for institution', institutionId);
}

/**
 * Stop realtime sync (e.g. on logout).
 */
export function stopRealtimeSync() {
    if (usersChannel) {
        supabaseClient.removeChannel(usersChannel);
        usersChannel = null;
    }
    if (productsChannel) {
        supabaseClient.removeChannel(productsChannel);
        productsChannel = null;
    }
    if (eventsChannel) {
        supabaseClient.removeChannel(eventsChannel);
        eventsChannel = null;
    }
    if (eventsResubscribeTimer) {
        clearTimeout(eventsResubscribeTimer);
        eventsResubscribeTimer = null;
    }
    if (visibilityBound) {
        document.removeEventListener('visibilitychange', onVisibilityChange);
        visibilityBound = false;
    }
    pendingDepositEvents.clear();
    subscribedInstitutionId = null;
    lastRealtimeStatus = { users: null, products: null, events: null };
    if (typeof window !== 'undefined') {
        window.__flangoGetRealtimeStatus = null;
    }
    console.log('[realtime-sync] Stopped');
}

/**
 * Debug: current realtime status.
 */
export function getRealtimeStatus() {
    return { ...lastRealtimeStatus };
}
