/**
 * Kitchen order sorting logic.
 * Two modes: FIFO (oldest first) and table-grouped.
 */

/**
 * Sort orders.
 * @param {Array} orders
 * @param {'fifo'|'table'} mode
 * @returns {Array} sorted copy (does not mutate input)
 */
export function sortOrders(orders, mode = 'fifo') {
    const sorted = [...orders];
    if (mode === 'fifo') {
        // Oldest first (FIFO)
        sorted.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    } else if (mode === 'table') {
        // Group by table_number, then FIFO within each group
        sorted.sort((a, b) => {
            const tA = a.table_number || '';
            const tB = b.table_number || '';
            // Tables with numbers first, then empty/null last
            if (tA && !tB) return -1;
            if (!tA && tB) return 1;
            if (tA !== tB) return tA.localeCompare(tB, 'da');
            return new Date(a.created_at) - new Date(b.created_at);
        });
    }
    return sorted;
}

/**
 * Sort orders by column and direction.
 * Used by the standalone kitchen view (restaurant.html).
 * @param {Array} orders
 * @param {{ column: string, direction: 'asc'|'desc' }} sortConfig
 * @returns {Array} sorted copy
 */
export function sortOrdersByColumn(orders, sortConfig) {
    const { column, direction } = sortConfig;
    const dir = direction === 'desc' ? -1 : 1;
    const sorted = [...orders];

    sorted.sort((a, b) => {
        let cmp = 0;
        switch (column) {
            case 'time':
                cmp = new Date(a.created_at) - new Date(b.created_at);
                break;
            case 'customer':
                cmp = (a.customer_name || '').localeCompare(b.customer_name || '', 'da');
                break;
            case 'table': {
                const tA = a.table_number || '';
                const tB = b.table_number || '';
                if (!tA && tB) cmp = 1;
                else if (tA && !tB) cmp = -1;
                else cmp = tA.localeCompare(tB, 'da');
                break;
            }
            case 'items':
                cmp = (a.items?.length || 0) - (b.items?.length || 0);
                break;
            case 'amount':
                cmp = (Number(a.total_amount) || 0) - (Number(b.total_amount) || 0);
                break;
            case 'server': {
                const sA = a.clerk_name || a.admin_name || '';
                const sB = b.clerk_name || b.admin_name || '';
                cmp = sA.localeCompare(sB, 'da');
                break;
            }
            case 'served':
                cmp = (a.kitchen_served ? 1 : 0) - (b.kitchen_served ? 1 : 0);
                break;
            default:
                cmp = new Date(a.created_at) - new Date(b.created_at);
        }
        return cmp * dir;
    });
    return sorted;
}

/**
 * Group orders by table number for rendering with headers.
 * @param {Array} orders (should be pre-sorted by table mode)
 * @returns {Array<{header: string|null, orders: Array}>}
 */
export function groupByTable(orders) {
    const groups = [];
    let currentTable = undefined;

    for (const order of orders) {
        const table = order.table_number || null;
        if (table !== currentTable) {
            currentTable = table;
            const count = orders.filter(o => (o.table_number || null) === table).length;
            groups.push({
                header: table ? `Bord ${table} (${count} ${count === 1 ? 'ordre' : 'ordrer'})` : `Intet bordnummer (${count})`,
                orders: [],
            });
        }
        groups[groups.length - 1].orders.push(order);
    }
    return groups;
}
