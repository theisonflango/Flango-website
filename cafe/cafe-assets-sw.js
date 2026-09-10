// Caféens service worker: cache-first for det, der er uforanderligt af konstruktion.
//
// GitHub Pages sender `max-age=600` på alt, så efter ti minutter genvaliderer browseren hver
// eneste fil ved næste start (~50 forespørgsler, mest 304'er, men hver koster en tur). Tre slags
// filer kan aldrig ændre indhold under samme navn og må derfor tages fra cachen uden at spørge:
//   1. Vites hash-navngivne filer i assets/, inkl. fontene (navnet skifter, når indholdet gør),
//   2. de rå scripts under js/ med `?v=N` (cache-buster-kontrakten: ny fil = nyt nummer,
//      håndhævet af .githooks/pre-commit),
//   3. billederne under Icons/webp/ (statiske i repoet; cachen roteres, når de ændres).
// index.html, version.json, lyde og alt cross-origin røres ikke: det er dem, der fortæller,
// hvad der er nyt. Ved en app-opdatering afregistrerer version-check.js workeren og tømmer alle
// caches, så dette lag aldrig kan holde en ny udgave tilbage.
const IMAGE_VERSION = "e12d094412cbd575";
const BUNDLE_VERSION = "c47267a0e26d53b9";
const scopePath = new URL(self.registration.scope).pathname;
const scopeKey = scopePath.replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9_-]+/gi, '-') || 'root';
const IMAGE_CACHE_PREFIX = `flango-cafe-images-${scopeKey}-`;
const BUNDLE_CACHE_PREFIX = `flango-cafe-bundle-${scopeKey}-`;
const IMAGE_CACHE = `${IMAGE_CACHE_PREFIX}${IMAGE_VERSION}`;
const BUNDLE_CACHE = `${BUNDLE_CACHE_PREFIX}${BUNDLE_VERSION}`;
const IMAGE_PATH_PREFIX = 'Icons/webp/';
// Vites filnavne: <navn>-<8 tegn hash>.<js|css|woff2> — fontene er selvhostede (css/fonts.css)
const HASHED_ASSET = /^assets\/[^/]+-[A-Za-z0-9_-]{8}\.(?:js|css|woff2)$/;

self.addEventListener('install', () => {
    // Der pre-caches bevidst intet: kun det, enheden faktisk bruger, må koste netværk og lagerplads.
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(names
            .filter((name) =>
                (name.startsWith(IMAGE_CACHE_PREFIX) && name !== IMAGE_CACHE)
                || (name.startsWith(BUNDLE_CACHE_PREFIX) && name !== BUNDLE_CACHE))
            .map((name) => caches.delete(name)));
        await self.clients.claim();
    })());
});

/** Hvilken cache hører forespørgslen til — eller null, hvis den skal gå udenom workeren. */
function cacheFor(request) {
    if (request.method !== 'GET') return null;
    const url = new URL(request.url);
    if (url.origin !== self.location.origin || !url.pathname.startsWith(scopePath)) return null;
    const relativePath = url.pathname.slice(scopePath.length);

    if (relativePath.startsWith(IMAGE_PATH_PREFIX) && relativePath.toLowerCase().endsWith('.webp')) {
        return IMAGE_CACHE;
    }
    if (HASHED_ASSET.test(relativePath)) return BUNDLE_CACHE;
    if (relativePath.startsWith('js/') && relativePath.endsWith('.js') && url.searchParams.has('v')) {
        return BUNDLE_CACHE;
    }
    return null;
}

self.addEventListener('fetch', (event) => {
    const cacheName = cacheFor(event.request);
    if (!cacheName) return;

    event.respondWith((async () => {
        const cache = await caches.open(cacheName);
        const cached = await cache.match(event.request);
        if (cached) return cached;

        const response = await fetch(event.request);
        if (response.ok && response.type === 'basic') {
            await cache.put(event.request, response.clone());
        }
        return response;
    })());
});
