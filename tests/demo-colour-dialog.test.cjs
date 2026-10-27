'use strict';
// Literal app functions with bounded DATA/DOM providers; not browser acceptance.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const cp = require('node:child_process');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../demo/colour.js');
const app = fs.readFileSync(path.join(__dirname, '../demo/app.js'), 'utf8');
const old = cp.execFileSync('git', ['show', '6b57ba7:demo/app.js'], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
function cut(text, name) {
  const start = text.indexOf('  function ' + name + '(');
  assert.ok(start >= 0, name);
  const next = text.indexOf('\n  function ', start + 1);
  assert.ok(next > start, name);
  return text.slice(start, next);
}
const plain = value => JSON.parse(JSON.stringify(value));
function fixture(text = app) {
  const state = { colors: ['#123456', '#456789'], whiteChannels: [20, 30], rgbEnabled: [true, true], whiteEnabled: [true, true], bri: 73 };
  const calls = [];
  const context = {
    C, console, managementBusy: false, webDemoContext: true, nativeContext: false, standControlOpen: false,
    gradientColourDraft: null, brandEditor: { index: 0, isNew: false, name: 'Brand', color: { r: 10, g: 20, b: 30, w: 40 }, memory: {} },
    selectedState: () => state, brandEditorChannels: () => [10, 20, 30, 40], backgroundChannels: () => [44, 55, 66, 77],
    effectiveColourChannels: () => [18, 52, 86, 20], myColoursMarkup: () => 'SAVED_LIBRARY',
    powerControl: () => 'POWER', slider: (...args) => 'SLIDER:' + JSON.stringify(args), icon: name => '<svg>' + name + '</svg>',
    powerTargets: () => [{state:{on:true,power:true}}],
    esc: value => String(value).replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char])),
    t: value => value, advancedInterface: () => true, modeText: value => value,
    colours: s => s.colors, activeEffect: () => ({ paletteEditable: true, backgroundEditable: true }),
    rememberedChannels: () => ({ static: { r: 1 } }), staticColour: (...args) => calls.push(['static', plain(args)]),
    updatePalette: (...args) => calls.push(['palette', plain(args)]), apply: patch => calls.push(['apply', plain(patch)]),
    syncColour: () => calls.push(['sync']), syncBackground: () => calls.push(['background']),
    syncGradientPickerControls: () => calls.push(['sync']),
    currentBrandColors: () => [{ r: 10, g: 20, b: 30, w: 40 }], saveBrandColors: value => { calls.push(['brand', plain(value)]); return true; },
    rgbOf: s => [1, 3, 5].map(i => parseInt(s.colors[0].slice(i, i + 2), 16))
  };
  vm.createContext(context);
  vm.runInContext(cut(text, 'powerControl') + '\n' + cut(text, 'colourPickerMarkup') + '\n' + cut(text, 'writePicker'), context);
  return { context, state, calls };
}
test('all original main/animation/background/brand picker markup is byte-identical', () => {
  for (const slot of [null, 0, 'background', 'brand']) for (const compact of [false, true]) {
    const before = fixture(old), after = fixture();
    assert.equal(after.context.colourPickerMarkup(slot, compact, { power: true }), before.context.colourPickerMarkup(slot, compact, { power: true }));
  }
  for (const name of ['paintWheel', 'syncColour', 'colourWheelImage']) assert.equal(cut(app, name), cut(old, name), name);
  const libraryBody = text => { const body = cut(text, 'myColoursMarkup'); return body.slice(body.indexOf('    const builtinIds=')); };
  assert.equal(libraryBody(app), libraryBody(old), 'ordinary saved-colour library body');
});
test('gradient uses the actual full app markup with wheel, RGBW/warmth/brightness/power', () => {
  const { context } = fixture();
  const html = context.colourPickerMarkup('gradient', false, { kind: 'gradient', values: [10, 20, 30, 40], brightness: 65, on: false });
  assert.match(html, /data-colour-picker="gradient"/);
  assert.match(html, /class="wheel"/); assert.match(html, /data-colour-fine/); assert.match(html, /v50FineTune/);
  for (const channel of ['r', 'g', 'b', 'w']) { assert.match(html, new RegExp('data-channel="' + channel + '"')); assert.match(html, new RegExp('data-channel-number="' + channel + '"')); }
  assert.match(html, /data-warmth/);assert.match(html,/SLIDER:\["bri","animationBrightness",0,100,65,"%","",null,"gradient-setting"\]/);
  assert.match(html,/data-action="power"/);assert.match(html,/aria-checked="false"/);
  const library = fixture().context;
  library.savedColours = { colors: [{ id: 'red', name: 'RGB', color: { r: 255, g: 0, b: 0, w: 0 } }, { id: 'white', name: 'W', color: { r: 0, g: 0, b: 0, w: 255 } }] };
  library.presetText667 = key => key;
  vm.runInContext(cut(app, 'myColoursMarkup'), library);
  const swatches = library.myColoursMarkup({ draftOnly: true });
  assert.match(swatches, /data-action="swatch" data-id="red"/);
  assert.match(swatches,/data-id="white"/);assert.doesNotMatch(swatches, /colour-new|colour-preset-edit/);
});
test('gradient brightness label targets its own slider, not the hidden solid picker',()=>{
  const {context}=fixture();
  vm.runInContext(cut(app,'slider'),context);
  const normal=context.slider('bri','Helderheid',0,100,100,'%');
  const gradient=context.slider('bri','Helderheid',0,100,65,'%', '',null,'gradient-setting');
  assert.match(normal,/for="setting-bri"/);assert.match(normal,/id="setting-bri"/);
  assert.match(gradient,/for="gradient-setting-bri"/);assert.match(gradient,/id="gradient-setting-bri"/);
  assert.doesNotMatch(gradient,/\bid="setting-bri"/);
});
test('gradient writes/toggles are local DATA and stale gradient can never fall through to apply', () => {
  const { context, calls, state } = fixture();
  let current = true;
  context.gradientPickerCurrent = () => current;
  context.gradientColourDraft = { values: [10, 20, 30, 0], brightness:100,on:true,memory: { r: 10, g: 20, b: 30,w:35 } };
  vm.runInContext(cut(app, 'pickerChannels') + '\n' + cut(app, 'restoreChannelValue'), context);
  const root = { dataset: { colourPicker: 'gradient' } }, before = JSON.stringify(state);
  context.writePicker(root, [100, 0, 50], 0, 'rgb');
  assert.deepEqual(plain(context.pickerChannels(root)), [100, 0, 50, 0]);
  assert.equal(context.restoreChannelValue(root, 'g'), 20);
  assert.deepEqual(calls, [['sync']]); assert.equal(JSON.stringify(state), before);
  for (const input of [[1.5, 0, 0], [256, 0, 0], [0, NaN, 0]]) context.writePicker(root, input, 0);
  context.writePicker(root, [1, 2, 3], 256);context.writePicker(root,[1,2,3],NaN);
  context.writePicker(root,C.warmWhite(70).slice(0,3),C.warmWhite(70)[3],'both');
  assert.deepEqual(plain(context.pickerChannels(root)),C.warmWhite(70));assert.equal(context.restoreChannelValue(root,'w'),C.warmWhite(70)[3]);
  current = false; context.writePicker(root, [1, 2, 3], 0);
  assert.deepEqual(plain(context.pickerChannels(root)), [0, 0, 0, 0]);
  assert.equal(context.restoreChannelValue(root, 'r'), 0); assert.deepEqual(calls, [['sync'],['sync']]);
});
test('original static/animation/background write transcripts remain identical', () => {
  for (const kind of ['static', 'animation', 'background', 'brand']) for (const changed of ['rgb', 'white', 'both']) {
    const before = fixture(old), after = fixture();
    after.context.gradientPickerCurrent = () => false;
    const root = { dataset: { colourPicker: kind, slot: '0' }, querySelector: () => null };
    before.context.writePicker(root, [20, 30, 40], 50, changed); after.context.writePicker(root, [20, 30, 40], 50, changed);
    assert.deepEqual(after.calls, before.calls, kind + ':' + changed);
  }
});
test('real app draft open/Done is one-use; Cancel/context/source/route loss cannot commit', () => {
  for (const invalid of [null, 'cancel', 'context', 'source', 'route', 'root', 'admission']) {
    const { context } = fixture(); let alive = true, contextKey = 'view', zoneId = 'spi';
    const root = { isConnected: true }, source = { isConnected: true }, dialog = { open: false, querySelector: () => root }, commits = [];
    context.document = { getElementById: () => dialog };
    context.zone = () => ({ id: zoneId, type: 'SPI' }); context.motionContextKey = () => contextKey;
    context.showEffectDialog = () => { dialog.open = true; }; context.paintWheel = () => {};
    context.closeEffectDialog = () => { dialog.open = false; context.gradientColourDraft = null; };
    vm.runInContext(cut(app, 'gradientPickerCurrent') + '\n' + cut(app, 'openGradientColourPicker') + '\n' + cut(app, 'finishGradientColourPicker'), context);
    assert.equal(context.openGradientColourPicker({ source, color: '#123456', current: () => alive, commit: color => commits.push(color) }), true);
    context.gradientColourDraft.values = [100, 110, 120, 35];context.gradientColourDraft.brightness=65;context.gradientColourDraft.on=false;
    if (invalid === 'cancel') context.closeEffectDialog();
    if (invalid === 'context') contextKey = 'new-view';
    if (invalid === 'source') source.isConnected = false;
    if (invalid === 'route') zoneId = 'other-zone';
    if (invalid === 'root') root.isConnected = false;
    if (invalid === 'admission') alive = false;
    context.finishGradientColourPicker(); context.finishGradientColourPicker();
    assert.deepEqual(plain(commits), invalid ? [] : [{color:'#646E78',white:35,brightness:65,on:false}], invalid || 'valid');
  }
});
test('actual gradient brightness/power/preset handler cuts return before ordinary light writes',()=>{
  const {context,calls}=fixture();let admitted=true;
  context.gradientPickerCurrent=()=>admitted;context.gradientColourDraft={brightness:100,on:true,values:[0,0,0,0],memory:{}};
  const powerStart=app.indexOf("      if(action==='power'&&button.closest('[data-colour-picker=\"gradient\"]')){");
  const powerEnd=app.indexOf("      if(action==='power'){",powerStart);
  const briStart=app.indexOf('      const gradientRoot=input.closest?');const briEnd=app.indexOf("      if(input.matches('[data-security-pin]",briStart);
  assert.ok(powerStart>0&&powerEnd>powerStart&&briStart>0&&briEnd>briStart);
  vm.runInContext('function handlePower(button){const action="power";'+app.slice(powerStart,powerEnd)+'apply({unexpected:true});}\n'+
    'function handleBrightness(input){'+app.slice(briStart,briEnd)+'apply({unexpected:true});}',context);
  const root={dataset:{colourPicker:'gradient'}};
  context.handlePower({closest:()=>root});assert.equal(context.gradientColourDraft.on,false);
  context.handleBrightness({closest:()=>root,dataset:{setting:'bri'},value:'37'});assert.equal(context.gradientColourDraft.brightness,37);
  for(const value of ['-1','101','NaN'])context.handleBrightness({closest:()=>root,dataset:{setting:'bri'},value});
  admitted=false;context.handlePower({closest:()=>root});context.handleBrightness({closest:()=>root,dataset:{setting:'bri'},value:'80'});
  assert.equal(context.gradientColourDraft.on,false);assert.equal(context.gradientColourDraft.brightness,37);
  assert.deepEqual(calls,[['sync'],['sync']]);
  const presetStart=app.indexOf("        if(root?.dataset.colourPicker==='gradient'){\n          if(gradientPickerCurrent(root))");
  const presetEnd=app.indexOf("        if(['animation','background','brand'].includes",presetStart);
  assert.ok(presetStart>0&&presetEnd>presetStart);
  vm.runInContext('function handlePreset(root,entry){'+app.slice(presetStart,presetEnd)+'apply({unexpected:true});}',context);
  admitted=true;context.handlePreset(root,{color:{r:11,g:22,b:33,w:44,bri:55}});
  assert.deepEqual(plain(context.gradientColourDraft.values),[11,22,33,44]);assert.equal(context.gradientColourDraft.brightness,55);
  admitted=false;context.handlePreset(root,{color:{r:99,g:99,b:99,w:99,bri:99}});
  assert.deepEqual(plain(context.gradientColourDraft.values),[11,22,33,44]);assert.equal(context.gradientColourDraft.brightness,55);
  assert.deepEqual(calls,[['sync'],['sync'],['sync']]);
});
