// Bump this key whenever cache policy changes. In particular, the previous
// cache could contain a navigation Request whose NFC query parameters were part
// of the CacheStorage key. Activating this worker removes that cache wholesale.
const CACHE = 'aluvision-v20-20-0-0-shell-v12';
const SHELL = [
  './index.html',
  './direct_ble_ota.js',
  './direct_ble_bridge.js',
  './direct_wifi_gateway.js',
  './v20_candidate.js',
  './v20_visual_polish.js',
  './v20_customer_palette.js',
  './v20_accountless_recovery.js',
  './v20_ui_fixes.js',
  './v20_icon_system.js',
  './v20_studio_console.js',
  './v20_studio_pro.js',
  './manifest.webmanifest',
  './assets/aluvision-logo.png',
  './assets/aluvision-app-icon.png',
  './assets/apple-touch-icon.png',
  './assets/aluvision-icon-192.png',
  './assets/aluvision-icon-512.png',
  './assets/aluvision-icon-maskable-192.png',
  './assets/aluvision-icon-maskable-512.png',
  './assets/aluvision-icon-monochrome.png',
  './assets/favicon-light.png',
  './assets/favicon-dark.png'
];

const SCOPE = self.registration.scope;
const NAVIGATION_SHELL_URL = new URL('./index.html', SCOPE).href;
const SHELL_URLS = new Set(SHELL.map((entry) => {
  const url = new URL(entry, SCOPE);
  url.search = '';
  url.hash = '';
  return url.href;
}));

function cleanShellRequest(url) {
  // Construct a new Request rather than cloning the browser Request. This
  // deliberately drops NFC query/fragment data, bearer headers, cookies and a
  // potentially secret-bearing referrer before either fetch or CacheStorage.
  return new Request(url, {
    method: 'GET',
    credentials: 'omit',
    redirect: 'follow',
    referrer: '',
    referrerPolicy: 'no-referrer'
  });
}

function shellUrlFor(request) {
  const requested = new URL(request.url);
  if (requested.origin !== self.location.origin) return null;

  // Every in-scope navigation is the same application shell. Never let an NFC
  // URL such as ?i=...&t=...&s=...&p=...&k=... become a cache key.
  if (request.mode === 'navigate') return NAVIGATION_SHELL_URL;

  requested.search = '';
  requested.hash = '';
  return SHELL_URLS.has(requested.href) ? requested.href : null;
}

async function pruneUnexpectedShellEntries() {
  const cache = await caches.open(CACHE);
  const requests = await cache.keys();
  await Promise.all(requests.map((request) => {
    const url = new URL(request.url);
    const isCleanAllowlistedShell = request.method === 'GET' &&
      !url.search && !url.hash && SHELL_URLS.has(url.href);
    return isCleanAllowlistedShell ? false : cache.delete(request);
  }));
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) =>
    cache.addAll(SHELL.map((entry) =>
      cleanShellRequest(new URL(entry, SCOPE).href)
    ))
  ));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) =>
        (key.startsWith('aluvision-faithful-') || key.startsWith('aluvision-direct-') || key.startsWith('aluvision-hardware-') || key.startsWith('aluvision-v20-')) && key !== CACHE
      )
        .map((key) => caches.delete(key))
    )),
    pruneUnexpectedShellEntries()
  ]));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // The catalogue and firmware images always come from the network. The OTA
  // layer then verifies size, SHA-256 and embedded identity before arming.
  if (url.pathname.includes('/firmware/')) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }

  const shellUrl = shellUrlFor(event.request);
  if (!shellUrl) {
    // Same-origin API and future non-shell resources remain network-only. This
    // guarantees that CacheStorage contains exactly the public SHELL allowlist.
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }

  const shellRequest = cleanShellRequest(shellUrl);
  event.respondWith(
    fetch(shellRequest, { cache: 'no-store' })
      .then(async (response) => {
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(shellRequest, response.clone());
        }
        return response;
      })
      .catch(async () => {
        // Never read a similarly named predecessor cache: only this exact
        // release may supply its own offline shell.
        const currentCache = await caches.open(CACHE);
        const cached = await currentCache.match(shellRequest);
        if (cached) return cached;
        return new Response('Offline', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      })
  );
});
