/**
 * user-admin-panel.js — Samlet brugerpanel (fullscreen modal med 4 tabs)
 *
 * Tab 1: 👥 Brugeroversigt — tabel med stamdata, saldo, aktivitet
 * Tab 2: 👨‍👩‍👧 Forældreindstillinger — begrænsninger, samtykke
 * Tab 3: 📊 Statistik — toplister, forbrug, ekspedient-tid
 * Tab 4: 📸 Profilbilleder — grid/liste over alle billeder
 */

import { supabaseClient, SUPABASE_URL, SUPABASE_ANON_KEY } from '../core/config-and-supabase.js?v=3.0.67';
import { getInstitutionId } from '../domain/session-store.js?v=3.0.67';
import { getCachedProfilePictureUrl, batchPreWarmProfilePictures, invalidateProfilePictureCache, getDefaultProfilePicture, getDefaultProfilePictureAsync } from '../core/profile-picture-cache.js?v=3.0.67';
import { escapeHtml } from '../core/escape-html.js?v=3.0.67';
import { openHistorikV3ForUser } from './historik-v3.js?v=3.0.67';

// ─── State ───
let panelEl = null;
let activeTab = 'overview';
let searchQuery = '';
let sortCol = 'name';
let sortDir = 'asc';
let allUsers = [];
let highlightedUserId = null; // Currently highlighted user in overview

const TABS = [
    { key: 'overview', icon: '👥', label: 'Brugeroversigt' },
    { key: 'parents', icon: '👨‍👩‍👧', label: 'Forældreindstillinger' },
    { key: 'stats', icon: '📊', label: 'Statistik' },
    { key: 'pictures', icon: '📸', label: 'Profilbilleder' },
];

/**
 * Open the user admin panel.
 */
export function openUserAdminPanel() {
    if (panelEl) { panelEl.remove(); panelEl = null; }

    const institutionId = getInstitutionId();
    if (!institutionId) return;

    // Get users from global store
    allUsers = (typeof window.__flangoGetAllUsers === 'function' ? window.__flangoGetAllUsers() : []) || [];

    // Build DOM
    panelEl = document.createElement('div');
    panelEl.className = 'uap-overlay';
    panelEl.innerHTML = buildPanelHTML();
    document.body.appendChild(panelEl);

    // Pre-warm profile pictures, then re-render to show them
    batchPreWarmProfilePictures(allUsers)
        .then(() => renderActiveTab())
        .catch(() => {});

    // Fetch last activity dates + last deposits
    fetchLastActivityDates().catch(() => {});
    fetchLastDeposits().catch(() => {});

    // Wire up
    wireHeader();
    wireSearch();
    switchTab('overview');

    // Escape to close
    const escHandler = (e) => {
        if (e.key === 'Escape') { closePanel(); document.removeEventListener('keydown', escHandler); }
    };
    document.addEventListener('keydown', escHandler);
}

function closePanel() {
    if (panelEl) { panelEl.remove(); panelEl = null; }
}

/** Open the real parent portal as admin-parent (auto-login, all children) */
export async function openParentPortalAsAdmin() {
    try {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) { alert('Du er ikke logget ind'); return; }

        // Call edge function to get admin-parent session
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/admin-parent-login`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
            },
        });

        const result = await resp.json();
        if (!resp.ok || result.error) {
            alert('Fejl: ' + (result.error || 'Ukendt fejl'));
            return;
        }

        // Open parent portal with auto-login tokens
        const portalUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? `http://localhost:3001`
            : `https://flango.dk/forældre`;

        const url = `${portalUrl}?admin_token=${encodeURIComponent(result.access_token)}&admin_refresh=${encodeURIComponent(result.refresh_token)}`;
        window.open(url, '_blank');
    } catch (err) {
        console.error('[admin-parent] Fejl:', err);
        alert('Kunne ikke åbne forældreportalen: ' + err.message);
    }
}

// ─── HTML skeleton ───

function buildPanelHTML() {
    const tabsHTML = TABS.map(t =>
        `<button class="uap-tab" data-tab="${t.key}">${t.icon} ${t.label}</button>`
    ).join('');

    return `
        <div class="uap-container">
            <div class="uap-header">
                <button class="uap-back-btn">← Tilbage</button>
                <h2 class="uap-title">Brugerpanel</h2>
                <div class="uap-tabs">${tabsHTML}</div>
            </div>
            <div class="uap-toolbar">
                <div class="uap-search-wrap">
                    <span class="uap-search-icon">🔍</span>
                    <input type="text" class="uap-search" placeholder="Søg efter navn eller nummer..." autocomplete="off">
                    <button class="uap-search-clear" id="uap-search-clear" style="display:none;">&times;</button>
                </div>
                <span class="uap-counter"></span>
                <div id="uap-toolbar-extra"></div>
            </div>
            <div class="uap-content">
                <div class="uap-tab-content" data-tab="overview">
                    <div class="uap-table-wrap">
                        <table class="uap-table">
                            <thead><tr id="uap-overview-thead"></tr></thead>
                            <tbody id="uap-overview-tbody"></tbody>
                        </table>
                    </div>
                </div>
                <div class="uap-tab-content" data-tab="parents">
                    <div class="uap-table-wrap">
                        <table class="uap-table">
                            <thead><tr id="uap-parents-thead"></tr></thead>
                            <tbody id="uap-parents-tbody"></tbody>
                        </table>
                    </div>
                </div>
                <div class="uap-tab-content" data-tab="stats">
                    <div class="uap-table-wrap">
                        <table class="uap-table">
                            <thead><tr id="uap-stats-thead"></tr></thead>
                            <tbody id="uap-stats-tbody"></tbody>
                        </table>
                    </div>
                </div>
                <div class="uap-tab-content" data-tab="pictures">
                    <div id="uap-pictures-content"></div>
                </div>
            </div>
        </div>
    `;
}

// ─── Header wiring ───

function wireHeader() {
    panelEl.querySelector('.uap-back-btn').onclick = closePanel;

    panelEl.querySelectorAll('.uap-tab').forEach(tab => {
        tab.onclick = () => switchTab(tab.dataset.tab);
    });

    const portalBtn = panelEl.querySelector('#uap-open-portal-btn');
    if (portalBtn) portalBtn.onclick = () => openParentPortalAsAdmin();
}

function wireSearch() {
    const input = panelEl.querySelector('.uap-search');
    const clearBtn = panelEl.querySelector('#uap-search-clear');
    let debounce;

    // Wire clear button
    clearBtn.onclick = () => {
        input.value = '';
        searchQuery = '';
        clearBtn.style.display = 'none';
        highlightedUserId = null;
        renderActiveTab();
        input.focus();
    };

    input.oninput = () => {
        clearTimeout(debounce);
        const val = input.value.trim();
        clearBtn.style.display = val ? 'block' : 'none';
        debounce = setTimeout(() => {
            searchQuery = val.toLowerCase();
            // Auto-highlight first matching user
            if (activeTab === 'overview' && val) {
                const filtered = getFilteredUsers();
                highlightedUserId = filtered.length > 0 ? filtered[0].id : null;
            } else {
                highlightedUserId = null;
            }
            renderActiveTab();
        }, 200);
    };

    // Enter key → open deposit modal for highlighted user
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && activeTab === 'overview' && highlightedUserId) {
            e.preventDefault();
            const user = allUsers.find(u => u.id === highlightedUserId);
            if (user) openDepositModal(user);
        } else if (e.key === 'ArrowDown' && activeTab === 'overview') {
            e.preventDefault();
            moveHighlight(1);
        } else if (e.key === 'ArrowUp' && activeTab === 'overview') {
            e.preventDefault();
            moveHighlight(-1);
        }
    });

    // Auto-focus
    setTimeout(() => input.focus(), 100);
}

function switchTab(key) {
    activeTab = key;
    // Reset sort for new tab
    sortCol = 'name';
    sortDir = 'asc';

    // Update tab buttons
    panelEl.querySelectorAll('.uap-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === key);
    });

    // Show/hide content
    panelEl.querySelectorAll('.uap-tab-content').forEach(c => {
        c.classList.toggle('active', c.dataset.tab === key);
    });

    renderActiveTab();
}

function renderActiveTab() {
    // Clear toolbar extras (filters, view toggles) unless pictures tab sets them
    const toolbarExtra = panelEl?.querySelector('#uap-toolbar-extra');
    if (toolbarExtra && activeTab !== 'pictures' && activeTab !== 'overview') toolbarExtra.innerHTML = '';

    if (activeTab === 'overview') {
        // Render overview toolbar: filter toggles + download
        if (toolbarExtra) {
            toolbarExtra.innerHTML = `
                <div class="uap-filters" style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
                    <button class="uap-chip ${ovFilterLowBalance ? 'active' : ''}" data-ov="lowBalance">Lav saldo</button>
                    <button class="uap-chip ${ovFilterNoActivity ? 'active' : ''}" data-ov="noActivity">Aldrig handlet</button>
                    <button class="uap-chip ${ovFilterHideInactive ? 'active' : ''}" data-ov="hideInactive">Kun aktive</button>
                    <span style="width:1px;height:20px;background:rgba(255,255,255,0.12);margin:0 4px;"></span>
                    <button class="uap-chip" data-ov="download">⬇ Download liste</button>
                </div>
            `;
            toolbarExtra.querySelectorAll('.uap-chip[data-ov]').forEach(chip => {
                chip.onclick = () => {
                    const action = chip.dataset.ov;
                    if (action === 'lowBalance') { ovFilterLowBalance = !ovFilterLowBalance; chip.classList.toggle('active'); }
                    else if (action === 'noActivity') { ovFilterNoActivity = !ovFilterNoActivity; chip.classList.toggle('active'); }
                    else if (action === 'hideInactive') { ovFilterHideInactive = !ovFilterHideInactive; chip.classList.toggle('active'); }
                    else if (action === 'download') { downloadOverviewCSV(); return; }
                    renderOverviewTab();
                };
            });
        }
        renderOverviewTab();
    }
    else if (activeTab === 'parents') renderParentsTab();
    else if (activeTab === 'stats') renderStatsTab();
    else if (activeTab === 'pictures') renderPicturesTab();
}

// ─── Overview filters ───
let ovFilterLowBalance = false;
let ovFilterNoActivity = false;
let ovFilterHideInactive = false;

// ─── Shared helpers ───

