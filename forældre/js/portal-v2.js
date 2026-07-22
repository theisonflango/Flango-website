/**
 * Flango Parent Portal v2 — Main App Logic
 *
 * Builds the full portal UI dynamically.
 * Handles auth, child switching, section rendering, saves, etc.
 *
 * Requires: window.portalSupabase (from index.html), PortalAPI (portal-v2-api.js)
 */
(function () {
  'use strict';

  const root = document.getElementById('portal-root');
  const API = window.PortalAPI;

  // ─── State ───
  let currentSession = null;
  let children = [];
  let selectedChild = null;
  let childData = null;       // from get-parent-view
  let products = [];          // from get-products-for-parent
  let purchaseProfile = null; // from get-purchase-profile
  let allergySettings = null;
  let screentimeData = null;
  let _stSaveTimer = null; // debounce for skærmtid-stepper-gemning
  let eventsData = null;
  let ugeplanData = null;     // from get-published-ugeplan (lazy)
  let ugeplanWeekIdx = 0;     // valgt uge i ugeplan-sektionen
  let featureFlags = {};      // from institution
  let visibleSections = {};   // from get-parent-view (server-autoritativ sektion-synlighed)
  let dailySpecialLimit = null; // samlet dagens-ret-grænse (0=spærret, null=ubegrænset) fra get-products-for-parent
  let customerAvgSpend = null; // { avg_today, avg_week, avg_month }
  let consentHistory = [];     // from get_consent_history (all rows for selected child)
  let _sidebarObserver = null; // IntersectionObserver for sidebar scroll tracking
  // Inline-betaling (Stripe deferred Express Checkout + MobilePay-knap). Pr. valgt barn.
  let topupStripe = null, topupElements = null, topupExpressEl = null;
  let topupConfig = null, topupInitStarted = false, topupInitChildId = null;
  let topupCustomAmount = null; // valgt beløb når "Andet" er aktivt

  // Optanknings-beløb. Ikke institutions-konfigurerbart — der findes ingen kolonne
  // for det, og alle institutioner har hidtil kørt samme trappe. "Andet" dækker resten.
  const TOPUP_PRESETS = [
    { amount: 50,  label: 'Lille optankning' },
    { amount: 100, label: 'Anbefalet' },
    { amount: 200, label: 'Stor optankning' },
    { amount: 500, label: 'Ekstra stor' },
  ];
  const DEFAULT_TOPUP_AMOUNT = 100;

  // Version af privatlivspolitikken der gemmes i parent_consents.consent_version
  // ved nye samtykker. Bumpes naar privatlivspolitikken opdateres.
  const CURRENT_CONSENT_VERSION = 'v1.0';

  // ─── Demo-/gæsteflow ───
  // "Prøv portalen" logger ind på en RLS-isoleret demo-institution med fiktive børn.
  // Creds er OFFENTLIGE by design: sandkasse uden rigtige data, og rigtig betaling er
  // spærret SERVER-side (create-topup / vipps-create-payment / create-event-payment
  // afviser is_demo=true — UI-skjul alene er ikke nok).
  const DEMO_EMAIL = 'demo@flango.dk';
  const DEMO_PASSWORD = 'FlangoDemo2026';
  function isDemo() { return featureFlags?.is_demo === true; }
  // Blokér handlinger der ikke giver mening / har rigtige bivirkninger i demoen
  // (konto-writes, invitationer, sletning, billed-upload) med en venlig besked i
  // stedet for en fejl. Returnerer true hvis det kaldende flow skal afbrydes.
  function demoBlocked() {
    if (!isDemo()) return false;
    showToast('Funktionen er ikke aktiveret i demo-versionen', '');
    return true;
  }

  // ─── Admin-preview (admin-portal-ombygningen, fase 1) ───
  // Portalen indlejret i café-admin som live preview. URL-parametret
  // ?admin_preview=1 loader kun modulet (js/portal-admin-preview.js) og beder
  // serveren om preview — selve tilstanden er SERVER-bekræftet: get-parent-view
  // sætter kun is_admin_preview når sessionen er institutionens admin-parent-
  // konto. En forælder med parametret får derfor et helt normalt svar og UI.
  const adminPreviewParam = new URLSearchParams(window.location.search).get('admin_preview') === '1';
  function isAdminPreview() { return childData?.is_admin_preview === true; }

  // ─── Tab-to-sections mapping ───
  const TAB_SECTIONS = {
    'tab-home':    ['section-balance','section-events','section-ugeplan','section-profile','section-history','section-sortiment'],
    'tab-pay':     ['section-topup'],
    'tab-limits':  ['section-spending-limit','section-product-limits','section-sugar','section-diet','section-allergens','section-screentime','section-games','section-st-chart'],
    'tab-profile': ['section-child-name','section-profile-picture','section-transfer','section-notifications','section-invite-parent','section-feedback','section-pin'],
    'tab-privacy': ['section-privacy-policy','section-consents','section-data-insight','section-linked-parents','section-delete-child','section-delete-account','section-contact'],
  };

  const SECTION_LABELS = {
    'section-balance':        { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>', label: 'Overblik' },
    'section-events':         { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>', label: 'Arrangementer' },
    'section-ugeplan':        { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/></svg>', label: 'Ugeplan' },
    'section-profile':        { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>', label: 'Købsprofil' },
    'section-history':        { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>', label: 'Historik' },
    'section-sortiment':      { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>', label: 'Sortiment' },
    'section-topup':          { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>', label: 'Indbetaling' },
    'section-transfer':       { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>', label: 'Overfør' },
    'section-spending-limit': { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>', label: 'Daglig grænse' },
    'section-product-limits': { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/></svg>', label: 'Købsgrænser' },
    'section-sugar':          { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>', label: 'Sukkerpolitik' },
    'section-diet':           { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/></svg>', label: 'Kostpræferencer' },
    'section-allergens':      { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>', label: 'Allergier' },
    'section-screentime':     { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>', label: 'Skærmtid' },
    'section-games':          { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><circle cx="17" cy="10" r="1"/><circle cx="15" cy="13" r="1"/></svg>', label: 'Godkend spil' },
    'section-st-chart':       { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>', label: 'Spilletidsoversigt' },
    'section-notifications':  { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>', label: 'Notifikationer' },
    'section-email-notifications': { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>', label: 'E-mail påmindelser' },
    'section-invite-parent':  { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>', label: 'Invitér forælder' },
    'section-feedback':       { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>', label: 'Feedback' },
    'section-pin':            { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>', label: 'Adgangskode' },
    'section-privacy-policy': { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>', label: 'Privatlivspolitik' },
    'section-child-name':     { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>', label: 'Barnets navn' },
    'section-profile-picture':{ icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>', label: 'Profilbilleder' },
    'section-consents':       { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>', label: 'Samtykke-historik' },
    'section-data-insight':   { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>', label: 'Dataindsigt' },
    'section-linked-parents': { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>', label: 'Forældrekonti' },
    'section-delete-child':   { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>', label: 'Slet data' },
    'section-delete-account': { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>', label: 'Slet konto' },
    'section-contact':        { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>', label: 'Kontakt' },
  };

  // ─── Turnstile verification helper (callback-baseret) ───
  // Cloudflare's getResponse() var upålidelig på re-rendrede DOM-elementer
  // — den krævede internal widget-handle og fejlede med "Could not find
  // widget" selv om widget'en visuelt var rendered. Vi bypasser det helt
  // ved at lade Turnstile-widget'en gemme tokenet direkte via callback når
  // brugeren har klaret challenge'en. Tokenet ligger så klar når login
  // klikkes — ingen afhængighed af getResponse.
  window.__flangoTurnstileTokens = window.__flangoTurnstileTokens || {};

  // Turnstile springes KUN over i ægte lokal udvikling. Hostname alene duer ikke som
  // signal: Capacitor serverer fra capacitor://localhost (iOS) og https://localhost
  // (Android), så en wrappet app ville ellers lydløst slå anti-bot fra i produktion —
  // stik imod hvad screeningsmaterialet lover om følsomme login-flows.
  function isLocalDevHost() {
    const nativeApp = location.protocol === 'capacitor:' ||
      !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' &&
         window.Capacitor.isNativePlatform());
    if (nativeApp) return false;
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.');
  }

  async function verifyTurnstileToken(elementId) {
    // Skip Turnstile i lokal udvikling (widget'en er ikke tilgængelig uden for produktion)
    if (isLocalDevHost()) return { ok: true };

    const el = document.getElementById(elementId);
    if (!el) {
      return { ok: false, error: 'Sikkerhedscheck kunne ikke indlæses. Genindlæs siden og prøv igen.' };
    }

    // Token blev gemt af callback når widget verifikerede brugeren
    const token = window.__flangoTurnstileTokens[elementId];
    if (!token) {
      return { ok: false, error: 'Bekræft venligst at du ikke er en robot. Vent et øjeblik på at sikkerhedschecket loader.' };
    }
    try {
      const res = await window.portalSupabase.functions.invoke('verify-turnstile', { body: { token } });
      if (res.error || !res.data?.success) {
        // Reset token så bruger får frisk challenge ved næste forsøg
        delete window.__flangoTurnstileTokens[elementId];
        try { if (typeof turnstile !== 'undefined' && el.dataset.tsWidget) turnstile.reset(el.dataset.tsWidget); } catch {}
        return { ok: false, error: 'Sikkerhedsverifikation fejlede. Prøv igen.' };
      }
      return { ok: true };
    } catch {
      // Fail-CLOSED: en netværks-/edge-fejl må ikke lydløst springe anti-bot over.
      // Screeningsmaterialet lover at Turnstile håndhæves på følsomme login-flows —
      // et stille "ok" her ville gøre den dokumenterede foranstaltning usand.
      // Widget'en nulstilles så brugeren får en frisk challenge ved næste forsøg.
      delete window.__flangoTurnstileTokens[elementId];
      try { if (typeof turnstile !== 'undefined' && el.dataset.tsWidget) turnstile.reset(el.dataset.tsWidget); } catch {}
      return { ok: false, error: 'Sikkerhedschecket kunne ikke gennemføres (netværksfejl). Prøv igen om et øjeblik.' };
    }
  }

  // ─── Eksplicit Turnstile widget-render med callback ───
  // Vi opretter widget eksplicit og lader Turnstile gemme tokenet i
  // window.__flangoTurnstileTokens[elementId] når challenge er klaret.
  // Det gør getResponse irrelevant — vi læser bare det gemte token direkte.
  function ensureTurnstileWidget(elementId, sitekey) {
    if (isLocalDevHost()) return;
    const tryRender = (attempt = 0) => {
      const el = document.getElementById(elementId);
      if (!el) return;
      if (el.dataset.tsWidget) return; // allerede rendered
      if (typeof turnstile === 'undefined') {
        if (attempt < 25) setTimeout(() => tryRender(attempt + 1), 200);
        return;
      }
      // Fjern auto-render-class og tøm container for at undgå konflikt med
      // Cloudflare's auto-render der måske allerede har lavet noget
      el.classList.remove('cf-turnstile');
      el.innerHTML = '';
      // Slet evt. gammelt token så ny widget får frisk challenge
      delete window.__flangoTurnstileTokens[elementId];
      try {
        const widgetHandle = turnstile.render(el, {
          sitekey: sitekey || '0x4AAAAAACyNOCuIOJjI0pUa',
          theme: 'light',
          callback: (token) => {
            window.__flangoTurnstileTokens[elementId] = token;
          },
          'expired-callback': () => {
            delete window.__flangoTurnstileTokens[elementId];
          },
          'error-callback': () => {
            delete window.__flangoTurnstileTokens[elementId];
          },
        });
        if (widgetHandle != null) {
          el.dataset.tsWidget = widgetHandle;
        }
      } catch (e) {
        console.warn('[turnstile] render fejlede for', elementId, ':', e?.message || e);
      }
    };
    tryRender();
  }

  // ─── Inactivity timeout (30 min) ───
  const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
  let _inactivityTimer = null;
  function _resetInactivityTimer() {
    clearTimeout(_inactivityTimer);
    if (!currentSession) return;
    _inactivityTimer = setTimeout(async () => {
      // Indlejret admin-preview logges ikke ud af inaktivitet — caféens egen
      // session-styring er grænsen dér (og preview'et står ofte urørt længe).
      if (isAdminPreview()) { _resetInactivityTimer(); return; }
      console.log('[Portal] Inactivity timeout — logging out');
      try { await API.signOut(); } catch {}
      currentSession = null;
      children = [];
      selectedChild = null;
      renderLogin();
    }, INACTIVITY_TIMEOUT_MS);
  }
  function startInactivityTimeout() {
    ['mousedown', 'keydown', 'touchstart', 'scroll'].forEach(evt =>
      document.addEventListener(evt, _resetInactivityTimer, { passive: true })
    );
    _resetInactivityTimer();
  }
  function stopInactivityTimeout() {
    clearTimeout(_inactivityTimer);
    ['mousedown', 'keydown', 'touchstart', 'scroll'].forEach(evt =>
      document.removeEventListener(evt, _resetInactivityTimer)
    );
  }

  // ═══════════════════════════════════════
  //  INIT
  // ═══════════════════════════════════════

  async function init() {
    try {
      // Auto-login via admin-parent (åbnet fra café-appen).
      //
      // URL'en bærer KUN en engangs-nonce — aldrig tokens. En URL rejser gennem
      // webserver- og proxy-logs, og history.replaceState er for sent: requesten
      // er allerede sendt. Nonce'n veksles derfor til en session via POST, hvor
      // legitimationen ligger i svarets body. Efter første indløsning er nonce'n
      // slettet på serveren, så det der måtte stå i en log, er inert.
      const urlParams = new URLSearchParams(window.location.search);
      const adminHandoff = urlParams.get('admin_handoff');
      if (adminHandoff) {
        window.history.replaceState({}, '', window.location.pathname);
        try {
          const { data, error } = await window.portalSupabase.functions.invoke(
            'admin-parent-redeem',
            { body: { handoff: adminHandoff } },
          );
          if (error || !data?.access_token) {
            console.error('[Portal] Admin-overlevering fejlede:', error || data?.error);
          } else {
            const { error: sessionErr } = await window.portalSupabase.auth.setSession({
              access_token: data.access_token,
              refresh_token: data.refresh_token,
            });
            if (sessionErr) console.error('[Portal] Admin auto-login fejl:', sessionErr);
          }
        } catch (e) {
          console.error('[Portal] Admin-overlevering fejlede:', e);
        }
      }

      // Admin-preview: hent modulet og vent på session-handshake fra café-
      // hosten (postMessage) FØR vi tjekker session. Fejler handshaket, falder
      // vi igennem til normal login-skærm — parametret giver ingen adgang i
      // sig selv.
      if (adminPreviewParam) {
        try {
          await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'js/portal-admin-preview.js?v=2';
            s.onload = resolve; s.onerror = reject;
            document.head.appendChild(s);
          });
          await window.FlangoAdminPreview.bootstrap({
            supabase: window.portalSupabase,
            refetch: async () => { await loadChildData(); renderApp(); },
          });
        } catch (e) {
          console.error('[Portal] Admin-preview bootstrap fejl:', e);
        }
      }

      const session = await API.getSession();
      if (!session) {
        renderLogin();
        return;
      }
      currentSession = session;
      startInactivityTimeout();

      // Check password recovery
      if (window.__pendingPasswordRecovery) {
        renderPasswordRecovery();
        return;
      }

      // Check for pending signup link (after Google redirect or email confirmation)
      await checkPendingSignupLink();

      await loadChildren();
    } catch (err) {
      console.error('[Portal] Init error:', err);
      renderLogin();
    }
  }

  async function loadChildren() {
    showLoading();
    try {
      children = await API.getChildren();
      if (!children || children.length === 0) {
        renderNoChildren();
        return;
      }

      // Retrospektiv vilkårsaccept: tjek om nogen børn mangler accept
      const unaccepted = children.filter(c => !c.terms_accepted_at);
      if (unaccepted.length > 0) {
        await showTermsAcceptFlow(unaccepted);
        // Refresh children after accept
        children = await API.getChildren();
      }

      selectedChild = children[0];
      await loadChildData();
      renderApp();
      maybeShowWelcomeModal();
      // MobilePay-retur (best-effort; webhook+poll er sandheden bag krediteringen)
      try {
        const vref = new URLSearchParams(window.location.search).get('vipps_ref');
        if (vref) { window.history.replaceState({}, '', window.location.pathname); handleVippsReturn(vref); }
      } catch (_) {}
      // Stripe-retur (redirect-metoder fx MobilePay; Stripe-webhook er autoritativ bag krediteringen)
      try {
        const sp = new URLSearchParams(window.location.search);
        const piParam = sp.get('payment_intent');
        if (piParam) {
          const rs = sp.get('redirect_status');
          window.history.replaceState({}, '', window.location.pathname);
          handleStripeReturn(piParam, rs);
        }
      } catch (_) {}
      // Stripe Checkout-retur (?stripe_checkout=done&session_id=...)
      try {
        const spc = new URLSearchParams(window.location.search);
        const co = spc.get('stripe_checkout');
        if (co === 'done') {
          const sid = spc.get('session_id');
          window.history.replaceState({}, '', window.location.pathname);
          if (sid) handleCheckoutReturn(sid);
        } else if (co === 'cancel') {
          window.history.replaceState({}, '', window.location.pathname);
          showToast('Betaling annulleret', '');
        }
      } catch (_) {}
    } catch (err) {
      console.error('[Portal] Load children error:', err);
      renderError('Kunne ikke hente dine børn. Prøv at genindlæse siden.');
    }
  }

  async function loadChildData() {
    if (!selectedChild) return;
    const childId = selectedChild.child_id;
    const instId = selectedChild.institution_id;
    try {
      const [view, prods, events, clubAvg, consents] = await Promise.all([
        API.getParentView(childId, adminPreviewParam).catch(e => { console.error('[Portal] getParentView:', e); return null; }),
        API.getProducts(instId, childId).catch(e => { console.error('[Portal] getProducts:', e); return []; }),
        API.getParentEvents(childId).catch(e => { console.error('[Portal] getEvents:', e); return null; }),
        API.getCustomerAvgSpend(childId).catch(e => { console.error('[Portal] getCustomerAvg:', e); return null; }),
        API.getConsentHistory(childId).catch(e => { console.error('[Portal] getConsentHistory:', e); return []; }),
      ]);
      childData = view;
      consentHistory = Array.isArray(consents) ? consents : [];
      // Map child_limits and institution_limits onto products
      const rawProducts = prods?.products || prods || [];
      const childLimits = prods?.child_limits || [];
      const instLimits = prods?.institution_limits || [];
      const childLimitMap = {};
      childLimits.forEach(l => { childLimitMap[l.product_id] = l.max_per_day; });
      const instLimitMap = {};
      instLimits.forEach(l => { instLimitMap[l.product_id] = l.max_per_day; });
      products = rawProducts.map(p => ({
        ...p,
        parent_limit: childLimitMap[p.id] ?? null,
        institution_limit: instLimitMap[p.id] ?? null,
      }));
      dailySpecialLimit = prods?.daily_special_limit ?? null;
      eventsData = events;
      ugeplanData = null; // genindlæses dovent (institution kan skifte ved barn-skift)
      customerAvgSpend = clubAvg;
      featureFlags = childData?.institution || {};
      // Server-autoritativ sektion-synlighed (institutionens flag, post-lock).
      // Fallback: manglende felt → sektion vises (bevarer adfærd hvis et ældre
      // backend-svar ikke sender visible_sections).
      visibleSections = childData?.visible_sections || {};

      // Load screentime data if enabled
      if (featureFlags.skaermtid_enabled === true) {
        screentimeData = await API.getScreentime(childId, instId).catch(e => { console.error('[Portal] getScreentime:', e); return null; });
      } else {
        screentimeData = null;
      }
    } catch (err) {
      console.error('[Portal] loadChildData error:', err);
    }
  }

  async function switchChild(child) {
    if (selectedChild?.child_id === child.child_id) return;
    selectedChild = child;
    showLoading();
    await loadChildData();
    renderApp();
    maybeShowWelcomeModal();
  }

  // ═══════════════════════════════════════
  //  Velkomst-modal — Trin 2 (2026-04-27)
  // ═══════════════════════════════════════
  // Vises når forælder logger ind på et barn der INGEN aktive samtykker har
  // og forælderen ikke tidligere har dismissed modalen for det barn.
  // Un-checked checkboxes (GDPR-krav: aktivt + eksplicit + informeret).
  // localStorage-flag forhindrer modalen i at dukke op igen efter dismiss.

  function welcomeDismissKey(childId) {
    return `flango_welcome_dismissed_${childId}`;
  }

  // ─── Simulator-session detection ───
  // Café-app's "Åbn portalen som admin"-feature logger ind på en intern konto
  // (admin-parent-{instId}@flango.internal) der er linket til alle børn på
  // institutionen. Når vi detecter den email-suffix, skifter portalen til
  // read-only mode for juridisk-følsomme handlinger (samtykker, sletning) —
  // admin kan stadig se alt og hjælpe med præferencer (grænser, kost, allergi
  // osv.) baseret på mundtlig dialog med forælder, men må IKKE afgive
  // samtykke på vegne af forælderen (GDPR art. 7 — kan ikke dokumenteres).
  let __isAdminSim = null; // memoized
  function isAdminSimulatorSession() {
    if (__isAdminSim !== null) return __isAdminSim;
    try {
      const email = currentSession?.user?.email || '';
      __isAdminSim = email.endsWith('@flango.internal');
    } catch (_) {
      __isAdminSim = false;
    }
    return __isAdminSim;
  }

  function shouldShowWelcomeModal() {
    if (!selectedChild) return false;
    if (!Array.isArray(consentHistory)) return false;
    // Skip i simulator-session — admin må ikke afgive samtykke på vegne af forælder
    if (isAdminSimulatorSession()) return false;
    // Skip i demo-tilstand — fiktive børn har ingen rigtige billeder at samtykke til
    if (isDemo()) return false;
    // Vis hvis forælder har taget en eksplicit handling tidligere (givet eller trukket)
    const hasRealAction = consentHistory.some(c => c.given_method !== 'legacy_default_consent');
    if (hasRealAction) return false;
    // Skip hvis dismissed for dette barn
    try {
      if (localStorage.getItem(welcomeDismissKey(selectedChild.child_id))) return false;
    } catch (_) { /* ignore quota errors */ }
    return true;
  }

  function maybeShowWelcomeModal() {
    if (!shouldShowWelcomeModal()) return;
    // Vent et tick så renderApp er færdig med DOM-arbejde først
    setTimeout(() => renderWelcomeModal(), 100);
  }

  function renderWelcomeModal() {
    if (document.getElementById('flango-welcome-modal')) return; // ingen dobbelt-render
    const childName = getChildName();
    // Vis kun typer institutionen har aktiveret
    const ppInstTypes = Array.isArray(featureFlags?.profile_picture_types) ? featureFlags.profile_picture_types : ['upload', 'camera'];
    const showAula = ppInstTypes.indexOf('upload') !== -1;
    const showCamera = ppInstTypes.indexOf('camera') !== -1;
    const aiMasterOn = featureFlags?.profile_pictures_ai_enabled !== false;
    // Én AI-avatar-udbyder: Microsoft Azure (EU). ai_provider_openai er det legacy-
    // navngivne flag (default true) der gater funktionen.
    const showAi = aiMasterOn && featureFlags?.ai_provider_openai !== false;
    const ct = window.PortalConsentTexts || {};

    const overlay = document.createElement('div');
    overlay.id = 'flango-welcome-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99998;display:flex;align-items:center;justify-content:center;padding:20px;';
    overlay.innerHTML = `
      <div style="background:#fff;color:#111;border-radius:14px;max-width:560px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
        <div style="padding:22px 26px;border-bottom:1px solid #e5e7eb;">
          <div style="font-size:24px;margin-bottom:6px;">👋</div>
          <strong style="font-size:18px;display:block;margin-bottom:6px;">Velkommen til Flango forældreportal</strong>
          <div style="font-size:13px;color:#6b7280;line-height:1.5;">Du er nu tilknyttet <strong>${esc(childName)}</strong>. Før personalet kan vise dit barns profilbillede i caféen, skal du aktivt give samtykke til de billed-typer du tillader.</div>
        </div>
        <div style="padding:20px 26px;">
          <div style="font-size:12px;color:#6b7280;margin-bottom:14px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Vælg hvilke typer du vil tillade</div>
          ${showAula ? `<label style="display:flex;align-items:flex-start;gap:12px;padding:12px;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:10px;cursor:pointer;">
            <input type="checkbox" id="welcome-aula" style="margin-top:3px;width:18px;height:18px;cursor:pointer;">
            <div style="flex:1;">
              <div style="font-weight:600;font-size:14px;color:#111;">Aula-profilbillede</div>
              <div style="font-size:12px;color:#6b7280;margin-top:2px;line-height:1.4;">Institutionen kan bruge dit barns eksisterende Aula-foto som profilbillede i caféen.</div>
            </div>
          </label>` : ''}
          ${showCamera ? `<label style="display:flex;align-items:flex-start;gap:12px;padding:12px;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:10px;cursor:pointer;">
            <input type="checkbox" id="welcome-camera" style="margin-top:3px;width:18px;height:18px;cursor:pointer;">
            <div style="flex:1;">
              <div style="font-weight:600;font-size:14px;color:#111;">Kamera-foto</div>
              <div style="font-size:12px;color:#6b7280;margin-top:2px;line-height:1.4;">Personalet kan tage et nyt foto af dit barn med caféens enhed.</div>
            </div>
          </label>` : ''}
          ${showAi ? `<label style="display:flex;align-items:flex-start;gap:12px;padding:12px;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:10px;cursor:pointer;">
            <input type="checkbox" id="welcome-ai-openai" style="margin-top:3px;width:18px;height:18px;cursor:pointer;">
            <div style="flex:1;">
              <div style="font-weight:600;font-size:14px;color:#111;">AI-genereret avatar</div>
              <div style="font-size:12px;color:#6b7280;margin-top:2px;line-height:1.4;">Et foto af dit barn sendes til Microsoft Azure (EU) for at generere en stiliseret tegneserie. Fotoet slettes straks efter — kun avataren gemmes.</div>
              <button type="button" id="welcome-ai-openai-readmore" style="background:none;border:none;padding:4px 0 0;color:var(--info,#2563eb);font-size:12px;cursor:pointer;font-weight:600;text-align:left;">📖 Læs mere om databehandlingen</button>
            </div>
          </label>` : ''}
          <div style="font-size:11px;color:#9ca3af;margin-top:14px;line-height:1.5;">Du kan altid ændre eller fjerne dine samtykker senere under <strong>Privatliv → Profilbilleder</strong>. Samtykker der trækkes tilbage sletter med det samme det tilhørende billede fra Flango.</div>
        </div>
        <div style="padding:16px 26px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
          <button type="button" id="welcome-skip" style="background:none;border:none;padding:8px 4px;color:#6b7280;font-size:13px;cursor:pointer;text-decoration:underline;">Fortsæt uden samtykke</button>
          <button type="button" id="welcome-confirm" style="padding:10px 20px;background:#16a34a;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;font-size:14px;">Aktivér valgte</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();

    // "Læs mere"-knapper
    overlay.querySelector('#welcome-ai-openai-readmore')?.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      openAiLayer2Modal(false);
    });

    // Skip-knap (markerer dismiss så modal ikke vises igen)
    overlay.querySelector('#welcome-skip').onclick = () => {
      try { localStorage.setItem(welcomeDismissKey(selectedChild.child_id), String(Date.now())); } catch (_) {}
      close();
    };

    // Aktivér-knap: kald give_consent for hver checked
    overlay.querySelector('#welcome-confirm').onclick = async () => {
      const selected = [];
      if (overlay.querySelector('#welcome-aula')?.checked) selected.push({ type: 'profile_picture_aula', version: CURRENT_CONSENT_VERSION });
      if (overlay.querySelector('#welcome-camera')?.checked) selected.push({ type: 'profile_picture_camera', version: CURRENT_CONSENT_VERSION });
      if (overlay.querySelector('#welcome-ai-openai')?.checked) selected.push({ type: 'profile_picture_ai_openai', version: ct.PARENT_AI_AVATAR_VERSION || CURRENT_CONSENT_VERSION });

      if (selected.length === 0) {
        // Ingen valgte = behandl som skip
        try { localStorage.setItem(welcomeDismissKey(selectedChild.child_id), String(Date.now())); } catch (_) {}
        close();
        return;
      }

      const btn = overlay.querySelector('#welcome-confirm');
      btn.disabled = true;
      btn.textContent = 'Gemmer …';
      try {
        const results = await Promise.allSettled(
          selected.map(s => API.giveConsent(selectedChild.child_id, s.type, s.version, 'forældreportal_invite_flow'))
        );
        const failed = results.filter(r => r.status === 'rejected' || (r.value && r.value.success === false));
        if (failed.length > 0) {
          console.warn('[welcome] nogle samtykker fejlede:', failed);
          showToast(`${selected.length - failed.length}/${selected.length} samtykker gemt. Prøv igen for resten.`, 'error');
        } else {
          showToast(`${selected.length} ${selected.length === 1 ? 'samtykke' : 'samtykker'} aktiveret`, 'success');
        }
        try { localStorage.setItem(welcomeDismissKey(selectedChild.child_id), String(Date.now())); } catch (_) {}
        await refreshConsentHistory();
        syncOptOutCacheFromConsents();
        try { await loadChildData(); } catch (_) {}
        rerenderProfileAndConsentSections();
        close();
      } catch (err) {
        console.error('[welcome] giveConsent fejl:', err);
        showToast('Kunne ikke gemme samtykker', 'error');
        btn.disabled = false;
        btn.textContent = 'Aktivér valgte';
      }
    };
  }

  // ═══════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════

  function isMobile() { return window.innerWidth < 768; }

  function formatKr(amount) {
    if (amount == null) return '0';
    const num = parseFloat(amount);
    if (Number.isInteger(num)) return num.toFixed(0);
    return num.toFixed(2).replace('.', ',');
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
    return `${d.getDate()}. ${months[d.getMonth()]}`;
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const days = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør'];
    const months = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
    const day = days[d.getDay()];
    const date = d.getDate();
    const month = months[d.getMonth()];
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${date}. ${month} ${hours}:${mins}`;
  }

  function formatTime(timeStr) {
    if (!timeStr) return '';
    return timeStr.substring(0, 5);
  }

  function showLoading() {
    root.innerHTML = `
      <div class="portal-loading">
        <div class="portal-loading-inner">
          <svg class="flango-loader" viewBox="0 0 512 512" aria-hidden="true">
            <defs><mask id="flangoLoaderGapJs" maskUnits="userSpaceOnUse"><rect x="0" y="0" width="512" height="512" fill="#fff"/><circle cx="214" cy="298" r="126" fill="#000"/></mask></defs>
            <g class="fl-mark">
              <g class="fl-leaves">
                <g transform="translate(247,180) rotate(-35)"><path d="M0 0 A100 100 0 0 1 0 -132 A100 100 0 0 1 0 0 Z"/></g>
                <g transform="translate(261,180) rotate(33)"><path d="M0 0 A100 100 0 0 1 0 -132 A100 100 0 0 1 0 0 Z"/></g>
              </g>
              <g class="fl-back"><circle cx="322" cy="290" r="94" mask="url(#flangoLoaderGapJs)"/></g>
              <circle cx="214" cy="298" r="110"/>
            </g>
          </svg>
          <div class="portal-loading-text">Indlæser portal...</div>
        </div>
      </div>`;
  }

  function showToast(message, type) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = `toast ${type || ''}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => { toast.classList.add('visible'); });
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // Vis advarsel når admin forsøger en blokeret handling i simulator.
  // (Banner-løsningen blev erstattet af visuelt-disablede toggles + tooltip
  //  i render-tid — admin ser at handlingen er låst FØR de klikker. Alert
  //  er stadig her som defense-in-depth hvis et toggle slipper igennem.)
  function showAdminSimulatorBlockedAlert(handlingNavn) {
    alert(`Denne handling (${handlingNavn}) kan ikke udføres i admin-visning.\n\nForælder skal selv logge ind på portalen for at afgive samtykke. Det er et krav fra GDPR art. 7 — samtykke skal kunne dokumenteres som givet af forælderen selv.`);
  }

  // Inline hint-tekst under låste handlinger i simulator. Synlig på mobil
  // (hvor title-tooltips ikke virker pga. touch). Returnerer tom streng hvis
  // ikke i simulator-session.
  function adminSimLockedHint(extraStyle) {
    if (!isAdminSimulatorSession()) return '';
    return `<div style="font-size:11px;color:#92400e;margin-top:4px;font-style:italic;${extraStyle || ''}">🔒 Kun forælder kan ændre dette — bed forælder logge ind selv</div>`;
  }

  function getBalanceStatus(balance) {
    const b = parseFloat(balance || 0);
    if (b > 30) return { cls: 'status-ok', text: 'God saldo' };
    if (b > 0) return { cls: 'status-low', text: 'Lav saldo' };
    return { cls: 'status-empty', text: 'Ingen saldo' };
  }

  // Efternavn: vises kun når institutionen (eller superadmin) har slået det til.
  // last_name_enabled følger med pr. barn fra get_children_for_parent og på childData.institution.
  function isLastNameEnabledForChild(c) {
    const entry = c || selectedChild;
    if (entry && typeof entry.last_name_enabled === 'boolean') return entry.last_name_enabled;
    if (childData?.institution && typeof childData.institution.last_name_enabled === 'boolean') return childData.institution.last_name_enabled;
    return false;
  }
  function getChildFirstName(c) {
    const entry = c || selectedChild;
    return String((entry?.child_name ?? entry?.name) || '').trim();
  }
  function getChildLastName(c) {
    const entry = c || selectedChild;
    return String((entry?.last_name ?? (entry === selectedChild ? childData?.last_name : undefined)) || '').trim();
  }
  // Sammensæt visningsnavn for et barn (liste-entry eller det valgte barn).
  function formatChildName(c) {
    const first = String((c?.child_name ?? c?.name) || '').trim();
    const last = String(c?.last_name || '').trim();
    if (isLastNameEnabledForChild(c) && last) return `${first} ${last}`.trim();
    return first || 'Barn';
  }
  function getChildName() {
    if (!selectedChild) return 'Barn';
    const first = getChildFirstName(selectedChild) || 'Barn';
    const last = getChildLastName(selectedChild);
    return (isLastNameEnabledForChild(selectedChild) && last) ? `${first} ${last}`.trim() : first;
  }
  function getChildEmoji() { return selectedChild?.avatar_emoji || selectedChild?.emoji || '🧒'; }
  function getChildBalance() { return childData?.balance ?? selectedChild?.balance ?? 0; }
  function getInstitutionName() { return childData?.institution_name || childData?.institution?.name || ''; }
  // Dansk genitiv til header-labelen ("Stampens forældreportal"). Navne der ender
  // på s/x/z får apostrof (fx "Max'"), ellers +s.
  function instGenitive(name) {
    const n = (name || '').trim();
    if (!n) return '';
    return /[sxzSXZ]$/.test(n) ? n + "'" : n + 's';
  }

  // ═══════════════════════════════════════
  //  RENDER: LOGIN / SIGNUP / FORGOT PASSWORD
  // ═══════════════════════════════════════

  let loginView = 'login'; // 'login' | 'signup-code' | 'signup-auth' | 'forgot'
  let signupVerifiedData = null; // { child_name, child_id, institution_name, institution_id } from code verification

  function showLoginView(view) {
    loginView = view;
    renderLogin();
  }

  /* Logo-lockup til login-overskriften: mark + navn + tagline som ét vektor-element.
     Marken er de samme baner som loaderen i index.html, beskåret til sit egne bounding
     box (viewBox 104 55 312 353) så lockup'et kan sættes op mod teksten uden luft. */
  /* Theis' brand-lockup (mærke + navn + tagline). Samme fil som caféen bruger,
     beskåret til sit indhold — luften styres i CSS, ikke i billedet. */
  const LOGIN_LOCKUP_HTML = `
      <div class="login-lockup">
        <img src="assets/flango-lockup-tagline.webp" alt="Flango — SFO'ernes cafésystem" width="409" height="190">
      </div>`;

  const googleIconSVG = `<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/><path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/></svg>`;

  const appleIconSVG = `<svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.86-3.08.38-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.38C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08ZM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25Z"/></svg>`;

  // Apple-login vises kun i appen (App Review guideline 4.8: ligeværdigt alternativ til
  // Google). Web har ikke Apple-flowet — dér er e-mail/kode + Google uændret.
  function appleAuthButtonHTML(id) {
    if (!API.isNativeApp()) return '';
    return `
            <button class="apple-btn full" id="${id}">
              ${appleIconSVG}
              <span>Fortsæt med Apple</span>
            </button>`;
  }

  async function handleAppleAuth(errorElId) {
    const errEl = document.getElementById(errorElId);
    try {
      await API.signInWithApple();
      window.location.reload();
    } catch (err) {
      const msg = String((err && err.message) || err);
      if (/cancel|annuller|1001|afbrudt/i.test(msg)) return; // forælderen fortrød — ikke en fejl
      console.warn('[Portal] Apple-login fejlede:', msg);
      if (errEl) { errEl.textContent = 'Apple-login fejlede. Prøv igen.'; errEl.classList.add('visible'); }
    }
  }

  // Push-toggle virker med det samme (uafhængigt af sektionens gem-knap) — delegeret
  // så den overlever re-render af sektionen. iOS-prompten udløses først ved tilvalg.
  document.addEventListener('change', async (e) => {
    if (!e.target || e.target.id !== 'notif-push-device') return;
    const box = e.target;
    try {
      if (box.checked) {
        await API.enablePushOnThisDevice();
        showToast('Push-notifikationer slået til på denne enhed', 'success');
      } else {
        await API.disablePushOnThisDevice();
        showToast('Push slået fra på denne enhed', 'success');
      }
    } catch (err) {
      box.checked = false;
      showToast(err && err.code === 'denied'
        ? 'Tilladelse afvist — slå notifikationer til under Indstillinger → Flango Portal'
        : 'Kunne ikke aktivere push. Prøv igen.', 'error');
    }
  });

  function renderLogin() {
    const brandHTML = LOGIN_LOCKUP_HTML;

    if (loginView === 'signup-code') {
      // ─── STEP 1: Enter portal code ───
      root.innerHTML = `
        <div class="login-screen">
          <div class="login-card">
            ${brandHTML}
            <div class="login-title">Opret forældrekonto</div>
            <div class="login-subtitle">Indtast den 8-tegns kode du har modtaget fra institutionen via Aula.</div>
            <div class="login-error" id="signup-code-error"></div>
            <div class="login-field">
              <label for="signup-portal-code">Portal-kode</label>
              <input type="text" id="signup-portal-code" class="input-field signup-code-input" placeholder="F.eks. A1B2C3D4" maxlength="8" autocomplete="off" style="text-transform:uppercase;letter-spacing:3px;font-size:20px;text-align:center;font-weight:700">
            </div>
            <button class="save-btn full" id="verify-code-btn" style="margin-top:var(--s4)">Verificer kode</button>
            <div class="login-links">
              <a href="#" id="back-to-login-from-code">Har du allerede en konto? Log ind</a>
            </div>
          </div>
        </div>`;

      document.getElementById('verify-code-btn').addEventListener('click', handleVerifyPortalCode);
      document.getElementById('signup-portal-code').addEventListener('keydown', e => { if (e.key === 'Enter') handleVerifyPortalCode(); });
      document.getElementById('back-to-login-from-code').addEventListener('click', e => { e.preventDefault(); showLoginView('login'); });
      // Auto-focus
      setTimeout(() => document.getElementById('signup-portal-code')?.focus(), 100);

    } else if (loginView === 'signup-auth') {
      // ─── STEP 2: Choose auth method (after code verified) ───
      const childName = signupVerifiedData?.child_name || 'dit barn';
      const instName = signupVerifiedData?.institution_name || '';
      root.innerHTML = `
        <div class="login-screen">
          <div class="login-card">
            ${brandHTML}
            <div class="login-title">Opret konto</div>
            <div class="signup-verified-info">
              <div class="signup-verified-child">
                <span class="signup-verified-emoji">🧒</span>
                <div>
                  <div class="signup-verified-name">${childName}</div>
                  <div class="signup-verified-inst">${instName}</div>
                </div>
              </div>
            </div>
            <div class="login-subtitle">Vælg hvordan du vil oprette din konto.</div>
            <div class="login-error" id="signup-auth-error"></div>
            <div class="login-success" id="signup-auth-success"></div>${appleAuthButtonHTML('signup-apple-btn')}
            <button class="google-btn full" id="signup-google-btn">
              ${googleIconSVG}
              <span>Fortsæt med Google</span>
            </button>
            <div class="login-divider"><span>eller</span></div>
            <div class="login-field">
              <label for="signup-email">E-mail</label>
              <input type="email" id="signup-email" class="input-field" placeholder="din@email.dk" autocomplete="email">
            </div>
            <div class="login-field">
              <label for="signup-password">Adgangskode</label>
              <input type="password" id="signup-password" class="input-field" placeholder="Min. 6 tegn" minlength="6" autocomplete="new-password">
            </div>
            <div class="login-field">
              <label for="signup-password-confirm">Bekræft adgangskode</label>
              <input type="password" id="signup-password-confirm" class="input-field" placeholder="Gentag adgangskode" minlength="6" autocomplete="new-password">
            </div>
            <div id="turnstile-portal-signup" class="cf-turnstile" data-sitekey="0x4AAAAAACyNOCuIOJjI0pUa" data-theme="light" style="margin-top:var(--s3)"></div>
            <button class="save-btn full" id="signup-email-btn" style="margin-top:var(--s3)">Opret med e-mail</button>
            <div class="login-links">
              <a href="#" id="back-to-code-step">Tilbage</a>
              <a href="#" id="goto-login-from-signup">Har du allerede en konto? Log ind</a>
            </div>
          </div>
        </div>`;

      document.getElementById('signup-google-btn').addEventListener('click', handleSignupWithGoogle);
      const signupAppleBtn = document.getElementById('signup-apple-btn');
      if (signupAppleBtn) signupAppleBtn.addEventListener('click', () => handleAppleAuth('signup-auth-error'));
      document.getElementById('signup-email-btn').addEventListener('click', handleSignupWithEmail);
      document.getElementById('signup-password-confirm').addEventListener('keydown', e => { if (e.key === 'Enter') handleSignupWithEmail(); });
      document.getElementById('back-to-code-step').addEventListener('click', e => { e.preventDefault(); showLoginView('signup-code'); });
      document.getElementById('goto-login-from-signup').addEventListener('click', e => { e.preventDefault(); showLoginView('login'); });
      ensureTurnstileWidget('turnstile-portal-signup');

    } else if (loginView === 'forgot') {
      root.innerHTML = `
        <div class="login-screen">
          <div class="login-card">
            ${brandHTML}
            <div class="login-title">Nulstil adgangskode</div>
            <div class="login-subtitle">Indtast din e-mail, så sender vi et link til at vælge en ny adgangskode.</div>
            <div class="login-error" id="forgot-error"></div>
            <div class="login-success" id="forgot-success"></div>
            <div class="login-field">
              <label for="forgot-email">E-mail</label>
              <input type="email" id="forgot-email" class="input-field" placeholder="din@email.dk" autocomplete="email">
            </div>
            <button class="save-btn full" id="forgot-btn" style="margin-top:var(--s4)">Send nulstillingslink</button>
            <div class="login-links">
              <a href="#" id="back-to-login-link">Tilbage til login</a>
            </div>
          </div>
        </div>`;

      document.getElementById('forgot-btn').addEventListener('click', handleForgotSubmit);
      document.getElementById('forgot-email').addEventListener('keydown', e => { if (e.key === 'Enter') handleForgotSubmit(); });
      document.getElementById('back-to-login-link').addEventListener('click', e => { e.preventDefault(); showLoginView('login'); });

    } else {
      // ─── Default: login view ───
      root.innerHTML = `
        <div class="login-screen">
          <div class="login-card">
            ${brandHTML}
            <div class="login-title">Forældreportal</div>
            <div class="login-subtitle">Log ind med din konto for at se saldo, sætte grænser og mere.</div>
            <div class="login-error" id="login-error"></div>${appleAuthButtonHTML('login-apple-btn')}
            <button class="google-btn full" id="login-google-btn">
              ${googleIconSVG}
              <span>Fortsæt med Google</span>
            </button>
            <div class="login-divider"><span>eller</span></div>
            <div class="login-field">
              <label for="login-email">E-mail</label>
              <input type="email" id="login-email" class="input-field" placeholder="din@email.dk" autocomplete="email">
            </div>
            <div class="login-field">
              <label for="login-password">Adgangskode</label>
              <input type="password" id="login-password" class="input-field" placeholder="Din adgangskode" autocomplete="current-password">
            </div>
            <label style="display:flex;align-items:center;gap:var(--s2);margin-top:var(--s3);cursor:pointer;font-size:13px;color:var(--ink-soft)">
              <input type="checkbox" id="login-remember-me" checked style="width:18px;height:18px;cursor:pointer;accent-color:var(--flango)">
              Husk mig på denne enhed
            </label>
            <div style="font-size:11px;color:var(--ink-muted);margin-top:2px;margin-left:26px">Du kan altid logge ud via Profil-menuen</div>
            <!-- Turnstile fjernet fra login (2026-04-27): Supabase auth's
                 indbyggede rate-limiting (5 fejlede forsøg/email/min) +
                 audit-log af logins giver tilstrækkelig brute-force-
                 beskyttelse. Turnstile beholdes på signup + password-reset
                 hvor risikoen er højere (bot-kontooprettelse,
                 email-flooding). -->
            <button class="save-btn full" id="login-btn" style="margin-top:var(--s3)">Log ind</button>
            <div class="login-links">
              <a href="#" id="forgot-link">Glemt adgangskode?</a>
              <a href="#" id="goto-signup-link" class="login-link-bold">Opret konto</a>
            </div>
            <div style="margin-top:var(--s4);padding-top:var(--s4);border-top:1px solid var(--border);text-align:center">
              <button type="button" id="demo-login-btn" style="background:transparent;border:1.5px solid var(--flango);color:var(--flango);font-weight:600;font-size:14px;padding:0.6rem 1.1rem;border-radius:10px;cursor:pointer;width:100%">👀 Prøv portalen som gæst</button>
              <div style="font-size:12px;color:var(--ink-muted);margin-top:6px">Se en demo med fiktive børn — ingen konto nødvendig</div>
            </div>
          </div>
        </div>`;

      document.getElementById('login-google-btn').addEventListener('click', handleGoogleLogin);
      const loginAppleBtn = document.getElementById('login-apple-btn');
      if (loginAppleBtn) loginAppleBtn.addEventListener('click', () => handleAppleAuth('login-error'));
      document.getElementById('login-btn').addEventListener('click', handleLogin);
      document.getElementById('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
      document.getElementById('forgot-link').addEventListener('click', e => { e.preventDefault(); showLoginView('forgot'); });
      document.getElementById('goto-signup-link').addEventListener('click', e => { e.preventDefault(); showLoginView('signup-code'); });
      document.getElementById('demo-login-btn').addEventListener('click', handleDemoLogin);
      // (Turnstile fjernet fra login — se kommentar i HTML-templaten)
    }
  }

  // ─── Login handler (email/password) ───
  async function handleLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');

    if (!email || !password) {
      errorEl.textContent = 'Udfyld venligst e-mail og adgangskode';
      errorEl.classList.add('visible');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Logger ind...';
    errorEl.classList.remove('visible');

    // Wrap hele flowet i try/finally så knap-state ALTID ruller tilbage
    // ved fejl. Turnstile er fjernet fra login (2026-04-27) — Supabase
    // auth's rate-limiting dækker brute-force-risikoen.
    try {
      try {
        await API.signIn(email, password);
        const rememberMe = document.getElementById('login-remember-me');
        if (rememberMe && !rememberMe.checked) {
          window.__flangoForgetOnClose = true;
        }
        currentSession = await API.getSession();
        startInactivityTimeout();
        await loadChildren();
        return; // success — undgå at btn-state ruller tilbage (loading state ok mens loadChildren kører)
      } catch (signInErr) {
        errorEl.textContent = 'Forkert e-mail eller adgangskode';
        errorEl.classList.add('visible');
      }
    } catch (unexpected) {
      console.error('[Portal] handleLogin uventet fejl:', unexpected);
      errorEl.textContent = 'Der opstod en fejl. Prøv at genindlæse siden.';
      errorEl.classList.add('visible');
    } finally {
      // Hvis vi nåede her uden at vende tilbage success, reset knap
      if (btn.textContent === 'Logger ind...') {
        btn.disabled = false;
        btn.textContent = 'Log ind';
      }
    }
  }

  // ─── Demo-/gæste-login: "Prøv portalen" ───
  async function handleDemoLogin() {
    const errorEl = document.getElementById('login-error');
    const btn = document.getElementById('demo-login-btn');
    if (errorEl) errorEl.classList.remove('visible');
    if (btn) { btn.disabled = true; btn.textContent = 'Starter demo …'; }
    try {
      await API.signIn(DEMO_EMAIL, DEMO_PASSWORD);
      window.__flangoForgetOnClose = true; // demo-session skal ikke overleve at fanen lukkes
      currentSession = await API.getSession();
      startInactivityTimeout();
      await loadChildren();
      return; // success — loading-state ok mens børn hentes
    } catch (err) {
      console.error('[Portal] demo-login fejl:', err);
      if (errorEl) { errorEl.textContent = 'Kunne ikke starte demoen. Prøv igen.'; errorEl.classList.add('visible'); }
      if (btn) { btn.disabled = false; btn.textContent = '👀 Prøv portalen som gæst'; }
    }
  }

  // ─── Login handler (Google OAuth) ───
  async function handleGoogleLogin() {
    const errorEl = document.getElementById('login-error');
    if (errorEl) errorEl.classList.remove('visible');
    try {
      await API.signInWithGoogle();
      // Redirect happens automatically — Supabase handles the OAuth flow
    } catch (err) {
      console.error('[Portal] Google login fejl:', err);
      if (errorEl) {
        errorEl.textContent = 'Kunne ikke starte Google login. Prøv igen.';
        errorEl.classList.add('visible');
      }
    }
  }

  // ─── Vilkårsaccept (terms) ───

  const CURRENT_TERMS_VERSION = 1;

  function renderPrivacyInfoText() {
    const instName = getInstitutionName() || 'din institution';
    // Dynamisk: vis institutionens FAKTISKE valgte sletningspolitik (auto-delete
    // kommer med i childData.institution fra get-parent-view). Default: aktiveret/12 mdr.
    const adInst = childData?.institution || {};
    const adEnabled = adInst.auto_delete_inactive_enabled !== false;
    const adMonths = adInst.auto_delete_inactive_months || 12;
    const retentionLine = adEnabled
      ? `Inaktive profiler arkiveres og slettes automatisk efter <strong>${adMonths} måneders</strong> inaktivitet (${esc(instName)}s valg). Profilen arkiveres først og kan gendannes; du varsles pr. e-mail før den endelige sletning og kan altid bede om sletning før tid.`
      : `${esc(instName)} har ikke slået automatisk sletning til — inaktive profiler slettes kun på din eller institutionens anmodning.`;
    return `
      <p style="margin:0 0 10px"><strong>Hvad er Flango?</strong><br>Flango er det cafésystem som ${esc(instName)} bruger til cafédriften. Dit barn handler i caféen med en forudbetalt cafékonto — du fylder kontoen op, og barnet bruger saldoen til mad og drikke i caféen.</p>
      <p style="margin:0 0 10px"><strong>Hvilke data har vi?</strong><br>Barnets navn og kontonummer i caféen, saldo og købshistorik, eventuelle kostindstillinger du har sat (allergener, sukkerpolitik) og forbrugsgrænser du har valgt.</p>
      <p style="margin:0 0 10px"><strong>Hvem har adgang?</strong><br>Du som forælder (via denne portal), institutionens personale (via caféappen) og Flango som databehandler (teknisk drift). Kommunen er dataansvarlig.</p>
      <p style="margin:0 0 10px"><strong>Hvor opbevares data?</strong><br>Alle data opbevares i EU. Al kommunikation er krypteret. Data sælges aldrig og deles kun med de nødvendige under-databehandlere (hosting, betaling, e-mail m.fl.).</p>
      <p style="margin:0 0 10px"><strong>Hvor længe opbevares data?</strong><br>${retentionLine} Salgsbilag bevares i 5 år som anonymiserede rækker (lovkrav fra bogføringsloven) — beløb og datoer bevares uden barnets navn. Systemlogs opbevares i 24 måneder og anonymiseres derefter.</p>
      <p style="margin:0"><strong>Dine rettigheder</strong><br>Som forælder har du ret til indsigt, berigtigelse, sletning, dataportabilitet og indsigelse — alt tilgængeligt via "Privatliv & Rettigheder" i portalen.</p>`;
  }

  function renderTermsContent(childName) {
    return `
      <div style="line-height:1.7;color:var(--ink-soft);margin-bottom:var(--s4)">
        <p style="margin:0 0 var(--s3);font-weight:600;color:var(--ink)">Ved at tilknytte ${esc(childName || 'dit barn')} bekræfter du at du er informeret om at:</p>
        <ul style="margin:0;padding-left:20px;list-style:disc">
          <li>Barnets navn og saldo vises på caféskærmen ved køb</li>
          <li>Historik for køb, indbetalinger og tilmeldinger opbevares</li>
          <li>Alle data opbevares krypteret i EU (Irland) hos Supabase</li>
          <li>Du kan til enhver tid se, eksportere og anmode om sletning af data via "Privatliv & Rettigheder" i portalen</li>
        </ul>
      </div>
      <details style="margin-bottom:var(--s4);border:1px solid var(--border);border-radius:var(--r-sm);overflow:hidden;">
        <summary style="padding:10px 14px;cursor:pointer;font-weight:600;font-size:13px;color:var(--info);background:var(--surface-sunken);user-select:none;list-style:none;display:flex;align-items:center;gap:6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="transition:transform 0.2s"><polyline points="9 18 15 12 9 6"/></svg>
          Læs mere om hvordan vi behandler data
        </summary>
        <div style="padding:14px;font-size:13px;line-height:1.6;color:var(--ink-soft);border-top:1px solid var(--border);">
          ${renderPrivacyInfoText()}
        </div>
      </details>
      <a href="https://flango.dk/privatlivspolitik/" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;color:var(--info);font-weight:600;text-decoration:none;margin-bottom:var(--s4);font-size:13px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        Læs den fulde privatlivspolitik
      </a>`;
  }

  /**
   * Blokerende vilkårsaccept for børn der mangler accept.
   * Viser en modal pr. barn. Returnerer når alle er accepteret.
   */
  async function showTermsAcceptFlow(unacceptedChildren) {
    for (const child of unacceptedChildren) {
      await new Promise((resolve) => {
        const backdrop = document.createElement('div');
        backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
        const box = document.createElement('div');
        box.style.cssText = 'background:#fff;border-radius:16px;padding:28px;max-width:480px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,0.2);max-height:90vh;overflow-y:auto;';
        box.innerHTML = `
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:var(--s4)">
            <div style="width:44px;height:44px;border-radius:12px;background:var(--flango-light);display:flex;align-items:center;justify-content:center;font-size:22px">🛡️</div>
            <div>
              <div style="font-weight:700;font-size:17px;color:var(--ink)">Vilkår for brug</div>
              <div style="font-size:13px;color:var(--ink-muted)">${esc(child.child_name)}</div>
            </div>
          </div>
          ${renderTermsContent(child.child_name)}
          <label style="display:flex;align-items:center;gap:var(--s2);cursor:pointer;margin-bottom:var(--s4);padding:12px;background:var(--surface-sunken);border-radius:var(--r-sm)">
            <input type="checkbox" id="terms-accept-cb" style="width:20px;height:20px;cursor:pointer;accent-color:var(--flango)">
            <span style="font-weight:600;font-size:14px">Jeg accepterer vilkårene</span>
          </label>
          <button id="terms-accept-btn" disabled style="width:100%;padding:14px;border:none;border-radius:var(--r-sm);background:var(--flango);color:#fff;font-size:15px;font-weight:700;cursor:pointer;opacity:0.5;transition:opacity 0.2s">Fortsæt</button>
        `;
        backdrop.appendChild(box);
        document.body.appendChild(backdrop);

        const cb = box.querySelector('#terms-accept-cb');
        const btn = box.querySelector('#terms-accept-btn');
        cb.addEventListener('change', () => {
          btn.disabled = !cb.checked;
          btn.style.opacity = cb.checked ? '1' : '0.5';
        });
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          btn.textContent = 'Gemmer...';
          try {
            await API.acceptTerms(child.child_id, CURRENT_TERMS_VERSION);
            backdrop.remove();
            resolve();
          } catch (err) {
            console.error('[Terms] Accept error:', err);
            btn.textContent = 'Fejl — prøv igen';
            btn.disabled = false;
            btn.style.opacity = '1';
          }
        });
      });
    }
  }

  /**
   * Vis vilkårsaccept i tilknytningsflowet.
   * Returnerer true hvis accepteret, false hvis annulleret.
   */
  function showTermsAcceptForLinking(childName) {
    return new Promise((resolve) => {
      const backdrop = document.createElement('div');
      backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
      const box = document.createElement('div');
      box.style.cssText = 'background:#fff;border-radius:16px;padding:28px;max-width:480px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,0.2);max-height:90vh;overflow-y:auto;';
      box.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:var(--s4)">
          <div style="width:44px;height:44px;border-radius:12px;background:var(--flango-light);display:flex;align-items:center;justify-content:center;font-size:22px">🛡️</div>
          <div>
            <div style="font-weight:700;font-size:17px;color:var(--ink)">Vilkår for brug</div>
            <div style="font-size:13px;color:var(--ink-muted)">Tilknyt ${esc(childName || 'barn')}</div>
          </div>
        </div>
        ${renderTermsContent(childName)}
        <label style="display:flex;align-items:center;gap:var(--s2);cursor:pointer;margin-bottom:var(--s4);padding:12px;background:var(--surface-sunken);border-radius:var(--r-sm)">
          <input type="checkbox" id="terms-link-cb" style="width:20px;height:20px;cursor:pointer;accent-color:var(--flango)">
          <span style="font-weight:600;font-size:14px">Jeg accepterer vilkårene</span>
        </label>
        <div style="display:flex;gap:var(--s2)">
          <button id="terms-link-cancel" style="flex:1;padding:12px;border:1px solid var(--border);border-radius:var(--r-sm);background:#fff;font-size:14px;cursor:pointer;">Annuller</button>
          <button id="terms-link-accept" disabled style="flex:1;padding:12px;border:none;border-radius:var(--r-sm);background:var(--flango);color:#fff;font-size:14px;font-weight:700;cursor:pointer;opacity:0.5;transition:opacity 0.2s">Tilknyt barn</button>
        </div>
      `;
      backdrop.appendChild(box);
      document.body.appendChild(backdrop);

      const cb = box.querySelector('#terms-link-cb');
      const acceptBtn = box.querySelector('#terms-link-accept');
      const cancelBtn = box.querySelector('#terms-link-cancel');
      cb.addEventListener('change', () => {
        acceptBtn.disabled = !cb.checked;
        acceptBtn.style.opacity = cb.checked ? '1' : '0.5';
      });
      acceptBtn.addEventListener('click', () => { backdrop.remove(); resolve(true); });
      cancelBtn.addEventListener('click', () => { backdrop.remove(); resolve(false); });
      backdrop.addEventListener('click', (e) => { if (e.target === backdrop) { backdrop.remove(); resolve(false); } });
    });
  }

  // ─── "Husk mig" — ryd session ved lukning hvis ikke valgt ───
  window.addEventListener('beforeunload', () => {
    if (window.__flangoForgetOnClose) {
      localStorage.removeItem('flango-parent-auth');
    }
  });

  // ─── Forgot password handler ───
  async function handleForgotSubmit() {
    const email = document.getElementById('forgot-email').value.trim();
    const errorEl = document.getElementById('forgot-error');
    const successEl = document.getElementById('forgot-success');
    const btn = document.getElementById('forgot-btn');

    errorEl.classList.remove('visible');
    successEl.classList.remove('visible');

    if (!email) {
      errorEl.textContent = 'Indtast din e-mail.';
      errorEl.classList.add('visible');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Sender...';

    try {
      await API.resetPassword(email);
      successEl.textContent = 'Hvis e-mailen findes i systemet, har vi sendt et link til at nulstille din adgangskode.';
      successEl.classList.add('visible');
    } catch (err) {
      errorEl.textContent = 'Kunne ikke sende nulstillingslink. Prøv igen.';
      errorEl.classList.add('visible');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Send nulstillingslink';
    }
  }

  // ─── Signup STEP 1: Verify portal code ───
  async function handleVerifyPortalCode() {
    const errorEl = document.getElementById('signup-code-error');
    const btn = document.getElementById('verify-code-btn');
    const codeInput = document.getElementById('signup-portal-code');

    errorEl.classList.remove('visible');
    const code = (codeInput?.value || '').trim().toUpperCase();

    if (!code || code.length !== 8) {
      errorEl.textContent = 'Koden skal være præcis 8 tegn.';
      errorEl.classList.add('visible');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Verificerer...';

    try {
      // Prøv først som portal-kode (aktiveringskode fra admin)
      const result = await API.verifyPortalCodeForSignup(code);
      if (result?.valid) {
        // Aktiveringskode verificeret
        signupVerifiedData = {
          code: code,
          type: 'activation',
          child_name: result.child_name,
          child_id: result.child_id,
          institution_name: result.institution_name,
          institution_id: result.institution_id,
        };
        showLoginView('signup-auth');
        return;
      }

      // Håndter specifikke fejl fra aktiveringskode
      if (result?.error === 'CODE_EXPIRED') {
        errorEl.textContent = 'Denne kode er udl\u00f8bet. Kontakt personalet for en ny kode.';
        errorEl.classList.add('visible');
        return;
      }

      // Hvis ikke fundet som aktiveringskode, prøv som invitationskode
      if (result?.error === 'LOOKUP_FAILED') {
        const inviteResult = await API.verifyInviteCodeForSignup(code);
        if (inviteResult?.valid) {
          // Invitationskode verificeret
          const childNames = inviteResult.children_names || [];
          signupVerifiedData = {
            code: code,
            type: 'invite',
            invite_code: inviteResult.invite_code,
            institution_name: inviteResult.institution_name,
            institution_id: inviteResult.institution_id,
            children_names: childNames,
          };
          showLoginView('signup-auth');
          return;
        }

        if (inviteResult?.error === 'INVITE_EXPIRED') {
          errorEl.textContent = 'Denne kode er udl\u00f8bet. Bed den anden for\u00e6lder om at generere en ny.';
          errorEl.classList.add('visible');
          return;
        }

        // Ingen match som hverken aktiverings- eller invitationskode
        errorEl.textContent = 'Ugyldig kode. Tjek koden og pr\u00f8v igen.';
        errorEl.classList.add('visible');
        return;
      }

      // Andre fejl fra aktiveringskode
      errorEl.textContent = result?.error || 'Ugyldig kode. Tjek koden og pr\u00f8v igen.';
      errorEl.classList.add('visible');

    } catch (err) {
      console.error('[signup] Code verification error:', err);
      errorEl.textContent = err?.message || 'Kunne ikke verificere koden. Pr\u00f8v igen.';
      errorEl.classList.add('visible');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Verificer kode';
    }
  }

  // ─── Signup STEP 2a: Create account with Google ───
  async function handleSignupWithGoogle() {
    const errorEl = document.getElementById('signup-auth-error');
    if (errorEl) errorEl.classList.remove('visible');

    if (!signupVerifiedData) {
      showLoginView('signup-code');
      return;
    }

    // Save verified data to sessionStorage so we can link after Google redirect
    try {
      sessionStorage.setItem('flango_signup_pending', JSON.stringify(signupVerifiedData));
    } catch (e) {
      console.warn('[signup] Could not save to sessionStorage:', e);
    }

    try {
      await API.signInWithGoogle();
      // Redirect happens automatically
    } catch (err) {
      console.error('[signup] Google signup error:', err);
      if (errorEl) {
        errorEl.textContent = 'Kunne ikke starte Google login. Prøv igen.';
        errorEl.classList.add('visible');
      }
    }
  }

  // ─── Signup STEP 2b: Create account with email/password ───
  async function handleSignupWithEmail() {
    const errorEl = document.getElementById('signup-auth-error');
    const successEl = document.getElementById('signup-auth-success');
    const btn = document.getElementById('signup-email-btn');

    errorEl.classList.remove('visible');
    successEl.classList.remove('visible');

    if (!signupVerifiedData) {
      showLoginView('signup-code');
      return;
    }

    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const passwordConfirm = document.getElementById('signup-password-confirm').value;

    if (!email || !password) {
      errorEl.textContent = 'Udfyld e-mail og adgangskode.';
      errorEl.classList.add('visible');
      return;
    }
    if (password !== passwordConfirm) {
      errorEl.textContent = 'Adgangskoderne er ikke ens.';
      errorEl.classList.add('visible');
      return;
    }
    if (password.length < 6) {
      errorEl.textContent = 'Adgangskoden skal være mindst 6 tegn.';
      errorEl.classList.add('visible');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Opretter konto...';

    // Turnstile verifikation
    const turnstileCheck = await verifyTurnstileToken('turnstile-portal-signup');
    if (!turnstileCheck.ok) {
      errorEl.textContent = turnstileCheck.error;
      errorEl.classList.add('visible');
      btn.disabled = false;
      btn.textContent = 'Opret med e-mail';
      return;
    }

    try {
      // Create auth user
      let signUpData;
      try {
        signUpData = await API.signUp(email, password);
      } catch (signUpErr) {
        let msg = signUpErr?.message || '';
        if (msg.includes('already registered')) {
          errorEl.innerHTML = 'Denne e-mail er allerede registreret. <a href="#" id="goto-login-from-error" style="color:var(--info);text-decoration:underline;font-weight:600">Log ind</a> for at tilknytte flere børn.';
          errorEl.classList.add('visible');
          const loginLink = errorEl.querySelector('#goto-login-from-error');
          if (loginLink) loginLink.addEventListener('click', e => { e.preventDefault(); showLoginView('login'); });
          return;
        }
        errorEl.textContent = msg || 'Kunne ikke oprette konto. Prøv igen.';
        errorEl.classList.add('visible');
        return;
      }

      // If email confirmation required (no immediate session)
      if (!signUpData.session) {
        // Save pending link data for after email confirmation
        try {
          sessionStorage.setItem('flango_signup_pending', JSON.stringify(signupVerifiedData));
        } catch (e) { /* ignore */ }
        successEl.textContent = 'Tjek din e-mail for at bekræfte din konto. Klik på linket i mailen, og log derefter ind.';
        successEl.classList.add('visible');
        setTimeout(() => showLoginView('login'), 4000);
        return;
      }

      // Vis vilkårsaccept FØR linking
      const termsAccepted = await showTermsAcceptForLinking(signupVerifiedData.child_name || 'dit barn');
      if (!termsAccepted) {
        btn.disabled = false;
        btn.textContent = 'Opret med e-mail';
        return;
      }

      // Link child(ren) to parent
      btn.textContent = 'Tilknytter barn...';
      try {
        if (signupVerifiedData.type === 'invite') {
          await API.redeemParentInvite(signupVerifiedData.code);
        } else {
          await API.linkChildByPortalCode(signupVerifiedData.code);
        }
        // Acceptér vilkår for nyligt tilknyttede børn
        try {
          const refreshed = await API.getChildren();
          for (const c of refreshed.filter(ch => !ch.terms_accepted_at)) {
            await API.acceptTerms(c.child_id, CURRENT_TERMS_VERSION);
          }
        } catch (_e) { /* non-critical */ }
      } catch (linkErr) {
        console.error('[signup] Link error:', linkErr);
        // Fall through — attempt to continue
      }

      // Clear pending data
      signupVerifiedData = null;
      try { sessionStorage.removeItem('flango_signup_pending'); } catch (e) { /* ignore */ }

      // Enter portal
      currentSession = await API.getSession();
      await loadChildren();

    } catch (err) {
      console.error('[signup] Email signup error:', err);
      errorEl.textContent = err?.message || 'Der opstod en fejl. Prøv igen.';
      errorEl.classList.add('visible');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Opret med e-mail';
    }
  }

  // ─── Check for pending signup after Google redirect ───
  async function checkPendingSignupLink() {
    let pending = null;
    try {
      const raw = sessionStorage.getItem('flango_signup_pending');
      if (raw) pending = JSON.parse(raw);
    } catch (e) { return; }

    if (!pending?.code || !pending?.institution_id) return;

    console.log('[signup] Found pending signup link, attempting to link child...');
    try {
      if (pending.type === 'invite') {
        await API.redeemParentInvite(pending.code);
      } else {
        await API.linkChildByPortalCode(pending.code);
      }
      // Vilkårsaccept håndteres retrospektivt i loadChildren()
      console.log('[signup] Child linked successfully after redirect');
    } catch (err) {
      console.error('[signup] Pending link error:', err);
    } finally {
      try { sessionStorage.removeItem('flango_signup_pending'); } catch (e) { /* ignore */ }
    }
  }

  // ═══════════════════════════════════════
  //  RENDER: PASSWORD RECOVERY
  // ═══════════════════════════════════════

  function renderPasswordRecovery() {
    root.innerHTML = `
      <div class="login-screen">
        <div class="login-card">
          ${LOGIN_LOCKUP_HTML}
          <div class="login-title">Ny adgangskode</div>
          <div class="login-subtitle">Indtast din nye adgangskode</div>
          <div class="login-error" id="recovery-error"></div>
          <div class="login-field">
            <label for="recovery-pw">Ny adgangskode</label>
            <input type="password" id="recovery-pw" class="input-field" placeholder="Mindst 6 tegn" autocomplete="new-password">
          </div>
          <div class="login-field">
            <label for="recovery-pw2">Gentag adgangskode</label>
            <input type="password" id="recovery-pw2" class="input-field" placeholder="Gentag" autocomplete="new-password">
          </div>
          <button class="save-btn full" id="recovery-btn" style="margin-top:var(--s4)">Gem ny adgangskode</button>
        </div>
      </div>`;

    document.getElementById('recovery-btn').addEventListener('click', async () => {
      const pw = document.getElementById('recovery-pw').value;
      const pw2 = document.getElementById('recovery-pw2').value;
      const errorEl = document.getElementById('recovery-error');
      if (pw.length < 6) { errorEl.textContent = 'Mindst 6 tegn'; errorEl.classList.add('visible'); return; }
      if (pw !== pw2) { errorEl.textContent = 'Adgangskoderne matcher ikke'; errorEl.classList.add('visible'); return; }
      try {
        await API.updatePassword(pw);
        window.__pendingPasswordRecovery = false;
        showToast('Adgangskode opdateret!', 'success');
        await loadChildren();
      } catch (err) {
        errorEl.textContent = 'Kunne ikke opdatere adgangskoden';
        errorEl.classList.add('visible');
      }
    });
  }

  // ═══════════════════════════════════════
  //  RENDER: NO CHILDREN
  // ═══════════════════════════════════════

  function renderNoChildren() {
    const userEmail = currentSession?.user?.email || '';
    root.innerHTML = `
      <div class="app">
        <header class="topnav">
          <div class="topnav-inner">
            <div class="brand">
              <img src="assets/flango-logo.webp" alt="Flango" class="brand-logo">
              <div><div class="brand-name">Flango</div></div>
            </div>
          </div>
        </header>
        <main class="main">
          <div class="empty-state" style="margin-top:var(--s16)">
            <div class="empty-state-icon">👶</div>
            <div class="empty-state-text">Du har endnu ikke tilknyttet nogen børn.<br>Brug koden fra institutionen for at komme i gang.</div>
            <button class="save-btn" style="margin-top:var(--s5)" onclick="document.getElementById('add-child-modal').classList.add('visible')">Tilknyt barn</button>
            ${userEmail ? `<div style="margin-top:var(--s6);font-size:12px;color:var(--ink-muted);text-align:center;">Logget ind som <strong>${esc(userEmail)}</strong></div>` : ''}
            <button id="no-children-logout" type="button" style="margin-top:var(--s3);padding:10px 20px;border:1px solid var(--border);border-radius:var(--r-md);background:var(--bg);color:var(--ink-soft);font-size:14px;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;gap:8px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Log ud
            </button>
          </div>
        </main>
      </div>
      ${renderAddChildModal()}`;
    bindAddChildModal();
    const logoutBtn = document.getElementById('no-children-logout');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
  }

  function renderError(msg) {
    root.innerHTML = `
      <div class="app">
        <main class="main">
          <div class="empty-state" style="margin-top:var(--s16)">
            <div class="empty-state-icon">⚠️</div>
            <div class="empty-state-text">${msg}</div>
            <button class="save-btn" style="margin-top:var(--s5)" onclick="window.location.reload()">Prøv igen</button>
          </div>
        </main>
      </div>`;
  }

  // ═══════════════════════════════════════
  //  RENDER: MAIN APP
  // ═══════════════════════════════════════

  // Sektion synlig? Server-autoritativ (visible_sections fra get-parent-view).
  // Manglende felt → vist, så et ældre backend-svar aldrig skjuler ved uheld.
  // Bruges kun til opt-out-sektioner; opt-in (skærmtid/ugeplan) har egne === true-tjek.
  // Admin-preview (server-bekræftet, kun admin-parent-sessioner): ALLE sektioner
  // renderes — preview-modulet gråtoner de slukkede i stedet for at skjule dem.
  function secOn(key) { return isAdminPreview() || visibleSections[key] !== false; }

  function renderApp() {
    const balance = getChildBalance();
    const status = getBalanceStatus(balance);
    const name = getChildName();
    // Brugernummer vises kun når institutionen har kontonummer-visning slået til
    const childNo = (childData?.institution?.account_number_enabled !== false && selectedChild?.number != null)
      ? String(selectedChild.number) : '';
    const instName = getInstitutionName();
    const portalSub = instName ? esc(instGenitive(instName)) + ' forældreportal' : 'Forældreportal';

    // Determine which sections are visible based on feature flags
    // parent_portal_events = portal-flag (cafe_events_enabled er for POS-viewet i café-appen)
    const showEvents = secOn('events');
    const showScreentime = featureFlags.skaermtid_enabled === true || isAdminPreview();
    // Ugeplan vises kun når institutionen aktivt har slået den til (default fra).
    const showUgeplan = featureFlags.parent_portal_ugeplan === true || isAdminPreview();
    // Skærmtid-underflag: institutionen kan slå "Godkend spil" og "Spilletids-
    // oversigt" fra separat (gaming.portal_settings, NOT NULL-kolonner der altid
    // graftes med når skaermtid_enabled er sat — så === true er sikkert her).
    const showGames = (showScreentime && featureFlags.skaermtid_allow_game_approval === true) || isAdminPreview();
    const showStChart = (showScreentime && featureFlags.skaermtid_show_usage === true) || isAdminPreview();

    root.innerHTML = `
      <div class="app${isDemo() ? ' demo-mode' : ''}">
        ${isDemo() ? `
        <div class="demo-banner" role="status">
          <span class="demo-banner-badge">DEMO</span>
          <span class="demo-banner-text">Du prøver Flango med fiktive børn. Rigtige betalinger er slået fra.</span>
        </div>` : ''}

        <!-- DESKTOP SIDEBAR -->
        <aside class="desktop-sidebar">
          <div class="brand">
            <img src="assets/flango-logo.webp" alt="Flango" class="brand-logo">
            <div><div class="brand-name">Flango</div><div class="brand-sub">${portalSub}</div></div>
          </div>
          <div class="sidebar-child-section" id="sidebar-children"></div>
          <div class="sidebar-divider"></div>
          <nav class="sidebar-nav" id="sidebar-nav"></nav>
          <div class="sidebar-footer">
            <div class="sidebar-footer-btn" id="sidebar-logout"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>Log ud af denne enhed</div>
          </div>
        </aside>

        <!-- DESKTOP TOP TAB BAR -->
        <nav class="desktop-topnav">
          <div class="desktop-topnav-inner">
            <div class="brand">
              <img src="assets/flango-logo.webp" alt="Flango" class="brand-logo">
              <div><div class="brand-name">Flango</div><div class="brand-sub">${portalSub}</div></div>
            </div>
            <div class="desktop-tab-bar">
              <button class="dtab-item active" data-tab="tab-home"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg><span>Overblik</span></button>
              <button class="dtab-item" data-tab="tab-pay"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg><span>Indbetal</span></button>
              <button class="dtab-item" data-tab="tab-limits"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span>Grænser</span></button>
              <button class="dtab-item" data-tab="tab-profile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span>Profil</span></button>
              <button class="dtab-item" data-tab="tab-privacy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span>Privatliv</span></button>
            </div>
          </div>
        </nav>

        <!-- MOBILE TOP NAV -->
        <header class="topnav">
          <div class="topnav-inner">
            <div class="brand">
              <img src="assets/flango-logo.webp" alt="Flango" class="brand-logo">
              <div>
                <div class="brand-name">Flango</div>
                <div class="brand-sub">${portalSub}</div>
              </div>
            </div>
            <div class="nav-actions">
              <button class="nav-btn" id="nav-logout-btn" title="Log ud"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></button>
            </div>
          </div>
        </header>

        <!-- MAIN CONTENT -->
        <main class="main" id="main-content">

          <!-- TAB: HOME -->
          <div class="tab-view active" id="tab-home">
            ${renderChildSelector()}

            <!-- Balance Card -->
            <div class="balance-card" id="section-balance">
              <div class="balance-header">
                <div>
                  <div class="balance-label">Saldo</div>
                  <div class="balance-amount">${renderBalanceAmount(balance)}</div>
                  <div class="balance-child-name">${esc(name)}${childNo ? ' (' + esc(childNo) + ')' : ''}${instName ? ' · ' + esc(instName) : ''}</div>
                </div>
                <div class="balance-status ${status.cls}"><span class="status-dot"></span> ${status.text}</div>
              </div>
              <div class="topup-row">
                <button class="topup-btn topup-primary" data-nav-tab="tab-pay"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Indbetal</button>
                ${renderBalanceSecondaryAction()}
              </div>
            </div>

            ${showEvents ? renderEventsSection() : ''}
            ${showUgeplan ? renderUgeplanSection() : ''}
            ${secOn('purchase_profile') ? renderPurchaseProfileSection() : ''}
            ${secOn('history') ? renderHistorySection() : ''}
            ${secOn('sortiment') ? renderSortimentSection() : ''}
          </div>

          <!-- TAB: PAY -->
          <div class="tab-view" id="tab-pay">
            <div class="view-header mobile-only"><div class="view-title">Indbetaling</div><div class="view-subtitle">Optank ${esc(name)}s saldo</div></div>
            ${renderTopupSection()}
          </div>

          <!-- TAB: LIMITS (skærmtid er nu et afsnit her, ikke en egen fane) -->
          <div class="tab-view" id="tab-limits">
            <div class="view-header mobile-only"><div class="view-title">Grænser</div><div class="view-subtitle">Grænser${showScreentime ? ', kost & skærmtid' : ' & kost'} for ${esc(name)}</div></div>
            ${secOn('spending_limit') ? renderSpendingLimitSection() : ''}
            ${secOn('product_limit') ? renderProductLimitsSection() : ''}
            ${secOn('sugar_policy') ? renderSugarPolicySection() : ''}
            ${secOn('diet') ? renderDietSection() : ''}
            ${secOn('allergens') ? renderAllergensSection() : ''}
            ${showScreentime ? `${hasCafeLimitSections() ? '<div class="group-divider"><span>Skærmtid</span></div>' : ''}${renderScreentimeSection()}${showGames ? renderGamesSection() : ''}${showStChart ? renderScreentimeChartSection() : ''}` : ''}
          </div>

          <!-- TAB: PROFILE -->
          <div class="tab-view" id="tab-profile">
            <div class="view-header mobile-only"><div class="view-title">Profil</div><div class="view-subtitle">Barnets profil & indstillinger</div></div>
            ${renderChildNameSection()}
            ${renderProfilePictureSection()}
            ${renderTransferSection()}
            ${secOn('notifications') ? renderNotificationsSection() : ''}
            ${renderInviteParentSection()}
            ${secOn('feedback') ? renderFeedbackSection() : ''}
            ${renderPinSection()}
          </div>

          <!-- TAB: PRIVACY & RIGHTS -->
          <div class="tab-view" id="tab-privacy">
            <div class="view-header mobile-only"><div class="view-title">Privatliv & Rettigheder</div><div class="view-subtitle">GDPR og persondata</div></div>
            ${renderPrivacyPolicySection()}
            ${renderConsentsSection()}
            ${renderDataInsightSection()}
            ${renderLinkedParentsSection()}
            ${renderDeleteChildDataSection()}
            ${renderDeleteParentAccountSection()}
            ${renderContactSection()}
          </div>

        </main>

        <!-- MOBILE BOTTOM NAV -->
        <nav class="bottomnav">
          <button class="bnav-item active" data-tab="tab-home"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg><span class="bnav-label">Overblik</span></button>
          <button class="bnav-item" data-tab="tab-pay"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg><span class="bnav-label">Indbetal</span></button>
          <button class="bnav-item" data-tab="tab-limits"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span class="bnav-label">Grænser</span></button>
          <button class="bnav-item" data-tab="tab-profile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span class="bnav-label">Profil</span></button>
          <button class="bnav-item" data-tab="tab-privacy"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span class="bnav-label">Privatliv</span></button>
        </nav>

      </div>
      ${renderAddChildModal()}`;

    // Render dynamic sidebar content first, then bind all events
    renderSidebarChildren();
    renderSidebarNav('tab-home');
    bindEvents();

    // Admin-preview: dekorér sektionerne (grå + toggle-chips) efter hver render.
    if (isAdminPreview() && window.FlangoAdminPreview) {
      window.FlangoAdminPreview.onRender(childData?.preview_sections || []);
    }

    // Auto-load purchase profile (always open by default)
    loadPurchaseProfile();
  }

  // ═══════════════════════════════════════
  //  SECTION RENDERERS
  // ═══════════════════════════════════════

  function renderChildSelector() {
    // Dropdown i Flango-stil (mobile-first). Vises også med ét barn, så
    // "Tilknyt ekstra barn" altid er opdagelig; med 0 børn håndterer
    // tom-tilstanden andetsteds sin egen "Tilknyt barn"-knap.
    if (!children.length) return '';
    const active = children.find(c => c.child_id === selectedChild?.child_id) || children[0];
    const emojiOf = c => c.avatar_emoji || c.emoji || '🧒';
    const rows = children.map(c => {
      const isActive = c.child_id === active.child_id;
      const bal = c.balance != null ? `<span class="child-dd-bal">${formatKr(c.balance)} kr</span>` : '';
      const check = isActive ? '<svg class="child-dd-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : '';
      return `<button class="child-dd-item${isActive ? ' active' : ''}" data-child-id="${c.child_id}"><span class="child-avatar">${emojiOf(c)}</span><span class="child-dd-name">${esc(formatChildName(c))}</span>${bal}${check}</button>`;
    }).join('');
    const activeBal = active.balance != null ? `<span class="child-dd-bal">${formatKr(active.balance)} kr</span>` : '';
    return `<div class="child-selector"><div class="child-dd" id="child-dd">
      <button class="child-dd-trigger" id="child-dd-trigger" aria-haspopup="listbox" aria-expanded="false"><span class="child-avatar">${emojiOf(active)}</span><span class="child-dd-name">${esc(formatChildName(active))}</span>${activeBal}<svg class="child-dd-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg></button>
      <div class="child-dd-menu" id="child-dd-menu" hidden>${rows}<button class="child-dd-item child-dd-add" id="add-child-btn-mobile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Tilknyt ekstra barn</button></div>
    </div></div>`;
  }

  function renderBalanceAmount(balance) {
    const b = parseFloat(balance || 0);
    const whole = Math.floor(Math.abs(b));
    const dec = Math.round((Math.abs(b) - whole) * 100);
    const sign = b < 0 ? '-' : '';
    if (dec === 0) return `${sign}${whole} <span class="currency">kr</span>`;
    return `${sign}${whole}<span style="font-size:32px">,${dec.toString().padStart(2, '0')}</span> <span class="currency">kr</span>`;
  }

  function renderEventsSection() {
    const events = eventsData?.events || eventsData || [];
    if (!events || events.length === 0) {
      return `
        <div class="section" id="section-events">
          <div class="section-header">
            <div class="section-title-row"><div class="section-icon" style="background:var(--negative-light)">📅</div><div><div class="section-title">Kommende arrangementer</div><div class="section-subtitle">Ingen kommende arrangementer</div></div></div>
            <svg class="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div class="section-body"><div class="section-body-inner"><div class="section-content">
            <div class="empty-state"><div class="empty-state-icon">📅</div><div class="empty-state-text">Ingen kommende arrangementer</div></div>
          </div></div></div>
        </div>`;
    }

    const eventCards = events.map(ev => {
      const d = new Date(ev.event_date);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
      const month = months[d.getMonth()];
      const day = d.getDate();
      const time = ev.start_time ? formatTime(ev.start_time) + (ev.end_time ? '–' + formatTime(ev.end_time) : '') : '';
      const price = ev.price > 0 ? `${formatKr(ev.price)} kr` : 'Gratis';
      const meta = [time, price].filter(Boolean).join(' · ');
      const spotsLeft = ev.remaining != null ? ev.remaining : null;
      const spotsStr = spotsLeft != null ? `${spotsLeft} plads${spotsLeft !== 1 ? 'er' : ''} tilbage` : '';

      // Determine registration state
      const reg = ev.registration || {};
      const regStatus = ev.registration_status || reg.registration_status;
      const payStatus = ev.payment_status || reg.payment_status;
      const isRegistered = regStatus === 'registered';
      const isCancelled = regStatus === 'cancelled';
      const isFull = spotsLeft != null && spotsLeft <= 0 && !isRegistered;

      let badgeHTML = '';
      let actionsHTML = '';

      if (isRegistered) {
        if (payStatus === 'paid' || payStatus === 'not_required') {
          badgeHTML = '<span class="event-badge paid">✓ Tilmeldt & Betalt</span>';
        } else if (payStatus === 'not_paid') {
          badgeHTML = '<span class="event-badge pending">Afventer betaling</span>';
          actionsHTML += `<button class="event-pay-btn" data-event-id="${ev.id}" data-event-price="${ev.price}">Betal nu</button>`;
        } else {
          badgeHTML = '<span class="event-badge registered">✓ Tilmeldt</span>';
        }
        actionsHTML += `<button class="event-cancel-btn" data-event-id="${ev.id}">Frameld</button>`;
      } else if (isCancelled) {
        badgeHTML = '<span class="event-badge cancelled">Afmeldt</span>';
        actionsHTML = `<button class="event-action-btn" data-event-id="${ev.id}">Tilmeld igen</button>`;
      } else if (isFull) {
        badgeHTML = '<span class="event-badge" style="background:#f1f5f9;color:#64748b">Fuldt booket</span>';
      } else {
        actionsHTML = `<button class="event-action-btn" data-event-id="${ev.id}" data-event-price="${ev.price || 0}">Tilmeld</button>`;
      }

      return `<div class="event-card">
        <div class="event-date-badge"><div class="event-month">${month}</div><div class="event-day">${day}</div></div>
        <div class="event-info">
          <div class="event-title">${esc(ev.title)}</div>
          <div class="event-meta">${esc(meta)}${spotsStr ? ' · ' + spotsStr : ''}</div>
          ${badgeHTML ? '<div style="margin-top:4px">' + badgeHTML + '</div>' : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">${actionsHTML}</div>
      </div>`;
    }).join('');

    return `
      <div class="section" id="section-events">
        <div class="section-header">
          <div class="section-title-row"><div class="section-icon" style="background:var(--negative-light)">📅</div><div><div class="section-title">Kommende arrangementer</div><div class="section-subtitle">${events.length} arrangement${events.length !== 1 ? 'er' : ''}</div></div></div>
          <svg class="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="section-body"><div class="section-body-inner"><div class="section-content">
          ${eventCards}
        </div></div></div>
      </div>`;
  }

  // ─── Ugeplan (skrivebeskyttet, lodret — "ligesom en pdf") ───

  const UGEPLAN_DAYS = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag'];

  // ISO-ugenummer + år for en dato
  function isoWeekYear(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - dayNum + 3);
    const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    const week = 1 + Math.round(((d - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
    return { week: week, year: d.getUTCFullYear() };
  }

  // Vælg den uge der er tættest på nu (uger kommer sorteret stigende fra serveren)
  function pickUgeplanWeekIdx(weeks) {
    if (!weeks || !weeks.length) return 0;
    const now = isoWeekYear(new Date());
    for (let i = 0; i < weeks.length; i++) {
      const w = weeks[i];
      if (w.year > now.year || (w.year === now.year && w.week_number >= now.week)) return i;
    }
    return weeks.length - 1;
  }

  function renderUgeplanSection() {
    return `
      <div class="section" id="section-ugeplan">
        <div class="section-header">
          <div class="section-title-row"><div class="section-icon" style="background:var(--flango-light)">🗓️</div><div><div class="section-title">Ugeplan</div><div class="section-subtitle">Ugens aktiviteter</div></div></div>
          <svg class="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="section-body"><div class="section-body-inner"><div class="section-content">
          <div id="ugeplan-content">
            <div style="text-align:center;padding:var(--s4)"><div class="portal-loading-spinner" style="margin:0 auto"></div></div>
          </div>
        </div></div></div>
      </div>`;
  }

  async function loadUgeplan() {
    if (!selectedChild) return;
    const container = document.getElementById('ugeplan-content');
    if (!container) return;
    container.innerHTML = '<div style="text-align:center;padding:var(--s4)"><div class="portal-loading-spinner" style="margin:0 auto"></div></div>';
    try {
      ugeplanData = await API.getPublishedUgeplan(selectedChild.institution_id);
      ugeplanWeekIdx = pickUgeplanWeekIdx(ugeplanData?.weeks || []);
      renderUgeplanContent(container);
    } catch (err) {
      console.error('[Portal] Ugeplan error:', err);
      ugeplanData = null;
      container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Kunne ikke indlæse ugeplanen</div></div>';
    }
  }

  function renderUgeplanContent(container) {
    if (!container) return;
    const data = ugeplanData || {};
    const weeks = data.weeks || [];
    if (!weeks.length) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Der er endnu ikke delt nogen ugeplan</div></div>';
      return;
    }
    if (ugeplanWeekIdx >= weeks.length) ugeplanWeekIdx = 0;

    const workshops = data.workshops || [];
    const week = weeks[ugeplanWeekIdx];
    const hidden = new Set(week.hidden_workshops || []);
    const sched = week.schedule_data || {};
    const visibleWs = workshops.filter(w => !hidden.has(w.slug));

    // Uge-vælger (kun hvis der er flere udgivne uger)
    let chips = '';
    if (weeks.length > 1) {
      chips = '<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin-bottom:var(--s3);-webkit-overflow-scrolling:touch">' +
        weeks.map((w, i) => {
          const active = i === ugeplanWeekIdx;
          return `<button data-ugeplan-week="${i}" style="flex:0 0 auto;border:1px solid ${active ? 'var(--flango)' : 'var(--border)'};background:${active ? 'var(--flango-light)' : '#fff'};color:${active ? 'var(--flango-dark)' : 'var(--ink)'};border-radius:var(--r-full);padding:6px 14px;font-size:13px;font-weight:600;cursor:pointer">Uge ${w.week_number}</button>`;
        }).join('') + '</div>';
    }

    // Lodrette dag-blokke
    let dayBlocks = '';
    for (let d = 0; d < 5; d++) {
      let rows = '';
      for (const w of visibleWs) {
        const cell = (sched[w.slug] || [])[d];
        if (!cell || cell.empty || cell.closed) continue;
        const hasStaff = Array.isArray(cell.staff) && cell.staff.length > 0;
        if (!cell.activity && !hasStaff) continue;
        const staffStr = hasStaff ? esc(cell.staff.join(', ')) : '';
        const timeStr = cell.time ? esc(cell.time) : '';
        const metaParts = [timeStr, staffStr].filter(Boolean).join(' · ');
        rows += `<div style="display:flex;gap:10px;padding:8px 0;border-top:1px solid var(--border)">
          <div style="flex:0 0 34%;font-size:13px;font-weight:600;color:var(--ink)">${esc(w.name)}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;color:var(--ink)">${esc(cell.activity || '')}${cell.sub ? ' <span style="color:var(--ink-muted);font-size:12px">' + esc(cell.sub) + '</span>' : ''}</div>
            ${metaParts ? `<div style="font-size:12px;color:var(--ink-muted);margin-top:2px">${metaParts}</div>` : ''}
          </div>
        </div>`;
      }
      if (!rows) rows = '<div style="padding:8px 0;border-top:1px solid var(--border);font-size:13px;color:var(--ink-muted)">Ingen planlagte aktiviteter</div>';
      dayBlocks += `<div style="margin-bottom:var(--s3)">
        <div style="font-size:13px;font-weight:700;color:var(--flango-dark);text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px">${UGEPLAN_DAYS[d]}</div>
        ${rows}
      </div>`;
    }

    container.innerHTML = `
      ${chips}
      <div style="font-size:13px;color:var(--ink-muted);margin-bottom:var(--s2)">Uge ${week.week_number} · ${week.year}</div>
      ${dayBlocks}`;

    container.querySelectorAll('[data-ugeplan-week]').forEach(btn => {
      btn.addEventListener('click', function () {
        ugeplanWeekIdx = parseInt(btn.getAttribute('data-ugeplan-week'), 10) || 0;
        renderUgeplanContent(container);
      });
    });
  }

  let ppCurrentPeriod = 'all';
  let ppCurrentSort = 'antal';
  let ppCurrentView = 'bars'; // 'bars' | 'graph'
  const ppCylinderColors = [
    { bg: 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 35%, #93c5fd 50%, #60a5fa 65%, #3b82f6 100%)', shadow: '#1e40af', cap: 'linear-gradient(180deg, #bfdbfe 0%, #3b82f6 100%)' },
    { bg: 'linear-gradient(90deg, #22c55e 0%, #4ade80 35%, #86efac 50%, #4ade80 65%, #22c55e 100%)', shadow: '#16a34a', cap: 'linear-gradient(180deg, #dcfce7 0%, #4ade80 100%)' },
    { bg: 'linear-gradient(90deg, #f9a825 0%, #ffc107 35%, #ffeb3b 50%, #ffc107 65%, #f9a825 100%)', shadow: '#f57f17', cap: 'linear-gradient(180deg, #fff59d 0%, #ffca28 100%)' },
    { bg: 'linear-gradient(90deg, #ec4899 0%, #f472b6 35%, #fbcfe8 50%, #f472b6 65%, #ec4899 100%)', shadow: '#be185d', cap: 'linear-gradient(180deg, #fce7f3 0%, #f472b6 100%)' },
    { bg: 'linear-gradient(90deg, #8b5cf6 0%, #a78bfa 35%, #c4b5fd 50%, #a78bfa 65%, #8b5cf6 100%)', shadow: '#6d28d9', cap: 'linear-gradient(180deg, #ede9fe 0%, #a78bfa 100%)' },
    { bg: 'linear-gradient(90deg, #14b8a6 0%, #2dd4bf 35%, #99f6e4 50%, #2dd4bf 65%, #14b8a6 100%)', shadow: '#0f766e', cap: 'linear-gradient(180deg, #ccfbf1 0%, #2dd4bf 100%)' },
    { bg: 'linear-gradient(90deg, #0ea5e9 0%, #38bdf8 35%, #7dd3fc 50%, #38bdf8 65%, #0ea5e9 100%)', shadow: '#0369a1', cap: 'linear-gradient(180deg, #e0f2fe 0%, #38bdf8 100%)' },
    { bg: 'linear-gradient(90deg, #f97316 0%, #fb923c 35%, #fdba74 50%, #fb923c 65%, #f97316 100%)', shadow: '#c2410c', cap: 'linear-gradient(180deg, #ffedd5 0%, #fb923c 100%)' },
    { bg: 'linear-gradient(90deg, #ef4444 0%, #f87171 35%, #fca5a5 50%, #f87171 65%, #ef4444 100%)', shadow: '#b91c1c', cap: 'linear-gradient(180deg, #fee2e2 0%, #f87171 100%)' },
    { bg: 'linear-gradient(90deg, #64748b 0%, #94a3b8 35%, #cbd5e1 50%, #94a3b8 65%, #64748b 100%)', shadow: '#334155', cap: 'linear-gradient(180deg, #e2e8f0 0%, #94a3b8 100%)' },
  ];

  function renderPurchaseProfileSection() {
    return `
      <div class="section open" id="section-profile">
        <div class="section-header">
          <div class="section-title-row"><div class="section-icon" style="background:var(--flango-light)">📊</div><div><div class="section-title">Købsprofil</div><div class="section-subtitle">Mest købte produkter</div></div></div>
          <svg class="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="section-body"><div class="section-body-inner"><div class="section-content">
          <div id="purchase-profile-content">
            <div style="text-align:center;padding:var(--s4)"><div class="portal-loading-spinner" style="margin:0 auto"></div></div>
          </div>
        </div></div></div>
      </div>`;
  }

  function getSpentForPeriod(periodKey) {
    const transactions = childData?.recent_transactions || childData?.history || [];
    const now = new Date();
    const todayStr = now.toLocaleDateString('sv-SE');
    let cutoff = null;
    if (periodKey === 'today') {
      cutoff = todayStr;
    } else if (periodKey === 'week') {
      const d = new Date(now); d.setDate(d.getDate() - 6);
      cutoff = d.toLocaleDateString('sv-SE');
    } else {
      const d = new Date(now); d.setDate(d.getDate() - 29);
      cutoff = d.toLocaleDateString('sv-SE');
    }
    let spent = 0;
    transactions.forEach(tx => {
      const type = tx.type || tx.event_type || '';
      const dateStr = tx.created_at || tx.date || '';
      if (!dateStr) return;
      const txDate = new Date(dateStr).toLocaleDateString('sv-SE');
      if (periodKey === 'today' && txDate !== todayStr) return;
      if (periodKey !== 'today' && txDate < cutoff) return;
      if (type === 'SALE') spent += Math.abs(parseFloat(tx.amount || tx.total_amount || 0));
      else if (type === 'SALE_UNDO' || type === 'UNDO_SALE') spent -= Math.abs(parseFloat(tx.amount || tx.total_amount || 0));
    });
    return Math.max(0, spent);
  }

  function filterTransactions(periodKey) {
    const transactions = childData?.recent_transactions || childData?.history || [];
    const now = new Date();
    const todayStr = now.toLocaleDateString('sv-SE');
    let cutoff = null;
    if (periodKey === 'today') cutoff = todayStr;
    else if (periodKey === 'week') { const d = new Date(now); d.setDate(d.getDate() - 6); cutoff = d.toLocaleDateString('sv-SE'); }
    else { const d = new Date(now); d.setDate(d.getDate() - 29); cutoff = d.toLocaleDateString('sv-SE'); }
    return transactions.filter(tx => {
      const dateStr = tx.created_at || tx.date || '';
      if (!dateStr) return false;
      const txDate = new Date(dateStr).toLocaleDateString('sv-SE');
      if (periodKey === 'today') return txDate === todayStr;
      return txDate >= cutoff;
    });
  }

  function pctBadgeHTML(childSpend, avg) {
    if (avg == null || avg <= 0) return '';
    const pct = Math.round(((childSpend - avg) / avg) * 100);
    if (pct === 0) return '<span style="font-size:11px;color:var(--ink-muted);margin-left:4px">= gns.</span>';
    const color = pct > 0 ? 'var(--danger, #ef4444)' : 'var(--positive, #22c55e)';
    const arrow = pct > 0 ? '▲' : '▼';
    return `<span style="font-size:11px;font-weight:600;color:${color};margin-left:4px">${arrow} ${Math.abs(pct)}%</span>`;
  }

  function renderHistorySection() {
    return `
      <div class="section" id="section-history">
        <div class="section-header">
          <div class="section-title-row"><div class="section-icon" style="background:var(--info-light)">📊</div><div><div class="section-title">Overblik</div><div class="section-subtitle">Forbrug og historik</div></div></div>
          <svg class="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="section-body"><div class="section-body-inner"><div class="section-content">
          <div id="history-content">${renderHistoryContent('week')}</div>
        </div></div></div>
      </div>`;
  }

  function renderHistoryContent(periodKey) {
    const spent = getSpentForPeriod(periodKey);
    const avg = customerAvgSpend || {};
    const avgVal = periodKey === 'today' ? avg.avg_today : periodKey === 'week' ? avg.avg_week : avg.avg_month;
    const badge = pctBadgeHTML(spent, avgVal);
    const avgText = avgVal != null && avgVal > 0 ? `Gns. pr. barn: ${formatKr(avgVal)} kr` : '';
    const periodLabel = periodKey === 'today' ? 'I dag' : periodKey === 'week' ? 'Sidste 7 dage' : 'Sidste 30 dage';

    const filteredTx = filterTransactions(periodKey);
    let txHTML = '';
    if (filteredTx.length === 0) {
      txHTML = '<div class="empty-state" style="padding:var(--s3) 0"><div class="empty-state-text">Ingen transaktioner</div></div>';
    } else {
      txHTML = filteredTx.map(tx => {
        const type = tx.type || tx.event_type || 'SALE';
        let icon = '🧃', iconCls = 'purchase', amountCls = 'negative', sign = '-';
        if (type === 'DEPOSIT' || type === 'TOPUP') { icon = '💳'; iconCls = 'topup'; amountCls = 'positive'; sign = '+'; }
        else if (type === 'BALANCE_EDIT' || type === 'ADJUSTMENT') { icon = '⚙️'; iconCls = 'adjust'; amountCls = parseFloat(tx.amount) >= 0 ? 'positive' : 'negative'; sign = parseFloat(tx.amount) >= 0 ? '+' : '-'; }
        else if (type === 'SALE_UNDO' || type === 'UNDO_SALE') { icon = '↩️'; iconCls = 'topup'; amountCls = 'positive'; sign = '+'; }
        const title = tx.description || tx.product_names || type;
        const dateStr = tx.created_at || tx.date || '';
        const date = dateStr ? formatDateTime(dateStr) : '';
        const amount = Math.abs(parseFloat(tx.amount || tx.total_amount || 0));
        return `<div class="tx-row"><div class="tx-icon ${iconCls}">${icon}</div><div class="tx-info"><div class="tx-title">${esc(title)}</div><div class="tx-date">${esc(date)}</div></div><div class="tx-amount ${amountCls}">${sign}${formatKr(amount)} kr</div></div>`;
      }).join('');
    }

    return `
      <div style="display:flex;gap:6px;margin-bottom:var(--s3)">
        <button class="history-filter-btn${periodKey === 'today' ? ' active' : ''}" data-period="today">I dag</button>
        <button class="history-filter-btn${periodKey === 'week' ? ' active' : ''}" data-period="week">1 uge</button>
        <button class="history-filter-btn${periodKey === 'month' ? ' active' : ''}" data-period="month">1 måned</button>
      </div>
      <div style="background:var(--surface-raised, #f8fafc);border-radius:12px;padding:var(--s3);margin-bottom:var(--s3);text-align:center">
        <div style="font-size:12px;color:var(--ink-muted);margin-bottom:2px">${periodLabel}</div>
        <div style="font-size:24px;font-weight:800;color:var(--ink)">${formatKr(spent)} kr${badge}</div>
        ${avgText ? `<div style="font-size:11px;color:var(--ink-muted);margin-top:2px">${avgText}</div>` : ''}
      </div>
      <div style="font-weight:700;font-size:13px;color:var(--ink-muted);margin-bottom:var(--s2)">Transaktioner</div>
      ${txHTML}`;
  }

  function renderSortimentSection() {
    let listHTML = '';
    if (!products || products.length === 0) {
      listHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">Ingen produkter tilgængelige</div></div>';
    } else {
      listHTML = products.filter(p => p.is_visible !== false && p.is_enabled !== false).map(p => {
        const emojiHtml = productEmojiHTML(p, 20);
        const badge = p.is_core_assortment === true ? '<span class="product-badge permanent">Fast</span>' : '';
        return `<div class="product-list-item"><div class="product-emoji">${emojiHtml}</div><div class="product-name">${esc(cleanProductName(p.name))}${badge}</div><div class="product-price">${formatKr(p.price)} kr</div></div>`;
      }).join('');
    }

    return `
      <div class="section" id="section-sortiment">
        <div class="section-header">
          <div class="section-title-row"><div class="section-icon" style="background:var(--positive-light)">📋</div><div><div class="section-title">Dagens sortiment</div><div class="section-subtitle">Hvad kan købes i cafeen</div></div></div>
          <svg class="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="section-body"><div class="section-body-inner"><div class="section-content">
          ${listHTML}
        </div></div></div>
      </div>`;
  }

  /** Betalingsknapper for det valgte barns institution.
   *  Vis kun veje der faktisk kan gennemføres: `card_topup_enabled` beregnes
   *  server-side af get-parent-view med samme udtryk som create-topup selv
   *  bruger, så knappen ikke kan overleve en institution uden aktivt
   *  connected account (før: 400 "Kortbetaling er ikke aktiveret ... endnu"). */
  function renderTopupMethods() {
    const mobilepayBtn = (id) =>
      `<button class="topup-method-btn mobilepay" id="${id}" aria-label="Betal med MobilePay"><img src="assets/mobilepay-button.svg" alt="Betal med MobilePay" class="mobilepay-btn-img"></button>`;

    if (isDemo()) {
      return `${mobilepayBtn('pay-mobilepay-demo')}
            <div class="topup-pay-hint">🎬 Demo — MobilePay-flowet er simuleret; ingen rigtig betaling gennemføres</div>`;
    }

    const hasVipps = featureFlags.vipps_enabled === true;
    const hasCard = featureFlags.card_topup_enabled === true;

    if (!hasVipps && !hasCard) {
      return `<div class="hint-box blue"><span class="hint-icon">💬</span><span>Online optankning er ikke aktiveret for denne institution endnu. Kontakt personalet for at tanke ${esc(getChildName())}s saldo op.</span></div>`;
    }

    const parts = [];
    if (hasVipps) parts.push(mobilepayBtn('pay-mobilepay'));
    if (hasCard) {
      parts.push(`<button class="topup-method-btn checkout-btn" id="pay-checkout">${hasVipps ? 'Andre betalingsmuligheder' : 'Fortsæt til betaling'}</button>`);
      parts.push(`<div class="topup-pay-hint">${hasVipps ? 'Kort · Apple Pay · Google Pay' : 'MobilePay · Apple Pay · Google Pay · kort'}</div>`);
    }
    return parts.join('\n            ');
  }

  /** Sekundær knap i saldo-kortet. Følger institutionens "Aktiver kontaktknap"
   *  fra café-admin (institution_contact_phone_enabled + _phone) — den var indtil nu
   *  en død indstilling: knappen var hardcodet "Kontakt" og scrollede til GDPR-
   *  kontaktafsnittet uanset hvad institutionen valgte.
   *  Til = ring direkte. Fra = "Feedback" (admin-UI'ets egen ordlyd). Er feedback-
   *  sektionen også slået fra, falder vi tilbage til GDPR-kontaktafsnittet, så
   *  knappen aldrig peger på noget der ikke findes. */
  function renderBalanceSecondaryAction() {
    const mailIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>';
    const phoneIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0122 16.92z"/></svg>';

    const phone = featureFlags.institution_contact_phone;
    if (featureFlags.institution_contact_phone_enabled === true && phone) {
      const dial = String(phone).replace(/[^\d+]/g, '');
      return `<a class="topup-btn topup-secondary" href="tel:${esc(dial)}">${phoneIcon}Kontakt</a>`;
    }
    if (secOn('feedback')) {
      return `<button class="topup-btn topup-secondary" data-qa-scroll="section-feedback" data-qa-tab="tab-profile">${mailIcon}Feedback</button>`;
    }
    return `<button class="topup-btn topup-secondary" data-qa-scroll="section-contact" data-qa-tab="tab-privacy">${mailIcon}Kontakt</button>`;
  }

  /** Er der overhovedet café-grænser over skærmtid i Grænser-fanen? Skillelinjen
   *  giver kun mening som overgang — ikke som overskrift på en tom fane. */
  function hasCafeLimitSections() {
    return ['spending_limit', 'product_limit', 'sugar_policy', 'diet', 'allergens'].some(secOn);
  }

  function renderTopupSection() {
    const name = getChildName();
    return `
      <div class="section" id="section-topup">
        <div class="section-header">
          <div class="section-title-row"><div class="section-icon" style="background:var(--flango-light)">💳</div><div><div class="section-title">Vælg beløb</div><div class="section-subtitle">Optank ${esc(name)}s saldo</div></div></div>
          <svg class="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="section-body"><div class="section-body-inner"><div class="section-content">
          <div class="topup-grid">
            ${TOPUP_PRESETS.map(p => `<button class="topup-option${p.amount === DEFAULT_TOPUP_AMOUNT ? ' selected' : ''}" data-amount="${p.amount}"><div class="topup-option-amount">${p.amount} kr</div><div class="topup-option-label">${p.label}</div></button>`).join('')}
            <button class="topup-option custom" data-amount="custom"><div class="topup-option-amount">Andet</div><div class="topup-option-label">Vælg selv</div></button>
          </div>
          <div class="topup-custom-wrap" id="topup-custom-wrap" style="display:none">
            <input type="number" inputmode="numeric" min="1" max="2000" id="topup-custom-input" class="topup-custom-input" placeholder="Indtast beløb i kr (maks 2000)">
          </div>
          <div class="topup-method-section" id="topup-pay-area">
            ${renderTopupMethods()}
          </div>
        </div></div></div>
      </div>`;
  }

  /** Forælderens ANDRE børn i SAMME institution — de eneste gyldige modtagere.
   *  Serveren håndhæver det samme; dette er kun for at undgå at vise umulige valg. */
  // Gyldige modtagere for en given afsender: samme institution, ikke sig selv.
  // RPC'en håndhæver det samme server-side; dette holder bare UI'et fra umulige valg.
  function transferTargetsFor(fromId) {
    const from = (children || []).find(c => c.child_id === fromId);
    if (!from) return [];
    return (children || []).filter(c => c.child_id !== fromId && c.institution_id === from.institution_id);
  }

  // Findes der overhovedet et gyldigt par? (mindst to børn på samme institution)
  function hasTransferPair() {
    return (children || []).some(c => transferTargetsFor(c.child_id).length > 0);
  }

  function transferOption(c, selected) {
    return `<option value="${esc(c.child_id)}"${selected ? ' selected' : ''}>${esc(c.child_name)} · ${Number(c.balance ?? 0).toFixed(2)} kr</option>`;
  }

  function renderTransferSection() {
    const kids = children || [];
    const header = `
        <div class="section-header">
          <div class="section-title-row"><div class="section-icon" style="background:var(--info-light)">🔁</div><div><div class="section-title">Overfør mellem børn</div><div class="section-subtitle">Flyt saldo fra ét barn til et andet</div></div></div>
          <svg class="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>`;

    // Ingen søskende at flytte imellem → kort henvisning i stedet for en formular.
    if (!hasTransferPair()) {
      return `
      <div class="section" id="section-transfer">${header}
        <div class="section-body"><div class="section-body-inner"><div class="section-content">
          <div class="setting-desc">Har du flere børn på samme institution, kan du flytte saldo mellem dem her. Kontakt institutionen for at tilknytte søskende.</div>
        </div></div></div>
      </div>`;
    }

    // Afsender defaulter til det viste barn hvis det har en søskende, ellers det første der har.
    const defaultFrom = (selectedChild && transferTargetsFor(selectedChild.child_id).length)
      ? selectedChild.child_id
      : (kids.find(c => transferTargetsFor(c.child_id).length) || kids[0]).child_id;
    const toList = transferTargetsFor(defaultFrom);
    const fromBal = Number(kids.find(c => c.child_id === defaultFrom)?.balance ?? 0);

    return `
      <div class="section" id="section-transfer">${header}
        <div class="section-body"><div class="section-body-inner"><div class="section-content">
          <div>
            <div class="setting-label" style="margin-bottom:6px">Fra</div>
            <select id="transfer-from" class="input-field" style="width:100%">${kids.map(c => transferOption(c, c.child_id === defaultFrom)).join('')}</select>
          </div>
          <div style="display:flex;justify-content:center;margin:8px 0">
            <button type="button" id="transfer-swap" title="Byt fra/til" aria-label="Byt fra og til" style="width:38px;height:38px;border-radius:var(--r-full);border:1px solid var(--border);background:var(--surface-sunken);cursor:pointer;font-size:17px;line-height:1;color:var(--ink-soft)">⇅</button>
          </div>
          <div>
            <div class="setting-label" style="margin-bottom:6px">Til</div>
            <select id="transfer-to" class="input-field" style="width:100%">${toList.map(c => transferOption(c, false)).join('')}</select>
          </div>
          <div style="margin-top:var(--s3)">
            <div class="setting-label" style="margin-bottom:6px">Beløb</div>
            <input type="number" id="transfer-amount" class="input-field" style="width:100%" inputmode="decimal" min="1" step="1" max="${fromBal.toFixed(2)}" placeholder="Beløb i kr (maks ${fromBal.toFixed(2)})">
          </div>
          <div id="transfer-preview" style="display:none;margin-top:var(--s3);padding:10px 12px;border-radius:var(--r-md);background:var(--surface-sunken);font-size:13px;color:var(--ink-soft)"></div>
          <button class="save-btn" id="transfer-btn" style="width:100%;margin-top:var(--s3)">Overfør</button>
        </div></div></div>
      </div>`;
  }

  function wireTransferSection() {
    const fromEl = document.getElementById('transfer-from');
    const toEl = document.getElementById('transfer-to');
    const amtEl = document.getElementById('transfer-amount');
    const btn = document.getElementById('transfer-btn');
    const swap = document.getElementById('transfer-swap');
    if (!fromEl || !toEl || !amtEl || !btn) return; // henvisnings-besked → intet at wire
    const childById = (id) => (children || []).find(c => c.child_id === id);

    const repopulateTo = (preferToId) => {
      const list = transferTargetsFor(fromEl.value);
      toEl.innerHTML = list.map(c => transferOption(c, false)).join('');
      if (preferToId && list.some(c => c.child_id === preferToId)) toEl.value = preferToId;
      const fromBal = Number(childById(fromEl.value)?.balance ?? 0);
      amtEl.max = fromBal.toFixed(2);
      amtEl.placeholder = `Beløb i kr (maks ${fromBal.toFixed(2)})`;
    };
    const updatePreview = () => {
      const prev = document.getElementById('transfer-preview');
      if (!prev) return;
      const amt = Number(amtEl.value);
      const from = childById(fromEl.value), to = childById(toEl.value);
      if (!from || !to || !Number.isFinite(amt) || amt <= 0) { prev.style.display = 'none'; return; }
      const fromAfter = Number(from.balance ?? 0) - amt, toAfter = Number(to.balance ?? 0) + amt;
      prev.style.display = 'block';
      prev.innerHTML = fromAfter < 0
        ? `<span style="color:#dc2626">${esc(from.child_name)} har kun ${Number(from.balance ?? 0).toFixed(2)} kr</span>`
        : `Efter: <strong>${esc(from.child_name)}</strong> ${fromAfter.toFixed(2)} kr &nbsp;·&nbsp; <strong>${esc(to.child_name)}</strong> ${toAfter.toFixed(2)} kr`;
    };

    fromEl.addEventListener('change', () => { repopulateTo(); updatePreview(); });
    toEl.addEventListener('change', updatePreview);
    amtEl.addEventListener('input', updatePreview);
    if (swap) swap.addEventListener('click', () => {
      const oldFrom = fromEl.value, oldTo = toEl.value;
      if (!oldTo) return;
      fromEl.value = oldTo; repopulateTo(oldFrom); updatePreview();
    });
    btn.addEventListener('click', handleTransfer);
  }

  // Re-render sektionen med friske saldi (de nye dropdowns gør felt-for-felt-sync
  // upraktisk). loadChildData() re-renderer den ikke selv. Toggle er delegeret,
  // så replaceWith bevarer udfold-adfærd; input-lytterne wires på ny.
  function syncTransferUI() {
    const sec = document.getElementById('section-transfer');
    if (!sec) return;
    const wasOpen = sec.classList.contains('open');
    const temp = document.createElement('div');
    temp.innerHTML = renderTransferSection();
    const fresh = temp.firstElementChild;
    if (!fresh) return;
    if (wasOpen) fresh.classList.add('open');
    sec.replaceWith(fresh);
    wireTransferSection();
    // Begge børns saldo har ændret sig → opdatér begge steder de vises:
    try { renderSidebarChildren(); } catch { /* desktop-sidebar */ }
    try {
      const csel = document.querySelector('.child-selector');   // mobil chip-vælger
      if (csel) { const t = document.createElement('div'); t.innerHTML = renderChildSelector(); if (t.firstElementChild) csel.replaceWith(t.firstElementChild); }
    } catch { /* ingen chip-vælger (ét barn) */ }
  }

  async function handleTransfer() {
    const fromEl = document.getElementById('transfer-from');
    const toEl = document.getElementById('transfer-to');
    const amtEl = document.getElementById('transfer-amount');
    const fromId = fromEl?.value, toId = toEl?.value;
    const amount = Number(amtEl?.value);
    if (!fromId || !toId) { showToast('Vælg børn at overføre mellem', 'error'); return; }
    if (fromId === toId) { showToast('Vælg to forskellige børn', 'error'); return; }
    if (!Number.isFinite(amount) || amount <= 0) { showToast('Indtast et beløb større end 0', 'error'); return; }
    const from = (children || []).find(c => c.child_id === fromId);
    const to = (children || []).find(c => c.child_id === toId);

    const ok = await showConfirmModal({
      title: 'Bekræft overførsel',
      body: `Flyt ${amount.toFixed(2)} kr fra ${from?.child_name || ''} til ${to?.child_name || ''}?\n\nPengene bliver på institutionen — du flytter dem kun mellem dine egne børn.`,
      confirm: 'Overfør', cancel: 'Annullér', danger: false,
    });
    if (!ok) return;
    await doTransfer(fromId, toId, amount);
  }

  async function doTransfer(fromId, toId, amount) {
    const btn = document.getElementById('transfer-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Overfører...'; }
    try {
      const res = await API.transferBetweenChildren(fromId, toId, amount);
      // Server-autoritative saldi — opdatér lokale kopier så UI ikke gætter.
      const from = (children || []).find(c => c.child_id === fromId);
      const to = (children || []).find(c => c.child_id === toId);
      if (from && res?.from_new_balance != null) from.balance = Number(res.from_new_balance);
      if (to && res?.to_new_balance != null) to.balance = Number(res.to_new_balance);
      if (selectedChild?.child_id === fromId && res?.from_new_balance != null) { selectedChild.balance = Number(res.from_new_balance); if (childData) childData.balance = Number(res.from_new_balance); }
      if (selectedChild?.child_id === toId && res?.to_new_balance != null) { selectedChild.balance = Number(res.to_new_balance); if (childData) childData.balance = Number(res.to_new_balance); }
      showToast('Overførsel gennemført', 'success');
      // Øjeblikkelig sync fra de server-autoritative saldi — ingen grund til at
      // vente på loadChildData()'s 5 netværkskald (en overførsel rører kun saldi,
      // ikke produkter/events). Opdatér også saldo-kortet hvis det viste barn indgik.
      syncTransferUI();
      if (selectedChild && (selectedChild.child_id === fromId || selectedChild.child_id === toId) && selectedChild.balance != null) {
        const balEl = document.querySelector('.balance-amount');
        if (balEl) balEl.textContent = formatKr(selectedChild.balance) + ' kr';
      }
    } catch (err) {
      console.error('[Portal] Transfer error:', err);
      let msg = 'Overførslen kunne ikke gennemføres';
      try { msg = JSON.parse(err.message)?.message || msg; } catch { /* ikke JSON */ }
      showToast(msg, 'error');
      syncTransferUI();
    }
  }

  function renderSpendingLimitSection() {
    const limit = childData?.daily_spend_limit || selectedChild?.daily_spend_limit;
    const instLimit = childData?.institution_daily_limit || featureFlags.spending_limit_amount;
    const LIMIT_PRESETS = [20, 30, 40, 50];
    // "Andet..." er kun aktiv når der FAKTISK er sat en grænse uden for præsætterne.
    // (Før: også aktiv når ingen grænse var sat — så den så valgt ud på en frisk konto.)
    const isCustomLimit = !!limit && !LIMIT_PRESETS.includes(Number(limit));
    return `
      <div class="section" id="section-spending-limit">
        <div class="section-header">
          <div class="section-title-row"><div class="section-icon" style="background:var(--flango-light)">💰</div><div><div class="section-title">Daglig beløbsgrænse</div><div class="section-subtitle">Maks forbrug per dag</div></div></div>
          <svg class="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="section-body"><div class="section-body-inner"><div class="section-content">
          ${instLimit ? `<div class="hint-box info" style="margin-bottom:var(--s3)"><span class="hint-icon">🏫</span><span>Institutionens daglige grænse: <strong>${formatKr(instLimit)} kr</strong></span></div>` : ''}
          ${limit ? `<div class="hint-box green" style="margin-bottom:var(--s3)"><span class="hint-icon">👤</span><span>Din daglige grænse: <strong>${formatKr(limit)} kr</strong></span></div>` : ''}
          <p style="font-size:13px;color:var(--ink-soft);margin-bottom:var(--s2)">Vælg hvor meget ${esc(getChildName())} maksimalt må bruge om dagen. Den strengeste grænse (din eller institutionens) gælder altid.</p>
          <div class="chip-group" id="spending-limit-chips">
            <button class="chip${limit == 20 ? ' active' : ''}" data-limit="20">20 kr</button>
            <button class="chip${limit == 30 ? ' active' : ''}" data-limit="30">30 kr</button>
            <button class="chip${limit == 40 ? ' active' : ''}" data-limit="40">40 kr</button>
            <button class="chip${limit == 50 ? ' active' : ''}" data-limit="50">50 kr</button>
            <button class="chip${isCustomLimit ? ' active' : ''}" data-limit="custom">Andet...</button>
          </div>
          <div id="limit-custom-wrap" style="display:${isCustomLimit ? 'flex' : 'none'};gap:8px;align-items:center;margin-top:var(--s3)">
            <input type="number" inputmode="numeric" min="1" max="1000" id="limit-custom-input" class="input-field" placeholder="Indtast beløb i kr (1-1000)" value="${isCustomLimit ? esc(String(limit)) : ''}" style="flex:1;margin:0">
            <button class="save-btn compact" id="limit-custom-save" style="white-space:nowrap;padding:10px 16px">Gem</button>
          </div>
          <div class="hint-box neutral" style="margin-top:var(--s3)"><span class="hint-icon">💡</span><span>${esc(getChildName())} kan stadig købe, men cafeen giver besked hvis grænsen overskrides.</span></div>
        </div></div></div>
      </div>`;
  }

  function renderProductRow(p, isFirst) {
    const emojiHtml = productEmojiHTML(p, 24);
    const currentLimit = p.parent_limit ?? '∞';
    const instLimit = p.institution_limit;
    const priceStr = (p.price != null && p.price !== '') ? `${formatKr(p.price)} kr` : '';
    const metaParts = [priceStr, instLimit != null ? `Klub: max ${instLimit}/dag` : ''].filter(Boolean);
    const metaNote = metaParts.length ? `<span style="font-size:11px;color:var(--ink-muted)">${metaParts.join(' · ')}</span>` : '';
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--s3) 0${!isFirst ? ';border-top:1px solid var(--border)' : ''}">
        <div style="display:flex;align-items:center;gap:var(--s3)">${emojiHtml}<div><span style="font-weight:600;font-size:14px">${esc(cleanProductName(p.name))}</span>${metaNote ? '<br>' + metaNote : ''}</div></div>
        <div class="stepper" data-product-id="${p.id}"><button class="stepper-btn stepper-minus">−</button><div class="stepper-val">${currentLimit}</div><button class="stepper-btn stepper-plus">+</button></div>
      </div>`;
  }

  function renderProductLimitsSection() {
    // Fast sortiment: alle core_assortment produkter
    const coreProducts = products.filter(p => p.is_core_assortment === true);
    // Dagens sortiment: synlige produkter som IKKE er fast sortiment
    const todayProducts = products.filter(p => p.is_visible !== false && p.is_core_assortment !== true && p.is_daily_special !== true);

    let coreHTML = '';
    if (coreProducts.length === 0) {
      coreHTML = '<div style="padding:var(--s2) 0;color:var(--ink-muted);font-size:13px">Ingen faste produkter opsat</div>';
    } else {
      coreHTML = coreProducts.map((p, i) => renderProductRow(p, i === 0)).join('');
    }

    let todayHTML = '';
    if (todayProducts.length > 0) {
      todayHTML = `
        <div style="margin-top:var(--s4)">
          <div style="font-weight:700;font-size:13px;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:var(--s2)">Dagens sortiment</div>
          <div class="hint-box neutral" style="margin-bottom:var(--s2);font-size:12px"><span class="hint-icon">ℹ️</span><span>Grænser for dagens sortiment gælder kun mens produktet er på menuen</span></div>
          ${todayProducts.map((p, i) => renderProductRow(p, i === 0)).join('')}
        </div>`;
    }

    // Dagens ret: ÉN samlet grænse for alle dagens ret (retterne roterer, så en
    // per-produkt-grænse giver ikke mening). Café-POS håndhæver den på tværs af
    // alle is_daily_special. Vises som en helt almindelig produktrække med samme
    // stepper som resten — den reelle brug er "max 1 pr. dag", ikke blokering
    // (blokerings-toggle'en var aldrig brugt af nogen forælder og er fjernet).
    const hasDailySpecials = products.some(p => p.is_daily_special === true);
    const showDailySpecial = hasDailySpecials && featureFlags.parent_portal_daily_special !== false;
    const dsMaxDisplay = (dailySpecialLimit && dailySpecialLimit > 0) ? dailySpecialLimit : '∞';
    const dailySpecialHTML = !showDailySpecial ? '' : `
        <div style="margin-top:var(--s4)">
          <div style="font-weight:700;font-size:13px;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:var(--s2)">Dagens ret</div>
          <div class="hint-box neutral" style="margin-bottom:var(--s2);font-size:12px"><span class="hint-icon">ℹ️</span><span>Én samlet grænse for alle retter der er markeret som dagens ret — uanset hvad der er på menuen i dag.</span></div>
          <div style="display:flex;align-items:center;justify-content:space-between;padding:var(--s3) 0">
            <div style="display:flex;align-items:center;gap:var(--s3)"><span style="font-size:24px;line-height:1">🍽️</span><div><span style="font-weight:600;font-size:14px">Dagens ret</span><br><span style="font-size:11px;color:var(--ink-muted)">På tværs af alle dagens ret</span></div></div>
            <div class="stepper" id="ds-max-stepper"><button class="stepper-btn stepper-minus">−</button><div class="stepper-val">${dsMaxDisplay}</div><button class="stepper-btn stepper-plus">+</button></div>
          </div>
        </div>`;

    return `
      <div class="section" id="section-product-limits">
        <div class="section-header">
          <div class="section-title-row"><div class="section-icon" style="background:var(--caution-light)">🛒</div><div><div class="section-title">Købsgrænser pr. produkt</div><div class="section-subtitle">Begræns antal af specifikke varer</div></div></div>
          <svg class="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="section-body"><div class="section-body-inner"><div class="section-content">
          <div class="hint-box neutral" style="margin-bottom:var(--s3)"><span class="hint-icon">💡</span><span>Hvis institutionen har sat en grænse, gælder den strengeste.</span></div>
          <div style="font-weight:700;font-size:13px;color:var(--ink-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:var(--s2)">Fast sortiment</div>
          ${coreHTML}
          ${todayHTML}
          ${dailySpecialHTML}
        </div></div></div>
      </div>`;
  }

  function renderSugarPolicySection() {
    const sp = childData?.sugar_policy || {};
    const instSugarText = featureFlags.sugar_policy_text || featureFlags.parent_portal_sugar_policy_text;
    return `
      <div class="section" id="section-sugar">
        <div class="section-header">
          <div class="section-title-row"><div class="section-icon" style="background:#fce7f3">🍬</div><div><div class="section-title">Sukkerpolitik</div><div class="section-subtitle">Kontrollér usunde varer</div></div></div>
          <svg class="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="section-body"><div class="section-body-inner"><div class="section-content">
          ${instSugarText ? `<div class="hint-box purple" style="margin-bottom:var(--s3)"><span class="hint-icon">🏫</span><span>${esc(instSugarText)}</span></div>` : ''}
          <div class="setting-row" id="sugar-block-row">
            <div class="setting-info"><div class="setting-label">Bloker alle usunde varer</div><div class="setting-desc">${esc(getChildName())} kan kun købe sunde varer</div></div>
            <label class="toggle"><input type="checkbox" id="sugar-block-toggle" ${sp.block_unhealthy ? 'checked' : ''}><span class="toggle-track"></span></label>
          </div>
          <div class="setting-row">
            <div class="setting-info"><div class="setting-label">Max usunde pr. dag</div><div class="setting-desc">Begræns antal usunde varer samlet</div></div>
            <div class="stepper" id="sugar-max-stepper"><button class="stepper-btn stepper-minus">−</button><div class="stepper-val">${sp.max_unhealthy_per_day ?? '∞'}</div><button class="stepper-btn stepper-plus">+</button></div>
          </div>
          <div class="setting-row">
            <div class="setting-info"><div class="setting-label">Max af hvert usundt produkt</div><div class="setting-desc">Pr. produkt (fx maks 1 chokolade)</div></div>
            <div class="stepper" id="sugar-per-product-stepper"><button class="stepper-btn stepper-minus">−</button><div class="stepper-val">${sp.max_unhealthy_per_product_per_day ?? '∞'}</div><button class="stepper-btn stepper-plus">+</button></div>
          </div>
        </div></div></div>
      </div>`;
  }

  function renderDietSection() {
    const sp = childData?.sugar_policy || {};
    return `
      <div class="section" id="section-diet">
        <div class="section-header">
          <div class="section-title-row"><div class="section-icon" style="background:var(--positive-light)">🥗</div><div><div class="section-title">Kostpræferencer</div><div class="section-subtitle">Vegetarisk, svinekød m.m.</div></div></div>
          <svg class="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="section-body"><div class="section-body-inner"><div class="section-content">
          <div class="setting-row"><div class="setting-info"><div class="setting-label">Kun vegetarisk</div><div class="setting-desc">Vis kun vegetariske produkter</div></div><label class="toggle"><input type="checkbox" id="diet-vegetarian" ${sp.vegetarian_only ? 'checked' : ''}><span class="toggle-track"></span></label></div>
          <div class="setting-row"><div class="setting-info"><div class="setting-label">Ingen svinekød</div><div class="setting-desc">Bloker produkter med svinekød</div></div><label class="toggle"><input type="checkbox" id="diet-no-pork" ${sp.no_pork ? 'checked' : ''}><span class="toggle-track"></span></label></div>
        </div></div></div>
      </div>`;
  }

  function renderAllergensSection() {
    const allergens = [
      { key: 'peanuts', emoji: '🥜', name: 'Jordnødder' },
      { key: 'tree_nuts', emoji: '🌰', name: 'Trænødder' },
      { key: 'milk', emoji: '🥛', name: 'Mælk' },
      { key: 'gluten', emoji: '🌾', name: 'Gluten' },
      { key: 'egg', emoji: '🥚', name: 'Æg' },
      { key: 'fish', emoji: '🐟', name: 'Fisk' },
      { key: 'shellfish', emoji: '🦐', name: 'Skaldyr' },
      { key: 'sesame', emoji: '🌿', name: 'Sesam' },
      { key: 'soy', emoji: '🫘', name: 'Soja' },
    ];

    const settings = childData?.allergen_settings || {};
    const grid = allergens.map(a => {
      const policy = settings[a.key] || 'allow';
      let cls = '', label = 'Tilladt';
      if (policy === 'block') { cls = ' blocked'; label = 'Blokeret'; }
      else if (policy === 'warn') { cls = ' warn'; label = 'Advarsel'; }
      return `<div class="allergen-item${cls}" data-allergen="${a.key}"><span class="allergen-emoji">${a.emoji}</span><span class="allergen-name">${a.name}</span><span class="allergen-status">${label}</span></div>`;
    }).join('');

    return `
      <div class="section" id="section-allergens">
        <div class="section-header">
          <div class="section-title-row"><div class="section-icon" style="background:var(--caution-light)">🥜</div><div><div class="section-title">Allergier & madbegrænsninger</div><div class="section-subtitle">Tryk for at ændre status</div></div></div>
          <svg class="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="section-body"><div class="section-body-inner"><div class="section-content">
          <p style="font-size:12px;color:var(--ink-muted);margin-bottom:var(--s2)">Tryk for at skifte: Tilladt → Advarsel → Blokeret</p>
          <div class="allergen-grid" id="allergen-grid">${grid}</div>
          <p class="disclaimer">Ingrediens- og allergenoplysninger i systemet er vejledende og kan indeholde fejl eller mangler, da produkter og opskrifter løbende ændres af personalet. Institutionen og systemet kan ikke garantere fuldstændig korrekthed. Forældre til børn med allergi bør altid tale direkte med personalet.</p>
        </div></div></div>
      </div>`;
  }

  // ═══════════════════════════════════════
  //  RENDER: PRIVACY & RIGHTS SECTIONS
  // ═══════════════════════════════════════

  function renderPrivacyPolicySection() {
    const instName = getInstitutionName() || 'din institution';
    return `
      <div class="section" id="section-privacy-policy">
        <div class="section-header">
          <div class="section-title-row"><div class="section-icon" style="background:#dbeafe">📄</div><div><div class="section-title">Privatlivspolitik</div><div class="section-subtitle">Hvordan vi behandler data</div></div></div>
          <svg class="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="section-body"><div class="section-body-inner"><div class="section-content">
          <div style="line-height:1.7;color:var(--ink-soft)">
            ${renderPrivacyInfoText()}
          </div>
          <a href="https://flango.dk/privatlivspolitik/" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;margin-top:var(--s3);color:var(--info);font-weight:600;text-decoration:none">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            Læs den fulde privatlivspolitik
          </a>
        </div></div></div>
      </div>`;
  }

  function renderChildNameSection() {
    const lnOn = isLastNameEnabledForChild(selectedChild);
    const displayName = getChildName();
    const firstVal = getChildFirstName(selectedChild);
    const lastVal = getChildLastName(selectedChild);
    const inputStyle = 'width:100%;padding:8px 12px;border:1.5px solid var(--border);border-radius:var(--r-sm);font-size:14px;outline:none;box-sizing:border-box';
    const labelStyle = 'display:block;font-size:12px;font-weight:600;color:var(--ink-muted);margin-bottom:4px';
    const helpText = lnOn
      ? 'Barnets navn bruges i caféen så ekspedienten kan sikre at det rigtige barn får sit køb. Du kan rette fornavn og efternavn. Navnet skal stadig være genkendeligt for personalet.'
      : 'Barnets navn bruges i caféen så ekspedienten kan sikre at det rigtige barn får sit køb. Du kan forkorte eller ændre navnet, fx til kun fornavn eller kaldenavn. Navnet skal stadig være genkendeligt for personalet.';
    const editFields = lnOn
      ? `<div style="display:flex;flex-direction:column;gap:var(--s2)">
              <div>
                <label style="${labelStyle}" for="privacy-name-input">Fornavn</label>
                <input type="text" id="privacy-name-input" value="${esc(firstVal)}" maxlength="50" style="${inputStyle}" />
              </div>
              <div>
                <label style="${labelStyle}" for="privacy-lastname-input">Efternavn</label>
                <input type="text" id="privacy-lastname-input" value="${esc(lastVal)}" maxlength="50" style="${inputStyle}" />
              </div>
            </div>
            <div style="display:flex;gap:var(--s2);margin-top:var(--s2)">
              <button class="save-btn" id="privacy-save-name-btn" style="padding:8px 16px;font-size:13px">Gem</button>
              <button class="save-btn" id="privacy-cancel-name-btn" style="padding:8px 16px;font-size:13px;background:var(--surface-sunken);color:var(--ink)">Annuller</button>
            </div>`
      : `<div style="display:flex;gap:var(--s2);align-items:center">
              <input type="text" id="privacy-name-input" value="${esc(firstVal)}" maxlength="50" style="flex:1;padding:8px 12px;border:1.5px solid var(--border);border-radius:var(--r-sm);font-size:14px;outline:none" />
              <button class="save-btn" id="privacy-save-name-btn" style="padding:8px 16px;font-size:13px">Gem</button>
              <button class="save-btn" id="privacy-cancel-name-btn" style="padding:8px 16px;font-size:13px;background:var(--surface-sunken);color:var(--ink)">Annuller</button>
            </div>`;
    return `
      <div class="section" id="section-child-name">
        <div class="section-header">
          <div class="section-title-row"><div class="section-icon" style="background:#fef3c7">✏️</div><div><div class="section-title">Barnets navn</div><div class="section-subtitle">Rediger visningsnavn</div></div></div>
          <svg class="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="section-body"><div class="section-body-inner"><div class="section-content">
          <p style="margin:0 0 var(--s3);color:var(--ink-soft);line-height:1.6">${helpText}</p>
          <div style="display:flex;align-items:center;gap:var(--s3);flex-wrap:wrap">
            <div style="font-weight:600;font-size:16px" id="privacy-child-name-display">${esc(displayName)}</div>
            <button class="save-btn" id="privacy-edit-name-btn" style="padding:6px 14px;font-size:13px">Rediger</button>
          </div>
          <div id="privacy-name-edit-form" style="display:none;margin-top:var(--s3)">
            ${editFields}
            <div id="privacy-name-error" style="display:none;color:var(--negative,#dc2626);font-size:12px;margin-top:var(--s1)"></div>
          </div>
        </div></div></div>
      </div>`;
  }

  function renderDataInsightSection() {
    return `
      <div class="section" id="section-data-insight">
        <div class="section-header">
          <div class="section-title-row"><div class="section-icon" style="background:#d1fae5">📊</div><div><div class="section-title">Hvilke data har vi?</div><div class="section-subtitle">Se og download data</div></div></div>
          <svg class="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="section-body"><div class="section-body-inner"><div class="section-content">
          <div id="privacy-data-content">
            <p style="color:var(--ink-soft);margin:0 0 var(--s3)">Klik for at indlæse alle data vi har om dit barn.</p>
            <button class="save-btn" id="privacy-load-data-btn">Vis data</button>
          </div>
          <div id="privacy-data-loading" style="display:none;text-align:center;padding:var(--s6)">
            <div style="color:var(--ink-muted)">Indlæser data...</div>
          </div>
          <div id="privacy-data-result" style="display:none"></div>
        </div></div></div>
      </div>`;
  }

  function renderLinkedParentsSection() {
    return `
      <div class="section" id="section-linked-parents">
        <div class="section-header">
          <div class="section-title-row"><div class="section-icon" style="background:#ede9fe">👥</div><div><div class="section-title">Tilknyttede forældre</div><div class="section-subtitle">Hvem har adgang</div></div></div>
          <svg class="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="section-body"><div class="section-body-inner"><div class="section-content">
          <div id="privacy-linked-parents-content">
            <p style="color:var(--ink-soft);margin:0">Indlæser...</p>
          </div>
        </div></div></div>
      </div>`;
  }

  function renderDeleteChildDataSection() {
    const name = getChildName();
    return `
      <div class="section" id="section-delete-child">
        <div class="section-header">
          <div class="section-title-row"><div class="section-icon" style="background:#fee2e2">🗑️</div><div><div class="section-title">Slet barnets data</div><div class="section-subtitle">Anmod om sletning</div></div></div>
          <svg class="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="section-body"><div class="section-body-inner"><div class="section-content">
          <div id="privacy-deletion-status" style="display:none"></div>
          <div id="privacy-deletion-form">
            <div class="hint-box orange" style="margin-bottom:var(--s3)">
              <span class="hint-icon">&#9888;&#65039;</span>
              <span>
                <strong>Hvad der sker ved sletning:</strong><br>
                &bull; Institutionens personale modtager din anmodning<br>
                &bull; Personalet behandler anmodningen inden for 30 dage (jf. GDPR)<br>
                &bull; Barnets profil og personoplysninger fjernes (navn, saldo, indstillinger)<br>
                &bull; Salgsbilag og hændelser bevares anonymt — beløb og datoer beholdes af bogføringshensyn (lovkrav), men barnets navn fjernes<br>
                &bull; Audit-log bevares i 24 måneder af compliance-hensyn<br>
                &bull; Sletningen kan ikke fortrydes<br>
                &bull; Eventuel restsaldo kan ikke refunderes${hasTransferPair() ? ' — men du kan <span data-qa-scroll="section-transfer" data-qa-tab="tab-profile" style="color:var(--flango);cursor:pointer;text-decoration:underline">overføre den til et af dine andre børn</span> først' : ''}
              </span>
            </div>
            <p style="color:var(--ink-soft);margin:0 0 var(--s3)">Tip: Download en kopi af dine data først (se sektionen ovenfor).</p>
            <button class="save-btn" id="privacy-request-deletion-btn" ${isAdminSimulatorSession() ? 'disabled title="Kun forælder kan anmode om sletning (admin-visning)"' : ''} style="background:var(--negative,#dc2626);color:#fff${isAdminSimulatorSession() ? ';opacity:0.5;cursor:not-allowed' : ''}">${isAdminSimulatorSession() ? '🔒 ' : ''}Anmod om sletning af data for ${esc(name)}</button>
            ${adminSimLockedHint()}
          </div>
          <div id="privacy-deletion-confirm" style="display:none">
            <p style="margin:0 0 var(--s2);font-weight:600">Er du sikker? Skriv barnets navn for at bekræfte:</p>
            <div style="display:flex;gap:var(--s2);align-items:center">
              <input type="text" id="privacy-deletion-name-input" placeholder="${esc(name)}" style="flex:1;padding:8px 12px;border:1.5px solid var(--border);border-radius:var(--r-sm);font-size:14px" />
              <button class="save-btn" id="privacy-confirm-deletion-btn" style="background:var(--negative,#dc2626);color:#fff;padding:8px 16px">Bekræft</button>
              <button class="save-btn" id="privacy-cancel-deletion-btn" style="padding:8px 16px;background:var(--surface-sunken);color:var(--ink)">Annuller</button>
            </div>
            <div id="privacy-deletion-error" style="display:none;color:var(--negative,#dc2626);font-size:12px;margin-top:var(--s1)"></div>
          </div>
        </div></div></div>
      </div>`;
  }

  function renderDeleteParentAccountSection() {
    let parentEmail = '';
    try { parentEmail = currentSession?.user?.email || ''; } catch (_e) {}
    return `
      <div class="section" id="section-delete-account">
        <div class="section-header">
          <div class="section-title-row"><div class="section-icon" style="background:#fee2e2">❌</div><div><div class="section-title">Slet din forældrekonto</div><div class="section-subtitle">Fjern din adgang til portalen</div></div></div>
          <svg class="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="section-body"><div class="section-body-inner"><div class="section-content">
          <div class="hint-box orange" style="margin-bottom:var(--s3)">
            <span class="hint-icon">&#9888;&#65039;</span>
            <span>
              <strong>Hvad der sker:</strong><br>
              &bull; Din konto (${esc(parentEmail)}) slettes permanent<br>
              &bull; Du mister adgang til forældreportalen<br>
              &bull; Dine børns data påvirkes IKKE &mdash; de forbliver i systemet<br>
              &bull; Andre forældrekonti tilknyttet dine børn påvirkes ikke
            </span>
          </div>
          <div id="privacy-delete-account-form">
            <button class="save-btn" id="privacy-delete-account-btn" ${isAdminSimulatorSession() ? 'disabled title="Kun forælder kan slette egen konto (admin-visning)"' : ''} style="background:var(--negative,#dc2626);color:#fff${isAdminSimulatorSession() ? ';opacity:0.5;cursor:not-allowed' : ''}">${isAdminSimulatorSession() ? '🔒 ' : ''}Slet min konto permanent</button>
            ${adminSimLockedHint()}
          </div>
          <div id="privacy-delete-account-confirm" style="display:none">
            <p style="margin:0 0 var(--s2);font-weight:600">Er du sikker? Skriv din e-mailadresse for at bekraefte:</p>
            <div style="display:flex;gap:var(--s2);align-items:center">
              <input type="text" id="privacy-delete-account-email-input" placeholder="${esc(parentEmail)}" style="flex:1;padding:8px 12px;border:1.5px solid var(--border);border-radius:var(--r-sm);font-size:14px" />
              <button class="save-btn" id="privacy-confirm-delete-account-btn" style="background:var(--negative,#dc2626);color:#fff;padding:8px 16px">Bekræft</button>
              <button class="save-btn" id="privacy-cancel-delete-account-btn" style="padding:8px 16px;background:var(--surface-sunken);color:var(--ink)">Annuller</button>
            </div>
            <div id="privacy-delete-account-error" style="display:none;color:var(--negative,#dc2626);font-size:12px;margin-top:var(--s1)"></div>
          </div>
        </div></div></div>
      </div>`;
  }

  function renderContactSection() {
    const instName = getInstitutionName() || 'din institution';
    return `
      <div class="section" id="section-contact">
        <div class="section-header">
          <div class="section-title-row"><div class="section-icon" style="background:#dbeafe">📬</div><div><div class="section-title">Kontakt</div><div class="section-subtitle">Vedr. persondata</div></div></div>
          <svg class="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="section-body"><div class="section-body-inner"><div class="section-content">
          <div style="line-height:1.7;color:var(--ink-soft)">
            <p style="margin:0 0 var(--s4)">Har du spørgsmål om hvordan dit barns data behandles, eller ønsker du at udøve dine rettigheder, er du altid velkommen til at kontakte os.</p>
            <div style="background:var(--surface-sunken);border-radius:var(--r-md);padding:var(--s4);margin-bottom:var(--s3)">
              <div style="font-weight:700;margin-bottom:var(--s1)">Dataansvarlig</div>
              <div style="font-size:13px;color:var(--ink-muted);margin-top:var(--s1)">Din kommune er dataansvarlig for behandlingen af dit barns data. Vil du udøve dine rettigheder over for den dataansvarlige, kan institutionen henvise dig til kommunens kontakt.</div>
            </div>
            <div style="background:var(--surface-sunken);border-radius:var(--r-md);padding:var(--s4);margin-bottom:var(--s3)">
              <div style="font-weight:700;margin-bottom:var(--s1)">${esc(instName)}</div>
              <div style="font-size:13px;color:var(--ink-muted);margin-top:var(--s1)">Dit daglige kontaktpunkt. Institutionens personale kan hjælpe med de fleste spørgsmål om dit barns data i Flango.</div>
            </div>
            <div style="background:var(--surface-sunken);border-radius:var(--r-md);padding:var(--s4)">
              <div style="font-weight:700;margin-bottom:var(--s1)">Flango (databehandler)</div>
              <div>Flango &middot; CVR 34360642</div>
              <div><a href="mailto:kontakt@flango.dk" style="color:var(--info)">kontakt@flango.dk</a></div>
              <div><a href="tel:+4550201816" style="color:var(--info)">50 20 18 16</a></div>
              <div style="font-size:13px;color:var(--ink-muted);margin-top:var(--s1)">Vi behandler data på vegne af institutionen og kommunen. Ring eller skriv hvis du har tekniske spørgsmål.</div>
            </div>
          </div>
        </div></div></div>
      </div>`;
  }

  function renderProfilePictureSection() {
    if (featureFlags?.parent_portal_profile_pictures === false) return '';

    const optOutAula = childData?.profile_picture_opt_out_aula || false;
    const optOutCamera = childData?.profile_picture_opt_out_camera || false;
    const optOutParentUpload = childData?.profile_picture_opt_out_parent_upload || false;
    // Per-provider AI-state læses fra consentHistory (cache flag dækker begge providers samlet)
    const hasOpenaiConsent = (consentHistory || []).some(c => c.consent_type === 'profile_picture_ai_openai' && c.is_active);
    // Filter toggles efter hvad institutionen har slået til (jf. café settings / super-admin)
    const ppInstTypes = Array.isArray(featureFlags?.profile_picture_types) ? featureFlags.profile_picture_types : ['upload', 'camera', 'library'];
    const showAula = ppInstTypes.indexOf('upload') !== -1;
    const showCamera = ppInstTypes.indexOf('camera') !== -1;
    const aiMasterOn = featureFlags?.profile_pictures_ai_enabled !== false;
    // Én AI-avatar-udbyder: Microsoft Azure (EU). ai_provider_openai = legacy-navngivet gate (default true).
    const showAi = aiMasterOn && featureFlags?.ai_provider_openai !== false;
    const optOutOpenai = !hasOpenaiConsent;
    // Forælder-upload: institutions-flag fra featureFlags (parent_can_upload_pictures default true)
    const showParentUpload = featureFlags?.parent_can_upload_pictures !== false;
    // "All opted out" for master-toggle: aula + camera + parent-upload + AI
    const allOptedOut = (showAula ? optOutAula : true)
      && (showCamera ? optOutCamera : true)
      && (showParentUpload ? optOutParentUpload : true)
      && (showAi ? optOutOpenai : true);
    const library = childData?.profile_picture_library || [];
    const childName = getChildName();
    const initials = childName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const canUploadNow = showParentUpload && !optOutParentUpload && !isAdminSimulatorSession();

    // Build gallery HTML
    let galleryHtml = '';
    if (library.length > 0) {
      const thumbs = library.map(pic => {
        const status = pic.approval_status || 'approved';
        const isPending = status === 'pending';
        const isRejected = status === 'rejected';
        // Border-farve: grøn=aktiv, gul=pending, rød=rejected, transparent=approved-inaktiv
        let border = '3px solid transparent';
        if (pic.is_active) border = '3px solid #22c55e';
        else if (isPending) border = '3px solid #f59e0b';
        else if (isRejected) border = '3px solid #ef4444';
        const opacity = isRejected ? '0.6' : '1';
        const typeLabel = pic.picture_type === 'ai_avatar' ? 'AI'
          : pic.picture_type === 'aula' ? 'Aula'
          : pic.picture_type === 'camera' ? 'Foto'
          : pic.picture_type === 'upload' ? 'Upload'
          : pic.picture_type === 'parent_upload' ? 'Forælder'
          : pic.picture_type === 'library' ? 'Bibliotek'
          : pic.picture_type === 'icon' ? 'Ikon'
          : (pic.picture_type || '');
        // Library/icon paths are relative to cafe app — prefix with appropriate base URL
        let imgUrl = pic.signed_url || '';
        if ((pic.picture_type === 'library' || pic.picture_type === 'icon') && imgUrl && !imgUrl.startsWith('http')) {
          const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
          const cafeBase = isLocal ? 'http://127.0.0.1:3000/' : 'https://flango.dk/app/';
          imgUrl = cafeBase + imgUrl;
        }
        // Status-overlay-badge på thumbnail
        let statusBadge = '';
        if (isPending) statusBadge = `<div style="position:absolute;top:-4px;right:-4px;background:#f59e0b;color:#fff;font-size:11px;font-weight:700;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border:2px solid var(--bg, #fff);" title="Afventer godkendelse">⏳</div>`;
        else if (isRejected) statusBadge = `<div style="position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;font-size:11px;font-weight:700;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border:2px solid var(--bg, #fff);" title="Afvist">✕</div>`;
        // Status-tekst under thumbnail
        let statusText = '';
        if (isPending) statusText = '<span style="display:block;font-size:10px;color:#92400e;margin-top:2px;">Afventer godkendelse</span>';
        else if (isRejected) {
          const reasonMap = {
            inappropriate: 'Ikke egnet',
            wrong_person: 'Forkert person',
            low_quality: 'Lav kvalitet',
            other: 'Andet',
          };
          const reasonLabel = reasonMap[pic.rejected_reason_code] || 'Afvist';
          statusText = `<span style="display:block;font-size:10px;color:#dc2626;margin-top:2px;" title="${esc(pic.rejected_reason_text || '')}">Afvist: ${esc(reasonLabel)}</span>`;
        }
        // Aktivér-knap kun for approved-rows (ikke pending/rejected)
        const activateBtn = (!pic.is_active && !isPending && !isRejected)
          ? `<button class="pp-activate-btn" data-pic-id="${esc(pic.id)}" style="font-size:10px;padding:2px 6px;border:1px solid #22c55e;border-radius:4px;background:var(--bg);color:#22c55e;cursor:pointer;">Brug</button>`
          : '';
        return `<div class="pp-gallery-item" data-pic-id="${esc(pic.id)}" style="display:inline-flex;flex-direction:column;align-items:center;gap:3px;position:relative;opacity:${opacity};">
          <div style="position:relative;">
            <img src="${esc(imgUrl)}" alt="" style="width:64px;height:64px;border-radius:50%;object-fit:cover;border:${border};transition:border-color 0.2s;" onerror="this.style.opacity='0.2'">
            ${statusBadge}
          </div>
          <span style="font-size:10px;color:var(--ink-muted)">${esc(typeLabel)}${pic.is_active ? ' ●' : ''}</span>
          ${statusText}
          <div style="display:flex;gap:4px;">
            ${activateBtn}
            <button class="pp-download-btn" data-pic-url="${esc(imgUrl)}" data-pic-type="${esc(pic.picture_type || '')}" style="font-size:10px;padding:2px 6px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--ink-muted);cursor:pointer;">⬇</button>
            <button class="pp-delete-btn" data-pic-id="${esc(pic.id)}" style="font-size:10px;padding:2px 6px;border:1px solid #ef4444;border-radius:4px;background:var(--bg);color:#ef4444;cursor:pointer;">✕</button>
          </div>
        </div>`;
      }).join('');
      galleryHtml = `
        <div style="margin-bottom:var(--s3)">
          <div style="font-size:13px;font-weight:600;margin-bottom:8px;">Billeder (${library.length})</div>
          <div id="pp-gallery" style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start;">${thumbs}</div>
        </div>`;
    } else {
      galleryHtml = `<div style="display:flex;align-items:center;gap:var(--s4);margin-bottom:var(--s4)">
        <div style="width:64px;height:64px;border-radius:50%;background:var(--flango-light);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:var(--flango-dark);border:2px solid var(--border)">${initials}</div>
        <div><div style="font-weight:600">${esc(childName)}</div><div style="font-size:12px;color:var(--ink-muted)">Ingen profilbilleder endnu</div></div>
      </div>`;
    }

    // Upload-knap + approval-hint (kun hvis institutionen tillader OG samtykke er aktivt)
    const uploadHtml = showParentUpload ? `
      <div style="margin-bottom:var(--s3);padding:var(--s3);border:1px dashed var(--border, #d1d5db);border-radius:var(--r-md, 12px);background:var(--surface-sunken, #fafaf9);">
        <button id="pp-upload-btn" ${canUploadNow ? '' : 'disabled'} style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;border:none;border-radius:8px;background:${canUploadNow ? 'var(--flango, #F5960A)' : 'var(--border-color, #e5e7eb)'};color:${canUploadNow ? '#fff' : 'var(--ink-muted, #78716c)'};font-weight:600;font-size:14px;cursor:${canUploadNow ? 'pointer' : 'not-allowed'};">
          📷 Upload nyt billede
        </button>
        ${!optOutParentUpload ? `<div style="font-size:12px;color:var(--ink-muted, #78716c);margin-top:8px;text-align:center;line-height:1.5;">Alle uploads gennemgås af institutionen før de aktiveres. Institutionen kan til enhver tid erstatte billedet hvis det ikke egner sig som identifikation.</div>` : `<div style="font-size:12px;color:var(--ink-muted, #78716c);margin-top:8px;text-align:center;">Aktivér samtykket "Forælder-upload" nedenfor for at uploade.</div>`}
      </div>` : '';

    return `
      <div class="section" id="section-profile-picture">
        <div class="section-header">
          <div class="section-title-row"><div class="section-icon" style="background:#e0e7ff">📷</div><div><div class="section-title">Profilbilleder</div><div class="section-subtitle">Billeder og samtykke</div></div></div>
          <svg class="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="section-body"><div class="section-body-inner"><div class="section-content">
          ${galleryHtml}
          ${uploadHtml}
          <div class="hint-box blue" style="margin-bottom:var(--s3)"><span class="hint-icon">ℹ️</span><span>Profilbilleder bruges i caféen for at bekræfte dit barns identitet ved køb. Billederne er kun synlige for børn og personale i denne institution.</span></div>

          <div class="setting-row${isAdminSimulatorSession() ? ' consent-locked-sim' : ''}" style="border-bottom:1px solid var(--border-color, #e5e7eb);padding-bottom:var(--s3);margin-bottom:var(--s2);flex-direction:column;align-items:stretch" ${isAdminSimulatorSession() ? 'title="Kun forælder kan ændre dette samtykke (admin-visning)"' : ''}>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:var(--s3)">
              <div class="setting-info"><div class="setting-label" style="font-weight:700">Tillad profilbilleder${isAdminSimulatorSession() ? ' 🔒' : ''}</div><div class="setting-desc">Slå fra for at fravælge alle billedtyper på én gang</div></div>
              <label class="toggle"><input type="checkbox" id="pp-consent-master" ${!allOptedOut ? 'checked' : ''} ${isAdminSimulatorSession() ? 'disabled' : ''}><span class="toggle-track"></span></label>
            </div>
            ${adminSimLockedHint()}
          </div>

          <div id="pp-type-toggles" style="${allOptedOut ? 'opacity:0.4;pointer-events:none' : ''}">
            ${showAula ? `<div class="setting-row${isAdminSimulatorSession() ? ' consent-locked-sim' : ''}" style="flex-direction:column;align-items:stretch" ${isAdminSimulatorSession() ? 'title="Kun forælder kan ændre dette samtykke (admin-visning)"' : ''}>
              <div style="display:flex;justify-content:space-between;align-items:center;gap:var(--s3)">
                <div class="setting-info"><div class="setting-label">Aula-profilbillede${isAdminSimulatorSession() ? ' 🔒' : ''}</div><div class="setting-desc">Institutionen kan bruge dit barns eksisterende Aula-foto som profilbillede i caféen.</div></div>
                <label class="toggle"><input type="checkbox" id="pp-consent-aula" ${!optOutAula ? 'checked' : ''} ${isAdminSimulatorSession() ? 'disabled' : ''}><span class="toggle-track"></span></label>
              </div>
              ${adminSimLockedHint()}
            </div>` : ''}
            ${showCamera ? `<div class="setting-row${isAdminSimulatorSession() ? ' consent-locked-sim' : ''}" style="flex-direction:column;align-items:stretch" ${isAdminSimulatorSession() ? 'title="Kun forælder kan ændre dette samtykke (admin-visning)"' : ''}>
              <div style="display:flex;justify-content:space-between;align-items:center;gap:var(--s3)">
                <div class="setting-info"><div class="setting-label">Kamera-foto${isAdminSimulatorSession() ? ' 🔒' : ''}</div><div class="setting-desc">Personalet kan tage et foto af dit barn med caféens enhed.</div></div>
                <label class="toggle"><input type="checkbox" id="pp-consent-camera" ${!optOutCamera ? 'checked' : ''} ${isAdminSimulatorSession() ? 'disabled' : ''}><span class="toggle-track"></span></label>
              </div>
              ${adminSimLockedHint()}
            </div>` : ''}
            ${showParentUpload ? `<div class="setting-row${isAdminSimulatorSession() ? ' consent-locked-sim' : ''}" style="flex-direction:column;align-items:stretch" ${isAdminSimulatorSession() ? 'title="Kun forælder kan ændre dette samtykke (admin-visning)"' : ''}>
              <div style="display:flex;justify-content:space-between;align-items:center;gap:var(--s3)">
                <div class="setting-info"><div class="setting-label">Forælder-upload${isAdminSimulatorSession() ? ' 🔒' : ''}</div><div class="setting-desc">Du kan selv uploade et billede af dit barn fra denne portal. Alle uploads gennemgås af institutionen før aktivering.</div></div>
                <label class="toggle"><input type="checkbox" id="pp-consent-parent-upload" ${!optOutParentUpload ? 'checked' : ''} ${isAdminSimulatorSession() ? 'disabled' : ''}><span class="toggle-track"></span></label>
              </div>
              ${adminSimLockedHint()}
            </div>` : ''}
            ${showAi ? `<div class="setting-row${isAdminSimulatorSession() ? ' consent-locked-sim' : ''}" style="flex-direction:column;align-items:stretch;gap:4px" ${isAdminSimulatorSession() ? 'title="Kun forælder kan ændre dette samtykke (admin-visning)"' : ''}>
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:var(--s3);">
                <div class="setting-info"><div class="setting-label">AI-genereret avatar${isAdminSimulatorSession() ? ' 🔒' : ''}</div><div class="setting-desc">Et foto sendes til Microsoft Azure (EU) for at generere en tegnet avatar. Fotoet slettes straks — kun avataren gemmes.</div></div>
                <label class="toggle" style="flex-shrink:0"><input type="checkbox" id="pp-consent-ai" ${!optOutOpenai ? 'checked' : ''} ${isAdminSimulatorSession() ? 'disabled' : ''}><span class="toggle-track"></span></label>
              </div>
              <button type="button" id="pp-ai-readmore-btn" style="background:none;border:none;padding:0;color:var(--info);font-size:12px;cursor:pointer;font-weight:600;text-align:left;align-self:flex-start;">📖 Læs mere om databehandlingen</button>
              ${adminSimLockedHint()}
            </div>` : ''}
          </div>

        </div></div></div>
      </div>`;
  }

  // ============================================================
  // Samtykke-historik (read-only)
  // ============================================================
  // Sektion 5.1 (runde 2, 2026-04-27): Denne sektion er IKKE længere
  // styringsstedet for samtykker. Den viser kun historik (GDPR art. 15
  // ret til indsigt). Styring sker udelukkende på "Profilbilleder"-siden.
  //
  // Vi viser samme tabel-data som get_consent_history returnerer, men:
  //   - Ingen toggles, kun read-only visning
  //   - Hver consent-type har en lille expander der viser fuld historik
  //   - Link nederst til "Profilbilleder" for styring

  function getConsentTypesForChild() {
    const showParentUpload = featureFlags?.parent_can_upload_pictures !== false;
    const types = [
      {
        key: 'profile_picture_aula',
        label: 'Aula-profilbillede',
        desc: 'Institutionen må bruge dit barns eksisterende Aula-foto som profilbillede i caféen.',
      },
      {
        key: 'profile_picture_camera',
        label: 'Kamera-foto',
        desc: 'Personalet må tage et foto af dit barn med caféens enhed og bruge det som profilbillede.',
      },
      {
        key: 'profile_picture_ai_openai',
        label: 'AI-genereret avatar',
        desc: 'Et foto af dit barn sendes til Microsoft Azure (EU) for at generere en tegnet avatar. Fotoet opbevares kun midlertidigt i EU — kun avataren gemmes.',
      },
    ];
    if (showParentUpload) {
      types.push({
        key: 'profile_picture_parent_upload',
        label: 'Forælder-upload',
        desc: 'Du kan selv uploade et profilbillede af dit barn fra denne portal. Alle uploads gennemgås af institutionen før aktivering.',
      });
    }
    return types;
  }

  function activeConsentFor(typeKey) {
    if (!Array.isArray(consentHistory)) return null;
    return consentHistory.find(c => c.consent_type === typeKey && c.is_active) || null;
  }

  function historyForType(typeKey) {
    if (!Array.isArray(consentHistory)) return [];
    return consentHistory.filter(c => c.consent_type === typeKey);
  }

  function formatConsentDate(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
      return iso;
    }
  }

  function methodLabel(method) {
    switch (method) {
      case 'forældreportal_checkbox': return 'forældreportal';
      case 'forældreportal_button':   return 'forældreportal';
      case 'legacy_default_consent':  return 'arvet fra tidligere indstilling';
      case 'admin_override':          return 'registreret af admin';
      default: return method || '';
    }
  }

  function renderConsentsSection() {
    // Sektion 5.1 (runde 2): read-only indsigt-side. Ingen toggles.
    const types = getConsentTypesForChild();
    const activeTypes = types.filter(t => activeConsentFor(t.key));
    const withdrawnTypes = types.filter(t => !activeConsentFor(t.key) && historyForType(t.key).length > 0);

    function renderHistoryExpander(t) {
      const history = historyForType(t.key);
      if (history.length === 0) return '';
      const historyId = `consent-history-${t.key}`;
      const items = history.map(h => {
        const givenTxt = `Givet ${formatConsentDate(h.given_at)} — version ${esc(h.consent_version)} (${esc(methodLabel(h.given_method))})`;
        const withdrawnTxt = h.withdrawn_at
          ? ` — trukket tilbage ${formatConsentDate(h.withdrawn_at)}`
          : '';
        const statusDot = h.is_active
          ? '<span style="color:#16a34a;font-weight:700">● aktiv</span>'
          : '<span style="color:var(--ink-muted)">○ ikke aktiv</span>';
        return `<li style="padding:4px 0;border-bottom:1px solid var(--border);font-size:12px;color:var(--ink-soft);line-height:1.5;list-style:none">${givenTxt}${withdrawnTxt} ${statusDot}</li>`;
      }).join('');
      return `
        <button class="consent-history-btn" data-target="${historyId}" style="background:none;border:none;padding:0;color:var(--info);font-size:12px;cursor:pointer;font-weight:600;margin-top:var(--s1)">Vis fuld historik (${history.length}) ▾</button>
        <ul id="${historyId}" style="display:none;margin:var(--s2) 0 0;padding:0">${items}</ul>
      `;
    }

    function renderRow(t, statusLine, statusColor) {
      return `
        <div class="setting-row consent-row" data-consent-type="${esc(t.key)}" style="flex-direction:column;align-items:stretch;gap:var(--s1);padding-bottom:var(--s3);border-bottom:1px solid var(--border);margin-bottom:var(--s2)">
          <div class="setting-info">
            <div class="setting-label" style="font-weight:700">${esc(t.label)}</div>
            <div class="setting-desc">${esc(t.desc)}</div>
          </div>
          <div style="font-size:12px;color:${statusColor};padding-left:2px">${statusLine}</div>
          ${renderHistoryExpander(t)}
        </div>`;
    }

    const activeRowsHtml = activeTypes.length === 0
      ? '<div style="font-size:13px;color:var(--ink-muted);padding:var(--s2) 0">Ingen aktive samtykker.</div>'
      : activeTypes.map(t => {
          const a = activeConsentFor(t.key);
          const status = a
            ? `✓ Givet ${formatConsentDate(a.given_at)} — version <strong>${esc(a.consent_version)}</strong>`
            : '';
          return renderRow(t, status, '#16a34a');
        }).join('');

    const withdrawnRowsHtml = withdrawnTypes.length === 0
      ? ''
      : `
        <h4 style="margin:var(--s4) 0 var(--s2);font-size:13px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:0.05em">Tilbagekaldte samtykker (${withdrawnTypes.length})</h4>
        ${withdrawnTypes.map(t => {
          const history = historyForType(t.key);
          const last = history[0]; // sorteret DESC af given_at
          const status = last && last.withdrawn_at
            ? `✗ Givet ${formatConsentDate(last.given_at)}, trukket tilbage ${formatConsentDate(last.withdrawn_at)}`
            : '✗ Ingen aktiv';
          return renderRow(t, status, 'var(--ink-muted)');
        }).join('')}
      `;

    return `
      <div class="section" id="section-consents">
        <div class="section-header">
          <div class="section-title-row"><div class="section-icon" style="background:#fef3c7">📜</div><div><div class="section-title">Samtykke-historik</div><div class="section-subtitle">Read-only oversigt (GDPR art. 15 ret til indsigt)</div></div></div>
          <svg class="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="section-body"><div class="section-body-inner"><div class="section-content">
          <div class="hint-box blue" style="margin-bottom:var(--s3)"><span class="hint-icon">ℹ️</span><span>Her ser du historikken over de samtykker du har afgivet (GDPR art. 7). <strong>Du administrerer dine samtykker på siden "Profilbilleder"</strong> — denne side er kun til indsigt.</span></div>

          <h4 style="margin:0 0 var(--s2);font-size:13px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:0.05em">Aktive samtykker (${activeTypes.length})</h4>
          ${activeRowsHtml}

          ${withdrawnRowsHtml}

          <div style="font-size:11px;color:var(--ink-muted);margin-top:var(--s4);line-height:1.5;padding-top:var(--s2);border-top:1px solid var(--border)">Aktuel version af privatlivspolitik: <strong>${esc(CURRENT_CONSENT_VERSION)}</strong>. Nye samtykker registreres mod denne version.</div>
        </div></div></div>
      </div>`;
  }

  function renderScreentimeSection() {
    // get-parent-skaermtid svarer NESTED (rules.*, parent_override.*, features.*).
    // Portalen læste tidligere flade stier (st.institution_daily_limit, st.max_daily_minutes …),
    // som ikke findes i svaret — derfor viste hele sektionen "—".
    const st = screentimeData || childData?.screentime || {};
    const feat = st.features || {};
    const rules = st.rules || {};
    const po = st.parent_override || {};
    const remaining = st.balance_minutes ?? '—';
    // Svaret har intet "brugt i dag"-felt — summér dagens sessioner fra history.
    const todayKey = new Date().toDateString();
    const usedToday = Array.isArray(st.history)
      ? st.history.reduce((sum, h) => (h.start && new Date(h.start).toDateString() === todayKey ? sum + (Number(h.minutes) || 0) : sum), 0)
      : null;
    const used = usedToday ?? '—';
    const instDaily = rules.default_balance_minutes ?? '—';
    const instSession = rules.max_session_minutes ?? '—';
    // ∞ = ingen personlig grænse (klubbens regler gælder) — samme betydning som i Købsgrænser.
    // "—" bruges KUN til read-only felter hvor tallet er ukendt.
    const personalDaily = po.max_daily_minutes ?? null;
    const personalSession = po.max_session_minutes ?? null;
    const consent = po.extra_time_consent ?? true;
    const showRemaining = feat.show_remaining !== false;
    const showUsage = feat.show_usage !== false;
    const showRules = feat.show_rules !== false;
    const allowPersonal = feat.allow_personal_limits !== false;
    const allowExtraTime = feat.allow_extra_time_requests !== false;
    // Loft: serveren afviser grænser over institutionens — stop dem allerede i stepperen.
    const maxDailyAttr = typeof rules.default_balance_minutes === 'number' ? ` data-max="${rules.default_balance_minutes}"` : '';
    const maxSessionAttr = typeof rules.max_session_minutes === 'number' ? ` data-max="${rules.max_session_minutes}"` : '';
    // Roblox personligt login (opt-out): default TILLADT. Vises kun som fravalgt hvis
    // forælderen aktivt har fravalgt og ikke gen-tilladt siden (matcher server-gaten).
    const robloxRows = historyForType('roblox_personal_login');
    const robloxAllowed = !!activeConsentFor('roblox_personal_login')
      || !robloxRows.some(c => !c.is_active);

    return `
      <div class="section" id="section-screentime">
        <div class="section-header">
          <div class="section-title-row"><div class="section-icon" style="background:var(--info-light)">🕹️</div><div><div class="section-title">Daglig spilletid</div><div class="section-subtitle">Grænser og samtykke</div></div></div>
          <svg class="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="section-body"><div class="section-body-inner"><div class="section-content">
          <div class="screentime-overview">
            ${showRemaining ? `<div class="st-stat-card remaining"><div class="st-stat-value">${remaining} min</div><div class="st-stat-label">Tilbage i dag</div></div>` : ''}
            ${showUsage ? `<div class="st-stat-card used"><div class="st-stat-value">${used} min</div><div class="st-stat-label">Brugt i dag</div></div>` : ''}
          </div>
          ${showRules ? `<div class="hint-box info" style="margin-bottom:var(--s3)"><span class="hint-icon">📋</span><span>Institutionens regler: ${instDaily} min/dag, maks ${instSession} min pr. session</span></div>` : ''}
          ${allowPersonal ? `
          <div class="setting-row">
            <div class="setting-info"><div class="setting-label">Personlig daglig grænse</div><div class="setting-desc">∞ = ingen personlig grænse — klubbens regler gælder</div></div>
            <div class="stepper" id="st-daily-stepper" data-step="5"${maxDailyAttr}><button class="stepper-btn stepper-minus">−</button><div class="stepper-val">${personalDaily || '∞'}</div><button class="stepper-btn stepper-plus">+</button></div>
          </div>
          <div class="setting-row">
            <div class="setting-info"><div class="setting-label">Maks pr. session</div><div class="setting-desc">Hvor lang tid ad gangen (minutter). ∞ = klubbens regel gælder</div></div>
            <div class="stepper" id="st-session-stepper" data-step="5"${maxSessionAttr}><button class="stepper-btn stepper-minus">−</button><div class="stepper-val">${personalSession || '∞'}</div><button class="stepper-btn stepper-plus">+</button></div>
          </div>` : ''}
          ${allowExtraTime ? `
          <div class="setting-row">
            <div class="setting-info"><div class="setting-label">Samtykke til forlænget spilletid</div><div class="setting-desc">Giv personalet lov til undtagelsesvis at forlænge.</div></div>
            <label class="toggle"><input type="checkbox" id="st-consent-toggle" ${consent ? 'checked' : ''}><span class="toggle-track"></span></label>
          </div>` : ''}
          <div class="setting-row">
            <div class="setting-info"><div class="setting-label">Tillad personligt Roblox-login</div><div class="setting-desc">Barnet kan logge ind med sin egen Roblox-konto på klubbens PC'er. Loginet gemmes krypteret. Anbefales ikke, hvis barnet har Robux på kontoen. Slå fra for at fravælge — et gemt login slettes.</div></div>
            <label class="toggle"><input type="checkbox" id="roblox-personal-login-consent" ${robloxAllowed ? 'checked' : ''}><span class="toggle-track"></span></label>
          </div>
        </div></div></div>
      </div>`;
  }

  function renderGamesSection() {
    const games = screentimeData?.games || childData?.games || [];
    let gamesHTML = '';
    if (games.length === 0) {
      gamesHTML = '<div class="empty-state"><div class="empty-state-icon">🎮</div><div class="empty-state-text">Ingen spil tilgængelige</div></div>';
    } else {
      gamesHTML = games.map(g => {
        // get-parent-skaermtid returnerer {id, name, category, allowed, set_by} — IKKE
        // institution_blocked/parent_approved (som render'et før læste → altid forkert).
        const allowed = g.allowed !== false;
        const instBlocked = g.allowed === false && g.set_by === 'institution';
        const disabledAttr = instBlocked ? ' style="opacity:.4;pointer-events:none"' : '';
        return `
          <div class="game-row">
            <div class="game-icon">${g.icon || '🎮'}</div>
            <div class="game-info">
              <div class="game-name">${esc(g.name)}</div>
              ${instBlocked ? '<div class="game-blocked">Blokeret af institutionen</div>' : `<div class="game-platform">${esc(g.category || '')}</div>`}
            </div>
            <label class="toggle"${disabledAttr}><input type="checkbox" data-game-id="${g.id}" ${allowed ? 'checked' : ''} ${instBlocked ? 'disabled' : ''}><span class="toggle-track"></span></label>
          </div>`;
      }).join('');
    }

    return `
      <div class="section" id="section-games">
        <div class="section-header">
          <div class="section-title-row"><div class="section-icon" style="background:var(--positive-light)">🎮</div><div><div class="section-title">Godkend spil</div><div class="section-subtitle">Vælg hvilke spil ${esc(getChildName())} må spille</div></div></div>
          <svg class="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="section-body"><div class="section-body-inner"><div class="section-content">
          ${gamesHTML}
        </div></div></div>
      </div>`;
  }

  function renderScreentimeChartSection() {
    const sessions = screentimeData?.sessions || screentimeData?.usage_history || screentimeData?.skaermtid_sessions || [];
    const instDaily = screentimeData?.institution_daily_limit ?? screentimeData?.default_balance_minutes ?? null;

    // Group sessions by date (last 7 days)
    const today = new Date();
    const days = [];
    const dayNames = ['Søn', 'Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      days.push({ key: key, label: i === 0 ? 'I dag' : dayNames[d.getDay()], minutes: 0 });
    }

    // Sum minutes per day
    sessions.forEach(function (s) {
      const sDate = (s.date || s.started_at || s.created_at || '').split('T')[0];
      const dayEntry = days.find(function (d) { return d.key === sDate; });
      if (dayEntry) {
        dayEntry.minutes += Number(s.duration_minutes || s.minutes || s.duration || 0);
      }
    });

    const maxMin = Math.max(...days.map(function (d) { return d.minutes; }), instDaily || 30, 1);

    let chartHTML = '';
    if (sessions.length === 0) {
      chartHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-text">Ingen spillehistorik endnu</div></div>';
    } else {
      const barsHTML = days.map(function (d) {
        const pct = Math.round((d.minutes / maxMin) * 100);
        const h = Math.max(4, pct);
        const isHigh = instDaily && d.minutes > instDaily;
        return '<div class="st-usage-bar-wrap">'
          + '<div class="st-usage-bar-val">' + Math.round(d.minutes) + '</div>'
          + '<div class="st-usage-bar' + (isHigh ? ' high' : '') + '" style="height:' + h + 'px"></div>'
          + '<div class="st-usage-bar-label">' + d.label + '</div>'
          + '</div>';
      }).join('');

      chartHTML = '<div class="st-usage-chart">' + barsHTML + '</div>';
      if (instDaily) {
        chartHTML += '<div style="text-align:center;margin-top:8px;font-size:11px;color:var(--ink-muted)">Daglig grænse: ' + instDaily + ' min</div>';
      }
    }

    return `
      <div class="section" id="section-st-chart">
        <div class="section-header">
          <div class="section-title-row"><div class="section-icon" style="background:var(--info-light)">📊</div><div><div class="section-title">Spilletidsoversigt</div><div class="section-subtitle">Forbrug de seneste 7 dage</div></div></div>
          <svg class="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="section-body"><div class="section-body-inner"><div class="section-content">
          ${chartHTML}
        </div></div></div>
      </div>`;
  }

  function renderNotificationsSection() {
    const notif = childData?.notification_settings || {};
    // Get parent login email from session
    var parentEmail = '';
    try { parentEmail = window.portalSupabase?.auth?.session?.()?.data?.session?.user?.email || ''; } catch (_e) { /* ignore */ }
    if (!parentEmail) {
      try {
        var _sd = JSON.parse(localStorage.getItem('flango-parent-auth') || '{}');
        parentEmail = _sd?.user?.email || _sd?.currentSession?.user?.email || '';
      } catch (_e2) { /* ignore */ }
    }
    if (!parentEmail && notif.email) parentEmail = notif.email;
    var secondaryEmail = notif.secondary_email || '';
    var notifyPrimary = notif.notify_primary_email !== false;
    const pushHint = API.isNativeApp() ? '' : `<div class="hint-box neutral" style="margin-bottom:var(--s3)"><span class="hint-icon">📱</span><span>Push-notifikationer vises på alle dine enheder med Flango Portal-appen.</span></div>`;
    return `
      <div class="section" id="section-notifications">
        <div class="section-header">
          <div class="section-title-row"><div class="section-icon" style="background:var(--info-light)">🔔</div><div><div class="section-title">Notifikationer</div><div class="section-subtitle">Påmindelser på telefonen</div></div></div>
          <svg class="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="section-body"><div class="section-body-inner"><div class="section-content">
          ${pushHint}${API.isNativeApp() ? `<div class="setting-row"><div class="setting-info"><div class="setting-label">Notifikationer på denne telefon</div><div class="setting-desc">Vises på låseskærmen — indholdet ser du i appen</div></div><label class="toggle"><input type="checkbox" id="notif-push-device" ${API.isPushEnabledOnThisDevice() ? 'checked' : ''}><span class="toggle-track"></span></label></div>
          <div style="border-top:1px solid var(--border);margin-top:var(--s3);padding-top:var(--s3)"></div>` : ''}
          <div class="setting-row"><div class="setting-info"><div class="setting-label">Når saldoen er 0 kr</div><div class="setting-desc">Få besked når saldoen er opbrugt</div></div><label class="toggle"><input type="checkbox" id="push-zero" ${notif.push_at_zero !== false ? 'checked' : ''}><span class="toggle-track"></span></label></div>
          <div class="setting-row"><div class="setting-info"><div class="setting-label">Når saldoen er 10 kr eller under</div><div class="setting-desc">Advarsel før saldoen løber tør</div></div><label class="toggle"><input type="checkbox" id="push-low" ${notif.push_at_ten !== false ? 'checked' : ''}><span class="toggle-track"></span></label></div>
          <div class="setting-row"><div class="setting-info"><div class="setting-label">Påmindelse før arrangementer</div><div class="setting-desc">7 og 1 dag før et arrangement dit barn er tilmeldt</div></div><label class="toggle"><input type="checkbox" id="push-event-reminder" ${notif.push_event_reminder === true ? 'checked' : ''}><span class="toggle-track"></span></label></div>
          <div class="setting-row"><div class="setting-info"><div class="setting-label">Mind mig om tilmelding</div><div class="setting-desc">Besked hvis dit barn stadig kan nå at tilmelde et kommende arrangement</div></div><label class="toggle"><input type="checkbox" id="push-event-invite" ${notif.push_event_invite === true ? 'checked' : ''}><span class="toggle-track"></span></label></div>
        </div></div></div>
      </div>
      <div class="section" id="section-email-notifications">
        <div class="section-header">
          <div class="section-title-row"><div class="section-icon" style="background:var(--info-light)">📧</div><div><div class="section-title">E-mail påmindelser</div><div class="section-subtitle">Lav saldo og arrangementer</div></div></div>
          <svg class="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="section-body"><div class="section-body-inner"><div class="section-content">
          <div class="setting-row"><div class="setting-info"><div class="setting-label">E-mail${parentEmail ? ' <span style="font-weight:400;color:var(--ink-soft);font-size:12px">(' + esc(parentEmail) + ')</span>' : ''}</div><div class="setting-desc">Påmindelser sendes til din login-e-mail</div></div><label class="toggle"><input type="checkbox" id="notif-primary-email" ${notifyPrimary ? 'checked' : ''}><span class="toggle-track"></span></label></div>
          <div style="margin-top:var(--s2)">
            <div class="setting-label" style="margin-bottom:6px">Ekstra e-mail <span style="font-weight:400;color:var(--ink-soft);font-size:12px">(valgfri)</span></div>
            <div class="setting-desc" style="margin-bottom:8px">Påmindelser sendes også hertil — og stadig, selv om kontoe-mailen ovenfor er slået fra</div>
            <div style="display:flex;gap:8px;align-items:center">
              <input type="email" id="notif-secondary-email" class="input-field" placeholder="fx partner@mail.dk" value="${esc(secondaryEmail)}" style="flex:1;margin:0">
              <button class="save-btn compact" id="notif-save-email-btn" style="white-space:nowrap;padding:10px 16px">Gem</button>
            </div>
          </div>
          <div style="border-top:1px solid var(--border);margin-top:var(--s3);padding-top:var(--s3)">
            <div class="setting-row"><div class="setting-info"><div class="setting-label">Når saldoen er 0 kr</div><div class="setting-desc">Få besked når saldoen er opbrugt</div></div><label class="toggle"><input type="checkbox" id="notif-zero" ${notif.notify_at_zero !== false ? 'checked' : ''}><span class="toggle-track"></span></label></div>
            <div class="setting-row"><div class="setting-info"><div class="setting-label">Når saldoen er 10 kr eller under</div><div class="setting-desc">Advarsel før saldoen løber tør</div></div><label class="toggle"><input type="checkbox" id="notif-low" ${notif.notify_at_ten !== false ? 'checked' : ''}><span class="toggle-track"></span></label></div>
            <div class="setting-row"><div class="setting-info"><div class="setting-label">Påmindelse før arrangementer</div><div class="setting-desc">7 og 1 dag før et arrangement dit barn er tilmeldt</div></div><label class="toggle"><input type="checkbox" id="notif-event-reminder" ${notif.notify_event_reminder === true ? 'checked' : ''}><span class="toggle-track"></span></label></div>
            <div class="setting-row"><div class="setting-info"><div class="setting-label">Mind mig om tilmelding</div><div class="setting-desc">Besked hvis dit barn stadig kan nå at tilmelde et kommende arrangement</div></div><label class="toggle"><input type="checkbox" id="notif-event-invite" ${notif.notify_event_invite === true ? 'checked' : ''}><span class="toggle-track"></span></label></div>
          </div>
        </div></div></div>
      </div>`;
  }

  function renderFeedbackSection() {
    const instName = getInstitutionName() || 'klubben';
    // "Til institutionen" vises kun når institutionen har slået beskeder til
    // (café → Beskeder). Ellers kun Flango-formen — ingen død knap.
    const showInstitutionFeedback = featureFlags.parent_messages_enabled === true;
    const flangoPanel = `
            <p style="font-size:13px;color:var(--ink-soft);margin-bottom:var(--s3)">Hjælp os med at gøre Flango bedre — eller rapportér en fejl.</p>
            <textarea class="feedback-textarea" id="fb-flango-text" placeholder="Beskriv problemet eller din ide..." rows="4"></textarea>
            <input type="email" id="fb-flango-email" class="input-field" placeholder="Din e-mail (valgfrit — så vi kan svare)" style="margin-top:var(--s2)">
            <div class="hint-box neutral" style="margin:var(--s3) 0"><span class="hint-icon">🔒</span><span>Din besked sendes til Flangos support. Uden e-mail er den anonym.</span></div>
            <button class="save-btn full" id="fb-flango-send">Send til Flango</button>`;
    const bodyInner = showInstitutionFeedback ? `
          <div class="feedback-tabs" id="feedback-tabs">
            <button class="feedback-tab active" data-target="fb-club">🏫 Til ${esc(instName)}</button>
            <button class="feedback-tab" data-target="fb-flango"><span style="display:inline-flex;align-items:center;gap:4px"><img src="assets/flango-logo.webp" alt="" style="width:15px;height:15px">Til Flango</span></button>
          </div>
          <div class="feedback-panel" id="fb-club">
            <p style="font-size:13px;color:var(--ink-soft);margin-bottom:var(--s3)">Send en besked direkte til ${esc(instName)} — fx om afhentning, ferie eller en aftale.</p>
            <textarea class="feedback-textarea" id="fb-club-text" placeholder="Skriv din besked her..." rows="4"></textarea>
            <input type="email" id="fb-club-email" class="input-field" placeholder="Din e-mail (valgfrit — så ${esc(instName)} kan svare)" style="margin-top:var(--s2)">
            <button class="save-btn full" id="fb-club-send" style="margin-top:var(--s3)">Send til ${esc(instName)}</button>
          </div>
          <div class="feedback-panel" id="fb-flango" style="display:none">${flangoPanel}</div>` : `
          <div class="feedback-panel" id="fb-flango">${flangoPanel}</div>`;
    return `
      <div class="section" id="section-feedback">
        <div class="section-header">
          <div class="section-title-row"><div class="section-icon" style="background:var(--flango-light)">💬</div><div><div class="section-title">Feedback & Support</div><div class="section-subtitle">${showInstitutionFeedback ? 'Skriv til ' + esc(instName) + ' eller Flango' : 'Skriv til Flango'}</div></div></div>
          <svg class="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="section-body"><div class="section-body-inner"><div class="section-content">
          ${bodyInner}
        </div></div></div>
      </div>`;
  }

  async function handleSendFeedback(target, textId, emailId, btn) {
    if (!selectedChild) return;
    if (demoBlocked()) return;
    const textEl = document.getElementById(textId);
    const message = (textEl?.value || '').trim();
    if (!message) { showToast('Skriv en besked først', 'error'); return; }
    const email = emailId ? (document.getElementById(emailId)?.value || '').trim() : '';
    const orig = btn.textContent;
    btn.disabled = true; btn.textContent = 'Sender...';
    try {
      await API.sendFeedback(selectedChild.child_id, target, message, email);
      if (textEl) textEl.value = '';
      if (emailId) { const e = document.getElementById(emailId); if (e) e.value = ''; }
      showToast('Tak for din besked!', 'success');
    } catch (err) {
      console.error('[Portal] sendFeedback:', err);
      showToast(err?.message || 'Kunne ikke sende beskeden', 'error');
    } finally {
      btn.disabled = false; btn.textContent = orig;
    }
  }

  function renderInviteParentSection() {
    return `
      <div class="section" id="section-invite-parent">
        <div class="section-header">
          <div class="section-title-row"><div class="section-icon" style="background:var(--surface-sunken)">👥</div><div><div class="section-title">Invit\u00e9r anden for\u00e6lder</div><div class="section-subtitle">Del adgang med en partner</div></div></div>
          <svg class="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="section-body"><div class="section-body-inner"><div class="section-content">
          <p style="margin:var(--s2) 0;font-size:13px;color:var(--ink-muted)">Generer en invitationskode som den anden for\u00e6lder kan bruge til at oprette en konto. Alle dine b\u00f8rn tilknyttes automatisk.</p>
          <div id="invite-parent-result" style="display:none;margin-bottom:var(--s3)">
            <div style="text-align:center;padding:var(--s4);background:var(--surface-sunken);border-radius:12px">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-muted);margin-bottom:var(--s1)">Invitationskode</div>
              <div id="invite-parent-code" style="font-size:28px;font-weight:800;letter-spacing:4px;font-family:monospace"></div>
              <div id="invite-parent-expiry" style="font-size:12px;color:var(--ink-muted);margin-top:var(--s1)"></div>
              <button class="save-btn" id="invite-copy-btn" style="margin-top:var(--s3);font-size:13px">Kopier kode</button>
            </div>
          </div>
          <button class="save-btn full" id="invite-parent-btn" style="margin-top:var(--s2)">Generer invitationskode</button>
        </div></div></div>
      </div>`;
  }

  function renderPinSection() {
    return `
      <div class="section" id="section-pin">
        <div class="section-header">
          <div class="section-title-row"><div class="section-icon" style="background:var(--surface-sunken)">🔑</div><div><div class="section-title">Skift adgangskode</div><div class="section-subtitle">Minimum 6 tegn</div></div></div>
          <svg class="section-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="section-body"><div class="section-body-inner"><div class="section-content">
          <div style="display:flex;flex-direction:column;gap:var(--s2);margin-top:var(--s2)">
            <input type="password" id="pin-new" class="input-field" placeholder="Ny adgangskode (mindst 6 tegn)">
            <input type="password" id="pin-confirm" class="input-field" placeholder="Gentag ny adgangskode">
            <button class="save-btn full" id="pin-save-btn" style="margin-top:var(--s1)">Gem ny adgangskode</button>
          </div>
        </div></div></div>
      </div>`;
  }

  function renderAddChildModal() {
    // Institution-feltet vises kun som info når forælderen allerede har børn
    // (dropdown'en bruges ikke til opslag — koden er globalt unik).
    const instMap = new Map();
    children.forEach(c => {
      if (c.institution_id && !instMap.has(c.institution_id)) {
        instMap.set(c.institution_id, c.institution_name || getInstitutionName() || 'Institution');
      }
    });
    const instFieldHTML = instMap.size > 0
      ? `<div class="modal-field">
            <label>Institution</label>
            <select id="link-institution" class="input-field">
              ${[...instMap.entries()].map(([id, name]) => `<option value="${id}">${esc(name)}</option>`).join('')}
            </select>
          </div>`
      : '';

    return `
      <div class="modal-overlay" id="add-child-modal">
        <div class="modal" style="position:relative">
          <button class="modal-close" id="modal-close-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          <div class="modal-title">Tilknyt barn</div>
          <div class="modal-subtitle">Indtast den 8-cifrede kode fra institutionen</div>
          ${instFieldHTML}
          <div class="modal-field">
            <label>Portalkode</label>
            <input type="text" id="link-code" class="input-field" placeholder="fx ABC12345" maxlength="8" style="text-transform:uppercase">
          </div>
          <div class="login-error" id="link-error"></div>
          <button class="save-btn full" id="link-btn" style="margin-top:var(--s3)">Tilknyt</button>
        </div>
      </div>`;
  }

  // ═══════════════════════════════════════
  //  SIDEBAR
  // ═══════════════════════════════════════

  let sidebarSearchQuery = '';

  function renderSidebarChildren() {
    const container = document.getElementById('sidebar-children');
    if (!container) return;

    const useDropdown = children.length > 4;

    if (useDropdown) {
      // Compact dropdown mode for many children (admin-parent)
      const selectedName = esc(selectedChild ? getChildName() : 'Vælg barn');
      const selectedBal = selectedChild?.balance != null ? `${formatKr(selectedChild.balance)} kr` : '';
      const selectedEmoji = selectedChild?.avatar_emoji || selectedChild?.emoji || '🧒';

      let filtered = children;
      if (sidebarSearchQuery) {
        const q = sidebarSearchQuery.toLowerCase();
        filtered = children.filter(c => ((c.child_name || c.name || '') + ' ' + (c.last_name || '')).toLowerCase().includes(q));
      }

      const optionsHtml = filtered.map(c => {
        const isActive = c.child_id === selectedChild?.child_id;
        const emoji = c.avatar_emoji || c.emoji || '🧒';
        const bal = c.balance != null ? `${formatKr(c.balance)} kr` : '';
        const name = esc(formatChildName(c));
        return `<div class="sidebar-dropdown-item${isActive ? ' active' : ''}" data-child-id="${c.child_id}" style="display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer;border-radius:6px;${isActive ? 'background:var(--flango-light,#fff3e0);font-weight:600;' : ''}">${emoji} <span style="flex:1;">${name}</span> <span style="font-size:11px;opacity:0.6;">${bal}</span></div>`;
      }).join('');

      container.innerHTML = `
        <div style="padding:4px 0;">
          <div id="sidebar-selected-child" style="display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer;border:1.5px solid var(--border,#e2e8f0);border-radius:10px;background:var(--flango-light,#fff9f0);">
            <span style="font-size:18px;">${selectedEmoji}</span>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${selectedName}</div>
              <div style="font-size:11px;opacity:0.6;">${selectedBal} · ${children.length} børn</div>
            </div>
            <span style="font-size:12px;opacity:0.4;">▼</span>
          </div>
          <div id="sidebar-child-dropdown" style="display:none;margin-top:4px;border:1.5px solid var(--border,#e2e8f0);border-radius:10px;background:var(--bg,#fff);max-height:50vh;overflow-y:auto;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
            <div style="padding:6px;position:sticky;top:0;background:inherit;z-index:1;">
              <input type="text" id="sidebar-child-search" placeholder="🔍 Søg barn..." value="${esc(sidebarSearchQuery)}"
                style="width:100%;padding:7px 10px;border:1.5px solid var(--border,#e2e8f0);border-radius:8px;font-size:12px;box-sizing:border-box;outline:none;">
            </div>
            <div id="sidebar-dropdown-list" style="padding:4px 6px;">${optionsHtml}</div>
          </div>
        </div>
      `;

      // Wire toggle dropdown
      const selectedEl = container.querySelector('#sidebar-selected-child');
      const dropdownEl = container.querySelector('#sidebar-child-dropdown');
      selectedEl?.addEventListener('click', () => {
        const isOpen = dropdownEl.style.display !== 'none';
        dropdownEl.style.display = isOpen ? 'none' : 'block';
        if (!isOpen) {
          const searchEl = container.querySelector('#sidebar-child-search');
          if (searchEl) setTimeout(() => searchEl.focus(), 50);
        }
      });

      // Wire search
      const searchEl = container.querySelector('#sidebar-child-search');
      if (searchEl) {
        searchEl.oninput = () => {
          sidebarSearchQuery = searchEl.value;
          const q = sidebarSearchQuery.toLowerCase();
          container.querySelectorAll('.sidebar-dropdown-item').forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = (!q || text.includes(q)) ? '' : 'none';
          });
        };
      }

      // Wire item selection
      container.querySelector('#sidebar-dropdown-list')?.addEventListener('click', (e) => {
        const item = e.target.closest('.sidebar-dropdown-item');
        if (!item) return;
        dropdownEl.style.display = 'none';
        sidebarSearchQuery = '';
        // Trigger child selection via existing handler
        const childId = item.dataset.childId;
        const child = children.find(c => c.child_id === childId);
        if (child) {
          selectedChild = child;
          loadChildData().then(() => {
            renderApp();
          });
        }
      });

      return; // Don't render normal list
    }

    // Normal mode (1-4 children)
    const items = children.map(c => {
      const isActive = c.child_id === selectedChild?.child_id;
      const emoji = c.avatar_emoji || c.emoji || '🧒';
      const bal = c.balance != null ? `${formatKr(c.balance)} kr` : '';
      return `<div class="sidebar-child-item${isActive ? ' active' : ''}" data-child-id="${c.child_id}"><div class="sidebar-child-avatar">${emoji}</div><div><div class="sidebar-child-name">${esc(formatChildName(c))}</div><div class="sidebar-child-saldo">${bal}</div></div></div>`;
    }).join('');
    container.innerHTML = items + `<div class="sidebar-add-child" id="add-child-btn-sidebar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Tilknyt barn</div>`;
  }

  // Build reverse lookup: section-id → tab-id
  const SECTION_TO_TAB = {};
  Object.entries(TAB_SECTIONS).forEach(([tabId, sectionIds]) => {
    sectionIds.forEach(id => { SECTION_TO_TAB[id] = tabId; });
  });

  function renderSidebarNav() {
    const nav = document.getElementById('sidebar-nav');
    if (!nav) return;
    const tabLabels = { 'tab-home': 'Overblik', 'tab-pay': 'Indbetaling', 'tab-limits': 'Grænser & Kost', 'tab-profile': 'Profil', 'tab-privacy': 'Privatliv' };
    const tabOrder = ['tab-home','tab-pay','tab-limits','tab-profile','tab-privacy'];
    let html = '';
    let isFirst = true;
    tabOrder.forEach(tabId => {
      const sectionIds = TAB_SECTIONS[tabId] || [];
      let groupHtml = '';
      sectionIds.forEach(id => {
        // Vis kun sektioner der FAKTISK er renderet (flag fra ⇒ ingen sektion ⇒ ingen død nav-knap).
        // Sidebaren læser DOM'en direkte, så alle feature-flag respekteres uden per-flag-specialtilfælde.
        if (!document.getElementById(id)) return;
        const item = SECTION_LABELS[id];
        if (!item) return;
        groupHtml += `<div class="sidebar-nav-item${isFirst ? ' active' : ''}" data-scroll="${id}" data-tab="${tabId}">${item.icon}${item.label}</div>`;
        isFirst = false;
      });
      if (!groupHtml) return; // ingen synlige sektioner i gruppen ⇒ drop tom gruppe-label
      html += `<div class="sidebar-group-label">${tabLabels[tabId] || ''}</div>` + groupHtml;
    });
    nav.innerHTML = html;

    // Bind scroll tracking for the active tab's sections
    rebindSidebarScrollTracking();
  }

  function rebindSidebarScrollTracking() {
    if (_sidebarObserver) _sidebarObserver.disconnect();
    if (isMobile()) return;
    const activeTab = document.querySelector('.tab-view.active');
    if (!activeTab) return;
    const activeTabId = activeTab.id;
    const sectionIds = (TAB_SECTIONS[activeTabId] || []);
    if (!sectionIds.length) return;
    _sidebarObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          document.querySelectorAll('.sidebar-nav-item').forEach(i => {
            i.classList.toggle('active', i.dataset.scroll === entry.target.id);
          });
        }
      });
    }, { rootMargin: '-20% 0px -60% 0px' });
    sectionIds.forEach(id => { const el = document.getElementById(id); if (el) _sidebarObserver.observe(el); });
  }

  // ═══════════════════════════════════════
  //  EVENT BINDING
  // ═══════════════════════════════════════

  let _docListenersBound = false;
  let _sectionToggling = false;

  function bindDocumentListeners() {
    if (_docListenersBound) return;
    _docListenersBound = true;

    // Section toggle (accordion) — delegated, only bind once
    document.addEventListener('click', function (e) {
      const header = e.target.closest('.section-header');
      if (!header) return;
      const section = header.closest('.section');
      if (!section) return;

      // Debounce: prevent double-fire from rapid clicks or bubbling
      if (_sectionToggling) return;
      _sectionToggling = true;
      setTimeout(function () { _sectionToggling = false; }, 300);

      e.stopPropagation();
      e.stopImmediatePropagation();

      toggleSection(section);

      // Lazy-load purchase profile
      if (section.id === 'section-profile' && !purchaseProfile) {
        loadPurchaseProfile();
      }

      // Lazy-load ugeplan (kun ved første åbning / efter barn-skift)
      if (section.id === 'section-ugeplan' && !ugeplanData) {
        loadUgeplan();
      }
    }, true); // use capture phase to fire first

    // Sidebar child selector — delegated, only bind once
    document.addEventListener('click', function (e) {
      const item = e.target.closest('.sidebar-child-item[data-child-id]');
      if (!item) return;
      const childId = item.dataset.childId;
      const child = children.find(c => c.child_id === childId);
      if (child) switchChild(child);
    });

    // Mobile child selector (dropdown) — delegated, only bind once
    document.addEventListener('click', function (e) {
      const chip = e.target.closest('.child-chip[data-child-id], .child-dd-item[data-child-id]');
      if (!chip) return;
      const childId = chip.dataset.childId;
      const child = children.find(c => c.child_id === childId);
      if (child) switchChild(child);
    });

    // Barn-dropdown: trigger åbner/lukker; klik udenfor lukker (valg re-renderer selv)
    document.addEventListener('click', function (e) {
      const menu = document.getElementById('child-dd-menu');
      if (!menu) return;
      const trigger = e.target.closest('#child-dd-trigger');
      if (trigger) {
        menu.hidden = !menu.hidden;
        trigger.setAttribute('aria-expanded', String(!menu.hidden));
        return;
      }
      if (!menu.hidden && !e.target.closest('#child-dd')) menu.hidden = true;
    });

    // Sidebar nav click — delegated, auto-switches tab if needed
    document.addEventListener('click', function (e) {
      const item = e.target.closest('.sidebar-nav-item[data-scroll]');
      if (!item) return;
      document.querySelectorAll('.sidebar-nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      const target = item.dataset.scroll;
      const targetTab = item.dataset.tab || SECTION_TO_TAB[target];
      const activeTab = document.querySelector('.tab-view.active');
      if (targetTab && (!activeTab || activeTab.id !== targetTab)) {
        // Switch to the correct tab first, then scroll
        switchTab(targetTab);
        requestAnimationFrame(() => { setTimeout(() => scrollToSection(target), 80); });
      } else if (target === 'section-balance') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        scrollToSection(target);
      }
    });

    // Event registration — delegated, only bind once
    document.addEventListener('click', function (e) {
      const regBtn = e.target.closest('.event-action-btn[data-event-id]');
      if (regBtn) {
        e.stopPropagation();
        handleEventRegister(regBtn.dataset.eventId, Number(regBtn.dataset.eventPrice) || 0);
        return;
      }
      const cancelBtn = e.target.closest('.event-cancel-btn[data-event-id]');
      if (cancelBtn) {
        e.stopPropagation();
        handleEventCancel(cancelBtn.dataset.eventId);
        return;
      }
      const payBtn = e.target.closest('.event-pay-btn[data-event-id]');
      if (payBtn) {
        e.stopPropagation();
        handleEventPay(payBtn.dataset.eventId, Number(payBtn.dataset.eventPrice) || 0);
        return;
      }
    });

    // Stepper buttons — delegated, only bind once
    document.addEventListener('click', function (e) {
      const btn = e.target.closest('.stepper-btn');
      if (!btn) return;
      const stepper = btn.closest('.stepper');
      const valEl = stepper.querySelector('.stepper-val');
      const isMinus = btn.classList.contains('stepper-minus');
      // data-step: skærmtid tælles i MINUTTER (spring à 5) — antal-steppere går i 1.
      // data-max: fx klubbens grænse; forældrens må ikke overstige den (serveren afviser ellers).
      const step = parseInt(stepper.dataset.step, 10) || 1;
      const max = stepper.dataset.max ? parseInt(stepper.dataset.max, 10) : null;
      let val = parseInt(valEl.textContent);
      if (isNaN(val)) val = 0; // '∞' → 0
      val = isMinus ? Math.max(0, val - step) : val + step;
      if (max != null && val > max) val = max;
      valEl.textContent = val === 0 ? '∞' : val;
      // Auto-save produkt-grænser ved ændring
      if (stepper.dataset.productId) {
        saveProductLimits();
      }
      // Auto-save skærmtid-grænser (debounced — stepping fyrer mange klik i træk)
      if (stepper.id === 'st-daily-stepper' || stepper.id === 'st-session-stepper') {
        if (_stSaveTimer) clearTimeout(_stSaveTimer);
        _stSaveTimer = setTimeout(saveScreentimeLimits, 700);
      }
      // Auto-save sukkerpolitik steppers ved ændring
      if (stepper.id === 'sugar-max-stepper' || stepper.id === 'sugar-per-product-stepper') {
        saveSugarPolicy();
      }
      // Auto-save dagens ret samlet grænse
      if (stepper.id === 'ds-max-stepper') {
        saveProductLimits();
      }
    });

    // History filter buttons — delegated
    document.addEventListener('click', function (e) {
      const btn = e.target.closest('.history-filter-btn[data-period]');
      if (!btn) return;
      const container = document.getElementById('history-content');
      if (container) container.innerHTML = renderHistoryContent(btn.dataset.period);
    });
  }

  function bindEvents() {
    // Delegated document-level listeners (only added once)
    bindDocumentListeners();

    // Bottom nav
    document.querySelectorAll('.bnav-item[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Quick actions — works on both mobile and desktop now
    document.querySelectorAll('[data-qa-scroll]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sectionId = btn.dataset.qaScroll;
        const tabId = btn.dataset.qaTab;
        if (tabId) {
          switchTab(tabId);
          requestAnimationFrame(() => { setTimeout(() => scrollToSection(sectionId), 80); });
        } else { scrollToSection(sectionId); }
      });
    });

    // Balance card nav buttons
    document.querySelectorAll('[data-nav-tab]').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.navTab));
    });

    // Desktop top tab bar clicks
    document.querySelectorAll('.dtab-item[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Chip groups (spending limit, etc.)
    document.querySelectorAll('.chip-group').forEach(group => {
      group.addEventListener('click', e => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        group.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        // Handle spending limit save
        if (group.id === 'spending-limit-chips') {
          const limit = chip.dataset.limit;
          const wrap = document.getElementById('limit-custom-wrap');
          if (limit === 'custom') {
            // "Andet...": fold beløbsfeltet ud (gemmes via Gem/Enter, ikke pr. tastetryk)
            if (wrap) {
              wrap.style.display = 'flex';
              const inp = document.getElementById('limit-custom-input');
              if (inp) setTimeout(() => inp.focus(), 50);
            }
          } else if (limit && selectedChild) {
            if (wrap) wrap.style.display = 'none';
            saveDailyLimit(Number(limit));
          }
        }
      });
    });

    // Daglig grænse → "Andet...": gem custom beløb (Gem-knap eller Enter)
    const limitCustomInput = document.getElementById('limit-custom-input');
    const limitCustomSave = document.getElementById('limit-custom-save');
    function saveCustomDailyLimit() {
      const v = parseInt(limitCustomInput ? limitCustomInput.value : '', 10);
      if (!Number.isFinite(v) || v < 1 || v > 1000) {
        showToast('Indtast et beløb mellem 1 og 1000 kr', 'error');
        return;
      }
      saveDailyLimit(v);
    }
    if (limitCustomSave) limitCustomSave.addEventListener('click', saveCustomDailyLimit);
    if (limitCustomInput) limitCustomInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); saveCustomDailyLimit(); }
    });

    // Period toggles
    document.querySelectorAll('.period-toggle').forEach(toggle => {
      toggle.addEventListener('click', e => {
        const btn = e.target.closest('.period-btn');
        if (!btn) return;
        toggle.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Topup option selection
    document.querySelectorAll('.topup-option').forEach(opt => {
      opt.addEventListener('click', () => {
        opt.closest('.topup-grid').querySelectorAll('.topup-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        const wrap = document.getElementById('topup-custom-wrap');
        if (opt.dataset.amount === 'custom') {
          if (wrap) { wrap.style.display = 'block'; const inp = document.getElementById('topup-custom-input'); if (inp) setTimeout(() => inp.focus(), 50); }
        } else {
          if (wrap) wrap.style.display = 'none';
          updateTopupAmount();
        }
      });
    });
    // "Andet": custom beløb (debounced så vi ikke laver en PI pr. tastetryk)
    const customInput = document.getElementById('topup-custom-input');
    if (customInput) {
      let customDebounce = null;
      customInput.addEventListener('input', () => {
        topupCustomAmount = customInput.value ? Number(customInput.value) : null;
        if (customDebounce) clearTimeout(customDebounce);
        customDebounce = setTimeout(updateTopupAmount, 600);
      });
    }

    // Stripe Checkout-knap (→ Stripes hostede betalingsside)
    const checkoutBtn = document.getElementById('pay-checkout');
    if (checkoutBtn) checkoutBtn.addEventListener('click', handleCheckout);

    // MobilePay (Vipps) payment — kun vipps-institutioner
    const mobilepayBtn = document.getElementById('pay-mobilepay');
    if (mobilepayBtn) mobilepayBtn.addEventListener('click', handleMobilePayTopup);

    // Demo: simuleret MobilePay-optankning (ingen rigtig betaling)
    const demoMpBtn = document.getElementById('pay-mobilepay-demo');
    if (demoMpBtn) demoMpBtn.addEventListener('click', handleDemoTopup);

    // Allergen cycling
    const allergenGrid = document.getElementById('allergen-grid');
    if (allergenGrid) {
      allergenGrid.addEventListener('click', e => {
        const item = e.target.closest('.allergen-item');
        if (!item) return;
        cycleAllergen(item);
      });
    }

    // Sugar policy toggles
    const sugarBlock = document.getElementById('sugar-block-toggle');
    if (sugarBlock) sugarBlock.addEventListener('change', () => saveSugarPolicy());

    // Diet toggles
    const dietVeg = document.getElementById('diet-vegetarian');
    const dietPork = document.getElementById('diet-no-pork');
    if (dietVeg) dietVeg.addEventListener('change', () => saveSugarPolicy());
    if (dietPork) dietPork.addEventListener('change', () => saveSugarPolicy());

    // Profile picture consent toggles — Sektion 5b/c (runde 2):
    // Disse toggles er nu det ENESTE styrings-sted. De skriver via
    // give_consent / withdraw_consent (parent_consents source of truth)
    // i stedet for legacy save_profile_picture_consent.
    const ppMaster = document.getElementById('pp-consent-master');
    const ppAula = document.getElementById('pp-consent-aula');
    const ppCamera = document.getElementById('pp-consent-camera');
    const ppAi = document.getElementById('pp-consent-ai');
    const ppAiReadmore = document.getElementById('pp-ai-readmore-btn');

    if (ppMaster) ppMaster.addEventListener('change', (e) => handleMasterToggle(e));
    if (ppAula) ppAula.addEventListener('change', (e) => handleProfilePictureConsentToggle(e, 'profile_picture_aula', 'aula'));
    if (ppCamera) ppCamera.addEventListener('change', (e) => handleProfilePictureConsentToggle(e, 'profile_picture_camera', 'camera'));
    if (ppAi) ppAi.addEventListener('change', (e) => handleProfilePictureConsentToggle(e, 'profile_picture_ai_openai', 'ai'));
    if (ppAiReadmore) ppAiReadmore.addEventListener('click', () => openAiLayer2Modal(false));

    // Forælder-upload consent toggle
    const ppParentUpload = document.getElementById('pp-consent-parent-upload');
    if (ppParentUpload) ppParentUpload.addEventListener('change', (e) => handleProfilePictureConsentToggle(e, 'profile_picture_parent_upload', 'parent_upload'));

    // Roblox personligt login consent toggle (opt-out) — i spilletid-sektionen
    const robloxConsent = document.getElementById('roblox-personal-login-consent');
    if (robloxConsent) robloxConsent.addEventListener('change', (e) => handleRobloxLoginConsentToggle(e));

    // Forælder-upload knap → åbn modal
    const ppUploadBtn = document.getElementById('pp-upload-btn');
    if (ppUploadBtn) {
      ppUploadBtn.addEventListener('click', () => {
        if (!selectedChild) return;
        if (demoBlocked()) return;
        if (!window.PortalParentPictureUpload) {
          showToast('Upload-modul ikke indlæst', 'error');
          return;
        }
        window.PortalParentPictureUpload.open({
          institutionId: selectedChild.institution_id,
          childId: selectedChild.child_id,
          childName: getChildName(),
          onUploaded: async (result) => {
            if (result?.success) {
              showToast('Billedet er sendt til godkendelse', 'success');
              await loadChildData();
              renderApp();
            } else {
              showToast(result?.error || 'Upload fejlede', 'error');
            }
          },
        });
      });
    }

    // Profile picture gallery: "Brug" button to set active
    document.querySelectorAll('.pp-activate-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const picId = btn.dataset.picId;
        if (!picId || !selectedChild) return;
        if (!confirm('Brug dette billede som profilbillede?')) return;
        try {
          await API.manageProfilePicture(selectedChild.child_id, 'set_active', picId);
          showToast('Profilbillede opdateret', 'success');
          await loadChildData();
          renderApp();
        } catch (err) {
          console.error('[Portal] Set active picture error:', err);
          showToast('Kunne ikke opdatere', 'error');
        }
      });
    });

    // Profile picture gallery: "✕" button to delete
    document.querySelectorAll('.pp-delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const picId = btn.dataset.picId;
        if (!picId || !selectedChild) return;
        if (!confirm('Vil du slette dette billede permanent?')) return;
        try {
          await API.manageProfilePicture(selectedChild.child_id, 'delete', picId);
          showToast('Billede slettet', 'success');
          await loadChildData();
          renderApp();
        } catch (err) {
          console.error('[Portal] Delete picture error:', err);
          showToast('Kunne ikke slette', 'error');
        }
      });
    });

    // Profile picture download buttons
    document.querySelectorAll('.pp-download-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation(); // Don't trigger gallery item click
        const url = btn.dataset.picUrl;
        if (!url) return;
        try {
          const resp = await fetch(url);
          const blob = await resp.blob();
          const ext = blob.type === 'image/png' ? '.png' : '.webp';
          const childName = (getChildName() || 'profilbillede').replace(/[\/\\:*?"<>|]/g, '_');
          const picType = btn.dataset.picType || '';
          const fileName = `${childName}${picType ? '_' + picType : ''}${ext}`;
          const dlUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = dlUrl; a.download = fileName;
          document.body.appendChild(a); a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(dlUrl);
        } catch (err) {
          console.error('[Portal] Download fejl:', err);
          showToast('Kunne ikke downloade', 'error');
        }
      });
    });

    // ─── Privacy & Rights event listeners ───
    bindPrivacyEventListeners();

    // Notification toggles
    wireTransferSection();

    const notifZero = document.getElementById('notif-zero');
    const notifLow = document.getElementById('notif-low');
    const notifPrimaryEmail = document.getElementById('notif-primary-email');
    const notifSaveEmailBtn = document.getElementById('notif-save-email-btn');
    const notifEventReminder = document.getElementById('notif-event-reminder');
    const notifEventInvite = document.getElementById('notif-event-invite');
    if (notifZero) notifZero.addEventListener('change', () => saveNotifications());
    if (notifLow) notifLow.addEventListener('change', () => saveNotifications());
    if (notifPrimaryEmail) notifPrimaryEmail.addEventListener('change', () => saveNotifications());
    if (notifSaveEmailBtn) notifSaveEmailBtn.addEventListener('click', () => saveNotifications());
    if (notifEventReminder) notifEventReminder.addEventListener('change', () => saveNotifications());
    if (notifEventInvite) notifEventInvite.addEventListener('change', () => saveNotifications());
    for (const pid of ['push-zero', 'push-low', 'push-event-reminder', 'push-event-invite']) {
      const el = document.getElementById(pid);
      if (el) el.addEventListener('change', () => saveNotifications());
    }
    if (notifPrimaryEmail) notifPrimaryEmail.addEventListener('change', syncEmailEventTogglesUI);
    const notifSecondaryInput = document.getElementById('notif-secondary-email');
    if (notifSecondaryInput) notifSecondaryInput.addEventListener('input', syncEmailEventTogglesUI);
    syncEmailEventTogglesUI();

    // Skærmtid: samtykke til forlænget spilletid (havde ingen handler — gemte aldrig)
    const stConsent = document.getElementById('st-consent-toggle');
    if (stConsent) stConsent.addEventListener('change', async () => {
      const ok = await saveScreentimeConsent(stConsent.checked);
      if (!ok) stConsent.checked = !stConsent.checked; // rul tilbage ved fejl
    });

    // Godkend spil: checkbox-ændringer (havde ingen handler → gemte aldrig)
    const gamesSection = document.getElementById('section-games');
    if (gamesSection) gamesSection.addEventListener('change', (e) => {
      if (e.target && e.target.matches('input[data-game-id]')) saveGamePermissions();
    });

    // PIN save
    const pinBtn = document.getElementById('pin-save-btn');
    if (pinBtn) pinBtn.addEventListener('click', handlePinChange);

    // Invite parent
    const inviteBtn = document.getElementById('invite-parent-btn');
    if (inviteBtn) inviteBtn.addEventListener('click', handleInviteParent);
    const inviteCopyBtn = document.getElementById('invite-copy-btn');
    if (inviteCopyBtn) inviteCopyBtn.addEventListener('click', () => {
      const code = document.getElementById('invite-parent-code')?.textContent;
      if (code) navigator.clipboard.writeText(code).then(() => {
        inviteCopyBtn.textContent = 'Kopieret!';
        setTimeout(() => { inviteCopyBtn.textContent = 'Kopier kode'; }, 1500);
      });
    });

    // Feedback tabs
    const feedbackTabs = document.getElementById('feedback-tabs');
    if (feedbackTabs) {
      feedbackTabs.addEventListener('click', e => {
        const tab = e.target.closest('.feedback-tab');
        if (!tab) return;
        feedbackTabs.querySelectorAll('.feedback-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.feedback-panel').forEach(p => p.style.display = 'none');
        const target = document.getElementById(tab.dataset.target);
        if (target) target.style.display = '';
      });
    }

    // Feedback: send-knapper
    const fbFlangoSend = document.getElementById('fb-flango-send');
    if (fbFlangoSend) fbFlangoSend.addEventListener('click', () => handleSendFeedback('flango', 'fb-flango-text', 'fb-flango-email', fbFlangoSend));
    const fbClubSend = document.getElementById('fb-club-send');
    if (fbClubSend) fbClubSend.addEventListener('click', () => handleSendFeedback('institution', 'fb-club-text', 'fb-club-email', fbClubSend));

    // Logout
    const sidebarLogout = document.getElementById('sidebar-logout');
    if (sidebarLogout) sidebarLogout.addEventListener('click', handleLogout);
    const navLogout = document.getElementById('nav-logout-btn');
    if (navLogout) navLogout.addEventListener('click', handleLogout);

    // Add child modal triggers
    bindAddChildModal();
  }

  function bindAddChildModal() {
    const modal = document.getElementById('add-child-modal');
    if (!modal) return;

    // Open triggers
    const openBtns = [
      document.getElementById('add-child-btn-mobile'),
      document.getElementById('add-child-btn-sidebar'),
    ];
    openBtns.forEach(btn => {
      if (btn) btn.addEventListener('click', () => modal.classList.add('visible'));
    });

    // Close
    const closeBtn = document.getElementById('modal-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('visible'));
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('visible'); });

    // Link child
    const linkBtn = document.getElementById('link-btn');
    if (linkBtn) linkBtn.addEventListener('click', handleLinkChild);
  }

  // ═══════════════════════════════════════
  //  ACTIONS / HANDLERS
  // ═══════════════════════════════════════

  function toggleSection(sectionEl) {
    if (!sectionEl) return;
    const isOpen = sectionEl.classList.contains('open');
    document.querySelectorAll('.section.open').forEach(s => s.classList.remove('open'));
    if (!isOpen) {
      sectionEl.classList.add('open');
      setTimeout(() => sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' }), 260);
    }
  }

  function switchTab(tabId) {
    document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.bnav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.dtab-item').forEach(b => b.classList.remove('active'));
    const tab = document.getElementById(tabId);
    if (tab) { tab.classList.add('active'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    if (tabId === 'tab-pay') {
      setTimeout(() => {
        const s = document.getElementById('section-topup');
        if (s && !s.classList.contains('open')) toggleSection(s);
      }, 100);
    }
    const navBtn = document.querySelector(`.bnav-item[data-tab="${tabId}"]`);
    if (navBtn) navBtn.classList.add('active');
    const dtabBtn = document.querySelector(`.dtab-item[data-tab="${tabId}"]`);
    if (dtabBtn) dtabBtn.classList.add('active');
    // Update sidebar scroll tracking for new active tab
    if (!isMobile()) rebindSidebarScrollTracking();
  }

  function scrollToSection(sectionId, openIt) {
    if (openIt === undefined) openIt = true;
    const section = document.getElementById(sectionId);
    if (!section) return;
    if (openIt) {
      document.querySelectorAll('.section.open').forEach(s => s.classList.remove('open'));
      section.classList.add('open');
    }
    setTimeout(() => {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      section.classList.remove('highlight-flash');
      void section.offsetWidth;
      section.classList.add('highlight-flash');
    }, 260);
  }

  function cycleAllergen(el) {
    const states = [{ cls: '', label: 'Tilladt', policy: 'allow' }, { cls: 'warn', label: 'Advarsel', policy: 'warn' }, { cls: 'blocked', label: 'Blokeret', policy: 'block' }];
    const current = el.classList.contains('blocked') ? 2 : el.classList.contains('warn') ? 1 : 0;
    const next = (current + 1) % 3;
    el.classList.remove('warn', 'blocked');
    if (states[next].cls) el.classList.add(states[next].cls);
    el.querySelector('.allergen-status').textContent = states[next].label;
    // Auto-save allergens
    saveAllergens();
  }

  async function loadPurchaseProfile(period, sortBy, view) {
    if (!selectedChild) return;
    const container = document.getElementById('purchase-profile-content');
    if (!container) return;
    ppCurrentPeriod = period || ppCurrentPeriod || 'all';
    ppCurrentSort = sortBy || ppCurrentSort || 'antal';
    ppCurrentView = view || ppCurrentView || 'bars';
    container.innerHTML = '<div style="text-align:center;padding:var(--s4)"><div class="portal-loading-spinner" style="margin:0 auto"></div></div>';
    try {
      const periodMap = { 'today': 'today', '7': '7', '30': '30', 'all': 'all' };
      const needDaily = ppCurrentView === 'graph';
      purchaseProfile = await API.getPurchaseProfile(selectedChild.child_id, periodMap[ppCurrentPeriod] || 'all', ppCurrentSort, needDaily);
      renderPurchaseProfileContent(container, purchaseProfile);
    } catch (err) {
      console.error('[Portal] Purchase profile error:', err);
      container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Kunne ikke indlæse købsprofil</div></div>';
    }
  }

  function ppFormatKr(val) {
    if (val == null) return '0 kr';
    return Number(val).toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' kr';
  }

  function renderPurchaseProfileContent(container, data) {
    if (!data) { container.innerHTML = '<div class="empty-state"><div class="empty-state-text">Ingen data</div></div>'; return; }
    const total = data.total_spent || data.total_amount || data.total || 0;
    const count = data.totalCount || data.total_count || data.purchase_count || 0;
    const avg = count > 0 ? (total / count) : 0;
    const chartData = data.chartData || data.products || data.top_products || [];

    // Period buttons (I dag / Uge / Måned / Altid)
    const periodBtns = ['today', '7', '30', 'all'].map(function (p) {
      var labels = { 'today': 'I dag', '7': 'Uge', '30': 'Måned', 'all': 'Altid' };
      return '<button class="pp-period-btn' + (ppCurrentPeriod === p ? ' active' : '') + '" data-period="' + p + '">' + labels[p] + '</button>';
    }).join('');

    // View toggle (Søjler / Graf)
    var viewBtns = ['bars', 'graph'].map(function (v) {
      var labels = { 'bars': 'Søjler', 'graph': 'Graf' };
      return '<button class="pp-view-btn' + (ppCurrentView === v ? ' active' : '') + '" data-view="' + v + '">' + labels[v] + '</button>';
    }).join('');

    // Sort buttons (only visible in bars mode)
    var sortBtns = ['antal', 'kr'].map(function (s) {
      var labels = { 'antal': 'Antal', 'kr': 'Beløb' };
      return '<button class="pp-sort-btn' + (ppCurrentSort === s ? ' active' : '') + '" data-sort="' + s + '">' + labels[s] + '</button>';
    }).join('');

    var controlsHTML = '<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:16px">'
      + '<div class="pp-btn-group">' + periodBtns + '</div>'
      + '<div class="pp-btn-group">' + viewBtns + '</div>'
      + (ppCurrentView === 'bars' ? '<div class="pp-btn-group">' + sortBtns + '</div>' : '')
      + '</div>';

    var summaryHTML = '<div class="chart-summary">'
      + '<div class="chart-stat"><div class="chart-stat-value">' + formatKr(total) + ' kr</div><div class="chart-stat-label">Samlet forbrug</div></div>'
      + '<div class="chart-stat"><div class="chart-stat-value">' + count + '</div><div class="chart-stat-label">Antal køb</div></div>'
      + '<div class="chart-stat"><div class="chart-stat-value">' + formatKr(avg) + ' kr</div><div class="chart-stat-label">Gns. pr. køb</div></div>'
      + '</div>';

    // ── GRAPH VIEW ──
    if (ppCurrentView === 'graph') {
      var dailyData = data.dailyData || [];
      if (!dailyData || dailyData.length === 0) {
        container.innerHTML = controlsHTML + summaryHTML + '<div class="empty-state"><div class="empty-state-text">Ingen daglig data i denne periode</div></div>';
        bindPPButtons(container);
        return;
      }
      container.innerHTML = controlsHTML + summaryHTML;
      renderPurchaseProfileGraph(container, dailyData);
      bindPPButtons(container);
      return;
    }

    // ── BARS VIEW ──
    if (!chartData || chartData.length === 0) {
      container.innerHTML = controlsHTML + summaryHTML + '<div class="empty-state"><div class="empty-state-text">Ingen købsdata i denne periode</div></div>';
      bindPPButtons(container);
      return;
    }

    // Build cylinder chart
    var chartContainer = document.createElement('div');
    chartContainer.className = 'purchase-profile-chart';
    chartContainer.style.cssText = 'display:flex;flex-direction:row;align-items:flex-end;gap:14px;padding:40px 20px 20px;background:#f8fafc;border-radius:16px;border:1px solid #e2e8f0;overflow-x:auto;-webkit-overflow-scrolling:touch;min-height:200px;';

    var maxVal = Math.max.apply(null, chartData.map(function (item) { return item.normalizedHeight || item.quantity || item.count || item.antal || 0; }));
    var fragment = document.createDocumentFragment();

    chartData.forEach(function (item, index) {
      var wrapper = document.createElement('div');
      wrapper.style.cssText = 'display:flex;flex-direction:column;align-items:center;position:relative;min-width:52px;flex:0 0 auto;';

      // Display value
      var displayValue = item.displayValue || (ppCurrentSort === 'kr' ? ppFormatKr(item.kr || item.amount || 0) : (item.antal || item.quantity || item.count || 0) + ' stk');
      var valueLabel = document.createElement('div');
      valueLabel.style.cssText = 'font-size:12px;font-weight:800;color:#1e293b;margin-bottom:6px;white-space:nowrap;';
      valueLabel.textContent = displayValue;

      // Bar height
      var normalizedHeight = item.normalizedHeight || (maxVal > 0 ? ((item.antal || item.quantity || item.count || 0) / maxVal * 100) : 0);
      var minH = 25, maxH = 170;
      var calcHeight = minH + (normalizedHeight / 100) * (maxH - minH);
      var colors = ppCylinderColors[index % ppCylinderColors.length];

      // Bar (cylinder body)
      var bar = document.createElement('div');
      bar.style.cssText = 'position:relative;width:38px;height:0;border-radius:19px 19px 6px 6px;transition:height 0.8s cubic-bezier(0.34,1.56,0.64,1);box-shadow:0 8px 20px rgba(0,0,0,0.15);cursor:pointer;';
      bar.style.setProperty('--final-height', Math.round(calcHeight) + 'px');
      bar.style.background = colors.bg;
      bar.style.boxShadow = '3px 0 0 ' + colors.shadow + ', 0 8px 16px rgba(0,0,0,0.15)';

      // Cap (top ellipse)
      var cap = document.createElement('div');
      cap.style.cssText = 'position:absolute;top:-7px;left:0;width:38px;height:14px;border-radius:50%;z-index:3;';
      cap.style.background = colors.cap;
      bar.appendChild(cap);

      // Tooltip
      var itemName = cleanProductName(item.name || '');
      var tooltip = document.createElement('div');
      tooltip.style.cssText = 'position:absolute;bottom:calc(100% + 16px);left:50%;transform:translateX(-50%);background:#1e293b;color:white;padding:10px 14px;border-radius:10px;font-size:13px;white-space:nowrap;opacity:0;visibility:hidden;transition:all 0.2s ease;z-index:100;pointer-events:none;';
      tooltip.innerHTML = '<div style="font-weight:800;border-bottom:1px solid rgba(255,255,255,0.2);padding-bottom:3px;margin-bottom:3px;">' + esc(itemName) + '</div>'
        + '<div style="display:flex;justify-content:space-between;gap:12px"><span>Antal:</span><span style="font-weight:700">' + (item.antal || item.quantity || item.count || 0) + '</span></div>'
        + '<div style="display:flex;justify-content:space-between;gap:12px"><span>Beløb:</span><span style="font-weight:700">' + ppFormatKr(item.kr || item.amount || 0) + '</span></div>';
      bar.appendChild(tooltip);

      // Hover events for tooltip
      bar.addEventListener('mouseenter', function () { tooltip.style.opacity = '1'; tooltip.style.visibility = 'visible'; });
      bar.addEventListener('mouseleave', function () { tooltip.style.opacity = '0'; tooltip.style.visibility = 'hidden'; });
      bar.addEventListener('click', function () {
        var isVis = tooltip.style.opacity === '1';
        tooltip.style.opacity = isVis ? '0' : '1';
        tooltip.style.visibility = isVis ? 'hidden' : 'visible';
      });

      // Icon
      var iconWrap = document.createElement('div');
      iconWrap.style.cssText = 'margin-top:10px;width:32px;height:32px;background:white;border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.08);border:1px solid #e2e8f0;overflow:hidden;';
      var icon = item.icon || item.emoji;
      // Resolve ::icon:: prefix to displayable URL
      if (icon && icon.startsWith('::icon::')) {
        var iconPath = icon.slice('::icon::'.length);
        if (iconPath && !iconPath.startsWith('http')) {
          icon = 'https://jbknjgbpghrbrstqwoxj.supabase.co/storage/v1/object/public/product-icons/' + iconPath;
        } else {
          icon = iconPath;
        }
      }
      if (item.isDagensRet) {
        iconWrap.innerHTML = '<span style="font-size:18px">🍽️</span>';
      } else if (item.isAndreVarer) {
        iconWrap.innerHTML = '<span style="font-size:18px">📦</span>';
      } else if (icon && (icon.startsWith('http') || icon.includes('.webp') || icon.includes('.png'))) {
        iconWrap.innerHTML = '<img src="' + esc(icon) + '" alt="" style="width:24px;height:24px;object-fit:contain">';
      } else if (icon) {
        iconWrap.innerHTML = '<span style="font-size:18px">' + icon + '</span>';
      } else {
        iconWrap.innerHTML = '<span style="font-size:18px">🛒</span>';
      }

      // Name label
      var nameLabel = document.createElement('div');
      nameLabel.style.cssText = 'margin-top:6px;font-size:11px;font-weight:700;color:#475569;text-align:center;max-width:62px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      nameLabel.textContent = itemName;
      nameLabel.title = itemName;

      wrapper.appendChild(valueLabel);
      wrapper.appendChild(bar);
      wrapper.appendChild(iconWrap);
      wrapper.appendChild(nameLabel);
      fragment.appendChild(wrapper);
    });

    chartContainer.appendChild(fragment);
    container.innerHTML = controlsHTML + summaryHTML;
    container.appendChild(chartContainer);

    // Animate bars
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var bars = chartContainer.querySelectorAll('[style*="--final-height"]');
        bars.forEach(function (b, i) {
          setTimeout(function () {
            b.style.height = b.style.getPropertyValue('--final-height');
          }, i * 80);
        });
      });
    });

    bindPPButtons(container);
  }

  // ── SVG Line/Area Graph for Purchase Profile ──
  function renderPurchaseProfileGraph(container, dailyData) {
    if (!dailyData || dailyData.length === 0) return;

    var sortBy = ppCurrentSort === 'kr' ? 'kr' : 'antal';
    var values = dailyData.map(function (d) { return d[sortBy] || 0; });
    var maxY = Math.max.apply(null, values);
    if (maxY === 0) maxY = 1;

    // Dimensions
    var paddingLeft = 52, paddingRight = 16, paddingTop = 20, paddingBottom = 44;
    var minWidthPerPoint = 24;
    var chartWidth = Math.max(paddingLeft + paddingRight + dailyData.length * minWidthPerPoint, 320);
    var chartHeight = 220;
    var drawW = chartWidth - paddingLeft - paddingRight;
    var drawH = chartHeight - paddingTop - paddingBottom;

    // Outer scrollable container
    var outer = document.createElement('div');
    outer.className = 'pp-graph-container';

    // SVG
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', chartWidth);
    svg.setAttribute('height', chartHeight);
    svg.setAttribute('viewBox', '0 0 ' + chartWidth + ' ' + chartHeight);
    svg.style.display = 'block';

    // Defs (gradient)
    var defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    var grad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    grad.setAttribute('id', 'ppAreaGrad');
    grad.setAttribute('x1', '0'); grad.setAttribute('y1', '0');
    grad.setAttribute('x2', '0'); grad.setAttribute('y2', '1');
    var stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop1.setAttribute('offset', '0%'); stop1.setAttribute('stop-color', '#3b82f6'); stop1.setAttribute('stop-opacity', '0.3');
    var stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop2.setAttribute('offset', '100%'); stop2.setAttribute('stop-color', '#3b82f6'); stop2.setAttribute('stop-opacity', '0.02');
    grad.appendChild(stop1); grad.appendChild(stop2);
    defs.appendChild(grad);
    svg.appendChild(defs);

    // Y-axis grid lines (5 lines)
    var gridLines = 5;
    for (var gi = 0; gi <= gridLines; gi++) {
      var yVal = (maxY / gridLines) * gi;
      var yPos = paddingTop + drawH - (gi / gridLines) * drawH;

      var gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      gridLine.setAttribute('x1', paddingLeft);
      gridLine.setAttribute('x2', chartWidth - paddingRight);
      gridLine.setAttribute('y1', yPos);
      gridLine.setAttribute('y2', yPos);
      gridLine.setAttribute('stroke', '#e2e8f0');
      gridLine.setAttribute('stroke-width', '1');
      svg.appendChild(gridLine);

      var yLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      yLabel.setAttribute('x', paddingLeft - 6);
      yLabel.setAttribute('y', yPos + 4);
      yLabel.setAttribute('text-anchor', 'end');
      yLabel.setAttribute('font-size', '10');
      yLabel.setAttribute('font-weight', '600');
      yLabel.setAttribute('fill', '#94a3b8');
      yLabel.textContent = sortBy === 'kr' ? Math.round(yVal) + ' kr' : Math.round(yVal);
      svg.appendChild(yLabel);
    }

    // Build points
    var points = [];
    for (var i = 0; i < dailyData.length; i++) {
      var x = paddingLeft + (dailyData.length > 1 ? (i / (dailyData.length - 1)) * drawW : drawW / 2);
      var y = paddingTop + drawH - ((values[i] / maxY) * drawH);
      points.push({ x: x, y: y, data: dailyData[i], value: values[i] });
    }

    // Area path
    if (points.length > 1) {
      var areaD = 'M' + points[0].x + ',' + points[0].y;
      for (var ai = 1; ai < points.length; ai++) {
        areaD += ' L' + points[ai].x + ',' + points[ai].y;
      }
      areaD += ' L' + points[points.length - 1].x + ',' + (paddingTop + drawH);
      areaD += ' L' + points[0].x + ',' + (paddingTop + drawH) + ' Z';

      var areaPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      areaPath.setAttribute('d', areaD);
      areaPath.setAttribute('fill', 'url(#ppAreaGrad)');
      svg.appendChild(areaPath);

      // Line path
      var lineD = 'M' + points[0].x + ',' + points[0].y;
      for (var li = 1; li < points.length; li++) {
        lineD += ' L' + points[li].x + ',' + points[li].y;
      }
      var linePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      linePath.setAttribute('d', lineD);
      linePath.setAttribute('fill', 'none');
      linePath.setAttribute('stroke', '#3b82f6');
      linePath.setAttribute('stroke-width', '2.5');
      linePath.setAttribute('stroke-linejoin', 'round');
      linePath.setAttribute('stroke-linecap', 'round');
      svg.appendChild(linePath);
    }

    // X-axis labels (adaptive)
    var labelEvery = 1;
    if (dailyData.length > 60) labelEvery = 7;
    else if (dailyData.length > 20) labelEvery = Math.ceil(dailyData.length / 15);

    for (var xi = 0; xi < points.length; xi++) {
      if (xi % labelEvery !== 0 && xi !== points.length - 1) continue;
      var dateObj = new Date(dailyData[xi].date + 'T00:00:00');
      var xLabelText;
      if (dailyData.length <= 7) {
        xLabelText = dateObj.toLocaleDateString('da-DK', { weekday: 'short' });
      } else {
        xLabelText = dateObj.getDate() + '. ' + dateObj.toLocaleDateString('da-DK', { month: 'short' });
      }
      var xLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      xLabel.setAttribute('x', points[xi].x);
      xLabel.setAttribute('y', chartHeight - 6);
      xLabel.setAttribute('text-anchor', 'middle');
      xLabel.setAttribute('font-size', '10');
      xLabel.setAttribute('font-weight', '600');
      xLabel.setAttribute('fill', '#94a3b8');
      xLabel.textContent = xLabelText;
      svg.appendChild(xLabel);
    }

    // Dots + tooltip
    var tooltipDiv = document.createElement('div');
    tooltipDiv.className = 'pp-graph-tooltip';
    tooltipDiv.style.display = 'none';

    points.forEach(function (pt, idx) {
      var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', pt.x);
      circle.setAttribute('cy', pt.y);
      circle.setAttribute('r', '4');
      circle.setAttribute('fill', '#3b82f6');
      circle.setAttribute('stroke', '#fff');
      circle.setAttribute('stroke-width', '2');
      circle.setAttribute('class', 'pp-graph-dot');
      circle.style.cursor = 'pointer';

      function showTip(e) {
        var d = pt.data;
        var dateObj2 = new Date(d.date + 'T00:00:00');
        var dateStr = dateObj2.toLocaleDateString('da-DK', { weekday: 'long', day: 'numeric', month: 'long' });
        tooltipDiv.innerHTML = '<div style="font-weight:700;margin-bottom:4px">' + dateStr + '</div>'
          + '<div>Beløb: <strong>' + ppFormatKr(d.kr) + '</strong></div>'
          + '<div>Antal: <strong>' + d.antal + ' stk</strong></div>';
        tooltipDiv.style.display = 'block';
        // Position tooltip near the dot
        var rect = outer.getBoundingClientRect();
        var tipX = pt.x - outer.scrollLeft;
        var tipY = pt.y - 10;
        tooltipDiv.style.left = tipX + 'px';
        tooltipDiv.style.top = tipY + 'px';
        tooltipDiv.style.transform = 'translate(-50%, -100%)';
      }
      function hideTip() {
        tooltipDiv.style.display = 'none';
      }
      circle.addEventListener('mouseenter', showTip);
      circle.addEventListener('mouseleave', hideTip);
      circle.addEventListener('click', function (e) {
        if (tooltipDiv.style.display === 'block') { hideTip(); } else { showTip(e); }
      });
      svg.appendChild(circle);
    });

    outer.appendChild(svg);
    outer.appendChild(tooltipDiv);
    container.appendChild(outer);
  }

  function bindPPButtons(container) {
    container.querySelectorAll('.pp-period-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { loadPurchaseProfile(btn.dataset.period, ppCurrentSort, ppCurrentView); });
    });
    container.querySelectorAll('.pp-sort-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { loadPurchaseProfile(ppCurrentPeriod, btn.dataset.sort, ppCurrentView); });
    });
    container.querySelectorAll('.pp-view-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { loadPurchaseProfile(ppCurrentPeriod, ppCurrentSort, btn.dataset.view); });
    });
  }

  async function saveProductLimits() {
    if (!selectedChild) return;
    const steppers = document.querySelectorAll('.stepper[data-product-id]');
    const limits = [];
    steppers.forEach(function (stepper) {
      const productId = stepper.dataset.productId;
      const valText = stepper.querySelector('.stepper-val')?.textContent ?? '∞';
      const val = valText === '∞' ? null : parseInt(valText);
      if (productId) limits.push({ product_id: productId, max_per_day: val });
    });
    // Dagens ret samlet grænse: ∞ = ubegrænset (null), ellers antal.
    let maxDailySpecial;
    const dsMaxEl = document.querySelector('#ds-max-stepper .stepper-val');
    if (dsMaxEl) {
      const v = dsMaxEl.textContent ?? '∞';
      maxDailySpecial = v === '∞' ? null : parseInt(v);
    }
    try {
      await API.saveProductLimits(selectedChild.child_id, limits, maxDailySpecial);
      if (maxDailySpecial !== undefined) dailySpecialLimit = maxDailySpecial;
      showToast('Grænse gemt', 'success');
    } catch (err) {
      console.error('[Portal] Save product limits error:', err);
      showToast('Kunne ikke gemme grænse', 'error');
    }
  }

  async function saveDailyLimit(limit) {
    if (!selectedChild) return;
    try {
      await API.saveDailyLimit(selectedChild.child_id, limit);
      // Hold lokal cache i sync, så "Din daglige grænse" + chip-tilstand er korrekte
      // ved næste re-render (ellers viste de den gamle værdi til næste fulde load).
      if (childData) childData.daily_spend_limit = limit;
      if (selectedChild) selectedChild.daily_spend_limit = limit;
      // Opdatér "Din daglige grænse"-boksen straks — ellers stod den gamle værdi og
      // fik gemningen til at se ud som om den fejlede.
      const limitHint = document.querySelector('#section-spending-limit .hint-box.green strong');
      if (limitHint && limit != null) limitHint.textContent = `${formatKr(limit)} kr`;
      showToast('Daglig grænse gemt', 'success');
    } catch (err) {
      console.error('[Portal] Save daily limit error:', err);
      showToast('Kunne ikke gemme grænse', 'error');
    }
  }

  // ─── Skærmtid: personlige grænser + samtykke ───
  // Disse blev aldrig gemt før — UI'et fandtes, API.saveScreentime fandtes, men
  // ingen af dem kaldte den. ∞ (0) = ingen personlig grænse → null på serveren.
  function readStepperMinutes(selector) {
    const el = document.querySelector(selector);
    if (!el) return null;
    const t = (el.textContent || '').trim();
    if (t === '∞' || t === '—' || t === '') return null;
    const n = parseInt(t, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  async function saveScreentimeLimits() {
    if (!selectedChild) return;
    const maxDaily = readStepperMinutes('#st-daily-stepper .stepper-val');
    const maxSession = readStepperMinutes('#st-session-stepper .stepper-val');
    try {
      await API.saveScreentime(selectedChild.child_id, {
        action: 'save_limits',
        institution_id: selectedChild.institution_id,
        max_daily_minutes: maxDaily,
        max_session_minutes: maxSession,
      });
      if (screentimeData) {
        screentimeData.parent_override = screentimeData.parent_override || {};
        screentimeData.parent_override.max_daily_minutes = maxDaily;
        screentimeData.parent_override.max_session_minutes = maxSession;
      }
      showToast('Spilletid gemt', 'success');
    } catch (err) {
      console.error('[Portal] Save screentime limits error:', err);
      showToast(err?.message || 'Kunne ikke gemme spilletid', 'error');
    }
  }

  async function saveScreentimeConsent(checked) {
    if (!selectedChild) return false;
    try {
      await API.saveScreentime(selectedChild.child_id, {
        action: 'save_extra_time_consent',
        institution_id: selectedChild.institution_id,
        extra_time_consent: checked,
      });
      if (screentimeData) {
        screentimeData.parent_override = screentimeData.parent_override || {};
        screentimeData.parent_override.extra_time_consent = checked;
      }
      showToast('Samtykke gemt', 'success');
      return true;
    } catch (err) {
      console.error('[Portal] Save screentime consent error:', err);
      showToast(err?.message || 'Kunne ikke gemme samtykke', 'error');
      return false;
    }
  }

  // Godkend spil: checkboxene havde ingen handler → gemte aldrig. Samler alle
  // (springer institution-blokerede over — de kan ikke ændres af forælderen) og gemmer.
  async function saveGamePermissions() {
    if (!selectedChild) return;
    const boxes = document.querySelectorAll('#section-games [data-game-id]');
    const permissions = [];
    boxes.forEach(b => {
      if (b.disabled) return;
      permissions.push({ game_id: b.dataset.gameId, allowed: b.checked });
    });
    if (permissions.length === 0) return;
    try {
      await API.saveScreentime(selectedChild.child_id, {
        action: 'save_game_permissions',
        institution_id: selectedChild.institution_id,
        permissions,
      });
      // Hold lokal cache i sync så re-render viser korrekt tilstand
      if (screentimeData && Array.isArray(screentimeData.games)) {
        const map = new Map(permissions.map(p => [p.game_id, p.allowed]));
        screentimeData.games.forEach(g => { if (map.has(g.id)) { g.allowed = map.get(g.id); g.set_by = 'parent'; } });
      }
      showToast('Spil-godkendelse gemt', 'success');
    } catch (err) {
      console.error('[Portal] Save game permissions error:', err);
      showToast(err?.message || 'Kunne ikke gemme', 'error');
    }
  }

  async function saveSugarPolicy() {
    if (!selectedChild) return;
    const blockEl = document.getElementById('sugar-block-toggle');
    const vegEl = document.getElementById('diet-vegetarian');
    const porkEl = document.getElementById('diet-no-pork');
    const maxDayEl = document.querySelector('#sugar-max-stepper .stepper-val');
    const maxPerEl = document.querySelector('#sugar-per-product-stepper .stepper-val');

    const policy = {
      block_unhealthy: blockEl ? blockEl.checked : false,
      vegetarian_only: vegEl ? vegEl.checked : false,
      no_pork: porkEl ? porkEl.checked : false,
    };
    if (maxDayEl) {
      const v = parseInt(maxDayEl.textContent);
      if (!isNaN(v) && v > 0) policy.max_unhealthy_per_day = v;
    }
    if (maxPerEl) {
      const v = parseInt(maxPerEl.textContent);
      // Kolonnen hedder max_unhealthy_per_product_per_day (parent_sugar_policy) — edge-fn'en
      // + get-parent-view bruger det navn. Portalen sendte 'max_per_product_per_day' → edge-fn
      // så undefined → per-produkt-grænsen blev ALDRIG gemt.
      if (!isNaN(v) && v > 0) policy.max_unhealthy_per_product_per_day = v;
    }

    try {
      await API.saveSugarPolicy(selectedChild.child_id, policy);
      showToast('Kostindstillinger gemt', 'success');
    } catch (err) {
      console.error('[Portal] Save sugar policy error:', err);
      showToast('Kunne ikke gemme', 'error');
    }
  }

  // saveProfilePictureConsent (legacy save_profile_picture_consent RPC) er
  // fjernet i runde 2 — Profilbilleder-toggles skriver nu via give_consent /
  // withdraw_consent (parent_consents source of truth) i stedet.

  // ═══════════════════════════════════════
  //  PRIVACY & RIGHTS — HANDLERS
  // ═══════════════════════════════════════

  function bindPrivacyEventListeners() {
    // Child name editing
    const editNameBtn = document.getElementById('privacy-edit-name-btn');
    const saveNameBtn = document.getElementById('privacy-save-name-btn');
    const cancelNameBtn = document.getElementById('privacy-cancel-name-btn');
    if (editNameBtn) editNameBtn.addEventListener('click', () => {
      document.getElementById('privacy-name-edit-form').style.display = '';
      editNameBtn.style.display = 'none';
      document.getElementById('privacy-name-input').focus();
    });
    if (cancelNameBtn) cancelNameBtn.addEventListener('click', () => {
      document.getElementById('privacy-name-edit-form').style.display = 'none';
      document.getElementById('privacy-edit-name-btn').style.display = '';
      document.getElementById('privacy-name-error').style.display = 'none';
    });
    if (saveNameBtn) saveNameBtn.addEventListener('click', () => handleSaveChildName());

    // Data insight
    const loadDataBtn = document.getElementById('privacy-load-data-btn');
    if (loadDataBtn) loadDataBtn.addEventListener('click', () => handleLoadDataExport());

    // Deletion request
    const requestDelBtn = document.getElementById('privacy-request-deletion-btn');
    const confirmDelBtn = document.getElementById('privacy-confirm-deletion-btn');
    const cancelDelBtn = document.getElementById('privacy-cancel-deletion-btn');
    if (requestDelBtn) requestDelBtn.addEventListener('click', () => {
      document.getElementById('privacy-deletion-form').style.display = 'none';
      document.getElementById('privacy-deletion-confirm').style.display = '';
      document.getElementById('privacy-deletion-name-input').focus();
    });
    if (cancelDelBtn) cancelDelBtn.addEventListener('click', () => {
      document.getElementById('privacy-deletion-confirm').style.display = 'none';
      document.getElementById('privacy-deletion-form').style.display = '';
      document.getElementById('privacy-deletion-error').style.display = 'none';
    });
    if (confirmDelBtn) confirmDelBtn.addEventListener('click', () => handleConfirmDeletion());

    // Delete parent account
    const deleteAccBtn = document.getElementById('privacy-delete-account-btn');
    const confirmAccBtn = document.getElementById('privacy-confirm-delete-account-btn');
    const cancelAccBtn = document.getElementById('privacy-cancel-delete-account-btn');
    if (deleteAccBtn) deleteAccBtn.addEventListener('click', () => {
      document.getElementById('privacy-delete-account-form').style.display = 'none';
      document.getElementById('privacy-delete-account-confirm').style.display = '';
      document.getElementById('privacy-delete-account-email-input').focus();
    });
    if (cancelAccBtn) cancelAccBtn.addEventListener('click', () => {
      document.getElementById('privacy-delete-account-confirm').style.display = 'none';
      document.getElementById('privacy-delete-account-form').style.display = '';
      document.getElementById('privacy-delete-account-error').style.display = 'none';
    });
    if (confirmAccBtn) confirmAccBtn.addEventListener('click', () => handleDeleteParentAccount());

    // Lazy-load linked parents and deletion status when privacy tab sections open
    const linkedSection = document.getElementById('section-linked-parents');
    const deleteSection = document.getElementById('section-delete-child');
    if (linkedSection) {
      const obs = new MutationObserver(() => {
        if (linkedSection.classList.contains('open')) { loadLinkedParents(); obs.disconnect(); }
      });
      obs.observe(linkedSection, { attributes: true, attributeFilter: ['class'] });
    }
    if (deleteSection) {
      const obs = new MutationObserver(() => {
        if (deleteSection.classList.contains('open')) { loadDeletionStatus(); obs.disconnect(); }
      });
      obs.observe(deleteSection, { attributes: true, attributeFilter: ['class'] });
    }

    // Samtykke-historik er read-only — kun expand/collapse-knapper
    document.querySelectorAll('.consent-history-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = document.getElementById(btn.dataset.target);
        if (!target) return;
        const open = target.style.display !== 'none';
        target.style.display = open ? 'none' : '';
        btn.textContent = btn.textContent.replace(open ? 'Skjul fuld historik' : 'Vis fuld historik', open ? 'Vis fuld historik' : 'Skjul fuld historik');
      });
    });
  }

  // ════════════════════════════════════════════════════════════════════
  // Profilbillede-samtykke-toggles — Sektion 5b/c (runde 2, 2026-04-27)
  // ════════════════════════════════════════════════════════════════════
  // Toggles på Profilbilleder-siden er nu source of truth for samtykker
  // (parent_consents). Asymmetri: aktivering viser informeret samtykke-
  // modal (Lag 2 for AI), deaktivering viser advarsels-popup. Bevidst —
  // aktivering er konstruktiv, deaktivering er destruktiv.

  function showConfirmModal(opts) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
      const bodyHtml = (opts.body || '').split('\n').map(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ')) {
          return `<li style="margin:2px 0">${esc(trimmed.substring(2))}</li>`;
        }
        if (trimmed === '') return '<br>';
        return `<p style="margin:0 0 8px;line-height:1.5">${esc(line)}</p>`;
      }).join('');
      const wrapped = bodyHtml.includes('<li')
        ? bodyHtml.replace(/(<li[^>]*>.*?<\/li>)+/gs, m => `<ul style="margin:0 0 8px;padding-left:20px">${m}</ul>`)
        : bodyHtml;
      const danger = opts.danger !== false;
      const confirmBg = danger
        ? 'background:#dc2626;color:#fff;border:none;'
        : 'background:#16a34a;color:#fff;border:none;';
      overlay.innerHTML = `
        <div style="background:#fff;color:#111;border-radius:14px;max-width:520px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
          <div style="padding:18px 22px;border-bottom:1px solid #e5e7eb;">
            <strong style="font-size:15px;">${esc(opts.title || 'Bekræft')}</strong>
          </div>
          <div style="padding:18px 22px;font-size:14px;line-height:1.5;color:#374151;">${wrapped}</div>
          <div style="padding:14px 22px;border-top:1px solid #e5e7eb;display:flex;justify-content:flex-end;gap:8px;">
            <button type="button" id="confirm-modal-cancel" style="padding:8px 16px;border-radius:8px;border:1px solid #d1d5db;background:#fff;cursor:pointer;font-weight:600;">${esc(opts.cancel || 'Annullér')}</button>
            <button type="button" id="confirm-modal-confirm" style="padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:600;${confirmBg}">${esc(opts.confirm || 'OK')}</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      const close = (result) => { overlay.remove(); resolve(result); };
      overlay.querySelector('#confirm-modal-cancel').onclick = () => close(false);
      overlay.querySelector('#confirm-modal-confirm').onclick = () => close(true);
    });
  }

  // openAiLayer2Modal(showActivateButton) — Lag 2-modal for AI-avatar-samtykke
  // (Microsoft Azure OpenAI, EU). Returnerer true hvis brugeren bekræfter aktivering.
  function openAiLayer2Modal(showActivateButton) {
    showActivateButton = showActivateButton === true;

    return new Promise((resolve) => {
      const ct = window.PortalConsentTexts || {};
      const layer2 = ct.parentAiAvatarLayer2Html || '<p>Privatlivspolitik ikke tilgængelig.</p>';

      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
      overlay.innerHTML = `
        <div style="background:#fff;color:#111;border-radius:14px;max-width:680px;width:100%;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
          <div style="padding:18px 22px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;">
            <strong style="font-size:15px;">Databehandling — AI-avatar</strong>
            <button type="button" id="ai-layer2-close" style="background:none;border:none;color:#6b7280;font-size:22px;cursor:pointer;line-height:1;">×</button>
          </div>
          <div style="padding:18px 22px;overflow-y:auto;font-size:13px;line-height:1.6;color:#374151;">${layer2}</div>
          <div style="padding:14px 22px;border-top:1px solid #e5e7eb;display:flex;justify-content:flex-end;gap:8px;">
            ${showActivateButton ? `<button type="button" id="ai-layer2-activate" style="padding:8px 16px;background:#16a34a;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600;">Bekræft og aktivér</button>` : ''}
            <button type="button" id="ai-layer2-cancel" style="padding:8px 16px;border-radius:8px;border:1px solid #d1d5db;background:#fff;cursor:pointer;font-weight:600;">${showActivateButton ? 'Annullér' : 'Luk'}</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      const close = (result) => { overlay.remove(); resolve(result); };
      overlay.querySelector('#ai-layer2-close').onclick = () => close(false);
      overlay.querySelector('#ai-layer2-cancel').onclick = () => close(false);
      if (showActivateButton) {
        overlay.querySelector('#ai-layer2-activate').onclick = () => close(true);
      }
    });
  }

  async function handleProfilePictureConsentToggle(e, consentType, kind) {
    if (!selectedChild) return;
    const toggle = e.target;
    // Block i simulator-session — admin må ikke afgive samtykke på vegne af forælder
    if (isAdminSimulatorSession()) {
      toggle.checked = !toggle.checked; // rul tilbage
      showAdminSimulatorBlockedAlert('samtykker');
      return;
    }
    // Demo: fiktive børn har ingen rigtige billeder at samtykke til
    if (isDemo()) {
      toggle.checked = !toggle.checked; // rul tilbage
      showToast('Funktionen er ikke aktiveret i demo-versionen', '');
      return;
    }
    const nowChecked = toggle.checked;
    const ct = window.PortalConsentTexts || {};

    let proceed = false;
    if (nowChecked) {
      // Aktivering: konstruktiv, vis informeret samtykke (Lag 2 for AI)
      if (kind === 'ai') {
        proceed = await openAiLayer2Modal(true);
      } else {
        const label = kind === 'aula' ? 'Aula-profilbillede'
          : kind === 'camera' ? 'Kamera-foto'
          : 'Forælder-upload';
        const body = kind === 'aula'
          ? 'Institutionen må bruge dit barns eksisterende Aula-foto som profilbillede i caféen.\n\nSamtykket registreres nu med tidspunkt og version.'
          : kind === 'camera'
            ? 'Personalet må tage et foto af dit barn med caféens enhed og bruge det som profilbillede.\n\nSamtykket registreres nu med tidspunkt og version.'
            : 'Du kan selv uploade et profilbillede af dit barn fra denne portal. Alle uploads gennemgås af institutionen før aktivering.\n\nSamtykket registreres nu med tidspunkt og version.';
        proceed = await showConfirmModal({
          title: `Aktivér samtykke: ${label}?`,
          body,
          confirm: 'Aktivér samtykke',
          cancel: 'Annullér',
          danger: false,
        });
      }
    } else {
      // Deaktivering: destruktiv, vis advarsels-popup
      const popupKey = kind === 'ai' ? 'ai_off'
        : kind === 'aula' ? 'aula_off'
        : kind === 'parent_upload' ? 'parent_upload_off'
        : 'camera_off';
      const cfg = ct.confirmTexts?.[popupKey];
      if (cfg) {
        proceed = await showConfirmModal(cfg);
      } else {
        proceed = confirm('Trække samtykke tilbage?');
      }
    }

    if (!proceed) {
      toggle.checked = !nowChecked;
      return;
    }

    toggle.disabled = true;
    try {
      // Vælg den rette versionsstreng for samtykket
      const version = kind === 'ai'
        ? (ct.PARENT_AI_AVATAR_VERSION || CURRENT_CONSENT_VERSION)
        : CURRENT_CONSENT_VERSION;
      const result = nowChecked
        ? await API.giveConsent(selectedChild.child_id, consentType, version, 'forældreportal_checkbox')
        : await API.withdrawConsent(selectedChild.child_id, consentType);

      if (result && result.success === false) {
        toggle.checked = !nowChecked;
        showToast(result.error || 'Kunne ikke gemme', 'error');
        return;
      }

      await refreshConsentHistory();
      syncOptOutCacheFromConsents();
      // Genlæs barn-data så library/profilbillede er friske
      try { await loadChildData(); } catch (_) { /* ignore */ }
      showToast(nowChecked ? 'Samtykke registreret' : 'Samtykke trukket tilbage', 'success');
      rerenderProfileAndConsentSections();
    } catch (err) {
      console.error('[Portal] consent toggle fejl:', err);
      toggle.checked = !nowChecked;
      showToast('Kunne ikke gemme', 'error');
    } finally {
      toggle.disabled = false;
    }
  }

  // Roblox personligt login (opt-out): default tilladt. Slå fra = aktivt fravalg
  // (server sletter et evt. gemt login). Slå til igen = gen-tilvalg.
  async function handleRobloxLoginConsentToggle(e) {
    if (!selectedChild) return;
    const toggle = e.target;
    if (isAdminSimulatorSession()) {
      toggle.checked = !toggle.checked; // rul tilbage
      showAdminSimulatorBlockedAlert('samtykker');
      return;
    }
    const nowChecked = toggle.checked;

    const proceed = nowChecked
      ? await showConfirmModal({
          title: 'Tillad personligt Roblox-login?',
          body: 'Dit barn kan logge ind med sin egen Roblox-konto på klubbens gaming-PC\'er, så koden ikke skal indtastes hver gang. Loginet gemmes krypteret på vores server.\n\nVi anbefaler at lade være, hvis barnet har Robux eller købte ting på sin konto — et gemt login er en adgang til kontoen. Barnet kan altid logge ind manuelt i stedet.\n\nValget registreres med tidspunkt og version.',
          confirm: 'Tillad',
          cancel: 'Annullér',
          danger: false,
        })
      : await showConfirmModal({
          title: 'Fravælg personligt Roblox-login?',
          body: 'Barnets gemte Roblox-login slettes, og "egen konto"-knappen forsvinder på PC\'erne. Barnet skal så selv logge ind manuelt.',
          confirm: 'Fravælg',
          cancel: 'Annullér',
          danger: true,
        });

    if (!proceed) {
      toggle.checked = !nowChecked;
      return;
    }

    toggle.disabled = true;
    try {
      const result = await API.setRobloxLoginConsent(selectedChild.child_id, nowChecked, CURRENT_CONSENT_VERSION);
      if (result && result.success === false) {
        toggle.checked = !nowChecked;
        showToast(result.error || 'Kunne ikke gemme', 'error');
        return;
      }
      await refreshConsentHistory();
      showToast(nowChecked ? 'Roblox-login tilladt' : 'Roblox-login fravalgt', 'success');
    } catch (err) {
      console.error('[Portal] roblox consent toggle fejl:', err);
      toggle.checked = !nowChecked;
      showToast('Kunne ikke gemme', 'error');
    } finally {
      toggle.disabled = false;
    }
  }

  async function handleMasterToggle(e) {
    if (!selectedChild) return;
    const toggle = e.target;
    if (isAdminSimulatorSession()) {
      toggle.checked = !toggle.checked;
      showAdminSimulatorBlockedAlert('samtykker');
      return;
    }
    const nowChecked = toggle.checked;
    const ct = window.PortalConsentTexts || {};

    if (!nowChecked) {
      // Master OFF — vis stærk advarsel (sletter alt)
      const cfg = ct.confirmTexts?.master_off;
      const proceed = await (cfg ? showConfirmModal(cfg) : Promise.resolve(confirm('Slå alle profilbilleder fra?')));
      if (!proceed) {
        toggle.checked = true;
        return;
      }
      toggle.disabled = true;
      try {
        // Træk alle aktive samtykker tilbage parallelt. Hver
        // withdraw_consent håndterer sin egen sletning + storage-cleanup.
        const types = getConsentTypesForChild()
          .map(t => t.key)
          .filter(k => activeConsentFor(k));
        const results = await Promise.allSettled(
          types.map(t => API.withdrawConsent(selectedChild.child_id, t))
        );
        const failed = results.filter(r => r.status === 'rejected' || (r.value && r.value.success === false));
        if (failed.length > 0) {
          console.warn('[Portal] master OFF: nogle withdrawals fejlede', failed);
          showToast(`Slog ${types.length - failed.length}/${types.length} samtykker fra. Prøv igen.`, 'error');
        } else {
          showToast('Alle profilbilleder fjernet', 'success');
        }
        await refreshConsentHistory();
        syncOptOutCacheFromConsents();
        try { await loadChildData(); } catch (_) { /* ignore */ }
        rerenderProfileAndConsentSections();
      } catch (err) {
        console.error('[Portal] master OFF fejl:', err);
        showToast('Kunne ikke slå alle fra', 'error');
        toggle.checked = true;
      } finally {
        toggle.disabled = false;
      }
    } else {
      // Master ON — aktiverer kun UI'en, ingen automatisk re-grant.
      // GDPR-pragmatisk: forælder skal selv vælge hvilke at aktivere.
      const typeToggles = document.getElementById('pp-type-toggles');
      if (typeToggles) {
        typeToggles.style.opacity = '';
        typeToggles.style.pointerEvents = '';
      }
      showToast('Vælg hvilke billed-typer du vil aktivere', 'success');
    }
  }

  function rerenderProfileAndConsentSections() {
    // Re-render begge sektioner in-place så de viser opdateret tilstand.
    ['section-profile-picture', 'section-consents'].forEach(id => {
      const oldSection = document.getElementById(id);
      if (!oldSection) return;
      const wasOpen = oldSection.classList.contains('open');
      const temp = document.createElement('div');
      temp.innerHTML = id === 'section-profile-picture' ? renderProfilePictureSection() : renderConsentsSection();
      const newSection = temp.firstElementChild;
      if (!newSection) return;
      if (wasOpen) newSection.classList.add('open');
      oldSection.replaceWith(newSection);
    });
    // Re-bind handlers på nye toggles (de gamle node-references er væk)
    bindEvents();
  }

  async function refreshConsentHistory() {
    if (!selectedChild) return;
    try {
      const rows = await API.getConsentHistory(selectedChild.child_id);
      consentHistory = Array.isArray(rows) ? rows : [];
    } catch (err) {
      console.error('[Portal] refreshConsentHistory error:', err);
    }
  }

  function syncOptOutCacheFromConsents() {
    if (!childData || !Array.isArray(consentHistory)) return;
    const has = (t) => consentHistory.some(c => c.consent_type === t && c.is_active);
    const hasAula = has('profile_picture_aula');
    const hasCamera = has('profile_picture_camera');
    const hasAi = has('profile_picture_ai_openai');
    const hasParentUpload = has('profile_picture_parent_upload');
    childData.profile_picture_opt_out_aula = !hasAula;
    childData.profile_picture_opt_out_camera = !hasCamera;
    childData.profile_picture_opt_out_ai = !hasAi;
    childData.profile_picture_opt_out_parent_upload = !hasParentUpload;
    childData.profile_picture_opt_out = !hasAula && !hasCamera && !hasAi && !hasParentUpload;
  }

  async function handleSaveChildName() {
    if (!selectedChild) return;
    const input = document.getElementById('privacy-name-input');
    const lastInput = document.getElementById('privacy-lastname-input');
    const errorEl = document.getElementById('privacy-name-error');
    const lnOn = isLastNameEnabledForChild(selectedChild);
    const newName = (input.value || '').trim();
    const newLast = lastInput ? (lastInput.value || '').trim() : '';
    if (newName.length < 2 || newName.length > 50) {
      errorEl.textContent = lnOn ? 'Fornavnet skal være mellem 2 og 50 tegn.' : 'Navnet skal være mellem 2 og 50 tegn.';
      errorEl.style.display = '';
      return;
    }
    if (lnOn && newLast.length > 50) {
      errorEl.textContent = 'Efternavnet må højst være 50 tegn.';
      errorEl.style.display = '';
      return;
    }
    errorEl.style.display = 'none';
    try {
      const result = await API.updateChildName(selectedChild.child_id, newName, lnOn ? newLast : null, lnOn);
      if (result && result.success === false) {
        errorEl.textContent = result.error || 'Kunne ikke gemme';
        errorEl.style.display = '';
        return;
      }
      // Opdater lokal state
      const savedFirst = (result && result.new_name) || newName;
      selectedChild.child_name = savedFirst;
      selectedChild.name = savedFirst;
      if (childData) childData.name = savedFirst;
      if (lnOn) {
        const savedLast = (result && ('last_name' in result)) ? (result.last_name || '') : newLast;
        selectedChild.last_name = savedLast || null;
        if (childData) childData.last_name = savedLast || null;
      }
      document.getElementById('privacy-child-name-display').textContent = getChildName();
      document.getElementById('privacy-name-edit-form').style.display = 'none';
      document.getElementById('privacy-edit-name-btn').style.display = '';
      showToast('Navnet er ændret', 'success');
    } catch (err) {
      console.error('[Privacy] Save name error:', err);
      errorEl.textContent = 'Der opstod en fejl. Prøv igen.';
      errorEl.style.display = '';
    }
  }

  async function handleLoadDataExport() {
    if (!selectedChild) return;
    const contentEl = document.getElementById('privacy-data-content');
    const loadingEl = document.getElementById('privacy-data-loading');
    const resultEl = document.getElementById('privacy-data-result');
    contentEl.style.display = 'none';
    loadingEl.style.display = '';
    try {
      const rawData = await API.getDataExport(selectedChild.child_id);
      // Tilføj metadata client-side
      let parentEmail = '';
      try { parentEmail = currentSession?.user?.email || ''; } catch (_e) {}
      const data = {
        export_metadata: {
          exported_at: new Date().toISOString(),
          exported_by: parentEmail,
          format_version: '1.0',
        },
        ...rawData,
      };
      loadingEl.style.display = 'none';
      resultEl.style.display = '';
      resultEl.innerHTML = renderDataExportView(data);
      // Bind download button
      const dlBtn = document.getElementById('privacy-download-json-btn');
      if (dlBtn) dlBtn.addEventListener('click', () => downloadDataAsJson(data));
    } catch (err) {
      console.error('[Privacy] Data export error:', err);
      loadingEl.style.display = 'none';
      contentEl.style.display = '';
      showToast('Kunne ikke indlæse data', 'error');
    }
  }

  function renderDataExportView(data) {
    const child = data.child || {};
    const purchases = data.purchases || [];
    const deposits = data.deposits || [];
    const settings = data.parent_settings || {};
    const consents = data.consents || {};
    const events = data.event_registrations || [];

    let html = '<div style="display:flex;flex-direction:column;gap:var(--s4)">';

    // Stamdata
    html += '<div><div style="font-weight:700;margin-bottom:var(--s2)">Stamdata</div><table style="width:100%;font-size:13px;border-collapse:collapse">';
    const fields = [
      ['Navn', child.name],
      ...(child.last_name ? [['Efternavn', child.last_name]] : []),
      ['Kontonummer', child.number], ['Klassetrin', child.grade_level ?? 'Ikke sat'],
      ['Saldo', (child.balance != null ? child.balance + ' kr' : '—')],
      ['Daglig forbrugsgrænse', child.daily_spend_limit ? child.daily_spend_limit + ' kr' : 'Ikke sat'],
      ['Oprettet', child.created_at ? new Date(child.created_at).toLocaleDateString('da-DK') : '—'],
    ];
    fields.forEach(([k, v]) => { html += `<tr><td style="padding:4px 8px 4px 0;color:var(--ink-muted);white-space:nowrap">${k}</td><td style="padding:4px 0">${esc(String(v ?? ''))}</td></tr>`; });
    html += '</table></div>';

    // Købshistorik (top 50)
    if (purchases.length > 0) {
      html += '<div><div style="font-weight:700;margin-bottom:var(--s2)">Købshistorik (seneste ' + Math.min(purchases.length, 50) + ')</div>';
      html += '<div style="overflow-x:auto"><table style="width:100%;font-size:12px;border-collapse:collapse">';
      html += '<tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:4px 8px 4px 0">Dato</th><th style="text-align:left;padding:4px 8px">Produkt</th><th style="text-align:right;padding:4px 0">Beløb</th></tr>';
      purchases.slice(0, 50).forEach(p => {
        const date = p.sold_at ? new Date(p.sold_at).toLocaleDateString('da-DK') : '—';
        html += `<tr style="border-bottom:1px solid var(--surface-sunken)"><td style="padding:4px 8px 4px 0;color:var(--ink-muted)">${date}</td><td style="padding:4px 8px">${esc(p.product || '')}${p.quantity > 1 ? ' x' + p.quantity : ''}</td><td style="text-align:right;padding:4px 0">${p.price ?? '—'} kr</td></tr>`;
      });
      html += '</table></div></div>';
    }

    // Indbetalinger
    if (deposits.length > 0) {
      html += '<div><div style="font-weight:700;margin-bottom:var(--s2)">Indbetalinger</div>';
      html += '<div style="overflow-x:auto"><table style="width:100%;font-size:12px;border-collapse:collapse">';
      html += '<tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:4px 8px 4px 0">Dato</th><th style="text-align:right;padding:4px 8px">Beløb</th><th style="text-align:left;padding:4px 0">Metode</th></tr>';
      deposits.forEach(d => {
        const date = d.created_at ? new Date(d.created_at).toLocaleDateString('da-DK') : '—';
        html += `<tr style="border-bottom:1px solid var(--surface-sunken)"><td style="padding:4px 8px 4px 0;color:var(--ink-muted)">${date}</td><td style="text-align:right;padding:4px 8px">${d.amount ?? '—'} kr</td><td style="padding:4px 0">${esc(d.method || 'manuel')}</td></tr>`;
      });
      html += '</table></div></div>';
    }

    // Indstillinger
    html += '<div><div style="font-weight:700;margin-bottom:var(--s2)">Dine indstillinger</div><div style="font-size:13px;color:var(--ink-soft);line-height:1.6">';
    const sugar = settings.sugar_policy || {};
    html += `Sukkerpolitik: ${sugar.enabled ? 'Aktiv' : 'Inaktiv'}`;
    if (sugar.block_unhealthy) html += ' (bloker usunde)';
    if (sugar.max_unhealthy_per_day) html += `, max ${sugar.max_unhealthy_per_day}/dag`;
    html += '<br>';
    const allergens = settings.allergens || [];
    html += `Allergener: ${allergens.length > 0 ? allergens.map(a => a.allergen + '=' + a.policy).join(', ') : 'Ingen sat'}<br>`;
    html += `Produktgrænser: ${(settings.product_limits || []).length} produkter med grænser<br>`;
    const notif = settings.notifications || {};
    html += `Notifikationer: ${notif.email ? 'Aktiv (' + esc(notif.email) + ')' : 'Inaktiv'}`;
    html += '</div></div>';

    // Samtykker
    const pp = consents.profile_picture || {};
    html += '<div><div style="font-weight:700;margin-bottom:var(--s2)">Samtykker</div><div style="font-size:13px;color:var(--ink-soft)">';
    html += `Profilbillede — Aula: ${pp.opt_out_aula ? 'Fravalgt' : 'Tilladt'}, Kamera: ${pp.opt_out_camera ? 'Fravalgt' : 'Tilladt'}, AI: ${pp.opt_out_ai ? 'Fravalgt' : 'Tilladt'}`;
    html += '</div></div>';

    // Event-tilmeldinger
    if (events.length > 0) {
      html += '<div><div style="font-weight:700;margin-bottom:var(--s2)">Event-tilmeldinger</div><div style="font-size:13px">';
      events.forEach(ev => {
        const date = ev.event_date ? new Date(ev.event_date).toLocaleDateString('da-DK') : '—';
        html += `<div style="padding:2px 0">${esc(ev.title || '')} (${date}) &mdash; ${esc(ev.registration_status || '')} / ${esc(ev.payment_status || '')}</div>`;
      });
      html += '</div></div>';
    }

    html += '</div>';

    // Download button
    html += `<button class="save-btn" id="privacy-download-json-btn" style="margin-top:var(--s4)">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Download al data som JSON
    </button>`;

    return html;
  }

  function downloadDataAsJson(data) {
    const childName = (data.child?.name || 'barn').split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `flango-data-${childName}-${dateStr}.json`;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    showToast('Data downloadet', 'success');
  }

  async function loadLinkedParents() {
    if (!selectedChild) return;
    const container = document.getElementById('privacy-linked-parents-content');
    if (!container) return;
    try {
      const parents = await API.getLinkedParents(selectedChild.child_id);
      if (!parents || parents.length === 0) {
        container.innerHTML = '<p style="color:var(--ink-muted)">Ingen tilknyttede forældre fundet.</p>';
        return;
      }
      let html = `<p style="color:var(--ink-soft);margin:0 0 var(--s3)">Disse forældrekonti har adgang til ${esc(getChildName())} i Flango:</p>`;
      parents.filter(p => !p.email?.endsWith('@flango.internal')).forEach(p => {
        const date = p.linked_at ? new Date(p.linked_at).toLocaleDateString('da-DK') : '—';
        const youTag = p.is_current_user ? ' <span style="color:var(--positive);font-weight:600">(dig)</span>' : '';
        html += `<div style="display:flex;align-items:center;gap:var(--s2);padding:var(--s2) 0;border-bottom:1px solid var(--surface-sunken)">
          <span style="font-size:20px">👤</span>
          <div style="flex:1"><div style="font-weight:500">${esc(p.email)}${youTag}</div><div style="font-size:12px;color:var(--ink-muted)">Tilknyttet: ${date}</div></div>
        </div>`;
      });
      html += '<p style="font-size:12px;color:var(--ink-muted);margin:var(--s3) 0 0">Hvis du ikke genkender en konto, kontakt institutionens personale.</p>';
      container.innerHTML = html;
    } catch (err) {
      console.error('[Privacy] Load linked parents error:', err);
      container.innerHTML = '<p style="color:var(--negative,#dc2626)">Kunne ikke indlæse data.</p>';
    }
  }

  async function loadDeletionStatus() {
    if (!selectedChild) return;
    const statusEl = document.getElementById('privacy-deletion-status');
    const formEl = document.getElementById('privacy-deletion-form');
    if (!statusEl || !formEl) return;
    try {
      const result = await API.getDeletionStatus(selectedChild.child_id);
      if (result && result.status && result.status !== 'none') {
        formEl.style.display = 'none';
        document.getElementById('privacy-deletion-confirm').style.display = 'none';
        statusEl.style.display = '';
        let statusHtml = '';
        if (result.status === 'pending') {
          const date = result.requested_at ? new Date(result.requested_at).toLocaleDateString('da-DK') : '—';
          statusHtml = `<div class="hint-box blue"><span class="hint-icon">📋</span><span><strong>Sletningsanmodning</strong><br>Anmodet: ${date}<br>Status: ⏳ Under behandling<br><br>Du kan kontakte institutionen hvis du har spørgsmål.</span></div>`;
        } else if (result.status === 'completed') {
          const date = result.processed_at ? new Date(result.processed_at).toLocaleDateString('da-DK') : '—';
          const receipt = result.deletion_receipt;
          let receiptHtml = '';
          if (receipt) {
            const del = receipt.deleted || {};
            const anon = receipt.anonymized || {};
            const sumAnon = (anon.sales || 0) + (anon.events || 0) + (anon.event_registrations || 0)
                          + (anon.parent_consents || 0) + (anon.feedback || 0)
                          + (anon.topup_imports || 0) + (anon.gaming_session_history || 0);
            receiptHtml = `<br><br><strong>Hvad blev der gjort?</strong>` +
              `<br>• Barnets profil og personoplysninger er fjernet` +
              (sumAnon > 0
                ? `<br>• ${sumAnon} historiske rækker er anonymiseret (beløb og datoer bevares af bogføringshensyn — barnets navn er fjernet)`
                : '') +
              `<br>• Audit-loggen bevares i 24 mdr af compliance-hensyn`;
          }
          statusHtml = `<div class="hint-box green" style="border-color:var(--positive)"><span class="hint-icon">&#10003;</span><span><strong>Sletning gennemført</strong><br>Dato: ${date}${receiptHtml}</span></div>`;
        } else if (result.status === 'rejected') {
          const reason = result.rejection_reason || 'Ingen begrundelse angivet';
          statusHtml = `<div class="hint-box orange"><span class="hint-icon">❌</span><span><strong>Anmodning afvist</strong><br>Begrundelse: ${esc(reason)}<br><br>Kontakt institutionen for yderligere information.</span></div>`;
          // Show form again so they can re-request
          formEl.style.display = '';
        }
        statusEl.innerHTML = statusHtml;
      }
    } catch (err) {
      console.error('[Privacy] Load deletion status error:', err);
    }
  }

  async function handleConfirmDeletion() {
    if (!selectedChild) return;
    if (demoBlocked()) return;
    if (isAdminSimulatorSession()) {
      showAdminSimulatorBlockedAlert('sletning af barnets data');
      return;
    }
    const input = document.getElementById('privacy-deletion-name-input');
    const errorEl = document.getElementById('privacy-deletion-error');
    const typedName = (input.value || '').trim().toLowerCase();
    const childName = getChildName().toLowerCase();
    if (typedName !== childName) {
      errorEl.textContent = 'Navnet matcher ikke. Prøv igen.';
      errorEl.style.display = '';
      return;
    }
    errorEl.style.display = 'none';
    try {
      const result = await API.requestDeletion(selectedChild.child_id);
      if (result && result.success === false) {
        errorEl.textContent = result.error || 'Kunne ikke oprette anmodning';
        errorEl.style.display = '';
        return;
      }
      showToast('Sletningsanmodning sendt', 'success');
      loadDeletionStatus(); // Refresh to show status
    } catch (err) {
      console.error('[Privacy] Deletion request error:', err);
      errorEl.textContent = 'Der opstod en fejl. Prøv igen.';
      errorEl.style.display = '';
    }
  }

  async function handleDeleteParentAccount() {
    if (demoBlocked()) return;
    if (isAdminSimulatorSession()) {
      showAdminSimulatorBlockedAlert('sletning af forælderkonto');
      return;
    }
    const input = document.getElementById('privacy-delete-account-email-input');
    const errorEl = document.getElementById('privacy-delete-account-error');
    const typedEmail = (input.value || '').trim().toLowerCase();
    let parentEmail = '';
    try { parentEmail = (currentSession?.user?.email || '').toLowerCase(); } catch (_e) {}
    if (!parentEmail || typedEmail !== parentEmail) {
      errorEl.textContent = 'E-mailen matcher ikke.';
      errorEl.style.display = '';
      return;
    }
    errorEl.style.display = 'none';
    try {
      const result = await API.deleteParentAccount();
      if (result && result.success === false) {
        errorEl.textContent = result.error || 'Kunne ikke slette kontoen';
        errorEl.style.display = '';
        return;
      }
      // Log out and redirect
      try { await API.signOut(); } catch (_e) {}
      showToast('Din konto er slettet', 'success');
      setTimeout(() => { window.location.reload(); }, 1500);
    } catch (err) {
      console.error('[Privacy] Delete account error:', err);
      errorEl.textContent = 'Der opstod en fejl. Prøv igen.';
      errorEl.style.display = '';
    }
  }

  async function saveAllergens() {
    if (!selectedChild) return;
    const items = document.querySelectorAll('#allergen-grid .allergen-item');
    const settings = {};
    items.forEach(item => {
      const key = item.dataset.allergen;
      if (item.classList.contains('blocked')) settings[key] = 'block';
      else if (item.classList.contains('warn')) settings[key] = 'warn';
      else settings[key] = 'allow';
    });
    try {
      await API.saveAllergySettings(selectedChild.child_id, settings);
      showToast('Allergi-indstillinger gemt', 'success');
    } catch (err) {
      console.error('[Portal] Save allergens error:', err);
      showToast('Kunne ikke gemme', 'error');
    }
  }

  function syncEmailEventTogglesUI() {
    const primary = document.getElementById('notif-primary-email');
    const secondary = document.getElementById('notif-secondary-email');
    if (!primary) return;
    // Kanalen er kun reelt slukket når kontoe-mail er fra OG der ingen ekstra e-mail er
    const off = !primary.checked && (!secondary || !secondary.value.trim());
    for (const id of ['notif-zero', 'notif-low', 'notif-event-reminder', 'notif-event-invite']) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.disabled = off;
      const row = el.closest('.setting-row');
      if (row) row.style.opacity = off ? '.45' : '';
    }
  }

  async function saveNotifications() {
    if (!selectedChild) return;
    var zeroEl = document.getElementById('notif-zero');
    var lowEl = document.getElementById('notif-low');
    var primaryEl = document.getElementById('notif-primary-email');
    var secondaryEl = document.getElementById('notif-secondary-email');
    var secondaryVal = secondaryEl ? secondaryEl.value.trim() : '';
    var eventReminderEl = document.getElementById('notif-event-reminder');
    var eventInviteEl = document.getElementById('notif-event-invite');
    var pushZeroEl = document.getElementById('push-zero');
    var pushLowEl = document.getElementById('push-low');
    var pushEventReminderEl = document.getElementById('push-event-reminder');
    var pushEventInviteEl = document.getElementById('push-event-invite');
    // Validate secondary email if provided
    if (secondaryVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(secondaryVal)) {
      showToast('Ugyldig e-mailadresse', 'error');
      return;
    }
    // save-parent-notification kræver en gyldig 'email' (NOT NULL i parent_notifications).
    // Brug forælderens login-e-mail; levering sker til alle linkede forældre-emails.
    var parentEmail = '';
    try { parentEmail = window.portalSupabase?.auth?.session?.()?.data?.session?.user?.email || ''; } catch (_e) { /* ignore */ }
    if (!parentEmail) { try { var _sd = JSON.parse(localStorage.getItem('flango-parent-auth') || '{}'); parentEmail = _sd?.user?.email || _sd?.currentSession?.user?.email || ''; } catch (_e2) { /* ignore */ } }
    if (!parentEmail && childData?.notification_settings?.email) parentEmail = childData.notification_settings.email;
    if (!parentEmail) { showToast('Kunne ikke finde din e-mail', 'error'); return; }
    try {
      await API.saveNotification(selectedChild.child_id, {
        email: parentEmail,
        notify_at_zero: zeroEl ? zeroEl.checked : true,
        notify_at_ten: lowEl ? lowEl.checked : true,
        notify_primary_email: primaryEl ? primaryEl.checked : true,
        secondary_email: secondaryVal || null,
        notify_event_reminder: eventReminderEl ? eventReminderEl.checked : false,
        notify_event_invite: eventInviteEl ? eventInviteEl.checked : false,
        push_at_zero: pushZeroEl ? pushZeroEl.checked : true,
        push_at_ten: pushLowEl ? pushLowEl.checked : true,
        push_event_reminder: pushEventReminderEl ? pushEventReminderEl.checked : false,
        push_event_invite: pushEventInviteEl ? pushEventInviteEl.checked : false,
      });
      // Update local cache so re-renders reflect the change
      if (childData && childData.notification_settings) {
        childData.notification_settings.notify_at_zero = zeroEl ? zeroEl.checked : true;
        childData.notification_settings.notify_at_ten = lowEl ? lowEl.checked : true;
        childData.notification_settings.notify_primary_email = primaryEl ? primaryEl.checked : true;
        childData.notification_settings.push_at_zero = pushZeroEl ? pushZeroEl.checked : true;
        childData.notification_settings.push_at_ten = pushLowEl ? pushLowEl.checked : true;
        childData.notification_settings.push_event_reminder = pushEventReminderEl ? pushEventReminderEl.checked : false;
        childData.notification_settings.push_event_invite = pushEventInviteEl ? pushEventInviteEl.checked : false;
        childData.notification_settings.secondary_email = secondaryVal || null;
        childData.notification_settings.notify_event_reminder = eventReminderEl ? eventReminderEl.checked : false;
        childData.notification_settings.notify_event_invite = eventInviteEl ? eventInviteEl.checked : false;
      }
      showToast('Notifikationer gemt', 'success');
    } catch (err) {
      console.error('[Portal] Save notifications error:', err);
      showToast('Kunne ikke gemme', 'error');
    }
  }

  // ─── Event handlers ───

  async function handleEventRegister(eventId, price) {
    if (!selectedChild) return;
    if (price > 0) {
      showEventPaymentOverlay(eventId, price, false);
      return;
    }
    // Free event — register directly
    try {
      showToast('Tilmelder...', '');
      await API.registerForEvent(selectedChild.child_id, eventId);
      showToast('Tilmeldt!', 'success');
      await reloadEvents();
    } catch (err) {
      console.error('[Portal] Event register error:', err);
      showToast('Kunne ikke tilmelde', 'error');
    }
  }

  async function handleEventCancel(eventId) {
    if (!selectedChild) return;
    if (!confirm('Er du sikker på, at du vil framelde?')) return;
    try {
      showToast('Framelder...', '');
      await API.cancelEvent(selectedChild.child_id, eventId);
      showToast('Frameldt', 'success');
      await reloadEvents();
      // Reload balance in case of refund
      try {
        const viewData = await API.getParentView(selectedChild.child_id);
        if (viewData) childData = viewData;
        const balEl = document.querySelector('.balance-amount');
        if (balEl && childData?.balance != null) balEl.textContent = formatKr(childData.balance) + ' kr';
      } catch (_) {}
    } catch (err) {
      console.error('[Portal] Event cancel error:', err);
      showToast('Kunne ikke framelde', 'error');
    }
  }

  async function handleEventPay(eventId, price) {
    showEventPaymentOverlay(eventId, price, true);
  }

  function showEventPaymentOverlay(eventId, price, isPayingExisting) {
    const balance = childData?.balance || 0;
    const canPayBalance = balance >= price;
    const childName = getChildName();
    const overlay = document.createElement('div');
    overlay.className = 'event-payment-overlay';
    overlay.innerHTML = `
      <div class="event-payment-modal">
        <h3>${isPayingExisting ? 'Betal tilmelding' : 'Tilmeld & betal'} — ${formatKr(price)} kr</h3>
        <button class="pay-option" data-method="balance" ${!canPayBalance ? 'disabled style="opacity:.4;cursor:not-allowed"' : ''}>
          <span class="pay-icon">💰</span>
          <span>Betal med ${esc(childName)}s saldo${canPayBalance ? ' (' + formatKr(balance) + ' kr)' : ' (ikke nok)'}</span>
        </button>
        <button class="pay-option" data-method="later" ${isPayingExisting ? 'style="display:none"' : ''}>
          <span class="pay-icon">⏳</span>
          <span>Betal senere</span>
        </button>
        <button class="pay-cancel">Annuller</button>
      </div>`;

    overlay.querySelector('.pay-cancel').addEventListener('click', function () { overlay.remove(); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });

    overlay.querySelectorAll('.pay-option').forEach(function (opt) {
      opt.addEventListener('click', async function () {
        if (opt.disabled) return;
        const method = opt.dataset.method;
        overlay.remove();
        try {
          showToast(method === 'later' ? 'Tilmelder...' : 'Tilmelder og betaler...', '');
          if (isPayingExisting) {
            // Pay existing registration with balance
            await API.registerForEvent(selectedChild.child_id, eventId, true, 'balance');
          } else if (method === 'balance') {
            await API.registerForEvent(selectedChild.child_id, eventId, true, 'balance');
          } else {
            // Pay later
            await API.registerForEvent(selectedChild.child_id, eventId, false);
          }
          showToast(method === 'later' ? 'Tilmeldt! (betaling afventer)' : 'Tilmeldt & betalt!', 'success');
          await reloadEvents();
          // Reload balance
          try {
            const viewData = await API.getParentView(selectedChild.child_id);
            if (viewData) childData = viewData;
            const balEl = document.querySelector('.balance-amount');
            if (balEl && childData?.balance != null) balEl.textContent = formatKr(childData.balance) + ' kr';
          } catch (_) {}
        } catch (err) {
          console.error('[Portal] Event pay error:', err);
          showToast('Betaling fejlede: ' + (err.message || 'Ukendt fejl'), 'error');
        }
      });
    });

    document.body.appendChild(overlay);
  }

  async function reloadEvents() {
    if (!selectedChild) return;
    try {
      eventsData = await API.getParentEvents(selectedChild.child_id);
      // Re-render events section in-place
      const evSection = document.getElementById('section-events');
      if (evSection) {
        const wasOpen = evSection.classList.contains('open');
        const temp = document.createElement('div');
        temp.innerHTML = renderEventsSection();
        const newSection = temp.firstElementChild;
        if (wasOpen) newSection.classList.add('open');
        evSection.replaceWith(newSection);
      }
    } catch (err) {
      console.error('[Portal] Reload events error:', err);
    }
  }

  // ── Inline-betaling: ren metode-liste under beløbet (MobilePay + Apple/Google Pay + kort) ──
  // Wallets renderes via clientSecret (pålideligt — ikke deferred) som rigtige knapper.

  function getSelectedTopupAmount() {
    const sel = document.querySelector('.topup-option.selected');
    if (!sel) return null;
    const a = sel.dataset.amount;
    if (a === 'custom') {
      const n = Number(topupCustomAmount);
      return (isFinite(n) && n > 0 && n <= 2000) ? n : null;
    }
    if (!a) return null;
    const n = Number(a);
    return (isFinite(n) && n > 0) ? n : null;
  }

  // Krediter barnet + opdater saldo-UI (delt af wallet, MobilePay-retur og kort-modal).
  async function finalizeStripeTopup(childId, paymentIntentId) {
    try {
      const res = await API.confirmTopup(childId, paymentIntentId);
      if (res && res.new_balance != null) {
        if (childData) childData.balance = res.new_balance;
        const balEl = document.querySelector('.balance-amount');
        if (balEl) balEl.textContent = formatKr(res.new_balance) + ' kr';
      }
    } catch (_) {}
    showToast('Betaling gennemført!', 'success');
    try {
      const viewData = await API.getParentView(childId);
      if (viewData) {
        childData = viewData;
        const balEl = document.querySelector('.balance-amount');
        if (balEl && childData.balance != null) balEl.textContent = formatKr(childData.balance) + ' kr';
      }
    } catch (_) {}
  }

  function updateTopupAmount() { /* no-op: beløbet sendes til Checkout ved klik */ }

  // ── Demo: simuleret MobilePay-optankning ──
  // Ingen rigtig betaling (serveren 403'er is_demo). Efterligner MobilePay-godkendelsen
  // og krediterer barnets saldo LOKALT i sessionen, så det føles som en rigtig optankning.
  // Nulstilles ved genindlæsning (demo-session overlever ikke).
  async function handleDemoTopup() {
    if (!selectedChild) return;
    const amount = getSelectedTopupAmount();
    if (!amount) { showToast('Vælg et beløb', 'error'); return; }
    const approved = await showDemoMobilePayModal(amount, getChildName());
    if (!approved) return;
    demoCreditBalance(amount);
    showToast(`${formatKr(amount)} kr tilføjet ${getChildName()}s saldo`, 'success');
  }

  function demoCreditBalance(amount) {
    const cid = selectedChild?.child_id;
    if (!cid) return;
    const newBal = Number(selectedChild.balance ?? childData?.balance ?? 0) + amount;
    selectedChild.balance = newBal;
    const ce = (children || []).find(c => c.child_id === cid);
    if (ce) ce.balance = newBal;
    if (childData && childData.child_id === cid) childData.balance = newBal;
    const balEl = document.querySelector('.balance-amount');
    if (balEl) balEl.textContent = formatKr(newBal) + ' kr';
    try { renderSidebarChildren(); } catch { /* desktop-sidebar */ }
    try {
      const csel = document.querySelector('.child-selector');
      if (csel) { const t = document.createElement('div'); t.innerHTML = renderChildSelector(); if (t.firstElementChild) csel.replaceWith(t.firstElementChild); }
    } catch { /* ingen chip-vælger */ }
  }

  function showDemoMobilePayModal(amount, childName) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'demo-mp-overlay';
      overlay.innerHTML = `
        <div class="demo-mp-card" role="dialog" aria-modal="true">
          <div class="demo-mp-head"><span class="demo-mp-logo">MobilePay</span><span class="demo-mp-demo-tag">DEMO</span></div>
          <div class="demo-mp-body" id="demo-mp-body">
            <div class="demo-mp-amount">${formatKr(amount)} kr</div>
            <div class="demo-mp-to">til <strong>Flango Demo</strong></div>
            <div class="demo-mp-sub">Optankning af ${esc(childName)}s madkonto</div>
            <button class="demo-mp-approve" id="demo-mp-approve">Godkend betaling</button>
            <button class="demo-mp-cancel" id="demo-mp-cancel">Annullér</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      const done = (val) => { overlay.remove(); resolve(val); };
      overlay.querySelector('#demo-mp-cancel').onclick = () => done(false);
      overlay.addEventListener('click', e => { if (e.target === overlay) done(false); });
      overlay.querySelector('#demo-mp-approve').onclick = () => {
        const body = overlay.querySelector('#demo-mp-body');
        body.innerHTML = `<div class="demo-mp-spinner"></div><div class="demo-mp-sub" style="margin-top:14px">Godkender i MobilePay…</div>`;
        setTimeout(() => {
          body.innerHTML = `<div class="demo-mp-check">✓</div><div class="demo-mp-amount" style="font-size:22px;margin-top:8px">Betaling gennemført</div><div class="demo-mp-sub">${formatKr(amount)} kr er tilføjet ${esc(childName)}s saldo</div>`;
          setTimeout(() => done(true), 1400);
        }, 1100);
      };
    });
  }

  // Stripe Checkout: opret session for det valgte beløb → redirect til Stripes
  // hostede betalingsside (alle metoder renderes af Stripe — nul rendering-risiko).
  async function handleCheckout() {
    const amt = getSelectedTopupAmount();
    if (!amt) { showToast('Vælg et beløb', 'error'); return; }
    const btn = document.getElementById('pay-checkout');
    const orig = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Åbner betaling...'; }
    try {
      try { sessionStorage.setItem('stripe_topup_pending', JSON.stringify({ child_id: selectedChild.child_id })); } catch (_) {}
      const res = await API.createTopup(selectedChild.child_id, amt, {
        checkout: true,
        returnUrl: window.flangoReturnBase(),
      });
      if (res && res.checkout_url) { window.location.href = res.checkout_url; return; }
      showToast('Betaling kunne ikke startes', 'error');
    } catch (err) {
      showToast(err.message || 'Betaling fejlede', 'error');
    }
    if (btn) { btn.disabled = false; btn.textContent = orig; }
  }

  // Retur fra Stripe Checkout: krediter via session_id (idempotent; webhook er backup).
  // Vælger det optankede barn igen så krediteringen vises på rette saldokort.
  async function handleCheckoutReturn(sessionId) {
    let pending = null;
    try { pending = JSON.parse(sessionStorage.getItem('stripe_topup_pending') || 'null'); } catch (_) {}
    try { sessionStorage.removeItem('stripe_topup_pending'); } catch (_) {}
    const childId = (pending && pending.child_id) || (selectedChild && selectedChild.child_id) || null;
    if (!childId) return;
    try {
      if (Array.isArray(children) && (!selectedChild || selectedChild.child_id !== childId)) {
        const target = children.find(c => c.child_id === childId);
        if (target) { selectedChild = target; await loadChildData(); renderApp(); }
      }
    } catch (_) {}
    try {
      const res = await API.confirmTopup(childId, null, sessionId);
      if (res && res.new_balance != null) {
        if (childData) childData.balance = res.new_balance;
        const balEl = document.querySelector('.balance-amount');
        if (balEl) balEl.textContent = formatKr(res.new_balance) + ' kr';
      }
      showToast('Betaling gennemført!', 'success');
    } catch (_) {
      showToast('Betaling behandles...', '');
    }
  }

  async function handleStripeTopup() {
    if (!selectedChild) return;
    const selected = document.querySelector('.topup-option.selected');
    if (!selected) { showToast('Vælg et beløb', 'error'); return; }
    const amount = selected.dataset.amount;
    if (!amount || amount === 'custom') { showToast('Vælg et beløb', 'error'); return; }
    const amountDkk = Number(amount);

    try {
      showToast('Opretter betaling...', '');
      const result = await API.createTopup(selectedChild.child_id, amountDkk, { excludeMobilepay: true });

      if (!result?.clientSecret) {
        showToast('Betaling kunne ikke oprettes', 'error');
        return;
      }

      // Load Stripe.js if not already loaded
      if (!window.Stripe) {
        await new Promise(function (resolve, reject) {
          const s = document.createElement('script');
          s.src = 'https://js.stripe.com/v3/';
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }

      const stripeKey = result.stripe_publishable_key;
      if (!stripeKey) {
        showToast('Stripe er ikke konfigureret', 'error');
        return;
      }

      const stripe = window.Stripe(stripeKey, result.stripe_account_id ? { stripeAccount: result.stripe_account_id } : undefined);
      const appearance = {
        theme: 'stripe',
        variables: {
          colorPrimary: '#F5960A',
          borderRadius: '12px',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
          fontSizeBase: '15px',
        },
      };
      const elements = stripe.elements({ clientSecret: result.clientSecret, appearance });
      const paymentElement = elements.create('payment', { wallets: { applePay: 'never', googlePay: 'never' } });

      // Show payment overlay
      const overlay = document.createElement('div');
      overlay.className = 'event-payment-overlay';
      overlay.innerHTML = `
        <div class="event-payment-modal" style="max-width:440px">
          <h3>Betal ${formatKr(amountDkk)} kr med kort</h3>
          <div id="topup-payment-element" style="min-height:200px;margin-bottom:var(--s3)"></div>
          <div id="topup-error" style="color:var(--negative);font-size:13px;margin-bottom:var(--s2);display:none"></div>
          <button class="save-btn full" id="topup-confirm-btn" style="margin-bottom:var(--s2)">Betal ${formatKr(amountDkk)} kr</button>
          <button class="pay-cancel" id="topup-cancel-btn">Annuller</button>
        </div>`;

      document.body.appendChild(overlay);

      const errorEl = overlay.querySelector('#topup-error');
      const confirmBtn = overlay.querySelector('#topup-confirm-btn');
      const resetConfirmBtn = function () {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Betal ' + formatKr(amountDkk) + ' kr';
      };

      // Krediter barnet + opdater UI når en PaymentIntent er gennemført.
      async function finalizeTopup(paymentIntent) {
        try {
          const confirmResult = await API.confirmTopup(selectedChild.child_id, paymentIntent.id);
          if (confirmResult && confirmResult.new_balance != null) {
            if (childData) childData.balance = confirmResult.new_balance;
            const balEl = document.querySelector('.balance-amount');
            if (balEl) balEl.textContent = formatKr(confirmResult.new_balance) + ' kr';
          }
        } catch (_) {}
        overlay.remove();
        showToast('Betaling gennemført!', 'success');
        try {
          const viewData = await API.getParentView(selectedChild.child_id);
          if (viewData) {
            childData = viewData;
            const balEl = document.querySelector('.balance-amount');
            if (balEl && childData.balance != null) balEl.textContent = formatKr(childData.balance) + ' kr';
          }
        } catch (_) {}
      }

      // Fælles bekræftelse for både wallet (Apple/Google Pay) og kort/MobilePay.
      async function doConfirm() {
        errorEl.style.display = 'none';
        try { sessionStorage.setItem('stripe_topup_pending', JSON.stringify({ child_id: selectedChild.child_id })); } catch (_) {}
        const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
          elements: elements,
          confirmParams: { return_url: window.flangoReturnBase() },
          redirect: 'if_required',
        });
        if (stripeError) {
          errorEl.textContent = stripeError.message || 'Betaling fejlede';
          errorEl.style.display = 'block';
          return false;
        }
        if (paymentIntent && paymentIntent.status === 'succeeded') {
          await finalizeTopup(paymentIntent);
          return true;
        }
        // Redirect-metoder (fx MobilePay) finaliseres ved retur via handleStripeReturn.
        return true;
      }

      paymentElement.mount('#topup-payment-element');

      overlay.querySelector('#topup-cancel-btn').addEventListener('click', function () { overlay.remove(); });
      overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });

      confirmBtn.addEventListener('click', async function () {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Behandler...';
        try {
          const ok = await doConfirm();
          if (!ok) resetConfirmBtn();
        } catch (err) {
          errorEl.textContent = 'Betaling fejlede: ' + (err.message || 'Ukendt fejl');
          errorEl.style.display = 'block';
          resetConfirmBtn();
        }
      });

    } catch (err) {
      console.error('[Portal] Stripe topup error:', err);
      showToast('Betaling fejlede: ' + (err.message || 'Ukendt fejl'), 'error');
    }
  }

  // Retur fra Stripe redirect-metoder (fx MobilePay). Kreditering er server-autoritativ
  // (Stripe-webhook); denne finaliserer best-effort via confirm-topup (idempotent).
  async function handleStripeReturn(paymentIntentId, redirectStatus) {
    let pending = null;
    try { pending = JSON.parse(sessionStorage.getItem('stripe_topup_pending') || 'null'); } catch (_) {}
    try { sessionStorage.removeItem('stripe_topup_pending'); } catch (_) {}
    const childId = (pending && pending.child_id) || (selectedChild && selectedChild.child_id) || null;
    if (!childId) return;
    if (redirectStatus === 'failed') { showToast('Betaling blev ikke gennemført.', 'error'); return; }
    // Vis det barn der faktisk blev optanket (ikke default-valgte children[0]),
    // så krediteringen ikke fejlagtigt ser ud til at ramme et andet barn ved retur.
    try {
      if (Array.isArray(children) && (!selectedChild || selectedChild.child_id !== childId)) {
        const target = children.find(c => c.child_id === childId);
        if (target) { selectedChild = target; await loadChildData(); renderApp(); }
      }
    } catch (_) {}
    try {
      const res = await API.confirmTopup(childId, paymentIntentId);
      if (res && res.new_balance != null) {
        if (childData) childData.balance = res.new_balance;
        const balEl = document.querySelector('.balance-amount');
        if (balEl) balEl.textContent = formatKr(res.new_balance) + ' kr';
      }
      showToast('Betaling gennemført!', 'success');
    } catch (_) {
      // Kan stadig være 'processing' — webhook krediterer når betalingen lander.
      showToast('Betaling behandles...', '');
    }
  }

  async function handleMobilePayTopup() {
    if (!selectedChild) return;
    const selected = document.querySelector('.topup-option.selected');
    if (!selected) { showToast('Vælg et beløb', 'error'); return; }
    const amount = selected.dataset.amount;
    if (!amount || amount === 'custom') { showToast('Vælg et beløb', 'error'); return; }
    const amountDkk = Number(amount);

    try {
      showToast('Åbner MobilePay...', '');
      const result = await API.createMobilePayTopup(selectedChild.child_id, amountDkk);
      if (!result || !result.redirectUrl) {
        showToast('MobilePay kunne ikke startes', 'error');
        return;
      }
      // Gem pending-betaling så retur-siden kan polle status (webhook+poll krediterer server-side).
      try {
        sessionStorage.setItem('vipps_pending', JSON.stringify({
          reference: result.reference, child_id: selectedChild.child_id, amount: amountDkk,
        }));
      } catch (_) {}
      window.location.href = result.redirectUrl;
    } catch (err) {
      console.error('[Portal] MobilePay topup error:', err);
      showToast(err.message || 'MobilePay fejlede', 'error');
    }
  }

  // Retur fra MobilePay: poll status og vis resultat. Kreditering sker server-side
  // (webhook + poll); denne funktion krediterer ALDRIG selv — den slår blot status op.
  async function handleVippsReturn(reference) {
    let stored = null;
    try { stored = JSON.parse(sessionStorage.getItem('vipps_pending') || 'null'); } catch (_) {}
    const childId = (stored && stored.reference === reference)
      ? stored.child_id
      : (selectedChild && selectedChild.child_id);
    if (!childId) return;

    showToast('Bekræfter MobilePay-betaling...', '');
    for (let i = 0; i < 20; i++) {
      let st = null;
      try { st = await API.getVippsStatus(childId, reference); } catch (_) {}
      if (st && st.credited) {
        try { sessionStorage.removeItem('vipps_pending'); } catch (_) {}
        showToast('Betaling gennemført!', 'success');
        try {
          const viewData = await API.getParentView(childId);
          if (viewData) {
            childData = viewData;
            const balEl = document.querySelector('.balance-amount');
            if (balEl && childData.balance != null) balEl.textContent = formatKr(childData.balance) + ' kr';
          }
        } catch (_) {}
        return;
      }
      if (st && (st.state === 'ABORTED' || st.state === 'EXPIRED' || st.state === 'TERMINATED')) {
        try { sessionStorage.removeItem('vipps_pending'); } catch (_) {}
        showToast('Betaling blev ikke gennemført', 'error');
        return;
      }
      await new Promise(r => setTimeout(r, 3000));
    }
    showToast('Betalingen behandles — saldoen opdateres om lidt', '');
  }

  async function handlePinChange() {
    if (demoBlocked()) return;
    const pw = document.getElementById('pin-new').value;
    const pw2 = document.getElementById('pin-confirm').value;
    if (pw.length < 6) { showToast('Mindst 6 tegn', 'error'); return; }
    if (pw !== pw2) { showToast('Adgangskoderne matcher ikke', 'error'); return; }
    try {
      await API.updatePassword(pw);
      showToast('Adgangskode opdateret', 'success');
      document.getElementById('pin-new').value = '';
      document.getElementById('pin-confirm').value = '';
    } catch (err) {
      console.error('[Portal] PIN change error:', err);
      showToast('Kunne ikke opdatere adgangskode', 'error');
    }
  }

  async function handleInviteParent() {
    if (demoBlocked()) return;
    const btn = document.getElementById('invite-parent-btn');
    const resultDiv = document.getElementById('invite-parent-result');
    const codeEl = document.getElementById('invite-parent-code');
    const expiryEl = document.getElementById('invite-parent-expiry');

    if (!btn || !selectedChild) return;
    const institutionId = selectedChild.institution_id;
    if (!institutionId) { showToast('Ingen institution fundet', 'error'); return; }

    btn.disabled = true;
    btn.textContent = 'Genererer...';

    try {
      const result = await API.createParentInvite(institutionId);
      if (!result?.success) {
        showToast(result?.error || 'Kunne ikke generere kode', 'error');
        return;
      }

      if (codeEl) codeEl.textContent = result.invite_code;
      if (expiryEl) {
        const expDate = new Date(result.expires_at);
        const daysLeft = Math.ceil((expDate - new Date()) / 86400000);
        expiryEl.textContent = result.existing
          ? 'Eksisterende kode \u2014 udl\u00f8ber om ' + daysLeft + ' dage'
          : 'Udl\u00f8ber om 7 dage';
      }
      if (resultDiv) resultDiv.style.display = '';
      btn.textContent = 'Generer ny kode';
    } catch (err) {
      console.error('[Portal] Invite error:', err);
      showToast('Kunne ikke generere invitationskode', 'error');
    } finally {
      btn.disabled = false;
      if (btn.textContent === 'Genererer...') btn.textContent = 'Generer invitationskode';
    }
  }

  async function handleLinkChild() {
    const codeEl = document.getElementById('link-code');
    const errorEl = document.getElementById('link-error');
    const code = (codeEl.value || '').trim().toUpperCase();

    // institution_id er ikke nødvendig — link_child_by_portal_code og redeem_parent_invite
    // slår op via koden selv (globalt unik), institution udledes automatisk.
    if (!code || code.length < 8) {
      errorEl.textContent = 'Indtast den 8-cifrede kode';
      errorEl.classList.add('visible');
      return;
    }
    errorEl.classList.remove('visible');

    // Vis vilkårsaccept FØR linking
    const accepted = await showTermsAcceptForLinking('dit barn');
    if (!accepted) return;

    try {
      // Prøv først som portalkode (8-tegns alfanumerisk aktiveringskode fra admin)
      const portalResult = await API.linkChildByPortalCode(code);
      if (portalResult?.success) {
        // Acceptér vilkår for det nyligt tilknyttede barn
        try {
          const refreshed = await API.getChildren();
          const newChild = refreshed.find(c => !c.terms_accepted_at);
          if (newChild) await API.acceptTerms(newChild.child_id, CURRENT_TERMS_VERSION);
        } catch (_e) { /* non-critical */ }
        showToast('Barn tilknyttet!', 'success');
        document.getElementById('add-child-modal').classList.remove('visible');
        await loadChildren();
        return;
      }

      // Specifik fejl fra portalkode
      if (portalResult?.error === 'CODE_EXPIRED') {
        errorEl.textContent = 'Denne kode er udløbet. Kontakt personalet for en ny kode.';
        errorEl.classList.add('visible');
        return;
      }

      // Hvis portalkoden ikke matcher, prøv som invitationskode (fra anden forælder)
      const inviteResult = await API.redeemParentInvite(code);
      if (inviteResult?.valid) {
        // Acceptér vilkår for alle nyligt tilknyttede børn
        try {
          const refreshed = await API.getChildren();
          for (const c of refreshed.filter(ch => !ch.terms_accepted_at)) {
            await API.acceptTerms(c.child_id, CURRENT_TERMS_VERSION);
          }
        } catch (_e) { /* non-critical */ }
        const count = inviteResult.count || 0;
        showToast(count + ' børn tilknyttet!', 'success');
        document.getElementById('add-child-modal').classList.remove('visible');
        await loadChildren();
        return;
      }

      // Specifik fejl fra invite
      if (inviteResult?.error === 'INVITE_EXPIRED') {
        errorEl.textContent = 'Denne kode er udløbet. Bed den anden forælder om en ny.';
      } else {
        errorEl.textContent = 'Koden er ugyldig eller allerede brugt';
      }
      errorEl.classList.add('visible');
    } catch (err) {
      console.error('[Portal] Link child failed:', err);
      errorEl.textContent = 'Koden er ugyldig eller allerede brugt';
      errorEl.classList.add('visible');
    }
  }

  async function handleLogout() {
    stopInactivityTimeout();
    try {
      await API.signOut();
      currentSession = null;
      children = [];
      selectedChild = null;
      renderLogin();
    } catch (err) {
      console.error('[Portal] Logout error:', err);
      showToast('Kunne ikke logge ud', 'error');
    }
  }

  // ─── Clean product name (strip ::icon:: markup) ───
  function cleanProductName(name) {
    if (!name) return 'Ukendt';
    if (name.startsWith('::icon::')) return 'Custom produkt';
    return name;
  }

  /** Resolve emoji field → HTML. Handles signed URLs, ::icon:: paths, regular emoji, icon_url, or fallback. */
  function productEmojiHTML(p, size) {
    size = size || 20;
    const imgStyle = `width:${size}px;height:${size}px;object-fit:contain;border-radius:4px`;
    // Priority 1: Pre-signed URL from Edge Function (private bucket)
    if (p.icon_signed_url) {
      return `<img src="${esc(p.icon_signed_url)}" alt="" style="${imgStyle}">`;
    }
    const emoji = p.emoji;
    // Priority 2: ::icon:: prefix
    if (emoji && emoji.startsWith('::icon::')) {
      // Check for pre-signed emoji URL from Edge Function
      if (p.emoji_signed_url) {
        return `<img src="${esc(p.emoji_signed_url)}" alt="" style="${imgStyle}">`;
      }
      const path = emoji.slice('::icon::'.length);
      if (path) {
        // Full URL (legacy) — use directly
        if (path.startsWith('http')) {
          return `<img src="${esc(path)}" alt="" style="${imgStyle}">`;
        }
        // Storage path — construct public bucket URL as fallback
        const bucketUrl = 'https://jbknjgbpghrbrstqwoxj.supabase.co/storage/v1/object/public/product-icons/';
        return `<img src="${esc(bucketUrl + path)}" alt="" style="${imgStyle}">`;
      }
    }
    // Regular emoji
    if (emoji && emoji.length > 0) {
      return `<span style="font-size:${size}px">${emoji}</span>`;
    }
    // Fallback to icon_url
    if (p.icon_url) {
      return `<img src="${esc(p.icon_url)}" alt="" style="${imgStyle}">`;
    }
    // Default
    return `<span style="font-size:${size}px">🍽️</span>`;
  }

  // ─── HTML escape helper ───
  function esc(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  // ═══════════════════════════════════════
  //  START
  // ═══════════════════════════════════════

  // Listen for auth state changes (login/logout from other tabs)
  window.portalSupabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      currentSession = null;
      renderLogin();
    }
  });

  // Go!
  init();

})();
