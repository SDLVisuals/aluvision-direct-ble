/* Aluvision V20 smoothness presentation.
 *
 * Customer previews use one shared animation clock. This layer does not add a
 * JavaScript frame loop: it only reshapes that clock for the existing preview
 * renderer and uses a compositor-driven rail in the Smoothness control.
 */
(function v20SmoothnessModule(root, factory) {
  'use strict';

  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root?.document) api.install(root);
})(typeof window === 'undefined' ? null : window, function createV20Smoothness() {
  'use strict';

  const STYLE_ID = 'v20-smoothness-style';
  const PANEL_SELECTOR = [
    '#zones .v1814-group-shell .v18153-smooth-panel',
    '#zones .v1814-group-shell .rgbw-live-setting[data-v188-control="smooth"]',
    '#zones .v1814-group-shell .rgbw-live-setting[data-v20-setting="smooth"]',
    '#zones .v1814-group-shell [data-v1817-rgbw-setting="smooth"]'
  ].join(',');
  const PANEL_SCOPE = `:is(${PANEL_SELECTOR})`;
  const MOTION_ENGINES = new Set([
    'CHASE', 'COMET', 'SCANNER', 'DUAL', 'MIRROR', 'MINIMAL',
    'ALTERNATE', 'SEQUENCE', 'CASCADE', 'WAVE', 'FLOW', 'LINE_WAVE',
    'BREATHE', 'GRADIENT', 'WARM', 'ALL'
  ]);
  const COPY = {
    nl: {
      description: 'Bepaalt hoe de animatie tussen LED-posities beweegt: 0% springt zichtbaar per stap, 100% glijdt continu.',
      fixedSpeed: 'Vaste demosnelheid',
      low: '0% · duidelijke stappen',
      high: '100% · continu vloeiend',
      choices: 'Snelle keuzes voor vloeiendheid',
      crisp: 'Blokkerig',
      natural: 'Natuurlijk',
      fluid: 'Vloeiend',
      stepped: 'zichtbare LED-stappen',
      mixed: 'stappen worden zachter',
      continuous: 'continue zachte beweging'
    },
    en: {
      description: 'Controls motion between LED positions: 0% visibly jumps in steps, 100% glides continuously.',
      fixedSpeed: 'Fixed demo speed',
      low: '0% · clear steps',
      high: '100% · continuously smooth',
      choices: 'Quick smoothness choices',
      crisp: 'Stepped',
      natural: 'Natural',
      fluid: 'Smooth',
      stepped: 'visible LED steps',
      mixed: 'steps becoming softer',
      continuous: 'continuous soft motion'
    },
    fr: {
      description: 'Règle le mouvement entre les positions LED : 0 % avance par pas visibles, 100 % glisse en continu.',
      fixedSpeed: 'Vitesse de démo fixe',
      low: '0 % · pas visibles',
      high: '100 % · fluide en continu',
      choices: 'Choix rapides de fluidité',
      crisp: 'Par pas',
      natural: 'Naturel',
      fluid: 'Fluide',
      stepped: 'pas LED visibles',
      mixed: 'pas de plus en plus doux',
      continuous: 'mouvement doux et continu'
    },
    de: {
      description: 'Bestimmt die Bewegung zwischen LED-Positionen: 0 % springt sichtbar, 100 % gleitet durchgehend.',
      fixedSpeed: 'Feste Demogeschwindigkeit',
      low: '0 % · klare Schritte',
      high: '100 % · durchgehend weich',
      choices: 'Schnellauswahl für Weichheit',
      crisp: 'Stufig',
      natural: 'Natürlich',
      fluid: 'Fließend',
      stepped: 'sichtbare LED-Schritte',
      mixed: 'Schritte werden weicher',
      continuous: 'durchgehend weiche Bewegung'
    }
  };

  function clamp(value, minimum = 0, maximum = 100) {
    const number = Number(value);
    return Math.max(minimum, Math.min(maximum, Number.isFinite(number) ? number : minimum));
  }

  function smoothMix(value) {
    const normalized = clamp(value) / 100;
    // Keep the lower half deliberately stepped for a useful A/B comparison,
    // then converge quickly toward true continuous motion. This mirrors the
    // receiver curve, so 75% already feels fluid and 100% remains exact.
    return normalized < .5
      ? 4 * normalized * normalized * normalized
      : 1 - 4 * (1 - normalized) * (1 - normalized) * (1 - normalized);
  }

  function positiveModulo(value, divisor) {
    return ((value % divisor) + divisor) % divisor;
  }

  /* At 0%, motion remains on a physical LED centre for a complete step. As
     Smoothness increases, the exact continuous phase is mixed back in. The
     stride is capped so the difference stays legible on long installations. */
  function interpolateLedPhase(totalPhase, smoothness, pixelCount, maximumStops = 32) {
    const phase = Number(totalPhase);
    if (!Number.isFinite(phase)) return 0;
    const blend = smoothMix(smoothness);
    if (blend >= 1) return phase;
    const pixels = Math.max(1, Math.round(Number(pixelCount) || 1));
    const stops = Math.max(2, Math.round(Number(maximumStops) || 32));
    const stride = Math.max(1, Math.ceil(pixels / stops));
    const cycle = Math.floor(phase);
    const withinCycle = positiveModulo(phase, 1);
    const firstPixelInStep = Math.floor((withinCycle * pixels) / stride) * stride;
    const snappedPixel = Math.min(pixels - 0.5, firstPixelInStep + 0.5);
    const snapped = cycle + snappedPixel / pixels;
    return snapped + (phase - snapped) * blend;
  }

  /* Whole-line fades and tunnel relays do not have a moving pixel centre.
     Their receiver contract presents the shared clock in sixteen phase slots
     at 0%, then restores the exact continuous phase toward 100%. */
  function interpolateCyclePhase(totalPhase, smoothness, phaseSteps = 16) {
    const phase = Number(totalPhase);
    if (!Number.isFinite(phase)) return 0;
    const blend = smoothMix(smoothness);
    if (blend >= 1) return phase;
    const steps = Math.max(2, Math.round(Number(phaseSteps) || 16));
    const cycle = Math.floor(phase);
    const withinCycle = positiveModulo(phase, 1);
    const stepped = cycle + Math.floor(withinCycle * steps) / steps;
    return stepped + (phase - stepped) * blend;
  }

  function adjustedPreviewTime(state, time, pixelCount, cyclesPerSecond, maximumStops = 32) {
    const now = Number(time);
    const started = Number(state?.previewStartedAt);
    const rate = Number(cyclesPerSecond);
    const smoothness = clamp(state?.smooth ?? 100);
    if (!Number.isFinite(now) || !Number.isFinite(started) || !Number.isFinite(rate) || rate <= 0 || smoothness >= 100) return time;
    const elapsed = Math.max(0, now - started);
    const phaseOffset = (Number(state?.phaseMs) || 0) / 1000;
    const continuousPhase = phaseOffset + elapsed * rate;
    const displayPhase = interpolateLedPhase(continuousPhase, smoothness, pixelCount, maximumStops);
    return started + Math.max(0, (displayPhase - phaseOffset) / rate);
  }

  function adjustedCyclePreviewTime(state, time, cyclesPerSecond, phaseSteps = 16) {
    const now = Number(time);
    const started = Number(state?.previewStartedAt);
    const rate = Number(cyclesPerSecond);
    const smoothness = clamp(state?.smooth ?? 100);
    if (!Number.isFinite(now) || !Number.isFinite(started) || !Number.isFinite(rate) || rate <= 0 || smoothness >= 100) return time;
    const elapsed = Math.max(0, now - started);
    const phaseOffset = (Number(state?.phaseMs) || 0) / 1000;
    const continuousPhase = phaseOffset + elapsed * rate;
    const displayPhase = interpolateCyclePhase(continuousPhase, smoothness, phaseSteps);
    return started + Math.max(0, (displayPhase - phaseOffset) / rate);
  }

  function shouldShapeSpiMotion(state) {
    const variant = Number(state?.variant);
    const engine = String(state?.engine || '').toUpperCase();
    if (variant === 102 || engine === 'STATIC' || engine === 'SPARKLE') return false;
    if (variant >= 98 && variant <= 120) return true;
    return MOTION_ENGINES.has(engine);
  }

  function usesCyclePhaseSteps(state) {
    const variant = Number(state?.variant);
    if ((variant >= 98 && variant <= 101) || (variant >= 104 && variant <= 108)) return true;
    return ['BREATHE', 'GRADIENT', 'WARM', 'ALL'].includes(String(state?.engine || '').toUpperCase());
  }

  function rgbwCyclesPerSecond(state) {
    const speed = clamp(state?.speed);
    if (speed <= 0) return 0;
    const normalized = speed / 100;
    return String(state?.engine || '').toUpperCase() === 'SPARKLE'
      ? 0.5 + normalized * normalized * 11.5
      : 0.003 + normalized * normalized * 1.5;
  }

  function languageFor(doc) {
    const language = String(doc?.documentElement?.lang || 'nl').slice(0, 2).toLowerCase();
    return COPY[language] ? language : 'nl';
  }

  function copyFor(doc) {
    return COPY[languageFor(doc)];
  }

  function modeText(level, copy) {
    const value = Math.round(clamp(level));
    if (value <= 5) return `${value}% · ${copy.stepped}`;
    if (value >= 95) return `${value}% · ${copy.continuous}`;
    return `${value}% · ${copy.mixed}`;
  }

  function rgbCss(value) {
    if (!Array.isArray(value)) return String(value || '#ffffff');
    const channels = value.slice(0, 3).map((channel) => Math.round(clamp(channel, 0, 255)));
    return `rgb(${channels.join(',')})`;
  }

  function selectedPalette(runtime, state) {
    const count = Math.max(1, Math.min(4, Math.round(Number(state?.colorCount) || state?.colors?.length || 1)));
    return Array.from({ length: count }, (_, index) => {
      try {
        const channels = runtime?.enabledRgbwPreview?.(state, index);
        if (Array.isArray(channels) && channels.length >= 3) return rgbCss(channels);
      } catch (_) {}
      try {
        const visible = runtime?.visibleStateColor?.(state, index);
        if (visible) return rgbCss(visible);
      } catch (_) {}
      return rgbCss(state?.colors?.[index] || state?.colors?.[0] || '#ffffff');
    });
  }

  function ledCells(count, className = '') {
    return Array.from({ length: count }, (_, index) => `<i${className && (index === 0 || index === count - 1) ? ` class="${className}"` : ''}></i>`).join('');
  }

  function demoMarkup(copy) {
    return `<div class="v20-smoothness-live" aria-hidden="true">
      <span class="v20-smoothness-leds">${ledCells(18)}</span>
      <span class="v20-smoothness-motion v20-smoothness-step"><b>${ledCells(5)}</b></span>
      <span class="v20-smoothness-motion v20-smoothness-flow"><b>${ledCells(5, 'edge')}</b></span>
    </div>
    <div class="v18153-smooth-demo-legend"><span>${copy.fixedSpeed}</span><span data-smooth-demo-value></span></div>`;
  }

  function smoothInput(panel) {
    return panel?.querySelector?.('#tune-smooth,input[oninput*="rgbwRange(\'smooth\'"],input[data-v20-setting="smooth"],input[type="range"]') || null;
  }

  function currentGroup(runtime) {
    try {
      return runtime?.group || null;
    } catch (_) {
      return null;
    }
  }

  function installRuntime(root) {
    const runtime = root.AluvisionAnimationRuntime;
    if (!runtime || runtime.__v20SmoothnessRuntimeInstalled) return;

    const baseAnimationPixel = runtime.animationPixel;
    if (typeof baseAnimationPixel === 'function') {
      const shapedAnimationPixel = function v20SmoothAnimationPixel(state, u, time, index = 0, pixelCount = 0) {
        let displayTime = time;
        if (shouldShapeSpiMotion(state) && clamp(state?.smooth ?? 100) < 100) {
          const pixels = Math.max(1, Math.round(Number(pixelCount) || Number(state?.groupPixels) || 60));
          const rate = Number(runtime.animationCyclesPerSecond?.(state?.speed ?? 0)) || 0;
          displayTime = usesCyclePhaseSteps(state)
            ? adjustedCyclePreviewTime(state, time, rate, 16)
            : adjustedPreviewTime(state, time, pixels, rate, 32);
        }
        return baseAnimationPixel(state, u, displayTime, index, pixelCount);
      };
      shapedAnimationPixel.__v20SmoothnessBase = baseAnimationPixel;
      runtime.animationPixel = shapedAnimationPixel;
    }

    const baseRgbwSample = runtime.rgbwPreviewSample;
    if (typeof baseRgbwSample === 'function') {
      const shapedRgbwSample = function v20SmoothRgbwSample(state, lineIndex, lineCount, time) {
        const smoothness = clamp(state?.smooth ?? 100);
        const displayTime = smoothness < 100
          ? adjustedCyclePreviewTime(state, time, rgbwCyclesPerSecond(state), 16)
          : time;
        return baseRgbwSample(state, lineIndex, lineCount, displayTime);
      };
      shapedRgbwSample.__v20SmoothnessBase = baseRgbwSample;
      runtime.rgbwPreviewSample = shapedRgbwSample;
    }

    Object.defineProperty(runtime, '__v20SmoothnessRuntimeInstalled', {
      value: true,
      configurable: false,
      enumerable: false
    });
  }

  function ensureStage(doc, panel, copy) {
    let stage = panel.querySelector('.v18153-smooth-demo');
    if (!stage) {
      stage = doc.createElement('div');
      stage.className = 'v188-control-visual v18153-smooth-demo v20-smoothness-injected';
      const range = smoothInput(panel);
      if (range) range.insertAdjacentElement('beforebegin', stage);
      else panel.append(stage);
    }
    if (!stage.querySelector('.v20-smoothness-live')) {
      stage.querySelector('.v18153-smooth-canvas')?.setAttribute('hidden', '');
      stage.querySelector('.v18153-smooth-demo-legend')?.remove();
      stage.insertAdjacentHTML('beforeend', demoMarkup(copy));
    }
    return stage;
  }

  function ensureChoices(doc, panel, copy) {
    if (panel.querySelector('.v18153-smooth-presets')) return;
    const choices = doc.createElement('div');
    choices.className = 'v18153-smooth-presets v20-smoothness-presets';
    choices.setAttribute('role', 'group');
    choices.setAttribute('aria-label', copy.choices);
    choices.innerHTML = [
      [0, '▮', copy.crisp],
      [60, '◐', copy.natural],
      [100, '≈', copy.fluid]
    ].map(([value, icon, label]) => `<button type="button" data-v20-smooth-choice="${value}"><i>${icon}</i><span><b>${label}</b><small>${value}%</small></span></button>`).join('');
    const control = smoothInput(panel)?.closest('.control') || smoothInput(panel);
    if (control) control.insertAdjacentElement('afterend', choices);
    else panel.append(choices);
  }

  function updatePanel(root, runtime, panel) {
    const doc = root.document;
    const copy = copyFor(doc);
    const input = smoothInput(panel);
    if (!input) return;
    const level = Math.round(clamp(input.value));
    const blend = smoothMix(level);
    const state = currentGroup(runtime)?.state || {};
    const palette = selectedPalette(runtime, state);
    const stage = ensureStage(doc, panel, copy);
    ensureChoices(doc, panel, copy);
    panel.dataset.v20SmoothnessEnhanced = 'true';
    stage.style.setProperty('--v20-smooth-flow', blend.toFixed(4));
    stage.style.setProperty('--v20-smooth-step', (1 - blend).toFixed(4));
    stage.style.setProperty('--v20-smooth-softness', (0.25 + blend * 1.15).toFixed(3) + 'px');
    stage.style.setProperty('--v20-smooth-primary', palette[0] || '#ffffff');
    stage.classList.toggle('v20-smoothness-reverse', state.direction === 'left');
    stage.dataset.v20SmoothnessLevel = String(level);
    stage.dataset.smoothnessMode = level <= 5 ? 'stepped' : level >= 95 ? 'continuous' : 'mixed';

    stage.querySelectorAll('.v20-smoothness-leds i').forEach((cell, index) => {
      const colour = palette[index % palette.length];
      cell.style.background = colour;
      cell.style.boxShadow = `inset 0 0 0 1px #ffffff1f,0 0 5px color-mix(in srgb,${colour},transparent 76%)`;
    });
    stage.querySelectorAll('.v20-smoothness-motion b').forEach((runner) => {
      [...runner.children].forEach((cell, index) => {
        const colour = palette[index % palette.length];
        cell.style.background = colour;
        cell.style.boxShadow = `0 0 9px color-mix(in srgb,${colour},transparent 34%)`;
      });
    });

    const valueLabel = stage.querySelector('[data-smooth-demo-value]');
    if (valueLabel) valueLabel.textContent = modeText(level, copy);
    const description = panel.querySelector('.setting-description') || panel.querySelector(':scope > div:first-child small');
    if (description) description.textContent = copy.description;
    const limits = panel.querySelector('.v18153-smooth-limits');
    if (limits) {
      const labels = limits.querySelectorAll('span');
      if (labels[0]) labels[0].textContent = copy.low;
      if (labels[1]) labels[1].textContent = copy.high;
    }
    const meaning = panel.querySelector('#tune-smooth-meaning');
    if (meaning) meaning.textContent = modeText(level, copy).replace(/^\d+%\s*·\s*/, '');
    panel.querySelectorAll('[data-smooth-preset],[data-v20-smooth-choice]').forEach((button) => {
      button.type = 'button';
      const preset = Number(button.dataset.smoothPreset ?? button.dataset.v20SmoothChoice);
      const active = preset === 0 ? level <= 20 : preset === 60 ? level > 20 && level < 80 : level >= 80;
      button.classList.toggle('on', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function installStyle(doc) {
    if (doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.dataset.releaseLayer = 'smoothness';
    style.textContent = `
      ${PANEL_SCOPE}{min-width:0;max-width:100%;overflow:hidden}
      ${PANEL_SCOPE}[data-v20-smoothness-enhanced="true"]>.v1812-rgbw-control-visual{display:none!important}
      ${PANEL_SCOPE} .v18153-smooth-demo.v188-control-visual{position:relative;display:block;width:100%;max-width:100%;height:82px;margin:10px 0 8px;padding:0;border:1px solid #ffffff2d;border-radius:14px;background:linear-gradient(145deg,#343834,#171918);overflow:hidden;isolation:isolate;box-sizing:border-box}
      ${PANEL_SCOPE} .v18153-smooth-demo:before,${PANEL_SCOPE} .v18153-smooth-demo:after{display:none!important;content:none!important}
      ${PANEL_SCOPE} .v18153-smooth-canvas,${PANEL_SCOPE} .v18153-smooth-canvas[hidden]{display:none!important}
      ${PANEL_SCOPE} .v20-smoothness-live{position:absolute;z-index:2;left:9px;right:9px;top:7px;height:43px;border:1px solid #ffffff18;border-radius:10px;background:#0b0d0c;overflow:hidden;box-shadow:inset 0 1px 5px #000b}
      ${PANEL_SCOPE} .v20-smoothness-leds{position:absolute;inset:8px 6px;display:grid;grid-template-columns:repeat(18,minmax(0,1fr));gap:3px;min-width:0}
      ${PANEL_SCOPE} .v20-smoothness-leds i{display:block;min-width:0;height:25px;border-radius:3px;opacity:.16;filter:saturate(.82);transition:background .12s,box-shadow .12s}
      ${PANEL_SCOPE} .v20-smoothness-motion{position:absolute;inset:8px 6px;pointer-events:none}
      ${PANEL_SCOPE} .v20-smoothness-motion>b{position:absolute;left:0;top:0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:3px;width:27%;height:25px;transform:translate3d(-120%,0,0);animation:v20SmoothnessTravel 3s linear infinite;will-change:transform}
      ${PANEL_SCOPE} .v20-smoothness-motion i{display:block;min-width:0;border-radius:3px;outline:1px solid #ffffff45;transition:background .12s,box-shadow .12s}
      ${PANEL_SCOPE} .v20-smoothness-step{opacity:var(--v20-smooth-step,0);transition:opacity .09s}
      ${PANEL_SCOPE} .v20-smoothness-step>b{animation-timing-function:steps(14,end);filter:none}
      ${PANEL_SCOPE} .v20-smoothness-flow{opacity:var(--v20-smooth-flow,1);transition:opacity .09s;mix-blend-mode:screen}
      ${PANEL_SCOPE} .v20-smoothness-flow>b{animation-timing-function:linear;filter:blur(var(--v20-smooth-softness,.8px)) drop-shadow(0 0 7px var(--v20-smooth-primary,#fff))}
      ${PANEL_SCOPE} .v20-smoothness-flow i.edge{opacity:.32}
      ${PANEL_SCOPE} .v20-smoothness-reverse .v20-smoothness-motion>b{animation-direction:reverse}
      ${PANEL_SCOPE} .v18153-smooth-demo-legend{position:absolute;z-index:3;left:9px;right:9px;bottom:5px;display:grid;grid-template-columns:minmax(0,.75fr) minmax(0,1.25fr);align-items:center;gap:7px;padding:0;color:#d9dcd8;font-size:7px;font-weight:900;line-height:1.15;letter-spacing:.28px;text-transform:uppercase}
      ${PANEL_SCOPE} .v18153-smooth-demo-legend span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      ${PANEL_SCOPE} .v18153-smooth-demo-legend span:last-child{text-align:right;color:#fff}
      ${PANEL_SCOPE} .v20-smoothness-injected{grid-column:1/-1!important}
      ${PANEL_SCOPE} .v20-smoothness-presets{grid-column:1/-1!important}
      ${PANEL_SCOPE} .v18153-smooth-presets button span{min-width:0}
      ${PANEL_SCOPE} .v18153-smooth-limits span{min-width:0;max-width:48%;line-height:1.25}
      @keyframes v20SmoothnessTravel{from{transform:translate3d(-120%,0,0)}to{transform:translate3d(410%,0,0)}}
      @media(max-width:430px){
        ${PANEL_SCOPE} .v18153-smooth-demo.v188-control-visual{height:80px}
        ${PANEL_SCOPE} .v20-smoothness-live{left:7px;right:7px}
        ${PANEL_SCOPE} .v20-smoothness-leds,${PANEL_SCOPE} .v20-smoothness-motion{left:5px;right:5px;gap:2px}
        ${PANEL_SCOPE} .v20-smoothness-leds{gap:2px}
        ${PANEL_SCOPE} .v20-smoothness-motion>b{gap:2px;width:29%}
        ${PANEL_SCOPE} .v18153-smooth-demo-legend{left:7px;right:7px;font-size:6.5px;letter-spacing:.18px}
        ${PANEL_SCOPE} .v18153-smooth-presets{grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}
        ${PANEL_SCOPE} .v18153-smooth-presets button{min-width:0;padding:6px 5px}
      }
      @media(max-width:350px){
        ${PANEL_SCOPE} .v20-smoothness-leds{grid-template-columns:repeat(15,minmax(0,1fr))}
        ${PANEL_SCOPE} .v20-smoothness-leds i:nth-child(n+16){display:none}
        ${PANEL_SCOPE} .v18153-smooth-demo-legend{grid-template-columns:minmax(0,.58fr) minmax(0,1.42fr);font-size:6px}
        ${PANEL_SCOPE} .v18153-smooth-presets button{display:block;text-align:center}
        ${PANEL_SCOPE} .v18153-smooth-presets button>i{display:none}
      }
      @media(prefers-reduced-motion:reduce){
        ${PANEL_SCOPE} .v20-smoothness-motion>b{animation:none!important;transform:translate3d(135%,0,0)}
        ${PANEL_SCOPE} .v20-smoothness-step{transform:translateX(-7px)}
      }
    `;
    doc.head.append(style);
  }

  function install(root) {
    const doc = root.document;
    if (!doc || root.__aluvisionV20Smoothness) return;
    root.__aluvisionV20Smoothness = true;
    installStyle(doc);
    installRuntime(root);
    const runtime = root.AluvisionAnimationRuntime;
    let updateQueued = false;
    const updateAll = () => {
      updateQueued = false;
      doc.querySelectorAll(PANEL_SELECTOR).forEach((panel) => updatePanel(root, runtime, panel));
    };
    const queueUpdate = () => {
      if (updateQueued) return;
      updateQueued = true;
      queueMicrotask(updateAll);
    };

    doc.addEventListener('input', (event) => {
      const panel = event.target?.closest?.(PANEL_SELECTOR);
      if (panel && event.target === smoothInput(panel)) updatePanel(root, runtime, panel);
      else if (event.target?.closest?.('#zones .v1814-group-shell')) queueUpdate();
    }, true);

    doc.addEventListener('click', (event) => {
      const choice = event.target?.closest?.('[data-v20-smooth-choice]');
      if (choice) {
        const panel = choice.closest(PANEL_SELECTOR);
        const input = smoothInput(panel);
        if (input) {
          input.value = String(Math.round(clamp(choice.dataset.v20SmoothChoice)));
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        return;
      }
      if (event.target?.closest?.('#zones .v1814-group-shell')) queueUpdate();
    }, true);

    const observer = new MutationObserver((records) => {
      const relevant = records.some((record) => {
        if (record.type === 'attributes') return [
          'data-smoothness', 'data-palette', 'data-v20-palette', 'data-v20-setting',
          'data-v188-control', 'data-v1817-rgbw-setting'
        ].includes(record.attributeName);
        return [...record.addedNodes].some((node) => node.nodeType === 1 && (
          node.matches?.(PANEL_SELECTOR) || node.querySelector?.(PANEL_SELECTOR)
        ));
      });
      if (relevant) queueUpdate();
    });
    observer.observe(doc.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        'data-smoothness', 'data-palette', 'data-v20-palette', 'data-v20-setting',
        'data-v188-control', 'data-v1817-rgbw-setting'
      ]
    });

    ['setEffect', 'setRgbwEffect', 'effectInlineWheelPick', 'effectInlineBrightness',
      'effectInlineRgbw', 'effectInlineHex', 'effectInlineQuick', 'toggleEffectInlineRgb',
      'toggleEffectInlineWhite', 'setEffectInlineRgbwMode', 'v1815SetChannelValue',
      'v1815ToggleChannel'].forEach((name) => {
      const original = root[name];
      if (typeof original !== 'function' || original.__v20SmoothnessWrapped) return;
      const wrapped = function v20SmoothnessUpdateWrapper() {
        const result = original.apply(this, arguments);
        queueUpdate();
        if (result && typeof result.finally === 'function') result.finally(queueUpdate);
        return result;
      };
      wrapped.__v20SmoothnessWrapped = true;
      wrapped.__v20SmoothnessOriginal = original;
      root[name] = wrapped;
    });

    doc.documentElement.dataset.smoothnessPreview = 'stepped-to-continuous';
    updateAll();
  }

  return Object.freeze({
    version: '20.5.0-smoothness.2',
    clamp,
    smoothMix,
    interpolateLedPhase,
    interpolateCyclePhase,
    adjustedPreviewTime,
    adjustedCyclePreviewTime,
    shouldShapeSpiMotion,
    usesCyclePhaseSteps,
    rgbwCyclesPerSecond,
    modeText,
    selectedPalette,
    demoMarkup,
    install
  });
});
