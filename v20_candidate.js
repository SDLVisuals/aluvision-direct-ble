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

  const RELEASE = Object.freeze({ version: '20.7.2', channel: 'production', protocol: 18 });
  const MAX_SPI_PIXELS = 1024;
  // A pixel-count slider is a live measuring tool. Keep a tiny guard against
  // touch jitter, but send the newest physical length without a visible wait.
  const CALIBRATION_DEBOUNCE_MS = 28;
  const flow = {
    active: false,
    phase: 'idle',
    deviceId: '',
    deviceSnapshot: null,
    directZoneId: '',
    directGroupId: '',
    generation: 0,
    timer: 0,
    leaseTimer: 0,
    setupTimer: 0,
    setupSessionActive: false,
    setupSessionSupported: true,
    visualOnly: false,
    pendingOutputCount: 0,
    inFlight: false,
    pending: null,
    lastAck: false,
    lastCalibrationStartedAt: 0,
    consecutiveCalibrationMisses: 0,
    configurationStored: false,
    receiverType: 'SPI',
    activePorts: [1],
    pixelPortIndex: 0,
    sidePortIndex: 0,
    needsSecurity: false,
    securityComplete: false,
    securityBackendReady: false,
    securityBackendError: '',
    securityDisposition: 'unavailable',
    pinAuthSupported: false,
    recoveryKey: '',
    resumePairing: null,
    resumeAfterSecurity: null
  };
  let privatePairTarget = null;
  let privatePairPollTimer = 0;
  let privatePairCheckInFlight = false;
  let privatePairInFlight = false;
  let privatePairAutoRequested = false;
  let privatePairAutoStarted = false;
  let privatePairAutoBatchActive = false;
  let privatePairNetworkReady = false;

  window.AluvisionRelease = RELEASE;
  window.AluvisionCommissioning = Object.freeze({
    getState() {
      return Object.freeze({
        active: flow.active, phase: flow.phase, deviceId: flow.deviceId,
        receiverType: flow.receiverType, activePorts: [...flow.activePorts],
        pixelPortIndex: flow.pixelPortIndex, sidePortIndex: flow.sidePortIndex,
        setupSessionActive: flow.setupSessionActive,
        setupSessionSupported: flow.setupSessionSupported,
        securityDisposition: flow.securityDisposition,
        securityComplete: flow.securityComplete
      });
    }
  });

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

  function commissionSecurityApi() {
    return window.AluvisionNativeConnection?.securityProvider || window.AluvisionAccountlessRecovery || null;
  }

  function spiDevice(id = flow.deviceId) {
    const current = (db.devices || []).find((item) => item.id === id);
    if (current) {
      if (id === flow.deviceId) flow.deviceSnapshot = current;
      return current;
    }
    return flow.deviceSnapshot?.id === id ? flow.deviceSnapshot : null;
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

  function clampPortCount(value, fallback = 1) {
    const parsed = Number(value);
    return Math.max(1, Math.min(4, Number.isFinite(parsed) ? Math.round(parsed) : fallback));
  }

  function spiPortCapacity(device = spiDevice()) {
    return Number(device?.portCapacity ?? device?.portCapability ?? device?.PORTCAP ?? device?.spiPortCapability) === 4 ? 4 : 1;
  }

  function activePortNumbers(count = pairDraft?.portCount || flow.activePorts.length || 1) {
    return Array.from({ length: clampPortCount(count) }, (_, index) => index + 1);
  }

  function portMask(ports = flow.activePorts) {
    return ports.reduce((mask, port) => mask | (1 << (Number(port) - 1)), 0) || 1;
  }

  function storedPortAssignment(deviceId, port) {
    for (const location of db.installations || []) {
      for (const selectedZone of location.zones || []) {
        for (const selectedGroup of selectedZone.groups || []) {
          const line = (selectedGroup.receivers || []).find(item => item.deviceId === deviceId && Math.max(1, Number(item.port) || 1) === Number(port));
          if (line) return { line, selectedZone, selectedGroup, index: selectedGroup.receivers.indexOf(line) };
        }
      }
    }
    return null;
  }

  function portDraft(port) {
    const device = spiDevice();
    const number = Math.max(1, Math.min(4, Number(port) || 1));
    pairDraft.ports ||= {};
    if (!pairDraft.ports[number]) {
      const stored = device?.spiPorts?.[number] || device?.spiPorts?.[String(number)] || {};
      const assignment = storedPortAssignment(device?.id, number);
      pairDraft.ports[number] = {
        pixels: clampPixels(stored.pixels ?? (number === 1 ? device?.pixels : 25), 25),
        reversed: Boolean(stored.reversed ?? stored.physicalReverse ?? (number === 1 ? device?.reversed : false)),
        zoneId: assignment?.selectedZone.id || '', groupId: assignment?.selectedGroup.id || ''
      };
    }
    return pairDraft.ports[number];
  }

  function currentCalibrationPort() {
    const index = flow.phase === 'side' ? flow.sidePortIndex : flow.pixelPortIndex;
    return flow.activePorts[Math.max(0, Math.min(flow.activePorts.length - 1, index))] || 1;
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
      id: `commission-${snapshot.deviceId}-port-${snapshot.port}`,
      deviceId: snapshot.deviceId,
      rid: device?.rid || target?.rid,
      physicalRid: device?.rid || target?.physicalRid || target?.rid,
      port: snapshot.port,
      outputPort: snapshot.port,
      portCount: flow.activePorts.length,
      portMask: portMask(),
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
    const port = currentCalibrationPort();
    const settings = portDraft(port);
    return {
      deviceId: flow.deviceId,
      port,
      pixels: clampPixels(settings.pixels, port === 1 ? spiDevice()?.pixels || 25 : 25),
      reversed: Boolean(settings.reversed),
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

  function calibrationPhase(phase = flow.phase) {
    return ['length', 'side', 'assign', 'assign-zone', 'assign-group', 'review'].includes(phase);
  }

  function setupSessionTarget() {
    const device = spiDevice();
    if (!device) return null;
    return {
      id: `commission-session-${device.id}`,
      deviceId: device.id,
      rid: device.rid,
      physicalRid: device.rid,
      hardwareId: device.hardwareId,
      receiverType: 'SPI',
      port: 0,
      outputPort: 0,
      portCount: spiPortCapacity(device),
      portMask: portMask()
    };
  }

  async function sendSetupSession(action) {
    if (flow.visualOnly) return true;
    const target = setupSessionTarget();
    if (!target) return false;
    try {
      const response = await api('/api/command', {
        action,
        state: { receiverType: 'SPI', port: 0, portMask: portMask() },
        targets: [target]
      });
      const result = response?.results?.[0] || {};
      const detail = String(result.detail || response?.error || '').toUpperCase();
      if (detail.includes('UNKNOWN') || detail.includes('ONBEKEND')) flow.setupSessionSupported = false;
      /* SETUP_END is the transaction boundary: an accepted gateway packet is
         not enough.  The receiver itself must acknowledge it (the bridge also
         turns the legacy single-output fallback into an exact confirmation). */
      return Boolean(result.confirmed);
    } catch (_) {
      return false;
    }
  }

  function armSetupSession() {
    clearTimeout(flow.setupTimer);
    flow.setupTimer = 0;
    if (!flow.active || !flow.setupSessionActive || !flow.setupSessionSupported) return;
    const generation = flow.generation;
    flow.setupTimer = setTimeout(async () => {
      flow.setupTimer = 0;
      if (!flow.active || flow.generation !== generation || !flow.setupSessionActive) return;
      await sendSetupSession('setup_keepalive');
      if (flow.active && flow.generation === generation) armSetupSession();
    }, 15000);
  }

  function beginSetupSession() {
    if (!flow.active || flow.receiverType !== 'SPI' || flow.setupSessionActive) return;
    flow.setupSessionActive = true;
    flow.setupSessionSupported = true;
    const generation = flow.generation;
    sendSetupSession('setup_begin').finally(() => {
      if (flow.active && flow.generation === generation) armSetupSession();
    });
  }

  async function finishSetupSession(cancelled = false) {
    clearTimeout(flow.setupTimer);
    flow.setupTimer = 0;
    if (!flow.setupSessionActive) return false;
    flow.setupSessionActive = false;
    if (!flow.setupSessionSupported) return false;
    return sendSetupSession(cancelled ? 'setup_cancel' : 'setup_end');
  }

  async function sendCalibration(item) {
    if (flow.visualOnly) return { online: true, confirmed: true, detail: 'VISUAL_FIXTURE' };
    const action = item.mode === 'end'
      ? 'calibrate_end'
      : item.mode === 'start'
        ? 'calibrate_start'
        : 'calibrate_clear';
    const response = await api('/api/command', {
      action,
      state: {
        receiverType: 'SPI',
        port: item.port,
        portCount: flow.activePorts.length,
        portMask: portMask(),
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
      confirmed: Boolean(result.confirmed),
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
      // A cancelled setup can be followed immediately by a new receiver
      // setup. The old promise must never clear the new generation's busy
      // flag when it eventually settles, or two calibration writes can race.
      if (item.generation === flow.generation) flow.inFlight = false;
    }
    if (!flow.active || item.generation !== flow.generation) return;
    flow.lastAck = result.confirmed;
    if (result.online || result.confirmed) flow.consecutiveCalibrationMisses = 0;
    else flow.consecutiveCalibrationMisses += 1;
    if (flow.pending) {
      scheduleCalibration(true);
      return;
    }
    if (result.confirmed) {
      status(
        item.mode === 'end'
          ? item.pixels === 1
            ? tx('Pixel 1 is rood', 'Pixel 1 is red', 'Le pixel 1 est rouge', 'Pixel 1 ist rot')
            : tx(`Pixels 1–${item.pixels - 1} branden wit · pixel ${item.pixels} is rood`, `Pixels 1–${item.pixels - 1} are white · pixel ${item.pixels} is red`, `Les pixels 1–${item.pixels - 1} sont blancs · le pixel ${item.pixels} est rouge`, `Pixel 1–${item.pixels - 1} leuchten weiß · Pixel ${item.pixels} ist rot`)
          : tx('Groene beginpixel en witte lijn staan live aan de gekozen kant', 'Green start pixel and white line are live on the selected side', 'Le pixel vert de départ et la ligne blanche sont actifs du côté choisi', 'Grüner Startpixel und weiße Linie sind auf der gewählten Seite aktiv'),
        'online'
      );
    } else if (result.online) {
      status(tx('Commando ontvangen · controleer de LED Line', 'Command received · check the LED Line', 'Commande reçue · vérifiez la LED Line', 'Befehl empfangen · LED Line prüfen'), 'sent');
    } else if (flow.consecutiveCalibrationMisses < 3) {
      status(tx('Verbinding wordt automatisch hersteld · uw instelling blijft bewaard', 'Reconnecting automatically · your setting is retained', 'Reconnexion automatique · votre réglage reste enregistré', 'Verbindung wird automatisch wiederhergestellt · Einstellung bleibt erhalten'), 'sent');
    } else {
      status(tx('Receiver tijdelijk niet bereikbaar · we blijven opnieuw proberen', 'Receiver temporarily unavailable · retrying continues', 'Récepteur temporairement indisponible · nouvelles tentatives en cours', 'Receiver vorübergehend nicht erreichbar · weitere Versuche laufen'), 'offline');
    }
    armCalibrationLease();
  }

  /* Firmware diagnostics deliberately expire if a controller disappears.
     During the complete setup flow, renew that safety lease so
     no saved animation can reappear before the customer presses Back,
     Cancel, Continue or Confirm. */
  function armCalibrationLease() {
    clearTimeout(flow.leaseTimer);
    flow.leaseTimer = 0;
    if (!flow.active || !calibrationPhase()) return;
    const expectedGeneration = flow.generation;
    flow.leaseTimer = setTimeout(() => {
      flow.leaseTimer = 0;
      if (!flow.active || flow.generation !== expectedGeneration || !calibrationPhase()) return;
      scheduleCalibration(true, flow.phase);
    }, 1400);
  }

  function scheduleCalibration(immediate = false, mode = flow.phase) {
    if (!flow.active || !calibrationPhase()) return;
    clearTimeout(flow.leaseTimer);
    flow.leaseTimer = 0;
    flow.pending = snapshot(mode === 'length' || mode === 'end' ? 'end' : 'start');
    clearTimeout(flow.timer);
    if (flow.inFlight) return;
    const elapsed = performance.now() - flow.lastCalibrationStartedAt;
    const delay = immediate || elapsed >= CALIBRATION_DEBOUNCE_MS
      ? 0
      : Math.max(0, CALIBRATION_DEBOUNCE_MS - elapsed);
    flow.timer = setTimeout(() => {
      flow.lastCalibrationStartedAt = performance.now();
      drainCalibration();
    }, delay);
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
      labels.push({ key: 'outputs', label: tx('Uitgangen', 'Outputs', 'Sorties', 'Ausgänge') });
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
      const className = marker ? kind : 'fill';
      return `<i class="${className}"></i>`;
    }).join('');
  }

  function renderSecurity() {
    const device = spiDevice();
    if (!device) return stopFlow();
    flow.phase = 'security';
    const backendReady = flow.securityBackendReady === true;
    const restoreRequired = flow.securityDisposition === 'restore-required';
    const ownershipUnknown = flow.securityDisposition === 'ownership-unknown';
    const nativeProvider = window.AluvisionNativeConnection?.securityProvider;
    const canRestore = restoreRequired && (nativeProvider
      ? flow.pinAuthSupported && typeof nativeProvider.restoreInstallation === 'function'
      : typeof window.AluvisionAccountlessRecovery?.openRestore === 'function');
    const heading = backendReady ? tx('Kies je persoonlijke pincode', 'Choose your personal PIN', 'Choisissez votre code PIN personnel', 'Wähle deine persönliche PIN')
      : restoreRequired ? tx('Bestaande installatie', 'Existing installation', 'Installation existante', 'Bestehende Installation')
      : ownershipUnknown ? tx('Eigenaarschap controleren', 'Check ownership', 'Vérifier le propriétaire', 'Eigentümer prüfen')
      : tx('Verbinding controleren', 'Check connection', 'Vérifier la connexion', 'Verbindung prüfen');
    const detail = backendReady ? tx('Eén pincode voor je hele installatie, ook voor extra receivers.', 'One PIN for your entire installation, including additional receivers.', 'Un seul code PIN pour toute l’installation, récepteurs supplémentaires compris.', 'Eine PIN für die ganze Installation, auch für weitere Receiver.')
      : restoreRequired ? canRestore
        ? tx('Herstel toegang met de pincode van deze installatie.', 'Restore access with this installation’s PIN.', 'Rétablissez l’accès avec le code PIN de cette installation.', 'Stelle den Zugang mit der PIN dieser Installation wieder her.')
        : tx('Herstel via pincode is hier nog niet beschikbaar. Gebruik de gekoppelde telefoon of controleer de verbinding opnieuw.', 'PIN recovery is not available here yet. Use the paired phone or check the connection again.', 'La récupération par PIN n’est pas encore disponible ici. Utilisez le téléphone associé ou vérifiez la connexion.', 'PIN-Wiederherstellung ist hier noch nicht verfügbar. Nutze das gekoppelte Telefon oder prüfe die Verbindung erneut.')
      : ownershipUnknown ? tx('Deze receiver is al gekoppeld. Verbind met de juiste installatie en controleer opnieuw.', 'This receiver is already paired. Connect to the correct installation and check again.', 'Ce récepteur est déjà associé. Connectez-vous à la bonne installation et vérifiez à nouveau.', 'Dieser Receiver ist bereits gekoppelt. Verbinde dich mit der richtigen Installation und prüfe erneut.')
      : tx('De beveiliging van je hoofdreceiver is nog niet bereikbaar. Controleer de verbinding en probeer opnieuw.', 'Your main receiver’s security is not reachable yet. Check the connection and try again.', 'La sécurité du récepteur principal n’est pas accessible. Vérifiez la connexion et réessayez.', 'Die Sicherheit des Haupt-Receivers ist noch nicht erreichbar. Prüfe die Verbindung und versuche es erneut.');
    modal(`<section class="v20-commission v20-security-step" data-phase="security" data-security-state="${flow.securityDisposition}">
      ${stepDots('security')}
      <header><span><div class="eyebrow">${tx(`STAP ${stepNumber('security')} · BEVEILIGING`, `STEP ${stepNumber('security')} · SECURITY`, `ÉTAPE ${stepNumber('security')} · SÉCURITÉ`, `SCHRITT ${stepNumber('security')} · SICHERHEIT`)}</div><h1>${heading}</h1><p>${detail}</p></span></header>
      ${backendReady ? `<section class="v20-live-card v20-code-card">
        <label><b>${tx('Persoonlijke pincode', 'Personal PIN', 'Code PIN personnel', 'Persönliche PIN')}</b><input id="v20CommissionCode" class="field v20-recovery-input" type="password" inputmode="numeric" autocomplete="new-password" maxlength="12" placeholder="8–12 ${tx('cijfers', 'digits', 'chiffres', 'Ziffern')}"></label>
        <label><b>${tx('Herhaal de code', 'Repeat the code', 'Répétez le code', 'Code wiederholen')}</b><input id="v20CommissionCodeAgain" class="field v20-recovery-input" type="password" inputmode="numeric" autocomplete="new-password" maxlength="12" placeholder="••••••••"></label>
        <label class="v20-show-code"><input type="checkbox" onchange="v20ToggleCommissionCode(this.checked)"><span>${tx('Code tonen', 'Show code', 'Afficher le code', 'Code anzeigen')}</span></label>
        <p>${tx('Bewaar deze code voor een nieuwe telefoon of herstel.', 'Keep this code for a new phone or recovery.', 'Conservez ce code pour un nouveau téléphone ou une restauration.', 'Bewahre die PIN für ein neues Telefon oder eine Wiederherstellung auf.')}</p>
      </section>` : `<div class="v20-security-backend-wait" role="status"><i>${restoreRequired ? '↻' : '!'}</i><span><b>${tx('Instellingen blijven bewaard', 'Settings are retained', 'Les réglages sont conservés', 'Einstellungen bleiben erhalten')}</b><small>${tx('Ga verder zodra de toegang is bevestigd.', 'Continue once access is confirmed.', 'Continuez lorsque l’accès est confirmé.', 'Fahre fort, sobald der Zugang bestätigt ist.')}</small></span></div>`}
      <footer><button class="button soft" onclick="v20CancelCommission()">${tx('Annuleren', 'Cancel', 'Annuler', 'Abbrechen')}</button>${backendReady ? `<button class="button" onclick="v20CreateInstallationProtection()">${tx('Pincode bewaren', 'Save PIN', 'Enregistrer le PIN', 'PIN speichern')} →</button>` : canRestore ? `<button class="button" onclick="v20RestoreCommissionInstallation()">${tx('Toegang herstellen', 'Restore access', 'Rétablir l’accès', 'Zugang wiederherstellen')}</button>` : `<button class="button" onclick="v20RetryCommissionSecurity()">${tx('Opnieuw controleren', 'Check again', 'Vérifier à nouveau', 'Erneut prüfen')}</button>`}</footer>
    </section>`);
  }

  function markInstallationSecurityPending(device) {
    install.security = {
      ...(install.security || {}),
      recoveryConfigured: false,
      primaryReceiverId: install.security?.primaryReceiverId || device.id,
      physicalConfirmationPending: true,
      testMode: 'wifi',
      pendingAt: install.security?.pendingAt || Date.now()
    };
    flow.securityComplete = false;
    save('queued');
  }

  function markInstallationProtected(device) {
    const currentMain = (db.devices || []).find(item => item.id === install.security?.primaryReceiverId);
    const mainId = device.gateway || device.mainReceiver || !currentMain ? device.id : currentMain.id;
    install.security = {
      ...(install.security || {}),
      recoveryConfigured: true,
      primaryReceiverId: mainId.startsWith('native-restore-') ? 'rx-' + String(device.rid).toLowerCase() : mainId,
      configuredAt: install.security?.configuredAt || Date.now(),
      physicalConfirmationPending: false,
      testMode: false
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
      <button class="button soft" onclick="v20CopyCommissionRecoveryKey('${safe(recoveryKey)}')">${tx('Recovery Key kopiëren', 'Copy Recovery Key', 'Copier la Recovery Key', 'Recovery Key kopieren')}</button>
      <footer><span></span><button class="button" onclick="v20ContinueAfterRecoveryKey()">${tx('Ik heb hem bewaard', 'I saved it', 'Je l’ai conservée', 'Ich habe ihn gespeichert')} →</button></footer>
    </section>`);
  }

  function continueAfterSecurity() {
    flow.recoveryKey = '';
    if (typeof flow.resumeAfterSecurity === 'function') {
      const resume = flow.resumeAfterSecurity;
      stopFlow(false);
      return resume();
    }
    if (flow.receiverType === 'RGBW' && typeof flow.resumePairing === 'function') {
      const resume = flow.resumePairing;
      stopFlow(false);
      return resume();
    }
    beginSetupSession();
    renderOutputs();
  }

  function outputBoard(count) {
    const selected = clampPortCount(count);
    const capacity = spiPortCapacity();
    return `<div class="v207-output-board" aria-hidden="true"><div class="v207-output-receiver"><span>ALUVISION</span><b>SPI</b><small>${capacity === 4 ? tx('4 UITGANGEN', '4 OUTPUTS', '4 SORTIES', '4 AUSGÄNGE') : tx('1 UITGANG', '1 OUTPUT', '1 SORTIE', '1 AUSGANG')}</small></div><div class="v207-output-routes">${Array.from({ length: capacity }, (_, index) => index + 1).map((port) => `<span class="${port <= selected ? 'on' : ''}"><i>P${port}</i><em></em><b>${tx('LED Line', 'LED Line', 'LED Line', 'LED Line')} ${port}</b></span>`).join('')}</div></div>`;
  }

  function renderOutputs() {
    const device = spiDevice();
    if (!device) return stopFlow();
    flow.phase = 'outputs';
    const count = clampPortCount(pairDraft.portCount, 1);
    const capacity = spiPortCapacity(device);
    pairDraft.portCount = Math.min(count, capacity);
    flow.activePorts = activePortNumbers(pairDraft.portCount);
    flow.activePorts.forEach(portDraft);
    modal(`<section class="v20-commission v207-output-step" data-phase="outputs">
      ${stepDots('outputs')}
      <header><span><div class="eyebrow">${tx(`STAP ${stepNumber('outputs')} · UITGANGEN`, `STEP ${stepNumber('outputs')} · OUTPUTS`, `ÉTAPE ${stepNumber('outputs')} · SORTIES`, `SCHRITT ${stepNumber('outputs')} · AUSGÄNGE`)}</div><h1>${tx('Hoeveel LED Lines zijn aangesloten?', 'How many LED Lines are connected?', 'Combien de LED Lines sont connectées ?', 'Wie viele LED Lines sind angeschlossen?')}</h1><p>${tx('Kies 1, 2, 3 of 4 uitgangen. Iedere uitgang wordt daarna afzonderlijk ingesteld.', 'Choose 1, 2, 3 or 4 outputs. Each output is then configured separately.', 'Choisissez 1, 2, 3 ou 4 sorties. Chaque sortie est ensuite réglée séparément.', 'Wähle 1, 2, 3 oder 4 Ausgänge. Jeder Ausgang wird danach einzeln eingerichtet.')}</p></span></header>
      <section class="v20-live-card">${outputBoard(pairDraft.portCount)}${capacity === 4 ? `<div class="v207-output-count" role="radiogroup">${[1, 2, 3, 4].map((value) => `<button class="${value === pairDraft.portCount ? 'on' : ''}" role="radio" aria-checked="${value === pairDraft.portCount}" onclick="v207SetOutputCount(${value})"><b>${value}</b><span>${value === 1 ? 'LED Line' : 'LED Lines'}</span><i>${value === pairDraft.portCount ? '✓' : ''}</i></button>`).join('')}</div>` : `<div class="v207-legacy-port-note"><i>1</i><span><b>${tx('Deze receiver heeft één beschikbare uitgang', 'This receiver has one available output', 'Ce récepteur possède une sortie disponible', 'Dieser Receiver hat einen verfügbaren Ausgang')}</b></span></div>`}<div class="v207-output-summary"><b>1 receiver</b><em>→</em><b>${pairDraft.portCount} LED Line${pairDraft.portCount === 1 ? '' : 's'}</b></div></section>
      <footer><button class="button soft" onclick="v20CancelCommission()">${tx('Annuleren', 'Cancel', 'Annuler', 'Abbrechen')}</button><button class="button" onclick="v207ContinueToPixels()">${tx('Pixels instellen', 'Configure pixels', 'Configurer les pixels', 'Pixel einstellen')} →</button></footer>
    </section>`);
  }

  function renderLength() {
    const device = spiDevice();
    if (!device) return stopFlow();
    flow.phase = 'length';
    const port = currentCalibrationPort();
    const settings = portDraft(port);
    const pixels = clampPixels(settings.pixels, port === 1 ? device.pixels || 25 : 25);
    settings.pixels = pixels;
    modal(`<section class="v20-commission" data-phase="length">
      ${stepDots('length')}
      <header><span><div class="eyebrow">${tx(`STAP ${stepNumber('length')} · POORT ${port} VAN ${flow.activePorts.length}`, `STEP ${stepNumber('length')} · PORT ${port} OF ${flow.activePorts.length}`, `ÉTAPE ${stepNumber('length')} · PORT ${port} SUR ${flow.activePorts.length}`, `SCHRITT ${stepNumber('length')} · PORT ${port} VON ${flow.activePorts.length}`)}</div><h1>${tx(`Zoek de laatste pixel van poort ${port}`, `Find the final pixel of port ${port}`, `Trouvez le dernier pixel du port ${port}`, `Finde den letzten Pixel von Port ${port}`)}</h1><p>${tx('De gekozen pixels branden wit. Schuif tot de rode pixel precies op het fysieke einde staat.', 'Selected pixels light white. Slide until the red pixel is exactly at the physical end.', 'Les pixels sélectionnés s’allument en blanc. Faites glisser jusqu’à ce que le pixel rouge soit exactement à l’extrémité.', 'Die gewählten Pixel leuchten weiß. Schiebe, bis der rote Pixel genau am physischen Ende steht.')}</p></span><b class="live-indicator">LIVE · P${port}</b></header>
      <section class="v20-live-card">
        <div id="v20CommissionStatus" class="calibration-live red-end" data-state="working" aria-live="polite">${tx('Witte lijn en rode eindpixel starten…', 'Starting white line and red end pixel…', 'Démarrage de la ligne blanche et du pixel final rouge…', 'Weiße Linie und roter Endpixel werden gestartet…')}</div>
        <div class="v20-strip-preview end" aria-label="${tx('Alle gekozen pixels zijn wit en de laatste pixel is rood', 'All selected pixels are white and the final pixel is red', 'Tous les pixels sélectionnés sont blancs et le dernier pixel est rouge', 'Alle gewählten Pixel sind weiß und der letzte Pixel ist rot')}">${ledCells('end')}</div>
        <div class="v20-big-number"><button onclick="v20AdjustPixels(-1)" aria-label="− 1">−</button><label><input id="v20PixelNumber" type="number" inputmode="numeric" min="1" max="${MAX_SPI_PIXELS}" value="${pixels}" oninput="v20SetPixels(this.value)"><small>PIXELS</small></label><button onclick="v20AdjustPixels(1)" aria-label="＋ 1">＋</button></div>
        <input id="v20PixelRange" class="v20-range" type="range" min="1" max="${MAX_SPI_PIXELS}" step="1" value="${pixels}" oninput="v20SetPixels(this.value)">
        <div class="v20-range-label"><span>1</span><b id="v20PixelReadout">${pixelLabel(pixels)}</b><span>${MAX_SPI_PIXELS}</span></div>
        <div class="v20-calibration-help"><span><i class="red"></i><b>${tx('Rood op het einde', 'Red at the end', 'Rouge à la fin', 'Rot am Ende')}</b><small>${tx('Aantal klopt', 'Count is correct', 'Le nombre est correct', 'Anzahl stimmt')}</small></span><span><i>−</i><b>${tx('Geen rood zichtbaar', 'No red visible', 'Pas de rouge visible', 'Kein Rot sichtbar')}</b><small>${tx('Aantal verlagen', 'Lower the count', 'Réduire le nombre', 'Anzahl verringern')}</small></span><span><i>＋</i><b>${tx('Rood staat te vroeg', 'Red appears too early', 'Le rouge apparaît trop tôt', 'Rot erscheint zu früh')}</b><small>${tx('Aantal verhogen', 'Raise the count', 'Augmenter le nombre', 'Anzahl erhöhen')}</small></span></div>
      </section>
      <footer><button class="button soft" onclick="v207PreviousPixelStep()">← ${flow.pixelPortIndex ? tx('Vorige poort', 'Previous port', 'Port précédent', 'Vorheriger Port') : tx('Uitgangen', 'Outputs', 'Sorties', 'Ausgänge')}</button><button class="button" onclick="v207NextPixelStep()">${flow.pixelPortIndex < flow.activePorts.length - 1 ? tx('Volgende poort', 'Next port', 'Port suivant', 'Nächster Port') : tx('Aansluitkant kiezen', 'Choose connection side', 'Choisir le côté', 'Anschlussseite wählen')} →</button></footer>
    </section>`);
    scheduleCalibration(true, 'length');
  }

  function renderSide() {
    const device = spiDevice();
    if (!device) return stopFlow();
    flow.phase = 'side';
    const port = currentCalibrationPort();
    const settings = portDraft(port);
    const right = Boolean(settings.reversed);
    modal(`<section class="v20-commission" data-phase="side">
      ${stepDots('side')}
      <header><span><div class="eyebrow">${tx(`STAP ${stepNumber('side')} · POORT ${port} VAN ${flow.activePorts.length}`, `STEP ${stepNumber('side')} · PORT ${port} OF ${flow.activePorts.length}`, `ÉTAPE ${stepNumber('side')} · PORT ${port} SUR ${flow.activePorts.length}`, `SCHRITT ${stepNumber('side')} · PORT ${port} VON ${flow.activePorts.length}`)}</div><h1>${tx(`Aan welke kant zit de receiver voor poort ${port}?`, `Which side is the receiver on for port ${port}?`, `De quel côté se trouve le récepteur pour le port ${port} ?`, `Auf welcher Seite sitzt der Receiver für Port ${port}?`)}</h1><p>${tx('Tik links of rechts. Alleen de groene beginpixel van deze poort licht op.', 'Tap left or right. Only the green start pixel of this port lights up.', 'Touchez gauche ou droite. Seul le pixel de départ vert de ce port s’allume.', 'Tippe links oder rechts. Nur der grüne Startpixel dieses Ports leuchtet.')}</p></span><b class="live-indicator">LIVE · P${port}</b></header>
      <section class="v20-live-card">
        <div id="v20CommissionStatus" class="calibration-live" data-state="working" aria-live="polite">${tx('Groene beginpixel starten…', 'Starting green start pixel…', 'Démarrage du pixel vert…', 'Grüner Startpixel wird gestartet…')}</div>
        <div class="v20-side-stage ${right ? 'right' : 'left'}"><div class="v20-receiver-glyph"><b>R</b><i></i></div><div class="v20-strip-preview start">${ledCells('start', right)}</div></div>
        <div class="v20-side-options" role="radiogroup">
          <button class="${right ? '' : 'on'}" role="radio" aria-checked="${!right}" onclick="v20SetReceiverSide('left')"><span class="v20-side-icon receiver-left"><i>R</i><b></b></span><strong>${tx('Receiver links', 'Receiver left', 'Récepteur à gauche', 'Receiver links')}</strong></button>
          <button class="${right ? 'on' : ''}" role="radio" aria-checked="${right}" onclick="v20SetReceiverSide('right')"><span class="v20-side-icon receiver-right"><b></b><i>R</i></span><strong>${tx('Receiver rechts', 'Receiver right', 'Récepteur à droite', 'Receiver rechts')}</strong></button>
        </div>
      </section>
      <footer><button class="button soft" onclick="v207PreviousSideStep()">← ${flow.sidePortIndex ? tx('Vorige poort', 'Previous port', 'Port précédent', 'Vorheriger Port') : tx('Pixels', 'Pixels', 'Pixels', 'Pixel')}</button><button class="button" onclick="v207NextSideStep()">${flow.sidePortIndex < flow.activePorts.length - 1 ? tx('Volgende poort', 'Next port', 'Port suivant', 'Nächster Port') : tx('Uitgangen indelen', 'Assign outputs', 'Affecter les sorties', 'Ausgänge zuordnen')} →</button></footer>
    </section>`);
    scheduleCalibration(true, 'side');
  }

  async function commitGeometry() {
    const device = spiDevice();
    if (!device) return { ok: false, reason: 'missing' };
    const nonce = `${Date.now().toString(36)}-${flow.generation}`;
    const items = flow.activePorts.map((port) => {
      const settings = portDraft(port);
      return { deviceId: flow.deviceId, port, pixels: clampPixels(settings.pixels), reversed: Boolean(settings.reversed), mode: 'end', generation: flow.generation, nonce: `${nonce}-${port}` };
    });
    const deviceTarget = calibrationTarget(items[0]);
    const topologyTarget = {
      ...deviceTarget,
      id: `commission-${flow.deviceId}-topology`,
      port: 0,
      outputPort: 0,
      portCount: flow.activePorts.length,
      portMask: portMask(),
      pixels: undefined,
      physical: undefined,
      physicalLeds: undefined,
      calibration: 'PORT_TOPOLOGY'
    };
    const response = await api('/api/command', {
      action: 'config',
      state: {
        receiverType: 'SPI',
        portCount: flow.activePorts.length,
        portMask: portMask(),
        calibration: 'END_PIXEL_CONFIRMED',
        calibrationNonce: nonce
      },
      targets: [topologyTarget, ...items.map((item) => ({ ...calibrationTarget(item), calibration: 'END_PIXEL_CONFIRMED' }))]
    });
    const results = response?.results || [];
    /* A receiver cannot measure its attached strip. Success is delivery/ACK,
       never equality with a self-reported pixel value. */
    const exactAckRequired = spiPortCapacity(device) === 4;
    const acknowledged = [topologyTarget, ...items].every((_, index) => {
      const result = results[index] || {};
      return exactAckRequired
        ? Boolean(result.confirmed)
        : Boolean(result.confirmed || result.accepted || result.delivered || result.gatewayAck || result.online);
    });
    if (!acknowledged && (exactAckRequired || reachable(device))) {
      return { ok: false, reason: results.find((result) => result?.detail)?.detail || 'no_exact_port_ack' };
    }
    return { ok: true, pending: !acknowledged, items };
  }

  function storeCommittedGeometry(outcome) {
    const device = spiDevice();
    if (!device || !Array.isArray(outcome?.items) || !outcome.items.length) return false;
    device.portCapacity = spiPortCapacity(device);
    device.portCount = flow.activePorts.length;
    device.activePortCount = flow.activePorts.length;
    device.portMask = portMask();
    device.spiPorts = { ...(device.spiPorts || {}) };
    outcome.items.forEach((item) => {
      device.spiPorts[item.port] = { pixels: item.pixels, reversed: item.reversed, physicalReverse: item.reversed, configuredAt: Date.now() };
    });
    device.pixels = outcome.items[0].pixels;
    device.reversed = outcome.items[0].reversed;
    device.physicalReverse = outcome.items[0].reversed;
    device.configurationSource = 'visual-end-pixel';
    device.configurationStoredAt = Date.now();
    if (outcome.pending) device.pendingGeometry = { ports: clone(device.spiPorts), portMask: device.portMask, source: 'visual-end-pixel', requestedAt: Date.now() };
    else delete device.pendingGeometry;
    save();
    return true;
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

  function firstCompatibleGroup(selectedZone) {
    return compatibleGroups(selectedZone, spiDevice())[0] || null;
  }

  function ensurePortDestination(port) {
    const destination = portDraft(port);
    const directZone = (install.zones || []).find((item) => item.id === flow.directZoneId);
    const selectedZone = (install.zones || []).find((item) => item.id === destination.zoneId) || directZone || install.zones?.[0];
    const directGroup = selectedZone?.groups?.find((item) => item.id === flow.directGroupId);
    const selectedGroup = selectedZone?.groups?.find((item) => item.id === destination.groupId) || directGroup || firstCompatibleGroup(selectedZone);
    destination.zoneId = selectedZone?.id || '';
    destination.groupId = selectedGroup?.id || '';
    return destination;
  }

  function destinationSelects(port, merged = false) {
    const destination = ensurePortDestination(port);
    const selectedZone = (install.zones || []).find((item) => item.id === destination.zoneId);
    const groups = compatibleGroups(selectedZone, spiDevice());
    if (destination.groupId && !groups.some((item) => item.id === destination.groupId)) destination.groupId = groups[0]?.id || '';
    const prefix = merged ? 'merge' : `p${port}`;
    return `<div class="v207-destination-fields"><label><small>${tx('ZONE', 'ZONE', 'ZONE', 'ZONE')}</small><select class="field" onchange="v207SetPortZone(${port},this.value,${merged})">${(install.zones || []).map((item) => `<option value="${safe(item.id)}" ${item.id === destination.zoneId ? 'selected' : ''}>${safe(item.name)}</option>`).join('')}</select></label><label><small>${tx('GROEP', 'GROUP', 'GROUPE', 'GRUPPE')}</small><select class="field" onchange="v207SetPortGroup(${port},this.value,${merged})">${groups.map((item) => `<option value="${safe(item.id)}" ${item.id === destination.groupId ? 'selected' : ''}>${safe(item.name)}</option>`).join('')}</select></label></div><div class="v207-new-group"><input id="v207NewGroup-${prefix}" class="field" maxlength="60" placeholder="${tx('Nieuwe groepnaam', 'New group name', 'Nom du nouveau groupe', 'Name der neuen Gruppe')}"><button class="button soft" onclick="v207CreatePortGroup(${port},'${prefix}',${merged})">＋ ${tx('Nieuwe groep', 'New group', 'Nouveau groupe', 'Neue Gruppe')}</button></div>`;
  }

  function renderPortAssignments() {
    flow.phase = 'assign';
    pairDraft.assignmentMode ||= flow.directZoneId && flow.directGroupId ? 'merge' : 'merge';
    const merged = pairDraft.assignmentMode === 'merge';
    if (merged) {
      const lead = ensurePortDestination(1);
      flow.activePorts.forEach((port) => Object.assign(portDraft(port), { zoneId: lead.zoneId, groupId: lead.groupId }));
    } else flow.activePorts.forEach(ensurePortDestination);
    modal(`<section class="v20-commission v207-assignment" data-phase="assign">
      ${stepDots('destination')}
      <header><span><div class="eyebrow">${tx(`STAP ${stepNumber('destination')} · INDELEN`, `STEP ${stepNumber('destination')} · ASSIGN`, `ÉTAPE ${stepNumber('destination')} · AFFECTER`, `SCHRITT ${stepNumber('destination')} · ZUORDNEN`)}</div><h1>${tx('Hoe wil je de uitgangen gebruiken?', 'How do you want to use the outputs?', 'Comment voulez-vous utiliser les sorties ?', 'Wie möchtest du die Ausgänge verwenden?')}</h1><p>${tx('Samen vormt één lange LED Line. Apart laat iedere poort naar een eigen groep gaan.', 'Together creates one long LED Line. Separate lets every port go to its own group.', 'Ensemble crée une longue LED Line. Séparé affecte chaque port à son propre groupe.', 'Zusammen ergibt eine lange LED Line. Getrennt ordnet jeden Port einer eigenen Gruppe zu.')}</p></span></header>
      <div class="v207-arrangement" role="radiogroup"><button class="${merged ? 'on' : ''}" onclick="v207SetAssignmentMode('merge')">${outputBoard(flow.activePorts.length)}<span><b>${tx('Samenvoegen', 'Merge together', 'Fusionner', 'Zusammenfügen')}</b><small>${tx('Poort 1 → 2 → 3 → 4 als één doorlopende LED Line', 'Port 1 → 2 → 3 → 4 as one continuous LED Line', 'Ports 1 → 2 → 3 → 4 en une LED Line continue', 'Port 1 → 2 → 3 → 4 als eine fortlaufende LED Line')}</small></span><i>${merged ? '✓' : ''}</i></button><button class="${merged ? '' : 'on'}" onclick="v207SetAssignmentMode('separate')"><div class="v207-separate-visual">${flow.activePorts.map((port) => `<span><b>P${port}</b><i></i><em>G${port}</em></span>`).join('')}</div><span><b>${tx('Apart indelen', 'Assign separately', 'Affecter séparément', 'Getrennt zuordnen')}</b><small>${tx('Iedere uitgang kan naar een andere zone of groep', 'Every output can go to a different zone or group', 'Chaque sortie peut aller dans une zone ou un groupe différent', 'Jeder Ausgang kann in eine andere Zone oder Gruppe')}</small></span><i>${merged ? '' : '✓'}</i></button></div>
      ${merged ? `<section class="card v207-port-destination"><div class="v207-port-heading"><b>${flow.activePorts.map((port) => `P${port}`).join(' + ')}</b><span><strong>${tx('Eén lange LED Line', 'One long LED Line', 'Une longue LED Line', 'Eine lange LED Line')}</strong><small>${flow.activePorts.reduce((sum, port) => sum + portDraft(port).pixels, 0)} pixels</small></span></div>${destinationSelects(1, true)}</section>` : `<div class="v207-port-destinations">${flow.activePorts.map((port) => { const item = portDraft(port); return `<section class="card v207-port-destination"><div class="v207-port-heading"><b>P${port}</b><span><strong>LED Line ${port}</strong><small>${item.pixels} px · ${item.reversed ? tx('receiver rechts', 'receiver right', 'récepteur à droite', 'Receiver rechts') : tx('receiver links', 'receiver left', 'récepteur à gauche', 'Receiver links')}</small></span></div>${destinationSelects(port, false)}</section>`; }).join('')}</div>`}
      <footer><button class="button soft" onclick="v207BackToLastSide()">← ${tx('Aansluitkant', 'Connection side', 'Côté de connexion', 'Anschlussseite')}</button><button class="button" onclick="v207ReviewAssignments()">${tx('Controleren', 'Review', 'Vérifier', 'Prüfen')} →</button></footer>
    </section>`);
  }

  function renderFourPortReview() {
    const destinations = flow.activePorts.map((port) => {
      const item = ensurePortDestination(port);
      const selectedZone = install.zones.find((entry) => entry.id === item.zoneId);
      const selectedGroup = selectedZone?.groups?.find((entry) => entry.id === item.groupId);
      return { port, item, selectedZone, selectedGroup };
    });
    if (destinations.some(({ selectedZone, selectedGroup }) => !selectedZone || !selectedGroup)) return toast(tx('Kies voor iedere uitgang een zone en groep', 'Choose a zone and group for every output', 'Choisissez une zone et un groupe pour chaque sortie', 'Wähle für jeden Ausgang Zone und Gruppe'));
    flow.phase = 'review';
    modal(`<section class="v20-commission v20-review v207-review" data-phase="review">${stepDots('review')}<header><span><div class="eyebrow">${tx(`STAP ${stepNumber('review')} · CONTROLEREN`, `STEP ${stepNumber('review')} · REVIEW`, `ÉTAPE ${stepNumber('review')} · VÉRIFIER`, `SCHRITT ${stepNumber('review')} · PRÜFEN`)}</div><h1>${tx('Klaar om toe te voegen', 'Ready to add', 'Prêt à ajouter', 'Bereit zum Hinzufügen')}</h1><p>1 receiver → ${flow.activePorts.length} LED Line${flow.activePorts.length === 1 ? '' : 's'}</p></span></header><div class="v207-review-board">${outputBoard(flow.activePorts.length)}</div><div class="v207-review-ports">${destinations.map(({ port, item, selectedZone, selectedGroup }) => `<article><b>P${port}</b><span><strong>${item.pixels} px · ${item.reversed ? tx('rechts', 'right', 'droite', 'rechts') : tx('links', 'left', 'gauche', 'links')}</strong><small>${safe(selectedZone.name)} → ${safe(selectedGroup.name)}</small></span><i>✓</i></article>`).join('')}</div><footer><button class="button soft" onclick="v207BackToAssignments()">← ${tx('Indelen', 'Assign', 'Affecter', 'Zuordnen')}</button><button class="button" onclick="v20CommitReceiver()">＋ ${tx('Receiver toevoegen', 'Add receiver', 'Ajouter le récepteur', 'Receiver hinzufügen')}</button></footer></section>`);
  }

  function assignPorts() {
    const device = spiDevice();
    if (!device) return;
    // Resolve every destination before touching saved assignments. Reusing the
    // physical port's line ID also keeps scene references and per-line colours.
    const planned = flow.activePorts.map((port) => {
      const item = ensurePortDestination(port);
      const selectedZone = install.zones.find(entry => entry.id === item.zoneId);
      const selectedGroup = selectedZone?.groups?.find(entry => entry.id === item.groupId);
      if (!selectedZone || !selectedGroup || !compatibleGroups(selectedZone, device).includes(selectedGroup)) throw new Error('invalid_port_destination');
      const previous = storedPortAssignment(device.id, port);
      return { port, item, selectedZone, selectedGroup, previous,
        lineState: previous?.selectedGroup.parallelLineStates?.[previous.line.id] };
    });
    const affected = new Set();
    (db.installations || []).forEach((location) => (location.zones || []).forEach((selectedZone) => (selectedZone.groups || []).forEach((selectedGroup) => {
      const before = selectedGroup.receivers?.length || 0;
      selectedGroup.receivers = (selectedGroup.receivers || []).filter((line) => line.deviceId !== device.id);
      if (before !== selectedGroup.receivers.length) affected.add(selectedGroup);
      if (!selectedGroup.receivers.length && selectedGroup.receiverType === 'SPI') selectedGroup.receiverType = null;
    })));
    planned.sort((a, b) => (a.previous?.selectedGroup === a.selectedGroup ? a.previous.index : Infinity) - (b.previous?.selectedGroup === b.selectedGroup ? b.previous.index : Infinity));
    planned.forEach(({ port, item, selectedZone, selectedGroup, previous, lineState }) => {
      selectedGroup.receiverType = 'SPI';
      selectedGroup.receivers ||= [];
      const line = { ...previous?.line, id: previous?.line.id || `r-${device.id}-p${port}`, deviceId: device.id,
        name: previous?.line.name || `${device.name} · ${tx('Poort', 'Port', 'Port', 'Port')} ${port}`,
        rid: device.rid, physicalRid: device.rid, hardwareId: device.hardwareId, receiverType: 'SPI', port,
        pixels: item.pixels, reversed: Boolean(item.reversed) };
      if (previous?.selectedGroup === selectedGroup) selectedGroup.receivers.splice(Math.min(previous.index, selectedGroup.receivers.length), 0, line);
      else selectedGroup.receivers.push(line);
      if (lineState && previous.selectedGroup !== selectedGroup) {
        selectedGroup.parallelLineStates ||= {};
        selectedGroup.parallelLineStates[line.id] = clone(lineState);
      }
      if (pairDraft.assignmentMode === 'merge') selectedGroup.layout = 'line';
      if (!selectedZone.mainReceiverId) selectedZone.mainReceiverId = device.id;
      affected.add(selectedGroup);
    });
    affected.forEach(selectedGroup => {
      const activeIds = new Set(selectedGroup.receivers.map(line => line.id));
      for (const key of ['v21SelectedLineIds', 'parallelSelectedIds']) if (Array.isArray(selectedGroup[key])) selectedGroup[key] = selectedGroup[key].filter(id => activeIds.has(id));
      if (selectedGroup.parallelLineStates) Object.keys(selectedGroup.parallelLineStates).forEach(id => { if (!activeIds.has(id)) delete selectedGroup.parallelLineStates[id]; });
    });
    ensureZoneMainReceivers();
    const first = ensurePortDestination(flow.activePorts[0]);
    zone = install.zones.find((entry) => entry.id === first.zoneId) || zone;
    group = zone?.groups?.find((entry) => entry.id === first.groupId) || group;
    install.activeZoneId = zone?.id || install.activeZoneId;
    install.activeGroupId = group?.id || install.activeGroupId;
    db.activeGroupByZone ||= {};
    if (zone && group) db.activeGroupByZone[zone.id] = group.id;
    save('queued');
    affected.forEach((selectedGroup) => { if (selectedGroup.receivers?.length && typeof window.queueLive === 'function') Promise.resolve(queueLive(selectedGroup)).catch(() => {}); });
    const deviceName = typeof window.customerDeviceName === 'function' ? customerDeviceName(device) : device.name;
    stopFlow(false);
    modal(`<section class="v20-complete v207-complete"><div class="v20-success">✓</div><div class="eyebrow">${tx('KLAAR', 'READY', 'PRÊT', 'FERTIG')}</div><h1>${safe(deviceName)} ${tx('is toegevoegd', 'has been added', 'a été ajouté', 'wurde hinzugefügt')}</h1><div class="v207-output-summary"><b>1 receiver</b><em>→</em><b>${flow.activePorts.length} LED Line${flow.activePorts.length === 1 ? '' : 's'}</b></div><button class="button" onclick="v20OpenCompletedGroup('${safe(zone?.id || '')}','${safe(group?.id || '')}')">${tx('Verlichting openen', 'Open lighting', 'Ouvrir l’éclairage', 'Beleuchtung öffnen')}</button></section>`);
  }

  async function needsInstallationSecurity(device) {
    const generation = flow.generation;
    flow.securityBackendReady = false;
    flow.securityBackendError = '';
    flow.securityDisposition = 'unavailable';
    flow.pinAuthSupported = false;
    flow.securityComplete = false;
    try {
      // The provider reads the current main receiver, also while an extra
      // receiver is being assigned. A cached app flag cannot prove PINSET.
      const status = await commissionSecurityApi()?.getStatus?.(true);
      if (!flow.active || flow.generation !== generation || flow.deviceId !== device.id) return true;
      flow.securityBackendError = String(status?.error || '');
      if (!status?.available) return true;
      flow.pinAuthSupported = status.pinAuthSupported === true;
      const owned = status.owned === true;
      const ownerMismatch = status.ownerMatches === false && owned;
      const trusted = status.trusted === true || status.ownerMatches === true;
      if (status.restoreRequired === true || ownerMismatch || status.configured === true && !trusted) {
        flow.securityDisposition = 'restore-required';
        return true;
      }
      if (status.configured === true && trusted) {
        const main = (db.devices || []).find(item => String(item.rid || '').toUpperCase() === String(status.rid || '').toUpperCase());
        markInstallationProtected(main || device);
        flow.securityDisposition = 'protected';
        return false;
      }
      if (status.configured !== false || status.canConfigure === false || owned && !trusted && status.canConfigure !== true) {
        flow.securityDisposition = owned ? 'ownership-unknown' : 'unavailable';
        return true;
      }
      flow.securityBackendReady = true;
      flow.securityDisposition = 'needs-pin';
      // Clear stale completion only after an available main receiver reports
      // that this installation has no PIN. Offline/foreign replies never do.
      if (install?.security?.recoveryConfigured) {
        install.security.recoveryConfigured = false;
        save('queued');
      }
    } catch (error) {
      if (flow.active && flow.generation === generation && flow.deviceId === device.id) {
        flow.securityBackendError = String(error?.message || error || '');
      }
    }
    return true;
  }

  window.v20RetryCommissionSecurity = async function v20RetryCommissionSecurity() {
    if (!flow.active || flow.phase !== 'security') return;
    const device = spiDevice();
    if (!device) return stopFlow();
    const generation = flow.generation;
    modal(`<section class="v20-commission"><div class="v20-pair-loading"><i></i><b>${tx('Veilige opslag controleren…', 'Checking secure storage…', 'Vérification du stockage sécurisé…', 'Sicherer Speicher wird geprüft…')}</b></div></section>`);
    const stillNeeded = await needsInstallationSecurity(device);
    if (!flow.active || flow.generation !== generation || flow.deviceId !== device.id) return;
    flow.needsSecurity = stillNeeded;
    if (!stillNeeded) return continueAfterSecurity();
    renderSecurity();
  };

  window.v20RestoreCommissionInstallation = function v20RestoreCommissionInstallation() {
    if (!flow.active || flow.phase !== 'security' || flow.securityDisposition !== 'restore-required') return;
    const nativeProvider = window.AluvisionNativeConnection?.securityProvider;
    if (nativeProvider) {
      if (!flow.pinAuthSupported || typeof nativeProvider.restoreInstallation !== 'function') return;
      flow.phase = 'security-restore';
      modal(`<section class="v20-commission v20-security-step" data-phase="security-restore">
        ${stepDots('security')}
        <header><span><h1>${tx('Toegang herstellen', 'Restore access', 'Rétablir l’accès', 'Zugang wiederherstellen')}</h1><p>${tx('Gebruik de bestaande pincode van deze installatie.', 'Use this installation’s existing PIN.', 'Utilisez le code PIN existant de cette installation.', 'Verwende die bestehende PIN dieser Installation.')}</p></span></header>
        <section class="v20-live-card v20-code-card"><label><b>${tx('Pincode', 'PIN', 'Code PIN', 'PIN')}</b><input id="v20RestoreCommissionCode" class="field v20-recovery-input" type="password" inputmode="numeric" autocomplete="current-password" maxlength="12" placeholder="8–12 ${tx('cijfers', 'digits', 'chiffres', 'Ziffern')}"></label><p>${tx('Dit herstelt toegang tot de receivers, niet je indelingen of scènes.', 'This restores access to the receivers, not layouts or scenes.', 'Ceci rétablit l’accès aux récepteurs, pas les dispositions ni les scènes.', 'Dies stellt den Zugang zu den Receivern wieder her, nicht Layouts oder Szenen.')}</p></section>
        <p id="v20CommissionRestoreError" class="sub" role="alert" hidden style="margin:0;color:var(--red);font-size:12px;line-height:1.4"></p>
        <footer><button class="button soft" onclick="v20CancelCommission()">${tx('Annuleren', 'Cancel', 'Annuler', 'Abbrechen')}</button><button class="button" onclick="v20SubmitCommissionRestore()">${tx('Toegang herstellen', 'Restore access', 'Rétablir l’accès', 'Zugang wiederherstellen')}</button></footer>
      </section>`);
      return;
    }
    const restore = window.AluvisionAccountlessRecovery?.openRestore;
    if (typeof restore !== 'function') return;
    stopFlow(false);
    return restore('code');
  };

  window.v20SubmitCommissionRestore = async function v20SubmitCommissionRestore() {
    const provider = window.AluvisionNativeConnection?.securityProvider;
    if (!flow.active || flow.phase !== 'security-restore' || !flow.pinAuthSupported || typeof provider?.restoreInstallation !== 'function') return;
    const code = document.getElementById('v20RestoreCommissionCode')?.value || '';
    if (!/^\d{8,12}$/.test(code)) return toast(tx('Vul je pincode van 8 tot 12 cijfers in', 'Enter your 8 to 12 digit PIN', 'Saisissez votre code PIN de 8 à 12 chiffres', 'Gib deine 8- bis 12-stellige PIN ein'));
    const generation = flow.generation;
    const device = spiDevice();
    if (!device) return stopFlow();
    const button = document.querySelector('.v20-security-step footer .button:last-child');
    const errorNotice = document.getElementById('v20CommissionRestoreError');
    if (errorNotice) { errorNotice.hidden = true; errorNotice.textContent = ''; }
    if (button) button.disabled = true;
    flow.phase = 'security-restoring';
    try {
      const outcome = await provider.restoreInstallation(code);
      if (!flow.active || flow.generation !== generation || flow.deviceId !== device.id) return;
      if (!outcome?.ok || outcome.restored !== true) throw new Error('restore-not-confirmed');
      const stillNeeded = await needsInstallationSecurity(device);
      if (!flow.active || flow.generation !== generation || flow.deviceId !== device.id) return;
      flow.needsSecurity = stillNeeded;
      if (stillNeeded) return renderSecurity();
      toast(tx('Toegang hersteld', 'Access restored', 'Accès rétabli', 'Zugang wiederhergestellt'));
      return continueAfterSecurity();
    } catch (error) {
      if (!flow.active || flow.generation !== generation || flow.deviceId !== device.id) return;
      flow.phase = 'security-restore';
      if (button) button.disabled = false;
      // Only a machine-readable allowlist reaches the customer. Never render
      // backend messages, which can contain transport details or credentials.
      const code = String(error?.code || '');
      const retryMs = Number(error?.retryAfterMs);
      const seconds = Number.isFinite(retryMs) && retryMs > 0 ? Math.ceil(Math.min(3600000, retryMs) / 1000) : 0;
      const message = code === 'INVALID_PIN'
        ? tx('Onjuiste pincode. Probeer opnieuw.', 'Incorrect PIN. Please try again.', 'Code PIN incorrect. Réessayez.', 'Falsche PIN. Versuche es erneut.')
        : code === 'PIN_LOCKED' || code === 'PIN_AUTH_BUSY'
          ? seconds ? tx(`Wacht ${seconds} seconden en probeer opnieuw.`, `Wait ${seconds} seconds, then try again.`, `Patientez ${seconds} secondes, puis réessayez.`, `Warte ${seconds} Sekunden und versuche es erneut.`)
            : tx('Wacht even en probeer opnieuw.', 'Please wait a moment and try again.', 'Patientez un instant et réessayez.', 'Warte einen Moment und versuche es erneut.')
          : code === 'PIN_CHALLENGE_EXPIRED'
            ? tx('De pincodecontrole is verlopen. Probeer opnieuw.', 'The PIN check expired. Please try again.', 'La vérification du PIN a expiré. Réessayez.', 'Die PIN-Prüfung ist abgelaufen. Versuche es erneut.')
            : code === 'PIN_UNSUPPORTED'
              ? tx('Herstel via pincode is hier nog niet beschikbaar.', 'PIN recovery is not available here yet.', 'La récupération par PIN n’est pas encore disponible ici.', 'PIN-Wiederherstellung ist hier noch nicht verfügbar.')
              : tx('Toegang niet hersteld. Controleer de pincode en verbinding.', 'Access was not restored. Check the PIN and connection.', 'Accès non rétabli. Vérifiez le code PIN et la connexion.', 'Zugang nicht wiederhergestellt. Prüfe PIN und Verbindung.');
      if (errorNotice?.isConnected) { errorNotice.textContent = message; errorNotice.hidden = false; }
      else toast(message);
    }
  };

  // Native Add can discover an already-owned main before it has an app record.
  // Check access on a temporary snapshot; never insert an unverified receiver
  // or retry MESH_MAIN under another owner's credentials to show this screen.
  window.v20CheckReceiverSecurity = async function v20CheckReceiverSecurity(device, onConfirmed) {
    if (!device?.id || typeof onConfirmed !== 'function') return false;
    stopFlow(true);
    flow.active = true;
    flow.phase = 'preparing';
    flow.deviceId = device.id;
    flow.deviceSnapshot = { ...device };
    flow.receiverType = isRgbw(device) ? 'RGBW' : 'SPI';
    flow.generation += 1;
    const generation = flow.generation;
    flow.resumeAfterSecurity = onConfirmed;
    flow.needsSecurity = true;
    modal(`<section class="v20-commission"><div class="v20-pair-loading"><i></i><b>${tx('Toegang controleren…', 'Checking access…', 'Vérification de l’accès…', 'Zugang wird geprüft…')}</b></div></section>`);
    const needsSecurity = await needsInstallationSecurity(device);
    if (!flow.active || flow.generation !== generation || flow.deviceId !== device.id) return false;
    flow.needsSecurity = needsSecurity;
    if (needsSecurity) renderSecurity();
    else await continueAfterSecurity();
    return true;
  };

  async function beginSpiFlow(id, directZoneId = '', directGroupId = '') {
    const device = spiDevice(id);
    if (!device) return;
    flow.active = true;
    flow.deviceSnapshot = device;
    flow.phase = 'preparing';
    flow.deviceId = id;
    flow.directZoneId = directZoneId || '';
    flow.directGroupId = directGroupId || '';
    flow.receiverType = 'SPI';
    flow.pixelPortIndex = 0;
    flow.sidePortIndex = 0;
    flow.needsSecurity = false;
    flow.securityComplete = false;
    flow.securityBackendReady = false;
    flow.securityBackendError = '';
    flow.recoveryKey = '';
    flow.resumePairing = null;
    flow.resumeAfterSecurity = null;
    flow.generation += 1;
    const generation = flow.generation;
    flow.configurationStored = false;
    flow.lastAck = false;
    flow.consecutiveCalibrationMisses = 0;
    flow.setupSessionActive = false;
    flow.setupSessionSupported = true;
    flow.pendingOutputCount = 0;
    flow.visualOnly = Boolean(device.visualFixture);
    const storedCount = Math.min(spiPortCapacity(device), clampPortCount(device.activePortCount || (device.portMask ? Math.max(1, [1, 2, 3, 4].filter((port) => Number(device.portMask) & (1 << (port - 1))).length) : 1)));
    flow.activePorts = activePortNumbers(storedCount);
    pairDraft = {
      deviceId: id,
      receiverType: 'SPI',
      portCount: storedCount,
      ports: {},
      zoneId: directZoneId || '',
      groupId: directGroupId || '',
      presetGroup: Boolean(directZoneId && directGroupId)
    };
    flow.activePorts.forEach((port) => {
      const stored = device.pendingGeometry?.ports?.[port] || device.spiPorts?.[port] || device.spiPorts?.[String(port)] || {};
      const assignment = storedPortAssignment(device.id, port);
      pairDraft.ports[port] = {
        pixels: clampPixels(stored.pixels ?? (port === 1 ? device.pendingGeometry?.pixels ?? device.pixels : 25), 25),
        reversed: Boolean(stored.reversed ?? stored.physicalReverse ?? (port === 1 ? device.pendingGeometry?.reversed ?? device.reversed : false)),
        zoneId: directZoneId || assignment?.selectedZone.id || '', groupId: directGroupId || assignment?.selectedGroup.id || ''
      };
    });
    const destinations = new Set(flow.activePorts.map(port => `${pairDraft.ports[port].zoneId}:${pairDraft.ports[port].groupId}`).filter(value => value !== ':'));
    pairDraft.assignmentMode = destinations.size > 1 ? 'separate' : 'merge';
    modal(`<section class="v20-commission"><div class="v20-pair-loading"><i></i><b>${tx('Receiver voorbereiden…', 'Preparing receiver…', 'Préparation du récepteur…', 'Receiver wird vorbereitet…')}</b></div></section>`);
    const needsSecurity = await needsInstallationSecurity(device);
    if (!flow.active || flow.generation !== generation || flow.deviceId !== id) return;
    flow.needsSecurity = needsSecurity;
    if (flow.needsSecurity) renderSecurity();
    else {
      beginSetupSession();
      renderOutputs();
    }
  }

  async function beginRgbwFlow(id, directZoneId = '', directGroupId = '') {
    const device = spiDevice(id);
    if (!device) return;
    flow.deviceSnapshot = device;
    const resume = () => directZoneId && directGroupId
      ? base.startPairingForGroup?.call(window, id, directZoneId, directGroupId)
      : base.startPairing?.call(window, id);
    flow.active = true;
    flow.phase = 'preparing';
    flow.deviceId = id;
    flow.directZoneId = directZoneId || '';
    flow.directGroupId = directGroupId || '';
    flow.receiverType = 'RGBW';
    flow.securityBackendReady = false;
    flow.securityBackendError = '';
    flow.securityComplete = false;
    flow.resumeAfterSecurity = null;
    flow.generation += 1;
    const generation = flow.generation;
    modal(`<section class="v20-commission"><div class="v20-pair-loading"><i></i><b>${tx('Receiver voorbereiden…', 'Preparing receiver…', 'Préparation du récepteur…', 'Receiver wird vorbereitet…')}</b></div></section>`);
    const needsSecurity = await needsInstallationSecurity(device);
    if (!flow.active || flow.generation !== generation || flow.deviceId !== id) return;
    flow.needsSecurity = needsSecurity;
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
    if (flow.active && clear && flow.receiverType === 'SPI') {
      finishSetupSession(true);
      if (calibrationPhase()) clearCalibration(true);
    }
    flow.active = false;
    flow.phase = 'idle';
    flow.pending = null;
    flow.inFlight = false;
    flow.consecutiveCalibrationMisses = 0;
    clearTimeout(flow.timer);
    clearTimeout(flow.leaseTimer);
    clearTimeout(flow.setupTimer);
    flow.leaseTimer = 0;
    flow.setupTimer = 0;
    flow.setupSessionActive = false;
    flow.visualOnly = false;
    flow.pendingOutputCount = 0;
    flow.recoveryKey = '';
    flow.resumePairing = null;
    flow.resumeAfterSecurity = null;
    flow.deviceSnapshot = null;
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
    if (!flow.active || flow.phase !== 'security' || !flow.securityBackendReady || flow.securityDisposition !== 'needs-pin') return;
    const generation = flow.generation;
    const deviceId = flow.deviceId;
    const api = commissionSecurityApi();
    if (!api?.setupInstallation) {
      toast(tx('Beveiligingsmodule is nog niet geladen', 'Security module is not loaded yet', 'Le module de sécurité n’est pas encore chargé', 'Sicherheitsmodul ist noch nicht geladen'));
      return;
    }
    const button = document.querySelector('.v20-security-step footer .button:last-child');
    if (button) button.disabled = true;
    flow.phase = 'security-saving';
    try {
      const outcome = await api.setupInstallation(code);
      if (!flow.active || flow.generation !== generation || flow.deviceId !== deviceId) return;
      if (outcome.physicalRequired) {
        const device = spiDevice();
        if (!device) throw new Error(tx('Receiver niet meer beschikbaar', 'Receiver is no longer available', 'Le récepteur n’est plus disponible', 'Receiver ist nicht mehr verfügbar'));
        markInstallationSecurityPending(device);
        flow.securityBackendReady = false;
        flow.securityDisposition = 'unavailable';
        return renderSecurity();
      }
      if (!outcome.ok || !outcome.recoveryKey) throw new Error(tx('Beveiliging werd niet bevestigd', 'Security was not confirmed', 'La sécurité n’a pas été confirmée', 'Sicherheit wurde nicht bestätigt'));
      const device = spiDevice();
      if (!device) throw new Error(tx('Receiver niet meer beschikbaar', 'Receiver is no longer available', 'Le récepteur n’est plus disponible', 'Receiver ist nicht mehr verfügbar'));
      markInstallationProtected(device);
      renderRecoveryKey(outcome.recoveryKey);
    } catch (error) {
      if (!flow.active || flow.generation !== generation || flow.deviceId !== deviceId) return;
      flow.phase = 'security';
      if (button) button.disabled = false;
      toast(tx('Pincode niet bewaard. Controleer de verbinding en probeer opnieuw.', 'PIN was not saved. Check the connection and try again.', 'Code PIN non enregistré. Vérifiez la connexion et réessayez.', 'PIN nicht gespeichert. Prüfe die Verbindung und versuche es erneut.'));
    }
  }

  window.v20CreateInstallationProtection = function v20CreateInstallationProtection() {
    if (!flow.active || flow.phase !== 'security' || !flow.securityBackendReady || flow.securityDisposition !== 'needs-pin') return;
    const first = document.getElementById('v20CommissionCode')?.value || '';
    const second = document.getElementById('v20CommissionCodeAgain')?.value || '';
    const normalized = commissionSecurityApi()?.normalizeUserCode?.(first) || '';
    if (!normalized || first !== second) {
      return toast(tx('Gebruik twee keer dezelfde code van 8 tot 12 cijfers', 'Enter the same 8 to 12 digit code twice', 'Saisissez deux fois le même code de 8 à 12 chiffres', 'Gib zweimal denselben 8- bis 12-stelligen Code ein'));
    }
    return submitInstallationProtection(normalized);
  };

  window.v20CopyCommissionRecoveryKey = async function v20CopyCommissionRecoveryKey(value) {
    const api = commissionSecurityApi();
    if (typeof api?.copyCode === 'function') return api.copyCode(value);
    try {
      await navigator.clipboard.writeText(String(value || ''));
      toast(tx('Recovery Key gekopieerd', 'Recovery Key copied', 'Recovery Key copiée', 'Recovery Key kopiert'));
    } catch (_) {
      toast(String(value || ''));
    }
  };

  window.v20ContinueWithPendingSecurity = function v20ContinueWithPendingSecurity() {
    if (!flow.active || flow.phase !== 'security-pending') return;
    flow.phase = 'security';
    return window.v20RetryCommissionSecurity();
  };

  window.v20ContinueAfterRecoveryKey = function v20ContinueAfterRecoveryKey() {
    if (!flow.active || flow.phase !== 'recovery-key') return;
    continueAfterSecurity();
  };

  window.v20SetPixels = function v20SetPixels(value) {
    if (!flow.active || flow.phase !== 'length') return;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    const settings = portDraft(currentCalibrationPort());
    const pixels = clampPixels(parsed, settings.pixels);
    settings.pixels = pixels;
    const number = document.getElementById('v20PixelNumber');
    const range = document.getElementById('v20PixelRange');
    const readout = document.getElementById('v20PixelReadout');
    if (number && document.activeElement !== number) number.value = String(pixels);
    if (range) range.value = String(pixels);
    if (readout) readout.textContent = pixelLabel(pixels);
    status(tx(`${pixelLabel(pixels)} geselecteerd · LED Line bijwerken…`, `${pixelLabel(pixels)} selected · updating LED Line…`, `${pixelLabel(pixels)} sélectionnés · mise à jour…`, `${pixelLabel(pixels)} gewählt · LED Line wird aktualisiert…`));
    scheduleCalibration(false, 'length');
  };

  window.v20AdjustPixels = (delta) => window.v20SetPixels(clampPixels(portDraft(currentCalibrationPort()).pixels, 25) + Number(delta || 0));
  function applyOutputCount(value) {
    const next = Math.min(spiPortCapacity(), clampPortCount(value));
    pairDraft.portCount = next;
    flow.activePorts = activePortNumbers(next);
    flow.activePorts.forEach(portDraft);
    flow.pendingOutputCount = 0;
    if (flow.setupSessionActive) sendSetupSession('setup_begin');
    renderOutputs();
  }

  window.v207SetOutputCount = function v207SetOutputCount(value) {
    if (!flow.active || flow.phase !== 'outputs') return;
    const next = Math.min(spiPortCapacity(), clampPortCount(value));
    if (next >= pairDraft.portCount) return applyOutputCount(next);
    const assignments = window.AluvisionSpiFourPort?.assignmentsFor;
    const removed = assignments
      ? [1, 2, 3, 4].filter((port) => port > next && assignments(flow.deviceId, port).length)
      : [];
    if (!removed.length) return applyOutputCount(next);
    flow.pendingOutputCount = next;
    modal(`<section class="v20-commission v207-port-warning"><div class="v207-warning-icon">!</div><div class="eyebrow">${tx('CONTROLE', 'CHECK', 'VÉRIFICATION', 'PRÜFUNG')}</div><h1>${tx('Uitgangen uitschakelen?', 'Disable outputs?', 'Désactiver des sorties ?', 'Ausgänge deaktivieren?')}</h1><p>${tx(`Poort ${removed.join(', ')} zit al in een groep. Alleen deze LED Line${removed.length === 1 ? '' : 's'} wordt verwijderd; de andere uitgangen blijven bewaard.`, `Port ${removed.join(', ')} is already assigned. Only ${removed.length === 1 ? 'this LED Line is' : 'these LED Lines are'} removed; the other outputs stay intact.`, `Le port ${removed.join(', ')} est déjà affecté. Seules ces LED Lines sont retirées ; les autres sorties restent intactes.`, `Port ${removed.join(', ')} ist bereits zugeordnet. Nur diese LED Line wird entfernt; die übrigen Ausgänge bleiben erhalten.`)}</p>${outputBoard(next)}<footer><button class="button soft" onclick="v207CancelOutputCount()">${tx('Behouden', 'Keep', 'Conserver', 'Behalten')}</button><button class="button red" onclick="v207ConfirmOutputCount()">${tx('Uitschakelen', 'Disable', 'Désactiver', 'Deaktivieren')}</button></footer></section>`);
  };
  window.v207CancelOutputCount = function v207CancelOutputCount() { if (flow.active) { flow.pendingOutputCount = 0; renderOutputs(); } };
  window.v207ConfirmOutputCount = function v207ConfirmOutputCount() { if (flow.active && flow.pendingOutputCount) applyOutputCount(flow.pendingOutputCount); };
  window.v207ContinueToPixels = function v207ContinueToPixels() { if (flow.active) { if (flow.setupSessionActive) sendSetupSession('setup_begin'); flow.pixelPortIndex = 0; renderLength(); } };
  window.v207NextPixelStep = function v207NextPixelStep() { if (!flow.active) return; if (flow.pixelPortIndex < flow.activePorts.length - 1) { flow.pixelPortIndex += 1; renderLength(); } else { flow.sidePortIndex = 0; renderSide(); } };
  window.v207PreviousPixelStep = function v207PreviousPixelStep() { if (!flow.active) return; if (flow.pixelPortIndex > 0) { flow.pixelPortIndex -= 1; renderLength(); } else renderOutputs(); };
  window.v207NextSideStep = function v207NextSideStep() { if (!flow.active) return; if (flow.sidePortIndex < flow.activePorts.length - 1) { flow.sidePortIndex += 1; renderSide(); } else renderPortAssignments(); };
  window.v207PreviousSideStep = function v207PreviousSideStep() { if (!flow.active) return; if (flow.sidePortIndex > 0) { flow.sidePortIndex -= 1; renderSide(); } else { flow.pixelPortIndex = flow.activePorts.length - 1; renderLength(); } };
  window.v207BackToLastSide = function v207BackToLastSide() { if (flow.active) { flow.sidePortIndex = flow.activePorts.length - 1; renderSide(); } };
  window.v207BackToAssignments = function v207BackToAssignments() { if (flow.active) renderPortAssignments(); };
  window.v20ContinueToSide = () => { if (flow.active) renderSide(); };
  window.v20BackToLength = () => { if (flow.active) renderLength(); };
  window.v20BackToSide = () => { if (flow.active) renderSide(); };
  window.v20ShowZoneChoice = () => { if (flow.active) renderZoneChoice(); };
  window.v20ChooseZone = (id) => { if (flow.active) renderGroupChoice(id); };

  window.v20SetReceiverSide = function v20SetReceiverSide(side) {
    if (!flow.active || flow.phase !== 'side') return;
    const modalBody = document.getElementById('modalBody');
    const previousScrollTop = modalBody?.scrollTop || 0;
    portDraft(currentCalibrationPort()).reversed = side === 'right';
    renderSide();
    requestAnimationFrame(() => {
      if (!modalBody || !flow.active || flow.phase !== 'side') return;
      modalBody.scrollTop = Math.min(previousScrollTop, Math.max(0, modalBody.scrollHeight - modalBody.clientHeight));
    });
  };

  window.v20ConfirmGeometry = function v20ConfirmGeometry() {
    if (!flow.active || flow.phase !== 'side') return;
    // Keep the live calibration active while zone/group choices are made.
    // The physical setting is committed only with the final Add action, so a
    // normal animation cannot flash between setup screens.
    flow.configurationStored = false;
    renderPortAssignments();
  };

  window.v207SetAssignmentMode = function v207SetAssignmentMode(mode) { if (!flow.active) return; pairDraft.assignmentMode = mode === 'separate' ? 'separate' : 'merge'; renderPortAssignments(); };
  window.v207SetPortZone = function v207SetPortZone(port, zoneId, merged = false) {
    if (!flow.active) return;
    const destination = portDraft(port); destination.zoneId = zoneId;
    const selectedZone = install.zones.find((item) => item.id === zoneId); destination.groupId = firstCompatibleGroup(selectedZone)?.id || '';
    if (merged) flow.activePorts.forEach((number) => Object.assign(portDraft(number), { zoneId: destination.zoneId, groupId: destination.groupId }));
    renderPortAssignments();
  };
  window.v207SetPortGroup = function v207SetPortGroup(port, groupId, merged = false) {
    if (!flow.active) return;
    const destination = portDraft(port); destination.groupId = groupId;
    if (merged) flow.activePorts.forEach((number) => Object.assign(portDraft(number), { zoneId: destination.zoneId, groupId }));
  };
  window.v207CreatePortGroup = function v207CreatePortGroup(port, prefix, merged = false) {
    if (!flow.active) return;
    const destination = portDraft(port), selectedZone = install.zones.find((item) => item.id === destination.zoneId);
    const name = document.getElementById(`v207NewGroup-${prefix}`)?.value.trim();
    if (!selectedZone || !name) return toast(tx('Geef de nieuwe groep een naam', 'Enter a name for the new group', 'Donnez un nom au nouveau groupe', 'Gib der neuen Gruppe einen Namen'));
    const template = fresh().installations[0].zones[0].groups[0].state;
    const created = { id: `g${Date.now()}${port}`, name, layout: 'line', receiverType: 'SPI', receivers: [], state: clone(template) };
    selectedZone.groups.push(created); destination.groupId = created.id;
    if (merged) flow.activePorts.forEach((number) => Object.assign(portDraft(number), { zoneId: selectedZone.id, groupId: created.id }));
    save('queued'); renderPortAssignments();
  };
  window.v207ReviewAssignments = function v207ReviewAssignments() { if (flow.active) renderFourPortReview(); };

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
  window.v20CommitReceiver = async () => {
    if (!flow.active || flow.phase !== 'review') return;
    const button = document.querySelector('.v20-review footer .button:last-child');
    if (button) {
      button.disabled = true;
      button.textContent = tx('Opslaan…', 'Saving…', 'Enregistrement…', 'Speichern…');
    }
    let outcome;
    try { outcome = await commitGeometry(); }
    catch (_) { outcome = { ok: false }; }
    if (!flow.active) return;
    if (!outcome.ok) {
      toast(tx('Receiver antwoordt niet · probeer opnieuw', 'Receiver did not respond · try again', 'Le récepteur ne répond pas · réessayez', 'Receiver antwortet nicht · erneut versuchen'));
      if (button) {
        button.disabled = false;
        button.textContent = `＋ ${tx('Receiver toevoegen', 'Add receiver', 'Ajouter le récepteur', 'Receiver hinzufügen')}`;
      }
      return;
    }
    try {
      const setupCommitted = await finishSetupSession(false);
      if (flow.setupSessionSupported && !setupCommitted) {
        beginSetupSession();
        throw new Error('setup_commit_failed');
      }
      if (!storeCommittedGeometry(outcome)) throw new Error('local_commit_failed');
      flow.configurationStored = true;
      assignPorts();
    }
    catch (_) {
      toast(tx('Instellingen nog niet bevestigd · probeer opnieuw', 'Settings not confirmed yet · try again', 'Réglages pas encore confirmés · réessayez', 'Einstellungen noch nicht bestätigt · erneut versuchen'));
      if (button) {
        button.disabled = false;
        button.textContent = `＋ ${tx('Receiver toevoegen', 'Add receiver', 'Ajouter le récepteur', 'Receiver hinzufügen')}`;
      }
    }
  };
  window.v20BackFromReview = () => {
    if (!flow.active) return;
    renderPortAssignments();
  };
  window.v20CancelCommission = function v20CancelCommission() { stopFlow(true); base.closeModal?.call(window); };
  window.v20OpenCompletedGroup = function v20OpenCompletedGroup(zoneId, groupId) {
    base.closeModal?.call(window);
    if (typeof window.openZone === 'function') openZone(zoneId);
    if (typeof window.openGroup === 'function') openGroup(groupId);
  };

  window.pairStep = function v20PairStep(step) {
    if (!flow.active) return base.pairStep?.call(this, step);
    if (step <= 1) return renderOutputs();
    if (step === 2) return renderLength();
    if (step === 3) return renderSide();
    return renderPortAssignments();
  };

  window.finishPairingWizard = function v20FinishPairingWizard(...args) {
    if (!flow.active) {
      const result = base.finishPairingWizard?.apply(this, args);
      return Promise.resolve(result).finally(() => {
        if (ensureZoneMainReceivers()) save('queued');
      });
    }
    if (flow.phase === 'outputs') return window.v207ContinueToPixels();
    if (flow.phase === 'length') return window.v207NextPixelStep();
    if (flow.phase === 'side') return window.v207NextSideStep();
    if (flow.phase === 'review') return window.v20CommitReceiver();
  };

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && flow.active && calibrationPhase()) {
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
        return node.parentElement?.closest('script,style,textarea,[data-preserve-transport-copy]')
          ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
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

  function privateNfcHealth(link) {
    const hint = String(link.nfcHint || '').toUpperCase();
    const state = String(link.nfcState || '').toUpperCase();
    if (link.nfcReady || state === 'READY') return {
      tone: 'ready', icon: '✓',
      title: tx('NFC-module gevonden', 'NFC module found', 'Module NFC détecté', 'NFC-Modul gefunden'),
      detail: tx('Klaar voor iPhone-tikken', 'Ready for iPhone taps', 'Prêt pour les touches iPhone', 'Bereit für iPhone-Taps')
    };
    if (state === 'STARTING' || hint === 'WAITING_FOR_FIRST_PROBE') return {
      tone: 'checking', icon: '…',
      title: tx('NFC-module wordt gecontroleerd', 'Checking NFC module', 'Vérification du module NFC', 'NFC-Modul wird geprüft'),
      detail: tx('Dit duurt enkele seconden', 'This takes a few seconds', 'Cela prend quelques secondes', 'Dies dauert einige Sekunden')
    };
    if (state === 'INIT_FAILED' || hint === 'PN532_RESPONDED_INIT_WILL_RETRY' || (link.nfcI2cError === 0 && !link.nfcReady)) return {
      tone: 'checking', icon: '↻',
      title: tx('NFC-module gevonden', 'NFC module found', 'Module NFC détecté', 'NFC-Modul gefunden'),
      detail: tx('De receiver probeert automatisch opnieuw', 'The receiver is retrying automatically', 'Le récepteur réessaie automatiquement', 'Der Receiver versucht es automatisch erneut')
    };
    if (link.nfcSwapped === true || hint === 'SWAP_SDA_SCL_AT_METRO') return {
      tone: 'error', icon: '!',
      title: tx('SDA en SCL zijn omgewisseld', 'SDA and SCL are swapped', 'SDA et SCL sont inversés', 'SDA und SCL sind vertauscht'),
      detail: tx('Wissel alleen deze twee draden om bij de receiver', 'Swap only these two wires at the receiver', 'Inversez uniquement ces deux fils au niveau du récepteur', 'Nur diese beiden Kabel am Receiver tauschen')
    };
    if (link.nfcIdleSda === false || link.nfcIdleScl === false || (hint.startsWith('CHECK_SDA') && hint.endsWith('FOR_SHORT_OR_LOOSE_WIRE'))) {
      const both = link.nfcIdleSda === false && link.nfcIdleScl === false;
      const line = both ? 'SDA + SCL' : link.nfcIdleSda === false ? 'SDA' : link.nfcIdleScl === false ? 'SCL' : 'SDA / SCL';
      return {
        tone: 'error', icon: '!',
        title: tx(`${line} maakt geen goed contact`, `${line} has no reliable connection`, `${line} n’a pas de connexion fiable`, `${line} hat keinen sicheren Kontakt`),
        detail: tx('Controleer deze draad op een los contact of kortsluiting', 'Check this wire for a loose contact or short circuit', 'Vérifiez si ce fil est desserré ou en court-circuit', 'Dieses Kabel auf Wackelkontakt oder Kurzschluss prüfen')
      };
    }
    if (link.nfcI2cError === 2 || hint === 'CHECK_POWER_CYCLE_MODE_1_ON_2_OFF_AND_WIRING') return {
      tone: 'error', icon: '!',
      title: tx('Geen elektrisch antwoord van de NFC-module', 'No electrical response from the NFC module', 'Aucune réponse électrique du module NFC', 'Keine elektrische Antwort vom NFC-Modul'),
      detail: tx('Stand 1 aan / 2 uit. Maak volledig stroomloos en controleer daarna 3V3, GND, SDA en SCL', 'Use switch 1 on / 2 off. Fully disconnect power, then check 3V3, GND, SDA and SCL', 'Position 1 activée / 2 désactivée. Coupez totalement l’alimentation, puis vérifiez 3V3, GND, SDA et SCL', 'Schalter 1 an / 2 aus. Strom vollständig trennen, dann 3V3, GND, SDA und SCL prüfen')
    };
    return {
      tone: 'error', icon: '!',
      title: tx('NFC-module niet bereikbaar', 'NFC module unavailable', 'Module NFC indisponible', 'NFC-Modul nicht erreichbar'),
      detail: tx('Controleer 3V3, GND, SDA en SCL en onderbreek daarna de voeding volledig', 'Check 3V3, GND, SDA and SCL, then fully disconnect the power', 'Vérifiez 3V3, GND, SDA et SCL, puis coupez complètement l’alimentation', '3V3, GND, SDA und SCL prüfen, danach die Stromversorgung vollständig trennen')
    };
  }

  function nextAvailableReceiverNumber() {
    const used = new Set((db.devices || []).map((device) => Math.round(Number(device.number)))
      .filter((number) => number >= 1 && number <= 250));
    for (let number = 1; number <= 250; number += 1) {
      if (!used.has(number)) return number;
    }
    throw new Error(tx('Maximumaantal receivers bereikt', 'Maximum receiver count reached', 'Nombre maximal de récepteurs atteint', 'Maximale Receiver-Anzahl erreicht'));
  }

  function receiverIdentityKey(device = null) {
    return String(device?.rid || device?.id || '').trim().toUpperCase();
  }

  function integratePairResponse(response, fallbackTransport) {
    const old = db.devices.find((device) => {
      const existingKey = receiverIdentityKey(device);
      const incomingKey = receiverIdentityKey(response?.device || {});
      return existingKey && incomingKey && existingKey === incomingKey;
    });
    const gatewayRid = String(response.transport?.gateway?.rid || '').toUpperCase();
    const isGateway = gatewayRid === receiverIdentityKey(response.device);
    const device = normaliseDevice({
      ...response.device,
      online: true,
      reachableViaGateway: true,
      gateway: isGateway
    }, old);
    db.devices = db.devices.filter((item) => receiverIdentityKey(item) !== receiverIdentityKey(device));
    db.devices.push(device);
    db.transportStatus = response.transport || {
      gatewayReady: true,
      gateway: { rid: device.rid, hardwareId: device.hardwareId },
      transport: fallbackTransport
    };
    return device;
  }

  function openPairingForDevice(device, target) {
    if (!device?.id) return;
    if (target?.zoneId && target?.groupId) startPairingForGroup(device.id, target.zoneId, target.groupId);
    else startPairing(device.id);
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
          privatePairNetworkReady = true;
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

  function bluetoothPairingSupport() {
    const browser = globalThis.navigator || {};
    const userAgent = String(browser.userAgent || '');
    const appleMobile = /iPad|iPhone|iPod/i.test(userAgent) ||
      (browser.platform === 'MacIntel' && Number(browser.maxTouchPoints) > 1);
    const safari = /Safari/i.test(userAgent) &&
      !/(?:Chrome|Chromium|CriOS|FxiOS|EdgiOS|OPiOS|Android)/i.test(userAgent);
    const secure = window.isSecureContext !== false;
    const ready = secure && typeof browser.bluetooth?.requestDevice === 'function';
    return { ready, secure, appleMobile, safari };
  }

  function renderBluetoothReceiverAdd(target = null, checkState = '', statusMessage = '') {
    privatePairTarget = target && { ...target };
    return renderPrivateReceiverAdd(
      privatePairTarget,
      checkState === 'bluetooth-failed' ? 'failed' : checkState === 'bluetooth-loading' ? 'manual-loading' : '',
      statusMessage
    );
  }

  function renderPrivateReceiverAdd(target = null, checkState = '', statusMessage = '') {
    const destination = target && typeof window.receiverGroupTarget === 'function'
      ? receiverGroupTarget(target.zoneId, target.groupId) : null;
    const link = privateWifiDetails();
    const firstReceiver = !(db.devices || []).length;
    const connected = Boolean(link.ready || privatePairNetworkReady);
    const stateMarkup = connected
      ? `<div id="v20PrivatePairStatus" class="nfc-status success"><span><b>${tx('Receiver gevonden', 'Receiver found', 'Récepteur trouvé', 'Receiver gefunden')}</b><small>${tx('De privéverbinding van je installatie is klaar.', 'Your installation’s private connection is ready.', 'La connexion privée de votre installation est prête.', 'Die private Verbindung deiner Installation ist bereit.')}</small></span></div>`
      : checkState === 'manual-loading'
        ? `<div id="v20PrivatePairStatus" class="nfc-status scanning"><span><b>${tx('Receivers zoeken…', 'Searching for receivers…', 'Recherche des récepteurs…', 'Receiver werden gesucht…')}</b><small>${firstReceiver ? tx('Je iPhone maakt de eenmalige privéverbinding met de hoofdreceiver.', 'Your iPhone is making the one-time private connection to the main receiver.', 'Votre iPhone établit la connexion privée unique avec le récepteur principal.', 'Dein iPhone stellt die einmalige private Verbindung zum Haupt-Receiver her.') : tx('De hoofdreceiver zoekt automatisch naar extra receivers.', 'The main receiver is automatically searching for additional receivers.', 'Le récepteur principal recherche automatiquement les récepteurs supplémentaires.', 'Der Haupt-Receiver sucht automatisch nach weiteren Receivern.')}</small></span></div>`
      : checkState === 'manual-failed' || checkState === 'failed'
        ? `<div id="v20PrivatePairStatus" class="nfc-status error"><span><b>${tx('Geen receiver gevonden', 'No receiver found', 'Aucun récepteur trouvé', 'Kein Receiver gefunden')}</b><small>${tx('Controleer of de receiver aanstaat en binnen bereik is, en probeer opnieuw.', 'Check that the receiver is powered on and within range, then try again.', 'Vérifiez que le récepteur est allumé et à portée, puis réessayez.', 'Prüfe, ob der Receiver eingeschaltet und in Reichweite ist, und versuche es erneut.')}</small></span></div>`
        : `<div id="v20PrivatePairStatus" class="nfc-status"><span><b>${firstReceiver ? tx('Klaar om te verbinden', 'Ready to connect', 'Prêt à connecter', 'Bereit zum Verbinden') : tx('Klaar om te zoeken', 'Ready to search', 'Prêt à rechercher', 'Bereit zur Suche')}</b><small>${firstReceiver ? tx('Je iPhone verbindt één keer rechtstreeks met de privé-wifi van de hoofdreceiver.', 'Your iPhone connects once directly to the main receiver’s private Wi-Fi.', 'Votre iPhone se connecte une fois directement au Wi-Fi privé du récepteur principal.', 'Dein iPhone verbindet sich einmal direkt mit dem privaten WLAN des Haupt-Receivers.') : tx('Extra receivers worden automatisch via de hoofdreceiver gevonden.', 'Additional receivers are found automatically through the main receiver.', 'Les récepteurs supplémentaires sont trouvés automatiquement via le récepteur principal.', 'Weitere Receiver werden automatisch über den Haupt-Receiver gefunden.')}</small></span></div>`;
    window.modal(`<section class="v20-private-pair">
      <div class="eyebrow">${tx('RECEIVER TOEVOEGEN', 'ADD RECEIVER', 'AJOUTER UN RÉCEPTEUR', 'RECEIVER HINZUFÜGEN')}</div>
      <h1>${firstReceiver ? tx('Verbind je hoofdreceiver', 'Connect your main receiver', 'Connectez votre récepteur principal', 'Haupt-Receiver verbinden') : tx('Receiver automatisch zoeken', 'Find receiver automatically', 'Rechercher le récepteur automatiquement', 'Receiver automatisch suchen')}</h1>
      <p class="sub">${firstReceiver ? tx('Zet de receiver aan. De app begeleidt de eenmalige privéverbinding en zoekt hem daarna automatisch.', 'Power on the receiver. The app guides the one-time private connection and then finds it automatically.', 'Allumez le récepteur. L’app vous guide pour la connexion privée unique, puis le trouve automatiquement.', 'Schalte den Receiver ein. Die App führt durch die einmalige private Verbindung und findet ihn danach automatisch.') : tx('Zet de receiver aan. De app zoekt hem automatisch via de hoofdreceiver van je installatie.', 'Power on the receiver. The app finds it automatically through your installation’s main receiver.', 'Allumez le récepteur. L’app le trouve automatiquement via le récepteur principal de votre installation.', 'Schalte den Receiver ein. Die App findet ihn automatisch über den Haupt-Receiver deiner Installation.')}</p>
      ${destination ? `<div class="group-pair-target"><span><b>${tx('Wordt toegevoegd aan', 'Will be added to', 'Sera ajouté à', 'Wird hinzugefügt zu')}</b><small>${safe(destination.zone.name)} → ${safe(destination.group.name)}</small></span><span class="scope">${tx('AL GEKOZEN', 'PRESELECTED', 'PRÉSÉLECTIONNÉ', 'VORAUSGEWÄHLT')}</span></div>` : ''}
      <div class="v20-pair-visual" aria-hidden="true"><div class="v20-phone-glyph"><i>APP</i></div><div class="v20-pair-waves"><i></i><i></i><i></i></div><div class="v20-hub-glyph"><b>R</b><small>${tx('PRIVÉ', 'PRIVATE', 'PRIVÉ', 'PRIVAT')}</small></div></div>
      <div class="v20-pair-steps">
        <span class="done"><i>✓</i><b>${tx('Receiver aan', 'Receiver on', 'Récepteur allumé', 'Receiver an')}</b></span>
        <span class="${connected ? 'done' : 'on'}"><i>${connected ? '✓' : '2'}</i><b>${firstReceiver ? tx('iPhone verbinden', 'Connect iPhone', 'Connecter l’iPhone', 'iPhone verbinden') : tx('Automatisch zoeken', 'Automatic search', 'Recherche auto', 'Automatisch suchen')}</b></span>
        <span class="${connected ? 'on' : ''}"><i>3</i><b>${tx('Receiver instellen', 'Set up receiver', 'Configurer le récepteur', 'Receiver einrichten')}</b></span>
      </div>
      ${stateMarkup}
      <div class="v20-pair-actions"><button class="button soft" onclick="closeModal()">${tx('Annuleren', 'Cancel', 'Annuler', 'Abbrechen')}</button>${connected ? `<button class="button" onclick="v20PairPrivateReceiver()">${tx('Receiver instellen', 'Set up receiver', 'Configurer le récepteur', 'Receiver einrichten')} →</button>` : checkState === 'manual-loading' ? `<button class="button" disabled>${tx('Zoeken…', 'Searching…', 'Recherche…', 'Suche…')}</button>` : `<button class="button" onclick="v20CheckPrivateReceiver()">${firstReceiver ? tx('Verbinden en zoeken', 'Connect and search', 'Connecter et rechercher', 'Verbinden und suchen') : tx('Opnieuw zoeken', 'Search again', 'Rechercher à nouveau', 'Erneut suchen')}</button>`}</div>
    </section>`);
    if (!connected && checkState === 'manual-loading') schedulePrivatePairCheck();
    // A successful search never claims or blinks a receiver on its own.
    // The customer starts recognition explicitly with Receiver toevoegen.
  }

  function privatePairTargetFromUrl() {
    const query = new URLSearchParams(location.search || '');
    const validId = (value) => /^[A-Za-z0-9._:-]{1,96}$/.test(String(value || '')) ? String(value) : '';
    const zoneId = validId(query.get('zone'));
    const groupId = validId(query.get('group'));
    return zoneId && groupId ? { zoneId, groupId, deviceId: '' } : null;
  }

  function privateReceiverUrl(target = null) {
    const query = new URLSearchParams({ manual: '1' });
    if (target?.zoneId && target?.groupId) {
      query.set('zone', String(target.zoneId));
      query.set('group', String(target.groupId));
    }
    return `http://192.168.4.1/?${query}`;
  }

  function beginPrivateReceiverLinking(target = null) {
    const url = privateReceiverUrl(target);
    try {
      location.assign(url);
      return true;
    } catch (_) {}
    try {
      const popup = window.open(url, '_blank', 'noopener');
      if (!popup) {
        location.href = url;
        return true;
      }
      if (typeof popup.focus === 'function') popup.focus();
      return true;
    } catch (_) {
      return false;
    }
    return false;
  }

  function manualBootstrapNotOnReceiver() {
    const target = privatePairTarget && { ...privatePairTarget };
    if (privatePairAutoStarted) return;
    privatePairAutoStarted = true;
    renderPrivateReceiverAdd(target, 'manual-loading', tx(
      'Ga naar het ALUVISION-netwerk op je telefoon om te koppelen.',
      'Switch to the ALUVISION network on your phone to continue pairing.',
      'Passez au réseau ALUVISION sur votre iPhone pour poursuivre l’appairage.',
      'Wechsle in deinem iPhone zum ALUVISION-Netzwerk, um das Pairing fortzusetzen.'
    ));
    setTimeout(() => {
      if (!document.getElementById('v20PrivatePairStatus')) return;
      const didNavigate = beginPrivateReceiverLinking(target);
      if (!didNavigate) {
        privatePairAutoRequested = false;
        renderPrivateReceiverAdd(target, 'manual-failed', tx(
          'Kon niet automatisch naar de receiver gaan. Open dit adres handmatig op je iPhone: ',
          'Unable to open receiver automatically. Open this address manually on your iPhone: ',
          'Impossible d’ouvrir automatiquement le récepteur. Ouvrez cette adresse manuellement sur votre iPhone :',
          'Automatisches Öffnen des Receivers fehlgeschlagen. Öffne diese Adresse manuell auf deinem iPhone:'
        ));
      }
    }, 400);
  }

  function beginPrivateReceiverAdd(target = null) {
    privatePairAutoRequested = true;
    privatePairAutoStarted = false;
    privatePairInFlight = false;
    privatePairNetworkReady = false;
    privatePairTarget = target && { ...target };
    renderPrivateReceiverAdd(privatePairTarget, 'manual-loading');
    setTimeout(() => window.v20CheckPrivateReceiver?.(), 0);
  }

  window.openAddReceiver = function v20OpenAddReceiver() {
    beginPrivateReceiverAdd();
  };

  window.openAddReceiverForGroup = function v20OpenAddReceiverForGroup() {
    if (!zone || !group) return toast(tx('Open eerst een groep', 'Open a group first', 'Ouvrez d’abord un groupe', 'Öffne zuerst eine Gruppe'));
    beginPrivateReceiverAdd({ zoneId: zone.id, groupId: group.id, deviceId: '' });
  };

  window.v20ShowWifiReserve = function v20ShowWifiReserve() {
    privatePairAutoRequested = false;
    privatePairAutoStarted = false;
    renderPrivateReceiverAdd(privatePairTarget && { ...privatePairTarget });
  };

  window.v20CopyPrivatePassword = async function v20CopyPrivatePassword() {
    try {
      const copied = await window.AluvisionPrivateWifi?.copyWifiPassword?.();
      toast(copied ? tx('Wachtwoord gekopieerd', 'Password copied', 'Mot de passe copié', 'Passwort kopiert') : tx('Geen wachtwoord ontvangen', 'No password received', 'Aucun mot de passe reçu', 'Kein Passwort empfangen'));
    } catch (_) {
      toast(tx('Kopiëren is niet toegestaan · houd het wachtwoord ingedrukt', 'Copying is unavailable · press and hold the password', 'Copie indisponible · maintenez le mot de passe', 'Kopieren nicht verfügbar · Passwort gedrückt halten'));
    }
  };

  window.v20OpenManualReceiver = function v20OpenManualReceiver() {
    location.assign(privateReceiverUrl(privatePairTarget));
  };

  window.v20RetryManualBootstrap = async function v20RetryManualBootstrap() {
    const target = privatePairTarget && { ...privatePairTarget };
    privatePairAutoRequested = true;
    privatePairAutoStarted = false;
    renderPrivateReceiverAdd(target, 'manual-loading');
    try {
      const bootstrap = window.AluvisionPrivateWifi?.manualBootstrap;
      if (typeof bootstrap !== 'function') throw new Error(tx('De handmatige receiververbinding is niet beschikbaar.', 'The manual receiver connection is unavailable.', 'La connexion manuelle au récepteur n’est pas disponible.', 'Die manuelle Receiver-Verbindung ist nicht verfügbar.'));
      await bootstrap({ refresh: true });
      renderPrivateReceiverAdd(target);
    } catch (error) {
      if (error?.code === 'MANUAL_BOOTSTRAP_NOT_ON_RECEIVER') {
        manualBootstrapNotOnReceiver();
        return;
      }
      privatePairAutoRequested = false;
      renderPrivateReceiverAdd(target, 'manual-failed', error?.message || String(error));
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
      privatePairNetworkReady = true;
      renderPrivateReceiverAdd(target);
    } else {
      privatePairNetworkReady = false;
      renderPrivateReceiverAdd(target, 'failed');
    }
  };

  function finishReceiverPair(response, target, fallbackTransport, options = {}) {
    const device = integratePairResponse(response, fallbackTransport);
    const shouldOpenSetup = options?.openSetup !== false;
    save('queued');
    privatePairInFlight = false;
    privatePairAutoRequested = false;
    render();
    if (!shouldOpenSetup) return device;
    base.closeModal?.call(window);
    openPairingForDevice(device, target);
    return device;
  }

  async function pairPrivateReceiverBatch(target, fallbackTransport, { autoMode = false } = {}) {
    // Commission one receiver per setup flow. Every physical receiver needs its
    // own port/pixel/direction choices, so silently pairing a whole discovery
    // batch would leave later receivers in an unusable half-configured state.
    const maxPaired = 1;
    const seen = new Set((db.devices || []).map((device) => receiverIdentityKey(device)).filter(Boolean));
    const paired = [];
    const targetNumber = () => {
      const remaining = Math.max(1, nextAvailableReceiverNumber());
      return remaining;
    };

    while (paired.length < maxPaired) {
      let response;
      let number;
      try {
        number = targetNumber();
      } catch (error) {
        break;
      }

      try {
        response = await api('/api/pair', { number });
      } catch (error) {
        if (!paired.length) {
          return { ok: false, error: error?.message || String(error), paired: [] };
        }
        return { ok: true, paired, partial: true, error: error?.message || String(error) };
      }

      if (response?.cancelled) return { ok: false, cancelled: true, cancelReason: response.cancelReason, paired: [] };
      if (!response?.ok || !response.device) {
        if (!paired.length) {
          return { ok: false, error: response?.error || tx('Geen receiver toegevoegd. Controleer of deze nog in bereik is.', 'No receiver added. Check that the receiver is still reachable.'), paired: [] };
        }
        return { ok: true, paired, partial: true, error: response?.error || null };
      }

      const key = receiverIdentityKey(response.device);
      if (key && seen.has(key)) {
        return { ok: true, paired, duplicate: true };
      }

      const device = integratePairResponse(response, fallbackTransport);
      if (key) seen.add(key);
      paired.push(device);
      save('queued');
      render();

      if (!autoMode) {
        privatePairInFlight = false;
        if (paired.length) {
          base.closeModal?.call(window);
          openPairingForDevice(paired[0], target);
        }
        return { ok: true, paired };
      }

      await new Promise((resolve) => setTimeout(resolve, 140));
    }

    privatePairInFlight = false;
    return { ok: true, paired };
  }

  window.v20PairReceiverBluetooth = async function v20PairReceiverBluetooth() {
    return window.v20CheckPrivateReceiver?.();
  };

  window.v20PairPrivateReceiver = async function v20PairPrivateReceiver(options = {}) {
    if (privatePairInFlight) return;
    const request = typeof options === 'object' && options !== null ? options : {};
    const autoMode = request.autoMode === true;
    privatePairInFlight = true;
    privatePairAutoBatchActive = autoMode;
    const node = document.getElementById('v20PrivatePairStatus');
    const button = document.querySelector('.v20-private-pair .v20-pair-actions .button:last-child');
    if (button) button.disabled = true;
    if (node) {
      node.className = 'nfc-status scanning';
      node.innerHTML = `<span><b>${tx('LED Line herkennen…', 'Identifying LED Line…', 'Identification de la LED Line…', 'LED Line erkennen…')}</b><small>${tx('De gekozen LED Line knippert. Bevestig daarna of dit de juiste is.', 'The selected LED Line flashes. Then confirm whether it is the right one.', 'La LED Line choisie clignote. Confirmez ensuite que c’est la bonne.', 'Die gewählte LED Line blinkt. Bestätige danach, dass es die richtige ist.')}</small></span>`;
    }
    const target = privatePairTarget && { ...privatePairTarget };
    try {
      const result = await pairPrivateReceiverBatch(target, 'WIFI_AP_ESPNOW', { autoMode });
      const paired = Array.isArray(result?.paired) ? result.paired : [];
      if (result?.cancelled) {
        if (result.cancelReason === 'other-receiver') renderPrivateReceiverAdd(target);
        return;
      }
      if (!result?.ok) {
        if (node?.isConnected) {
          node.className = 'nfc-status error';
          node.innerHTML = `<span><b>${tx('Toevoegen is nog niet gelukt', 'Adding has not succeeded yet', 'L’ajout n’a pas encore réussi', 'Hinzufügen noch nicht erfolgreich')}</b><small>${safe(result?.error || tx('Controleer of de receiver aanstaat en binnen bereik is, en probeer opnieuw.', 'Check that the receiver is powered on and within range, then try again.', 'Vérifiez que le récepteur est allumé et à portée, puis réessayez.', 'Prüfe, ob der Receiver eingeschaltet und in Reichweite ist, und versuche es erneut.'))}</small></span>`;
        } else {
          renderPrivateReceiverAdd(target, 'failed', result?.error || 'Toevoegen niet gelukt. Probeer opnieuw.');
          window.toast?.(result?.error || 'Toevoegen niet gelukt.');
        }
        return;
      }

      // The manual branch already opens the commissioning wizard as soon as the
      // durable pair ACK arrives. Auto-discovery must perform that exact same
      // hand-off instead of closing the modal and appearing to do nothing.
      if (!autoMode) return;
      if (paired.length) {
        privatePairAutoRequested = false;
        base.closeModal?.call(window);
        render();
        openPairingForDevice(paired[0], target);
        return;
      }
      if (node?.isConnected) {
        node.className = 'nfc-status error';
        node.innerHTML = `<span><b>${tx('Geen nieuwe receiver gevonden', 'No new receiver found', 'Aucun nouveau récepteur trouvé', 'Kein neuer Receiver gefunden')}</b><small>${safe(result?.error || tx('Controleer bereik en probeer opnieuw.', 'Check reachability and try again.', 'Vérifiez la portée et réessayez.', 'Prüfe die Reichweite und versuche es erneut.'))}</small></span>`;
      }
    } catch (error) {
      if (node?.isConnected) {
        node.className = 'nfc-status error';
        node.innerHTML = `<span><b>${tx('Toevoegen is nog niet gelukt', 'Adding has not succeeded yet', 'L’ajout n’a pas encore réussi', 'Hinzufügen noch nicht erfolgreich')}</b><small>${safe(error?.message || error)}</small></span>`;
      } else {
        renderPrivateReceiverAdd(target, 'failed', error?.message || String(error));
        window.toast?.(error?.message || String(error));
      }
    } finally {
      // Always release the click guard. Previously one unexpected integration
      // error left this flag set forever, making every later Add tap a no-op.
      privatePairAutoBatchActive = false;
      privatePairInFlight = false;
      privatePairAutoRequested = false;
      if (button?.isConnected) button.disabled = false;
    }
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
    .v20-strip-preview i.fill{background:#f8f5ea;box-shadow:0 0 10px #fff9,0 0 2px #fff}
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
    .v20-security-uses{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.v20-security-uses span{display:grid;justify-items:center;gap:6px;padding:12px 7px;border:1px solid var(--line);border-radius:14px;background:var(--panel-2);text-align:center}.v20-security-uses i{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:var(--ink);color:var(--panel);font-size:18px;font-style:normal}.v20-security-uses b{font-size:9px}.v20-security-backend-wait{display:grid;grid-template-columns:38px minmax(0,1fr);gap:10px;align-items:center;padding:12px;border:1px solid color-mix(in srgb,#d58b28,var(--line) 48%);border-radius:14px;background:color-mix(in srgb,#d58b28,var(--panel) 92%)}.v20-security-backend-wait>i{display:grid;place-items:center;width:38px;height:38px;border-radius:11px;background:#a86517;color:#fff;font-size:18px;font-style:normal;font-weight:950}.v20-security-backend-wait b,.v20-security-backend-wait small{display:block}.v20-security-backend-wait small{margin-top:3px;color:var(--mut);font-size:9px;line-height:1.45}.v20-main-badge{display:inline-flex;align-items:center;gap:5px;padding:7px 9px;border-radius:99px;background:color-mix(in srgb,var(--red),var(--panel) 88%);color:var(--red);font-size:8px;letter-spacing:.6px;white-space:nowrap}.v20-code-card label{display:grid;gap:7px}.v20-code-card label>b{font-size:11px}.v20-code-card .field{height:52px;font-size:19px;text-align:center;letter-spacing:2px}.v20-code-card .v20-show-code{display:flex;align-items:center;gap:8px}.v20-code-card .v20-show-code input{width:20px;height:20px;accent-color:var(--red)}.v20-code-card p{margin:0;padding:11px;border-radius:13px;background:var(--panel);color:var(--mut);font-size:10px;line-height:1.45}.v20-code-card p b{color:var(--ink)}.v20-security-confirm-visual{display:flex;align-items:center;justify-content:center;gap:13px;min-height:130px;border-radius:20px;background:#151716;color:#fff}.v20-security-confirm-visual i,.v20-security-confirm-visual b{display:grid;place-items:center;width:64px;height:82px;border:1px solid #ffffff2b;border-radius:16px;background:#272a28;font-style:normal}.v20-security-confirm-visual span{width:70px;height:38px;background:radial-gradient(circle at 10px 50%,#d45a52 0 3px,transparent 4px),radial-gradient(circle at 35px 50%,#d45a52 0 3px,transparent 4px),radial-gradient(circle at 60px 50%,#d45a52 0 3px,transparent 4px);animation:v20PairWave 1.5s ease-in-out infinite}.v20-review-map{display:grid;grid-template-columns:minmax(0,1fr) 26px minmax(0,1fr);gap:8px;align-items:center}.v20-review-map>span{display:grid;grid-template-columns:42px minmax(0,1fr);gap:1px 9px;align-items:center;padding:12px;border:1px solid var(--line);border-radius:15px;background:var(--panel-2)}.v20-review-map>span i{grid-row:1/3;display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:var(--ink);color:var(--panel);font-style:normal}.v20-review-map small{color:var(--mut);font-size:8px;font-weight:950;letter-spacing:.8px}.v20-review-map b{overflow:hidden;text-overflow:ellipsis}.v20-review-map>em{text-align:center;font-size:25px;font-style:normal;color:var(--mut)}.v20-review-list{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.v20-review-list span{padding:12px;border:1px solid var(--line);border-radius:14px;background:var(--panel)}.v20-review-list small,.v20-review-list b{display:block}.v20-review-list small{color:var(--mut);font-size:8px;letter-spacing:.7px}.v20-review-list b{margin-top:5px;font-size:11px}.v20-main-receiver-card{display:grid;grid-template-columns:45px minmax(0,1fr);gap:11px;align-items:center;padding:12px;border:1px solid color-mix(in srgb,var(--red),var(--line) 55%);border-radius:15px;background:color-mix(in srgb,var(--red),var(--panel) 94%)}.v20-main-receiver-card>i{display:grid;place-items:center;width:45px;height:45px;border-radius:14px;background:var(--red);color:#fff;font-size:21px;font-style:normal}.v20-main-receiver-card b,.v20-main-receiver-card small{display:block}.v20-main-receiver-card small{margin-top:3px;color:var(--mut);font-size:9px;line-height:1.4}.v20-pair-loading{display:flex;align-items:center;justify-content:center;gap:12px;min-height:190px}.v20-pair-loading i{width:26px;height:26px;border:3px solid var(--line);border-top-color:var(--red);border-radius:50%;animation:v20Spin .8s linear infinite}
    .v20-complete{text-align:center}.v20-complete .v20-success,.v20-security-step>.v20-success{display:grid;place-items:center;width:68px;height:68px;margin:0 auto 13px;border-radius:50%;background:#19825c;color:#fff;font-size:29px;font-weight:950}.v20-complete p{color:var(--mut);line-height:1.6}.v20-complete .button{width:100%;margin-top:11px}
    .calibration-live[data-state="offline"]{background:#f9e9e7;color:#903e38}.calibration-live[data-state="sent"]{background:#fff3dd;color:#7b581f}
    .v20-private-pair{display:grid;gap:15px;min-width:0}.v20-private-pair h1{margin:0;font-size:clamp(28px,6vw,38px)}.v20-private-pair>.sub{margin-top:-8px;line-height:1.5}.v20-pair-visual{display:flex;align-items:center;justify-content:center;min-height:126px;padding:18px;border-radius:20px;background:radial-gradient(circle at 50% 50%,#ca4e4630,transparent 44%),#111312;color:#fff;overflow:hidden}.v20-phone-glyph,.v20-hub-glyph{display:grid;place-items:center;flex:0 0 72px;height:91px;border:1px solid #ffffff30;border-radius:18px;background:linear-gradient(145deg,#3b3e3b,#181a19);box-shadow:0 12px 26px #0008}.v20-phone-glyph:before{content:'';width:28px;height:5px;border-radius:99px;background:#ffffff35}.v20-phone-glyph i{font-size:10px;font-style:normal;letter-spacing:1px}.v20-hub-glyph b{font-size:27px}.v20-hub-glyph small{font-size:8px;color:#ffffffa5}.v20-pair-waves{position:relative;display:flex;align-items:center;justify-content:center;width:94px;height:70px}.v20-pair-waves i{position:absolute;width:19px;height:42px;border:2px solid #d65a52;border-left:0;border-top-color:transparent;border-bottom-color:transparent;border-radius:0 50% 50% 0;animation:v20PairWave 1.55s ease-out infinite}.v20-pair-waves i:nth-child(2){animation-delay:.32s}.v20-pair-waves i:nth-child(3){animation-delay:.64s}.v20-pair-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.v20-pair-steps span{display:grid;justify-items:center;gap:6px;padding:10px 6px;border:1px solid var(--line);border-radius:13px;color:var(--mut);text-align:center}.v20-pair-steps i{display:grid;place-items:center;width:27px;height:27px;border-radius:50%;background:var(--panel-2);font-style:normal;font-weight:900}.v20-pair-steps b{font-size:9px}.v20-pair-steps .on{border-color:var(--red);color:var(--ink)}.v20-pair-steps .on i{background:var(--red);color:#fff}.v20-pair-steps .done i{background:#19825c;color:#fff}.v20-network-card{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px;border:1px solid var(--line);border-radius:14px;background:var(--panel-2)}.v20-network-card span{min-width:0}.v20-network-card small,.v20-network-card b{display:block}.v20-network-card small{color:var(--mut);font-size:8px;letter-spacing:.65px}.v20-network-card b{margin-top:4px;overflow:hidden;text-overflow:ellipsis}.v20-pair-actions{display:grid;grid-template-columns:minmax(0,.7fr) minmax(0,1.3fr);gap:9px}.v20-pair-actions .button{min-width:0;min-height:50px}.v20-pair-actions .button:only-child{grid-column:1/-1}
    .v20-nfc-health{display:grid;grid-template-columns:34px minmax(0,1fr);gap:9px;align-items:center;padding:10px 11px;border:1px solid var(--line);border-radius:13px;background:var(--panel-2)}.v20-nfc-health>i{display:grid;place-items:center;width:34px;height:34px;border-radius:11px;background:#19825c;color:#fff;font-style:normal;font-weight:950}.v20-nfc-health.checking>i{background:#bd8116}.v20-nfc-health.error>i{background:var(--red)}.v20-nfc-health b,.v20-nfc-health small{display:block}.v20-nfc-health small{margin-top:2px;color:var(--mut);font-size:9px}
    .v20-private-pair .nfc-status:before{content:'PRIVÉ'}
    .v20-manual-pair{padding:13px;border:1px solid var(--line);border-radius:16px;background:var(--panel-2)}.v20-manual-pair ol{display:grid;gap:12px;margin:0;padding:0;list-style:none}.v20-manual-pair li{display:grid;grid-template-columns:31px minmax(0,1fr);gap:10px;align-items:start}.v20-manual-pair li>i{display:grid;place-items:center;width:31px;height:31px;border-radius:10px;background:var(--ink);color:var(--panel);font-style:normal;font-weight:950}.v20-manual-pair li>span{min-width:0}.v20-manual-pair b,.v20-manual-pair small,.v20-manual-pair code{display:block}.v20-manual-pair small{margin-top:3px;color:var(--mut);font-size:9px;line-height:1.4}.v20-manual-pair code{margin-top:7px;padding:8px 10px;border-radius:9px;background:var(--panel);color:var(--ink);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;font-weight:850;overflow-wrap:anywhere}.v20-inline-copy{margin-top:6px;padding:4px 0;border:0;background:transparent;color:var(--red);font:inherit;font-size:9px;font-weight:900;cursor:pointer}.v20-nfc-alternative{padding:10px 12px;border:1px solid var(--line);border-radius:13px;background:var(--panel-2)}.v20-nfc-alternative summary{cursor:pointer;font-size:10px;font-weight:900}.v20-nfc-alternative p{margin:8px 0 0;color:var(--mut);font-size:9px;line-height:1.45}
    @keyframes v20GreenConfirm{50%{filter:brightness(1.25);transform:scaleY(.86)}}
    @keyframes v20GreenTravelRight{from{transform:translateX(-2400%);filter:brightness(1.35)}to{transform:translateX(0);filter:brightness(1)}}
    @keyframes v20GreenTravelLeft{from{transform:translateX(2400%);filter:brightness(1.35)}to{transform:translateX(0);filter:brightness(1)}}
    @keyframes v20PairWave{0%{opacity:0;transform:translateX(-9px) scale(.5)}25%{opacity:1}100%{opacity:0;transform:translateX(18px) scale(1.5)}}
    @keyframes v20Spin{to{transform:rotate(360deg)}}
    @media(max-width:620px){.v20-commission{gap:13px}.v20-live-card{padding:12px}.v20-calibration-help{grid-template-columns:1fr}.v20-calibration-help span{grid-template-columns:24px minmax(0,1fr)}.v20-side-options{grid-template-columns:1fr}.v20-commission footer{display:grid;grid-template-columns:minmax(0,.78fr) minmax(0,1.22fr)}.v20-commission footer .button{min-width:0;padding:9px}.v20-strip-preview{gap:2px;padding-inline:9px}.v20-strip-preview i{height:25px}.v20-stepper li span{font-size:7px;letter-spacing:0}.v20-network-card{align-items:stretch;flex-direction:column}.v20-network-card .button{width:100%}.v20-security-uses{grid-template-columns:1fr 1fr 1fr}.v20-security-uses span{padding-inline:4px}.v20-main-badge{display:none}.v20-review-map{grid-template-columns:1fr}.v20-review-map>em{transform:rotate(90deg);line-height:12px}.v20-review-list{grid-template-columns:1fr}.v20-review footer{grid-template-columns:minmax(0,.68fr) minmax(0,1.32fr)}}
    @media(prefers-reduced-motion:reduce){.v20-strip-preview i.start{animation:none}}
  `;
  document.head.appendChild(style);

  /* Both the temporary BOOT flow and the NFC hand-off open this same complete
     app. Bring the receiver wizard forward after the local adapter has safely
     captured and verified the receiver credentials. */
  const v20DeveloperHost = ['127.0.0.1', 'localhost', '::1'].includes(location.hostname);
  const v20UiTest = v20DeveloperHost ? new URLSearchParams(location.search).get('uiTest') : '';
  const v20ManualBootstrapRequested = Boolean(window.AluvisionPrivateWifi?.manualBootstrapRequested?.());
  const v20InitialPairTarget = privatePairTargetFromUrl();
  if (!v20UiTest && v20ManualBootstrapRequested) {
    privatePairAutoRequested = true;
    privatePairAutoStarted = false;
    setTimeout(async () => {
      privatePairTarget = v20InitialPairTarget;
      renderPrivateReceiverAdd(privatePairTarget, 'manual-loading');
      try {
        await window.AluvisionPrivateWifi.manualBootstrap();
        renderPrivateReceiverAdd(privatePairTarget);
      } catch (error) {
        privatePairAutoRequested = false;
        renderPrivateReceiverAdd(privatePairTarget, 'manual-failed', error?.message || String(error));
      }
    }, 180);
  } else if (!v20UiTest && window.AluvisionPrivateWifi?.wasProvisionedThisLoad?.()) {
    privatePairAutoRequested = true;
    privatePairAutoStarted = false;
    setTimeout(() => {
      privatePairTarget = v20InitialPairTarget;
      renderPrivateReceiverAdd(privatePairTarget);
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
      window.AluvisionAccountlessRecovery = {
        ...window.AluvisionAccountlessRecovery,
        getStatus: async () => ({ available: true, configured: true, trusted: true, rid: 'A7C2000000000001' })
      };
      beginSpiFlow(fixtureId);
    }, 80);
  }

  if (v20UiTest === 'commission4') {
    setTimeout(() => {
      const fixtureId = '__v207_visual_spi4__';
      db.devices = (db.devices || []).filter((item) => item.id !== fixtureId);
      db.devices.push({
        id: fixtureId,
        name: tx('Receiver 1 · 4 uitgangen', 'Receiver 1 · 4 outputs', 'Récepteur 1 · 4 sorties', 'Receiver 1 · 4 Ausgänge'),
        receiverType: 'SPI', rid: 'A7C2000000000004', hardwareId: 'VISUAL-FOUR-OUTPUT',
        pixels: 39, online: false, firmware: RELEASE.version,
        portCapacity: 4, portCount: 4, activePortCount: 4, portMask: 15,
        spiPorts: {
          1: { pixels: 39, reversed: false },
          2: { pixels: 24, reversed: true },
          3: { pixels: 52, reversed: false },
          4: { pixels: 16, reversed: true }
        },
        visualFixture: true
      });
      install.security = { recoveryConfigured: true, primaryReceiverId: fixtureId, configuredAt: Date.now() };
      window.AluvisionAccountlessRecovery = {
        ...window.AluvisionAccountlessRecovery,
        getStatus: async () => ({ available: true, configured: true, trusted: true, rid: 'A7C2000000000004' })
      };
      beginSpiFlow(fixtureId);
    }, 80);
  }

  if (v20UiTest === 'security') {
    setTimeout(() => {
      const fixtureId = '__v20_security_spi__';
      delete install.security;
      if (!(db.devices || []).some((item) => item.id === fixtureId)) {
        db.devices.push({
          id: fixtureId, name: 'Receiver 1 · privé', receiverType: 'SPI',
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
