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

  // The native iOS shell provides direct Bonjour/UDP transport. Do not start
  // the Mac HTTP bridge inside that app or it would race the native adapter.
  if (window.webkit?.messageHandlers?.aluvision) return;

  const query = new URLSearchParams(location.search || '');
  const configuredBridge = String(query.get('wifiBridge') || '').trim();
  // A public copy must never discover or select one developer's private
  // computer. The optional desktop bridge is only used on a local development
  // server, or when this browser tab explicitly supplies its bridge URL.
  const loopback = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(location.hostname);
  const privateLan = /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(location.hostname);
  const localServer = loopback || (privateLan && Boolean(location.port));
  if (!configuredBridge && !localServer) return;
  let bridgeBase = location.origin;
  if (configuredBridge) {
    try {
      const supplied = new URL(configuredBridge);
      if (!['https:', 'http:'].includes(supplied.protocol) || supplied.username || supplied.password) return;
      bridgeBase = supplied.href.replace(/\/$/, '');
    } catch (_) { return; }
  }
  let ready = false;
  let devices = [];
  let gateway = '';
  let security = {};
  let consecutiveBridgeMisses = 0;
  let consecutiveEmptyInventories = 0;
  let lastBridgeReplyAt = 0;
  let lastReceiverReplyAt = 0;
  const BRIDGE_FAILURE_LIMIT = 3;
  const BRIDGE_GRACE_MS = 15000;
  // A gateway can briefly return an empty inventory while its radio task is
  // rebuilding the ESP-NOW table.  Keep the last usable route through one
  // such sample; a genuinely empty installation still starts offline.
  const EMPTY_INVENTORY_LIMIT = 2;

  function exactRid(value) {
    const text = String(value || '').trim().toUpperCase();
    return /^[0-9A-F]{16}$/.test(text) ? text : '';
  }

  async function request(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeout || 6500);
    let reachedBridge = false;
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
      reachedBridge = true;
      const payload = await response.json();
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || `Wi-Fi-bridge antwoordde met ${response.status}`);
      }
      consecutiveBridgeMisses = 0;
      lastBridgeReplyAt = Date.now();
      return payload;
    } catch (error) {
      // A receiver/ESP-NOW NACK is not a lost Mac bridge. Only mark the
      // transport unavailable after several actual HTTP misses and never on
      // the first dropped packet while the bridge was recently healthy.
      if (!reachedBridge) {
        consecutiveBridgeMisses += 1;
        const recentlyHealthy = lastBridgeReplyAt && Date.now() - lastBridgeReplyAt < BRIDGE_GRACE_MS;
        if (consecutiveBridgeMisses >= BRIDGE_FAILURE_LIMIT && !recentlyHealthy) ready = false;
      }
      if (error?.name === 'AbortError') throw new Error('Wi-Fi-bridge antwoordde niet op tijd');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  function remember(inventory) {
    const incoming = Array.isArray(inventory?.devices) ? inventory.devices : [];
    const incomingGateway = exactRid(inventory?.gatewayRid) || exactRid(incoming[0]?.RID || incoming[0]?.rid);
    if (!incoming.length && devices.length && gateway) {
      consecutiveEmptyInventories += 1;
      const recentlyReachedReceiver = lastReceiverReplyAt && Date.now() - lastReceiverReplyAt < BRIDGE_GRACE_MS;
      if (consecutiveEmptyInventories < EMPTY_INVENTORY_LIMIT || recentlyReachedReceiver) {
        return { devices: [...devices], stale: true };
      }
    } else if (incoming.length) {
      consecutiveEmptyInventories = 0;
      lastReceiverReplyAt = Date.now();
    }
    devices = incoming;
    gateway = incomingGateway;
    // A reachable Mac bridge is not the same as a reachable receiver. Keeping
    // this true for an empty inventory made the complete app show "connected"
    // and send commands into an installation that was not actually present.
    ready = Boolean(gateway && devices.length);
    return { devices };
  }

  async function connect() {
    await request('/home-wifi-api/health', { timeout: 3000 });
    try { remember(await request('/home-wifi-api/discover')); }
    catch (_) {
      // Preserve one previously healthy receiver route through a transient
      // inventory miss, but never promote a bare Mac bridge to "connected".
      ready = Boolean(gateway && devices.length);
    }
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

  async function transact(fields, options = {}) {
    const timeout = typeof options === 'number'
      ? Number(options)
      : Number(options?.timeout || options?.timeoutMs || 3200);
    const payload = await request('/home-wifi-api/transact', {
      method: 'POST', body: { fields }, timeout: Math.max(900, timeout + 250)
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
    managesOperationTimeouts: true,
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
      inventoryStale: consecutiveEmptyInventories > 0,
      homeWifiTest: true,
      securityConfigured: Boolean(security.compatibilityKey)
    })
  });

  function customerCopy(nl, en, fr, de) {
    try { return typeof window.ac === 'function' ? window.ac(nl, en, fr, de) : nl; }
    catch (_) { return nl; }
  }

  function safeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function setReceiverTarget(target) {
    try {
      receiverAddTarget = target ? {
        zoneId: String(target.zoneId || ''),
        groupId: String(target.groupId || ''),
        deviceId: ''
      } : null;
      receiverMoveContext = null;
    } catch (_) {
      // Older static exports do not expose the direct-to-group helper. Pairing
      // still works and the normal wizard asks for the destination instead.
    }
  }

  function homeWifiReceiverModal(target = null) {
    setReceiverTarget(target);
    let destination = null;
    try {
      destination = target && typeof receiverGroupTarget === 'function'
        ? receiverGroupTarget(target.zoneId, target.groupId) : null;
    } catch (_) {}
    const destinationMarkup = destination ? `
      <div class="group-pair-target"><span><b>${customerCopy('Wordt toegevoegd aan', 'Will be added to', 'Sera ajouté à', 'Wird hinzugefügt zu')}</b><small>${safeHtml(destination.zone.name)} → ${safeHtml(destination.group.name)}</small></span><span class="scope">${customerCopy('AL GEKOZEN', 'PRESELECTED', 'PRÉSÉLECTIONNÉ', 'VORAUSGEWÄHLT')}</span></div>` : '';
    window.modal(`<section class="v20-private-pair" data-preserve-transport-copy>
      <div class="eyebrow">${customerCopy('RECEIVER TOEVOEGEN', 'ADD RECEIVER', 'AJOUTER UN RÉCEPTEUR', 'RECEIVER HINZUFÜGEN')}</div>
      <h1>${customerCopy('Receiver zoeken', 'Find receiver', 'Rechercher le récepteur', 'Receiver suchen')}</h1>
      <p class="sub">${customerCopy('Zet de receiver aan. De app vindt hem automatisch via de privéverbinding van je installatie.', 'Power on the receiver. The app finds it automatically through your installation’s private connection.', 'Allumez le récepteur. L’app le trouve automatiquement via la connexion privée de votre installation.', 'Schalte den Receiver ein. Die App findet ihn automatisch über die private Verbindung deiner Installation.')}</p>
      ${destinationMarkup}
      <div class="v20-pair-visual" aria-hidden="true"><div class="v20-phone-glyph"><i>APP</i></div><div class="v20-pair-waves"><i></i><i></i><i></i></div><div class="v20-hub-glyph"><b>R</b><small>PRIVÉ</small></div></div>
      <div class="v20-pair-steps"><span class="done"><i>✓</i><b>${customerCopy('App geopend', 'App open', 'App ouverte', 'App geöffnet')}</b></span><span class="on"><i>2</i><b>${customerCopy('Automatisch zoeken', 'Automatic search', 'Recherche auto', 'Automatisch suchen')}</b></span><span><i>3</i><b>${customerCopy('LED Line instellen', 'Set up LED Line', 'Configurer', 'LED Line einrichten')}</b></span></div>
      <div id="receiverNfcStatus" class="nfc-status"><span><b>${customerCopy('Klaar om te zoeken', 'Ready to search', 'Prêt à rechercher', 'Bereit zur Suche')}</b><small>${customerCopy('De eerste receiver wordt rechtstreeks gevonden; volgende receivers via de hoofdreceiver.', 'The first receiver is found directly; additional receivers are found through the main receiver.', 'Le premier récepteur est trouvé directement ; les suivants via le récepteur principal.', 'Der erste Receiver wird direkt gefunden, weitere über den Haupt-Receiver.')}</small></span></div>
      <div class="v20-pair-actions"><button class="button soft" type="button" onclick="closeModal()">${customerCopy('Annuleren', 'Cancel', 'Annuler', 'Abbrechen')}</button><button class="button" type="button" onclick="pairNfcReceiver()">${customerCopy('Receiver zoeken', 'Find receiver', 'Rechercher', 'Receiver suchen')}</button></div>
    </section>`);
  }

  function simplifyReceiverModal() {
    const root = document.getElementById('modalBody');
    if (!root) return;
    const eyebrow = root.querySelector('.eyebrow');
    const heading = root.querySelector('h1');
    const intro = heading?.nextElementSibling;
    if (eyebrow) eyebrow.textContent = customerCopy('RECEIVER TOEVOEGEN', 'ADD RECEIVER', 'AJOUTER UN RECEIVER', 'RECEIVER HINZUFÜGEN');
    if (heading) heading.textContent = customerCopy('Receiver zoeken', 'Find receiver', 'Rechercher le receiver', 'Receiver suchen');
    if (intro?.classList.contains('sub')) intro.textContent = customerCopy(
      'Zet de receiver aan. De app vindt hem automatisch via de privéverbinding van je installatie.',
      'Power on the receiver. The app finds it automatically through your installation’s private connection.',
      'Allumez le receiver. L’app le trouve automatiquement via la connexion privée de votre installation.',
      'Schalte den Receiver ein. Die App findet ihn automatisch über die private Verbindung deiner Installation.'
    );
    const visual = root.querySelector('.tap-visual');
    if (visual) visual.innerHTML = '<span class="tap-wave"></span><span class="tap-wave"></span><div class="tap-device">APP<br><small>PRIVÉ</small></div>';
    const steps = root.querySelector('.nfc-pair-steps');
    if (steps) steps.innerHTML = `
      <div class="nfc-pair-step"><b>1 · ${customerCopy('Receiver aan', 'Receiver on', 'Receiver allumé', 'Receiver an')}</b><small>${customerCopy('Wacht tot de opstarttest klaar is.', 'Wait for startup to finish.', 'Attendez la fin du démarrage.', 'Warte, bis der Start beendet ist.')}</small></div>
      <div class="nfc-pair-step"><b>2 · ${customerCopy('Automatisch zoeken', 'Automatic search', 'Recherche auto', 'Automatisch suchen')}</b><small>${customerCopy('De app gebruikt de privéverbinding van je installatie.', 'The app uses your installation’s private connection.', 'L’app utilise la connexion privée de votre installation.', 'Die App nutzt die private Verbindung deiner Installation.')}</small></div>
      <div class="nfc-pair-step"><b>3 · ${customerCopy('LED Line instellen', 'Set up LED Line', 'Configurer la LED Line', 'LED Line einrichten')}</b><small>${customerCopy('Kies daarna pixels, aansluitkant en groep.', 'Then choose pixels, connection side and group.', 'Choisissez ensuite les pixels, le côté et le groupe.', 'Wähle danach Pixel, Anschlussseite und Gruppe.')}</small></div>`;
    const status = root.querySelector('#receiverNfcStatus');
    if (status && !status.classList.contains('scanning')) {
      status.className = 'nfc-status';
      status.innerHTML = `<span><b>${customerCopy('Klaar om te zoeken', 'Ready to search', 'Prêt à rechercher', 'Bereit zur Suche')}</b><small>${customerCopy('De eerste receiver wordt rechtstreeks gevonden; volgende receivers via de hoofdreceiver.', 'The first receiver is found directly; additional receivers are found through the main receiver.', 'Le premier récepteur est trouvé directement ; les suivants via le récepteur principal.', 'Der erste Receiver wird direkt gefunden, weitere über den Haupt-Receiver.')}</small></span>`;
    }
    root.querySelectorAll('button').forEach((button) => {
      const action = button.getAttribute('onclick') || '';
      if (action.includes('pairBluetoothTestReceiver')) button.remove();
      if (action.includes('pairNfcReceiver')) {
        button.classList.remove('soft');
        button.classList.add('green');
        button.textContent = customerCopy('Receiver zoeken', 'Find receiver', 'Rechercher', 'Receiver suchen');
      }
    });
  }

  // The full app is parsed after this transport file. Wrap only after load so
  // every V20 visual/UX override is already installed, then simplify its
  // temporary home-Wi-Fi pairing copy without altering the setup wizard.
  window.addEventListener('load', () => {
    const pairNow = window.pairNfcReceiver;
    // v20_candidate installs the future private-AP commission flow after this
    // file is parsed. Reclaim the two entry points at load time for the explicit
    // home-Wi-Fi test build, otherwise the customer is sent to 192.168.4.1 and
    // the already-networked receivers can never be selected.
    window.openAddReceiver = function () { return homeWifiReceiverModal(); };
    window.openAddReceiverForGroup = function () {
      try {
        if (!zone || !group) return window.toast?.(customerCopy('Open eerst een groep', 'Open a group first', 'Ouvrez d’abord un groupe', 'Öffne zuerst eine Gruppe'));
        return homeWifiReceiverModal({ zoneId: zone.id, groupId: group.id });
      } catch (_) {
        return homeWifiReceiverModal();
      }
    };
    if (typeof pairNow === 'function') {
      window.pairNfcReceiver = async function (...args) {
        const status = document.getElementById('receiverNfcStatus');
        if (status) {
          status.className = 'nfc-status scanning';
          status.innerHTML = `<span><b>${customerCopy('Receivers zoeken…', 'Searching for receivers…', 'Recherche des receivers…', 'Receiver werden gesucht…')}</b><small>${customerCopy('Even geduld; de app controleert de privéverbinding van je installatie.', 'Please wait; the app is checking your installation’s private connection.', 'Veuillez patienter ; l’app vérifie la connexion privée de votre installation.', 'Bitte warten; die App prüft die private Verbindung deiner Installation.')}</small></span>`;
        }
        const result = await pairNow.apply(this, args);
        const current = document.getElementById('receiverNfcStatus');
        if (current?.classList.contains('error')) {
          current.innerHTML = `<span><b>${customerCopy('Geen receiver gevonden', 'No receiver found', 'Aucun receiver trouvé', 'Kein Receiver gefunden')}</b><small>${customerCopy('Controleer of de receiver aanstaat en binnen bereik is, en probeer opnieuw.', 'Check that the receiver is powered on and within range, then try again.', 'Vérifiez que le récepteur est allumé et à portée, puis réessayez.', 'Prüfe, ob der Receiver eingeschaltet und in Reichweite ist, und versuche es erneut.')}</small></span>`;
        }
        return result;
      };
    }
  }, { once: true });

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
