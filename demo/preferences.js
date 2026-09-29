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
      effects: 'Effecten',
      chooseAnimation: 'Kies een animatie', otherAnimation: 'Andere animatie', backToAnimations: 'Terug naar animaties', allFamilies: 'Alle effectfamilies',
      animationPreview: 'Voorbeeld', animationBadgeForType: 'Animaties voor {type}-ledlines', animationCountOne: '1 animatie', animationCountMany: '{count} animaties', viewAnimation: 'Open animatie', viewAnimationCount: 'Kies uit {count} varianten', hideAnimationOptions: 'Animaties sluiten',
      spatialPreviewTitle: 'Bekijk als', spatialTunnel: 'Tunnel', spatialWall: 'Wand', spatialTunnelPreview: 'Tunnelvoorbeeld', spatialWallPreview: 'Wandvoorbeeld', spatialNormalPreview: 'Normale ledline', spatialContinuousPreview: 'Doorlopende ledline',
      spatialChoiceHint: 'Kies een voorbeeld. Het grote voorbeeld volgt meteen.', spatialTunnelHint: 'Ledlines lopen als lichtbanen door een tunnel.', spatialWallHint: 'Ledlines staan naast elkaar op een wand.', spatialNormalHint: 'Elke RGBW-ledline blijft apart zichtbaar.', spatialNormalSpiHint: 'Kies één gekoppelde lijn of losse ledlines.', spatialTopologyTitle: 'Hoe wil je de SPI-ledlines gebruiken?', spatialTopologyOne: 'Eén doorlopende ledline', spatialTopologyOneHint: 'Alle SPI-ledlines vormen samen één lichtlijn.', spatialTopologySeparate: 'Losse ledlines', spatialTopologySeparateHint: 'Elke SPI-ledline blijft een eigen rij.', spatialSelectedOf: '{count} geselecteerd',
      spatialTunnelUnit: 'Elke boog is één ledline.', spatialWallUnit: 'Elke verticale lijn is één ledline.', spatialNormalUnit: 'Dit voorbeeld toont een normale ledline.', spatialContinuousUnit: 'SPI-ledlines vormen samen één doorlopende lichtlijn.',
      spatialTunnelOrder: 'Van voor naar achter; stel dit in bij ‘Ledlines op volgorde zetten’.', spatialWallOrder: 'Van links naar rechts; stel dit in bij ‘Ledlines op volgorde zetten’.', spatialNormalOrder: 'Stel de volgorde in bij ‘Ledlines op volgorde zetten’.', spatialContinuousOrder: 'De volgorde bepaalt hoe de doorlopende lichtlijn verderloopt.', spatialPreviewOnly: 'Verandert alleen het voorbeeld.', spatialPreviewApplied: 'Past de opstelling direct toe.',
      lineSetupTitle: 'Ledline-opstelling', lineSetupSummary: '{layout} · {count} ledlines',
      lineSetupPurpose: 'Vorm en volgorde bepalen hoe het licht loopt. Je wijzigingen worden meteen toegepast.',
      lineSetupTunnel: 'Tunnel', lineSetupWall: 'Wand', lineSetupContinuous: 'Doorlopend', lineSetupNormal: 'Normale ledline', lineSetupOrient: 'Ledlines op volgorde zetten', lineSetupOrientHint: 'Laat een ledline knipperen en zet die op de juiste plek.',
      lineSetupTunnelHint: 'Van voor naar achter', lineSetupWallHint: 'Van links naar rechts', lineSetupContinuousHint: 'Eén doorlopende lichtlijn', lineSetupNormalHint: 'Gewone RGBW-ledline',
      lineSetupOrder: 'Ledlines op volgorde zetten', lineSetupOrderHint: 'Laat een ledline knipperen om te zien welke het is. Verplaats die naar de juiste plek; de volgorde wordt meteen toegepast.',
      lineSetupChanged: 'De ledlines zijn intussen gewijzigd. Controleer de opstelling en kies opnieuw.',
      lineSetupSaveFailed: 'Toepassen is niet bevestigd. Je ziet de laatst bevestigde opstelling. Kies opnieuw om het nog eens te proberen.',
      lineSetupManage: 'Ledlines toevoegen of aanpassen', lineSetupManageHint: 'Naam, zone en aansluitingen',
      lineSetupChoose: 'Hoe staan je ledlines?',
      lineSetupUp: 'Verplaats {name} naar voren', lineSetupDown: 'Verplaats {name} naar achteren',
      lineSetupLeft: 'Verplaats {name} naar links', lineSetupRight: 'Verplaats {name} naar rechts',
      together: 'Alle ledlines samen', addReceiver: 'Receiver toevoegen', setupStand: 'Mijn stand instellen', settings: 'Instellingen', myColours: 'Kleurpresets',
      scopePrompt: 'Ledlines bedienen', scopeIndividual: 'Kies één of meer ledlines', scopeSeparate: 'Ledlines kiezen', scopeSeparateHint: '{count} beschikbaar · tik om te kiezen', scopeSingleHint: '1 van {count} ledlines · tik om te wisselen', scopeMultiHint: '{count} geselecteerd · tik om te wijzigen', scopeChooseAria: 'Ledlines kiezen', scopeLine: 'Ledline {number}', scopeCountOne: '1 ledline', scopeCountMany: '{count} ledlines', scopeTogetherOne: 'Bedient deze ledline', scopeTogetherMany: 'Bedient alle {count} ledlines', scopeTotalSpiOne: '1 ledline · {pixels} pixels totaal', scopeTotalSpiMany: '{count} ledlines · {pixels} pixels totaal', scopeAllAria: 'Alle ledlines samen bedienen', scopeLineAria: 'Ledline {number} · {type} bedienen', scopeSelectedLine: 'Ledline {number} · {type}', scopeSelectedTap: '{name} gekozen · tik om te wisselen', scopeSelectedLines: '{count} ledlines · {numbers}',
      manage: 'Beheren', newColour: 'Nieuwe kleur', saveColour: 'Kleur opslaan', newScene: 'Huidig licht bewaren', saveScene: 'Sfeer bewaren', updateScene: 'Scène bijwerken',
      colourOrder: 'Volgorde wijzigen', done: 'Klaar', saveCurrentColour: 'Ingestelde kleur toevoegen',
      animationGallery: 'Alle animaties', animationLibraryTitle: 'Animaties',
      animationNavigation: 'Animatie kiezen of instellen', animationChooseAnother: 'Open animatiekiezer', animationCurrentSettingsTitle: 'Pas deze animatie aan', animationSettingsReturnKicker: 'Actieve animatie', animationCurrentSettingsAccessible: 'Ga naar de instellingen van de actieve animatie {name}', animationSettings: 'Animatie-instellingen',
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
      softwareMainRecoveryCheck: 'Hoofdreceiver controleren', softwareMainRecoveryStart: 'Herstelupdate installeren',
      softwareMainRecoveryExplanation: 'Er is een herstelupdate voor je hoofdreceiver. Zones en koppelingen blijven bewaard.',
      softwareMainRecoveryGuidance: 'Herstel eerst de hoofdreceiver. Daarna controleren we de andere receivers opnieuw.',
      softwareCancelled: 'Update geannuleerd', softwareCancelling: 'Update annuleren…',
      softwareAllCurrent: 'Alles is bijgewerkt.', softwareCurrent: 'Receiver {current} van {total} bijwerken',
      softwareRunning: 'Update bezig · {percent}%', softwareWaiting: 'Wacht op de vorige receiver',
      softwarePreflight: 'Alle receivers controleren…', softwareFailed: 'Update niet bevestigd',
      softwareFailedGeneral: 'Deze update is niet bevestigd. De volgende receiver is niet bijgewerkt.',
      softwareErrorConnection: 'Controleer of je verbonden bent met het ALUVISION-wifi.',
      softwareErrorAck: 'De receiver bevestigde de overdracht niet. Laat hem aan en controleer de verbinding.',
      softwareErrorRejected: 'De receiver heeft de update geweigerd. Gebruik de nieuwste appversie en probeer opnieuw.',
      softwareErrorRestart: 'De update is verstuurd, maar de herstart is nog niet bevestigd. Controleer dezelfde receiver; start geen nieuwe update.',
      softwareErrorRollback: 'De receiver heeft de vorige software automatisch teruggezet.',
      softwareErrorTopology: 'Deze receiververbinding ondersteunt deze update niet.',
      softwareErrorTopologyUnconfirmed: 'De app kon het receivernetwerk niet veilig bevestigen. Controleer de verbinding.',
      softwareErrorTimeout: 'Er kwam geen antwoord van de receiver. Laat hem aan en controleer de verbinding.',
      softwareErrorGeneric: 'De update is niet bevestigd. Er is niets gewist.',
      softwareErrorStorage: 'De app kon de updatevoortgang niet veilig bewaren. Laat de receiver aan en controleer de update opnieuw.',
      softwareCheckUnavailable: 'De versie kon niet worden gecontroleerd.',
      softwareUpdateFinished: 'Alle receivers zijn bijgewerkt en gecontroleerd.'
    },
    en: {
      stand: 'Booth', zones: 'Zones', receivers: 'Receivers', scenes: 'Scenes', more: 'More',
      staticColour: 'Static colour', animations: 'Animations', layout: 'Layout', controls: 'Controls',
      effects: 'Effects',
      chooseAnimation: 'Choose an animation', otherAnimation: 'Change animation', backToAnimations: 'Back to animations', allFamilies: 'All effect families',
      animationPreview: 'Preview', animationBadgeForType: 'Animations for {type} LED lines', animationCountOne: '1 animation', animationCountMany: '{count} animations', viewAnimation: 'Open animation', viewAnimationCount: 'Choose from {count} variations', hideAnimationOptions: 'Close animations',
      spatialPreviewTitle: 'View as', spatialTunnel: 'Tunnel', spatialWall: 'Wall', spatialTunnelPreview: 'Tunnel preview', spatialWallPreview: 'Wall preview', spatialNormalPreview: 'Standard LED line', spatialContinuousPreview: 'Continuous LED line',
      spatialChoiceHint: 'Choose a view. The large preview updates right away.', spatialTunnelHint: 'LED lines become light paths through a tunnel.', spatialWallHint: 'LED lines stand side by side on a wall.', spatialNormalHint: 'Each RGBW LED line stays visible on its own.', spatialNormalSpiHint: 'Choose one linked line or separate LED lines.', spatialTopologyTitle: 'How do you want to use the SPI LED lines?', spatialTopologyOne: 'One continuous LED line', spatialTopologyOneHint: 'All SPI lines join into one line of light.', spatialTopologySeparate: 'Separate LED lines', spatialTopologySeparateHint: 'Each SPI line stays on its own row.', spatialSelectedOf: '{count} selected',
      spatialTunnelUnit: 'Each arch is one LED line.', spatialWallUnit: 'Each vertical line is one LED line.', spatialNormalUnit: 'This preview shows a standard LED line.', spatialContinuousUnit: 'SPI lines combine into one continuous line of light.',
      spatialTunnelOrder: 'Front to back: set the order under Set LED line order.', spatialWallOrder: 'Left to right: set the order under Set LED line order.', spatialNormalOrder: 'The order is set under Set LED line order.', spatialContinuousOrder: 'The order determines how the continuous line flows.', spatialPreviewOnly: 'Changes the preview only.', spatialPreviewApplied: 'Applies this layout immediately.',
      lineSetupTitle: 'LED line layout', lineSetupSummary: '{layout} · {count} LED lines',
      lineSetupPurpose: 'Position and order determine how the light travels. Changes apply immediately.',
      lineSetupTunnel: 'Tunnel', lineSetupWall: 'Wall', lineSetupContinuous: 'Continuous', lineSetupNormal: 'Standard LED line', lineSetupOrient: 'Set LED line order', lineSetupOrientHint: 'Blink a line to identify it, then put it in the right place.',
      lineSetupTunnelHint: 'From front to back', lineSetupWallHint: 'From left to right', lineSetupContinuousHint: 'One continuous line of light', lineSetupNormalHint: 'Standard RGBW LED line',
      lineSetupOrder: 'Set LED line order', lineSetupOrderHint: 'Blink a line to identify it. Move it to the right place; the order applies immediately.',
      lineSetupChanged: 'The LED lines have changed. Check the arrangement and choose again.',
      lineSetupSaveFailed: 'The change was not confirmed. The last confirmed arrangement is shown. Choose again to retry.',
      lineSetupManage: 'Add or edit LED lines', lineSetupManageHint: 'Name, zone and connections',
      lineSetupChoose: 'How are your LED lines arranged?',
      lineSetupUp: 'Move {name} earlier', lineSetupDown: 'Move {name} later',
      lineSetupLeft: 'Move {name} to the left', lineSetupRight: 'Move {name} to the right',
      together: 'All LED lines together', addReceiver: 'Add receiver', setupStand: 'Set up my booth', settings: 'Settings', myColours: 'Colour presets',
      scopePrompt: 'What do you want to control?', scopeIndividual: 'Choose one LED line, or tap several to control them together', scopeSeparate: 'Choose LED lines', scopeSeparateHint: '{count} available · choose one or more', scopeSingleHint: '1 of {count} LED lines · tap to change', scopeMultiHint: '{count} selected · tap to edit', scopeChooseAria: 'Choose LED lines', scopeLine: 'LED line {number}', scopeCountOne: '1 LED line', scopeCountMany: '{count} LED lines', scopeTogetherOne: 'Controls this LED line', scopeTogetherMany: 'Controls all {count} LED lines', scopeTotalSpiOne: '1 LED line · {pixels} pixels total', scopeTotalSpiMany: '{count} LED lines · {pixels} pixels total', scopeAllAria: 'Control all LED lines together', scopeLineAria: 'LED line {number} · {type}', scopeSelectedLine: 'LED line {number} · {type}', scopeSelectedTap: '{name} selected · tap to switch', scopeSelectedLines: '{count} LED lines · {numbers}',
      manage: 'Manage', newColour: 'New colour', saveColour: 'Save colour', newScene: 'Save current lighting', saveScene: 'Save atmosphere', updateScene: 'Update scene',
      colourOrder: 'Change order', done: 'Done', saveCurrentColour: 'Add current colour',
      animationGallery: 'All animations', animationLibraryTitle: 'Animations',
      animationNavigation: 'Choose or edit animation', animationChooseAnother: 'Open animation picker', animationCurrentSettingsTitle: 'Edit this animation', animationSettingsReturnKicker: 'Active animation', animationCurrentSettingsAccessible: 'Open settings for active animation {name}', animationSettings: 'Animation settings',
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
      softwareMainRecoveryCheck: 'Check main receiver', softwareMainRecoveryStart: 'Install recovery update',
      softwareMainRecoveryExplanation: 'A recovery update is available for your main receiver. Zones and pairings are preserved.',
      softwareMainRecoveryGuidance: 'Recover the main receiver first. Then we will check the other receivers again.',
      softwareCancelled: 'Update cancelled', softwareCancelling: 'Cancelling update…',
      softwareAllCurrent: 'Everything is up to date.', softwareCurrent: 'Updating receiver {current} of {total}',
      softwareRunning: 'Update in progress · {percent}%', softwareWaiting: 'Waiting for the previous receiver',
      softwarePreflight: 'Checking all receivers…', softwareFailed: 'Update not confirmed',
      softwareFailedGeneral: 'This update was not confirmed. The next receiver was not updated.',
      softwareErrorConnection: 'Check that you are connected to the ALUVISION Wi-Fi.',
      softwareErrorAck: 'The receiver did not confirm the transfer. Keep it powered and check the connection.',
      softwareErrorRejected: 'The receiver rejected the update. Use the latest app version and try again.',
      softwareErrorRestart: 'The update was sent, but the restart is not confirmed. Check this same receiver; do not start another update.',
      softwareErrorRollback: 'The receiver automatically restored its previous software.',
      softwareErrorTopology: 'This receiver connection does not support this update.',
      softwareErrorTopologyUnconfirmed: 'The app could not safely confirm the receiver network. Check the connection.',
      softwareErrorTimeout: 'The receiver did not respond. Keep it powered and check the connection.',
      softwareErrorGeneric: 'The update was not confirmed. Nothing was erased.',
      softwareErrorStorage: 'The app could not safely save the update progress. Keep the receiver powered and check the update again.',
      softwareCheckUnavailable: 'The version could not be checked.',
      softwareUpdateFinished: 'All receivers are updated and verified.'
    },
    fr: {
      stand: 'Stand', zones: 'Zones', receivers: 'Récepteurs', scenes: 'Scènes', more: 'Plus',
      staticColour: 'Couleur fixe', animations: 'Animations', layout: 'Disposition', controls: 'Commandes',
      effects: 'Effets',
      chooseAnimation: 'Choisir une animation', otherAnimation: 'Autre animation', backToAnimations: 'Retour aux animations', allFamilies: 'Toutes les familles d’effets',
      animationPreview: 'Aperçu', animationBadgeForType: 'Animations pour les lignes LED {type}', animationCountOne: '1 animation', animationCountMany: '{count} animations', viewAnimation: 'Ouvrir l’animation', viewAnimationCount: 'Choisir parmi {count} variantes', hideAnimationOptions: 'Fermer les animations',
      spatialPreviewTitle: 'Afficher en', spatialTunnel: 'Tunnel', spatialWall: 'Mur', spatialTunnelPreview: 'Aperçu du tunnel', spatialWallPreview: 'Aperçu du mur', spatialNormalPreview: 'Ligne LED classique', spatialContinuousPreview: 'Ligne LED continue',
      spatialChoiceHint: 'Choisissez une vue. Le grand aperçu change immédiatement.', spatialTunnelHint: 'Les lignes LED forment des chemins lumineux dans un tunnel.', spatialWallHint: 'Les lignes LED sont côte à côte sur un mur.', spatialNormalHint: 'Chaque ligne RGBW reste visible séparément.', spatialNormalSpiHint: 'Choisissez une ligne liée ou des lignes séparées.', spatialTopologyTitle: 'Comment utiliser les lignes SPI ?', spatialTopologyOne: 'Une ligne LED continue', spatialTopologyOneHint: 'Toutes les lignes SPI forment une seule ligne lumineuse.', spatialTopologySeparate: 'Lignes séparées', spatialTopologySeparateHint: 'Chaque ligne SPI reste sur sa propre rangée.', spatialSelectedOf: '{count} sélectionnée(s)',
      spatialTunnelUnit: 'Chaque arche représente une ligne LED.', spatialWallUnit: 'Chaque ligne verticale représente une ligne LED.', spatialNormalUnit: 'Cet aperçu montre une ligne LED classique.', spatialContinuousUnit: 'Les lignes SPI forment une seule ligne lumineuse continue.',
      spatialTunnelOrder: 'De l’avant vers l’arrière : réglez l’ordre sous « Ordonner les lignes LED ».', spatialWallOrder: 'De gauche à droite : réglez l’ordre sous « Ordonner les lignes LED ».', spatialNormalOrder: 'Réglez l’ordre sous « Ordonner les lignes LED ».', spatialContinuousOrder: 'L’ordre détermine le sens de la ligne continue.', spatialPreviewOnly: 'Modifie uniquement l’aperçu.', spatialPreviewApplied: 'Applique la disposition immédiatement.',
      lineSetupTitle: 'Disposition des lignes LED', lineSetupSummary: '{layout} · {count} lignes LED',
      lineSetupPurpose: 'La disposition et l’ordre déterminent le parcours de la lumière. Les changements s’appliquent immédiatement.',
      lineSetupTunnel: 'Tunnel', lineSetupWall: 'Mur', lineSetupContinuous: 'En continu', lineSetupNormal: 'Ligne LED classique', lineSetupOrient: 'Ordonner les lignes LED', lineSetupOrientHint: 'Faites clignoter une ligne pour l’identifier, puis placez-la correctement.',
      lineSetupTunnelHint: 'De l’avant vers l’arrière', lineSetupWallHint: 'De gauche à droite', lineSetupContinuousHint: 'Une seule ligne de lumière continue', lineSetupNormalHint: 'Ligne LED RGBW classique',
      lineSetupOrder: 'Ordonner les lignes LED', lineSetupOrderHint: 'Faites clignoter une ligne LED pour la repérer. Placez-la ensuite au bon endroit ; l’ordre est appliqué immédiatement.',
      lineSetupChanged: 'Les lignes LED ont changé. Vérifiez la disposition et choisissez à nouveau.',
      lineSetupSaveFailed: 'La modification n’est pas confirmée. La dernière disposition confirmée est affichée. Choisissez à nouveau pour réessayer.',
      lineSetupManage: 'Ajouter ou modifier des lignes LED', lineSetupManageHint: 'Nom, zone et connexions',
      lineSetupChoose: 'Comment sont placées vos lignes LED ?',
      lineSetupUp: 'Avancer {name} dans la liste', lineSetupDown: 'Reculer {name} dans la liste',
      lineSetupLeft: 'Déplacer {name} vers la gauche', lineSetupRight: 'Déplacer {name} vers la droite',
      together: 'Toutes les lignes ensemble', addReceiver: 'Ajouter un récepteur', setupStand: 'Configurer mon stand', settings: 'Réglages', myColours: 'Couleurs enregistrées',
      scopePrompt: 'Que voulez-vous commander ?', scopeIndividual: 'Choisissez une ligne LED ou touchez-en plusieurs pour les commander ensemble', scopeSeparate: 'Choisir les lignes LED', scopeSeparateHint: '{count} disponibles · choisissez-en une ou plusieurs', scopeSingleHint: '1 sur {count} lignes LED · toucher pour modifier', scopeMultiHint: '{count} sélectionnées · toucher pour modifier', scopeChooseAria: 'Choisir les lignes LED', scopeLine: 'Ligne LED {number}', scopeCountOne: '1 ligne LED', scopeCountMany: '{count} lignes LED', scopeTogetherOne: 'Commande cette ligne LED', scopeTogetherMany: 'Commande les {count} lignes LED', scopeTotalSpiOne: '1 ligne LED · {pixels} pixels au total', scopeTotalSpiMany: '{count} lignes LED · {pixels} pixels au total', scopeAllAria: 'Commander toutes les lignes LED ensemble', scopeLineAria: 'Ligne LED {number} · {type}', scopeSelectedLine: 'Ligne LED {number} · {type}', scopeSelectedTap: '{name} sélectionnée · toucher pour changer', scopeSelectedLines: '{count} lignes LED · {numbers}',
      manage: 'Gérer', newColour: 'Nouvelle couleur', saveColour: 'Enregistrer la couleur', newScene: 'Enregistrer cet éclairage', saveScene: 'Enregistrer l’ambiance', updateScene: 'Mettre à jour la scène',
      colourOrder: 'Modifier l’ordre', done: 'Terminé', saveCurrentColour: 'Ajouter la couleur actuelle',
      animationGallery: 'Galerie d’animations', animationLibraryTitle: 'Animations',
      animationNavigation: 'Choisir ou régler une animation', animationChooseAnother: 'Ouvrir le sélecteur', animationCurrentSettingsTitle: 'Modifier cette animation', animationSettingsReturnKicker: 'Animation active', animationCurrentSettingsAccessible: 'Ouvrir les réglages de l’animation active {name}', animationSettings: 'Réglages de l’animation',
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
      softwareMainRecoveryCheck: 'Vérifier le receiver principal', softwareMainRecoveryStart: 'Installer la mise à jour de réparation',
      softwareMainRecoveryExplanation: 'Une mise à jour de réparation est disponible pour votre receiver principal. Les zones et les appairages sont conservés.',
      softwareMainRecoveryGuidance: 'Réparez d’abord le receiver principal. Nous vérifierons ensuite les autres receivers.',
      softwareCancelled: 'Mise à jour annulée', softwareCancelling: 'Annulation de la mise à jour…',
      softwareAllCurrent: 'Tout est à jour.', softwareCurrent: 'Mise à jour du récepteur {current} sur {total}',
      softwareRunning: 'Mise à jour en cours · {percent} %', softwareWaiting: 'En attente du récepteur précédent',
      softwarePreflight: 'Vérification de tous les récepteurs…', softwareFailed: 'Mise à jour non confirmée',
      softwareFailedGeneral: 'Cette mise à jour n’est pas confirmée. Le récepteur suivant n’a pas été mis à jour.',
      softwareErrorConnection: 'Vérifiez la connexion au Wi-Fi ALUVISION.',
      softwareErrorAck: 'Le récepteur n’a pas confirmé le transfert. Laissez-le allumé et vérifiez la connexion.',
      softwareErrorRejected: 'Le récepteur a refusé la mise à jour. Utilisez la dernière version de l’application et réessayez.',
      softwareErrorRestart: 'La mise à jour a été envoyée, mais le redémarrage n’est pas confirmé. Vérifiez ce même récepteur ; ne relancez pas une mise à jour.',
      softwareErrorRollback: 'Le récepteur a automatiquement restauré le logiciel précédent.',
      softwareErrorTopology: 'Cette connexion ne permet pas cette mise à jour.',
      softwareErrorTopologyUnconfirmed: 'L’application n’a pas pu confirmer le réseau en toute sécurité. Vérifiez la connexion.',
      softwareErrorTimeout: 'Le récepteur ne répond pas. Laissez-le allumé et vérifiez la connexion.',
      softwareErrorGeneric: 'La mise à jour n’est pas confirmée. Rien n’a été effacé.',
      softwareErrorStorage: 'L’application n’a pas pu enregistrer la progression en toute sécurité. Laissez le récepteur allumé et vérifiez à nouveau la mise à jour.',
      softwareCheckUnavailable: 'Impossible de vérifier la version.',
      softwareUpdateFinished: 'Tous les récepteurs sont à jour et vérifiés.'
    },
    de: {
      stand: 'Stand', zones: 'Zonen', receivers: 'Empfänger', scenes: 'Szenen', more: 'Mehr',
      staticColour: 'Feste Farbe', animations: 'Animationen', layout: 'Anordnung', controls: 'Bedienung',
      effects: 'Effekte',
      chooseAnimation: 'Animation auswählen', otherAnimation: 'Andere Animation', backToAnimations: 'Zurück zu den Animationen', allFamilies: 'Alle Effektfamilien',
      animationPreview: 'Vorschau', animationBadgeForType: 'Animationen für {type}-LED-Linien', animationCountOne: '1 Animation', animationCountMany: '{count} Animationen', viewAnimation: 'Animation öffnen', viewAnimationCount: 'Aus {count} Varianten wählen', hideAnimationOptions: 'Animationen schließen',
      spatialPreviewTitle: 'Anzeigen als', spatialTunnel: 'Tunnel', spatialWall: 'Wand', spatialTunnelPreview: 'Tunnelvorschau', spatialWallPreview: 'Wandvorschau', spatialNormalPreview: 'Normale LED-Linie', spatialContinuousPreview: 'Durchgehende LED-Linie',
      spatialChoiceHint: 'Wähle eine Ansicht. Die große Vorschau passt sich sofort an.', spatialTunnelHint: 'LED-Linien verlaufen als Lichtbahnen durch einen Tunnel.', spatialWallHint: 'LED-Linien stehen nebeneinander an einer Wand.', spatialNormalHint: 'Jede RGBW-LED-Linie bleibt einzeln sichtbar.', spatialNormalSpiHint: 'Wähle eine verbundene oder getrennte LED-Linien.', spatialTopologyTitle: 'Wie sollen die SPI-LED-Linien arbeiten?', spatialTopologyOne: 'Eine durchgehende LED-Linie', spatialTopologyOneHint: 'Alle SPI-Linien bilden eine gemeinsame Lichtlinie.', spatialTopologySeparate: 'Getrennte LED-Linien', spatialTopologySeparateHint: 'Jede SPI-Linie bleibt in einer eigenen Reihe.', spatialSelectedOf: '{count} ausgewählt',
      spatialTunnelUnit: 'Jeder Bogen ist eine LED-Linie.', spatialWallUnit: 'Jede senkrechte Linie ist eine LED-Linie.', spatialNormalUnit: 'Diese Vorschau zeigt eine normale LED-Linie.', spatialContinuousUnit: 'SPI-Linien bilden gemeinsam eine durchgehende Lichtlinie.',
      spatialTunnelOrder: 'Von vorne nach hinten: die Reihenfolge unter LED-Linien anordnen.', spatialWallOrder: 'Von links nach rechts: die Reihenfolge unter LED-Linien anordnen.', spatialNormalOrder: 'Die Reihenfolge findest du unter LED-Linien anordnen.', spatialContinuousOrder: 'Die Reihenfolge bestimmt, wie die Lichtlinie weiterläuft.', spatialPreviewOnly: 'Ändert nur die Vorschau.', spatialPreviewApplied: 'Übernimmt die Anordnung sofort.',
      lineSetupTitle: 'Anordnung der LED-Linien', lineSetupSummary: '{layout} · {count} LED-Linien',
      lineSetupPurpose: 'Anordnung und Reihenfolge bestimmen den Lichtverlauf. Änderungen werden sofort übernommen.',
      lineSetupTunnel: 'Tunnel', lineSetupWall: 'Wand', lineSetupContinuous: 'Durchgehend', lineSetupNormal: 'Normale LED-Linie', lineSetupOrient: 'LED-Linien anordnen', lineSetupOrientHint: 'Lass eine Linie zur Erkennung blinken und setze sie an die richtige Stelle.',
      lineSetupTunnelHint: 'Von vorne nach hinten', lineSetupWallHint: 'Von links nach rechts', lineSetupContinuousHint: 'Eine durchgehende Lichtlinie', lineSetupNormalHint: 'Normale RGBW-LED-Linie',
      lineSetupOrder: 'LED-Linien anordnen', lineSetupOrderHint: 'Lass eine LED-Linie blinken, um sie zu erkennen. Verschiebe sie an die richtige Stelle; die Reihenfolge wird sofort übernommen.',
      lineSetupChanged: 'Die LED-Linien wurden geändert. Prüfe die Anordnung und wähle erneut.',
      lineSetupSaveFailed: 'Die Änderung wurde nicht bestätigt. Die zuletzt bestätigte Anordnung wird angezeigt. Wähle erneut, um es noch einmal zu versuchen.',
      lineSetupManage: 'LED-Linien hinzufügen oder bearbeiten', lineSetupManageHint: 'Name, Zone und Anschlüsse',
      lineSetupChoose: 'Wie sind deine LED-Linien angeordnet?',
      lineSetupUp: '{name} nach vorne verschieben', lineSetupDown: '{name} nach hinten verschieben',
      lineSetupLeft: '{name} nach links verschieben', lineSetupRight: '{name} nach rechts verschieben',
      together: 'Alle LED-Linien gemeinsam', addReceiver: 'Empfänger hinzufügen', setupStand: 'Meinen Stand einrichten', settings: 'Einstellungen', myColours: 'Farbpresets',
      scopePrompt: 'Was möchtest du steuern?', scopeIndividual: 'Wähle eine LED-Linie oder tippe mehrere an, um sie gemeinsam zu steuern', scopeSeparate: 'LED-Linien auswählen', scopeSeparateHint: '{count} verfügbar · eine oder mehrere auswählen', scopeSingleHint: '1 von {count} LED-Linien · antippen zum Ändern', scopeMultiHint: '{count} ausgewählt · antippen zum Ändern', scopeChooseAria: 'LED-Linien auswählen', scopeLine: 'LED-Linie {number}', scopeCountOne: '1 LED-Linie', scopeCountMany: '{count} LED-Linien', scopeTogetherOne: 'Steuert diese LED-Linie', scopeTogetherMany: 'Steuert alle {count} LED-Linien', scopeTotalSpiOne: '1 LED-Linie · {pixels} Pixel insgesamt', scopeTotalSpiMany: '{count} LED-Linien · {pixels} Pixel insgesamt', scopeAllAria: 'Alle LED-Linien gemeinsam steuern', scopeLineAria: 'LED-Linie {number} · {type} steuern', scopeSelectedLine: 'LED-Linie {number} · {type}', scopeSelectedTap: '{name} ausgewählt · antippen zum Wechseln', scopeSelectedLines: '{count} LED-Linien · {numbers}',
      manage: 'Verwalten', newColour: 'Neue Farbe', saveColour: 'Farbe speichern', newScene: 'Aktuelles Licht speichern', saveScene: 'Stimmung speichern', updateScene: 'Szene aktualisieren',
      colourOrder: 'Reihenfolge ändern', done: 'Fertig', saveCurrentColour: 'Aktuelle Farbe hinzufügen',
      animationGallery: 'Animationsgalerie', animationLibraryTitle: 'Animationen',
      animationNavigation: 'Animation wählen oder einstellen', animationChooseAnother: 'Animationsauswahl öffnen', animationCurrentSettingsTitle: 'Diese Animation anpassen', animationSettingsReturnKicker: 'Aktive Animation', animationCurrentSettingsAccessible: 'Einstellungen der aktiven Animation {name} öffnen', animationSettings: 'Animationseinstellungen',
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
      softwareMainRecoveryCheck: 'Hauptreceiver prüfen', softwareMainRecoveryStart: 'Reparaturupdate installieren',
      softwareMainRecoveryExplanation: 'Für den Hauptreceiver ist ein Reparaturupdate verfügbar. Zonen und Kopplungen bleiben erhalten.',
      softwareMainRecoveryGuidance: 'Zuerst den Hauptreceiver wiederherstellen. Danach prüfen wir die anderen Receiver erneut.',
      softwareCancelled: 'Update abgebrochen', softwareCancelling: 'Update wird abgebrochen…',
      softwareAllCurrent: 'Alles ist aktuell.', softwareCurrent: 'Receiver {current} von {total} wird aktualisiert',
      softwareRunning: 'Update läuft · {percent} %', softwareWaiting: 'Wartet auf den vorherigen Receiver',
      softwarePreflight: 'Alle Receiver werden geprüft…', softwareFailed: 'Update nicht bestätigt',
      softwareFailedGeneral: 'Dieses Update wurde nicht bestätigt. Der nächste Receiver wurde nicht aktualisiert.',
      softwareErrorConnection: 'Prüfe, ob du mit dem ALUVISION-WLAN verbunden bist.',
      softwareErrorAck: 'Der Receiver hat die Übertragung nicht bestätigt. Eingeschaltet lassen und Verbindung prüfen.',
      softwareErrorRejected: 'Der Receiver hat das Update abgelehnt. Verwende die neueste App-Version und versuche es erneut.',
      softwareErrorRestart: 'Das Update wurde gesendet, aber der Neustart ist nicht bestätigt. Diesen Receiver prüfen; kein neues Update starten.',
      softwareErrorRollback: 'Der Receiver hat die vorherige Software automatisch wiederhergestellt.',
      softwareErrorTopology: 'Diese Receiver-Verbindung unterstützt dieses Update nicht.',
      softwareErrorTopologyUnconfirmed: 'Die App konnte das Receiver-Netzwerk nicht sicher bestätigen. Verbindung prüfen.',
      softwareErrorTimeout: 'Der Receiver antwortet nicht. Eingeschaltet lassen und Verbindung prüfen.',
      softwareErrorGeneric: 'Das Update wurde nicht bestätigt. Es wurde nichts gelöscht.',
      softwareErrorStorage: 'Die App konnte den Update-Fortschritt nicht sicher speichern. Lass den Receiver eingeschaltet und prüfe das Update erneut.',
      softwareCheckUnavailable: 'Die Version konnte nicht geprüft werden.',
      softwareUpdateFinished: 'Alle Receiver sind aktualisiert und geprüft.'
    }
  };
  // Everyday animation controls. Display text only; no recipe or receiver change.
  const animationTexts = {
    nl: {
      animationBrowseAll:'Alle animaties bekijken',animationStartSelection:'Startselectie',animationQuickChoices:'Snelle keuzes',animationAll:'Alle animaties',animationVariantsOf:'Varianten van {name}',animationChooseVariant:'Tik op een animatie om die direct af te spelen.',animationVariantPosition:'Variant {current} van {total}',animationFamilyBackAll:'Alle animaties',animationFamilyBackCategory:'Terug naar {name}',animationFamilyLabel:'Effectgroep',animationFamilyStep:'Stap 2 van 2 · kies één animatie',animationFamilyPreview:'Groepsvoorbeeld',animationGroupPreviewHint:'Alleen ter illustratie; er start nog geen animatie.',animationFamilyChoose:'Kies een animatie',animationOpenGroup:'Open deze groep',animationGroupNextStep:'Daarna kies je welke animatie start.',animationWhole:'Kleur & sfeer',animationMoving:'Bewegend licht',animationAcross:'Over meerdere ledlines',animationBrand:'Brand animaties',animationOwn:'Mijn animaties',animationFilter:'Soort animatie',animationSearch:'Zoek in animaties',animationSearchHint:'Naam of beweging',animationAllVariants:'Kies uit {count} varianten',
      animationColours:'Animatiekleuren',animationSpeed:'Snelheid',animationBrightness:'Helderheid',animationMoreSettings:'Meer instellingen',animationHideSettings:'Instellingen verbergen',animationSaveOwn:'Als eigen animatie bewaren',animationBackground:'Achtergrondkleur',animationBackgroundChoose:'Kies achtergrondkleur',animationBackgroundBrightness:'Helderheid achtergrond',animationBackgroundWhole:'Deze kleur blijft tussen de lichtwissels of pulsen zichtbaar.',animationBackgroundPixels:'Deze kleur blijft tussen de bewegende lichtpunten zichtbaar.',spatialPreviewTitle:'Bekijk als',
      animationStarterBreathe:'Zacht ademen',animationStarterBreatheHint:'De hele lijn wordt zacht lichter en donkerder.',animationStarterColour:'Kleurwissel',animationStarterColourHint:'De hele lijn wisselt van kleur.',animationStarterChase:'Lopend licht',animationStarterChaseHint:'Eén lichtpunt loopt over de pixels.',animationStarterWave:'Lichtgolf',animationStarterWaveHint:'Een brede golf glijdt over de lijn.',animationStarterGradient:'Kleurverloop',animationStarterGradientHint:'De hele lijn verandert zacht van kleur.',animationStarterWarm:'Warm naar wit',animationStarterWarmHint:'Een warme witmix gaat over in zacht wit.'
    },
    en: {
      animationBrowseAll:'Browse all animations',animationStartSelection:'Quick choices',animationQuickChoices:'Quick choices',animationAll:'All animations',animationVariantsOf:'{name} variations',animationChooseVariant:'Tap an animation to play it right away.',animationVariantPosition:'Variant {current} of {total}',animationFamilyBackAll:'All animations',animationFamilyBackCategory:'Back to {name}',animationFamilyLabel:'Effect group',animationFamilyStep:'Step 2 of 2 · choose one animation',animationFamilyPreview:'Group preview',animationGroupPreviewHint:'For reference only; no animation starts yet.',animationFamilyChoose:'Choose an animation',animationOpenGroup:'Open this group',animationGroupNextStep:'Then choose which animation to play.',animationWhole:'Colour & mood',animationMoving:'Moving light',animationAcross:'Across LED lines',animationBrand:'Brand animations',animationOwn:'My animations',animationFilter:'Animation type',animationSearch:'Search animations',animationSearchHint:'Name or movement',animationAllVariants:'Choose from {count} variations',
      animationColours:'Animation colours',animationSpeed:'Speed',animationBrightness:'Brightness',animationMoreSettings:'More settings',animationHideSettings:'Hide settings',animationSaveOwn:'Save as my animation',animationBackground:'Background colour',animationBackgroundChoose:'Choose background colour',animationBackgroundBrightness:'Background brightness',animationBackgroundWhole:'This colour remains visible between colour changes or pulses.',animationBackgroundPixels:'This colour remains visible between the moving light points.',spatialPreviewTitle:'View as',
      animationStarterBreathe:'Gentle breathing',animationStarterBreatheHint:'The whole line gently brightens and dims.',animationStarterColour:'Colour change',animationStarterColourHint:'The whole line changes colour.',animationStarterChase:'Running light',animationStarterChaseHint:'One light point travels over the pixels.',animationStarterWave:'Light wave',animationStarterWaveHint:'A broad wave glides along the line.',animationStarterGradient:'Colour fade',animationStarterGradientHint:'The whole line gently shifts colour.',animationStarterWarm:'Warm to white',animationStarterWarmHint:'A warm white mix fades to soft white.'
    },
    fr: {
      animationBrowseAll:'Voir toutes les animations',animationStartSelection:'Sélection rapide',animationQuickChoices:'Choix rapides',animationAll:'Toutes les animations',animationVariantsOf:'Variantes de {name}',animationChooseVariant:'Touchez une animation pour la lancer immédiatement.',animationVariantPosition:'Variante {current} sur {total}',animationFamilyBackAll:'Toutes les animations',animationFamilyBackCategory:'Retour à {name}',animationFamilyLabel:'Groupe d’effets',animationFamilyStep:'Étape 2 sur 2 · choisissez une animation',animationFamilyPreview:'Aperçu du groupe',animationGroupPreviewHint:'Illustration uniquement ; aucune animation ne démarre.',animationFamilyChoose:'Choisir une animation',animationOpenGroup:'Ouvrir ce groupe',animationGroupNextStep:'Choisissez ensuite l’animation à lancer.',animationWhole:'Couleur et ambiance',animationMoving:'Lumière en mouvement',animationAcross:'Sur plusieurs lignes LED',animationBrand:'Animations de marque',animationOwn:'Mes animations',animationFilter:'Type d’animation',animationSearch:'Rechercher une animation',animationSearchHint:'Nom ou mouvement',animationAllVariants:'Choisir parmi {count} variantes',
      animationColours:'Couleurs de l’animation',animationSpeed:'Vitesse',animationBrightness:'Luminosité',animationMoreSettings:'Plus de réglages',animationHideSettings:'Masquer les réglages',animationSaveOwn:'Enregistrer mon animation',animationBackground:'Couleur de fond',animationBackgroundChoose:'Choisir la couleur de fond',animationBackgroundBrightness:'Luminosité du fond',animationBackgroundWhole:'Cette couleur reste visible entre les changements ou pulsations.',animationBackgroundPixels:'Cette couleur reste visible entre les points lumineux en mouvement.',spatialPreviewTitle:'Afficher en',
      animationStarterBreathe:'Respiration douce',animationStarterBreatheHint:'Toute la ligne s’éclaire et s’atténue doucement.',animationStarterColour:'Changement de couleur',animationStarterColourHint:'Toute la ligne change de couleur.',animationStarterChase:'Lumière défilante',animationStarterChaseHint:'Un point lumineux parcourt les pixels.',animationStarterWave:'Vague lumineuse',animationStarterWaveHint:'Une large vague glisse le long de la ligne.',animationStarterGradient:'Fondu de couleurs',animationStarterGradientHint:'Toute la ligne change doucement de couleur.',animationStarterWarm:'Chaud vers blanc',animationStarterWarmHint:'Un blanc chaud devient un blanc doux.'
    },
    de: {
      animationBrowseAll:'Alle Animationen ansehen',animationStartSelection:'Schnellauswahl',animationQuickChoices:'Schnellauswahl',animationAll:'Alle Animationen',animationVariantsOf:'Varianten von {name}',animationChooseVariant:'Tippe auf eine Animation, um sie sofort abzuspielen.',animationVariantPosition:'Variante {current} von {total}',animationFamilyBackAll:'Alle Animationen',animationFamilyBackCategory:'Zurück zu {name}',animationFamilyLabel:'Effektgruppe',animationFamilyStep:'Schritt 2 von 2 · eine Animation auswählen',animationFamilyPreview:'Gruppenvorschau',animationGroupPreviewHint:'Nur zur Ansicht; es startet noch keine Animation.',animationFamilyChoose:'Animation auswählen',animationOpenGroup:'Diese Gruppe öffnen',animationGroupNextStep:'Danach wählst du die Animation zum Abspielen.',animationWhole:'Farbe und Stimmung',animationMoving:'Bewegtes Licht',animationAcross:'Über mehrere LED-Linien',animationBrand:'Markenanimationen',animationOwn:'Meine Animationen',animationFilter:'Animationsart',animationSearch:'Animationen suchen',animationSearchHint:'Name oder Bewegung',animationAllVariants:'Aus {count} Varianten wählen',
      animationColours:'Animationsfarben',animationSpeed:'Geschwindigkeit',animationBrightness:'Helligkeit',animationMoreSettings:'Weitere Einstellungen',animationHideSettings:'Einstellungen ausblenden',animationSaveOwn:'Als eigene Animation speichern',animationBackground:'Hintergrundfarbe',animationBackgroundChoose:'Hintergrundfarbe wählen',animationBackgroundBrightness:'Hintergrundhelligkeit',animationBackgroundWhole:'Diese Farbe bleibt zwischen Farbwechseln oder Pulsen sichtbar.',animationBackgroundPixels:'Diese Farbe bleibt zwischen den bewegten Lichtpunkten sichtbar.',spatialPreviewTitle:'Anzeigen als',
      animationStarterBreathe:'Sanftes Atmen',animationStarterBreatheHint:'Die ganze Linie wird sanft heller und dunkler.',animationStarterColour:'Farbwechsel',animationStarterColourHint:'Die ganze Linie wechselt die Farbe.',animationStarterChase:'Lauflicht',animationStarterChaseHint:'Ein Lichtpunkt läuft über die Pixel.',animationStarterWave:'Lichtwelle',animationStarterWaveHint:'Eine breite Welle gleitet über die Linie.',animationStarterGradient:'Farbverlauf',animationStarterGradientHint:'Die ganze Linie wechselt sanft die Farbe.',animationStarterWarm:'Warm zu Weiß',animationStarterWarmHint:'Ein warmer Weißton geht in sanftes Weiß über.'
    }
  };
  Object.keys(animationTexts).forEach(code => Object.assign(texts[code], animationTexts[code]));
  const mobileGalleryTexts={
    nl:{animationSelector:'Animatiekiezer',animationPickerIntro:'Kies een soort. Open daarna een groep en tik op je animatie; die start meteen.',animationSettingsShort:'Instellingen',animationActiveName:'Actief: {name}',animationAcross:'Tunnel & wand',animationStartHint:'Vier makkelijke keuzes om te beginnen',animationAllHint:'Bekijk alle soorten en bewegingen',animationChooseAnotherHint:'Tik op een animatie om te starten.',animationWholeHint:'De hele ledline verandert van kleur of helderheid',animationMovingHint:'Licht beweegt binnen één ledline',animationAcrossHint:'Voor tunnels en wanden: beweging tussen ledlines',animationAcrossSummary:'Tunnel- en wandeffecten bewegen licht door meerdere ledlines.',animationAcrossMinimum:'Voor starten zijn minimaal 2 ledlines nodig.',animationAcrossAutoApply:'Een gekozen effect gebruikt automatisch alle ledlines in deze zone.',animationAcrossIndividualHint:'Wil je per ledline een andere kleur? Kies na het starten in de instellingen een ledline.',animationTunnelSampleTitle:'Tunnelvoorbeeld',animationWallSampleTitle:'Wandvoorbeeld',animationTunnelSampleLines:'4 voorbeeld-ledlines',animationTunnelSampleAccessible:'Tunnelvoorbeeld met vier voorbeeld-ledlines',animationWallSampleAccessible:'Wandvoorbeeld met vier voorbeeld-ledlines',animationTunnelGroupAccessible:'{name} als voorbeeld over {count} gekoppelde ledlines. Er start nog niets.',animationSelectMinimum:'Selecteer minstens {count} ledlines',animationBrandHint:'Rustige effecten met je eigen merkkleuren',animationOwnHint:'Je zelf bewaarde animaties'},
    en:{animationSelector:'Animation picker',animationPickerIntro:'Choose a type, open a group, then tap an animation to start it.',animationSettingsShort:'Settings',animationActiveName:'Active: {name}',animationAcross:'Tunnel & wall',animationStartHint:'Four easy choices to get started',animationAllHint:'Explore every type and movement',animationChooseAnotherHint:'Tap an animation to start.',animationWholeHint:'The whole LED line changes colour or brightness',animationMovingHint:'Light moves within one LED line',animationAcrossHint:'For tunnels and walls: movement across LED lines',animationAcrossSummary:'Tunnel and wall effects move light through multiple LED lines.',animationAcrossMinimum:'At least 2 LED lines are needed to start this effect.',animationAcrossAutoApply:'A chosen effect automatically uses every LED line in this zone.',animationAcrossIndividualHint:'Want a different colour per line? Choose an LED line in settings after starting.',animationTunnelSampleTitle:'Tunnel preview',animationWallSampleTitle:'Wall preview',animationTunnelSampleLines:'4 example LED lines',animationTunnelSampleAccessible:'Tunnel preview with four example LED lines',animationWallSampleAccessible:'Wall preview with four example LED lines',animationTunnelGroupAccessible:'{name} preview across your {count} connected LED lines. Nothing has started yet.',animationSelectMinimum:'Select at least {count} LED lines',animationBrandHint:'Gentle effects with your brand colours',animationOwnHint:'Animations you have saved'},
    fr:{animationSelector:'Sélecteur d’animations',animationPickerIntro:'Choisissez un type, ouvrez un groupe, puis touchez une animation pour la lancer.',animationSettingsShort:'Réglages',animationActiveName:'Active : {name}',animationAcross:'Tunnel et mur',animationStartHint:'Quatre choix simples pour commencer',animationAllHint:'Découvrir tous les types et mouvements',animationChooseAnotherHint:'Touchez une animation pour la lancer.',animationWholeHint:'Toute la ligne change de couleur ou d’intensité',animationMovingHint:'La lumière se déplace dans une ligne LED',animationAcrossHint:'Pour tunnels et murs : mouvement entre les lignes LED',animationAcrossSummary:'Les effets de tunnel et de mur font circuler la lumière entre plusieurs lignes LED.',animationAcrossMinimum:'Au moins 2 lignes LED sont nécessaires pour lancer cet effet.',animationAcrossAutoApply:'Un effet choisi utilise automatiquement toutes les lignes LED de cette zone.',animationAcrossIndividualHint:'Vous souhaitez une couleur par ligne ? Choisissez une ligne dans les réglages après le lancement.',animationTunnelSampleTitle:'Aperçu du tunnel',animationWallSampleTitle:'Aperçu du mur',animationTunnelSampleLines:'4 lignes LED d’exemple',animationTunnelSampleAccessible:'Aperçu du tunnel avec quatre lignes LED d’exemple',animationWallSampleAccessible:'Aperçu du mur avec quatre lignes LED d’exemple',animationTunnelGroupAccessible:'Aperçu de {name} sur vos {count} lignes LED connectées. Rien n’a démarré.',animationSelectMinimum:'Sélectionnez au moins {count} lignes LED',animationBrandHint:'Des effets doux aux couleurs de votre marque',animationOwnHint:'Vos animations enregistrées'},
    de:{animationSelector:'Animationsauswahl',animationPickerIntro:'Wähle eine Art, öffne eine Gruppe und tippe dann auf die gewünschte Animation.',animationSettingsShort:'Einstellungen',animationActiveName:'Aktiv: {name}',animationAcross:'Tunnel & Wand',animationStartHint:'Vier einfache Möglichkeiten zum Einstieg',animationAllHint:'Alle Arten und Bewegungen entdecken',animationChooseAnotherHint:'Tippe auf eine Animation zum Starten.',animationWholeHint:'Die ganze LED-Linie ändert Farbe oder Helligkeit',animationMovingHint:'Licht bewegt sich innerhalb einer LED-Linie',animationAcrossHint:'Für Tunnel und Wände: Bewegung über LED-Linien',animationAcrossSummary:'Tunnel- und Wandeffekte bewegen Licht über mehrere LED-Linien.',animationAcrossMinimum:'Zum Starten dieses Effekts sind mindestens 2 LED-Linien nötig.',animationAcrossAutoApply:'Ein gewählter Effekt nutzt automatisch alle LED-Linien in dieser Zone.',animationAcrossIndividualHint:'Andere Farbe pro Linie? Wähle nach dem Start in den Einstellungen eine LED-Linie.',animationTunnelSampleTitle:'Tunnelvorschau',animationWallSampleTitle:'Wandvorschau',animationTunnelSampleLines:'4 Beispiel-LED-Linien',animationTunnelSampleAccessible:'Tunnelvorschau mit vier Beispiel-LED-Linien',animationWallSampleAccessible:'Wandvorschau mit vier Beispiel-LED-Linien',animationTunnelGroupAccessible:'Vorschau von {name} über deine {count} verbundenen LED-Linien. Noch nicht gestartet.',animationSelectMinimum:'Mindestens {count} LED-Linien auswählen',animationBrandHint:'Ruhige Effekte mit Ihren Markenfarben',animationOwnHint:'Ihre gespeicherten Animationen'}
  };
  Object.keys(mobileGalleryTexts).forEach(code=>Object.assign(texts[code],mobileGalleryTexts[code]));
  const animationChooserTexts = {
    nl:{animationChooseAnother:'Andere animatie kiezen',animationChooseAnotherHint:'Bekijk alle animaties en varianten.',animationFamilyBackAll:'Terug naar alle animatiegroepen'},
    en:{animationChooseAnother:'Choose another animation',animationChooseAnotherHint:'Browse animations and variations.',animationFamilyBackAll:'Back to all animation groups'},
    fr:{animationChooseAnother:'Choisir une autre animation',animationChooseAnotherHint:'Parcourir les animations et variantes.',animationFamilyBackAll:'Retour aux groupes d’animations'},
    de:{animationChooseAnother:'Andere Animation wählen',animationChooseAnotherHint:'Animationen und Varianten ansehen.',animationFamilyBackAll:'Zurück zu allen Animationsgruppen'}
  };
  Object.keys(animationChooserTexts).forEach(code=>Object.assign(texts[code],animationChooserTexts[code]));
  // State labels for the LED-line chooser's disclosure control.
  const scopeCloseLabels = {
    nl: { scopeClose: 'Ledlines verbergen', scopeCloseHint: 'Tik om de lijst te sluiten' },
    en: { scopeClose: 'Hide LED lines', scopeCloseHint: 'Tap to close the list' },
    fr: { scopeClose: 'Masquer les lignes LED', scopeCloseHint: 'Touchez pour fermer la liste' },
    de: { scopeClose: 'LED-Linien ausblenden', scopeCloseHint: 'Tippen, um die Liste zu schließen' }
  };
  Object.keys(scopeCloseLabels).forEach(code => Object.assign(texts[code], scopeCloseLabels[code]));
  // Brand palette labels share the same colour picker and presets in every language.
  const brandColourTexts = {
    nl: {
      brandColours:'Jouw merkkleuren',brandColour:'Merkkleur {number}',brandEdit:'Merkkleur {number} aanpassen',brandEditAction:'Wijzigen',brandRemove:'Merkkleur {number} verwijderen',brandAdd:'Merkkleur toevoegen',brandTag:'Merk',brandNameLabel:'Naam van deze merkkleur',brandNameInvalid:'Vul een naam in van maximaal 64 tekens.',brandLastColorHint:'Bewaar minstens één merkkleur',
      colourManagerTitle:'Kleurpresets beheren',colourManagerIntro:'Eén bibliotheek voor presets en merkkleuren. Bij merkkleuren kun je ook de naam en kleur aanpassen.',colourManagerEmpty:'Nog geen kleurpresets',colourManagerEmptyHint:'Stel een kleur in en tik op ＋ om die te bewaren.',colourManagerUndo:'Ongedaan maken',colourLibraryHint:'Presets en merkkleuren staan samen. Tik op een kleur om die te gebruiken.',colourLibraryOrderHint:'Sleep kleuren om de volgorde aan te passen.',
      brandPaletteHint:'Tot vier kleuren. Tik op een kleur om die te wijzigen.',brandPickerHint:'Bewaard als merkkleur. Je verlichting verandert niet.',brandPickerNewHint:'Kies een kleur om toe te voegen aan je merkkleuren.',brandSaved:'Merkkleur bewaard.',brandIdeas:'Kleurideeën',brandApplyHint:'Kies een animatie om deze kleuren op je verlichting toe te passen.'
    },
    en: {
      brandColours:'Your brand colours',brandColour:'Brand colour {number}',brandEdit:'Edit brand colour {number}',brandEditAction:'Edit',brandRemove:'Remove brand colour {number}',brandAdd:'Add brand colour',brandTag:'Brand',brandNameLabel:'Name this brand colour',brandNameInvalid:'Enter a name up to 64 characters.',brandLastColorHint:'Keep at least one brand colour',
      colourManagerTitle:'Manage colour presets',colourManagerIntro:'One library for presets and brand colours. You can also rename and edit brand colours.',colourManagerEmpty:'No colour presets yet',colourManagerEmptyHint:'Choose a colour and tap ＋ to save it.',colourManagerUndo:'Undo',colourLibraryHint:'Presets and brand colours are together. Tap a colour to use it.',colourLibraryOrderHint:'Drag colours to change their order.',
      brandPaletteHint:'Up to four colours. Tap a colour to edit it.',brandPickerHint:'Saved as a brand colour. Your lighting stays unchanged.',brandPickerNewHint:'Choose a colour to add to your brand colours.',brandSaved:'Brand colour saved.',brandIdeas:'Colour ideas',brandApplyHint:'Choose an animation to apply these colours to your lighting.'
    },
    fr: {
      brandColours:'Les couleurs de votre marque',brandColour:'Couleur de marque {number}',brandEdit:'Modifier la couleur de marque {number}',brandEditAction:'Modifier',brandRemove:'Supprimer la couleur de marque {number}',brandAdd:'Ajouter une couleur de marque',brandTag:'Marque',brandNameLabel:'Nom de cette couleur de marque',brandNameInvalid:'Saisissez un nom de 64 caractères maximum.',brandLastColorHint:'Gardez au moins une couleur de marque',
      colourManagerTitle:'Gérer les couleurs enregistrées',colourManagerIntro:'Une seule bibliothèque pour les couleurs enregistrées et celles de marque. Vous pouvez aussi renommer et modifier ces dernières.',colourManagerEmpty:'Aucune couleur enregistrée',colourManagerEmptyHint:'Choisissez une couleur et touchez ＋ pour l’enregistrer.',colourManagerUndo:'Annuler',colourLibraryHint:'Couleurs enregistrées et couleurs de marque réunies. Touchez une couleur pour l’utiliser.',colourLibraryOrderHint:'Faites glisser les couleurs pour changer leur ordre.',
      brandPaletteHint:'Jusqu’à quatre couleurs. Touchez une couleur pour la modifier.',brandPickerHint:'Enregistrée comme couleur de marque. Votre éclairage reste inchangé.',brandPickerNewHint:'Choisissez une couleur à ajouter aux couleurs de votre marque.',brandSaved:'Couleur de marque enregistrée.',brandIdeas:'Idées de couleurs',brandApplyHint:'Choisissez une animation pour appliquer ces couleurs à votre éclairage.'
    },
    de: {
      brandColours:'Deine Markenfarben',brandColour:'Markenfarbe {number}',brandEdit:'Markenfarbe {number} bearbeiten',brandEditAction:'Ändern',brandRemove:'Markenfarbe {number} entfernen',brandAdd:'Markenfarbe hinzufügen',brandTag:'Marke',brandNameLabel:'Name dieser Markenfarbe',brandNameInvalid:'Gib einen Namen mit höchstens 64 Zeichen ein.',brandLastColorHint:'Mindestens eine Markenfarbe behalten',
      colourManagerTitle:'Farbpresets verwalten',colourManagerIntro:'Eine Bibliothek für Presets und Markenfarben. Markenfarben kannst du auch umbenennen und bearbeiten.',colourManagerEmpty:'Noch keine Farbpresets',colourManagerEmptyHint:'Wähle eine Farbe und tippe auf ＋, um sie zu speichern.',colourManagerUndo:'Rückgängig',colourLibraryHint:'Presets und Markenfarben sind zusammen. Tippe auf eine Farbe, um sie zu verwenden.',colourLibraryOrderHint:'Ziehe Farben, um ihre Reihenfolge zu ändern.',
      brandPaletteHint:'Bis zu vier Farben. Tippe auf eine Farbe, um sie zu ändern.',brandPickerHint:'Als Markenfarbe gespeichert. Deine Beleuchtung bleibt unverändert.',brandPickerNewHint:'Wähle eine Farbe für deine Markenfarben aus.',brandSaved:'Markenfarbe gespeichert.',brandIdeas:'Farbideen',brandApplyHint:'Wähle eine Animation, um diese Farben auf deine Beleuchtung anzuwenden.'
    }
  };
  Object.keys(brandColourTexts).forEach(code => Object.assign(texts[code], brandColourTexts[code]));
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
