/**
 * Shared kitchen order rendering.
 * Two modes:
 *   compact = true  → card-style <div> for the inline panel dropdown
 *   compact = false → <tr> table row for the standalone kitchen view
 */
import { escapeHtml } from '../core/escape-html.js?v=3.0.77';
import { CUSTOM_ICON_PREFIX, getCustomIconPath } from '../domain/products-and-cart.js?v=3.0.77';
import { getCachedProductIconUrl } from '../core/product-icon-cache.js?v=3.0.77';

/**
 * Resolve icon HTML for a sale item.
 * Handles signed URLs (icon_storage_path), custom uploaded icons (icon_url),
 * standard 3D icons (::icon:: prefix in emoji), and plain emoji.
 */
function resolveItemIcon(item, imgClass) {
    // Priority 1: Signed URL from private bucket
    if (item.icon_storage_path) {
        const signedUrl = getCachedProductIconUrl(item.icon_storage_path);
        if (signedUrl) {
            return `<img src="${escapeHtml(signedUrl)}" class="${imgClass}" alt="">`;
        }
    }
    // Priority 2: Legacy public icon_url
    if (item.icon_url) {
        return `<img src="${escapeHtml(item.icon_url)}" class="${imgClass}" alt="">`;
    }
    // Priority 3: Standard icon from ::icon:: prefix
    const standardPath = getCustomIconPath(item.emoji);
    if (standardPath) {
        return `<img src="${escapeHtml(standardPath)}" class="${imgClass}" alt="">`;
    }
    return null; // caller uses emoji fallback
}

/**
 * Get time-based color for order urgency.
 */
export function getTimeColor(createdAt) {
    const mins = (Date.now() - new Date(createdAt).getTime()) / 60000;
    if (mins < 3) return { color: '#10b981', label: 'ok' };        // green
    if (mins < 7) return { color: '#f59e0b', label: 'warning' };   // yellow
    if (mins < 12) return { color: '#f97316', label: 'late' };     // orange
    return { color: '#ef4444', label: 'urgent' };                   // red
}

/**
 * Format relative time string.
 */
export function formatRelativeTime(createdAt) {
    const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    if (mins < 1) return 'Nu';
    if (mins === 1) return '1 min';
    return `${mins} min`;
}

/**
 * Format clock time.
 */
