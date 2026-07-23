/* Flango Forældreportal — installér-hjælpekort (PWA).
 *
 * Viser et lille, afviseligt kort der hjælper forælderen med at lægge portalen
 * på hjemmeskærmen:
 *   • Android/Chrome: fanger `beforeinstallprompt` og viser en "Installér"-knap
 *     der udløser den native install-dialog.
 *   • iOS/Safari: ingen prompt findes — vis i stedet "Del → Føj til hjemmeskærm".
 *
 * Selvstændigt modul (rører ikke portal-v2.js). Vises ikke hvis appen allerede
 * er installeret (standalone) eller kortet er afvist. Venter til cookie-banneret
 * er væk, så de to ikke stables oven på hinanden.
 */
(function () {
  'use strict';

  // I den wrappede app (Capacitor) er "læg på hjemmeskærm" meningsløst — appen
  // ER installeret. UA-heuristikken nedenfor må ikke være det eneste værn.
  if (location.protocol === 'capacitor:' ||
      !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' &&
         window.Capacitor.isNativePlatform())) return;

  var DISMISS_KEY = 'flango_pwa_install_dismissed';

  // App-synlighed: URL'erne er de endelige (ASC-id + bundle-id), men knapperne
  // renderes først når flagene flippes ved release — ingen døde links inden da.
  // Smart App Banner (index.html) er selv-gated hos Apple og kan ligge klar.
  var APP_STORE_LIVE = false;
  var APP_STORE_URL = 'https://apps.apple.com/dk/app/id6793543486';
  var PLAY_STORE_LIVE = false;
  var PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=dk.flango.foraeldre';

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  }

  if (isStandalone()) return;                       // allerede installeret
  try { if (localStorage.getItem(DISMISS_KEY)) return; } catch (e) {}

  var ua = navigator.userAgent || '';
  var isIOS = /iphone|ipad|ipod/i.test(ua) ||
              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isSafari = /safari/i.test(ua) && !/chrome|crios|fxios|edgios|android/i.test(ua);
  var isAndroid = /android/i.test(ua);
  var isDesktop = !isIOS && !isAndroid;

  var deferredPrompt = null;
  var shown = false;

  // Android/desktop Chrome: fang prompten og vis vores eget kort i stedet.
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    scheduleShow('android');
  });

  window.addEventListener('appinstalled', function () { dismiss(true); });

  // iOS/Safari har ingen beforeinstallprompt — vis App Store-knap (efter release)
  // eller Føj-til-hjemmeskærm-vejledningen. Android m. Play-appen ude: Play-knap.
  // Desktop: QR-kort når mindst én butik er live.
  var initialMode = null;
  if (isIOS && isSafari) initialMode = APP_STORE_LIVE ? 'appstore' : 'ios';
  else if (isAndroid && PLAY_STORE_LIVE) initialMode = 'play';
  else if (isDesktop && (APP_STORE_LIVE || PLAY_STORE_LIVE)) initialMode = 'desktop';
  if (initialMode) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { scheduleShow(initialMode); });
    } else {
      scheduleShow(initialMode);
    }
  }

  var showAttempts = 0;
  function scheduleShow(mode) {
    if (shown) return;
    // Vis først når forælderen er logget ind (#tab-home findes) OG cookie-banneret
    // er væk — så vi hverken dækker login-knappen eller stabler to bannere.
    var ready = document.getElementById('tab-home') && !document.getElementById('flango-cookie-banner');
    if (!ready) {
      if (++showAttempts > 240) return;        // giv op efter ~6 min uden login
      setTimeout(function () { scheduleShow(mode); }, 1500);
      return;
    }
    setTimeout(function () { render(mode); }, 1000);
  }

  function dismiss(silent) {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch (e) {}
    var el = document.getElementById('flango-pwa-install');
    if (el) {
      el.classList.remove('show');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    }
  }

  var SHARE_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v13"/>' +
    '<path d="M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/></svg>';

  function render(mode) {
    if (shown || isStandalone()) return;
    shown = true;
    injectStyles();

    var card = document.createElement('div');
    card.id = 'flango-pwa-install';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Installér Flango');

    var storeBtns =
      (APP_STORE_LIVE ? '<a class="fpwa-btn fpwa-store" href="' + APP_STORE_URL + '" target="_blank" rel="noopener"> Hent i App Store</a>' : '') +
      (PLAY_STORE_LIVE ? '<a class="fpwa-btn fpwa-store fpwa-play" href="' + PLAY_STORE_URL + '" target="_blank" rel="noopener">▶ Hent i Google Play</a>' : '');
    var action;
    if (mode === 'ios') {
      action = '<p class="fpwa-ios">Tryk på <span class="fpwa-share">' + SHARE_SVG + '</span> ' +
        'og vælg <strong>“Føj til hjemmeskærm”</strong>.</p>';
    } else if (mode === 'appstore' || mode === 'play') {
      action = '<div class="fpwa-actions">' + storeBtns + '</div>';
    } else if (mode === 'desktop') {
      action = '<div class="fpwa-actions">' + storeBtns + '</div>';
    } else {
      action = '<button type="button" id="fpwa-install-btn" class="fpwa-btn">Installér</button>';
    }
    var qr = mode === 'desktop'
      ? '<img class="fpwa-qr" src="assets/icons/portal-qr.png" alt="QR-kode til Flango Portal" width="110" height="110">'
      : '<img class="fpwa-icon" src="assets/icons/icon-192.png" alt="" width="44" height="44">';
    var title = mode === 'desktop' ? 'Flango Portal findes som app' : 'Installér Flango';
    var text = mode === 'desktop'
      ? 'Scan koden med din telefon — så åbner portalen som app.'
      : 'Læg portalen på hjemmeskærmen for hurtig adgang til saldo og grænser.';

    card.innerHTML =
      qr +
      '<div class="fpwa-body">' +
        '<div class="fpwa-title">' + title + '</div>' +
        '<div class="fpwa-text">' + text + '</div>' +
        action +
      '</div>' +
      '<button type="button" class="fpwa-close" aria-label="Luk">&times;</button>';

    document.body.appendChild(card);
    // setTimeout frem for requestAnimationFrame: rAF pauses i baggrundsfaner og
    // kan efterlade kortet usynligt; setTimeout udløser altid indtonings-klassen.
    setTimeout(function () { card.classList.add('show'); }, 30);

    card.querySelector('.fpwa-close').addEventListener('click', function () { dismiss(); });

    var installBtn = card.querySelector('#fpwa-install-btn');
    if (installBtn) {
      installBtn.addEventListener('click', function () {
        if (!deferredPrompt) { dismiss(); return; }
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function () {
          deferredPrompt = null;
          dismiss(true);
        });
      });
    }
  }

  function injectStyles() {
    if (document.getElementById('flango-pwa-style')) return;
    var s = document.createElement('style');
    s.id = 'flango-pwa-style';
    s.textContent =
      '#flango-pwa-install{position:fixed;left:50%;' +
      'bottom:calc(var(--bottom-h,0px) + 16px + env(safe-area-inset-bottom,0px));' +
      'transform:translateX(-50%) translateY(16px);width:calc(100% - 24px);max-width:440px;' +
      'display:flex;align-items:flex-start;gap:12px;padding:14px 16px;' +
      'background:var(--surface-raised,#fff);border:1px solid var(--border,#e7e5e4);' +
      'border-radius:var(--r-lg,16px);box-shadow:var(--shadow-lg,0 8px 30px rgba(28,25,23,.16));' +
      'font-family:var(--font,system-ui,sans-serif);color:var(--ink,#1c1917);z-index:9000;' +
      'opacity:0;transition:opacity .25s ease,transform .25s ease}' +
      '#flango-pwa-install.show{opacity:1;transform:translateX(-50%) translateY(0)}' +
      '#flango-pwa-install .fpwa-icon{width:44px;height:44px;border-radius:10px;flex-shrink:0}' +
      '#flango-pwa-install .fpwa-body{flex:1;min-width:0;padding-right:14px}' +
      '#flango-pwa-install .fpwa-title{font-size:14px;font-weight:700;line-height:1.2}' +
      '#flango-pwa-install .fpwa-text{font-size:12px;color:var(--ink-soft,#57534e);margin-top:3px;line-height:1.35}' +
      '#flango-pwa-install .fpwa-btn{margin-top:10px;padding:8px 18px;border:none;' +
      'border-radius:var(--r-sm,8px);background:var(--flango,#f5960a);color:#fff;font-size:13px;' +
      'font-weight:700;cursor:pointer;font-family:inherit}' +
      '#flango-pwa-install .fpwa-btn:hover{background:var(--flango-dark,#c47200)}' +
      '#flango-pwa-install .fpwa-ios{font-size:12px;color:var(--ink-soft,#57534e);margin-top:8px;line-height:1.5}' +
      '#flango-pwa-install .fpwa-ios strong{color:var(--ink,#1c1917)}' +
      '#flango-pwa-install .fpwa-share{display:inline-flex;vertical-align:middle;color:var(--info,#2563eb)}' +
      '#flango-pwa-install .fpwa-share svg{width:15px;height:15px}' +
      '#flango-pwa-install .fpwa-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}' +
      '#flango-pwa-install .fpwa-store{display:inline-flex;align-items:center;gap:6px;background:#000;color:#fff;text-decoration:none;margin-top:0}' +
      '#flango-pwa-install .fpwa-store:hover{background:#1c1917}' +
      '#flango-pwa-install .fpwa-play{background:#0f9d58}' +
      '#flango-pwa-install .fpwa-play:hover{background:#0c7f47}' +
      '#flango-pwa-install .fpwa-qr{width:110px;height:110px;border-radius:8px;flex-shrink:0;border:1px solid var(--border,#e7e5e4)}' +
      '#flango-pwa-install .fpwa-close{position:absolute;top:6px;right:8px;background:none;border:none;' +
      'font-size:20px;line-height:1;color:var(--ink-muted,#a8a29e);cursor:pointer;padding:4px}';
    document.head.appendChild(s);
  }
})();
