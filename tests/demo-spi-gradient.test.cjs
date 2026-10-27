'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const G = require('../demo/static-gradient.js');
const C = require('../demo/colour.js');
const M = require('../demo/model.js');
const P = require('../demo/preview.js');
const stops = [{ color: '#FF0000', position: 0 }, { color: '#0000FF', position: 1 }];
function memory() {
  const values = new Map();
  return { getItem: key => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, value), values };
}
test('two to eight strict ordered colour stops; malformed DATA is refused', () => {
  assert.equal(G.validateStops(stops), true);
  for (const value of [null, [], [stops[0]], Array(9).fill(stops[0]),
    [{ color: 'red', position: 0 }, stops[1]], [{ color: '#FFFFFF', position: NaN }, stops[1]],
    [stops[1], stops[0]], [{ ...stops[0], position: -.01 }, stops[1]],
    [stops[0], { ...stops[1], position: 1.01 }], [stops[0], { ...stops[1], position: .009 }],
    [{ ...stops[0], unexpected: true }, stops[1]]]) assert.equal(G.validateStops(value), false);
  for (const value of [NaN, Infinity, -1, 2]) assert.throws(() => G.sample(stops, value));
});
test('400-pixel interpolation reaches both ends without a hard colour cut', () => {
  const pixels = G.samplePixels(stops, 400);
  assert.equal(pixels.length, 400);
  assert.deepEqual(pixels[0], [255, 0, 0]); assert.deepEqual(pixels[399], [0, 0, 255]);
  assert.deepEqual(G.sample(stops, .5), [128, 0, 128]);
  for (let i = 1; i < pixels.length; i++) {
    assert.ok(pixels[i][0] <= pixels[i - 1][0]); assert.ok(pixels[i][2] >= pixels[i - 1][2]);
    assert.ok(Math.abs(pixels[i][0] - pixels[i - 1][0]) <= 1);
  }
  assert.ok(new Set(pixels.map(pixel => pixel.join(','))).size >= 256);
});
test('full picker white, point brightness and on/off are retained and mixed before interpolation', () => {
  const mixed = [{ color: '#102030', position: 0, white: 32, brightness: 50, on: true },
    { color: '#FFFFFF', position: 1, white: 255, brightness: 80, on: false }];
  assert.equal(G.validateStops(mixed), true);
  assert.deepEqual(G.stopRGB(mixed[0]), [23, 30, 37]);
  assert.deepEqual(G.samplePixels(mixed, 3), [[23, 30, 37], [12, 15, 19], [0, 0, 0]]);
  assert.deepEqual(G.stopRGB({ color: '#F01000', position: 0, white: 64 }), [244, 76, 64]);
  for (const extra of [{ white: -1 }, { white: 1.5 }, { white: 256 }, { white: undefined },
    { brightness: -1 }, { brightness: 101 }, { brightness: NaN }, { on: 1 }, { on: null }]) {
    const stop = { ...mixed[0], ...extra };
    assert.equal(G.validateStops([stop, mixed[1]]), false);
    assert.throws(() => G.stopRGB(stop));
  }
  const store = G.createStore(memory()), saved = store.save({ name: 'Volledige kleur', stops: mixed });
  assert.equal(saved.error, null); assert.deepEqual(store.load().presets[0].stops, mixed);
  assert.deepEqual(G.samplePixels(stops, 400), G.samplePixels(stops.map(stop => ({ ...stop, white: 0, brightness: 100, on: true })), 400));
});
test('point white and dimming match the ordinary shared colour preview math',()=>{
  for(const color of ['#000000','#FFFFFF','#102030','#C94E46','#F01000'])
    for(const white of [0,1,32,64,127,128,254,255])for(const brightness of [0,1,37,62,100]){
      const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
      assert.deepEqual(G.stopRGB({color,position:0,white,brightness}),C.mixWhite(rgb,white).map(channel=>Math.round(channel*brightness/100)));
    }
});
test('stop positions change proportions; endpoint colour holds outside stop range', () => {
  const shifted = [{ color: '#FF0000', position: .4 }, { color: '#0000FF', position: .8 }];
  assert.deepEqual(G.sample(shifted, .2), [255, 0, 0]); assert.deepEqual(G.sample(shifted, 1), [0, 0, 255]);
  assert.deepEqual(G.sample(shifted, .6), [128, 0, 127]);
  assert.notDeepEqual(G.sample(shifted, .5), G.sample(stops, .5));
});
test('static output is deterministic, nonmutating, dimmable and reversible once', () => {
  const before = JSON.stringify(stops), normal = G.samplePixels(stops, 400);
  assert.deepEqual(G.samplePixels(stops, 400), normal);
  assert.deepEqual(G.samplePixels(stops, 400, { reverse: true }), [...normal].reverse());
  assert.deepEqual(G.samplePixels(stops, 400, { brightness: 0 }), Array.from({ length: 400 }, () => [0, 0, 0]));
  assert.deepEqual(G.samplePixels(stops, 1), [[255, 0, 0]]); assert.equal(JSON.stringify(stops), before);
  for (const count of [0, -1, 1.5, 8193, NaN]) assert.throws(() => G.samplePixels(stops, count));
  assert.throws(() => G.samplePixels(stops, 400, { reverse: 1 }));
  assert.throws(() => G.samplePixels(stops, 400, { brightness: 101 }));
  assert.deepEqual(C.screenRGB([0, 128, 255]), [0, 188, 255]);
});
test('built-in presets are immutable valid smooth static DATA', () => {
  assert.equal(G.builtinPresets.length, 4);
  G.builtinPresets.forEach(preset => { assert.ok(G.validateStops(preset.stops)); assert.equal(G.samplePixels(preset.stops, 400).length, 400); });
  assert.throws(() => { G.builtinPresets[0].stops[0].color = '#000000'; });
});
test('custom presets roundtrip, update, copy and delete in injected demo storage only', () => {
  const storage = memory(), store = G.createStore(storage);
  storage.setItem('ordinary-colours', 'untouched');
  const saved = store.save({ name: 'Balie warm', stops }); assert.equal(saved.error, null);
  const loaded = store.load().presets[0]; assert.equal(loaded.name, 'Balie warm'); assert.deepEqual(loaded.stops, stops);
  loaded.stops[0].color = '#000000'; assert.deepEqual(store.load().presets[0].stops, stops);
  const edited = store.save({ id: saved.savedId, name: 'Nieuwe naam', stops }); assert.equal(edited.presets.length, 1);
  const copy = store.save({ name: 'Kopie', stops }); assert.equal(copy.presets.length, 2);
  assert.equal(store.remove(saved.savedId).presets.length, 1);
  assert.equal(storage.getItem('ordinary-colours'), 'untouched');
  assert.equal(G.createStore(memory()).load().presets.length, 0);
});
test('corrupt / oversized / unknown preset storage fails closed without overwriting', () => {
  const storage = memory(), store = G.createStore(storage);
  for (const raw of ['{', '{}', '{"version":2,"presets":[]}', '{"version":1,"presets":[],"extra":true}']) {
    storage.setItem(G.STORAGE_KEY, raw); assert.ok(store.load().error); assert.ok(store.save({ name: 'Test', stops }).error);
    assert.equal(storage.getItem(G.STORAGE_KEY), raw);
  }
  storage.values.clear();
  assert.ok(store.save({ name: '', stops }).error); assert.ok(store.save({ name: 'x'.repeat(49), stops }).error);
  assert.ok(store.save({ name: 'bad\nname', stops }).error); assert.ok(store.save({ id: 'gradient-absent', name: 'Test', stops }).error);
  for (let i = 0; i < 24; i++) assert.equal(store.save({ name: 'Preset ' + i, stops }).error, null);
  assert.ok(store.save({ name: 'Too many', stops }).error);
  assert.ok(G.createStore(null).save({ name: 'Test', stops }).error);
});
test('capability is explicitly browser-demo SPI; no implicit native fallback', () => {
  assert.equal(G.supportsDemo({ demoOnly: true, native: false, family: 'SPI' }), true);
  for (const config of [{}, { demoOnly: true, native: true, family: 'SPI' }, { demoOnly: true, native: false, family: 'RGBW' },
    { demoOnly: false, native: false, family: 'SPI' }, { demoOnly: 1, native: false, family: 'SPI' }, { demoOnly: true, family: 'SPI' }])
    assert.equal(G.supportsDemo(config), false);
  const ui = fs.readFileSync(path.join(__dirname, '../demo/static-gradient-ui.js'), 'utf8');
  assert.doesNotMatch(ui, /\b(?:fetch|XMLHttpRequest|localStorage|sessionStorage|sendReceiverStates|executeOwner)\s*[.(]/);
});
test('existing model STATIC and RGBW preview are unchanged; gradient DATA never enters them', () => {
  const state = M.defaultState(), receiver = { id: 'test', type: 'RGBW', state };
  const before = JSON.stringify(state);
  const sample = P.sample(receiver, 0, { index: 0, count: 1, pixelCount: 1, totalPixels: 1, offset: 0 });
  assert.ok(Array.isArray(sample)); assert.equal(JSON.stringify(state), before);
  assert.equal(state.engine, 'STATIC'); assert.equal(Object.hasOwn(state, 'gradient'), false);
});
test('actual UI module renders 400 sampled cells and defaults to no editor without demo admission', () => {
  const window = { LightningStaticGradient: G, LightningColour: C };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../demo/static-gradient-ui.js'), 'utf8'), { window });
  const UI = window.LightningStaticGradientUI;
  assert.equal(UI.create().markup('<p>Original solid</p>'), '<p>Original solid</p>');
  const markup = UI.create({ storage: memory(), allowed: () => true }).markup('<p>Original solid</p>');
  assert.match(markup, /data-gradient-mode-choice="gradient"/);
  assert.match(markup, /data-gradient-solid/); assert.match(markup, /<p>Original solid<\/p>/);
  const calls = [], context = { fillStyle: '', fillRect(...args) { calls.push({ args, color: this.fillStyle }); } };
  const canvas = { getContext: () => context };
  UI.draw(canvas, stops);
  assert.equal(canvas.width, 400); assert.equal(canvas.height, 72); assert.equal(calls.length, 401);
  assert.deepEqual(calls[1], { args: [0, 23, 1, 26], color: '#FF0000' });
  assert.deepEqual(calls[400], { args: [399, 23, 1, 26], color: '#0000FF' });
  assert.equal(calls[201].color, C.screenHex(G.samplePixels(stops, 400)[200]));
});
test('actual add/edit callback keeps original stops until Done and is current/one-use', () => {
  // Minimal local node providers, not HTML parsing/browser-event acceptance.
  for (const operation of ['edit','add']) for (const change of ['none', 'selection', 'draft', 'unmount', 'source', 'admission']) {
    // Core and editor share the same realm, as in the real page. The core
    // intentionally rejects foreign-prototype objects at its DATA boundary.
    const window = { LightningColour: C };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../demo/static-gradient.js'), 'utf8') +
      '\nwindow.LightningStaticGradient = LightningStaticGradient;\n' +
      fs.readFileSync(path.join(__dirname, '../demo/static-gradient-ui.js'), 'utf8'), { window });
    const element = () => ({ isConnected: true, dataset: {}, disabled: false, textContent: '', value: '', style: { setProperty() {} },
      classList: { toggle() {} }, setAttribute() {}, focus() {}, hasAttribute: () => false });
    const entries = new Map(), panel = element(), rail = element(), color = element(),add=element();
    const lookup = selector => { if (!entries.has(selector)) entries.set(selector, element()); return entries.get(selector); };
    color.hasAttribute = attr => attr === 'data-gradient-color-open'; color.closest = selector => selector === 'button' ? color : null;
    entries.set('[data-gradient-panel]', panel); entries.set('[data-gradient-rail]', rail); entries.set('[data-gradient-color-open]', color);
    add.hasAttribute=attr=>attr==='data-gradient-add';entries.set('[data-gradient-add]',add);
    entries.set('[data-gradient-preview]', { getContext: () => ({ fillRect() {}, fillStyle: '' }) });
    const stopNodes = [0, 1, 2].map(i => Object.assign(element(), { dataset: { gradientStop: String(i) } }));
    rail.querySelectorAll = () => stopNodes;
    panel.querySelector = lookup;
    const listeners = new Map(), host = { isConnected: true, dataset: {}, querySelector: lookup, querySelectorAll: () => [],
      addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: type => listeners.delete(type) };
    let allowed = true, request;
    const editor = window.LightningStaticGradientUI.create({ storage: memory(), allowed: () => allowed, chooseColor: value => { request = value; } });
    const unmount = editor.mount(host);
    function click(button) { button.closest = () => button; listeners.get('click')({ target: button }); }
    click({ ...element(), dataset: { gradientModeChoice: 'gradient' } });
    const stopCount=()=>Array.from(panel.innerHTML.matchAll(/data-gradient-stop="\d+"/g)).length;
    assert.equal(stopCount(),3);click(operation==='add'?add:color);assert.equal(stopCount(),3,'open/cancel has not inserted a point');
    assert.ok(request.current(), change);
    if (change === 'selection') click({ ...element(), dataset: { gradientStop: '0' }, hasAttribute: attr => attr === 'data-gradient-stop' });
    if (change === 'draft') click({ ...element(), dataset: { gradientBuiltin: 'lagoon' } });
    if (change === 'unmount') unmount();
    if (change === 'source') (operation==='add'?add:color).isConnected = false;
    if (change === 'admission') allowed = false;
    assert.equal(request.current(), change === 'none', change);
    request.commit({color:'#102030',white:35,brightness:65,on:false});
    assert.equal(request.current(), false, 'committed or stale requests cannot be reused');
    if(change==='none')assert.equal(stopCount(),operation==='add'?4:3);
    if (change !== 'unmount') unmount();
  }
});
test('actual even-distribution handlers keep boundary moves and new points valid', () => {
  // The actual complete module/handlers run with bounded local node providers;
  // this checks DATA transitions, not browser pointer-capture acceptance.
  function fixture(initialStops = null) {
    const window = { LightningColour: C }, storage = memory();
    if (initialStops) storage.setItem(G.STORAGE_KEY, JSON.stringify({ version: 1,
      presets: [{ id: 'gradient-tight', name: 'Dicht bij elkaar', stops: initialStops }] }));
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../demo/static-gradient.js'), 'utf8') +
      '\nwindow.LightningStaticGradient=LightningStaticGradient;\n' +
      fs.readFileSync(path.join(__dirname, '../demo/static-gradient-ui.js'), 'utf8'), { window });
    const element = () => ({ isConnected: true, dataset: {}, disabled: false, style: { setProperty() {} },
      classList: { toggle() {} }, setAttribute() {}, focus() {}, matches: () => false,
      hasAttribute: () => false, setPointerCapture() {} });
    const button = (attribute, dataset = {}) => {
      const node = Object.assign(element(), { dataset, hasAttribute: name => name === attribute });
      node.closest = () => node; return node;
    };
    const entries = new Map(), panel = element(), rail = element(), listeners = new Map();
    const lookup = selector => { if (!entries.has(selector)) entries.set(selector, element()); return entries.get(selector); };
    entries.set('[data-gradient-panel]', panel); entries.set('[data-gradient-rail]', rail);
    entries.set('[data-gradient-preview]', { getContext: () => ({ fillRect() {} }) });
    const add = button('data-gradient-add'); entries.set('[data-gradient-add]', add);
    panel.querySelector = lookup;
    rail.querySelectorAll = () => Array.from(panel.innerHTML.matchAll(/data-gradient-stop="(\d+)"/g),
      match => button('data-gradient-stop', { gradientStop: match[1] }));
    rail.getBoundingClientRect = () => ({ left: 0, width: 100 });
    const host = { isConnected: true, dataset: {}, querySelector: lookup, querySelectorAll: () => [],
      addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener: type => listeners.delete(type) };
    let request;
    const editor = window.LightningStaticGradientUI.create({ storage, allowed: () => true, chooseColor: value => { request = value; } });
    editor.mount(host);
    const click = node => listeners.get('click')({ target: node });
    click(button('', { gradientModeChoice: 'gradient' }));
    if (initialStops) click(button('', { gradientLoad: 'gradient-tight' }));
    return { click, button, listeners, lookup, add,
      addPoint() { click(add); assert.ok(request.current()); request.commit({ color: '#123456', white: 0, brightness: 100, on: true }); },
      saved() { click(button('data-gradient-save')); const value = JSON.parse(storage.getItem(G.STORAGE_KEY));
        assert.ok(value?.presets?.length); const result = value.presets[0].stops; assert.ok(G.validateStops(result)); return result; } };
  }
  for (const count of [4, 7, 8]) {
    const f = fixture();
    for (let length = 3; length < count; length++) { f.addPoint(); assert.equal(f.saved().length, length + 1); }
    for (let index = 0; index < count; index++) {
      f.click(f.button('data-gradient-even'));
      const target = f.button('data-gradient-stop', { gradientStop: String(index) }); f.click(target);
      const initial = f.saved(), tolerance = 1e-7;
      const min = index ? Math.ceil(initial[index - 1].position * 100 + 1 - tolerance) : 0;
      const max = index < count - 1 ? Math.floor(initial[index + 1].position * 100 - 1 + tolerance) : 100;
      const key = name => f.listeners.get('keydown')({ target, key: name, preventDefault() {} });
      key('End'); assert.equal(f.saved()[index].position, max / 100);
      key('Home'); assert.equal(f.saved()[index].position, min / 100);
      const range = f.lookup('[data-gradient-position]'); range.matches = selector => selector === '[data-gradient-position]';
      for (const value of [range.max, range.min]) {
        range.value = value; f.listeners.get('input')({ target: range });
        assert.equal(f.saved()[index].position, Number(value) / 100);
      }
      f.listeners.get('pointerdown')({ target, button: 0, pointerId: 1, preventDefault() {} });
      for (const clientX of [200, -100]) {
        f.listeners.get('pointermove')({ pointerId: 1, clientX }); assert.ok(G.validateStops(f.saved()));
      }
      f.listeners.get('pointerup')({ pointerId: 1 });
    }
    // Add after the fractional even positions, without hand-correcting Layout/DATA.
    f.click(f.button('data-gradient-even'));
    if (count < 8) { f.addPoint(); assert.equal(f.saved().length, count + 1); }
    else { f.click(f.add); assert.equal(f.saved().length, 8); }
  }
  // The strict DATA schema permits fractional clusters that have no valid
  // whole-percent destination: leave such a loaded point unchanged.
  const f = fixture([1 / 3, 1 / 3 + .01, 1 / 3 + .02].map(position => ({ color: '#123456', position })));
  const target = f.button('data-gradient-stop', { gradientStop: '1' }); f.click(target);
  const original = f.saved(), range = f.lookup('[data-gradient-position]');
  assert.ok(Number(range.min) > Number(range.max));
  for (const key of ['Home', 'End']) f.listeners.get('keydown')({ target, key, preventDefault() {} });
  range.matches = selector => selector === '[data-gradient-position]'; range.value = range.min;
  f.listeners.get('input')({ target: range }); assert.deepEqual(f.saved(), original);
});
