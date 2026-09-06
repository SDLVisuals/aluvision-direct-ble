/* Existing SPI receiver geometry setup.
 *
 * New receivers already use the V20 commissioning journey. This layer gives
 * an existing receiver the same strict order:
 *   1. pixel count (white guide + red endpoint)
 *   2. receiver side (white guide + green start pixel)
 * The saved animation is only restored after Cancel or Confirm.
 */
(() => {
  'use strict';

  if (window.__aluvisionReceiverGeometryV2061) return;
  window.__aluvisionReceiverGeometryV2061 = true;

  const original = {
    start: window.startPixelCalibration,
    render: window.renderPixelCalibration,
    cancel: window.cancelPixelCalibration,
    confirm: window.confirmPixelCalibration,
    setSide: window.setCalibrationMountingSide,
    queue: window.queueCalibrationLive
  };
  if (typeof original.start !== 'function' || typeof original.confirm !== 'function') return;

  const MAX_PIXELS = 1024;
  const DEBOUNCE_MS = 18;
  const transport = {
    generation: 0,
    inFlight: false,
    pending: null,
    timer: 0,
    lease: 0,
    lastStartedAt: 0,
    misses: 0
  };
  let requestedPhase = 'length';

  function tx(nl, en, fr, de) {
    try { return typeof window.ac === 'function' ? window.ac(nl, en, fr, de) : nl; }
    catch (_) { return nl; }
  }

  function safe(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;').replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function calibration() {
    try { return window.AluvisionReceiverGeometryRuntime?.current?.() || null; }
    catch (_) { return null; }
  }

  function clampPixels(value, fallback = 1) {
    const parsed = Number.parseInt(value, 10);
    const backup = Number.parseInt(fallback, 10);
    return Math.max(1, Math.min(MAX_PIXELS, Number.isFinite(parsed) ? parsed : (Number.isFinite(backup) ? backup : 1)));
  }

  function deviceFor(current) {
    try { return (db?.devices || []).find((item) => item.id === current?.deviceId) || null; }
    catch (_) { return null; }
  }

  function stepper(phase) {
    const length = phase === 'length';
    return `<ol class="v20-stepper alv-geometry-stepper" style="--step-count:2" aria-label="${tx('Instellen in twee stappen', 'Set up in two steps', 'Configuration en deux étapes', 'Einrichtung in zwei Schritten')}">
      <li class="${length ? 'on' : 'done'}"><i>${length ? '1' : '✓'}</i><span>${tx('PIXELS', 'PIXELS', 'PIXELS', 'PIXEL')}</span></li>
      <li class="${length ? '' : 'on'}"><i>2</i><span>${tx('AANSLUITING', 'CONNECTION', 'CONNEXION', 'ANSCHLUSS')}</span></li>
    </ol>`;
  }

  function cells(mode, reversed = false) {
    return Array.from({ length: 18 }, (_, index) => {
      let marker = 'fill';
      if (mode === 'length' && index === 17) marker = 'red';
      if (mode === 'side' && index === (reversed ? 17 : 0)) marker = 'start';
      return `<i class="${marker}"></i>`;
    }).join('');
  }

  function status(message, state = 'working') {
    const node = document.getElementById('calibrationLiveStatus');
    if (!node) return;
    node.dataset.state = state;
    node.textContent = message;
  }

  function stopTransport() {
    transport.generation += 1;
    transport.pending = null;
    transport.inFlight = false;
    clearTimeout(transport.timer);
    clearTimeout(transport.lease);
    transport.timer = 0;
    transport.lease = 0;
  }

  function snapshot() {
    const current = calibration();
    if (!current) return null;
    return {
      generation: transport.generation,
      session: current.session,
      deviceId: current.deviceId,
      phase: current.geometryPhase === 'side' ? 'side' : 'length',
      pixels: clampPixels(current.candidate, current.original),
      reversed: Boolean(current.reversed)
    };
  }

  function stillCurrent(item) {
    const current = calibration();
    return Boolean(current?.active && !current.saving &&
      item.generation === transport.generation &&
      item.deviceId === current.deviceId &&
      item.session === current.session);
  }

  function armLease(item) {
    clearTimeout(transport.lease);
    if (!stillCurrent(item)) return;
    transport.lease = setTimeout(() => schedulePreview(true), 1400);
  }

  async function drainPreview() {
    if (transport.inFlight || !transport.pending) return;
    const item = transport.pending;
    transport.pending = null;
    transport.inFlight = true;
    status(item.phase === 'side'
      ? tx('Groene beginpixel bijwerken…', 'Updating green start pixel…', 'Mise à jour du pixel vert…', 'Grüner Startpixel wird aktualisiert…')
      : tx('Witte lijn en rode eindpixel bijwerken…', 'Updating white line and red endpoint…', 'Mise à jour de la ligne blanche et du pixel rouge…', 'Weiße Linie und roter Endpixel werden aktualisiert…'));

    let result = {};
    try {
      const action = item.phase === 'side' ? 'calibrate_start' : 'calibrate_end';
      result = await window.AluvisionReceiverGeometryRuntime?.send?.(action, item.pixels) || {};
    } catch (_) {
      result = {};
    } finally {
      if (item.generation === transport.generation) transport.inFlight = false;
    }

    if (!stillCurrent(item)) return;
    if (transport.pending) {
      schedulePreview(true);
      return;
    }

    const confirmed = Boolean(result.confirmed || result.accepted || result.delivered || result.gatewayAck);
    const online = confirmed || Boolean(result.online);
    transport.misses = online ? 0 : transport.misses + 1;
    if (item.phase === 'side') {
      status(online
        ? (item.reversed
          ? tx('Groene beginpixel staat rechts', 'Green start pixel is on the right', 'Le pixel vert est à droite', 'Grüner Startpixel ist rechts')
          : tx('Groene beginpixel staat links', 'Green start pixel is on the left', 'Le pixel vert est à gauche', 'Grüner Startpixel ist links'))
        : tx('Verbinding wordt automatisch hersteld…', 'Reconnecting automatically…', 'Reconnexion automatique…', 'Verbindung wird automatisch wiederhergestellt…'),
      online ? 'online' : (transport.misses < 3 ? 'sent' : 'offline'));
    } else {
      status(online
        ? (item.pixels === 1
          ? tx('Pixel 1 is rood', 'Pixel 1 is red', 'Le pixel 1 est rouge', 'Pixel 1 ist rot')
          : tx(`Pixels 1–${item.pixels - 1} zijn wit · pixel ${item.pixels} is rood`, `Pixels 1–${item.pixels - 1} are white · pixel ${item.pixels} is red`, `Les pixels 1–${item.pixels - 1} sont blancs · le pixel ${item.pixels} est rouge`, `Pixel 1–${item.pixels - 1} sind weiß · Pixel ${item.pixels} ist rot`))
        : tx('Verbinding wordt automatisch hersteld…', 'Reconnecting automatically…', 'Reconnexion automatique…', 'Verbindung wird automatisch wiederhergestellt…'),
      online ? 'online' : (transport.misses < 3 ? 'sent' : 'offline'));
    }
    armLease(item);
  }

  function schedulePreview(immediate = false) {
    const current = calibration();
    if (!current?.active || current.saving) return;
    clearTimeout(transport.lease);
    transport.pending = snapshot();
    clearTimeout(transport.timer);
    if (transport.inFlight) return;
    const elapsed = performance.now() - transport.lastStartedAt;
    const delay = immediate || elapsed >= DEBOUNCE_MS ? 0 : DEBOUNCE_MS - elapsed;
    transport.timer = setTimeout(() => {
      transport.lastStartedAt = performance.now();
      drainPreview();
    }, Math.max(0, delay));
  }

  function renderLength(current, device) {
    const pixels = clampPixels(current.candidate, current.original);
    current.candidate = pixels;
    modal(`<section class="v20-commission alv-existing-geometry" data-phase="length" data-existing-receiver-calibration="length">
      ${stepper('length')}
      <header><span><div class="eyebrow">${tx('STAP 1 · PIXELS', 'STEP 1 · PIXELS', 'ÉTAPE 1 · PIXELS', 'SCHRITT 1 · PIXEL')}</div><h1>${tx('Zoek de laatste pixel', 'Find the final pixel', 'Trouvez le dernier pixel', 'Finde den letzten Pixel')}</h1><p>${tx('Schuif tot de rode pixel precies op het einde van de echte LED Line staat.', 'Slide until the red pixel is exactly at the end of the real LED Line.', 'Faites glisser jusqu’à ce que le pixel rouge soit exactement au bout de la LED Line.', 'Schiebe, bis der rote Pixel genau am Ende der echten LED Line steht.')}</p></span><b class="live-indicator">LIVE</b></header>
      <section class="v20-live-card">
        <div id="calibrationLiveStatus" class="calibration-live red-end" data-state="working" aria-live="polite">${tx('Witte lijn en rode eindpixel starten…', 'Starting white line and red endpoint…', 'Démarrage de la ligne blanche et du pixel rouge…', 'Weiße Linie und roter Endpixel werden gestartet…')}</div>
        <div class="v20-strip-preview end" aria-label="${tx('Witte pixels met een rode eindpixel', 'White pixels with a red endpoint', 'Pixels blancs avec un pixel final rouge', 'Weiße Pixel mit rotem Endpixel')}">${cells('length')}</div>
        <div class="v20-big-number"><button type="button" onclick="adjustCalibrationPixels(-1)" aria-label="− 1">−</button><label><input id="calibrationPixels" type="number" inputmode="numeric" min="1" max="${MAX_PIXELS}" value="${pixels}" oninput="setCalibrationPixels(this.value,true)"><small>PIXELS</small></label><button type="button" onclick="adjustCalibrationPixels(1)" aria-label="＋ 1">＋</button></div>
        <input id="calibrationRange" class="v20-range" aria-label="${tx('Aantal pixels', 'Pixel count', 'Nombre de pixels', 'Pixelanzahl')}" type="range" min="1" max="${MAX_PIXELS}" step="1" value="${pixels}" oninput="setCalibrationPixels(this.value)">
        <div class="v20-range-label"><span>1</span><b id="calibrationCount">${pixels} ${tx('pixels', 'pixels', 'pixels', 'Pixel')}</b><span>${MAX_PIXELS}</span></div>
        <span id="calibrationMetres" class="alv-geometry-metres">${typeof metres === 'function' ? safe(metres(pixels)) : ''}</span>
        <div class="calibration-stepper alv-geometry-adjust"><button class="button soft" onclick="adjustCalibrationPixels(-10)">− 10</button><button class="button soft" onclick="adjustCalibrationPixels(-1)">− 1</button><button class="button soft" onclick="adjustCalibrationPixels(1)">＋ 1</button><button class="button soft" onclick="adjustCalibrationPixels(10)">＋ 10</button></div>
        <div class="v20-calibration-help"><span><i class="red"></i><b>${tx('Rood op het einde', 'Red at the end', 'Rouge à la fin', 'Rot am Ende')}</b><small>${tx('Aantal klopt', 'Count is correct', 'Le nombre est correct', 'Anzahl stimmt')}</small></span><span><i>−</i><b>${tx('Geen rood zichtbaar', 'No red visible', 'Pas de rouge visible', 'Kein Rot sichtbar')}</b><small>${tx('Aantal verlagen', 'Lower the count', 'Réduire le nombre', 'Anzahl verringern')}</small></span><span><i>＋</i><b>${tx('Rood te vroeg', 'Red too early', 'Rouge trop tôt', 'Rot zu früh')}</b><small>${tx('Aantal verhogen', 'Raise the count', 'Augmenter le nombre', 'Anzahl erhöhen')}</small></span></div>
      </section>
      <footer><button class="button soft" onclick="cancelPixelCalibration()">${tx('Annuleren', 'Cancel', 'Annuler', 'Abbrechen')}</button><button class="button" onclick="v2061ContinueReceiverSide()">${tx('Verder', 'Continue', 'Continuer', 'Weiter')} →</button></footer>
    </section>`);
  }

  function renderSide(current, device) {
    const right = Boolean(current.reversed);
    modal(`<section class="v20-commission alv-existing-geometry" data-phase="side" data-existing-receiver-calibration="side">
      ${stepper('side')}
      <header><span><div class="eyebrow">${tx('STAP 2 · AANSLUITING', 'STEP 2 · CONNECTION', 'ÉTAPE 2 · CONNEXION', 'SCHRITT 2 · ANSCHLUSS')}</div><h1>${tx('Aan welke kant van de LED-strip zit de receiver?', 'Which side of the LED Line is the receiver on?', 'De quel côté de la LED Line se trouve le récepteur ?', 'Auf welcher Seite der LED Line sitzt der Receiver?')}</h1><p>${tx('Tik links of rechts. De groene pixel verschijnt naast de echte receiver.', 'Tap left or right. The green pixel appears next to the real receiver.', 'Touchez gauche ou droite. Le pixel vert apparaît près du récepteur.', 'Tippe links oder rechts. Der grüne Pixel erscheint neben dem echten Receiver.')}</p></span><b class="live-indicator">LIVE</b></header>
      <section class="v20-live-card">
        <div id="calibrationLiveStatus" class="calibration-live" data-state="working" aria-live="polite">${tx('Groene beginpixel starten…', 'Starting green start pixel…', 'Démarrage du pixel vert…', 'Grüner Startpixel wird gestartet…')}</div>
        <div class="v20-side-stage ${right ? 'right' : 'left'}"><div class="v20-receiver-glyph"><b>R</b><i></i></div><div class="v20-strip-preview start">${cells('side', right)}</div></div>
        <div class="v20-side-options" role="radiogroup" aria-label="${tx('Kant van de receiver', 'Receiver side', 'Côté du récepteur', 'Receiver-Seite')}">
          <button class="${right ? '' : 'on'}" role="radio" aria-checked="${!right}" onclick="v2061SetReceiverSide('left')"><span class="v20-side-icon receiver-left"><i>R</i><b></b></span><strong>${tx('Receiver links', 'Receiver left', 'Récepteur à gauche', 'Receiver links')}</strong></button>
          <button class="${right ? 'on' : ''}" role="radio" aria-checked="${right}" onclick="v2061SetReceiverSide('right')"><span class="v20-side-icon receiver-right"><b></b><i>R</i></span><strong>${tx('Receiver rechts', 'Receiver right', 'Récepteur à droite', 'Receiver rechts')}</strong></button>
        </div>
      </section>
      <footer><button class="button soft" onclick="v2061BackToReceiverPixels()">← ${tx('Terug', 'Back', 'Retour', 'Zurück')}</button><button class="button" onclick="v2061SaveReceiverGeometry()">${tx('Opslaan', 'Save', 'Enregistrer', 'Speichern')}</button></footer>
    </section>`);
  }

  function renderCurrent() {
    const current = calibration();
    if (!current?.active) return original.render?.();
    try {
      if (typeof realGuide === 'object' && realGuide?.active) return original.render?.();
    } catch (_) {}
    current.geometryPhase = current.geometryPhase === 'side' ? 'side' : requestedPhase;
    const device = deviceFor(current);
    if (!device) return original.render?.();
    if (current.geometryPhase === 'side') renderSide(current, device);
    else renderLength(current, device);
    requestAnimationFrame(() => {
      const body = document.getElementById('modalBody');
      if (body) body.scrollTop = 0;
    });
  }

  window.queueCalibrationLive = schedulePreview;
  window.AluvisionReceiverGeometryRuntime?.setQueue?.(schedulePreview);
  window.renderPixelCalibration = renderCurrent;

  window.startPixelCalibration = function startExistingReceiverGeometry(id) {
    stopTransport();
    transport.misses = 0;
    requestedPhase = 'length';
    const result = original.start.call(this, id);
    const current = calibration();
    if (current?.active) {
      current.geometryPhase = 'length';
      renderCurrent();
      schedulePreview(true);
    }
    return result;
  };

  window.v2061ContinueReceiverSide = function continueReceiverSide() {
    const current = calibration();
    if (!current?.active || current.saving) return;
    requestedPhase = current.geometryPhase = 'side';
    renderCurrent();
    schedulePreview(true);
  };

  window.v2061BackToReceiverPixels = function backToReceiverPixels() {
    const current = calibration();
    if (!current?.active || current.saving) return;
    requestedPhase = current.geometryPhase = 'length';
    renderCurrent();
    schedulePreview(true);
  };

  window.v2061SetReceiverSide = function setReceiverSide(side) {
    const current = calibration();
    if (!current?.active || current.saving) return;
    current.geometryPhase = 'side';
    if (typeof original.setSide === 'function') original.setSide.call(this, side);
    else current.reversed = side === 'right';
    renderCurrent();
    schedulePreview(true);
  };

  window.v2061SaveReceiverGeometry = async function saveReceiverGeometry() {
    const current = calibration();
    if (!current?.active || current.saving) return;
    stopTransport();
    return original.confirm.call(this);
  };

  window.cancelPixelCalibration = async function cancelExistingReceiverGeometry(...args) {
    stopTransport();
    return original.cancel?.apply(this, args);
  };

  window.confirmPixelCalibration = async function confirmExistingReceiverGeometry(...args) {
    stopTransport();
    return original.confirm.apply(this, args);
  };

  /* Keep classic-script global aliases in sync with the late overrides. */
  try { queueCalibrationLive = window.queueCalibrationLive; } catch (_) {}
  try { renderPixelCalibration = window.renderPixelCalibration; } catch (_) {}
  try { startPixelCalibration = window.startPixelCalibration; } catch (_) {}
  try { cancelPixelCalibration = window.cancelPixelCalibration; } catch (_) {}
  try { confirmPixelCalibration = window.confirmPixelCalibration; } catch (_) {}

  const style = document.createElement('style');
  style.dataset.receiverGeometry = '20.6.2';
  style.textContent = `
    .alv-existing-geometry{min-width:0}
    .alv-geometry-stepper{max-width:430px;margin-inline:auto;width:100%}
    .alv-existing-geometry .v20-live-card{overflow:hidden}
    .alv-existing-geometry .alv-geometry-metres{display:block;margin-top:-9px;color:var(--mut);font-size:9px;font-weight:850;text-align:center}
    .alv-existing-geometry .alv-geometry-adjust{margin-top:0}
    .alv-existing-geometry .v20-side-stage .v20-strip-preview{min-height:78px}
    .alv-existing-geometry footer .button:last-child{background:var(--ink);border-color:var(--ink);color:var(--panel)}
    body.dark .alv-existing-geometry footer .button:last-child{background:#f0f1ef;border-color:#f0f1ef;color:#171917}
    @media(max-width:620px){
      .alv-existing-geometry header{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px}
      .alv-existing-geometry header h1{font-size:clamp(24px,7vw,31px)}
      .alv-existing-geometry .alv-geometry-adjust{grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}
      .alv-existing-geometry .alv-geometry-adjust .button{min-width:0;padding-inline:5px}
    }
  `;
  document.head.appendChild(style);
})();
