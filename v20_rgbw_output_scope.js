/*
 * Aluvision Lighting 20.7.2 · RGBW output scope
 *
 * A two-output RGBW receiver can drive Port 1, Port 2, or both outputs as one
 * linked lighting object.  The choice is persisted in the installation data,
 * is kept across every group re-render, and never changes SPI routing.
 */
(() => {
  'use strict';

  const VERSION = '20.7.2';
  const deviceDrafts = new Map();
  const deviceSaveBusy = new Set();
  const scopedLiveTimers = new Map();
  const mapDrafts = new Map();

  const copy = (nl, en, fr, de) => typeof ac === 'function' ? ac(nl, en, fr, de) : nl;
  const safe = value => typeof esc === 'function' ? esc(String(value ?? '')) : String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const duplicate = value => typeof clone === 'function' ? clone(value) : JSON.parse(JSON.stringify(value));
  const activeGuide = () => typeof realGuide !== 'undefined' && Boolean(realGuide?.active);
  const deviceType = device => typeof receiverTypeOf === 'function' ? receiverTypeOf(device) : String(device?.receiverType || 'SPI').toUpperCase();
  const reachable = device => typeof receiverReachable === 'function' ? receiverReachable(device) : Boolean(device?.online);
  const endpointRid = (device, port) => {
    const key = Number(port) === 2 ? 'port2Rid' : 'port1Rid';
    return String(device?.[key] || device?.[key.toLowerCase()] || device?.rid || '').toUpperCase();
  };
  const groupType = value => {
    if (!value) return null;
    if (typeof groupReceiverType === 'function') return groupReceiverType(value);
    const declared = String(value.receiverType || '').toUpperCase();
    if (declared === 'RGBW' || declared === 'SPI') return declared;
    const first = value.receivers?.[0];
    if (!first) return null;
    const device = (db?.devices || []).find(item => item.id === first.deviceId);
    return deviceType(first?.receiverType ? first : device);
  };
  const isRgbw = value => groupType(value) === 'RGBW';
  const normaliseRgbwState = state => {
    if (typeof rgbwDefaultState === 'function') return rgbwDefaultState(state);
    const current = state || {};
    const alreadyRgbw = String(current.receiverType || '').toUpperCase() === 'RGBW';
    return {
      ...current,
      ...(alreadyRgbw ? {} : { animation: 'Static Color', engine: 'STATIC', variant: 0 }),
      receiverType: 'RGBW', widthPixels: 1, width: 1
    };
  };
  const modeMask = mode => mode === 'port1' ? 1 : mode === 'port2' ? 2 : mode === 'linked' ? 3 : 0;
  const modeFromMask = mask => Number(mask) === 2 ? 'port2' : Number(mask) === 3 ? 'linked' : 'port1';
  const portLabel = port => port === 0
    ? copy('Beide samen', 'Both together', 'Les deux ensemble', 'Beide zusammen')
    : `${copy('Poort', 'Port', 'Port', 'Port')} ${port}`;

  function allAssignments(deviceId) {
    if (typeof receiverAssignments === 'function') return receiverAssignments(deviceId);
    const found = [];
    (db.installations || []).forEach(current => (current.zones || []).forEach(currentZone =>
      (currentZone.groups || []).forEach(currentGroup => (currentGroup.receivers || []).forEach(line => {
        if (line.deviceId === deviceId) found.push({ i: current, z: currentZone, g: currentGroup, r: line });
      }))));
    return found;
  }

  function exactPort(line) {
    return Math.max(1, Math.min(2, Number(line?.port) || 1));
  }

  function defaultRgbwLineId(device, port) {
    return `r-${String(device?.id || device?.rid || 'rgbw')}-p${port}`;
  }

  function rgbwPortRecord(device, port) {
    device.rgbwPortRecords ||= {};
    const number = exactPort({ port });
    if (!device.rgbwPortRecords[number] || typeof device.rgbwPortRecords[number] !== 'object') {
      device.rgbwPortRecords[number] = { id: defaultRgbwLineId(device, number), name: '' };
    }
    return device.rgbwPortRecords[number];
  }

  function rememberRgbwLine(device, item) {
    if (!device || !item?.r) return false;
    const port = exactPort(item.r);
    const record = rgbwPortRecord(device, port);
    const before = JSON.stringify(record);
    const state = item.g?.parallelLineStates?.[item.r.id];
    record.id = String(item.r.id || record.id || defaultRgbwLineId(device, port));
    record.name = String(item.r.name || record.name || '');
    if (state != null) record.state = duplicate(state);
    return before !== JSON.stringify(record);
  }

  function cleanGroupLineMetadata(currentGroup) {
    if (!currentGroup) return;
    const ids = new Set((currentGroup.receivers || []).map(line => line.id));
    ['v21SelectedLineIds', 'parallelSelectedIds'].forEach(key => {
      if (Array.isArray(currentGroup[key])) currentGroup[key] = currentGroup[key].filter(id => ids.has(id));
    });
    if (currentGroup.parallelLineStates && typeof currentGroup.parallelLineStates === 'object') {
      Object.keys(currentGroup.parallelLineStates).forEach(id => {
        if (!ids.has(id)) delete currentGroup.parallelLineStates[id];
      });
    }
    if (!ids.size && currentGroup.receiverType === 'RGBW') currentGroup.receiverType = null;
  }

  function restoreRgbwLineState(device, currentGroup, line) {
    const record = rgbwPortRecord(device, exactPort(line));
    if (record.state == null) return;
    currentGroup.parallelLineStates ||= {};
    currentGroup.parallelLineStates[line.id] = duplicate(record.state);
  }

  function sameGroup(assignments) {
    return assignments.length > 1 && assignments.every(item => item.g.id === assignments[0].g.id);
  }

  function inferDeviceMode(device) {
    const mask = Math.max(1, Math.min(3, Number(device?.portMask) || 3));
    if (mask !== 3) return modeFromMask(mask);
    const assignments = allAssignments(device?.id).filter(item => [1, 2].includes(exactPort(item.r)));
    if (device?.rgbwOutputMode === 'linked' || device?.rgbwLinked === true || sameGroup(assignments)) return 'linked';
    return 'separate';
  }

  function groupPorts(currentGroup) {
    return new Set((currentGroup?.receivers || []).map(exactPort));
  }

  function normalisedGroupScope(currentGroup) {
    const ports = groupPorts(currentGroup);
    const requested = String(currentGroup?.rgbwOutputScope || '');
    if (requested === 'port1' && ports.has(1)) return requested;
    if (requested === 'port2' && ports.has(2)) return requested;
    if (requested === 'both' && ports.has(1) && ports.has(2)) return requested;
    if (ports.has(1) && ports.has(2)) return 'both';
    return ports.has(2) ? 'port2' : 'port1';
  }

  function migrateOutputScope() {
    let dirty = false;
    (db.devices || []).forEach(device => {
      if (deviceType(device) !== 'RGBW') return;
      const inferred = inferDeviceMode(device);
      const mode = ['port1', 'port2', 'linked', 'separate'].includes(device.rgbwOutputMode)
        ? device.rgbwOutputMode : inferred;
      if (device.rgbwOutputMode !== mode) { device.rgbwOutputMode = mode; dirty = true; }
      const linked = mode === 'linked';
      if (device.rgbwLinked !== linked) { device.rgbwLinked = linked; dirty = true; }
      const maps = channelMaps(device);
      if (device.rgbwChannelMaps?.[1] !== maps[1] || device.rgbwChannelMaps?.[2] !== maps[2]) {
        device.rgbwChannelMaps = maps;
        dirty = true;
      }
    });
    (db.installations || []).forEach(current => (current.zones || []).forEach(currentZone =>
      (currentZone.groups || []).forEach(currentGroup => {
        if (!isRgbw(currentGroup)) return;
        const scope = normalisedGroupScope(currentGroup);
        if (currentGroup.rgbwOutputScope !== scope) { currentGroup.rgbwOutputScope = scope; dirty = true; }
      })));
    (db.devices || []).forEach(device => {
      if (deviceType(device) !== 'RGBW') return;
      allAssignments(device.id).forEach(item => { dirty = rememberRgbwLine(device, item) || dirty; });
    });
    if (dirty && typeof save === 'function') save('queued');
  }

  function modeVisual(mode) {
    const on1 = mode !== 'port2';
    const on2 = mode !== 'port1';
    return `<span class="rgbw207-mode-visual ${mode}"><i class="chip">R</i><em></em><i class="rail one ${on1 ? 'on' : ''}"><b></b></i><em></em><i class="rail two ${on2 ? 'on' : ''}"><b></b></i></span>`;
  }

  function modeChoice(mode, selected, disabled = false, handler = '') {
    const title = mode === 'port1' ? copy('Poort 1', 'Port 1', 'Port 1', 'Port 1')
      : mode === 'port2' ? copy('Poort 2', 'Port 2', 'Port 2', 'Port 2')
      : copy('Beide samen', 'Both together', 'Les deux ensemble', 'Beide zusammen');
    const detail = mode === 'linked'
      ? copy('Eén kleur en animatie op beide uitgangen', 'One colour and animation on both outputs', 'Une couleur et une animation sur les deux sorties', 'Eine Farbe und Animation auf beiden Ausgängen')
      : copy('Alleen deze uitgang bedienen', 'Control only this output', 'Piloter uniquement cette sortie', 'Nur diesen Ausgang steuern');
    return `<button type="button" class="rgbw207-mode-choice ${selected ? 'on' : ''}" data-rgbw-mode="${mode}" role="radio" aria-checked="${selected}" ${disabled ? 'disabled' : ''} ${handler ? `onclick="${handler}"` : ''}>${modeVisual(mode)}<span><b>${title}</b><small>${detail}</small></span><strong>${selected ? '✓' : '›'}</strong></button>`;
  }

  function pairModeMarkup(mode) {
    return `<div class="rgbw207-pair-mode-grid" role="radiogroup" aria-label="${copy('Kies de RGBW-uitgang', 'Choose the RGBW output', 'Choisissez la sortie RGBW', 'RGBW-Ausgang wählen')}">
      ${modeChoice('port1', mode === 'port1', false, "rgbw207SetPairMode('port1')")}
      ${modeChoice('port2', mode === 'port2', false, "rgbw207SetPairMode('port2')")}
      ${modeChoice('linked', mode === 'linked', false, "rgbw207SetPairMode('linked')")}
    </div>`;
  }

  function pairRoutePreview(mode) {
    const mask = modeMask(mode);
    const route = port => `<div class="rgbw207-pair-route ${mask & (1 << (port - 1)) ? 'on' : ''}"><span>P${port}</span><i></i><b>LED Line ${port}</b><button class="v187-identify" type="button" onclick="identifyRgbwDraftPort(${port})" aria-label="${copy('Deze uitgang laten knipperen', 'Flash this output', 'Faire clignoter cette sortie', 'Diesen Ausgang blinken lassen')}">✦</button></div>`;
    return `<div class="rgbw207-pair-board ${mode}"><span class="rgbw207-receiver"><small>ALUVISION</small><b>RGBW</b><em>2 ${copy('UITGANGEN', 'OUTPUTS', 'SORTIES', 'AUSGÄNGE')}</em></span><div>${route(1)}${route(2)}</div></div>`;
  }

  const pairStepBase = window.pairStep;
  window.pairStep = function rgbw207PairStep(step) {
    const device = (db.devices || []).find(item => item.id === pairDraft?.deviceId);
    if (activeGuide() || deviceType(device) !== 'RGBW' || Number(step) !== 4) return pairStepBase.apply(this, arguments);
    const mode = ['port1', 'port2', 'linked'].includes(pairDraft.rgbwOutputMode)
      ? pairDraft.rgbwOutputMode : modeFromMask(pairDraft.portMask);
    pairDraft.rgbwOutputMode = mode;
    pairDraft.portMask = modeMask(mode);
    const back = pairDraft.presetGroup ? 1 : 3;
    modal(`<section class="rgbw207-pair-shell"><div class="rgbw-pair-progress"><span class="done">1</span><i></i><span class="done">2</span><i></i><span class="done">3</span><i></i><span class="done">4</span></div><div class="eyebrow">RGBW · ${copy('UITGANG KIEZEN', 'CHOOSE OUTPUT', 'CHOISIR LA SORTIE', 'AUSGANG WÄHLEN')}</div><h1>${copy('Welke LED Line wil je bedienen?', 'Which LED Line do you want to control?', 'Quelle LED Line souhaitez-vous piloter ?', 'Welche LED Line möchtest du steuern?')}</h1><p class="sub">${copy('Kies één uitgang, of koppel beide uitgangen zodat ze altijd exact samen reageren.', 'Choose one output, or link both outputs so they always respond together.', 'Choisissez une sortie ou liez les deux pour qu’elles réagissent toujours ensemble.', 'Wähle einen Ausgang oder verbinde beide, damit sie immer gemeinsam reagieren.')}</p><div id="rgbw207PairPreview">${pairRoutePreview(mode)}</div>${pairModeMarkup(mode)}<div class="rgbw207-linked-note ${mode === 'linked' ? 'show' : ''}" id="rgbw207PairLinkedNote"><i>∞</i><span><b>${copy('Beide uitgangen zijn gekoppeld', 'Both outputs are linked', 'Les deux sorties sont liées', 'Beide Ausgänge sind verbunden')}</b><small>${copy('Eén wijziging gaat met één bevestigde opdracht naar Poort 1 en 2.', 'One change is sent to Ports 1 and 2 as one confirmed command.', 'Une modification est envoyée aux ports 1 et 2 en une commande confirmée.', 'Eine Änderung geht als bestätigter Befehl an Port 1 und 2.')}</small></span></div><footer><button class="button soft" type="button" onclick="pairStep(${back})">← ${copy('Terug', 'Back', 'Retour', 'Zurück')}</button><button class="button" type="button" onclick="finishPairingWizard()">${copy('Receiver toevoegen', 'Add receiver', 'Ajouter le récepteur', 'Receiver hinzufügen')}</button></footer></section>`);
    if (typeof translateExactText === 'function') translateExactText(document.getElementById('modalBody'));
  };
  try { pairStep = window.pairStep; } catch (_) { /* window binding is sufficient */ }

  window.rgbw207SetPairMode = function setPairMode(mode) {
    if (!pairDraft || !['port1', 'port2', 'linked'].includes(mode)) return;
    pairDraft.rgbwOutputMode = mode;
    pairDraft.portMask = modeMask(mode);
    window.pairStep(4);
  };

  const finishPairingBase = window.finishPairingWizard;
  window.finishPairingWizard = async function rgbw207FinishPairing() {
    const device = (db.devices || []).find(item => item.id === pairDraft?.deviceId);
    if (activeGuide() || deviceType(device) !== 'RGBW') return finishPairingBase.apply(this, arguments);
    const mode = ['port1', 'port2', 'linked'].includes(pairDraft.rgbwOutputMode)
      ? pairDraft.rgbwOutputMode : modeFromMask(pairDraft.portMask);
    const mask = modeMask(mode);
    const targetZoneId = pairDraft.zoneId;
    const targetGroupId = pairDraft.groupId;
    pairDraft.portMask = mask;
    const result = await finishPairingBase.apply(this, arguments);
    const selectedZone = (install.zones || []).find(item => item.id === targetZoneId);
    const selectedGroup = selectedZone?.groups?.find(item => item.id === targetGroupId);
    const assignedPorts = allAssignments(device.id).map(item => exactPort(item.r));
    const succeeded = Number(device.portMask) === mask && [...new Set(assignedPorts)].length === (mask === 3 ? 2 : 1);
    if (succeeded) {
      device.rgbwOutputMode = mode;
      device.rgbwLinked = mode === 'linked';
      if (selectedGroup) selectedGroup.rgbwOutputScope = mode === 'linked' ? 'both' : mode;
      save('queued');
      const summary = document.querySelector('#modalBody .rgbw-port-summary small');
      if (summary) summary.textContent = mode === 'linked'
        ? copy('Poort 1 en Poort 2 reageren vanaf nu samen.', 'Ports 1 and 2 now respond together.', 'Les ports 1 et 2 réagissent désormais ensemble.', 'Port 1 und 2 reagieren jetzt gemeinsam.')
        : `${portLabel(mask === 2 ? 2 : 1)} · ${copy('apart bedienbaar', 'controlled independently', 'pilotable séparément', 'separat steuerbar')}`;
    }
    return result;
  };
  try { finishPairingWizard = window.finishPairingWizard; } catch (_) { /* window binding is sufficient */ }

  function groupScopeMarkup(currentGroup) {
    const ports = groupPorts(currentGroup);
    const scope = normalisedGroupScope(currentGroup);
    const bothAvailable = ports.has(1) && ports.has(2);
    return `<section class="card rgbw207-group-scope" data-rgbw-output-scope="${safe(currentGroup.id)}" data-scope="${scope}"><div class="row rgbw207-scope-heading"><span><div class="eyebrow">${copy('LIVE UITGANG', 'LIVE OUTPUT', 'SORTIE EN DIRECT', 'LIVE-AUSGANG')}</div><h2>${copy('Welke LED Line pas je aan?', 'Which LED Line are you adjusting?', 'Quelle LED Line réglez-vous ?', 'Welche LED Line stellst du ein?')}</h2></span><span class="scope" data-rgbw-scope-caption>${scope === 'both' ? copy('BEIDE SAMEN', 'BOTH TOGETHER', 'LES DEUX', 'BEIDE') : portLabel(scope === 'port2' ? 2 : 1).toUpperCase()}</span></div><div class="rgbw207-scope-grid" role="radiogroup">
      ${modeChoice('port1', scope === 'port1', !ports.has(1), `setRgbwOutputScope('${safe(currentGroup.id)}','port1')`)}
      ${modeChoice('port2', scope === 'port2', !ports.has(2), `setRgbwOutputScope('${safe(currentGroup.id)}','port2')`)}
      ${modeChoice('linked', scope === 'both', !bothAvailable, `setRgbwOutputScope('${safe(currentGroup.id)}','both')`)}
    </div><p class="rgbw207-scope-help" data-rgbw-scope-help>${scope === 'both'
      ? copy('Kleur, helderheid en animatie gaan tegelijk naar beide uitgangen.', 'Colour, brightness and animation go to both outputs together.', 'La couleur, l’intensité et l’animation vont aux deux sorties.', 'Farbe, Helligkeit und Animation gehen gemeinsam an beide Ausgänge.')
      : `${portLabel(scope === 'port2' ? 2 : 1)} · ${copy('de andere uitgang blijft ongewijzigd', 'the other output remains unchanged', 'l’autre sortie reste inchangée', 'der andere Ausgang bleibt unverändert')}`}</p></section>`;
  }

  const groupUiBase = window.groupUI;
  window.groupUI = function rgbw207GroupUi() {
    const markup = groupUiBase.apply(this, arguments);
    if (activeGuide() || !isRgbw(group) || typeof markup !== 'string') return markup;
    const template = document.createElement('template');
    template.innerHTML = markup;
    const header = template.content.querySelector('.rgbw-group-head');
    if (header && !template.content.querySelector('[data-rgbw-output-scope]')) header.insertAdjacentHTML('afterend', groupScopeMarkup(group));
    const scope = normalisedGroupScope(group);
    const preview = template.content.querySelector('.rgbw-main-preview,.v18162-main-preview,.preview');
    if (preview) {
      preview.dataset.rgbwScope = scope;
      preview.classList.add('rgbw207-scoped-preview');
      preview.querySelectorAll('.rgbw-preview-lines i').forEach((label, index) => {
        const line = group.receivers?.[index];
        if (line) label.dataset.port = String(exactPort(line));
      });
    }
    return template.innerHTML;
  };
  try { groupUI = window.groupUI; } catch (_) { /* window binding is sufficient */ }

  function scopePanel(groupId) {
    return [...document.querySelectorAll('[data-rgbw-output-scope]')].find(node => node.dataset.rgbwOutputScope === String(groupId));
  }

  function groupById(groupId) {
    for (const current of db.installations || []) for (const currentZone of current.zones || []) {
      const found = (currentZone.groups || []).find(item => item.id === groupId);
      if (found) return found;
    }
    return null;
  }

  function updateScopeDom(currentGroup) {
    const panel = scopePanel(currentGroup.id);
    if (!panel) return;
    const scope = normalisedGroupScope(currentGroup);
    panel.dataset.scope = scope;
    panel.querySelectorAll('[data-rgbw-mode]').forEach(button => {
      const selected = (button.dataset.rgbwMode === 'linked' ? 'both' : button.dataset.rgbwMode) === scope;
      button.classList.toggle('on', selected);
      button.setAttribute('aria-checked', String(selected));
      const marker = button.querySelector(':scope > strong');
      if (marker) marker.textContent = selected ? '✓' : '›';
    });
    const caption = panel.querySelector('[data-rgbw-scope-caption]');
    if (caption) caption.textContent = scope === 'both' ? copy('BEIDE SAMEN', 'BOTH TOGETHER', 'LES DEUX', 'BEIDE') : portLabel(scope === 'port2' ? 2 : 1).toUpperCase();
    const help = panel.querySelector('[data-rgbw-scope-help]');
    if (help) help.textContent = scope === 'both'
      ? copy('Kleur, helderheid en animatie gaan tegelijk naar beide uitgangen.', 'Colour, brightness and animation go to both outputs together.', 'La couleur, l’intensité et l’animation vont aux deux sorties.', 'Farbe, Helligkeit und Animation gehen gemeinsam an beide Ausgänge.')
      : `${portLabel(scope === 'port2' ? 2 : 1)} · ${copy('de andere uitgang blijft ongewijzigd', 'the other output remains unchanged', 'l’autre sortie reste inchangée', 'der andere Ausgang bleibt unverändert')}`;
    const preview = panel.parentElement?.querySelector('.rgbw207-scoped-preview') || document.querySelector('.rgbw207-scoped-preview');
    if (preview) preview.dataset.rgbwScope = scope;
  }

  window.setRgbwOutputScope = function setRgbwOutputScope(groupId, requested) {
    const currentGroup = groupById(groupId);
    if (!currentGroup || !isRgbw(currentGroup)) return;
    const ports = groupPorts(currentGroup);
    const scope = requested === 'port2' ? 'port2' : requested === 'both' ? 'both' : 'port1';
    if ((scope === 'port1' && !ports.has(1)) || (scope === 'port2' && !ports.has(2)) || (scope === 'both' && (!ports.has(1) || !ports.has(2)))) return;
    currentGroup.rgbwOutputScope = scope;
    save('queued');
    updateScopeDom(currentGroup);
  };

  function scopedTargets(currentGroup, requested = normalisedGroupScope(currentGroup)) {
    const all = targets(currentGroup);
    const selectedPort = requested === 'port2' ? 2 : requested === 'port1' ? 1 : 0;
    let routed;
    if (selectedPort) {
      routed = all.filter(target => Number(target.port) === selectedPort).map(target => ({ ...target }));
    } else {
      const byReceiver = new Map();
      all.forEach(target => {
        const key = String(target.physicalRid || target.deviceId || target.rid || '').toUpperCase();
        const bucket = byReceiver.get(key) || [];
        bucket.push(target);
        byReceiver.set(key, bucket);
      });
      routed = [];
      byReceiver.forEach(bucket => {
        const present = new Set(bucket.map(target => Number(target.port)));
        if (present.has(1) && present.has(2)) {
          const first = bucket[0];
          routed.push({ ...first, id: `rgbw-linked-${first.deviceId}`, rid: first.physicalRid || first.rid,
            port: 0, outputPort: 0, portMask: 3, linkedPorts: [1, 2] });
        } else {
          bucket.forEach(target => routed.push({ ...target }));
        }
      });
    }
    const lineCount = Math.max(1, routed.length);
    return routed.map((target, index) => ({ ...target, lineIndex: index, lineCount,
      layoutParallel: lineCount > 1, groupPixels: lineCount, pixels: 1, offset: index }));
  }

  function selectedLineIds(currentGroup, scope) {
    if (scope === 'both') return (currentGroup.receivers || []).map(line => line.id);
    const port = scope === 'port2' ? 2 : 1;
    return (currentGroup.receivers || []).filter(line => exactPort(line) === port).map(line => line.id);
  }

  function syncScopedPreviewState(currentGroup, scope) {
    if (currentGroup.layout !== 'parallel' || typeof ensureParallelLineStates !== 'function') return;
    const states = ensureParallelLineStates(currentGroup);
    selectedLineIds(currentGroup, scope).forEach(id => { states[id] = duplicate(currentGroup.state); });
  }

  function scopeIsVisible(currentGroup) {
    if (!currentGroup || !isRgbw(currentGroup)) return false;
    const panel = scopePanel(currentGroup.id);
    if (!panel || !panel.isConnected) return false;
    const modalHost = panel.closest?.('#modal');
    if (modalHost?.hidden) return false;
    const pageHost = panel.closest?.('.page,[data-page]');
    if (pageHost?.hidden) return false;
    return true;
  }

  async function sendScopedCommand(currentGroup, action = 'live', quiet = false) {
    const scope = normalisedGroupScope(currentGroup);
    syncScopedPreviewState(currentGroup, scope);
    const selected = scopedTargets(currentGroup, scope);
    if (!selected.length) {
      if (!quiet) toast(copy('Deze uitgang zit niet in deze groep', 'This output is not in this group', 'Cette sortie ne fait pas partie de ce groupe', 'Dieser Ausgang ist nicht in dieser Gruppe'));
      return { results: [] };
    }
    const status = document.getElementById('status');
    if (status) status.textContent = `● ${copy('Live wijziging versturen…', 'Sending live change…', 'Envoi de la modification…', 'Live-Änderung wird gesendet…')}`;
    try {
      const timelineId = [install?.id || 'installation', currentGroup.id, 'rgbw', scope].join(':');
      const commandState = state(currentGroup);
      if (scope === 'both') commandState.transitionMs = Math.max(180, Math.min(220, Number(commandState.transitionMs) || 180));
      const response = await api('/api/command', { action, timelineId, state: commandState, targets: selected });
      const results = Array.isArray(response.results) ? response.results : [];
      const strict = results.length === selected.length && selected.length > 0 && results.every(item => item.confirmed === true);
      results.forEach(item => {
        const target = selected.find(candidate => candidate.id === item.id);
        const device = (db.devices || []).find(candidate => candidate.id === target?.deviceId);
        if (!device) return;
        if (item.confirmed) { device.online = true; device.reachableViaGateway = true; }
      });
      save('queued');
      if (status) status.textContent = strict
        ? `● ${copy('Gekozen uitgang bevestigd', 'Selected output confirmed', 'Sortie sélectionnée confirmée', 'Gewählter Ausgang bestätigt')}`
        : `● ${copy('Wijziging nog niet bevestigd', 'Change not yet confirmed', 'Modification pas encore confirmée', 'Änderung noch nicht bestätigt')}`;
      if (!quiet) toast(strict ? copy('Live toegepast', 'Live applied', 'Direct appliqué', 'Live angewendet') : copy('Receiver bevestigde de uitgang niet', 'Receiver did not confirm the output', 'Le récepteur n’a pas confirmé la sortie', 'Receiver hat den Ausgang nicht bestätigt'));
      return response;
    } catch (error) {
      if (status) status.textContent = `● ${copy('Verbinding onderbroken · lokaal bewaard', 'Connection interrupted · saved locally', 'Connexion interrompue · enregistré localement', 'Verbindung unterbrochen · lokal gespeichert')}`;
      if (!quiet) toast(copy('Receiver is niet bereikbaar', 'Receiver is not reachable', 'Le récepteur est inaccessible', 'Receiver ist nicht erreichbar'));
      return { results: [], error: String(error) };
    }
  }

  window.sendRgbwScopedCommand = sendScopedCommand;
  const liveBase = window.live;
  window.live = async function rgbw207Live(currentGroup = group, quiet = false) {
    if (scopeIsVisible(currentGroup)) return sendScopedCommand(currentGroup, 'live', quiet);
    return liveBase.apply(this, arguments);
  };
  try { live = window.live; } catch (_) { /* window binding is sufficient */ }

  const queueLiveBase = typeof queueLive === 'function' ? queueLive : window.queueLive;
  window.queueLive = function rgbw207QueueLive(currentGroup = group) {
    if (!scopeIsVisible(currentGroup)) return queueLiveBase.apply(this, arguments);
    syncScopedPreviewState(currentGroup, normalisedGroupScope(currentGroup));
    save('queued');
    const key = `rgbw-scope:${currentGroup.id}`;
    if (typeof queueLatestThrottle === 'function') return queueLatestThrottle(scopedLiveTimers, key, () => sendScopedCommand(currentGroup, 'live', true), 40);
    clearTimeout(scopedLiveTimers.get(key));
    scopedLiveTimers.set(key, setTimeout(() => sendScopedCommand(currentGroup, 'live', true), 40));
  };
  try { queueLive = window.queueLive; } catch (_) { /* window binding is sufficient */ }

  function groupKey(currentZone, currentGroup) { return `${currentZone.id}::${currentGroup.id}`; }

  function compatibleDestinations(deviceId) {
    const result = [];
    (install?.zones || []).forEach(currentZone => (currentZone.groups || []).forEach(currentGroup => {
      const type = groupType(currentGroup);
      if (!type || type === 'RGBW') result.push({ zone: currentZone, group: currentGroup, key: groupKey(currentZone, currentGroup) });
    }));
    return result;
  }

  function parseDestination(value) {
    return (() => {
      const [zoneId, groupId] = String(value || '').split('::');
      const selectedZone = (install?.zones || []).find(item => item.id === zoneId);
      const selectedGroup = selectedZone?.groups?.find(item => item.id === groupId);
      return selectedZone && selectedGroup ? { zone: selectedZone, group: selectedGroup, key: value } : null;
    })();
  }

  function newRgbwLine(device, port) {
    const record = rgbwPortRecord(device, port);
    return { id: String(record.id || defaultRgbwLineId(device, port)), deviceId: device.id,
      name: String(record.name || `${typeof rgbwReceiverName === 'function' ? rgbwReceiverName(device) : device.name} · ${portLabel(port)}`),
      rid: endpointRid(device, port), physicalRid: device.rid, hardwareId: device.hardwareId, receiverType: 'RGBW', port,
      pixels: 1, reversed: false };
  }

  function modeForDraft(device) {
    const stored = deviceDrafts.get(device.id);
    if (stored) return stored;
    const assignments = allAssignments(device.id);
    const fallback = assignments[0] ? groupKey(assignments[0].z, assignments[0].g) : '';
    const created = { mode: inferDeviceMode(device), destination: fallback };
    deviceDrafts.set(device.id, created);
    return created;
  }

  function assignmentMarkup(device) {
    const byPort = new Map(allAssignments(device.id).map(item => [exactPort(item.r), item]));
    return [1, 2].map(port => {
      const item = byPort.get(port);
      return `<article class="rgbw207-assignment ${item ? 'on' : ''}"><b>P${port}</b><span><strong>LED Line ${port}</strong><small>${item ? `${safe(item.z.name)} → ${safe(item.g.name)}` : copy('Nog niet ingedeeld', 'Not assigned yet', 'Pas encore affectée', 'Noch nicht zugeordnet')}</small></span><button class="v187-identify" type="button" onclick="identifyRgbwPort('${safe(device.id)}',${port})" aria-label="${copy('Deze uitgang laten knipperen', 'Flash this output', 'Faire clignoter cette sortie', 'Diesen Ausgang blinken lassen')}">✦</button></article>`;
    }).join('');
  }

  function deviceModeMarkup(device, draft) {
    return `<div class="rgbw207-device-mode-grid" role="radiogroup">
      ${modeChoice('port1', draft.mode === 'port1', false, `rgbw207SetDeviceMode('${safe(device.id)}','port1')`)}
      ${modeChoice('port2', draft.mode === 'port2', false, `rgbw207SetDeviceMode('${safe(device.id)}','port2')`)}
      ${modeChoice('linked', draft.mode === 'linked', false, `rgbw207SetDeviceMode('${safe(device.id)}','linked')`)}
    </div>`;
  }

  function deviceModeBadge(mode) {
    if (mode === 'separate') return copy('APART INGEDEELD', 'ASSIGNED SEPARATELY', 'AFFECTÉES SÉPARÉMENT', 'GETRENNT ZUGEORDNET');
    return mode === 'linked' ? copy('BEIDE SAMEN', 'BOTH TOGETHER', 'LES DEUX', 'BEIDE')
      : portLabel(mode === 'port2' ? 2 : 1).toUpperCase();
  }

  function separateModeNote(draft) {
    if (draft.mode !== 'separate') return '';
    return `<div class="rgbw207-separate-note"><i>!</i><span><b>${copy('De uitgangen staan nu in verschillende groepen', 'The outputs are currently in different groups', 'Les sorties sont actuellement dans des groupes différents', 'Die Ausgänge sind derzeit verschiedenen Gruppen zugeordnet')}</b><small>${copy('Kies hierboven bewust Poort 1, Poort 2 of Beide samen voordat je de indeling wijzigt.', 'Choose Port 1, Port 2 or Both together above before changing the layout.', 'Choisissez le port 1, le port 2 ou les deux avant de modifier la disposition.', 'Wähle oben Port 1, Port 2 oder Beide, bevor du die Zuordnung änderst.')}</small></span></div>`;
  }

  function destinationMarkup(device, draft) {
    const destinations = compatibleDestinations(device.id);
    const options = destinations.map(item => `<option value="${safe(item.key)}" ${item.key === draft.destination ? 'selected' : ''}>${safe(item.zone.name)} → ${safe(item.group.name)}</option>`).join('');
    return `<div id="rgbw207LinkDestination" class="rgbw207-link-destination" ${draft.mode === 'linked' ? '' : 'hidden'}><label><b>${copy('Groep voor beide uitgangen', 'Group for both outputs', 'Groupe pour les deux sorties', 'Gruppe für beide Ausgänge')}</b><small>${copy('Beide LED Lines worden samen in deze groep geplaatst.', 'Both LED Lines will be placed together in this group.', 'Les deux LED Lines seront placées ensemble dans ce groupe.', 'Beide LED Lines werden gemeinsam in diese Gruppe gelegt.')}</small><select class="field" onchange="rgbw207SetDeviceDestination('${safe(device.id)}',this.value)">${options || `<option value="">${copy('Maak eerst een RGBW-groep', 'Create an RGBW group first', 'Créez d’abord un groupe RGBW', 'Erstelle zuerst eine RGBW-Gruppe')}</option>`}</select></label></div>`;
  }

  const MAP_CHANNELS = Object.freeze(['R', 'G', 'B', 'W']);
  const MAP_TESTS = Object.freeze(['RED', 'GREEN', 'BLUE', 'WHITE']);

  function validChannelMap(value) {
    const map = String(value || '').trim().toUpperCase();
    return map.length === 4 && [...map].sort().join('') === 'BGRW' ? map : '';
  }

  /* RAW tests address the physical PWM outputs in R,G,B,W order.  If physical
     R visibly lights green, logical green must be routed to physical R.  The
     saved MAP therefore is the inverse of the four observed colours. */
  function mapFromObservations(observations) {
    const seen = (observations || []).map(value => String(value || '').toUpperCase());
    if (seen.length !== 4 || new Set(seen).size !== 4 || seen.some(value => !MAP_CHANNELS.includes(value))) return '';
    const inverse = {};
    MAP_CHANNELS.forEach((physical, index) => { inverse[seen[index]] = physical; });
    return MAP_CHANNELS.map(logical => inverse[logical]).join('');
  }

  function channelMaps(device) {
    const stored = device?.rgbwChannelMaps || {};
    return {
      1: validChannelMap(stored[1] || stored['1'] || device?.map1) || 'RGBW',
      2: validChannelMap(stored[2] || stored['2'] || device?.map2) || 'RGBW'
    };
  }

  function rgbwTarget(device, port, prefix = 'rgbw') {
    const mask = Math.max(1, Math.min(3, Number(device.portMask) || 3));
    return { id: `${prefix}-${device.id}-${port}`, deviceId: device.id,
      rid: port === 0 ? String(device.rid || '').toUpperCase() : endpointRid(device, port),
      physicalRid: String(device.rid || '').toUpperCase(), hardwareId: device.hardwareId, receiverType: 'RGBW',
      port, outputPort: port, portMask: mask, port1Rid: endpointRid(device, 1),
      port2Rid: endpointRid(device, 2), pixels: 1, offset: 0, groupPixels: 1,
      lineIndex: 0, lineCount: 1, layoutParallel: false };
  }

  async function sendRgbwTest(device, port, test, raw = false) {
    const response = await api('/api/command', { action: 'rgbw_test',
      state: { receiverType: 'RGBW', test, raw: Boolean(raw) },
      targets: [{ ...rgbwTarget(device, port, raw ? 'rgbw-map-test' : 'rgbw-test'), rawTest: Boolean(raw) }] });
    return response.results?.[0] || null;
  }

  function mapStatusLabel(map) {
    return map === 'RGBW'
      ? copy('Standaard', 'Standard', 'Standard', 'Standard')
      : copy('Gecorrigeerd', 'Corrected', 'Corrigé', 'Korrigiert');
  }

  function calibrationBody(device, mask) {
    const draft = mapDrafts.get(device.id);
    const maps = channelMaps(device);
    if (!draft) {
      return `<div class="rgbw207-map-idle"><p>${copy('Gebruik dit alleen wanneer R, G, B of W op de verkeerde kleur reageert.', 'Use this only when R, G, B or W responds with the wrong colour.', 'Utilisez ceci uniquement si R, G, B ou W produit la mauvaise couleur.', 'Nutze dies nur, wenn R, G, B oder W die falsche Farbe erzeugt.')}</p><div>${[1, 2].map(port => `<button type="button" class="button soft" ${(mask & (1 << (port - 1))) ? '' : 'disabled'} onclick="rgbw207StartMap('${safe(device.id)}',${port})"><span><b>${portLabel(port)}</b><small>${mapStatusLabel(maps[port])} · ${maps[port]}</small></span><i>›</i></button>`).join('')}</div></div>`;
    }
    const physical = MAP_CHANNELS[draft.step] || 'W';
    const testName = MAP_TESTS[draft.step] || 'WHITE';
    if (draft.complete) {
      const map = mapFromObservations(draft.observations);
      return `<div class="rgbw207-map-finish"><div class="rgbw207-map-success"><i>✓</i><span><b>${copy('Kleurvolgorde gevonden', 'Colour order found', 'Ordre des couleurs trouvé', 'Farbreihenfolge gefunden')}</b><small>${portLabel(draft.port)} · ${map}</small></span></div><div class="rgbw207-map-review">${MAP_CHANNELS.map((logical, index) => `<span><i class="${logical.toLowerCase()}">${logical}</i><em>→</em><b>${map[index]}</b></span>`).join('')}</div>${draft.message ? `<p class="rgbw207-map-message" data-state="${safe(draft.state || '')}">${safe(draft.message)}</p>` : ''}<div class="rgbw207-map-actions"><button type="button" class="button soft" ${draft.waiting ? 'disabled' : ''} onclick="rgbw207CancelMap('${safe(device.id)}')">${copy('Annuleren', 'Cancel', 'Annuler', 'Abbrechen')}</button><button type="button" class="button" ${draft.waiting ? 'disabled' : ''} onclick="rgbw207SaveMap('${safe(device.id)}')">${draft.waiting ? copy('Opslaan…', 'Saving…', 'Enregistrement…', 'Speichern…') : copy('Correctie opslaan', 'Save correction', 'Enregistrer la correction', 'Korrektur speichern')}</button></div></div>`;
    }
    const used = new Set(draft.observations.filter(Boolean));
    return `<div class="rgbw207-map-step"><div class="rgbw207-map-progress">${MAP_CHANNELS.map((_, index) => `<i class="${index < draft.step ? 'done' : index === draft.step ? 'on' : ''}"></i>`).join('')}</div><div class="rgbw207-map-question"><span class="rgbw207-raw-channel ${physical.toLowerCase()}">${physical}</span><span><small>${portLabel(draft.port)} · ${copy('testkanaal', 'test channel', 'canal test', 'Testkanal')} ${physical}</small><b>${draft.waiting ? copy('LED Line testen…', 'Testing LED Line…', 'Test de la LED Line…', 'LED Line wird getestet…') : copy('Welke kleur zie je echt?', 'Which colour do you actually see?', 'Quelle couleur voyez-vous réellement ?', 'Welche Farbe siehst du wirklich?')}</b></span></div><div class="rgbw207-observed-colours">${MAP_CHANNELS.map(colour => `<button type="button" class="${colour.toLowerCase()}" ${draft.waiting || draft.state !== 'ok' || used.has(colour) ? 'disabled' : ''} onclick="rgbw207ObserveMap('${safe(device.id)}','${colour}')"><i></i><b>${colour}</b></button>`).join('')}</div><p class="rgbw207-map-message" data-state="${safe(draft.state || '')}">${safe(draft.message || copy(`De receiver test nu aansluiting ${physical}.`, `The receiver is now testing output ${physical}.`, `Le récepteur teste maintenant la sortie ${physical}.`, `Der Receiver testet jetzt Ausgang ${physical}.`))}</p><div class="rgbw207-map-step-actions"><button type="button" class="button soft" onclick="rgbw207CancelMap('${safe(device.id)}')">${copy('Stoppen', 'Stop', 'Arrêter', 'Stoppen')}</button>${draft.state === 'error' ? `<button type="button" class="button" onclick="rgbw207RetryMap('${safe(device.id)}')">${copy('Opnieuw proberen', 'Try again', 'Réessayer', 'Erneut versuchen')}</button>` : ''}</div></div>`;
  }

  function calibrationMarkup(device, mask) {
    const maps = channelMaps(device);
    const active = mapDrafts.has(device.id);
    return `<details class="card rgbw207-map-card" ${active ? 'open' : ''}><summary><span><b>${copy('Kleurvolgorde corrigeren', 'Correct colour order', 'Corriger l’ordre des couleurs', 'Farbreihenfolge korrigieren')}</b><small>P1 · ${mapStatusLabel(maps[1])} &nbsp; P2 · ${mapStatusLabel(maps[2])}</small></span><i>›</i></summary><div id="rgbw207MapCalibration">${calibrationBody(device, mask)}</div></details>`;
  }

  function refreshCalibration(device) {
    const host = document.getElementById('rgbw207MapCalibration');
    if (host) host.innerHTML = calibrationBody(device, Math.max(1, Math.min(3, Number(device.portMask) || 3)));
  }

  async function runRawCalibrationStep(device) {
    const draft = mapDrafts.get(device.id);
    if (!draft || draft.complete || draft.waiting) return;
    draft.waiting = true;
    draft.state = 'working';
    draft.message = copy('Test wordt verstuurd…', 'Sending test…', 'Envoi du test…', 'Test wird gesendet…');
    refreshCalibration(device);
    try {
      const result = await sendRgbwTest(device, draft.port, MAP_TESTS[draft.step], true);
      draft.waiting = false;
      if (result?.confirmed !== true || result?.rawMatch !== true) {
        draft.state = 'error';
        draft.message = copy('Geen bevestiging. Controleer de verbinding en probeer opnieuw.', 'No confirmation. Check the connection and try again.', 'Aucune confirmation. Vérifiez la connexion.', 'Keine Bestätigung. Prüfe die Verbindung.');
      } else {
        draft.state = 'ok';
        draft.message = copy('Kies hieronder de kleur die werkelijk brandt.', 'Choose the colour that actually lights below.', 'Choisissez ci-dessous la couleur réellement allumée.', 'Wähle unten die Farbe, die tatsächlich leuchtet.');
      }
    } catch (_) {
      draft.waiting = false;
      draft.state = 'error';
      draft.message = copy('De kleurtest kon niet worden verstuurd.', 'The colour test could not be sent.', 'Le test couleur n’a pas pu être envoyé.', 'Der Farbtest konnte nicht gesendet werden.');
    }
    refreshCalibration(device);
  }

  window.rgbw207StartMap = function startMap(id, port) {
    const device = (db.devices || []).find(item => item.id === id);
    const selectedPort = Number(port);
    const mask = Math.max(1, Math.min(3, Number(device?.portMask) || 3));
    if (!device || deviceType(device) !== 'RGBW' || ![1, 2].includes(selectedPort) || !(mask & (1 << (selectedPort - 1)))) return;
    if (!reachable(device)) return toast(copy('Deze receiver is niet bereikbaar', 'This receiver is not reachable', 'Ce récepteur est inaccessible', 'Dieser Receiver ist nicht erreichbar'));
    mapDrafts.set(id, { port: selectedPort, step: 0, observations: [], waiting: false, complete: false, state: '', message: '' });
    refreshCalibration(device);
    runRawCalibrationStep(device);
  };

  window.rgbw207ObserveMap = function observeMap(id, observed) {
    const device = (db.devices || []).find(item => item.id === id);
    const draft = mapDrafts.get(id);
    const colour = String(observed || '').toUpperCase();
    if (!device || !draft || draft.waiting || draft.state !== 'ok' || !MAP_CHANNELS.includes(colour) || draft.observations.includes(colour)) return;
    draft.observations[draft.step] = colour;
    if (draft.step >= 3) {
      draft.complete = Boolean(mapFromObservations(draft.observations));
      draft.state = draft.complete ? 'ok' : 'error';
      draft.message = '';
      sendRgbwTest(device, draft.port, 'OFF', false).catch(() => {});
      refreshCalibration(device);
      return;
    }
    draft.step += 1;
    draft.state = '';
    draft.message = '';
    refreshCalibration(device);
    runRawCalibrationStep(device);
  };

  window.rgbw207RetryMap = function retryMap(id) {
    const device = (db.devices || []).find(item => item.id === id);
    const draft = mapDrafts.get(id);
    if (!device || !draft || draft.waiting || draft.complete) return;
    draft.state = '';
    draft.message = '';
    runRawCalibrationStep(device);
  };

  window.rgbw207CancelMap = function cancelMap(id) {
    const device = (db.devices || []).find(item => item.id === id);
    const draft = mapDrafts.get(id);
    mapDrafts.delete(id);
    if (device && draft) sendRgbwTest(device, draft.port, 'OFF', false).catch(() => {});
    if (device) refreshCalibration(device);
  };

  window.rgbw207SaveMap = async function saveMap(id) {
    const device = (db.devices || []).find(item => item.id === id);
    const draft = mapDrafts.get(id);
    const map = mapFromObservations(draft?.observations);
    if (!device || !draft?.complete || !map || ![1, 2].includes(draft.port)) return;
    if (draft.waiting) return;
    if (!reachable(device)) return toast(copy('Deze receiver is niet bereikbaar', 'This receiver is not reachable', 'Ce récepteur est inaccessible', 'Dieser Receiver ist nicht erreichbar'));
    draft.waiting = true;
    refreshCalibration(device);
    try {
      const target = { ...rgbwTarget(device, draft.port, 'rgbw-map-config'), channelMap: map, map };
      const response = await api('/api/command', { action: 'config', state: { receiverType: 'RGBW' }, targets: [target] });
      const result = response.results?.[0];
      if (result?.confirmed !== true || result?.mapMatch !== true || validChannelMap(result?.channelMap) !== map) {
        draft.waiting = false;
        draft.state = 'error';
        draft.message = copy('De receiver bevestigde de kleurvolgorde niet.', 'The receiver did not confirm the colour order.', 'Le récepteur n’a pas confirmé l’ordre des couleurs.', 'Der Receiver hat die Farbreihenfolge nicht bestätigt.');
        refreshCalibration(device);
        return;
      }
      device.rgbwChannelMaps ||= { 1: 'RGBW', 2: 'RGBW' };
      device.rgbwChannelMaps[draft.port] = map;
      allAssignments(id).filter(item => exactPort(item.r) === draft.port).forEach(item => { item.r.rgbwChannelMap = map; });
      mapDrafts.delete(id);
      save();
      window.deviceDiag(id);
      toast(copy(`${portLabel(draft.port)} is gecorrigeerd`, `${portLabel(draft.port)} is corrected`, `${portLabel(draft.port)} est corrigé`, `${portLabel(draft.port)} wurde korrigiert`));
    } catch (_) {
      draft.waiting = false;
      draft.state = 'error';
      draft.message = copy('Opslaan is niet gelukt. De vorige instelling blijft actief.', 'Saving failed. The previous setting remains active.', 'Échec de l’enregistrement. Le réglage précédent reste actif.', 'Speichern fehlgeschlagen. Die vorherige Einstellung bleibt aktiv.');
      refreshCalibration(device);
    }
  };

  const deviceDiagBase = window.deviceDiag;
  window.deviceDiag = function rgbw207DeviceDiag(id) {
    const device = (db.devices || []).find(item => item.id === id);
    if (activeGuide() || deviceType(device) !== 'RGBW') return deviceDiagBase.apply(this, arguments);
    const draft = modeForDraft(device);
    const mask = Math.max(1, Math.min(3, Number(device.portMask) || 3));
    modal(`<section class="rgbw207-device"><button class="button soft" onclick="closeModal()">← ${copy('Receivers', 'Receivers', 'Récepteurs', 'Receiver')}</button><header class="rgbw-device-head"><span><div class="eyebrow">RGBW · 2 ${copy('UITGANGEN', 'OUTPUTS', 'SORTIES', 'AUSGÄNGE')}</div><h1>${safe(typeof customerDeviceName === 'function' ? customerDeviceName(device) : device.name)}</h1><p>1 receiver → ${mask === 3 ? 2 : 1} LED Line${mask === 3 ? 's' : ''}</p></span><span class="pill ${reachable(device) ? 'online' : 'offline'}">● ${reachable(device) ? copy('Bereikbaar', 'Reachable', 'Joignable', 'Erreichbar') : copy('Niet bereikbaar', 'Unavailable', 'Indisponible', 'Nicht erreichbar')}</span></header><section class="card rgbw207-output-mode"><div class="row"><span><h2>${copy('Uitgangen bedienen', 'Control outputs', 'Piloter les sorties', 'Ausgänge steuern')}</h2><p class="sub">${copy('Kies één uitgang of laat beide altijd samen reageren.', 'Choose one output or make both always respond together.', 'Choisissez une sortie ou faites réagir les deux ensemble.', 'Wähle einen Ausgang oder lasse beide gemeinsam reagieren.')}</p></span><span id="rgbw207ModeBadge" class="scope">${deviceModeBadge(draft.mode)}</span></div>${deviceModeMarkup(device, draft)}${separateModeNote(draft)}${destinationMarkup(device, draft)}</section><section class="card"><div class="row"><span><h2>${copy('Waar staan de LED Lines?', 'Where are the LED Lines?', 'Où se trouvent les LED Lines ?', 'Wo sind die LED Lines?')}</h2><p class="sub">${copy('✦ laat precies één fysieke uitgang knipperen.', '✦ flashes exactly one physical output.', '✦ fait clignoter exactement une sortie physique.', '✦ lässt genau einen physischen Ausgang blinken.')}</p></span></div><div class="rgbw207-assignments">${assignmentMarkup(device)}</div></section><footer class="rgbw207-device-footer"><button class="button red" onclick="requestDeleteDevice('${safe(id)}')">${copy('Receiver verwijderen', 'Remove receiver', 'Supprimer le récepteur', 'Receiver entfernen')}</button><button class="button" ${draft.mode === 'separate' ? 'disabled' : ''} onclick="saveRgbwDevicePorts('${safe(id)}')">${draft.mode === 'separate' ? copy('Kies een uitgang', 'Choose an output', 'Choisir une sortie', 'Ausgang wählen') : copy('Keuze opslaan', 'Save selection', 'Enregistrer le choix', 'Auswahl speichern')}</button></footer></section>`);
    const footer = document.querySelector('#modalBody .rgbw207-device-footer');
    if (footer) footer.insertAdjacentHTML('beforebegin', calibrationMarkup(device, mask));
    if (typeof v187ResetModalScroll === 'function') v187ResetModalScroll();
  };

  window.rgbw207SetDeviceMode = function setDeviceMode(id, mode) {
    const device = (db.devices || []).find(item => item.id === id);
    if (!device || deviceSaveBusy.has(id) || !['port1', 'port2', 'linked'].includes(mode)) return;
    const draft = modeForDraft(device);
    draft.mode = mode;
    document.querySelectorAll('.rgbw207-device-mode-grid [data-rgbw-mode]').forEach(button => {
      const selected = button.dataset.rgbwMode === mode;
      button.classList.toggle('on', selected);
      button.setAttribute('aria-checked', String(selected));
      const marker = button.querySelector(':scope > strong');
      if (marker) marker.textContent = selected ? '✓' : '›';
    });
    const destination = document.getElementById('rgbw207LinkDestination');
    if (destination) destination.hidden = mode !== 'linked';
    const badge = document.getElementById('rgbw207ModeBadge');
    if (badge) badge.textContent = deviceModeBadge(mode);
    document.querySelector('.rgbw207-separate-note')?.remove();
    const saveButton = document.querySelector('.rgbw207-device-footer .button:not(.red)');
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = copy('Keuze opslaan', 'Save selection', 'Enregistrer le choix', 'Auswahl speichern');
    }
  };

  window.rgbw207SetDeviceDestination = function setDeviceDestination(id, value) {
    const device = (db.devices || []).find(item => item.id === id);
    if (device && !deviceSaveBusy.has(id)) modeForDraft(device).destination = String(value || '');
  };

  function removeExactLine(item, device) {
    if (device) rememberRgbwLine(device, item);
    item.g.receivers = (item.g.receivers || []).filter(line => line.id !== item.r.id);
    cleanGroupLineMetadata(item.g);
  }

  function assertRgbwGroup(currentGroup) {
    if (!currentGroup) return;
    const existingType = groupType(currentGroup);
    if (existingType && existingType !== 'RGBW') throw new Error(copy('Deze groep bevat SPI LED Lines', 'This group contains SPI LED Lines', 'Ce groupe contient des LED Lines SPI', 'Diese Gruppe enthält SPI LED Lines'));
  }

  function ensureRgbwGroup(currentGroup) {
    if (!currentGroup) return;
    assertRgbwGroup(currentGroup);
    currentGroup.receiverType = 'RGBW';
    currentGroup.state = normaliseRgbwState(currentGroup.state);
  }

  function resolveDeviceModeDestination(device, draft) {
    const previous = allAssignments(device.id);
    const byPort = new Map();
    previous.forEach(item => { if (!byPort.has(exactPort(item.r))) byPort.set(exactPort(item.r), item); });
    const fallback = parseDestination(draft.destination) || (previous[0]
      ? { zone: previous[0].z, group: previous[0].g, key: groupKey(previous[0].z, previous[0].g) }
      : null);
    let destinationGroup = null;
    if (draft.mode === 'linked') {
      if (!fallback) throw new Error(copy('Kies eerst een RGBW-groep voor beide uitgangen', 'First choose an RGBW group for both outputs', 'Choisissez d’abord un groupe RGBW pour les deux sorties', 'Wähle zuerst eine RGBW-Gruppe für beide Ausgänge'));
      destinationGroup = fallback.group;
      assertRgbwGroup(destinationGroup);
    } else {
      const selectedPort = draft.mode === 'port2' ? 2 : 1;
      const destination = byPort.get(selectedPort) || fallback;
      if (!destination) throw new Error(copy('Kies eerst een RGBW-groep voor deze uitgang', 'First choose an RGBW group for this output', 'Choisissez d’abord un groupe RGBW pour cette sortie', 'Wähle zuerst eine RGBW-Gruppe für diesen Ausgang'));
      destinationGroup = destination.g || destination.group;
      assertRgbwGroup(destinationGroup);
    }
    return { previous, byPort, fallback, destinationGroup };
  }

  function assignmentSignature(deviceId) {
    return allAssignments(deviceId).map(item => [
      item.i?.id || '', item.z?.id || '', item.g?.id || '', item.r?.id || '', exactPort(item.r),
      Math.max(0, (item.g?.receivers || []).findIndex(line => line.id === item.r?.id))
    ].join(':')).join('|');
  }

  function groupIsStillAttached(location, selectedGroup) {
    return Boolean(location && selectedGroup && (location.zones || []).some(currentZone =>
      (currentZone.groups || []).some(currentGroup => currentGroup === selectedGroup)));
  }

  function applyDeviceMode(device, draft) {
    const mask = modeMask(draft.mode);
    const { previous, byPort, fallback, destinationGroup } = resolveDeviceModeDestination(device, draft);
    previous.forEach(item => {
      item.index = Math.max(0, (item.g.receivers || []).findIndex(line => line.id === item.r.id));
      rememberRgbwLine(device, item);
    });
    const selectionSnapshot = new Map([...new Set(previous.map(item => item.g))].map(currentGroup => [currentGroup, {
      v21SelectedLineIds: Array.isArray(currentGroup.v21SelectedLineIds) ? [...currentGroup.v21SelectedLineIds] : null,
      parallelSelectedIds: Array.isArray(currentGroup.parallelSelectedIds) ? [...currentGroup.parallelSelectedIds] : null
    }]));
    const selectedPorts = draft.mode === 'linked' ? [1, 2] : [draft.mode === 'port2' ? 2 : 1];
    const previousInDestination = previous.filter(item => item.g === destinationGroup);
    const insertAt = previousInDestination.length
      ? Math.min(...previousInDestination.map(item => item.index))
      : (destinationGroup.receivers || []).length;
    const lines = selectedPorts.map(port => {
      const prior = byPort.get(port)?.r;
      const line = prior || newRgbwLine(device, port);
      const record = rgbwPortRecord(device, port);
      Object.assign(line, {
        id: String(line.id || record.id || defaultRgbwLineId(device, port)), deviceId: device.id,
        name: String(line.name || record.name || `${device.name || 'Receiver'} · ${portLabel(port)}`),
        rid: endpointRid(device, port), physicalRid: device.rid, hardwareId: device.hardwareId,
        receiverType: 'RGBW', port, pixels: 1, reversed: false
      });
      return line;
    });
    previous.forEach(item => removeExactLine(item, device));
    ensureRgbwGroup(destinationGroup);
    destinationGroup.receivers ||= [];
    destinationGroup.receivers.splice(Math.min(insertAt, destinationGroup.receivers.length), 0, ...lines);
    lines.forEach(line => {
      restoreRgbwLineState(device, destinationGroup, line);
      rememberRgbwLine(device, { r: line, g: destinationGroup });
      const prior = byPort.get(exactPort(line));
      const priorSelection = prior?.g === destinationGroup ? selectionSnapshot.get(destinationGroup) : null;
      ['v21SelectedLineIds', 'parallelSelectedIds'].forEach(key => {
        if (!priorSelection?.[key]?.includes(line.id)) return;
        destinationGroup[key] ||= [];
        if (!destinationGroup[key].includes(line.id)) destinationGroup[key].push(line.id);
      });
    });
    if (draft.mode === 'linked') {
      destinationGroup.rgbwOutputScope = 'both';
    } else {
      destinationGroup.rgbwOutputScope = draft.mode;
    }
    device.portMask = mask;
    device.portCount = 2;
    device.receiverType = 'RGBW';
    device.rgbwOutputMode = draft.mode;
    device.rgbwLinked = draft.mode === 'linked';
    (install?.zones || []).forEach(currentZone => (currentZone.groups || []).forEach(currentGroup => {
      if (isRgbw(currentGroup)) currentGroup.rgbwOutputScope = normalisedGroupScope(currentGroup);
    }));
  }

  window.saveRgbwDevicePorts = async function saveRgbwDevicePorts207(id) {
    const device = (db.devices || []).find(item => item.id === id);
    if (!device) return;
    if (deviceSaveBusy.has(id)) return;
    if (!reachable(device)) return toast(copy('Verbind eerst met de receiver en probeer opnieuw', 'Connect to the receiver first and try again', 'Connectez d’abord le récepteur', 'Verbinde zuerst den Receiver'));
    const draft = modeForDraft(device);
    if (!['port1', 'port2', 'linked'].includes(draft.mode)) {
      return toast(copy('Kies eerst Poort 1, Poort 2 of Beide samen', 'First choose Port 1, Port 2 or Both together', 'Choisissez d’abord le port 1, le port 2 ou les deux', 'Wähle zuerst Port 1, Port 2 oder Beide'));
    }
    const requested = { mode: draft.mode, destination: draft.destination };
    const mask = modeMask(requested.mode);
    try {
      const database = db;
      const location = install;
      const preflight = resolveDeviceModeDestination(device, requested);
      const beforeAssignments = assignmentSignature(id);
      const beforeDeviceMode = `${Number(device.portMask) || 0}:${String(device.rgbwOutputMode || '')}:${Boolean(device.rgbwLinked)}`;
      deviceSaveBusy.add(id);
      const target = { id: `rgbw-config-${id}`, deviceId: id, rid: String(device.rid || '').toUpperCase(),
        physicalRid: String(device.rid || '').toUpperCase(), hardwareId: device.hardwareId, receiverType: 'RGBW',
        port: 0, outputPort: 0, portMask: mask, port1Rid: endpointRid(device, 1),
        port2Rid: endpointRid(device, 2), pixels: 1, offset: 0, groupPixels: 1 };
      const response = await api('/api/command', { action: 'config', state: { receiverType: 'RGBW' }, targets: [target] });
      const result = response.results?.[0];
      if (!result?.confirmed) return toast(copy('De receiver bevestigde de uitgangen niet', 'The receiver did not confirm the outputs', 'Le récepteur n’a pas confirmé les sorties', 'Der Receiver hat die Ausgänge nicht bestätigt'));
      const currentDeviceMode = `${Number(device.portMask) || 0}:${String(device.rgbwOutputMode || '')}:${Boolean(device.rgbwLinked)}`;
      if (db !== database || install !== location || !(database.devices || []).includes(device) ||
          !groupIsStillAttached(location, preflight.destinationGroup) || assignmentSignature(id) !== beforeAssignments ||
          currentDeviceMode !== beforeDeviceMode) {
        return toast(copy('De receiver of indeling is intussen gewijzigd. Open de uitgangen opnieuw.', 'The receiver or assignment changed. Open the outputs again.', 'Le récepteur ou l’affectation a changé. Rouvrez les sorties.', 'Receiver oder Zuordnung wurden geändert. Öffne die Ausgänge erneut.'));
      }
      const currentPlan = resolveDeviceModeDestination(device, requested);
      if (currentPlan.destinationGroup !== preflight.destinationGroup) {
        return toast(copy('De gekozen groep is intussen gewijzigd. Kies de groep opnieuw.', 'The selected group changed. Choose the group again.', 'Le groupe sélectionné a changé. Choisissez-le à nouveau.', 'Die gewählte Gruppe wurde geändert. Wähle sie erneut.'));
      }
      if (draft.mode !== requested.mode || draft.destination !== requested.destination) {
        return toast(copy('Je keuze is gewijzigd. Controleer de uitgangen en sla opnieuw op.', 'Your selection changed. Check the outputs and save again.', 'Votre choix a changé. Vérifiez les sorties puis enregistrez à nouveau.', 'Deine Auswahl hat sich geändert. Prüfe die Ausgänge und speichere erneut.'));
      }
      applyDeviceMode(device, requested);
      save();
      deviceDrafts.delete(id);
      window.deviceDiag(id);
      toast(copy('Uitgangen veilig opgeslagen', 'Outputs saved safely', 'Sorties enregistrées', 'Ausgänge sicher gespeichert'));
    } catch (error) {
      toast(String(error?.message || error));
    } finally {
      deviceSaveBusy.delete(id);
    }
  };

  document.head.insertAdjacentHTML('beforeend', `<style>
    .rgbw207-pair-shell,.rgbw207-device{display:grid;gap:14px;min-width:0}.rgbw207-pair-shell footer,.rgbw207-device-footer{display:flex;justify-content:space-between;gap:9px}.rgbw207-pair-mode-grid,.rgbw207-device-mode-grid,.rgbw207-scope-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.rgbw207-mode-choice{min-width:0;display:grid;grid-template-columns:74px minmax(0,1fr) 23px;gap:10px;align-items:center;min-height:88px;padding:10px;border:1px solid var(--line);border-radius:17px;background:var(--panel);color:var(--ink);text-align:left;cursor:pointer;transition:border-color .16s,box-shadow .16s,transform .16s}.rgbw207-mode-choice:hover{transform:translateY(-1px)}.rgbw207-mode-choice.on{border-color:var(--red);box-shadow:0 0 0 3px color-mix(in srgb,var(--red),transparent 87%)}.rgbw207-mode-choice:disabled{opacity:.38;cursor:not-allowed;transform:none}.rgbw207-mode-choice>span:nth-child(2) b,.rgbw207-mode-choice>span:nth-child(2) small{display:block}.rgbw207-mode-choice>span:nth-child(2) small{margin-top:3px;color:var(--mut);font-size:9px;line-height:1.35}.rgbw207-mode-choice>strong{color:var(--red);font-size:17px}.rgbw207-mode-visual{display:grid;grid-template-columns:20px 5px 1fr;grid-template-rows:1fr 1fr;gap:4px;align-items:center;width:74px;height:48px;padding:5px;border-radius:11px;background:#121412;color:#fff}.rgbw207-mode-visual .chip{grid-row:1/3;display:grid;place-items:center;width:20px;height:32px;border-radius:7px;background:#343734;font-size:8px;font-style:normal}.rgbw207-mode-visual>em{height:2px;background:#555;border-radius:99px}.rgbw207-mode-visual .rail{position:relative;height:8px;border-radius:99px;background:#303330;overflow:hidden;opacity:.22}.rgbw207-mode-visual .rail b{position:absolute;inset:0;background:linear-gradient(90deg,#c94e46,#fff,#c94e46);background-size:220% 100%;animation:rgbw207Route 1.8s linear infinite}.rgbw207-mode-visual .rail.on{opacity:1;box-shadow:0 0 9px #fff5}.rgbw207-mode-visual.port1 .rail.two,.rgbw207-mode-visual.port2 .rail.one{opacity:.12}.rgbw207-pair-board{display:grid;grid-template-columns:120px minmax(0,1fr);gap:16px;align-items:center;padding:15px;border-radius:19px;background:linear-gradient(145deg,#292b29,#111312);color:#fff}.rgbw207-receiver{display:grid;place-items:center;align-content:center;min-height:112px;border:1px solid #ffffff22;border-radius:15px;background:#202320}.rgbw207-receiver small,.rgbw207-receiver em{color:#aeb3ad;font-size:8px;font-style:normal;letter-spacing:1px}.rgbw207-receiver b{margin:6px 0;font-size:20px}.rgbw207-pair-board>div{display:grid;gap:8px}.rgbw207-pair-route{display:grid;grid-template-columns:34px minmax(18px,1fr) auto 38px;gap:8px;align-items:center;opacity:.24}.rgbw207-pair-route.on{opacity:1}.rgbw207-pair-route>span{display:grid;place-items:center;width:34px;height:30px;border-radius:9px;background:#3a3d3a;font-size:9px;font-weight:950}.rgbw207-pair-route>i{height:3px;border-radius:99px;background:linear-gradient(90deg,var(--red),#fff);background-size:180% 100%;animation:rgbw207Route 1.6s linear infinite}.rgbw207-pair-route>b{font-size:10px}.rgbw207-pair-route .v187-identify{background:#fff;color:#222}.rgbw207-linked-note{display:none;grid-template-columns:38px minmax(0,1fr);gap:10px;align-items:center;padding:11px;border-radius:14px;background:color-mix(in srgb,var(--red),var(--panel) 93%)}.rgbw207-linked-note.show{display:grid}.rgbw207-linked-note>i{display:grid;place-items:center;width:38px;height:38px;border-radius:11px;background:var(--red);color:#fff;font-size:20px;font-style:normal}.rgbw207-linked-note b,.rgbw207-linked-note small{display:block}.rgbw207-linked-note small{margin-top:2px;color:var(--mut);font-size:9px;line-height:1.4}
    .rgbw207-group-scope{display:grid;gap:10px;margin:0;box-shadow:none;background:linear-gradient(140deg,var(--panel),color-mix(in srgb,var(--red),var(--panel) 97%))}.rgbw207-scope-heading h2{margin:2px 0}.rgbw207-scope-help{margin:0;color:var(--mut);font-size:10px;text-align:center}.rgbw207-scoped-preview[data-rgbw-scope="port1"] .rgbw-preview-lines i[data-port="2"],.rgbw207-scoped-preview[data-rgbw-scope="port2"] .rgbw-preview-lines i[data-port="1"]{opacity:.28}.rgbw207-scoped-preview .rgbw-preview-lines i{transition:opacity .16s}.rgbw207-link-destination{margin-top:10px;padding:11px;border-radius:14px;background:var(--panel-2)}.rgbw207-link-destination[hidden]{display:none}.rgbw207-link-destination label b,.rgbw207-link-destination label small{display:block}.rgbw207-link-destination label small{margin:3px 0 8px;color:var(--mut);font-size:9px}.rgbw207-link-destination select{width:100%}.rgbw207-assignments{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.rgbw207-assignment{display:grid;grid-template-columns:38px minmax(0,1fr) 38px;gap:9px;align-items:center;padding:9px;border:1px solid var(--line);border-radius:14px;background:var(--panel);opacity:.55}.rgbw207-assignment.on{opacity:1}.rgbw207-assignment>b{display:grid;place-items:center;width:38px;height:38px;border-radius:11px;background:#202320;color:#fff;font-size:10px}.rgbw207-assignment strong,.rgbw207-assignment small{display:block}.rgbw207-assignment small{margin-top:2px;color:var(--mut);font-size:9px}.rgbw207-device-footer{position:sticky;bottom:-1px;z-index:3;padding-top:10px;background:linear-gradient(transparent,var(--panel) 18%)}
    body.dark .rgbw207-group-scope{background:linear-gradient(140deg,#222522,#302322)}
    @keyframes rgbw207Route{to{background-position:-220% 0}}
    @media(max-width:760px){.rgbw207-pair-mode-grid,.rgbw207-device-mode-grid,.rgbw207-scope-grid{grid-template-columns:1fr}.rgbw207-mode-choice{grid-template-columns:72px minmax(0,1fr) 22px;min-height:76px}.rgbw207-assignments{grid-template-columns:1fr}.rgbw207-device-footer{display:grid;grid-template-columns:1fr 1fr}.rgbw207-device-footer .button{min-width:0}}
    @media(max-width:430px){.rgbw207-pair-board{grid-template-columns:82px minmax(0,1fr);gap:9px;padding:10px}.rgbw207-receiver{min-height:99px}.rgbw207-pair-route{grid-template-columns:29px minmax(12px,1fr) auto 34px;gap:5px}.rgbw207-pair-route>span{width:29px;height:28px}.rgbw207-pair-route>b{font-size:8px}.rgbw207-pair-shell footer{display:grid;grid-template-columns:.75fr 1.25fr}.rgbw207-pair-shell footer .button{min-width:0;padding-inline:7px}.rgbw207-device-footer{grid-template-columns:1fr}.rgbw207-device-footer .button{width:100%}.rgbw207-scope-heading{align-items:flex-start}.rgbw207-scope-heading>.scope{font-size:7px}}
    @media(prefers-reduced-motion:reduce){.rgbw207-mode-visual .rail b,.rgbw207-pair-route>i{animation:none}.rgbw207-mode-choice{transition:none}}
  </style>`);

  document.head.insertAdjacentHTML('beforeend', `<style>
    .rgbw207-separate-note{display:grid;grid-template-columns:34px minmax(0,1fr);gap:9px;align-items:center;margin-top:10px;padding:10px;border-radius:13px;background:#fff3df;color:#74531c}.rgbw207-separate-note>i{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:#d99a36;color:#fff;font-style:normal;font-weight:950}.rgbw207-separate-note b,.rgbw207-separate-note small{display:block}.rgbw207-separate-note small{margin-top:2px;font-size:9px;line-height:1.4}
    .rgbw207-map-card{padding:0;overflow:hidden}.rgbw207-map-card>summary{display:grid;grid-template-columns:minmax(0,1fr) 24px;gap:10px;align-items:center;min-height:62px;padding:13px 15px;cursor:pointer;list-style:none}.rgbw207-map-card>summary::-webkit-details-marker{display:none}.rgbw207-map-card>summary span b,.rgbw207-map-card>summary span small{display:block}.rgbw207-map-card>summary span small{margin-top:3px;color:var(--mut);font-size:9px}.rgbw207-map-card>summary>i{display:grid;place-items:center;color:var(--mut);font-style:normal;font-size:18px;transition:transform .16s}.rgbw207-map-card[open]>summary>i{transform:rotate(90deg)}.rgbw207-map-card>#rgbw207MapCalibration{padding:0 15px 15px;border-top:1px solid var(--line)}
    .rgbw207-map-idle>p{margin:12px 0;color:var(--mut);font-size:10px;line-height:1.45}.rgbw207-map-idle>div{display:grid;grid-template-columns:1fr 1fr;gap:8px}.rgbw207-map-idle .button{display:flex;justify-content:space-between;min-width:0;text-align:left}.rgbw207-map-idle .button span b,.rgbw207-map-idle .button span small{display:block}.rgbw207-map-idle .button span small{margin-top:2px;color:var(--mut);font-size:8px}.rgbw207-map-idle .button i{font-style:normal}
    .rgbw207-map-step,.rgbw207-map-finish{display:grid;gap:11px;padding-top:13px}.rgbw207-map-progress{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}.rgbw207-map-progress i{height:4px;border-radius:99px;background:var(--line)}.rgbw207-map-progress i.on{background:var(--red);box-shadow:0 0 8px color-mix(in srgb,var(--red),transparent 40%)}.rgbw207-map-progress i.done{background:#2f8056}.rgbw207-map-question{display:grid;grid-template-columns:54px minmax(0,1fr);gap:11px;align-items:center}.rgbw207-map-question>span:last-child small,.rgbw207-map-question>span:last-child b{display:block}.rgbw207-map-question>span:last-child small{color:var(--mut);font-size:9px}.rgbw207-map-question>span:last-child b{margin-top:3px;font-size:15px}.rgbw207-raw-channel{display:grid;place-items:center;width:54px;height:54px;border-radius:16px;background:#252825;color:#fff;font-size:20px;font-weight:950}.rgbw207-raw-channel.r{background:#c93e38}.rgbw207-raw-channel.g{background:#2c865a}.rgbw207-raw-channel.b{background:#296fc1}.rgbw207-raw-channel.w{background:#fff;color:#222;border:1px solid var(--line)}
    .rgbw207-observed-colours{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.rgbw207-observed-colours button{display:grid;grid-template-columns:18px auto;gap:6px;align-items:center;justify-content:center;min-height:48px;border:1px solid var(--line);border-radius:13px;background:var(--panel);color:var(--ink)}.rgbw207-observed-colours button i{width:18px;height:18px;border-radius:7px;background:currentColor}.rgbw207-observed-colours .r{color:#cf443d}.rgbw207-observed-colours .g{color:#27885a}.rgbw207-observed-colours .b{color:#2a73c7}.rgbw207-observed-colours .w i{background:#fff;border:1px solid #bbb}.rgbw207-observed-colours button:disabled{opacity:.25}.rgbw207-map-message{margin:0;padding:9px 11px;border-radius:11px;background:var(--panel-2);color:var(--mut);font-size:9px}.rgbw207-map-message[data-state="ok"]{background:#e8f5ed;color:#276744}.rgbw207-map-message[data-state="error"]{background:#f8e9e7;color:#913f37}
    .rgbw207-map-success{display:grid;grid-template-columns:38px minmax(0,1fr);gap:10px;align-items:center}.rgbw207-map-success>i{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:#2f8056;color:#fff;font-style:normal;font-weight:950}.rgbw207-map-success b,.rgbw207-map-success small{display:block}.rgbw207-map-success small{margin-top:2px;color:var(--mut)}.rgbw207-map-review{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.rgbw207-map-review>span{display:grid;grid-template-columns:25px auto 25px;gap:3px;align-items:center;justify-content:center;padding:7px 3px;border-radius:11px;background:var(--panel-2)}.rgbw207-map-review i,.rgbw207-map-review b{display:grid;place-items:center;width:25px;height:25px;border-radius:8px;font-style:normal}.rgbw207-map-review i{background:#292c29;color:#fff}.rgbw207-map-review em{color:var(--mut);font-style:normal}.rgbw207-map-actions,.rgbw207-map-step-actions{display:grid;grid-template-columns:1fr 1.25fr;gap:8px}.rgbw207-map-step-actions>.button:only-child{grid-column:1/-1}
    body.dark .rgbw207-separate-note{background:#3b301e;color:#f0d19c}body.dark .rgbw207-map-message[data-state="ok"]{background:#183326;color:#9ed8b8}body.dark .rgbw207-map-message[data-state="error"]{background:#3b211f;color:#efaca5}
    @media(max-width:430px){.rgbw207-map-idle>div{grid-template-columns:1fr}.rgbw207-observed-colours{grid-template-columns:repeat(2,1fr)}.rgbw207-map-review{grid-template-columns:repeat(2,1fr)}.rgbw207-map-actions,.rgbw207-map-step-actions{grid-template-columns:1fr}.rgbw207-map-card>summary{padding-inline:12px}.rgbw207-map-card>#rgbw207MapCalibration{padding-inline:12px}}
  </style>`);

  migrateOutputScope();

  window.AluvisionRgbwOutputScope = Object.freeze({
    version: VERSION,
    modeFromMask,
    maskForMode: modeMask,
    normalisedGroupScope,
    scopedTargets,
    inferDeviceMode,
    validChannelMap,
    mapFromObservations
  });
})();
