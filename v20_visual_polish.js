/*
 * Aluvision Lighting Control - V20 animation-settings visual polish.
 *
 * This deliberately post-processes only the normal customer group editor.
 * Academy and Studio retain their own frozen renderers.  Existing application
 * renderers and the shared preview loop remain the single animation clock.
 */
(() => {
  'use strict';

  if (window.__aluvisionV20VisualPolish) return;
  window.__aluvisionV20VisualPolish = true;

  const STYLE_ID = 'v20-visual-polish-style';
  const ENHANCED_RANGE = 'v20RangeEnhanced';
  const detailsState = new Map();
  let generatedRangeId = 0;
  let enhanceQueued = false;

  function tx(nl, en, fr, de) {
    try {
      return typeof ac === 'function' ? ac(nl, en, fr, de) : nl;
    } catch (_) {
      return nl;
    }
  }

  function currentGroup() {
    try {
      return typeof group !== 'undefined' ? group : null;
    } catch (_) {
      return null;
    }
  }

  function customerShells(root = document) {
    const shells = [];
    if (root?.nodeType === 1 && root.matches?.('#zones .v1814-group-shell')) shells.push(root);
    root?.querySelectorAll?.('#zones .v1814-group-shell').forEach((shell) => shells.push(shell));
    return [...new Set(shells)].filter((shell) => !shell.closest('#studio,#help,.academy-shell,[data-academy]'));
  }

  function activeCustomerShell() {
    const page = document.querySelector('#zones.page.on');
    return page?.querySelector('.v1814-group-shell') || null;
  }

  function isCustomerLightingContext() {
    try {
      if (typeof realGuide !== 'undefined' && realGuide?.active) return false;
    } catch (_) {}
    return Boolean(document.querySelector('#zones.page.on'));
  }

  function travelingPulseDescription() {
    return tx(
      'Een gerichte lichtpuls reist vloeiend over de LED Line',
      'A focused light pulse travels smoothly along the LED Line',
      'Une impulsion lumineuse ciblée parcourt la LED Line',
      'Ein gerichteter Lichtimpuls läuft weich über die LED Line'
    );
  }

  function effectName(effect) {
    if (Array.isArray(effect)) return String(effect[0] || '');
    return String(effect?.name || effect?.animation || '');
  }

  function effectEngine(effect) {
    if (Array.isArray(effect)) return String(effect[1] || '');
    return String(effect?.engine || '');
  }

  function isTravelingPulse(effect) {
    return effectName(effect).trim().toLowerCase() === 'traveling pulse' && effectEngine(effect).toUpperCase() !== 'BREATHE';
  }

  const previousEffectDescription = window.effectDescription;
  window.effectDescription = function v20EffectDescription(effect) {
    const selected = currentGroup()?.state;
    const selectedTravelingPulse = !effect && selected?.animation === 'Traveling Pulse' &&
      String(selected.engine || '').toUpperCase() !== 'BREATHE';
    if (isCustomerLightingContext() && (isTravelingPulse(effect) || selectedTravelingPulse)) {
      return travelingPulseDescription();
    }
    return typeof previousEffectDescription === 'function'
      ? previousEffectDescription.apply(this, arguments)
      : tx('Professioneel lichteffect', 'Professional lighting effect', 'Effet lumineux professionnel', 'Professioneller Lichteffekt');
  };

  function correctEffectCopy(root = document) {
    const surfaces = [];
    customerShells(root).forEach((shell) => surfaces.push(shell));
    if (isCustomerLightingContext()) {
      if (root?.nodeType === 1 && root.matches?.('#modalBody[data-v1811="animation-library"]')) surfaces.push(root);
      root?.querySelectorAll?.('#modalBody[data-v1811="animation-library"]').forEach((surface) => surfaces.push(surface));
    }

    [...new Set(surfaces)].forEach((surface) => {
      surface.querySelectorAll('.v1811-effect-card').forEach((card) => {
        const title = card.querySelector('.effect-title,.v1811-effect-copy b');
        if (title?.textContent.trim().toLowerCase() !== 'traveling pulse') return;
        const description = card.querySelector('.v1811-effect-copy small') || card.querySelector('small');
        if (description && description.textContent !== travelingPulseDescription()) {
          description.textContent = travelingPulseDescription();
        }
      });

      surface.querySelectorAll('.v1811-library-current,.v1811-current-effect').forEach((card) => {
        const title = card.querySelector('b');
        const description = card.querySelector('em');
        if (title?.textContent.trim().toLowerCase() === 'traveling pulse' && description) {
          description.textContent = travelingPulseDescription();
        }
      });
    });

    const selected = currentGroup();
    if (selected?.state?.animation === 'Traveling Pulse' && String(selected.state.engine || '').toUpperCase() !== 'BREATHE') {
      customerShells(root).forEach((shell) => {
        const description = shell.querySelector('.v1811-settings-card > .row p.sub');
        if (description) description.textContent = travelingPulseDescription();
      });
    }
  }

  function parseHex(value) {
    const raw = String(value || '').trim();
    const rgbMatch = raw.match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/i);
    if (rgbMatch) return rgbMatch.slice(1, 4).map((part) => Math.max(0, Math.min(255, Math.round(Number(part) || 0))));
    const hex = raw.match(/^#([\da-f]{3}|[\da-f]{6})$/i)?.[1];
    if (!hex) return [255, 255, 255];
    const full = hex.length === 3 ? [...hex].map((part) => part + part).join('') : hex;
    return [0, 2, 4].map((offset) => Number.parseInt(full.slice(offset, offset + 2), 16));
  }

  function rgbCss(rgb) {
    return `rgb(${rgb.map((channel) => Math.max(0, Math.min(255, Math.round(Number(channel) || 0)))).join(',')})`;
  }

  function scaledCss(colour, level) {
    const ratio = Math.max(0, Math.min(100, Number(level) || 0)) / 100;
    return rgbCss(parseHex(colour).map((channel) => channel * ratio));
  }

  function foregroundPalette() {
    const selected = currentGroup();
    const state = selected?.state || {};
    const count = Math.max(1, Math.min(4, Number(state.colorCount) || state.colors?.length || 1));
    return Array.from({ length: count }, (_, index) => {
      try {
        if (typeof visibleStateColor === 'function') return visibleStateColor(state, index);
      } catch (_) {}
      return state.colors?.[index] || state.colors?.[0] || '#ffffff';
    });
  }

  function backgroundPalette() {
    const state = currentGroup()?.state || {};
    if (!state.backgroundOn) return ['#000000'];
    try {
      if (typeof visibleBackground === 'function') return [visibleBackground(state)];
    } catch (_) {}
    return [state.background || '#000000'];
  }

  function palettePaint(palette) {
    const colours = palette.length ? palette : ['#ffffff'];
    if (colours.length === 1) return colours[0];
    return `linear-gradient(90deg,${colours.map((colour, index) => `${colour} ${Math.round(index / Math.max(1, colours.length - 1) * 100)}%`).join(',')})`;
  }

  function rangeKey(range) {
    const id = String(range?.id || '');
    if (id === 'speedRange') return 'speed';
    if (id === 'widthRange') return 'width';
    if (id === 'parallelDelayRange') return 'spread';
    if (id === 'lineDelayRange') return 'lineDelayMs';
    if (id.startsWith('tune-')) return id.slice(5);
    const handler = range?.getAttribute?.('oninput') || '';
    const rgbw = handler.match(/rgbwRange\(['"]([^'"]+)/);
    if (rgbw) return rgbw[1];
    const setting = handler.match(/setAnimationSetting\(['"]([^'"]+)/);
    if (setting) return setting[1];
    return range?.dataset?.setting || id || 'setting';
  }

  function normalizedKind(key) {
    const token = String(key || '').toLowerCase();
    if (token.includes('bgbrightness') || token === 'background') return 'background';
    if (token.includes('brightness') || token.includes('intensity')) return 'brightness';
    if (token.includes('objectcount') || token === 'count' || token === 'objects') return 'count';
    if (token.includes('spacing')) return 'spacing';
    if (token.includes('spread') || token.includes('delay')) return 'spread';
    if (token.includes('smooth')) return 'smooth';
    if (token.includes('speed')) return 'speed';
    if (token.includes('width')) return 'width';
    if (token.includes('trail')) return 'trail';
    if (token.includes('random')) return 'randomness';
    return token;
  }

  function unitFor(key) {
    const kind = normalizedKind(key);
    if (kind === 'width') return 'px';
    if (String(key).toLowerCase().includes('delayms') || String(key).toLowerCase() === 'linedelayms') return 'ms';
    if (kind === 'count') return '×';
    if (['smooth', 'brightness', 'background', 'spacing', 'spread', 'trail', 'randomness'].includes(kind)) return '%';
    return '';
  }

  function settingPanel(range) {
    return range?.closest?.('.setting-visual-panel,.speed-panel,.width-panel,.rgbw-live-setting,.row-delay-panel,[data-v1817-line-delay]') || null;
  }

  function selectedCanonicalEffect() {
    const selected = currentGroup();
    const state = selected?.state || {};
    const rgbw = String(selected?.receiverType || state.receiverType || '').toUpperCase() === 'RGBW';
    const catalogue = window.AluvisionV21AnimationCatalog;
    const effects = rgbw ? catalogue?.rgbwEffects : catalogue?.spiEffects;
    return effects?.find(effect => effect.name === state.animation) || effects?.find(effect =>
      Number(effect.variant) === Number(state.variant) && effect.engine === state.engine) || null;
  }

  function settingDefault(key) {
    const stateKey = key === 'width' ? 'widthPixels' : key;
    const canonical = selectedCanonicalEffect();
    const defaults = canonical ? window.AluvisionV21AnimationCatalog.effectState(canonical) : {};
    if (defaults[stateKey] != null) return defaults[stateKey];
    if (!canonical) {
      try {
        const effect = window.AluvisionAnimationRuntime?.effects?.find(effect => effect[0] === currentGroup()?.state?.animation);
        const legacyDefaults = effect ? { ...animationDefaults(effect), ...(effect[4] || {}) } : {};
        if (legacyDefaults[stateKey] != null) return legacyDefaults[stateKey];
      } catch (_) {}
    }
    // Existing shared initial settings provide values absent from a catalogue
    // entry, particularly RGBW brightness and the optional effect toggles.
    let fallback = {};
    try { fallback = fresh().installations[0].zones[0].groups[0].state; } catch (_) {}
    const stable = { speed: 18, smooth: 100, brightness: 75, bgBrightness: 0, widthPixels: 3,
      spacing: 58, objectCount: 1, trailLength: 45, spread: 55, randomness: 25,
      bounce: false, mirror: false, direction: 'right', lineDelayMs: 0 };
    return fallback[stateKey] ?? stable[stateKey];
  }

  function addSettingReset(panel, key, range = null) {
    if (!panel || settingDefault(key) == null) return;
    let button = panel.querySelector(`:scope > [data-v21-reset-setting="${key}"]`);
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'v21-setting-reset';
      button.dataset.v21ResetSetting = key;
      panel.append(button);
    }
    if (range) button.dataset.v21ResetSource = range.id;
    const label = key === 'direction' ? tx('Richting', 'Direction', 'Direction', 'Richtung') : range?.getAttribute('aria-label') || panel.querySelector('b')?.textContent || key;
    const title = tx('Standaard', 'Default', 'Par défaut', 'Standard');
    button.textContent = `↺ ${title}`;
    button.setAttribute('aria-label', `${label}: ${title.toLowerCase()}`);
    button.title = `${title}: ${settingDefault(key)}${unitFor(key) ? ` ${unitFor(key)}` : ''}`;
  }

  function enhanceSettingResets(settings) {
    settings.querySelectorAll('input[type="range"]').forEach(range => {
      if (!range.id) range.id = `v20-setting-range-${++generatedRangeId}`;
      addSettingReset(settingPanel(range) || range.closest('.control'), rangeKey(range), range);
    });
    settings.querySelectorAll('[data-animation-toggle]').forEach(toggle => {
      addSettingReset(toggle.closest('.setting-toggle'), toggle.dataset.animationToggle);
    });
    settings.querySelectorAll('.direction-premium,.rgbw-direction').forEach(panel => {
      let resetRow = panel.nextElementSibling;
      if (!resetRow?.classList.contains('v21-direction-reset-context')) {
        resetRow = document.createElement('div');
        resetRow.className = 'v21-direction-reset-context';
        panel.insertAdjacentElement('afterend', resetRow);
      }
      addSettingReset(resetRow, 'direction');
    });
    const delayPanel = settings.querySelector('[data-v1817-line-delay]');
    if (delayPanel) {
      const explanation = delayPanel.querySelector('.v1817-delay-editor > p');
      if (explanation) explanation.textContent = tx('0 ms = tegelijk; 5000 ms = 5 seconden per stap. De animatie bepaalt welke lijnen samen starten.', '0 ms = together; 5000 ms = 5 seconds per step. The animation determines which lines start together.', '0 ms = ensemble ; 5000 ms = 5 secondes par étape. L’animation détermine quelles lignes démarrent ensemble.', '0 ms = gleichzeitig; 5000 ms = 5 Sekunden pro Schritt. Die Animation bestimmt, welche Linien gemeinsam starten.');
      const subtitle = delayPanel.querySelector(':scope > summary > span:first-child small');
      if (subtitle) subtitle.textContent = tx('Wachttijd per stap van de animatie', 'Delay per animation step', 'Délai par étape de l’animation', 'Wartezeit pro Animationsschritt');
      const lineLabel = delayPanel.querySelector('label[for="lineDelayRange"]');
      if (lineLabel) lineLabel.textContent = tx('Tijd per stap', 'Time per step', 'Durée par étape', 'Zeit pro Schritt');
      const presets = delayPanel.querySelector('.v1817-delay-presets');
      if (presets && !presets.querySelector('[data-line-delay-preset="5000"]')) {
        const preset = document.createElement('button');
        preset.type = 'button';
        preset.className = 'button soft';
        preset.dataset.lineDelayPreset = '5000';
        preset.textContent = '5 s';
        preset.setAttribute('onclick', 'setLineDelayMs(5000)');
        presets.append(preset);
      }
    }
    const effect = selectedCanonicalEffect();
    if (effect?.tunnel || effect?.kind === 'tunnel-lines') {
      const speed = [...settings.querySelectorAll('input[type="range"]')].find(range => rangeKey(range) === 'speed');
      const panel = settingPanel(speed);
      const heading = panel?.querySelector('.setting-title b') || panel?.querySelector(':scope > div:first-child b');
      const title = effect.receiverType === 'RGBW' ? tx('Fade-tempo', 'Fade speed', 'Vitesse du fondu', 'Blendtempo') : tx('Beweging per lijn', 'Motion per line', 'Mouvement par ligne', 'Bewegung pro Linie');
      if (heading) heading.textContent = title;
      const description = panel?.querySelector('.setting-description') || panel?.querySelector(':scope > div:first-child small');
      if (description) description.textContent = tx('Bepaalt hoe snel elke lijn fadet of beweegt. De wachttijd tussen lijnen stel je apart in.', 'Controls how quickly each line fades or moves. Set the delay between lines separately.', 'Règle la vitesse du fondu ou du mouvement de chaque ligne. Le délai entre les lignes se règle séparément.', 'Bestimmt, wie schnell jede Linie blendet oder sich bewegt. Die Wartezeit zwischen den Linien wird separat eingestellt.');
    }
  }

  document.addEventListener('click', event => {
    const button = event.target?.closest?.('[data-v21-reset-setting]');
    const shell = button?.closest?.('#zones .v1814-group-shell');
    if (!shell) return;
    event.preventDefault();
    event.stopPropagation();
    const key = button.dataset.v21ResetSetting;
    const value = settingDefault(key);
    if (value == null) return;
    rememberOpenDetails(shell);
    const range = button.dataset.v21ResetSource ? shell.querySelector(`#${CSS.escape(button.dataset.v21ResetSource)}`) : null;
    if (range) {
      // The normal input handler performs persistence, selected-line routing
      // and preview/live updates. Never reset the entire animation state.
      range.value = String(value);
      range.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (key === 'direction') {
      const rgbw = String(currentGroup()?.receiverType || '').toUpperCase() === 'RGBW';
      (rgbw ? window.rgbwDirection : window.setDirection)?.(value);
    } else if (Boolean(currentGroup()?.state?.[key]) !== Boolean(value)) {
      window.toggleAnimationSetting?.(key);
    }
    restoreOpenDetails(shell);
    queueEnhance();
  }, true);

  function addDirectNumber(range, settingsRoot) {
    if (!range || range.dataset[ENHANCED_RANGE] === 'true') return;
    const key = rangeKey(range);
    const kind = normalizedKind(key);
    const supported = ['speed', 'width', 'smooth', 'brightness', 'background', 'spacing', 'count', 'spread', 'trail', 'randomness'];
    if (!supported.includes(kind)) return;

    if (!range.id) range.id = `v20-setting-range-${++generatedRangeId}`;
    const control = range.closest('.control,.rgbw-live-setting');
    if (!control) return;

    let number = kind === 'width' ? settingsRoot.querySelector('#widthNumber') : null;
    const oldWidthRow = number?.closest('.width-input-row');
    if (!number) {
      number = document.createElement('input');
      number.type = 'number';
      number.inputMode = 'numeric';
      number.step = range.step || '1';
      number.min = range.min;
      number.max = range.max;
      number.value = range.value;
    } else {
      /* The delegated handler below is now the single bridge to the range.
         Avoid sending width changes twice through its former inline handler. */
      number.removeAttribute('oninput');
      number.removeAttribute('onchange');
    }
    number.classList.add('v20-direct-number');
    number.dataset.v20Source = range.id;
    number.setAttribute('aria-label', `${tx('Exacte waarde voor', 'Exact value for', 'Valeur exacte pour', 'Exakter Wert für')} ${range.getAttribute('aria-label') || key}`);

    const wrapper = document.createElement('label');
    wrapper.className = 'v20-direct-value';
    wrapper.dataset.v20For = range.id;
    wrapper.append(number);
    const unit = document.createElement('span');
    unit.textContent = unitFor(key);
    wrapper.append(unit);

    range.insertAdjacentElement('afterend', wrapper);
    control.classList.add('v20-has-direct');
    range.dataset[ENHANCED_RANGE] = 'true';
    range.dataset.v20Setting = kind;
    control.querySelectorAll(':scope > output').forEach((output) => {
      output.hidden = true;
      output.setAttribute('aria-hidden', 'true');
    });
    if (oldWidthRow) {
      oldWidthRow.hidden = true;
      oldWidthRow.dataset.v20ReplacedByDirect = 'true';
    }
  }

  function syncDirectNumbers(root = document) {
    customerShells(root).forEach((shell) => {
      shell.querySelectorAll('.v20-direct-number[data-v20-source]').forEach((number) => {
        const range = shell.querySelector(`#${CSS.escape(number.dataset.v20Source)}`);
        if (!range) return;
        number.min = range.min;
        number.max = range.max;
        number.step = range.step || '1';
        if (document.activeElement !== number) number.value = range.value;
        number.disabled = range.disabled;
      });
    });
  }

  function createSettingDemo(panel, kind) {
    if (!panel || panel.querySelector('.v20-setting-demo')) return panel?.querySelector('.v20-setting-demo') || null;
    const stage = document.createElement('div');
    stage.className = `v188-control-visual v20-setting-demo v20-demo-${kind}`;
    stage.dataset.v20Demo = kind;
    stage.setAttribute('aria-hidden', 'true');
    stage.innerHTML = `<span class="v20-demo-track">${Array.from({ length: 18 }, () => '<i></i>').join('')}</span><span class="v20-demo-nodes"></span><em></em>`;
    const heading = panel.querySelector(':scope > .row,:scope > div:first-child');
    if (heading) heading.insertAdjacentElement('afterend', stage);
    else panel.prepend(stage);
    return stage;
  }

  function timingDemoColour(state, sample, family, count, supportsBackground) {
    const colours = Array.isArray(state.colors) && state.colors.length ? state.colors : ['#000000'];
    const palette = Array.from({ length: count }, (_, index) => ({
      rgb: parseHex(state.rgbEnabled?.[index] === false ? '#000000' : colours[index % colours.length]),
      white: state.whiteEnabled?.[index] === false ? 0 : Math.max(0, Math.min(255, Number(state.whiteChannels?.[index]) || 0))
    }));
    const engine = window.AluvisionTunnelEngine;
    const spec = engine.paletteSpec(sample, count);
    const first = palette[spec.first];
    const second = palette[spec.second];
    let mix = spec.mix;
    if (family === 'SPI' && engine?.sharedRgbwVariant?.(state.variant) == null) {
      const smooth = Math.max(0, Math.min(100, Number(state.smooth ?? 100))) / 100;
      const blend = smooth < 0.5 ? 4 * smooth * smooth * smooth : 1 - 4 * Math.pow(1 - smooth, 3);
      const stepped = mix < 0.5 ? 0 : 1;
      mix = stepped + (mix - stepped) * blend;
    }
    const foreground = {
      rgb: first.rgb.map((channel, index) => Math.round(channel + (second.rgb[index] - channel) * mix)),
      white: Math.round(first.white + (second.white - first.white) * mix),
      amount: sample.amount
    };
    const brightness = Math.max(0, Math.min(100, Number(state.brightness ?? 100))) / 100;
    if (family === 'SPI') {
      foreground.brightness = brightness;
      if (supportsBackground && state.backgroundOn) foreground.background = {
        rgb: parseHex(state.backgroundRgbEnabled === false ? '#000000' : state.background?.rgb || state.background || '#000000'),
        white: state.backgroundWhiteEnabled === false ? 0 : Number(state.background?.white ?? state.backgroundWhite) || 0,
        brightness: Math.max(0, Math.min(100, Number(state.bgBrightness ?? state.backgroundBrightness) || 0)) / 100
      };
    } else foreground.amount *= brightness;
    // Interpolate the physical RGB and W channels first. Applying optical
    // white to each slot before mixing, or dimming the mixed screen colour,
    // changes the hue and cannot match the main preview during a fade.
    return rgbCss(window.AluvisionV21AnimationCatalog.opticalRgb(foreground));
  }

  function updateCustomDemo(stage, kind, range, palette, key = kind) {
    const minimum = Number(range.min) || 0;
    const maximum = Number(range.max) || 100;
    const value = Math.max(minimum, Math.min(maximum, Number(range.value) || 0));
    const level = (value - minimum) / Math.max(1, maximum - minimum) * 100;
    stage.dataset.v20Setting = kind;
    stage.dataset.v20Palette = palette.join(',');
    stage.dataset.v20Value = String(value);
    stage.style.setProperty('--v20-demo-paint', palettePaint(palette));
    stage.style.setProperty('--v20-demo-colour', palette[0]);
    const sharedWholeLine = String(currentGroup()?.receiverType || '').toUpperCase() === 'SPI'
      && window.AluvisionTunnelEngine?.sharedRgbwVariant?.(currentGroup()?.state?.variant) != null;
    if (key === 'lineDelayMs' || sharedWholeLine && ['speed', 'smooth', 'spacing'].includes(kind)) {
      stage.dataset.v21TimingDemo = key === 'lineDelayMs' ? 'line-starts' : 'whole-line-' + kind;
      const count = currentGroup()?.layout === 'parallel' ? Math.max(2, Math.min(3, currentGroup()?.receivers?.length || 3)) : 1;
      const state = currentGroup()?.state || {};
      const delay = key === 'lineDelayMs' ? value : Math.round(Math.max(0, Math.min(5080, Number(state.lineDelayMs) || 0)) / 40) * 40;
      const engine = window.AluvisionTunnelEngine;
      const family = String(currentGroup()?.receiverType || state.receiverType || 'SPI').toUpperCase();
      const variant = Number(state.variant) || 0;
      const supportsBackground = window.AluvisionV21AnimationCatalog?.spiEffects?.find(effect => effect.variant === variant)?.capabilities.background === true;
      const shape = engine?.kind(family, variant);
      // Older panel effects use the same literal timing demonstration: one
      // complete line pulses after the other, at the entered delay.
      const demoFamily = shape ? family : 'RGBW';
      const demoVariant = shape ? variant : 5;
      const speed = Number(state.speed) || 0;
      const smooth = Number(state.smooth ?? 100);
      const reverse = state.direction === 'left';
      const timing = engine?.plan(shape || 'pulse', count, speed, delay);
      const channelSignature = JSON.stringify([state.colors, state.whiteChannels, state.rgbEnabled, state.whiteEnabled,
        state.backgroundOn, state.background, state.backgroundWhite, state.backgroundRgbEnabled, state.backgroundWhiteEnabled, state.bgBrightness]);
      const signature = `${family}:${count}:${delay}:${speed}:${smooth}:${reverse}:${variant}:${state.spacing}:${state.brightness}:${palette.join(',')}:${channelSignature}`;
      if (stage.dataset.v21TimingSignature !== signature) {
        stage.dataset.v21TimingSignature = signature;
        stage.querySelectorAll('i').forEach(line => line.getAnimations?.().forEach(animation => animation.cancel()));
        stage.replaceChildren();
        const started = document.timeline?.currentTime;
        for (let index = 0; index < count; index += 1) {
          const row = document.createElement('div');
          row.className = 'v21-delay-preview-row';
          const name = document.createElement('b');
          name.textContent = `LED Line ${index + 1}`;
          const line = document.createElement('i');
          line.style.background = palette[0];
          line.style.filter = 'brightness(0)';
          const time = document.createElement('span');
          const order = engine?.orderFor(shape || 'pulse', index, count, reverse) ?? index;
          const milliseconds = order * delay;
          time.textContent = milliseconds === 0 ? '0 ms' : milliseconds % 1000 === 0 ? `+${milliseconds / 1000} s` : `+${milliseconds} ms`;
          row.append(name, line, time);
          stage.append(row);
          if (timing && engine?.paletteSpec && window.AluvisionV21AnimationCatalog?.opticalRgb && typeof line.animate === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            const steps = Math.max(30, Math.ceil(timing.period / 0.04));
            const frames = Array.from({ length: steps + 1 }, (_, step) => {
              const phase = step / steps;
              const sample = engine.sample(demoFamily, demoVariant, index, count, phase, speed, delay, smooth, reverse, state.spacing ?? 50);
              const colour = timingDemoColour(state, sample, family, palette.length, supportsBackground);
              return { offset: phase, filter: 'none', backgroundColor: colour, boxShadow: `0 0 10px ${colour}` };
            });
            const animation = line.animate(frames, { duration: timing.period * 1000, iterations: Infinity, easing: 'linear' });
            if (started != null) animation.startTime = started;
            if (speed <= 0) animation.pause();
          }
        }
      }
      return;
    }
    const nodes = stage.querySelector('.v20-demo-nodes');
    const trackCells = stage.querySelectorAll('.v20-demo-track i');
    const wanted = kind === 'count' ? Math.max(1, Math.min(8, Math.round(value))) : kind === 'spacing' ? 3 : 5;
    const signature = `${kind}:${wanted}`;
    if (nodes && nodes.dataset.signature !== signature) {
      nodes.dataset.signature = signature;
      nodes.innerHTML = Array.from({ length: wanted }, () => '<i></i>').join('');
    }

    trackCells.forEach((cell, index) => {
      const colour = palette[index % palette.length];
      cell.style.background = colour;
      cell.style.opacity = kind === 'spread' ? String(0.18 + level / 122) : '.22';
    });

    const nodeList = nodes ? [...nodes.children] : [];
    nodeList.forEach((node, index) => {
      let position;
      if (kind === 'spacing') {
        const gap = 8 + level * 0.38;
        position = 50 + (index - 1) * gap;
      } else {
        position = (index + 0.5) / Math.max(1, nodeList.length) * 100;
      }
      node.style.left = `${Math.max(4, Math.min(96, position))}%`;
      node.style.background = palette[index % palette.length];
      node.style.boxShadow = `0 0 ${Math.round(7 + level * 0.07)}px ${palette[index % palette.length]}`;
      node.style.width = kind === 'spread' ? `${Math.max(5, 18 - level * 0.1)}%` : kind === 'spacing' ? '11%' : `${Math.max(5, 52 / Math.max(1, nodeList.length))}%`;
    });

    stage.style.setProperty('--v188-level', `${level}%`);
    const readout = stage.querySelector('em');
    if (readout) {
      const unit = unitFor(key);
      readout.textContent = kind === 'count'
        ? `${Math.round(value)} ×`
        : `${Math.round(value)}${unit ? ` ${unit}` : ''}`;
    }
  }

  function syncExistingDemo(stage, kind, range, palette) {
    if (!stage) return;
    const minimum = Number(range.min) || 0;
    const maximum = Number(range.max) || 100;
    const value = Math.max(minimum, Math.min(maximum, Number(range.value) || 0));
    const level = (value - minimum) / Math.max(1, maximum - minimum) * 100;
    const paint = palettePaint(palette);
    stage.dataset.v20Setting = kind;
    stage.dataset.v20Palette = palette.join(',');
    stage.dataset.v20Value = String(value);
    stage.style.setProperty('--v188-colour', palette[0]);
    stage.style.setProperty('--v18161-paint', paint);
    stage.style.setProperty('--v188-level', `${level}%`);

    if (kind === 'speed') {
      const runner = stage.querySelector(':scope > b');
      if (runner) runner.style.background = paint;
      stage.classList.toggle('v18161-reverse', currentGroup()?.state?.direction === 'left');
    }
    if (kind === 'smooth') {
      const canvas = stage.querySelector('canvas');
      if (canvas) {
        canvas.dataset.smoothness = String(Math.round(value));
        canvas.dataset.palette = JSON.stringify(palette.map(parseHex));
      }
    }
    if (kind === 'brightness' || kind === 'background') {
      stage.querySelectorAll(':scope > span i').forEach((cell, index) => {
        const colour = palette[index % palette.length];
        cell.style.background = scaledCss(colour, level);
        cell.style.opacity = '1';
        cell.style.filter = 'none';
        cell.style.boxShadow = level > 0 ? `0 0 ${Math.round(2 + level * 0.1)}px ${scaledCss(colour, Math.max(8, level))}` : 'none';
      });
      stage.querySelectorAll('.v18161-brightness-compare span i').forEach((cell, index) => {
        const colour = palette[index % palette.length];
        cell.style.background = colour;
        cell.style.boxShadow = `0 0 7px ${colour}`;
      });
      stage.style.setProperty('--v188-opacity', '1');
    }
  }

  function syncDirectionAndMirror(shell, palette) {
    const paint = palettePaint(palette);
    const direction = currentGroup()?.state?.direction === 'left' ? 'left' : 'right';
    shell.querySelectorAll('.direction-route-tabs button,.direction-premium .tabs button,.rgbw-direction button').forEach((button) => {
      const handler = button.getAttribute('onclick') || '';
      const buttonDirection = handler.includes("'left'") ? 'left' : 'right';
      const selected = buttonDirection === direction;
      button.classList.toggle('on', selected);
      button.setAttribute('aria-pressed', String(selected));
      button.dataset.v20Demo = 'direction';
      button.dataset.v20Palette = palette.join(',');
      button.style.setProperty('--v20-demo-paint', paint);
      button.style.setProperty('--v20-demo-colour', palette[0]);
      const track = button.querySelector('.v188-direction-track');
      if (track) {
        const rail = track.querySelector('i');
        const runner = track.querySelector('b');
        if (rail) rail.style.background = paint;
        if (runner) {
          runner.style.background = palette[0];
          runner.style.boxShadow = `0 0 10px ${palette[0]}`;
        }
      }
      const rgbwTrack = button.querySelector(':scope > span:not(.v188-direction-track)');
      if (button.closest('.rgbw-direction') && rgbwTrack) rgbwTrack.style.background = paint;
    });

    shell.querySelectorAll('[data-animation-toggle="mirror"]').forEach((button) => {
      const on = Boolean(currentGroup()?.state?.mirror);
      button.classList.toggle('on', on);
      button.classList.toggle('soft', !on);
      button.setAttribute('aria-pressed', String(on));
      button.dataset.v20Demo = 'mirror';
      button.dataset.v20Palette = palette.join(',');
      button.style.setProperty('--v20-demo-paint', paint);
      button.style.setProperty('--v20-demo-colour', palette[0]);
      const visual = button.querySelector('.v188-toggle-visual');
      if (visual) {
        visual.classList.toggle('on', on);
        visual.style.color = palette[0];
      }
    });
  }

  function syncSettingVisuals(root = document) {
    customerShells(root).forEach((shell) => {
      const settings = shell.querySelector('.v1811-settings-card');
      if (!settings) return;
      const foreground = foregroundPalette();

      settings.querySelectorAll('input[type="range"]').forEach((range) => {
        const key = rangeKey(range);
        const kind = normalizedKind(key);
        const panel = settingPanel(range);
        if (!panel) return;
        const palette = kind === 'background' ? backgroundPalette() : foreground;
        panel.dataset.v20Setting = kind;
        panel.dataset.v20Palette = palette.join(',');
        panel.style.setProperty('--width-color', palette[0]);

        let stage = panel.querySelector('.v188-control-visual,.v1812-rgbw-control-visual');
        if (!stage && ['spacing', 'count', 'spread'].includes(kind)) stage = createSettingDemo(panel, kind);
        const sharedWholeLine = String(currentGroup()?.receiverType || '').toUpperCase() === 'SPI'
          && window.AluvisionTunnelEngine?.sharedRgbwVariant?.(currentGroup()?.state?.variant) != null;
        if (stage && sharedWholeLine && ['speed', 'smooth', 'spacing'].includes(kind)) {
          stage.classList.remove('v18153-smooth-demo', 'v18161-speed-demo');
          stage.classList.add('v20-setting-demo');
          if (kind === 'smooth') {
            const description = panel.querySelector('.setting-description');
            if (description) description.textContent = tx('Hoe zacht volledige LED Lines oplichten en uitdoven. Iedere lijn blijft één geheel.', 'How softly complete LED Lines light and fade. Every line stays one whole.', 'Douceur de l’allumage et de l’extinction des lignes complètes.', 'Wie weich ganze LED Lines aufleuchten und erlöschen.');
            const limit = panel.querySelector('.v18153-smooth-limits span');
            if (limit) limit.textContent = tx('Duidelijke stappen', 'Clear steps', 'Étapes nettes', 'Klare Schritte');
            const meaning = panel.querySelector('#tune-smooth-meaning');
            if (meaning) meaning.textContent = tx('Overgangen tussen volledige lijnen', 'Transitions between complete lines', 'Transitions entre lignes complètes', 'Übergänge zwischen ganzen Linien');
            const meta = panel.querySelector('.v18153-smooth-meta span:last-child');
            if (meta) meta.textContent = tx('Geen losse pixels', 'No separate pixels', 'Pas de pixels séparés', 'Keine einzelnen Pixel');
            range.setAttribute('aria-valuetext', `${range.value}% · ${tx('volledige lijnen', 'complete lines', 'lignes complètes', 'ganze Linien')}`);
          }
        }
        if (stage?.classList.contains('v20-setting-demo')) updateCustomDemo(stage, kind, range, palette, key);
        else if (stage) syncExistingDemo(stage, kind, range, palette);
      });

      syncDirectionAndMirror(shell, foreground);
    });
  }

  function totalPhysicalPixels(selected = currentGroup()) {
    const receivers = Array.isArray(selected?.receivers) ? selected.receivers : [];
    const total = receivers.reduce((sum, receiver) => {
      let value = Number(receiver?.pixels);
      if (!Number.isFinite(value) || value <= 0) {
        try {
          const deviceId = receiver?.deviceId || receiver?.id;
          const device = (db?.devices || []).find((candidate) => candidate?.id === deviceId);
          value = Number(device?.pixels);
        } catch (_) {}
      }
      return sum + (Number.isFinite(value) && value > 0 ? Math.round(value) : 0);
    }, 0);
    if (total > 0) return total;
    const fallback = Number(selected?.state?.groupPixels);
    return Number.isFinite(fallback) && fallback > 0 ? Math.round(fallback) : 1;
  }

  function widthMeterMarkup(value) {
    const full = Math.max(0, value - 1);
    const shown = Math.min(27, full);
    const hidden = Math.max(0, full - shown);
    return '<i class="fade far" aria-hidden="true"></i>' +
      Array.from({ length: shown }, () => '<i class="on" data-width-core="true" aria-hidden="true"></i>').join('') +
      (hidden ? `<em class="width-overflow">+${hidden}</em>` : '') +
      '<i class="fade" aria-hidden="true"></i>';
  }

  function normalizeWidthControl(shell) {
    const selected = currentGroup();
    const range = shell.querySelector('#widthRange');
    if (!selected || !range) return;
    const max = totalPhysicalPixels(selected);
    const value = Math.max(1, Math.min(max, Math.round(Number(selected.state?.widthPixels) || 1)));
    range.min = '1';
    range.max = String(max);
    range.value = String(value);
    shell.querySelectorAll('#widthNumber,.v20-direct-number[data-v20-source="widthRange"]').forEach((number) => {
      number.min = '1';
      number.max = String(max);
      if (document.activeElement !== number) number.value = String(value);
    });
    const panel = range.closest('.width-panel');
    const limit = panel?.querySelector('.width-range-labels span:last-child');
    if (limit) limit.textContent = `${tx('Volledige groep', 'Entire group', 'Groupe complet', 'Gesamte Gruppe')} · ${max} pixels`;
    const output = shell.querySelector('#widthValue');
    if (output) output.textContent = `${value} px`;
    const meaning = shell.querySelector('#widthMeaning');
    if (meaning) meaning.textContent = `${value} px ${tx('effectbreedte', 'effect width', 'de largeur d\'effet', 'Effektbreite')}`;
    const share = shell.querySelector('#widthShare');
    if (share) share.innerHTML = `${Math.round(value / max * 100)}% ${tx('van de groep', 'of the group', 'du groupe', 'der Gruppe')}<br>${tx('Trail of achtergrond kan extra licht tonen', 'Trail or background can show extra light', 'La traînée ou le fond peut ajouter de la lumière', 'Trail oder Hintergrund kann zusätzliches Licht zeigen')}`;
    const meter = shell.querySelector('#widthMeter');
    if (meter && meter.dataset.corePixels !== String(value)) {
      meter.dataset.corePixels = String(value);
      meter.innerHTML = widthMeterMarkup(value);
    }
  }

  const previousSetWidthPixels = window.setWidthPixels;
  window.setWidthPixels = function v20SetWidthPixels(value) {
    const shell = activeCustomerShell();
    const selected = currentGroup();
    if (!shell || !selected?.state) {
      return typeof previousSetWidthPixels === 'function' ? previousSetWidthPixels.apply(this, arguments) : undefined;
    }
    const max = totalPhysicalPixels(selected);
    const pixels = Math.max(1, Math.min(max, Math.round(Number(value) || 1)));
    const family = ((Number(selected.state.variant) || 0) % 6 + 6) % 6;
    const scale = [0.58, 0.78, 1, 1.25, 1.55, 0.9][family];
    selected.state.widthPixels = pixels;
    selected.state.width = Math.max(1, Math.min(100, Math.round(((pixels / max) / scale - 0.012) * 390)));
    try {
      if (typeof save === 'function') save('queued');
      if (typeof queueLive === 'function') queueLive(selected);
    } catch (_) {}
    normalizeWidthControl(shell);
    syncDirectNumbers(shell);
    syncSettingVisuals(shell);
    return pixels;
  };

  function detailKey(details, shell) {
    const selected = currentGroup();
    const groupId = selected?.id || shell?.querySelector('h1')?.textContent || 'group';
    if (details.matches('[data-animation-advanced]')) return `${groupId}:advanced`;
    if (details.matches('[data-v1817-line-delay]')) return `${groupId}:line-delay`;
    if (details.matches('.v1811-quick-effects')) return `${groupId}:quick-effects`;
    if (details.matches('[data-v1815-tool]')) return `${groupId}:colour:${details.dataset.v1815Tool}`;
    const all = [...shell.querySelectorAll('details')];
    const identity = details.id || [...details.classList].sort().join('.') || `details-${all.indexOf(details)}`;
    return `${groupId}:${identity}`;
  }

  function rememberOpenDetails(root = document) {
    customerShells(root).forEach((shell) => {
      shell.querySelectorAll('details').forEach((details) => detailsState.set(detailKey(details, shell), details.open));
    });
  }

  function restoreOpenDetails(root = document) {
    customerShells(root).forEach((shell) => {
      shell.querySelectorAll('details').forEach((details) => {
        const key = detailKey(details, shell);
        if (detailsState.has(key)) details.open = detailsState.get(key);
      });
    });
  }

  function enhanceControls(root = document) {
    customerShells(root).forEach((shell) => {
      const settings = shell.querySelector('.v1811-settings-card');
      if (!settings) return;
      normalizeWidthControl(shell);
      settings.querySelectorAll('input[type="range"]').forEach((range) => addDirectNumber(range, settings));
      enhanceSettingResets(settings);
      syncDirectNumbers(shell);
    });
  }

  function enhance(root = document) {
    correctEffectCopy(root);
    restoreOpenDetails(root);
    enhanceControls(root);
    syncSettingVisuals(root);
  }

  function queueEnhance() {
    if (enhanceQueued) return;
    enhanceQueued = true;
    queueMicrotask(() => {
      enhanceQueued = false;
      enhance(document);
    });
  }

  function wrapFunction(name, remember = false) {
    const original = window[name];
    if (typeof original !== 'function' || original.__v20VisualWrapped) return;
    const wrapped = function v20VisualWrappedFunction() {
      // Every wrapped live control runs the shared enhancement pass. Capture
      // the current disclosure state first, otherwise that pass can restore an
      // earlier closed value while an advanced slider or toggle is changing.
      rememberOpenDetails(document);
      const result = original.apply(this, arguments);
      queueEnhance();
      if (result && typeof result.finally === 'function') result.finally(queueEnhance);
      return result;
    };
    wrapped.__v20VisualWrapped = true;
    wrapped.__v20VisualOriginal = original;
    window[name] = wrapped;
  }

  function setDirectionInPlace(value, rgbw = false) {
    const shell = activeCustomerShell();
    const selected = currentGroup();
    if (!shell || !selected?.state) return false;
    const direction = value === 'left' ? 'left' : 'right';
    if (selected.state.direction !== direction) {
      selected.state.direction = direction;
      selected.state.previewStartedAt = performance.now() / 1000;
      selected.state.phaseMs = 0;
      selected.state.restartToken = (Number(selected.state.restartToken) || 0) + 1;
    }
    try {
      if (typeof save === 'function') save('queued');
      if (typeof queueLive === 'function') queueLive(selected);
      if (typeof toast === 'function') toast(direction === 'left'
        ? tx('Beweging loopt nu naar links', 'Motion now runs to the left', 'Le mouvement va maintenant vers la gauche', 'Bewegung läuft jetzt nach links')
        : tx('Beweging loopt nu naar rechts', 'Motion now runs to the right', 'Le mouvement va maintenant vers la droite', 'Bewegung läuft jetzt nach rechts'));
    } catch (_) {}
    shell.querySelectorAll(rgbw ? '.rgbw-direction button' : '.direction-route-tabs button,.direction-premium .tabs button').forEach((button) => {
      const handler = button.getAttribute('onclick') || '';
      const buttonDirection = handler.includes("'left'") ? 'left' : 'right';
      button.classList.toggle('on', buttonDirection === direction);
      button.setAttribute('aria-pressed', String(buttonDirection === direction));
    });
    syncSettingVisuals(shell);
    return true;
  }

  const previousSetDirection = window.setDirection;
  window.setDirection = function v20SetDirection(value) {
    if (setDirectionInPlace(value, false)) return;
    return typeof previousSetDirection === 'function' ? previousSetDirection.apply(this, arguments) : undefined;
  };

  const previousRgbwDirection = window.rgbwDirection;
  window.rgbwDirection = function v20RgbwDirection(value) {
    if (setDirectionInPlace(value, true)) return;
    return typeof previousRgbwDirection === 'function' ? previousRgbwDirection.apply(this, arguments) : undefined;
  };

  document.addEventListener('toggle', (event) => {
    const details = event.target;
    const shell = details?.closest?.('#zones .v1814-group-shell');
    if (shell && details.matches('details')) detailsState.set(detailKey(details, shell), details.open);
  }, true);

  document.addEventListener('input', (event) => {
    const target = event.target;
    const shell = target?.closest?.('#zones .v1814-group-shell');
    if (!shell) return;
    if (target.matches('input[type="range"]')) {
      const number = shell.querySelector(`.v20-direct-number[data-v20-source="${CSS.escape(target.id)}"]`);
      if (number && document.activeElement !== number) number.value = target.value;
      syncSettingVisuals(shell);
      return;
    }
    if (!target.matches('.v20-direct-number[data-v20-source]') || target.value === '') return;
    const range = shell.querySelector(`#${CSS.escape(target.dataset.v20Source)}`);
    if (!range) return;
    const minimum = Number(range.min);
    const maximum = Number(range.max);
    let value = Number(target.value);
    if (!Number.isFinite(value)) return;
    if (Number.isFinite(minimum)) value = Math.max(minimum, value);
    if (Number.isFinite(maximum)) value = Math.min(maximum, value);
    value = Math.round(value);
    target.value = String(value);
    range.value = String(value);
    range.dispatchEvent(new Event('input', { bubbles: true }));
  }, true);

  document.addEventListener('change', (event) => {
    const target = event.target;
    if (!target?.matches?.('.v20-direct-number[data-v20-source]')) return;
    const shell = target.closest('#zones .v1814-group-shell');
    const range = shell?.querySelector(`#${CSS.escape(target.dataset.v20Source)}`);
    if (!range) return;
    const minimum = Number(range.min);
    const maximum = Number(range.max);
    let value = Number(target.value);
    if (!Number.isFinite(value)) value = Number(range.value) || minimum || 0;
    if (Number.isFinite(minimum)) value = Math.max(minimum, value);
    if (Number.isFinite(maximum)) value = Math.min(maximum, value);
    target.value = String(Math.round(value));
    range.value = target.value;
    range.dispatchEvent(new Event('input', { bubbles: true }));
  }, true);

  [
    'render', 'zones', 'groupUI', 'openGroup', 'renderModal', 'animationBrowser', 'renderAnimationLibrary',
    'setEffect', 'setRgbwEffect', 'activateAnimationBackground', 'toggleEffectInlineBackground',
    'setV1814GroupSection'
  ].forEach((name) => wrapFunction(name, true));

  [
    'setAnimationSetting', 'setSpeedValue', 'setSpeedMode', 'rgbwRange', 'toggleAnimationSetting',
    'v18153SetSmoothness', 'effectInlineWheelPick', 'effectInlineBrightness', 'effectInlineRgbw',
    'effectInlineHex', 'effectInlineQuick', 'toggleEffectInlineRgb', 'toggleEffectInlineWhite',
    'setEffectInlineRgbwMode', 'v1815SetChannelValue', 'v1815ToggleChannel'
  ].forEach((name) => wrapFunction(name, false));

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.dataset.releaseLayer = 'visual-polish';
    style.textContent = `
      #zones .v1814-group-shell .v1811-settings-card,
      #zones .v1814-group-shell .animation-control-shell,
      #zones .v1814-group-shell .animation-setting-section,
      #zones .v1814-group-shell .animation-setting-grid,
      #zones .v1814-group-shell .advanced-panel,
      #zones .v1814-group-shell .advanced-panel .animation-settings,
      #zones .v1814-group-shell .setting-visual-panel,
      #zones .v1814-group-shell .direction-premium { min-width:0;max-width:100%; }
      #zones .v1814-group-shell .animation-setting-section { gap:12px;padding:14px;overflow:hidden; }
      #zones .v1814-group-shell .animation-setting-section-head { padding-bottom:2px; }
      #zones .v1814-group-shell .advanced-panel { overflow:hidden; }
      #zones .v1814-group-shell .advanced-panel[open] > summary { border-bottom:1px solid var(--line);margin-bottom:12px; }
      #zones .v1814-group-shell .advanced-panel > summary { min-width:0;overflow-wrap:anywhere; }
      #zones .v1814-group-shell [data-v1817-line-delay] > summary { display:grid;grid-template-columns:minmax(0,1fr) auto 12px;gap:8px;align-items:center; }
      #zones .v1814-group-shell [data-v1817-line-delay] > summary:after { content:'⌄';grid-column:3;grid-row:1;align-self:center;justify-self:end;margin:0;font-size:15px;line-height:1; }
      #zones .v1814-group-shell [data-v1817-line-delay][open] > summary:after { transform:rotate(180deg); }
      #zones .v1814-group-shell [data-v1817-line-delay]:has([data-v21-timing-demo]) [data-line-delay-schedule] { display:none!important; }
      #zones .v1814-group-shell .v21-setting-reset { display:block;grid-column:1/-1!important;justify-self:end;min-height:36px;min-width:88px;margin:7px 0 0 auto;padding:6px 10px;border:1px solid var(--line);border-radius:9px;background:var(--panel);color:var(--ink);font-size:11px;font-weight:750;line-height:1.3;cursor:pointer; }
      #zones .v1814-group-shell .v21-setting-reset:focus-visible { outline:2px solid var(--red);outline-offset:2px; }
      #zones .v1814-group-shell .setting-toggle:has(> .v21-setting-reset) { flex-wrap:wrap; }
      #zones .v1814-group-shell .setting-toggle > .v21-setting-reset { margin-left:auto; }

      #zones .v1814-group-shell .control.v20-has-direct {
        display:grid!important;
        grid-template-columns:minmax(72px,.85fr) minmax(96px,2fr) minmax(72px,84px)!important;
        grid-template-rows:auto!important;
        align-items:center!important;
        gap:8px!important;
        min-width:0;
      }
      #zones .v1814-group-shell .control.v20-has-direct > label:not(.v20-direct-value) { grid-column:1!important;grid-row:1!important;min-width:0; }
      #zones .v1814-group-shell .control.v20-has-direct > input[type="range"] { grid-column:2!important;grid-row:1!important;width:100%!important;min-width:0!important;margin:0!important; }
      #zones .v1814-group-shell .control.v20-has-direct > .v20-direct-value { grid-column:3!important;grid-row:1!important; }
      #zones .v1814-group-shell .control.v20-has-direct > output[hidden],
      #zones .v1814-group-shell .rgbw-live-setting.v20-has-direct > output[hidden] { display:none!important; }
      #zones .v1814-group-shell .v20-direct-value {
        display:grid!important;
        grid-template-columns:minmax(0,1fr) auto!important;
        grid-template-rows:1fr!important;
        align-items:center!important;
        gap:3px!important;width:100%;min-width:0;height:38px;margin:0!important;padding:0 7px!important;
        border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--mut);
        font-size:9px;font-weight:900;line-height:1!important;
      }
      #zones .v1814-group-shell .v20-direct-number {
        display:block;width:100%!important;min-width:0!important;height:34px!important;margin:0!important;padding:4px 2px!important;
        grid-column:1!important;grid-row:1!important;align-self:center!important;
        border:0!important;outline:0;background:transparent!important;color:var(--ink);font-size:13px;font-weight:950;text-align:right;font-variant-numeric:tabular-nums;
        appearance:textfield;-moz-appearance:textfield;
      }
      #zones .v1814-group-shell .v20-direct-number::-webkit-inner-spin-button,
      #zones .v1814-group-shell .v20-direct-number::-webkit-outer-spin-button { margin:0;appearance:none;-webkit-appearance:none; }
      #zones .v1814-group-shell .v20-direct-value:focus-within { border-color:var(--red);box-shadow:0 0 0 3px color-mix(in srgb,var(--red),transparent 86%); }
      #zones .v1814-group-shell .v20-direct-value > span { grid-column:2!important;grid-row:1!important;width:auto!important;min-width:0!important;align-self:center!important; }
      #zones .v1814-group-shell .v20-direct-value > span:empty { display:none; }
      #zones .v1814-group-shell .width-input-row[data-v20-replaced-by-direct][hidden] { display:none!important; }

      #zones .v1814-group-shell .rgbw-live-setting.v20-has-direct { grid-template-columns:minmax(0,1fr) minmax(72px,84px)!important; }
      #zones .v1814-group-shell .rgbw-live-setting.v20-has-direct > div:first-child,
      #zones .v1814-group-shell .rgbw-live-setting.v20-has-direct > .v1812-rgbw-control-visual,
      #zones .v1814-group-shell .rgbw-live-setting.v20-has-direct > .v188-control-visual { grid-column:1/-1!important; }
      #zones .v1814-group-shell .rgbw-live-setting.v20-has-direct > input[type="range"] { grid-column:1!important;width:100%;min-width:0; }
      #zones .v1814-group-shell .rgbw-live-setting.v20-has-direct > .v20-direct-value { grid-column:2!important; }

      #zones .v1814-group-shell .v20-setting-demo { height:64px;margin:8px 0 4px;padding:12px 11px; }
      #zones .v1814-group-shell .v20-setting-demo:before { z-index:0; }
      #zones .v1814-group-shell .v20-setting-demo > .v20-demo-track { position:relative;z-index:1;display:flex;height:100%;gap:3px; }
      #zones .v1814-group-shell .v20-setting-demo > .v20-demo-track i { flex:1;height:18px;border-radius:4px;transition:background .12s,opacity .12s; }
      #zones .v1814-group-shell .v20-demo-nodes { position:absolute!important;z-index:2;inset:13px!important;display:block!important;height:auto!important;pointer-events:none; }
      #zones .v1814-group-shell .v20-demo-nodes i { position:absolute;top:50%;height:18px;max-width:30%;border-radius:99px;transform:translate(-50%,-50%);transition:left .14s,width .14s,background .12s,box-shadow .12s; }
      #zones .v1814-group-shell .v20-setting-demo > em { display:inline-flex; }
      #zones .v1814-group-shell .v20-setting-demo[data-v21-timing-demo] { display:grid;height:auto;min-height:78px;gap:9px;padding:12px; }
      #zones .v1814-group-shell .v21-delay-preview-row { position:relative;z-index:1;display:grid;grid-template-columns:65px minmax(0,1fr) 57px;gap:8px;align-items:center;color:#fff;font-size:10px;line-height:1.3; }
      #zones .v1814-group-shell .v21-delay-preview-row i { display:block;height:9px;border-radius:99px;box-shadow:0 0 7px color-mix(in srgb,var(--v20-demo-colour),transparent 35%); }
      #zones .v1814-group-shell .v21-delay-preview-row span { text-align:right;font-weight:800; }
      #zones .v1814-group-shell [data-v20-demo="direction"] .v188-direction-track i { opacity:.48; }
      #zones .v1814-group-shell [data-v20-demo="direction"] .v188-direction-track b { background:var(--v20-demo-colour)!important;box-shadow:0 0 10px var(--v20-demo-colour)!important; }
      #zones .v1814-group-shell [data-v20-demo="mirror"] .v188-toggle-visual { color:var(--v20-demo-colour); }
      #zones .v1814-group-shell [data-v20-demo="mirror"] .v188-toggle-visual i { background:var(--v20-demo-paint);opacity:.45; }
      #zones .v1814-group-shell [data-v20-demo="mirror"][aria-pressed="true"] .v188-toggle-visual i { opacity:.9;box-shadow:0 0 7px var(--v20-demo-colour); }

      @media(max-width:620px) {
        #zones .v1814-group-shell .animation-setting-section { padding:10px; }
        #zones .v1814-group-shell .animation-setting-grid,
        #zones .v1814-group-shell .advanced-panel .animation-settings { grid-template-columns:minmax(0,1fr)!important; }
        #zones .v1814-group-shell .control.v20-has-direct {
          grid-template-columns:minmax(0,1fr) minmax(72px,82px)!important;
          grid-template-rows:auto 40px!important;
          column-gap:8px!important;row-gap:5px!important;
          min-height:76px!important;
        }
        #zones .v1814-group-shell .control.v20-has-direct > label:not(.v20-direct-value) { grid-column:1/-1!important;grid-row:1!important; }
        #zones .v1814-group-shell .control.v20-has-direct > input[type="range"] { grid-column:1!important;grid-row:2!important; }
        #zones .v1814-group-shell .control.v20-has-direct > .v20-direct-value { grid-column:2!important;grid-row:2!important;height:38px; }
        #zones .v1814-group-shell .direction-route-tabs,
        #zones .v1814-group-shell .rgbw-direction { grid-template-columns:minmax(0,1fr)!important; }
        #zones .v1814-group-shell .v188-direction-option { grid-template-columns:62px minmax(0,1fr)!important;min-width:0; }
        #zones .v1814-group-shell .v188-direction-track { width:62px; }
        #zones .v1814-group-shell .setting-toggle { align-items:flex-start; }
        #zones .v1814-group-shell .setting-toggle > span { overflow-wrap:anywhere; }
      }
      @media(max-width:380px) {
        #zones .v1814-group-shell .animation-setting-section { margin-inline:-2px; }
        #zones .v1814-group-shell .advanced-panel { padding-inline:9px; }
        #zones .v1814-group-shell .v20-direct-value { padding-inline:5px!important; }
        #zones .v1814-group-shell .v20-direct-number { font-size:12px; }
      }
      @media(prefers-reduced-motion:reduce) {
        #zones .v1814-group-shell [data-v20-demo="direction"] .v188-direction-track b { animation:none!important;left:48%; }
      }
    `;
    document.head.appendChild(style);
  }

  const observer = new MutationObserver((records) => {
    if (records.some((record) => [...record.addedNodes].some((node) => node.nodeType === 1 && (
      node.matches?.('#zones,.v1814-group-shell,#modalBody,.v1811-settings-card') ||
      node.querySelector?.('#zones .v1814-group-shell,#modalBody[data-v1811="animation-library"],.v1811-settings-card')
    )))) queueEnhance();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.v20VisualPolish = Object.freeze({
    version: '20.0',
    enhance,
    sync: syncSettingVisuals,
    totalPhysicalPixels,
    descriptionFor: window.effectDescription
  });

  enhance(document);
})();