function getFilteredUsers() {
    let users = allUsers.filter(u => u.role === 'kunde');
    if (searchQuery) {
        users = users.filter(u =>
            (u.name || '').toLowerCase().includes(searchQuery) ||
            (u.number || '').toLowerCase().includes(searchQuery)
        );
    }
    // Overview filters (kombinerbare)
    if (ovFilterLowBalance) {
        users = users.filter(u => (u.balance || 0) <= 0);
    }
    if (ovFilterNoActivity) {
        users = users.filter(u => !u._lastActivity);
    }
    if (ovFilterHideInactive) {
        users = users.filter(u => !!u._lastActivity);
    }
    return users;
}

function sortUsers(users, col, dir) {
    return [...users].sort((a, b) => {
        let va, vb;
        if (col === 'name') { va = (a.name || '').toLowerCase(); vb = (b.name || '').toLowerCase(); }
        else if (col === 'number') { va = parseInt(a.number) || 0; vb = parseInt(b.number) || 0; }
        else if (col === 'grade') { va = a.grade_level ?? 99; vb = b.grade_level ?? 99; }
        else if (col === 'balance') { va = a.balance || 0; vb = b.balance || 0; }
        else if (col === 'activity') { va = a._lastActivity || ''; vb = b._lastActivity || ''; }
        else if (col === 'lastDeposit') { va = a._lastDeposit?.date || ''; vb = b._lastDeposit?.date || ''; }
        else if (col === 'active') { va = a.show_in_user_list !== false ? 1 : 0; vb = b.show_in_user_list !== false ? 1 : 0; }
        else { va = (a[col] || ''); vb = (b[col] || ''); }

        if (va < vb) return dir === 'asc' ? -1 : 1;
        if (va > vb) return dir === 'asc' ? 1 : -1;
        return 0;
    });
}

