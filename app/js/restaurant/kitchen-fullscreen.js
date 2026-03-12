/**
 * Kitchen Fullscreen — fullscreen kitchen overlay within the POS app.
 * Opens via longpress on the kitchen button in the header.
 * No separate auth — reuses the POS session.
 *
 * Reuses:
 *   - kitchen-cards.js  → renderKitchenCard (table rows, compact=false)
 *   - kitchen-sort.js   → sortOrdersByColumn
 *   - kitchen-sound.js  → sounds, mute toggle, settings
 *   - config-and-supabase.js → supabaseClient
 */
import { supabaseClient } from '../core/config-and-supabase.js';
import { escapeHtml } from '../core/escape-html.js';
import { renderKitchenCard, updateAllCardTimes } from './kitchen-cards.js';
import { sortOrdersByColumn } from './kitchen-sort.js';
import {
    initKitchenSound, playNewOrderSound, playServeSound,
    toggleMute, isSoundMuted,
    setOrderSound, setServeSound, getOrderSoundFile, getServeSoundFile,
} from './kitchen-sound.js';

let isOpen = false;
let institutionId = null;
let allOrders = [];
let realtimeChannel = null;
let timeTicker = null;
let overlayEl = null;

// Sort state (separate from standalone view)
let columnSort = JSON.parse(localStorage.getItem('flango_kitchen_fs_sort') || 'null') || { column: 'time', direction: 'asc' };

// Served layout
let servedPosition = localStorage.getItem('flango_kitchen_fs_served_pos') || 'merged';

const $ = (sel) => overlayEl?.querySelector(sel);

// ─── Public API ──────────────────────────────────────────────────────────────

export function toggleKitchenFullscreen() {
    if (isOpen) {
        closeFullscreen();
    } else {
        openFullscreen();
    }
}

export function isKitchenFullscreenActive() {
    return isOpen;
}

// Expose globally for app-main.js
window.__flangoToggleKitchenFullscreen = toggleKitchenFullscreen;

// ─── Open / Close ────────────────────────────────────────────────────────────

async function openFullscreen() {
    institutionId = localStorage.getItem('flango_institution_id');

    const instData = window.__flangoGetInstitutionById?.(institutionId);
    if (!instData?.restaurant_mode_enabled) {
        console.warn('[kitchen-fs] Restaurant mode not enabled');
        return;
    }

    // Close inline panel if open
    if (typeof window.__flangoToggleKitchenPanel === 'function') {
        const { isKitchenModeActive } = await import('./kitchen-inline-panel.js');
        if (isKitchenModeActive()) {
            window.__flangoToggleKitchenPanel(false);
        }
    }

    // Close calculator if open
    if (document.body.classList.contains('calculator-mode')) {
        const { toggleCalculatorMode } = await import('../ui/calculator-mode.js');
        toggleCalculatorMode(false);
    }

    // Init sound
    const soundFile = instData.restaurant_sound || null;
    const serveSoundFile = instData.restaurant_serve_sound || null;
    initKitchenSound(
        soundFile ? `sounds/${soundFile}` : null,
        serveSoundFile ? `sounds/${serveSoundFile}` : null
    );

    // Build overlay
    overlayEl = buildOverlay(instData);
    document.body.appendChild(overlayEl);

    isOpen = true;
    document.body.classList.add('kitchen-fullscreen-mode');

    // Wire up controls
    setupControls();
    applyServedLayout();

    // Load orders
    await loadOrders();

    // Subscribe realtime
    subscribeRealtime();

    // Time ticker
    timeTicker = setInterval(() => {
        updateAllCardTimes($('#kfs-active-orders'));
    }, 15000);

    // Escape key
    document.addEventListener('keydown', onEscape);
}

function closeFullscreen() {
    isOpen = false;
    document.body.classList.remove('kitchen-fullscreen-mode');

    if (realtimeChannel) {
        supabaseClient.removeChannel(realtimeChannel);
        realtimeChannel = null;
    }
    if (timeTicker) {
        clearInterval(timeTicker);
        timeTicker = null;
    }

    document.removeEventListener('keydown', onEscape);

    if (overlayEl) {
        overlayEl.remove();
        overlayEl = null;
    }

    allOrders = [];
}

