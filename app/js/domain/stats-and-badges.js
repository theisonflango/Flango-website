import {
    calculateCurrentStats,
    loadFlangoAdminStats,
    addWorkMinutesForToday,
    mergeRemoteStatsWithSession,
    FLANGO_LEVEL_MESSAGES,
} from './stats-store.js?v=3.0.80';
import { getProductIconInfo } from './products-and-cart.js?v=3.0.80';
import { escapeHtml } from '../core/escape-html.js?v=3.0.80';

// 1) Konstanter og basis-helpers
export const BADGE_ICON_MAP = {
    'God Stil': 'Icons/webp/Badge/GodStil.webp',
    'Hårdtarbejdende': 'Icons/webp/Badge/Haardtarbejdende.webp',
    'Pandekage Mester': 'Icons/webp/Badge/pandekagemester.webp'
};

const DEFAULT_LEVEL_IMAGE = 'Icons/webp/Avatar/Ekspedient-mand-Flango1.webp';

export const parseBadgeList = (value) => {
    if (!value) return [];
    return value.split('|').map(b => b.trim()).filter(Boolean);
};

export const formatBadgeList = (list) => {
    return (list || []).filter(Boolean).join('|');
};

export const renderBadgeIcon = (badge) => {
    const icon = BADGE_ICON_MAP[badge];
    const safe = escapeHtml(badge);
    if (icon) {
        return `<div class="badge-display-item"><img src="${icon}" alt="${safe} badge"></div>`;
    }
    return `<div class="badge-display-item badge-display-pill">${safe}</div>`;
};

export const renderBadgePlaceholder = () => `<div class="badge-display-item badge-empty"></div>`;

// 2) Badge rendering (simple/placeholder)
export function renderSimpleBadgeDisplay(badgeList, options = {}) {
    const {
        emptyMessage = '',
        rowClass = '',
        itemClass = '',
        emptyClass = '',
        removable = false,
        onRemove = null
    } = options;
    if (badgeList && badgeList.length > 0) {
        const items = badgeList.map(badge => {
            const iconMarkup = renderBadgeIcon(badge);
            const safe = escapeHtml(badge);
            const removeBtn = removable
                ? `<button type="button" class="badge-remove-btn" data-badge="${safe}">×</button>`
                : '';
            const handlerAttr = removable && typeof onRemove === 'function'
                ? `data-remove-handler="true"`
                : '';
            return `
                <div class="simple-badge-item ${itemClass}" ${handlerAttr}>
                    <div class="badge-item-wrapper">
                        ${iconMarkup}
                        ${removeBtn}
                    </div>
                    <span class="badge-label">${safe}</span>
                </div>`;
        }).join('');
        return `<div class="simple-badge-row ${rowClass}">${items}</div>`;
    }
    if (emptyMessage) {
        const messageClass = emptyClass ? `no-badges-message ${emptyClass}` : 'no-badges-message';
        return `<p class="${messageClass}">${emptyMessage}</p>`;
    }
    return '';
}

// Stats-store (core stats/remote) re-exports to keep API stable
export {
    calculateCurrentStats,
    loadFlangoAdminStats,
    addWorkMinutesForToday,
    mergeRemoteStatsWithSession,
    FLANGO_LEVEL_MESSAGES,
};

export const formatDurationWithSeconds = (totalSeconds) => {
    const safeSeconds = Math.max(0, Math.round(totalSeconds || 0));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;
    return `${hours} timer, ${minutes} minutter og ${seconds} sekunder`;
};

const formatDurationToHTML = (totalSeconds) => {
    const safeSeconds = Math.max(0, Math.round(totalSeconds || 0));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    return `
        <div class="time-segment"><span class="time-value" data-unit="h">${String(hours).padStart(2, '0')}</span><span class="time-label">timer</span></div>
        <div class="time-separator">:</div>
        <div class="time-segment"><span class="time-value" data-unit="m">${String(minutes).padStart(2, '0')}</span><span class="time-label">min</span></div>
        <div class="time-separator">:</div>
        <div class="time-segment"><span class="time-value" data-unit="s">${String(seconds).padStart(2, '0')}</span><span class="time-label">sek</span></div>
    `;
};

