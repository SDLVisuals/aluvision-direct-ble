/*
 * Transport-aware OTA controller for the exact Aluvision browser UI.
 *
 * This module owns no interface markup. It exposes the same JSON job contract
 * as the local /api/firmware/* backend. The private receiver Wi-Fi is the
 * normal path; direct BLE is retained only as a hidden recovery path.
 */
(() => {
  'use strict';

  const UUIDS = Object.freeze({
    service: '8f0d1100-8b2b-4ca3-a9d5-8a39aaf11700',
    control: '8f0d1104-8b2b-4ca3-a9d5-8a39aaf11700',
    data: '8f0d1105-8b2b-4ca3-a9d5-8a39aaf11700',
    status: '8f0d1106-8b2b-4ca3-a9d5-8a39aaf11700',
  });
  const LOCAL_CATALOG_URL = './firmware/catalog.json';
  const REMOTE_CATALOG_URL = 'https://sdlvisuals.github.io/aluvision-direct-ble/firmware/catalog.json';
  const REMOTE_CATALOG_ORIGIN = 'https://sdlvisuals.github.io';
  const WIRE_VERSION = 1;
  const DATA_MAGIC = 0x3141544F;
  const DATA_BYTES = 128;
  const HTTP_DATA_BYTES = 4096;
  const DATA_RETRIES = 2;
  const MIN_RELIABLE_CAPACITY = 64 * 1024;
  const FINAL_STATES = new Set(['completed', 'failed', 'cancelled']);
  const JOB_STORAGE_KEY = 'aluvision.ota.jobs.v2';
  const MAX_PERSISTED_JOBS = 12;
  const CHECKPOINT_INTERVAL_MS = 750;
  const MAX_CATALOG_ARTIFACTS = 32;
  const MAX_APPLICATION_IMAGE_BYTES = 8 * 1024 * 1024;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  // Trust boundary for future updates:
  // - an immutable catalogue embedded in the installed receiver firmware; or
  // - the pinned HTTPS GitHub Pages origin controlled by Aluvision.
  // Every entry is still constrained to an exact product profile and is
  // verified again by size, SHA-256 and its identity marker before streaming.
  // This lets a current receiver accept a later signed-off patch release
  // without having to hard-code that future binary's hash in today's app.
  const TRUSTED_PROFILES = Object.freeze({
    SPI: Object.freeze({
      receiverType: 'SPI', model: 'ALV-SPI-SK6812', board: 'ESP32S3',
      minVersion: '18.18.0', variants: Object.freeze(['NFC_ONLY']),
    }),
    RGBW: Object.freeze({
      receiverType: 'RGBW', model: 'ALV-RGBW-DUAL', board: 'ESP32S3',
      minVersion: '18.18.0', variants: Object.freeze(['NFC_ONLY']),
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
    const receiverType = String(raw.receiverType || '').toUpperCase();
    const profile = TRUSTED_PROFILES[receiverType];
    if (!profile) return null;
    const version = String(raw.version || '');
    const variant = String(raw.variant || '').toUpperCase();
    const id = String(raw.id || '').toLowerCase();
    const expectedId = `${receiverType.toLowerCase()}-${version.toLowerCase()}-${variant === 'NFC_ONLY' ? 'nfc' : variant.toLowerCase().replace(/_/g, '-')}`;
    const candidate = {
      id,
      receiverType,
      model: String(raw.model || '').toUpperCase(),
      board: String(raw.board || '').toUpperCase(),
      version,
      variant,
      build: String(raw.build || '').slice(0, 96),
      channel: String(raw.channel || '').toLowerCase(),
      releaseNotes: String(raw.releaseNotes || '').slice(0, 800),
      file: String(raw.file || ''),
      sha256: String(raw.sha256 || '').toLowerCase(),
      size: Number(raw.size || 0),
      identityMarker: String(raw.identityMarker || ''),
      otaWireVersion: Number(raw.otaWireVersion || 0),
      dataPayloadBytes: Number(raw.dataPayloadBytes || 0),
      trusted: raw.trusted === true,
      applicationImage: raw.applicationImage === true,
    };
    const exactProfile = candidate.receiverType === profile.receiverType &&
      candidate.model === profile.model && candidate.board === profile.board &&
      profile.variants.includes(candidate.variant);
    const safeVersion = /^\d+\.\d+\.\d+$/.test(candidate.version) &&
      compareVersions(candidate.version, profile.minVersion) >= 0;
    const safeSize = Number.isSafeInteger(candidate.size) &&
      candidate.size >= MIN_RELIABLE_CAPACITY && candidate.size <= MAX_APPLICATION_IMAGE_BYTES;
    const safeHash = /^[0-9a-f]{64}$/.test(candidate.sha256);
    const safeFile = /^artifacts\/[A-Za-z0-9._-]+\.app\.bin$/.test(String(candidate.file || ''));
    const safeMarker = candidate.identityMarker ===
      `ALUVISION_FW_ID_V1|TYPE=${candidate.receiverType}|MODEL=${candidate.model}|BOARD=${candidate.board}|VERSION=${candidate.version}|VARIANT=${candidate.variant}|END`;
    if (candidate.id !== expectedId || !exactProfile || !safeVersion || !safeSize ||
        !safeHash || !safeFile || !safeMarker || candidate.channel !== 'stable' ||
        candidate.trusted !== true ||
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
    const artifactSources = new Map();
    let catalogueDocument = null;
    let activeJobId = '';
    let wakeLock = null;
    let controlSequence = Math.floor(Date.now() % 900000000) || 1;
    const jobs = new Map();
    let lastCheckpointAt = 0;
    let checkpointTimer = 0;
    const gatt = { control: null, data: null, status: null };
    const stream = { session: 0, buffer: '', queue: [], waiters: [] };
    let activeTransport = 'ble';

    const getBle = dependencies.getBle;
    const getWifiOta = typeof dependencies.getWifiOta === 'function'
      ? dependencies.getWifiOta : () => null;
    const currentJob = () => activeJobId ? jobs.get(activeJobId) : null;
    const publicJob = (job) => clone(job);

    function wifiOta() {
      const adapter = getWifiOta();
      return adapter && adapter.supportsOta === true ? adapter : null;
    }

    function otaUsesWifi() { return activeTransport === 'wifi'; }

    function selectTransport(receiver) {
      const adapter = wifiOta();
      if (adapter && typeof adapter.otaTargetReady === 'function' &&
          adapter.otaTargetReady(receiver?.rid)) {
        activeTransport = 'wifi';
        return activeTransport;
      }
      const ble = getBle();
      if (ble.connected && exactRid(ble.rid) === exactRid(receiver?.rid)) {
        activeTransport = 'ble';
        return activeTransport;
      }
      throw new Error('Verbind tijdelijk met het ALUVISION-netwerk van precies deze receiver en probeer opnieuw.');
    }

    function nextControlId() {
      controlSequence = (controlSequence + 1) % 2147483000 || 1;
      return controlSequence;
    }

    function persistedJob(job) {
      const safe = clone(job);
      delete safe.cancelRequested;
      delete safe.verified;
      return safe;
    }

    function persistJobs(force = false) {
      if (typeof localStorage === 'undefined') return;
      const write = () => {
        checkpointTimer = 0;
        lastCheckpointAt = Date.now();
        try {
          const recent = [...jobs.values()]
            .sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0))
            .slice(0, MAX_PERSISTED_JOBS)
            .map(persistedJob);
          localStorage.setItem(JOB_STORAGE_KEY, JSON.stringify({ schemaVersion: 2, jobs: recent }));
        } catch (_) {}
      };
      const remaining = CHECKPOINT_INTERVAL_MS - (Date.now() - lastCheckpointAt);
      if (force || remaining <= 0) {
        clearTimeout(checkpointTimer);
        write();
      } else if (!checkpointTimer) {
        checkpointTimer = setTimeout(write, remaining);
      }
    }

    function restoreJobs() {
      if (typeof localStorage === 'undefined') return;
      try {
        const saved = JSON.parse(localStorage.getItem(JOB_STORAGE_KEY) || 'null');
        if (Number(saved?.schemaVersion) !== 2 || !Array.isArray(saved.jobs)) return;
        saved.jobs.slice(0, MAX_PERSISTED_JOBS).forEach((raw) => {
          if (!raw || typeof raw !== 'object' || !raw.id || !exactRid(raw.rid)) return;
          const job = { ...raw, cancelRequested: false };
          if (!FINAL_STATES.has(job.state)) {
            job.state = 'failed';
            job.phase = 'interrupted';
            job.cancelAllowed = false;
            job.error = job.committed
              ? 'De update werd onderbroken na de installatie. Verbind opnieuw en controleer de firmwareversie.'
              : 'De update werd onderbroken. Start de update veilig opnieuw.';
            job.detail = 'Onderbroken update hersteld';
            job.updatedAt = Date.now() / 1000;
            job.completedAt = job.updatedAt;
          }
          jobs.set(String(job.id), job);
        });
        persistJobs(true);
      } catch (_) {}
    }

    function updateJob(job, changes) {
      Object.assign(job, changes, { updatedAt: Date.now() / 1000 });
      persistJobs(FINAL_STATES.has(job.state) || changes?.committed === true);
      return job;
    }

    restoreJobs();

    function validateCatalogue(raw, sourceUrl) {
      if (Number(raw?.schemaVersion) !== 1 || !Array.isArray(raw?.artifacts) ||
          raw.artifacts.length < 1 || raw.artifacts.length > MAX_CATALOG_ARTIFACTS) {
        throw new Error('Onbekende firmwarecatalogusversie');
      }
      const suppliedIds = raw.artifacts.map((item) => String(item?.id || '').toLowerCase());
      if (new Set(suppliedIds).size !== suppliedIds.length) {
        throw new Error('Firmwarecatalogus bevat dubbele releases');
      }
      const checked = raw.artifacts.map(validateArtifact);
      if (checked.some((item) => !item)) {
        throw new Error('Firmwarecatalogus bevat een niet-vertrouwde release');
      }
      artifactSources.clear();
      checked.forEach((artifact) => artifactSources.set(artifact.id, sourceUrl));
      return checked;
    }

    async function fetchCatalogue(url, timeout, remote) {
      const resolved = new URL(url, location.href);
      if (remote && (resolved.protocol !== 'https:' || resolved.origin !== REMOTE_CATALOG_ORIGIN)) {
        throw new Error('Ongeldige firmwarecataloguslocatie');
      }
      const response = await withTimeout(dependencies.nativeFetch(resolved, {
        cache: 'no-store',
        credentials: resolved.origin === location.origin ? 'same-origin' : 'omit',
        mode: resolved.origin === location.origin ? 'same-origin' : 'cors',
      }), timeout, 'Firmwarecatalogus timeout');
      if (!response.ok) throw new Error(`Firmwarecatalogus niet beschikbaar (${response.status})`);
      const raw = await response.json();
      return { raw, resolved };
    }

    async function loadCatalogue(force = false) {
      if (catalogueDocument && !force) return catalogueDocument;
      let loaded;
      let source = 'embedded';
      try {
        loaded = await fetchCatalogue(REMOTE_CATALOG_URL, 3500, true);
        source = 'online';
      } catch (_) {
        loaded = await fetchCatalogue(LOCAL_CATALOG_URL, 3500, false);
      }
      artifacts = validateCatalogue(loaded.raw, loaded.resolved.href);
      catalogueDocument = {
        schemaVersion: 1,
        generatedAt: String(loaded.raw.generatedAt || ''),
        loadedAt: Date.now() / 1000,
        source,
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
          reason = 'Controleer de updateruimte via de installatiecontroller';
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

    function assertReceiverIdentity(info, receiver, artifact = null) {
      const expectedRid = exactRid(receiver?.rid);
      const expectedType = String(artifact?.receiverType || receiver?.receiverType || '').toUpperCase();
      const expectedModel = String(artifact?.model || receiver?.model || '').toUpperCase();
      const expectedBoard = String(artifact?.board || receiver?.board || '').toUpperCase();
      const actualRid = exactRid(info?.RID);
      const actualType = String(info?.DEVTYPE || '').toUpperCase();
      const actualModel = String(info?.MODEL || '').toUpperCase();
      const actualBoard = String(info?.BOARD || '').toUpperCase();
      if (!expectedRid || actualRid !== expectedRid || !['SPI', 'RGBW'].includes(actualType) ||
          actualType !== expectedType || !actualModel || (expectedModel && actualModel !== expectedModel) ||
          !actualBoard || (expectedBoard && actualBoard !== expectedBoard)) {
        throw new Error('OTA_PROFILE');
      }
      // Deliberately do not inspect PHYSICAL: it is a configurable saved value,
      // not a hardware-detectable strip length or firmware compatibility field.
      return { rid: actualRid, receiverType: actualType, model: actualModel, board: actualBoard };
    }

    async function catalogue() {
      const catalog = await loadCatalogue();
      const recentJobs = [...jobs.values()]
        .sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0))
        .slice(0, 5)
        .map(publicJob);
      return {
        ok: true,
        ...catalog,
        receivers: dependencies.listReceivers().map(releaseFor),
        activeJobId,
        recentJobs,
      };
    }

    async function optionalCharacteristic(service, uuid) {
      try { return await service.getCharacteristic(uuid); } catch (_) { return null; }
    }

    async function ensureOtaCharacteristics() {
      if (otaUsesWifi()) {
        const adapter = wifiOta();
        if (!adapter || typeof adapter.otaBegin !== 'function' ||
            typeof adapter.otaData !== 'function' || typeof adapter.otaStatus !== 'function') {
          throw new Error('OTA_CAPACITY_UNKNOWN');
        }
        return;
      }
      const ble = getBle();
      if (!ble.connected || !ble.server) throw new Error('Open eerst de beveiligde updateverbinding met deze receiver');
      const service = await ble.server.getPrimaryService(UUIDS.service);
      [gatt.control, gatt.data, gatt.status] = await Promise.all([
        optionalCharacteristic(service, UUIDS.control),
        optionalCharacteristic(service, UUIDS.data),
        optionalCharacteristic(service, UUIDS.status),
      ]);
      if (!gatt.control || !gatt.data || !gatt.status) throw new Error('OTA_CAPACITY_UNKNOWN');
    }

    async function readInfo() {
      if (otaUsesWifi()) {
        const adapter = wifiOta();
        if (!adapter || typeof adapter.otaInfo !== 'function') {
          throw new Error('OTA_TARGET_CONNECTION_REQUIRED');
        }
        return adapter.otaInfo();
      }
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
      if (!receiver) throw new Error('Receiver niet gevonden');
      selectTransport(receiver);
      const info = await readInfo();
      assertReceiverIdentity(info, receiver);
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
          : Promise.reject(new Error('Beveiligd updateschrijven ontbreekt'));
      await withTimeout(operation, timeout, 'Updateschrijven timeout');
    }

    async function postOtaControl(kind, message, timeout = 10000) {
      if (!otaUsesWifi()) {
        await writeWithResponse(gatt.control, encoder.encode(message), timeout);
        return;
      }
      const adapter = wifiOta();
      const handler = kind === 'begin' ? adapter?.otaBegin
        : kind === 'commit' ? adapter?.otaCommit : adapter?.otaAbort;
      if (typeof handler !== 'function') throw new Error('OTA_CAPACITY_UNKNOWN');
      const queued = await withTimeout(handler.call(adapter, message), timeout, 'Updateschrijven timeout');
      const status = Number(queued?.status || 0);
      const fields = queued?.fields || queued || {};
      if (![200, 202].includes(status) || String(fields.STATUS || '').toUpperCase() === 'ERROR') {
        throw new Error(fields.DETAIL || 'Receiver weigerde de updateopdracht');
      }
    }

    async function postOtaData(frame, timeout = 12000) {
      if (!otaUsesWifi()) {
        await writeWithResponse(gatt.data, frame, timeout);
        return;
      }
      const adapter = wifiOta();
      if (!adapter || typeof adapter.otaData !== 'function') throw new Error('OTA_CAPACITY_UNKNOWN');
      const queued = await withTimeout(adapter.otaData(frame), timeout, 'Updateblok timeout');
      const status = Number(queued?.status || 0);
      const fields = queued?.fields || queued || {};
      if (![200, 202].includes(status) || String(fields.STATUS || '').toUpperCase() === 'ERROR') {
        throw new Error(fields.DETAIL || 'Receiver weigerde het updateblok');
      }
    }

    async function readWifiOtaStatus(timeout = 3500) {
      const adapter = wifiOta();
      if (!adapter || typeof adapter.otaStatus !== 'function') throw new Error('OTA_TARGET_CONNECTION_REQUIRED');
      return withTimeout(adapter.otaStatus(timeout), timeout + 250, 'OTA-status timeout');
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
      if (otaUsesWifi()) {
        const acceptedStatuses = new Set(accepted.map((value) => String(value).toUpperCase()));
        return (async () => {
          const deadline = Date.now() + timeout;
          let waitMs = 18;
          while (Date.now() < deadline) {
            const result = await readWifiOtaStatus(Math.min(3500, Math.max(400, deadline - Date.now())));
            const fields = result?.fields || result || {};
            const httpStatus = Number(result?.status || 200);
            const status = String(fields.STATUS || '').toUpperCase();
            if (httpStatus === 202 || status === 'QUEUED' || !status) {
              await delay(waitMs);
              waitMs = Math.min(90, Math.round(waitMs * 1.45));
              continue;
            }
            if (Number(fields.V || 0) !== WIRE_VERSION ||
                String(fields.SESSION || '').toUpperCase() !== sessionHex(session)) {
              await delay(waitMs);
              continue;
            }
            if (status === 'ERROR' || status === 'ABORTED') {
              throw new Error(`Receiver weigerde de update: ${fields.DETAIL || status}`);
            }
            if (expectedNext !== null && status === 'NEXT') {
              const next = Number(fields.NEXT);
              if (!Number.isFinite(next) || next > expectedNext) {
                throw new Error('Receiver bevestigde een onverwachte OTA-offset');
              }
              if (next < expectedNext) {
                await delay(waitMs);
                continue;
              }
              return fields;
            }
            if (acceptedStatuses.has(status)) return fields;
            await delay(waitMs);
          }
          throw new Error('Geen OTA-bevestiging ontvangen');
        })();
      }
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
      if (otaUsesWifi()) return;
      gatt.status.removeEventListener('characteristicvaluechanged', onOtaStatus);
      gatt.status.addEventListener('characteristicvaluechanged', onOtaStatus);
      await withTimeout(gatt.status.startNotifications(), 5000, 'OTA notifications timeout');
    }

    async function stopNotifications() {
      if (otaUsesWifi()) return;
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
      const maximum = otaUsesWifi() ? HTTP_DATA_BYTES : DATA_BYTES;
      if (!(payload instanceof Uint8Array) || !payload.length || payload.length > maximum) {
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
        const fields = otaUsesWifi()
          ? ((await readWifiOtaStatus(2500))?.fields || {})
          : dependencies.parseFields(textOf(await withTimeout(
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
          await postOtaData(frame, otaUsesWifi() ? 12000 : 9000);
          await waitForStatus(session, ['NEXT'], 9000, expectedNext);
          return expectedNext;
        } catch (error) {
          const message = String(error?.message || error);
          const transportAvailable = otaUsesWifi()
            ? Boolean(wifiOta()?.otaTargetReady?.(job.rid)) : Boolean(getBle().connected);
          if (!/bevestiging|timeout|disconnected|verbinding|GATT|antwoord|blok/i.test(message) || !transportAvailable) throw error;
          const checkpoint = await readCheckpoint(session);
          if (checkpoint === expectedNext) return expectedNext;
          if (checkpoint !== null && checkpoint > expectedNext) {
            throw new Error('Receiver rapporteerde een onverwachte OTA-offset');
          }
          if (attempt >= DATA_RETRIES) throw error;
          updateJob(job, { detail: `Updatebevestiging opnieuw vragen (${attempt + 1}/${DATA_RETRIES})` });
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

    function sha256Fallback(bytes) {
      const constants = new Uint32Array([
        0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
        0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
        0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
        0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
        0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
        0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
        0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
        0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
      ]);
      const initial = new Uint32Array([
        0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,
        0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19
      ]);
      const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
      const padded = new Uint8Array(paddedLength);
      padded.set(bytes);
      padded[bytes.length] = 0x80;
      const bitLength = bytes.length * 8;
      const tail = new DataView(padded.buffer);
      tail.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
      tail.setUint32(paddedLength - 4, bitLength >>> 0, false);
      const words = new Uint32Array(64);
      const rotateRight = (value, count) => (value >>> count) | (value << (32 - count));
      for (let offset = 0; offset < paddedLength; offset += 64) {
        const view = new DataView(padded.buffer, offset, 64);
        for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(index * 4, false);
        for (let index = 16; index < 64; index += 1) {
          const a = words[index - 15];
          const b = words[index - 2];
          const s0 = rotateRight(a, 7) ^ rotateRight(a, 18) ^ (a >>> 3);
          const s1 = rotateRight(b, 17) ^ rotateRight(b, 19) ^ (b >>> 10);
          words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
        }
        let [a,b,c,d,e,f,g,h] = initial;
        for (let index = 0; index < 64; index += 1) {
          const s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
          const choice = (e & f) ^ (~e & g);
          const t1 = (h + s1 + choice + constants[index] + words[index]) >>> 0;
          const s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
          const majority = (a & b) ^ (a & c) ^ (b & c);
          const t2 = (s0 + majority) >>> 0;
          h=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0;
        }
        initial[0]=(initial[0]+a)>>>0; initial[1]=(initial[1]+b)>>>0;
        initial[2]=(initial[2]+c)>>>0; initial[3]=(initial[3]+d)>>>0;
        initial[4]=(initial[4]+e)>>>0; initial[5]=(initial[5]+f)>>>0;
        initial[6]=(initial[6]+g)>>>0; initial[7]=(initial[7]+h)>>>0;
      }
      return Array.from(initial, (value) => value.toString(16).padStart(8, '0')).join('');
    }

    async function sha256Hex(bytes) {
      if (crypto?.subtle?.digest) {
        try {
          return Array.from(
            new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
            (byte) => byte.toString(16).padStart(2, '0')
          ).join('');
        } catch (_) {}
      }
      return sha256Fallback(bytes);
    }

    async function firmwareBytes(artifact) {
      const trusted = validateArtifact(artifact);
      if (!trusted) throw new Error('Ongeldige of niet-vertrouwde firmwarecatalogus');
      const catalogUrl = new URL(artifactSources.get(trusted.id) || LOCAL_CATALOG_URL, location.href);
      const firmwareUrl = new URL(trusted.file, catalogUrl);
      const trustedOrigin = firmwareUrl.origin === location.origin ||
        (firmwareUrl.protocol === 'https:' && firmwareUrl.origin === REMOTE_CATALOG_ORIGIN);
      if (!trustedOrigin || firmwareUrl.origin !== catalogUrl.origin || !firmwareUrl.pathname.endsWith('.app.bin')) {
        throw new Error('Ongeldige firmwarelocatie');
      }
      const response = await dependencies.nativeFetch(firmwareUrl, {
        cache: 'no-store',
        credentials: firmwareUrl.origin === location.origin ? 'same-origin' : 'omit',
        mode: firmwareUrl.origin === location.origin ? 'same-origin' : 'cors',
      });
      if (!response.ok) throw new Error(`Firmware downloaden mislukt (${response.status})`);
      const contentLength = Number(response.headers.get('content-length') || 0);
      if (contentLength && contentLength !== trusted.size) throw new Error('Firmwaregrootte komt niet overeen');
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length !== trusted.size || bytes[0] !== 0xE9) throw new Error('Ongeldige ESP32-applicatiefirmware');
      const digest = await sha256Hex(bytes);
      if (digest !== trusted.sha256) throw new Error('SHA-256 firmwarecontrole mislukt');
      if (!containsBytes(bytes, encoder.encode(trusted.identityMarker))) {
        throw new Error('De firmware-identiteit past niet bij deze receiver');
      }
      return bytes;
    }

    function preflight(info, receiver, artifact) {
      assertReceiverIdentity(info, receiver, artifact);
      if (!['1', 'BLE1', 'HTTP1', 'WIFI1'].includes(String(info.OTA || '').toUpperCase()) ||
          Number(info.OTAV || 0) !== WIRE_VERSION) throw new Error('OTA_CAPACITY_UNKNOWN');
      const capacity = Number(info.OTAMAX || 0);
      if (!Number.isFinite(capacity) || capacity < MIN_RELIABLE_CAPACITY) throw new Error('OTA_CAPACITY_UNKNOWN');
      if (artifact.size > capacity) throw new Error('OTA_TOO_LARGE');
      if (compareVersions(info.FWVER, artifact.version) > 0) throw new Error('Downgrade wordt geweigerd');
    }

    async function abortBeforeCommit(job, receiver) {
      if (!stream.session || job.committed) return;
      if (otaUsesWifi()) {
        if (!wifiOta()?.otaTargetReady?.(receiver.rid)) return;
      } else if (!getBle().connected || !gatt.control) return;
      try {
        await postOtaControl('abort', controlMessage(
          'OTA_ABORT', stream.session, { TARGET: receiver.rid },
        ), 3000);
      } catch (_) {}
    }

    async function reconnectAndVerify(device, receiver, artifact) {
      const deadline = Date.now() + 90000;
      let lastError = new Error('Receiver kwam niet terug na de update');
      await delay(receiver.receiverType === 'RGBW' ? 1800 : 900);
      while (Date.now() < deadline) {
        try {
          let info;
          if (otaUsesWifi()) {
            const adapter = wifiOta();
            if (!adapter) throw new Error('Privéverbinding nog niet beschikbaar');
            if (typeof adapter.connect === 'function') await withTimeout(
              adapter.connect({ interactive: false }), 7000, 'Receiver opnieuw verbinden timeout'
            );
            info = await readInfo();
          } else {
            if (!device.gatt.connected) info = await withTimeout(
              dependencies.attachDevice(device), 7000, 'Receiver opnieuw verbinden timeout',
            );
            else info = await readInfo();
            const ble = getBle();
            ble.rid = exactRid(info.RID);
            ble.receiverType = String(info.DEVTYPE || '').toUpperCase() === 'RGBW' ? 'RGBW' : 'SPI';
          }
          assertReceiverIdentity(info, receiver, artifact);
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
          if (!otaUsesWifi()) {
            try { if (device?.gatt?.connected) device.gatt.disconnect(); } catch (_) {}
            getBle().connected = false;
          }
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
      if (/OTA_TARGET_CONNECTION_REQUIRED/.test(message)) return 'Verbind tijdelijk met het ALUVISION-netwerk van precies deze receiver en probeer opnieuw.';
      if (/disconnected|GATT|timeout|bevestiging|verbinding/i.test(message)) return committed
        ? 'De firmware is verzonden, maar de veilige herstart kon niet worden bevestigd. Verbind de receiver opnieuw om de versie te controleren.'
        : 'De updateverbinding viel weg. Zet de receiver dichtbij en probeer opnieuw.';
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
      updateJob(job, { state: 'running', phase: 'connecting', progress: 1, detail: 'Beveiligde updateverbinding controleren' });
      await acquireWakeLock();
      const device = otaUsesWifi() ? null : getBle().device;
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
          TYPE: 'OTA_ARM', KEY: dependencies.getNetworkKey(), TARGET: receiver.rid,
          DEVTYPE: artifact.receiverType, WINDOWMS: 120000,
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
        await postOtaControl('begin', begin, 10000);
        const ready = await waitForStatus(stream.session, ['READY'], 10000);
        if (Number(ready.NEXT) !== 0) throw new Error('Receiver start de update niet op byte nul');

        let offset = 0;
        updateJob(job, { phase: 'uploading', progress: 3, detail: 'Firmware beveiligd naar de receiver versturen' });
        const blockSize = otaUsesWifi()
          ? Math.min(HTTP_DATA_BYTES, Number(wifiOta()?.otaMaxChunk) || HTTP_DATA_BYTES)
          : DATA_BYTES;
        while (offset < image.length) {
          if (job.cancelRequested) throw new Error('OTA_CANCELLED');
          const payload = image.slice(offset, Math.min(offset + blockSize, image.length));
          offset = await writeBlock(job, stream.session, offset, payload);
          const progress = Math.min(96, 3 + Math.floor(offset * 93 / image.length));
          updateJob(job, { progress, bytesSent: offset, detail: `Firmware versturen · ${progress}%` });
        }

        job.cancelAllowed = false;
        if (job.cancelRequested) throw new Error('OTA_CANCELLED');
        updateJob(job, { phase: 'verifying', progress: 97, bytesSent: image.length, detail: 'Firmware en identiteit controleren', cancelAllowed: false });
        job.committed = true;
        const commit = controlMessage('OTA_COMMIT', stream.session, { TARGET: receiver.rid });
        await postOtaControl('commit', commit, 10000);
        await waitForStatus(stream.session, otaUsesWifi() ? ['VERIFIED', 'REBOOTING'] : ['VERIFIED'], 20000);
        updateJob(job, { phase: 'rebooting', progress: 98, detail: 'Receiver herstart met de nieuwe firmware' });
        if (!otaUsesWifi()) {
          try { await waitForStatus(stream.session, ['REBOOTING'], 4000); } catch (_) {}
        }
        await stopNotifications();
        notifications = false;
        await delay(1200);
        if (!otaUsesWifi()) {
          try { if (device?.gatt?.connected) device.gatt.disconnect(); } catch (_) {}
          getBle().connected = false;
        }

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
      if (!exact || !receiver) throw new Error('Receiver is niet gekoppeld');
      if (!artifact) throw new Error('Firmwareversie staat niet in de lokale catalogus');
      if (artifact.variant === 'TEMP_BLE_PAIRING' && development !== true) throw new Error('Tijdelijke ontwikkelfirmware vereist een expliciete ontwikkelkeuze');
      if (artifact.receiverType !== String(receiver.receiverType || '').toUpperCase()) throw new Error('Firmwaretype komt niet overeen met de receiver');
      selectTransport(receiver);
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
      persistJobs(true);
      activeJobId = job.id;
      void run(job, receiver, artifact);
      return publicJob(job);
    }

    function status(jobId) {
      const requested = String(jobId || '');
      const job = requested ? jobs.get(requested) : [...jobs.values()]
        .sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0))[0];
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
      persistJobs(true);
      return publicJob(job);
    }

    function onDisconnected() {
      if (!otaUsesWifi()) {
        rejectWaiters(new Error(currentJob()?.committed ? 'OTA_REBOOT_DISCONNECT' : 'Updateverbinding verbroken'));
      }
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
          const conflict = /loopt al|updateverbinding/.test(String(error?.message || error));
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