function onEscape(e) {
    if (e.key === 'Escape') closeFullscreen();
}

// ─── Build overlay DOM ───────────────────────────────────────────────────────

function buildOverlay(instData) {
    const el = document.createElement('div');
    el.id = 'kitchen-fullscreen-overlay';
    el.className = 'kitchen-fullscreen-overlay';

    const instName = instData?.name || localStorage.getItem('flango_institution_name') || '';

    el.innerHTML = `
        <header class="kfs-header">
            <div class="kfs-header-left">
                <span class="kfs-logo">🍽️</span>
                <span class="kfs-title">Køkkenskærm</span>
                <span class="kfs-divider">·</span>
                <span class="kfs-inst-name">${escapeHtml(instName)}</span>
            </div>
            <div class="kfs-header-center">
                <div class="kfs-stat-group">
                    <div class="kfs-stat kfs-stat-active">
                        <span id="kfs-order-count" class="kfs-stat-number">0</span>
                        <span class="kfs-stat-label">aktive</span>
                    </div>
                    <div class="kfs-stat kfs-stat-total">
                        <span id="kfs-total-orders" class="kfs-stat-number">0</span>
                        <span class="kfs-stat-label">i dag</span>
                    </div>
                    <div class="kfs-stat kfs-stat-revenue">
                        <span id="kfs-daily-revenue" class="kfs-stat-number">0 kr</span>
                        <span class="kfs-stat-label">omsætning</span>
                    </div>
                </div>
            </div>
            <div class="kfs-header-right">
                <button id="kfs-settings-btn" class="kfs-ctrl-btn" title="Lydindstillinger">⚙️</button>
                <button id="kfs-sound-btn" class="kfs-ctrl-btn" title="Lyd">🔊</button>
                <button id="kfs-served-toggle" class="kfs-ctrl-btn" title="Serveret">☰ Samlet</button>
                <button id="kfs-back-btn" class="kfs-ctrl-btn kfs-ctrl-back" title="Tilbage til café">← Café</button>
            </div>
        </header>
        <div class="kfs-content layout-merged">
            <div id="kfs-active-zone" class="kfs-zone kfs-zone-active">
                <div class="kfs-zone-header">
                    <h2>Aktive ordrer</h2>
                </div>
                <div id="kfs-active-orders" class="kfs-orders-container"></div>
            </div>
            <div id="kfs-served-zone" class="kfs-zone kfs-zone-served">
                <div class="kfs-zone-header">
                    <h2>Serveret</h2>
                </div>
                <div id="kfs-served-orders" class="kfs-orders-container"></div>
            </div>
        </div>
    `;

    return el;
}

// ─── Controls ────────────────────────────────────────────────────────────────

function setupControls() {
    // Back button
    $('#kfs-back-btn')?.addEventListener('click', closeFullscreen);

    // Sound toggle
    $('#kfs-sound-btn')?.addEventListener('click', () => {
        const muted = toggleMute();
        const btn = $('#kfs-sound-btn');
        btn.textContent = muted ? '🔇' : '🔊';
        btn.title = muted ? 'Lyd slået fra' : 'Lyd slået til';
    });
    const soundBtn = $('#kfs-sound-btn');
    if (soundBtn) soundBtn.textContent = isSoundMuted() ? '🔇' : '🔊';

    // Served position toggle (4-state cycle)
    $('#kfs-served-toggle')?.addEventListener('click', () => {
        const positions = ['bottom', 'side', 'hidden', 'merged'];
        const idx = positions.indexOf(servedPosition);
        servedPosition = positions[(idx + 1) % positions.length];
        localStorage.setItem('flango_kitchen_fs_served_pos', servedPosition);
        applyServedLayout();
        renderOrders();
    });

    // Settings
    $('#kfs-settings-btn')?.addEventListener('click', toggleSettingsOverlay);
}

// ─── Served layout ───────────────────────────────────────────────────────────

