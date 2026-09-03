/*
 * Aluvision full-app browser bridge
 *
 * The user interface in index.html is the exact document served by the local
 * Aluvision app.  This bridge replaces only its localhost JSON endpoints, so
 * the same interface can run as a static GitHub Pages PWA and talk directly to
 * V18 receivers through Web Bluetooth.  Receiver-to-receiver delivery remains
 * ESP-NOW: the connected receiver is the gateway for commands addressed to a
 * different RID.
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
    'LIVE', 'SAVE', 'STATUS', 'CONFIG', 'IDENTIFY', 'CALIBRATE',
    'CALIBRATE_FILL', 'CALIBRATE_CLEAR', 'UNPAIR'
  ]);
  const LATEST_ONLY_ACTIONS = new Set(['LIVE', 'CALIBRATE', 'CALIBRATE_FILL']);
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const nativeFetch = window.fetch.bind(window);
  const sessionToken = `static-${randomHex64()}`;
  const ackWaiters = new Map();
  let notificationBuffer = '';
  let commandSequence = Math.floor(Date.now() % 900000000) || 1;
  let commandTail = Promise.resolve();
  const phaseClocks = new Map();
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
    fields: {}
  };

  function clamp(value, minimum, maximum, fallback = minimum) {
    const parsed = Number(value);
    return Math.max(minimum, Math.min(maximum, Number.isFinite(parsed) ? Math.round(parsed) : fallback));
  }

  function randomHex64() {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    if (bytes.every((value) => value === 0)) bytes[7] = 1;
    return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  function loadBridge() {
    try {
      const saved = JSON.parse(localStorage.getItem(BRIDGE_KEY) || 'null');
      if (saved && typeof saved === 'object') {
        saved.receivers ||= {};
        saved.browserDeviceIds ||= {};
        saved.networkKey = /^[0-9A-F]{16}$/.test(saved.networkKey || '') ? saved.networkKey : randomHex64();
        saved.revision = clamp(saved.revision, 0, Number.MAX_SAFE_INTEGER, 0);
        saved.preferredGatewayRid = /^[0-9A-F]{16}$/.test(saved.preferredGatewayRid || '') &&
          saved.receivers[saved.preferredGatewayRid] ? saved.preferredGatewayRid : '';
        return saved;
      }
    } catch (_) {}
    return {
      networkKey: randomHex64(), receivers: {}, browserDeviceIds: {},
      preferredGatewayRid: '', revision: 0, sharedState: null
    };
  }

  const bridge = loadBridge();

  function persistBridge() {
    localStorage.setItem(BRIDGE_KEY, JSON.stringify(bridge));
  }

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

  const forbiddenStateKeys = new Set(['__proto__', 'prototype', 'constructor', 'networkKey']);
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
        const suffix = [1, 2, '1', '2'].includes(line.port) ? `:PORT:${line.port}` : ':PRIMARY';
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
    return {
      id: `rx-${rid.toLowerCase()}`, rid,
      hardwareId: receiver.hardwareId || `ALV-${rid.slice(-6)}`,
      number: clamp(receiver.number, 1, 250, 1),
      name: `Receiver ${clamp(receiver.number, 1, 250, 1)}`,
      receiverType: type,
      pixels: type === 'RGBW' ? 1 : clamp(receiver.pixels, 1, 1024, 60),
      portCount: type === 'RGBW' ? 2 : 1,
      portMask: type === 'RGBW' ? clamp(receiver.portMask, 1, 3, 3) : 1,
      port1Rid: String(receiver.port1Rid || '').toUpperCase(),
      port2Rid: String(receiver.port2Rid || '').toUpperCase(),
      firmware: receiver.firmware || '', firmwareVersion: receiver.firmware || '',
      firmwareVariant: receiver.firmwareVariant || '', build: receiver.build || '',
      model: receiver.model || '', board: receiver.board || '',
      otaCapable: Boolean(receiver.otaCapable), otaProtocol: Number(receiver.otaProtocol || 0),
      otaMaxBytes: Number(receiver.otaMaxBytes || 0), transport: 'BLE_ESPNOW', online: false,
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
    ble.fields = { ...ble.fields, ...fields };
  }

  function onStatus(event) {
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

  async function writeCommand(text) {
    if (!ble.connected || !ble.command) throw new Error('Bluetoothverbinding is gesloten');
    const bytes = encoder.encode(`${text}\n`);
    for (let offset = 0; offset < bytes.length; offset += 150) {
      const chunk = bytes.slice(offset, offset + 150);
      if (typeof ble.command.writeValueWithoutResponse === 'function') await ble.command.writeValueWithoutResponse(chunk);
      else if (typeof ble.command.writeValue === 'function') await ble.command.writeValue(chunk);
      else await ble.command.writeValueWithResponse(chunk);
      if (bytes.length > 150) await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }

  async function transactNow(fields, timeout = 3200, allowError = false) {
    commandSequence = (commandSequence + 1) % 2147483000 || 1;
    const id = commandSequence;
    const ordered = { V: 18, TYPE: fields.TYPE, ID: id, ...fields };
    const text = Object.entries(ordered)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${key}=${value}`).join(';');
    const pending = waitForAck(id, timeout);
    try {
      await writeCommand(text);
      const reply = await pending;
      if (!allowError && reply.STATUS === 'ERROR') throw new Error(reply.DETAIL || 'Receiverfout');
      return reply;
    } catch (error) {
      const waiter = ackWaiters.get(id);
      if (waiter) {
        clearTimeout(waiter.timer);
        ackWaiters.delete(id);
      }
      throw error;
    }
  }

  function transact(fields, timeout = 3200, allowError = false) {
    const run = () => transactNow(fields, timeout, allowError);
    const next = commandTail.then(run, run);
    commandTail = next.catch(() => {});
    return next;
  }

  function onDisconnected() {
    otaController?.onDisconnected();
    ble.connected = false;
    ble.server = null;
    ble.command = null;
    ble.status = null;
    ble.info = null;
    ackWaiters.forEach((pending) => {
      clearTimeout(pending.timer);
      pending.reject(new Error('Bluetoothverbinding is gesloten'));
    });
    ackWaiters.clear();
  }

  async function attachDevice(device) {
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
    const server = device.gatt.connected && ble.device === device && ble.server
      ? ble.server : await device.gatt.connect();
    const service = await server.getPrimaryService(UUIDS.service);
    const [command, status, info] = await Promise.all([
      service.getCharacteristic(UUIDS.command),
      service.getCharacteristic(UUIDS.status),
      service.getCharacteristic(UUIDS.info)
    ]);
    ble.device = device;
    ble.server = server;
    ble.command = command;
    ble.status = status;
    ble.info = info;
    ble.fields = {};
    ble.connected = true;
    notificationBuffer = '';
    status.addEventListener('characteristicvaluechanged', onStatus);
    await status.startNotifications();
    return parseFields(valueText(await info.readValue()));
  }

  function exactRid(value) {
    const rid = String(value || '').toUpperCase();
    return /^[0-9A-F]{16}$/.test(rid) ? rid : '';
  }

  function deviceRecord(fields, pairReply = {}) {
    const merged = { ...fields, ...pairReply, ...ble.fields };
    const rid = exactRid(fields.RID || pairReply.RID || merged.TARGETRID);
    if (!rid) throw new Error('Ongeldige receiveridentiteit');
    const receiverType = String(merged.DEVTYPE || 'SPI').toUpperCase() === 'RGBW' ? 'RGBW' : 'SPI';
    const previous = bridge.receivers[rid] || {};
    const number = clamp(merged.NUMBER || previous.number, 1, 250, 1);
    return {
      ...previous,
      id: `rx-${rid.toLowerCase()}`, rid,
      hardwareId: merged.HWID || previous.hardwareId || `ALV-${rid.slice(-6)}`,
      name: `Receiver ${number}`, number, receiverType,
      firmware: `V${String(merged.V || previous.firmware || '18').replace(/^V/i, '')}`,
      firmwareVersion: merged.FWVER || previous.firmwareVersion || '',
      firmwareVariant: String(merged.FWVARIANT || previous.firmwareVariant || '').toUpperCase(),
      build: merged.BUILD || previous.build || '',
      model: String(merged.MODEL || previous.model || '').toUpperCase(),
      board: String(merged.BOARD || previous.board || '').toUpperCase(),
      otaCapable: merged.OTA == null ? Boolean(previous.otaCapable) : ['1', 'BLE1'].includes(String(merged.OTA).toUpperCase()),
      otaProtocol: Number(merged.OTAV || previous.otaProtocol || 0),
      otaMaxBytes: Number(merged.OTAMAX || previous.otaMaxBytes || 0),
      otaState: String(merged.OTASTATE || previous.otaState || '').toUpperCase(),
      portCount: receiverType === 'RGBW' ? 2 : 1,
      portMask: receiverType === 'RGBW' ? clamp(merged.PORTMASK || previous.portMask, 1, 3, 3) : 1,
      port1Rid: exactRid(merged.PORT1RID || previous.port1Rid),
      port2Rid: exactRid(merged.PORT2RID || previous.port2Rid),
      pixelConfiguration: receiverType !== 'RGBW',
      pixels: receiverType === 'RGBW' ? 1 : clamp(merged.PHYSICAL || previous.pixels, 1, 1024, 60),
      physicalReverse: String(merged.PHYSICALREVERSE ?? (previous.physicalReverse ? '1' : '0')) === '1',
      fps: Number(merged.FPS || 0), frame: merged.FRAME || '—', sample: merged.SAMPLE || '—',
      transport: 'BLE_ESPNOW', online: true, gateway: true,
      reachableViaGateway: true, reachability: 'ble_gateway', lastSeenMs: 0
    };
  }

  async function pairReceiver(number) {
    if (!navigator.bluetooth) {
      throw new Error('Open deze GitHub-link op iPhone in Bluefy om Bluetooth te gebruiken.');
    }
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [UUIDS.service] }],
      optionalServices: [UUIDS.service]
    });
    const info = await attachDevice(device);
    const rid = exactRid(info.RID);
    if (!rid) throw new Error('De gekozen Bluetooth-receiver heeft geen geldig ID.');
    ble.rid = rid;
    ble.receiverType = info.DEVTYPE === 'RGBW' ? 'RGBW' : 'SPI';
    const existing = bridge.receivers[rid];
    let pairReply = {};
    const token = String(info.TOKEN || '').toUpperCase();
    if (!existing || info.PAIRED !== '1' || token) {
      if (!/^[0-9A-F]{16}$/.test(token)) {
        throw new Error('Koppeltijd verstreken. Houd BOOT opnieuw ongeveer 2 seconden ingedrukt.');
      }
      const fields = {
        TYPE: 'PAIR', TOKEN: token, NETWORK: bridge.networkKey,
        NUMBER: clamp(existing?.number || number, 1, 250, 1)
      };
      if (ble.receiverType === 'RGBW') fields.PORTMASK = clamp(info.PORTMASK, 1, 3, 3);
      pairReply = await transact(fields, 4200, true);
      const replyRid = exactRid(pairReply.RID || pairReply.TARGETRID);
      const committed = pairReply.PAIRED === '1' && replyRid === rid &&
        ((pairReply.STATUS === 'OK' && pairReply.DETAIL === 'PAIRED') ||
         (pairReply.STATUS === 'ERROR' && pairReply.DETAIL === 'PAIRED'));
      if (!committed) throw new Error(pairReply.DETAIL || 'Koppeling niet bevestigd');
    }
    try {
      const status = await transact({ TYPE: 'STATUS', TARGET: rid, DEVTYPE: ble.receiverType }, 3600);
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
    const status = await transact({ TYPE: 'STATUS', TARGET: rid, DEVTYPE: ble.receiverType }, 3600, true);
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
    if (!navigator.bluetooth || typeof navigator.bluetooth.getDevices !== 'function') return false;
    const permitted = await navigator.bluetooth.getDevices();
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
  }

  async function chooseKnownGateway() {
    if (!navigator.bluetooth || typeof navigator.bluetooth.requestDevice !== 'function') {
      throw new Error('Open deze GitHub-link op iPhone in Bluefy om Bluetooth te gebruiken.');
    }
    if (!Object.keys(bridge.receivers).length) {
      throw new Error('Voeg eerst een receiver toe voordat je een Bluetooth-gateway kiest.');
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
    if (!ble.connected) {
      try { await reconnectPermittedGateway(); } catch (_) {}
    }
    // Only a deliberate “Controller verbinden” action may open the browser's
    // Bluetooth chooser. Background/silent discovery may reconnect an
    // already permitted device, but can never interrupt the user with a popup.
    if (!ble.connected && active) {
      await chooseKnownGateway();
    }
    if (!ble.connected || !ble.rid) return;
    try {
      const status = await transact({ TYPE: 'STATUS', TARGET: ble.rid, DEVTYPE: ble.receiverType }, 3400, true);
      if (status.STATUS === 'OK') {
        receiveLine(Object.entries(status).map(([key, value]) => `${key}=${value}`).join(';'));
        bridge.receivers[ble.rid] = deviceRecord({ RID: ble.rid, DEVTYPE: ble.receiverType });
        persistBridge();
      }
    } catch (_) {}
  }

  function transportStatus() {
    const gateway = ble.connected && ble.rid ? bridge.receivers[ble.rid] : null;
    return {
      gatewayReady: Boolean(gateway),
      gateway: gateway ? { rid: gateway.rid, hardwareId: gateway.hardwareId, receiverType: gateway.receiverType } : {},
      transport: 'BLE_ESPNOW'
    };
  }

  function publicReceivers() {
    return Object.values(bridge.receivers).map((record) => {
      const isGateway = Boolean(ble.connected && record.rid === ble.rid);
      return {
        ...record,
        online: isGateway,
        gateway: isGateway,
        reachableViaGateway: Boolean(ble.connected),
        reachability: isGateway ? 'ble_gateway' : (ble.connected ? 'esp_now' : 'unknown'),
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
        : 0.003 + normalized * normalized * 1.50;
    }
    return 0.002 + normalized * normalized * 0.80;
  }

  function phaseFor(timelineId, state, receiverType) {
    const key = String(timelineId || 'default').slice(0, 160);
    const at = performance.now();
    const speed = clamp(state.speed, 0, 100, 22);
    const engine = String(state.engine || 'CHASE').toUpperCase();
    const restartToken = Number(state.restartToken || 0);
    const signature = `${engine}:${clamp(state.variant, 0, 255, 0)}:${state.direction === 'left' ? 'left' : 'right'}`;
    const current = phaseClocks.get(key);
    let phase = current
      ? (current.phase + ((at - current.at) / 1000) * cyclesPerSecond(current.speed, current.receiverType, current.engine)) % 1
      : ((Number(state.phaseMs) || 0) / 1000) % 1;
    if (current && (current.restartToken !== restartToken || current.signature !== signature || current.receiverType !== receiverType)) {
      phase = ((Number(state.phaseMs) || 0) / 1000) % 1;
    }
    phaseClocks.set(key, { phase, at, speed, engine, restartToken, signature, receiverType, used: at });
    if (phaseClocks.size > 128) {
      const oldest = [...phaseClocks.entries()].sort((left, right) => left[1].used - right[1].used)[0]?.[0];
      if (oldest && oldest !== key) phaseClocks.delete(oldest);
    }
    return Math.round((((phase % 1) + 1) % 1) * 1000) % 1000;
  }

  function liveFields(body, target, targetIndex, targets, save) {
    const state = body.state || {};
    const receiverType = String(target.receiverType || state.receiverType || 'SPI').toUpperCase() === 'RGBW' ? 'RGBW' : 'SPI';
    const requestedLeft = state.direction === 'left';
    const engine = String(state.engine || 'CHASE').toUpperCase();
    const motionReverse = ['GRADIENT', 'ALTERNATE'].includes(engine) ? !requestedLeft : requestedLeft;
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
    let offset = Number(target.offset || 0);
    if (receiverType === 'SPI' && !isParallel && targets.length > 1) {
      offset = targets.slice(0, targetIndex).reduce((sum, item) => sum + clamp(item.pixels, 1, 1024, 1), 0);
    }
    const variant = clamp(state.variant, 0, 255, 0);
    const lineCount = clamp(target.lineCount || (isParallel ? targets.length : 1), 1, 32, 1);
    const lineTimed = isParallel && lineCount > 1 &&
      ((receiverType === 'SPI' && variant >= 90 && variant <= 102) ||
       (receiverType === 'RGBW' && variant >= 5 && variant <= 16));
    const fields = {
      TYPE: save ? 'SAVE' : 'LIVE', KEY: bridge.networkKey, TARGET: exactRid(target.rid || target.receiverId),
      DEVTYPE: receiverType, SCENE: engine, VARIANT: variant,
      FG: rgb(colors[0], whites[0], rgbFlags[0], whiteFlags[0]),
      FG2: rgb(colors[1], whites[1], rgbFlags[1], whiteFlags[1]),
      FG3: rgb(colors[2], whites[2], rgbFlags[2], whiteFlags[2]),
      FG4: rgb(colors[3], whites[3], rgbFlags[3], whiteFlags[3]),
      COLORS: engine === 'WARM' ? 1 : clamp(state.colorCount || colors.length, 1, 4, 1),
      BG: rgb(state.background || '#000000', state.backgroundWhite || 0,
        state.backgroundRgbEnabled !== false, state.backgroundWhiteEnabled !== false),
      BGON: engine === 'WARM' ? 0 : Number(state.backgroundOn !== false),
      SPEED: clamp(state.speed, 0, 100, 22), WIDTH: clamp(state.width, 1, 100, 30),
      WIDTHPX: clamp(state.widthPixels, 1, Math.min(groupPixels, 8192), 3),
      SMOOTH: clamp(state.smooth, 0, 100, 90), BRIGHT: clamp(state.brightness, 0, 100, 100),
      BGBRIGHT: clamp(state.bgBrightness, 0, 100, 10), SPACING: clamp(state.spacing, 0, 100, 50),
      COUNT: clamp(state.objectCount, 1, 16, 1), TRAIL: clamp(state.trailLength, 0, 100, 45),
      SPREAD: clamp(state.spread, 0, 100, 50), RANDOM: clamp(state.randomness, 0, 100, 25),
      BOUNCE: Number(Boolean(state.bounce)), MIRROR: Number(Boolean(state.mirror)),
      LINEINDEX: clamp(target.lineIndex ?? targetIndex, 0, lineCount - 1, targetIndex), LINECOUNT: lineCount,
      PARALLEL: Number(isParallel),
      REVERSE: Number(physicalReverse !== motionReverse), MOTIONREVERSE: Number(motionReverse),
      PHYSICALREVERSE: Number(physicalReverse), RESTART: clamp(state.restartToken, 0, Number.MAX_SAFE_INTEGER, 0),
      POWER: 100, WHITEMIX: 0, TRANSITIONMS: clamp(state.transitionMs, 0, 1000, 70),
      PHASEMS: phaseFor(body.timelineId || state.timelineId, state, receiverType), TEST: 'NONE'
    };
    if (lineTimed) fields.LINEDELAYMS = Math.round(clamp(state.lineDelayMs, 0, 5080, 240) / 40) * 40;
    if (receiverType === 'RGBW') {
      fields.PORT = clamp(target.port || target.outputPort, 1, 2, 1);
      delete fields.WIDTH; delete fields.WIDTHPX; delete fields.PHYSICALREVERSE;
      delete fields.MOTIONREVERSE; delete fields.PIXELS; delete fields.GROUPPIXELS; delete fields.OFFSET;
    } else {
      fields.PIXELS = groupPixels; fields.GROUPPIXELS = groupPixels; fields.OFFSET = offset;
    }
    return fields;
  }

  function commandFields(body, target, targetIndex, targets) {
    const action = String(body.action || 'live').toUpperCase();
    const receiverType = String(target.receiverType || body.state?.receiverType || 'SPI').toUpperCase() === 'RGBW' ? 'RGBW' : 'SPI';
    const rid = exactRid(target.rid || target.receiverId);
    const base = { TARGET: rid, DEVTYPE: receiverType };
    if (action === 'STATUS') return { TYPE: 'STATUS', ...base };
    if (action === 'UNPAIR') return { TYPE: 'UNPAIR', KEY: bridge.networkKey, TARGET: rid };
    if (action === 'CONFIG') {
      if (receiverType === 'RGBW') {
        const portMask = clamp(target.portMask, 1, 3, 3);
        const fields = { TYPE: 'CONFIG', KEY: bridge.networkKey, ...base, PORTMASK: portMask, PHYSICAL: portMask };
        const port = clamp(target.port, 0, 2, 0);
        if (port) fields.PORT = port;
        return fields;
      }
      return { TYPE: 'CONFIG', KEY: bridge.networkKey, TARGET: rid, DEVTYPE: 'SPI',
        PHYSICAL: clamp(target.pixels, 1, 1024, 60), PHYSICALREVERSE: Number(Boolean(target.reversed)) };
    }
    if (action === 'IDENTIFY') {
      const fields = { TYPE: 'LIVE', KEY: bridge.networkKey, ...base, TEST: 'IDENTIFY' };
      if (receiverType === 'RGBW') fields.PORT = clamp(target.port, 1, 2, 1);
      else {
        fields.PIXELS = clamp(body.state?.groupPixels || target.groupPixels || target.pixels, 1, 65535, 1);
        fields.GROUPPIXELS = fields.PIXELS; fields.OFFSET = clamp(target.offset, 0, 65535, 0);
      }
      return fields;
    }
    if (['CALIBRATE', 'CALIBRATE_FILL'].includes(action)) {
      const pixels = clamp(target.pixels, 1, 1024, 1);
      return { TYPE: 'LIVE', KEY: bridge.networkKey, TARGET: rid, DEVTYPE: 'SPI', TEST: 'FILL',
        PHYSICAL: pixels, PIXELS: pixels, GROUPPIXELS: pixels, OFFSET: 0,
        PHYSICALREVERSE: Number(Boolean(target.reversed)) };
    }
    if (action === 'CALIBRATE_CLEAR') {
      return { TYPE: 'LIVE', KEY: bridge.networkKey, TARGET: rid, DEVTYPE: 'SPI', TEST: 'CLEAR' };
    }
    return liveFields(body, target, targetIndex, targets, action === 'SAVE');
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
      receiverTypes.add(receiverType);
      const port = clamp(target.port ?? target.outputPort, 0, 2, 0);
      if (receiverType === 'RGBW' && ['LIVE', 'SAVE', 'IDENTIFY'].includes(action) && ![1, 2].includes(port)) {
        throw new Error('RGBW-doel mist poort 1 of 2');
      }
      if (receiverType === 'RGBW' && action === 'CONFIG' && ![1, 2, 3].includes(clamp(target.portMask, 0, 3, 0))) {
        throw new Error('RGBW-poortkeuze is ongeldig');
      }
      const endpoint = `${rid}:${receiverType === 'RGBW' ? port : 0}`;
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
      body = { ...body, state: { ...body.state, groupPixels: offset } };
    }
    return { body, action, targets };
  }

  function resultFromReply(action, body, target, sent, reply) {
    const rid = target.rid;
    const receiverType = target.receiverType;
    const requestedPort = clamp(target.port ?? target.outputPort, 0, 2, 0);
    const accepted = reply.STATUS === 'OK';
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
    const rawPort = reply.PORTACK ?? reply.PORT;
    let portMatch = receiverType !== 'RGBW' || !requestedPort
      ? true : rawPort !== undefined && Number(rawPort) === requestedPort;
    if (receiverType === 'RGBW' && action === 'CONFIG') {
      const requestedMask = clamp(target.portMask, 1, 3, 3);
      const reportedMask = reply.PORTMASK ?? reply.PHYSICAL;
      portMatch = reportedMask !== undefined && Number(reportedMask) === requestedMask &&
        (reply.PORTACK === undefined || Number(reply.PORTACK) === requestedMask);
    }
    const confirmed = accepted && targetMatches && portMatch &&
      ['1', 'DIRECT', 'OK', 'DELIVERED'].includes(targetAck);
    return {
      id: target.id, online: accepted, accepted, confirmed,
      gatewayAck: accepted, targetAck: targetAck || null, target: rid,
      reportedTarget: reportedTarget || null, detail: reply.DETAIL,
      receiverType: reply.DEVTYPE || receiverType || body.state?.receiverType || 'SPI',
      port: rawPort ?? requestedPort, portMatch,
      portMask: reply.PORTMASK, portCount: reply.PORTS ?? reply.PORTCOUNT,
      physical: reply.PHYSICAL, physicalReverse: reply.PHYSICALREVERSE,
      groupPixels: reply.GROUPPIXELS ?? reply.PIXELS,
      fps: reply.FPS, frame: reply.FRAME, sample: reply.SAMPLE,
      appliedEffect: reply.EFFECT, appliedVariant: reply.VARIANT,
      appliedSpeed: reply.SPEED, appliedWidthPixels: reply.WIDTHPX ?? reply.WIDTH,
      appliedLineDelayMs: reply.LINEDELAYMS,
      phaseMs: sent.PHASEMS, reply: Object.entries(reply).map(([key, value]) => `${key}=${value}`).join(';')
    };
  }

  async function executeCommands(rawBody) {
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
    if (!ble.connected) {
      try { await reconnectPermittedGateway(); } catch (_) {}
    }
    if (!ble.connected) {
      return { results: targets.map((target) => ({
        id: target.id, online: false, accepted: false, confirmed: false,
        gatewayAck: false, target: target.rid, detail: 'Verbind eerst een receiver via Bluetooth'
      })) };
    }
    const gatewayRid = exactRid(ble.rid);
    const ordered = targets.map((target, index) => ({ target, index })).sort((left, right) => {
      const leftGateway = [left.target.rid, exactRid(left.target.physicalRid)].includes(gatewayRid) ? 0 : 1;
      const rightGateway = [right.target.rid, exactRid(right.target.physicalRid)].includes(gatewayRid) ? 0 : 1;
      return leftGateway - rightGateway || left.index - right.index;
    });
    const completed = [];
    let interruptedByOta = false;
    for (const entry of ordered) {
      const { target, index } = entry;
      if (interruptedByOta || otaController?.busy) {
        interruptedByOta = true;
        completed.push({ index, result: {
          id: target.id, online: false, accepted: false, confirmed: false,
          gatewayAck: false, target: target.rid,
          detail: 'Firmware-update actief · deze verouderde lichtopdracht is veilig overgeslagen'
        } });
        continue;
      }
      try {
        const sent = commandFields(body, target, index, targets);
        let reply = await transact(sent, action === 'CONFIG' ? 4200 : 3200, true);
        let result = resultFromReply(action, body, target, sent, reply);
        if (action === 'CONFIG' && target.receiverType === 'RGBW' && result.accepted && !result.confirmed) {
          const physicalRid = exactRid(target.physicalRid || target.rid);
          const requestedMask = clamp(target.portMask, 1, 3, 3);
          const status = await transact({ TYPE: 'STATUS', TARGET: physicalRid, DEVTYPE: 'RGBW' }, 3600, true);
          const statusMask = clamp(status.PORTMASK ?? status.PHYSICAL, 0, 3, 0);
          if (status.STATUS === 'OK' && exactRid(status.TARGETRID) === physicalRid && statusMask === requestedMask) {
            reply = { ...reply, ...status, TARGETRID: physicalRid, PORTMASK: String(statusMask) };
            result = { ...resultFromReply(action, body, target, sent, reply), confirmed: true, portMatch: true };
          }
        }
        if (result.confirmed && action === 'CONFIG') {
          const physicalRid = exactRid(target.physicalRid || target.rid);
          const stored = bridge.receivers[physicalRid];
          if (stored?.receiverType === 'SPI') {
            const requestedPixels = clamp(target.pixels, 1, 1024, stored.pixels || 60);
            const reportedPixels = clamp(reply.PHYSICAL, 0, 1024, 0);
            const sideMatch = String(reply.PHYSICALREVERSE ?? '') === String(Number(Boolean(target.reversed)));
            if (reportedPixels === requestedPixels && sideMatch) {
              stored.pixels = requestedPixels;
              stored.physicalReverse = Boolean(target.reversed);
            }
          }
          if (stored?.receiverType === 'RGBW') stored.portMask = clamp(reply.PORTMASK, 1, 3, stored.portMask || 3);
          persistBridge();
        }
        if (result.confirmed && action === 'UNPAIR') {
          delete bridge.receivers[target.rid];
          delete bridge.browserDeviceIds[target.rid];
          if (bridge.preferredGatewayRid === target.rid) bridge.preferredGatewayRid = Object.keys(bridge.receivers)[0] || '';
          persistBridge();
        }
        completed.push({ index, result });
      } catch (error) {
        completed.push({ index, result: {
          id: target.id, online: false, accepted: false, confirmed: false,
          gatewayAck: false, target: target.rid, detail: String(error?.message || error)
        } });
      }
    }
    return { results: completed.sort((left, right) => left.index - right.index).map((entry) => entry.result) };
  }

  class LatestCommandBroker {
    constructor() {
      this.durable = [];
      this.live = new Map();
      this.running = false;
    }

    key(body) {
      const targets = Array.isArray(body?.targets) ? body.targets : [];
      return targets.map((target) => {
        const identity = String(target.rid || target.receiverId || target.deviceId || target.id || '').toUpperCase();
        const port = target.port || target.outputPort || '';
        return identity + (port ? `:${port}` : '');
      }).join('|') || 'ALL';
    }

    submit(body) {
      return new Promise((resolve) => {
        const action = String(body?.action || 'live').toUpperCase();
        const key = this.key(body);
        const job = { body, resolve, key };
        if (LATEST_ONLY_ACTIONS.has(action)) {
          const previous = this.live.get(key);
          if (previous) previous.resolve({ results: [], superseded: true });
          this.live.set(key, job);
        } else {
          if (['CALIBRATE_CLEAR', 'CONFIG'].includes(action)) {
            const pending = this.live.get(key);
            if (pending && ['CALIBRATE', 'CALIBRATE_FILL'].includes(String(pending.body?.action || '').toUpperCase())) {
              this.live.delete(key);
              pending.resolve({ results: [], superseded: true });
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
        try { job.resolve(await executeCommands(job.body)); }
        catch (error) {
          const targets = Array.isArray(job.body?.targets) ? job.body.targets : [];
          job.resolve({
            results: targets.map((target) => ({
              id: target.id, online: false, accepted: false, confirmed: false,
              gatewayAck: false, target: exactRid(target.rid || target.receiverId),
              detail: String(error?.message || error)
            })),
            error: String(error?.message || error)
          });
        }
      }
      this.running = false;
    }
  }

  const commandBroker = new LatestCommandBroker();

  function saveOtaReceiver(record) {
    const rid = exactRid(record?.rid);
    if (!rid) throw new Error('Ongeldige receiveridentiteit na firmwarecontrole');
    bridge.receivers[rid] = { ...(bridge.receivers[rid] || {}), ...record, rid };
    persistBridge();
    return bridge.receivers[rid];
  }

  if (typeof window.createAluvisionDirectOta === 'function') {
    otaController = window.createAluvisionDirectOta({
      getBle: () => ble,
      getNetworkKey: () => bridge.networkKey,
      listReceivers: () => publicReceivers(),
      getReceiver: (rid) => bridge.receivers[exactRid(rid)] || null,
      saveReceiver: saveOtaReceiver,
      recordFromInfo: (info) => deviceRecord(info),
      transact,
      parseFields,
      attachDevice,
      waitForCommandDrain: async () => { try { await commandTail; } catch (_) {} },
      nativeFetch,
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
    if (path === '/api/session') return json({ token: 'static-github-pages' });
    if (path === '/api/health') return json({ ok: true, build: '18.18-faithful-static', ready: ble.connected });
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
    if (path === '/api/pair' || path === '/api/pair-test') {
      if (otaController?.busy) {
        return json({ ok: false, busy: true, error: 'Wacht tot de firmware-update klaar is' }, 409);
      }
      try {
        const receiver = await pairReceiver(body.number || 1);
        return json({ ok: true, device: receiver, transport: transportStatus() });
      } catch (error) {
        return json({ ok: false, error: String(error?.message || error), transport: transportStatus() });
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

  window.AluvisionDirectBridge = Object.freeze({
    get connected() { return ble.connected; },
    get gatewayRid() { return ble.rid; },
    get receivers() { return publicReceivers(); },
    get otaBusy() { return Boolean(otaController?.busy); }
  });

  function phoneCopy() {
    let language = 'nl';
    try {
      const app = JSON.parse(localStorage.getItem(APP_KEY) || '{}');
      language = String(app?.settings?.language || app?.language || document.documentElement.lang || 'nl').slice(0, 2);
    } catch (_) {}
    const copy = {
      nl: {
        eyebrow: 'IPHONE · RECHTSTREEKS', title: 'Open de volledige app in Bluefy',
        intro: 'Deze GitHub-app werkt zonder Mac en zonder lokaal wifi-netwerk.',
        steps: ['Open de GitHub-link in de Bluefy-browser.', 'Tik op Receiver toevoegen of Controller verbinden.', 'Tik de receiver aan en kies hem in het Bluetooth-venster.'],
        safari: 'Safari kan de interface bekijken, maar biedt geen directe Web Bluetooth. Gebruik Bluefy voor koppelen en live licht.',
        note: 'Eén receiver is de Bluetooth-gateway. De andere gekoppelde receivers volgen via ESP-NOW.', close: 'Begrepen'
      },
      en: {
        eyebrow: 'IPHONE · DIRECT', title: 'Open the full app in Bluefy',
        intro: 'This GitHub app works without a Mac or local Wi-Fi network.',
        steps: ['Open the GitHub link in the Bluefy browser.', 'Tap Add receiver or Connect controller.', 'Tap the receiver and select it in the Bluetooth window.'],
        safari: 'Safari can display the interface but does not provide direct Web Bluetooth. Use Bluefy for pairing and live lighting.',
        note: 'One receiver is the Bluetooth gateway. Other paired receivers follow over ESP-NOW.', close: 'Got it'
      },
      fr: {
        eyebrow: 'IPHONE · DIRECT', title: 'Ouvrez l’app complète dans Bluefy',
        intro: 'Cette app GitHub fonctionne sans Mac ni réseau Wi-Fi local.',
        steps: ['Ouvrez le lien GitHub dans le navigateur Bluefy.', 'Touchez Ajouter un récepteur ou Connecter le contrôleur.', 'Touchez le récepteur et sélectionnez-le dans la fenêtre Bluetooth.'],
        safari: 'Safari peut afficher l’interface, mais ne fournit pas le Web Bluetooth direct. Utilisez Bluefy pour l’association et la lumière en direct.',
        note: 'Un récepteur sert de passerelle Bluetooth. Les autres suivent via ESP-NOW.', close: 'Compris'
      },
      de: {
        eyebrow: 'IPHONE · DIREKT', title: 'Öffne die vollständige App in Bluefy',
        intro: 'Diese GitHub-App funktioniert ohne Mac und ohne lokales WLAN.',
        steps: ['Öffne den GitHub-Link im Bluefy-Browser.', 'Tippe auf Receiver hinzufügen oder Controller verbinden.', 'Berühre den Receiver und wähle ihn im Bluetooth-Fenster.'],
        safari: 'Safari kann die Oberfläche anzeigen, bietet aber kein direktes Web Bluetooth. Nutze Bluefy zum Koppeln und für Live-Licht.',
        note: 'Ein Receiver ist das Bluetooth-Gateway. Weitere gekoppelte Receiver folgen über ESP-NOW.', close: 'Verstanden'
      }
    };
    return copy[language] || copy.nl;
  }

  function showDirectIphoneHelp() {
    const overlay = document.getElementById('modal');
    const root = document.getElementById('modalBody');
    if (!overlay || !root) return;
    const copy = phoneCopy();
    root.innerHTML = `<div class="eyebrow">${copy.eyebrow}</div><h1>${copy.title}</h1>` +
      `<p class="sub">${copy.intro}</p><ol class="sub" style="line-height:1.8">` +
      copy.steps.map((step) => `<li>${step}</li>`).join('') + '</ol>' +
      `<p class="danger-note">${copy.safari}</p>` +
      `<p class="animation-setting-note"><b>Bluetooth + ESP-NOW</b><br>${copy.note}</p>` +
      `<button class="button" style="width:100%" onclick="document.getElementById('modal').hidden=true">${copy.close}</button>`;
    overlay.hidden = false;
  }

  function decorateDirectIphoneSettings() {
    const root = document.getElementById('settings');
    const card = root?.querySelector('[data-customer-phone]');
    if (!card) return;
    const copy = phoneCopy();
    const title = card.querySelector('h2');
    const description = card.querySelector('p');
    const button = card.querySelector('button');
    if (title) title.textContent = copy.title;
    if (description) description.textContent = copy.intro;
    if (button) button.textContent = copy.close === 'Begrepen' ? 'Toon stappen →' : `${copy.close} →`;
  }

  window.addEventListener?.('load', () => {
    window.showIphoneInstructions = showDirectIphoneHelp;
    window.showIphoneAtHome = showDirectIphoneHelp;
    window.showRemoteAccess = showDirectIphoneHelp;
    window.openGatewayConnection = function directGatewayConnection() {
      const overlay = document.getElementById('modal');
      const root = document.getElementById('modalBody');
      if (!overlay || !root) return;
      root.innerHTML = '<div class="eyebrow">CONTROLLER VERBINDEN</div>' +
        '<h1>Kies één gekoppelde receiver</h1>' +
        '<p class="sub">Deze receiver wordt de Bluetooth-gateway. De andere receivers volgen automatisch via ESP-NOW.</p>' +
        '<div class="tap-visual"><span class="tap-wave"></span><span class="tap-wave"></span><div class="tap-device">BLE<br>LINK</div></div>' +
        '<div class="nfc-pair-steps"><div class="nfc-pair-step"><b>1 · Open</b><small>Open het beveiligde venster met NFC of BOOT.</small></div>' +
        '<div class="nfc-pair-step"><b>2 · Kies</b><small>Selecteer dezelfde receiver in Bluefy.</small></div>' +
        '<div class="nfc-pair-step"><b>3 · Bedien</b><small>De volledige installatie reageert live.</small></div></div>' +
        '<div id="bleConnectStatus" class="nfc-status"><span><b>Klaar om te verbinden</b><small>Dit toestel vraagt de eerste keer toestemming voor Bluetooth.</small></span></div>' +
        '<div class="row"><button class="button soft" onclick="document.getElementById(\'modal\').hidden=true">Annuleren</button>' +
        '<button class="button" onclick="connectGatewayNow()">Verbinden via Bluetooth</button></div>';
      overlay.hidden = false;
    };
    window.connectGatewayNow = async function directGatewayNow() {
      const status = document.getElementById('bleConnectStatus');
      if (status) {
        status.className = 'nfc-status scanning';
        status.innerHTML = '<span><b>Receiver zoeken…</b><small>Laat de receiver aan en dicht bij dit toestel.</small></span>';
      }
      await window.discover(false);
      if (ble.connected) {
        const overlay = document.getElementById('modal');
        if (overlay) overlay.hidden = true;
        window.go?.('devices');
      } else if (status) {
        status.className = 'nfc-status error';
        status.innerHTML = '<span><b>Nog geen receiver gevonden</b><small>Open het venster opnieuw en probeer binnen 60 seconden.</small></span>';
      }
    };
    if (typeof window.pairReceiverViaBluetooth === 'function') {
      const pairBluetooth = window.pairReceiverViaBluetooth;
      window.pairReceiverViaBluetooth = async function directPairBluetooth(...args) {
        const result = await pairBluetooth.apply(this, args);
        const status = document.getElementById('receiverBluetoothTestStatus');
        if (status) status.innerHTML = status.innerHTML
          .replace('Controleer Bluetooth op de Mac', 'Controleer Bluetooth op dit toestel')
          .replace('Check Bluetooth on the Mac', 'Check Bluetooth on this device')
          .replace('Vérifiez le Bluetooth du Mac', 'Vérifiez le Bluetooth de cet appareil')
          .replace('Prüfe Bluetooth am Mac', 'Prüfe Bluetooth auf diesem Gerät');
        return result;
      };
    }
    if (typeof window.settings === 'function') {
      const renderSettings = window.settings;
      window.settings = function directSettings(...args) {
        const result = renderSettings.apply(this, args);
        decorateDirectIphoneSettings();
        return result;
      };
    }
    decorateDirectIphoneSettings();
  });
})();
