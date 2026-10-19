/* Local interface policy only. No storage, lighting state, native calls,
 * installation schema or receiver capabilities are changed by this module.
 * The complete catalogue remains authoritative for saved/current playback;
 * the short list is solely a reversible browsing and explicit-action policy.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LightningInterfaceMode = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const PULSE_IDS = Object.freeze(['rgbw-breathe-1', 'spi-breathe-99']);
  const COMMON_IDS = Object.freeze(['v30-rgb-jumping', 'v30-rgb-gradient']);
  const SPI_IDS = Object.freeze(['spi-chase-8', 'spi-wave-29']);
  const ADVANCED_ACTIONS = new Set([
    'layout', 'line-setup-open', 'layout-receiver-settings', 'draft-layout',
    'order-colour-open', 'order-assign-colour', 'order-place-choice',
    'order-up', 'order-down', 'order-test-start', 'order-test-confirm',
    'order-tutorial-open', 'order-guide-replay',
    'spatial-toggle', 'spatial-mode', 'spatial-topology', 'set-layout',
    'family-spatial-layout', 'preview-size', 'preview-fullscreen', 'select',
    'family', 'animation-categories', 'animation-category-choice',
    'animation-category-tab', 'library',
    'tunnel-animation-setup', 'tunnel-animation-start-confirm',
    'settings-toggle', 'direction', 'effect-boolean',
    'background-toggle', 'background-edit',
    'brand-tone', 'brand-colour-edit', 'brand-colour-add', 'brand-colour-remove',
    'colours-manage', 'colours-manager',
    'preset-save', 'preset-confirm', 'preset-apply',
    'preset-delete', 'preset-delete-confirm'
  ]);
  const texts = {
    nl: {
      interfaceModeTitle: 'Geavanceerde bediening',
      interfaceModeSimple: 'Eenvoudig',
      interfaceModeAdvanced: 'Geavanceerd',
      interfaceModeSimpleHint: 'Kleuren en een kleine keuze aan animaties.',
      interfaceModeAdvancedHint: 'Alle animaties, ledlines en extra instellingen.',
      interfaceModePreservation: 'Je verlichting en opgeslagen instellingen blijven behouden.',
      interfaceModeSaveFailed: 'Je weergavekeuze kon niet worden bewaard. Je vorige instelling blijft behouden.',
      basicAnimationTitle: 'Kies een eenvoudige animatie',
      basicAnimationHint: 'Kies kleuren en pas snelheid en helderheid aan.',
      basicAdvancedCurrentTitle: 'Je ingestelde verlichting blijft behouden',
      basicAdvancedCurrentHint: 'Deze animatie gebruikt geavanceerde opties. Zet geavanceerde bediening aan om die aan te passen.',
      basicAdvancedCurrentAction: 'Open instellingen',
      basicWholeZone: 'Hele zone',
      basicWheelAccessible: 'Kleurenwiel. Kies een kleur of gebruik de pijltjestoetsen.',
      basicJumpHint: 'Jouw kleuren wisselen af. Kies de kleuren en stel de snelheid in.',
      basicGradientHint: 'Jouw kleuren vloeien zacht in elkaar over.'
    },
    en: {
      interfaceModeTitle: 'Advanced controls',
      interfaceModeSimple: 'Simple',
      interfaceModeAdvanced: 'Advanced',
      interfaceModeSimpleHint: 'Colours and a small selection of animations.',
      interfaceModeAdvancedHint: 'All animations, LED lines and extra settings.',
      interfaceModePreservation: 'Your lighting and saved settings are preserved.',
      interfaceModeSaveFailed: 'Your display preference could not be saved. Your previous setting is preserved.',
      basicAnimationTitle: 'Choose a simple animation',
      basicAnimationHint: 'Choose colours and adjust speed and brightness.',
      basicAdvancedCurrentTitle: 'Your lighting settings are preserved',
      basicAdvancedCurrentHint: 'This animation uses advanced options. Turn on advanced controls to adjust it.',
      basicAdvancedCurrentAction: 'Open settings',
      basicWholeZone: 'Whole zone',
      basicWheelAccessible: 'Colour wheel. Choose a colour or use the arrow keys.',
      basicJumpHint: 'Your colours alternate. Choose the colours and set the speed.',
      basicGradientHint: 'Your colours blend smoothly into each other.'
    },
    fr: {
      interfaceModeTitle: 'Commandes avancées',
      interfaceModeSimple: 'Simple',
      interfaceModeAdvanced: 'Avancé',
      interfaceModeSimpleHint: 'Des couleurs et une petite sélection d’animations.',
      interfaceModeAdvancedHint: 'Toutes les animations, les lignes LED et les réglages supplémentaires.',
      interfaceModePreservation: 'Votre éclairage et vos réglages enregistrés sont conservés.',
      interfaceModeSaveFailed: 'Votre préférence d’affichage n’a pas pu être enregistrée. Votre réglage précédent est conservé.',
      basicAnimationTitle: 'Choisissez une animation simple',
      basicAnimationHint: 'Choisissez les couleurs et réglez la vitesse et la luminosité.',
      basicAdvancedCurrentTitle: 'Vos réglages d’éclairage sont conservés',
      basicAdvancedCurrentHint: 'Cette animation utilise des options avancées. Activez les commandes avancées pour la modifier.',
      basicAdvancedCurrentAction: 'Ouvrir les réglages',
      basicWholeZone: 'Toute la zone',
      basicWheelAccessible: 'Roue chromatique. Choisissez une couleur ou utilisez les flèches.',
      basicJumpHint: 'Vos couleurs alternent. Choisissez les couleurs et réglez la vitesse.',
      basicGradientHint: 'Vos couleurs se fondent doucement les unes dans les autres.'
    },
    de: {
      interfaceModeTitle: 'Erweiterte Bedienung',
      interfaceModeSimple: 'Einfach',
      interfaceModeAdvanced: 'Erweitert',
      interfaceModeSimpleHint: 'Farben und eine kleine Auswahl an Animationen.',
      interfaceModeAdvancedHint: 'Alle Animationen, LED-Linien und zusätzlichen Einstellungen.',
      interfaceModePreservation: 'Ihre Beleuchtung und gespeicherten Einstellungen bleiben erhalten.',
      interfaceModeSaveFailed: 'Ihre Anzeigeeinstellung konnte nicht gespeichert werden. Ihre bisherige Einstellung bleibt erhalten.',
      basicAnimationTitle: 'Eine einfache Animation wählen',
      basicAnimationHint: 'Farben wählen sowie Geschwindigkeit und Helligkeit anpassen.',
      basicAdvancedCurrentTitle: 'Ihre Lichteinstellungen bleiben erhalten',
      basicAdvancedCurrentHint: 'Diese Animation verwendet erweiterte Optionen. Aktivieren Sie die erweiterte Bedienung, um sie anzupassen.',
      basicAdvancedCurrentAction: 'Einstellungen öffnen',
      basicWholeZone: 'Ganze Zone',
      basicWheelAccessible: 'Farbkreis. Farbe wählen oder die Pfeiltasten verwenden.',
      basicJumpHint: 'Ihre Farben wechseln sich ab. Farben und Geschwindigkeit wählen.',
      basicGradientHint: 'Ihre Farben gehen sanft ineinander über.'
    }
  };
  Object.values(texts).forEach(Object.freeze);
  Object.freeze(texts);
  const owns = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const advanced = context => context?.advancedEnabled !== false;
  const spiZone = context => context?.stand !== true && context?.type === 'SPI';
  const effectId = effect => effect && typeof effect === 'object' && typeof effect.id === 'string' ? effect.id : null;

  function allowsEffect(effect, context) {
    const id = effectId(effect);
    if (!id) return false;
    if (advanced(context)) return true;
    return PULSE_IDS.includes(id) || COMMON_IDS.includes(id) || spiZone(context) && SPI_IDS.includes(id);
  }

  function visibleCatalog(items, context) {
    if (!Array.isArray(items)) throw new TypeError('An animation catalogue is required');
    // Copy the list, never freeze or rewrite the caller's array or recipes.
    if (advanced(context)) return Object.freeze([...items]);
    const byId = new Map();
    for (const item of items) {
      const id = effectId(item);
      if (id && !byId.has(id)) byId.set(id, item);
    }
    const preferredPulse = spiZone(context) ? [...PULSE_IDS].reverse() : PULSE_IDS;
    const pulse = preferredPulse.find(id => byId.has(id));
    const ids = [...(pulse ? [pulse] : []), ...COMMON_IDS, ...(spiZone(context) ? SPI_IDS : [])];
    return Object.freeze(ids.flatMap(id => byId.has(id) ? [byId.get(id)] : []));
  }

  // Call only in simple mode. Closing/cancelling, receiver setup/recovery,
  // scenes, power, colours and the dynamic effect action stay available.
  // Callers separately validate effect IDs and slider keys for the mode.
  function blockedAction(action) {
    return typeof action === 'string' && ADVANCED_ACTIONS.has(action);
  }

  function has(key) {
    return typeof key === 'string' && owns(texts.nl, key);
  }
  function t(key, language = 'nl') {
    if (!has(key)) return typeof key === 'string' ? key : '';
    const dictionary = typeof language === 'string' && owns(texts, language) ? texts[language] : texts.nl;
    return dictionary[key];
  }
  return Object.freeze({visibleCatalog, allowsEffect, blockedAction, t, has});
}));
