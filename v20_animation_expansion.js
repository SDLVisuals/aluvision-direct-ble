/* Aluvision V20.5 animation expansion.
   Wire variants are append-only: existing scene and preset numbers remain valid. */
(() => {
  'use strict';

  const runtime = window.AluvisionAnimationRuntime;
  if (!runtime) throw new Error('Aluvision animation runtime is unavailable');
  const {
    effects, multiLineEffects, rgbwEffects, tunnelSupplementalEffects,
    v18163RgbwDemoPalettes, v18163RgbwDemoCache, v18163SpiDemoCache,
    effectWireVariant, animationCyclesPerSecond, enabledRgbwPreview, rgbHex,
    visibleStateColor, lerp, wrap, thicknessAmount, v1817LineOrder,
    v1817ClampLineDelay, v1817Palette, v1817PaletteAt, v1817PaletteBand
  } = runtime;
  const isRgbwGroup = (...args) => runtime.isRgbwGroup(...args);
  const rgbwEffect = (...args) => runtime.rgbwEffect(...args);
  const academyLanguage = (...args) => runtime.academyLanguage(...args);
  let isMultiLineEffect = runtime.isMultiLineEffect;
  let isMultiLineState = runtime.isMultiLineState;
  let usesSharedParallelTimeline = runtime.usesSharedParallelTimeline;
  let effectColorCount = runtime.effectColorCount;
  let effectCapabilities = runtime.effectCapabilities;
  let v1817UsesLineDelay = runtime.v1817UsesLineDelay;
  let animationPixel = runtime.animationPixel;
  let rgbwPreviewSample = runtime.rgbwPreviewSample;
  let effectDescription = runtime.effectDescription;

  const SPI_TUNNEL = [
    ['Tunnel Halo', 'BREATHE', 'Multi-line', 104, { speed: 12, smooth: 98, lineDelayMs: 260, direction: 'right' }],
    ['Depth Scanner', 'SCANNER', 'Multi-line', 105, { speed: 16, smooth: 95, lineDelayMs: 180, direction: 'right' }],
    ['Double Tunnel Wave', 'WAVE', 'Multi-line', 106, { speed: 14, smooth: 97, lineDelayMs: 150, direction: 'right' }],
    ['Colour Relay', 'GRADIENT', 'Multi-line', 107, { speed: 11, smooth: 99, lineDelayMs: 300, direction: 'right' }],
    ['Tunnel Echo', 'CASCADE', 'Multi-line', 108, { speed: 16, smooth: 94, spacing: 62, lineDelayMs: 220, direction: 'right' }],
    ['Curtain Sweep', 'CHASE', 'Multi-line', 109, { speed: 15, widthPixels: 4, smooth: 96, lineDelayMs: 180, direction: 'right' }],
    ['Cross Tunnel', 'MIRROR', 'Multi-line', 110, { speed: 14, widthPixels: 3, smooth: 96, lineDelayMs: 180, direction: 'right', mirror: true }],
    ['Tunnel Comet', 'COMET', 'Multi-line', 111, { speed: 18, widthPixels: 3, smooth: 95, trailLength: 72, lineDelayMs: 200, direction: 'right' }]
  ];

  // A neutral/cool physical W emitter needs a restrained RGB correction to
  // reach the video's warm-white look. It remains one colour slot: no orange
  // second band or tail. Ordinary white elsewhere in the app remains W-only.
  const WARM_CONTOUR_DEFAULTS = {
    speed: 45,
    widthPixels: 4,
    smooth: 100,
    trailLength: 36,
    direction: 'right',
    objectCount: 1,
    spacing: 100,
    bounce: false,
    mirror: false,
    backgroundOn: false,
    colorCount: 1,
    colors: ['#5a1e00'],
    whiteChannels: [255],
    rgbEnabled: [true],
    whiteEnabled: [true],
    whiteOnly: false
  };

  const SPI_DETAIL = [
    ['Prism Runner', 'CHASE', 'Dynamic', 112, { speed: 28, widthPixels: 3, smooth: 94, objectCount: 2, spacing: 62 }],
    ['Velvet Comet', 'COMET', 'Dynamic', 113, { speed: 20, widthPixels: 3, smooth: 98, trailLength: 82 }],
    ['Orbit Scanner', 'SCANNER', 'Professional', 114, { speed: 18, widthPixels: 4, smooth: 97, mirror: true }],
    ['Crystal Sparkle', 'SPARKLE', 'Ambient', 115, { speed: 24, widthPixels: 1, smooth: 34, randomness: 36 }],
    ['Breathing Gradient', 'BREATHE', 'Gradient', 116, { speed: 12, smooth: 99, spread: 70 }],
    ['Liquid Wave', 'WAVE', 'Flow', 117, { speed: 17, widthPixels: 5, smooth: 98, objectCount: 2, spread: 72 }],
    ['Mirror Pulse', 'MIRROR', 'Pulse', 118, { speed: 15, widthPixels: 4, smooth: 97, mirror: true }],
    ['Confetti Flow', 'FLOW', 'Ambient', 119, { speed: 22, widthPixels: 2, smooth: 88, objectCount: 4, spacing: 58 }],
    ['Warm Contour Flow', 'COMET', 'Professional', 120, { ...WARM_CONTOUR_DEFAULTS }]
  ];

  const RGBW_EXPANSION = [
    { name: 'Gentle Glow', engine: 'BREATHE', variant: 17, colors: 1, icon: '◌', settings: ['speed', 'smooth', 'colors'], defaults: { speed: 9, smooth: 98 }, description: { nl: 'Een zachte, rustige gloed over de volledige LED Line', en: 'A calm, soft glow across the complete LED Line', fr: 'Une lueur douce sur toute la LED Line', de: 'Ein sanftes Leuchten über die ganze LED Line' } },
    { name: 'Double Pulse', engine: 'BREATHE', variant: 18, colors: 2, variable: true, icon: '≋', settings: ['speed', 'smooth', 'colors'], defaults: { speed: 15, smooth: 94 }, description: { nl: 'Twee vloeiende pulsen volgen elkaar over de hele lijn', en: 'Two smooth pulses follow each other across the whole line', fr: 'Deux pulsations fluides se suivent sur toute la ligne', de: 'Zwei weiche Pulse folgen über die ganze Linie' } },
    { name: 'Colour Hold Fade', engine: 'GRADIENT', variant: 19, colors: 3, variable: true, icon: '◐', settings: ['speed', 'smooth', 'hold', 'colors'], defaults: { speed: 10, smooth: 98, spacing: 58 }, description: { nl: 'Iedere kleur blijft even staan en vloeit dan zacht verder', en: 'Each colour holds briefly, then blends gently onward', fr: 'Chaque couleur reste puis se fond doucement', de: 'Jede Farbe hält kurz und blendet dann weich weiter' } },
    { name: 'Theatre Double Flash', engine: 'SPARKLE', variant: 20, colors: 2, variable: true, icon: '✶', settings: ['speed', 'smooth', 'hold', 'colors'], defaults: { speed: 24, smooth: 18, spacing: 64 }, description: { nl: 'Twee korte volledige flitsen met een rustige pauze', en: 'Two short full-line flashes followed by a calm pause', fr: 'Deux éclairs complets suivis d’une pause', de: 'Zwei kurze Vollblitze mit ruhiger Pause' } },
    { name: 'Tunnel Glow Relay', engine: 'BREATHE', variant: 21, colors: 2, variable: true, line: true, icon: '≿', settings: ['speed', 'smooth', 'lineDelayMs', 'direction', 'colors'], defaults: { speed: 12, smooth: 98, lineDelayMs: 260, direction: 'right' }, description: { nl: 'Een zachte gloed reist volledige lijn na volledige lijn', en: 'A soft glow travels from one complete line to the next', fr: 'Une lueur douce voyage de ligne en ligne', de: 'Ein sanftes Leuchten reist von Linie zu Linie' } },
    { name: 'Tunnel Echo Fade', engine: 'CASCADE', variant: 22, colors: 2, variable: true, line: true, icon: '◔', settings: ['speed', 'smooth', 'hold', 'lineDelayMs', 'direction', 'colors'], defaults: { speed: 15, smooth: 96, spacing: 58, lineDelayMs: 220, direction: 'right' }, description: { nl: 'Elke lijn laat een zachte, uitdovende echo achter', en: 'Every line leaves a soft fading echo behind', fr: 'Chaque ligne laisse un écho qui s’estompe', de: 'Jede Linie hinterlässt ein weich ausklingendes Echo' } },
    { name: 'Tunnel Colour Relay', engine: 'GRADIENT', variant: 23, colors: 4, variable: true, line: true, icon: '◉', settings: ['speed', 'smooth', 'lineDelayMs', 'direction', 'colors'], defaults: { speed: 11, smooth: 99, lineDelayMs: 300, direction: 'right' }, description: { nl: 'Kleuren worden vloeiend van lijn naar lijn doorgegeven', en: 'Colours are handed smoothly from line to line', fr: 'Les couleurs passent doucement de ligne en ligne', de: 'Farben werden weich von Linie zu Linie weitergegeben' } },
    { name: 'Tunnel Twin Wave', engine: 'WAVE', variant: 24, colors: 3, variable: true, line: true, icon: '≈', settings: ['speed', 'smooth', 'lineDelayMs', 'direction', 'colors'], defaults: { speed: 16, smooth: 97, lineDelayMs: 150, direction: 'right' }, description: { nl: 'Twee lichtgolven kruisen elkaar door de opstelling', en: 'Two light waves cross through the installation', fr: 'Deux vagues lumineuses se croisent dans l’installation', de: 'Zwei Lichtwellen kreuzen sich durch die Installation' } }
  ];

  const addSpi = (effect) => {
    const variant = Number(effect[3]);
    if (!effects.some((item) => effectWireVariant(item) === variant)) effects.push(effect);
  };
  const addRgbw = (effect) => {
    if (!rgbwEffects.some((item) => Number(item.variant) === Number(effect.variant))) rgbwEffects.push(effect);
  };
  SPI_TUNNEL.forEach((effect) => {
    addSpi(effect);
    if (!multiLineEffects.some((item) => effectWireVariant(item) === effectWireVariant(effect))) multiLineEffects.push(effect);
  });
  SPI_DETAIL.forEach(addSpi);
  RGBW_EXPANSION.forEach(addRgbw);
  if (Array.isArray(tunnelSupplementalEffects)) {
    SPI_TUNNEL.forEach((effect) => {
      if (!tunnelSupplementalEffects.some((item) => effectWireVariant(item) === effectWireVariant(effect))) tunnelSupplementalEffects.push(effect);
    });
  }

  Object.assign(v18163RgbwDemoPalettes, {
    'Gentle Glow': [['#ffb56b'], [46]],
    'Double Pulse': [['#7c5cff', '#22d3ee'], [0, 0]],
    'Colour Hold Fade': [['#ff6557', '#ffc94f', '#35d6ad'], [0, 0, 0]],
    'Theatre Double Flash': [['#ffffff', '#ff6557'], [0, 0]],
    'Tunnel Glow Relay': [['#7c5cff', '#22d3ee'], [0, 0]],
    'Tunnel Echo Fade': [['#ff6557', '#ffc94f'], [0, 0]],
    'Tunnel Colour Relay': [['#ff6557', '#ffc94f', '#35d6ad', '#328cff'], [0, 0, 0, 0]],
    'Tunnel Twin Wave': [['#7c5cff', '#22d3ee', '#ff6557'], [0, 0, 0]]
  });
  if (typeof v18163RgbwDemoCache !== 'undefined' && typeof v18163RgbwDemoCache.clear === 'function') v18163RgbwDemoCache.clear();
  if (typeof v18163SpiDemoCache !== 'undefined' && typeof v18163SpiDemoCache.clear === 'function') {
    v18163SpiDemoCache.clear();
    // Catalogue previews normally use a colourful demonstration palette. This
    // measured effect instead uses its single calibrated W+RGB warm-white slot,
    // never a blue/grey substitute or a separately coloured amber band.
    v18163SpiDemoCache.set('Warm Contour Flow|120', {
      ...WARM_CONTOUR_DEFAULTS,
      colors: [...WARM_CONTOUR_DEFAULTS.colors],
      whiteChannels: [...WARM_CONTOUR_DEFAULTS.whiteChannels],
      rgbEnabled: [...WARM_CONTOUR_DEFAULTS.rgbEnabled],
      whiteEnabled: [...WARM_CONTOUR_DEFAULTS.whiteEnabled],
      animation: 'Warm Contour Flow',
      engine: 'COMET',
      variant: 120,
      background: '#000000',
      backgroundWhite: 0,
      backgroundRgbEnabled: false,
      backgroundWhiteEnabled: false,
      bgBrightness: 0,
      brightness: 100,
      previewStartedAt: 0,
      phaseMs: 0,
      groupPixels: 28,
      catalogueDemo: true
    });
  }

  const oldIsMultiLineEffect = isMultiLineEffect;
  isMultiLineEffect = function v204IsMultiLineEffect(effect) {
    const variant = effectWireVariant(effect);
    return oldIsMultiLineEffect(effect) || Boolean(window.AluvisionTunnelEngine?.kind('SPI', variant));
  };
  runtime.isMultiLineEffect = isMultiLineEffect;
  const oldIsMultiLineState = isMultiLineState;
  isMultiLineState = function v204IsMultiLineState(current) {
    const variant = Number(current?.variant);
    return oldIsMultiLineState(current) || Boolean(window.AluvisionTunnelEngine?.kind('SPI', variant));
  };
  runtime.isMultiLineState = isMultiLineState;
  const oldSharedTimeline = usesSharedParallelTimeline;
  usesSharedParallelTimeline = function v204UsesSharedParallelTimeline(currentGroup, currentState = currentGroup?.state) {
    if (oldSharedTimeline(currentGroup, currentState)) return true;
    if (!currentGroup || currentGroup.layout !== 'parallel' || (currentGroup.receivers?.length || 0) < 2) return false;
    const type = (typeof groupReceiverType === 'function' ? groupReceiverType(currentGroup) : currentState?.receiverType) || 'SPI';
    const variant = Number(currentState?.variant);
    return Boolean(window.AluvisionTunnelEngine?.kind(String(type).toUpperCase(), variant));
  };
  runtime.usesSharedParallelTimeline = usesSharedParallelTimeline;

  const spiColourCounts = new Map([
    [104, 2], [105, 2], [106, 3], [107, 4], [108, 2], [109, 2], [110, 2], [111, 2],
    [112, 3], [113, 2], [114, 2], [115, 3], [116, 3], [117, 4], [118, 2], [119, 4],
    [120, 1]
  ]);
  const oldEffectColorCount = effectColorCount;
  effectColorCount = window.effectColorCount = function v204EffectColorCount(effect) {
    const count = spiColourCounts.get(effectWireVariant(effect));
    return count || oldEffectColorCount(effect);
  };
  runtime.effectColorCount = effectColorCount;

  const oldEffectCapabilities = effectCapabilities;
  effectCapabilities = window.effectCapabilities = function v204EffectCapabilities(effect) {
    const variant = effectWireVariant(effect);
    const base = { ...oldEffectCapabilities(effect) };
    if (variant >= 104 && variant <= 111) {
      return {
        ...base,
        speed: true,
        width: variant >= 109,
        smooth: true,
        background: true,
        direction: true,
        spacing: variant === 108,
        count: false,
        objects: false,
        trail: variant === 111,
        spread: false,
        randomness: false,
        bounce: false,
        mirror: variant === 110
      };
    }
    if (variant === 120) {
      return {
        ...base,
        speed: true,
        width: true,
        smooth: true,
        background: true,
        direction: true,
        spacing: false,
        count: false,
        objects: false,
        trail: true,
        spread: false,
        randomness: false,
        bounce: false,
        mirror: false
      };
    }
    return base;
  };
  runtime.effectCapabilities = effectCapabilities;

  const oldUsesLineDelay = v1817UsesLineDelay;
  v1817UsesLineDelay = function v204UsesLineDelay(effect = null, item = null) {
    if (oldUsesLineDelay(effect, item)) return true;
    const currentGroup = runtime.group;
    if (!currentGroup || currentGroup.layout !== 'parallel' || (currentGroup.receivers?.length || 0) < 2) return false;
    if (isRgbwGroup()) {
      const variant = Number(item?.variant ?? rgbwEffect()?.variant);
      return Boolean(window.AluvisionTunnelEngine?.kind('RGBW', variant));
    }
    const variant = effectWireVariant(effect || effects.find((value) => value[0] === currentGroup.state?.animation));
    return Boolean(window.AluvisionTunnelEngine?.kind('SPI', variant));
  };
  runtime.v1817UsesLineDelay = v1817UsesLineDelay;

  const mod1 = (value) => ((value % 1) + 1) % 1;
  const ease = (value) => {
    const n = Math.max(0, Math.min(1, value));
    return n * n * (3 - 2 * n);
  };
  const smoother = (value) => {
    const n = Math.max(0, Math.min(1, value));
    return n * n * n * (n * (n * 6 - 15) + 10);
  };
  const timeline = (current, time, variant, lineIndex, lineCount) => {
    const speed = Math.max(0, Math.min(100, Number(current.speed) || 0));
    const started = Number(current.previewStartedAt);
    const elapsed = Number.isFinite(started) && started >= 0 && started <= time ? time - started : 0;
    const cycles = animationCyclesPerSecond(speed);
    const order = v1817LineOrder(current, lineIndex, lineCount, variant);
    const delay = v1817ClampLineDelay(current.lineDelayMs, 240) / 1000;
    return mod1(elapsed * cycles + (Number(current.phaseMs) || 0) / 1000 - order * delay * cycles);
  };
  const spiOutput = (current, foreground, amount) => {
    const background = current.backgroundOn === false ? [0, 0, 0] : enabledRgbwPreview(current, 0, true).map((channel) => Math.round(channel * (Number(current.bgBrightness ?? 10) / 100)));
    const mixed = lerp(background, foreground, Math.max(0, Math.min(1, amount)));
    const brightness = Math.max(0, Math.min(1, Number(current.brightness ?? 100) / 100));
    return mixed.map((channel) => Math.round(channel * brightness));
  };
  const architecturalRibbonPixel = (current, u, time, pixelCount) => {
    const parsedPixels = Number(pixelCount);
    const parsedGroupPixels = Number(current.groupPixels);
    const n = Math.max(1, Number.isFinite(parsedPixels) && parsedPixels !== 0
      ? parsedPixels
      : (Number.isFinite(parsedGroupPixels) && parsedGroupPixels !== 0 ? parsedGroupPixels : 60));
    const parsedSpeed = Number(current.speed);
    const speed = Math.max(0, Math.min(100, Number.isFinite(parsedSpeed) ? parsedSpeed : 0));
    const parsedTime = Number(time);
    const now = Number.isFinite(parsedTime) ? parsedTime : 0;
    const started = Number(current.previewStartedAt);
    const elapsed = Number.isFinite(started) && started >= 0 && started <= now ? now - started : 0;
    const parsedPhaseMs = Number(current.phaseMs);
    const phaseOffset = Number.isFinite(parsedPhaseMs) ? parsedPhaseMs / 1000 : 0;
    const phase = mod1(elapsed * animationCyclesPerSecond(speed) + phaseOffset);
    const parsedWidth = Number(current.widthPixels);
    const width = Math.max(1, Math.min(n, Number.isFinite(parsedWidth) ? (parsedWidth || 4) : 4));
    const parsedTrail = Number(current.trailLength ?? 36);
    const trail = Math.max(0, Math.min(100, Number.isFinite(parsedTrail) ? parsedTrail : 36));
    const ribbonPixels = Math.max(width, Math.min(Math.max(1, n - .5), n * trail / 100));
    const parsedBrightness = Number(current.brightness ?? 100);
    const parsedBackgroundBrightness = Number(current.bgBrightness ?? 10);
    const outputState = Number.isFinite(parsedBrightness) && Number.isFinite(parsedBackgroundBrightness)
      ? current
      : {
          ...current,
          brightness: Number.isFinite(parsedBrightness) ? parsedBrightness : 100,
          bgBrightness: Number.isFinite(parsedBackgroundBrightness) ? parsedBackgroundBrightness : 10
        };
    const palette = v1817Palette(current, 1);
    const calibratedWarm = current.rgbEnabled?.[0] !== false && current.whiteEnabled?.[0] !== false &&
      String(current.colors?.[0] || '').toLowerCase() === '#5a1e00' && Number(current.whiteChannels?.[0]) === 255;
    // Screen-only optical model for the warm emitter and its factory RGB
    // correction. Pure W and customer-adjusted RGB+W use the normal optical
    // preview, so switching the RGB correction off is visible immediately.
    const ribbonColor = calibratedWarm
      ? [255, 180, 105]
      : palette[0];
    // The clip has a short soft head, a broad bright plateau and a longer dim
    // tail. Their measured proportions are about 10/62/28 and match the
    // receiver renderer at every width setting.
    const oriented = current.direction === 'left' ? 1 - u : u;
    const behind = mod1(phase - oriented) * n;
    if (behind >= ribbonPixels) return spiOutput(outputState, ribbonColor, 0);
    const headFadePixels = Math.max(.65, ribbonPixels * .10);
    const tailFadePixels = Math.max(.85, ribbonPixels * .28);
    const leading = smoother(behind / headFadePixels);
    const trailing = smoother((ribbonPixels - behind) / tailFadePixels);
    const amount = leading * trailing;
    return spiOutput(outputState, ribbonColor, amount);
  };
  const spiTunnelPixel = (current, u, time, pixelCount) => {
    const variant = Number(current.variant);
    const n = Math.max(1, Number(pixelCount) || Number(current.groupPixels) || 60);
    const lines = Math.max(1, Number(current.lineCount) || 1);
    const line = Math.max(0, Math.min(lines - 1, Number(current.lineIndex) || 0));
    const phase = timeline(current, time, variant, line, lines);
    const local = current.direction === 'left' ? 1 - u : u;
    const palette = v1817Palette(current, spiColourCounts.get(variant) || 2);
    const smooth = Math.max(0, Math.min(1, Number(current.smooth ?? 95) / 100));
    const width = Math.max(1, Math.min(n, Number(current.widthPixels) || 3));
    let amount = 1;
    let color = v1817PaletteAt(palette, phase, true);

    if (variant === 104) {
      amount = .06 + .94 * ease(.5 - .5 * Math.cos(phase * Math.PI * 2));
    } else if (variant === 105) {
      const distance = Math.min(phase, 1 - phase);
      amount = ease(Math.max(0, 1 - distance / (.06 + .28 * smooth)));
      color = v1817PaletteBand(palette, line / lines + phase);
    } else if (variant === 106) {
      amount = .07 + .93 * Math.pow(.5 + .5 * Math.cos(phase * Math.PI * 4), .65 + .7 * (1 - smooth));
    } else if (variant === 107) {
      color = v1817PaletteAt(palette, phase, true);
      amount = 1;
    } else if (variant === 108) {
      const primary = Math.max(0, 1 - Math.min(phase, 1 - phase) / (.08 + .20 * smooth));
      const echoPhase = mod1(phase - (.17 + .25 * (Number(current.spacing ?? 62) / 100)));
      const echo = Math.max(0, 1 - Math.min(echoPhase, 1 - echoPhase) / (.10 + .18 * smooth));
      amount = Math.max(ease(primary), ease(echo) * .48);
    } else if (variant === 109) {
      const edge = .025 + .12 * smooth;
      const progress = ease(phase);
      amount = 1 - ease((local - progress + edge) / Math.max(.001, edge * 2));
      color = v1817PaletteAt(palette, local * .45 + phase, true);
    } else if (variant === 110) {
      const head = .5 - .5 * Math.cos(phase * Math.PI * 2);
      amount = Math.max(thicknessAmount(Math.abs(local - head), width, n, current.smooth), thicknessAmount(Math.abs(local - (1 - head)), width, n, current.smooth));
      color = v1817PaletteAt(palette, local + phase, true);
    } else if (variant === 111) {
      const head = phase;
      const behind = mod1(head - local) * n;
      const headAmount = thicknessAmount(wrap(local, head), width, n, current.smooth);
      const trailPixels = Math.max(width, n * Math.max(.04, Number(current.trailLength ?? 72) / 100));
      amount = Math.max(headAmount, Math.max(0, 1 - behind / trailPixels) * .88);
      color = v1817PaletteAt(palette, behind / Math.max(1, trailPixels), true);
    }
    return spiOutput(current, color, amount);
  };

  const oldAnimationPixel = animationPixel;
  animationPixel = function v204AnimationPixel(current, u, time, index = 0, pixelCount = 0) {
    const variant = Number(current?.variant);
    if (variant === 120) return architecturalRibbonPixel(current, u, time, pixelCount);
    if (variant >= 104 && variant <= 111) return spiTunnelPixel(current, u, time, pixelCount);
    return oldAnimationPixel(current, u, time, index, pixelCount);
  };
  runtime.animationPixel = animationPixel;

  const rgbwPalette = (current, item) => Array.from({ length: Math.max(1, Math.min(4, Number(current.colorCount) || item.colors || 1)) }, (_, slot) => rgbHex(visibleStateColor(current, slot)));
  const oldRgbwPreviewSample = rgbwPreviewSample;
  rgbwPreviewSample = function v204RgbwPreviewSample(current, lineIndex, lineCount, time) {
    const item = rgbwEffect(current?.animation);
    const variant = Number(item?.variant);
    if (variant < 17 || variant > 24) return oldRgbwPreviewSample(current, lineIndex, lineCount, time);
    const lines = Math.max(1, Number(lineCount) || 1);
    const line = Math.max(0, Math.min(lines - 1, Number(lineIndex) || 0));
    const speed = Math.max(0, Math.min(100, Number(current.speed) || 0));
    const started = Number(current.previewStartedAt);
    const elapsed = Number.isFinite(started) && started >= 0 && started <= time ? time - started : 0;
    const cycle = speed === 0 ? 0 : (item.engine === 'SPARKLE' ? .50 + Math.pow(speed / 100, 2) * 11.50 : .003 + Math.pow(speed / 100, 2) * 1.50);
    const order = item.line ? v1817LineOrder(current, line, lines, variant) : 0;
    const delay = v1817ClampLineDelay(current.lineDelayMs, item.defaults?.lineDelayMs ?? 240) / 1000;
    const phase = mod1(elapsed * cycle + (Number(current.phaseMs) || 0) / 1000 - order * delay * cycle);
    const palette = rgbwPalette(current, item);
    const smooth = Math.max(0, Math.min(1, Number(current.smooth ?? 95) / 100));
    const hold = Math.max(0, Math.min(1, Number(current.spacing ?? 50) / 100));
    let amount = 1;
    let color = v1817PaletteAt(palette, phase, true);

    if (variant === 17) {
      amount = .12 + .88 * ease(.5 - .5 * Math.cos(phase * Math.PI * 2));
      color = palette[0];
    } else if (variant === 18) {
      const pulse = Math.pow(Math.max(0, Math.sin(phase * Math.PI * 2)), 1.2 + 1.8 * (1 - smooth));
      const second = Math.pow(Math.max(0, Math.sin(mod1(phase - .22) * Math.PI * 2)), 1.6 + 1.8 * (1 - smooth));
      amount = .05 + .95 * Math.max(pulse, second * .78);
      color = v1817PaletteBand(palette, phase < .5 ? 0 : .75);
    } else if (variant === 19) {
      const scaled = phase * palette.length;
      const slotPhase = scaled - Math.floor(scaled);
      const transition = Math.max(.06, .48 * (1 - hold));
      const mix = ease(Math.max(0, Math.min(1, (slotPhase - (1 - transition)) / transition)));
      const slot = Math.floor(scaled) % palette.length;
      color = lerp(palette[slot], palette[(slot + 1) % palette.length], mix);
    } else if (variant === 20) {
      const flashWidth = .025 + .10 * smooth;
      amount = (phase < flashWidth || (phase > .16 && phase < .16 + flashWidth)) ? 1 : .02;
      color = v1817PaletteBand(palette, phase < .16 ? 0 : .55);
    } else if (variant === 21) {
      amount = .06 + .94 * ease(.5 - .5 * Math.cos(phase * Math.PI * 2));
      color = v1817PaletteAt(palette, phase, true);
    } else if (variant === 22) {
      const head = Math.max(0, 1 - Math.min(phase, 1 - phase) / (.08 + .22 * smooth));
      const echo = Math.max(0, 1 - Math.min(mod1(phase - .28), 1 - mod1(phase - .28)) / (.12 + .18 * smooth));
      amount = Math.max(ease(head), ease(echo) * (.25 + .45 * hold));
    } else if (variant === 23) {
      color = v1817PaletteAt(palette, phase, true);
      amount = 1;
    } else if (variant === 24) {
      amount = .06 + .94 * Math.pow(.5 + .5 * Math.cos(phase * Math.PI * 4), .70 + .55 * (1 - smooth));
      color = v1817PaletteAt(palette, phase * 1.5, true);
    }
    return { color, amount: Math.max(0, Math.min(1, amount)) * Math.max(0, Math.min(1, Number(current.brightness ?? 100) / 100)) };
  };
  runtime.rgbwPreviewSample = rgbwPreviewSample;

  const descriptions = {
    104: { nl: 'Een zachte halo reist lijn voor lijn door de tunnel', en: 'A soft halo travels line by line through the tunnel' },
    105: { nl: 'Een smalle lichtlaag scant door de diepte', en: 'A narrow layer of light scans through the depth' },
    106: { nl: 'Twee golven volgen elkaar door alle rijen', en: 'Two waves follow each other through every row' },
    107: { nl: 'Iedere rij geeft zijn kleur vloeiend door', en: 'Each row smoothly hands its colour onward' },
    108: { nl: 'Een hoofdpuls laat per rij een zachte echo achter', en: 'A main pulse leaves a soft echo on each row' },
    109: { nl: 'Een gordijn van licht opent rij na rij', en: 'A curtain of light opens row by row' },
    110: { nl: 'Twee lichtpunten kruisen symmetrisch door iedere rij', en: 'Two light points cross symmetrically through each row' },
    111: { nl: 'Een komeet met staart loopt vertraagd door iedere rij', en: 'A tailed comet runs through each row with a delay' },
    120: {
      nl: 'Een lange warm-witte lichtband vloeit met zachte randen door de volledige LED Line',
      en: 'A long warm-white ribbon with soft edges flows across the complete LED Line',
      fr: 'Un long ruban blanc chaud aux bords doux parcourt toute la LED Line',
      de: 'Ein langes warmweißes Lichtband mit weichen Kanten fließt über die ganze LED Line'
    }
  };
  const oldEffectDescription = effectDescription;
  effectDescription = window.effectDescription = function v204EffectDescription(effect) {
    const copy = descriptions[effectWireVariant(effect)];
    if (!copy) return oldEffectDescription(effect);
    const language = typeof academyLanguage === 'function' ? academyLanguage() : 'nl';
    return copy[language] || copy.en || copy.nl;
  };
  runtime.effectDescription = effectDescription;
  // Effect cards use this named renderer directly; keep their copy in sync with
  // the extended catalogue instead of falling back to a generic description.
  runtime.v1811EffectDescription = effectDescription;

  // Explain the factory calibration without hiding the normal Pastel / mix
  // control. As soon as the customer changes the colour, the annotation and
  // special label disappear and the explicit RGB+W mix remains untouched.
  const oldGroupUi = window.groupUI;
  if (typeof oldGroupUi === 'function') {
    window.groupUI = groupUI = function v2053WarmContourGroupUi(...args) {
      let markup = oldGroupUi.apply(this, args);
      const current = group?.state;
      const factoryWarm = Number(current?.variant) === 120 && Number(current?.colorCount) === 1 &&
        String(current?.colors?.[0] || '').toLowerCase() === '#5a1e00' && Number(current?.whiteChannels?.[0]) === 255 &&
        current?.rgbEnabled?.[0] !== false && current?.whiteEnabled?.[0] !== false;
      if (!factoryWarm || typeof markup !== 'string') return markup;
      const language = typeof academyLanguage === 'function' ? academyLanguage() : 'nl';
      const warmCopy = {
        nl: {
          label: 'Warm wit',
          title: 'Warm-wit kalibratie',
          detail: 'Het witte kanaal krijgt een zachte RGB-correctie voor warm licht. Je kunt deze mix nog steeds zelf aanpassen.'
        },
        en: {
          label: 'Warm white',
          title: 'Warm-white calibration',
          detail: 'The white channel receives a subtle RGB correction for warm light. You can still adjust this mix yourself.'
        },
        fr: {
          label: 'Blanc chaud',
          title: 'Calibrage blanc chaud',
          detail: 'Le canal blanc reçoit une légère correction RVB pour une lumière chaude. Ce mélange reste modifiable.'
        },
        de: {
          label: 'Warmweiß',
          title: 'Warmweiß-Kalibrierung',
          detail: 'Der Weißkanal erhält eine dezente RGB-Korrektur für warmes Licht. Diese Mischung bleibt frei einstellbar.'
        }
      }[language] || null;
      const copy = warmCopy || {
        label: 'Warm white',
        title: 'Warm-white calibration',
        detail: 'The white channel receives a subtle RGB correction for warm light. You can still adjust this mix yourself.'
      };
      markup = markup.replace(
        /id="effectColorModeState">[^<]*<\/b>/,
        `id="effectColorModeState">${copy.label}</b>`
      );
      return markup.replace(
        '<div class="rgbw-power-controls" data-rgbw-power="effectColor">',
        `<div class="rgbw-power-controls" data-rgbw-power="effectColor"><div class="animation-setting-note warm-contour-calibration-note"><b>${copy.title}</b><br><small>${copy.detail}</small></div>`
      );
    };
  }

  // The normal effect chooser preserves a customer's background between
  // animations. This video-matched ribbon is deliberately drawn on black, so
  // selecting it must reset the old background before that preservation step.
  const oldSetEffect = window.setEffect;
  if (typeof oldSetEffect === 'function') {
    window.setEffect = setEffect = function v2053WarmContourSetEffect(name) {
      const effect = effects.find((item) => item[0] === name);
      if (effect && Number(effectWireVariant(effect)) === 120 && group?.state) {
        Object.assign(group.state, {
          background: '#000000',
          backgroundWhite: 0,
          backgroundRgbEnabled: false,
          backgroundWhiteEnabled: false,
          backgroundOn: false,
          bgBrightness: 0
        });
      }
      return oldSetEffect.apply(this, arguments);
    };
  }

  window.AluvisionAnimationExpansion = Object.freeze({
    version: '20.5.3',
    spiTunnelVariants: SPI_TUNNEL.map((item) => item[3]),
    spiDetailVariants: SPI_DETAIL.map((item) => item[3]),
    rgbwVariants: RGBW_EXPANSION.map((item) => item.variant),
    spiVariantMax: 120,
    rgbwVariantMax: 24
  });
  document.documentElement.dataset.animationExpansion = '20.5.3';
  document.documentElement.dataset.spiAnimationCount = String(effects.length);
  document.documentElement.dataset.rgbwAnimationCount = String(rgbwEffects.length);
})();