function downloadOverviewCSV() {
    let users = getFilteredUsers();
    users = sortUsers(users, sortCol, sortDir);
    const rows = [['Navn', 'Nummer', 'Klassetrin', 'Saldo', 'Seneste indbetaling', 'Seneste aktivitet']];
    for (const u of users) {
        const grade = u.grade_level != null ? `${u.grade_level}. kl.` : '';
        const balance = (u.balance || 0).toFixed(2);
        const lastDep = u._lastDeposit?.date ? new Date(u._lastDeposit.date).toLocaleDateString('da-DK') + (u._lastDeposit.amount ? ` (${u._lastDeposit.amount} kr.)` : '') : '';
        const lastAct = u._lastActivity ? new Date(u._lastActivity).toLocaleDateString('da-DK') : 'Ingen';
        rows.push([u.name || '', u.number || '', grade, balance, lastDep, lastAct]);
    }
    const csv = '\uFEFF' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brugeroversigt_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function buildSortableHeader(columns, theadId) {
    const thead = panelEl.querySelector(`#${theadId}`);
    if (!thead) return;
    thead.innerHTML = columns.map(col => {
        const sorted = sortCol === col.key;
        const arrow = sorted ? (sortDir === 'asc' ? '▲' : '▼') : '';
        const sortable = col.sortable !== false;
        return `<th class="${sorted ? 'sorted' : ''}" data-col="${col.key}" ${!sortable ? 'style="cursor:default;"' : ''}>
            ${col.label}${arrow ? `<span class="sort-arrow">${arrow}</span>` : ''}
        </th>`;
    }).join('');

    thead.querySelectorAll('th[data-col]').forEach(th => {
        const col = columns.find(c => c.key === th.dataset.col);
        if (col?.sortable === false) return;
        th.onclick = () => {
            if (sortCol === col.key) {
                sortDir = sortDir === 'asc' ? 'desc' : 'asc';
            } else {
                sortCol = col.key;
                sortDir = 'asc';
            }
            renderActiveTab();
        };
    });
}

function profileThumb(user) {
    const url = getCachedProfilePictureUrl(user);
    if (url) {
        return `<span class="uap-thumb-link" data-user-id="${user.id}"><img src="${url}" alt="" class="uap-thumb"></span>`;
    }
    // Use institution default profile picture
    const inst = window.__flangoGetInstitutionById?.(user.institution_id);
    const def = getDefaultProfilePicture(user.name, inst);
    if (def.type === 'anonymous') {
        return `<span class="uap-thumb-link" data-user-id="${user.id}"><div class="uap-thumb-placeholder" style="font-size:18px;">👤</div></span>`;
    }
    if (def.type === 'image' && def.value) {
        return `<span class="uap-thumb-link" data-user-id="${user.id}"><img src="${def.value}" alt="" class="uap-thumb"></span>`;
    }
    const initials = (user.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return `<span class="uap-thumb-link" data-user-id="${user.id}"><div class="uap-thumb-placeholder">${initials}</div></span>`;
}

function gradeLabel(level) {
    if (level == null) return '—';
    return `${level}. kl.`;
}

function daysAgo(dateStr) {
    if (!dateStr) return '<span style="opacity:0.3">Ingen køb</span>';
    const d = new Date(dateStr);
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    const dateFormatted = d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
    const relative = days === 0 ? 'i dag' : days === 1 ? 'i går' : `${days}d siden`;
    return `${dateFormatted} <span style="opacity:0.5;font-size:11px;">(${relative})</span>`;
}

/** Fetch last sale date per user and attach to user objects */
async function fetchLastActivityDates() {
    const institutionId = getInstitutionId();
    if (!institutionId) return;
    // Use raw SQL via RPC to get MAX(created_at) per customer in one query
    const { data, error } = await supabaseClient.rpc('get_last_sale_per_customer', {
        p_institution_id: institutionId,
    });
    if (!error && data) {
        for (const row of data) {
            const u = allUsers.find(u => u.id === row.customer_id);
            if (u) u._lastActivity = row.last_sale;
        }
        renderActiveTab();
        return;
    }
    // Fallback: paginated fetch (if RPC doesn't exist yet)
    const lastMap = new Map();
    let offset = 0;
    const pageSize = 1000;
    while (true) {
        const { data: page, error: pgErr } = await supabaseClient
            .from('sales')
            .select('customer_id, created_at')
            .eq('institution_id', institutionId)
            .order('created_at', { ascending: false })
            .range(offset, offset + pageSize - 1);
        if (pgErr || !page || page.length === 0) break;
        for (const row of page) {
            if (!lastMap.has(row.customer_id)) lastMap.set(row.customer_id, row.created_at);
        }
        if (page.length < pageSize) break;
        offset += pageSize;
    }
    for (const u of allUsers) {
        if (lastMap.has(u.id)) u._lastActivity = lastMap.get(u.id);
    }
    renderActiveTab();
}

/** Fetch last deposit per user */
async function fetchLastDeposits() {
    const institutionId = getInstitutionId();
    if (!institutionId) return;
    // Use RPC for efficient single-query fetch
    const { data, error } = await supabaseClient.rpc('get_last_deposit_per_user', {
        p_institution_id: institutionId,
    });
    if (!error && data) {
        for (const row of data) {
            const u = allUsers.find(u => u.id === row.target_user_id);
            if (u) u._lastDeposit = { date: row.last_date, amount: row.amount };
        }
        renderActiveTab();
        return;
    }
    // Fallback: paginated fetch
    const lastMap = new Map();
    let offset = 0;
    const pageSize = 1000;
    while (true) {
        const { data: page, error: pgErr } = await supabaseClient
            .from('events')
            .select('target_user_id, details, created_at')
            .eq('institution_id', institutionId)
            .eq('event_type', 'DEPOSIT')
            .order('created_at', { ascending: false })
            .range(offset, offset + pageSize - 1);
        if (pgErr || !page || page.length === 0) break;
        for (const row of page) {
            if (!lastMap.has(row.target_user_id)) {
                lastMap.set(row.target_user_id, { date: row.created_at, amount: row.details?.amount });
            }
        }
        if (page.length < pageSize) break;
        offset += pageSize;
    }
    for (const u of allUsers) {
        if (lastMap.has(u.id)) u._lastDeposit = lastMap.get(u.id);
    }
    renderActiveTab();
}

function formatLastDeposit(user) {
    const dep = user._lastDeposit;
    if (!dep) return `<span class="uap-deposit-link" data-user-id="${user.id}" style="opacity:0.3;cursor:pointer;">Ingen</span>`;
    const d = new Date(dep.date);
    const dateStr = d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
    const amount = dep.amount ? `${dep.amount} kr.` : '';
    return `<span class="uap-deposit-link" data-user-id="${user.id}" style="cursor:pointer;">${dateStr} <span style="color:#22c55e;font-weight:600;">${amount}</span></span>`;
}

function openEditUserModal(user, focusField) {
    if (typeof window.__flangoOpenEditUser === 'function') {
        window.__flangoOpenEditUser(user, focusField);
    }
}

/** Move highlight up/down in overview table */
function moveHighlight(dir) {
    const users = sortUsers(getFilteredUsers(), sortCol, sortDir);
    if (users.length === 0) return;
    const idx = users.findIndex(u => u.id === highlightedUserId);
    const newIdx = Math.max(0, Math.min(users.length - 1, idx + dir));
    highlightedUserId = users[newIdx].id;
    renderActiveTab();
    // Scroll highlighted row into view
    const row = panelEl?.querySelector('.uap-row-highlighted');
    if (row) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/** Open deposit modal (like "Indbetal Penge" in edit user) */
function openDepositModal(user) {
    const currentBal = user.balance || 0;

    const dialog = document.createElement('div');
    dialog.className = 'uap-lightbox';
    dialog.style.zIndex = '10001';
    dialog.innerHTML = `
        <div class="uap-lightbox-inner" style="max-width:400px;padding:28px 32px;">
            <button class="uap-lightbox-close" style="position:absolute;top:12px;right:16px;">&times;</button>
            <div style="font-size:22px;font-weight:700;margin-bottom:16px;color:var(--text-primary,#e2e8f0);">Indbetal Penge</div>
            <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:0 0 16px;">
            <div style="padding:10px 14px;background:rgba(255,255,255,0.05);border-radius:8px;margin-bottom:10px;font-size:14px;color:var(--text-primary,#e2e8f0);">
                Bruger: <strong>${escapeHtml(user.name || '')}</strong>
            </div>
            <div style="padding:10px 14px;background:rgba(255,255,255,0.05);border-radius:8px;margin-bottom:16px;font-size:14px;color:var(--text-secondary,#94a3b8);">
                Nuværende Saldo: <strong class="${currentBal < 0 ? 'uap-balance-neg' : 'uap-balance-pos'}">${currentBal.toFixed(2)} kr.</strong>
            </div>
            <input type="number" id="uap-deposit-amount" placeholder="Indbetalingsbeløb" step="0.01" autofocus
                style="width:100%;padding:12px 14px;border:2px solid rgba(255,255,255,0.15);border-radius:10px;background:rgba(255,255,255,0.06);color:var(--text-primary,#e2e8f0);font-size:16px;box-sizing:border-box;outline:none;-webkit-text-fill-color:var(--text-primary,#e2e8f0);margin-bottom:16px;">
            <button class="uap-deposit-modal-save" style="width:100%;padding:14px;background:#22c55e;color:#fff;border:none;border-radius:10px;font-weight:700;font-size:16px;cursor:pointer;">Gem</button>
        </div>
    `;

    document.body.appendChild(dialog);

    const amountInput = dialog.querySelector('#uap-deposit-amount');
    const saveBtn = dialog.querySelector('.uap-deposit-modal-save');

    const close = () => { document.removeEventListener('keydown', keyHandler); dialog.remove(); };

    const doDeposit = async () => {
        const amount = parseFloat((amountInput.value || '').replace(',', '.'));
        if (!amount || amount <= 0) { amountInput.style.borderColor = '#ef4444'; return; }
        saveBtn.disabled = true;
        saveBtn.textContent = 'Indbetaler...';
        const ok = await quickDeposit(user.id, amount);
        if (ok) {
            user._lastDeposit = { date: new Date().toISOString(), amount };
            close();
            // Reset search and focus for next deposit
            searchQuery = '';
            highlightedUserId = null;
            const searchInput = panelEl?.querySelector('.uap-search');
            const clearBtn = panelEl?.querySelector('#uap-search-clear');
            if (searchInput) { searchInput.value = ''; }
            if (clearBtn) clearBtn.style.display = 'none';
            renderActiveTab();
            if (searchInput) setTimeout(() => searchInput.focus(), 100);
        } else {
            saveBtn.textContent = 'Fejl!';
            setTimeout(() => { saveBtn.textContent = 'Gem'; saveBtn.disabled = false; }, 1500);
        }
    };

    const keyHandler = (e) => {
        if (e.key === 'Escape') close();
        else if (e.key === 'Enter') { e.preventDefault(); doDeposit(); }
    };
    document.addEventListener('keydown', keyHandler);

    dialog.querySelector('.uap-lightbox-close').onclick = close;
    dialog.onclick = (e) => { if (e.target === dialog) close(); };
    saveBtn.onclick = doDeposit;

    setTimeout(() => amountInput.focus(), 50);
}

/** Open deposit confirmation dialog */
function openDepositConfirm(user, amount) {
    const currentBal = user.balance || 0;
    const newBal = currentBal + amount;

    const dialog = document.createElement('div');
    dialog.className = 'uap-lightbox';
    dialog.style.zIndex = '10001';
    dialog.innerHTML = `
        <div class="uap-lightbox-inner" style="max-width:380px;padding:28px 32px;">
            <button class="uap-lightbox-close" style="position:absolute;top:12px;right:16px;">&times;</button>
            <div style="font-size:20px;font-weight:700;margin-bottom:16px;color:var(--text-primary,#e2e8f0);">Bekræft indbetaling</div>
            <div style="font-size:15px;margin-bottom:20px;line-height:1.6;color:var(--text-secondary,#94a3b8);">
                <div style="margin-bottom:8px;color:var(--text-primary,#e2e8f0);">${escapeHtml(user.name)} <span style="opacity:0.5;">#${user.number || '?'}</span></div>
                <div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid rgba(255,255,255,0.08);">
                    <span>Nuværende saldo</span>
                    <span class="${currentBal < 0 ? 'uap-balance-neg' : 'uap-balance-pos'}" style="font-weight:600;">${currentBal.toFixed(2)} kr.</span>
                </div>
                <div style="display:flex;justify-content:space-between;padding:6px 0;">
                    <span>Indbetaling</span>
                    <span style="color:#22c55e;font-weight:700;font-size:17px;">+ ${amount} kr.</span>
                </div>
                <div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid rgba(255,255,255,0.08);font-weight:700;color:var(--text-primary,#e2e8f0);">
                    <span>Ny saldo</span>
                    <span class="${newBal < 0 ? 'uap-balance-neg' : 'uap-balance-pos'}">${newBal.toFixed(2)} kr.</span>
                </div>
            </div>
            <div style="display:flex;gap:10px;">
                <button class="uap-confirm-cancel" style="flex:1;padding:12px;background:rgba(255,255,255,0.1);color:inherit;border:none;border-radius:8px;font-weight:600;font-size:14px;cursor:pointer;">Annullér</button>
                <button class="uap-confirm-ok" style="flex:1;padding:12px;background:#22c55e;color:#fff;border:none;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer;">Indbetal ${amount} kr.</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    const close = () => { document.removeEventListener('keydown', keyHandler); dialog.remove(); };

    const confirm = async () => {
        const okBtn = dialog.querySelector('.uap-confirm-ok');
        okBtn.disabled = true;
        okBtn.textContent = 'Indbetaler...';
        const success = await quickDeposit(user.id, amount);
        if (success) {
            // Update last deposit locally
            user._lastDeposit = { date: new Date().toISOString(), amount };
        }
        close();
    };

    const keyHandler = (e) => {
        if (e.key === 'Escape') close();
        else if (e.key === 'Enter') confirm();
    };
    document.addEventListener('keydown', keyHandler);

    dialog.querySelector('.uap-lightbox-close').onclick = close;
    dialog.querySelector('.uap-confirm-cancel').onclick = close;
    dialog.querySelector('.uap-confirm-ok').onclick = confirm;
    dialog.onclick = (e) => { if (e.target === dialog) close(); };

    // Focus OK button for Enter
    setTimeout(() => dialog.querySelector('.uap-confirm-ok').focus(), 50);
}

/** Open deposit history for a user */
async function openDepositHistory(user) {
    const dialog = document.createElement('div');
    dialog.className = 'uap-lightbox';
    dialog.style.zIndex = '10001';
    dialog.innerHTML = `
        <div class="uap-lightbox-inner" style="max-width:680px;padding:28px 36px;">
            <button class="uap-lightbox-close" style="position:absolute;top:12px;right:16px;">&times;</button>
            <div style="font-size:22px;font-weight:700;margin-bottom:4px;color:var(--text-primary,#e2e8f0);">Indbetalingshistorik</div>
            <div style="font-size:14px;color:var(--text-secondary,#94a3b8);margin-bottom:16px;">${escapeHtml(user.name)} <span style="opacity:0.5;">#${user.number || '?'}</span></div>
            <div id="uap-deposit-history-content" style="color:var(--text-secondary,#94a3b8);font-size:13px;">Henter...</div>
        </div>
    `;
    document.body.appendChild(dialog);

    const close = () => { document.removeEventListener('keydown', keyHandler); dialog.remove(); };
    const keyHandler = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', keyHandler);
    dialog.querySelector('.uap-lightbox-close').onclick = close;
    dialog.onclick = (e) => { if (e.target === dialog) close(); };

    // Fetch all deposits for this user
    const institutionId = getInstitutionId();
    const { data, error } = await supabaseClient
        .from('events')
        .select('details, created_at, admin_user_id, session_admin_name, admin:users!events_admin_user_id_fkey(name)')
        .eq('institution_id', institutionId)
        .eq('target_user_id', user.id)
        .eq('event_type', 'DEPOSIT')
        .order('created_at', { ascending: false });

    const content = dialog.querySelector('#uap-deposit-history-content');

    if (error) {
        content.textContent = `Fejl: ${error.message}`;
        return;
    }

    if (!data || data.length === 0) {
        content.innerHTML = '<div style="text-align:center;padding:20px;opacity:0.5;">Ingen indbetalinger registreret.</div>';
        return;
    }

    const total = data.reduce((sum, row) => sum + (row.details?.amount || 0), 0);

    content.innerHTML = `
        <div style="max-height:50vh;overflow-y:auto;border:1px solid rgba(255,255,255,0.08);border-radius:8px;">
            <table style="width:100%;border-collapse:collapse;font-size:15px;text-align:left;">
                <thead>
                    <tr>
                        <th style="padding:8px 12px;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-secondary,#94a3b8);border-bottom:1px solid rgba(255,255,255,0.08);width:45%;">Dato</th>
                        <th style="padding:8px 12px;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-secondary,#94a3b8);border-bottom:1px solid rgba(255,255,255,0.08);width:25%;">Beløb</th>
                        <th style="padding:8px 12px;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-secondary,#94a3b8);border-bottom:1px solid rgba(255,255,255,0.08);width:30%;">Registreret af</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.map(row => {
                        const d = new Date(row.created_at);
                        const dateStr = d.toLocaleDateString('da-DK', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
                        const timeStr = d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
                        const amount = row.details?.amount || 0;
                        const adminName = row.session_admin_name || row.admin?.name || '';
                        return `<tr>
                            <td style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.04);text-transform:capitalize;">${dateStr} <span style="opacity:0.5;">${timeStr}</span></td>
                            <td style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.04);color:#22c55e;font-weight:600;">+ ${amount} kr.</td>
                            <td style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.04);opacity:0.6;">${escapeHtml(adminName)}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
        <div style="display:flex;justify-content:space-between;padding:12px 4px 0;font-weight:700;font-size:14px;color:var(--text-primary,#e2e8f0);">
            <span>${data.length} indbetaling${data.length !== 1 ? 'er' : ''}</span>
            <span style="color:#22c55e;">Total: ${total.toFixed(2)} kr.</span>
        </div>
    `;
}

/** Quick deposit via RPC */
async function quickDeposit(userId, amount) {
    const { data, error } = await supabaseClient.rpc('make_deposit', {
        p_target_user_id: userId,
        p_amount: amount,
    });
    if (error) {
        console.error('[user-admin-panel] Deposit fejl:', error);
        return false;
    }
    // Update in-memory balance
    const user = allUsers.find(u => u.id === userId);
    if (user) {
        // Extract balance from RPC result
        const newBal = data?.new_balance ?? data?.balance ?? (user.balance + amount);
        user.balance = typeof newBal === 'number' ? newBal : user.balance + amount;
        // Update global state
        if (typeof window.__flangoUpdateBalance === 'function') {
            window.__flangoUpdateBalance(userId, user.balance, amount, 'user-admin-panel');
        }
    }
    renderActiveTab();
    return true;
}

// ─── Tab 1: Brugeroversigt ───

const OVERVIEW_COLS = [
    { key: 'pic', label: '', sortable: false },
    { key: 'name', label: 'Navn' },
    { key: 'number', label: 'Nummer' },
    { key: 'grade', label: 'Klassetrin' },
    { key: 'balance', label: 'Saldo' },
    { key: 'deposit', label: 'Hurtig indbetaling', sortable: false },
    { key: 'lastDeposit', label: 'Seneste indbetaling' },
    { key: 'activity', label: 'Seneste aktivitet' },
    { key: 'badges', label: 'Badges', sortable: false },
    { key: 'history', label: 'Historik', sortable: false },
    { key: 'active', label: 'Aktiv' },
    { key: 'actions', label: '', sortable: false },
];

function renderOverviewTab() {
    buildSortableHeader(OVERVIEW_COLS, 'uap-overview-thead');

    let users = getFilteredUsers();
    users = sortUsers(users, sortCol, sortDir);

    const tbody = panelEl.querySelector('#uap-overview-tbody');
    const counter = panelEl.querySelector('.uap-counter');
    counter.textContent = `${users.length} brugere`;

    const DEPOSIT_AMOUNTS = [50, 100, 150, 200];

    tbody.innerHTML = users.map(u => {
        const badges = (u.badge_label || '').split('|').filter(Boolean).map(b =>
            `<span class="uap-badge-pill">${escapeHtml(b)}</span>`
        ).join('');
        const isActive = u.show_in_user_list !== false;
        const balClass = (u.balance || 0) < 0 ? 'uap-balance-neg' : 'uap-balance-pos';
        const depositBtns = DEPOSIT_AMOUNTS.map(a =>
            `<button class="uap-deposit-btn" data-user-id="${u.id}" data-amount="${a}" title="Indbetal ${a} kr.">${a}</button>`
        ).join('');
        const isHighlighted = u.id === highlightedUserId;

        return `<tr data-user-id="${u.id}" class="${isHighlighted ? 'uap-row-highlighted' : ''}">
            <td>${profileThumb(u)}</td>
            <td><span class="uap-cell-link" data-field="name">${escapeHtml(u.name || '')}</span></td>
            <td><span class="uap-cell-link" data-field="number">${escapeHtml(u.number || '—')}</span></td>
            <td><span class="uap-cell-link" data-field="grade">${gradeLabel(u.grade_level)}</span></td>
            <td><span class="uap-cell-link ${balClass}" data-field="balance">${(u.balance || 0).toFixed(2)} kr.</span></td>
            <td style="white-space:nowrap;">${depositBtns}<button class="uap-deposit-custom-btn" data-user-id="${u.id}" title="Indbetal beløb">Indbetal</button></td>
            <td>${formatLastDeposit(u)}</td>
            <td>${daysAgo(u._lastActivity)}</td>
            <td><span class="uap-badge-link" data-user-id="${u.id}" style="cursor:pointer;">${badges || '<span class="uap-badge-add" title="Tilføj badge">＋</span>'}</span></td>
            <td><button class="uap-history-btn" data-user-name="${escapeHtml(u.name || '')}" title="Vis transaktionshistorik" style="background:none;border:none;cursor:pointer;font-size:18px;opacity:0.6;transition:opacity 0.15s;">👁</button></td>
            <td><input type="checkbox" class="uap-toggle uap-active-toggle" data-user-id="${u.id}" ${isActive ? 'checked' : ''}></td>
            <td><button class="uap-edit-btn" data-user-id="${u.id}" style="background:none;border:none;cursor:pointer;font-size:16px;" title="Rediger">✏️</button></td>
        </tr>`;
    }).join('');

    // Wire deposit history links
    tbody.querySelectorAll('.uap-deposit-link').forEach(link => {
        link.onclick = (e) => {
            e.stopPropagation();
            const user = allUsers.find(u => u.id === link.dataset.userId);
            if (user) openDepositHistory(user);
        };
    });

    // Wire profile picture thumbnails → open profile picture modal
    tbody.querySelectorAll('.uap-thumb-link').forEach(link => {
        link.onclick = async (e) => {
            e.stopPropagation();
            const user = allUsers.find(u => u.id === link.dataset.userId);
            if (!user) return;
            const { openProfilePictureModal } = await import('./profile-picture-modal.js?v=3.0.67');
            openProfilePictureModal(user, {
                onSaved: (updatedUser) => {
                    Object.assign(user, updatedUser);
                    invalidateProfilePictureCache(user.id);
                    batchPreWarmProfilePictures([user]).then(() => renderActiveTab());
                },
                showCustomAlert: (title, msg) => alert(msg),
            });
        };
    });

    // Wire history buttons → open historik V3 with user search
    tbody.querySelectorAll('.uap-history-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            openHistorikV3ForUser(btn.dataset.userName);
        };
    });

    // Wire badge links → open edit modal with badge section
    tbody.querySelectorAll('.uap-badge-link').forEach(link => {
        link.onclick = (e) => {
            e.stopPropagation();
            const userId = link.dataset.userId;
            const user = allUsers.find(u => u.id === userId);
            if (user) openEditUserModal(user, 'badge');
        };
    });

    // Wire clickable cells (name, number, grade, balance → open edit with focus)
    tbody.querySelectorAll('.uap-cell-link').forEach(link => {
        link.onclick = (e) => {
            e.stopPropagation();
            const userId = link.closest('tr').dataset.userId;
            const user = allUsers.find(u => u.id === userId);
            const field = link.dataset.field;
            if (user) openEditUserModal(user, field);
        };
    });

    // Wire edit buttons (only pencil opens edit modal, not the whole row)
    tbody.querySelectorAll('.uap-edit-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const user = allUsers.find(u => u.id === btn.dataset.userId);
            if (user) openEditUserModal(user);
        };
    });

    // Wire "Indbetal" custom buttons → open deposit modal
    tbody.querySelectorAll('.uap-deposit-custom-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const user = allUsers.find(u => u.id === btn.dataset.userId);
            if (user) openDepositModal(user);
        };
    });

    // Wire deposit buttons → confirmation dialog
    tbody.querySelectorAll('.uap-deposit-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const userId = btn.dataset.userId;
            const amount = parseInt(btn.dataset.amount);
            const user = allUsers.find(u => u.id === userId);
            if (user) openDepositConfirm(user, amount);
        };
    });

    // Wire active toggles
    tbody.querySelectorAll('.uap-active-toggle').forEach(cb => {
        cb.onchange = async (e) => {
            e.stopPropagation();
            const userId = cb.dataset.userId;
            const show = cb.checked;
            await supabaseClient.from('users').update({ show_in_user_list: show }).eq('id', userId);
            const user = allUsers.find(u => u.id === userId);
            if (user) user.show_in_user_list = show;
        };
    });
}

