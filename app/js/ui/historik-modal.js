// Ansvar: Historik v2 modal lifecycle, tab-switching, alle render-funktioner.
import { getCurrentAdmin, isCurrentUserAdmin } from '../domain/session-store.js?v=3.0.66';
import {
  periodRange, fmtDate, fmtDateTime, fmtMinutes, fmtKr, fmtDayDate, getLevel,
  getMyRevenue, getMyTransactionCount, getMyTransactionSplit, getClubStats, getTotalDeposits,
  getMyMinutesWorked, getTotalBalances, getTopProducts, getDailyClerks,
  getWeekRevenue, getHourlyRevenue, getDailyRevenue, getDailyRevenueActive, getMonthlyRevenue,
  getTransactions, getSaleItems,
  getDailySummary, getWeeklySummary, getMonthlySummary,
  getEmployeeSummary, getAdminSalesSplit, getAdminTimeSplit, getAdminDeposits,
  getTopClerks, getTopCustomers,
  getRevenueByDay, getBalanceDistribution, getProductsIconMap,
  undoSale, registerSaleAdjustment, getFirstSaleDate,
} from '../domain/historik-data.js?v=3.0.66';
import { renderBarChart, renderDailyRevenueChart, renderBalanceChart, renderAxisChart, renderLineChart } from './historik-charts.js?v=3.0.66';
import { exportSalesReport, exportAllBalances, exportNegativeBalances, exportTransactionsCsv, exportClerkReport, exportPeriodReport } from './historik-export.js?v=3.0.66';
import { showConfirmModal } from './confirm-modals.js?v=3.0.66';
import { showCustomAlert } from './sound-and-alerts.js?v=3.0.66';
import { invalidateTodaysSalesCache } from '../domain/purchase-limits.js?v=3.0.66';

// ─── HELPERS ───
import { getCachedProductIconUrl } from '../core/product-icon-cache.js?v=3.0.66';

const ICON_PREFIX = '::icon::';
/**
 * Render product emoji/icon as inline HTML.
 * Checks icon_storage_path (signed URL) first, then ::icon:: prefix, then icon_url, then emoji.
 * @param {string} emoji  — emoji or ::icon::path string
 * @param {string} [iconUrl] — icon_url from products table (fallback)
 * @param {number} [size=18] — pixel size
 * @param {string} [storagePath] — icon_storage_path for signed URL resolution
 */
function productIcon(emoji, iconUrl, size = 18, storagePath = '') {
  // Priority 1: Signed URL from private bucket
  if (storagePath) {
    const signedUrl = getCachedProductIconUrl(storagePath);
    if (signedUrl) {
      return `<img src="${signedUrl}" style="width:${size}px;height:${size}px;vertical-align:middle;border-radius:3px;margin-right:2px" alt="">`;
    }
  }
  // Priority 2: ::icon:: prefix (may contain storage path or legacy URL)
  if (emoji && emoji.startsWith(ICON_PREFIX)) {
    const path = emoji.slice(ICON_PREFIX.length);
    if (path) {
      // Try signed URL for storage paths
      if (!path.startsWith('http')) {
        const signedUrl = getCachedProductIconUrl(path);
        const url = signedUrl || `https://jbknjgbpghrbrstqwoxj.supabase.co/storage/v1/object/public/product-icons/${path}`;
        return `<img src="${url}" style="width:${size}px;height:${size}px;vertical-align:middle;border-radius:3px;margin-right:2px" alt="">`;
      }
      // Legacy: full URL
      return `<img src="${path}" style="width:${size}px;height:${size}px;vertical-align:middle;border-radius:3px;margin-right:2px" alt="">`;
    }
  }
  // Priority 3: Legacy public icon_url
  if (iconUrl) {
    return `<img src="${iconUrl}" style="width:${size}px;height:${size}px;vertical-align:middle;border-radius:3px;margin-right:2px" alt="">`;
  }
  if (emoji) return emoji;
  return '';
}

/** Lookup product icon from a cached map. Returns inline HTML. */
function productIconById(iconMap, productId, size = 16) {
  const info = iconMap?.[productId];
  if (!info) return '';
  return productIcon(info.emoji, info.icon_url, size, info.icon_storage_path);
}

// ─── STATE ───
let currentPeriod = 'idag';
let currentFrom = null;
let currentTo = null;
let includeTestUsers = false;
let activeTab = 'tab-overview';
// Chart state (uafhængigt af global period)
let chartPeriod = null; // null = følger currentPeriod
let chartView = 'bars'; // 'bars' | 'graph'
// Transaktioner state
let txTypeFilter = 'alle';
let txSearch = '';
let allTransactions = [];
let _txIconMap = {};
// Perioder state
let periodView = 'dag';
// Personale state
let personnelView = 'ekspedienter';

// ─── MODAL HTML ───

function getModalHTML() {
  const admin = getCurrentAdmin();
  const adminName = admin?.name || 'Admin';
  const today = fmtDate(new Date());
  return `
<div id="historik-v2-backdrop" class="hv2-backdrop" style="display:none">
<div class="hv2-modal">
  <div class="hv2-header">
    <div class="hv2-header-left">
      <span class="hv2-admin-label">Historik</span>
      <span class="hv2-admin-title">Opsummering — ${adminName}</span>
    </div>
    <button class="hv2-close" id="hv2-close-btn">✕</button>
  </div>
  <nav class="hv2-sidebar" id="hv2-sidebar">
    <div class="hv2-sidebar-label">Overblik</div>
    <div class="hv2-nav-item active" data-tab="tab-overview"><span class="hv2-nav-icon">📊</span> Overblik</div>
    <div class="hv2-sidebar-divider"></div>
    <div class="hv2-sidebar-label">Data</div>
    <div class="hv2-nav-item" data-tab="tab-transactions"><span class="hv2-nav-icon">📋</span> Transaktioner</div>
    <div class="hv2-nav-item" data-tab="tab-periods"><span class="hv2-nav-icon">📅</span> Perioder</div>
    <div class="hv2-sidebar-divider"></div>
    <div class="hv2-sidebar-label">Analyse</div>
    <div class="hv2-nav-item" data-tab="tab-personnel"><span class="hv2-nav-icon">👥</span> Personale</div>
    <div class="hv2-nav-item" data-tab="tab-toplists"><span class="hv2-nav-icon">🏆</span> Toplister</div>
    <div class="hv2-nav-item" data-tab="tab-statistics"><span class="hv2-nav-icon">📈</span> Statistik</div>
    <div class="hv2-sidebar-divider"></div>
    <div class="hv2-sidebar-label">Eksport</div>
    <div class="hv2-nav-item" data-tab="tab-reports"><span class="hv2-nav-icon">💾</span> Rapporter</div>
  </nav>
  <div class="hv2-content" id="hv2-content">
    <!-- Tab panels rendered dynamically -->
    <div class="hv2-tab active" id="hv2-tab-overview"><div class="hv2-loading">Indlæser...</div></div>
    <div class="hv2-tab" id="hv2-tab-transactions"><div class="hv2-loading">Indlæser...</div></div>
    <div class="hv2-tab" id="hv2-tab-periods"><div class="hv2-loading">Indlæser...</div></div>
    <div class="hv2-tab" id="hv2-tab-personnel"><div class="hv2-loading">Indlæser...</div></div>
    <div class="hv2-tab" id="hv2-tab-toplists"><div class="hv2-loading">Indlæser...</div></div>
    <div class="hv2-tab" id="hv2-tab-statistics"><div class="hv2-loading">Indlæser...</div></div>
    <div class="hv2-tab" id="hv2-tab-reports"><div class="hv2-loading">Indlæser...</div></div>
  </div>
</div>
</div>`;
}

// ─── INIT / OPEN / CLOSE ───

let modalInjected = false;

/**
 * Open historik modal directly on Transactions tab with a pre-filled search query and "alt" period.
 */
export function openHistorikForUser(userName) {
  // Set period to altid BEFORE opening (openHistorikModal resets to 'idag')
  openHistorikModal();

  // Wait for modal to render, then switch to transactions
  setTimeout(() => {
    // Set period to altid
    currentPeriod = 'altid';
    const { from, to } = periodRange('altid');
    currentFrom = from;
    currentTo = to;
    // Switch tab — this calls loadTransactions() which resets txSearch to ''
    switchTab('tab-transactions');

    // After loadTransactions has rendered, override the search field + filter rows
    setTimeout(() => {
      txSearch = (userName || '').toLowerCase().trim();
      const searchEl = document.getElementById('tx-search');
      if (searchEl) { searchEl.value = userName || ''; }
      // Activate "Alt" period button visually
      document.querySelectorAll('#tx-period .hv2-period-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.period === 'alt' || b.dataset.period === 'altid');
      });
      // Re-render with search applied
      renderTransactionRows();
    }, 500);
  }, 150);
}

export function openHistorikModal() {
  if (!modalInjected) {
    document.body.insertAdjacentHTML('beforeend', getModalHTML());
    modalInjected = true;
    setupEventListeners();
  }
  const backdrop = document.getElementById('historik-v2-backdrop');
  backdrop.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  // Reset til default
  currentPeriod = 'idag';
  const { from, to } = periodRange('idag');
  currentFrom = from;
  currentTo = to;
  includeTestUsers = false;
  activeTab = 'tab-overview';
  // Aktiver korrekt tab visuelt
  switchTab('tab-overview');
  loadOverview();
}

function closeHistorikModal() {
  const backdrop = document.getElementById('historik-v2-backdrop');
  if (backdrop) {
    backdrop.style.opacity = '0';
    setTimeout(() => {
      backdrop.style.display = 'none';
      backdrop.style.opacity = '';
    }, 200);
  }
  document.body.style.overflow = '';
}

// ─── EVENT LISTENERS ───

