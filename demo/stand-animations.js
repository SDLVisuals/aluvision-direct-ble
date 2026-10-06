/* Stand-wide animation intent. Reuses real receiver recipes and the existing
 * gallery/preview, without radio calls, pairing or changing physical topology.
 * Coordinated order is the configured zone/ledline order, not a claim that an
 * arbitrary stand has been spatially calibrated. Native owns the group clock.
 */
(function (root, factory) {
  const cjs = typeof module === 'object' && module.exports;
  const api = factory(cjs ? require('./model.js') : root.LightningModel,
    cjs ? require('./preview.js') : root.LightningPreview,
    cjs ? require('./presets.js') : root.LightningPresets);
  if (cjs) module.exports = api;
  else root.LightningStandAnimations = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (Model, Preview, Presets) {
  'use strict';
  if (!Model || !Preview || !Presets) throw new Error('Load model, preview and presets before stand-animations.js');
  const clone = Model.clone;
  const plain = value => value && typeof value === 'object' && !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value));
  const has = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const fail = (code, message) => { const error = new Error(message); error.code = code; throw error; };
  const validId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(value);
  const validClockId = value => validId(value) && value.length <= 96;
  function defaultClockId(standId, effectId) {
    const joined = standId + ':' + effectId;
    if (validClockId(joined)) return joined;
    // This is a bounded grouping label, never an access credential. Preserve
    // both full identities in its deterministic digest instead of truncating
    // their prefix into the same label for two different stands.
    const digest = [2166136261, 2246822507].map(seed => {
      let value = seed;
      for (const character of joined) value = Math.imul(value ^ character.codePointAt(0), 16777619);
      return (value >>> 0).toString(16).padStart(8, '0');
    }).join('');
    return 'stand-clock-' + digest;
  }
  const stable = value => Array.isArray(value) ? value.map(stable) : plain(value) ?
    Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
  const equal = (a, b) => JSON.stringify(stable(a)) === JSON.stringify(stable(b));
  const WHOLE_VARIANTS = new Set([0, 1, 2, 3, 4, 17, 18, 19, 20, 25]);
  const COORDINATED_BRAND = new Set(['v30-brand-sweep', 'v30-brand-focus', 'v30-brand-soft-gradient']);
  const rgbw = Preview.catalog('RGBW');
  const spi = Preview.catalog('SPI');
  const descriptors = rgbw.filter(effect => {
    if (!effect.state.v30Effect) return effect.category === 'whole' && WHOLE_VARIANTS.has(effect.state.variant);
    return spi.some(other => other.id === effect.id && other.state.v30Effect === effect.state.v30Effect);
  }).map(effect => {
    const result = clone(effect);
    result.standMode = effect.category === 'tunnel' || COORDINATED_BRAND.has(effect.id) ? 'coordinated' : 'whole';
    result.supportedTypes = ['RGBW', 'SPI'];
    // Keep ID, family and category intact so the normal chooser stays the
    // same. Only the explanation of this actual mixed recipe changes here.
    result.standRoleLabels = effect.id === 'v30-tunnel-pulse'
      ? { RGBW: 'Lichtgolf per ledline', SPI: 'Chase over de pixels' }
      : result.standMode === 'whole'
        ? { RGBW: 'Hele ledline · tegelijk', SPI: 'Hele ledline · tegelijk' }
        : { RGBW: 'Lichtgolf over de ledlines', SPI: 'Lichtgolf over de ledlines' };
    result.standGuidance = result.standMode === 'whole'
      ? 'RGBW en SPI tonen hetzelfde effect op hun hele ledline, met dezelfde timing.'
      : 'De beweging volgt de ingestelde volgorde van zones en ledlines. RGBW en SPI lichten als hele ledlines op.';
    if (effect.id === 'v30-tunnel-pulse') {
      result.standName = 'Chase + lichtgolf';
      result.description = 'Een bewegende puls op SPI en een lichtgolf op RGBW, samen in de ingestelde zone- en ledlinevolgorde.';
      result.standGuidance = 'Een zachte RGBW-lichtgolf en een bewegende SPI-puls volgen dezelfde volgorde van zones en ledlines. De app kent geen fysieke afstanden.';
    } else if (['v30-brand-sweep', 'v30-brand-soft-gradient'].includes(effect.id)) {
      result.standRoleLabels = { RGBW: 'Zachte gloed per ledline', SPI: 'Zacht verloop over de pixels' };
      result.standGuidance = 'RGBW toont een zachte gloed per ledline. Op SPI loopt de gloed over de pixels, met dezelfde timing en ingestelde volgorde.';
    } else if (effect.id === 'v30-brand-focus') {
      result.standRoleLabels = { RGBW: 'Focus per hele ledline', SPI: 'Focus per hele ledline' };
      result.standGuidance = 'Een zachte focus beweegt langs de hele RGBW- en SPI-ledlines, in de ingestelde volgorde van zones en ledlines.';
    }
    return result;
  });
  const byId = new Map(descriptors.map(effect => [effect.id, effect]));

  function addedReceivers(model, standId) {
    Model.assertValid(model);
    if (!model.stands.some(stand => stand.id === standId)) fail('STAND_REFERENCE', 'Deze stand bestaat niet.');
    return Model.standZoneReceivers(model, standId);
  }
  function catalogFor(receivers = []) {
    if (!Array.isArray(receivers) || receivers.some(receiver => !receiver || !['RGBW', 'SPI'].includes(receiver.type)))
      fail('STAND_RECEIVERS', 'Kies de ledlines van deze stand.');
    return descriptors.map(clone);
  }
  function effectFor(effectId) {
    const effect = byId.get(effectId);
    if (!effect) fail('STAND_EFFECT', 'Kies een animatie die op de hele stand werkt.');
    return effect;
  }
  function checkEffectState(effect, state) {
    if (state.engine !== effect.state.engine || state.variant !== effect.state.variant ||
      (state.v30Effect || null) !== (effect.state.v30Effect || null))
      fail('STAND_EFFECT_STATE', 'De animatie en instellingen horen niet bij elkaar.');
    if (state.category !== effect.category)
      fail('STAND_EFFECT_STATE', 'De animatie en categorie horen niet bij elkaar.');
    const range = effect.colorCountRange;
    if (range && (state.colorCount < range.min || state.colorCount > range.max))
      fail('STAND_EFFECT_PALETTE', 'Het aantal kleuren past niet bij deze animatie.');
  }
  function canonicalState(effect, changes = {}) {
    if (!plain(changes) || ['__proto__', 'prototype', 'constructor', 'standAnimation'].some(key => has(changes, key)))
      fail('STAND_EFFECT_STATE', 'De animatie-instellingen zijn niet geldig.');
    const state = Presets.sanitizeLightState(Object.assign({
      v30Effect: null, previewFamily: null, legacySpi: false,
      // A stand recipe is a complete shared lighting intent, not a patch on
      // each receiver's previous pixel effect. Match the live request defaults
      // explicitly so old family-specific knobs cannot split the wave profile.
      speed: 30, smooth: 100, widthPixels: 4, spacing: 50, objectCount: 1,
      trailLength: 45, spread: 50, randomness: 25, fadeAmount: 90, width: 65,
      bounce: false, mirror: false, lineDelayMs: 0, delayMs: 0,
      backgroundOn: false, bgBrightness: 0, background: '#000000', backgroundWhite: 0,
      backgroundRgbEnabled: true, backgroundWhiteEnabled: false,
      direction: 'right', on: true, power: true
    }, clone(effect.state), clone(changes), {category: effect.category}));
    // Ordinary whole-line effects must not inherit tunnel delays/directions
    // from the previously controlled zone or a saved older light state.
    if (effect.category === 'whole') Object.assign(state, {
      lineDelayMs: 0, delayMs: 0, bounce: false, mirror: false, direction: 'right'
    });
    if (state.colorCount === undefined) state.colorCount = state.colors.length;
    // Every V30 payload contains its accent slot, including effects that do
    // not visibly use it. Do not inherit a different old brand colour per line.
    if (state.brandColor === undefined) state.brandColor = state.colors[0];
    if (has(changes, 'brightness') && !has(changes, 'bri')) state.bri = changes.brightness;
    if (state.bri === undefined) state.bri = state.brightness === undefined ? 100 : state.brightness;
    state.brightness = state.bri;
    checkEffectState(effect, state);
    return state;
  }
  function validateMarker(marker) {
    if (!plain(marker) || Object.keys(marker).length !== 4 ||
      Object.keys(marker).some(key => !['effectId', 'mode', 'clockId', 'state'].includes(key)) ||
      !validId(marker.effectId) || !validClockId(marker.clockId))
      fail('STAND_ANIMATION_MARKER', 'De gezamenlijke animatie is niet geldig.');
    const effect = effectFor(marker.effectId);
    if (marker.mode !== effect.standMode)
      fail('STAND_ANIMATION_MARKER', 'De gezamenlijke animatiemodus is niet geldig.');
    const state = Presets.sanitizeLightState(marker.state, true);
    checkEffectState(effect, state);
    if (effect.category === 'whole' && (state.lineDelayMs !== 0 || state.delayMs !== 0 ||
      state.bounce !== false || state.mirror !== false || state.direction !== 'right'))
      fail('STAND_ANIMATION_MARKER', 'Deze gewone animatie bevat nog oude opstellingsinstellingen.');
    return {effectId: marker.effectId, mode: marker.mode, clockId: marker.clockId, state};
  }
  function arrangement(model, standId, receivers) {
    const stand = model.stands.find(item => item.id === standId), ids = new Set(receivers.map(receiver => receiver.id));
    const lineOrder = [], orderedReceiverIds = [];
    const appendReceiver = id => { if (ids.has(id) && !orderedReceiverIds.includes(id)) orderedReceiverIds.push(id); };
    stand.zones.forEach(zone => {
      zone.receiverIds.forEach(appendReceiver);
      Model.lineIds(model, zone.id).forEach(id => lineOrder.push(id));
    });
    const ordered = orderedReceiverIds.map(id => receivers.find(receiver => receiver.id === id));
    // Strict identity/port validation also detects missing/duplicate slots.
    const lines = Model.ledlines(ordered, lineOrder);
    return {receivers: ordered, lineOrder, lines};
  }
  function active(model, standId) {
    const receivers = addedReceivers(model, standId);
    if (!receivers.length) return null;
    let first;
    try { first = validateMarker(receivers[0].state.standAnimation); }
    catch (_) { return null; }
    for (const receiver of receivers) {
      try {
        if (!equal(validateMarker(receiver.state.standAnimation), first)) return null;
        const expected = Object.assign({}, first.state, {receiverType: receiver.type,
          previewFamily: receiver.type === 'SPI' && !first.state.v30Effect ? 'RGBW' : null});
        // An ordinary zone edit may be produced by an older client that does
        // not know this marker. Do not call a stand animation active merely
        // because its stale marker survived. Power alone keeps the recipe.
        if (Object.keys(expected).some(key => !['on', 'power'].includes(key) &&
          !equal(expected[key], receiver.state[key]))) return null;
      } catch (_) { return null; }
    }
    return clone(first);
  }
  function plan(model, standId, effectId, options = {}) {
    const before = addedReceivers(model, standId), effect = effectFor(effectId);
    if (!before.length) fail('STAND_EMPTY', 'Voeg eerst een receiver toe aan een zone van deze stand.');
    if (!plain(options) || Object.keys(options).some(key => !['state', 'time', 'clockId'].includes(key)))
      fail('STAND_EFFECT_OPTIONS', 'De gezamenlijke animatie-instellingen zijn niet geldig.');
    const time = options.time === undefined ? 0 : options.time;
    if (typeof time !== 'number' || !Number.isFinite(time) || time < 0)
      fail('STAND_EFFECT_CLOCK', 'De animatieklok is niet geldig.');
    const geometry = arrangement(model, standId, before);
    if (geometry.lines.length < (effect.minimumReceivers || 1))
      fail('STAND_EFFECT_MINIMUM', 'Deze animatie heeft minstens twee ledlines nodig.');
    const state = canonicalState(effect, has(options, 'state') ? options.state : {});
    const prior = active(model, standId);
    const clockId = options.clockId === undefined ?
      prior?.effectId === effectId ? prior.clockId : defaultClockId(standId, effectId) : options.clockId;
    const marker = validateMarker({effectId, mode: effect.standMode, clockId, state});
    const next = clone(model);
    const selectedIds = new Set(before.map(receiver => receiver.id));
    next.receivers.forEach(receiver => {
      if (!selectedIds.has(receiver.id)) return;
      const lighting = clone(state);
      if (receiver.type === 'SPI' && !effect.state.v30Effect) lighting.previewFamily = 'RGBW';
      else lighting.previewFamily = null;
      lighting.receiverType = receiver.type;
      const old = before.find(item => item.id === receiver.id);
      const keepingEffect = prior?.effectId === effectId;
      receiver.state = Object.assign({}, receiver.state, lighting, {
        previewStartedAt: keepingEffect ? old.state.previewStartedAt ?? 0 : time,
        phaseMs: keepingEffect ? old.state.phaseMs ?? 0 : 0, standAnimation: clone(marker)
      });
      if (keepingEffect && !state.v30Effect) receiver.state =
        Preview.retimeMotion(old, receiver, time, {lineCount: geometry.lines.length}).state;
    });
    Model.assertValid(next);
    return assembled(next, standId, marker);
  }
  function assembled(model, standId, marker) {
    const ordered = arrangement(model, standId, addedReceivers(model, standId));
    const zones = model.stands.find(stand => stand.id === standId).zones.map(zone => ({
      zoneId: zone.id, zoneName: zone.name, type: zone.type, layout: zone.layout,
      receivers: ordered.receivers.filter(receiver => receiver.zoneId === zone.id),
      lineOrder: ordered.lines.filter(line => zone.receiverIds.includes(line.receiverId)).map(line => line.id)
    }));
    return {model, standId, effectId: marker.effectId, effect: clone(effectFor(marker.effectId)),
      mode: marker.mode, state: clone(marker.state), clockId: marker.clockId,
      receivers: ordered.receivers, receiverIds: ordered.receivers.map(receiver => receiver.id),
      lineOrder: ordered.lineOrder, lines: ordered.lines, zones,
      sharedClock: {clockId: marker.clockId, nativeGroupStartRequired: true}};
  }
  function current(model, standId) {
    const marker = active(model, standId);
    return marker ? assembled(model, standId, marker) : null;
  }
  function previewOptions(planned, time = 0) {
    if (!planned || !Array.isArray(planned.receivers) || !Array.isArray(planned.lineOrder) ||
      planned.receivers.some(receiver => !receiver || receiver.zoneId === null ||
        receiver.standId !== planned.standId || receiver.lifecycle !== 'added') ||
      typeof time !== 'number' || !Number.isFinite(time) || time < 0)
      fail('STAND_PREVIEW', 'Het animatievoorbeeld is niet geldig.');
    // One parallel physical-line geometry on both families. A zone's saved
    // continuous/tunnel setting is kept, but never leaks into this stand view.
    return {receivers: planned.receivers, geometryReceivers: planned.receivers,
      layout: 'stacked', lineOrder: planned.lineOrder, time, selection: {kind: 'all'}};
  }
  function preview(planned, time = 0) {
    const frame = Preview.rows(previewOptions(planned, time));
    const zoneByReceiver = new Map(planned.zones.flatMap(zone => zone.receivers.map(receiver => [receiver.id, zone])));
    const label = row => {
      const zone = zoneByReceiver.get(row.receiverId);
      return Object.assign(row, {zoneId: zone?.zoneId ?? null, zoneName: zone?.zoneName || 'Zone'});
    };
    frame.rows.forEach(label);
    if (frame.lineRows) frame.lineRows.forEach(label);
    frame.zones = planned.zones.map(zone => ({zoneId: zone.zoneId, zoneName: zone.zoneName, type: zone.type,
      lineRows: (frame.lineRows || []).filter(row => row.zoneId === zone.zoneId)}));
    return frame;
  }
  function draw(canvas, planned, options = {}) {
    const all = previewOptions(planned, options.time === undefined ? 0 : options.time);
    if (has(options, 'zoneId')) {
      const zone = planned.zones.find(zone => zone.zoneId === options.zoneId);
      if (!zone) fail('STAND_PREVIEW_ZONE', 'Deze zone hoort niet bij het animatievoorbeeld.');
      all.receivers = zone.receivers;
    }
    return Preview.draw(canvas, Object.assign(all, {
      reducedMotion: options.reducedMotion === true, labels: options.labels !== false,
      presentation: 'receivers'
    }));
  }
  return Object.freeze({catalogFor, plan, current, preview, previewOptions, draw, validateMarker, active});
}));
