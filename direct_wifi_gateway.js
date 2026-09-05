/*
 * Aluvision private Wi-Fi gateway adapter
 *
 * Receiver 1 exposes the existing text protocol through three small HTTP
 * endpoints.  This adapter deliberately knows nothing about scenes or UI; it
 * only turns a queued HTTP command into the same final ACK the bridge already
 * consumes.  That keeps Wi-Fi, BLE recovery and future transports swappable.
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'aluvision.private-wifi-gateway.v1';
  const DEFAULT_GATEWAY = 'http://192.168.4.1';
  const MANUAL_BOOTSTRAP_PATH = '/alv/manual-bootstrap';
  const MANUAL_BOOTSTRAP_SECURITY = 'OPEN_TEST';
  const TOKEN_HEADER = 'X-Aluvision-Token';
  const API_VERSION = 1;
  const MIN_POLL_MS = 18;
  const MAX_POLL_MS = 80;
  const encoder = new TextEncoder();

  let ready = false;
  let gatewayFields = {};
  let commandId = Math.floor(Date.now() % 900000000) || 1;
  let transactionTail = Promise.resolve();
  let manualBootstrapPromise = null;
  let security = {};
  let capturedThisLoad = false;
  let outputHealth = Object.freeze({
    ready: null,
    degraded: false,
    code: '',
    selfTest: ''
  });

  function cleanHex(value, length) {
    const text = String(value || '').trim().toUpperCase();
    return new RegExp(`^[0-9A-F]{${length}}$`).test(text) ? text : '';
  }

  function cleanBase(value) {
    try {
      const url = new URL(String(value || DEFAULT_GATEWAY));
      if (!['http:', 'https:'].includes(url.protocol)) return DEFAULT_GATEWAY;
      return `${url.protocol}//${url.host}`;
    } catch (_) {
      return DEFAULT_GATEWAY;
    }
  }

  function isReceiverOrigin() {
    return location.hostname === '192.168.4.1';
  }

  const manualBootstrapRequested = isReceiverOrigin() &&
    new URLSearchParams(location.search || '').get('manual') === '1';

  function selectedStorage() {
    /*
     * Pairing starts on the public HTTPS bootstrap page, but the bearer token
     * and AP password must not become durable data on that public origin.
     * They live only for the current browser tab until the user opens the
     * receiver-hosted app.  The receiver origin may persist them so later
     * visits can reconnect without another NFC tap.
    */
    if (isReceiverOrigin()) return localStorage;
    if (typeof sessionStorage !== 'undefined') {
      /* Remove credentials left by pre-V20 public builds. */
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
      return sessionStorage;
    }
    return localStorage;
  }

  function readStored() {
    try {
      const parsed = JSON.parse(selectedStorage().getItem(STORAGE_KEY) || 'null');
      if (!parsed || typeof parsed !== 'object') throw new Error('invalid');
      return {
        base: cleanBase(parsed.base),
        token: cleanHex(parsed.token, 64),
        pairingToken: cleanHex(parsed.pairingToken, 16),
        expectedRid: cleanHex(parsed.expectedRid, 16),
        ssid: String(parsed.ssid || '').slice(0, 32),
        password: String(parsed.password || '').slice(0, 64)
      };
    } catch (_) {
      return { base: DEFAULT_GATEWAY, token: '', pairingToken: '', expectedRid: '', ssid: '', password: '' };
    }
  }

  const connection = readStored();

  function persist() {
    try {
      selectedStorage().setItem(STORAGE_KEY, JSON.stringify(connection));
      return true;
    } catch (_) {
      return false;
    }
  }

  function provisioningParameters() {
    const query = new URLSearchParams(location.search || '');
    const rawHash = String(location.hash || '').replace(/^#/, '');
    const hashPayload = /^(?:pair|wifi)\?/i.test(rawHash)
      ? rawHash.slice(rawHash.indexOf('?') + 1)
      : (/^(?:i|t|wifi|s|p|k)=/i.test(rawHash) ? rawHash : '');
    if (hashPayload) {
      const fragment = new URLSearchParams(hashPayload);
      fragment.forEach((value, key) => { if (!query.has(key)) query.set(key, value); });
    }
    return { query, hashPayload };
  }

  function captureProvisioningLink() {
    const { query, hashPayload } = provisioningParameters();
    const token = cleanHex(query.get('k'), 64);
    const pairingToken = cleanHex(query.get('t'), 16);
    const expectedRid = cleanHex(query.get('i'), 16);
    if (token) connection.token = token;
    if (pairingToken) connection.pairingToken = pairingToken;
    if (expectedRid) connection.expectedRid = expectedRid;
    if (query.has('s')) connection.ssid = String(query.get('s') || '').slice(0, 32);
    if (query.has('p')) connection.password = String(query.get('p') || '').slice(0, 64);
    if (query.has('gateway')) connection.base = cleanBase(query.get('gateway'));
    else if (location.hostname === '192.168.4.1') connection.base = cleanBase(location.origin);
    if (token || pairingToken || expectedRid || query.has('s') || query.has('p')) {
      capturedThisLoad = true;
      persist();
      ['k', 't', 'i', 's', 'p', 'wifi', 'gateway'].forEach((key) => query.delete(key));
      const nextHash = hashPayload ? '' : (location.hash || '');
      const next = `${location.pathname}${query.toString() ? `?${query}` : ''}${nextHash}`;
      try { history.replaceState(history.state, '', next); } catch (_) {}
    }
  }

  function clearManualBootstrapFlag() {
    const query = new URLSearchParams(location.search || '');
    if (!query.has('manual')) return;
    query.delete('manual');
    const next = `${location.pathname}${query.toString() ? `?${query}` : ''}${location.hash || ''}`;
    try { history.replaceState(history.state, '', next); } catch (_) {}
  }

  function validateManualBootstrap(fields, response) {
    if (!response.ok) {
      if (response.status === 403 && fields.ERROR === 'HOLD_BOOT_2S') {
        const error = new Error('Houd BOOT 2 seconden ingedrukt en probeer opnieuw.');
        error.code = 'HOLD_BOOT_2S';
        throw error;
      }
      throw new Error(fields.ERROR || fields.DETAIL || `Receiverfout ${response.status}`);
    }
    const rid = cleanHex(fields.RID, 16);
    const pairingToken = cleanHex(fields.TOKEN, 16);
    const apiToken = cleanHex(fields.APTOKEN, 64);
    const ssid = String(fields.SSID || '');
    const password = String(fields.APPASS || '');
    const apSecurity = String(fields.APSEC || '').toUpperCase();
    const receiverType = String(fields.DEVTYPE || '').toUpperCase();
    const windowSeconds = Number(fields.WINDOW);
    if (fields.API !== String(API_VERSION) || fields.STATUS !== 'OK' ||
        fields.MODE !== 'MANUAL_TEST' || fields.FWVARIANT !== 'MANUAL_WIFI' ||
        !rid || !pairingToken || !apiToken ||
        !/^ALUVISION-[0-9A-F]{6}$/.test(ssid) ||
        password !== '' || apSecurity !== MANUAL_BOOTSTRAP_SECURITY ||
        !['SPI', 'RGBW'].includes(receiverType) ||
        !Number.isInteger(windowSeconds) || windowSeconds < 1 || windowSeconds > 600) {
      throw new Error('De receiver gaf geen geldige tijdelijke verbindingsgegevens door.');
    }
    return { rid, pairingToken, apiToken, ssid, password, apSecurity, receiverType, windowSeconds };
  }

  async function performManualBootstrap() {
    if (!isReceiverOrigin()) {
      throw new Error('Open eerst 192.168.4.1/?manual=1 via het ALUVISION-netwerk.');
    }
    const deadline = abortAfter(4500);
    let response;
    let body;
    try {
      response = await fetch(`${location.origin}${MANUAL_BOOTSTRAP_PATH}`, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
        referrerPolicy: 'no-referrer',
        headers: { Accept: 'text/plain' },
        signal: deadline.signal
      });
      body = await response.text();
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('De receiver antwoordde niet op tijd. Houd BOOT 2 seconden ingedrukt en probeer opnieuw.');
      throw error;
    } finally {
      deadline.clear();
    }
    const contentType = String(response.headers?.get?.('content-type') || '').toLowerCase();
    if (!contentType.startsWith('text/plain') || body.length > 1024) {
      throw new Error('De receiver gaf een ongeldig tijdelijk verbindingsantwoord.');
    }
    const validated = validateManualBootstrap(parseFields(body), response);
    const previous = { ...connection };
    Object.assign(connection, {
      base: cleanBase(location.origin),
      token: validated.apiToken,
      pairingToken: validated.pairingToken,
      expectedRid: validated.rid,
      ssid: validated.ssid,
      password: validated.password
    });
    ready = false;
    gatewayFields = {};
    persist();
    try {
      const info = await readInfo(3500);
      if (cleanHex(info.RID, 16) !== validated.rid ||
          String(info.DEVTYPE || '').toUpperCase() !== validated.receiverType) {
        throw new Error('De tijdelijke verbinding hoort niet bij deze receiver.');
      }
    } catch (error) {
      Object.assign(connection, previous);
      ready = false;
      gatewayFields = {};
      persist();
      throw error;
    }
    capturedThisLoad = true;
    clearManualBootstrapFlag();
    return Object.freeze({
      ok: true,
      ready: true,
      rid: validated.rid,
      ssid: validated.ssid,
      receiverType: validated.receiverType,
      windowSeconds: validated.windowSeconds
    });
  }

  function manualBootstrap(options = {}) {
    if (manualBootstrapPromise && !options.refresh) return manualBootstrapPromise;
    const attempt = performManualBootstrap();
    manualBootstrapPromise = attempt;
    attempt.catch(() => {
      if (manualBootstrapPromise === attempt) manualBootstrapPromise = null;
    });
    return attempt;
  }

  function localHandoffUrl() {
    if (!connection.token) return '';
    const query = new URLSearchParams({
      i: connection.expectedRid,
      t: connection.pairingToken,
      wifi: '1',
      s: connection.ssid,
      p: connection.password,
      k: connection.token
    });
    [...query.entries()].forEach(([key, value]) => { if (!value) query.delete(key); });
    /* URL fragments never reach GitHub, the receiver HTTP server, logs,
       referrers or service workers. The local app consumes and scrubs it. */
    return `${connection.base}/#pair?${query}`;
  }

  function parseFields(text) {
    const fields = {};
    String(text || '').trim().split(';').forEach((part) => {
      const separator = part.indexOf('=');
      if (separator < 1) return;
      const key = part.slice(0, separator).trim().toUpperCase();
      if (!/^[A-Z][A-Z0-9_]*$/.test(key)) return;
      fields[key] = part.slice(separator + 1).trim();
    });
    return fields;
  }

  function serialiseFields(fields) {
    return Object.entries(fields)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${String(key).toUpperCase()}=${String(value)}`)
      .join(';');
  }

  function abortAfter(milliseconds) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), milliseconds);
    return { signal: controller.signal, clear: () => clearTimeout(timer) };
  }

  async function request(path, options = {}) {
    if (!connection.token) throw new Error('Verbind eerst met een receiver via Receiver toevoegen.');
    const timeout = Math.max(300, Number(options.timeout) || 3500);
    const deadline = abortAfter(timeout);
    const headers = new Headers(options.headers || {});
    headers.set(TOKEN_HEADER, connection.token);
    headers.set('Accept', 'text/plain');
    try {
      const response = await fetch(`${connection.base}${path}`, {
        ...options,
        headers,
        cache: 'no-store',
        signal: deadline.signal
      });
      const text = await response.text();
      const fields = parseFields(text);
      if (response.status === 401) {
        ready = false;
        throw new Error('De beveiligde toegang is verlopen. Verbind de receiver opnieuw via Receiver toevoegen.');
      }
      if (!response.ok && response.status !== 202) {
        throw new Error(fields.DETAIL || `Receiverfout ${response.status}`);
      }
      return { status: response.status, fields, text };
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('Receiver antwoordde niet op tijd. Controleer de private wifi-verbinding.');
      throw error;
    } finally {
      deadline.clear();
    }
  }

  const RECOVERY_PATHS = new Set([
    '/alv/recovery/status',
    '/alv/recovery/control',
    '/alv/recovery/snapshot'
  ]);

  /*
   * Narrow transport primitive for the accountless recovery module.  Keeping
   * this below the gateway boundary prevents recovery code or trusted-device
   * credentials from ever being placed in a URL.  The private-AP bearer token
   * is still attached here, exactly like every other privileged receiver call.
   */
  async function recoveryRequest(path, options = {}) {
    if (!RECOVERY_PATHS.has(path)) throw new Error('Onbekende herstelactie');
    if (!connection.token) throw new Error('Verbind eerst met een receiver via Receiver toevoegen.');
    const timeout = Math.max(500, Math.min(20000, Number(options.timeout) || 5000));
    const deadline = abortAfter(timeout);
    const headers = new Headers(options.headers || {});
    headers.set(TOKEN_HEADER, connection.token);
    try {
      const response = await fetch(`${connection.base}${path}`, {
        method: String(options.method || 'POST').toUpperCase(),
        headers,
        body: options.body,
        cache: 'no-store',
        signal: deadline.signal
      });
      if (response.status === 401) {
        ready = false;
        throw new Error('De beveiligde toegang van deze receiver is niet meer geldig.');
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      // Recovery responses intentionally use 4xx states (locked, physical
      // proof required, invalid secret). Return their structured body to the
      // recovery state machine; only receiver/server failures throw here.
      if (response.status >= 500) {
        const detail = new TextDecoder().decode(bytes).slice(0, 180);
        throw new Error(detail || `Receiverfout ${response.status}`);
      }
      return Object.freeze({
        status: response.status,
        bytes,
        text: new TextDecoder().decode(bytes),
        headers: response.headers
      });
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('Receiver antwoordde niet op tijd.');
      throw error;
    } finally {
      deadline.clear();
    }
  }

  async function readInfo(timeout = 2500) {
    const result = await request('/alv/info', { timeout });
    if (result.fields.API !== String(API_VERSION) || result.fields.STATUS !== 'OK') {
      throw new Error('Deze receiver gebruikt geen ondersteunde controllerinterface.');
    }
    const rid = cleanHex(result.fields.RID, 16);
    if (!rid) throw new Error('Receiver gaf geen geldige identiteit door.');
    if (connection.expectedRid && connection.expectedRid !== rid) {
      ready = false;
      throw new Error('De verbonden wifi hoort niet bij de aangetikte receiver.');
    }
    gatewayFields = { ...gatewayFields, ...result.fields, RID: rid };
    ready = true;
    return gatewayFields;
  }

  function delay(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  async function transactNow(fields, options = {}) {
    if (!ready) await connect({ interactive: false });
    const timeout = Math.max(500, Number(options.timeout) || 3500);
    const started = performance.now();
    commandId = (commandId + 1) % 2147483000 || 1;
    const id = Number(fields.ID) || commandId;
    const command = serialiseFields({ V: 18, ID: id, ...fields });
    const queued = await request('/alv/command', {
      method: 'POST',
      timeout: Math.min(timeout, 3000),
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: command
    });
    if (queued.fields.STATUS === 'ERROR') throw new Error(queued.fields.DETAIL || 'Commando geweigerd');

    let pollMs = MIN_POLL_MS;
    while (performance.now() - started < timeout) {
      await delay(pollMs);
      const remaining = Math.max(300, timeout - (performance.now() - started));
      const status = await request('/alv/status', { timeout: Math.min(remaining, 1400) });
      if (status.status === 202 || status.fields.STATUS === 'QUEUED') {
        pollMs = Math.min(MAX_POLL_MS, Math.round(pollMs * 1.45));
        continue;
      }
      const replyId = Number(status.fields.ID || 0);
      if (replyId && replyId !== id) {
        pollMs = Math.min(MAX_POLL_MS, Math.round(pollMs * 1.35));
        continue;
      }
      if (!options.allowError && status.fields.STATUS === 'ERROR') {
        throw new Error(status.fields.DETAIL || 'Receiverfout');
      }
      return status.fields;
    }
    throw new Error('Receiver heeft het commando niet op tijd bevestigd.');
  }

  function transact(fields, options = {}) {
    // The RC receiver exposes one final-status slot. Serialising here protects
    // correlation even when status refresh and a live UI action arrive at the
    // same moment. The bridge already coalesces high-frequency LIVE samples.
    const run = () => transactNow({ ...fields }, { ...options });
    const next = transactionTail.then(run, run);
    transactionTail = next.catch(() => {});
    return next;
  }

  async function connect() {
    await readInfo();
    return true;
  }

  async function statusForGateway(timeout = 3600) {
    const type = String(gatewayFields.DEVTYPE || 'SPI').toUpperCase() === 'RGBW' ? 'RGBW' : 'SPI';
    const status = await transact(
      { TYPE: 'STATUS', TARGET: gatewayFields.RID, DEVTYPE: type },
      { timeout, allowError: true }
    );
    const expectedRid = cleanHex(gatewayFields.RID, 16);
    const targetRid = cleanHex(status.TARGETRID, 16);
    const replyRid = cleanHex(status.RID, 16);
    const identityMatches = targetRid ? targetRid === expectedRid : replyRid === expectedRid;
    if (!identityMatches) {
      ready = false;
      throw new Error('De receiverstatus hoort niet bij de verbonden receiver.');
    }

    /*
     * V20 receivers can report STATUS=ERROR for a valid STATUS reply when the
     * radio/pairing path is healthy but the physical LED output failed its
     * boot check.  That is an output diagnostic, not a failed pairing.  Keep
     * the transport usable and carry the diagnostic to the setup UI instead
     * of losing the newly paired receiver.
     */
    const degradedOutput = status.STATUS === 'ERROR' && status.DETAIL === 'STATUS' && status.PAIRED === '1';
    const accepted = status.STATUS === 'OK' || degradedOutput;
    const explicitReady = status.OUTPUTOK === '1' ? true : status.OUTPUTOK === '0' ? false : null;
    const outputReady = degradedOutput ? false : explicitReady;
    const selfTest = String(status.BOOTSELFTEST || '').toUpperCase();
    const code = outputReady === false
      ? (selfTest || String(status.OUTPUTSTATE || status.OUTPUTERROR || 'OUTPUT_NOT_READY').toUpperCase())
      : '';
    outputHealth = Object.freeze({
      ready: outputReady,
      degraded: degradedOutput,
      code,
      selfTest
    });
    gatewayFields = { ...gatewayFields, OUTPUTOK: status.OUTPUTOK, BOOTSELFTEST: status.BOOTSELFTEST };

    if (!accepted) throw new Error(status.DETAIL || 'Receiverstatus niet beschikbaar');
    return {
      ...status,
      outputReady: outputHealth.ready,
      outputDegraded: outputHealth.degraded,
      outputDiagnostic: outputHealth.code,
      outputSelfTest: outputHealth.selfTest
    };
  }

  async function pair(payload = {}) {
    await connect();
    const recovery = window.AluvisionAccountlessRecovery;
    if (recovery?.pairingDisposition) {
      const disposition = await recovery.pairingDisposition();
      if (disposition === 'restore-required') {
        recovery.openRestore?.('code');
        const error = new Error('Bestaande installatie: herstel eerst met je code.');
        error.code = 'RECOVERY_REQUIRED';
        throw error;
      }
      if (disposition === 'recovery-unavailable') {
        const error = new Error('De beveiligde receiverstatus kon niet worden gecontroleerd. Probeer opnieuw; koppelen is uit veiligheid niet uitgevoerd.');
        error.code = 'RECOVERY_STATUS_REQUIRED';
        throw error;
      }
      if (disposition === 'trusted-installation') {
        // A repeated NFC tap must never rotate the installation/ESP-NOW key.
        connection.pairingToken = '';
        persist();
        const status = await statusForGateway();
        return {
          ...gatewayFields, ...status, RID: gatewayFields.RID,
          DEVTYPE: status.DEVTYPE || gatewayFields.DEVTYPE,
          gateway: true, gatewayRid: gatewayFields.RID,
          recoveryResume: true
        };
      }
    }
    const number = Math.max(1, Math.min(250, Math.round(Number(payload.number) || 1)));
    let reply = {};
    if (connection.pairingToken) {
      reply = await transact({
        TYPE: 'PAIR',
        TOKEN: connection.pairingToken,
        NETWORK: cleanHex(payload.compatibilityKey, 16),
        NUMBER: number
      }, { timeout: 5000, allowError: true });
      const committed = reply.PAIRED === '1' && ['OK', 'ERROR'].includes(reply.STATUS) && reply.DETAIL === 'PAIRED';
      if (!committed) throw new Error(reply.DETAIL || 'Koppeling werd niet bevestigd. Houd BOOT 2 seconden ingedrukt en probeer opnieuw.');
      connection.pairingToken = '';
      persist();
    }
    const status = await statusForGateway();
    return {
      ...gatewayFields,
      ...reply,
      ...status,
      RID: gatewayFields.RID,
      DEVTYPE: status.DEVTYPE || gatewayFields.DEVTYPE,
      gateway: true,
      gatewayRid: gatewayFields.RID
    };
  }

  async function discover() {
    try {
      await connect();
      const status = await statusForGateway(3000);
      return { devices: [{ ...gatewayFields, ...status, RID: gatewayFields.RID, gateway: true }] };
    } catch (_) {
      ready = false;
      return { devices: [] };
    }
  }

  async function otaPost(path, body, contentType, timeout = 5000) {
    return request(path, {
      method: 'POST',
      timeout,
      headers: { 'Content-Type': contentType },
      body
    });
  }

  async function otaInfo() {
    return readInfo(3500);
  }

  async function otaBegin(control) {
    return otaPost('/alv/ota/begin', String(control || ''), 'text/plain; charset=utf-8');
  }

  async function otaData(frame) {
    const bytes = frame instanceof Uint8Array ? frame : new Uint8Array(frame || 0);
    return otaPost('/alv/ota/data', bytes, 'application/octet-stream', 12000);
  }

  async function otaCommit(control) {
    return otaPost('/alv/ota/commit', String(control || ''), 'text/plain; charset=utf-8', 12000);
  }

  async function otaAbort(control) {
    return otaPost('/alv/ota/abort', String(control || ''), 'text/plain; charset=utf-8');
  }

  async function otaStatus(timeout = 3500) {
    return request('/alv/ota/status', { timeout });
  }

  function configureSecurity(next = {}) {
    security = {
      version: Number(next.version) || 0,
      compatibilityKey: cleanHex(next.compatibilityKey, 16),
      publicTag: cleanHex(next.publicTag, 6)
    };
    return true;
  }

  captureProvisioningLink();

  const adapter = Object.freeze({
    supportsConcurrentFanout: false,
    supportsOta: true,
    otaMaxChunk: 4096,
    isReady: () => ready,
    connect,
    transact,
    pair: (payload) => pair({ ...security, ...payload }),
    discover,
    otaTargetReady: (rid) => ready && cleanHex(rid, 16) === cleanHex(gatewayFields.RID, 16),
    otaInfo,
    otaBegin,
    otaData,
    otaCommit,
    otaAbort,
    otaStatus,
    recoveryRequest,
    configureSecurity,
    gatewayRid: () => gatewayFields.RID || connection.expectedRid || '',
    wasProvisionedThisLoad: () => capturedThisLoad,
    manualBootstrapRequested: () => manualBootstrapRequested,
    manualBootstrap,
    getConnectionDetails: () => Object.freeze({
      base: connection.base,
      ssid: connection.ssid,
      hasPassword: Boolean(connection.password),
      provisioned: Boolean(connection.token),
      needsLocalHandoff: Boolean(connection.token && cleanBase(location.origin) !== connection.base),
      ready,
      nfcState: String(gatewayFields.NFCSTATE || (gatewayFields.NFCREADY === '1' || gatewayFields.NFC === '1' ? 'READY' : gatewayFields.NFCREADY === '0' ? 'NOT_READY' : '')).toUpperCase(),
      nfcReady: gatewayFields.NFCSTATE === 'READY' || gatewayFields.NFCREADY === '1' || gatewayFields.NFC === '1',
      nfcTaps: Math.max(0, Number(gatewayFields.NFCTAPS) || 0),
      nfcHint: String(gatewayFields.NFCHINT || '').toUpperCase(),
      nfcI2cError: /^\d+$/.test(String(gatewayFields.NFCI2CERR ?? '')) ? Number(gatewayFields.NFCI2CERR) : null,
      nfcIdleSda: gatewayFields.NFCIDLESDA === '1' ? true : gatewayFields.NFCIDLESDA === '0' ? false : null,
      nfcIdleScl: gatewayFields.NFCIDLESCL === '1' ? true : gatewayFields.NFCIDLESCL === '0' ? false : null,
      nfcSwapped: gatewayFields.NFCSWAPPED === '1' ? true : gatewayFields.NFCSWAPPED === '0' ? false : null,
      outputReady: outputHealth.ready,
      outputDegraded: outputHealth.degraded,
      outputDiagnostic: outputHealth.code,
      outputSelfTest: outputHealth.selfTest
    }),
    copyWifiPassword: async () => {
      if (!connection.password) return false;
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(connection.password);
          return true;
        } catch (_) {}
      }
      const input = document.createElement('textarea');
      input.value = connection.password;
      input.setAttribute('readonly', '');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      const copied = Boolean(document.execCommand?.('copy'));
      input.remove();
      if (!copied) throw new Error('copy unavailable');
      return true;
    },
    navigateToGateway: () => {
      const url = localHandoffUrl();
      if (!url) return false;
      location.assign(url);
      return true;
    }
  });

  const registry = window.AluvisionTransportRegistry;
  if (!registry || typeof registry.register !== 'function') {
    throw new Error('Aluvision transportregister ontbreekt');
  }
  registry.register('wifi-ap', adapter);

  Object.defineProperty(window, 'AluvisionPrivateWifi', {
    configurable: false,
    enumerable: false,
    writable: false,
    value: adapter
  });

  if (manualBootstrapRequested) {
    setTimeout(() => manualBootstrap().catch(() => {}), 0);
  }
})();
