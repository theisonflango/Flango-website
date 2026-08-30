/* Flango fælles navigation — ÉT sted for hele websitets header.
 *
 * Navigationen injiceres i stedet for at stå i hver enkelt side. Det er
 * bevidst: headeren skal være identisk på tværs af undersider, og en kopi
 * pr. side driver fra hinanden i det øjeblik der kommer et produkt til.
 *
 * En side inkluderer den med:
 *   <div class="flango-nav-mount"></div>
 *   <link rel="stylesheet" href="/shared/nav.css">
 *   <script src="/shared/nav.js" defer></script>
 *
 * Den aktive fane udledes af stien, så siderne ikke skal markere sig selv.
 */
(function () {
  var LINKS = [
    { href: '/',               label: 'Forside' },
    { href: '/om-cafe/',       label: 'Café' },
    { href: '/om-skærmtid/',   label: 'Skærmtid' },
    { href: '/ugeplan/',       label: 'Ugeplan' },
    { href: '/om-forældre/',   label: 'Forældreportal' },
    { href: '/ugeplan/faellesskabet', label: 'Fællesskabet' }
  ];

  /* Login-knappen følger den side, man står på: er man på et produkts side, er
   * "Log ind" den sides eget login. Uden for produktsiderne findes der ikke ét
   * rigtigt svar, så knappen siger eksplicit hvor den fører hen. */
  var LOGINS = {
    '/om-cafe/':       { href: '/cafe',             label: 'Log ind' },
    '/om-skærmtid/':   { href: '/skærmtid/',        label: 'Log ind' },
    // Længere match end '/ugeplan/', så fællesskabets egen indgang vinder på den sti.
    '/ugeplan/faellesskabet': { href: '/ugeplan/faellesskabet/deltag', label: 'Log ind' },
    '/ugeplan/':       { href: '/ugeplan/log-ind',  label: 'Log ind' },
    '/om-forældre/':   { href: '/forældre/',        label: 'Log ind' }
  };
  var LOGIN_STANDARD = { href: '/forældre/', label: 'Forældre login' };

  var PORTAL_ICON =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>' +
    '<polyline points="10 17 15 12 10 7"></polyline>' +
    '<line x1="15" y1="12" x2="3" y2="12"></line></svg>';

  function nuvaerendeSti() {
    var path = decodeURIComponent(window.location.pathname);
    if (path.slice(-10) === 'index.html') path = path.slice(0, -10);
    if (path.slice(-1) !== '/') path += '/';
    return path;
  }

  /* Længste match vinder, så /om-skaermtid/ markerer Skærmtid — ikke Forside. */
  function laengsteMatch(stier) {
    var path = nuvaerendeSti();
    var best = null;
    stier.forEach(function (s) {
      if (s !== '/' && path.indexOf(s) === 0 && (!best || s.length > best.length)) best = s;
    });
    return best || (path === '/' ? '/' : null);
  }

  function activeHref() {
    return laengsteMatch(LINKS.map(function (l) { return l.href; }));
  }

  function login() {
    var m = laengsteMatch(Object.keys(LOGINS));
    return (m && LOGINS[m]) || LOGIN_STANDARD;
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function build(active, log) {
    var desktop = LINKS.map(function (l) {
      return '<li><a href="' + esc(l.href) + '"' + (l.href === active ? ' class="here" aria-current="page"' : '') +
        '>' + esc(l.label) + '</a></li>';
    }).join('');

    var mobile = LINKS.map(function (l) {
      return '<a href="' + esc(l.href) + '"' + (l.href === active ? ' class="here" aria-current="page"' : '') +
        '>' + esc(l.label) + '</a>';
    }).join('');

    return '' +
      '<nav class="flango-nav" role="navigation" aria-label="Hovednavigation">' +
        '<div class="flango-nav-inner">' +
          '<a href="/" class="flango-nav-logo" aria-label="Flango forside">' +
            '<img src="/shared/logos/flango-fruit.webp" alt="">flango<span>.</span></a>' +
          '<ul class="flango-nav-links">' + desktop + '</ul>' +
          '<div class="flango-nav-right">' +
            '<a href="' + esc(log.href) + '" class="flango-nav-portal">' + PORTAL_ICON + esc(log.label) + '</a>' +
          '</div>' +
          '<button class="flango-burger" aria-label="Åbn menu" aria-expanded="false" aria-controls="flangoMobileMenu">' +
            '<span></span><span></span><span></span></button>' +
        '</div>' +
        '<div class="flango-mobile-menu" id="flangoMobileMenu" role="dialog" aria-label="Mobilmenu">' +
          mobile +
          '<span class="flango-mobile-section">Log ind</span>' +
          '<a href="/forældre/">Forældreportal</a>' +
          '<a href="/skærmtid/">Skærmtid (personale)</a>' +
          '<a href="/ugeplan/log-ind">Ugeplan (personale)</a>' +
          '<a href="/ugeplan/faellesskabet/deltag">Fællesskabet</a>' +
          '<a href="/cafe">Café-app (personale)</a>' +
        '</div>' +
      '</nav>';
  }

  function init(el) {
    var mount = el || document.querySelector('.flango-nav-mount');
    if (!mount || mount.getAttribute('data-navbygget') === '1') return;
    mount.setAttribute('data-navbygget', '1');
    mount.innerHTML = build(activeHref(), login());

    var burger = mount.querySelector('.flango-burger');
    var menu = mount.querySelector('#flangoMobileMenu');
    if (!burger || !menu) return;

    var open = false;
    function setOpen(next) {
      open = next;
      burger.classList.toggle('active', open);
      burger.setAttribute('aria-expanded', String(open));
      menu.classList.toggle('open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    }

    burger.addEventListener('click', function () { setOpen(!open); });
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { setOpen(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && open) setOpen(false);
    });
    /* Menuen er kun til mobil — skifter man til desktop skal body kunne scrolle igen. */
    window.addEventListener('resize', function () {
      if (open && window.innerWidth > 900) setOpen(false);
    });
  }

  /* Apps, der renderer deres eget DOM (ugeplanen er React), har ikke noget
   * mount-punkt når scriptet kører. De kalder selv flangoNav.mount(el). */
  window.flangoNav = { mount: init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(); });
  } else {
    init();
  }
})();
