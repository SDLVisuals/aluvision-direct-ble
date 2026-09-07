/*
 * Aluvision full-app browser bridge
 *
 * The user interface in index.html is the exact document served by the local
 * Aluvision app.  This bridge replaces only its localhost JSON endpoints, so
 * the same interface can run as a static GitHub Pages PWA and talk directly to
 * receivers through a replaceable controller transport.  The production path
 * is a local Wi-Fi AP gateway; the original Web-Bluetooth link remains a
 * deliberately hidden recovery adapter until the AP firmware is proven on
 * hardware. Receiver-to-receiver delivery remains ESP-NOW.
 */
(() => {
  'use strict';

  const UUIDS = Object.freeze({
    service: '8f0d1100-8b2b-4ca3-a9d5-8a39aaf11700',
    command: '8f0d1101-8b2b-4ca3-a9d5-8a39aaf11700',
    status: '8f0d1102-8b2b-4ca3-a9d5-8a39aaf11700',
    info: '8f0d1103-8b2b-4ca3-a9d5-8a39aaf11700'
  });
  const BRIDGE_KEY = 'aluvision.faithful.bridge.v1';
  const APP_KEY = 'aluv12';
  const DIRECT_KEY = 'aluvision.full-direct.v3';
  const MAX_APP_STATE_BYTES = 2 * 1024 * 1024;
  const COMMAND_ACTIONS = new Set([
    'LIVE', 'SAVE', 'STATUS', 'CONFIG', 'IDENTIFY', 'RGBW_TEST', 'CALIBRATE',
    'CALIBRATE_FILL', 'CALIBRATE_END', 'CALIBRATE_START',
    'CALIBRATE_CLEAR', 'SETUP_BEGIN', 'SETUP_KEEPALIVE',
    'SETUP_END', 'SETUP_CANCEL', 'UNPAIR'
  ]);
  const CALIBRATION_ACTIONS = new Set([
    'CALIBRATE', 'CALIBRATE_FILL', 'CALIBRATE_END', 'CALIBRATE_START'
  ]);
  const LATEST_ONLY_ACTIONS = new Set(['LIVE', ...CALIBRATION_ACTIONS]);
  const PRIMARY_TRANSPORT = 'wifi-ap';
  const RECOVERY_TRANSPORT = 'ble-recovery';
  // Radio traffic is lossy by nature. Do not put a LED Line in a visible
  // cooldown after only two missed UDP/ESP-NOW acknowledgements; native UDP
  // already retries once and the circuit now only opens after a sustained
  // outage.
  const TARGET_FAILURE_LIMIT = 4;
  const TARGET_CIRCUIT_MS = 3000;
  const MAX_CONCURRENT_TARGETS = 4;
  const CONNECT_TIMEOUT_MS = 7000;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const nativeFetch = window.fetch.bind(window);
  const sessionToken = `static-${randomHex64()}`;
  const ackWaiters = new Map();
  let notificationBuffer = '';
  let commandSequence = Math.floor(Date.now() % 900000000) || 1;
  let commandTail = Promise.resolve();
  let bleSessionEpoch = 0;
  let recoveryConnectPromise = null;
  const phaseClocks = new Map();
  const targetHealth = new Map();
  const setupTransactions = new Map();
  const transportAdapters = new Map();
  let otaController = null;

  const ble = {
    device: null,
    server: null,
    command: null,
    status: null,
    info: null,
    connected: false,
    rid: '',
    receiverType: 'SPI',
    fields: {},
    connectionState: 'idle',
    lastError: '',
    connectedAt: 0,
    disconnectedAt: 0
  };

  function withTimeout(promise, milliseconds, message) {
    let timer = 0;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), milliseconds);
    });
    return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(timer));
  }

  function clamp(value, minimum, maximum, fallback = minimum) {
    const parsed = Number(value);
    return Math.max(minimum, Math.min(maximum, Number.isFinite(parsed) ? Math.round(parsed) : fallback));
  }

  function popcount4(value) {
    let mask = clamp(value, 0, 15, 0), count = 0;
    while (mask) { count += mask & 1; mask >>>= 1; }
    return count;
  }

  function receiverPortCapacity(source = {}, type = 'SPI') {
    if (String(type).toUpperCase() === 'RGBW') return 2;
    return Number(source.PORTCAP ?? source.portCapacity ?? source.spiPortCapability) === 4 ? 4 : 1;
  }

  function receiverPortMask(source = {}, type = 'SPI', fallback = 1) {
    const capacity = receiverPortCapacity(source, type);
    const maximum = capacity === 4 ? 15 : capacity === 2 ? 3 : 1;
    const declared = source.PORTMASK ?? source.portMask;
    return clamp(declared, 1, maximum, clamp(fallback, 1, maximum, 1));
  }

  function spiPortSettings(source = {}, previous = {}, port = 1) {
    const stored = previous.spiPorts?.[port] || previous.spiPorts?.[String(port)] || {};
    const prefix = `P${port}`;
    const pixels = clamp(
      source[`${prefix}PX`] ?? source[`${prefix}PHYSICAL`] ?? stored.pixels ?? (port === 1 ? source.PHYSICAL ?? previous.pixels : 25),
      1, 1024, port === 1 ? clamp(previous.pixels, 1, 1024, 60) : 25
    );
    const reverseValue = source[`${prefix}REV`] ?? source[`${prefix}PHYSICALREVERSE`] ?? stored.reversed ?? stored.physicalReverse ?? (port === 1 ? source.PHYSICALREVERSE ?? previous.physicalReverse : 0);
    return {
      pixels,
      reversed: ['1', 1, true, 'true'].includes(reverseValue),
      physicalReverse: ['1', 1, true, 'true'].includes(reverseValue),
      groupPixels: clamp(source[`${prefix}GROUP`] ?? stored.groupPixels ?? pixels, 1, 65535, pixels),
      offset: clamp(source[`${prefix}OFFSET`] ?? stored.offset, 0, 65535, 0)
    };
  }

  function randomHex(byteLength = 8) {
    const bytes = new Uint8Array(byteLength);
    crypto.getRandomValues(bytes);
    if (bytes.every((value) => value === 0)) bytes[bytes.length - 1] = 1;
    return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  function randomHex64() { return randomHex(8); }
  function randomHex256() { return randomHex(32); }

  function loadBridge() {
    try {
      const saved = JSON.parse(localStorage.getItem(BRIDGE_KEY) || 'null');
      if (saved && typeof saved === 'object') {
        saved.receivers ||= {};
        saved.browserDeviceIds ||= {};
        const storedNetworkKey = String(saved.networkKey || '').toUpperCase();
        const storedMasterSecret = String(saved.masterSecret || '').toUpperCase();
        const storedPublicTag = String(saved.publicTag || '').toUpperCase();
        const legacyKey = /^[0-9A-F]{16}$/.test(storedNetworkKey) ? storedNetworkKey : '';
        saved.masterSecret = /^[0-9A-F]{64}$/.test(storedMasterSecret)
          ? storedMasterSecret : randomHex256();
        // Existing receivers continue to understand their 64-bit network key.
        // New installations also get that compatibility key independently; it
        // is never reused as, or displayed as, the 256-bit master secret.
        saved.networkKey = legacyKey || randomHex64();
        saved.publicTag = /^[0-9A-F]{6}$/.test(storedPublicTag) ? storedPublicTag : randomHex(3);
        saved.secretVersion = 2;
        saved.legacyKeyMigrated = Boolean(legacyKey);
        saved.revision = clamp(saved.revision, 0, Number.MAX_SAFE_INTEGER, 0);
        const receiverEntries = Object.entries(saved.receivers).map(([key, receiver]) => ({
          receiver: receiver && typeof receiver === 'object' ? receiver : {},
          rid: exactRid(receiver?.rid || receiver?.RID || key)
        })).filter((entry) => entry.rid);
        const storedPreferred = exactRid(saved.preferredGatewayRid);
        // Older app releases did not persist preferredGatewayRid. Recover it
        // deterministically from the receiver that was the gateway, then from
        // receiver number 1/the lowest receiver number. Leaving it empty would
        // allow an unrelated standalone AP to become a second mesh main.
        // Some V20 preview builds accidentally marked every discovered node as
        // `gateway:true`.  Never trust that legacy flag for migration: receiver
        // 1 (or otherwise the lowest stable number/RID) is the only safe,
        // deterministic MAIN candidate.
        const migratedGateway = [...receiverEntries].sort((a, b) => {
          const aNumber = clamp(a.receiver.number ?? a.receiver.NUMBER, 1, 250, 250);
          const bNumber = clamp(b.receiver.number ?? b.receiver.NUMBER, 1, 250, 250);
          return aNumber - bNumber || a.rid.localeCompare(b.rid);
        })[0];
        saved.preferredGatewayRid = storedPreferred && receiverEntries.some((entry) => entry.rid === storedPreferred)
          ? storedPreferred : (migratedGateway?.rid || '');
        return saved;
      }
    } catch (_) {}
    return {
      masterSecret: randomHex256(), networkKey: randomHex64(), publicTag: randomHex(3),
      secretVersion: 2, legacyKeyMigrated: false, receivers: {}, browserDeviceIds: {},
      preferredGatewayRid: '', revision: 0, sharedState: null
    };
  }

  const bridge = loadBridge();
  bridge.commandGenerations ||= {};
  const bodyGenerations = new WeakMap();
  const bodyStarts = new WeakMap();
  const bodyHostStarts = new WeakMap();
  const receiverClocks = new Map();
  window.addEventListener('aluvision-transport-session-changed', () => receiverClocks.clear());

  function generationFloorFromFields(fields = {}) {
    return Math.max(
      clamp(fields.GEN, 0, 4294967295, 0),
      clamp(fields.APPLIEDGEN, 0, 4294967295, 0),
      clamp(fields.PENDINGGEN, 0, 4294967295, 0),
      clamp(fields.P1GEN, 0, 4294967295, 0),
      clamp(fields.P1ACCEPTEDGEN, 0, 4294967295, 0),
      clamp(fields.P1APPLIEDGEN, 0, 4294967295, 0),
      clamp(fields.P1PENDING, 0, 4294967295, 0),
      clamp(fields.P1PENDINGGEN, 0, 4294967295, 0),
      clamp(fields.P2GEN, 0, 4294967295, 0),
      clamp(fields.P2ACCEPTEDGEN, 0, 4294967295, 0),
      clamp(fields.P2APPLIEDGEN, 0, 4294967295, 0),
      clamp(fields.P2PENDING, 0, 4294967295, 0),
      clamp(fields.P2PENDINGGEN, 0, 4294967295, 0),
      clamp(fields.P3GEN, 0, 4294967295, 0),
      clamp(fields.P3PENDING, 0, 4294967295, 0),
      clamp(fields.P4GEN, 0, 4294967295, 0),
      clamp(fields.P4PENDING, 0, 4294967295, 0)
    );
  }

  function reserveGeneration(body, rid, reportedFloor = 0) {
    let commandMap = bodyGenerations.get(body);
    if (!commandMap) {
      commandMap = new Map();
      bodyGenerations.set(body, commandMap);
    }
    if (!reportedFloor && commandMap.has(rid)) return commandMap.get(rid);
    const requested = clamp(body?.generation ?? body?.state?.commandGeneration, 0, 4294967295, 0);
    const persisted = clamp(bridge.commandGenerations[rid], 0, 4294967295, 0);
    const current = clamp(commandMap.get(rid), 0, 4294967295, 0);
    let next = Math.max(requested, persisted + 1, current, reportedFloor + 1);
    if (next <= 0 || next > 4294967295) next = 1;
    commandMap.set(rid, next);
    bridge.commandGenerations[rid] = next;
    persistBridge();
    return next;
  }

  function commandMetadata(fields, body, rid, receiverType, maySchedule = false) {
    if (!rid) return fields;
    fields.GEN = reserveGeneration(body, rid);
    if (maySchedule) {
      const start = bodyStarts.get(body)?.get(rid);
      if (receiverType === 'RGBW' && start?.startAtUs) fields.STARTATUS = start.startAtUs;
      if (receiverType === 'SPI' && start?.startAtMs != null) {
        fields.STARTATMS = start.startAtMs;
        // Both fields use the TARGET receiver's clock. Legacy SPI gateways
        // otherwise append their own uptime, which can differ by hours and
        // makes a valid node deadline look out of range. Estimate arrival using
        // the measured one-way latency; never mix two receivers' clock origins.
        fields.CLOCKMS = Math.round(monotonicNowMs() + start.offsetMs + start.rttMs / 2) >>> 0;
      }
    }
    return fields;
  }

  function persistBridge() {
    try {
      localStorage.setItem(BRIDGE_KEY, JSON.stringify(bridge));
      return true;
    } catch (_) {
      return false;
    }
  }

  // Commit an old 64-bit-only record as the v2 accountless installation
  // envelope immediately, without exposing any secret through an API.
  persistBridge();

  function removeLegacyReceiver216(state) {
    if (!state || typeof state !== 'object') return false;
    const isPlaceholder = (device) => device?.id === 'rx-192-168-0-216' || device?.hardwareId === 'ALV-RX-216';
    const before = Array.isArray(state.devices) ? state.devices.length : 0;
    if (Array.isArray(state.devices)) state.devices = state.devices.filter((device) => !isPlaceholder(device));
    (state.installations || []).forEach((installation) => (installation.zones || []).forEach((zone) =>
      (zone.groups || []).forEach((group) => {
        group.receivers = (group.receivers || []).filter((line) => line?.deviceId !== 'rx-192-168-0-216');
      })));
    const changed = before !== (state.devices || []).length || state.receiver216Migrated !== true;
    state.receiver216Migrated = true;
    return changed;
  }

  function suppressLegacyReceiverSeed() {
    [APP_KEY, 'aluv11'].forEach((key) => {
      try {
        const state = JSON.parse(localStorage.getItem(key) || 'null');
        if (removeLegacyReceiver216(state)) localStorage.setItem(key, JSON.stringify(state));
      } catch (_) {}
    });
    if (removeLegacyReceiver216(bridge.sharedState)) persistBridge();
  }

  const forbiddenStateKeys = new Set([
    '__proto__', 'prototype', 'constructor', 'networkKey', 'masterSecret',
    'installationSecret', 'compatibilityKey'
  ]);
  const transientStateKeys = new Set(['previewStartedAt', 'token', 'rawInfo', 'sessionToken', 'auth']);
  const transientRootKeys = new Set(['transportStatus', 'discovery', 'liveStatus']);
  const transientDeviceKeys = new Set([
    'online', 'gateway', 'reachableViaGateway', 'espNowReachable', 'reachability',
    'lastSeenMs', 'lastSeen', 'fps', 'frame', 'sample', 'uptime', 'raw', 'token',
    'rawInfo', 'pairing', 'testPairing', 'sessionToken', 'auth'
  ]);

  function validateStateTree(value, depth = 0) {
    if (depth > 28) throw new Error('Installatiegegevens zijn te diep genest');
    if (value == null || typeof value === 'boolean') return;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) throw new Error('Installatiegegevens bevatten een ongeldig getal');
      return;
    }
    if (typeof value === 'string') {
      if (value.length > 65536) throw new Error('Een tekstveld is te lang');
      return;
    }
    if (Array.isArray(value)) {
      if (value.length > 20000) throw new Error('Een lijst in de installatie is te groot');
      value.forEach((item) => validateStateTree(item, depth + 1));
      return;
    }
    if (typeof value !== 'object') throw new Error('Ongeldig gegevenstype in installatie');
    const entries = Object.entries(value);
    if (entries.length > 5000) throw new Error('Een onderdeel bevat te veel velden');
    entries.forEach(([key, item]) => {
      if (forbiddenStateKeys.has(key)) throw new Error('Installatiegegevens bevatten een verboden veld');
      validateStateTree(item, depth + 1);
    });
  }

  function pruneSharedState(value) {
    if (Array.isArray(value)) return value.map(pruneSharedState);
    if (!value || typeof value !== 'object') return value;
    const result = {};
    Object.entries(value).forEach(([key, item]) => {
      if (!transientStateKeys.has(key)) result[key] = pruneSharedState(item);
    });
    return result;
  }

  function sanitiseSharedState(state) {
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      throw new Error('Installatiegegevens moeten een object zijn');
    }
    validateStateTree(state);
    const clean = pruneSharedState(state);
    transientRootKeys.forEach((key) => delete clean[key]);
    if (!Array.isArray(clean.installations) || !clean.installations.length) throw new Error('Minstens één locatie is vereist');
    if (!Array.isArray(clean.devices)) throw new Error('De receiverlijst ontbreekt');
    if (!Array.isArray(clean.presets)) throw new Error('De presetlijst ontbreekt');
    clean.installations.forEach((installation) => {
      if (!Array.isArray(installation?.zones)) throw new Error('Een locatie bevat geen geldige zones');
      installation.zones.forEach((zone) => {
        if (!Array.isArray(zone?.groups)) throw new Error('Een zone bevat geen geldige groepen');
        zone.groups.forEach((group) => {
          if (!Array.isArray(group?.receivers)) throw new Error('Een groep bevat geen geldige LED Lines');
        });
      });
    });
    clean.devices.forEach((device) => {
      if (!device || typeof device !== 'object' || Array.isArray(device)) throw new Error('Ongeldig item in receiverlijst');
      transientDeviceKeys.forEach((key) => delete device[key]);
    });
    if (encoder.encode(JSON.stringify(clean)).length > MAX_APP_STATE_BYTES) throw new Error('De installatie is te groot om op te slaan');
    return clean;
  }

  function assignmentCounts(state) {
    const result = new Map();
    (state?.installations || []).forEach((installation) => (installation.zones || []).forEach((zone) =>
      (zone.groups || []).forEach((group) => (group.receivers || []).forEach((line) => {
        const identity = String(line?.deviceId || line?.physicalRid || line?.hardwareId || line?.rid || line?.id || '').trim().toUpperCase();
        if (!identity) return;
        const parsedPort = clamp(line.port ?? line.outputPort, 1, 4, 1);
        const suffix = `:PORT:${parsedPort}`;
        result.set(identity + suffix, (result.get(identity + suffix) || 0) + 1);
      }))));
    return result;
  }

  function removedAssignments(before, after) {
    const oldCounts = assignmentCounts(before);
    const newCounts = assignmentCounts(after);
    let removed = 0;
    oldCounts.forEach((count, key) => { removed += Math.max(0, count - (newCounts.get(key) || 0)); });
    return removed;
  }

  function saveSharedState(body, allowAssignmentRemoval) {
    const expected = body?.expectedRevision;
    if (!Number.isInteger(expected) || expected < 0) {
      return { ok: false, status: 400, error: 'expectedRevision moet een geldige revisie zijn' };
    }
    if (expected !== bridge.revision) {
      return {
        ok: false, status: 409, code: 'REVISION_CONFLICT',
        error: 'De installatie is intussen op een ander scherm gewijzigd',
        currentRevision: bridge.revision
      };
    }
    let clean;
    try { clean = sanitiseSharedState(body.state); }
    catch (error) { return { ok: false, status: 400, error: String(error.message || error) }; }
    const removed = removedAssignments(bridge.sharedState, clean);
    if (removed && !allowAssignmentRemoval) {
      return {
        ok: false, status: 409, code: 'ASSIGNMENT_REMOVAL_REQUIRES_CONFIRMATION',
        error: 'LED Line-koppelingen vereisen een bevestigde verwijderactie', removedCount: removed
      };
    }
    if (JSON.stringify(clean) !== JSON.stringify(bridge.sharedState)) {
      bridge.sharedState = clean;
      bridge.revision += 1;
      persistBridge();
    }
    return { ok: true, status: 200, revision: bridge.revision, state: bridge.sharedState };
  }

  function defaultState(type = 'SPI') {
    return {
      animation: 'Elegant Chase', engine: 'CHASE', variant: 7,
      colors: ['#873ada', '#000000', '#42c7a2', '#f0a43c'], colorCount: 1,
      whiteChannels: [0, 0, 0, 0], rgbEnabled: [true, false, false, false],
      whiteEnabled: [false, false, false, false], background: '#000000',
      backgroundWhite: 0, backgroundRgbEnabled: false,
      backgroundWhiteEnabled: false, backgroundOn: true, direction: 'right',
      speed: 22, speedMode: 'slow', width: 30, widthPixels: 3,
      smooth: 90, brightness: 100, bgBrightness: 10, powerLimit: 100,
      whiteMix: 0, transitionMs: 70, lineDelayMs: 240,
      receiverType: type, restartToken: 1
    };
  }

  function convertDirectState(source = {}, type = 'SPI') {
    const rgbEnabled = Array.isArray(source.rgbEnabled)
      ? source.rgbEnabled.slice(0, 4)
      : [source.rgbEnabled !== false, false, false, false];
    const whiteEnabled = Array.isArray(source.whiteEnabled)
      ? source.whiteEnabled.slice(0, 4)
      : [Boolean(source.whiteEnabled), false, false, false];
    while (rgbEnabled.length < 4) rgbEnabled.push(false);
    while (whiteEnabled.length < 4) whiteEnabled.push(false);
    return {
      ...defaultState(type),
      animation: source.animation || (source.mode === 'static' ? 'Static Color' : 'Elegant Chase'),
      engine: source.engine || (source.mode === 'static' ? 'STATIC' : 'CHASE'),
      variant: clamp(source.variant, 0, 255, 0),
      colors: Array.isArray(source.colours) ? source.colours.slice(0, 4) : ['#873ada'],
      colorCount: clamp(source.colourCount, 1, 4, 1),
      whiteChannels: [clamp(source.white, 0, 255, 0), 0, 0, 0],
      rgbEnabled,
      whiteEnabled,
      background: source.background || '#000000',
      backgroundOn: Boolean(source.backgroundOn),
      direction: source.direction === 'left' ? 'left' : 'right',
      speed: clamp(source.speed, 0, 100, 22),
      widthPixels: clamp(source.widthPixels, 1, 8192, 3),
      smooth: clamp(source.smooth, 0, 100, 90),
      brightness: clamp(source.brightness, 0, 100, 100),
      spacing: clamp(source.spacing, 0, 100, 50),
      objectCount: clamp(source.objectCount, 1, 16, 1),
      trailLength: clamp(source.trail, 0, 100, 45),
      spread: clamp(source.spread, 0, 100, 50),
      lineDelayMs: clamp(source.lineDelayMs, 0, 5080, 240),
      restartToken: clamp(source.restartToken, 0, Number.MAX_SAFE_INTEGER, 1)
    };
  }

  function recordFromDirect(receiver) {
    const rid = String(receiver.rid || receiver.id || '').toUpperCase();
    if (!/^[0-9A-F]{16}$/.test(rid)) return null;
    const type = String(receiver.type || receiver.receiverType || 'SPI').toUpperCase() === 'RGBW' ? 'RGBW' : 'SPI';
    const portCapacity = receiverPortCapacity(receiver, type);
    const portMask = receiverPortMask(receiver, type, type === 'RGBW' ? 3 : 1);
    const spiPorts = type === 'SPI' ? {} : undefined;
    if (spiPorts) {
      for (let port = 1; port <= portCapacity; port += 1) {
        if (portMask & (1 << (port - 1))) spiPorts[port] = spiPortSettings(receiver, receiver, port);
      }
      spiPorts[1] ||= spiPortSettings(receiver, receiver, 1);
    }
    return {
      id: `rx-${rid.toLowerCase()}`, rid,
      hardwareId: receiver.hardwareId || `ALV-${rid.slice(-6)}`,
      physicalId: receiver.physicalId || '', mac: receiver.mac || '',
      canonicalRid: receiver.canonicalRid || '', identitySchema: receiver.identitySchema || 1,
      identityLegacy: Boolean(receiver.identityLegacy), identityConflict: Boolean(receiver.identityConflict),
      number: clamp(receiver.number, 1, 250, 1),
      name: `Receiver ${clamp(receiver.number, 1, 250, 1)}`,
      shortTag: rid.slice(-4),
      displayName: `Receiver ${clamp(receiver.number, 1, 250, 1)} · ${rid.slice(-4)}`,
      installationTag: bridge.publicTag,
      receiverType: type,
      pixels: type === 'RGBW' ? 1 : clamp(receiver.pixels, 1, 1024, 60),
      portCapacity,
      portCount: popcount4(portMask),
      activePortCount: popcount4(portMask),
      portMask,
      spiPorts,
      port1Rid: String(receiver.port1Rid || '').toUpperCase(),
      port2Rid: String(receiver.port2Rid || '').toUpperCase(),
      rgbwChannelMaps: type === 'RGBW' ? {
        1: rgbwChannelMap(receiver.rgbwChannelMaps?.[1] || receiver.rgbwChannelMaps?.['1'] || receiver.map1) || 'RGBW',
        2: rgbwChannelMap(receiver.rgbwChannelMaps?.[2] || receiver.rgbwChannelMaps?.['2'] || receiver.map2) || 'RGBW'
      } : undefined,
      firmware: receiver.firmware || '', firmwareVersion: receiver.firmware || '',
      firmwareVariant: receiver.firmwareVariant || '', build: receiver.build || '',
      model: receiver.model || '', board: receiver.board || '',
      otaCapable: Boolean(receiver.otaCapable), otaProtocol: Number(receiver.otaProtocol || 0),
      otaMaxBytes: Number(receiver.otaMaxBytes || 0), transport: 'WIFI_AP_ESPNOW', online: false,
      reachableViaGateway: false, gateway: false, fps: 0
    };
  }

  function migrateDirectApp() {
    if (localStorage.getItem(APP_KEY) || localStorage.getItem('aluv11')) return;
    let direct = null;
    try { direct = JSON.parse(localStorage.getItem(DIRECT_KEY) || 'null'); } catch (_) {}
    if (!direct || direct.version !== 3 || !Array.isArray(direct.locations)) return;
    if (/^[0-9A-F]{16}$/.test(direct.installationKey || '')) bridge.networkKey = direct.installationKey;
    const devices = [];
    Object.values(direct.receivers || {}).forEach((receiver) => {
      const record = recordFromDirect(receiver);
      if (!record) return;
      devices.push(record);
      bridge.receivers[record.rid] = record;
    });
    if (!bridge.preferredGatewayRid && devices.length) {
      bridge.preferredGatewayRid = [...devices].sort((a, b) =>
        Number(a.number || 250) - Number(b.number || 250) || a.rid.localeCompare(b.rid)
      )[0].rid;
    }
    const installations = direct.locations.map((location, installationIndex) => ({
      id: location.id || `i${installationIndex + 1}`,
      name: location.name || `Locatie ${installationIndex + 1}`,
      zones: (location.zones || []).map((zone, zoneIndex) => ({
        id: zone.id || `z${installationIndex + 1}-${zoneIndex + 1}`,
        name: zone.name || `Zone ${zoneIndex + 1}`,
        icon: '◼',
        groups: (zone.groups || []).map((group, groupIndex) => {
          const type = group.type === 'RGBW' ? 'RGBW' : 'SPI';
          const lines = [];
          (group.receiverIds || []).forEach((receiverId) => {
            const physical = direct.receivers?.[receiverId];
            const record = recordFromDirect(physical || {});
            if (!record) return;
            if (type === 'RGBW') {
              [1, 2].filter((port) => record.portMask & (1 << (port - 1))).forEach((port) => {
                lines.push({ id: `${group.id || 'g'}-${record.rid}-p${port}`, deviceId: record.id,
                  rid: port === 2 ? (record.port2Rid || record.rid) : (record.port1Rid || record.rid),
                  hardwareId: record.hardwareId, name: `${record.name} · Poort ${port}`,
                  receiverType: 'RGBW', port, pixels: 1, reversed: false });
              });
            } else {
              lines.push({ id: `${group.id || 'g'}-${record.rid}`, deviceId: record.id, rid: record.rid,
                hardwareId: record.hardwareId, name: record.name, receiverType: 'SPI',
                pixels: record.pixels, reversed: Boolean(physical?.physicalReverse) });
            }
          });
          return {
            id: group.id || `g${installationIndex + 1}-${zoneIndex + 1}-${groupIndex + 1}`,
            name: group.name || `Groep ${groupIndex + 1}`,
            receiverType: type,
            layout: group.layout === 'parallel' ? 'parallel' : 'line',
            parallelOrientation: group.orientation === 'vertical' ? 'vertical' : 'horizontal',
            receivers: lines,
            state: convertDirectState(group.state, type)
          };
        })
      })),
      scenes: []
    }));
    if (!installations.length) return;
    const active = installations.find((item) => item.id === direct.activeLocationId) || installations[0];
    localStorage.setItem(APP_KEY, JSON.stringify({
      theme: direct.theme === 'dark' ? 'dark' : 'light', installations,
      activeInstallationId: active.id, devices, presets: [], brand: [], recent: [], favorites: [],
      undo: [], redo: [], receiver216Migrated: true, fixedPower100: true,
      settings: { powerLimit: 100, pixelsPerMetre: 26 }, transportStatus: {}
    }));
    persistBridge();
  }

  function seedCleanApp() {
    // Let the unchanged local UI perform its own aluv11 -> aluv12 migration;
    // seeding here must never hide an existing customer installation.
    if (localStorage.getItem(APP_KEY) || localStorage.getItem('aluv11')) return;
    const installationId = 'i-browser';
    localStorage.setItem(APP_KEY, JSON.stringify({
      theme: 'light',
      installations: [{
        id: installationId, name: 'Hoofdlocatie', scenes: [],
        zones: [{ id: 'z-main', name: 'Hoofdzone', icon: '◼', groups: [{
          id: 'g-main', name: 'Hoofdlijn', receiverType: null, layout: 'line',
          parallelOrientation: 'horizontal', receivers: [], state: defaultState('SPI')
        }] }]
      }],
      activeInstallationId: installationId, devices: [], presets: [],
      brand: [{ name: 'Aluvision Red', hex: '#c94e46' }, { name: 'Brand White', hex: '#ffffff' }],
      recent: [], favorites: [], undo: [], redo: [], receiver216Migrated: true,
      fixedPower100: true, settings: { powerLimit: 100, pixelsPerMetre: 26 }, transportStatus: {}
    }));
  }

  suppressLegacyReceiverSeed();
  migrateDirectApp();
  seedCleanApp();

  function parseFields(text) {
    const fields = {};
    String(text || '').trim().split(';').forEach((part) => {
      const index = part.indexOf('=');
      if (index > 0) fields[part.slice(0, index).trim().toUpperCase()] = part.slice(index + 1).trim();
    });
    return fields;
  }

  function valueText(value) {
    const view = value instanceof DataView
      ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
      : new Uint8Array(value.buffer || value);
    return decoder.decode(view);
  }

  function receiveLine(line) {
    const fields = parseFields(line);
    const id = Number(fields.ID || 0);
    if (id && ackWaiters.has(id)) {
      const pending = ackWaiters.get(id);
      ackWaiters.delete(id);
      clearTimeout(pending.timer);
      pending.resolve(fields);
    }
    const reported = exactRid(fields.TARGETRID || fields.RID);
    // Satellite ACK fields never become the direct gateway's identity cache.
    if (!reported || !ble.rid || reported === exactRid(ble.rid)) {
      ble.fields = { ...ble.fields, ...fields };
    }
  }

  function onStatus(event) {
    if (event?.target !== ble.status || !ble.connected) return;
    notificationBuffer += valueText(event.target.value);
    if (notificationBuffer.length > 6000) notificationBuffer = notificationBuffer.slice(-3000);
    let newline = notificationBuffer.indexOf('\n');
    while (newline >= 0) {
      const line = notificationBuffer.slice(0, newline).replace(/\r/g, '').trim();
      notificationBuffer = notificationBuffer.slice(newline + 1);
      if (line) receiveLine(line);
      newline = notificationBuffer.indexOf('\n');
    }
  }

  function waitForAck(id, timeout = 3200) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        ackWaiters.delete(id);
        reject(new Error('Receiver antwoordde niet op tijd'));
      }, timeout);
      ackWaiters.set(id, { resolve, reject, timer });
    });
  }

  function retireBleSession(message = 'Recoveryverbinding is gesloten') {
    bleSessionEpoch += 1;
    notificationBuffer = '';
    receiverClocks.clear();
    ackWaiters.forEach((pending) => {
      clearTimeout(pending.timer);
      pending.reject(new Error(message));
    });
    ackWaiters.clear();
    return bleSessionEpoch;
  }

  function assertBleOperation(operation, signal) {
    if (signal?.aborted) throw Object.assign(new Error('Toevoegen geannuleerd.'), { code: 'IDENTIFY_CANCELLED' });
    if (!operation.active || operation.epoch !== bleSessionEpoch || !ble.connected ||
        !operation.command || operation.command !== ble.command || operation.device !== ble.device) {
      throw new Error('Recoveryverbinding is gesloten of gewijzigd');
    }
  }

  async function writeCommand(text, operation, signal = null) {
    assertBleOperation(operation, signal);
    const command = operation.command;
    const bytes = encoder.encode(`${text}\n`);
    for (let offset = 0; offset < bytes.length; offset += 150) {
      assertBleOperation(operation, signal);
      const chunk = bytes.slice(offset, offset + 150);
      operation.writeStarted = true;
      if (typeof command.writeValueWithoutResponse === 'function') await command.writeValueWithoutResponse(chunk);
      else if (typeof command.writeValue === 'function') await command.writeValue(chunk);
      else await command.writeValueWithResponse(chunk);
      assertBleOperation(operation, signal);
      if (offset + chunk.length === bytes.length) operation.packetWritten = true;
      if (bytes.length > 150) await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }

  async function transactNow(fields, timeout = 3200, allowError = false, operation, signal = null) {
    assertBleOperation(operation, signal);
    let id = Number(fields.ID || 0);
    if (!Number.isInteger(id) || id <= 0) {
      commandSequence = (commandSequence + 1) % 2147483000 || 1;
      id = commandSequence;
      fields.ID = id;
    }
    const ordered = { V: 18, TYPE: fields.TYPE, ID: id, ...fields };
    const text = Object.entries(ordered)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${key}=${value}`).join(';');
    const pending = waitForAck(id, timeout);
    // A notification timeout or cancellation may occur while a GATT write
    // promise is still waiting. Attach the rejection handler immediately.
    pending.catch(() => {});
    const cancel = () => {
      const waiter = ackWaiters.get(id);
      if (waiter) {
        clearTimeout(waiter.timer);
        ackWaiters.delete(id);
        waiter.reject(Object.assign(new Error('Toevoegen geannuleerd.'), { code: 'IDENTIFY_CANCELLED' }));
      }
    };
    signal?.addEventListener?.('abort', cancel, { once: true });
    try {
      const write = writeCommand(text, operation, signal);
      // A rejected ACK wait (cancel/disconnect/deadline) also retires a stalled
      // write promptly. A successful ACK still waits for the write itself.
      const interrupted = pending.then(() => new Promise(() => {}));
      await withTimeout(Promise.race([write, interrupted]), timeout, 'Receiveropdracht schrijven duurde te lang');
      const reply = await pending;
      assertBleOperation(operation, signal);
      assertReceiverIdentity(reply);
      if (!allowError && reply.STATUS === 'ERROR') throw new Error(reply.DETAIL || 'Receiverfout');
      return reply;
    } catch (error) {
      const waiter = ackWaiters.get(id);
      if (waiter) {
        clearTimeout(waiter.timer);
        ackWaiters.delete(id);
        waiter.reject(error);
      }
      // Never concatenate the next command onto a half-written packet. Only
      // retire our own still-current connection; never disconnect its successor.
      if (operation.writeStarted && !operation.packetWritten &&
          operation.epoch === bleSessionEpoch && operation.command === ble.command) {
        retireBleSession('Recoveryverbinding herstelt na een onderbroken opdracht');
        ble.connected = false;
        try { operation.device?.gatt?.disconnect(); } catch (_) {}
      }
      throw error;
    } finally {
      operation.active = false;
      signal?.removeEventListener?.('abort', cancel);
    }
  }

  function transactBle(fields, timeout = 3200, allowError = false, signal = null) {
    const request = { ...fields };
    const operation = { epoch: bleSessionEpoch, device: ble.device, command: ble.command,
      active: true, writeStarted: false, packetWritten: false };
    const run = () => {
      assertBleOperation(operation, signal);
      return transactNow(request, timeout, allowError, operation, signal);
    };
    const next = commandTail.then(run, run);
    commandTail = next.catch(() => {});
    return next;
  }

  async function transact(fields, timeout = 3200, allowError = false) {
    if (exactRid(fields?.TARGET)) assertReceiverIdentity({ RID: exactRid(fields.TARGET) });
    /* Allocate the correlation ID before selecting a transport.  This keeps
       the exact same ID visible to resultFromReply for BLE, native Wi-Fi and
       the Mac bridge instead of trusting whichever reply happens to arrive. */
    if (!Number.isInteger(Number(fields?.ID)) || Number(fields.ID) <= 0) {
      commandSequence = (commandSequence + 1) % 2147483000 || 1;
      fields.ID = commandSequence;
    }
    const selected = activeAdapter();
    if (selected?.name === PRIMARY_TRANSPORT) {
      const operation = selected.adapter.transact({ ...fields }, { timeout, allowError });
      // Native transports own their operation lifetime, including one bounded
      // reconnect/replay. Racing that work with a shorter web timer reports a
      // false disconnect and leaves the original command running detached.
      const reply = selected.adapter.managesOperationTimeouts
        ? await operation
        : await withTimeout(operation, timeout + 500, 'Controller antwoordde niet op tijd');
      const parsed = normaliseTransportReply(reply);
      assertReceiverIdentity(parsed);
      if (!allowError && parsed.STATUS === 'ERROR') throw new Error(parsed.DETAIL || 'Receiverfout');
      return parsed;
    }
    return transactBle(fields, timeout, allowError);
  }

  function monotonicNowMs() {
    return typeof performance?.now === 'function' ? performance.now() : Date.now();
  }

  async function receiverClock(rid, receiverType, port = 0) {
    const key = `${receiverType}:${rid}`;
    const cached = receiverClocks.get(key);
    const now = monotonicNowMs();
    if (cached && now - cached.measuredAtMs < 15000) return cached;
    const t0 = monotonicNowMs();
    const fields = { TYPE: 'STATUS', TARGET: rid, DEVTYPE: receiverType, PORT: port };
    const reply = await transact(fields, 2600, true);
    const t1 = monotonicNowMs();
    if (reply.STATUS !== 'OK') throw new Error(reply.DETAIL || 'Kloksynchronisatie mislukt');
    const midpointMs = (t0 + t1) / 2;
    let clock;
    if (receiverType === 'RGBW' && Number.isFinite(Number(reply.CLOCKUS))) {
      clock = { measuredAtMs: t1, offsetUs: Number(reply.CLOCKUS) - midpointMs * 1000, rttMs: t1 - t0 };
    } else if (receiverType === 'SPI' && Number.isFinite(Number(reply.CLOCKMS))) {
      clock = { measuredAtMs: t1, offsetMs: Number(reply.CLOCKMS) - midpointMs, rttMs: t1 - t0 };
    } else {
      throw new Error('Receiver rapporteert nog geen synchronisatieklok');
    }
    const floor = generationFloorFromFields(reply);
    if (floor) bridge.commandGenerations[rid] = Math.max(clamp(bridge.commandGenerations[rid], 0, 4294967295, 0), floor);
    receiverClocks.set(key, clock);
    persistBridge();
    return clock;
  }

  async function prepareSynchronizedStarts(body, action, targets, shouldYield = () => false) {
    // One logical output (including RGBW PORT=0) is applied atomically by its
    // receiver. A clock probe + future start only adds latency to that wheel.
    // Multiple separate outputs still need their common scheduled instant.
    if (action !== 'LIVE' || body?.synchronize !== true || targets.length < 2) return;
    const unique = new Map();
    targets.forEach((target) => {
      const rid = exactRid(target.physicalRid || target.rid);
      if (!rid || unique.has(rid)) return;
      unique.set(rid, {
        rid,
        receiverType: target.receiverType,
        port: clamp(target.port ?? target.outputPort, 0, target.receiverType === 'RGBW' ? 2 : 4, 0)
      });
    });
    const serial = activeAdapter()?.adapter?.supportsConcurrentFanout === false;
    const measureClock = async target => {
      try { return [target, await receiverClock(target.rid, target.receiverType, target.port)]; }
      catch (_) { return [target, null]; }
    };
    const clocks = [];
    if (serial) {
      // Measure actual round-trip time, not time waiting behind another BLE
      // request; otherwise the last receiver acquires a false clock offset.
      for (const target of unique.values()) {
        if (shouldYield()) return;
        clocks.push(await measureClock(target));
      }
    } else {
      const pending = [...unique.values()];
      // Use the same bounded lanes as command fanout, not 30 simultaneous
      // probes whose queueing time would look like radio latency.
      await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT_TARGETS, pending.length) }, async () => {
        while (pending.length && !shouldYield()) clocks.push(await measureClock(pending.shift()));
      }));
    }
    // Older firmware may lack a clock. Degrade the entire update together,
    // never send a future phase to an immediate/unscheduled member of a group.
    if (shouldYield() || clocks.some(([, clock]) => !clock)) return;
    const requestedDelay = clamp(body.scheduleDelayMs, 90, 750, 160);
    // Bluetooth writes all endpoints through one ordered lane. Allow the
    // complete group to arrive before its common start, not only endpoint 1.
    const maxRtt = Math.max(0, ...clocks.map(([, clock]) => clock?.rttMs || 0));
    const maxPorts = Math.max(1, ...[...unique.keys()].map(rid =>
      targets.filter(target => exactRid(target.physicalRid || target.rid) === rid).length));
    const sendBudget = serial ? targets.length : Math.ceil(unique.size / MAX_CONCURRENT_TARGETS) * maxPorts;
    const delayMs = Math.max(requestedDelay, Math.min(50000, 60 + sendBudget * Math.max(35, maxRtt * 1.5)));
    const hostStartMs = monotonicNowMs() + delayMs;
    bodyHostStarts.set(body, hostStartMs);
    const starts = new Map();
    clocks.forEach(([target, clock]) => {
      if (!clock) return;
      if (target.receiverType === 'RGBW') {
        starts.set(target.rid, { startAtUs: Math.round(hostStartMs * 1000 + clock.offsetUs) });
      } else {
        starts.set(target.rid, { startAtMs: Math.round(hostStartMs + clock.offsetMs) >>> 0,
          offsetMs: clock.offsetMs, rttMs: clock.rttMs });
      }
    });
    bodyStarts.set(body, starts);
  }

  function onDisconnected(event) {
    if (event?.target && event.target !== ble.device) return;
    retireBleSession();
    otaController?.onDisconnected();
    ble.connected = false;
    ble.connectionState = 'offline';
    ble.disconnectedAt = Date.now();
    ble.server = null;
    ble.command = null;
    ble.status = null;
    ble.info = null;
  }

  async function attachDevice(device) {
    const epoch = retireBleSession('Een andere receiververbinding wordt geopend');
    ble.connected = false;
    ble.connectionState = 'connecting';
    ble.lastError = '';
    if (ble.device && ble.device !== device) {
      try { ble.device.removeEventListener?.('gattserverdisconnected', onDisconnected); } catch (_) {}
      if (ble.device.gatt?.connected) {
        try { ble.device.gatt.disconnect(); } catch (_) {}
      }
    }
    if (ble.status) {
      try { ble.status.removeEventListener('characteristicvaluechanged', onStatus); } catch (_) {}
    }
    try { device.removeEventListener?.('gattserverdisconnected', onDisconnected); } catch (_) {}
    device.addEventListener('gattserverdisconnected', onDisconnected);
    try {
      const server = device.gatt.connected && ble.device === device && ble.server
        ? ble.server : await withTimeout(device.gatt.connect(), CONNECT_TIMEOUT_MS, 'Controllerverbinding timeout');
      if (epoch !== bleSessionEpoch) throw new Error('Receiverkeuze is gewijzigd');
      const service = await withTimeout(
        server.getPrimaryService(UUIDS.service), CONNECT_TIMEOUT_MS, 'Controllerservice timeout'
      );
      const [command, status, info] = await withTimeout(Promise.all([
        service.getCharacteristic(UUIDS.command),
        service.getCharacteristic(UUIDS.status),
        service.getCharacteristic(UUIDS.info)
      ]), CONNECT_TIMEOUT_MS, 'Controllerkanalen timeout');
      if (epoch !== bleSessionEpoch) throw new Error('Receiverkeuze is gewijzigd');
      ble.device = device;
      ble.server = server;
      ble.command = command;
      ble.status = status;
      ble.info = info;
      ble.fields = {};
      ble.connected = true;
      ble.connectionState = 'ready';
      ble.connectedAt = Date.now();
      notificationBuffer = '';
      status.addEventListener('characteristicvaluechanged', onStatus);
      await withTimeout(status.startNotifications(), 5000, 'Controllerstatus timeout');
      if (epoch !== bleSessionEpoch) throw new Error('Receiverkeuze is gewijzigd');
      const fields = parseFields(valueText(await withTimeout(info.readValue(), 4000, 'Controllerinformatie timeout')));
      if (epoch !== bleSessionEpoch) throw new Error('Receiverkeuze is gewijzigd');
      return fields;
    } catch (error) {
      if (epoch !== bleSessionEpoch) {
        // A late connect result may belong to a different physical device.
        // Release that orphan, but never disconnect a newer attempt on the
        // same device or overwrite its ready/error state.
        try { if (device !== ble.device && device?.gatt?.connected) device.gatt.disconnect(); } catch (_) {}
        throw error;
      }
      ble.connectionState = 'error';
      ble.lastError = String(error?.message || error);
      ble.connected = false;
      try { if (device?.gatt?.connected) device.gatt.disconnect(); } catch (_) {}
      throw error;
    }
  }

  function exactRid(value) {
    const rid = String(value || '').toUpperCase();
    return /^[0-9A-F]{16}$/.test(rid) ? rid : '';
  }

  function rgbwChannelMap(value) {
    const map = String(value || '').trim().toUpperCase();
    return map.length === 4 && [...map].sort().join('') === 'BGRW' ? map : '';
  }

  function normaliseTransportName(value) {
    return String(value || '').trim().toLowerCase();
  }

  function adapterReady(adapter) {
    if (!adapter) return false;
    try {
      if (typeof adapter.isReady === 'function') return Boolean(adapter.isReady());
      if ('ready' in adapter) return Boolean(adapter.ready);
      if ('connected' in adapter) return Boolean(adapter.connected);
    } catch (_) {}
    return false;
  }

  function registerTransport(name, adapter) {
    const key = normaliseTransportName(name);
    if (!key || !adapter || typeof adapter.transact !== 'function') {
      throw new TypeError('Een transportadapter vereist een naam en transact-functie');
    }
    receiverClocks.clear();
    transportAdapters.set(key, adapter);
    if (typeof adapter.configureSecurity === 'function') {
      try {
        const configured = adapter.configureSecurity(Object.freeze({
          version: 2,
          masterSecret: bridge.masterSecret,
          compatibilityKey: bridge.networkKey,
          meshId: bridge.meshId || '',
          publicTag: bridge.publicTag
        }));
        Promise.resolve(configured).catch(() => {});
      } catch (_) {}
    }
    return () => { if (transportAdapters.get(key) === adapter) transportAdapters.delete(key); };
  }

  function primaryAdapter() {
    return transportAdapters.get(PRIMARY_TRANSPORT) || null;
  }

  function activeAdapter() {
    const primary = primaryAdapter();
    if (adapterReady(primary)) return { name: PRIMARY_TRANSPORT, adapter: primary };
    if (ble.connected && ble.command) return { name: RECOVERY_TRANSPORT, adapter: null };
    return null;
  }

  async function connectPrimaryTransport(interactive = false) {
    const adapter = primaryAdapter();
    if (!adapter) return false;
    if (adapterReady(adapter)) return true;
    if (typeof adapter.connect !== 'function') return false;
    try {
      const operation = adapter.connect({ interactive: Boolean(interactive) });
      if (adapter.managesOperationTimeouts) await operation;
      else await withTimeout(operation, CONNECT_TIMEOUT_MS, 'Controllerverbinding timeout');
    } catch (_) { return false; }
    return adapterReady(adapter);
  }

  function normaliseTransportReply(value) {
    if (typeof value === 'string') return parseFields(value);
    if (value?.reply && typeof value.reply === 'object') return value.reply;
    if (value && typeof value === 'object') return value;
    throw new Error('Controller gaf een ongeldig antwoord');
  }

  // Identity evidence is a collision guard, not ownership authentication.
  // Never replace the installed receiver/PIN/group record with a different
  // physical board merely because old firmware reported the same short RID.
  function identityEvidence(value = {}) {
    const hex = (raw, length) => {
      const result = String(raw || '').replace(/[:-]/g, '').trim().toUpperCase();
      return new RegExp(`^[0-9A-F]{${length}}$`).test(result) && !/^0+$/.test(result) ? result : '';
    };
    return {
      physicalId: hex(value.PHYSID || value.physicalId, 12),
      mac: hex(value.MAC || value.mac, 12),
      canonicalRid: exactRid(value.CANONRID || value.canonicalRid)
    };
  }

  function assertReceiverIdentity(incoming = {}, previous = null) {
    const rid = exactRid(incoming.RID || incoming.rid || incoming.TARGETRID);
    const saved = previous || bridge.receivers[rid] || {};
    const next = identityEvidence(incoming);
    const before = identityEvidence(saved);
    const mismatch = ['physicalId', 'mac', 'canonicalRid'].some(key => before[key] && next[key] && before[key] !== next[key]);
    if (mismatch || saved.identityConflict || bridge.receivers[rid]?.identityConflict || String(incoming.IDENTITYCONFLICT || '') === '1') {
      if (bridge.receivers[rid]) {
        bridge.receivers[rid].identityConflict = true;
        bridge.receivers[rid].online = false;
        persistBridge();
      }
      const error = new Error('Twee receivers gebruiken dezelfde herkenning. Bediening is geblokkeerd om de verkeerde LED Line niet aan te sturen. Deze oude koppeling heeft veilig herstel nodig; reset niets. Je groepen en PIN blijven bewaard.');
      error.code = 'RECEIVER_IDENTITY_CONFLICT';
      throw error;
    }
    if (String(incoming.IDREADY ?? '') === '0') {
      throw new Error('Deze receiver kon zijn opgeslagen herkenning niet veilig laden. Voeg hem niet opnieuw toe en reset hem niet.');
    }
    return next;
  }

  function assertIdentityInventory(incoming = []) {
    const seen = new Map();
    // Validate the whole batch before anything is merged or paired.
    incoming.forEach(raw => {
      const item = fieldsFromTransport(raw);
      const rid = exactRid(item.RID);
      if (!rid) return;
      assertReceiverIdentity(item);
      if (seen.has(rid)) assertReceiverIdentity(item, seen.get(rid));
      const before = identityEvidence(seen.get(rid) || {});
      const next = identityEvidence(item);
      seen.set(rid, { ...item, PHYSID: next.physicalId || before.physicalId,
        MAC: next.mac || before.mac, CANONRID: next.canonicalRid || before.canonicalRid });
    });
    return incoming;
  }

  window.AluvisionReceiverIdentity = Object.freeze({ assertReceiver: assertReceiverIdentity, assertInventory: assertIdentityInventory });

  function deviceRecord(fields, pairReply = {}, sessionFields = ble.fields) {
    const rid = exactRid(fields.RID || pairReply.RID || fields.TARGETRID);
    if (!rid) throw new Error('Ongeldige receiveridentiteit');
    const relevant = [fields, pairReply, sessionFields].filter(item =>
      exactRid(item.TARGETRID || item.RID) === rid);
    assertIdentityInventory(relevant);
    // Session status is fallback only; explicit responses keep precedence.
    const session = exactRid(sessionFields.TARGETRID || sessionFields.RID) === rid ? sessionFields : {};
    const merged = { ...session, ...fields, ...pairReply };
    const declaredType = String(merged.DEVTYPE || '').toUpperCase();
    if (!['SPI', 'RGBW'].includes(declaredType)) throw new Error('Onbekend receivertype');
    const receiverType = declaredType;
    const previous = bridge.receivers[rid] || {};
    const identity = assertReceiverIdentity({ ...merged, RID: rid });
    const migratedRgbwToSpi = previous.receiverType === 'RGBW' && receiverType === 'SPI';
    if (previous.receiverType && previous.receiverType !== receiverType && !migratedRgbwToSpi) {
      throw new Error('Receivertype komt niet overeen met de eerder gekoppelde receiver');
    }
    const number = clamp(merged.NUMBER || previous.number, 1, 250, 1);
    const protocolVersion = Number(merged.V || previous.protocolVersion || 0);
    const declaredEffectMax = Number(merged.FXMAX || (migratedRgbwToSpi ? 0 : previous.animationVariantMax) || 0);
    const portCapacity = receiverPortCapacity({ ...previous, ...merged }, receiverType);
    const portMask = receiverPortMask({ ...previous, ...merged }, receiverType, receiverType === 'RGBW' ? 3 : previous.portMask || 1);
    const spiPorts = receiverType === 'SPI' ? {} : undefined;
    if (spiPorts) {
      for (let port = 1; port <= portCapacity; port += 1) {
        if ((portMask & (1 << (port - 1))) || port === 1) spiPorts[port] = spiPortSettings(merged, previous, port);
      }
    }
    const spiPixels = receiverType === 'SPI'
      ? clamp(spiPorts?.[1]?.pixels ?? merged.PHYSICAL ?? previous.pixels, 1, 1024, 60)
      : 1;
    const hasGatewaySignal = merged.GATEWAY != null || merged.gateway != null || merged.MESHROLE != null;
    const explicitGateway = String(merged.GATEWAY ?? '').toUpperCase() === '1' ||
      merged.gateway === true || String(merged.MESHROLE || '').toUpperCase() === 'MAIN';
    const isGateway = hasGatewaySignal ? explicitGateway : previous.gateway === true;
    return {
      ...previous,
      id: `rx-${rid.toLowerCase()}`, rid,
      hardwareId: merged.HWID || previous.hardwareId || `ALV-${rid.slice(-6)}`,
      physicalId: identity.physicalId || previous.physicalId || '',
      mac: identity.mac || previous.mac || '',
      canonicalRid: identity.canonicalRid || previous.canonicalRid || '',
      identitySchema: Number(merged.IDSCHEMA || previous.identitySchema || 1),
      identityLegacy: String(merged.IDLEGACY ?? Number(Boolean(previous.identityLegacy))) === '1',
      name: `Receiver ${number}`, number, receiverType,
      shortTag: rid.slice(-4),
      displayName: `Receiver ${number} · ${rid.slice(-4)}`,
      installationTag: bridge.publicTag,
      firmware: `V${String(merged.V || previous.firmware || '18').replace(/^V/i, '')}`,
      protocolVersion,
      firmwareVersion: merged.FWVER || previous.firmwareVersion || '',
      firmwareVariant: String(merged.FWVARIANT || previous.firmwareVariant || '').toUpperCase(),
      build: merged.BUILD || previous.build || '',
      apSsid: String(merged.APSSID || previous.apSsid || ''),
      model: String(merged.MODEL || previous.model || '').toUpperCase(),
      board: String(merged.BOARD || previous.board || '').toUpperCase(),
      otaCapable: merged.OTA == null ? Boolean(previous.otaCapable) :
        ['1', 'BLE1', 'HTTP1', 'WIFI1'].includes(String(merged.OTA).toUpperCase()),
      otaProtocol: Number(merged.OTAV || previous.otaProtocol || 0),
      otaMaxBytes: Number(merged.OTAMAX || previous.otaMaxBytes || 0),
      otaState: String(merged.OTASTATE || previous.otaState || '').toUpperCase(),
      portCapacity,
      portCount: popcount4(portMask),
      activePortCount: popcount4(portMask),
      portMask,
      spiPorts,
      port1Rid: receiverType === 'RGBW' ? exactRid(merged.PORT1RID || previous.port1Rid) : '',
      port2Rid: receiverType === 'RGBW' ? exactRid(merged.PORT2RID || previous.port2Rid) : '',
      rgbwChannelMaps: receiverType === 'RGBW' ? {
        1: rgbwChannelMap(merged.MAP1 || previous.rgbwChannelMaps?.[1] || previous.rgbwChannelMaps?.['1']) || 'RGBW',
        2: rgbwChannelMap(merged.MAP2 || previous.rgbwChannelMaps?.[2] || previous.rgbwChannelMaps?.['2']) || 'RGBW'
      } : undefined,
      pixelConfiguration: receiverType !== 'RGBW',
      requiresPixelSetup: receiverType === 'SPI' &&
        (migratedRgbwToSpi || previous.requiresPixelSetup === true),
      // PHYSICAL is a saved receiver setting, never an auto-detected strip
      // length. A different value must therefore start the setup wizard, not
      // reject pairing or mark the hardware as incompatible.
      pixels: receiverType === 'RGBW' ? 1 : spiPixels,
      reportedPixels: receiverType === 'RGBW' ? null : spiPixels,
      pixelCountSource: receiverType === 'RGBW' ? 'not_applicable' :
        (migratedRgbwToSpi ? 'requires_setup' : 'saved_setting'),
      pixelCountMismatch: false,
      animationVariantMax: declaredEffectMax || (receiverType === 'RGBW' ? 16 : 97),
      stackedLineEffectsCapable: receiverType === 'SPI' &&
        (String(merged.STACKED || '').toUpperCase() === '1' || declaredEffectMax >= 97 || protocolVersion >= 18),
      lineDelayCapable: String(merged.LINEDELAY || '').toUpperCase() === '1' ||
        declaredEffectMax >= (receiverType === 'RGBW' ? 16 : 102),
      physicalReverse: receiverType === 'SPI'
        ? Boolean(spiPorts?.[1]?.reversed)
        : String(merged.PHYSICALREVERSE ?? (previous.physicalReverse ? '1' : '0')) === '1',
      fps: Number(merged.FPS || 0), frame: merged.FRAME || '—', sample: merged.SAMPLE || '—',
      transport: 'WIFI_AP_ESPNOW', online: true, gateway: isGateway,
      reachableViaGateway: true, reachability: isGateway ? 'gateway' : 'esp_now',
      lastSeenMs: isGateway ? 0 : null
    };
  }

  async function pairReceiverRecovery(number) {
    if (!navigator.bluetooth) {
      throw new Error('Recoveryverbinding is niet beschikbaar op dit toestel.');
    }
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [UUIDS.service] }],
      optionalServices: [UUIDS.service]
    });
    const info = await attachDevice(device);
    assertReceiverIdentity(info);
    const rid = exactRid(info.RID);
    if (!rid) throw new Error('De gekozen recoveryreceiver heeft geen geldig ID.');
    ble.rid = rid;
    ble.receiverType = info.DEVTYPE === 'RGBW' ? 'RGBW' : 'SPI';
    const existing = bridge.receivers[rid];
    let pairReply = {};
    const token = String(info.TOKEN || '').toUpperCase();
    if (!window.AluvisionIdentifyBeforePair?.confirm) throw new Error('Herkenning kon niet worden geopend. Open de app opnieuw.');
    const currentPair = () => ble.device === device && ble.rid === rid && Boolean(device.gatt?.connected);
    const recognition = await window.AluvisionIdentifyBeforePair.confirm({
      receiver: { rid, name: existing?.name || 'Receiver', receiverType: ble.receiverType, portCount: Number(info.PORTS) || 1 },
      isCurrent: currentPair,
      identify: async ({ rid: target, requestId, signal }) => {
        if (target !== rid || !currentPair() || signal.aborted) throw new Error('Verbinding gewijzigd. Kies de receiver opnieuw.');
        const reply = await transactBle({ TYPE: 'MESH_IDENTIFY', TARGET: rid, PORT: 0, KEY: bridge.networkKey }, 3600, true, signal);
        if (!currentPair() || signal.aborted || reply.STATUS !== 'OK' || reply.DETAIL !== 'MESH_IDENTIFIED' ||
            String(reply.TARGETACK) !== '1' || exactRid(reply.TARGETRID) !== rid) {
          throw new Error('De LED Line bevestigde het knipperen niet. Controleer de verbinding en receiverfirmware.');
        }
        return { ok: true, rid, requestId };
      }
    });
    if (!recognition.confirmed || recognition.rid !== rid || !currentPair()) {
      throw Object.assign(new Error('Toevoegen geannuleerd.'), { code: 'IDENTIFY_CANCELLED', reason: recognition.reason });
    }
    if (!existing || info.PAIRED !== '1' || token) {
      if (!/^[0-9A-F]{16}$/.test(token)) {
        throw new Error('Koppeltijd verstreken. Zet alleen deze nog ongebruikte receiver opnieuw aan. Is hij al gekoppeld? Gebruik de installatie-PIN.');
      }
      const requestedMeshId = /^[0-9A-F]{8}$/.test(bridge.networkKey.slice(0, 8)) &&
        bridge.networkKey.slice(0, 8) !== '00000000'
        ? bridge.networkKey.slice(0, 8) : `A1${rid.slice(-6)}`;
      const fields = {
        TYPE: 'MESH_MAIN', PAIR_TOKEN: token, MESHID: requestedMeshId,
        NETWORK: bridge.networkKey, TARGET: rid,
        NUMBER: clamp(existing?.number || number, 1, 250, 1)
      };
      pairReply = await transactBle(fields, 4200, true);
      const replyRid = exactRid(pairReply.RID || pairReply.TARGETRID);
      const committed = pairReply.STATUS === 'OK' && replyRid === rid &&
        pairReply.DETAIL === 'MESH_MAIN_READY' && pairReply.MESHROLE === 'MAIN';
      if (!committed) throw new Error(pairReply.DETAIL || 'Koppeling niet bevestigd');
    }
    try {
      const status = await transactBle({ TYPE: 'STATUS', TARGET: rid, DEVTYPE: ble.receiverType }, 3600);
      receiveLine(Object.entries(status).map(([key, value]) => `${key}=${value}`).join(';'));
    } catch (_) {}
    const record = deviceRecord(info, pairReply);
    Object.values(bridge.receivers).forEach((item) => { item.online = false; item.gateway = false; });
    bridge.receivers[rid] = record;
    if (device.id) bridge.browserDeviceIds[rid] = String(device.id);
    if (!bridge.preferredGatewayRid) bridge.preferredGatewayRid = rid;
    persistBridge();
    return record;
  }

  function fieldsFromTransport(raw = {}) {
    const source = raw.device || raw.fields || raw;
    const fields = {
      ...source,
      RID: source.RID || source.rid,
      HWID: source.HWID || source.hardwareId,
      PHYSID: source.PHYSID || source.physicalId,
      MAC: source.MAC || source.mac,
      CANONRID: source.CANONRID || source.canonicalRid,
      IDSCHEMA: source.IDSCHEMA ?? source.identitySchema,
      IDLEGACY: source.IDLEGACY ?? (source.identityLegacy == null ? undefined : Number(source.identityLegacy)),
      DEVTYPE: source.DEVTYPE || source.receiverType || source.type,
      NUMBER: source.NUMBER || source.number,
      PHYSICAL: source.PHYSICAL ?? source.pixels,
      PHYSICALREVERSE: source.PHYSICALREVERSE ?? Number(Boolean(source.physicalReverse ?? source.reversed)),
      PORTMASK: source.PORTMASK ?? source.portMask,
      PORTCAP: source.PORTCAP ?? source.portCapacity ?? source.spiPortCapability,
      PORTS: source.PORTS ?? source.activePortCount,
      MAP1: source.MAP1 ?? source.rgbwChannelMaps?.[1] ?? source.rgbwChannelMaps?.['1'],
      MAP2: source.MAP2 ?? source.rgbwChannelMaps?.[2] ?? source.rgbwChannelMaps?.['2'],
      MODEL: source.MODEL || source.model,
      BOARD: source.BOARD || source.board,
      FWVER: source.FWVER || source.firmwareVersion,
      FWVARIANT: source.FWVARIANT || source.firmwareVariant,
      OTA: source.OTA ?? Number(Boolean(source.otaCapable)),
      OTAV: source.OTAV ?? source.otaProtocol,
      OTAMAX: source.OTAMAX ?? source.otaMaxBytes
    };
    for (let port = 1; port <= 4; port += 1) {
      const stored = source.spiPorts?.[port] || source.spiPorts?.[String(port)] || {};
      fields[`P${port}EN`] ??= stored.enabled == null ? undefined : Number(Boolean(stored.enabled));
      fields[`P${port}PX`] ??= stored.pixels;
      fields[`P${port}REV`] ??= stored.reversed == null ? stored.physicalReverse : Number(Boolean(stored.reversed));
      fields[`P${port}GROUP`] ??= stored.groupPixels;
      fields[`P${port}OFFSET`] ??= stored.offset;
    }
    return fields;
  }

  async function pairReceiver(number) {
    const adapter = primaryAdapter();
    if (!adapter || typeof adapter.pair !== 'function') {
      throw new Error('Maak eerst verbinding met de controller van deze installatie.');
    }
    if (!adapterReady(adapter)) await connectPrimaryTransport(true);
    if (!adapterReady(adapter)) throw new Error('De controllerverbinding kon niet worden geopend.');
    const operation = adapter.pair({
        number: clamp(number, 1, 250, 1),
        installationSecret: bridge.masterSecret,
        compatibilityKey: bridge.networkKey,
        publicTag: bridge.publicTag
      });
    const raw = adapter.managesOperationTimeouts
      ? await operation
      : await withTimeout(operation, 15000, 'Receiver toevoegen timeout');
    const fields = fieldsFromTransport(raw);
    const rid = exactRid(fields.RID);
    if (!rid) throw new Error('De receiver gaf geen geldige identiteit door.');
    const record = deviceRecord(fields, {}, {});
    Object.values(bridge.receivers).forEach((item) => { item.online = false; item.gateway = false; });
    bridge.receivers[rid] = { ...record, online: true, gateway: Boolean(raw.gateway) };
    bridge.preferredGatewayRid = exactRid(raw.gatewayRid) || bridge.preferredGatewayRid || rid;
    persistBridge();
    return bridge.receivers[rid];
  }

  let pairingOperationActive = false;
  async function runPairOperation(operation) {
    if (pairingOperationActive) throw new Error('Er wordt al een receiver toegevoegd. Rond die stap eerst af.');
    pairingOperationActive = true;
    try { return await operation(); }
    finally { pairingOperationActive = false; }
  }

  function closeRejectedGateway(device) {
    try { device?.gatt?.disconnect(); } catch (_) {}
    onDisconnected();
    ble.device = null;
    ble.rid = '';
    ble.receiverType = 'SPI';
    ble.fields = {};
  }

  async function acceptKnownGateway(device, info) {
    const rid = exactRid(info.RID);
    if (!rid || !bridge.receivers[rid]) {
      closeRejectedGateway(device);
      throw new Error('Deze receiver is nog niet aan deze installatie gekoppeld. Gebruik eerst Receiver toevoegen.');
    }
    if (info.PAIRED && info.PAIRED !== '1') {
      closeRejectedGateway(device);
      throw new Error('Deze receiver is gereset. Voeg hem opnieuw toe met een nieuwe NFC-tik.');
    }
    ble.rid = rid;
    ble.receiverType = String(info.DEVTYPE || bridge.receivers[rid].receiverType).toUpperCase() === 'RGBW' ? 'RGBW' : 'SPI';
    const status = await transactBle({ TYPE: 'STATUS', TARGET: rid, DEVTYPE: ble.receiverType }, 3600, true);
    const reportedRid = exactRid(status.TARGETRID) || (!status.TARGETRID ? exactRid(status.RID) : '');
    if (status.STATUS !== 'OK' || reportedRid !== rid) {
      closeRejectedGateway(device);
      throw new Error(status.DETAIL || 'De gekozen receiver kon niet veilig worden bevestigd');
    }
    receiveLine(Object.entries(status).map(([key, value]) => `${key}=${value}`).join(';'));
    Object.values(bridge.receivers).forEach((item) => { item.online = false; item.gateway = false; });
    bridge.receivers[rid] = deviceRecord(info, status);
    if (device.id) bridge.browserDeviceIds[rid] = String(device.id);
    bridge.preferredGatewayRid = rid;
    persistBridge();
    return true;
  }

  async function reconnectPermittedGateway() {
    if (ble.connected && ble.device?.gatt?.connected) return true;
    if (recoveryConnectPromise) return recoveryConnectPromise;
    if (!navigator.bluetooth || typeof navigator.bluetooth.getDevices !== 'function') return false;
    recoveryConnectPromise = (async () => {
      const permitted = await withTimeout(navigator.bluetooth.getDevices(), 4000, 'Recoverylijst timeout');
      if (!Array.isArray(permitted) || !permitted.length) return false;
      const order = [bridge.preferredGatewayRid, ...Object.keys(bridge.receivers)].filter(Boolean);
      let device = null;
      for (const rid of order) {
        const browserId = bridge.browserDeviceIds?.[rid];
        if (browserId) device = permitted.find((candidate) => String(candidate.id) === String(browserId));
        if (device) break;
      }
      if (!device) return false;
      const info = await attachDevice(device);
      return acceptKnownGateway(device, info);
    })().finally(() => { recoveryConnectPromise = null; });
    return recoveryConnectPromise;
  }

  async function chooseKnownGateway() {
    if (!navigator.bluetooth || typeof navigator.bluetooth.requestDevice !== 'function') {
      throw new Error('Recoveryverbinding is niet beschikbaar op dit toestel.');
    }
    if (!Object.keys(bridge.receivers).length) {
      throw new Error('Voeg eerst een receiver toe voordat je een recoverygateway kiest.');
    }
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [UUIDS.service] }],
      optionalServices: [UUIDS.service]
    });
    const info = await attachDevice(device);
    return acceptKnownGateway(device, info);
  }

  async function refreshInventory(active) {
    if (otaController?.busy) return;
    const adapter = primaryAdapter();
    if (adapter) {
      if (!adapterReady(adapter)) await connectPrimaryTransport(active);
      if (!adapterReady(adapter)) return;
      if (typeof adapter.discover === 'function') {
        // A full 20-receiver gateway inventory is paged. Six seconds could
        // expire halfway through a healthy mesh and make the remaining lines
        // appear offline, especially while iOS revalidates a no-internet AP.
        const operation = adapter.discover({ active: Boolean(active) });
        const inventory = adapter.managesOperationTimeouts
          ? await operation
          : await withTimeout(operation, 12000, 'Receiverlijst timeout');
        const devices = Array.isArray(inventory) ? inventory : inventory?.devices;
        if (Array.isArray(devices)) assertIdentityInventory(devices);
        if (Array.isArray(devices)) devices.forEach((raw) => {
          try {
            const fields = fieldsFromTransport(raw);
            const discoveredRid = exactRid(fields.RID);
            // A native gateway inventory also contains factory-fresh ESP-NOW
            // candidates. Discovery may refresh known receivers, but adding a
            // new physical receiver must always go through the explicit pair
            // flow where identity and end-to-end acknowledgement are checked.
            if (adapter.requiresExplicitPairing && (!discoveredRid || !bridge.receivers[discoveredRid])) return;
            const record = deviceRecord(fields, {}, {});
            bridge.receivers[record.rid] = { ...(bridge.receivers[record.rid] || {}), ...record };
          } catch (_) {}
        });
        persistBridge();
      }
      return;
    }
    // Recovery BLE is intentionally never opened by normal discovery. It can
    // only be enabled through the hidden recovery API while AP rollout is
    // being validated.
    if (!ble.connected || !ble.rid) return;
    try {
      const status = await transactBle({ TYPE: 'STATUS', TARGET: ble.rid, DEVTYPE: ble.receiverType }, 3400, true);
      if (status.STATUS === 'OK') {
        receiveLine(Object.entries(status).map(([key, value]) => `${key}=${value}`).join(';'));
        bridge.receivers[ble.rid] = deviceRecord({ RID: ble.rid, DEVTYPE: ble.receiverType });
        persistBridge();
      }
    } catch (_) {}
  }

  function transportStatus() {
    const primary = primaryAdapter();
    const primaryReady = adapterReady(primary);
    const recoveryReady = ble.connected && Boolean(ble.rid);
    const adapterGatewayRid = exactRid(
      typeof primary?.gatewayRid === 'function' ? primary.gatewayRid() : primary?.gatewayRid
    );
    const gatewayRid = primaryReady ? (adapterGatewayRid || bridge.preferredGatewayRid) : (recoveryReady ? ble.rid : '');
    const gateway = gatewayRid ? bridge.receivers[gatewayRid] : null;
    return {
      gatewayReady: Boolean(primaryReady || recoveryReady),
      gateway: gateway ? { rid: gateway.rid, hardwareId: gateway.hardwareId, receiverType: gateway.receiverType } : {},
      transport: 'WIFI_AP_ESPNOW',
      primaryTransport: 'WIFI_AP',
      activeTransport: primaryReady ? 'WIFI_AP' : (recoveryReady ? 'RECOVERY' : 'OFFLINE'),
      state: primaryReady || recoveryReady ? 'ready' : 'offline',
      installationTag: bridge.publicTag
    };
  }

  function publicReceivers() {
    const status = transportStatus();
    const activeGatewayRid = exactRid(status.gateway?.rid);
    return Object.values(bridge.receivers).map((record) => {
      const isGateway = Boolean(status.gatewayReady && activeGatewayRid && record.rid === activeGatewayRid);
      return {
        ...record,
        online: status.gatewayReady && (record.online !== false || isGateway),
        gateway: isGateway,
        reachableViaGateway: status.gatewayReady,
        reachability: isGateway ? 'gateway' : (status.gatewayReady ? 'esp_now' : 'unknown'),
        lastSeenMs: isGateway ? 0 : null
      };
    }).sort((left, right) => Number(left.number || 999) - Number(right.number || 999));
  }

  function rgb(hex, white = 0, rgbOn = true, whiteOn = true) {
    const clean = String(hex || '#000000').replace('#', '');
    const channels = /^[0-9A-F]{6}$/i.test(clean)
      ? [0, 2, 4].map((index) => parseInt(clean.slice(index, index + 2), 16))
      : [0, 0, 0];
    if (!rgbOn) channels.fill(0);
    return [...channels, whiteOn ? clamp(white, 0, 255, 0) : 0].join(',');
  }

  function cyclesPerSecond(speed, receiverType, engine) {
    const value = clamp(speed, 0, 100, 0);
    if (!value) return 0;
    const normalized = value / 100;
    if (receiverType === 'RGBW') {
      return engine === 'SPARKLE'
        ? 0.50 + normalized * normalized * 11.50
        : 0.003 + normalized * normalized * 1.497;
    }
    return 0.002 + normalized * normalized * 0.80;
  }

  function phaseFor(timelineId, state, receiverType, at = performance.now()) {
    const key = String(timelineId || 'default').slice(0, 160);
    const speed = clamp(state.speed, 0, 100, 22);
    const engine = String(state.engine || 'CHASE').toUpperCase();
    const restartToken = Number(state.restartToken || 0);
    const parsedPhaseMs = Number(state.phaseMs);
    const phaseOffset = Number.isFinite(parsedPhaseMs) ? parsedPhaseMs / 1000 : 0;
    const signature = `${engine}:${clamp(state.variant, 0, 255, 0)}:${state.direction === 'left' ? 'left' : 'right'}`;
    const current = phaseClocks.get(key);
    let phase = current
      ? (current.phase + ((at - current.at) / 1000) * cyclesPerSecond(current.speed, current.receiverType, current.engine)) % 1
      : phaseOffset % 1;
    if (current && (current.restartToken !== restartToken || current.signature !== signature || current.receiverType !== receiverType)) {
      phase = phaseOffset % 1;
    }
    phaseClocks.set(key, { phase, at, speed, engine, restartToken, signature, receiverType, used: at });
    if (phaseClocks.size > 128) {
      const oldest = [...phaseClocks.entries()].sort((left, right) => left[1].used - right[1].used)[0]?.[0];
      if (oldest && oldest !== key) phaseClocks.delete(oldest);
    }
    return Math.round((((phase % 1) + 1) % 1) * 1000) % 1000;
  }

  /* Keep the wire payload aligned with the controls and with what the receiver
     renderer actually consumes.  A hidden setting must never leak a stale
     value into another effect just because every SceneState happens to contain
     the same storage fields. */
  function effectCommandCapabilities(receiverType, engine, variant, isParallel, lineCount) {
    const capabilities = {
      speed: false, width: false, smooth: false, background: false,
      spacing: false, count: false, trail: false, spread: false,
      randomness: false, bounce: false, mirror: false, direction: false,
      lineDelay: false
    };

    if (receiverType === 'RGBW') {
      if (engine === 'STATIC') return capabilities;
      capabilities.speed = true;
      capabilities.direction = ((variant >= 5 && variant <= 16) || (variant >= 21 && variant <= 24) || variant === 26 || variant === 27) && isParallel && lineCount > 1;
      capabilities.lineDelay = capabilities.direction;
      // These are the only RGBW variants whose numeric smoothness value is
      // consumed by the receiver. Other fades have a deliberately fixed curve.
      capabilities.smooth = (engine === 'SPARKLE' && (variant === 4 || variant === 11 || variant === 20)) ||
        (engine === 'CHASE' && variant === 8) || (engine === 'WAVE' && variant === 12) ||
        (variant >= 17 && variant <= 27);
      capabilities.spacing = variant === 19 || variant === 20 || variant === 22;
      return capabilities;
    }

    if (variant >= 90 && variant <= 97) {
      capabilities.speed = true;
      capabilities.smooth = true;
      capabilities.background = true;
      capabilities.width = variant === 94 || variant === 96 || variant === 97;
      capabilities.direction = variant >= 92;
      capabilities.spacing = [90, 91, 94, 96, 97].includes(variant);
      capabilities.count = [93, 94, 96, 97].includes(variant);
      capabilities.mirror = [94, 96, 97].includes(variant);
      // Synchronized Rows (97) intentionally shares one exact position, so a
      // per-line delay would contradict that effect rather than tune it.
      capabilities.lineDelay = isParallel && lineCount > 1 && variant <= 96;
      return capabilities;
    }

    if (variant >= 98 && variant <= 102) {
      capabilities.speed = true;
      capabilities.smooth = variant === 102;
      capabilities.background = variant === 98 || variant === 99 || variant === 102;
      capabilities.direction = isParallel && lineCount > 1;
      capabilities.lineDelay = capabilities.direction;
      return capabilities;
    }

    // The two measured ribbon effects have dedicated SPI renderers. Keep the
    // transmitted controls limited to their real parameters so stale generic
    // COMET count/spacing/bounce fields cannot alter the reference motion.
    if (variant === 103 || variant === 120) {
      capabilities.speed = true;
      capabilities.width = true;
      capabilities.smooth = true;
      capabilities.background = true;
      capabilities.trail = true;
      capabilities.direction = true;
      return capabilities;
    }

    if (variant >= 104 && variant <= 111) {
      capabilities.speed = true;
      capabilities.smooth = true;
      capabilities.background = true;
      capabilities.direction = true;
      capabilities.lineDelay = isParallel && lineCount > 1;
      capabilities.width = variant >= 109;
      capabilities.spacing = variant === 108;
      capabilities.trail = variant === 111;
      capabilities.mirror = variant === 110;
      return capabilities;
    }

    // V21 general effects each have a dedicated receiver renderer. Keep this
    // table in lockstep with v21_animation_catalog.js so an old hidden control
    // can never bleed into a newly selected effect.
    if (variant >= 112 && variant <= 119) {
      capabilities.speed = true;
      capabilities.smooth = true;
      capabilities.width = [112, 113, 115, 117, 118, 119].includes(variant);
      capabilities.direction = [112, 115, 117].includes(variant);
      capabilities.trail = variant === 115 || variant === 117;
      capabilities.count = [116, 118, 119].includes(variant);
      capabilities.randomness = variant === 117 || variant === 118;
      capabilities.spread = variant === 114 || variant === 116;
      capabilities.background = variant === 114 || variant === 116;
      return capabilities;
    }

    if (variant >= 121 && variant <= 125) {
      capabilities.speed = true;
      capabilities.width = true;
      capabilities.spacing = true;
      capabilities.trail = true;
      capabilities.smooth = true;
      capabilities.direction = true;
      capabilities.spread = variant === 123;
      // Segment density and ember population are controlled by SPACING.
      capabilities.count = false;
      capabilities.randomness = variant === 125;
      capabilities.background = variant === 125;
      return capabilities;
    }

    if (variant >= 126 && variant <= 128) {
      capabilities.speed = true;
      capabilities.width = true;
      capabilities.smooth = true;
      capabilities.count = true;
      capabilities.spacing = variant !== 128;
      capabilities.direction = variant !== 127;
      capabilities.lineDelay = variant === 128 && isParallel && lineCount > 1;
      return capabilities;
    }

    if (variant >= 129 && variant <= 131) {
      capabilities.speed = capabilities.width = capabilities.smooth = true;
      capabilities.count = capabilities.spacing = capabilities.direction = capabilities.background = true;
      capabilities.trail = variant === 131;
      return capabilities;
    }

    const movingGradient = engine === 'GRADIENT' && variant % 6 !== 0;
    if (engine === 'GRADIENT') {
      capabilities.speed = movingGradient;
      capabilities.direction = movingGradient;
      capabilities.spread = true;
      return capabilities;
    }
    if (engine === 'WARM') {
      capabilities.speed = true;
      return capabilities;
    }
    if (engine === 'STATIC') return capabilities;

    const exactWidth = ['FLOW', 'WAVE', 'SCANNER', 'DUAL', 'MIRROR', 'COMET',
      'ALTERNATE', 'SEQUENCE', 'CASCADE', 'MINIMAL', 'CHASE', 'SPARKLE'];
    const objectEffects = ['FLOW', 'WAVE', 'DUAL', 'MIRROR', 'COMET',
      'SEQUENCE', 'CASCADE', 'MINIMAL', 'CHASE', 'SPARKLE'];
    const spacedEffects = ['FLOW', 'WAVE', 'COMET', 'ALTERNATE', 'SEQUENCE',
      'CASCADE', 'MINIMAL', 'CHASE'];
    capabilities.speed = true;
    capabilities.width = exactWidth.includes(engine);
    capabilities.smooth = !['BREATHE', 'SPARKLE', 'ALL'].includes(engine);
    capabilities.background = !['ALL'].includes(engine);
    capabilities.direction = !['BREATHE', 'SPARKLE', 'ALL'].includes(engine);
    capabilities.spacing = spacedEffects.includes(engine);
    capabilities.count = objectEffects.includes(engine);
    capabilities.trail = engine === 'COMET' || engine === 'SCANNER';
    capabilities.spread = ['FLOW', 'WAVE', 'BREATHE', 'DUAL', 'MIRROR'].includes(engine);
    capabilities.randomness = engine === 'SPARKLE';
    capabilities.bounce = ['CHASE', 'COMET', 'SCANNER', 'MINIMAL'].includes(engine);
    capabilities.mirror = ['CHASE', 'SCANNER', 'WAVE', 'FLOW', 'MINIMAL'].includes(engine);
    return capabilities;
  }

  function liveFields(body, target, targetIndex, targets, save) {
    const state = body.state || {};
    const receiverType = String(target.receiverType || state.receiverType || 'SPI').toUpperCase() === 'RGBW' ? 'RGBW' : 'SPI';
    const requestedLeft = state.direction === 'left';
    const engine = String(state.engine || 'CHASE').toUpperCase();
    const canonicalSpi = receiverType === 'SPI' && Number(state.variant) >= 104 && Number(state.variant) <= 131;
    const motionReverse = !canonicalSpi && ['GRADIENT', 'ALTERNATE'].includes(engine) ? !requestedLeft : requestedLeft;
    const physicalReverse = Boolean(target.reversed);
    const colors = Array.isArray(state.colors) && state.colors.length ? state.colors.slice(0, 4) : ['#873ada'];
    const whites = Array.isArray(state.whiteChannels) ? state.whiteChannels.slice(0, 4) : [0, 0, 0, 0];
    const rgbFlags = Array.isArray(state.rgbEnabled) ? state.rgbEnabled.slice(0, 4) : [true, true, true, true];
    const whiteFlags = Array.isArray(state.whiteEnabled) ? state.whiteEnabled.slice(0, 4) : whites.map((value) => Number(value) > 0);
    while (colors.length < 4) colors.push(['#ffffff', '#42c7a2', '#f0a43c'][Math.min(colors.length - 1, 2)] || '#ffffff');
    while (whites.length < 4) whites.push(0);
    while (rgbFlags.length < 4) rgbFlags.push(true);
    while (whiteFlags.length < 4) whiteFlags.push(false);
    if (engine === 'WARM') {
      colors.splice(0, 4, '#000000', '#000000', '#000000', '#000000');
      whites.splice(0, 4, clamp(whites[0], 1, 255, 235), 0, 0, 0);
      rgbFlags.splice(0, 4, false, false, false, false);
      whiteFlags.splice(0, 4, true, false, false, false);
    }
    const isParallel = Boolean(target.layoutParallel);
    let groupPixels = clamp(state.groupPixels || target.groupPixels || target.pixels, 1, 65535, 1);
    if (receiverType === 'SPI' && !isParallel && targets.length > 1) {
      groupPixels = targets.reduce((sum, item) => sum + clamp(item.pixels, 1, 1024, 1), 0);
    } else if (receiverType === 'SPI' && isParallel) {
      groupPixels = clamp(target.pixels, 1, 1024, 1);
    }
    const parsedOffset = Number(target.offset || 0);
    let offset = Number.isFinite(parsedOffset) ? parsedOffset : 0;
    if (receiverType === 'SPI' && !isParallel && targets.length > 1) {
      offset = targets.slice(0, targetIndex).reduce((sum, item) => sum + clamp(item.pixels, 1, 1024, 1), 0);
    }
    const variant = clamp(state.variant, 0, 255, 0);
    const lineCount = clamp(target.lineCount || (isParallel ? targets.length : 1), 1, 120, 1);
    const lineTimed = isParallel && lineCount > 1 &&
      ((receiverType === 'SPI' && ((variant >= 90 && variant <= 102) || (variant >= 104 && variant <= 111) || variant === 128)) ||
       (receiverType === 'RGBW' && ((variant >= 5 && variant <= 16) || (variant >= 21 && variant <= 24) || variant === 26 || variant === 27)));
    const capabilities = effectCommandCapabilities(receiverType, engine, variant, isParallel, lineCount);
    const transitionMs = receiverType === 'RGBW'
      ? clamp(state.transitionMs, 0, 1800000, 240)
      : clamp(state.transitionMs, 0, 1000, 70);
    const fields = {
      TYPE: save ? 'SAVE' : 'LIVE', KEY: bridge.networkKey,
      TARGET: exactRid(target.physicalRid || target.rid || target.receiverId),
      DEVTYPE: receiverType, SCENE: engine, VARIANT: variant,
      FG: rgb(colors[0], whites[0], rgbFlags[0], whiteFlags[0]),
      FG2: rgb(colors[1], whites[1], rgbFlags[1], whiteFlags[1]),
      FG3: rgb(colors[2], whites[2], rgbFlags[2], whiteFlags[2]),
      FG4: rgb(colors[3], whites[3], rgbFlags[3], whiteFlags[3]),
      COLORS: engine === 'WARM' ? 1 : clamp(state.colorCount || colors.length, 1, 4, 1),
      BRIGHT: clamp(state.brightness, 0, 100, 100),
      LINEINDEX: clamp(target.lineIndex ?? targetIndex, 0, lineCount - 1, targetIndex), LINECOUNT: lineCount,
      PARALLEL: Number(isParallel),
      RESTART: clamp(state.restartToken, 0, Number.MAX_SAFE_INTEGER, 0),
      POWER: 100, WHITEMIX: 0, TRANSITIONMS: Math.round(transitionMs),
      PHASEMS: phaseFor(body.timelineId || state.timelineId, state, receiverType,
        bodyHostStarts.get(body) ?? performance.now()), TEST: 'NONE'
    };
    if (capabilities.background) {
      fields.BG = rgb(state.background || '#000000', state.backgroundWhite || 0,
        state.backgroundRgbEnabled !== false, state.backgroundWhiteEnabled !== false);
      fields.BGON = Number(state.backgroundOn !== false);
      fields.BGBRIGHT = clamp(state.bgBrightness, 0, 100, 10);
    }
    if (capabilities.speed) fields.SPEED = clamp(state.speed, 0, 100, 22);
    if (capabilities.width) {
      fields.WIDTH = clamp(state.width, 1, 100, 30);
      fields.WIDTHPX = clamp(state.widthPixels, 1, Math.min(groupPixels, 8192), 3);
    }
    if (capabilities.smooth) fields.SMOOTH = clamp(state.smooth, 0, 100, 90);
    if (capabilities.spacing) fields.SPACING = clamp(state.spacing, 0, 100, 50);
    if (capabilities.count) fields.COUNT = clamp(state.objectCount, 1, 8, 1);
    if (capabilities.trail) fields.TRAIL = clamp(state.trailLength, 0, 100, 45);
    if (capabilities.spread) fields.SPREAD = clamp(state.spread, 0, 100, 50);
    if (capabilities.randomness) fields.RANDOM = clamp(state.randomness, 0, 100, 25);
    if (capabilities.bounce) fields.BOUNCE = Number(Boolean(state.bounce));
    if (capabilities.mirror) fields.MIRROR = Number(Boolean(state.mirror));
    if (capabilities.direction) {
      fields.REVERSE = Number(physicalReverse !== motionReverse);
      fields.MOTIONREVERSE = Number(motionReverse);
    }
    if (capabilities.lineDelay && lineTimed) {
      fields.LINEDELAYMS = Math.round(clamp(state.lineDelayMs, 0, 5080, 240) / 40) * 40;
    }
    const rawPort = target.port ?? target.outputPort;
    if (receiverType === 'RGBW') {
      fields.PORT = rawPort === 0 ? 0 : clamp(rawPort, 1, 2, 1);
      delete fields.WIDTH; delete fields.WIDTHPX; delete fields.PHYSICALREVERSE;
      delete fields.MOTIONREVERSE; delete fields.PIXELS; delete fields.GROUPPIXELS; delete fields.OFFSET;
    } else {
      fields.PORT = rawPort === 0 ? 0 : clamp(rawPort, 1, 4, 1);
      fields.PHYSICALREVERSE = Number(physicalReverse);
      fields.PIXELS = groupPixels; fields.GROUPPIXELS = groupPixels; fields.OFFSET = offset;
    }
    return fields;
  }

  function commandFields(body, target, targetIndex, targets) {
    const action = String(body.action || 'live').toUpperCase();
    const receiverType = String(target.receiverType || body.state?.receiverType || 'SPI').toUpperCase() === 'RGBW' ? 'RGBW' : 'SPI';
    // Every logical output is addressed by the physical receiver RID plus an
    // explicit PORT. This also prevents two outputs of one SPI receiver from
    // being collapsed into one destination by the transport.
    const rid = exactRid(target.physicalRid || target.rid || target.receiverId);
    const base = { TARGET: rid, DEVTYPE: receiverType };
    const maximumPort = receiverType === 'RGBW' ? 2 : 4;
    const rawSelectedPort = target.port ?? target.outputPort;
    const selectedPort = rawSelectedPort === 0 ? 0 : clamp(rawSelectedPort, 1, maximumPort, 1);
    if (action === 'STATUS') {
      return { TYPE: 'STATUS', ...base, PORT: selectedPort };
    }
    // Hardware unpairing always targets the complete physical receiver. A
    // single RGBW LED Line is detached from its group locally and must never
    // receive an UNPAIR containing PORT.
    if (action === 'UNPAIR') return { TYPE: 'UNPAIR', KEY: bridge.networkKey, ...base, PORT: 0 };
    if (['SETUP_BEGIN', 'SETUP_KEEPALIVE', 'SETUP_END', 'SETUP_CANCEL'].includes(action)) {
      return { TYPE: action, KEY: bridge.networkKey, ...base, PORT: 0,
        PORTMASK: receiverType === 'SPI' ? clamp(target.portMask, 1, 15, 1) : clamp(target.portMask, 1, 3, 3) };
    }
    if (action === 'CONFIG') {
      if (receiverType === 'RGBW') {
        const portMask = clamp(target.portMask, 1, 3, 3);
        const port = clamp(target.port, 0, 2, 0);
        const fields = { TYPE: 'CONFIG', KEY: bridge.networkKey, ...base, PORT: port, PORTMASK: portMask, PHYSICAL: portMask };
        const portMode = String(target.portMode || target.rgbwOutputMode || body.state?.portMode || '').toUpperCase();
        if (['LINKED', 'SEPARATE'].includes(portMode)) fields.PORTMODE = portMode;
        const map = rgbwChannelMap(target.channelMap ?? target.map);
        if (port && map) fields.MAP = map;
        return commandMetadata(fields, body, rid, receiverType, false);
      }
      const mask = clamp(target.portMask, 1, 15, 1);
      if (selectedPort === 0) {
        return commandMetadata({ TYPE: 'CONFIG', KEY: bridge.networkKey, TARGET: rid, DEVTYPE: 'SPI',
          PORT: 0, PORTMASK: mask, PORTS: popcount4(mask) }, body, rid, receiverType, false);
      }
      return commandMetadata({ TYPE: 'CONFIG', KEY: bridge.networkKey, TARGET: rid, DEVTYPE: 'SPI',
        PORT: selectedPort, PORTMASK: mask, PORTS: popcount4(mask),
        PHYSICAL: clamp(target.pixels, 1, 1024, 60), PHYSICALREVERSE: Number(Boolean(target.reversed)),
        GROUPPIXELS: clamp(target.groupPixels || target.pixels, 1, 65535, 60),
        OFFSET: clamp(target.offset, 0, 65535, 0) }, body, rid, receiverType, false);
    }
    if (action === 'IDENTIFY') {
      const fields = { TYPE: 'TEST', KEY: bridge.networkKey, ...base, TEST: 'IDENTIFY' };
      fields.PORT = selectedPort;
      if (receiverType === 'RGBW') fields.PORT = target.port === 0 ? 0 : clamp(target.port, 1, 2, 1);
      else {
        fields.PIXELS = clamp(body.state?.groupPixels || target.groupPixels || target.pixels, 1, 65535, 1);
        fields.GROUPPIXELS = fields.PIXELS; fields.OFFSET = clamp(target.offset, 0, 65535, 0);
      }
      return commandMetadata(fields, body, rid, receiverType, true);
    }
    if (action === 'RGBW_TEST') {
      if (receiverType !== 'RGBW') throw new Error('De kleurtest is alleen beschikbaar voor een RGBW-receiver');
      const test = String(body.state?.test || '').trim().toUpperCase();
      if (!['RED', 'GREEN', 'BLUE', 'WHITE', 'OFF'].includes(test)) {
        throw new Error('Kies rood, groen, blauw, wit of uit voor de RGBW-kleurtest');
      }
      const fields = { TYPE: 'TEST', KEY: bridge.networkKey, ...base, PORT: selectedPort, TEST: test };
      if (body.state?.raw === true || target.rawTest === true) fields.RAW = 1;
      return commandMetadata(fields, body, rid, receiverType, true);
    }
    if (['CALIBRATE', 'CALIBRATE_FILL', 'CALIBRATE_END', 'CALIBRATE_START'].includes(action)) {
      const pixels = clamp(target.pixels, 1, 1024, 1);
      // Show the complete selected length during pixel-count setup: white
      // pixels followed by one red endpoint. END only lit the red marker.
      const test = action === 'CALIBRATE_END' ? 'FILL' : action === 'CALIBRATE_START' ? 'START' : 'FILL';
      return commandMetadata({ TYPE: 'TEST', KEY: bridge.networkKey, TARGET: rid, DEVTYPE: 'SPI', TEST: test,
        PORT: selectedPort,
        PHYSICAL: pixels, PIXELS: pixels, GROUPPIXELS: pixels, OFFSET: 0,
        PHYSICALREVERSE: Number(Boolean(target.reversed)) }, body, rid, receiverType, true);
    }
    if (action === 'CALIBRATE_CLEAR') {
      return commandMetadata({ TYPE: 'TEST', KEY: bridge.networkKey, TARGET: rid, DEVTYPE: 'SPI', TEST: 'CLEAR', PORT: selectedPort }, body, rid, receiverType, true);
    }
    return commandMetadata(liveFields(body, target, targetIndex, targets, action === 'SAVE'),
      body, rid, receiverType, action === 'LIVE');
  }

  function validatedCommand(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Ongeldige receiveropdracht');
    const action = String(body.action || 'live').toUpperCase();
    if (!COMMAND_ACTIONS.has(action)) throw new Error(`Onbekende receiveractie: ${action}`);
    if (!body.state || typeof body.state !== 'object' || Array.isArray(body.state)) throw new Error('Ongeldige receiverstatus');
    if (!Array.isArray(body.targets)) throw new Error('Ongeldige receiverdoelen');
    const endpoints = new Set();
    const receiverTypes = new Set();
    const targets = body.targets.map((raw) => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Ongeldig receiverdoel');
      const target = { ...raw };
      const rid = exactRid(target.rid || target.receiverId);
      if (!rid) throw new Error('Receiverdoel heeft geen geldig RID');
      target.rid = rid;
      const receiverType = String(target.receiverType || body.state.receiverType || 'SPI').toUpperCase();
      if (!['SPI', 'RGBW'].includes(receiverType)) throw new Error('Onbekend receivertype');
      target.receiverType = receiverType;
      target.physicalRid = receiverType === 'RGBW'
        ? (exactRid(target.physicalRid) || rid)
        : (exactRid(target.physicalRid) || rid);
      receiverTypes.add(receiverType);
      if (receiverType !== 'SPI' && (CALIBRATION_ACTIONS.has(action) || action === 'CALIBRATE_CLEAR')) {
        throw new Error('Pixelkalibratie is alleen beschikbaar voor SPI-receivers');
      }
      const receiverWide = ['SETUP_BEGIN', 'SETUP_KEEPALIVE', 'SETUP_END', 'SETUP_CANCEL', 'UNPAIR'].includes(action);
      const maximumPort = receiverType === 'RGBW' ? 2 : 4;
      const rawPort = target.port ?? target.outputPort;
      const port = receiverWide ? 0 : rawPort === 0 ? 0 : clamp(rawPort, 1, maximumPort, 1);
      target.port = port;
      target.outputPort = port;
      if (receiverType === 'RGBW' && ['LIVE', 'SAVE', 'IDENTIFY', 'RGBW_TEST', 'STATUS'].includes(action) && ![0, 1, 2].includes(port)) {
        throw new Error('RGBW-doel mist poort 1 of 2');
      }
      if (action === 'RGBW_TEST' && receiverType !== 'RGBW') {
        throw new Error('De RGBW-kleurtest kan niet naar een SPI-receiver worden gestuurd');
      }
      if (receiverType === 'RGBW' && action === 'CONFIG' &&
          (target.port != null || target.outputPort != null) && ![0, 1, 2].includes(port)) {
        throw new Error('RGBW-configuratie bevat een ongeldige poort');
      }
      if (receiverType === 'RGBW' && action === 'UNPAIR' && port) {
        throw new Error('Een RGBW-poort wordt lokaal uit de groep verwijderd; hardware-ontkoppeling is receiverbreed');
      }
      if (receiverType === 'RGBW' && action === 'CONFIG' && ![1, 2, 3].includes(clamp(target.portMask, 0, 3, 0))) {
        throw new Error('RGBW-poortkeuze is ongeldig');
      }
      if (receiverType === 'RGBW' && action === 'CONFIG' && (target.portMode != null || target.rgbwOutputMode != null)) {
        const portMode = String(target.portMode ?? target.rgbwOutputMode).toUpperCase();
        if (!['LINKED', 'SEPARATE'].includes(portMode)) throw new Error('RGBW-poortmodus is ongeldig');
        target.portMode = portMode;
      }
      if (receiverType === 'RGBW' && action === 'CONFIG' && (target.channelMap != null || target.map != null)) {
        const map = rgbwChannelMap(target.channelMap ?? target.map);
        if (!map) throw new Error('RGBW-kleurvolgorde moet R, G, B en W elk precies één keer bevatten');
        if (![1, 2].includes(port)) throw new Error('Kleurvolgorde kan alleen per RGBW-poort worden ingesteld');
        target.channelMap = map;
        target.map = map;
      }
      if (receiverType === 'SPI') {
        const stored = bridge.receivers[target.physicalRid] || {};
        const capacity = receiverPortCapacity(stored, 'SPI');
        if (!receiverWide && port > capacity) throw new Error('Deze receiver heeft deze uitgang niet beschikbaar');
        if (action === 'CONFIG') {
          const mask = clamp(target.portMask, 1, 15, 1);
          if (capacity !== 4 && mask !== 1) throw new Error('Deze receiver heeft één beschikbare uitgang');
          target.portMask = mask;
          target.portCount = popcount4(mask);
        }
      }
      const endpoint = `${target.physicalRid}:${port}`;
      if (endpoints.has(endpoint)) throw new Error('Hetzelfde receiverdoel staat dubbel in deze opdracht');
      endpoints.add(endpoint);
      return target;
    });
    if (['LIVE', 'SAVE'].includes(action) && receiverTypes.size > 1) {
      throw new Error('RGBW- en SPI-receivers kunnen niet in dezelfde opdracht');
    }
    if (['LIVE', 'SAVE'].includes(action) && targets.length > 1 &&
        targets.every((target) => target.receiverType === 'SPI' && !target.layoutParallel)) {
      let offset = 0;
      targets.forEach((target) => {
        target.pixels = clamp(target.pixels, 1, 1024, 1);
        target.offset = offset;
        offset += target.pixels;
      });
      if (offset > 8192) throw new Error('Doorlopende SPI-groep ondersteunt maximaal 8192 pixels');
      targets.forEach((target) => { target.groupPixels = offset; });
      body = { ...body, state: { ...body.state, groupPixels: offset },
        // Legacy SPI callers already send the complete continuous group but
        // did not opt in to the scheduled-start mechanism used by RGBW.
        ...(action === 'LIVE' && body.synchronize !== false ? { synchronize: true } : {}) };
    }
    return { body, action, targets };
  }

  function resultFromReply(action, body, target, sent, reply) {
    const receiverType = target.receiverType;
    const logicalRid = target.rid;
    const rid = exactRid(target.physicalRid || logicalRid);
    const requestedPort = clamp(target.port ?? target.outputPort, 0, receiverType === 'RGBW' ? 2 : 4, 0);
    const accepted = reply.STATUS === 'OK';
    const requestId = Number(sent?.ID || 0);
    const replyId = Number(reply.ID || 0);
    const idMatch = requestId > 0 && replyId === requestId;
    const explicitTarget = exactRid(reply.TARGETRID);
    const directReplyRid = exactRid(reply.RID);
    // Current V18 firmware returns TARGETRID for every routed command.  A few
    // already-deployed direct builds returned only their own RID, however.  A
    // RID-only ACK is safe exclusively when it is the BLE gateway itself; it
    // must never be used to confirm a relayed ESP-NOW destination.
    const legacyDirectTarget = !explicitTarget && rid === exactRid(ble.rid) && directReplyRid === rid;
    const reportedTarget = explicitTarget || (legacyDirectTarget ? directReplyRid : '');
    const targetMatches = Boolean(reportedTarget && reportedTarget === rid);
    const targetAck = String(reply.TARGETACK || '').toUpperCase();
    const requestedRaw = action === 'RGBW_TEST' && Number(sent?.RAW) === 1;
    const rawMatch = !requestedRaw || Number(reply.RAW) === 1;
    const rawPort = reply.PORTACK ?? reply.PORT;
    const legacySinglePortAck = receiverType === 'SPI' && requestedPort === 1 && rawPort === undefined &&
      receiverPortCapacity(bridge.receivers[rid] || {}, 'SPI') === 1;
    let portMatch = rawPort !== undefined
      ? Number(rawPort) === requestedPort
      : legacySinglePortAck;
    const requestedMap = action === 'CONFIG' && receiverType === 'RGBW'
      ? rgbwChannelMap(target.channelMap ?? target.map) : '';
    let mapMatch = !requestedMap;
    const requestedPortMode = action === 'CONFIG' && receiverType === 'RGBW'
      ? String(target.portMode || target.rgbwOutputMode || '').toUpperCase() : '';
    let portModeMatch = !requestedPortMode;
    if (action === 'CONFIG') {
      const requestedMask = clamp(target.portMask, 1, receiverType === 'RGBW' ? 3 : 15, receiverType === 'RGBW' ? 3 : 1);
      const singlePortLegacy = receiverType === 'SPI' && receiverPortCapacity(bridge.receivers[rid] || {}, 'SPI') === 1;
      // PHYSICAL is a capacity/count, never a bitmask proving enabled outputs.
      const reportedMask = reply.PORTACKMASK ?? reply.PORTMASK ?? (singlePortLegacy ? 1 : undefined);
      portMatch = reportedMask !== undefined && Number(reportedMask) === requestedMask &&
        (rawPort !== undefined ? Number(rawPort) === requestedPort : legacySinglePortAck);
      if (requestedMap) mapMatch = requestedPort > 0 && rgbwChannelMap(reply.MAP) === requestedMap;
      if (requestedPortMode) portModeMatch = String(reply.PORTMODE || '').toUpperCase() === requestedPortMode;
    }
    const deliveryConfirmed = accepted && idMatch && targetMatches && portMatch && mapMatch && portModeMatch && rawMatch &&
      ['1', 'DIRECT', 'OK', 'DELIVERED'].includes(targetAck);
    // A gateway can acknowledge enqueueing a routed LIVE without claiming
    // which physical port has applied it. This is NOT an endpoint/port ACK.
    // Accept that limited evidence only from this session's known gateway;
    // an explicit wrong port, unrelated RID or mismatched ID is never healthy.
    const activeGatewayRid = exactRid(transportStatus().gateway?.rid);
    const gatewayQueued = action === 'LIVE' && accepted && idMatch && targetMatches &&
      targetAck === 'PENDING' && Boolean(activeGatewayRid) && rid !== activeGatewayRid &&
      directReplyRid === activeGatewayRid &&
      (rawPort === undefined || Number(rawPort) === requestedPort);
    const requestedGeneration = clamp(sent?.GEN, 0, 4294967295, 0);
    const detail = String(reply.DETAIL || '').toUpperCase();
    const selectedMask = clamp(reply.PORTACKMASK ?? reply.PORTMASK ?? target.portMask,
      0, receiverType === 'RGBW' ? 3 : 15, 0);
    const appliedValues = [];
    const pendingValues = [];
    const addGeneration = (applied, pending) => {
      if (applied !== undefined && applied !== null && String(applied) !== '') {
        appliedValues.push(clamp(applied, 0, 4294967295, 0));
      }
      if (pending !== undefined && pending !== null && String(pending) !== '') {
        pendingValues.push(clamp(pending, 0, 4294967295, 0));
      }
    };
    addGeneration(reply.APPLIEDGEN, reply.PENDINGGEN);
    if (receiverType === 'RGBW') {
      const ports = requestedPort > 0 ? [requestedPort] : [1, 2].filter(port => selectedMask & (1 << (port - 1)));
      ports.forEach(port => addGeneration(reply[`P${port}APPLIEDGEN`], reply[`P${port}PENDINGGEN`]));
    } else if (requestedPort === 0) {
      [1, 2, 3, 4].filter(port => selectedMask & (1 << (port - 1)))
        .forEach(port => addGeneration(reply[`P${port}GEN`], reply[`P${port}PENDINGGEN`]));
    }
    const hasGenerationTelemetry = appliedValues.length > 0 || pendingValues.length > 0;
    const generationApplied = !requestedGeneration || !hasGenerationTelemetry ||
      (appliedValues.length > 0 && appliedValues.every(value => value === requestedGeneration) &&
       !pendingValues.includes(requestedGeneration));
    // STATUS=OK only proves command acceptance. SCHEDULED/PENDING is explicitly
    // non-terminal; V21 commands become confirmed only after the requested
    // generation is visible as applied. Legacy firmware without generation
    // telemetry retains its attributable direct-ACK behaviour.
    const finalApplied = targetAck !== 'PENDING' && !['SCHEDULED', 'PENDING', 'QUEUED'].includes(detail) && generationApplied;
    const confirmed = deliveryConfirmed && finalApplied;
    // Routed LIVE updates are intentionally fire-and-continue: the gateway
    // confirms radio acceptance with PENDING so animation sliders stay fast.
    // This is healthy delivery queueing, not a missing receiver response.
    const pendingDelivery = gatewayQueued || (action === 'LIVE' && deliveryConfirmed && !finalApplied);
    const reportedPhysical = reply.PHYSICAL;
    const configuredPhysical = action === 'CONFIG' && receiverType === 'SPI' && confirmed
      ? clamp(target.pixels, 1, 1024, 60)
      : reportedPhysical;
    return {
      id: target.id, online: accepted && idMatch, accepted, confirmed, idMatch,
      requestId: requestId || null, replyId: replyId || null,
      pendingDelivery,
      gatewayAck: accepted, targetAck: targetAck || null, target: rid,
      logicalTarget: logicalRid,
      reportedTarget: reportedTarget || null, detail: reply.DETAIL,
      deliveryConfirmed, finalApplied, generationApplied, hasGenerationTelemetry, gatewayQueued,
      receiverType: reply.DEVTYPE || receiverType || body.state?.receiverType || 'SPI',
      port: rawPort ?? requestedPort, portMatch, mapMatch, portModeMatch, requestedRaw, rawMatch,
      channelMap: rgbwChannelMap(reply.MAP || (requestedPort === 1 ? reply.MAP1 : requestedPort === 2 ? reply.MAP2 : '')) || null,
      portMask: reply.PORTMASK ?? reply.PORTACKMASK, portCount: reply.PORTS ?? reply.PORTCOUNT,
      portCapacity: reply.PORTCAP,
      // A receiver cannot discover the length of a pixel strip. During CONFIG
      // the explicit target ACK confirms acceptance of the customer's chosen
      // value; a stale PHYSICAL echo must never block adding the LED Line.
      physical: configuredPhysical, reportedPhysical,
      pixelCountMismatch: false, physicalReverse: reply.PHYSICALREVERSE,
      groupPixels: reply.GROUPPIXELS ?? reply.PIXELS,
      fps: reply.FPS, frame: reply.FRAME, sample: reply.SAMPLE,
      appliedEffect: reply.EFFECT, appliedVariant: reply.VARIANT,
      appliedSpeed: reply.SPEED, appliedWidthPixels: reply.WIDTHPX ?? reply.WIDTH,
      appliedLineDelayMs: reply.LINEDELAYMS,
      generation: reply.GEN ?? sent.GEN,
      appliedGeneration: reply.APPLIEDGEN,
      pendingGeneration: reply.PENDINGGEN,
      scheduledStart: reply.STARTATUS ?? reply.STARTATMS ?? sent.STARTATUS ?? sent.STARTATMS,
      clockUs: reply.CLOCKUS,
      clockMs: reply.CLOCKMS,
      portMode: reply.PORTMODE,
      phaseMs: sent.PHASEMS, reply: Object.entries(reply).map(([key, value]) => `${key}=${value}`).join(';')
    };
  }

  async function waitForAppliedReply(action, target, sent, initialReply, shouldYield = () => false) {
    if (!sent?.GEN || !['LIVE', 'SAVE', 'CONFIG'].includes(action)) return initialReply;
    let merged = initialReply;
    let state = resultFromReply(action, {}, target, sent, merged);
    if (state.confirmed || (!state.deliveryConfirmed && !state.gatewayQueued) || state.finalApplied) return merged;
    const requiresAppliedGeneration = state.gatewayQueued;
    const deadline = Date.now() + Math.min(1500, Math.max(500, commandTimeout(action)));
    let pause = 35;
    while (Date.now() < deadline) {
      if (shouldYield()) return merged;
      await new Promise(resolve => setTimeout(resolve, pause));
      if (shouldYield()) return merged;
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      const physicalRid = exactRid(target.physicalRid || target.rid);
      const request = {
        TYPE: 'STATUS', TARGET: physicalRid, DEVTYPE: target.receiverType,
        PORT: clamp(target.port ?? target.outputPort, 0, target.receiverType === 'RGBW' ? 2 : 4, 0)
      };
      let status;
      try {
        status = await transact(request, Math.max(450, Math.min(1100, remaining)), true);
      } catch (_) {
        // A failed verification probe cannot undo attributable acceptance or
        // prove application. Keep the pending state, just as batch verification
        // does, instead of claiming the whole receiver route disconnected.
        return merged;
      }
      const statusEvidence = resultFromReply('STATUS', {}, target, request, status);
      const statusSource = exactRid(status.RID);
      const sourceMatches = statusSource === physicalRid ||
        (Boolean(statusSource) && statusSource === exactRid(transportStatus().gateway?.rid));
      if (!sourceMatches || !statusEvidence.deliveryConfirmed ||
          (requiresAppliedGeneration && !statusEvidence.hasGenerationTelemetry)) {
        pause = Math.min(180, pause * 2);
        continue;
      }
      // STATUS has its own correlation ID. Preserve the original command ID
      // while replacing only the receiver's current state evidence.
      merged = {
        ...merged, ...status, ID: sent.ID, TARGETRID: physicalRid,
        TARGETACK: status.TARGETACK || merged.TARGETACK,
        PORT: status.PORT ?? merged.PORT, PORTACK: status.PORTACK ?? merged.PORTACK
      };
      state = resultFromReply(action, {}, target, sent, merged);
      if (state.confirmed) return merged;
      const appliedFloor = generationFloorFromFields(status);
      if (appliedFloor > Number(sent.GEN) && !state.generationApplied) return merged;
      pause = Math.min(180, pause * 2);
    }
    return merged;
  }

  function targetCircuitKey(target) {
    return `${exactRid(target.physicalRid || target.rid)}:${target.receiverType}:${clamp(target.port, 0, 4, 0)}`;
  }

  function circuitOpen(target, action) {
    // Never suppress a fresh customer light/calibration intent. Those actions
    // are already latest-only, so the newest value is also the cheapest and
    // most useful probe that the receiver route recovered. The circuit is only
    // used for background STATUS work.
    if (action !== 'STATUS') return false;
    const health = targetHealth.get(targetCircuitKey(target));
    return Boolean(health?.openUntil && health.openUntil > Date.now());
  }

  function recordTargetHealth(target, healthy) {
    const key = targetCircuitKey(target);
    if (healthy) {
      targetHealth.set(key, { failures: 0, openUntil: 0, lastSuccessAt: Date.now() });
      return;
    }
    const previous = targetHealth.get(key) || { failures: 0, openUntil: 0 };
    const failures = previous.failures + 1;
    targetHealth.set(key, {
      failures,
      openUntil: failures >= TARGET_FAILURE_LIMIT ? Date.now() + TARGET_CIRCUIT_MS : 0,
      lastFailureAt: Date.now()
    });
  }

  function commandTimeout(action) {
    if (action === 'CONFIG') return 4200;
    if (['SAVE', 'UNPAIR'].includes(action)) return 3200;
    // FILL/START are ephemeral previews and are immediately superseded by the
    // next slider value. A long retry here makes an old pixel count block the
    // latest one. Durable CLEAR and IDENTIFY operations keep their full ACK
    // window.
    if (CALIBRATION_ACTIONS.has(action)) return 1200;
    if (action === 'IDENTIFY' || action === 'RGBW_TEST' || action === 'CALIBRATE_CLEAR') return 3200;
    if (action === 'STATUS') return 2600;
    if (['SETUP_BEGIN', 'SETUP_KEEPALIVE', 'SETUP_END', 'SETUP_CANCEL'].includes(action)) return 1800;
    if (action === 'LIVE') return 1250;
    return 1900;
  }

  function failedTargetResult(target, detail) {
    const physicalRid = target.receiverType === 'RGBW' ? exactRid(target.physicalRid || target.rid) : target.rid;
    return {
      id: target.id, online: false, accepted: false, confirmed: false,
      gatewayAck: false, target: physicalRid, logicalTarget: target.rid, detail
    };
  }

  function applySpiConfiguration(record, target) {
    if (!record || record.receiverType !== 'SPI') return;
    const capacity = receiverPortCapacity(record, 'SPI');
    record.portMask = clamp(target.portMask, 1, capacity === 4 ? 15 : 1, record.portMask || 1);
    record.activePortCount = popcount4(record.portMask);
    record.portCount = record.activePortCount;
    const port = clamp(target.port ?? target.outputPort, 0, capacity, 0);
    if (!port) return;
    const requestedPixels = clamp(target.pixels, 1, 1024, record.pixels || 60);
    record.spiPorts ||= {};
    record.spiPorts[port] = {
      ...(record.spiPorts[port] || {}),
      pixels: requestedPixels,
      reversed: Boolean(target.reversed),
      physicalReverse: Boolean(target.reversed),
      groupPixels: clamp(target.groupPixels || requestedPixels, 1, 65535, requestedPixels),
      offset: clamp(target.offset, 0, 65535, 0)
    };
    if (port === 1) {
      record.pixels = requestedPixels;
      record.reportedPixels = requestedPixels;
      record.physicalReverse = Boolean(target.reversed);
    }
    record.pixelCountSource = 'saved_setting';
    record.pixelCountMismatch = false;
    record.requiresPixelSetup = false;
  }

  function stageSpiConfiguration(rid, target) {
    const transaction = setupTransactions.get(rid);
    if (!transaction) return false;
    transaction.mask = clamp(target.portMask, 1, 15, transaction.mask || 1);
    const port = clamp(target.port ?? target.outputPort, 0, 4, 0);
    if (port) transaction.ports.set(port, { ...target, port, outputPort: port });
    return true;
  }

  function commitSpiSetup(rid) {
    const transaction = setupTransactions.get(rid);
    if (!transaction) return;
    const stored = bridge.receivers[rid];
    if (stored?.receiverType === 'SPI') {
      applySpiConfiguration(stored, { port: 0, portMask: transaction.mask });
      transaction.ports.forEach((target) => applySpiConfiguration(stored, target));
      persistBridge();
    }
    setupTransactions.delete(rid);
  }

  async function executeTarget(body, action, targets, target, index, afterFanout = null, shouldYield = () => false) {
    if (otaController?.busy) {
      return failedTargetResult(target, 'Firmware-update actief · deze verouderde lichtopdracht is veilig overgeslagen');
    }
    if (circuitOpen(target, action)) {
      return failedTargetResult(target, 'Receiver tijdelijk overgeslagen na meerdere ontbrekende antwoorden');
    }
    try {
      assertReceiverIdentity({ RID: exactRid(target.physicalRid || target.rid) });
      let sent = commandFields(body, target, index, targets);
      let reply = await transact(sent, commandTimeout(action), true);
      const staleGeneration = reply.STATUS === 'ERROR' && /STALE_GENERATION/i.test(String(reply.DETAIL || reply.CODE || ''));
      if (staleGeneration && sent.GEN && !shouldYield()) {
        const physicalRid = exactRid(target.physicalRid || target.rid);
        sent = { ...sent, GEN: reserveGeneration(body, physicalRid, generationFloorFromFields(reply)) };
        reply = await transact(sent, commandTimeout(action), true);
      }
      // Polling the first scheduled output until it starts blocks every later
      // BLE output until AFTER their shared start. First send the entire frame;
      // only then check the applied generations. CONFIG/SAVE remain ordered.
      const deferApplied = Array.isArray(afterFanout) && action === 'LIVE' &&
        body.synchronize === true && targets.length > 1;
      if (!deferApplied) reply = await waitForAppliedReply(action, target, sent, reply, shouldYield);
      let result = resultFromReply(action, body, target, sent, reply);
      if (['SETUP_BEGIN', 'SETUP_KEEPALIVE', 'SETUP_END', 'SETUP_CANCEL'].includes(action) &&
          !result.confirmed && /UNKNOWN|ONBEKEND/.test(String(reply.DETAIL || '').toUpperCase())) {
        const physicalRid = exactRid(target.physicalRid || target.rid);
        const stored = bridge.receivers[physicalRid] || {};
        if (target.receiverType === 'SPI' && receiverPortCapacity(stored, 'SPI') === 1) {
          const port = 1;
          const setting = spiPortSettings({}, stored, port);
          const clear = action === 'SETUP_END' || action === 'SETUP_CANCEL';
          const fallbackSent = {
            TYPE: 'TEST', KEY: bridge.networkKey, TARGET: physicalRid, DEVTYPE: 'SPI', PORT: port,
            TEST: clear ? 'CLEAR' : 'FILL', PHYSICAL: setting.pixels, PIXELS: setting.pixels,
            GROUPPIXELS: setting.pixels, OFFSET: 0, PHYSICALREVERSE: Number(setting.reversed)
          };
          reply = await transact(fallbackSent, 1800, true);
          result = { ...resultFromReply(action, body, { ...target, port, outputPort: port }, fallbackSent, reply),
            detail: clear ? 'SETUP_LEGACY_ENDED' : 'SETUP_LEGACY_ACTIVE', legacySetupFallback: true };
        }
      }
      if (action === 'CONFIG' && result.accepted && result.idMatch && !result.confirmed) {
        const physicalRid = exactRid(target.physicalRid || target.rid);
        const maximumMask = target.receiverType === 'RGBW' ? 3 : 15;
        const maximumPort = target.receiverType === 'RGBW' ? 2 : 4;
        const requestedMask = clamp(target.portMask, 1, maximumMask, target.receiverType === 'RGBW' ? 3 : 1);
        const requestedPort = clamp(target.port ?? target.outputPort, 0, maximumPort, 0);
        const statusRequest = { TYPE: 'STATUS', TARGET: physicalRid, DEVTYPE: target.receiverType };
        if (requestedPort) statusRequest.PORT = requestedPort;
        const status = await transact(statusRequest, 3200, true);
        const singlePortLegacy = target.receiverType === 'SPI' && receiverPortCapacity(bridge.receivers[physicalRid] || {}, 'SPI') === 1;
        const statusMask = clamp(status.PORTACKMASK ?? status.PORTMASK ?? (singlePortLegacy ? 1 : undefined), 0, maximumMask, 0);
        const statusPort = status.PORTACK ?? status.PORT;
        const statusPortMatches = !requestedPort || Number(statusPort) === requestedPort ||
          (singlePortLegacy && requestedPort === 1 && statusPort == null);
        const requestedMap = target.receiverType === 'RGBW' ? rgbwChannelMap(target.channelMap ?? target.map) : '';
        const statusMapMatches = !requestedMap || rgbwChannelMap(status.MAP) === requestedMap;
        const statusEvidence = resultFromReply('STATUS', {}, target, statusRequest, status);
        const statusSource = exactRid(status.RID);
        const sourceMatches = statusSource === physicalRid ||
          (Boolean(statusSource) && statusSource === exactRid(transportStatus().gateway?.rid));
        if (sourceMatches && statusEvidence.deliveryConfirmed &&
            statusMask === requestedMask && statusPortMatches && statusMapMatches) {
          /* The CONFIG response already matched its own ID; STATUS only
             verifies the committed fields after its own ID, source, target
             and port have also been checked. Preserve that CONFIG ID only
             when these two independently attributable replies are combined. */
          reply = { ...reply, ...status, ID: sent.ID, TARGETRID: physicalRid, PORTMASK: String(statusMask) };
          const verified = resultFromReply(action, body, target, sent, reply);
          result = { ...verified, confirmed: verified.confirmed, portMatch: true, mapMatch: verified.mapMatch };
        }
      }
      const transactionRid = exactRid(target.physicalRid || target.rid);
      if (result.confirmed && action === 'SETUP_BEGIN' && target.receiverType === 'SPI') {
        setupTransactions.set(transactionRid, {
          mask: clamp(target.portMask, 1, 15, 1),
          ports: new Map(),
          legacy: Boolean(result.legacySetupFallback)
        });
      } else if (result.confirmed && action === 'SETUP_END' && target.receiverType === 'SPI') {
        commitSpiSetup(transactionRid);
      } else if (action === 'SETUP_CANCEL' && target.receiverType === 'SPI') {
        setupTransactions.delete(transactionRid);
      }
      recordTargetHealth(target, result.confirmed || result.pendingDelivery || (action === 'STATUS' && result.accepted));
      if (result.confirmed && action === 'CONFIG') {
        const physicalRid = exactRid(target.physicalRid || target.rid);
        const stored = bridge.receivers[physicalRid];
        if (stored?.receiverType === 'SPI') {
          if (!stageSpiConfiguration(physicalRid, target)) {
            applySpiConfiguration(stored, target);
            persistBridge();
          }
          const requestedPort = clamp(target.port ?? target.outputPort, 0, receiverPortCapacity(stored, 'SPI'), 0);
          if (requestedPort) {
            result.physical = clamp(target.pixels, 1, 1024, stored.pixels || 60);
            result.physicalReverse = String(Number(Boolean(target.reversed)));
          }
        }
        if (stored?.receiverType === 'RGBW') {
          stored.portMask = clamp(reply.PORTACKMASK ?? reply.PORTMASK, 1, 3, stored.portMask || 3);
          const portMode = String(reply.PORTMODE || target.portMode || target.rgbwOutputMode || '').toUpperCase();
          if (['LINKED', 'SEPARATE'].includes(portMode)) {
            stored.rgbwOutputMode = portMode.toLowerCase();
            stored.rgbwLinked = portMode === 'LINKED';
          }
          const requestedPort = clamp(target.port ?? target.outputPort, 0, 2, 0);
          const map = rgbwChannelMap(target.channelMap ?? target.map);
          if (requestedPort && map) {
            stored.rgbwChannelMaps ||= { 1: 'RGBW', 2: 'RGBW' };
            stored.rgbwChannelMaps[requestedPort] = map;
          }
          persistBridge();
        }
      }
      if (result.confirmed && action === 'UNPAIR') {
        const physicalRid = exactRid(target.physicalRid || target.rid);
        delete bridge.receivers[physicalRid];
        delete bridge.browserDeviceIds[physicalRid];
        targetHealth.delete(targetCircuitKey(target));
        if (bridge.preferredGatewayRid === physicalRid) bridge.preferredGatewayRid = Object.keys(bridge.receivers)[0] || '';
        persistBridge();
      }
      if (deferApplied && (result.deliveryConfirmed || result.gatewayQueued) && !result.finalApplied) {
        const initialReply = reply;
        afterFanout.push(async () => {
          try {
            const applied = await waitForAppliedReply(action, target, sent, initialReply, shouldYield);
            Object.assign(result, resultFromReply(action, body, target, sent, applied));
          } catch (_) {
            // An accepted scheduled frame remains pending when its status read
            // fails. Never invent final confirmation or mark its radio offline.
          }
          recordTargetHealth(target, result.confirmed || result.pendingDelivery);
        });
      }
      return result;
    } catch (error) {
      if (/\bLIVE_SUPERSEDED\b/.test(String(error?.message || error))) {
        // The native latest-only queue deliberately discarded an old intent.
        // It has no ACK and is neither applied nor a lost receiver connection.
        return { id: target.id, target: exactRid(target.physicalRid || target.rid),
          accepted: false, confirmed: false, superseded: true, detail: 'LIVE_SUPERSEDED' };
      }
      recordTargetHealth(target, false);
      return failedTargetResult(target, String(error?.message || error));
    }
  }

  async function runTargetPool(entries, limit, worker) {
    const results = new Array(entries.length);
    let cursor = 0;
    async function consume() {
      while (cursor < entries.length) {
        const local = cursor;
        cursor += 1;
        results[local] = await worker(entries[local]);
      }
    }
    await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, entries.length)) }, consume));
    return results;
  }

  async function executeCommands(rawBody, hasNewerIntent = () => false) {
    const checked = validatedCommand(rawBody);
    const { body, action, targets } = checked;
    if (otaController?.busy) {
      return {
        results: targets.map((target) => ({
          id: target.id, online: false, accepted: false, confirmed: false,
          gatewayAck: false, target: target.rid,
          detail: 'Firmware-update actief · lichtbediening hervat automatisch zodra de update klaar is'
        })),
        busy: true,
        error: 'Firmware-update actief'
      };
    }
    if (!activeAdapter()) await connectPrimaryTransport(false);
    if (!activeAdapter()) {
      return { results: targets.map((target) => ({
        id: target.id, online: false, accepted: false, confirmed: false,
        gatewayAck: false, target: target.rid, detail: 'Maak eerst verbinding met de installatiecontroller'
      })) };
    }
    const replacedBeforeSend = () => action === 'LIVE' && hasNewerIntent();
    if (replacedBeforeSend()) return { results: [], superseded: true };
    await prepareSynchronizedStarts(body, action, targets, replacedBeforeSend);
    if (replacedBeforeSend()) return { results: [], superseded: true };
    // Do not push a scheduled group's start endlessly into the future during
    // a gesture. Once a cohort starts sending, finish all its outputs and
    // verify it. Only an immediate frame may yield to a newer exact-scope LIVE.
    const shouldYield = () => !bodyStarts.has(body) && replacedBeforeSend();
    const status = transportStatus();
    const gatewayRid = exactRid(status.gateway?.rid || ble.rid);
    const ordered = targets.map((target, index) => ({ target, index })).sort((left, right) => {
      const leftGateway = [left.target.rid, exactRid(left.target.physicalRid)].includes(gatewayRid) ? 0 : 1;
      const rightGateway = [right.target.rid, exactRid(right.target.physicalRid)].includes(gatewayRid) ? 0 : 1;
      return leftGateway - rightGateway || left.index - right.index;
    });
    const selected = activeAdapter();
    const concurrency = selected?.name === PRIMARY_TRANSPORT && selected.adapter?.supportsConcurrentFanout !== false
      ? MAX_CONCURRENT_TARGETS : 1;
    /* Parallelise across physical receivers, never across outputs of the same
       receiver.  PORT=0 topology must reach a four-output board before P1–P4,
       and the same ordering rule also prevents late ACKs crossing per-port
       LIVE/CONFIG commands. */
    const byPhysicalReceiver = new Map();
    ordered.forEach((entry) => {
      const identity = exactRid(entry.target.physicalRid || entry.target.rid) || String(entry.target.deviceId || entry.target.id);
      if (!byPhysicalReceiver.has(identity)) byPhysicalReceiver.set(identity, []);
      byPhysicalReceiver.get(identity).push(entry);
    });
    const groups = [...byPhysicalReceiver.values()];
    const afterFanout = [];
    const completed = (await runTargetPool(groups, concurrency, async (entries) => {
      const receiverResults = [];
      for (const { target, index } of entries) {
        if (shouldYield()) break;
        receiverResults.push({ index, result: await executeTarget(body, action, targets, target, index, afterFanout, shouldYield) });
      }
      return receiverResults;
    })).flat();
    await runTargetPool(afterFanout, concurrency, verify => verify());
    return { results: completed.sort((left, right) => left.index - right.index).map((entry) => entry.result),
      ...(replacedBeforeSend() || (completed.length && completed.every(entry => entry.result.superseded))
        ? { superseded: true } : {}) };
  }

  class LatestCommandBroker {
    constructor() {
      this.durable = [];
      this.live = new Map();
      this.activeLive = null;
      this.running = false;
    }

    key(body) {
      const targets = Array.isArray(body?.targets) ? body.targets : [];
      return targets.map((target) => {
        const identity = String(target.physicalRid || target.rid || target.receiverId || target.deviceId || target.id || '').toUpperCase();
        const port = target.port ?? target.outputPort ?? 1;
        return `${identity}:${port}`;
      }).join('|') || 'ALL';
    }

    fingerprint(body) {
      try { return JSON.stringify(body); }
      catch (_) { return ''; }
    }

    resolveJob(job, value) {
      job.resolve(value);
      (job.followers || []).forEach((resolve) => resolve(value));
      job.followers = [];
    }

    submit(body) {
      return new Promise((resolve) => {
        const action = String(body?.action || 'live').toUpperCase();
        const key = this.key(body);
        const latestOnly = LATEST_ONLY_ACTIONS.has(action);
        const job = {
          body, resolve, key, latestOnly,
          fingerprint: latestOnly ? this.fingerprint(body) : '',
          followers: []
        };
        if (latestOnly) {
          const previous = this.live.get(key);
          // A repeated value is only redundant if no different scope arrived
          // after it. P1 → all off → P1 must finish with P1 on, even when its
          // final value equals the first. Do not split multi-output bodies:
          // their original target order defines continuous SPI geometry.
          const lastPendingKey = [...this.live.keys()].at(-1);
          if (previous?.fingerprint === job.fingerprint && lastPendingKey === key && !this.durable.length) {
            previous.followers.push(resolve);
            return;
          }
          if (this.activeLive?.key === key && this.activeLive.fingerprint === job.fingerprint
              && !this.durable.length && [...this.live.keys()].every(pendingKey => pendingKey === key)) {
            // The physical receiver is already receiving this exact state. If
            // another value was queued in between, it is obsolete now that the
            // customer returned to the active value.
            if (previous) {
              this.live.delete(key);
              this.resolveJob(previous, { results: [], superseded: true });
            }
            this.activeLive.followers.push(resolve);
            return;
          }
          if (previous) {
            this.live.delete(key);
            this.resolveJob(previous, { results: [], superseded: true });
          }
          this.live.set(key, job);
        } else {
          if (['CALIBRATE_CLEAR', 'CONFIG', 'UNPAIR'].includes(action)) {
            const pending = this.live.get(key);
            if (pending && CALIBRATION_ACTIONS.has(String(pending.body?.action || '').toUpperCase())) {
              this.live.delete(key);
              this.resolveJob(pending, { results: [], superseded: true });
            }
          }
          this.durable.push(job);
        }
        this.pump();
      });
    }

    async pump() {
      if (this.running) return;
      this.running = true;
      while (this.durable.length || this.live.size) {
        let job;
        if (this.durable.length) job = this.durable.shift();
        else {
          const first = this.live.entries().next().value;
          this.live.delete(first[0]);
          job = first[1];
        }
        if (job.latestOnly) this.activeLive = job;
        try { this.resolveJob(job, await executeCommands(job.body,
          () => job.latestOnly && this.live.has(job.key))); }
        catch (error) {
          const targets = Array.isArray(job.body?.targets) ? job.body.targets : [];
          this.resolveJob(job, {
            results: targets.map((target) => ({
              id: target.id, online: false, accepted: false, confirmed: false,
              gatewayAck: false, target: exactRid(target.rid || target.receiverId),
              detail: String(error?.message || error)
            })),
            error: String(error?.message || error)
          });
        } finally {
          if (this.activeLive === job) this.activeLive = null;
        }
      }
      this.running = false;
    }
  }

  const commandBroker = new LatestCommandBroker();

  function saveOtaReceiver(record) {
    const rid = exactRid(record?.rid);
    if (!rid) throw new Error('Ongeldige receiveridentiteit na firmwarecontrole');
    assertReceiverIdentity(record);
    bridge.receivers[rid] = { ...(bridge.receivers[rid] || {}), ...record, rid };
    persistBridge();
    return bridge.receivers[rid];
  }

  if (typeof window.createAluvisionDirectOta === 'function') {
    otaController = window.createAluvisionDirectOta({
      getBle: () => ble,
      getWifiOta: () => primaryAdapter(),
      getNetworkKey: () => bridge.networkKey,
      listReceivers: () => publicReceivers(),
      getReceiver: (rid) => bridge.receivers[exactRid(rid)] || null,
      saveReceiver: saveOtaReceiver,
      recordFromInfo: (info) => deviceRecord(info),
      // OTA arms through the same active transport as normal commands. The
      // OTA controller itself then selects authenticated private HTTP or the
      // deliberately hidden direct-BLE recovery channel for the data stream.
      transact,
      parseFields,
      attachDevice,
      waitForCommandDrain: async () => { try { await commandTail; } catch (_) {} },
      nativeFetch,
      nativeOtaPreflight: async (receiver, artifact) => {
        const adapter = primaryAdapter();
        if (!adapter || typeof adapter.otaPreflight !== 'function') return null;
        return adapter.otaPreflight(receiver, artifact);
      },
    });
  }

  function json(value, status = 200) {
    return new Response(JSON.stringify(value), {
      status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  }

  function parseBody(init) {
    if (!init?.body) return {};
    try { return JSON.parse(init.body); } catch (_) { return {}; }
  }

  async function routeApi(path, method, body) {
    if (path === '/api/session') return json({ token: sessionToken });
    if (path === '/api/health') {
      const status = transportStatus();
      return json({ ok: true, build: '21.0.0', ready: status.gatewayReady, transport: status.activeTransport });
    }
    if (path === '/api/transport') return json(transportStatus());
    if (path === '/api/app-state' && method === 'GET') {
      return json({ ok: true, revision: bridge.revision || 0, state: bridge.sharedState || null });
    }
    if (['/api/app-state', '/api/app-state/assignments', '/api/app-state/import'].includes(path)) {
      const result = saveSharedState(
        body,
        path === '/api/app-state/assignments' || path === '/api/app-state/import'
      );
      return json(result, result.status || (result.ok ? 200 : 400));
    }
    if (path === '/api/app-state/reset') {
      const result = saveSharedState(body, true);
      return json(result, result.status || (result.ok ? 200 : 400));
    }
    if (path === '/api/discover') {
      try {
        await refreshInventory(body.active === true);
        return json({ ok: true, devices: publicReceivers(), transport: transportStatus() });
      } catch (error) {
        return json({
          ok: false,
          error: String(error?.message || error),
          devices: publicReceivers(),
          transport: transportStatus()
        }, 409);
      }
    }
    if (path === '/api/pair') {
      if (otaController?.busy) {
        return json({ ok: false, busy: true, error: 'Wacht tot de firmware-update klaar is' }, 409);
      }
      try {
        const receiver = await runPairOperation(() => pairReceiver(body.number || 1));
        return json({ ok: true, device: receiver, transport: transportStatus() });
      } catch (error) {
        return json({ ok: false, cancelled: error?.code === 'IDENTIFY_CANCELLED', cancelReason: error?.reason, error: String(error?.message || error), transport: transportStatus() });
      }
    }
    if (path === '/api/pair-test') {
      if (otaController?.busy) {
        return json({ ok: false, busy: true, error: 'Wacht tot de firmware-update klaar is' }, 409);
      }
      try {
        const receiver = await runPairOperation(() => pairReceiverRecovery(body.number || 1));
        return json({ ok: true, device: receiver, temporaryBluetooth: true, recovery: true, transport: transportStatus() });
      } catch (error) {
        return json({
          ok: false,
          cancelled: error?.code === 'IDENTIFY_CANCELLED',
          cancelReason: error?.reason,
          error: String(error?.message || error),
          temporaryBluetooth: true,
          recovery: true,
          transport: transportStatus()
        }, 409);
      }
    }
    if (path === '/api/recovery/pair') {
      if (otaController?.busy) return json({ ok: false, busy: true, error: 'Wacht tot de firmware-update klaar is' }, 409);
      try {
        const receiver = await runPairOperation(() => pairReceiverRecovery(body.number || 1));
        return json({ ok: true, device: receiver, recovery: true, transport: transportStatus() });
      } catch (error) {
        return json({ ok: false, cancelled: error?.code === 'IDENTIFY_CANCELLED', cancelReason: error?.reason, error: String(error?.message || error), recovery: true, transport: transportStatus() }, 409);
      }
    }
    if (path === '/api/recovery/connect') {
      if (otaController?.busy) return json({ ok: false, busy: true, error: 'Wacht tot de firmware-update klaar is' }, 409);
      try {
        const ready = body.interactive === true ? await chooseKnownGateway() : await reconnectPermittedGateway();
        return json({ ok: Boolean(ready), recovery: true, transport: transportStatus() }, ready ? 200 : 409);
      } catch (error) {
        return json({ ok: false, error: String(error?.message || error), recovery: true, transport: transportStatus() }, 409);
      }
    }
    if (path === '/api/command') return json(await commandBroker.submit(body));
    if (path === '/api/forget') {
      if (otaController?.busy) {
        return json({ ok: false, busy: true, error: 'Wacht tot de firmware-update klaar is' }, 409);
      }
      const rid = exactRid(body.rid);
      if (!body.localOnly || !rid) {
        return json({ ok: false, error: 'Lokaal verwijderen vereist een geldig, bevestigd receiverdoel' }, 400);
      }
      delete bridge.receivers[rid];
      delete bridge.browserDeviceIds[rid];
      if (bridge.preferredGatewayRid === rid) bridge.preferredGatewayRid = Object.keys(bridge.receivers)[0] || '';
      persistBridge();
      return json({ ok: true });
    }
    if (path.startsWith('/api/firmware/')) {
      if (!otaController) return json({ ok: false, error: 'Firmwaremodule kon niet worden geladen' }, 503);
      const result = await otaController.handle(path, body);
      return json(result.body, result.status);
    }
    return json({ ok: false, error: 'Onbekende lokale browseractie' }, 404);
  }

  window.fetch = function aluvisionStaticFetch(input, init = {}) {
    const raw = typeof input === 'string' ? input : input?.url || '';
    let url;
    try { url = new URL(raw, location.href); } catch (_) { return nativeFetch(input, init); }
    if (!url.pathname.startsWith('/api/')) return nativeFetch(input, init);
    const method = String(init.method || (typeof input !== 'string' ? input.method : 'GET') || 'GET').toUpperCase();
    return routeApi(url.pathname, method, parseBody(init));
  };

  async function adoptRecoveredInstallation(material) {
    const rid = exactRid(material?.rid);
    const key = String(material?.networkKey || '');
    const meshId = String(material?.meshId || '');
    const type = String(material?.receiverType || '');
    if (material?.verified !== true || !rid || material.role !== 'MAIN' ||
        !/^[0-9A-F]{16}$/.test(key) || key === '0000000000000000' ||
        !/^[0-9A-F]{8}$/.test(meshId) || meshId === '00000000' ||
        !['SPI', 'RGBW'].includes(type) || !Number.isInteger(material.number) ||
        material.number < 1 || material.number > 250) throw new Error('Ongeldige herstelde installatie.');
    // Restoring a fresh app may replace its unused random key. Never silently
    // replace an already populated different installation or its layout.
    const existing = Object.keys(bridge.receivers || {}).length > 0 ||
      (typeof db !== 'undefined' && (db?.devices || []).some(item => exactRid(item.rid || item.RID)));
    if (existing && bridge.networkKey !== key) {
      throw new Error('Deze app bevat al een andere installatie. Gebruik een leeg app-profiel om deze installatie te herstellen.');
    }
    const record = { ...(bridge.receivers[rid] || {}), rid, receiverType: type,
      number: material.number, gateway: true, online: true, reachableViaGateway: true };
    const next = { ...bridge, networkKey: key, meshId, preferredGatewayRid: rid,
      receivers: { ...bridge.receivers, [rid]: record } };
    // Durable storage before changing runtime credentials. A storage error
    // leaves the current installation completely unchanged.
    localStorage.setItem(BRIDGE_KEY, JSON.stringify(next));
    Object.assign(bridge, next);
    for (const adapter of transportAdapters.values()) {
      await adapter.configureSecurity?.(Object.freeze({ version: 2,
        masterSecret: bridge.masterSecret, compatibilityKey: key, meshId, publicTag: bridge.publicTag }));
    }
    return { ok: true, rid };
  }

  window.AluvisionDirectBridge = Object.freeze({
    adoptRecoveredInstallation,
    get connected() { return ble.connected; },
    get gatewayRid() { return ble.rid; },
    get preferredGatewayRid() { return exactRid(bridge.preferredGatewayRid); },
    get receivers() { return publicReceivers(); },
    get otaBusy() { return Boolean(otaController?.busy); },
    get transport() { return transportStatus(); }
  });

  Object.defineProperty(window, 'AluvisionTransportRegistry', {
    configurable: false,
    enumerable: false,
    writable: false,
    value: Object.freeze({
      register: registerTransport,
      get primary() { return PRIMARY_TRANSPORT; },
      get status() { return transportStatus(); }
    })
  });

})();
