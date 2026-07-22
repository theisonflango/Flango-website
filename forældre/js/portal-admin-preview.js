/**
 * portal-admin-preview.js — admin-preview-tilstand (admin-portal-ombygningen, fase 1)
 *
 * Loades KUN når portalen åbnes med ?admin_preview=1 (dynamisk script-injektion
 * fra portal-v2.js init) — forældre henter aldrig denne fil. Modulet gør tre ting:
 *
 *   1. Handshake: modtager admin-parent-sessionen fra café-hosten via postMessage
 *      (aldrig URL-params) og logger ind med den.
 *   2. Dekoration: efter hver renderApp gråtones sektioner der er skjult for
 *      forældre, og hver flag-styret sektion får en toggle-chip i headeren.
 *      Hvilke sektioner og kolonner der findes, kommer fra serverens
 *      preview_sections (get-parent-view) — ingen kolonne-dubletter her.
 *   3. Protokol: chip-klik meldes til hosten (som ejer draft-state + gem-baren);
 *      hosten kan sende draft-overrides retur og "saved" (→ refetch af serverens
 *      sandhed).
 *
 * Sikkerhed: modulet giver ingen adgang i sig selv — serveren sætter kun
 * is_admin_preview for institutionens admin-parent-konto, og sessions-beskeder
 * accepteres kun fra origin-allowlisten nedenfor.
 */
