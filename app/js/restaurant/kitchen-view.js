/**
 * Kitchen View — main entry point for restaurant.html.
 * Handles: auth, data loading, Realtime subscription, rendering, serve/unserve.
 * iPad-first, no-scroll, scale-to-fit design.
 */
import { supabaseClient } from '../core/config-and-supabase.js';
import { authenticateKitchen, getKitchenInstitutionId, getKitchenInstitutionName, logoutKitchen } from './kitchen-auth.js';
import { renderKitchenCard, updateAllCardTimes } from './kitchen-cards.js';
import { sortOrders, sortOrdersByColumn } from './kitchen-sort.js';
import { initKitchenSound, setKitchenSound, playNewOrderSound, playServeSound, toggleMute, isSoundMuted, setOrderSound, setServeSound, getOrderSoundFile, getServeSoundFile } from './kitchen-sound.js';

let institutionId = null;
let institutionName = null;
let allOrders = [];
let realtimeChannel = null;
let timeTickerInterval = null;

// Sort state
let columnSort = JSON.parse(localStorage.getItem('flango_kitchen_sort') || 'null') || { column: 'time', direction: 'asc' };

// Served layout: 'bottom' | 'side' | 'hidden'
let servedPosition = localStorage.getItem('flango_kitchen_served_pos') || 'bottom';

// DOM refs
const $ = (sel) => document.querySelector(sel);

// ─── Bootstrap ───────────────────────────────────────────────────────────────

export async function initKitchenView() {
    // Kitchen screen runs as anon — sign out any stale admin session
    // so the Supabase client uses the anon key instead of an expired JWT.
    await supabaseClient.auth.signOut().catch(() => {});

    try {
        const auth = await authenticateKitchen();
        institutionId = auth.institutionId;
        institutionName = auth.institutionName;
    } catch (e) {
        console.error('[kitchen] Auth failed:', e);
        return;
    }

    // Check if restaurant mode is enabled (uses RPC to bypass RLS for anon access)
    const { data: inst } = await supabaseClient
        .rpc('get_restaurant_config', { p_institution_id: institutionId });

    if (!inst?.restaurant_mode_enabled) {
        showGuardScreen();
        return;
    }

    // Init sound
    const soundFile = inst.restaurant_sound || null;
    const serveSoundFile = inst.restaurant_serve_sound || null;
    initKitchenSound(
        soundFile ? `sounds/${soundFile}` : null,
        serveSoundFile ? `sounds/${serveSoundFile}` : null
    );

    // Set institution name in header
    const nameEl = $('#kitchen-institution-name');
    if (nameEl) nameEl.textContent = institutionName;

    // Show main app
    $('#kitchen-login').style.display = 'none';
    $('#kitchen-guard').style.display = 'none';
    $('#kitchen-app').style.display = 'flex';

    // Wire up controls
    setupControls();

    // Apply saved layout
    applyServedLayout();

    // Load today's orders
    await loadOrders();

    // Subscribe to realtime
    subscribeRealtime();

    // Start time ticker (update relative times every 15s)
    timeTickerInterval = setInterval(() => {
        updateAllCardTimes($('#kitchen-active-orders'));
    }, 15000);

    // Resize listener for orientation changes + fitToViewport
    window.addEventListener('resize', () => {
        applyServedLayout();
        fitToViewport();
    });
}

// ─── Guard screen (restaurant mode disabled) ─────────────────────────────────

function showGuardScreen() {
    $('#kitchen-login').style.display = 'none';
    $('#kitchen-guard').style.display = 'flex';
    $('#kitchen-app').style.display = 'none';

    const guardEl = $('#kitchen-guard');
    guardEl.innerHTML = `
        <div class="kitchen-login-card">
            <div class="kitchen-login-logo">🚫</div>
            <h1>Restaurant Mode er ikke aktiveret</h1>
            <p>Bed en administrator om at aktivere Restaurant Mode i caféappens indstillinger.</p>
            <button onclick="location.reload()" style="margin-top:16px;padding:12px 24px;background:#f59e0b;color:white;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;">Prøv igen</button>
            <button id="guard-logout-btn" style="margin-top:8px;padding:10px 24px;background:#f3f4f6;color:#6b7280;border:none;border-radius:10px;font-size:14px;cursor:pointer;">Log ud</button>
        </div>
    `;
    guardEl.querySelector('#guard-logout-btn')?.addEventListener('click', logoutKitchen);
}

