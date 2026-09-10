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
  if (window.AluvisionInstallationProfiles?.startupBlocked) return;

  // The native iOS shell provides direct Bonjour/UDP transport. Do not start
  // the Mac HTTP bridge inside that app or it would race the native adapter.
  if (window.webkit?.messageHandlers?.aluvision) return;

  const query = new URLSearchParams(location.search || '');
  const configuredBridge = String(query.get('wifiBridge') || '').trim();
  // A public copy must never automatically contact a private developer bridge.
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
  let connectionGeneration = 0;
  let pairOperation = null;
  let commandSequence = Math.floor(Date.now() % 900000000) || 1;
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

  function cancelled() {
    return Object.assign(new Error(customerCopy('Toevoegen geannuleerd.', 'Adding cancelled.', 'Ajout annulé.', 'Hinzufügen abgebrochen.')), { code: 'IDENTIFY_CANCELLED' });
  }

  function nextCommandId() { commandSequence = (commandSequence + 1) % 2147483000 || 1; return commandSequence; }

  function knownReceivers() {
    const stored = window.AluvisionDirectBridge?.receivers;
    const records = Array.isArray(stored) ? stored : stored && typeof stored === 'object' ? Object.values(stored) : [];
    const configured = typeof db !== 'undefined' && Array.isArray(db?.devices) ? db.devices : [];
    const keys = !Array.isArray(stored) && stored && typeof stored === 'object' ? Object.keys(stored).map(exactRid) : [];
    return new Set([...keys, ...[...records, ...configured].map(item => exactRid(item?.rid || item?.RID))].filter(Boolean));
  }

  function availableReceiver(device) {
    const online = device?.ONLINE ?? device?.online;
    return Boolean(exactRid(device?.RID || device?.rid)) && ![false, 0, '0', 'false'].includes(online) &&
      ![true, 1, '1', 'true'].includes(device?.IDENTITYCONFLICT ?? device?.identityConflict);
  }

  async function request(path, options = {}) {
    if (options.signal?.aborted) throw cancelled();
    const controller = new AbortController();
    const abort = () => controller.abort();
    options.signal?.addEventListener('abort', abort, { once: true });
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
      if (options.signal?.aborted) throw cancelled();
      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || `Wi-Fi-bridge antwoordde met ${response.status}`);
      }
      consecutiveBridgeMisses = 0;
      lastBridgeReplyAt = Date.now();
      return payload;
    } catch (error) {
      if (options.signal?.aborted) throw cancelled();
      // A receiver/ESP-NOW NACK is not a lost Mac bridge. Only mark the
      // transport unavailable after several actual HTTP misses and never on
      // the first dropped packet while the bridge was recently healthy.
      if (!reachedBridge) {
        consecutiveBridgeMisses += 1;
        const recentlyHealthy = lastBridgeReplyAt && Date.now() - lastBridgeReplyAt < BRIDGE_GRACE_MS;
        if (consecutiveBridgeMisses >= BRIDGE_FAILURE_LIMIT && !recentlyHealthy) {
          if (ready) connectionGeneration++;
          ready = false;
        }
      }
      if (error?.name === 'AbortError') throw new Error('Wi-Fi-bridge antwoordde niet op tijd');
      throw error;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
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
    const wasReady = ready, oldGateway = gateway;
    devices = incoming;
    gateway = incomingGateway;
    // A reachable Mac bridge is not the same as a reachable receiver. Keeping
    // this true for an empty inventory made the complete app show "connected"
    // and send commands into an installation that was not actually present.
    ready = Boolean(gateway && devices.length);
    if (wasReady !== ready || oldGateway !== gateway) connectionGeneration++;
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

  function chooseReceiver(candidates, isCurrent, cancelSelection) {
    if (typeof window.modal !== 'function') throw new Error('Open Receiver toevoegen opnieuw om een receiver te kiezen.');
    return new Promise((resolve, reject) => {
      let finished = false, observer, guard, timeout, root;
      function ownsPanel() { return Boolean(root?.isConnected && !document.getElementById('modal')?.hidden); }
      function finish(rid) {
        if (finished) {
          if (!rid) { cancelSelection(); if (ownsPanel()) window.closeModal?.(); }
          return;
        }
        finished = true; observer?.disconnect(); clearInterval(guard); clearTimeout(timeout);
        if (rid && isCurrent() && ownsPanel()) {
          root.querySelectorAll('[data-home-wifi-add]').forEach(button => { button.disabled = true; });
          resolve(rid);
        }
        else { if (ownsPanel()) window.closeModal?.(); reject(cancelled()); }
      }
      window.modal(`<section data-home-wifi-receiver-choice><div class="eyebrow">${customerCopy('RECEIVER TOEVOEGEN', 'ADD RECEIVER', 'AJOUTER UN RÉCEPTEUR', 'RECEIVER HINZUFÜGEN')}</div><h1>${customerCopy('Welke receiver?', 'Which receiver?', 'Quel récepteur ?', 'Welcher Receiver?')}</h1><p class="sub">${customerCopy('Kies Toevoegen. Alleen die receiver laat zijn LED Line knipperen.', 'Choose Add. Only that receiver flashes its LED Line.', 'Choisissez Ajouter. Seul ce récepteur fait clignoter sa LED Line.', 'Wähle Hinzufügen. Nur dieser Receiver lässt seine LED Line blinken.')}</p><div class="native-receiver-candidates">${candidates.map((item, index) => {
        const rid = exactRid(item.RID || item.rid);
        const family = String(item.DEVTYPE || item.receiverType || '').toUpperCase() === 'RGBW' ? 'RGBW' : 'SPI';
        const name = item.NAME || item.name || `${family} Receiver ${index + 1}`;
        return `<div class="row" style="gap:12px;padding:12px 0;border-bottom:1px solid var(--line)"><span><b>${safeHtml(name)}</b><small class="sub" style="display:block">${family} · ${safeHtml(rid.slice(-4))}</small></span><button class="button" type="button" data-home-wifi-add="${rid}">${customerCopy('Toevoegen', 'Add', 'Ajouter', 'Hinzufügen')}</button></div>`;
      }).join('')}</div><button class="button soft" type="button" data-home-wifi-cancel>${customerCopy('Annuleren', 'Cancel', 'Annuler', 'Abbrechen')}</button></section>`);
      root = document.querySelector('[data-home-wifi-receiver-choice]');
      if (!root) { finish(''); return; }
      root.querySelectorAll('[data-home-wifi-add]').forEach(button => button.addEventListener('click', () => finish(button.dataset.homeWifiAdd)));
      root.querySelector('[data-home-wifi-cancel]').addEventListener('click', () => finish(''));
      const check = () => { if (!isCurrent() || !ownsPanel()) finish(''); };
      observer = new MutationObserver(check);
      observer.observe(document.getElementById('modal'), { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
      guard = setInterval(check, 250);
      timeout = setTimeout(() => finish(''), 60000);
    });
  }

  async function assertOwnership(rid, key, isCurrent) {
    const id = nextCommandId();
    const reply = await transact({ V: 18, ID: id, TYPE: 'SECURITY_STATUS', TARGET: rid, KEY: key });
    if (!isCurrent()) throw cancelled();
    if (String(reply.ID) !== String(id) || exactRid(reply.RID) !== rid ||
        (reply.TARGETRID && exactRid(reply.TARGETRID) !== rid) || reply.STATUS !== 'OK' ||
        reply.DETAIL !== 'SECURITY_STATUS' || String(reply.SECURITY) !== '1' ||
        !['0', '1'].includes(String(reply.PINSET)) || !['0', '1'].includes(String(reply.OWNED)) ||
        !['0', '1'].includes(String(reply.OWNERMATCH))) {
      throw new Error(customerCopy('Deze lokale testverbinding kan de eigenaar niet veilig controleren. Gebruik de actuele receiver-app om toe te voegen of met je installatie-PIN te herstellen.', 'This local test connection cannot verify ownership. Use the current receiver app to add or restore with your installation PIN.', 'Cette connexion locale ne peut pas vérifier le propriétaire. Utilisez l’app actuelle et votre PIN.', 'Diese lokale Testverbindung kann den Eigentümer nicht prüfen. Nutze die aktuelle App und deine Installations-PIN.'));
    }
    if ((String(reply.OWNED) === '1' || String(reply.PINSET) === '1') && String(reply.OWNERMATCH) !== '1') {
      throw new Error(customerCopy('Deze receiver hoort bij een bestaande installatie. Herstel eerst met de installatie-PIN in de receiver-app; deze testverbinding kan die toegang niet overnemen.', 'This receiver belongs to an existing installation. Restore access using its PIN in the receiver app; this test connection cannot take it over.', 'Ce récepteur appartient à une installation existante. Restaurez l’accès avec son PIN dans l’app.', 'Dieser Receiver gehört zu einer bestehenden Installation. Stelle den Zugriff mit deren PIN in der App wieder her.'));
    }
  }

  async function pair(payload = {}) {
    if (pairOperation) throw new Error('Er wordt al een receiver toegevoegd. Rond die stap eerst af.');
    const operation = {}; pairOperation = operation;
    const opener = document.getElementById('modalBody')?.firstElementChild;
    try {
      const inventory = await discover();
      if (opener && (!opener.isConnected || document.getElementById('modal')?.hidden)) throw cancelled();
      const generation = connectionGeneration, selectedGateway = gateway;
      let selectedRid = '';
      const current = () => pairOperation === operation && !operation.cancelled && ready && generation === connectionGeneration && gateway === selectedGateway &&
        (!selectedRid || devices.some(item => exactRid(item.RID || item.rid) === selectedRid && availableReceiver(item)));
      const known = knownReceivers();
      const unique = new Map(inventory.devices.filter(availableReceiver).map(item => [exactRid(item.RID || item.rid), item]));
      const candidates = [...unique.values()].filter(item => !known.has(exactRid(item.RID || item.rid)));
      if (!candidates.length) throw new Error(customerCopy('Geen nieuwe receiver gevonden. De al toegevoegde receivers blijven behouden.', 'No new receiver found. Existing receivers are preserved.', 'Aucun nouveau récepteur trouvé. Les récepteurs existants sont conservés.', 'Kein neuer Receiver gefunden. Vorhandene Receiver bleiben erhalten.'));
      const rid = candidates.length === 1 ? exactRid(candidates[0].RID || candidates[0].rid) : await chooseReceiver(candidates, current, () => { operation.cancelled = true; });
      selectedRid = rid;
      const selected = candidates.find(item => exactRid(item.RID || item.rid) === rid);
      const selectionPanel = document.getElementById('modalBody')?.firstElementChild;
      const selectionCurrent = () => current() && (!selectionPanel || (selectionPanel.isConnected && !document.getElementById('modal')?.hidden));
      const key = exactRid(payload.compatibilityKey || security.compatibilityKey);
      if (!key) throw new Error('De installatiebeveiliging is nog niet klaar. Open de app opnieuw.');
      await assertOwnership(rid, key, selectionCurrent);
      if (!window.AluvisionIdentifyBeforePair?.confirm) throw new Error('Herkenning kon niet worden geopend. Open de app opnieuw.');
      const recognition = await window.AluvisionIdentifyBeforePair.confirm({
        receiver: { rid, name: selected.NAME || selected.name || 'Receiver', receiverType: String(selected.DEVTYPE || selected.receiverType || '').toUpperCase() === 'RGBW' ? 'RGBW' : 'SPI', portCount: Number(selected.PORTS) || 1 },
        isCurrent: current,
        identify: async ({ rid: target, requestId, signal }) => {
          if (target !== rid || !current() || signal.aborted) throw cancelled();
          const sentAt = Date.now();
          const id = nextCommandId();
          const reply = await transact({ V: 18, ID: id, TYPE: 'MESH_IDENTIFY', TARGET: rid, PORT: 0, KEY: key }, { timeout: 3600, signal });
          if (!current() || signal.aborted) throw cancelled();
          const source = exactRid(reply.RID);
          if (String(reply.ID) !== String(id) || ![rid, selectedGateway].includes(source) || reply.STATUS !== 'OK' ||
              reply.DETAIL !== 'MESH_IDENTIFIED' || String(reply.TARGETACK) !== '1' || exactRid(reply.TARGETRID) !== rid ||
              (reply.PORTACK != null && String(reply.PORTACK) !== '0')) throw new Error('De gekozen LED Line bevestigde het knipperen niet.');
          return { ok: true, rid, requestId, pattern: window.AluvisionIdentifyBeforePair.patternFromReply?.(reply, String(selected.DEVTYPE || selected.receiverType || 'SPI').toUpperCase(), Date.now() - sentAt) };
        }
      });
      if (!recognition?.confirmed || recognition.rid !== rid || !current()) throw cancelled();
      // Legacy bridge registration only: no MESH_MAIN/PAIR, owner/key change,
      // PIN bypass or replacement of the receiver's saved configuration.
      const requestedNumber = Math.max(1, Math.min(250, Math.round(Number(payload.number) || 1)));
      return { ...selected, NUMBER: requestedNumber, gateway: rid === gateway, gatewayRid: gateway || rid };
    } finally { if (pairOperation === operation) pairOperation = null; }
  }

  async function transact(fields, options = {}) {
    const timeout = typeof options === 'number'
      ? Number(options)
      : Number(options?.timeout || options?.timeoutMs || 3200);
    const payload = await request('/home-wifi-api/transact', {
      method: 'POST', body: { fields }, timeout: Math.max(900, timeout + 250), signal: options?.signal
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

  window.addEventListener('aluvision-transport-session-changed', () => { connectionGeneration++; });
  window.addEventListener('pagehide', () => { connectionGeneration++; });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') connectionGeneration++; });

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
        // Preserve actionable ownership/PIN and identification errors instead
        // of replacing every failed Add with the misleading "not found" copy.
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