function applyServedLayout() {
    const content = overlayEl?.querySelector('.kfs-content');
    const servedZone = $('#kfs-served-zone');
    const activeHeader = $('#kfs-active-zone .kfs-zone-header');
    const btn = $('#kfs-served-toggle');
    if (!content) return;

    let effectivePos = servedPosition;
    if (effectivePos === 'side' && window.innerWidth < 900) {
        effectivePos = 'bottom';
    }

    content.classList.remove('layout-bottom', 'layout-side', 'layout-hidden', 'layout-merged');
    content.classList.add(`layout-${effectivePos}`);

    if (servedZone) {
        servedZone.style.display = (effectivePos === 'hidden' || effectivePos === 'merged') ? 'none' : '';
    }

    if (activeHeader) {
        activeHeader.style.display = effectivePos === 'merged' ? 'none' : '';
    }

    const labels = { bottom: '⬇ Bund', side: '➡ Side', hidden: '👁 Skjult', merged: '☰ Samlet' };
    if (btn) {
        btn.textContent = labels[servedPosition] || 'Serveret';
        btn.title = `Serveret: ${servedPosition}`;
    }
}

// ─── Data loading ────────────────────────────────────────────────────────────

async function loadOrders() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: sales, error } = await supabaseClient
        .from('sales')
        .select(`
            id, created_at, customer_id, clerk_user_id, admin_user_id,
            table_number, kitchen_note,
            kitchen_served, kitchen_served_at, total_amount,
            sale_items (
                id, product_id, quantity, price_at_purchase,
                item_variant, item_note,
                products:product_id ( name, emoji, icon_url )
            ),
            users:customer_id ( name ),
            clerk:clerk_user_id ( name ),
            admin:admin_user_id ( name )
        `)
        .eq('institution_id', institutionId)
        .gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[kitchen-fs] Error loading orders:', error);
        return;
    }

    allOrders = (sales || []).map(normalizeSale);
    updateStats();
    renderOrders();
}

function normalizeSale(sale) {
    const items = (sale.sale_items || []).map(si => ({
        name: si.products?.name || 'Produkt',
        emoji: si.products?.emoji || '🍽️',
        icon_url: si.products?.icon_url || null,
        quantity: si.quantity || 1,
        unit_price: si.price_at_purchase,
        item_variant: si.item_variant || null,
        item_note: si.item_note || null,
    }));

    return {
        id: sale.id,
        created_at: sale.created_at,
        customer_id: sale.customer_id,
        customer_name: sale.users?.name || 'Ukendt kunde',
        clerk_name: sale.clerk?.name || null,
        admin_name: sale.admin?.name || null,
        table_number: sale.table_number,
        kitchen_note: sale.kitchen_note,
        kitchen_served: sale.kitchen_served || false,
        kitchen_served_at: sale.kitchen_served_at,
        total_amount: sale.total_amount,
        items,
    };
}

// ─── Rendering ───────────────────────────────────────────────────────────────

function renderOrders() {
    const activeContainer = $('#kfs-active-orders');
    const servedContainer = $('#kfs-served-orders');
    if (!activeContainer) return;

    // Merged mode
    if (servedPosition === 'merged') {
        activeContainer.innerHTML = '';
        if (servedContainer) servedContainer.innerHTML = '';

        if (allOrders.length === 0) {
            activeContainer.innerHTML = '<div class="kitchen-empty">Ingen ordrer i dag</div>';
        } else {
            const sorted = sortOrdersByColumn(allOrders, columnSort);
            const table = buildTable(sorted, false, true);
            activeContainer.appendChild(table);
        }

        updateStats();
        requestAnimationFrame(() => fitToViewport());
        return;
    }

    // Split mode
    const active = allOrders.filter(o => !o.kitchen_served);
    const served = allOrders.filter(o => o.kitchen_served);

    const sortedActive = sortOrdersByColumn(active, columnSort);
    const sortedServed = [...served].sort((a, b) =>
        new Date(b.kitchen_served_at || b.created_at) - new Date(a.kitchen_served_at || a.created_at)
    );

    activeContainer.innerHTML = '';
    if (sortedActive.length === 0) {
        activeContainer.innerHTML = '<div class="kitchen-empty">Ingen aktive ordrer 🎉</div>';
    } else {
        activeContainer.appendChild(buildTable(sortedActive, false, false));
    }

    if (servedContainer) {
        servedContainer.innerHTML = '';
        if (sortedServed.length === 0) {
            servedContainer.innerHTML = '<div class="kitchen-empty">Ingen serverede ordrer endnu</div>';
        } else {
            servedContainer.appendChild(buildTable(sortedServed, true, false));
        }
    }

    updateStats();
    requestAnimationFrame(() => fitToViewport());
}

