/* ══════════════════════════════════════════════════════
   ARCADE PORTAL — SERVICE WORKER
   Offline-ready caching for instant loads
══════════════════════════════════════════════════════ */

const CACHE_NAME = 'arcade-portal-v3';

// Files to pre-cache on install (portal shell) — served at the site root
const PRECACHE = [
    '/',
    '/style.css',
    '/portal.js',
    '/sound-engine.js',
    '/manifest.json',
    '/icon.svg',
];

// ── INSTALL: pre-cache portal shell ──────────────────
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE))
            .then(() => self.skipWaiting())
    );
});

// ── ACTIVATE: remove old caches ──────────────────────
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

// ── FETCH: cache strategy ────────────────────────────
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Only handle GET requests for our origin
    if (event.request.method !== 'GET') return;
    if (!url.origin.includes('github.io') && !url.hostname === 'localhost') return;

    const isHTML      = event.request.headers.get('accept')?.includes('text/html');
    const isStaticAsset = /\.(css|js|svg|png|jpg|webp|woff2?|ico)$/.test(url.pathname);

    if (isHTML) {
        // Network First for HTML — always try to get fresh page
        event.respondWith(networkFirst(event.request));
    } else if (isStaticAsset) {
        // Cache First for static assets (CSS, JS, images)
        event.respondWith(cacheFirst(event.request));
    } else {
        // Default: network with cache fallback
        event.respondWith(networkFirst(event.request));
    }
});

// Cache First: serve from cache, fetch & update in background
async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
        const fresh = await fetch(request);
        if (fresh.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, fresh.clone());
        }
        return fresh;
    } catch {
        return new Response('Offline', { status: 503 });
    }
}

// Network First: try network, fall back to cache
async function networkFirst(request) {
    try {
        const fresh = await fetch(request);
        if (fresh.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, fresh.clone());
        }
        return fresh;
    } catch {
        const cached = await caches.match(request);
        if (cached) return cached;
        // Offline fallback for HTML
        if (request.headers.get('accept')?.includes('text/html')) {
            const portalFallback = await caches.match('/');
            if (portalFallback) return portalFallback;
        }
        return new Response('You are offline. Please reconnect to play.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}
