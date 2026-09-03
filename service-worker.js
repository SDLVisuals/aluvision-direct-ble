const CACHE_PREFIX = 'aluvision-direct-';
const CACHE = `${CACHE_PREFIX}v5-ota`;
const ASSETS = [
  './',
  './index.html',
  './styles.css?v=18.18.0-ota1',
  './app.js?v=18.18.0-ota1',
  './manifest.webmanifest',
  './firmware/catalog.json',
  './assets/aluvision-logo.png',
  './assets/aluvision-app-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Firmware is always fetched fresh and verified byte-for-byte in the app.
  // Never replace a failed download with an HTML/offline response.
  if (url.origin === self.location.origin && url.pathname.includes('/firmware/artifacts/')) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
  );
});
