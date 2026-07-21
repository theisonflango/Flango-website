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

  var deferredPrompt = null;
  var shown = false;

  // Android/desktop Chrome: fang prompten og vis vores eget kort i stedet.
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    scheduleShow('android');
  });

  window.addEventListener('appinstalled', function () { dismiss(true); });

  // iOS/Safari har ingen beforeinstallprompt — vis vejledning.
  if (isIOS && isSafari) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { scheduleShow('ios'); });
    } else {
      scheduleShow('ios');
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

    var action = mode === 'ios'
      ? '<p class="fpwa-ios">Tryk på <span class="fpwa-share">' + SHARE_SVG + '</span> ' +
        'og vælg <strong>“Føj til hjemmeskærm”</strong>.</p>'
      : '<button type="button" id="fpwa-install-btn" class="fpwa-btn">Installér</button>';

    card.innerHTML =
      '<img class="fpwa-icon" src="assets/icons/icon-192.png" alt="" width="44" height="44">' +
      '<div class="fpwa-body">' +
        '<div class="fpwa-title">Installér Flango</div>' +
        '<div class="fpwa-text">Læg portalen på hjemmeskærmen for hurtig adgang til saldo og grænser.</div>' +
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
      '#flango-pwa-install .fpwa-close{position:absolute;top:6px;right:8px;background:none;border:none;' +
      'font-size:20px;line-height:1;color:var(--ink-muted,#a8a29e);cursor:pointer;padding:4px}';
    document.head.appendChild(s);
  }
})();
