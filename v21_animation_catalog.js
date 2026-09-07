/*
 * Aluvision Lighting V21 - canonical animation catalogue and pure previews.
 *
 * Last-layer module: it replaces V20 alias cards by one canonical wire entry
 * per effect.  It has no dependency on the DOM and is testable in Node/JXA.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AluvisionV21AnimationCatalog = api;
  if (root.window === root && root.AluvisionAnimationRuntime) api.install(root);
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = '21.0.8';
  var PROTOCOL = 18;

  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
    return Object.freeze(value);
  }
  function clamp(value, minimum, maximum, fallback) {
    var parsed = Number(value);
    if (!Number.isFinite(parsed)) parsed = fallback == null ? minimum : fallback;
    return Math.max(minimum, Math.min(maximum, parsed));
  }
  function mod1(value) { return ((value % 1) + 1) % 1; }
  function smoothstep(value) { var n = clamp(value, 0, 1, 0); return n * n * (3 - 2 * n); }
  function smootherstep(value) {
    var n = clamp(value, 0, 1, 0);
    return n * n * n * (n * (n * 6 - 15) + 10);
  }
  function circularDistance(a, b) { var distance = Math.abs(a - b); return Math.min(distance, 1 - distance); }
  function copy(nl, en, fr, de) { return Object.freeze({ nl: nl, en: en, fr: fr, de: de }); }
  function slot(rgb, white) { return Object.freeze({ rgb: rgb.toUpperCase(), white: white || 0 }); }

  var CAPABILITY_KEYS = Object.freeze([
    'speed', 'width', 'smooth', 'background', 'direction', 'spacing', 'count',
    'trail', 'spread', 'randomness', 'bounce', 'mirror', 'lineDelayMs', 'colors'
  ]);

  function capabilities(enabled) {
    var result = {};
    CAPABILITY_KEYS.forEach(function (key) { result[key] = false; });
    (enabled || []).forEach(function (key) { result[key] = true; });
    return Object.freeze(result);
  }

  function freezeEffect(effect) {
    effect.defaults = deepFreeze(effect.defaults);
    effect.capabilities = capabilities(effect.capabilities);
    effect.description = Object.freeze(effect.description);
    return Object.freeze(effect);
  }

  function spi(name, variant, scene, category, defaults, enabled, formula, description, tunnel) {
    return freezeEffect({
      id: 'spi-' + variant, receiverType: 'SPI', name: name, variant: variant,
      scene: scene, engine: scene, category: category, defaults: defaults,
      capabilities: enabled, previewFormula: formula, tunnel: Boolean(tunnel),
      description: description
    });
  }

  var SPI_TUNNELS = Object.freeze([
    spi('Tunnel Halo', 104, 'BREATHE', 'Tunnel', {
      speed: 12, smooth: 98, widthPixels: 6, objectCount: 1, trailLength: 0,
      spread: 45, randomness: 0, lineDelayMs: 260, direction: 'right', brightness: 70,
      colorCount: 2, palette: [slot('#783CFF', 0), slot('#000000', 255)], backgroundOn: false
    }, ['speed', 'smooth', 'direction', 'lineDelayMs', 'colors'], 'spi-tunnel-halo-v1',
    copy('Een zachte halo reist lijn voor lijn door de tunnel', 'A soft halo travels line by line through the tunnel', 'Un halo doux traverse le tunnel ligne par ligne', 'Ein weicher Halo wandert Linie für Linie durch den Tunnel'), true),
    spi('Depth Scanner', 105, 'SCANNER', 'Tunnel', {
      speed: 16, smooth: 95, widthPixels: 4, objectCount: 1, trailLength: 0,
      spread: 30, randomness: 0, lineDelayMs: 180, direction: 'right', brightness: 70,
      colorCount: 2, palette: [slot('#00BEFF', 0), slot('#000000', 255)], backgroundOn: false
    }, ['speed', 'smooth', 'direction', 'lineDelayMs', 'colors'], 'spi-depth-scanner-v1',
    copy('Een smalle lichtlaag scant door de diepte', 'A narrow light layer scans through the depth', 'Une fine couche lumineuse balaie la profondeur', 'Eine schmale Lichtfläche scannt durch die Tiefe'), true),
    spi('Double Tunnel Wave', 106, 'WAVE', 'Tunnel', {
      speed: 14, smooth: 97, widthPixels: 5, objectCount: 2, trailLength: 0,
      spread: 55, randomness: 0, lineDelayMs: 150, direction: 'right', brightness: 70,
      colorCount: 3, palette: [slot('#783CFF', 0), slot('#00DCC8', 0), slot('#FF6428', 0)], backgroundOn: false
    }, ['speed', 'smooth', 'direction', 'lineDelayMs', 'colors'], 'spi-double-tunnel-wave-v1',
    copy('Twee golven volgen elkaar door alle rijen', 'Two waves follow one another through every row', 'Deux vagues se suivent dans toutes les rangées', 'Zwei Wellen folgen einander durch alle Reihen'), true),
    spi('Colour Relay', 107, 'GRADIENT', 'Tunnel', {
      speed: 11, smooth: 99, widthPixels: 8, objectCount: 1, trailLength: 0,
      spread: 70, randomness: 0, lineDelayMs: 300, direction: 'right', brightness: 70,
      colorCount: 4, palette: [slot('#FF503C', 0), slot('#FFC83C', 0), slot('#2DD09F', 0), slot('#328CFF', 0)], backgroundOn: false
    }, ['speed', 'smooth', 'direction', 'lineDelayMs', 'colors'], 'spi-colour-relay-v1',
    copy('Iedere rij geeft zijn kleur vloeiend door', 'Every row passes its colour smoothly onward', 'Chaque rangée transmet doucement sa couleur', 'Jede Reihe gibt ihre Farbe weich weiter'), true),
    spi('Tunnel Echo', 108, 'CASCADE', 'Tunnel', {
      speed: 16, smooth: 94, widthPixels: 5, objectCount: 2, trailLength: 42,
      spread: 50, randomness: 0, spacing: 62, lineDelayMs: 220, direction: 'right', brightness: 70,
      colorCount: 2, palette: [slot('#FF5A32', 0), slot('#328CFF', 0)], backgroundOn: false
    }, ['speed', 'smooth', 'direction', 'spacing', 'lineDelayMs', 'colors'], 'spi-tunnel-echo-v1',
    copy('Een hoofdpuls laat per rij een zachte echo achter', 'A main pulse leaves a soft echo on each row', 'Une impulsion principale laisse un écho par rangée', 'Ein Hauptpuls hinterlässt pro Reihe ein weiches Echo'), true),
    spi('Curtain Sweep', 109, 'CHASE', 'Tunnel', {
      speed: 15, smooth: 96, widthPixels: 4, objectCount: 1, trailLength: 0,
      spread: 50, randomness: 0, lineDelayMs: 180, direction: 'right', brightness: 70,
      colorCount: 2, palette: [slot('#0096FF', 0), slot('#000000', 255)], backgroundOn: false
    }, ['speed', 'width', 'smooth', 'direction', 'lineDelayMs', 'colors'], 'spi-curtain-sweep-v1',
    copy('Een gordijn van licht opent rij na rij', 'A curtain of light opens row by row', 'Un rideau de lumière s’ouvre rangée après rangée', 'Ein Lichtvorhang öffnet sich Reihe für Reihe'), true),
    spi('Cross Tunnel', 110, 'MIRROR', 'Tunnel', {
      speed: 14, smooth: 96, widthPixels: 3, objectCount: 2, trailLength: 0,
      spread: 45, randomness: 0, lineDelayMs: 180, direction: 'right', brightness: 70,
      colorCount: 2, palette: [slot('#783CFF', 0), slot('#00DCC8', 0)], backgroundOn: false
    }, ['speed', 'width', 'smooth', 'direction', 'lineDelayMs', 'colors'], 'spi-cross-tunnel-v1',
    copy('Twee lichtpunten kruisen symmetrisch door iedere rij', 'Two light points cross symmetrically through every row', 'Deux points lumineux se croisent dans chaque rangée', 'Zwei Lichtpunkte kreuzen sich symmetrisch durch jede Reihe'), true),
    spi('Tunnel Comet', 111, 'COMET', 'Tunnel', {
      speed: 18, smooth: 95, widthPixels: 3, objectCount: 1, trailLength: 72,
      spread: 45, randomness: 10, lineDelayMs: 200, direction: 'right', brightness: 70,
      colorCount: 2, palette: [slot('#FFFFFF', 0), slot('#FF641E', 0)], backgroundOn: false
    }, ['speed', 'width', 'smooth', 'direction', 'trail', 'lineDelayMs', 'colors'], 'spi-tunnel-comet-v1',
    copy('Een komeet met staart loopt vertraagd door iedere rij', 'A tailed comet runs through every row with a delay', 'Une comète traverse chaque rangée avec retard', 'Ein Komet läuft verzögert durch jede Reihe'), true),
    spi('Diagonal Depth', 128, 'WAVE', 'Tunnel', {
      speed: 20, smooth: 100, widthPixels: 3, objectCount: 2, lineDelayMs: 320,
      direction: 'right', brightness: 70, colorCount: 2,
      palette: [slot('#287AFF', 0), slot('#EE42C5', 0)], backgroundOn: false
    }, ['speed', 'width', 'smooth', 'count', 'direction', 'lineDelayMs', 'colors'], 'spi-diagonal-depth-v1',
    copy('Tegengestelde diagonalen kruisen lijn voor lijn door de tunnel', 'Opposing diagonal stripes cross each tunnel row', 'Des diagonales opposées traversent les rangées', 'Gegenläufige Diagonalen kreuzen die Tunnelreihen'), true)
  ]);

  var SPI_GENERAL = Object.freeze([
    spi('Edge Reveal', 112, 'CHASE', 'Reveal', {
      speed: 24, smooth: 92, widthPixels: 3, objectCount: 1, trailLength: 0,
      spread: 20, randomness: 0, brightness: 70, colorCount: 2,
      palette: [slot('#FF9628', 0), slot('#000000', 255)], backgroundOn: false, direction: 'right'
    }, ['speed', 'width', 'smooth', 'direction', 'colors'], 'spi-edge-reveal-v1',
    copy('Licht vult de lijn vanaf één rand en trekt daarna schoon terug', 'Light fills from one edge, then withdraws cleanly', 'La lumière remplit depuis un bord puis se retire', 'Licht füllt die Linie vom Rand und zieht sich sauber zurück')),
    spi('Center Reveal', 113, 'CHASE', 'Reveal', {
      speed: 22, smooth: 94, widthPixels: 4, objectCount: 1, trailLength: 0,
      spread: 20, randomness: 0, brightness: 70, colorCount: 2,
      palette: [slot('#0096FF', 0), slot('#000000', 255)], backgroundOn: false, direction: 'right'
    }, ['speed', 'width', 'smooth', 'colors'], 'spi-center-reveal-v1',
    copy('De lijn opent symmetrisch vanuit het midden', 'The line opens symmetrically from its centre', 'La ligne s’ouvre symétriquement depuis son centre', 'Die Linie öffnet sich symmetrisch aus der Mitte')),
    spi('Aurora Drift', 114, 'WAVE', 'Ambient', {
      speed: 12, smooth: 100, widthPixels: 8, objectCount: 3, trailLength: 35,
      spread: 65, randomness: 20, brightness: 70, colorCount: 3,
      palette: [slot('#2350FF', 0), slot('#BE23FF', 0), slot('#00D287', 0)],
      background: slot('#000008', 0), backgroundBrightness: 18, backgroundOn: true, direction: 'right'
    }, ['speed', 'smooth', 'spread', 'background', 'colors'], 'spi-aurora-drift-v1',
    copy('Drie langzaam verschuivende lichtgordijnen mengen zonder herhaling', 'Three drifting light curtains mix without obvious repetition', 'Trois rideaux lumineux dérivent sans répétition visible', 'Drei Lichtvorhänge driften ohne sichtbare Wiederholung')),
    spi('Dual Comet', 115, 'COMET', 'Dynamic', {
      speed: 30, smooth: 96, widthPixels: 3, objectCount: 2, trailLength: 48,
      spread: 45, randomness: 10, brightness: 70, colorCount: 2,
      palette: [slot('#000000', 255), slot('#FF6E12', 0)], backgroundOn: false, direction: 'right'
    }, ['speed', 'width', 'smooth', 'trail', 'direction', 'colors'], 'spi-dual-comet-v1',
    copy('Twee komeetkoppen bewegen tegengesteld met eigen staarten', 'Two comet heads counter-rotate with independent trails', 'Deux comètes tournent en sens opposé', 'Zwei Kometen bewegen sich gegenläufig')),
    spi('Interference Wave', 116, 'WAVE', 'Wave', {
      speed: 18, smooth: 94, widthPixels: 5, objectCount: 3, trailLength: 25,
      spread: 60, randomness: 15, brightness: 70, colorCount: 2,
      palette: [slot('#00BEFF', 0), slot('#962DFF', 0)],
      background: slot('#000006', 0), backgroundBrightness: 12, backgroundOn: true, direction: 'right'
    }, ['speed', 'smooth', 'count', 'spread', 'background', 'colors'], 'spi-interference-wave-v1',
    copy('Twee tegengestelde golven vormen een levend interferentiepatroon', 'Opposing waves form a living interference pattern', 'Deux vagues opposées forment des interférences vivantes', 'Gegenläufige Wellen bilden ein lebendiges Interferenzmuster')),
    spi('Meteor', 117, 'COMET', 'Dynamic', {
      speed: 34, smooth: 92, widthPixels: 2, objectCount: 1, trailLength: 58,
      spread: 30, randomness: 45, brightness: 70, colorCount: 2,
      palette: [slot('#000000', 255), slot('#FF5F0C', 0)], backgroundOn: false, direction: 'right'
    }, ['speed', 'width', 'smooth', 'trail', 'direction', 'randomness', 'colors'], 'spi-meteor-v1',
    copy('Een heldere kern trekt een korrelige, exponentieel uitdovende staart', 'A bright core pulls a granular, exponentially fading wake', 'Un noyau brillant entraîne une traînée granuleuse', 'Ein heller Kern zieht einen körnig ausklingenden Schweif')),
    spi('Firefly Field', 118, 'SPARKLE', 'Ambient', {
      speed: 16, smooth: 98, widthPixels: 2, objectCount: 6, trailLength: 20,
      spread: 55, randomness: 63, brightness: 70, colorCount: 2,
      palette: [slot('#000000', 255), slot('#FF9623', 0)], backgroundOn: false, direction: 'right'
    }, ['speed', 'width', 'smooth', 'count', 'randomness', 'colors'], 'spi-firefly-field-v1',
    copy('Vaste lichtpuntjes pulseren rustig en onafhankelijk', 'Stable light points pulse softly and independently', 'Des points fixes pulsent doucement et indépendamment', 'Feste Lichtpunkte pulsieren weich und unabhängig')),
    spi('Ripple', 119, 'WAVE', 'Wave', {
      speed: 22, smooth: 96, widthPixels: 2, objectCount: 2, trailLength: 25,
      spread: 45, randomness: 10, brightness: 70, colorCount: 2,
      palette: [slot('#1E64FF', 0), slot('#00DCFF', 0)], backgroundOn: false, direction: 'right'
    }, ['speed', 'width', 'smooth', 'count', 'colors'], 'spi-ripple-v1',
    copy('Gepaarde ringen groeien vanuit het midden naar buiten', 'Paired rings expand from the centre outwards', 'Des anneaux jumelés grandissent depuis le centre', 'Gepaarte Ringe wachsen aus der Mitte nach außen')),
    spi('Warm Contour Flow', 120, 'COMET', 'Professional', {
      speed: 45, smooth: 100, widthPixels: 4, objectCount: 1, trailLength: 36,
      spread: 0, randomness: 0, brightness: 100, colorCount: 1,
      palette: [slot('#5A1E00', 255)], backgroundOn: false, direction: 'right'
    }, ['speed', 'width', 'smooth', 'trail', 'direction', 'colors'], 'spi-warm-contour-flow-v1',
    copy('Een gekalibreerde warm-witte lichtband met zacht hoofd en staart', 'A calibrated warm-white ribbon with a soft head and tail', 'Un ruban blanc chaud calibré avec tête et traînée douces', 'Ein kalibriertes warmweißes Lichtband mit weichem Kopf und Schweif')),
    spi('Blackout Reveal', 121, 'FLOW', 'Reveal', {
      speed: 35, smooth: 85, widthPixels: 8, spacing: 20, objectCount: 1, trailLength: 60,
      spread: 20, randomness: 0, brightness: 70, colorCount: 2,
      palette: [slot('#FFFFFF', 0), slot('#2478FF', 0)], backgroundOn: false, direction: 'right'
    }, ['speed', 'width', 'spacing', 'trail', 'smooth', 'direction', 'colors'], 'spi-blackout-reveal-v1',
    copy('Een donkere uitsparing onthult de kleur opnieuw met een lange zachte rand', 'A dark cut-out reveals the colour again with a long soft edge', 'Une découpe sombre révèle à nouveau la couleur avec un long bord doux', 'Eine dunkle Aussparung enthüllt die Farbe mit einer langen weichen Kante')),
    spi('Ribbon Weave', 122, 'WAVE', 'Wave', {
      speed: 28, smooth: 92, widthPixels: 3, spacing: 52, objectCount: 2, trailLength: 45,
      spread: 45, randomness: 0, brightness: 70, colorCount: 3,
      palette: [slot('#FF3D8E', 0), slot('#3C7CFF', 0), slot('#25E0C0', 0)], backgroundOn: false, direction: 'right'
    }, ['speed', 'width', 'spacing', 'trail', 'smooth', 'direction', 'colors'], 'spi-ribbon-weave-v1',
    copy('Twee smalle kleurribbons vlechten zichtbaar over en onder elkaar', 'Two narrow colour ribbons visibly weave over and under each other', 'Deux rubans colorés étroits s’entrelacent', 'Zwei schmale Farbbänder verweben sich sichtbar')),
    spi('Prism Stream', 123, 'GRADIENT', 'Gradient', {
      speed: 24, smooth: 96, widthPixels: 12, spacing: 36, objectCount: 1, trailLength: 70,
      spread: 70, randomness: 0, brightness: 70, colorCount: 4,
      palette: [slot('#FF3048', 0), slot('#FFC52E', 0), slot('#20D68F', 0), slot('#376CFF', 0)], backgroundOn: false, direction: 'right'
    }, ['speed', 'width', 'spacing', 'trail', 'smooth', 'direction', 'spread', 'colors'], 'spi-prism-stream-v1',
    copy('Een brede prismafilm stroomt als een continue kleurband vooruit', 'A broad prism film flows forward as a continuous colour band', 'Un large film prismatique s’écoule en bande continue', 'Ein breiter Prismenfilm fließt als durchgehendes Farbband vorwärts')),
    spi('Segment March', 124, 'CHASE', 'Chase', {
      speed: 45, smooth: 30, widthPixels: 4, spacing: 40, objectCount: 4, trailLength: 35,
      spread: 35, randomness: 0, brightness: 70, colorCount: 2,
      palette: [slot('#FFFFFF', 0), slot('#FF432E', 0)], backgroundOn: false, direction: 'right'
    }, ['speed', 'width', 'spacing', 'trail', 'smooth', 'direction', 'colors'], 'spi-segment-march-v1',
    copy('Korte harde lichtsegmenten marcheren met vaste tussenruimte', 'Short crisp light segments march at fixed spacing', 'De courts segments lumineux avancent à intervalle fixe', 'Kurze klare Lichtsegmente marschieren mit festem Abstand')),
    spi('Ember Drift', 125, 'SPARKLE', 'Ambient', {
      speed: 16, smooth: 88, widthPixels: 2, spacing: 64, objectCount: 6, trailLength: 78,
      spread: 55, randomness: 64, brightness: 70, colorCount: 2,
      palette: [slot('#FFB02E', 0), slot('#E63B0B', 0)], background: slot('#090100', 0),
      backgroundBrightness: 8, backgroundOn: true, direction: 'right'
    }, ['speed', 'width', 'spacing', 'trail', 'smooth', 'direction', 'randomness', 'background', 'colors'], 'spi-ember-drift-v1',
    copy('Warme vonkjes zweven traag vooruit en doven met een korrelige staart', 'Warm sparks drift slowly forward and fade with a granular tail', 'Des étincelles chaudes dérivent et s’éteignent en traînée', 'Warme Funken treiben langsam vorwärts und glimmen körnig aus')),
    spi('Orbit Cluster', 126, 'CHASE', 'Dynamic', {
      speed: 24, smooth: 100, widthPixels: 3, objectCount: 3, spacing: 60,
      direction: 'right', brightness: 70, colorCount: 3,
      palette: [slot('#FF6136', 0), slot('#23DCC7', 0), slot('#4169FF', 0)], backgroundOn: false
    }, ['speed', 'width', 'smooth', 'count', 'spacing', 'direction', 'colors'], 'spi-orbit-cluster-v1',
    copy('Een cluster lichtpunten draait rond en opent en sluit onderweg', 'A cluster of light cores orbits while expanding and contracting', 'Un groupe lumineux tourne en se dilatant', 'Ein Cluster aus Lichtpunkten kreist und dehnt sich aus')),
    spi('Shutter Bloom', 127, 'BREATHE', 'Reveal', {
      speed: 16, smooth: 100, widthPixels: 12, objectCount: 3, spacing: 55,
      brightness: 70, colorCount: 3,
      palette: [slot('#F6B43B', 0), slot('#EE5285', 0), slot('#734DFF', 0)], backgroundOn: false
    }, ['speed', 'width', 'smooth', 'count', 'spacing', 'colors'], 'spi-shutter-bloom-v1',
    copy('Meerdere lichtvensters openen vanuit hun midden op eigen ritme', 'Several light windows open from their centres at staggered intervals', 'Plusieurs fenêtres lumineuses s’ouvrent depuis leur centre', 'Mehrere Lichtfenster öffnen sich versetzt aus ihrer Mitte')),
    spi('Colour Carriages', 129, 'CHASE', 'Chase', {
      speed: 42, smooth: 100, widthPixels: 4, objectCount: 4, spacing: 24,
      direction: 'right', brightness: 70, colorCount: 4,
      palette: [slot('#FF553B', 0), slot('#FFD24C', 0), slot('#29DCA8', 0), slot('#487CFF', 0)], backgroundOn: false
    }, ['speed', 'width', 'smooth', 'count', 'spacing', 'direction', 'background', 'colors'], 'spi-colour-carriages-v1',
    copy('Een trein van gekleurde lichtblokken met instelbare breedte en afstand', 'A train of coloured light blocks with adjustable width and gap', 'Un train de blocs colorés à largeur et espacement réglables', 'Ein Zug farbiger Lichtblöcke mit einstellbarer Breite und Abstand')),
    spi('Ripple Cascade', 130, 'WAVE', 'Wave', {
      speed: 34, smooth: 100, widthPixels: 2, objectCount: 3, spacing: 42,
      direction: 'right', brightness: 70, colorCount: 3,
      palette: [slot('#29CBFF', 0), slot('#7854FF', 0), slot('#ED5CB5', 0)], backgroundOn: false
    }, ['speed', 'width', 'smooth', 'count', 'spacing', 'direction', 'background', 'colors'], 'spi-ripple-cascade-v1',
    copy('Gekleurde rimpels groeien vanuit het midden; keer om om ze naar binnen te laten lopen', 'Coloured ripples grow from the centre; reverse to draw them inward', 'Des ondulations colorées partent du centre ou reviennent vers lui', 'Farbige Wellen wachsen aus der Mitte oder laufen nach innen')),
    spi('Meteor Rain', 131, 'COMET', 'Dynamic', {
      speed: 28, smooth: 100, widthPixels: 2, objectCount: 3, spacing: 38, trailLength: 24,
      direction: 'right', brightness: 70, colorCount: 3,
      palette: [slot('#FF8844', 0), slot('#35D8ED', 0), slot('#CA64FF', 0)], backgroundOn: false
    }, ['speed', 'width', 'smooth', 'count', 'spacing', 'trail', 'direction', 'background', 'colors'], 'spi-meteor-rain-v1',
    copy('Meerdere gekleurde kometen halen elkaar in met zachte, instelbare staarten', 'Several coloured comets overtake one another with adjustable soft trails', 'Plusieurs comètes colorées se dépassent avec des traînées douces', 'Mehrere farbige Kometen überholen sich mit weichen Schweifen'))
  ]);

  var SPI_EFFECTS = Object.freeze(SPI_TUNNELS.concat(SPI_GENERAL).sort(function (a, b) { return a.variant - b.variant; }));

  function rgbw(name, variant, engine, kind, colors, defaults, formula, description) {
    return Object.freeze({
      id: 'rgbw-' + engine.toLowerCase() + '-' + variant, receiverType: 'RGBW', name: name,
      variant: variant, engine: engine, scene: engine, kind: kind, colors: colors,
      defaults: deepFreeze(defaults), previewFormula: formula,
      spatialResolution: 'logical-line', description: Object.freeze(description)
    });
  }

  var RGBW_EFFECTS = Object.freeze([
    rgbw('Static Color', 0, 'STATIC', 'whole-line', 1, { speed: 0, smooth: 100 }, 'rgbw-static-v1', copy('Eén egale kleur over de volledige lijn', 'One uniform colour across the complete line', 'Une couleur uniforme sur toute la ligne', 'Eine gleichmäßige Farbe über die ganze Linie')),
    rgbw('Pulse', 0, 'BREATHE', 'whole-line', 1, { speed: 12, smooth: 96 }, 'rgbw-pulse-v1', copy('De volledige lijn pulseert rustig', 'The complete line pulses softly', 'Toute la ligne pulse doucement', 'Die ganze Linie pulsiert weich')),
    rgbw('Soft Fade', 1, 'BREATHE', 'whole-line', 1, { speed: 8, smooth: 100 }, 'rgbw-soft-fade-v1', copy('De volledige lijn fadet vloeiend in en uit', 'The complete line fades smoothly in and out', 'Toute la ligne apparaît et disparaît doucement', 'Die ganze Linie blendet weich ein und aus')),
    rgbw('Color Fade', 2, 'GRADIENT', 'whole-line', 2, { speed: 10, smooth: 98 }, 'rgbw-color-fade-v1', copy('Volledige kleuren vloeien in elkaar over', 'Full-line colours blend into one another', 'Les couleurs de ligne se fondent', 'Ganze Linienfarben gehen weich ineinander über')),
    rgbw('Smooth Transitions', 3, 'FLOW', 'whole-line', 3, { speed: 9, smooth: 100 }, 'rgbw-smooth-transition-v1', copy('Extra zachte volledige-lijnovergangen', 'Extra-soft whole-line transitions', 'Transitions extra douces de ligne complète', 'Besonders weiche Ganzlinienübergänge')),
    rgbw('Flash / Strobe', 4, 'SPARKLE', 'whole-line', 1, { speed: 22, smooth: 16 }, 'rgbw-strobe-v1', copy('Korte begrensde flitsen van de volledige lijn', 'Short, limited full-line flashes', 'Éclairs courts de toute la ligne', 'Kurze begrenzte Vollblitze')),
    rgbw('Line Pulse', 5, 'SEQUENCE', 'tunnel-lines', 1, { speed: 12, smooth: 96, lineDelayMs: 240, direction: 'right' }, 'rgbw-line-pulse-v1', copy('Volledige lijnen pulseren na elkaar', 'Complete lines pulse in sequence', 'Les lignes complètes pulsent en séquence', 'Ganze Linien pulsieren nacheinander')),
    rgbw('Line Fade', 6, 'CASCADE', 'tunnel-lines', 2, { speed: 10, smooth: 98, lineDelayMs: 280, direction: 'right' }, 'rgbw-line-fade-v1', copy('Een fade reist tussen volledige lijnen', 'A fade travels between complete lines', 'Un fondu voyage entre les lignes', 'Eine Blende wandert zwischen ganzen Linien')),
    rgbw('Line Wave', 7, 'WAVE', 'tunnel-lines', 2, { speed: 13, smooth: 97, lineDelayMs: 200, direction: 'right' }, 'rgbw-line-wave-v1', copy('Een golf beweegt lijn voor lijn', 'A wave moves from line to line', 'Une vague avance ligne par ligne', 'Eine Welle bewegt sich Linie für Linie')),
    rgbw('Line Chase', 8, 'CHASE', 'tunnel-lines', 2, { speed: 16, smooth: 92, lineDelayMs: 160, direction: 'right' }, 'rgbw-line-chase-v1', copy('Volledige lijnen lichten als chase op', 'Complete lines light as a chase', 'Les lignes complètes s’allument en poursuite', 'Ganze Linien leuchten als Chase')),
    rgbw('Line Color Fade', 9, 'GRADIENT', 'tunnel-lines', 2, { speed: 10, smooth: 98, lineDelayMs: 320, direction: 'right' }, 'rgbw-line-color-fade-v1', copy('Iedere lijn neemt de volgende kleur over', 'Each line takes on the next colour', 'Chaque ligne prend la couleur suivante', 'Jede Linie übernimmt die nächste Farbe')),
    rgbw('Line Smooth Transition', 10, 'FLOW', 'tunnel-lines', 3, { speed: 9, smooth: 100, lineDelayMs: 360, direction: 'right' }, 'rgbw-line-smooth-v1', copy('Zachte kleurovergangen reizen tussen lijnen', 'Soft transitions travel between lines', 'Des transitions douces voyagent entre les lignes', 'Weiche Übergänge wandern zwischen Linien')),
    rgbw('Line Strobe', 11, 'SPARKLE', 'tunnel-lines', 1, { speed: 22, smooth: 18, lineDelayMs: 120, direction: 'right' }, 'rgbw-line-strobe-v1', copy('Korte volledige flitsen volgen elkaar op', 'Short full-line flashes follow one another', 'De courts éclairs complets se suivent', 'Kurze Vollblitze folgen einander')),
    rgbw('Tunnel Ripple', 12, 'WAVE', 'tunnel-lines', 3, { speed: 13, smooth: 97, lineDelayMs: 200, direction: 'right' }, 'rgbw-tunnel-ripple-v1', copy('Een rimpel loopt ring voor ring door de tunnel', 'A ripple travels ring by ring through the tunnel', 'Une ondulation traverse le tunnel', 'Eine Welle läuft Ring für Ring durch den Tunnel')),
    rgbw('Center Out', 13, 'MIRROR', 'tunnel-lines', 2, { speed: 12, smooth: 98, lineDelayMs: 280, direction: 'right' }, 'rgbw-center-out-v1', copy('Middelste lijnen openen naar buiten', 'Centre lines open outwards', 'Les lignes centrales s’ouvrent vers l’extérieur', 'Mittlere Linien öffnen nach außen')),
    rgbw('Outside In', 14, 'MIRROR', 'tunnel-lines', 2, { speed: 12, smooth: 98, lineDelayMs: 280, direction: 'right' }, 'rgbw-outside-in-v1', copy('Buitenste lijnen sluiten naar het midden', 'Outer lines close towards the centre', 'Les lignes extérieures convergent vers le centre', 'Äußere Linien schließen zur Mitte')),
    rgbw('Alternating Lines', 15, 'ALTERNATE', 'tunnel-lines', 2, { speed: 14, smooth: 94, lineDelayMs: 240, direction: 'right' }, 'rgbw-alternating-v1', copy('Even en oneven lijnen wisselen af', 'Even and odd lines alternate', 'Les lignes paires et impaires alternent', 'Gerade und ungerade Linien wechseln')),
    rgbw('Double Line Wave', 16, 'WAVE', 'tunnel-lines', 3, { speed: 16, smooth: 97, lineDelayMs: 160, direction: 'right' }, 'rgbw-double-line-wave-v1', copy('Twee golven bewegen over volledige lijnen', 'Two waves move across complete lines', 'Deux vagues parcourent les lignes', 'Zwei Wellen bewegen sich über ganze Linien')),
    rgbw('Gentle Glow', 17, 'BREATHE', 'whole-line', 1, { speed: 9, smooth: 98 }, 'rgbw-gentle-glow-v1', copy('Een zachte gloed over de volledige lijn', 'A gentle glow across the complete line', 'Une douce lueur sur toute la ligne', 'Ein sanftes Leuchten über die ganze Linie')),
    rgbw('Double Pulse', 18, 'BREATHE', 'whole-line', 2, { speed: 15, smooth: 94 }, 'rgbw-double-pulse-v1', copy('Twee volledige-lijnpulsen per cyclus', 'Two whole-line pulses per cycle', 'Deux pulsations de ligne par cycle', 'Zwei Ganzlinienpulse pro Zyklus')),
    rgbw('Colour Hold Fade', 19, 'GRADIENT', 'whole-line', 3, { speed: 10, smooth: 98, spacing: 58 }, 'rgbw-hold-fade-v1', copy('Een kleur blijft staan en vloeit daarna verder', 'A colour holds, then blends onward', 'Une couleur reste puis se fond', 'Eine Farbe hält und blendet dann weiter')),
    rgbw('Theatre Double Flash', 20, 'SPARKLE', 'whole-line', 2, { speed: 24, smooth: 18 }, 'rgbw-double-flash-v1', copy('Twee korte volledige flitsen met pauze', 'Two short full-line flashes with a pause', 'Deux éclairs complets avec pause', 'Zwei kurze Vollblitze mit Pause')),
    rgbw('Tunnel Glow Relay', 21, 'BREATHE', 'tunnel-lines', 2, { speed: 12, smooth: 98, lineDelayMs: 260, direction: 'right' }, 'rgbw-glow-relay-v1', copy('Een gloed reist van volledige lijn naar lijn', 'A glow travels from complete line to line', 'Une lueur voyage de ligne en ligne', 'Ein Leuchten wandert von Linie zu Linie')),
    rgbw('Tunnel Echo Fade', 22, 'CASCADE', 'tunnel-lines', 2, { speed: 15, smooth: 96, spacing: 58, lineDelayMs: 220, direction: 'right' }, 'rgbw-echo-fade-v1', copy('Iedere lijn laat een uitdovende echo achter', 'Every line leaves a fading echo', 'Chaque ligne laisse un écho', 'Jede Linie hinterlässt ein Echo')),
    rgbw('Tunnel Colour Relay', 23, 'GRADIENT', 'tunnel-lines', 4, { speed: 11, smooth: 99, lineDelayMs: 300, direction: 'right' }, 'rgbw-colour-relay-v1', copy('Kleuren worden tussen volledige lijnen doorgegeven', 'Colours pass between complete lines', 'Les couleurs passent entre les lignes', 'Farben werden zwischen ganzen Linien weitergegeben')),
    rgbw('Tunnel Twin Wave', 24, 'WAVE', 'tunnel-lines', 3, { speed: 16, smooth: 97, lineDelayMs: 150, direction: 'right' }, 'rgbw-twin-wave-v1', copy('Twee golven kruisen door de volledige opstelling', 'Two waves cross through the complete installation', 'Deux vagues traversent toute l’installation', 'Zwei Wellen kreuzen durch die ganze Installation')),
    rgbw('Organic Fade', 25, 'BREATHE', 'whole-line', 3, { speed: 8, smooth: 100 }, 'rgbw-organic-fade-v1', copy('Een gelaagde ademhaling laat hele lijnen natuurlijk van kleur veranderen', 'A layered breath changes whole-line colours organically', 'Une respiration nuancée change les couleurs de ligne', 'Ein vielschichtiges Atmen verändert die ganzen Linienfarben')),
    rgbw('Tunnel Pendulum', 26, 'WAVE', 'tunnel-lines', 2, { speed: 15, smooth: 96, lineDelayMs: 300, direction: 'right' }, 'rgbw-tunnel-pendulum-v1', copy('Een lichtpuls reist heen en terug door de volledige lijnen', 'A light pulse travels out and back across complete lines', 'Une pulsation fait l’aller-retour entre les lignes', 'Ein Lichtpuls wandert durch ganze Linien hin und zurück')),
    rgbw('Tunnel Build', 27, 'SEQUENCE', 'tunnel-lines', 4, { speed: 12, smooth: 98, lineDelayMs: 500, direction: 'right' }, 'rgbw-tunnel-build-v1', copy('Volledige lijnen lichten na elkaar op, blijven even aan en doven weer', 'Complete lines fill in order, hold, then release', 'Les lignes s’allument successivement, restent puis s’éteignent', 'Ganze Linien leuchten nacheinander, halten und erlöschen'))
  ]);

  var LEGACY_NAME_MAP = Object.freeze({
    'Slow Halo Relay': 'Tunnel Halo', 'Fast Depth Scan': 'Depth Scanner',
    'Slow Twin Wave': 'Double Tunnel Wave', 'Brand Colour Passage': 'Colour Relay',
    'Color Relay': 'Colour Relay', 'Deep Echo Passage': 'Tunnel Echo',
    'Soft Opening Curtain': 'Curtain Sweep', 'Wide Cross Sweep': 'Cross Tunnel',
    'Long Comet Passage': 'Tunnel Comet',
    'Prism Runner': 'Edge Reveal', 'Precision Prism': 'Edge Reveal', 'Exhibition Runner': 'Edge Reveal',
    'Velvet Comet': 'Center Reveal', 'Silk Comet Trail': 'Center Reveal',
    'Orbit Scanner': 'Aurora Drift', 'Product Spotlight Sweep': 'Aurora Drift',
    'Crystal Sparkle': 'Dual Comet', 'Crystal Dust': 'Dual Comet',
    'Breathing Gradient': 'Interference Wave',
    'Liquid Wave': 'Meteor', 'Calm Liquid Bands': 'Meteor',
    'Mirror Pulse': 'Firefly Field', 'Evening Mirror Pulse': 'Firefly Field',
    'Confetti Flow': 'Ripple', 'Fine Confetti Drift': 'Ripple',
    'Calm Warm Glow': 'Gentle Glow', 'Native White Glow': 'Gentle Glow',
    'Soft Pastel Pulse': 'Double Pulse', 'Brand Hold Fade': 'Colour Hold Fade',
    'Show Double Flash': 'Theatre Double Flash', 'Slow Glow Passage': 'Tunnel Glow Relay',
    'Deep Echo Relay': 'Tunnel Echo Fade', 'Four Colour Passage': 'Tunnel Colour Relay',
    'Fast Twin Passage': 'Tunnel Twin Wave'
  });

  var SPI_BY_VARIANT = Object.freeze(Object.fromEntries(SPI_EFFECTS.map(function (item) { return [item.variant, item]; })));
  var RGBW_BY_KEY = Object.freeze(Object.fromEntries(RGBW_EFFECTS.map(function (item) { return [item.engine + ':' + item.variant, item]; })));

  function canonicalName(name) { return LEGACY_NAME_MAP[name] || name; }

  function migrateLegacyNames(value) {
    function visit(item) {
      if (Array.isArray(item)) return item.map(visit);
      if (!item || typeof item !== 'object') return item;
      var next = {};
      Object.keys(item).forEach(function (key) { next[key] = visit(item[key]); });
      if (typeof next.animation === 'string') next.animation = canonicalName(next.animation);
      if (typeof next.effectName === 'string') next.effectName = canonicalName(next.effectName);
      if (typeof next.name === 'string' && next.variant != null && next.engine) next.name = canonicalName(next.name);
      var variant = Number(next.variant);
      var currentName = typeof next.animation === 'string' ? next.animation : '';
      if (SPI_BY_VARIANT[variant] &&
          (!currentName || LEGACY_NAME_MAP[item.animation] || currentName === SPI_BY_VARIANT[variant].name)) {
        next.animation = SPI_BY_VARIANT[variant].name;
        next.engine = SPI_BY_VARIANT[variant].engine;
      }
      return next;
    }
    return visit(value);
  }

  function effectState(effect, overrides) {
    var defaults = clone(effect.defaults);
    var palette = clone(defaults.palette || [slot('#FF5544', 0), slot('#FFC43D', 0), slot('#2DD09F', 0), slot('#328CFF', 0)].slice(0, effect.colors || 1));
    delete defaults.palette;
    var state = Object.assign(defaults, clone(overrides || {}), {
      animation: effect.name, engine: effect.engine, variant: effect.variant,
      receiverType: effect.receiverType
    });
    if (!state.colors) state.colors = palette.map(function (item) { return item.rgb; });
    if (!state.whiteChannels) state.whiteChannels = palette.map(function (item) { return item.white; });
    if (!state.rgbEnabled) state.rgbEnabled = palette.map(function (item) { return item.rgb !== '#000000'; });
    if (!state.whiteEnabled) state.whiteEnabled = palette.map(function (item) { return item.white > 0; });
    state.colorCount = Number(state.colorCount) || palette.length || 1;
    if (effect.receiverType === 'SPI') {
      var background = effect.defaults.background;
      state.background = state.background || (background ? background.rgb : '#000000');
      state.backgroundWhite = state.backgroundWhite == null ? (background ? background.white : 0) : state.backgroundWhite;
      state.bgBrightness = state.bgBrightness == null ? (effect.defaults.backgroundBrightness || 0) : state.bgBrightness;
    }
    return state;
  }

  function paletteFromState(state, fallback) {
    var colors = Array.isArray(state.colors) && state.colors.length ? state.colors : fallback.map(function (item) { return item.rgb; });
    var whites = Array.isArray(state.whiteChannels) ? state.whiteChannels : fallback.map(function (item) { return item.white; });
    var count = Math.max(1, Math.min(4, Number(state.colorCount) || colors.length || fallback.length));
    var result = [];
    var index;
    for (index = 0; index < count; index += 1) {
      result.push({ rgb: state.rgbEnabled && state.rgbEnabled[index] === false ? '#000000' : String(colors[index % colors.length] || '#000000').toUpperCase(),
        white: state.whiteEnabled && state.whiteEnabled[index] === false ? 0 : clamp(whites[index] || 0, 0, 255, 0) });
    }
    return result;
  }

  function hexRgb(hex) {
    var value = String(hex || '#000000').replace('#', '');
    if (value.length === 3) value = value.split('').map(function (part) { return part + part; }).join('');
    return [0, 2, 4].map(function (offset) { return parseInt(value.slice(offset, offset + 2), 16) || 0; });
  }

  function mixSlot(first, second, amount) {
    var a = hexRgb(first.rgb);
    var b = hexRgb(second.rgb);
    var mix = clamp(amount, 0, 1, 0);
    return {
      rgb: a.map(function (channel, index) { return Math.round(channel + (b[index] - channel) * mix); }),
      white: Math.round(first.white + (second.white - first.white) * mix)
    };
  }

  function paletteAt(palette, phase, smooth, presentationSmooth) {
    var scaled = mod1(phase) * palette.length;
    var index = Math.floor(scaled) % palette.length;
    var amount = scaled - Math.floor(scaled);
    if (smooth !== false) amount = smoothstep(amount);
    if (presentationSmooth != null) amount = (amount < 0.5 ? 0 : 1) +
      (amount - (amount < 0.5 ? 0 : 1)) * smoothnessCurve(presentationSmooth);
    return mixSlot(palette[index], palette[(index + 1) % palette.length], amount);
  }

  function cyclesPerSecond(state, receiverType) {
    var speed = clamp(state.speed, 0, 100, 0);
    if (speed === 0) return 0;
    var normalized = speed / 100;
    if (receiverType === 'SPI') return 0.002 + normalized * normalized * 0.8;
    if ([4, 11, 20].indexOf(Number(state.variant)) >= 0) return 0.5 + normalized * normalized * 11.5;
    return 0.003 + normalized * normalized * 1.497;
  }

  function elapsedFor(state, time) {
    var started = Number(state.previewStartedAt);
    return Number.isFinite(started) && started >= 0 && started <= time ? time - started : time;
  }

  function phaseFor(state, time, receiverType) {
    return mod1(elapsedFor(state, time) * cyclesPerSecond(state, receiverType) + (Number(state.phaseMs) || 0) / 1000);
  }

  function smoothnessCurve(smooth) {
    var value = clamp(smooth, 0, 100, 100) / 100;
    return value < 0.5 ? 4 * value * value * value : 1 - 4 * Math.pow(1 - value, 3);
  }

  function blendPhase(stepped, continuous, smooth) {
    var delta = mod1(continuous) - mod1(stepped);
    if (delta > 0.5) delta -= 1;
    else if (delta < -0.5) delta += 1;
    return mod1(stepped + delta * smoothnessCurve(smooth));
  }

  function phaseWithSmoothness(phase, smooth) {
    phase = mod1(phase);
    return smooth >= 100 ? phase : blendPhase(Math.floor(phase * 16) / 16, phase, smooth);
  }

  function pixelMotionPosition(phase, width, pixels, smooth) {
    phase = mod1(phase);
    var pixelPosition = phase * pixels;
    // Match the receiver's float arithmetic at exact rational pixel boundaries.
    // This tolerance is one ten-thousandth of a pixel, not a visible motion step.
    if (Math.abs(pixelPosition - Math.round(pixelPosition)) < 0.0001) pixelPosition = Math.round(pixelPosition);
    return smooth >= 100 ? phase : blendPhase(
      mod1((Math.floor(pixelPosition) + (Math.round(width) % 2 ? 0.5 : 0)) / pixels), phase, smooth);
  }

  function thickness(distance, widthPixels, pixelCount, smooth) {
    if (widthPixels >= pixelCount) return 1;
    var radius = Math.max(0.5, widthPixels / 2);
    var pixels = distance * pixelCount;
    var coverage = clamp(Math.min(pixels + 0.5, radius) - Math.max(pixels - 0.5, -radius), 0, 1, 0);
    var crisp = coverage >= 0.999 ? 1 : 0;
    return crisp + (coverage - crisp) * smoothnessCurve(smooth);
  }

  function hashNoise(value) {
    var x = Math.sin(value * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  function sampleSpiPixel(stateValue, coordinate, time, pixelCount, lineIndex, lineCount) {
    var effect = SPI_BY_VARIANT[Number(stateValue && stateValue.variant)];
    if (!effect) throw new Error('No canonical SPI preview for variant ' + (stateValue && stateValue.variant));
    var state = Object.assign({}, effect.defaults, stateValue || {});
    var u = clamp(coordinate, 0, 1, 0);
    var n = Math.max(1, Number(pixelCount) || Number(state.groupPixels) || 60);
    var physical = Math.max(1, Number(state.physicalLeds) || n);
    var localU = state.receiverOffset == null ? u : (u * n - Number(state.receiverOffset)) / physical;
    var line = Math.max(0, Number(lineIndex == null ? state.lineIndex : lineIndex) || 0);
    var lines = Math.max(1, Number(lineCount == null ? state.lineCount : lineCount) || 1);
    var phase = phaseFor(state, Number(time) || 0, 'SPI');
    var seconds = elapsedFor(state, Number(time) || 0);
    var smooth = clamp(state.smooth, 0, 100, effect.defaults.smooth);
    var reverse = state.direction === 'left';
    var temporal = phaseWithSmoothness(reverse ? 1 - phase : phase, smooth);
    var clock = phaseWithSmoothness(phase, smooth);
    var order = reverse ? lines - 1 - line : line;
    var delayCycles = Math.round(clamp(state.lineDelayMs, 0, 5080, effect.defaults.lineDelayMs || 0) / 40) * 0.04 * cyclesPerSecond(state, 'SPI');
    var rowClock = phaseWithSmoothness(mod1(phase - order * delayCycles), smooth);
    var tunnelPhase = reverse ? mod1(1 - rowClock) : rowClock;
    var local = reverse ? 1 - u : u;
    var samplePixel = u * n - 0.5;
    if (Math.abs(samplePixel - Math.round(samplePixel)) < 0.000001) samplePixel = Math.round(samplePixel);
    var orientedPixel = reverse ? n - 1 - samplePixel : samplePixel;
    var palette = paletteFromState(state, effect.defaults.palette);
    var width = Math.round(clamp(state.widthPixels, 1, n, effect.defaults.widthPixels || 3));
    var spread = clamp(state.spread, 0, 100, effect.defaults.spread || 0) / 100;
    var spacing = clamp(state.spacing, 0, 100, effect.defaults.spacing || 0) / 100;
    var count = Math.max(1, Math.min(8, Math.round(clamp(state.objectCount, 1, 8, effect.defaults.objectCount || 1))));
    var trail = clamp(state.trailLength, 0, 100, effect.defaults.trailLength || 0) / 100;
    var randomness = clamp(state.randomness, 0, 100, effect.defaults.randomness || 0);
    var amount = 0;
    var colourPhase = phase;
    var band = false;
    var bandIndex = null;
    var smoothPalette = true;

    if (effect.variant === 104) {
      amount = 0.06 + 0.94 * smoothstep(0.5 - 0.5 * Math.cos(tunnelPhase * Math.PI * 2));
      colourPhase = tunnelPhase;
    } else if (effect.variant === 105) {
      amount = smoothstep(1 - Math.min(tunnelPhase, 1 - tunnelPhase) / (0.06 + 0.28 * smooth / 100));
      colourPhase = line / Math.max(1, lines - 1) + tunnelPhase; band = true;
    } else if (effect.variant === 106) {
      amount = 0.07 + 0.93 * Math.pow(0.5 + 0.5 * Math.cos(tunnelPhase * Math.PI * 4), 0.65 + 0.7 * (1 - smooth / 100));
      colourPhase = tunnelPhase;
    } else if (effect.variant === 107) {
      amount = 1; colourPhase = tunnelPhase;
    } else if (effect.variant === 108) {
      var primary = smoothstep(1 - Math.min(tunnelPhase, 1 - tunnelPhase) / (0.08 + 0.20 * smooth / 100));
      var echoPhase = mod1(tunnelPhase - (0.17 + 0.25 * spacing));
      var echo = smoothstep(1 - Math.min(echoPhase, 1 - echoPhase) / (0.10 + 0.18 * smooth / 100));
      amount = Math.max(primary, echo * 0.48); colourPhase = tunnelPhase;
    } else if (effect.variant === 109) {
      var curtainEdge = Math.max(0.5, width * 0.5) / physical;
      var curtainLocal = reverse ? 1 - localU : localU;
      amount = 1 - smoothstep((curtainLocal - smoothstep(tunnelPhase) + curtainEdge) / (curtainEdge * 2));
      colourPhase = curtainLocal * 0.45 + tunnelPhase;
    } else if (effect.variant === 110) {
      var crossing = pixelMotionPosition(0.5 - 0.5 * Math.cos(tunnelPhase * Math.PI * 2), width, physical, smooth);
      amount = Math.max(thickness(Math.abs(localU - crossing), width, physical, smooth),
        thickness(Math.abs(localU - (1 - crossing)), width, physical, smooth));
      colourPhase = localU + tunnelPhase;
    } else if (effect.variant === 111) {
      var tunnelHead = pixelMotionPosition(tunnelPhase, width, physical, smooth);
      var tunnelBehind = mod1(tunnelHead - localU) * physical;
      var tunnelTrail = Math.max(width, physical * Math.max(0.04, trail));
      amount = Math.max(thickness(circularDistance(localU, tunnelHead), width, physical, smooth),
        Math.max(0, 1 - tunnelBehind / tunnelTrail) * 224 / 255);
      colourPhase = tunnelBehind / Math.max(1, tunnelTrail);
    } else if (effect.variant === 112) {
      var edgeTravel = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
      var edgeCenter = edgeTravel * (n - width) + (width - 1) * 0.5;
      var edgeCoverage = width >= n ? 1 : clamp((width + 1) * 0.5 - Math.abs(Math.round(orientedPixel) - edgeCenter), 0, 1, 0);
      var edgeCrisp = edgeCoverage >= 0.999 ? 1 : 0;
      amount = orientedPixel <= edgeTravel * n - 0.5 ? 1 : edgeCrisp + (edgeCoverage - edgeCrisp) * smoothnessCurve(smooth);
      colourPhase = orientedPixel / n * (1 + spread * 1.5);
    } else if (effect.variant === 113) {
      var centerTravel = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
      var centerDistance = Math.abs(u * n - 0.5 - (n - 1) * 0.5);
      var centerFeather = Math.max(0.5, width * 0.5);
      amount = clamp((centerTravel * n * 0.5 - centerDistance + centerFeather) / centerFeather, 0, 1, 0);
      colourPhase = centerDistance / Math.max(1, n * 0.5) * (1 + spread) + temporal * 0.08;
    } else if (effect.variant === 114) {
      var auroraA = Math.sin((u * (1.2 + spread * 2.8) - temporal * 0.31) * Math.PI * 2);
      var auroraB = Math.sin((u * 3.17 + temporal * 0.19 + 0.23) * Math.PI * 2);
      var auroraC = Math.sin((u * 0.73 - temporal * 0.11 + 0.61) * Math.PI * 2);
      amount = Math.pow(clamp(0.48 + auroraA * 0.27 + auroraB * 0.16 + auroraC * 0.09, 0, 1, 0), 1.35);
      colourPhase = u * 0.65 + temporal * 0.14 + auroraB * 0.05;
    } else if (effect.variant === 115) {
      var directed = reverse ? 1 - phase : phase;
      var headA = pixelMotionPosition(directed, width, n, smooth);
      var headB = pixelMotionPosition(mod1(1 - directed + 0.5), width, n, smooth);
      var behindA = mod1(headA - u) * n;
      var behindB = mod1(u - headB) * n;
      var dualTail = Math.max(width, n * Math.max(0.02, trail));
      amount = Math.max(thickness(circularDistance(u, headA), width, n, smooth),
        thickness(circularDistance(u, headB), width, n, smooth),
        Math.max(0, 1 - behindA / dualTail) * 0.82, Math.max(0, 1 - behindB / dualTail) * 0.82);
      colourPhase = behindA < behindB ? 0.05 : 0.55;
    } else if (effect.variant === 116) {
      var first = Math.sin((u * (2 + count) - temporal) * Math.PI * 2);
      var second = Math.sin((u * (2.37 + spread * 3) + temporal * 0.83) * Math.PI * 2);
      amount = Math.pow(0.5 + 0.5 * first * second, 0.8 + (100 - smooth) * 0.012);
      colourPhase = (first - second) * 0.18 + temporal;
    } else if (effect.variant === 117) {
      var meteorHead = pixelMotionPosition(reverse ? 1 - phase : phase, width, n, smooth);
      var meteorBehind = mod1(meteorHead - u) * n;
      var meteorTrail = Math.max(width, n * Math.max(0.03, trail));
      var meteorHash = Math.imul(Math.floor(u * n - 0.5) + 1, 0x9E3779B9);
      meteorHash ^= Math.imul(Math.floor(seconds * 11), 0x85EBCA6B);
      meteorHash ^= Math.imul(randomness, 0xC2B2AE35); meteorHash ^= meteorHash >>> 16;
      var grain = 0.68 + (meteorHash & 255) / 800;
      var wake = meteorBehind < meteorTrail ? Math.exp(-3.2 * meteorBehind / meteorTrail) * grain : 0;
      amount = Math.max(thickness(circularDistance(u, meteorHead), width, n, smooth), wake);
      colourPhase = meteorBehind / Math.max(1, meteorTrail);
    } else if (effect.variant === 118) {
      for (var fly = 0; fly < count; fly += 1) {
        var seed = (Math.imul(fly + 1, 0xA511E9B3) + Math.imul(randomness, 0x63D83595)) >>> 0;
        seed = (seed ^ (seed >>> 15)) >>> 0;
        var flyCenter = (seed & 65535) / 65536;
        var flyRate = 0.37 + ((seed >>> 16) & 127) / 180;
        var pulse = Math.pow(Math.max(0, Math.sin(mod1(phase * flyRate + flyCenter) * Math.PI * 2)), 4);
        amount = Math.max(amount, thickness(circularDistance(u, flyCenter), width, n, smooth) * pulse);
      }
      colourPhase = u + temporal * 0.04;
    } else if (effect.variant === 119) {
      var radius = phase * 0.5;
      var radialDistance = Math.abs(u - 0.5);
      amount = thickness(Math.abs(radialDistance - radius), width, n, smooth);
      if (count > 1) amount = Math.max(amount, thickness(Math.abs(radialDistance - mod1(phase + 0.5) * 0.5), width, n, smooth));
      colourPhase = radius * 2;
    } else if (effect.variant === 120) {
      var contourHead = pixelMotionPosition(phase, width, n, smooth);
      var contourBehind = mod1(contourHead - local) * n;
      var ribbon = Math.min(Math.max(1, n - 0.5), Math.max(width, n * trail));
      var leading = smootherstep((contourBehind + 0.5) / Math.max(0.75, ribbon * 0.1));
      var trailing = smootherstep((ribbon - contourBehind + 0.5) / Math.max(1, ribbon * 0.28));
      amount = Math.max(thickness(circularDistance(local, contourHead), width, n, smooth),
        contourBehind < ribbon ? leading * trailing * 242 / 255 : 0);
      colourPhase = clamp(contourBehind / ribbon, 0, 1, 0); smoothPalette = false;
    } else if (effect.variant === 121) {
      var shutters = Math.max(1, Math.min(6, 1 + Math.floor(spacing * 5)));
      var darkness = 0;
      var blackoutTail = Math.max(width, width + trail * n * 0.45);
      for (var shutterIndex = 0; shutterIndex < shutters; shutterIndex += 1) {
        var blackoutHead = mod1(clock + shutterIndex / shutters);
        var blackoutBehind = mod1(blackoutHead - local) * n;
        var blackoutWake = blackoutBehind < blackoutTail ? Math.pow(Math.max(0, 1 - blackoutBehind / blackoutTail), 1.1 + (100 - smooth) * 0.018) : 0;
        darkness = Math.max(darkness, thickness(circularDistance(local, blackoutHead), width, n, smooth), blackoutWake);
      }
      amount = 1 - darkness;
      colourPhase = local * (1 + spacing * 1.5) + temporal * 0.035;
    } else if (effect.variant === 122) {
      var waves = 1.5 + spacing * 6.5;
      var weaveA = 0.5 + 0.5 * Math.sin((local * waves - clock) * Math.PI * 2);
      var weaveB = 0.5 + 0.5 * Math.sin((local * waves + clock * 0.83 + 0.5) * Math.PI * 2);
      var threshold = Math.max(0.01, Math.max(0.5, width * 0.5) / n * waves);
      var edgeA = clamp((threshold - Math.abs(weaveA - 0.5) + 0.08 * smoothnessCurve(smooth)) / threshold, 0, 1, 0);
      var edgeB = clamp((threshold - Math.abs(weaveB - 0.5) + 0.08 * smoothnessCurve(smooth)) / threshold, 0, 1, 0);
      var afterglow = trail * 0.42 * (0.5 + 0.5 * Math.sin((local * waves - clock + 0.22) * Math.PI * 2));
      amount = Math.max(edgeA, edgeB * (0.55 + 0.45 * weaveA), afterglow);
      colourPhase = edgeA + 0.00001 >= edgeB ? 0.08 + local * 0.18 : 0.58 + local * 0.18;
    } else if (effect.variant === 123) {
      var prismCoordinate = orientedPixel / width * (0.55 + spacing * 1.9) - clock * (1 + trail * 0.8);
      var prismCenter = 1 - Math.abs(mod1(prismCoordinate) * 2 - 1);
      var gapFloor = 0.25 + trail * 0.70;
      amount = gapFloor + (1 - gapFloor) * Math.pow(prismCenter, 0.45 + (100 - smooth) * 0.018);
      colourPhase = prismCoordinate * (1 + spacing) * (0.7 + spread * 0.6) + temporal * 0.21;
    } else if (effect.variant === 124) {
      var gapPixels = 1 + spacing * Math.max(2, n * 0.16);
      var periodPixels = width + gapPixels;
      var travelPixels = clock * periodPixels;
      var cell = (orientedPixel - travelPixels + periodPixels * 8) % periodPixels;
      var distanceToSegment = cell < width ? 0 : Math.min(cell - width, periodPixels - cell);
      var featherPixels = 0.15 + smoothnessCurve(smooth) * Math.min(1.5, gapPixels * 0.45);
      var lit = cell < width ? 1 : Math.max(0, 1 - distanceToSegment / featherPixels);
      var marched = mod1((orientedPixel - travelPixels) / periodPixels);
      amount = Math.max(lit, trail * 0.55 * Math.pow(Math.max(0, 1 - marched), 2));
      colourPhase = Math.floor((orientedPixel - travelPixels) / periodPixels) * 0.23;
    } else if (effect.variant === 125) {
      var emberCount = Math.max(2, Math.min(12, 2 + Math.floor(spacing * 10)));
      var heat = 0;
      for (var ember = 0; ember < emberCount; ember += 1) {
        var hash = (Math.imul(0x9E3779B9, ember + 1) ^ Math.imul(0x85EBCA6B, randomness + 17)) >>> 0;
        hash = (hash ^ (hash >>> 16)) >>> 0;
        var origin = (hash & 65535) / 65536;
        var rate = 0.32 + ((hash >>> 16) & 255) / 510;
        var center = mod1(origin + clock * rate);
        var emberRadius = Math.max(0.5, width * (0.55 + ((hash >>> 24) & 127) / 255));
        var spatial = Math.max(0, 1 - circularDistance(local, center) * n / emberRadius);
        var age = mod1(clock * rate + origin);
        var life = Math.pow(Math.max(0, 1 - age), 0.7 + trail * 2.4);
        var flicker = 0.70 + 0.30 * Math.sin((seconds * (2.2 + rate * 3) + origin) * Math.PI * 2);
        var emberAmount = Math.pow(spatial, 0.7 + (100 - smooth) * 0.025) * life * flicker;
        if (emberAmount > amount) { amount = emberAmount; heat = 1 - age; }
      }
      colourPhase = 0.02 + heat * (0.18 + spacing * 0.18);
    } else if (effect.variant === 126) {
      var span = (0.08 + spacing * 0.72) * (0.65 + 0.35 * Math.sin(clock * Math.PI * 2));
      var selectedOrb = 0;
      for (var orb = 0; orb < count; orb += 1) {
        var offset = count === 1 ? 0 : (orb / (count - 1) - 0.5) * span;
        var orbHead = pixelMotionPosition(mod1(clock + offset), width, n, smooth);
        var orbAmount = thickness(circularDistance(local, orbHead), width, n, smooth);
        if (orbAmount > amount) { amount = orbAmount; selectedOrb = orb / count; }
      }
      colourPhase = selectedOrb + clock;
    } else if (effect.variant === 127) {
      var selectedShutter = 0;
      for (var shutter = 0; shutter < count; shutter += 1) {
        var shutterCenter = (shutter + 0.5) / count;
        var opening = 0.5 - 0.5 * Math.cos((clock - shutter * (0.05 + spacing * 0.18)) * Math.PI * 2);
        var halfWidth = width * opening * 0.5;
        var distance = Math.abs(u - shutterCenter) * n;
        var coverage = Math.max(0, Math.min(distance + 0.5, halfWidth) - Math.max(distance - 0.5, -halfWidth));
        var crisp = coverage >= 0.999 ? 1 : 0;
        var shutterAmount = crisp + (coverage - crisp) * smoothnessCurve(smooth);
        if (shutterAmount > amount) { amount = shutterAmount; selectedShutter = shutterCenter + opening * 0.22; }
      }
      colourPhase = selectedShutter;
    } else if (effect.variant === 128) {
      var diagonalU = reverse ? 1 - localU : localU;
      var forward = mod1(diagonalU * count - rowClock);
      var backward = mod1(diagonalU * count + rowClock + 0.5);
      var widthPerCell = Math.min(physical, width * count);
      var diagonalA = thickness(Math.min(forward, 1 - forward), widthPerCell, physical, smooth);
      var diagonalB = thickness(Math.min(backward, 1 - backward), widthPerCell, physical, smooth);
      amount = Math.max(diagonalA, diagonalB * 0.68);
      colourPhase = diagonalA >= diagonalB * 0.68 ? rowClock : 0.5 + rowClock;
    } else if (effect.variant === 129) {
      var carriageGap = 1 + spacing * n * 0.2;
      for (var carriage = 0; carriage < count; carriage += 1) {
        var carriageHead = pixelMotionPosition(mod1(clock - carriage * (width + carriageGap) / n), width, n, smooth);
        var carriageAmount = thickness(circularDistance(local, carriageHead), width, n, smooth);
        if (carriageAmount > amount) { amount = carriageAmount; bandIndex = carriage % palette.length; }
      }
      band = true;
    } else if (effect.variant === 130) {
      var cascadeDistance = Math.abs(u - 0.5);
      for (var ripple = 0; ripple < count; ripple += 1) {
        var cascadeCycle = mod1((reverse ? 1 - clock : clock) - ripple / count);
        var cascadeRadius = cascadeCycle * 0.5;
        var cascadeEdge = Math.min(0.20, Math.max(0.02, width / n * 2));
        var cascadeEnvelope = smootherstep(cascadeCycle / cascadeEdge) * smootherstep((1 - cascadeCycle) / cascadeEdge);
        var cascadeBirthDeath = 1 + (cascadeEnvelope - 1) * smoothnessCurve(smooth);
        var cascadeAmount = thickness(Math.abs(cascadeDistance - cascadeRadius), width, n, smooth) *
          Math.pow(Math.max(0, 1 - cascadeRadius * 2), spacing * 1.5) * cascadeBirthDeath;
        if (cascadeAmount > amount) { amount = cascadeAmount; bandIndex = ripple % palette.length; }
      }
      band = true;
    } else if (effect.variant === 131) {
      var rainLength = Math.max(width, n * Math.max(0.01, trail));
      for (var meteor = 0; meteor < count; meteor += 1) {
        var rainHead = pixelMotionPosition(mod1(clock * (1 + meteor % 3) + meteor / count), width, n, smooth);
        var rainBehind = mod1(rainHead - local) * n;
        var rainWake = rainBehind < rainLength ? Math.pow(Math.max(0, 1 - rainBehind / rainLength), 1 + spacing * 3) * 0.8 : 0;
        var rainAmount = Math.max(thickness(circularDistance(local, rainHead), width, n, smooth), rainWake);
        if (rainAmount > amount) { amount = rainAmount; bandIndex = meteor % palette.length; }
      }
      band = true;
    }
    var foreground = bandIndex !== null ? mixSlot(palette[bandIndex], palette[bandIndex], 0) : band ? mixSlot(palette[Math.floor(mod1(colourPhase) * palette.length) % palette.length],
      palette[Math.floor(mod1(colourPhase) * palette.length) % palette.length], 0) : paletteAt(palette, colourPhase, smoothPalette, smooth);
    if (effect.variant === 120) {
      var requestedWhite = Math.max.apply(Math, palette.map(function (item) { return item.white; }));
      var explicitRgb = palette.some(function (item) { return hexRgb(item.rgb).some(function (channel) { return channel > 0; }); });
      if (!explicitRgb) { foreground.rgb = [0, 0, 0]; foreground.white = requestedWhite || 255; }
      else if (requestedWhite) foreground.white = Math.max(foreground.white, requestedWhite);
    }
    // Tunnel legacy renderers apply the same smoothness presentation to the
    // envelope as to palette blends. Match that receiver step exactly.
    if (effect.variant >= 104 && effect.variant <= 111) amount = (amount < 0.5 ? 0 : 1) +
      (amount - (amount < 0.5 ? 0 : 1)) * smoothnessCurve(smooth);
    var background = state.background && typeof state.background === 'object' ? state.background : {
      rgb: state.background || '#000000', white: state.backgroundWhite || 0
    };
    return { receiverType: 'SPI', variant: effect.variant, formula: effect.previewFormula,
      rgb: foreground.rgb, white: foreground.white, amount: clamp(amount, 0, 1, 0),
      background: state.backgroundOn ? { rgb: hexRgb(background.rgb), white: background.white || 0,
        brightness: clamp(state.bgBrightness == null ? state.backgroundBrightness : state.bgBrightness, 0, 100, 0) / 100 } : null,
      brightness: clamp(state.brightness, 0, 100, effect.defaults.brightness) / 100,
      uniform: false, coordinate: u };
  }

  function rgbwEffectForState(state) {
    var wantedName = canonicalName(state && state.animation);
    var named = RGBW_EFFECTS.find(function (item) { return item.name === wantedName; });
    if (named) return named;
    return RGBW_BY_KEY[String(state && state.engine || '').toUpperCase() + ':' + Number(state && state.variant)];
  }

  function rgbwLineOrder(variant, line, lines, direction) {
    var reverse = direction === 'left';
    var index = reverse ? lines - 1 - line : line;
    if (variant === 13 || variant === 14) {
      var center = (lines - 1) / 2;
      var rank = Math.round(Math.max(0, Math.abs(line - center) - (lines % 2 ? 0 : 0.5)));
      var maximum = Math.max(0, Math.floor((lines + 1) / 2) - 1);
      var ordered = variant === 14 ? maximum - Math.min(rank, maximum) : Math.min(rank, maximum);
      return reverse ? maximum - ordered : ordered;
    }
    if (variant === 16) {
      var pairs = Math.max(1, Math.floor((lines + 1) / 2));
      return reverse ? pairs - 1 - Math.floor(line / 2) : Math.floor(line / 2);
    }
    return index;
  }

  function sampleRgbwLine(stateValue, lineIndex, lineCount, time) {
    var state = stateValue || {};
    var effect = rgbwEffectForState(state);
    if (!effect) throw new Error('No canonical RGBW preview for ' + (state.animation || state.variant));
    state = Object.assign({}, effect.defaults, state);
    var lines = Math.max(1, Number(lineCount) || 1);
    var line = Math.max(0, Math.min(lines - 1, Number(lineIndex) || 0));
    var phase = phaseWithSmoothness(phaseFor(state, Number(time) || 0, 'RGBW'), state.smooth);
    var order = effect.kind === 'tunnel-lines' ? rgbwLineOrder(effect.variant, line, lines, state.direction) : 0;
    var delay = Math.round(clamp(state.lineDelayMs, 0, 5080, effect.defaults.lineDelayMs || 0) / 40) * 0.04 * cyclesPerSecond(state, 'RGBW');
    var legacyDelay = (effect.variant >= 5 && effect.variant <= 16) || (effect.variant >= 21 && effect.variant <= 24);
    var raw = mod1((state.direction === 'left' ? -1 : 1) * (phase - (legacyDelay ? order * delay : 0)));
    var fallback = [slot('#FF5544', 0), slot('#FFC43D', 0), slot('#2DD09F', 0), slot('#328CFF', 0)].slice(0, effect.colors);
    var palette = paletteFromState(state, fallback);
    var smooth = clamp(state.smooth, 0, 100, effect.defaults.smooth) / 100;
    var amount = 1;
    var colourPhase = raw;
    var smoothPalette = true;
    var band = false;

    if (effect.variant === 0 && effect.engine === 'STATIC') { amount = 1; colourPhase = 0; }
    else if (effect.variant === 0) { amount = 0.1 + 0.9 * (0.5 - 0.5 * Math.cos(raw * Math.PI * 2)); colourPhase = 0; }
    else if (effect.variant === 1) { amount = smoothstep(1 - Math.abs(raw * 2 - 1)); colourPhase = 0; }
    else if (effect.variant === 2) smoothPalette = false;
    else if (effect.variant === 3) smoothPalette = true;
    else if (effect.variant === 4) { amount = raw < 0.04 + smooth * 0.22 ? 1 : 0; colourPhase = 0; }
    else if (effect.variant === 5) { amount = 0.5 - 0.5 * Math.cos(raw * Math.PI * 2); smoothPalette = false; }
    else if (effect.variant === 6) { amount = Math.sin(raw * Math.PI); smoothPalette = false; }
    else if (effect.variant === 7) { amount = 0.1 + 0.9 * (0.5 - 0.5 * Math.cos(raw * Math.PI * 2)); smoothPalette = false; }
    else if (effect.variant === 8) { amount = clamp(1 - Math.min(raw, 1 - raw) / (0.08 + 0.34 * smooth), 0, 1, 0); band = true; }
    else if (effect.variant === 9) smoothPalette = false;
    else if (effect.variant === 10) smoothPalette = true;
    else if (effect.variant === 11) { amount = raw < 0.04 + smooth * 0.22 ? 1 : 0; band = true; }
    else if (effect.variant === 12) { amount = smoothstep(1 - Math.min(raw, 1 - raw) / (0.04 + 0.30 * smooth)); smoothPalette = false; }
    else if (effect.variant === 13 || effect.variant === 14) { amount = 0.08 + 0.92 * (0.5 - 0.5 * Math.cos(raw * Math.PI * 2)); smoothPalette = false; }
    else if (effect.variant === 15) { colourPhase = mod1(raw + (line % 2 ? 0.5 : 0)); amount = 0.08 + 0.92 * (0.5 - 0.5 * Math.cos(colourPhase * Math.PI * 2)); smoothPalette = false; }
    else if (effect.variant === 16) { amount = 0.1 + 0.9 * (0.5 - 0.5 * Math.cos(raw * Math.PI * 2)); smoothPalette = false; }
    else if (effect.variant === 17) { amount = 0.12 + 0.88 * smoothstep(0.5 - 0.5 * Math.cos(raw * Math.PI * 2)); colourPhase = 0; }
    else if (effect.variant === 18) {
      var pulseWidth = 0.055 + 0.095 * smooth;
      var pulseA = smoothstep(1 - circularDistance(raw, 0.12) / pulseWidth);
      var pulseB = smoothstep(1 - circularDistance(raw, 0.34) / pulseWidth);
      amount = 0.05 + 0.95 * Math.max(pulseA, pulseB * 0.78);
      band = true; colourPhase = raw < 0.25 ? 0 : 0.75;
    } else if (effect.variant === 19) {
      var hold = clamp(state.spacing, 0, 100, effect.defaults.spacing) / 100;
      var scaled = raw * palette.length;
      var slotPhase = scaled - Math.floor(scaled);
      var transition = Math.max(0.06, 0.48 * (1 - hold));
      colourPhase = (Math.floor(scaled) + smoothstep((slotPhase - (1 - transition)) / transition)) / palette.length;
      smoothPalette = false;
    } else if (effect.variant === 20) {
      var flashWidth = 0.025 + 0.1 * smooth;
      amount = (raw < flashWidth || (raw > 0.16 && raw < 0.16 + flashWidth)) ? 1 : 0.02;
      band = true; colourPhase = raw < 0.16 ? 0 : 0.55;
    } else if (effect.variant === 21) amount = 0.06 + 0.94 * smoothstep(0.5 - 0.5 * Math.cos(raw * Math.PI * 2));
    else if (effect.variant === 22) {
      var primary = smoothstep(1 - Math.min(raw, 1 - raw) / (0.08 + 0.22 * smooth));
      var echoRaw = mod1(raw - 0.28);
      amount = Math.max(primary, smoothstep(1 - Math.min(echoRaw, 1 - echoRaw) / (0.12 + 0.18 * smooth)) *
        (0.25 + 0.45 * clamp(state.spacing, 0, 100, effect.defaults.spacing) / 100));
    } else if (effect.variant === 23) amount = 1;
    else if (effect.variant === 24) { amount = 0.06 + 0.94 * Math.pow(0.5 + 0.5 * Math.cos(raw * Math.PI * 4), 0.7 + 0.55 * (1 - smooth)); colourPhase = raw * 1.5; }
    else if (effect.variant === 25) {
      var swell = 0.5 - 0.5 * Math.cos(raw * Math.PI * 2);
      var detail = 0.5 - 0.5 * Math.cos((raw * 3 + 0.19) * Math.PI * 2);
      amount = 0.08 + 0.92 * Math.pow(swell * (0.58 + detail * 0.42), 0.65 + (1 - smooth) * 1.7);
      colourPhase = raw + 0.12 * Math.sin(raw * Math.PI * 2);
    } else if (effect.variant === 26) {
      var outward = mod1(phase - order * delay);
      var returning = mod1(phase - 0.5 - (lines - 1 - order) * delay);
      var pendulumWidth = 0.035 + 0.13 * smooth;
      var forwardPulse = smoothstep(1 - Math.min(outward, 1 - outward) / pendulumWidth);
      var returnPulse = smoothstep(1 - Math.min(returning, 1 - returning) / pendulumWidth);
      amount = Math.max(forwardPulse, returnPulse * 0.82);
      colourPhase = forwardPulse >= returnPulse * 0.82 ? 0 : 0.5;
    } else if (effect.variant === 27) {
      var buildProgress = mod1(phase - order * delay);
      var buildEdge = 0.02 + 0.2 * smooth;
      amount = smoothstep(buildProgress / buildEdge) * smoothstep((0.72 - buildProgress) / buildEdge);
      colourPhase = line / lines;
    }
    var selected;
    if (band) selected = mixSlot(palette[Math.floor(mod1(colourPhase) * palette.length) % palette.length], palette[Math.floor(mod1(colourPhase) * palette.length) % palette.length], 0);
    else selected = paletteAt(palette, colourPhase, smoothPalette);
    return { receiverType: 'RGBW', variant: effect.variant, engine: effect.engine, formula: effect.previewFormula,
      rgb: selected.rgb, white: selected.white, amount: clamp(amount, 0, 1, 0) * clamp(state.brightness, 0, 100, 100) / 100,
      uniform: true, spatialResolution: 'logical-line', logicalLineIndex: line };
  }

  function opticalRgb(sample) {
    var warm = [248, 225, 195];
    var amount = clamp(sample.amount, 0, 1, 0);
    var bg = sample.background;
    var backgroundWhite = bg ? bg.white * bg.brightness : 0;
    var white = (backgroundWhite + (clamp(sample.white, 0, 255, 0) - backgroundWhite) * amount) / 255;
    return sample.rgb.map(function (channel, index) {
      var backgroundChannel = bg ? bg.rgb[index] * bg.brightness : 0;
      var linear = backgroundChannel + (clamp(channel, 0, 255, 0) - backgroundChannel) * amount;
      var mixed = 255 - (255 - linear) * (1 - warm[index] / 255 * white);
      return Math.round(mixed * (sample.brightness == null ? 1 : sample.brightness));
    });
  }

  function tuple(effect) { return [effect.name, effect.engine, effect.category, effect.variant, effectState(effect)]; }
  function variantOf(runtime, effect) {
    return typeof runtime.effectWireVariant === 'function' ? Number(runtime.effectWireVariant(effect)) : Number(effect && effect[3]);
  }
  function replaceVariants(target, variants, runtime, additions) {
    if (!Array.isArray(target)) return;
    var keep = target.filter(function (item) { return variants.indexOf(variantOf(runtime, item)) < 0; });
    target.splice.apply(target, [0, target.length].concat(keep).concat(additions));
  }

  function install(win) {
    if (!win || !win.AluvisionAnimationRuntime) throw new Error('Aluvision animation runtime is unavailable');
    if (win.AluvisionV21AnimationCatalogInstalled) return win.AluvisionV21AnimationCatalogInstalled;
    var runtime = win.AluvisionAnimationRuntime;
    var canonicalTuples = SPI_EFFECTS.map(tuple);
    var spiVariants = SPI_EFFECTS.map(function (item) { return item.variant; });
    replaceVariants(runtime.effects, spiVariants, runtime, canonicalTuples);
    replaceVariants(runtime.multiLineEffects, SPI_TUNNELS.map(function (item) { return item.variant; }), runtime, SPI_TUNNELS.map(tuple));
    replaceVariants(runtime.tunnelSupplementalEffects, SPI_TUNNELS.map(function (item) { return item.variant; }), runtime, SPI_TUNNELS.map(tuple));

    if (Array.isArray(runtime.rgbwEffects)) {
      var canonicalKeys = new Set(RGBW_EFFECTS.map(function (item) { return item.engine + ':' + item.variant; }));
      var retained = runtime.rgbwEffects.filter(function (item) {
        return !canonicalKeys.has(String(item.engine || '').toUpperCase() + ':' + Number(item.variant));
      });
      var rgbwEntries = RGBW_EFFECTS.map(function (item) {
        return { name: item.name, engine: item.engine, variant: item.variant, colors: item.colors,
          variable: item.colors > 1, line: item.kind === 'tunnel-lines', icon: item.kind === 'tunnel-lines' ? '≋' : '◌',
          settings: Object.keys(item.defaults).filter(function (key) { return ['speed', 'smooth', 'spacing', 'lineDelayMs', 'direction'].indexOf(key) >= 0; }).concat(['colors']),
          defaults: clone(item.defaults), description: clone(item.description) };
      });
      runtime.rgbwEffects.splice.apply(runtime.rgbwEffects, [0, runtime.rgbwEffects.length].concat(retained).concat(rgbwEntries));
    }

    var previousCapabilities = runtime.effectCapabilities;
    runtime.effectCapabilities = function (effect) {
      var variant = variantOf(runtime, effect);
      var canonical = SPI_BY_VARIANT[variant];
      return canonical ? clone(canonical.capabilities) : previousCapabilities(effect);
    };
    var previousColorCount = runtime.effectColorCount;
    runtime.effectColorCount = function (effect) {
      var canonical = SPI_BY_VARIANT[variantOf(runtime, effect)];
      return canonical ? canonical.defaults.colorCount : previousColorCount(effect);
    };
    var previousDescription = runtime.effectDescription;
    runtime.effectDescription = function (effect) {
      var canonical = SPI_BY_VARIANT[variantOf(runtime, effect)];
      if (!canonical) return previousDescription(effect);
      var language = 'nl';
      try { language = runtime.academyLanguage ? runtime.academyLanguage() : 'nl'; } catch (_) { /* Dutch fallback */ }
      return canonical.description[language] || canonical.description.en || canonical.description.nl;
    };
    if ('v1811EffectDescription' in runtime) runtime.v1811EffectDescription = runtime.effectDescription;
    var previousPixel = runtime.animationPixel;
    runtime.animationPixel = function (state, coordinate, time, index, pixelCount) {
      var variant = Number(state && state.variant);
      if (!SPI_BY_VARIANT[variant]) return previousPixel.apply(this, arguments);
      return opticalRgb(sampleSpiPixel(state, coordinate, time, pixelCount, state.lineIndex, state.lineCount));
    };
    var previousRgbw = runtime.rgbwPreviewSample;
    runtime.rgbwPreviewSample = function (state, lineIndex, lineCount, time) {
      if (!rgbwEffectForState(state)) return previousRgbw.apply(this, arguments);
      var sample = sampleRgbwLine(state, lineIndex, lineCount, time);
      return { color: opticalRgb(sample), amount: 1, uniform: true, spatialResolution: 'logical-line' };
    };
    var installed = Object.freeze({ version: VERSION, protocol: PROTOCOL, canonicalSpiCount: SPI_EFFECTS.length,
      canonicalRgbwCount: RGBW_EFFECTS.length, migrateLegacyNames: migrateLegacyNames });
    win.AluvisionV21AnimationCatalogInstalled = installed;
    return installed;
  }

  function validate() {
    var errors = [];
    var variants = new Set();
    var names = new Set();
    var formulas = new Set();
    SPI_EFFECTS.forEach(function (effect) {
      if (variants.has(effect.variant)) errors.push('duplicate SPI variant ' + effect.variant);
      if (names.has(effect.name)) errors.push('duplicate SPI name ' + effect.name);
      if (formulas.has(effect.previewFormula)) errors.push('duplicate SPI formula ' + effect.previewFormula);
      variants.add(effect.variant); names.add(effect.name); formulas.add(effect.previewFormula);
      if (effect.receiverType !== 'SPI' || !effect.engine || !effect.defaults.palette.length) errors.push('incomplete SPI effect ' + effect.name);
    });
    var rgbwKeys = new Set();
    var rgbwFormulas = new Set();
    RGBW_EFFECTS.forEach(function (effect) {
      var key = effect.engine + ':' + effect.variant;
      if (rgbwKeys.has(key)) errors.push('duplicate RGBW wire key ' + key);
      if (rgbwFormulas.has(effect.previewFormula)) errors.push('duplicate RGBW formula ' + effect.previewFormula);
      rgbwKeys.add(key);
      rgbwFormulas.add(effect.previewFormula);
      if (effect.spatialResolution !== 'logical-line') errors.push('RGBW pixel preview ' + effect.name);
    });
    if (errors.length) throw new Error(errors.join('; '));
    return true;
  }

  validate();
  return Object.freeze({
    version: VERSION, protocol: PROTOCOL,
    spiEffects: SPI_EFFECTS, spiTunnelEffects: SPI_TUNNELS, spiGeneralEffects: SPI_GENERAL,
    rgbwEffects: RGBW_EFFECTS, legacyNameMap: LEGACY_NAME_MAP,
    canonicalName: canonicalName, migrateLegacyNames: migrateLegacyNames,
    effectState: effectState, sampleSpiPixel: sampleSpiPixel, sampleRgbwLine: sampleRgbwLine,
    opticalRgb: opticalRgb, install: install, validate: validate
  });
}));