function buildTable(orders, isServed, isMerged) {
    const table = document.createElement('table');
    table.className = 'kitchen-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    const columns = [
        { key: 'time', label: 'Tid' },
        { key: 'customer', label: 'Kunde' },
        { key: 'table', label: 'Bord' },
        { key: 'items', label: 'Bestilling' },
        { key: 'amount', label: 'Beløb' },
        { key: 'server', label: 'Ekspedient' },
        { key: 'served', label: isServed ? '' : 'Handling' },
    ];

    const sortable = !isServed;
    for (const col of columns) {
        const th = document.createElement('th');
        th.className = col.key ? `kitchen-th-${col.key}` : '';

        if (col.key && sortable) {
            th.style.cursor = 'pointer';
            th.dataset.sortColumn = col.key;

            let indicator = '';
            if (columnSort.column === col.key) {
                indicator = columnSort.direction === 'asc' ? ' ▲' : ' ▼';
                th.classList.add('sort-active');
            }
            th.textContent = col.label + indicator;

            th.addEventListener('click', () => {
                if (columnSort.column === col.key) {
                    columnSort.direction = columnSort.direction === 'asc' ? 'desc' : 'asc';
                } else {
                    columnSort.column = col.key;
                    columnSort.direction = 'asc';
                }
                localStorage.setItem('flango_kitchen_fs_sort', JSON.stringify(columnSort));
                renderOrders();
            });
        } else {
            th.textContent = col.label;
        }
        headerRow.appendChild(th);
    }

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const sale of orders) {
        const row = renderKitchenCard(sale, false); // table row mode

        const serveBtn = row.querySelector('.kitchen-serve-btn');
        if (serveBtn) {
            serveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                markServed(sale.id);
            });
        }

        if (sale.kitchen_served) {
            row.style.cursor = 'pointer';
            row.title = 'Klik for at markere som ikke-serveret';
            row.addEventListener('click', () => confirmUnserve(sale));
        }

        tbody.appendChild(row);
    }

    table.appendChild(tbody);
    return table;
}

// ─── Stats ───────────────────────────────────────────────────────────────────

function updateStats() {
    const activeCount = allOrders.filter(o => !o.kitchen_served).length;
    const countEl = $('#kfs-order-count');
    if (countEl) countEl.textContent = activeCount;

    const totalEl = $('#kfs-total-orders');
    if (totalEl) totalEl.textContent = allOrders.length;

    const revenue = allOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
    const revenueEl = $('#kfs-daily-revenue');
    if (revenueEl) revenueEl.textContent = `${revenue.toLocaleString('da-DK')} kr`;
}

// ─── Fit to viewport ─────────────────────────────────────────────────────────

function fitToViewport() {
    const containers = [
        $('#kfs-active-orders'),
        $('#kfs-served-orders'),
    ];

    for (const container of containers) {
        if (!container || container.offsetParent === null) continue;
        const table = container.querySelector('.kitchen-table');
        if (!table) continue;

        table.style.transform = '';
        table.style.transformOrigin = 'top left';
        table.style.width = '100%';

        void table.offsetHeight;

        const availableHeight = container.clientHeight;
        const tableHeight = table.scrollHeight;

        if (tableHeight > availableHeight && tableHeight > 0) {
            const scale = Math.max(availableHeight / tableHeight, 0.55);
            table.style.transform = `scale(${scale})`;
            table.style.transformOrigin = 'top left';
            table.style.width = `${100 / scale}%`;
        }
    }
}

// ─── Serve / Unserve ─────────────────────────────────────────────────────────

async function markServed(saleId) {
    const order = allOrders.find(o => o.id === saleId);
    if (!order) return;
    order.kitchen_served = true;
    order.kitchen_served_at = new Date().toISOString();
    renderOrders();

    playServeSound();

    const { error } = await supabaseClient.rpc('mark_sale_served', {
        p_sale_id: saleId,
        p_institution_id: institutionId,
    });

    if (error) {
        console.error('[kitchen-fs] Error marking served:', error);
        order.kitchen_served = false;
        order.kitchen_served_at = null;
        renderOrders();
    }
}