function setupEventListeners() {
  // Luk
  document.getElementById('hv2-close-btn').onclick = closeHistorikModal;
  document.getElementById('historik-v2-backdrop').onclick = (e) => {
    if (e.target.id === 'historik-v2-backdrop') closeHistorikModal();
  };
  // Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const backdrop = document.getElementById('historik-v2-backdrop');
      if (backdrop && backdrop.style.display === 'flex') closeHistorikModal();
    }
  });
  // Tab navigation
  document.querySelectorAll('#hv2-sidebar .hv2-nav-item[data-tab]').forEach(item => {
    item.onclick = () => switchTab(item.dataset.tab);
  });
  // Mobile tab navigation (for sidebar-hidden on mobile)
  setupMobileNav();
}

function setupMobileNav() {
  // Tilføj mobil tab-bar om nødvendigt
  const content = document.getElementById('hv2-content');
  if (!content) return;
  const mobileNav = document.createElement('div');
  mobileNav.className = 'hv2-mobile-nav';
  mobileNav.innerHTML = `
    <button class="hv2-mob-btn active" data-tab="tab-overview">📊</button>
    <button class="hv2-mob-btn" data-tab="tab-transactions">📋</button>
    <button class="hv2-mob-btn" data-tab="tab-periods">📅</button>
    <button class="hv2-mob-btn" data-tab="tab-personnel">👥</button>
    <button class="hv2-mob-btn" data-tab="tab-toplists">🏆</button>
    <button class="hv2-mob-btn" data-tab="tab-statistics">📈</button>
    <button class="hv2-mob-btn" data-tab="tab-reports">💾</button>
  `;
  content.parentElement.insertBefore(mobileNav, content);
  mobileNav.querySelectorAll('.hv2-mob-btn').forEach(btn => {
    btn.onclick = () => switchTab(btn.dataset.tab);
  });
}

