(function (root, factory) {
  'use strict';
  var api = factory(typeof module === 'object' && module.exports ? require('./model.js') : root.LightningModel);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LightningMigration = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (Model) {
  'use strict';
  // This is deliberately not a storage migration. No localStorage, receiver
  // commands, credential writes or commit API exist here. Every source field
  // remains in sourceBackup; uncertain semantic conversions block a candidate.
  function object(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
  function list(value) { return Array.isArray(value) ? value : []; }
  function nonempty(value) { return Array.isArray(value) ? value.length > 0 : object(value) ? Object.keys(value).length > 0 : value != null && value !== ''; }
  function type(value) { var result = String(value || '').toUpperCase(); return ['RGBW', 'SPI'].indexOf(result) >= 0 ? result : null; }
  function equivalent(a, b) {
    if (a === b) return true;
    if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every(function (entry, index) { return equivalent(entry, b[index]); });
    if (!object(a) || !object(b)) return false;
    var ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
    return ka.length === kb.length && ka.every(function (key, index) { return key === kb[index] && equivalent(a[key], b[key]); });
  }
  function preview(legacy) {
    var sourceBackup = Model.clone(legacy), conflicts = [];
    var candidate = { schemaVersion: 30, stands: [], receivers: [], scenes: [], presets: [] };
    function conflict(code, path, message, details) {
      var item = { code: code, path: path, message: message };
      if (details !== undefined) item.details = Model.clone(details);
      conflicts.push(item);
    }
    function finish() {
      if (!conflicts.length) Model.validate(candidate).errors.forEach(function (error) { conflict('MODEL_' + error.code, error.path, error.message); });
      return { candidate: conflicts.length ? null : candidate, conflicts: conflicts, sourceBackup: sourceBackup, committable: false,
        status: conflicts.length ? 'needs-decisions' : 'preview-only' };
    }
    if (!object(legacy) || !Array.isArray(legacy.installations) || !Array.isArray(legacy.devices)) {
      conflict('SOURCE_SCHEMA', '', 'Gebruik een expliciete kopie van de oorspronkelijke aluv12-gegevens; niet de afgeleide V21-cache.');
      return finish();
    }
    if (legacy.schemaVersion === 30) {
      conflict('SOURCE_SCHEMA', 'schemaVersion', 'Deze proefconversie verwacht de oorspronkelijke appstructuur.');
      return finish();
    }
    // These fields contain references/actions that cannot be made lossless by
    // merely removing a groupId. Require a separate conversion decision.
    ['scenes', 'presets', 'favorites', 'undo', 'redo'].forEach(function (key) {
      if (nonempty(legacy[key])) conflict(key === 'scenes' ? 'SCENES_REVIEW' : 'SAVED_DATA_REVIEW', key, 'Opgeslagen ' + key + ' moeten apart gecontroleerd worden; de originele gegevens blijven volledig bewaard.');
    });
    if (legacy.activeInstallationId !== undefined && !legacy.installations.some(function (stand) { return stand && stand.id === legacy.activeInstallationId; })) conflict('ACTIVE_STAND', 'activeInstallationId', 'De actieve stand verwijst niet naar een bestaande stand.');
    var devices = new Map(), assignments = new Map(), usedLineIds = new Set(), usedEndpointKeys = new Set(), physicalIds = new Map();
    legacy.devices.forEach(function (device, di) {
      var path = 'devices[' + di + ']';
      if (!object(device) || typeof device.id !== 'string' || !device.id) { conflict('DEVICE_ID', path, 'Een receiver heeft geen expliciete ID. Er wordt geen identiteit verzonnen.'); return; }
      if (devices.has(device.id)) conflict('DUPLICATE_DEVICE', path + '.id', 'Deze receiver-ID komt meer dan één keer voor.');
      else devices.set(device.id, device);
      var rid = String(device.physicalRid || device.rid || '').toUpperCase();
      if (rid) {
        if (physicalIds.has(rid) && physicalIds.get(rid) !== device.id) conflict('PHYSICAL_ALIAS', path, 'Meerdere oude records lijken dezelfde fysieke receiver. Deze worden niet automatisch samengevoegd.', { deviceIds: [physicalIds.get(rid), device.id] });
        else physicalIds.set(rid, device.id);
      }
      if (['pending', 'commissioning', 'provisional'].indexOf(device.lifecycle) >= 0 || device.provisional === true || device.pending === true || device.commissioning === true) conflict('PENDING_SETUP', path, 'Een onvoltooide setup mag niet als toegevoegde receiver worden overgenomen.');
      if (device.spiPorts && Object.values(device.spiPorts).some(function (port) { return port && port.enabled === true; })) conflict('EXTRA_PORT_CONFIG', path + '.spiPorts', 'Controleer opgeslagen, mogelijk niet toegewezen SPI-uitgangen voordat ze worden overgenomen.');
    });
    legacy.installations.forEach(function (stand, si) {
      var sp = 'installations[' + si + ']';
      if (!object(stand) || !Array.isArray(stand.zones)) { conflict('STAND_SCHEMA', sp, 'De stand mist zijn zones.'); return; }
      if (nonempty(stand.scenes)) conflict('SCENES_REVIEW', sp + '.scenes', 'Scènes verwijzen nog naar groepen; eerst hun opgeslagen licht en selectie controleren.');
      var nextStand = { id: stand.id, name: stand.name, zones: [] };
      candidate.stands.push(nextStand);
      stand.zones.forEach(function (zone, zi) {
        var zp = sp + '.zones[' + zi + ']';
        if (!object(zone) || !Array.isArray(zone.groups)) { conflict('ZONE_SCHEMA', zp, 'De oude zone mist de expliciete groepenlijst.'); return; }
        if (zone.groups.length > 1) conflict('MULTIPLE_GROUPS', zp + '.groups', 'Deze zone bevat meerdere groepen. Kies bewust hoe hun opstelling, volgorde en lichtgedrag samenkomen.');
        var foundTypes = new Set(), layouts = new Set(), zoneAssignments = [];
        zone.groups.forEach(function (group, gi) {
          var gp = zp + '.groups[' + gi + ']';
          if (!object(group) || !Array.isArray(group.receivers)) { conflict('GROUP_SCHEMA', gp, 'Ongeldige oude groepsstructuur.'); return; }
          layouts.add(String(group.layout) + ':' + String(group.parallelOrientation || 'horizontal'));
          if (nonempty(group.studio)) conflict('STUDIO_REVIEW', gp + '.studio', 'Een opgeslagen Studio-opstelling mag niet ongemerkt verdwijnen.');
          if (!group.receivers.length && nonempty(group.state)) conflict('EMPTY_GROUP_STATE', gp + '.state', 'Deze lege groep bewaart lichtinstellingen. Bepaal waar deze in V30 thuishoren.');
          if (!['line', 'parallel'].includes(group.layout)) conflict('LAYOUT_UNKNOWN', gp + '.layout', 'De oude opstelling is niet eenduidig bekend.');
          if (group.layout === 'parallel' && group.parallelOrientation !== undefined && !['horizontal', 'vertical'].includes(group.parallelOrientation)) conflict('ORIENTATION_UNKNOWN', gp + '.parallelOrientation', 'De oude richting is niet eenduidig bekend.');
          var declaredType = type(group.receiverType);
          if (group.receiverType && !declaredType) conflict('TYPE_UNKNOWN', gp + '.receiverType', 'Het groepstype is niet bekend.');
          if (declaredType) foundTypes.add(declaredType);
          group.receivers.forEach(function (line, li) {
            var lp = gp + '.receivers[' + li + ']';
            if (!object(line) || !devices.has(line.deviceId)) { conflict('ORPHAN_LINE', lp, 'Een LED-line verwijst niet naar een bestaande expliciete deviceId.'); return; }
            if (typeof line.id !== 'string' || !line.id || usedLineIds.has(line.id)) conflict('LINE_ID', lp + '.id', 'Een oude LED-line-ID ontbreekt of is dubbel.');
            else usedLineIds.add(line.id);
            var device = devices.get(line.deviceId), deviceType = type(device.receiverType || device.type);
            if (!deviceType) { conflict('TYPE_UNKNOWN', lp + '.deviceId', 'Het receivertype ontbreekt. Het wordt niet geraden uit de naam of ID.'); return; }
            foundTypes.add(deviceType);
            if ((declaredType && declaredType !== deviceType) || (line.receiverType && type(line.receiverType) !== deviceType)) conflict('TYPE_MISMATCH', lp, 'De receiver en de oude groeps-/LED-linegegevens noemen verschillende types.');
            var port = line.port === undefined ? 1 : line.port;
            if (!Number.isInteger(port) || port < 1 || port > (deviceType === 'RGBW' ? 2 : 4)) { conflict('PORT_UNKNOWN', lp + '.port', 'Een poortnummer is ongeldig of onduidelijk.'); return; }
            var endpoint = JSON.stringify([line.deviceId, port]);
            if (usedEndpointKeys.has(endpoint)) conflict('DUPLICATE_ENDPOINT', lp, 'Dezelfde receiverpoort is meerdere keren toegewezen.');
            usedEndpointKeys.add(endpoint);
            var parallel = object(group.parallelLineStates) ? group.parallelLineStates[line.id] : undefined;
            var lineState = object(group.lineStates) ? group.lineStates[line.id] : undefined;
            if (parallel && lineState && !equivalent(parallel, lineState)) conflict('STATE_AMBIGUOUS', lp, 'Twee opgeslagen individuele lichttoestanden spreken elkaar tegen.');
            var state = parallel || lineState || line.state || group.state;
            if (!object(state)) conflict('STATE_MISSING', lp, 'De lichttoestand ontbreekt; die wordt niet vervangen door een willekeurige kleur.');
            var entry = { device: device, type: deviceType, stand: stand, zone: zone, group: group, line: line, port: port, state: Model.clone(state || {}), path: lp };
            zoneAssignments.push(entry);
            if (!assignments.has(device.id)) assignments.set(device.id, []);
            assignments.get(device.id).push(entry);
          });
        });
        if (layouts.size > 1) conflict('LAYOUT_CONFLICT', zp, 'De oude groepen gebruiken verschillende opstellingen.');
        if (foundTypes.size > 1) conflict('MIXED_ZONE', zp, 'Deze zone mengt RGBW en SPI. V30 heeft daarvoor afzonderlijke zones nodig.');
        var zoneType = foundTypes.size === 1 ? Array.from(foundTypes)[0] : null;
        var group = zone.groups.length === 1 ? zone.groups[0] : null;
        var layout = group && group.layout === 'line' ? 'continuous' : group && group.parallelOrientation === 'vertical' ? 'vertical' : 'stacked';
        if (zoneType === 'RGBW' && layout === 'continuous') conflict('RGBW_LAYOUT', zp, 'RGBW krijgt geen doorlopende pixelopstelling. Kies Onder elkaar of Verticaal.');
        var receiverIds = [];
        zoneAssignments.forEach(function (entry) { if (!receiverIds.includes(entry.device.id)) receiverIds.push(entry.device.id); });
        nextStand.zones.push({ id: zone.id, name: zone.name, type: zoneType, layout: layout, receiverIds: receiverIds });
        // A physical receiver remains one contiguous unit. Interleaved legacy
        // ports A1/B1/A2 cannot silently become A1/A2/B1.
        var completed = new Set(), previous = null;
        zoneAssignments.forEach(function (entry) {
          if (entry.device.id !== previous) {
            if (previous !== null) completed.add(previous);
            if (completed.has(entry.device.id)) conflict('INTERLEAVED_PORTS', entry.path, 'De poorten van deze receiver staan door elkaar met andere receivers; automatische conversie zou de pixelvolgorde veranderen.');
            previous = entry.device.id;
          }
        });
      });
    });
    devices.forEach(function (device, deviceId) {
      var related = assignments.get(deviceId) || [], path = 'devices.' + deviceId;
      if (!related.length) { conflict('UNASSIGNED_RECEIVER', path, 'Deze receiver heeft geen eenduidige stand/zone-toewijzing. Hij wordt niet weggelaten of automatisch gekoppeld.'); return; }
      var first = related[0];
      if (related.some(function (entry) { return entry.stand.id !== first.stand.id || entry.zone.id !== first.zone.id; })) conflict('MULTIPLE_DESTINATIONS', path, 'Uitgangen van één fysieke receiver staan in verschillende zones of stands. Kies eerst één bestemming.');
      if (related.some(function (entry) { return !equivalent(entry.state, first.state); })) conflict(first.type === 'RGBW' ? 'RGBW_PORT_STATES' : 'SPI_PORT_STATES', path, 'Uitgangen van deze receiver hebben verschillende lichttoestanden. Die worden niet stil overschreven.');
      if (first.type === 'RGBW' && ['port1', 'port2', 'separate'].includes(device.rgbwOutputMode)) conflict('RGBW_MODE', path + '.rgbwOutputMode', 'De oude RGBW-poortbediening vraagt een expliciete overgang naar één gezamenlijk receiverlicht.');
      var roles = [];
      if (device.role === 'main' || device.role === 'node') roles.push(device.role);
      if (first.stand.mainReceiverId !== undefined) roles.push(first.stand.mainReceiverId === deviceId ? 'main' : 'node');
      if (!roles.length || roles.some(function (role) { return role !== roles[0]; })) conflict('ROLE_REVIEW', path, 'De hoofdreceiverrol is niet eenduidig opgeslagen. De beveiligde installatie wordt niet opnieuw uitgevonden.');
      var outputs = [];
      if (first.type === 'SPI') {
        var orderedPorts = related.map(function (entry) { return entry.port; });
        if (orderedPorts.some(function (port, i) { return i > 0 && port < orderedPorts[i-1]; })) conflict('PORT_ORDER', path, 'De oude SPI-poorten gebruiken een afwijkende volgorde. Die wordt niet stil veranderd.');
        outputs = [1,2,3,4].map(function (port) {
          var entry = related.find(function (item) { return item.port === port; });
          if (entry && (!Number.isInteger(entry.line.pixels) || entry.line.pixels < 1 || entry.line.pixels > Model.LIMITS.pixelsPerPort)) conflict('PIXELS', entry.path + '.pixels', 'Het pixelgetal is ongeldig.');
          if (entry && entry.line.reversed !== undefined && typeof entry.line.reversed !== 'boolean') conflict('DIRECTION', entry.path + '.reversed', 'De fysieke richting is niet eenduidig.');
          return { port: port, enabled: !!entry, pixels: entry ? entry.line.pixels : 25, reversed: entry ? entry.line.reversed === true : false };
        });
      }
      var receiver = { id: deviceId, name: device.name, type: first.type, standId: first.stand.id, zoneId: first.zone.id,
        role: roles[0] || 'node', lifecycle: 'added', connection: 'unknown', outputs: outputs, state: Model.clone(first.state) };
      if (device.physicalRid || device.rid) receiver.rid = device.physicalRid || device.rid;
      candidate.receivers.push(receiver);
    });
    // Stand access material is retained in the exact source backup only. A
    // candidate is never a license to overwrite identities or credentials.
    return finish();
  }
  return Object.freeze({ preview: preview });
}));
