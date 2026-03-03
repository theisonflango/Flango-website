// Ansvar: Historik v3 — modal lifecycle, sidebar, page routing, alle 7 page-render funktioner.
// Genbruger data-laget fra historik-data.js og eksport fra historik-export.js.
import { getCurrentAdmin } from '../domain/session-store.js';
import {
  periodRange, fmtDate, fmtDateTime, fmtMinutes, fmtKr, fmtDayDate, getLevel,
  getMyRevenue, getMyTransactionCount, getMyTransactionSplit, getClubStats, getTotalDeposits,
  getMyMinutesWorked, getTotalBalances, getTopProducts, getDailyClerks,
  getWeekRevenue, getHourlyRevenue, getDailyRevenue, getDailyRevenueActive, getMonthlyRevenue,
  getTopClerks, getTopCustomers,
  getRevenueByDay, getBalanceDistribution, getProductsIconMap,
  getFirstSaleDate,
} from '../domain/historik-data.js';
import { exportSalesReport, exportAllBalances, exportNegativeBalances, exportTransactionsCsv, exportClerkReport, exportPeriodReport } from './historik-export.js';
import {
  renderAreaChart, renderBarChart, renderHorizontalBars, renderDonutChart,
  renderGauge, attachChartTooltips, progressBar, renderRankingList,
  animateChartEntrance,
  BAR_COLORS, escHtml, fmtNum,
} from './historik-v3-charts.js';