// ─── Controls ────────────────────────────────────────────────────────────────

function setupControls() {
    // Sound toggle (global mute)
    $('#kitchen-sound-btn')?.addEventListener('click', () => {
        const muted = toggleMute();
        const btn = $('#kitchen-sound-btn');
        btn.textContent = muted ? '🔇' : '🔊';
        btn.title = muted ? 'Lyd slået fra' : 'Lyd slået til';
    });
    const soundBtn = $('#kitchen-sound-btn');
    if (soundBtn) soundBtn.textContent = isSoundMuted() ? '🔇' : '🔊';

    // Fullscreen toggle
    $('#kitchen-fullscreen-btn')?.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    });

    // Served position toggle (4-state cycle)
    $('#kitchen-served-toggle')?.addEventListener('click', () => {
        const positions = ['bottom', 'side', 'hidden', 'merged'];
        const idx = positions.indexOf(servedPosition);
        servedPosition = positions[(idx + 1) % positions.length];
        localStorage.setItem('flango_kitchen_served_pos', servedPosition);
        applyServedLayout();
        renderOrders();
    });

    // Settings button
    $('#kitchen-settings-btn')?.addEventListener('click', toggleSettingsOverlay);

    // Logout
    $('#kitchen-logout-btn')?.addEventListener('click', logoutKitchen);
}

// ─── Served layout ───────────────────────────────────────────────────────────

function applyServedLayout() {
    const content = $('.kitchen-content');
    const servedZone = $('#kitchen-served-zone');
    const activeHeader = $('#kitchen-active-zone .kitchen-zone-header');
    const btn = $('#kitchen-served-toggle');
    if (!content) return;

    // Force side → bottom on narrow screens
    let effectivePos = servedPosition;
    if (effectivePos === 'side' && window.innerWidth < 900) {
        effectivePos = 'bottom';
    }

    content.classList.remove('layout-bottom', 'layout-side', 'layout-hidden', 'layout-merged');
    content.classList.add(`layout-${effectivePos}`);

    // Hide served zone in hidden + merged modes
    if (servedZone) {
        servedZone.style.display = (effectivePos === 'hidden' || effectivePos === 'merged') ? 'none' : '';
    }

    // Hide "Aktive ordrer" header in merged mode (it's one list)
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
        console.error('[kitchen] Error loading orders:', error);
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
    const activeContainer = $('#kitchen-active-orders');
    const servedContainer = $('#kitchen-served-orders');
    if (!activeContainer || !servedContainer) return;

    // ─── Merged mode: single list (served orders keep position, dimmed) ────
    if (servedPosition === 'merged') {
        activeContainer.innerHTML = '';
        servedContainer.innerHTML = '';

        if (allOrders.length === 0) {
            activeContainer.innerHTML = '<div class="kitchen-empty">Ingen ordrer i dag</div>';
        } else {
            const sorted = sortOrdersByColumn(allOrders, columnSort);
            const table = buildMergedTable(sorted);
            activeContainer.appendChild(table);
        }

        updateStats();
        requestAnimationFrame(() => fitToViewport());
        return;
    }

    // ─── Split mode: active + served in separate zones ──────────────────
    const active = allOrders.filter(o => !o.kitchen_served);
    const served = allOrders.filter(o => o.kitchen_served);

    const sortedActive = sortOrdersByColumn(active, columnSort);
    const sortedServed = [...served].sort((a, b) =>
        new Date(b.kitchen_served_at || b.created_at) - new Date(a.kitchen_served_at || a.created_at)
    );

    // Render active
    activeContainer.innerHTML = '';
    if (sortedActive.length === 0) {
        activeContainer.innerHTML = '<div class="kitchen-empty">Ingen aktive ordrer 🎉</div>';
    } else {
        const table = buildOrderTable(sortedActive, false);
        activeContainer.appendChild(table);
    }

    // Render served
    servedContainer.innerHTML = '';
    if (sortedServed.length === 0) {
        servedContainer.innerHTML = '<div class="kitchen-empty">Ingen serverede ordrer endnu</div>';
    } else {
        const table = buildOrderTable(sortedServed, true);
        servedContainer.appendChild(table);
    }

    updateStats();

    // Scale tables to fit viewport (no scroll)
    requestAnimationFrame(() => fitToViewport());
}