function confirmUnserve(sale) {
    if (!confirm(`Markér "${sale.customer_name}" som IKKE serveret?`)) return;
    unmarkServed(sale.id);
}

async function unmarkServed(saleId) {
    const order = allOrders.find(o => o.id === saleId);
    if (!order) return;
    order.kitchen_served = false;
    order.kitchen_served_at = null;
    renderOrders();

    const { error } = await supabaseClient.rpc('unmark_sale_served', {
        p_sale_id: saleId,
        p_institution_id: institutionId,
    });

    if (error) {
        console.error('[kitchen-fs] Error unmarking served:', error);
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
        .channel('kitchen-fullscreen-sales')
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
    if (!newSale?.id || allOrders.some(o => o.id === newSale.id)) return;

    const { data: fullSale } = await supabaseClient
        .from('sales')
        .select(`
            id, created_at, customer_id, clerk_user_id, admin_user_id,
            table_number, kitchen_note,
            kitchen_served, kitchen_served_at, total_amount,
            sale_items (
                id, product_id, quantity, price_at_purchase,
                item_variant, item_note,
                products:product_id ( name, emoji, icon_url )
            ),
            users:customer_id ( name ),
            clerk:clerk_user_id ( name ),
            admin:admin_user_id ( name )
        `)
        .eq('id', newSale.id)
        .single();

    if (!fullSale) return;

    const normalized = normalizeSale(fullSale);
    allOrders.push(normalized);
    renderOrders();

    showNewOrderToast(normalized);
    playNewOrderSound();
}

function handleUpdate(payload) {
    const updated = payload.new;
    if (!updated?.id) return;
    const idx = allOrders.findIndex(o => o.id === updated.id);
    if (idx === -1) return;
    allOrders[idx].table_number = updated.table_number;
    allOrders[idx].kitchen_note = updated.kitchen_note;
    allOrders[idx].kitchen_served = updated.kitchen_served || false;
    allOrders[idx].kitchen_served_at = updated.kitchen_served_at;
    renderOrders();
}

function handleDelete(payload) {
    const old = payload.old;
    if (!old?.id) return;
    allOrders = allOrders.filter(o => o.id !== old.id);
    renderOrders();
}

// ─── Toast notifications ─────────────────────────────────────────────────────

function showNewOrderToast(sale) {
    if (!overlayEl) return;

    let toastContainer = overlayEl.querySelector('#kfs-toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'kfs-toast-container';
        toastContainer.className = 'kitchen-toast-container';
        overlayEl.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = 'kitchen-toast kitchen-toast-enter';

    const itemsPreview = (sale.items || []).slice(0, 3).map(i =>
        `${i.emoji || '🍽️'} ${i.name}${i.quantity > 1 ? ` x${i.quantity}` : ''}`
    ).join(', ');
    const moreCount = (sale.items || []).length - 3;
    const moreText = moreCount > 0 ? ` +${moreCount}` : '';
    const tableText = sale.table_number ? ` · Bord ${sale.table_number}` : '';
    const amountText = sale.total_amount != null ? ` · ${Number(sale.total_amount).toLocaleString('da-DK')} kr` : '';

    toast.innerHTML = `
        <div class="kitchen-toast-icon">🍽️</div>
        <div class="kitchen-toast-body">
            <div class="kitchen-toast-title">Ny ordre${tableText}${amountText}</div>
            <div class="kitchen-toast-subtitle">${escapeHtml(sale.customer_name)}</div>
            <div class="kitchen-toast-items">${itemsPreview}${moreText}</div>
        </div>
        <button class="kitchen-toast-close">✕</button>
    `;

    toast.addEventListener('click', () => dismissToast(toast));
    toastContainer.appendChild(toast);

    requestAnimationFrame(() => { toast.classList.remove('kitchen-toast-enter'); });
    const timer = setTimeout(() => dismissToast(toast), 5000);
    toast._timer = timer;
}

function dismissToast(toast) {
    if (toast._dismissed) return;
    toast._dismissed = true;
    clearTimeout(toast._timer);
    toast.classList.add('kitchen-toast-exit');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
    setTimeout(() => toast.remove(), 600);
}

// ─── Settings overlay ────────────────────────────────────────────────────────

let settingsOpen = false;

function toggleSettingsOverlay() {
    const existing = overlayEl?.querySelector('#kfs-settings-overlay');
    if (existing) {
        existing.remove();
        settingsOpen = false;
        return;
    }
    openSettingsOverlay();
}

function openSettingsOverlay() {
    settingsOpen = true;

    const orderSound = getOrderSoundFile();
    const serveSound = getServeSoundFile();

    const soundOptions = [
        { value: '', label: 'Ingen lyd' },
        { value: 'sounds/Accept/accepter-1.mp3', label: 'Acceptér 1' },
        { value: 'sounds/Accept/accepter-2.mp3', label: 'Acceptér 2' },
        { value: 'sounds/Accept/accepter-3.mp3', label: 'Acceptér 3' },
        { value: 'sounds/Accept/accepter-4.mp3', label: 'Acceptér 4' },
        { value: 'sounds/Accept/accepter-5.mp3', label: 'Acceptér 5' },
        { value: 'sounds/Accept/accepter-6.mp3', label: 'Acceptér 6' },
        { value: 'sounds/Accept/accepter-7.mp3', label: 'Acceptér 7' },
        { value: 'sounds/Add Item/Add1.mp3', label: 'Tilføj 1' },
        { value: 'sounds/Add Item/Add2.mp3', label: 'Tilføj 2' },
        { value: 'sounds/Login/Login1.mp3', label: 'Login 1' },
        { value: 'sounds/Login/Login2.mp3', label: 'Login 2' },
    ];

    function buildSelect(id, currentVal) {
        return soundOptions.map(o =>
            `<option value="${o.value}"${o.value === (currentVal || '') ? ' selected' : ''}>${o.label}</option>`
        ).join('');
    }

    const settingsEl = document.createElement('div');
    settingsEl.id = 'kfs-settings-overlay';
    settingsEl.className = 'kitchen-settings-overlay';

    settingsEl.innerHTML = `
        <div class="kitchen-settings-header">
            <span>⚙️ Lydindstillinger</span>
            <button class="kitchen-settings-close">✕</button>
        </div>
        <div class="kitchen-settings-body">
            <div class="kitchen-settings-row">
                <label for="kfs-order-sound">Ny ordre lyd</label>
                <div class="kitchen-settings-select-row">
                    <select id="kfs-order-sound">${buildSelect('kfs-order-sound', orderSound)}</select>
                    <button class="kitchen-settings-preview" data-target="kfs-order-sound">▶</button>
                </div>
            </div>
            <div class="kitchen-settings-row">
                <label for="kfs-serve-sound">Serveret lyd</label>
                <div class="kitchen-settings-select-row">
                    <select id="kfs-serve-sound">${buildSelect('kfs-serve-sound', serveSound)}</select>
                    <button class="kitchen-settings-preview" data-target="kfs-serve-sound">▶</button>
                </div>
            </div>
        </div>
    `;

    overlayEl.appendChild(settingsEl);

    settingsEl.querySelector('.kitchen-settings-close').addEventListener('click', () => {
        settingsEl.remove();
        settingsOpen = false;
    });

    settingsEl.querySelector('#kfs-order-sound').addEventListener('change', (e) => {
        setOrderSound(e.target.value || null);
    });

    settingsEl.querySelector('#kfs-serve-sound').addEventListener('change', (e) => {
        setServeSound(e.target.value || null);
    });

    let previewAudio = null;
    settingsEl.querySelectorAll('.kitchen-settings-preview').forEach(btn => {
        btn.addEventListener('click', () => {
            const select = settingsEl.querySelector(`#${btn.dataset.target}`);
            const src = select?.value;
            if (!src) return;
            if (previewAudio) previewAudio.pause();
            previewAudio = new Audio(src);
            previewAudio.volume = 0.7;
            previewAudio.play().catch(() => {});
        });
    });

    // Close on click outside
    requestAnimationFrame(() => {
        const handler = (e) => {
            if (settingsEl.contains(e.target) || e.target === $('#kfs-settings-btn')) return;
            settingsEl.remove();
            settingsOpen = false;
            document.removeEventListener('mousedown', handler);
        };
        document.addEventListener('mousedown', handler);
    });
}
