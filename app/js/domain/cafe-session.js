// Ansvar: Beregninger og regler for en café-session (køb, saldo, item-oversigt).
// UI-håndtering og Supabase-adgang ligger i andre moduler.

// Shadow-evaluering: bruges kun til logging/diagnostik; styrer ikke købsflowet endnu.

const safeNumber = (value, fallback = 0) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
};

/**
 * Evaluér et køb i caféen. Dette er en neutral, ren domænefunktion til shadow-evaluering.
 *
 * @param {Object} input
 * @param {Object|null} input.customer - Aktuel kunde (kan være null/undefined).
 * @param {number|null} input.currentBalance - Nuværende saldo (kan være null).
 * @param {Array} input.orderItems - Linjer i ordren; kan være tom eller manglende.
 * @param {Array} input.products - Produkter i sortimentet.
 * @param {number} input.maxOverdraft - Tilladt overtræk (default 0).
 * @returns {Object} Shadow-evaluering: { ok, reason, total, newBalance, itemsSummary, messages, customer, maxOverdraft, products }
 */
export function evaluatePurchase(input = {}) {
    const {
        customer = null,
        currentBalance = null,
        orderItems = [],
        products = [],
        maxOverdraft = 0,
    } = input;

    const orderArray = Array.isArray(orderItems) ? orderItems : [];

    const total = orderArray.reduce((sum, line) => {
        const qty = safeNumber(line?.quantity, 1);
        const price = safeNumber(line?.price, 0);
        return sum + qty * price;
    }, 0);

    const currentBalanceNumber = safeNumber(currentBalance, 0);
    const newBalance = currentBalanceNumber - total;

    const byId = {};
    orderArray.forEach((item) => {
        const id = item?.id;
        const price = safeNumber(item?.price, 0);
        const quantity = safeNumber(item?.quantity, 1);
        if (!byId[id]) {
            byId[id] = {
                productId: id,
                name: item?.name || '',
                quantity: 0,
                price,
                amount: 0,
            };
        }
        byId[id].quantity += quantity;
        byId[id].amount += price * quantity;
    });
    const itemsSummary = Object.values(byId);

    const overdraftLimit = Number.isFinite(maxOverdraft) ? maxOverdraft : 0;
    const overdraftBreached = newBalance < overdraftLimit;
    const availableUntilLimit = currentBalanceNumber - overdraftLimit;

    return {
        ok: true,
        reason: null,
        total,
        newBalance,
        itemsSummary,
        messages: {
            hasCustomer: !!customer,
            hasItems: orderArray.length > 0,
            overdraftBreached,
            availableUntilLimit,
            overdraftLimit,
        },
        customer,
        maxOverdraft,
        products,
    };
}
