/* Flango Forældreportal — service worker.
 *
 * Formål: gør portalen installérbar (PWA) og giver en offline-skal.
 *
 * Princip: NETVÆRK-FØRST for appens egne filer, så hyppige deploys altid
 * serveres friske; cachen bruges kun som fallback når enheden er offline.
 * Alt mod Supabase / Stripe / Turnstile / Google Fonts (kryds-origin) rører
 * service workeren slet ikke — data, login og betaling går altid live.
 *
 * Bumpes CACHE ved behov; gammel cache ryddes ved activate. portal-v2.js?v=N
 * cachelagres automatisk ved runtime (ingen hårdkodet version her), så
 * cache-buster-bumpet i index.html er den eneste version der skal vedligeholdes.
 */

const CACHE = 'flango-portal-v2';

// Version-stabile skal-filer (uden ?v=N) — seedet ved install for offline-brug.
// supabase-js er nu selvhostet og kan derfor precaches (det kunne den cross-origin
// CDN-udgave ikke) — skallen er dermed først nu reelt selvforsynende.
// Selve font-FILERNE precaches bevidst ikke (14 stk./285 KB); font-display:swap gør
// at teksten renderer i en fallback indtil de er hentet og runtime-cachet.
const SHELL = [
  './',
  './index.html',
  './css/portal-v2.css',
  './css/fonts.css',
  './js/vendor/supabase-js-2.101.0.min.js',
  './js/portal-v2-api.js',
  './js/consent-texts.js',
  './js/parent-picture-upload-modal.js',
  './js/pwa-install.js',
  './assets/flango-logo.webp',
  './assets/flango-lockup-tagline.webp',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;                  // skriv-kald røres aldrig
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // Supabase/Stripe/Turnstile/fonte → altid live

  // Netværk-først: hent frisk + opdater cache; offline → fald tilbage til cache.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) =>
          cached || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())
        )
      )
  );
});