(function () {
  'use strict';

  const PROTOCOL_VERSION = 1;

  // Café-hosts: web-prod, lokal dev (cafe kører på 3000) og Tauri-desktop.
  // Tauri-origin varierer pr. platform — kandidaterne verificeres i fase 2/3.
  const ALLOWED_HOST_ORIGINS = [
    'https://flango.dk',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'tauri://localhost',
    'http://tauri.localhost',
    'https://tauri.localhost',
  ];

  // Portal-DOM-id pr. server-sektionsnøgle. DOM-viden er portal-side pr. natur;
  // flag-kolonnerne kommer fra serveren (preview_sections).
  const SECTION_DOM = {
    events: 'section-events',
    ugeplan: 'section-ugeplan',
    purchase_profile: 'section-profile',
    history: 'section-history',
    sortiment: 'section-sortiment',
    feedback: 'section-feedback',
    spending_limit: 'section-spending-limit',
    product_limit: 'section-product-limits',
    sugar_policy: 'section-sugar',
    diet: 'section-diet',
    allergens: 'section-allergens',
    profile_pictures: 'section-profile-picture',
    notifications: 'section-notifications',
    screentime: 'section-screentime',
    screentime_games: 'section-games',
    screentime_usage: 'section-st-chart',
  };

  let hostOrigin = null;        // sat ved session-handshake; al efterfølgende trafik låses hertil
  let sections = [];            // seneste preview_sections fra serveren
  let draft = {};               // column → bool; hostens ugemte ændringer
  let locks = {};               // column → { locked, reason } — superadmin-låse fra hosten
  let refetchFn = null;

  function post(msg) {
    if (!hostOrigin) return;
    window.parent.postMessage({ ...msg, v: PROTOCOL_VERSION }, hostOrigin);
  }

  function injectStyles() {
    if (document.getElementById('flango-preview-styles')) return;
    const style = document.createElement('style');
    style.id = 'flango-preview-styles';
    style.textContent = `
      .flango-preview-off { filter: grayscale(1); opacity: .55; }
      .flango-preview-badge {
        display: inline-block; margin-left: 8px; padding: 2px 8px;
        border-radius: 999px; font-size: 10px; font-weight: 700;
        letter-spacing: .04em; text-transform: uppercase;
        background: #6b7280; color: #ffffff; vertical-align: middle;
      }
      .flango-preview-chip {
        display: inline-flex; align-items: center; gap: 6px; flex: none;
        margin-left: auto; margin-right: 10px; padding: 4px 10px;
        border-radius: 999px; border: 1.5px solid #d1d5db; cursor: pointer;
        font-size: 11px; font-weight: 700; user-select: none;
        background: #ffffff; color: #374151;
        /* Chippen skal ikke gråtones med sektionen — den er admin-UI, ikke indhold */
        filter: none; opacity: 1;
      }
      .flango-preview-off .flango-preview-chip { filter: grayscale(0); }
      .flango-preview-chip[data-on="1"] { border-color: #16a34a; color: #166534; background: #f0fdf4; }
      .flango-preview-chip .fp-dot {
        width: 8px; height: 8px; border-radius: 50%; background: #9ca3af;
      }
      .flango-preview-chip[data-on="1"] .fp-dot { background: #16a34a; }
      .flango-preview-chip.fp-passive { cursor: default; border-style: dashed; font-weight: 600; }
      .flango-preview-chip.fp-locked { cursor: not-allowed; opacity: .65; }
    `;
    document.head.appendChild(style);
  }

  function effective(column, savedVisible) {
    return draft[column] !== undefined ? draft[column] : savedVisible;
  }

  function sectionByKey(key) {
    return sections.find((s) => s && s.key === key) || null;
  }

  /** Er sektionen reelt synlig for forældre med nuværende draft? Skærmtid-
   *  undersektionerne er derudover gated af skaermtid_enabled — er den slukket,
   *  ser forældre dem ikke uanset underflagets værdi. */
  function effectiveForKey(entry) {
    const own = effective(entry.column, entry.visible);
    if (entry.key === 'screentime_games' || entry.key === 'screentime_usage') {
      const st = sectionByKey('screentime');
      const stOn = st ? effective(st.column, st.visible) : true;
      return stOn && own;
    }
    return own;
  }

  function applyStateToSection(entry) {
    const el = document.getElementById(SECTION_DOM[entry.key]);
    if (!el) return;

    const isOn = effectiveForKey(entry);
    el.classList.toggle('flango-preview-off', !isOn);

    // Badge ("Skjult for forældre") ved titlen
    const titleWrap = el.querySelector('.section-title');
    if (titleWrap) {
      let badge = titleWrap.querySelector('.flango-preview-badge');
      if (!isOn && !badge) {
        badge = document.createElement('span');
        badge.className = 'flango-preview-badge';
        badge.textContent = 'Skjult for forældre';
        titleWrap.appendChild(badge);
      } else if (isOn && badge) {
        badge.remove();
      }
    }

    // Toggle-chip i headeren (chippen viser sektionens EGET flag — grå-tilstanden
    // kan afvige for skærmtid-undersektioner når hovedflaget er slukket).
    // INGEN listener pr. chip: portalens sektioner kan re-renderes via HTML-
    // serialisering, som bevarer chip-markup men dropper listeners — klik
    // håndteres derfor delegeret i initChipDelegation() og chippen bærer kun
    // data-attributter.
    const header = el.querySelector('.section-header');
    if (!header) return;
    let chip = header.querySelector('.flango-preview-chip');
    if (!chip) {
      chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'flango-preview-chip';
      chip.innerHTML = '<span class="fp-dot"></span><span class="fp-label"></span>';
      const chevron = header.querySelector('.section-chevron');
      header.insertBefore(chip, chevron || null);
    }
    chip.dataset.key = entry.key;
    chip.dataset.column = entry.column;
    const ownOn = effective(entry.column, entry.visible);
    chip.dataset.on = ownOn ? '1' : '0';
    const lock = locks[entry.column];
    chip.disabled = !!(lock && lock.locked);
    chip.classList.toggle('fp-locked', !!(lock && lock.locked));
    chip.querySelector('.fp-label').textContent = (lock && lock.locked ? '🔒 ' : '') + (ownOn ? 'Til' : 'Fra');
    chip.title = lock && lock.locked
      ? (lock.reason || 'Låst af Flango')
      : (ownOn ? 'Synlig for forældre — klik for at skjule' : 'Skjult for forældre — klik for at vise');
  }

  /** Delegeret chip-klik: capture-fase på document, så portalens accordion-
   *  handler (bubble på document) aldrig ser klikket, og så chips overlever
   *  sektions-re-render uanset hvordan DOM'en er genopbygget. */
  function initChipDelegation() {
    document.addEventListener('click', (e) => {
      const chip = e.target && e.target.closest && e.target.closest('.flango-preview-chip');
      if (!chip || chip.classList.contains('fp-passive') || chip.disabled) return;
      // stopPropagation er ikke nok: accordion-handleren sidder OGSÅ på document
      // (samme node, senere fase) og ville folde sektionen ud ved chip-klik.
      e.stopImmediatePropagation();
      e.preventDefault();
      const entry = sectionByKey(chip.dataset.key);
      if (!entry) return;
      const next = !effective(entry.column, entry.visible);
      draft[entry.column] = next;
      decorate();
      post({ type: 'flango-preview:toggle', key: entry.key, column: entry.column, value: next });
    }, true);
  }

  /** Indbetaling kan ikke slås fra som sektion — synligheden af betalingsveje
   *  styres af Betalingsmetoder-opsætningen (server-udledt). Passiv chip så
   *  admin ikke leder efter en kontakt der ikke findes. */
  function applyTopupInfoChip() {
    const header = document.querySelector('#section-topup .section-header');
    if (!header || header.querySelector('.flango-preview-chip')) return;
    const chip = document.createElement('span');
    chip.className = 'flango-preview-chip fp-passive';
    chip.textContent = 'Styres af Betalingsmetoder';
    header.insertBefore(chip, header.querySelector('.section-chevron') || null);
  }

  function decorate() {
    for (const entry of sections) {
      if (entry && SECTION_DOM[entry.key]) applyStateToSection(entry);
    }
    applyTopupInfoChip();
  }

  function handleHostMessage(event) {
    if (!hostOrigin || event.origin !== hostOrigin) return;
    const msg = event.data;
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'flango-preview:state') {
      draft = (msg.draft && typeof msg.draft === 'object') ? { ...msg.draft } : {};
      decorate();
    } else if (msg.type === 'flango-preview:saved') {
      draft = {};
      if (refetchFn) refetchFn();
    }
  }

  /** Handshake: ping hosten med "ready" indtil sessionen ankommer (hosten kan
   *  først lytte efter iframe-load — gentagne pings er den robuste rækkefølge).
   *  Timeout → false, og portal-v2.js falder tilbage til normal login-skærm. */
  function bootstrap(opts) {
    refetchFn = opts && opts.refetch;
    const supabase = opts && opts.supabase;
    injectStyles();
    initChipDelegation();

    return new Promise((resolve) => {
      let settled = false;

      const readyInterval = setInterval(() => {
        // Målrettet origin kendes ikke før handshake — ready-ping bærer intet
        // følsomt og sendes derfor bredt.
        window.parent.postMessage({ type: 'flango-preview:ready', v: PROTOCOL_VERSION }, '*');
      }, 300);

      const timeout = setTimeout(() => finish(false), 15000);

      function finish(ok) {
        if (settled) return;
        settled = true;
        clearInterval(readyInterval);
        clearTimeout(timeout);
        resolve(ok);
      }

      async function onSessionMessage(event) {
        if (!ALLOWED_HOST_ORIGINS.includes(event.origin)) return;
        const msg = event.data;
        if (!msg || msg.type !== 'flango-preview:session') return;
        window.removeEventListener('message', onSessionMessage);
        hostOrigin = event.origin;
        locks = (msg.locks && typeof msg.locks === 'object') ? msg.locks : {};
        try {
          const { error } = await supabase.auth.setSession({
            access_token: msg.accessToken,
            refresh_token: msg.refreshToken,
          });
          if (error) throw error;
          post({ type: 'flango-preview:session-ok' });
          finish(true);
        } catch (e) {
          post({ type: 'flango-preview:session-error', message: e && e.message });
          finish(false);
        }
      }

      window.addEventListener('message', onSessionMessage);
      window.addEventListener('message', handleHostMessage);
    });
  }

  function onRender(previewSections) {
    sections = Array.isArray(previewSections) ? previewSections : [];
    decorate();
  }

  window.FlangoAdminPreview = { bootstrap: bootstrap, onRender: onRender };
})();
