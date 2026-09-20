/* V30 Mijn kleuren. Pure light presets, never receiver identities or access
 * credentials. Defaults are returned in memory; only explicit edits persist.
 * This module never reads or changes existing V21 app data.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LightningColoursLibrary = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const STORAGE_KEY = 'aluvision.v30.colours-library.v1';
  const MAX_COLORS = 100;
  const MAX_BYTES = 64000;
  const owns = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const plain = value => !!value && typeof value === 'object' && !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value));
  const dangerous = value => plain(value) && ['__proto__', 'constructor', 'prototype'].some(key => owns(value, key));
  const clone = value => JSON.parse(JSON.stringify(value));
  const validId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(value);
  const validName = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 64 && !/[\u0000-\u001f\u007f]/.test(value);
  const numberIn = (value, low, high) => typeof value === 'number' && Number.isFinite(value) && value >= low && value <= high;
  const fail = (code, message) => { const error = new Error(message); error.code = code; throw error; };
  function onlyKeys(value, keys, code) {
    if (!plain(value) || dangerous(value) || Object.keys(value).some(key => !keys.includes(key))) {
      fail(code, 'Deze kleur bevat onbekende of ongeldige gegevens.');
    }
  }
  function validateColor(value) {
    onlyKeys(value, ['r','g','b','w','bri'], 'COLOR');
    for (const key of ['r','g','b','w']) {
      if (!Number.isInteger(value[key]) || !numberIn(value[key], 0, 255)) fail('COLOR_VALUE', 'De RGBW-kanalen moeten tussen 0 en 255 liggen.');
    }
    if (!numberIn(value.bri, 0, 100)) fail('BRIGHTNESS', 'Kleurhelderheid moet tussen 0 en 100 liggen.');
    return { r:value.r, g:value.g, b:value.b, w:value.w, bri:value.bri };
  }
  function suggestName(value) {
    const {r,g,b,w,bri} = validateColor(value);
    const high = Math.max(r,g,b), low = Math.min(r,g,b), range = high - low;
    if (bri === 0 || high + w === 0) return 'Zwart';
    // The dedicated white channel has no known colour temperature. Its level
    // describes brightness, so never invent a warm/cool or Kelvin label.
    if (high === 0) return w * bri / 100 < 64 ? 'Gedimd wit' : 'Wit';
    // White dilutes the RGB hue. Normalize the sum instead of clipping each
    // channel, which would incorrectly turn saturated RGB + white into white.
    const scale = Math.max(255, high + w);
    const lightness = (high + low + 2 * w) / (2 * scale);
    const visibleLightness = lightness * bri / 100;
    if (range / (high + w) <= 0.09) {
      if (visibleLightness < 0.04) return 'Zwart';
      if (visibleLightness >= 0.9) return 'Wit';
      if (visibleLightness < 0.25) return 'Donkergrijs';
      if (visibleLightness >= 0.7) return 'Lichtgrijs';
      return 'Grijs';
    }
    let hue;
    if (high === r) hue = 60 * ((g - b) / range);
    else if (high === g) hue = 60 * (2 + (b - r) / range);
    else hue = 60 * (4 + (r - g) / range);
    hue = (hue + 360) % 360;
    const hues = [[0,'Rood'],[30,'Oranje'],[60,'Geel'],[120,'Groen'],
      [180,'Cyaan'],[240,'Blauw'],[280,'Paars'],[330,'Roze']];
    let name = hues[0][1], distance = Infinity;
    for (const [reference, label] of hues) {
      const difference = Math.abs(hue - reference);
      const circularDistance = Math.min(difference, 360 - difference);
      if (circularDistance < distance) { name = label; distance = circularDistance; }
    }
    // Light red is conventionally pink, including RGB red softened with W.
    if (name === 'Rood' && lightness >= 0.68) name = 'Roze';
    if (visibleLightness < 0.2) return 'Donker' + name.toLowerCase();
    if (visibleLightness >= 0.72) return 'Licht' + name.toLowerCase();
    return name;
  }
  function validate(value) {
    onlyKeys(value, ['version','id','name','color'], 'ENTRY');
    if (value.version !== 1 || !validId(value.id) || !validName(value.name)) fail('ENTRY', 'Deze opgeslagen kleur is niet geldig.');
    return { version:1, id:value.id, name:value.name, color:validateColor(value.color) };
  }
  let sequence = 0;
  function newId() {
    if (typeof globalThis.crypto === 'object' && typeof globalThis.crypto.randomUUID === 'function') return 'colour-' + globalThis.crypto.randomUUID();
    sequence += 1;
    return 'colour-' + Date.now().toString(36) + '-' + sequence.toString(36) + '-' + Math.random().toString(36).slice(2,10);
  }
  function capture(name, state, options = {}) {
    if (typeof name !== 'string' || !validName(name.trim())) fail('NAME', 'Geef je kleur een naam van 1 tot 64 tekens.');
    if (!plain(state) || dangerous(state)) fail('COLOR', 'Kies eerst een geldige kleur.');
    const id = options.id === undefined ? newId() : options.id;
    if (!validId(id)) fail('ID', 'De kleur-identiteit is niet geldig.');
    // Explicit field selection strips credentials, geometry and destinations.
    const color = { r:state.r, g:state.g, b:state.b, w:state.w === undefined ? 0 : state.w,
      bri:state.bri === undefined ? 100 : state.bri };
    return validate({ version:1, id, name:name.trim(), color });
  }
  function defaults() {
    return [
      ['colour-red','Rood',255,0,0,0], ['colour-green','Groen',0,255,0,0],
      ['colour-blue','Blauw',0,0,255,0], ['colour-white','Wit',0,0,0,255]
    ].map(([id,name,r,g,b,w]) => ({version:1,id,name,color:{r,g,b,w,bri:100}}));
  }
  function restore(entry) {
    const { color } = validate(entry), { r,g,b,w,bri } = color;
    const hex = '#' + [r,g,b].map(value=>value.toString(16).padStart(2,'0')).join('').toUpperCase();
    return { r,g,b,w,bri,brightness:bri,colors:[hex],whiteChannels:[w],colorCount:1,
      rgbEnabled:[true],whiteEnabled:[true],engine:'STATIC',variant:0,animation:'Static Color',
      category:null,v30Effect:null,previewFamily:null,legacySpi:false,bounce:false,mirror:false,on:true,power:true };
  }
  const storageError = (code,message,colors=[]) => ({colors:clone(colors),error:{code,message}});
  function createStore(storage) {
    function load() {
      let raw;
      try {
        if (!storage || typeof storage.getItem !== 'function') return storageError('STORAGE_UNAVAILABLE', 'Mijn kleuren kunnen hier niet lokaal worden bewaard.');
        raw = storage.getItem(STORAGE_KEY);
      } catch (_) { return storageError('STORAGE_UNAVAILABLE', 'De lokale kleurenopslag is niet bereikbaar.'); }
      // Missing is not the same as intentionally empty. Never seed by writing.
      if (raw === null || raw === undefined) return {colors:defaults(),error:null};
      try {
        if (typeof raw !== 'string' || raw.length > MAX_BYTES) throw new Error('Invalid colour envelope');
        const envelope = JSON.parse(raw);
        onlyKeys(envelope,['version','colors'],'STORAGE_CORRUPT');
        if (envelope.version !== 1 || !Array.isArray(envelope.colors) || envelope.colors.length > MAX_COLORS) throw new Error('Invalid colour envelope');
        const colors = envelope.colors.map(validate);
        if (new Set(colors.map(color=>color.id)).size !== colors.length) throw new Error('Duplicate colour identity');
        return {colors,error:null};
      } catch (_) { return storageError('STORAGE_CORRUPT', 'Je opgeslagen kleuren konden niet veilig worden gelezen. Ze zijn niet overschreven.'); }
    }
    function write(colors, previous) {
      try {
        if (!storage || typeof storage.setItem !== 'function') return storageError('STORAGE_UNAVAILABLE', 'Mijn kleuren kunnen hier niet lokaal worden bewaard.', previous);
        const raw = JSON.stringify({version:1,colors});
        if (raw.length > MAX_BYTES) return storageError('STORAGE_FULL', 'De kleurenopslag is vol. Verwijder eerst een ongebruikte kleur.', previous);
        storage.setItem(STORAGE_KEY, raw);
        return {colors:clone(colors),error:null};
      } catch (_) { return storageError('STORAGE_WRITE', 'De wijziging kon niet worden bewaard. Je bestaande kleuren blijven staan.', previous); }
    }
    function save(entry) {
      const current = load();
      if (current.error) return current;
      let saved;
      try { saved = validate(entry); }
      catch (error) { return storageError(error.code || 'ENTRY', error.message, current.colors); }
      const index = current.colors.findIndex(color=>color.id===saved.id);
      if (index < 0 && current.colors.length >= MAX_COLORS) return storageError('COLOR_LIMIT', 'Je hebt 100 kleuren. Verwijder eerst een ongebruikte kleur.', current.colors);
      const next = current.colors.slice();
      if (index < 0) next.push(saved); else next[index] = saved;
      return write(next,current.colors);
    }
    function remove(id) {
      const current = load();
      if (current.error) return current;
      if (!validId(id)) return storageError('ID', 'Kies de kleur die je wilt verwijderen.', current.colors);
      if (!current.colors.some(color=>color.id===id)) return current;
      return write(current.colors.filter(color=>color.id!==id),current.colors);
    }
    function move(id, toIndex) {
      const current = load();
      if (current.error) return current;
      if (!validId(id)) return storageError('ID', 'Kies de kleur die je wilt verplaatsen.', current.colors);
      if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= current.colors.length) {
        return storageError('MOVE_INDEX', 'Kies een bestaande positie in Mijn kleuren.', current.colors);
      }
      const fromIndex = current.colors.findIndex(color=>color.id===id);
      // A colour removed in another view and an unchanged position need no write.
      if (fromIndex < 0 || fromIndex === toIndex) return current;
      const next = current.colors.slice();
      const [entry] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, entry);
      return write(next, current.colors);
    }
    return Object.freeze({load,save,remove,move});
  }
  return Object.freeze({STORAGE_KEY,MAX_COLORS,capture,validate,suggestName,restore,defaults,createStore});
}));
