/* Static SPI gradient DATA. No transport or hardware access.
 * Physical RGBW stays separate. The RGB sampler is optical preview only.
 * Positions are normalised [0,1]; outside the stops the end colour is held.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LightningStaticGradient = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const MIN_STOPS = 2, MAX_STOPS = 8, MAX_PRESETS = 24, STORAGE_KEY = 'aluvision.static-gradients.v1';
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
      (!i || stop.position > stops[i - 1].position && Math.round(stop.position * 65535) > Math.round(stops[i - 1].position * 65535)));
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
    const pixels = Array.from({ length: pixelCount }, (_, i) => sampleValid(stops, pixelCount === 1 ? 32768 / 65535 : Math.round(i * 65535 / (pixelCount - 1)) / 65535)
      .map(channel => Math.round(channel * brightness / 100)));
    return reverse ? pixels.reverse() : pixels;
  }
  // This is deliberately not a receiver capability: only the browser demo
  // can use the editor. Never downgrade a gradient into a uniform STATIC RPC.
  const supportsDemo = ({ demoOnly, native, family } = {}) => demoOnly === true && native === false && family === 'SPI';
  function definition(stops, { brightness = 100, reverse = false, transitionMs = 120 } = {}) {
    if (!validateStops(stops) || !Number.isInteger(brightness) || brightness < 0 || brightness > 100 ||
        typeof reverse !== 'boolean' || !Number.isInteger(transitionMs) || transitionMs < 0 || transitionMs > 750) throw Error('GRADIENT_INVALID');
    const normalized = stops.map(s => ({ position:s.position, color:s.color.toUpperCase(), white:s.white ?? 0, brightness:s.brightness ?? 100, on:s.on ?? true }));
    let previous = -1;
    for (const stop of normalized) { const position = Math.round(stop.position * 65535); if (position <= previous) throw Error('GRADIENT_INVALID'); previous = position; }
    return { stops:normalized, brightness, reverse, transitionMs };
  }
  function physicalChannels(stop) {
    if (!validStop(stop)) throw Error('GRADIENT_INVALID');
    return [...rgb(stop.color), stop.white ?? 0].map(c => stop.on === false ? 0 : Math.round(c * (stop.brightness ?? 100) / 100));
  }
  // Cross-platform recipe oracle; only the native binder may actually send it.
  function recipe(stops, options) {
    const d = definition(stops, options), bytes = new Uint8Array(80), view = new DataView(bytes.buffer);
    bytes.set([2,4,d.stops.length,d.brightness,d.reverse ? 1:0]);view.setUint16(6,d.transitionMs,false);
    d.stops.forEach((s,i) => { view.setUint16(16+6*i,Math.round(s.position*65535),false);bytes.set(physicalChannels(s),18+6*i); });
    return bytes;
  }
  function decodeRecipe(hex) {
    if (typeof hex !== 'string' || !/^[0-9A-F]{160}$/.test(hex)) throw Error('GRADIENT_INVALID');
    const bytes=Uint8Array.from(hex.match(/../g),s=>parseInt(s,16)),view=new DataView(bytes.buffer),count=bytes[2];
    if(bytes[0]!==2||bytes[1]!==4||count<2||count>8||bytes[3]>100||bytes[4]>1||bytes[5]!==0||view.getUint16(6,false)>750||
       bytes.slice(8,16).some(x=>x!==0)||bytes.slice(16+count*6).some(x=>x!==0))throw Error('GRADIENT_INVALID');
    const stops=[];let previous=-1;
    for(let i=0;i<count;i++){
      const at=16+6*i,position=view.getUint16(at,false);if(position<=previous)throw Error('GRADIENT_INVALID');previous=position;
      const color='#'+Array.from(bytes.slice(at+2,at+5),c=>c.toString(16).padStart(2,'0')).join('').toUpperCase();
      stops.push({position:position/65535,color,white:bytes[at+5],brightness:100,on:true});
    }
    return {stops,brightness:bytes[3],reverse:bytes[4]===1,transitionMs:view.getUint16(6,false)};
  }
  // Desired light DATA only. This is neither receiver readback nor delivery
  // authority; the dedicated native action must still validate capability2.
  function desiredState(hex) {
    const d=decodeRecipe(hex);
    const state={engine:'STATIC_GRADIENT',animation:'Statisch verloop',variant:0,v30Effect:null,previewFamily:null,category:null,legacySpi:false,
      staticGradientRecipe:hex,colors:d.stops.map(s=>s.color),whiteChannels:d.stops.map(s=>s.white),colorCount:d.stops.length,
      rgbEnabled:d.stops.map(()=>true),whiteEnabled:d.stops.map(()=>true),bri:d.brightness,brightness:d.brightness,transitionMs:d.transitionMs,
      r:0,g:0,b:0,w:0,direction:d.reverse?'left':'right',on:d.brightness>0,power:d.brightness>0};
    if(d.brightness>0)state.gradientLastBrightness=d.brightness;
    return state;
  }
  // Mirrors ordinary colour UX: changing the slider never changes the power
  // switch. Only explicit ON may restore a remembered positive brightness.
  // The capsule is DATA; fresh native capability/current checks still apply.
  function powerDim(state,patch) {
    const refuse=()=>{throw Object.assign(Error('Het vorige verloop of de helderheid ontbreekt. Pas het verloop opnieuw toe.'),{code:'GRADIENT_REAPPLY_REQUIRED'});};
    if(!plain(state)||state.engine!=='STATIC_GRADIENT'||!plain(patch)||!Object.keys(patch).length||
       Object.keys(patch).some(k=>!['on','power','bri','brightness'].includes(k)))return refuse();
    const d=decodeRecipe(state.staticGradientRecipe),level=state.bri??state.brightness,powered=state.on!==false&&state.power!==false;
    if(!Number.isInteger(level)||level<0||level>100||state.brightness!==level||
       state.on!==undefined&&typeof state.on!=='boolean'||state.power!==undefined&&typeof state.power!=='boolean'||
       state.on!==undefined&&state.power!==undefined&&state.power!==state.on||d.brightness!==(powered?level:0))return refuse();
    let remembered=state.gradientLastBrightness;
    if(remembered!==undefined&&(!Number.isInteger(remembered)||remembered<1||remembered>100))return refuse();
    if(level>0)remembered=level;
    if(Object.hasOwn(patch,'on')&&typeof patch.on!=='boolean'||Object.hasOwn(patch,'power')&&typeof patch.power!=='boolean'||
       Object.hasOwn(patch,'on')&&Object.hasOwn(patch,'power')&&patch.on!==patch.power||
       Object.hasOwn(patch,'bri')&&Object.hasOwn(patch,'brightness')&&patch.bri!==patch.brightness)return refuse();
    let next=patch.bri??patch.brightness??level,on=patch.on??patch.power??powered;
    if(!Number.isInteger(next)||next<0||next>100)return refuse();
    if(next>0)remembered=next;
    if((patch.on===true||patch.power===true)&&next===0){if(remembered===undefined)return refuse();next=remembered;}
    const definition={...d,brightness:on?next:0},capsule=Array.from(recipe(d.stops,definition),b=>b.toString(16).padStart(2,'0')).join('').toUpperCase(),desired=desiredState(capsule);
    Object.assign(desired,{bri:next,brightness:next,on,power:on});
    if(remembered!==undefined)desired.gradientLastBrightness=remembered;
    return {state:desired,definition};
  }
  const builtinPresets = Object.freeze([
    { id: 'sunset', name: 'Zonsondergang', stops: [{ color: '#FF572D', position: 0 }, { color: '#E93F83', position: .5 }, { color: '#5944D9', position: 1 }] },
    { id: 'lagoon', name: 'Lagune', stops: [{ color: '#144DCC', position: 0 }, { color: '#17C9C4', position: .55 }, { color: '#B5F4CE', position: 1 }] },
    { id: 'warm', name: 'Warm licht', stops: [{ color: '#E34825', position: 0 }, { color: '#FFAE54', position: .55 }, { color: '#FFF1CD', position: 1 }] },
    { id: 'aurora', name: 'Noorderlicht', stops: [{ color: '#5332AC', position: 0 }, { color: '#277BE0', position: .45 }, { color: '#3BD89B', position: 1 }] }
  ].map(preset => Object.freeze({ ...preset, stops: Object.freeze(preset.stops.map(Object.freeze)) })));
  function validPreset(preset) {
    return plain(preset) && Object.keys(preset).every(k=>['id','name','stops','brightness','reverse','transitionMs'].includes(k)) &&
      typeof preset.id === 'string' && /^gradient-[a-z0-9-]{1,80}$/.test(preset.id) &&
      typeof preset.name === 'string' && preset.name.trim().length > 0 && preset.name.length <= 48 &&
      !/[\u0000-\u001f\u007f]/.test(preset.name) && validateStops(preset.stops) &&
      (preset.brightness===undefined||Number.isInteger(preset.brightness)&&preset.brightness>=0&&preset.brightness<=100) &&
      (preset.reverse===undefined||typeof preset.reverse==='boolean') &&
      (preset.transitionMs===undefined||Number.isInteger(preset.transitionMs)&&preset.transitionMs>=0&&preset.transitionMs<=750);
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
        const preset = { id, name: typeof value?.name === 'string' ? value.name.trim() : value?.name, stops: value?.stops,
          brightness:value?.brightness??100,reverse:value?.reverse??false,transitionMs:value?.transitionMs??120 };
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
  return Object.freeze({ MIN_STOPS, MAX_STOPS, MAX_PRESETS, STORAGE_KEY, validateStops, stopRGB, sample, samplePixels, definition, physicalChannels, recipe, decodeRecipe, desiredState, powerDim, supportsDemo, builtinPresets, createStore });
}));
