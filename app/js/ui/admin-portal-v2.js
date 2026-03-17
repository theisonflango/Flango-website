/**
 * admin-portal-v2.js — Main orchestrator for Admin Portal v2
 *
 * Entry point that ties together:
 *   - Portal Settings page (via AdminPortalSettings.render())
 *   - Insights page (stat cards, alerts, adoption, charts)
 *   - Parent List overlay (fullscreen table with search, filters, sort, detail modal)
 *
 * Exposed:
 *   window.openAdminPortalV2()   — main entry called from shell-and-theme.js
 *   window.isV2Enabled()         — check localStorage version flag
 */
(function () {
  'use strict';

  // Helpers der bruger showCustomAlert (fra ES6 module) med fallback til native
  function _alert(msg) {
    if (window.__flangoShowCustomAlert) {
      window.__flangoShowCustomAlert('Besked', msg);
    } else {
      alert(msg);
    }
  }
  function _confirm(msg) {
    if (window.__flangoShowCustomAlert) {
      return window.__flangoShowCustomAlert('Bekræft', msg, 'confirm');
    }
    return Promise.resolve(confirm(msg));
  }

  // ─── Version toggle ────────────────────────────────────────────
  const PORTAL_VERSION_KEY = 'flango_portal_version';

  function isV2Enabled() {
    return localStorage.getItem(PORTAL_VERSION_KEY) !== 'v1';
  }

  function setPortalVersion(v) {
    localStorage.setItem(PORTAL_VERSION_KEY, v);
  }

  // ─── State ─────────────────────────────────────────────────────
  let overlayEl = null;
  let currentPage = 'page-portal';
  let previewMode = false;
  let parentListFilter = '';
  let parentListSearchQuery = '';
  let parentListSortCol = -1;
  let parentListSortAsc = true;
  let chartsGenerated = false;

  // Loaded data (real data via PortalData, or fallback demo)
  let institutionName = 'Min Institution';
  let institutionSettings = null;
  let statsData = null;
  let adoptionData = null;
  let parentListData = [];
  let previewUsers = [];
  let currentDetailChild = null; // Current child shown in detail modal

  // ─── Demo / placeholder data ───────────────────────────────────

  const DEMO_STATS = {
    totalChildren: 130,
    totalParents: 87,
    childrenWithCode: 87,
    adoptionRate: 67,
    missingParents: 43,
    activeParents30d: 62,
    activeParents7d: 41,
    activeParentsToday: 23,
    neverLoggedIn: 43,
    avgBalance: 84,
    totalBalance: 10920,
    zeroBalanceCount: 12,
    noLimitsSet: 15,
    notifsEnabled: 62,
    notifsDisabled: 25,
    notifRate: 71,
    totalDepositAmount: 47350,
    monthlyDepositAmount: 8420,
    weeklyDepositAmount: 2150,
    totalDepositCount: 342,
    weeklyDepositCount: 28,
    totalPurchaseCount: 2847,
    monthlyPurchaseCount: 412,
    avgPurchasesPerChild: 4.7,
  };

  const DEMO_PARENT_LIST = [
    { child: 'Claire Ellen B.M.', parent: 'Maria Meyer', saldo: 127.5, login: 'I dag 08:21', code: 1, pcode: 1, limit: '30 kr', spent: 89, purchases: 14, deposited: 400, lastdep: '26. feb \u00b7 100 kr', diet: '\u2014', screentime: '60 min', notif: 1, codedate: '15. jan', created: '3. dec', flags: 'active' },
    { child: 'Oscar', parent: 'Thomas Isen', saldo: 85, login: 'I dag 14:02', code: 1, pcode: 1, limit: '50 kr', spent: 156, purchases: 23, deposited: 600, lastdep: '24. feb \u00b7 200 kr', diet: '\u2014', screentime: '30 min', notif: 1, codedate: '20. jan', created: '3. dec', flags: 'active' },
    { child: 'Alma', parent: 'Thomas Isen', saldo: 85, login: '27. feb', code: 1, pcode: 1, limit: '30 kr', spent: 42, purchases: 8, deposited: 300, lastdep: '20. feb \u00b7 100 kr', diet: 'Vegetar', screentime: '30 min', notif: 1, codedate: '\u2014', created: '5. dec', flags: 'active' },
    { child: 'Freja', parent: 'Louise Nielsen', saldo: 210, login: 'I dag 11:30', code: 1, pcode: 1, limit: '40 kr', spent: 112, purchases: 18, deposited: 500, lastdep: '25. feb \u00b7 150 kr', diet: '\u2014', screentime: '45 min', notif: 1, codedate: '1. feb', created: '3. dec', flags: 'active code' },
    { child: 'Noah', parent: 'Peter Andersen', saldo: 45, login: '26. feb', code: 1, pcode: 0, limit: '25 kr', spent: 78, purchases: 12, deposited: 250, lastdep: '22. feb \u00b7 100 kr', diet: '\u2014', screentime: '\u2014', notif: 1, codedate: '\u2014', created: '10. dec', flags: 'active' },
    { child: 'Ella', parent: 'Sofie Hansen', saldo: 15, login: '23. feb', code: 1, pcode: 0, limit: '\u2014', spent: 35, purchases: 5, deposited: 100, lastdep: '15. feb \u00b7 50 kr', diet: 'Ingen svinekod', screentime: '\u2014', notif: 0, codedate: '\u2014', created: '12. dec', flags: 'nolimit' },
    { child: 'Snoop Dog', parent: 'Test Foralder', saldo: 0, login: '25. feb', code: 1, pcode: 0, limit: '\u2014', spent: 50, purchases: 7, deposited: 50, lastdep: '10. feb \u00b7 50 kr', diet: '\u2014', screentime: '\u2014', notif: 0, codedate: '\u2014', created: '15. dec', flags: 'zero nolimit' },
    { child: 'Test Aladin', parent: 'Aladdin F.', saldo: 0, login: '24. feb', code: 1, pcode: 0, limit: '\u2014', spent: 10, purchases: 2, deposited: 10, lastdep: '8. feb \u00b7 10 kr', diet: '\u2014', screentime: '\u2014', notif: 0, codedate: '22. feb', created: '18. dec', flags: 'zero nolimit code' },
    { child: 'Villads', parent: 'Mette Larsen', saldo: 52, login: '21. feb', code: 1, pcode: 1, limit: '35 kr', spent: 63, purchases: 9, deposited: 200, lastdep: '18. feb \u00b7 100 kr', diet: '\u2014', screentime: '45 min', notif: 1, codedate: '\u2014', created: '3. dec', flags: 'active' },
    { child: 'Ida', parent: 'Karen Olsen', saldo: 8, login: '15. feb', code: 1, pcode: 0, limit: '20 kr', spent: 92, purchases: 15, deposited: 150, lastdep: '1. feb \u00b7 50 kr', diet: '\u2014', screentime: '\u2014', notif: 0, codedate: '\u2014', created: '8. dec', flags: '' },
    { child: 'Albert', parent: 'Morten Albertsen', saldo: 42, login: '20. feb', code: 1, pcode: 1, limit: '30 kr', spent: 58, purchases: 10, deposited: 200, lastdep: '14. feb \u00b7 100 kr', diet: '\u2014', screentime: '\u2014', notif: 1, codedate: '\u2014', created: '6. dec', flags: 'active' },
    { child: 'z70', parent: '\u2014', saldo: 0, login: '\u2014', code: 1, pcode: 0, limit: '\u2014', spent: 0, purchases: 0, deposited: 0, lastdep: '\u2014', diet: '\u2014', screentime: '\u2014', notif: 0, codedate: '\u2014', created: '20. dec', flags: 'never nocode zero nolimit' },
    { child: 'Adrian Hadi', parent: '\u2014', saldo: 0, login: 'Aldrig', code: 0, pcode: 0, limit: '\u2014', spent: 0, purchases: 0, deposited: 0, lastdep: '\u2014', diet: '\u2014', screentime: '\u2014', notif: 0, codedate: '\u2014', created: '\u2014', flags: 'never nocode zero nolimit' },
    { child: 'Agnes Leonora W.C.', parent: '\u2014', saldo: 0, login: 'Aldrig', code: 0, pcode: 0, limit: '\u2014', spent: 0, purchases: 0, deposited: 0, lastdep: '\u2014', diet: '\u2014', screentime: '\u2014', notif: 0, codedate: '\u2014', created: '\u2014', flags: 'never nocode zero nolimit' },
    { child: 'Aksel Ahrenst K.', parent: '\u2014', saldo: 0, login: 'Aldrig', code: 0, pcode: 0, limit: '\u2014', spent: 0, purchases: 0, deposited: 0, lastdep: '\u2014', diet: '\u2014', screentime: '\u2014', notif: 0, codedate: '\u2014', created: '\u2014', flags: 'never nocode zero nolimit' },
    { child: 'Mathilde', parent: 'Anne Sorensen', saldo: 190, login: 'I dag 09:15', code: 1, pcode: 1, limit: '50 kr', spent: 134, purchases: 20, deposited: 500, lastdep: '27. feb \u00b7 200 kr', diet: '\u2014', screentime: '60 min', notif: 1, codedate: '\u2014', created: '3. dec', flags: 'active' },
    { child: 'Emil', parent: 'Jonas Petersen', saldo: 33, login: '19. feb', code: 1, pcode: 0, limit: '25 kr', spent: 67, purchases: 11, deposited: 150, lastdep: '12. feb \u00b7 50 kr', diet: '\u2014', screentime: '30 min', notif: 0, codedate: '\u2014', created: '10. dec', flags: '' },
    { child: 'Sofie', parent: 'Camilla Jensen', saldo: 0, login: '10. feb', code: 1, pcode: 1, limit: '30 kr', spent: 100, purchases: 16, deposited: 100, lastdep: '1. feb \u00b7 100 kr', diet: 'Vegetar', screentime: '\u2014', notif: 1, codedate: '5. feb', created: '5. dec', flags: 'zero code' },
    { child: 'Lucas', parent: 'Henrik M.', saldo: 65, login: '22. feb', code: 1, pcode: 1, limit: '\u2014', spent: 35, purchases: 6, deposited: 100, lastdep: '20. feb \u00b7 100 kr', diet: '\u2014', screentime: '\u2014', notif: 1, codedate: '\u2014', created: '15. dec', flags: 'nolimit' },
    { child: 'Karla', parent: '\u2014', saldo: 0, login: 'Aldrig', code: 0, pcode: 0, limit: '\u2014', spent: 0, purchases: 0, deposited: 0, lastdep: '\u2014', diet: '\u2014', screentime: '\u2014', notif: 0, codedate: '\u2014', created: '\u2014', flags: 'never nocode zero nolimit' },
  ];

  const PL_COLS = [
    { key: 'child', label: 'Barn' },
    { key: 'parent', label: 'For\u00e6lder' },
    { key: 'saldo', label: 'Saldo' },
    { key: 'login', label: 'Sidste login' },
    { key: 'limit', label: 'Daglig gr\u00e6nse' },
    { key: 'spent', label: 'Forbrug (m\u00e5ned)' },
    { key: 'purchases', label: 'Antal k\u00f8b' },
    { key: 'notif', label: 'Notifikation' },
    { key: 'action', label: 'Handling' },
  ];

  // ─── Google Fonts loader ───────────────────────────────────────

  function ensureGoogleFonts() {
    if (document.querySelector('link[href*="Plus+Jakarta+Sans"]')) return;
    const preconnect1 = document.createElement('link');
    preconnect1.rel = 'preconnect';
    preconnect1.href = 'https://fonts.googleapis.com';
    document.head.appendChild(preconnect1);

    const preconnect2 = document.createElement('link');
    preconnect2.rel = 'preconnect';
    preconnect2.href = 'https://fonts.gstatic.com';
    preconnect2.crossOrigin = 'anonymous';
    document.head.appendChild(preconnect2);

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap';
    document.head.appendChild(link);
  }

  // ─── Helpers ───────────────────────────────────────────────────

  function fmt(n) {
    if (n == null) return '\u2014';
    return n.toLocaleString('da-DK');
  }

  function esc(s) {
    const el = document.createElement('span');
    el.textContent = s;
    return el.innerHTML;
  }

  function getStats() {
    return statsData || DEMO_STATS;
  }

  function getParentListRows() {
    return parentListData.length > 0 ? parentListData : DEMO_PARENT_LIST;
  }

  /** Formatér en ISO-dato til dansk-venlig visning (relativ eller dato) */
  function formatLoginDate(isoStr) {
    if (!isoStr) return 'Aldrig';
    try {
      var d = new Date(isoStr);
      if (isNaN(d.getTime())) return String(isoStr);
      var now = new Date();
      var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      var dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      var diffDays = Math.floor((today - dateOnly) / 86400000);
      var timeStr = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      if (diffDays === 0) return 'I dag ' + timeStr;
      if (diffDays === 1) return 'I går ' + timeStr;
      return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
    } catch (e) {
      return String(isoStr);
    }
  }

  // ─── Main overlay structure ────────────────────────────────────

  function buildOverlayHTML() {
    const s = getStats();
    return `
      <div class="portal-v2" id="portal-v2-root">

        <!-- ══════ ADMIN BAR ══════ -->
        <div class="admin-bar" id="pv2-admin-bar">
          <div class="admin-bar-left">
            <button class="admin-bar-back-btn" id="pv2-back-to-cafe" title="Tilbage til café-app">&#8592; Café-app</button>
            <div class="admin-bar-label">Admin</div>
            <div class="admin-bar-institution" id="pv2-institution-name">${esc(institutionName)}</div>
          </div>
          <div class="admin-bar-center">
            <button class="admin-page-tab active" data-page="page-portal" id="pv2-tab-portal">&#9881;&#65039; Portal-indstillinger</button>
            <button class="admin-page-tab" data-page="page-insights" id="pv2-tab-insights">&#128202; For\u00e6ldreindsigt</button>
          </div>
          <div class="admin-bar-right">
            <div class="preview-toggle" id="pv2-preview-toggle">
              <span class="preview-label" id="pv2-preview-label">&#128065;&#65039; For\u00e6ldrevisning</span>
              <div class="preview-switch"></div>
            </div>
          </div>
        </div>

        <!-- ══════ PAGE: PORTAL SETTINGS ══════ -->
        <div class="admin-page active" id="pv2-page-portal">
          <div id="pv2-settings-container"></div>
        </div>

        <!-- ══════ PAGE: INSIGHTS ══════ -->
        <div class="admin-page" id="pv2-page-insights">
          ${buildInsightsSidebarHTML()}
          <div class="insights-page">
            ${buildInsightsContentHTML(s)}
          </div>
        </div>

        <!-- ══════ PARENT LIST OVERLAY ══════ -->
        <div class="parent-list-overlay" id="pv2-parent-list-overlay">
          <div class="pl-topbar">
            <div class="pl-topbar-left">
              <div class="pl-topbar-back" id="pv2-pl-back">\u2190 Tilbage</div>
              <div class="pl-topbar-title" id="pv2-pl-title">For\u00e6ldreliste \u2014 ${esc(institutionName)}</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <button class="pl-action-btn" style="border-color:rgba(255,255,255,.2);color:rgba(255,255,255,.7)" id="pv2-pl-batch-codes">&#128273; Generer alle koder</button>
              <button class="pl-action-btn" style="border-color:rgba(255,255,255,.2);color:rgba(255,255,255,.7)" id="pv2-pl-export">&#128229; Eksporter CSV</button>
            </div>
          </div>
          <div class="pl-toolbar">
            <input class="pl-search" placeholder="S\u00f8g barn eller for\u00e6lder\u2026" id="pv2-pl-search">
            <div class="pl-sep"></div>
            <button class="pl-filter-btn" id="pv2-flt-never">&#128683; Aldrig logget ind</button>
            <button class="pl-filter-btn" id="pv2-flt-zero">&#128184; 0 kr saldo</button>
            <button class="pl-filter-btn" id="pv2-flt-nolimit">&#9888;&#65039; Ingen gr\u00e6nser</button>
            <button class="pl-filter-btn" id="pv2-flt-nocode">&#128273; Ingen kode</button>
            <div class="pl-count" id="pv2-pl-row-count"></div>
          </div>
          <div class="pl-table-wrap">
            <table class="pl-table">
              <thead><tr id="pv2-pl-thead"></tr></thead>
              <tbody id="pv2-pl-tbody"></tbody>
            </table>
          </div>
          <div class="pl-summary" id="pv2-pl-summary"></div>
        </div>

        <!-- ══════ PARENT LIST DETAIL MODAL ══════ -->
        <div class="pl-modal-overlay" id="pv2-pl-modal">
          <div class="pl-modal">
            <div class="pl-modal-head">
              <div class="pl-modal-title" id="pv2-pl-m-name">\u2014</div>
              <button class="pl-modal-close" id="pv2-pl-m-close">&#10005;</button>
            </div>
            <div class="pl-modal-body" id="pv2-pl-m-body"></div>
            <div class="pl-modal-actions">
              <button id="pv2-pl-m-close2">Luk</button>
              <button class="primary" id="pv2-pl-m-generate-code">&#128273; Generer ny kode</button>
            </div>
          </div>
        </div>

        <!-- ══════ FOOTER ══════ -->
        <div class="pv2-footer">
          <a href="#" id="pv2-close-link">\u2190 Tilbage til caf\u00e9-app</a>
        </div>
      </div>
    `;
  }

  // ─── Insights sidebar (desktop) ────────────────────────────────

  function buildInsightsSidebarHTML() {
    return `
      <aside class="desktop-sidebar insights-sidebar">
        <div class="brand">
          <div>
            <div class="brand-name" style="font-size:20px;font-weight:700">&#127818; Flango</div>
            <div class="brand-sub" style="font-size:11px;color:var(--ink-muted);font-weight:500;margin-top:-2px">Admin Portal</div>
          </div>
        </div>
        <div style="padding:0 var(--s5);margin-bottom:var(--s2)">
          <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-muted)">Portal Administration</span>
        </div>
        <nav class="sidebar-nav">
          <div class="sidebar-nav-item pv2-insight-page-nav" data-target-page="page-portal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;flex-shrink:0"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
            Portal-indstillinger
          </div>
          <div class="sidebar-nav-item active">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;flex-shrink:0"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            For\u00e6ldreindsigt
          </div>
        </nav>
        <div class="sidebar-divider"></div>
        <div style="padding:0 var(--s5);margin-bottom:var(--s2)">
          <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-muted)">Denne side</span>
        </div>
        <nav class="sidebar-nav" style="padding-bottom:var(--s4)">
          <div class="sidebar-nav-item insight-nav active" data-insight-scroll="pv2-insight-stats">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;flex-shrink:0"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            Overblik
          </div>
          <div class="sidebar-nav-item insight-nav" data-insight-scroll="pv2-insight-alerts">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;flex-shrink:0"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            Handlinger
          </div>
          <div class="sidebar-nav-item insight-nav" data-insight-scroll="pv2-insight-adoption">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;flex-shrink:0"><line x1="12" y1="20" x2="12" y2="10"/><polyline points="18 14 12 8 6 14"/></svg>
            Adoption
          </div>
          <div class="sidebar-nav-item insight-nav pv2-open-parent-list-nav" data-insight-scroll="pv2-insight-parent-list">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;flex-shrink:0"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
            For\u00e6ldreliste
          </div>
          <div class="sidebar-nav-item insight-nav" data-insight-scroll="pv2-insight-charts">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;flex-shrink:0"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            Statistik
          </div>
        </nav>
        <div class="sidebar-footer">
          <div class="sidebar-footer-btn pv2-close-from-sidebar" style="cursor:pointer;display:flex;align-items:center;gap:var(--s2);font-size:13px;color:var(--ink-muted);font-weight:500;padding:var(--s2) 0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><polyline points="15 18 9 12 15 6"/></svg>
            Tilbage til caf\u00e9-app
          </div>
        </div>
      </aside>
    `;
  }

  // ─── Insights content ──────────────────────────────────────────

  function buildInsightsContentHTML(s) {
    const now = new Date();
    const timeStr = 'i dag, ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

    // Adoption bars data — use real data from PortalData.getAdoptionStats() if available
    var ad = adoptionData;
    var limitsSet, limitsSetCount, allergenPct, allergenCount, screentimePct, screentimeCount;
    if (ad) {
      limitsSet = ad.limitsSet.pct;
      limitsSetCount = ad.limitsSet.count;
      allergenPct = ad.allergensSet.pct;
      allergenCount = ad.allergensSet.count;
      screentimePct = ad.screentimeSet.pct;
      screentimeCount = ad.screentimeSet.count;
    } else {
      limitsSet = s.totalParents > 0 ? Math.round(((s.totalParents - s.noLimitsSet) / s.totalParents) * 100) : 0;
      limitsSetCount = s.totalParents - s.noLimitsSet;
      allergenPct = 0;
      allergenCount = 0;
      screentimePct = 0;
      screentimeCount = 0;
    }

    return `
      <div class="page-header">
        <div class="page-title">For\u00e6ldreindsigt</div>
        <div class="page-subtitle">Overblik over for\u00e6ldrenes aktivitet og ops\u00e6tning \u00b7 Sidst opdateret: ${esc(timeStr)}</div>
      </div>

      <!-- ROW 1: Core stats -->
      <div class="insight-stat-grid" id="pv2-insight-stats">
        <div class="insight-stat-card">
          <div class="insight-stat-header">
            <div class="insight-stat-icon" style="background:#DCFCE7">&#128104;&#8205;&#128105;&#8205;&#128103;</div>
          </div>
          <div class="insight-stat-value">${fmt(s.totalParents)}<span style="font-family:var(--font);font-size:18px;color:var(--ink-muted);font-weight:600"> / ${fmt(s.totalChildren)}</span></div>
          <div class="insight-stat-label">For\u00e6ldre oprettet vs. b\u00f8rn</div>
          <div class="insight-stat-detail"><strong>${s.adoptionRate}%</strong> adoption rate \u00b7 ${fmt(s.missingParents)} mangler</div>
        </div>
        <div class="insight-stat-card">
          <div class="insight-stat-header">
            <div class="insight-stat-icon" style="background:#EFF6FF">&#128241;</div>
          </div>
          <div class="insight-stat-value">${fmt(s.activeParents30d)}</div>
          <div class="insight-stat-label">Aktive for\u00e6ldre (30 dage)</div>
          <div class="insight-stat-detail"><strong>${fmt(s.activeParents7d)}</strong> seneste 7 dage \u00b7 <strong>${fmt(s.activeParentsToday)}</strong> i dag</div>
        </div>
        <div class="insight-stat-card">
          <div class="insight-stat-header">
            <div class="insight-stat-icon" style="background:var(--flango-light)">&#128176;</div>
          </div>
          <div class="insight-stat-value">${fmt(s.avgBalance)}<span style="font-family:var(--font);font-size:18px;color:var(--ink-muted);font-weight:600"> kr</span></div>
          <div class="insight-stat-label">Gennemsnitlig saldo</div>
          <div class="insight-stat-detail"><strong style="color:#DC2626">${fmt(s.zeroBalanceCount)} b\u00f8rn</strong> med 0 kr</div>
        </div>
        <div class="insight-stat-card">
          <div class="insight-stat-header">
            <div class="insight-stat-icon" style="background:#F5F3FF">&#128276;</div>
          </div>
          <div class="insight-stat-value">${s.notifRate}%</div>
          <div class="insight-stat-label">Notifikationer aktiveret</div>
          <div class="insight-stat-detail"><strong>${fmt(s.notifsEnabled)}</strong> til \u00b7 <strong>${fmt(s.notifsDisabled)}</strong> fra</div>
        </div>
      </div>

      <!-- ROW 2: Economy stats -->
      <div class="insight-stat-grid insight-stat-grid-3">
        <div class="insight-stat-card">
          <div class="insight-stat-header">
            <div class="insight-stat-icon" style="background:#DCFCE7">&#128179;</div>
          </div>
          <div class="insight-stat-value">${fmt(s.totalDepositAmount)}<span style="font-family:var(--font);font-size:18px;color:var(--ink-muted);font-weight:600"> kr</span></div>
          <div class="insight-stat-label">Indbetalinger i alt</div>
          <div class="insight-stat-detail"><strong>${fmt(s.monthlyDepositAmount)} kr</strong> denne m\u00e5ned \u00b7 <strong>${fmt(s.weeklyDepositAmount)} kr</strong> denne uge<br><strong>${fmt(s.totalDepositCount)}</strong> indbetalinger \u00b7 <strong>${fmt(s.weeklyDepositCount)}</strong> denne uge</div>
        </div>
        <div class="insight-stat-card">
          <div class="insight-stat-header">
            <div class="insight-stat-icon" style="background:var(--flango-light)">&#128176;</div>
          </div>
          <div class="insight-stat-value">${fmt(s.totalBalance)}<span style="font-family:var(--font);font-size:18px;color:var(--ink-muted);font-weight:600"> kr</span></div>
          <div class="insight-stat-label">Saldoer i alt</div>
          <div class="insight-stat-detail">Fordelt p\u00e5 <strong>${fmt(s.totalParents)}</strong> konti \u00b7 gns. <strong>${fmt(s.avgBalance)} kr</strong></div>
        </div>
        <div class="insight-stat-card">
          <div class="insight-stat-header">
            <div class="insight-stat-icon" style="background:#EFF6FF">&#128722;</div>
          </div>
          <div class="insight-stat-value">${fmt(s.totalPurchaseCount)}</div>
          <div class="insight-stat-label">K\u00f8b i alt</div>
          <div class="insight-stat-detail"><strong>${fmt(s.monthlyPurchaseCount)}</strong> denne m\u00e5ned \u00b7 gns. <strong>${s.avgPurchasesPerChild} k\u00f8b/barn</strong></div>
        </div>
      </div>

      <!-- ALERTS -->
      <div id="pv2-insight-alerts">
        <div class="insight-section-title">&#9889; Kr\u00e6ver opm\u00e6rksomhed</div>
        <div class="alert-cards">
          <div class="alert-card pv2-alert-card" data-filter="never">
            <div class="alert-icon red">&#128683;</div>
            <div class="alert-info">
              <div class="alert-count">${fmt(s.neverLoggedIn)}</div>
              <div class="alert-text">for\u00e6ldre har aldrig logget ind</div>
            </div>
            <div class="alert-action">Vis &rarr;</div>
          </div>
          <div class="alert-card pv2-alert-card" data-filter="zero">
            <div class="alert-icon orange">&#128184;</div>
            <div class="alert-info">
              <div class="alert-count">${fmt(s.zeroBalanceCount)}</div>
              <div class="alert-text">b\u00f8rn har 0 kr saldo</div>
            </div>
            <div class="alert-action">Vis &rarr;</div>
          </div>
          <div class="alert-card pv2-alert-card" data-filter="nolimit">
            <div class="alert-icon blue">&#9888;&#65039;</div>
            <div class="alert-info">
              <div class="alert-count">${fmt(s.noLimitsSet)}</div>
              <div class="alert-text">har ikke sat gr\u00e6nser</div>
            </div>
            <div class="alert-action">Vis &rarr;</div>
          </div>
          <div class="alert-card pv2-alert-card" data-filter="nocode">
            <div class="alert-icon purple">&#128273;</div>
            <div class="alert-info">
              <div class="alert-count">${fmt(s.missingParents)}</div>
              <div class="alert-text">b\u00f8rn mangler for\u00e6ldrekonto</div>
            </div>
            <div class="alert-action">Vis &rarr;</div>
          </div>
        </div>
      </div>

      <!-- ADOPTION -->
      <div id="pv2-insight-adoption">
        <div class="insight-section-title">&#128202; Funktions-adoption</div>
        <div class="adoption-grid">
          <div class="adoption-card">
            <div class="adoption-header">
              <div class="adoption-name">Gr\u00e6nser sat</div>
              <div class="adoption-pct" style="color:#16A34A">${limitsSet}%</div>
            </div>
            <div class="adoption-bar-track"><div class="adoption-bar-fill" style="width:${limitsSet}%;background:#16A34A"></div></div>
            <div class="adoption-detail">${fmt(limitsSetCount)} af ${fmt(s.totalParents)} for\u00e6ldre</div>
          </div>
          <div class="adoption-card">
            <div class="adoption-header">
              <div class="adoption-name">Allergener</div>
              <div class="adoption-pct" style="color:var(--flango)">${allergenPct}%</div>
            </div>
            <div class="adoption-bar-track"><div class="adoption-bar-fill" style="width:${allergenPct}%;background:var(--flango)"></div></div>
            <div class="adoption-detail">${fmt(allergenCount)} af ${fmt(s.totalParents)} for\u00e6ldre</div>
          </div>
          <div class="adoption-card">
            <div class="adoption-header">
              <div class="adoption-name">Sk\u00e6rmtidsregler</div>
              <div class="adoption-pct" style="color:#2563EB">${screentimePct}%</div>
            </div>
            <div class="adoption-bar-track"><div class="adoption-bar-fill" style="width:${screentimePct}%;background:#2563EB"></div></div>
            <div class="adoption-detail">${fmt(screentimeCount)} af ${fmt(s.totalParents)} for\u00e6ldre</div>
          </div>
        </div>
      </div>

      <!-- PARENT LIST LINK -->
      <div id="pv2-insight-parent-list">
        <div class="parent-list-link pv2-open-parent-list">
          <div style="display:flex;align-items:center;gap:var(--s4)">
            <div style="width:44px;height:44px;border-radius:var(--r-md);background:var(--flango-light);display:flex;align-items:center;justify-content:center;font-size:20px">&#128101;</div>
            <div>
              <div style="font-weight:700;font-size:16px">For\u00e6ldreliste</div>
              <div style="font-size:13px;color:var(--ink-muted)">${fmt(s.totalChildren)} b\u00f8rn \u00b7 ${fmt(s.totalParents)} for\u00e6ldre oprettet \u00b7 S\u00f8g, filtrer, sort\u00e9r</div>
            </div>
          </div>
          <div style="font-weight:700;color:var(--flango-dark);font-size:14px">\u00c5bn fuldsk\u00e6rm &rarr;</div>
        </div>
      </div>

      <!-- CHARTS -->
      <div id="pv2-insight-charts">
        <div class="insight-section-title">&#128200; Statistik over tid</div>
        <div class="charts-grid">
          <div class="chart-card">
            <div class="chart-card-header">
              <div class="chart-card-title">Login-aktivitet</div>
              <div class="i-period-toggle">
                <button class="i-period-btn">7d</button>
                <button class="i-period-btn active">30d</button>
              </div>
            </div>
            <div class="chart-bars" id="pv2-login-chart"></div>
            <div class="chart-labels"><span class="chart-label">1. feb</span><span class="chart-label">14. feb</span><span class="chart-label">28. feb</span></div>
          </div>
          <div class="chart-card">
            <div class="chart-card-header">
              <div class="chart-card-title">Portal-adoption</div>
              <div class="i-period-toggle">
                <button class="i-period-btn active">Siden start</button>
              </div>
            </div>
            <div class="chart-bars" id="pv2-adoption-chart"></div>
            <div class="chart-labels"><span class="chart-label">Dec</span><span class="chart-label">Jan</span><span class="chart-label">Feb</span></div>
          </div>
        </div>
      </div>
    `;
  }

  // ─── Chart bar generation ──────────────────────────────────────

  function generateChartBars(containerId, count, cssClass) {
    const el = overlayEl.querySelector('#' + containerId);
    if (!el || el.children.length > 0) return;
    let html = '';
    for (let i = 0; i < count; i++) {
      const h = 20 + Math.random() * 75;
      html += '<div class="chart-bar ' + cssClass + '" style="height:' + h.toFixed(1) + '%"></div>';
    }
    el.innerHTML = html;
  }

  // ─── Page switching ────────────────────────────────────────────

  function switchPage(pageId) {
    if (!overlayEl) return;
    currentPage = pageId;

    // Update page visibility
    overlayEl.querySelectorAll('.admin-page').forEach(function (p) {
      p.classList.toggle('active', p.id === 'pv2-' + pageId);
    });

    // Update tab buttons
    overlayEl.querySelectorAll('.admin-page-tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.page === pageId);
    });

    // Generate charts when switching to insights (lazy)
    if (pageId === 'page-insights' && !chartsGenerated) {
      chartsGenerated = true;
      generateChartBars('pv2-login-chart', 28, 'primary');
      generateChartBars('pv2-adoption-chart', 12, 'accent');
    }

    // Scroll to top
    const root = overlayEl.querySelector('#portal-v2-root');
    if (root) root.scrollTop = 0;
  }

  // ─── Preview mode ──────────────────────────────────────────────

  function togglePreview() {
    if (!overlayEl) return;
    previewMode = !previewMode;
    const root = overlayEl.querySelector('#portal-v2-root');
    if (root) root.classList.toggle('parent-preview', previewMode);

    const toggle = overlayEl.querySelector('#pv2-preview-toggle');
    if (toggle) toggle.classList.toggle('active', previewMode);

    const label = overlayEl.querySelector('#pv2-preview-label');
    if (label) {
      label.textContent = previewMode ? '\u2699\ufe0f Tilbage til admin' : '\ud83d\udc41\ufe0f For\u00e6ldrevisning';
    }
  }

  // ─── Parent list ───────────────────────────────────────────────

  function openParentList(filter) {
    if (!overlayEl) return;
    parentListFilter = filter || '';
    parentListSearchQuery = '';

    // Clear search
    var searchEl = overlayEl.querySelector('#pv2-pl-search');
    if (searchEl) searchEl.value = '';

    // Set filter buttons
    overlayEl.querySelectorAll('.pl-filter-btn').forEach(function (b) { b.classList.remove('active'); });
    if (parentListFilter) {
      var btn = overlayEl.querySelector('#pv2-flt-' + parentListFilter);
      if (btn) btn.classList.add('active');
    }

    renderParentListTable();
    renderParentListSummary();

    overlayEl.querySelector('#pv2-parent-list-overlay').classList.add('open');
  }

  function closeParentList() {
    if (!overlayEl) return;
    overlayEl.querySelector('#pv2-parent-list-overlay').classList.remove('open');
  }

  function toggleParentListFilter(f) {
    parentListFilter = (parentListFilter === f) ? '' : f;
    overlayEl.querySelectorAll('.pl-filter-btn').forEach(function (b) { b.classList.remove('active'); });
    if (parentListFilter) {
      var btn = overlayEl.querySelector('#pv2-flt-' + parentListFilter);
      if (btn) btn.classList.add('active');
    }
    renderParentListTable();
  }

  function getFilteredParentData() {
    var q = parentListSearchQuery.toLowerCase();
    var rows = getParentListRows().filter(function (d) {
      if (q && !((d.child || '').toLowerCase().indexOf(q) >= 0 || (d.parent || '').toLowerCase().indexOf(q) >= 0)) return false;
      if (parentListFilter && d.flags.indexOf(parentListFilter) < 0) return false;
      return true;
    });

    if (parentListSortCol >= 0) {
      var key = PL_COLS[parentListSortCol] ? PL_COLS[parentListSortCol].key : null;
      if (key) {
        rows.sort(function (a, b) {
          var av = a[key], bv = b[key];
          if (typeof av === 'number' && typeof bv === 'number') {
            return parentListSortAsc ? av - bv : bv - av;
          }
          av = String(av);
          bv = String(bv);
          return parentListSortAsc ? av.localeCompare(bv, 'da') : bv.localeCompare(av, 'da');
        });
      }
    }
    return rows;
  }

  function renderParentListTable() {
    if (!overlayEl) return;
    // Header
    var thead = overlayEl.querySelector('#pv2-pl-thead');
    if (thead) {
      thead.innerHTML = PL_COLS.map(function (c, i) {
        var cls = '';
        if (parentListSortCol === i) cls = 'sorted' + (parentListSortAsc ? '' : ' desc');
        return '<th class="' + cls + '" data-col-idx="' + i + '">' + esc(c.label) + '</th>';
      }).join('');
    }

    // Body
    var rows = getFilteredParentData();
    var tbody = overlayEl.querySelector('#pv2-pl-tbody');
    if (tbody) {
      tbody.innerHTML = rows.map(function (d, ri) {
        var ck = '<span style="color:#16A34A;font-weight:700">\u2713</span>';
        var no = '<span class="pl-no">\u2014</span>';
        var saldoCls = d.saldo === 0 ? 'red' : d.saldo < 20 ? 'orange' : 'green';
        return '<tr data-row-idx="' + ri + '">' +
          '<td><span class="pl-child-avatar">' + esc(d.child[0]) + '</span>' + esc(d.child) + '</td>' +
          '<td>' + (!d.parent || d.parent === '\u2014' ? '<span class="pl-no">\u2014</span>' : esc(d.parent)) + '</td>' +
          '<td><span class="pl-tag ' + saldoCls + '">' + d.saldo + ' kr</span></td>' +
          '<td>' + (!d.login || d.login === 'Aldrig' || d.login === '\u2014' ? '<span class="pl-tag red">' + (d.login ? esc(d.login) : 'Aldrig') + '</span>' : esc(formatLoginDate(d.login))) + '</td>' +
          '<td>' + (!d.limit || d.limit === '\u2014' ? '<span class="pl-tag gray">Ikke sat</span>' : '<span class="pl-tag blue">' + esc(d.limit) + '</span>') + '</td>' +
          '<td>' + d.spent + ' kr</td>' +
          '<td>' + d.purchases + '</td>' +
          '<td>' + (d.notif ? ck : no) + '</td>' +
          '<td><button class="pl-action-btn pv2-pl-action-btn">\ud83d\udd11 Ny kode</button></td>' +
        '</tr>';
      }).join('');
    }

    // Count
    var countEl = overlayEl.querySelector('#pv2-pl-row-count');
    var totalRows = getParentListRows().length;
    if (countEl) countEl.textContent = 'Viser ' + rows.length + ' af ' + totalRows;
  }

  function renderParentListSummary() {
    var summaryEl = overlayEl.querySelector('#pv2-pl-summary');
    if (!summaryEl) return;
    var s = getStats();
    summaryEl.innerHTML =
      '<span>B\u00f8rn: <strong>' + fmt(s.totalChildren) + '</strong></span>' +
      '<span>For\u00e6ldre oprettet: <strong>' + fmt(s.totalParents) + '</strong></span>' +
      '<span>Gns. saldo: <strong>' + fmt(s.avgBalance) + ' kr</strong></span>' +
      '<span>Aktive (30d): <strong>' + fmt(s.activeParents30d) + '</strong></span>' +
      '<span>0 kr saldo: <strong style="color:#DC2626">' + fmt(s.zeroBalanceCount) + '</strong></span>' +
      '<span>Aldrig logget ind: <strong style="color:#DC2626">' + fmt(s.neverLoggedIn) + '</strong></span>';
  }

  function sortParentListBy(idx) {
    if (parentListSortCol === idx) {
      parentListSortAsc = !parentListSortAsc;
    } else {
      parentListSortCol = idx;
      parentListSortAsc = true;
    }
    renderParentListTable();
  }

  function openParentDetailModal(rowIdx) {
    var d = getFilteredParentData()[rowIdx];
    if (!d) return;
    currentDetailChild = d;

    var nameEl = overlayEl.querySelector('#pv2-pl-m-name');
    if (nameEl) nameEl.textContent = d.child;

    var ck = '<span style="color:#16A34A;font-weight:700">\u2713 Ja</span>';
    var no = '<span style="color:var(--ink-muted)">\u2014 Nej</span>';

    function row(label, value) {
      return '<div class="pl-modal-row"><span style="font-size:13px;color:var(--ink-soft)">' + label + '</span><span style="font-size:13px;font-weight:600">' + value + '</span></div>';
    }

    var loginDisplay = (!d.login || d.login === 'Aldrig') ? 'Aldrig' : formatLoginDate(d.login);
    var createdDisplay = d.created ? (typeof d.created === 'string' && d.created.length > 10 ? new Date(d.created).toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' }) : d.created) : '\u2014';

    var html = '';
    html += '<div class="pl-modal-sec"><div class="pl-modal-sec-title">\ud83d\udc64 Konto</div>';
    html += row('Barn', esc(d.child || '\u2014'));
    html += row('For\u00e6lder', d.parent ? esc(d.parent) : '<span style="color:var(--ink-muted)">\u2014</span>');
    html += row('Oprettet', esc(createdDisplay));
    html += row('Har kode', d.code ? ck : no);
    html += row('Portal-kode', d.portalCode ? '<code style="font-size:12px;background:var(--surface-raised,#f1f5f9);padding:2px 6px;border-radius:4px">' + esc(d.portalCode) + '</code>' + (d.portalCodeUsedAt ? ' <span class="pl-tag green" style="font-size:10px">Brugt</span>' : '') : '<span style="color:var(--ink-muted)">\u2014</span>');
    html += row('Sidste login', loginDisplay === 'Aldrig' ? '<span class="pl-tag red">Aldrig</span>' : esc(loginDisplay));
    html += '</div>';

    html += '<div class="pl-modal-sec"><div class="pl-modal-sec-title">\ud83d\udcb0 \u00d8konomi</div>';
    var saldoCls = d.saldo === 0 ? 'red' : d.saldo < 20 ? 'orange' : 'green';
    html += row('Saldo', '<span class="pl-tag ' + saldoCls + '">' + d.saldo + ' kr</span>');
    html += row('Daglig gr\u00e6nse', (!d.limit || d.limit === '\u2014') ? '<span class="pl-tag gray">Ikke sat</span>' : '<span class="pl-tag blue">' + esc(d.limit) + '</span>');
    html += row('Forbrug denne m\u00e5ned', (d.spent || 0) + ' kr');
    html += row('Antal k\u00f8b', '' + (d.purchases || 0));
    html += row('Indbetalt i alt', (d.deposited || 0) + ' kr');
    html += row('Sidste indbetaling', d.lastDeposit ? esc(d.lastDeposit) : (d.lastdep ? esc(d.lastdep) : '<span style="color:var(--ink-muted)">\u2014</span>'));
    html += '</div>';

    html += '<div class="pl-modal-sec"><div class="pl-modal-sec-title">\ud83e\udd57 Kost & allergi</div>';
    html += row('Kostpr\u00e6ference', (!d.diet || d.diet === '\u2014') ? '<span style="color:var(--ink-muted)">Ingen</span>' : '<span class="pl-tag blue">' + esc(d.diet) + '</span>');
    if (d.allergenCount > 0) {
      html += row('Allergener', '<span class="pl-tag orange">' + d.allergenCount + ' allergener konfigureret</span>');
    }
    html += '</div>';

    html += '<div class="pl-modal-sec"><div class="pl-modal-sec-title">\ud83d\udda5\ufe0f Sk\u00e6rmtid</div>';
    html += row('Daglig gr\u00e6nse', d.screentime && d.screentime !== '\u2014' ? esc(d.screentime) : '<span style="color:var(--ink-muted)">\u2014</span>');
    html += '</div>';

    var bodyEl = overlayEl.querySelector('#pv2-pl-m-body');
    if (bodyEl) bodyEl.innerHTML = html;

    overlayEl.querySelector('#pv2-pl-modal').classList.add('open');
  }

  function closeParentDetailModal() {
    if (!overlayEl) return;
    overlayEl.querySelector('#pv2-pl-modal').classList.remove('open');
  }

  function exportParentListCSV() {
    var rows = getFilteredParentData();
    var header = PL_COLS.filter(function (c) { return c.key !== 'action'; }).map(function (c) { return c.label; });
    var csvRows = [header.join(';')];
    rows.forEach(function (d) {
      csvRows.push([
        d.child, d.parent, d.saldo, d.login, d.limit,
        d.spent, d.purchases, d.notif ? 'Ja' : 'Nej',
      ].join(';'));
    });
    var blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'foraeldreliste.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ─── Portal-kode generering + Aula-besked ───────────────────────

  /**
   * Generer en portal-kode for ét barn og vis kode + Aula-besked popup.
   * @param {object} childData - Row data fra parentListData (childId, child, portalCode, etc.)
   */
  async function handleGenerateCode(childData) {
    if (!childData || !childData.childId) return;

    // Generer kode via RPC
    var result = await PortalData.generateSinglePortalCode(childData.childId);
    if (!result || !result.success) {
      _alert('Kunne ikke generere kode: ' + (result ? result.error : 'Ukendt fejl'));
      return;
    }

    var newCode = result.code;
    var childName = result.child_name || childData.child;

    // Opdater lokalt cache
    for (var i = 0; i < parentListData.length; i++) {
      if (parentListData[i].childId === childData.childId) {
        parentListData[i].portalCode = newCode;
        parentListData[i].portalCodeGeneratedAt = new Date().toISOString();
        break;
      }
    }

    // Vis kode-popup med Aula-besked
    showCodePopup(childName, newCode);
  }

  /**
   * Vis popup med genereret kode, Aula-besked og kopierings-knapper.
   */
  async function showCodePopup(childName, code) {
    // Hent Aula-skabelon
    var aulaData = await PortalData.getAulaMessageTemplate();
    var template = (aulaData && aulaData.template)
      ? aulaData.template
      : 'Kære forælder,\n\nDit barn {{child_name}} har fået en kode til Flango Forældreportal.\n\nKode: {{pin}}\n\nGå til flango.dk/forældre for at oprette din konto.\n\nVenlig hilsen\n{{institution}}';

    // Erstat placeholders (støtter både {{x}} og {x} formater)
    var instName = (aulaData && aulaData.institutionName) || institutionName || 'Institutionen';
    var messageText = template
      .replace(/\{\{child_name\}\}/gi, childName)
      .replace(/\{\{barnets_navn\}\}/gi, childName)
      .replace(/\{barnets_navn\}/gi, childName)
      .replace(/\{\{pin\}\}/gi, code)
      .replace(/\{\{kode\}\}/gi, code)
      .replace(/\{kode\}/gi, code)
      .replace(/\{\{institution\}\}/gi, instName)
      .replace(/\{institution\}/gi, instName);

    // Opret popup
    var popupOverlay = document.createElement('div');
    popupOverlay.className = 'pv2-code-popup-overlay';
    popupOverlay.innerHTML =
      '<div class="pv2-code-popup">' +
        '<div class="pv2-code-popup-header">' +
          '<div style="font-size:18px;font-weight:700">Portal-kode oprettet</div>' +
          '<button class="pv2-code-popup-close">&times;</button>' +
        '</div>' +
        '<div class="pv2-code-popup-body">' +
          '<p style="margin:0 0 4px 0">Ny portal-kode til <strong>' + esc(childName) + '</strong>:</p>' +
          '<div class="pv2-code-display">' + esc(code) + '</div>' +
          '<div style="display:flex;gap:8px;margin-bottom:16px">' +
            '<button class="pv2-code-copy-btn" id="pv2-copy-code-btn">\ud83d\udccb Kopier kode</button>' +
          '</div>' +
          '<div class="pv2-code-aula-section">' +
            '<div style="font-size:13px;font-weight:600;margin-bottom:6px">\ud83d\udce8 Aula-besked til for\u00e6lderen:</div>' +
            '<div class="pv2-code-aula-text">' + esc(messageText).replace(/\n/g, '<br>') + '</div>' +
            '<button class="pv2-code-copy-btn" id="pv2-copy-aula-btn" style="margin-top:8px">\ud83d\udccb Kopier Aula-besked</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    // Bind events
    var closeBtn = popupOverlay.querySelector('.pv2-code-popup-close');
    if (closeBtn) closeBtn.addEventListener('click', function () { popupOverlay.remove(); renderParentListTable(); });
    popupOverlay.addEventListener('click', function (e) { if (e.target === popupOverlay) { popupOverlay.remove(); renderParentListTable(); } });

    var copyCodeBtn = popupOverlay.querySelector('#pv2-copy-code-btn');
    if (copyCodeBtn) {
      copyCodeBtn.addEventListener('click', function () {
        navigator.clipboard.writeText(code).then(function () {
          copyCodeBtn.textContent = '\u2705 Kopieret!';
          setTimeout(function () { copyCodeBtn.textContent = '\ud83d\udccb Kopier kode'; }, 1500);
        }).catch(function () {
          copyCodeBtn.textContent = '\u274c Kunne ikke kopiere';
          setTimeout(function () { copyCodeBtn.textContent = '\ud83d\udccb Kopier kode'; }, 1500);
        });
      });
    }

    var copyAulaBtn = popupOverlay.querySelector('#pv2-copy-aula-btn');
    if (copyAulaBtn) {
      copyAulaBtn.addEventListener('click', function () {
        navigator.clipboard.writeText(messageText).then(function () {
          copyAulaBtn.textContent = '\u2705 Kopieret!';
          setTimeout(function () { copyAulaBtn.textContent = '\ud83d\udccb Kopier Aula-besked'; }, 1500);
        }).catch(function () {
          copyAulaBtn.textContent = '\u274c Kunne ikke kopiere';
          setTimeout(function () { copyAulaBtn.textContent = '\ud83d\udccb Kopier Aula-besked'; }, 1500);
        });
      });
    }

    // Append to overlay
    if (overlayEl) {
      overlayEl.appendChild(popupOverlay);
    } else {
      document.body.appendChild(popupOverlay);
    }
  }

  /**
   * Batch-generer portal-koder for alle børn uden kode.
   */
  async function handleBatchGenerateCodes() {
    // Tæl børn uden kode
    var missingCount = parentListData.filter(function (d) { return !d.portalCode; }).length;
    if (missingCount === 0) {
      _alert('Alle børn har allerede en portal-kode.');
      return;
    }

    if (!await _confirm('Generer portal-koder for ' + missingCount + ' børn uden kode?\n\nDette kan ikke fortrydes.')) {
      return;
    }

    var result = await PortalData.generatePortalCodesBatch();
    if (!result || !result.success) {
      _alert('Fejl ved batch-generering: ' + (result ? result.error : 'Ukendt fejl'));
      return;
    }

    _alert(result.generated_count + ' portal-koder genereret!');

    // Genindlæs data for at få de nye koder
    var overview = await PortalData.getParentAdminOverview();
    if (overview) {
      statsData = overview.stats;
      parentListData = overview.parentList || [];
      adoptionData = overview.adoption || null;
    }
    renderParentListTable();
    renderParentListSummary();
  }

  // ─── Insights sidebar scroll navigation ────────────────────────

  function scrollInsightTo(targetId) {
    if (!overlayEl) return;
    // Update active state
    overlayEl.querySelectorAll('.insight-nav').forEach(function (n) {
      n.classList.toggle('active', n.dataset.insightScroll === targetId);
    });
    var el = overlayEl.querySelector('#' + targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // ─── Event binding ─────────────────────────────────────────────

  function bindEvents() {
    if (!overlayEl) return;

    // Page tabs
    overlayEl.querySelector('#pv2-tab-portal').addEventListener('click', function () { switchPage('page-portal'); });
    overlayEl.querySelector('#pv2-tab-insights').addEventListener('click', function () { switchPage('page-insights'); });

    // Preview toggle
    overlayEl.querySelector('#pv2-preview-toggle').addEventListener('click', togglePreview);

    // Close portal (footer link)
    overlayEl.querySelector('#pv2-close-link').addEventListener('click', function (e) {
      e.preventDefault();
      closePortal();
    });

    // Close portal (admin bar back button)
    var backToCafe = overlayEl.querySelector('#pv2-back-to-cafe');
    if (backToCafe) {
      backToCafe.addEventListener('click', function () { closePortal(); });
    }

    // Insights sidebar: page navigation
    overlayEl.querySelectorAll('.pv2-insight-page-nav').forEach(function (el) {
      el.addEventListener('click', function () {
        switchPage(el.dataset.targetPage);
      });
    });

    // Insights sidebar: close from sidebar
    overlayEl.querySelectorAll('.pv2-close-from-sidebar').forEach(function (el) {
      el.addEventListener('click', function () { closePortal(); });
    });

    // Insights sidebar: scroll navigation
    overlayEl.querySelectorAll('.insight-nav').forEach(function (navItem) {
      navItem.addEventListener('click', function () {
        var target = navItem.dataset.insightScroll;
        if (target) scrollInsightTo(target);
      });
    });

    // Insights sidebar: parent list nav opens parent list
    overlayEl.querySelectorAll('.pv2-open-parent-list-nav').forEach(function (el) {
      el.addEventListener('click', function () { openParentList(); });
    });

    // Alert cards
    overlayEl.querySelectorAll('.pv2-alert-card').forEach(function (card) {
      card.addEventListener('click', function () {
        openParentList(card.dataset.filter);
      });
    });

    // Parent list link card
    overlayEl.querySelectorAll('.pv2-open-parent-list').forEach(function (el) {
      el.addEventListener('click', function () { openParentList(); });
    });

    // Parent list: back button
    overlayEl.querySelector('#pv2-pl-back').addEventListener('click', closeParentList);

    // Parent list: search
    overlayEl.querySelector('#pv2-pl-search').addEventListener('input', function (e) {
      parentListSearchQuery = e.target.value;
      renderParentListTable();
    });

    // Parent list: filter buttons
    overlayEl.querySelector('#pv2-flt-never').addEventListener('click', function () { toggleParentListFilter('never'); });
    overlayEl.querySelector('#pv2-flt-zero').addEventListener('click', function () { toggleParentListFilter('zero'); });
    overlayEl.querySelector('#pv2-flt-nolimit').addEventListener('click', function () { toggleParentListFilter('nolimit'); });
    overlayEl.querySelector('#pv2-flt-nocode').addEventListener('click', function () { toggleParentListFilter('nocode'); });

    // Parent list: batch generate codes
    overlayEl.querySelector('#pv2-pl-batch-codes').addEventListener('click', handleBatchGenerateCodes);

    // Parent list: CSV export
    overlayEl.querySelector('#pv2-pl-export').addEventListener('click', exportParentListCSV);

    // Parent list: table header sort
    overlayEl.querySelector('#pv2-pl-thead').addEventListener('click', function (e) {
      var th = e.target.closest('th');
      if (!th) return;
      var idx = parseInt(th.dataset.colIdx, 10);
      if (!isNaN(idx)) sortParentListBy(idx);
    });

    // Parent list: table row click (open detail) + action buttons
    overlayEl.querySelector('#pv2-pl-tbody').addEventListener('click', function (e) {
      // "Ny kode" action button
      var actionBtn = e.target.closest('.pv2-pl-action-btn');
      if (actionBtn) {
        var tr = actionBtn.closest('tr');
        if (tr) {
          var idx = parseInt(tr.dataset.rowIdx, 10);
          if (!isNaN(idx)) {
            var childRow = getFilteredParentData()[idx];
            if (childRow) handleGenerateCode(childRow);
          }
        }
        return;
      }
      // Row click opens detail modal
      var tr = e.target.closest('tr');
      if (!tr) return;
      var idx = parseInt(tr.dataset.rowIdx, 10);
      if (!isNaN(idx)) openParentDetailModal(idx);
    });

    // Parent list: detail modal close
    overlayEl.querySelector('#pv2-pl-m-close').addEventListener('click', closeParentDetailModal);
    overlayEl.querySelector('#pv2-pl-m-close2').addEventListener('click', closeParentDetailModal);

    // Parent list: detail modal "Generer ny kode" button
    var genCodeBtn = overlayEl.querySelector('#pv2-pl-m-generate-code');
    if (genCodeBtn) {
      genCodeBtn.addEventListener('click', function () {
        if (currentDetailChild) {
          closeParentDetailModal();
          handleGenerateCode(currentDetailChild);
        }
      });
    }

    // Parent list: modal overlay click-to-close
    overlayEl.querySelector('#pv2-pl-modal').addEventListener('click', function (e) {
      if (e.target === overlayEl.querySelector('#pv2-pl-modal')) {
        closeParentDetailModal();
      }
    });

    // "Vis original version" link in settings placeholder
    overlayEl.querySelectorAll('.pv2-switch-to-v1').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        setPortalVersion('v1');
        closePortal();
      });
    });

    // Period toggle clicks inside insights
    overlayEl.querySelectorAll('.i-period-toggle').forEach(function (toggle) {
      toggle.addEventListener('click', function (e) {
        var btn = e.target.closest('.i-period-btn');
        if (!btn) return;
        toggle.querySelectorAll('.i-period-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
      });
    });

    // Escape key handler
    document.addEventListener('keydown', handleKeyDown);
  }

  function handleKeyDown(e) {
    if (e.key !== 'Escape') return;
    if (!overlayEl) return;

    // Close in order of depth: detail modal > parent list > portal
    var modal = overlayEl.querySelector('#pv2-pl-modal');
    if (modal && modal.classList.contains('open')) {
      closeParentDetailModal();
      return;
    }

    var plOverlay = overlayEl.querySelector('#pv2-parent-list-overlay');
    if (plOverlay && plOverlay.classList.contains('open')) {
      closeParentList();
      return;
    }

    closePortal();
  }

  // ─── Lifecycle ─────────────────────────────────────────────────

  function closePortal() {
    if (!overlayEl) return;
    document.removeEventListener('keydown', handleKeyDown);
    overlayEl.remove();
    overlayEl = null;
    document.body.style.overflow = '';

    // Reset state
    currentPage = 'page-portal';
    previewMode = false;
    parentListFilter = '';
    parentListSearchQuery = '';
    parentListSortCol = -1;
    parentListSortAsc = true;
    chartsGenerated = false;
    statsData = null;
    adoptionData = null;
    parentListData = [];
    previewUsers = [];
    institutionSettings = null;
  }

  // ─── Main entry point ─────────────────────────────────────────

  async function openAdminPortalV2() {
    // Prevent double-open
    if (overlayEl) return;

    ensureGoogleFonts();

    // Load real data if PortalData is available
    try {
      if (typeof PortalData !== 'undefined') {
        // Hent settings + preview-brugere parallelt med RPC
        var settingsPromise = PortalData.getInstitutionSettings();
        var previewUsersPromise = typeof PortalData.getPreviewUsers === 'function' ? PortalData.getPreviewUsers() : Promise.resolve([]);

        // Brug samlet RPC hvis tilgængelig (erstatter 9+ parallelle queries)
        var overviewPromise = typeof PortalData.getParentAdminOverview === 'function'
          ? PortalData.getParentAdminOverview()
          : null;

        if (overviewPromise) {
          // Ny RPC-baseret datahentning
          var results = await Promise.all([settingsPromise, overviewPromise, previewUsersPromise]);

          if (results[0]) {
            institutionSettings = results[0];
            if (results[0].name) institutionName = results[0].name;
          }
          if (results[1]) {
            statsData = results[1].stats;
            parentListData = results[1].parentList || [];
            adoptionData = results[1].adoption || null;
          }
          if (results[2] && results[2].length > 0) {
            previewUsers = results[2];
          }
        } else {
          // Fallback: individuelle queries (legacy)
          var statsPromise = PortalData.getParentStats();
          var listPromise = typeof PortalData.getParentList === 'function' ? PortalData.getParentList() : Promise.resolve([]);
          var adoptionPromise = typeof PortalData.getAdoptionStats === 'function' ? PortalData.getAdoptionStats() : Promise.resolve(null);

          var results = await Promise.all([settingsPromise, statsPromise, listPromise, adoptionPromise, previewUsersPromise]);

          if (results[0]) {
            institutionSettings = results[0];
            if (results[0].name) institutionName = results[0].name;
          }
          if (results[1]) {
            statsData = results[1];
          }
          if (results[2] && results[2].length > 0) {
            parentListData = results[2];
          }
          if (results[3]) {
            adoptionData = results[3];
          }
          if (results[4] && results[4].length > 0) {
            previewUsers = results[4];
          }
        }
      }
    } catch (err) {
      console.warn('[admin-portal-v2] Kunne ikke hente data, bruger demo-data:', err);
    }

    // Create overlay container
    overlayEl = document.createElement('div');
    overlayEl.id = 'admin-portal-v2-overlay';
    overlayEl.style.cssText = 'position:fixed;inset:0;z-index:10000;overflow-y:auto;background:var(--surface, #FAFAF9);';
    overlayEl.innerHTML = buildOverlayHTML();

    document.body.appendChild(overlayEl);
    document.body.style.overflow = 'hidden';

    // Render Portal Settings page via AdminPortalSettings if available
    var settingsContainer = overlayEl.querySelector('#pv2-settings-container');
    if (settingsContainer && typeof AdminPortalSettings !== 'undefined' && typeof AdminPortalSettings.render === 'function') {
      AdminPortalSettings.render(settingsContainer, institutionSettings, institutionName, previewUsers);
      if (typeof AdminPortalSettings.initHandlers === 'function') {
        AdminPortalSettings.initHandlers(settingsContainer, institutionSettings);
      }
    } else if (settingsContainer) {
      // Fallback: simple placeholder for settings page
      settingsContainer.innerHTML = buildSettingsPlaceholder();
    }

    // Bind all event handlers
    bindEvents();

    // Start on portal settings page
    switchPage('page-portal');
  }

  // ─── Settings placeholder (when AdminPortalSettings is not loaded) ───

  function buildSettingsPlaceholder() {
    return `
      <div class="app" style="min-height:auto">
        <main class="main" style="padding:var(--s6);max-width:680px;margin:0 auto">
          <div class="view-header" style="padding:var(--s4) 0">
            <div class="view-title">Portal-indstillinger</div>
            <div class="view-subtitle">Konfigurer hvad for\u00e6ldre ser i portalen</div>
          </div>
          <div class="hint-box info" style="margin-bottom:var(--s4)">
            <span class="hint-icon">\u2139\ufe0f</span>
            <span>AdminPortalSettings-modulet er ikke indl\u00e6st. Indstillingerne renderes n\u00e5r <code>admin-portal-settings.js</code> er inkluderet.</span>
          </div>
          <div style="margin-top:var(--s6);padding-top:var(--s4);border-top:1px solid var(--border)">
            <a href="#" class="pv2-switch-to-v1" style="font-size:13px;color:var(--ink-muted);text-decoration:underline">Vis original version</a>
          </div>
        </main>
      </div>
    `;
  }

  // ─── Expose globally ───────────────────────────────────────────

  window.openAdminPortalV2 = openAdminPortalV2;
  window.isV2Enabled = isV2Enabled;

  // Also expose closePortal for external use
  window.closeAdminPortalV2 = closePortal;

})();
