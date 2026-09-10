/* V20 customer navigation refinement. Academy and Studio are intentionally
   excluded: this layer only decorates Home, Zones, Group detail and safe sheets. */
(() => {
  'use strict';

  if (window.__aluvisionNavigationRefine) return;
  window.__aluvisionNavigationRefine = true;

  const list = (value) => Array.isArray(value) ? value : [];
  const language = () => {
    let stored;
    try {
      stored = (typeof db === 'object' && db ? db : window.db)?.settings?.language;
    } catch (_) {
      stored = window.db?.settings?.language;
    }
    stored = String(stored || '').slice(0, 2).toLowerCase();
    const html = String(document.documentElement.lang || '').slice(0, 2).toLowerCase();
    return ['nl', 'en', 'fr', 'de'].includes(stored) ? stored : (['nl', 'en', 'fr', 'de'].includes(html) ? html : 'nl');
  };
  const tx = (nl, en, fr, de) => ({ nl, en, fr, de })[language()] || nl;
  const setText = (node, value) => {
    if (node && node.textContent !== value) node.textContent = value;
  };

  function installationState() {
    try {
      return typeof install === 'object' && install ? install : null;
    } catch (_) {
      return null;
    }
  }

  function zoneState() {
    try {
      return typeof zone === 'object' && zone ? zone : null;
    } catch (_) {
      return null;
    }
  }

  function groupState() {
    try {
      return typeof group === 'object' && group ? group : null;
    } catch (_) {
      return null;
    }
  }

  function countScope(location) {
    const zones = list(location?.zones);
    const groups = zones.flatMap((item) => list(item?.groups));
    const lines = groups.flatMap((item) => list(item?.receivers));
    return { zones, groups, lines };
  }

  function excludedSurface(root) {
    if (!root?.querySelector) return false;
    if (root.id === 'studio') return true;
    return Boolean(root.matches?.('.academy-shell,.academy-hub,.academy-practice,.studio-shell,.studio-workspace') || root.querySelector(
      '.academy-shell,.academy-hub,.academy-practice,.studio-shell,.studio-workspace,.studio-stage,.studio-inspector'
    ));
  }

  function removeCustomerCmyk(root = document) {
    if (excludedSurface(root)) return;
    root.querySelectorAll?.('[data-v1815-tool="cmyk"]').forEach((tool) => tool.remove());
  }

  function refineHome(root) {
    const location = installationState();
    const card = root?.querySelector?.('.customer-all-location[data-ui="all-lighting"]');
    if (!location || !card) return;

    const counts = countScope(location);
    card.dataset.alvNavigationRefined = 'true';
    card.setAttribute('aria-label', tx(
      `Snelle bediening voor alle zones en groepen in ${location.name}`,
      `Quick controls for every zone and group in ${location.name}`,
      `Commandes rapides pour toutes les zones et tous les groupes de ${location.name}`,
      `Schnellsteuerung für alle Zonen und Gruppen in ${location.name}`
    ));

    const head = card.querySelector('.ux-control-head');
    setText(head?.querySelector('.scope'), tx('HOME · SNELBEDIENING', 'HOME · QUICK CONTROL', 'ACCUEIL · ACCÈS RAPIDE', 'HOME · SCHNELLZUGRIFF'));
    setText(head?.querySelector('h2'), tx(
      `Alles in ${location.name}`,
      `Everything in ${location.name}`,
      `Tout dans ${location.name}`,
      `Alles in ${location.name}`
    ));
    setText(head?.querySelector('p.sub'), tx(
      'Eén bediening voor elke zone en elke groep in deze locatie.',
      'One control for every zone and every group in this location.',
      'Une commande pour chaque zone et chaque groupe de cet emplacement.',
      'Eine Steuerung für jede Zone und jede Gruppe an diesem Standort.'
    ));

    const explain = card.querySelector('.ux-scope-explain');
    setText(explain?.querySelector('b'), tx(
      'Bedient alle zones én alle groepen',
      'Controls every zone and every group',
      'Pilote toutes les zones et tous les groupes',
      'Steuert alle Zonen und alle Gruppen'
    ));
    setText(explain?.querySelector('small'), tx(
      'Andere locaties veranderen niet.',
      'Other locations remain unchanged.',
      'Les autres emplacements ne changent pas.',
      'Andere Standorte bleiben unverändert.'
    ));

    const badge = card.querySelector('.v1814-all-scope-badge');
    setText(badge?.querySelector('small'), tx('HOME-SNELBEDIENING', 'HOME QUICK CONTROL', 'ACCÈS RAPIDE ACCUEIL', 'HOME-SCHNELLZUGRIFF'));
    setText(badge?.querySelector('b'), tx('Alles tegelijk', 'Everything together', 'Tout ensemble', 'Alles gemeinsam'));

    card.querySelectorAll('[data-v1814-home-action="off"] small,.v1816-power-copy small').forEach((copy) => {
      setText(copy, tx('Alle zones en groepen', 'Every zone and group', 'Toutes les zones et tous les groupes', 'Alle Zonen und Gruppen'));
    });

    let note = card.querySelector('.alv-home-scope-note');
    if (!note) {
      note = document.createElement('div');
      note.className = 'alv-home-scope-note';
      const visual = card.querySelector('.v1814-all-scope-visual,.v188-location-wave');
      (visual || head)?.insertAdjacentElement('afterend', note);
    }
    const key = [location.id, counts.zones.length, counts.groups.length].join(':');
    if (note.dataset.key !== key) {
      note.dataset.key = key;
      note.replaceChildren();
      const icon = document.createElement('i');
      icon.textContent = '⚡';
      const copy = document.createElement('span');
      const title = document.createElement('b');
      title.textContent = tx(
        `${counts.zones.length} zones · ${counts.groups.length} groepen`,
        `${counts.zones.length} zones · ${counts.groups.length} groups`,
        `${counts.zones.length} zones · ${counts.groups.length} groupes`,
        `${counts.zones.length} Zonen · ${counts.groups.length} Gruppen`
      );
      const detail = document.createElement('small');
      detail.textContent = tx(
        'Wijzigingen hier gelden voor alles binnen de actieve locatie.',
        'Changes here apply to everything in the active location.',
        'Les modifications s’appliquent à tout l’emplacement actif.',
        'Änderungen hier gelten für den gesamten aktiven Standort.'
      );
      copy.append(title, detail);
      const scope = document.createElement('em');
      scope.textContent = tx('ALLES', 'ALL', 'TOUT', 'ALLES');
      note.append(icon, copy, scope);
    }
  }

  function overviewJourney(root) {
    const location = installationState();
    const route = root?.querySelector?.('.customer-zone-overview-summary .v188-structure-route');
    if (!location || !route) return;
    const key = `${language()}:${location.id}:${location.name}`;
    if (route.dataset.alvJourneyKey === key) return;
    route.dataset.alvJourneyKey = key;
    route.classList.add('alv-journey-guide');
    route.parentElement?.classList.add('alv-overview-refined');
    route.setAttribute('aria-hidden', 'false');
    route.setAttribute('aria-label', tx(
      'Zo vind je de juiste verlichting',
      'How to find the right lighting',
      'Comment trouver le bon éclairage',
      'So findest du die richtige Beleuchtung'
    ));

    const steps = [
      ['⌂', tx('1 · LOCATIE', '1 · LOCATION', '1 · EMPLACEMENT', '1 · STANDORT'), location.name],
      ['▦', tx('2 · ZONE', '2 · ZONE', '2 · ZONE', '2 · ZONE'), tx('Kies een plaats', 'Choose an area', 'Choisir un espace', 'Bereich wählen')],
      ['◉', tx('3 · GROEP', '3 · GROUP', '3 · GROUPE', '3 · GRUPPE'), tx('Kies je lichtgroep', 'Choose a light group', 'Choisir un groupe', 'Lichtgruppe wählen')]
    ];
    route.replaceChildren();
    steps.forEach((step, index) => {
      if (index) {
        const connector = document.createElement('em');
        connector.setAttribute('aria-hidden', 'true');
        route.append(connector);
      }
      const item = document.createElement('span');
      const icon = document.createElement('i');
      icon.textContent = step[0];
      const copy = document.createElement('b');
      const label = document.createElement('small');
      label.textContent = step[1];
      const value = document.createElement('strong');
      value.textContent = step[2];
      copy.append(label, value);
      item.append(icon, copy);
      route.append(item);
    });
  }

  function contextChip(iconValue, kind, value, action, current = false) {
    const node = document.createElement(action ? 'button' : 'span');
    node.className = `alv-context-chip${current ? ' is-current' : ''}`;
    if (action) {
      node.type = 'button';
      node.addEventListener('click', action);
    } else {
      node.setAttribute('aria-current', 'page');
    }
    const icon = document.createElement('i');
    icon.textContent = iconValue;
    const copy = document.createElement('span');
    const label = document.createElement('small');
    label.textContent = kind;
    const title = document.createElement('b');
    title.textContent = value;
    copy.append(label, title);
    node.append(icon, copy);
    return node;
  }

  function detailContextPath(root) {
    const location = installationState();
    const selectedZone = zoneState();
    const selectedGroup = groupState();
    const route = root?.querySelector?.('.customer-structure-route');
    if (!location || !selectedZone || !route) return;
    const isGroup = Boolean(root.querySelector('.customer-group-page'));
    const key = `${language()}:${location.id}:${selectedZone.id}:${isGroup ? selectedGroup?.id || '' : ''}`;
    if (route.dataset.alvContextKey === key) return;
    route.dataset.alvContextKey = key;
    route.dataset.pathLabel = tx('JE BENT HIER', 'YOU ARE HERE', 'VOUS ÊTES ICI', 'DU BIST HIER');
    route.classList.add('alv-context-path');
    route.setAttribute('aria-label', tx('Je bent hier', 'You are here', 'Vous êtes ici', 'Du bist hier'));
    route.replaceChildren();
    route.append(contextChip('⌂', tx('LOCATIE', 'LOCATION', 'EMPLACEMENT', 'STANDORT'), location.name, () => window.go?.('home'), false));
    route.append(contextChip('▦', tx('ZONE', 'ZONE', 'ZONE', 'ZONE'), selectedZone.name, isGroup ? () => window.showZonePage?.() : null, !isGroup));
    if (isGroup && selectedGroup) route.append(contextChip('◉', tx('GROEP', 'GROUP', 'GROUPE', 'GRUPPE'), selectedGroup.name, null, true));
  }

  function refineZoneScope(root) {
    const selectedZone = zoneState();
    if (!selectedZone || !root?.querySelector?.('.customer-zone-detail')) return;
    const control = root.querySelector('.v18152-zone-scope-control,.customer-zone-control-v2');
    if (!control) return;
    control.dataset.alvZoneScope = selectedZone.id;
    control.setAttribute('aria-label', tx(
      `Snelle bediening, alleen voor ${selectedZone.name}`,
      `Quick controls, only for ${selectedZone.name}`,
      `Commandes rapides, uniquement pour ${selectedZone.name}`,
      `Schnellsteuerung, nur für ${selectedZone.name}`
    ));
    const heading = control.querySelector('.v18152-zone-scope-head');
    setText(heading?.querySelector(':scope > span:nth-child(2) > small'), tx(
      'SNELBEDIENING · ALLEEN DEZE ZONE',
      'QUICK CONTROL · THIS ZONE ONLY',
      'ACCÈS RAPIDE · CETTE ZONE UNIQUEMENT',
      'SCHNELLZUGRIFF · NUR DIESE ZONE'
    ));
    setText(heading?.querySelector(':scope > span:nth-child(2) > b'), tx(
      `Alles in ${selectedZone.name}`,
      `Everything in ${selectedZone.name}`,
      `Tout dans ${selectedZone.name}`,
      `Alles in ${selectedZone.name}`
    ));
    const meta = heading?.querySelector(':scope > span:nth-child(2) > em');
    if (meta) {
      const groups = list(selectedZone.groups).length;
      setText(meta, tx(
        `${groups} groepen · andere zones blijven hetzelfde`,
        `${groups} groups · other zones stay unchanged`,
        `${groups} groupes · les autres zones ne changent pas`,
        `${groups} Gruppen · andere Zonen bleiben gleich`
      ));
    }
  }

  function refineCustomerUi() {
    const active = document.querySelector('.page.on');
    if (!active || excludedSurface(active)) {
      if (gesture) clearGesture(false);
      document.documentElement.classList.remove('alv-swipe-ready');
      document.body.classList.remove('alv-swipe-ready');
      return;
    }
    if (protectedWorkflowActive()) abortProtectedWorkflowGesture();
    if (gesture && (!gesture.destination.surface?.isConnected || backDestination()?.surface !== gesture.destination.surface)) {
      clearGesture(false);
    }
    removeCustomerCmyk(active);
    const modalRoot = document.getElementById('modal');
    if (modalRoot && !modalRoot.hidden && !excludedSurface(modalRoot)) removeCustomerCmyk(modalRoot);
    if (active.id === 'home' && !active.dataset.v22View) refineHome(active);
    if (active.id === 'zones' && !active.dataset.v22View) {
      overviewJourney(active);
      detailContextPath(active);
      refineZoneScope(active);
    }
    const swipeReady = Boolean(backDestination());
    document.documentElement.classList.toggle('alv-swipe-ready', swipeReady);
    document.body.classList.toggle('alv-swipe-ready', swipeReady);
  }

  let refinementQueued = false;
  function queueRefinement() {
    if (refinementQueued) return;
    refinementQueued = true;
    requestAnimationFrame(() => {
      refinementQueued = false;
      refineCustomerUi();
    });
  }

  const observer = new MutationObserver(queueRefinement);
  observer.observe(document.body, { childList: true, subtree: true });

  function lockVisibleZoneScope() {
    const location = installationState();
    const selectedZone = zoneState();
    if (!location || !selectedZone || !document.querySelector('#zones.page.on .customer-zone-detail')) return;
    location.activeZoneId = selectedZone.id;
    const selectedGroup = groupState();
    if (selectedGroup && list(selectedZone.groups).some((item) => item?.id === selectedGroup.id)) {
      location.activeGroupId = selectedGroup.id;
    }
  }

  function wrapScopeHandler(name, mode) {
    const original = window[name];
    if (typeof original !== 'function' || original.__alvScopeGuard) return;
    const wrapped = function (...args) {
      if (mode === 'always' || args[0] === 'zone') lockVisibleZoneScope();
      return original.apply(this, args);
    };
    wrapped.__alvScopeGuard = true;
    window[name] = wrapped;
  }

  [
    'unifiedWheelPick', 'unifiedWheelNudge', 'unifiedBrightness', 'unifiedHex',
    'unifiedQuick', 'unifiedRgbw', 'toggleUnifiedRgb', 'toggleUnifiedWhite',
    'setUnifiedRgbwMode', 'v1816TogglePower'
  ].forEach((name) => wrapScopeHandler(name, 'argument'));
  [
    'zoneOff', 'zoneLook', 'toggleUxZoneControl', 'setUxZoneControlTab',
    'toggleV18152ZoneControl'
  ].forEach((name) => wrapScopeHandler(name, 'always'));

  const swipeCue = document.createElement('div');
  swipeCue.className = 'alv-swipe-cue';
  swipeCue.setAttribute('aria-hidden', 'true');
  swipeCue.innerHTML = '<i>‹</i><span></span>';
  document.body.append(swipeCue);

  const protectedSheet = '.v20-commission,.nfc-pairing,.calibration-shell,.v187-calibration,.v1813-pair-shell[data-v1813="pairing-calibration"],.recovery-shell,.v20-recovery,.academy-shell,.academy-hub,.academy-practice,.studio-shell,.studio-workspace,.studio-stage,.studio-inspector,[data-phase="length"],[data-phase="side"],[data-phase="assign"],[data-phase="review"]';
  const gestureConflict = 'input,textarea,select,[contenteditable="true"],[role="slider"],.color-wheel,.color-wheel-wrap,.wheel-layout,.v1815-rgbw-row,.v187-drag-handle,[draggable="true"],canvas';
  let gesture = null;
  let gestureCleanupTimer = 0;
  let gestureCleanupSurface = null;
  let gestureActionTimer = 0;
  let suppressClickUntil = 0;

  function protectedWorkflowActive(root) {
    const modalRoot = document.getElementById('modal');
    if (!modalRoot || modalRoot.hidden) return false;
    const surface = root || document.getElementById('modalBody') || modalRoot;
    return Boolean(surface.matches?.(protectedSheet) || surface.querySelector?.(protectedSheet));
  }

  function abortProtectedWorkflowGesture() {
    if (gestureActionTimer) clearTimeout(gestureActionTimer);
    gestureActionTimer = 0;
    if (gesture) {
      clearGesture(false);
      return;
    }
    cancelGestureCleanup();
    swipeCue.classList.remove('is-visible');
    swipeCue.style.removeProperty('--alv-swipe-progress');
    document.body.classList.remove('alv-swipe-active');
  }

  function backDestination() {
    const active = document.querySelector('.page.on');
    if (!active || excludedSurface(active)) return null;
    const modalRoot = document.getElementById('modal');
    if (modalRoot && !modalRoot.hidden) {
      const body = document.getElementById('modalBody');
      if (!body || protectedWorkflowActive(body)) return null;
      return {
        surface: body,
        label: tx('Venster sluiten', 'Close window', 'Fermer la fenêtre', 'Fenster schließen'),
        action: () => window.closeModal?.()
      };
    }
    if (active.id !== 'zones') return null;
    if (active.querySelector('.customer-group-page')) {
      return {
        surface: active,
        label: tx('Terug naar de zone', 'Back to the zone', 'Retour à la zone', 'Zurück zur Zone'),
        action: () => window.showZonePage?.()
      };
    }
    if (active.querySelector('.customer-zone-detail')) {
      return {
        surface: active,
        label: tx('Terug naar alle zones', 'Back to all zones', 'Retour à toutes les zones', 'Zurück zu allen Zonen'),
        action: () => window.showZonesOverview?.()
      };
    }
    return null;
  }

  function gestureAvailable(event) {
    if (gesture) return false;
    if (protectedWorkflowActive()) {
      abortProtectedWorkflowGesture();
      return false;
    }
    if (event.pointerType && !['touch', 'pen'].includes(event.pointerType)) return false;
    const clientX = Number(event.clientX);
    const clientY = Number(event.clientY);
    const button = Number(event.button);
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY) || clientX < 0 || clientX > 32 || event.isPrimary === false || (Number.isFinite(button) && button > 0)) return false;
    if (event.target?.closest?.(gestureConflict)) return false;
    return Boolean(backDestination());
  }

  function removeGestureSurfaceStyles(surface) {
    if (!surface?.isConnected) return;
    surface.classList.remove('alv-swipe-surface');
    surface.style.removeProperty('transition');
    surface.style.removeProperty('transform');
    surface.style.removeProperty('opacity');
  }

  function cancelGestureCleanup() {
    if (gestureCleanupTimer) clearTimeout(gestureCleanupTimer);
    gestureCleanupTimer = 0;
    const surface = gestureCleanupSurface;
    gestureCleanupSurface = null;
    removeGestureSurfaceStyles(surface);
  }

  function clearGesture(animate = true) {
    if (!gesture) return;
    const surface = gesture.destination.surface;
    if (gestureActionTimer) clearTimeout(gestureActionTimer);
    gestureActionTimer = 0;
    cancelGestureCleanup();
    if (surface?.isConnected) {
      if (animate) {
        surface.style.transition = 'transform .18s cubic-bezier(.22,.8,.25,1),opacity .18s ease';
        surface.style.transform = 'translate3d(0,0,0)';
        surface.style.opacity = '1';
        gestureCleanupSurface = surface;
        gestureCleanupTimer = setTimeout(() => {
          gestureCleanupTimer = 0;
          gestureCleanupSurface = null;
          if (gesture?.destination?.surface !== surface) removeGestureSurfaceStyles(surface);
        }, 190);
      } else {
        removeGestureSurfaceStyles(surface);
      }
    }
    swipeCue.classList.remove('is-visible');
    swipeCue.style.removeProperty('--alv-swipe-progress');
    document.body.classList.remove('alv-swipe-active');
    gesture = null;
  }

  document.addEventListener('pointerdown', (event) => {
    if (!gestureAvailable(event)) return;
    const destination = backDestination();
    if (!destination?.surface) return;
    cancelGestureCleanup();
    gesture = {
      id: event.pointerId,
      startX: Number(event.clientX),
      startY: Number(event.clientY),
      lastX: Number(event.clientX),
      lastY: Number(event.clientY),
      startedAt: performance.now(),
      dragging: false,
      finishing: false,
      destination
    };
    destination.surface.classList.add('alv-swipe-surface');
    destination.surface.style.transition = 'none';
    setText(swipeCue.querySelector('span'), destination.label);
  }, { capture: true, passive: true });

  document.addEventListener('pointermove', (event) => {
    if (!gesture || event.pointerId !== gesture.id) return;
    if (protectedWorkflowActive()) return abortProtectedWorkflowGesture();
    const clientX = Number(event.clientX);
    const clientY = Number(event.clientY);
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return clearGesture(false);
    const dx = Math.max(0, clientX - gesture.startX);
    const dy = clientY - gesture.startY;
    gesture.lastX = clientX;
    gesture.lastY = clientY;
    if (!gesture.dragging) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > dx * .8) return clearGesture(false);
      if (dx < 9) return;
      gesture.dragging = true;
      document.body.classList.add('alv-swipe-active');
      swipeCue.classList.add('is-visible');
    }
    if (Math.abs(dy) > dx * .95) return;
    event.preventDefault();
    const width = Math.max(320, window.visualViewport?.width || window.innerWidth || 390);
    const progress = Math.max(0, Math.min(1, dx / Math.min(130, width * .34)));
    const shift = Math.min(dx * .38, 56);
    gesture.destination.surface.style.transform = `translate3d(${shift}px,0,0)`;
    gesture.destination.surface.style.opacity = String(1 - progress * .13);
    swipeCue.style.setProperty('--alv-swipe-progress', String(progress));
  }, { capture: true, passive: false });

  function finishGesture(event) {
    if (!gesture || gesture.finishing || event.pointerId !== gesture.id) return;
    if (protectedWorkflowActive()) return abortProtectedWorkflowGesture();
    const current = gesture;
    const finalX = Math.max(Number(event.clientX) || 0, Number(current.lastX) || current.startX);
    const finalY = Number(event.clientY) || Number(current.lastY) || current.startY;
    const dx = Math.max(0, finalX - current.startX);
    const dy = Math.abs(finalY - current.startY);
    const elapsed = Math.max(1, performance.now() - current.startedAt);
    const velocity = dx / elapsed;
    const width = Math.max(320, window.visualViewport?.width || window.innerWidth || 390);
    const compositorCancel = event.type === 'pointercancel' && current.dragging && dx > 36 && dx > dy * 1.2;
    const completes = compositorCancel ||
      (current.dragging && dx > Math.min(92, width * .23) && dx > dy * 1.35) ||
      (current.dragging && dx > 45 && velocity > .62);
    if (!completes) return clearGesture(true);
    event.preventDefault();
    current.finishing = true;
    suppressClickUntil = Date.now() + 450;
    const surface = current.destination.surface;
    if (!surface?.isConnected) return clearGesture(false);
    surface.style.transition = 'transform .14s cubic-bezier(.3,.75,.35,1),opacity .14s ease';
    surface.style.transform = `translate3d(${Math.min(width * .36, 150)}px,0,0)`;
    surface.style.opacity = '.45';
    swipeCue.style.setProperty('--alv-swipe-progress', '1');
    gestureActionTimer = setTimeout(() => {
      gestureActionTimer = 0;
      if (protectedWorkflowActive()) return abortProtectedWorkflowGesture();
      const action = current.destination.action;
      const destination = backDestination();
      const stillCurrent = gesture === current && destination?.surface === surface;
      clearGesture(false);
      if (!stillCurrent) return queueRefinement();
      action();
      queueRefinement();
    }, 125);
  }

  document.addEventListener('pointerup', finishGesture, { capture: true, passive: false });
  // Mobile browsers can hand a horizontal edge drag to their compositor and
  // emit pointercancel instead of pointerup. The last tracked position remains
  // reliable, so finish the same gesture instead of silently discarding it.
  document.addEventListener('pointercancel', finishGesture, { capture: true, passive: false });
  document.addEventListener('click', (event) => {
    if (Date.now() >= suppressClickUntil || event.detail === 0) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  window.AluvisionNavigationRefine = {
    refresh: queueRefinement,
    removeCustomerCmyk,
    lockVisibleZoneScope,
    backDestination
  };

  queueRefinement();
})();