// 4) Helper til Accordion-layout i Logud-vindue
export function getStatsAccordionSectionsHTML(statsData, options = {}, clerkProfile) {
    // Denne funktion genbruger logikken fra getStatsSummaryHTML, men returnerer opdelte sektioner.
    const {
        sessionSalesCount = 0,
        sessionMinutes = 0,
        totalMinutes = 0,
        todayMinutes: todayMinutesFromStats = 0,
        totalSales = 0,
        currentLevel,
        nextLevel,
        remainingHours,
        remainingSales,
        progressPercent
    } = statsData;
    const { remoteStats = null } = options;
    const profile = clerkProfile || window.__flangoCurrentClerkProfile || null;
    const badgeList = parseBadgeList(profile?.badge_label);

    const cloneStats = remoteStats ? {
        today: { ...(remoteStats.today || {}) },
        total: { ...(remoteStats.total || {}) }
    } : null;

    const todayMinutes = Math.max(0, Math.round(todayMinutesFromStats));
    const totalMinutesDisplay = Math.max(0, Math.round(cloneStats?.total?.minutes_worked ?? totalMinutes));
    const todayCustomers = cloneStats?.today?.customers ?? 0;
    const totalCustomers = cloneStats?.total?.customers ?? totalSales;
    const todayItems = cloneStats?.today?.items ?? sessionSalesCount;
    const totalItems = cloneStats?.total?.items ?? totalSales;
    const todayAmount = cloneStats?.today?.amount ?? 0;
    const totalAmount = cloneStats?.total?.amount ?? 0;
    const todayProducts = cloneStats?.today?.products || [];
    const totalProducts = cloneStats?.total?.products || [];

    const formatDuration = (minutes) => {
        const safe = Math.max(0, Math.round(minutes || 0));
        const hours = Math.floor(safe / 60);
        const mins = safe % 60;
        return `${hours} timer og ${mins} minutter`;
    };

    const formatCurrency = (value) => {
        const num = typeof value === 'number' ? value : 0;
        return num.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kr';
    };

    const productsToHTML = (items, emptyText) => {
        if (!Array.isArray(items) || items.length === 0) {
            return `<p class="product-summary-line">${emptyText}</p>`;
        }
        return items.map(entry => {
            const qty = entry.quantity ?? entry.count ?? 0;
            const label = entry.product_name || entry.name || 'Ukendt vare';
            const iconInfo = getProductIconInfo({ name: label, emoji: entry.emoji });
            let visualMarkup = iconInfo ? `<img src="${iconInfo.path}" alt="${label}" class="product-icon-small"> ` : (entry.emoji ? `${entry.emoji} ` : '');
            const lineTotal = typeof entry.totalAmountForProduct === 'number' ? entry.totalAmountForProduct : 0;
            return `<div class="product-summary-line">
                        <span class="summary-qty">${qty} stk</span>
                        <span class="summary-visual">${visualMarkup}</span>
                        <span class="summary-name">${label}</span>
                        <span class="summary-price">${formatCurrency(lineTotal)}</span>
                    </div>`;
        }).join('');
    };

    const progressHTML = nextLevel === currentLevel
        ? `Du har nået det højeste niveau – stærkt gået! 🏆`
        : `Du mangler ca. <strong>${remainingHours}</strong> timer eller <strong>${remainingSales}</strong> salg for at nå <strong>${nextLevel.name} ${nextLevel.stars}</strong>.<br><br>
           <div style="margin-top:8px;">
             <div style="width:100%;height:10px;background:#ddd;border-radius:999px;overflow:hidden;">
               <div style="width:${progressPercent}%;height:100%;background:#4caf50;"></div>
             </div>
             <div style="font-size:12px;margin-top:4px;">
               Fremskridt mod næste niveau: <strong>${progressPercent}%</strong>
             </div>
           </div>`;

    // Sektion 1: Status
    const statusSectionHTML = `
        <p>Din nuværende status er: <strong>${currentLevel.name} ${currentLevel.stars}</strong></p>
        ${currentLevel.description ? `<p class="status-level-description">${currentLevel.description}</p>` : ''}
        <div class="status-progress-container" style="margin-top: 12px;">${progressHTML}</div>
    `;

    // Sektion 2: Badges
    const badgesSectionHTML = renderSimpleBadgeDisplay(badgeList, {
        emptyMessage: 'Du har desværre ikke fået nogle badges endnu. Spørg den voksne i caféen, om du har fortjent et 😊',
        rowClass: 'compact'
    });

    // Sektion 3: I dag
    const todaySectionHTML = `
        <div class="stats-grid">
            <div class="stat-item"><span class="stat-value">${todayCustomers}</span><span class="stat-label">Kunder</span></div>
            <div class="stat-item"><span class="stat-value">${todayItems}</span><span class="stat-label">Varer</span></div>
            <div class="stat-item"><span class="stat-value">${formatCurrency(todayAmount)}</span><span class="stat-label">Omsat</span></div>
        </div>
        ${productsToHTML(todayProducts, 'Ingen varer registreret endnu i dag.')}
    `;

    // Sektion 4: Sammenlagt
    const totalSectionHTML = `
        <p>Arbejdet i caféen i alt: <strong>${formatDuration(totalMinutesDisplay)}</strong></p>
        <div class="stats-grid">
            <div class="stat-item"><span class="stat-value">${totalCustomers}</span><span class="stat-label">Kunder</span></div>
            <div class="stat-item"><span class="stat-value">${totalItems}</span><span class="stat-label">Varer</span></div>
            <div class="stat-item"><span class="stat-value">${formatCurrency(totalAmount)}</span><span class="stat-label">Omsat</span></div>
        </div>
        ${productsToHTML(totalProducts, 'Ingen samlede varedata endnu.')}
    `;

    return {
        status: statusSectionHTML,
        badges: badgesSectionHTML,
        today: todaySectionHTML,
        total: totalSectionHTML,
    };
}

