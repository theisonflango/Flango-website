// Enkel session-store for café-køb: holder styr på nuværende kunde og seneste evaluering.
// Ingen sideeffekter på Supabase eller UI; bruges kun som central kilde til balance/overtræk-data.
import { invalidateChildLimitSnapshot } from './products-and-cart.js';
import { supabaseClient } from '../core/config-and-supabase.js';

let currentCustomer = null;
let lastEvaluation = null;

async function loadChildAllergyPolicy(childId) {
    try {
        const { data, error } = await supabaseClient
            .from('child_allergen_settings')
            .select('allergen, policy')
            .eq('child_id', childId);

        if (error) {
            console.warn('[allergies] fetch error:', error.message);
            currentCustomer.allergyPolicy = {};
            return;
        }

        const map = {};
        (data || []).forEach(row => {
            map[row.allergen] = row.policy;
        });
        currentCustomer.allergyPolicy = map;
    } catch (err) {
        console.error('[allergies] unexpected error:', err);
        if (currentCustomer) {
            currentCustomer.allergyPolicy = {};
        }
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
 * Nulstil kun den valgte kunde (og evaluering).
 */
export function clearCurrentCustomer() {
    currentCustomer = null;
    lastEvaluation = null;
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

    // Overtræksgrænse med fallback (legacy -10 eller hvad du bruger)
    const overdraftLimit = evalOverdraftLimit !== null ? evalOverdraftLimit : -10;

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
