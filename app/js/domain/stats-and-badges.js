import {
    calculateCurrentStats,
    loadFlangoAdminStats,
    addWorkMinutesForToday,
    mergeRemoteStatsWithSession,
} from './stats-store.js';
import { getProductIconInfo } from './products-and-cart.js';

// 1) Konstanter og basis-helpers
export const BADGE_ICON_MAP = {
    'God Stil': 'https://jbknjgbpghrbrstqwoxj.supabase.co/storage/v1/object/public/Badge/God%20Stil.png',
    'Hårdtarbejdende': 'https://jbknjgbpghrbrstqwoxj.supabase.co/storage/v1/object/public/Badge/Haardtarbejdende.png',
    'Pandekage Mester': 'https://jbknjgbpghrbrstqwoxj.supabase.co/storage/v1/object/public/Badge/pandekagemester.png'
};

const DEFAULT_LEVEL_IMAGE = 'https://jbknjgbpghrbrstqwoxj.supabase.co/storage/v1/object/public/Avatar/Ekspedient-mand-Flango1.png';

export const parseBadgeList = (value) => {
    if (!value) return [];
    return value.split('|').map(b => b.trim()).filter(Boolean);
};

export const formatBadgeList = (list) => {
    return (list || []).filter(Boolean).join('|');
};