// ─── Tab 2: Forældreindstillinger (placeholder) ───

function renderParentsTab() {
    const tbody = panelEl.querySelector('#uap-parents-tbody');
    const thead = panelEl.querySelector('#uap-parents-thead');
    const counter = panelEl.querySelector('.uap-counter');
    const toolbarExtra = panelEl.querySelector('#uap-toolbar-extra');

    // Add portal button in toolbar
    toolbarExtra.innerHTML = `<button class="uap-portal-btn" id="uap-open-portal-btn">👨‍👩‍👧 Åbn Forældreportal</button>`;
    toolbarExtra.querySelector('#uap-open-portal-btn').onclick = () => openParentPortalAsAdmin();

    thead.innerHTML = '<th>Forældreindstillinger-tab er under udvikling...</th>';
    tbody.innerHTML = '';
    counter.textContent = '';
}

// ─── Tab 3: Statistik (placeholder) ───

function renderStatsTab() {
    const tbody = panelEl.querySelector('#uap-stats-tbody');
    const thead = panelEl.querySelector('#uap-stats-thead');
    thead.innerHTML = '<th>Statistik-tab er under udvikling...</th>';
    tbody.innerHTML = '';

    const counter = panelEl.querySelector('.uap-counter');
    counter.textContent = '';
}

// ─── Tab 4: Profilbilleder ───

let ppEntries = null; // cached profile_picture_library entries
let ppSignedUrls = new Map();
let ppFilter = 'all';
let ppHasFilter = 'with'; // 'all' | 'with' | 'without' — filter by has/hasn't picture
let ppViewMode = 'list'; // 'grid' | 'list'
let ppSortCol = 'created_at';
let ppSortDir = 'desc';

const PP_TYPE_LABELS = {
    upload: { emoji: '📤', label: 'Upload', bg: '#dbeafe', color: '#1d4ed8' },
    aula: { emoji: '📥', label: 'Aula', bg: '#d1fae5', color: '#065f46' },
    camera: { emoji: '📷', label: 'Kamera', bg: '#fef3c7', color: '#92400e' },
    ai_avatar: { emoji: '🤖', label: 'AI', bg: '#ede9fe', color: '#6d28d9' },
    library: { emoji: '🎨', label: 'Bibliotek', bg: '#fce7f3', color: '#9d174d' },
    icon: { emoji: '🖼️', label: 'Ikon', bg: '#e0e7ff', color: '#3730a3' },
};

const PP_FILTERS = [
    { key: 'all', label: 'Alle' },
    { key: 'ai_avatar', label: '🤖 AI' },
    { key: 'upload', label: '📤 Upload' },
    { key: 'aula', label: '📥 Aula' },
    { key: 'camera', label: '📷 Kamera' },
    { key: 'library', label: '🎨 Bibliotek' },
];

