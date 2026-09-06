/* Aluvision V20 final UI safeguards.
 *
 * Kept separate from the installation-recovery layer so these presentation and
 * migration fixes can be regression-tested in isolation.
 */
(() => {
  'use strict';

  if (window.__aluvisionV20UiFixes) return;
  window.__aluvisionV20UiFixes = true;

  const uiTest = new URLSearchParams(location.search).has('uiTest');
  let migrationDirty = false;

  const list = (value) => Array.isArray(value) ? value : [];
  const values = (value) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.values(value)
    : [];

  function allGroups() {
    return list(db?.installations).flatMap((installation) =>
      list(installation?.zones).flatMap((currentZone) => list(currentZone?.groups))
    );
  }

  function allPersistedEffectStates() {
    const states = [];
    const seen = new Set();
    const addState = (current) => {
      if (!current || typeof current !== 'object' || seen.has(current)) return;
      seen.add(current);
      states.push(current);
    };
    const addGroup = (currentGroup) => {
      if (!currentGroup || typeof currentGroup !== 'object') return;
      addState(currentGroup.state);
      values(currentGroup.parallelLineStates).forEach(addState);
      addState(currentGroup.powerRestore?.state);
      values(currentGroup.powerRestore?.parallelLineStates).forEach(addState);
    };

    allGroups().forEach(addGroup);
    list(db?.installations).forEach((installation) => {
      list(installation?.scenes).forEach((scene) => {
        list(scene?.zones).forEach((currentZone) => list(currentZone?.groups).forEach(addGroup));
      });
    });
    list(db?.presets).forEach((preset) => {
      addState(preset?.state);
      list(preset?.parallel?.statesByOrder).forEach(addState);
    });
    return states;
  }

  function ensureReceiverNumbers() {
    const devices = Array.isArray(db?.devices) ? db.devices : [];
    const used = new Set();
    const pending = [];
    let changed = false;

    devices.forEach((device) => {
      if (!device || typeof device !== 'object') return;
      const number = Number(device?.number);
      if (Number.isSafeInteger(number) && number > 0 && !used.has(number)) {
        used.add(number);
        if (device.number !== number) {
          device.number = number;
          changed = true;
        }
      } else {
        pending.push(device);
      }
    });

    let next = 1;
    pending.forEach((device) => {
      while (used.has(next)) next += 1;
      if (device.number !== next) {
        device.number = next;
        changed = true;
      }
      used.add(next);
      next += 1;
    });

    if (changed) migrationDirty = true;
    return changed;
  }

  function migrateTunnelWave() {
    const effectList = list(effects);
    const replacement = effectList.find((effect) => effect?.[0] === 'Panel Wave');
    if (!replacement) return false;
    const resolvedVariant = typeof effectWireVariant === 'function'
      ? Number(effectWireVariant(replacement))
      : Number(replacement[3]);
    const replacementVariant = Number.isFinite(resolvedVariant)
      ? resolvedVariant
      : Math.max(0, effectList.indexOf(replacement));
    let changed = false;

    allPersistedEffectStates().forEach((current) => {
      const obsoleteName = current.animation === 'Tunnel Wave';
      const obsoleteEngine = current.engine === 'LINE_WAVE';
      if (!obsoleteName && !obsoleteEngine) return;

      current.animation = replacement[0];
      current.engine = replacement[1];
      current.variant = replacementVariant;
      changed = true;
    });

    if (changed) migrationDirty = true;
    return changed;
  }

  function isLegacyWarmContourDefault(current) {
    if (!current || Number(current.variant) !== 120 || current.animation !== 'Warm Contour Flow') return false;
    const colors = list(current.colors).map((value) => String(value || '').toLowerCase());
    const whites = list(current.whiteChannels).map((value) => Number(value) || 0);
    const rgb = list(current.rgbEnabled).map(Boolean);
    const white = list(current.whiteEnabled).map(Boolean);
    if (Number(current.speed) !== 45 || Number(current.widthPixels) !== 4 || Number(current.smooth) !== 100 ||
        Number(current.trailLength) !== 28 || current.direction !== 'right' || Number(current.objectCount) !== 1 ||
        Number(current.spacing) !== 100 || current.bounce !== false || current.mirror !== false ||
        current.backgroundOn !== false || Number(current.colorCount) !== 2) return false;
    if (colors[0] !== '#000000' || colors[1] !== '#ff7a14' || whites[0] !== 255 || whites[1] !== 0 ||
        rgb[0] !== false || rgb[1] !== true || white[0] !== true || white[1] !== false) return false;
    // Normalisation may append disabled channel slots. They are still the old
    // untouched default only when none of those extra slots can emit light.
    for (let index = 2; index < Math.max(colors.length, whites.length, rgb.length, white.length); index += 1) {
      const hasRgb = rgb[index] !== false && !['', '#000000'].includes(colors[index] || '#000000');
      const hasWhite = white[index] !== false && (whites[index] || 0) > 0;
      if (hasRgb || hasWhite) return false;
    }
    return true;
  }

  function applyWarmContourDefault(current) {
    current.widthPixels = 4;
    current.trailLength = 36;
    current.colorCount = 1;
    current.colors = ['#5a1e00'];
    current.whiteChannels = [255, 0, 0, 0];
    current.rgbEnabled = [true, false, false, false];
    current.whiteEnabled = [true, false, false, false];
    current.whiteOnly = false;
  }

  function migrateWarmContourDefaults() {
    let changed = false;
    const migrateState = (current) => {
      if (!isLegacyWarmContourDefault(current)) return false;
      applyWarmContourDefault(current);
      changed = true;
      return true;
    };
    const migrateStoredGroup = (currentGroup, shouldSync) => {
      if (!currentGroup || typeof currentGroup !== 'object') return;
      let activeChanged = migrateState(currentGroup.state);
      values(currentGroup.parallelLineStates).forEach((current) => { activeChanged = migrateState(current) || activeChanged; });
      migrateState(currentGroup.powerRestore?.state);
      values(currentGroup.powerRestore?.parallelLineStates).forEach(migrateState);
      if (activeChanged && shouldSync && list(currentGroup.receivers).length) {
        currentGroup.warmContourV120SyncPending = true;
        changed = true;
      }
    };

    allGroups().forEach((currentGroup) => migrateStoredGroup(currentGroup, true));
    list(db?.installations).forEach((installation) => {
      list(installation?.scenes).forEach((scene) => {
        list(scene?.zones).forEach((currentZone) => list(currentZone?.groups).forEach((currentGroup) => migrateStoredGroup(currentGroup, false)));
      });
    });
    list(db?.presets).forEach((preset) => {
      migrateState(preset?.state);
      list(preset?.parallel?.statesByOrder).forEach(migrateState);
    });
    if (changed) migrationDirty = true;
    return changed;
  }

  let warmContourSyncTimer = 0;
  let warmContourSyncInFlight = false;
  let warmContourSyncDelay = 1200;

  function receiverLooksReachable(device) {
    if (!device) return false;
    try {
      if (typeof receiverReachable === 'function') return receiverReachable(device);
    } catch (_) {}
    return device.online === true || device.gateway === true || device.reachableViaGateway === true;
  }

  function scheduleWarmContourSync(delay = 180) {
    if (warmContourSyncTimer || warmContourSyncInFlight) return;
    warmContourSyncTimer = setTimeout(() => {
      warmContourSyncTimer = 0;
      flushWarmContourSync();
    }, Math.max(0, Number(delay) || 0));
  }

  async function flushWarmContourSync() {
    if (warmContourSyncInFlight || typeof live !== 'function') return false;
    const activeInstallation = install || list(db?.installations).find((item) => item?.id === db?.activeInstallationId);
    const pending = list(activeInstallation?.zones)
      .flatMap((currentZone) => list(currentZone?.groups))
      .filter((currentGroup) => currentGroup?.warmContourV120SyncPending === true);
    if (!pending.length) return true;
    const candidate = pending.find((currentGroup) => list(currentGroup.receivers).some((line) =>
      receiverLooksReachable(list(db?.devices).find((device) => device?.id === line?.deviceId))
    ));
    if (!candidate) return false;

    warmContourSyncInFlight = true;
    let delivered = false;
    try {
      const response = await live(candidate, true);
      const results = list(response?.results);
      delivered = results.length > 0 && results.every((result) => result?.accepted === true || result?.online === true);
      if (delivered) {
        delete candidate.warmContourV120SyncPending;
        migrationDirty = true;
        persistMigrations();
        warmContourSyncDelay = 1200;
      }
    } catch (_) {
      delivered = false;
    } finally {
      warmContourSyncInFlight = false;
    }
    if (list(activeInstallation?.zones).flatMap((currentZone) => list(currentZone?.groups))
      .some((currentGroup) => currentGroup?.warmContourV120SyncPending === true)) {
      warmContourSyncDelay = delivered ? 1200 : Math.min(30000, warmContourSyncDelay * 2);
      scheduleWarmContourSync(warmContourSyncDelay);
    }
    return delivered;
  }

  function persistMigrations() {
    if (!migrationDirty || uiTest || typeof save !== 'function') return;
    try {
      save();
      migrationDirty = false;
    } catch (_) {
      // Keep the in-memory repair and retry persistence on the next render.
    }
  }

  function runMigrations() {
    ensureReceiverNumbers();
    migrateTunnelWave();
    migrateWarmContourDefaults();
    persistMigrations();
    scheduleWarmContourSync();
  }

  function text(nl, en, fr, de) {
    const language = (document.documentElement.lang || 'nl').slice(0, 2);
    return ({ nl, en, fr, de })[language] || nl;
  }

  function groupSettingsTranslations() {
    return new Map([
      ['Beweging en vorm', text('Beweging en vorm', 'Motion and shape', 'Mouvement et forme', 'Bewegung und Form')],
      ['Snelheid, dikte, vloeiendheid en richting', text('Snelheid, dikte, vloeiendheid en richting', 'Speed, width, smoothness and direction', 'Vitesse, largeur, fluidité et direction', 'Geschwindigkeit, Breite, Weichheit und Richtung')],
      ['Animatiesnelheid', text('Animatiesnelheid', 'Animation speed', 'Vitesse de l’animation', 'Animationsgeschwindigkeit')],
      ['Van uiterst trage sfeerbeweging tot een snel dynamisch effect.', text('Van uiterst trage sfeerbeweging tot een snel dynamisch effect.', 'From an extremely slow ambient movement to a fast dynamic effect.', 'D’un mouvement d’ambiance très lent à un effet dynamique rapide.', 'Von sehr langsamer Bewegung bis zu einem schnellen dynamischen Effekt.')],
      ['Snelheid', text('Snelheid', 'Speed', 'Vitesse', 'Geschwindigkeit')],
      ['Uiterst traag', text('Uiterst traag', 'Extremely slow', 'Très lent', 'Sehr langsam')],
      ['Snel', text('Snel', 'Fast', 'Rapide', 'Schnell')],
      ['Live berekend tot 90 FPS', text('Live berekend tot 90 FPS', 'Calculated live at up to 90 FPS', 'Calculé en direct jusqu’à 90 FPS', 'Live mit bis zu 90 FPS berechnet')],
      ['Animatiedikte', text('Animatiedikte', 'Effect width', 'Largeur de l’effet', 'Effektbreite')],
      ['Exacte effectbreedte in echte pixels', text('Exacte effectbreedte in echte pixels', 'Exact effect width in real pixels', 'Largeur exacte en pixels réels', 'Exakte Effektbreite in echten Pixeln')],
      ['Breedte', text('Breedte', 'Width', 'Largeur', 'Breite')],
      ['1 pixel breed', text('1 pixel breed', '1 pixel wide', '1 pixel de large', '1 Pixel breit')],
      ['Bij vloeiende beweging nemen twee grenspixels samen één pixel over', text('Bij vloeiende beweging nemen twee grenspixels samen één pixel over', 'With smooth motion, two edge pixels share the hand-off', 'En mouvement fluide, deux pixels de bord partagent la transition', 'Bei weicher Bewegung teilen sich zwei Randpixel den Übergang')],
      ['Trail of achtergrond kan extra licht tonen', text('Trail of achtergrond kan extra licht tonen', 'Trail or background may add extra light', 'La traîne ou le fond peut ajouter de la lumière', 'Schweif oder Hintergrund können zusätzliches Licht zeigen')],
      ['Lichtniveau', text('Lichtniveau', 'Light levels', 'Niveaux de lumière', 'Lichtniveau')],
      ['Effect en achtergrond afzonderlijk afstellen', text('Effect en achtergrond afzonderlijk afstellen', 'Adjust effect and background separately', 'Réglez séparément l’effet et le fond', 'Effekt und Hintergrund getrennt einstellen')],
      ['Animatiehelderheid', text('Animatiehelderheid', 'Animation brightness', 'Luminosité de l’animation', 'Animationshelligkeit')],
      ['Bepaalt hoeveel licht de bewegende animatie geeft.', text('Bepaalt hoeveel licht de bewegende animatie geeft.', 'Sets how much light the moving animation produces.', 'Règle la luminosité de l’animation en mouvement.', 'Legt die Helligkeit der bewegten Animation fest.')],
      ['Animatie uit', text('Animatie uit', 'Animation off', 'Animation éteinte', 'Animation aus')],
      ['Volle helderheid', text('Volle helderheid', 'Full brightness', 'Luminosité maximale', 'Volle Helligkeit')],
      ['Krachtig effectlicht', text('Krachtig effectlicht', 'Strong effect light', 'Effet lumineux puissant', 'Kräftiges Effektlicht')],
      ['Achtergrondhelderheid', text('Achtergrondhelderheid', 'Background brightness', 'Luminosité du fond', 'Hintergrundhelligkeit')],
      ['Regelt alleen het licht achter of buiten de animatie.', text('Regelt alleen het licht achter of buiten de animatie.', 'Adjusts only the light behind or outside the animation.', 'Règle uniquement la lumière derrière ou hors de l’animation.', 'Regelt nur das Licht hinter oder außerhalb der Animation.')],
      ['Volle achtergrond', text('Volle achtergrond', 'Full background', 'Fond maximal', 'Voller Hintergrund')],
      ['Subtiele achtergrond', text('Subtiele achtergrond', 'Subtle background', 'Fond subtil', 'Dezenter Hintergrund')],
      ['Extra instellingen voor deze animatie', text('Extra instellingen voor deze animatie', 'Additional settings for this animation', 'Réglages supplémentaires de cette animation', 'Weitere Einstellungen für diese Animation')],
      ['Een gerichte lichtpuls reist vloeiend over de LED Line', text('Een gerichte lichtpuls reist vloeiend over de LED Line', 'A focused light pulse travels smoothly along the LED Line', 'Une impulsion lumineuse ciblée parcourt la LED Line', 'Ein gezielter Lichtimpuls läuft weich über die LED Line')],
      ['Dikte', text('Dikte', 'Width', 'Largeur', 'Breite')],
      ['Richting', text('Richting', 'Direction', 'Direction', 'Richtung')],
      ['Afstand', text('Afstand', 'Spacing', 'Espacement', 'Abstand')],
      ['Aantal', text('Aantal', 'Count', 'Nombre', 'Anzahl')],
      ['Spiegel', text('Spiegel', 'Mirror', 'Miroir', 'Spiegeln')],
      ['Spiegeling', text('Spiegeling', 'Mirroring', 'Effet miroir', 'Spiegelung')],
      ['Aan', text('Aan', 'On', 'Activé', 'An')],
      ['Uit', text('Uit', 'Off', 'Désactivé', 'Aus')]
    ]);
  }

  function translateDynamicSettingText(value) {
    let match;
    if ((match = value.match(/^(\d+) · (\d+(?:[.,]\d+)?) sec per cyclus$/i))) {
      return `${match[1]} · ${match[2]} ${text('sec per cyclus', 'sec per cycle', 's par cycle', 'Sek. pro Zyklus')}`;
    }
    if ((match = value.match(/^(\d+(?:[.,]\d+)?) sec per cyclus$/i))) {
      return `${match[1]} ${text('sec per cyclus', 'sec per cycle', 's par cycle', 'Sek. pro Zyklus')}`;
    }
    if ((match = value.match(/^(\d+) px effectbreedte$/i))) {
      return `${match[1]} px ${text('effectbreedte', 'effect width', 'de largeur', 'Effektbreite')}`;
    }
    if ((match = value.match(/^Volledige groep · (\d+) pixels$/i))) {
      return `${text('Volledige groep', 'Complete group', 'Groupe complet', 'Gesamte Gruppe')} · ${match[1]} pixels`;
    }
    if ((match = value.match(/^(\d+)% van de groep$/i))) {
      return `${match[1]}% ${text('van de groep', 'of the group', 'du groupe', 'der Gruppe')}`;
    }
    if ((match = value.match(/^Alleen instellingen die voor (.+) echt zichtbaar verschil maken worden getoond\.$/i))) {
      return text(
        value,
        `Only settings that make a visible difference for ${match[1]} are shown.`,
        `Seuls les réglages qui font une différence visible pour ${match[1]} sont affichés.`,
        `Nur Einstellungen, die bei ${match[1]} einen sichtbaren Unterschied machen, werden angezeigt.`
      );
    }
    return null;
  }

  function localiseGroupSettingsNode(settings) {
    if (!settings) return;
    const headingDescription = settings.querySelector(':scope > .row p.sub');
    if (headingDescription && typeof effectDescription === 'function') {
      const translated = effectDescription();
      if (translated && headingDescription.textContent !== translated) headingDescription.textContent = translated;
    }

    if ((document.documentElement.lang || 'nl').slice(0, 2) === 'nl') return;
    const translations = groupSettingsTranslations();
    const walker = document.createTreeWalker(settings, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const original = node.nodeValue || '';
      const trimmed = original.trim();
      if (!trimmed) return;
      const translated = translations.get(trimmed) || translateDynamicSettingText(trimmed);
      if (!translated) return;
      node.nodeValue = original.replace(trimmed, translated);
    });
  }

  function localiseGroupSettings(markup) {
    if (typeof markup !== 'string' || !markup.includes('v1814-group-settings')) return markup;
    const template = document.createElement('template');
    template.innerHTML = markup;
    const settings = template.content.querySelector('#v1814-group-settings');
    if (!settings) return markup;
    localiseGroupSettingsNode(settings);
    return template.innerHTML;
  }

  function localiseMountedGroupSettings() {
    document.querySelectorAll('#v1814-group-settings').forEach(localiseGroupSettingsNode);
  }

  function commonUiTranslations() {
    return new Map([
      ['SCÈNES · ZELF SAMENSTELLEN', text('SCÈNES · ZELF SAMENSTELLEN', 'SCENES · BUILD YOUR OWN', 'SCÈNES · COMPOSEZ-LES', 'SZENEN · SELBST ZUSAMMENSTELLEN')],
      ['Scènes', text('Scènes', 'Scenes', 'Scènes', 'Szenen')],
      ['＋ Nieuwe scène samenstellen', text('＋ Nieuwe scène samenstellen', '＋ Create new scene', '＋ Créer une scène', '＋ Neue Szene erstellen')],
      ['Nog geen scènes', text('Nog geen scènes', 'No scenes yet', 'Aucune scène', 'Noch keine Szenen')],
      ['Maak je verlichting klaar bij Zones en kies daarna exact welke groepen je wilt bewaren.', text('Maak je verlichting klaar bij Zones en kies daarna exact welke groepen je wilt bewaren.', 'Set up your lighting in Zones, then choose exactly which groups to save.', 'Réglez l’éclairage dans Zones, puis choisissez précisément les groupes à enregistrer.', 'Richte das Licht unter Zonen ein und wähle dann genau die Gruppen zum Speichern.')],
      ['Alle presets', text('Alle presets', 'All presets', 'Tous les presets', 'Alle Presets')],
      ['Eén tik past een recept toe op de momenteel gekozen groep.', text('Eén tik past een recept toe op de momenteel gekozen groep.', 'One tap applies a light recipe to the currently selected group.', 'Un geste applique une recette au groupe sélectionné.', 'Ein Tipp wendet ein Lichtrezept auf die gewählte Gruppe an.')],
      ['Nog geen presets', text('Nog geen presets', 'No presets yet', 'Aucun preset', 'Noch keine Presets')],
      ['Open een groep en bewaar kleur, animatie en parameters als preset.', text('Open een groep en bewaar kleur, animatie en parameters als preset.', 'Open a group and save its colour, animation and settings as a preset.', 'Ouvrez un groupe et enregistrez sa couleur, son animation et ses réglages.', 'Öffne eine Gruppe und speichere Farbe, Animation und Einstellungen als Preset.')],
      ['Merkkleuren', text('Merkkleuren', 'Brand colours', 'Couleurs de marque', 'Markenfarben')],
      ['＋ Kleur', text('＋ Kleur', '＋ Colour', '＋ Couleur', '＋ Farbe')],
      ['Recent gebruikt', text('Recent gebruikt', 'Recently used', 'Utilisés récemment', 'Zuletzt verwendet')],
      ['Nog geen animaties gekozen.', text('Nog geen animaties gekozen.', 'No animations selected yet.', 'Aucune animation sélectionnée.', 'Noch keine Animation ausgewählt.')],
      ['← Scènes', text('← Scènes', '← Scenes', '← Scènes', '← Szenen')],
      ['NIEUWE SCÈNE SAMENSTELLEN', text('NIEUWE SCÈNE SAMENSTELLEN', 'CREATE A NEW SCENE', 'CRÉER UNE NOUVELLE SCÈNE', 'NEUE SZENE ERSTELLEN')],
      ['Kies wat je wilt bewaren', text('Kies wat je wilt bewaren', 'Choose what to save', 'Choisissez les éléments à enregistrer', 'Wähle, was gespeichert wird')],
      ['Stel eerst bij Zones iedere groep volledig in. Kies hier daarna exact welke zones en groepen samen deze scène vormen.', text('Stel eerst bij Zones iedere groep volledig in. Kies hier daarna exact welke zones en groepen samen deze scène vormen.', 'First configure every group in Zones. Then choose exactly which zones and groups make up this scene.', 'Configurez d’abord chaque groupe dans Zones, puis choisissez ceux qui composent cette scène.', 'Richte zuerst jede Gruppe unter Zonen ein und wähle dann genau die Gruppen dieser Szene.')],
      ['Naam van de scène', text('Naam van de scène', 'Scene name', 'Nom de la scène', 'Name der Szene')],
      ['Kies zones', text('Kies zones', 'Choose zones', 'Choisir les zones', 'Zonen wählen')],
      ['Tik op een zone om alle groepen daarin te kiezen.', text('Tik op een zone om alle groepen daarin te kiezen.', 'Tap a zone to select all its groups.', 'Touchez une zone pour sélectionner tous ses groupes.', 'Tippe auf eine Zone, um alle Gruppen auszuwählen.')],
      ['KIES ZONE', text('KIES ZONE', 'SELECT ZONE', 'SÉLECTIONNER LA ZONE', 'ZONE WÄHLEN')],
      ['Kies groepen', text('Kies groepen', 'Choose groups', 'Choisir les groupes', 'Gruppen wählen')],
      ['Vink binnen een zone alleen de groepen aan die in deze scène horen.', text('Vink binnen een zone alleen de groepen aan die in deze scène horen.', 'Select only the groups that belong in this scene.', 'Sélectionnez uniquement les groupes à inclure dans cette scène.', 'Wähle nur die Gruppen aus, die zu dieser Szene gehören.')],
      ['Niet-aangevinkte groepen veranderen niet wanneer je deze scène later activeert.', text('Niet-aangevinkte groepen veranderen niet wanneer je deze scène later activeert.', 'Unselected groups do not change when this scene is activated.', 'Les groupes non sélectionnés ne changent pas à l’activation de la scène.', 'Nicht ausgewählte Gruppen ändern sich beim Aktivieren der Szene nicht.')],
      ['Controleer wat wordt opgeslagen', text('Controleer wat wordt opgeslagen', 'Review what will be saved', 'Vérifiez ce qui sera enregistré', 'Prüfe, was gespeichert wird')],
      ['Dit zijn de huidige instellingen uit de Zone-tab.', text('Dit zijn de huidige instellingen uit de Zone-tab.', 'These are the current settings from Zones.', 'Voici les réglages actuels de Zones.', 'Dies sind die aktuellen Einstellungen aus Zonen.')],
      ['Annuleren', text('Annuleren', 'Cancel', 'Annuler', 'Abbrechen')],
      ['Scène opslaan', text('Scène opslaan', 'Save scene', 'Enregistrer la scène', 'Szene speichern')]
    ]);
  }

  function translateCommonDynamic(value) {
    let match;
    if (value.startsWith('Stel eerst bij Zones iedere groep volledig in.')) return text(
      value,
      'First configure every group in Zones. Then choose exactly which zones and groups make up this scene.',
      'Configurez d’abord chaque groupe dans Zones, puis choisissez ceux qui composent cette scène.',
      'Richte zuerst jede Gruppe unter Zonen ein und wähle dann genau die Gruppen dieser Szene.'
    );
    if ((match = value.match(/^＋ Preset van (.+)$/))) return text(value, `＋ Preset from ${match[1]}`, `＋ Preset de ${match[1]}`, `＋ Preset von ${match[1]}`);
    if ((match = value.match(/^(\d+) OPGESLAGEN$/))) return `${match[1]} ${text('OPGESLAGEN', 'SAVED', 'ENREGISTRÉS', 'GESPEICHERT')}`;
    if ((match = value.match(/^(\d+) van (\d+) groepen gekozen$/))) return text(value, `${match[1]} of ${match[2]} groups selected`, `${match[1]} groupe(s) sur ${match[2]} sélectionné(s)`, `${match[1]} von ${match[2]} Gruppen gewählt`);
    if ((match = value.match(/^(\d+) zone · (\d+) groep gekozen$/))) return text(value, `${match[1]} zone · ${match[2]} group selected`, `${match[1]} zone · ${match[2]} groupe sélectionné`, `${match[1]} Zone · ${match[2]} Gruppe gewählt`);
    if (/start links|achtergrond/i.test(value)) return value
      .replace(/start links/gi, text('start links', 'starts left', 'départ à gauche', 'Start links'))
      .replace(/achtergrond/gi, text('achtergrond', 'background', 'arrière-plan', 'Hintergrund'));
    return null;
  }

  function localiseCommonUi(root) {
    if (!root || (document.documentElement.lang || 'nl').slice(0, 2) === 'nl') return;
    const translations = commonUiTranslations();
    root.querySelectorAll?.('p.sub').forEach((paragraph) => {
      const value = paragraph.textContent.trim();
      if (!value.startsWith('Stel eerst bij Zones iedere groep volledig in.')) return;
      paragraph.textContent = translateCommonDynamic(value);
    });
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const original = node.nodeValue || '', trimmed = original.trim();
      if (!trimmed) return;
      const mapped = translations.get(trimmed);
      const translated = (mapped && mapped !== trimmed ? mapped : null) || translateCommonDynamic(trimmed);
      if (!translated) return;
      const next = original.replace(trimmed, translated);
      if (next !== original) node.nodeValue = next;
    });
  }

  function polishRgbwReceiverDialog() {
    const root = document.getElementById('modalBody');
    const heading = root?.querySelector('.rgbw-device-head h1');
    const portButton = root?.querySelector('[onclick^="toggleRgbwDevicePort("]');
    if (heading && portButton) {
      const match = portButton.getAttribute('onclick')?.match(/toggleRgbwDevicePort\('([^']+)'/);
      const device = match ? list(db?.devices).find((item) => item?.id === match[1]) : null;
      const label = device ? `Receiver ${device.number}` : '';
      if (label && heading.textContent !== label) heading.textContent = label;
    }
    root?.querySelectorAll('.rgbw-device-ports .scope').forEach((scope) => {
      [...scope.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).forEach((node) => {
        if (/LED LineS/i.test(node.nodeValue || '')) node.nodeValue = (node.nodeValue || '').replace(/LED LineS/gi, 'LED LINES');
      });
    });
  }

  function localiseMountedUi() {
    localiseMountedGroupSettings();
    ['scenes', 'lighting', 'modalBody'].forEach((id) => localiseCommonUi(document.getElementById(id)));
    polishRgbwReceiverDialog();
  }

  const baseGroupUI = window.groupUI;
  if (typeof baseGroupUI === 'function') {
    window.groupUI = groupUI = function v20FinalGroupUI(...args) {
      migrateTunnelWave();
      persistMigrations();
      return localiseGroupSettings(baseGroupUI.apply(this, args));
    };
  }

  const baseDevices = window.devices;
  if (typeof baseDevices === 'function') {
    window.devices = devices = function v20FinalDevices(...args) {
      ensureReceiverNumbers();
      persistMigrations();
      const result = baseDevices.apply(this, args);
      document.querySelectorAll('.customer-device-card[data-device-id]').forEach((card) => {
        const device = list(db?.devices).find((item) => item?.id === card.dataset.deviceId);
        const badge = card.querySelector('.receiver-number');
        if (badge && device) badge.textContent = String(device.number);
      });
      return result;
    };
  }

  /* A scene is a snapshot, not a permanent mode. As soon as the customer
   * changes any live lighting value the previous scene must no longer be
   * labelled as active. Centralising that rule in queueLive covers SPI, RGBW,
   * group, zone and whole-location controls without duplicating it in every
   * slider and colour picker. */
  function refreshVisibleSceneStatus() {
    document.querySelectorAll('.scene-card.active,.home-scene-card.active-selection').forEach((card) => {
      card.classList.remove('active', 'active-selection');
    });
    document.querySelectorAll('.scene-card,.home-scene-card,.ux-scene-simple').forEach((card) => {
      const scope = card.querySelector('.scope');
      if (!scope || !/ACTIEF|ACTIVE|ACTIF|AKTIV/i.test(scope.textContent || '')) return;
      scope.textContent = card.classList.contains('scene-card')
        ? 'SELECTIE'
        : (typeof ac === 'function' ? ac('SCÈNE', 'SCENE', 'SCÈNE', 'SZENE') : 'SCÈNE');
      const button = card.querySelector('button[onclick*="applySceneById"]');
      if (!button) return;
      button.classList.remove('soft');
      if (card.classList.contains('scene-card') || card.classList.contains('home-scene-card')) button.classList.add('green');
      button.textContent = card.classList.contains('scene-card')
        ? (typeof ac === 'function' ? ac('Scène activeren', 'Activate scene', 'Activer la scène', 'Szene aktivieren') : 'Scène activeren')
        : (typeof ac === 'function' ? ac('Scène starten', 'Start scene', 'Lancer la scène', 'Szene starten') : 'Scène starten');
    });
  }

  function invalidateActiveScene() {
    if (!install?.activeSceneId) return false;
    install.activeSceneId = null;
    try { if (typeof save === 'function') save('queued'); } catch (_) {}
    queueMicrotask(refreshVisibleSceneStatus);
    return true;
  }

  const baseQueueLive = window.queueLive;
  if (typeof baseQueueLive === 'function') {
    window.queueLive = queueLive = function v20QueueLiveWithoutStaleScene(...args) {
      invalidateActiveScene();
      return baseQueueLive.apply(this, args);
    };
  }

  /* Mobile Safari may apply scroll anchoring after the existing group-tab
   * safeguard has already restored the position. Restore once more after both
   * layout frames, so switching tabs never jumps up or down the long editor. */
  const baseSetGroupSection = window.setV1814GroupSection;
  if (typeof baseSetGroupSection === 'function') {
    const sectionScrollPositions = new Map();
    let firstRestoreFrame = 0;
    let finalRestoreFrame = 0;
    let continuousRestoreFrame = 0;
    let midRestoreTimer = 0;
    let lateRestoreTimer = 0;
    let anchoredSurface = null;
    let previousOverflowAnchor = '';
    const cancelPendingRestores = () => {
      if (firstRestoreFrame) cancelAnimationFrame(firstRestoreFrame);
      if (finalRestoreFrame) cancelAnimationFrame(finalRestoreFrame);
      if (continuousRestoreFrame) cancelAnimationFrame(continuousRestoreFrame);
      if (midRestoreTimer) clearTimeout(midRestoreTimer);
      if (lateRestoreTimer) clearTimeout(lateRestoreTimer);
      firstRestoreFrame = 0;
      finalRestoreFrame = 0;
      continuousRestoreFrame = 0;
      midRestoreTimer = 0;
      lateRestoreTimer = 0;
      if (anchoredSurface?.isConnected) anchoredSurface.style.overflowAnchor = previousOverflowAnchor;
      anchoredSurface = null;
      previousOverflowAnchor = '';
    };
    window.setV1814GroupSection = function v20StableGroupSection(section, ...args) {
      const surface = document.querySelector('.app');
      const top = Number(surface?.scrollTop) || 0;
      const shell = document.querySelector('#zones.page.on .v1814-group-shell');
      const groupKey = String(group?.id || shell?.querySelector('h1')?.textContent || 'group');
      const currentSection = String(shell?.dataset?.v1814Section || 'light');
      sectionScrollPositions.set(`${groupKey}:${currentSection}`, top);
      const rememberedTarget = sectionScrollPositions.get(`${groupKey}:${section}`);
      const restoreTop = Number.isFinite(rememberedTarget) ? rememberedTarget : top;
      cancelPendingRestores();
      const surfaceOwnsScroll = surface && getComputedStyle(surface).overflowY === 'auto';
      /* Disable anchoring before the panel is hidden/shown. Waiting until the
       * setter returns is too late: WebKit/Chromium may synchronously move the
       * scroll position while the shorter panel is being laid out. */
      if (surfaceOwnsScroll && typeof surface.scrollTo === 'function') {
        anchoredSurface = surface;
        previousOverflowAnchor = surface.style.overflowAnchor;
        surface.style.overflowAnchor = 'none';
      }
      const result = baseSetGroupSection.call(this, section, ...args);
      if (!surfaceOwnsScroll || typeof surface.scrollTo !== 'function') {
        cancelPendingRestores();
        return result;
      }
      const restore = () => {
        if (!surface.isConnected || document.querySelector('.app') !== surface) return;
        if (!surface.querySelector('#zones.page.on .customer-group-page')) return;
        surface.scrollTo({ top: restoreTop, left: 0, behavior: 'auto' });
      };
      restore();
      firstRestoreFrame = requestAnimationFrame(() => {
        firstRestoreFrame = 0;
        finalRestoreFrame = requestAnimationFrame(() => {
          finalRestoreFrame = 0;
          restore();
        });
      });
      /* Several enhancement layers finish on later animation frames. Keep the
       * tapped position stable throughout that brief layout window instead of
       * relying on one frame whose order varies across mobile browsers. */
      const restoreDeadline = performance.now() + 205;
      const keepPositionStable = () => {
        continuousRestoreFrame = 0;
        restore();
        if (performance.now() < restoreDeadline) {
          continuousRestoreFrame = requestAnimationFrame(keepPositionStable);
        }
      };
      continuousRestoreFrame = requestAnimationFrame(keepPositionStable);
      midRestoreTimer = setTimeout(() => {
        midRestoreTimer = 0;
        restore();
      }, 80);
      lateRestoreTimer = setTimeout(() => {
        lateRestoreTimer = 0;
        if (continuousRestoreFrame) cancelAnimationFrame(continuousRestoreFrame);
        continuousRestoreFrame = 0;
        restore();
        if (anchoredSurface === surface) {
          surface.style.overflowAnchor = previousOverflowAnchor;
          anchoredSurface = null;
          previousOverflowAnchor = '';
        }
      }, 220);
      return result;
    };
    window.addEventListener('pagehide', cancelPendingRestores);
  }

  let localisationQueued = false;
  function queueLocalisation() {
    if (localisationQueued) return;
    localisationQueued = true;
    requestAnimationFrame(() => {
      localisationQueued = false;
      localiseMountedUi();
    });
  }

  const baseRender = window.render;
  if (typeof baseRender === 'function') {
    window.render = render = function v20FinalRender(...args) {
      runMigrations();
      const result = baseRender.apply(this, args);
      localiseMountedUi();
      queueLocalisation();
      scheduleWarmContourSync();
      return result;
    };
  }

  // Dynamic dialogs are created after the normal page render. Localise them
  // in the same call so a fast tap never exposes the Dutch source copy for a
  // frame (and tests/users do not need to wait for the observer).
  const baseModal = window.modal;
  if (typeof baseModal === 'function') {
    window.modal = modal = function v20LocalisedModal(...args) {
      const result = baseModal.apply(this, args);
      localiseCommonUi(document.getElementById('modalBody'));
      polishRgbwReceiverDialog();
      return result;
    };
  }

  const observer = new MutationObserver((records) => {
    const selector = '#v1814-group-settings,#scenes,#lighting,#modalBody';
    const relevant = records.some((record) => {
      if (record.type === 'characterData') {
        return Boolean(record.target?.parentElement?.closest?.(selector));
      }
      if (record.target?.closest?.(selector)) return true;
      return [...record.addedNodes].some((node) =>
        node.nodeType === 1 && (node.matches?.(selector) || node.closest?.(selector) || node.querySelector?.(selector))
      );
    });
    if (relevant) queueLocalisation();
  });
  if (document.body) observer.observe(document.body, { childList: true, characterData: true, subtree: true });

  runMigrations();
  localiseMountedUi();
  window.addEventListener('online', () => scheduleWarmContourSync(80));
  window.addEventListener('focus', () => scheduleWarmContourSync(120));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) scheduleWarmContourSync(120);
  });
  window.AluvisionV20UiFixes = Object.freeze({
    ensureReceiverNumbers,
    migrateTunnelWave,
    migrateWarmContourDefaults,
    flushWarmContourSync,
    localiseGroupSettings,
    localiseCommonUi,
    runMigrations,
    invalidateActiveScene
  });
})();