// Helper: Find level-index baseret på currentLevel.hours-tærskel
const LEVEL_HOURS_TO_INDEX = { 0: 0, 6: 1, 12: 2, 18: 3, 30: 4 };
const getLevelIndex = (level) => LEVEL_HOURS_TO_INDEX[level?.hours] ?? 0;

// 3) UI: Min Flango Status (stats + badges)
export function getStatsSummaryHTML(statsData, options = {}, clerkProfile) {
    const {
        sessionSalesCount = 0,
        sessionMinutes = 0,
        totalMinutes = 0,
        totalHours = 0,
        todayMinutes: todayMinutesFromStats = 0,
        totalSales = 0,
        currentLevel,
        nextLevel,
        remainingHours,
        remainingSales,
        progressPercent
    } = statsData;
    const {
        badgeDisplay = 'coverflow',
        remoteStats = null,
        clerkProfileOverride = null
    } = options;
    const profile = clerkProfileOverride || clerkProfile || window.__flangoCurrentClerkProfile || null;
    const badgeList = parseBadgeList(profile?.badge_label);

    const cloneStats = remoteStats
        ? {
            today: { ...(remoteStats.today || {}) },
            total: { ...(remoteStats.total || {}) }
        }
        : null;

    const fallbackTodayMinutes = sessionMinutes;
    const fallbackTotalMinutes = totalMinutes || (totalHours * 60);
    const todayMinutes = Math.max(0, Math.round(todayMinutesFromStats));
    const totalMinutesDisplay = Math.max(0, Math.round(cloneStats?.total?.minutes_worked ?? fallbackTotalMinutes));
    const todayCustomers = cloneStats?.today?.customers ?? 0;
    const totalCustomers = cloneStats?.total?.customers ?? totalSales;
    const todayItems = cloneStats?.today?.items ?? sessionSalesCount;
    const totalItems = cloneStats?.total?.items ?? totalSales;
    const todayAmount = cloneStats?.today?.amount ?? 0;
    const totalAmount = cloneStats?.total?.amount ?? 0;

    const todayProducts = cloneStats?.today?.products || [];
    const totalProducts = cloneStats?.total?.products || [];

    const formatDuration = (minutes) => {
        const safe = Math.max(0, Math.round(minutes || 0));
        const hours = Math.floor(safe / 60);
        const mins = safe % 60;
        return `${hours} timer og ${mins} minutter`;
    };

    const formatCurrency = (value) => {
        const num = typeof value === 'number' ? value : 0;
        return num.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kr';
    };

    const escapeText = (value) => {
        if (!value && value !== 0) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    };

    const productsToHTML = (items, emptyText, amount) => {
        if (!Array.isArray(items) || items.length === 0) {
            const showEmpty = !amount || amount <= 0;
            return showEmpty ? `<p class="empty-msg">${emptyText}</p>` : '';
        }
        return `<div class="product-rows">${items.map(entry => {
            const qty = entry.quantity ?? entry.count ?? entry.amount ?? entry.qty ?? 0;
            const label = escapeText(entry.product_name || entry.name || entry.title || 'Ukendt vare');
            const iconInfo = getProductIconInfo({ name: label, emoji: entry.emoji });
            let visualMarkup = '';
            if (iconInfo) {
                visualMarkup = `<img src="${iconInfo.path}" alt="${label}" class="product-icon-small">`;
            } else if (entry.emoji) {
                visualMarkup = entry.emoji;
            }
            const lineTotal = typeof entry.totalAmountForProduct === 'number' ? entry.totalAmountForProduct : 0;
            return `<div class="prow">
                        <span class="pqty">${qty} stk</span>
                        <span>${visualMarkup}</span>
                        <span class="pname">${label}</span>
                        <span class="pprice">${formatCurrency(lineTotal)}</span>
                    </div>`;
        }).join('')}</div>`;
    };

    const isLogoutScreen = badgeDisplay === 'simple';

    // ── Hr. Flango roterende besked ──
    const levelIndex = getLevelIndex(currentLevel);
    const msgs = FLANGO_LEVEL_MESSAGES[levelIndex] || FLANGO_LEVEL_MESSAGES[0];
    const flangoDescription = msgs[Math.floor(Math.random() * msgs.length)];

    // ── Card A: Status + Level ──
    const isMaxLevel = nextLevel === currentLevel;
    const progressHTML = isMaxLevel
        ? ''
        : `<div class="progress-wrap">
              <div class="progress-row">
                  <span class="progress-label">Næste: ${escapeText(nextLevel.name)} ${nextLevel.stars}</span>
                  <span class="progress-pct">${progressPercent}%</span>
              </div>
              <div class="progress-track">
                  <div class="progress-fill" style="width:${progressPercent}%"></div>
              </div>
              <span class="progress-hint">Ca. ${remainingHours} timer eller ${remainingSales} salg mere</span>
           </div>`;

    const cardAHTML = `
        <div class="flango-status-card card-a">
            <span class="card-eyebrow">Dit niveau</span>
            <div class="level-pill">
                ${currentLevel.stars ? `<span class="level-pill-stars">${currentLevel.stars}</span>` : ''}
                <span class="level-pill-name">${escapeText(currentLevel.name)}</span>
            </div>
            ${progressHTML}
            <div class="speaker">
                <img src="${DEFAULT_LEVEL_IMAGE}" alt="Hr. Flango" class="speaker-avatar">
                <div class="speech-bubble">${flangoDescription}</div>
            </div>
        </div>`;

    // ── Card B: Badges ──
    const getBadgesHTML = () => {
        if (badgeDisplay === 'simple') {
            const emptyMsg = profile?.role === 'admin'
                ? 'Du har desværre ingen badges endnu – men jeg er sikker på, at du fortjener et.<br>Selv voksne har brug for anerkendelse, men nogle gange glemmer vi at rose hinanden 😊<br>Bed en kollega om at tildele dig et badge – du kan nemlig ikke tildele et badge til dig selv.<br>Du kan tildele badges til andre brugere under: <strong>Indstillinger → Rediger Brugere</strong>.'
                : 'Du har desværre ikke fået nogle badges endnu.<br>Du kan spørge den voksne i caféen, om du har fortjent et badge 😊';
            return renderSimpleBadgeDisplay(badgeList, { emptyMessage: emptyMsg });
        }
        const encodedBadgeList = badgeList.map(b => encodeURIComponent(b)).join(',');
        if (badgeList.length) {
            return `<div class="badge-coverflow" data-badges="${encodedBadgeList}">
                        <button type="button" class="coverflow-nav" data-dir="-1">‹</button>
                        <div class="coverflow-stage">
                            <div class="coverflow-track"></div>
                        </div>
                        <button type="button" class="coverflow-nav" data-dir="1">›</button>
                   </div>`;
        }
        const emptyMsg = profile?.role === 'admin'
            ? 'Du har desværre ingen badges endnu – men jeg er sikker på, at du fortjener et.<br>Selv voksne har brug for anerkendelse, men nogle gange glemmer vi at rose hinanden 😊<br>Bed en kollega om at tildele dig et badge – du kan nemlig ikke tildele et badge til dig selv.<br>Du kan tildele badges til andre brugere under: <strong>Indstillinger → Rediger Brugere</strong>.'
            : 'Du har desværre ikke fået nogle badges endnu.<br>Du kan spørge den voksne i caféen, om du har fortjent et badge 😊';
        return `<p class="no-badges-message">${emptyMsg}</p>`;
    };

    const cardBHTML = `
        <div class="flango-status-card card-b">
            <span class="card-eyebrow">Mine Badges</span>
            <div class="badge-panel">
              ${getBadgesHTML()}
            </div>
        </div>`;

    // ── Card C: I dag ──
    const timerHTML = isLogoutScreen
        ? `<div class="timer-box">
              <div class="tseg"><span class="tval">${String(Math.floor(todayMinutes / 60)).padStart(2, '0')}</span><span class="tlbl">timer</span></div>
              <span class="tcolon">:</span>
              <div class="tseg"><span class="tval">${String(todayMinutes % 60).padStart(2, '0')}</span><span class="tlbl">min</span></div>
              <span class="tcolon">:</span>
              <div class="tseg"><span class="tval">00</span><span class="tlbl">sek</span></div>
           </div>`
        : `<div id="stats-duration-today" class="timer-box">
              <div class="tseg"><span class="tval" data-unit="h">${String(Math.floor((todayMinutes * 60) / 3600)).padStart(2, '0')}</span><span class="tlbl">timer</span></div>
              <span class="tcolon">:</span>
              <div class="tseg"><span class="tval" data-unit="m">${String(Math.floor(((todayMinutes * 60) % 3600) / 60)).padStart(2, '0')}</span><span class="tlbl">min</span></div>
              <span class="tcolon">:</span>
              <div class="tseg"><span class="tval" data-unit="s">00</span><span class="tlbl">sek</span></div>
           </div>`;

    const cardCHTML = `
        <div class="flango-status-card card-c">
            <span class="card-eyebrow">I dag</span>
            ${timerHTML}
            <div class="chips">
                <div class="chip"><span class="chip-val">${todayCustomers}</span><span class="chip-lbl">Kunder</span></div>
                <div class="chip"><span class="chip-val">${todayItems}</span><span class="chip-lbl">Varer</span></div>
                <div class="chip"><span class="chip-val kr">${formatCurrency(todayAmount)}</span><span class="chip-lbl">Omsat</span></div>
            </div>
            ${productsToHTML(todayProducts, 'Ingen varer registreret endnu i dag.', todayAmount)}
        </div>`;

    // ── Card D: Sammenlagt ──
    const cardDHTML = `
        <div class="flango-status-card card-d">
            <span class="card-eyebrow">Sammenlagt</span>
            <div class="hours-pill">🕐 ${formatDuration(totalMinutesDisplay)} i caféen</div>
            <div class="chips">
                <div class="chip"><span class="chip-val">${totalCustomers}</span><span class="chip-lbl">Kunder</span></div>
                <div class="chip"><span class="chip-val">${totalItems}</span><span class="chip-lbl">Varer</span></div>
                <div class="chip"><span class="chip-val kr">${formatCurrency(totalAmount)}</span><span class="chip-lbl">Omsat</span></div>
            </div>
            ${productsToHTML(totalProducts, 'Ingen samlede varedata endnu.', totalAmount)}
        </div>`;

    const isLogoutLayout = badgeDisplay === 'simple';
    const rootLayoutClass = isLogoutLayout ? 'logout-status-layout' : 'flango-status-grid';
    return `
      <div class="${rootLayoutClass}">
        ${cardAHTML}
        ${cardBHTML}
        ${cardCHTML}
        ${cardDHTML}
      </div>
    `;
}
