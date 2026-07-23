/**
 * admin-portal-preview-host.js — café-hosten for portal-preview (fase 2)
 *
 * Erstatter den håndbyggede portal-kopi (admin-portal-settings.js): preview'et
 * ER den rigtige, deployede forældreportal, indlejret i en iframe i admin-
 * preview-tilstand. Hosten ejer det admin-siden af protokollen (flango-preview/v1):
 *
 *   1. Session: henter admin-parent-tokens (window.__flangoGetAdminParentSession,
 *      samme flow som Simulatoren) og overleverer dem via postMessage ved
 *      portalens "ready" — aldrig via URL.
 *   2. Draft + gem-bar: chip-toggles fra portalen samles i et draft; "Gem"
 *      persisterer via PortalData (allow-list + superadmin-lock-filter uændret)
 *      og melder "saved" så portalen refetcher serverens sandhed.
 *   3. Locks: superadmin-låste kolonner (FeatureModules) sendes med i session-
 *      beskeden, så portalen kan disable chips med 🔒.
 *
 * Kontakttelefonen bor her (ikke i portalen): det er institutions-config, ikke
 * forældre-UI, og v2-fladen er dens eneste hjem efter mockens død.
 */
(function () {
  'use strict';

  const PROTOCOL_VERSION = 1;

  let containerEl = null;
  let iframeEl = null;
  let portalOrigin = null;
  let sessionTokens = null;
  let sessionDelivered = false;
  let draft = {};             // kolonne → bool (chip-toggles fra portalen)
  let contactDirty = false;   // kontaktfelterne følger samme gem-bar
  let messageListener = null;
  let savedSettings = null;   // institutionSettings ved mount (til kontaktfelter)

  function getPortalOrigin() {
    // tauri://localhost har OGSÅ hostname 'localhost' — desktop-appen skal på
    // prod-portalen, ikke dev-serveren. Kun ægte web-dev rammer localhost:3001.
    const isTauri = !!window.__TAURI_INTERNALS__;
    const h = window.location.hostname;
    return (!isTauri && (h === 'localhost' || h === '127.0.0.1'))
      ? 'http://localhost:3001'
      : 'https://flango.dk';
  }

  function getPortalPreviewUrl() {
    const origin = getPortalOrigin();
    return origin === 'https://flango.dk'
      ? origin + '/forældre/?admin_preview=1'
      : origin + '/?admin_preview=1';
  }

  function esc(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function post(msg) {
    if (!iframeEl || !iframeEl.contentWindow || !portalOrigin) return;
    iframeEl.contentWindow.postMessage({ ...msg, v: PROTOCOL_VERSION }, portalOrigin);
  }

  function isDirty() {
    return Object.keys(draft).length > 0 || contactDirty;
  }

  function updateSaveBar() {
    const bar = containerEl && containerEl.querySelector('#pvh-save-bar');
    if (bar) bar.classList.toggle('visible', isDirty());
  }

  function showToast(message, isError) {
    const existing = document.querySelector('.portal-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = 'portal-toast';
    toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:' + (isError ? '#ef4444' : '#22c55e') + ';color:#fff;padding:10px 20px;border-radius:10px;font-size:14px;font-weight:600;z-index:100000;opacity:0;transition:opacity .2s';
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => { toast.style.opacity = '1'; });
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 2500);
  }

  function setStatus(state, detail) {
    const el = containerEl && containerEl.querySelector('#pvh-status');
    if (!el) return;
    if (state === 'loading') {
      el.innerHTML = '<div class="pvh-status-inner"><div class="pvh-spinner"></div><div>Åbner forældreportalen…</div></div>';
      el.style.display = '';
    } else if (state === 'error') {
      el.innerHTML = '<div class="pvh-status-inner"><div style="font-size:28px">⚠️</div><div>' + esc(detail || 'Preview’et kunne ikke åbnes.') + '</div><button class="save-btn" id="pvh-retry" style="margin-top:12px">Prøv igen</button></div>';
      el.style.display = '';
      const retry = el.querySelector('#pvh-retry');
      if (retry) retry.addEventListener('click', () => { const c = containerEl; const s = savedSettings; unmount(); mount(c, s.__mountOpts); });
    } else {
      el.style.display = 'none';
    }
  }

  function buildHTML(settings) {
    const contactPhone = (settings && settings.institution_contact_phone) || '';
    const contactEnabled = !!(settings && settings.institution_contact_phone_enabled);
    return `
      <div class="pvh-root">
        <div class="pvh-toolbar">
          <div class="pvh-toolbar-left">
            <span class="pvh-hint">Det du ser, er den rigtige forældreportal. Sluk/tænd sektioner direkte på dem — grå = skjult for forældre.</span>
          </div>
          <div class="pvh-toolbar-right">
            <button class="pvh-contact-btn" id="pvh-contact-toggle-panel">📞 Kontaktknap</button>
            <div class="pvh-device-toggle" id="pvh-device-toggle">
              <button class="pvh-device-btn active" data-device="desktop">Desktop</button>
              <button class="pvh-device-btn" data-device="mobile">Mobil</button>
            </div>
          </div>
        </div>
        <div class="pvh-contact-panel" id="pvh-contact-panel" style="display:none">
          <div class="admin-field" style="margin:0">
            <div class="admin-field-label">📞 Kontakttelefon (vises i portalens saldo-kort)</div>
            <input type="tel" class="input-field input" id="pvh-contact-phone" value="${esc(contactPhone)}" placeholder="Telefonnummer til institutionen">
            <div class="setting-row">
              <div class="setting-info"><div class="setting-label">Aktiver kontaktknap</div><div class="setting-desc">Til = forældre kan ringe direkte fra saldo-kortet. Fra = knappen viser Feedback i stedet.</div></div>
              <label class="toggle"><input type="checkbox" id="pvh-contact-enabled"${contactEnabled ? ' checked' : ''}><span class="toggle-track"></span></label>
            </div>
          </div>
        </div>
        <div class="pvh-frame-wrap" id="pvh-frame-wrap">
          <div class="pvh-status" id="pvh-status"></div>
          <iframe class="pvh-iframe" id="pvh-iframe" src="${esc(getPortalPreviewUrl())}" title="Forældreportal-preview"></iframe>
        </div>
        <div class="admin-save-bar" id="pvh-save-bar">
          <span class="admin-unsaved">Du har ugemte ændringer</span>
          <button class="discard-btn" id="pvh-discard">Annuller</button>
          <button class="save-btn" id="pvh-save">💾 Gem ændringer</button>
        </div>
      </div>`;
  }

  function injectStyles() {
    if (document.getElementById('pvh-styles')) return;
    const style = document.createElement('style');
    style.id = 'pvh-styles';
    style.textContent = `
      /* Højdekæden SKAL være eksplicit hele vejen: containeren er auto-højde,
         og en iframe uden opløst højde kollapser til browser-default (150px). */
      #pv2-page-portal { display:flex; flex-direction:column; overflow:hidden; }
      #pv2-settings-container { flex:1; min-height:0; display:flex; flex-direction:column; }
      .pvh-root { display:flex; flex-direction:column; flex:1; min-height:0; }
      .pvh-toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 16px; border-bottom:1px solid var(--border, #e5e7eb); background:var(--surface, #fff); flex-wrap:wrap; }
      .pvh-hint { font-size:12px; color:var(--ink-muted, #6b7280); }
      .pvh-toolbar-right { display:flex; align-items:center; gap:10px; }
      .pvh-contact-btn { padding:6px 12px; border-radius:8px; border:1.5px solid var(--border, #d1d5db); background:#fff; font-size:12px; font-weight:600; cursor:pointer; color:var(--ink-soft, #374151); }
      .pvh-contact-btn.open { border-color:var(--flango, #F5960A); color:var(--flango, #F5960A); }
      .pvh-device-toggle { display:flex; border:1.5px solid var(--border, #d1d5db); border-radius:8px; overflow:hidden; }
      .pvh-device-btn { padding:6px 12px; border:none; background:#fff; font-size:12px; font-weight:600; cursor:pointer; color:var(--ink-muted, #6b7280); }
      .pvh-device-btn.active { background:var(--flango-light, #FEF3E2); color:var(--flango, #b45309); }
      .pvh-contact-panel { padding:12px 16px; border-bottom:1px solid var(--border, #e5e7eb); background:var(--surface-sunken, #f9fafb); }
      .pvh-contact-panel .admin-field { max-width:520px; }
      .pvh-frame-wrap { flex:1; min-height:0; position:relative; display:flex; justify-content:center; background:#eceae6; }
      .pvh-iframe { border:none; width:100%; height:100%; background:#fff; }
      .pvh-frame-wrap.mobile { padding:16px 0; }
      .pvh-frame-wrap.mobile .pvh-iframe { width:390px; max-width:100%; border-radius:24px; box-shadow:0 8px 40px rgba(0,0,0,.18); }
      .pvh-status { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(250,250,249,.92); z-index:5; }
      .pvh-status-inner { display:flex; flex-direction:column; align-items:center; gap:10px; font-size:14px; color:var(--ink-soft, #374151); font-weight:600; text-align:center; padding:20px; }
      .pvh-spinner { width:28px; height:28px; border:3px solid #e5e7eb; border-top-color:var(--flango, #F5960A); border-radius:50%; animation:pvh-spin .8s linear infinite; }
      @keyframes pvh-spin { to { transform:rotate(360deg); } }
    `;
    document.head.appendChild(style);
  }

  async function saveDraft() {
    const saveBtn = containerEl.querySelector('#pvh-save');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Gemmer...'; }
    try {
      // Chip-kolonner splittes efter samme regel som resten af caféen:
      // skaermtid_* → gaming.portal_settings, alt andet → institutions.
      const instSettings = {};
      const stSettings = {};
      const arrayTargets = {};   // kolonne → [{item, value}] — skrives som ÉT array
      const rowTargets = [];     // {table, id, column, value}
      for (const key of Object.keys(draft)) {
        if (key.indexOf('arr:') === 0) {
          const p = key.split(':');
          (arrayTargets[p[1]] = arrayTargets[p[1]] || []).push({ item: p[2], value: draft[key] });
        } else if (key.indexOf('row:') === 0) {
          const p = key.split(':');
          rowTargets.push({ table: p[1], id: p[2], column: p[3], value: draft[key] });
        } else {
          const col = key.indexOf('col:') === 0 ? key.slice(4) : key;
          if (col.indexOf('skaermtid_') === 0) stSettings[col] = draft[key];
          else instSettings[col] = draft[key];
        }
      }
      // Array-medlemmer: læs nuværende array og skriv det samlet, så to
      // elementer i samme kolonne ikke overskriver hinanden.
      for (const col of Object.keys(arrayTargets)) {
        const current = await window.PortalData.getInstitutionArrayField(col);
        let next = current.slice();
        for (const t of arrayTargets[col]) {
          if (t.value && next.indexOf(t.item) === -1) next.push(t.item);
          if (!t.value) next = next.filter(function (v) { return v !== t.item; });
        }
        instSettings[col] = next;
      }
      if (contactDirty) {
        const phone = containerEl.querySelector('#pvh-contact-phone');
        const enabled = containerEl.querySelector('#pvh-contact-enabled');
        if (phone) instSettings.institution_contact_phone = phone.value.trim() || null;
        if (enabled) instSettings.institution_contact_phone_enabled = enabled.checked === true;
      }

      let instOk = true;
      let stOk = true;
      if (Object.keys(instSettings).length > 0) {
        instOk = await window.PortalData.saveInstitutionSettings(null, instSettings);
      }
      if (Object.keys(stSettings).length > 0) {
        stOk = await window.PortalData.saveScreentimeSettings(null, stSettings);
      }
      // Tabelrækker (fx ét spil i game_catalog). Låsen håndhæves af triggeren
      // på gaming.game_catalog — værten tilføjer ingen egen kontrol.
      let rowOk = true;
      for (const t of rowTargets) {
        const ok = await window.PortalData.updateCatalogRow(t.table, t.id, t.column, t.value);
        if (!ok) rowOk = false;
      }

      if (instOk && stOk && rowOk) {
        draft = {};
        contactDirty = false;
        updateSaveBar();
        post({ type: 'flango-preview:saved' });
        showToast('Indstillinger gemt');
      } else {
        showToast('Nogle indstillinger kunne ikke gemmes', true);
      }
    } catch (err) {
      console.error('[preview-host] Gem fejlede:', err);
      showToast('Fejl: ' + (err && err.message || 'Ukendt fejl'), true);
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Gem ændringer'; }
    }
  }

  function discardDraft() {
    draft = {};
    if (contactDirty && savedSettings) {
      const phone = containerEl.querySelector('#pvh-contact-phone');
      const enabled = containerEl.querySelector('#pvh-contact-enabled');
      if (phone) phone.value = savedSettings.institution_contact_phone || '';
      if (enabled) enabled.checked = savedSettings.institution_contact_phone_enabled === true;
      contactDirty = false;
    }
    updateSaveBar();
    post({ type: 'flango-preview:state', draft: {} });
  }

  function handlePortalMessage(event) {
    if (event.origin !== portalOrigin) return;
    if (!iframeEl || event.source !== iframeEl.contentWindow) return;
    const msg = event.data;
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'flango-preview:ready') {
      if (sessionDelivered || !sessionTokens) return;
      sessionDelivered = true;
      post({
        type: 'flango-preview:session',
        accessToken: sessionTokens.access_token,
        refreshToken: sessionTokens.refresh_token,
        // Rå feature_flags (modul → { locked, lock_reason }). Preview-modulet
        // slår selv op via serverens preview_sections[].module, så kolonne→
        // modul-mappingen kun findes ét sted (_shared/portal-sections.ts).
        flags: (mountOpts && mountOpts.featureFlags) || {},
        role: 'admin',
      });
    } else if (msg.type === 'flango-preview:session-ok') {
      setStatus('hidden');
    } else if (msg.type === 'flango-preview:session-error') {
      setStatus('error', 'Portal-login fejlede: ' + (msg.message || 'ukendt fejl'));
    } else if (msg.type === 'flango-preview:toggle') {
      if (typeof msg.value !== 'boolean') return;
      // Sektioner sender `column`; under-kontakter sender en `target`-streng
      // (col:/arr:/row:) fordi de også kan pege på et array-medlem eller en
      // tabelrække. Nøglen i draft'en ER målet.
      const key = typeof msg.target === 'string' ? msg.target : msg.column;
      if (typeof key !== 'string') return;
      draft[key] = msg.value;
      updateSaveBar();
      post({ type: 'flango-preview:state', draft: { ...draft } });
    }
  }

  let mountOpts = null;

  async function mount(container, opts) {
    containerEl = container;
    mountOpts = opts || {};
    savedSettings = mountOpts.institutionSettings || {};
    savedSettings.__mountOpts = mountOpts;
    draft = {};
    contactDirty = false;
    sessionDelivered = false;
    portalOrigin = getPortalOrigin();

    injectStyles();
    container.innerHTML = buildHTML(savedSettings);
    iframeEl = container.querySelector('#pvh-iframe');
    setStatus('loading');

    // Kontakt-panel
    const panelBtn = container.querySelector('#pvh-contact-toggle-panel');
    const panel = container.querySelector('#pvh-contact-panel');
    panelBtn.addEventListener('click', () => {
      const open = panel.style.display === 'none';
      panel.style.display = open ? '' : 'none';
      panelBtn.classList.toggle('open', open);
    });
    ['input', 'change'].forEach(evt => {
      container.querySelector('#pvh-contact-phone').addEventListener(evt, () => { contactDirty = true; updateSaveBar(); });
      container.querySelector('#pvh-contact-enabled').addEventListener(evt, () => { contactDirty = true; updateSaveBar(); });
    });

    // Enheds-ramme
    container.querySelector('#pvh-device-toggle').addEventListener('click', (e) => {
      const btn = e.target.closest('.pvh-device-btn');
      if (!btn) return;
      container.querySelectorAll('.pvh-device-btn').forEach(b => b.classList.toggle('active', b === btn));
      container.querySelector('#pvh-frame-wrap').classList.toggle('mobile', btn.dataset.device === 'mobile');
    });

    // Gem-bar
    container.querySelector('#pvh-save').addEventListener('click', saveDraft);
    container.querySelector('#pvh-discard').addEventListener('click', discardDraft);

    // Protokol-lytter
    messageListener = handlePortalMessage;
    window.addEventListener('message', messageListener);

    // Admin-parent-session (samme flow som Simulatoren)
    try {
      if (typeof window.__flangoGetAdminParentSession !== 'function') {
        throw new Error('admin-parent-flowet er ikke indlæst');
      }
      sessionTokens = await window.__flangoGetAdminParentSession();
      // Er portalen allerede klar (ready sendt før tokens ankom), leverer
      // næste ready-ping sessionen — modulet pinger hvert 300 ms.
    } catch (err) {
      console.error('[preview-host] Kunne ikke hente admin-parent-session:', err);
      setStatus('error', err && err.message);
    }
  }

  function unmount() {
    if (messageListener) { window.removeEventListener('message', messageListener); messageListener = null; }
    containerEl = null;
    iframeEl = null;
    sessionTokens = null;
    sessionDelivered = false;
    draft = {};
    contactDirty = false;
    savedSettings = null;
    mountOpts = null;
  }

  window.AdminPortalPreviewHost = { mount: mount, unmount: unmount, isDirty: isDirty };
})();