function formatTime(createdAt) {
    const d = new Date(createdAt);
    return d.toLocaleTimeString('da-DK', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Render a kitchen order.
 * @param {Object} sale - Normalized sale data
 * @param {boolean} compact - true = card div (inline panel), false = table row (standalone)
 * @returns {HTMLElement}
 */
export function renderKitchenCard(sale, compact = false) {
    if (compact) {
        return renderCompactRow(sale);
    }
    return renderTableRow(sale);
}

// ─── Compact row (inline panel — 1 line per order) ──────────────────────────

function renderCompactRow(sale) {
    const row = document.createElement('div');
    row.className = `kitchen-row-compact${sale.kitchen_served ? ' served' : ''}`;
    row.dataset.saleId = sale.id;
    row.dataset.createdAt = sale.created_at;

    const tc = getTimeColor(sale.created_at);

    // Items inline: emoji+qty (🍔x2 🍟x1) + variant suffix
    const items = sale.items || [];
    const itemsHtml = items.map(item => {
        const icon = resolveItemIcon(item, 'krc-item-icon')
            || `<span class="krc-item-emoji">${item.emoji || '🍽️'}</span>`;
        const qty = item.quantity > 1 ? `x${item.quantity}` : '';
        const variant = item.item_variant ? `<span class="krc-item-variant">·${escapeHtml(item.item_variant)}</span>` : '';
        return `<span class="krc-item">${icon}${qty}${variant}</span>`;
    }).join('');

    // Table badge (compact: "B3")
    const tableHtml = sale.table_number
        ? `<span class="krc-table">B${escapeHtml(sale.table_number)}</span>`
        : '';

    // Note indicator (icon only, full text in tooltip)
    const noteHtml = sale.kitchen_note
        ? `<span class="krc-note" title="${escapeHtml(sale.kitchen_note)}">📝</span>`
        : '';

    // Action: serve button or served checkmark
    const actionHtml = sale.kitchen_served
        ? `<span class="krc-served-check">✓</span>`
        : `<button class="krc-serve" title="Markér serveret">✓</button>`;

    row.innerHTML = `
        <div class="krc-border" style="background:${sale.kitchen_served ? 'transparent' : tc.color}"></div>
        <div class="krc-customer">${escapeHtml(sale.customer_name || 'Ukendt')}</div>
        <div class="krc-items">${itemsHtml}</div>
        ${tableHtml}
        ${noteHtml}
        <span class="krc-time" style="color:${tc.color};">${formatRelativeTime(sale.created_at)}</span>
        ${actionHtml}
    `;

    return row;
}

// ─── Table row (standalone kitchen view) ─────────────────────────────────────

function renderTableRow(sale) {
    const row = document.createElement('tr');
    row.className = `kitchen-row${sale.kitchen_served ? ' served' : ''}`;
    row.dataset.saleId = sale.id;
    row.dataset.createdAt = sale.created_at;

    const tc = getTimeColor(sale.created_at);

    // Items summary — med variant-badge og per-item note
    const items = sale.items || [];
    const itemsSummary = items.map(item => {
        const icon = resolveItemIcon(item, 'kitchen-item-icon')
            || `<span class="kitchen-item-emoji">${item.emoji || '🍽️'}</span>`;
        const qty = item.quantity > 1 ? ` x${item.quantity}` : '';
        const variantHtml = item.item_variant
            ? ` <span class="kitchen-item-variant">${escapeHtml(item.item_variant)}</span>` : '';
        const noteHtml = item.item_note
            ? `<div class="kitchen-item-note">📝 ${escapeHtml(item.item_note)}</div>` : '';
        return `<div class="kitchen-item-block"><span class="kitchen-item-inline">${icon} ${escapeHtml(item.name || 'Produkt')}${qty}${variantHtml}</span>${noteHtml}</div>`;
    }).join('');

    // Clerk/admin info
    const serverName = sale.clerk_name || sale.admin_name || '—';

    // Note indicator
    const noteHtml = sale.kitchen_note
        ? `<span class="kitchen-note-badge" title="${escapeHtml(sale.kitchen_note)}">📝</span>`
        : '';

    // Table badge
    const tableHtml = sale.table_number
        ? escapeHtml(sale.table_number)
        : '—';

    // Action column
    const deleteBtn = `<button class="kitchen-delete-btn" title="Fjern fra listen">🗑️</button>`;
    const actionHtml = sale.kitchen_served
        ? `<span class="kitchen-served-label">✓</span>${deleteBtn}`
        : `<button class="kitchen-serve-btn">Servér ✓</button>${deleteBtn}`;

    row.innerHTML = `
        <td class="kitchen-col-time" data-created="${sale.created_at}">
            <div class="kitchen-time-relative" style="color:${tc.color};">${formatRelativeTime(sale.created_at)}</div>
            <div class="kitchen-time-clock">${formatTime(sale.created_at)}</div>
        </td>
        <td class="kitchen-col-customer">
            <div class="kitchen-customer-name">${escapeHtml(sale.customer_name || 'Ukendt')}</div>
        </td>
        <td class="kitchen-col-table">${tableHtml}</td>
        <td class="kitchen-col-items">
            <div class="kitchen-items-wrap">${itemsSummary}</div>
            ${noteHtml ? `<div class="kitchen-note-row">${noteHtml} <span class="kitchen-note-text">${escapeHtml(sale.kitchen_note)}</span></div>` : ''}
        </td>
        <td class="kitchen-col-amount">${sale.total_amount != null ? `${Number(sale.total_amount).toLocaleString('da-DK')} kr` : '—'}</td>
        <td class="kitchen-col-server">${escapeHtml(serverName)}</td>
        <td class="kitchen-col-action">${actionHtml}</td>
    `;

    // Urgency left border
    if (!sale.kitchen_served) {
        row.style.borderLeft = `4px solid ${tc.color}`;
    }

    return row;
}

/**
 * Update all relative times and colors on visible elements.
 * Works for both card divs and table rows.
 */
export function updateAllCardTimes(container) {
    if (!container) return;

    // Table rows (standalone view)
    container.querySelectorAll('.kitchen-row:not(.served)').forEach(row => {
        const createdAt = row.dataset.createdAt;
        if (!createdAt) return;
        const tc = getTimeColor(createdAt);
        const relEl = row.querySelector('.kitchen-time-relative');
        if (relEl) {
            relEl.textContent = formatRelativeTime(createdAt);
            relEl.style.color = tc.color;
        }
        row.style.borderLeft = `4px solid ${tc.color}`;
    });

    // Compact rows (inline panel)
    container.querySelectorAll('.kitchen-row-compact:not(.served)').forEach(row => {
        const createdAt = row.dataset.createdAt;
        if (!createdAt) return;
        const tc = getTimeColor(createdAt);
        const timeEl = row.querySelector('.krc-time');
        if (timeEl) {
            timeEl.textContent = formatRelativeTime(createdAt);
            timeEl.style.color = tc.color;
        }
        const border = row.querySelector('.krc-border');
        if (border) border.style.background = tc.color;
    });
}
