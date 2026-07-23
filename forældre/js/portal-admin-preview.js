/**
 * portal-admin-preview.js — admin-preview-tilstand (admin-portal-ombygningen)
 *
 * Loades KUN når portalen åbnes med ?admin_preview=1 (dynamisk script-injektion
 * fra portal-v2.js init) — forældre henter aldrig denne fil. Modulet gør tre ting:
 *
 *   1. Handshake: modtager admin-parent-sessionen fra værts-fladen via
 *      postMessage (aldrig URL-params) og logger ind med den. To værter deler
 *      protokollen: café-appens "Portal-indstillinger" (role=admin) og
 *      super-admin-panelets portalflade (role=superadmin).
 *   2. Dekoration: efter hver renderApp gråtones sektioner der er skjult for
 *      forældre, og hver flag-styret sektion får en toggle-chip i headeren.
 *      role=superadmin får derudover en 🔒-lås-chip pr. sektion. Hvilke
 *      sektioner, kolonner og låse-moduler der findes, kommer fra serverens
 *      preview_sections (get-parent-view) — ingen kolonne-dubletter her.
 *   3. Protokol: chip-klik meldes til værten (som ejer draft-state + gem-baren);
 *      værten kan sende draft-overrides retur og "saved" (→ refetch af serverens
 *      sandhed).
 *
 * Sikkerhed: modulet giver ingen adgang i sig selv — serveren sætter kun
 * is_admin_preview for institutionens admin-parent-konto, og sessions-beskeder
 * accepteres kun fra origin-allowlisten nedenfor. Lås-chippen er UI: låsen
 * håndhæves af feature_flags-triggerne i databasen.
 */
