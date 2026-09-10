/*
 * Aluvision V20 accountless installation recovery client.
 *
 * This module deliberately performs no password cryptography in the browser.
 * Recovery-code verification, key wrapping and snapshot encryption belong to
 * the receiver.  That keeps the flow usable from the receiver's HTTP origin,
 * where iOS does not guarantee SubtleCrypto, and ensures the raw recovery key
 * never enters browser storage.  The browser keeps only a random per-device
 * credential that can be revoked by another trusted device.
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'aluvision.recovery-device.v1';
  const MAX_PLAINTEXT_BYTES = 512 * 1024;
  const MAX_STORED_BYTES = 128 * 1024;
  const SNAPSHOT_REQUEST_MAGIC = 0x41525131;
  const SNAPSHOT_RESPONSE_MAGIC = 0x41525031;
  const SNAPSHOT_PREFIX_BYTES = 60;
  const SNAPSHOT_RESPONSE_BYTES = 20;
  const USER_CODE_MIN = 8;
  const USER_CODE_MAX = 12;
  const RECOVERY_KEY_CHARACTERS = 25;
  const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let bindings = null;
  let uploadTimer = 0;
  let pendingSnapshot = null;
  let statusCache = null;
  let lastError = '';
  let settingsWrapped = false;
  let pendingSetup = null;
  let physicalWaitGeneration = 0;
  let trustedDeviceIds = [];
  let secureContext = null;
  let uploadBusy = false;
  let transportEpoch = 0;
  const CONTEXT_KEY = 'aluvision.recovery-contexts.v1';
  function storedContexts() { try { return JSON.parse(localStorage.getItem(CONTEXT_KEY) || '{}') || {}; } catch (_) { return {}; } }
  function currentNativeRid() { return String(window.AluvisionNativeWifi?.gatewayRid?.() || '').toUpperCase(); }
  function makeSecureContext(session, material, extraCurrent = () => true) {
    const epoch = transportEpoch, mode = window.AluvisionNativeConnection?.mode, context = { session, material, resuming: null, requestBusy: false,
      isCurrent: () => epoch === transportEpoch && ['wifi','bluetooth'].includes(mode) && window.AluvisionNativeConnection?.mode === mode && currentNativeRid() === material.rid && extraCurrent() };
    context.adapter = { isReady: context.isCurrent, recoveryRequest: async (path, options) => {
      if (!context.isCurrent()) throw Object.assign(new Error('Herstelverbinding gewijzigd.'), { code: 'SNAPSHOT_INTERRUPTED' });
      if (context.requestBusy) throw Object.assign(new Error('Een herstelactie wordt nog afgerond.'), { code: 'RECOVERY_BUSY' });
      context.requestBusy=true;
      try {
      if (!context.session?.ownerSessionActive) {
        if (window.AluvisionSecureConnection) {
          await ensureDevice(material);
          const handle = await window.AluvisionSecureConnection.ensure(material.rid,{installationId:material.meshId,isCurrent:context.isCurrent});
          context.session = handle.session;
        } else {
        if (!/^[0-9A-F]{32}$/.test(material.deviceSalt || '')) throw new Error('Voer je installatiepincode in om de back-up te openen.');
        if (!context.resuming) context.resuming = (async () => {
          const resumed = window.AluvisionPinSrp.create(material.rid);
          try {
            await resumed.resume({ ...device, salt: material.deviceSalt }, material.meshId,
              command => window.AluvisionNativeWifi.transact({ V: 18, ...command }, { timeout: 8000 }));
            if (!context.isCurrent()) throw new Error('Herstelverbinding gewijzigd.');
            context.session = resumed;
          } catch (error) { resumed.close(); throw error; }
        })().finally(() => { context.resuming = null; });
        await context.resuming;
        }
      }
      return await context.session.recoveryRequest(path, options, context.isCurrent);
      } finally { context.requestBusy=false; }
    } };
    return context;
  }
  window.addEventListener?.('aluvision-transport-session-changed', () => {
    transportEpoch++; secureContext = null; statusCache = null;
    clearTimeout(uploadTimer);
  });

  function randomHex(bytes) {
    const value = new Uint8Array(bytes);
    crypto.getRandomValues(value);
    if (value.every((item) => item === 0)) value[value.length - 1] = 1;
    return Array.from(value, (item) => item.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  function createRecoveryKey() {
    const random = new Uint8Array(RECOVERY_KEY_CHARACTERS);
    crypto.getRandomValues(random);
    const text = Array.from(random, (value) => CODE_ALPHABET[value % CODE_ALPHABET.length]).join('');
    return text.match(/.{1,5}/g).join('-');
  }

  function normalizeUserCode(value) {
    const clean = String(value || '').replace(/\D/g, '');
    return clean.length >= USER_CODE_MIN && clean.length <= USER_CODE_MAX ? clean : '';
  }

  function normalizeRecoveryKey(value) {
    const clean = String(value || '').toUpperCase().replace(/[^2-9A-HJ-NP-Z]/g, '');
    return clean.length === RECOVERY_KEY_CHARACTERS ? clean.match(/.{1,5}/g).join('-') : '';
  }

  function loadDevice() {
    if (window.webkit?.messageHandlers?.aluvision || window.AluvisionNativeConnection?.available) return null;
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (/^[0-9A-F]{16}$/.test(value?.id || '') && /^[0-9A-F]{64}$/.test(value?.token || '')) {
        return { id: value.id, token: value.token };
      }
    } catch (_) {}
    const value = { id: randomHex(8), token: randomHex(32) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    return value;
  }

  let device = loadDevice();
  async function ensureDevice(material = secureContext?.material) {
    if (!window.webkit?.messageHandlers?.aluvision && !window.AluvisionNativeConnection?.available) return device;
    if (!material) material = storedContexts()[currentNativeRid()];
    if (!material?.meshId || !window.AluvisionSecureConnection?.getDeviceCredentials)
      throw Object.assign(new Error('Voer je installatiepincode in om de beveiligde toestelopslag te openen.'),{code:'RECOVERY_SESSION_REQUIRED'});
    const credentials = await window.AluvisionSecureConnection.getDeviceCredentials(material.meshId);
    if (!/^[0-9A-F]{16}$/.test(credentials?.id||'') || !/^[0-9A-F]{64}$/.test(credentials?.token||'')) throw new Error('De beveiligde toestelopslag is ongeldig.');
    device = {id:credentials.id,token:credentials.token};
    return device;
  }

  function parseFields(text) {
    const fields = {};
    String(text || '').trim().split(';').forEach((part) => {
      const separator = part.indexOf('=');
      if (separator < 1) return;
      const key = part.slice(0, separator).trim().toUpperCase();
      if (/^[A-Z][A-Z0-9_]*$/.test(key)) fields[key] = part.slice(separator + 1).trim();
    });
    return fields;
  }

  function serialiseFields(fields) {
    return Object.entries(fields)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${String(key).toUpperCase()}=${String(value)}`)
      .join(';');
  }

  function hexBytes(value, bytes) {
    if (!new RegExp(`^[0-9A-F]{${bytes * 2}}$`).test(value)) throw new Error('Ongeldige toestelbeveiliging');
    return Uint8Array.from({ length: bytes }, (_, index) => parseInt(value.slice(index * 2, index * 2 + 2), 16));
  }

  function snapshotRequest(action, options = {}, payload = new Uint8Array()) {
    const result = new Uint8Array(SNAPSHOT_PREFIX_BYTES + payload.length);
    const view = new DataView(result.buffer);
    view.setUint32(0, SNAPSHOT_REQUEST_MAGIC, true);
    view.setUint16(4, 2, true);
    view.setUint8(6, action);
    view.setUint8(7, options.encoding === 'gzip' ? 1 : 0);
    result.set(hexBytes(device.id, 8), 8);
    result.set(hexBytes(device.token, 32), 16);
    view.setUint32(48, Math.max(0, Math.trunc(Number(options.revision) || 0)), true);
    view.setUint32(52, Math.max(0, Math.trunc(Number(options.plainLength) || 0)), true);
    view.setUint32(56, payload.length, true);
    result.set(payload, SNAPSHOT_PREFIX_BYTES);
    return result;
  }

  const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

  function gateway() {
    if (secureContext) {
      if (!secureContext.isCurrent()) throw Object.assign(new Error('De herstelverbinding is gewijzigd.'), { code: 'SNAPSHOT_INTERRUPTED' });
      return secureContext.adapter;
    }
    if (window.AluvisionNativeConnection?.available) {
      const record = storedContexts()[currentNativeRid()];
      if (record && ['wifi','bluetooth'].includes(window.AluvisionNativeConnection.mode)) {
        secureContext = makeSecureContext(null, record); return secureContext.adapter;
      }
      throw Object.assign(new Error('Voer je installatiepincode in om de beveiligde back-upverbinding te openen.'), { code: 'RECOVERY_SESSION_REQUIRED' });
    }
    const adapter = window.AluvisionPrivateWifi;
    if (!adapter?.recoveryRequest || !adapter.isReady?.()) throw new Error('Verbind eerst met een receiver.');
    return adapter;
  }

  function credentialHeaders(extra = {}) {
    /* DEVICEID and DEVICETOKEN are already authenticated by the receiver from
       the request body. Keeping them out of custom headers avoids an iOS/
       Safari private-network preflight that the receiver cannot approve. */
    return { ...extra };
  }

  async function controlOnce(action, fields = {}, timeout = 15000) {
    await ensureDevice();
    const result = await gateway().recoveryRequest('/alv/recovery/control', {
      method: 'POST',
      timeout,
      headers: credentialHeaders({ 'Content-Type': 'text/plain; charset=utf-8' }),
      body: serialiseFields({ V: 1, ACTION: action, DEVICEID: device.id, DEVICETOKEN: device.token, ...fields })
    });
    const response = parseFields(result.text);
    response.httpStatus = result.status;
    return response;
  }

  async function control(action, fields = {}, timeout = 15000) {
    const started = performance.now();
    let response = await controlOnce(action, fields, timeout);
    while (response.DETAIL === 'PENDING' && response.JOB) {
      if (performance.now() - started >= timeout) throw new Error('Herstelactie duurde te lang');
      await delay(240);
      response = await controlOnce('JOB_STATUS', { JOB: response.JOB }, Math.min(4000, timeout));
    }
    return response;
  }

  async function getStatus(force = false) {
    if (!force && statusCache && Date.now() - statusCache.checkedAt < 2500) return statusCache;
    try {
      await ensureDevice();
      const result = await gateway().recoveryRequest('/alv/recovery/status', {
        method: 'POST',
        timeout: 3500,
        headers: credentialHeaders({ 'Content-Type': 'text/plain; charset=utf-8' }),
        body: serialiseFields({ V: 1, ACTION: 'STATUS', DEVICEID: device.id, DEVICETOKEN: device.token })
      });
      const fields = parseFields(result.text);
      statusCache = {
        available: fields.RECOVERY === '1',
        configured: fields.CONFIGURED === '1',
        trusted: fields.TRUSTED === '1',
        physical: fields.PHYSICAL === '1',
        revision: Math.max(0, Number(fields.REVISION) || 0),
        replicas: Math.max(0, Number(fields.REPLICAS) || 0),
        trustedDevices: Math.max(0, Number(fields.DEVICES) || 0),
        lockSeconds: Math.max(0, Number(fields.RETRYAFTER) || 0),
        checkedAt: Date.now()
      };
      lastError = '';
      return statusCache;
    } catch (error) {
      lastError = String(error?.message || error);
      return { available: false, configured: false, trusted: false, checkedAt: Date.now(), error: lastError };
    }
  }

  async function compress(bytes) {
    if (typeof CompressionStream !== 'function') return { bytes, encoding: 'identity' };
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
    return { bytes: new Uint8Array(await new Response(stream).arrayBuffer()), encoding: 'gzip' };
  }

  async function decompress(bytes, encoding) {
    if (encoding !== 'gzip') return bytes;
    if (typeof DecompressionStream !== 'function') throw new Error('Deze browser kan de gecomprimeerde back-up niet openen.');
    const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
    const chunks = []; let size = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        size += value.length;
        if (size > MAX_PLAINTEXT_BYTES) throw new Error('De herstelde installatie is te groot.');
        chunks.push(value);
      }
    } catch (error) { await reader.cancel().catch(() => {}); throw error; }
    const result = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
    return result;
  }

  async function encodeSnapshot(state) {
    const plain = encoder.encode(JSON.stringify(state));
    if (plain.length > MAX_PLAINTEXT_BYTES) throw new Error('De installatieback-up is groter dan 512 KiB. Verwijder ongebruikte Studio-ontwerpen.');
    const packed = await compress(plain);
    if (packed.bytes.length > MAX_STORED_BYTES) throw new Error('De gecomprimeerde installatieback-up is groter dan 128 KiB.');
    return { ...packed, plainLength: plain.length };
  }

  async function uploadSnapshot(state, revision) {
    await ensureDevice();
    const epoch = transportEpoch, context = secureContext;
    if (context && window.AluvisionSecureConnection?.store) {
      const access=await window.AluvisionSecureConnection.store.load(context.material.meshId);
      if (!access || access.configurationAccess==='remote-pending' || access.pendingRelease)
        throw Object.assign(new Error('Laad eerst de bestaande inrichting. De back-up op je receiver is niet vervangen.'),{code:'SNAPSHOT_REMOTE_PENDING'});
    }
    if (context) state = window.AluvisionConfigurationSnapshot.create(state, {
      installationId: context.material.meshId, mainReceiverId: context.material.rid, revision
    });
    const packed = await encodeSnapshot(state);
    if (epoch !== transportEpoch || context && !context.isCurrent()) throw new Error('Back-up onderbroken door een andere verbinding.');
    const framed = snapshotRequest(1, {
      revision,
      encoding: packed.encoding,
      plainLength: packed.plainLength
    }, packed.bytes);
    let result = await gateway().recoveryRequest('/alv/recovery/snapshot', {
      method: 'POST',
      timeout: 20000,
      headers: credentialHeaders({ 'Content-Type': 'application/octet-stream' }),
      body: framed
    });
    let fields = parseFields(result.text);
    const deadline = Date.now() + 30000;
    while (fields.DETAIL === 'PENDING' && fields.JOB) {
      if (Date.now() >= deadline || epoch !== transportEpoch) throw new Error('De receiver heeft de back-up nog niet bevestigd.');
      await delay(240);
      fields = await controlOnce('JOB_STATUS', { JOB: fields.JOB }, 5000);
    }
    if (fields.STATUS !== 'OK') throw new Error(fields.DETAIL || 'Back-up werd niet bevestigd');
    statusCache = null;
    return fields;
  }

  async function downloadSnapshot() {
    await ensureDevice();
    const result = await gateway().recoveryRequest('/alv/recovery/snapshot', {
      method: 'POST',
      timeout: 15000,
      headers: credentialHeaders({ Accept: 'application/octet-stream', 'Content-Type': 'application/octet-stream' }),
      body: snapshotRequest(2)
    });
    if (result.bytes.length < SNAPSHOT_RESPONSE_BYTES) throw new Error('De receiver stuurde geen geldige back-up.');
    const header = new DataView(result.bytes.buffer, result.bytes.byteOffset, SNAPSHOT_RESPONSE_BYTES);
    if (header.getUint32(0, true) !== SNAPSHOT_RESPONSE_MAGIC || header.getUint16(4, true) !== 2 || header.getUint8(6) !== 2) {
      throw new Error('De receiver stuurde geen geldige back-up.');
    }
    if (header.getUint8(7) > 1) throw new Error('Onbekende back-upcodering.');
    const encoding = header.getUint8(7) === 1 ? 'gzip' : 'identity';
    const revision = header.getUint32(8, true);
    const expectedPlain = header.getUint32(12, true);
    const payloadBytes = header.getUint32(16, true);
    if (!expectedPlain || expectedPlain > MAX_PLAINTEXT_BYTES || !payloadBytes || payloadBytes > MAX_STORED_BYTES || result.bytes.length !== SNAPSHOT_RESPONSE_BYTES + payloadBytes) {
      throw new Error('De ontvangen back-up heeft een ongeldige grootte.');
    }
    const plain = await decompress(result.bytes.subarray(SNAPSHOT_RESPONSE_BYTES), encoding);
    if (plain.length > MAX_PLAINTEXT_BYTES) throw new Error('De herstelde installatie is te groot.');
    if (expectedPlain && plain.length !== expectedPlain) throw new Error('De herstelde installatie is onvolledig.');
    let state;
    try { state = JSON.parse(decoder.decode(plain)); }
    catch (_) { throw new Error('De herstelde installatie is beschadigd.'); }
    const snapshot = window.AluvisionConfigurationSnapshot.validate(state, secureContext ? {
      installationId: secureContext.material.meshId
    } : {});
    if (snapshot.revision !== revision) throw new Error('De versie van de back-up komt niet overeen.');
    return { state: snapshot.state, snapshot, revision };
  }

  function queueSnapshot(state, revision) {
    try { pendingSnapshot = { state: window.AluvisionConfigurationSnapshot.boundedClone(state, true), revision, epoch: transportEpoch }; }
    catch (error) { lastError = String(error?.message || error); return; }
    clearTimeout(uploadTimer);
    uploadTimer = setTimeout(flushSnapshot, 1400);
  }
  async function flushSnapshot() {
      if (uploadBusy || !pendingSnapshot) return;
      const pending = pendingSnapshot; uploadBusy = true;
      try {
        const status = await getStatus(true);
        if (pending.epoch !== transportEpoch) return;
        if (!status.configured || !status.trusted) throw new Error('De back-up is nog niet veilig op de hoofdreceiver opgeslagen.');
        const baseline = Number(secureContext?.material.snapshotRevision) || 0;
        if (secureContext && status.revision !== baseline) throw Object.assign(new Error('Een ander toestel heeft een nieuwere inrichting opgeslagen. Laad eerst de nieuwste back-up.'), { code: 'SNAPSHOT_STALE' });
        const nextRevision = secureContext ? baseline + 1 : pending.revision;
        await uploadSnapshot(pending.state, nextRevision);
        if (secureContext) {
          secureContext.material.snapshotRevision = nextRevision;
          const contexts = storedContexts(); contexts[secureContext.material.rid] = secureContext.material;
          localStorage.setItem(CONTEXT_KEY, JSON.stringify(contexts));
        }
        if (pendingSnapshot === pending) pendingSnapshot = null;
        lastError = '';
      } catch (error) {
        lastError = String(error?.message || error);
      } finally { uploadBusy = false; }
      if (pendingSnapshot && pendingSnapshot !== pending) uploadTimer = setTimeout(flushSnapshot, 250);
  }

  async function openOwnerSession(session, material, isCurrent = () => true) {
    if (!['wifi','bluetooth'].includes(window.AluvisionNativeConnection?.mode) || typeof session?.recoveryRequest !== 'function')
      throw Object.assign(new Error('Verbind via Wi-Fi of Bluetooth met de hoofdreceiver. De app wisselt niet automatisch van verbinding.'), { code: 'RECOVERY_TRANSPORT_REQUIRED' });
    await ensureDevice(material);
    const epoch = transportEpoch;
    secureContext = makeSecureContext(session, material, isCurrent);
    statusCache = null;
    const reply = parseFields(await session.ownerCommand('RECOVERY_ENROLL', serialiseFields({ DEVICEID: device.id, DEVICETOKEN: device.token }),
      command => window.AluvisionNativeWifi.transact({ V: 18, ...command }, { timeout: 10000 })));
    let result = reply;
    const deadline = Date.now() + 15000;
    while (result.DETAIL === 'PENDING' && result.JOB) {
      if (!isCurrent() || epoch !== transportEpoch || Date.now() >= deadline) throw Object.assign(new Error('Herstelregistratie onderbroken.'), { code: 'SNAPSHOT_INTERRUPTED' });
      await delay(150); result = await controlOnce('JOB_STATUS', { JOB: result.JOB });
    }
    if (result.STATUS !== 'OK') throw new Error('Deze telefoon kon niet veilig voor de back-up worden geregistreerd.');
    const status = await getStatus(true);
    if (!status.configured || !status.trusted || !isCurrent()) throw new Error('De hoofdreceiver bevestigde de herstelregistratie niet.');
    const publicDevice = parseFields(await session.ownerCommand('RECOVERY_DEVICE', 'DEVICEID=' + device.id,
      command => window.AluvisionNativeWifi.transact({ V: 18, ...command }, { timeout: 8000 })));
    if (publicDevice.STATUS !== 'OK' || !/^[0-9A-F]{32}$/.test(publicDevice.SALT || '')) throw new Error('De veilige back-upverbinding is niet bevestigd.');
    material.deviceSalt = publicDevice.SALT;
    return status;
  }

  function retainOwnerSession(session, material) {
    const record = { rid: material.rid, meshId: material.meshId, receiverType: material.receiverType,
      number: material.number, role: 'MAIN', deviceSalt: material.deviceSalt, snapshotRevision: Number(material.snapshotRevision) || 0 };
    const contexts = storedContexts(); contexts[record.rid] = record;
    localStorage.setItem(CONTEXT_KEY, JSON.stringify(contexts));
    secureContext = makeSecureContext(session, record);
    if (bindings?.getState) queueSnapshot(bindings.getState(), bindings.getRevision?.() || 1);
  }

  async function restoreOwnerSnapshot(session, material, options = {}) {
    const isCurrent = options.isCurrent || (() => true);
    const status = await openOwnerSession(session, material, isCurrent);
    if (!status.revision) throw Object.assign(new Error('Er is nog geen volledige inrichting op deze hoofdreceiver opgeslagen. Je bestaande gegevens zijn niet gewijzigd.'), { code: 'SNAPSHOT_MISSING' });
    const restored = await downloadSnapshot();
    if (!isCurrent()) throw Object.assign(new Error('Herstel geannuleerd.'), { code: 'SNAPSHOT_INTERRUPTED' });
    window.AluvisionConfigurationSnapshot.validate(restored.snapshot, { installationId: material.meshId, minimumRevision: status.revision });
    material.snapshotRevision = restored.revision;
    return restored;
  }

  function applyOwnerSnapshot(restored, options = {}) {
    if (!bindings?.commitSnapshot) throw new Error('Volledig herstel is niet beschikbaar in deze app.');
    return bindings.commitSnapshot(restored.snapshot, options);
  }

  function t(nl, en, fr, de) {
    const lang = String(window.db?.settings?.language || window.db?.language || 'nl').toLowerCase();
    return lang === 'en' ? en : lang === 'fr' ? fr : lang === 'de' ? de : nl;
  }

  function safe(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[character]));
  }

  function show(html) {
    if (typeof window.modal !== 'function') throw new Error('Appvenster niet beschikbaar');
    window.modal(`<section class="v20-recovery">${html}</section>`);
  }

  function physicalCard() {
    return `<div class="v20-recovery-physical"><i>●</i><span><b>${t('Bevestig op de verbonden receiver','Confirm on the connected receiver','Confirmez sur le receiver connecté','Am verbundenen Receiver bestätigen')}</b><small>${t('Houd de fysieke knop 2 seconden ingedrukt. De toestemming blijft 90 seconden open.','Hold the physical button for 2 seconds. Approval remains open for 90 seconds.','Maintenez le bouton physique pendant 2 secondes.','Die physische Taste 2 Sekunden halten.')}</small></span></div>`;
  }

  let existingFlow=null;
  const existingModal=document.getElementById('modal');
  if(existingModal)new MutationObserver(()=>{
    if(!existingModal.hidden||!existingFlow)return;
    const flow=existingFlow;existingFlow=null;
    const input=flow.form?.querySelector('input');if(input)input.value='';
    flow.onCancel?.();
  }).observe(existingModal,{attributes:true,attributeFilter:['hidden']});
  window.addEventListener('aluvision:pin-access-expired',()=>{
    const target=document.querySelector('[data-existing-success="connect"] .v21-existing-target');
    if(target)target.innerHTML='<b>Tijdelijke verbinding verlopen</b><small>Voer je installatie-PIN opnieuw in om verder te bedienen. Je inrichting is niet gewijzigd.</small>';
    window.toast?.('Tijdelijke verbinding verlopen. Open Bestaande installatie verbinden en voer je PIN opnieuw in.');
  });
  function existingError(error){
    const code=String(error?.code||'');
    if(code==='INVALID_PIN')return 'De pincode klopt niet. Probeer opnieuw.';
    if(code==='PIN_LOCKED'||code==='PIN_AUTH_BUSY'){
      const seconds=Math.max(1,Math.ceil(Math.min(3600000,Number(error.retryAfterMs)||2000)/1000));
      return `Wacht ${seconds} seconden en probeer opnieuw.`;
    }
    if(code==='PIN_CHALLENGE_EXPIRED')return 'De pincodecontrole is verlopen. Probeer opnieuw.';
    if(code==='SNAPSHOT_MISSING')return 'Er is geen volledige back-up beschikbaar. Kies Alleen verbinden om toegang te krijgen zonder je inrichting te vervangen.';
    if(code.startsWith('SNAPSHOT_'))return 'Herstellen is onderbroken of de back-up is niet volledig. Je huidige inrichting is niet vervangen.';
    if(code==='PIN_UNSUPPORTED')return 'Deze app of receiver ondersteunt deze beveiligde verbinding nog niet. Controleer de firmwareversie.';
    return 'Niet verbonden. Controleer of je hoofdreceiver bereikbaar is en probeer de bestaande pincode opnieuw.';
  }
  function openExisting(mode='connect',options={}){
    if(window.AluvisionLocalTestMode?.enabled){show(`<h1>PIN tijdelijk uitgeschakeld</h1><p class="sub">${safe(window.AluvisionLocalTestMode.message)}</p><button class="button" onclick="closeModal()">Sluiten</button>`);return;}
    const restore=mode==='restore',provider=window.AluvisionNativeConnection?.securityProvider;
    existingFlow={mode:restore?'restore':'connect',onConnected:options.onConnected,onCancel:options.onCancel};
    const supported=typeof provider?.[restore?'restoreInstallation':'connectExistingInstallation']==='function';
    const target=currentNativeRid();
    show(`<section class="v21-existing-installation" data-preserve-transport-copy data-existing-mode="${restore?'restore':'connect'}">
      <div class="eyebrow">BESTAANDE INSTALLATIE</div>
      <h1>${restore?'Volledige inrichting herstellen':'Bestaande installatie verbinden'}</h1>
      <p class="sub">${restore?'Haal je opgeslagen zones, groepen, LED Lines, instellingen en scènes terug. Dit vervangt de inrichting in deze app.':'Gebruik de PIN die je eerder voor deze installatie hebt gekozen. Je zones, groepen en instellingen worden niet vervangen.'}</p>
      <div class="v21-existing-target"><b>${target?'Hoofdreceiver · '+safe(target.slice(-6)):'Kies eerst je hoofdreceiver'}</b><small>${target?'Verbinding via '+(window.AluvisionNativeConnection?.mode==='bluetooth'?'Bluetooth':'Wi-Fi'):'Verbind via Wi-Fi of Bluetooth. Internet is niet nodig.'}</small></div>
      ${supported&&target?`<form onsubmit="event.preventDefault();AluvisionAccountlessRecovery.submitExisting()"><label class="v21-existing-pin"><b>Bestaande installatie-PIN</b><input id="v21ExistingPin" class="field" type="password" inputmode="numeric" autocomplete="current-password" minlength="8" maxlength="12" placeholder="8–12 cijfers" aria-describedby="v21ExistingHint"></label><p id="v21ExistingHint" class="sub">Dit is niet het Wi-Fi-wachtwoord. Je maakt hier geen nieuwe PIN aan.</p><p data-existing-error role="alert" class="danger-note" hidden></p><button class="button" type="submit" data-existing-submit>${restore?'Volledige inrichting herstellen':'Verbinden met mijn PIN'}</button></form>`:`<p class="danger-note" role="status">${supported?'Maak eerst verbinding met je hoofdreceiver. Open daarna deze optie opnieuw.':'Deze veilige PIN-verbinding is beschikbaar in de iPhone-app met geschikte receiverfirmware.'}</p>${supported?'<button class="button" type="button" onclick="AluvisionAccountlessRecovery.chooseExistingReceiver()">Hoofdreceiver kiezen</button>':''}`}
      <div class="v21-existing-options"><button class="button soft" type="button" onclick="AluvisionAccountlessRecovery.switchExisting('${restore?'connect':'restore'}')">${restore?'Alleen verbinden · niets terugzetten':'Ik wil mijn volledige inrichting terugzetten'}</button><button class="button soft" type="button" onclick="AluvisionAccountlessRecovery.forgotExistingPin()">PIN vergeten?</button><button class="button soft" type="button" onclick="AluvisionAccountlessRecovery.cancelExisting()">Annuleren</button></div>
    </section>`);
    existingFlow.form=document.querySelector('.v21-existing-installation');
    existingFlow.rid=target;
    existingFlow.transport=window.AluvisionNativeConnection?.mode;
  }
  function cancelExisting(){const flow=existingFlow;existingFlow=null;flow?.form?.querySelector('input')&&(flow.form.querySelector('input').value='');window.closeModal?.();flow?.onCancel?.();}
  function switchExisting(mode){const options={onConnected:existingFlow?.onConnected,onCancel:existingFlow?.onCancel};openExisting(mode,options);}
  function chooseExistingReceiver(){existingFlow=null;window.openAddReceiver?.();}
  function forgotExistingPin(){
    const note=existingFlow?.form?.querySelector('[data-existing-error]');
    const message='Gebruik voorlopig een toestel dat al toegang heeft. Herstel met een Recovery Key is nog niet volledig beschikbaar in deze appversie. Reset je receiver niet: daardoor herstel je de PIN niet.';
    if(note){note.hidden=false;note.textContent=message;}else window.toast?.(message);
  }
  async function submitExisting(){
    const flow=existingFlow,form=flow?.form,input=form?.querySelector('#v21ExistingPin'),notice=form?.querySelector('[data-existing-error]');
    if(!form?.isConnected||form.dataset.busy)return;
    const code=normalizeUserCode(input?.value);
    if(!code){if(notice){notice.hidden=false;notice.textContent='Vul je bestaande installatie-PIN van 8 tot 12 cijfers in.';}input?.focus();return;}
    const current=()=>existingFlow===flow&&form.isConnected&&!document.getElementById('modal')?.hidden&&currentNativeRid()===flow.rid&&window.AluvisionNativeConnection?.mode===flow.transport;
    const button=form.querySelector('[data-existing-submit]'),label=button.textContent;
    form.dataset.busy='1';button.disabled=true;button.textContent=flow.mode==='restore'?'Inrichting herstellen…':'PIN controleren…';input.value='';
    if(notice){notice.hidden=true;notice.textContent='';}
    try{
      const provider=window.AluvisionNativeConnection?.securityProvider,method=flow.mode==='restore'?'restoreInstallation':'connectExistingInstallation';
      if(typeof provider?.[method]!=='function')throw Object.assign(new Error('unsupported'),{code:'PIN_UNSUPPORTED'});
      const result=await provider[method](code,{isCurrent:current});
      if(!current())return;
      if(!result?.ok||(flow.mode==='restore'?result.configurationRestored!==true:result.connected!==true||result.configurationRestored!==false))throw Error('unconfirmed');
      if(flow.mode==='connect'&&typeof flow.onConnected==='function'){existingFlow=null;await flow.onConnected(result);return;}
      existingFlow=null;
      show(`<section class="v21-existing-installation" data-existing-success="${flow.mode}"><div class="v20-success">✓</div><h1>${flow.mode==='restore'?'Installatie hersteld':'Verbonden met je installatie'}</h1><p class="sub">${flow.mode==='restore'?'De opgeslagen inrichting is teruggezet. Receivers die niet bereikbaar zijn, blijven zichtbaar.':'Je pincode is door de hoofdreceiver gecontroleerd. Er zijn geen zones, groepen, kleuren of scènes teruggezet.'}</p>${result.trustedDevice===true?'<p class="v21-existing-target"><b>Dit toestel is vertrouwd</b><small>De app verbindt opnieuw zonder je PIN opnieuw te vragen. Bewaar je PIN voor een ander toestel of als je de app opnieuw installeert.</small></p>':result.temporary?'<p class="v21-existing-target"><b>Tijdelijke toegang</b><small>Deze beveiligde sessie duurt maximaal 90 seconden. Daarna voer je de PIN opnieuw in. Een blijvende toestelregistratie vereist werkende beveiligde receiveropslag.</small></p>':''}<button type="button" class="button" onclick="closeModal();go('${flow.mode==='restore'?'home':'devices'}')">${flow.mode==='restore'?'Naar Home':'Naar mijn receivers'}</button><button type="button" class="button soft" onclick="AluvisionAccountlessRecovery.openExisting('connect')">PIN opnieuw invoeren</button></section>`);
    }catch(error){if(current()&&notice){notice.hidden=false;notice.textContent=existingError(error);}}
    finally{delete form.dataset.busy;if(button?.isConnected){button.disabled=false;button.textContent=label;}}
  }

  async function openRecovery() {
    if (window.AluvisionNativeConnection?.available) {
      return openExisting('connect');
    }
    physicalWaitGeneration += 1;
    const status = await getStatus(true);
    if (!status.available) {
      const message = status.error
        ? t('Verbind met je hoofdreceiver via de verbindingspagina en probeer opnieuw. Een extra receiver wordt via zijn hoofdreceiver bediend.','Connect to your main receiver from the connection page, then try again. Additional receivers are controlled through their main receiver.','Connectez-vous au récepteur principal depuis la page de connexion, puis réessayez. Les récepteurs supplémentaires sont pilotés via celui-ci.','Verbinde dich über die Verbindungsseite mit deinem Hauptreceiver und versuche es erneut. Zusätzliche Receiver werden über ihren Hauptreceiver gesteuert.')
        : t('Deze receiverfirmware ondersteunt installatieherstel nog niet. De bestaande verlichting blijft gewoon werken.','This receiver firmware does not support installation recovery yet. Existing lighting keeps working.','Ce firmware ne prend pas encore en charge la récupération.','Diese Firmware unterstützt die Wiederherstellung noch nicht.');
      show(`<button class="button soft" onclick="closeModal()">← ${t('Sluiten','Close','Fermer','Schließen')}</button><h1>${t('Installatieherstel','Installation recovery','Récupération','Wiederherstellung')}</h1><p class="danger-note">${message}</p>`);
      return;
    }
    const state = status.configured
      ? `<span class="scope">${status.trusted ? t('DIT TOESTEL IS VERTROUWD','THIS DEVICE IS TRUSTED','APPAREIL APPROUVÉ','GERÄT VERTRAUT') : t('HERSTELCODE NODIG','RECOVERY CODE NEEDED','CODE REQUIS','CODE ERFORDERLICH')}</span>
         <h1>${t('Je installatie is beschermd','Your installation is protected','Votre installation est protégée','Installation geschützt')}</h1>
         <div class="v20-recovery-stats"><span><b>${status.revision}</b><small>${t('versie','revision','version','Version')}</small></span><span><b>${status.replicas}</b><small>${t('extra back-ups','extra backups','sauvegardes supplémentaires','zusätzliche Backups')}</small></span><span><b>${status.trustedDevices}</b><small>${t('vertrouwde toestellen','trusted devices','appareils approuvés','vertraute Geräte')}</small></span></div>
         <div class="v20-recovery-actions">${status.trusted ? `<button class="button" onclick="AluvisionAccountlessRecovery.restoreTrusted()">${t('Laatste inrichting laden','Load latest setup','Charger la configuration','Letzte Einrichtung laden')}</button><button class="button soft" onclick="AluvisionAccountlessRecovery.openDevices()">${t('Toestellen beheren','Manage devices','Gérer les appareils','Geräte verwalten')}</button><button class="button soft" onclick="AluvisionAccountlessRecovery.openChangeCode()">${t('Herstelcode wijzigen','Change recovery code','Modifier le code','Code ändern')}</button><button class="button soft" onclick="AluvisionAccountlessRecovery.openFactoryReset()">${t('Volledig opnieuw beginnen','Start over completely','Tout recommencer','Vollständig neu beginnen')}</button>` : `<button class="button" onclick="AluvisionAccountlessRecovery.openRestore('code')">${t('Herstellen met mijn code','Restore with my code','Restaurer avec mon code','Mit meinem Code')}</button><button class="button soft" onclick="AluvisionAccountlessRecovery.openRestore('key')">${t('Herstelcode vergeten?','Forgot recovery code?','Code oublié ?','Code vergessen?')}</button>`}</div><p class="sub">${t('De app verwijderen wist deze beveiligde back-up niet. Alleen Volledig opnieuw beginnen wist receivers en inrichting.','Deleting the app does not erase this protected backup. Only Start over completely erases receivers and setup.','Supprimer l’app n’efface pas cette sauvegarde.','Das Löschen der App entfernt dieses Backup nicht.')}</p>`
      : `<span class="scope">${t('EENMALIG INSTELLEN','SET UP ONCE','CONFIGURATION UNIQUE','EINMALIG EINRICHTEN')}</span><h1>${t('Bescherm deze installatie','Protect this installation','Protéger cette installation','Installation schützen')}</h1><p class="sub">${t('Kies zelf een cijfercode. De app maakt daarnaast één lange Recovery Key voor noodgevallen.','Choose your own numeric code. The app also creates one long Recovery Key for emergencies.','Choisissez votre code numérique. Une Recovery Key séparée sera créée.','Wählen Sie einen Zahlencode. Zusätzlich wird ein Recovery Key erstellt.')}</p><button class="button" onclick="AluvisionAccountlessRecovery.openSetup()">${t('Beveiliging instellen','Set up protection','Configurer la protection','Schutz einrichten')}</button>`;
    show(`<button class="button soft" onclick="closeModal()">← ${t('Sluiten','Close','Fermer','Schließen')}</button><div class="v20-recovery-body">${state}</div><p class="v20-recovery-limit">${t('Maximaal 512 KiB vóór compressie · 128 KiB opgeslagen','Maximum 512 KiB before compression · 128 KiB stored','Maximum 512 Kio avant compression','Maximal 512 KiB vor Komprimierung')}</p>`);
  }

  function openSetup() {
    physicalWaitGeneration += 1;
    show(`<button class="button soft" onclick="AluvisionAccountlessRecovery.open()">← ${t('Terug','Back','Retour','Zurück')}</button><span class="scope">${t('JOUW HERSTELCODE','YOUR RECOVERY CODE','VOTRE CODE','IHR CODE')}</span><h1>${t('Kies een code die je onthoudt','Choose a code you remember','Choisissez un code mémorable','Wählen Sie einen merkbaren Code')}</h1><p class="sub">${t('Gebruik 8 tot 12 cijfers. De code en Recovery Key worden nooit in de app opgeslagen.','Use 8 to 12 digits. The code and Recovery Key are never stored in the app.','Utilisez 8 à 12 chiffres.','Verwenden Sie 8 bis 12 Ziffern.')}</p><input id="v20SetupCode" class="field v20-recovery-input" type="password" inputmode="numeric" autocomplete="new-password" maxlength="12" placeholder="8–12 cijfers"><input id="v20SetupCodeAgain" class="field v20-recovery-input" type="password" inputmode="numeric" autocomplete="new-password" maxlength="12" placeholder="${t('Herhaal je code','Repeat your code','Répétez le code','Code wiederholen')}">${physicalCard()}<button class="button" onclick="AluvisionAccountlessRecovery.beginSetup()">${t('Instellen en Recovery Key maken','Set up and create Recovery Key','Configurer et créer la clé','Einrichten und Recovery Key erstellen')}</button>`);
  }

  async function beginSetup() {
    const first = document.getElementById('v20SetupCode')?.value || '';
    const second = document.getElementById('v20SetupCodeAgain')?.value || '';
    const code = normalizeUserCode(first);
    if (!code || first !== second) {
      return window.toast?.(t('Gebruik twee keer dezelfde code van 8 tot 12 cijfers.','Enter the same 8 to 12 digit code twice.','Saisissez deux fois le même code.','Geben Sie denselben Code zweimal ein.'));
    }
    pendingSetup = { code, key: createRecoveryKey() };
    return continueSetup();
  }

  /* Programmatic entry used by the receiver commissioning wizard. Secrets
     exist only in this module's short-lived memory and are never copied into
     pairDraft, the installation database, the URL or browser storage. */
  async function setupInstallation(code = '') {
    if (code) {
      const normalized = normalizeUserCode(code);
      if (!normalized) throw new Error(t('Gebruik een code van 8 tot 12 cijfers.','Use an 8 to 12 digit code.','Utilisez un code de 8 à 12 chiffres.','Verwenden Sie einen Code mit 8 bis 12 Ziffern.'));
      pendingSetup = { code: normalized, key: createRecoveryKey() };
    }
    if (!pendingSetup) throw new Error(t('Kies eerst je herstelcode.','Choose your recovery code first.','Choisissez d’abord votre code.','Wählen Sie zuerst Ihren Wiederherstellungscode.'));
    const result = await control('SETUP', { CODE: pendingSetup.code, KEY: pendingSetup.key });
    if (result.DETAIL === 'PHYSICAL_REQUIRED') return { ok: false, physicalRequired: true };
    if (result.DETAIL === 'PAIRING_REQUIRED') throw new Error(t('Koppel eerst deze receiver aan de installatie.','Pair this receiver with the installation first.','Associez d’abord ce receiver à l’installation.','Koppeln Sie diesen Receiver zuerst mit der Installation.'));
    if (result.STATUS !== 'OK') throw new Error(result.DETAIL || 'Setup failed');
    const recoveryKey = pendingSetup.key;
    pendingSetup = null;
    statusCache = null;
    let snapshotStored = false;
    try {
      if (bindings?.getState) {
        await uploadSnapshot(bindings.getState(), bindings.getRevision?.() || 1);
        snapshotStored = true;
      }
    } catch (error) {
      lastError = String(error?.message || error);
    }
    return { ok: true, recoveryKey, snapshotStored };
  }

  async function continueSetup() {
    if (!pendingSetup) return openSetup();
    try {
      const outcome = await setupInstallation();
      if (outcome.physicalRequired) {
        show(`${physicalCard()}<h1>${t('Bevestig nu op de verbonden receiver','Confirm now on the connected receiver','Confirmez sur le receiver connecté','Jetzt am verbundenen Receiver bestätigen')}</h1><p class="sub">${t('Houd de knop 2 seconden vast en tik daarna op Verder.','Hold the button for 2 seconds, then tap Continue.','Maintenez le bouton 2 secondes puis continuez.','Taste 2 Sekunden halten, dann fortfahren.')}</p><button class="button" onclick="AluvisionAccountlessRecovery.continueSetup()">${t('Verder','Continue','Continuer','Weiter')}</button>`);
        return;
      }
      const recoveryKey = outcome.recoveryKey;
      show(`<span class="scope">${t('EENMALIG ZICHTBAAR','SHOWN ONCE','AFFICHÉE UNE FOIS','EINMALIG SICHTBAR')}</span><h1>Recovery Key</h1><div class="v20-recovery-code">${safe(recoveryKey)}</div><p class="danger-note">${t('Bewaar deze lange sleutel buiten de app. Hiermee kun je herstellen als je jouw gewone code vergeet.','Store this long key outside the app. It restores the setup if you forget your regular code.','Conservez cette clé hors de l’app.','Bewahren Sie diesen Schlüssel außerhalb der App auf.')}</p><button class="button soft" onclick="AluvisionAccountlessRecovery.copyCode('${safe(recoveryKey)}')">${t('Recovery Key kopiëren','Copy Recovery Key','Copier la clé','Recovery Key kopieren')}</button><button class="button" onclick="closeModal()">${t('Ik heb hem veilig bewaard','I stored it safely','Je l’ai conservée','Sicher gespeichert')}</button>`);
    } catch (error) {
      show(`<h1>${t('Nog niet gelukt','Not completed yet','Pas encore terminé','Noch nicht abgeschlossen')}</h1><p class="danger-note">${safe(error?.message || error)}</p>${physicalCard()}<button class="button" onclick="AluvisionAccountlessRecovery.continueSetup()">${t('Opnieuw proberen','Try again','Réessayer','Erneut versuchen')}</button>`);
    }
  }

  function openRestore(method = 'code') {
    if (window.AluvisionNativeConnection?.available) {
      return openExisting('restore');
    }
    physicalWaitGeneration += 1;
    const forgotten = method === 'key';
    show(`<button class="button soft" onclick="AluvisionAccountlessRecovery.open()">← ${t('Terug','Back','Retour','Zurück')}</button><span class="scope">${t('BESTAANDE INSTALLATIE','EXISTING INSTALLATION','INSTALLATION EXISTANTE','BESTEHENDE INSTALLATION')}</span><h1>${forgotten ? t('Herstellen met Recovery Key','Restore with Recovery Key','Restaurer avec la Recovery Key','Mit Recovery Key wiederherstellen') : t('Vul je herstelcode in','Enter your recovery code','Saisissez votre code','Wiederherstellungscode eingeben')}</h1>${forgotten ? `<input id="v20RecoveryKey" class="field v20-recovery-input" inputmode="text" autocomplete="off" autocapitalize="characters" maxlength="29" placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"><p class="sub">${t('Kies meteen een nieuwe gewone code.','Choose a new regular code now.','Choisissez maintenant un nouveau code.','Wählen Sie jetzt einen neuen normalen Code.')}</p><input id="v20NewCode" class="field v20-recovery-input" type="password" inputmode="numeric" autocomplete="new-password" maxlength="12" placeholder="${t('Nieuwe code · 8–12 cijfers','New code · 8–12 digits','Nouveau code · 8–12 chiffres','Neuer Code · 8–12 Ziffern')}"><input id="v20NewCodeAgain" class="field v20-recovery-input" type="password" inputmode="numeric" autocomplete="new-password" maxlength="12" placeholder="${t('Herhaal nieuwe code','Repeat new code','Répétez le nouveau code','Neuen Code wiederholen')}">` : `<input id="v20RecoveryCode" class="field v20-recovery-input" type="password" inputmode="numeric" autocomplete="one-time-code" maxlength="12" placeholder="8–12 cijfers"><button class="button soft" onclick="AluvisionAccountlessRecovery.openRestore('key')">${t('Herstelcode vergeten?','Forgot recovery code?','Code oublié ?','Code vergessen?')}</button>`}<p class="sub">${t('Eerst controleren we je geheim. Pas daarna vraagt de app om de fysieke knop. Foute pogingen krijgen een steeds langere wachttijd.','First we verify your secret. Only then does the app request the physical button. Wrong attempts receive an increasing delay.','Le secret est vérifié avant la confirmation physique.','Zuerst wird das Geheimnis geprüft, danach folgt die physische Bestätigung.')}</p><button class="button" onclick="AluvisionAccountlessRecovery.submitRestore('${forgotten ? 'key' : 'code'}')">${t('Veilig controleren','Verify securely','Vérifier','Sicher prüfen')}</button>`);
  }

  async function submitRestore(method = 'code') {
    if (window.AluvisionNativeConnection?.available) {
      return submitExisting();
    }
    const usingKey = method === 'key';
    const input = document.getElementById(usingKey ? 'v20RecoveryKey' : 'v20RecoveryCode');
    const secret = usingKey ? normalizeRecoveryKey(input?.value) : normalizeUserCode(input?.value);
    const newCodeRaw = document.getElementById('v20NewCode')?.value || '';
    const newCode = usingKey ? normalizeUserCode(newCodeRaw) : '';
    if (!secret || (usingKey && (!newCode || newCodeRaw !== (document.getElementById('v20NewCodeAgain')?.value || '')))) {
      return window.toast?.(usingKey ? t('Controleer de volledige Recovery Key en vul twee keer dezelfde nieuwe code in.','Check the full Recovery Key and enter the same new code twice.','Vérifiez la clé et le nouveau code.','Recovery Key und neuen Code prüfen.') : t('Vul je code van 8 tot 12 cijfers in.','Enter your 8 to 12 digit code.','Saisissez votre code.','Geben Sie Ihren Code ein.'));
    }
    try {
      const result = await control('RESTORE_VERIFY', {
        METHOD: usingKey ? 'KEY' : 'CODE', SECRET: secret,
        NEWCODE: usingKey ? newCode : undefined
      });
      if (result.DETAIL === 'LOCKED') {
        const seconds = Math.max(1, Number(result.RETRYAFTER) || 1);
        throw new Error(t(`Wacht ${seconds} seconden en probeer opnieuw.`,`Wait ${seconds} seconds and try again.`,`Attendez ${seconds} secondes.`,`Warten Sie ${seconds} Sekunden.`));
      }
      if (result.DETAIL === 'PHYSICAL_REQUIRED' && /^[0-9A-F]{16}$/.test(result.PROOF || '')) {
        if (input) input.value = '';
        return waitForPhysicalProof(result.PROOF);
      }
      throw new Error(result.DETAIL === 'INVALID_CODE' ? t('De code klopt niet.','The code is incorrect.','Le code est incorrect.','Der Code ist falsch.') : (result.DETAIL || 'Restore failed'));
    } catch (error) {
      window.toast?.(String(error?.message || error));
    }
  }

  async function waitForPhysicalProof(proof) {
    const generation = ++physicalWaitGeneration;
    show(`<span class="scope">✓ ${t('CODE KLOPT','CODE VERIFIED','CODE CORRECT','CODE BESTÄTIGT')}</span><h1>${t('Bevestig nu fysiek','Now confirm physically','Confirmez physiquement','Jetzt physisch bestätigen')}</h1>${physicalCard()}<p id="v20RecoveryPhysicalState" class="sub">${t('De app wacht op de knop…','The app is waiting for the button…','L’app attend le bouton…','Die App wartet auf die Taste…')}</p><button class="button soft" onclick="AluvisionAccountlessRecovery.confirmProof('${proof}')">${t('Nu controleren','Check now','Vérifier maintenant','Jetzt prüfen')}</button><button class="button soft" onclick="AluvisionAccountlessRecovery.openRestore('code')">${t('Annuleren','Cancel','Annuler','Abbrechen')}</button>`);
    const deadline = Date.now() + 90000;
    while (generation === physicalWaitGeneration && Date.now() < deadline) {
      await delay(500);
      const status = await getStatus(true);
      if (status.physical) return confirmProof(proof, generation);
    }
    if (generation === physicalWaitGeneration) {
      window.toast?.(t('De bevestiging is verlopen. Vul je code opnieuw in.','Confirmation expired. Enter your code again.','La confirmation a expiré.','Bestätigung abgelaufen.'));
      openRestore('code');
    }
  }

  async function confirmProof(proof, generation = physicalWaitGeneration) {
    if (!/^[0-9A-F]{16}$/.test(proof || '') || generation !== physicalWaitGeneration) return;
    const status = await getStatus(true);
    if (!status.physical) return window.toast?.(t('Houd eerst de knop 2 seconden ingedrukt.','First hold the button for 2 seconds.','Maintenez d’abord le bouton.','Taste zuerst 2 Sekunden halten.'));
    try {
      const result = await control('RESTORE_CONFIRM', { PROOF: proof });
      if (result.STATUS !== 'OK') throw new Error(result.DETAIL || 'Restore failed');
      physicalWaitGeneration += 1;
      statusCache = null;
      await restoreTrusted();
    } catch (error) { window.toast?.(String(error?.message || error)); }
  }

  async function restoreTrusted() {
    try {
      const restored = await downloadSnapshot();
      if (!bindings?.applyState) throw new Error('De app kan de inrichting niet toepassen.');
      if (!bindings?.commitSnapshot) throw new Error('Herstel is niet beschikbaar.');
      bindings.commitSnapshot(restored.snapshot, { isCurrent: () => !!secureContext?.isCurrent() });
      if (secureContext) {
        secureContext.material.snapshotRevision = restored.revision;
        retainOwnerSession(secureContext.session, secureContext.material);
      }
      try { await window.discover?.(true); } catch (_) {}
      await delay(250);
      const restoredDevices = Array.isArray(restored.state.devices) ? restored.state.devices : [];
      const expected = new Set(restoredDevices.map((item) => String(item?.id || '')).filter(Boolean));
      const total = restoredDevices.length;
      const reachable = (window.db?.devices || []).filter((item) =>
        item?.online && expected.has(String(item?.id || ''))).length;
      show(`<span class="scope">✓ ${t('INSTALLATIE HERSTELD','INSTALLATION RESTORED','INSTALLATION RESTAURÉE','INSTALLATION WIEDERHERGESTELLT')}</span><h1>${reachable} ${t('van','of','sur','von')} ${total} ${t('receivers bereikbaar','receivers reachable','receivers accessibles','Receiver erreichbar')}</h1><p class="sub">${t('Zones, groepen, scènes en instellingen zijn teruggezet. Niet-bereikbare receivers blijven zichtbaar en verbinden zodra ze weer beschikbaar zijn.','Zones, groups, scenes and settings were restored. Unreachable receivers remain visible and reconnect when available.','Les zones, groupes et scènes sont restaurés.','Zonen, Gruppen und Szenen wurden wiederhergestellt.')}</p><button class="button" onclick="closeModal();window.go?.('home')">${t('Naar Home','Go to Home','Accueil','Zu Home')}</button>`);
    } catch (error) {
      window.toast?.(String(error?.message || error));
    }
  }

  async function openDevices() {
    try {
      const result = await control('LIST');
      const ids = String(result.DEVICEIDS || '').split(',').filter((id) => /^[0-9A-F]{16}$/.test(id));
      trustedDeviceIds = ids;
      let otherNumber = 0;
      show(`<button class="button soft" onclick="AluvisionAccountlessRecovery.open()">← ${t('Terug','Back','Retour','Zurück')}</button><h1>${t('Vertrouwde toestellen','Trusted devices','Appareils approuvés','Vertraute Geräte')}</h1><div class="v20-trusted-list">${ids.map((id, index) => {
        const isThisDevice = id === device.id;
        if (!isThisDevice) otherNumber += 1;
        const label = isThisDevice ? t('Dit toestel','This device','Cet appareil','Dieses Gerät') : `${t('Vertrouwd toestel','Trusted device','Appareil approuvé','Vertrautes Gerät')} ${otherNumber}`;
        return `<div><span><b>${label}</b></span>${isThisDevice ? '<i>✓</i>' : `<button class="button soft" onclick="AluvisionAccountlessRecovery.revoke(${index})">${t('Intrekken','Revoke','Révoquer','Entziehen')}</button>`}</div>`;
      }).join('') || `<p class="sub">${t('Geen toestellen gevonden','No devices found','Aucun appareil','Keine Geräte')}</p>`}</div>`);
    } catch (error) { window.toast?.(String(error?.message || error)); }
  }

  async function revoke(indexOrId) {
    const id = Number.isInteger(indexOrId) ? trustedDeviceIds[indexOrId] : indexOrId;
    if (!/^[0-9A-F]{16}$/.test(id)) return;
    try {
      await control('REVOKE', { TARGETDEVICE: id });
      statusCache = null;
      await openDevices();
    } catch (error) { window.toast?.(String(error?.message || error)); }
  }

  function openChangeCode() {
    show(`<button class="button soft" onclick="AluvisionAccountlessRecovery.open()">← ${t('Terug','Back','Retour','Zurück')}</button><h1>${t('Herstelcode wijzigen','Change recovery code','Modifier le code','Code ändern')}</h1><input id="v20ChangedCode" class="field v20-recovery-input" type="password" inputmode="numeric" autocomplete="new-password" maxlength="12" placeholder="${t('Nieuwe code · 8–12 cijfers','New code · 8–12 digits','Nouveau code · 8–12 chiffres','Neuer Code · 8–12 Ziffern')}"><input id="v20ChangedCodeAgain" class="field v20-recovery-input" type="password" inputmode="numeric" autocomplete="new-password" maxlength="12" placeholder="${t('Herhaal nieuwe code','Repeat new code','Répétez le nouveau code','Neuen Code wiederholen')}">${physicalCard()}<button class="button" onclick="AluvisionAccountlessRecovery.submitChangeCode()">${t('Nieuwe code opslaan','Save new code','Enregistrer','Neuen Code speichern')}</button><p class="sub">${t('Je lange Recovery Key blijft ongewijzigd.','Your long Recovery Key remains unchanged.','Votre Recovery Key reste inchangée.','Ihr Recovery Key bleibt unverändert.')}</p>`);
  }

  async function submitChangeCode() {
    const first = document.getElementById('v20ChangedCode')?.value || '';
    const second = document.getElementById('v20ChangedCodeAgain')?.value || '';
    const code = normalizeUserCode(first);
    if (!code || first !== second) return window.toast?.(t('Gebruik twee keer dezelfde code van 8 tot 12 cijfers.','Enter the same 8 to 12 digit code twice.','Saisissez deux fois le même code.','Geben Sie denselben Code zweimal ein.'));
    try {
      const result = await control('CHANGE_CODE', { CODE: code });
      if (result.DETAIL === 'PHYSICAL_REQUIRED') return window.toast?.(t('Houd eerst de knop op de verbonden receiver twee seconden ingedrukt.','First hold the button on the connected receiver for two seconds.','Maintenez d’abord le bouton du receiver connecté.','Taste am verbundenen Receiver zuerst halten.'));
      if (result.STATUS !== 'OK') throw new Error(result.DETAIL || 'Change failed');
      window.closeModal?.();
      window.toast?.(t('Herstelcode gewijzigd','Recovery code changed','Code modifié','Code geändert'));
    } catch (error) { window.toast?.(String(error?.message || error)); }
  }

  function openFactoryReset() {
    show(`<button class="button soft" onclick="AluvisionAccountlessRecovery.open()">← ${t('Terug','Back','Retour','Zurück')}</button><span class="scope">${t('FABRIEKSRESET VAN DEZE RECEIVER','FACTORY RESET THIS RECEIVER','RÉINITIALISER CE RECEIVER','DIESEN RECEIVER ZURÜCKSETZEN')}</span><h1>${t('Deze receiver volledig wissen?','Erase this receiver completely?','Effacer complètement ce receiver ?','Diesen Receiver vollständig löschen?')}</h1><p class="danger-note">${t('Dit wist alleen de instellingen, vertrouwde toestellen en versleutelde herstelgegevens op de verbonden receiver. Andere receivers en de inrichting in de app blijven ongewijzigd.','This erases only the settings, trusted devices and encrypted recovery data on the connected receiver. Other receivers and the setup in the app remain unchanged.','Cela efface uniquement les réglages, appareils approuvés et données de récupération chiffrées du receiver connecté. Les autres receivers et l’app restent inchangés.','Dies löscht nur Einstellungen, vertrauenswürdige Geräte und verschlüsselte Wiederherstellungsdaten auf dem verbundenen Receiver. Andere Receiver und die App bleiben unverändert.')}</p><input id="v20FactoryConfirm" class="field v20-recovery-input" autocomplete="off" placeholder="WIS RECEIVER">${physicalCard()}<button class="button red" onclick="AluvisionAccountlessRecovery.submitFactoryReset()">${t('Deze receiver wissen','Erase this receiver','Effacer ce receiver','Diesen Receiver löschen')}</button>`);
  }

  async function submitFactoryReset() {
    if ((document.getElementById('v20FactoryConfirm')?.value || '').trim().toUpperCase() !== 'WIS RECEIVER') {
      return window.toast?.(t('Typ WIS RECEIVER om te bevestigen.','Type WIS RECEIVER to confirm.','Tapez WIS RECEIVER pour confirmer.','Zum Bestätigen WIS RECEIVER eingeben.'));
    }
    try {
      const result = await control('FACTORY_RESET', { CONFIRM: 'ERASE' });
      if (result.DETAIL === 'PHYSICAL_REQUIRED') return window.toast?.(t('Houd eerst de knop op de verbonden receiver twee seconden ingedrukt.','First hold the button on the connected receiver for two seconds.','Maintenez d’abord le bouton du receiver connecté.','Taste am verbundenen Receiver zuerst halten.'));
      if (result.STATUS !== 'OK') throw new Error(result.DETAIL || 'Reset failed');
      localStorage.removeItem(STORAGE_KEY);
      window.closeModal?.();
      window.toast?.(t('Receiver gewist','Receiver erased','Receiver effacé','Receiver gelöscht'));
    } catch (error) { window.toast?.(String(error?.message || error)); }
  }

  async function copyCode(code) {
    try { await navigator.clipboard.writeText(code); window.toast?.(t('Code gekopieerd','Code copied','Code copié','Code kopiert')); }
    catch (_) { window.toast?.(t('Selecteer en kopieer de code handmatig','Select and copy the code manually','Copiez le code manuellement','Code manuell kopieren')); }
  }

  function recoverySettingsCard() {
    if(window.AluvisionLocalTestMode?.enabled)return `<section class="card v20-recovery-settings" data-local-no-pin-notice><h2>Teststand · PIN tijdelijk uit</h2><p class="sub">${safe(window.AluvisionLocalTestMode.message)}</p></section>`;
    if(window.AluvisionNativeConnection?.available)return `<section class="card v20-recovery-settings" data-existing-settings><h2>Bestaande installatie verbinden</h2><p class="sub">Voer je bestaande installatie-PIN in. Alleen verbinden verandert je huidige inrichting niet.</p><div class="v20-recovery-actions"><button type="button" class="button" onclick="AluvisionAccountlessRecovery.openExisting('connect')">Verbinden met mijn PIN</button><button type="button" class="button soft" onclick="AluvisionAccountlessRecovery.openExisting('restore')">Volledige inrichting herstellen</button></div></section>`;
    return `<div class="card v20-recovery-settings"><div class="row"><span><div class="eyebrow">${t('INSTALLATIEHERSTEL','INSTALLATION RECOVERY','RÉCUPÉRATION','WIEDERHERSTELLUNG')}</div><h2>${t('Herstellen zonder account','Recover without an account','Restaurer sans compte','Ohne Konto wiederherstellen')}</h2></span><i>⌁</i></div><p class="sub">${t('Versleutelde back-up op de verbonden receiver en bevestigde extra receivers. Je herstelcode en vertrouwde toestellen blijven onder jouw controle.','Encrypted backup on the connected receiver and confirmed extra receivers. Your recovery code and trusted devices stay under your control.','Sauvegarde chiffrée sur le receiver connecté et les receivers supplémentaires confirmés.','Verschlüsseltes Backup auf dem verbundenen und bestätigten zusätzlichen Receivern.')}</p><button class="button soft" onclick="AluvisionAccountlessRecovery.open()">${t('Installatieherstel openen','Open installation recovery','Ouvrir la récupération','Wiederherstellung öffnen')}</button></div>`;
  }

  function wrapSettings() {
    if (settingsWrapped || typeof window.settings !== 'function') return;
    const original = window.settings;
    window.settings = function accountlessRecoverySettings(...args) {
      const value = original.apply(this, args);
      const root = document.getElementById('settings');
      if (root && !root.querySelector('.v20-recovery-settings')) {
        const danger = [...root.querySelectorAll('.card')].find((card) => /Gevarenzone|Danger zone|Zone dangereuse|Gefahrenzone/i.test(card.textContent || ''));
        if (danger) danger.insertAdjacentHTML('beforebegin', recoverySettingsCard());
        else root.insertAdjacentHTML('beforeend', recoverySettingsCard());
      }
      return value;
    };
    settingsWrapped = true;
  }

  async function pairingDisposition() {
    const status = await getStatus(true);
    // Pairing is fail-closed: a transient recovery/status failure must never
    // make an already configured receiver look new and rotate its network key.
    if (!status.available) return 'recovery-unavailable';
    if (!status.configured) return 'new-installation';
    return status.trusted ? 'trusted-installation' : 'restore-required';
  }

  async function bootstrap() {
    wrapSettings();
    const status = await getStatus(true);
    if (status.configured && !status.trusted &&
        gateway().wasProvisionedThisLoad?.()) {
      window.dispatchEvent?.(new CustomEvent('aluvision:recovery-required'));
      openRestore('code');
      return;
    }
    // Opening/reloading the app is not permission to replace a working local
    // layout with a remote snapshot. Full restoration is an explicit action.
    if (secureContext && status.trusted && status.revision > (Number(secureContext.material.snapshotRevision) || 0))
      lastError = 'Een nieuwere back-up is beschikbaar. Kies Laatste inrichting laden.';
  }

  const style = document.createElement('style');
  style.textContent = `
    .v21-existing-installation{display:grid;gap:16px;min-width:0}.v21-existing-installation h1{font-size:clamp(25px,5.2vw,38px);line-height:1.08;margin:0;overflow-wrap:anywhere}.v21-existing-installation form,.v21-existing-pin,.v21-existing-options{display:grid;gap:10px;min-width:0}.v21-existing-installation .button{white-space:normal;min-height:46px;line-height:1.3}.v21-existing-installation .sub{margin:0;line-height:1.5}.v21-existing-target{display:grid;gap:5px;padding:14px;border:1px solid var(--line);border-radius:16px;background:var(--panel-2);margin:0}.v21-existing-target small{color:var(--mut);line-height:1.5}.v21-existing-pin input{font-size:22px;letter-spacing:3px;min-height:52px;box-sizing:border-box;width:100%;max-width:100%}.v21-existing-options{border-top:1px solid var(--line);padding-top:14px}.v21-existing-installation [data-existing-error]{font-size:13px;line-height:1.5;margin:0}
    .v20-recovery{display:grid;gap:15px}.v20-recovery-body{display:grid;gap:14px}.v20-recovery-physical{display:grid;grid-template-columns:42px minmax(0,1fr);gap:11px;align-items:center;padding:12px;border:1px solid color-mix(in srgb,var(--red),var(--line) 62%);border-radius:15px;background:color-mix(in srgb,var(--red),var(--panel) 96%)}.v20-recovery-physical>i{display:grid;place-items:center;width:42px;height:42px;border-radius:50%;background:var(--red);color:#fff;font-style:normal;animation:v20RecoveryPulse 1.4s ease-in-out infinite}.v20-recovery-physical b,.v20-recovery-physical small{display:block}.v20-recovery-physical small{margin-top:3px;color:var(--mut);font-size:10px;line-height:1.35}.v20-recovery-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.v20-recovery-stats span{padding:12px;border:1px solid var(--line);border-radius:14px;background:var(--panel-2);text-align:center}.v20-recovery-stats b,.v20-recovery-stats small{display:block}.v20-recovery-stats b{font-size:22px}.v20-recovery-stats small{margin-top:2px;color:var(--mut);font-size:8px}.v20-recovery-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.v20-recovery-code{padding:17px 10px;border-radius:15px;background:#1d1e1d;color:#fff;font:900 clamp(16px,4vw,24px)/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:1.5px;text-align:center;user-select:all}.v20-recovery-input{text-transform:uppercase;font:850 17px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:1px;text-align:center}.v20-recovery-limit{margin:0;color:var(--mut);font-size:8px;text-align:center}.v20-trusted-list{display:grid;gap:8px}.v20-trusted-list>div{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;align-items:center;padding:10px 11px;border:1px solid var(--line);border-radius:13px}.v20-trusted-list b,.v20-trusted-list small{display:block}.v20-trusted-list small{margin-top:2px;color:var(--mut);font-family:ui-monospace,monospace}.v20-recovery-settings>i,.v20-recovery-settings .row>i{display:grid;place-items:center;width:42px;height:42px;border-radius:13px;background:var(--ink);color:var(--panel);font-style:normal;font-size:20px}@keyframes v20RecoveryPulse{50%{box-shadow:0 0 0 9px color-mix(in srgb,var(--red),transparent 84%)}}@media(max-width:520px){.v20-recovery-actions{grid-template-columns:1fr}.v20-recovery-stats{gap:5px}.v20-recovery-stats span{padding:9px 4px}.v20-recovery-stats b{font-size:18px}}@media(prefers-reduced-motion:reduce){.v20-recovery-physical>i{animation:none}}
  `;
  document.head.appendChild(style);

  window.AluvisionAccountlessRecovery = Object.freeze({
    openExisting,submitExisting,cancelExisting,switchExisting,chooseExistingReceiver,forgotExistingPin,
    openOwnerSession, restoreOwnerSnapshot, applyOwnerSnapshot, retainOwnerSession,
    bind(next) { bindings = next || null; setTimeout(bootstrap, 0); },
    open: openRecovery,
    openSetup,
    beginSetup,
    continueSetup,
    openRestore,
    submitRestore,
    confirmProof,
    restoreTrusted,
    openDevices,
    revoke,
    openChangeCode,
    submitChangeCode,
    openFactoryReset,
    submitFactoryReset,
    copyCode,
    getStatus,
    pairingDisposition,
    queueSnapshot,
    uploadSnapshot,
    downloadSnapshot,
    normalizeUserCode,
    normalizeRecoveryKey,
    createRecoveryKey,
    setupInstallation,
    limits: Object.freeze({ plaintext: MAX_PLAINTEXT_BYTES, stored: MAX_STORED_BYTES, userCodeMin: USER_CODE_MIN, userCodeMax: USER_CODE_MAX }),
    get lastError() { return lastError; }
  });
})();