async function renderPicturesTab() {
    const content = panelEl.querySelector('#uap-pictures-content');
    const counter = panelEl.querySelector('.uap-counter');
    const toolbarExtra = panelEl.querySelector('#uap-toolbar-extra');

    // Render toolbar extras (filters + view toggle)
    toolbarExtra.innerHTML = `
        <div class="uap-filters" id="uap-pp-filters">
            ${PP_FILTERS.map(f => `<button class="uap-chip ${ppFilter === f.key ? 'active' : ''}" data-filter="${f.key}">${f.label}</button>`).join('')}
            <span style="width:1px;height:20px;background:rgba(255,255,255,0.12);margin:0 4px;"></span>
            <button class="uap-chip ${ppHasFilter === 'all' ? 'active' : ''}" data-has="all">Alle</button>
            <button class="uap-chip ${ppHasFilter === 'with' ? 'active' : ''}" data-has="with">Med billede</button>
            <button class="uap-chip ${ppHasFilter === 'without' ? 'active' : ''}" data-has="without">Uden billede</button>
            <span style="width:1px;height:20px;background:rgba(255,255,255,0.12);margin:0 4px;"></span>
            <button class="uap-chip ${ppViewMode === 'list' ? 'active' : ''}" data-view="list">📋 Liste</button>
            <button class="uap-chip ${ppViewMode === 'grid' ? 'active' : ''}" data-view="grid">🔲 Grid</button>
        </div>
    `;

    // Wire filter chips + has-filter + view toggles (all in same row)
    toolbarExtra.querySelectorAll('.uap-chip').forEach(chip => {
        if (chip.dataset.filter) {
            chip.onclick = () => {
                ppFilter = chip.dataset.filter;
                renderPicturesContent();
                toolbarExtra.querySelectorAll('.uap-chip[data-filter]').forEach(c => c.classList.toggle('active', c.dataset.filter === ppFilter));
            };
        } else if (chip.dataset.has) {
            chip.onclick = () => {
                ppHasFilter = chip.dataset.has;
                renderPicturesContent();
                toolbarExtra.querySelectorAll('.uap-chip[data-has]').forEach(c => c.classList.toggle('active', c.dataset.has === ppHasFilter));
            };
        } else if (chip.dataset.view) {
            chip.onclick = () => {
                ppViewMode = chip.dataset.view;
                renderPicturesContent();
                toolbarExtra.querySelectorAll('.uap-chip[data-view]').forEach(c => c.classList.toggle('active', c.dataset.view === ppViewMode));
            };
        }
    });

    // Fetch data if not cached
    if (!ppEntries) {
        content.innerHTML = '<div class="uap-loading">Henter profilbilleder...</div>';
        const institutionId = getInstitutionId();

        const { data, error } = await supabaseClient
            .from('profile_picture_library')
            .select('*')
            .eq('institution_id', institutionId)
            .order('created_at', { ascending: false });

        if (error) {
            content.innerHTML = `<div class="uap-empty">Fejl: ${error.message}</div>`;
            return;
        }

        ppEntries = data || [];

        // Generate signed URLs for storage-based entries
        const storageEntries = ppEntries.filter(e =>
            e.storage_path && !e.storage_path.startsWith('http') &&
            e.picture_type !== 'library' && e.picture_type !== 'icon'
        );
        if (storageEntries.length > 0) {
            const paths = storageEntries.map(e => e.storage_path);
            const { data: signedData } = await supabaseClient.storage
                .from('profile-pictures')
                .createSignedUrls(paths, 3600);
            if (signedData) {
                signedData.forEach((item, i) => {
                    if (item.signedUrl) ppSignedUrls.set(storageEntries[i].id, item.signedUrl);
                });
            }
        }
    }

    renderPicturesContent();
}

function renderPicturesContent() {
    const content = panelEl.querySelector('#uap-pictures-content');
    const counter = panelEl.querySelector('.uap-counter');
    if (!content || !ppEntries) return;

    // Filter
    let entries = ppEntries;
    if (ppFilter !== 'all') {
        entries = entries.filter(e => e.picture_type === ppFilter);
    }

    // Search filter
    if (searchQuery) {
        entries = entries.filter(e =>
            (e.user_name || '').toLowerCase().includes(searchQuery)
        );
    }

    // Count unique users
    const uniqueUsers = new Set(entries.map(e => e.user_id));
    counter.textContent = `${entries.length} billeder · ${uniqueUsers.size} brugere`;

    if (ppViewMode === 'grid') {
        if (entries.length === 0) {
            content.innerHTML = '<div class="uap-empty">Ingen profilbilleder fundet.</div>';
            return;
        }
        renderPicturesGrid(content, entries);
    } else {
        renderPicturesList(content, entries);
    }
}

function getPPUrl(entry) {
    if (entry.picture_type === 'library' || entry.picture_type === 'icon') return entry.storage_path;
    if (entry.storage_path?.startsWith('http')) return entry.storage_path;
    return ppSignedUrls.get(entry.id) || entry.storage_path;
}

function renderPicturesGrid(container, entries) {
    container.innerHTML = `<div class="uap-pp-grid"></div>`;
    const grid = container.querySelector('.uap-pp-grid');

    grid.innerHTML = entries.map(entry => {
        const url = getPPUrl(entry);
        const typeInfo = PP_TYPE_LABELS[entry.picture_type] || PP_TYPE_LABELS.upload;
        const userName = entry.user_name || 'Ukendt';
        const user = allUsers.find(u => u.id === entry.user_id);
        const number = user?.number || '';

        return `
            <div class="uap-pp-card ${entry.is_active ? 'active-pic' : ''}" data-entry-id="${entry.id}">
                <span class="uap-pp-type-badge" style="background:${typeInfo.bg};color:${typeInfo.color};">${typeInfo.emoji}</span>
                ${entry.is_active ? '<span style="position:absolute;top:4px;right:4px;font-size:10px;color:#22c55e;">●</span>' : ''}
                <img src="${url}" alt="" class="uap-pp-card-img" loading="lazy" onerror="this.style.display='none';">
                <div class="uap-pp-card-name">${escapeHtml(userName)}${number ? ` #${number}` : ''}</div>
            </div>
        `;
    }).join('');

    // Wire click → lightbox
    grid.querySelectorAll('.uap-pp-card').forEach(card => {
        card.onclick = () => {
            const entry = ppEntries.find(e => e.id === card.dataset.entryId);
            if (entry) openPPLightbox(entry);
        };
    });
}

function renderPicturesList(container, entries) {
    // Group entries by user
    const byUser = new Map();
    for (const entry of entries) {
        if (!byUser.has(entry.user_id)) byUser.set(entry.user_id, []);
        byUser.get(entry.user_id).push(entry);
    }

    // Build rows for ALL users (not just those with pictures)
    let userRows = allUsers
        .filter(u => u.role === 'kunde' || u.role === 'admin' || byUser.has(u.id))
        .map(u => ({
            userId: u.id,
            user: u,
            entries: byUser.get(u.id) || [],
            name: u.name || '',
        }));

    // Apply has/hasn't picture filter
    if (ppHasFilter === 'with') {
        userRows = userRows.filter(row => row.entries.length > 0);
    } else if (ppHasFilter === 'without') {
        userRows = userRows.filter(row => row.entries.length === 0);
    }

    // Apply search filter on user name (includes users without pictures)
    if (searchQuery) {
        userRows = userRows.filter(row => row.name.toLowerCase().includes(searchQuery));
    }

    // Sort — all columns sortable
    userRows.sort((a, b) => {
        let va, vb;
        if (ppSortCol === 'user') { va = a.name.toLowerCase(); vb = b.name.toLowerCase(); }
        else if (ppSortCol === 'number') {
            va = a.user?.number != null ? parseInt(a.user.number) : Infinity;
            vb = b.user?.number != null ? parseInt(b.user.number) : Infinity;
        }
        else if (ppSortCol === 'grade') {
            va = a.user?.grade_level != null ? a.user.grade_level : Infinity;
            vb = b.user?.grade_level != null ? b.user.grade_level : Infinity;
        }
        else if (ppSortCol === 'pictures' || ppSortCol === 'count') { va = a.entries.length; vb = b.entries.length; }
        else { va = a.name.toLowerCase(); vb = b.name.toLowerCase(); }
        if (va < vb) return ppSortDir === 'asc' ? -1 : 1;
        if (va > vb) return ppSortDir === 'asc' ? 1 : -1;
        return 0;
    });

    const LIST_COLS = [
        { key: 'user', label: 'Bruger' },
        { key: 'number', label: 'Nummer' },
        { key: 'grade', label: 'Klassetrin' },
        { key: 'pictures', label: 'Profilbilleder' },
        { key: 'count', label: 'Antal' },
    ];

    container.innerHTML = `
        <div class="uap-table-wrap">
            <table class="uap-table">
                <thead><tr id="uap-pp-list-thead">
                    ${LIST_COLS.map(col => {
                        const isSorted = ppSortCol === col.key;
                        const arrow = isSorted ? (ppSortDir === 'asc' ? '▲' : '▼') : '';
                        return `<th data-col="${col.key}" class="${isSorted ? 'sorted' : ''}" ${col.sortable === false ? 'style="cursor:default;"' : ''}>
                            ${col.label}${arrow ? `<span class="sort-arrow">${arrow}</span>` : ''}
                        </th>`;
                    }).join('')}
                </tr></thead>
                <tbody id="uap-pp-list-tbody"></tbody>
            </table>
        </div>
    `;

    const tbody = container.querySelector('#uap-pp-list-tbody');
    tbody.innerHTML = userRows.map(row => {
        let picCell;
        if (row.entries.length > 0) {
            const thumbs = row.entries.map(entry => {
                const url = getPPUrl(entry);
                const typeInfo = PP_TYPE_LABELS[entry.picture_type] || PP_TYPE_LABELS.upload;
                const activeBorder = entry.is_active ? '2px solid #22c55e' : '2px solid transparent';
                return `<div class="uap-pp-list-thumb" data-entry-id="${entry.id}" title="${typeInfo.label}${entry.is_active ? ' (aktiv)' : ''} — klik for at aktivere" style="position:relative;cursor:pointer;flex-shrink:0;">
                    <img src="${url}" alt="" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:${activeBorder};transition:border-color 0.15s;" loading="lazy" onerror="this.style.display='none';">
                    <span style="position:absolute;bottom:-2px;right:-2px;font-size:9px;padding:0 3px;border-radius:6px;background:${typeInfo.bg};color:${typeInfo.color};font-weight:700;line-height:1.4;">${typeInfo.emoji}</span>
                </div>`;
            }).join('');
            picCell = `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">${thumbs}</div>`;
        } else {
            // Show institution default profile picture
            const inst = window.__flangoGetInstitutionById?.(row.user?.institution_id);
            const def = getDefaultProfilePicture(row.name, inst);
            if (def.type === 'anonymous') {
                picCell = `<div style="width:44px;height:44px;border-radius:50%;background:rgba(148,163,184,0.15);display:flex;align-items:center;justify-content:center;font-size:20px;cursor:pointer;" title="Klik for at tilføje billede">👤</div>`;
            } else if (def.type === 'image' && def.value) {
                picCell = `<img src="${def.value}" alt="" style="width:44px;height:44px;border-radius:50%;object-fit:cover;cursor:pointer;border:2px dashed rgba(255,255,255,0.15);" title="Klik for at tilføje billede">`;
            } else {
                const initials = (row.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                picCell = `<div style="width:44px;height:44px;border-radius:50%;background:rgba(99,102,241,0.12);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:#6366f1;cursor:pointer;" title="Klik for at tilføje billede">${initials}</div>`;
            }
        }

        return `<tr data-user-id="${row.userId}" style="${row.entries.length === 0 ? 'opacity:0.8;' : ''}">
            <td>${escapeHtml(row.name)}</td>
            <td>${escapeHtml(row.user?.number || '—')}</td>
            <td>${gradeLabel(row.user?.grade_level)}</td>
            <td>${picCell}</td>
            <td>${row.entries.length}</td>
        </tr>`;
    }).join('');

    // Wire sort headers
    container.querySelectorAll('#uap-pp-list-thead th[data-col]').forEach(th => {
        const col = LIST_COLS.find(c => c.key === th.dataset.col);
        if (col?.sortable === false) return;
        th.style.cursor = 'pointer';
        th.onclick = () => {
            if (ppSortCol === col.key) ppSortDir = ppSortDir === 'asc' ? 'desc' : 'asc';
            else { ppSortCol = col.key; ppSortDir = 'asc'; }
            renderPicturesContent();
        };
    });

    // Wire thumbnail clicks → open lightbox (user-scoped navigation)
    tbody.querySelectorAll('.uap-pp-list-thumb').forEach(thumb => {
        thumb.onclick = (e) => {
            e.stopPropagation();
            const entry = ppEntries.find(en => en.id === thumb.dataset.entryId);
            if (entry) openPPLightbox(entry, 'user', userRows);
        };
    });

    // Wire row click → open lightbox for first/active pic, or open modal for users without pics
    tbody.querySelectorAll('tr').forEach(tr => {
        tr.onclick = async (e) => {
            if (e.target.closest('.uap-pp-list-thumb')) return;
            const userId = tr.dataset.userId;
            const activeEntry = ppEntries.find(en => en.user_id === userId && en.is_active)
                || ppEntries.find(en => en.user_id === userId);
            if (activeEntry) {
                openPPLightbox(activeEntry, 'user', userRows);
            } else {
                // No pictures — create a fake "default" entry and open lightbox
                const user = allUsers.find(u => u.id === userId);
                if (user) {
                    const inst = window.__flangoGetInstitutionById?.(user.institution_id);
                    const def = await getDefaultProfilePictureAsync(user.name, inst);
                    const fakeEntry = {
                        id: '__default__' + userId,
                        user_id: userId,
                        user_name: user.name,
                        picture_type: 'default',
                        is_active: false,
                        storage_path: def.type === 'image' ? def.value : null,
                        _isDefault: true,
                        _defaultType: def.type,
                        _defaultValue: def.value,
                    };
                    openPPLightbox(fakeEntry, 'user', userRows);
                }
            }
        };
    });
}

