// TruckSim service worker: caches the app shell so the installed PWA opens
// instantly and offline. API and WebSocket traffic is never cached.
const CACHE = 'trucksim-shell-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg', '/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname === '/ws') return;
  // Hashed build assets: cache first. Pages: network first, cache as fallback.
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })),
    );
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && e.request.mode === 'navigate') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/index.html', copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match('/index.html'))),
  );
});
