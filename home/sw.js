/* ABYSS HUNTER — service worker
   Scope "/" (served from the site root). Precaches the app shell and runtime-
   caches game sprites so repeat visits are instant and the game works offline. */
const CACHE = 'abyss-v1';
const PRECACHE = [
  '/', '/play/', '/play/game.js', '/play/style.css',
  '/manifest.json', '/assets/logo.png', '/assets/icon-192.png', '/assets/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // Images change rarely → cache-first (instant, offline). HTML/JS/CSS →
  // network-first so they stay fresh online but still work offline.
  if (/\.(png|jpg|jpeg|webp|svg|ico)$/.test(url.pathname)) e.respondWith(cacheFirst(req));
  else e.respondWith(networkFirst(req));
});

async function cacheFirst(req){
  const hit = await caches.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
    return res;
  } catch (_) { return new Response('', { status: 504 }); }
}

async function networkFirst(req){
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
    return res;
  } catch (_) {
    const hit = await caches.match(req);
    if (hit) return hit;
    if (req.headers.get('accept')?.includes('text/html')) {
      const shell = await caches.match('/play/') || await caches.match('/');
      if (shell) return shell;
    }
    return new Response('You are offline.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}
