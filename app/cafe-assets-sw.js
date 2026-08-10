const ASSET_VERSION = "ba7813dc04ec7acc";
const scopePath = new URL(self.registration.scope).pathname;
const scopeKey = scopePath.replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9_-]+/gi, '-') || 'root';
const CACHE_PREFIX = `flango-cafe-images-${scopeKey}-`;
const CACHE_NAME = `${CACHE_PREFIX}${ASSET_VERSION}`;
const CACHEABLE_PATHS = [
    'Icons/webp/Avatar/v2/',
    'Icons/webp/Badge/',
];

self.addEventListener('install', () => {
    // Der pre-caches bevidst intet: kun billeder, barnet faktisk ser, må bruge
    // netværk og lagerplads.
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(names
            .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
            .map((name) => caches.delete(name)));
        await self.clients.claim();
    })());
});

function isCacheableImage(request) {
    if (request.method !== 'GET') return false;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin || !url.pathname.startsWith(scopePath)) return false;

    const relativePath = url.pathname.slice(scopePath.length);
    return relativePath.toLowerCase().endsWith('.webp')
        && CACHEABLE_PATHS.some((prefix) => relativePath.startsWith(prefix));
}

self.addEventListener('fetch', (event) => {
    if (!isCacheableImage(event.request)) return;

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(event.request);
        if (cached) return cached;

        const response = await fetch(event.request);
        if (response.ok) {
            await cache.put(event.request, response.clone());
        }
        return response;
    })());
});
