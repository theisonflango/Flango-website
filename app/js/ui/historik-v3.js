// Ansvar: Historik v3 — modal lifecycle, sidebar, page routing, alle 8 page-render funktioner.
// Genbruger data-laget fra historik-data.js og eksport fra historik-export.js.
import { getCurrentAdmin, getInstitutionId, isCurrentUserAdmin } from '../domain/session-store.js?v=3.0.67';
import { initPurchaseProfiles, getChartData as ppGetChartData } from '../domain/purchase-profiles.js?v=3.0.67';
import {
  periodRange, fmtDate, fmtDateTime, fmtMinutes, fmtKr, fmtDayDate, getLevel,
  getMyRevenue, getMyTransactionCount, getMyTransactionSplit, getClubStats, getTotalDeposits,
  getMyMinutesWorked, getTotalBalances, getTopProducts, getDailyClerks,
  getWeekRevenue, getHourlyRevenue, getDailyRevenue, getDailyRevenueActive, getMonthlyRevenue,
  getTopClerks, getTopCustomers,
  getRevenueByDay, getBalanceDistribution, getProductsIconMap,
  getTransactions, getSaleItems, undoSale, registerSaleAdjustment,
  getEmployeeSummary, getAdminSalesSplit, getAdminTimeSplit, getAdminDeposits,
  getFirstSaleDate, getAdminCafeDays, getCustomerStats,
} from '../domain/historik-data.js?v=3.0.67';
import { exportSalesReport, exportAllBalances, exportNegativeBalances, exportTransactionsCsv, exportClerkReport, exportPeriodReport } from './historik-export.js?v=3.0.67';
import { showConfirmModal } from './confirm-modals.js?v=3.0.67';
import { showCustomAlert } from './sound-and-alerts.js?v=3.0.67';
import { invalidateTodaysSalesCache } from '../domain/purchase-limits.js?v=3.0.67';
import {
  renderAreaChart, renderBarChart, renderHorizontalBars, renderDonutChart,
  renderGauge, attachChartTooltips, progressBar, renderRankingList,
  animateChartEntrance,
  BAR_COLORS, escHtml, fmtNum,
} from './historik-v3-charts.js?v=3.0.67';

// ─── CONSTANTS ───
import { getCachedProductIconUrl } from '../core/product-icon-cache.js?v=3.0.67';

const ICON_PREFIX = '::icon::';
function productIcon(emoji, iconUrl, size = 18, storagePath = '') {
  // Priority 1: Signed URL from private bucket
  if (storagePath) {
    const signedUrl = getCachedProductIconUrl(storagePath);
    if (signedUrl) return `<img src="${signedUrl}" style="width:${size}px;height:${size}px;vertical-align:middle;border-radius:3px;margin-right:2px" alt="">`;
  }
  if (emoji && emoji.startsWith(ICON_PREFIX)) {
    const path = emoji.slice(ICON_PREFIX.length);
    if (path) {
      if (!path.startsWith('http')) {
        const signedUrl = getCachedProductIconUrl(path);
        const url = signedUrl || `https://jbknjgbpghrbrstqwoxj.supabase.co/storage/v1/object/public/product-icons/${path}`;
        return `<img src="${url}" style="width:${size}px;height:${size}px;vertical-align:middle;border-radius:3px;margin-right:2px" alt="">`;
      }
      return `<img src="${path}" style="width:${size}px;height:${size}px;vertical-align:middle;border-radius:3px;margin-right:2px" alt="">`;
    }
  }
  if (iconUrl) return `<img src="${iconUrl}" style="width:${size}px;height:${size}px;vertical-align:middle;border-radius:3px;margin-right:2px" alt="">`;
  if (emoji) return emoji;
  return '';
}

const SALDO_COLORS = {
  'Negativ': '#dc2626', '0 kr': '#ef4444', '1–20 kr': '#f97316',
  '21–50 kr': '#eab308', '51–100 kr': '#3b82f6', '100+ kr': '#22c55e',
};

const NAV_ITEMS = [
  { id: 'transactions', icon: '📋', label: 'Transaktioner', section: 'HISTORIK' },
  { id: 'today', icon: '☀️', label: 'I dag', section: 'HISTORIK' },
  { id: 'overview', icon: '📈', label: 'Overblik', section: 'HISTORIK' },
  { id: 'toplists', icon: '🏆', label: 'Toplister', section: 'ANALYSE' },
  { id: 'stats', icon: '📊', label: 'Statistik', section: 'ANALYSE' },
  { id: 'profiles', icon: '🛍️', label: 'Købsprofiler', section: 'ANALYSE' },
  { id: 'timesaved', icon: '⏱️', label: 'Tidsbesparelse', section: 'INDSIGT' },
  { id: 'reconcile', icon: '⚖️', label: 'Afstemning', section: 'ØKONOMI' },
  { id: 'reports', icon: '📁', label: 'Rapporter', section: 'EKSPORT' },
  { id: 'v2', icon: '🕰️', label: 'Historik V2', section: 'ANDET' },
];

const PAGE_TITLES = {
  today: null, // dynamic
  overview: 'Overblik',
  toplists: 'Toplister',
  stats: 'Statistik',
  profiles: 'Købsprofiler',
  transactions: 'Transaktioner',
  timesaved: 'Tidsbesparelse',
  reconcile: 'Afstemning',
  reports: 'Eksportér data',
};

// ─── PAGE DATA CACHE (60 s TTL) ───
const _pageCache = new Map();
const CACHE_TTL = 60_000;
function _ck(...p) { return p.join('|'); }
function getCached(key) {
  const e = _pageCache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL) { _pageCache.delete(key); return null; }
  return e.data;
}
function setCache(key, data) { _pageCache.set(key, { data, ts: Date.now() }); }
function invalidateAllCaches() { _pageCache.clear(); kundeCached = null; cdCachedDays = null; }

// ─── STATE ───
let activePage = 'transactions';
let includeTestUsers = false;

// Sub-states per page
let toplistTab = 'produkter';
let toplistPeriod = 'Altid';
let toplistSort = 'Antal';
let overviewRange = '30 dage';
let overviewHideWE = true;
let statsRange = '30 dage';
let reportPeriod = 'Alt';
let reportFrom = null;
let reportTo = null;
let afstemningTab = 'mobilepay';
let personnelView = 'ekspedienter';
let txTypeFilter = 'alle';
let txSearch = '';
let txSearchCustomerOnly = false; // When true, search only matches target/customer name
let txSearchClerkOnly = false; // When true, search only matches clerk/expedient name
let allTransactions = [];
let _txIconMap = {};
let txPeriod = '30 dage';
let ppSelectedUserId = null;
let ppSelectedUserName = '';
let ppPeriod = 'Altid';
let ppSortBy = 'Antal';
let ppInitDone = false;
// Café-dage drilldown state (Personale tab)
let cdSelectedPerson = null; // { clerk_id, clerk_name }
let cdSortCol = 'date';
let cdSortDir = 'desc';
let cdCachedDays = null; // cached result of getAdminCafeDays

// Kunder tab state
let kundeSortCol = 'forbrug';
let kundeSortDir = 'desc';
let kundeSearch = '';
let kundeSaldoFilter = 'alle'; // alle | negativ | nul | positiv
let kundeCached = null; // cached getCustomerStats result

// ─── MODAL LIFECYCLE ───

/**
 * Open historik V3 directly on Transactions page with pre-filled search and "Alt" period.
 */
export function openHistorikV3ForUser(userName) {
  activePage = 'transactions';
  txPeriod = 'Altid';
  txTypeFilter = 'alle';
  txSearchCustomerOnly = true; // Only show transactions where this person is the customer
  _pendingTxSearch = userName || '';

  openHistorikV3();
}

let _pendingTxSearch = null;
let _preserveFilters = false;

// Global accessor for external callers (user-admin-panel)
window.__flangoOpenHistorikV3ForUser = openHistorikV3ForUser;

export function openHistorikV3() {
  if (document.getElementById('hv3-backdrop')) return;
  const backdrop = document.createElement('div');
  backdrop.id = 'hv3-backdrop';
  backdrop.className = 'hv3-backdrop';
  backdrop.innerHTML = buildLayout();
  document.body.appendChild(backdrop);
  document.body.style.overflow = 'hidden';

  // Bind events
  backdrop.querySelector('.hv3-close-btn')?.addEventListener('click', closeHistorikV3);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeHistorikV3();
  });
  document.addEventListener('keydown', onEsc);

  // Sidebar nav
  backdrop.querySelectorAll('.hv3-sidebar-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.dataset.page === 'v2') {
        closeHistorikV3();
        const { openHistorikModal } = await import('./historik-modal.js?v=3.0.67');
        openHistorikModal();
        return;
      }
      activePage = btn.dataset.page;
      updateSidebarActive();
      renderActivePage();
    });
  });

  // Initial render
  updateSidebarActive();
  renderActivePage();
}

export function closeHistorikV3() {
  const backdrop = document.getElementById('hv3-backdrop');
  if (backdrop) {
    backdrop.remove();
    document.body.style.overflow = '';
  }
  document.removeEventListener('keydown', onEsc);
}

function onEsc(e) {
  if (e.key === 'Escape') closeHistorikV3();
}

// ─── LAYOUT ───

function buildLayout() {
  const admin = getCurrentAdmin();
  const adminName = admin?.name || 'Admin';

  let lastSection = '';
  let navHtml = '';
  NAV_ITEMS.forEach(item => {
    if (item.section !== lastSection) {
      navHtml += `<div class="hv3-sidebar-section">${item.section}</div>`;
      lastSection = item.section;
    }
    navHtml += `<button class="hv3-sidebar-btn" data-page="${item.id}">
      <span class="hv3-sidebar-btn-icon">${item.icon}</span>
      <span>${item.label}</span>
    </button>`;
  });

  return `
<div class="hv3-layout">
  <nav class="hv3-sidebar">
    <div class="hv3-sidebar-header">
      <div class="hv3-sidebar-logo">
        <span class="hv3-sidebar-logo-icon">🍽️</span>
        <span class="hv3-sidebar-logo-text">SFO Café</span>
      </div>
      <div class="hv3-sidebar-subtitle">Opsummering — ${escHtml(adminName)}</div>
    </div>
    ${navHtml}
    <div class="hv3-sidebar-spacer"></div>
    <div class="hv3-sidebar-footer">Flango POS v2.0</div>
  </nav>
  <main class="hv3-main">
    <div class="hv3-content">
      <div class="hv3-page-header" id="hv3-page-header">
        <div>
          <h1 class="hv3-page-title" id="hv3-page-title"></h1>
          <p class="hv3-page-subtitle" id="hv3-page-subtitle"></p>
        </div>
        <button class="hv3-close-btn" title="Luk (Esc)">✕</button>
      </div>
      <div id="hv3-page-content"></div>
    </div>
  </main>
</div>`;
}

function updateSidebarActive() {
  const backdrop = document.getElementById('hv3-backdrop');
  if (!backdrop) return;
  backdrop.querySelectorAll('.hv3-sidebar-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === activePage);
  });
}

function setPageTitle(title, subtitle) {
  const el = document.getElementById('hv3-page-title');
  const sub = document.getElementById('hv3-page-subtitle');
  if (el) el.textContent = title || '';
  if (sub) sub.textContent = subtitle || '';
}

function getPageContainer() {
  return document.getElementById('hv3-page-content');
}

function showLoading() {
  const c = getPageContainer();
  if (c) c.innerHTML = '<div class="hv3-loading"><div class="hv3-spinner"></div>Indlæser...</div>';
}

// ─── PAGE ROUTING ───

