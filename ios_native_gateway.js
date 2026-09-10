/*
 * Native iOS transport for the bundled Aluvision V20 interface.
 *
 * The visual application remains the exact same HTML/CSS/JavaScript build.
 * Only receiver discovery and UDP 4210 traffic cross this small bridge into
 * the native app. Receiver 1 is the private 192.168.4.1 gateway; every later
 * receiver is discovered and controlled through its ESP-NOW inventory.
 */
(() => {
  'use strict';
  if (window.AluvisionInstallationProfiles?.startupBlocked) return;

  const handler = window.webkit?.messageHandlers?.aluvision;
  if (!handler) return;

  const pending = new Map();
  let requestNumber = 0;
  let devices = [];
  let ready = false;
  let gatewayRid = '';
  let security = {};
  let pendingPairRid = '';
  let pendingReconnectRid = '';
  let receiverScanBusy = false;
  let receiverScanRoot = null;
  let receiverScanGeneration = 0;
  let receiverPairBusy = false;
  let receiverPairActivity = null;
  let gatewayPromotion = null;
  let nativeReceiverAddTarget = null;
  let discoveryPromise = null;
  let discoveryPromiseGeneration = -1;
  let connectionPromise = null;
  let connectionPromiseGeneration = -1;
  let lastHealthyInventoryAt = 0;
  let selectedTransportMode = (() => {
    try {
      const saved = String(localStorage.getItem('aluvision.receiver.connectionMode.v20') || '').toLowerCase();
      return saved === 'bluetooth' ? 'bluetooth' : 'wifi';
    } catch (_) { return 'wifi'; }
  })();
  let transportGeneration = 0;
  let nativeStateKnownGeneration = -1;
  let nativeStatePromise = null;
  let nativeStatePromiseGeneration = -1;
  let transportSelection = null;
  let consecutiveTransportFailures = 0;
  let lastSuccessfulTransportAt = 0;
  let nativeTransportCapabilities = Object.freeze({ wifi: true, wifiAutoJoin: null, bluetooth: true, recovery: false });
  let commissionSecurityProvider = null;
  const nfcPairTokens = new Map();
  const INVENTORY_GRACE_MS = 30000;
  const TRANSIENT_FAILURE_LIMIT = 3;
  const TRANSIENT_CONNECTION_GRACE_MS = 18000;
  const NFC_PAIR_TOKEN_TTL_MS = 90000;
  const RECOVERY_PATHS = new Set([
    '/alv/recovery/status', '/alv/recovery/control', '/alv/recovery/snapshot'
  ]);
  const RECOVERY_TEXT_LIMIT = 4 * 1024;
  const RECOVERY_SNAPSHOT_LIMIT = 60 + (128 * 1024);
  const utf8Encoder = new TextEncoder();
  const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
  const REPLAYABLE_COMMANDS = new Set([
    'STATUS', 'CONFIG', 'SAVE', 'TEST', 'IDENTIFY', 'MESH_IDENTIFY',
    'CALIBRATE', 'CALIBRATE_FILL', 'CALIBRATE_END', 'CALIBRATE_START',
    'CALIBRATE_CLEAR', 'SETUP_BEGIN', 'SETUP_KEEPALIVE', 'SETUP_END', 'SETUP_CANCEL'
  ]);
  // Keep aligned with NativeTrustWire.isStatefulSecurityExchange. At the
  // minimum GATT MTU a full 4096-byte reply needs about 9.2 seconds and its
  // command can need another 6 seconds. Allow bounded room for crypto/queue
  // too. This is a response deadline, never a delay before applying a command.
  const BLE_SECURE_RESPONSE_TYPES = new Set([
    'TRUST_HELLO', 'TRUST_AUTH', 'SECURE_OWNER', 'SECURITY_HELLO',
    'SECURITY_AUTH', 'RECOVERY_HELLO', 'RECOVERY_AUTH', 'RELEASE_STATUS'
  ]);

  function text(nl, en, fr, de) {
    try { return typeof window.ac === 'function' ? window.ac(nl, en, fr, de) : nl; }
    catch (_) { return nl; }
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;').replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function exactRid(value) {
    const rid = String(value || '').trim().toUpperCase();
    return /^[0-9A-F]{16}$/.test(rid) ? rid : '';
  }

  function exactPairToken(value) {
    const token = String(value || '').trim().toUpperCase();
    return /^[0-9A-F]{16}$/.test(token) && token !== '0000000000000000' ? token : '';
  }

  function rememberNfcPairTokens(incoming) {
    const now = Date.now();
    for (const [rid, record] of nfcPairTokens) {
      if (!record || record.expiresAt <= now) nfcPairTokens.delete(rid);
    }
    for (const device of incoming) {
      const rid = exactRid(device?.RID || device?.rid);
      const token = exactPairToken(device?.TOKEN);
      if (rid && token) nfcPairTokens.set(rid, {
        token, expiresAt: now + NFC_PAIR_TOKEN_TTL_MS
      });
    }
  }

  function nfcPairTokenForRid(value) {
    const rid = exactRid(value);
    const record = rid ? nfcPairTokens.get(rid) : null;
    if (!record || record.expiresAt <= Date.now()) {
      if (rid) nfcPairTokens.delete(rid);
      return '';
    }
    return record.token;
  }

  function rgbwChannelMap(value) {
    const map = String(value || '').trim().toUpperCase();
    return map.length === 4 && [...map].sort().join('') === 'BGRW' ? map : '';
  }

  function spiPortCapacity(value = {}) {
    return Number(value.PORTCAP ?? value.portCapacity ?? value.spiPortCapability) === 4 ? 4 : 1;
  }

  function spiPortMask(value = {}) {
    const maximum = spiPortCapacity(value) === 4 ? 15 : 1;
    return Math.max(1, Math.min(maximum, Number(value.PORTMASK ?? value.portMask) || 1));
  }

  function spiPortSetting(value = {}, port = 1) {
    const stored = value.spiPorts?.[port] || value.spiPorts?.[String(port)] || {};
    return {
      pixels: Math.max(1, Math.min(1024, Number(value[`P${port}PX`] ?? stored.pixels ?? (port === 1 ? value.PHYSICAL ?? value.pixels : 25)) || 25)),
      reversed: Boolean(Number(value[`P${port}REV`] ?? stored.reversed ?? stored.physicalReverse ?? (port === 1 ? value.PHYSICALREVERSE ?? value.physicalReverse : 0))),
      groupPixels: Math.max(1, Math.min(65535, Number(value[`P${port}GROUP`] ?? stored.groupPixels) || Number(stored.pixels) || 25)),
      offset: Math.max(0, Math.min(65535, Number(value[`P${port}OFFSET`] ?? stored.offset) || 0))
    };
  }

  function meshId() {
    if (/^[0-9A-F]{8}$/.test(security.meshId || '') && security.meshId !== '00000000') return security.meshId;
    const candidate = String(security.compatibilityKey || '').trim().toUpperCase().slice(0, 8);
    if (/^[0-9A-F]{8}$/.test(candidate) && candidate !== '00000000') return candidate;
    return 'A1' + String(gatewayRid || '000000').slice(-6).padStart(6, '0');
  }

  function networkKey() {
    const key = String(security.compatibilityKey || '').trim().toUpperCase();
    return /^[0-9A-F]{16}$/.test(key) ? key : '';
  }

  function preferredMainRID() {
    const preferred = exactRid(window.AluvisionDirectBridge?.preferredGatewayRid);
    if (!preferred) return '';
    // The transport cache can outlive a deliberately removed receiver.  It is
    // useful for reconnecting a receiver that is still part of this setup, but
    // it must never lock a now-empty app to an old physical RID.  Otherwise a
    // newly selected BLE receiver connects at radio level and is rejected as
    // the "wrong main receiver" before the first-receiver setup can start.
    return appReceiverRIDs().has(preferred) ? preferred : '';
  }

  function preferredGatewaySSID() {
    const rid = preferredMainRID();
    const saved = Object.values(window.AluvisionDirectBridge?.receivers || {})
      .find((item) => exactRid(item?.rid || item?.RID) === rid);
    const ssid = String(saved?.apSsid || saved?.APSSID || '').trim();
    return /^ALUVISION-(?:SPI|RGBW)-(?:[0-9A-F]{4}|[0-9A-F]{12})$/i.test(ssid) ? ssid : '';
  }

  function validateDirectGateway() {
    const preferred = preferredMainRID();
    const configured = appReceiverRIDs();
    const matchesPreferred = preferred && preferred === gatewayRid;
    const validFirstInstallation = !configured.size;
    if (!gatewayRid || matchesPreferred || validFirstInstallation) return;
    ready = false;
    devices = [];
    throw new Error(selectedTransportMode === 'bluetooth' ? text(
      'Dit is niet de hoofdreceiver van deze installatie. Kies je hoofdreceiver; extra receivers worden daarna automatisch gevonden.',
      'This is not this installation’s main receiver. Choose the main receiver; additional receivers are then found automatically.',
      'Ce n’est pas le récepteur principal de cette installation. Choisissez le récepteur principal ; les autres seront ensuite trouvés automatiquement.',
      'Dies ist nicht der Hauptreceiver dieser Installation. Wähle den Hauptreceiver; weitere Receiver werden danach automatisch gefunden.'
    ) : text(
      'Verkeerd ALUVISION-netwerk. Kies bij Wi-Fi het ALUVISION-netwerk van je hoofdreceiver en keer terug.',
      'Wrong ALUVISION network. In Wi-Fi, choose the ALUVISION network of your main receiver and return.',
      'Mauvais réseau ALUVISION. Dans Wi-Fi, choisissez le réseau ALUVISION de votre récepteur principal puis revenez.',
      'Falsches ALUVISION-Netzwerk. Wähle unter WLAN das ALUVISION-Netzwerk deines Hauptreceivers und kehre zurück.'
    ));
  }

  function nativeCall(action, payload = {}, timeoutMs = 9000) {
    const id = `ios-${Date.now()}-${++requestNumber}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(text('Receiver antwoordde niet op tijd', 'Receiver did not respond in time', 'Le récepteur ne répond pas', 'Receiver antwortete nicht rechtzeitig')));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      try { handler.postMessage({ id, action, payload }); }
      catch (error) {
        clearTimeout(timer);
        pending.delete(id);
        reject(error);
      }
    });
  }

  function recoveryBodyBytes(body) {
    if (typeof body === 'string') return utf8Encoder.encode(body);
    if (body instanceof ArrayBuffer) return new Uint8Array(body.slice(0));
    if (ArrayBuffer.isView(body)) {
      return new Uint8Array(body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength));
    }
    throw new TypeError('Ongeldige herstelinhoud');
  }

  function bytesToBase64(bytes) {
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x4000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x4000));
    }
    return btoa(binary);
  }

  function base64ToBytes(value) {
    const textValue = String(value || '');
    if (!textValue || textValue.length > 180000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(textValue) || textValue.length % 4) {
      throw new Error('De receiver gaf een ongeldig herstelantwoord.');
    }
    let binary;
    try { binary = atob(textValue); }
    catch (_) { throw new Error('De receiver gaf een ongeldig herstelantwoord.'); }
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    if (bytesToBase64(bytes) !== textValue) throw new Error('De receiver gaf een ongeldig herstelantwoord.');
    return bytes;
  }

  function strictRecoveryFields(bytes) {
    let textValue;
    try { textValue = utf8Decoder.decode(bytes); }
    catch (_) { throw new Error('De receiver gaf een ongeldig herstelantwoord.'); }
    if (!textValue || /[\0\r\n]/.test(textValue)) throw new Error('De receiver gaf een ongeldig herstelantwoord.');
    const fields = Object.create(null);
    for (const part of textValue.split(';')) {
      const separator = part.indexOf('=');
      if (separator < 1) throw new Error('De receiver gaf een ongeldig herstelantwoord.');
      const key = part.slice(0, separator);
      const value = part.slice(separator + 1);
      if (!/^[A-Z][A-Z0-9_]*$/.test(key) || key in fields || /[\x00-\x1F\x7F]/.test(value)) {
        throw new Error('De receiver gaf een ongeldig herstelantwoord.');
      }
      fields[key] = value;
    }
    if (fields.RECOVERY !== '1' || !['OK', 'ERROR', 'ACCEPTED'].includes(fields.STATUS)) {
      throw new Error('De receiver gaf een ongeldig herstelantwoord.');
    }
    return textValue;
  }

  async function nativeRecoveryRequest() {
    throw Object.assign(new Error('Gebruik het versleutelde herstelkanaal via je installatiepincode.'), {
      code: 'ENCRYPTED_CHANNEL_REQUIRED'
    });
  }

  // This adapter talks only to the app's encrypted, ThisDeviceOnly native
  // store. Neither receiver JSON nor web storage can advertise this authority.
  const ownerJournalRevisions = new Map();
  function journalIdentity(id) {
    const match = /^(?:(?:trust|pending|profile):)?([0-9A-F]{8})$/.exec(String(id || ''));
    if (!match || match[1] === '00000000') throw new Error('Ongeldige installatie voor beveiligde opslag.');
    return match[1];
  }
  function journalRecord(id, record) {
    const installationId = journalIdentity(id);
    if (!record || record.id !== installationId || record.installationId !== installationId ||
        !/^[0-9A-F]{16}$/.test(record.transaction || '') || /^0+$/.test(record.transaction) ||
        !Number.isSafeInteger(record.journalRevision) || record.journalRevision < 1) {
      throw new Error('Ongeldige beveiligde installatiegegevens.');
    }
    const encoded = JSON.stringify(record);
    if (new TextEncoder().encode(encoded).length > 256 * 1024) throw new Error('De beveiligde installatiegegevens zijn te groot.');
    return encoded;
  }
  const secretJournal = Object.freeze({
    storageClass: 'native-encrypted-owner-secrets-v1-cas',
    async load(id) {
      journalIdentity(id);
      const result = await nativeCall('ownerJournal', {operation: 'load', id}, 10000);
      if (result?.valueJSON === null) { ownerJournalRevisions.delete(id); return null; }
      if (typeof result?.valueJSON !== 'string' || new TextEncoder().encode(result.valueJSON).length > 256 * 1024) throw new Error('De beveiligde opslag kon niet worden gecontroleerd.');
      const record = JSON.parse(result.valueJSON); journalRecord(id, record);
      ownerJournalRevisions.set(id, {transaction: record.transaction, revision: record.journalRevision});
      return record;
    },
    async save(id, record, expectedTransaction = null) {
      const valueJSON = journalRecord(id, record);
      if (expectedTransaction !== null && !/^[0-9A-F]{16}$/.test(expectedTransaction)) throw new Error('Ongeldige opslagbevestiging.');
      const result = await nativeCall('ownerJournal', {operation: 'save', id, valueJSON, expectedTransaction}, 10000);
      if (result?.ok !== true) return false;
      ownerJournalRevisions.set(id, {transaction: record.transaction, revision: record.journalRevision});
      return true;
    },
    async remove(id, expectedTransaction) {
      journalIdentity(id);
      const expected = ownerJournalRevisions.get(id);
      if (!expected || expected.transaction !== expectedTransaction) return false;
      const result = await nativeCall('ownerJournal', {operation: 'remove', id, expectedTransaction, expectedRevision: expected.revision}, 10000);
      if (result?.ok === true && ownerJournalRevisions.get(id) === expected) ownerJournalRevisions.delete(id);
      return result?.ok === true;
    }
  });

  function normaliseTransportMode(value) {
    const mode = String(value || '').trim().toLowerCase();
    if (mode !== 'wifi' && mode !== 'bluetooth') {
      throw new TypeError('Onbekende receiververbinding');
    }
    return mode;
  }

  async function secureRecoveryRequest(frame, rid) {
    await ensureNativeTransportState();
    const target = exactRid(rid);
    if (selectedTransportMode !== 'wifi' || !ready || !target || target !== gatewayRid) {
      throw new Error('Verbind via Wi-Fi met de hoofdreceiver om je installatie veilig te herstellen.');
    }
    const bytes = recoveryBodyBytes(frame);
    if (bytes.length < 92 || bytes.length > 4188) throw new Error('Ongeldig beveiligd herstelbericht.');
    const generation = transportGeneration;
    const result = await nativeCall('secureRecoveryRequest', {
      receiverRid: target, bodyBase64: bytesToBase64(bytes)
    }, 22000);
    if (generation !== transportGeneration || gatewayRid !== target) throw new Error('De herstelverbinding is gewijzigd.');
    if (Number(result?.status) !== 200 || typeof result?.bodyBase64 !== 'string' || result.bodyBase64.length > 5584) {
      throw new Error('Ongeldig beveiligd herstelantwoord.');
    }
    const response = base64ToBytes(result.bodyBase64);
    if (response.length < 92 || response.length > 4188) throw new Error('Ongeldig beveiligd herstelantwoord.');
    return { status: 200, bytes: response };
  }

  function rememberNativeCapabilities(result = {}) {
    if (!result?.capabilities || typeof result.capabilities !== 'object') return result;
    const source = result.capabilities;
    nativeTransportCapabilities = Object.freeze({
      wifi: source.wifi !== false,
      wifiAutoJoin: typeof source.wifiAutoJoin === 'boolean' ? source.wifiAutoJoin : null,
      bluetooth: source.bluetooth !== false,
      recovery: source.recovery === true || source.recoveryRequest === true,
      secureRecovery: source.secureRecoveryRequest === true,
      nativeOta: source.nativeOta === true
    });
    return result;
  }

  async function ensureNativeTransportState() {
    if (transportSelection?.generation === transportGeneration) {
      await transportSelection.promise;
      return selectedTransportMode;
    }
    const generation = transportGeneration;
    if (nativeStateKnownGeneration === generation) return selectedTransportMode;
    if (nativeStatePromise && nativeStatePromiseGeneration === generation) return nativeStatePromise;
    let tracked;
    const operation = nativeCall('transportState', {}, 7000).then((result) => {
      if (generation !== transportGeneration) return selectedTransportMode;
      const mode = String(result?.mode || '').toLowerCase();
      if (mode === 'wifi' || mode === 'bluetooth') selectedTransportMode = mode;
      rememberNativeCapabilities(result);
      nativeStateKnownGeneration = generation;
      return selectedTransportMode;
    });
    tracked = operation.finally(() => {
      if (nativeStatePromise === tracked) {
        nativeStatePromise = null;
        nativeStatePromiseGeneration = -1;
      }
    });
    nativeStatePromise = tracked;
    nativeStatePromiseGeneration = generation;
    return tracked;
  }

  async function selectNativeTransport(value) {
    const mode = normaliseTransportMode(value);
    // A pending selection is an intent, not a confirmed mode. Selecting the
    // old mode again must supersede it, while repeated taps on the same
    // pending target share its result instead of resetting another session.
    if (transportSelection?.generation !== transportGeneration) await ensureNativeTransportState();
    const activeSelection = transportSelection?.generation === transportGeneration ? transportSelection : null;
    if (activeSelection?.mode === mode) return activeSelection.promise;
    if (!activeSelection && mode === selectedTransportMode) return { mode, capabilities: nativeTransportCapabilities };
    transportGeneration += 1;
    const generation = transportGeneration;
    invalidateRuntimeConnection();
    const selection = { mode, generation, promise: null };
    transportSelection = selection;
    selection.promise = nativeCall('selectTransport', { mode }, 10000).then((result) => {
      if (generation !== transportGeneration) {
        throw Object.assign(new Error(text('Verbindingsmethode gewijzigd', 'Connection method changed', 'Mode de connexion modifié', 'Verbindungsmethode geändert')), { code: 'TRANSPORT_CHANGED' });
      }
      rememberNativeCapabilities(result);
      selectedTransportMode = mode;
      nativeStateKnownGeneration = generation;
      return { ...result, mode };
    }).finally(() => {
      if (transportSelection === selection) transportSelection = null;
    });
    return selection.promise;
  }

  async function scanNativeBluetooth() {
    await ensureNativeTransportState();
    if (selectedTransportMode !== 'bluetooth') await selectNativeTransport('bluetooth');
    return rememberNativeCapabilities(await nativeCall('scanBluetooth', {}, 18000));
  }

  async function connectNativeBluetooth(peripheralId = '') {
    await ensureNativeTransportState();
    if (selectedTransportMode !== 'bluetooth') await selectNativeTransport('bluetooth');
    const generation = transportGeneration;
    transportSessionChanged();
    const connected = await nativeCall(
      'connectBluetooth',
      {
        ...(peripheralId ? { peripheralId: String(peripheralId) } : {}),
        expectedGatewayRid: preferredMainRID()
      },
      22000
    );
    // Wi-Fi selection or an explicit Disconnect can overtake this GATT
    // handshake. Never revive the retired receiver from its late inventory.
    if (generation !== transportGeneration) {
      throw Object.assign(new Error('Verbinding gewijzigd. Probeer opnieuw.'), { code: 'TRANSPORT_CHANGED' });
    }
    const result = rememberNativeCapabilities(connected);
    const inventory = result?.inventory && typeof result.inventory === 'object'
      ? result.inventory : result;
    if (Array.isArray(inventory?.devices)) remember(inventory);
    return result;
  }

  async function disconnectNativeBluetooth() {
    transportGeneration += 1;
    invalidateRuntimeConnection();
    const generation = transportGeneration;
    const result = await nativeCall('disconnectBluetooth', {}, 7000);
    if (generation === transportGeneration) nativeStateKnownGeneration = generation;
    return result;
  }

  async function deriveNativeInstallationSecurity(code) {
    return nativeCall('deriveInstallationSecurity', { code: String(code || '') }, 30000);
  }

  async function nativeOtaPreflight(receiver, artifact) {
    if (window.AluvisionLocalTestMode?.enabled) throw new Error('OTA is niet beschikbaar in de tijdelijke teststand zonder PIN.');
    await prepareNativeOtaAccess(receiver);
    const rid = exactRid(receiver?.rid || receiver?.RID);
    const receiverType = String(receiver?.receiverType || receiver?.DEVTYPE || '').toUpperCase();
    if (!rid || !['SPI', 'RGBW'].includes(receiverType) || !artifact || typeof artifact !== 'object') {
      throw new TypeError('Ongeldige OTA-voorcontrole');
    }
    const release = await window.AluvisionSecureConnection?.pauseForNativeOperation?.();
    try { return await nativeCall('otaPreflight', {
      installationId: meshId(),
      receiverRid: rid,
      artifactId: artifact.id
    }, 20000); } finally { release?.(); }
  }

  async function prepareNativeOtaAccess(receiver) {
    if (window.AluvisionLocalTestMode?.enabled) throw new Error('OTA is niet beschikbaar in de tijdelijke teststand zonder PIN.');
    await ensureNativeTransportState();
    const rid = exactRid(receiver?.rid || receiver?.RID);
    if (selectedTransportMode !== 'wifi' || !rid || rid !== gatewayRid) {
      throw new Error(text('Verbind via Wi-Fi met precies deze receiver voor de update.',
        'Connect to this exact receiver over Wi-Fi to update it.',
        'Connectez-vous à ce récepteur précis par Wi-Fi pour le mettre à jour.',
        'Verbinde dich für das Update per WLAN mit genau diesem Receiver.'));
    }
    // Native OTA loads the installation owner from its encrypted journal. A
    // legacy shared KEY or public ownership flag is not update authority.
    const reply = window.AluvisionSecureConnection
      ? await window.AluvisionSecureConnection.control({V:18,TYPE:'SECURITY_STATUS',TARGET:rid},{timeout:6000})
      : {STATUS:'ERROR'};
    if (String(reply.STATUS).toUpperCase() !== 'OK' || String(reply.OWNERMATCH) !== '1' || String(reply.PINSET) !== '1') {
      throw new Error(text('Bevestig eerst toegang met je installatiepincode.',
        'Confirm access with your installation PIN first.',
        'Confirmez d’abord l’accès avec le code PIN de l’installation.',
        'Bestätige zuerst den Zugriff mit deiner Installations-PIN.'));
    }
  }

  const nativeOtaLeases = new Map();
  function nativeOtaLeaseState(job) {
    if(job && ['completed','failed','cancelled'].includes(job.state)) {
      nativeOtaLeases.get(job.id)?.(); nativeOtaLeases.delete(job.id);
    }
    return job;
  }
  async function nativeOtaStart(receiver, artifact) {
    await prepareNativeOtaAccess(receiver);
    const release = await window.AluvisionSecureConnection?.pauseForNativeOperation?.();
    try {
      const job = await nativeCall('otaStart', { receiverRid: exactRid(receiver?.rid || receiver?.RID),
      installationId: meshId(),
      artifactId: String(artifact?.id || '') }, 15000);
      if(!job?.id) throw new Error('De update heeft nog geen bevestigde taakidentiteit. Controleer de status opnieuw.');
      if(release) nativeOtaLeases.set(job.id,release);
      return nativeOtaLeaseState(job);
    } catch(error) {release?.();throw error;}
  }
  const nativeOtaStatus = async jobId => nativeOtaLeaseState(await nativeCall('otaStatus', { jobId }, 6000));
  const nativeOtaCancel = async jobId => nativeOtaLeaseState(await nativeCall('otaCancel', { jobId }, 6000));
  const nativeOtaJobs = async () => {
    const result = await nativeCall('otaJobs', {}, 6000);
    // A missed status poll must not leave controls paused after the same
    // native job later reports a terminal state in the refreshed job list.
    if (Array.isArray(result?.recentJobs)) result.recentJobs.forEach(nativeOtaLeaseState);
    return result;
  };
  const nativeOtaVerify = async jobId => {
    const release = nativeOtaLeases.has(jobId) ? null : await window.AluvisionSecureConnection?.pauseForNativeOperation?.();
    try { return nativeOtaLeaseState(await nativeCall('otaVerify', { jobId, installationId: meshId() }, 15000)); }
    finally { release?.(); }
  };

  function registerCommissionSecurityProvider(provider) {
    if (!provider || typeof provider.getStatus !== 'function' ||
        typeof provider.setupInstallation !== 'function' ||
        typeof provider.normalizeUserCode !== 'function') {
      throw new TypeError('Ongeldige installatiebeveiligingsadapter');
    }
    commissionSecurityProvider = provider;
    window.dispatchEvent(new CustomEvent('aluvision-security-backend-changed'));
    return () => {
      if (commissionSecurityProvider !== provider) return;
      commissionSecurityProvider = null;
      window.dispatchEvent(new CustomEvent('aluvision-security-backend-changed'));
    };
  }

  window.__aluvisionNativeReply = function nativeReply(message) {
    let response;
    try { response = typeof message === 'string' ? JSON.parse(message) : message; }
    catch (_) { return; } // no trustworthy request ID: let its bounded deadline handle it
    const call = pending.get(String(response?.id || ''));
    if (!call) return;
    clearTimeout(call.timer);
    pending.delete(String(response.id));
    if (response.ok === false) call.reject(Object.assign(new Error(response.error || text('Native verbinding mislukt', 'Native connection failed', 'Connexion native échouée', 'Native Verbindung fehlgeschlagen')), { code: String(response.code || '') }));
    else call.resolve(response.result ?? {});
  };

  function receiverReportsOnline(device) {
    const value = String(device?.ONLINE ?? device?.online ?? '1').trim().toLowerCase();
    return value === '1' || value === 'true';
  }

  function remember(inventory) {
    const incoming = Array.isArray(inventory?.devices) ? inventory.devices : [];
    try { window.AluvisionReceiverIdentity?.assertInventory(incoming); }
    catch (error) { ready = false; throw error; }
    rememberNfcPairTokens(incoming);
    const incomingGateway = exactRid(inventory?.gatewayRid) || exactRid(incoming[0]?.RID || incoming[0]?.rid);
    const stale = inventory?.stale === true;
    const inventoryComplete = inventory?.inventoryComplete !== false;
    if (incoming.length) {
      // A missed discovery page says nothing about the receivers on that page.
      // Retain them visibly as unconfirmed, never as online and never silently
      // remove their installation configuration. Do not cross gateway sessions.
      const seen = new Set(incoming.map(item => exactRid(item.RID || item.rid)));
      const unconfirmed = !inventoryComplete && incomingGateway === gatewayRid
        ? devices.filter(item => !seen.has(exactRid(item.RID || item.rid)))
            .map(item => ({ ...item, ONLINE: '0', DISCOVERYSTATE: 'UNCONFIRMED' }))
        : [];
      devices = [...incoming, ...unconfirmed].map(item => stale
        ? { ...item, ONLINE: '0', DISCOVERYSTATE: 'UNCONFIRMED' } : item);
      gatewayRid = incomingGateway || gatewayRid;
      // Keep the cached inventory available for display, but never present it
      // as a live transport connection. This forces connect() to rejoin the
      // receiver access point instead of sending commands to a stale route.
      const main = incoming.find(item => exactRid(item.RID || item.rid) === gatewayRid);
      ready = Boolean(main) && receiverReportsOnline(main) && !stale;
      if (ready) {
        lastHealthyInventoryAt = Date.now();
        lastSuccessfulTransportAt = lastHealthyInventoryAt;
        consecutiveTransportFailures = 0;
      }
    } else if (stale) {
      // Explicit link loss is stronger evidence than the display grace period.
      // Keep names, not a false live connection that suppresses reconnect().
      devices = incomingGateway && gatewayRid && incomingGateway !== gatewayRid ? []
        : devices.map(item => ({ ...item, ONLINE: '0', DISCOVERYSTATE: 'UNCONFIRMED' }));
      gatewayRid = incomingGateway || gatewayRid;
      ready = false;
    } else if (!ready || Date.now() - lastHealthyInventoryAt > INVENTORY_GRACE_MS) {
      devices = [];
      gatewayRid = '';
      ready = false;
    }
    return { devices, inventoryComplete: inventoryComplete && !stale };
  }

  function transportSessionChanged() {
    // A receiver can reboot while iOS reconnects to the same RID. Invalidate
    // clock samples at the session boundary, before scheduling any new frame.
    window.dispatchEvent(new CustomEvent('aluvision-transport-session-changed'));
  }

  function invalidateRuntimeConnection() {
    // Runtime state only: paired receivers, groups and all saved setup data
    // remain intact in AluvisionDirectBridge/local storage.
    devices = [];
    gatewayRid = '';
    ready = false;
    lastHealthyInventoryAt = 0;
    transportSessionChanged();
  }

  function noteTransportSuccess() {
    consecutiveTransportFailures = 0;
    lastSuccessfulTransportAt = Date.now();
  }

  function explicitTransportLoss(error) {
    const message = String(error?.message || error || '').toLowerCase();
    return /bluetooth.{0,32}(verbroken|niet beschikbaar|disconnected|unavailable|powered off)|(?:network|netwerk|wi-?fi).{0,32}(not connected|no route|down|verbroken|niet verbonden)/i.test(message);
  }

  function replayableTransportFailure(error) {
    const detail = `${error?.code || ''} ${error?.message || error || ''}`;
    if (/TRANSPORT_CHANGED|IDENTITY_|PIN_|TRUST_|SECURITY_|AUTH|PAIR_DENIED|KEY_MISMATCH|CANCELLED|CANCELED|SUPERSEDED|beveilig|pincode/i.test(detail)) return false;
    return explicitTransportLoss(error) || /timeout|timed? ?out|not respond|antwoord(?:de|t) niet|niet op tijd|unreachable|no route|connection.{0,32}(lost|failed|closed)|verbinding.{0,32}verbroken|connexion.{0,32}perdue/i.test(detail);
  }

  function noteTransportFailure(error) {
    // A command timeout or a missing ESP-NOW target ACK says nothing about
    // the iPhone-to-gateway link. Only explicit link-loss errors contribute
    // to taking the transport offline.
    if (!explicitTransportLoss(error)) return;
    consecutiveTransportFailures += 1;
    const recentlyHealthy = lastSuccessfulTransportAt &&
      Date.now() - lastSuccessfulTransportAt < TRANSIENT_CONNECTION_GRACE_MS;
    // One lost UDP packet or BLE notification is not a disconnected
    // receiver. Keep the route warm so the next command can repair it.
    if (consecutiveTransportFailures >= TRANSIENT_FAILURE_LIMIT && !recentlyHealthy) {
      invalidateRuntimeConnection();
    }
  }

  function shortPause(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  async function promoteSavedStandaloneGateway() {
    if (window.AluvisionSecureConnection) return false; // repair requires proven owner flow, never a legacy KEY claim
    validateDirectGateway();
    const direct = devices.find((item) => exactRid(item.RID || item.rid) === gatewayRid);
    if (!direct || String(direct.MESHROLE || direct.ROLE || '').toUpperCase() !== 'STANDALONE') return false;
    // Promotion is a repair for a receiver that is still the configured main,
    // not a side effect of an obsolete transport-cache entry.  An empty setup
    // must continue into the normal first-receiver/PIN commissioning flow.
    if (preferredMainRID() !== gatewayRid) return false;
    const saved = Object.values(window.AluvisionDirectBridge?.receivers || {})
      .find((item) => exactRid(item?.rid || item?.RID) === gatewayRid);
    if (!saved || !networkKey()) return false;
    if (gatewayPromotion) return gatewayPromotion;
    gatewayPromotion = (async () => {
      const reply = await transact({
        V: 18,
        TYPE: 'MESH_MAIN',
        TARGET: gatewayRid,
        MESHID: meshId(),
        NETWORK: networkKey(),
        NUMBER: Math.max(1, Math.min(250, Number(saved.number || saved.NUMBER) || 1))
      }, { timeout: 4200 });
      if (String(reply.STATUS || '').toUpperCase() !== 'OK' ||
          String(reply.MESHROLE || '').toUpperCase() !== 'MAIN' ||
          String(reply.MESHROUTING || '') !== '1') {
        throw new Error(text('De hoofdreceiver kon niet worden hersteld.', 'The main receiver could not be restored.', 'Le récepteur principal n’a pas pu être restauré.', 'Der Hauptreceiver konnte nicht wiederhergestellt werden.'));
      }
      return true;
    })().finally(() => { gatewayPromotion = null; });
    return gatewayPromotion;
  }

  async function discover() {
    const generation = transportGeneration;
    await ensureNativeTransportState();
    if (generation !== transportGeneration) {
      throw new Error(text('Verbindingsmethode gewijzigd', 'Connection method changed', 'Mode de connexion modifié', 'Verbindungsmethode geändert'));
    }
    if (discoveryPromise && discoveryPromiseGeneration === generation) return discoveryPromise;
    let tracked;
    const operation = (async () => {
      const discovered = await nativeCall('discover', {}, 9000);
      if (generation !== transportGeneration) throw new Error(text('Verbindingsmethode gewijzigd', 'Connection method changed', 'Mode de connexion modifié', 'Verbindungsmethode geändert'));
      let inventory = remember(discovered);
      validateDirectGateway();
      if (ready && await promoteSavedStandaloneGateway()) {
        const refreshed = await nativeCall('discover', {}, 9000);
        if (generation !== transportGeneration) throw new Error(text('Verbindingsmethode gewijzigd', 'Connection method changed', 'Mode de connexion modifié', 'Verbindungsmethode geändert'));
        inventory = remember(refreshed);
        validateDirectGateway();
      }
      return inventory;
    })();
    tracked = operation.finally(() => {
      if (discoveryPromise === tracked) {
        discoveryPromise = null;
        discoveryPromiseGeneration = -1;
      }
    });
    discoveryPromise = tracked;
    discoveryPromiseGeneration = generation;
    return tracked;
  }

  async function connect(options = {}) {
    const interactive = options === true || Boolean(options?.interactive);
    const forceReconnect = Boolean(options?.forceReconnect);
    await ensureNativeTransportState();
    const generation = transportGeneration;
    if (connectionPromise && connectionPromiseGeneration === generation) return connectionPromise;
    if (!interactive && !forceReconnect) {
      try {
        await discover();
        if (ready) return true;
      } catch (error) {
        noteTransportFailure(error);
      }
    }
    if (generation !== transportGeneration) {
      throw new Error(text('Verbindingsmethode gewijzigd', 'Connection method changed', 'Mode de connexion modifié', 'Verbindungsmethode geändert'));
    }
    // A stale or failed preflight must not stop live control before transact().
    // Perform exactly one native AP rejoin; concurrent commands share it.
    if (connectionPromise && connectionPromiseGeneration === generation) return connectionPromise;
    let tracked;
    const operation = (async () => {
      if (discoveryPromise && discoveryPromiseGeneration === generation) {
        await discoveryPromise.catch(() => {});
      }
      transportSessionChanged();
      const connected = await nativeCall('connect', {
        preferredSSID: preferredGatewaySSID(),
        expectedGatewayRid: preferredMainRID()
      }, 45000);
      if (generation !== transportGeneration) throw new Error(text('Verbindingsmethode gewijzigd', 'Connection method changed', 'Mode de connexion modifié', 'Verbindungsmethode geändert'));
      let inventory = remember(connected);
      validateDirectGateway();
      if (ready && await promoteSavedStandaloneGateway()) {
        const refreshed = await nativeCall('discover', {}, 9000);
        if (generation !== transportGeneration) throw new Error(text('Verbindingsmethode gewijzigd', 'Connection method changed', 'Mode de connexion modifié', 'Verbindungsmethode geändert'));
        inventory = remember(refreshed);
        validateDirectGateway();
      }
      return ready;
    })();
    tracked = operation.finally(() => {
      if (connectionPromise === tracked) {
        connectionPromise = null;
        connectionPromiseGeneration = -1;
      }
    });
    connectionPromise = tracked;
    connectionPromiseGeneration = generation;
    return tracked;
  }

  async function pair(payload = {}) {
    // Capture the Add owner before discovery: a late scan must not attach its
    // result to a newer Add operation or continue after the customer closes it.
    // Intentional replacement of the visible modal remains part of this same
    // activity; only closing/cancelling it retires the operation.
    const activity = receiverPairActivity;
    const currentActivity = () => !activity || pairActivityCurrent(activity);
    const cancelledPair = () => Object.assign(new Error('Toevoegen geannuleerd.'), {
      code: 'IDENTIFY_CANCELLED', reason: currentActivity() ? 'stale' : 'closed'
    });
    if (!currentActivity()) throw cancelledPair();
    const inventory = await discover();
    if (!currentActivity()) throw cancelledPair();
    if (!inventory.devices.length) throw new Error(selectedTransportMode === 'bluetooth' ? text(
      'Geen Bluetooth-verbinding met de hoofdreceiver gevonden. Kies Bluetooth opnieuw bij Receiver toevoegen.',
      'No Bluetooth connection to the main receiver was found. Choose Bluetooth again under Add receiver.',
      'Aucune connexion Bluetooth au récepteur principal. Choisissez à nouveau Bluetooth dans Ajouter un récepteur.',
      'Keine Bluetooth-Verbindung zum Hauptreceiver gefunden. Wähle Bluetooth unter Receiver hinzufügen erneut.'
    ) : text(
      'Geen receiververbinding gevonden. Kies bij iPhone-instellingen → Wi-Fi het ALUVISION-netwerk en keer terug.',
      'No receiver connection found. In iPhone Settings → Wi-Fi, choose the ALUVISION network and return.',
      'Aucune connexion au récepteur. Dans Réglages iPhone → Wi-Fi, choisissez le réseau ALUVISION puis revenez.',
      'Keine Receiver-Verbindung. Wähle in den iPhone-Einstellungen → WLAN das ALUVISION-Netzwerk und kehre zurück.'
    ));
    const used = knownReceiverRIDs();
    const configured = appReceiverRIDs();
    const sorted = [...inventory.devices].sort((a, b) =>
      String(a.HWID || a.hardwareId || '').localeCompare(String(b.HWID || b.hardwareId || ''))
    );
    const available = sorted.filter((item) => {
      const rid = exactRid(item.RID || item.rid);
      return rid && (!configured.has(rid) || candidateNeedsReconnect(item, used));
    });
    let selected = null;
    if (pendingPairRid) {
      selected = sorted.find((item) => exactRid(item.RID || item.rid) === pendingPairRid) || null;
      if (!selected) {
        pendingPairRid = '';
        throw new Error(text('De gekozen receiver is niet meer bereikbaar.', 'The selected receiver is no longer reachable.', 'Le récepteur choisi n’est plus joignable.', 'Der gewählte Receiver ist nicht mehr erreichbar.'));
      }
      if (configured.has(pendingPairRid) && !candidateNeedsReconnect(selected, used)) {
        pendingPairRid = '';
        throw new Error(text('Deze receiver is al toegevoegd.', 'This receiver has already been added.', 'Ce récepteur est déjà ajouté.', 'Dieser Receiver wurde bereits hinzugefügt.'));
      }
    } else if (available.length === 1) {
      selected = available[0];
    } else if (available.length > 1) {
      throw new Error(text('Kies eerst welke receiver je wilt toevoegen.', 'First choose which receiver you want to add.', 'Choisissez d’abord le récepteur à ajouter.', 'Wähle zuerst den Receiver aus, den du hinzufügen möchtest.'));
    } else {
      throw new Error(text('Alle gevonden receivers zijn al toegevoegd.', 'All discovered receivers have already been added.', 'Tous les récepteurs trouvés sont déjà ajoutés.', 'Alle gefundenen Receiver wurden bereits hinzugefügt.'));
    }
    pendingPairRid = '';
    const rid = exactRid(selected.RID || selected.rid);
    if (window.AluvisionLocalTestMode?.enabled) window.AluvisionLocalTestMode.assertReceiver(rid);
    const stored = Object.values(window.AluvisionDirectBridge?.receivers || {})
      .find((item) => exactRid(item?.rid || item?.RID) === rid);
    const reconnecting = candidateNeedsReconnect(selected, used);
    const rehydrating = used.has(rid) && !configured.has(rid);
    const restoring = reconnecting || rehydrating;
    const number = Math.max(1, Math.min(250, Number(restoring ? stored?.number : payload.number) || 1));
    const key = networkKey();
    if (!key) throw new Error(text('De installatiebeveiliging is nog niet klaar.', 'Installation security is not ready yet.', 'La sécurité de l’installation n’est pas encore prête.', 'Die Installationssicherheit ist noch nicht bereit.'));
    const generation = transportGeneration;
    const selectedGateway = gatewayRid;
    const currentLink = () => ready && generation === transportGeneration && gatewayRid === selectedGateway;
    const currentPair = () => currentActivity() && currentLink();
    const assertPairCurrent = () => { if (!currentPair()) throw cancelledPair(); };
    if (!window.AluvisionIdentifyBeforePair?.confirm) {
      throw new Error('Herkenning kon niet worden geopend. Open de app opnieuw.');
    }
    const recognition = await window.AluvisionIdentifyBeforePair.confirm({
      receiver: {
        rid, name: selected.name || selected.NAME || 'Receiver',
        receiverType: selected.DEVTYPE || selected.receiverType || 'SPI',
        portCount: Number(selected.PORTS) || 1
      },
      isCurrent: currentPair,
      identify: async ({ rid: target, requestId, signal }) => {
        if (target !== rid || !currentPair() || signal.aborted) throw new Error('Verbinding gewijzigd. Kies de receiver opnieuw.');
        const sentAt = Date.now();
        const reply = await identifyReceiver(target, { signal });
        if (!currentPair() || signal.aborted) throw new Error('Herkenning geannuleerd.');
        return { ok: true, rid: target, requestId,
          pattern: window.AluvisionIdentifyBeforePair.patternFromReply?.(reply, String(selected.DEVTYPE || selected.receiverType || 'SPI').toUpperCase(), Date.now() - sentAt) };
      }
    });
    if (!recognition.confirmed || recognition.rid !== rid || !currentPair()) {
      throw Object.assign(new Error('Toevoegen geannuleerd.'), { code: 'IDENTIFY_CANCELLED', reason: recognition.reason });
    }
    window.modal?.(`<section class="native-pair-progress"><h2>${text('Receiver toevoegen…', 'Adding receiver…', 'Ajout du récepteur…', 'Receiver wird hinzugefügt…')}</h2><p class="sub">${text('Daarna stel je de LED Lines in.', 'Next, set up the LED Lines.', 'Configurez ensuite les LED Lines.', 'Danach richtest du die LED Lines ein.')}</p><div id="receiverNfcStatus" class="nfc-status scanning" role="status"></div></section>`);
    const selectedRole = String(selected.MESHROLE || selected.ROLE || '').toUpperCase();
    const needsMainConfiguration = rid === gatewayRid && (selectedRole === 'STANDALONE' || !used.size);
    // A previously PIN-free MAIN can already have a local receiver entry.
    // Re-check its actual security rather than letting that stale entry skip
    // first PIN setup. An owned MAIN resumes without asking for a new PIN.
    if (rid === gatewayRid && window.AluvisionSecureConnection) {
      const initial = await commissionSecurityProvider?.getStatus?.(true);
      assertPairCurrent();
      if(!initial?.configured || !initial?.trusted) {
        if(typeof window.v20CheckReceiverSecurity!=='function')throw new Error('De pincode-instelling kon niet worden geopend.');
        const confirmed=await new Promise((resolve,reject)=>{
          window.v20CheckReceiverSecurity({id:'native-restore-'+rid,rid,name:selected.name||'Receiver',receiverType:selected.DEVTYPE||selected.receiverType||'SPI'},
            ()=>resolve(true),()=>resolve(false)).catch(reject);
        });
        if(!confirmed||!currentPair())throw Object.assign(new Error('Toevoegen geannuleerd.'),{code:'IDENTIFY_CANCELLED'});
      }
      assertPairCurrent();
      const owner = await window.AluvisionSecureConnection.ensure(rid,{isCurrent:currentPair});
      assertPairCurrent();
      const status = await window.AluvisionSecureConnection.control({V:18,TYPE:'SECURITY_STATUS',TARGET:rid});
      assertPairCurrent();
      if (status.STATUS !== 'OK' || status.OWNERMATCH !== '1' || status.PINSET !== '1') throw new Error('De hoofdreceiver heeft de installatie nog niet bevestigd.');
      selected = {...selected,RID:rid,DEVTYPE:owner.descriptor.receiverType,MESHROLE:'MAIN',MESHROUTING:'1',NUMBER:1};
      await commissionSecurityProvider?.finalizeInstallation?.(rid,{isCurrent:currentPair});
      assertPairCurrent();
    } else if (needsMainConfiguration) {
      assertPairCurrent();
      const meshReply = await transact({
        V: 18,
        TYPE: 'MESH_MAIN',
        TARGET: rid,
        MESHID: meshId(),
        NETWORK: key,
        NUMBER: number
      }, { timeout: 4200 });
      assertPairCurrent();
      if (String(meshReply.STATUS || '').toUpperCase() !== 'OK' ||
          String(meshReply.MESHROLE || '').toUpperCase() !== 'MAIN' ||
          String(meshReply.MESHROUTING || '') !== '1') {
        throw new Error(text('De eerste receiver kon niet als hoofdreceiver worden ingesteld.', 'The first receiver could not be configured as the main receiver.', 'Le premier récepteur n’a pas pu être configuré comme récepteur principal.', 'Der erste Receiver konnte nicht als Hauptreceiver eingerichtet werden.'));
      }
      selected = { ...selected, ...meshReply, RID: rid, NUMBER: number };
      gatewayRid = rid;
      await commissionSecurityProvider?.finalizeInstallation?.(rid, { isCurrent: currentPair });
      assertPairCurrent();
    } else if (rid !== gatewayRid) {
      const receiverType = String(restoring ? stored?.receiverType : (selected.DEVTYPE || selected.receiverType || 'SPI')).toUpperCase() === 'RGBW' ? 'RGBW' : 'SPI';
      assertPairCurrent();
      const meshReply = window.AluvisionSecureConnection
        ? await window.AluvisionSecureConnection.enrollNode({...selected,rid,receiverType,number},{isCurrent:currentPair})
        : await transact({
        V: 18,
        TYPE: 'MESH_PAIR',
        TARGET: rid,
        NUMBER: number,
        DEVTYPE: receiverType,
        KEY: key
      }, { timeout: 6200 });
      assertPairCurrent();
      if (String(meshReply.STATUS || '').toUpperCase() !== 'OK' ||
          String(meshReply.DETAIL || '').toUpperCase() !== 'MESH_PAIRED' ||
          String(meshReply.TARGETACK || '') !== '1' ||
          exactRid(meshReply.TARGETRID) !== rid) {
        throw new Error(text('Deze receiver kon niet veilig worden toegevoegd.', 'This receiver could not be added safely.', 'Ce récepteur n’a pas pu être ajouté en toute sécurité.', 'Dieser Receiver konnte nicht sicher hinzugefügt werden.'));
      }
      selected = { ...selected, ...meshReply, RID: rid, DEVTYPE: receiverType, NUMBER: number };
      if (restoring && stored) {
        if (receiverType === 'RGBW') {
          const restored = {
            V: 18, TYPE: 'CONFIG', TARGET: rid, DEVTYPE: 'RGBW', KEY: key,
            PORTMASK: Math.max(1, Math.min(3, Number(stored.portMask) || 3)),
            PHYSICAL: Math.max(1, Math.min(3, Number(stored.portMask) || 3))
          };
          assertPairCurrent();
          const configReply = await transact(restored, { timeout: 5200 });
          assertPairCurrent();
          if (String(configReply.STATUS || '').toUpperCase() !== 'OK' ||
              !['1', 'OK', 'DELIVERED'].includes(String(configReply.TARGETACK || '').toUpperCase()) ||
              exactRid(configReply.TARGETRID) !== rid) {
            throw new Error(text('De opgeslagen LED Line-instellingen konden niet worden hersteld.', 'The saved LED Line settings could not be restored.', 'Les réglages enregistrés de la LED Line n’ont pas pu être restaurés.', 'Die gespeicherten LED-Line-Einstellungen konnten nicht wiederhergestellt werden.'));
          }
          selected = { ...selected, ...configReply, RID: rid, DEVTYPE: receiverType, NUMBER: number, PORTMASK: restored.PORTMASK };
          const storedMaps = stored.rgbwChannelMaps || {};
          for (const port of [1, 2]) {
            if (!(restored.PORTMASK & (1 << (port - 1)))) continue;
            const map = rgbwChannelMap(storedMaps[port] || storedMaps[String(port)]);
            // Identity is the firmware default. Sending only actual
            // corrections keeps previously deployed receivers compatible.
            if (!map || map === 'RGBW') continue;
            assertPairCurrent();
            const mapReply = await transact({ ...restored, PORT: port, MAP: map }, { timeout: 5200 });
            assertPairCurrent();
            if (String(mapReply.STATUS || '').toUpperCase() !== 'OK' ||
                !['1', 'OK', 'DELIVERED'].includes(String(mapReply.TARGETACK || '').toUpperCase()) ||
                exactRid(mapReply.TARGETRID) !== rid || Number(mapReply.PORTACK ?? mapReply.PORT) !== port ||
                rgbwChannelMap(mapReply.MAP) !== map) {
              throw new Error(text('De opgeslagen kleurvolgorde kon niet worden hersteld.', 'The saved colour order could not be restored.', 'L’ordre des couleurs enregistré n’a pas pu être restauré.', 'Die gespeicherte Farbreihenfolge konnte nicht wiederhergestellt werden.'));
            }
            selected[`MAP${port}`] = map;
          }
        } else {
          const capacity = spiPortCapacity(stored);
          const mask = spiPortMask(stored);
          const ports = Array.from({ length: capacity }, (_, index) => index + 1)
            .filter((port) => mask & (1 << (port - 1)));
          let stagedSetup = false;
          try {
            if (capacity === 4) {
              assertPairCurrent();
              const setupReply = await transact({
                V: 18, TYPE: 'SETUP_BEGIN', TARGET: rid, DEVTYPE: 'SPI', KEY: key,
                PORT: 0, PORTCAP: capacity, PORTMASK: mask, PORTS: ports.length
              }, { timeout: 5200 });
              if (String(setupReply.STATUS || '').toUpperCase() !== 'OK' ||
                  !['1', 'OK', 'DELIVERED'].includes(String(setupReply.TARGETACK || '').toUpperCase()) ||
                  exactRid(setupReply.TARGETRID) !== rid || Number(setupReply.PORTACK ?? setupReply.PORT) !== 0) {
                throw new Error(text('De opgeslagen uitgangen konden niet veilig worden voorbereid.', 'The saved outputs could not be prepared safely.', 'Les sorties enregistrées n’ont pas pu être préparées en toute sécurité.', 'Die gespeicherten Ausgänge konnten nicht sicher vorbereitet werden.'));
              }
              stagedSetup = true;
              assertPairCurrent();
            }
            for (const port of ports) {
              assertPairCurrent();
              const setting = spiPortSetting(stored, port);
              const restored = {
                V: 18, TYPE: 'CONFIG', TARGET: rid, DEVTYPE: 'SPI', KEY: key,
                PORT: port, PORTCAP: capacity, PORTMASK: mask, PORTS: ports.length,
                PHYSICAL: setting.pixels, PHYSICALREVERSE: Number(setting.reversed),
                GROUPPIXELS: setting.groupPixels || setting.pixels, OFFSET: setting.offset
              };
              const configReply = await transact(restored, { timeout: 5200 });
              assertPairCurrent();
              const portAck = configReply.PORTACK ?? configReply.PORT;
              const portMatches = Number(portAck) === port || (capacity === 1 && port === 1 && portAck == null);
              if (String(configReply.STATUS || '').toUpperCase() !== 'OK' ||
                  !['1', 'OK', 'DELIVERED'].includes(String(configReply.TARGETACK || '').toUpperCase()) ||
                  exactRid(configReply.TARGETRID) !== rid || !portMatches) {
                throw new Error(text('De opgeslagen LED Line-instellingen konden niet worden hersteld.', 'The saved LED Line settings could not be restored.', 'Les réglages enregistrés de la LED Line n’ont pas pu être restaurés.', 'Die gespeicherten LED-Line-Einstellungen konnten nicht wiederhergestellt werden.'));
              }
              selected = {
                ...selected, ...configReply, RID: rid, DEVTYPE: 'SPI', NUMBER: number,
                PORTCAP: capacity, PORTMASK: mask, PORTS: ports.length,
                [`P${port}EN`]: 1, [`P${port}PX`]: setting.pixels,
                [`P${port}REV`]: Number(setting.reversed), [`P${port}GROUP`]: setting.groupPixels,
                [`P${port}OFFSET`]: setting.offset
              };
            }
            if (capacity === 4) {
              assertPairCurrent();
              const setupReply = await transact({
                V: 18, TYPE: 'SETUP_END', TARGET: rid, DEVTYPE: 'SPI', KEY: key,
                PORT: 0, PORTCAP: capacity, PORTMASK: mask, PORTS: ports.length
              }, { timeout: 5200 });
              if (String(setupReply.STATUS || '').toUpperCase() !== 'OK' ||
                  !['1', 'OK', 'DELIVERED'].includes(String(setupReply.TARGETACK || '').toUpperCase()) ||
                  exactRid(setupReply.TARGETRID) !== rid || Number(setupReply.PORTACK ?? setupReply.PORT) !== 0) {
                throw new Error(text('De opgeslagen uitgangen konden niet worden bevestigd.', 'The saved outputs could not be confirmed.', 'Les sorties enregistrées n’ont pas pu être confirmées.', 'Die gespeicherten Ausgänge konnten nicht bestätigt werden.'));
              }
              stagedSetup = false;
              assertPairCurrent();
            }
          } catch (error) {
            // Cancellation may end only the staging lease that this operation
            // opened. Never send cleanup through a changed gateway/session.
            if (stagedSetup && currentLink()) {
              await transact({
                V: 18, TYPE: 'SETUP_CANCEL', TARGET: rid, DEVTYPE: 'SPI', KEY: key,
                PORT: 0, PORTMASK: mask
              }, { timeout: 3200 }).catch(() => {});
            }
            throw error;
          }
        }
      }
    }
    assertPairCurrent();
    try {
      const refreshed = await discover();
      assertPairCurrent();
      const current = refreshed.devices.find((item) => exactRid(item.RID || item.rid) === rid);
      if (current) selected = { ...selected, ...current, RID: rid, NUMBER: number };
    } catch (_) {}
    assertPairCurrent();
    // A node may advertise its pre-CONFIG values from the gateway cache for a
    // brief moment after re-pairing. Keep the saved hardware configuration
    // authoritative until the node's next HELLO refreshes that cache.
    if (restoring && stored) {
      if (String(stored.receiverType || '').toUpperCase() === 'RGBW') {
        selected.PORTMASK = Math.max(1, Math.min(3, Number(stored.portMask) || 3));
      } else {
        const capacity = spiPortCapacity(stored), mask = spiPortMask(stored);
        selected.PORTCAP = capacity;
        selected.PORTMASK = mask;
        selected.PORTS = Array.from({ length: capacity }, (_, index) => index + 1).filter((port) => mask & (1 << (port - 1))).length;
        for (let port = 1; port <= capacity; port += 1) {
          const setting = spiPortSetting(stored, port);
          selected[`P${port}EN`] = Number(Boolean(mask & (1 << (port - 1))));
          selected[`P${port}PX`] = setting.pixels;
          selected[`P${port}REV`] = Number(setting.reversed);
          selected[`P${port}GROUP`] = setting.groupPixels;
          selected[`P${port}OFFSET`] = setting.offset;
        }
        selected.PHYSICAL = selected.P1PX;
        selected.PHYSICALREVERSE = selected.P1REV;
      }
    }
    return { ...selected, NUMBER: number, gateway: rid === gatewayRid, gatewayRid: gatewayRid || rid, reconnected: reconnecting, rehydrated: rehydrating };
  }

  function secureCommandCoordinator() {
    const secure = window.AluvisionSecureConnection;
    return secure && typeof secure.control === 'function' && typeof secure.hasTrustedMain === 'function' ? secure : null;
  }

  function guardMissingSecureCoordinator(fields) {
    if (secureCommandCoordinator()) return;
    const type = String(fields?.TYPE || '').toUpperCase();
    const direct = exactRid(gatewayRid);
    const hasTarget = Object.prototype.hasOwnProperty.call(fields || {}, 'TARGET');
    const target = hasTarget ? exactRid(fields.TARGET) : direct;
    const gateway = devices.find(item => exactRid(item.RID || item.rid) === direct);
    const savedGateway = window.AluvisionDirectBridge?.receivers?.[direct];
    const family = String(gateway?.DEVTYPE || gateway?.receiverType
      || savedGateway?.DEVTYPE || savedGateway?.receiverType || '').trim().toUpperCase();
    const hasFamily = Object.prototype.hasOwnProperty.call(fields || {}, 'DEVTYPE');
    const familyMatches = !hasFamily || !['SPI','RGBW'].includes(family)
      || String(fields.DEVTYPE || '').trim().toUpperCase() === family;
    // These local reads/cryptographic envelopes do not grant ownership. A
    // partial app must never downgrade LIVE, port setup, pairing or removal to
    // an old plaintext/compatibility-key command, including through transactRaw.
    const local = ['DISCOVER','INFO','STATUS','PING','SECURITY_STATUS','SECURITY_HELLO','SECURITY_AUTH',
      'RECOVERY_HELLO','RECOVERY_AUTH','TRUST_HELLO','TRUST_AUTH','SECURE_OWNER','RELEASE_STATUS'].includes(type);
    // Missing TARGET means this directly connected receiver. An explicitly
    // invalid/zero target or another family must not become a legacy broadcast.
    if (direct && direct !== '0000000000000000' && target === direct && familyMatches && local) return;
    throw Object.assign(new Error(text(
      'De beveiligde verbinding is niet volledig geladen. Sluit en heropen de app of plaats de nieuwste appversie. Je receiver en PIN blijven behouden.',
      'The secure connection did not load completely. Reopen the app or install its latest version. Your receiver and PIN are kept.',
      'La connexion sécurisée ne s’est pas chargée complètement. Rouvrez l’app ou installez sa dernière version. Votre récepteur et votre PIN sont conservés.',
      'Die sichere Verbindung wurde nicht vollständig geladen. Öffne die App erneut oder installiere die neueste Version. Receiver und PIN bleiben erhalten.')),
      {code:'SECURITY_STACK_REQUIRED'});
  }

  async function transact(fields, options = {}) {
    const type = String(fields?.TYPE || '').toUpperCase();
    const plainRead = ['DISCOVER','INFO','SECURITY_STATUS','SECURITY_HELLO','SECURITY_AUTH','RECOVERY_HELLO','RECOVERY_AUTH','TRUST_HELLO','TRUST_AUTH','SECURE_OWNER','RELEASE_STATUS'].includes(type);
    const secure = secureCommandCoordinator();
    if (secure && !plainRead) {
      if (['IDENTIFY','MESH_IDENTIFY'].includes(type) && !await secure.hasTrustedMain(gatewayRid)) return transactRaw(fields,options);
      return secure.control(fields, options);
    }
    guardMissingSecureCoordinator(fields);
    return transactRaw(fields, options);
  }

  async function transactRaw(fields, options = {}) {
    const checkCancelled = () => {
      if (options?.signal?.aborted) throw Object.assign(new Error('Herkenning geannuleerd.'), { code: 'IDENTIFY_CANCELLED' });
    };
    checkCancelled();
    guardMissingSecureCoordinator(fields);
    await ensureNativeTransportState();
    checkCancelled();
    guardMissingSecureCoordinator(fields);
    const requestedTimeout = typeof options === 'number' ? options : Number(options?.timeout || options?.timeoutMs || 3600);
    const commandType = String(fields?.TYPE || '').trim().toUpperCase();
    const secureBleResponse = selectedTransportMode === 'bluetooth' &&
      (BLE_SECURE_RESPONSE_TYPES.has(commandType) || commandType.startsWith('SECURE_FRAME_'));
    const timeout = secureBleResponse ? Math.max(20000, requestedTimeout) : requestedTimeout;
    const commandRid = exactRid(fields?.TARGET) || gatewayRid;
    const commissioningCommand = commandType === 'SECURITY_SETUP' ||
      commandType === 'MESH_MAIN' || commandType === 'MESH_PAIR';
    const cachedPairToken = commissioningCommand ?
      nfcPairTokenForRid(commandRid) : '';
    const securedFields = {
      ...fields,
      ...(commissioningCommand && cachedPairToken && !exactPairToken(fields?.PAIR_TOKEN)
        ? { PAIR_TOKEN: cachedPairToken } : {}),
      ...(['SECURITY_SETUP'].includes(commandType) && networkKey() && !fields?.KEY
        ? { KEY: networkKey() } : {})
    };
    if (!commissioningCommand) delete securedFields.PAIR_TOKEN;
    if (window.AluvisionSecureConnection || commandType === 'SECURITY_STATUS') delete securedFields.KEY;
    const testMode = String(fields?.TEST || '').trim().toUpperCase();
    const ephemeralCalibration = commandType === 'TEST' && ['FILL', 'START', 'END'].includes(testMode);
    // LIVE is latest-only. Replaying it here after a reconnect can apply a
    // stale slider value after the customer has already chosen a newer one.
    // The web command broker/resilience layer owns the single newest replay.
    const replayableCommand = REPLAYABLE_COMMANDS.has(commandType) && !ephemeralCalibration;
    const commandGeneration = transportGeneration;
    const sendOnce = async () => {
      checkCancelled();
      guardMissingSecureCoordinator(fields);
      validateDirectGateway();
      if (window.AluvisionLocalTestMode?.enabled && !['DISCOVER','INFO','STATUS','PING','SECURITY_STATUS'].includes(commandType)) {
        window.AluvisionLocalTestMode.assertReceiver(commandRid);
        if (['TRUST_HELLO','TRUST_AUTH','SECURE_OWNER','SECURITY_SETUP','SECURITY_HELLO','SECURITY_AUTH','RECOVERY_HELLO','RECOVERY_AUTH','UNPAIR','FACTORY_RESET'].includes(commandType))
          throw Object.assign(new Error('Deze beveiligingsactie is niet beschikbaar in de tijdelijke teststand zonder PIN.'),{code:'LOCAL_NOPIN_ACTION_UNAVAILABLE'});
      }
      const replyingGateway = gatewayRid, replyingGeneration = transportGeneration;
      const result = await nativeCall('transact', { fields: securedFields, timeoutMs: timeout }, Math.max(5000, timeout + 2200));
      if (gatewayRid !== replyingGateway || transportGeneration !== replyingGeneration)
        throw Object.assign(new Error('Verbinding gewijzigd. Probeer opnieuw.'), {code:'TRANSPORT_CHANGED'});
      noteTransportSuccess();
      let reply = result.fields || result.reply || result;
      // Raw native BLE, unlike native Wi-Fi, leaves legacy direct replies
      // without routing labels. A reply from this exact selected gateway is
      // direct delivery, not a satellite ACK. Keep every actual PORT/PORTMASK,
      // STATUS and explicit routing rejection unchanged; never invent them.
      if (commandRid === replyingGateway && exactRid(reply?.RID) === replyingGateway &&
          (!reply.TARGETRID || exactRid(reply.TARGETRID) === commandRid) &&
          (!securedFields.ID || String(reply.ID) === String(securedFields.ID))) {
        reply = {...reply, TARGETRID: reply.TARGETRID || commandRid,
          TARGETACK: reply.TARGETACK ?? 'DIRECT'};
      }
      const detail = String(reply?.DETAIL || '').toUpperCase();
      if (commissioningCommand && String(reply?.STATUS || '').toUpperCase() !== 'OK') {
        const explanation = detail === 'SETUP_WINDOW_EXPIRED' ? text(
          'Het eerste koppelvenster is verlopen. Zet alleen deze nog ongebruikte receiver opnieuw aan en tik op Receivers zoeken.',
          'The first-use pairing window expired. Power this unused receiver on again and tap Find receivers.',
          'La fenêtre initiale a expiré. Rallumez uniquement ce récepteur inutilisé et relancez la recherche.',
          'Das erste Kopplungsfenster ist abgelaufen. Schalte nur diesen unbenutzten Receiver erneut ein und suche ihn.') :
          /NFC_TOKEN_REQUIRED|INVALID_MESH_MAIN|PAIR_AUTH_REQUIRED|PAIR_DENIED/.test(detail) ? text(
            'De receiver heeft het toevoegen niet toegestaan. Bij een nieuwe receiver: controleer de laatste firmware en zoek hem opnieuw binnen tien minuten na inschakelen. Heeft hij al een installatie? Gebruik de bestaande installatiepincode.',
            'The receiver did not authorize adding it. For a new receiver, check its latest firmware and search again within ten minutes of powering on. Already installed? Use the existing installation PIN.',
            'Le récepteur refuse l’ajout. Pour un nouveau récepteur, vérifiez son firmware puis recherchez-le dans les dix minutes après allumage. Sinon, utilisez le code PIN existant.',
            'Der Receiver hat das Hinzufügen abgelehnt. Prüfe bei einem neuen Receiver die Firmware und suche ihn innerhalb von zehn Minuten nach Einschalten. Nutze bei einer bestehenden Installation ihre PIN.') :
          /NVS|SECURITY_/.test(detail) ? text(
            'De receiver kon de installatie niet veilig bewaren. Probeer opnieuw; bestaande instellingen zijn niet overschreven.',
            'The receiver could not safely store the installation. Try again; existing settings were not overwritten.',
            'Le récepteur n’a pas pu enregistrer l’installation. Réessayez ; les réglages existants sont conservés.',
            'Der Receiver konnte die Installation nicht sicher speichern. Versuche es erneut; bestehende Einstellungen bleiben erhalten.') : '';
        if (explanation) throw Object.assign(new Error(explanation), { code: detail });
      }
      if ((commandType === 'MESH_MAIN' && detail === 'MESH_MAIN_READY') ||
          (commandType === 'MESH_PAIR' && detail === 'MESH_PAIRED')) {
        nfcPairTokens.delete(commandRid);
      }
      return reply;
    };

    try {
      return await sendOnce();
    } catch (firstError) {
      checkCancelled();
      noteTransportFailure(firstError);
      if (!replayableCommand || !replayableTransportFailure(firstError) || commandGeneration !== transportGeneration) throw firstError;

      // Durable idempotent commands (including generation-controlled SAVE)
      // get one quiet reconnect/replay. LIVE and
      // temporary pixel previews deliberately do not: replaying an obsolete
      // value makes the physical strip lag behind the newest UI state.
      try {
        await shortPause(120);
        checkCancelled();
        if (commandGeneration !== transportGeneration) throw Object.assign(new Error('Verbinding gewijzigd. Probeer opnieuw.'), { code: 'TRANSPORT_CHANGED' });
        const reconnected = await connect({ interactive: false, forceReconnect: true });
        if (!reconnected) throw firstError;
        if (commandGeneration !== transportGeneration) throw Object.assign(new Error('Verbinding gewijzigd. Probeer opnieuw.'), { code: 'TRANSPORT_CHANGED' });
        return await sendOnce();
      } catch (retryError) {
        noteTransportFailure(retryError);
        throw retryError;
      }
    }
  }

  async function reconnectReleased(rid) {
    const target=exactRid(rid),id=meshId(),key=networkKey(),mode=selectedTransportMode,generation=transportGeneration;
    const record=await window.AluvisionSecureConnection?.store.load(id);
    const pending=record?.pendingRelease;
    if(!target||pending?.rid!==target||pending.installationId!==id||meshId()!==id||networkKey()!==key||mode!==selectedTransportMode||generation!==transportGeneration)
      throw new Error('De bewaarde verwijdering hoort niet bij deze verbinding.');
    // Rejoin only the exact receiver with a durable release intent. Do not
    // promote/re-pair a newly released standalone receiver as a side effect.
    const saved=Object.values(window.AluvisionDirectBridge?.receivers||{}).find(item=>exactRid(item.rid||item.RID)===target);
    const info=devices.find(item=>exactRid(item.RID||item.rid)===target);
    const ssid=String(saved?.apSsid||saved?.APSSID||info?.APSSID||'');
    transportSessionChanged();
    const connected=await nativeCall('connect',{expectedGatewayRid:target,
      preferredSSID:/^ALUVISION-(?:SPI|RGBW)-(?:[0-9A-F]{4}|[0-9A-F]{12})$/i.test(ssid)?ssid:''},30000);
    if(generation!==transportGeneration||meshId()!==id||networkKey()!==key||mode!==selectedTransportMode)
      throw new Error('De verbinding is gewijzigd. De verwijdering blijft bewaard.');
    const incoming=Array.isArray(connected?.devices)?connected.devices:[];
    const actual=exactRid(connected?.gatewayRid)||exactRid(incoming[0]?.RID||incoming[0]?.rid);
    if(actual!==target){invalidateRuntimeConnection();throw new Error('De gevonden receiver hoort niet bij deze verwijdering.');}
    remember(connected);
    if(!ready||gatewayRid!==target)throw new Error('De receiver start nog opnieuw.');
    return true;
  }

  const adapter = Object.freeze({
    // Both native transports have one ordered command/ACK lane, including
    // Wi-Fi's serviceUserTransactions queue. Advertise that actual capacity:
    // parallel clock probes otherwise count native queue time as radio RTT,
    // skewing receiver clocks and under-budgeting multi-receiver start times.
    get supportsConcurrentFanout() { return false; },
    supportsOta: false,
    supportsNativeOta: true,
    // Every native bridge operation already owns a bounded timeout. The shared
    // web transport must not race it with a shorter Promise.race: that reports
    // a false disconnect while iOS is still completing an AP/BLE reconnect and
    // leaves the original command running invisibly in the background.
    managesOperationTimeouts: true,
    requiresExplicitPairing: true,
    isReady: () => ready,
    connect,
    reconnectReleased,
    discover,
    pair,
    transact,
    transactRaw,
    receiverInfo: rid => devices.find(item => exactRid(item.RID || item.rid) === exactRid(rid)) || null,
    installationContext: () => Object.freeze({meshId: meshId(), networkKey: networkKey()}),
    installationReceiverRids: () => Array.from(appReceiverRIDs()),
    recoveryRequest: nativeRecoveryRequest,
    secureRecoveryRequest,
    otaPreflight: nativeOtaPreflight,
    otaStart: nativeOtaStart,
    otaStatus: nativeOtaStatus,
    otaCancel: nativeOtaCancel,
    otaJobs: nativeOtaJobs,
    otaVerify: nativeOtaVerify,
    configureSecurity(next = {}) {
      security = { compatibilityKey: String(next.compatibilityKey || ''), publicTag: String(next.publicTag || ''), meshId: String(next.meshId || '') };
      return true;
    },
    gatewayRid: () => gatewayRid,
    getConnectionDetails: () => Object.freeze({
      native: true,
      ready,
      receiverCount: devices.length,
      gatewayRid,
      transportMode: selectedTransportMode,
      securityConfigured: Boolean(security.compatibilityKey)
    })
  });

  Object.defineProperty(window, 'AluvisionNativeConnection', {
    configurable: false,
    enumerable: false,
    writable: false,
    value: Object.freeze({
      get available() { return true; },
      get mode() { return selectedTransportMode; },
      get capabilities() { return nativeTransportCapabilities; },
      get securityProvider() { return commissionSecurityProvider; },
      selectTransport: selectNativeTransport,
      scanBluetooth: scanNativeBluetooth,
      connectBluetooth: connectNativeBluetooth,
      disconnectBluetooth: disconnectNativeBluetooth,
      deriveSecurity: deriveNativeInstallationSecurity,
      secretJournal,
      secureRecoveryRequest,
      otaPreflight: nativeOtaPreflight,
      supportsNativeOta: true,
      otaStart: nativeOtaStart,
      otaStatus: nativeOtaStatus,
      otaCancel: nativeOtaCancel,
      otaJobs: nativeOtaJobs,
      otaVerify: nativeOtaVerify,
      registerSecurityProvider: registerCommissionSecurityProvider,
      setAddTarget(target = null) { chooseTarget(target); },
      getAddTarget() { return nativeReceiverAddTarget ? { ...nativeReceiverAddTarget } : null; }
    })
  });

  const registry = window.AluvisionTransportRegistry;
  if (!registry || typeof registry.register !== 'function') return;
  registry.register('wifi-ap', adapter);
  Object.defineProperty(window, 'AluvisionNativeWifi', { value: adapter, enumerable: false });
  if (!Object.prototype.hasOwnProperty.call(window, 'AluvisionPrivateWifi')) {
    Object.defineProperty(window, 'AluvisionPrivateWifi', { value: adapter, enumerable: false });
  }

  // The bridge keeps paired receivers in local storage. Filter the discovery
  // response against the gateway's current ESP-NOW inventory so a receiver
  // that disappeared is never presented as reachable from stale app data.
  const routedFetch = window.fetch.bind(window);
  window.fetch = async function aluvisionNativeFetch(input, init = {}) {
    const response = await routedFetch(input, init);
    let url;
    try {
      const raw = typeof input === 'string' ? input : input?.url || '';
      url = new URL(raw, location.href);
    } catch (_) { return response; }
    if (url.pathname !== '/api/discover') return response;
    try {
      const payload = await response.clone().json();
      const liveByRID = new Map(devices.map((item) => [exactRid(item.RID || item.rid), item]).filter(([rid]) => Boolean(rid)));
      if (Array.isArray(payload?.devices)) {
        if (!ready) {
          // Native iOS can expose its last inventory while it reconnects. Keep
          // saved receivers visible for orientation, but never revive or route
          // them until a fresh gateway inventory has been confirmed.
          payload.devices = payload.devices.map((item) => ({
            ...item,
            online: false,
            reachableViaGateway: false,
            gateway: false,
            reachability: 'unknown'
          }));
        } else {
          payload.devices = payload.devices
            .filter((item) => {
              const current = liveByRID.get(exactRid(item.rid || item.RID));
              return current && receiverReportsOnline(current);
            })
            .map((item) => ({ ...item, online: true, reachableViaGateway: true }));
        }
      }
      const headers = new Headers(response.headers);
      headers.set('content-type', 'application/json; charset=utf-8');
      headers.delete('content-length');
      return new Response(JSON.stringify(payload), {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    } catch (_) { return response; }
  };

  function chooseTarget(target) {
    nativeReceiverAddTarget = target
      ? { zoneId: String(target.zoneId || ''), groupId: String(target.groupId || ''), deviceId: '' }
      : null;
  }

  function destinationFor(target = nativeReceiverAddTarget) {
    if (!target) return null;
    try {
      const selectedZone = install?.zones?.find((item) => item.id === target.zoneId);
      const selectedGroup = selectedZone?.groups?.find((item) => item.id === target.groupId);
      return selectedZone && selectedGroup
        ? { zone: selectedZone, group: selectedGroup, zoneId: selectedZone.id, groupId: selectedGroup.id }
        : null;
    } catch (_) { return null; }
  }

  function nextNativeReceiverNumber() {
    const used = new Set((db?.devices || []).map((device) => Number(device?.number)).filter(Number.isFinite));
    for (let number = 1; number <= 250; number += 1) {
      if (!used.has(number)) return number;
    }
    return 250;
  }

  function knownReceiverRIDs() {
    return new Set(Object.values(window.AluvisionDirectBridge?.receivers || {})
      .map((item) => exactRid(item?.rid || item?.RID)).filter(Boolean));
  }

  // The transport cache proves that a receiver is trusted; db.devices proves
  // that it is present in the current app setup. Keep those concepts separate
  // so an installation can be rebuilt after local app data was lost.
  function appReceiverRIDs() {
    try {
      return new Set((Array.isArray(db?.devices) ? db.devices : [])
        .map((item) => exactRid(item?.rid || item?.RID)).filter(Boolean));
    } catch (_) {
      return new Set();
    }
  }

  function candidateNeedsReconnect(device, used = knownReceiverRIDs()) {
    const rid = exactRid(device?.RID || device?.rid);
    if (!rid || rid === gatewayRid || !used.has(rid)) return false;
    const role = String(device?.MESHROLE || device?.ROLE || '').toUpperCase();
    const unpaired = String(device?.PAIRED ?? '').trim() === '0';
    return unpaired || role === 'STANDALONE' || role === 'CANDIDATE';
  }

  function candidateName(device) {
    const type = String(device.DEVTYPE || device.receiverType || 'SPI').toUpperCase() === 'RGBW' ? 'RGBW' : 'SPI';
    const number = Math.max(0, Number(device.NUMBER || device.number) || 0);
    return number ? `${type} Receiver ${number}` : text(`Nieuwe ${type} Receiver`, `New ${type} Receiver`, `Nouveau récepteur ${type}`, `Neuer ${type}-Receiver`);
  }

  function candidateMarkup(device, configured) {
    const rid = exactRid(device.RID || device.rid);
    const type = String(device.DEVTYPE || device.receiverType || 'SPI').toUpperCase() === 'RGBW' ? 'RGBW' : 'SPI';
    const online = ready && receiverReportsOnline(device);
    const reconnect = online && candidateNeedsReconnect(device, knownReceiverRIDs());
    const canResumeSetup = configured && knownReceiverRIDs().has(rid) && !reconnect;
    const unavailable = !online || (configured && !reconnect && !canResumeSetup);
    const pixels = type === 'RGBW'
      ? text('2 uitgangen', '2 outputs', '2 sorties', '2 Ausgänge')
      : (spiPortCapacity(device) === 4
          ? text('max. 4 uitgangen', 'up to 4 outputs', 'jusqu’à 4 sorties', 'bis zu 4 Ausgänge')
          : `${Math.max(1, Number(device.P1PX || device.PHYSICAL || device.pixels) || 1)} px`);
    const role = String(device.MESHROLE || device.role || '').toUpperCase();
    const description = role === 'MAIN'
      ? text('Hoofdreceiver', 'Main receiver', 'Récepteur principal', 'Hauptreceiver')
      : (role === 'CANDIDATE' ? text('Klaar om toe te voegen', 'Ready to add', 'Prêt à ajouter', 'Bereit zum Hinzufügen') : text('LED Line', 'LED Line', 'LED Line', 'LED Line'));
    const actionLabel = !online
      ? text('Offline', 'Offline', 'Hors ligne', 'Offline')
      : (reconnect
          ? text('Opnieuw verbinden', 'Reconnect', 'Reconnecter', 'Neu verbinden')
          : (canResumeSetup ? text('Instellen', 'Set up', 'Configurer', 'Einrichten') : (configured ? text('Al toegevoegd', 'Already added', 'Déjà ajouté', 'Bereits hinzugefügt') : text('Toevoegen', 'Add', 'Ajouter', 'Hinzufügen'))));
    return `<article class="native-receiver-choice ${configured && !reconnect ? 'known' : ''} ${reconnect ? 'reconnect' : ''} ${online ? '' : 'offline'}">
      <span class="native-receiver-symbol">${type === 'RGBW' ? 'W' : '▥'}</span>
      <span class="native-receiver-info"><b>${escapeHtml(candidateName(device))}</b><small>${escapeHtml(description)} · ${escapeHtml(pixels)}</small></span>
      <div class="native-receiver-actions"><button class="button soft native-candidate-identify" type="button" ${online ? '' : 'disabled'} onclick="identifyNativeCandidate('${rid}',this)"><span aria-hidden="true">✦</span> ${text('Herkennen', 'Identify', 'Identifier', 'Erkennen')}</button>
      <button class="button native-candidate-add" data-native-rid="${rid}" type="button" ${unavailable ? 'disabled' : ''} onclick="addNativeCandidate('${rid}',this)">${actionLabel}</button></div>
    </article>`;
  }

  function renderCandidates() {
    const root = document.getElementById('nativeReceiverCandidates');
    const status = document.getElementById('receiverNfcStatus');
    if (!root) return;
    const used = knownReceiverRIDs();
    const configured = appReceiverRIDs();
    const sorted = [...devices].sort((a, b) => String(a.HWID || '').localeCompare(String(b.HWID || '')));
    const available = sorted.filter((device) => {
      const rid = exactRid(device.RID || device.rid);
      return ready && rid && (!configured.has(rid) || candidateNeedsReconnect(device, used)) && receiverReportsOnline(device);
    });
    const firstJoin = document.querySelector('.native-wifi-once');
    if (firstJoin) firstJoin.hidden = sorted.length > 0;
    const connectionCopy = pairingConnectionCopy();
    root.innerHTML = sorted.length
      ? sorted.map((device) => candidateMarkup(device, configured.has(exactRid(device.RID || device.rid)))).join('')
      : `<div class="native-receiver-empty"><b>${escapeHtml(connectionCopy.title)}</b><small>${escapeHtml(connectionCopy.detail)}</small></div>`;
    if (status) {
      status.className = `nfc-status ${sorted.length ? 'success' : 'error'}`;
      if (!sorted.length) {
        status.innerHTML = `<span><b>${text('Nog niets gevonden', 'Nothing found yet', 'Rien trouvé', 'Noch nichts gefunden')}</b><small>${text('Laat de receiver aan staan en probeer opnieuw.', 'Leave the receiver powered and try again.', 'Laissez le récepteur allumé et réessayez.', 'Lass den Receiver eingeschaltet und versuche es erneut.')}</small></span>`;
      } else if (!available.length) {
        status.innerHTML = `<span><b>${text('Geen nieuwe receiver gevonden', 'No new receiver found', 'Aucun nouveau récepteur trouvé', 'Kein neuer Receiver gefunden')}</b><small>${text('De reeds toegevoegde verlichting blijft verbonden.', 'Your existing lighting remains connected.', 'Votre éclairage existant reste connecté.', 'Deine vorhandene Beleuchtung bleibt verbunden.')}</small></span>`;
      } else {
        status.innerHTML = `<span><b>${available.length} ${text(available.length === 1 ? 'nieuwe receiver gevonden' : 'nieuwe receivers gevonden', available.length === 1 ? 'new receiver found' : 'new receivers found', available.length === 1 ? 'nouveau récepteur trouvé' : 'nouveaux récepteurs trouvés', available.length === 1 ? 'neuer Receiver gefunden' : 'neue Receiver gefunden')}</b><small>${text('Tik op Toevoegen. De gekozen LED Line knippert ter herkenning.', 'Tap Add. The selected LED Line flashes for identification.', 'Touchez Ajouter. La LED Line choisie clignote pour être identifiée.', 'Tippe auf Hinzufügen. Die gewählte LED Line blinkt zur Erkennung.')}</small></span>`;
      }
    }
  }

  window.scanNativeReceivers = async function scanNativeReceivers({ setupFirst = false } = {}) {
    const candidateRoot = document.getElementById('nativeReceiverCandidates');
    if (receiverScanBusy && receiverScanRoot === candidateRoot) return;
    receiverScanBusy = true;
    receiverScanRoot = candidateRoot;
    const scanGeneration = ++receiverScanGeneration;
    const currentScan = () => scanGeneration === receiverScanGeneration && (!candidateRoot ||
      (candidateRoot.isConnected && document.getElementById('nativeReceiverCandidates') === candidateRoot &&
        !document.getElementById('modal')?.hidden));
    pendingPairRid = '';
    const status = document.getElementById('receiverNfcStatus');
    const button = document.getElementById('nativeReceiverScanButton');
    if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
    if (status) {
      status.className = 'nfc-status scanning';
      status.innerHTML = `<span><b>${text('Receivers zoeken…', 'Searching for receivers…', 'Recherche des récepteurs…', 'Receiver werden gesucht…')}</b><small>${text('Dit duurt meestal maar enkele seconden.', 'This usually takes only a few seconds.', 'Cela ne prend généralement que quelques secondes.', 'Das dauert normalerweise nur wenige Sekunden.')}</small></span>`;
    }
    try {
      // connect() first refreshes the current gateway inventory. An already
      // connected main keeps its radio session while we look for satellites.
      // A second discovery used to repeat every ESP-NOW page immediately.
      await connect({ interactive: false });
      if (!currentScan()) return;
      renderCandidates();
      const used = knownReceiverRIDs();
      const configured = appReceiverRIDs();
      const available = devices.filter((device) => {
        const rid = exactRid(device.RID || device.rid);
        return ready && rid && (!configured.has(rid) || candidateNeedsReconnect(device, used)) && receiverReportsOnline(device);
      });
      // Discovery only lists receivers. Recognition/claim starts from the
      // customer's Add tap, never merely because a radio has connected.
      if (available.length === 1 && !configured.has(exactRid(available[0].RID || available[0].rid))) {
        if (status) {
          status.className = 'nfc-status success';
          status.innerHTML = `<span><b>${text('Receiver gevonden', 'Receiver found', 'Récepteur trouvé', 'Receiver gefunden')}</b><small>${text('Tik op Toevoegen om de instellingen te openen.', 'Tap Add to open its settings.', 'Touchez Ajouter pour ouvrir ses réglages.', 'Tippe auf Hinzufügen, um die Einstellungen zu öffnen.')}</small></span>`;
        }
      }
    } catch (error) {
      if (!currentScan()) return;
      devices = [];
      renderCandidates();
      if (status) status.querySelector('small').textContent = String(error?.message || error);
    } finally {
      if (scanGeneration === receiverScanGeneration) {
        receiverScanBusy = false;
        receiverScanRoot = null;
      }
      if (button) { button.disabled = false; button.removeAttribute('aria-busy'); }
    }
  };

  async function identifyReceiver(target, options = {}) {
    const reply = await transact({ V: 18, TYPE: 'MESH_IDENTIFY', TARGET: target, PORT: 0, KEY: networkKey() }, { timeout: 3600, ...options });
    if (String(reply.STATUS || '').toUpperCase() !== 'OK' ||
        String(reply.DETAIL || '').toUpperCase() !== 'MESH_IDENTIFIED' ||
        String(reply.TARGETACK || '') !== '1' || exactRid(reply.TARGETRID) !== target) {
      throw new Error(text('De LED Line bevestigde het knipperen niet. Controleer de verbinding en receiverfirmware.', 'The LED Line did not confirm flashing. Check the connection and receiver firmware.', 'La LED Line n’a pas confirmé le clignotement. Vérifiez la connexion et le firmware.', 'Die LED Line hat das Blinken nicht bestätigt. Prüfe Verbindung und Receiver-Firmware.'));
    }
    return reply;
  }

  window.identifyNativeCandidate = async function identifyNativeCandidate(rid, button) {
    const target = exactRid(rid);
    const device = devices.find((item) => exactRid(item.RID || item.rid) === target);
    if (!device || !target) return;
    const previous = button?.innerHTML;
    if (button) { button.disabled = true; button.textContent = text('Knippert…', 'Flashing…', 'Clignote…', 'Blinkt…'); }
    try {
      await identifyReceiver(target);
      window.toast?.(text('De gekozen LED Line knippert nu', 'The selected LED Line is flashing now', 'La LED Line choisie clignote', 'Die gewählte LED Line blinkt jetzt'));
    } catch (error) {
      window.toast?.(String(error?.message || error));
    } finally {
      if (button) { button.disabled = false; button.innerHTML = previous; }
    }
  };

  // One visible hand-off owns the Add operation. A cancelled/closed panel
  // must never reappear when a late radio reply finally arrives.
  function beginPairActivity(rid) {
    const activity = { rid, cancelled: false, observer: null };
    const host = document.getElementById('modal');
    activity.checkClosed = (records = []) => {
      // A close followed by another modal in the same event must still retire
      // Add. Looking only at the final hidden=false would miss that transition.
      if (host?.hidden || records.some(record => record.attributeName === 'hidden' && record.oldValue !== null)) {
        activity.cancelled = true;
      }
    };
    if (host && typeof MutationObserver === 'function') {
      activity.observer = new MutationObserver(records => activity.checkClosed(records));
      activity.observer.observe(host, { attributes: true, attributeFilter: ['hidden'], attributeOldValue: true });
    }
    receiverPairActivity = activity;
    return activity;
  }
  function pairActivityCurrent(activity = receiverPairActivity) {
    activity?.checkClosed?.(activity.observer?.takeRecords() || []);
    return !activity || (activity === receiverPairActivity && !activity.cancelled && !document.getElementById('modal')?.hidden);
  }
  function endPairActivity(activity) {
    activity?.observer?.disconnect();
    if (receiverPairActivity === activity) receiverPairActivity = null;
  }
  function showPairFailure(error, target, activity = receiverPairActivity) {
    if (!pairActivityCurrent(activity)) return;
    // Error messages never depend on the discovery DOM still existing. That
    // panel has already been replaced by identification or setup at this point.
    const message = text('De instellingen konden nog niet worden geopend. Je receiver en keuzes blijven bewaard. Controleer de verbinding en probeer opnieuw.',
      'The settings could not be opened yet. Your receiver and choices are kept. Check the connection and try again.',
      'Les réglages n’ont pas pu être ouverts. Votre récepteur et vos choix sont conservés. Vérifiez la connexion et réessayez.',
      'Die Einstellungen konnten noch nicht geöffnet werden. Receiver und Auswahl bleiben gespeichert. Prüfe die Verbindung und versuche es erneut.');
    chooseTarget(target);
    window.modal?.(`<section class="native-pair-error" data-native-pair-error role="alert"><div class="eyebrow">${text('RECEIVER TOEVOEGEN', 'ADD RECEIVER', 'AJOUTER UN RÉCEPTEUR', 'RECEIVER HINZUFÜGEN')}</div><h1>${text('Instellen onderbroken', 'Setup interrupted', 'Configuration interrompue', 'Einrichtung unterbrochen')}</h1><p class="sub">${message}</p><div class="v20-pair-actions"><button type="button" class="button soft" onclick="closeModal()">${text('Later', 'Later', 'Plus tard', 'Später')}</button><button type="button" class="button" onclick="retryNativeReceiverSetup()">${text('Opnieuw proberen', 'Try again', 'Réessayer', 'Erneut versuchen')}</button></div></section>`, { viewKey: 'native-pair-error' });
  }
  window.retryNativeReceiverSetup = () => {
    if (receiverPairBusy) return;
    const target = nativeReceiverAddTarget ? { ...nativeReceiverAddTarget } : null;
    if (typeof window.openAddReceiver === 'function') {
      // Use the shared Wi-Fi/Bluetooth choice screen, retaining the original
      // destination even when Add was opened from a group.
      window.openAddReceiver(target);
      chooseTarget(target);
    } else pairingModal(target);
  };
  async function openNativeReceiverSetup(device, target, activity = receiverPairActivity) {
    if (!pairActivityCurrent(activity)) return;
    window.modal?.(`<section class="native-pair-progress"><h2>${text('Instellingen openen…', 'Opening settings…', 'Ouverture des réglages…', 'Einstellungen werden geöffnet…')}</h2><p class="sub">${escapeHtml(candidateName(device))}</p></section>`, { viewKey: 'native-pair-handoff' });
    if (target?.zoneId && target?.groupId && typeof window.startPairingForGroup === 'function') {
      await window.startPairingForGroup(device.id, target.zoneId, target.groupId);
    } else {
      if (typeof window.startPairing !== 'function') throw new Error('SETUP_UNAVAILABLE');
      await window.startPairing(device.id);
    }
    if (pairActivityCurrent(activity) && document.querySelector('.native-pair-progress')) throw new Error('SETUP_NOT_OPENED');
  }

  window.addNativeCandidate = async function addNativeCandidate(rid, button) {
    if (receiverPairBusy) return;
    const selected = exactRid(rid);
    const device = devices.find((item) => exactRid(item.RID || item.rid) === selected);
    const used = knownReceiverRIDs();
    const configured = appReceiverRIDs();
    const reconnecting = candidateNeedsReconnect(device, used);
    if (ready && selected && device && receiverReportsOnline(device) &&
        configured.has(selected) && used.has(selected) && !reconnecting) {
      // A transport record can exist before PIN/port setup was completed.
      // Resume that receiver's real wizard instead of leaving Add disabled or
      // attempting to claim an already owned receiver again.
      receiverPairBusy = true;
      const activity = beginPairActivity(selected);
      try {
        await connect({ interactive: false });
        validateDirectGateway();
        const existing = (db?.devices || []).find(item => exactRid(item.rid || item.RID) === selected);
        if (!existing) throw new Error(text('Receiver niet meer beschikbaar', 'Receiver is no longer available', 'Récepteur indisponible', 'Receiver nicht verfügbar'));
        const target = nativeReceiverAddTarget;
        await openNativeReceiverSetup(existing, target, activity);
      } catch (error) {
        showPairFailure(error, nativeReceiverAddTarget, activity);
      } finally {
        receiverPairBusy = false;
        endPairActivity(activity);
      }
      return;
    }
    if (!ready || !selected || !device || !receiverReportsOnline(device) || (configured.has(selected) && !reconnecting)) {
      const status = document.getElementById('receiverNfcStatus');
      if (status) {
        status.className = 'nfc-status error';
        status.innerHTML = `<span><b>${text('Receiver niet beschikbaar', 'Receiver unavailable', 'Récepteur indisponible', 'Receiver nicht verfügbar')}</b><small>${text('Controleer de verbinding opnieuw.', 'Check the connection again.', 'Vérifiez à nouveau la connexion.', 'Prüfe die Verbindung erneut.')}</small></span>`;
      }
      return;
    }
    const selectedRole = String(device.MESHROLE || device.ROLE || '').toUpperCase();
    if (selected === gatewayRid && selectedRole === 'MAIN' && !used.has(selected) &&
        typeof window.v20CheckReceiverSecurity === 'function' && commissionSecurityProvider?.getStatus) {
      receiverPairBusy = true;
      const activity = beginPairActivity(selected);
      let status;
      try {
        status = await commissionSecurityProvider.getStatus(true);
        if (!pairActivityCurrent(activity)) return;
      } catch (error) {
        showPairFailure(error, nativeReceiverAddTarget, activity);
        return;
      } finally { receiverPairBusy = false; endPairActivity(activity); }
      if (!status?.configured || !status?.trusted) {
        const target = nativeReceiverAddTarget ? { ...nativeReceiverAddTarget } : null;
        await window.v20CheckReceiverSecurity({
          id: 'native-restore-' + selected, rid: selected,
          name: device.name || device.HWID || 'Hoofdreceiver',
          receiverType: String(device.DEVTYPE || device.receiverType || '').toUpperCase() === 'RGBW' ? 'RGBW' : 'SPI'
        }, async () => {
          chooseTarget(target);
          await window.addNativeCandidate(selected, null);
        });
        return;
      }
    }
    receiverPairBusy = true;
    const activity = beginPairActivity(selected);
    const previousLabel = button?.textContent || '';
    const pairButtons = [...document.querySelectorAll('.native-candidate-add')];
    const priorDisabledState = new Map(pairButtons.map((item) => [item, item.disabled]));
    pairButtons.forEach((item) => { item.disabled = true; });
    if (button) button.textContent = text('Toevoegen…', 'Adding…', 'Ajout…', 'Wird hinzugefügt…');
    pendingPairRid = selected;
    pendingReconnectRid = reconnecting ? selected : '';
    try {
      await window.pairNfcReceiver();
    } catch (error) {
      showPairFailure(error, nativeReceiverAddTarget, activity);
    } finally {
      pendingPairRid = '';
      pendingReconnectRid = '';
      receiverPairBusy = false;
      endPairActivity(activity);
      priorDisabledState.forEach((disabled, item) => {
        if (item.isConnected) item.disabled = disabled;
      });
      if (button?.isConnected) button.textContent = previousLabel;
    }
  };

  function pairingConnectionCopy() {
    if (selectedTransportMode === 'bluetooth') return {
      title: text('Zoeken via je hoofdreceiver', 'Search through your main receiver', 'Rechercher via le récepteur principal', 'Über den Hauptreceiver suchen'),
      detail: text('Je hoofdreceiver blijft verbonden. Zet de extra receiver aan, kies Receivers zoeken en tik op Toevoegen bij de juiste receiver.', 'Your main receiver stays connected. Power the extra receiver, choose Find receivers and tap Add beside the right receiver.', 'Le récepteur principal reste connecté. Allumez le récepteur supplémentaire, recherchez-le puis choisissez Ajouter.', 'Dein Hauptreceiver bleibt verbunden. Schalte den weiteren Receiver ein, suche ihn und tippe beim richtigen Receiver auf Hinzufügen.'),
      button: text('Receivers zoeken', 'Find receivers', 'Rechercher les récepteurs', 'Receiver suchen')
    };
    if (nativeTransportCapabilities.wifiAutoJoin === false) return {
      title: text('Verbind via iPhone-instellingen', 'Connect in iPhone Settings', 'Connectez-vous dans Réglages iPhone', 'In iPhone-Einstellungen verbinden'),
      detail: text('Deze appversie kan wifi niet automatisch kiezen. Open Instellingen → Wifi, kies het ALUVISION-netwerk van je hoofdreceiver en keer terug. Wachtwoord: Aluvision20.', 'This app build cannot choose Wi-Fi automatically. Open Settings → Wi-Fi, choose your main receiver’s ALUVISION network and return. Password: Aluvision20.', 'Cette version ne peut pas choisir le Wi-Fi automatiquement. Ouvrez Réglages → Wi-Fi, choisissez le réseau ALUVISION du récepteur principal et revenez. Mot de passe : Aluvision20.', 'Diese App-Version kann WLAN nicht automatisch wählen. Öffne Einstellungen → WLAN, wähle das ALUVISION-Netzwerk deines Hauptreceivers und kehre zurück. Passwort: Aluvision20.'),
      button: text('Verbinding controleren', 'Check connection', 'Vérifier la connexion', 'Verbindung prüfen')
    };
    return {
      title: text('Verbinden met je hoofdreceiver', 'Connect to your main receiver', 'Connecter au récepteur principal', 'Mit dem Hauptreceiver verbinden'),
      detail: text('Laat de receiver aan staan en bevestig Verbind als iOS hierom vraagt. Lukt dit niet, kies zijn ALUVISION-netwerk in Instellingen → Wifi en keer terug.', 'Keep the receiver powered and confirm Join if iOS asks. If this fails, choose its ALUVISION network in Settings → Wi-Fi and return.', 'Laissez le récepteur allumé et confirmez si iOS le demande. Sinon, choisissez son réseau ALUVISION dans Réglages → Wi-Fi puis revenez.', 'Lass den Receiver eingeschaltet und bestätige Verbinden, falls iOS fragt. Wähle sonst sein ALUVISION-Netzwerk unter Einstellungen → WLAN und kehre zurück.'),
      button: text('Verbinding controleren', 'Check connection', 'Vérifier la connexion', 'Verbindung prüfen')
    };
  }

  async function pairingModal(target = null) {
    chooseTarget(target);
    await ensureNativeTransportState().catch(() => {});
    const connectionCopy = pairingConnectionCopy();
    const destination = destinationFor(target);
    const destinationMarkup = destination ? `<div class="group-pair-target"><span><b>${text('Wordt toegevoegd aan', 'Will be added to', 'Sera ajouté à', 'Wird hinzugefügt zu')}</b><small>${escapeHtml(destination.zone.name)} → ${escapeHtml(destination.group.name)}</small></span><span class="scope">${text('AL GEKOZEN', 'PRESELECTED', 'PRÉSÉLECTIONNÉ', 'VORAUSGEWÄHLT')}</span></div>` : '';
    window.modal(`<section class="v20-private-pair" data-preserve-transport-copy>
      <div class="eyebrow">${text('RECEIVER TOEVOEGEN', 'ADD RECEIVER', 'AJOUTER UN RÉCEPTEUR', 'RECEIVER HINZUFÜGEN')}</div>
      <h1>${text('Maak verbinding met je verlichting', 'Connect to your lighting', 'Connectez votre éclairage', 'Mit deiner Beleuchtung verbinden')}</h1>
      <p class="sub">${escapeHtml(connectionCopy.detail)}</p>
      ${destinationMarkup}
      <div class="v20-pair-visual native-wifi-pair" aria-hidden="true"><div class="v20-phone-glyph"><i>APP</i></div><div class="v20-pair-waves"><i></i><i></i><i></i></div><div class="v20-hub-glyph"><b>R</b><small>LED</small></div></div>
      <div class="native-wifi-once"><span><b>${escapeHtml(connectionCopy.title)}</b><small>${text('Internet is niet nodig.', 'No internet is needed.', 'Internet n’est pas nécessaire.', 'Kein Internet nötig.')}</small></span></div>
      <div id="receiverNfcStatus" class="nfc-status"><span><b>${text('Verbinding controleren', 'Checking connection', 'Vérification de la connexion', 'Verbindung wird geprüft')}</b><small>${text('Internet is niet nodig. De app zoekt rechtstreeks naar je verlichting.', 'No internet is needed. The app searches directly for your lighting.', 'Aucune connexion Internet n’est nécessaire. L’app recherche directement votre éclairage.', 'Kein Internet nötig. Die App sucht direkt nach deiner Beleuchtung.')}</small></span></div>
      <div id="nativeReceiverCandidates" class="native-receiver-candidates"></div>
      ${window.AluvisionLocalTestMode?.enabled ? '<p class="sub" data-local-no-pin-notice>Teststand · PIN tijdelijk uitgeschakeld</p>' : `<button type="button" class="button soft" data-existing-installation-entry onclick="AluvisionAccountlessRecovery.openExisting('connect')">${text('Bestaande installatie verbinden', 'Connect existing installation', 'Connecter l’installation existante', 'Bestehende Installation verbinden')}</button>`}
      <div class="v20-pair-actions"><button class="button soft" type="button" onclick="closeModal()">${text('Annuleren', 'Cancel', 'Annuler', 'Abbrechen')}</button><button id="nativeReceiverScanButton" class="button" type="button" onclick="scanNativeReceivers()">${escapeHtml(connectionCopy.button)}</button></div>
    </section>`);
    setTimeout(() => window.scanNativeReceivers?.(), 0);
  }

  function resumeReceiverScan() {
    if (document.getElementById('nativeReceiverCandidates')) window.scanNativeReceivers?.();
  }

  window.addEventListener('aluvision-app-active', resumeReceiverScan);
  window.addEventListener('pageshow', resumeReceiverScan);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') resumeReceiverScan();
  });

  window.addEventListener('load', () => {
    window.openAddReceiver = () => pairingModal();
    window.openAddReceiverForGroup = () => {
      try {
        if (!zone || !group) return window.toast?.(text('Open eerst een groep', 'Open a group first', 'Ouvrez d’abord un groupe', 'Öffne zuerst eine Gruppe'));
        return pairingModal({ zoneId: zone.id, groupId: group.id });
      } catch (_) { return pairingModal(); }
    };
    window.copyNativeWifiPassword = async (button) => {
      try {
        await navigator.clipboard.writeText('Aluvision20');
        const old = button.textContent;
        button.textContent = text('Gekopieerd', 'Copied', 'Copié', 'Kopiert');
        setTimeout(() => { if (button?.isConnected) button.textContent = old; }, 1400);
      } catch (_) {
        window.toast?.('Aluvision20');
      }
    };
    window.pairNfcReceiver = async () => {
      const selectedTarget = nativeReceiverAddTarget ? { ...nativeReceiverAddTarget } : null;
      const activity = receiverPairActivity;
      const reconnecting = Boolean(pendingReconnectRid);
      let status = document.getElementById('receiverNfcStatus');
      if (status) {
        status.className = 'nfc-status scanning';
          status.innerHTML = `<span><b>${text('Receivers zoeken…', 'Searching for receivers…', 'Recherche des récepteurs…', 'Receiver werden gesucht…')}</b><small>${text('De app controleert je hoofdreceiver en alle beschikbare LED Lines.', 'The app is checking your main receiver and all available LED Lines.', 'L’app vérifie votre récepteur principal et toutes les LED Lines disponibles.', 'Die App prüft deinen Hauptreceiver und alle verfügbaren LED Lines.')}</small></span>`;
      }
      try {
        const response = await api('/api/pair', { number: nextNativeReceiverNumber() });
        if (response?.cancelled) {
          if (response.cancelReason === 'other-receiver') pairingModal(selectedTarget);
          else if (!['closed', 'superseded', 'cancelled'].includes(response.cancelReason)) showPairFailure(null, selectedTarget, activity);
          return;
        }
        if (!pairActivityCurrent(activity)) return;
        if (!response?.ok) throw new Error(response?.error || text('Geen receiver gevonden', 'No receiver found', 'Aucun récepteur trouvé', 'Kein Receiver gefunden'));
        const previous = db.devices.find((item) => item.id === response.device.id);
        const gateway = String(response.transport?.gateway?.rid || '').toUpperCase();
        const isGateway = gateway === String(response.device.rid || '').toUpperCase();
        const normalizer = typeof window.normaliseDevice === 'function'
          ? window.normaliseDevice
          : ((value, old) => ({ ...old, ...value }));
        const device = normalizer({
          ...response.device,
          online: true,
          reachableViaGateway: true,
          gateway: isGateway
        }, previous);
        db.devices = db.devices.filter((item) => item.id !== device.id);
        db.devices.push(device);
        db.transportStatus = response.transport || {
          gatewayReady: true,
          gateway: isGateway ? { rid: device.rid, hardwareId: device.hardwareId } : {},
          transport: `NATIVE_${selectedTransportMode.toUpperCase()}`
        };
        save();
        if (reconnecting) {
          // Reconnecting a retained receiver must also verify the main PIN.
          // A previous transport record is not proof that setup completed.
          await window.v20CheckReceiverSecurity?.(device, () => {
            window.closeModal?.();
            window.toast?.(text('Receiver opnieuw verbonden', 'Receiver reconnected', 'Récepteur reconnecté', 'Receiver neu verbunden'));
          });
        } else {
          await openNativeReceiverSetup(device, selectedTarget, activity);
        }
      } catch (error) {
        showPairFailure(error, selectedTarget, activity);
        throw error;
      }
    };
    document.documentElement.classList.add('native-ios');
    document.head.insertAdjacentHTML('beforeend', `<style>
      .native-receiver-candidates{display:grid;gap:9px;margin-top:12px}
      .native-receiver-choice{display:grid;grid-template-columns:42px minmax(0,1fr);gap:9px;align-items:center;padding:11px;border:1px solid var(--line);border-radius:15px;background:var(--panel-2);min-width:0}
      .native-receiver-actions{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.35fr);gap:9px;min-width:0}
      .native-receiver-actions>.button{min-width:0;width:100%;white-space:normal;overflow-wrap:anywhere;line-height:1.25}
      .native-receiver-choice.known,.native-receiver-choice.offline{opacity:.68}.native-receiver-choice.reconnect{border-color:color-mix(in srgb,var(--accent,#c94e46) 42%,var(--line))}.native-receiver-symbol{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:#202120;color:#fff;font-weight:950}
      .native-receiver-info{min-width:0}.native-receiver-info b,.native-receiver-info small{display:block}.native-receiver-info small{margin-top:3px;color:var(--mut);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .native-receiver-choice .button{min-height:40px;padding:8px 11px}.native-receiver-empty{padding:16px;text-align:center;border:1px dashed var(--line);border-radius:15px}.native-receiver-empty b,.native-receiver-empty small{display:block}.native-receiver-empty small{margin-top:5px;color:var(--mut);line-height:1.45}
      .native-wifi-once{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0 0;padding:11px 12px;border:1px solid var(--line);border-radius:14px;background:var(--panel-2)}.native-wifi-once[hidden]{display:none}.native-wifi-once b,.native-wifi-once small{display:block}.native-wifi-once small{margin-top:2px;color:var(--mut)}
      @media(max-width:350px){.native-receiver-actions{grid-template-columns:1fr}.native-receiver-actions>.native-candidate-add{grid-row:1}}
    </style>`);
    window.dispatchEvent(new CustomEvent('aluvision-native-ready'));
  }, { once: true });
})();