function buildOrderTable(orders, isServed) {
    const table = document.createElement('table');
    table.className = 'kitchen-table';

    // Header with sortable columns
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

    for (const col of columns) {
        const th = document.createElement('th');
        th.className = col.key ? `kitchen-th-${col.key}` : '';

        if (col.key && !isServed) {
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
                localStorage.setItem('flango_kitchen_sort', JSON.stringify(columnSort));
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
        const row = renderKitchenCard(sale);
        if (!isServed) {
            const serveBtn = row.querySelector('.kitchen-serve-btn');
            if (serveBtn) {
                serveBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    markServed(sale.id);
                });
            }
        } else {
            row.style.cursor = 'pointer';
            row.title = 'Klik for at markere som ikke-serveret';
            row.addEventListener('click', () => confirmUnserve(sale));
        }
        tbody.appendChild(row);
    }
    table.appendChild(tbody);
    return table;
}

/**
 * Build a single merged table — served orders keep position, just dimmed.
 * Sortable column headers (same as split view).
 */
function buildMergedTable(orders) {
    const table = document.createElement('table');
    table.className = 'kitchen-table';

    // Sortable header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const columns = [
        { key: 'time', label: 'Tid' },
        { key: 'customer', label: 'Kunde' },
        { key: 'table', label: 'Bord' },
        { key: 'items', label: 'Bestilling' },
        { key: 'amount', label: 'Beløb' },
        { key: 'server', label: 'Ekspedient' },
        { key: 'served', label: 'Handling' },
    ];

    for (const col of columns) {
        const th = document.createElement('th');
        th.className = col.key ? `kitchen-th-${col.key}` : '';

        if (col.key) {
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
                localStorage.setItem('flango_kitchen_sort', JSON.stringify(columnSort));
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
        const row = renderKitchenCard(sale);

        // Serve button for active orders
        const serveBtn = row.querySelector('.kitchen-serve-btn');
        if (serveBtn) {
            serveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                markServed(sale.id);
            });
        }

        // Served rows: click to unserve
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
    // Active orders count
    const activeCount = allOrders.filter(o => !o.kitchen_served).length;
    const countEl = $('#kitchen-order-count');
    if (countEl) countEl.textContent = activeCount;

    // Total orders today
    const totalEl = $('#kitchen-total-orders');
    if (totalEl) totalEl.textContent = allOrders.length;

    // Daily revenue
    const revenue = allOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
    const revenueEl = $('#kitchen-daily-revenue');
    if (revenueEl) revenueEl.textContent = `${revenue.toLocaleString('da-DK')} kr`;
}

// ─── Fit to viewport (no-scroll scaling) ─────────────────────────────────────

function fitToViewport() {
    const containers = [
        $('#kitchen-active-orders'),
        $('#kitchen-served-orders'),
    ];

    for (const container of containers) {
        if (!container || container.offsetParent === null) continue;
        const table = container.querySelector('.kitchen-table');
        if (!table) continue;

        // Reset previous scaling
        table.style.transform = '';
        table.style.transformOrigin = 'top left';
        table.style.width = '100%';

        // Force reflow
        void table.offsetHeight;

        const availableHeight = container.clientHeight;
        const tableHeight = table.scrollHeight;

        if (tableHeight > availableHeight && tableHeight > 0) {
            const scale = Math.max(availableHeight / tableHeight, 0.55);
            // Use uniform scale to preserve proportions (no distortion)
            table.style.transform = `scale(${scale})`;
            table.style.transformOrigin = 'top left';
            // Ensure table fills width after uniform scaling
            table.style.width = `${100 / scale}%`;
        }
    }
}

// ─── Toast notifications ─────────────────────────────────────────────────────

