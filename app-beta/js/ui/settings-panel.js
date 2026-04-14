/**
 * Flango Settings Panel — Orchestrator
 * Fullscreen overlay with tabs, sidebar, content routing, dirty-tracking, save.
 * Exposes window.FlangoSettings.open() / .close()
 */

(function () {
  'use strict';

  // ── Tab / sidebar data (from mockup) ──
  const T = [
    { name: 'Hovedmenu', items: [{ l: 'Produkter & Indbetalinger', c: '#e8734a' }, { l: 'Tilmelding', c: '#5ba0d8' }, { l: 'Restaurant Mode', c: '#f4a261' }, { l: 'Historik', c: '#c77ddb' }] },
    { name: 'Institutionens Præferencer', items: [{ l: 'Toolbar', c: '#5ba0d8' }, { l: 'Beløbsgrænse', c: '#e8734a' }, { l: 'Sukkerpolitik', c: '#e85a6f' }] },
    { name: 'Administration', items: [{ l: 'Forældreportal', c: '#c77ddb' }, { l: 'Betalingsmetoder', c: '#5dca7a' }, { l: 'Profilbilleder', c: '#c77ddb' }, { l: 'Produktikoner – Deling', c: '#5ba0d8' }, { l: 'MobilePay CSV Import', c: '#f4a261' }, { l: 'Opret/Opdater brugere auto.', c: '#e8734a' }] },
    { name: 'Datasikkerhed', items: [{ l: 'Totrinsgodkendelse (MFA)', c: '#e85a6f' }, { l: 'Auto-sletning af inaktive', c: '#f4a261' }, { l: 'Mine enheder', c: '#5ba0d8' }, { l: 'Saldoliste ved låsning', c: '#5dca7a' }, { l: 'Anmod om nulstilling', c: '#c77ddb' }] },
    { name: 'Diverse', items: [{ l: 'Udseende', c: '#c77ddb' }, { l: 'Dagens Sortiment', c: '#f4a261' }, { l: 'Min Flango', c: '#e8734a' }, { l: 'Hjælp', c: '#5ba0d8' }, { l: 'Opdateringer', c: '#5dca7a' }, { l: 'Feedback', c: '#f4a261' }, { l: 'Lydindstillinger', c: '#5ba0d8' }, { l: 'Log ud', c: '#e85a6f' }] }
  ];

  // ── SVG icon paths (from mockup icons object) ──
  const icons = {
    'Produkter & Indbetalinger': '<rect x="3" y="3" width="4.5" height="4.5" rx="1"/><rect x="9.5" y="3" width="4.5" height="4.5" rx="1"/><rect x="3" y="9.5" width="4.5" height="4.5" rx="1"/><rect x="9.5" y="9.5" width="4.5" height="4.5" rx="1"/>',
    'Produktoversigt': '<rect x="3" y="3" width="4.5" height="4.5" rx="1"/><rect x="9.5" y="3" width="4.5" height="4.5" rx="1"/><rect x="3" y="9.5" width="4.5" height="4.5" rx="1"/><rect x="9.5" y="9.5" width="4.5" height="4.5" rx="1"/>',
    'Brugerpanel': '<circle cx="6" cy="5.5" r="2.5"/><path d="M1.5 14c0-2.5 2-4.5 4.5-4.5s4.5 2 4.5 4.5"/><path d="M11 7h4M13 5v4"/>',
    'Tilmelding': '<rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M2.5 7h11M5.5 1.5v3M10.5 1.5v3"/>',
    'Restaurant Mode': '<path d="M4 3v10"/><path d="M2.5 3v3c0 1 .7 1.7 1.5 1.7S5.5 7 5.5 6V3"/><path d="M11 3v5.5c0 .5.2.8.5 1h1c.3-.2.5-.5.5-1V4.5C13 3.5 12.2 3 11 3z"/><path d="M11.5 9.5V13"/>',
    'Historik': '<circle cx="8" cy="8" r="6"/><path d="M8 4.5v4l2.5 2"/>',
    'Toolbar': '<rect x="1.5" y="3" width="13" height="10" rx="2"/><path d="M1.5 6.5h13"/><circle cx="4" cy="4.7" r="0.7"/><circle cx="6.2" cy="4.7" r="0.7"/><circle cx="8.4" cy="4.7" r="0.7"/>',
    'Beløbsgrænse': '<circle cx="8" cy="8" r="6"/><path d="M8 4.5v7M5.5 6.5h5c.8 0 1.5.7 1.5 1.5s-.7 1.5-1.5 1.5H5.5"/>',
    'Sukkerpolitik': '<path d="M8 13.5S2 10 2 6a3 3 0 016-1 3 3 0 016 1c0 4-6 7.5-6 7.5z"/>',
    'Forældreportal': '<circle cx="8" cy="4.5" r="2.5"/><path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5"/><path d="M8 10v4M6 12h4"/>',
    'Betalingsmetoder': '<rect x="1.5" y="4" width="13" height="8.5" rx="1.5"/><path d="M1.5 7.5h13"/><rect x="3.5" y="9.5" width="4" height="1.5" rx="0.5"/>',
    'Profilbilleder': '<rect x="2" y="2" width="12" height="12" rx="2"/><circle cx="6" cy="6.5" r="2"/><path d="M2 13c1-2.5 3-4 4-4s2 .8 3.5 2c1 .8 2.2 1.5 3.5 2"/>',
    'Produktikoner – Deling': '<circle cx="11.5" cy="3.5" r="2"/><circle cx="3.5" cy="8" r="2"/><circle cx="11.5" cy="12.5" r="2"/><path d="M5.3 7l4.4-2.5M5.3 9l4.4 2.5"/>',
    'MobilePay CSV Import': '<path d="M8 10V2.5M5 5l3-3 3 3"/><rect x="2" y="10" width="12" height="4" rx="1.5"/>',
    'Opret/Opdater brugere auto.': '<path d="M2 8a6 6 0 0110.5-4M14 8a6 6 0 01-10.5 4"/><path d="M12 1.5V4.5h-3"/><path d="M4 14.5V11.5h3"/>',
    'Totrinsgodkendelse (MFA)': '<rect x="4" y="7" width="8" height="7" rx="1.5"/><path d="M6 7V5a2 2 0 014 0v2"/><circle cx="8" cy="10.5" r="1"/>',
    'Auto-sletning af inaktive': '<path d="M3 4.5h10"/><path d="M5.5 4.5V3.5a1 1 0 011-1h3a1 1 0 011 1v1"/><path d="M4.5 4.5v8a1.5 1.5 0 001.5 1.5h4a1.5 1.5 0 001.5-1.5v-8"/>',
    'Mine enheder': '<rect x="4" y="1.5" width="8" height="13" rx="1.5"/><path d="M7 12.5h2"/>',
    'Saldoliste ved låsning': '<path d="M3 4h10M3 7h8M3 10h6M3 13h9"/>',
    'Anmod om nulstilling': '<path d="M2 8a6 6 0 0110.5-4"/><path d="M12 1.5V4.5h-3"/><circle cx="8" cy="8" r="1.5"/>',
    'Udseende': '<circle cx="8" cy="8" r="6"/><path d="M8 2a6 6 0 000 12" fill="currentColor" opacity="0.3"/>',
    'Dagens Sortiment': '<path d="M8 1.5l2 4 4.5.7-3.2 3.1.8 4.4L8 11.5l-4.1 2.2.8-4.4L1.5 6.2 6 5.5z"/>',
    'Min Flango': '<circle cx="8" cy="5" r="3"/><path d="M2.5 14.5c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5"/>',
    'Hjælp': '<circle cx="8" cy="8" r="6"/><path d="M6 6.5a2 2 0 013.5 1.5c0 1.5-1.5 1.5-1.5 3"/><circle cx="8" cy="12.5" r="0.5"/>',
    'Opdateringer': '<path d="M2 8a6 6 0 0110.5-4M14 8a6 6 0 01-10.5 4"/><path d="M12 1.5V4.5h-3"/><path d="M4 14.5V11.5h3"/>',
    'Feedback': '<circle cx="8" cy="9.5" r="4.5"/><path d="M8 5V2M3.5 7.5L1 6.5M12.5 7.5L15 6.5"/><path d="M8 8v2.5"/>',
    'Lydindstillinger': '<path d="M2 6.5h2l3.5-3.5v10L4 9.5H2z"/><path d="M11 5.5a4 4 0 010 5M13 3.5a7 7 0 010 9"/>',
    'Log ud': '<path d="M9.5 14H4.5a1.5 1.5 0 01-1.5-1.5v-9A1.5 1.5 0 014.5 2h5"/><path d="M7 8h7M12 5.5L14.5 8 12 10.5"/>'
  };

  const tabIcons = [
    '<rect x="3" y="3" width="4" height="4" rx="1"/><rect x="9" y="3" width="4" height="4" rx="1"/><rect x="3" y="9" width="4" height="4" rx="1"/><rect x="9" y="9" width="4" height="4" rx="1"/>',
    '<line x1="3" y1="4" x2="13" y2="4"/><circle cx="9.5" cy="4" r="1.5"/><line x1="3" y1="8" x2="13" y2="8"/><circle cx="5.5" cy="8" r="1.5"/><line x1="3" y1="12" x2="13" y2="12"/><circle cx="10.5" cy="12" r="1.5"/>',
    '<rect x="2" y="2" width="12" height="12" rx="2"/><path d="M6 6h4M6 8.5h3M6 11h2"/>',
    '<path d="M8 2L3 5v4c0 3.5 2 6 5 7 3-1 5-3.5 5-7V5z"/>',
    '<circle cx="4.5" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="11.5" cy="8" r="1.5"/>'
  ];

  // ── External link SVG for Historik / Min Flango ──
  const extLinkSvg = (color) => `<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="${color}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;opacity:0.6"><path d="M6 3H3v10h10v-3"/><path d="M9 2h5v5"/><path d="M14 2L7 9"/></svg>`;

  // ── State ──
  let overlay = null;
  let at = 0;   // active tab
  let ai = 0;   // active sidebar item
  let rmActive = false;
  let mpCsvOn = false;
  let institutionData = null;

  // ── Auto-save: gem enkelt felt direkte til DB ──
  let baselineSnapshot = {};

  async function saveField(key, value) {
    const instId = window.getInstitutionId?.();
    if (!instId) return;

    const client = window.__flangoSupabaseClient;
    if (!client) return;

    try {
      const { error } = await client
        .from('institutions')
        .update({ [key]: value })
        .eq('id', instId);

      if (error) throw error;

      // Update local state
      baselineSnapshot[key] = value;
      if (institutionData) institutionData[key] = value;
      const cachedInst = window.__flangoGetInstitutionById?.(instId);
      if (cachedInst) cachedInst[key] = value;

      // Special-case: restaurant_mode_enabled → update header
      if (key === 'restaurant_mode_enabled') {
        rmActive = !!value;
        const badge = document.getElementById('restaurant-mode-badge');
        if (badge) badge.style.display = rmActive ? '' : 'none';
        const kitchenBtn = document.getElementById('kitchen-btn');
        if (kitchenBtn) kitchenBtn.style.display = rmActive ? '' : 'none';
      }
    } catch (e) {
      console.error(`[FlangoSettings] Save error for ${key}:`, e);
    }
  }

  // Batch save multiple fields at once (for mini Gem-knap sections)
  async function saveFields(updates) {
    const instId = window.getInstitutionId?.();
    if (!instId) return;

    const client = window.__flangoSupabaseClient;
    if (!client) return;

    try {
      const { error } = await client
        .from('institutions')
        .update(updates)
        .eq('id', instId);

      if (error) throw error;

      for (const [key, value] of Object.entries(updates)) {
        baselineSnapshot[key] = value;
        if (institutionData) institutionData[key] = value;
      }
      const cachedInst = window.__flangoGetInstitutionById?.(instId);
      if (cachedInst) Object.assign(cachedInst, updates);

      if ('restaurant_mode_enabled' in updates) {
        rmActive = !!updates.restaurant_mode_enabled;
        const badge = document.getElementById('restaurant-mode-badge');
        if (badge) badge.style.display = rmActive ? '' : 'none';
        const kitchenBtn = document.getElementById('kitchen-btn');
        if (kitchenBtn) kitchenBtn.style.display = rmActive ? '' : 'none';
      }
    } catch (e) {
      console.error('[FlangoSettings] Batch save error:', e);
    }
  }

  // Backward compat: markDirty now auto-saves (used by wireToggles etc.)
  function markDirty(key, value) {
    saveField(key, value);
  }

  // ── SVG helpers ──
  function ic(label, color) {
    return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="${color}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">${icons[label] || '<circle cx="8" cy="8" r="4"/>'}</svg>`;
  }

  function bigIc(label, color) {
    return `<svg width="84" height="84" viewBox="0 0 16 16" fill="none" stroke="${color}" stroke-width="0.6" stroke-linecap="round" stroke-linejoin="round">${icons[label] || '<circle cx="8" cy="8" r="4"/>'}</svg>`;
  }

  // ── Trigger items (sidebar click → external action, no content) ──
  const TRIGGERS = {
    'Historik': () => {
      if (window.__flangoOpenHistorikV3ForUser) { window.__flangoOpenHistorikV3ForUser(''); }
      else { import('./historik-v3.js').then(m => m.openHistorikV3()).catch(() => {}); }
    },
    'Min Flango': () => window.__flangoOpenAvatarPicker?.(),
    'Dagens Sortiment': () => window.__flangoOpenAssortmentModal?.(),
    'Log ud': () => {
      close();
      const btn = document.getElementById('logout-btn');
      if (btn) btn.click();
    }
  };

  // ── Load institution state for sidebar conditionals ──
  async function loadInstitutionState() {
    baselineSnapshot = {};
    try {
      const instId = window.getInstitutionId?.();
      if (instId) {
        // Hent frisk institutions-data fra DB (ikke cache) så ændringer fra super-admin vises
        const client = window.__flangoSupabaseClient;
        if (client) {
          const { data: freshInst } = await client.from('institutions').select('*').eq('id', instId).single();
          if (freshInst) {
            institutionData = freshInst;
            // Opdater også in-memory cache
            if (window.__flangoGetAllInstitutions) {
              const allInst = window.__flangoGetAllInstitutions();
              const idx = allInst.findIndex(i => String(i.id) === String(instId));
              if (idx >= 0) Object.assign(allInst[idx], freshInst);
            }
          } else {
            institutionData = window.__flangoGetInstitutionById?.(instId);
          }
        } else {
          institutionData = window.__flangoGetInstitutionById?.(instId);
        }
        if (institutionData) {
          rmActive = !!institutionData.restaurant_mode_enabled;
          // Check mpCsvOn from payment config
          const paymentConfig = institutionData.parent_portal_payment;
          if (paymentConfig && typeof paymentConfig === 'object') {
            mpCsvOn = !!paymentConfig.mobilepay_csv;
          } else {
            mpCsvOn = false;
          }
          // Build baseline snapshot of all settings fields
          baselineSnapshot = Object.assign({}, institutionData);
        }
        // Load feature flags for lock-state display
        if (typeof window.PortalData?.getFeatureFlags === 'function') {
          try {
            window.__flangoFeatureFlags = await window.PortalData.getFeatureFlags(instId);
            console.log('[FlangoSettings] Feature flags loaded:', window.__flangoFeatureFlags);
          } catch (_e) {
            console.warn('[FlangoSettings] Could not load feature flags:', _e);
          }
        }
      }
    } catch (e) {
      console.warn('[FlangoSettings] Could not load institution state:', e);
    }
  }

  // ── Build overlay DOM ──
  function buildOverlay() {
    const el = document.createElement('div');
    el.className = 'fsp-overlay';
    el.innerHTML = `
      <div class="fsp-hdr">
        <div class="fsp-hdr-left">
          <div class="fsp-hdr-logo"><img src="Icons/webp/Assets/FlangoFruitLogo.webp" alt="Flango"></div>
          <div><h1>Indstillinger</h1><div class="fsp-hdr-sub">Flango Caf\u00e9</div></div>
        </div>
        <button class="fsp-close-btn" data-action="close">
          <svg width="15" height="15" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 3l8 8M11 3l-8 8"/></svg>
        </button>
      </div>
      <div class="fsp-main">
        <div class="fsp-side">
          <div class="fsp-side-hdr">
            <div class="fsp-side-hdr-dot"></div>
            <div class="fsp-side-hdr-text" id="fsp-side-label"></div>
          </div>
          <div class="fsp-side-items" id="fsp-sidebar"></div>
          <div class="fsp-side-back">
            <button data-action="close">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3L5 8l5 5"/></svg>
              Tilbage
            </button>
          </div>
        </div>
        <div class="fsp-right">
          <div class="fsp-tabs" id="fsp-tabs"></div>
          <div class="fsp-content" id="fsp-content"></div>
          <div class="fsp-slide-overlay" id="fsp-slide-overlay"></div>
          <div class="fsp-slide-panel" id="fsp-slide-panel"></div>
        </div>
      </div>`;
    return el;
  }

  // ── Render tabs + sidebar + content ──
  function render() {
    if (!overlay) return;

    // Tabs
    const tabsEl = overlay.querySelector('#fsp-tabs');
    tabsEl.innerHTML = '';
    T.forEach((t, i) => {
      const btn = document.createElement('button');
      btn.className = 'fsp-tab' + (i === at ? ' active' : '');
      btn.innerHTML = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="${i === at ? '#fff' : 'currentColor'}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">${tabIcons[i]}</svg>${t.name}`;
      btn.addEventListener('click', () => { at = i; ai = 0; render(); });
      tabsEl.appendChild(btn);
    });

    // Sidebar header
    overlay.querySelector('#fsp-side-label').textContent = T[at].name;

    // Sidebar items
    const sb = overlay.querySelector('#fsp-sidebar');
    sb.innerHTML = '';
    T[at].items.forEach((it, j) => {
      const d = document.createElement('div');
      d.className = 'fsp-si' + (j === ai ? ' active' : '');

      let extra = '';
      // Green dot for Restaurant Mode when active
      if (at === 0 && j === 2 && rmActive) extra += '<div class="fsp-si-dot"></div>';
      // External link icon for Historik and Min Flango
      if (it.l === 'Historik' || it.l === 'Min Flango') {
        extra += extLinkSvg(j === ai ? 'var(--fsp-txt)' : 'var(--fsp-txt3)');
      }

      const iconBg = j === ai ? it.c : it.c + '18';
      const iconColor = j === ai ? '#fff' : it.c;
      d.innerHTML = `<div class="fsp-si-icon" style="background:${iconBg}">${ic(it.l, iconColor)}</div><div class="fsp-si-text">${it.l}</div>${extra}`;

      // Hide MobilePay CSV when mpCsvOn is false
      if (at === 2 && j === 4 && !mpCsvOn) d.style.display = 'none';

      d.addEventListener('click', () => {
        // Check if this is a trigger item
        const triggerFn = TRIGGERS[it.l];
        if (triggerFn) {
          triggerFn();
          return;
        }
        ai = j;
        render();
      });
      sb.appendChild(d);
    });

    // Content
    renderContent();
  }

  // ── Render content area ──
  function renderContent() {
    const ct = overlay.querySelector('#fsp-content');
    ct.style.alignItems = 'center';

    const sectionKey = T[at].items[ai]?.l;
    if (!sectionKey) {
      ct.innerHTML = renderPlaceholder('Ukendt sektion', '');
      return;
    }

    // Delegate to settings-sections.js if available
    if (window.FlangoSettingsSections?.render) {
      const ctx = {
        at, ai, rmActive, mpCsvOn, institutionData,
        ic, bigIc, overlay,
        markDirty, saveField, saveFields, baselineSnapshot,
        setRmActive: (val) => { rmActive = val; },
        setMpCsvOn: (val) => { mpCsvOn = val; },
        featureFlags: window.__flangoFeatureFlags || null,
      };
      const html = window.FlangoSettingsSections.render(sectionKey, ctx);
      if (html !== null) {
        ct.innerHTML = html;
        // Wire event handlers
        if (window.FlangoSettingsSections.wire) {
          window.FlangoSettingsSections.wire(sectionKey, ct, ctx);
        }
        // Apply feature flag locks (disable locked toggles)
        if (window.FlangoSettingsSections.applyFeatureLocks) {
          window.FlangoSettingsSections.applyFeatureLocks(ct, ctx);
        }
        return;
      }
    }

    // Fallback: placeholder
    ct.innerHTML = renderPlaceholder(sectionKey, T[at].items[ai]?.c || '#e8734a');
  }

  function renderPlaceholder(label, color) {
    return `<div class="fsp-ph">
      <div class="fsp-ph-ring">${ic(label, color || 'var(--fsp-txt3)')}</div>
      <div class="fsp-ph-title">${label}</div>
      <div class="fsp-ph-desc">Denne sektion implementeres snart.</div>
    </div>`;
  }

  // ── Open ──
  async function open() {
    if (overlay) return; // already open

    await loadInstitutionState();
    at = 0;
    ai = 0;
    overlay = buildOverlay();

    // Event delegation
    overlay.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="close"]');
      if (btn) { close(); return; }
    });

    // Escape key — cascade: warn → pay/reg → user-picker → slide → settings
    const onKey = (e) => {
      if (e.key === 'Escape') {
        // 1. Close class mismatch warning in user picker
        const warn = overlay?.querySelector('.fsp-up-warn.open');
        if (warn) { warn.classList.remove('open'); return; }
        // 2. Close pay/register confirmation modals (can be on top of user picker)
        const payOrReg = overlay?.querySelector('.fsp-pay-overlay.open, .fsp-reg-overlay.open, .fsp-rm-overlay.open');
        if (payOrReg) { payOrReg.classList.remove('open'); return; }
        // 3. Close user picker
        const upOverlay = overlay?.querySelector('.fsp-up-overlay.open');
        if (upOverlay) { upOverlay.classList.remove('open'); return; }
        // 4. Close slide panel if open
        const slideOverlay = overlay?.querySelector('#fsp-slide-overlay');
        if (slideOverlay?.classList.contains('open')) {
          slideOverlay.classList.remove('open');
          overlay.querySelector('#fsp-slide-panel')?.classList.remove('open');
          return;
        }
        // 5. Close settings
        close();
      }
    };
    document.addEventListener('keydown', onKey);
    overlay._onKey = onKey;

    document.body.appendChild(overlay);
    render();
  }

  // ── Close ──
  function close() {
    if (!overlay) return;
    if (overlay._onKey) document.removeEventListener('keydown', overlay._onKey);
    overlay.remove();
    overlay = null;
  }

  // ── Public API ──
  window.FlangoSettings = { open, close, T, icons, ic, bigIc, tabIcons, extLinkSvg, markDirty, saveField, saveFields };

})();
