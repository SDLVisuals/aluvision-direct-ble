/*
 * Isolated direct-BLE OTA controller for the exact Aluvision browser UI.
 *
 * This module owns no interface markup. It exposes the same JSON job contract
 * as the local /api/firmware/* backend and uses dependencies supplied by
 * direct_ble_bridge.js for the already-established receiver connection.
 */
(() => {
  'use strict';

  const UUIDS = Object.freeze({
    service: '8f0d1100-8b2b-4ca3-a9d5-8a39aaf11700',
    control: '8f0d1104-8b2b-4ca3-a9d5-8a39aaf11700',
    data: '8f0d1105-8b2b-4ca3-a9d5-8a39aaf11700',
    status: '8f0d1106-8b2b-4ca3-a9d5-8a39aaf11700',
  });
  const CATALOG_URL = './firmware/catalog.json';
  const WIRE_VERSION = 1;
  const DATA_MAGIC = 0x3141544F;
  const DATA_BYTES = 128;
  const DATA_RETRIES = 2;
  const MIN_RELIABLE_CAPACITY = 64 * 1024;
  const FINAL_STATES = new Set(['completed', 'failed', 'cancelled']);
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  // The catalogue is untrusted input. These immutable values are the release
  // allow-list reviewed with the matching V18.18 receiver source and binaries.
  const TRUSTED = Object.freeze({
    'spi-18.18.0-nfc': Object.freeze({
      receiverType: 'SPI', model: 'ALV-SPI-SK6812', board: 'ESP32S3',
      version: '18.18.0', variant: 'NFC_ONLY', size: 1283792,
      sha256: '0754c49758c7c906e01c805de9696c4bd14ed27ff9f4f039da53c5b8e6ef051a',
    }),
    'rgbw-18.18.0-nfc': Object.freeze({
      receiverType: 'RGBW', model: 'ALV-RGBW-DUAL', board: 'ESP32S3',
      version: '18.18.0', variant: 'NFC_ONLY', size: 1284944,
      sha256: 'ab5ea8212c58ee0fd55c0a447734d9fee8d594929142f38527003f147f71bf35',
    }),
  });

  const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const textOf = (value) => {
    const view = value instanceof DataView
      ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
      : new Uint8Array(value.buffer || value);
    return decoder.decode(view);
  };
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const exactRid = (value) => /^[0-9A-F]{16}$/.test(String(value || '').toUpperCase())
    ? String(value).toUpperCase() : '';

  function withTimeout(promise, milliseconds, message) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), milliseconds);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  function semver(value) {
    const match = String(value || '').match(/(?:^|[^0-9])(\d+)\.(\d+)(?:\.(\d+))?/);
    return match ? [Number(match[1]), Number(match[2]), Number(match[3] || 0)] : null;
  }

  function compareVersions(left, right) {
    const a = semver(left) || [0, 0, 0];
    const b = semver(right) || [0, 0, 0];
    for (let index = 0; index < 3; index += 1) {
      if (a[index] !== b[index]) return a[index] > b[index] ? 1 : -1;
    }
    return 0;
  }

  function receiverVersion(receiver) {
    for (const candidate of [
      receiver?.firmwareVersion,
      receiver?.version,
      receiver?.build,
      String(receiver?.firmware || '').replace(/^V/i, ''),
    ]) {
      const parsed = semver(candidate);
      if (parsed) return parsed.join('.');
    }
    return '';
  }

  function publicArtifact(artifact) {
    return clone(artifact);
  }

  function validateArtifact(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const id = String(raw.id || '').toLowerCase();
    const trusted = TRUSTED[id];
    if (!trusted) return null;
    const candidate = {
      ...raw,
      id,
      receiverType: String(raw.receiverType || '').toUpperCase(),
      model: String(raw.model || '').toUpperCase(),
      board: String(raw.board || '').toUpperCase(),
      variant: String(raw.variant || '').toUpperCase(),
      sha256: String(raw.sha256 || '').toLowerCase(),
      size: Number(raw.size || 0),
    };
    const exact = ['receiverType', 'model', 'board', 'version', 'variant', 'size', 'sha256']
      .every((field) => candidate[field] === trusted[field]);
    const safeFile = /^artifacts\/[A-Za-z0-9._-]+\.app\.bin$/.test(String(candidate.file || ''));
    const safeMarker = candidate.identityMarker ===
      `ALUVISION_FW_ID_V1|TYPE=${candidate.receiverType}|MODEL=${candidate.model}|BOARD=${candidate.board}|VERSION=${candidate.version}|VARIANT=${candidate.variant}|END`;
    if (!exact || !safeFile || !safeMarker || candidate.trusted !== true ||
        candidate.applicationImage !== true || Number(candidate.otaWireVersion) !== WIRE_VERSION ||
        Number(candidate.dataPayloadBytes) !== DATA_BYTES) return null;
    return Object.freeze(candidate);
  }

  function createController(dependencies) {
    const required = [
      'getBle', 'getNetworkKey', 'listReceivers', 'getReceiver', 'saveReceiver',
      'recordFromInfo', 'transact', 'parseFields', 'attachDevice', 'nativeFetch',
    ];
    required.forEach((name) => {
      if (typeof dependencies?.[name] !== 'function') {
        throw new TypeError(`Aluvision OTA dependency ontbreekt: ${name}`);
      }
    });

    let artifacts = [];
    let catalogueDocument = null;
    let activeJobId = '';
    let wakeLock = null;
    let controlSequence = Math.floor(Date.now() % 900000000) || 1;
    const jobs = new Map();
    const gatt = { control: null, data: null, status: null };
    const stream = { session: 0, buffer: '', queue: [], waiters: [] };

    const getBle = dependencies.getBle;
    const currentJob = () => activeJobId ? jobs.get(activeJobId) : null;
    const publicJob = (job) => clone(job);

    function nextControlId() {
      controlSequence = (controlSequence + 1) % 2147483000 || 1;
      return controlSequence;
    }

    function updateJob(job, changes) {
      Object.assign(job, changes, { updatedAt: Date.now() / 1000 });
      return job;
    }

    async function loadCatalogue(force = false) {
      if (catalogueDocument && !force) return catalogueDocument;
      const response = await dependencies.nativeFetch(CATALOG_URL, {
        cache: 'no-store', credentials: 'same-origin',
      });
      if (!response.ok) throw new Error(`Firmwarecatalogus niet beschikbaar (${response.status})`);
      const raw = await response.json();
      if (Number(raw.schemaVersion) !== 1 || !Array.isArray(raw.artifacts)) {
        throw new Error('Onbekende firmwarecatalogusversie');
      }
      const expectedIds = Object.keys(TRUSTED).sort();
      const suppliedIds = raw.artifacts.map((item) => String(item?.id || '').toLowerCase());
      const uniqueIds = [...new Set(suppliedIds)].sort();
      if (uniqueIds.length !== suppliedIds.length ||
          uniqueIds.length !== expectedIds.length ||
          !uniqueIds.every((id, index) => id === expectedIds[index])) {
        throw new Error('Firmwarecatalogus bevat niet exact de vertrouwde releases');
      }
      const checked = raw.artifacts.map(validateArtifact).filter(Boolean);
      if (checked.length !== Object.keys(TRUSTED).length || checked.length !== raw.artifacts.length) {
        throw new Error('Firmwarecatalogus is niet volledig vertrouwd');
      }
      artifacts = checked;
      catalogueDocument = {
        schemaVersion: 1,
        generatedAt: raw.generatedAt || '',
        loadedAt: Date.now() / 1000,
        artifacts: artifacts.map(publicArtifact),
      };
      return catalogueDocument;
    }

    function matchingArtifact(receiver) {
      const receiverType = String(receiver?.receiverType || '').toUpperCase();
      const model = String(receiver?.model || '').toUpperCase();
      const board = String(receiver?.board || '').toUpperCase();
      return artifacts
        .filter((item) => item.receiverType === receiverType && item.variant === 'NFC_ONLY' &&
          item.channel === 'stable' && (!model || item.model === model) && (!board || item.board === board))
        .sort((left, right) => compareVersions(right.version, left.version))[0] || null;
    }

    function releaseFor(receiver) {
      const latest = matchingArtifact(receiver);
      const receiverType = String(receiver?.receiverType || '').toUpperCase() || 'ONBEKEND';
      const model = String(receiver?.model || '').toUpperCase();
      const board = String(receiver?.board || '').toUpperCase();
      const currentVersion = receiverVersion(receiver) || 'Onbekend';
      const currentVariant = String(receiver?.firmwareVariant || '').toUpperCase() || 'Onbekend';
      const otaMaxBytes = Number(receiver?.otaMaxBytes || 0);
      let state = 'up_to_date';
      let reason = '';
      let updateAvailable = false;
      if (!latest) {
        state = 'incompatible';
        reason = 'Geen lokale firmware voor dit receivertype';
      } else if (!receiver?.otaCapable || Number(receiver?.otaProtocol || 0) !== WIRE_VERSION) {
        state = 'usb_bootstrap_required';
        reason = 'Eenmalige USB-bootstrap met OTA-partities vereist';
      } else if (!model || model !== latest.model) {
        state = 'incompatible';
        reason = 'Receivermodel ontbreekt of komt niet overeen';
      } else if (!board || board !== latest.board) {
        state = 'incompatible';
        reason = 'Receiverbord ontbreekt of komt niet overeen';
      } else {
        const sameRelease = compareVersions(currentVersion, latest.version) === 0 && currentVariant === latest.variant;
        if (!sameRelease && (!Number.isFinite(otaMaxBytes) || otaMaxBytes < MIN_RELIABLE_CAPACITY)) {
          state = 'capacity_refresh_required';
          reason = 'Controleer de updateruimte rechtstreeks via Bluetooth';
        } else if (!sameRelease && latest.size > otaMaxBytes) {
          state = 'incompatible';
          reason = 'Deze update is te groot voor een draadloze update op deze receiver; gebruik eenmalig het bijbehorende USB-bestand';
        } else if (compareVersions(currentVersion, latest.version) < 0 ||
                   (compareVersions(currentVersion, latest.version) === 0 && currentVariant !== latest.variant)) {
          state = 'update_available';
          updateAvailable = true;
        }
      }
      return {
        receiverRid: exactRid(receiver?.rid), receiverType, model, board,
        currentVersion, currentVariant, otaCapable: Boolean(receiver?.otaCapable),
        otaMaxBytes: Number.isFinite(otaMaxBytes) ? otaMaxBytes : 0,
        state, reason, latest: latest ? publicArtifact(latest) : null,
        updateAvailable,
      };
    }

    async function catalogue() {
      const catalog = await loadCatalogue();
      return {
        ok: true,
        ...catalog,
        receivers: dependencies.listReceivers().map(releaseFor),
        activeJobId,
      };
    }

    async function optionalCharacteristic(service, uuid) {
      try { return await service.getCharacteristic(uuid); } catch (_) { return null; }
    }

    async function ensureOtaCharacteristics() {
      const ble = getBle();
      if (!ble.connected || !ble.server) throw new Error('Verbind eerst rechtstreeks met deze receiver');
      const service = await ble.server.getPrimaryService(UUIDS.service);
      [gatt.control, gatt.data, gatt.status] = await Promise.all([
        optionalCharacteristic(service, UUIDS.control),
        optionalCharacteristic(service, UUIDS.data),
        optionalCharacteristic(service, UUIDS.status),
      ]);
      if (!gatt.control || !gatt.data || !gatt.status) throw new Error('OTA_CAPACITY_UNKNOWN');
    }

    async function readInfo() {
      const ble = getBle();
      if (!ble.info) throw new Error('Receiverinformatie is niet beschikbaar');
      return dependencies.parseFields(textOf(await withTimeout(
        ble.info.readValue(), 4000, 'Receiverinformatie timeout',
      )));
    }

    async function refresh(rid) {
      if (activeJobId) throw new Error('Er loopt al een firmware-update');
      const exact = exactRid(rid);
      const receiver = dependencies.getReceiver(exact);
      const ble = getBle();
      if (!receiver) throw new Error('Receiver niet gevonden');
      if (!ble.connected || exactRid(ble.rid) !== exact) {
        throw new Error('Verbind eerst rechtstreeks met deze receiver');
      }
      const info = await readInfo();
      const refreshed = dependencies.recordFromInfo(info);
      dependencies.saveReceiver(refreshed);
      return refreshed;
    }

    function sessionHex(session = stream.session) {
      return (Number(session) >>> 0).toString(16).padStart(8, '0').toUpperCase();
    }

    function controlMessage(type, session, fields = {}) {
      const parts = [
        `TYPE=${type}`, `V=${WIRE_VERSION}`, `ID=${nextControlId()}`,
        `SESSION=${sessionHex(session)}`, `KEY=${dependencies.getNetworkKey()}`,
      ];
      Object.entries(fields).forEach(([key, value]) => parts.push(`${key}=${value}`));
      return parts.join(';');
    }

    async function writeWithResponse(characteristic, bytes, timeout = 10000) {
      if (!characteristic) throw new Error('OTA-characteristic ontbreekt');
      const operation = typeof characteristic.writeValueWithResponse === 'function'
        ? characteristic.writeValueWithResponse(bytes)
        : typeof characteristic.writeValue === 'function'
          ? characteristic.writeValue(bytes)
          : Promise.reject(new Error('Bluetooth write-with-response ontbreekt'));
      await withTimeout(operation, timeout, 'Bluetooth write timeout');
    }

    function rejectWaiters(error) {
      [...stream.waiters].forEach((waiter) => waiter.reject(error));
    }

    function pumpWaiters() {
      for (const waiter of [...stream.waiters]) {
        for (let index = 0; index < stream.queue.length; index += 1) {
          const fields = stream.queue[index];
          if (Number(fields.V || 0) !== WIRE_VERSION ||
              String(fields.SESSION || '').toUpperCase() !== sessionHex(waiter.session)) continue;
          const status = String(fields.STATUS || '').toUpperCase();
          if (status === 'ERROR') {
            stream.queue.splice(index, 1);
            waiter.reject(new Error(`Receiver weigerde de update: ${fields.DETAIL || 'onbekend'}`));
            break;
          }
          if (waiter.expectedNext !== null && status === 'NEXT') {
            const next = Number(fields.NEXT);
            stream.queue.splice(index, 1);
            index -= 1;
            if (!Number.isFinite(next) || next > waiter.expectedNext) {
              waiter.reject(new Error('Receiver bevestigde een onverwachte OTA-offset'));
              break;
            }
            if (next < waiter.expectedNext) continue;
            waiter.resolve(fields);
            break;
          }
          if (waiter.accepted.has(status)) {
            stream.queue.splice(index, 1);
            waiter.resolve(fields);
            break;
          }
        }
      }
    }

    function onOtaStatus(event) {
      stream.buffer += textOf(event.target.value);
      if (stream.buffer.length > 12000) stream.buffer = stream.buffer.slice(-6000);
      let newline = stream.buffer.indexOf('\n');
      while (newline >= 0) {
        const line = stream.buffer.slice(0, newline).replace(/\r/g, '').trim();
        stream.buffer = stream.buffer.slice(newline + 1);
        if (line) {
          stream.queue.push(dependencies.parseFields(line));
          if (stream.queue.length > 120) stream.queue.splice(0, stream.queue.length - 120);
          pumpWaiters();
        }
        newline = stream.buffer.indexOf('\n');
      }
    }

    function waitForStatus(session, accepted, timeout = 10000, expectedNext = null) {
      return new Promise((resolve, reject) => {
        const waiter = {
          session,
          accepted: new Set(accepted.map((value) => String(value).toUpperCase())),
          expectedNext,
          timer: 0,
          resolve(fields) {
            clearTimeout(waiter.timer);
            stream.waiters = stream.waiters.filter((item) => item !== waiter);
            resolve(fields);
          },
          reject(error) {
            clearTimeout(waiter.timer);
            stream.waiters = stream.waiters.filter((item) => item !== waiter);
            reject(error);
          },
        };
        waiter.timer = setTimeout(() => waiter.reject(new Error('Geen OTA-bevestiging ontvangen')), timeout);
        stream.waiters.push(waiter);
        pumpWaiters();
      });
    }

    async function startNotifications() {
      stream.buffer = '';
      stream.queue = [];
      rejectWaiters(new Error('Nieuwe OTA-sessie'));
      gatt.status.removeEventListener('characteristicvaluechanged', onOtaStatus);
      gatt.status.addEventListener('characteristicvaluechanged', onOtaStatus);
      await withTimeout(gatt.status.startNotifications(), 5000, 'OTA notifications timeout');
    }

    async function stopNotifications() {
      if (!gatt.status) return;
      try { gatt.status.removeEventListener('characteristicvaluechanged', onOtaStatus); } catch (_) {}
      if (getBle().connected && typeof gatt.status.stopNotifications === 'function') {
        try { await withTimeout(gatt.status.stopNotifications(), 3000, 'OTA notifications stop timeout'); } catch (_) {}
      }
    }

    function crc32(bytes) {
      let crc = 0xFFFFFFFF;
      for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit += 1) {
          crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
        }
      }
      return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    function dataFrame(session, offset, payload) {
      if (!(payload instanceof Uint8Array) || !payload.length || payload.length > DATA_BYTES) {
        throw new Error('Ongeldig OTA-datablok');
      }
      const frame = new Uint8Array(20 + payload.length);
      const view = new DataView(frame.buffer);
      view.setUint32(0, DATA_MAGIC, true);
      view.setUint8(4, WIRE_VERSION);
      view.setUint8(5, 0);
      view.setUint16(6, payload.length, true);
      view.setUint32(8, Number(session) >>> 0, true);
      view.setUint32(12, Number(offset) >>> 0, true);
      view.setUint32(16, crc32(payload), true);
      frame.set(payload, 20);
      return frame;
    }

    async function readCheckpoint(session) {
      try {
        const fields = dependencies.parseFields(textOf(await withTimeout(
          gatt.status.readValue(), 2500, 'OTA checkpoint timeout',
        )));
        if (Number(fields.V || 0) !== WIRE_VERSION ||
            String(fields.SESSION || '').toUpperCase() !== sessionHex(session)) return null;
        if (String(fields.STATUS || '').toUpperCase() === 'ERROR') {
          throw new Error(`Receiver weigerde de update: ${fields.DETAIL || 'onbekend'}`);
        }
        if (!['NEXT', 'READY'].includes(String(fields.STATUS || '').toUpperCase())) return null;
        const checkpoint = Number(fields.NEXT);
        return Number.isFinite(checkpoint) && checkpoint >= 0 ? checkpoint : null;
      } catch (error) {
        if (/Receiver weigerde/.test(String(error?.message || error))) throw error;
        return null;
      }
    }

    async function writeBlock(job, session, offset, payload) {
      const expectedNext = offset + payload.length;
      const frame = dataFrame(session, offset, payload);
      for (let attempt = 0; attempt <= DATA_RETRIES; attempt += 1) {
        try {
          await writeWithResponse(gatt.data, frame, 9000);
          await waitForStatus(session, ['NEXT'], 9000, expectedNext);
          return expectedNext;
        } catch (error) {
          const message = String(error?.message || error);
          if (!/bevestiging|timeout|disconnected|verbinding|GATT/i.test(message) || !getBle().connected) throw error;
          const checkpoint = await readCheckpoint(session);
          if (checkpoint === expectedNext) return expectedNext;
          if (checkpoint !== null && checkpoint > expectedNext) {
            throw new Error('Receiver rapporteerde een onverwachte OTA-offset');
          }
          if (attempt >= DATA_RETRIES) throw error;
          updateJob(job, { detail: `Bluetooth-bevestiging opnieuw vragen (${attempt + 1}/${DATA_RETRIES})` });
        }
      }
      throw new Error('Receiver bevestigde het OTA-blok niet');
    }

    function containsBytes(haystack, needle) {
      outer: for (let offset = 0; offset <= haystack.length - needle.length; offset += 1) {
        for (let index = 0; index < needle.length; index += 1) {
          if (haystack[offset + index] !== needle[index]) continue outer;
        }
        return true;
      }
      return false;
    }

    async function firmwareBytes(artifact) {
      const trusted = validateArtifact(artifact);
      if (!trusted) throw new Error('Ongeldige of niet-vertrouwde firmwarecatalogus');
      const catalogUrl = new URL(CATALOG_URL, location.href);
      const firmwareUrl = new URL(trusted.file, catalogUrl);
      if (firmwareUrl.origin !== location.origin || !firmwareUrl.pathname.endsWith('.app.bin')) {
        throw new Error('Ongeldige firmwarelocatie');
      }
      const response = await dependencies.nativeFetch(firmwareUrl, {
        cache: 'no-store', credentials: 'same-origin',
      });
      if (!response.ok) throw new Error(`Firmware downloaden mislukt (${response.status})`);
      const contentLength = Number(response.headers.get('content-length') || 0);
      if (contentLength && contentLength !== trusted.size) throw new Error('Firmwaregrootte komt niet overeen');
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length !== trusted.size || bytes[0] !== 0xE9) throw new Error('Ongeldige ESP32-applicatiefirmware');
      const digest = Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
        (byte) => byte.toString(16).padStart(2, '0'),
      ).join('');
      if (digest !== trusted.sha256) throw new Error('SHA-256 firmwarecontrole mislukt');
      if (!containsBytes(bytes, encoder.encode(trusted.identityMarker))) {
        throw new Error('De firmware-identiteit past niet bij deze receiver');
      }
      return bytes;
    }

    function preflight(info, receiver, artifact) {
      if (exactRid(info.RID) !== exactRid(receiver.rid) ||
          String(info.DEVTYPE || '').toUpperCase() !== artifact.receiverType ||
          String(info.MODEL || '').toUpperCase() !== artifact.model ||
          String(info.BOARD || '').toUpperCase() !== artifact.board) throw new Error('OTA_PROFILE');
      if (!['1', 'BLE1'].includes(String(info.OTA || '').toUpperCase()) ||
          Number(info.OTAV || 0) !== WIRE_VERSION) throw new Error('OTA_CAPACITY_UNKNOWN');
      const capacity = Number(info.OTAMAX || 0);
      if (!Number.isFinite(capacity) || capacity < MIN_RELIABLE_CAPACITY) throw new Error('OTA_CAPACITY_UNKNOWN');
      if (artifact.size > capacity) throw new Error('OTA_TOO_LARGE');
      if (compareVersions(info.FWVER, artifact.version) > 0) throw new Error('Downgrade wordt geweigerd');
    }

    async function abortBeforeCommit(job, receiver) {
      if (!stream.session || job.committed || !getBle().connected || !gatt.control) return;
      try {
        await writeWithResponse(gatt.control, encoder.encode(controlMessage(
          'OTA_ABORT', stream.session, { TARGET: receiver.rid },
        )), 3000);
      } catch (_) {}
    }

    async function reconnectAndVerify(device, receiver, artifact) {
      const deadline = Date.now() + 90000;
      let lastError = new Error('Receiver kwam niet terug na de update');
      await delay(receiver.receiverType === 'RGBW' ? 1800 : 900);
      while (Date.now() < deadline) {
        try {
          let info;
          if (!device.gatt.connected) info = await withTimeout(
            dependencies.attachDevice(device), 7000, 'Receiver opnieuw verbinden timeout',
          );
          else info = await readInfo();
          const ble = getBle();
          ble.rid = exactRid(info.RID);
          ble.receiverType = String(info.DEVTYPE || '').toUpperCase() === 'RGBW' ? 'RGBW' : 'SPI';
          if ([exactRid(info.RID), String(info.DEVTYPE || '').toUpperCase(),
               String(info.MODEL || '').toUpperCase(), String(info.BOARD || '').toUpperCase()].join('|') !==
              [receiver.rid, artifact.receiverType, artifact.model, artifact.board].join('|')) throw new Error('OTA_PROFILE');
          const state = String(info.OTASTATE || info.BOOTSTATE || '').toUpperCase();
          if (state === 'ROLLED_BACK') throw new Error('OTA_ROLLBACK');
          if (String(info.FWVER || '') !== artifact.version ||
              String(info.FWVARIANT || '').toUpperCase() !== artifact.variant) throw new Error('OTA_ROLLBACK');
          if (!['VALID', 'CONFIRMED'].includes(state)) {
            lastError = new Error('Nieuwe firmware is nog niet bevestigd');
            await delay(800);
            continue;
          }
          const refreshed = dependencies.recordFromInfo(info);
          dependencies.saveReceiver(refreshed);
          return refreshed;
        } catch (error) {
          if (/OTA_PROFILE|OTA_ROLLBACK/.test(String(error?.message || error))) throw error;
          lastError = error;
          try { if (device.gatt.connected) device.gatt.disconnect(); } catch (_) {}
          getBle().connected = false;
          await delay(800);
        }
      }
      throw lastError;
    }

    function friendlyError(error, committed) {
      const message = String(error?.message || error || 'Onbekende fout');
      if (/OTA_CAPACITY_UNKNOWN|DUAL_SLOT_REQUIRED/.test(message)) return 'Deze receiver heeft nog een eenmalige USB-installatie nodig voordat draadloze updates veilig kunnen.';
      if (/OTA_TOO_LARGE|IMAGE_TOO_LARGE/.test(message)) return 'Deze firmware past niet in de inactieve updatepartitie. Werk de receiver via USB bij.';
      if (/OTA_PROFILE|WRONG_FIRMWARE_TYPE/.test(message)) return 'De verbonden receiver past niet exact bij deze firmware. Er is niets geïnstalleerd.';
      if (/OTA_ROLLBACK/.test(message)) return 'De nieuwe firmware slaagde niet voor de zelftest. De receiver heeft zichzelf veilig teruggezet.';
      if (/disconnected|GATT|timeout|bevestiging|verbinding/i.test(message)) return committed
        ? 'De firmware is verzonden, maar de veilige herstart kon niet worden bevestigd. Verbind de receiver opnieuw om de versie te controleren.'
        : 'De Bluetoothverbinding viel weg. Zet de receiver dichtbij en probeer opnieuw.';
      return message.replace(/^Receiver weigerde de update:\s*/i, 'Receiver stopte de update: ');
    }

    async function acquireWakeLock() {
      try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch (_) { wakeLock = null; }
    }

    async function releaseWakeLock() {
      try { await wakeLock?.release(); } catch (_) {}
      wakeLock = null;
    }

    async function run(job, receiver, artifact) {
      updateJob(job, { state: 'running', phase: 'connecting', progress: 1, detail: 'Directe Bluetooth-verbinding controleren' });
      await acquireWakeLock();
      const device = getBle().device;
      let image = null;
      let notifications = false;
      try {
        // The OTA job is already marked busy. Wait until every normal command
        // that began before that boundary has received its ACK before doing
        // *any* OTA GATT read/write. This prevents a slow LIVE ACK from
        // overlapping even the OTA identity/preflight reads.
        if (typeof dependencies.waitForCommandDrain === 'function') {
          await dependencies.waitForCommandDrain();
        }
        const info = await readInfo();
        await ensureOtaCharacteristics();
        preflight(info, receiver, artifact);
        image = await firmwareBytes(artifact);
        if (job.cancelRequested) throw new Error('OTA_CANCELLED');

        updateJob(job, { phase: 'arming', progress: 2, detail: 'Receiver opent de beveiligde updateverbinding' });
        // OTA_ARM uses the same serialized transport; new light commands stay
        // blocked until this job reaches a final state.
        const arm = await dependencies.transact({
          TYPE: 'OTA_ARM', KEY: dependencies.getNetworkKey(), TARGET: receiver.rid, WINDOWMS: 120000,
        }, 9000, true);
        const armTarget = exactRid(arm.TARGETRID || arm.TARGET);
        if (arm.STATUS !== 'OK' || arm.DETAIL !== 'OTA_ARMED' ||
            !['1', 'DIRECT'].includes(String(arm.TARGETACK || '').toUpperCase()) || armTarget !== receiver.rid) {
          throw new Error('Receiver heeft het directe OTA-venster niet bevestigd');
        }
        if (job.cancelRequested) throw new Error('OTA_CANCELLED');

        await startNotifications();
        notifications = true;
        const random = new Uint32Array(1);
        crypto.getRandomValues(random);
        stream.session = random[0] || 1;
        const begin = controlMessage('OTA_BEGIN', stream.session, {
          TARGET: receiver.rid, DEVTYPE: artifact.receiverType, MODEL: artifact.model,
          BOARD: artifact.board, VERSION: artifact.version, VARIANT: artifact.variant,
          SIZE: artifact.size, SHA256: artifact.sha256,
        });
        await writeWithResponse(gatt.control, encoder.encode(begin), 10000);
        const ready = await waitForStatus(stream.session, ['READY'], 10000);
        if (Number(ready.NEXT) !== 0) throw new Error('Receiver start de update niet op byte nul');

        let offset = 0;
        updateJob(job, { phase: 'uploading', progress: 3, detail: 'Firmware rechtstreeks via Bluetooth versturen' });
        while (offset < image.length) {
          if (job.cancelRequested) throw new Error('OTA_CANCELLED');
          const payload = image.slice(offset, Math.min(offset + DATA_BYTES, image.length));
          offset = await writeBlock(job, stream.session, offset, payload);
          const progress = Math.min(96, 3 + Math.floor(offset * 93 / image.length));
          updateJob(job, { progress, bytesSent: offset, detail: `Firmware versturen · ${progress}%` });
        }

        job.cancelAllowed = false;
        if (job.cancelRequested) throw new Error('OTA_CANCELLED');
        updateJob(job, { phase: 'verifying', progress: 97, bytesSent: image.length, detail: 'Firmware en identiteit controleren', cancelAllowed: false });
        job.committed = true;
        const commit = controlMessage('OTA_COMMIT', stream.session, { TARGET: receiver.rid });
        await writeWithResponse(gatt.control, encoder.encode(commit), 10000);
        await waitForStatus(stream.session, ['VERIFIED'], 20000);
        updateJob(job, { phase: 'rebooting', progress: 98, detail: 'Receiver herstart met de nieuwe firmware' });
        try { await waitForStatus(stream.session, ['REBOOTING'], 4000); } catch (_) {}
        await stopNotifications();
        notifications = false;
        await delay(1200);
        try { if (device.gatt.connected) device.gatt.disconnect(); } catch (_) {}
        getBle().connected = false;

        updateJob(job, { phase: 'reconnecting', progress: 99, detail: 'Nieuwe versie en veilige opstart bevestigen' });
        const verified = await reconnectAndVerify(device, receiver, artifact);
        updateJob(job, {
          state: 'completed', phase: 'verified', progress: 100,
          bytesSent: artifact.size, cancelAllowed: false,
          detail: 'Nieuwe firmware draait en is geverifieerd', verified,
          completedAt: Date.now() / 1000,
        });
      } catch (initialError) {
        let error = initialError;
        if (job.committed) {
          try {
            if (notifications) { await stopNotifications(); notifications = false; }
            updateJob(job, { phase: 'reconnecting', progress: 99, cancelAllowed: false, detail: 'Commit verzonden; nieuwe firmware veilig controleren' });
            const verified = await reconnectAndVerify(device, receiver, artifact);
            updateJob(job, {
              state: 'completed', phase: 'verified', progress: 100,
              bytesSent: artifact.size, cancelAllowed: false,
              detail: 'Nieuwe firmware draait en is geverifieerd', verified,
              completedAt: Date.now() / 1000,
            });
            return;
          } catch (verificationError) { error = verificationError; }
        } else {
          await abortBeforeCommit(job, receiver);
        }
        const cancelled = /OTA_CANCELLED/.test(String(error?.message || error));
        updateJob(job, {
          state: cancelled ? 'cancelled' : 'failed',
          phase: cancelled ? 'cancelled' : 'error',
          cancelAllowed: false,
          detail: cancelled ? 'Update veilig geannuleerd' : 'Firmware-update mislukt',
          error: cancelled ? '' : friendlyError(error, job.committed),
          completedAt: Date.now() / 1000,
        });
      } finally {
        if (notifications) await stopNotifications();
        rejectWaiters(new Error('OTA-sessie afgesloten'));
        await releaseWakeLock();
        image = null;
        if (activeJobId === job.id) activeJobId = '';
      }
    }

    async function start(rid, artifactId, development = false) {
      if (activeJobId) throw new Error('Er loopt al een firmware-update');
      await loadCatalogue(true);
      const exact = exactRid(rid);
      const receiver = dependencies.getReceiver(exact);
      const artifact = artifacts.find((item) => item.id === String(artifactId || '').toLowerCase());
      const ble = getBle();
      if (!exact || !receiver) throw new Error('Receiver is niet gekoppeld');
      if (!artifact) throw new Error('Firmwareversie staat niet in de lokale catalogus');
      if (artifact.variant === 'TEMP_BLE_PAIRING' && development !== true) throw new Error('Tijdelijke ontwikkelfirmware vereist een expliciete ontwikkelkeuze');
      if (artifact.receiverType !== String(receiver.receiverType || '').toUpperCase()) throw new Error('Firmwaretype komt niet overeen met de receiver');
      if (!ble.connected || exactRid(ble.rid) !== exact) throw new Error('Verbind eerst rechtstreeks met deze receiver');
      const release = releaseFor(receiver);
      if (release.state !== 'update_available' || release.latest?.id !== artifact.id) throw new Error(release.reason || 'Deze firmwarebuild kan niet veilig worden geïnstalleerd');
      const now = Date.now() / 1000;
      const job = {
        id: crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`,
        rid: exact, receiverType: artifact.receiverType, model: artifact.model, board: artifact.board,
        fromVariant: String(receiver.firmwareVariant || 'Onbekend'), toVariant: artifact.variant,
        fromVersion: receiverVersion(receiver) || 'Onbekend', toVersion: artifact.version,
        artifactId: artifact.id, state: 'queued', phase: 'preflight', progress: 0,
        bytesSent: 0, totalBytes: artifact.size, cancelAllowed: true,
        cancelRequested: false, committed: false, error: '', detail: 'Update wordt voorbereid',
        createdAt: now, updatedAt: now,
      };
      jobs.set(job.id, job);
      activeJobId = job.id;
      void run(job, receiver, artifact);
      return publicJob(job);
    }

    function status(jobId) {
      const job = jobs.get(String(jobId || ''));
      if (!job) throw new Error('Firmware-update niet gevonden');
      return publicJob(job);
    }

    function cancel(jobId) {
      const job = jobs.get(String(jobId || ''));
      if (!job) throw new Error('Firmware-update niet gevonden');
      if (FINAL_STATES.has(job.state)) return publicJob(job);
      if (!job.cancelAllowed || job.committed) throw new Error('De update wordt al gecontroleerd en kan nu niet veilig stoppen');
      job.cancelRequested = true;
      updateJob(job, { detail: 'Annuleren wordt veilig afgerond' });
      return publicJob(job);
    }

    function onDisconnected() {
      rejectWaiters(new Error(currentJob()?.committed ? 'OTA_REBOOT_DISCONNECT' : 'Bluetooth disconnected'));
    }

    async function handle(path, body = {}) {
      const failure = (statusCode, error) => ({
        status: statusCode,
        body: { ok: false, error: String(error?.message || error) },
      });
      if (path === '/api/firmware/catalog') {
        try { return { status: 200, body: await catalogue() }; }
        catch (error) { return failure(500, error); }
      }
      if (path === '/api/firmware/refresh') {
        try { return { status: 200, body: { ok: true, receiver: await refresh(body.rid) } }; }
        catch (error) {
          return failure(/niet gevonden/.test(String(error?.message || error)) ? 404 : 409, error);
        }
      }
      if (path === '/api/firmware/start') {
        try {
          return { status: 202, body: { ok: true, job: await start(body.rid, body.artifactId, body.development === true) } };
        } catch (error) {
          const conflict = /loopt al|rechtstreeks/.test(String(error?.message || error));
          return failure(conflict ? 409 : 400, error);
        }
      }
      if (path === '/api/firmware/status') {
        try { return { status: 200, body: { ok: true, job: status(body.jobId) } }; }
        catch (error) { return failure(404, error); }
      }
      if (path === '/api/firmware/cancel') {
        try { return { status: 200, body: { ok: true, job: cancel(body.jobId) } }; }
        catch (error) { return failure(409, error); }
      }
      return { status: 404, body: { ok: false, error: 'Onbekende firmwareactie' } };
    }

    return Object.freeze({
      handle,
      onDisconnected,
      get busy() { return Boolean(activeJobId); },
      get activeJobId() { return activeJobId; },
    });
  }

  Object.defineProperty(window, 'createAluvisionDirectOta', {
    configurable: false,
    enumerable: false,
    writable: false,
    value: createController,
  });
})();
