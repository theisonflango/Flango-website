// Enkel session-store for café-køb: holder styr på nuværende kunde og seneste evaluering.
// Ingen sideeffekter på Supabase eller UI; bruges kun som central kilde til balance/overtræk-data.
import { invalidateChildLimitSnapshot } from './products-and-cart.js';
import { supabaseClient } from '../core/config-and-supabase.js';
import { OVERDRAFT_LIMIT } from '../core/constants.js';

let currentCustomer = null;
let lastEvaluation = null;
let selectionToken = 0; // Race protection: increments on each user selection/clear

// ============================================================================
// ALLERGEN CACHE - undgår gentagne DB-kald for samme barn
// ============================================================================
const allergenCache = new Map(); // childId → { data, timestamp }
const ALLERGEN_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutter (ændres sjældent)

async function loadChildAllergyPolicy(childId) {
    const tokenAtStart = selectionToken;
    try {
        const assignIfStillSelected = (policy) => {
            if (!currentCustomer) return;
            if (String(currentCustomer.id) !== String(childId)) return;
            // Guard against fast user-switch while the fetch is in flight
            if (selectionToken !== tokenAtStart) return;
            currentCustomer.allergyPolicy = policy;
        };

        // OPTIMERING: Check cache først
        const cached = allergenCache.get(childId);
        if (cached && Date.now() - cached.timestamp < ALLERGEN_CACHE_TTL_MS) {
            assignIfStillSelected(cached.data);
            return;
        }

        const { data, error } = await supabaseClient
            .from('child_allergen_settings')
            .select('allergen, policy')
            .eq('child_id', childId);

        if (error) {
            console.warn('[allergies] fetch error:', error.message);
            assignIfStillSelected({});
            return;
        }

        const map = {};
        (data || []).forEach(row => {
            map[row.allergen] = row.policy;
        });

        // Gem i cache
        allergenCache.set(childId, { data: map, timestamp: Date.now() });
        assignIfStillSelected(map);
    } catch (err) {
        console.error('[allergies] unexpected error:', err);
        if (currentCustomer && String(currentCustomer.id) === String(childId) && selectionToken === tokenAtStart) {
            currentCustomer.allergyPolicy = {};
        }
    }
}

// Eksporter funktion til at invalidere cache (hvis forælder ændrer indstillinger)
export function invalidateAllergenCache(childId = null) {
    if (childId) {
        allergenCache.delete(childId);
    } else {
        allergenCache.clear();
    }
}

const safeNumber = (value, fallback = null) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
};

/**
 * Hent nuværende kundes saldo (før køb).
 * @returns {number|null}
 */
export function getCurrentBalance() {
    return safeNumber(currentCustomer?.balance, null);
}

/**
 * Sæt/overskriv hele currentCustomer-objektet.
 * @param {Object|null} customer
 */
export function setCurrentCustomer(customer) {
    currentCustomer = customer || null;
    selectionToken++; // Increment token on each selection change
    // Mirror to window global for backward compatibility
    if (typeof window !== 'undefined') {
        window.__flangoCurrentCustomer = currentCustomer;
    }
    if (customer?.id) {
        loadChildAllergyPolicy(customer.id);
    }
    if (customer) {
        invalidateChildLimitSnapshot();
    }
}

/**
 * Hent nuværende kunde-objekt.
 * @returns {Object|null}
 */
export function getCurrentCustomer() {
    return currentCustomer;
}

/**
 * Hent nuværende selection token (for race protection).
 * @returns {number}
 */
export function getSelectionToken() {
    return selectionToken;
}

/**
 * Nulstil kun den valgte kunde (og evaluering).
 */
export function clearCurrentCustomer() {
    currentCustomer = null;
    lastEvaluation = null;
    selectionToken++; // Increment token on clear (user deselected)
    // Clear window global mirror
    if (typeof window !== 'undefined') {
        window.__flangoCurrentCustomer = null;
    }
}

/**
 * Opdater kundens saldo i sessionen.
 * @param {number} newBalance
 * @returns {number|null} den anvendte balance eller null hvis ikke sat
 */
export function setCustomerBalance(newBalance) {
    const num = safeNumber(newBalance, null);
    if (currentCustomer && num !== null) {
        currentCustomer.balance = num;
        return currentCustomer.balance;
    }
    return null;
}

/**
 * Nulstil seneste evaluering (fx når kurven ændres).
 */
export function clearEvaluation() {
    lastEvaluation = null;
}

/**
 * Gem seneste evaluering af et køb (uden at mutere saldo).
 * @param {Object|null} evaluation
 */
export function applyEvaluation(evaluation) {
    lastEvaluation = evaluation || null;
    // Hvis backend allerede sender en opdateret customer, kan vi gemme den,
    // men stadig uden at ændre på balance direkte her.
    if (evaluation?.customer) {
        currentCustomer = evaluation.customer;
    }
}

/**
 * Hent seneste evaluation-objekt.
 * @returns {Object|null}
 */
export function getLastEvaluation() {
    return lastEvaluation;
}

/**
 * Reset hele sessionen (kunde + evaluering).
 */
export function resetCafeSession() {
    currentCustomer = null;
    lastEvaluation = null;
}

/**
 * Beregn finansiel status for en ordre baseret på seneste evaluering og evt. fallback.
 * @param {number} orderTotal
 * @returns {Object} { balance, total, newBalance, overdraftBreached, availableUntilLimit }
 */
export function getFinancialState(orderTotal) {
    const total = safeNumber(orderTotal, 0);

    // balance før købet
    const balance = getCurrentBalance();
    const fallbackBalance = balance !== null ? balance : 0;

    // Data fra seneste evaluation
    const evalNewBalance = safeNumber(lastEvaluation?.newBalance, null);
    const evalMsgs = lastEvaluation?.messages || {};
    const evalOverdraftLimit = safeNumber(evalMsgs.overdraftLimit, null);
    const evalAvailableUntilLimit = safeNumber(evalMsgs.availableUntilLimit, null);

    // Overtræksgrænse med fallback
    const overdraftLimit = evalOverdraftLimit !== null ? evalOverdraftLimit : OVERDRAFT_LIMIT;

    // Primær kilde: evaluation.newBalance, ellers fallback: balance - total
    let newBalance = evalNewBalance !== null ? evalNewBalance : fallbackBalance - total;
    if (!Number.isFinite(newBalance)) {
        newBalance = fallbackBalance - total;
    }

    // Overtræk-beslutning
    let overdraftBreached;
    if (typeof evalMsgs.overdraftBreached === 'boolean') {
        overdraftBreached = evalMsgs.overdraftBreached;
    } else {
        overdraftBreached = newBalance < overdraftLimit;
    }

    // Hvor meget er der tilbage før grænsen rammes?
    let availableUntilLimit;
    if (evalAvailableUntilLimit !== null) {
        availableUntilLimit = evalAvailableUntilLimit;
    } else if (Number.isFinite(fallbackBalance)) {
        availableUntilLimit = fallbackBalance - overdraftLimit;
    } else {
        availableUntilLimit = null;
    }

    return {
        balance,
        total,
        newBalance,
        overdraftBreached,
        availableUntilLimit,
    };
}
