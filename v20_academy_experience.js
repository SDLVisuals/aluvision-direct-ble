/*
 * Aluvision Academy experience
 *
 * A short, visual training follows the customer through the real application.
 * Every exercise is rendered inside the coach and never calls live(), pairing,
 * receiver configuration or another hardware path.
 */
(function academyExperience() {
  'use strict';

  const STORAGE_KEY = 'aluvision.academy.experience.v2';
  const VERSION = 2;
  const original = {
    help: window.help,
    openAcademy: window.openAcademy,
    startAcademyCourse: window.startAcademyCourse,
    home: window.home
  };

  const copy = (nl, en, fr, de) => ({ nl, en, fr, de });
  const html = (value) => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

  function language() {
    try {
      const app = JSON.parse(localStorage.aluv12 || localStorage.aluv11 || '{}');
      const value = app?.settings?.language || document.documentElement.lang || 'nl';
      return ['nl', 'en', 'fr', 'de'].includes(value) ? value : 'nl';
    } catch (_) {
      return 'nl';
    }
  }

  function t(value) {
    if (typeof value === 'string') return value;
    return value?.[language()] || value?.nl || '';
  }

  const chapters = [
    { id: 'start', icon: '⌂', title: copy('Start', 'Start', 'Départ', 'Start'), detail: copy('Locatie en overzicht', 'Location and overview', 'Lieu et aperçu', 'Standort und Übersicht'), start: 0 },
    { id: 'structure', icon: '▦', title: copy('Bouw je stand', 'Build your stand', 'Construire le stand', 'Messestand aufbauen'), detail: copy('Zones en groepen', 'Zones and groups', 'Zones et groupes', 'Zonen und Gruppen'), start: 2 },
    { id: 'receiver', icon: '▣', title: copy('Koppel LED Lines', 'Pair LED Lines', 'Associer les LED Lines', 'LED Lines koppeln'), detail: copy('Receiver, pixels en kant', 'Receiver, pixels and side', 'Receiver, pixels et côté', 'Receiver, Pixel und Seite'), start: 4 },
    { id: 'light', icon: '◉', title: copy('Maak je licht', 'Create your light', 'Créer la lumière', 'Licht gestalten'), detail: copy('Animatie en kleur', 'Animation and colour', 'Animation et couleur', 'Animation und Farbe'), start: 8 },
    { id: 'save', icon: '◇', title: copy('Bewaar je werk', 'Save your work', 'Enregistrer', 'Arbeit speichern'), detail: copy('Presets en scènes', 'Presets and scenes', 'Presets et scènes', 'Presets und Szenen'), start: 11 },
    { id: 'ready', icon: '◆', title: copy('Showklaar', 'Show ready', 'Prêt pour le salon', 'Showbereit'), detail: copy('Herstel en Studio', 'Recovery and Studio', 'Récupération et Studio', 'Wiederherstellung und Studio'), start: 14 }
  ];

  const steps = [
    {
      id: 'welcome', chapter: 'start', page: 'home', icon: '⌂',
      selector: '#home .ux-page-intro,#home h1',
      path: copy('Home', 'Home', 'Accueil', 'Home'),
      title: copy('Begin hier', 'Start here', 'Commencez ici', 'Hier beginnen'),
      text: copy('Home is je snelle startpunt. Je ziet meteen wat bereikbaar is en bedient hier desgewenst alles tegelijk.', 'Home is your quick starting point. See what is reachable and, when needed, control everything together.', 'Accueil est votre point de départ rapide. Voyez ce qui est disponible et contrôlez tout ensemble si nécessaire.', 'Home ist dein schneller Startpunkt. Sieh, was erreichbar ist, und steuere bei Bedarf alles gemeinsam.'),
      task: { type: 'ack', prompt: copy('Bekijk het echte Home-scherm.', 'Look at the real Home screen.', 'Regardez le véritable écran Accueil.', 'Sieh dir den echten Home-Bildschirm an.'), label: copy('Ik herken Home', 'I recognise Home', 'Je reconnais Accueil', 'Ich erkenne Home') }
    },
    {
      id: 'location', chapter: 'start', page: 'home', icon: '⌖',
      selector: '#home .eyebrow,#home .ux-page-intro',
      path: copy('Home · locatie', 'Home · location', 'Accueil · lieu', 'Home · Standort'),
      title: copy('Geef je locatie een duidelijke naam', 'Give the location a clear name', 'Donnez un nom clair au lieu', 'Gib dem Standort einen klaren Namen'),
      text: copy('Een locatie is de volledige stand, showroom of winkel die je nu bedient.', 'A location is the complete booth, showroom or shop you are controlling.', 'Un lieu est le stand, showroom ou magasin complet que vous contrôlez.', 'Ein Standort ist der gesamte Messestand, Showroom oder Laden, den du steuerst.'),
      task: { type: 'text', prompt: copy('Typ een herkenbare oefennaam.', 'Enter a recognisable practice name.', 'Saisissez un nom reconnaissable.', 'Gib einen klaren Übungsnamen ein.'), placeholder: copy('Bijv. Stand Hal 5', 'E.g. Booth Hall 5', 'Ex. Stand Hall 5', 'Z. B. Stand Halle 5') }
    },
    {
      id: 'zones', chapter: 'structure', page: 'zones', icon: '▦',
      selector: '.nav button[onclick="go(\'zones\')"],#zones h1',
      path: copy('Zones', 'Zones', 'Zones', 'Zonen'),
      title: copy('Een zone is een herkenbaar deel', 'A zone is a recognisable area', 'Une zone est un espace reconnaissable', 'Eine Zone ist ein erkennbarer Bereich'),
      text: copy('Gebruik bijvoorbeeld Inkom, Plafond of Achterwand. Zo vind je verlichting later snel terug.', 'Use names such as Entrance, Ceiling or Back wall, so lighting is easy to find later.', 'Utilisez par exemple Entrée, Plafond ou Mur arrière pour retrouver rapidement la lumière.', 'Nutze zum Beispiel Eingang, Decke oder Rückwand, damit du Licht schnell wiederfindest.'),
      task: { type: 'choice', prompt: copy('Welke naam is een goede zone?', 'Which is a good zone name?', 'Quel nom convient à une zone ?', 'Welcher Name eignet sich als Zone?'), expected: 'area', options: [
        ['area', copy('Achterwand', 'Back wall', 'Mur arrière', 'Rückwand'), copy('Duidelijke plaats', 'Clear area', 'Espace clair', 'Klarer Bereich')],
        ['device', copy('Receiver 7', 'Receiver 7', 'Receiver 7', 'Receiver 7'), copy('Dit is een toestel', 'This is a device', 'C’est un appareil', 'Das ist ein Gerät')]
      ] }
    },
    {
      id: 'groups', chapter: 'structure', page: 'zones', icon: '◎',
      selector: '#zones .customer-group-explorer,#zones .customer-zone-explorer,#zones h1',
      path: copy('Zone · groepen', 'Zone · groups', 'Zone · groupes', 'Zone · Gruppen'),
      title: copy('Een groep beweegt samen', 'A group moves together', 'Un groupe évolue ensemble', 'Eine Gruppe bewegt sich gemeinsam'),
      text: copy('LED Lines in één groep krijgen dezelfde kleur, animatie en helderheid. Maak aparte groepen als het licht apart moet reageren.', 'LED Lines in one group share colour, animation and brightness. Use separate groups when they must react independently.', 'Les LED Lines d’un groupe partagent couleur, animation et luminosité. Séparez-les si elles doivent réagir seules.', 'LED Lines einer Gruppe teilen Farbe, Animation und Helligkeit. Nutze getrennte Gruppen für unabhängige Reaktionen.'),
      task: { type: 'choice', prompt: copy('Vier plafondlijnen moeten gelijk bewegen. Wat kies je?', 'Four ceiling lines must move together. What do you choose?', 'Quatre lignes au plafond doivent bouger ensemble. Que choisissez-vous ?', 'Vier Deckenlinien sollen gemeinsam laufen. Was wählst du?'), expected: 'one', options: [
        ['one', copy('Eén groep · Plafond', 'One group · Ceiling', 'Un groupe · Plafond', 'Eine Gruppe · Decke'), copy('Eén gedeeld lichtrecept', 'One shared light recipe', 'Une seule recette lumière', 'Ein gemeinsames Lichtrezept')],
        ['four', copy('Vier losse groepen', 'Four separate groups', 'Quatre groupes séparés', 'Vier einzelne Gruppen'), copy('Alleen nodig voor apart licht', 'Only for independent light', 'Seulement pour un éclairage séparé', 'Nur für unabhängiges Licht')]
      ] }
    },
    {
      id: 'pairing', chapter: 'receiver', page: 'devices', icon: '＋',
      selector: '#devices button[onclick*="openAddReceiver"],#devices h1',
      path: copy('Receivers · toevoegen', 'Receivers · add', 'Receivers · ajouter', 'Receiver · hinzufügen'),
      title: copy('Koppel één receiver tegelijk', 'Pair one receiver at a time', 'Associez un receiver à la fois', 'Kopple einen Receiver nach dem anderen'),
      text: copy('De app zoekt, laat de LED Line herkenbaar knipperen en opent daarna automatisch de korte instelling.', 'The app searches, identifies the LED Line with a blink, then opens the short setup automatically.', 'L’app recherche, fait clignoter la LED Line, puis ouvre automatiquement le réglage court.', 'Die App sucht, lässt die LED Line blinken und öffnet danach automatisch die kurze Einrichtung.'),
      task: { type: 'sequence', prompt: copy('Tik de drie stappen in de juiste volgorde.', 'Tap the three steps in the correct order.', 'Touchez les trois étapes dans le bon ordre.', 'Tippe die drei Schritte in der richtigen Reihenfolge.'), expected: ['find', 'identify', 'setup'], options: [
        ['identify', copy('LED Line herkennen', 'Identify LED Line', 'Identifier la LED Line', 'LED Line erkennen')],
        ['setup', copy('Instellen en toevoegen', 'Configure and add', 'Régler et ajouter', 'Einstellen und hinzufügen')],
        ['find', copy('Receiver toevoegen', 'Add receiver', 'Ajouter un receiver', 'Receiver hinzufügen')]
      ] }
    },
    {
      id: 'pixels', chapter: 'receiver', page: 'devices', icon: '39',
      selector: '#devices .device,#devices h1',
      path: copy('Receiver · pixels', 'Receiver · pixels', 'Receiver · pixels', 'Receiver · Pixel'),
      title: copy('Zo vind je het juiste aantal pixels', 'Find the correct pixel count', 'Trouvez le bon nombre de pixels', 'So findest du die richtige Pixelzahl'),
      text: copy('Tijdens instellen brandt de lijn wit. Alleen de gekozen laatste pixel is rood. Zet rood exact op het fysieke einde.', 'During setup the line is white. Only the selected final pixel is red. Place red exactly at the physical end.', 'Pendant le réglage la ligne est blanche. Seul le dernier pixel choisi est rouge. Placez-le exactement à la fin.', 'Beim Einrichten ist die Linie weiß. Nur das gewählte Endpixel ist rot. Setze Rot genau ans physische Ende.'),
      task: { type: 'pixels', prompt: copy('Oefenlijn: het juiste einde is 39 pixels.', 'Practice line: the correct end is 39 pixels.', 'Ligne d’exercice : la bonne fin est à 39 pixels.', 'Übungslinie: Das richtige Ende liegt bei 39 Pixeln.') }
    },
    {
      id: 'receiver-side', chapter: 'receiver', page: 'devices', icon: '↔',
      selector: '#devices .device,#devices h1',
      path: copy('Receiver · aansluitzijde', 'Receiver · connection side', 'Receiver · côté de connexion', 'Receiver · Anschlussseite'),
      title: copy('Kies waar de receiver zit', 'Choose where the receiver sits', 'Choisissez le côté du receiver', 'Wähle die Receiver-Seite'),
      text: copy('Dit is een vaste montagekeuze. Groen is de start bij de receiver; rood blijft het einde. De animatierichting kies je later apart.', 'This is a fixed mounting choice. Green is the start at the receiver; red remains the end. Animation direction is chosen separately.', 'C’est un choix de montage fixe. Le vert est le départ au receiver, le rouge reste la fin. Le sens d’animation se choisit séparément.', 'Dies ist eine feste Montagewahl. Grün ist der Start am Receiver, Rot bleibt das Ende. Die Animationsrichtung wählst du getrennt.'),
      task: { type: 'side', prompt: copy('De receiver staat rechts. Kies de juiste kant.', 'The receiver is on the right. Choose the correct side.', 'Le receiver se trouve à droite. Choisissez le bon côté.', 'Der Receiver sitzt rechts. Wähle die richtige Seite.'), expected: 'right' }
    },
    {
      id: 'layouts', chapter: 'receiver', page: 'zones', icon: '≋',
      selector: '#zones .customer-group-explorer,#zones .customer-zone-explorer,#zones h1',
      path: copy('Groep · opstelling', 'Group · layout', 'Groupe · disposition', 'Gruppe · Anordnung'),
      title: copy('Kies hoe de lijnen fysiek liggen', 'Choose how the lines are mounted', 'Choisissez la disposition physique', 'Wähle die physische Anordnung'),
      text: copy('Doorlopend maakt één lange lijn. Onder elkaar houdt iedere LED Line een eigen rij voor tunnel- en paneeleffecten.', 'Continuous creates one long line. Stacked keeps every LED Line as its own row for tunnel and panel effects.', 'Continu crée une longue ligne. Superposé garde chaque LED Line comme rangée pour les effets tunnel et panneau.', 'Durchgehend ergibt eine lange Linie. Untereinander behält jede LED Line als Reihe für Tunnel- und Paneleffekte.'),
      task: { type: 'layout', prompt: copy('Voor een tunnel met vier rijen kies je…', 'For a tunnel with four rows choose…', 'Pour un tunnel à quatre rangées, choisissez…', 'Für einen Tunnel mit vier Reihen wählst du…'), expected: 'stacked' }
    },
    {
      id: 'animation', chapter: 'light', page: 'zones', icon: '✦',
      selector: '#zones [data-v1814-group-action="animation"],#zones .customer-group-explorer,#zones h1',
      path: copy('Groep · verlichting', 'Group · lighting', 'Groupe · éclairage', 'Gruppe · Licht'),
      title: copy('Kies eerst de soort beweging', 'Choose the type of movement first', 'Choisissez d’abord le mouvement', 'Wähle zuerst die Bewegungsart'),
      text: copy('Vaste kleur staat apart. Animaties zijn gegroepeerd als Chase, Flow, Wave, Pulse en Tunnel, elk met een bewegend voorbeeld.', 'Static colour is separate. Animations are grouped as Chase, Flow, Wave, Pulse and Tunnel, each with a moving preview.', 'La couleur fixe est séparée. Les animations sont groupées en Chase, Flow, Wave, Pulse et Tunnel avec aperçu animé.', 'Statische Farbe ist getrennt. Animationen sind als Chase, Flow, Wave, Pulse und Tunnel mit bewegter Vorschau gruppiert.'),
      task: { type: 'effect', prompt: copy('Kies Soft Wave voor een rustige beweging.', 'Choose Soft Wave for calm movement.', 'Choisissez Soft Wave pour un mouvement calme.', 'Wähle Soft Wave für eine ruhige Bewegung.'), expected: 'wave' }
    },
    {
      id: 'animation-settings', chapter: 'light', page: 'zones', icon: '⌁',
      selector: '#zones [data-v1814-group-tab="settings"],#zones .customer-group-explorer,#zones h1',
      path: copy('Groep · animatie-instellingen', 'Group · animation settings', 'Groupe · réglages animation', 'Gruppe · Animationseinstellungen'),
      title: copy('Stel beweging in met drie duidelijke keuzes', 'Shape motion with three clear choices', 'Réglez le mouvement avec trois choix clairs', 'Forme die Bewegung mit drei klaren Einstellungen'),
      text: copy('Snelheid bepaalt tempo, dikte is het echte aantal pixels en vloeiendheid verzacht de beweging.', 'Speed sets the pace, width is the real pixel count and smoothness softens the motion.', 'La vitesse règle le rythme, la largeur est le nombre réel de pixels et la fluidité adoucit le mouvement.', 'Tempo bestimmt die Geschwindigkeit, Breite die echte Pixelzahl und Weichheit glättet die Bewegung.'),
      task: { type: 'settings', prompt: copy('Maak het rustig: 20% · 6 px · 100% vloeiend.', 'Make it calm: 20% · 6 px · 100% smooth.', 'Créez un mouvement calme : 20 % · 6 px · 100 % fluide.', 'Mach es ruhig: 20 % · 6 px · 100 % weich.') }
    },
    {
      id: 'colours', chapter: 'light', page: 'zones', icon: '●',
      selector: '#zones [data-v1814-group-tab="colors"],#zones .customer-group-explorer,#zones h1',
      path: copy('Groep · kleuren', 'Group · colours', 'Groupe · couleurs', 'Gruppe · Farben'),
      title: copy('RGB en Wit zijn eenvoudig apart', 'RGB and White stay separate', 'RGB et Blanc restent séparés', 'RGB und Weiß bleiben getrennt'),
      text: copy('RGB geeft kleur. Wit alleen geeft neutraal wit. Warm wit gebruikt Wit met een kleine warme RGB-correctie; RGB + Wit kan ook pastel maken.', 'RGB creates colour. White alone gives neutral white. Warm white combines White with a small warm RGB correction; RGB + White can also make pastel.', 'RGB crée la couleur. Blanc seul donne un blanc neutre. Le blanc chaud combine Blanc avec une légère correction RGB chaude; RGB + Blanc crée aussi du pastel.', 'RGB erzeugt Farbe. Weiß allein ergibt neutrales Weiß. Warmweiß kombiniert Weiß mit einer kleinen warmen RGB-Korrektur; RGB + Weiß ergibt auch Pastell.'),
      task: { type: 'colour', prompt: copy('Tik Warm wit om de veilige mix te zien.', 'Tap Warm white to see the safe mix.', 'Touchez Blanc chaud pour voir le mélange.', 'Tippe Warmweiß, um die sichere Mischung zu sehen.') }
    },
    {
      id: 'presets', chapter: 'save', page: 'lighting', icon: '☆',
      selector: '.nav button[onclick="go(\'lighting\')"],#lighting h1,#lighting .preset-card',
      path: copy('Presets', 'Presets', 'Presets', 'Presets'),
      title: copy('Preset = één lichtrecept', 'Preset = one light recipe', 'Preset = une recette lumière', 'Preset = ein Lichtrezept'),
      text: copy('Een preset bewaart animatie, kleuren en instellingen van de actieve groep. Handig om hetzelfde effect snel terug te halen.', 'A preset stores animation, colours and settings for the active group. Use it to quickly recall the same effect.', 'Un preset conserve animation, couleurs et réglages du groupe actif pour les rappeler rapidement.', 'Ein Preset speichert Animation, Farben und Einstellungen der aktiven Gruppe zum schnellen Wiederaufruf.'),
      task: { type: 'choice', prompt: copy('Je wilt alleen het recept van Plafond bewaren.', 'You only want to save the Ceiling recipe.', 'Vous voulez seulement enregistrer la recette du Plafond.', 'Du willst nur das Rezept der Decke speichern.'), expected: 'preset', options: [
        ['preset', copy('Preset bewaren', 'Save preset', 'Enregistrer le preset', 'Preset speichern'), copy('Alleen de actieve groep', 'Active group only', 'Seulement le groupe actif', 'Nur aktive Gruppe')],
        ['scene', copy('Scène bewaren', 'Save scene', 'Enregistrer la scène', 'Szene speichern'), copy('Meerdere gekozen groepen', 'Several selected groups', 'Plusieurs groupes', 'Mehrere Gruppen')]
      ] }
    },
    {
      id: 'scenes', chapter: 'save', page: 'scenes', icon: '◇',
      selector: '#scenes button[onclick*="Scene"],#scenes h1',
      path: copy('Scènes', 'Scenes', 'Scènes', 'Szenen'),
      title: copy('Scène = gekozen groepen samen', 'Scene = selected groups together', 'Scène = groupes choisis ensemble', 'Szene = ausgewählte Gruppen gemeinsam'),
      text: copy('Stel eerst iedere groep goed in. Kies daarna precies welke groepen de scène moet onthouden.', 'Set up every group first, then choose exactly which groups the scene should remember.', 'Réglez d’abord chaque groupe, puis choisissez exactement les groupes à mémoriser.', 'Stelle zuerst jede Gruppe ein und wähle dann genau die Gruppen, die die Szene speichern soll.'),
      task: { type: 'scene', prompt: copy('Selecteer Plafond en Achterwand en bewaar.', 'Select Ceiling and Back wall, then save.', 'Sélectionnez Plafond et Mur arrière, puis enregistrez.', 'Wähle Decke und Rückwand und speichere.') }
    },
    {
      id: 'shortcuts', chapter: 'save', page: 'home', icon: '◎',
      selector: '#home [data-ui="all-lighting"],#home .v1814-home-control,#home h1',
      path: copy('Home · snelle bediening', 'Home · quick control', 'Accueil · commande rapide', 'Home · Schnellsteuerung'),
      title: copy('Kies altijd eerst het juiste bereik', 'Always choose the correct scope first', 'Choisissez toujours la bonne portée', 'Wähle immer zuerst den richtigen Bereich'),
      text: copy('Alle verlichting bedient de volledige locatie. Een zone bedient alleen die zone; een groep alleen de gekozen lijnen.', 'All lighting controls the whole location. A zone controls only that zone; a group only its selected lines.', 'Tout l’éclairage contrôle le lieu complet. Une zone ne contrôle que cette zone; un groupe ses lignes.', 'Gesamte Beleuchtung steuert den ganzen Standort. Eine Zone nur diese Zone; eine Gruppe nur ihre Linien.'),
      task: { type: 'choice', prompt: copy('De hele beursstand moet tegelijk uit. Welk bereik?', 'The entire booth must switch off together. Which scope?', 'Tout le stand doit s’éteindre ensemble. Quelle portée ?', 'Der ganze Messestand soll gemeinsam ausgehen. Welcher Bereich?'), expected: 'all', options: [
        ['group', copy('Alleen Plafond', 'Ceiling only', 'Plafond seulement', 'Nur Decke'), copy('Eén groep', 'One group', 'Un groupe', 'Eine Gruppe')],
        ['all', copy('Alle verlichting', 'All lighting', 'Tout l’éclairage', 'Gesamte Beleuchtung'), copy('Volledige locatie', 'Whole location', 'Lieu complet', 'Ganzer Standort')]
      ] }
    },
    {
      id: 'recovery', chapter: 'ready', page: 'settings', icon: '↻',
      selector: '#settings [onclick*="Recovery"],#settings h1,#settings .card',
      path: copy('Instellingen · herstel', 'Settings · recovery', 'Réglages · récupération', 'Einstellungen · Wiederherstellung'),
      title: copy('Nieuwe telefoon? Herstel, niet opnieuw bouwen', 'New phone? Restore, do not rebuild', 'Nouveau téléphone ? Restaurez sans reconstruire', 'Neues Telefon? Wiederherstellen statt neu bauen'),
      text: copy('Met herstelcode en fysieke bevestiging komt de bestaande installatie terug. Verwijder nooit receivers om een verbindingsprobleem op te lossen.', 'Your recovery code and physical confirmation bring the existing installation back. Never remove receivers to solve a connection problem.', 'Le code de récupération et la confirmation physique restaurent l’installation. Ne supprimez jamais les receivers pour un problème de connexion.', 'Wiederherstellungscode und physische Bestätigung bringen die Anlage zurück. Entferne Receiver nie wegen eines Verbindungsproblems.'),
      task: { type: 'choice', prompt: copy('De app is opnieuw geïnstalleerd. Wat kies je?', 'The app was reinstalled. What do you choose?', 'L’app a été réinstallée. Que choisissez-vous ?', 'Die App wurde neu installiert. Was wählst du?'), expected: 'restore', options: [
        ['restore', copy('Bestaande installatie herstellen', 'Restore existing installation', 'Restaurer l’installation', 'Bestehende Anlage wiederherstellen'), copy('Zones en instellingen komen terug', 'Zones and settings return', 'Zones et réglages reviennent', 'Zonen und Einstellungen kommen zurück')],
        ['reset', copy('Fabrieksreset', 'Factory reset', 'Réinitialisation usine', 'Werkseinstellungen'), copy('Dit wist de receiver', 'This erases the receiver', 'Cela efface le receiver', 'Dies löscht den Receiver')]
      ] }
    },
    {
      id: 'studio', chapter: 'ready', page: 'studio', icon: '◆',
      selector: '#studio .studio-v186,#studio .studio-workspace,#studio h1',
      path: copy('Animation Studio', 'Animation Studio', 'Animation Studio', 'Animation Studio'),
      title: copy('Studio bouwt een eigen show in lagen', 'Studio builds a custom show in layers', 'Studio construit un show personnalisé en couches', 'Studio baut eine eigene Show in Ebenen'),
      text: copy('Begin eenvoudig: kies lijnen, voeg een effect toe, bepaal de tijd en bekijk de preview. Live zet je pas aan wanneer je klaar bent.', 'Keep it simple: choose lines, add an effect, set timing and check the preview. Turn Live on only when ready.', 'Restez simple : choisissez les lignes, ajoutez un effet, réglez le temps et regardez l’aperçu. Activez Live seulement à la fin.', 'Bleib einfach: Linien wählen, Effekt hinzufügen, Zeit festlegen und Vorschau prüfen. Live erst einschalten, wenn alles bereit ist.'),
      task: { type: 'sequence', prompt: copy('Tik de veilige Studio-volgorde.', 'Tap the safe Studio order.', 'Touchez l’ordre Studio sûr.', 'Tippe die sichere Studio-Reihenfolge.'), expected: ['range', 'layer', 'preview', 'live'], options: [
        ['live', copy('Live aan', 'Live on', 'Activer Live', 'Live an')],
        ['layer', copy('Effectlaag', 'Effect layer', 'Couche d’effet', 'Effektebene')],
        ['range', copy('LED Lines kiezen', 'Choose LED Lines', 'Choisir les LED Lines', 'LED Lines wählen')],
        ['preview', copy('Preview controleren', 'Check preview', 'Vérifier l’aperçu', 'Vorschau prüfen')]
      ] }
    },
    {
      id: 'finish', chapter: 'ready', page: 'home', icon: '✓',
      selector: '#home h1,#home .ux-page-intro',
      path: copy('Home · showklaar', 'Home · show ready', 'Accueil · prêt', 'Home · showbereit'),
      title: copy('Je kent de volledige werkvolgorde', 'You know the complete workflow', 'Vous connaissez le flux complet', 'Du kennst den vollständigen Ablauf'),
      text: copy('Locatie → zone → groep → receiver → licht → preset of scène. Controleer bereikbaarheid vóór de beurs opent.', 'Location → zone → group → receiver → light → preset or scene. Check reachability before the show opens.', 'Lieu → zone → groupe → receiver → lumière → preset ou scène. Vérifiez la disponibilité avant l’ouverture.', 'Standort → Zone → Gruppe → Receiver → Licht → Preset oder Szene. Prüfe die Erreichbarkeit vor Showbeginn.'),
      task: { type: 'ack', prompt: copy('Je bent klaar om een stand op te bouwen.', 'You are ready to build a booth.', 'Vous êtes prêt à construire un stand.', 'Du bist bereit, einen Messestand aufzubauen.'), label: copy('Opleiding afronden', 'Complete training', 'Terminer la formation', 'Training abschließen') }
    }
  ];

  function blankRecord() {
    return { version: VERSION, current: 0, completed: [], skipped: [], finished: false, updatedAt: 0 };
  }

  function loadRecord() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!parsed || parsed.version !== VERSION) return blankRecord();
      parsed.completed = Array.isArray(parsed.completed) ? parsed.completed.filter((id) => steps.some((step) => step.id === id)) : [];
      parsed.skipped = Array.isArray(parsed.skipped) ? parsed.skipped.filter((id) => steps.some((step) => step.id === id)) : [];
      parsed.current = Math.max(0, Math.min(steps.length - 1, Number(parsed.current) || 0));
      return parsed;
    } catch (_) {
      return blankRecord();
    }
  }

  let record = loadRecord();
  let session = { active: false, index: record.current, practice: {}, feedback: null };

  function saveRecord() {
    record.current = session.index;
    record.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  }

  function visitedCount() {
    return new Set([...record.completed, ...record.skipped]).size;
  }

  function percentage() {
    return Math.round((visitedCount() / steps.length) * 100);
  }

  function chapterFor(step) {
    return chapters.find((item) => item.id === step?.chapter) || chapters[0];
  }

  function openModal(markup) {
    const modal = document.getElementById('modal');
    const body = document.getElementById('modalBody');
    if (!modal || !body) return;
    body.innerHTML = markup;
    modal.hidden = false;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    requestAnimationFrame(() => body.querySelector('button')?.focus({ preventScroll: true }));
  }

  function closeAppModal() {
    if (typeof window.closeModal === 'function') window.closeModal();
    else document.getElementById('modal')?.setAttribute('hidden', '');
  }

  function clearTarget() {
    document.querySelectorAll('.alv-academy-target').forEach((node) => {
      node.classList.remove('alv-academy-target');
      node.removeAttribute('aria-describedby');
    });
  }

  function clearCoach() {
    clearTarget();
    document.getElementById('academyV2Coach')?.remove();
  }

  function visibleTarget(selector) {
    if (!selector) return null;
    return [...document.querySelectorAll(selector)].find((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 2 && rect.height > 2 && style.display !== 'none' && style.visibility !== 'hidden';
    }) || null;
  }

  function practiceFor(id) {
    if (!session.practice[id]) session.practice[id] = {};
    return session.practice[id];
  }

  function choiceMarkup(step) {
    const state = practiceFor(step.id);
    return `<div class="academy-v2-choice-grid">${step.task.options.map(([value, label, detail]) => `<button class="academy-v2-choice ${state.choice === value ? 'selected' : ''}" data-academy-answer="${html(value)}" onclick="AluvisionAcademy.answer('${html(value)}')"><b>${html(t(label))}</b>${detail ? `<small>${html(t(detail))}</small>` : ''}</button>`).join('')}</div>`;
  }

  function sequenceMarkup(step) {
    const state = practiceFor(step.id);
    const done = state.sequence || [];
    return `<div class="academy-v2-sequence">${step.task.options.map(([value, label]) => `<button class="${done.includes(value) ? 'done' : ''}" onclick="AluvisionAcademy.sequence('${html(value)}')">${done.includes(value) ? '✓ ' : ''}${html(t(label))}</button>`).join('<i>›</i>')}</div>`;
  }

  function pixelsMarkup(step) {
    const state = practiceFor(step.id);
    const value = Number(state.pixels) || 25;
    const correct = value === 39;
    return `<div class="academy-v2-slider"><label>${html(t(copy('Pixels', 'Pixels', 'Pixels', 'Pixel')))}</label><input data-academy-pixels aria-label="${html(t(copy('Aantal pixels', 'Pixel count', 'Nombre de pixels', 'Pixelzahl')))}" type="range" min="1" max="80" value="${value}" oninput="AluvisionAcademy.pixel(this.value)"><input data-academy-pixels aria-label="${html(t(copy('Aantal', 'Count', 'Nombre', 'Anzahl')))}" type="number" min="1" max="80" value="${value}" oninput="AluvisionAcademy.pixel(this.value)"></div><div id="academyV2PixelLine" class="academy-v2-ledline" aria-label="${html(t(copy('Witte oefenlijn met rode eindpixel', 'White practice line with red final pixel', 'Ligne blanche avec pixel final rouge', 'Weiße Übungslinie mit rotem Endpixel')))}">${Array.from({ length: 20 }, (_, index) => `<i class="${correct && index === 19 ? 'end' : ''}"></i>`).join('')}</div><small id="academyV2PixelStatus">${html(value)} px · ${correct ? html(t(copy('rood staat op het einde', 'red is at the end', 'le rouge est à la fin', 'Rot steht am Ende'))) : html(t(copy('zoek het rode einde', 'find the red end', 'cherchez la fin rouge', 'suche das rote Ende')))}</small>`;
  }

  function sideMarkup(step) {
    const state = practiceFor(step.id);
    const side = state.side || 'left';
    const receiver = `<span class="receiver">RX</span>`;
    return `<div class="academy-v2-side ${side}">${receiver}<span class="line">${Array.from({ length: 10 }, () => '<i></i>').join('')}</span>${receiver}</div><div class="academy-v2-choice-grid"><button class="academy-v2-choice ${side === 'left' ? 'selected' : ''}" onclick="AluvisionAcademy.side('left')"><b>▣━━━━ ${html(t(copy('Links', 'Left', 'Gauche', 'Links')))}</b></button><button class="academy-v2-choice ${side === 'right' ? 'selected' : ''}" onclick="AluvisionAcademy.side('right')"><b>${html(t(copy('Rechts', 'Right', 'Droite', 'Rechts')))} ━━━━▣</b></button></div>`;
  }

  function layoutMarkup(step) {
    const state = practiceFor(step.id);
    return `<div class="academy-v2-layouts"><button class="academy-v2-layout ${state.layout === 'continuous' ? 'selected' : ''}" onclick="AluvisionAcademy.layout('continuous')"><span class="academy-v2-layout-demo continuous"><i></i></span><b>${html(t(copy('Doorlopend', 'Continuous', 'Continu', 'Durchgehend')))}</b><small>${html(t(copy('Eén lange route', 'One long route', 'Un long trajet', 'Eine lange Strecke')))}</small></button><button class="academy-v2-layout ${state.layout === 'stacked' ? 'selected' : ''}" onclick="AluvisionAcademy.layout('stacked')"><span class="academy-v2-layout-demo stacked"><i></i></span><b>${html(t(copy('Onder elkaar', 'Stacked', 'Superposé', 'Untereinander')))}</b><small>${html(t(copy('Aparte rijen · tunnel', 'Separate rows · tunnel', 'Rangées séparées · tunnel', 'Getrennte Reihen · Tunnel')))}</small></button></div>`;
  }

  function effectMarkup(step) {
    const state = practiceFor(step.id);
    const effects = [
      ['chase', 'Chase', 'chase'], ['wave', 'Soft Wave', 'wave'], ['pulse', 'Pulse', 'pulse']
    ];
    return `<div class="academy-v2-effects">${effects.map(([value, label, kind]) => `<button class="academy-v2-effect ${kind} ${state.effect === value ? 'selected' : ''}" onclick="AluvisionAcademy.effect('${value}')"><span class="academy-v2-effect-preview"></span><small>${label}</small></button>`).join('')}</div>`;
  }

  function settingsMarkup(step) {
    const state = practiceFor(step.id);
    const values = { speed: state.speed ?? 45, width: state.width ?? 3, smooth: state.smooth ?? 70 };
    const row = (key, label, min, max, suffix) => `<div class="academy-v2-slider"><label>${html(label)}</label><input data-academy-setting="${key}" type="range" min="${min}" max="${max}" value="${values[key]}" oninput="AluvisionAcademy.setting('${key}',this.value)"><input data-academy-setting="${key}" type="number" min="${min}" max="${max}" value="${values[key]}" aria-label="${html(label)}" oninput="AluvisionAcademy.setting('${key}',this.value)" data-suffix="${html(suffix)}"></div>`;
    return `${row('speed', t(copy('Tempo %', 'Speed %', 'Vitesse %', 'Tempo %')), 1, 100, '%')}${row('width', t(copy('Dikte px', 'Width px', 'Largeur px', 'Breite px')), 1, 39, ' px')}${row('smooth', t(copy('Vloeiend %', 'Smooth %', 'Fluidité %', 'Weich %')), 0, 100, '%')}`;
  }

  function colourMarkup(step) {
    const state = practiceFor(step.id);
    const mode = state.colour || 'rgb';
    return `<div class="academy-v2-swatch" style="${mode === 'white' ? 'background:#fff' : mode === 'warm' ? 'background:linear-gradient(90deg,#fff2dc,#ffc679)' : 'background:linear-gradient(90deg,#ff4d3f,#7d52ff,#2fc0b0)'}"></div><div class="academy-v2-power"><button class="${mode === 'rgb' ? 'on' : ''}" onclick="AluvisionAcademy.colour('rgb')">RGB</button><button class="${mode === 'white' ? 'on' : ''}" onclick="AluvisionAcademy.colour('white')">WIT</button><button class="${mode === 'warm' ? 'on' : ''}" onclick="AluvisionAcademy.colour('warm')">${html(t(copy('WARM WIT', 'WARM WHITE', 'BLANC CHAUD', 'WARMWEISS')))}</button></div>`;
  }

  function sceneMarkup(step) {
    const state = practiceFor(step.id);
    const selected = state.scene || [];
    const group = (id, label, effect) => `<button class="${selected.includes(id) ? 'selected' : ''}" onclick="AluvisionAcademy.sceneToggle('${id}')"><span><b>${selected.includes(id) ? '☑' : '□'} ${html(label)}</b><small>${html(effect)}</small></span><span>›</span></button>`;
    return `<div class="academy-v2-scene-groups">${group('ceiling', t(copy('Plafond', 'Ceiling', 'Plafond', 'Decke')), 'Soft Wave · warm wit')}${group('wall', t(copy('Achterwand', 'Back wall', 'Mur arrière', 'Rückwand')), 'Chase · rood')}${group('counter', t(copy('Balie', 'Counter', 'Comptoir', 'Theke')), 'Static Color')}</div><button class="button academy-v2-submit" onclick="AluvisionAcademy.sceneSave()">${html(t(copy('Geselecteerde groepen bewaren', 'Save selected groups', 'Enregistrer les groupes', 'Ausgewählte Gruppen speichern')))}</button>`;
  }

  function taskMarkup(step) {
    const task = step.task;
    let control = '';
    if (task.type === 'ack') control = `<button class="button academy-v2-submit" onclick="AluvisionAcademy.answer('ack')">${html(t(task.label))}</button>`;
    if (task.type === 'text') control = `<input id="academyV2Text" class="academy-v2-field" autocomplete="off" placeholder="${html(t(task.placeholder))}"><button class="button academy-v2-submit" onclick="AluvisionAcademy.answer(document.getElementById('academyV2Text').value)">${html(t(copy('Naam gebruiken', 'Use this name', 'Utiliser ce nom', 'Namen verwenden')))}</button>`;
    if (task.type === 'choice') control = choiceMarkup(step);
    if (task.type === 'sequence') control = sequenceMarkup(step);
    if (task.type === 'pixels') control = pixelsMarkup(step);
    if (task.type === 'side') control = sideMarkup(step);
    if (task.type === 'layout') control = layoutMarkup(step);
    if (task.type === 'effect') control = effectMarkup(step);
    if (task.type === 'settings') control = settingsMarkup(step);
    if (task.type === 'colour') control = colourMarkup(step);
    if (task.type === 'scene') control = sceneMarkup(step);
    const completed = record.completed.includes(step.id);
    return `<section class="academy-v2-safe" aria-label="${html(t(copy('Veilige oefening', 'Safe practice', 'Exercice sûr', 'Sichere Übung')))}"><header class="academy-v2-safe-head"><span>${html(t(copy('Probeer zelf', 'Try it yourself', 'Essayez vous-même', 'Selbst ausprobieren')))}</span><small>${html(t(copy('geen live licht', 'no live output', 'aucune sortie en direct', 'keine Live-Ausgabe')))}</small></header><p class="academy-v2-task-title">${html(t(task.prompt))}</p>${control}<div id="academyV2Feedback" class="academy-v2-task-feedback ${session.feedback ? 'show' : ''} ${completed ? 'ok' : ''}" aria-live="polite">${completed ? html(t(copy('Goed gedaan. Je kunt verder.', 'Well done. You can continue.', 'Bravo. Vous pouvez continuer.', 'Gut gemacht. Du kannst weiter.'))) : html(session.feedback || '')}</div></section>`;
  }

  function coachMarkup(step, target) {
    const chapter = chapterFor(step);
    const solved = record.completed.includes(step.id);
    return `<aside id="academyV2Coach" class="academy-v2-coach" role="dialog" aria-modal="false" aria-labelledby="academyV2Title"><header class="academy-v2-coach-head"><i>${html(step.icon)}</i><span><b>${html(t(chapter.title))}</b><small>${html(t(copy('STAP', 'STEP', 'ÉTAPE', 'SCHRITT')))} ${session.index + 1} / ${steps.length}</small></span><button class="academy-v2-close" onclick="AluvisionAcademy.stop()" aria-label="${html(t(copy('Opleiding sluiten', 'Close training', 'Fermer la formation', 'Training schließen')))}">×</button></header><div class="academy-v2-track">${steps.map((item, index) => `<i class="${record.completed.includes(item.id) || record.skipped.includes(item.id) ? 'done' : index === session.index ? 'current' : ''}"></i>`).join('')}</div><div class="academy-v2-body"><span class="academy-v2-location"><i></i>${html(t(step.path))}</span><h2 id="academyV2Title">${html(t(step.title))}</h2><p>${html(t(step.text))}</p>${target ? '' : `<div class="academy-v2-missing">${html(t(copy('Deze pagina heeft nog geen eigen gegevens. Je kunt de oefening wel volledig doen.', 'This page has no data yet. You can still complete the practice.', 'Cette page ne contient pas encore de données. Vous pouvez tout de même faire l’exercice.', 'Diese Seite hat noch keine Daten. Du kannst die Übung trotzdem vollständig machen.')))}</div>`}${taskMarkup(step)}${solved ? `<div class="academy-v2-success"><i>✓</i>${html(t(copy('Stap onthouden', 'Step saved', 'Étape enregistrée', 'Schritt gespeichert')))}</div>` : ''}</div><footer class="academy-v2-actions"><button class="button soft" onclick="AluvisionAcademy.previous()" ${session.index === 0 ? 'disabled' : ''}>← ${html(t(copy('Terug', 'Back', 'Retour', 'Zurück')))}</button><button class="button soft academy-v2-skip" onclick="AluvisionAcademy.skip()">${html(t(copy('Overslaan', 'Skip', 'Passer', 'Überspringen')))}</button><button class="button academy-v2-next" onclick="AluvisionAcademy.next()" ${solved ? '' : 'disabled'}>${session.index === steps.length - 1 ? html(t(copy('Afronden', 'Finish', 'Terminer', 'Abschließen'))) : html(t(copy('Volgende', 'Next', 'Suivant', 'Weiter')))} →</button></footer></aside>`;
  }

  function navigateAndRender() {
    if (!session.active) return;
    const step = steps[session.index];
    if (!step) return completeTraining();
    if (step.page && typeof window.go === 'function') window.go(step.page);
    requestAnimationFrame(() => requestAnimationFrame(renderCoach));
  }

  function renderCoach() {
    if (!session.active) return;
    clearCoach();
    const step = steps[session.index];
    const target = visibleTarget(step.selector) || visibleTarget(`#${step.page} h1,#${step.page}`);
    if (target) {
      target.classList.add('alv-academy-target');
      target.setAttribute('aria-describedby', 'academyV2Title');
      setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' }), 80);
    }
    document.body.insertAdjacentHTML('beforeend', coachMarkup(step, target));
  }

  function completeStep(step) {
    if (!record.completed.includes(step.id)) record.completed.push(step.id);
    record.skipped = record.skipped.filter((id) => id !== step.id);
    session.feedback = null;
    saveRecord();
    renderCoach();
  }

  function wrong(message) {
    session.feedback = t(message || copy('Nog niet. Probeer nog eens.', 'Not yet. Try again.', 'Pas encore. Réessayez.', 'Noch nicht. Versuch es erneut.'));
    const feedback = document.getElementById('academyV2Feedback');
    if (feedback) {
      feedback.textContent = session.feedback;
      feedback.classList.add('show');
      feedback.classList.remove('ok');
    }
  }

  function answer(value) {
    const step = steps[session.index];
    if (!step) return;
    const state = practiceFor(step.id);
    if (step.task.type === 'ack') return completeStep(step);
    if (step.task.type === 'text') {
      state.text = String(value || '').trim();
      return state.text.length >= 3 ? completeStep(step) : wrong(copy('Gebruik een duidelijke naam van minstens drie tekens.', 'Use a clear name of at least three characters.', 'Utilisez un nom clair d’au moins trois caractères.', 'Nutze einen klaren Namen mit mindestens drei Zeichen.'));
    }
    if (step.task.type === 'choice') {
      state.choice = value;
      return String(value) === String(step.task.expected) ? completeStep(step) : wrong(copy('Die keuze past niet bij deze situatie.', 'That choice does not fit this situation.', 'Ce choix ne convient pas à cette situation.', 'Diese Wahl passt nicht zur Situation.'));
    }
  }

  function sequence(value) {
    const step = steps[session.index];
    if (!step || step.task.type !== 'sequence') return;
    const state = practiceFor(step.id);
    state.sequence = state.sequence || [];
    const expected = step.task.expected[state.sequence.length];
    if (value !== expected) return wrong(copy('Begin bij de eerste veilige stap. De volgorde is belangrijk.', 'Start with the first safe step. The order matters.', 'Commencez par la première étape sûre. L’ordre est important.', 'Beginne mit dem ersten sicheren Schritt. Die Reihenfolge ist wichtig.'));
    state.sequence.push(value);
    session.feedback = null;
    if (state.sequence.length === step.task.expected.length) completeStep(step);
    else renderCoach();
  }

  function pixel(value) {
    const step = steps[session.index];
    const state = practiceFor(step.id);
    state.pixels = Math.max(1, Math.min(80, Number(value) || 1));
    session.feedback = null;
    if (state.pixels === 39) completeStep(step);
    else {
      document.querySelectorAll('[data-academy-pixels]').forEach((input) => { input.value = String(state.pixels); });
      document.querySelector('#academyV2PixelLine i.end')?.classList.remove('end');
      const status = document.getElementById('academyV2PixelStatus');
      if (status) status.textContent = `${state.pixels} px · ${t(copy('zoek het rode einde', 'find the red end', 'cherchez la fin rouge', 'suche das rote Ende'))}`;
      const feedback = document.getElementById('academyV2Feedback');
      feedback?.classList.remove('show', 'ok');
    }
  }

  function side(value) {
    const step = steps[session.index];
    practiceFor(step.id).side = value;
    session.feedback = null;
    if (value === step.task.expected) completeStep(step);
    else {
      renderCoach();
      wrong(copy('Kijk waar het kleine receiverblok staat.', 'Look at the small receiver block.', 'Regardez où se trouve le petit bloc receiver.', 'Sieh nach, wo der kleine Receiverblock steht.'));
    }
  }

  function layout(value) {
    const step = steps[session.index];
    practiceFor(step.id).layout = value;
    session.feedback = null;
    if (value === step.task.expected) completeStep(step);
    else {
      renderCoach();
      wrong(copy('Een tunnel gebruikt aparte rijen onder elkaar.', 'A tunnel uses separate stacked rows.', 'Un tunnel utilise des rangées séparées.', 'Ein Tunnel nutzt getrennte Reihen untereinander.'));
    }
  }

  function effect(value) {
    const step = steps[session.index];
    practiceFor(step.id).effect = value;
    session.feedback = null;
    if (value === step.task.expected) completeStep(step);
    else {
      renderCoach();
      wrong(copy('Zoek de rustige golfbeweging.', 'Look for the calm wave movement.', 'Cherchez le mouvement de vague calme.', 'Suche die ruhige Wellenbewegung.'));
    }
  }

  function setting(key, value) {
    const step = steps[session.index];
    if (!step || step.task.type !== 'settings') return;
    const state = practiceFor(step.id);
    const limits = { speed: [1, 100], width: [1, 39], smooth: [0, 100] };
    state[key] = Math.max(limits[key][0], Math.min(limits[key][1], Number(value) || 0));
    session.feedback = null;
    if (state.speed === 20 && state.width === 6 && state.smooth === 100) completeStep(step);
    else {
      document.querySelectorAll(`[data-academy-setting="${key}"]`).forEach((input) => { input.value = String(state[key]); });
      const feedback = document.getElementById('academyV2Feedback');
      feedback?.classList.remove('show', 'ok');
    }
  }

  function colour(value) {
    const step = steps[session.index];
    practiceFor(step.id).colour = value;
    session.feedback = null;
    if (value === 'warm') completeStep(step);
    else renderCoach();
  }

  function sceneToggle(value) {
    const step = steps[session.index];
    const state = practiceFor(step.id);
    state.scene = state.scene || [];
    state.scene = state.scene.includes(value) ? state.scene.filter((item) => item !== value) : [...state.scene, value];
    session.feedback = null;
    renderCoach();
  }

  function sceneSave() {
    const step = steps[session.index];
    const selected = practiceFor(step.id).scene || [];
    if (selected.length === 2 && selected.includes('ceiling') && selected.includes('wall')) completeStep(step);
    else wrong(copy('Selecteer precies Plafond en Achterwand.', 'Select exactly Ceiling and Back wall.', 'Sélectionnez exactement Plafond et Mur arrière.', 'Wähle genau Decke und Rückwand.'));
  }

  function openHub() {
    stop(true);
    record = loadRecord();
    const hasProgress = visitedCount() > 0 && !record.finished;
    const completedChapters = chapters.filter((chapter, index) => {
      const end = chapters[index + 1]?.start ?? steps.length;
      return steps.slice(chapter.start, end).every((step) => record.completed.includes(step.id));
    }).length;
    openModal(`<div class="academy-v2-hub"><section class="academy-v2-hero"><div class="academy-v2-hero-copy"><div class="eyebrow">ALUVISION ACADEMY</div><h1>${html(t(copy('Van lege stand naar showklaar licht', 'From empty booth to show-ready light', 'Du stand vide à la lumière prête', 'Vom leeren Stand zum fertigen Licht')))}</h1><p>${html(t(copy('Korte stappen, bewegende voorbeelden en veilige oefeningen. De Academy toont tegelijk waar alles in de echte app staat.', 'Short steps, moving examples and safe practice. Academy also shows where everything lives in the real app.', 'Étapes courtes, exemples animés et exercices sûrs. Academy montre aussi où tout se trouve dans l’app.', 'Kurze Schritte, bewegte Beispiele und sichere Übungen. Academy zeigt zugleich, wo alles in der echten App liegt.')))}</p></div><div class="academy-v2-progress-ring" style="--value:${percentage()}"><span>${percentage()}%<small>${html(t(copy('DOORLOPEN', 'VISITED', 'PARCOURU', 'BESUCHT')))}</small></span></div></section><section class="academy-v2-primary"><i>${record.finished ? '✓' : '▶'}</i><span><b>${record.finished ? html(t(copy('Opleiding voltooid', 'Training complete', 'Formation terminée', 'Training abgeschlossen'))) : hasProgress ? html(t(copy('Ga verder waar je stopte', 'Continue where you stopped', 'Reprendre où vous étiez', 'Weitermachen'))) : html(t(copy('Volledige opleiding', 'Complete training', 'Formation complète', 'Vollständiges Training')))}</b><small>${visitedCount()} / ${steps.length} ${html(t(copy('korte stappen', 'short steps', 'étapes courtes', 'kurze Schritte')))} · ±12 min</small></span><div class="academy-v2-primary-actions"><button class="button" onclick="AluvisionAcademy.start(${hasProgress ? record.current : 0})">${hasProgress ? html(t(copy('Hervatten', 'Resume', 'Reprendre', 'Fortsetzen'))) : record.finished ? html(t(copy('Opnieuw bekijken', 'Review again', 'Revoir', 'Nochmals ansehen'))) : html(t(copy('Start', 'Start', 'Démarrer', 'Start')))} →</button></div></section><div class="academy-v2-section-head"><span><h2>${html(t(copy('Kies een hoofdstuk', 'Choose a chapter', 'Choisissez un chapitre', 'Kapitel wählen')))}</h2><p>${html(t(copy('Handig wanneer je maar één onderdeel wilt herhalen.', 'Useful when you only want to repeat one part.', 'Pratique pour répéter une seule partie.', 'Praktisch, wenn du nur einen Teil wiederholen willst.')))}</p></span><b>${completedChapters}/${chapters.length}</b></div><section class="academy-v2-chapters">${chapters.map((chapter) => `<button class="academy-v2-chapter" onclick="AluvisionAcademy.startChapter('${chapter.id}')"><i>${chapter.icon}</i><span><b>${html(t(chapter.title))}</b><small>${html(t(chapter.detail))}</small></span></button>`).join('')}</section><section class="academy-v2-principles"><div class="academy-v2-principle"><i>◉</i><span><b>${html(t(copy('Live is direct', 'Live is immediate', 'Live est immédiat', 'Live ist sofort')))}</b><small>${html(t(copy('Opslaan is alleen voor later.', 'Save is only for later recall.', 'Enregistrer sert pour plus tard.', 'Speichern ist nur für später.')))}</small></span></div><div class="academy-v2-principle"><i>▦</i><span><b>${html(t(copy('Zone → groep', 'Zone → group', 'Zone → groupe', 'Zone → Gruppe')))}</b><small>${html(t(copy('Eerst plaats, dan samen bewegen.', 'First the area, then what moves together.', 'D’abord le lieu, puis ce qui bouge ensemble.', 'Erst Bereich, dann gemeinsames Licht.')))}</small></span></div><div class="academy-v2-principle"><i>✓</i><span><b>${html(t(copy('Veilig oefenen', 'Safe practice', 'Exercice sûr', 'Sicher üben')))}</b><small>${html(t(copy('Oefeningen sturen geen licht.', 'Practice sends no light output.', 'Les exercices n’envoient aucune lumière.', 'Übungen senden kein Licht.')))}</small></span></div></section><footer class="academy-v2-footer"><p>${html(t(copy('Voortgang wordt alleen op dit toestel bewaard.', 'Progress is stored only on this device.', 'La progression est enregistrée sur cet appareil.', 'Fortschritt wird nur auf diesem Gerät gespeichert.')))}</p><div><button class="button soft" onclick="AluvisionAcademy.reset()">${html(t(copy('Voortgang wissen', 'Clear progress', 'Effacer la progression', 'Fortschritt löschen')))}</button> <button class="button soft" onclick="closeModal()">${html(t(copy('Sluiten', 'Close', 'Fermer', 'Schließen')))}</button></div></footer></div>`);
  }

  function start(index = record.current) {
    closeAppModal();
    clearCoach();
    session.active = true;
    session.index = Math.max(0, Math.min(steps.length - 1, Number(index) || 0));
    session.feedback = null;
    record.current = session.index;
    saveRecord();
    navigateAndRender();
  }

  function startChapter(id) {
    const chapter = chapters.find((item) => item.id === id);
    start(chapter?.start || 0);
  }

  function stop(silent = false) {
    if (session.active) saveRecord();
    session.active = false;
    clearCoach();
    if (!silent && typeof window.toast === 'function') window.toast(t(copy('Opleiding gepauzeerd', 'Training paused', 'Formation en pause', 'Training pausiert')));
  }

  function next() {
    const step = steps[session.index];
    if (!record.completed.includes(step.id)) return;
    if (session.index >= steps.length - 1) return completeTraining();
    session.index += 1;
    session.feedback = null;
    saveRecord();
    navigateAndRender();
  }

  function previous() {
    if (session.index <= 0) return;
    session.index -= 1;
    session.feedback = null;
    saveRecord();
    navigateAndRender();
  }

  function skip() {
    const step = steps[session.index];
    if (!record.completed.includes(step.id) && !record.skipped.includes(step.id)) record.skipped.push(step.id);
    if (session.index >= steps.length - 1) return completeTraining();
    session.index += 1;
    session.feedback = null;
    saveRecord();
    navigateAndRender();
  }

  function completeTraining() {
    session.active = false;
    record.finished = true;
    record.current = steps.length - 1;
    saveRecord();
    clearCoach();
    openModal(`<div class="academy-v2-complete"><div class="academy-v2-complete-mark">✓</div><div><div class="eyebrow">ALUVISION ACADEMY</div><h1>${html(t(copy('Je bent showklaar', 'You are show ready', 'Vous êtes prêt', 'Du bist showbereit')))}</h1></div><p>${html(t(copy('Je kent de volledige route van locatie en receiver tot lichtrecept, scène en Studio. Je kunt elk hoofdstuk later opnieuw openen.', 'You know the full route from location and receiver to light recipe, scene and Studio. You can revisit any chapter later.', 'Vous connaissez tout le parcours du lieu et du receiver jusqu’à la recette, la scène et Studio. Vous pouvez revoir chaque chapitre.', 'Du kennst den ganzen Weg von Standort und Receiver bis Lichtrezept, Szene und Studio. Jedes Kapitel bleibt erneut verfügbar.')))}</p><div class="academy-v2-complete-actions"><button class="button soft" onclick="AluvisionAcademy.open()">${html(t(copy('Academy-overzicht', 'Academy overview', 'Aperçu Academy', 'Academy-Übersicht')))}</button><button class="button" onclick="closeModal();go('home')">${html(t(copy('Naar Home', 'Go to Home', 'Vers Accueil', 'Zu Home')))} →</button></div></div>`);
  }

  function reset() {
    record = blankRecord();
    session = { active: false, index: 0, practice: {}, feedback: null };
    localStorage.removeItem(STORAGE_KEY);
    openHub();
  }

  function helpPage() {
    const root = document.getElementById('help');
    if (!root) return;
    record = loadRecord();
    const next = steps[record.current] || steps[0];
    root.innerHTML = `<div class="ux-page-intro"><div><div class="eyebrow">ALUVISION ACADEMY</div><h1>${html(t(copy('Leer de app stap voor stap', 'Learn the app step by step', 'Apprenez l’app pas à pas', 'Lerne die App Schritt für Schritt')))}</h1><p class="sub">${html(t(copy('De echte pagina blijft zichtbaar. De veilige oefenkaart toont precies wat je moet doen.', 'The real page stays visible. A safe practice card shows exactly what to do.', 'La vraie page reste visible. Une carte sûre montre exactement quoi faire.', 'Die echte Seite bleibt sichtbar. Eine sichere Übungskarte zeigt genau, was zu tun ist.')))}</p></div><button class="button" onclick="openAcademy()">${record.finished ? html(t(copy('Hoofdstuk kiezen', 'Choose chapter', 'Choisir un chapitre', 'Kapitel wählen'))) : visitedCount() ? html(t(copy('Verder leren', 'Continue learning', 'Continuer', 'Weiterlernen'))) : html(t(copy('Opleiding starten', 'Start training', 'Démarrer la formation', 'Training starten')))} →</button></div><div class="academy-v2-primary" style="margin-top:18px"><i>${record.finished ? '✓' : next.icon}</i><span><b>${record.finished ? html(t(copy('Opleiding voltooid', 'Training complete', 'Formation terminée', 'Training abgeschlossen'))) : html(t(copy('Volgende', 'Next', 'Suivant', 'Nächste'))) + ': ' + html(t(next.title))}</b><small>${visitedCount()} / ${steps.length} ${html(t(copy('stappen bezocht', 'steps visited', 'étapes visitées', 'Schritte besucht')))} · ${percentage()}%</small></span><div class="academy-v2-primary-actions"><button class="button soft" onclick="AluvisionAcademy.start(${record.current})">${html(t(copy('Openen', 'Open', 'Ouvrir', 'Öffnen')))}</button></div></div><div class="academy-v2-section-head" style="margin-top:20px"><span><h2>${html(t(copy('In zes korte hoofdstukken', 'Six short chapters', 'Six chapitres courts', 'Sechs kurze Kapitel')))}</h2><p>${html(t(copy('Van eerste zone tot eigen show.', 'From first zone to your own show.', 'De la première zone à votre show.', 'Von der ersten Zone zur eigenen Show.')))}</p></span></div><section class="academy-v2-chapters" style="margin-top:10px">${chapters.map((chapter) => `<button class="academy-v2-chapter" onclick="AluvisionAcademy.startChapter('${chapter.id}')"><i>${chapter.icon}</i><span><b>${html(t(chapter.title))}</b><small>${html(t(chapter.detail))}</small></span></button>`).join('')}</section>`;
  }

  function enhanceHome() {
    if (typeof original.home === 'function') original.home.apply(this, arguments);
    const banner = document.querySelector('#home .academy-home-banner');
    if (!banner) return;
    const button = banner.querySelector('button');
    if (button) {
      button.setAttribute('onclick', 'openAcademy()');
      button.textContent = t(visitedCount() ? copy('Academy hervatten', 'Resume Academy', 'Reprendre Academy', 'Academy fortsetzen') : copy('Academy starten', 'Start Academy', 'Démarrer Academy', 'Academy starten')) + ' →';
    }
    const bar = banner.querySelector('.academy-progress-line i');
    if (bar) bar.style.width = `${percentage()}%`;
  }

  window.AluvisionAcademy = {
    version: VERSION,
    open: openHub,
    start,
    startChapter,
    stop,
    next,
    previous,
    skip,
    reset,
    answer,
    sequence,
    pixel,
    side,
    layout,
    effect,
    setting,
    colour,
    sceneToggle,
    sceneSave,
    getState: () => ({ active: session.active, index: session.index, step: steps[session.index]?.id, record: loadRecord() }),
    topics: steps.map((step) => step.id)
  };

  window.openAcademy = openHub;
  window.tourHub = openHub;
  window.tour = () => start(0);
  window.requestRealGuide = () => start(record.current);
  window.startRealGuide = () => start(record.current);
  window.realGuideNext = next;
  window.realGuidePrevious = previous;
  window.stopRealGuide = () => stop();
  window.studioTour = () => startChapter('ready');
  window.startAcademyCourse = (id, index) => {
    const chapterMap = { master: 'start', foundation: 'structure', receivers: 'receiver', live: 'light', scenes: 'save', studio: 'ready', troubleshoot: 'ready' };
    if (Number.isInteger(index)) return start(index);
    return startChapter(chapterMap[id] || 'start');
  };
  window.help = helpPage;
  if (typeof original.home === 'function') window.home = enhanceHome;

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && session.active) stop();
  });

  // Repaint once so a page that was already visible receives the new Academy.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => window.render?.(), { once: true });
  else requestAnimationFrame(() => window.render?.());
})();
