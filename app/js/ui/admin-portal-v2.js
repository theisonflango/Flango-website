/**
 * admin-portal-v2.js — skallen om café-admins forældre-flader
 *
 * Fladen har PRÆCIS to sider (docs/spec-foraeldreindsigt-2-0.md §3b + §3c):
 *
 *   👨‍👩‍👧 Forældre            — data og handling (admin-parent-page.js)
 *   ⚙️  Portal-indstillinger — preview af den rigtige portal (admin-portal-preview-host.js)
 *
 * Preview'et må ALDRIG renderes på data-siden. Det gjorde det før, fordi
 * preview-hosten injicerede `#pv2-page-portal { display:flex }` globalt:
 * en ID-selektor (1,0,0) slår `.portal-v2 .admin-page { display:none }` (0,2,0),
 * så indstillings-siden lå tændt bag alle andre faner. Side-synligheden ejes
 * nu ét sted — switchPage() + .admin-page.active herunder — og ingen anden fil
 * må sætte display på et side-element.
 *
 * Eksponerer window.openAdminPortalV2() / window.closeAdminPortalV2()
 */
(function () {
  'use strict';

  var PAGES = {
    PARENTS: 'page-parents',
    SETTINGS: 'page-portal',
  };

  var overlayEl = null;
  // Ingen side er aktiv før switchPage() har åbnet én. Den er den ENESTE vej til
  // at aktivere en side — også ved åbning. Havde åbningen sin egen genvej (fladen
  // startede med page-portal markeret aktiv i HTML'en), blev mountPreview()
  // sprunget over, og Portal-indstillinger stod tom indtil man klikkede væk og
  // tilbage igen.
  var currentPage = null;
  var institutionName = 'Institutionen';
  var institutionId = null;
  var institutionSettings = null;
  var featureFlags = null;

  function ensureGoogleFonts() {
    if (document.querySelector('link[href*="Plus+Jakarta+Sans"]')) return;
    var pre1 = document.createElement('link');
    pre1.rel = 'preconnect';
    pre1.href = 'https://fonts.googleapis.com';
    var pre2 = document.createElement('link');
    pre2.rel = 'preconnect';
    pre2.href = 'https://fonts.gstatic.com';
    pre2.crossOrigin = 'anonymous';
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(pre1);
    document.head.appendChild(pre2);
    document.head.appendChild(link);
  }

  function esc(s) {
    var el = document.createElement('span');
    el.textContent = s === null || s === undefined ? '' : String(s);
    return el.innerHTML;
  }

  function buildHTML() {
    return '' +
      '<div class="portal-v2" id="portal-v2-root">' +
        '<div class="admin-bar" id="pv2-admin-bar">' +
          '<div class="admin-bar-left">' +
            '<button class="admin-bar-back-btn" id="pv2-back-to-cafe" title="Tilbage til café-app">&#8592; Café-app</button>' +
            '<div class="admin-bar-label">Admin</div>' +
            '<div class="admin-bar-institution">' + esc(institutionName) + '</div>' +
          '</div>' +
          '<div class="admin-bar-center">' +
            '<button class="admin-page-tab" data-page="' + PAGES.PARENTS + '">&#128104;&#8205;&#128105;&#8205;&#128103; Forældre</button>' +
            '<button class="admin-page-tab" data-page="' + PAGES.SETTINGS + '">&#9881;&#65039; Portal-indstillinger</button>' +
          '</div>' +
          '<div class="admin-bar-right"></div>' +
        '</div>' +
        '<div class="admin-page" id="pv2-page-parents">' +
          '<div class="apx-root" id="pv2-parents-container"></div>' +
        '</div>' +
        '<div class="admin-page" id="pv2-page-portal">' +
          '<div id="pv2-settings-container"></div>' +
        '</div>' +
      '</div>';
  }

  async function switchPage(pageId) {
    if (!overlayEl || pageId === currentPage) return;

    // Ugemte portal-indstillinger må ikke forsvinde lydløst, når man klikker
    // over på Forældre-siden.
    if (currentPage === PAGES.SETTINGS &&
        typeof AdminPortalPreviewHost !== 'undefined' &&
        AdminPortalPreviewHost.isDirty && AdminPortalPreviewHost.isDirty()) {
      var proceed = window.__flangoShowCustomAlert
        ? await window.__flangoShowCustomAlert('Ugemte ændringer',
            'Du har ændringer i portal-indstillingerne, som ikke er gemt. Forlad siden alligevel?', 'confirm')
        : window.confirm('Du har ugemte ændringer i portal-indstillingerne. Forlad siden alligevel?');
      if (!proceed) return;
    }

    currentPage = pageId;
    overlayEl.querySelectorAll('.admin-page').forEach(function (p) {
      p.classList.toggle('active', p.id === 'pv2-' + pageId);
    });
    overlayEl.querySelectorAll('.admin-page-tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.page === pageId);
    });

    var active = overlayEl.querySelector('.admin-page.active');
    if (active) active.scrollTop = 0;

    if (pageId === PAGES.SETTINGS) mountPreview();
  }

  function mountPreview() {
    var container = overlayEl && overlayEl.querySelector('#pv2-settings-container');
    if (!container || container.dataset.mounted === '1') return;
    if (typeof AdminPortalPreviewHost === 'undefined') {
      container.innerHTML = '<div class="pv2-fallback">Preview-hosten er ikke indlæst ' +
        '(<code>admin-portal-preview-host.js</code>).</div>';
      return;
    }
    container.dataset.mounted = '1';
    AdminPortalPreviewHost.mount(container, {
      institutionSettings: institutionSettings,
      featureFlags: featureFlags,
    });
  }

  function handleKeyDown(e) {
    if (e.key !== 'Escape' || !overlayEl) return;
    // Modaler lukker sig selv (de stopper Escape) — når den når hertil er
    // der ingen modal, og så lukker hele fladen.
    if (document.querySelector('.apx-modal-overlay')) return;
    closePortal();
  }

  function closePortal() {
    if (!overlayEl) return;
    if (typeof AdminPortalPreviewHost !== 'undefined') AdminPortalPreviewHost.unmount();
    if (window.AdminParentPage) window.AdminParentPage.unmount();
    document.removeEventListener('keydown', handleKeyDown);
    overlayEl.remove();
    overlayEl = null;
    document.body.style.overflow = '';
    currentPage = null;
    institutionSettings = null;
    featureFlags = null;
  }

  async function openAdminPortalV2(options) {
    if (overlayEl) return;
    ensureGoogleFonts();

    try {
      if (typeof PortalData !== 'undefined') {
        var results = await Promise.all([
          PortalData.getInstitutionSettings(),
          typeof PortalData.getFeatureFlags === 'function' ? PortalData.getFeatureFlags() : Promise.resolve(null),
        ]);
        if (results[0]) {
          institutionSettings = results[0];
          if (results[0].name) institutionName = results[0].name;
          if (results[0].id) institutionId = results[0].id;
        }
        featureFlags = results[1] || null;
      }
    } catch (err) {
      console.warn('[admin-portal] Kunne ikke hente institutionsdata:', err);
    }

    overlayEl = document.createElement('div');
    overlayEl.id = 'admin-portal-v2-overlay';
    overlayEl.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;flex-direction:column;' +
      'background:var(--surface, #FAFAF9);overflow:hidden;';
    overlayEl.innerHTML = buildHTML();

    var rootEl = overlayEl.querySelector('#portal-v2-root');
    if (rootEl) rootEl.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0;overflow:hidden;';
    var barEl = overlayEl.querySelector('.admin-bar');
    if (barEl) barEl.style.cssText += ';flex-shrink:0;';

    document.body.appendChild(overlayEl);
    document.body.style.overflow = 'hidden';

    overlayEl.querySelectorAll('.admin-page-tab').forEach(function (tab) {
      tab.addEventListener('click', function () { switchPage(tab.dataset.page); });
    });
    overlayEl.querySelector('#pv2-back-to-cafe').addEventListener('click', closePortal);
    document.addEventListener('keydown', handleKeyDown);

    // Kaldere kan stadig bede om Forældre-siden eksplicit; ellers åbnes
    // Portal-indstillinger. Begge veje går gennem switchPage() — den ejer både
    // side-synligheden og monteringen af preview'et.
    switchPage((options && options.page === 'parents') ? PAGES.PARENTS : PAGES.SETTINGS);

    if (window.AdminParentPage) {
      window.AdminParentPage.mount(overlayEl.querySelector('#pv2-parents-container'), {
        institutionName: institutionName,
        institutionId: institutionId,
      });
    }
  }

  window.openAdminPortalV2 = openAdminPortalV2;
  window.closeAdminPortalV2 = closePortal;
})();
