/* Migration only: retire the previous Aluvision Pages offline shell.
 * This is not an alternate app and does not cache credentials or firmware.
 * The current WebApp assets are served unchanged from the Xcode source tree.
 */
'use strict';
const retiredAluvisionCaches = [
  'aluvision-faithful-', 'aluvision-direct-', 'aluvision-hardware-',
  'aluvision-v20-', 'aluvision-v21-'
];
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => retiredAluvisionCaches.some(prefix => name.startsWith(prefix)))
      .map(name => caches.delete(name)));
    await self.clients.claim();
    await self.registration.unregister();
  })());
});
// Deliberately no fetch handler: no previous app shell can be substituted for
// the new app and no private receiver requests are intercepted or stored.
