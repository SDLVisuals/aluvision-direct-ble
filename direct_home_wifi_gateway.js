/*
 * Aluvision home-Wi-Fi test transport
 *
 * The browser cannot send UDP itself.  This adapter talks to the tiny local
 * Aluvision bridge on the Mac; that bridge forwards the unchanged V18 text
 * protocol to receivers on UDP 4210.  It deliberately replaces only the
 * transport adapter, so the complete V20 interface stays identical.
 */
(() => {
  'use strict';

  const query = new URLSearchParams(location.search || '');
  const configuredBridge = String(query.get('wifiBridge') || '').trim();
  const githubBridge = 'https://macbook-pro-van-seppe.tail3c3b38.ts.net';
  const bridgeBase = configuredBridge.replace(/\/$/, '') ||
    (location.hostname === 'sdlvisuals.github.io' ? githubBridge : location.origin);
  let ready = false;
  let devices = [];
  let gateway = '';
  let security = {};

  function exactRid(value) {
    const text = String(value || '').trim().toUpperCase();
    return /^[0-9A-F]{16}$/.test(text) ? text : '';
  }

  async function request(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeout || 6500);
    try {
      const response = await fetch(`${bridgeBase}${path}`, {
        method: options.method || 'GET',
        cache: 'no-store',
        credentials: 'omit',
        mode: 'cors',
        headers: options.body ? { 'Content-Type': 'application/json' } : {},
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal
      });
      const payload = await response.json();
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || `Wi-Fi-bridge antwoordde met ${response.status}`);
      }
      return payload;
    } catch (error) {
      ready = false;
      if (error?.name === 'AbortError') throw new Error('Wi-Fi-bridge antwoordde niet op tijd');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  function remember(inventory) {
    devices = Array.isArray(inventory?.devices) ? inventory.devices : [];
    gateway = exactRid(inventory?.gatewayRid) || exactRid(devices[0]?.RID || devices[0]?.rid);
    ready = true;
    return { devices };
  }

  async function connect() {
    const health = await request('/home-wifi-api/health', { timeout: 3000 });
    ready = Boolean(health.ok);
    try { remember(await request('/home-wifi-api/discover')); } catch (_) {}
    return ready;
  }

  async function discover() {
    return remember(await request('/home-wifi-api/discover'));
  }

  async function pair(payload = {}) {
    const inventory = await discover();
    if (!inventory.devices.length) {
      throw new Error('Geen receiver gevonden op dit Wi-Fi-netwerk');
    }
    const requestedNumber = Math.max(1, Math.min(250, Number(payload.number) || 1));
    const sorted = [...inventory.devices].sort((left, right) =>
      String(left.HWID || left.hardwareId || '').localeCompare(String(right.HWID || right.hardwareId || ''))
    );
    const unclaimed = sorted.filter((device) => {
      const rid = exactRid(device.RID || device.rid);
      try {
        const bridge = window.AluvisionDirectBridge;
        return !bridge?.receivers?.some((record) => exactRid(record.rid) === rid);
      } catch (_) { return true; }
    });
    const selected = unclaimed[0] || sorted[(requestedNumber - 1) % sorted.length];
    const rid = exactRid(selected.RID || selected.rid);
    return { ...selected, NUMBER: requestedNumber, gateway: rid === gateway, gatewayRid: gateway || rid };
  }

  async function transact(fields, timeout = 3200) {
    const payload = await request('/home-wifi-api/transact', {
      method: 'POST', body: { fields }, timeout: Math.max(2200, Number(timeout) + 900)
    });
    return payload.fields || payload.reply || payload;
  }

  function configureSecurity(next = {}) {
    security = {
      compatibilityKey: String(next.compatibilityKey || ''),
      publicTag: String(next.publicTag || '')
    };
    return true;
  }

  const adapter = Object.freeze({
    supportsConcurrentFanout: true,
    supportsOta: false,
    isReady: () => ready,
    connect,
    discover,
    pair,
    transact,
    configureSecurity,
    gatewayRid: () => gateway,
    getConnectionDetails: () => Object.freeze({
      base: bridgeBase,
      ready,
      receiverCount: devices.length,
      homeWifiTest: true,
      securityConfigured: Boolean(security.compatibilityKey)
    })
  });

  const registry = window.AluvisionTransportRegistry;
  if (!registry || typeof registry.register !== 'function') {
    throw new Error('Aluvision transportregister ontbreekt');
  }
  // direct_wifi_gateway.js registers the future private receiver AP first.
  // Registering with the same stable name makes this explicit test adapter the
  // active implementation without changing any page or command code.
  registry.register('wifi-ap', adapter);
  Object.defineProperty(window, 'AluvisionHomeWifi', {
    configurable: false,
    enumerable: false,
    writable: false,
    value: adapter
  });
})();
