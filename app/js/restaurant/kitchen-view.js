/**
 * Kitchen View — main entry point for restaurant.html.
 * Handles: auth, data loading, Realtime subscription, rendering, serve/unserve.
 * iPad-first, no-scroll, scale-to-fit design.
 */
import { supabaseClient } from '../core/config-and-supabase.js?v=3.0.76';
import { authenticateKitchen, getKitchenInstitutionId, getKitchenInstitutionName, logoutKitchen } from './kitchen-auth.js?v=3.0.76';
import { renderKitchenCard, updateAllCardTimes } from './kitchen-cards.js?v=3.0.76';
import { sortOrders, sortOrdersByColumn } from './kitchen-sort.js?v=3.0.76';
import { initKitchenSound, setKitchenSound, playNewOrderSound, playServeSound, toggleMute, isSoundMuted, setOrderSound, setServeSound, getOrderSoundFile, getServeSoundFile } from './kitchen-sound.js?v=3.0.76';

let institutionId = null;
let institutionName = null;
let allOrders = [];
let realtimeChannel = null;
let settingsChannel = null;
let timeTickerInterval = null;

// Standalone confirm dialog (restaurant.html har ikke custom-alert-modal)
function kitchenConfirm(message) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:99999;';
        const box = document.createElement('div');
        box.style.cssText = 'background:#1e1e2e;color:#fff;border-radius:16px;padding:24px 28px;max-width:420px;width:90%;text-align:center;font-family:inherit;';
        box.innerHTML = `
            <p style="font-size:15px;line-height:1.5;margin:0 0 20px;white-space:pre-line;">${message}</p>
            <div style="display:flex;gap:12px;justify-content:center;">
                <button id="kc-cancel" style="padding:10px 24px;border-radius:10px;border:1px solid #555;background:transparent;color:#ccc;font-size:14px;cursor:pointer;">Annuller</button>
                <button id="kc-ok" style="padding:10px 24px;border-radius:10px;border:none;background:#3b82f6;color:#fff;font-size:14px;cursor:pointer;font-weight:600;">OK</button>
            </div>`;
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        const cleanup = (result) => { overlay.remove(); resolve(result); };
        box.querySelector('#kc-ok').onclick = () => cleanup(true);
        box.querySelector('#kc-cancel').onclick = () => cleanup(false);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) cleanup(false); });
        box.querySelector('#kc-ok').focus();
    });
}

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

    // Subscribe to realtime (sales + institution settings)
    subscribeRealtime();
    subscribeSettingsRealtime();

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

    // Fullscreen toggle (ikke relevant i native app — allerede fullscreen)
    $('#kitchen-fullscreen-btn')?.addEventListener('click', () => {
        if (window.Capacitor?.isNativePlatform()) return;
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
                item_variant, item_note,
                products:product_id ( name, emoji, icon_url, icon_storage_path )
            ),
            users:customer_id ( name ),
            clerk:clerk_user_id ( name ),
            admin:admin_user_id ( name )
        `)
        .eq('institution_id', institutionId)
        .eq('is_restaurant_order', true)
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
        icon_storage_path: si.products?.icon_storage_path || null,
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
            row.addEventListener('click', (e) => {
                if (e.target.closest('.kitchen-delete-btn')) return;
                confirmUnserve(sale);
            });
        }
        // Delete button
        const deleteBtn = row.querySelector('.kitchen-delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                confirmRemoveOrder(sale);
            });
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
            row.addEventListener('click', (e) => {
                if (e.target.closest('.kitchen-delete-btn')) return;
                confirmUnserve(sale);
            });
        }

        // Delete button
        const deleteBtn = row.querySelector('.kitchen-delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                confirmRemoveOrder(sale);
            });
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

    const itemsPreview = (sale.items || []).slice(0, 3).map(i => {
        const emoji = (i.emoji && i.emoji.startsWith('::icon::')) ? '🍽️' : (i.emoji || '🍽️');
        return `${emoji} ${i.name}${i.quantity > 1 ? ` x${i.quantity}` : ''}`;
    }).join(', ');
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

    const activeCount = allOrders.filter(o => !o.kitchen_served).length;
    const servedCount = allOrders.filter(o => o.kitchen_served).length;

    overlay.innerHTML = `
        <div class="kitchen-settings-header">
            <span>⚙️ Indstillinger</span>
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
            <div class="kitchen-settings-divider"></div>
            <div class="kitchen-settings-row">
                <label>Handlinger</label>
                <div class="kitchen-settings-actions">
                    <button id="ks-serve-all" class="kitchen-settings-action-btn kitchen-settings-action-serve"${activeCount === 0 ? ' disabled' : ''}>
                        ✓ Servér alle (${activeCount})
                    </button>
                    <button id="ks-clear-served" class="kitchen-settings-action-btn kitchen-settings-action-clear"${servedCount === 0 ? ' disabled' : ''}>
                        🧹 Ryd serveret (${servedCount})
                    </button>
                    <button id="ks-reset-all" class="kitchen-settings-action-btn kitchen-settings-action-reset"${allOrders.length === 0 ? ' disabled' : ''}>
                        🔄 Nulstil alt
                    </button>
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

    // Serve all active orders
    overlay.querySelector('#ks-serve-all')?.addEventListener('click', async () => {
        const active = allOrders.filter(o => !o.kitchen_served);
        if (active.length === 0) return;
        if (!await kitchenConfirm(`Markér alle ${active.length} aktive ordrer som serveret?`)) return;
        serveAllOrders();
        closeSettingsOverlay();
    });

    // Clear served orders from view
    overlay.querySelector('#ks-clear-served')?.addEventListener('click', async () => {
        const served = allOrders.filter(o => o.kitchen_served);
        if (served.length === 0) return;
        if (!await kitchenConfirm(`Fjern ${served.length} serverede ordrer fra listen?`)) return;
        clearServedOrders();
        closeSettingsOverlay();
    });

    // Reset everything
    overlay.querySelector('#ks-reset-all')?.addEventListener('click', async () => {
        if (!await kitchenConfirm('Nulstil hele listen og statistikken?\n\nOrdrer forsvinder kun fra køkkenskærmen — ikke fra databasen.')) return;
        resetAll();
        closeSettingsOverlay();
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

async function confirmUnserve(sale) {
    if (!await kitchenConfirm(`Markér "${sale.customer_name}" som IKKE serveret?`)) return;
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

// ─── Batch actions ────────────────────────────────────────────────────────────

/** Mark all active orders as served (DB + UI) */
async function serveAllOrders() {
    const active = allOrders.filter(o => !o.kitchen_served);
    if (active.length === 0) return;

    // Optimistic UI
    const now = new Date().toISOString();
    for (const o of active) {
        o.kitchen_served = true;
        o.kitchen_served_at = now;
    }
    renderOrders();

    // Batch RPC calls
    const results = await Promise.allSettled(
        active.map(o =>
            supabaseClient.rpc('mark_sale_served', {
                p_sale_id: o.id,
                p_institution_id: institutionId,
            })
        )
    );

    // Rollback failed ones
    let anyFailed = false;
    results.forEach((r, i) => {
        if (r.status === 'rejected' || r.value?.error) {
            anyFailed = true;
            active[i].kitchen_served = false;
            active[i].kitchen_served_at = null;
        }
    });

    if (anyFailed) {
        console.error('[kitchen] Some orders failed to serve');
        renderOrders();
    }
}

/** Remove a single order from view (UI only — stays in DB) */
async function confirmRemoveOrder(sale) {
    if (!await kitchenConfirm(`Fjern "${sale.customer_name}" fra listen?`)) return;
    allOrders = allOrders.filter(o => o.id !== sale.id);
    updateStats();
    renderOrders();
}

/** Remove served orders from view (UI only — stays in DB) */
function clearServedOrders() {
    allOrders = allOrders.filter(o => !o.kitchen_served);
    updateStats();
    renderOrders();
}

/** Clear entire list + reset stats (UI only — stays in DB) */
function resetAll() {
    allOrders = [];
    updateStats();
    renderOrders();
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

function subscribeSettingsRealtime() {
    if (settingsChannel) {
        supabaseClient.removeChannel(settingsChannel);
    }

    settingsChannel = supabaseClient
        .channel('kitchen-settings')
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'institutions',
            filter: `id=eq.${institutionId}`,
        }, (payload) => {
            const updated = payload.new;
            if (updated && updated.restaurant_mode_enabled === false) {
                // Restaurant mode was disabled — tear down and show guard screen
                if (realtimeChannel) {
                    supabaseClient.removeChannel(realtimeChannel);
                    realtimeChannel = null;
                }
                if (settingsChannel) {
                    supabaseClient.removeChannel(settingsChannel);
                    settingsChannel = null;
                }
                if (timeTickerInterval) {
                    clearInterval(timeTickerInterval);
                    timeTickerInterval = null;
                }
                showGuardScreen();
            }
        })
        .subscribe();
}

async function handleInsert(payload) {
    const newSale = payload.new;
    if (!newSale?.id) return;
    if (!newSale.is_restaurant_order) return; // Ignorér ikke-restaurant ordrer
    if (allOrders.some(o => o.id === newSale.id)) return;

    const { data: fullSale } = await supabaseClient
        .from('sales')
        .select(`
            id, created_at, customer_id, clerk_user_id, admin_user_id,
            table_number, kitchen_note,
            kitchen_served, kitchen_served_at, total_amount,
            sale_items (
                id, product_id, quantity, price_at_purchase,
                item_variant, item_note,
                products:product_id ( name, emoji, icon_url, icon_storage_path )
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
