/* Aluvision V20 professional animation catalogue.
   This is an additive compatibility layer. Every recipe below reuses a wire
   variant and renderer that already exists in the V20.5.3 SPI/RGBW firmware;
   no browser-only animation IDs are introduced. */
(function animationCatalogueModule(factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined' && typeof document !== 'undefined') api.install(window, document);
})(function createAnimationCatalogue() {
  'use strict';

  const PROTOCOL = 18;
  const SPI_VARIANT_MAX = 120;
  const RGBW_VARIANT_MAX = 24;

  const copy = (nl, en, fr, de) => ({ nl, en, fr, de });
  const spi = (name, engine, category, variant, defaults, description, previewSpeed, tunnel = false) => ({
    name, engine, category, variant, defaults, description, previewSpeed, tunnel
  });
  const rgbw = (name, engine, variant, colors, settings, defaults, description, previewSpeed, options = {}) => ({
    name, engine, variant, colors, settings, defaults, description, previewSpeed, ...options
  });

  /* These are recipes, not new receiver algorithms. Different useful results
     come from the existing engine plus a deliberately chosen parameter set. */
  const SPI_RECIPES = [
    spi('Precision Prism', 'CHASE', 'Professional', 112,
      { speed: 16, widthPixels: 1, smooth: 100, objectCount: 3, spacing: 74, direction: 'right' },
      copy('Drie fijne lichtpunten met exact één pixel als minimum', 'Three precise runners with a true one-pixel minimum', 'Trois points lumineux précis, dès un pixel', 'Drei präzise Lichtpunkte ab genau einem Pixel'), 49),
    spi('Exhibition Runner', 'CHASE', 'Professional', 112,
      { speed: 32, widthPixels: 5, smooth: 94, objectCount: 1, spacing: 100, direction: 'right' },
      copy('Een heldere brede lichtloper voor standen en contouren', 'A bright, wide runner for stands and contours', 'Un large trait lumineux pour stands et contours', 'Ein breiter Lichtläufer für Messestände und Konturen'), 53),
    spi('Silk Comet Trail', 'COMET', 'Dynamic', 113,
      { speed: 9, widthPixels: 4, smooth: 100, trailLength: 94, objectCount: 1, spacing: 100, direction: 'right' },
      copy('Een rustige komeet met een uitzonderlijk lange zachte staart', 'A calm comet with an extra-long soft trail', 'Une comète calme avec une très longue traînée', 'Ein ruhiger Komet mit besonders langem, weichem Schweif'), 44),
    spi('Product Spotlight Sweep', 'SCANNER', 'Professional', 114,
      { speed: 8, widthPixels: 8, smooth: 100, trailLength: 46, bounce: true, mirror: false, direction: 'right' },
      copy('Een brede spot beweegt rustig heen en terug', 'A broad spotlight moves gently back and forth', 'Un large faisceau se déplace doucement en aller-retour', 'Ein breiter Lichtspot bewegt sich ruhig hin und her'), 42),
    spi('Crystal Dust', 'SPARKLE', 'Ambient', 115,
      { speed: 18, widthPixels: 1, smooth: 42, randomness: 26, objectCount: 3 },
      copy('Fijne, rustige fonkelpunten zonder druk beeld', 'Fine, calm sparkles without visual clutter', 'De fins scintillements calmes et lisibles', 'Feine, ruhige Lichtpunkte ohne unruhiges Bild'), 46),
    spi('Calm Liquid Bands', 'WAVE', 'Flow', 117,
      { speed: 7, widthPixels: 7, smooth: 100, objectCount: 2, spacing: 82, spread: 56, direction: 'right' },
      copy('Twee brede kleurbanden vloeien continu door de LED Line', 'Two broad colour bands flow continuously through the LED Line', 'Deux larges bandes colorées traversent la LED Line', 'Zwei breite Farbbänder fließen durch die LED Line'), 43),
    spi('Evening Mirror Pulse', 'MIRROR', 'Pulse', 118,
      { speed: 7, widthPixels: 6, smooth: 100, objectCount: 2, spread: 82, bounce: true, direction: 'right' },
      copy('Symmetrische zachte pulsen voor een rustig architecturaal beeld', 'Soft symmetrical pulses for a calm architectural look', 'Des pulsations douces et symétriques', 'Weiche symmetrische Pulse für ein ruhiges Lichtbild'), 42),
    spi('Fine Confetti Drift', 'FLOW', 'Ambient', 119,
      { speed: 10, widthPixels: 1, smooth: 96, objectCount: 6, spacing: 78, spread: 62, direction: 'right' },
      copy('Veel kleine kleuraccenten zweven vloeiend over de lijn', 'Many small colour accents drift smoothly across the line', 'De petits accents colorés glissent sur la ligne', 'Viele kleine Farbakzente gleiten weich über die Linie'), 48)
  ];

  const SPI_TUNNEL_RECIPES = [
    spi('Slow Halo Relay', 'BREATHE', 'Multi-line', 104,
      { speed: 6, smooth: 100, lineDelayMs: 600, direction: 'right' },
      copy('Een trage zachte halo reist rij per rij door de opstelling', 'A slow soft halo travels row by row through the installation', 'Un halo lent traverse les rangées une à une', 'Ein langsamer Halo wandert Reihe für Reihe'), 43, true),
    spi('Fast Depth Scan', 'SCANNER', 'Multi-line', 105,
      { speed: 30, smooth: 88, lineDelayMs: 80, direction: 'right' },
      copy('Een snelle volledige lichtlaag scant door de diepte', 'A fast complete layer of light scans through the depth', 'Une couche lumineuse rapide balaie la profondeur', 'Eine schnelle Lichtfläche scannt durch die Tiefe'), 58, true),
    spi('Slow Twin Wave', 'WAVE', 'Multi-line', 106,
      { speed: 7, smooth: 100, lineDelayMs: 420, direction: 'right' },
      copy('Twee rustige golven volgen elkaar door alle rijen', 'Two calm waves follow one another through all rows', 'Deux vagues calmes traversent toutes les rangées', 'Zwei ruhige Wellen laufen durch alle Reihen'), 45, true),
    spi('Brand Colour Passage', 'GRADIENT', 'Multi-line', 107,
      { speed: 7, smooth: 100, lineDelayMs: 520, direction: 'right' },
      copy('Merk-kleuren worden zacht van volledige lijn naar lijn doorgegeven', 'Brand colours pass softly from complete line to line', 'Les couleurs de marque passent doucement de ligne en ligne', 'Markenfarben werden weich von Linie zu Linie weitergereicht'), 45, true),
    spi('Deep Echo Passage', 'CASCADE', 'Multi-line', 108,
      { speed: 13, smooth: 98, spacing: 85, lineDelayMs: 320, direction: 'right' },
      copy('Iedere rij krijgt een diepe hoofdpuls met zachte echo', 'Each row receives a deep main pulse with a soft echo', 'Chaque rangée reçoit une impulsion avec un écho doux', 'Jede Reihe erhält einen Hauptpuls mit weichem Echo'), 48, true),
    spi('Soft Opening Curtain', 'CHASE', 'Multi-line', 109,
      { speed: 10, smooth: 100, lineDelayMs: 280, direction: 'right' },
      copy('Een lichtgordijn opent gelijkmatig over lijn na lijn', 'A light curtain opens evenly across line after line', 'Un rideau lumineux s’ouvre ligne après ligne', 'Ein Lichtvorhang öffnet sich Linie für Linie'), 47, true),
    spi('Wide Cross Sweep', 'MIRROR', 'Multi-line', 110,
      { speed: 10, widthPixels: 8, smooth: 100, lineDelayMs: 220, direction: 'right' },
      copy('Twee brede lichtkoppen kruisen elkaar door iedere rij', 'Two broad light heads cross through every row', 'Deux larges faisceaux se croisent dans chaque rangée', 'Zwei breite Lichtköpfe kreuzen sich in jeder Reihe'), 47, true),
    spi('Long Comet Passage', 'COMET', 'Multi-line', 111,
      { speed: 10, widthPixels: 5, smooth: 100, trailLength: 92, lineDelayMs: 360, direction: 'right' },
      copy('Een lange komeetstaart wordt soepel door alle rijen doorgegeven', 'A long comet trail passes smoothly through every row', 'Une longue traînée passe doucement dans toutes les rangées', 'Ein langer Kometenschweif läuft weich durch alle Reihen'), 47, true)
  ];

  const RGBW_RECIPES = [
    rgbw('Calm Warm Glow', 'BREATHE', 17, 1, ['speed', 'smooth', 'colors'],
      { speed: 5, smooth: 100 },
      copy('Een warme W+RGB-gloed over de volledige LED Line', 'A warm W+RGB glow across the complete LED Line', 'Une lueur chaude W+RVB sur toute la LED Line', 'Ein warmes W+RGB-Leuchten über die ganze LED Line'), 43,
      { icon: '◌', palette: { colorCount: 1, colors: ['#5a1e00'], whiteChannels: [255], rgbEnabled: [true], whiteEnabled: [true] } }),
    rgbw('Native White Glow', 'BREATHE', 17, 1, ['speed', 'smooth', 'colors'],
      { speed: 6, smooth: 100 },
      copy('Alleen het echte witte kanaal pulseert; RGB blijft uit', 'Only the native white channel breathes; RGB stays off', 'Seul le canal blanc pulse, le RVB reste éteint', 'Nur der echte Weißkanal pulsiert, RGB bleibt aus'), 44,
      { icon: '○', palette: { colorCount: 1, colors: ['#000000'], whiteChannels: [255], rgbEnabled: [false], whiteEnabled: [true], whiteOnly: true } }),
    rgbw('Soft Pastel Pulse', 'BREATHE', 18, 2, ['speed', 'smooth', 'colors'],
      { speed: 12, smooth: 98 },
      copy('Twee zachte RGB+W-pastelkleuren pulseren over de hele lijn', 'Two soft RGB+W pastel colours pulse across the whole line', 'Deux couleurs pastel RVB+W pulsent sur toute la ligne', 'Zwei weiche RGB+W-Pastellfarben pulsieren über die Linie'), 48,
      { variable: true, icon: '≋', palette: { colorCount: 2, colors: ['#ff6687', '#4fbfe8'], whiteChannels: [72, 64], rgbEnabled: [true, true], whiteEnabled: [true, true] } }),
    rgbw('Brand Hold Fade', 'GRADIENT', 19, 3, ['speed', 'smooth', 'hold', 'colors'],
      { speed: 6, smooth: 100, spacing: 76 },
      copy('Kleuren blijven duidelijk staan en faden daarna zacht verder', 'Colours hold clearly, then fade softly onward', 'Les couleurs restent puis passent doucement', 'Farben halten deutlich und blenden dann weich weiter'), 47,
      { variable: true, icon: '◐' }),
    rgbw('Show Double Flash', 'SPARKLE', 20, 2, ['speed', 'smooth', 'colors'],
      { speed: 18, smooth: 12 },
      copy('Twee korte volledige lichtflitsen per cyclus', 'Two short full-line flashes per cycle', 'Deux éclairs complets par cycle', 'Zwei kurze Vollblitze pro Zyklus'), 55,
      { variable: true, icon: '✶' }),
    rgbw('Slow Glow Passage', 'BREATHE', 21, 2, ['speed', 'smooth', 'lineDelayMs', 'direction', 'colors'],
      { speed: 6, smooth: 100, lineDelayMs: 520, direction: 'right' },
      copy('Volledige RGBW-lijnen lichten rustig na elkaar op', 'Complete RGBW lines glow gently one after another', 'Les lignes RGBW s’allument doucement l’une après l’autre', 'Ganze RGBW-Linien leuchten ruhig nacheinander'), 45,
      { variable: true, line: true, icon: '≿' }),
    rgbw('Deep Echo Relay', 'CASCADE', 22, 2, ['speed', 'smooth', 'hold', 'lineDelayMs', 'direction', 'colors'],
      { speed: 10, smooth: 98, spacing: 85, lineDelayMs: 360, direction: 'right' },
      copy('Iedere volledige lijn laat een langdurige zachte echo achter', 'Every complete line leaves a long, soft echo', 'Chaque ligne complète laisse un long écho doux', 'Jede ganze Linie hinterlässt ein langes, weiches Echo'), 47,
      { variable: true, line: true, icon: '◔' }),
    rgbw('Four Colour Passage', 'GRADIENT', 23, 4, ['speed', 'smooth', 'lineDelayMs', 'direction', 'colors'],
      { speed: 8, smooth: 100, lineDelayMs: 280, direction: 'right' },
      copy('Vier kleuren reizen vloeiend tussen volledige LED Lines', 'Four colours travel smoothly between complete LED Lines', 'Quatre couleurs circulent entre les LED Lines', 'Vier Farben wandern weich zwischen ganzen LED Lines'), 48,
      { variable: true, line: true, icon: '◉' }),
    rgbw('Fast Twin Passage', 'WAVE', 24, 3, ['speed', 'smooth', 'lineDelayMs', 'direction', 'colors'],
      { speed: 28, smooth: 90, lineDelayMs: 100, direction: 'right' },
      copy('Twee snelle lichtgolven lopen door de volledige lijnen', 'Two fast light waves run through the complete lines', 'Deux vagues rapides parcourent les lignes complètes', 'Zwei schnelle Lichtwellen laufen durch die ganzen Linien'), 58,
      { variable: true, line: true, icon: '≈' })
  ];

  const SPI_CAPABILITIES = {
    'Precision Prism': { width: true, smooth: true, background: true, direction: true, spacing: true, count: true, bounce: true, mirror: true },
    'Exhibition Runner': { width: true, smooth: true, background: true, direction: true, spacing: true, count: true, bounce: true, mirror: true },
    'Silk Comet Trail': { width: true, smooth: true, background: true, direction: true, spacing: true, count: true, trail: true, bounce: true },
    'Product Spotlight Sweep': { width: true, smooth: true, background: true, direction: true, trail: true, bounce: true, mirror: true },
    'Crystal Dust': { width: true, smooth: false, background: true, randomness: true, count: true },
    'Calm Liquid Bands': { width: true, smooth: true, background: true, direction: true, spacing: true, count: true, spread: true, bounce: true, mirror: true },
    'Evening Mirror Pulse': { width: true, smooth: true, background: true, direction: true, count: true, spread: true, bounce: true },
    'Fine Confetti Drift': { width: true, smooth: true, background: true, direction: true, spacing: true, count: true, spread: true, bounce: true, mirror: true }
  };

  const TUNNEL_CAPABILITIES = {
    104: {},
    105: {},
    106: {},
    107: {},
    108: { spacing: true },
    109: {},
    110: { width: true },
    111: { width: true, trail: true }
  };

  const allRecipes = [...SPI_RECIPES, ...SPI_TUNNEL_RECIPES, ...RGBW_RECIPES];
  const WIRE_CONTRACT = Object.freeze(Object.fromEntries(allRecipes.map((item) => [item.name, Object.freeze({
    protocol: PROTOCOL,
    receiver: RGBW_RECIPES.includes(item) ? 'RGBW' : 'SPI',
    engine: item.engine,
    variant: item.variant,
    firmwareChangeRequired: false
  })])));

  function validateContracts() {
    const names = new Set();
    const errors = [];
    allRecipes.forEach((item) => {
      if (names.has(item.name)) errors.push(`duplicate animation name: ${item.name}`);
      names.add(item.name);
      const contract = WIRE_CONTRACT[item.name];
      const limit = contract.receiver === 'RGBW' ? RGBW_VARIANT_MAX : SPI_VARIANT_MAX;
      if (!Number.isInteger(item.variant) || item.variant < 0 || item.variant > limit) {
        errors.push(`${item.name} uses unsupported ${contract.receiver} variant ${item.variant}`);
      }
      if (!item.engine || contract.engine !== item.engine || contract.protocol !== PROTOCOL) {
        errors.push(`${item.name} has an invalid wire contract`);
      }
    });
    return errors;
  }

  function install(win, doc) {
    if (win.AluvisionAnimationCatalogPro?.installed) return win.AluvisionAnimationCatalogPro;
    const runtime = win.AluvisionAnimationRuntime;
    if (!runtime) throw new Error('Aluvision animation runtime is unavailable');
    const errors = validateContracts();
    if (errors.length) throw new Error(errors.join('; '));

    const tupleFor = (item) => [item.name, item.engine, item.category, item.variant, { ...item.defaults }];
    const addSpi = (item) => {
      if (runtime.effects.some((candidate) => candidate[0] === item.name)) return runtime.effects.find((candidate) => candidate[0] === item.name);
      const tuple = tupleFor(item);
      runtime.effects.push(tuple);
      return tuple;
    };
    const addNamedTuple = (target, tuple) => {
      if (Array.isArray(target) && !target.some((candidate) => candidate[0] === tuple[0])) target.push(tuple);
    };
    const spiTuples = [...SPI_RECIPES, ...SPI_TUNNEL_RECIPES].map((item) => {
      const tuple = addSpi(item);
      if (item.tunnel) {
        addNamedTuple(runtime.multiLineEffects, tuple);
        addNamedTuple(runtime.tunnelSupplementalEffects, tuple);
      }
      return tuple;
    });

    RGBW_RECIPES.forEach((item) => {
      if (runtime.rgbwEffects.some((candidate) => candidate.name === item.name)) return;
      runtime.rgbwEffects.push({
        name: item.name,
        engine: item.engine,
        variant: item.variant,
        colors: item.colors,
        variable: Boolean(item.variable),
        line: Boolean(item.line),
        icon: item.icon || '◌',
        settings: [...item.settings],
        defaults: { ...item.defaults },
        description: { ...item.description }
      });
    });

    /* Variant 20 is a fixed double-flash renderer. Firmware does not consume a
       hold/spacing value for it, so do not advertise a slider that cannot work. */
    runtime.rgbwEffects.filter((item) => Number(item.variant) === 20).forEach((item) => {
      item.settings = (item.settings || []).filter((setting) => !['hold', 'spacing'].includes(setting));
      if (item.defaults) delete item.defaults.spacing;
    });

    const language = () => {
      try { return runtime.academyLanguage?.() || 'nl'; }
      catch (_) { return 'nl'; }
    };
    const translated = (value) => value?.[language()] || value?.en || value?.nl || '';
    const descriptions = new Map([...SPI_RECIPES, ...SPI_TUNNEL_RECIPES].map((item) => [item.name, item.description]));
    const previousDescription = runtime.effectDescription;
    const professionalDescription = (effect) => {
      const local = descriptions.get(effect?.[0]);
      return local ? translated(local) : previousDescription(effect);
    };
    runtime.effectDescription = professionalDescription;
    runtime.v1811EffectDescription = professionalDescription;

    const boolCapabilities = [
      'width', 'smooth', 'background', 'direction', 'spacing', 'count', 'objects',
      'trail', 'spread', 'randomness', 'bounce', 'mirror'
    ];
    const preciseCapabilities = (base, enabled = {}) => {
      const next = { ...base, speed: true };
      boolCapabilities.forEach((key) => { next[key] = false; });
      Object.entries(enabled).forEach(([key, value]) => { next[key] = Boolean(value); });
      next.objects = next.count;
      return next;
    };
    const previousCapabilities = runtime.effectCapabilities;
    const professionalCapabilities = (effect) => {
      const base = previousCapabilities(effect);
      const variant = Number(runtime.effectWireVariant(effect));
      /* Dedicated tunnel renderers are whole-row effects. Width is meaningful
         only for the cross heads and comet; mirror is baked into variant 110. */
      if (variant >= 104 && variant <= 111) {
        return preciseCapabilities(base, {
          ...TUNNEL_CAPABILITIES[variant], smooth: true, background: true, direction: true
        });
      }
      const local = SPI_CAPABILITIES[effect?.[0]];
      return local ? preciseCapabilities(base, local) : base;
    };
    runtime.effectCapabilities = professionalCapabilities;

    const rgbwPalettes = {
      'Calm Warm Glow': [['#5a1e00'], [255]],
      'Native White Glow': [['#000000'], [255]],
      'Soft Pastel Pulse': [['#ff6687', '#4fbfe8'], [72, 64]],
      'Brand Hold Fade': [['#ff4e44', '#ffb729', '#2ec89f'], [0, 0, 0]],
      'Show Double Flash': [['#ffffff', '#ff4e44'], [0, 0]],
      'Slow Glow Passage': [['#8067ff', '#23cbe3'], [0, 0]],
      'Deep Echo Relay': [['#ff544a', '#ffbd35'], [0, 0]],
      'Four Colour Passage': [['#ff544a', '#ffc23d', '#2dd09f', '#3a84ff'], [0, 0, 0, 0]],
      'Fast Twin Passage': [['#8067ff', '#23cbe3', '#ff544a'], [0, 0, 0]]
    };
    Object.assign(runtime.v18163RgbwDemoPalettes, rgbwPalettes);

    const safeColour = (value) => {
      if (Array.isArray(value)) return runtime.rgbHex(value);
      return String(value || '#ffffff');
    };
    const primeSpiDemos = () => {
      if (typeof win.effectPreviewState !== 'function') return;
      spiTuples.forEach((tuple) => {
        const recipe = [...SPI_RECIPES, ...SPI_TUNNEL_RECIPES].find((item) => item.name === tuple[0]);
        const state = win.effectPreviewState(tuple);
        Object.assign(state, recipe.defaults, {
          animation: recipe.name,
          engine: recipe.engine,
          variant: recipe.variant,
          speed: recipe.previewSpeed,
          brightness: 100,
          previewStartedAt: 0,
          catalogueDemo: true
        });
      });
    };
    primeSpiDemos();

    const primeRgbwDemos = () => {
      const defaultState = win.AluvisionRgbwRuntime?.defaultState;
      if (typeof defaultState !== 'function') return;
      RGBW_RECIPES.forEach((recipe) => {
        const source = rgbwPalettes[recipe.name] || [['#ffffff'], [0]];
        const colors = source[0].slice(0, 4);
        const whiteChannels = source[1].slice(0, 4);
        const count = Math.max(1, Math.min(4, recipe.colors));
        const state = defaultState({
          animation: recipe.name,
          engine: recipe.engine,
          variant: recipe.variant,
          colorCount: count,
          colors,
          whiteChannels,
          rgbEnabled: colors.map((colour, index) => colour !== '#000000' || !whiteChannels[index]),
          whiteEnabled: whiteChannels.map((value) => value > 0),
          brightness: 100,
          backgroundOn: false,
          previewStartedAt: 0,
          phaseMs: 0,
          ...recipe.defaults
        });
        if (recipe.palette) Object.assign(state, {
          ...recipe.palette,
          colors: [...recipe.palette.colors],
          whiteChannels: [...recipe.palette.whiteChannels],
          rgbEnabled: [...recipe.palette.rgbEnabled],
          whiteEnabled: [...recipe.palette.whiteEnabled]
        });
        state.speed = recipe.previewSpeed;
        state.catalogueDemo = true;
        runtime.v18163RgbwDemoCache.set(recipe.name, state);
      });
    };
    runtime.v18163RgbwDemoCache.clear();
    primeRgbwDemos();

    /* Honour the smart defaults declared by V20 RGBW effects. The older
       selector applied only engine-wide generic values, which made several
       visibly different catalogue choices start with identical motion. */
    const previousSetRgbwEffect = win.setRgbwEffect;
    if (typeof previousSetRgbwEffect === 'function') {
      win.setRgbwEffect = function setProfessionalRgbwEffect(name) {
        const selected = runtime.rgbwEffects.find((item) => item.name === name);
        const recipe = RGBW_RECIPES.find((item) => item.name === name);
        const before = runtime.group?.state?.animation;
        const result = previousSetRgbwEffect.apply(this, arguments);
        if (before === name || !selected || Number(selected.variant) < 17 || Number(selected.variant) > 24 || !runtime.group?.state) return result;
        const state = runtime.group.state;
        const defaults = recipe?.defaults || selected.defaults || {};
        ['speed', 'smooth', 'spacing', 'lineDelayMs', 'direction'].forEach((key) => {
          if (defaults[key] !== undefined) state[key] = defaults[key];
        });
        if (recipe?.palette) Object.assign(state, {
          ...recipe.palette,
          colors: [...recipe.palette.colors],
          whiteChannels: [...recipe.palette.whiteChannels],
          rgbEnabled: [...recipe.palette.rgbEnabled],
          whiteEnabled: [...recipe.palette.whiteEnabled]
        });
        state.previewStartedAt = (win.performance?.now?.() || Date.now()) / 1000;
        state.phaseMs = 0;
        /* One existing live-range update persists and dispatches the complete
           state; its transport queue coalesces the selection and this update. */
        if (typeof win.rgbwRange === 'function') win.rgbwRange('speed', state.speed, 'rgbw-speed-value');
        if (typeof win.renderModal === 'function') win.renderModal();
        return result;
      };
    }

    /* Whole-line variant 19 really consumes SPACING as its hold duration, even
       with one RGBW line. Add that one useful setting without exposing the
       ineffective variant-20 hold control removed above. */
    const previousGroupUi = win.groupUI;
    if (typeof previousGroupUi === 'function' && typeof doc.createElement === 'function') {
      win.groupUI = function groupUiWithRgbwHold() {
        const markup = previousGroupUi.apply(this, arguments);
        const current = runtime.group?.state;
        const item = runtime.rgbwEffect(current?.animation);
        if (typeof markup !== 'string' || !runtime.isRgbwGroup(runtime.group) || Number(item?.variant) !== 19 || !(item.settings || []).includes('hold')) return markup;
        const template = doc.createElement('template');
        template.innerHTML = markup;
        const root = template.content.firstElementChild;
        const controls = root?.querySelector('.v1811-settings-card .rgbw-live-controls');
        if (!controls || controls.querySelector("input[oninput*=\"rgbwRange('spacing'\"]")) return markup;
        const label = translated(copy('Kleur vasthouden', 'Colour hold', 'Maintien de la couleur', 'Farbe halten'));
        const detail = translated(copy('Kort overvloeien of de gekozen kleur langer laten staan', 'Blend immediately or hold the selected colour longer', 'Fondre directement ou maintenir la couleur plus longtemps', 'Sofort überblenden oder die Farbe länger halten'));
        const value = Math.max(0, Math.min(100, Number(current?.spacing ?? item.defaults?.spacing ?? 58)));
        controls.insertAdjacentHTML('beforeend', `<div class="rgbw-live-setting setting-visual-panel v1811-rgbw-setting v20-pro-hold-setting" data-v188-control="hold"><div><b>${label}</b><small>${detail}</small></div><div class="v188-control-visual v20-pro-hold-demo" data-v20-pro-demo="hold" aria-hidden="true"><span>${Array.from({ length: 14 }, () => '<i></i>').join('')}</span><em></em></div><input aria-label="${label}" type="range" min="0" max="100" value="${value}" oninput="rgbwRange('spacing',this.value,'rgbw-spacing-value')"><output id="rgbw-spacing-value">${value}%</output></div>`);
        return template.innerHTML;
      };
    }

    const rangeKind = (range) => {
      const id = String(range?.id || '').toLowerCase();
      const handler = range?.getAttribute?.('oninput') || '';
      const explicit = range?.dataset?.v20Setting || range?.dataset?.setting;
      const match = handler.match(/(?:rgbwRange|setAnimationSetting)\(['"]([^'"]+)/);
      const token = String(explicit || match?.[1] || id).toLowerCase();
      if (token.includes('smooth')) return 'smooth';
      if (token.includes('speed')) return 'speed';
      if (token.includes('bgbrightness') || token === 'background') return 'background';
      if (token.includes('brightness') || token.includes('intensity')) return 'brightness';
      if (token.includes('trail')) return 'trail';
      if (token.includes('random')) return 'randomness';
      if (token.includes('spacing') || token.includes('hold')) return 'hold';
      return token;
    };
    const rangePanel = (range) => range?.closest?.('.setting-visual-panel,.speed-panel,.rgbw-live-setting,.control') || null;
    const currentPalette = () => {
      const state = runtime.group?.state || {};
      const count = Math.max(1, Math.min(4, Number(state.colorCount) || state.colors?.length || 1));
      return Array.from({ length: count }, (_, index) => {
        try { return safeColour(runtime.visibleStateColor(state, index)); }
        catch (_) { return safeColour(state.colors?.[index] || state.colors?.[0]); }
      });
    };
    const makeDemo = (panel, kind) => {
      if (!panel || panel.querySelector(`[data-v20-pro-demo="${kind}"]`)) return panel?.querySelector(`[data-v20-pro-demo="${kind}"]`) || null;
      const demo = doc.createElement('div');
      demo.className = `v188-control-visual v20-pro-setting-demo v20-pro-${kind}-demo`;
      demo.dataset.v20ProDemo = kind;
      demo.setAttribute('aria-hidden', 'true');
      demo.innerHTML = `<span>${Array.from({ length: 18 }, () => '<i></i>').join('')}</span><b></b><em></em>`;
      const header = panel.querySelector(':scope > .row,:scope > div:first-child,:scope > label');
      if (header) header.insertAdjacentElement('afterend', demo);
      else panel.prepend(demo);
      return demo;
    };
    const updateRangeVisual = (range) => {
      const kind = rangeKind(range);
      const panel = rangePanel(range);
      if (!panel) return;
      const min = Number(range.min) || 0;
      const max = Number(range.max) || 100;
      const value = Math.max(min, Math.min(max, Number(range.value) || 0));
      const level = (value - min) / Math.max(1, max - min);
      const palette = currentPalette();
      let stage = panel.querySelector('.v20-smoothness-live,.v188-control-visual,.v1812-rgbw-control-visual');
      if (!stage && ['trail', 'randomness', 'hold'].includes(kind)) stage = makeDemo(panel, kind);
      if (!stage) return;
      stage.dataset.v20ProKind = kind;
      stage.dataset.v20ProValue = String(Math.round(value));
      stage.dataset.v20ProPalette = palette.join(',');
      stage.style.setProperty('--v20-pro-colour', palette[0]);
      stage.style.setProperty('--v20-pro-palette', palette.length > 1 ? `linear-gradient(90deg,${palette.join(',')})` : palette[0]);
      stage.style.setProperty('--v20-pro-level', `${Math.round(level * 100)}%`);
      if (kind === 'speed') {
        const duration = 5.8 - level * 5.15;
        stage.style.setProperty('--v20-pro-speed-duration', `${duration.toFixed(2)}s`);
        const runner = stage.querySelector(':scope > b');
        if (runner) runner.style.animationDuration = `${duration.toFixed(2)}s`;
      }
      if (kind === 'smooth') stage.style.setProperty('--v20-pro-softness', `${Math.round(level * 14)}px`);
      if (kind === 'brightness' || kind === 'background') stage.style.setProperty('--v20-pro-luminance', String(.10 + level * .90));
      const cells = [...stage.querySelectorAll(':scope > span > i')];
      if (kind === 'trail') {
        const lit = Math.max(1, Math.round(level * cells.length));
        cells.forEach((cell, index) => {
          const distance = cells.length - 1 - index;
          const active = distance < lit;
          cell.style.background = palette[index % palette.length];
          cell.style.opacity = active ? String(.14 + .86 * (1 - distance / Math.max(1, lit))) : '.06';
        });
      }
      if (kind === 'randomness') {
        const lit = Math.max(1, Math.round(1 + level * (cells.length - 1)));
        cells.forEach((cell, index) => {
          const active = ((index * 7 + 3) % cells.length) < lit;
          cell.style.background = palette[index % palette.length];
          cell.style.opacity = active ? '1' : '.07';
        });
      }
      if (kind === 'hold') {
        const held = Math.max(1, Math.round(level * cells.length));
        cells.forEach((cell, index) => {
          cell.style.background = palette[index % palette.length];
          cell.style.opacity = index < held ? '1' : String(.14 + .60 * (index - held) / Math.max(1, cells.length - held));
        });
      }
      const readout = stage.querySelector(':scope > em');
      if (readout && ['trail', 'randomness', 'hold'].includes(kind)) {
        const label = `${Math.round(value)}%`;
        /* textContent replaces a text node and therefore emits childList. Keep
           this idempotent so the observer cannot schedule itself forever. */
        if (readout.textContent !== label) readout.textContent = label;
      }
    };
    const enhanceSettings = (root = doc) => {
      root.querySelectorAll?.('#zones .v1814-group-shell .v1811-settings-card input[type="range"]').forEach(updateRangeVisual);
    };
    doc.addEventListener?.('input', (event) => {
      if (event.target?.matches?.('#zones .v1814-group-shell .v1811-settings-card input[type="range"]')) updateRangeVisual(event.target);
    }, true);
    if (typeof win.MutationObserver === 'function') {
      const observer = new win.MutationObserver((records) => {
        /* Ignore text-node replacements and unrelated app activity. In
           particular this keeps a readout update from recursively waking the
           catalogue observer at 100% CPU. */
        const settingsAdded = records.some((record) => [...(record.addedNodes || [])].some((node) =>
          node?.nodeType === 1 && (
            /* Only react to a newly mounted settings surface. Demos created by
               this module are already fully painted in the same call. */
            node.matches?.('#zones,.v1814-group-shell,.v1811-settings-card') ||
            node.querySelector?.('#zones .v1814-group-shell,.v1811-settings-card')
          )
        ));
        if (settingsAdded) enhanceSettings(doc);
      });
      observer.observe(doc.documentElement, { childList: true, subtree: true });
    }
    enhanceSettings(doc);

    const api = Object.freeze({
      installed: true,
      version: '20.6.2',
      protocol: PROTOCOL,
      spiVariantMax: SPI_VARIANT_MAX,
      rgbwVariantMax: RGBW_VARIANT_MAX,
      spiRecipeNames: SPI_RECIPES.map((item) => item.name),
      tunnelRecipeNames: SPI_TUNNEL_RECIPES.map((item) => item.name),
      rgbwRecipeNames: RGBW_RECIPES.map((item) => item.name),
      wireContract: WIRE_CONTRACT,
      capabilityContract: Object.freeze({ spi: { ...SPI_CAPABILITIES }, tunnel: { ...TUNNEL_CAPABILITIES } }),
      enhanceSettings,
      validateContracts
    });
    win.AluvisionAnimationCatalogPro = api;
    doc.documentElement.dataset.animationCatalogPro = api.version;
    doc.documentElement.dataset.spiAnimationCount = String(runtime.effects.length);
    doc.documentElement.dataset.rgbwAnimationCount = String(runtime.rgbwEffects.length);
    return api;
  }

  return Object.freeze({
    PROTOCOL,
    SPI_VARIANT_MAX,
    RGBW_VARIANT_MAX,
    SPI_RECIPES,
    SPI_TUNNEL_RECIPES,
    RGBW_RECIPES,
    SPI_CAPABILITIES,
    TUNNEL_CAPABILITIES,
    WIRE_CONTRACT,
    validateContracts,
    install
  });
});
