/*
 * Aluvision Lighting Control — next-release integration layer.
 *
 * This file deliberately sits after the proven application. It owns the
 * commissioning state machine and a handful of release-wide invariants while
 * the older UI is consolidated incrementally. Keeping those boundaries here
 * makes the safety-critical setup flow testable without another stack of
 * anonymous inline overrides.
 */
(() => {
  'use strict';

  const RELEASE = Object.freeze({ version: '20.0.0', channel: 'hardware-acceptance', protocol: 18 });
  const MAX_SPI_PIXELS = 1024;
  const CALIBRATION_DEBOUNCE_MS = 85;
  const flow = {
    active: false,
    phase: 'idle',
    deviceId: '',
    directZoneId: '',
    directGroupId: '',
    generation: 0,
    timer: 0,
    leaseTimer: 0,
    inFlight: false,
    pending: null,
    lastAck: false,
    configurationStored: false,
    receiverType: 'SPI',
    needsSecurity: false,
    securityComplete: false,
    recoveryKey: '',
    resumePairing: null
  };
  let privatePairTarget = null;
  let privatePairPollTimer = 0;
  let privatePairCheckInFlight = false;
  let privatePairInFlight = false;
  let privatePairAutoRequested = false;
  let privatePairAutoStarted = false;

  window.AluvisionRelease = RELEASE;

  const base = {
    startPairing: window.startPairing,
    startPairingForGroup: window.startPairingForGroup,
    pairStep: window.pairStep,
    finishPairingWizard: window.finishPairingWizard,
    closeModal: window.closeModal,
    render: window.render,
    modal: window.modal,
    settings: window.settings,
    devices: window.devices,
    configureReceiverPhysical: window.configureReceiverPhysical
  };

  function tx(nl, en, fr, de) {
    return typeof window.ac === 'function' ? ac(nl, en, fr, de) : nl;
  }

  function safe(value) {
    return typeof window.esc === 'function' ? esc(String(value ?? '')) : String(value ?? '')
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  }

  function spiDevice(id = flow.deviceId) {
    return (db.devices || []).find((item) => item.id === id);
  }

  function isRgbw(device) {
    return typeof window.receiverTypeOf === 'function'
      ? receiverTypeOf(device) === 'RGBW'
      : String(device?.receiverType || '').toUpperCase() === 'RGBW';
  }

  function clampPixels(value, fallback = 25) {
    const parsed = Number(value);
    return Math.max(1, Math.min(MAX_SPI_PIXELS, Number.isFinite(parsed) ? Math.round(parsed) : fallback));
  }

  function pixelLabel(count) {
    return `${count} ${count === 1 ? tx('pixel', 'pixel', 'pixel', 'Pixel') : tx('pixels', 'pixels', 'pixels', 'Pixel')}`;
  }

  function reachable(device) {
    return typeof window.receiverReachable === 'function'
      ? receiverReachable(device)
      : Boolean(device?.online || device?.reachableViaGateway || device?.espNowReachable);
  }

  function calibrationTarget(snapshot) {
    const device = spiDevice(snapshot.deviceId);
    let target;
    if (typeof window.receiverConfigTarget === 'function') {
      target = receiverConfigTarget(device, snapshot.pixels, snapshot.reversed);
    } else {
      target = {
        id: `commission-${snapshot.deviceId}`,
        deviceId: snapshot.deviceId,
        rid: device?.rid,
        hardwareId: device?.hardwareId,
        receiverType: 'SPI',
        pixels: snapshot.pixels,
        offset: 0,
        groupPixels: snapshot.pixels,
        reversed: snapshot.reversed
      };
    }
    return {
      ...target,
      receiverType: 'SPI',
      pixels: snapshot.pixels,
      physical: snapshot.pixels,
      physicalLeds: snapshot.pixels,
      groupPixels: snapshot.pixels,
      reversed: snapshot.reversed,
      physicalReverse: snapshot.reversed,
      calibration: snapshot.mode === 'end' ? 'END_PIXEL' : snapshot.mode === 'start' ? 'START_PIXEL' : 'CLEAR',
      calibrationNonce: snapshot.nonce
    };
  }

  function snapshot(mode = flow.phase) {
    return {
      deviceId: flow.deviceId,
      pixels: clampPixels(pairDraft?.pixels, spiDevice()?.pixels || 25),
      reversed: Boolean(pairDraft?.reversed),
      mode,
      generation: flow.generation,
      nonce: `${Date.now().toString(36)}-${flow.generation}`
    };
  }

  function status(message, state = 'working') {
    const node = document.getElementById('v20CommissionStatus');
    if (!node) return;
    node.dataset.state = state;
    node.textContent = message;
  }

  async function sendCalibration(item) {
    const action = item.mode === 'end'
      ? 'calibrate_end'
      : item.mode === 'start'
        ? 'calibrate_start'
        : 'calibrate_clear';
    const response = await api('/api/command', {
      action,
      state: {
        receiverType: 'SPI',
        physicalLeds: item.pixels,
        physicalReverse: item.reversed,
        calibration: calibrationTarget(item).calibration,
        calibrationNonce: item.nonce
      },
      targets: [calibrationTarget(item)]
    });
    const result = response?.results?.[0] || {};
    return {
      online: Boolean(result.online || result.accepted || result.delivered || result.gatewayAck),
      confirmed: Boolean(result.confirmed || result.accepted || result.delivered),
      detail: result.detail || ''
    };
  }

  async function drainCalibration() {
    if (!flow.active || flow.inFlight || !flow.pending) return;
    const item = flow.pending;
    flow.pending = null;
    flow.inFlight = true;
    status(tx('Echte LED Line bijwerken…', 'Updating the real LED Line…', 'Mise à jour de la LED Line…', 'Echte LED Line wird aktualisiert…'));
    let result = { online: false, confirmed: false };
    try {
      result = await sendCalibration(item);
    } catch (_) {
      result = { online: false, confirmed: false };
    } finally {
      flow.inFlight = false;
    }
    if (!flow.active || item.generation !== flow.generation) return;
    flow.lastAck = result.confirmed;
    if (flow.pending) {
      scheduleCalibration(true);
      return;
    }
    if (result.confirmed) {
      status(
        item.mode === 'end'
          ? tx(`Rode eindpixel staat live op pixel ${item.pixels}`, `Red end pixel is live at pixel ${item.pixels}`, `Le pixel final rouge est actif au pixel ${item.pixels}`, `Roter Endpixel ist live auf Pixel ${item.pixels}`)
          : tx('Groene beginpixel staat live aan de gekozen kant', 'Green start pixel is live on the selected side', 'Le pixel vert de départ est actif du côté choisi', 'Grüner Startpixel ist auf der gewählten Seite aktiv'),
        'online'
      );
    } else if (result.online) {
      status(tx('Commando ontvangen · controleer de LED Line', 'Command received · check the LED Line', 'Commande reçue · vérifiez la LED Line', 'Befehl empfangen · LED Line prüfen'), 'sent');
    } else {
      status(tx('Receiver niet bereikbaar · controleer de privéverbinding', 'Receiver unavailable · check the private connection', 'Récepteur inaccessible · vérifiez la connexion privée', 'Receiver nicht erreichbar · private Verbindung prüfen'), 'offline');
    }
    armCalibrationLease();
  }

  /* Firmware diagnostics deliberately expire if a controller disappears.
     While either setup screen is visibly active, renew that safety lease so
     no saved animation can reappear before the customer presses Back,
     Cancel, Continue or Confirm. */
  function armCalibrationLease() {
    clearTimeout(flow.leaseTimer);
    flow.leaseTimer = 0;
    if (!flow.active || !['length', 'side'].includes(flow.phase)) return;
    const expectedGeneration = flow.generation;
    const expectedPhase = flow.phase;
    flow.leaseTimer = setTimeout(() => {
      flow.leaseTimer = 0;
      if (!flow.active || flow.generation !== expectedGeneration || flow.phase !== expectedPhase) return;
      scheduleCalibration(true, expectedPhase);
    }, 2200);
  }

  function scheduleCalibration(immediate = false, mode = flow.phase) {
    if (!flow.active || !['length', 'side'].includes(flow.phase)) return;
    clearTimeout(flow.leaseTimer);
    flow.leaseTimer = 0;
    flow.pending = snapshot(mode === 'length' ? 'end' : 'start');
    clearTimeout(flow.timer);
    if (flow.inFlight) return;
    flow.timer = setTimeout(drainCalibration, immediate ? 0 : CALIBRATION_DEBOUNCE_MS);
  }

  function clearCalibration(restore = true) {
    if (!flow.active || flow.receiverType !== 'SPI' || !pairDraft?.deviceId) return Promise.resolve();
    const item = snapshot('clear');
    flow.generation += 1;
    flow.pending = null;
    flow.inFlight = false;
    clearTimeout(flow.timer);
    clearTimeout(flow.leaseTimer);
    flow.leaseTimer = 0;
    return sendCalibration(item).catch(() => {}).finally(() => {
      if (!restore) return;
      const assigned = typeof window.assignedDevice === 'function' ? assignedDevice(item.deviceId) : null;
      if (assigned && typeof window.queueLive === 'function') queueLive(assigned.g);
    });
  }

  function installationReceiverIds() {
    return new Set((install?.zones || []).flatMap((item) => (item.groups || []))
      .flatMap((item) => (item.receivers || []))
      .map((item) => String(item.deviceId || '')).filter(Boolean));
  }

  function zoneReceiverIds(selectedZone) {
    return new Set((selectedZone?.groups || []).flatMap((item) => (item.receivers || []))
      .map((item) => String(item.deviceId || '')).filter(Boolean));
  }

  function ensureZoneMainReceivers() {
    let changed = false;
    (install?.zones || []).forEach((selectedZone) => {
      const ids = [...zoneReceiverIds(selectedZone)];
      if (!ids.length) {
        if (selectedZone.mainReceiverId) { delete selectedZone.mainReceiverId; changed = true; }
      } else if (!ids.includes(String(selectedZone.mainReceiverId || ''))) {
        selectedZone.mainReceiverId = ids[0];
        changed = true;
      }
    });
    return changed;
  }

  function commissioningSteps() {
    const labels = [];
    if (flow.needsSecurity) labels.push({ key: 'security', label: tx('Beveiliging', 'Security', 'Sécurité', 'Sicherheit') });
    if (flow.receiverType === 'SPI') {
      labels.push({ key: 'length', label: tx('Pixels', 'Pixels', 'Pixels', 'Pixel') });
      labels.push({ key: 'side', label: tx('Aansluiting', 'Connection', 'Connexion', 'Anschluss') });
    } else {
      labels.push({ key: 'ports', label: tx('Poorten', 'Ports', 'Ports', 'Ports') });
    }
    labels.push({ key: 'destination', label: tx('Indelen', 'Assign', 'Affecter', 'Zuordnen') });
    labels.push({ key: 'review', label: tx('Toevoegen', 'Add', 'Ajouter', 'Hinzufügen') });
    return labels;
  }

  function stepDots(activeKey) {
    const steps = commissioningSteps();
    const active = Math.max(0, steps.findIndex((item) => item.key === activeKey));
    return `<ol class="v20-stepper" style="--step-count:${steps.length}" aria-label="${tx('Voortgang', 'Progress', 'Progression', 'Fortschritt')}">${steps.map((item, index) => `<li class="${index < active ? 'done' : index === active ? 'on' : ''}"><i>${index < active ? '✓' : index + 1}</i><span>${item.label}</span></li>`).join('')}</ol>`;
  }

  function stepNumber(key) {
    return commissioningSteps().findIndex((item) => item.key === key) + 1;
  }

  function ledCells(kind, reversed = false) {
    return Array.from({ length: 25 }, (_, index) => {
      const marker = kind === 'end'
        ? index === 24
        : reversed ? index === 24 : index === 0;
      return `<i class="${marker ? kind : ''}"></i>`;
    }).join('');
  }

  function renderSecurity() {
    const device = spiDevice();
    if (!device) return stopFlow();
    flow.phase = 'security';
    modal(`<section class="v20-commission v20-security-step" data-phase="security">
      ${stepDots('security')}
      <header><span><div class="eyebrow">${tx(`STAP ${stepNumber('security')} · BEVEILIGING`, `STEP ${stepNumber('security')} · SECURITY`, `ÉTAPE ${stepNumber('security')} · SÉCURITÉ`, `SCHRITT ${stepNumber('security')} · SICHERHEIT`)}</div><h1>${tx('Kies je herstelcode', 'Choose your recovery code', 'Choisissez votre code de récupération', 'Wähle deinen Wiederherstellungscode')}</h1><p>${tx('Hiermee verbind je later veilig een andere telefoon of herstel je alles nadat de app is verwijderd.', 'Use it to connect another phone safely or restore everything after deleting the app.', 'Utilisez-le pour connecter un autre téléphone ou restaurer l’installation après suppression de l’app.', 'Damit verbindest du später ein anderes Telefon oder stellst nach dem Löschen der App alles wieder her.')}</p></span><b class="v20-main-badge">★ ${tx('EERSTE RECEIVER', 'FIRST RECEIVER', 'PREMIER RÉCEPTEUR', 'ERSTER RECEIVER')}</b></header>
      <div class="v20-security-uses" aria-label="${tx('Waarvoor dient de code?', 'What is the code for?', 'À quoi sert le code ?', 'Wofür ist der Code?')}">
        <span><i>▣</i><b>${tx('Nieuwe telefoon', 'New phone', 'Nouveau téléphone', 'Neues Telefon')}</b></span>
        <span><i>◎</i><b>${tx('Via webbrowser', 'Via web browser', 'Via navigateur web', 'Über Webbrowser')}</b></span>
        <span><i>↻</i><b>${tx('App herinstalleren', 'Reinstall app', 'Réinstaller l’app', 'App neu installieren')}</b></span>
      </div>
      <section class="v20-live-card v20-code-card">
        <label><b>${tx('Herstelcode', 'Recovery code', 'Code de récupération', 'Wiederherstellungscode')}</b><input id="v20CommissionCode" class="field v20-recovery-input" type="password" inputmode="numeric" autocomplete="new-password" maxlength="12" placeholder="8–12 ${tx('cijfers', 'digits', 'chiffres', 'Ziffern')}"></label>
        <label><b>${tx('Herhaal de code', 'Repeat the code', 'Répétez le code', 'Code wiederholen')}</b><input id="v20CommissionCodeAgain" class="field v20-recovery-input" type="password" inputmode="numeric" autocomplete="new-password" maxlength="12" placeholder="••••••••"></label>
        <label class="v20-show-code"><input type="checkbox" onchange="v20ToggleCommissionCode(this.checked)"><span>${tx('Code tonen', 'Show code', 'Afficher le code', 'Code anzeigen')}</span></label>
        <p><b>${tx('Goed om te weten', 'Good to know', 'Bon à savoir', 'Gut zu wissen')}</b><br>${tx('De code wordt beveiligd op de receiver verwerkt en nooit leesbaar in de app opgeslagen.', 'The code is processed securely on the receiver and is never stored readably in the app.', 'Le code est traité de manière sécurisée sur le récepteur et n’est jamais stocké en clair dans l’app.', 'Der Code wird sicher auf dem Receiver verarbeitet und niemals lesbar in der App gespeichert.')}</p>
      </section>
      <footer><button class="button soft" onclick="v20CancelCommission()">${tx('Annuleren', 'Cancel', 'Annuler', 'Abbrechen')}</button><button class="button" onclick="v20CreateInstallationProtection()">${tx('Beveiligen en verder', 'Protect and continue', 'Protéger et continuer', 'Schützen und weiter')} →</button></footer>
    </section>`);
  }

  function renderPhysicalSecurityConfirmation(message = '') {
    flow.phase = 'security-confirm';
    modal(`<section class="v20-commission v20-security-step" data-phase="security-confirm">
      ${stepDots('security')}
      <div class="v20-security-confirm-visual"><i>NFC</i><span></span><b>R</b></div>
      <div class="eyebrow">${tx('FYSIEKE BEVESTIGING', 'PHYSICAL CONFIRMATION', 'CONFIRMATION PHYSIQUE', 'PHYSISCHE BESTÄTIGUNG')}</div>
      <h1>${tx('Tik de receiver opnieuw aan', 'Tap the receiver again', 'Touchez à nouveau le récepteur', 'Tippe den Receiver erneut an')}</h1>
      <p class="sub">${tx('De NFC-toestemming is verlopen. Tik opnieuw met je iPhone en druk daarna op Verder. Op oudere firmware kun je de BOOT-knop 2 seconden vasthouden.', 'The NFC approval expired. Tap again with your iPhone, then press Continue. On older firmware, hold BOOT for 2 seconds.', 'L’autorisation NFC a expiré. Touchez à nouveau avec votre iPhone puis continuez. Sur un ancien firmware, maintenez BOOT 2 secondes.', 'Die NFC-Freigabe ist abgelaufen. Tippe erneut mit dem iPhone und drücke dann Weiter. Bei älterer Firmware BOOT 2 Sekunden halten.')}</p>
      ${message ? `<p class="danger-note">${safe(message)}</p>` : ''}
      <footer><button class="button soft" onclick="v20CancelCommission()">${tx('Annuleren', 'Cancel', 'Annuler', 'Abbrechen')}</button><button class="button" onclick="v20RetryInstallationProtection()">${tx('Verder', 'Continue', 'Continuer', 'Weiter')} →</button></footer>
    </section>`);
  }

  function markInstallationProtected(device) {
    install.security = {
      ...(install.security || {}),
      recoveryConfigured: true,
      primaryReceiverId: install.security?.primaryReceiverId || device.id,
      configuredAt: install.security?.configuredAt || Date.now()
    };
    flow.securityComplete = true;
    save('queued');
  }

  function renderRecoveryKey(recoveryKey) {
    flow.phase = 'recovery-key';
    flow.recoveryKey = recoveryKey;
    modal(`<section class="v20-commission v20-security-step" data-phase="recovery-key">
      ${stepDots('security')}
      <div class="v20-success">✓</div><div class="eyebrow">${tx('EENMALIG BEWAREN', 'SAVE ONCE', 'À CONSERVER UNE FOIS', 'EINMALIG SPEICHERN')}</div>
      <h1>Recovery Key</h1><p class="sub">${tx('Bewaar deze sleutel buiten de app. Je gebruikt hem alleen wanneer je jouw gewone herstelcode vergeet.', 'Store this key outside the app. You only need it if you forget your regular recovery code.', 'Conservez cette clé hors de l’app. Elle sert uniquement si vous oubliez votre code habituel.', 'Bewahre diesen Schlüssel außerhalb der App auf. Du brauchst ihn nur, wenn du deinen normalen Code vergisst.')}</p>
      <div class="v20-recovery-code">${safe(recoveryKey)}</div>
      <button class="button soft" onclick="AluvisionAccountlessRecovery.copyCode('${safe(recoveryKey)}')">${tx('Recovery Key kopiëren', 'Copy Recovery Key', 'Copier la Recovery Key', 'Recovery Key kopieren')}</button>
      <footer><span></span><button class="button" onclick="v20ContinueAfterRecoveryKey()">${tx('Ik heb hem bewaard', 'I saved it', 'Je l’ai conservée', 'Ich habe ihn gespeichert')} →</button></footer>
    </section>`);
  }

  function continueAfterSecurity() {
    flow.recoveryKey = '';
    if (flow.receiverType === 'RGBW' && typeof flow.resumePairing === 'function') {
      const resume = flow.resumePairing;
      stopFlow(false);
      return resume();
    }
    renderLength();
  }

  function renderLength() {
    const device = spiDevice();
    if (!device) return stopFlow();
    flow.phase = 'length';
    const pixels = clampPixels(pairDraft.pixels, device.pixels || 25);
    pairDraft.pixels = pixels;
    modal(`<section class="v20-commission" data-phase="length">
      ${stepDots('length')}
      <header><span><div class="eyebrow">${tx(`STAP ${stepNumber('length')} · PIXELS`, `STEP ${stepNumber('length')} · PIXELS`, `ÉTAPE ${stepNumber('length')} · PIXELS`, `SCHRITT ${stepNumber('length')} · PIXEL`)}</div><h1>${tx('Zoek de laatste pixel', 'Find the final pixel', 'Trouvez le dernier pixel', 'Finde den letzten Pixel')}</h1><p>${tx('Schuif tot precies één rode pixel op het fysieke einde staat.', 'Slide until exactly one red pixel is at the physical end.', 'Faites glisser jusqu’à ce qu’un seul pixel rouge soit à l’extrémité.', 'Schiebe, bis genau ein roter Pixel am physischen Ende steht.')}</p></span><b class="live-indicator">LIVE</b></header>
      <section class="v20-live-card">
        <div id="v20CommissionStatus" class="calibration-live red-end" data-state="working" aria-live="polite">${tx('Rode eindpixel starten…', 'Starting red end pixel…', 'Démarrage du pixel final rouge…', 'Roter Endpixel wird gestartet…')}</div>
        <div class="v20-strip-preview end" aria-label="${tx('Alleen de laatste pixel is rood', 'Only the final pixel is red', 'Seul le dernier pixel est rouge', 'Nur der letzte Pixel ist rot')}">${ledCells('end')}</div>
        <div class="v20-big-number"><button onclick="v20AdjustPixels(-1)" aria-label="− 1">−</button><label><input id="v20PixelNumber" type="number" inputmode="numeric" min="1" max="${MAX_SPI_PIXELS}" value="${pixels}" oninput="v20SetPixels(this.value)"><small>PIXELS</small></label><button onclick="v20AdjustPixels(1)" aria-label="＋ 1">＋</button></div>
        <input id="v20PixelRange" class="v20-range" type="range" min="1" max="${MAX_SPI_PIXELS}" step="1" value="${pixels}" oninput="v20SetPixels(this.value)">
        <div class="v20-range-label"><span>1</span><b id="v20PixelReadout">${pixelLabel(pixels)}</b><span>${MAX_SPI_PIXELS}</span></div>
        <div class="v20-calibration-help"><span><i class="red"></i><b>${tx('Rood op het einde', 'Red at the end', 'Rouge à la fin', 'Rot am Ende')}</b><small>${tx('Aantal klopt', 'Count is correct', 'Le nombre est correct', 'Anzahl stimmt')}</small></span><span><i>−</i><b>${tx('Geen rood zichtbaar', 'No red visible', 'Pas de rouge visible', 'Kein Rot sichtbar')}</b><small>${tx('Aantal verlagen', 'Lower the count', 'Réduire le nombre', 'Anzahl verringern')}</small></span><span><i>＋</i><b>${tx('Rood staat te vroeg', 'Red appears too early', 'Le rouge apparaît trop tôt', 'Rot erscheint zu früh')}</b><small>${tx('Aantal verhogen', 'Raise the count', 'Augmenter le nombre', 'Anzahl erhöhen')}</small></span></div>
      </section>
      <footer><button class="button soft" onclick="v20CancelCommission()">${tx('Annuleren', 'Cancel', 'Annuler', 'Abbrechen')}</button><button class="button" onclick="v20ContinueToSide()">${tx('Verder', 'Continue', 'Continuer', 'Weiter')} →</button></footer>
    </section>`);
    scheduleCalibration(true, 'length');
  }

  function renderSide() {
    const device = spiDevice();
    if (!device) return stopFlow();
    flow.phase = 'side';
    const right = Boolean(pairDraft.reversed);
    modal(`<section class="v20-commission" data-phase="side">
      ${stepDots('side')}
      <header><span><div class="eyebrow">${tx(`STAP ${stepNumber('side')} · AANSLUITING`, `STEP ${stepNumber('side')} · CONNECTION`, `ÉTAPE ${stepNumber('side')} · CONNEXION`, `SCHRITT ${stepNumber('side')} · ANSCHLUSS`)}</div><h1>${tx('Aan welke kant is de receiver aangesloten?', 'Which side is the receiver connected to?', 'De quel côté le récepteur est-il connecté ?', 'Auf welcher Seite ist der Receiver angeschlossen?')}</h1><p>${tx('Tik links of rechts. De groene pixel toont de kant van de receiver.', 'Tap left or right. The green pixel shows the receiver side.', 'Touchez gauche ou droite. Le pixel vert indique le côté du récepteur.', 'Tippe links oder rechts. Der grüne Pixel zeigt die Receiver-Seite.')}</p></span><b class="live-indicator">LIVE</b></header>
      <section class="v20-live-card">
        <div id="v20CommissionStatus" class="calibration-live" data-state="working" aria-live="polite">${tx('Groene beginpixel starten…', 'Starting green start pixel…', 'Démarrage du pixel vert…', 'Grüner Startpixel wird gestartet…')}</div>
        <div class="v20-side-stage ${right ? 'right' : 'left'}"><div class="v20-receiver-glyph"><b>R</b><i></i></div><div class="v20-strip-preview start">${ledCells('start', right)}</div></div>
        <div class="v20-side-options" role="radiogroup">
          <button class="${right ? '' : 'on'}" role="radio" aria-checked="${!right}" onclick="v20SetReceiverSide('left')"><span class="v20-side-icon receiver-left"><i>R</i><b></b></span><strong>${tx('Receiver links', 'Receiver left', 'Récepteur à gauche', 'Receiver links')}</strong></button>
          <button class="${right ? 'on' : ''}" role="radio" aria-checked="${right}" onclick="v20SetReceiverSide('right')"><span class="v20-side-icon receiver-right"><b></b><i>R</i></span><strong>${tx('Receiver rechts', 'Receiver right', 'Récepteur à droite', 'Receiver rechts')}</strong></button>
        </div>
      </section>
      <footer><button class="button soft" onclick="v20BackToLength()">← ${tx('Terug', 'Back', 'Retour', 'Zurück')}</button><button class="button" onclick="v20ConfirmGeometry()">${tx('Bevestigen', 'Confirm', 'Confirmer', 'Bestätigen')} →</button></footer>
    </section>`);
    scheduleCalibration(true, 'side');
  }

  async function commitGeometry() {
    const item = snapshot('commit');
    const device = spiDevice(item.deviceId);
    if (!device) return { ok: false, reason: 'missing' };
    const target = calibrationTarget({ ...item, mode: 'end' });
    const response = await api('/api/command', {
      action: 'config',
      state: {
        receiverType: 'SPI',
        physicalLeds: item.pixels,
        physicalReverse: item.reversed,
        calibration: 'END_PIXEL_CONFIRMED',
        calibrationNonce: item.nonce
      },
      targets: [{ ...target, calibration: 'END_PIXEL_CONFIRMED' }]
    });
    const result = response?.results?.[0] || {};
    /* A receiver cannot measure its attached strip. Success is delivery/ACK,
       never equality with a self-reported pixel value. */
    const acknowledged = Boolean(result.confirmed || result.accepted || result.delivered || result.gatewayAck || result.online);
    if (!acknowledged && reachable(device)) return { ok: false, reason: result.detail || 'no_ack' };
    device.pixels = item.pixels;
    device.reversed = item.reversed;
    device.physicalReverse = item.reversed;
    device.configurationSource = 'visual-end-pixel';
    device.configurationStoredAt = Date.now();
    if (!acknowledged) device.pendingGeometry = { pixels: item.pixels, reversed: item.reversed, source: 'visual-end-pixel', requestedAt: Date.now() };
    else delete device.pendingGeometry;
    save();
    return { ok: true, pending: !acknowledged };
  }

  function compatibleGroups(selectedZone, device) {
    return (selectedZone?.groups || []).filter((candidate) => {
      const currentType = typeof window.groupReceiverType === 'function' ? groupReceiverType(candidate) : candidate.receiverType;
      return !currentType || currentType === (isRgbw(device) ? 'RGBW' : 'SPI');
    });
  }

  function renderZoneChoice() {
    flow.phase = 'assign-zone';
    const device = spiDevice();
    modal(`<section class="v20-commission" data-phase="assign"><div class="scope">✓ ${tx('LED LINE INGESTELD', 'LED LINE CONFIGURED', 'LED LINE CONFIGURÉE', 'LED LINE EINGESTELLT')}</div>${stepDots('destination')}<header><span><div class="eyebrow">${tx(`STAP ${stepNumber('destination')} · INDELEN`, `STEP ${stepNumber('destination')} · ASSIGN`, `ÉTAPE ${stepNumber('destination')} · AFFECTER`, `SCHRITT ${stepNumber('destination')} · ZUORDNEN`)}</div><h1>${tx('Kies een zone', 'Choose a zone', 'Choisissez une zone', 'Zone wählen')}</h1><p>${safe(device?.name || tx('Nieuwe receiver', 'New receiver', 'Nouveau récepteur', 'Neuer Receiver'))}</p></span></header><div class="v20-choice-grid">${(install.zones || []).map((item) => `<button onclick="v20ChooseZone('${item.id}')"><i>${safe(item.icon || '▦')}</i><span><b>${safe(item.name)}</b><small>${item.groups?.length || 0} ${tx('groepen', 'groups', 'groupes', 'Gruppen')}</small></span><em>›</em></button>`).join('')}</div><footer><button class="button soft" onclick="v20BackToSide()">← ${tx('Aansluiting', 'Connection', 'Connexion', 'Anschluss')}</button></footer></section>`);
  }

  function renderGroupChoice(zoneId) {
    const selectedZone = (install.zones || []).find((item) => item.id === zoneId);
    const device = spiDevice();
    if (!selectedZone || !device) return renderZoneChoice();
    pairDraft.zoneId = zoneId;
    flow.phase = 'assign-group';
    const groups = compatibleGroups(selectedZone, device);
    modal(`<section class="v20-commission" data-phase="assign"><div class="scope">${safe(selectedZone.name)}</div>${stepDots('destination')}<header><span><div class="eyebrow">${tx(`STAP ${stepNumber('destination')} · INDELEN`, `STEP ${stepNumber('destination')} · ASSIGN`, `ÉTAPE ${stepNumber('destination')} · AFFECTER`, `SCHRITT ${stepNumber('destination')} · ZUORDNEN`)}</div><h1>${tx('Kies een groep', 'Choose a group', 'Choisissez un groupe', 'Gruppe wählen')}</h1><p>${tx('Deze groep bedient alle aangesloten LED Lines samen.', 'This group controls all connected LED Lines together.', 'Ce groupe pilote toutes les LED Lines connectées.', 'Diese Gruppe steuert alle verbundenen LED Lines gemeinsam.')}</p></span></header><div class="v20-choice-grid">${groups.map((item) => `<button onclick="v20SelectPairDestination('${selectedZone.id}','${item.id}')"><i>◉</i><span><b>${safe(item.name)}</b><small>${item.receivers?.length || 0} LED Line${item.receivers?.length === 1 ? '' : 's'}</small></span><em>›</em></button>`).join('') || `<div class="v20-empty"><b>${tx('Nog geen geschikte groep', 'No suitable group yet', 'Aucun groupe approprié', 'Noch keine passende Gruppe')}</b></div>`}</div><div class="v20-create-row"><input id="v20NewGroupName" class="field" maxlength="60" placeholder="${tx('Nieuwe groep', 'New group', 'Nouveau groupe', 'Neue Gruppe')}"><button class="button soft" onclick="v20CreateGroup('${selectedZone.id}')">＋ ${tx('Maken', 'Create', 'Créer', 'Erstellen')}</button></div><footer><button class="button soft" onclick="v20ShowZoneChoice()">← ${tx('Zones', 'Zones', 'Zones', 'Zonen')}</button></footer></section>`);
  }

  function renderReview(zoneId, groupId) {
    const selectedZone = (install.zones || []).find((item) => item.id === zoneId);
    const selectedGroup = selectedZone?.groups?.find((item) => item.id === groupId);
    const device = spiDevice();
    if (!selectedZone || !selectedGroup || !device) return renderZoneChoice();
    pairDraft.zoneId = zoneId;
    pairDraft.groupId = groupId;
    flow.phase = 'review';
    const becomesMain = zoneReceiverIds(selectedZone).size === 0;
    const deviceName = typeof window.customerDeviceName === 'function' ? customerDeviceName(device) : device.name;
    modal(`<section class="v20-commission v20-review" data-phase="review">
      ${stepDots('review')}
      <header><span><div class="eyebrow">${tx(`STAP ${stepNumber('review')} · CONTROLEREN`, `STEP ${stepNumber('review')} · REVIEW`, `ÉTAPE ${stepNumber('review')} · VÉRIFIER`, `SCHRITT ${stepNumber('review')} · PRÜFEN`)}</div><h1>${tx('Klaar om toe te voegen', 'Ready to add', 'Prêt à ajouter', 'Bereit zum Hinzufügen')}</h1><p>${tx('Controleer de keuzes en voeg daarna de receiver toe.', 'Review your choices, then add the receiver.', 'Vérifiez vos choix, puis ajoutez le récepteur.', 'Prüfe die Auswahl und füge dann den Receiver hinzu.')}</p></span></header>
      ${becomesMain ? `<div class="v20-main-receiver-card"><i>★</i><span><b>${tx('Hoofdreceiver van deze zone', 'Main receiver for this zone', 'Récepteur principal de cette zone', 'Hauptreceiver dieser Zone')}</b><small>${tx('Dit is de eerste receiver in deze zone en wordt automatisch het vaste aanspreekpunt.', 'This is the first receiver in this zone and automatically becomes its main receiver.', 'C’est le premier récepteur de cette zone ; il devient automatiquement le récepteur principal.', 'Dies ist der erste Receiver dieser Zone und wird automatisch ihr Hauptreceiver.')}</small></span></div>` : ''}
      <div class="v20-review-map"><span><i>${safe(selectedZone.icon || '▦')}</i><small>${tx('ZONE', 'ZONE', 'ZONE', 'ZONE')}</small><b>${safe(selectedZone.name)}</b></span><em>›</em><span><i>◉</i><small>${tx('GROEP', 'GROUP', 'GROUPE', 'GRUPPE')}</small><b>${safe(selectedGroup.name)}</b></span></div>
      <div class="v20-review-list"><span><small>${tx('Receiver', 'Receiver', 'Récepteur', 'Receiver')}</small><b>${safe(deviceName)}</b></span><span><small>${tx('LED Line', 'LED Line', 'LED Line', 'LED Line')}</small><b>${pixelLabel(clampPixels(pairDraft.pixels))}</b></span><span><small>${tx('Aansluiting', 'Connection', 'Connexion', 'Anschluss')}</small><b>${pairDraft.reversed ? tx('Rechts', 'Right', 'Droite', 'Rechts') : tx('Links', 'Left', 'Gauche', 'Links')}</b></span></div>
      <footer><button class="button soft" onclick="v20BackFromReview()">← ${flow.directZoneId && flow.directGroupId ? tx('Aansluiting', 'Connection', 'Connexion', 'Anschluss') : tx('Groep', 'Group', 'Groupe', 'Gruppe')}</button><button class="button" onclick="v20CommitReceiver()">＋ ${tx('Receiver toevoegen', 'Add receiver', 'Ajouter le récepteur', 'Receiver hinzufügen')}</button></footer>
    </section>`);
  }

  function assignToGroup(zoneId, groupId) {
    const selectedZone = (install.zones || []).find((item) => item.id === zoneId);
    const selectedGroup = selectedZone?.groups?.find((item) => item.id === groupId);
    const device = spiDevice();
    if (!selectedZone || !selectedGroup || !device) return;
    const currentType = typeof window.groupReceiverType === 'function' ? groupReceiverType(selectedGroup) : selectedGroup.receiverType;
    if (currentType && currentType !== 'SPI') {
      toast(tx('SPI en RGBW horen in aparte groepen', 'SPI and RGBW require separate groups', 'SPI et RGBW doivent être dans des groupes séparés', 'SPI und RGBW benötigen getrennte Gruppen'));
      return;
    }
    (db.installations || []).forEach((location) => (location.zones || []).forEach((z) => (z.groups || []).forEach((g) => {
      g.receivers = (g.receivers || []).filter((line) => line.deviceId !== device.id);
    })));
    const pixels = clampPixels(pairDraft.pixels, device.pixels || 25);
    const receiver = {
      id: `r${Date.now()}`,
      deviceId: device.id,
      name: device.name,
      rid: device.rid,
      hardwareId: device.hardwareId,
      receiverType: 'SPI',
      ip: device.ip,
      port: device.port,
      pixels,
      reversed: Boolean(pairDraft.reversed)
    };
    selectedGroup.receiverType = 'SPI';
    selectedGroup.receivers ||= [];
    selectedGroup.receivers.push(receiver);
    zone = selectedZone;
    group = selectedGroup;
    install.activeZoneId = selectedZone.id;
    install.activeGroupId = selectedGroup.id;
    db.activeGroupByZone ||= {};
    db.activeGroupByZone[selectedZone.id] = selectedGroup.id;
    if (!selectedZone.mainReceiverId) selectedZone.mainReceiverId = device.id;
    ensureZoneMainReceivers();
    save('queued');
    if (reachable(device) && typeof window.queueLive === 'function') {
      Promise.resolve(queueLive(selectedGroup)).catch(() => {});
    }
    const deviceName = typeof window.customerDeviceName === 'function' ? customerDeviceName(device) : device.name;
    stopFlow(false);
    modal(`<section class="v20-complete"><div class="v20-success">✓</div><div class="eyebrow">${tx('KLAAR', 'READY', 'PRÊT', 'FERTIG')}</div><h1>${safe(deviceName)} ${tx('is toegevoegd', 'has been added', 'a été ajouté', 'wurde hinzugefügt')}</h1><p><b>${safe(selectedZone.name)} → ${safe(selectedGroup.name)}</b><br>${pixels} ${tx('pixels', 'pixels', 'pixels', 'Pixel')} · ${pairDraft.reversed ? tx('receiver rechts', 'receiver right', 'récepteur à droite', 'Receiver rechts') : tx('receiver links', 'receiver left', 'récepteur à gauche', 'Receiver links')}</p><button class="button" onclick="v20OpenCompletedGroup('${selectedZone.id}','${selectedGroup.id}')">${tx('Groep openen', 'Open group', 'Ouvrir le groupe', 'Gruppe öffnen')}</button></section>`);
  }

  async function needsInstallationSecurity(device) {
    if (install?.security?.recoveryConfigured) return false;
    try {
      const status = await window.AluvisionAccountlessRecovery?.getStatus?.(true);
      if (status?.configured && status?.trusted) {
        markInstallationProtected(device);
        return false;
      }
    } catch (_) {}
    return true;
  }

  async function beginSpiFlow(id, directZoneId = '', directGroupId = '') {
    const device = spiDevice(id);
    if (!device) return;
    flow.active = true;
    flow.phase = 'preparing';
    flow.deviceId = id;
    flow.directZoneId = directZoneId || '';
    flow.directGroupId = directGroupId || '';
    flow.receiverType = 'SPI';
    flow.needsSecurity = false;
    flow.securityComplete = Boolean(install?.security?.recoveryConfigured);
    flow.recoveryKey = '';
    flow.resumePairing = null;
    flow.generation += 1;
    flow.configurationStored = false;
    flow.lastAck = false;
    pairDraft = {
      deviceId: id,
      receiverType: 'SPI',
      pixels: clampPixels(device.pendingGeometry?.pixels ?? device.pixels ?? 25, 25),
      reversed: Boolean(device.pendingGeometry?.reversed ?? device.reversed ?? false),
      zoneId: directZoneId || '',
      groupId: directGroupId || '',
      presetGroup: Boolean(directZoneId && directGroupId)
    };
    modal(`<section class="v20-commission"><div class="v20-pair-loading"><i></i><b>${tx('Receiver voorbereiden…', 'Preparing receiver…', 'Préparation du récepteur…', 'Receiver wird vorbereitet…')}</b></div></section>`);
    flow.needsSecurity = await needsInstallationSecurity(device);
    if (!flow.active || flow.deviceId !== id) return;
    if (flow.needsSecurity) renderSecurity();
    else renderLength();
  }

  async function beginRgbwFlow(id, directZoneId = '', directGroupId = '') {
    const device = spiDevice(id);
    if (!device) return;
    const resume = () => directZoneId && directGroupId
      ? base.startPairingForGroup?.call(window, id, directZoneId, directGroupId)
      : base.startPairing?.call(window, id);
    if (install?.security?.recoveryConfigured) return resume();
    flow.active = true;
    flow.phase = 'preparing';
    flow.deviceId = id;
    flow.directZoneId = directZoneId || '';
    flow.directGroupId = directGroupId || '';
    flow.receiverType = 'RGBW';
    flow.generation += 1;
    modal(`<section class="v20-commission"><div class="v20-pair-loading"><i></i><b>${tx('Receiver voorbereiden…', 'Preparing receiver…', 'Préparation du récepteur…', 'Receiver wird vorbereitet…')}</b></div></section>`);
    flow.needsSecurity = await needsInstallationSecurity(device);
    if (!flow.active || flow.deviceId !== id) return;
    flow.securityComplete = !flow.needsSecurity;
    flow.recoveryKey = '';
    flow.resumePairing = resume;
    if (!flow.needsSecurity) {
      stopFlow(false);
      return resume();
    }
    renderSecurity();
  }

  function stopFlow(clear = true) {
    if (flow.active && clear && flow.receiverType === 'SPI' && ['length', 'side'].includes(flow.phase)) clearCalibration(true);
    flow.active = false;
    flow.phase = 'idle';
    flow.pending = null;
    flow.inFlight = false;
    clearTimeout(flow.timer);
    clearTimeout(flow.leaseTimer);
    flow.leaseTimer = 0;
    flow.recoveryKey = '';
    flow.resumePairing = null;
  }

  window.startPairing = function v20StartPairing(id) {
    const device = spiDevice(id);
    if (!device) return base.startPairing?.call(this, id);
    if (isRgbw(device)) return beginRgbwFlow(id);
    return beginSpiFlow(id);
  };

  window.startPairingForGroup = function v20StartPairingForGroup(id, zoneId = zone?.id, groupId = group?.id) {
    const device = spiDevice(id);
    if (!device) return base.startPairingForGroup?.call(this, id, zoneId, groupId);
    if (isRgbw(device)) return beginRgbwFlow(id, zoneId, groupId);
    const selectedZone = (install.zones || []).find((item) => item.id === zoneId);
    const selectedGroup = selectedZone?.groups?.find((item) => item.id === groupId);
    const type = selectedGroup && (typeof window.groupReceiverType === 'function' ? groupReceiverType(selectedGroup) : selectedGroup.receiverType);
    if (!selectedGroup) return toast(tx('Groep niet gevonden', 'Group not found', 'Groupe introuvable', 'Gruppe nicht gefunden'));
    if (type && type !== 'SPI') return toast(tx('Maak voor SPI een aparte groep', 'Create a separate SPI group', 'Créez un groupe SPI séparé', 'Erstelle eine separate SPI-Gruppe'));
    return beginSpiFlow(id, zoneId, groupId);
  };

  window.v20ToggleCommissionCode = function v20ToggleCommissionCode(visible) {
    ['v20CommissionCode', 'v20CommissionCodeAgain'].forEach((id) => {
      const input = document.getElementById(id);
      if (input) input.type = visible ? 'text' : 'password';
    });
  };

  async function submitInstallationProtection(code = '') {
    const api = window.AluvisionAccountlessRecovery;
    if (!api?.setupInstallation) {
      toast(tx('Beveiligingsmodule is nog niet geladen', 'Security module is not loaded yet', 'Le module de sécurité n’est pas encore chargé', 'Sicherheitsmodul ist noch nicht geladen'));
      return;
    }
    const button = document.querySelector('.v20-security-step footer .button:last-child');
    if (button) button.disabled = true;
    try {
      const outcome = await api.setupInstallation(code);
      if (!flow.active) return;
      if (outcome.physicalRequired) return renderPhysicalSecurityConfirmation();
      if (!outcome.ok || !outcome.recoveryKey) throw new Error(tx('Beveiliging werd niet bevestigd', 'Security was not confirmed', 'La sécurité n’a pas été confirmée', 'Sicherheit wurde nicht bestätigt'));
      const device = spiDevice();
      if (!device) throw new Error(tx('Receiver niet meer beschikbaar', 'Receiver is no longer available', 'Le récepteur n’est plus disponible', 'Receiver ist nicht mehr verfügbar'));
      markInstallationProtected(device);
      renderRecoveryKey(outcome.recoveryKey);
    } catch (error) {
      if (button) button.disabled = false;
      toast(safe(error?.message || error));
    }
  }

  window.v20CreateInstallationProtection = function v20CreateInstallationProtection() {
    if (!flow.active || flow.phase !== 'security') return;
    const first = document.getElementById('v20CommissionCode')?.value || '';
    const second = document.getElementById('v20CommissionCodeAgain')?.value || '';
    const normalized = window.AluvisionAccountlessRecovery?.normalizeUserCode?.(first) || '';
    if (!normalized || first !== second) {
      return toast(tx('Gebruik twee keer dezelfde code van 8 tot 12 cijfers', 'Enter the same 8 to 12 digit code twice', 'Saisissez deux fois le même code de 8 à 12 chiffres', 'Gib zweimal denselben 8- bis 12-stelligen Code ein'));
    }
    return submitInstallationProtection(normalized);
  };

  window.v20RetryInstallationProtection = function v20RetryInstallationProtection() {
    if (!flow.active || flow.phase !== 'security-confirm') return;
    return submitInstallationProtection();
  };

  window.v20ContinueAfterRecoveryKey = function v20ContinueAfterRecoveryKey() {
    if (!flow.active || flow.phase !== 'recovery-key') return;
    continueAfterSecurity();
  };

  window.v20SetPixels = function v20SetPixels(value) {
    if (!flow.active || flow.phase !== 'length') return;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    const pixels = clampPixels(parsed, pairDraft.pixels);
    pairDraft.pixels = pixels;
    const number = document.getElementById('v20PixelNumber');
    const range = document.getElementById('v20PixelRange');
    const readout = document.getElementById('v20PixelReadout');
    if (number && document.activeElement !== number) number.value = String(pixels);
    if (range) range.value = String(pixels);
    if (readout) readout.textContent = pixelLabel(pixels);
    scheduleCalibration(false, 'length');
  };

  window.v20AdjustPixels = (delta) => window.v20SetPixels(clampPixels(pairDraft.pixels, 25) + Number(delta || 0));
  window.v20ContinueToSide = () => { if (flow.active) renderSide(); };
  window.v20BackToLength = () => { if (flow.active) renderLength(); };
  window.v20BackToSide = () => { if (flow.active) renderSide(); };
  window.v20ShowZoneChoice = () => { if (flow.active) renderZoneChoice(); };
  window.v20ChooseZone = (id) => { if (flow.active) renderGroupChoice(id); };

  window.v20SetReceiverSide = function v20SetReceiverSide(side) {
    if (!flow.active || flow.phase !== 'side') return;
    const modalBody = document.getElementById('modalBody');
    const previousScrollTop = modalBody?.scrollTop || 0;
    pairDraft.reversed = side === 'right';
    renderSide();
    requestAnimationFrame(() => {
      if (!modalBody || !flow.active || flow.phase !== 'side') return;
      modalBody.scrollTop = Math.min(previousScrollTop, Math.max(0, modalBody.scrollHeight - modalBody.clientHeight));
    });
  };

  window.v20ConfirmGeometry = async function v20ConfirmGeometry() {
    if (!flow.active || flow.phase !== 'side') return;
    const button = document.querySelector('.v20-commission footer .button:last-child');
    if (button) button.disabled = true;
    status(tx('Configuratie veilig opslaan…', 'Saving configuration safely…', 'Enregistrement sécurisé…', 'Konfiguration wird sicher gespeichert…'));
    let outcome;
    try { outcome = await commitGeometry(); }
    catch (_) { outcome = { ok: false }; }
    if (!flow.active) return;
    if (!outcome.ok) {
      status(tx('Geen bevestiging ontvangen · probeer opnieuw', 'No acknowledgement received · try again', 'Aucune confirmation reçue · réessayez', 'Keine Bestätigung erhalten · erneut versuchen'), 'offline');
      if (button) button.disabled = false;
      return;
    }
    flow.configurationStored = true;
    await clearCalibration(false);
    if (!flow.active) return;
    if (flow.directZoneId && flow.directGroupId) return renderReview(flow.directZoneId, flow.directGroupId);
    renderZoneChoice();
  };

  window.v20CreateGroup = function v20CreateGroup(zoneId) {
    const selectedZone = (install.zones || []).find((item) => item.id === zoneId);
    const input = document.getElementById('v20NewGroupName');
    const name = input?.value.trim();
    if (!selectedZone || !name) return toast(tx('Geef de groep een naam', 'Enter a group name', 'Donnez un nom au groupe', 'Gib der Gruppe einen Namen'));
    const template = fresh().installations[0].zones[0].groups[0].state;
    const created = { id: `g${Date.now()}`, name, layout: 'line', receiverType: 'SPI', receivers: [], state: clone(template) };
    selectedZone.groups.push(created);
    save('queued');
    renderReview(zoneId, created.id);
  };

  window.v20SelectPairDestination = (zoneId, groupId) => {
    if (flow.active) renderReview(zoneId, groupId);
  };
  window.v20AssignReceiver = window.v20SelectPairDestination;
  window.v20CommitReceiver = () => {
    if (flow.active && flow.phase === 'review') assignToGroup(pairDraft.zoneId, pairDraft.groupId);
  };
  window.v20BackFromReview = () => {
    if (!flow.active) return;
    if (flow.directZoneId && flow.directGroupId) return renderSide();
    renderGroupChoice(pairDraft.zoneId);
  };
  window.v20CancelCommission = function v20CancelCommission() { stopFlow(true); base.closeModal?.call(window); };
  window.v20OpenCompletedGroup = function v20OpenCompletedGroup(zoneId, groupId) {
    base.closeModal?.call(window);
    if (typeof window.openZone === 'function') openZone(zoneId);
    if (typeof window.openGroup === 'function') openGroup(groupId);
  };

  window.pairStep = function v20PairStep(step) {
    if (!flow.active) return base.pairStep?.call(this, step);
    if (step <= 1) return renderLength();
    if (step === 2) return renderSide();
    return renderZoneChoice();
  };

  window.finishPairingWizard = function v20FinishPairingWizard(...args) {
    if (!flow.active) {
      const result = base.finishPairingWizard?.apply(this, args);
      return Promise.resolve(result).finally(() => {
        if (ensureZoneMainReceivers()) save('queued');
      });
    }
    if (flow.phase === 'length') return window.v20ContinueToSide();
    if (flow.phase === 'side') return window.v20ConfirmGeometry();
    if (flow.phase === 'review') return window.v20CommitReceiver();
  };

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && flow.active && ['length', 'side'].includes(flow.phase)) {
      scheduleCalibration(true, flow.phase);
    }
  });

  if (typeof base.configureReceiverPhysical === 'function') {
    window.configureReceiverPhysical = async function v20ConfigureReceiverPhysical(device, pixels, reversed) {
      const requested = clampPixels(pixels, device?.pixels || 25);
      const result = await base.configureReceiverPhysical.call(this, device, requested, reversed);
      const acknowledged = Boolean(
        result?.online || result?.delivered || result?.pending || result?.result?.accepted ||
        result?.result?.confirmed || result?.result?.gatewayAck
      );
      /* `PHYSICAL` is the receiver's stored setting, not a sensor reading.
         Never turn a stale stored value into a pairing/configuration error. */
      return acknowledged
        ? { ...result, confirmed: requested, geometryConfirmed: true, sideConfirmed: true, mismatch: false }
        : result;
    };
  }

  window.closeModal = function v20CloseModal(...args) {
    if (flow.active) stopFlow(true);
    clearTimeout(privatePairPollTimer);
    privatePairPollTimer = 0;
    return base.closeModal?.apply(this, args);
  };

  function replaceCustomerTransportCopy(root = document) {
    if (!root?.querySelectorAll) return;
    const replacements = [
      [/Web Bluetooth/gi, tx('privéverbinding', 'private connection', 'connexion privée', 'private Verbindung')],
      [/Bluetooth/gi, tx('privéverbinding', 'private connection', 'connexion privée', 'private Verbindung')],
      [/\bBLE\b/g, tx('privénetwerk', 'private network', 'réseau privé', 'Privatnetz')],
      [/Bluefy/gi, tx('Safari', 'Safari', 'Safari', 'Safari')],
      [/lokaal Wi-?Fi-netwerk/gi, tx('privénetwerk van de receiver', 'receiver private network', 'réseau privé du récepteur', 'Privatnetz des Receivers')]
    ];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return node.parentElement?.closest('script,style,textarea') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    while (walker.nextNode()) {
      let text = walker.currentNode.nodeValue;
      replacements.forEach(([pattern, value]) => { text = text.replace(pattern, value); });
      walker.currentNode.nodeValue = text;
    }
  }

  /* The receiver now owns the customer app. These cards describe the retired
     Mac-hosted test route and must not appear in normal product pages. Keep
     the old helper functions available for development diagnostics, while
     deliberately leaving Academy and Studio untouched. */
  function removeLegacyHostAccessUi(root) {
    if (!root?.querySelectorAll || root.closest?.('#help,#studio')) return;
    root.querySelectorAll('[data-customer-phone]').forEach((node) => node.remove());
    root.querySelectorAll('button[onclick*="showIphoneInstructions"],button[onclick*="showIphoneAtHome"],button[onclick*="showRemoteAccess"]').forEach((button) => {
      const card = button.closest('.customer-settings-link,.card');
      if (card && card.closest('#settings')) card.remove();
      else button.remove();
    });
  }

  window.modal = function v20Modal(html) {
    const result = base.modal?.call(this, html);
    requestAnimationFrame(() => replaceCustomerTransportCopy(document.getElementById('modalBody')));
    return result;
  };

  if (typeof base.settings === 'function') {
    window.settings = function v20Settings(...args) {
      const result = base.settings.apply(this, args);
      const root = document.getElementById('settings');
      replaceCustomerTransportCopy(root);
      removeLegacyHostAccessUi(root);
      root?.querySelectorAll('[data-ble-only],.ble-recovery-only').forEach((node) => { node.hidden = true; });
      return result;
    };
  }

  if (typeof base.devices === 'function') {
    window.devices = function v20Devices(...args) {
      const result = base.devices.apply(this, args);
      replaceCustomerTransportCopy(document.getElementById('devices'));
      return result;
    };
  }

  function privateWifiDetails() {
    try { return window.AluvisionPrivateWifi?.getConnectionDetails?.() || {}; }
    catch (_) { return {}; }
  }

  function nextAvailableReceiverNumber() {
    const used = new Set((db.devices || []).map((device) => Math.round(Number(device.number)))
      .filter((number) => number >= 1 && number <= 250));
    for (let number = 1; number <= 250; number += 1) {
      if (!used.has(number)) return number;
    }
    throw new Error(tx('Maximumaantal receivers bereikt', 'Maximum receiver count reached', 'Nombre maximal de récepteurs atteint', 'Maximale Receiver-Anzahl erreicht'));
  }

  function schedulePrivatePairCheck() {
    clearTimeout(privatePairPollTimer);
    privatePairPollTimer = setTimeout(async () => {
      privatePairPollTimer = 0;
      if (!document.getElementById('v20PrivatePairStatus')) return;
      if (document.hidden || privatePairCheckInFlight) return schedulePrivatePairCheck();
      privatePairCheckInFlight = true;
      try {
        const response = await api('/api/discover', { active: true });
        if (response?.transport?.gatewayReady || window.AluvisionPrivateWifi?.isReady?.()) {
          renderPrivateReceiverAdd(privatePairTarget && { ...privatePairTarget });
          return;
        }
      } catch (_) {
        // The receiver AP is not active yet; the same modal keeps waiting.
      } finally {
        privatePairCheckInFlight = false;
      }
      schedulePrivatePairCheck();
    }, 1400);
  }

  function renderPrivateReceiverAdd(target = null, checkState = '') {
    const destination = target && typeof window.receiverGroupTarget === 'function'
      ? receiverGroupTarget(target.zoneId, target.groupId) : null;
    const link = privateWifiDetails();
    const connected = Boolean(link.ready);
    const provisioned = Boolean(link.provisioned);
    const nfcState = String(link.nfcState || '');
    const nfcHardwareMarkup = connected && nfcState
      ? `<div class="v20-nfc-health ${link.nfcReady ? 'ready' : 'error'}"><i>${link.nfcReady ? '✓' : '!'}</i><span><b>${link.nfcReady ? tx('NFC-module gevonden', 'NFC module found', 'Module NFC détecté', 'NFC-Modul gefunden') : tx('NFC-module niet bereikbaar', 'NFC module unavailable', 'Module NFC indisponible', 'NFC-Modul nicht erreichbar')}</b><small>${link.nfcReady ? tx('Klaar voor iPhone-tikken', 'Ready for iPhone taps', 'Prêt pour les touches iPhone', 'Bereit für iPhone-Taps') : tx('Controleer de I²C-stand en de vier aansluitingen', 'Check I²C mode and the four connections', 'Vérifiez le mode I²C et les quatre connexions', 'I²C-Modus und vier Anschlüsse prüfen')}</small></span></div>`
      : '';
    const stateMarkup = connected
      ? `<div id="v20PrivatePairStatus" class="nfc-status success"><span><b>${tx('Privénetwerk verbonden', 'Private network connected', 'Réseau privé connecté', 'Privatnetz verbunden')}</b><small>${safe(link.ssid || 'ALUVISION')} · ${tx('klaar om toe te voegen', 'ready to add', 'prêt à être ajouté', 'bereit zum Hinzufügen')}</small></span></div>`
      : checkState === 'failed'
        ? `<div id="v20PrivatePairStatus" class="nfc-status error"><span><b>${tx('Receiver nog niet bereikbaar', 'Receiver not reachable yet', 'Récepteur pas encore accessible', 'Receiver noch nicht erreichbar')}</b><small>${tx('Kies op je iPhone het getoonde ALUVISION-netwerk en tik de receiver daarna opnieuw aan.', 'Choose the shown ALUVISION network on your iPhone, then tap the receiver again.', 'Choisissez le réseau ALUVISION affiché sur votre iPhone, puis touchez à nouveau le récepteur.', 'Wähle auf deinem iPhone das angezeigte ALUVISION-Netzwerk und tippe den Receiver danach erneut an.')}</small></span></div>`
        : `<div id="v20PrivatePairStatus" class="nfc-status ${provisioned ? 'scanning' : ''}"><span><b>${provisioned ? tx('Receivergegevens ontvangen', 'Receiver details received', 'Données du récepteur reçues', 'Receiver-Daten empfangen') : tx('Tik de receiver aan', 'Tap the receiver', 'Touchez le récepteur', 'Receiver antippen')}</b><small>${provisioned ? tx('Kies deze beveiligde receiververbinding één keer op je iPhone. De wizard bewaart je voortgang.', 'Choose this secure receiver connection once on your iPhone. The wizard keeps your progress.', 'Choisissez une fois cette connexion sécurisée sur votre iPhone. L’assistant conserve votre progression.', 'Wähle diese sichere Receiver-Verbindung einmal auf deinem iPhone. Der Assistent behält deinen Fortschritt.') : tx('De receiver stuurt zijn unieke verbindingsgegevens via NFC naar je iPhone.', 'The receiver sends its unique connection details to your iPhone over NFC.', 'Le récepteur envoie ses données de connexion uniques à votre iPhone via NFC.', 'Der Receiver sendet seine eindeutigen Verbindungsdaten per NFC an dein iPhone.')}</small></span></div>`;
    window.modal(`<section class="v20-private-pair">
      <div class="eyebrow">${tx('RECEIVER TOEVOEGEN', 'ADD RECEIVER', 'AJOUTER UN RÉCEPTEUR', 'RECEIVER HINZUFÜGEN')}</div>
      <h1>${tx('Tik. Verbind. Stel in.', 'Tap. Connect. Set up.', 'Touchez. Connectez. Configurez.', 'Tippen. Verbinden. Einrichten.')}</h1>
      <p class="sub">${tx('Tik de receiver aan. Kies daarna één keer zijn beveiligde ALUVISION-verbinding op je iPhone. Dezelfde wizard opent vanaf de receiver en gaat automatisch verder.', 'Tap the receiver. Then choose its secure ALUVISION connection once on your iPhone. The same wizard opens from the receiver and continues automatically.', 'Touchez le récepteur. Choisissez ensuite une fois sa connexion ALUVISION sécurisée sur votre iPhone. Le même assistant s’ouvre depuis le récepteur et continue automatiquement.', 'Tippe den Receiver an. Wähle danach einmal seine sichere ALUVISION-Verbindung auf deinem iPhone. Derselbe Assistent öffnet sich vom Receiver und läuft automatisch weiter.')}</p>
      ${destination ? `<div class="group-pair-target"><span><b>${tx('Wordt toegevoegd aan', 'Will be added to', 'Sera ajouté à', 'Wird hinzugefügt zu')}</b><small>${safe(destination.zone.name)} → ${safe(destination.group.name)}</small></span><span class="scope">${tx('AL GEKOZEN', 'PRESELECTED', 'PRÉSÉLECTIONNÉ', 'VORAUSGEWÄHLT')}</span></div>` : ''}
      <div class="v20-pair-visual" aria-hidden="true"><div class="v20-phone-glyph"><i>NFC</i></div><div class="v20-pair-waves"><i></i><i></i><i></i></div><div class="v20-hub-glyph"><b>R</b><small>Wi-Fi</small></div></div>
      <div class="v20-pair-steps">
        <span class="${provisioned || connected ? 'done' : 'on'}"><i>${provisioned || connected ? '✓' : '1'}</i><b>${tx('Tik NFC', 'Tap NFC', 'Touchez NFC', 'NFC antippen')}</b></span>
        <span class="${connected ? 'done' : provisioned ? 'on' : ''}"><i>${connected ? '✓' : '2'}</i><b>${tx('Kies verbinding', 'Choose connection', 'Choisissez la connexion', 'Verbindung wählen')}</b></span>
        <span class="${connected ? 'on' : ''}"><i>3</i><b>${tx('Receiver instellen', 'Set up receiver', 'Configurer le récepteur', 'Receiver einrichten')}</b></span>
      </div>
      ${provisioned ? `<div class="v20-network-card"><span><small>${tx('BEVEILIGDE RECEIVER-VERBINDING', 'SECURE RECEIVER CONNECTION', 'CONNEXION SÉCURISÉE DU RÉCEPTEUR', 'SICHERE RECEIVER-VERBINDUNG')}</small><b>${safe(link.ssid || 'ALUVISION-••••')}</b></span>${link.hasPassword ? `<button class="button soft" onclick="v20CopyPrivatePassword()">${tx('Code kopiëren', 'Copy code', 'Copier le code', 'Code kopieren')}</button>` : ''}</div>` : ''}
      ${stateMarkup}
      ${nfcHardwareMarkup}
      <div class="v20-pair-actions"><button class="button soft" onclick="closeModal()">${tx('Annuleren', 'Cancel', 'Annuler', 'Abbrechen')}</button>${connected ? `<button class="button" onclick="v20PairPrivateReceiver()">${tx('Receiver instellen', 'Set up receiver', 'Configurer le récepteur', 'Receiver einrichten')} →</button>` : `<button class="button" onclick="v20CheckPrivateReceiver()">${tx('Verbinding controleren', 'Check connection', 'Vérifier la connexion', 'Verbindung prüfen')}</button>`}</div>
    </section>`);
    if (provisioned && !connected) schedulePrivatePairCheck();
    if (connected && privatePairAutoRequested && !privatePairAutoStarted && !privatePairInFlight) {
      privatePairAutoStarted = true;
      setTimeout(() => window.v20PairPrivateReceiver?.(), 180);
    }
  }

  window.openAddReceiver = function v20OpenAddReceiver() {
    privatePairAutoRequested = false;
    privatePairAutoStarted = false;
    privatePairTarget = null;
    renderPrivateReceiverAdd();
  };

  window.openAddReceiverForGroup = function v20OpenAddReceiverForGroup() {
    if (!zone || !group) return toast(tx('Open eerst een groep', 'Open a group first', 'Ouvrez d’abord un groupe', 'Öffne zuerst eine Gruppe'));
    privatePairAutoRequested = false;
    privatePairAutoStarted = false;
    privatePairTarget = { zoneId: zone.id, groupId: group.id, deviceId: '' };
    renderPrivateReceiverAdd(privatePairTarget);
  };

  window.v20CopyPrivatePassword = async function v20CopyPrivatePassword() {
    try {
      const copied = await window.AluvisionPrivateWifi?.copyWifiPassword?.();
      toast(copied ? tx('Wachtwoord gekopieerd', 'Password copied', 'Mot de passe copié', 'Passwort kopiert') : tx('Geen wachtwoord ontvangen', 'No password received', 'Aucun mot de passe reçu', 'Kein Passwort empfangen'));
    } catch (_) {
      toast(tx('Kopiëren is niet toegestaan · houd het wachtwoord ingedrukt', 'Copying is unavailable · press and hold the password', 'Copie indisponible · maintenez le mot de passe', 'Kopieren nicht verfügbar · Passwort gedrückt halten'));
    }
  };

  window.v20CheckPrivateReceiver = async function v20CheckPrivateReceiver() {
    const node = document.getElementById('v20PrivatePairStatus');
    if (node) {
      node.className = 'nfc-status scanning';
      node.innerHTML = `<span><b>${tx('Verbinding controleren…', 'Checking connection…', 'Vérification de la connexion…', 'Verbindung wird geprüft…')}</b><small>${tx('De app zoekt Receiver 1 rechtstreeks.', 'The app is finding Receiver 1 directly.', 'L’application recherche directement le Récepteur 1.', 'Die App sucht Receiver 1 direkt.')}</small></span>`;
    }
    const details = privateWifiDetails();
    if (details.provisioned && details.needsLocalHandoff && window.AluvisionPrivateWifi?.navigateToGateway?.()) return;
    let response;
    try { response = await api('/api/discover', { active: true }); }
    catch (_) { response = { ok: false }; }
    const target = privatePairTarget && { ...privatePairTarget };
    if (response?.transport?.gatewayReady || window.AluvisionPrivateWifi?.isReady?.()) {
      renderPrivateReceiverAdd(target);
    } else {
      renderPrivateReceiverAdd(target, 'failed');
    }
  };

  window.v20PairPrivateReceiver = async function v20PairPrivateReceiver() {
    if (privatePairInFlight) return;
    privatePairInFlight = true;
    const node = document.getElementById('v20PrivatePairStatus');
    const button = document.querySelector('.v20-private-pair .v20-pair-actions .button:last-child');
    if (button) button.disabled = true;
    if (node) {
      node.className = 'nfc-status scanning';
      node.innerHTML = `<span><b>${tx('Receiver veilig toevoegen…', 'Adding receiver securely…', 'Ajout sécurisé du récepteur…', 'Receiver wird sicher hinzugefügt…')}</b><small>${tx('Identiteit en verbinding worden bevestigd.', 'Identity and connection are being confirmed.', 'L’identité et la connexion sont confirmées.', 'Identität und Verbindung werden bestätigt.')}</small></span>`;
    }
    const target = privatePairTarget && { ...privatePairTarget };
    let response;
    try {
      response = await api('/api/pair', { number: nextAvailableReceiverNumber() });
    } catch (error) {
      response = { ok: false, error: error?.message || error };
    }
    if (!response?.ok || !response.device) {
      if (node) {
        node.className = 'nfc-status error';
        node.innerHTML = `<span><b>${tx('Toevoegen is nog niet gelukt', 'Adding has not succeeded yet', 'L’ajout n’a pas encore réussi', 'Hinzufügen noch nicht erfolgreich')}</b><small>${safe(response?.error || tx('Tik NFC opnieuw aan en controleer het privénetwerk.', 'Tap NFC again and check the private network.', 'Touchez à nouveau le NFC et vérifiez le réseau privé.', 'Tippe NFC erneut an und prüfe das Privatnetz.'))}</small></span>`;
      }
      if (button) button.disabled = false;
      privatePairInFlight = false;
      privatePairAutoRequested = false;
      return;
    }
    const old = db.devices.find((device) => device.id === response.device.id);
    const gatewayRid = String(response.transport?.gateway?.rid || '').toUpperCase();
    const isGateway = gatewayRid === String(response.device.rid || '').toUpperCase();
    const device = normaliseDevice({ ...response.device, online: true, reachableViaGateway: true, gateway: isGateway }, old);
    db.devices = db.devices.filter((item) => item.id !== device.id);
    db.devices.push(device);
    db.transportStatus = response.transport || { gatewayReady: true, gateway: { rid: device.rid, hardwareId: device.hardwareId }, transport: 'WIFI_AP_ESPNOW' };
    save('queued');
    privatePairInFlight = false;
    privatePairAutoRequested = false;
    base.closeModal?.call(window);
    render();
    if (target?.zoneId && target?.groupId) startPairingForGroup(device.id, target.zoneId, target.groupId);
    else startPairing(device.id);
  };

  /* The original V11 raster loop and the current preview engine both painted
     the main canvas. Stop the obsolete loop after its next callback; the
     visibility-aware current engine remains responsible for all previews. */
  window.draw = function retiredLegacyDrawLoop() {};

  function ensureReceiverNumbers() {
    const used = new Set();
    let next = 1;
    (db.devices || []).forEach((device) => {
      const current = Math.round(Number(device.number));
      if (current >= 1 && current <= 250 && !used.has(current)) {
        device.number = current;
        used.add(current);
        return;
      }
      while (used.has(next) && next <= 250) next += 1;
      device.number = Math.min(next, 250);
      used.add(device.number);
      next += 1;
    });
  }

  window.render = function v20Render(...args) {
    ensureReceiverNumbers();
    const repairedZoneMain = ensureZoneMainReceivers();
    const result = base.render?.apply(this, args);
    if (repairedZoneMain) save('queued');
    requestAnimationFrame(() => replaceCustomerTransportCopy(document.querySelector('.app')));
    return result;
  };

  const style = document.createElement('style');
  style.dataset.releaseLayer = 'commissioning';
  style.textContent = `
    html,body{max-width:100%;overflow-x:hidden}
    .v20-commission{display:grid;gap:16px;min-width:0;color:var(--ink)}
    .v20-commission header{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
    .v20-commission header h1{margin:4px 0 5px;font-size:clamp(25px,5vw,35px)}
    .v20-commission header p{margin:0;color:var(--mut);line-height:1.45}
    .v20-commission footer{position:sticky;bottom:-2px;z-index:3;display:flex;justify-content:space-between;gap:10px;padding-top:12px;background:linear-gradient(transparent,var(--panel) 22%)}
    .v20-commission footer .button{min-height:50px;min-width:120px}
    .v20-stepper{display:grid;grid-template-columns:repeat(var(--step-count,3),1fr);gap:0;margin:0;padding:0;list-style:none}
    .v20-stepper li{position:relative;display:grid;justify-items:center;gap:5px;color:var(--mut);font-size:9px;font-weight:900;letter-spacing:.5px}
    .v20-stepper li:not(:last-child):after{content:'';position:absolute;left:calc(50% + 18px);right:calc(-50% + 18px);top:14px;height:2px;background:var(--line)}
    .v20-stepper li.done:not(:last-child):after{background:var(--red)}
    .v20-stepper i{position:relative;z-index:1;display:grid;place-items:center;width:29px;height:29px;border:2px solid var(--line);border-radius:50%;background:var(--panel);font-style:normal}
    .v20-stepper .on i,.v20-stepper .done i{border-color:var(--red);background:var(--red);color:#fff}
    .v20-stepper .on span{color:var(--ink)}
    .v20-live-card{display:grid;gap:15px;padding:15px;border:1px solid var(--line);border-radius:20px;background:var(--panel-2);box-shadow:inset 0 1px #fff6}
    .v20-strip-preview{display:flex;align-items:center;gap:3px;min-height:72px;padding:17px 14px;border-radius:15px;background:#101211;overflow:hidden;box-shadow:inset 0 0 30px #000}
    .v20-strip-preview i{display:block;flex:1;min-width:2px;height:29px;border-radius:5px;background:#353936;box-shadow:inset 0 1px #ffffff0d}
    .v20-strip-preview i.red,.v20-strip-preview i.end{background:#ff3b32;box-shadow:0 0 15px #ff3b32,0 0 3px #fff}
    .v20-strip-preview i.start{position:relative;z-index:2;background:#35f28a;box-shadow:0 0 15px #35f28a,0 0 3px #fff;animation:v20GreenConfirm 1.35s ease-in-out infinite}
    .v20-side-stage.left .v20-strip-preview i.start{animation:v20GreenTravelLeft .58s cubic-bezier(.2,.82,.2,1) both,v20GreenConfirm 1.35s ease-in-out .58s infinite}
    .v20-side-stage.right .v20-strip-preview i.start{animation:v20GreenTravelRight .58s cubic-bezier(.2,.82,.2,1) both,v20GreenConfirm 1.35s ease-in-out .58s infinite}
    .v20-big-number{display:grid;grid-template-columns:54px minmax(120px,1fr) 54px;gap:10px;max-width:380px;margin:auto;width:100%}
    .v20-big-number button{border:1px solid var(--line);border-radius:14px;background:var(--panel);color:var(--ink);font-size:25px;font-weight:700}
    .v20-big-number label{position:relative}.v20-big-number input{width:100%;height:69px;border:1px solid var(--line);border-radius:14px;background:var(--panel);color:var(--ink);font-size:31px;font-weight:900;text-align:center;padding:5px 8px 18px}
    .v20-big-number small{position:absolute;left:0;right:0;bottom:7px;text-align:center;color:var(--mut);font-size:8px;font-weight:950;letter-spacing:1px;pointer-events:none}
    .v20-range{width:100%;height:30px;accent-color:var(--red)}
    .v20-range-label{display:grid;grid-template-columns:40px 1fr 50px;align-items:center;margin-top:-13px;color:var(--mut);font-size:9px;font-weight:850}.v20-range-label b{text-align:center;color:var(--ink);font-size:12px}
    .v20-calibration-help{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.v20-calibration-help span{display:grid;grid-template-columns:24px 1fr;gap:2px 7px;align-items:center;padding:9px;border-radius:12px;background:var(--panel)}.v20-calibration-help i{grid-row:1/3;display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:var(--ink);color:#fff;font-style:normal;font-weight:950}.v20-calibration-help i.red{background:#f23d34;box-shadow:0 0 0 5px #f23d3417}.v20-calibration-help b{font-size:10px}.v20-calibration-help small{color:var(--mut);font-size:8px}
    .v20-side-stage{display:flex;align-items:center;gap:8px}.v20-side-stage.right{flex-direction:row-reverse}.v20-side-stage .v20-strip-preview{flex:1;min-width:0}.v20-receiver-glyph{display:grid;place-items:center;align-self:stretch;min-width:53px;border-radius:14px;background:#242624;color:#fff}.v20-receiver-glyph b{font-size:21px}.v20-receiver-glyph i{width:6px;height:6px;border-radius:50%;background:#dc5d56;box-shadow:0 0 9px #dc5d56}
    .v20-side-options{display:grid;grid-template-columns:1fr 1fr;gap:10px}.v20-side-options>button{display:grid;gap:9px;padding:12px;border:1px solid var(--line);border-radius:15px;background:var(--panel);color:var(--ink);cursor:pointer}.v20-side-options>button.on{border-color:var(--red);box-shadow:0 0 0 3px color-mix(in srgb,var(--red),transparent 84%)}.v20-side-icon{display:flex;align-items:center;gap:6px;height:45px;padding:7px;border-radius:10px;background:#101211}.v20-side-icon i{display:grid;place-items:center;width:30px;height:30px;border-radius:8px;background:#e8ebe8;color:#151715;font-style:normal;font-weight:950}.v20-side-icon b{position:relative;flex:1;height:15px;border-radius:99px;background:repeating-linear-gradient(90deg,#343834 0 6px,#202320 6px 8px)}.v20-side-icon b:after{content:'';position:absolute;left:3px;top:3px;width:9px;height:9px;border-radius:50%;background:#35f28a;box-shadow:0 0 9px #35f28a}.v20-side-icon.receiver-right b:after{left:auto;right:3px}
    .v20-choice-grid{display:grid;gap:9px}.v20-choice-grid>button{display:grid;grid-template-columns:48px minmax(0,1fr) 22px;align-items:center;gap:11px;width:100%;padding:11px;border:1px solid var(--line);border-radius:15px;background:var(--panel);color:var(--ink);text-align:left;cursor:pointer}.v20-choice-grid>button>i{display:grid;place-items:center;width:48px;height:48px;border-radius:13px;background:var(--panel-2);font-size:20px;font-style:normal}.v20-choice-grid span b,.v20-choice-grid span small{display:block}.v20-choice-grid span small{margin-top:3px;color:var(--mut);font-size:9px}.v20-choice-grid em{font-size:23px;font-style:normal}.v20-create-row{display:grid;grid-template-columns:1fr auto;gap:9px}.v20-empty{padding:18px;border:1px dashed var(--line);border-radius:15px;text-align:center;color:var(--mut)}
    .v20-security-uses{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.v20-security-uses span{display:grid;justify-items:center;gap:6px;padding:12px 7px;border:1px solid var(--line);border-radius:14px;background:var(--panel-2);text-align:center}.v20-security-uses i{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:var(--ink);color:var(--panel);font-size:18px;font-style:normal}.v20-security-uses b{font-size:9px}.v20-main-badge{display:inline-flex;align-items:center;gap:5px;padding:7px 9px;border-radius:99px;background:color-mix(in srgb,var(--red),var(--panel) 88%);color:var(--red);font-size:8px;letter-spacing:.6px;white-space:nowrap}.v20-code-card label{display:grid;gap:7px}.v20-code-card label>b{font-size:11px}.v20-code-card .field{height:52px;font-size:19px;text-align:center;letter-spacing:2px}.v20-code-card .v20-show-code{display:flex;align-items:center;gap:8px}.v20-code-card .v20-show-code input{width:20px;height:20px;accent-color:var(--red)}.v20-code-card p{margin:0;padding:11px;border-radius:13px;background:var(--panel);color:var(--mut);font-size:10px;line-height:1.45}.v20-code-card p b{color:var(--ink)}.v20-security-confirm-visual{display:flex;align-items:center;justify-content:center;gap:13px;min-height:130px;border-radius:20px;background:#151716;color:#fff}.v20-security-confirm-visual i,.v20-security-confirm-visual b{display:grid;place-items:center;width:64px;height:82px;border:1px solid #ffffff2b;border-radius:16px;background:#272a28;font-style:normal}.v20-security-confirm-visual span{width:70px;height:38px;background:radial-gradient(circle at 10px 50%,#d45a52 0 3px,transparent 4px),radial-gradient(circle at 35px 50%,#d45a52 0 3px,transparent 4px),radial-gradient(circle at 60px 50%,#d45a52 0 3px,transparent 4px);animation:v20PairWave 1.5s ease-in-out infinite}.v20-review-map{display:grid;grid-template-columns:minmax(0,1fr) 26px minmax(0,1fr);gap:8px;align-items:center}.v20-review-map>span{display:grid;grid-template-columns:42px minmax(0,1fr);gap:1px 9px;align-items:center;padding:12px;border:1px solid var(--line);border-radius:15px;background:var(--panel-2)}.v20-review-map>span i{grid-row:1/3;display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:var(--ink);color:var(--panel);font-style:normal}.v20-review-map small{color:var(--mut);font-size:8px;font-weight:950;letter-spacing:.8px}.v20-review-map b{overflow:hidden;text-overflow:ellipsis}.v20-review-map>em{text-align:center;font-size:25px;font-style:normal;color:var(--mut)}.v20-review-list{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.v20-review-list span{padding:12px;border:1px solid var(--line);border-radius:14px;background:var(--panel)}.v20-review-list small,.v20-review-list b{display:block}.v20-review-list small{color:var(--mut);font-size:8px;letter-spacing:.7px}.v20-review-list b{margin-top:5px;font-size:11px}.v20-main-receiver-card{display:grid;grid-template-columns:45px minmax(0,1fr);gap:11px;align-items:center;padding:12px;border:1px solid color-mix(in srgb,var(--red),var(--line) 55%);border-radius:15px;background:color-mix(in srgb,var(--red),var(--panel) 94%)}.v20-main-receiver-card>i{display:grid;place-items:center;width:45px;height:45px;border-radius:14px;background:var(--red);color:#fff;font-size:21px;font-style:normal}.v20-main-receiver-card b,.v20-main-receiver-card small{display:block}.v20-main-receiver-card small{margin-top:3px;color:var(--mut);font-size:9px;line-height:1.4}.v20-pair-loading{display:flex;align-items:center;justify-content:center;gap:12px;min-height:190px}.v20-pair-loading i{width:26px;height:26px;border:3px solid var(--line);border-top-color:var(--red);border-radius:50%;animation:v20Spin .8s linear infinite}
    .v20-complete{text-align:center}.v20-complete .v20-success,.v20-security-step>.v20-success{display:grid;place-items:center;width:68px;height:68px;margin:0 auto 13px;border-radius:50%;background:#19825c;color:#fff;font-size:29px;font-weight:950}.v20-complete p{color:var(--mut);line-height:1.6}.v20-complete .button{width:100%;margin-top:11px}
    .calibration-live[data-state="offline"]{background:#f9e9e7;color:#903e38}.calibration-live[data-state="sent"]{background:#fff3dd;color:#7b581f}
    .v20-private-pair{display:grid;gap:15px;min-width:0}.v20-private-pair h1{margin:0;font-size:clamp(28px,6vw,38px)}.v20-private-pair>.sub{margin-top:-8px;line-height:1.5}.v20-pair-visual{display:flex;align-items:center;justify-content:center;min-height:126px;padding:18px;border-radius:20px;background:radial-gradient(circle at 50% 50%,#ca4e4630,transparent 44%),#111312;color:#fff;overflow:hidden}.v20-phone-glyph,.v20-hub-glyph{display:grid;place-items:center;flex:0 0 72px;height:91px;border:1px solid #ffffff30;border-radius:18px;background:linear-gradient(145deg,#3b3e3b,#181a19);box-shadow:0 12px 26px #0008}.v20-phone-glyph:before{content:'';width:28px;height:5px;border-radius:99px;background:#ffffff35}.v20-phone-glyph i{font-size:10px;font-style:normal;letter-spacing:1px}.v20-hub-glyph b{font-size:27px}.v20-hub-glyph small{font-size:8px;color:#ffffffa5}.v20-pair-waves{position:relative;display:flex;align-items:center;justify-content:center;width:94px;height:70px}.v20-pair-waves i{position:absolute;width:19px;height:42px;border:2px solid #d65a52;border-left:0;border-top-color:transparent;border-bottom-color:transparent;border-radius:0 50% 50% 0;animation:v20PairWave 1.55s ease-out infinite}.v20-pair-waves i:nth-child(2){animation-delay:.32s}.v20-pair-waves i:nth-child(3){animation-delay:.64s}.v20-pair-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.v20-pair-steps span{display:grid;justify-items:center;gap:6px;padding:10px 6px;border:1px solid var(--line);border-radius:13px;color:var(--mut);text-align:center}.v20-pair-steps i{display:grid;place-items:center;width:27px;height:27px;border-radius:50%;background:var(--panel-2);font-style:normal;font-weight:900}.v20-pair-steps b{font-size:9px}.v20-pair-steps .on{border-color:var(--red);color:var(--ink)}.v20-pair-steps .on i{background:var(--red);color:#fff}.v20-pair-steps .done i{background:#19825c;color:#fff}.v20-network-card{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px;border:1px solid var(--line);border-radius:14px;background:var(--panel-2)}.v20-network-card span{min-width:0}.v20-network-card small,.v20-network-card b{display:block}.v20-network-card small{color:var(--mut);font-size:8px;letter-spacing:.65px}.v20-network-card b{margin-top:4px;overflow:hidden;text-overflow:ellipsis}.v20-pair-actions{display:grid;grid-template-columns:minmax(0,.7fr) minmax(0,1.3fr);gap:9px}.v20-pair-actions .button{min-width:0;min-height:50px}.v20-pair-actions .button:only-child{grid-column:1/-1}
    .v20-nfc-health{display:grid;grid-template-columns:34px minmax(0,1fr);gap:9px;align-items:center;padding:10px 11px;border:1px solid var(--line);border-radius:13px;background:var(--panel-2)}.v20-nfc-health>i{display:grid;place-items:center;width:34px;height:34px;border-radius:11px;background:#19825c;color:#fff;font-style:normal;font-weight:950}.v20-nfc-health.error>i{background:var(--red)}.v20-nfc-health b,.v20-nfc-health small{display:block}.v20-nfc-health small{margin-top:2px;color:var(--mut);font-size:9px}
    @keyframes v20GreenConfirm{50%{filter:brightness(1.25);transform:scaleY(.86)}}
    @keyframes v20GreenTravelRight{from{transform:translateX(-2400%);filter:brightness(1.35)}to{transform:translateX(0);filter:brightness(1)}}
    @keyframes v20GreenTravelLeft{from{transform:translateX(2400%);filter:brightness(1.35)}to{transform:translateX(0);filter:brightness(1)}}
    @keyframes v20PairWave{0%{opacity:0;transform:translateX(-9px) scale(.5)}25%{opacity:1}100%{opacity:0;transform:translateX(18px) scale(1.5)}}
    @keyframes v20Spin{to{transform:rotate(360deg)}}
    @media(max-width:620px){.v20-commission{gap:13px}.v20-live-card{padding:12px}.v20-calibration-help{grid-template-columns:1fr}.v20-calibration-help span{grid-template-columns:24px minmax(0,1fr)}.v20-side-options{grid-template-columns:1fr}.v20-commission footer{display:grid;grid-template-columns:minmax(0,.78fr) minmax(0,1.22fr)}.v20-commission footer .button{min-width:0;padding:9px}.v20-strip-preview{gap:2px;padding-inline:9px}.v20-strip-preview i{height:25px}.v20-stepper li span{font-size:7px;letter-spacing:0}.v20-network-card{align-items:stretch;flex-direction:column}.v20-network-card .button{width:100%}.v20-security-uses{grid-template-columns:1fr 1fr 1fr}.v20-security-uses span{padding-inline:4px}.v20-main-badge{display:none}.v20-review-map{grid-template-columns:1fr}.v20-review-map>em{transform:rotate(90deg);line-height:12px}.v20-review-list{grid-template-columns:1fr}.v20-review footer{grid-template-columns:minmax(0,.68fr) minmax(0,1.32fr)}}
    @media(prefers-reduced-motion:reduce){.v20-strip-preview i.start{animation:none}}
  `;
  document.head.appendChild(style);

  /* An NFC hand-off opens the same complete app, not a separate pairing
     website. Bring the receiver wizard forward automatically after the
     fragment has been captured and scrubbed by the Wi-Fi adapter. */
  const v20DeveloperHost = ['127.0.0.1', 'localhost', '::1'].includes(location.hostname);
  const v20UiTest = v20DeveloperHost ? new URLSearchParams(location.search).get('uiTest') : '';
  if (!v20UiTest && window.AluvisionPrivateWifi?.wasProvisionedThisLoad?.()) {
    privatePairAutoRequested = true;
    privatePairAutoStarted = false;
    setTimeout(() => {
      privatePairTarget = null;
      renderPrivateReceiverAdd();
    }, 180);
  }

  /* Deterministic visual fixture used by the release screenshots and browser
     regression suite. It is opt-in, never stored and never present in the
     normal customer route. */
  if (v20UiTest === 'commission') {
    setTimeout(() => {
      const fixtureId = '__v20_visual_spi__';
      if (!(db.devices || []).some((item) => item.id === fixtureId)) {
        db.devices.push({
          id: fixtureId,
          name: tx('Receiver 1 · A7C2', 'Receiver 1 · A7C2', 'Récepteur 1 · A7C2', 'Receiver 1 · A7C2'),
          receiverType: 'SPI', rid: 'A7C2000000000001', hardwareId: 'VISUAL-FIXTURE',
          pixels: 39, online: false, firmware: RELEASE.version
        });
      }
      install.security = { recoveryConfigured: true, primaryReceiverId: fixtureId, configuredAt: Date.now() };
      beginSpiFlow(fixtureId);
    }, 80);
  }

  if (v20UiTest === 'security') {
    setTimeout(() => {
      const fixtureId = '__v20_security_spi__';
      delete install.security;
      if (!(db.devices || []).some((item) => item.id === fixtureId)) {
        db.devices.push({
          id: fixtureId, name: 'Receiver 1 · NFC', receiverType: 'SPI',
          rid: 'ACCE550000000001', hardwareId: 'SECURITY-FIXTURE', pixels: 25,
          online: false, firmware: RELEASE.version
        });
      }
      window.AluvisionAccountlessRecovery = {
        normalizeUserCode(value) {
          const clean = String(value || '').replace(/\D/g, '');
          return clean.length >= 8 && clean.length <= 12 ? clean : '';
        },
        getStatus: async () => ({ available: true, configured: false, trusted: false }),
        setupInstallation: async () => ({ ok: true, recoveryKey: 'ABCDE-FGHJK-LMNPQ-RSTUV-WXYZ2', snapshotStored: true }),
        copyCode: async () => true
      };
      beginSpiFlow(fixtureId);
    }, 80);
  }

  if (v20UiTest === 'full') {
    setTimeout(() => {
      const seed = fresh().installations[0];
      const baseState = clone(seed.zones[0].groups[0].state);
      const spiA = { id: '__fixture_spi_1__', name: 'Receiver 1 · A7C2', receiverType: 'SPI', rid: 'A7C2000000000001', pixels: 39, reversed: false, online: true, firmware: RELEASE.version };
      const spiB = { id: '__fixture_spi_2__', name: 'Receiver 2 · F91B', receiverType: 'SPI', rid: 'F91B000000000002', pixels: 64, reversed: true, online: true, firmware: RELEASE.version };
      const rgbw = { id: '__fixture_rgbw_1__', name: 'Receiver 3 · 42DE', receiverType: 'RGBW', rid: '42DE000000000003', pixels: 1, portMask: 3, online: true, firmware: RELEASE.version };
      const mainGroup = {
        id: '__fixture_group_main__', name: tx('Hoofdlijn', 'Main line', 'Ligne principale', 'Hauptlinie'),
        layout: 'line', receiverType: 'SPI', state: { ...clone(baseState), animation: 'Traveling Pulse', engine: 'CHASE', widthPixels: 4, speed: 28 },
        receivers: [
          { id: '__line_1__', deviceId: spiA.id, name: spiA.name, rid: spiA.rid, receiverType: 'SPI', pixels: 39, reversed: false },
          { id: '__line_2__', deviceId: spiB.id, name: spiB.name, rid: spiB.rid, receiverType: 'SPI', pixels: 64, reversed: true }
        ]
      };
      const tunnelGroup = {
        id: '__fixture_group_tunnel__', name: 'Tunnel', layout: 'parallel', parallelOrientation: 'horizontal', receiverType: 'SPI',
        state: { ...clone(baseState), animation: 'Tunnel Wave', engine: 'LINE_WAVE', widthPixels: 7, lineDelayMs: 260, speed: 36 },
        receivers: [
          { id: '__tunnel_1__', deviceId: spiA.id, name: spiA.name, rid: spiA.rid, receiverType: 'SPI', pixels: 39, reversed: false },
          { id: '__tunnel_2__', deviceId: spiB.id, name: spiB.name, rid: spiB.rid, receiverType: 'SPI', pixels: 64, reversed: true }
        ]
      };
      const rgbwGroup = {
        id: '__fixture_group_rgbw__', name: tx('Sfeerverlichting', 'Ambient lighting', 'Éclairage d’ambiance', 'Stimmungslicht'), layout: 'parallel', receiverType: 'RGBW',
        state: typeof window.rgbwDefaultState === 'function' ? rgbwDefaultState() : { ...clone(baseState), animation: 'Soft Pulse', engine: 'BREATHE' },
        receivers: [
          { id: '__rgbw_p1__', deviceId: rgbw.id, name: `${rgbw.name} · Port 1`, rid: rgbw.rid, receiverType: 'RGBW', port: 1, pixels: 1, reversed: false },
          { id: '__rgbw_p2__', deviceId: rgbw.id, name: `${rgbw.name} · Port 2`, rid: rgbw.rid, receiverType: 'RGBW', port: 2, pixels: 1, reversed: false }
        ]
      };
      const fixture = {
        ...clone(seed), id: '__fixture_location__', name: tx('Showroom', 'Showroom', 'Showroom', 'Showroom'),
        activeZoneId: '__fixture_zone_main__', activeGroupId: mainGroup.id,
        zones: [
          { id: '__fixture_zone_main__', name: tx('Hoofdzone', 'Main zone', 'Zone principale', 'Hauptzone'), icon: '▦', groups: [mainGroup, tunnelGroup] },
          { id: '__fixture_zone_ambient__', name: tx('Lounge', 'Lounge', 'Salon', 'Lounge'), icon: '◉', groups: [rgbwGroup] }
        ], scenes: []
      };
      db.installations = [fixture];
      db.activeInstallationId = fixture.id;
      db.devices = [spiA, spiB, rgbw];
      install = fixture;
      zone = fixture.zones[0];
      group = mainGroup;
      render();
    }, 180);
  }
})();
