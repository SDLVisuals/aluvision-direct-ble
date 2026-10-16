/* Animation-editor visibility only. Existing catalogue recipes and saved
 * values remain authoritative; this module never changes or sends light.
 * The closed exceptions mirror the current SPI/RGBW receiver algorithms.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LightningAnimationControlPolicy = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const KEYS = new Set(['speed','smooth','widthPixels','objectCount','trailLength',
    'spacing','direction','lineDelayMs','spread','randomness','fadeAmount',
    'delayMs','width','brandColor','bounce','mirror']);
  const DIRECTIONS = new Set(['right','left','forward','reverse']);
  const GENERIC_POINT_SPACING = new Set(['CHASE','MINIMAL','COMET','FLOW','WAVE',
    'CASCADE','SEQUENCE']);
  const empty = Object.freeze([]);
  const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  function recipe(effect) {
    const state = effect?.state || {};
    return {engine:state.engine,variant:Number(state.variant),
      legacy:effect?.legacy === true && effect.source === 'v21-inline-catalog' &&
        state.legacySpi === true && !state.v30Effect && state.previewFamily !== 'RGBW'};
  }
  function points(effect, state) {
    return Math.max(1, Math.min(8, Math.round(finite(state?.objectCount,
      finite(effect?.state?.objectCount,1)))));
  }
  function lines(context) {
    // Continuous SPI is one logical strip. Do not mistake its physical
    // output count for a running multiline recipe in the zone editor.
    if (!context.stand && context.type === 'SPI' && context.layout === 'continuous') return 1;
    return Math.max(1, Math.floor(finite(context.lineCount,1)));
  }
  function values(effect) {
    if (!Array.isArray(effect?.directions)) return empty;
    return Object.freeze([...new Set(effect.directions.filter(value => DIRECTIONS.has(value)))]);
  }
  function controlsFor(effect, state = {}, context = {}) {
    if (!Array.isArray(effect?.controls)) return empty;
    const result = [...new Set(effect.controls.filter(key => KEYS.has(key)))];
    const spec = recipe(effect), count = points(effect,state), lineCount = lines(context);
    const remove = key => { const index = result.indexOf(key); if (index >= 0) result.splice(index,1); };
    if (lineCount < 2) remove('lineDelayMs');
    if (values(effect).length < 2) remove('direction');
    if (spec.legacy) {
      if (spec.variant >= 90 && spec.variant <= 97 && lineCount > 1) {
        // The multiline branches read point count only for Panel Wave (93),
        // and spacing only for Panel Chase (94). None reads the mirror flag.
        if (spec.variant !== 93) remove('objectCount');
        if (spec.variant !== 94) remove('spacing');
        remove('mirror');
      } else if (spec.variant < 98) {
        if (GENERIC_POINT_SPACING.has(spec.engine) && count < 2) remove('spacing');
        // Alternating bands use width + spacing, not the object-count field.
        if (spec.engine === 'ALTERNATE') remove('objectCount');
        // Legacy CHASE names containing "runner"/"spotlight" inherited a
        // tail switch, but only COMET/SCANNER actually read that field.
        if (!['COMET','SCANNER'].includes(spec.engine)) remove('trailLength');
        // Comet has a tail per head, but no mirrored-head branch.
        if (spec.engine === 'COMET') remove('mirror');
      }
    } else if (!effect.state?.v30Effect && !effect.state?.previewFamily &&
        /^spi-(?:chase|breathe)-\d+$/.test(effect.id || '') &&
        [126,127,129].includes(spec.variant) && count < 2) {
      // Orbit's offsets, Shutter's inter-window phase, and Carriage's gaps
      // need multiple points. This deliberately does NOT include 121..125,
      // Ripple Cascade (130), or Meteor Rain (131): their spacing parameter
      // still changes the actual pattern/envelope with one point.
      remove('spacing');
    }
    return Object.freeze(result);
  }
  function directionValuesFor(effect, state = {}, context = {}) {
    return controlsFor(effect,state,context).includes('direction') ? values(effect) : empty;
  }
  function spacingPurposeFor(effect) {
    const {engine,variant,legacy} = recipe(effect);
    const whole = effect?.id?.startsWith('rgbw-') || effect?.state?.previewFamily === 'RGBW';
    if (whole && variant === 19) return 'hold';
    if (whole && variant === 22 || effect?.id === 'spi-cascade-108' ||
        effect?.id === 'spi-cascade-172') return 'echo';
    if (legacy && GENERIC_POINT_SPACING.has(engine) && variant < 90 ||
        ['spi-chase-126','spi-breathe-127','spi-chase-129'].includes(effect?.id)) return 'points';
    return 'pattern';
  }
  function backgroundEditableFor(effect) {
    if (effect?.backgroundEditable !== true) return false;
    const state = effect.state || {}, {engine,variant,legacy} = recipe(effect);
    if (typeof state.v30Effect === 'string') {
      if (state.v30Effect.startsWith('v30-')) return effect.category === 'tunnel';
      return new Set(['sheet','stagger','ribbons','packets','amber','outline',
        'brand-trail','brand-outline'].map(key=>'v31-ref-'+key)).has(state.v30Effect);
    }
    if (state.previewFamily === 'RGBW' || /^rgbw-/.test(effect.id || '')) {
      // Full-colour gradients never expose the background underneath them.
      return variant >= 0 && variant <= 31 && ![2,3,9,10,19,23].includes(variant) && engine !== 'STATIC';
    }
    if (legacy) return variant === 103 || variant >= 0 && variant <= 102 &&
      !['STATIC','GRADIENT','WARM','ALL'].includes(engine);
    // Existing canonical SPI formulas own their envelope. Keep this closed to
    // the installed recipe families, rather than guessing for future engines.
    return /^spi-[a-z]+-\d+$/.test(effect.id || '') &&
      (variant >= 104 && variant <= 131 || variant >= 150 && variant <= 181);
  }
  return Object.freeze({controlsFor,directionValuesFor,spacingPurposeFor,backgroundEditableFor,
    maximumObjectCount:8,version:'650'});
}));
