// Simpelt state-modul for indkøbskurven (ingen UI/Supabase). Kan udvides senere.
import { calculateOrderTotal } from './products-and-cart.js';
import { logDebugEvent } from '../core/debug-flight-recorder.js';

let currentOrder = [];

/**
 * Initier ordre-state med en liste af items.
 * @param {Array} initialItems
 * @returns {Array} Den nye ordre (array)
 */
export function initOrderStore(initialItems = []) {
    currentOrder = Array.isArray(initialItems) ? [...initialItems] : [];
    return currentOrder;
}

/**
 * Hent nuværende ordre.
 * @returns {Array} currentOrder
 */
export function getOrder() {
    return currentOrder;
}

/**
 * Sæt ordre til en ny liste af items.
 * @param {Array} items
 * @returns {Array} Den nye ordre (array)
 */
export function setOrder(items) {
    const prevLen = currentOrder?.length || 0;
    const newLen = Array.isArray(items) ? items.length : 0;
    // Flight recorder: only log significant changes
    if (prevLen !== newLen) {
        logDebugEvent('order_store_set', { prevLen, newLen });
    }
    currentOrder = Array.isArray(items) ? [...items] : [];
    return currentOrder;
}

/**
 * Tilføj et item til ordren.
 * @param {Object} item
 * @returns {Array} Den opdaterede ordre (array)
 */
export function addItem(item) {
    currentOrder.push(item);
    return currentOrder;
}

/**
 * Fjern item ved et givent index.
 * @param {number} index
 * @returns {Array} Den opdaterede ordre (array)
 */
export function removeItemAt(index) {
    if (Number.isInteger(index) && index >= 0 && index < currentOrder.length) {
        currentOrder.splice(index, 1);
    }
    return currentOrder;
}

/**
 * Ryd hele ordren.
 * @returns {Array} Tom ordre (array)
 */
export function clearOrder() {
    const prevLen = currentOrder?.length || 0;
    if (prevLen > 0) {
        logDebugEvent('order_store_cleared', { prevLen });
    }
    currentOrder = [];
    return currentOrder;
}

/**
 * Beregn total for den nuværende ordre (quantity default 1).
 * @returns {number} totalbeløb
 */
export function getOrderTotal() {
    return calculateOrderTotal(currentOrder);
}
