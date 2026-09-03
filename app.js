(() => {
  'use strict';

  const UUIDS = Object.freeze({
    service: '8f0d1100-8b2b-4ca3-a9d5-8a39aaf11700',
    command: '8f0d1101-8b2b-4ca3-a9d5-8a39aaf11700',
    status: '8f0d1102-8b2b-4ca3-a9d5-8a39aaf11700',
    info: '8f0d1103-8b2b-4ca3-a9d5-8a39aaf11700'
  });

  const STORE_KEY = 'aluvision.direct-ble.v1';
  const MAX_WRITE_BYTES = 150;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const SPI_EFFECTS = [
    { id: 'CHASE', name: 'Chase', preview: 'moving', colours: 1 },
    { id: 'COMET', name: 'Comet', preview: 'moving', colours: 1 },
    { id: 'SCANNER', name: 'Scanner', preview: 'moving', colours: 1 },
    { id: 'BREATHE', name: 'Pulse', preview: 'pulse', colours: 1 },
    { id: 'WAVE', name: 'Wave', preview: 'wave', colours: 2 },
    { id: 'GRADIENT', name: 'Color fade', preview: 'fade', colours: 2 },
    { id: 'SPARKLE', name: 'Sparkle', preview: 'wave', colours: 1 },
    { id: 'WARM', name: 'Warm white', preview: 'pulse', colours: 1 }
  ];

  const RGBW_EFFECTS = [
    { id: 'RGBW_PULSE', name: 'Pulse', preview: 'pulse', colours: 1 },
    { id: 'RGBW_FADE', name: 'Fade', preview: 'pulse', colours: 1 },
    { id: 'RGBW_COLOR_FADE', name: 'Color fade', preview: 'fade', colours: 2 },
    { id: 'RGBW_SMOOTH', name: 'Smooth', preview: 'fade', colours: 2 },
    { id: 'RGBW_STROBE', name: 'Strobe', preview: 'pulse', colours: 1 }
  ];

  const $ = (id) => document.getElementById(id);

  let saved = loadSavedState();
  let sequence = Math.floor(Date.now() % 900000000) || 1;
  let toastTimer = 0;
  let notificationBuffer = '';
  let lastPreviewFrame = 0;
  let liveTimer = 0;
  let liveInFlight = false;
  let liveDirty = false;
  let wheelDragging = false;
  let transactionTail = Promise.resolve();
  const ackWaiters = new Map();

  const ble = {
    device: null,
    server: null,
    command: null,
    status: null,
    info: null,
    rid: '',
    key: '',
    type: 'SPI',
    number: 1,
    physical: 60,
    physicalReverse: false,
    portMask: 3,
    endpointRids: { 1: '', 2: '' },
    connected: false,
    statusFields: {}
  };

  const state = {
    mode: 'static',
    effect: 'CHASE',
    colours: ['#FF453A', '#7D5CFF'],
    activeSlot: 0,
    rgbEnabled: true,
    whiteEnabled: false,
    white: 0,
    brightness: 100,
    speed: 24,
    smooth: 92,
    width: 4,
    direction: 'right',
    power: true,
    restartToken: 1
  };

  function loadSavedState() {
    try {
      const candidate = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (candidate && candidate.version === 1 && typeof candidate.receivers === 'object') {
        if (!/^[0-9A-F]{16}$/.test(candidate.installationKey || '')) {
          candidate.installationKey = randomHex64();
        }
        candidate.nextNumber = Math.max(1, Math.min(250, Number(candidate.nextNumber) || 1));
        return candidate;
      }
    } catch (_) {}
    return { version: 1, installationKey: randomHex64(), nextNumber: 1, receivers: {} };
  }

  function persistSavedState() {
    localStorage.setItem(STORE_KEY, JSON.stringify(saved));
  }

  function randomHex64() {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    if (bytes.every((byte) => byte === 0)) bytes[7] = 1;
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  function nextId() {
    sequence = (sequence + 1) % 2147483000;
    if (!sequence) sequence = 1;
    return sequence;
  }

  function parseFields(text) {
    const result = {};
    String(text || '').trim().split(';').forEach((part) => {
      const index = part.indexOf('=');
      if (index > 0) result[part.slice(0, index).trim().toUpperCase()] = part.slice(index + 1).trim();
    });
    return result;
  }

  function bytesToString(value) {
    const view = value instanceof DataView
      ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
      : new Uint8Array(value.buffer || value);
    return decoder.decode(view);
  }

  function friendlyError(error) {
    const name = String(error && error.name || '');
    const message = String(error && error.message || error || 'Onbekende fout');
    if (name === 'NotFoundError') return 'Geen receiver gekozen.';
    if (name === 'SecurityError' || /security|bluetooth.*available/i.test(message)) {
      return 'Open deze link op iPhone in Bluefy. Safari ondersteunt deze Bluetoothverbinding niet.';
    }
    if (/PAIR_DENIED/i.test(message)) return 'Koppelvenster gesloten. Houd BOOT 2 seconden ingedrukt en probeer opnieuw.';
    if (/AUTH_REQUIRED/i.test(message)) return 'Deze receiver gebruikt nog een andere koppeling. Houd BOOT 2 seconden ingedrukt en koppel opnieuw.';
    if (/GATT|NetworkError|disconnected|connect/i.test(message)) return 'Bluetoothverbinding mislukt. Houd BOOT 2 seconden ingedrukt en probeer opnieuw.';
    if (/timeout/i.test(message)) return 'De receiver antwoordde niet op tijd. Probeer opnieuw.';
    return message;
  }

  function setBusy(active, text = 'Verbinden…') {
    $('busyText').textContent = text;
    $('busyOverlay').hidden = !active;
  }

  function showToast(message, isError = false) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.toggle('error', isError);
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2800);
  }

  function setConnectionBadge(connected, label) {
    const badge = $('connectionBadge');
    badge.classList.toggle('connected', connected);
    badge.querySelector('span').textContent = label || (connected ? 'Live verbonden' : 'Niet verbonden');
  }

  function showConnectionScreen() {
    $('connectPanel').hidden = false;
    $('controlPanel').hidden = true;
    setConnectionBadge(false);
  }

  function showController() {
    $('connectPanel').hidden = true;
    $('controlPanel').hidden = false;
    setConnectionBadge(true, 'Live verbonden');
    $('receiverNumber').textContent = String(ble.number || 1);
    $('receiverTypeLabel').textContent = ble.type === 'RGBW' ? 'RGBW RECEIVER' : 'SPI RECEIVER';
    $('receiverName').textContent = `Receiver ${ble.number || 1}`;
    $('detailFirmware').textContent = ble.statusFields.FWVER || ble.statusFields.BUILD || '—';
    $('detailPixels').textContent = ble.type === 'RGBW' ? 'Volledige LED Line' : `${ble.physical} pixels`;
    $('detailStatus').textContent = 'Live verbonden';
    $('detailTransport').textContent = 'Bluetooth';
    $('widthSetting').hidden = ble.type === 'RGBW';
    $('directionSetting').hidden = ble.type === 'RGBW';
    renderEffects();
    updateUi();
  }

  function onDisconnected() {
    ble.connected = false;
    for (const waiter of ackWaiters.values()) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error('Bluetooth disconnected'));
    }
    ackWaiters.clear();
    showConnectionScreen();
    showToast('Bluetoothverbinding gesloten', true);
  }

  function onStatusNotification(event) {
    notificationBuffer += bytesToString(event.target.value);
    if (notificationBuffer.length > 5000) notificationBuffer = notificationBuffer.slice(-2500);
    let newline = notificationBuffer.indexOf('\n');
    while (newline >= 0) {
      const message = notificationBuffer.slice(0, newline).replace(/\r/g, '').trim();
      notificationBuffer = notificationBuffer.slice(newline + 1);
      if (message) receiveMessage(message);
      newline = notificationBuffer.indexOf('\n');
    }
  }

  function receiveMessage(message) {
    const fields = parseFields(message);
    const id = Number(fields.ID || 0);
    if (id && ackWaiters.has(id)) {
      const waiter = ackWaiters.get(id);
      ackWaiters.delete(id);
      clearTimeout(waiter.timer);
      waiter.resolve(fields);
    }
    if (fields.FWVER || fields.PHYSICAL || fields.DEVTYPE) {
      ble.statusFields = { ...ble.statusFields, ...fields };
      if (fields.DEVTYPE === 'RGBW' || fields.DEVTYPE === 'SPI') ble.type = fields.DEVTYPE;
      if (ble.type === 'SPI' && Number(fields.PHYSICAL) > 0) ble.physical = Math.min(1024, Number(fields.PHYSICAL));
      if (fields.PHYSICALREVERSE !== undefined) ble.physicalReverse = fields.PHYSICALREVERSE === '1';
      if (Number(fields.PORTMASK) > 0) ble.portMask = Math.min(3, Number(fields.PORTMASK));
    }
  }

  function waitForAck(id, timeoutMs = 2200) {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        ackWaiters.delete(id);
        reject(new Error('Receiver timeout'));
      }, timeoutMs);
      ackWaiters.set(id, { resolve, reject, timer });
    });
  }

  async function writeCommand(text) {
    if (!ble.connected || !ble.command) throw new Error('Bluetooth disconnected');
    const bytes = encoder.encode(`${text}\n`);
    for (let offset = 0; offset < bytes.length; offset += MAX_WRITE_BYTES) {
      const chunk = bytes.slice(offset, offset + MAX_WRITE_BYTES);
      if (typeof ble.command.writeValueWithoutResponse === 'function') {
        await ble.command.writeValueWithoutResponse(chunk);
      } else if (typeof ble.command.writeValue === 'function') {
        await ble.command.writeValue(chunk);
      } else {
        await ble.command.writeValueWithResponse(chunk);
      }
      if (bytes.length > MAX_WRITE_BYTES) await new Promise((resolve) => window.setTimeout(resolve, 5));
    }
  }

  async function transactNow(fields, timeoutMs = 2200, allowError = false) {
    const id = nextId();
    const ordered = { V: 18, TYPE: fields.TYPE, ID: id, ...fields };
    const command = Object.entries(ordered)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${key}=${value}`)
      .join(';');
    const reply = waitForAck(id, timeoutMs);
    try {
      await writeCommand(command);
      const fieldsReply = await reply;
      if (!allowError && fieldsReply.STATUS === 'ERROR') {
        throw new Error(fieldsReply.DETAIL || 'Receiver error');
      }
      return fieldsReply;
    } catch (error) {
      const waiter = ackWaiters.get(id);
      if (waiter) {
        clearTimeout(waiter.timer);
        ackWaiters.delete(id);
      }
      throw error;
    }
  }

  function transact(fields, timeoutMs = 2200, allowError = false) {
    // Web Bluetooth permits only one GATT write at a time on iOS. Queue the
    // complete write+ACK transaction; rapid sliders then replace pending LIVE
    // state instead of colliding with Identify or another RGBW output.
    const run = () => transactNow(fields, timeoutMs, allowError);
    const queued = transactionTail.then(run, run);
    transactionTail = queued.catch(() => {});
    return queued;
  }

  async function readInfo() {
    const raw = await ble.info.readValue();
    return parseFields(bytesToString(raw));
  }

  async function pairReceiver(info, existing) {
    const token = String(info.TOKEN || '').toUpperCase();
    if (!/^[0-9A-F]{16}$/.test(token)) {
      throw new Error('PAIR_DENIED');
    }
    const number = existing && Number(existing.number) > 0
      ? Number(existing.number)
      : saved.nextNumber;
    const fields = {
      TYPE: 'PAIR',
      TOKEN: token,
      NETWORK: saved.installationKey,
      NUMBER: Math.max(1, Math.min(250, number))
    };
    if (info.DEVTYPE === 'RGBW') fields.PORTMASK = Math.max(1, Math.min(3, Number(info.PORTMASK) || 3));
    const reply = await transact(fields, 3500, true);
    const replyRid = String(reply.RID || reply.TARGETRID || '').toUpperCase();
    const committedLegacyPair = reply.STATUS === 'ERROR' && reply.DETAIL === 'PAIRED' &&
      reply.PAIRED === '1' && replyRid === String(info.RID).toUpperCase();
    const exactModernPair = reply.STATUS === 'OK' &&
      reply.DETAIL === 'PAIRED' && reply.PAIRED === '1' &&
      replyRid === String(info.RID).toUpperCase() &&
      /^[0-9A-F]{16}$/.test(replyRid);
    if (!exactModernPair && !committedLegacyPair) throw new Error(reply.DETAIL || 'PAIR_DENIED');

    ble.number = Number(reply.NUMBER || number) || number;
    saved.receivers[info.RID] = {
      number: ble.number,
      type: info.DEVTYPE === 'RGBW' ? 'RGBW' : 'SPI',
      port1Rid: String(info.PORT1RID || info.RID1 || '').toUpperCase(),
      port2Rid: String(info.PORT2RID || info.RID2 || '').toUpperCase(),
      lastSeen: new Date().toISOString()
    };
    saved.nextNumber = Math.min(250, Math.max(saved.nextNumber, ble.number + 1));
    persistSavedState();
  }

  async function refreshStatus() {
    // A direct RGBW status read is local and therefore deliberately carries no
    // TARGET/DEVTYPE. Supplying them makes an RGBW receiver treat it as a
    // relayed endpoint request and older V18 builds answer TARGET_REQUIRED.
    const request = ble.type === 'RGBW'
      ? { TYPE: 'STATUS' }
      : { TYPE: 'STATUS', TARGET: ble.rid, DEVTYPE: 'SPI' };
    const fields = await transact(request, 3200);
    receiveMessage(Object.entries(fields).map(([key, value]) => `${key}=${value}`).join(';'));
    return fields;
  }

  async function connectReceiver() {
    if (!navigator.bluetooth) {
      $('compatibilityPanel').hidden = false;
      showToast('Open deze link in Bluefy om rechtstreeks te verbinden.', true);
      return;
    }

    setBusy(true, 'Receiver zoeken…');
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [UUIDS.service] }],
        optionalServices: [UUIDS.service]
      });
      device.addEventListener('gattserverdisconnected', onDisconnected);
      setBusy(true, 'Bluetooth verbinden…');
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(UUIDS.service);
      const [command, status, infoCharacteristic] = await Promise.all([
        service.getCharacteristic(UUIDS.command),
        service.getCharacteristic(UUIDS.status),
        service.getCharacteristic(UUIDS.info)
      ]);

      Object.assign(ble, {
        device,
        server,
        command,
        status,
        info: infoCharacteristic,
        connected: true
      });
      notificationBuffer = '';
      status.addEventListener('characteristicvaluechanged', onStatusNotification);
      await status.startNotifications();

      const info = await readInfo();
      if (!/^[0-9A-F]{16}$/i.test(info.RID || '')) throw new Error('Ongeldige receiveridentiteit');
      ble.statusFields = { ...info };
      ble.rid = String(info.RID).toUpperCase();
      ble.type = info.DEVTYPE === 'RGBW' ? 'RGBW' : 'SPI';
      ble.portMask = Math.max(1, Math.min(3, Number(info.PORTMASK) || 3));
      ble.endpointRids = {
        1: String(info.PORT1RID || info.RID1 || '').toUpperCase(),
        2: String(info.PORT2RID || info.RID2 || '').toUpperCase()
      };
      const existing = saved.receivers[ble.rid];
      const wasPaired = info.PAIRED === '1';

      if (!existing && wasPaired) {
        if (!info.TOKEN) throw new Error('AUTH_REQUIRED');
        const approved = window.confirm('Deze receiver was aan een andere bediening gekoppeld. Opnieuw koppelen aan deze iPhone?');
        if (!approved) throw new Error('Koppeling geannuleerd');
      }

      // A physical BOOT/NFC window exposes TOKEN. Pair again in that explicit
      // window even for a remembered receiver, so a stale browser key repairs
      // itself instead of connecting successfully and then failing every LIVE.
      if (!existing || !wasPaired || info.TOKEN) {
        setBusy(true, 'Receiver veilig koppelen…');
        await pairReceiver(info, existing);
      } else {
        ble.number = Number(existing.number) || Number(info.NUMBER) || 1;
        if (!ble.endpointRids[1]) ble.endpointRids[1] = String(existing.port1Rid || '').toUpperCase();
        if (!ble.endpointRids[2]) ble.endpointRids[2] = String(existing.port2Rid || '').toUpperCase();
        existing.lastSeen = new Date().toISOString();
        if (ble.endpointRids[1]) existing.port1Rid = ble.endpointRids[1];
        if (ble.endpointRids[2]) existing.port2Rid = ble.endpointRids[2];
        persistSavedState();
      }

      ble.key = saved.installationKey;
      setBusy(true, 'LED Line controleren…');
      await refreshStatus();
      ble.number = Number(ble.statusFields.NUMBER) || ble.number || 1;
      state.width = Math.min(Math.max(1, state.width), Math.max(1, ble.physical));
      $('widthRange').max = String(Math.max(1, ble.physical));
      setBusy(true, 'Eerste live signaal controleren…');
      await sendCurrentStateVerified();
      showController();
      setBusy(false);
      showToast(`Receiver ${ble.number} is live verbonden`);
    } catch (error) {
      setBusy(false);
      if (ble.device && ble.device.gatt && ble.device.gatt.connected) ble.device.gatt.disconnect();
      showConnectionScreen();
      showToast(friendlyError(error), true);
    }
  }

  function disconnectReceiver() {
    if (ble.device && ble.device.gatt && ble.device.gatt.connected) ble.device.gatt.disconnect();
    else onDisconnected();
  }

  function hexToRgb(hex) {
    const clean = String(hex || '').replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(clean)) return [255, 69, 58];
    return [0, 2, 4].map((index) => parseInt(clean.slice(index, index + 2), 16));
  }

  function rgbToHex(r, g, b) {
    return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
  }

  function hexToHsv(hex) {
    let [r, g, b] = hexToRgb(hex).map((value) => value / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    let hue = 0;
    if (delta) {
      if (max === r) hue = 60 * (((g - b) / delta) % 6);
      else if (max === g) hue = 60 * ((b - r) / delta + 2);
      else hue = 60 * ((r - g) / delta + 4);
    }
    return { h: (hue + 360) % 360, s: max ? delta / max : 0, v: max };
  }

  function hsvToHex(h, s, v = 1) {
    const c = v * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) [r, g] = [c, x];
    else if (h < 120) [r, g] = [x, c];
    else if (h < 180) [g, b] = [c, x];
    else if (h < 240) [g, b] = [x, c];
    else if (h < 300) [r, b] = [x, c];
    else [r, b] = [c, x];
    return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
  }

  function interpolateColour(a, b, amount) {
    const from = hexToRgb(a);
    const to = hexToRgb(b);
    return from.map((value, index) => value + (to[index] - value) * amount);
  }

  function visibleRgb(hex, amount = 1) {
    const rgb = state.rgbEnabled ? hexToRgb(hex) : [0, 0, 0];
    const white = state.whiteEnabled ? state.white : 0;
    const power = state.power ? state.brightness / 100 * amount : 0;
    return rgb.map((value) => Math.min(255, (value + white) * power));
  }

  function wireColour(hex) {
    const rgb = state.rgbEnabled ? hexToRgb(hex) : [0, 0, 0];
    const white = state.whiteEnabled ? Math.round(state.white) : 0;
    return `${rgb[0]},${rgb[1]},${rgb[2]},${white}`;
  }

  function currentEffect() {
    const list = ble.type === 'RGBW' ? RGBW_EFFECTS : SPI_EFFECTS;
    return list.find((effect) => effect.id === state.effect) || list[0];
  }

  function sceneName() {
    if (state.mode === 'static') return ble.type === 'RGBW' ? 'RGBW_SOLID' : 'STATIC';
    return currentEffect().id;
  }

  function rgbwTargets() {
    const result = [];
    for (const port of [1, 2]) {
      if (!(ble.portMask & (1 << (port - 1)))) continue;
      const rid = String(ble.endpointRids[port] || '').toUpperCase();
      if (!/^[0-9A-F]{16}$/.test(rid)) throw new Error(`Poort ${port} heeft geen geldig receiveradres`);
      result.push({ port, rid });
    }
    if (!result.length) throw new Error('Geen RGBW-poort geconfigureerd');
    return result;
  }

  function buildLiveFields(rgbwTarget = null) {
    const effect = currentEffect();
    const pureWarm = state.mode === 'animation' && state.effect === 'WARM';
    const colour1 = pureWarm ? '0,0,0,235' : wireColour(state.colours[0]);
    const colour2 = pureWarm ? '0,0,0,0' : wireColour(state.colours[1]);
    const fields = {
      TYPE: 'LIVE',
      KEY: ble.key,
      TARGET: rgbwTarget ? rgbwTarget.rid : ble.rid,
      DEVTYPE: ble.type,
      SCENE: state.power ? sceneName() : (ble.type === 'RGBW' ? 'RGBW_SOLID' : 'STATIC'),
      VARIANT: 0,
      FG: state.power ? colour1 : '0,0,0,0',
      FG2: state.power ? colour2 : '0,0,0,0',
      FG3: state.power ? colour1 : '0,0,0,0',
      FG4: state.power ? colour2 : '0,0,0,0',
      COLORS: state.mode === 'animation' ? effect.colours : 1,
      BG: '0,0,0,0',
      BGON: 0,
      SPEED: state.speed,
      SMOOTH: state.smooth,
      BRIGHT: state.power ? state.brightness : 0,
      BGBRIGHT: 0,
      SPACING: 50,
      COUNT: 1,
      TRAIL: 45,
      SPREAD: 50,
      RANDOM: 16,
      BOUNCE: state.effect === 'SCANNER' ? 1 : 0,
      MIRROR: 0,
      RESTART: state.restartToken,
      POWER: 100,
      WHITEMIX: 0,
      TRANSITIONMS: 110,
      TEST: 'NONE'
    };

    if (ble.type === 'RGBW') {
      fields.PORT = rgbwTarget.port;
    } else {
      const groupPixels = Math.max(1, Math.min(1024, ble.physical || 60));
      fields.WIDTH = 30;
      fields.WIDTHPX = Math.max(1, Math.min(groupPixels, state.width));
      fields.PIXELS = groupPixels;
      fields.GROUPPIXELS = groupPixels;
      fields.OFFSET = 0;
      fields.LINEINDEX = 0;
      fields.LINECOUNT = 1;
      fields.PARALLEL = 0;
      fields.MOTIONREVERSE = state.direction === 'left' ? 1 : 0;
      fields.PHYSICALREVERSE = ble.physicalReverse ? 1 : 0;
      fields.REVERSE = (state.direction === 'left') !== ble.physicalReverse ? 1 : 0;
    }
    return fields;
  }

  function assertExactAck(fields, targetRid) {
    if (fields.STATUS !== 'OK') throw new Error(fields.DETAIL || 'Receiver error');
    const expected = String(targetRid || '').toUpperCase();
    const returned = String(fields.TARGETRID || '').toUpperCase();
    const delivery = String(fields.TARGETACK || '').toUpperCase();
    if (expected && returned !== expected) throw new Error('Receiver bevestigde een ander doel');
    if (expected && !['1', 'DIRECT', 'OK', 'DELIVERED'].includes(delivery)) {
      throw new Error('Receiver kon het live signaal niet bevestigen');
    }
  }

  async function sendCurrentStateVerified() {
    if (ble.type === 'RGBW') {
      for (const target of rgbwTargets()) {
        const reply = await transact(buildLiveFields(target), 2200);
        assertExactAck(reply, target.rid);
      }
      return;
    }
    const reply = await transact(buildLiveFields(), 2200);
    assertExactAck(reply, ble.rid);
  }

  function scheduleLive(immediate = false) {
    updateUi();
    if (!ble.connected) return;
    liveDirty = true;
    clearTimeout(liveTimer);
    liveTimer = window.setTimeout(flushLive, immediate ? 0 : 70);
  }

  async function flushLive() {
    if (!ble.connected || liveInFlight) return;
    liveInFlight = true;
    $('liveState').classList.add('sending');
    try {
      while (liveDirty && ble.connected) {
        liveDirty = false;
        await sendCurrentStateVerified();
      }
    } catch (error) {
      showToast(friendlyError(error), true);
    } finally {
      liveInFlight = false;
      $('liveState').classList.remove('sending');
      if (liveDirty && ble.connected) liveTimer = window.setTimeout(flushLive, 50);
    }
  }

  async function identifyReceiver() {
    if (!ble.connected) return;
    try {
      if (ble.type === 'RGBW') {
        for (const target of rgbwTargets()) {
          const reply = await transact({
            TYPE: 'LIVE', KEY: ble.key, TARGET: target.rid,
            DEVTYPE: 'RGBW', PORT: target.port, TEST: 'IDENTIFY'
          }, 2200);
          assertExactAck(reply, target.rid);
        }
      } else {
        const fields = {
          TYPE: 'LIVE', KEY: ble.key, TARGET: ble.rid,
          DEVTYPE: 'SPI', TEST: 'IDENTIFY', PIXELS: ble.physical,
          GROUPPIXELS: ble.physical, OFFSET: 0
        };
        const reply = await transact(fields, 2200);
        assertExactAck(reply, ble.rid);
      }
      showToast('De LED Line knippert nu');
    } catch (error) {
      showToast(friendlyError(error), true);
    }
  }

  function miniPreview(effect) {
    if (effect.preview === 'fade') return '<span class="effect-mini fade"></span>';
    const cells = '<i></i>'.repeat(9);
    return `<span class="effect-mini ${effect.preview}">${cells}</span>`;
  }

  function renderEffects() {
    const list = ble.type === 'RGBW' ? RGBW_EFFECTS : SPI_EFFECTS;
    if (!list.some((effect) => effect.id === state.effect)) state.effect = list[0].id;
    $('effectGrid').innerHTML = list.map((effect) => (
      `<button class="effect-card ${state.effect === effect.id ? 'active' : ''}" type="button" data-effect="${effect.id}">${miniPreview(effect)}<b>${effect.name}</b></button>`
    )).join('');
    $('effectGrid').querySelectorAll('[data-effect]').forEach((button) => {
      button.addEventListener('click', () => {
        if (state.effect !== button.dataset.effect) state.restartToken += 1;
        state.effect = button.dataset.effect;
        state.mode = 'animation';
        if (state.effect === 'WARM') {
          state.rgbEnabled = false;
          state.whiteEnabled = true;
          state.white = Math.max(210, state.white);
        }
        renderEffects();
        scheduleLive(true);
      });
    });
  }

  function updateWheel() {
    const colour = state.colours[state.activeSlot];
    const hsv = hexToHsv(colour);
    const radius = hsv.s * 50;
    const angle = hsv.h * Math.PI / 180;
    const pointer = $('wheelPointer');
    pointer.style.left = `${50 + Math.cos(angle) * radius}%`;
    pointer.style.top = `${50 + Math.sin(angle) * radius}%`;
    pointer.style.setProperty('--pointer', colour);
    $('selectedColour').style.background = colour;
    if (document.activeElement !== $('hexColour')) $('hexColour').value = colour;
    $('colorWheel').setAttribute('aria-valuenow', String(Math.round(hsv.h)));
    document.querySelectorAll('.palette-tab').forEach((button, index) => {
      button.classList.toggle('active', index === state.activeSlot);
      button.style.setProperty('--slot', state.colours[index]);
    });
  }

  function updateUi() {
    const effect = currentEffect();
    $('staticModeButton').classList.toggle('active', state.mode === 'static');
    $('animationModeButton').classList.toggle('active', state.mode === 'animation');
    $('effectPanel').hidden = state.mode !== 'animation';
    $('previewLabel').textContent = state.mode === 'static' ? 'Static Color' : effect.name;
    $('paletteTabs').hidden = state.mode === 'static' || effect.colours < 2;
    $('speedSetting').hidden = state.mode === 'static';
    $('smoothSetting').hidden = state.mode === 'static';
    if (ble.type !== 'RGBW') $('widthSetting').hidden = state.mode === 'static';
    $('directionSetting').hidden = ble.type === 'RGBW' || state.mode === 'static' || ['BREATHE', 'WARM', 'SPARKLE'].includes(state.effect);
    $('brightnessRange').value = String(state.brightness);
    $('brightnessValue').textContent = `${state.brightness}%`;
    $('speedRange').value = String(state.speed);
    $('speedValue').textContent = String(state.speed);
    $('smoothRange').value = String(state.smooth);
    $('smoothValue').textContent = `${state.smooth}%`;
    $('widthRange').max = String(Math.max(1, ble.physical || 60));
    $('widthRange').value = String(Math.min(state.width, ble.physical || 60));
    $('widthValue').textContent = `${Math.min(state.width, ble.physical || 60)} px`;
    $('whiteRange').value = String(state.white);
    $('whiteValue').textContent = String(Math.round(state.white));
    $('whiteControl').classList.toggle('disabled', !state.whiteEnabled);
    $('whiteRange').disabled = !state.whiteEnabled;
    $('rgbToggle').classList.toggle('active', state.rgbEnabled);
    $('rgbToggle').setAttribute('aria-pressed', String(state.rgbEnabled));
    $('rgbToggle').querySelector('small').textContent = state.rgbEnabled ? 'Kleur aan' : 'Kleur uit';
    $('whiteToggle').classList.toggle('active', state.whiteEnabled);
    $('whiteToggle').setAttribute('aria-pressed', String(state.whiteEnabled));
    $('whiteToggle').querySelector('small').textContent = state.whiteEnabled ? 'Wit aan' : 'Wit uit';
    $('powerButton').classList.toggle('on', state.power);
    $('powerButton').setAttribute('aria-pressed', String(state.power));
    $('powerButton').querySelector('b').textContent = state.power ? 'Aan' : 'Uit';
    document.querySelectorAll('[data-direction]').forEach((button) => button.classList.toggle('active', button.dataset.direction === state.direction));
    updateWheel();
  }

  function setWheelFromPointer(event) {
    const wheel = $('colorWheel');
    const box = wheel.getBoundingClientRect();
    const x = event.clientX - box.left - box.width / 2;
    const y = event.clientY - box.top - box.height / 2;
    const hue = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    const saturation = Math.min(1, Math.hypot(x, y) / (box.width / 2));
    state.colours[state.activeSlot] = hsvToHex(hue, saturation, 1);
    scheduleLive();
  }

  function setHexColour(value) {
    const normalized = String(value || '').trim().toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(normalized)) {
      $('hexColour').value = state.colours[state.activeSlot];
      showToast('Gebruik een kleur zoals #FF453A', true);
      return;
    }
    state.colours[state.activeSlot] = normalized;
    if (normalized === '#FFFFFF') {
      state.rgbEnabled = false;
      state.whiteEnabled = true;
      state.white = Math.max(235, state.white);
    }
    scheduleLive(true);
  }

  function bindUi() {
    $('connectButton').addEventListener('click', connectReceiver);
    $('disconnectButton').addEventListener('click', disconnectReceiver);
    $('identifyButton').addEventListener('click', identifyReceiver);

    document.querySelectorAll('[data-mode]').forEach((button) => {
      button.addEventListener('click', () => {
        if (state.mode !== button.dataset.mode) state.restartToken += 1;
        state.mode = button.dataset.mode;
        scheduleLive(true);
      });
    });

    document.querySelectorAll('.palette-tab').forEach((button) => {
      button.addEventListener('click', () => {
        state.activeSlot = Number(button.dataset.slot) || 0;
        updateWheel();
      });
    });

    document.querySelectorAll('[data-colour]').forEach((button) => {
      button.addEventListener('click', () => setHexColour(button.dataset.colour));
    });

    $('hexColour').addEventListener('change', (event) => setHexColour(event.target.value));
    $('colorWheel').addEventListener('pointerdown', (event) => {
      wheelDragging = true;
      $('colorWheel').setPointerCapture(event.pointerId);
      setWheelFromPointer(event);
    });
    $('colorWheel').addEventListener('pointermove', (event) => {
      if (wheelDragging) setWheelFromPointer(event);
    });
    const stopWheel = () => { wheelDragging = false; };
    $('colorWheel').addEventListener('pointerup', stopWheel);
    $('colorWheel').addEventListener('pointercancel', stopWheel);
    $('colorWheel').addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      const hsv = hexToHsv(state.colours[state.activeSlot]);
      if (event.key === 'ArrowLeft') hsv.h = (hsv.h + 357) % 360;
      if (event.key === 'ArrowRight') hsv.h = (hsv.h + 3) % 360;
      if (event.key === 'ArrowUp') hsv.s = Math.min(1, hsv.s + .03);
      if (event.key === 'ArrowDown') hsv.s = Math.max(0, hsv.s - .03);
      state.colours[state.activeSlot] = hsvToHex(hsv.h, hsv.s, 1);
      scheduleLive();
    });

    $('rgbToggle').addEventListener('click', () => {
      state.rgbEnabled = !state.rgbEnabled;
      if (!state.rgbEnabled && !state.whiteEnabled) {
        state.whiteEnabled = true;
        state.white = Math.max(235, state.white);
      }
      scheduleLive(true);
    });

    $('whiteToggle').addEventListener('click', () => {
      state.whiteEnabled = !state.whiteEnabled;
      if (state.whiteEnabled && state.white === 0) state.white = 210;
      if (!state.whiteEnabled && !state.rgbEnabled) state.rgbEnabled = true;
      scheduleLive(true);
    });

    const range = (id, valueId, key, suffix = '') => {
      $(id).addEventListener('input', (event) => {
        state[key] = Number(event.target.value);
        $(valueId).textContent = `${state[key]}${suffix}`;
        scheduleLive();
      });
    };
    range('whiteRange', 'whiteValue', 'white');
    range('brightnessRange', 'brightnessValue', 'brightness', '%');
    range('speedRange', 'speedValue', 'speed');
    range('smoothRange', 'smoothValue', 'smooth', '%');
    range('widthRange', 'widthValue', 'width', ' px');

    document.querySelectorAll('[data-direction]').forEach((button) => {
      button.addEventListener('click', () => {
        if (state.direction !== button.dataset.direction) state.restartToken += 1;
        state.direction = button.dataset.direction;
        scheduleLive(true);
      });
    });

    $('powerButton').addEventListener('click', () => {
      state.power = !state.power;
      state.restartToken += 1;
      scheduleLive(true);
    });
  }

  function ensurePreview() {
    const preview = $('ledPreview');
    const wantsAnalogue = ble.type === 'RGBW';
    if (wantsAnalogue && !preview.classList.contains('analogue')) {
      preview.className = 'led-preview analogue';
      preview.innerHTML = '<div class="analogue-line"></div>';
    } else if (!wantsAnalogue && preview.classList.contains('analogue')) {
      preview.className = 'led-preview';
      preview.innerHTML = '<i class="pixel"></i>'.repeat(36);
    } else if (!preview.children.length) {
      preview.innerHTML = wantsAnalogue ? '<div class="analogue-line"></div>' : '<i class="pixel"></i>'.repeat(36);
      preview.classList.toggle('analogue', wantsAnalogue);
    }
  }

  function setPixelVisual(pixel, rgb, amount) {
    const red = Math.round(rgb[0]);
    const green = Math.round(rgb[1]);
    const blue = Math.round(rgb[2]);
    const opacity = Math.max(.08, Math.min(1, amount));
    pixel.style.background = `rgb(${red} ${green} ${blue})`;
    pixel.style.boxShadow = amount > .12 ? `0 0 ${4 + 13 * amount}px rgb(${red} ${green} ${blue} / ${.2 + amount * .55})` : 'none';
    pixel.style.opacity = String(opacity);
  }

  function renderPreview(timeMs) {
    if (timeMs - lastPreviewFrame < 28) {
      requestAnimationFrame(renderPreview);
      return;
    }
    lastPreviewFrame = timeMs;
    ensurePreview();
    const speed = .018 + Math.pow(state.speed / 100, 2) * 1.65;
    const phase = (timeMs / 1000 * speed) % 1;
    const effect = sceneName();

    if (ble.type === 'RGBW') {
      let amount = 1;
      let blend = 0;
      if (!state.power) amount = 0;
      else if (/PULSE|FADE/.test(effect) && !/COLOR/.test(effect)) amount = .08 + .92 * (.5 - .5 * Math.cos(phase * Math.PI * 2));
      else if (/STROBE/.test(effect)) amount = phase < .16 ? 1 : .03;
      else if (/COLOR_FADE|SMOOTH/.test(effect)) blend = .5 - .5 * Math.cos(phase * Math.PI * 2);
      const mixed = interpolateColour(state.colours[0], state.colours[1], blend);
      const base = rgbToHex(mixed[0], mixed[1], mixed[2]);
      const rgb = visibleRgb(base, amount);
      setPixelVisual($('ledPreview').firstElementChild, rgb, state.power ? amount : 0);
      requestAnimationFrame(renderPreview);
      return;
    }

    const pixels = Array.from($('ledPreview').children);
    const count = pixels.length;
    pixels.forEach((pixel, index) => {
      const position = index / Math.max(1, count - 1);
      let amount = 1;
      let blend = 0;
      if (!state.power) amount = 0;
      else if (state.mode === 'static' || effect === 'WARM') amount = 1;
      else if (effect === 'BREATHE') amount = .06 + .94 * (.5 - .5 * Math.cos(phase * Math.PI * 2));
      else if (effect === 'GRADIENT') blend = (position + (state.direction === 'left' ? phase : 1 - phase)) % 1;
      else if (effect === 'WAVE') {
        amount = .12 + .88 * (.5 + .5 * Math.sin((position * 2 - phase * 2) * Math.PI * 2));
        blend = position;
      } else if (effect === 'SPARKLE') {
        const spark = Math.sin((index * 71.7 + Math.floor(timeMs / 130) * 19.3));
        amount = spark > .82 ? 1 : .06;
      } else {
        const direction = state.direction === 'left' ? -1 : 1;
        let center = (phase * direction + 2) % 1;
        if (effect === 'SCANNER') center = 1 - Math.abs(2 * phase - 1);
        let distance = Math.abs(position - center);
        distance = Math.min(distance, 1 - distance);
        const width = Math.max(.018, state.width / Math.max(1, ble.physical));
        amount = Math.max(0, 1 - distance / Math.max(width, effect === 'COMET' ? .18 : .08));
        if (effect === 'COMET' && state.direction === 'right' && position > center) amount *= .12;
        if (effect === 'COMET' && state.direction === 'left' && position < center) amount *= .12;
        amount = Math.pow(amount, .55 + (100 - state.smooth) / 80);
      }
      const mixed = interpolateColour(state.colours[0], state.colours[1], blend);
      const colour = effect === 'WARM' ? '#FFF0D5' : rgbToHex(mixed[0], mixed[1], mixed[2]);
      const rgb = effect === 'WARM'
        ? [255, 226, 180].map((value) => value * state.brightness / 100 * amount)
        : visibleRgb(colour, amount);
      setPixelVisual(pixel, rgb, amount);
    });
    requestAnimationFrame(renderPreview);
  }

  function start() {
    bindUi();
    ensurePreview();
    renderEffects();
    updateUi();
    requestAnimationFrame(renderPreview);
    const bluetoothAvailable = Boolean(navigator.bluetooth);
    $('compatibilityPanel').hidden = bluetoothAvailable;
    if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      $('compatibilityPanel').hidden = false;
      $('compatibilityPanel').querySelector('strong').textContent = 'Beveiligde link nodig';
      $('compatibilityPanel').querySelector('p').textContent = 'Open de HTTPS-link van deze pagina om Bluetooth te gebruiken.';
    }
    if ('serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    }
  }

  document.addEventListener('DOMContentLoaded', start);
})();