(function () {
  'use strict';

  const PROTOCOL_VERSION = 1;

  // Værts-flader: web-prod (café OG super-admin ligger begge på flango.dk),
  // lokal dev (cafe 3000, super-admin 5175) og Tauri-desktop.
  const ALLOWED_HOST_ORIGINS = [
    'https://flango.dk',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5175',
    'http://127.0.0.1:5175',
    'tauri://localhost',
    'http://tauri.localhost',
    'https://tauri.localhost',
  ];

  // Fallback når superadmin har låst uden at skrive en forklaring.
  const DEFAULT_LOCK_TEXT = 'Låst af Flango';

  // Portal-DOM-id(er) pr. server-sektionsnøgle. DOM-viden er portal-side pr. natur;
  // flag-kolonnerne og låse-modulerne kommer fra serveren (preview_sections).
  // Et flag kan gate FLERE kort — `notifications` renderer både push- og
  // e-mail-kortet, og begge skal følge kontakten (ellers stod e-mail-kortet
  // hvidt og kontaktløst mens push-kortet var gråt).
  const SECTION_DOM = {
    balance: ['section-balance'],
    topup: ['section-topup'],
    events: ['section-events'],
    ugeplan: ['section-ugeplan'],
    purchase_profile: ['section-profile'],
    history: ['section-history'],
    sortiment: ['section-sortiment'],
    feedback: ['section-feedback'],
    spending_limit: ['section-spending-limit'],
    product_limit: ['section-product-limits'],
    sugar_policy: ['section-sugar'],
    diet: ['section-diet'],
    allergens: ['section-allergens'],
    profile_pictures: ['section-profile-picture'],
    notifications: ['section-notifications', 'section-email-notifications'],
    screentime: ['section-screentime'],
    screentime_games: ['section-games'],
    screentime_usage: ['section-st-chart'],
    transfer: ['section-transfer'],
    pin: ['section-pin'],
    invite_parent: ['section-invite-parent'],
    linked_parents: ['section-linked-parents'],
    game_accounts: ['section-game-accounts'],
    // Kapacitet: kortet er altid synligt, kontakten styrer kun handlingen.
    child_name_edit: ['section-child-name'],
    // Lovpligtige — serveren melder dem som always_on (ingen kolonne).
    privacy_policy: ['section-privacy-policy'],
    consents: ['section-consents'],
    data_insight: ['section-data-insight'],
    delete_child: ['section-delete-child'],
    delete_account: ['section-delete-account'],
  };

  // Kort som stadig ikke har en kontakt. Teksten forklarer hvorfor, så et tomt
  // felt ikke ligner en manglende funktion.
  const NO_FLAG_REASON = {
    'section-contact': 'Kontaktknappen styres af kontakttelefon-feltet i caféens portalindstillinger.',
  };

  let hostOrigin = null;        // sat ved session-handshake; al efterfølgende trafik låses hertil
  let role = 'admin';           // 'admin' (café) | 'superadmin' (super-admin-panelet)
  let sections = [];            // seneste preview_sections fra serveren
  let subcontrols = [];         // seneste preview_subcontrols (under-kontakter i kortene)
  let draft = {};               // column → bool; værtens ugemte flag-ændringer
  let lockDraft = {};           // module → { locked, reason }; værtens ugemte lås-ændringer
  let flags = {};               // module → { locked, lock_reason } — feature_flags fra værten
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
      /* Kontrollerne bor UDEN FOR sektionen i en venstre-kolonne, så kortet
         forbliver præcis det forælderen ser. Sektionen wrappes i en flex-række
         ved dekorering (portalens egen markup røres ikke). */
      .flango-preview-row { display: flex; align-items: flex-start; gap: 10px; }
      /* Alt der ikke er kolonnen (kort, saldo-kort m.fl.) fylder resten */
      .flango-preview-row > :not(.flango-preview-gutter) { flex: 1 1 auto; min-width: 0; }
      .flango-preview-gutter {
        flex: none; width: 88px; display: flex; flex-direction: row;
        align-items: center; justify-content: flex-end; gap: 8px; padding-top: 14px;
        /* Admin-UI — må aldrig gråtones med den slukkede sektion */
        filter: none; opacity: 1;
      }
      .fp-toggle {
        position: relative; width: 44px; height: 26px; flex: none; padding: 0;
        border: none; border-radius: 999px; cursor: pointer;
        background: var(--border-strong, #cbd5e1); transition: background .2s;
        -webkit-appearance: none; appearance: none;
      }
      .fp-toggle::after {
        content: ''; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px;
        border-radius: 50%; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,.2);
        transition: transform .2s;
      }
      .fp-toggle[aria-checked="true"] { background: var(--positive, #16a34a); }
      .fp-toggle[aria-checked="true"]::after { transform: translateX(18px); }
      .fp-toggle[aria-disabled="true"] { cursor: help; opacity: .55; }
      .fp-toggle.fp-dirty { box-shadow: 0 0 0 3px rgba(245, 150, 10, .3); }
      .fp-lock {
        display: inline-flex; align-items: center; justify-content: center;
        width: 30px; height: 26px; padding: 0; border-radius: 8px;
        border: 1.5px solid #d1d5db; background: #ffffff; color: #6b7280;
        font-size: 12px; line-height: 1; cursor: pointer; font-family: inherit;
      }
      .fp-lock[data-locked="1"] { border-color: #d97706; background: #fffbeb; }
      .fp-lock.fp-inherited { border-style: dashed; }
      .fp-lock.fp-dirty { box-shadow: 0 0 0 3px rgba(245, 150, 10, .3); }
      /* Under-kontakt: bor i rækken inde i kortet (kan ikke ligge udenfor —
         rækken hører til kortets indhold). Stiplet ramme + amber markerer den
         som admin-UI, ikke noget forælderen ser. */
      .fp-sub {
        position: relative; width: 34px; height: 20px; flex: none; padding: 0;
        margin-right: 8px; border: none; border-radius: 999px; cursor: pointer;
        background: #d1d5db; transition: background .2s;
        -webkit-appearance: none; appearance: none;
        box-shadow: 0 0 0 2px #ffffff, 0 0 0 3px #e5e7eb;
      }
      .fp-sub::after {
        content: ''; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px;
        border-radius: 50%; background: #ffffff; box-shadow: 0 1px 2px rgba(0,0,0,.25);
        transition: transform .2s;
      }
      .fp-sub[aria-checked="true"] { background: var(--positive, #16a34a); }
      .fp-sub[aria-checked="true"]::after { transform: translateX(14px); }
      .fp-sub[aria-disabled="true"] { cursor: help; opacity: .55; }
      .fp-sub.fp-dirty { box-shadow: 0 0 0 2px #ffffff, 0 0 0 4px rgba(245,150,10,.5); }
      .fp-sub-wrap { display: flex; align-items: center; flex: none; }
      .fp-sub-off { opacity: .5; }
      .fp-none {
        width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;
        border: none; background: none; color: #cbd5e1; font-size: 15px; font-weight: 700;
        cursor: help; font-family: inherit; padding: 0;
      }
      @media (max-width: 520px) {
        .flango-preview-row { gap: 6px; }
        .flango-preview-gutter { width: 72px; gap: 5px; padding-top: 12px; }
        .fp-toggle { width: 36px; height: 21px; }
        .fp-toggle::after { width: 15px; height: 15px; }
        .fp-toggle[aria-checked="true"]::after { transform: translateX(15px); }
        .fp-lock { width: 26px; height: 21px; }
      }

      .flango-preview-pop {
        position: fixed; z-index: 2147483000; width: 268px; max-width: calc(100vw - 16px);
        background: #ffffff; color: #1f2937; border: 1px solid #e5e7eb; border-radius: 14px;
        box-shadow: 0 12px 32px rgba(15, 23, 42, .18); padding: 12px 14px;
        font-size: 12.5px; line-height: 1.45; text-align: left;
        font-family: inherit; animation: fp-pop-in .12s ease-out;
      }
      @keyframes fp-pop-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
      .flango-preview-pop .fp-pop-head {
        font-weight: 800; font-size: 12.5px; margin-bottom: 4px;
        display: flex; align-items: center; gap: 6px; color: #111827;
      }
      .flango-preview-pop .fp-pop-body { color: #374151; white-space: pre-wrap; overflow-wrap: anywhere; }
      .flango-preview-pop .fp-pop-hint { color: #6b7280; font-size: 11px; margin-top: 8px; }
      .flango-preview-pop .fp-pop-also {
        margin-top: 8px; padding-top: 8px; border-top: 1px solid #f3f4f6;
        color: #6b7280; font-size: 11px;
      }
      .flango-preview-pop .fp-pop-seg { display: flex; gap: 6px; margin: 10px 0 4px; }
      .flango-preview-pop .fp-pop-seg button {
        flex: 1; padding: 7px 8px; border-radius: 9px; border: 1.5px solid #e5e7eb;
        background: #ffffff; color: #6b7280; font-size: 11.5px; font-weight: 700;
        cursor: pointer; font-family: inherit;
      }
      .flango-preview-pop .fp-pop-seg button[aria-pressed="true"] { border-color: #d97706; background: #fffbeb; color: #92400e; }
      .flango-preview-pop .fp-pop-seg button[data-lock="0"][aria-pressed="true"] { border-color: #16a34a; background: #f0fdf4; color: #166534; }
      .flango-preview-pop .fp-pop-label { display: block; font-weight: 700; font-size: 11px; color: #374151; margin-top: 10px; }
      .flango-preview-pop textarea {
        width: 100%; box-sizing: border-box; margin-top: 5px; padding: 8px 9px;
        border: 1.5px solid #e5e7eb; border-radius: 9px; font-size: 12px;
        font-family: inherit; color: #1f2937; background: #ffffff; resize: vertical; min-height: 62px;
      }
      .flango-preview-pop textarea:focus { outline: none; border-color: #F5960A; }
      .flango-preview-pop .fp-pop-done {
        width: 100%; margin-top: 10px; padding: 8px; border: none; border-radius: 9px;
        background: #111827; color: #ffffff; font-size: 12px; font-weight: 700;
        cursor: pointer; font-family: inherit;
      }
      @media (max-width: 520px) {
        .flango-preview-pop {
          left: 8px !important; right: 8px !important; top: auto !important;
          bottom: 10px !important; width: auto; border-radius: 16px; padding: 14px 16px;
        }
      }
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

  /** Låse-tilstand for et modul. Spejler enforce_feature_locks_institutions:
   *  parent_portal og portal_sections kaskaderer KUN til portal_*-modulerne —
   *  ikke til fx sugar_policy eller allergens. UI'et må ikke påstå en lås som
   *  serveren ikke ville håndhæve. */
  function resolveLock(moduleKey) {
    if (!moduleKey) return { locked: false, reason: null, source: null };
    if (lockDraft[moduleKey]) {
      const d = lockDraft[moduleKey];
      return { locked: !!d.locked, reason: d.reason || null, source: moduleKey, draft: true };
    }
    const own = flags[moduleKey];
    if (own && own.locked === true) {
      return { locked: true, reason: own.lock_reason || null, source: moduleKey };
    }
    if (moduleKey.indexOf('portal_') === 0) {
      for (const parent of ['parent_portal', 'portal_sections']) {
        const f = flags[parent];
        if (f && f.locked === true) {
          return { locked: true, reason: f.lock_reason || null, source: parent, inherited: true };
        }
      }
    }
    return { locked: false, reason: null, source: moduleKey };
  }

  /** Sektionstitler der deler låse-modul — så superadmin kan se hvad låsen
   *  rammer. Titlerne læses af DOM'en; ingen label-dublet i dette modul. */
  function sectionElements(key) {
    return (SECTION_DOM[key] || []).map((id) => document.getElementById(id)).filter(Boolean);
  }

  function siblingTitles(moduleKey, exceptKey) {
    const out = [];
    for (const entry of sections) {
      if (!entry || entry.module !== moduleKey || entry.key === exceptKey) continue;
      const el = sectionElements(entry.key)[0];
      const title = el && el.querySelector('.section-title');
      if (!title) continue;
      const text = (title.childNodes[0] && title.childNodes[0].textContent || title.textContent || '').trim();
      if (text) out.push(text);
    }
    return out;
  }

  // ── Popover ────────────────────────────────────────────────────────────────
  // Ét popover ad gangen. Hover åbner "flygtigt" (lukker ved mouseleave), klik/
  // tap åbner "fastholdt" (lukker ved klik udenfor, Escape eller ny åbning) —
  // tooltips alene duer ikke på touch.

  let popEl = null;
  let popAnchor = null;
  let popSticky = false;

  function closePopover(force) {
    if (!popEl) return;
    if (popSticky && !force) return;
    popEl.remove();
    popEl = null;
    popAnchor = null;
    popSticky = false;
  }

  function positionPopover() {
    if (!popEl || !popAnchor || !popAnchor.isConnected) { closePopover(true); return; }
    if (window.innerWidth <= 520) return; // CSS lægger den som bundark
    const r = popAnchor.getBoundingClientRect();
    const w = popEl.offsetWidth;
    const h = popEl.offsetHeight;
    let left = r.left + r.width / 2 - w / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    let top = r.bottom + 8;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 8);
    popEl.style.left = left + 'px';
    popEl.style.top = top + 'px';
  }

  /** sticky = klik/tap (fastholdt). For superadmin åbner klik REDIGERINGEN, mens
   *  hover viser præcis det institutionen møder — så man kan kontrollere sin egen
   *  formulering uden at risikere at miste den ved et musetræk. */
  function openPopover(anchor, entry, sticky) {
    closePopover(true);
    const lock = resolveLock(entry.module);
    const el = document.createElement('div');
    el.className = 'flango-preview-pop';
    el.setAttribute('role', 'dialog');

    if (entry.kind === 'always_on') {
      el.innerHTML = '<div class="fp-pop-head">Lovpligtig</div><div class="fp-pop-body">Forælderens rettigheder efter GDPR (oplysning, indsigt, sletning) må ikke kunne skjules — og Apple kræver "slet konto" i appen. Derfor findes der ingen kontakt at slukke med.</div>';
    } else if (role === 'superadmin' && !sticky) {
      el.innerHTML = lock.locked
        ? `<div class="fp-pop-head">🔒 ${DEFAULT_LOCK_TEXT}</div>${lock.reason ? '<div class="fp-pop-body"></div>' : ''}<div class="fp-pop-also">Sådan ser institutionen den. Klik for at redigere.</div>`
        : `<div class="fp-pop-head">🔓 Åben for institutionen</div><div class="fp-pop-body">Institutionens admin kan selv slå sektionen til og fra.</div><div class="fp-pop-also">Klik for at låse.</div>`;
      const body = el.querySelector('.fp-pop-body');
      if (body && lock.locked) body.textContent = lock.reason;
    } else if (role === 'superadmin' && !lock.inherited) {
      const also = siblingTitles(entry.module, entry.key);
      el.innerHTML = `
        <div class="fp-pop-head">Adgang for institutionen</div>
        <div class="fp-pop-body">Låst = institutionens admin kan se indstillingen, men ikke ændre den.</div>
        <div class="fp-pop-seg">
          <button type="button" data-lock="0" aria-pressed="${lock.locked ? 'false' : 'true'}">Åben</button>
          <button type="button" data-lock="1" aria-pressed="${lock.locked ? 'true' : 'false'}">🔒 Låst</button>
        </div>
        <label class="fp-pop-label" for="fp-pop-reason">Forklaring til institutionen (valgfri)</label>
        <textarea id="fp-pop-reason" rows="3" placeholder="Fx: Slået fra efter aftale med kommunen"></textarea>
        <div class="fp-pop-hint">Vises for institutionens admin på den låste knap. Uden forklaring vises “${DEFAULT_LOCK_TEXT}”.</div>
        ${also.length ? `<div class="fp-pop-also">Samme lås gælder også: ${also.join(', ')}</div>` : ''}
        <button type="button" class="fp-pop-done">Færdig</button>`;
    } else if (lock.inherited) {
      el.innerHTML = `
        <div class="fp-pop-head">🔒 ${DEFAULT_LOCK_TEXT}</div>
        ${lock.reason ? `<div class="fp-pop-body"></div>` : ''}
        <div class="fp-pop-also">Arvet fra modulet “${lock.source}” — låses op der.</div>`;
      const body = el.querySelector('.fp-pop-body');
      if (body) body.textContent = lock.reason;
    } else {
      el.innerHTML = `<div class="fp-pop-head">🔒 ${DEFAULT_LOCK_TEXT}</div>${lock.reason ? '<div class="fp-pop-body"></div>' : ''}`;
      const body = el.querySelector('.fp-pop-body');
      if (body) body.textContent = lock.reason;
    }

    document.body.appendChild(el);
    popEl = el;
    popAnchor = anchor;
    popSticky = !!sticky;
    positionPopover();

    const textarea = el.querySelector('#fp-pop-reason');
    if (textarea) {
      textarea.value = lock.reason || '';
      textarea.addEventListener('input', () => {
        setLock(entry.module, resolveLock(entry.module).locked, textarea.value);
      });
    }
    el.querySelectorAll('.fp-pop-seg button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextLocked = btn.dataset.lock === '1';
        const reason = textarea ? textarea.value : resolveLock(entry.module).reason;
        setLock(entry.module, nextLocked, reason);
        el.querySelectorAll('.fp-pop-seg button').forEach((b) => {
          b.setAttribute('aria-pressed', String((b.dataset.lock === '1') === nextLocked));
        });
        decorate();
        positionPopover();
      });
    });
    const done = el.querySelector('.fp-pop-done');
    if (done) done.addEventListener('click', () => closePopover(true));
    // Rører man indholdet, må et musetræk ikke kunne lukke det igen.
    el.addEventListener('focusin', () => { popSticky = true; });
  }

  /** Skriv en lås til draft'en og meld den til værten. Draft'en er modul-keyed,
   *  så alle sektioner under samme modul opdateres i ét hug. */
  function setLock(moduleKey, locked, reason) {
    const trimmed = (reason || '').trim();
    lockDraft[moduleKey] = { locked: !!locked, reason: trimmed || null };
    post({ type: 'flango-preview:lock', module: moduleKey, locked: !!locked, reason: trimmed || null });
  }

  // ── Venstre kontrol-kolonne ────────────────────────────────────────────────
  // Kontrollerne må IKKE bo inde i sektionen — kortet skal blive ved med at være
  // præcis det forælderen ser. Hver sektion wrappes derfor i en flex-række med
  // en smal kolonne til venstre. Portalens egen markup røres ikke; wrapperen
  // genskabes af decorate() hvis portalen re-renderer sektionen.

  function gutterFor(el) {
    let row = el.parentElement;
    if (!row || !row.classList.contains('flango-preview-row')) {
      row = document.createElement('div');
      row.className = 'flango-preview-row';
      el.parentNode.insertBefore(row, el);
      row.appendChild(el);
    }
    let gutter = row.firstElementChild;
    if (!gutter || !gutter.classList.contains('flango-preview-gutter')) {
      gutter = document.createElement('div');
      gutter.className = 'flango-preview-gutter';
      row.insertBefore(gutter, el);
    }
    return gutter;
  }

  /** Sektion uden flag: vis hvorfor der ikke er en kontakt, i stedet for et
   *  tomt felt der ligner en manglende funktion. */
  function applyNoFlagSection(el) {
    const gutter = gutterFor(el);
    let mark = gutter.querySelector('.fp-none');
    if (!mark) {
      mark = document.createElement('button');
      mark.type = 'button';
      mark.className = 'fp-none';
      mark.textContent = '—';
      gutter.appendChild(mark);
    }
    mark.dataset.noflag = el.id;
  }

  function applyStateToSection(entry) {
    const els = sectionElements(entry.key);
    if (!els.length) return;

    // Lovpligtige sektioner: kontakten vises tændt og ulåselig, så fladen er
    // komplet — men der findes ingen kolonne at slukke dem med. Det er ikke et
    // hul; forælderens GDPR-rettigheder må ikke kunne skjules.
    if (entry.kind === 'always_on') {
      els.forEach((el) => {
        const gutter = gutterFor(el);
        gutter.querySelectorAll('.fp-lock, .fp-none').forEach((n) => n.remove());
        let toggle = gutter.querySelector('.fp-toggle');
        if (!toggle) {
          toggle = document.createElement('button');
          toggle.type = 'button';
          toggle.className = 'fp-toggle';
          toggle.setAttribute('role', 'switch');
          gutter.appendChild(toggle);
        }
        toggle.dataset.key = entry.key;
        toggle.setAttribute('aria-checked', 'true');
        toggle.setAttribute('aria-disabled', 'true');
        toggle.classList.remove('fp-dirty');
        toggle.setAttribute('aria-label', 'Lovpligtig — altid synlig');
      });
      return;
    }

    const isOn = entry.kind === 'capability' ? true : effectiveForKey(entry);
    const ownOn = effective(entry.column, entry.visible);
    const lock = resolveLock(entry.module);
    // Superadmin kan ændre værdien selv når modulet er låst (låsen gælder
    // institutionen, ikke Flango) — kun institutions-admin møder en låst kontakt.
    const toggleLocked = lock.locked && role !== 'superadmin';

    els.forEach((el, idx) => {
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

      const gutter = gutterFor(el);

      // Deler flere kort ét flag (fx Notifikationer + E-mail påmindelser), får
      // kun det første en kontakt — resten følger med og markeres som "samme".
      if (idx > 0) {
        gutter.querySelectorAll('.fp-toggle, .fp-lock').forEach((n) => n.remove());
        applyNoFlagSection(el);
        const mark = gutter.querySelector('.fp-none');
        if (mark) { mark.textContent = '↑'; mark.dataset.sameAs = entry.key; }
        return;
      }
      const stale = gutter.querySelector('.fp-none');
      if (stale) stale.remove();

      // INGEN listener pr. kontrol: portalen kan re-rendere sektioner via
      // HTML-serialisering, som bevarer markup men dropper listeners — klik
      // håndteres delegeret i initControlDelegation(); kontrollerne bærer kun
      // data-attributter.
      let toggle = gutter.querySelector('.fp-toggle');
      if (!toggle) {
        toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'fp-toggle';
        toggle.setAttribute('role', 'switch');
        gutter.appendChild(toggle);
      }
      toggle.dataset.key = entry.key;
      toggle.setAttribute('aria-checked', ownOn ? 'true' : 'false');
      toggle.setAttribute('aria-disabled', toggleLocked ? 'true' : 'false');
      toggle.classList.toggle('fp-dirty', draft[entry.column] !== undefined);
      toggle.setAttribute('aria-label', (toggleLocked ? 'Låst af Flango. ' : '') + (
        entry.kind === 'capability'
          ? (ownOn ? 'Forælderen kan redigere' : 'Redigering slået fra')
          : (ownOn ? 'Synlig for forældre' : 'Skjult for forældre')));

      // Låse-knap: superadmin kan altid låse/låse op; institutions-admin ser den
      // kun når sektionen ER låst (som forklaring på den døde kontakt).
      let lockBtn = gutter.querySelector('.fp-lock');
      const showLock = role === 'superadmin' || lock.locked;
      if (showLock) {
        if (!lockBtn) {
          lockBtn = document.createElement('button');
          lockBtn.type = 'button';
          lockBtn.className = 'fp-lock';
          gutter.appendChild(lockBtn);
        }
        lockBtn.dataset.key = entry.key;
        lockBtn.dataset.locked = lock.locked ? '1' : '0';
        lockBtn.classList.toggle('fp-inherited', !!lock.inherited);
        lockBtn.classList.toggle('fp-dirty', !!lock.draft);
        lockBtn.textContent = lock.locked ? '🔒' : '🔓';
        lockBtn.setAttribute('aria-label', lock.locked
          ? 'Låst for institutionen'
          : 'Institutionen kan ændre — klik for at låse');
      } else if (lockBtn) {
        lockBtn.remove();
      }
    });
  }

  /** Under-kontakter inde i kortene. Rækken findes via `data-sub="<key>"` som
   *  portalen sætter, eller — for spil — via `[data-game-id]`. Bindingen
   *  (kolonne / array-medlem / tabelrække) er en opaque `target`-streng fra
   *  serveren, så en ny binding ikke kræver ændringer i begge værter. */
  function applySubcontrol(entry) {
    let row = null;
    if (entry.row_id) {
      const input = document.querySelector('[data-game-id="' + entry.row_id + '"]');
      row = input && input.closest ? input.closest('.game-row') : null;
    } else {
      row = document.querySelector('[data-sub="' + entry.key + '"]');
    }
    if (!row) return;

    const on = subEffective(entry);
    row.classList.toggle('fp-sub-off', !on);

    const lock = resolveLock(entry.module);
    const locked = lock.locked && role !== 'superadmin';

    let wrap = row.querySelector(':scope > .fp-sub-wrap');
    if (!wrap) {
      wrap = document.createElement('span');
      wrap.className = 'fp-sub-wrap';
      row.insertBefore(wrap, row.firstChild);
    }
    let t = wrap.querySelector('.fp-sub');
    if (!t) {
      t = document.createElement('button');
      t.type = 'button';
      t.className = 'fp-sub';
      t.setAttribute('role', 'switch');
      wrap.appendChild(t);
    }
    t.dataset.sub = entry.key;
    t.setAttribute('aria-checked', on ? 'true' : 'false');
    t.setAttribute('aria-disabled', locked ? 'true' : 'false');
    t.classList.toggle('fp-dirty', draft[entry.target] !== undefined);
    t.setAttribute('aria-label', (locked ? 'Låst af Flango. ' : '')
      + (entry.label || entry.key) + (on ? ' — vises for forældre' : ' — skjult for forældre'));
  }

  function subEffective(entry) {
    return draft[entry.target] !== undefined ? draft[entry.target] : entry.visible;
  }

  function subByKey(key) {
    return subcontrols.find((s) => s && s.key === key) || null;
  }

  /** Delegeret klik: capture-fase på document, så portalens accordion-handler
   *  (bubble på document) aldrig ser klikket, og så kontrollerne overlever
   *  sektions-re-render uanset hvordan DOM'en er genopbygget. */
  function initControlDelegation() {
    document.addEventListener('click', (e) => {
      const t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('.flango-preview-pop')) return;
      const ctrl = t.closest('.fp-toggle, .fp-lock, .fp-none, .fp-sub');
      if (!ctrl) { closePopover(true); return; }
      // stopPropagation er ikke nok: accordion-handleren sidder OGSÅ på document
      // (samme node, senere fase) og ville folde sektionen ud ved klik.
      e.stopImmediatePropagation();
      e.preventDefault();

      if (ctrl.classList.contains('fp-none')) { openNoFlagPopover(ctrl, true); return; }

      if (ctrl.classList.contains('fp-sub')) {
        const sub = subByKey(ctrl.dataset.sub);
        if (!sub) return;
        if (ctrl.getAttribute('aria-disabled') === 'true') { openPopover(ctrl, sub, true); return; }
        closePopover(true);
        const next = !subEffective(sub);
        draft[sub.target] = next;
        decorate();
        post({ type: 'flango-preview:toggle', key: sub.key, target: sub.target, value: next });
        return;
      }

      const entry = sectionByKey(ctrl.dataset.key);
      if (!entry) return;
      if (ctrl.classList.contains('fp-lock')) { openPopover(ctrl, entry, true); return; }
      // Låst kontakt (institutions-admin) eller lovpligtig: forklar, ændr ikke.
      if (ctrl.getAttribute('aria-disabled') === 'true') { openPopover(ctrl, entry, true); return; }

      closePopover(true);
      const next = !effective(entry.column, entry.visible);
      draft[entry.column] = next;
      decorate();
      post({ type: 'flango-preview:toggle', key: entry.key, column: entry.column, value: next });
    }, true);

    // Hover: samme forklaring uden klik (desktop). Flygtigt popover — et
    // fastholdt (klik-åbnet) popover røres ikke.
    document.addEventListener('mouseover', (e) => {
      const ctrl = e.target && e.target.closest && e.target.closest('.fp-toggle, .fp-lock, .fp-none, .fp-sub');
      if (!ctrl || popSticky || popAnchor === ctrl) return;
      if (ctrl.classList.contains('fp-none')) { openNoFlagPopover(ctrl, false); return; }
      const explains = ctrl.classList.contains('fp-lock')
        || ctrl.getAttribute('aria-disabled') === 'true';
      if (!explains) { closePopover(); return; }
      const entry = sectionByKey(ctrl.dataset.key);
      if (!entry) return;
      openPopover(ctrl, entry, false);
    });
    document.addEventListener('mouseout', (e) => {
      if (popSticky || !popEl) return;
      const to = e.relatedTarget;
      if (to && to.closest && (to.closest('.flango-preview-pop') || to.closest('.flango-preview-gutter'))) return;
      closePopover();
    });

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePopover(true); });
    window.addEventListener('resize', positionPopover);
    window.addEventListener('scroll', positionPopover, true);
  }

  /** Forklaring på en sektion uden kontakt — så et tomt felt ikke læses som
   *  en manglende funktion. */
  function openNoFlagPopover(anchor, sticky) {
    closePopover(true);
    const el = document.createElement('div');
    el.className = 'flango-preview-pop';
    el.setAttribute('role', 'dialog');
    const sameKey = anchor.dataset.sameAs;
    let head = 'Altid synlig';
    let body;
    if (sameKey) {
      head = 'Følger sektionen ovenfor';
      const entry = sectionByKey(sameKey);
      body = 'Samme kontakt styrer begge kort' + (entry ? ' (' + entry.column + ').' : '.');
    } else {
      body = NO_FLAG_REASON[anchor.dataset.noflag] || 'Sektionen har ingen institutionsindstilling og er altid synlig.';
    }
    el.innerHTML = '<div class="fp-pop-head"></div><div class="fp-pop-body"></div>';
    el.querySelector('.fp-pop-head').textContent = head;
    el.querySelector('.fp-pop-body').textContent = body;
    document.body.appendChild(el);
    popEl = el; popAnchor = anchor; popSticky = !!sticky;
    positionPopover();
  }

  function decorate() {
    // Flag-styrede sektioner får kontakt (+ lås); ALLE andre får en forklaring
    // i samme kolonne, så kortene flugter og et tomt felt ikke ligner en fejl.
    const claimed = new Set();
    for (const entry of sections) {
      if (!entry || !SECTION_DOM[entry.key]) continue;
      SECTION_DOM[entry.key].forEach((id) => claimed.add(id));
      applyStateToSection(entry);
    }
    document.querySelectorAll('.section[id^="section-"]').forEach((el) => {
      if (!claimed.has(el.id)) applyNoFlagSection(el);
    });
    for (const sub of subcontrols) { if (sub) applySubcontrol(sub); }
    positionPopover();
  }

  function handleHostMessage(event) {
    if (!hostOrigin || event.origin !== hostOrigin) return;
    const msg = event.data;
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'flango-preview:state') {
      draft = (msg.draft && typeof msg.draft === 'object') ? { ...msg.draft } : {};
      lockDraft = (msg.lockDraft && typeof msg.lockDraft === 'object') ? { ...msg.lockDraft } : {};
      decorate();
    } else if (msg.type === 'flango-preview:saved') {
      draft = {};
      lockDraft = {};
      if (msg.flags && typeof msg.flags === 'object') flags = msg.flags;
      closePopover(true);
      if (refetchFn) refetchFn();
    }
  }

  /** Handshake: ping værten med "ready" indtil sessionen ankommer (værten kan
   *  først lytte efter iframe-load — gentagne pings er den robuste rækkefølge).
   *  Timeout → false, og portal-v2.js falder tilbage til normal login-skærm. */
  function bootstrap(opts) {
    refetchFn = opts && opts.refetch;
    const supabase = opts && opts.supabase;
    injectStyles();
    initControlDelegation();

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
        role = msg.role === 'superadmin' ? 'superadmin' : 'admin';
        flags = (msg.flags && typeof msg.flags === 'object') ? msg.flags : {};
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

  function onRender(previewSections, previewSubcontrols) {
    sections = Array.isArray(previewSections) ? previewSections : [];
    subcontrols = Array.isArray(previewSubcontrols) ? previewSubcontrols : [];
    decorate();
  }

  window.FlangoAdminPreview = { bootstrap: bootstrap, onRender: onRender };
})();