function switchTab(tabId) {
  activeTab = tabId;
  // Sidebar
  document.querySelectorAll('#hv2-sidebar .hv2-nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`#hv2-sidebar .hv2-nav-item[data-tab="${tabId}"]`)?.classList.add('active');
  // Mobile
  document.querySelectorAll('.hv2-mob-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.hv2-mob-btn[data-tab="${tabId}"]`)?.classList.add('active');
  // Panels
  document.querySelectorAll('.hv2-tab').forEach(p => p.classList.remove('active'));
  document.getElementById(`hv2-${tabId}`)?.classList.add('active');
  // Load data
  loadTab(tabId);
}

function loadTab(tabId) {
  switch (tabId) {
    case 'tab-overview': loadOverview(); break;
    case 'tab-transactions': loadTransactions(); break;
    case 'tab-periods': loadPeriods(); break;
    case 'tab-personnel': loadPersonnel(); break;
    case 'tab-toplists': loadToplists(); break;
    case 'tab-statistics': loadStatistics(); break;
    case 'tab-reports': loadReports(); break;
  }
}

// ─── PERIODE-TOGGLE FACTORY ───

function makePeriodToggle(id, onChange) {
  return `<div class="hv2-toolbar">
    <div class="hv2-period-toggle" id="${id}">
      <button class="hv2-period-btn${currentPeriod === 'idag' ? ' active' : ''}" data-period="idag">I dag</button>
      <button class="hv2-period-btn${currentPeriod === 'uge' ? ' active' : ''}" data-period="uge">Uge</button>
      <button class="hv2-period-btn${currentPeriod === 'maaned' ? ' active' : ''}" data-period="maaned">Måned</button>
      <button class="hv2-period-btn${currentPeriod === 'altid' ? ' active' : ''}" data-period="altid">Altid</button>
    </div>
    <div class="hv2-toolbar-sep"></div>
    <input type="date" class="hv2-input" id="${id}-from" value="${fmtDate(currentFrom)}">
    <span class="hv2-date-sep">til</span>
    <input type="date" class="hv2-input" id="${id}-to" value="${fmtDate(currentTo)}">
    <div class="hv2-spacer"></div>
    <label class="hv2-check-label"><input type="checkbox" id="${id}-test" ${includeTestUsers ? 'checked' : ''}> Testbrugere</label>
  </div>`;
}

function bindPeriodToggle(id, onReload) {
  const toggle = document.getElementById(id);
  if (!toggle) return;
  toggle.querySelectorAll('.hv2-period-btn').forEach(btn => {
    btn.onclick = () => {
      toggle.querySelectorAll('.hv2-period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPeriod = btn.dataset.period;
      const { from, to } = periodRange(currentPeriod);
      currentFrom = from;
      currentTo = to;
      document.getElementById(`${id}-from`).value = fmtDate(from);
      document.getElementById(`${id}-to`).value = fmtDate(to);
      onReload();
    };
  });
  // Custom dates
  const fromEl = document.getElementById(`${id}-from`);
  const toEl = document.getElementById(`${id}-to`);
  if (fromEl) fromEl.onchange = () => { currentFrom = new Date(fromEl.value); onReload(); };
  if (toEl) toEl.onchange = () => { currentTo = new Date(toEl.value + 'T23:59:59'); onReload(); };
  // Test-toggle
  const testEl = document.getElementById(`${id}-test`);
  if (testEl) testEl.onchange = () => { includeTestUsers = testEl.checked; onReload(); };
}

// ═══════════════════════════════════════════════════
// TAB 1: OVERBLIK
// ═══════════════════════════════════════════════════

async function loadOverview() {
  // Nulstil chart-state så den følger global period igen
  chartPeriod = null;

  const panel = document.getElementById('hv2-tab-overview');
  panel.innerHTML = makePeriodToggle('ov-period', loadOverview) + '<div id="ov-body" class="hv2-loading">Indlæser overblik...</div>';
  bindPeriodToggle('ov-period', loadOverview);

  const body = document.getElementById('ov-body');
  const isToday = currentPeriod === 'idag';
  const isAltid = currentPeriod === 'altid';

  try {
    // Parallel data fetching (respektér includeTestUsers)
    const incTest = includeTestUsers;
    const allTimeRange = periodRange('altid');
    const promises = [
      /* 0 */ getMyTransactionSplit(currentFrom, currentTo, incTest),
      /* 1 */ getClubStats(currentFrom, currentTo, incTest),
      /* 2 */ getTotalDeposits(currentFrom, currentTo, incTest),
      /* 3 */ getTopProducts(currentFrom, currentTo, 5, incTest),
    ];
    // Conditional fetches
    if (isToday) {
      promises.push(/* 4 */ getMyMinutesWorked(currentFrom, currentTo));
      promises.push(/* 5 */ getDailyClerks(currentFrom, currentTo, incTest));
    } else {
      promises.push(/* 4 */ Promise.resolve(0));
      promises.push(/* 5 */ Promise.resolve([]));
    }
    if (isAltid) {
      promises.push(/* 6 */ getTotalBalances(incTest));
    } else {
      promises.push(/* 6 */ Promise.resolve(null));
    }
    // Altid hent ugeoversigt (kompakt kort)
    promises.push(/* 7 */ getWeekRevenue(new Date(), incTest));
    // Chart-data hentes uafhængigt i loadOverviewChart()
    promises.push(/* 8 */ Promise.resolve(null));
    // All-time club stats for avg calculation (always last — index 9)
    promises.push(/* 9 */ isAltid
      ? Promise.resolve(null)
      : getClubStats(allTimeRange.from, allTimeRange.to, incTest)
    );

    const results = await Promise.all(promises);
    const [txSplit, club, deposits, topProds, myMinutes, clerks, balances, weekData, periodChartData] = results;
    // All-time stats for average: dedicated fetch (index 9), or period stats when viewing "altid"
    const clubAllTime = results[9] || club;

    const clubAvgPerDay = clubAllTime.cafeDays ? Math.round(clubAllTime.totalRevenue / clubAllTime.cafeDays) : 0;
    const clubAvgSalesPerDay = clubAllTime.cafeDays ? Math.round(clubAllTime.saleCount / clubAllTime.cafeDays) : 0;

    // Compare badges (vs. club avg)
    const revPct = clubAvgPerDay ? Math.round(((txSplit.totalRevenue - clubAvgPerDay) / clubAvgPerDay) * 100) : 0;
    const txPct = clubAvgSalesPerDay ? Math.round(((txSplit.total - clubAvgSalesPerDay) / clubAvgSalesPerDay) * 100) : 0;

    function badge(pct, tip) {
      if (pct === 0) return `<span class="hv2-badge neutral" data-tip="${tip}">— 0%</span>`;
      return pct > 0
        ? `<span class="hv2-badge up" data-tip="${tip}">↑ ${pct}%</span>`
        : `<span class="hv2-badge down" data-tip="${tip}">↓ ${Math.abs(pct)}%</span>`;
    }

    const periodLabels = { idag: 'i dag', uge: 'denne uge', maaned: 'denne måned', altid: '' };
    const periodLabel = periodLabels[currentPeriod] || '';
    const heroLabels = { idag: 'Min dag', uge: 'Min uge', maaned: 'Min måned', altid: 'Min total' };
    const heroLabel = heroLabels[currentPeriod] || 'Min dag';

    // Compare bar widths (proportional: max = today's value or 100%)
    const maxBarVal = Math.max(txSplit.totalRevenue, clubAvgPerDay, 1);
    const barMyPct = Math.round((txSplit.totalRevenue / maxBarVal) * 100);
    const barClubPct = Math.round((clubAvgPerDay / maxBarVal) * 100);

    // Top produkter
    const topByCount = [...topProds].sort((a, b) => b.antal - a.antal);
    const topByRev = [...topProds].sort((a, b) => b.beloeb - a.beloeb);

    // ─── BUILD HTML ───
    let html = '';

    // ═══ HERO ROW: 2 cards ═══
    html += `<div class="hv2-hero-row">`;

    // Card 1: Min omsætning (personal)
    html += `
      <div class="hv2-hero-card hv2-hero-personal">
        <div class="hv2-hero-label"><span class="hv2-hero-dot hv2-dot-personal"></span> ${heroLabel}</div>
        <div class="hv2-hero-value">${fmtKr(txSplit.totalRevenue)}</div>
        <div class="hv2-hero-sublabel">Min omsætning${periodLabel ? ' ' + periodLabel : ''}</div>
        ${!isAltid ? `
        <div class="hv2-hero-compare">
          <div class="hv2-hero-compare-row">
            ${badge(revPct, `${fmtKr(txSplit.totalRevenue)} ${periodLabel} vs. klubgns. ${fmtKr(clubAvgPerDay)}/dag`)}
            <span class="hv2-hero-compare-text">vs. <strong>klubbens</strong> gns. ${fmtKr(clubAvgPerDay)}/dag</span>
          </div>
        </div>
        <div class="hv2-hero-bar">
          <div class="hv2-hero-bar-track">
            <div class="hv2-hero-bar-fill hv2-bar-club" style="width:${barClubPct}%" title="Klubgns. ${fmtKr(clubAvgPerDay)}"></div>
            <div class="hv2-hero-bar-fill hv2-bar-personal" style="width:${barMyPct}%" title="${heroLabel} ${fmtKr(txSplit.totalRevenue)}"></div>
          </div>
        </div>
        <div class="hv2-hero-bar-legend">
          <span style="color:var(--hv2-info)">● Klub ${fmtKr(clubAvgPerDay)}</span>
          <span style="color:var(--hv2-flango)">● ${isToday ? 'I dag' : heroLabel} ${fmtKr(txSplit.totalRevenue)}</span>
        </div>` : ''}
        <div class="hv2-hero-club-context">
          Butikkens total${periodLabel ? ' ' + periodLabel : ''}: <strong>${fmtKr(club.totalRevenue)}</strong> · ${club.saleCount} salg
        </div>
      </div>`;

    // Card 2: Transaktioner
    html += `
      <div class="hv2-hero-card hv2-hero-tx">
        <div class="hv2-hero-label"><span class="hv2-hero-dot hv2-dot-tx"></span> Transaktioner${periodLabel ? ' ' + periodLabel : ''}</div>
        <div class="hv2-hero-value">${txSplit.total}</div>
        <div class="hv2-hero-sublabel">Salg i alt</div>
        <div class="hv2-hero-tx-breakdown">
          <div class="hv2-hero-tx-row"><span class="hv2-hero-tx-who">Mine</span><span class="hv2-hero-tx-val"><strong>${txSplit.myCount}</strong></span></div>
          <div class="hv2-hero-tx-row"><span class="hv2-hero-tx-who">Børn</span><span class="hv2-hero-tx-val"><strong>${txSplit.childCount}</strong></span></div>
        </div>
        ${!isAltid ? `
        <div class="hv2-hero-compare" style="margin-top:8px">
          <div class="hv2-hero-compare-row">
            ${badge(txPct, `${txSplit.total} salg ${periodLabel} vs. klubgns. ${clubAvgSalesPerDay}/dag`)}
            <span class="hv2-hero-compare-text">vs. klub ${clubAvgSalesPerDay}/dag</span>
          </div>
        </div>` : ''}
      </div>`;

    html += `</div>`; // end hero-row

    // ═══ CONTEXT CARDS ═══
    const contextCards = [];

    // Indbetalinger — altid synligt
    contextCards.push(`
      <div class="hv2-context-card">
        <div class="hv2-context-icon" style="background:var(--hv2-info-light)">💰</div>
        <div class="hv2-context-body">
          <div class="hv2-context-value">${fmtKr(deposits.amount)}</div>
          <div class="hv2-context-label">Indbetalinger</div>
          <div class="hv2-context-detail">${deposits.count} indbetalinger</div>
        </div>
      </div>`);

    // Min tid — kun for "idag"
    if (isToday) {
      contextCards.push(`
        <div class="hv2-context-card">
          <div class="hv2-context-icon" style="background:var(--hv2-flango-light)">⏱️</div>
          <div class="hv2-context-body">
            <div class="hv2-context-value">${fmtMinutes(myMinutes)}</div>
            <div class="hv2-context-label">Min tid som ansvarlig</div>
          </div>
        </div>`);
    }

    // Saldoer — kun for "altid"
    if (isAltid && balances) {
      contextCards.push(`
        <div class="hv2-context-card">
          <div class="hv2-context-icon" style="background:var(--hv2-flango-light)">🏦</div>
          <div class="hv2-context-body">
            <div class="hv2-context-value">${fmtKr(balances.total)}</div>
            <div class="hv2-context-label">Saldoer i alt</div>
            <div class="hv2-context-detail">${balances.count} konti · gns. ${fmtKr(balances.avg)}</div>
          </div>
        </div>`);
    }

    html += `<div class="hv2-context-row" style="grid-template-columns:repeat(${contextCards.length},1fr)">${contextCards.join('')}</div>`;

    // ═══ GRAF-SEKTION: Kompakt ugeoversigt + Periodespecifik graf ═══
    const hasWeek = weekData && weekData.days.length;

    html += `<div class="hv2-charts-row${!hasWeek ? ' hv2-charts-row-full' : ''}">`;

    // LEFT: Kompakt ugeoversigt (altid synlig)
    if (hasWeek) {
      const maxRev = Math.max(...weekData.days.map(d => d.revenue), 1);
      html += `
        <div class="hv2-week-chart-card hv2-week-compact">
          <div class="hv2-week-header">
            <div class="hv2-chart-title" style="font-size:13px">📊 Uge</div>
            <div class="hv2-week-total">${fmtKr(weekData.total)}</div>
          </div>
          <div class="hv2-week-chart">
            ${weekData.days.map(d => `
              <div class="hv2-week-col${d.isToday ? ' hv2-week-today' : ''}" title="${d.label} ${d.date}: ${d.revenue ? fmtKr(d.revenue) : '0 kr'}">
                <div class="hv2-week-col-bar-wrap">
                  <div class="hv2-week-col-bar" style="height:${d.revenue ? Math.max((d.revenue / maxRev) * 100, 4) : 4}%"></div>
                </div>
                <div class="hv2-week-col-label">${d.label}</div>
              </div>
            `).join('')}
          </div>
          ${weekData.avg ? `<div class="hv2-week-avg"><div class="hv2-week-avg-line"></div><span class="hv2-week-avg-label">Gns. ${fmtKr(weekData.avg)}/dag</span></div>` : ''}
        </div>`;
    }

    // RIGHT: Periodespecifik graf med eget inline filter + view toggle
    const effChartPeriod = chartPeriod || currentPeriod;
    const chartPeriodLabels = { idag: 'I dag', uge: 'Uge', maaned: 'Måned', altid: 'Altid' };
    const chartViewLabels = { bars: 'Søjler', graph: 'Graf' };
    html += `
      <div class="hv2-chart-card hv2-period-chart-card">
        <div class="hv2-chart-header" style="flex-wrap:wrap;gap:8px">
          <div class="hv2-chart-title" style="font-size:13px" id="ov-chart-title">📈 Omsætning</div>
          <div class="hv2-chart-controls">
            <div class="hv2-chart-pill-group" id="ov-chart-period-pills">
              ${['idag', 'uge', 'maaned', 'altid'].map(p =>
                `<button class="hv2-chart-pill${p === effChartPeriod ? ' active' : ''}" data-period="${p}">${chartPeriodLabels[p]}</button>`
              ).join('')}
            </div>
            <div class="hv2-chart-pill-group" id="ov-chart-view-pills">
              ${['bars', 'graph'].map(v =>
                `<button class="hv2-chart-pill${v === chartView ? ' active' : ''}" data-view="${v}">${chartViewLabels[v]}</button>`
              ).join('')}
            </div>
          </div>
        </div>
        <div id="ov-period-chart" style="min-height:140px"><div style="text-align:center;padding:40px 0;color:var(--hv2-ink-muted);font-size:13px">Indlæser graf...</div></div>
      </div>`;

    html += `</div>`; // end charts-row

    // ═══ TOPLISTER ═══
    html += `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
        <div class="hv2-chart-card">
          <div class="hv2-chart-header"><div class="hv2-chart-title">🔥 Mest solgte (antal)</div></div>
          <div id="ov-chart-count"></div>
        </div>
        <div class="hv2-chart-card">
          <div class="hv2-chart-header"><div class="hv2-chart-title">💰 Størst omsætning</div></div>
          <div id="ov-chart-rev"></div>
        </div>
      </div>`;

    // ═══ DAGENS EKSPEDIENTER (kun idag) ═══
    if (isToday && clerks.length) {
      html += `
        <div class="hv2-section-title">👥 Dagens ekspedienter</div>
        <div class="hv2-table-wrap">
          <table class="hv2-table">
            <thead><tr><th>Rolle</th><th>Navn</th><th>Antal salg</th><th>Beløb</th><th>Tid</th></tr></thead>
            <tbody>${clerks.map(c => `
              <tr${c.role === 'admin' ? ' style="background:var(--hv2-purple-light)"' : ''}>
                <td><span class="hv2-tag ${c.role === 'admin' ? 'purple' : 'green'}">${c.role === 'admin' ? 'Voksen' : 'Barn'}</span></td>
                <td style="font-weight:600">${c.name}</td>
                <td>${c.saleCount}</td>
                <td>${fmtKr(c.revenue)}</td>
                <td>${fmtMinutes(c.minutes)}${c.role === 'admin' ? ' <span style="font-size:11px;color:var(--hv2-ink-muted)">(ansvarlig)</span>' : ''}</td>
              </tr>`).join('')}
            </tbody>
            <tfoot><tr><td colspan="2" style="text-align:right">Total</td><td>${clerks.reduce((s, c) => s + c.saleCount, 0)}</td><td>${fmtKr(clerks.reduce((s, c) => s + c.revenue, 0))}</td><td>—</td></tr></tfoot>
          </table>
        </div>`;
    }

    body.className = '';
    body.innerHTML = html;

    // Bind inline chart controls + render chart
    bindOverviewChartControls();
    loadOverviewChart();

    // Render bar charts
    const colors = ['flango', 'green', 'blue', 'purple', 'orange'];
    renderBarChart('ov-chart-count', topByCount.map((p, i) => ({
      rank: i + 1, label: `${productIcon(p.emoji, p.icon_url, 18, p.icon_storage_path)} ${p.name}`, value: p.antal, secondary: fmtKr(p.beloeb),
      color: colors[i % colors.length], pct: topByCount[0]?.antal ? (p.antal / topByCount[0].antal) * 100 : 0,
    })));
    renderBarChart('ov-chart-rev', topByRev.map((p, i) => ({
      rank: i + 1, label: `${productIcon(p.emoji, p.icon_url, 18, p.icon_storage_path)} ${p.name}`, value: fmtKr(p.beloeb), secondary: `${p.antal} stk`,
      color: colors[i % colors.length], pct: topByRev[0]?.beloeb ? (p.beloeb / topByRev[0].beloeb) * 100 : 0,
    })));
  } catch (err) {
    console.error('loadOverview', err);
    body.innerHTML = '<div class="hv2-error">Fejl ved indlæsning af overblik.</div>';
  }
}

// ─── Overblik: Uafhængig chart med eget filter ───

function bindOverviewChartControls() {
  const periodPills = document.getElementById('ov-chart-period-pills');
  const viewPills = document.getElementById('ov-chart-view-pills');
  if (periodPills) {
    periodPills.querySelectorAll('.hv2-chart-pill').forEach(btn => {
      btn.onclick = () => {
        periodPills.querySelectorAll('.hv2-chart-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        chartPeriod = btn.dataset.period;
        loadOverviewChart();
      };
    });
  }
  if (viewPills) {
    viewPills.querySelectorAll('.hv2-chart-pill').forEach(btn => {
      btn.onclick = () => {
        viewPills.querySelectorAll('.hv2-chart-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        chartView = btn.dataset.view;
        loadOverviewChart();
      };
    });
  }
}

async function loadOverviewChart() {
  const el = document.getElementById('ov-period-chart');
  const titleEl = document.getElementById('ov-chart-title');
  if (!el) return;

  const period = chartPeriod || currentPeriod;
  const incTest = includeTestUsers;

  const periodChartTitles = {
    idag: '📈 Salg i dag (pr. time)',
    uge: '📈 Omsætning denne uge',
    maaned: '📈 Omsætning denne måned',
    altid: '📈 Omsætning over tid',
  };
  if (titleEl) titleEl.textContent = periodChartTitles[period] || '📈 Omsætning';

  el.innerHTML = '<div style="text-align:center;padding:40px 0;color:var(--hv2-ink-muted);font-size:13px">Indlæser graf...</div>';

  try {
    let chartData = [];
    let { from, to } = periodRange(period);

    // "Altid" → start fra institutionens første reelle salg (ikke 2020)
    if (period === 'altid') {
      const firstSale = await getFirstSaleDate();
      if (firstSale) from = firstSale;
    }

    if (period === 'idag') {
      chartData = await getHourlyRevenue(new Date(), incTest);
    } else if (period === 'uge') {
      const wd = await getWeekRevenue(new Date(), incTest);
      chartData = (wd.days || []).map(d => ({ label: d.label, value: d.revenue, highlight: d.isToday }));
    } else if (period === 'maaned') {
      chartData = await getDailyRevenue(from, to, incTest);
    } else {
      // altid: bars → monthly, graph → kun aktive dage (ingen 0-dage)
      if (chartView === 'graph') {
        chartData = await getDailyRevenueActive(from, to, incTest);
      } else {
        chartData = await getMonthlyRevenue(from, to, incTest);
      }
    }

    if (chartView === 'graph') {
      renderLineChart('ov-period-chart', { data: chartData || [], emptyText: 'Ingen salg i perioden.' });
    } else {
      renderAxisChart('ov-period-chart', { data: chartData || [], emptyText: 'Ingen salg i perioden.' });
    }
  } catch (err) {
    console.error('loadOverviewChart', err);
    el.innerHTML = '<div style="color:var(--hv2-ink-muted);font-size:13px;text-align:center;padding:32px 0">Kunne ikke indlæse graf.</div>';
  }
}

// ═══════════════════════════════════════════════════
// TAB 2: TRANSAKTIONER
// ═══════════════════════════════════════════════════

async function loadTransactions() {
  // Reset filter + search state so UI and data stay in sync
  txTypeFilter = 'alle';
  txSearch = '';
  const panel = document.getElementById('hv2-tab-transactions');
  panel.innerHTML = `
    ${makePeriodToggle('tx-period', loadTransactions)}
    <div class="hv2-toolbar" style="margin-top:-8px">
      <input type="text" class="hv2-input" id="tx-search" placeholder="Søg barn, ekspedient..." style="width:180px">
      <div class="hv2-toolbar-sep"></div>
      <div class="hv2-period-toggle" id="tx-type-filter">
        <button class="hv2-period-btn active" data-filter="alle">Alle</button>
        <button class="hv2-period-btn" data-filter="SALE">Salg</button>
        <button class="hv2-period-btn" data-filter="DEPOSIT">Indbet.</button>
        <button class="hv2-period-btn" data-filter="SALE_ADJUSTMENT">Just.</button>
        <button class="hv2-period-btn" data-filter="EVENT">🎫 Arr.</button>
      </div>
      <div class="hv2-spacer"></div>
      <span class="hv2-count" id="tx-count">…</span>
    </div>
    <div class="hv2-table-wrap" id="tx-table-wrap"><div class="hv2-loading">Indlæser transaktioner...</div></div>`;
  bindPeriodToggle('tx-period', loadTransactions);

  // Type filter
  document.querySelectorAll('#tx-type-filter .hv2-period-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('#tx-type-filter .hv2-period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      txTypeFilter = btn.dataset.filter;
      renderTransactionRows();
    };
  });
  // Søg
  const searchEl = document.getElementById('tx-search');
  if (searchEl) {
    searchEl.value = txSearch;
    searchEl.oninput = () => { txSearch = searchEl.value.toLowerCase().trim(); renderTransactionRows(); };
  }

  try {
    const [txData, iconMap] = await Promise.all([
      getTransactions(currentFrom, currentTo, includeTestUsers),
      getProductsIconMap(),
    ]);
    allTransactions = txData;
    _txIconMap = iconMap;
    renderTransactionRows();
  } catch (err) {
    console.error('loadTransactions', err);
    document.getElementById('tx-table-wrap').innerHTML = '<div class="hv2-error">Fejl ved indlæsning.</div>';
  }
}

function renderTransactionRows() {
  const wrap = document.getElementById('tx-table-wrap');
  let filtered = allTransactions;
  if (txTypeFilter !== 'alle') {
    // Inkluder SALE_UNDO ved "SALE"-filter
    if (txTypeFilter === 'SALE') {
      filtered = filtered.filter(e => e.event_type === 'SALE' || e.event_type === 'SALE_UNDO');
    } else if (txTypeFilter === 'EVENT') {
      filtered = filtered.filter(e => e.event_type === 'EVENT_PAYMENT' || e.event_type === 'EVENT_REFUND');
    } else {
      filtered = filtered.filter(e => e.event_type === txTypeFilter);
    }
  }
  if (txSearch) {
    filtered = filtered.filter(e => {
      const text = [e.target?.name, e.clerk?.name, e.admin?.name, e.session_admin_name].filter(Boolean).join(' ').toLowerCase();
      return text.includes(txSearch);
    });
  }

  document.getElementById('tx-count').textContent = `${filtered.length} hændelser`;

  const typeTag = (type) => {
    switch (type) {
      case 'SALE': return '<span class="hv2-tag green">Salg</span>';
      case 'DEPOSIT': return '<span class="hv2-tag blue">Indbetaling</span>';
      case 'SALE_ADJUSTMENT': return '<span class="hv2-tag orange">Justering</span>';
      case 'SALE_UNDO': return '<span class="hv2-tag red">Fortrudt</span>';
      case 'BALANCE_EDIT': return '<span class="hv2-tag purple">Saldo</span>';
      case 'EVENT_PAYMENT': return '<span class="hv2-tag teal">🎫 Arrangement</span>';
      case 'EVENT_REFUND': return '<span class="hv2-tag teal">🎫 Refund</span>';
      default: return `<span class="hv2-tag gray">${type}</span>`;
    }
  };

  const rowClass = (type) => {
    switch (type) {
      case 'SALE': return 'hv2-row-sale';
      case 'DEPOSIT': return 'hv2-row-deposit';
      case 'SALE_ADJUSTMENT': return 'hv2-row-adjustment';
      case 'SALE_UNDO': return 'hv2-row-undo';
      case 'BALANCE_EDIT': return 'hv2-row-balance';
      case 'EVENT_PAYMENT': return 'hv2-row-event';
      case 'EVENT_REFUND': return 'hv2-row-event';
      default: return '';
    }
  };

  const amountDisplay = (e) => {
    const d = e.details || {};
    switch (e.event_type) {
      case 'SALE': {
        const amt = d.total_amount || 0;
        if (amt === 0) return `<span style="color:var(--hv2-ink-muted)">0 kr</span>`;
        return `<strong>${fmtKr(amt)}</strong>`;
      }
      case 'DEPOSIT': return `<strong style="color:var(--hv2-info)">+${fmtKr(d.amount)}</strong>`;
      case 'SALE_ADJUSTMENT': {
        const adj = d.adjustment_amount || 0;
        const sign = adj > 0 ? '+' : adj < 0 ? '−' : '';
        const color = adj < 0 ? 'var(--hv2-negative, #ef4444)' : 'var(--hv2-positive)';
        return `<strong style="color:${color}">${sign}${fmtKr(Math.abs(adj))}</strong>`;
      }
      case 'SALE_UNDO': return `<strong>${fmtKr(d.refunded_amount || 0)}</strong>`;
      case 'BALANCE_EDIT': {
        const diff = (d.new_balance || 0) - (d.old_balance || 0);
        return `<strong style="color:var(--hv2-info)">+${fmtKr(Math.abs(diff))}</strong>`;
      }
      case 'EVENT_PAYMENT': return `<strong>${fmtKr(d.amount || 0)}</strong>`;
      case 'EVENT_REFUND': return `<strong style="color:var(--hv2-positive)">+${fmtKr(d.amount || 0)}</strong>`;
      default: return '—';
    }
  };

  const productsDisplay = (e) => {
    if (e.event_type !== 'SALE') {
      if (e.event_type === 'BALANCE_EDIT') {
        const d = e.details || {};
        return `<span style="font-size:12px;color:var(--hv2-ink-soft)">${fmtKr(d.old_balance)} → ${fmtKr(d.new_balance)}</span>`;
      }
      if (e.event_type === 'SALE_ADJUSTMENT') {
        return `<span style="font-size:12px;color:var(--hv2-ink-soft)">Justering</span>`;
      }
      if (e.event_type === 'EVENT_PAYMENT' || e.event_type === 'EVENT_REFUND') {
        const title = e.details?.event_title || 'Ukendt arrangement';
        const note = e.event_type === 'EVENT_REFUND' && e.details?.note ? ` (${e.details.note})` : '';
        return `<span style="font-size:12px;color:var(--hv2-ink-soft)">🎫 ${title}${note}</span>`;
      }
      return '<span style="color:var(--hv2-ink-muted)">—</span>';
    }
    const items = e.details?.items || [];
    if (!items.length) return '<span class="hv2-product-count">×0</span>';
    return items.map(i => {
      const icon = productIconById(_txIconMap, i.product_id, 16);
      const qty = i.quantity || 1;
      return `<span class="hv2-tx-product">${icon || ''}<span class="hv2-tx-product-name">${i.product_name || ''}</span><span class="hv2-tx-product-qty">×${qty}</span></span>`;
    }).join(' ');
  };

  const clerkDisplay = (e) => {
    if (e.clerk) {
      const badge = e.clerk.role === 'kunde' ? ' <span style="font-size:10px;color:var(--hv2-positive)">(barn)</span>' : '';
      return e.clerk.name + badge;
    }
    return e.admin?.name || '—';
  };

  wrap.innerHTML = `<div class="hv2-table-scroll"><table class="hv2-table">
    <thead><tr><th>Tid</th><th>Type</th><th>Kunde</th><th>Produkter</th><th>Beløb</th><th>Ekspedient</th><th>Voksen ansv.</th><th></th></tr></thead>
    <tbody>${filtered.map(e => `
      <tr class="${rowClass(e.event_type)} hv2-tx-row" data-id="${e.id}">
        <td>${fmtDateTime(e.created_at)}</td>
        <td>${typeTag(e.event_type)}</td>
        <td>${e.target?.name || '—'}</td>
        <td>${productsDisplay(e)}</td>
        <td>${amountDisplay(e)}</td>
        <td>${clerkDisplay(e)}</td>
        <td>${e.session_admin_name || e.admin?.name || '—'}</td>
        <td style="text-align:right">${e.event_type === 'SALE' ? '<button class="hv2-action-btn hv2-expand-btn">⋯</button>' : ''}</td>
      </tr>
      ${e.event_type === 'SALE' ? `<tr class="hv2-expand-row" id="hv2-expand-${e.id}"><td colspan="8" class="hv2-expand-cell"><div class="hv2-expand-loading">Indlæser detaljer...</div></td></tr>` : ''}
    `).join('')}</tbody>
  </table></div>`;

  // Expand click handlers
  wrap.querySelectorAll('.hv2-tx-row').forEach(row => {
    row.style.cursor = 'pointer';
    row.onclick = (ev) => {
      if (ev.target.closest('button') && !ev.target.classList.contains('hv2-expand-btn')) return;
      const id = row.dataset.id;
      const expandRow = document.getElementById(`hv2-expand-${id}`);
      if (expandRow) {
        const isOpen = expandRow.classList.toggle('open');
        if (isOpen) loadExpandDetails(id, expandRow);
      }
    };
  });
}

async function loadExpandDetails(eventId, expandRow) {
  const event = allTransactions.find(e => e.id === eventId);
  if (!event) return;
  const saleId = event.details?.sale_id;
  if (!saleId) {
    expandRow.querySelector('td').innerHTML = '<div class="hv2-expand-content"><em>Ingen detaljer tilgængelige.</em></div>';
    return;
  }
  try {
    const items = await getSaleItems(saleId);
    const customerId = event.target_user_id || event.details?.customer_id;
    const customerName = event.target?.name || 'Kunden';
    const originalTotal = Number(event.details?.total_amount || 0);

    expandRow.querySelector('td').innerHTML = `
    <div class="hv2-adjust-panel">
      <!-- Left: Sale details -->
      <div class="hv2-adjust-details">
        <div class="hv2-adjust-section-title">Kvittering</div>
        <div class="hv2-adjust-items">
          ${items.map(i => `<div class="hv2-adjust-item">
            <span class="hv2-adjust-item-name">${productIcon(i.emoji, i.icon_url, 18, i.icon_storage_path)} ${i.name}</span>
            <span class="hv2-adjust-item-qty">×${i.quantity}</span>
            <span class="hv2-adjust-item-price">${fmtKr(i.quantity * i.price_at_purchase)}</span>
          </div>`).join('')}
          <div class="hv2-adjust-item hv2-adjust-total-line">
            <span class="hv2-adjust-item-name"><strong>Total</strong></span>
            <span></span>
            <span class="hv2-adjust-item-price"><strong>${fmtKr(originalTotal)}</strong></span>
          </div>
        </div>
        <div class="hv2-adjust-meta">
          <span>Ekspedient: <strong>${event.clerk?.name || event.admin?.name || '—'}</strong>${event.clerk?.role === 'kunde' ? ' (barn)' : ''}</span>
          <span>Ansvarlig: <strong>${event.session_admin_name || event.admin?.name || '—'}</strong></span>
        </div>
      </div>

      <!-- Right: Adjustment controls -->
      <div class="hv2-adjust-controls">
        <div class="hv2-adjust-section-title">Justér salg</div>

        <!-- Item qty corrections -->
        <div class="hv2-adjust-qty-section">
          ${items.map((i, idx) => `<div class="hv2-adjust-qty-row" data-idx="${idx}">
            <span class="hv2-adjust-qty-name">${productIcon(i.emoji, i.icon_url, 18, i.icon_storage_path)} ${i.name}</span>
            <div class="hv2-adjust-qty-controls">
              <button class="hv2-qty-btn hv2-qty-minus" data-idx="${idx}">−</button>
              <span class="hv2-qty-diff" data-idx="${idx}">0</span>
              <button class="hv2-qty-btn hv2-qty-plus" data-idx="${idx}">+</button>
            </div>
            <span class="hv2-adjust-qty-delta" data-idx="${idx}">0 kr</span>
          </div>`).join('')}
        </div>

        <!-- Manual kr adjustment -->
        <div class="hv2-adjust-manual">
          <span class="hv2-adjust-manual-label">Manuel korrektion</span>
          <div class="hv2-adjust-qty-controls">
            <button class="hv2-qty-btn hv2-manual-minus">−1</button>
            <span class="hv2-manual-display">0 kr</span>
            <button class="hv2-qty-btn hv2-manual-plus">+1</button>
          </div>
        </div>

        <!-- Summary -->
        <div class="hv2-adjust-summary">
          <div class="hv2-adjust-summary-row">
            <span>Varekorrektion</span>
            <span class="hv2-items-delta">0 kr</span>
          </div>
          <div class="hv2-adjust-summary-row">
            <span>Manuel</span>
            <span class="hv2-manual-delta">0 kr</span>
          </div>
          <div class="hv2-adjust-summary-row hv2-adjust-summary-total">
            <span>Total justering</span>
            <span class="hv2-total-delta">0 kr</span>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="hv2-adjust-actions">
          <button class="hv2-adjust-save" disabled>Gem justering</button>
          <button class="hv2-adjust-undo">Fortryd hele salget</button>
        </div>
      </div>
    </div>`;

    // Wire up adjustment logic
    wireAdjustmentPanel(expandRow, items, { saleId, customerId, customerName, originalTotal, eventId });

  } catch (err) {
    console.error('loadExpandDetails', err);
    expandRow.querySelector('td').innerHTML = '<div class="hv2-expand-content"><em>Fejl ved indlæsning.</em></div>';
  }
}

/** Wire up all interactive controls in the adjustment panel */
function wireAdjustmentPanel(expandRow, items, ctx) {
  const panel = expandRow.querySelector('.hv2-adjust-panel');
  if (!panel) return;

  // State
  const corrections = items.map(i => ({ diffQty: 0, unitPrice: Number(i.price_at_purchase) || 0, name: i.name }));
  let manualAdj = 0;

  function recalc() {
    let itemsDelta = 0;
    corrections.forEach((c, idx) => {
      const d = c.diffQty * c.unitPrice;
      itemsDelta += d;
      const diffEl = panel.querySelector(`.hv2-qty-diff[data-idx="${idx}"]`);
      const deltaEl = panel.querySelector(`.hv2-adjust-qty-delta[data-idx="${idx}"]`);
      if (diffEl) diffEl.textContent = c.diffQty > 0 ? `+${c.diffQty}` : String(c.diffQty);
      if (deltaEl) {
        const kr = d === 0 ? '0 kr' : `${d > 0 ? '+' : ''}${fmtKr(d)}`;
        deltaEl.textContent = kr;
        deltaEl.style.color = d < 0 ? 'var(--hv2-positive)' : d > 0 ? 'var(--hv2-negative)' : '';
      }
    });
    const total = itemsDelta + manualAdj;
    panel.querySelector('.hv2-items-delta').textContent = itemsDelta === 0 ? '0 kr' : `${itemsDelta > 0 ? '+' : ''}${fmtKr(itemsDelta)}`;
    panel.querySelector('.hv2-manual-delta').textContent = manualAdj === 0 ? '0 kr' : `${manualAdj > 0 ? '+' : ''}${fmtKr(manualAdj)}`;
    const totalEl = panel.querySelector('.hv2-total-delta');
    totalEl.textContent = total === 0 ? '0 kr' : `${total > 0 ? '+' : ''}${fmtKr(total)}`;
    totalEl.style.color = total < 0 ? 'var(--hv2-positive)' : total > 0 ? 'var(--hv2-negative)' : '';
    panel.querySelector('.hv2-adjust-save').disabled = (total === 0);
  }

  // Qty +/- buttons
  panel.querySelectorAll('.hv2-qty-minus').forEach(btn => {
    btn.onclick = (e) => { e.stopPropagation(); corrections[btn.dataset.idx].diffQty--; recalc(); };
  });
  panel.querySelectorAll('.hv2-qty-plus').forEach(btn => {
    btn.onclick = (e) => { e.stopPropagation(); corrections[btn.dataset.idx].diffQty++; recalc(); };
  });

  // Manual +/- buttons
  panel.querySelector('.hv2-manual-minus').onclick = (e) => {
    e.stopPropagation();
    manualAdj -= 1;
    panel.querySelector('.hv2-manual-display').textContent = `${manualAdj} kr`;
    recalc();
  };
  panel.querySelector('.hv2-manual-plus').onclick = (e) => {
    e.stopPropagation();
    manualAdj += 1;
    panel.querySelector('.hv2-manual-display').textContent = `${manualAdj} kr`;
    recalc();
  };

  // Save adjustment
  panel.querySelector('.hv2-adjust-save').onclick = async (e) => {
    e.stopPropagation();
    if (!isCurrentUserAdmin()) {
      showCustomAlert('Kun for admins', 'Kun en administrator kan justere salg. Bed en voksen om hjælp.');
      return;
    }
    const itemsDelta = corrections.reduce((sum, c) => sum + c.diffQty * c.unitPrice, 0);
    const delta = itemsDelta + manualAdj;
    if (delta === 0) return;

    const refundOrCharge = delta < 0
      ? `${ctx.customerName} får ${fmtKr(Math.abs(delta))} retur på saldoen.`
      : `${ctx.customerName} trækkes ${fmtKr(delta)} ekstra fra saldoen.`;

    const confirmed = await showConfirmModal({
      title: 'Bekræft justering',
      message: `Du er ved at justere et salg.\n\n${refundOrCharge}\n\nVil du fortsætte?`,
      confirmText: 'Gem justering',
      cancelText: 'Annuller',
    });
    if (!confirmed) return;

    try {
      const payload = {
        adjusted_sale_id: ctx.saleId,
        old_total: ctx.originalTotal,
        new_total: ctx.originalTotal + delta,
        edited_items: corrections.filter(c => c.diffQty !== 0).map(c => ({
          productName: c.name, diffQty: c.diffQty, unitPrice: c.unitPrice,
        })),
        manual_adjustment: manualAdj,
      };
      await registerSaleAdjustment(ctx.customerId, delta, payload);
      invalidateTodaysSalesCache();
      if (typeof window.__flangoRefreshSugarPolicy === 'function') {
        try { await window.__flangoRefreshSugarPolicy(); } catch (_) {}
      }
      showCustomAlert('Justering gemt', `${ctx.customerName} ${delta < 0 ? `har fået ${fmtKr(Math.abs(delta))} retur.` : `er trukket ${fmtKr(delta)} ekstra.`}`);
      loadTransactions(); // Reload transactions
    } catch (err) {
      console.error('registerSaleAdjustment', err);
      showCustomAlert('Fejl', 'Kunne ikke gemme justering: ' + (err.message || err));
    }
  };

  // Undo entire sale
  panel.querySelector('.hv2-adjust-undo').onclick = async (e) => {
    e.stopPropagation();
    if (!isCurrentUserAdmin()) {
      showCustomAlert('Kun for admins', 'Kun en administrator kan fortryde salg. Bed en voksen om hjælp.');
      return;
    }
    const itemsList = items.map(i => `${i.name} × ${i.quantity}`).join('\n');
    const confirmed = await showConfirmModal({
      title: 'Fortryd hele salget?',
      message: `Er du sikker?\n\nKunde: ${ctx.customerName}\nBeløb: ${fmtKr(ctx.originalTotal)}\n\nProdukter:\n${itemsList}\n\n${ctx.customerName} får ${fmtKr(ctx.originalTotal)} retur på saldoen.\n\nSalget slettes permanent.`,
      confirmText: 'Ja, fortryd salget',
      cancelText: 'Annuller',
    });
    if (!confirmed) return;

    try {
      const refunded = await undoSale(ctx.saleId);
      invalidateTodaysSalesCache();
      if (typeof window.__flangoRefreshSugarPolicy === 'function') {
        try { await window.__flangoRefreshSugarPolicy(); } catch (_) {}
      }
      showCustomAlert('Salg fortrudt', `${ctx.customerName} har fået ${fmtKr(refunded || ctx.originalTotal)} retur.`);
      loadTransactions();
    } catch (err) {
      console.error('undoSale', err);
      showCustomAlert('Fejl', 'Kunne ikke fortryde salget: ' + (err.message || err));
    }
  };
}

// ═══════════════════════════════════════════════════
// TAB 3: PERIODER
// ═══════════════════════════════════════════════════

async function loadPeriods() {
  const panel = document.getElementById('hv2-tab-periods');
  // Default: Dag-visning, fra = 30 dage siden
  if (currentPeriod === 'idag') {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    currentFrom = d;
  }
  panel.innerHTML = `
    <div class="hv2-toolbar">
      <div class="hv2-period-toggle" id="period-view-toggle">
        <button class="hv2-period-btn${periodView === 'dag' ? ' active' : ''}" data-view="dag">Dag</button>
        <button class="hv2-period-btn${periodView === 'uge' ? ' active' : ''}" data-view="uge">Uge</button>
        <button class="hv2-period-btn${periodView === 'maaned' ? ' active' : ''}" data-view="maaned">Måned</button>
      </div>
      <div class="hv2-toolbar-sep"></div>
      <input type="date" class="hv2-input" id="period-from" value="${fmtDate(currentFrom)}">
      <span class="hv2-date-sep">til</span>
      <input type="date" class="hv2-input" id="period-to" value="${fmtDate(currentTo)}">
      <div class="hv2-spacer"></div>
      <label class="hv2-check-label"><input type="checkbox" id="period-test" ${includeTestUsers ? 'checked' : ''}> Testbrugere</label>
    </div>
    <div class="hv2-table-wrap" id="period-table"><div class="hv2-loading">Indlæser perioder...</div></div>`;

  // View-toggle
  document.querySelectorAll('#period-view-toggle .hv2-period-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('#period-view-toggle .hv2-period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      periodView = btn.dataset.view;
      loadPeriodsData();
    };
  });
  const pfrom = document.getElementById('period-from');
  const pto = document.getElementById('period-to');
  if (pfrom) pfrom.onchange = () => { currentFrom = new Date(pfrom.value); loadPeriodsData(); };
  if (pto) pto.onchange = () => { currentTo = new Date(pto.value + 'T23:59:59'); loadPeriodsData(); };
  const ptest = document.getElementById('period-test');
  if (ptest) ptest.onchange = () => { includeTestUsers = ptest.checked; loadPeriodsData(); };

  loadPeriodsData();
}

async function loadPeriodsData() {
  const wrap = document.getElementById('period-table');
  wrap.innerHTML = '<div class="hv2-loading">Indlæser...</div>';
  try {
    let data;
    if (periodView === 'uge') data = await getWeeklySummary(currentFrom, currentTo, includeTestUsers);
    else if (periodView === 'maaned') data = await getMonthlySummary(currentFrom, currentTo, includeTestUsers);
    else data = await getDailySummary(currentFrom, currentTo, includeTestUsers);

    const rows = (data || []).map(row => {
      const date = periodView === 'dag' ? fmtDayDate(row.sale_date)
        : periodView === 'uge' ? `Uge ${row.week_number} · ${row.year}`
        : `${['', 'Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'][row.month_number || 0]} ${row.year || ''}`;
      const supervisor = row.adult_supervisor || '—';
      const clerkNames = Array.isArray(row.clerks)
        ? row.clerks.filter(c => c.role !== 'admin').map(c => c.name).join(', ')
        : '—';
      const topProduct = row.top_product ? `${productIcon(row.top_product.emoji, row.top_product.icon_url, 18, row.top_product.icon_storage_path)} ${row.top_product.name} (${row.top_product.count || 0})` : '—';
      return `<tr>
        <td>${date}</td>
        <td>${supervisor}</td>
        <td>${clerkNames || '—'}</td>
        <td>${topProduct}</td>
        <td>${row.sale_count || 0}</td>
        <td style="font-weight:600">${fmtKr(row.revenue || 0)}</td>
      </tr>`;
    });

    const totalSales = (data || []).reduce((s, r) => s + (r.sale_count || 0), 0);
    const totalRev = (data || []).reduce((s, r) => s + Number(r.revenue || 0), 0);

    wrap.innerHTML = `<div class="hv2-table-scroll"><table class="hv2-table">
      <thead><tr><th>Dato</th><th>Voksen ansvarlig</th><th>Børne-ekspedienter</th><th>🥇 Dagens ret</th><th>Antal salg</th><th>💰 Omsætning</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
      <tfoot><tr><td colspan="4" style="text-align:right">Total (${data?.length || 0} ${periodView === 'uge' ? 'uger' : periodView === 'maaned' ? 'måneder' : 'dage'})</td><td>${totalSales}</td><td style="font-weight:700">${fmtKr(totalRev)}</td></tr></tfoot>
    </table></div>`;
  } catch (err) {
    console.error('loadPeriodsData', err);
    wrap.innerHTML = '<div class="hv2-error">Fejl ved indlæsning.</div>';
  }
}

// ═══════════════════════════════════════════════════
// TAB 4: PERSONALE
// ═══════════════════════════════════════════════════

async function loadPersonnel() {
  const panel = document.getElementById('hv2-tab-personnel');
  panel.innerHTML = `
    <div class="hv2-toolbar">
      <div class="hv2-period-toggle" id="personnel-view-toggle">
        <button class="hv2-period-btn${personnelView === 'ekspedienter' ? ' active' : ''}" data-view="ekspedienter">🛒 Ekspedienter</button>
        <button class="hv2-period-btn${personnelView === 'personale' ? ' active' : ''}" data-view="personale">👨‍💼 Personale</button>
      </div>
      <div class="hv2-toolbar-sep"></div>
      <div class="hv2-period-toggle" id="personnel-period">
        <button class="hv2-period-btn${currentPeriod === 'altid' ? ' active' : ''}" data-period="altid">Altid</button>
        <button class="hv2-period-btn${currentPeriod === 'maaned' ? ' active' : ''}" data-period="maaned">30 dage</button>
        <button class="hv2-period-btn${currentPeriod === 'uge' ? ' active' : ''}" data-period="uge">7 dage</button>
      </div>
      <div class="hv2-spacer"></div>
      <span class="hv2-count" id="personnel-count">…</span>
    </div>
    <div id="personnel-table"><div class="hv2-loading">Indlæser personale...</div></div>`;

  document.querySelectorAll('#personnel-view-toggle .hv2-period-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('#personnel-view-toggle .hv2-period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      personnelView = btn.dataset.view;
      loadPersonnelData();
    };
  });
  document.querySelectorAll('#personnel-period .hv2-period-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('#personnel-period .hv2-period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPeriod = btn.dataset.period;
      const { from, to } = periodRange(currentPeriod);
      currentFrom = from;
      currentTo = to;
      loadPersonnelData();
    };
  });

  // Default til 'altid' for personale-tab (har ikke 'idag' som toggle-option)
  if (!['altid', 'maaned', 'uge'].includes(currentPeriod)) {
    currentPeriod = 'altid';
    const { from, to } = periodRange('altid');
    currentFrom = from;
    currentTo = to;
    document.querySelectorAll('#personnel-period .hv2-period-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.period === 'altid');
    });
  }

  loadPersonnelData();
}

