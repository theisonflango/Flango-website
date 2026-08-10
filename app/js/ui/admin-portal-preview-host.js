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
  let draftMeta = {};         // samme nøgle → { label, effect } til gem-bekræftelsen
  let contactDirty = false;   // kontaktfelterne følger samme gem-bar
  let messageListener = null;
  let savedSettings = null;   // institutionSettings ved mount (til kontaktfelter)
  let chromeEl = null;        // enheds-kontakten, monteret i skallens admin-bjælke

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

  /** Kontakt-panelet. Værten ejer tilstanden — tandhjulet i portalen er kun en
   *  udløser og tegner den tilstand vi melder tilbage. Ét sted at spørge, så
   *  knap og panel ikke kan komme ud af trit. */
  function isContactPanelOpen() {
    const panel = containerEl && containerEl.querySelector('#pvh-contact-panel');
    return !!panel && panel.style.display !== 'none';
  }

  function setContactPanel(open) {
    const panel = containerEl && containerEl.querySelector('#pvh-contact-panel');
    if (!panel) return;
    panel.style.display = open ? '' : 'none';
    if (open) {
      const phone = containerEl.querySelector('#pvh-contact-phone');
      if (phone) { phone.focus(); phone.select(); }
    }
    post({ type: 'flango-preview:settings-state', key: 'contact_button', open: !!open });
  }

  /** Enheds-visning. Mobil er en REN forældre-visning: renden med admin-chips
   *  ligger inde i portalen, så i en 390px-ramme ville den æde 72px + afstand og
   *  vise indholdet ~20% smallere end en rigtig telefon. Det ville ikke være en
   *  mobil-visning, men en forkert en. Chippene skjules derfor — gråtoningen og
   *  "skjult for forældre"-mærket bliver, ellers ville en slukket sektion se
   *  levende ud. Desktop = indstil, mobil = kontrollér hvordan det ser ud. */
  function setDevice(device) {
    const mobil = device === 'mobile';
    if (chromeEl) {
      chromeEl.querySelectorAll('.pvh-device-btn')
        .forEach(b => b.classList.toggle('active', (b.dataset.device === 'mobile') === mobil));
    }
    const wrap = containerEl && containerEl.querySelector('#pvh-frame-wrap');
    if (wrap) wrap.classList.toggle('mobile', mobil);
    post({ type: 'flango-preview:chrome', gutters: !mobil });
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
        <div class="pvh-contact-panel" id="pvh-contact-panel" style="display:none">
          <div class="admin-field" style="margin:0">
            <div class="admin-field-label">📞 Kontakttelefon (vises i portalens saldo-kort)
              <button class="pvh-panel-close" id="pvh-contact-close" aria-label="Luk">✕</button>
            </div>
            <input type="tel" class="input-field input" id="pvh-contact-phone" value="${esc(contactPhone)}" placeholder="Telefonnummer til institutionen">
            <div class="setting-row">
              <div class="setting-info"><div class="setting-label">Aktiver kontaktknap</div><div class="setting-desc">Til = forældre kan ringe direkte fra saldo-kortet. Fra = knappen viser Support i stedet.</div></div>
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
         og en iframe uden opløst højde kollapser til browser-default (150px).
         Men den må IKKE sætte display på selve side-elementet: en ID-selektor
         slår .portal-v2 .admin-page{display:none}, og så lå indstillings-siden
         tændt bag alle andre faner. Side-synligheden ejes af admin-portal-v2.js
         alene — her styres kun højden, og kun indefra containeren. */
      #pv2-settings-container { flex:1; min-height:0; display:flex; flex-direction:column; }
      .pvh-root { display:flex; flex-direction:column; flex:1; min-height:0; }
      .pvh-panel-close { float:right; border:none; background:none; cursor:pointer; font-size:14px; line-height:1; color:var(--ink-muted, #6b7280); padding:2px 4px; }
      .pvh-panel-close:hover { color:var(--ink, #111827); }
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

  /** Gem-bekræftelse: hvad ændrer sig, og hvad betyder det for forældrene.
   *  Ændringerne rammer ALLE institutionens forældre på én gang og er usynlige
   *  herfra bagefter — derfor skal de siges højt før de sendes, ikke bare
   *  tælles. (Et enkelt fejlklik + Gem ændrede en indstilling under test uden
   *  at nogen opdagede det.) */
  async function confirmSave() {
    const rows = [];
    for (const key of Object.keys(draft)) {
      const m = draftMeta[key] || {};
      const label = esc(m.label || key);
      const verb = draft[key] ? 'tændes' : 'slukkes';
      const effect = m.effect ? ' — ' + esc(m.effect) : '';
      rows.push('<li style="margin:0 0 8px"><b>' + label + '</b> ' + verb +
        '<div style="color:#6b7280;font-size:12.5px;line-height:1.45">' +
        (draft[key] ? '✓' : '✕') + effect + '</div></li>');
    }
    if (contactDirty) {
      const enabled = containerEl.querySelector('#pvh-contact-enabled');
      const phone = containerEl.querySelector('#pvh-contact-phone');
      rows.push('<li style="margin:0 0 8px"><b>Kontaktknap</b> opdateres' +
        '<div style="color:#6b7280;font-size:12.5px;line-height:1.45">' +
        (enabled && enabled.checked
          ? 'Forældre kan ringe til ' + esc((phone && phone.value.trim()) || 'nummeret') + ' fra saldo-kortet'
          : 'Knappen viser Support i stedet for et telefonnummer') +
        '</div></li>');
    }
    if (!rows.length) return true;

    const body =
      '<div style="text-align:left">' +
        '<div style="margin-bottom:10px">Følgende ændres for <b>alle forældre</b> i institutionen:</div>' +
        '<ul style="margin:0;padding-left:18px">' + rows.join('') + '</ul>' +
        '<div style="margin-top:12px;color:#6b7280;font-size:12.5px">' +
          'Ændringen gælder med det samme. Du kan altid slå det til igen samme sted.' +
        '</div>' +
      '</div>';

    if (typeof window.__flangoShowCustomAlert !== 'function') {
      return window.confirm('Gem ' + rows.length + ' ændring(er) for alle forældre?');
    }
    return await window.__flangoShowCustomAlert('Gem ændringer?', body, {
      type: 'confirm', okText: 'Gem ændringer', cancelText: 'Fortryd', focus: 'cancel', zIndex: 20000,
    });
  }

  async function saveDraft() {
    if (!(await confirmSave())) return;
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
        draftMeta = {};
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
    draftMeta = {};
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
        // Kontakter hvor DENNE vært har et indstillings-panel. Portalen tegner et
        // tandhjul ved dem — og kun ved dem. Super-admin-panelet indlejrer samme
        // portal uden et kontakt-panel og sender derfor ingenting, så der dukker
        // heller ikke et tandhjul op der ikke fører nogen steder hen.
        settingsFor: ['contact_button'],
      });
    } else if (msg.type === 'flango-preview:session-ok') {
      setStatus('hidden');
    } else if (msg.type === 'flango-preview:toggle-settings') {
      if (msg.key !== 'contact_button') return;
      setContactPanel(!isContactPanelOpen());
    } else if (msg.type === 'flango-preview:session-error') {
      setStatus('error', 'Portal-login fejlede: ' + (msg.message || 'ukendt fejl'));
    } else if (msg.type === 'flango-preview:toggle') {
      if (typeof msg.value !== 'boolean') return;
      // Sektioner sender `column`; under-kontakter sender en `target`-streng
      // (col:/arr:/row:) fordi de også kan pege på et array-medlem eller en
      // tabelrække. Nøglen i draft'en ER målet.
      const key = typeof msg.target === 'string' ? msg.target : msg.column;
      if (typeof key !== 'string') return;
      // revert = kontakten er vendt tilbage til den gemte værdi. Kun portalen
      // kender serverens værdi, så den melder det; værten fjerner nøglen frem
      // for at gemme en "ændring" der ikke er nogen.
      if (msg.revert === true) {
        delete draft[key];
        delete draftMeta[key];
      } else {
        draft[key] = msg.value;
        // Portalen sender navn + konsekvens med. Værten kender ikke sektionerne og
        // skal ikke lære dem — den gemmer blot beskrivelsen til bekræftelsen.
        draftMeta[key] = {
          label: typeof msg.label === 'string' ? msg.label : key,
          effect: typeof msg.effect === 'string' ? msg.effect : '',
          value: msg.value,
        };
      }
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
    draftMeta = {};
    contactDirty = false;
    sessionDelivered = false;
    portalOrigin = getPortalOrigin();

    injectStyles();
    container.innerHTML = buildHTML(savedSettings);
    iframeEl = container.querySelector('#pvh-iframe');
    setStatus('loading');

    // Kontakt-panelet åbnes nu fra tandhjulet ved kontaktknappens kontakt inde i
    // preview'et (flango-preview:toggle-settings) — ikke fra en knap i bjælken.
    // Indstillingen hører til dér hvor man kan se hvad den gør.
    container.querySelector('#pvh-contact-close')
      .addEventListener('click', () => setContactPanel(false));
    ['input', 'change'].forEach(evt => {
      container.querySelector('#pvh-contact-phone').addEventListener(evt, () => { contactDirty = true; updateSaveBar(); });
      container.querySelector('#pvh-contact-enabled').addEventListener(evt, () => { contactDirty = true; updateSaveBar(); });
    });

    // Enheds-ramme. Knappen bor i admin-bjælken (skallens `chromeSlot`) — en hel
    // værktøjslinje til én kontakt kostede 45px af den højde preview'et lever af.
    // Skallen ejer bjælkens layout, værten ejer adfærden.
    chromeEl = document.createElement('div');
    chromeEl.className = 'pvh-device-toggle';
    chromeEl.id = 'pvh-device-toggle';
    chromeEl.innerHTML =
      '<button class="pvh-device-btn active" data-device="desktop">Desktop</button>' +
      '<button class="pvh-device-btn" data-device="mobile">Mobil</button>';
    chromeEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.pvh-device-btn');
      if (!btn) return;
      setDevice(btn.dataset.device === 'mobile' ? 'mobile' : 'desktop');
    });
    if (mountOpts.chromeSlot) mountOpts.chromeSlot.appendChild(chromeEl);

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
    if (chromeEl) { chromeEl.remove(); chromeEl = null; }
    containerEl = null;
    iframeEl = null;
    sessionTokens = null;
    sessionDelivered = false;
    draft = {};
    draftMeta = {};
    contactDirty = false;
    savedSettings = null;
    mountOpts = null;
  }

  window.AdminPortalPreviewHost = { mount: mount, unmount: unmount, isDirty: isDirty };
})();
