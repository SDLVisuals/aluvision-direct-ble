/* Isolated V30 animation presets. No transport, receiver credentials or V21 data.
 * A preset describes light, never a destination. Applying it remains an explicit
 * UI action against the current compatible selection.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LightningPresets = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const STORAGE_KEY = 'aluvision.v30.animation-presets.v1';
  const MAX_PRESETS = 100;
  const MAX_BYTES = 512000;
  const CATEGORIES = ['whole', 'pixels', 'tunnel', 'brand'];
  const TYPES = ['RGBW', 'SPI'];
  const LAYOUTS = ['continuous', 'stacked', 'vertical'];
  const DIRECTIONS = ['right', 'left', 'forward', 'reverse', 'backward', 'up', 'down', 'center-out', 'outside-in', 'bounce'];
  const has = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const plain = value => !!value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
  const clone = value => JSON.parse(JSON.stringify(value));
  const dangerous = value => plain(value) && ['__proto__', 'prototype', 'constructor'].some(key => has(value, key));
  const validId = value => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$/.test(value);
  const validHex = value => typeof value === 'string' && /^#[a-f0-9]{6}$/i.test(value);
  const finite = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
  const integer = (value, min, max) => Number.isInteger(value) && finite(value, min, max);
  const safeText = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
  const fail = (code, message) => { const error = new Error(message); error.code = code; throw error; };
  const rules = {};
  function numberRule(keys, min, max, whole = false) {
    keys.split(' ').forEach(key => { rules[key] = value => whole ? integer(value, min, max) : finite(value, min, max); });
  }
  numberRule('r g b w backgroundWhite', 0, 255);
  numberRule('bri brightness speed smooth width spacing spread randomness trailLength fadeAmount bgBrightness backgroundBrightness', 0, 100);
  numberRule('widthPixels', 1, 8192);
  numberRule('objectCount', 1, 128, true);
  numberRule('variant', 0, 65535, true);
  numberRule('colorCount', 1, 16, true);
  numberRule('transitionMs lineDelayMs delayMs fadeMs holdMs', 0, 60000);
  ['power', 'on', 'backgroundOn', 'backgroundRgbEnabled', 'backgroundWhiteEnabled', 'bounce', 'mirror', 'legacySpi'].forEach(key => { rules[key] = value => typeof value === 'boolean'; });
  rules.brandColor = validHex;
  // Three preserved pixel effects use the original {rgb, white} background
  // slot shape. Keep that light-only shape rather than dropping its W value.
  rules.background = value => validHex(value) || (plain(value) && !dangerous(value) &&
    Object.keys(value).every(key => ['rgb', 'white'].includes(key)) && validHex(value.rgb) && finite(value.white, 0, 255));
  rules.engine = value => typeof value === 'string' && /^[A-Z][A-Z0-9_-]{0,31}$/.test(value);
  rules.animation = value => safeText(value, 120);
  rules.direction = value => DIRECTIONS.includes(value);
  rules.category = value => value === null || CATEGORIES.includes(value);
  rules.receiverType = value => TYPES.includes(value);
  rules.previewFamily = value => value === null || TYPES.includes(value);
  rules.v30Effect = value => value === null || validId(value);
  rules.colors = value => Array.isArray(value) && value.length >= 1 && value.length <= 16 && value.every(validHex);
  rules.whiteChannels = value => Array.isArray(value) && value.length >= 1 && value.length <= 16 && value.every(item => finite(item, 0, 255));
  ['rgbEnabled', 'whiteEnabled'].forEach(key => { rules[key] = value => Array.isArray(value) && value.length >= 1 && value.length <= 16 && value.every(item => typeof item === 'boolean'); });
  const STATE_FIELDS = Object.freeze(Object.keys(rules));
  function lightState(value, strict = false) {
    if (!plain(value) || dangerous(value)) fail('STATE', 'De lichtinstellingen zijn niet geldig.');
    const result = {};
    Object.keys(value).forEach(key => {
      if (!has(rules, key)) {
        if (strict) fail('STATE_FIELD', 'De bewaarde animatie bevat gegevens die geen lichtinstelling zijn.');
        return;
      }
      if (!rules[key](value[key])) fail('STATE_VALUE', 'De lichtinstelling ‘' + key + '’ is niet geldig.');
      result[key] = clone(value[key]);
    });
    if (!result.engine || !result.colors || !result.colors.length) fail('STATE_REQUIRED', 'De animatie en kleuren ontbreken.');
    if (result.colorCount !== undefined && result.colorCount > result.colors.length) fail('PALETTE', 'Het aantal kleuren past niet bij het palet.');
    return result;
  }
  function restrictions(effect) {
    const minimumReceivers = effect.minimumReceivers === undefined ? (effect.category === 'tunnel' ? 2 : 1) : effect.minimumReceivers;
    const layouts = effect.supportedLayouts || effect.layouts || LAYOUTS;
    if (!integer(minimumReceivers, 1, 1000) || !Array.isArray(layouts) || !layouts.length || layouts.some(layout => !LAYOUTS.includes(layout))) fail('CONSTRAINTS', 'De effectvoorwaarden zijn niet geldig.');
    return { minimumReceivers: Math.max(effect.category === 'tunnel' ? 2 : 1, minimumReceivers),
      requireTogether: effect.category === 'tunnel' || effect.requireTogether === true, layouts: [...new Set(layouts)] };
  }
  let sequence = 0;
  function newId() {
    if (typeof globalThis.crypto === 'object' && typeof globalThis.crypto.randomUUID === 'function') return 'preset-' + globalThis.crypto.randomUUID();
    sequence += 1;
    return 'preset-' + Date.now().toString(36) + '-' + sequence.toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }
  function capture(name, effect, editedState, options = {}) {
    if (typeof name !== 'string' || !safeText(name.trim(), 64)) fail('NAME', 'Geef je animatie een naam van 1 tot 64 tekens.');
    if (!plain(effect) || dangerous(effect) || !validId(effect.id) || !CATEGORIES.includes(effect.category) || !plain(effect.state)) fail('EFFECT', 'Kies eerst een animatie.');
    if (!plain(editedState) || dangerous(editedState)) fail('STATE', 'De lichtinstellingen zijn niet geldig.');
    const supportedTypes = effect.supportedTypes || effect.receiverTypes ||
      (effect.category === 'pixels' ? ['SPI'] : effect.category !== 'whole' && TYPES.includes(effect.state.receiverType) ? [effect.state.receiverType] : TYPES);
    if (!Array.isArray(supportedTypes) || !supportedTypes.length || supportedTypes.some(type => !TYPES.includes(type))) fail('TYPE', 'Het type van deze animatie is niet geldig.');
    if (editedState.engine && editedState.engine !== effect.state.engine) fail('EFFECT_STATE', 'De gekozen animatie en instellingen horen niet bij elkaar.');
    const state = lightState(Object.assign({}, effect.state, editedState));
    if (effect.state.variant !== undefined && state.variant !== effect.state.variant) fail('EFFECT_STATE', 'De gekozen animatievariant en instellingen horen niet bij elkaar.');
    if (effect.state.v30Effect && state.v30Effect !== effect.state.v30Effect) fail('EFFECT_STATE', 'De gekozen animatie en instellingen horen niet bij elkaar.');
    const id = options.id === undefined ? newId() : options.id;
    if (!validId(id)) fail('ID', 'De identificatie van de bewaarde animatie is niet geldig.');
    return validate({ version: 1, id, name: name.trim(), effectId: effect.id, category: effect.category,
      supportedTypes: [...new Set(supportedTypes)], constraints: restrictions(effect), state });
  }
  function onlyKeys(value, keys, code) {
    if (!plain(value) || dangerous(value) || Object.keys(value).some(key => !keys.includes(key))) fail(code, 'De bewaarde animatie bevat onbekende of ongeldige gegevens.');
  }
  function validate(value) {
    onlyKeys(value, ['version', 'id', 'name', 'effectId', 'category', 'supportedTypes', 'constraints', 'state'], 'PRESET');
    if (value.version !== 1 || !validId(value.id) || !safeText(value.name, 64) || !validId(value.effectId) || !CATEGORIES.includes(value.category)) fail('PRESET', 'Deze bewaarde animatie is niet geldig of heeft een onbekende versie.');
    if (!Array.isArray(value.supportedTypes) || !value.supportedTypes.length || value.supportedTypes.some(type => !TYPES.includes(type)) || new Set(value.supportedTypes).size !== value.supportedTypes.length) fail('TYPE', 'Het type van deze animatie is niet geldig.');
    if (value.category === 'pixels' && value.supportedTypes.some(type => type !== 'SPI')) fail('TYPE', 'Bewegend licht over pixels is alleen voor SPI.');
    onlyKeys(value.constraints, ['minimumReceivers', 'requireTogether', 'layouts'], 'CONSTRAINTS');
    const constraints = value.constraints;
    if (!integer(constraints.minimumReceivers, value.category === 'tunnel' ? 2 : 1, 1000) || typeof constraints.requireTogether !== 'boolean' || !Array.isArray(constraints.layouts) || !constraints.layouts.length || constraints.layouts.some(layout => !LAYOUTS.includes(layout))) fail('CONSTRAINTS', 'De effectvoorwaarden zijn niet geldig.');
    if (value.category === 'tunnel' && !constraints.requireTogether) fail('CONSTRAINTS', 'Tunneleffecten gebruiken de volledige opstelling.');
    const result = clone(value);
    result.state = lightState(value.state, true);
    return result;
  }
  function effectInCatalog(preset, catalog) {
    if (!Array.isArray(catalog)) return null;
    const exact = catalog.find(effect => effect && effect.id === preset.effectId);
    if (exact) return exact;
    // Existing RGBW whole-line formulas have a different catalog ID on SPI.
    // Do not map pixel/tunnel variants by number: identical numbers can mean
    // different effects on different receiver families.
    if (preset.category !== 'whole' || (preset.state.receiverType !== 'RGBW' && preset.state.previewFamily !== 'RGBW')) return null;
    return catalog.find(effect => effect && effect.category === 'whole' && effect.state &&
      (effect.state.receiverType === 'RGBW' || effect.state.previewFamily === 'RGBW') &&
      effect.state.engine === preset.state.engine && effect.state.variant === preset.state.variant) || null;
  }
  function compatibility(preset, context, catalog) {
    let saved;
    try { saved = validate(preset); } catch (error) { return { compatible: false, reason: error.message, effectId: null }; }
    if (!plain(context) || !TYPES.includes(context.type)) return { compatible: false, reason: 'Open eerst een RGBW- of SPI-zone.', effectId: null };
    if (!saved.supportedTypes.includes(context.type) || (saved.category === 'pixels' && context.type !== 'SPI')) return { compatible: false, reason: 'Deze animatie is alleen voor ' + saved.supportedTypes.join(' en ') + '.', effectId: null };
    const effect = effectInCatalog(saved, catalog);
    if (!effect || effect.category !== saved.category) return { compatible: false, reason: 'Deze animatie is niet beschikbaar voor deze zone.', effectId: null };
    if (effect.state.engine !== saved.state.engine || effect.state.variant !== saved.state.variant || (effect.state.v30Effect || null) !== (saved.state.v30Effect || null)) return { compatible: false, reason: 'Deze bewaarde animatie hoort bij een andere animatieversie.', effectId: null };
    const minimum = Math.max(saved.constraints.minimumReceivers, effect.minimumReceivers || 1);
    if (!integer(context.receiverCount, 1, 1000) || context.receiverCount < minimum) return { compatible: false, reason: 'Voeg minstens ' + minimum + ' receivers toe aan deze zone.', effectId: effect.id };
    const currentLayouts = effect.supportedLayouts || effect.layouts || LAYOUTS;
    if (!saved.constraints.layouts.includes(context.layout) || !currentLayouts.includes(context.layout) || (context.type === 'RGBW' && context.layout === 'continuous')) return { compatible: false, reason: 'Deze animatie past niet bij de gekozen opstelling.', effectId: effect.id };
    if (!context.selection || !['all', 'receiver'].includes(context.selection.kind)) return { compatible: false, reason: 'Kies Samen of één receiver.', effectId: effect.id };
    if ((saved.constraints.requireTogether || effect.requireTogether || effect.category === 'tunnel') && context.selection.kind !== 'all') return { compatible: false, reason: 'Kies Samen om dit effect over de opstelling te gebruiken.', effectId: effect.id };
    return { compatible: true, reason: '', effectId: effect.id };
  }
  function restore(preset, context, catalog) {
    const result = compatibility(preset, context, catalog);
    if (!result.compatible) return result;
    const effect = catalog.find(item => item.id === result.effectId);
    const state = clone(preset.state);
    state.previewFamily = effect.state.previewFamily || null;
    state.receiverType = effect.state.receiverType || context.type;
    return Object.assign({}, result, { effect: clone(effect), state });
  }
  function storageError(code, message) { return { presets: [], error: { code, message } }; }
  function createStore(storage) {
    function load() {
      let raw;
      try {
        if (!storage || typeof storage.getItem !== 'function') return storageError('STORAGE_UNAVAILABLE', 'Mijn animaties kunnen hier niet lokaal worden bewaard.');
        raw = storage.getItem(STORAGE_KEY);
      } catch (_) { return storageError('STORAGE_UNAVAILABLE', 'De lokale opslag voor Mijn animaties is niet bereikbaar.'); }
      if (raw === null || raw === undefined) return { presets: [], error: null };
      if (typeof raw !== 'string' || raw.length > MAX_BYTES) return storageError('STORAGE_CORRUPT', 'De bewaarde animaties konden niet veilig worden gelezen. Ze zijn niet overschreven.');
      try {
        const envelope = JSON.parse(raw);
        onlyKeys(envelope, ['version', 'presets'], 'STORAGE_CORRUPT');
        if (envelope.version !== 1 || !Array.isArray(envelope.presets) || envelope.presets.length > MAX_PRESETS) throw new Error('Invalid preset envelope');
        const presets = envelope.presets.map(validate);
        if (new Set(presets.map(preset => preset.id)).size !== presets.length) throw new Error('Duplicate preset identity');
        return { presets, error: null };
      } catch (_) { return storageError('STORAGE_CORRUPT', 'De bewaarde animaties konden niet veilig worden gelezen. Ze zijn niet overschreven.'); }
    }
    function write(presets, previous) {
      try {
        if (!storage || typeof storage.setItem !== 'function') return { presets: previous, error: { code: 'STORAGE_UNAVAILABLE', message: 'Mijn animaties kunnen hier niet lokaal worden bewaard.' } };
        const serialized = JSON.stringify({ version: 1, presets });
        if (serialized.length > MAX_BYTES) return { presets: previous, error: { code: 'STORAGE_FULL', message: 'De lokale opslag voor Mijn animaties is vol. Verwijder eerst een ongebruikte animatie.' } };
        storage.setItem(STORAGE_KEY, serialized);
        return { presets: clone(presets), error: null };
      } catch (_) { return { presets: previous, error: { code: 'STORAGE_WRITE', message: 'De animatie kon niet worden bewaard. Je bestaande animaties blijven staan.' } }; }
    }
    function save(preset) {
      const current = load();
      if (current.error) return current;
      let saved;
      try { saved = validate(preset); } catch (error) { return { presets: current.presets, error: { code: error.code || 'PRESET', message: error.message } }; }
      const existing = current.presets.findIndex(item => item.id === saved.id);
      if (existing < 0 && current.presets.length >= MAX_PRESETS) return { presets: current.presets, error: { code: 'PRESET_LIMIT', message: 'Je hebt 100 bewaarde animaties. Verwijder eerst een ongebruikte animatie.' } };
      const next = current.presets.slice();
      if (existing < 0) next.push(saved); else next[existing] = saved;
      return write(next, current.presets);
    }
    function remove(id) {
      const current = load();
      if (current.error) return current;
      if (!validId(id)) return { presets: current.presets, error: { code: 'ID', message: 'Kies de animatie die je wilt verwijderen.' } };
      if (!current.presets.some(preset => preset.id === id)) return current;
      return write(current.presets.filter(preset => preset.id !== id), current.presets);
    }
    return Object.freeze({ load, save, remove });
  }
  return Object.freeze({ STORAGE_KEY, MAX_PRESETS, STATE_FIELDS, capture, validate, compatibility, restore, createStore,
    lightState, sanitizeLightState: lightState });
}));