async function renderActivePage() {
  const now = new Date();
  const subtitle = `Sidst opdateret kl. ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  showLoading();

  try {
    switch (activePage) {
      case 'today': {
        const dayNames = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag'];
        const monthNames = ['januar', 'februar', 'marts', 'april', 'maj', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'december'];
        const title = `I dag — ${dayNames[now.getDay()]} ${now.getDate()}. ${monthNames[now.getMonth()]} ${now.getFullYear()}`;
        setPageTitle(title, subtitle);
        await renderPageToday();
        break;
      }
      case 'overview':
        setPageTitle('Overblik', subtitle);
        await renderPageOverblik();
        break;
      case 'toplists':
        setPageTitle('Toplister', subtitle);
        await renderPageToplister();
        break;
      case 'stats':
        setPageTitle('Statistik', subtitle);
        await renderPageStatistik();
        break;
      case 'profiles':
        setPageTitle('Købsprofiler', subtitle);
        await renderPageKoebsprofiler();
        break;
      case 'transactions':
        setPageTitle('Transaktioner', subtitle);
        await renderPageTransaktioner();
        break;
      case 'timesaved':
        setPageTitle('Tidsbesparelse', subtitle);
        await renderPageTidsbesparelse();
        break;
      case 'reconcile':
        setPageTitle('Afstemning', subtitle);
        renderPageAfstemning();
        break;
      case 'reports':
        setPageTitle('Eksportér data', subtitle);
        await renderPageRapporter();
        break;
    }
  } catch (err) {
    console.error('Historik v3 render error:', err);
    const c = getPageContainer();
    if (c) c.innerHTML = `<div class="hv3-card" style="padding:40px;text-align:center;color:var(--hv3-red)">
      <p style="font-size:16px;font-weight:700">Fejl ved indlæsning</p>
      <p style="font-size:13px;color:var(--hv3-text-muted)">${escHtml(err.message)}</p>
    </div>`;
  }
}

// ═══════════════════════════════════════════
// HELPER: Stat Card, Section Title, Pills
// ═══════════════════════════════════════════

function statCard(label, value, opts = {}) {
  const { icon = '', trend = '', trendUp = true, sub = '', rank = '' } = opts;
  let badgeHtml = '';
  if (trend) {
    const cls = trendUp ? 'hv3-badge-green' : 'hv3-badge-red';
    badgeHtml = `<span class="hv3-badge ${cls}">${trendUp ? '↑' : '↓'} ${escHtml(trend)}</span>`;
  }
  return `
  <div class="hv3-stat">
    <div class="hv3-stat-top">
      <div>
        <div class="hv3-stat-label">${escHtml(label)}</div>
        <div class="hv3-stat-value">${escHtml(value)}</div>
      </div>
      ${icon ? `<span class="hv3-stat-icon">${icon}</span>` : ''}
    </div>
    <div class="hv3-stat-footer">
      ${badgeHtml}
      ${sub ? `<span class="hv3-stat-sub">${escHtml(sub)}${rank ? `<br>${escHtml(rank)}` : ''}</span>` : (rank ? `<span class="hv3-stat-sub">${escHtml(rank)}</span>` : '')}
    </div>
  </div>`;
}

function sectionTitle(text, rightHtml = '') {
  return `<div class="hv3-section-title"><h3>${text}</h3>${rightHtml}</div>`;
}

function filterPills(options, active, onClickFnName, small = false) {
  return `<div class="hv3-pills">${options.map(o =>
    `<button class="hv3-pill${small ? ' small' : ''}${o === active ? ' active' : ''}" onclick="${onClickFnName}('${o}')">${escHtml(o)}</button>`
  ).join('')}</div>`;
}

// ═══════════════════════════════════════════
// PAGE: I DAG (Today)
// ═══════════════════════════════════════════

async function renderPageToday() {
  const { from, to } = periodRange('idag');
  const todayKey = from.toISOString().slice(0, 10);
  const ck = _ck('today', todayKey, includeTestUsers);
  let d = getCached(ck);
  if (!d) {
    const firstSaleDate = await getFirstSaleDate();
    const allTimeFrom = firstSaleDate || new Date('2020-01-01');
    const allTimeTo = new Date(); allTimeTo.setHours(23, 59, 59, 999);
    const [split, clubToday, clubAllTime, deposits, minutesWorked, hourly, week, clerks] = await Promise.all([
      getMyTransactionSplit(from, to, includeTestUsers),
      getClubStats(from, to, includeTestUsers),
      getClubStats(allTimeFrom, allTimeTo, includeTestUsers),
      getTotalDeposits(from, to, includeTestUsers),
      getMyMinutesWorked(from, to),
      getHourlyRevenue(new Date(), includeTestUsers),
      getWeekRevenue(new Date(), includeTestUsers),
      getDailyClerks(from, to, includeTestUsers),
    ]);
    d = { split, clubToday, clubAllTime, deposits, minutesWorked, hourly, week, clerks };
    setCache(ck, d);
  }
  const { split, clubToday, clubAllTime, deposits, minutesWorked, hourly, week, clerks } = d;

  const todayRev = clubToday.totalRevenue;
  const avgDaily = clubAllTime.cafeDays > 0 ? Math.round(clubAllTime.totalRevenue / clubAllTime.cafeDays) : 0;
  const avgTx = clubAllTime.cafeDays > 0 ? Math.round(clubAllTime.saleCount / clubAllTime.cafeDays) : 0;
  const trendPct = avgDaily > 0 ? Math.round(((todayRev - avgDaily) / avgDaily) * 100) : 0;
  const txTrendPct = avgTx > 0 ? Math.round(((clubToday.saleCount - avgTx) / avgTx) * 100) : 0;

  const c = getPageContainer();
  if (!c) return;

  // Chart IDs
  const hourlyChartId = 'hv3-hourly-' + Date.now();
  const weeklyChartId = 'hv3-weekly-' + Date.now();

  c.innerHTML = `<div class="hv3-page">
    <!-- Stat cards -->
    <div class="hv3-stats-row">
      ${statCard('Omsætning i dag', fmtKr(todayRev), {
        icon: '💰',
        trend: trendPct !== 0 ? Math.abs(trendPct) + '%' : '',
        trendUp: trendPct >= 0,
        sub: `vs. klub gns. ${fmtKr(avgDaily)}`
      })}
      ${statCard('Transaktioner', String(clubToday.saleCount), {
        icon: '🧾',
        trend: txTrendPct !== 0 ? Math.abs(txTrendPct) + '%' : '',
        trendUp: txTrendPct >= 0,
        sub: `vs. klub ${avgTx}/dag`
      })}
      ${statCard('Indbetalinger', fmtKr(deposits.amount), {
        icon: '💳', sub: `${deposits.count} indbetalinger`
      })}
      ${statCard('Min tid i dag', fmtMinutes(minutesWorked), {
        icon: '⏱️', sub: 'ansvarlig'
      })}
    </div>

    <!-- Transaction split -->
    <div class="hv3-card">
      ${sectionTitle('Transaktioner fordelt')}
      <div style="display:flex;gap:24px;align-items:center">
        <div style="flex:1">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px">
            <span style="font-size:13px;color:var(--hv3-text-muted)">Mine salg</span>
            <span style="font-size:13px;font-weight:700">${split.myCount}</span>
          </div>
          ${progressBar(split.myCount, split.total, 'var(--hv3-accent)')}
          <div style="display:flex;justify-content:space-between;margin-top:12px;margin-bottom:8px">
            <span style="font-size:13px;color:var(--hv3-text-muted)">Børns salg</span>
            <span style="font-size:13px;font-weight:700">${split.childCount}</span>
          </div>
          ${progressBar(split.childCount, split.total, '#22c55e')}
        </div>
        <div style="text-align:center;padding:0 20px">
          <div style="font-size:32px;font-weight:800;color:var(--hv3-text)">${split.total}</div>
          <div style="font-size:11px;color:var(--hv3-text-light)">total</div>
        </div>
      </div>
    </div>

    <!-- Hourly + Weekly charts -->
    <div class="hv3-grid-2">
      <div class="hv3-card">
        ${sectionTitle('📊 Salg pr. time')}
        <div style="font-size:11px;color:var(--hv3-text-light);margin-top:-8px;margin-bottom:12px">Kun åbningstid kl. 13–16</div>
        ${renderAreaChart(hourly, { id: hourlyChartId, height: 200, showDots: hourly.length <= 15 })}
      </div>
      <div class="hv3-card">
        ${sectionTitle('📅 Denne uge', `<span style="font-weight:400;font-size:12px;color:var(--hv3-text-light)">${fmtKr(week.total)}</span>`)}
        ${renderBarChart(week.days.map(d => ({ label: d.label, value: d.revenue, isWeekend: d.label === 'Lør' || d.label === 'Søn' })), {
          id: weeklyChartId, height: 200, color: '#22c55e', refLine: avgDaily,
          colorFn: (d) => d.isWeekend ? '#e8e0d6' : d.value > 0 ? '#22c55e' : '#e8e0d6'
        })}
        <div style="text-align:center;font-size:11px;color:var(--hv3-text-light);margin-top:4px">— Gns. ${fmtKr(avgDaily)}/dag</div>
      </div>
    </div>

    <!-- Clerks table -->
    <div class="hv3-card">
      ${sectionTitle('👥 Dagens ekspedienter')}
      <div style="overflow-x:auto">
        <table class="hv3-table">
          <thead><tr>${['ROLLE', 'NAVN', 'ANTAL SALG', 'BELØB', 'TID'].map(h => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>
            ${clerks.map(cl => {
              const isAdmin = cl.role === 'admin';
              const roleCls = isAdmin ? 'hv3-role-voksen' : 'hv3-role-barn';
              const roleLabel = isAdmin ? 'Voksen' : 'Barn';
              return `<tr>
                <td><span class="hv3-role-badge ${roleCls}">${roleLabel}</span></td>
                <td style="font-weight:${isAdmin ? 600 : 400}">${escHtml(cl.name)}</td>
                <td style="font-weight:600">${cl.saleCount}</td>
                <td>${fmtKr(cl.revenue)}</td>
                <td style="color:var(--hv3-text-muted)">${fmtMinutes(cl.minutes)}${isAdmin ? '<span style="font-size:10px;color:var(--hv3-accent);margin-left:6px">(ansvarlig)</span>' : ''}</td>
              </tr>`;
            }).join('')}
          </tbody>
          <tfoot><tr>
            <td colspan="2">Total</td>
            <td style="font-weight:700">${clerks.reduce((s, cl) => s + cl.saleCount, 0)}</td>
            <td style="font-weight:700">${fmtKr(clerks.reduce((s, cl) => s + cl.revenue, 0))}</td>
            <td style="color:var(--hv3-text-light)">—</td>
          </tr></tfoot>
        </table>
      </div>
    </div>
  </div>`;

  // Attach tooltips + animate charts
  attachChartTooltips(hourlyChartId, { valueSuffix: ' kr' });
  attachChartTooltips(weeklyChartId, { valueSuffix: ' kr', showWeekend: true });
  animateChartEntrance(c);
}

// ═══════════════════════════════════════════
// PAGE: OVERBLIK
// ═══════════════════════════════════════════

// Expose for inline onclick
window.__hv3SetOverviewRange = (range) => { overviewRange = range; renderPageOverblik(); };
window.__hv3ToggleWE = () => { overviewHideWE = !overviewHideWE; renderPageOverblik(); };

async function renderPageOverblik() {
  const days = overviewRange === '7 dage' ? 7 : overviewRange === '30 dage' ? 30 : 90;
  const now = new Date();
  const from = new Date(now); from.setDate(from.getDate() - days + 1); from.setHours(0, 0, 0, 0);
  const to = new Date(now); to.setHours(23, 59, 59, 999);

  const ck = _ck('overview', overviewRange, includeTestUsers);
  let cached = getCached(ck);
  if (!cached) {
    const firstDate = await getFirstSaleDate();
    const altFrom = firstDate || new Date('2020-01-01');

    const [dailyData, monthlyData] = await Promise.all([
      overviewRange === 'Alt'
        ? getDailyRevenueActive(altFrom, to, includeTestUsers)
        : getDailyRevenue(from, to, includeTestUsers),
      getMonthlyRevenue(altFrom, to, includeTestUsers),
    ]);
    cached = { dailyData, monthlyData };
    setCache(ck, cached);
  }
  const { dailyData, monthlyData } = cached;

  // Compute stats
  let filtered = dailyData;
  if (overviewHideWE && overviewRange !== 'Alt') {
    // Mark weekends if not already marked
    filtered = dailyData.filter(d => {
      // For getDailyRevenue, labels are just day numbers; we need to check the date
      // Since we don't have day-of-week info in short labels, let's use day index
      return d.value > 0 || !overviewHideWE;
    });
  }

  const openDays = (overviewRange === 'Alt' ? dailyData : dailyData.filter(d => d.value > 0));
  const totalRev = openDays.reduce((s, d) => s + d.value, 0);
  const avgDaily = openDays.length ? Math.round(totalRev / openDays.length) : 0;
  const bestDay = openDays.reduce((best, d) => d.value > (best?.value || 0) ? d : best, openDays[0] || { value: 0, label: '—' });
  const worstDay = openDays.length ? openDays.reduce((worst, d) => d.value < worst.value ? d : worst, openDays[0]) : { value: 0, label: '—' };

  const dailyChartId = 'hv3-daily-' + Date.now();
  const monthlyChartId = 'hv3-monthly-' + Date.now();

  const c = getPageContainer();
  if (!c) return;

  c.innerHTML = `<div class="hv3-page">
    <div class="hv3-flex-between">
      ${filterPills(['7 dage', '30 dage', 'Alt'], overviewRange, '__hv3SetOverviewRange')}
      <div class="hv3-toggle" onclick="__hv3ToggleWE()">
        <div class="hv3-toggle-track ${overviewHideWE ? 'on' : ''}">
          <div class="hv3-toggle-thumb"></div>
        </div>
        Skjul weekender
      </div>
    </div>

    <div class="hv3-stats-row">
      ${statCard('Total omsætning', fmtKr(totalRev), { icon: '💰', sub: `${openDays.length} åbningsdage` })}
      ${statCard('Gns. pr. dag', fmtKr(avgDaily), { icon: '📊', sub: 'kun åbningsdage' })}
      ${statCard('Bedste dag', fmtKr(bestDay?.value || 0), { icon: '🏆', sub: bestDay?.label || '' })}
      ${statCard('Laveste dag', fmtKr(worstDay?.value || 0), { icon: '📉', sub: worstDay?.label || '' })}
    </div>

    <div class="hv3-card">
      ${sectionTitle('📈 Omsætning pr. dag')}
      ${renderAreaChart(filtered.length ? filtered : dailyData, {
        id: dailyChartId, height: 300, refLine: avgDaily,
        showDots: dailyData.length <= 30, areaOpacity: 0.2
      })}
    </div>

    <div class="hv3-card">
      ${sectionTitle('📊 Månedlig sammenligning')}
      ${renderBarChart(monthlyData.map(m => ({
        label: m.label, value: m.value, subLabel: m.subLabel, partial: m.highlight
      })), {
        id: monthlyChartId, height: 220, maxBarWidth: 56, barRadius: 8,
        colorFn: (d, i) => d.partial ? '#a3d9a5' : '#e67e22',
        partialLast: true
      })}
    </div>
  </div>`;

  attachChartTooltips(dailyChartId, { valueSuffix: ' kr' });
  attachChartTooltips(monthlyChartId, {
    valueSuffix: ' kr',
    customFormat: (d) => `
      <div class="hv3-chart-tooltip-value">${fmtNum(d.v)} kr</div>
      <div class="hv3-chart-tooltip-label">${d.s || d.l}</div>
      ${d.p ? '<div class="hv3-chart-tooltip-sub">⚡ Igangværende</div>' : ''}`
  });
  animateChartEntrance(c);
}

// ═══════════════════════════════════════════
// PAGE: TOPLISTER
// ═══════════════════════════════════════════

window.__hv3SetToplistTab = (tab) => { toplistTab = tab; cdSelectedPerson = null; cdCachedDays = null; kundeCached = null; renderPageToplister(); };
window.__hv3SetToplistPeriod = (p) => { toplistPeriod = p; cdCachedDays = null; kundeCached = null; renderPageToplister(); };
window.__hv3SetToplistSort = (s) => { toplistSort = s; renderPageToplister(); };
window.__hv3SetPersonnelView = (v) => { personnelView = v; renderPageToplister(); };
// Café-dage drilldown handlers
window.__hv3CdSelectPerson = async (clerkId, clerkName) => {
  if (cdSelectedPerson && cdSelectedPerson.clerk_id === clerkId) {
    cdSelectedPerson = null; cdCachedDays = null;
  } else {
    cdSelectedPerson = { clerk_id: clerkId, clerk_name: clerkName };
    cdCachedDays = null; // force re-fetch
  }
  cdSortCol = 'date'; cdSortDir = 'desc';
  renderPageToplister();
};
window.__hv3CdSort = (col) => {
  if (cdSortCol === col) cdSortDir = cdSortDir === 'desc' ? 'asc' : 'desc';
  else { cdSortCol = col; cdSortDir = 'desc'; }
  renderPageToplister();
};

// Kunder tab handlers
window.__hv3KundeSort = (col) => {
  if (kundeSortCol === col) kundeSortDir = kundeSortDir === 'desc' ? 'asc' : 'desc';
  else { kundeSortCol = col; kundeSortDir = 'desc'; }
  renderPageToplister();
};
window.__hv3KundeSearch = (q) => { kundeSearch = q; renderPageToplister(); };
window.__hv3KundeSaldoFilter = (f) => { kundeSaldoFilter = kundeSaldoFilter === f ? 'alle' : f; renderPageToplister(); };
window.__hv3GoToProfile = (userId, userName) => {
  ppSelectedUserId = userId;
  ppSelectedUserName = userName;
  activePage = 'profiles';
  updateSidebarActive();
  renderActivePage();
};

function toplistPeriodRange() {
  const map = { 'I dag': 'idag', 'Uge': 'uge', 'Måned': 'maaned', 'Altid': 'altid' };
  return periodRange(map[toplistPeriod] || 'altid');
}

async function renderPageToplister() {
  const { from, to } = toplistPeriodRange();

  const c = getPageContainer();
  if (!c) return;

  // Tab bar + period
  let headerHtml = `<div class="hv3-flex-between hv3-flex-wrap" style="gap:12px">
    <div class="hv3-tabs">
      <button class="hv3-tab-btn${toplistTab === 'produkter' ? ' active' : ''}" onclick="__hv3SetToplistTab('produkter')"><span class="hv3-tab-btn-icon">🛒</span>Produkter</button>
      <button class="hv3-tab-btn${toplistTab === 'ekspedienter' ? ' active' : ''}" onclick="__hv3SetToplistTab('ekspedienter')"><span class="hv3-tab-btn-icon">🧑‍💼</span>Ekspedienter</button>
      <button class="hv3-tab-btn${toplistTab === 'kunder' ? ' active' : ''}" onclick="__hv3SetToplistTab('kunder')"><span class="hv3-tab-btn-icon">👦</span>Kunder</button>
      <button class="hv3-tab-btn${toplistTab === 'personale' ? ' active' : ''}" onclick="__hv3SetToplistTab('personale')"><span class="hv3-tab-btn-icon">👨‍💼</span>Personale</button>
    </div>
    ${filterPills(['I dag', 'Uge', 'Måned', 'Altid'], toplistPeriod, '__hv3SetToplistPeriod', true)}
  </div>`;

  let contentHtml = '<div class="hv3-loading"><div class="hv3-spinner"></div>Indlæser...</div>';
  c.innerHTML = `<div class="hv3-page">${headerHtml}<div id="hv3-toplist-content">${contentHtml}</div></div>`;

  const contentEl = document.getElementById('hv3-toplist-content');

  if (toplistTab === 'produkter') {
    const ck = _ck('tl-prod', toplistPeriod, includeTestUsers);
    const products = getCached(ck) || await (async () => { const d = await getTopProducts(from, to, 10, includeTestUsers); setCache(ck, d); return d; })();
    const totalRev = products.reduce((s, p) => s + (p.beloeb || p.total_revenue || 0), 0);

    // Normalize field names
    const normalized = products.map(p => ({
      name: p.name || p.product_name || 'Ukendt',
      emoji: p.emoji || '',
      icon_url: p.icon_url || '',
      icon_storage_path: p.icon_storage_path || '',
      sold: p.antal || p.total_qty || 0,
      revenue: p.beloeb || p.total_revenue || 0,
    }));

    const sorted = [...normalized].sort((a, b) => toplistSort === 'Antal' ? b.sold - a.sold : b.revenue - a.revenue);
    const maxVal = sorted[0] ? (toplistSort === 'Antal' ? sorted[0].sold : sorted[0].revenue) : 1;
    const medals = ['🥇', '🥈', '🥉'];

    const donutChartId = 'hv3-prod-donut-' + Date.now();

    contentEl.innerHTML = `
      <div class="hv3-card" style="padding:22px 24px">
        ${sectionTitle(`🔥 ${toplistSort === 'Antal' ? 'Mest solgte (antal)' : 'Størst omsætning'}`,
          filterPills(['Antal', 'Omsætning'], toplistSort, '__hv3SetToplistSort', true))}
        <div class="hv3-ranking" style="margin-top:4px">
          ${sorted.map((p, i) => {
            const val = toplistSort === 'Antal' ? p.sold : p.revenue;
            const sub = toplistSort === 'Antal' ? `${p.revenue} kr` : `${p.sold} stk`;
            const color = BAR_COLORS[i % BAR_COLORS.length];
            return `<div class="hv3-ranking-item">
              <span class="hv3-ranking-medal">${i < 3 ? medals[i] : `<span class="hv3-ranking-number">${i + 1}</span>`}</span>
              <span style="font-size:18px">${productIcon(p.emoji, p.icon_url, 18, p.icon_storage_path)}</span>
              <span class="hv3-ranking-name" style="width:130px">${escHtml(p.name)}</span>
              <div class="hv3-ranking-bar"><div class="hv3-ranking-bar-fill" style="width:${(val / maxVal) * 100}%;background:linear-gradient(90deg,${color},${color}dd)"></div></div>
              <div class="hv3-ranking-value">
                <span class="hv3-ranking-value-main">${toplistSort === 'Antal' ? `${fmtNum(val)} stk` : `${fmtNum(val)} kr`}</span>
                <span class="hv3-ranking-value-sub">· ${sub}</span>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <div class="hv3-grid-2">
        <div class="hv3-card">
          ${sectionTitle('💰 Omsætning pr. produkt')}
          ${renderDonutChart(normalized.map(p => ({ label: p.name, value: p.revenue })), { id: donutChartId })}
        </div>
        <div class="hv3-card">
          ${sectionTitle('📋 Produktdetaljer')}
          <table class="hv3-table" style="font-size:12px">
            <thead><tr>${['Produkt', 'Pris', 'Solgt', 'Omsætning', 'Andel'].map(h => `<th style="padding:8px">${h}</th>`).join('')}</tr></thead>
            <tbody>${[...normalized].sort((a, b) => b.revenue - a.revenue).map(p => `<tr>
              <td style="padding:8px;font-weight:600">${productIcon(p.emoji, p.icon_url, 14, p.icon_storage_path)} ${escHtml(p.name)}</td>
              <td style="padding:8px;color:var(--hv3-text-muted)">${p.sold > 0 ? Math.round(p.revenue / p.sold) : 0} kr</td>
              <td style="padding:8px;font-weight:600">${p.sold}</td>
              <td style="padding:8px;font-weight:700">${fmtKr(p.revenue)}</td>
              <td style="padding:8px;color:var(--hv3-text-muted)">${totalRev > 0 ? Math.round(p.revenue / totalRev * 100) : 0}%</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
      </div>`;
  } else if (toplistTab === 'ekspedienter') {
    const ck = _ck('tl-eksp', toplistPeriod, includeTestUsers);
    let _ec = getCached(ck);
    if (!_ec) {
      const [clerks, empData] = await Promise.all([
        getTopClerks(from, to, 10, includeTestUsers),
        getEmployeeSummary(from, to, 'kunde', includeTestUsers),
      ]);
      _ec = { clerks, empData };
      setCache(ck, _ec);
    }
    const { clerks, empData } = _ec;
    const normalized = clerks.map(cl => ({
      name: cl.name || 'Ukendt',
      sales: cl.antal_salg || 0,
      revenue: cl.beloeb || 0,
    }));

    const donutId = 'hv3-clerk-donut-' + Date.now();

    // Prepare employee table rows with level + saldo
    const empRows = empData.map(d => {
      const level = getLevel(d.total_sales_cumulative, d.total_minutes);
      const saldoClass = d.balance < 0 ? 'hv3-saldo-neg' : d.balance > 0 ? 'hv3-saldo-pos' : 'hv3-saldo-zero';
      return { ...d, level, saldoClass };
    });

    contentEl.innerHTML = `
      <div class="hv3-grid-2">
        <div class="hv3-card" style="padding:22px 24px">
          ${sectionTitle('⭐ Top ekspedienter (salg)')}
          ${renderRankingList(normalized, { valueKey: 'sales', valueLabel: 'salg', subKey: 'revenue', subLabel: 'kr' })}
        </div>
        <div class="hv3-card">
          ${sectionTitle('📊 Salg fordeling')}
          ${renderDonutChart(normalized.map(c => ({ label: c.name, value: c.sales })), { id: donutId })}
        </div>
      </div>

      <div class="hv3-card" style="padding:22px 24px">
        ${sectionTitle('🛒 Ekspedienter')}
        <div style="overflow-x:auto">
          <table class="hv3-table" style="font-size:12px">
            <thead><tr>${['Navn', 'Saldo', 'Tid som eksp.', 'Antal salg', 'Produkter solgt', 'Salg beløb', 'Flango Level'].map(h => `<th style="padding:8px 10px">${h}</th>`).join('')}</tr></thead>
            <tbody>${empRows.map(d => `<tr>
              <td style="padding:8px 10px;font-weight:600">${escHtml(d.clerk_name)}</td>
              <td style="padding:8px 10px" class="${d.saldoClass}">${d.balance != null ? fmtKr(d.balance) : '—'}</td>
              <td style="padding:8px 10px">${fmtMinutes(d.total_minutes)}</td>
              <td style="padding:8px 10px;font-weight:600">${d.total_sales || 0}</td>
              <td style="padding:8px 10px">${d.total_items_sold || 0}</td>
              <td style="padding:8px 10px;font-weight:600">${fmtKr(d.total_revenue || 0)}</td>
              <td style="padding:8px 10px"><span class="hv3-level-badge">${escHtml(d.level)}</span></td>
            </tr>`).join('')}</tbody>
            <tfoot><tr>
              <td style="padding:8px 10px;font-weight:700">Total (${empData.length})</td>
              <td style="padding:8px 10px">—</td>
              <td style="padding:8px 10px">${fmtMinutes(empData.reduce((s, d) => s + (d.total_minutes || 0), 0))}</td>
              <td style="padding:8px 10px;font-weight:700">${empData.reduce((s, d) => s + (d.total_sales || 0), 0)}</td>
              <td style="padding:8px 10px">${empData.reduce((s, d) => s + (d.total_items_sold || 0), 0)}</td>
              <td style="padding:8px 10px;font-weight:700">${fmtKr(empData.reduce((s, d) => s + Number(d.total_revenue || 0), 0))}</td>
              <td style="padding:8px 10px">—</td>
            </tr></tfoot>
          </table>
        </div>
      </div>`;
  } else if (toplistTab === 'personale') {
    // ─── Personale (admin) view — enrich with splits + deposits ───
    const ck = _ck('tl-pers', toplistPeriod, includeTestUsers);
    let enriched = getCached(ck);
    if (!enriched) {
      const data = await getEmployeeSummary(from, to, 'admin', includeTestUsers);
      contentEl.innerHTML = '<div class="hv3-loading"><div class="hv3-spinner"></div>Indlæser personale...</div>';
      enriched = await Promise.all(data.map(async d => {
        const [split, timeSplit, deposits, cafeDays] = await Promise.all([
          getAdminSalesSplit(d.clerk_id, from, to),
          getAdminTimeSplit(d.clerk_id, from, to),
          getAdminDeposits(d.clerk_id, from, to),
          getAdminCafeDays(d.clerk_id, from, to, includeTestUsers),
        ]);
        const totalCafeMinutes = timeSplit.selfMinutes + timeSplit.childMinutes;
        const qualifiedDays = cafeDays.filter(day => day.qualified);
        const bestDay = qualifiedDays.length ? qualifiedDays.reduce((best, day) => day.revenue > best.revenue ? day : best) : null;
        return { ...d, ...split, ...timeSplit, totalCafeMinutes, ...deposits, bestDay, cafeDays };
      }));
      setCache(ck, enriched);
    }

    // ── Café-dage drilldown data ──
    let drilldownHtml = '';
    if (cdSelectedPerson) {
      // Use enriched cafeDays if available, otherwise fetch
      if (!cdCachedDays) {
        const match = enriched.find(d => d.clerk_id === cdSelectedPerson.clerk_id);
        cdCachedDays = match?.cafeDays || await getAdminCafeDays(cdSelectedPerson.clerk_id, from, to, includeTestUsers);
      }
      const allDays = cdCachedDays;
      const personDage = allDays.filter(d => d.qualified);

      if (personDage.length > 0) {
        // Sort
        const sortedDage = [...personDage].sort((a, b) => {
          if (cdSortCol === 'date') return cdSortDir === 'desc' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date);
          if (cdSortCol === 'revenue') return cdSortDir === 'desc' ? b.revenue - a.revenue : a.revenue - b.revenue;
          if (cdSortCol === 'sales') return cdSortDir === 'desc' ? b.sales - a.sales : a.sales - b.sales;
          if (cdSortCol === 'hours') return cdSortDir === 'desc' ? b.hours - a.hours : a.hours - b.hours;
          return 0;
        });

        const bestDay = personDage.reduce((best, d) => d.revenue > best.revenue ? d : best);
        const nonZeroDage = personDage.filter(d => d.revenue > 0);
        const worstDay = nonZeroDage.length ? nonZeroDage.reduce((worst, d) => d.revenue < worst.revenue ? d : worst) : null;
        const avgRevenue = Math.round(personDage.reduce((s, d) => s + d.revenue, 0) / personDage.length);
        const totalHours = personDage.reduce((s, d) => s + d.hours, 0);
        const totalSales = personDage.reduce((s, d) => s + d.sales, 0);
        const totalRevenue = personDage.reduce((s, d) => s + d.revenue, 0);

        // SortHeader helper
        const sortHdr = (col, label) => {
          const isActive = cdSortCol === col;
          const arrow = isActive ? (cdSortDir === 'desc' ? ' ↓' : ' ↑') : '';
          return `<th class="hv3-cd-sort-th${isActive ? ' active' : ''}" onclick="__hv3CdSort('${col}')">${escHtml(label)}${arrow}</th>`;
        };

        // Bar chart data — chronological order
        const chronoDage = [...sortedDage].sort((a, b) => a.date.localeCompare(b.date));
        const chartBarId = 'hv3-cd-chart-' + Date.now();

        drilldownHtml = `
          <!-- Stat cards -->
          <div class="hv3-stats-row" style="margin-top:20px">
            ${statCard('Café-dage', String(personDage.length), { icon: '📅', sub: 'kvalificerede dage' })}
            ${statCard('Gns. omsætning', fmtKr(avgRevenue), { icon: '📊', sub: 'pr. café-dag' })}
            <div class="hv3-stat hv3-cd-stat-best">
              <div class="hv3-stat-top">
                <div>
                  <div class="hv3-stat-label" style="color:#16a34a">BEDSTE DAG</div>
                  <div class="hv3-stat-value" style="color:#15803d">${fmtKr(bestDay.revenue)}</div>
                </div>
                <span class="hv3-stat-icon" style="opacity:0.3">🏆</span>
              </div>
              <div style="font-size:11px;color:#16a34a;margin-top:6px">${escHtml(bestDay.dayLabel)} · ${escHtml(bestDay.dish || '—')}</div>
            </div>
            ${worstDay ? `<div class="hv3-stat hv3-cd-stat-worst">
              <div class="hv3-stat-top">
                <div>
                  <div class="hv3-stat-label" style="color:#dc2626">LAVESTE DAG</div>
                  <div class="hv3-stat-value" style="color:#b91c1c">${fmtKr(worstDay.revenue)}</div>
                </div>
                <span class="hv3-stat-icon" style="opacity:0.3">📉</span>
              </div>
              <div style="font-size:11px;color:#dc2626;margin-top:6px">${escHtml(worstDay.dayLabel)} · ${escHtml(worstDay.dish || '—')}</div>
            </div>` : ''}
          </div>

          <!-- Bar chart -->
          <div class="hv3-card" style="margin-top:16px">
            ${sectionTitle('📈 Omsætning pr. café-dag — ' + escHtml(cdSelectedPerson.clerk_name))}
            ${renderBarChart(chronoDage.map(d => ({
              label: d.dayLabel,
              value: d.revenue,
              subLabel: `${d.sales} salg · ${d.hours}t${d.dish ? ' · 🍽️ ' + d.dish : ''}`,
            })), {
              id: chartBarId, height: 180, maxBarWidth: 28, barRadius: 5,
              xLabelFontSize: 9, xLabelAngle: -30,
              refLine: avgRevenue,
              colorFn: (d) => {
                if (d.value === bestDay.revenue) return '#22c55e';
                if (worstDay && d.value === worstDay.revenue) return '#ef4444';
                return '#e67e22';
              },
            })}
            <div style="text-align:center;font-size:10px;color:var(--hv3-text-light);margin-top:4px">— Gns. ${fmtKr(avgRevenue)} · Grøn = bedste · Rød = laveste</div>
          </div>

          <!-- Sortable table -->
          <div class="hv3-card" style="margin-top:16px">
            ${sectionTitle('📋 Café-dage historik — ' + escHtml(cdSelectedPerson.clerk_name),
              '<span style="font-size:11px;color:var(--hv3-text-light)">Krav: min. 1 time og 20+ salg</span>'
            )}
            <div style="overflow-x:auto">
              <table class="hv3-table hv3-cd-table" style="font-size:13px">
                <thead><tr>
                  ${sortHdr('date', 'Dato')}
                  ${sortHdr('hours', 'Timer')}
                  ${sortHdr('sales', 'Antal salg')}
                  <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;color:var(--hv3-text-light);text-transform:uppercase;letter-spacing:0.5px">Dagens ret</th>
                  ${sortHdr('revenue', 'Omsætning')}
                  <th style="padding:10px 12px;text-align:left;font-size:10px;font-weight:700;color:var(--hv3-text-light);text-transform:uppercase;letter-spacing:0.5px">vs. gns.</th>
                </tr></thead>
                <tbody>${sortedDage.map(d => {
                  const diff = d.revenue - avgRevenue;
                  const isBest = d.revenue === bestDay.revenue;
                  const isWorst = worstDay && d.revenue === worstDay.revenue;
                  const rowClass = isBest ? ' class="hv3-cd-row-best"' : isWorst ? ' class="hv3-cd-row-worst"' : '';
                  return `<tr${rowClass}>
                    <td style="padding:10px 12px;font-weight:600">${escHtml(d.dayLabel)}${isBest ? ' <span style="font-size:12px">🏆</span>' : ''}${isWorst ? ' <span style="font-size:12px">📉</span>' : ''}</td>
                    <td style="padding:10px 12px;color:var(--hv3-text-muted)">${d.hours}t</td>
                    <td style="padding:10px 12px;font-weight:600">${d.sales}</td>
                    <td style="padding:10px 12px;color:var(--hv3-text-muted)">${escHtml(d.dish || '—')}</td>
                    <td style="padding:10px 12px;font-weight:700">${fmtKr(d.revenue)}</td>
                    <td style="padding:10px 12px"><span class="hv3-cd-diff-badge ${diff >= 0 ? 'positive' : 'negative'}">${diff >= 0 ? '+' : ''}${diff} kr</span></td>
                  </tr>`;
                }).join('')}</tbody>
                <tfoot><tr>
                  <td style="padding:12px 12px;font-weight:700;font-size:12px">Total (${personDage.length} dage)</td>
                  <td style="padding:12px 12px;font-weight:600;font-size:12px">${totalHours.toFixed(1)}t</td>
                  <td style="padding:12px 12px;font-weight:600;font-size:12px">${totalSales}</td>
                  <td style="padding:12px 12px"></td>
                  <td style="padding:12px 12px;font-weight:800;font-size:13px">${fmtKr(totalRevenue)}</td>
                  <td style="padding:12px 12px;font-size:11px;color:var(--hv3-text-light)">gns. ${fmtKr(avgRevenue)}</td>
                </tr></tfoot>
              </table>
            </div>
          </div>`;
      } else {
        drilldownHtml = `
          <div style="text-align:center;padding:32px 24px;color:var(--hv3-text-light)">
            <div style="font-size:28px;margin-bottom:8px;opacity:0.3">📊</div>
            <div style="font-size:14px;font-weight:600;color:var(--hv3-text-muted)">Ingen kvalificerede café-dage fundet for ${escHtml(cdSelectedPerson.clerk_name)}</div>
            <div style="font-size:12px;margin-top:4px">Krav: min. 1 time logget ind og 20+ salg</div>
          </div>`;
      }
    } else {
      drilldownHtml = `
        <div style="text-align:center;padding:48px 24px;color:var(--hv3-text-light)">
          <div style="font-size:36px;margin-bottom:12px;opacity:0.3">👆</div>
          <div style="font-size:14px;font-weight:600;color:var(--hv3-text-muted)">Klik på en medarbejder for at se deres café-dage historik</div>
          <div style="font-size:12px;margin-top:4px">Oversigten viser alle dage med min. 1 time logget ind og 20+ salg</div>
        </div>`;
    }

    contentEl.innerHTML = `
      <!-- Niveau 1: Personaleoversigt (altid synlig) -->
      <div class="hv3-card" style="padding:22px 24px">
        ${sectionTitle('👨‍💼 Personale')}
        <div style="overflow-x:auto">
          <table class="hv3-table hv3-cd-personnel-table" style="font-size:12px">
            <thead><tr style="border-bottom:2px solid var(--hv3-card-border)">${['Navn', 'Tid i caféen', 'Selv eksp.', 'Børn eksp.', 'Antal salg', 'Antal prod.', 'Indbetalinger', 'Selv salg', 'Assist. salg', 'Salg i alt', 'Rekord'].map(h => `<th style="padding:8px 8px;text-align:left;font-size:9px;font-weight:700;color:var(--hv3-text-light);text-transform:uppercase;letter-spacing:0.4px;white-space:nowrap">${h}</th>`).join('')}</tr></thead>
            <tbody>${enriched.map(d => {
              const isSelected = cdSelectedPerson && cdSelectedPerson.clerk_id === d.clerk_id;
              return `<tr class="hv3-cd-person-row${isSelected ? ' selected' : ''}" onclick="__hv3CdSelectPerson('${d.clerk_id}', '${escHtml(d.clerk_name).replace(/'/g, "\\'")}')">
              <td style="padding:10px 8px;font-weight:700;white-space:nowrap">
                <span style="color:${isSelected ? 'var(--hv3-accent)' : 'var(--hv3-text)'}">${escHtml(d.clerk_name)}</span>
                ${isSelected ? '<span style="margin-left:6px;font-size:10px">▼</span>' : ''}
              </td>
              <td style="padding:10px 8px;color:var(--hv3-text-muted)">${fmtMinutes(d.totalCafeMinutes)}</td>
              <td style="padding:10px 8px;color:var(--hv3-text-muted)">${fmtMinutes(d.selfMinutes)}</td>
              <td style="padding:10px 8px;color:var(--hv3-text-muted)">${fmtMinutes(d.childMinutes)}</td>
              <td style="padding:10px 8px;font-weight:600">${(d.total_sales || 0).toLocaleString('da-DK')}</td>
              <td style="padding:10px 8px;color:var(--hv3-text-muted)">${(d.total_items_sold || 0).toLocaleString('da-DK')}</td>
              <td style="padding:10px 8px;color:var(--hv3-text-muted)">${d.depositCount || 0} (${fmtKr(d.depositAmount || 0)})</td>
              <td style="padding:10px 8px;color:var(--hv3-text-muted)">${fmtKr(d.selfSales)}</td>
              <td style="padding:10px 8px;color:var(--hv3-text-muted)">${fmtKr(d.assistedSales)}</td>
              <td style="padding:10px 8px;font-weight:800;font-size:13px">${fmtKr(d.total_revenue || 0)}</td>
              <td style="padding:10px 8px;white-space:nowrap">${d.bestDay ? `<span style="font-weight:700;color:#15803d">${fmtKr(d.bestDay.revenue)}</span> <span style="font-size:10px;color:var(--hv3-text-light)">${escHtml(d.bestDay.dayLabel)}</span>` : '<span style="color:var(--hv3-text-light)">—</span>'}</td>
            </tr>`;
            }).join('')}</tbody>
            <tfoot><tr style="background:#faf8f5;border-top:2px solid var(--hv3-card-border)">
              <td style="padding:10px 8px;font-weight:700;font-size:11px">Total (${enriched.length})</td>
              <td style="padding:10px 8px;font-weight:600;font-size:11px">${fmtMinutes(enriched.reduce((s, d) => s + d.totalCafeMinutes, 0))}</td>
              <td style="padding:10px 8px;font-weight:600;font-size:11px">${fmtMinutes(enriched.reduce((s, d) => s + d.selfMinutes, 0))}</td>
              <td style="padding:10px 8px;font-weight:600;font-size:11px">${fmtMinutes(enriched.reduce((s, d) => s + d.childMinutes, 0))}</td>
              <td style="padding:10px 8px;font-weight:700;font-size:11px">${enriched.reduce((s, d) => s + (d.total_sales || 0), 0).toLocaleString('da-DK')}</td>
              <td style="padding:10px 8px;font-weight:600;font-size:11px">${enriched.reduce((s, d) => s + (d.total_items_sold || 0), 0).toLocaleString('da-DK')}</td>
              <td style="padding:10px 8px;font-weight:600;font-size:11px">${enriched.reduce((s, d) => s + (d.depositCount || 0), 0)} (${fmtKr(enriched.reduce((s, d) => s + (d.depositAmount || 0), 0))})</td>
              <td style="padding:10px 8px;font-weight:600;font-size:11px">${fmtKr(enriched.reduce((s, d) => s + d.selfSales, 0))}</td>
              <td style="padding:10px 8px;font-weight:600;font-size:11px">${fmtKr(enriched.reduce((s, d) => s + d.assistedSales, 0))}</td>
              <td style="padding:10px 8px;font-weight:800;font-size:12px">${fmtKr(enriched.reduce((s, d) => s + Number(d.total_revenue || 0), 0))}</td>
              <td style="padding:10px 8px;font-weight:700;font-size:11px">${(() => { const best = enriched.filter(d => d.bestDay).reduce((b, d) => !b || d.bestDay.revenue > b.revenue ? d.bestDay : b, null); return best ? `🏆 ${fmtKr(best.revenue)}` : '—'; })()}</td>
            </tr></tfoot>
          </table>
        </div>
      </div>
      <!-- Niveau 2: Café-dage drilldown -->
      ${drilldownHtml}`;

    // Attach chart tooltips for café-dage bar chart
    if (cdSelectedPerson && cdCachedDays) {
      const chartEl = contentEl.querySelector('[id^="hv3-cd-chart-"]');
      if (chartEl) {
        attachChartTooltips(chartEl.id, {
          valueSuffix: ' kr',
          customFormat: (d) => `
            <div class="hv3-chart-tooltip-value">${fmtNum(d.v)} kr</div>
            <div class="hv3-chart-tooltip-label">${escHtml(d.l || '')}</div>
            ${d.s ? `<div class="hv3-chart-tooltip-sub" style="opacity:0.6;font-size:11px">${escHtml(d.s)}</div>` : ''}`,
        });
      }
    }
  } else {
    // ─── Kunder (full table with search, saldo filter, sorting) ───
    if (!kundeCached) {
      contentEl.innerHTML = '<div class="hv3-loading"><div class="hv3-spinner"></div>Indlæser kunder...</div>';
      kundeCached = await getCustomerStats(from, to, includeTestUsers);
    }
    const allKunder = kundeCached;

    // Filter: search
    let filtered = [...allKunder];
    if (kundeSearch.trim()) {
      const q = kundeSearch.toLowerCase();
      filtered = filtered.filter(k => k.name.toLowerCase().includes(q));
    }
    // Filter: saldo
    if (kundeSaldoFilter === 'negativ') filtered = filtered.filter(k => k.saldo < 0);
    else if (kundeSaldoFilter === 'nul') filtered = filtered.filter(k => k.saldo === 0);
    else if (kundeSaldoFilter === 'positiv') filtered = filtered.filter(k => k.saldo > 0);

    // Sort
    filtered.sort((a, b) => {
      const av = a[kundeSortCol], bv = b[kundeSortCol];
      if (kundeSortCol === 'name' || kundeSortCol === 'favorit') {
        return kundeSortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      }
      return kundeSortDir === 'desc' ? bv - av : av - bv;
    });

    // Aggregated stats
    const totalForbrug = allKunder.reduce((s, k) => s + k.forbrug, 0);
    const totalKoeb = allKunder.reduce((s, k) => s + k.koeb, 0);
    const avgForbrug = allKunder.length ? Math.round(totalForbrug / allKunder.length) : 0;
    const negSaldo = allKunder.filter(k => k.saldo < 0);
    const totalNegSaldo = negSaldo.reduce((s, k) => s + k.saldo, 0);
    const maxForbrug = Math.max(...allKunder.map(k => k.forbrug), 1);

    // SortHeader helper
    const ksHdr = (col, label, align) => {
      const isActive = kundeSortCol === col;
      const arrow = isActive ? (kundeSortDir === 'desc' ? ' ↓' : ' ↑') : '';
      return `<th onclick="__hv3KundeSort('${col}')" style="padding:10px 10px;text-align:${align || 'left'};font-size:9px;font-weight:700;color:${isActive ? 'var(--hv3-accent)' : 'var(--hv3-text-light)'};text-transform:uppercase;letter-spacing:0.4px;cursor:pointer;user-select:none;white-space:nowrap;transition:color 0.15s">${escHtml(label)}${arrow}</th>`;
    };

    // Saldo badge helper
    const saldoBadge = (saldo) => {
      const isNeg = saldo < 0;
      const isZero = saldo === 0;
      const prefix = isNeg ? '' : isZero ? '' : '+';
      return `<span style="font-size:11px;font-weight:700;padding:3px 9px;border-radius:6px;white-space:nowrap;background:${isNeg ? '#fee2e2' : isZero ? '#f3ede5' : '#dcfce7'};color:${isNeg ? '#dc2626' : isZero ? 'var(--hv3-text-muted)' : '#16a34a'}">${prefix}${saldo} kr</span>`;
    };

    // Favorit badge helper
    const favBadge = (product) => {
      if (!product) return '<span style="color:var(--hv3-text-light)">—</span>';
      return `<span style="font-size:11px;font-weight:500;padding:3px 9px;border-radius:6px;background:#f8f4ef;color:var(--hv3-text-muted);white-space:nowrap;display:inline-flex;align-items:center;gap:4px"><span style="font-size:12px">🍽️</span>${escHtml(product)}</span>`;
    };

    // Saldo filter button helper
    const saldoBtn = (id, label, color) => {
      const isActive = kundeSaldoFilter === id;
      let bg, border, clr;
      if (isActive) {
        border = `1.5px solid ${color || 'var(--hv3-accent)'}`;
        bg = color === '#dc2626' ? '#fee2e2' : color === '#16a34a' ? '#dcfce7' : 'var(--hv3-accent-light)';
        clr = color || 'var(--hv3-accent-dark)';
      } else {
        border = '1.5px solid var(--hv3-card-border)';
        bg = 'transparent';
        clr = 'var(--hv3-text-muted)';
      }
      return `<button onclick="__hv3KundeSaldoFilter('${id}')" style="padding:6px 12px;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;transition:all 0.15s;border:${border};background:${bg};color:${clr}">${label}</button>`;
    };

    contentEl.innerHTML = `
      <!-- KPI cards -->
      <div style="display:flex;gap:14px;flex-wrap:wrap">
        ${statCard('Kunder i alt', String(allKunder.length), { icon: '👦', sub: 'aktive konti' })}
        ${statCard('Samlet forbrug', fmtKr(totalForbrug), { icon: '💰', sub: totalKoeb.toLocaleString('da-DK') + ' køb i alt' })}
        ${statCard('Gns. forbrug', fmtKr(avgForbrug), { icon: '📊', sub: 'pr. kunde' })}
        ${negSaldo.length > 0 ? `<div class="hv3-stat" style="background:linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);border:1px solid #fecaca">
          <div class="hv3-stat-top">
            <div>
              <div class="hv3-stat-label" style="color:#dc2626">Negativ saldo</div>
              <div class="hv3-stat-value" style="font-size:24px;color:#b91c1c">${negSaldo.length} børn</div>
            </div>
            <span style="font-size:18px;opacity:0.2">⚠️</span>
          </div>
          <div style="font-size:11px;color:#dc2626;margin-top:6px">I alt ${totalNegSaldo.toLocaleString('da-DK')} kr</div>
        </div>` : statCard('Negativ saldo', '0 børn', { icon: '⚠️', sub: 'Ingen negativ saldo' })}
      </div>

      <!-- Search + filters -->
      <div class="hv3-card" style="padding:16px 20px">
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <div style="position:relative;flex:1;min-width:200px">
            <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:14px;opacity:0.3">🔍</span>
            <input type="text" class="hv3-kunde-search" placeholder="Søg efter barn..." value="${escHtml(kundeSearch)}" oninput="__hv3KundeSearch(this.value)" style="width:100%;padding:9px 12px 9px 36px;border-radius:10px;border:1.5px solid var(--hv3-card-border);font-size:13px;outline:none;background:#faf8f5;box-sizing:border-box;transition:border-color 0.15s" onfocus="this.style.borderColor='var(--hv3-accent)'" onblur="this.style.borderColor='var(--hv3-card-border)'">
          </div>
          <div style="display:flex;gap:4px">
            ${saldoBtn('alle', 'Alle', null)}
            ${saldoBtn('negativ', '⚠️ Negativ', '#dc2626')}
            ${saldoBtn('nul', '0 kr', null)}
            ${saldoBtn('positiv', '✓ Positiv', '#16a34a')}
          </div>
          <span style="font-size:11px;color:var(--hv3-text-light);font-weight:500">${filtered.length} af ${allKunder.length} kunder</span>
        </div>
      </div>

      <!-- Main table -->
      <div class="hv3-card" style="padding:22px 24px">
        ${sectionTitle('👦 Alle kunder')}
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead>
              <tr style="border-bottom:2px solid var(--hv3-card-border)">
                <th style="padding:10px 10px;text-align:left;font-size:9px;font-weight:700;color:var(--hv3-text-light);text-transform:uppercase;letter-spacing:0.4px;width:30px">#</th>
                ${ksHdr('name', 'Navn')}
                <th style="padding:10px 10px;text-align:left;font-size:9px;font-weight:700;color:var(--hv3-text-light);text-transform:uppercase;letter-spacing:0.4px;min-width:120px">Forbrug</th>
                ${ksHdr('forbrug', 'Beløb', 'right')}
                ${ksHdr('koeb', 'Køb', 'right')}
                ${ksHdr('saldo', 'Saldo', 'right')}
                ${ksHdr('favorit', 'Favorit')}
                ${ksHdr('indbetalinger', 'Indbetalt', 'right')}
              </tr>
            </thead>
            <tbody>${filtered.map((k, i) => {
              const barPct = (k.forbrug / maxForbrug) * 100;
              const colorIdx = i % BAR_COLORS.length;
              const isNeg = k.saldo < 0;
              const safeName = (k.name || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
              return `<tr class="hv3-kunde-row${isNeg ? ' hv3-kunde-row-neg' : ''}" style="border-bottom:1px solid var(--hv3-card-border);cursor:pointer" onclick="__hv3GoToProfile('${k.id}','${safeName}')">
                <td style="padding:11px 10px;font-size:12px;text-align:center">${kundeSortCol === 'forbrug' && kundeSortDir === 'desc' && i < 3 ? `<span style="font-size:14px">${['🥇','🥈','🥉'][i]}</span>` : `<span style="font-weight:600;color:var(--hv3-text-light)">${i + 1}</span>`}</td>
                <td style="padding:11px 10px;font-weight:600;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(k.name)}</td>
                <td style="padding:11px 10px"><div style="height:10px;background:#f3ede5;border-radius:99px;overflow:hidden;min-width:80px"><div style="width:${barPct}%;height:100%;border-radius:99px;background:linear-gradient(90deg, ${BAR_COLORS[colorIdx]}, ${BAR_COLORS[colorIdx]}cc);transition:width 0.5s ease"></div></div></td>
                <td style="padding:11px 10px;font-weight:700;text-align:right;white-space:nowrap">${k.forbrug.toLocaleString('da-DK')} kr</td>
                <td style="padding:11px 10px;text-align:right;color:var(--hv3-text-muted)">${k.koeb} køb</td>
                <td style="padding:11px 10px;text-align:right">${saldoBadge(k.saldo)}</td>
                <td style="padding:11px 10px">${favBadge(k.favorit)}</td>
                <td style="padding:11px 10px;text-align:right;white-space:nowrap"><span style="font-weight:600">${k.indbetKr.toLocaleString('da-DK')} kr</span><span style="font-size:10px;color:var(--hv3-text-light);margin-left:4px">(${k.indbetalinger}×)</span></td>
              </tr>`;
            }).join('')}</tbody>
            <tfoot>
              <tr style="background:#faf8f5;border-top:2px solid var(--hv3-card-border)">
                <td style="padding:12px 10px"></td>
                <td style="padding:12px 10px;font-weight:700;font-size:11px">Total (${filtered.length})</td>
                <td style="padding:12px 10px"></td>
                <td style="padding:12px 10px;font-weight:800;font-size:12px;text-align:right">${filtered.reduce((s, k) => s + k.forbrug, 0).toLocaleString('da-DK')} kr</td>
                <td style="padding:12px 10px;font-weight:600;font-size:11px;text-align:right">${filtered.reduce((s, k) => s + k.koeb, 0).toLocaleString('da-DK')} køb</td>
                <td style="padding:12px 10px;font-weight:600;font-size:11px;text-align:right">${filtered.reduce((s, k) => s + k.saldo, 0).toLocaleString('da-DK')} kr</td>
                <td style="padding:12px 10px"></td>
                <td style="padding:12px 10px;font-weight:700;font-size:11px;text-align:right">${filtered.reduce((s, k) => s + k.indbetKr, 0).toLocaleString('da-DK')} kr</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      ${negSaldo.length > 0 ? `<!-- Negativ saldo insight -->
      <div class="hv3-card" style="padding:18px 22px;display:flex;align-items:center;gap:14px;background:linear-gradient(135deg, #1c1812 0%, #2d261c 100%);border:none">
        <div style="width:40px;height:40px;border-radius:10px;flex-shrink:0;background:rgba(220,38,38,0.15);display:flex;align-items:center;justify-content:center;font-size:18px">⚠️</div>
        <div>
          <h4 style="margin:0 0 3px;font-size:13px;font-weight:700;color:#fff">${negSaldo.length} børn har negativ saldo</h4>
          <p style="margin:0;font-size:11px;color:#b8a998;line-height:1.5">Samlet underskud: ${Math.abs(totalNegSaldo).toLocaleString('da-DK')} kr. Overvej at sende påmindelse til forældre via Rapporter → Negativ saldo.</p>
        </div>
      </div>` : ''}`;

    // Restore search focus after innerHTML replacement
    if (kundeSearch) {
      const si = contentEl.querySelector('.hv3-kunde-search');
      if (si) { si.focus(); si.setSelectionRange(si.value.length, si.value.length); }
    }
  }

  animateChartEntrance(contentEl);
}

// ═══════════════════════════════════════════
// PAGE: STATISTIK
// ═══════════════════════════════════════════

window.__hv3SetStatsRange = (r) => { statsRange = r; renderPageStatistik(); };

async function renderPageStatistik() {
  const days = statsRange === '7 dage' ? 7 : statsRange === '30 dage' ? 30 : 90;
  const now = new Date();
  const from = new Date(now); from.setDate(from.getDate() - days + 1); from.setHours(0, 0, 0, 0);
  const to = new Date(now); to.setHours(23, 59, 59, 999);

  const ck = _ck('stats', statsRange, includeTestUsers);
  let _sc = getCached(ck);
  if (!_sc) {
  const [club, deposits, balances, dailyData, saldoDist, revenueByDay] = await Promise.all([
    getClubStats(from, to, includeTestUsers),
    getTotalDeposits(from, to, includeTestUsers),
    getTotalBalances(includeTestUsers),
    getDailyRevenueActive(from, to, includeTestUsers),
    getBalanceDistribution(includeTestUsers),
    getRevenueByDay(from, to, includeTestUsers),
  ]);
  _sc = { club, deposits, balances, dailyData, saldoDist, revenueByDay };
  setCache(ck, _sc);
  }
  const { club, deposits, balances, dailyData, saldoDist, revenueByDay } = _sc;

  const dailyChartId = 'hv3-stats-daily-' + Date.now();
  const weekdayChartId = 'hv3-stats-weekday-' + Date.now();

  // Balance distribution with colors
  const saldoItems = saldoDist.map(s => ({
    label: s.segment,
    value: s.antal,
    color: SALDO_COLORS[s.segment] || '#94a3b8',
  }));

  const negCount = saldoItems.filter(s => s.label === 'Negativ' || s.label === '0 kr').reduce((sum, s) => sum + s.value, 0);

  // Weekday averages from revenueByDay
  const weekdayNames = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];
  const weekdaySums = {};
  const weekdayCounts = {};
  revenueByDay.forEach(d => {
    const date = new Date(d.dato);
    const dow = date.getDay();
    if (!weekdaySums[dow]) { weekdaySums[dow] = 0; weekdayCounts[dow] = 0; }
    weekdaySums[dow] += d.omsaetning;
    weekdayCounts[dow]++;
  });
  const weekdayAvg = [1, 2, 3, 4, 5].map(dow => ({
    label: weekdayNames[dow],
    value: weekdayCounts[dow] ? Math.round(weekdaySums[dow] / weekdayCounts[dow]) : 0,
  }));
  const maxWd = Math.max(...weekdayAvg.map(w => w.value));

  // Last 14 days for bar chart
  const last14 = dailyData.slice(-14);

  const c = getPageContainer();
  if (!c) return;

  c.innerHTML = `<div class="hv3-page">
    ${filterPills(['7 dage', '30 dage', 'Alt'], statsRange, '__hv3SetStatsRange')}

    <div class="hv3-stats-row">
      ${statCard('Total omsætning', fmtKr(club.totalRevenue), { icon: '💰', sub: `${fmtNum(club.saleCount)} transaktioner` })}
      ${statCard('Total indbetalinger', fmtKr(deposits.amount), { icon: '💳', sub: `${deposits.count} indbetalinger` })}
      ${statCard('Saldoer i alt', fmtKr(balances.total), { icon: '🏦', sub: `${balances.count} konti · gns. ${fmtKr(balances.avg)}` })}
    </div>

    <div class="hv3-grid-2">
      <div class="hv3-card">
        ${sectionTitle('📊 Omsætning pr. dag')}
        ${renderBarChart(last14, { id: dailyChartId, height: 240, maxBarWidth: 32, barRadius: 5 })}
        <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:11px;color:var(--hv3-text-light);padding:0 4px">
          <span>Lavest: ${last14.length ? fmtKr(Math.min(...last14.map(d => d.value))) : '—'}</span>
          <span>Højest: ${last14.length ? fmtKr(Math.max(...last14.map(d => d.value))) : '—'}</span>
        </div>
      </div>

      <div class="hv3-card">
        ${sectionTitle('💳 Saldofordeling')}
        ${renderHorizontalBars(saldoItems)}
        ${negCount > 0 ? `<div class="hv3-saldo-warning">⚠️ ${negCount} børn har 0 kr eller negativ saldo</div>` : ''}
      </div>
    </div>

    <div class="hv3-card">
      ${sectionTitle('📅 Gennemsnitlig omsætning pr. ugedag')}
      ${renderBarChart(weekdayAvg, {
        id: weekdayChartId, height: 200, maxBarWidth: 48, highlightMax: true, highlightColor: '#22c55e',
        yTickSuffix: ' kr'
      })}
      <div style="text-align:center;font-size:11px;color:var(--hv3-text-light);margin-top:4px">Bedste ugedag markeret med grøn</div>
    </div>
  </div>`;

  attachChartTooltips(dailyChartId, { valueSuffix: ' kr' });
  attachChartTooltips(weekdayChartId, { valueSuffix: ' kr' });
  animateChartEntrance(c);
}

// ═══════════════════════════════════════════
// PAGE: TRANSAKTIONER
// ═══════════════════════════════════════════

function productIconById(iconMap, productId, size = 16) {
  const info = iconMap?.[productId];
  if (!info) return '';
  return productIcon(info.emoji, info.icon_url, size, info.icon_storage_path);
}

// ═══════════════════════════════════════════
// KØBSPROFILER
// ═══════════════════════════════════════════

/** Count weekdays (Mon-Fri) between two dates, inclusive of both ends. */
function countWeekdays(startDate, endDate) {
  let count = 0;
  const d = new Date(startDate);
  d.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  while (d <= end) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

const PP_CYLINDER_COLORS = [
  { bg: 'linear-gradient(90deg, #00838f 0%, #00bcd4 35%, #4dd0e1 50%, #00bcd4 65%, #00838f 100%)', shadow: '#006064', cap: 'linear-gradient(180deg, #80deea 0%, #26c6da 100%)' },
  { bg: 'linear-gradient(90deg, #1565c0 0%, #2196f3 35%, #64b5f6 50%, #2196f3 65%, #1565c0 100%)', shadow: '#0d47a1', cap: 'linear-gradient(180deg, #90caf9 0%, #42a5f5 100%)' },
  { bg: 'linear-gradient(90deg, #f9a825 0%, #ffc107 35%, #ffeb3b 50%, #ffc107 65%, #f9a825 100%)', shadow: '#f57f17', cap: 'linear-gradient(180deg, #fff59d 0%, #ffca28 100%)' },
  { bg: 'linear-gradient(90deg, #c2185b 0%, #e91e63 35%, #f06292 50%, #e91e63 65%, #c2185b 100%)', shadow: '#880e4f', cap: 'linear-gradient(180deg, #f8bbd9 0%, #ec407a 100%)' },
  { bg: 'linear-gradient(90deg, #6a1b9a 0%, #9c27b0 35%, #ba68c8 50%, #9c27b0 65%, #6a1b9a 100%)', shadow: '#4a148c', cap: 'linear-gradient(180deg, #ce93d8 0%, #ab47bc 100%)' },
  { bg: 'linear-gradient(90deg, #512da8 0%, #673ab7 35%, #9575cd 50%, #673ab7 65%, #512da8 100%)', shadow: '#311b92', cap: 'linear-gradient(180deg, #b39ddb 0%, #7e57c2 100%)' },
  { bg: 'linear-gradient(90deg, #00796b 0%, #009688 35%, #4db6ac 50%, #009688 65%, #00796b 100%)', shadow: '#004d40', cap: 'linear-gradient(180deg, #80cbc4 0%, #26a69a 100%)' },
  { bg: 'linear-gradient(90deg, #0277bd 0%, #03a9f4 35%, #4fc3f7 50%, #03a9f4 65%, #0277bd 100%)', shadow: '#01579b', cap: 'linear-gradient(180deg, #81d4fa 0%, #29b6f6 100%)' },
  { bg: 'linear-gradient(90deg, #ef6c00 0%, #ff9800 35%, #ffb74d 50%, #ff9800 65%, #ef6c00 100%)', shadow: '#e65100', cap: 'linear-gradient(180deg, #ffcc80 0%, #ffa726 100%)' },
  { bg: 'linear-gradient(90deg, #c62828 0%, #f44336 35%, #e57373 50%, #f44336 65%, #c62828 100%)', shadow: '#b71c1c', cap: 'linear-gradient(180deg, #ef9a9a 0%, #ef5350 100%)' },
  { bg: 'linear-gradient(90deg, #546e7a 0%, #78909c 35%, #b0bec5 50%, #78909c 65%, #546e7a 100%)', shadow: '#37474f', cap: 'linear-gradient(180deg, #cfd8dc 0%, #90a4ae 100%)' },
];

window.__hv3PpSelectUser = (userId, userName) => {
  ppSelectedUserId = userId;
  ppSelectedUserName = userName;
  renderPageKoebsprofiler();
};
window.__hv3PpClearUser = () => {
  ppSelectedUserId = null;
  ppSelectedUserName = '';
  renderPageKoebsprofiler();
};
window.__hv3SetPpPeriod = (label) => {
  ppPeriod = label;
  renderPageKoebsprofiler();
};
window.__hv3SetPpSort = (label) => {
  ppSortBy = label;
  renderPageKoebsprofiler();
};

async function renderPageKoebsprofiler() {
  const c = getPageContainer();
  if (!c) return;

  // Init purchase profiles domain module once
  if (!ppInitDone) {
    const instId = getInstitutionId();
    if (instId) initPurchaseProfiles(instId);
    ppInitDone = true;
  }

  // Get all users for picker
  const allUsers = typeof window.__flangoGetAllUsers === 'function' ? window.__flangoGetAllUsers() : [];
  const customers = allUsers
    .filter(u => u && u.role !== 'admin')
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  // Period / sort mapping
  const periodMap = { 'Altid': 'all', '30 dage': '30', '7 dage': '7' };
  const sortMap = { 'Antal': 'antal', 'Beløb': 'kr' };
  const apiPeriod = periodMap[ppPeriod] || 'all';
  const apiSort = sortMap[ppSortBy] || 'antal';

  // Build user picker HTML
  const pickerHtml = ppSelectedUserId
    ? `<div class="hv3-pp-selected-chip">
        <span>👤 ${escHtml(ppSelectedUserName)}</span>
        <button class="hv3-pp-clear-btn" onclick="__hv3PpClearUser()">✕</button>
      </div>`
    : `<div class="hv3-pp-user-picker">
        <input type="text" class="hv3-pp-search" placeholder="🔍 Søg bruger (navn eller nummer)..." id="hv3-pp-search-input" autocomplete="off">
        <div class="hv3-pp-dropdown" id="hv3-pp-dropdown" style="display:none">
          ${customers.map(u => {
            const num = u.number ? ` #${u.number}` : '';
            return `<div class="hv3-pp-dropdown-item" data-id="${u.id}" data-name="${escHtml(u.name || 'Uden navn')}">${escHtml(u.name || 'Uden navn')}${num}</div>`;
          }).join('')}
        </div>
      </div>`;

  // Controls (only when user is selected)
  const controlsHtml = ppSelectedUserId ? `
    <div class="hv3-pp-controls" style="margin-top:16px">
      ${filterPills(['Altid', '30 dage', '7 dage'], ppPeriod, '__hv3SetPpPeriod', true)}
      ${filterPills(['Antal', 'Beløb'], ppSortBy, '__hv3SetPpSort', true)}
    </div>` : '';

  if (!ppSelectedUserId) {
    // Empty state — no user selected
    c.innerHTML = `<div class="hv3-page">
      <div class="hv3-card" style="padding:22px 24px">
        ${sectionTitle('🛍️ Købsprofiler')}
        <p style="font-size:13px;color:var(--hv3-text-muted);margin:4px 0 16px">Vælg en bruger for at se deres mest købte produkter</p>
        ${pickerHtml}
      </div>
      <div class="hv3-pp-empty">
        <div style="font-size:48px;margin-bottom:16px">🛍️</div>
        <div style="font-size:15px;font-weight:600">Vælg en bruger ovenfor</div>
        <div style="font-size:13px;margin-top:4px">for at se købsprofil og mest købte produkter</div>
      </div>
    </div>`;
    wirePpUserPicker(customers);
    return;
  }

  // Show loading while fetching data
  c.innerHTML = `<div class="hv3-page">
    <div class="hv3-card" style="padding:22px 24px">
      ${sectionTitle('🛍️ Købsprofiler')}
      ${pickerHtml}
      ${controlsHtml}
    </div>
    <div class="hv3-loading"><div class="hv3-spinner"></div>Indlæser købsprofil...</div>
  </div>`;

  try {
    // Fetch chart data + all customers' spending for comparison — in parallel
    const periodDateMap = { 'all': 'altid', '30': 'maaned', '7': 'uge' };
    const { from: pFrom, to: pTo } = periodRange(periodDateMap[apiPeriod] || 'altid');

    // "Active customers" = those with ≥1 sale within last 4 weeks (used for avg comparisons)
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const fourWeeksTo = new Date();
    fourWeeksTo.setHours(23, 59, 59, 999);

    // Cache customer spending per period + active customers (4-week window)
    const spendCk = _ck('pp-spend', apiPeriod, includeTestUsers);
    const activeCk = _ck('pp-active', includeTestUsers);
    const chartCk = _ck('pp-chart', ppSelectedUserId, apiPeriod, apiSort);

    let allCustomerSpending = getCached(spendCk);
    let activeCustomers = getCached(activeCk);
    let chartResult = getCached(chartCk);

    // Fetch only what's missing — in parallel
    const fetches = [];
    if (!chartResult) fetches.push(ppGetChartData(ppSelectedUserId, apiPeriod, apiSort).then(r => { chartResult = r; setCache(chartCk, r); }));
    if (!allCustomerSpending) fetches.push(getTopCustomers(pFrom, pTo, 9999, includeTestUsers).then(r => { allCustomerSpending = r; setCache(spendCk, r); }));
    if (!activeCustomers) fetches.push(getTopCustomers(fourWeeksAgo, fourWeeksTo, 9999, includeTestUsers).then(r => { activeCustomers = r; setCache(activeCk, r); }));
    if (fetches.length) await Promise.all(fetches);

    const { total, chartData, error } = chartResult;

    if (error) {
      c.innerHTML = `<div class="hv3-page">
        <div class="hv3-card" style="padding:22px 24px">
          ${sectionTitle('🛍️ Købsprofiler')}
          ${pickerHtml}
          ${controlsHtml}
        </div>
        <div class="hv3-card" style="padding:40px;text-align:center;color:var(--hv3-red)">Fejl: ${escHtml(error)}</div>
      </div>`;
      wirePpUserPicker(customers);
      return;
    }

    // ── Stat card data ──
    // Build set of active customer names (≥1 sale in last 4 weeks) for balance avg
    const activeNames = new Set(activeCustomers.map(ac => ac.name));
    const activeUserBalances = customers.filter(u => activeNames.has(u.name)).map(u => Number(u.balance || 0));
    const activeBalanceSum = activeUserBalances.reduce((s, b) => s + b, 0);
    const activeBalanceCount = activeUserBalances.length || 1;

    // 1) Saldo — compared to avg of active customers only
    const selectedUser = allUsers.find(u => u.id === ppSelectedUserId);
    const userBalance = selectedUser ? Number(selectedUser.balance || 0) : 0;
    const avgBalance = Math.round(activeBalanceSum / activeBalanceCount);
    const balancePct = avgBalance !== 0 ? Math.round(((userBalance - avgBalance) / Math.abs(avgBalance)) * 100) : 0;
    const balancePctAbs = Math.abs(balancePct);

    // 2) Forbrug i alt — this user vs avg of active customers in same period
    // allCustomerSpending already only includes customers with sales in the selected period
    const allSpendingTotal = allCustomerSpending.reduce((s, cs) => s + (cs.forbrugt || 0), 0);
    const customerCount = allCustomerSpending.length || 1;
    const avgSpending = allSpendingTotal / customerCount;
    const spendPct = avgSpending > 0 ? Math.round(((total - avgSpending) / avgSpending) * 100) : 0;
    const spendPctAbs = Math.abs(spendPct);

    // 3) Gennemsnitsforbrug per hverdag (man-fre) siden brugerens oprettelse
    const userCreated = selectedUser?.created_at ? new Date(selectedUser.created_at) : null;
    let rangeStart;
    if (apiPeriod === '7') {
      const d = new Date(); d.setDate(d.getDate() - 7);
      rangeStart = userCreated && userCreated > d ? userCreated : d;
    } else if (apiPeriod === '30') {
      const d = new Date(); d.setDate(d.getDate() - 30);
      rangeStart = userCreated && userCreated > d ? userCreated : d;
    } else {
      rangeStart = userCreated || pFrom;
    }
    const weekdays = countWeekdays(rangeStart, new Date());
    const periodDays = Math.max(1, weekdays);
    const perLabel = 'hverdag';
    const userAvgPerDay = total / periodDays;
    const clubAvgPerDay = avgSpending / periodDays;
    const avgPct = clubAvgPerDay > 0 ? Math.round(((userAvgPerDay - clubAvgPerDay) / clubAvgPerDay) * 100) : 0;
    const avgPctAbs = Math.abs(avgPct);

    // Rank — position among all customers sorted by spending (no new DB calls)
    const spendRank = allCustomerSpending.filter(cs => cs.forbrugt > total).length + 1;

    // Period label for stat card
    const periodLabel = ppPeriod === '7 dage' ? '7 dage' : ppPeriod === '30 dage' ? '30 dage' : 'altid';

    // Build stat cards — comparisons are vs. active customers (≥1 køb inden for 4 uger)
    const activeLabel = `${activeUserBalances.length} aktive`;
    const statsHtml = `<div class="hv3-stats-row">
      ${statCard('Saldo', fmtKr(userBalance), {
        icon: '💰',
        trend: balancePctAbs > 0 ? `${balancePctAbs}% ${balancePct > 0 ? 'over' : 'under'} gns.` : 'som gns.',
        trendUp: balancePct >= 0,
        sub: `Gns. (${activeLabel}): ${fmtKr(avgBalance)}`
      })}
      ${statCard(`Forbrug (${periodLabel})`, fmtKr(total), {
        icon: '🛒',
        trend: spendPctAbs > 0 ? `${spendPctAbs}% ${spendPct > 0 ? 'over' : 'under'} gns.` : 'som gns.',
        trendUp: spendPct >= 0,
        sub: `Gns. (${customerCount} kunder): ${fmtKr(avgSpending)}`,
        rank: `#${spendRank} af ${customerCount}`
      })}
      ${statCard(`Gns. pr. ${perLabel} (${periodLabel})`, fmtKr(userAvgPerDay), {
        icon: '📊',
        trend: avgPctAbs > 0 ? `${avgPctAbs}% ${avgPct > 0 ? 'over' : 'under'} gns.` : 'som gns.',
        trendUp: avgPct >= 0,
        sub: `Gns. (${customerCount} kunder): ${fmtKr(clubAvgPerDay)} / ${perLabel}`
      })}
    </div>`;

    const count = chartData.reduce((s, d) => s + d.antal, 0);

    // Build chart bars HTML
    let chartHtml = '';
    if (chartData.length === 0) {
      chartHtml = `<div class="hv3-pp-empty" style="padding:40px 20px">
        <div style="font-size:36px;margin-bottom:12px">📭</div>
        <div style="font-size:14px;font-weight:600">Ingen købsdata i denne periode</div>
      </div>`;
    } else {
      const minH = 30, maxH = 200;
      chartHtml = `<div class="hv3-pp-chart" id="hv3-pp-chart">
        ${chartData.map((item, i) => {
          const colors = PP_CYLINDER_COLORS[i % PP_CYLINDER_COLORS.length];
          const h = Math.round(minH + (item.normalizedHeight / 100) * (maxH - minH));
          const displayVal = apiSort === 'kr' ? `${fmtKr(item.kr)}` : `${item.antal} stk`;
          // Icon
          let iconHtml = '<span style="font-size:22px;line-height:1">🛒</span>';
          if (item.isDagensRet) iconHtml = '<span style="font-size:22px;line-height:1">🍽️</span>';
          else if (item.isAndreVarer) iconHtml = '<span style="font-size:22px;line-height:1">📦</span>';
          else if (item.icon) {
            if (item.icon.startsWith('http') || item.icon.includes('.webp') || item.icon.includes('.png'))
              iconHtml = `<img src="${item.icon}" style="width:26px;height:26px;object-fit:contain" alt="">`;
            else
              iconHtml = `<span style="font-size:22px;line-height:1">${item.icon}</span>`;
          }

          return `<div class="hv3-pp-bar-wrapper">
            <div class="hv3-pp-bar-value">${displayVal}</div>
            <div class="hv3-pp-bar" data-height="${h}"
                 style="background:${colors.bg};box-shadow:4px 0 0 ${colors.shadow}, 0 8px 20px rgba(0,0,0,0.2)">
              <div class="hv3-pp-bar-cap" style="background:${colors.cap}"></div>
              <div class="hv3-pp-bar-tooltip">
                <div style="font-weight:800;border-bottom:1px solid rgba(255,255,255,0.2);padding-bottom:4px;margin-bottom:4px">${escHtml(item.name)}</div>
                <div style="display:flex;justify-content:space-between;gap:15px"><span>Antal:</span><span style="font-weight:700">${item.antal}</span></div>
                <div style="display:flex;justify-content:space-between;gap:15px"><span>Beløb:</span><span style="font-weight:700">${fmtKr(item.kr)}</span></div>
              </div>
            </div>
            <div class="hv3-pp-bar-icon">${iconHtml}</div>
            <div class="hv3-pp-bar-name" title="${escHtml(item.name)}">${escHtml(item.name)}</div>
          </div>`;
        }).join('')}
      </div>`;
    }

    c.innerHTML = `<div class="hv3-page">
      <div class="hv3-card" style="padding:22px 24px">
        ${sectionTitle('🛍️ Købsprofiler')}
        ${pickerHtml}
        ${controlsHtml}
      </div>

      ${statsHtml}

      <div class="hv3-card" style="padding:0;overflow:hidden">
        ${chartHtml}
      </div>
    </div>`;

    wirePpUserPicker(customers);

    // Animate bars entrance
    const chartEl = document.getElementById('hv3-pp-chart');
    if (chartEl) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          chartEl.querySelectorAll('.hv3-pp-bar').forEach((bar, i) => {
            setTimeout(() => { bar.style.height = bar.dataset.height + 'px'; }, i * 80);
          });
        });
      });
    }
  } catch (err) {
    console.error('renderPageKoebsprofiler', err);
    c.innerHTML = `<div class="hv3-page">
      <div class="hv3-card" style="padding:40px;text-align:center;color:var(--hv3-red)">
        <p style="font-size:16px;font-weight:700">Fejl ved indlæsning</p>
        <p style="font-size:13px;color:var(--hv3-text-muted)">${escHtml(err.message)}</p>
      </div>
    </div>`;
  }
}

function wirePpUserPicker(customers) {
  const input = document.getElementById('hv3-pp-search-input');
  const dropdown = document.getElementById('hv3-pp-dropdown');
  if (!input || !dropdown) return;

  const items = dropdown.querySelectorAll('.hv3-pp-dropdown-item');

  input.addEventListener('focus', () => { dropdown.style.display = 'block'; filterDropdown(''); });
  input.addEventListener('input', () => filterDropdown(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { dropdown.style.display = 'none'; input.blur(); }
    if (e.key === 'Enter') {
      const visible = dropdown.querySelector('.hv3-pp-dropdown-item:not([style*="display: none"])');
      if (visible) visible.click();
    }
  });

  // Click outside closes dropdown
  document.addEventListener('click', function ppOutside(e) {
    if (!e.target.closest('.hv3-pp-user-picker')) {
      dropdown.style.display = 'none';
      document.removeEventListener('click', ppOutside);
    }
  }, true);

  // Item click
  dropdown.addEventListener('click', (e) => {
    const item = e.target.closest('.hv3-pp-dropdown-item');
    if (item) {
      window.__hv3PpSelectUser(item.dataset.id, item.dataset.name);
    }
  });

  function filterDropdown(query) {
    const q = (query || '').toLowerCase().trim();
    items.forEach(el => {
      const text = el.textContent.toLowerCase();
      el.style.display = (!q || text.includes(q)) ? '' : 'none';
    });
    dropdown.style.display = 'block';
  }
}

// ═══════════════════════════════════════════
// TRANSAKTIONER
// ═══════════════════════════════════════════

async function renderPageTransaktioner() {
  const c = getPageContainer();
  if (!c) return;

  // Reset filters on full page render, unless preserving state (period change or external open)
  if (!_pendingTxSearch && !_preserveFilters) {
    txTypeFilter = 'alle';
    txSearch = '';
    txSearchCustomerOnly = false;
    txSearchClerkOnly = false;
  }
  _preserveFilters = false;

  // Compute period
  const { from, to } = periodRange(txPeriod === '7 dage' ? 'uge' : txPeriod === '30 dage' ? 'maaned' : 'altid');

  c.innerHTML = `
  <div class="hv3-tx-toolbar">
    ${filterPills(['7 dage', '30 dage', 'Altid'], txPeriod, '__hv3SetTxPeriod', true)}
    <div style="flex:1"></div>
    <div style="position:relative;" id="hv3-tx-search-wrap">
      <input type="text" class="hv3-tx-search" id="hv3-tx-search" placeholder="Søg barn, ekspedient..." autocomplete="off">
      <div class="hv3-tx-dropdown" id="hv3-tx-dropdown" style="display:none;"></div>
    </div>
    <span class="hv3-tx-count" id="hv3-tx-count">…</span>
  </div>
  <div class="hv3-tx-type-filter" style="margin-bottom:16px">
    ${filterPills(['Alle', '🛒 Køb', '🧑‍🍳 Ekspedient', '💰 Indbetalinger', '✏️ Justeringer', '🎫 Arrangementer'], txActiveFilterLabel(), '__hv3SetTxType', true)}
  </div>
  <div class="hv3-card" style="padding:0;overflow:hidden">
    <div id="hv3-tx-table-wrap"><div class="hv3-loading"><div class="hv3-spinner"></div>Indlæser transaktioner...</div></div>
  </div>`;

  // Wire search with dropdown
  const searchEl = document.getElementById('hv3-tx-search');
  const dropdown = document.getElementById('hv3-tx-dropdown');
  if (searchEl && dropdown) {
    // Build user list for dropdown
    const allUsers = (typeof window.__flangoGetAllUsers === 'function' ? window.__flangoGetAllUsers() : []) || [];
    const customers = allUsers.filter(u => u.role === 'kunde').sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    dropdown.innerHTML = customers.map(u =>
      `<div class="hv3-tx-dropdown-item" data-name="${escHtml(u.name || '')}" data-id="${u.id}">${escHtml(u.name || '')} <span style="opacity:0.5;">#${u.number || ''}</span></div>`
    ).join('');

    searchEl.value = txSearch;

    const showDropdown = () => {
      filterDropdownItems(searchEl.value);
      dropdown.style.display = 'block';
    };

    const hideDropdown = () => {
      setTimeout(() => { dropdown.style.display = 'none'; }, 150);
    };

    function filterDropdownItems(query) {
      const q = (query || '').toLowerCase().trim();
      dropdown.querySelectorAll('.hv3-tx-dropdown-item').forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = (!q || text.includes(q)) ? '' : 'none';
      });
    }

    searchEl.onfocus = showDropdown;
    searchEl.onblur = hideDropdown;
    searchEl.oninput = () => {
      txSearch = searchEl.value.toLowerCase().trim();
      filterDropdownItems(searchEl.value);
      dropdown.style.display = 'block';
      renderTxRows();
    };

    // Click on dropdown item → select user
    dropdown.addEventListener('click', (e) => {
      const item = e.target.closest('.hv3-tx-dropdown-item');
      if (!item) return;
      const name = item.dataset.name;
      searchEl.value = name;
      txSearch = name.toLowerCase().trim();
      dropdown.style.display = 'none';
      renderTxRows();
    });
  }


  // Wire type filter via window handler
  window.__hv3SetTxType = (label) => {
    const typeMap = { 'Alle': 'alle', '💰 Indbetalinger': 'DEPOSIT', '✏️ Justeringer': 'SALE_ADJUSTMENT', '🎫 Arrangementer': 'EVENT' };

    // Reset all role filters
    txSearchCustomerOnly = false;
    txSearchClerkOnly = false;
    txTypeFilter = 'alle';

    if (label === '🛒 Køb') {
      txSearchCustomerOnly = true;
    } else if (label === '🧑‍🍳 Ekspedient') {
      txSearchClerkOnly = true;
    } else {
      txTypeFilter = typeMap[label] || 'alle';
    }

    // Update pill active states (only one active at a time)
    const filterWrap = c.querySelector('.hv3-tx-type-filter .hv3-pills');
    if (filterWrap) {
      filterWrap.querySelectorAll('.hv3-pill').forEach(p => {
        p.classList.toggle('active', p.textContent.trim() === label);
      });
    }
    renderTxRows();
  };

  // Period handler
  window.__hv3SetTxPeriod = (p) => {
    txPeriod = p;
    _preserveFilters = true;
    renderPageTransaktioner();
  };

  // Load data (cached per period)
  try {
    const ck = _ck('tx', txPeriod, includeTestUsers);
    let _tc = getCached(ck);
    if (!_tc) {
      const [txData, iconMap] = await Promise.all([
        getTransactions(from, to, includeTestUsers),
        getProductsIconMap(),
      ]);
      _tc = { txData, iconMap };
      setCache(ck, _tc);
    }
    allTransactions = _tc.txData;
    _txIconMap = _tc.iconMap;

    // Apply pending search from openHistorikV3ForUser
    if (_pendingTxSearch) {
      txSearch = _pendingTxSearch.toLowerCase().trim();
      const searchEl = document.getElementById('hv3-tx-search');
      if (searchEl) searchEl.value = _pendingTxSearch;
      _pendingTxSearch = null;
    }

    renderTxRows();
  } catch (err) {
    console.error('renderPageTransaktioner', err);
    document.getElementById('hv3-tx-table-wrap').innerHTML = '<div style="padding:40px;text-align:center;color:var(--hv3-red)">Fejl ved indlæsning af transaktioner.</div>';
  }
}

function txActiveFilterLabel() {
  if (txSearchCustomerOnly) return '🛒 Køb';
  if (txSearchClerkOnly) return '🧑‍🍳 Ekspedient';
  const map = { alle: 'Alle', DEPOSIT: '💰 Indbetalinger', SALE_ADJUSTMENT: '✏️ Justeringer', EVENT: '🎫 Arrangementer' };
  return map[txTypeFilter] || 'Alle';
}

function renderTxRows() {
  const wrap = document.getElementById('hv3-tx-table-wrap');
  if (!wrap) return;

  let filtered = allTransactions;
  if (txTypeFilter !== 'alle') {
    if (txTypeFilter === 'EVENT') {
      filtered = filtered.filter(e => e.event_type === 'EVENT_PAYMENT' || e.event_type === 'EVENT_REFUND');
    } else {
      filtered = filtered.filter(e => e.event_type === txTypeFilter);
    }
  }
  if (txSearch) {
    filtered = filtered.filter(e => {
      if (txSearchCustomerOnly) {
        return (e.target?.name || '').toLowerCase().includes(txSearch);
      }
      if (txSearchClerkOnly) {
        return (e.clerk?.name || '').toLowerCase().includes(txSearch);
      }
      const text = [e.target?.name, e.clerk?.name, e.admin?.name, e.session_admin_name].filter(Boolean).join(' ').toLowerCase();
      return text.includes(txSearch);
    });
  }
  // Role filters: restrict to relevant transaction types
  if (txSearchCustomerOnly) {
    filtered = filtered.filter(e => e.event_type === 'SALE' || e.event_type === 'SALE_UNDO');
  }
  if (txSearchClerkOnly) {
    filtered = filtered.filter(e => e.clerk?.name);
  }

  const countEl = document.getElementById('hv3-tx-count');
  if (countEl) countEl.textContent = `${filtered.length} hændelser`;

  const typeTag = (type) => {
    switch (type) {
      case 'SALE': return '<span class="hv3-tx-tag hv3-tx-tag-green">Salg</span>';
      case 'DEPOSIT': return '<span class="hv3-tx-tag hv3-tx-tag-blue">Indbetaling</span>';
      case 'SALE_ADJUSTMENT': return '<span class="hv3-tx-tag hv3-tx-tag-orange">Justering</span>';
      case 'SALE_UNDO': return '<span class="hv3-tx-tag hv3-tx-tag-red">Fortrudt</span>';
      case 'BALANCE_EDIT': return '<span class="hv3-tx-tag hv3-tx-tag-purple">Saldo</span>';
      case 'EVENT_PAYMENT': return '<span class="hv3-tx-tag hv3-tx-tag-teal">🎫 Arrangement</span>';
      case 'EVENT_REFUND': return '<span class="hv3-tx-tag hv3-tx-tag-teal">🎫 Refund</span>';
      default: return `<span class="hv3-tx-tag hv3-tx-tag-gray">${escHtml(type)}</span>`;
    }
  };

  const rowClass = (type) => {
    switch (type) {
      case 'SALE': return 'hv3-tx-row-sale';
      case 'DEPOSIT': return 'hv3-tx-row-deposit';
      case 'SALE_ADJUSTMENT': return 'hv3-tx-row-adjustment';
      case 'SALE_UNDO': return 'hv3-tx-row-undo';
      case 'BALANCE_EDIT': return 'hv3-tx-row-balance';
      case 'EVENT_PAYMENT': return 'hv3-tx-row-event';
      case 'EVENT_REFUND': return 'hv3-tx-row-event';
      default: return '';
    }
  };

  const amountDisplay = (e) => {
    const d = e.details || {};
    switch (e.event_type) {
      case 'SALE': {
        const amt = d.total_amount || 0;
        if (amt === 0) return `<span style="color:var(--hv3-text-muted)">0 kr</span>`;
        return `<strong>${fmtKr(amt)}</strong>`;
      }
      case 'DEPOSIT': return `<strong style="color:#2563eb">+${fmtKr(d.amount)}</strong>`;
      case 'SALE_ADJUSTMENT': {
        const adj = d.adjustment_amount || 0;
        const sign = adj > 0 ? '+' : adj < 0 ? '−' : '';
        const color = adj < 0 ? 'var(--hv3-red, #ef4444)' : 'var(--hv3-green)';
        return `<strong style="color:${color}">${sign}${fmtKr(Math.abs(adj))}</strong>`;
      }
      case 'SALE_UNDO': return `<strong>${fmtKr(d.refunded_amount || 0)}</strong>`;
      case 'BALANCE_EDIT': {
        const diff = (d.new_balance || 0) - (d.old_balance || 0);
        const sign = diff > 0 ? '+' : diff < 0 ? '−' : '';
        const color = diff < 0 ? 'var(--hv3-red, #ef4444)' : '#2563eb';
        return `<strong style="color:${color}">${sign}${fmtKr(Math.abs(diff))}</strong>`;
      }
      case 'EVENT_PAYMENT': return `<strong>${fmtKr(d.amount || 0)}</strong>`;
      case 'EVENT_REFUND': return `<strong style="color:var(--hv3-green)">+${fmtKr(d.amount || 0)}</strong>`;
      default: return '—';
    }
  };

  const productsDisplay = (e) => {
    if (e.event_type !== 'SALE') {
      if (e.event_type === 'BALANCE_EDIT') {
        const d = e.details || {};
        return `<span style="font-size:12px;color:var(--hv3-text-muted)">${fmtKr(d.old_balance)} → ${fmtKr(d.new_balance)}</span>`;
      }
      if (e.event_type === 'SALE_ADJUSTMENT') {
        return `<span style="font-size:12px;color:var(--hv3-text-muted)">Justering</span>`;
      }
      if (e.event_type === 'EVENT_PAYMENT' || e.event_type === 'EVENT_REFUND') {
        const title = e.details?.event_title || 'Ukendt arrangement';
        const note = e.event_type === 'EVENT_REFUND' && e.details?.note ? ` (${e.details.note})` : '';
        return `<span style="font-size:12px;color:var(--hv3-text-muted)">🎫 ${escHtml(title)}${escHtml(note)}</span>`;
      }
      return '<span style="color:var(--hv3-text-light)">—</span>';
    }
    const items = e.details?.items || [];
    if (!items.length) return '<span style="color:var(--hv3-text-light)">×0</span>';
    return items.map(i => {
      const icon = productIconById(_txIconMap, i.product_id, 16);
      const qty = i.quantity || 1;
      return `<span class="hv3-tx-product">${icon || ''}<span class="hv3-tx-product-name">${escHtml(i.product_name || '')}</span><span class="hv3-tx-product-qty">×${qty}</span></span>`;
    }).join(' ');
  };

  const clerkDisplay = (e) => {
    if (e.clerk) {
      const badge = e.clerk.role === 'kunde' ? ' <span style="font-size:10px;color:var(--hv3-green)">(barn)</span>' : '';
      return escHtml(e.clerk.name) + badge;
    }
    return escHtml(e.admin?.name || '—');
  };

  wrap.innerHTML = `<div style="overflow-x:auto"><table class="hv3-table hv3-tx-table">
    <thead><tr><th>Tid</th><th>Type</th><th>Kunde</th><th>Produkter</th><th>Beløb</th><th>Ekspedient</th><th>Ansvarlig</th><th></th></tr></thead>
    <tbody>${filtered.map(e => `
      <tr class="${rowClass(e.event_type)} hv3-tx-row" data-id="${e.id}">
        <td>${fmtDateTime(e.created_at)}</td>
        <td>${typeTag(e.event_type)}</td>
        <td>${escHtml(e.target?.name || '—')}</td>
        <td>${productsDisplay(e)}</td>
        <td>${amountDisplay(e)}</td>
        <td>${clerkDisplay(e)}</td>
        <td>${escHtml(e.session_admin_name || e.admin?.name || '—')}</td>
        <td style="text-align:right">${e.event_type === 'SALE' ? '<button class="hv3-tx-expand-btn">⋯</button>' : ''}</td>
      </tr>
      ${e.event_type === 'SALE' ? `<tr class="hv3-tx-expand-row" id="hv3-tx-expand-${e.id}"><td colspan="8" class="hv3-tx-expand-cell"><div style="padding:16px 20px;color:var(--hv3-text-muted);font-size:13px">Indlæser detaljer...</div></td></tr>` : ''}
    `).join('')}</tbody>
  </table></div>`;

  // Row click → expand
  wrap.querySelectorAll('.hv3-tx-row').forEach(row => {
    row.style.cursor = 'pointer';
    row.onclick = (ev) => {
      if (ev.target.closest('button') && !ev.target.classList.contains('hv3-tx-expand-btn')) return;
      const id = row.dataset.id;
      const expandRow = document.getElementById(`hv3-tx-expand-${id}`);
      if (expandRow) {
        const isOpen = expandRow.classList.toggle('open');
        if (isOpen) loadTxExpandDetails(id, expandRow);
      }
    };
  });
}

async function loadTxExpandDetails(eventId, expandRow) {
  const event = allTransactions.find(e => e.id === eventId);
  if (!event) return;
  const saleId = event.details?.sale_id;
  if (!saleId) {
    expandRow.querySelector('td').innerHTML = '<div style="padding:20px;color:var(--hv3-text-muted);font-style:italic">Ingen detaljer tilgængelige.</div>';
    return;
  }
  try {
    const items = await getSaleItems(saleId);
    const customerId = event.target_user_id || event.details?.customer_id;
    const customerName = event.target?.name || 'Kunden';
    const originalTotal = Number(event.details?.total_amount || 0);

    expandRow.querySelector('td').innerHTML = `
    <div class="hv3-tx-adjust-panel">
      <!-- Left: Receipt -->
      <div class="hv3-tx-adjust-details">
        <div class="hv3-tx-adjust-section-title">Kvittering</div>
        <div class="hv3-tx-adjust-items">
          ${items.map(i => `<div class="hv3-tx-adjust-item">
            <span class="hv3-tx-adjust-item-name">${productIcon(i.emoji, i.icon_url, 18, i.icon_storage_path)} ${escHtml(i.name)}</span>
            <span class="hv3-tx-adjust-item-qty">×${i.quantity}</span>
            <span class="hv3-tx-adjust-item-price">${fmtKr(i.quantity * i.price_at_purchase)}</span>
          </div>`).join('')}
          <div class="hv3-tx-adjust-item hv3-tx-adjust-total-line">
            <span class="hv3-tx-adjust-item-name"><strong>Total</strong></span>
            <span></span>
            <span class="hv3-tx-adjust-item-price"><strong>${fmtKr(originalTotal)}</strong></span>
          </div>
        </div>
        <div class="hv3-tx-adjust-meta">
          <span>Ekspedient: <strong>${escHtml(event.clerk?.name || event.admin?.name || '—')}</strong>${event.clerk?.role === 'kunde' ? ' (barn)' : ''}</span>
          <span>Ansvarlig: <strong>${escHtml(event.session_admin_name || event.admin?.name || '—')}</strong></span>
        </div>
      </div>

      <!-- Right: Adjustment controls -->
      <div class="hv3-tx-adjust-controls">
        <div class="hv3-tx-adjust-section-title">Justér salg</div>

        <div class="hv3-tx-adjust-qty-section">
          ${items.map((i, idx) => `<div class="hv3-tx-adjust-qty-row" data-idx="${idx}">
            <span class="hv3-tx-adjust-qty-name">${productIcon(i.emoji, i.icon_url, 18, i.icon_storage_path)} ${escHtml(i.name)}</span>
            <div class="hv3-tx-adjust-qty-controls">
              <button class="hv3-tx-qty-btn hv3-tx-qty-minus" data-idx="${idx}">−</button>
              <span class="hv3-tx-qty-diff" data-idx="${idx}">0</span>
              <button class="hv3-tx-qty-btn hv3-tx-qty-plus" data-idx="${idx}">+</button>
            </div>
            <span class="hv3-tx-adjust-qty-delta" data-idx="${idx}">0 kr</span>
          </div>`).join('')}
        </div>

        <div class="hv3-tx-adjust-manual">
          <span class="hv3-tx-adjust-manual-label">Manuel korrektion</span>
          <div class="hv3-tx-adjust-qty-controls">
            <button class="hv3-tx-qty-btn hv3-tx-manual-minus">−1</button>
            <span class="hv3-tx-manual-display">0 kr</span>
            <button class="hv3-tx-qty-btn hv3-tx-manual-plus">+1</button>
          </div>
        </div>

        <div class="hv3-tx-adjust-summary">
          <div class="hv3-tx-adjust-summary-row">
            <span>Varekorrektion</span>
            <span class="hv3-tx-items-delta">0 kr</span>
          </div>
          <div class="hv3-tx-adjust-summary-row">
            <span>Manuel</span>
            <span class="hv3-tx-manual-delta">0 kr</span>
          </div>
          <div class="hv3-tx-adjust-summary-row hv3-tx-adjust-summary-total">
            <span>Total justering</span>
            <span class="hv3-tx-total-delta">0 kr</span>
          </div>
        </div>

        <div class="hv3-tx-adjust-actions">
          <button class="hv3-tx-adjust-save" disabled>Gem justering</button>
          <button class="hv3-tx-adjust-undo">Fortryd hele salget</button>
        </div>
      </div>
    </div>`;

    wireTxAdjustmentPanel(expandRow, items, { saleId, customerId, customerName, originalTotal, eventId });

  } catch (err) {
    console.error('loadTxExpandDetails', err);
    expandRow.querySelector('td').innerHTML = '<div style="padding:20px;color:var(--hv3-red);font-style:italic">Fejl ved indlæsning af detaljer.</div>';
  }
}

function wireTxAdjustmentPanel(expandRow, items, ctx) {
  const panel = expandRow.querySelector('.hv3-tx-adjust-panel');
  if (!panel) return;

  const corrections = items.map(i => ({ diffQty: 0, unitPrice: Number(i.price_at_purchase) || 0, name: i.name }));
  let manualAdj = 0;

  function recalc() {
    let itemsDelta = 0;
    corrections.forEach((c, idx) => {
      const d = c.diffQty * c.unitPrice;
      itemsDelta += d;
      const diffEl = panel.querySelector(`.hv3-tx-qty-diff[data-idx="${idx}"]`);
      const deltaEl = panel.querySelector(`.hv3-tx-adjust-qty-delta[data-idx="${idx}"]`);
      if (diffEl) diffEl.textContent = c.diffQty > 0 ? `+${c.diffQty}` : String(c.diffQty);
      if (deltaEl) {
        const kr = d === 0 ? '0 kr' : `${d > 0 ? '+' : ''}${fmtKr(d)}`;
        deltaEl.textContent = kr;
        deltaEl.style.color = d < 0 ? 'var(--hv3-green)' : d > 0 ? 'var(--hv3-red)' : '';
      }
    });
    const total = itemsDelta + manualAdj;
    panel.querySelector('.hv3-tx-items-delta').textContent = itemsDelta === 0 ? '0 kr' : `${itemsDelta > 0 ? '+' : ''}${fmtKr(itemsDelta)}`;
    panel.querySelector('.hv3-tx-manual-delta').textContent = manualAdj === 0 ? '0 kr' : `${manualAdj > 0 ? '+' : ''}${fmtKr(manualAdj)}`;
    const totalEl = panel.querySelector('.hv3-tx-total-delta');
    totalEl.textContent = total === 0 ? '0 kr' : `${total > 0 ? '+' : ''}${fmtKr(total)}`;
    totalEl.style.color = total < 0 ? 'var(--hv3-green)' : total > 0 ? 'var(--hv3-red)' : '';
    panel.querySelector('.hv3-tx-adjust-save').disabled = (total === 0);
  }

  // Qty +/- buttons
  panel.querySelectorAll('.hv3-tx-qty-minus').forEach(btn => {
    btn.onclick = (e) => { e.stopPropagation(); corrections[btn.dataset.idx].diffQty--; recalc(); };
  });
  panel.querySelectorAll('.hv3-tx-qty-plus').forEach(btn => {
    btn.onclick = (e) => { e.stopPropagation(); corrections[btn.dataset.idx].diffQty++; recalc(); };
  });

  // Manual +/- buttons
  panel.querySelector('.hv3-tx-manual-minus').onclick = (e) => {
    e.stopPropagation();
    manualAdj -= 1;
    panel.querySelector('.hv3-tx-manual-display').textContent = `${manualAdj} kr`;
    recalc();
  };
  panel.querySelector('.hv3-tx-manual-plus').onclick = (e) => {
    e.stopPropagation();
    manualAdj += 1;
    panel.querySelector('.hv3-tx-manual-display').textContent = `${manualAdj} kr`;
    recalc();
  };

  // Save adjustment
  panel.querySelector('.hv3-tx-adjust-save').onclick = async (e) => {
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
      invalidateAllCaches();
      invalidateTodaysSalesCache();
      if (typeof window.__flangoRefreshSugarPolicy === 'function') {
        try { await window.__flangoRefreshSugarPolicy(); } catch (_) {}
      }
      showCustomAlert('Justering gemt', `${ctx.customerName} ${delta < 0 ? `har fået ${fmtKr(Math.abs(delta))} retur.` : `er trukket ${fmtKr(delta)} ekstra.`}`);
      renderPageTransaktioner();
    } catch (err) {
      console.error('registerSaleAdjustment', err);
      showCustomAlert('Fejl', 'Kunne ikke gemme justering: ' + (err.message || err));
    }
  };

  // Undo entire sale
  panel.querySelector('.hv3-tx-adjust-undo').onclick = async (e) => {
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
      invalidateAllCaches();
      invalidateTodaysSalesCache();
      if (typeof window.__flangoRefreshSugarPolicy === 'function') {
        try { await window.__flangoRefreshSugarPolicy(); } catch (_) {}
      }
      showCustomAlert('Salg fortrudt', `${ctx.customerName} har fået ${fmtKr(refunded || ctx.originalTotal)} retur.`);
      renderPageTransaktioner();
    } catch (err) {
      console.error('undoSale', err);
      showCustomAlert('Fejl', 'Kunne ikke fortryde salget: ' + (err.message || err));
    }
  };
}

