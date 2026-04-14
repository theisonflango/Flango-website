/**
 * Kitchen Panel — grid participant for the café app.
 * Occupies the same CSS Grid column as the calculator panel.
 * Toggle via body.kitchen-mode class (like calculator-mode).
 * Mutually exclusive with calculator mode.
 *
 * Reuses kitchen-cards.js for card rendering.
 */
import { supabaseClient } from '../core/config-and-supabase.js?v=3.0.79';
import { renderKitchenCard, updateAllCardTimes } from './kitchen-cards.js?v=3.0.79';
import { sortOrders } from './kitchen-sort.js?v=3.0.79';
import { initKitchenSound, playNewOrderSound } from './kitchen-sound.js?v=3.0.79';
import { showCustomAlert } from '../ui/sound-and-alerts.js?v=3.0.79';

let isOpen = false;
let institutionId = null;
let orders = [];
let realtimeChannel = null;
let timeTicker = null;
let panelEl = null;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Toggle the kitchen panel open/closed.
 * Uses body.kitchen-mode class for CSS Grid layout, like calculator-mode.
 */
export function toggleKitchenPanel(forceState) {
    const newState = typeof forceState === 'boolean' ? forceState : !isOpen;
    if (newState) {
        openPanel();
    } else {
        closePanel();
    }
}

/** Check if kitchen mode is active */
export function isKitchenModeActive() {
    return isOpen;
}

// Expose globally for the kitchen button handler in app-main.js
window.__flangoToggleKitchenPanel = toggleKitchenPanel;

// ─── Open / Close ────────────────────────────────────────────────────────────

async function openPanel() {
    institutionId = localStorage.getItem('flango_institution_id');

    // Try to get institution from global cache
    const instData = window.__flangoGetInstitutionById?.(institutionId);
    if (!instData?.restaurant_mode_enabled) {
        console.warn('[kitchen-panel] Restaurant mode not enabled');
        return;
    }

    panelEl = document.getElementById('kitchen-panel');
    if (!panelEl) return;

    // Mutual exclusion: close calculator if open
    if (document.body.classList.contains('calculator-mode')) {
        // Import dynamically to avoid circular deps
        const { toggleCalculatorMode } = await import('../ui/calculator-mode.js?v=3.0.79');
        toggleCalculatorMode(false);
    }

    // Init sound if configured
    const soundFile = instData.restaurant_sound || null;
    const serveSoundFile = instData.restaurant_serve_sound || null;
    initKitchenSound(
        soundFile ? `sounds/${soundFile}` : null,
        serveSoundFile ? `sounds/${serveSoundFile}` : null
    );

    isOpen = true;
    document.body.classList.add('kitchen-mode');

    // Update kitchen button active state
    const kitchenBtn = document.getElementById('kitchen-btn');
    if (kitchenBtn) {
        kitchenBtn.classList.add('active');
    }

    // Load orders
    await loadOrders();

    // Subscribe to realtime
    subscribeRealtime();

    // Time ticker
    timeTicker = setInterval(() => {
        updateAllCardTimes(panelEl.querySelector('.kitchen-panel-orders'));
    }, 15000);

    // Escape key
    document.addEventListener('keydown', onEscape);
}

function closePanel() {
    isOpen = false;
    document.body.classList.remove('kitchen-mode');

    // Update kitchen button active state
    const kitchenBtn = document.getElementById('kitchen-btn');
    if (kitchenBtn) {
        kitchenBtn.classList.remove('active');
    }

    // Cleanup
    if (realtimeChannel) {
        supabaseClient.removeChannel(realtimeChannel);
        realtimeChannel = null;
    }
    if (timeTicker) {
        clearInterval(timeTicker);
        timeTicker = null;
    }

    document.removeEventListener('keydown', onEscape);
    orders = [];
}

function onEscape(e) {
    if (e.key === 'Escape') closePanel();
}

// ─── Data loading ────────────────────────────────────────────────────────────

async function loadOrders() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: sales, error } = await supabaseClient
        .from('sales')
        .select(`
            id, created_at, customer_id, table_number, kitchen_note,
            kitchen_served, kitchen_served_at, total_amount,
            sale_items (
                id, product_id, quantity, price_at_purchase,
                item_variant, item_note,
                products:product_id ( name, emoji, icon_url, icon_storage_path )
            ),
            users:customer_id ( name )
        `)
        .eq('institution_id', institutionId)
        .eq('is_restaurant_order', true)
        .gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[kitchen-panel] Error loading orders:', error);
        return;
    }

    orders = (sales || []).map(normalizeSale);
    renderOrders();
}

