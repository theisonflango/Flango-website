/**
 * admin-parent-page.js — Forældre-siden i café-admin (Forældreindsigt 2.0)
 *
 * ÉN side med tre lag (docs/spec-foraeldreindsigt-2-0.md §3b):
 *   1. Adoptions-trin  — hvert trin er klikbart og filtrerer listen
 *   2. Kræver opmærksomhed — kort der ER navigationen ned i listen
 *   3. Handlingsliste  — søg/filtrér/sortér + kode-handlinger pr. række
 *
 * Ét princip bærer hele siden: ALLE tal kommer fra get_parent_admin_overview
 * og har SAMME nævner (børn i institutionen), som skrives ud ved hvert tal.
 * Siden regner ikke selv nøgletal ud — to kilder kunne blive uenige, og det
 * var præcis dét, der gav "3/178 forældre" ved siden af "0 af 3 forældre".
 *
 * Eksponerer window.AdminParentPage = { mount, unmount, refresh }
 */
(function () {
  'use strict';

  // ─── Fælles hjælpere ───────────────────────────────────────────

  function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmt(n) {
    if (n === null || n === undefined) return '—';
    return Number(n).toLocaleString('da-DK');
  }

  function pct(part, whole) {
    if (!whole) return 0;
    return Math.round((part / whole) * 100);
  }

  function toast(msg, isError) {
    var existing = document.querySelector('.apx-toast');
    if (existing) existing.remove();
    var el = document.createElement('div');
    el.className = 'apx-toast' + (isError ? ' error' : '');
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('visible'); });
    setTimeout(function () {
      el.classList.remove('visible');
      setTimeout(function () { el.remove(); }, 250);
    }, 2600);
  }

  function formatDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    var now = new Date();
    var days = Math.floor(
      (new Date(now.getFullYear(), now.getMonth(), now.getDate()) -
       new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000
    );
    var time = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    if (days === 0) return 'I dag ' + time;
    if (days === 1) return 'I går ' + time;
    if (days < 30) return days + ' dage siden';
    return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: '2-digit' });
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // WKWebView/Tauri kan nægte clipboard-API'et — fald tilbage til et
      // skjult textarea, så samlebåndet aldrig strander på desktop-appen.
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        ta.remove();
        return ok;
      } catch (e2) {
        return false;
      }
    }
  }

  // ─── Aula-besked ───────────────────────────────────────────────

  // Trinnene her SKAL matche det virkelige onboarding-flow (auth først, kode
  // bagefter). Den gamle default sagde "Vælg jeres klub/SFO i listen" — det
  // trin findes ikke længere, og en forælder der leder efter det, går i stå.
  var DEFAULT_TEMPLATE = [
    'Kære forældre',
    '',
    'Vi bruger Flango som cafésystem. I forældre-portalen kan I følge jeres barns',
    'saldo, sætte grænser og betale ind.',
    '',
    '• Barn: {{child_name}}',
    '• Kode: {{kode}}',
    '',
    'Sådan kommer I i gang:',
    '1. Gå til flango.dk/forældre — eller hent appen Flango Forældre',
    '2. Opret en konto (Google, Apple eller e-mail)',
    '3. Indtast koden ovenfor inde i portalen',
    '4. Sæt flueben ved eventuelle søskende',
    '',
    'Koden udløber om 7 dage — skriv til os hvis I skal bruge en ny (gerne som',
    'svar i denne tråd).',
    '',
    'Koden kan kun bruges én gang — din partner opretter sin egen konto, og du',
    'tilføjer dem inde fra portalen under Profil → Del adgang med en partner.',
    '',
    'Venlig hilsen',
    '{{institution}}',
  ].join('\n');

  function fillTemplate(template, childName, code, institutionName) {
    return String(template || '')
      .replace(/\{\{?\s*child_name\s*\}?\}/gi, childName)
      .replace(/\{\{?\s*barnets_navn\s*\}?\}/gi, childName)
      .replace(/\{\{?\s*(kode|pin)\s*\}?\}/gi, code || '')
      .replace(/\{\{?\s*institution\s*\}?\}/gi, institutionName || '');
  }

  // ─── Tilstand ──────────────────────────────────────────────────

  var rootEl = null;
  var ctx = { institutionName: '', institutionId: null };
  var data = null;              // { funnel, stats, adoption, children }
  var template = null;          // gemt Aula-skabelon (null = brug default)
  var filter = '';              // aktivt filter-flag
  var query = '';
  var sortKey = 'child';
  var sortAsc = true;
  var loading = false;

  // Filtrene ER kortene: samme nøgle, samme mængde, ét sted defineret.
  var FILTERS = [
    { key: 'nocode',      icon: '🔑', label: 'Mangler kode',        desc: 'har hverken kode eller forælder' },
    { key: 'codepending', icon: '⏳', label: 'Kode sendt, afventer', desc: 'har en gyldig kode der ikke er indløst' },
    { key: 'codeexpired', icon: '⌛', label: 'Kode udløbet',         desc: 'koden nåede at udløbe uindløst' },
    { key: 'noparent',    icon: '👤', label: 'Ingen forælder',       desc: 'ingen konto er tilknyttet barnet' },
    { key: 'never',       icon: '🚪', label: 'Aldrig været inde',    desc: 'ingen forælder har åbnet portalen' },
    { key: 'zero',        icon: '💸', label: '0 eller minus',        desc: 'saldoen er tom eller negativ' },
    { key: 'nolimit',     icon: '⚠️', label: 'Ingen grænser',        desc: 'hverken beløbs- eller produktgrænse' },
  ];

  var COLUMNS = [
    { key: 'child',      label: 'Barn' },
    { key: 'parentLabel', label: 'Forælder' },
    { key: 'codeState',  label: 'Portal-kode' },
    { key: 'saldo',      label: 'Saldo' },
    { key: 'login',      label: 'Sidst inde' },
    { key: 'limitKr',    label: 'Grænse' },
    { key: 'spent30d',   label: 'Forbrug (30 dage)' },
    { key: 'notifOn',    label: 'Notifikation' },
    { key: '__action',   label: '' },
  ];

  // ─── Datahentning ──────────────────────────────────────────────

  async function load() {
    loading = true;
    render();
    try {
      var results = await Promise.all([
        window.PortalData.getParentAdminOverview(ctx.institutionId),
        window.PortalData.getAulaMessageTemplate(ctx.institutionId),
      ]);
      data = results[0];
      if (results[1]) {
        template = results[1].template || null;
        if (results[1].institutionName) ctx.institutionName = results[1].institutionName;
      }
    } catch (err) {
      console.error('[forældre-side] Kunne ikke hente data:', err);
      data = null;
    }
    loading = false;
    render();
  }

  function activeTemplate() {
    return template || DEFAULT_TEMPLATE;
  }

  // ─── Afledte lister ────────────────────────────────────────────

  function allChildren() {
    return (data && data.children) || [];
  }

  function countFor(flagKey) {
    return allChildren().filter(function (c) { return c.flags.indexOf(flagKey) >= 0; }).length;
  }

  function visibleChildren() {
    var q = query.trim().toLowerCase();
    var rows = allChildren().filter(function (c) {
      if (filter && c.flags.indexOf(filter) < 0) return false;
      if (!q) return true;
      return (c.child || '').toLowerCase().indexOf(q) >= 0
        || String(c.childNumber || '').indexOf(q) >= 0
        || (c.parentLabel || '').toLowerCase().indexOf(q) >= 0
        || (c.portalCode || '').toLowerCase().indexOf(q) >= 0;
    });

    var CODE_ORDER = { none: 0, expired: 1, active: 2, used: 3 };
    rows.sort(function (a, b) {
      var av = a[sortKey];
      var bv = b[sortKey];
      if (sortKey === 'codeState') { av = CODE_ORDER[av]; bv = CODE_ORDER[bv]; }
      if (sortKey === 'notifOn') { av = av ? 1 : 0; bv = bv ? 1 : 0; }
      if (sortKey === 'login') { av = av ? new Date(av).getTime() : 0; bv = bv ? new Date(bv).getTime() : 0; }
      if (av === null || av === undefined) av = sortKey === 'child' || sortKey === 'parentLabel' ? '' : -Infinity;
      if (bv === null || bv === undefined) bv = sortKey === 'child' || sortKey === 'parentLabel' ? '' : -Infinity;
      if (typeof av === 'number' && typeof bv === 'number') return sortAsc ? av - bv : bv - av;
      return sortAsc
        ? String(av).localeCompare(String(bv), 'da')
        : String(bv).localeCompare(String(av), 'da');
    });
    return rows;
  }

  function queueChildren() {
    // Samlebåndet kører på de børn der HAR en brugbar kode som ingen har
    // indløst — det er dem en besked faktisk kan hjælpe.
    return allChildren()
      .filter(function (c) { return c.codeState === 'active'; })
      .sort(function (a, b) { return String(a.child).localeCompare(String(b.child), 'da'); });
  }

  function missingCodeCount() {
    return allChildren().filter(function (c) { return c.codeState === 'none'; }).length;
  }

  // ─── Render: lag 1 (adoptions-trin) ────────────────────────────

  function funnelHTML() {
    var f = (data && data.funnel) || {};
    var total = f.children || 0;

    // Trinnene er IKKE indlejrede delmængder — et barn kan have en forælder
    // uden nogensinde at have haft en kode. Derfor får hvert trin sin egen
    // tæller mod den fælles nævner i stedet for at blive tegnet som en tragt,
    // hvor et højere tal senere i rækken ville ligne en fejl.
    var steps = [
      { key: '',            label: 'Børn',              value: total,             note: 'i institutionen' },
      { key: 'codepending', label: 'Kode sendt',        value: f.codeGenerated || 0, note: 'har fået en kode' },
      { key: 'noparent',    label: 'Forælder tilknyttet', value: f.parentLinked || 0, note: 'heraf ' + fmt(f.codeRedeemed || 0) + ' via kode', invert: true },
      { key: 'never',       label: 'Har åbnet portalen', value: f.everLoggedIn || 0, note: 'mindst én gang', invert: true },
      { key: 'active',      label: 'Aktiv (30 dage)',   value: f.active30d || 0,  note: 'inde inden for 30 dage' },
    ];

    return '<div class="apx-funnel">' + steps.map(function (s, i) {
      var share = i === 0 ? 100 : pct(s.value, total);
      return '<button class="apx-step' + (filter && filter === s.key ? ' active' : '') + '"' +
        (s.key ? ' data-step-filter="' + esc(s.key) + '"' : ' disabled') + '>' +
          '<div class="apx-step-value">' + fmt(s.value) +
            '<span class="apx-step-denom">/ ' + fmt(total) + '</span>' +
          '</div>' +
          '<div class="apx-step-label">' + esc(s.label) + '</div>' +
          '<div class="apx-step-bar"><span style="width:' + share + '%"></span></div>' +
          '<div class="apx-step-note">' + esc(s.note) + (i === 0 ? '' : ' · ' + share + '%') + '</div>' +
        '</button>';
    }).join('') + '</div>' +
    '<p class="apx-denom-note">Alle tal måles mod de samme <strong>' + fmt(total) + ' børn</strong>. ' +
      'Institutionens preview-konto tæller ikke med som forælder.</p>';
  }

  // ─── Render: lag 2 (kræver opmærksomhed) ───────────────────────

  function alertsHTML() {
    var cards = FILTERS.map(function (f) {
      var n = countFor(f.key);
      return { f: f, n: n };
    }).filter(function (c) { return c.n > 0; });

    if (cards.length === 0) {
      return '<div class="apx-section"><div class="apx-section-title">⚡ Kræver opmærksomhed</div>' +
        '<div class="apx-empty-ok">Ingenting kræver handling lige nu.</div></div>';
    }

    return '<div class="apx-section">' +
      '<div class="apx-section-title">⚡ Kræver opmærksomhed</div>' +
      '<div class="apx-alerts">' + cards.map(function (c) {
        return '<button class="apx-alert' + (filter === c.f.key ? ' active' : '') + '" data-filter="' + esc(c.f.key) + '">' +
          '<span class="apx-alert-icon">' + c.f.icon + '</span>' +
          '<span class="apx-alert-body">' +
            '<span class="apx-alert-count">' + fmt(c.n) + '</span>' +
            '<span class="apx-alert-label">' + esc(c.f.label) + '</span>' +
            '<span class="apx-alert-desc">' + esc(c.f.desc) + '</span>' +
          '</span>' +
          '<span class="apx-alert-go">' + (filter === c.f.key ? 'Vist' : 'Vis →') + '</span>' +
        '</button>';
      }).join('') + '</div></div>';
  }

  // ─── Render: lag 3 (liste) ─────────────────────────────────────

  function codeCell(c) {
    if (c.codeState === 'used') {
      return '<span class="apx-tag green">Indløst</span>' +
        '<span class="apx-sub">' + esc(formatDate(c.portalCodeUsedAt)) + '</span>';
    }
    if (c.codeState === 'active') {
      return '<code class="apx-code">' + esc(c.portalCode) + '</code>' +
        '<span class="apx-sub">udløber om ' + c.codeDaysLeft + ' d.</span>';
    }
    if (c.codeState === 'expired') {
      return '<span class="apx-tag red">Udløbet</span>' +
        '<span class="apx-sub">' + esc(formatDate(c.codeExpiresAt)) + '</span>';
    }
    return '<span class="apx-tag gray">Ingen</span>';
  }

  function parentCell(c) {
    if (c.parentCount === 0) return '<span class="apx-muted">—</span>';
    var extra = c.parentCount > 1 ? '<span class="apx-sub">+' + (c.parentCount - 1) + ' mere</span>' : '';
    return '<span class="apx-parent">' + esc(c.parentLabel) + '</span>' + extra;
  }

  function notifCell(c) {
    if (!c.notifOn) return '<span class="apx-muted">—</span>';
    var parts = [];
    if (c.notif.mailAtZero || c.notif.mailAtTen) parts.push('mail');
    if (c.notif.pushAtZero || c.notif.pushAtTen) parts.push('push');
    if (c.notif.events) parts.push('arrangementer');
    return '<span class="apx-tag green">Til</span><span class="apx-sub">' + esc(parts.join(' · ')) + '</span>';
  }

  function listHTML() {
    var rows = visibleChildren();
    var total = allChildren().length;
    var missing = missingCodeCount();
    var queued = queueChildren().length;

    var chips = FILTERS.map(function (f) {
      var n = countFor(f.key);
      if (n === 0 && filter !== f.key) return '';
      return '<button class="apx-chip' + (filter === f.key ? ' active' : '') + '" data-filter="' + esc(f.key) + '">' +
        f.icon + ' ' + esc(f.label) + ' <span class="apx-chip-n">' + n + '</span></button>';
    }).join('');

    return '<div class="apx-section apx-list-section">' +
      '<div class="apx-section-title">👨‍👩‍👧 Alle børn</div>' +
      '<div class="apx-toolbar">' +
        '<input class="apx-search" id="apx-search" placeholder="Søg barn, nummer, forælder eller kode…" value="' + esc(query) + '">' +
        '<div class="apx-chips">' + chips +
          (filter ? '<button class="apx-chip clear" data-filter="">✕ Ryd filter</button>' : '') +
        '</div>' +
        '<div class="apx-count">Viser <strong>' + fmt(rows.length) + '</strong> af ' + fmt(total) + '</div>' +
      '</div>' +
      '<div class="apx-actions">' +
        '<button class="apx-btn primary" id="apx-batch"' + (missing === 0 ? ' disabled' : '') + '>' +
          '🔑 Generér manglende koder (' + missing + ')</button>' +
        '<button class="apx-btn" id="apx-queue"' + (queued === 0 ? ' disabled' : '') + '>' +
          '📨 Kør samlebånd (' + queued + ')</button>' +
        '<button class="apx-btn" id="apx-template">✏️ Rediger Aula-besked</button>' +
        '<button class="apx-btn" id="apx-csv">📥 Eksportér CSV</button>' +
      '</div>' +
      '<div class="apx-table-wrap"><table class="apx-table">' +
        '<thead><tr>' + COLUMNS.map(function (col) {
          if (col.key === '__action') return '<th></th>';
          var on = sortKey === col.key;
          return '<th class="sortable' + (on ? ' sorted' : '') + '" data-sort="' + col.key + '">' +
            esc(col.label) + (on ? (sortAsc ? ' ▲' : ' ▼') : '') + '</th>';
        }).join('') + '</tr></thead>' +
        '<tbody>' + (rows.length === 0
          ? '<tr><td colspan="' + COLUMNS.length + '" class="apx-empty">Ingen børn matcher.</td></tr>'
          : rows.map(function (c) {
            var saldoCls = c.saldo < 0 ? 'red' : c.saldo === 0 ? 'orange' : c.saldo < 20 ? 'orange' : 'green';
            return '<tr data-child="' + esc(c.childId) + '">' +
              '<td><span class="apx-avatar">' + esc((c.child || '?').charAt(0)) + '</span>' +
                '<span class="apx-name">' + esc(c.child) + (c.lastName ? ' ' + esc(c.lastName) : '') + '</span>' +
                (c.childNumber ? '<span class="apx-sub">nr. ' + esc(c.childNumber) + '</span>' : '') + '</td>' +
              '<td>' + parentCell(c) + '</td>' +
              '<td>' + codeCell(c) + '</td>' +
              '<td><span class="apx-tag ' + saldoCls + '">' + fmt(Math.round(c.saldo)) + ' kr</span></td>' +
              '<td>' + (c.login ? esc(formatDate(c.login)) : '<span class="apx-tag red">Aldrig</span>') + '</td>' +
              '<td>' + (c.limitKr != null
                  ? '<span class="apx-tag blue">' + c.limitKr + ' kr</span>'
                  : (c.hasProductLimits ? '<span class="apx-tag blue">Produkter</span>' : '<span class="apx-muted">—</span>')) + '</td>' +
              '<td>' + fmt(c.spent30d) + ' kr<span class="apx-sub">' + fmt(c.purchases30d) + ' køb</span></td>' +
              '<td>' + notifCell(c) + '</td>' +
              '<td class="apx-row-action"><button class="apx-btn small" data-code-for="' + esc(c.childId) + '">' +
                (c.codeState === 'none' ? '🔑 Lav kode' : '🔄 Ny kode') + '</button></td>' +
            '</tr>';
          }).join('')) +
        '</tbody>' +
      '</table></div>' +
    '</div>';
  }

  // ─── Render: hele siden ────────────────────────────────────────

  function render() {
    if (!rootEl) return;

    if (loading && !data) {
      rootEl.innerHTML = '<div class="apx-loading"><div class="apx-spinner"></div>Henter forældredata…</div>';
      return;
    }
    if (!data) {
      rootEl.innerHTML = '<div class="apx-loading">Kunne ikke hente forældredata. ' +
        '<button class="apx-btn" id="apx-retry">Prøv igen</button></div>';
      var retry = rootEl.querySelector('#apx-retry');
      if (retry) retry.addEventListener('click', load);
      return;
    }

    var s = data.stats || {};
    var a = data.adoption || {};

    rootEl.innerHTML =
      '<div class="apx-head">' +
        '<div>' +
          '<h1 class="apx-title">Forældre</h1>' +
          '<p class="apx-subtitle">' + esc(ctx.institutionName || 'Institutionen') + ' · ' +
            fmt(s.totalChildren) + ' børn · ' + fmt(s.parentAccounts) + ' forældrekonti</p>' +
        '</div>' +
        '<button class="apx-btn" id="apx-reload">↻ Opdatér</button>' +
      '</div>' +
      funnelHTML() +
      alertsHTML() +
      '<div class="apx-section">' +
        '<div class="apx-section-title">📊 Hvad forældrene bruger</div>' +
        adoptionHTML(a) +
      '</div>' +
      listHTML() +
      (loading ? '<div class="apx-overlay-busy"><div class="apx-spinner"></div></div>' : '');

    bind();
  }

  function adoptionHTML(a) {
    var denom = a.denominator || 0;
    if (denom === 0) {
      return '<div class="apx-empty-ok">Ingen forældre er tilknyttet endnu — der er intet at måle på. ' +
        'Send koder ud først.</div>';
    }
    var bars = [
      { label: 'Grænser sat',      n: a.limitsSet || 0,    color: '#16A34A' },
      { label: 'Allergener',       n: a.allergensSet || 0, color: '#F5960A' },
      { label: 'Kostpræferencer',  n: a.dietSet || 0,      color: '#8B5CF6' },
      { label: 'Notifikationer',   n: a.notifSet || 0,     color: '#2563EB' },
      { label: 'App med push',     n: a.pushSet || 0,      color: '#0EA5E9' },
    ];
    return '<div class="apx-adoption">' + bars.map(function (b) {
      var p = pct(b.n, denom);
      return '<div class="apx-adopt-card">' +
        '<div class="apx-adopt-head"><span>' + esc(b.label) + '</span>' +
          '<strong style="color:' + b.color + '">' + p + '%</strong></div>' +
        '<div class="apx-adopt-track"><span style="width:' + p + '%;background:' + b.color + '"></span></div>' +
        '<div class="apx-adopt-note">' + fmt(b.n) + ' af ' + fmt(denom) +
          (denom === 1 ? ' barn' : ' børn') + ' med forælder</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  // ─── Hændelser ─────────────────────────────────────────────────

  function setFilter(next) {
    filter = (filter === next) ? '' : next;
    render();
    var list = rootEl.querySelector('.apx-list-section');
    if (list && filter) list.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function bind() {
    var reload = rootEl.querySelector('#apx-reload');
    if (reload) reload.addEventListener('click', load);

    rootEl.querySelectorAll('[data-step-filter]').forEach(function (el) {
      el.addEventListener('click', function () { setFilter(el.dataset.stepFilter); });
    });
    rootEl.querySelectorAll('[data-filter]').forEach(function (el) {
      el.addEventListener('click', function () {
        var v = el.dataset.filter;
        if (v === '') { filter = ''; render(); } else setFilter(v);
      });
    });

    var search = rootEl.querySelector('#apx-search');
    if (search) {
      search.addEventListener('input', function () {
        query = search.value;
        var pos = search.selectionStart;
        render();
        var again = rootEl.querySelector('#apx-search');
        if (again) { again.focus(); again.setSelectionRange(pos, pos); }
      });
    }

    rootEl.querySelectorAll('th[data-sort]').forEach(function (th) {
      th.addEventListener('click', function () {
        var k = th.dataset.sort;
        if (sortKey === k) sortAsc = !sortAsc; else { sortKey = k; sortAsc = true; }
        render();
      });
    });

    rootEl.querySelectorAll('[data-code-for]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var child = allChildren().find(function (c) { return c.childId === btn.dataset.codeFor; });
        if (child) openCodeDialog(child);
      });
    });

    var batch = rootEl.querySelector('#apx-batch');
    if (batch) batch.addEventListener('click', runBatch);
    var queue = rootEl.querySelector('#apx-queue');
    if (queue) queue.addEventListener('click', openQueue);
    var tpl = rootEl.querySelector('#apx-template');
    if (tpl) tpl.addEventListener('click', openTemplateEditor);
    var csv = rootEl.querySelector('#apx-csv');
    if (csv) csv.addEventListener('click', exportCSV);
  }

  // ─── Modal-skelet ──────────────────────────────────────────────

  function openModal(html, opts) {
    var overlay = document.createElement('div');
    overlay.className = 'apx-modal-overlay';
    overlay.innerHTML = '<div class="apx-modal' + (opts && opts.wide ? ' wide' : '') + '">' + html + '</div>';
    document.body.appendChild(overlay);

    function close() {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      if (opts && opts.onClose) opts.onClose();
    }
    function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    overlay.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', close); });

    requestAnimationFrame(function () { overlay.classList.add('visible'); });
    return { el: overlay, close: close };
  }

  // ─── Ny kode: fuld status FØR handlingen ───────────────────────

  function codeStatusLine(child) {
    if (child.codeState === 'active') {
      return '<strong>' + esc(child.child) + '</strong> har allerede en aktiv kode ' +
        '(<code>' + esc(child.portalCode) + '</code>, udløber om ' + child.codeDaysLeft +
        ' dage, endnu ikke indløst). En ny kode gør den gamle ugyldig.';
    }
    if (child.codeState === 'expired') {
      return '<strong>' + esc(child.child) + '</strong> fik en kode ' +
        esc(formatDate(child.portalCodeGeneratedAt)) + ', men den udløb uindløst. ' +
        'En ny kode giver 7 nye dage.';
    }
    if (child.codeState === 'used') {
      return 'Koden til <strong>' + esc(child.child) + '</strong> blev indløst ' +
        esc(formatDate(child.portalCodeUsedAt)) + '. En ny kode er til den næste person, ' +
        'der skal have adgang.';
    }
    return '<strong>' + esc(child.child) + '</strong> har ikke fået en kode endnu.';
  }

  function openCodeDialog(child) {
    var parentNote = child.parentCount > 0
      ? '<div class="apx-note ok">✓ Ny kode påvirker <strong>ikke</strong> ' +
          (child.parentCount === 1 ? 'den forælder' : 'de ' + child.parentCount + ' forældre') +
          ' der allerede er tilknyttet — de beholder deres adgang.</div>'
      : '';

    var m = openModal(
      '<div class="apx-modal-head"><h2>' + (child.codeState === 'none' ? 'Lav portal-kode' : 'Ny portal-kode') + '</h2>' +
        '<button class="apx-modal-x" data-close>✕</button></div>' +
      '<div class="apx-modal-body">' +
        '<p>' + codeStatusLine(child) + '</p>' +
        parentNote +
        '<div class="apx-note">Koden kan kun bruges én gang og udløber efter 7 dage.</div>' +
      '</div>' +
      '<div class="apx-modal-foot">' +
        '<button class="apx-btn" data-close>Annullér</button>' +
        '<button class="apx-btn primary" id="apx-code-go">' +
          (child.codeState === 'none' ? 'Lav kode' : 'Ja, lav ny kode') + '</button>' +
      '</div>'
    );

    m.el.querySelector('#apx-code-go').addEventListener('click', async function () {
      var btn = m.el.querySelector('#apx-code-go');
      btn.disabled = true;
      btn.textContent = 'Laver kode…';
      var res = await window.PortalData.generateSinglePortalCode(child.childId);
      if (!res || !res.success) {
        btn.disabled = false;
        btn.textContent = 'Prøv igen';
        toast('Kunne ikke lave kode: ' + ((res && res.error) || 'ukendt fejl'), true);
        return;
      }
      // Opdatér rækken lokalt, så listen viser sandheden med det samme.
      child.portalCode = res.code;
      child.portalCodeUsedAt = null;
      child.portalCodeGeneratedAt = new Date().toISOString();
      child.codeExpiresAt = res.expires_at || new Date(Date.now() + 7 * 86400000).toISOString();
      child.codeState = 'active';
      child.codeDaysLeft = 7;
      child.flags = child.flags.replace(/\bnocode\b|\bcodeexpired\b/g, '').trim() + ' codepending';
      m.close();
      showCodeResult(child);
    });
  }

  function showCodeResult(child) {
    var message = fillTemplate(activeTemplate(), child.child, child.portalCode, ctx.institutionName);

    var m = openModal(
      '<div class="apx-modal-head"><h2>Kode til ' + esc(child.child) + '</h2>' +
        '<button class="apx-modal-x" data-close>✕</button></div>' +
      '<div class="apx-modal-body">' +
        '<div class="apx-code-big">' + esc(child.portalCode) + '</div>' +
        '<div class="apx-note">Udløber om 7 dage · kan kun bruges én gang</div>' +
        '<div class="apx-msg-head">' +
          '<span>📨 Aula-besked til forælderen</span>' +
          '<button class="apx-link" id="apx-edit-tpl">Rediger besked</button>' +
        '</div>' +
        '<pre class="apx-msg-box" id="apx-msg">' + esc(message) + '</pre>' +
      '</div>' +
      '<div class="apx-modal-foot">' +
        '<button class="apx-btn" id="apx-copy-code">Kopiér kun koden</button>' +
        '<button class="apx-btn primary" id="apx-copy-msg">📋 Kopiér besked</button>' +
        '<button class="apx-btn" data-close>Luk</button>' +
      '</div>',
      { wide: true, onClose: render }
    );

    m.el.querySelector('#apx-copy-code').addEventListener('click', async function () {
      toast(await copyToClipboard(child.portalCode) ? 'Kode kopieret' : 'Kunne ikke kopiere', false);
    });
    m.el.querySelector('#apx-copy-msg').addEventListener('click', async function () {
      toast(await copyToClipboard(message) ? 'Besked kopieret' : 'Kunne ikke kopiere', false);
    });
    m.el.querySelector('#apx-edit-tpl').addEventListener('click', function () {
      m.close();
      openTemplateEditor(function () { showCodeResult(child); });
    });
  }

  // ─── Batch: kun de børn der INTET har ──────────────────────────

  async function runBatch() {
    var n = missingCodeCount();
    if (n === 0) return;

    var m = openModal(
      '<div class="apx-modal-head"><h2>Generér manglende koder</h2>' +
        '<button class="apx-modal-x" data-close>✕</button></div>' +
      '<div class="apx-modal-body">' +
        '<p><strong>' + n + ' børn</strong> har ingen portal-kode. De får hver sin nye kode, ' +
          'der er gyldig i 7 dage.</p>' +
        '<div class="apx-note ok">✓ Børn der allerede har en kode røres ikke. ' +
          'Ingen forælder mister adgang.</div>' +
      '</div>' +
      '<div class="apx-modal-foot">' +
        '<button class="apx-btn" data-close>Annullér</button>' +
        '<button class="apx-btn primary" id="apx-batch-go">Generér ' + n + ' koder</button>' +
      '</div>'
    );

    m.el.querySelector('#apx-batch-go').addEventListener('click', async function () {
      var btn = m.el.querySelector('#apx-batch-go');
      btn.disabled = true;
      btn.textContent = 'Genererer…';
      var res = await window.PortalData.generatePortalCodesBatch(ctx.institutionId);
      m.close();
      if (!res || !res.success) {
        toast('Fejl: ' + ((res && res.error) || 'ukendt'), true);
        return;
      }
      toast(res.generated_count + ' koder oprettet');
      await load();
      if (queueChildren().length > 0) openQueue();
    });
  }

  // ─── Samlebåndet: ét barn ad gangen ────────────────────────────

  function openQueue() {
    var queue = queueChildren();
    if (queue.length === 0) return;

    var index = 0;
    var sent = 0;
    var m = openModal('<div id="apx-queue-inner"></div>', { wide: true, onClose: render });

    function paint() {
      var inner = m.el.querySelector('#apx-queue-inner');
      if (index >= queue.length) {
        inner.innerHTML =
          '<div class="apx-modal-head"><h2>Færdig</h2><button class="apx-modal-x" data-close>✕</button></div>' +
          '<div class="apx-modal-body"><div class="apx-done">✅<p>Du kom igennem alle ' + queue.length +
            ' børn.<br><strong>' + sent + '</strong> beskeder markeret som sendt.</p></div></div>' +
          '<div class="apx-modal-foot"><button class="apx-btn primary" data-close>Luk</button></div>';
        inner.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', m.close); });
        return;
      }

      var c = queue[index];
      var message = fillTemplate(activeTemplate(), c.child, c.portalCode, ctx.institutionName);

      inner.innerHTML =
        '<div class="apx-modal-head">' +
          '<h2>Samlebånd <span class="apx-queue-pos">' + (index + 1) + ' af ' + queue.length + '</span></h2>' +
          '<button class="apx-modal-x" data-close>✕</button>' +
        '</div>' +
        '<div class="apx-queue-progress"><span style="width:' + pct(index, queue.length) + '%"></span></div>' +
        '<div class="apx-modal-body">' +
          '<div class="apx-queue-child">' +
            '<span class="apx-avatar big">' + esc((c.child || '?').charAt(0)) + '</span>' +
            '<div><div class="apx-queue-name">' + esc(c.child) +
              (c.lastName ? ' ' + esc(c.lastName) : '') + '</div>' +
              '<div class="apx-sub">' + (c.childNumber ? 'nr. ' + esc(c.childNumber) + ' · ' : '') +
                'kode udløber om ' + c.codeDaysLeft + ' dage</div></div>' +
            '<code class="apx-code big">' + esc(c.portalCode) + '</code>' +
          '</div>' +
          '<pre class="apx-msg-box" id="apx-q-msg">' + esc(message) + '</pre>' +
          '<div class="apx-note">Markeringen gælder denne gennemgang — den gemmes ikke i databasen.</div>' +
        '</div>' +
        '<div class="apx-modal-foot">' +
          '<button class="apx-btn" id="apx-q-skip">Spring over</button>' +
          '<button class="apx-btn primary" id="apx-q-copy">📋 Kopiér besked og gå videre</button>' +
        '</div>';

      inner.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', m.close); });
      inner.querySelector('#apx-q-skip').addEventListener('click', function () { index++; paint(); });

      function advance() { sent++; index++; paint(); }

      var copyBtn = inner.querySelector('#apx-q-copy');
      copyBtn.addEventListener('click', async function () {
        // Anden gang knappen trykkes efter en fejlet kopiering betyder den
        // "jeg har taget teksten selv" — ellers ville en blokeret clipboard
        // (WKWebView, manglende tilladelse) låse hele samlebåndet fast på
        // barn 1 af 100 uden vej videre.
        if (copyBtn.dataset.manual === '1') { advance(); return; }

        if (await copyToClipboard(message)) {
          toast('Kopieret — indsæt i Aula');
          advance();
          return;
        }

        // Markér teksten, så ⌘C/Ctrl+C virker med det samme.
        var pre = inner.querySelector('#apx-q-msg');
        if (pre && window.getSelection) {
          var range = document.createRange();
          range.selectNodeContents(pre);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
        copyBtn.dataset.manual = '1';
        copyBtn.textContent = '✓ Jeg har kopieret — videre';
        toast('Kunne ikke kopiere automatisk — teksten er markeret, tryk ⌘C', true);
      });
    }

    paint();
  }

  // ─── Aula-skabelon: redigering ─────────────────────────────────

  function openTemplateEditor(afterSave) {
    var current = activeTemplate();
    var sample = allChildren()[0];
    var sampleName = (sample && sample.child) || 'Emma';

    var m = openModal(
      '<div class="apx-modal-head"><h2>Aula-besked</h2>' +
        '<button class="apx-modal-x" data-close>✕</button></div>' +
      '<div class="apx-modal-body">' +
        '<p class="apx-sub-block">Beskeden bruges hver gang du kopierer en kode. ' +
          'Felterne <code>{{child_name}}</code>, <code>{{kode}}</code> og ' +
          '<code>{{institution}}</code> udfyldes automatisk.</p>' +
        '<textarea class="apx-textarea" id="apx-tpl-text" spellcheck="true">' + esc(current) + '</textarea>' +
        '<div class="apx-msg-head"><span>Sådan ser den ud</span></div>' +
        '<pre class="apx-msg-box" id="apx-tpl-preview"></pre>' +
      '</div>' +
      '<div class="apx-modal-foot">' +
        '<button class="apx-btn" id="apx-tpl-reset">Nulstil til Flangos tekst</button>' +
        '<button class="apx-btn" data-close>Annullér</button>' +
        '<button class="apx-btn primary" id="apx-tpl-save">Gem besked</button>' +
      '</div>',
      { wide: true }
    );

    var ta = m.el.querySelector('#apx-tpl-text');
    var preview = m.el.querySelector('#apx-tpl-preview');

    function paintPreview() {
      preview.textContent = fillTemplate(ta.value, sampleName, 'A1B2C3D4', ctx.institutionName);
    }
    ta.addEventListener('input', paintPreview);
    paintPreview();

    m.el.querySelector('#apx-tpl-reset').addEventListener('click', function () {
      ta.value = DEFAULT_TEMPLATE;
      paintPreview();
    });

    m.el.querySelector('#apx-tpl-save').addEventListener('click', async function () {
      var btn = m.el.querySelector('#apx-tpl-save');
      btn.disabled = true;
      btn.textContent = 'Gemmer…';
      var ok = await window.PortalData.saveInstitutionSettings(ctx.institutionId, {
        parent_portal_message_template: ta.value,
      });
      if (!ok) {
        btn.disabled = false;
        btn.textContent = 'Prøv igen';
        toast('Kunne ikke gemme beskeden', true);
        return;
      }
      template = ta.value;
      m.close();
      toast('Besked gemt');
      if (typeof afterSave === 'function') afterSave();
    });
  }

  // ─── CSV ───────────────────────────────────────────────────────

  function exportCSV() {
    var rows = visibleChildren();
    var head = ['Barn', 'Nummer', 'Forælder', 'Antal forældre', 'Kode', 'Kode-status',
                'Saldo', 'Sidst inde', 'Grænse', 'Forbrug 30 dage', 'Køb 30 dage', 'Notifikation'];
    var CODE_LABEL = { none: 'Ingen', active: 'Sendt, afventer', expired: 'Udløbet', used: 'Indløst' };

    var lines = [head.join(';')].concat(rows.map(function (c) {
      return [
        c.child + (c.lastName ? ' ' + c.lastName : ''),
        c.childNumber || '',
        c.parentLabel || '',
        c.parentCount,
        c.portalCode || '',
        CODE_LABEL[c.codeState],
        Math.round(c.saldo),
        c.login ? new Date(c.login).toLocaleDateString('da-DK') : 'Aldrig',
        c.limitKr != null ? c.limitKr : (c.hasProductLimits ? 'Produktgrænse' : ''),
        c.spent30d,
        c.purchases30d,
        c.notifOn ? 'Til' : 'Fra',
      ].map(function (v) { return String(v).replace(/;/g, ','); }).join(';');
    }));

    var content = '﻿' + lines.join('\r\n');
    var name = 'foraeldre-' + new Date().toISOString().slice(0, 10) + '.csv';

    // WKWebView (Tauri) blokerer Blob-download lydløst. Den forskel bor ét sted
    // — core/download-file.js — og må ikke kopieres hertil.
    if (typeof window.__flangoDownloadFile !== 'function') {
      toast('Download-modulet er ikke indlæst', true);
      return;
    }
    window.__flangoDownloadFile(name, content, 'text/csv').then(function (ok) {
      toast(ok ? 'CSV gemt' : 'Kunne ikke gemme CSV', !ok);
    });
  }

  // ─── Livscyklus ────────────────────────────────────────────────

  function mount(container, options) {
    rootEl = container;
    ctx.institutionName = (options && options.institutionName) || '';
    ctx.institutionId = (options && options.institutionId) || null;
    filter = '';
    query = '';
    sortKey = 'child';
    sortAsc = true;
    data = null;
    template = null;
    load();
  }

  function unmount() {
    rootEl = null;
    data = null;
    template = null;
  }

  window.AdminParentPage = { mount: mount, unmount: unmount, refresh: load };
})();