async function loadPersonnelData() {
  const wrap = document.getElementById('personnel-table');
  wrap.innerHTML = '<div class="hv2-loading">Indlæser...</div>';
  try {
    const role = personnelView === 'personale' ? 'admin' : 'kunde';
    const data = await getEmployeeSummary(currentFrom, currentTo, role, includeTestUsers);
    const countEl = document.getElementById('personnel-count');
    if (countEl) countEl.textContent = `${data.length} ${personnelView === 'personale' ? 'personale' : 'ekspedienter'}`;

    if (personnelView === 'ekspedienter') {
      const rows = data.map(d => {
        const level = getLevel(d.total_sales_cumulative, d.total_minutes);
        const saldoClass = d.balance < 0 ? 'hv2-saldo-neg' : d.balance > 0 ? 'hv2-saldo-pos' : 'hv2-saldo-zero';
        return `<tr>
          <td style="font-weight:600">${d.clerk_name}</td>
          <td class="${saldoClass}">${d.balance != null ? fmtKr(d.balance) : '—'}</td>
          <td>${fmtMinutes(d.total_minutes)}</td>
          <td>${d.total_sales || 0}</td>
          <td>${d.total_items_sold || 0}</td>
          <td>${fmtKr(d.total_revenue || 0)}</td>
          <td><span class="hv2-level-badge">${level}</span></td>
        </tr>`;
      });

      wrap.innerHTML = `<div class="hv2-table-wrap"><div class="hv2-table-scroll"><table class="hv2-table">
        <thead><tr><th>Navn</th><th>Saldo</th><th>Tid som eksp.</th><th>Antal salg</th><th>Produkter solgt</th><th>Salg beløb</th><th>Flango Level</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
        <tfoot><tr><td>Total (${data.length})</td><td>—</td><td>${fmtMinutes(data.reduce((s, d) => s + (d.total_minutes || 0), 0))}</td><td>${data.reduce((s, d) => s + (d.total_sales || 0), 0)}</td><td>${data.reduce((s, d) => s + (d.total_items_sold || 0), 0)}</td><td>${fmtKr(data.reduce((s, d) => s + Number(d.total_revenue || 0), 0))}</td><td>—</td></tr></tfoot>
      </table></div></div>`;
    } else {
      // Personale view — hent selv/assisteret salg + tid + indbetalinger for hver admin
      const enriched = await Promise.all(data.map(async d => {
        const [split, timeSplit, deposits] = await Promise.all([
          getAdminSalesSplit(d.clerk_id, currentFrom, currentTo),
          getAdminTimeSplit(d.clerk_id, currentFrom, currentTo),
          getAdminDeposits(d.clerk_id, currentFrom, currentTo),
        ]);
        const totalCafeMinutes = timeSplit.selfMinutes + timeSplit.childMinutes;
        return { ...d, ...split, ...timeSplit, totalCafeMinutes, ...deposits };
      }));

      const rows = enriched.map(d => `<tr>
        <td style="font-weight:600">${d.clerk_name}</td>
        <td style="font-weight:600">${fmtMinutes(d.totalCafeMinutes)}</td>
        <td>${fmtMinutes(d.selfMinutes)}</td>
        <td>${fmtMinutes(d.childMinutes)}</td>
        <td>${d.total_sales || 0}</td>
        <td>${d.total_items_sold || 0}</td>
        <td>${d.depositCount || 0} (${fmtKr(d.depositAmount || 0)})</td>
        <td>${fmtKr(d.selfSales)}</td>
        <td>${fmtKr(d.assistedSales)}</td>
        <td>${fmtKr(d.total_revenue || 0)}</td>
      </tr>`);

      wrap.innerHTML = `<div class="hv2-table-wrap"><div class="hv2-table-scroll"><table class="hv2-table">
        <thead><tr><th>Navn</th><th>Tid i caféen</th><th>Selv eksp.</th><th>Børn eksp.</th><th>Antal salg</th><th>Antal produkter</th><th>Indbetalinger</th><th>Selv salg</th><th>Assisteret salg</th><th>Salg i alt</th></tr></thead>
        <tbody>${rows.join('')}</tbody>
        <tfoot><tr><td>Total (${enriched.length})</td><td style="font-weight:600">${fmtMinutes(enriched.reduce((s, d) => s + d.totalCafeMinutes, 0))}</td><td>${fmtMinutes(enriched.reduce((s, d) => s + d.selfMinutes, 0))}</td><td>${fmtMinutes(enriched.reduce((s, d) => s + d.childMinutes, 0))}</td><td>${enriched.reduce((s, d) => s + (d.total_sales || 0), 0)}</td><td>${enriched.reduce((s, d) => s + (d.total_items_sold || 0), 0)}</td><td>${enriched.reduce((s, d) => s + (d.depositCount || 0), 0)} (${fmtKr(enriched.reduce((s, d) => s + (d.depositAmount || 0), 0))})</td><td>${fmtKr(enriched.reduce((s, d) => s + d.selfSales, 0))}</td><td>${fmtKr(enriched.reduce((s, d) => s + d.assistedSales, 0))}</td><td>${fmtKr(enriched.reduce((s, d) => s + Number(d.total_revenue || 0), 0))}</td></tr></tfoot>
      </table></div></div>`;
    }
  } catch (err) {
    console.error('loadPersonnelData', err);
    wrap.innerHTML = '<div class="hv2-error">Fejl ved indlæsning.</div>';
  }
}

