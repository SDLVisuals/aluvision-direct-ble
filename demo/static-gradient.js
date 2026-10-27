/* Static SPI gradient DATA. No receiver schema, transport or hardware access.
 * Colours are linear 8-bit RGB + optional white/brightness/on values,
 * resolved to RGB before interpolation over a whole line.
 * Positions are normalised [0,1]; outside the stops the end colour is held.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LightningStaticGradient = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MIN_STOPS = 2, MAX_STOPS = 8, MAX_PRESETS = 24, STORAGE_KEY = 'aluvision.demo.static-gradients.v1';
  const plain = value => value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
  function validStop(stop) {
    return plain(stop) && Object.keys(stop).every(key => ['color','position','white','brightness','on'].includes(key)) &&
      typeof stop.color === 'string' && /^#[0-9a-f]{6}$/i.test(stop.color) &&
      Number.isFinite(stop.position) && stop.position >= 0 && stop.position <= 1 &&
      (!Object.hasOwn(stop, 'white') || Number.isInteger(stop.white) && stop.white >= 0 && stop.white <= 255) &&
      (!Object.hasOwn(stop, 'brightness') || Number.isFinite(stop.brightness) && stop.brightness >= 0 && stop.brightness <= 100) &&
      (!Object.hasOwn(stop, 'on') || typeof stop.on === 'boolean');
  }
  function validateStops(stops) {
    return Array.isArray(stops) && stops.length >= MIN_STOPS && stops.length <= MAX_STOPS && stops.every((stop, i) =>
      validStop(stop) &&
      (!i || stop.position - stops[i - 1].position >= .01 - 1e-9));
  }
  const copyStops = stops => stops.map(stop => ({ ...stop, color: stop.color.toUpperCase() }));
  const rgb = hex => [1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16));
  // Same rounded white mix as LightningColour.mixWhite, before dimming.
  // Keep DATA independent from canvas/screen transfer and native transport.
  const rgbOfStop = stop => stop.on === false ? [0, 0, 0] : rgb(stop.color)
    .map(channel => Math.round(255 - (255 - channel) * (1 - (stop.white ?? 0) / 255)))
    .map(channel => Math.round(channel * (stop.brightness ?? 100) / 100));
  function stopRGB(stop) {
    if (!validStop(stop)) throw Error('GRADIENT_INVALID');
    return rgbOfStop(stop);
  }
  function sampleValid(stops, position) {
    if (position <= stops[0].position) return rgbOfStop(stops[0]);
    for (let i = 1; i < stops.length; i++) if (position <= stops[i].position) {
      const left = stops[i - 1], right = stops[i], amount = (position - left.position) / (right.position - left.position);
      const a = rgbOfStop(left), b = rgbOfStop(right);
      return a.map((channel, index) => Math.round(channel + (b[index] - channel) * amount));
    }
    return rgbOfStop(stops[stops.length - 1]);
  }
  function sample(stops, position) {
    if (!validateStops(stops) || !Number.isFinite(position) || position < 0 || position > 1) throw Error('GRADIENT_INVALID');
    return sampleValid(stops, position);
  }
  function samplePixels(stops, pixelCount, { reverse = false, brightness = 100 } = {}) {
    if (!validateStops(stops) || !Number.isInteger(pixelCount) || pixelCount < 1 || pixelCount > 8192 ||
      typeof reverse !== 'boolean' || !Number.isFinite(brightness) || brightness < 0 || brightness > 100) throw Error('GRADIENT_INVALID');
    const pixels = Array.from({ length: pixelCount }, (_, i) => sampleValid(stops, pixelCount === 1 ? 0 : i / (pixelCount - 1))
      .map(channel => Math.round(channel * brightness / 100)));
    return reverse ? pixels.reverse() : pixels;
  }
  // This is deliberately not a receiver capability: only the browser demo
  // can use the editor. Never downgrade a gradient into a uniform STATIC RPC.
  const supportsDemo = ({ demoOnly, native, family } = {}) => demoOnly === true && native === false && family === 'SPI';
  const builtinPresets = Object.freeze([
    { id: 'sunset', name: 'Zonsondergang', stops: [{ color: '#FF572D', position: 0 }, { color: '#E93F83', position: .5 }, { color: '#5944D9', position: 1 }] },
    { id: 'lagoon', name: 'Lagune', stops: [{ color: '#144DCC', position: 0 }, { color: '#17C9C4', position: .55 }, { color: '#B5F4CE', position: 1 }] },
    { id: 'warm', name: 'Warm licht', stops: [{ color: '#E34825', position: 0 }, { color: '#FFAE54', position: .55 }, { color: '#FFF1CD', position: 1 }] },
    { id: 'aurora', name: 'Noorderlicht', stops: [{ color: '#5332AC', position: 0 }, { color: '#277BE0', position: .45 }, { color: '#3BD89B', position: 1 }] }
  ].map(preset => Object.freeze({ ...preset, stops: Object.freeze(preset.stops.map(Object.freeze)) })));
  function validPreset(preset) {
    return plain(preset) && Object.keys(preset).sort().join(',') === 'id,name,stops' &&
      typeof preset.id === 'string' && /^gradient-[a-z0-9-]{1,80}$/.test(preset.id) &&
      typeof preset.name === 'string' && preset.name.trim().length > 0 && preset.name.length <= 48 &&
      !/[\u0000-\u001f\u007f]/.test(preset.name) && validateStops(preset.stops);
  }
  function createStore(storage) {
    let serial = 0;
    function load() {
      try {
        const raw = storage?.getItem(STORAGE_KEY);
        if (raw == null) return { presets: [], error: null };
        const value = JSON.parse(raw);
        if (!plain(value) || Object.keys(value).sort().join(',') !== 'presets,version' || value.version !== 1 ||
          !Array.isArray(value.presets) || value.presets.length > MAX_PRESETS || !value.presets.every(validPreset) ||
          new Set(value.presets.map(preset => preset.id)).size !== value.presets.length) throw Error('INVALID');
        return { presets: value.presets.map(preset => ({ ...preset, stops: copyStops(preset.stops) })), error: null };
      } catch (_) { return { presets: [], error: 'Je verlopen konden niet worden gelezen. Er is niets overschreven.' }; }
    }
    function write(presets) {
      try {
        if (!storage || typeof storage.setItem !== 'function') throw Error('UNAVAILABLE');
        storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, presets }));
        return load();
      } catch (_) { return { presets, error: 'Opslaan lukt hier niet. Je voorbeeld blijft behouden.' }; }
    }
    return Object.freeze({ load,
      save(value) {
        const state = load();
        if (state.error) return state;
        const id = value?.id || `gradient-${Date.now().toString(36)}-${++serial}`;
        const preset = { id, name: typeof value?.name === 'string' ? value.name.trim() : value?.name, stops: value?.stops };
        if (!validPreset(preset)) return { ...state, error: 'Kies een naam en twee tot acht geldige kleuren.' };
        const index = state.presets.findIndex(item => item.id === id);
        if (index < 0 && state.presets.length >= MAX_PRESETS) return { ...state, error: 'Je kunt maximaal 24 eigen verlopen bewaren.' };
        if (value.id && index < 0) return { ...state, error: 'Dit bewaarde verloop bestaat niet meer.' };
        if (index < 0) state.presets.push({ ...preset, stops: copyStops(preset.stops) });
        else state.presets[index] = { ...preset, stops: copyStops(preset.stops) };
        return { ...write(state.presets), savedId: id };
      },
      remove(id) {
        const state = load();
        return state.error ? state : write(state.presets.filter(preset => preset.id !== id));
      }
    });
  }
  return Object.freeze({ MIN_STOPS, MAX_STOPS, MAX_PRESETS, STORAGE_KEY, validateStops, stopRGB, sample, samplePixels, supportsDemo, builtinPresets, createStore });
}));
