/* Local V30 UI preferences only. No receiver/installation state or V21 keys.
 * Translations are explicit text lookups, never a mutation of arbitrary DOM
 * or user-created names. This compact dictionary does not translate the whole
 * app: the corresponding work-in-progress notice states that boundary.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LightningPreferences = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const STORAGE_KEY = 'aluvision.v30.ui-preferences.v1';
  const defaults = Object.freeze({ language: 'nl', theme: 'light' });
  const languages = Object.freeze([
    Object.freeze({ code: 'nl', name: 'Nederlands' }),
    Object.freeze({ code: 'en', name: 'English' }),
    Object.freeze({ code: 'fr', name: 'Français' }),
    Object.freeze({ code: 'de', name: 'Deutsch' })
  ]);
  const themes = Object.freeze(['light', 'dark']);
  const texts = {
    nl: {
      stand: 'Stand', zones: 'Zones', receivers: 'Receivers', scenes: 'Scènes', more: 'Meer',
      staticColour: 'Vaste kleur', animations: 'Animaties', layout: 'Opstelling', controls: 'Bediening',
      chooseAnimation: 'Kies een animatie', otherAnimation: 'Andere animatie', backToAnimations: 'Terug naar animaties', allFamilies: 'Alle effectfamilies',
      together: 'Alle ledlines samen', addReceiver: 'Receiver toevoegen', setupStand: 'Mijn stand instellen', settings: 'Instellingen', myColours: 'Kleurpresets',
      scopePrompt: 'Wat wil je bedienen?', scopeIndividual: 'Kies één ledline, of tik meerdere aan om ze samen te bedienen', scopeSeparate: 'Ledlines kiezen', scopeSeparateHint: '{count} beschikbaar · kies er één of meer', scopeLine: 'Ledline {number}', scopeCountOne: '1 ledline', scopeCountMany: '{count} ledlines', scopeTogetherOne: '1 ledline tegelijk', scopeTogetherMany: '{count} ledlines tegelijk', scopeAllAria: 'Alle ledlines samen bedienen', scopeLineAria: 'Ledline {number} · {type} bedienen', scopeSelectedLine: 'Ledline {number} · {type}', scopeSelectedLines: '{count} ledlines · {numbers}',
      manage: 'Beheren', newColour: 'Nieuwe kleur', saveColour: 'Kleur opslaan', newScene: 'Huidig licht bewaren', saveScene: 'Sfeer bewaren',
      colourOrder: 'Volgorde wijzigen', done: 'Klaar', saveCurrentColour: 'Ingestelde kleur toevoegen',
      animationGallery: 'Alle animaties',
      appearance: 'Weergave', language: 'Taal', theme: 'Thema', light: 'Licht', dark: 'Donker', readiness: 'Status werkversie',
      wipNotice: 'De navigatie en hoofdknoppen zijn vertaald. Langere ontwerpteksten zijn voorlopig nog Nederlands.',
      back: 'Terug', close: 'Sluiten', cancel: 'Annuleren', save: 'Opslaan', delete: 'Verwijderen',
      backToZone: 'Terug naar {name}'
    },
    en: {
      stand: 'Booth', zones: 'Zones', receivers: 'Receivers', scenes: 'Scenes', more: 'More',
      staticColour: 'Static colour', animations: 'Animations', layout: 'Layout', controls: 'Controls',
      chooseAnimation: 'Choose an animation', otherAnimation: 'Change animation', backToAnimations: 'Back to animations', allFamilies: 'All effect families',
      together: 'All LED lines together', addReceiver: 'Add receiver', setupStand: 'Set up my booth', settings: 'Settings', myColours: 'Colour presets',
      scopePrompt: 'What do you want to control?', scopeIndividual: 'Choose one LED line, or tap several to control them together', scopeSeparate: 'Choose LED lines', scopeSeparateHint: '{count} available · choose one or more', scopeLine: 'LED line {number}', scopeCountOne: '1 LED line', scopeCountMany: '{count} LED lines', scopeTogetherOne: '1 LED line at once', scopeTogetherMany: '{count} LED lines at once', scopeAllAria: 'Control all LED lines together', scopeLineAria: 'LED line {number} · {type}', scopeSelectedLine: 'LED line {number} · {type}', scopeSelectedLines: '{count} LED lines · {numbers}',
      manage: 'Manage', newColour: 'New colour', saveColour: 'Save colour', newScene: 'Save current lighting', saveScene: 'Save atmosphere',
      colourOrder: 'Change order', done: 'Done', saveCurrentColour: 'Add current colour',
      animationGallery: 'All animations',
      appearance: 'Appearance', language: 'Language', theme: 'Theme', light: 'Light', dark: 'Dark', readiness: 'Preview status',
      wipNotice: 'Navigation and main controls are translated. Longer design notes remain in Dutch for now.',
      back: 'Back', close: 'Close', cancel: 'Cancel', save: 'Save', delete: 'Delete',
      backToZone: 'Back to {name}'
    },
    fr: {
      stand: 'Stand', zones: 'Zones', receivers: 'Récepteurs', scenes: 'Scènes', more: 'Plus',
      staticColour: 'Couleur fixe', animations: 'Animations', layout: 'Disposition', controls: 'Commandes',
      chooseAnimation: 'Choisir une animation', otherAnimation: 'Autre animation', backToAnimations: 'Retour aux animations', allFamilies: 'Toutes les familles d’effets',
      together: 'Toutes les lignes ensemble', addReceiver: 'Ajouter un récepteur', setupStand: 'Configurer mon stand', settings: 'Réglages', myColours: 'Couleurs enregistrées',
      scopePrompt: 'Que voulez-vous commander ?', scopeIndividual: 'Choisissez une ligne LED ou touchez-en plusieurs pour les commander ensemble', scopeSeparate: 'Choisir les lignes LED', scopeSeparateHint: '{count} disponibles · choisissez-en une ou plusieurs', scopeLine: 'Ligne LED {number}', scopeCountOne: '1 ligne LED', scopeCountMany: '{count} lignes LED', scopeTogetherOne: '1 ligne LED à la fois', scopeTogetherMany: '{count} lignes LED à la fois', scopeAllAria: 'Commander toutes les lignes LED ensemble', scopeLineAria: 'Ligne LED {number} · {type}', scopeSelectedLine: 'Ligne LED {number} · {type}', scopeSelectedLines: '{count} lignes LED · {numbers}',
      manage: 'Gérer', newColour: 'Nouvelle couleur', saveColour: 'Enregistrer la couleur', newScene: 'Enregistrer cet éclairage', saveScene: 'Enregistrer l’ambiance',
      colourOrder: 'Modifier l’ordre', done: 'Terminé', saveCurrentColour: 'Ajouter la couleur actuelle',
      animationGallery: 'Galerie d’animations',
      appearance: 'Apparence', language: 'Langue', theme: 'Thème', light: 'Clair', dark: 'Sombre', readiness: 'État de la version de travail',
      wipNotice: 'La navigation et les commandes principales sont traduites. Les textes explicatifs plus longs restent en néerlandais pour le moment.',
      back: 'Retour', close: 'Fermer', cancel: 'Annuler', save: 'Enregistrer', delete: 'Supprimer',
      backToZone: 'Retour à {name}'
    },
    de: {
      stand: 'Stand', zones: 'Zonen', receivers: 'Empfänger', scenes: 'Szenen', more: 'Mehr',
      staticColour: 'Feste Farbe', animations: 'Animationen', layout: 'Anordnung', controls: 'Bedienung',
      chooseAnimation: 'Animation auswählen', otherAnimation: 'Andere Animation', backToAnimations: 'Zurück zu den Animationen', allFamilies: 'Alle Effektfamilien',
      together: 'Alle LED-Linien gemeinsam', addReceiver: 'Empfänger hinzufügen', setupStand: 'Meinen Stand einrichten', settings: 'Einstellungen', myColours: 'Farbpresets',
      scopePrompt: 'Was möchtest du steuern?', scopeIndividual: 'Wähle eine LED-Linie oder tippe mehrere an, um sie gemeinsam zu steuern', scopeSeparate: 'LED-Linien auswählen', scopeSeparateHint: '{count} verfügbar · eine oder mehrere auswählen', scopeLine: 'LED-Linie {number}', scopeCountOne: '1 LED-Linie', scopeCountMany: '{count} LED-Linien', scopeTogetherOne: '1 LED-Linie gleichzeitig', scopeTogetherMany: '{count} LED-Linien gleichzeitig', scopeAllAria: 'Alle LED-Linien gemeinsam steuern', scopeLineAria: 'LED-Linie {number} · {type} steuern', scopeSelectedLine: 'LED-Linie {number} · {type}', scopeSelectedLines: '{count} LED-Linien · {numbers}',
      manage: 'Verwalten', newColour: 'Neue Farbe', saveColour: 'Farbe speichern', newScene: 'Aktuelles Licht speichern', saveScene: 'Stimmung speichern',
      colourOrder: 'Reihenfolge ändern', done: 'Fertig', saveCurrentColour: 'Aktuelle Farbe hinzufügen',
      animationGallery: 'Animationsgalerie',
      appearance: 'Darstellung', language: 'Sprache', theme: 'Design', light: 'Hell', dark: 'Dunkel', readiness: 'Status der Arbeitsversion',
      wipNotice: 'Navigation und wichtigste Bedienelemente sind übersetzt. Längere Erläuterungen bleiben vorerst auf Niederländisch.',
      back: 'Zurück', close: 'Schließen', cancel: 'Abbrechen', save: 'Speichern', delete: 'Löschen',
      backToZone: 'Zurück zu {name}'
    }
  };
  // State labels for the LED-line chooser's disclosure control.
  const scopeCloseLabels = {
    nl: { scopeClose: 'Ledlines verbergen', scopeCloseHint: 'Tik om de lijst te sluiten' },
    en: { scopeClose: 'Hide LED lines', scopeCloseHint: 'Tap to close the list' },
    fr: { scopeClose: 'Masquer les lignes LED', scopeCloseHint: 'Touchez pour fermer la liste' },
    de: { scopeClose: 'LED-Linien ausblenden', scopeCloseHint: 'Tippen, um die Liste zu schließen' }
  };
  Object.keys(scopeCloseLabels).forEach(code => Object.assign(texts[code], scopeCloseLabels[code]));
  Object.keys(texts).forEach(code => Object.freeze(texts[code]));
  Object.freeze(texts);
  const has = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const plain = value => !!value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value));
  const validLanguage = value => languages.some(language => language.code === value);
  const validTheme = value => themes.includes(value);
  function t(key, language = 'nl', params = {}) {
    const dictionary = texts[validLanguage(language) ? language : 'nl'];
    const text = typeof key === 'string' && has(dictionary, key) ? dictionary[key] : typeof key === 'string' ? key : '';
    return text.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (match, name) => {
      if (!plain(params) || !has(params, name) || !['string', 'number'].includes(typeof params[name])) return match;
      return String(params[name]);
    });
  }
  function preferences(value, partial = false) {
    if (!plain(value) || Object.keys(value).some(key => !['language', 'theme'].includes(key)) ||
      (!partial && (!has(value, 'language') || !has(value, 'theme')))) return null;
    if (has(value, 'language') && !validLanguage(value.language) || has(value, 'theme') && !validTheme(value.theme)) return null;
    return Object.assign({}, value);
  }
  function response(value = defaults, error = null) { return { preferences: Object.assign({}, value), error }; }
  function createStore(storage) {
    function load() {
      let raw;
      try {
        if (!storage || typeof storage.getItem !== 'function') return response(defaults, { code: 'STORAGE_UNAVAILABLE', message: 'Voorkeuren kunnen hier niet lokaal worden bewaard.' });
        raw = storage.getItem(STORAGE_KEY);
      } catch (_) { return response(defaults, { code: 'STORAGE_UNAVAILABLE', message: 'De lokale voorkeuren zijn niet bereikbaar.' }); }
      if (raw === null || raw === undefined) return response();
      try {
        if (typeof raw !== 'string' || raw.length > 1024) throw new Error('Invalid length');
        const envelope = JSON.parse(raw);
        if (!plain(envelope) || Object.keys(envelope).some(key => !['version', 'preferences'].includes(key)) || envelope.version !== 1) throw new Error('Unknown version');
        const validated = preferences(envelope.preferences);
        if (!validated) throw new Error('Invalid preferences');
        return response(validated);
      } catch (_) { return response(defaults, { code: 'STORAGE_CORRUPT', message: 'De opgeslagen voorkeuren zijn ongeldig. Ze zijn niet overschreven.' }); }
    }
    function save(patch) {
      const current = load();
      if (current.error) return current;
      const validated = preferences(patch, true);
      if (!validated) return response(current.preferences, { code: 'PREFERENCE_VALUE', message: 'Kies een ondersteunde taal en een licht of donker thema.' });
      const next = Object.assign({}, current.preferences, validated);
      if (next.language === current.preferences.language && next.theme === current.preferences.theme) return current;
      try {
        if (!storage || typeof storage.setItem !== 'function') return response(current.preferences, { code: 'STORAGE_UNAVAILABLE', message: 'Voorkeuren kunnen hier niet lokaal worden bewaard.' });
        storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, preferences: next }));
        return response(next);
      } catch (_) { return response(current.preferences, { code: 'STORAGE_WRITE', message: 'De voorkeuren konden niet worden bewaard. Je vorige keuze blijft behouden.' }); }
    }
    // Reset only this validated namespace. Never clear installation, PIN,
    // saved colours, presets or scene storage, including on write failure.
    function reset() { return save(defaults); }
    return Object.freeze({ load, save, reset });
  }
  return Object.freeze({ STORAGE_KEY, defaults, languages, themes, keys: Object.freeze(Object.keys(texts.nl)), t, createStore });
}));