// ═══════════════════════════════════════════════════
// TAB 5: TOPLISTER
// ═══════════════════════════════════════════════════

let toplistView = 'produkter';
let toplistSort = 'antal';

async function loadToplists() {
  const panel = document.getElementById('hv2-tab-toplists');
  panel.innerHTML = `
    <div class="hv2-toolbar">
      <div class="hv2-period-toggle" id="toplist-view">
        <button class="hv2-period-btn active" data-view="produkter">🛍️ Produkter</button>
        <button class="hv2-period-btn" data-view="ekspedienter">🛒 Ekspedienter</button>
        <button class="hv2-period-btn" data-view="kunder">👥 Kunder</button>
      </div>
      <div class="hv2-toolbar-sep"></div>
      ${makePeriodToggle('toplist-period', loadToplistData).replace('<div class="hv2-toolbar">', '').replace('</div>', '')}
    </div>
    <div id="toplist-body"><div class="hv2-loading">Indlæser toplister...</div></div>`;

  bindPeriodToggle('toplist-period', loadToplistData);
  document.querySelectorAll('#toplist-view .hv2-period-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('#toplist-view .hv2-period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      toplistView = btn.dataset.view;
      loadToplistData();
    };
  });

  loadToplistData();
}

async function loadToplistData() {
  const body = document.getElementById('toplist-body');
  body.innerHTML = '<div class="hv2-loading">Indlæser...</div>';
  const colors = ['flango', 'green', 'blue', 'purple', 'orange', 'flango', 'green'];

  try {
    if (toplistView === 'produkter') {
      const products = await getTopProducts(currentFrom, currentTo, 7, includeTestUsers);
      const byCount = [...products].sort((a, b) => b.antal - a.antal);
      const byRev = [...products].sort((a, b) => b.beloeb - a.beloeb);
      body.innerHTML = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div class="hv2-chart-card">
          <div class="hv2-chart-header"><div class="hv2-chart-title">🏆 Top produkter (antal)</div></div>
          <div id="toplist-count-chart"></div>
        </div>
        <div class="hv2-chart-card">
          <div class="hv2-chart-header"><div class="hv2-chart-title">💰 Top produkter (omsætning)</div></div>
          <div id="toplist-rev-chart"></div>
        </div>
      </div>`;
      renderBarChart('toplist-count-chart', byCount.map((p, i) => ({
        rank: i + 1, label: `${productIcon(p.emoji, p.icon_url, 18, p.icon_storage_path)} ${p.name}`, value: `${p.antal} stk`, pct: byCount[0]?.antal ? (p.antal / byCount[0].antal) * 100 : 0,
        color: colors[i % colors.length],
      })));
      renderBarChart('toplist-rev-chart', byRev.map((p, i) => ({
        rank: i + 1, label: `${productIcon(p.emoji, p.icon_url, 18, p.icon_storage_path)} ${p.name}`, value: fmtKr(p.beloeb), pct: byRev[0]?.beloeb ? (p.beloeb / byRev[0].beloeb) * 100 : 0,
        color: colors[i % colors.length],
      })));
    } else if (toplistView === 'ekspedienter') {
      const clerks = await getTopClerks(currentFrom, currentTo, 7, includeTestUsers);
      body.innerHTML = `<div class="hv2-chart-card"><div class="hv2-chart-header"><div class="hv2-chart-title">⭐ Top ekspedienter (salg)</div></div><div id="toplist-clerks-chart"></div></div>`;
      renderBarChart('toplist-clerks-chart', clerks.map((c, i) => ({
        rank: i + 1, label: c.name, value: `${c.antal_salg} salg`, secondary: fmtKr(c.beloeb),
        pct: clerks[0]?.antal_salg ? (c.antal_salg / clerks[0].antal_salg) * 100 : 0,
        color: colors[i % colors.length],
      })));
    } else {
      const customers = await getTopCustomers(currentFrom, currentTo, 7, includeTestUsers);
      body.innerHTML = `<div class="hv2-chart-card"><div class="hv2-chart-header"><div class="hv2-chart-title">👥 Top kunder (forbrug)</div></div><div id="toplist-customers-chart"></div></div>`;
      renderBarChart('toplist-customers-chart', customers.map((c, i) => ({
        rank: i + 1, label: c.name, value: fmtKr(c.forbrugt), secondary: `${c.antal_koeb} køb`,
        pct: customers[0]?.forbrugt ? (c.forbrugt / customers[0].forbrugt) * 100 : 0,
        color: colors[i % colors.length],
      })));
    }
  } catch (err) {
    console.error('loadToplistData', err);
    body.innerHTML = '<div class="hv2-error">Fejl ved indlæsning.</div>';
  }
}

// ═══════════════════════════════════════════════════
// TAB 6: STATISTIK
// ═══════════════════════════════════════════════════

let statPeriod = '7d';

async function loadStatistics() {
  const panel = document.getElementById('hv2-tab-statistics');
  panel.innerHTML = `
    <div class="hv2-toolbar">
      <div class="hv2-period-toggle" id="stat-period">
        <button class="hv2-period-btn active" data-period="7d">7 dage</button>
        <button class="hv2-period-btn" data-period="30d">30 dage</button>
        <button class="hv2-period-btn" data-period="alt">Alt</button>
      </div>
    </div>
    <div id="stat-body"><div class="hv2-loading">Indlæser statistik...</div></div>`;

  document.querySelectorAll('#stat-period .hv2-period-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('#stat-period .hv2-period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      statPeriod = btn.dataset.period;
      loadStatData();
    };
  });

  loadStatData();
}

async function loadStatData() {
  const body = document.getElementById('stat-body');
  body.innerHTML = '<div class="hv2-loading">Indlæser...</div>';
  const now = new Date();
  let from;
  if (statPeriod === '7d') { from = new Date(now); from.setDate(from.getDate() - 6); }
  else if (statPeriod === '30d') { from = new Date(now); from.setDate(from.getDate() - 29); }
  else { from = new Date('2020-01-01'); }
  const to = new Date(now); to.setHours(23, 59, 59, 999);

  try {
    const incTest = includeTestUsers;
    const [revenueByDay, balanceDist, club, deposits, balances] = await Promise.all([
      getRevenueByDay(from, to, incTest),
      getBalanceDistribution(incTest),
      getClubStats(from, to, incTest),
      getTotalDeposits(from, to, incTest),
      getTotalBalances(incTest),
    ]);

    body.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
        <div class="hv2-chart-card">
          <div class="hv2-chart-header"><div class="hv2-chart-title">📈 Omsætning pr. dag</div></div>
          <div id="stat-rev-chart"></div>
        </div>
        <div class="hv2-chart-card">
          <div class="hv2-chart-header"><div class="hv2-chart-title">💰 Saldofordeling</div></div>
          <div id="stat-balance-chart"></div>
        </div>
      </div>
      <div class="hv2-stat-grid hv2-stat-grid-3">
        <div class="hv2-stat-card">
          <div class="hv2-stat-header"><div class="hv2-stat-icon" style="background:var(--hv2-positive-light)">💳</div></div>
          <div class="hv2-stat-value">${fmtKr(club.totalRevenue)}</div>
          <div class="hv2-stat-label">Total omsætning</div>
          <div class="hv2-stat-detail">${club.saleCount} transaktioner</div>
        </div>
        <div class="hv2-stat-card">
          <div class="hv2-stat-header"><div class="hv2-stat-icon" style="background:var(--hv2-info-light)">💰</div></div>
          <div class="hv2-stat-value">${fmtKr(deposits.amount)}</div>
          <div class="hv2-stat-label">Total indbetalinger</div>
          <div class="hv2-stat-detail">${deposits.count} indbetalinger</div>
        </div>
        <div class="hv2-stat-card">
          <div class="hv2-stat-header"><div class="hv2-stat-icon" style="background:var(--hv2-flango-light)">🏦</div></div>
          <div class="hv2-stat-value">${fmtKr(balances.total)}</div>
          <div class="hv2-stat-label">Saldoer i alt</div>
          <div class="hv2-stat-detail">Fordelt på <strong>${balances.count}</strong> konti · gns. <strong>${fmtKr(balances.avg)}</strong></div>
        </div>
      </div>`;

    renderDailyRevenueChart('stat-rev-chart', revenueByDay);
    renderBalanceChart('stat-balance-chart', balanceDist);
  } catch (err) {
    console.error('loadStatData', err);
    body.innerHTML = '<div class="hv2-error">Fejl ved indlæsning.</div>';
  }
}

// ═══════════════════════════════════════════════════
// TAB 7: RAPPORTER
// ═══════════════════════════════════════════════════

function loadReports() {
  const panel = document.getElementById('hv2-tab-reports');
  panel.innerHTML = `
    <div class="hv2-section-title">💾 Eksportér data</div>
    <div class="hv2-toolbar" style="margin-bottom:20px">
      <span class="hv2-date-sep" style="font-weight:500">Periode:</span>
      <input type="date" class="hv2-input" id="report-from" value="${fmtDate(currentFrom)}">
      <span class="hv2-date-sep">til</span>
      <input type="date" class="hv2-input" id="report-to" value="${fmtDate(currentTo)}">
    </div>
    <div class="hv2-export-grid">
      <div class="hv2-export-card" data-export="sales-report"><div class="hv2-export-icon">📄</div><div class="hv2-export-title">Salgsrapport</div><div class="hv2-export-desc">Komplet rapport med opsummering, transaktioner og produktoversigt. Download som .txt</div></div>
      <div class="hv2-export-card" data-export="all-balances"><div class="hv2-export-icon">📊</div><div class="hv2-export-title">Komplet saldoliste</div><div class="hv2-export-desc">Alle brugere med navn, nummer og aktuel saldo. Sorteret alfabetisk.</div></div>
      <div class="hv2-export-card" data-export="negative-balances"><div class="hv2-export-icon">🔴</div><div class="hv2-export-title">Negativ saldo</div><div class="hv2-export-desc">Brugere med negativ saldo. Til opfølgning med forældre.</div></div>
      <div class="hv2-export-card" data-export="transactions-csv"><div class="hv2-export-icon">📋</div><div class="hv2-export-title">Transaktions-CSV</div><div class="hv2-export-desc">Alle transaktioner som CSV. Åbnes i Excel eller Google Sheets.</div></div>
      <div class="hv2-export-card" data-export="clerk-report"><div class="hv2-export-icon">👥</div><div class="hv2-export-title">Ekspedient-rapport</div><div class="hv2-export-desc">Alle ekspedienter med salgstal, tid og Flango Level.</div></div>
      <div class="hv2-export-card" data-export="period-report"><div class="hv2-export-icon">📅</div><div class="hv2-export-title">Periodeoversigt</div><div class="hv2-export-desc">Dag-for-dag opsummering med omsætning og bestsellere.</div></div>
    </div>`;

  panel.querySelectorAll('.hv2-export-card').forEach(card => {
    card.onclick = () => {
      const from = new Date(document.getElementById('report-from')?.value || fmtDate(currentFrom));
      const to = new Date((document.getElementById('report-to')?.value || fmtDate(currentTo)) + 'T23:59:59');
      const type = card.dataset.export;
      const incTest = includeTestUsers;
      switch (type) {
        case 'sales-report': exportSalesReport(from, to, incTest); break;
        case 'all-balances': exportAllBalances(incTest); break;
        case 'negative-balances': exportNegativeBalances(incTest); break;
        case 'transactions-csv': exportTransactionsCsv(from, to, incTest); break;
        case 'clerk-report': exportClerkReport(from, to, incTest); break;
        case 'period-report': exportPeriodReport(from, to, incTest); break;
      }
    };
  });
}
