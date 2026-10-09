(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LightningModel = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var LIMITS = Object.freeze({ spiPorts: 4, pixelsPerPort: 1024, continuousPixels: 8192 });
  var DEFAULT_SPI_PIXELS = 20;
  // The editor's light-point width is not physical strip length. Keep the
  // STATIC membership baseline below unchanged for existing native journals.
  var DEFAULT_ANIMATION_WIDTH = 20;
  var TYPES = ['RGBW', 'SPI'];
  // Port deltas cross the same durable light boundary as scalar settings.
  // No geometry, credentials, shared marker or nested port map belongs here.
  var PORT_LIGHT_FIELDS = new Set(('engine animation effectId category variant r g b w bri brightness speed smooth on power colors whiteChannels rgbEnabled whiteEnabled direction widthPixels transitionMs background backgroundOn bgBrightness fadeAmount width delayMs brandColor motionReverse spacing objectCount trailLength spread randomness bounce mirror phaseMs phaseRateMicroHz previewStartedAt rgbwLast previewFamily backgroundBrightness backgroundRgbEnabled backgroundWhite backgroundWhiteEnabled colorCount legacySpi lineDelayMs v30Effect').split(' '));
  var PORT_NULLABLE_FIELDS = new Set(('effectId category v30Effect previewFamily rgbwLast brandColor speed smooth colorCount widthPixels objectCount trailLength spacing direction lineDelayMs spread randomness fadeAmount delayMs width').split(' '));
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
  function validChannelMemory(value) {
    return object(value) && [Object.prototype,null].includes(Object.getPrototypeOf(value)) && Object.keys(value).every(function (scope) {
      var channels=value[scope];
      return /^(static|background|palette[0-7])$/.test(scope) && object(channels) && [Object.prototype,null].includes(Object.getPrototypeOf(channels)) &&
        Object.keys(channels).every(function (channel) { return /^[rgbw]$/.test(channel) && integer(channels[channel],1,255); });
    });
  }
  function validPortLightState(state) {
    if(!object(state)||![Object.prototype,null].includes(Object.getPrototypeOf(state))||!Object.keys(state).length||Object.keys(state).length>64)return false;
    var ranges={r:[0,255],g:[0,255],b:[0,255],w:[0,255],backgroundWhite:[0,255],bri:[0,100],brightness:[0,100],speed:[0,100],smooth:[0,100],width:[0,100],spacing:[0,100],spread:[0,100],randomness:[0,100],trailLength:[0,100],fadeAmount:[0,100],bgBrightness:[0,100],backgroundBrightness:[0,100],widthPixels:[1,8192],objectCount:[1,128],variant:[0,65535],colorCount:[1,16],transitionMs:[0,60000],lineDelayMs:[0,60000],delayMs:[0,60000],phaseMs:[0,Number.MAX_SAFE_INTEGER],phaseRateMicroHz:[0,Number.MAX_SAFE_INTEGER],previewStartedAt:[0,Number.MAX_SAFE_INTEGER]};
    var booleans=new Set(('on power backgroundOn backgroundRgbEnabled backgroundWhiteEnabled motionReverse bounce mirror legacySpi').split(' '));
    return Object.keys(state).every(function (key) {
      var value=state[key];if(!PORT_LIGHT_FIELDS.has(key))return false;
      if(value===null)return PORT_NULLABLE_FIELDS.has(key);
      if(Object.prototype.hasOwnProperty.call(ranges,key))return typeof value==='number'&&Number.isFinite(value)&&value>=ranges[key][0]&&value<=ranges[key][1]&&(!['objectCount','variant','colorCount'].includes(key)||Number.isInteger(value));
      if(booleans.has(key))return typeof value==='boolean';
      if(['colors','whiteChannels','rgbEnabled','whiteEnabled'].includes(key))return Array.isArray(value)&&value.length>=1&&value.length<=16&&Array.from(value).every(function (item) { return key==='colors'?typeof item==='string'&&/^#[0-9a-f]{6}$/i.test(item):key==='whiteChannels'?typeof item==='number'&&Number.isFinite(item)&&item>=0&&item<=255:typeof item==='boolean'; });
      if(key==='rgbwLast')return validChannelMemory(value);
      if(key==='engine')return typeof value==='string'&&/^[A-Z][A-Z0-9_-]{0,31}$/.test(value);
      if(key==='animation')return typeof value==='string'&&value.trim().length>0&&value.length<=120&&!/[\u0000-\u001f\u007f]/.test(value);
      if(key==='direction')return ['right','left','forward','reverse','backward','up','down','center-out','outside-in','bounce'].includes(value);
      if(key==='category')return ['whole','pixels','tunnel','brand'].includes(value);
      if(key==='previewFamily')return TYPES.includes(value);
      if(key==='effectId'||key==='v30Effect')return typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(value);
      if(key==='brandColor')return typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
      if(key==='background')return typeof value==='string'?/^#[0-9a-f]{6}$/i.test(value):object(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value))&&Object.keys(value).every(function (name) { return ['rgb','white'].includes(name); })&&typeof value.rgb==='string'&&/^#[0-9a-f]{6}$/i.test(value.rgb)&&typeof value.white==='number'&&Number.isFinite(value.white)&&value.white>=0&&value.white<=255;
      return false;
    });
  }
  function issue(code, message) { var error = new Error(message); error.code = code; throw error; }
  function defaultState() {
    return { engine: 'STATIC', animation: 'Vaste kleur', variant: 0, r: 201, g: 78, b: 70, w: 0,
      bri: 100, brightness: 100, speed: 30, smooth: 100, power: true, colors: ['#c94e46'],
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
        if (Object.prototype.hasOwnProperty.call(receiver.state,'portStates')) {
          var overrides = receiver.state.portStates;
          if (receiver.type !== 'SPI' || !object(overrides) || ![Object.prototype,null].includes(Object.getPrototypeOf(overrides)) ||
              Object.keys(overrides).length > LIMITS.spiPorts || Object.keys(overrides).some(function (port) {
                var state = overrides[port];
                return !/^[1-4]$/.test(port) || !receiver.outputs.some(function (output) { return output.port === Number(port) && output.enabled; }) ||
                  !validPortLightState(state);
              })) add('PORT_LIGHT_STATE', rp + '.state.portStates', 'Kies alleen lichtinstellingen van actieve SPI-ledlines.');
        }
      }
    });
    memberships.forEach(function (zoneId, rid) { if (!receivers.has(rid)) add('ORPHAN_MEMBER', 'zones.' + zoneId, 'Een zonelid bestaat niet in de receiverlijst.'); });
    stands.forEach(function (stand) {
      if (model.receivers.filter(function (r) { return r && r.standId === stand.id && r.role === 'main' && r.lifecycle === 'added'; }).length > 1) add('MULTIPLE_MAIN', 'stands.' + stand.id, 'De receiverindeling van deze stand is ongeldig.');
    });
    zones.forEach(function (ref) {
      if (Object.prototype.hasOwnProperty.call(ref.zone, 'lineOrder')) {
        var expected = physicalLines(model, ref.zone.id).map(function (line) { return line.id; });
        var order = ref.zone.lineOrder, seen = new Set();
        if (!Array.isArray(order) || order.length !== expected.length) add('LINE_ORDER', ref.path + '.lineOrder', 'Neem iedere actieve fysieke ledline precies één keer op.');
        else for (var li = 0; li < order.length; li++) {
          if (!Object.prototype.hasOwnProperty.call(order, li) || typeof order[li] !== 'string' || expected.indexOf(order[li]) < 0 || seen.has(order[li])) {
            add('LINE_ORDER', ref.path + '.lineOrder[' + li + ']', 'Gebruik alleen unieke actieve ledlines van deze zone.');
          }
          seen.add(order[li]);
        }
      }
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
  function standZoneReceivers(model, standId) {
    assertValid(model);
    var stand = model.stands.find(function (item) { return item.id === standId; });
    if (!stand) issue('STAND_REFERENCE', 'Deze stand bestaat niet.');
    // "Alles bedienen" means all configured zones, not spare/unassigned
    // hardware. Keep exactly the same membership and order as zone control.
    return stand.zones.reduce(function (result, zone) {
      return result.concat(zoneReceivers(model, zone.id));
    }, []);
  }
  function requireZone(model, zoneId) { var zone = getZone(model, zoneId); if (!zone) issue('ZONE_NOT_FOUND', 'Deze zone bestaat niet.'); return zone; }
  function physicalLines(model, zoneId) {
    var lines = [], zone = null;
    model.stands.forEach(function (stand) { if (stand && Array.isArray(stand.zones)) stand.zones.forEach(function (item) { if (item && item.id === zoneId) zone = item; }); });
    if (!zone || !Array.isArray(zone.receiverIds)) return lines;
    zone.receiverIds.map(function (rid) { return model.receivers.find(function (receiver) { return receiver && receiver.id === rid && receiver.zoneId === zoneId && receiver.lifecycle === 'added'; }); }).filter(Boolean).forEach(function (receiver, receiverIndex) {
      var localOffset = 0;
      var ports = receiver.type === 'RGBW' ? [{ port: 0, pixels: 1, reversed: false }] :
        (Array.isArray(receiver.outputs) ? receiver.outputs.filter(function (p) { return p && p.enabled === true; }).slice().sort(function (a,b) { return a.port-b.port; }) : []);
      ports.forEach(function (port) {
        lines.push({ id: receiver.id + ':' + port.port, receiver: receiver, output: port, receiverIndex: receiverIndex, localOffset: localOffset });
        localOffset += port.pixels;
      });
    });
    return lines;
  }
  function lineIds(model, zoneId) {
    assertValid(model);
    var zone = requireZone(model, zoneId);
    return Object.prototype.hasOwnProperty.call(zone, 'lineOrder') ? zone.lineOrder.slice() : physicalLines(model, zoneId).map(function (line) { return line.id; });
  }
  function ledlines(receivers, lineOrder) {
    if (!Array.isArray(receivers)) issue('RECEIVERS', 'Receivers moeten een lijst zijn.');
    var lines = [];
    receivers.forEach(function (receiver, receiverIndex) {
      if (!object(receiver) || TYPES.indexOf(receiver.type) < 0) return;
      var seen = new Set(), localOffset = 0;
      var outputs = receiver.type === 'RGBW' ? [{ port: 0, pixels: 1, reversed: false }] :
        (Array.isArray(receiver.outputs) ? receiver.outputs : []).filter(function (output) {
          return object(output) && output.enabled === true && integer(output.port, 1, LIMITS.spiPorts) && integer(output.pixels, 1, 8192);
        }).slice().sort(function (a,b) { return a.port-b.port; });
      outputs.forEach(function (output) {
        if (seen.has(output.port)) return;
        seen.add(output.port);
        lines.push({ id: receiver.id + ':' + output.port, receiverId: receiver.id, type: receiver.type,
          port: output.port, pixels: output.pixels, reversed: Boolean(output.reversed),
          localOffset: localOffset, receiverIndex: receiverIndex, receiverCount: receivers.length });
        localOffset += output.pixels;
      });
    });
    if (lineOrder !== undefined) {
      var byId = new Map(lines.map(function (line) { return [line.id, line]; })), seen = new Set();
      if (!Array.isArray(lineOrder) || lineOrder.length !== lines.length || byId.size !== lines.length) issue('LINE_ORDER', 'Neem iedere actieve fysieke ledline op.');
      for (var oi = 0; oi < lineOrder.length; oi++) if (!Object.prototype.hasOwnProperty.call(lineOrder,oi)) issue('LINE_ORDER', 'Een ledlinepositie mag niet ontbreken.');
      lines = Array.from(lineOrder, function (lineId) {
        if (typeof lineId !== 'string' || !byId.has(lineId) || seen.has(lineId)) issue('LINE_ORDER', 'Gebruik iedere actieve ledline precies één keer.');
        seen.add(lineId); return byId.get(lineId);
      });
    }
    var offset = 0, total = lines.reduce(function (sum,line) { return sum+line.pixels; },0);
    return Object.freeze(lines.map(function (line,index) {
      var result = Object.freeze(Object.assign(line,{offset:offset,lineIndex:index,lineCount:lines.length,totalPixels:total}));
      offset += line.pixels; return result;
    }));
  }
  function zoneLedlines(model, zoneId) { return ledlines(zoneReceivers(model,zoneId),lineIds(model,zoneId)); }
  // Only an authenticated/topology edit calls this. Keep surviving physical
  // identities in place; append newly enabled/assigned lines, never renumber ports.
  function reconcileLineOrders(model) {
    model.stands.forEach(function (stand) { stand.zones.forEach(function (zone) {
      if (!Object.prototype.hasOwnProperty.call(zone, 'lineOrder')) return;
      var expected = physicalLines(model, zone.id).map(function (line) { return line.id; });
      zone.lineOrder = zone.lineOrder.filter(function (lineId) { return expected.indexOf(lineId) >= 0; });
      expected.forEach(function (lineId) { if (zone.lineOrder.indexOf(lineId) < 0) zone.lineOrder.push(lineId); });
    }); });
    return model;
  }
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
    // Bind the initial geometry only once. Saved choices (even when a typed
    // zone has become empty) are never replaced by this new-zone default.
    if (target.type === null) { target.type = receiver.type; target.layout = receiver.type === 'SPI' ? 'continuous' : 'stacked'; }
    target.receiverIds.push(receiverId); updated.zoneId = zoneId;
    reconcileLineOrders(next);
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
      reconcileLineOrders(next);
    }
    // An empty typed zone keeps its type/layout; this is not device deletion,
    // release, reset or a change to stand membership.
    return assertValid(next);
  }
  function moveReceivers(model, receiverIds, zoneId) {
    assertValid(model);
    if (!Array.isArray(receiverIds) || !receiverIds.length || receiverIds.length > 128 ||
      receiverIds.some(function (id) { return typeof id !== 'string'; }) ||
      new Set(receiverIds).size !== receiverIds.length ||
      !(zoneId === null || typeof zoneId === 'string')) {
      issue('RECEIVER_SELECTION', 'Kies één of meer verschillende ledlines.');
    }
    var next = clone(model);
    receiverIds.forEach(function (receiverId) {
      next = zoneId === null ? unassignReceiver(next, receiverId) : assignReceiverToZone(next, receiverId, zoneId);
    });
    return assertValid(next);
  }
  function lightStateFor(receiver, port) {
    var base = clone(receiver.state || {}); delete base.portStates;
    var override = receiver.type === 'SPI' && receiver.state && receiver.state.portStates && receiver.state.portStates[String(port)];
    if (!override) return base;
    var effective=base,delta=clone(override);
    Object.keys(delta).forEach(function (key) {
      if(delta[key]===null&&PORT_NULLABLE_FIELDS.has(key))delete effective[key];
      else effective[key]=delta[key];
    });
    if (Object.prototype.hasOwnProperty.call(override,'brightness')) effective.bri=override.brightness;
    if (Object.prototype.hasOwnProperty.call(override,'power')) effective.on=override.power;
    return effective;
  }
  function selectionLines(model, zoneId, selection) {
    var zone=requireZone(model,zoneId), lines=zoneLedlines(model,zoneId);
    if (!selection || !['all','receiver','receivers','line','lines'].includes(selection.kind)) issue('SELECTION', 'Kies Alle ledlines of één of meer ledlines.');
    if (selection.kind === 'all') return lines;
    if (selection.kind === 'line' || selection.kind === 'lines') {
      if (zone.type !== 'SPI' || zone.layout === 'continuous') issue('LINE_SELECTION_LAYOUT', 'Een doorlopende ledline bedien je samen.');
      var requested=selection.kind === 'line' ? [selection.lineId] : selection.lineIds;
      if (!Array.isArray(requested) || !requested.length || requested.length > lines.length ||
          Array.from(requested).some(function (id) { return typeof id !== 'string'; }) || new Set(requested).size !== requested.length) issue('SELECTION','Kies iedere ledline maximaal één keer.');
      var wanted=new Set(requested);
      if (requested.some(function (id) { return !lines.some(function (line) { return line.id === id; }); })) issue('TARGET_OUTSIDE_ZONE','Deze ledline is niet actief in de gekozen zone.');
      return lines.filter(function (line) { return wanted.has(line.id); });
    }
    var ids=selectionIds(model,zoneId,selection);
    return lines.filter(function (line) { return ids.indexOf(line.receiverId) >= 0; });
  }
  function selectionIds(model, zoneId, selection) {
    requireZone(model, zoneId);
    var receivers = zoneReceivers(model, zoneId);
    if (selection && ['line','lines'].includes(selection.kind)) {
      var members=new Set(selectionLines(model,zoneId,selection).map(function (line) { return line.receiverId; }));
      return receivers.filter(function (receiver) { return members.has(receiver.id); }).map(function (receiver) { return receiver.id; });
    }
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
    var zone = requireZone(model, zoneId), selected = new Set(selectionLines(model,zoneId,selection).map(function (line) { return line.id; })), receivers = zoneReceivers(model, zoneId), offset = 0;
    var physical = physicalLines(model, zoneId), byId = new Map(physical.map(function (line) { return [line.id, line]; }));
    var ordered = Object.prototype.hasOwnProperty.call(zone, 'lineOrder') ? zone.lineOrder.map(function (id) { return byId.get(id); }) : physical;
    var targets = [];
    ordered.forEach(function (line) {
      var receiver = line.receiver, output = line.output;
        targets.push({ id: line.id, receiverId: receiver.id, deviceId: receiver.id, rid: receiver.rid || '',
          type: receiver.type, port: output.port, pixels: output.pixels, offset: offset, localOffset: line.localOffset,
          reversed: output.reversed, receiverIndex: line.receiverIndex, receiverCount: receivers.length,
          connection: receiver.connection, layout: zone.layout, state: zone.layout === 'continuous' ? lightStateFor(receiver,0) : lightStateFor(receiver,output.port) });
        offset += output.pixels;
    });
    return targets.map(function (target, index) { return Object.assign(target, { groupPixels: offset, totalPixels: offset, lineIndex: index, lineCount: targets.length }); }).filter(function (target) { return selected.has(target.id); });
  }
  function applyState(model, zoneId, selection, patch) {
    assertValid(model);
    if (!object(patch)) issue('STATE_PATCH', 'Een lichtwijziging is vereist.');
    if (['groupPixels', 'offset', 'lineOrder', 'lineIndex', 'lineCount', 'receiverId', 'port', 'ports', 'outputs', 'reversed', 'portStates', '__proto__', 'constructor', 'prototype'].some(function (key) { return Object.prototype.hasOwnProperty.call(patch, key); })) issue('GEOMETRY_PATCH', 'Lichtbediening mag de receiverindeling niet wijzigen.');
    var selected = selectionIds(model, zoneId, selection), next = clone(model);
    if (selection.kind === 'line' || selection.kind === 'lines') {
      var chosen=selectionLines(model,zoneId,selection), standId=requireZone(model,zoneId) && next.stands.find(function (stand) { return stand.zones.some(function (zone) { return zone.id === zoneId; }); }).id;
      if (Object.keys(patch).some(function (key) { return key !== 'rgbwLast'; })) next.receivers.forEach(function (receiver) { if (receiver.standId === standId) delete receiver.state.standAnimation; });
      chosen.forEach(function (line) {
        var receiver=next.receivers.find(function (item) { return item.id === line.receiverId; }), normalized=clone(patch);
        if (Object.prototype.hasOwnProperty.call(normalized,'bri') && !Object.prototype.hasOwnProperty.call(normalized,'brightness')) normalized.brightness=normalized.bri;
        if (Object.prototype.hasOwnProperty.call(normalized,'on') && !Object.prototype.hasOwnProperty.call(normalized,'power')) normalized.power=normalized.on;
        // Catalogue hints are resolved from the real device/recipe. They do
        // not change light, and are not part of the central sparse contract.
        delete normalized.receiverType;delete normalized.speedMode;
        var state=Object.assign(lightStateFor(receiver,line.port),normalized);
        delete state.standAnimation;
        var base=lightStateFor(receiver,0), override={};
        Object.keys(state).forEach(function (key) { if (JSON.stringify(state[key]) !== JSON.stringify(base[key])) override[key]=clone(state[key]); });
        Object.keys(base).forEach(function (key) { if(!Object.prototype.hasOwnProperty.call(state,key)&&PORT_NULLABLE_FIELDS.has(key))override[key]=null; });
        delete override.bri;delete override.on;
        if (!receiver.state.portStates) receiver.state.portStates={};
        if (Object.keys(override).length) receiver.state.portStates[String(line.port)]=override;
        else delete receiver.state.portStates[String(line.port)];
        if (!Object.keys(receiver.state.portStates).length) delete receiver.state.portStates;
      });
    } else next.receivers.forEach(function (receiver) {
      if (selected.indexOf(receiver.id) < 0) return;
      receiver.state = Object.assign({}, receiver.state, clone(patch));delete receiver.state.portStates;
    });
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
      'engine','variant','backgroundOn','v30Effect','category','animation','previewFamily','legacySpi','bounce','mirror'];
    if (!object(patch) || Object.keys(patch).some(function (key) { return allowed.indexOf(key) < 0; }) ||
        patch.engine !== undefined && patch.engine !== 'STATIC' ||
        patch.backgroundOn !== undefined && patch.backgroundOn !== false) issue('STAND_STATE_PATCH', 'Gebruik vaste kleur of aan/uit voor de hele stand.');
    var selected = new Set(standZoneReceivers(model, standId).map(function (receiver) { return receiver.id; }));
    var next = clone(model);
    next.receivers.forEach(function (receiver) {
      if (selected.has(receiver.id)) { receiver.state = Object.assign({}, receiver.state, clone(patch));delete receiver.state.portStates; }
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
  function arrangeZone(model, zoneId, arrangement) {
    assertValid(model);
    var zone = requireZone(model, zoneId);
    if (!object(arrangement) || Object.keys(arrangement).length !== 2 ||
        !Object.prototype.hasOwnProperty.call(arrangement, 'layout') || !Object.prototype.hasOwnProperty.call(arrangement, 'receiverIds')) {
      issue('ARRANGEMENT', 'Kies een opstelling en de volledige ledlinevolgorde.');
    }
    if (allowedLayouts(zone.type).indexOf(arrangement.layout) < 0) issue('LAYOUT', 'Deze opstelling past niet bij dit type receiver.');
    // Validate exact membership before changing either part. The result is a
    // single immutable metadata transaction; current light states, outputs,
    // identity and unrelated zones never participate in an arrangement edit.
    var next = reorderReceivers(model, zoneId, arrangement.receiverIds);
    getZone(next, zoneId).layout = arrangement.layout;
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
  function arrangeLines(model, zoneId, arrangement) {
    assertValid(model);
    var zone = requireZone(model, zoneId);
    if (!object(arrangement) || Object.keys(arrangement).length !== 2 ||
        !Object.prototype.hasOwnProperty.call(arrangement, 'layout') || !Object.prototype.hasOwnProperty.call(arrangement, 'lineOrder')) issue('ARRANGEMENT', 'Kies een opstelling en alle fysieke ledlines.');
    if (allowedLayouts(zone.type).indexOf(arrangement.layout) < 0) issue('LAYOUT', 'Deze opstelling past niet bij dit type receiver.');
    // Validate the caller's actual array before cloning; inherited numeric
    // properties must not fill a sparse drag result during Array.map/JSON.
    ledlines(zoneReceivers(model,zoneId),arrangement.lineOrder);
    if (!Array.isArray(arrangement.lineOrder)) issue('LINE_ORDER', 'Geef alle fysieke ledlines als lijst.');
    var next = clone(model), target = getZone(next, zoneId);
    target.layout = arrangement.layout; target.lineOrder = clone(arrangement.lineOrder);
    return assertValid(next);
  }
  function configureSpiOutput(model, receiverId, port, patch) {
    assertValid(model);
    var receiver = model.receivers.find(function (r) { return r.id === receiverId; });
    if (!receiver || receiver.type !== 'SPI') issue('SPI_RECEIVER', 'Kies een SPI-receiver.');
    if (!integer(port, 1, 4)) issue('PORT', 'Kies uitgang 1, 2, 3 of 4.');
    if (!object(patch) || Object.keys(patch).some(function (key) { return ['enabled', 'pixels', 'reversed'].indexOf(key) < 0; })) issue('OUTPUT_PATCH', 'Wijzig alleen pixels, aansluiting of het gebruik van de uitgang.');
    var next = clone(model), updated = next.receivers.find(function (r) { return r.id === receiverId; });
    Object.assign(updated.outputs.find(function (p) { return p.port === port; }), clone(patch));
    if (patch.enabled === false && updated.state.portStates) { delete updated.state.portStates[String(port)];if (!Object.keys(updated.state.portStates).length) delete updated.state.portStates; }
    reconcileLineOrders(next);
    return assertValid(next);
  }
  // The native membership journal has an explicit, smaller schema. It is not
  // the central stand: physical descriptors, spatial metadata and libraries
  // remain in the authenticated central projection, never overwritten here.
  function membershipStructure(model) {
    assertValid(model);
    var receiverKeys = ['id','rid','deviceFingerprint','name','type','standId','zoneId','role','lifecycle','connection','outputs','state','onboardingTransactionId'];
    var zoneKeys = ['id','name','type','layout','receiverIds','lineOrder'];
    function pick(value, keys) {
      var next = {};
      keys.forEach(function (key) { if (Object.prototype.hasOwnProperty.call(value,key)) next[key] = clone(value[key]); });
      return next;
    }
    return assertValid({schemaVersion:30,demo:false,scenes:[],presets:[],
      stands:model.stands.map(function (stand) { return {id:stand.id,name:stand.name,zones:stand.zones.map(function (zone) { return pick(zone,zoneKeys); })}; }),
      receivers:model.receivers.map(function (receiver) { var next=pick(receiver,receiverKeys);next.state=defaultState();next.connection='unknown';return next; })});
  }
  // A receiver-less local concept is presentation only, never an AP binding.
  function localStand(id, name) {
    return assertValid({schemaVersion:30,demo:false,stands:[{id:id,name:name,zones:[]}],receivers:[],scenes:[],presets:[]});
  }
  return Object.freeze({ LIMITS: LIMITS, DEFAULT_SPI_PIXELS: DEFAULT_SPI_PIXELS, DEFAULT_ANIMATION_WIDTH: DEFAULT_ANIMATION_WIDTH, localStand: localStand, clone: clone, defaultState: defaultState, validate: validate, assertValid: assertValid, membershipStructure: membershipStructure, getZone: getZone,
    zoneReceivers: zoneReceivers, standZoneReceivers: standZoneReceivers, lightStateFor: lightStateFor, validPortLightState: validPortLightState, selectionLines: selectionLines, resolveTargets: resolveTargets, applyState: applyState, applyStandState: applyStandState, setLayout: setLayout,
    createZone: createZone, renameZone: renameZone, deleteZone: deleteZone, renameReceiver: renameReceiver,
    assignReceiverToZone: assignReceiverToZone, unassignReceiver: unassignReceiver, moveReceivers: moveReceivers,
    reorderReceivers: reorderReceivers, arrangeZone: arrangeZone, arrangeLines: arrangeLines, lineIds: lineIds, ledlines: ledlines, zoneLedlines: zoneLedlines,
    moveReceiver: moveReceiver, configureSpiOutput: configureSpiOutput });
}));