export const renderBadgeIcon = (badge) => {
    const icon = BADGE_ICON_MAP[badge];
    if (icon) {
        return `<div class="badge-display-item"><img src="${icon}" alt="${badge} badge"></div>`;
    }
    return `<div class="badge-display-item badge-display-pill">${badge}</div>`;
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
            const removeBtn = removable
                ? `<button type="button" class="badge-remove-btn" data-badge="${badge}">×</button>`
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
                    <span class="badge-label">${badge}</span>
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

// 3) UI: Min Flango Status (stats + badges)
export function getStatsSummaryHTML(statsData, options = {}, clerkProfile) {
    const {
        sessionSalesCount = 0,
        sessionMinutes = 0,
        totalMinutes = 0,
        todayMinutes: todayMinutesFromStats = 0, // Omdøb for klarhed
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
    const todayMinutes = Math.max(0, Math.round(todayMinutesFromStats)); // Brug den beregnede værdi direkte!
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

    const formatAmount = (value) => {
        const num = typeof value === 'number' ? value : 0;
        return num.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kr';
    };

    const productsToHTML = (items, emptyText, totalAmount) => {
        if (!Array.isArray(items) || items.length === 0) {
            const showEmpty = !totalAmount || totalAmount <= 0;
            return showEmpty ? `<p class="product-summary-line">${emptyText}</p>` : '';
        }
        return items.map(entry => {
            const qty = entry.quantity ?? entry.count ?? entry.amount ?? entry.qty ?? 0;
            const label = escapeText(entry.product_name || entry.name || entry.title || entry.name || 'Ukendt vare');
            
            const iconInfo = getProductIconInfo({ name: label, emoji: entry.emoji });
            let visualMarkup = '';
            if (iconInfo) {
                visualMarkup = `<img src="${iconInfo.path}" alt="${label}" class="product-icon-small"> `;
            } else if (entry.emoji) {
                visualMarkup = `${entry.emoji} `;
            }

            const lineTotal = typeof entry.totalAmountForProduct === 'number'
                ? entry.totalAmountForProduct
                : 0;
            return `<div class="product-summary-line">
                        <span class="summary-qty">${qty} stk</span>
                        <span class="summary-visual">${visualMarkup}</span>
                        <span class="summary-name">${label}</span>
                        <span class="summary-price">${formatAmount(lineTotal)}</span>
                    </div>`;
        }).join('');
    };

    const isLogoutScreen = badgeDisplay === 'simple';

    const todayStatsHTML = `
        <div class="stats-section">
            <h4>I dag har du:</h4>
            <ul>
                ${isLogoutScreen
                    ? `<li>Arbejdet i caféen i ${formatDuration(todayMinutes)}</li>`
                    : `<li class="duration-display-container">
                           <span>Arbejdet i caféen i:</span>
                           <div id="stats-duration-today" class="live-timer">${formatDurationToHTML(todayMinutes * 60)}</div>
                       </li>`
                }
            </ul>
            <div class="stats-grid">
                <div class="stat-item"><span class="stat-value">${todayCustomers}</span><span class="stat-label">Kunder</span></div>
                <div class="stat-item"><span class="stat-value">${todayItems}</span><span class="stat-label">Varer</span></div>
                <div class="stat-item"><span class="stat-value">${formatCurrency(todayAmount)}</span><span class="stat-label">Omsat</span></div>
            </div>
            ${productsToHTML(todayProducts, 'Ingen varer registreret endnu i dag.', todayAmount)}
        </div>`;

    const totalStatsHTML = `
        <div class="stats-section">
            <h4>Sammenlagt har du:</h4>
            <ul>
                <li>Arbejdet i caféen i ${formatDuration(totalMinutesDisplay)}</li>
            </ul>
            <div class="stats-grid">
                <div class="stat-item"><span class="stat-value">${totalCustomers}</span><span class="stat-label">Kunder</span></div>
                <div class="stat-item"><span class="stat-value">${totalItems}</span><span class="stat-label">Varer</span></div>
                <div class="stat-item"><span class="stat-value">${formatCurrency(totalAmount)}</span><span class="stat-label">Omsat</span></div>
            </div>
            ${productsToHTML(totalProducts, 'Ingen samlede varedata endnu.', totalAmount)}
        </div>`;

    const progressHTML = nextLevel === currentLevel
        ? `Du har nået det højeste niveau – stærkt gået! 🏆<br><br>`
        : `Du mangler ca. <strong>${remainingHours}</strong> timer eller <strong>${remainingSales}</strong> salg
           for at nå <strong>${nextLevel.name} ${nextLevel.stars}</strong>.<br><br>
           <div style="margin-top:8px;">
             <div style="width:100%;height:10px;background:#ddd;border-radius:999px;overflow:hidden;">
               <div style="width:${progressPercent}%;height:100%;background:#4caf50;"></div>
             </div>
             <div style="font-size:12px;margin-top:4px;">
               Fremskridt mod næste niveau: <strong>${progressPercent}%</strong>
             </div>
           </div>`;

    const getBadgesHTML = () => {
        if (badgeDisplay === 'simple') {
            const emptyMsg = profile?.role === 'admin'
                ? `Du har desværre ingen badges endnu – men jeg er sikker på, at du fortjener et.<br>
                   Selv voksne har brug for anerkendelse, men nogle gange glemmer vi at rose hinanden 😊<br>
                   Bed en kollega om at tildele dig et badge – du kan nemlig ikke tildele et badge til dig selv.<br>
                   Du kan tildele badges til andre brugere under: <strong>Indstillinger → Rediger Brugere</strong>.`
                : `Du har desværre ikke fået nogle badges endnu.<br>
                   Du kan spørge den voksne i caféen, om du har fortjent et badge 😊`;
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
            ? `Du har desværre ingen badges endnu – men jeg er sikker på, at du fortjener et.<br>
               Selv voksne har brug for anerkendelse, men nogle gange glemmer vi at rose hinanden 😊<br>
               Bed en kollega om at tildele dig et badge – du kan nemlig ikke tildele et badge til dig selv.<br>
               Du kan tildele badges til andre brugere under: <strong>Indstillinger → Rediger Brugere</strong>.`
            : `Du har desværre ikke fået nogle badges endnu.<br>
               Du kan spørge den voksne i caféen, om du har fortjent et badge 😊`;
        return `<p class="no-badges-message">${emptyMsg}</p>`;
    };

    const isLogoutLayout = badgeDisplay === 'simple';
    const rootLayoutClass = isLogoutLayout ? 'logout-status-layout' : 'flango-status-grid';
    return `
      <div class="${rootLayoutClass}">
        <div class="flango-status-card card-a">
            <div class="status-header-section vertical">
              <div class="status-header-text">
                <h4>Din nuværende status</h4>
                <p><strong>${currentLevel.name} ${currentLevel.stars}</strong></p>
                ${currentLevel.description ? `<p class="status-level-description">${currentLevel.description}</p>` : ''}
                <div class="status-progress-container">
                  ${progressHTML}
                </div>
              </div>
              <img src="${DEFAULT_LEVEL_IMAGE}" alt="Hr. Flango" class="status-avatar hr-flango">
            </div>
        </div>
        <div class="flango-status-card card-b">
            <div class="badge-panel">
              <h3>Mine Badges</h3>
              ${getBadgesHTML()}
            </div>
        </div>
        <div class="flango-status-card card-c scrollable">
            ${todayStatsHTML}
        </div>
        <div class="flango-status-card card-d scrollable">
            ${totalStatsHTML}
        </div>
      </div>
    `;
}
