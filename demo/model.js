(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LightningModel = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var LIMITS = Object.freeze({ spiPorts: 4, pixelsPerPort: 1024, continuousPixels: 8192 });
  var TYPES = ['RGBW', 'SPI'];
  var LAYOUTS = Object.freeze({ RGBW: Object.freeze(['stacked', 'vertical']), SPI: Object.freeze(['continuous', 'stacked', 'vertical']) });
  function allowedLayouts(type) {
    if (type === null || type === 'SPI') return LAYOUTS.SPI;
    if (type === 'RGBW') return LAYOUTS.RGBW;
    return [];
  }
  function object(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (!object(value)) return value;
    var result = {};
    Object.keys(value).forEach(function (key) { Object.defineProperty(result, key, { value: clone(value[key]), enumerable: true, writable: true, configurable: true }); });
    return result;
  }
  function id(value) { return typeof value === 'string' && value.trim().length > 0; }
  function integer(value, min, max) { return Number.isInteger(value) && value >= min && value <= max; }
  function issue(code, message) { var error = new Error(message); error.code = code; throw error; }
  function defaultState() {
    return { engine: 'STATIC', animation: 'Vaste kleur', variant: 0, r: 201, g: 78, b: 70, w: 0,
      bri: 100, brightness: 100, speed: 30, smooth: 90, power: true, colors: ['#c94e46'],
      whiteChannels: [0], rgbEnabled: [true], whiteEnabled: [false], direction: 'right', widthPixels: 4,
      transitionMs: 250, background: '#000000', backgroundOn: false, bgBrightness: 0 };
  }
  function validate(model) {
    var errors = [];
    function add(code, path, message) { errors.push({ code: code, path: path, message: message }); }
    if (!object(model)) return { valid: false, errors: [{ code: 'MODEL', path: '', message: 'Een V30-model is vereist.' }] };
    if (model.schemaVersion !== 30) add('VERSION', 'schemaVersion', 'Dit is geen V30-model.');
    if (Object.prototype.hasOwnProperty.call(model, 'groups')) add('GROUPS_REMOVED', 'groups', 'V30 heeft geen groepenlaag.');
    ['stands', 'receivers', 'scenes', 'presets'].forEach(function (key) { if (!Array.isArray(model[key])) add('COLLECTION', key, 'Deze verzameling moet een lijst zijn.'); });
    if (!Array.isArray(model.stands) || !Array.isArray(model.receivers)) return { valid: false, errors: errors };
    var stands = new Map(), zones = new Map(), receivers = new Map(), rids = new Map(), memberships = new Map();
    model.stands.forEach(function (stand, si) {
      var sp = 'stands[' + si + ']';
      if (!object(stand)) { add('STAND', sp, 'Ongeldige stand.'); return; }
      if (!id(stand.id) || stands.has(stand.id)) add('STAND_ID', sp + '.id', 'Stand-ID ontbreekt of is dubbel.');
      else stands.set(stand.id, stand);
      if (!id(stand.name)) add('NAME', sp + '.name', 'Geef de stand een naam.');
      if (!Array.isArray(stand.zones)) { add('ZONES', sp + '.zones', 'Zones moeten een lijst zijn.'); return; }
      stand.zones.forEach(function (zone, zi) {
        var zp = sp + '.zones[' + zi + ']';
        if (!object(zone)) { add('ZONE', zp, 'Ongeldige zone.'); return; }
        if (!id(zone.id) || zones.has(zone.id)) add('ZONE_ID', zp + '.id', 'Zone-ID ontbreekt of is dubbel.');
        else zones.set(zone.id, { zone: zone, stand: stand, path: zp });
        if (!id(zone.name)) add('NAME', zp + '.name', 'Geef de zone een naam.');
        if (Object.prototype.hasOwnProperty.call(zone, 'groups')) add('GROUPS_REMOVED', zp + '.groups', 'Een V30-zone bevat rechtstreeks receivers.');
        if (zone.type !== null && TYPES.indexOf(zone.type) < 0) add('ZONE_TYPE', zp + '.type', 'Een zone is RGBW, SPI of nog leeg.');
        var allowed = allowedLayouts(zone.type);
        if (allowed.indexOf(zone.layout) < 0) add('LAYOUT', zp + '.layout', 'Deze opstelling past niet bij het zonetype.');
        if (!Array.isArray(zone.receiverIds)) { add('MEMBERS', zp + '.receiverIds', 'Receivers moeten een lijst zijn.'); return; }
        if (zone.receiverIds.length && zone.type === null) add('ZONE_TYPE', zp + '.type', 'Een gevulde zone moet één type hebben.');
        zone.receiverIds.forEach(function (rid, ri) {
          if (!id(rid)) add('RECEIVER_REFERENCE', zp + '.receiverIds[' + ri + ']', 'Receiver-ID ontbreekt.');
          if (memberships.has(rid)) add('DUPLICATE_MEMBERSHIP', zp + '.receiverIds[' + ri + ']', 'Een fysieke receiver hoort bij precies één zone.');
          else memberships.set(rid, zone.id);
        });
      });
    });
    model.receivers.forEach(function (receiver, index) {
      var rp = 'receivers[' + index + ']';
      if (!object(receiver)) { add('RECEIVER', rp, 'Ongeldige receiver.'); return; }
      if (!id(receiver.id) || receivers.has(receiver.id)) add('RECEIVER_ID', rp + '.id', 'Receiver-ID ontbreekt of is dubbel.');
      else receivers.set(receiver.id, receiver);
      if (!id(receiver.name)) add('NAME', rp + '.name', 'Geef de receiver een naam.');
      if (TYPES.indexOf(receiver.type) < 0) add('RECEIVER_TYPE', rp + '.type', 'Een receiver is RGBW of SPI.');
      if (receiver.rid !== undefined && receiver.rid !== '') {
        var physical = typeof receiver.rid === 'string' ? receiver.rid.toUpperCase() : '';
        if (!physical || rids.has(physical)) add('PHYSICAL_ID', rp + '.rid', 'Een fysieke identiteit mag maar één keer bestaan.');
        else rids.set(physical, receiver.id);
      }
      if (!stands.has(receiver.standId)) add('STAND_REFERENCE', rp + '.standId', 'De stand bestaat niet.');
      if (['main', 'node'].indexOf(receiver.role) < 0) add('ROLE', rp + '.role', 'Ongeldige receiverrol.');
      if (['added', 'pending'].indexOf(receiver.lifecycle) < 0) add('LIFECYCLE', rp + '.lifecycle', 'Ongeldige toevoegstatus.');
      if (['unknown', 'online', 'offline'].indexOf(receiver.connection) < 0) add('CONNECTION', rp + '.connection', 'Ongeldige verbindingsstatus.');
      if (receiver.zoneId !== null) {
        var ref = zones.get(receiver.zoneId);
        if (!ref) add('ZONE_REFERENCE', rp + '.zoneId', 'De zone bestaat niet.');
        else {
          if (ref.stand.id !== receiver.standId) add('CROSS_STAND', rp + '.zoneId', 'Een receiver kan niet in een andere stand worden geplaatst.');
          if (ref.zone.type !== receiver.type) add('MIXED_ZONE', rp + '.zoneId', 'RGBW en SPI staan in afzonderlijke zones.');
          if (memberships.get(receiver.id) !== receiver.zoneId) add('MEMBERSHIP', rp + '.zoneId', 'De zonelijst en receiver moeten overeenkomen.');
        }
        if (receiver.lifecycle !== 'added') add('PENDING_MEMBERSHIP', rp + '.zoneId', 'Een onvoltooide setup verschijnt nog niet in een zone.');
      } else if (memberships.has(receiver.id)) add('MEMBERSHIP', rp + '.zoneId', 'Deze receiver staat nog in een zonelijst.');
      if (!Array.isArray(receiver.outputs)) add('OUTPUTS', rp + '.outputs', 'Uitgangen moeten een lijst zijn.');
      else if (receiver.type === 'RGBW') {
        if (receiver.outputs.length) add('RGBW_OUTPUTS', rp + '.outputs', 'RGBW heeft één gezamenlijk lichtgedrag, geen afzonderlijke uitgangen.');
      } else if (receiver.type === 'SPI') {
        if (receiver.outputs.length !== LIMITS.spiPorts) add('SPI_PORT_COUNT', rp + '.outputs', 'SPI bewaart precies vier genummerde uitgangen.');
        var ports = new Set();
        receiver.outputs.forEach(function (output, oi) {
          var op = rp + '.outputs[' + oi + ']';
          if (!object(output)) { add('OUTPUT', op, 'Ongeldige uitgang.'); return; }
          if (!integer(output.port, 1, LIMITS.spiPorts) || ports.has(output.port)) add('PORT', op + '.port', 'Uitgangen zijn uniek genummerd van 1 tot 4.');
          ports.add(output.port);
          if (typeof output.enabled !== 'boolean') add('ENABLED', op + '.enabled', 'De uitgang moet aan of uit staan.');
          if (!integer(output.pixels, 1, LIMITS.pixelsPerPort)) add('PIXELS', op + '.pixels', 'Kies 1–1024 pixels per uitgang.');
          if (typeof output.reversed !== 'boolean') add('DIRECTION', op + '.reversed', 'De fysieke richting moet vastgelegd zijn.');
          if (Object.prototype.hasOwnProperty.call(output, 'state')) add('PORT_STATE', op + '.state', 'Lichtselectie gebeurt per fysieke receiver.');
        });
        if (receiver.lifecycle === 'added' && !receiver.outputs.some(function (output) { return output && output.enabled; })) add('NO_ENABLED_OUTPUT', rp + '.outputs', 'Een toegevoegde SPI-receiver heeft minstens één uitgang nodig.');
      }
      if (!object(receiver.state)) add('LIGHT_STATE', rp + '.state', 'Een receiver moet één lichttoestand hebben.');
      else {
        var ranges = { r: [0,255], g: [0,255], b: [0,255], w: [0,255], bri: [0,100], brightness: [0,100], speed: [0,100], smooth: [0,100], transitionMs: [0,60000], widthPixels: [1,8192] };
        Object.keys(ranges).forEach(function (key) {
          var value = receiver.state[key];
          if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < ranges[key][0] || value > ranges[key][1])) add('STATE_RANGE', rp + '.state.' + key, 'De lichtinstelling ligt buiten het toegestane bereik.');
        });
        if (receiver.state.power !== undefined && typeof receiver.state.power !== 'boolean') add('STATE_POWER', rp + '.state.power', 'Aan/uit moet een schakelstand zijn.');
        if (receiver.state.colors !== undefined && (!Array.isArray(receiver.state.colors) || !receiver.state.colors.length || receiver.state.colors.some(function (color) { return typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color); }))) add('COLORS', rp + '.state.colors', 'Kleuren moeten geldige RGB-kleuren zijn.');
        if (receiver.state.rgbwLast !== undefined) {
          var remembered = receiver.state.rgbwLast;
          if (!object(remembered) || Object.keys(remembered).some(function (scope) {
            var channels = remembered[scope];
            return !/^(static|background|palette[0-7])$/.test(scope) || !object(channels) ||
              Object.keys(channels).some(function (channel) { return !/^[rgbw]$/.test(channel) || !integer(channels[channel], 1, 255); });
          })) add('CHANNEL_MEMORY', rp + '.state.rgbwLast', 'Bewaarde RGBW-kanaalwaarden zijn ongeldig.');
        }
      }
    });
    memberships.forEach(function (zoneId, rid) { if (!receivers.has(rid)) add('ORPHAN_MEMBER', 'zones.' + zoneId, 'Een zonelid bestaat niet in de receiverlijst.'); });
    stands.forEach(function (stand) {
      if (model.receivers.filter(function (r) { return r && r.standId === stand.id && r.role === 'main' && r.lifecycle === 'added'; }).length > 1) add('MULTIPLE_MAIN', 'stands.' + stand.id, 'Een stand heeft maximaal één hoofdreceiver.');
    });
    zones.forEach(function (ref) {
      if (ref.zone.type !== 'SPI' || ref.zone.layout !== 'continuous' || !Array.isArray(ref.zone.receiverIds)) return;
      var total = ref.zone.receiverIds.reduce(function (sum, rid) {
        var receiver = receivers.get(rid);
        return sum + (receiver && Array.isArray(receiver.outputs) ? receiver.outputs.reduce(function (n, p) { return n + (p && p.enabled && Number.isFinite(p.pixels) ? p.pixels : 0); }, 0) : 0);
      }, 0);
      if (total > LIMITS.continuousPixels) add('ZONE_PIXEL_LIMIT', ref.path, 'De huidige doorlopende aansturing ondersteunt maximaal 8192 pixels.');
    });
    return { valid: errors.length === 0, errors: errors };
  }
  function assertValid(model) {
    var result = validate(model);
    if (!result.valid) { var error = new Error(result.errors[0].message); error.code = result.errors[0].code; error.errors = result.errors; throw error; }
    return model;
  }
  function getZone(model, zoneId) {
    for (var si = 0; si < model.stands.length; si++) {
      var zone = model.stands[si].zones.find(function (item) { return item.id === zoneId; });
      if (zone) return zone;
    }
    return null;
  }
  function zoneReceivers(model, zoneId) {
    var zone = getZone(model, zoneId);
    if (!zone) return [];
    return zone.receiverIds.map(function (rid) { return model.receivers.find(function (r) { return r.id === rid && r.zoneId === zone.id && r.lifecycle === 'added'; }); }).filter(Boolean);
  }
  function requireZone(model, zoneId) { var zone = getZone(model, zoneId); if (!zone) issue('ZONE_NOT_FOUND', 'Deze zone bestaat niet.'); return zone; }
  function editName(value) {
    if (typeof value !== 'string' || !value.trim().length || value.trim().length > 64 ||
      /[<>\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/.test(value)) {
      issue('NAME', 'Kies een gewone naam van 1 tot 64 tekens.');
    }
    return value.trim();
  }
  function requireAddedReceiver(model, receiverId) {
    var receiver = model.receivers.find(function (item) { return item.id === receiverId; });
    if (!receiver) issue('RECEIVER_NOT_FOUND', 'Deze receiver bestaat niet.');
    if (receiver.lifecycle !== 'added') issue('RECEIVER_NOT_ADDED', 'Deze receiver is niet toegevoegd. Zoek hem via Receivers.');
    return receiver;
  }
  // These are immutable preview/model edits only. They neither grant ownership
  // nor assert a physical receiver ACK. Identity, credentials, MAIN role and
  // per-output configuration are never changed by placing or naming a unit.
  function createZone(model, standId, fields) {
    assertValid(model);
    var stand = model.stands.find(function (item) { return item.id === standId; });
    if (!stand) issue('STAND_NOT_FOUND', 'Deze stand bestaat niet.');
    if (!object(fields) || [Object.prototype, null].indexOf(Object.getPrototypeOf(fields)) < 0 ||
      Object.keys(fields).some(function (key) { return key !== 'id' && key !== 'name'; }) ||
      typeof fields.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(fields.id)) {
      issue('ZONE_INPUT', 'Geef een geldige zone-ID en naam.');
    }
    if (getZone(model, fields.id)) issue('ZONE_ID', 'Deze zone-ID bestaat al.');
    var name = editName(fields.name), next = clone(model);
    next.stands.find(function (item) { return item.id === standId; }).zones.push({
      id: fields.id, name: name, type: null, layout: 'stacked', receiverIds: []
    });
    return assertValid(next);
  }
  function renameZone(model, zoneId, name) {
    assertValid(model); requireZone(model, zoneId);
    var updatedName = editName(name), next = clone(model);
    getZone(next, zoneId).name = updatedName;
    return assertValid(next);
  }
  function deleteZone(model, zoneId) {
    assertValid(model);
    var zone = requireZone(model, zoneId), members = new Set(zone.receiverIds), next = clone(model);
    var stand = next.stands.find(function (item) { return item.zones.some(function (itemZone) { return itemZone.id === zoneId; }); });
    stand.zones.splice(stand.zones.findIndex(function (item) { return item.id === zoneId; }), 1);
    next.receivers.forEach(function (receiver) { if (members.has(receiver.id)) receiver.zoneId = null; });
    // Removing a zone only releases its membership. Receivers, credentials,
    // stand membership and saved scenes/presets retain their existing data.
    return assertValid(next);
  }
  function renameReceiver(model, receiverId, name) {
    assertValid(model); requireAddedReceiver(model, receiverId);
    var updatedName = editName(name), next = clone(model);
    next.receivers.find(function (item) { return item.id === receiverId; }).name = updatedName;
    return assertValid(next);
  }
  function assignReceiverToZone(model, receiverId, zoneId) {
    assertValid(model);
    var receiver = requireAddedReceiver(model, receiverId), destination = requireZone(model, zoneId);
    var destinationStand = model.stands.find(function (item) { return item.zones.some(function (zone) { return zone.id === zoneId; }); });
    if (destinationStand.id !== receiver.standId) issue('CROSS_STAND', 'Een receiver blijft bij zijn eigen stand.');
    if (destination.type !== null && destination.type !== receiver.type) issue('MIXED_ZONE', 'Plaats RGBW en SPI in afzonderlijke zones.');
    var next = clone(model), updated = next.receivers.find(function (item) { return item.id === receiverId; });
    // Re-selecting the current zone never moves a receiver to the end.
    if (receiver.zoneId === zoneId) return assertValid(next);
    if (receiver.zoneId !== null) {
      var origin = getZone(next, receiver.zoneId);
      origin.receiverIds.splice(origin.receiverIds.indexOf(receiverId), 1);
    }
    var target = getZone(next, zoneId);
    if (target.type === null) { target.type = receiver.type; target.layout = 'stacked'; }
    target.receiverIds.push(receiverId); updated.zoneId = zoneId;
    // Includes all enabled SPI outputs/offline slots and the 8192-pixel limit
    // in a continuous destination. Rejection cannot mutate the caller's model.
    return assertValid(next);
  }
  function unassignReceiver(model, receiverId) {
    assertValid(model);
    var receiver = requireAddedReceiver(model, receiverId), next = clone(model);
    if (receiver.zoneId !== null) {
      var origin = getZone(next, receiver.zoneId);
      origin.receiverIds.splice(origin.receiverIds.indexOf(receiverId), 1);
      next.receivers.find(function (item) { return item.id === receiverId; }).zoneId = null;
    }
    // An empty typed zone keeps its type/layout; this is not device deletion,
    // release, reset or a change to stand membership.
    return assertValid(next);
  }
  function selectionIds(model, zoneId, selection) {
    requireZone(model, zoneId);
    var receivers = zoneReceivers(model, zoneId);
    if (!selection || !['all', 'receiver', 'receivers'].includes(selection.kind)) issue('SELECTION', 'Kies Alle ledlines of één of meer ledlines.');
    if (selection.kind === 'all') return receivers.map(function (r) { return r.id; });
    var requested = selection.kind === 'receiver' ? [selection.receiverId] : selection.receiverIds;
    if (!Array.isArray(requested) || !requested.length || requested.some(function (id) { return typeof id !== 'string'; })) issue('SELECTION', 'Kies minstens één ledline.');
    var unique = new Set(requested);
    if (unique.size !== requested.length) issue('SELECTION', 'Een ledline mag maar één keer gekozen zijn.');
    if (requested.some(function (id) { return !receivers.some(function (r) { return r.id === id; }); })) issue('TARGET_OUTSIDE_ZONE', 'Een gekozen ledline hoort niet bij de actieve zone.');
    // Preserve configured zone order regardless of tap order.
    return receivers.filter(function (receiver) { return unique.has(receiver.id); }).map(function (receiver) { return receiver.id; });
  }
  function resolveTargets(model, zoneId, selection) {
    assertValid(model);
    var zone = requireZone(model, zoneId), selected = selectionIds(model, zoneId, selection), receivers = zoneReceivers(model, zoneId), offset = 0;
    var targets = [];
    receivers.forEach(function (receiver, receiverIndex) {
      var outputs = receiver.type === 'RGBW' ? [{ port: 0, pixels: 1, reversed: false }] : receiver.outputs.filter(function (p) { return p.enabled; }).slice().sort(function (a,b) { return a.port - b.port; });
      var localOffset = 0;
      outputs.forEach(function (output) {
        targets.push({ id: receiver.id + ':' + output.port, receiverId: receiver.id, deviceId: receiver.id, rid: receiver.rid || '',
          type: receiver.type, port: output.port, pixels: output.pixels, offset: offset, localOffset: localOffset,
          reversed: output.reversed, receiverIndex: receiverIndex, receiverCount: receivers.length,
          connection: receiver.connection, layout: zone.layout, state: clone(receiver.state) });
        offset += output.pixels; localOffset += output.pixels;
      });
    });
    return targets.map(function (target, index) { return Object.assign(target, { groupPixels: offset, totalPixels: offset, lineIndex: index, lineCount: targets.length }); }).filter(function (target) { return selected.indexOf(target.receiverId) >= 0; });
  }
  function applyState(model, zoneId, selection, patch) {
    assertValid(model);
    if (!object(patch)) issue('STATE_PATCH', 'Een lichtwijziging is vereist.');
    if (['groupPixels', 'offset', 'receiverId', 'port', 'ports', 'outputs', 'reversed', '__proto__', 'constructor', 'prototype'].some(function (key) { return Object.prototype.hasOwnProperty.call(patch, key); })) issue('GEOMETRY_PATCH', 'Lichtbediening mag de receiverindeling niet wijzigen.');
    var selected = selectionIds(model, zoneId, selection), next = clone(model);
    next.receivers.forEach(function (receiver) { if (selected.indexOf(receiver.id) >= 0) receiver.state = Object.assign({}, receiver.state, clone(patch)); });
    return assertValid(next);
  }
  function setLayout(model, zoneId, layout) {
    assertValid(model);
    var zone = requireZone(model, zoneId), allowed = allowedLayouts(zone.type);
    if (allowed.indexOf(layout) < 0) issue('LAYOUT', 'Deze opstelling past niet bij dit type receiver.');
    var next = clone(model); getZone(next, zoneId).layout = layout; return assertValid(next);
  }
  function applyStandState(model, standId, patch) {
    assertValid(model);
    if (!model.stands.some(function (stand) { return stand.id === standId; })) issue('STAND_REFERENCE', 'Deze stand bestaat niet.');
    // Whole-stand shortcuts intentionally expose only common light controls;
    // no output mapping, pairing, zone membership or effect geometry may leak.
    var allowed = ['on','power','r','g','b','w','bri','brightness','colors','whiteChannels','rgbEnabled','whiteEnabled','rgbwLast','colorCount',
      'engine','variant','v30Effect','category','animation','previewFamily','legacySpi','bounce','mirror'];
    if (!object(patch) || Object.keys(patch).some(function (key) { return allowed.indexOf(key) < 0; }) ||
        patch.engine !== undefined && patch.engine !== 'STATIC') issue('STAND_STATE_PATCH', 'Gebruik vaste kleur of aan/uit voor de hele stand.');
    var next = clone(model);
    next.receivers.forEach(function (receiver) {
      if (receiver.standId === standId && receiver.lifecycle === 'added') receiver.state = Object.assign({}, receiver.state, clone(patch));
    });
    return assertValid(next);
  }
  function reorderReceivers(model, zoneId, orderedReceiverIds) {
    assertValid(model);
    var zone = requireZone(model, zoneId);
    if (!Array.isArray(orderedReceiverIds)) issue('RECEIVER_ORDER', 'Geef de volledige receivervolgorde als lijst.');
    if (orderedReceiverIds.length !== zone.receiverIds.length) issue('RECEIVER_ORDER_LENGTH', 'Alle receivers van deze zone moeten in de volgorde blijven staan.');
    var members = new Set(zone.receiverIds), seen = new Set();
    // Iterate indices deliberately: Array.every would skip holes, which must
    // never turn an incomplete drag result into a silently shortened zone.
    for (var index = 0; index < orderedReceiverIds.length; index++) {
      var receiverId = orderedReceiverIds[index];
      if (!id(receiverId) || !members.has(receiverId)) issue('RECEIVER_ORDER_MEMBER', 'Gebruik alleen de toegevoegde receivers van deze zone.');
      if (seen.has(receiverId)) issue('RECEIVER_ORDER_DUPLICATE', 'Iedere receiver mag precies één keer in de volgorde staan.');
      seen.add(receiverId);
    }
    // Spatial order is independent of identity, receiver number and MAIN role.
    // Keep offline receivers in the same geometry, and leave SPI port order,
    // reversal, pixel counts and each physical receiver's light state intact.
    var next = clone(model);
    getZone(next, zoneId).receiverIds = orderedReceiverIds.slice();
    return assertValid(next);
  }
  function moveReceiver(model, zoneId, receiverId, toIndex) {
    assertValid(model);
    var zone = requireZone(model, zoneId), fromIndex = zone.receiverIds.indexOf(receiverId);
    if (fromIndex < 0) issue('TARGET_OUTSIDE_ZONE', 'Deze receiver hoort niet bij de actieve zone.');
    if (!integer(toIndex, 0, zone.receiverIds.length - 1)) issue('RECEIVER_ORDER_INDEX', 'Kies een bestaande positie binnen deze zone.');
    var ordered = zone.receiverIds.slice();
    ordered.splice(fromIndex, 1);
    ordered.splice(toIndex, 0, receiverId);
    return reorderReceivers(model, zoneId, ordered);
  }
  function configureSpiOutput(model, receiverId, port, patch) {
    assertValid(model);
    var receiver = model.receivers.find(function (r) { return r.id === receiverId; });
    if (!receiver || receiver.type !== 'SPI') issue('SPI_RECEIVER', 'Kies een SPI-receiver.');
    if (!integer(port, 1, 4)) issue('PORT', 'Kies uitgang 1, 2, 3 of 4.');
    if (!object(patch) || Object.keys(patch).some(function (key) { return ['enabled', 'pixels', 'reversed'].indexOf(key) < 0; })) issue('OUTPUT_PATCH', 'Wijzig alleen pixels, aansluiting of het gebruik van de uitgang.');
    var next = clone(model), updated = next.receivers.find(function (r) { return r.id === receiverId; });
    Object.assign(updated.outputs.find(function (p) { return p.port === port; }), clone(patch));
    return assertValid(next);
  }
  return Object.freeze({ LIMITS: LIMITS, clone: clone, defaultState: defaultState, validate: validate, assertValid: assertValid, getZone: getZone,
    zoneReceivers: zoneReceivers, resolveTargets: resolveTargets, applyState: applyState, applyStandState: applyStandState, setLayout: setLayout,
    createZone: createZone, renameZone: renameZone, deleteZone: deleteZone, renameReceiver: renameReceiver,
    assignReceiverToZone: assignReceiverToZone, unassignReceiver: unassignReceiver,
    reorderReceivers: reorderReceivers, moveReceiver: moveReceiver, configureSpiOutput: configureSpiOutput });
}));