// ═══════════════════════════════════════════
// PAGE: TIDSBESPARELSE
// ═══════════════════════════════════════════

async function renderPageTidsbesparelse() {
  const firstDate = await getFirstSaleDate();
  const from = firstDate || new Date('2020-01-01');
  const to = new Date(); to.setHours(23, 59, 59, 999);

  const [club, deposits, topClerks, monthlyRev] = await Promise.all([
    getClubStats(from, to, includeTestUsers),
    getTotalDeposits(from, to, includeTestUsers),
    getTopClerks(from, to, 6, includeTestUsers),
    getMonthlyRevenue(from, to, includeTestUsers),
  ]);

  const totalTransactions = club.saleCount;
  const totalDepositsCount = deposits.count;
  const totalActions = totalTransactions + totalDepositsCount;
  const secsPerAction = 30;
  const totalMinsSaved = Math.round((totalActions * secsPerAction) / 60);
  const totalHoursSaved = (totalMinsSaved / 60).toFixed(1);
  const hourlyWage = 220;
  const moneySaved = Math.round((totalMinsSaved / 60) * hourlyWage);

  // Child sales estimated time
  const childSales = topClerks.reduce((s, cl) => s + (cl.antal_salg || 0), 0);
  const childMinsSaved = Math.round((childSales * secsPerAction) / 60);

  const txMinsSaved = Math.round((totalTransactions * secsPerAction) / 60);
  const depMinsSaved = Math.round((totalDepositsCount * secsPerAction) / 60);

  // Monthly breakdown
  const monthlyBars = monthlyRev.map(m => {
    // Estimate actions proportionally
    const share = club.totalRevenue > 0 ? m.value / club.totalRevenue : 0;
    const est = Math.round(totalActions * share);
    return { label: m.label, value: Math.round((est * 30) / 60), actions: est, partial: m.highlight };
  });

  const monthlyChartId = 'hv3-ts-monthly-' + Date.now();

  function fmtTimeDanish(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m} min`;
    return `${h}t ${m}m`;
  }

  const topChildren = topClerks.map(cl => ({
    name: cl.name || 'Ukendt',
    sales: cl.antal_salg || 0,
    timeSaved: fmtTimeDanish(Math.round((cl.antal_salg || 0) * 30 / 60)),
  }));
  const maxChildSales = topChildren[0]?.sales || 1;
  const medals = ['🥇', '🥈', '🥉'];

  const c = getPageContainer();
  if (!c) return;

  c.innerHTML = `<div class="hv3-page">
    <!-- Hero banner -->
    <div class="hv3-hero">
      <div class="hv3-hero-circle" style="top:-40px;right:-40px;width:180px;height:180px;opacity:0.06"></div>
      <div class="hv3-hero-circle" style="bottom:-30px;left:40%;width:120px;height:120px;opacity:0.04"></div>
      <div class="hv3-hero-content">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <span style="font-size:28px">⏱️</span>
          <span class="hv3-hero-label">Tid sparet med Flango</span>
        </div>
        <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:6px">
          <span class="hv3-hero-value" id="hv3-hero-number" data-target="${totalMinsSaved}">0</span>
          <span class="hv3-hero-unit">minutter</span>
        </div>
        <p class="hv3-hero-desc">
          Det svarer til <span style="color:#fff;font-weight:700">${totalHoursSaved} timer</span> som
          jeres personale ikke har brugt på manuelle transaktioner og indbetalinger.
        </p>
        <div class="hv3-hero-ministats">
          ${[
            { label: 'Transaktioner', value: totalTransactions, icon: '🧾' },
            { label: 'Indbetalinger', value: totalDepositsCount, icon: '💳' },
            { label: 'Handlinger i alt', value: totalActions, icon: '⚡' },
          ].map(s => `
            <div class="hv3-hero-ministat">
              <div class="hv3-hero-ministat-label">${s.icon} ${s.label}</div>
              <div class="hv3-hero-ministat-value">${fmtNum(s.value)}</div>
              <div class="hv3-hero-ministat-sub">× 30 sek = ${fmtTimeDanish(Math.round(s.value * 30 / 60))}</div>
            </div>`).join('')}
        </div>
      </div>
    </div>

    <!-- Breakdown cards -->
    <div class="hv3-grid-3">
      <div class="hv3-breakdown-card" style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:1px solid #bbf7d0">
        <div class="hv3-breakdown-label" style="color:#16a34a">👦 Børns ekspedienttid</div>
        <div class="hv3-breakdown-value" style="color:#15803d">${fmtTimeDanish(childMinsSaved)}</div>
        <p class="hv3-breakdown-desc" style="color:#16a34a">${fmtNum(childSales)} salg håndteret af børn — direkte tid sparet for personalet</p>
      </div>
      <div class="hv3-breakdown-card" style="background:linear-gradient(135deg,#eff6ff,#dbeafe);border:1px solid #bfdbfe">
        <div class="hv3-breakdown-label" style="color:#2563eb">🧾 Automatiserede salg</div>
        <div class="hv3-breakdown-value" style="color:#1d4ed8">${fmtTimeDanish(txMinsSaved)}</div>
        <p class="hv3-breakdown-desc" style="color:#2563eb">${fmtNum(totalTransactions)} transaktioner × 30 sek</p>
      </div>
      <div class="hv3-breakdown-card" style="background:linear-gradient(135deg,#fef3e2,#fde8c8);border:1px solid #fed7aa">
        <div class="hv3-breakdown-label" style="color:var(--hv3-accent-dark)">💳 Digitale indbetalinger</div>
        <div class="hv3-breakdown-value" style="color:#c2410c">${fmtTimeDanish(depMinsSaved)}</div>
        <p class="hv3-breakdown-desc" style="color:var(--hv3-accent-dark)">${fmtNum(totalDepositsCount)} indbetalinger × 30 sek</p>
      </div>
    </div>

    <!-- Monthly + Leaderboard -->
    <div class="hv3-grid-2">
      <div class="hv3-card" style="padding:22px 24px">
        ${sectionTitle('📅 Tid sparet pr. måned')}
        ${renderBarChart(monthlyBars, {
          id: monthlyChartId, height: 250, maxBarWidth: 52, barRadius: 8, yTickSuffix: ' min',
          colorFn: (d, i) => d.partial ? '#a3d9a5' : '#e67e22',
          partialLast: true
        })}
        <div style="text-align:center;font-size:11px;color:var(--hv3-text-light);margin-top:4px">
          Seneste måned er igangværende (delvis)
        </div>
      </div>

      <div class="hv3-card" style="padding:22px 24px">
        ${sectionTitle('🏆 Børn der har sparet mest tid')}
        <div style="font-size:12px;color:var(--hv3-text-muted);margin-top:-8px;margin-bottom:16px">
          Hvert salg af et barn = 30 sek sparet for en voksen
        </div>
        <div class="hv3-ranking">
          ${topChildren.map((child, i) => `
            <div class="hv3-ranking-item">
              <span class="hv3-ranking-medal">${i < 3 ? medals[i] : `<span class="hv3-ranking-number">${i + 1}</span>`}</span>
              <span class="hv3-ranking-name" style="width:150px">${escHtml(child.name)}</span>
              <div class="hv3-ranking-bar" style="height:10px">
                <div class="hv3-ranking-bar-fill" style="width:${(child.sales / maxChildSales) * 100}%;background:linear-gradient(90deg,#22c55e,#16a34a)"></div>
              </div>
              <div class="hv3-ranking-value" style="min-width:100px">
                <span style="font-size:12px;font-weight:700;color:#16a34a">${child.timeSaved}</span>
                <span style="font-size:10px;color:var(--hv3-text-light);margin-left:4px">(${child.sales} salg)</span>
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div>

    <!-- Economic value -->
    <div class="hv3-econ-card">
      <div class="hv3-econ-inner">
        <div class="hv3-econ-icon">💰</div>
        <div style="flex:1">
          <div style="font-size:12px;font-weight:600;color:var(--hv3-accent-dark);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">
            Estimeret økonomisk værdi
          </div>
          <div style="font-size:32px;font-weight:800;color:var(--hv3-text);letter-spacing:-1px">${fmtNum(moneySaved)} kr</div>
          <p style="margin:6px 0 0;font-size:13px;color:var(--hv3-text-muted);line-height:1.5">
            Baseret på ${totalHoursSaved} timers besparelse × ${hourlyWage} kr/time (gns. pædagog-timeløn).
            Det er tid personalet i stedet har brugt på pædagogisk arbejde med børnene.
          </p>
        </div>
        <div class="hv3-econ-permonth">
          <div style="font-size:11px;color:var(--hv3-text-muted);margin-bottom:4px">Pr. måned</div>
          <div style="font-size:22px;font-weight:800;color:var(--hv3-accent)">
            ~${fmtNum(monthlyRev.length ? Math.round(moneySaved / monthlyRev.length) : moneySaved)} kr
          </div>
        </div>
      </div>
    </div>

    <!-- Methodology -->
    <div class="hv3-method-note">
      <span style="font-size:16px;flex-shrink:0;margin-top:1px">ℹ️</span>
      <div class="hv3-method-note-text">
        <strong style="color:var(--hv3-text)">Beregningsgrundlag:</strong> Hver transaktion og indbetaling estimeres til 30 sekunders manuelt arbejde
        (find barn, tjek saldo, registrer køb, find vekselpenge, osv.). Børns ekspedienttid tæller direkte som
        personaletid sparet, da børnene selvstændigt håndterer salget via Flango. Økonomisk værdi er beregnet
        ud fra en gennemsnitlig pædagog-timeløn på ${hourlyWage} kr/time.
      </div>
    </div>
  </div>`;

  attachChartTooltips(monthlyChartId, {
    valueSuffix: ' min',
    customFormat: (d) => `
      <div class="hv3-chart-tooltip-value">${fmtNum(d.v)} min</div>
      <div class="hv3-chart-tooltip-label">${d.l}</div>
      ${d.p ? '<div class="hv3-chart-tooltip-sub">⚡ Igangværende</div>' : ''}`
  });

  // Animated number (cubic ease-out over 1200ms)
  const heroEl = document.getElementById('hv3-hero-number');
  if (heroEl) {
    const target = parseInt(heroEl.dataset.target) || 0;
    const duration = 1200;
    const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      heroEl.textContent = Math.round(eased * target).toLocaleString('da-DK');
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  animateChartEntrance(c);
}

// ═══════════════════════════════════════════
// PAGE: AFSTEMNING (Placeholder)
// ═══════════════════════════════════════════

window.__hv3SetAfstemningTab = (tab) => { afstemningTab = tab; renderPageAfstemning(); };

function renderPageAfstemning() {
  const c = getPageContainer();
  if (!c) return;

  // Placeholder MobilePay data
  const mpTransactions = [
    { date: '03/03', ref: 'MP-88291', mpAmount: 150, flangoAmount: 150, status: 'match' },
    { date: '03/03', ref: 'MP-88292', mpAmount: 75, flangoAmount: 75, status: 'match' },
    { date: '03/03', ref: 'MP-88293', mpAmount: 200, flangoAmount: 200, status: 'match' },
    { date: '02/03', ref: 'MP-88156', mpAmount: 100, flangoAmount: 100, status: 'match' },
    { date: '02/03', ref: 'MP-88157', mpAmount: 50, flangoAmount: 0, status: 'missing_flango' },
    { date: '01/03', ref: 'MP-88034', mpAmount: 0, flangoAmount: 80, status: 'missing_mp' },
    { date: '28/02', ref: 'MP-87912', mpAmount: 90, flangoAmount: 95, status: 'diff' },
  ];

  const statusConfig = {
    match: { label: 'Match', color: '#16a34a', bg: '#dcfce7', icon: '✓' },
    diff: { label: 'Difference', color: '#f59e0b', bg: '#fef3c7', icon: '⚠' },
    missing_flango: { label: 'Mangler i Flango', color: '#dc2626', bg: '#fee2e2', icon: '✕' },
    missing_mp: { label: 'Mangler i MobilePay', color: '#7c3aed', bg: '#ede9fe', icon: '?' },
  };

  const matched = mpTransactions.filter(t => t.status === 'match').length;
  const diffs = mpTransactions.filter(t => t.status === 'diff').length;
  const missingFlango = mpTransactions.filter(t => t.status === 'missing_flango').length;
  const missingMp = mpTransactions.filter(t => t.status === 'missing_mp').length;
  const totalMp = mpTransactions.reduce((s, t) => s + t.mpAmount, 0);
  const totalFlango = mpTransactions.reduce((s, t) => s + t.flangoAmount, 0);
  const difference = totalMp - totalFlango;

  // Avance placeholder
  const periodRevenue = 5540;
  const expenses = [
    { desc: 'Nemlig.com - uge 9', amount: 847, type: 'kvittering', date: '28/02' },
    { desc: 'Rema 1000 - frugt & snacks', amount: 312, type: 'kvittering', date: '01/03' },
    { desc: 'Emballage & servietter', amount: 145, type: 'estimat', date: '03/03' },
  ];
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const profit = periodRevenue - totalExpenses;
  const marginPct = Math.round((profit / periodRevenue) * 100);

  c.innerHTML = `<div class="hv3-page">
    <div class="hv3-coming-soon">
      🚧 Denne side er under udvikling. Data nedenfor er eksempeldata til forhåndsvisning.
    </div>

    <div class="hv3-tabs">
      <button class="hv3-tab-btn${afstemningTab === 'mobilepay' ? ' active' : ''}" onclick="__hv3SetAfstemningTab('mobilepay')"><span class="hv3-tab-btn-icon">📱</span>MobilePay Afstemning</button>
      <button class="hv3-tab-btn${afstemningTab === 'avance' ? ' active' : ''}" onclick="__hv3SetAfstemningTab('avance')"><span class="hv3-tab-btn-icon">🧮</span>Avance & Udgifter</button>
    </div>

    ${afstemningTab === 'mobilepay' ? `
      <!-- Upload zone -->
      <div class="hv3-upload-zone">
        <div style="width:64px;height:64px;border-radius:16px;margin:0 auto 16px;background:linear-gradient(135deg,#eff6ff,#dbeafe);display:flex;align-items:center;justify-content:center;font-size:28px">📱</div>
        <h3 style="margin:0 0 6px;font-size:17px;font-weight:700;color:var(--hv3-text)">Upload MobilePay CSV</h3>
        <p style="margin:0 0 16px;font-size:13px;color:var(--hv3-text-muted)">Træk filen hertil, eller klik for at vælge. Eksportér fra MobilePay Portalen → Transaktioner → Download CSV.</p>
        <div style="display:inline-flex;padding:10px 24px;border-radius:10px;background:var(--hv3-accent);color:#fff;font-weight:700;font-size:13px">Vælg fil</div>
      </div>

      <!-- Summary stats -->
      <div style="display:flex;gap:14px;flex-wrap:wrap">
        ${[
          { label: 'Matchet', value: matched, bg: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', borderColor: '#bbf7d020', color: '#16a34a' },
          { label: 'Differencer', value: diffs, bg: 'linear-gradient(135deg,#fffbeb,#fef3c7)', borderColor: '#fef3c720', color: '#f59e0b' },
          { label: 'Mangler i Flango', value: missingFlango, bg: 'linear-gradient(135deg,#fef2f2,#fee2e2)', borderColor: '#fee2e220', color: '#dc2626' },
          { label: 'Mangler i MobilePay', value: missingMp, bg: 'linear-gradient(135deg,#f5f3ff,#ede9fe)', borderColor: '#ede9fe20', color: '#7c3aed' },
        ].map(s => `
          <div class="hv3-card" style="flex:1;min-width:140px;padding:18px 20px;background:${s.bg};border:1px solid ${s.borderColor}">
            <div style="font-size:28px;font-weight:800;color:${s.color}">${s.value}</div>
            <div style="font-size:11px;font-weight:600;color:${s.color};opacity:0.7;margin-top:2px">${s.label}</div>
          </div>
        `).join('')}
      </div>

      <!-- Total comparison bars -->
      <div class="hv3-card" style="padding:20px 24px">
        ${sectionTitle('💰 Totalsammenligning')}
        <div style="display:flex;gap:24px;align-items:center;margin-top:4px">
          <div style="flex:1">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span style="font-size:12px;font-weight:600;color:#3b82f6">📱 MobilePay</span>
              <span style="font-size:14px;font-weight:800;color:var(--hv3-text)">${fmtNum(totalMp)} kr</span>
            </div>
            <div style="height:12px;background:#f3ede5;border-radius:99px;overflow:hidden;margin-bottom:14px">
              <div style="width:${(totalMp / Math.max(totalMp, totalFlango)) * 100}%;height:100%;background:linear-gradient(90deg,#3b82f6,#60a5fa);border-radius:99px"></div>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <span style="font-size:12px;font-weight:600;color:var(--hv3-accent)">🍽️ Flango</span>
              <span style="font-size:14px;font-weight:800;color:var(--hv3-text)">${fmtNum(totalFlango)} kr</span>
            </div>
            <div style="height:12px;background:#f3ede5;border-radius:99px;overflow:hidden">
              <div style="width:${(totalFlango / Math.max(totalMp, totalFlango)) * 100}%;height:100%;background:linear-gradient(90deg,var(--hv3-accent),var(--hv3-accent-dark));border-radius:99px"></div>
            </div>
          </div>
          <div style="text-align:center;padding:16px 24px;border-radius:14px;flex-shrink:0;background:${difference === 0 ? '#dcfce7' : Math.abs(difference) < 10 ? '#fef3c7' : '#fee2e2'}">
            <div style="font-size:10px;font-weight:600;color:var(--hv3-text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Difference</div>
            <div style="font-size:24px;font-weight:800;color:${difference === 0 ? '#16a34a' : Math.abs(difference) < 10 ? '#f59e0b' : '#dc2626'}">
              ${difference === 0 ? '0' : (difference > 0 ? '+' : '') + difference} kr
            </div>
          </div>
        </div>
      </div>

      <!-- Transaction table -->
      <div class="hv3-card" style="padding:20px 24px">
        ${sectionTitle('📋 Transaktionsdetaljer', `<span style="font-size:11px;color:var(--hv3-text-light)">${mpTransactions.length} transaktioner</span>`)}
        <div style="overflow-x:auto">
          <table class="hv3-table" style="font-size:13px">
            <thead><tr>${['Dato', 'Reference', 'MobilePay', 'Flango', 'Diff.', 'Status'].map(h => `<th style="padding:10px 10px">${h}</th>`).join('')}</tr></thead>
            <tbody>
              ${mpTransactions.map(t => {
                const sc = statusConfig[t.status];
                const diff = t.mpAmount - t.flangoAmount;
                return `<tr style="background:${t.status !== 'match' ? sc.bg + '40' : 'transparent'}">
                  <td style="padding:10px 10px;color:var(--hv3-text-muted)">${t.date}</td>
                  <td style="padding:10px 10px;font-weight:500;font-family:monospace;font-size:12px">${t.ref}</td>
                  <td style="padding:10px 10px;font-weight:600">${t.mpAmount > 0 ? fmtKr(t.mpAmount) : '—'}</td>
                  <td style="padding:10px 10px;font-weight:600">${t.flangoAmount > 0 ? fmtKr(t.flangoAmount) : '—'}</td>
                  <td style="padding:10px 10px;font-weight:700;color:${diff === 0 ? 'var(--hv3-text-light)' : diff > 0 ? '#dc2626' : '#7c3aed'}">${diff === 0 ? '—' : `${diff > 0 ? '+' : ''}${diff} kr`}</td>
                  <td style="padding:10px 10px"><span class="hv3-status-tag" style="background:${sc.bg};color:${sc.color}">${sc.icon} ${sc.label}</span></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : `
      <!-- AVANCE TAB -->
      <div style="display:grid;grid-template-columns:1fr 2fr;gap:16px">
        <div class="hv3-card" style="padding:24px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center">
          ${renderGauge(marginPct)}
          <div style="font-size:12px;color:var(--hv3-text-muted)">Februar 2026</div>
        </div>

        <div class="hv3-card" style="padding:24px">
          ${sectionTitle('📊 Omsætning vs. Udgifter')}
          <div style="display:flex;flex-direction:column;gap:20px;margin-top:8px">
            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                <span style="font-size:13px;font-weight:600;color:#16a34a">💰 Omsætning (Flango)</span>
                <span style="font-size:16px;font-weight:800;color:#16a34a">${fmtNum(periodRevenue)} kr</span>
              </div>
              <div style="height:16px;background:var(--hv3-pill-bg);border-radius:99px;overflow:hidden">
                <div style="width:100%;height:100%;background:linear-gradient(90deg,#22c55e,#4ade80);border-radius:99px"></div>
              </div>
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                <span style="font-size:13px;font-weight:600;color:#dc2626">🛒 Udgifter (indkøb)</span>
                <span style="font-size:16px;font-weight:800;color:#dc2626">${fmtNum(totalExpenses)} kr</span>
              </div>
              <div style="height:16px;background:var(--hv3-pill-bg);border-radius:99px;overflow:hidden">
                <div style="width:${(totalExpenses / periodRevenue) * 100}%;height:100%;background:linear-gradient(90deg,#ef4444,#f87171);border-radius:99px"></div>
              </div>
            </div>
            <div style="padding:14px 18px;border-radius:12px;background:${profit > 0 ? 'linear-gradient(135deg,#f0fdf4,#dcfce7)' : 'linear-gradient(135deg,#fef2f2,#fee2e2)'};display:flex;justify-content:space-between;align-items:center">
              <div>
                <div style="font-size:11px;font-weight:700;color:${profit > 0 ? '#16a34a' : '#dc2626'};text-transform:uppercase;letter-spacing:0.5px">${profit > 0 ? 'Overskud' : 'Underskud'}</div>
                <div style="font-size:11px;color:var(--hv3-text-muted);margin-top:2px">Avance: ${marginPct}% af omsætningen</div>
              </div>
              <div style="font-size:28px;font-weight:800;color:${profit > 0 ? '#16a34a' : '#dc2626'}">${profit > 0 ? '+' : ''}${fmtNum(profit)} kr</div>
            </div>
          </div>
        </div>
      </div>

      <div class="hv3-card" style="padding:22px 24px">
        ${sectionTitle('🧾 Udgifter', `<button style="padding:7px 16px;border-radius:8px;border:none;background:var(--hv3-accent);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:var(--hv3-font);transition:all 0.15s">+ Tilføj udgift</button>`)}

        <!-- Add expense form (default: Kvittering mode shown) -->
        <div style="padding:18px 20px;margin-bottom:16px;border-radius:12px;background:linear-gradient(135deg,#faf8f5,#f5f0ea);border:1px solid var(--hv3-card-border)">
          <div style="display:flex;gap:12px;margin-bottom:14px">
            ${filterPills(['Kvittering', 'Estimat'], 'Kvittering', '__hv3SetAfstemningTab', true)}
          </div>
          <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
            <div style="flex:2;min-width:200px;padding:20px;border-radius:10px;border:1.5px dashed var(--hv3-card-border);background:#fff;text-align:center;cursor:pointer">
              <span style="font-size:18px">📎</span>
              <div style="font-size:12px;color:var(--hv3-text-muted);margin-top:4px">Upload kvittering (CSV, PDF, billede)</div>
              <div style="font-size:10px;color:var(--hv3-text-light);margin-top:2px">Nemlig.com, Rema 1000, Coop, etc.</div>
            </div>
            <button style="padding:10px 20px;border-radius:8px;border:none;background:var(--hv3-accent);color:#fff;font-size:12px;font-weight:700;cursor:pointer;font-family:var(--hv3-font);flex-shrink:0">Tilføj</button>
          </div>
        </div>

        <table class="hv3-table" style="font-size:13px">
          <thead><tr>${['Dato', 'Beskrivelse', 'Type', 'Beløb', ''].map(h => `<th style="padding:10px 10px">${h}</th>`).join('')}</tr></thead>
          <tbody>${expenses.map(e => `<tr>
            <td style="padding:10px 10px;color:var(--hv3-text-muted)">${e.date}</td>
            <td style="padding:10px 10px;font-weight:600">${escHtml(e.desc)}</td>
            <td style="padding:10px 10px"><span class="hv3-status-tag" style="background:${e.type === 'kvittering' ? '#eff6ff' : '#fef3c7'};color:${e.type === 'kvittering' ? '#3b82f6' : '#f59e0b'}">${e.type === 'kvittering' ? '📎 Kvittering' : '✏️ Estimat'}</span></td>
            <td style="padding:10px 10px;font-weight:700">${fmtNum(e.amount)} kr</td>
            <td style="padding:10px 10px;text-align:right"><button style="padding:4px 10px;border-radius:6px;border:1px solid var(--hv3-card-border);background:transparent;color:var(--hv3-text-light);font-size:11px;cursor:pointer;font-family:var(--hv3-font)">Slet</button></td>
          </tr>`).join('')}</tbody>
          <tfoot><tr style="background:#faf8f5">
            <td colspan="3" style="padding:12px 10px;font-weight:700;font-size:12px">Total udgifter</td>
            <td style="padding:12px 10px;font-weight:800;font-size:14px">${fmtNum(totalExpenses)} kr</td>
            <td></td>
          </tr></tfoot>
        </table>
      </div>

      <div style="padding:18px 22px;display:flex;align-items:center;gap:14px;background:linear-gradient(135deg,#1c1812,#2d261c);border-radius:var(--hv3-radius);border:none">
        <div style="width:40px;height:40px;border-radius:10px;flex-shrink:0;background:rgba(230,126,34,0.15);display:flex;align-items:center;justify-content:center;font-size:18px">💡</div>
        <div>
          <h4 style="margin:0 0 3px;font-size:13px;font-weight:700;color:#fff">Sådan beregnes avancen</h4>
          <p style="margin:0;font-size:11px;color:#b8a998;line-height:1.5">
            Omsætning hentes automatisk fra Flango. Tilføj udgifter via kvitteringer (CSV/billede) eller som manuelle estimater.
            Brug kvitteringer fra Nemlig.com, Rema 1000 eller andre leverandører for den mest præcise beregning.
          </p>
        </div>
      </div>
    `}
  </div>`;

  animateChartEntrance(c);
}

// ═══════════════════════════════════════════
// PAGE: RAPPORTER
// ═══════════════════════════════════════════

window.__hv3SetReportPeriod = (p) => { reportPeriod = p; renderPageRapporter(); };

async function renderPageRapporter() {
  // Compute from/to based on reportPeriod
  const now = new Date();
  if (reportPeriod === 'Denne uge') {
    const { from, to } = periodRange('uge');
    reportFrom = from; reportTo = to;
  } else if (reportPeriod === 'Denne måned') {
    const { from, to } = periodRange('maaned');
    reportFrom = from; reportTo = to;
  } else {
    const firstDate = await getFirstSaleDate();
    reportFrom = firstDate || new Date('2020-01-01');
    reportTo = new Date(); reportTo.setHours(23, 59, 59, 999);
  }

  const reports = [
    { id: 'salg', icon: '📄', color: '#e67e22', bg: 'linear-gradient(135deg, #fef3e2 0%, #fde8c8 100%)',
      title: 'Salgsrapport', desc: 'Komplet rapport med opsummering, transaktioner og produktoversigt.', format: '.txt', size: '~12 KB' },
    { id: 'saldo', icon: '📊', color: '#3b82f6', bg: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
      title: 'Komplet saldoliste', desc: 'Alle brugere med navn, nummer og aktuel saldo. Sorteret alfabetisk.', format: '.csv', size: '~8 KB' },
    { id: 'negativ', icon: '🔴', color: '#dc2626', bg: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
      title: 'Negativ saldo', desc: 'Brugere med negativ saldo. Til opfølgning med forældre.', format: '.csv', size: '~3 KB' },
    { id: 'csv', icon: '📋', color: '#16a34a', bg: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
      title: 'Transaktions-CSV', desc: 'Alle transaktioner som CSV. Åbnes i Excel eller Google Sheets.', format: '.csv', size: '~45 KB' },
    { id: 'eksped', icon: '👥', color: '#8b5cf6', bg: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
      title: 'Ekspedient-rapport', desc: 'Alle ekspedienter med salgstal, tid og Flango Level.', format: '.txt', size: '~6 KB' },
    { id: 'periode', icon: '📅', color: '#06b6d4', bg: 'linear-gradient(135deg, #ecfeff 0%, #cffafe 100%)',
      title: 'Periodeoversigt', desc: 'Dag-for-dag opsummering med omsætning og bestsellere.', format: '.txt', size: '~18 KB' },
  ];

  const c = getPageContainer();
  if (!c) return;

  const fromStr = fmtDate(reportFrom).split('-').reverse().join('.');
  const toStr = fmtDate(reportTo).split('-').reverse().join('.');

  c.innerHTML = `<div class="hv3-page" style="gap:24px">
    <!-- Period selector -->
    <div class="hv3-card" style="padding:18px 22px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
      <span style="font-size:13px;font-weight:600;color:var(--hv3-text-muted)">Periode:</span>
      <div class="hv3-period-selector">
        <span class="hv3-period-date">${fromStr}</span>
        <span class="hv3-period-sep">til</span>
        <span class="hv3-period-date">${toStr}</span>
      </div>
      ${filterPills(['Denne uge', 'Denne måned', 'Alt'], reportPeriod, '__hv3SetReportPeriod', true)}
    </div>

    <!-- Report cards grid -->
    <div class="hv3-grid-3">
      ${reports.map(r => `
        <div class="hv3-report-card" id="hv3-report-${r.id}" style="background:${r.bg}" onclick="__hv3DownloadReport('${r.id}')">
          <div class="hv3-report-card-circle" style="background:${r.color}"></div>
          <div class="hv3-report-icon-box" style="box-shadow:0 2px 8px ${r.color}15;border:1px solid ${r.color}15">${r.icon}</div>
          <h4 class="hv3-report-title">${r.title}</h4>
          <p class="hv3-report-desc">${r.desc}</p>
          <div class="hv3-report-footer">
            <div class="hv3-report-tags">
              <span class="hv3-report-tag" style="background:#fff;color:${r.color};border:1px solid ${r.color}20">${r.format}</span>
              <span class="hv3-report-tag" style="background:rgba(255,255,255,0.6);color:var(--hv3-text-light)">${r.size}</span>
            </div>
            <div class="hv3-report-dl-btn" id="hv3-dl-${r.id}">↓</div>
          </div>
        </div>
      `).join('')}
    </div>

    <!-- Tip -->
    <div class="hv3-tip-card">
      <div class="hv3-tip-icon">💡</div>
      <div>
        <h4 class="hv3-tip-title">Tip: Automatiske rapporter</h4>
        <p class="hv3-tip-text">
          Sæt op ugentlige eller månedlige rapporter der automatisk sendes til SFO-lederen via email. Kontakt Flango support for at aktivere.
        </p>
      </div>
    </div>
  </div>`;

  // Hover effects (per JSX: border color, box-shadow, download button color)
  c.querySelectorAll('.hv3-report-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
      const id = card.id.replace('hv3-report-', '');
      const r = reports.find(rr => rr.id === id);
      if (r) {
        card.style.borderColor = r.color + '60';
        card.style.boxShadow = `0 8px 30px ${r.color}18, 0 2px 8px rgba(0,0,0,0.04)`;
        const btn = document.getElementById('hv3-dl-' + id);
        if (btn && !btn.classList.contains('done')) {
          btn.style.background = r.color; btn.style.color = '#fff'; btn.style.border = 'none';
          btn.style.boxShadow = `0 2px 8px ${r.color}30`;
        }
      }
    });
    card.addEventListener('mouseleave', () => {
      card.style.borderColor = 'transparent';
      card.style.boxShadow = '0 1px 4px rgba(0,0,0,0.03)';
      const id = card.id.replace('hv3-report-', '');
      const btn = document.getElementById('hv3-dl-' + id);
      if (btn && !btn.classList.contains('done')) {
        btn.style.background = '#fff'; btn.style.color = ''; btn.style.border = `1px solid var(--hv3-card-border)`;
        btn.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)';
      }
    });
  });
}

// Download report handler
window.__hv3DownloadReport = async (id) => {
  const from = reportFrom;
  const to = reportTo;
  const btn = document.getElementById('hv3-dl-' + id);

  try {
    switch (id) {
      case 'salg': await exportSalesReport(from, to, includeTestUsers); break;
      case 'saldo': await exportAllBalances(includeTestUsers); break;
      case 'negativ': await exportNegativeBalances(includeTestUsers); break;
      case 'csv': await exportTransactionsCsv(from, to, includeTestUsers); break;
      case 'eksped': await exportClerkReport(from, to, includeTestUsers); break;
      case 'periode': await exportPeriodReport(from, to, includeTestUsers); break;
    }
    // Visual feedback
    if (btn) {
      btn.classList.add('done');
      btn.textContent = '✓';
      btn.style.background = 'var(--hv3-green)';
      btn.style.color = '#fff';
      btn.style.border = 'none';
      setTimeout(() => {
        btn.classList.remove('done');
        btn.textContent = '↓';
        btn.style.background = '#fff';
        btn.style.color = '';
        btn.style.border = `1px solid var(--hv3-card-border)`;
      }, 2000);
    }
  } catch (err) {
    console.error('Report download failed:', err);
  }
};
