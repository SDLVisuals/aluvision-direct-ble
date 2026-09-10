/* Complete installation snapshots. Pure validation is shared by capture,
 * restore and tests; no radio, credentials, UI or storage writes occur here. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AluvisionConfigurationSnapshot = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SCHEMA = 'aluvision.installation.snapshot';
  const VERSION = 1;
  const LIMITS = Object.freeze({ plainBytes: 512 * 1024, storedBytes: 128 * 1024,
    receivers: 30, lines: 120, locations: 64, zones: 128, groups: 512, scenes: 1024, presets: 1024 });
  const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
  const secrets = new Set(['networkKey', 'masterSecret', 'token', 'deviceToken', 'sessionToken',
    'auth', 'rawInfo', 'raw', 'password', 'pin', 'pinCode', 'recoveryKey', 'pinVerifier', 'recoveryVerifier']);
  const transient = new Set(['previewStartedAt', 'transportStatus', 'discovery', 'liveStatus',
    'online', 'gateway', 'reachableViaGateway', 'espNowReachable', 'reachability',
    'lastSeenMs', 'lastSeen', 'fps', 'frame', 'sample', 'uptime', 'pairing', 'testPairing']);
  const rid = value => typeof value === 'string' && /^[0-9A-F]{16}$/.test(value) && value !== '0000000000000000';
  const installation = value => typeof value === 'string' && /^[0-9A-F]{8}$/.test(value) && value !== '00000000';
  const fail = (code, detail = '') => { throw Object.assign(new Error(detail || 'De installatieback-up is ongeldig.'), { code }); };
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const integer = (value, low, high) => Number.isInteger(Number(value)) && Number(value) >= low && Number(value) <= high;
  const id = value => typeof value === 'string' && value.length > 0 && value.length <= 160 && !/[\u0000-\u001f]/.test(value);
  function boundedClone(value, strip = false) {
    let nodes = 0;
    const seen = new WeakSet();
    function visit(item, depth) {
      if (++nodes > 100000 || depth > 40) fail('SNAPSHOT_TOO_COMPLEX');
      if (item === null || typeof item === 'boolean') return item;
      if (typeof item === 'string') { if (item.length > 65536) fail('SNAPSHOT_TOO_LARGE'); return item; }
      if (typeof item === 'number') { if (!Number.isFinite(item)) fail('SNAPSHOT_INVALID_NUMBER'); return item; }
      if (typeof item !== 'object' || seen.has(item)) fail('SNAPSHOT_INVALID_VALUE');
      seen.add(item);
      let copy;
      if (Array.isArray(item)) {
        if (item.length > 8192) fail('SNAPSHOT_TOO_COMPLEX');
        copy = item.map(child => visit(child, depth + 1));
      } else {
        copy = {};
        for (const key of Object.keys(item)) {
          if (forbidden.has(key)) fail('SNAPSHOT_UNSAFE_KEY');
          if (secrets.has(key)) { if (strip) continue; fail('SNAPSHOT_CONTAINS_CREDENTIALS'); }
          if (strip && transient.has(key)) continue;
          const child = item[key];
          if (strip && child === undefined) continue;
          copy[key] = visit(child, depth + 1);
        }
      }
      seen.delete(item);
      return copy;
    }
    const copy = visit(value, 0);
    if (new TextEncoder().encode(JSON.stringify(copy)).length > LIMITS.plainBytes) fail('SNAPSHOT_TOO_LARGE');
    return copy;
  }
  function collection(value, maximum, name, minimum = 0) {
    if (!Array.isArray(value) || value.length < minimum || value.length > maximum) fail('SNAPSHOT_COLLECTION', name);
    const ids = new Set();
    value.forEach(item => { if (!object(item) || !id(item.id) || ids.has(item.id)) fail('SNAPSHOT_DUPLICATE_ID', name); ids.add(item.id); });
    return ids;
  }
  function lightState(value) {
    if (!object(value)) fail('SNAPSHOT_LIGHT_STATE');
    if (value.colors !== undefined && (!Array.isArray(value.colors) || value.colors.length > 32 ||
        value.colors.some(color => typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)))) fail('SNAPSHOT_COLOUR');
    if (value.whiteChannels !== undefined && (!Array.isArray(value.whiteChannels) || value.whiteChannels.length > 32 ||
        value.whiteChannels.some(channel => !integer(channel, 0, 255)))) fail('SNAPSHOT_WHITE');
    for (const field of ['brightness', 'speed', 'smooth', 'bgBrightness']) {
      if (value[field] !== undefined && !integer(value[field], 0, 100)) fail('SNAPSHOT_LIGHT_RANGE', field);
    }
  }
  function validateState(source) {
    const state = boundedClone(source);
    if (!object(state)) fail('SNAPSHOT_STATE');
    collection(state.installations, LIMITS.locations, 'locations', 1);
    collection(state.devices, LIMITS.receivers, 'receivers');
    collection(state.presets || [], LIMITS.presets, 'presets');
    const devices = new Map(), physical = new Set(), assignments = new Set(), lineIds = new Set();
    let zoneCount = 0, groupCount = 0, lineCount = 0;
    for (const device of state.devices) {
      const family = String(device.receiverType || device.type || 'SPI').toUpperCase();
      if (!['SPI', 'RGBW'].includes(family)) fail('SNAPSHOT_RECEIVER_TYPE');
      const hardwareRid = String(device.physicalRid || device.rid || '').toUpperCase();
      if (hardwareRid && (!rid(hardwareRid) || physical.has(hardwareRid))) fail('SNAPSHOT_RECEIVER_IDENTITY');
      if (hardwareRid) physical.add(hardwareRid);
      devices.set(device.id, { source: device, family, rid: hardwareRid });
    }
    for (const location of state.installations) {
      collection(location.zones, LIMITS.zones, 'zones');
      collection(location.scenes || [], LIMITS.scenes, 'scenes');
      zoneCount += location.zones.length;
      const groupIds = new Set();
      for (const zone of location.zones) {
        collection(zone.groups, LIMITS.groups, 'groups'); groupCount += zone.groups.length;
        for (const group of zone.groups) {
          if (groupIds.has(group.id)) fail('SNAPSHOT_DUPLICATE_GROUP'); groupIds.add(group.id);
          if (!Array.isArray(group.receivers)) fail('SNAPSHOT_LINES');
          lightState(group.state);
          let family = group.receiverType ? String(group.receiverType).toUpperCase() : '', pixels = 0;
          for (const line of group.receivers) {
            if (!object(line) || !id(line.id) || lineIds.has(line.id)) fail('SNAPSHOT_DUPLICATE_LINE');
            lineIds.add(line.id); lineCount++;
            const device = devices.get(line.deviceId);
            if (!device) fail('SNAPSHOT_ORPHAN_LINE');
            if (family && family !== device.family) fail('SNAPSHOT_MIXED_GROUP');
            family = device.family;
            if (line.receiverType && String(line.receiverType).toUpperCase() !== family) fail('SNAPSHOT_LINE_TYPE');
            const port = line.port ?? 1;
            if (!integer(port, 1, family === 'RGBW' ? 2 : 4)) fail('SNAPSHOT_PORT');
            const endpoint = line.deviceId + ':' + Number(port);
            if (assignments.has(endpoint)) fail('SNAPSHOT_PORT_ASSIGNED_TWICE'); assignments.add(endpoint);
            if (!integer(line.pixels, 1, family === 'RGBW' ? 1 : 1024)) fail('SNAPSHOT_PIXELS');
            if (line.reversed !== undefined && typeof line.reversed !== 'boolean') fail('SNAPSHOT_DIRECTION');
            pixels += Number(line.pixels);
          }
          if (family === 'SPI' && group.layout !== 'parallel' && pixels > 8192) fail('SNAPSHOT_GROUP_PIXELS');
          if (group.lineStates !== undefined) {
            if (!object(group.lineStates)) fail('SNAPSHOT_LINE_STATES');
            for (const current of Object.values(group.lineStates)) lightState(current);
          }
        }
      }
    }
    if (zoneCount > LIMITS.zones || groupCount > LIMITS.groups || lineCount > LIMITS.lines) fail('SNAPSHOT_CAPACITY');
    for (const preset of state.presets || []) lightState(preset.state);
    if (state.activeInstallationId !== undefined && !state.installations.some(item => item.id === state.activeInstallationId)) fail('SNAPSHOT_ACTIVE_LOCATION');
    return state;
  }
  function create(state, { installationId, mainReceiverId, revision, capturedAt = Date.now() }) {
    const snapshot = { schema: SCHEMA, version: VERSION, installationId, mainReceiverId,
      revision, capturedAt, state: boundedClone(state, true) };
    return validate(snapshot, { installationId });
  }
  function validate(source, expected = {}) {
    const snapshot = boundedClone(source);
    if (!object(snapshot) || snapshot.schema !== SCHEMA || snapshot.version !== VERSION) fail('SNAPSHOT_VERSION');
    if (!installation(snapshot.installationId) || !rid(snapshot.mainReceiverId) ||
        !integer(snapshot.revision, 1, 0xffffffff) || !integer(snapshot.capturedAt, 0, Number.MAX_SAFE_INTEGER)) fail('SNAPSHOT_HEADER');
    if (expected.installationId && snapshot.installationId !== expected.installationId) fail('SNAPSHOT_FOREIGN_INSTALLATION');
    if (expected.minimumRevision !== undefined && Number(snapshot.revision) < Number(expected.minimumRevision)) fail('SNAPSHOT_STALE');
    snapshot.state = validateState(snapshot.state);
    return snapshot;
  }
  function commit(snapshot, adapter) {
    if (!adapter || typeof adapter.isCurrent !== 'function' || typeof adapter.persist !== 'function' ||
        typeof adapter.apply !== 'function' || typeof adapter.rollback !== 'function') fail('SNAPSHOT_COMMIT_UNAVAILABLE');
    if (!adapter.isCurrent()) fail('SNAPSHOT_INTERRUPTED');
    // One synchronous turn: a cancellation cannot land between the durable
    // local transaction and publication of its already validated app state.
    let rollback;
    try {
      rollback = adapter.persist(snapshot);
      if (rollback && typeof rollback.then === 'function') fail('SNAPSHOT_ASYNC_COMMIT');
      const result = adapter.apply(snapshot);
      if (result && typeof result.then === 'function') fail('SNAPSHOT_ASYNC_COMMIT');
      return result;
    } catch (error) { adapter.rollback(rollback); throw error; }
  }
  return Object.freeze({ schema: SCHEMA, version: VERSION, limits: LIMITS, boundedClone,
    validateState, create, validate, commit });
}));
