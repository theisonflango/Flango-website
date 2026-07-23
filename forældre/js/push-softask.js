/* Flango Forældreportal — soft-ask for push-notifikationer (kun i appen).
 *
 * iOS viser kun tilladelses-prompten ÉN gang pr. installation, så den må ikke
 * brændes af kontekstløst ved appstart. Dette kort er det synlige tilvalg: først
 * når forælderen tapper "Slå notifikationer til", affyres den rigtige iOS-prompt
 * (via PortalAPI.enablePushOnThisDevice). På web/PWA er modulet inert.
 *
 * Selvstændigt modul (rører ikke portal-v2.js) — samme mønster som pwa-install.js:
 * venter på login + at cookie-banneret er væk, og kan afvises permanent.
 */
(function () {
  'use strict';

  var DISMISS_KEY = 'flango_push_softask_dismissed';
  var ENABLED_KEY = 'flango_push_enabled';

  function isNativeApp() {
    return location.protocol === 'capacitor:' ||
      !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  }
  if (!isNativeApp()) return;
  try {
    if (localStorage.getItem(DISMISS_KEY) || localStorage.getItem(ENABLED_KEY) === '1') return;
  } catch (e) { return; }

  var shown = false;
  var attempts = 0;

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch (e) { /* ignore */ }
    var el = document.getElementById('flango-push-softask');
    if (el) {
      el.classList.remove('show');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    }
  }

  function scheduleShow() {
    if (shown) return;
    var ready = document.getElementById('tab-home') && !document.getElementById('flango-cookie-banner');
    if (!ready) {
      if (++attempts > 240) return; // ~6 min uden login — giv op
      setTimeout(scheduleShow, 1500);
      return;
    }
    var p = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.PushNotifications;
    if (!p || !window.PortalAPI) return;
    // Er prompten allerede brændt (denied), kan den aldrig vises igen — så ville
    // kortet kun føre til en fejl. Vis det derfor kun ved 'prompt'/'granted'.
    p.checkPermissions().then(function (perm) {
      if (perm && perm.receive === 'denied') { dismiss(); return; }
      setTimeout(render, 1200);
    }).catch(function () { /* vis ikke ved tvivl */ });
  }

  function render() {
    if (shown) return;
    shown = true;
    injectStyles();

    var card = document.createElement('div');
    card.id = 'flango-push-softask';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Slå notifikationer til');
    card.innerHTML =
      '<div class="fpsa-icon">🔔</div>' +
      '<div class="fpsa-body">' +
        '<div class="fpsa-title">Få besked når det gælder</div>' +
        '<div class="fpsa-text">Vi siger til, når saldoen er ved at løbe tør, og minder dig om arrangementer.</div>' +
        '<div class="fpsa-actions">' +
          '<button type="button" id="fpsa-enable" class="fpsa-btn">Slå notifikationer til</button>' +
          '<button type="button" id="fpsa-later" class="fpsa-later">Ikke nu</button>' +
        '</div>' +
      '</div>' +
      '<button type="button" class="fpsa-close" aria-label="Luk">&times;</button>';

    document.body.appendChild(card);
    setTimeout(function () { card.classList.add('show'); }, 30);

    card.querySelector('.fpsa-close').addEventListener('click', dismiss);
    card.querySelector('#fpsa-later').addEventListener('click', dismiss);
    card.querySelector('#fpsa-enable').addEventListener('click', function () {
      var btn = this;
      btn.disabled = true;
      btn.textContent = 'Slår til…';
      window.PortalAPI.enablePushOnThisDevice().then(function () {
        btn.textContent = '✓ Slået til';
        // Notifikationssektionen er allerede renderet (bages ved app-start) — synk dens
        // master-toggle nu, så Profil-fanen ikke viser "fra" for en aktiv tilmelding.
        var deviceToggle = document.getElementById('notif-push-device');
        if (deviceToggle) deviceToggle.checked = true;
        setTimeout(dismiss, 900);
      }).catch(function (err) {
        var denied = err && err.code === 'denied';
        var text = card.querySelector('.fpsa-text');
        if (text) {
          text.textContent = denied
            ? 'Tilladelsen blev afvist. Du kan altid slå notifikationer til under Indstillinger → Flango Portal.'
            : 'Kunne ikke slå notifikationer til. Du kan prøve igen under Profil → E-mail notifikationer.';
        }
        btn.style.display = 'none';
        card.querySelector('#fpsa-later').textContent = 'Ok';
        // Uanset årsag: vis ikke kortet igen — togglen i notifikationssektionen består
      });
    });
  }

  function injectStyles() {
    if (document.getElementById('flango-push-softask-style')) return;
    var s = document.createElement('style');
    s.id = 'flango-push-softask-style';
    s.textContent =
      '#flango-push-softask{position:fixed;left:50%;' +
      'bottom:calc(var(--bottom-h,0px) + 16px + env(safe-area-inset-bottom,0px));' +
      'transform:translateX(-50%) translateY(16px);width:calc(100% - 24px);max-width:440px;' +
      'display:flex;align-items:flex-start;gap:12px;padding:14px 16px;' +
      'background:var(--surface-raised,#fff);border:1px solid var(--border,#e7e5e4);' +
      'border-radius:var(--r-lg,16px);box-shadow:var(--shadow-lg,0 8px 30px rgba(28,25,23,.16));' +
      'font-family:var(--font,system-ui,sans-serif);color:var(--ink,#1c1917);z-index:9000;' +
      'opacity:0;transition:opacity .25s ease,transform .25s ease}' +
      '#flango-push-softask.show{opacity:1;transform:translateX(-50%) translateY(0)}' +
      '#flango-push-softask .fpsa-icon{font-size:28px;line-height:1;flex-shrink:0;margin-top:2px}' +
      '#flango-push-softask .fpsa-body{flex:1;min-width:0;padding-right:14px}' +
      '#flango-push-softask .fpsa-title{font-size:14px;font-weight:700;line-height:1.2}' +
      '#flango-push-softask .fpsa-text{font-size:12px;color:var(--ink-soft,#57534e);margin-top:3px;line-height:1.35}' +
      '#flango-push-softask .fpsa-actions{display:flex;align-items:center;gap:14px;margin-top:10px}' +
      '#flango-push-softask .fpsa-btn{padding:8px 18px;border:none;' +
      'border-radius:var(--r-sm,8px);background:var(--flango,#f5960a);color:#fff;font-size:13px;' +
      'font-weight:700;cursor:pointer;font-family:inherit}' +
      '#flango-push-softask .fpsa-later{background:none;border:none;font-size:13px;font-weight:600;' +
      'color:var(--ink-muted,#a8a29e);cursor:pointer;font-family:inherit;padding:8px 4px}' +
      '#flango-push-softask .fpsa-close{position:absolute;top:6px;right:8px;background:none;border:none;' +
      'font-size:20px;line-height:1;color:var(--ink-muted,#a8a29e);cursor:pointer;padding:4px}';
    document.head.appendChild(s);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleShow);
  } else {
    scheduleShow();
  }
})();
