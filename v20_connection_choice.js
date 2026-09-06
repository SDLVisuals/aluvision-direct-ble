/*
 * Aluvision V20 — native receiver connection choice.
 *
 * This final WebApp layer owns only the customer-facing transport chooser.
 * The native bridge performs Wi-Fi/Bluetooth work and keeps the existing
 * receiver commissioning flow authoritative after a confirmed pair ACK.
 */
(() => {
  'use strict';

  const native = window.AluvisionNativeConnection;
  if (!native?.available) return;

  const STORAGE_KEY = 'aluvision.receiver.connectionMode.v20';
  const MODES = new Set(['wifi', 'bluetooth']);
  let selectedMode = readMode();
  let activeTarget = null;
  let connectionBusy = false;
  let operationGeneration = 0;

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

  function readMode() {
    try {
      const value = String(localStorage.getItem(STORAGE_KEY) || '').toLowerCase();
      return MODES.has(value) ? value : 'wifi';
    } catch (_) { return 'wifi'; }
  }

  function saveMode(mode) {
    selectedMode = MODES.has(mode) ? mode : 'wifi';
    try { localStorage.setItem(STORAGE_KEY, selectedMode); } catch (_) {}
  }

  function targetRecord(target) {
    if (!target?.zoneId || !target?.groupId) return null;
    try {
      const location = typeof install !== 'undefined' ? install : null;
      const selectedZone = (location?.zones || []).find((item) => item.id === target.zoneId);
      const selectedGroup = selectedZone?.groups?.find((item) => item.id === target.groupId);
      return selectedZone && selectedGroup ? { zone: selectedZone, group: selectedGroup } : null;
    } catch (_) { return null; }
  }

  function firstReceiver() {
    try {
      const appReceivers = (Array.isArray(db?.devices) ? db.devices : [])
        .filter((device) => /^[0-9A-F]{16}$/i.test(String(device?.rid || device?.RID || '')));
      // Security and transport records intentionally survive app restarts, but
      // they may also survive removing the last receiver.  With no receiver in
      // the current setup this is a real first-receiver flow; do not try to
      // reconnect an obsolete main before showing the nearby BLE list.
      if (!appReceivers.length) return true;
      const configured = Boolean(install?.security?.recoveryConfigured);
      const primary = String(install?.security?.primaryReceiverId || '');
      const trustedMain = appReceivers.some((device) =>
        Boolean(device?.gateway || device?.mainReceiver) && device?.id === primary
      );
      // A radio connection or a saved device alone does not complete setup.
      // Resume first setup until both the main record and PIN are confirmed.
      return !configured || !trustedMain;
    } catch (_) { return true; }
  }

  function statusMarkup(tone, title, detail) {
    return `<span><b>${safe(title)}</b><small>${safe(detail)}</small></span>`;
  }

  function transportIcon(mode) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true">${mode === 'bluetooth'
      ? '<path d="m7 7 10 10-5 5V2l5 5L7 17"/>'
      : '<path d="M2 8.8a15 15 0 0 1 20 0M5 12a10.5 10.5 0 0 1 14 0M8.5 15.3a5.2 5.2 0 0 1 7 0"/><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none"/>'}</svg>`;
  }

  function setStatus(tone, title, detail) {
    const status = document.getElementById('receiverNfcStatus');
    if (!status) return;
    status.className = `nfc-status ${tone || ''}`.trim();
    status.innerHTML = statusMarkup(tone, title, detail);
  }

  function transportDetail(mode) {
    if (mode === 'bluetooth') {
      return `<div class="v20-connection-explainer" data-mode="bluetooth">
        <div class="v20-connection-route" aria-hidden="true">
          <span class="phone"><i></i></span><em class="bluetooth">${transportIcon('bluetooth')}</em><span class="receiver"><i></i><i></i></span>
        </div>
        <span><b>${tx('Rechtstreeks dichtbij', 'Direct when nearby', 'Directement à proximité', 'Direkt in der Nähe')}</b><small>${tx('De iPhone zoekt receivers binnen Bluetooth-bereik. Je hoeft geen wifi-netwerk te kiezen.', 'The iPhone searches for receivers within Bluetooth range. You do not need to choose a Wi-Fi network.', 'L’iPhone recherche les récepteurs à portée Bluetooth. Aucun réseau Wi-Fi à choisir.', 'Das iPhone sucht Receiver in Bluetooth-Reichweite. Du musst kein WLAN auswählen.')}</small></span>
      </div>`;
    }
    return `<div class="v20-connection-explainer" data-mode="wifi">
      <div class="v20-connection-route" aria-hidden="true">
        <span class="phone"><i></i></span><em class="wifi">${transportIcon('wifi')}</em><span class="receiver"><i></i><i></i></span>
      </div>
      <span><b>${tx('Sterke rechtstreekse verbinding', 'Strong direct connection', 'Connexion directe stable', 'Starke direkte Verbindung')}</b><small>${tx('De app maakt verbinding met de privé-wifi van de hoofdreceiver. Internet is niet nodig.', 'The app connects to the main receiver’s private Wi-Fi. Internet is not required.', 'L’app se connecte au Wi-Fi privé du récepteur principal. Internet n’est pas nécessaire.', 'Die App verbindet sich mit dem privaten WLAN des Hauptreceivers. Internet ist nicht nötig.')}</small></span>
    </div>`;
  }

  function updateChoice() {
    document.querySelectorAll('.v20-transport-choice').forEach((card) => {
      const active = card.dataset.mode === selectedMode;
      card.classList.toggle('on', active);
      card.setAttribute('aria-checked', String(active));
      card.tabIndex = active ? 0 : -1;
    });
    const detail = document.getElementById('v20ConnectionDetail');
    if (detail) detail.innerHTML = transportDetail(selectedMode);
    const button = document.getElementById('nativeReceiverScanButton');
    if (button) {
      button.textContent = selectedMode === 'bluetooth'
        ? tx('Zoeken via Bluetooth', 'Search via Bluetooth', 'Rechercher via Bluetooth', 'Über Bluetooth suchen')
        : tx('Verbinden via Wi‑Fi', 'Connect via Wi-Fi', 'Se connecter via Wi-Fi', 'Über WLAN verbinden');
    }
    const bluetoothList = document.getElementById('nativeBluetoothCandidates');
    if (bluetoothList && selectedMode !== 'bluetooth') bluetoothList.innerHTML = '';
  }

  function openConnectionChoice(target = null) {
    activeTarget = target?.zoneId && target?.groupId
      ? { zoneId: String(target.zoneId), groupId: String(target.groupId) }
      : null;
    native.setAddTarget(activeTarget);
    operationGeneration += 1;
    connectionBusy = false;
    const destination = targetRecord(activeTarget);
    const destinationMarkup = destination ? `<div class="group-pair-target">
      <span><b>${tx('Wordt toegevoegd aan', 'Will be added to', 'Sera ajouté à', 'Wird hinzugefügt zu')}</b><small>${safe(destination.zone.name)} → ${safe(destination.group.name)}</small></span>
      <span class="scope">${tx('AL GEKOZEN', 'PRESELECTED', 'PRÉSÉLECTIONNÉ', 'VORAUSGEWÄHLT')}</span>
    </div>` : '';
    const first = firstReceiver();

    window.modal(`<section class="v20-connection-choice" data-preserve-transport-copy>
      <header>
        <div class="eyebrow">${tx('RECEIVER TOEVOEGEN', 'ADD RECEIVER', 'AJOUTER UN RÉCEPTEUR', 'RECEIVER HINZUFÜGEN')}</div>
        <h1>${first ? tx('Verbind je eerste receiver', 'Connect your first receiver', 'Connectez votre premier récepteur', 'Verbinde deinen ersten Receiver') : tx('Hoe wil je verbinden?', 'How would you like to connect?', 'Comment souhaitez-vous vous connecter ?', 'Wie möchtest du verbinden?')}</h1>
        <p class="sub">${first ? tx('Kies één verbindingsmethode. Daarna stel je een persoonlijke pincode en je LED Line in.', 'Choose one connection method. You will then set a personal PIN and configure your LED Line.', 'Choisissez une méthode. Vous définirez ensuite un code PIN personnel et configurerez votre LED Line.', 'Wähle eine Verbindungsmethode. Danach richtest du eine persönliche PIN und deine LED Line ein.') : tx('Kies wat op deze plaats het beste werkt. Je kunt dit later opnieuw kiezen.', 'Choose what works best here. You can choose again later.', 'Choisissez ce qui convient le mieux ici. Vous pourrez changer plus tard.', 'Wähle, was hier am besten funktioniert. Du kannst es später ändern.')}</p>
      </header>
      ${destinationMarkup}
      <div class="v20-transport-grid" role="radiogroup" onkeydown="v20MoveReceiverTransport(event)" aria-label="${tx('Verbindingsmethode', 'Connection method', 'Méthode de connexion', 'Verbindungsmethode')}">
        <button type="button" class="v20-transport-choice" data-mode="wifi" role="radio" onclick="v20SetReceiverTransport('wifi')">
          <span class="v20-transport-icon wifi" aria-hidden="true">${transportIcon('wifi')}</span>
          <span><b>Wi‑Fi</b><small>${tx('Sterk en stabiel', 'Strong and stable', 'Stable et puissant', 'Stark und stabil')}</small></span><em>✓</em>
        </button>
        <button type="button" class="v20-transport-choice" data-mode="bluetooth" role="radio" onclick="v20SetReceiverTransport('bluetooth')">
          <span class="v20-transport-icon bluetooth" aria-hidden="true">${transportIcon('bluetooth')}</span>
          <span><b>Bluetooth</b><small>${tx('Snel wanneer je dichtbij bent', 'Quick when you are nearby', 'Rapide à proximité', 'Schnell in der Nähe')}</small></span><em>✓</em>
        </button>
      </div>
      <div id="v20ConnectionDetail">${transportDetail(selectedMode)}</div>
      <div id="receiverNfcStatus" class="nfc-status" role="status" aria-live="polite">${statusMarkup('', tx('Klaar om te zoeken', 'Ready to search', 'Prêt à rechercher', 'Bereit zum Suchen'), tx('Zet de receiver aan en tik hieronder op verbinden.', 'Power on the receiver and tap connect below.', 'Allumez le récepteur puis touchez connecter.', 'Schalte den Receiver ein und tippe unten auf Verbinden.'))}</div>
      <div id="nativeBluetoothCandidates" class="v20-bluetooth-candidates"></div>
      <div id="nativeReceiverCandidates" class="native-receiver-candidates"></div>
      <footer class="v20-pair-actions">
        <button class="button soft" type="button" onclick="v20CancelReceiverConnection()">${tx('Annuleren', 'Cancel', 'Annuler', 'Abbrechen')}</button>
        <button id="nativeReceiverScanButton" class="button" type="button" onclick="v20StartReceiverConnection()"></button>
      </footer>
    </section>`);
    updateChoice();
  }

  function normaliseBluetoothPeripherals(result = {}) {
    const source = Array.isArray(result?.peripherals) ? result.peripherals
      : Array.isArray(result?.results) ? result.results
        : Array.isArray(result?.devices) ? result.devices : [];
    const seen = new Set();
    return source.map((item) => {
      const id = String(item?.peripheralId || item?.identifier || item?.id || '').trim();
      if (!id || seen.has(id)) return null;
      seen.add(id);
      return {
        id,
        name: String(item?.name || item?.localName || tx('Aluvision receiver', 'Aluvision receiver', 'Récepteur Aluvision', 'Aluvision Receiver')),
        signal: Number.isFinite(Number(item?.rssi)) ? Number(item.rssi) : null
      };
    }).filter(Boolean);
  }

  function receiverInventoryReturned(result = {}) {
    const devices = Array.isArray(result?.inventory?.devices) ? result.inventory.devices
      : Array.isArray(result?.devices) ? result.devices : [];
    return devices.some((item) => /^[0-9A-F]{16}$/i.test(String(item?.RID || item?.rid || '')));
  }

  function renderBluetoothPeripherals(items) {
    const root = document.getElementById('nativeBluetoothCandidates');
    if (!root) return;
    if (!items.length) {
      root.innerHTML = `<div class="native-receiver-empty"><b>${tx('Nog geen Bluetooth-receiver gevonden', 'No Bluetooth receiver found yet', 'Aucun récepteur Bluetooth trouvé', 'Noch kein Bluetooth-Receiver gefunden')}</b><small>${tx('Controleer of de receiver aan staat, blijf dichtbij en probeer opnieuw.', 'Make sure the receiver is powered, stay nearby and try again.', 'Vérifiez que le récepteur est allumé, restez à proximité et réessayez.', 'Prüfe, ob der Receiver eingeschaltet ist, bleib in der Nähe und versuche es erneut.')}</small></div>`;
      return;
    }
    root.innerHTML = items.map((item) => `<button type="button" class="v20-bluetooth-device" data-peripheral-id="${safe(item.id)}" onclick="v20ConnectReceiverBluetooth(this.dataset.peripheralId,this)">
      <span class="v20-transport-icon bluetooth" aria-hidden="true">${transportIcon('bluetooth')}</span>
      <span><b>${safe(item.name)}</b><small>${item.signal !== null && item.signal >= -65 ? tx('Dichtbij', 'Nearby', 'À proximité', 'In der Nähe') : tx('Binnen bereik', 'Within range', 'À portée', 'In Reichweite')}</small></span><i>›</i>
    </button>`).join('');
  }

  function setBusy(value) {
    connectionBusy = Boolean(value);
    const button = document.getElementById('nativeReceiverScanButton');
    if (button) {
      button.disabled = connectionBusy;
      button.toggleAttribute('aria-busy', connectionBusy);
    }
    document.querySelectorAll('.v20-transport-choice,.v20-bluetooth-device').forEach((item) => {
      item.disabled = connectionBusy;
    });
  }

  window.v20SetReceiverTransport = function v20SetReceiverTransport(mode) {
    if (connectionBusy || !MODES.has(mode)) return;
    saveMode(mode);
    operationGeneration += 1;
    document.getElementById('nativeReceiverCandidates')?.replaceChildren();
    setStatus('', tx('Klaar om te zoeken', 'Ready to search', 'Prêt à rechercher', 'Bereit zum Suchen'), mode === 'bluetooth'
      ? tx('Zet de receiver aan en blijf met je iPhone in de buurt.', 'Power on the receiver and keep your iPhone nearby.', 'Allumez le récepteur et gardez votre iPhone à proximité.', 'Schalte den Receiver ein und halte dein iPhone in der Nähe.')
      : tx('Zet de receiver aan. De app regelt de rechtstreekse verbinding.', 'Power on the receiver. The app handles the direct connection.', 'Allumez le récepteur. L’app gère la connexion directe.', 'Schalte den Receiver ein. Die App stellt die direkte Verbindung her.'));
    updateChoice();
  };

  window.v20MoveReceiverTransport = function v20MoveReceiverTransport(event) {
    if (connectionBusy || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 'wifi' : event.key === 'End' ? 'bluetooth' : selectedMode === 'wifi' ? 'bluetooth' : 'wifi';
    window.v20SetReceiverTransport(next);
    document.querySelector(`.v20-transport-choice[data-mode="${next}"]`)?.focus();
  };

  window.v20StartReceiverConnection = async function v20StartReceiverConnection() {
    if (connectionBusy) return;
    const generation = ++operationGeneration;
    setBusy(true);
    document.getElementById('nativeBluetoothCandidates')?.replaceChildren();
    document.getElementById('nativeReceiverCandidates')?.replaceChildren();
    try {
      if (selectedMode === 'wifi') {
        setStatus('scanning', tx('Wi‑Fi-verbinding openen…', 'Opening Wi-Fi connection…', 'Ouverture de la connexion Wi-Fi…', 'WLAN-Verbindung wird geöffnet…'), tx('Bevestig alleen de iPhone-melding als die verschijnt.', 'Only confirm the iPhone prompt if it appears.', 'Confirmez uniquement le message de l’iPhone s’il apparaît.', 'Bestätige nur die iPhone-Meldung, falls sie erscheint.'));
        if (native.mode === 'bluetooth') await native.disconnectBluetooth().catch(() => {});
        await native.selectTransport('wifi');
        if (generation !== operationGeneration) return;
        setBusy(false);
        return window.scanNativeReceivers?.({ setupFirst: firstReceiver() });
      }

      setStatus('scanning', tx('Bluetooth-receivers zoeken…', 'Searching for Bluetooth receivers…', 'Recherche de récepteurs Bluetooth…', 'Bluetooth-Receiver werden gesucht…'), tx('Blijf dichtbij; dit duurt meestal enkele seconden.', 'Stay nearby; this usually takes a few seconds.', 'Restez à proximité ; cela prend généralement quelques secondes.', 'Bleib in der Nähe; dies dauert meist nur wenige Sekunden.'));
      await native.selectTransport('bluetooth');
      // For an existing installation the phone always talks to its remembered
      // main receiver. That main then discovers new receivers over ESP-NOW.
      // Reconnect it first so customers never need to guess which nearby unit
      // is the gateway.
      if (!firstReceiver()) {
        try {
          setStatus('scanning', tx('Hoofdreceiver verbinden…', 'Connecting main receiver…', 'Connexion au récepteur principal…', 'Hauptreceiver wird verbunden…'), tx('Extra receivers worden daarna automatisch gezocht.', 'Additional receivers are then found automatically.', 'Les récepteurs supplémentaires sont ensuite trouvés automatiquement.', 'Weitere Receiver werden danach automatisch gefunden.'));
          const remembered = await native.connectBluetooth();
          if (generation !== operationGeneration) return;
          if (receiverInventoryReturned(remembered)) {
            setBusy(false);
            return window.scanNativeReceivers?.({ setupFirst: firstReceiver() });
          }
        } catch (_) {
          // No remembered gateway on this phone: fall through to the visual
          // nearby-receiver list and let the customer choose it once.
        }
      }
      const result = await native.scanBluetooth();
      if (generation !== operationGeneration) return;
      if (result?.connected === true || receiverInventoryReturned(result)) {
        setBusy(false);
        return window.scanNativeReceivers?.({ setupFirst: firstReceiver() });
      }
      const peripherals = normaliseBluetoothPeripherals(result);
      renderBluetoothPeripherals(peripherals);
      const existingInstallation = !firstReceiver();
      setStatus(peripherals.length ? 'success' : 'error', peripherals.length
        ? (existingInstallation
          ? tx('Kies je hoofdreceiver', 'Choose your main receiver', 'Choisissez votre récepteur principal', 'Wähle deinen Hauptreceiver')
          : tx('Kies je receiver', 'Choose your receiver', 'Choisissez votre récepteur', 'Wähle deinen Receiver'))
        : tx('Geen receiver gevonden', 'No receiver found', 'Aucun récepteur trouvé', 'Kein Receiver gefunden'), peripherals.length
          ? (existingInstallation
            ? tx('De hoofdreceiver zoekt daarna de nieuwe receiver automatisch.', 'The main receiver will then find the new receiver automatically.', 'Le récepteur principal trouvera ensuite automatiquement le nouveau récepteur.', 'Der Hauptreceiver findet danach den neuen Receiver automatisch.')
            : tx('Tik op de receiver die je wilt toevoegen.', 'Tap the receiver you want to add.', 'Touchez le récepteur à ajouter.', 'Tippe auf den Receiver, den du hinzufügen möchtest.'))
          : tx('Controleer de stroom en probeer opnieuw.', 'Check the power and try again.', 'Vérifiez l’alimentation et réessayez.', 'Prüfe die Stromversorgung und versuche es erneut.'));
    } catch (error) {
      if (generation !== operationGeneration) return;
      setStatus('error', tx('Verbinden niet gelukt', 'Could not connect', 'Connexion impossible', 'Verbindung fehlgeschlagen'), String(error?.message || error));
    } finally {
      if (generation === operationGeneration) setBusy(false);
    }
  };

  window.v20ConnectReceiverBluetooth = async function v20ConnectReceiverBluetooth(peripheralId, button) {
    if (connectionBusy || !peripheralId) return;
    const generation = ++operationGeneration;
    const oldLabel = button?.querySelector('b')?.textContent || '';
    setBusy(true);
    if (button?.querySelector('b')) button.querySelector('b').textContent = tx('Verbinden…', 'Connecting…', 'Connexion…', 'Verbinden…');
    setStatus('scanning', tx('Bluetooth verbinden…', 'Connecting via Bluetooth…', 'Connexion Bluetooth…', 'Bluetooth wird verbunden…'), tx('De receiver wordt veilig gecontroleerd.', 'The receiver is being verified securely.', 'Le récepteur est vérifié de manière sécurisée.', 'Der Receiver wird sicher geprüft.'));
    try {
      const result = await native.connectBluetooth(String(peripheralId));
      if (generation !== operationGeneration) return;
      if (!firstReceiver()) {
        const inventory = result?.inventory && typeof result.inventory === 'object' ? result.inventory : result;
        const gatewayRid = String(inventory?.gatewayRid || '').toUpperCase();
        const gateway = (inventory?.devices || []).find((item) =>
          String(item?.RID || item?.rid || '').toUpperCase() === gatewayRid
        );
        if (String(gateway?.MESHROLE || gateway?.ROLE || '').toUpperCase() === 'STANDALONE') {
          await native.disconnectBluetooth().catch(() => {});
          throw new Error(tx('Dit is een nieuwe receiver. Kies eerst de hoofdreceiver van je installatie; die vindt deze receiver daarna automatisch.', 'This is a new receiver. First choose your installation’s main receiver; it will then find this receiver automatically.', 'Ceci est un nouveau récepteur. Choisissez d’abord le récepteur principal de l’installation ; il le trouvera ensuite automatiquement.', 'Dies ist ein neuer Receiver. Wähle zuerst den Hauptreceiver deiner Installation; er findet diesen Receiver danach automatisch.'));
        }
      }
      setBusy(false);
      await window.scanNativeReceivers?.({ setupFirst: firstReceiver() });
    } catch (error) {
      if (generation !== operationGeneration) return;
      setStatus('error', tx('Bluetooth-verbinding mislukt', 'Bluetooth connection failed', 'Échec de la connexion Bluetooth', 'Bluetooth-Verbindung fehlgeschlagen'), String(error?.message || error));
      if (button?.querySelector('b')) button.querySelector('b').textContent = oldLabel;
    } finally {
      if (generation === operationGeneration) setBusy(false);
    }
  };

  window.v20CancelReceiverConnection = function v20CancelReceiverConnection() {
    operationGeneration += 1;
    connectionBusy = false;
    activeTarget = null;
    native.setAddTarget(null);
    window.closeModal?.();
  };

  function installOverrides() {
    window.openAddReceiver = () => openConnectionChoice();
    window.openAddReceiverForGroup = () => {
      try {
        if (!zone || !group) {
          return window.toast?.(tx('Open eerst een groep', 'Open a group first', 'Ouvrez d’abord un groupe', 'Öffne zuerst eine Gruppe'));
        }
        return openConnectionChoice({ zoneId: zone.id, groupId: group.id });
      } catch (_) { return openConnectionChoice(); }
    };
    document.documentElement.classList.add('v20-native-connection-choice');
  }

  document.head.insertAdjacentHTML('beforeend', `<style>
    .v20-connection-choice{display:grid;gap:14px;max-width:690px;margin:0 auto}.v20-connection-choice>header h1{margin-bottom:5px}.v20-connection-choice>header .sub{margin:0;max-width:620px}.v20-transport-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.v20-transport-choice{position:relative;display:grid;grid-template-columns:54px minmax(0,1fr) 22px;gap:11px;align-items:center;min-height:88px;padding:14px;border:1px solid var(--line);border-radius:18px;background:var(--panel-2);color:var(--ink);text-align:left;cursor:pointer;transition:border-color .18s ease,background .18s ease,transform .18s ease,box-shadow .18s ease}.v20-transport-choice:active{transform:scale(.985)}.v20-transport-choice.on{border-color:color-mix(in srgb,var(--red),var(--line) 35%);background:color-mix(in srgb,var(--red),var(--panel) 95%);box-shadow:0 0 0 2px color-mix(in srgb,var(--red),transparent 83%)}.v20-transport-choice>span:nth-child(2) b,.v20-transport-choice>span:nth-child(2) small{display:block}.v20-transport-choice>span:nth-child(2) b{font-size:15px}.v20-transport-choice>span:nth-child(2) small{margin-top:4px;color:var(--mut);font-size:9px;line-height:1.35}.v20-transport-choice>em{display:grid;place-items:center;width:21px;height:21px;border:1px solid var(--line);border-radius:50%;color:transparent;font-size:11px;font-style:normal}.v20-transport-choice.on>em{border-color:var(--red);background:var(--red);color:#fff}.v20-transport-icon{position:relative;display:grid;place-items:center;width:54px;height:54px;border-radius:16px;background:var(--ink);color:var(--panel)}.v20-transport-icon.bluetooth{font-size:28px;font-weight:900}.v20-transport-icon.wifi i{position:absolute;left:50%;bottom:13px;border:2px solid transparent;border-top-color:var(--panel);border-radius:50%;transform:translateX(-50%) rotate(180deg)}.v20-transport-icon.wifi i:nth-child(1){width:34px;height:24px}.v20-transport-icon.wifi i:nth-child(2){width:24px;height:17px}.v20-transport-icon.wifi i:nth-child(3){width:14px;height:10px}.v20-transport-icon.wifi b{position:absolute;bottom:10px;width:5px;height:5px;border-radius:50%;background:var(--panel)}.v20-connection-explainer{display:grid;grid-template-columns:150px minmax(0,1fr);gap:14px;align-items:center;padding:13px;border:1px solid var(--line);border-radius:16px;background:var(--panel)}.v20-connection-explainer>span b,.v20-connection-explainer>span small{display:block}.v20-connection-explainer>span small{margin-top:4px;color:var(--mut);font-size:9px;line-height:1.45}.v20-connection-route{display:flex;align-items:center;justify-content:center;gap:10px;min-height:72px;border-radius:13px;background:#171918;color:#fff}.v20-connection-route>span{position:relative;display:block;background:#303431}.v20-connection-route .phone{width:25px;height:44px;border:1px solid #ffffff6e;border-radius:7px}.v20-connection-route .phone i{position:absolute;left:8px;right:8px;bottom:3px;height:2px;border-radius:2px;background:#ffffff73}.v20-connection-route .receiver{width:43px;height:31px;border-radius:6px}.v20-connection-route .receiver i{position:absolute;top:7px;width:5px;height:5px;border-radius:50%;background:#45d18a}.v20-connection-route .receiver i:first-child{left:10px}.v20-connection-route .receiver i:last-child{left:19px}.v20-connection-route>em{display:grid;place-items:center;width:38px;height:38px;color:#fff;font-style:normal}.v20-connection-route>em.bluetooth{border:1px solid #ffffff2b;border-radius:50%;font-size:22px}.v20-connection-route>em.wifi{position:relative}.v20-connection-route>em.wifi i{position:absolute;left:50%;border:1.5px solid transparent;border-top-color:#fff;border-radius:50%;transform:translateX(-50%) rotate(180deg)}.v20-connection-route>em.wifi i:nth-child(1){width:34px;height:26px;bottom:5px}.v20-connection-route>em.wifi i:nth-child(2){width:23px;height:17px;bottom:6px}.v20-connection-route>em.wifi i:nth-child(3){width:11px;height:8px;bottom:7px}.v20-bluetooth-candidates{display:grid;gap:8px}.v20-bluetooth-device{display:grid;grid-template-columns:43px minmax(0,1fr) 18px;gap:10px;align-items:center;width:100%;padding:10px;border:1px solid var(--line);border-radius:15px;background:var(--panel-2);color:var(--ink);text-align:left}.v20-bluetooth-device .v20-transport-icon{width:43px;height:43px;border-radius:12px;font-size:22px}.v20-bluetooth-device span:nth-child(2) b,.v20-bluetooth-device span:nth-child(2) small{display:block}.v20-bluetooth-device span:nth-child(2) small{margin-top:3px;color:var(--mut);font-size:9px}.v20-bluetooth-device>i{font-size:22px;font-style:normal}.v20-connection-choice .nfc-status{margin-top:0}.v20-connection-choice footer{display:grid;grid-template-columns:minmax(0,.72fr) minmax(0,1.28fr);gap:9px}.v20-connection-choice footer .button{min-width:0}.v20-connection-choice [aria-busy="true"]{cursor:wait}
    @media(max-width:580px){.v20-connection-choice{gap:11px}.v20-transport-grid{grid-template-columns:1fr}.v20-transport-choice{min-height:74px;padding:10px 12px}.v20-transport-icon{width:48px;height:48px;border-radius:14px}.v20-connection-explainer{grid-template-columns:1fr;padding:10px}.v20-connection-route{min-height:64px}.v20-connection-choice footer{position:sticky;bottom:-1px;z-index:3;padding-top:8px;background:linear-gradient(transparent,var(--panel) 19%)} }
    .v20-transport-icon svg{display:block;width:28px;height:28px}.v20-connection-route>em svg{display:block;width:26px;height:26px}.v20-connection-route>em.bluetooth{border:0}.v20-transport-choice>span:nth-child(2) small,.v20-connection-explainer>span small,.v20-bluetooth-device span:nth-child(2) small{font-size:11px;line-height:1.45}.v20-transport-choice:focus-visible,.v20-bluetooth-device:focus-visible{outline:3px solid var(--red);outline-offset:3px}.v20-connection-choice .nfc-status{min-height:60px}.v20-connection-choice .nfc-status.scanning:before{animation:v21connectionpulse 1.2s ease-in-out infinite}.v20-bluetooth-device{cursor:pointer;min-height:68px}.v20-bluetooth-device span:nth-child(2){min-width:0;overflow-wrap:anywhere}.v20-connection-route .receiver i{background:var(--red,#cc514b)}
    @keyframes v21connectionpulse{50%{opacity:.35;transform:scale(.8)}}
    @media(prefers-reduced-motion:reduce){.v20-connection-choice *{animation:none!important;transition:none!important}}
  </style>`);

  if (document.readyState === 'loading') {
    window.addEventListener('load', installOverrides, { once: true });
  } else {
    installOverrides();
  }
})();
