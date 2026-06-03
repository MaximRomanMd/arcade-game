/* ══════════════════════════════════════════════════════
   ARCADE PORTAL — SERVICE WORKER
   Offline-ready caching for instant loads
══════════════════════════════════════════════════════ */

const CACHE_NAME = 'arcade-portal-v2';

// Files to pre-cache on install (portal shell)
const PRECACHE = [
    '/arcade-game/game-portal/index.html',
    '/arcade-game/game-portal/style.css',
    '/arcade-game/game-portal/portal.js',
    '/arcade-game/game-portal/sound-engine.js',
    '/arcade-game/game-portal/manifest.json',
    '/arcade-game/game-portal/icon.svg',
];

// Game files to cache on first visit
const GAME_PATTERNS = [
    /\/arcade-game\/Snake-Game\//,
    /\/arcade-game\/2048-game\//,
    /\/arcade-game\/void-shift\//,
    /\/arcade-game\/blob-game\//,
    /\/arcade-game\/bingo-game\//,
    /\/arcade-game\/tower-rush\//,
    /\/arcade-game\/fish-hunter\//,
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
    const isPortal    = url.pathname.includes('/game-portal/');
    const isGameFile  = GAME_PATTERNS.some(p => p.test(url.pathname));
    const isStaticAsset = /\.(css|js|svg|png|jpg|webp|woff2?|ico)$/.test(url.pathname);

    if (isHTML) {
        // Network First for HTML — always try to get fresh page
        event.respondWith(networkFirst(event.request));
    } else if (isStaticAsset && (isPortal || isGameFile)) {
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
            const portalFallback = await caches.match('/arcade-game/game-portal/index.html');
            if (portalFallback) return portalFallback;
        }
        return new Response('You are offline. Please reconnect to play.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}