function getNavigableEntries() {
    let entries = ppEntries || [];
    if (ppFilter !== 'all') entries = entries.filter(e => e.picture_type === ppFilter);
    if (searchQuery) entries = entries.filter(e => (e.user_name || '').toLowerCase().includes(searchQuery));
    return entries;
}

/**
 * Open lightbox.
 * @param {object} entry - The entry to show
 * @param {'all'|'user'} mode - 'all' = flat nav (grid), 'user' = per-user nav with up/down for users (list)
 * @param {Array} userRows - sorted user rows (only for mode='user')
 */
function openPPLightbox(entry, mode = 'all', userRows = null) {
    let navigable, currentIdx;

    // For user mode: build per-user navigation
    let userRowIdx = 0;
    let userEntries = [];

    function buildUserNav() {
        if (mode === 'user' && userRows) {
            userRowIdx = userRows.findIndex(r => r.userId === entry.user_id);
            if (userRowIdx < 0) userRowIdx = 0;
            userEntries = userRows[userRowIdx]?.entries || [];
            // If user has no entries but we have a default fake entry, use it
            if (userEntries.length === 0 && entry._isDefault) {
                userEntries = [entry];
            }
            navigable = userEntries;
            currentIdx = navigable.findIndex(e => e.id === entry.id);
            if (currentIdx < 0) currentIdx = 0;
        } else {
            navigable = getNavigableEntries();
            currentIdx = navigable.findIndex(e => e.id === entry.id);
            if (currentIdx < 0) currentIdx = 0;
        }
    }
    buildUserNav();

    const lb = document.createElement('div');
    lb.className = 'uap-lightbox';
    document.body.appendChild(lb);

    function renderLightboxContent() {
        const current = navigable[currentIdx];
        if (!current) return;
        const isDefault = current._isDefault === true;
        const url = isDefault
            ? (current._defaultType === 'image' ? current._defaultValue : null)
            : getPPUrl(current);
        const typeInfo = isDefault
            ? { emoji: '⚙️', label: 'Standard', bg: 'rgba(100,116,139,0.2)', color: '#94a3b8' }
            : (PP_TYPE_LABELS[current.picture_type] || PP_TYPE_LABELS.upload);
        const user = allUsers.find(u => u.id === current.user_id);
        const created = current.created_at ? new Date(current.created_at).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
        const pos = `${currentIdx + 1} / ${navigable.length}`;

        // Default image display — uses same uap-lightbox-img class for consistent sizing
        let imgHtml;
        if (isDefault && !url) {
            const defType = current._defaultType;
            if (defType === 'anonymous') {
                imgHtml = `<div class="uap-lightbox-img uap-lightbox-img-default" style="background:#334155;">
                    <svg viewBox="0 0 24 24" fill="rgba(148,163,184,0.5)" style="width:55%;height:55%;"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
                </div>`;
            } else {
                const initials = (user?.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                imgHtml = `<div class="uap-lightbox-img uap-lightbox-img-default" style="background:rgba(99,102,241,0.15);color:#6366f1;">${initials}</div>`;
            }
        } else {
            imgHtml = `<img src="${url}" alt="" class="uap-lightbox-img" style="cursor:zoom-in;" title="Klik for fuld størrelse">`;
        }

        lb.innerHTML = `
            <button class="uap-lightbox-close">&times;</button>
            <button class="uap-lb-nav uap-lb-prev" ${currentIdx === 0 ? 'disabled' : ''}>‹</button>
            <div class="uap-lightbox-inner">
                ${imgHtml}
                <div style="font-size:22px;font-weight:700;margin-bottom:4px;color:var(--text-primary,#e2e8f0);">${escapeHtml(user?.name || current.user_name || 'Ukendt')}</div>
                <div style="font-size:15px;color:var(--text-secondary,#94a3b8);margin-bottom:12px;">
                    ${user?.number ? `#${user.number}` : ''}${user?.number && user?.grade_level != null ? ' · ' : ''}${user?.grade_level != null ? gradeLabel(user.grade_level) : ''}${!isDefault && created ? ` · ${created}` : ''}
                </div>
                <div class="uap-lb-actions">
                    ${!current.is_active && !isDefault ? `<button class="uap-lb-btn uap-lb-activate" style="background:#22c55e;">Sæt som aktiv</button>` : ''}
                    <button class="uap-lb-btn uap-lb-add" style="background:#8b5cf6;">＋ Tilføj nyt</button>
                    ${!isDefault ? `<button class="uap-lb-btn uap-lb-edit" style="background:#3b82f6;">✏️ Rediger</button>` : ''}
                    <button class="uap-lb-btn uap-lb-avatar" style="background:${isDefault ? '#64748b' : '#f59e0b'};${isDefault ? 'opacity:0.5;cursor:not-allowed;' : ''}">🤖 Avatar</button>
                    ${!isDefault ? `<button class="uap-lb-btn uap-lb-download" style="background:#0ea5e9;">⬇ Download</button>` : ''}
                    ${!isDefault ? `<button class="uap-lb-btn uap-lb-delete" style="background:#ef4444;">Slet</button>` : ''}
                </div>
                <div class="uap-lb-editor" style="display:none;">
                    <div style="margin-bottom:12px;font-size:13px;color:var(--text-secondary,#94a3b8);">Træk for at flytte · Scroll for at zoome</div>
                    <div class="uap-crop-container">
                        <div class="uap-crop-circle">
                            <img src="${url}" alt="" class="uap-crop-img" draggable="false">
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:12px;margin-top:12px;justify-content:center;">
                        <span style="font-size:12px;">🔍</span>
                        <input type="range" class="uap-crop-zoom" min="100" max="300" value="100" style="width:200px;accent-color:#3b82f6;">
                        <span class="uap-crop-zoom-label" style="font-size:12px;min-width:36px;">100%</span>
                    </div>
                    <div style="display:flex;gap:8px;justify-content:center;margin-top:14px;">
                        <button class="uap-crop-cancel" style="padding:8px 20px;background:rgba(255,255,255,0.1);color:inherit;border:none;border-radius:8px;font-weight:600;cursor:pointer;">Annullér</button>
                        <button class="uap-crop-save" style="padding:8px 20px;background:#3b82f6;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;">Gem beskæring</button>
                    </div>
                </div>
                <div style="display:flex;align-items:center;font-size:11px;color:var(--text-secondary,#64748b);">
                    <div style="flex:1;text-align:left;">Kilde: ${typeInfo.label}${current.ai_style ? ` · ${current.ai_style}` : ''}${current.ai_prompt ? ' · <span class="uap-lb-show-prompt" style="cursor:pointer;color:#f59e0b;font-weight:600;text-transform:uppercase;">Vis Prompt</span>' : ''}</div>
                    <div style="flex:0 0 auto;text-align:center;">${pos}${mode === 'user' && userRows && userRows.length > 1 ? ` · Bruger ${userRowIdx + 1}/${userRows.length}` : ''} · ← → billeder${mode === 'user' ? ' · ↑ ↓ brugere' : ''}</div>
                    <div style="flex:1;text-align:right;font-weight:600;">${current.is_active ? '<span style="color:#22c55e;">● Aktiv</span>' : (isDefault ? '<span style="opacity:0.5;">Intet billede</span>' : '')}</div>
                </div>
            </div>
            <button class="uap-lb-nav uap-lb-next" ${currentIdx >= navigable.length - 1 ? 'disabled' : ''}>›</button>
        `;

        // Wire close
        lb.querySelector('.uap-lightbox-close').onclick = closeLightbox;
        lb.onclick = (e) => { if (e.target === lb) closeLightbox(); };

        // Wire nav
        lb.querySelector('.uap-lb-prev').onclick = (e) => { e.stopPropagation(); navigate(-1); };
        lb.querySelector('.uap-lb-next').onclick = (e) => { e.stopPropagation(); navigate(1); };

        // Wire zoom — click on image to view full size
        // Wire zoom — click on image to view full size with navigation
        const lbImg = lb.querySelector('.uap-lightbox-img');
        if (lbImg && url && !isDefault) {
            lbImg.onclick = (e) => {
                e.stopPropagation();
                openZoomOverlay();
            };
        }

        function openZoomOverlay() {
            const cur = navigable[currentIdx];
            if (!cur || cur._isDefault) return;
            const zoomUrl = getPPUrl(cur);
            if (!zoomUrl) return;

            const existing = document.querySelector('.uap-zoom-overlay');
            if (existing) existing.remove();

            const zoom = document.createElement('div');
            zoom.className = 'uap-zoom-overlay';
            zoom.style.cssText = 'position:fixed;inset:0;z-index:100002;background:rgba(0,0,0,0.95);display:flex;align-items:center;justify-content:center;';
            zoom.innerHTML = `
                <button class="uap-zoom-prev" style="position:absolute;left:16px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.1);border:none;color:#fff;font-size:36px;width:50px;height:50px;border-radius:50%;cursor:pointer;z-index:2;" ${currentIdx === 0 ? 'disabled' : ''}>‹</button>
                <img src="${zoomUrl}" alt="" style="max-width:90vw;max-height:90vh;object-fit:contain;border-radius:8px;box-shadow:0 0 60px rgba(0,0,0,0.5);cursor:zoom-out;">
                <button class="uap-zoom-next" style="position:absolute;right:16px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.1);border:none;color:#fff;font-size:36px;width:50px;height:50px;border-radius:50%;cursor:pointer;z-index:2;" ${currentIdx >= navigable.length - 1 ? 'disabled' : ''}>›</button>
                <div class="uap-zoom-info" style="position:absolute;bottom:20px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,0.5);font-size:12px;">${currentIdx + 1} / ${navigable.length}${mode === 'user' && userRows && userRows.length > 1 ? ` · Bruger ${userRowIdx + 1}/${userRows.length} · ↑ ↓ brugere` : ''}</div>
            `;
            document.body.appendChild(zoom);

            function updateZoom() {
                const c = navigable[currentIdx];
                if (!c || c._isDefault) { closeZoom(); return; }
                const u = getPPUrl(c);
                if (!u) { closeZoom(); return; }
                zoom.querySelector('img').src = u;
                zoom.querySelector('.uap-zoom-prev').disabled = currentIdx === 0;
                zoom.querySelector('.uap-zoom-next').disabled = currentIdx >= navigable.length - 1;
                zoom.querySelector('.uap-zoom-info').textContent = `${currentIdx + 1} / ${navigable.length}${mode === 'user' && userRows && userRows.length > 1 ? ` · Bruger ${userRowIdx + 1}/${userRows.length} · ↑ ↓ brugere` : ''}`;
            }

            function zoomNav(dir) {
                const newIdx = currentIdx + dir;
                if (newIdx < 0 || newIdx >= navigable.length) return;
                currentIdx = newIdx;
                updateZoom();
            }

            function zoomNavUser(dir) {
                if (mode !== 'user' || !userRows || userRows.length <= 1) return;
                const newRowIdx = userRowIdx + dir;
                if (newRowIdx < 0 || newRowIdx >= userRows.length) return;
                userRowIdx = newRowIdx;
                const row = userRows[userRowIdx];
                userEntries = row?.entries || [];
                if (userEntries.length === 0) { zoomNavUser(dir); return; } // skip users without pics
                navigable = userEntries;
                currentIdx = 0;
                updateZoom();
            }

            zoom.querySelector('img').onclick = (ev) => { ev.stopPropagation(); closeZoom(); };
            zoom.onclick = (ev) => { if (ev.target === zoom) closeZoom(); };
            zoom.querySelector('.uap-zoom-prev').onclick = (ev) => { ev.stopPropagation(); zoomNav(-1); };
            zoom.querySelector('.uap-zoom-next').onclick = (ev) => { ev.stopPropagation(); zoomNav(1); };

            const zoomKey = (ev) => {
                if (ev.key === 'Escape') { closeZoom(); ev.stopPropagation(); }
                else if (ev.key === 'ArrowLeft') { zoomNav(-1); ev.stopPropagation(); }
                else if (ev.key === 'ArrowRight') { zoomNav(1); ev.stopPropagation(); }
                else if (ev.key === 'ArrowUp') { ev.preventDefault(); ev.stopPropagation(); zoomNavUser(-1); }
                else if (ev.key === 'ArrowDown') { ev.preventDefault(); ev.stopPropagation(); zoomNavUser(1); }
            };
            document.addEventListener('keydown', zoomKey, true);

            function closeZoom() {
                zoom.remove();
                document.removeEventListener('keydown', zoomKey, true);
                renderLightboxContent();
            }
        }

        // Wire activate
        lb.querySelector('.uap-lb-activate')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            const { applyProfilePicture } = await import('../core/profile-picture-utils.js?v=3.0.67');
            const result = await applyProfilePicture(current.user_id, current);
            if (result.success) {
                ppEntries.forEach(en => {
                    if (en.user_id === current.user_id) en.is_active = (en.id === current.id);
                });
                const u = allUsers.find(u => u.id === current.user_id);
                if (u) { u.profile_picture_url = current.storage_path; u.profile_picture_type = current.picture_type; }
                renderLightboxContent();
                renderPicturesContent();
            }
        });

        // Wire download
        lb.querySelector('.uap-lb-download')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                const resp = await fetch(url);
                const blob = await resp.blob();
                const ext = blob.type === 'image/png' ? '.png' : '.webp';
                const fileName = `${(user?.name || current.user_name || 'profilbillede').replace(/[\/\\:*?"<>|]/g, '_')}${ext}`;
                const dlUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = dlUrl; a.download = fileName;
                document.body.appendChild(a); a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(dlUrl);
            } catch (err) {
                console.error('[uap] Download fejl:', err);
            }
        });

        // Wire "Vis Prompt"
        lb.querySelector('.uap-lb-show-prompt')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const current = navigable[currentIdx];
            if (!current?.ai_prompt) return;
            // Split into main prompt and suffix (old images have "\nDo NOT reproduce..." appended server-side)
            const suffixMatch = current.ai_prompt.match(/^([\s\S]*?)(\nDo NOT reproduce the photo\..*)$/);
            const mainPrompt = suffixMatch ? suffixMatch[1] : current.ai_prompt;
            const suffixText = suffixMatch ? suffixMatch[2].trim() : '';
            const overlay = document.createElement('div');
            overlay.className = 'uap-prompt-overlay';
            overlay.style.cssText = 'position:fixed;inset:0;z-index:100001;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:24px;';
            overlay.innerHTML = `<div style="max-width:640px;width:100%;max-height:80vh;overflow-y:auto;background:#1e293b;border-radius:12px;padding:24px;color:#e2e8f0;font-family:monospace;font-size:13px;white-space:pre-wrap;word-break:break-word;line-height:1.6;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                    <span style="font-family:inherit;font-weight:700;font-size:14px;color:#f59e0b;">AI Prompt</span>
                    <button class="uap-prompt-close" style="background:none;border:none;color:#94a3b8;font-size:20px;cursor:pointer;padding:0 4px;">&times;</button>
                </div>${escapeHtml(mainPrompt)}${suffixText ? `\n\n<span style="color:#64748b;font-size:11px;font-weight:600;">SUFFIX (auto-tilføjet):</span>\n<span style="color:#64748b;font-size:12px;">${escapeHtml(suffixText)}</span>` : ''}</div>`;
            lb.appendChild(overlay);
            const closePrompt = () => overlay.remove();
            overlay.addEventListener('click', (ev) => { if (ev.target === overlay) closePrompt(); });
            overlay.querySelector('.uap-prompt-close').addEventListener('click', closePrompt);
            const escHandler = (ev) => { if (ev.key === 'Escape') { closePrompt(); ev.stopPropagation(); document.removeEventListener('keydown', escHandler, true); } };
            document.addEventListener('keydown', escHandler, true);
        });

        // Wire add new (open profile picture modal for this user)
        lb.querySelector('.uap-lb-add')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            const currentUser = allUsers.find(u => u.id === current.user_id) || { ...current, id: current.user_id, name: current.user_name };
            const { openProfilePictureModal } = await import('./profile-picture-modal.js?v=3.0.67');
            openProfilePictureModal(currentUser, {
                onSaved: (updatedUser) => {
                    Object.assign(currentUser, updatedUser);
                    ppEntries = null;
                    ppSignedUrls.clear();
                    closeLightbox();
                    renderPicturesTab();
                },
                showCustomAlert: (title, msg) => alert(msg),
            });
        });

        // Wire avatar (AI generation from current image) — disabled for default entries
        lb.querySelector('.uap-lb-avatar')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (current._isDefault) return; // Don't use default image as AI reference
            const currentUser = allUsers.find(u => u.id === current.user_id) || { ...current, id: current.user_id, name: current.user_name };
            const { openProfilePictureModal } = await import('./profile-picture-modal.js?v=3.0.67');
            openProfilePictureModal(currentUser, {
                preSelectType: 'ai_avatar',
                referenceImageUrl: url,
                onSaved: (updatedUser) => {
                    Object.assign(currentUser, updatedUser);
                    // Refresh library cache
                    ppEntries = null;
                    ppSignedUrls.clear();
                    closeLightbox();
                    renderPicturesTab();
                },
                showCustomAlert: (title, msg) => alert(msg),
            });
        });

        // Wire edit (crop/pan)
        lb.querySelector('.uap-lb-edit')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const editor = lb.querySelector('.uap-lb-editor');
            const mainImg = lb.querySelector('.uap-lightbox-img');
            if (!editor) return;

            // Toggle editor
            const isVisible = editor.style.display !== 'none';
            if (isVisible) { editor.style.display = 'none'; mainImg.style.display = ''; return; }
            editor.style.display = 'block';
            mainImg.style.display = 'none';

            // Setup crop interaction
            const cropContainer = editor.querySelector('.uap-crop-container');
            const cropImg = editor.querySelector('.uap-crop-img');
            const zoomSlider = editor.querySelector('.uap-crop-zoom');
            const zoomLabel = editor.querySelector('.uap-crop-zoom-label');

            let scale = 1, offsetX = 0, offsetY = 0, imgW = 0, imgH = 0;

            // Load image dimensions
            const tempImg = new Image();
            tempImg.onload = () => {
                imgW = tempImg.naturalWidth;
                imgH = tempImg.naturalHeight;
                // Fit image to cover the circle (300x300)
                const containerSize = 300;
                const fitScale = Math.max(containerSize / imgW, containerSize / imgH);
                cropImg.style.width = (imgW * fitScale) + 'px';
                cropImg.style.height = (imgH * fitScale) + 'px';
                imgW = imgW * fitScale;
                imgH = imgH * fitScale;
                // Center
                offsetX = (containerSize - imgW) / 2;
                offsetY = (containerSize - imgH) / 2;
                updateTransform();
            };
            tempImg.src = url;

            function updateTransform() {
                cropImg.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
                cropImg.style.transformOrigin = '0 0';
            }

            // Drag
            let isDragging = false, startX = 0, startY = 0, startOX = 0, startOY = 0;

            cropContainer.onpointerdown = (ev) => {
                isDragging = true;
                startX = ev.clientX; startY = ev.clientY;
                startOX = offsetX; startOY = offsetY;
                cropContainer.setPointerCapture(ev.pointerId);
            };
            cropContainer.onpointermove = (ev) => {
                if (!isDragging) return;
                offsetX = startOX + (ev.clientX - startX);
                offsetY = startOY + (ev.clientY - startY);
                updateTransform();
            };
            cropContainer.onpointerup = () => { isDragging = false; };

            // Zoom via scroll
            cropContainer.onwheel = (ev) => {
                ev.preventDefault();
                const delta = ev.deltaY > 0 ? -0.05 : 0.05;
                scale = Math.max(0.5, Math.min(3, scale + delta));
                zoomSlider.value = Math.round(scale * 100);
                zoomLabel.textContent = Math.round(scale * 100) + '%';
                updateTransform();
            };

            // Zoom via slider
            zoomSlider.oninput = () => {
                scale = parseInt(zoomSlider.value) / 100;
                zoomLabel.textContent = Math.round(scale * 100) + '%';
                updateTransform();
            };

            // Cancel
            editor.querySelector('.uap-crop-cancel').onclick = () => {
                editor.style.display = 'none';
                mainImg.style.display = '';
            };

            // Save crop
            editor.querySelector('.uap-crop-save').onclick = async () => {
                const saveBtn = editor.querySelector('.uap-crop-save');
                saveBtn.disabled = true;
                saveBtn.textContent = 'Gemmer...';

                try {
                    // Fetch image as blob to avoid tainted canvas (cross-origin signed URL)
                    const imgResp = await fetch(url);
                    const imgBlob = await imgResp.blob();
                    const blobUrl = URL.createObjectURL(imgBlob);
                    const cleanImg = new Image();
                    await new Promise((resolve, reject) => {
                        cleanImg.onload = resolve;
                        cleanImg.onerror = reject;
                        cleanImg.src = blobUrl;
                    });

                    // Render cropped image to canvas
                    const canvas = document.createElement('canvas');
                    canvas.width = 400;
                    canvas.height = 400;
                    const ctx = canvas.getContext('2d');

                    // Map crop coordinates to source image
                    const containerSize = 300;
                    const scaleRatioX = cleanImg.naturalWidth / imgW;
                    const scaleRatioY = cleanImg.naturalHeight / imgH;
                    const sx = (-offsetX / scale) * scaleRatioX;
                    const sy = (-offsetY / scale) * scaleRatioY;
                    const sSize = (containerSize / scale) * scaleRatioX;

                    ctx.drawImage(cleanImg, sx, sy, sSize, sSize, 0, 0, 400, 400);
                    URL.revokeObjectURL(blobUrl);

                    // Convert to webp blob
                    const blob = await new Promise(r => canvas.toBlob(r, 'image/webp', 0.85));

                    // Upload as new version
                    const institutionId = getInstitutionId();
                    const storagePath = `${institutionId}/${current.user_id}_${Date.now()}.webp`;

                    const { error: uploadError } = await supabaseClient.storage
                        .from('profile-pictures')
                        .upload(storagePath, blob, { contentType: 'image/webp', cacheControl: '31536000' });

                    if (uploadError) throw new Error(uploadError.message);

                    // Update library entry with new path
                    await supabaseClient
                        .from('profile_picture_library')
                        .update({ storage_path: storagePath })
                        .eq('id', current.id);

                    current.storage_path = storagePath;

                    // If active, update user record too
                    if (current.is_active) {
                        const rpcType = current.picture_type === 'aula' ? 'upload' : current.picture_type;
                        await supabaseClient.rpc('update_profile_picture', {
                            p_user_id: current.user_id,
                            p_picture_url: storagePath,
                            p_picture_type: rpcType,
                        });
                        const u = allUsers.find(u => u.id === current.user_id);
                        if (u) u.profile_picture_url = storagePath;
                    }

                    // Refresh signed URL
                    const { data: signedData } = await supabaseClient.storage
                        .from('profile-pictures')
                        .createSignedUrls([storagePath], 3600);
                    if (signedData?.[0]?.signedUrl) {
                        ppSignedUrls.set(current.id, signedData[0].signedUrl);
                    }

                    const { invalidateProfilePictureCache } = await import('../core/profile-picture-cache.js?v=3.0.67');
                    invalidateProfilePictureCache(current.user_id);

                    renderLightboxContent();
                    renderPicturesContent();
                } catch (err) {
                    console.error('[uap] Crop save fejl:', err);
                    saveBtn.textContent = 'Fejl!';
                    setTimeout(() => { saveBtn.textContent = 'Gem beskæring'; saveBtn.disabled = false; }, 2000);
                }
            };
        });

        // Wire delete
        lb.querySelector('.uap-lb-delete')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            const typeLabel = (PP_TYPE_LABELS[current.picture_type] || PP_TYPE_LABELS.upload).label;
            if (!confirm(`Slet dette ${typeLabel.toLowerCase()}-billede for ${current.user_name}?`)) return;
            const { removeProfilePicture } = await import('../core/profile-picture-utils.js?v=3.0.67');

            const { error: delError } = await supabaseClient.from('profile_picture_library').delete().eq('id', current.id);
            if (delError) { console.error('[uap] Delete fejl:', delError); alert('Kunne ikke slette: ' + delError.message); return; }

            if (current.is_active) {
                await removeProfilePicture(current.user_id, getInstitutionId(), current.picture_type);
                const u = allUsers.find(u => u.id === current.user_id);
                if (u) { u.profile_picture_url = null; u.profile_picture_type = null; }
            }

            const deletedUserId = current.user_id;
            ppEntries = ppEntries.filter(en => en.id !== current.id);
            ppSignedUrls.delete(current.id);

            if (mode === 'user' && userRows) {
                // Rebuild current user's entries
                const row = userRows[userRowIdx];
                if (row) row.entries = row.entries.filter(en => en.id !== current.id);
                userEntries = row?.entries || [];
                navigable = userEntries;

                if (navigable.length === 0) {
                    // User has no more pictures — try next/prev user or close
                    userRows.splice(userRowIdx, 1);
                    if (userRows.length === 0) { closeLightbox(); renderPicturesContent(); return; }
                    if (userRowIdx >= userRows.length) userRowIdx = userRows.length - 1;
                    userEntries = userRows[userRowIdx]?.entries || [];
                    navigable = userEntries;
                    currentIdx = 0;
                } else {
                    if (currentIdx >= navigable.length) currentIdx = navigable.length - 1;
                }
            } else {
                const newNav = getNavigableEntries();
                if (newNav.length === 0) { closeLightbox(); renderPicturesContent(); return; }
                if (currentIdx >= newNav.length) currentIdx = newNav.length - 1;
                navigable.length = 0;
                navigable.push(...newNav);
            }
            renderLightboxContent();
            renderPicturesContent();
        });
    }

    function navigate(dir) {
        const newIdx = currentIdx + dir;
        if (newIdx < 0 || newIdx >= navigable.length) return;
        currentIdx = newIdx;
        renderLightboxContent();
    }

    function closeLightbox() {
        document.removeEventListener('keydown', keyHandler);
        lb.remove();
    }

    function navigateUser(dir) {
        if (mode !== 'user' || !userRows || userRows.length <= 1) return;
        const newRowIdx = userRowIdx + dir;
        if (newRowIdx < 0 || newRowIdx >= userRows.length) return;
        userRowIdx = newRowIdx;
        const row = userRows[userRowIdx];
        userEntries = row?.entries || [];
        // If user has no entries, create a fake default entry
        if (userEntries.length === 0 && row) {
            const inst = window.__flangoGetInstitutionById?.(row.user?.institution_id);
            const def = getDefaultProfilePicture(row.name, inst);
            userEntries = [{
                id: '__default__' + row.userId,
                user_id: row.userId,
                user_name: row.name,
                picture_type: 'default',
                is_active: false,
                storage_path: def.type === 'image' ? def.value : null,
                _isDefault: true,
                _defaultType: def.type,
                _defaultValue: def.value,
            }];
        }
        navigable = userEntries;
        currentIdx = 0;
        // Find active entry for this user, or first
        const activeIdx = navigable.findIndex(e => e.is_active);
        if (activeIdx >= 0) currentIdx = activeIdx;
        renderLightboxContent();
    }

    function keyHandler(e) {
        if (e.key === 'Escape') closeLightbox();
        else if (e.key === 'ArrowLeft') navigate(-1);
        else if (e.key === 'ArrowRight') navigate(1);
        else if (e.key === 'ArrowUp') { e.preventDefault(); navigateUser(-1); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); navigateUser(1); }
    }
    document.addEventListener('keydown', keyHandler);

    renderLightboxContent();
}
