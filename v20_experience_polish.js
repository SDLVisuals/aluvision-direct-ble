/* Aluvision customer experience polish.
 *
 * This is deliberately an additive presentation layer. It does not own light
 * state, receiver transport, pairing or animation controls. It makes the
 * existing Home, Zones, Group and Receiver surfaces easier to scan for people
 * building a stand under time pressure, while the original handlers remain the
 * only source of behaviour.
 */
(() => {
  'use strict';

  if (window.__aluvisionV20ExperiencePolish) return;
  window.__aluvisionV20ExperiencePolish = true;

  const array = (value) => Array.isArray(value) ? value : [];
  const lang = () => {
    let value = '';
    try { value = String(db?.settings?.language || ''); } catch (_) {}
    value = value.slice(0, 2).toLowerCase() || String(document.documentElement.lang || 'nl').slice(0, 2).toLowerCase();
    return ['nl', 'en', 'fr', 'de'].includes(value) ? value : 'nl';
  };
  const tr = (nl, en, fr, de) => ({ nl, en, fr, de })[lang()] || nl;
  const setText = (node, value) => {
    if (node && node.textContent !== value) node.textContent = value;
  };
  const state = () => {
    try {
      return {
        database: typeof db === 'object' && db ? db : null,
        location: typeof install === 'object' && install ? install : null,
        zone: typeof zone === 'object' && zone ? zone : null,
        group: typeof group === 'object' && group ? group : null
      };
    } catch (_) {
      return { database: null, location: null, zone: null, group: null };
    }
  };

  function isReachable(device) {
    if (!device) return false;
    return device.online === true || device.online === 1 || device.online === '1' ||
      device.reachableViaGateway === true || device.espNowReachable === true ||
      String(device.reachability || '').toLowerCase() === 'online';
  }

  function deviceFor(line, database) {
    const id = String(line?.deviceId || '');
    const rid = String(line?.physicalRid || line?.rid || '').toUpperCase();
    return array(database?.devices).find((device) =>
      String(device?.id || '') === id || (rid && String(device?.rid || '').toUpperCase() === rid)
    ) || null;
  }

  function groupsIn(scope) {
    if (!scope) return [];
    if (Array.isArray(scope.groups)) return scope.groups;
    if (Array.isArray(scope.zones)) return scope.zones.flatMap((item) => array(item?.groups));
    return [];
  }

  function lightStats(scope, database) {
    const lines = groupsIn(scope).flatMap((item) => array(item?.receivers));
    const reachable = lines.filter((line) => isReachable(deviceFor(line, database))).length;
    return { total: lines.length, reachable };
  }

  function receiverStats(database) {
    const devices = array(database?.devices);
    return { total: devices.length, reachable: devices.filter(isReachable).length };
  }

  function statusCopy(stats, subject = 'lines') {
    const total = Number(stats?.total) || 0;
    const reachable = Math.max(0, Math.min(total, Number(stats?.reachable) || 0));
    if (!total) return {
      tone: 'setup',
      short: tr('Nog niet ingesteld', 'Not set up yet', 'Pas encore configuré', 'Noch nicht eingerichtet'),
      full: tr('Nog geen LED Line', 'No LED Line yet', 'Aucune LED Line', 'Noch keine LED Line')
    };
    if (reachable === total) return {
      tone: 'ready',
      short: `${reachable}/${total} ${tr('bereikbaar', 'reachable', 'joignables', 'erreichbar')}`,
      full: subject === 'receivers'
        ? `${reachable}/${total} ${tr('receivers bereikbaar', 'receivers reachable', 'récepteurs joignables', 'Receiver erreichbar')}`
        : `${reachable}/${total} LED Lines ${tr('bereikbaar', 'reachable', 'joignables', 'erreichbar')}`
    };
    if (reachable) return {
      tone: 'partial',
      short: `${reachable}/${total} ${tr('bereikbaar', 'reachable', 'joignables', 'erreichbar')}`,
      full: `${reachable} ${tr('van', 'of', 'sur', 'von')} ${total} ${tr('bereikbaar', 'reachable', 'joignables', 'erreichbar')}`
    };
    return {
      tone: 'offline',
      short: `0/${total} ${tr('bereikbaar', 'reachable', 'joignables', 'erreichbar')}`,
      full: tr('Niet bereikbaar', 'Not reachable', 'Non joignable', 'Nicht erreichbar')
    };
  }

  function setStatusNode(node, stats, subject = 'lines') {
    if (!node) return;
    const copy = statusCopy(stats, subject);
    node.classList.remove('ready', 'partial', 'offline', 'setup');
    node.classList.add(copy.tone);
    setText(node, `● ${copy.short}`);
    node.setAttribute('aria-label', copy.full);
    node.title = copy.full;
  }

  function parseCallId(node, functionName) {
    const action = node?.getAttribute?.('onclick') || '';
    const match = action.match(new RegExp(`${functionName}\\(['\"]([^'\"]+)['\"]\\)`));
    return match?.[1] || '';
  }

  function replaceButtonLabel(button, value) {
    if (!button) return;
    const textNode = [...button.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim());
    if (textNode) textNode.nodeValue = ` ${value}`;
    else if (!button.querySelector(':scope > span:not(.alv-button-icon),:scope > b,:scope > small')) button.append(` ${value}`);
  }

  function activeSurface() {
    const page = document.querySelector('.page.on');
    if (!page) return { page: null, kind: 'none' };
    if (page.id === 'zones' && page.querySelector('.customer-group-page,.rgbw-group-ui')) return { page, kind: 'group' };
    if (page.id === 'zones' && page.querySelector('.customer-zone-detail')) return { page, kind: 'zone' };
    return { page, kind: page.id };
  }

  function refineTop() {
    const { database, location, zone: selectedZone, group: selectedGroup } = state();
    const surface = activeSurface();
    if (!location || !surface.page) return;

    const strip = document.getElementById('activeLocationStrip');
    if (strip) {
      strip.classList.add('alv-experience-location');
      strip.dataset.context = surface.kind;
      const copy = strip.querySelector('.v1814-location-copy') || strip.querySelector(':scope > span:nth-child(2)');
      setText(copy?.querySelector('small'), tr('ACTIEVE LOCATIE', 'ACTIVE LOCATION', 'EMPLACEMENT ACTIF', 'AKTIVER STANDORT'));
      setText(copy?.querySelector('b'), location.name || tr('Locatie', 'Location', 'Emplacement', 'Standort'));
      const context = surface.kind === 'group' && selectedZone && selectedGroup
        ? `${selectedZone.name} · ${selectedGroup.name}`
        : surface.kind === 'zone' && selectedZone
          ? `${tr('Zone', 'Zone', 'Zone', 'Zone')}: ${selectedZone.name}`
          : surface.kind === 'devices'
            ? tr('Receivers beheren', 'Manage receivers', 'Gérer les récepteurs', 'Receiver verwalten')
            : surface.kind === 'home'
              ? tr('Alle verlichting', 'All lighting', 'Tout l’éclairage', 'Gesamte Beleuchtung')
              : `${array(location.zones).length} ${tr('zones', 'zones', 'zones', 'Zonen')}`;
      setText(copy?.querySelector('em'), context);
      strip.setAttribute('aria-label', `${tr('Actieve locatie', 'Active location', 'Emplacement actif', 'Aktiver Standort')}: ${location.name}. ${context}`);
    }

    const summary = receiverStats(database);
    const copy = statusCopy(summary, 'receivers');
    const badge = document.getElementById('status');
    if (badge && !badge.matches('[data-busy="true"]')) {
      badge.classList.add('alv-experience-health');
      badge.classList.remove('ready', 'partial', 'offline', 'setup');
      badge.classList.add(copy.tone);
      setText(badge, summary.total ? `● ${copy.short}` : tr('Klaar voor receiver', 'Ready for a receiver', 'Prêt pour un récepteur', 'Bereit für Receiver'));
      badge.title = copy.full;
      badge.setAttribute('aria-label', copy.full);
      badge.setAttribute('aria-live', 'polite');
    }
  }

  function refineNavigation() {
    const labels = [
      ["go('home')", tr('Home', 'Home', 'Accueil', 'Home')],
      ["go('zones')", tr('Zones', 'Zones', 'Zones', 'Zonen')],
      ["go('scenes')", tr('Scènes', 'Scenes', 'Scènes', 'Szenen')],
      ["go('lighting')", tr('Presets', 'Presets', 'Presets', 'Presets')],
      ["go('studio')", tr('Studio', 'Studio', 'Studio', 'Studio')],
      ["go('devices')", tr('Receivers', 'Receivers', 'Récepteurs', 'Receiver')],
      ["go('help')", tr('Academy', 'Academy', 'Academy', 'Academy')],
      ["go('settings')", tr('Instellingen', 'Settings', 'Réglages', 'Einstellungen')],
      ['openUtilityMenu()', tr('Meer', 'More', 'Plus', 'Mehr')]
    ];
    document.querySelectorAll('.nav > button').forEach((button) => {
      const action = button.getAttribute('onclick') || '';
      const item = labels.find(([needle]) => action.includes(needle));
      if (!item) return;
      replaceButtonLabel(button, item[1]);
      button.setAttribute('aria-label', item[1]);
      button.title = item[1];
      if (button.classList.contains('on')) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  }

  function refineHome(root) {
    const { database, location } = state();
    if (!root || !location) return;
    root.classList.add('alv-experience-home');
    const card = root.querySelector('.customer-all-location[data-ui="all-lighting"]');
    if (!card) return;
    card.classList.add('alv-experience-master');
    const stats = lightStats(location, database);
    const groups = groupsIn(location).length;
    card.setAttribute('aria-label', `${tr('Snelle bediening voor alle verlichting in', 'Quick control for all lighting in', 'Commande rapide pour tout l’éclairage de', 'Schnellsteuerung für die gesamte Beleuchtung in')} ${location.name}`);

    const note = card.querySelector('.alv-home-scope-note');
    if (note) {
      setText(note.querySelector('b'), `${stats.total} LED Lines ${tr('tegelijk', 'together', 'ensemble', 'gemeinsam')}`);
      setText(note.querySelector('small'), `${groups} ${tr('groepen in deze locatie', 'groups in this location', 'groupes dans cet emplacement', 'Gruppen an diesem Standort')}`);
      setText(note.querySelector('em'), tr('ALLES', 'ALL', 'TOUT', 'ALLES'));
    }

    const colour = card.querySelector('[data-v1814-home-action="colour"]');
    setText(colour?.querySelector('.v1814-home-action-copy b'), tr('Kleur', 'Colour', 'Couleur', 'Farbe'));
    setText(colour?.querySelector('.v1814-home-action-copy small'), tr('Voor alle verlichting', 'For all lighting', 'Pour tout l’éclairage', 'Für alle Beleuchtung'));
    colour?.setAttribute('aria-label', tr('Kleur voor alle verlichting kiezen', 'Choose a colour for all lighting', 'Choisir une couleur pour tout l’éclairage', 'Farbe für die gesamte Beleuchtung wählen'));
    const looks = card.querySelector('[data-v1814-home-action="looks"]');
    setText(looks?.querySelector('.v1814-home-action-copy b'), tr('Sfeer', 'Look', 'Ambiance', 'Stimmung'));
    setText(looks?.querySelector('.v1814-home-action-copy small'), tr('Kleur en beweging', 'Colour and motion', 'Couleur et mouvement', 'Farbe und Bewegung'));
    looks?.setAttribute('aria-label', tr('Sfeer voor alle verlichting kiezen', 'Choose a look for all lighting', 'Choisir une ambiance pour tout l’éclairage', 'Stimmung für die gesamte Beleuchtung wählen'));
    const power = card.querySelector('.v1816-power-toggle');
    setText(power?.querySelector('.v1816-power-copy small'), tr('Alle verlichting', 'All lighting', 'Tout l’éclairage', 'Gesamte Beleuchtung'));
  }

  function refineJourney(root, location) {
    const journey = root.querySelector('.alv-journey-guide');
    if (!journey) return;
    journey.classList.add('alv-experience-journey');
    const steps = journey.querySelectorAll(':scope > span');
    const labels = [
      [tr('LOCATIE', 'LOCATION', 'EMPLACEMENT', 'STANDORT'), location.name],
      [tr('KIES NU', 'CHOOSE NOW', 'CHOISISSEZ', 'JETZT WÄHLEN'), tr('Zone', 'Zone', 'Zone', 'Zone')],
      [tr('DAARNA', 'THEN', 'ENSUITE', 'DANACH'), tr('Groep', 'Group', 'Groupe', 'Gruppe')]
    ];
    steps.forEach((step, index) => {
      step.classList.toggle('is-next', index === 1);
      setText(step.querySelector('small'), labels[index]?.[0] || '');
      setText(step.querySelector('strong'), labels[index]?.[1] || '');
    });
    journey.setAttribute('aria-label', tr('Kies eerst een zone en daarna een groep', 'Choose a zone, then a group', 'Choisissez une zone puis un groupe', 'Wähle zuerst eine Zone und dann eine Gruppe'));
  }

  function refineZoneCards(root, database, location) {
    root.querySelectorAll('.customer-zone-explorer').forEach((card) => {
      const opener = card.querySelector('.customer-zone-explorer-main');
      const id = parseCallId(opener, 'openZone');
      const item = array(location?.zones).find((candidate) => String(candidate?.id) === id);
      if (!item) return;
      card.classList.add('alv-direct-card', 'alv-zone-card');
      const title = opener.querySelector('.customer-zone-explorer-head b')?.textContent.trim() || item.name;
      opener.setAttribute('aria-label', `${tr('Open zone', 'Open zone', 'Ouvrir la zone', 'Zone öffnen')} ${title}`);
      opener.setAttribute('aria-describedby', `alv-zone-status-${id}`);
      const status = opener.querySelector('.customer-light-status');
      if (status) status.id = `alv-zone-status-${id}`;
      setStatusNode(status, lightStats(item, database));
      const affordance = opener.querySelector('.customer-card-open');
      if (affordance) {
        affordance.setAttribute('aria-hidden', 'false');
        affordance.classList.add('alv-open-affordance');
        let label = affordance.querySelector(':scope > span');
        let arrow = affordance.querySelector(':scope > i');
        if (!label) {
          [...affordance.childNodes]
            .filter((node) => node.nodeType === Node.TEXT_NODE)
            .forEach((node) => node.remove());
          label = document.createElement('span');
          affordance.prepend(label);
        }
        if (!arrow) {
          arrow = document.createElement('i');
          affordance.append(arrow);
        }
        setText(label, tr('Open zone', 'Open zone', 'Ouvrir', 'Zone öffnen'));
        setText(arrow, '→');
        arrow.setAttribute('aria-hidden', 'true');
      }
    });
  }

  function refineGroupCards(root, database, selectedZone) {
    root.querySelectorAll('.customer-group-explorer[data-open-group]').forEach((card) => {
      const item = array(selectedZone?.groups).find((candidate) => String(candidate?.id) === String(card.dataset.openGroup));
      if (!item) return;
      card.classList.add('alv-direct-card', 'alv-group-card');
      const stats = lightStats({ groups: [item] }, database);
      setStatusNode(card.querySelector('.customer-light-status'), stats);
      card.setAttribute('aria-label', `${tr('Open groep', 'Open group', 'Ouvrir le groupe', 'Gruppe öffnen')} ${item.name}. ${statusCopy(stats).full}`);
      const action = [...card.querySelectorAll('.customer-group-explorer-actions > button')]
        .find((button) => (button.getAttribute('onclick') || '').includes(`openGroup('${item.id}')`));
      if (action) {
        action.classList.add('alv-open-group');
        setText(action, tr('Open bediening →', 'Open controls →', 'Ouvrir les commandes →', 'Steuerung öffnen →'));
        action.setAttribute('aria-label', `${tr('Bediening openen voor', 'Open controls for', 'Ouvrir les commandes pour', 'Steuerung öffnen für')} ${item.name}`);
      }
    });
  }

  function refineContextPath(root) {
    const path = root.querySelector('.customer-structure-route.alv-context-path');
    if (!path) return;
    path.classList.add('alv-experience-path');
    const current = path.querySelector('[aria-current="page"] b')?.textContent.trim();
    path.dataset.currentName = current || '';
    path.dataset.pathLabel = tr('JE BENT HIER', 'YOU ARE HERE', 'VOUS ÊTES ICI', 'DU BIST HIER');
    path.querySelectorAll('.alv-context-chip').forEach((chip) => {
      const label = chip.querySelector('small')?.textContent.trim();
      const title = chip.querySelector('b')?.textContent.trim();
      if (label && title) chip.setAttribute('aria-label', `${label}: ${title}`);
    });
  }

  function refineZones(root) {
    const { database, location, zone: selectedZone, group: selectedGroup } = state();
    if (!root || !location) return;
    root.classList.add('alv-experience-zones');
    refineJourney(root, location);
    refineZoneCards(root, database, location);
    refineGroupCards(root, database, selectedZone);
    refineContextPath(root);

    const detail = root.querySelector('.customer-zone-detail');
    if (detail && selectedZone) {
      detail.classList.add('alv-experience-zone-detail');
      setStatusNode(detail.querySelector('.customer-zone-detail-head .customer-light-status'), lightStats(selectedZone, database));
      const heading = detail.querySelector('.customer-zone-group-title h2');
      if (!root.dataset.v22View) setText(heading, `${tr('Kies een groep in', 'Choose a group in', 'Choisissez un groupe dans', 'Wähle eine Gruppe in')} ${selectedZone.name}`);
    }

    const groupPage = root.querySelector('.customer-group-page,.rgbw-group-ui');
    if (groupPage && selectedGroup) {
      groupPage.classList.add('alv-experience-group-page');
      const stats = lightStats({ groups: [selectedGroup] }, database);
      const headerStatus = groupPage.matches('.rgbw-group-ui')
        ? groupPage.querySelector('.rgbw-group-head .scope')
        : groupPage.querySelector(':scope > .row .scope');
      if (headerStatus) {
        const copy = statusCopy(stats);
        headerStatus.classList.remove('online', 'offline');
        headerStatus.classList.add(copy.tone);
        setText(headerStatus, copy.short);
        headerStatus.setAttribute('aria-label', copy.full);
      }
      groupPage.querySelectorAll('.v1814-group-nav [role="tab"]').forEach((button) => {
        const title = button.querySelector('b')?.textContent.trim();
        if (title) button.title = title;
      });
    }
  }

  function refineDevices(root) {
    const { database } = state();
    if (!root || !database) return;
    root.classList.add('alv-experience-devices');
    const totals = receiverStats(database);
    root.setAttribute('aria-label', tr('Receivers beheren', 'Manage receivers', 'Gérer les récepteurs', 'Receiver verwalten'));
    const filters = root.querySelector('.tabs');
    if (filters) {
      filters.classList.add('alv-receiver-filters');
      filters.setAttribute('role', 'tablist');
      filters.setAttribute('aria-label', tr('Receivers filteren', 'Filter receivers', 'Filtrer les récepteurs', 'Receiver filtern'));
      filters.querySelectorAll('button').forEach((button) => {
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', String(button.classList.contains('on')));
      });
    }

    root.querySelectorAll('.customer-device-card[data-device-id]').forEach((card) => {
      const device = array(database.devices).find((candidate) => String(candidate?.id) === String(card.dataset.deviceId));
      if (!device) return;
      card.classList.add('alv-receiver-card');
      const reachable = isReachable(device);
      const title = card.querySelector('.customer-device-title b')?.textContent.trim() || tr('Receiver', 'Receiver', 'Récepteur', 'Receiver');
      card.setAttribute('aria-label', `${title}. ${reachable ? tr('Bereikbaar', 'Reachable', 'Joignable', 'Erreichbar') : tr('Niet bereikbaar', 'Not reachable', 'Non joignable', 'Nicht erreichbar')}`);
      const pill = card.querySelector('.customer-device-head .pill');
      if (pill) {
        pill.classList.toggle('online', reachable);
        pill.classList.toggle('offline', !reachable);
        setText(pill, reachable ? `● ${tr('Bereikbaar', 'Reachable', 'Joignable', 'Erreichbar')}` : `○ ${tr('Niet bereikbaar', 'Not reachable', 'Non joignable', 'Nicht erreichbar')}`);
      }
      const visualStatus = card.querySelector('.v188-device-visual > div:last-child > span');
      setText(visualStatus, reachable ? tr('Bereikbaar', 'Reachable', 'Joignable', 'Erreichbar') : tr('Niet bereikbaar', 'Not reachable', 'Non joignable', 'Nicht erreichbar'));

      const actions = card.querySelector('.customer-device-actions');
      if (actions) {
        actions.setAttribute('aria-label', `${tr('Acties voor', 'Actions for', 'Actions pour', 'Aktionen für')} ${title}`);
        const settings = [...actions.querySelectorAll('button')].find((button) => (button.getAttribute('onclick') || '').includes('deviceDiag('));
        const identify = [...actions.querySelectorAll('button')].find((button) => /identify(?:Device|RgbwPort)?\(/.test(button.getAttribute('onclick') || ''));
        const remove = [...actions.querySelectorAll('button')].find((button) => /requestDeleteDevice\(/.test(button.getAttribute('onclick') || ''));
        setText(settings, tr('Instellen', 'Settings', 'Régler', 'Einstellen'));
        setText(identify, tr('Knipperen', 'Flash', 'Clignoter', 'Blinken'));
        identify?.setAttribute('aria-label', `${title} ${tr('laten knipperen', 'flash briefly', 'faire clignoter', 'kurz blinken lassen')}`);
        setText(remove, tr('Verwijderen', 'Remove', 'Supprimer', 'Entfernen'));
      }
    });

    const intro = root.querySelector(':scope > .ux-page-intro,:scope > .row');
    intro?.classList.add('alv-receiver-intro');
    const headline = root.querySelector('h1');
    headline?.setAttribute('aria-describedby', 'alv-receiver-summary');
    let summary = root.querySelector('#alv-receiver-summary');
    if (!summary && headline) {
      summary = document.createElement('span');
      summary.id = 'alv-receiver-summary';
      summary.className = 'alv-screen-reader-only';
      headline.after(summary);
    }
    setText(summary, statusCopy(totals, 'receivers').full);
  }

  function createManageSummary(selectedGroup, database) {
    const node = document.createElement('div');
    node.className = 'alv-manage-summary';
    const stats = lightStats({ groups: [selectedGroup] }, database);
    const layout = selectedGroup?.layout === 'parallel'
      ? tr('Aparte rijen', 'Separate rows', 'Rangées séparées', 'Getrennte Reihen')
      : tr('Eén geheel', 'One continuous line', 'Une ligne continue', 'Eine durchgehende Linie');
    const icon = window.AluvisionIcons?.markup?.('ledlines') || '≋';
    node.innerHTML = `<i aria-hidden="true">${icon}</i><span><b>${array(selectedGroup?.receivers).length} LED Lines</b><small>${layout}</small></span><em></em>`;
    const copy = statusCopy(stats);
    setText(node.querySelector('em'), copy.short);
    node.querySelector('em')?.classList.add(copy.tone);
    node.setAttribute('aria-label', `${array(selectedGroup?.receivers).length} LED Lines. ${layout}. ${copy.full}`);
    return node;
  }

  function refineManageModal(root) {
    const head = root.querySelector('.v187-manage-head');
    if (!head) return;
    const { database, group: selectedGroup } = state();
    if (!selectedGroup) return;
    root.classList.add('alv-experience-manage');
    const back = root.querySelector(':scope > button[onclick="closeModal()"]');
    setText(back, `← ${tr('Terug naar groep', 'Back to group', 'Retour au groupe', 'Zurück zur Gruppe')}`);
    back?.setAttribute('aria-label', tr('Terug naar de groep', 'Back to the group', 'Retour au groupe', 'Zurück zur Gruppe'));
    let summary = root.querySelector(':scope > .alv-manage-summary');
    if (!summary) {
      summary = createManageSummary(selectedGroup, database);
      head.after(summary);
    }
    const layoutHeading = root.querySelector('.v187-layout-section h2,.rgbw-layout-section h2');
    setText(layoutHeading, tr('Opstelling', 'Arrangement', 'Disposition', 'Anordnung'));
    const orderHeading = root.querySelector('.v187-receiver-order h2');
    setText(orderHeading, tr('Volgorde van LED Lines', 'Order of LED Lines', 'Ordre des LED Lines', 'Reihenfolge der LED Lines'));
    root.querySelectorAll('.v187-receiver-row').forEach((row, index) => {
      row.classList.add('alv-manage-line');
      const title = row.querySelector('.v187-receiver-copy b')?.textContent.trim() || `LED Line ${index + 1}`;
      const stateNode = row.querySelector('.v187-receiver-state');
      const reachable = stateNode?.classList.contains('on');
      row.setAttribute('aria-label', `${index + 1}. ${title}. ${reachable ? tr('Bereikbaar', 'Reachable', 'Joignable', 'Erreichbar') : tr('Niet bereikbaar', 'Not reachable', 'Non joignable', 'Nicht erreichbar')}`);
      stateNode?.setAttribute('aria-label', reachable ? tr('Bereikbaar', 'Reachable', 'Joignable', 'Erreichbar') : tr('Niet bereikbaar', 'Not reachable', 'Non joignable', 'Nicht erreichbar'));
      const settings = row.querySelector('.v187-settings-button');
      setText(settings, tr('Instellen', 'Settings', 'Régler', 'Einstellen'));
      const identify = row.querySelector('.v187-identify');
      identify?.setAttribute('aria-label', `${title} ${tr('laten knipperen', 'flash briefly', 'faire clignoter', 'kurz blinken lassen')}`);
    });
  }

  function refineGuidedSetup(root) {
    const flow = root.querySelector('[data-v1813="pairing-calibration"],.v20-commission,.nfc-pairing,.v187-calibration');
    if (!flow) return;
    root.classList.add('alv-experience-setup');
    flow.classList.add('alv-guided-setup');
    flow.setAttribute('aria-label', tr('Receiver stap voor stap instellen', 'Set up receiver step by step', 'Configurer le récepteur étape par étape', 'Receiver Schritt für Schritt einrichten'));
    root.querySelectorAll('.v1813-pair-actions,.v20-commission footer,.pair-actions').forEach((actions) => actions.classList.add('alv-setup-actions'));
  }

  function refineModal() {
    const modal = document.getElementById('modal');
    const root = document.getElementById('modalBody');
    if (!modal || modal.hidden || !root) return;
    if (root.querySelector('.academy-shell,.academy-hub,.academy-practice,.studio-shell,.studio-workspace')) return;
    refineManageModal(root);
    refineGuidedSetup(root);
  }

  /* WKWebView may retain the last composited Studio canvas or sticky toolbar
     for one or more frames after its page class is removed. Explicitly park
     the complete Studio surface before another page is painted, then restore
     it before Studio renders again. This is presentation-only; Studio state
     and its controls remain untouched. */
  function utilityMenuOpen() {
    return Boolean(!document.getElementById('modal')?.hidden
      && document.querySelector('#modalBody > .utility-menu'));
  }

  function setStudioSurfaceActive(active) {
    const studio = document.getElementById('studio');
    if (!studio) return;
    active = active && !utilityMenuOpen();
    if (active) {
      studio.hidden = false;
      studio.inert = false;
      studio.classList.remove('alv-route-dormant');
      studio.removeAttribute('aria-hidden');
      return;
    }
    studio.querySelectorAll('canvas').forEach((canvas) => {
      try { canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height); } catch (_) {}
    });
    // Clearing the DOM is intentional. The Studio renderer is state-driven
    // and rebuilds it on entry. Removing the hidden composited tree prevents
    // WKWebView from retaining a canvas or sticky toolbar over Settings.
    if (studio.childNodes.length) studio.replaceChildren();
    studio.classList.add('alv-route-dormant');
    studio.hidden = true;
    studio.inert = true;
    studio.setAttribute('aria-hidden', 'true');
  }

  /* render() refreshes every page, including hidden ones. Gate the final
     wrapped Studio renderer so a normal Home/Settings render can never build
     an off-screen canvas tree again after it has been parked. */
  const studioRenderBase = window.studio;
  if (typeof studioRenderBase === 'function') {
    window.studio = function alvRouteAwareStudio(...args) {
      const root = document.getElementById('studio');
      if (!root?.classList.contains('on') || utilityMenuOpen()) {
        setStudioSurfaceActive(false);
        return;
      }
      setStudioSurfaceActive(true);
      return studioRenderBase.apply(this, args);
    };
    try { studio = window.studio; } catch (_) {}
  }

  const routeBase = window.go;
  if (typeof routeBase === 'function') {
    window.go = function alvExperienceRoute(page, ...args) {
      const destination = String(page || '');
      setStudioSurfaceActive(destination === 'studio');
      const result = routeBase.call(this, page, ...args);
      // Teardown again after the legacy render chain. Keep the extra frame for
      // WebKit's compositor, but do not leave one frame in which Studio can be
      // visible or interactive on another page.
      setStudioSurfaceActive(destination === 'studio');
      requestAnimationFrame(() => setStudioSurfaceActive(destination === 'studio'));
      return result;
    };
  }

  // More is a modal, not a route: Studio remains .on underneath it. Park its
  // composited tree for this exact path too, and rebuild only if closing More
  // leaves Studio selected. The draft and chosen workspace stay untouched.
  const utilityOpenBase = window.openUtilityMenu;
  if (typeof utilityOpenBase === 'function') {
    window.openUtilityMenu = function alvExperienceUtility(...args) {
      const result = utilityOpenBase.apply(this, args);
      if (utilityMenuOpen()) setStudioSurfaceActive(false);
      return result;
    };
  }
  const utilityCloseBase = window.closeModal;
  if (typeof utilityCloseBase === 'function') {
    window.closeModal = function alvExperienceCloseUtility(...args) {
      const wasUtility = utilityMenuOpen();
      const result = utilityCloseBase.apply(this, args);
      if (wasUtility) schedule();
      return result;
    };
  }

  function apply() {
    document.documentElement.classList.add('alv-experience-ready');
    refineTop();
    refineNavigation();
    const active = document.querySelector('.page.on');
    if (active?.id === 'home' && !active.dataset.v22View) refineHome(active);
    if (active?.id === 'zones') refineZones(active);
    if (active?.id === 'devices') refineDevices(active);
    const restoreStudio = active?.id === 'studio' && active.hidden && !utilityMenuOpen();
    setStudioSurfaceActive(active?.id === 'studio');
    if (restoreStudio) window.studio?.();
    refineModal();
    document.documentElement.dataset.alvExperience = '20.6.2';
  }

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      apply();
    });
  }

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => [...mutation.addedNodes].some((node) => node.nodeType === Node.ELEMENT_NODE))) schedule();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', () => setTimeout(schedule, 0), true);
  document.addEventListener('change', () => setTimeout(schedule, 0), true);
  window.addEventListener('popstate', schedule);
  window.addEventListener('pageshow', schedule);

  window.AluvisionExperiencePolish = Object.freeze({ apply: schedule, statusCopy, lightStats });
  apply();
})();
