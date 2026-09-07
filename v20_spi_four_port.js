/* Aluvision 20.7 — four-output SPI app model and customer UI.
 * One physical receiver keeps one RID. PORT 1..4 identifies its logical
 * LED Lines; old records without PORT are migrated to PORT 1 only. */
(() => {
  'use strict';

  const PORTS = Object.freeze([1, 2, 3, 4]);
  const tx = (nl, en, fr, de) => typeof window.ac === 'function' ? ac(nl, en, fr, de) : nl;
  const safe = (value) => typeof window.esc === 'function' ? esc(String(value ?? '')) : String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const clamp = (value, minimum, maximum, fallback = minimum) => {
    const parsed = Number(value);
    return Math.max(minimum, Math.min(maximum, Number.isFinite(parsed) ? Math.round(parsed) : fallback));
  };
  const typeOf = (value) => typeof window.receiverTypeOf === 'function'
    ? receiverTypeOf(value) : String(value?.receiverType || 'SPI').toUpperCase();
  const capacityOf = (device) => Number(device?.portCapacity ?? device?.portCapability ?? device?.PORTCAP ?? device?.spiPortCapability) === 4 ? 4 : 1;
  const maskOf = (device) => capacityOf(device) === 4 ? clamp(device?.portMask, 1, 15, 1) : 1;
  const countOf = (device) => PORTS.slice(0, capacityOf(device)).filter((port) => maskOf(device) & (1 << (port - 1))).length;
  const portSettings = (device, port) => device?.spiPorts?.[port] || device?.spiPorts?.[String(port)] || {
    pixels: port === 1 ? clamp(device?.pixels, 1, 1024, 25) : 25,
    reversed: port === 1 ? Boolean(device?.reversed ?? device?.physicalReverse) : false
  };
  const reachable = (device) => typeof window.receiverReachable === 'function'
    ? receiverReachable(device) : Boolean(device?.online || device?.reachableViaGateway || device?.espNowReachable);
  const duplicate = (value) => {
    if (value == null) return value;
    try { return typeof window.clone === 'function' ? clone(value) : JSON.parse(JSON.stringify(value)); }
    catch (_) { return value; }
  };

  function ensurePortSetting(device, port) {
    device.spiPorts ||= {};
    const number = capacityOf(device) === 4 ? clamp(port, 1, 4, 1) : 1;
    if (!device.spiPorts[number] || typeof device.spiPorts[number] !== 'object') {
      const fallback = portSettings(device, number);
      device.spiPorts[number] = {
        pixels: clamp(fallback?.pixels, 1, 1024, number === 1 ? clamp(device?.pixels, 1, 1024, 25) : 25),
        reversed: Boolean(fallback?.reversed)
      };
    }
    return device.spiPorts[number];
  }

  function defaultPortLineId(device, port) {
    return `r-${String(device?.id || device?.rid || 'spi')}-p${port}`;
  }

  function rememberPortLine(device, port, line, sourceGroup) {
    if (!device || !line) return false;
    const setting = ensurePortSetting(device, port);
    const before = JSON.stringify(setting.savedLine || null);
    const prior = setting.savedLine && typeof setting.savedLine === 'object' ? setting.savedLine : {};
    const state = sourceGroup?.parallelLineStates?.[line.id];
    setting.savedLine = {
      ...prior,
      id: String(line.id || prior.id || defaultPortLineId(device, port)),
      name: String(line.name || prior.name || ''),
      ...(state != null ? { state: duplicate(state) } : {})
    };
    return before !== JSON.stringify(setting.savedLine);
  }

  function rememberedPortLine(device, port) {
    const setting = ensurePortSetting(device, port);
    const saved = setting.savedLine && typeof setting.savedLine === 'object' ? setting.savedLine : {};
    return {
      id: String(saved.id || defaultPortLineId(device, port)),
      name: String(saved.name || `${device.name} · ${tx('Poort', 'Port', 'Port', 'Port')} ${port}`),
      state: saved.state != null ? duplicate(saved.state) : null
    };
  }

  function cleanGroupLineMetadata(selectedGroup) {
    if (!selectedGroup) return;
    const ids = new Set((selectedGroup.receivers || []).map((line) => line.id));
    ['v21SelectedLineIds', 'parallelSelectedIds'].forEach((key) => {
      if (Array.isArray(selectedGroup[key])) selectedGroup[key] = selectedGroup[key].filter((id) => ids.has(id));
    });
    if (selectedGroup.parallelLineStates && typeof selectedGroup.parallelLineStates === 'object') {
      Object.keys(selectedGroup.parallelLineStates).forEach((id) => {
        if (!ids.has(id)) delete selectedGroup.parallelLineStates[id];
      });
    }
    if (!ids.size && selectedGroup.receiverType === 'SPI') selectedGroup.receiverType = null;
  }

  function restoreRememberedPortState(selectedGroup, line, device, port) {
    const saved = rememberedPortLine(device, port);
    if (saved.state == null) return;
    selectedGroup.parallelLineStates ||= {};
    selectedGroup.parallelLineStates[line.id] = duplicate(saved.state);
  }

  function everyAssignment() {
    return (db?.installations || []).flatMap((location) => (location.zones || []).flatMap((selectedZone) =>
      (selectedZone.groups || []).flatMap((selectedGroup) => (selectedGroup.receivers || []).map((line) => ({ location, zone: selectedZone, group: selectedGroup, line })) )));
  }

  function assignmentsFor(deviceId, port = 0) {
    return everyAssignment().filter((entry) => entry.line.deviceId === deviceId && (!port || Number(entry.line.port || 1) === Number(port)));
  }

  function migrate() {
    let changed = false;
    (db?.devices || []).forEach((device) => {
      if (typeOf(device) !== 'SPI') return;
      const capacity = capacityOf(device);
      if (Number(device.portCapacity) !== capacity) { device.portCapacity = capacity; changed = true; }
      if (!device.spiPorts || typeof device.spiPorts !== 'object' || Array.isArray(device.spiPorts)) {
        device.spiPorts = { 1: { pixels: clamp(device.pixels, 1, 1024, 25), reversed: Boolean(device.reversed ?? device.physicalReverse) } };
        changed = true;
      }
      if (capacity === 1 && Number(device.portMask) !== 1) { device.portMask = 1; changed = true; }
      const activeCount = countOf(device);
      if (Number(device.activePortCount) !== activeCount) { device.activePortCount = activeCount; changed = true; }
      if (Number(device.portCount) !== activeCount) { device.portCount = activeCount; changed = true; }
    });
    everyAssignment().forEach(({ group: selectedGroup, line }) => {
      if (typeOf(line) !== 'SPI') return;
      if (!PORTS.includes(Number(line.port))) { line.port = 1; changed = true; }
      if (!line.physicalRid && line.rid) { line.physicalRid = line.rid; changed = true; }
      line.receiverType = 'SPI';
      const device = (db?.devices || []).find((item) => item.id === line.deviceId);
      if (device && typeOf(device) === 'SPI') changed = rememberPortLine(device, Number(line.port) || 1, line, selectedGroup) || changed;
    });
    if (changed && typeof window.save === 'function') save('queued');
  }

  migrate();

  const baseTargets = typeof targets === 'function' ? targets : null;
  if (baseTargets) {
    targets = function v207Targets(selectedGroup = group) {
      // groupReceiverType lives inside the original app closure and is not a
      // window API. Do not accidentally rewrite every RGBW port as SPI P1.
      const firstLine = selectedGroup?.receivers?.[0];
      const firstDevice = (db?.devices || []).find(item => item.id === firstLine?.deviceId);
      const declaredType = selectedGroup?.receiverType || firstLine?.receiverType || firstDevice?.receiverType;
      if (!selectedGroup || String(declaredType || '').toUpperCase() === 'RGBW') return baseTargets(selectedGroup);
      const lines = selectedGroup.receivers || [];
      const groupPixels = Math.max(1, lines.reduce((sum, line) => sum + clamp(line.pixels, 1, 1024, 1), 0));
      const lineCount = Math.max(1, lines.length);
      let offset = 0;
      return lines.map((line, index) => {
        const device = (db.devices || []).find((item) => item.id === line.deviceId) || {};
        const pixels = clamp(line.pixels, 1, 1024, 1);
        const port = capacityOf(device) === 4 ? clamp(line.port, 1, 4, 1) : 1;
        const target = {
          id: line.id, deviceId: line.deviceId,
          rid: line.physicalRid || line.rid || device.rid || '',
          physicalRid: line.physicalRid || device.rid || line.rid || '',
          hardwareId: line.hardwareId || device.hardwareId || '',
          receiverType: 'SPI', port, outputPort: port,
          portCount: countOf(device), portCapacity: capacityOf(device), portMask: maskOf(device),
          pixels, physical: pixels, physicalLeds: pixels,
          offset, reversed: Boolean(line.reversed), physicalReverse: Boolean(line.reversed),
          groupPixels, lineIndex: selectedGroup.layout === 'parallel' ? index : 0,
          lineCount: selectedGroup.layout === 'parallel' ? lineCount : 1,
          layoutParallel: selectedGroup.layout === 'parallel'
        };
        offset += pixels;
        return target;
      });
    };
  }

  // The shared-state safety counter must distinguish sibling outputs. Without
  // this, removing P3 could look like removing the physical receiver/P1.
  try {
    sharedAssignmentCounts = function v207SharedAssignmentCounts(value) {
      const counts = new Map();
      (value?.installations || []).forEach((location) => (location.zones || []).forEach((selectedZone) =>
        (selectedZone.groups || []).forEach((selectedGroup) => (selectedGroup.receivers || []).forEach((line) => {
          const identity = String(line?.deviceId || line?.physicalRid || line?.hardwareId || line?.rid || line?.id || '').trim().toUpperCase();
          if (!identity) return;
          const port = typeOf(line) === 'SPI' ? clamp(line?.port, 1, 4, 1) : clamp(line?.port, 1, 2, 1);
          const key = `${identity}:PORT:${port}`;
          counts.set(key, (counts.get(key) || 0) + 1);
        }))));
      return counts;
    };
  } catch (_) {}

  window.identifySpiPort = async function identifySpiPort(deviceId, port) {
    const device = (db.devices || []).find((item) => item.id === deviceId);
    if (!device || typeOf(device) !== 'SPI') return;
    if (!reachable(device)) return toast(tx('Receiver is tijdelijk niet bereikbaar', 'Receiver is temporarily unavailable', 'Le récepteur est temporairement indisponible', 'Receiver ist vorübergehend nicht erreichbar'));
    const number = capacityOf(device) === 4 ? clamp(port, 1, 4, 1) : 1;
    const setting = portSettings(device, number);
    const assigned = assignmentsFor(deviceId, number)[0];
    const target = assigned && typeof targets === 'function'
      ? targets(assigned.group).find((item) => item.id === assigned.line.id)
      : { id: `identify-${deviceId}-p${number}`, deviceId, rid: device.rid, physicalRid: device.rid, hardwareId: device.hardwareId, receiverType: 'SPI', port: number, outputPort: number, portCount: countOf(device), portCapacity: capacityOf(device), portMask: maskOf(device), pixels: clamp(setting.pixels, 1, 1024, 25), offset: 0, reversed: Boolean(setting.reversed), groupPixels: clamp(setting.pixels, 1, 1024, 25) };
    try {
      const response = await api('/api/command', { action: 'identify', state: { receiverType: 'SPI', groupPixels: target.groupPixels }, targets: [target] });
      toast(response?.results?.[0]?.online ? tx(`LED Line op poort ${number} knippert`, `LED Line on port ${number} is flashing`, `La LED Line du port ${number} clignote`, `LED Line an Port ${number} blinkt`) : tx('Receiver reageert niet', 'Receiver is not responding', 'Le récepteur ne répond pas', 'Receiver antwortet nicht'));
    } catch (_) { toast(tx('Receiver reageert niet', 'Receiver is not responding', 'Le récepteur ne répond pas', 'Receiver antwortet nicht')); }
  };

  window.v207AttachConfiguredPort = function v207AttachConfiguredPort(deviceId, port) {
    const device = (db.devices || []).find((item) => item.id === deviceId);
    if (!device || !group || typeOf(device) !== 'SPI') return;
    const number = capacityOf(device) === 4 ? clamp(port, 1, 4, 1) : 1;
    const currentType = typeof window.groupReceiverType === 'function' ? groupReceiverType(group) : group.receiverType;
    if (currentType && currentType !== 'SPI') return toast(tx('Maak voor SPI een aparte groep', 'Create a separate SPI group', 'Créez un groupe SPI séparé', 'Erstelle eine separate SPI-Gruppe'));
    if (assignmentsFor(deviceId, number).length) return toast(tx('Deze uitgang zit al in een groep', 'This output is already in a group', 'Cette sortie est déjà dans un groupe', 'Dieser Ausgang ist bereits in einer Gruppe'));
    const setting = ensurePortSetting(device, number);
    const remembered = rememberedPortLine(device, number);
    group.receiverType = 'SPI';
    group.receivers ||= [];
    const line = { id: remembered.id, deviceId, name: remembered.name, rid: device.rid, physicalRid: device.rid,
      hardwareId: device.hardwareId, receiverType: 'SPI', port: number,
      pixels: clamp(setting.pixels, 1, 1024, 25), reversed: Boolean(setting.reversed) };
    group.receivers.push(line);
    restoreRememberedPortState(group, line, device, number);
    rememberPortLine(device, number, line, group);
    save('queued'); manageGroup(); Promise.resolve(queueLive(group)).catch(() => {});
  };

  function compatibleDestinationGroups(selectedZone) {
    return (selectedZone?.groups || []).filter((candidate) => {
      const currentType = typeof window.groupReceiverType === 'function' ? groupReceiverType(candidate) : candidate.receiverType;
      return !currentType || currentType === 'SPI';
    });
  }

  function movePortAssignment(deviceId, port, zoneId, groupId) {
    const device = (db.devices || []).find((item) => item.id === deviceId);
    const selectedZone = (install?.zones || []).find((item) => item.id === zoneId);
    const selectedGroup = selectedZone?.groups?.find((item) => item.id === groupId);
    const number = capacityOf(device) === 4 ? clamp(port, 1, 4, 1) : 1;
    const currentType = selectedGroup && (typeof window.groupReceiverType === 'function' ? groupReceiverType(selectedGroup) : selectedGroup.receiverType);
    if (!device || typeOf(device) !== 'SPI' || !selectedGroup || (currentType && currentType !== 'SPI')) return false;
    const existingAssignments = assignmentsFor(deviceId, number);
    const previous = existingAssignments[0];
    // Choosing the group the line already belongs to is a true no-op. Removing
    // and appending it would silently change a continuous line's physical order.
    if (existingAssignments.length === 1 && previous?.group === selectedGroup) return true;
    if (previous) rememberPortLine(device, number, previous.line, previous.group);
    const setting = ensurePortSetting(device, number);
    const remembered = rememberedPortLine(device, number);
    const line = previous?.line || {
      id: remembered.id, deviceId, rid: device.rid, physicalRid: device.rid,
      hardwareId: device.hardwareId, receiverType: 'SPI', port: number
    };
    const previousSelection = previous?.group === selectedGroup ? {
      v21SelectedLineIds: Array.isArray(selectedGroup.v21SelectedLineIds) ? [...selectedGroup.v21SelectedLineIds] : null,
      parallelSelectedIds: Array.isArray(selectedGroup.parallelSelectedIds) ? [...selectedGroup.parallelSelectedIds] : null
    } : null;
    const affected = new Set();
    (db.installations || []).forEach((location) => (location.zones || []).forEach((candidateZone) =>
      (candidateZone.groups || []).forEach((candidateGroup) => {
        const before = candidateGroup.receivers?.length || 0;
        candidateGroup.receivers = (candidateGroup.receivers || []).filter((candidate) =>
          !(candidate.deviceId === deviceId && Number(candidate.port || 1) === number));
        if (before !== candidateGroup.receivers.length) {
          affected.add(candidateGroup);
          cleanGroupLineMetadata(candidateGroup);
        }
      })));
    Object.assign(line, {
      deviceId, name: String(line.name || remembered.name),
      rid: device.rid, physicalRid: device.rid, hardwareId: device.hardwareId,
      receiverType: 'SPI', port: number,
      pixels: clamp(setting.pixels, 1, 1024, 25), reversed: Boolean(setting.reversed)
    });
    selectedGroup.receiverType = 'SPI';
    selectedGroup.receivers ||= [];
    selectedGroup.receivers.push(line);
    restoreRememberedPortState(selectedGroup, line, device, number);
    rememberPortLine(device, number, line, selectedGroup);
    ['v21SelectedLineIds', 'parallelSelectedIds'].forEach((key) => {
      if (!previousSelection?.[key]?.includes(line.id)) return;
      selectedGroup[key] ||= [];
      if (!selectedGroup[key].includes(line.id)) selectedGroup[key].push(line.id);
    });
    affected.add(selectedGroup);
    save('queued');
    affected.forEach((candidate) => {
      if (candidate.receivers?.length && typeof window.queueLive === 'function') Promise.resolve(queueLive(candidate)).catch(() => {});
    });
    return true;
  }

  function removePortAssignment(deviceId, port) {
    const device = (db.devices || []).find((item) => item.id === deviceId);
    if (!device || typeOf(device) !== 'SPI') return false;
    const number = capacityOf(device) === 4 ? clamp(port, 1, 4, 1) : 1;
    const affected = new Set();
    let removed = false;
    (db.installations || []).forEach((location) => (location.zones || []).forEach((candidateZone) =>
      (candidateZone.groups || []).forEach((candidateGroup) => {
        const removedLines = (candidateGroup.receivers || []).filter((candidate) =>
          candidate.deviceId === deviceId && Number(candidate.port || 1) === number);
        const before = candidateGroup.receivers?.length || 0;
        removedLines.forEach((line) => rememberPortLine(device, number, line, candidateGroup));
        candidateGroup.receivers = (candidateGroup.receivers || []).filter((candidate) =>
          !(candidate.deviceId === deviceId && Number(candidate.port || 1) === number));
        if (before === candidateGroup.receivers.length) return;
        removed = true;
        affected.add(candidateGroup);
        cleanGroupLineMetadata(candidateGroup);
      })));
    if (!removed) return false;
    save('queued');
    affected.forEach((candidate) => {
      if (candidate.receivers?.length && typeof window.queueLive === 'function') Promise.resolve(queueLive(candidate)).catch(() => {});
    });
    return true;
  }

  let routeDraft = null;
  function renderPortRoute() {
    if (!routeDraft) return;
    const { deviceId, port } = routeDraft;
    const device = (db.devices || []).find((item) => item.id === deviceId);
    const selectedZone = (install?.zones || []).find((item) => item.id === routeDraft.zoneId) || install?.zones?.[0];
    const groups = compatibleDestinationGroups(selectedZone);
    routeDraft.zoneId = selectedZone?.id || '';
    if (!groups.some((item) => item.id === routeDraft.groupId)) routeDraft.groupId = groups[0]?.id || '';
    modal(`<section class="v207-route-modal"><button class="button soft" onclick="deviceDiag('${safe(deviceId)}')">← ${tx('Uitgangen', 'Outputs', 'Sorties', 'Ausgänge')}</button><div class="v207-port-hero"><b>P${port}</b><span><div class="eyebrow">${tx('LED LINE INDELEN', 'ASSIGN LED LINE', 'AFFECTER LA LED LINE', 'LED LINE ZUORDNEN')}</div><h1>${safe(device?.name || 'Receiver')}</h1></span></div><p class="sub">${tx('Verplaats alleen deze uitgang. De andere uitgangen van de receiver blijven ongewijzigd.', 'Move only this output. The receiver’s other outputs remain unchanged.', 'Déplacez uniquement cette sortie. Les autres sorties restent inchangées.', 'Nur diesen Ausgang verschieben. Die übrigen Ausgänge bleiben unverändert.')}</p><section class="card v207-route-fields"><label><small>${tx('ZONE', 'ZONE', 'ZONE', 'ZONE')}</small><select class="field" onchange="v207RouteZone(this.value)">${(install?.zones || []).map((item) => `<option value="${safe(item.id)}" ${item.id === routeDraft.zoneId ? 'selected' : ''}>${safe(item.name)}</option>`).join('')}</select></label><label><small>${tx('GROEP', 'GROUP', 'GROUPE', 'GRUPPE')}</small><select class="field" onchange="v207RouteGroup(this.value)">${groups.map((item) => `<option value="${safe(item.id)}" ${item.id === routeDraft.groupId ? 'selected' : ''}>${safe(item.name)}</option>`).join('')}</select></label></section><footer><button class="button soft" onclick="deviceDiag('${safe(deviceId)}')">${tx('Annuleren', 'Cancel', 'Annuler', 'Abbrechen')}</button><button class="button" ${routeDraft.groupId ? '' : 'disabled'} onclick="v207SavePortRoute()">${tx('Indeling opslaan', 'Save assignment', 'Enregistrer', 'Zuordnung speichern')}</button></footer></section>`);
  }

  window.v207OpenPortRoute = function v207OpenPortRoute(deviceId, port) {
    const assigned = assignmentsFor(deviceId, port)[0];
    routeDraft = {
      deviceId, port: clamp(port, 1, 4, 1),
      zoneId: assigned?.zone?.id || install?.zones?.[0]?.id || '',
      groupId: assigned?.group?.id || ''
    };
    renderPortRoute();
  };
  window.v207RouteZone = function v207RouteZone(zoneId) { if (routeDraft) { routeDraft.zoneId = zoneId; routeDraft.groupId = ''; renderPortRoute(); } };
  window.v207RouteGroup = function v207RouteGroup(groupId) { if (routeDraft) routeDraft.groupId = groupId; };
  window.v207SavePortRoute = function v207SavePortRoute() {
    if (!routeDraft) return;
    const { deviceId, port, zoneId, groupId } = routeDraft;
    if (!movePortAssignment(deviceId, port, zoneId, groupId)) return toast(tx('Kies een geschikte SPI-groep', 'Choose a suitable SPI group', 'Choisissez un groupe SPI approprié', 'Wähle eine passende SPI-Gruppe'));
    routeDraft = null;
    toast(tx(`Poort ${port} is verplaatst`, `Port ${port} was moved`, `Le port ${port} a été déplacé`, `Port ${port} wurde verschoben`));
    deviceDiag(deviceId);
  };
  window.v207MovePortAssignment = movePortAssignment;
  window.v207DetachPort = function v207DetachPort(deviceId, port) {
    const assigned = assignmentsFor(deviceId, port)[0];
    const device = (db.devices || []).find((item) => item.id === deviceId);
    if (!assigned || !device) return;
    const number = capacityOf(device) === 4 ? clamp(port, 1, 4, 1) : 1;
    modal(`<section class="v207-detach-port"><div class="eyebrow">P${number} · ${tx('UIT GROEP', 'REMOVE FROM GROUP', 'RETIRER DU GROUPE', 'AUS GRUPPE')}</div><h1>${tx('Deze LED Line uit de groep halen?', 'Remove this LED Line from the group?', 'Retirer cette LED Line du groupe ?', 'Diese LED Line aus der Gruppe entfernen?')}</h1><p class="danger-note">${tx(`Alleen uitgang ${number} wordt losgemaakt van ${assigned.group.name}. De andere uitgangen van deze receiver blijven precies staan.`, `Only output ${number} is removed from ${assigned.group.name}. This receiver’s other outputs stay exactly where they are.`, `Seule la sortie ${number} est retirée de ${assigned.group.name}. Les autres sorties restent inchangées.`, `Nur Ausgang ${number} wird aus ${assigned.group.name} entfernt. Die übrigen Ausgänge bleiben unverändert.`)}</p><div class="row"><button class="button soft" onclick="deviceDiag('${safe(deviceId)}')">${tx('Annuleren', 'Cancel', 'Annuler', 'Abbrechen')}</button><button class="button red" onclick="v207ConfirmDetachPort('${safe(deviceId)}',${number})">${tx('Uit groep halen', 'Remove from group', 'Retirer du groupe', 'Aus Gruppe entfernen')}</button></div></section>`);
  };
  window.v207ConfirmDetachPort = function v207ConfirmDetachPort(deviceId, port) {
    if (!removePortAssignment(deviceId, port)) return toast(tx('Deze uitgang is niet meer ingedeeld', 'This output is no longer assigned', 'Cette sortie n’est plus affectée', 'Dieser Ausgang ist nicht mehr zugeordnet'));
    toast(tx(`Uitgang ${port} is uit de groep gehaald`, `Output ${port} was removed from the group`, `La sortie ${port} a été retirée du groupe`, `Ausgang ${port} wurde aus der Gruppe entfernt`));
    deviceDiag(deviceId);
  };

  let geometryDraft = null;
  const GEOMETRY_KEEPALIVE_MS = 15000;

  function clearGeometryTimers(draft = geometryDraft) {
    if (!draft) return;
    clearTimeout(draft.timer);
    clearTimeout(draft.keepaliveTimer);
    draft.timer = 0;
    draft.keepaliveTimer = 0;
  }

  function armGeometryKeepalive(draft = geometryDraft) {
    if (!draft || draft !== geometryDraft || !draft.setupStarted) return;
    clearTimeout(draft.keepaliveTimer);
    draft.keepaliveTimer = setTimeout(async () => {
      draft.keepaliveTimer = 0;
      if (draft !== geometryDraft || !draft.setupStarted) return;
      await geometryCommand('setup_keepalive', 0).catch(() => null);
      if (draft === geometryDraft && draft.setupStarted) armGeometryKeepalive(draft);
    }, GEOMETRY_KEEPALIVE_MS);
  }

  function geometryTarget(device, port, pixels, reversed) {
    return {
      id: `geometry-${device.id}-p${port}`, deviceId: device.id,
      rid: device.rid, physicalRid: device.rid, hardwareId: device.hardwareId,
      receiverType: 'SPI', port, outputPort: port,
      portCapacity: capacityOf(device), portCount: countOf(device), portMask: maskOf(device),
      pixels, physical: pixels, physicalLeds: pixels, groupPixels: pixels, offset: 0,
      reversed, physicalReverse: reversed
    };
  }

  function geometryTargetWithGroup(device, port, pixels, reversed, overrides = new Map()) {
    const target = geometryTarget(device, port, pixels, reversed);
    const assigned = assignmentsFor(device.id, port)[0];
    if (!assigned) return target;
    const lines = assigned.group?.receivers || [];
    let groupPixels = 0;
    let offset = 0;
    lines.forEach((line) => {
      const linePort = clamp(line.port, 1, 4, 1);
      const key = `${line.deviceId}:${linePort}`;
      const linePixels = clamp(overrides.get(key) ?? line.pixels, 1, 1024, 1);
      if (line.id === assigned.line.id) offset = groupPixels;
      groupPixels += linePixels;
    });
    return {
      ...target,
      groupPixels: Math.max(1, groupPixels),
      offset
    };
  }

  async function geometryCommand(action, overridePort) {
    if (!geometryDraft) return null;
    const device = (db.devices || []).find((item) => item.id === geometryDraft.deviceId);
    if (!device) return null;
    const target = geometryTarget(device, overridePort ?? geometryDraft.port, geometryDraft.pixels, geometryDraft.reversed);
    const response = await api('/api/command', {
      action,
      state: { receiverType: 'SPI', port: target.port, portMask: maskOf(device), physicalLeds: geometryDraft.pixels, physicalReverse: geometryDraft.reversed },
      targets: [target]
    });
    return response?.results?.[0] || null;
  }

  function geometryCells(mode) {
    return Array.from({ length: 25 }, (_, index) => {
      const marked = mode === 'end' ? index === 24 : geometryDraft?.reversed ? index === 24 : index === 0;
      return `<i class="${marked ? mode : 'fill'}"></i>`;
    }).join('');
  }

  function renderPortGeometryPixels() {
    if (!geometryDraft) return;
    geometryDraft.phase = 'pixels';
    modal(`<section class="v20-commission v207-port-geometry" data-phase="length"><div class="eyebrow">P${geometryDraft.port} · ${tx('PIXELS', 'PIXELS', 'PIXELS', 'PIXEL')}</div><h1>${tx('Zet rood op de laatste pixel', 'Place red on the final pixel', 'Placez le rouge sur le dernier pixel', 'Rot auf den letzten Pixel setzen')}</h1><p class="sub">${tx('Alle gekozen pixels zijn wit. De laatste is rood.', 'All selected pixels are white. The final one is red.', 'Tous les pixels sélectionnés sont blancs. Le dernier est rouge.', 'Alle gewählten Pixel sind weiß. Der letzte ist rot.')}</p><section class="v20-live-card"><div class="v20-strip-preview end">${geometryCells('end')}</div><div class="v20-big-number"><button onclick="v207AdjustPortPixels(-1)">−</button><label><input id="v207PortPixelNumber" type="number" inputmode="numeric" min="1" max="1024" value="${geometryDraft.pixels}" oninput="v207SetPortPixels(this.value)"><small>PIXELS</small></label><button onclick="v207AdjustPortPixels(1)">＋</button></div><input id="v207PortPixelRange" class="v20-range" type="range" min="1" max="1024" value="${geometryDraft.pixels}" oninput="v207SetPortPixels(this.value)"><div class="v20-range-label"><span>1</span><b id="v207PortPixelReadout">${geometryDraft.pixels} px</b><span>1024</span></div></section><footer><button class="button soft" onclick="v207CancelPortGeometry()">${tx('Annuleren', 'Cancel', 'Annuler', 'Abbrechen')}</button><button class="button" onclick="v207PortGeometrySide()">${tx('Aansluitkant', 'Connection side', 'Côté de connexion', 'Anschlussseite')} →</button></footer></section>`);
    geometryCommand('calibrate_end').catch(() => {});
  }

  function renderPortGeometrySide() {
    if (!geometryDraft) return;
    geometryDraft.phase = 'side';
    modal(`<section class="v20-commission v207-port-geometry" data-phase="side"><div class="eyebrow">P${geometryDraft.port} · ${tx('AANSLUITKANT', 'CONNECTION SIDE', 'CÔTÉ DE CONNEXION', 'ANSCHLUSSSEITE')}</div><h1>${tx('Aan welke kant zit de receiver?', 'Which side is the receiver on?', 'De quel côté se trouve le récepteur ?', 'Auf welcher Seite sitzt der Receiver?')}</h1><p class="sub">${tx('De groene pixel toont het fysieke begin van deze LED Line.', 'The green pixel shows the physical start of this LED Line.', 'Le pixel vert indique le début physique de cette LED Line.', 'Der grüne Pixel zeigt den physischen Anfang dieser LED Line.')}</p><section class="v20-live-card"><div class="v20-side-stage ${geometryDraft.reversed ? 'right' : 'left'}"><div class="v20-receiver-glyph"><b>R</b><i></i></div><div class="v20-strip-preview start">${geometryCells('start')}</div></div><div class="v20-side-options"><button class="${geometryDraft.reversed ? '' : 'on'}" onclick="v207SetPortSide('left')"><span class="v20-side-icon receiver-left"><i>R</i><b></b></span><strong>${tx('Receiver links', 'Receiver left', 'Récepteur à gauche', 'Receiver links')}</strong></button><button class="${geometryDraft.reversed ? 'on' : ''}" onclick="v207SetPortSide('right')"><span class="v20-side-icon receiver-right"><b></b><i>R</i></span><strong>${tx('Receiver rechts', 'Receiver right', 'Récepteur à droite', 'Receiver rechts')}</strong></button></div></section><footer><button class="button soft" onclick="v207PortGeometryPixels()">← ${tx('Pixels', 'Pixels', 'Pixels', 'Pixel')}</button><button class="button" onclick="v207SavePortGeometry()">${tx('Opslaan', 'Save', 'Enregistrer', 'Speichern')}</button></footer></section>`);
    geometryCommand('calibrate_start').catch(() => {});
  }

  window.v207EditPortGeometry = function v207EditPortGeometry(deviceId, port) {
    const device = (db.devices || []).find((item) => item.id === deviceId);
    if (!device || typeOf(device) !== 'SPI') return;
    const number = capacityOf(device) === 4 ? clamp(port, 1, 4, 1) : 1;
    const setting = portSettings(device, number);
    geometryDraft = {
      deviceId, port: number,
      pixels: clamp(setting.pixels, 1, 1024, 25),
      reversed: Boolean(setting.reversed),
      timer: 0, keepaliveTimer: 0, phase: 'pixels', setupStarted: false, saving: false
    };
    const draft = geometryDraft;
    modal(`<section class="v20-commission"><div class="v20-pair-loading"><i></i><b>${tx('Uitgang voorbereiden…', 'Preparing output…', 'Préparation de la sortie…', 'Ausgang wird vorbereitet…')}</b></div></section>`);
    geometryCommand('setup_begin', 0).then((result) => {
      if (geometryDraft !== draft) return;
      const exactRequired = capacityOf(device) === 4;
      const started = exactRequired
        ? Boolean(result?.confirmed)
        : Boolean(result?.confirmed || result?.accepted || result?.delivered || result?.gatewayAck || result?.online);
      if (!started) {
        geometryDraft = null;
        toast(tx('Receiver antwoordt niet · probeer opnieuw', 'Receiver did not respond · try again', 'Le récepteur ne répond pas · réessayez', 'Receiver antwortet nicht · erneut versuchen'));
        return deviceDiag(deviceId);
      }
      draft.setupStarted = true;
      armGeometryKeepalive(draft);
      renderPortGeometryPixels();
    }).catch(() => {
      if (geometryDraft !== draft) return;
      geometryDraft = null;
      toast(tx('Receiver antwoordt niet · probeer opnieuw', 'Receiver did not respond · try again', 'Le récepteur ne répond pas · réessayez', 'Receiver antwortet nicht · erneut versuchen'));
      deviceDiag(deviceId);
    });
  };
  window.v207SetPortPixels = function v207SetPortPixels(value) {
    if (!geometryDraft) return;
    geometryDraft.pixels = clamp(value, 1, 1024, geometryDraft.pixels);
    const number = document.getElementById('v207PortPixelNumber');
    const range = document.getElementById('v207PortPixelRange');
    const readout = document.getElementById('v207PortPixelReadout');
    if (number && document.activeElement !== number) number.value = geometryDraft.pixels;
    if (range) range.value = geometryDraft.pixels;
    if (readout) readout.textContent = `${geometryDraft.pixels} px`;
    clearTimeout(geometryDraft.timer);
    geometryDraft.timer = setTimeout(() => geometryCommand('calibrate_end').catch(() => {}), 28);
  };
  window.v207AdjustPortPixels = function v207AdjustPortPixels(delta) { if (geometryDraft) window.v207SetPortPixels(geometryDraft.pixels + Number(delta || 0)); };
  window.v207PortGeometryPixels = renderPortGeometryPixels;
  window.v207PortGeometrySide = renderPortGeometrySide;
  window.v207SetPortSide = function v207SetPortSide(side) { if (geometryDraft) { geometryDraft.reversed = side === 'right'; renderPortGeometrySide(); } };
  window.v207CancelPortGeometry = async function v207CancelPortGeometry() {
    if (!geometryDraft) return;
    const deviceId = geometryDraft.deviceId;
    const setupStarted = geometryDraft.setupStarted;
    clearGeometryTimers();
    if (setupStarted) await geometryCommand('setup_cancel', 0).catch(() => {});
    geometryDraft = null;
    deviceDiag(deviceId);
  };
  window.v207SavePortGeometry = async function v207SavePortGeometry() {
    if (!geometryDraft || geometryDraft.saving) return;
    geometryDraft.saving = true;
    const draft = { ...geometryDraft };
    const device = (db.devices || []).find((item) => item.id === draft.deviceId);
    if (!device) { geometryDraft = null; return; }
    const overrides = new Map([[`${device.id}:${draft.port}`, draft.pixels]]);
    const portTarget = geometryTargetWithGroup(device, draft.port, draft.pixels, draft.reversed, overrides);
    const topologyTarget = { ...portTarget, id: `${portTarget.id}-topology`, port: 0, outputPort: 0, pixels: undefined, physical: undefined, physicalLeds: undefined };
    const enabledPorts = PORTS.slice(0, capacityOf(device)).filter((port) => maskOf(device) & (1 << (port - 1)));
    const stagedPortTargets = enabledPorts.map((port) => {
      if (port === draft.port) return portTarget;
      const setting = portSettings(device, port);
      return geometryTargetWithGroup(
        device, port,
        clamp(setting.pixels, 1, 1024, 25),
        Boolean(setting.reversed ?? setting.physicalReverse),
        overrides
      );
    });
    // SETUP_END is atomic only after every enabled output has staged both its
    // pixel count and physical direction. Sibling outputs are resent with
    // their existing values; editing P2 can therefore never reset P1/P3/P4.
    const configTargets = capacityOf(device) === 4 ? [topologyTarget, ...stagedPortTargets] : [portTarget];
    const config = await api('/api/command', { action: 'config', state: { receiverType: 'SPI', portMask: maskOf(device) }, targets: configTargets }).catch(() => null);
    const exactAckRequired = capacityOf(device) === 4;
    const configured = configTargets.every((_, index) => {
      const result = config?.results?.[index] || {};
      return exactAckRequired
        ? Boolean(result.confirmed)
        : Boolean(result.confirmed || result.accepted || result.delivered || result.gatewayAck);
    });
    const ended = configured ? await geometryCommand('setup_end', 0).catch(() => null) : null;
    const setupEnded = exactAckRequired
      ? Boolean(ended?.confirmed)
      : Boolean(ended?.confirmed || ended?.accepted || ended?.delivered || ended?.gatewayAck);
    if (!configured || !setupEnded) {
      if (geometryDraft) geometryDraft.saving = false;
      return toast(tx('Instelling nog niet bevestigd · probeer opnieuw', 'Setting not confirmed yet · try again', 'Réglage pas encore confirmé · réessayez', 'Einstellung noch nicht bestätigt · erneut versuchen'));
    }
    clearGeometryTimers();
    device.spiPorts ||= {};
    device.spiPorts[draft.port] = { ...(device.spiPorts[draft.port] || {}), pixels: draft.pixels, reversed: draft.reversed, physicalReverse: draft.reversed };
    if (draft.port === 1) { device.pixels = draft.pixels; device.reversed = draft.reversed; device.physicalReverse = draft.reversed; }
    assignmentsFor(device.id, draft.port).forEach(({ line, group: assignedGroup }) => {
      line.pixels = draft.pixels; line.reversed = draft.reversed;
      if (typeof window.queueLive === 'function') Promise.resolve(queueLive(assignedGroup)).catch(() => {});
    });
    save('queued');
    geometryDraft = null;
    toast(tx(`Poort ${draft.port} is opgeslagen`, `Port ${draft.port} was saved`, `Le port ${draft.port} est enregistré`, `Port ${draft.port} wurde gespeichert`));
    deviceDiag(device.id);
  };

  const closeModalBeforeFourPort = window.closeModal;
  window.closeModal = function v207CloseModal(...args) {
    if (geometryDraft) {
      const draft = geometryDraft;
      clearGeometryTimers(draft);
      if (draft.setupStarted) geometryCommand('setup_cancel', 0).catch(() => {});
      geometryDraft = null;
    }
    return closeModalBeforeFourPort?.apply(this, args);
  };

  const baseManageGroup = window.manageGroup;
  window.manageGroup = function v207ManageGroup() {
    const groupType = group && (typeof window.groupReceiverType === 'function' ? groupReceiverType(group) : group.receiverType);
    if (!group || groupType === 'RGBW' || (typeof realGuide !== 'undefined' && realGuide?.active)) return baseManageGroup?.apply(this, arguments);
    const lines = group.receivers || [];
    const rows = lines.map((line, index) => {
      const device = (db.devices || []).find((item) => item.id === line.deviceId);
      const port = clamp(line.port, 1, capacityOf(device), 1);
      return `<article class="v187-receiver-row v207-spi-line" data-receiver-id="${safe(line.id)}" ondragover="receiverDragOver(event,'${safe(line.id)}')" ondrop="receiverDrop(event,'${safe(line.id)}')"><button class="v187-drag-handle" draggable="${lines.length > 1}" ondragstart="receiverDragStart(event,'${safe(line.id)}')" ondragend="receiverDragEnd()" onpointerdown="receiverPointerStart(event,'${safe(line.id)}')" onpointermove="receiverPointerMove(event)" onpointerup="receiverPointerEnd(event)" onpointercancel="receiverPointerCancel(event)">⋮⋮</button><b class="v207-port-badge">P${port}</b><span class="v187-receiver-copy"><b>${safe(typeof window.customerDeviceName === 'function' ? customerDeviceName(device) : device?.name || line.name)}</b><small>${line.pixels} px · ${line.reversed ? tx('receiver rechts', 'receiver right', 'récepteur à droite', 'Receiver rechts') : tx('receiver links', 'receiver left', 'récepteur à gauche', 'Receiver links')}</small></span><span class="v187-receiver-state ${reachable(device) ? 'on' : ''}"></span><div class="v187-receiver-actions"><button class="v187-identify" onclick="identifySpiPort('${safe(line.deviceId)}',${port})" aria-label="${tx('Deze uitgang laten knipperen', 'Flash this output', 'Faire clignoter cette sortie', 'Diesen Ausgang blinken lassen')}">✦</button><button class="button soft" onclick="moveGroupReceiver('${safe(line.id)}',-1)" ${index === 0 ? 'disabled' : ''}>↑</button><button class="button soft" onclick="moveGroupReceiver('${safe(line.id)}',1)" ${index === lines.length - 1 ? 'disabled' : ''}>↓</button><button class="button soft" onclick="v207OpenPortRoute('${safe(line.deviceId)}',${port})">${tx('Indelen', 'Assign', 'Affecter', 'Zuordnen')}</button><button class="button soft v187-settings-button" onclick="deviceDiag('${safe(line.deviceId)}')">${tx('Poorten', 'Outputs', 'Sorties', 'Ausgänge')}</button><button class="button red v187-remove-button" onclick="v207DetachPort('${safe(line.deviceId)}',${port})">×</button></div></article>`;
    }).join('');
    const available = (db.devices || []).filter((device) => typeOf(device) === 'SPI').flatMap((device) => PORTS.slice(0, capacityOf(device)).filter((port) => (maskOf(device) & (1 << (port - 1))) && !assignmentsFor(device.id, port).length).map((port) => ({ device, port })));
    const layoutChoice = typeof v187LayoutChoice === 'function' ? `${v187LayoutChoice('line')}${v187LayoutChoice('parallel')}` : `<button class="button ${group.layout === 'line' ? '' : 'soft'}" onclick="setGroupLayout('line')">${tx('Doorlopend', 'Continuous', 'Continu', 'Fortlaufend')}</button><button class="button ${group.layout === 'parallel' ? '' : 'soft'}" onclick="setGroupLayout('parallel')">${tx('Onder elkaar', 'Stacked', 'Superposées', 'Untereinander')}</button>`;
    modal(`<button class="button soft" onclick="closeModal()">← ${tx('Terug', 'Back', 'Retour', 'Zurück')}</button><div class="v187-manage-head"><span><span class="scope">SPI · ${tx('GROEP', 'GROUP', 'GROUPE', 'GRUPPE')}</span><h1>${safe(group.name)}</h1></span><button class="button" onclick="openAddReceiverForGroup()">＋ ${tx('Receiver toevoegen', 'Add receiver', 'Ajouter un récepteur', 'Receiver hinzufügen')}</button></div><section class="card v187-layout-section"><div class="row"><span><h2>${tx('Hoe werken deze LED Lines samen?', 'How do these LED Lines work together?', 'Comment fonctionnent ces LED Lines ensemble ?', 'Wie arbeiten diese LED Lines zusammen?')}</h2><small class="sub">${tx('Doorlopend maakt één lange route; onder elkaar maakt aparte rijen.', 'Continuous creates one long route; stacked creates separate rows.', 'Continu crée un long parcours ; superposé crée des rangées.', 'Fortlaufend erzeugt eine lange Route; untereinander erzeugt Reihen.')}</small></span><span class="scope">${lines.length} LED Line${lines.length === 1 ? '' : 's'}</span></div><div class="v187-layout-grid">${layoutChoice}</div></section><section class="card v187-receiver-order"><div class="row"><h2>${tx('Uitgangen in deze groep', 'Outputs in this group', 'Sorties de ce groupe', 'Ausgänge in dieser Gruppe')}</h2><small class="v187-drag-hint">⋮⋮ ${tx('Sleep voor de volgorde', 'Drag to reorder', 'Glissez pour trier', 'Zum Sortieren ziehen')}</small></div><div class="v187-receiver-list">${rows || `<div class="ux-empty-simple"><b>${tx('Nog geen LED Line', 'No LED Line yet', 'Pas encore de LED Line', 'Noch keine LED Line')}</b></div>`}</div></section>${available.length ? `<section class="card v207-available-ports"><div class="row"><h2>${tx('Vrije uitgangen', 'Available outputs', 'Sorties disponibles', 'Freie Ausgänge')}</h2><span class="scope">${available.length}</span></div>${available.map(({ device, port }) => `<div class="row"><span><b>${safe(typeof window.customerDeviceName === 'function' ? customerDeviceName(device) : device.name)} · P${port}</b><small class="sub" style="display:block">${portSettings(device, port).pixels} px</small></span><span><button class="button soft" onclick="identifySpiPort('${safe(device.id)}',${port})">✦</button> <button class="button" onclick="v207AttachConfiguredPort('${safe(device.id)}',${port})">＋ ${tx('Toevoegen', 'Add', 'Ajouter', 'Hinzufügen')}</button></span></div>`).join('')}</section>` : ''}`);
    if (typeof window.translateExactText === 'function') translateExactText(document.getElementById('modalBody'));
  };

  const baseDeviceDiag = window.deviceDiag;
  window.deviceDiag = function v207DeviceDiag(id) {
    const device = (db.devices || []).find((item) => item.id === id);
    if (!device || typeOf(device) !== 'SPI') return baseDeviceDiag?.apply(this, arguments);
    const capacity = capacityOf(device), mask = maskOf(device);
    const branches = PORTS.slice(0, capacity).map((port) => {
      const setting = portSettings(device, port), assigned = assignmentsFor(id, port)[0], active = Boolean(mask & (1 << (port - 1)));
      return `<article class="v207-device-port ${active ? 'on' : ''}"><b>P${port}</b><span><strong>LED Line ${port}</strong><small>${setting.pixels} px · ${setting.reversed ? tx('receiver rechts', 'receiver right', 'récepteur à droite', 'Receiver rechts') : tx('receiver links', 'receiver left', 'récepteur à gauche', 'Receiver links')}</small><em>${assigned ? `${safe(assigned.zone.name)} → ${safe(assigned.group.name)}` : active ? tx('Nog niet in een groep', 'Not in a group yet', 'Pas encore dans un groupe', 'Noch keiner Gruppe zugeordnet') : tx('Niet gebruikt', 'Not used', 'Non utilisé', 'Nicht verwendet')}</em></span><div class="v207-port-actions"><button class="v187-identify" onclick="identifySpiPort('${safe(id)}',${port})" aria-label="${tx('Herken deze uitgang', 'Identify this output', 'Identifier cette sortie', 'Diesen Ausgang erkennen')}">✦</button>${active ? `<button class="button soft" onclick="v207EditPortGeometry('${safe(id)}',${port})">${tx('Pixels & kant', 'Pixels & side', 'Pixels & côté', 'Pixel & Seite')}</button><button class="button soft" onclick="v207OpenPortRoute('${safe(id)}',${port})">${tx('Indelen', 'Assign', 'Affecter', 'Zuordnen')}</button>` : ''}</div></article>`;
    }).join('');
    const activeCount = PORTS.slice(0, capacity).filter((port) => mask & (1 << (port - 1))).length;
    modal(`<button class="button soft" onclick="closeModal()">← ${tx('Receivers', 'Receivers', 'Récepteurs', 'Receiver')}</button><div class="rgbw-device-head v207-device-head"><span><div class="eyebrow">SPI · ${capacity === 4 ? tx('4 UITGANGEN', '4 OUTPUTS', '4 SORTIES', '4 AUSGÄNGE') : tx('1 UITGANG', '1 OUTPUT', '1 SORTIE', '1 AUSGANG')}</div><h1>${safe(typeof window.customerDeviceName === 'function' ? customerDeviceName(device) : device.name)}</h1><p>1 receiver → ${activeCount} LED Line${activeCount === 1 ? '' : 's'}</p></span><span class="pill ${reachable(device) ? 'online' : 'offline'}">● ${reachable(device) ? tx('Bereikbaar', 'Reachable', 'Joignable', 'Erreichbar') : tx('Niet bereikbaar', 'Unavailable', 'Indisponible', 'Nicht erreichbar')}</span></div><section class="card v207-device-ports"><div class="row"><span><h2>${capacity === 4 ? tx('Vier afzonderlijke data-uitgangen', 'Four independent data outputs', 'Quatre sorties de données indépendantes', 'Vier getrennte Datenausgänge') : tx('Beschikbare uitgang', 'Available output', 'Sortie disponible', 'Verfügbare Ausgabe')}</h2><small class="sub">${tx('Iedere uitgang bewaart zijn eigen pixels, aansluitkant en groep.', 'Each output stores its own pixels, connection side and group.', 'Chaque sortie conserve ses pixels, son côté et son groupe.', 'Jeder Ausgang speichert Pixel, Anschlussseite und Gruppe.')}</small></span><span class="scope">P1${capacity === 4 ? '–P4' : ''}</span></div><div class="v207-device-port-list">${branches}</div></section><div class="row v207-device-actions"><button class="button red" onclick="requestDeleteDevice('${safe(id)}')">${tx('Receiver verwijderen', 'Remove receiver', 'Supprimer le récepteur', 'Receiver entfernen')}</button><button class="button" onclick="startPairing('${safe(id)}')">${tx('Uitgangen opnieuw instellen', 'Reconfigure outputs', 'Reconfigurer les sorties', 'Ausgänge neu einrichten')}</button></div>`);
  };

  document.head.insertAdjacentHTML('beforeend', `<style>
    .v207-output-board{display:grid;grid-template-columns:minmax(96px,.42fr) minmax(0,1fr);gap:13px;align-items:center;padding:14px;border-radius:18px;background:linear-gradient(145deg,#292b29,#101110);color:#fff}.v207-output-receiver{display:grid;place-items:center;min-height:148px;padding:12px;border:1px solid #ffffff25;border-radius:16px;background:linear-gradient(145deg,#343735,#1b1d1c);box-shadow:inset 0 1px #ffffff1b,0 12px 28px #0004}.v207-output-receiver span,.v207-output-receiver small{font-size:8px;font-weight:900;letter-spacing:1.4px;color:#bfc3be}.v207-output-receiver b{font-size:25px}.v207-output-routes{display:grid;gap:8px}.v207-output-routes>span{display:grid;grid-template-columns:34px minmax(24px,1fr) auto;gap:7px;align-items:center;opacity:.28}.v207-output-routes>span.on{opacity:1}.v207-output-routes i{display:grid;place-items:center;width:34px;height:29px;border-radius:9px;background:#424542;color:#fff;font-style:normal;font-size:9px;font-weight:950}.v207-output-routes span.on i{background:var(--red)}.v207-output-routes em{height:3px;border-radius:9px;background:linear-gradient(90deg,var(--red),#fff,var(--red));background-size:220% 100%;box-shadow:0 0 10px #fff8}.v207-output-routes span.on em{animation:v207RouteFlow 1.35s linear infinite}.v207-output-routes b{font-size:10px}.v207-output-count{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px}.v207-output-count button{position:relative;display:grid;place-items:center;min-height:76px;padding:9px;border:1px solid var(--line);border-radius:15px;background:var(--panel);color:var(--ink);touch-action:manipulation}.v207-output-count button b{font-size:27px}.v207-output-count button span{color:var(--mut);font-size:9px}.v207-output-count button i{position:absolute;right:7px;top:7px;font-style:normal}.v207-output-count button.on{border-color:var(--red);box-shadow:0 0 0 3px color-mix(in srgb,var(--red),transparent 87%)}.v207-output-count button.on i{display:grid;place-items:center;width:21px;height:21px;border-radius:7px;background:var(--red);color:#fff}.v207-output-summary{display:flex;align-items:center;justify-content:center;gap:11px;margin-top:12px;padding:10px;border-radius:13px;background:var(--panel-2)}.v207-output-summary em{color:var(--red);font-size:21px;font-style:normal}.v207-legacy-port-note{display:grid;grid-template-columns:34px minmax(0,1fr);gap:9px;align-items:center;margin-top:12px;padding:11px;border-radius:13px;background:#fff2df;color:#76551f}.v207-legacy-port-note>i{display:grid;place-items:center;width:34px;height:34px;border-radius:11px;background:#e19a32;color:#fff;font-style:normal;font-weight:950}.v207-legacy-port-note b,.v207-legacy-port-note small{display:block}.v207-legacy-port-note small{margin-top:2px;line-height:1.4}.v207-arrangement{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.v207-arrangement>button{position:relative;display:grid;gap:10px;padding:11px;border:1px solid var(--line);border-radius:18px;background:var(--panel);color:var(--ink);text-align:left}.v207-arrangement>button.on{border-color:var(--red);box-shadow:0 0 0 3px color-mix(in srgb,var(--red),transparent 88%)}.v207-arrangement .v207-output-board{grid-template-columns:64px 1fr;padding:8px}.v207-arrangement .v207-output-receiver{min-height:94px;padding:5px}.v207-arrangement .v207-output-receiver b{font-size:16px}.v207-arrangement .v207-output-routes{gap:3px}.v207-arrangement .v207-output-routes>span{grid-template-columns:22px 1fr}.v207-arrangement .v207-output-routes i{width:22px;height:18px;font-size:7px}.v207-arrangement .v207-output-routes b{display:none}.v207-arrangement>button>span b,.v207-arrangement>button>span small{display:block}.v207-arrangement>button>span small{margin-top:3px;color:var(--mut);font-size:9px;line-height:1.35}.v207-arrangement>button>i{position:absolute;right:10px;top:10px;font-style:normal}.v207-arrangement>button.on>i{display:grid;place-items:center;width:24px;height:24px;border-radius:8px;background:var(--red);color:#fff}.v207-separate-visual{display:grid;gap:5px;padding:10px;border-radius:13px;background:#181a18}.v207-separate-visual>span{display:grid;grid-template-columns:25px 1fr 27px;gap:5px;align-items:center;color:#fff}.v207-separate-visual b,.v207-separate-visual em{display:grid;place-items:center;height:22px;border-radius:7px;background:#343735;font-size:8px;font-style:normal}.v207-separate-visual i{height:3px;border-radius:5px;background:linear-gradient(90deg,var(--red),#fff)}.v207-port-destinations{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.v207-port-destination{margin:0;box-shadow:none}.v207-port-heading{display:grid;grid-template-columns:45px minmax(0,1fr);gap:10px;align-items:center;margin-bottom:11px}.v207-port-heading>b,.v207-port-badge{display:grid;place-items:center;width:45px;height:45px;border-radius:13px;background:#202220;color:#fff;font-size:14px}.v207-port-heading strong,.v207-port-heading small{display:block}.v207-port-heading small{margin-top:2px;color:var(--mut)}.v207-destination-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.v207-destination-fields label small{display:block;margin-bottom:4px;color:var(--mut);font-size:8px;font-weight:950;letter-spacing:1px}.v207-new-group{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px;margin-top:8px}.v207-review-board>.v207-output-board{margin-bottom:11px}.v207-review-ports{display:grid;gap:8px}.v207-review-ports article{display:grid;grid-template-columns:43px minmax(0,1fr) 27px;gap:10px;align-items:center;padding:10px;border:1px solid var(--line);border-radius:14px;background:var(--panel)}.v207-review-ports article>b{display:grid;place-items:center;width:43px;height:43px;border-radius:12px;background:#202220;color:#fff}.v207-review-ports strong,.v207-review-ports small{display:block}.v207-review-ports small{margin-top:3px;color:var(--mut)}.v207-review-ports article>i{display:grid;place-items:center;width:27px;height:27px;border-radius:9px;background:#2f8056;color:#fff;font-style:normal}.v207-spi-line .v207-port-badge{width:34px;height:34px;border-radius:10px;font-size:10px}.v207-available-ports>.row+.row{padding-top:9px;margin-top:9px;border-top:1px solid var(--line)}.v207-device-port-list{display:grid;gap:8px;margin-top:12px}.v207-device-port{display:grid;grid-template-columns:42px minmax(0,1fr) minmax(136px,auto);gap:10px;align-items:center;padding:10px;border:1px solid var(--line);border-radius:14px;background:var(--panel);opacity:.58}.v207-device-port.on{opacity:1}.v207-device-port>b{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:#202220;color:#fff}.v207-device-port strong,.v207-device-port small,.v207-device-port em{display:block}.v207-device-port small,.v207-device-port em{margin-top:2px;color:var(--mut);font-size:9px;font-style:normal}.v207-port-actions{display:flex;justify-content:flex-end;gap:6px;flex-wrap:wrap}.v207-port-actions .button{min-height:38px;padding:7px 9px}.v207-device-actions{margin-top:13px}.v207-port-hero{display:grid;grid-template-columns:58px minmax(0,1fr);gap:12px;align-items:center;margin-top:15px}.v207-port-hero>b{display:grid;place-items:center;width:58px;height:58px;border-radius:17px;background:#202220;color:#fff;font-size:17px}.v207-route-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.v207-route-fields label small{display:block;margin-bottom:5px;color:var(--mut);font-size:8px;font-weight:950}.v207-route-modal footer{display:flex;justify-content:space-between;gap:9px;margin-top:14px}.v207-warning-icon{display:grid;place-items:center;width:58px;height:58px;border-radius:18px;background:#d85f4d;color:#fff;font-size:28px;font-weight:950}@keyframes v207RouteFlow{to{background-position:-220% 0}}
    body.dark .v207-legacy-port-note{background:#3b2e1c;color:#f0d49d}@media(max-width:700px){.v207-output-board{grid-template-columns:82px minmax(0,1fr);padding:10px}.v207-output-receiver{min-height:132px}.v207-output-count{gap:5px}.v207-output-count button{min-height:69px;padding:6px}.v207-output-count button b{font-size:23px}.v207-arrangement,.v207-port-destinations{grid-template-columns:1fr}.v207-destination-fields,.v207-route-fields{grid-template-columns:1fr}.v207-new-group{grid-template-columns:1fr}.v207-new-group .button{width:100%}.v207-spi-line{grid-template-columns:34px 34px minmax(0,1fr) 9px}.v207-spi-line .v187-receiver-actions{grid-column:1/-1}.v207-device-port{grid-template-columns:42px minmax(0,1fr)}.v207-device-port .v207-port-actions{grid-column:1/-1;justify-content:stretch}.v207-port-actions .button{flex:1}.v207-device-actions{display:grid}.v207-device-actions .button{width:100%}.v207-route-modal footer{display:grid;grid-template-columns:1fr 1fr}}@media(max-width:370px){.v207-output-board{grid-template-columns:69px minmax(0,1fr)}.v207-output-receiver{min-height:118px}.v207-output-count button span{font-size:7px}.v207-output-routes>span{grid-template-columns:30px minmax(18px,1fr) auto}.v207-output-routes i{width:30px}.v207-device-port{grid-template-columns:38px minmax(0,1fr)}}@media(prefers-reduced-motion:reduce){.v207-output-routes span.on em{animation:none}}
  </style>`);

  window.AluvisionSpiFourPort = Object.freeze({
    version: '20.7.0', capacityOf, maskOf, countOf, assignmentsFor, migrate,
    movePortAssignment, removePortAssignment
  });
})();
