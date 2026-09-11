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
//
// Cachenavnene begynder med appversionen, og den FORRIGE generation beholdes: GitHub Pages
// lader browseren holde index.html i ti minutter, så lige efter en udgivelse kan en enhed
// stadig åbne den gamle index, som peger på gamle hash-navne. Slettede vi den gamle cache ved
// aktivering, ville de navne hverken findes i cachen eller på serveren, og siden stod uden CSS
// og JS, til index'ens ti minutter var gået. Målt 10/9-2026 — det skete.
const IMAGE_VERSION = "3.0.308-e12d094412cbd575";
const BUNDLE_VERSION = "3.0.308-a35e45440475ed7e";
const GENERATIONS_TO_KEEP = 2;
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

/** Appversionen forrest i cachenavnet, som sorterbart tal — nyeste generation først. */
function generationRank(name, prefix) {
    const m = name.slice(prefix.length).match(/^(\d+)\.(\d+)\.(\d+)/);
    return m ? (Number(m[1]) * 1e6 + Number(m[2]) * 1e3 + Number(m[3])) : -1;
}

/** Behold den aktuelle og den forrige generation under et præfiks; slet resten. */
async function pruneGenerations(names, prefix, current) {
    const ours = names.filter((name) => name.startsWith(prefix));
    const keep = new Set([current, ...ours
        .filter((name) => name !== current)
        .sort((a, b) => generationRank(b, prefix) - generationRank(a, prefix))
        .slice(0, GENERATIONS_TO_KEEP - 1)]);
    await Promise.all(ours.filter((name) => !keep.has(name)).map((name) => caches.delete(name)));
}

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await pruneGenerations(names, IMAGE_CACHE_PREFIX, IMAGE_CACHE);
        await pruneGenerations(names, BUNDLE_CACHE_PREFIX, BUNDLE_CACHE);
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
        // Opslag på tværs af generationerne (en gammel index kan bede om gamle navne);
        // nyt indhold lægges altid i den aktuelle generation.
        const cached = await caches.match(event.request);
        if (cached) return cached;

        const response = await fetch(event.request);
        if (response.ok && response.type === 'basic') {
            const cache = await caches.open(cacheName);
            await cache.put(event.request, response.clone());
        }
        return response;
    })());
});
