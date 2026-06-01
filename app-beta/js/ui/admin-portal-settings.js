/**
 * admin-portal-settings.js — Portal Settings page for Admin Portal v2
 *
 * Renders the page-portal view: desktop sidebar, mobile nav, all tab views
 * (home, pay, limits, screen, profile) with admin overlays and feature toggles.
 *
 * Exposed as window.AdminPortalSettings with render(), initHandlers(), getSettingsState().
 */
(function () {
  'use strict';

  // ─── SVG icon library (reused across sidebar, sections, nav) ───
  const ICONS = {
    chevron: '<svg class="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>',
    card: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg>',
    noEntry: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
    cup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/></svg>',
    wrench: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>',
    monitor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    gamepad: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><circle cx="17" cy="10" r="1"/><circle cx="15" cy="13" r="1"/></svg>',
    barChart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    phone: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>',
    plusSmall: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    cardSmall: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>',
  };

  // ─── Sidebar navigation definition ───
  // Each entry: { id, icon, label, check (boolean = has sidebar checkbox), dataSection, checked (default) }
  const SIDEBAR_NAV = [
    { id: 'section-balance', icon: ICONS.home, label: 'Overblik', check: false },
    { id: 'section-events', icon: ICONS.calendar, label: 'Arrangementer', check: true, settingKey: 'parent_portal_events', defaultChecked: true },
    { id: 'section-profile', icon: ICONS.chart, label: 'Købsprofil', check: true, settingKey: 'parent_portal_purchase_profile', defaultChecked: true },
    { id: 'section-history', icon: ICONS.clock, label: 'Historik', check: true, settingKey: 'parent_portal_history', defaultChecked: true },
    { id: 'section-sortiment', icon: ICONS.list, label: 'Sortiment', check: true, settingKey: 'parent_portal_sortiment', defaultChecked: true },
    { id: 'section-topup', icon: ICONS.card, label: 'Indbetaling', check: true, settingKey: 'parent_portal_payment', defaultChecked: true },
    { id: 'section-spending-limit', icon: ICONS.shield, label: 'Daglig gr\u00e6nse', check: true, settingKey: 'parent_portal_spending_limit', defaultChecked: true },
    { id: 'section-product-limits', icon: ICONS.bag, label: 'K\u00f8bsgr\u00e6nser', check: true, settingKey: 'parent_portal_product_limit', defaultChecked: true },
    { id: 'section-sugar', icon: ICONS.noEntry, label: 'Sukkerpolitik', check: true, settingKey: 'parent_portal_sugar_policy', defaultChecked: true },
    { id: 'section-diet', icon: ICONS.cup, label: 'Kostpr\u00e6ferencer', check: true, settingKey: 'parent_portal_diet', defaultChecked: true },
    { id: 'section-allergens', icon: ICONS.wrench, label: 'Allergier', check: true, settingKey: 'parent_portal_allergens', defaultChecked: true },
    { id: 'section-profile-pictures', icon: ICONS.user, label: 'Profilbilleder', check: true, settingKey: 'parent_portal_profile_pictures', defaultChecked: true },
    { id: 'section-screentime', icon: ICONS.monitor, label: 'Sk\u00e6rmtid', check: true, settingKey: 'skaermtid_enabled', defaultChecked: true },
    { id: 'section-games', icon: ICONS.gamepad, label: 'Godkend spil', check: true, settingKey: 'skaermtid_allow_game_approval', defaultChecked: true },
    { id: 'section-st-chart', icon: ICONS.barChart, label: 'Spilletidsoversigt', check: true, settingKey: 'skaermtid_show_usage', defaultChecked: true },
    { id: 'section-notifications', icon: ICONS.mail, label: 'Notifikationer', check: true, settingKey: 'parent_portal_email_notifications', defaultChecked: true },
    { id: 'section-feedback', icon: ICONS.chat, label: 'Feedback', check: true, settingKey: 'parent_portal_feedback', defaultChecked: true },
    { id: 'section-pin', icon: ICONS.lock, label: 'Adgangskode', check: false },
  ];

  // ─── Feature flags state (sættes ved render) ───
  let _featureFlags = null;

  // ─── Helper: determine if a feature is on ───
  function isFeatureOn(nav, settings) {
    if (!nav.check) return true;
    if (nav.settingKey && settings) {
      var val = settings[nav.settingKey];
      if (val === undefined || val === null) {
        // Aldrig sat → brug default
        return nav.defaultChecked !== undefined ? nav.defaultChecked : false;
      }
      // parent_portal_payment er JSONB med { enabled: bool }
      if (nav.settingKey === 'parent_portal_payment' && typeof val === 'object') {
        return val.enabled !== false;
      }
      return !!val;
    }
    return nav.defaultChecked !== undefined ? nav.defaultChecked : false;
  }

  // ─── Feature flag lock-state for en sidebar nav item ───
  function getNavFlagState(nav) {
    const FM = window.FeatureModules;
    if (!FM || !_featureFlags || !nav.settingKey) return { locked: false, lockReason: null };
    const moduleKey = FM.SETTING_KEY_TO_MODULE[nav.settingKey];
    if (!moduleKey) return { locked: false, lockReason: null };
    // Tjek parent_portal override (låser alt)
    const parentFlag = _featureFlags.parent_portal;
    if (parentFlag?.locked && moduleKey !== 'parent_portal') {
      return { locked: true, lockReason: parentFlag.lock_reason || null };
    }
    const flag = FM.getModuleFlag(_featureFlags, moduleKey);
    const locked = flag?.locked === true;
    const lockReason = flag?.lock_reason || null;
    return { locked, lockReason };
  }

  // ─── Build sidebar HTML ───
  function buildSidebar(settings, institutionName) {
    let navItems = '';
    for (const nav of SIDEBAR_NAV) {
      const { locked, lockReason } = getNavFlagState(nav);
      const checked = locked ? isFeatureOn(nav, settings) : isFeatureOn(nav, settings);
      const featureOffClass = (!checked && nav.check) ? ' feature-off' : '';
      const lockedClass = locked ? ' superadmin-locked' : '';
      const disabledAttr = locked ? ' disabled' : '';
      const lockTitle = lockReason || 'Låst af administrator';
      const lockIcon = locked
        ? `<span class="sa-lock" title="${lockTitle}">🔒</span>`
        : '';
      const checkboxHtml = nav.check
        ? `<input type="checkbox" class="sidebar-check" data-section="${nav.id}" ${checked ? 'checked' : ''}${disabledAttr}>`
        : '';
      navItems += `
      <div class="sidebar-nav-item${featureOffClass}${lockedClass}" data-scroll="${nav.id}">
        ${checkboxHtml}${nav.icon}${nav.label}${lockIcon}
      </div>`;
    }

    return `
    <aside class="desktop-sidebar">
      <div class="brand">
        <img src="FlangoFruitLogo.webp" alt="Flango" class="brand-logo">
        <div><div class="brand-name">Flango</div><div class="brand-sub">For\u00e6ldreportal</div></div>
      </div>
      <div class="sidebar-child-section">
        ${_previewChildren.map(function(c, i) {
          return '<div class="sidebar-child-item' + (i === 0 ? ' active' : '') + '" data-child-id="' + c.id + '"><div class="sidebar-child-avatar">' + c.emoji + '</div><div><div class="sidebar-child-name">' + c.name + '</div><div class="sidebar-child-saldo">' + fmtBal(c.balance) + '</div></div></div>';
        }).join('')}
        <div class="sidebar-add-child">${ICONS.plus}Tilknyt barn</div>
      </div>
      <div class="sidebar-divider"></div>
      <div style="padding:0 var(--s5);margin-bottom:var(--s2)"><span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-muted)">Funktioner</span></div>
      <nav class="sidebar-nav">
        ${navItems}
      </nav>
      <div class="sidebar-footer">
        <div class="sidebar-footer-btn">${ICONS.logout}Log ud</div>
      </div>
    </aside>`;
  }

  // ─── Build mobile top nav ───
  function buildTopNav() {
    return `
    <header class="topnav">
      <div class="topnav-inner">
        <div class="brand"><img src="FlangoFruitLogo.webp" alt="Flango" class="brand-logo"><div><div class="brand-name">Flango</div></div></div>
        <div class="nav-actions">
          <button class="nav-btn" title="Notifikationer">${ICONS.bell}</button>
          <button class="nav-btn" title="Indstillinger">${ICONS.settings}</button>
        </div>
      </div>
    </header>`;
  }

  // ─── Build section wrapper ───
  function buildSection(id, icon, iconBg, title, subtitle, content, opts = {}) {
    const openClass = opts.open ? ' open' : '';
    const disabledClass = opts.disabled ? ' disabled' : '';
    return `
    <div class="section${openClass}${disabledClass}" id="${id}">
      <div class="section-header">
        <div class="section-title-row"><div class="section-icon" style="background:${iconBg}">${icon}</div><div><div class="section-title">${title}</div><div class="section-subtitle">${subtitle}</div></div></div>
        ${ICONS.chevron}
      </div>
      <div class="section-body"><div class="section-body-inner"><div class="section-content">
        ${content}
      </div></div></div>
    </div>`;
  }

  // ─── Build toggle ───
  function buildToggle(id, checked, extra) {
    return `<label class="toggle"${extra ? ' ' + extra : ''}><input type="checkbox"${id ? ' id="' + id + '"' : ''}${checked ? ' checked' : ''}><span class="toggle-track"></span></label>`;
  }

  // ─── Build setting row ───
  function buildSettingRow(label, desc, rightHtml) {
    return `
    <div class="setting-row">
      <div class="setting-info"><div class="setting-label">${label}</div>${desc ? '<div class="setting-desc">' + desc + '</div>' : ''}</div>
      ${rightHtml}
    </div>`;
  }

  // ─── Build stepper ───
  function buildStepper(value) {
    return `<div class="stepper"><button class="stepper-btn">\u2212</button><div class="stepper-val">${value}</div><button class="stepper-btn">+</button></div>`;
  }

  // ─── Build admin field ───
  function buildAdminField(label, content, extraStyle) {
    return `
    <div class="admin-field"${extraStyle ? ' style="' + extraStyle + '"' : ''}>
      <div class="admin-field-label">${label}</div>
      ${content}
    </div>`;
  }

  // ═══════════════════════════════════
  // TAB: HOME
  // ═══════════════════════════════════

  function buildTabHome(settings) {
    const eventsDisabled = !isFeatureOn(SIDEBAR_NAV.find(n => n.id === 'section-events'), settings);

    // Child selector (mobile)
    const childSelector = `
    <div class="child-selector">
      ${_previewChildren.map(function(c, i) {
        return '<button class="child-chip' + (i === 0 ? ' active' : '') + '" data-child="' + c.id + '"><span class="child-avatar">' + c.emoji + '</span> ' + c.name + ' <span class="saldo-mini">' + fmtBalShort(c.balance) + '</span></button>';
      }).join('')}
      <button class="child-chip add-child-chip">${ICONS.plus}Tilknyt</button>
    </div>`;

    // Balance card
    var _balWhole = Math.floor(_activeChild.balance);
    var _balDec = (',' + ((_activeChild.balance % 1) * 100).toFixed(0).padStart(2, '0'));
    var _balStatus = _activeChild.balance > 20 ? 'status-ok' : (_activeChild.balance > 0 ? 'status-warn' : 'status-low');
    var _balText = _activeChild.balance > 20 ? 'God saldo' : (_activeChild.balance > 0 ? 'Lav saldo' : 'Ingen saldo');
    const balanceCard = `
    <div class="balance-card" id="section-balance">
      <div class="balance-header">
        <div>
          <div class="balance-label">Saldo</div>
          <div class="balance-amount">${_balWhole}<span style="font-size:32px">${_balDec}</span> <span class="currency">kr</span></div>
          <div class="balance-child-name">${_activeChild.name} \u00b7 ${_instName}</div>
        </div>
        <div class="balance-status ${_balStatus}"><span class="status-dot"></span> ${_balText}</div>
      </div>
      <div class="topup-row">
        <button class="topup-btn topup-primary" data-nav-tab="tab-pay">${ICONS.plusSmall}Indbetal</button>
        <button class="topup-btn topup-secondary" id="contact-btn">${ICONS.phone}Kontakt</button>
      </div>
    </div>`;

    // Admin: Contact phone config
    const adminContact = buildAdminField('\uD83D\uDCDE Kontakttelefon', `
      <input type="tel" class="input-field input" id="contact-phone" value="45 76 28 30" placeholder="Telefonnummer til institutionen">
      ${buildSettingRow('Aktiver kontaktknap', 'Vis "Kontakt"-knap i saldo-kortet, s\u00e5 for\u00e6ldre kan ringe direkte. Hvis sl\u00e5et fra, viser knappen "Feedback" i stedet.', buildToggle('contact-toggle', true))}
    `);

    // Quick actions
    const quickActions = `
    <div class="quick-actions">
      <button class="qa-item" data-qa-scroll="section-spending-limit" data-qa-tab="tab-limits"><div class="qa-icon orange">\uD83D\uDCB0</div><div class="qa-label">Daglig gr\u00e6nse</div></button>
      <button class="qa-item" data-qa-scroll="section-allergens" data-qa-tab="tab-limits"><div class="qa-icon green">\uD83E\uDD57</div><div class="qa-label">Kost & Allergi</div></button>
      <button class="qa-item" data-qa-scroll="section-screentime" data-qa-tab="tab-screen"><div class="qa-icon blue">\uD83D\uDD79\uFE0F</div><div class="qa-label">Sk\u00e6rmtid</div></button>
      <button class="qa-item" data-qa-scroll="section-events" data-qa-tab="tab-home"><div class="qa-icon red">\uD83D\uDCC5</div><div class="qa-label">Events</div></button>
    </div>`;

    // Events section
    const eventsContent = `
      <div class="event-card">
        <div class="event-date-badge"><div class="event-month">Mar</div><div class="event-day">14</div></div>
        <div class="event-info"><div class="event-title">Fredagshygge m. pizza</div><div class="event-meta">15:00\u201317:00 \u00b7 25 kr</div></div>
        <button class="event-action-btn">Tilmeld</button>
      </div>
      <div class="event-payment" style="display:none">
        <div class="event-payment-title">Tilmeld & betal \u2014 25 kr</div>
        <p style="font-size:12px;color:var(--ink-muted);margin-bottom:var(--s3)">V\u00e6lg betalingsmetode for Fredagshygge m. pizza</p>
        <button class="event-pay-btn saldo"><span>\uD83D\uDCB0</span> Betal med ${_activeChild.name}s saldo <span style="font-size:11px;color:var(--ink-muted);margin-left:auto">Saldo: ${fmtBal(_activeChild.balance)}</span></button>
        <button class="event-pay-btn external"><span>\uD83D\uDCB3</span> Betal med kort/MobilePay</button>
        <button class="event-cancel-btn">Annuller</button>
      </div>
      <div class="event-card">
        <div class="event-date-badge"><div class="event-month">Mar</div><div class="event-day">21</div></div>
        <div class="event-info"><div class="event-title">For\u00e5rsfest</div><div class="event-meta">14:00\u201317:00 \u00b7 Gratis</div></div>
        <button class="event-action-btn registered">\u2713 Tilmeldt</button>
      </div>`;
    const eventsSection = buildSection('section-events', '\uD83D\uDCC5', 'var(--negative-light)', 'Kommende arrangementer', '2 arrangementer', eventsContent, { disabled: eventsDisabled });

    // Purchase profile section
    const profileContent = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--s2);flex-wrap:wrap;gap:var(--s2)">
        <div class="period-toggle" data-toggle-group="pp-period">
          <button class="period-btn">Alt</button><button class="period-btn active">30 dage</button><button class="period-btn">7 dage</button>
        </div>
      </div>
      <div class="chart-bar-group">
        <div class="chart-bar" style="height:45%"></div><div class="chart-bar" style="height:65%"></div><div class="chart-bar" style="height:30%"></div><div class="chart-bar" style="height:85%"></div><div class="chart-bar" style="height:55%"></div><div class="chart-bar" style="height:40%"></div><div class="chart-bar" style="height:70%"></div><div class="chart-bar" style="height:20%"></div><div class="chart-bar" style="height:60%"></div><div class="chart-bar" style="height:50%"></div><div class="chart-bar" style="height:75%"></div><div class="chart-bar" style="height:35%"></div><div class="chart-bar" style="height:90%"></div><div class="chart-bar today" style="height:45%"></div>
      </div>
      <div class="chart-labels"><span class="chart-label">17. feb</span><span class="chart-label">I dag</span></div>
      <div class="chart-summary">
        <div class="chart-stat"><div class="chart-stat-value">342 kr</div><div class="chart-stat-label">Samlet forbrug</div></div>
        <div class="chart-stat"><div class="chart-stat-value">28</div><div class="chart-stat-label">Antal k\u00f8b</div></div>
        <div class="chart-stat"><div class="chart-stat-value">12 kr</div><div class="chart-stat-label">Gns. pr. k\u00f8b</div></div>
      </div>
      <div class="product-chart">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--s3)">
          <div class="product-chart-title">Mest k\u00f8bte produkter</div>
          <div class="period-toggle" id="pp-sort-toggle">
            <button class="period-btn active" data-sort="antal">Antal</button>
            <button class="period-btn" data-sort="kr">Bel\u00f8b</button>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-bottom:var(--s2)">
          <div class="chart-view-toggle" id="pp-view-toggle">
            <button class="chart-view-btn active" data-view="bars">\u2630 Liste</button>
            <button class="chart-view-btn" data-view="pills">\uD83D\uDCCA S\u00f8jler</button>
          </div>
        </div>
        <div id="pp-pills-view" style="display:none">
          <div class="pill-chart-container" id="pp-pill-chart">
            <div class="pill-col"><div class="pill-bar-wrap"><div class="pill-value">12</div><div class="pill-bar c1" style="height:160px"></div></div><div class="pill-icon">\uD83E\uDDC3</div><div class="pill-name">Saft</div></div>
            <div class="pill-col"><div class="pill-bar-wrap"><div class="pill-value">9</div><div class="pill-bar c2" style="height:120px"></div></div><div class="pill-icon">\uD83E\uDD50</div><div class="pill-name">Bolle</div></div>
            <div class="pill-col"><div class="pill-bar-wrap"><div class="pill-value">7</div><div class="pill-bar c3" style="height:95px"></div></div><div class="pill-icon">\uD83C\uDF4E</div><div class="pill-name">Frugt</div></div>
            <div class="pill-col"><div class="pill-bar-wrap"><div class="pill-value">4</div><div class="pill-bar c4" style="height:55px"></div></div><div class="pill-icon">\uD83C\uDF6B</div><div class="pill-name">Chokolade</div></div>
            <div class="pill-col"><div class="pill-bar-wrap"><div class="pill-value">2</div><div class="pill-bar c5" style="height:30px"></div></div><div class="pill-icon">\uD83C\uDF6C</div><div class="pill-name">Slik</div></div>
          </div>
        </div>
        <div id="pp-bars-view">
          <div id="pp-product-bars">
            <div class="product-bar-row"><div class="product-bar-label">\uD83E\uDDC3 Saft</div><div class="product-bar-track"><div class="product-bar-fill c1" style="width:85%"><span class="product-bar-value">12 stk</span></div></div></div>
            <div class="product-bar-row"><div class="product-bar-label">\uD83E\uDD50 Bolle</div><div class="product-bar-track"><div class="product-bar-fill c2" style="width:65%"><span class="product-bar-value">9 stk</span></div></div></div>
            <div class="product-bar-row"><div class="product-bar-label">\uD83C\uDF4E Frugt</div><div class="product-bar-track"><div class="product-bar-fill c3" style="width:50%"><span class="product-bar-value">7 stk</span></div></div></div>
            <div class="product-bar-row"><div class="product-bar-label">\uD83C\uDF6B Chokolade</div><div class="product-bar-track"><div class="product-bar-fill c4" style="width:28%"><span class="product-bar-value">4 stk</span></div></div></div>
            <div class="product-bar-row"><div class="product-bar-label">\uD83C\uDF6C Slik</div><div class="product-bar-track"><div class="product-bar-fill c5" style="width:14%"><span class="product-bar-value">2 stk</span></div></div></div>
          </div>
        </div>
      </div>`;
    const profileSection = buildSection('section-profile', '\uD83D\uDCCA', 'var(--flango-light)', 'K\u00f8bsprofil', 'Forbrug de seneste 30 dage', profileContent);

    // History section
    const historyContent = `
      <div class="tx-row"><div class="tx-icon purchase">\uD83E\uDDC3</div><div class="tx-info"><div class="tx-title">Saft + Bolle</div><div class="tx-date">I dag, 14:32</div></div><div class="tx-amount negative">\u22127,00 kr</div></div>
      <div class="tx-row"><div class="tx-icon purchase">\uD83C\uDF6B</div><div class="tx-info"><div class="tx-title">Chokoladebar</div><div class="tx-date">I g\u00e5r, 15:10</div></div><div class="tx-amount negative">\u22125,00 kr</div></div>
      <div class="tx-row"><div class="tx-icon topup">\uD83D\uDCB3</div><div class="tx-info"><div class="tx-title">Optankning (Stripe)</div><div class="tx-date">25. feb, 08:45</div></div><div class="tx-amount positive">+100,00 kr</div></div>
      <div class="tx-row"><div class="tx-icon purchase">\uD83C\uDF4E</div><div class="tx-info"><div class="tx-title">Frugt</div><div class="tx-date">24. feb, 14:55</div></div><div class="tx-amount negative">\u22122,00 kr</div></div>
      <div class="tx-row"><div class="tx-icon adjust">\u2699\uFE0F</div><div class="tx-info"><div class="tx-title">Saldo-justering</div><div class="tx-date">22. feb, 09:00</div></div><div class="tx-amount positive">+15,00 kr</div></div>`;
    const historySection = buildSection('section-history', '\uD83D\uDCDC', 'var(--info-light)', 'Historik', 'Seneste transaktioner', historyContent);

    // Sortiment section
    const sortimentContent = `
      <div class="product-list-item"><div class="product-emoji">\uD83E\uDDC3</div><div class="product-name">Saft</div><div class="product-price">3,00 kr</div></div>
      <div class="product-list-item"><div class="product-emoji">\uD83E\uDD50</div><div class="product-name">Bolle</div><div class="product-price">4,00 kr</div></div>
      <div class="product-list-item"><div class="product-emoji">\uD83C\uDF4E</div><div class="product-name">Frugt</div><div class="product-price">2,00 kr</div></div>
      <div class="product-list-item"><div class="product-emoji">\uD83C\uDF6B</div><div class="product-name">Chokoladebar</div><div class="product-price">5,00 kr</div></div>
      <div class="product-list-item"><div class="product-emoji">\uD83C\uDF6C</div><div class="product-name">Slik</div><div class="product-price">3,00 kr</div></div>`;
    const sortimentSection = buildSection('section-sortiment', '\uD83D\uDCCB', 'var(--positive-light)', 'Dagens sortiment', 'Hvad kan k\u00f8bes i cafeen', sortimentContent);

    return `
    <div class="tab-view active" id="tab-home">
      ${childSelector}
      ${balanceCard}
      <div id="admin-contact">${adminContact}</div>
      ${quickActions}
      ${eventsSection}
      ${profileSection}
      ${historySection}
      ${sortimentSection}
    </div>`;
  }

  // ═══════════════════════════════════
  // TAB: PAY
  // ═══════════════════════════════════

  function buildTabPay() {
    const adminPaymentMethods = buildAdminField('Aktive betalingsmetoder', `
      <div class="setting-row" style="padding-top:0">
        <div class="setting-info"><div class="setting-label">Stripe (kort)</div></div>
        ${buildToggle(null, true)}
      </div>
      <div class="setting-row">
        <div class="setting-info"><div class="setting-label">MobilePay QR</div></div>
        ${buildToggle(null, true)}
      </div>
      <div class="setting-row">
        <div class="setting-info"><div class="setting-label">Kontant</div></div>
        ${buildToggle(null, true)}
      </div>
      <div style="margin-top:var(--s3)">
        <div style="font-size:13px;font-weight:600;margin-bottom:var(--s2)">MobilePay QR-billede</div>
        <div style="display:flex;align-items:center;gap:var(--s3)">
          <div style="width:64px;height:64px;border-radius:var(--r-md);background:var(--surface-sunken);border:1px dashed var(--border-strong);display:flex;align-items:center;justify-content:center;font-size:24px">\uD83D\uDCF1</div>
          <button style="padding:var(--s2) var(--s3);border-radius:var(--r-sm);border:1.5px solid var(--border);font-weight:600;font-size:13px;color:var(--ink-soft)">Upload QR-billede</button>
        </div>
      </div>
    `, 'margin-bottom:var(--s3)');

    const topupContent = `
      <div class="topup-grid">
        <button class="topup-option"><div class="topup-option-amount">50 kr</div><div class="topup-option-label">Lille optankning</div></button>
        <button class="topup-option selected"><div class="topup-option-amount">100 kr</div><div class="topup-option-label">Anbefalet</div></button>
        <button class="topup-option"><div class="topup-option-amount">150 kr</div><div class="topup-option-label">Stor optankning</div></button>
        <button class="topup-option custom"><div class="topup-option-amount">Andet</div><div class="topup-option-label">V\u00e6lg selv</div></button>
      </div>
      <div class="topup-method-section">
        <div class="topup-method-title">Betal med</div>
        ${adminPaymentMethods}
        <button class="topup-method-btn stripe">${ICONS.cardSmall}Kort (Stripe)</button>
        <button class="topup-method-btn mobilepay"><span style="font-size:18px">\uD83D\uDCF1</span>MobilePay</button>
        <button class="topup-method-btn cash"><span style="font-size:18px">\uD83D\uDCB5</span>Kontant (betal i institutionen)</button>
      </div>
      <div class="qr-section" id="mobilepay-qr-section" style="display:none">
        <div class="qr-image" id="qr-image">\uD83D\uDCF1</div>
        <div style="font-weight:700;font-size:14px;margin-bottom:var(--s1)">Scan med MobilePay</div>
        <div class="qr-note">Betal via MobilePay QR. Saldoen opdateres efter godkendelse af personalet.</div>
      </div>`;
    const topupSection = buildSection('section-topup', '\uD83D\uDCB3', 'var(--flango-light)', 'V\u00e6lg bel\u00f8b', 'Optank ${_activeChild.name}s saldo', topupContent);

    return `
    <div class="tab-view" id="tab-pay">
      <div class="view-header mobile-only"><div class="view-title">Indbetaling</div><div class="view-subtitle">Optank ${_activeChild.name}s saldo</div></div>
      ${topupSection}
    </div>`;
  }

  // ═══════════════════════════════════
  // TAB: LIMITS
  // ═══════════════════════════════════

  function buildTabLimits() {
    // Spending limit
    const spendingAdminField = buildAdminField('Institutionens daglige gr\u00e6nse', `
      <div style="display:flex;align-items:center;gap:var(--s3)">
        <input type="number" class="input-field input" value="50" style="width:100px" data-admin-setting="institution_spending_limit">
        <span style="font-size:14px;font-weight:600;color:var(--ink-soft)">kr pr. dag</span>
      </div>
    `);

    const spendingContent = `
      <div class="hint-box info" style="margin-bottom:var(--s3)"><span class="hint-icon">\uD83C\uDFEB</span><span>Institutionens daglige gr\u00e6nse: <strong>50 kr</strong></span></div>
      ${spendingAdminField}
      <div class="hint-box green" style="margin-bottom:var(--s3)"><span class="hint-icon">\uD83D\uDC64</span><span>Din daglige gr\u00e6nse: <strong>30 kr</strong></span></div>
      <p style="font-size:13px;color:var(--ink-soft);margin-bottom:var(--s2)">V\u00e6lg hvor meget ${_activeChild.name} maksimalt m\u00e5 bruge om dagen. Den strengeste gr\u00e6nse (din eller institutionens) g\u00e6lder altid.</p>
      <div class="chip-group" data-chip-group="spending-limit"><button class="chip">20 kr</button><button class="chip active">30 kr</button><button class="chip">40 kr</button><button class="chip">50 kr</button><button class="chip">Andet\u2026</button></div>
      <div class="hint-box neutral" style="margin-top:var(--s3)"><span class="hint-icon">\uD83D\uDCA1</span><span>${_activeChild.name} kan stadig k\u00f8be, men cafeen giver besked hvis gr\u00e6nsen overskrides.</span></div>`;
    const spendingSection = buildSection('section-spending-limit', '\uD83D\uDCB0', 'var(--flango-light)', 'Daglig bel\u00f8bsgr\u00e6nse', 'Maks forbrug per dag', spendingContent);

    // Product limits
    const productLimitsAdminField = buildAdminField('Dagens Ret indstillinger', `
      <div class="setting-row" style="padding-top:0">
        <div class="setting-info"><div class="setting-label">Vis Dagens Ret i portalen</div></div>
        ${buildToggle(null, true)}
      </div>
      <div class="setting-row">
        <div class="setting-info"><div class="setting-label">Prisindikation</div></div>
        <input type="text" class="input-field input" value="5-7 kr." style="width:100px" data-admin-setting="daily_special_price_hint">
      </div>
    `, 'margin-bottom:var(--s3)');

    const productLimitsContent = `
      <div class="hint-box neutral" style="margin-bottom:var(--s3)"><span class="hint-icon">\uD83D\uDCA1</span><span>Hvis institutionen har sat en gr\u00e6nse, g\u00e6lder den strengeste. Dit barns k\u00f8b m\u00e5 aldrig overstige hverken din eller klubbens gr\u00e6nse.</span></div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--s3) 0;background:var(--flango-light);margin:-0 calc(var(--s4) * -1);padding-left:var(--s4);padding-right:var(--s4);margin-bottom:var(--s2)">
        <div style="display:flex;align-items:center;gap:var(--s3)"><span style="font-size:20px">\uD83C\uDF7D\uFE0F</span><div><span style="font-weight:700;font-size:14px">Dagens Ret</span><div style="font-size:11px;color:var(--ink-muted)">Samlet gr\u00e6nse for alle dagens ret</div></div></div>
        ${buildStepper('\u221E')}
      </div>
      ${productLimitsAdminField}
      <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--s3) 0">
        <div style="display:flex;align-items:center;gap:var(--s3)"><span style="font-size:20px">\uD83C\uDF6B</span><span style="font-weight:600;font-size:14px">Chokoladebar</span></div>
        ${buildStepper('1')}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--s3) 0;border-top:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:var(--s3)"><span style="font-size:20px">\uD83C\uDF6C</span><span style="font-weight:600;font-size:14px">Slik</span></div>
        ${buildStepper('2')}
      </div>`;
    const productLimitsSection = buildSection('section-product-limits', '\uD83D\uDED2', 'var(--caution-light)', 'K\u00f8bsgr\u00e6nser pr. produkt', 'Begr\u00e6ns antal af specifikke varer', productLimitsContent);

    // Sugar policy
    const sugarAdminField = buildAdminField('Rediger sukkerpolitik-tekst', `
      <textarea class="input" placeholder="Skriv jeres sukkerpolitik her\u2026" data-admin-setting="sugar_policy_text">Vi begr\u00e6nser usunde varer til maks 2 pr. dag for alle b\u00f8rn.</textarea>
      ${buildSettingRow('Vis info-boks i portalen', 'For\u00e6ldre ser denne tekst under sukkerpolitik', buildToggle(null, true))}
    `);

    const sugarContent = `
      <div class="hint-box purple" style="margin-bottom:var(--s3)"><span class="hint-icon">\uD83C\uDFEB</span><span>Institutionens sukkerpolitik: "Vi begr\u00e6nser usunde varer til maks 2 pr. dag for alle b\u00f8rn."</span></div>
      ${sugarAdminField}
      ${buildSettingRow('Bloker alle usunde varer', '${_activeChild.name} kan kun k\u00f8be sunde varer', buildToggle(null, false))}
      ${buildSettingRow('Max usunde pr. dag', 'Begr\u00e6ns antal usunde varer samlet', buildStepper('2'))}
      ${buildSettingRow('Max af hvert usundt produkt', 'Pr. produkt (fx maks 1 chokolade)', buildStepper('1'))}`;
    const sugarSection = buildSection('section-sugar', '\uD83C\uDF6C', '#fce7f3', 'Sukkerpolitik', 'Kontroll\u00e9r usunde varer', sugarContent);

    // Diet preferences
    const dietContent = `
      ${buildSettingRow('Kun vegetarisk', 'Vis kun vegetariske produkter', buildToggle(null, false))}
      ${buildSettingRow('Ingen svinek\u00f8d', 'Bloker produkter med svinek\u00f8d', buildToggle(null, true))}`;
    const dietSection = buildSection('section-diet', '\uD83E\uDD57', 'var(--positive-light)', 'Kostpr\u00e6ferencer', 'Vegetarisk, svinek\u00f8d m.m.', dietContent);

    // Allergens
    const allergenItems = [
      { emoji: '\uD83E\uDD5C', name: 'Jordn\u00f8dder', state: 'blocked', label: 'Blokeret' },
      { emoji: '\uD83C\uDF30', name: 'Tr\u00e6n\u00f8dder', state: '', label: 'Tilladt' },
      { emoji: '\uD83E\uDD5B', name: 'M\u00e6lk', state: '', label: 'Tilladt' },
      { emoji: '\uD83C\uDF3E', name: 'Gluten', state: 'warn', label: 'Advarsel' },
      { emoji: '\uD83E\uDD5A', name: '\u00c6g', state: '', label: 'Tilladt' },
      { emoji: '\uD83D\uDC1F', name: 'Fisk', state: '', label: 'Tilladt' },
      { emoji: '\uD83E\uDD90', name: 'Skaldyr', state: '', label: 'Tilladt' },
      { emoji: '\uD83C\uDF3F', name: 'Sesam', state: '', label: 'Tilladt' },
      { emoji: '\uD83E\uDED8', name: 'Soja', state: '', label: 'Tilladt' },
    ];
    const allergenGrid = allergenItems.map(a =>
      `<div class="allergen-item${a.state ? ' ' + a.state : ''}" data-allergen><span class="allergen-emoji">${a.emoji}</span><span class="allergen-name">${a.name}</span><span class="allergen-status">${a.label}</span></div>`
    ).join('');

    const allergensContent = `
      <p style="font-size:12px;color:var(--ink-muted);margin-bottom:var(--s2)">Tryk for at skifte: Tilladt \u2192 Advarsel \u2192 Blokeret</p>
      <div class="allergen-grid">${allergenGrid}</div>
      <p class="disclaimer">Ingrediens- og allergenoplysninger i systemet er vejledende og kan indeholde fejl eller mangler, da produkter og opskrifter l\u00f8bende \u00e6ndres af personalet. Institutionen og systemet kan ikke garantere fuldst\u00e6ndig korrekthed. For\u00e6ldre til b\u00f8rn med allergi b\u00f8r altid tale direkte med personalet.</p>`;
    const allergensSection = buildSection('section-allergens', '\uD83E\uDD5C', 'var(--caution-light)', 'Allergier & madbegr\u00e6nsninger', 'Tryk for at \u00e6ndre status', allergensContent);

    return `
    <div class="tab-view" id="tab-limits">
      <div class="view-header mobile-only"><div class="view-title">Gr\u00e6nser & Kost</div><div class="view-subtitle">Indstillinger for ${_activeChild.name}</div></div>
      ${spendingSection}
      ${productLimitsSection}
      ${sugarSection}
      ${dietSection}
      ${allergensSection}
    </div>`;
  }

  // ═══════════════════════════════════
  // TAB: SCREEN TIME
  // ═══════════════════════════════════

  function buildTabScreen(settings) {
    const stChartDisabled = !isFeatureOn(SIDEBAR_NAV.find(n => n.id === 'section-st-chart'), settings);

    // Screentime section
    const screenAdminField = buildAdminField('Institutionens sk\u00e6rmtidsregler', `
      <div class="setting-row" style="padding-top:0">
        <div class="setting-info"><div class="setting-label">Daglig gr\u00e6nse</div></div>
        <div style="display:flex;align-items:center;gap:var(--s2)"><input type="number" class="input-field input" value="60" style="width:70px" data-admin-setting="st_daily_limit"><span style="font-size:13px;color:var(--ink-muted)">min</span></div>
      </div>
      <div class="setting-row">
        <div class="setting-info"><div class="setting-label">Maks pr. session</div></div>
        <div style="display:flex;align-items:center;gap:var(--s2)"><input type="number" class="input-field input" value="30" style="width:70px" data-admin-setting="st_max_session"><span style="font-size:13px;color:var(--ink-muted)">min</span></div>
      </div>
    `);

    const screentimeContent = `
      <div class="screentime-overview">
        <div class="st-stat-card remaining"><div class="st-stat-value">25 min</div><div class="st-stat-label">Tilbage i dag</div></div>
        <div class="st-stat-card used"><div class="st-stat-value">35 min</div><div class="st-stat-label">Brugt i dag</div></div>
      </div>
      <div class="hint-box info" style="margin-bottom:var(--s3)"><span class="hint-icon">\uD83D\uDCCB</span><span>Institutionens regler: 60 min/dag, maks 30 min pr. session</span></div>
      ${screenAdminField}
      ${buildSettingRow('Personlig daglig gr\u00e6nse', 'Kan ikke overstige institutionens regler', buildStepper('45'))}
      ${buildSettingRow('Maks pr. session', 'Hvor lang tid ad gangen (minutter)', buildStepper('25'))}
      ${buildSettingRow('Samtykke til forl\u00e6nget spilletid', 'Giv personalet lov til undtagelsesvis at forl\u00e6nge. Udl\u00f8ser ikke automatisk forl\u00e6ngelse.', buildToggle(null, true))}`;
    const screentimeSection = buildSection('section-screentime', '\uD83D\uDD79\uFE0F', 'var(--info-light)', 'Daglig spilletid', 'Gr\u00e6nser og samtykke', screentimeContent);

    // Games section
    const gamesContent = `
      <div class="game-row"><div class="game-icon">\uD83C\uDFAE</div><div class="game-info"><div class="game-name">Roblox</div><div class="game-platform">PC + Konsol</div></div>${buildToggle(null, true)}</div>
      <div class="game-row"><div class="game-icon">\u26CF\uFE0F</div><div class="game-info"><div class="game-name">Minecraft</div><div class="game-platform">PC</div></div>${buildToggle(null, true)}</div>
      <div class="game-row"><div class="game-icon">\u26BD</div><div class="game-info"><div class="game-name">FC 25</div><div class="game-platform">Konsol</div></div>${buildToggle(null, false)}</div>
      <div class="game-row"><div class="game-icon">\uD83D\uDD2B</div><div class="game-info"><div class="game-name">Fortnite</div><div class="game-blocked">Blokeret af institutionen</div></div><label class="toggle" style="opacity:.4;pointer-events:none"><input type="checkbox" disabled><span class="toggle-track"></span></label></div>`;
    const gamesSection = buildSection('section-games', '\uD83C\uDFAE', 'var(--positive-light)', 'Godkend spil', 'V\u00e6lg hvilke spil ${_activeChild.name} m\u00e5 spille', gamesContent);

    // Screen time chart section
    const stChartContent = `
      <div class="st-chart-controls">
        <div class="period-toggle" data-toggle-group="st-type">
          <button class="period-btn active">Stationer</button><button class="period-btn">Spil</button>
        </div>
        <div class="period-toggle" data-toggle-group="st-period">
          <button class="period-btn">Alt</button><button class="period-btn active">30 dage</button><button class="period-btn">7 dage</button>
        </div>
      </div>
      <div class="st-chart-total">Samlet spilletid: <strong>480 min</strong></div>
      <div style="display:flex;justify-content:flex-end;margin-bottom:var(--s2)">
        <div class="chart-view-toggle" id="st-view-toggle">
          <button class="chart-view-btn active" data-view="bars">\u2630 Liste</button>
          <button class="chart-view-btn" data-view="pills">\uD83D\uDCCA S\u00f8jler</button>
        </div>
      </div>
      <div id="st-bars-view">
        <div id="st-product-bars">
          <div class="product-bar-row"><div class="product-bar-label">\uD83D\uDDA5\uFE0F PC 1</div><div class="product-bar-track"><div class="product-bar-fill c1" style="width:75%"><span class="product-bar-value">180 min</span></div></div></div>
          <div class="product-bar-row"><div class="product-bar-label">\uD83D\uDDA5\uFE0F PC 2</div><div class="product-bar-track"><div class="product-bar-fill c2" style="width:56%"><span class="product-bar-value">135 min</span></div></div></div>
          <div class="product-bar-row"><div class="product-bar-label">\uD83C\uDFAE Konsol 1</div><div class="product-bar-track"><div class="product-bar-fill c3" style="width:42%"><span class="product-bar-value">100 min</span></div></div></div>
          <div class="product-bar-row"><div class="product-bar-label">\uD83C\uDFAE Konsol 2</div><div class="product-bar-track"><div class="product-bar-fill c4" style="width:27%"><span class="product-bar-value">65 min</span></div></div></div>
        </div>
      </div>
      <div id="st-pills-view" style="display:none">
        <div class="pill-chart-container">
          <div class="pill-col"><div class="pill-bar-wrap"><div class="pill-value">180</div><div class="pill-bar c1" style="height:150px"></div></div><div class="pill-icon">\uD83D\uDDA5\uFE0F</div><div class="pill-name">PC 1</div></div>
          <div class="pill-col"><div class="pill-bar-wrap"><div class="pill-value">135</div><div class="pill-bar c2" style="height:110px"></div></div><div class="pill-icon">\uD83D\uDDA5\uFE0F</div><div class="pill-name">PC 2</div></div>
          <div class="pill-col"><div class="pill-bar-wrap"><div class="pill-value">100</div><div class="pill-bar c3" style="height:85px"></div></div><div class="pill-icon">\uD83C\uDFAE</div><div class="pill-name">Konsol 1</div></div>
          <div class="pill-col"><div class="pill-bar-wrap"><div class="pill-value">65</div><div class="pill-bar c4" style="height:55px"></div></div><div class="pill-icon">\uD83C\uDFAE</div><div class="pill-name">Konsol 2</div></div>
        </div>
      </div>`;
    const stChartSection = buildSection('section-st-chart', '\uD83D\uDCCA', 'var(--purple-light)', 'Spilletidsoversigt', 'Fordeling af spilletid', stChartContent, { disabled: stChartDisabled });

    return `
    <div class="tab-view" id="tab-screen">
      <div class="view-header mobile-only"><div class="view-title">Sk\u00e6rmtid</div><div class="view-subtitle">Gaming-regler for ${_activeChild.name}</div></div>
      ${screentimeSection}
      ${gamesSection}
      ${stChartSection}
    </div>`;
  }

  // ═══════════════════════════════════
  // TAB: PROFILE
  // ═══════════════════════════════════

  function buildTabProfile(settings, institutionName) {
    const instName = institutionName || 'Stampen SFO';

    // Notifications
    const notifContent = `
      ${buildSettingRow('N\u00e5r saldoen er 0 kr', 'F\u00e5 besked n\u00e5r saldoen er opbrugt', buildToggle(null, true))}
      ${buildSettingRow('N\u00e5r saldoen er 10 kr eller under', 'Advarsel f\u00f8r saldoen l\u00f8ber t\u00f8r', buildToggle(null, true))}
      <div class="newsletter-box">
        <div class="newsletter-text"><div class="newsletter-title">\uD83D\uDCEC Nyhedsbrev</div><div class="newsletter-desc">Bliv informeret om nye funktioner og opdateringer</div></div>
        ${buildToggle(null, false)}
      </div>`;
    const notifSection = buildSection('section-notifications', '\uD83D\uDCE7', 'var(--info-light)', 'E-mail notifikationer', 'F\u00e5 besked om lav saldo', notifContent);

    // Feedback
    const feedbackContent = `
      <div class="feedback-tabs" id="feedback-tabs">
        <button class="feedback-tab active" data-target="fb-club">\uD83C\uDFEB Til klubben</button>
        <button class="feedback-tab" data-target="fb-flango">\uD83C\uDF4A Til Flango</button>
      </div>
      <div class="feedback-panel" id="fb-club">
        <p style="font-size:13px;color:var(--ink-soft);margin-bottom:var(--s3)">Send en besked direkte til ${instName}.</p>
        <div class="feedback-type-chips">
          <button class="chip active">\uD83D\uDCAC Generelt</button>
          <button class="chip">\u2753 Sp\u00f8rgsm\u00e5l</button>
          <button class="chip">\uD83D\uDCA1 Forslag</button>
        </div>
        <textarea class="feedback-textarea input" placeholder="Skriv din besked her\u2026" rows="4"></textarea>
        <button class="save-btn full">Send til klubben</button>
      </div>
      <div class="feedback-panel" id="fb-flango" style="display:none">
        <p style="font-size:13px;color:var(--ink-soft);margin-bottom:var(--s3)">Hj\u00e6lp os med at g\u00f8re Flango bedre \u2014 eller rapport\u00e9r en fejl.</p>
        <div class="feedback-type-chips">
          <button class="chip active">\uD83D\uDC1B Rapport\u00e9r fejl</button>
          <button class="chip">\uD83D\uDCA1 Foresl\u00e5 forbedring</button>
          <button class="chip">\uD83D\uDCAC Andet</button>
        </div>
        <textarea class="feedback-textarea input" placeholder="Beskriv problemet eller din id\u00e9\u2026" rows="4"></textarea>
        <div class="hint-box neutral" style="margin-bottom:var(--s3)"><span class="hint-icon">\uD83D\uDD12</span><span>Din besked sendes anonymt medmindre du v\u00e6lger at inkludere din e-mail.</span></div>
        ${buildSettingRow('Inkluder min e-mail', 'S\u00e5 vi kan svare dig', buildToggle(null, false))}
        <button class="save-btn full">Send til Flango</button>
      </div>`;
    const feedbackSection = buildSection('section-feedback', '\uD83D\uDCAC', 'var(--flango-light)', 'Feedback & Support', 'Skriv til klubben eller Flango', feedbackContent);

    // Change PIN
    const pinContent = `
      <div style="display:flex;flex-direction:column;gap:var(--s2);margin-top:var(--s2)">
        <input type="password" class="input-field input" placeholder="Ny adgangskode (mindst 4 tegn)">
        <input type="password" class="input-field input" placeholder="Gentag ny adgangskode">
        <button class="save-btn full" style="margin-top:var(--s1)">Gem ny adgangskode</button>
      </div>`;
    const pinSection = buildSection('section-pin', '\uD83D\uDD11', 'var(--surface-sunken)', 'Skift adgangskode', 'Minimum 6 tegn', pinContent);

    // Profile pictures section
    const ppDisabled = !isFeatureOn(SIDEBAR_NAV.find(n => n.id === 'section-profile-pictures'), settings);
    const ppTypes = Array.isArray(settings && settings.profile_picture_types) ? settings.profile_picture_types : ['upload', 'camera', 'library'];
    const ppAulaOn = ppTypes.indexOf('upload') !== -1;
    const ppCameraOn = ppTypes.indexOf('camera') !== -1;
    const ppAiOn = !settings || settings.profile_pictures_ai_enabled !== false;
    const ppAiOpenAiOn = !settings || settings.ai_provider_openai !== false;
    const ppAiFluxOn = settings && settings.ai_provider_flux === true;
    const ppContent = `
      <div class="hint-box blue" style="margin-bottom:var(--s3)"><span class="hint-icon">\u2139\uFE0F</span><span>Institutionen kan bruge profilbilleder i caf\u00e9en for at bekr\u00e6fte dit barns identitet ved k\u00f8b. Billedet er kun synligt for b\u00f8rn og personale i denne institution.</span></div>
      <div style="border-bottom:1px solid var(--border-color, #e5e7eb);padding-bottom:12px;margin-bottom:8px">
        ${buildSettingRow('<strong>Tillad profilbilleder</strong>', 'Sl\u00e5 fra for at frav\u00e6lge alle billedtyper p\u00e5 \u00e9n gang', buildToggle(null, true))}
      </div>
      <div class="admin-field" data-pp-types-group>
        <div class="admin-field-label">Tilgængelige typer (admin)</div>
        ${buildSettingRow('Aula-profilbillede', 'Institutionen kan bruge dit barns eksisterende Aula-foto som profilbillede i caf\u00e9en. Billedet kopieres til Flango og vises ved k\u00f8b.', '<label class="toggle"><input type="checkbox" data-pp-type="upload"' + (ppAulaOn ? ' checked' : '') + '><span class="toggle-track"></span></label>')}
        ${buildSettingRow('Kamera-foto', 'Personalet kan tage et foto af dit barn med caf\u00e9ens enhed. Billedet bruges kun til identifikation ved k\u00f8b og opbevares krypteret i EU.', '<label class="toggle"><input type="checkbox" data-pp-type="camera"' + (ppCameraOn ? ' checked' : '') + '><span class="toggle-track"></span></label>')}
        ${buildSettingRow('AI-genereret avatar', 'Et foto af dit barn bruges til at generere en tegnet avatar i animationsstil. Fotoet sendes til en AI-tjeneste, avataren returneres, og fotoet slettes straks. Kun avataren gemmes.', '<label class="toggle"><input type="checkbox" data-admin-setting="profile_pictures_ai_enabled" data-pp-ai-master' + (ppAiOn ? ' checked' : '') + '><span class="toggle-track"></span></label>')}
        <div data-pp-ai-providers style="margin-left:var(--s4);padding-left:var(--s3);border-left:2px solid var(--border-color, #e5e7eb);margin-top:var(--s2);${ppAiOn ? '' : 'display:none'}">
          ${buildSettingRow('AI: OpenAI', 'OpenAI DALL\u00B7E \u2014 USA', '<label class="toggle"><input type="checkbox" data-admin-setting="ai_provider_openai"' + (ppAiOpenAiOn ? ' checked' : '') + '><span class="toggle-track"></span></label>')}
          ${buildSettingRow('AI: FLUX', 'Black Forest Labs, FLUX 2 \u2014 Tyskland', '<label class="toggle"><input type="checkbox" data-admin-setting="ai_provider_flux"' + (ppAiFluxOn ? ' checked' : '') + '><span class="toggle-track"></span></label>')}
        </div>
      </div>`;
    const ppSection = buildSection('section-profile-pictures', '\uD83D\uDCF7', '#e0e7ff', 'Profilbilleder', 'Samtykke til billeder i caf\u00e9en', ppContent, { disabled: ppDisabled });

    return `
    <div class="tab-view" id="tab-profile">
      <div class="view-header mobile-only"><div class="view-title">Profil</div><div class="view-subtitle">Indstillinger & notifikationer</div></div>
      ${notifSection}
      ${ppSection}
      ${feedbackSection}
      ${pinSection}
    </div>`;
  }

  // ═══════════════════════════════════
  // BOTTOM NAV (mobile)
  // ═══════════════════════════════════

  function buildBottomNav() {
    return `
    <nav class="bottomnav">
      <button class="bnav-item active" data-tab="tab-home">${ICONS.home}<span class="bnav-label">Overblik</span></button>
      <button class="bnav-item" data-tab="tab-pay">${ICONS.card}<span class="bnav-label">Indbetal</span></button>
      <button class="bnav-item" data-tab="tab-limits">${ICONS.shield}<span class="bnav-label">Gr\u00e6nser</span></button>
      <button class="bnav-item" data-tab="tab-screen">${ICONS.monitor}<span class="bnav-label">Sk\u00e6rmtid</span></button>
      <button class="bnav-item" data-tab="tab-profile">${ICONS.user}<span class="bnav-label">Profil</span></button>
    </nav>`;
  }

  // ═══════════════════════════════════
  // ADMIN SAVE BAR
  // ═══════════════════════════════════

  function buildSaveBar() {
    return `
    <div class="admin-save-bar" id="admin-save-bar">
      <span class="admin-unsaved">Du har ugemte \u00e6ndringer</span>
      <button class="discard-btn">Annuller</button>
      <button class="save-btn">\uD83D\uDCBE Gem \u00e6ndringer</button>
    </div>`;
  }

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════

  // Default fallback children for when no real users are available
  var FALLBACK_CHILDREN = [
    { id: 'oscar', name: 'Oscar', balance: 127.5, emoji: '\uD83E\uDD8A' },
    { id: 'alma', name: 'Alma', balance: 85, emoji: '\uD83D\uDC38' },
  ];

  // Active preview users (set in render, used by builders)
  var _previewChildren = FALLBACK_CHILDREN;
  var _activeChild = null;
  var _instName = 'Stampen SFO';

  function fmtBal(n) {
    return n.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kr';
  }
  function fmtBalShort(n) { return Math.round(n) + ' kr'; }

  function render(container, institutionSettings, institutionName, previewUsersArr, featureFlags) {
    const settings = institutionSettings || {};
    _instName = institutionName || 'Stampen SFO';
    _featureFlags = featureFlags || null;

    // Use real admin/test users if provided, otherwise fallback
    if (previewUsersArr && previewUsersArr.length > 0) {
      _previewChildren = previewUsersArr.map(function(u) {
        return { id: u.id, name: u.name, balance: u.balance, emoji: u.emoji || '\uD83D\uDC64' };
      });
    } else {
      _previewChildren = FALLBACK_CHILDREN;
    }
    _activeChild = _previewChildren[0];

    const html = `
      ${buildSidebar(settings, _instName)}
      ${buildTopNav()}
      <main class="main">
        ${buildTabHome(settings)}
        ${buildTabPay()}
        ${buildTabLimits()}
        ${buildTabScreen(settings)}
        ${buildTabProfile(settings, _instName)}
      </main>
      ${buildBottomNav()}
      ${buildSaveBar()}
    `;

    container.innerHTML = html;
  }

  // ─── Handler initialization ───

  function initHandlers(container, institutionSettings) {
    const settings = institutionSettings || {};

    // ── Section expand/collapse (event delegation) ──
    container.addEventListener('click', function (e) {
      const header = e.target.closest('.section-header');
      if (header) {
        // Don't toggle if clicking a checkbox inside the header
        if (e.target.closest('.sidebar-check')) return;
        const section = header.closest('.section');
        if (section) section.classList.toggle('open');
        return;
      }
    });

    // ── Mobile bottom nav tab switching ──
    container.addEventListener('click', function (e) {
      const navItem = e.target.closest('.bnav-item[data-tab]');
      if (!navItem) return;
      const tabId = navItem.dataset.tab;
      switchTab(container, tabId);
      // Update active state on bottom nav
      container.querySelectorAll('.bnav-item').forEach(b => b.classList.toggle('active', b === navItem));
    });

    // ── Balance card "Indbetal" button → tab-pay ──
    container.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-nav-tab]');
      if (!btn) return;
      const tabId = btn.dataset.navTab;
      switchTab(container, tabId);
      // Update bottom nav highlight
      container.querySelectorAll('.bnav-item').forEach(b =>
        b.classList.toggle('active', b.dataset.tab === tabId)
      );
    });

    // ── Quick actions → navigate to tab + scroll to section ──
    container.addEventListener('click', function (e) {
      const qa = e.target.closest('.qa-item[data-qa-scroll]');
      if (!qa) return;
      const targetTab = qa.dataset.qaTab;
      const targetSection = qa.dataset.qaScroll;
      if (targetTab) {
        switchTab(container, targetTab);
        container.querySelectorAll('.bnav-item').forEach(b =>
          b.classList.toggle('active', b.dataset.tab === targetTab)
        );
      }
      // Small delay to allow tab to render, then scroll
      setTimeout(function () {
        const sec = container.querySelector('#' + targetSection);
        if (sec) {
          sec.classList.add('open');
          sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
          sec.classList.add('highlight-flash');
          setTimeout(() => sec.classList.remove('highlight-flash'), 900);
        }
      }, 50);
    });

    // ── Desktop sidebar scroll-to-section ──
    container.addEventListener('click', function (e) {
      const navItem = e.target.closest('.sidebar-nav-item[data-scroll]');
      if (!navItem) return;
      // Don't scroll if clicking the checkbox
      if (e.target.closest('.sidebar-check')) return;
      const sectionId = navItem.dataset.scroll;
      const sec = container.querySelector('#' + sectionId);
      if (sec) {
        sec.classList.add('open');
        sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        sec.classList.add('highlight-flash');
        setTimeout(() => sec.classList.remove('highlight-flash'), 900);
      }
      // Update active state
      container.querySelectorAll('.sidebar-nav-item').forEach(n => n.classList.remove('active'));
      navItem.classList.add('active');
    });

    // ── Sidebar feature checkboxes ──
    container.addEventListener('change', function (e) {
      const check = e.target.closest('.sidebar-check[data-section]');
      if (!check) return;
      e.stopPropagation();
      const sectionId = check.dataset.section;
      const section = container.querySelector('#' + sectionId);
      const navItem = check.closest('.sidebar-nav-item');
      if (section) {
        section.classList.toggle('disabled', !check.checked);
      }
      if (navItem) {
        navItem.classList.toggle('feature-off', !check.checked);
      }
      showSaveBar(container);
    });

    // ── Preview toggle ──
    // The preview toggle is in the admin-bar (outside this container),
    // but we expose a method for external callers. Internally we also support
    // a preview button if rendered inside container.
    container.addEventListener('click', function (e) {
      const previewToggle = e.target.closest('.preview-toggle');
      if (!previewToggle) return;
      previewToggle.classList.toggle('active');
      document.body.classList.toggle('parent-preview');
    });

    // ── Save bar: show on admin field changes ──
    container.addEventListener('input', function (e) {
      if (e.target.closest('.admin-field')) {
        showSaveBar(container);
      }
    });
    container.addEventListener('change', function (e) {
      if (e.target.closest('.admin-field')) {
        showSaveBar(container);
      }
    });

    // ── Save bar buttons ──
    container.addEventListener('click', function (e) {
      if (e.target.closest('.admin-save-bar .discard-btn')) {
        hideSaveBar(container);
        return;
      }
      if (e.target.closest('.admin-save-bar .save-btn')) {
        saveSettings(container);
      }
    });

    // ── AI-master toggle: vis/skjul OpenAI/FLUX providers ──
    container.addEventListener('change', function (e) {
      const aiMaster = e.target.closest('input[data-pp-ai-master]');
      if (!aiMaster) return;
      const providers = container.querySelector('[data-pp-ai-providers]');
      if (providers) providers.style.display = aiMaster.checked ? '' : 'none';
    });

    // ── Period toggles (chip-style exclusive selection) ──
    container.addEventListener('click', function (e) {
      const btn = e.target.closest('.period-btn');
      if (!btn) return;
      const group = btn.closest('.period-toggle');
      if (!group) return;
      group.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });

    // ── Chip groups (exclusive selection within group) ──
    container.addEventListener('click', function (e) {
      const chip = e.target.closest('.chip-group .chip');
      if (!chip) return;
      const group = chip.closest('.chip-group');
      if (!group) return;
      group.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });

    // ── Feedback type chips (exclusive within .feedback-type-chips) ──
    container.addEventListener('click', function (e) {
      const chip = e.target.closest('.feedback-type-chips .chip');
      if (!chip) return;
      const group = chip.closest('.feedback-type-chips');
      if (!group) return;
      group.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });

    // ── Allergen cycling (Tilladt → Advarsel → Blokeret) ──
    container.addEventListener('click', function (e) {
      const item = e.target.closest('.allergen-item[data-allergen]');
      if (!item) return;
      const statusEl = item.querySelector('.allergen-status');
      if (!statusEl) return;

      if (item.classList.contains('blocked')) {
        item.classList.remove('blocked');
        statusEl.textContent = 'Tilladt';
      } else if (item.classList.contains('warn')) {
        item.classList.remove('warn');
        item.classList.add('blocked');
        statusEl.textContent = 'Blokeret';
      } else {
        item.classList.add('warn');
        statusEl.textContent = 'Advarsel';
      }
    });

    // ── Topup option selection ──
    container.addEventListener('click', function (e) {
      const option = e.target.closest('.topup-option');
      if (!option) return;
      const grid = option.closest('.topup-grid');
      if (!grid) return;
      grid.querySelectorAll('.topup-option').forEach(o => o.classList.remove('selected'));
      option.classList.add('selected');
    });

    // ── MobilePay QR toggle (show/hide) ──
    container.addEventListener('click', function (e) {
      const btn = e.target.closest('.topup-method-btn.mobilepay');
      if (!btn) return;
      const qrSection = container.querySelector('#mobilepay-qr-section');
      if (qrSection) {
        qrSection.style.display = qrSection.style.display === 'none' ? '' : 'none';
      }
    });

    // ── Feedback tabs ──
    container.addEventListener('click', function (e) {
      const tab = e.target.closest('.feedback-tab[data-target]');
      if (!tab) return;
      const tabContainer = tab.closest('.section-content') || container;
      // Update tab active state
      tab.closest('.feedback-tabs').querySelectorAll('.feedback-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      // Show/hide panels
      const targetId = tab.dataset.target;
      tabContainer.querySelectorAll('.feedback-panel').forEach(p => {
        p.style.display = p.id === targetId ? '' : 'none';
      });
    });

    // ── Chart view toggles (pills/bars) ──
    container.addEventListener('click', function (e) {
      const btn = e.target.closest('.chart-view-btn[data-view]');
      if (!btn) return;
      const toggle = btn.closest('.chart-view-toggle');
      if (!toggle) return;
      const toggleId = toggle.id;

      toggle.querySelectorAll('.chart-view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const view = btn.dataset.view;
      // Determine prefix from toggle id
      let prefix = '';
      if (toggleId === 'pp-view-toggle') prefix = 'pp';
      else if (toggleId === 'st-view-toggle') prefix = 'st';
      else return;

      const barsView = container.querySelector('#' + prefix + '-bars-view');
      const pillsView = container.querySelector('#' + prefix + '-pills-view');
      if (barsView) barsView.style.display = view === 'bars' ? '' : 'none';
      if (pillsView) pillsView.style.display = view === 'pills' ? '' : 'none';
    });

    // ── Event action buttons (Tilmeld → show payment popup) ──
    container.addEventListener('click', function (e) {
      const btn = e.target.closest('.event-action-btn');
      if (!btn || btn.classList.contains('registered')) return;
      const eventCard = btn.closest('.event-card');
      if (!eventCard) return;
      const payment = eventCard.nextElementSibling;
      if (payment && payment.classList.contains('event-payment')) {
        payment.style.display = payment.style.display === 'none' ? '' : 'none';
      }
    });

    // ── Event payment close buttons ──
    container.addEventListener('click', function (e) {
      const btn = e.target.closest('.event-pay-btn, .event-cancel-btn');
      if (!btn) return;
      const payment = btn.closest('.event-payment');
      if (payment) payment.style.display = 'none';
    });

    // ── Stepper buttons ──
    container.addEventListener('click', function (e) {
      const btn = e.target.closest('.stepper-btn');
      if (!btn) return;
      const stepper = btn.closest('.stepper');
      if (!stepper) return;
      const valEl = stepper.querySelector('.stepper-val');
      if (!valEl) return;

      const currentVal = valEl.textContent.trim();
      const isInfinity = currentVal === '\u221E';
      const isPlus = btn.textContent.trim() === '+';

      if (isInfinity) {
        if (!isPlus) {
          // Decrement from infinity → some high value (contextual, default 10)
          valEl.textContent = '10';
        }
        return;
      }

      let num = parseInt(currentVal, 10);
      if (isNaN(num)) num = 0;

      if (isPlus) {
        num++;
      } else {
        num = Math.max(0, num - 1);
      }
      valEl.textContent = num === 0 ? '\u221E' : String(num);
      showSaveBar(container);
    });

    // ── Desktop sidebar: IntersectionObserver for scroll tracking ──
    initSidebarScrollTracking(container);
  }

  // ─── Tab switching helper ───
  function switchTab(container, tabId) {
    container.querySelectorAll('.tab-view').forEach(tv => {
      tv.classList.toggle('active', tv.id === tabId);
    });
  }

  // ─── Save to database ───
  async function saveSettings(container) {
    // Build settings object from sidebar checkboxes
    var settings = {};
    SIDEBAR_NAV.forEach(function (nav) {
      if (!nav.check || !nav.settingKey) return;
      var checkbox = container.querySelector('.sidebar-check[data-section="' + nav.id + '"]');
      if (checkbox) {
        // parent_portal_payment er JSONB — brug { enabled: true/false }
        if (nav.settingKey === 'parent_portal_payment') {
          settings[nav.settingKey] = { enabled: checkbox.checked };
        } else {
          settings[nav.settingKey] = checkbox.checked;
        }
      }
    });

    // Read admin field inputs (data-admin-setting)
    container.querySelectorAll('.admin-field input[data-admin-setting]').forEach(function (input) {
      var key = input.dataset.adminSetting;
      if (input.type === 'checkbox') {
        settings[key] = input.checked;
      } else if (input.type === 'number') {
        settings[key] = input.value ? Number(input.value) : null;
      } else {
        settings[key] = input.value;
      }
    });

    // Read admin field textareas
    container.querySelectorAll('.admin-field textarea[data-admin-setting]').forEach(function (textarea) {
      settings[textarea.dataset.adminSetting] = textarea.value;
    });

    // Read profile_picture_types array from data-pp-type checkboxes
    var ppTypeNodes = container.querySelectorAll('input[data-pp-type]');
    if (ppTypeNodes.length > 0) {
      var ppTypes = [];
      ppTypeNodes.forEach(function (cb) {
        if (cb.checked) ppTypes.push(cb.dataset.ppType);
      });
      // Preserve 'library' (not exposed in admin-portal UI)
      if (ppTypes.indexOf('library') === -1) ppTypes.push('library');
      settings.profile_picture_types = ppTypes;
    }

    // Read contact phone fields
    var contactPhone = container.querySelector('#contact-phone');
    if (contactPhone) settings.institution_contact_phone = contactPhone.value;
    var contactToggle = container.querySelector('#contact-toggle');
    if (contactToggle) settings.institution_contact_phone_enabled = contactToggle.checked;

    // Try to save via PortalData
    var saveBtn = container.querySelector('.admin-save-bar .save-btn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Gemmer...';
    }

    try {
      if (typeof PortalData !== 'undefined' && typeof PortalData.saveInstitutionSettings === 'function') {
        // Separate screentime settings (skaermtid_*) from institution settings
        var instSettings = {};
        var stSettings = {};
        Object.keys(settings).forEach(function (key) {
          if (key.indexOf('skaermtid_') === 0) {
            stSettings[key] = settings[key];
          } else {
            instSettings[key] = settings[key];
          }
        });

        // Save institution settings
        var instSuccess = await PortalData.saveInstitutionSettings(null, instSettings);

        // Save screentime settings if any
        var stSuccess = true;
        if (Object.keys(stSettings).length > 0 && typeof PortalData.saveScreentimeSettings === 'function') {
          stSuccess = await PortalData.saveScreentimeSettings(null, stSettings);
        }

        if (instSuccess && stSuccess) {
          hideSaveBar(container);
          showPortalToast('Indstillinger gemt', 'success');
        } else {
          showPortalToast('Nogle indstillinger kunne ikke gemmes', 'error');
        }
      } else {
        console.warn('[admin-portal-settings] PortalData.saveInstitutionSettings ikke tilgængelig');
        hideSaveBar(container);
        showPortalToast('Indstillinger gemt (demo-tilstand)', 'success');
      }
    } catch (err) {
      console.error('[admin-portal-settings] Fejl ved gem:', err);
      showPortalToast('Fejl: ' + (err.message || 'Ukendt fejl'), 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = '\uD83D\uDCBE Gem \u00e6ndringer';
      }
    }
  }

  function showPortalToast(message, type) {
    var existing = document.querySelector('.portal-toast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.className = 'portal-toast ' + (type || '');
    toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:' + (type === 'error' ? '#ef4444' : '#22c55e') + ';color:#fff;padding:10px 20px;border-radius:10px;font-size:14px;font-weight:600;z-index:100000;opacity:0;transition:opacity .2s';
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(function () { toast.style.opacity = '1'; });
    setTimeout(function () {
      toast.style.opacity = '0';
      setTimeout(function () { toast.remove(); }, 300);
    }, 2500);
  }

  // ─── Save bar helpers ───
  function showSaveBar(container) {
    const bar = container.querySelector('.admin-save-bar');
    if (bar) bar.classList.add('visible');
  }

  function hideSaveBar(container) {
    const bar = container.querySelector('.admin-save-bar');
    if (bar) bar.classList.remove('visible');
  }

  // ─── Sidebar IntersectionObserver ───
  function initSidebarScrollTracking(container) {
    const sections = container.querySelectorAll('.section[id], .balance-card[id]');
    if (!sections.length) return;

    // Only apply on desktop
    const mq = window.matchMedia('(min-width: 768px)');
    if (!mq.matches) return;

    const observer = new IntersectionObserver(function (entries) {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const sectionId = entry.target.id;
          container.querySelectorAll('.sidebar-nav-item[data-scroll]').forEach(n => {
            n.classList.toggle('active', n.dataset.scroll === sectionId);
          });
        }
      }
    }, {
      root: null,
      rootMargin: '-80px 0px -60% 0px',
      threshold: 0
    });

    sections.forEach(sec => observer.observe(sec));

    // Re-init on resize
    mq.addEventListener('change', function () {
      if (!mq.matches) {
        observer.disconnect();
      } else {
        sections.forEach(sec => observer.observe(sec));
      }
    });
  }

  // ─── Get settings state ───
  function getSettingsState(container) {
    const state = {
      features: {},
      adminFields: {}
    };

    // Read sidebar feature checkboxes
    container.querySelectorAll('.sidebar-check[data-section]').forEach(check => {
      state.features[check.dataset.section] = check.checked;
    });

    // Read admin field inputs
    container.querySelectorAll('.admin-field input[data-admin-setting]').forEach(input => {
      const key = input.dataset.adminSetting;
      if (input.type === 'checkbox') {
        state.adminFields[key] = input.checked;
      } else {
        state.adminFields[key] = input.value;
      }
    });

    // Read admin field textareas
    container.querySelectorAll('.admin-field textarea[data-admin-setting]').forEach(textarea => {
      state.adminFields[textarea.dataset.adminSetting] = textarea.value;
    });

    // Read contact phone
    const contactPhone = container.querySelector('#contact-phone');
    if (contactPhone) state.adminFields.contact_phone = contactPhone.value;

    const contactToggle = container.querySelector('#contact-toggle');
    if (contactToggle) state.adminFields.contact_enabled = contactToggle.checked;

    // Read allergen states
    const allergens = {};
    container.querySelectorAll('.allergen-item[data-allergen]').forEach(item => {
      const name = item.querySelector('.allergen-name');
      if (!name) return;
      let status = 'allow';
      if (item.classList.contains('blocked')) status = 'block';
      else if (item.classList.contains('warn')) status = 'warn';
      allergens[name.textContent.trim()] = status;
    });
    state.allergens = allergens;

    // Read stepper values
    const steppers = {};
    container.querySelectorAll('.stepper').forEach((stepper, idx) => {
      const val = stepper.querySelector('.stepper-val');
      if (val) steppers['stepper_' + idx] = val.textContent.trim();
    });
    state.steppers = steppers;

    // Read toggle states in non-admin sections
    const toggles = [];
    container.querySelectorAll('.section .toggle input[type="checkbox"]').forEach(input => {
      if (input.closest('.admin-field')) return; // skip admin-only toggles
      toggles.push(input.checked);
    });
    state.userToggles = toggles;

    return state;
  }

  // ─── Expose public API ───
  window.AdminPortalSettings = {
    render: render,
    initHandlers: initHandlers,
    getSettingsState: getSettingsState
  };

})();