function showNewOrderToast(sale) {
    let toastContainer = $('#kitchen-toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'kitchen-toast-container';
        toastContainer.className = 'kitchen-toast-container';
        document.body.appendChild(toastContainer);
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
            <div class="kitchen-toast-subtitle">${sale.customer_name}</div>
            <div class="kitchen-toast-items">${itemsPreview}${moreText}</div>
        </div>
        <button class="kitchen-toast-close">✕</button>
    `;

    // Close on click
    toast.addEventListener('click', () => dismissToast(toast));

    toastContainer.appendChild(toast);

    // Trigger enter animation
    requestAnimationFrame(() => {
        toast.classList.remove('kitchen-toast-enter');
    });

    // Auto-dismiss after 5s
    const timer = setTimeout(() => dismissToast(toast), 5000);
    toast._timer = timer;
}

function dismissToast(toast) {
    if (toast._dismissed) return;
    toast._dismissed = true;
    clearTimeout(toast._timer);
    toast.classList.add('kitchen-toast-exit');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
    // Fallback removal
    setTimeout(() => toast.remove(), 600);
}

// ─── Settings overlay ────────────────────────────────────────────────────────

let settingsOpen = false;

function toggleSettingsOverlay() {
    const existing = $('#kitchen-settings-overlay');
    if (existing) {
        closeSettingsOverlay();
        return;
    }
    openSettingsOverlay();
}

function openSettingsOverlay() {
    settingsOpen = true;

    const overlay = document.createElement('div');
    overlay.id = 'kitchen-settings-overlay';
    overlay.className = 'kitchen-settings-overlay';

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

    overlay.innerHTML = `
        <div class="kitchen-settings-header">
            <span>⚙️ Lydindstillinger</span>
            <button class="kitchen-settings-close">✕</button>
        </div>
        <div class="kitchen-settings-body">
            <div class="kitchen-settings-row">
                <label for="ks-order-sound">Ny ordre lyd</label>
                <div class="kitchen-settings-select-row">
                    <select id="ks-order-sound">${buildSelect('ks-order-sound', orderSound)}</select>
                    <button class="kitchen-settings-preview" data-target="ks-order-sound">▶</button>
                </div>
            </div>
            <div class="kitchen-settings-row">
                <label for="ks-serve-sound">Serveret lyd</label>
                <div class="kitchen-settings-select-row">
                    <select id="ks-serve-sound">${buildSelect('ks-serve-sound', serveSound)}</select>
                    <button class="kitchen-settings-preview" data-target="ks-serve-sound">▶</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Event listeners
    overlay.querySelector('.kitchen-settings-close').addEventListener('click', closeSettingsOverlay);

    overlay.querySelector('#ks-order-sound').addEventListener('change', (e) => {
        setOrderSound(e.target.value || null);
    });

    overlay.querySelector('#ks-serve-sound').addEventListener('change', (e) => {
        setServeSound(e.target.value || null);
    });

    // Preview buttons
    let previewAudio = null;
    overlay.querySelectorAll('.kitchen-settings-preview').forEach(btn => {
        btn.addEventListener('click', () => {
            const select = overlay.querySelector(`#${btn.dataset.target}`);
            const src = select?.value;
            if (!src) return;
            if (previewAudio) previewAudio.pause();
            previewAudio = new Audio(src);
            previewAudio.volume = 0.7;
            previewAudio.play().catch(() => {});
        });
    });

    // Close on click outside (delayed)
    requestAnimationFrame(() => {
        document.addEventListener('mousedown', onSettingsClickOutside);
    });
}

function closeSettingsOverlay() {
    settingsOpen = false;
    const overlay = $('#kitchen-settings-overlay');
    if (overlay) overlay.remove();
    document.removeEventListener('mousedown', onSettingsClickOutside);
}

function onSettingsClickOutside(e) {
    const overlay = $('#kitchen-settings-overlay');
    const btn = $('#kitchen-settings-btn');
    if (overlay?.contains(e.target) || btn?.contains(e.target)) return;
    closeSettingsOverlay();
}

// ─── Serve / Unserve ─────────────────────────────────────────────────────────

async function markServed(saleId) {
    const order = allOrders.find(o => o.id === saleId);
    if (!order) return;
    order.kitchen_served = true;
    order.kitchen_served_at = new Date().toISOString();
    renderOrders();

    // Play serve sound
    playServeSound();

    const { error } = await supabaseClient.rpc('mark_sale_served', {
        p_sale_id: saleId,
        p_institution_id: institutionId,
    });

    if (error) {
        console.error('[kitchen] Error marking served:', error);
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
        console.error('[kitchen] Error unmarking served:', error);
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
        .channel('kitchen-sales')
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
    if (!newSale?.id) return;
    if (allOrders.some(o => o.id === newSale.id)) return;

    const { data: fullSale } = await supabaseClient
        .from('sales')
        .select(`
            id, created_at, customer_id, clerk_user_id, admin_user_id,
            table_number, kitchen_note,
            kitchen_served, kitchen_served_at, total_amount,
            sale_items (
                id, product_id, quantity, price_at_purchase,
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

    // Toast + sound
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

// ─── Init on load ────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', initKitchenView);
