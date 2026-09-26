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
      animationPreview: 'Voorbeeld', animationBadgeForType: 'Animaties voor {type}-ledlines', animationCountOne: '1 animatie', animationCountMany: '{count} animaties', viewAnimation: 'Bekijk animatie', viewAnimationCount: 'Bekijk {count} animaties', hideAnimationOptions: 'Animaties sluiten',
      together: 'Alle ledlines samen', addReceiver: 'Receiver toevoegen', setupStand: 'Mijn stand instellen', settings: 'Instellingen', myColours: 'Kleurpresets',
      scopePrompt: 'Ledlines bedienen', scopeIndividual: 'Kies één of meer ledlines', scopeSeparate: 'Ledlines kiezen', scopeSeparateHint: '{count} beschikbaar · tik om te kiezen', scopeSingleHint: '1 van {count} ledlines · tik om te wisselen', scopeMultiHint: '{count} geselecteerd · tik om te wijzigen', scopeChooseAria: 'Ledlines kiezen', scopeLine: 'Ledline {number}', scopeCountOne: '1 ledline', scopeCountMany: '{count} ledlines', scopeTogetherOne: 'Bedient deze ledline', scopeTogetherMany: 'Bedient alle {count} ledlines', scopeTotalSpiOne: '1 ledline · {pixels} pixels totaal', scopeTotalSpiMany: '{count} ledlines · {pixels} pixels totaal', scopeAllAria: 'Alle ledlines samen bedienen', scopeLineAria: 'Ledline {number} · {type} bedienen', scopeSelectedLine: 'Ledline {number} · {type}', scopeSelectedTap: '{name} gekozen · tik om te wisselen', scopeSelectedLines: '{count} ledlines · {numbers}',
      manage: 'Beheren', newColour: 'Nieuwe kleur', saveColour: 'Kleur opslaan', newScene: 'Huidig licht bewaren', saveScene: 'Sfeer bewaren',
      colourOrder: 'Volgorde wijzigen', done: 'Klaar', saveCurrentColour: 'Ingestelde kleur toevoegen',
      animationGallery: 'Alle animaties',
      animationNavigation: 'Animatie kiezen of instellen', animationChooseAnother: 'Andere animatie kiezen', animationBackToSettings: 'Terug naar instellingen',
      appearance: 'Weergave', language: 'Taal', theme: 'Thema', light: 'Licht', dark: 'Donker', readiness: 'Status werkversie',
      wipNotice: 'De navigatie en hoofdknoppen zijn vertaald. Langere ontwerpteksten zijn voorlopig nog Nederlands.',
      back: 'Terug', close: 'Sluiten', cancel: 'Annuleren', save: 'Opslaan', delete: 'Verwijderen',
      backToZone: 'Terug naar {name}',
      softwareUpdates: 'Software-updates', softwareUpdateSubtitle: 'Controleer de receivers in deze stand.',
      softwareUpdateSection: 'Receiver-software', softwareUpdateButton: 'Controleer en update alle receivers',
      softwareUpdateKeepOpen: 'Blijf op het ALUVISION-wifi en houd deze pagina open.',
      softwareUpdateSequence: 'Receivers worden één voor één bijgewerkt; de hoofdreceiver als laatste.',
      softwarePreparing: 'Update voorbereiden', softwareSending: 'Software versturen',
      softwareConnectionChecking: 'Verbinding met receiver controleren',
      softwareVerifying: 'Software controleren', softwareRestarting: 'Receiver start opnieuw',
      softwareChecking: 'Versie controleren…', softwareUpdateAvailable: 'Update beschikbaar · {current} → {version}',
      softwareUpToDate: 'Bijgewerkt · {version}', softwareUpdateOne: 'Update 1 receiver',
      softwareUpdateMany: 'Update alle {count} receivers', softwareCheckAgain: 'Opnieuw controleren',
      softwareResumeCheck: 'Herstart controleren', softwareCancel: 'Update annuleren',
      softwareCancelled: 'Update geannuleerd', softwareCancelling: 'Update annuleren…',
      softwareAllCurrent: 'Alles is bijgewerkt.', softwareCurrent: 'Receiver {current} van {total} bijwerken',
      softwareRunning: 'Update bezig · {percent}%', softwareWaiting: 'Wacht op de vorige receiver',
      softwarePreflight: 'Alle receivers controleren…', softwareFailed: 'Update niet bevestigd',
      softwareFailedGeneral: 'Deze update is niet bevestigd. De volgende receiver is niet bijgewerkt.',
      softwareErrorConnection: 'Controleer of je verbonden bent met het ALUVISION-wifi.',
      softwareErrorAck: 'De receiver bevestigde de overdracht niet. Laat hem aan en controleer de verbinding.',
      softwareErrorRestart: 'De update is verstuurd, maar de herstart is nog niet bevestigd. Controleer dezelfde receiver; start geen nieuwe update.',
      softwareErrorRollback: 'De receiver heeft de vorige software automatisch teruggezet.',
      softwareErrorTopology: 'Deze receiververbinding ondersteunt deze update niet.',
      softwareErrorTopologyUnconfirmed: 'De app kon het receivernetwerk niet veilig bevestigen. Controleer de verbinding.',
      softwareErrorTimeout: 'Er kwam geen antwoord van de receiver. Laat hem aan en controleer de verbinding.',
      softwareErrorGeneric: 'De update is niet bevestigd. Er is niets gewist.',
      softwareCheckUnavailable: 'De versie kon niet worden gecontroleerd.',
      softwareUpdateFinished: 'Alle receivers zijn bijgewerkt en gecontroleerd.'
    },
    en: {
      stand: 'Booth', zones: 'Zones', receivers: 'Receivers', scenes: 'Scenes', more: 'More',
      staticColour: 'Static colour', animations: 'Animations', layout: 'Layout', controls: 'Controls',
      chooseAnimation: 'Choose an animation', otherAnimation: 'Change animation', backToAnimations: 'Back to animations', allFamilies: 'All effect families',
      animationPreview: 'Preview', animationBadgeForType: 'Animations for {type} LED lines', animationCountOne: '1 animation', animationCountMany: '{count} animations', viewAnimation: 'View animation', viewAnimationCount: 'View {count} animations', hideAnimationOptions: 'Close animations',
      together: 'All LED lines together', addReceiver: 'Add receiver', setupStand: 'Set up my booth', settings: 'Settings', myColours: 'Colour presets',
      scopePrompt: 'What do you want to control?', scopeIndividual: 'Choose one LED line, or tap several to control them together', scopeSeparate: 'Choose LED lines', scopeSeparateHint: '{count} available · choose one or more', scopeSingleHint: '1 of {count} LED lines · tap to change', scopeMultiHint: '{count} selected · tap to edit', scopeChooseAria: 'Choose LED lines', scopeLine: 'LED line {number}', scopeCountOne: '1 LED line', scopeCountMany: '{count} LED lines', scopeTogetherOne: 'Controls this LED line', scopeTogetherMany: 'Controls all {count} LED lines', scopeTotalSpiOne: '1 LED line · {pixels} pixels total', scopeTotalSpiMany: '{count} LED lines · {pixels} pixels total', scopeAllAria: 'Control all LED lines together', scopeLineAria: 'LED line {number} · {type}', scopeSelectedLine: 'LED line {number} · {type}', scopeSelectedTap: '{name} selected · tap to switch', scopeSelectedLines: '{count} LED lines · {numbers}',
      manage: 'Manage', newColour: 'New colour', saveColour: 'Save colour', newScene: 'Save current lighting', saveScene: 'Save atmosphere',
      colourOrder: 'Change order', done: 'Done', saveCurrentColour: 'Add current colour',
      animationGallery: 'All animations',
      animationNavigation: 'Choose or edit animation', animationChooseAnother: 'Choose another animation', animationBackToSettings: 'Back to settings',
      appearance: 'Appearance', language: 'Language', theme: 'Theme', light: 'Light', dark: 'Dark', readiness: 'Preview status',
      wipNotice: 'Navigation and main controls are translated. Longer design notes remain in Dutch for now.',
      back: 'Back', close: 'Close', cancel: 'Cancel', save: 'Save', delete: 'Delete',
      backToZone: 'Back to {name}',
      softwareUpdates: 'Software updates', softwareUpdateSubtitle: 'Check the receivers in this installation.',
      softwareUpdateSection: 'Receiver software', softwareUpdateButton: 'Check and update all receivers',
      softwareUpdateKeepOpen: 'Stay on the ALUVISION Wi-Fi and keep this page open.',
      softwareUpdateSequence: 'Receivers update one at a time; the main receiver goes last.',
      softwarePreparing: 'Preparing update', softwareSending: 'Sending software',
      softwareConnectionChecking: 'Checking the receiver connection',
      softwareVerifying: 'Checking software', softwareRestarting: 'Receiver restarting',
      softwareChecking: 'Checking version…', softwareUpdateAvailable: 'Update available · {current} → {version}',
      softwareUpToDate: 'Up to date · {version}', softwareUpdateOne: 'Update 1 receiver',
      softwareUpdateMany: 'Update all {count} receivers', softwareCheckAgain: 'Check again',
      softwareResumeCheck: 'Check restart', softwareCancel: 'Cancel update',
      softwareCancelled: 'Update cancelled', softwareCancelling: 'Cancelling update…',
      softwareAllCurrent: 'Everything is up to date.', softwareCurrent: 'Updating receiver {current} of {total}',
      softwareRunning: 'Update in progress · {percent}%', softwareWaiting: 'Waiting for the previous receiver',
      softwarePreflight: 'Checking all receivers…', softwareFailed: 'Update not confirmed',
      softwareFailedGeneral: 'This update was not confirmed. The next receiver was not updated.',
      softwareErrorConnection: 'Check that you are connected to the ALUVISION Wi-Fi.',
      softwareErrorAck: 'The receiver did not confirm the transfer. Keep it powered and check the connection.',
      softwareErrorRestart: 'The update was sent, but the restart is not confirmed. Check this same receiver; do not start another update.',
      softwareErrorRollback: 'The receiver automatically restored its previous software.',
      softwareErrorTopology: 'This receiver connection does not support this update.',
      softwareErrorTopologyUnconfirmed: 'The app could not safely confirm the receiver network. Check the connection.',
      softwareErrorTimeout: 'The receiver did not respond. Keep it powered and check the connection.',
      softwareErrorGeneric: 'The update was not confirmed. Nothing was erased.',
      softwareCheckUnavailable: 'The version could not be checked.',
      softwareUpdateFinished: 'All receivers are updated and verified.'
    },
    fr: {
      stand: 'Stand', zones: 'Zones', receivers: 'Récepteurs', scenes: 'Scènes', more: 'Plus',
      staticColour: 'Couleur fixe', animations: 'Animations', layout: 'Disposition', controls: 'Commandes',
      chooseAnimation: 'Choisir une animation', otherAnimation: 'Autre animation', backToAnimations: 'Retour aux animations', allFamilies: 'Toutes les familles d’effets',
      animationPreview: 'Aperçu', animationBadgeForType: 'Animations pour les lignes LED {type}', animationCountOne: '1 animation', animationCountMany: '{count} animations', viewAnimation: 'Voir l’animation', viewAnimationCount: 'Voir {count} animations', hideAnimationOptions: 'Fermer les animations',
      together: 'Toutes les lignes ensemble', addReceiver: 'Ajouter un récepteur', setupStand: 'Configurer mon stand', settings: 'Réglages', myColours: 'Couleurs enregistrées',
      scopePrompt: 'Que voulez-vous commander ?', scopeIndividual: 'Choisissez une ligne LED ou touchez-en plusieurs pour les commander ensemble', scopeSeparate: 'Choisir les lignes LED', scopeSeparateHint: '{count} disponibles · choisissez-en une ou plusieurs', scopeSingleHint: '1 sur {count} lignes LED · toucher pour modifier', scopeMultiHint: '{count} sélectionnées · toucher pour modifier', scopeChooseAria: 'Choisir les lignes LED', scopeLine: 'Ligne LED {number}', scopeCountOne: '1 ligne LED', scopeCountMany: '{count} lignes LED', scopeTogetherOne: 'Commande cette ligne LED', scopeTogetherMany: 'Commande les {count} lignes LED', scopeTotalSpiOne: '1 ligne LED · {pixels} pixels au total', scopeTotalSpiMany: '{count} lignes LED · {pixels} pixels au total', scopeAllAria: 'Commander toutes les lignes LED ensemble', scopeLineAria: 'Ligne LED {number} · {type}', scopeSelectedLine: 'Ligne LED {number} · {type}', scopeSelectedTap: '{name} sélectionnée · toucher pour changer', scopeSelectedLines: '{count} lignes LED · {numbers}',
      manage: 'Gérer', newColour: 'Nouvelle couleur', saveColour: 'Enregistrer la couleur', newScene: 'Enregistrer cet éclairage', saveScene: 'Enregistrer l’ambiance',
      colourOrder: 'Modifier l’ordre', done: 'Terminé', saveCurrentColour: 'Ajouter la couleur actuelle',
      animationGallery: 'Galerie d’animations',
      animationNavigation: 'Choisir ou régler une animation', animationChooseAnother: 'Choisir une autre animation', animationBackToSettings: 'Retour aux réglages',
      appearance: 'Apparence', language: 'Langue', theme: 'Thème', light: 'Clair', dark: 'Sombre', readiness: 'État de la version de travail',
      wipNotice: 'La navigation et les commandes principales sont traduites. Les textes explicatifs plus longs restent en néerlandais pour le moment.',
      back: 'Retour', close: 'Fermer', cancel: 'Annuler', save: 'Enregistrer', delete: 'Supprimer',
      backToZone: 'Retour à {name}',
      softwareUpdates: 'Mises à jour', softwareUpdateSubtitle: 'Vérifiez les récepteurs de cette installation.',
      softwareUpdateSection: 'Logiciel des récepteurs', softwareUpdateButton: 'Vérifier et mettre à jour tous les récepteurs',
      softwareUpdateKeepOpen: 'Restez connecté au Wi-Fi ALUVISION et gardez cette page ouverte.',
      softwareUpdateSequence: 'Les récepteurs sont mis à jour un par un ; le récepteur principal en dernier.',
      softwarePreparing: 'Préparation de la mise à jour', softwareSending: 'Envoi du logiciel',
      softwareConnectionChecking: 'Vérification de la connexion au récepteur',
      softwareVerifying: 'Vérification du logiciel', softwareRestarting: 'Redémarrage du récepteur',
      softwareChecking: 'Vérification de la version…', softwareUpdateAvailable: 'Mise à jour · {current} → {version}',
      softwareUpToDate: 'À jour · {version}', softwareUpdateOne: 'Mettre à jour 1 récepteur',
      softwareUpdateMany: 'Mettre à jour les {count} récepteurs', softwareCheckAgain: 'Vérifier à nouveau',
      softwareResumeCheck: 'Vérifier le redémarrage', softwareCancel: 'Annuler la mise à jour',
      softwareCancelled: 'Mise à jour annulée', softwareCancelling: 'Annulation de la mise à jour…',
      softwareAllCurrent: 'Tout est à jour.', softwareCurrent: 'Mise à jour du récepteur {current} sur {total}',
      softwareRunning: 'Mise à jour en cours · {percent} %', softwareWaiting: 'En attente du récepteur précédent',
      softwarePreflight: 'Vérification de tous les récepteurs…', softwareFailed: 'Mise à jour non confirmée',
      softwareFailedGeneral: 'Cette mise à jour n’est pas confirmée. Le récepteur suivant n’a pas été mis à jour.',
      softwareErrorConnection: 'Vérifiez la connexion au Wi-Fi ALUVISION.',
      softwareErrorAck: 'Le récepteur n’a pas confirmé le transfert. Laissez-le allumé et vérifiez la connexion.',
      softwareErrorRestart: 'La mise à jour a été envoyée, mais le redémarrage n’est pas confirmé. Vérifiez ce même récepteur ; ne relancez pas une mise à jour.',
      softwareErrorRollback: 'Le récepteur a automatiquement restauré le logiciel précédent.',
      softwareErrorTopology: 'Cette connexion ne permet pas cette mise à jour.',
      softwareErrorTopologyUnconfirmed: 'L’application n’a pas pu confirmer le réseau en toute sécurité. Vérifiez la connexion.',
      softwareErrorTimeout: 'Le récepteur ne répond pas. Laissez-le allumé et vérifiez la connexion.',
      softwareErrorGeneric: 'La mise à jour n’est pas confirmée. Rien n’a été effacé.',
      softwareCheckUnavailable: 'Impossible de vérifier la version.',
      softwareUpdateFinished: 'Tous les récepteurs sont à jour et vérifiés.'
    },
    de: {
      stand: 'Stand', zones: 'Zonen', receivers: 'Empfänger', scenes: 'Szenen', more: 'Mehr',
      staticColour: 'Feste Farbe', animations: 'Animationen', layout: 'Anordnung', controls: 'Bedienung',
      chooseAnimation: 'Animation auswählen', otherAnimation: 'Andere Animation', backToAnimations: 'Zurück zu den Animationen', allFamilies: 'Alle Effektfamilien',
      animationPreview: 'Vorschau', animationBadgeForType: 'Animationen für {type}-LED-Linien', animationCountOne: '1 Animation', animationCountMany: '{count} Animationen', viewAnimation: 'Animation ansehen', viewAnimationCount: '{count} Animationen ansehen', hideAnimationOptions: 'Animationen schließen',
      together: 'Alle LED-Linien gemeinsam', addReceiver: 'Empfänger hinzufügen', setupStand: 'Meinen Stand einrichten', settings: 'Einstellungen', myColours: 'Farbpresets',
      scopePrompt: 'Was möchtest du steuern?', scopeIndividual: 'Wähle eine LED-Linie oder tippe mehrere an, um sie gemeinsam zu steuern', scopeSeparate: 'LED-Linien auswählen', scopeSeparateHint: '{count} verfügbar · eine oder mehrere auswählen', scopeSingleHint: '1 von {count} LED-Linien · antippen zum Ändern', scopeMultiHint: '{count} ausgewählt · antippen zum Ändern', scopeChooseAria: 'LED-Linien auswählen', scopeLine: 'LED-Linie {number}', scopeCountOne: '1 LED-Linie', scopeCountMany: '{count} LED-Linien', scopeTogetherOne: 'Steuert diese LED-Linie', scopeTogetherMany: 'Steuert alle {count} LED-Linien', scopeTotalSpiOne: '1 LED-Linie · {pixels} Pixel insgesamt', scopeTotalSpiMany: '{count} LED-Linien · {pixels} Pixel insgesamt', scopeAllAria: 'Alle LED-Linien gemeinsam steuern', scopeLineAria: 'LED-Linie {number} · {type} steuern', scopeSelectedLine: 'LED-Linie {number} · {type}', scopeSelectedTap: '{name} ausgewählt · antippen zum Wechseln', scopeSelectedLines: '{count} LED-Linien · {numbers}',
      manage: 'Verwalten', newColour: 'Neue Farbe', saveColour: 'Farbe speichern', newScene: 'Aktuelles Licht speichern', saveScene: 'Stimmung speichern',
      colourOrder: 'Reihenfolge ändern', done: 'Fertig', saveCurrentColour: 'Aktuelle Farbe hinzufügen',
      animationGallery: 'Animationsgalerie',
      animationNavigation: 'Animation wählen oder einstellen', animationChooseAnother: 'Andere Animation wählen', animationBackToSettings: 'Zurück zu Einstellungen',
      appearance: 'Darstellung', language: 'Sprache', theme: 'Design', light: 'Hell', dark: 'Dunkel', readiness: 'Status der Arbeitsversion',
      wipNotice: 'Navigation und wichtigste Bedienelemente sind übersetzt. Längere Erläuterungen bleiben vorerst auf Niederländisch.',
      back: 'Zurück', close: 'Schließen', cancel: 'Abbrechen', save: 'Speichern', delete: 'Löschen',
      backToZone: 'Zurück zu {name}',
      softwareUpdates: 'Software-Updates', softwareUpdateSubtitle: 'Receiver in dieser Installation prüfen.',
      softwareUpdateSection: 'Receiver-Software', softwareUpdateButton: 'Alle Receiver prüfen und aktualisieren',
      softwareUpdateKeepOpen: 'Mit dem ALUVISION-WLAN verbunden bleiben und diese Seite geöffnet lassen.',
      softwareUpdateSequence: 'Receiver werden nacheinander aktualisiert; der Hauptreceiver zuletzt.',
      softwarePreparing: 'Update wird vorbereitet', softwareSending: 'Software wird gesendet',
      softwareConnectionChecking: 'Verbindung zum Receiver wird geprüft',
      softwareVerifying: 'Software wird geprüft', softwareRestarting: 'Receiver startet neu',
      softwareChecking: 'Version wird geprüft…', softwareUpdateAvailable: 'Update verfügbar · {current} → {version}',
      softwareUpToDate: 'Aktuell · {version}', softwareUpdateOne: '1 Receiver aktualisieren',
      softwareUpdateMany: 'Alle {count} Receiver aktualisieren', softwareCheckAgain: 'Erneut prüfen',
      softwareResumeCheck: 'Neustart prüfen', softwareCancel: 'Update abbrechen',
      softwareCancelled: 'Update abgebrochen', softwareCancelling: 'Update wird abgebrochen…',
      softwareAllCurrent: 'Alles ist aktuell.', softwareCurrent: 'Receiver {current} von {total} wird aktualisiert',
      softwareRunning: 'Update läuft · {percent} %', softwareWaiting: 'Wartet auf den vorherigen Receiver',
      softwarePreflight: 'Alle Receiver werden geprüft…', softwareFailed: 'Update nicht bestätigt',
      softwareFailedGeneral: 'Dieses Update wurde nicht bestätigt. Der nächste Receiver wurde nicht aktualisiert.',
      softwareErrorConnection: 'Prüfe, ob du mit dem ALUVISION-WLAN verbunden bist.',
      softwareErrorAck: 'Der Receiver hat die Übertragung nicht bestätigt. Eingeschaltet lassen und Verbindung prüfen.',
      softwareErrorRestart: 'Das Update wurde gesendet, aber der Neustart ist nicht bestätigt. Diesen Receiver prüfen; kein neues Update starten.',
      softwareErrorRollback: 'Der Receiver hat die vorherige Software automatisch wiederhergestellt.',
      softwareErrorTopology: 'Diese Receiver-Verbindung unterstützt dieses Update nicht.',
      softwareErrorTopologyUnconfirmed: 'Die App konnte das Receiver-Netzwerk nicht sicher bestätigen. Verbindung prüfen.',
      softwareErrorTimeout: 'Der Receiver antwortet nicht. Eingeschaltet lassen und Verbindung prüfen.',
      softwareErrorGeneric: 'Das Update wurde nicht bestätigt. Es wurde nichts gelöscht.',
      softwareCheckUnavailable: 'Die Version konnte nicht geprüft werden.',
      softwareUpdateFinished: 'Alle Receiver sind aktualisiert und geprüft.'
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
