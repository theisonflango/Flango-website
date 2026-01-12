// Simpelt state-modul for indkøbskurven (ingen UI/Supabase). Kan udvides senere.

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
    currentOrder = [];
    return currentOrder;
}

/**
 * Beregn total for den nuværende ordre (quantity default 1).
 * @returns {number} totalbeløb
 */
export function getOrderTotal() {
    return currentOrder.reduce((sum, line) => {
        const qty = Number.isFinite(line?.quantity) ? line.quantity : 1;
        const price = Number.isFinite(line?.price) ? line.price : 0;
        return sum + qty * price;
    }, 0);
}
