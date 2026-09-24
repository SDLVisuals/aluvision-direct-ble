/* Pure V30 preview formulas. No transport or firmware command mappings.
 * New effects use namespaced IDs until both firmware families implement them.
 * RGB + neutral W is an optical preview, not a calibrated CCT simulation.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LightningAnimationEngine = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, low, high, fallback = low) => Math.max(low, Math.min(high, finite(value, fallback)));
  const mod = (value, divisor) => ((value % divisor) + divisor) % divisor;
  const mix = (a, b, fraction) => a.map((value, index) => value + (b[index] - value) * fraction);
  const ease = value => { const x = clamp(value, 0, 1); return x * x * (3 - 2 * x); };
  const RGB = ['#FF0000', '#00FF00', '#0000FF'];
  const SEVEN = ['#FF0000', '#FF8000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#8000FF'];
  const DEFAULT_BRAND = '#C94E46';
  function rgb(value) {
    let source = String(value || '#000000').replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(source)) source = source.split('').map(c => c + c).join('');
    return /^[0-9a-f]{6}$/i.test(source) ? [0, 2, 4].map(i => parseInt(source.slice(i, i + 2), 16)) : [0, 0, 0];
  }
  function optical(slot, white = 0) {
    const w = clamp(white, 0, 255) / 255;
    return rgb(slot).map(channel => 255 - (255 - channel) * (1 - w));
  }
  function palette(state, fallback = ['#FF0000']) {
    const colors = Array.isArray(state.colors) && state.colors.length ? state.colors : fallback;
    const size = Math.round(clamp(state.colorCount, 1, colors.length, colors.length));
    return colors.slice(0, size).map((color, index) => optical(
      Array.isArray(state.rgbEnabled) && state.rgbEnabled[index] === false ? '#000000' : color,
      Array.isArray(state.whiteEnabled) && state.whiteEnabled[index] === false ? 0 :
        Array.isArray(state.whiteChannels) ? state.whiteChannels[index] : 0));
  }
  // Zero is a deliberately slow 120-second cycle, never pause. Thirty is an
  // easily visible 12-second preview; the mapping is monotonic and continuous.
  function periodForSpeed(value) {
    const speed = clamp(value, 0, 100, 30);
    return speed <= 30 ? 120 * Math.pow(0.1, speed / 30) : 12 * Math.pow(1 / 15, (speed - 30) / 70);
  }
  function descriptor(id, name, category, description, defaults = {}, options = {}) {
    const entry = {
      id: 'v30-' + id, name, category, family: category === 'tunnel' ? 'Tunnel' : category === 'brand' ? 'Brand' : 'Kleurwissel',
      description, minimumReceivers: category === 'tunnel' ? 2 : 1,
      spatialResolution: 'receiver', paletteEditable: category !== 'brand', firmwareSupport: 'preview-only',
      backgroundEditable: category === 'tunnel',
      controls: category === 'whole' ? ['speed', 'smooth'] : ['speed', 'smooth', 'fadeAmount', 'delayMs'],
      directions: [], ...options,
      state: { v30Effect: 'v30-' + id, engine: 'V30', variant: 0, category,
        colors: ['#FF0000'], whiteChannels: [0], colorCount: 1,
        speed: 30, smooth: 100, fadeAmount: 90, delayMs: 300,
        direction: 'forward', width: 65, bri: 85, on: true, power: true, ...defaults }
    };
    entry.state.rgbEnabled = entry.state.colors.map(() => true);
    entry.state.whiteEnabled = entry.state.colors.map((_, i) => (entry.state.whiteChannels[i] || 0) > 0);
    if (entry.paletteEditable) entry.colorCountRange = entry.colorCountRange || { min: 1, max: Math.max(4, entry.state.colors.length) };
    return entry;
  }
  const DEFINITIONS = [
    descriptor('rgb-jumping', 'RGB Jumping', 'whole', 'Rood, groen en blauw wisselen helder en gelijktijdig op alle gekozen receivers.',
      { colors: RGB, whiteChannels: [0, 0, 0], colorCount: 3 }, { controls: ['speed'], paletteEditable: false }),
    descriptor('seven-jumping', '7 Colors Jumping', 'whole', 'Zeven vaste kleuren volgen elkaar zonder tussenkleuren op.',
      { colors: SEVEN, whiteChannels: SEVEN.map(() => 0), colorCount: 7 }, { controls: ['speed'], paletteEditable: false }),
    descriptor('rgb-gradient', 'RGB Gradient', 'whole', 'Een zachte, doorlopende overgang tussen rood, groen en blauw.',
      { colors: RGB, whiteChannels: [0, 0, 0], colorCount: 3 }),
    descriptor('seven-gradient', '7 Colors Gradient', 'whole', 'Alle zeven kleuren vloeien rustig in elkaar over; alle gekozen receivers lopen gelijk.',
      { colors: SEVEN, whiteChannels: SEVEN.map(() => 0), colorCount: 7 }),
    descriptor('tunnel-travel', 'Lichtgolf', 'tunnel', 'Een brede lichtgolf reist soepel van de eerste naar de laatste receiver.', {},
      { controls: ['speed', 'smooth', 'fadeAmount', 'delayMs', 'direction', 'width'], directions: ['forward', 'reverse'] }),
    descriptor('tunnel-bounce', 'Heen en terug', 'tunnel', 'De lichtgolf vertraagt bij de uiteinden en keert vloeiend terug.', {},
      { controls: ['speed', 'smooth', 'fadeAmount', 'delayMs', 'width'] }),
    descriptor('tunnel-center', 'Vanuit het midden', 'tunnel', 'De middelste receivers lichten eerst op; daarna opent het licht naar buiten.', {},
      { controls: ['speed', 'smooth', 'fadeAmount', 'delayMs', 'width'] }),
    descriptor('tunnel-outside', 'Naar het midden', 'tunnel', 'De buitenste receivers lichten eerst op en geven het licht naar binnen door.', {},
      { controls: ['speed', 'smooth', 'fadeAmount', 'delayMs', 'width'] }),
    descriptor('tunnel-cascade', 'Opbouwen en uitdoven', 'tunnel', 'Receivers bouwen één voor één licht op, houden het vast en doven in dezelfde volgorde.', {},
      { controls: ['speed', 'smooth', 'fadeAmount', 'delayMs', 'direction'], directions: ['forward', 'reverse'] }),
    descriptor('tunnel-handoff', 'Licht doorgeven', 'tunnel', 'Eén receiver geeft zijn helderheid aan de volgende door, zonder een abrupte sprong.', {},
      { controls: ['speed', 'smooth', 'fadeAmount', 'delayMs', 'direction'], directions: ['forward', 'reverse'] }),
    descriptor('tunnel-pulse', 'Reizende puls', 'tunnel', 'Een smalle, zachte puls trekt door de receivers; op SPI beweegt hij ook over de pixels.', {},
      { controls: ['speed', 'smooth', 'fadeAmount', 'delayMs', 'direction', 'width'], directions: ['forward', 'reverse'] }),
    descriptor('tunnel-echo', 'Licht met echo', 'tunnel', 'Een lichtpuls trekt vooruit, gevolgd door een zachtere, uitdovende echo.', {},
      { controls: ['speed', 'smooth', 'fadeAmount', 'delayMs', 'direction', 'width'], directions: ['forward', 'reverse'] }),
    descriptor('tunnel-pixel-curtain', 'Pixelgordijn', 'tunnel', 'Een brede pixelbaan bouwt elke lijn op en dooft achteraan uit; de volgende receiver begint later.', {},
      { receiverTypes: ['SPI'], spatialResolution: 'pixel', controls: ['speed', 'smooth', 'fadeAmount', 'delayMs', 'direction', 'width'], directions: ['forward', 'reverse'] }),
    descriptor('tunnel-pixel-cross', 'Kruisende pixelgolven', 'tunnel', 'Twee pixelgolven ontmoeten elkaar per lijn; die beweging reist daarna naar de volgende receiver.', {},
      { receiverTypes: ['SPI'], spatialResolution: 'pixel', controls: ['speed', 'smooth', 'fadeAmount', 'delayMs', 'direction', 'width'], directions: ['forward', 'reverse'] }),
    descriptor('brand-white-breathe', 'Wit ademen', 'brand', 'Neutraal wit ademt heel rustig; de verlichting gaat niet helemaal uit.',
      { colors: ['#000000'], whiteChannels: [255], speed: 22 }, { controls: ['speed', 'smooth', 'fadeAmount'] }),
    descriptor('brand-warm-white', 'Warm naar wit', 'brand', 'Een rustige overgang van een warme RGB + W-mix naar neutraal wit.',
      { colors: ['#C55B13', '#000000'], whiteChannels: [125, 255], colorCount: 2, speed: 20 },
      { controls: ['speed', 'smooth'] }),
    descriptor('brand-accent', 'Huisstijlaccent', 'brand', 'De eigen huisstijlkleur komt zacht terug in een heldere witte basis.',
      { colors: [DEFAULT_BRAND], brandColor: DEFAULT_BRAND, speed: 22 }, { controls: ['speed', 'smooth', 'fadeAmount', 'brandColor'] }),
    descriptor('brand-sweep', 'Zachte lichtgloed', 'brand', 'Een subtiele huisstijlgloed beweegt over een rustige witte basis.',
      { colors: [DEFAULT_BRAND], brandColor: DEFAULT_BRAND, speed: 23 }, { controls: ['speed', 'smooth', 'width', 'direction', 'brandColor'], directions: ['forward', 'reverse'] }),
    descriptor('brand-focus', 'Productfocus', 'brand', 'Een helder focuspunt trekt langzaam langs de receivers, met een zachte witte achtergrond.',
      { colors: [DEFAULT_BRAND], brandColor: DEFAULT_BRAND, speed: 20 }, { controls: ['speed', 'smooth', 'width'], paletteEditable: true, colorCountRange: { min: 1, max: 7 } }),
    descriptor('brand-soft-gradient', 'Huisstijlverloop', 'brand', 'Een subtiel verloop tussen de huisstijlkleur en wit, zonder drukke kleurwissels.',
      { colors: [DEFAULT_BRAND], brandColor: DEFAULT_BRAND, speed: 23 }, { controls: ['speed', 'smooth', 'direction', 'brandColor'], directions: ['forward', 'reverse'] })
  ];
  const BY_ID = new Map(DEFINITIONS.map(entry => [entry.id, entry]));
  function periodForEffect(state = {}) {
    // Brand is architectural ambient lighting, not a fast animation preset.
    // Adding a minimum duration preserves meaningful motion at every speed
    // slider value without a clipped/dead zone at the fast end.
    return periodForSpeed(state.speed) + (BY_ID.get(state.v30Effect)?.category === 'brand' ? 4 : 0);
  }
  function catalog(type) {
    if (type !== 'SPI' && type !== 'RGBW') throw new Error('Unknown receiver type: ' + type);
    return DEFINITIONS.filter(entry => !entry.receiverTypes || entry.receiverTypes.includes(type)).map(original => {
      const entry = clone(original);
      if (type === 'SPI' && ['v30-tunnel-pulse', 'v30-brand-sweep', 'v30-brand-soft-gradient'].includes(entry.id)) entry.spatialResolution = 'pixel';
      return entry;
    });
  }
  function timing(state, time) {
    const t = Math.max(0, finite(time, 0));
    const period = periodForEffect(state);
    const smooth = clamp(state.smooth, 0, 100, 100) / 100;
    const stepped = Math.floor(t / period * 40) / 40 * period;
    const renderedTime = stepped * (1 - smooth) + t * smooth;
    return { time: renderedTime, period, phase: mod(renderedTime / period, 1) };
  }
  function shaped(value, state) {
    const smoothness = clamp(state.smooth, 0, 100, 100) / 100;
    return value * (1 - smoothness) + ease(value) * smoothness;
  }
  function softPulse(distance, radius, state) {
    const x = clamp(1 - Math.abs(distance) / Math.max(0.01, radius), 0, 1);
    const smooth = shaped(x, state);
    const fade = clamp(state.fadeAmount, 0, 100, 90) / 100;
    // Fade changes the envelope, never adds a hard threshold at smooth=100.
    return Math.pow(smooth, 0.35 + fade * 1.65);
  }
  function wholeSample(id, state, clock) {
    const fixed = id.includes('seven') ? SEVEN : RGB;
    const colors = id.endsWith('jumping') ? fixed.map(color => rgb(color)) : palette(state, fixed);
    const step = clock.phase * colors.length;
    const index = Math.floor(step) % colors.length;
    return id.endsWith('jumping') ? colors[index] : mix(colors[index], colors[(index + 1) % colors.length], shaped(step - index, state));
  }
  function tunnelSample(id, state, clock, index, count, input) {
    const colors = palette(state);
    const reversed = state.direction === 'reverse' || state.direction === 'left';
    const rank = reversed ? count - 1 - index : index;
    // Delay is a MINIMUM physical handoff interval, not a phase modulo the
    // effect period. Large values cannot accidentally synchronize all lines.
    const delay = clamp(state.delayMs, 0, 10000, 300) / 1000;
    const step = Math.max(clock.period / (count + 2), delay, 0.01);
    const width = clamp(state.width, 0, 100, 65) / 100;
    const radius = 0.45 + width * 1.35;
    const cycle = step * (count + 2);
    let colorCycle = Math.floor(clock.time / cycle);
    let amount = 0;
    if (id === 'v30-tunnel-bounce') {
      const duration = Math.max(clock.period, (count - 1) * step * 2);
      const phase = mod(clock.time / duration, 1);
      const position = (1 - Math.cos(phase * Math.PI * 2)) / 2 * (count - 1);
      amount = softPulse(index - position, radius, state);
      colorCycle = Math.floor(clock.time / duration);
    } else if (id === 'v30-tunnel-center' || id === 'v30-tunnel-outside') {
      const center = (count - 1) / 2;
      const offset = count % 2 === 0 ? 0.5 : 0;
      const distance = Math.abs(index - center) - offset;
      const furthest = center - offset;
      const wave = mod(clock.time / step, furthest + 3) - 0.75;
      const ordered = id === 'v30-tunnel-center' ? distance : furthest - distance;
      amount = softPulse(ordered - wave, radius, state);
      colorCycle = Math.floor(clock.time / (step * (furthest + 3)));
    } else if (id === 'v30-tunnel-cascade') {
      const position = mod(clock.time / step, count * 2 + 2);
      const fade = 0.15 + clamp(state.fadeAmount, 0, 100, 90) / 100 * 0.85;
      const enter = shaped(clamp((position - rank) / fade, 0, 1), state);
      const leave = shaped(clamp((position - count - 1 - rank) / fade, 0, 1), state);
      amount = enter * (1 - leave);
      colorCycle = Math.floor(clock.time / (step * (count * 2 + 2)));
    } else if (id === 'v30-tunnel-handoff') {
      const position = mod(clock.time / step, count + 1) - 1;
      const fade = clamp(state.fadeAmount, 0, 100, 90) / 100;
      const current = Math.floor(position);
      const progress = shaped(clamp((position - current - (1 - fade)) / Math.max(0.1, fade), 0, 1), state);
      amount = rank === current ? 1 - progress : rank === current + 1 ? progress : 0;
      colorCycle = Math.floor(clock.time / (step * (count + 1)));
    } else if (id === 'v30-tunnel-pixel-curtain' || id === 'v30-tunnel-pixel-cross') {
      const position = mod(clock.time / step, count + 4) - 1;
      const fraction = (finite(input.pixelIndex, 0) + 0.5) / Math.max(1, input.pixelCount);
      const pixel = reversed ? 1 - fraction : fraction;
      const local = position - rank;
      if (id === 'v30-tunnel-pixel-curtain') {
        const edge = 0.12 + width * 0.8;
        const enter = shaped(clamp((local - pixel) / edge, 0, 1), state);
        const leave = shaped(clamp((local - 1 - pixel) / edge, 0, 1), state);
        amount = enter * (1 - leave);
      } else {
        const travel = local / 2;
        const gate = local <= 0 || local >= 2 ? 0 : Math.sin(local / 2 * Math.PI);
        amount = Math.max(softPulse(pixel - travel, 0.06 + width * 0.2, state),
          softPulse(pixel - (1 - travel), 0.06 + width * 0.2, state)) * gate;
      }
      colorCycle = Math.floor(clock.time / (step * (count + 4)));
    } else {
      const position = mod(clock.time / step, count + 2) - 1;
      if (id === 'v30-tunnel-echo') {
        amount = Math.max(softPulse(rank - position, radius * 0.7, state),
          softPulse(rank - position + 1.35, radius, state) * 0.42);
      } else if (id === 'v30-tunnel-pulse') {
        // RGBW remains a uniform line. SPI follows a real moving pixel pulse
        // inside each receiver; reversing an output is done in Preview geometry.
        const fraction = input.receiverType === 'SPI' ? (finite(input.pixelIndex, 0) + 0.5) / Math.max(1, input.pixelCount) - 0.5 : 0;
        amount = softPulse(rank + (reversed ? -fraction : fraction) - position, 0.25 + width * 0.8, state);
      } else amount = softPulse(rank - position, radius, state);
    }
    return { color: colors[mod(colorCycle, colors.length)], amount: clamp(amount, 0, 1) };
  }
  function brandSample(id, state, clock, index, count, input) {
    const white = [255, 255, 255];
    const warm = optical('#C55B13', 125);
    const brand = rgb(state.brandColor || (state.colors || [])[0] || DEFAULT_BRAND);
    const direction = state.direction === 'reverse' || state.direction === 'left' ? -1 : 1;
    const wave = (1 - Math.cos(clock.phase * Math.PI * 2)) / 2;
    const breathe = shaped(wave, state);
    const depth = clamp(state.fadeAmount, 0, 100, 90) / 100;
    const local = input.receiverType === 'SPI' ? (finite(input.pixelIndex, 0) + 0.5) / Math.max(1, input.pixelCount) : 0.5;
    const position = (index + local) / Math.max(1, count);
    if (id === 'v30-brand-white-breathe') return white.map(channel => channel * (1 - 0.36 * depth + breathe * 0.36 * depth));
    if (id === 'v30-brand-warm-white') return mix(warm, white, breathe);
    if (id === 'v30-brand-accent') return mix(white, brand, 0.08 + breathe * 0.45 * depth);
    if (id === 'v30-brand-focus') {
      const center = (1 - Math.cos(clock.phase * Math.PI * 2)) / 2;
      const width = 0.12 + clamp(state.width, 0, 100, 65) / 100 * 0.42;
      const focus = shaped(clamp(1 - Math.abs((index + 0.5) / count - center) / width, 0, 1), state);
      const colors = palette(state, [state.brandColor || DEFAULT_BRAND]);
      const palettePosition = center * Math.max(0, colors.length - 1);
      const first = Math.floor(palettePosition), fraction = shaped(palettePosition - first, state);
      const accent = mix(colors[first] || brand, colors[Math.min(first + 1, colors.length - 1)] || brand, fraction);
      return mix(accent, white, 0.65 + focus * 0.35).map(channel => channel * (0.52 + focus * 0.48));
    }
    if (id === 'v30-brand-sweep') {
      const distance = Math.abs(mod(position - direction * clock.phase + 0.5, 1) - 0.5);
      const width = 0.07 + clamp(state.width, 0, 100, 65) / 100 * 0.28;
      return mix(white, brand, shaped(clamp(1 - distance / width, 0, 1), state) * 0.42);
    }
    return mix(white, brand, 0.12 + 0.4 * shaped((1 + Math.sin((position * 0.6 - direction * clock.phase) * Math.PI * 2)) / 2, state));
  }
  function sample(input = {}) {
    // In a continuous SPI zone all physical outputs form one logical strip.
    // Receiver/port boundaries must not restart an extension effect.
    if(input.receiverType==='SPI'&&input.layout==='continuous')input={...input,
      receiverCount:1,receiverIndex:0,pixelCount:input.totalPixels,pixelIndex:input.globalPixel};
    const state = input.state || {};
    const entry = BY_ID.get(state.v30Effect);
    if (!entry) throw new Error('Unknown V30 preview effect: ' + state.v30Effect);
    if (state.on === false || state.power === false) return [0, 0, 0];
    const count = Math.max(1, Math.round(finite(input.receiverCount, 1)));
    const index = Math.round(clamp(input.receiverIndex, 0, count - 1));
    const clock = timing(state, input.time);
    const brightness = clamp(state.bri == null ? state.brightness : state.bri, 0, 100, 100) / 100;
    if (entry.category === 'tunnel') {
      const foreground = tunnelSample(entry.id, state, clock, index, count, input);
      const background = state.backgroundOn ? optical(
        state.backgroundRgbEnabled === false ? '#000000' : state.background,
        state.backgroundWhiteEnabled === false ? 0 : state.backgroundWhite)
        .map(channel => channel * clamp(state.bgBrightness, 0, 100, 10) / 100) : [0, 0, 0];
      return mix(background, foreground.color.map(channel => channel * brightness), foreground.amount)
        .map(channel => Math.round(clamp(channel, 0, 255)));
    }
    const channels = entry.category === 'whole' ? wholeSample(entry.id, state, clock)
      : brandSample(entry.id, state, clock, index, count, input);
    return channels.map(channel => Math.round(clamp(channel * brightness, 0, 255)));
  }
  return Object.freeze({ version: '30-preview-1', catalog, sample, periodForSpeed, periodForEffect, optical,
    isLocalPreview: true, supportsFirmware: false });
}));
