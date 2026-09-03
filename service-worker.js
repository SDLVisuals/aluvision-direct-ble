const CACHE = 'aluvision-faithful-v18-18-3-release';
const SHELL = [
  './',
  './index.html',
  './direct_ble_ota.js',
  './direct_ble_bridge.js',
  './manifest.webmanifest',
  './assets/aluvision-logo.png',
  './assets/aluvision-app-icon.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) =>
        (key.startsWith('aluvision-faithful-') || key.startsWith('aluvision-direct-')) && key !== CACHE
      )
        .map((key) => caches.delete(key))
    ))
  ]));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // The catalogue and firmware images always come from the network. The OTA
  // layer then verifies size, SHA-256 and embedded identity before arming.
  if (url.origin === self.location.origin && url.pathname.includes('/firmware/')) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(async () => {
        // Never read a similarly named predecessor cache: only this exact
        // release may supply its own offline shell.
        const currentCache = await caches.open(CACHE);
        const cached = await currentCache.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') {
          const shell = await currentCache.match('./index.html');
          if (shell) return shell;
        }
        return new Response('Offline', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      })
  );
});