// ─── CONSTANTS ───
const ICON_PREFIX = '::icon::';
function productIcon(emoji, iconUrl, size = 18) {
  if (emoji && emoji.startsWith(ICON_PREFIX)) {
    const url = emoji.slice(ICON_PREFIX.length);
    return `<img src="${url}" style="width:${size}px;height:${size}px;vertical-align:middle;border-radius:3px;margin-right:2px" alt="">`;
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
  { id: 'today', icon: '☀️', label: 'I dag', section: 'HISTORIK' },
  { id: 'overview', icon: '📈', label: 'Overblik', section: 'HISTORIK' },
  { id: 'toplists', icon: '🏆', label: 'Toplister', section: 'ANALYSE' },
  { id: 'stats', icon: '📊', label: 'Statistik', section: 'ANALYSE' },
  { id: 'timesaved', icon: '⏱️', label: 'Tidsbesparelse', section: 'INDSIGT' },
  { id: 'reconcile', icon: '⚖️', label: 'Afstemning', section: 'ØKONOMI' },
  { id: 'reports', icon: '📁', label: 'Rapporter', section: 'EKSPORT' },
];

const PAGE_TITLES = {
  today: null, // dynamic
  overview: 'Overblik',
  toplists: 'Toplister',
  stats: 'Statistik',
  timesaved: 'Tidsbesparelse',
  reconcile: 'Afstemning',
  reports: 'Eksportér data',
};

// ─── STATE ───
let activePage = 'today';
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

// ─── MODAL LIFECYCLE ───

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
    btn.addEventListener('click', () => {
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
  const { icon = '', trend = '', trendUp = true, sub = '' } = opts;
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
      ${sub ? `<span class="hv3-stat-sub">${escHtml(sub)}</span>` : ''}
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

  // All-time for average calculation
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

  // Use getDailyRevenueActive for "Alt" range, getDailyRevenue for shorter ranges
  let dailyData;
  if (overviewRange === 'Alt') {
    const firstDate = await getFirstSaleDate();
    const altFrom = firstDate || new Date('2020-01-01');
    dailyData = await getDailyRevenueActive(altFrom, to, includeTestUsers);
  } else {
    dailyData = await getDailyRevenue(from, to, includeTestUsers);
  }

  // Monthly data
  const firstDate = await getFirstSaleDate();
  const monthFrom = firstDate || new Date('2020-01-01');
  const monthlyData = await getMonthlyRevenue(monthFrom, to, includeTestUsers);

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

window.__hv3SetToplistTab = (tab) => { toplistTab = tab; renderPageToplister(); };
window.__hv3SetToplistPeriod = (p) => { toplistPeriod = p; renderPageToplister(); };
window.__hv3SetToplistSort = (s) => { toplistSort = s; renderPageToplister(); };

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
    </div>
    ${filterPills(['I dag', 'Uge', 'Måned', 'Altid'], toplistPeriod, '__hv3SetToplistPeriod', true)}
  </div>`;

  let contentHtml = '<div class="hv3-loading"><div class="hv3-spinner"></div>Indlæser...</div>';
  c.innerHTML = `<div class="hv3-page">${headerHtml}<div id="hv3-toplist-content">${contentHtml}</div></div>`;

  const contentEl = document.getElementById('hv3-toplist-content');

  if (toplistTab === 'produkter') {
    const products = await getTopProducts(from, to, 10, includeTestUsers);
    const totalRev = products.reduce((s, p) => s + (p.beloeb || p.total_revenue || 0), 0);

    // Normalize field names
    const normalized = products.map(p => ({
      name: p.name || p.product_name || 'Ukendt',
      emoji: p.emoji || '',
      icon_url: p.icon_url || '',
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
              <span style="font-size:18px">${productIcon(p.emoji, p.icon_url)}</span>
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
              <td style="padding:8px;font-weight:600">${productIcon(p.emoji, p.icon_url, 14)} ${escHtml(p.name)}</td>
              <td style="padding:8px;color:var(--hv3-text-muted)">${p.sold > 0 ? Math.round(p.revenue / p.sold) : 0} kr</td>
              <td style="padding:8px;font-weight:600">${p.sold}</td>
              <td style="padding:8px;font-weight:700">${fmtKr(p.revenue)}</td>
              <td style="padding:8px;color:var(--hv3-text-muted)">${totalRev > 0 ? Math.round(p.revenue / totalRev * 100) : 0}%</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
      </div>`;
  } else if (toplistTab === 'ekspedienter') {
    const clerks = await getTopClerks(from, to, 10, includeTestUsers);
    const normalized = clerks.map(cl => ({
      name: cl.name || 'Ukendt',
      sales: cl.antal_salg || 0,
      revenue: cl.beloeb || 0,
    }));

    const donutId = 'hv3-clerk-donut-' + Date.now();
    const totalSales = normalized.reduce((s, c) => s + c.sales, 0);

    contentEl.innerHTML = `
      <div class="hv3-card" style="padding:22px 24px">
        ${sectionTitle('⭐ Top ekspedienter (salg)')}
        ${renderRankingList(normalized, { valueKey: 'sales', valueLabel: 'salg', subKey: 'revenue', subLabel: 'kr' })}
      </div>
      <div class="hv3-grid-2">
        <div class="hv3-card">
          ${sectionTitle('📊 Salg fordeling')}
          ${renderDonutChart(normalized.map(c => ({ label: c.name, value: c.sales })), { id: donutId })}
        </div>
        <div class="hv3-card">
          ${sectionTitle('📋 Ekspedient detaljer')}
          <table class="hv3-table" style="font-size:12px">
            <thead><tr>${['#', 'Navn', 'Salg', 'Omsætning', 'Gns./salg'].map(h => `<th style="padding:8px 6px">${h}</th>`).join('')}</tr></thead>
            <tbody>${normalized.map((cl, i) => `<tr>
              <td style="padding:8px 6px;font-weight:700;color:${i < 3 ? 'var(--hv3-accent)' : 'var(--hv3-text-light)'}">${i + 1}</td>
              <td style="padding:8px 6px;font-weight:600;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(cl.name)}</td>
              <td style="padding:8px 6px;font-weight:600">${cl.sales}</td>
              <td style="padding:8px 6px">${fmtKr(cl.revenue)}</td>
              <td style="padding:8px 6px;color:var(--hv3-text-muted)">${cl.sales > 0 ? (cl.revenue / cl.sales).toFixed(1) : 0} kr</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
      </div>`;
  } else {
    // Kunder
    const customers = await getTopCustomers(from, to, 10, includeTestUsers);
    const normalized = customers.map(cu => ({
      name: cu.name || 'Ukendt',
      spent: cu.forbrugt || 0,
      purchases: cu.antal_koeb || 0,
    }));

    const donutId = 'hv3-cust-donut-' + Date.now();

    contentEl.innerHTML = `
      <div class="hv3-card" style="padding:22px 24px">
        ${sectionTitle('👦 Top kunder (forbrug)')}
        ${renderRankingList(normalized, { valueKey: 'spent', valueLabel: 'kr', subKey: 'purchases', subLabel: 'køb' })}
      </div>
      <div class="hv3-grid-2">
        <div class="hv3-card">
          ${sectionTitle('📊 Forbrug fordeling')}
          ${renderDonutChart(normalized.map(c => ({ label: c.name, value: c.spent })), { id: donutId })}
        </div>
        <div class="hv3-card">
          ${sectionTitle('📋 Kundedetaljer')}
          <table class="hv3-table" style="font-size:12px">
            <thead><tr>${['#', 'Navn', 'Forbrug', 'Køb', 'Gns./køb'].map(h => `<th style="padding:8px 6px">${h}</th>`).join('')}</tr></thead>
            <tbody>${normalized.map((cu, i) => `<tr>
              <td style="padding:8px 6px;font-weight:700;color:${i < 3 ? 'var(--hv3-accent)' : 'var(--hv3-text-light)'}">${i + 1}</td>
              <td style="padding:8px 6px;font-weight:600;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(cu.name)}</td>
              <td style="padding:8px 6px;font-weight:700">${fmtKr(cu.spent)}</td>
              <td style="padding:8px 6px">${cu.purchases} køb</td>
              <td style="padding:8px 6px;color:var(--hv3-text-muted)">${cu.purchases > 0 ? (cu.spent / cu.purchases).toFixed(1) : 0} kr</td>
            </tr>`).join('')}</tbody>
          </table>
        </div>
      </div>`;
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

  const [club, deposits, balances, dailyData, saldoDist, revenueByDay] = await Promise.all([
    getClubStats(from, to, includeTestUsers),
    getTotalDeposits(from, to, includeTestUsers),
    getTotalBalances(includeTestUsers),
    getDailyRevenueActive(from, to, includeTestUsers),
    getBalanceDistribution(includeTestUsers),
    getRevenueByDay(from, to, includeTestUsers),
  ]);

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