function normalizeSale(sale) {
    const items = (sale.sale_items || []).map(si => ({
        name: si.products?.name || 'Produkt',
        emoji: si.products?.emoji || '🍽️',
        icon_url: si.products?.icon_url || null,
        icon_storage_path: si.products?.icon_storage_path || null,
        quantity: si.quantity || 1,
        item_variant: si.item_variant || null,
        item_note: si.item_note || null,
    }));

    return {
        id: sale.id,
        created_at: sale.created_at,
        customer_id: sale.customer_id,
        customer_name: sale.users?.name || 'Ukendt kunde',
        table_number: sale.table_number,
        kitchen_note: sale.kitchen_note,
        kitchen_served: sale.kitchen_served || false,
        kitchen_served_at: sale.kitchen_served_at,
        items,
    };
}

// ─── Rendering ───────────────────────────────────────────────────────────────

function renderOrders() {
    if (!panelEl) return;

    const container = panelEl.querySelector('.kitchen-panel-orders');
    if (!container) return;

    const activeCount = orders.filter(o => !o.kitchen_served).length;

    // Update count badge
    const countEl = panelEl.querySelector('.kitchen-panel-count');
    if (countEl) countEl.textContent = activeCount;

    container.innerHTML = '';

    if (orders.length === 0) {
        container.innerHTML = '<div class="kitchen-panel-empty">Ingen ordrer i dag</div>';
        return;
    }

    // Single FIFO list — served orders keep their position (just dimmed)
    const sorted = sortOrders(orders, 'fifo');

    for (const sale of sorted) {
        const row = renderKitchenCard(sale, true);

        // Serve button
        const serveBtn = row.querySelector('.krc-serve');
        if (serveBtn) {
            serveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                markServed(sale.id);
            });
        }

        // Click served row → unserve
        if (sale.kitchen_served) {
            row.addEventListener('click', () => confirmUnserve(sale));
            row.style.cursor = 'pointer';
        }

        container.appendChild(row);
    }
}

// ─── Serve / Unserve ─────────────────────────────────────────────────────────

async function markServed(saleId) {
    const order = orders.find(o => o.id === saleId);
    if (!order) return;
    order.kitchen_served = true;
    order.kitchen_served_at = new Date().toISOString();
    renderOrders();

    const { error } = await supabaseClient.rpc('mark_sale_served', {
        p_sale_id: saleId,
        p_institution_id: institutionId,
    });
    if (error) {
        order.kitchen_served = false;
        order.kitchen_served_at = null;
        renderOrders();
    }
}

async function confirmUnserve(sale) {
    if (!await showCustomAlert('Bekræft', `Markér "${sale.customer_name}" som IKKE serveret?`, 'confirm')) return;
    unmarkServed(sale.id);
}

async function unmarkServed(saleId) {
    const order = orders.find(o => o.id === saleId);
    if (!order) return;
    order.kitchen_served = false;
    order.kitchen_served_at = null;
    renderOrders();

    const { error } = await supabaseClient.rpc('unmark_sale_served', {
        p_sale_id: saleId,
        p_institution_id: institutionId,
    });
    if (error) {
        order.kitchen_served = true;
        order.kitchen_served_at = new Date().toISOString();
        renderOrders();
    }
}

// ─── Realtime ────────────────────────────────────────────────────────────────

function subscribeRealtime() {
    if (realtimeChannel) {
        supabaseClient.removeChannel(realtimeChannel);
    }

    realtimeChannel = supabaseClient
        .channel('kitchen-panel-sales')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'sales',
            filter: `institution_id=eq.${institutionId}`,
        }, handleInsert)
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'sales',
            filter: `institution_id=eq.${institutionId}`,
        }, handleUpdate)
        .on('postgres_changes', {
            event: 'DELETE',
            schema: 'public',
            table: 'sales',
            filter: `institution_id=eq.${institutionId}`,
        }, handleDelete)
        .subscribe();
}

async function handleInsert(payload) {
    const newSale = payload.new;
    if (!newSale?.id || !newSale.is_restaurant_order) return; // Ignorér ikke-restaurant ordrer
    if (orders.some(o => o.id === newSale.id)) return;

    const { data: fullSale } = await supabaseClient
        .from('sales')
        .select(`
            id, created_at, customer_id, table_number, kitchen_note,
            kitchen_served, kitchen_served_at, total_amount,
            sale_items (
                id, product_id, quantity, price_at_purchase,
                item_variant, item_note,
                products:product_id ( name, emoji, icon_url, icon_storage_path )
            ),
            users:customer_id ( name )
        `)
        .eq('id', newSale.id)
        .single();

    if (!fullSale) return;

    orders.push(normalizeSale(fullSale));
    renderOrders();
    playNewOrderSound();
}

function handleUpdate(payload) {
    const updated = payload.new;
    if (!updated?.id) return;
    const idx = orders.findIndex(o => o.id === updated.id);
    if (idx === -1) return;
    orders[idx].table_number = updated.table_number;
    orders[idx].kitchen_note = updated.kitchen_note;
    orders[idx].kitchen_served = updated.kitchen_served || false;
    orders[idx].kitchen_served_at = updated.kitchen_served_at;
    renderOrders();
}

function handleDelete(payload) {
    const old = payload.old;
    if (!old?.id) return;
    orders = orders.filter(o => o.id !== old.id);
    renderOrders();
}
