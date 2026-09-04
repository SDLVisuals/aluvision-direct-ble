/* Aluvision V20 Studio Pro
 * A visual, Art-Net-inspired lighting desk on top of the proven V18 scene
 * transport. The receiver still renders every animation locally.
 */
(() => {
  'use strict';

  if (typeof window.studio !== 'function') return;

  const baseStudio = window.studio;
  const baseSpiConfirmLive = window.studioConfirmLive;
  const baseRgbwConfirmLive = window.studioConsoleRgbwConfirmLive;
  const VIEWS = ['patch', 'control', 'effects', 'show', 'output'];
  const PRO_VERSION = 2;
  const MAX_CUSTOM_PALETTES = 24;
  let saveTimer = 0;
  let effectSearchTimer = 0;
  let draggedLineId = '';

  const colourPalettes = [
    { id: 'aluvision-red', name: 'Aluvision Red', color: '#c94e46', white: 0, rgb: true, w: false },
    { id: 'warm-white', name: 'Warm White', color: '#000000', white: 255, rgb: false, w: true },
    { id: 'pure-white', name: 'Pure White', color: '#000000', white: 220, rgb: false, w: true },
    { id: 'amber', name: 'Amber', color: '#ff9f32', white: 28, rgb: true, w: true },
    { id: 'cyan', name: 'Cyan', color: '#27d9db', white: 0, rgb: true, w: false },
    { id: 'royal-blue', name: 'Royal Blue', color: '#315dff', white: 0, rgb: true, w: false },
    { id: 'magenta', name: 'Magenta', color: '#d645cf', white: 0, rgb: true, w: false },
    { id: 'green', name: 'Emerald', color: '#31b96f', white: 0, rgb: true, w: false }
  ];

  const fixedPreviewColours = ['#ff645d', '#f6b94a', '#37c9bb', '#4988ff', '#a86cf2', '#f05da8'];

  function tr(nl, en, fr, de) {
    const language = String(db?.language || document.documentElement.lang || 'nl').toLowerCase();
    if (language.startsWith('en')) return en;
    if (language.startsWith('fr')) return fr;
    if (language.startsWith('de')) return de;
    return nl;
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function clamp(value, minimum, maximum, fallback = minimum) {
    const parsed = Number(value);
    return Math.max(minimum, Math.min(maximum, Number.isFinite(parsed) ? parsed : fallback));
  }

  function copy(value) {
    return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  }

  function id(prefix) {
    return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  }

  function typeOf(currentGroup = group) {
    const declared = String(currentGroup?.receiverType || currentGroup?.receivers?.[0]?.receiverType || '').toUpperCase();
    if (declared === 'RGBW') return 'RGBW';
    const line = currentGroup?.receivers?.[0];
    const device = (db?.devices || []).find((item) => item.id === line?.deviceId);
    return String(device?.receiverType || device?.deviceType || '').toUpperCase() === 'RGBW' ? 'RGBW' : 'SPI';
  }

  function currentDraft() {
    if (!group) return null;
    if (typeOf() === 'RGBW') return db?.studioRgbwDrafts?.[group.id] || null;
    return db?.studioDrafts?.[group.id] || (db?.studioDraft?.groupId === group.id ? db.studioDraft : null);
  }

  function currentLayer(draft = currentDraft()) {
    return draft?.layers?.find((item) => item.id === draft.selectedLayer) || draft?.layers?.[0] || null;
  }

  function receiverLines() {
    return Array.isArray(group?.receivers) ? group.receivers : [];
  }

  function ensureDesk(draft = currentDraft()) {
    if (!draft) return null;
    const validIds = new Set(receiverLines().map((line) => String(line.id)));
    const existing = draft.proDesk && typeof draft.proDesk === 'object' ? draft.proDesk : {};
    const desk = draft.proDesk = {
      version: PRO_VERSION,
      view: VIEWS.includes(existing.view) ? existing.view : 'control',
      selectionMode: existing.selectionMode === 'custom' ? 'custom' : 'all',
      selectedLineIds: Array.isArray(existing.selectedLineIds) ? existing.selectedLineIds.map(String).filter((lineId) => validIds.has(lineId)) : [],
      effectCategory: String(existing.effectCategory || 'all'),
      effectQuery: String(existing.effectQuery || '').slice(0, 80),
      effectLimit: Math.round(clamp(existing.effectLimit, 12, 256, 24)),
      patchAdvanced: !!existing.patchAdvanced,
      activePaletteId: String(existing.activePaletteId || ''),
      activeSpiCue: String(existing.activeSpiCue || ''),
      spiCues: Array.isArray(existing.spiCues) ? existing.spiCues.slice(0, 60) : [],
      speedMaster: Math.round(clamp(existing.speedMaster, 0, 200, 100))
    };
    if (desk.selectionMode === 'all') desk.selectedLineIds = [];
    return desk;
  }

  function persist(redraw = false) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => save(), 80);
    if (redraw) window.studio();
  }

  function allLineIds() {
    return receiverLines().map((line) => String(line.id));
  }

  function chosenLineIds(desk = ensureDesk()) {
    const all = allLineIds();
    if (!desk || desk.selectionMode === 'all') return all;
    const valid = new Set(all);
    return desk.selectedLineIds.filter((lineId) => valid.has(lineId));
  }

  function outputState(draft = currentDraft()) {
    if (!draft) return copy(group?.state || {});
    if (typeOf() === 'RGBW') {
      const state = copy(draft.state || group.state || {});
      const factor = draft.blackout ? 0 : clamp(draft.master, 0, 100, 100) / 100;
      state.brightness = Math.round(clamp(state.brightness, 0, 100, 100) * factor);
      state.receiverType = 'RGBW';
      return state;
    }
    return copy(window.compileStudioDraft?.(draft, group, draft.playhead || 0)?.state || group.state || {});
  }

  function isSharedLineEffect(state = outputState()) {
    const variant = Number(state?.variant);
    return typeOf() === 'RGBW' ? variant >= 5 && variant <= 16 : variant >= 90 && variant <= 102;
  }

  function restoreScopedOutput(beforeStates = {}, beforeGroupState = null, selectionPolicy = 'auto') {
    const draft = currentDraft();
    if (!draft?.liveMode || group?.layout !== 'parallel' || receiverLines().length < 2) return;
    const desk = ensureDesk(draft);
    const all = allLineIds();
    const selected = selectionPolicy === 'all'
      ? all
      : selectionPolicy === 'selected'
        ? chosenLineIds(desk)
        : isSharedLineEffect() ? all : chosenLineIds(desk);
    if (!selected.length) return;
    const selectedSet = new Set(selected);
    const next = outputState(draft);
    const states = {};
    receiverLines().forEach((line) => {
      states[line.id] = selectedSet.has(String(line.id))
        ? copy(next)
        : copy(beforeStates[line.id] || beforeGroupState || group.state || next);
    });
    group.parallelLineStates = states;
    group.parallelApplyAll = selected.length === all.length;
    group.parallelSelectedIds = group.parallelApplyAll ? [] : selected;
    group.state = copy(states[selected[0]] || next);
    save('queued');
    queueLive(group);
  }

  function scopedChange(callback, selectionPolicy = 'auto') {
    const beforeStates = copy(group?.parallelLineStates || {});
    const beforeGroupState = copy(group?.state || {});
    const draft = currentDraft();
    const suppressGroupWideSend = !!(draft?.liveMode && group?.layout === 'parallel' && receiverLines().length > 1);
    if (suppressGroupWideSend) draft.liveMode = false;
    try {
      callback();
    } finally {
      if (suppressGroupWideSend) draft.liveMode = true;
    }
    restoreScopedOutput(beforeStates, beforeGroupState, selectionPolicy);
  }

  function selectedSummary(desk = ensureDesk(), physicalSelection = false) {
    if (!physicalSelection && group?.layout !== 'parallel') {
      return tr('Volledige doorlopende LED Line', 'Complete continuous LED Line', 'LED Line continue complète', 'Vollständige durchgehende LED Line');
    }
    const count = chosenLineIds(desk).length;
    const totalLines = receiverLines().length;
    if (!count) return tr('Niets geselecteerd', 'Nothing selected', 'Aucune sélection', 'Nichts ausgewählt');
    if (count === totalLines) return `${tr('Alle', 'All', 'Toutes', 'Alle')} ${totalLines} LED Lines`;
    const indexes = chosenLineIds(desk).map((lineId) => receiverLines().findIndex((line) => String(line.id) === lineId) + 1);
    return `LED Line${indexes.length === 1 ? '' : 's'} ${indexes.join(', ')}`;
  }

  function deviceFor(line) {
    return (db?.devices || []).find((device) => device.id === line?.deviceId) || {};
  }

  function deviceReachable(device) {
    if (typeof window.receiverReachable === 'function') return !!window.receiverReachable(device);
    return !!(device?.online || device?.reachableViaGateway || device?.espNowReachable);
  }

  function friendlyLineName(line, index) {
    const device = deviceFor(line);
    return String(line?.displayName || line?.name || device?.name || `LED Line ${index + 1}`);
  }

  function linePixels(line) {
    return typeOf() === 'RGBW' ? 1 : Math.max(1, Math.round(Number(line?.pixels || deviceFor(line)?.pixels) || 1));
  }

  function layoutVisual(kind, active) {
    const lines = kind === 'line'
      ? '<i></i><i></i><b></b>'
      : '<i></i><i></i><i></i><b></b>';
    return `<span class="alv-pro-layout-visual ${kind} ${active ? 'on' : ''}">${lines}</span>`;
  }

  function navMarkup(desk) {
    const items = [
      ['patch', '▦', tr('Opstelling', 'Setup', 'Implantation', 'Aufbau'), tr('Selecteer lijnen', 'Select lines', 'Sélection', 'Linien wählen')],
      ['control', '⌁', tr('Bediening', 'Control', 'Contrôle', 'Bedienung'), tr('Faders en lagen', 'Faders & layers', 'Faders et calques', 'Fader & Ebenen')],
      ['effects', '✦', tr('Effecten', 'Effects', 'Effets', 'Effekte'), tr('Visueel kiezen', 'Choose visually', 'Choisir visuellement', 'Visuell wählen')],
      ['show', '◇', tr('Tijdlijn', 'Timeline', 'Timeline', 'Timeline'), tr('Cues en verloop', 'Cues & sequence', 'Cues et séquence', 'Cues & Ablauf')],
      ['output', '◉', tr('Uitvoer', 'Output', 'Sortie', 'Ausgabe'), tr('Live en status', 'Live & status', 'Live et statut', 'Live & Status')]
    ];
    return `<nav class="alv-pro-nav" aria-label="Studio werkruimtes">${items.map(([view, icon, label, help]) => `<button class="${desk.view === view ? 'on' : ''}" aria-current="${desk.view === view ? 'page' : 'false'}" data-studio-view="${view}" onclick="studioProView('${view}')"><i>${icon}</i><span><b>${label}</b><small>${help}</small></span></button>`).join('')}</nav>`;
  }

  function selectionBar(desk, physicalSelection = false) {
    const all = receiverLines().length;
    if (!physicalSelection && group?.layout !== 'parallel') return `<section class="alv-pro-selection alv-pro-selection-locked"><span><small>${tr('BEDIENINGSDOEL', 'CONTROL TARGET', 'CIBLE DE CONTRÔLE', 'STEUERZIEL')}</small><b>${esc(selectedSummary(desk))}</b></span><div><span>${tr('Ontvangers blijven samen één vloeiende lijn', 'Receivers remain one seamless line', 'Les récepteurs restent une ligne continue', 'Receiver bleiben eine durchgehende Linie')}</span></div><em>${all || 0}</em></section>`;
    return `<section class="alv-pro-selection" aria-label="${tr('LED Lines selecteren', 'Select LED Lines', 'Sélectionner les LED Lines', 'LED Lines auswählen')}">
      <span><small>${tr('ACTIEVE SELECTIE', 'ACTIVE SELECTION', 'SÉLECTION ACTIVE', 'AKTIVE AUSWAHL')}</small><b>${esc(selectedSummary(desk, true))}</b></span>
      <div>
        <button class="${desk.selectionMode === 'all' ? 'on' : ''}" data-studio-action="select-all" onclick="studioProSelect('all')">${tr('Alles', 'All', 'Tout', 'Alle')}</button>
        <button data-studio-action="select-odd" onclick="studioProSelect('odd')">${tr('Oneven', 'Odd', 'Impair', 'Ungerade')}</button>
        <button data-studio-action="select-even" onclick="studioProSelect('even')">${tr('Even', 'Even', 'Pair', 'Gerade')}</button>
        <button data-studio-action="select-invert" onclick="studioProSelect('invert')">${tr('Omkeren', 'Invert', 'Inverser', 'Umkehren')}</button>
        <button data-studio-action="select-none" onclick="studioProSelect('none')">${tr('Geen', 'None', 'Aucun', 'Keine')}</button>
      </div><em>${all || 0}</em>
    </section>`;
  }

  function fixtureCard(line, index, desk, offset) {
    const rgbw = typeOf() === 'RGBW';
    const selected = chosenLineIds(desk).includes(String(line.id));
    const device = deviceFor(line);
    const reachable = deviceReachable(device);
    const pixels = linePixels(line);
    const start = offset + 1;
    const end = offset + pixels;
    const port = Number(line?.port);
    return `<article class="alv-pro-fixture ${selected ? 'selected' : ''}" data-fixture-id="${esc(line.id)}" draggable="true" ondragstart="studioProDragStart(event,'${esc(line.id)}')" ondragover="event.preventDefault()" ondrop="studioProDrop(event,'${esc(line.id)}')">
      <button class="alv-pro-fixture-select" data-fixture-id="${esc(line.id)}" aria-pressed="${selected}" onclick="studioProToggleLine('${esc(line.id)}')">
        <span class="alv-pro-fixture-number">${selected ? '✓' : index + 1}</span>
        <span><b>LED Line ${index + 1}</b><small>${esc(friendlyLineName(line, index))}</small></span>
        <em class="${reachable ? 'online' : ''}">${reachable ? '●' : '○'}</em>
      </button>
      <div class="alv-pro-line-strip ${line.reversed ? 'reversed' : ''}" style="--fixture:${fixedPreviewColours[index % fixedPreviewColours.length]}">${Array.from({ length: Math.max(8, Math.min(24, pixels)) }, () => '<i></i>').join('')}<b></b></div>
      <dl><div><dt>${rgbw ? tr('Uitgang', 'Output', 'Sortie', 'Ausgang') : 'Pixels'}</dt><dd>${rgbw ? tr('Volledige lijn', 'Whole line', 'Ligne complète', 'Ganze Linie') : `${start}–${end}`}</dd></div>${rgbw ? '' : `<div><dt>${tr('Aansluiting', 'Connection', 'Connexion', 'Anschluss')}</dt><dd>${line.reversed ? tr('Rechts', 'Right', 'Droite', 'Rechts') : tr('Links', 'Left', 'Gauche', 'Links')}</dd></div>`}${Number.isFinite(port) ? `<div><dt>Poort</dt><dd>${port}</dd></div>` : ''}</dl>
      <div class="alv-pro-fixture-actions ${rgbw ? 'rgbw' : ''}"><button onclick="identify('${esc(line.id)}')" title="${tr('Laat deze LED Line knipperen', 'Flash this LED Line', 'Faire clignoter', 'LED Line blinken')}">✦ <span>${tr('Knipper', 'Flash', 'Clignoter', 'Blinken')}</span></button><button onclick="studioProMoveLine('${esc(line.id)}',-1)" ${index === 0 ? 'disabled' : ''}>↑</button><button onclick="studioProMoveLine('${esc(line.id)}',1)" ${index === receiverLines().length - 1 ? 'disabled' : ''}>↓</button>${rgbw ? '' : `<button onclick="studioProFlipLine('${esc(line.id)}')">↔</button>`}</div>
    </article>`;
  }

  function patchWorkspace(draft, desk) {
    let offset = 0;
    const cards = receiverLines().map((line, index) => {
      const card = fixtureCard(line, index, desk, offset);
      offset += linePixels(line);
      return card;
    }).join('');
    const parallel = group.layout === 'parallel';
    const vertical = String(group.parallelOrientation || 'horizontal') === 'vertical';
    return `<div class="alv-pro-workspace alv-pro-patch">
      ${selectionBar(desk, true)}
      <div class="alv-pro-patch-grid">
        <section class="alv-pro-card alv-pro-layout-panel"><header><span><small>1 · ${tr('VORM', 'SHAPE', 'FORME', 'FORM')}</small><h2>${tr('Hoe liggen de LED Lines?', 'How are the LED Lines arranged?', 'Comment sont placées les LED Lines ?', 'Wie liegen die LED Lines?')}</h2></span><em>${receiverLines().length}</em></header>
          <div class="alv-pro-layout-choices">
            <button class="${parallel ? '' : 'on'}" onclick="studioProLayout('line')">${layoutVisual('line', !parallel)}<span><b>${tr('Doorlopend', 'Continuous', 'Continu', 'Fortlaufend')}</b><small>${tr('Eén lange beweging', 'One long movement', 'Un long mouvement', 'Eine lange Bewegung')}</small></span></button>
            <button class="${parallel ? 'on' : ''}" onclick="studioProLayout('parallel')">${layoutVisual('parallel', parallel)}<span><b>${tr('Onder elkaar', 'Stacked', 'Superposées', 'Untereinander')}</b><small>${tr('Rijen bewegen samen', 'Rows move together', 'Les rangées bougent ensemble', 'Reihen bewegen gemeinsam')}</small></span></button>
          </div>
          ${parallel ? `<div class="alv-pro-orientation"><span><b>${tr('Richting van de opstelling', 'Layout orientation', 'Orientation', 'Ausrichtung')}</b><small>${tr('Alleen de visuele plaatsing verandert', 'Only the visual arrangement changes', 'Seule la disposition visuelle change', 'Nur die Darstellung ändert sich')}</small></span><div><button class="${vertical ? '' : 'on'}" onclick="studioProOrientation('horizontal')">☰ ${tr('Horizontaal', 'Horizontal', 'Horizontal', 'Horizontal')}</button><button class="${vertical ? 'on' : ''}" onclick="studioProOrientation('vertical')">▥ ${tr('Verticaal', 'Vertical', 'Vertical', 'Vertikal')}</button></div></div>` : ''}
        </section>
        <section class="alv-pro-card alv-pro-map-panel"><header><span><small>2 · ${tr('VOLGORDE', 'ORDER', 'ORDRE', 'REIHENFOLGE')}</small><h2>${tr('Selecteer en rangschik', 'Select and arrange', 'Sélectionner et organiser', 'Auswählen und ordnen')}</h2></span><span class="alv-pro-live-chip ${draft.liveMode ? 'live' : ''}">${draft.liveMode ? 'LIVE' : 'BLIND'}</span></header>
          <div class="alv-pro-fixture-map ${parallel ? 'parallel' : 'continuous'} ${vertical ? 'vertical' : ''}">${cards || `<div class="alv-pro-empty"><i>＋</i><b>${tr('Nog geen Receiver', 'No receiver yet', 'Aucun récepteur', 'Noch kein Receiver')}</b><button onclick="openAddReceiver()">${tr('Receiver toevoegen', 'Add receiver', 'Ajouter un récepteur', 'Receiver hinzufügen')}</button></div>`}</div>
          ${typeOf() === 'SPI' && receiverLines().length ? `<div class="alv-pro-range-callout"><span><b>${tr('Ontwerpbereik voor de preview', 'Design range for the preview', 'Plage de conception pour l’aperçu', 'Entwurfsbereich für die Vorschau')}</b><small>${tr('Hiermee ontwerp je een deel van de virtuele lijn. De huidige receivers spelen live steeds de volledige fysieke LED Line af.', 'This designs part of the virtual line. Current receivers always play the complete physical LED Line live.', 'Cette plage sert à la conception. Les récepteurs actuels jouent toujours la LED Line physique complète.', 'Dieser Bereich dient dem Entwurf. Aktuelle Receiver spielen live stets die gesamte physische LED Line.')}</small></span><button onclick="studioProAssignSelection()">${tr('In preview gebruiken', 'Use in preview', 'Utiliser dans l’aperçu', 'In Vorschau verwenden')} →</button></div>` : ''}
        </section>
      </div>
    </div>`;
  }

  function proFader(key, label, value, maximum, unit, help) {
    const disabled = !chosenLineIds().length;
    const level = clamp(Number(value) / Math.max(1, maximum) * 100, 0, 100, 0);
    return `<label class="alv-pro-fader" data-pro-setting="${key}" style="--level:${level}%">
      <span><i></i><b>${esc(label)}</b><small>${esc(help)}</small></span>
      <div><input type="range" min="${key === 'widthPixels' ? 1 : 0}" max="${maximum}" step="${key === 'lineDelayMs' ? 40 : 1}" value="${Math.round(value)}" ${disabled ? 'disabled' : ''} onpointerdown="studioConsoleBeginEdit(this)" onfocus="studioConsoleBeginEdit(this)" onblur="studioConsoleEndEdit(this)" oninput="studioProValue('${key}',this.value)"><input type="number" inputmode="numeric" min="${key === 'widthPixels' ? 1 : 0}" max="${maximum}" step="${key === 'lineDelayMs' ? 40 : 1}" value="${Math.round(value)}" ${disabled ? 'disabled' : ''} onchange="studioProValue('${key}',this.value,true)"><em>${esc(unit)}</em></div>
    </label>`;
  }

  function paletteButtons(compact = false) {
    const activePaletteId = ensureDesk()?.activePaletteId || '';
    return `<div class="alv-pro-palettes ${compact ? 'compact' : ''}">${allPalettes().map((palette) => `<button class="${activePaletteId === palette.id ? 'selected' : ''}" aria-pressed="${activePaletteId === palette.id}" data-palette-id="${esc(palette.id)}" onclick="studioProApplyPalette('${esc(palette.id)}')" title="${esc(palette.name)}"><i style="--palette:${palettePreview(palette)}"></i><span>${esc(palette.name)}</span>${palette.custom ? `<em onclick="event.stopPropagation();studioProPaletteMenu('${esc(palette.id)}')">•••</em>` : ''}</button>`).join('')}<button class="create" data-studio-action="palette-create" onclick="studioProSavePalette()"><i>＋</i><span>${tr('Huidige look', 'Current look', 'Look actuel', 'Aktueller Look')}</span></button></div>`;
  }

  function controlWing(draft, desk) {
    const rgbw = typeOf() === 'RGBW';
    const layer = currentLayer(draft);
    const state = rgbw ? draft.state : layer;
    const pixels = Math.max(1, Math.round(total(group) || 1));
    const values = rgbw
      ? [
        ['brightness', tr('Helderheid', 'Intensity', 'Intensité', 'Helligkeit'), state.brightness, 100, '%', tr('Lichtniveau', 'Light level', 'Niveau de lumière', 'Lichtniveau')],
        ['speed', tr('Snelheid', 'Speed', 'Vitesse', 'Geschwindigkeit'), state.speed, 100, '%', tr('Traag tot snel', 'Slow to fast', 'Lent à rapide', 'Langsam bis schnell')],
        ['smooth', tr('Vloeiendheid', 'Smoothness', 'Fluidité', 'Weichheit'), state.smooth, 100, '%', tr('Zachte overgangen', 'Soft transitions', 'Transitions douces', 'Weiche Übergänge')],
        ['lineDelayMs', tr('Lijnvertraging', 'Line delay', 'Délai de ligne', 'Linienverzögerung'), state.lineDelayMs || 0, 5080, 'ms', tr('Fase tussen lijnen', 'Phase between lines', 'Phase entre les lignes', 'Phase zwischen Linien')]
      ]
      : [
        ['intensity', tr('Helderheid', 'Intensity', 'Intensité', 'Helligkeit'), layer?.intensity || 0, 100, '%', tr('Geselecteerde laag', 'Selected layer', 'Calque sélectionné', 'Gewählte Ebene')],
        ['speed', tr('Snelheid', 'Speed', 'Vitesse', 'Geschwindigkeit'), layer?.speed || 0, 100, '%', tr('Traag tot snel', 'Slow to fast', 'Lent à rapide', 'Langsam bis schnell')],
        ['widthPixels', tr('Effectdikte', 'Effect width', 'Épaisseur', 'Effektbreite'), layer?.widthPixels || 1, pixels, 'px', `1–${pixels} ${tr('echte leds', 'physical LEDs', 'LED physiques', 'echte LEDs')}`],
        ['smooth', tr('Vloeiendheid', 'Smoothness', 'Fluidité', 'Weichheit'), draft.smooth || 90, 100, '%', tr('Ook mooi bij lage snelheid', 'Smooth even at low speed', 'Fluide même lentement', 'Auch langsam flüssig')]
      ];
    return `<section class="alv-pro-workspace alv-pro-programmer" data-studio-view="control">
      <header><span><small>${tr('SNELLE PROGRAMMER', 'QUICK PROGRAMMER', 'PROGRAMMATEUR RAPIDE', 'SCHNELLPROGRAMMER')}</small><h2>${rgbw ? tr('Volledige LED Line', 'Whole LED Line', 'LED Line complète', 'Ganze LED Line') : esc(layer?.name || tr('Laag', 'Layer', 'Calque', 'Ebene'))}</h2></span><span class="alv-pro-live-chip ${draft.liveMode ? 'live' : ''}">${draft.liveMode ? 'LIVE' : 'BLIND'}</span></header>
      ${selectionBar(desk)}
      <div class="alv-pro-fader-bank">${values.map((item) => proFader(...item)).join('')}</div>
      <div class="alv-pro-quick-row"><span><b>${tr('Kleurpaletten', 'Colour palettes', 'Palettes couleur', 'Farbpaletten')}</b><small>${tr('Tik om meteen toe te passen', 'Tap to apply immediately', 'Touchez pour appliquer', 'Antippen zum Anwenden')}</small></span>${paletteButtons(true)}<button class="alv-pro-open-view" onclick="studioProView('effects')">${tr('Alle effecten', 'All effects', 'Tous les effets', 'Alle Effekte')} →</button></div>
    </section>`;
  }

  function effectFamilies() {
    if (typeOf() === 'RGBW') return [...new Set((window.AluvisionRgbwRuntime?.effects || []).filter((effect) => effect.engine !== 'STATIC').map((effect) => effect.line ? 'Tunnel' : effect.engine))];
    return [...new Set(effects.filter((effect) => effect[1] !== 'STATIC').map((effect) => effect[2] || effect[1]))];
  }

  function rgbwEffectVisual(effect, index) {
    const color = fixedPreviewColours[index % fixedPreviewColours.length];
    return `<span class="alv-pro-rgbw-visual engine-${esc(String(effect.engine || '').toLowerCase())} ${effect.line ? 'lines' : ''}" style="--effect-colour:${color};--effect-second:${fixedPreviewColours[(index + 2) % fixedPreviewColours.length]}"><i></i><i></i><i></i></span>`;
  }

  function effectCard(effect, index, selected, rgbw) {
    const name = rgbw ? effect.name : effect[0];
    const engine = rgbw ? effect.engine : effect[1];
    const category = rgbw ? (effect.line ? 'Tunnel' : effect.engine) : (effect[2] || effect[1]);
    const description = rgbw
      ? (typeof effect.description === 'string' ? effect.description : effect.description?.[String(db?.language || 'nl').slice(0, 2)] || effect.description?.nl || tr('Volledige lijn beweegt egaal', 'Whole line moves evenly', 'La ligne bouge uniformément', 'Ganze Linie bewegt sich gleichmäßig'))
      : category;
    const visual = rgbw
      ? rgbwEffectVisual(effect, index)
      : `<canvas class="effect-mini alv-pro-effect-preview" data-index="${index}" data-engine="${esc(engine)}" data-preview-scope="catalogue" aria-hidden="true"></canvas>`;
    return `<button class="alv-pro-effect-card ${selected ? 'selected' : ''}" data-pro-effect="${esc(name.toLowerCase())}" data-effect-category="${esc(category)}" onclick="studioProPickEffect('${rgbw ? esc(name) : index}')">${visual}<span><small>${esc(category)}</small><b>${esc(name)}</b><em>${esc(description)}</em></span><strong>${selected ? '✓' : '›'}</strong></button>`;
  }

  function effectsWorkspace(draft, desk) {
    const rgbw = typeOf() === 'RGBW';
    const source = rgbw ? (window.AluvisionRgbwRuntime?.effects || []) : effects;
    const moving = source.map((effect, index) => ({ effect, index })).filter(({ effect }) => (rgbw ? effect.engine : effect[1]) !== 'STATIC');
    const still = source.map((effect, index) => ({ effect, index })).filter(({ effect }) => (rgbw ? effect.engine : effect[1]) === 'STATIC');
    const category = desk.effectCategory;
    const query = String(desk.effectQuery || '').trim().toLowerCase();
    const matchesQuery = (effect) => !query || (rgbw
      ? `${effect.name || ''} ${effect.engine || ''} ${effect.line ? 'tunnel' : ''}`
      : `${effect[0] || ''} ${effect[1] || ''} ${effect[2] || ''}`).toLowerCase().includes(query);
    const filtered = moving.filter(({ effect }) => (category === 'all' || (rgbw ? (effect.line ? 'Tunnel' : effect.engine) : (effect[2] || effect[1])) === category) && matchesQuery(effect));
    const filteredStill = still.filter(({ effect }) => matchesQuery(effect));
    const visible = filtered.slice(0, desk.effectLimit);
    const currentName = rgbw ? draft.state.animation : currentLayer(draft)?.animation;
    const isSelected = (effect) => (rgbw ? effect.name : effect[0]) === currentName;
    return `<div class="alv-pro-workspace alv-pro-effects">
      <section class="alv-pro-effects-head"><span><small>${tr('EFFECTBIBLIOTHEEK', 'EFFECT LIBRARY', 'BIBLIOTHÈQUE D’EFFETS', 'EFFEKTBIBLIOTHEK')}</small><h2>${tr('Kies op beeld, niet op techniek', 'Choose visually, not technically', 'Choisissez visuellement', 'Visuell auswählen')}</h2><p>${rgbw ? tr('Iedere preview toont volledige lijnen die faden, pulsen of na elkaar starten.', 'Every preview shows whole lines fading, pulsing or starting in sequence.', 'Chaque aperçu montre des lignes complètes.', 'Jede Vorschau zeigt ganze Linien.') : tr('De previews gebruiken vaste voorbeeldkleuren en tonen de echte bewegingsvorm.', 'Previews use fixed sample colours and show the actual motion.', 'Les aperçus utilisent des couleurs fixes.', 'Vorschauen nutzen feste Beispielfarben.')}</p></span><div><input data-studio-effect-search type="search" value="${esc(desk.effectQuery)}" placeholder="${tr('Zoek animatie…', 'Search animation…', 'Rechercher…', 'Animation suchen…')}" oninput="studioProFilterEffects(this)"><span class="alv-pro-live-chip ${draft.liveMode ? 'live' : ''}">${draft.liveMode ? 'LIVE' : 'BLIND'}</span></div></section>
      <nav class="alv-pro-categories"><button class="${category === 'all' ? 'on' : ''}" onclick="studioProEffectCategory('all')">${tr('Alles', 'All', 'Tout', 'Alle')}</button>${effectFamilies().map((family) => `<button class="${category === family ? 'on' : ''}" onclick="studioProEffectCategory('${esc(family)}')">${esc(family)}</button>`).join('')}</nav>
      ${filteredStill.length ? `<section class="alv-pro-static"><header><span><small>${tr('ZONDER BEWEGING', 'NO MOTION', 'SANS MOUVEMENT', 'OHNE BEWEGUNG')}</small><h3>${tr('Vaste kleur en vaste looks', 'Solid colour and still looks', 'Couleur fixe et looks fixes', 'Feste Farbe und Looks')}</h3></span></header><div>${filteredStill.map(({ effect, index }) => effectCard(effect, index, isSelected(effect), rgbw)).join('')}</div></section>` : ''}
      <section class="alv-pro-effect-browser"><header><span><small>${esc(category === 'all' ? tr('ALLE ANIMATIES', 'ALL ANIMATIONS', 'TOUTES LES ANIMATIONS', 'ALLE ANIMATIONEN') : category.toUpperCase())}</small><h3>${filtered.length} ${tr('keuzes', 'choices', 'choix', 'Auswahlen')}</h3></span><em>${esc(currentName || '')}</em></header><div class="alv-pro-effect-grid">${visible.map(({ effect, index }) => effectCard(effect, index, isSelected(effect), rgbw)).join('')}</div>${visible.length < filtered.length ? `<button class="alv-pro-more" data-studio-action="effects-more" onclick="studioProMoreEffects()">＋ ${tr('Meer tonen', 'Show more', 'Afficher plus', 'Mehr anzeigen')} · ${filtered.length - visible.length}</button>` : ''}</section>
      <section class="alv-pro-card alv-pro-palette-library"><header><span><small>${tr('PALETTEN', 'PALETTES', 'PALETTES', 'PALETTEN')}</small><h2>${tr('Herbruikbare kleuren en looks', 'Reusable colours and looks', 'Couleurs et looks réutilisables', 'Wiederverwendbare Farben und Looks')}</h2></span><button onclick="studioProSavePalette()">＋ ${tr('Huidige look bewaren', 'Save current look', 'Enregistrer le look', 'Aktuellen Look speichern')}</button></header>${paletteButtons()}</section>
    </div>`;
  }

  function cueTimeline(draft, cues, rgbw) {
    let elapsed = 0;
    const duration = rgbw
      ? Math.max(1, cues.reduce((sum, cue) => sum + Number(cue.fade || 0) + Number(cue.hold || 0), 0))
      : Math.max(1, Number(draft.duration) || 8);
    const markers = cues.map((cue, index) => {
      const time = rgbw ? elapsed : clamp(cue.time, 0, duration, 0);
      if (rgbw) elapsed += Number(cue.fade || 0) + Number(cue.hold || 0);
      return `<button data-cue-marker="${esc(cue.id)}" style="left:${clamp(time / duration * 100, 0, 100, 0)}%" onclick="studioProApplyCue('${esc(cue.id)}')"><i></i><span>${index + 1}</span></button>`;
    }).join('');
    return `<div class="alv-pro-ruler"><div>${Array.from({ length: 9 }, (_, index) => `<span style="left:${index * 12.5}%">${(duration * index / 8).toFixed(duration < 10 ? 1 : 0)}s</span>`).join('')}</div><section>${markers}<em style="left:${rgbw ? 0 : clamp((draft.playhead || 0) / duration * 100, 0, 100, 0)}%"></em></section></div>`;
  }

  function cueRow(cue, index, rgbw) {
    const selected = rgbw ? currentDraft()?.selectedCue === cue.id : ensureDesk()?.activeSpiCue === cue.id;
    const animation = rgbw ? cue.state?.animation : cue.snapshot?.layers?.find((layer) => layer.id === cue.snapshot?.selectedLayer)?.animation;
    const timing = rgbw
      ? `<label>Fade<input type="number" min="0" max="30" step=".1" value="${Number(cue.fade ?? 1).toFixed(1)}" onchange="studioProCueValue('${esc(cue.id)}','fade',this.value)"></label><label>${tr('Wachten', 'Hold', 'Attente', 'Halten')}<input type="number" min=".1" max="120" step=".1" value="${Number(cue.hold ?? 2).toFixed(1)}" onchange="studioProCueValue('${esc(cue.id)}','hold',this.value)"></label>`
      : `<label>${tr('Tijdlijnpositie', 'Timeline position', 'Position timeline', 'Timeline-Position')}<input type="number" min="0" max="${Number(currentDraft()?.duration || 120)}" step=".1" value="${Number(cue.time || 0).toFixed(1)}" onchange="studioProCueValue('${esc(cue.id)}','time',this.value)"></label>`;
    return `<article class="alv-pro-cue ${selected ? 'selected' : ''}" data-cue-id="${esc(cue.id)}"><button class="alv-pro-cue-main" onclick="studioProApplyCue('${esc(cue.id)}')"><i>${index + 1}</i><span><b>${esc(cue.name || `Cue ${index + 1}`)}</b><small>${esc(animation || '')}</small></span><em>GO</em></button><div class="alv-pro-cue-time ${rgbw ? 'rgbw' : 'spi'}">${timing}</div><div class="alv-pro-cue-actions"><button onclick="studioProCueMenu('${esc(cue.id)}')">•••</button><button onclick="studioProMoveCue('${esc(cue.id)}',-1)" ${index === 0 ? 'disabled' : ''}>↑</button><button onclick="studioProMoveCue('${esc(cue.id)}',1)" ${index === currentCues().length - 1 ? 'disabled' : ''}>↓</button></div></article>`;
  }

  function currentCues() {
    const draft = currentDraft();
    return typeOf() === 'RGBW' ? (draft?.cues || []) : (ensureDesk(draft)?.spiCues || []);
  }

  function showWorkspace(draft, desk) {
    const rgbw = typeOf() === 'RGBW';
    const cues = currentCues();
    const playing = !!draft.playing;
    return `<div class="alv-pro-workspace alv-pro-show">
      <section class="alv-pro-show-top"><span><small>${tr('SHOWBEDIENING', 'SHOW CONTROL', 'CONTRÔLE DU SHOW', 'SHOW-STEUERUNG')}</small><h2>${tr('Van looks naar een volledige lichtshow', 'From looks to a complete lighting show', 'Des looks vers un show complet', 'Von Looks zur Lichtshow')}</h2><p>${rgbw ? tr('Maak cues, bepaal echte fades en speel ze in een duidelijke volgorde.', 'Create cues, set real fades and play them in a clear order.', 'Créez des cues, réglez les fondus et lancez-les.', 'Cues erstellen, echte Fades setzen und abspielen.') : tr('Bewaar looks op de tijdlijn of roep ze direct op met GO.', 'Save looks on the timeline or recall them directly with GO.', 'Enregistrez des looks sur la timeline ou lancez-les avec GO.', 'Looks auf der Timeline speichern oder direkt mit GO abrufen.')}</p></span><span class="alv-pro-live-chip ${draft.liveMode ? 'live' : ''}">${draft.liveMode ? 'LIVE' : 'BLIND'}</span></section>
      <section class="alv-pro-executor"><button data-studio-action="cue-prev" onclick="studioProCueStep(-1)">← <span>${tr('Vorige', 'Previous', 'Précédent', 'Zurück')}</span></button><button class="go" data-studio-action="cue-go" onclick="studioProCueStep(1)"><i>▶</i><span><b>GO</b><small>${tr('Volgende cue', 'Next cue', 'Cue suivante', 'Nächster Cue')}</small></span></button><button data-studio-action="cue-next" onclick="studioProCueStep(1)"><span>${tr('Volgende', 'Next', 'Suivant', 'Weiter')}</span> →</button><div><button onclick="studioProPlay('${playing ? 'pause' : 'play'}')">${playing ? 'Ⅱ' : '▶'} ${playing ? tr('Pauze', 'Pause', 'Pause', 'Pause') : tr('Afspelen', 'Play', 'Lecture', 'Abspielen')}</button><button onclick="studioProPlay('stop')">■ Stop</button><button class="${draft.loop !== false ? 'on' : ''}" onclick="studioProLoop()">↻ Loop</button></div><button class="save-cue" data-studio-action="add-cue" onclick="studioProAddCue()">＋ ${tr('Huidige look als cue', 'Current look as cue', 'Look actuel comme cue', 'Aktuellen Look als Cue')}</button></section>
      <section class="alv-pro-timeline-card"><header><span><small>${tr('TIJDLIJN', 'TIMELINE', 'TIMELINE', 'TIMELINE')}</small><h2>${cues.length} cues</h2></span>${!rgbw ? `<label>${tr('Duur', 'Duration', 'Durée', 'Dauer')}<input type="number" min="1" max="120" step=".5" value="${Number(draft.duration).toFixed(1)}" onchange="studioSetDuration(this.value)">s</label>` : ''}</header>${cueTimeline(draft, cues, rgbw)}</section>
      <section class="alv-pro-cue-stack">${cues.length ? cues.map((cue, index) => cueRow(cue, index, rgbw)).join('') : `<div class="alv-pro-empty"><i>◇</i><b>${tr('Nog geen cues', 'No cues yet', 'Aucune cue', 'Noch keine Cues')}</b><small>${tr('Stel eerst je licht in en bewaar de huidige look.', 'Set your light first and save the current look.', 'Réglez la lumière puis enregistrez le look.', 'Licht einstellen und Look speichern.')}</small><button onclick="studioProAddCue()">＋ ${tr('Eerste cue maken', 'Create first cue', 'Créer la première cue', 'Ersten Cue erstellen')}</button></div>`}</section>
      <p class="alv-pro-truth"><i>i</i><span><b>${tr('De laatste animatie blijft zelfstandig draaien', 'The last animation keeps running autonomously', 'La dernière animation continue seule', 'Die letzte Animation läuft selbstständig')}</b><small>${tr('Cue-overgangen worden door deze app afgespeeld. Verbreekt de verbinding, dan blijft de laatst ontvangen look actief.', 'Cue transitions are played by this app. If the connection drops, the last received look stays active.', 'Les transitions sont jouées par l’app. La dernière ambiance reste active.', 'Cue-Übergänge laufen über diese App; der letzte Look bleibt aktiv.')}</small></span></p>
    </div>`;
  }

  function patchAddress(offset, count) {
    if (typeOf() === 'RGBW') return `L${offset + 1}`;
    const start = offset + 1;
    const end = offset + count;
    return start === end ? `P${start}` : `P${start}–P${end}`;
  }

  function outputWorkspace(draft, desk) {
    let channelOffset = 0;
    const rows = receiverLines().map((line, index) => {
      const device = deviceFor(line);
      const count = typeOf() === 'RGBW' ? 1 : linePixels(line);
      const address = patchAddress(channelOffset, count);
      channelOffset += count;
      const reachable = deviceReachable(device);
      return `<article class="alv-pro-output-line" data-fixture-id="${esc(line.id)}"><span class="alv-pro-fixture-number">${index + 1}</span><span><b>LED Line ${index + 1}</b><small>${esc(friendlyLineName(line, index))}${Number(line.port) ? ` · Poort ${Number(line.port)}` : ''}</small></span><span class="alv-pro-confirm ${reachable ? 'online' : ''}"><i></i>${reachable ? tr('Bereikbaar', 'Reachable', 'Joignable', 'Erreichbar') : tr('Niet bereikbaar', 'Not reachable', 'Injoignable', 'Nicht erreichbar')}</span><b data-patch-address="${esc(address)}">${esc(address)}</b><div><button onclick="identify('${esc(line.id)}')">✦ ${tr('Knipper', 'Flash', 'Clignoter', 'Blinken')}</button><button onclick="deviceDiag('${esc(line.deviceId)}')">${tr('Instellen', 'Settings', 'Réglages', 'Einstellen')}</button></div></article>`;
    }).join('');
    const reachable = receiverLines().filter((line) => deviceReachable(deviceFor(line))).length;
    const master = Math.round(clamp(draft.master, 0, 100, 100));
    return `<div class="alv-pro-workspace alv-pro-output">
      <section class="alv-pro-output-hero"><div><small>${tr('LIVE UITVOER', 'LIVE OUTPUT', 'SORTIE LIVE', 'LIVE-AUSGANG')}</small><h2>${esc(group.name)}</h2><p>${esc(selectedSummary(desk))}</p></div><div class="alv-pro-health"><strong>${reachable}/${receiverLines().length}</strong><span>${tr('LED Lines bereikbaar', 'LED Lines reachable', 'LED Lines joignables', 'LED Lines erreichbar')}</span></div><button class="alv-pro-live-button ${draft.liveMode ? 'live' : ''}" onclick="studioProToggleLive()"><i></i><span><b>${draft.liveMode ? 'LIVE' : 'BLIND'}</b><small>${draft.liveMode ? tr('Wijzigingen gaan direct uit', 'Changes output immediately', 'Sortie immédiate', 'Änderungen sofort live') : tr('Veilig voorbereiden', 'Prepare safely', 'Préparer en sécurité', 'Sicher vorbereiten')}</small></span></button></section>
      <section class="alv-pro-master-desk"><span><small>${tr('GRAND MASTER', 'GRAND MASTER', 'GRAND MASTER', 'GRAND MASTER')}</small><b>${master}%</b></span><input type="range" min="0" max="100" value="${master}" onpointerdown="studioConsoleBeginEdit(this)" oninput="studioProMaster(this.value)"><button class="${draft.blackout ? 'on' : ''}" onclick="studioConsoleBlackout()">${draft.blackout ? tr('Licht herstellen', 'Restore light', 'Rétablir', 'Licht wiederherstellen') : 'BLACKOUT'}</button></section>
      <section class="alv-pro-card alv-pro-monitor"><header><span><small>${tr('RECEIVERS EN POORTEN', 'RECEIVERS & PORTS', 'RÉCEPTEURS ET PORTS', 'RECEIVER & PORTS')}</small><h2>${tr('Uitvoermonitor', 'Output monitor', 'Moniteur de sortie', 'Ausgabemonitor')}</h2></span><em>${typeOf()}</em></header><div>${rows || `<div class="alv-pro-empty"><i>＋</i><b>${tr('Nog geen Receiver', 'No receiver yet', 'Aucun récepteur', 'Noch kein Receiver')}</b><button onclick="openAddReceiver()">${tr('Receiver toevoegen', 'Add receiver', 'Ajouter', 'Receiver hinzufügen')}</button></div>`}</div></section>
      <details class="alv-pro-patch-table" ${desk.patchAdvanced ? 'open' : ''} ontoggle="studioProPatchDetails(this.open)"><summary><span><b>${tr('Virtuele Studio-referentie', 'Virtual Studio reference', 'Référence Studio virtuelle', 'Virtuelle Studio-Referenz')}</b><small>${tr('Geen Art-Net of DMX · alleen een overzicht', 'Not Art-Net or DMX · reference only', 'Ni Art-Net ni DMX · aperçu uniquement', 'Kein Art-Net oder DMX · nur Übersicht')}</small></span><i>›</i></summary><div><p>${tr('Deze referenties helpen LED Lines herkennen in Studio. Ze worden niet als kanalen naar de receivers gestuurd.', 'These references help identify LED Lines in Studio. They are not sent to receivers as channels.', 'Ces références servent uniquement à identifier les LED Lines et ne sont pas envoyées comme canaux.', 'Diese Referenzen dienen nur zur Erkennung und werden nicht als Kanäle gesendet.')}</p><table><thead><tr><th>LED Line</th><th>Type</th><th>${tr('Bereik', 'Range', 'Plage', 'Bereich')}</th><th>${tr('Referentie', 'Reference', 'Référence', 'Referenz')}</th></tr></thead><tbody>${receiverLines().map((line, index) => { const before = receiverLines().slice(0, index).reduce((sum, item) => sum + (typeOf() === 'RGBW' ? 1 : linePixels(item)), 0); const count = typeOf() === 'RGBW' ? 1 : linePixels(line); return `<tr><td>${index + 1}</td><td>${typeOf()}${Number(line.port) ? ` · P${Number(line.port)}` : ''}</td><td>${typeOf() === 'RGBW' ? tr('Volledige lijn', 'Whole line', 'Ligne complète', 'Ganze Linie') : `${before + 1}–${before + count} px`}</td><td data-patch-address="${esc(patchAddress(before, count))}">${esc(patchAddress(before, count))}</td></tr>`; }).join('')}</tbody></table></div></details>
    </div>`;
  }

  function palettePreview(palette) {
    if (palette.rgb === false && palette.w) return 'rgb(255,222,184)';
    const color = /^#[0-9a-f]{6}$/i.test(String(palette.color || '')) ? palette.color : '#ffffff';
    return color;
  }

  function allPalettes() {
    const custom = Array.isArray(db?.studioConsolePalettes) ? db.studioConsolePalettes.slice(0, MAX_CUSTOM_PALETTES) : [];
    return [...colourPalettes, ...custom.map((palette) => ({ ...palette, custom: true }))];
  }

  function findPalette(paletteId) {
    return allPalettes().find((palette) => palette.id === paletteId);
  }

  function currentLookSnapshot() {
    const draft = currentDraft();
    if (typeOf() === 'RGBW') return {
      receiverType: 'RGBW', animation: draft.state.animation, color: draft.state.colors?.[0] || '#000000', white: Number(draft.state.whiteChannels?.[0]) || 0,
      rgb: draft.state.rgbEnabled?.[0] !== false, w: draft.state.whiteEnabled?.[0] !== false, intensity: draft.state.brightness, speed: draft.state.speed
    };
    const layer = currentLayer(draft);
    return { receiverType: 'SPI', animation: layer?.animation, variant: Number(layer?.variant) || 0, color: layer?.color || '#000000', white: Number(layer?.white) || 0, rgb: layer?.rgbEnabled !== false, w: layer?.whiteEnabled !== false, intensity: layer?.intensity, speed: layer?.speed };
  }

  function mountStudioPro() {
    const studioRoot = document.querySelector('#studio .alv-studio');
    const draft = currentDraft();
    if (!studioRoot || !draft || studioRoot.querySelector('.alv-pro-nav')) return;
    const desk = ensureDesk(draft);
    studioRoot.dataset.proView = desk.view;
    const header = studioRoot.querySelector('.alv-studio-header');
    const main = studioRoot.querySelector('.alv-studio-grid');
    if (!header || !main) return;
    header.insertAdjacentHTML('afterend', navMarkup(desk));
    if (desk.view === 'control') main.insertAdjacentHTML('beforebegin', controlWing(draft, desk));
    else {
      const renderer = { patch: patchWorkspace, effects: effectsWorkspace, show: showWorkspace, output: outputWorkspace }[desk.view];
      main.insertAdjacentHTML('beforebegin', renderer ? renderer(draft, desk) : '');
    }
  }

  window.studio = function studioProRender(...args) {
    const result = baseStudio(...args);
    mountStudioPro();
    return result;
  };

  window.studioProView = function studioProView(view) {
    const desk = ensureDesk();
    if (!desk || !VIEWS.includes(view)) return;
    desk.view = view;
    persist(true);
  };

  window.studioProSelect = function studioProSelect(mode) {
    const desk = ensureDesk();
    if (!desk) return;
    const all = allLineIds();
    const current = new Set(chosenLineIds(desk));
    let selected = [];
    if (mode === 'all') desk.selectionMode = 'all';
    else {
      desk.selectionMode = 'custom';
      if (mode === 'odd') selected = all.filter((_, index) => index % 2 === 0);
      else if (mode === 'even') selected = all.filter((_, index) => index % 2 === 1);
      else if (mode === 'invert') selected = all.filter((lineId) => !current.has(lineId));
      desk.selectedLineIds = selected;
    }
    if (group.layout === 'parallel') {
      group.parallelApplyAll = desk.selectionMode === 'all';
      group.parallelSelectedIds = desk.selectionMode === 'all' ? [] : selected.slice();
    }
    persist(true);
  };

  window.studioProToggleLine = function studioProToggleLine(lineId) {
    const desk = ensureDesk();
    if (!desk || !allLineIds().includes(String(lineId))) return;
    let selected = new Set(desk.selectionMode === 'all' ? allLineIds() : desk.selectedLineIds);
    desk.selectionMode = 'custom';
    if (selected.has(String(lineId))) selected.delete(String(lineId));
    else selected.add(String(lineId));
    desk.selectedLineIds = allLineIds().filter((idValue) => selected.has(idValue));
    if (desk.selectedLineIds.length === allLineIds().length) {
      desk.selectionMode = 'all';
      desk.selectedLineIds = [];
    }
    if (group.layout === 'parallel') {
      group.parallelApplyAll = desk.selectionMode === 'all';
      group.parallelSelectedIds = desk.selectionMode === 'all' ? [] : desk.selectedLineIds.slice();
    }
    persist(true);
  };

  window.studioProLayout = function studioProLayout(layout) {
    if (!group || !['line', 'parallel'].includes(layout) || group.layout === layout) return;
    if (typeof window.setGroupLayout === 'function') {
      window.setGroupLayout(layout);
      closeModal();
      ensureDesk().view = 'patch';
      go('studio');
    } else {
      group.layout = layout;
      save();
      queueLive(group);
      window.studio();
    }
  };

  window.studioProOrientation = function studioProOrientation(orientation) {
    if (!group || group.layout !== 'parallel') return;
    group.parallelOrientation = orientation === 'vertical' ? 'vertical' : 'horizontal';
    persist(true);
  };

  window.studioProMoveLine = function studioProMoveLine(lineId, delta) {
    const index = receiverLines().findIndex((line) => String(line.id) === String(lineId));
    const next = index + Number(delta);
    if (index < 0 || next < 0 || next >= receiverLines().length) return;
    [group.receivers[index], group.receivers[next]] = [group.receivers[next], group.receivers[index]];
    save();
    if (currentDraft()?.liveMode) queueLive(group);
    window.studio();
  };

  window.studioProDragStart = function studioProDragStart(event, lineId) {
    draggedLineId = String(lineId);
    event.dataTransfer?.setData('text/plain', draggedLineId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  };

  window.studioProDrop = function studioProDrop(event, targetId) {
    event.preventDefault();
    const sourceId = event.dataTransfer?.getData('text/plain') || draggedLineId;
    const from = receiverLines().findIndex((line) => String(line.id) === String(sourceId));
    const to = receiverLines().findIndex((line) => String(line.id) === String(targetId));
    draggedLineId = '';
    if (from < 0 || to < 0 || from === to) return;
    const [moved] = group.receivers.splice(from, 1);
    group.receivers.splice(to, 0, moved);
    save();
    if (currentDraft()?.liveMode) queueLive(group);
    window.studio();
  };

  window.studioProFlipLine = function studioProFlipLine(lineId) {
    const line = receiverLines().find((item) => String(item.id) === String(lineId));
    if (!line) return;
    line.reversed = !line.reversed;
    save();
    if (currentDraft()?.liveMode) queueLive(group);
    window.studio();
  };

  window.studioProAssignSelection = function studioProAssignSelection() {
    if (typeOf() !== 'SPI') return;
    const selected = chosenLineIds();
    if (!selected.length) return toast(tr('Selecteer eerst minstens één LED Line.', 'Select at least one LED Line first.', 'Sélectionnez au moins une LED Line.', 'Wähle mindestens eine LED Line.'));
    const indexes = selected.map((lineId) => receiverLines().findIndex((line) => String(line.id) === lineId)).sort((a, b) => a - b);
    if (indexes.some((value, index) => index && value !== indexes[index - 1] + 1)) return toast(tr('Kies LED Lines die naast elkaar liggen.', 'Choose adjacent LED Lines.', 'Choisissez des LED Lines adjacentes.', 'Wähle benachbarte LED Lines.'));
    const startIndex = indexes[0];
    const endIndex = indexes.at(-1);
    const start = receiverLines().slice(0, startIndex).reduce((sum, line) => sum + linePixels(line), 0) + 1;
    const end = receiverLines().slice(0, endIndex + 1).reduce((sum, line) => sum + linePixels(line), 0);
    const name = indexes.length === 1 ? `LED Line ${startIndex + 1}` : `LED Lines ${startIndex + 1}–${endIndex + 1}`;
    window.studioLogicalRange?.(name, start, end);
    ensureDesk().view = 'patch';
    persist(true);
    toast(`${name} · ${tr('gebruikt in de ontwerp-preview', 'used in the design preview', 'utilisé dans l’aperçu', 'in der Entwurfsvorschau verwendet')}`);
  };

  window.studioProValue = function studioProValue(key, value, redraw = false) {
    const draft = currentDraft();
    if (!draft) return;
    if (!chosenLineIds().length) return toast(tr('Selecteer eerst minstens één LED Line.', 'Select at least one LED Line.', 'Sélectionnez une LED Line.', 'Wähle eine LED Line.'));
    scopedChange(() => {
      if (typeOf() === 'RGBW') window.studioConsoleRgbwValue?.(key, value, false);
      else if (key === 'smooth') window.studioConsoleSmooth?.(value, false);
      else window.studioConsoleLayerValue?.(key, value, key === 'widthPixels' ? ' px' : '%', false);
    });
    document.querySelectorAll(`[data-pro-setting="${key}"]`).forEach((node) => {
      const maximum = Number(node.querySelector('input[type="range"]')?.max) || 100;
      const next = clamp(value, key === 'widthPixels' ? 1 : 0, maximum, 0);
      node.style.setProperty('--level', `${next / maximum * 100}%`);
      node.querySelectorAll('input').forEach((input) => { if (document.activeElement !== input) input.value = Math.round(next); });
    });
    if (redraw) requestAnimationFrame(() => window.studio());
  };

  window.studioProEffectCategory = function studioProEffectCategory(category) {
    const desk = ensureDesk();
    if (!desk) return;
    desk.effectCategory = String(category || 'all');
    desk.effectLimit = 24;
    persist(true);
  };

  window.studioProMoreEffects = function studioProMoreEffects() {
    const desk = ensureDesk();
    desk.effectLimit = Math.min(256, desk.effectLimit + 24);
    persist(true);
  };

  window.studioProFilterEffects = function studioProFilterEffects(input) {
    const desk = ensureDesk();
    if (!desk) return;
    desk.effectQuery = String(input?.value || '').slice(0, 80);
    desk.effectLimit = 24;
    persist(false);
    clearTimeout(effectSearchTimer);
    effectSearchTimer = setTimeout(() => {
      window.studio();
      requestAnimationFrame(() => {
        const field = document.querySelector('[data-studio-effect-search]');
        if (field) {
          field.focus({ preventScroll: true });
          field.setSelectionRange(field.value.length, field.value.length);
        }
      });
    }, 90);
  };

  window.studioProPickEffect = function studioProPickEffect(value) {
    if (!chosenLineIds().length) return toast(tr('Selecteer eerst minstens één LED Line.', 'Select at least one LED Line.', 'Sélectionnez une LED Line.', 'Wähle eine LED Line.'));
    scopedChange(() => {
      if (typeOf() === 'RGBW') window.studioConsoleRgbwEffect?.(String(value));
      else {
        window.studioCheckpoint?.();
        window.studioLayerEffect?.(Number(value));
      }
    });
    const desk = ensureDesk();
    if (desk) {
      desk.view = 'effects';
      if (group?.layout === 'parallel' && isSharedLineEffect()) {
        desk.selectionMode = 'all';
        desk.selectedLineIds = [];
        group.parallelApplyAll = true;
        group.parallelSelectedIds = [];
      }
    }
    persist(true);
  };

  window.studioProApplyPalette = function studioProApplyPalette(paletteId) {
    const palette = findPalette(paletteId);
    const draft = currentDraft();
    if (!palette || !draft || !chosenLineIds().length) return;
    scopedChange(() => {
      if (typeOf() === 'RGBW') {
        window.studioConsoleRgbwBegin?.();
        const state = draft.state;
        state.colors[0] = palette.color || state.colors[0];
        state.whiteChannels[0] = Math.round(clamp(palette.white, 0, 255, state.whiteChannels[0]));
        state.rgbEnabled[0] = palette.rgb !== false;
        state.whiteEnabled[0] = !!palette.w;
        if (palette.animation && (window.AluvisionRgbwRuntime?.effects || []).some((effect) => effect.name === palette.animation)) {
          const effect = window.AluvisionRgbwRuntime.effects.find((item) => item.name === palette.animation);
          Object.assign(state, { animation: effect.name, engine: effect.engine, variant: effect.variant });
        }
        if (Number.isFinite(Number(palette.intensity))) state.brightness = clamp(palette.intensity, 0, 100, state.brightness);
        if (Number.isFinite(Number(palette.speed))) state.speed = clamp(palette.speed, 0, 100, state.speed);
        window.studioConsoleRgbwValue?.('brightness', state.brightness, false);
      } else {
        window.studioCheckpoint?.();
        const layer = currentLayer(draft);
        if (!layer) return;
        Object.assign(layer, { color: palette.color || layer.color, white: Math.round(clamp(palette.white, 0, 255, layer.white)), rgbEnabled: palette.rgb !== false, whiteEnabled: !!palette.w });
        if (palette.animation) {
          const effectIndex = effects.findIndex((effect) => effect[0] === palette.animation);
          if (effectIndex >= 0) Object.assign(layer, { animation: effects[effectIndex][0], engine: effects[effectIndex][1], variant: effectIndex });
        }
        if (Number.isFinite(Number(palette.intensity))) layer.intensity = clamp(palette.intensity, 0, 100, layer.intensity);
        if (Number.isFinite(Number(palette.speed))) layer.speed = clamp(palette.speed, 0, 100, layer.speed);
        window.studioLayerSet?.('intensity', layer.intensity);
      }
    }, 'selected');
    const desk = ensureDesk();
    desk.activePaletteId = palette.id;
    desk.view = document.querySelector('.alv-studio')?.dataset.proView || desk.view;
    persist(true);
    toast(`${palette.name} · ${tr('toegepast', 'applied', 'appliqué', 'angewendet')}`);
  };

  window.studioProSavePalette = function studioProSavePalette() {
    const snapshot = currentLookSnapshot();
    modal(`<div class="eyebrow">${tr('NIEUW PALET', 'NEW PALETTE', 'NOUVELLE PALETTE', 'NEUE PALETTE')}</div><h1>${tr('Bewaar de huidige look', 'Save the current look', 'Enregistrer le look actuel', 'Aktuellen Look speichern')}</h1><p class="sub">${tr('Kleur, wit, animatie, helderheid en snelheid worden samen bewaard.', 'Colour, white, animation, intensity and speed are saved together.', 'Couleur, blanc, animation, intensité et vitesse sont enregistrés.', 'Farbe, Weiß, Animation, Helligkeit und Geschwindigkeit werden gespeichert.')}</p><label class="studio-field-label">${tr('Naam', 'Name', 'Nom', 'Name')}<input id="alvProPaletteName" class="field" maxlength="48" value="${esc(snapshot.animation || tr('Mijn look', 'My look', 'Mon look', 'Mein Look'))}"></label><div class="alv-pro-palette-review"><i style="--palette:${palettePreview(snapshot)}"></i><span><b>${esc(snapshot.animation || '')}</b><small>${esc(snapshot.color)} · W ${Math.round(snapshot.white)} · ${Math.round(snapshot.intensity || 0)}%</small></span></div><div class="row"><button class="button soft" onclick="closeModal()">${tr('Annuleren', 'Cancel', 'Annuler', 'Abbrechen')}</button><button class="button" onclick="studioProConfirmPalette()">${tr('Palet bewaren', 'Save palette', 'Enregistrer', 'Palette speichern')}</button></div>`);
  };

  window.studioProConfirmPalette = function studioProConfirmPalette() {
    const name = String(document.getElementById('alvProPaletteName')?.value || '').trim().slice(0, 48);
    if (!name) return toast(tr('Geef het palet een naam.', 'Give the palette a name.', 'Donnez un nom à la palette.', 'Gib der Palette einen Namen.'));
    db.studioConsolePalettes = Array.isArray(db.studioConsolePalettes) ? db.studioConsolePalettes : [];
    db.studioConsolePalettes.unshift({ id: id('palette-'), name, ...currentLookSnapshot(), createdAt: Date.now() });
    db.studioConsolePalettes = db.studioConsolePalettes.slice(0, MAX_CUSTOM_PALETTES);
    save();
    closeModal();
    window.studio();
  };

  window.studioProPaletteMenu = function studioProPaletteMenu(paletteId) {
    const palette = (db.studioConsolePalettes || []).find((item) => item.id === paletteId);
    if (!palette) return;
    modal(`<div class="eyebrow">${tr('EIGEN PALET', 'CUSTOM PALETTE', 'PALETTE PERSONNALISÉE', 'EIGENE PALETTE')}</div><h1>${esc(palette.name)}</h1><div class="alv-pro-palette-review"><i style="--palette:${palettePreview(palette)}"></i><span><b>${esc(palette.animation || '')}</b><small>${esc(palette.color)} · W ${Math.round(palette.white || 0)}</small></span></div><div class="stack"><button class="zone" onclick="closeModal();studioProApplyPalette('${esc(paletteId)}')"><b>${tr('Toepassen', 'Apply', 'Appliquer', 'Anwenden')}</b><small>${tr('Op de actieve selectie', 'To active selection', 'À la sélection', 'Auf aktive Auswahl')}</small></button><button class="zone" onclick="studioProRenamePalette('${esc(paletteId)}')"><b>${tr('Hernoemen', 'Rename', 'Renommer', 'Umbenennen')}</b></button><button class="zone" onclick="studioProDuplicatePalette('${esc(paletteId)}')"><b>${tr('Dupliceren', 'Duplicate', 'Dupliquer', 'Duplizieren')}</b></button><button class="zone danger" onclick="studioProDeletePalette('${esc(paletteId)}')"><b>${tr('Verwijderen', 'Delete', 'Supprimer', 'Löschen')}</b></button></div><button class="button soft" style="width:100%;margin-top:12px" onclick="closeModal()">${tr('Sluiten', 'Close', 'Fermer', 'Schließen')}</button>`);
  };

  window.studioProRenamePalette = function studioProRenamePalette(paletteId) {
    const palette = (db.studioConsolePalettes || []).find((item) => item.id === paletteId);
    if (!palette) return;
    const next = prompt(tr('Nieuwe naam', 'New name', 'Nouveau nom', 'Neuer Name'), palette.name);
    if (!next?.trim()) return;
    palette.name = next.trim().slice(0, 48);
    save();
    closeModal();
    window.studio();
  };

  window.studioProDuplicatePalette = function studioProDuplicatePalette(paletteId) {
    const palette = (db.studioConsolePalettes || []).find((item) => item.id === paletteId);
    if (!palette) return;
    db.studioConsolePalettes.unshift({ ...copy(palette), id: id('palette-'), name: `${palette.name} ${tr('kopie', 'copy', 'copie', 'Kopie')}`, createdAt: Date.now() });
    db.studioConsolePalettes = db.studioConsolePalettes.slice(0, MAX_CUSTOM_PALETTES);
    save();
    closeModal();
    window.studio();
  };

  window.studioProDeletePalette = function studioProDeletePalette(paletteId) {
    db.studioConsolePalettes = (db.studioConsolePalettes || []).filter((item) => item.id !== paletteId);
    save();
    closeModal();
    window.studio();
  };

  window.studioProAddCue = function studioProAddCue() {
    const draft = currentDraft();
    if (!draft) return;
    if (typeOf() === 'RGBW') {
      window.studioConsoleRgbwAddCue?.();
      const cue = draft.cues.at(-1);
      if (cue) cue.follow = 'auto';
      ensureDesk(draft).view = 'show';
      persist(true);
      return;
    }
    const desk = ensureDesk(draft);
    if (desk.spiCues.length >= 60) return toast(tr('Maximaal 60 cues per ontwerp.', 'Maximum 60 cues per design.', 'Maximum 60 cues.', 'Maximal 60 Cues.'));
    window.studioCheckpoint?.();
    const time = Math.round(clamp(draft.playhead, 0, draft.duration, 0) * 100) / 100;
    const properties = ['intensity', 'opacity', 'speed', 'widthPixels'];
    const keyframeIds = [];
    draft.layers.forEach((layer) => properties.forEach((property) => {
      const existing = draft.keyframes.find((key) => key.layerId === layer.id && key.property === property && Number(key.time) === time);
      if (existing) {
        Object.assign(existing, { value: layer[property], easing: 'Ease in-out' });
        keyframeIds.push(existing.id);
      } else {
        const keyframe = { id: id('key-'), layerId: layer.id, time, property, value: layer[property], easing: 'Ease in-out' };
        draft.keyframes.push(keyframe);
        keyframeIds.push(keyframe.id);
      }
    }));
    const cue = { id: id('cue-'), name: `Cue ${desk.spiCues.length + 1}`, time, keyframeIds, snapshot: { layers: copy(draft.layers), selectedLayer: draft.selectedLayer, master: draft.master, blackout: draft.blackout, smooth: draft.smooth } };
    desk.spiCues.push(cue);
    desk.activeSpiCue = cue.id;
    persist(true);
  };

  window.studioProApplyCue = function studioProApplyCue(cueId) {
    const draft = currentDraft();
    if (!draft) return;
    if (typeOf() === 'RGBW') {
      window.studioConsoleRgbwApplyCue?.(cueId);
      ensureDesk(draft).view = 'show';
      persist(true);
      return;
    }
    const desk = ensureDesk(draft);
    const cue = desk.spiCues.find((item) => item.id === cueId);
    if (!cue) return;
    scopedChange(() => {
      window.studioCheckpoint?.();
      if (cue.snapshot?.layers?.length) draft.layers = copy(cue.snapshot.layers);
      draft.selectedLayer = cue.snapshot?.selectedLayer || draft.layers[0]?.id;
      draft.master = clamp(cue.snapshot?.master, 0, 100, draft.master);
      draft.blackout = !!cue.snapshot?.blackout;
      draft.smooth = clamp(cue.snapshot?.smooth, 0, 100, draft.smooth);
      draft.playhead = clamp(cue.time, 0, draft.duration, 0);
      const layer = currentLayer(draft);
      if (layer) window.studioLayerSet?.('intensity', layer.intensity);
    }, 'all');
    desk.activeSpiCue = cue.id;
    desk.view = 'show';
    persist(true);
  };

  window.studioProCueValue = function studioProCueValue(cueId, key, value) {
    const draft = currentDraft();
    const cue = currentCues().find((item) => item.id === cueId);
    if (!cue || !draft) return;
    const maximum = key === 'time' ? Number(draft.duration || 120) : key === 'fade' ? 30 : 120;
    const minimum = key === 'hold' ? .1 : 0;
    const oldTime = Number(cue.time || 0);
    const next = Math.round(clamp(value, minimum, maximum, cue[key]) * 10) / 10;
    cue[key] = next;
    if (typeOf() === 'SPI' && key === 'time') {
      const owned = new Set(Array.isArray(cue.keyframeIds) ? cue.keyframeIds : []);
      draft.keyframes.forEach((keyframe) => {
        const belongsToCue = owned.size ? owned.has(keyframe.id) : Math.abs(Number(keyframe.time) - oldTime) < .001;
        if (belongsToCue) keyframe.time = next;
      });
    }
    persist(true);
  };

  window.studioProMoveCue = function studioProMoveCue(cueId, delta) {
    const cues = currentCues();
    const index = cues.findIndex((item) => item.id === cueId);
    const next = index + Number(delta);
    if (index < 0 || next < 0 || next >= cues.length) return;
    if (typeOf() === 'RGBW') return window.studioConsoleRgbwMoveCue?.(cueId, delta);
    [cues[index], cues[next]] = [cues[next], cues[index]];
    persist(true);
  };

  window.studioProCueMenu = function studioProCueMenu(cueId) {
    const cues = currentCues();
    const cue = cues.find((item) => item.id === cueId);
    if (!cue) return;
    modal(`<div class="eyebrow">CUE</div><h1>${esc(cue.name)}</h1><div class="stack"><button class="zone" onclick="studioProRenameCue('${esc(cueId)}')"><b>${tr('Hernoemen', 'Rename', 'Renommer', 'Umbenennen')}</b></button><button class="zone" onclick="studioProDuplicateCue('${esc(cueId)}')"><b>${tr('Dupliceren', 'Duplicate', 'Dupliquer', 'Duplizieren')}</b></button><button class="zone danger" onclick="studioProDeleteCue('${esc(cueId)}')"><b>${tr('Verwijderen', 'Delete', 'Supprimer', 'Löschen')}</b></button></div><button class="button soft" style="width:100%;margin-top:12px" onclick="closeModal()">${tr('Sluiten', 'Close', 'Fermer', 'Schließen')}</button>`);
  };

  window.studioProRenameCue = function studioProRenameCue(cueId) {
    const cue = currentCues().find((item) => item.id === cueId);
    if (!cue) return;
    const next = prompt(tr('Nieuwe cuenaam', 'New cue name', 'Nouveau nom', 'Neuer Cue-Name'), cue.name);
    if (!next?.trim()) return;
    cue.name = next.trim().slice(0, 60);
    save();
    closeModal();
    window.studio();
  };

  window.studioProDuplicateCue = function studioProDuplicateCue(cueId) {
    const cues = currentCues();
    const index = cues.findIndex((item) => item.id === cueId);
    if (index < 0 || cues.length >= 60) return;
    const duplicate = copy(cues[index]);
    duplicate.id = id('cue-');
    duplicate.name = `${duplicate.name} ${tr('kopie', 'copy', 'copie', 'Kopie')}`;
    if (typeOf() === 'SPI') {
      const draft = currentDraft();
      const oldTime = Number(duplicate.time || 0);
      duplicate.time = Math.min(draft.duration, oldTime + .5);
      const owned = new Set(Array.isArray(cues[index].keyframeIds) ? cues[index].keyframeIds : []);
      const sourceKeys = draft.keyframes.filter((keyframe) => owned.size ? owned.has(keyframe.id) : Math.abs(Number(keyframe.time) - oldTime) < .001);
      duplicate.keyframeIds = sourceKeys.map((keyframe) => {
        const created = { ...copy(keyframe), id: id('key-'), time: duplicate.time };
        draft.keyframes.push(created);
        return created.id;
      });
    }
    cues.splice(index + 1, 0, duplicate);
    save();
    closeModal();
    window.studio();
  };

  window.studioProDeleteCue = function studioProDeleteCue(cueId) {
    if (typeOf() === 'RGBW') window.studioConsoleRgbwDeleteCue?.(cueId);
    else {
      const draft = currentDraft();
      const desk = ensureDesk();
      const cue = desk.spiCues.find((item) => item.id === cueId);
      const owned = new Set(Array.isArray(cue?.keyframeIds) ? cue.keyframeIds : []);
      if (owned.size) draft.keyframes = draft.keyframes.filter((keyframe) => !owned.has(keyframe.id));
      desk.spiCues = desk.spiCues.filter((item) => item.id !== cueId);
      if (desk.activeSpiCue === cueId) desk.activeSpiCue = '';
    }
    save();
    closeModal();
    window.studio();
  };

  window.studioProCueStep = function studioProCueStep(delta) {
    const cues = currentCues();
    if (!cues.length) return toast(tr('Maak eerst een cue.', 'Create a cue first.', 'Créez d’abord une cue.', 'Erstelle zuerst einen Cue.'));
    const draft = currentDraft();
    const activeId = typeOf() === 'RGBW' ? draft.selectedCue : ensureDesk(draft).activeSpiCue;
    let index = cues.findIndex((cue) => cue.id === activeId);
    if (index < 0) index = Number(delta) > 0 ? -1 : 0;
    index = (index + Number(delta) + cues.length) % cues.length;
    window.studioProApplyCue(cues[index].id);
  };

  window.studioProPlay = function studioProPlay(mode) {
    if (typeOf() === 'RGBW') window.studioConsoleRgbwPlay?.(mode);
    else window.studioPlay?.(mode);
    ensureDesk().view = 'show';
    persist(true);
  };

  window.studioProLoop = function studioProLoop() {
    if (typeOf() === 'RGBW') window.studioConsoleRgbwLoop?.();
    else window.studioToggleLoop?.();
    ensureDesk().view = 'show';
    persist(true);
  };

  window.studioProMaster = function studioProMaster(value) {
    scopedChange(() => window.studioConsoleMaster?.(value), 'all');
    document.querySelectorAll('.alv-pro-master-desk b').forEach((node) => { node.textContent = `${Math.round(clamp(value, 0, 100, 100))}%`; });
  };

  window.studioProToggleLive = function studioProToggleLive() {
    if (typeOf() === 'RGBW') window.studioConsoleRgbwToggleLive?.();
    else window.studioToggleLive?.();
  };

  window.studioProPatchDetails = function studioProPatchDetails(open) {
    const desk = ensureDesk();
    if (!desk) return;
    desk.patchAdvanced = !!open;
    persist(false);
  };

  if (typeof baseSpiConfirmLive === 'function') {
    window.studioConfirmLive = function studioProConfirmLive(...args) {
      const beforeStates = copy(group?.parallelLineStates || {});
      const beforeGroupState = copy(group?.state || {});
      const result = baseSpiConfirmLive.apply(this, args);
      restoreScopedOutput(beforeStates, beforeGroupState);
      return result;
    };
  }

  if (typeof baseRgbwConfirmLive === 'function') {
    window.studioConsoleRgbwConfirmLive = function studioProRgbwConfirmLive(...args) {
      const beforeStates = copy(group?.parallelLineStates || {});
      const beforeGroupState = copy(group?.state || {});
      const result = baseRgbwConfirmLive.apply(this, args);
      restoreScopedOutput(beforeStates, beforeGroupState);
      return result;
    };
  }

  const style = document.createElement('style');
  style.textContent = `
    .alv-studio{--pro-red:#ce5048;--pro-dark:#141615;--pro-dark-2:#1d201e;--pro-dark-3:#292c29;--pro-line:#ffffff17}
    .alv-pro-nav{position:sticky;top:5px;z-index:12;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;padding:5px;border:1px solid var(--line);border-radius:17px;background:color-mix(in srgb,var(--bg),transparent 4%);box-shadow:0 10px 28px #0002;backdrop-filter:blur(20px)}
    .alv-pro-nav button{display:grid;grid-template-columns:36px minmax(0,1fr);gap:8px;align-items:center;min-height:54px;padding:6px;border:0;border-radius:12px;background:transparent;color:var(--mut);text-align:left;cursor:pointer}
    .alv-pro-nav button>i{display:grid;place-items:center;width:36px;height:36px;border-radius:10px;background:var(--soft);font-style:normal;font-size:15px}.alv-pro-nav b,.alv-pro-nav small{display:block}.alv-pro-nav b{font-size:10px}.alv-pro-nav small{margin-top:2px;font-size:7px}.alv-pro-nav button.on{background:var(--pro-dark);color:#fff}.alv-pro-nav button.on>i{background:var(--pro-red);box-shadow:0 0 0 4px #ce50481e}.alv-pro-nav button.on small{color:#bebfbc}
    .alv-studio[data-pro-view=patch] .alv-studio-grid,.alv-studio[data-pro-view=effects] .alv-studio-grid,.alv-studio[data-pro-view=show] .alv-studio-grid,.alv-studio[data-pro-view=output] .alv-studio-grid{display:none!important}
    .alv-pro-workspace,.alv-pro-programmer{min-width:0}.alv-pro-workspace{display:grid;gap:12px}.alv-pro-card{padding:15px;border:1px solid var(--line);border-radius:19px;background:var(--panel);box-shadow:var(--shadow)}
    .alv-pro-card>header,.alv-pro-effect-browser>header,.alv-pro-static>header,.alv-pro-timeline-card>header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}.alv-pro-card header small,.alv-pro-effect-browser header small,.alv-pro-static header small,.alv-pro-timeline-card header small{display:block;color:var(--mut);font-size:8px;font-weight:950;letter-spacing:.11em}.alv-pro-card h2,.alv-pro-effect-browser h3,.alv-pro-static h3,.alv-pro-timeline-card h2{margin:3px 0 0;letter-spacing:-.025em}.alv-pro-card h2{font-size:20px}.alv-pro-card header>em{padding:5px 8px;border-radius:8px;background:var(--soft);color:var(--mut);font-size:9px;font-style:normal;font-weight:900}
    .alv-pro-selection{display:grid;grid-template-columns:minmax(145px,1fr) auto 30px;gap:10px;align-items:center;padding:9px 11px;border:1px solid var(--line);border-radius:15px;background:var(--panel)}.alv-pro-selection>span small,.alv-pro-selection>span b{display:block}.alv-pro-selection>span small{color:var(--mut);font-size:7px;font-weight:950;letter-spacing:.1em}.alv-pro-selection>span b{margin-top:2px;font-size:11px}.alv-pro-selection>div{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}.alv-pro-selection button{min-height:38px;padding:5px 9px;border:1px solid var(--line);border-radius:9px;background:var(--soft);color:var(--ink);font-size:8px;font-weight:900}.alv-pro-selection button.on{border-color:var(--pro-red);background:var(--pro-red);color:#fff}.alv-pro-selection>em{display:grid;place-items:center;width:28px;height:28px;border-radius:8px;background:var(--pro-dark);color:#fff;font-size:9px;font-style:normal;font-weight:950}
    .alv-pro-selection-locked>div>span{padding:6px 9px;border-radius:9px;background:var(--soft);color:var(--mut);font-size:8px;font-weight:850}
    .alv-pro-patch-grid{display:grid;grid-template-columns:minmax(270px,.78fr) minmax(400px,1.5fr);gap:12px;align-items:start}.alv-pro-layout-choices{display:grid;gap:8px}.alv-pro-layout-choices>button{display:grid;grid-template-columns:120px minmax(0,1fr);gap:12px;align-items:center;min-height:94px;padding:9px;border:1px solid var(--line);border-radius:15px;background:var(--panel);color:var(--ink);text-align:left}.alv-pro-layout-choices>button.on{border-color:var(--pro-red);box-shadow:inset 4px 0 var(--pro-red)}.alv-pro-layout-choices b,.alv-pro-layout-choices small{display:block}.alv-pro-layout-choices b{font-size:12px}.alv-pro-layout-choices small{margin-top:3px;color:var(--mut);font-size:9px}.alv-pro-layout-visual{position:relative;display:block;width:120px;height:72px;overflow:hidden;border-radius:12px;background:#111312}.alv-pro-layout-visual i{position:absolute;height:10px;border-radius:99px;background:#373a37}.alv-pro-layout-visual.line i{top:31px;width:45px}.alv-pro-layout-visual.line i:first-child{left:9px}.alv-pro-layout-visual.line i:nth-child(2){right:9px}.alv-pro-layout-visual.line b{position:absolute;top:29px;left:11px;width:20px;height:14px;border-radius:99px;background:#fff;box-shadow:0 0 14px #fff;animation:alvProContinuous 2.5s linear infinite}.alv-pro-layout-visual.parallel i{left:12px;right:12px}.alv-pro-layout-visual.parallel i:nth-child(1){top:13px}.alv-pro-layout-visual.parallel i:nth-child(2){top:31px}.alv-pro-layout-visual.parallel i:nth-child(3){top:49px}.alv-pro-layout-visual.parallel b{position:absolute;left:12px;right:12px;height:10px;top:13px;border-radius:99px;background:#fff;box-shadow:0 0 14px #fff;animation:alvProRows 2.4s ease-in-out infinite}.alv-pro-orientation{display:grid;gap:9px;margin-top:12px;padding-top:12px;border-top:1px solid var(--line)}.alv-pro-orientation b,.alv-pro-orientation small{display:block}.alv-pro-orientation small{margin-top:3px;color:var(--mut);font-size:9px}.alv-pro-orientation>div{display:grid;grid-template-columns:1fr 1fr;gap:6px}.alv-pro-orientation button{min-height:44px;border:1px solid var(--line);border-radius:11px;background:var(--soft);color:var(--ink);font-size:9px;font-weight:900}.alv-pro-orientation button.on{background:var(--pro-dark);color:#fff}
    .alv-pro-fixture-map{display:grid;gap:8px;min-height:190px;padding:12px;border-radius:16px;background:linear-gradient(145deg,#141615,#0b0c0b);overflow:hidden}.alv-pro-fixture-map.continuous{grid-template-columns:repeat(auto-fit,minmax(190px,1fr))}.alv-pro-fixture-map.parallel{grid-template-columns:1fr}.alv-pro-fixture-map.parallel.vertical{grid-template-columns:repeat(auto-fit,minmax(165px,1fr))}.alv-pro-fixture{padding:8px;border:1px solid var(--pro-line);border-radius:13px;background:#ffffff08;color:#f4f4f1;transition:border-color .15s,background .15s}.alv-pro-fixture.selected{border-color:var(--pro-red);background:#ce504812;box-shadow:inset 3px 0 var(--pro-red)}.alv-pro-fixture-select{display:grid;grid-template-columns:32px minmax(0,1fr) 15px;gap:8px;align-items:center;width:100%;padding:0;border:0;background:none;color:inherit;text-align:left}.alv-pro-fixture-number{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;background:#ffffff0d;font-size:9px;font-weight:950}.alv-pro-fixture.selected .alv-pro-fixture-number{background:var(--pro-red)}.alv-pro-fixture-select b,.alv-pro-fixture-select small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.alv-pro-fixture-select b{font-size:10px}.alv-pro-fixture-select small{color:#aeb1ad;font-size:8px}.alv-pro-fixture-select>em{color:#8b8f8a;font-size:9px;font-style:normal}.alv-pro-fixture-select>em.online{color:#70d69a}.alv-pro-line-strip{position:relative;display:flex;gap:2px;height:28px;margin:8px 0 6px;padding:6px;overflow:hidden;border-radius:8px;background:#070807}.alv-pro-line-strip>i{flex:1;border-radius:3px;background:#303330}.alv-pro-line-strip>b{position:absolute;top:6px;bottom:6px;left:6px;width:24%;border-radius:99px;background:var(--fixture);box-shadow:0 0 12px var(--fixture);animation:alvProStrip 3s ease-in-out infinite}.alv-pro-line-strip.reversed>b{animation-direction:reverse}.alv-pro-fixture dl{display:flex;gap:10px;margin:0}.alv-pro-fixture dl div{min-width:0}.alv-pro-fixture dt{color:#858985;font-size:7px;font-weight:900;text-transform:uppercase}.alv-pro-fixture dd{margin:1px 0 0;font-size:8px;font-weight:850}.alv-pro-fixture-actions{display:grid;grid-template-columns:minmax(68px,1fr) 36px 36px 36px;gap:4px;margin-top:8px}.alv-pro-fixture-actions.rgbw{grid-template-columns:minmax(68px,1fr) 36px 36px}.alv-pro-fixture-actions button{min-height:36px;border:1px solid var(--pro-line);border-radius:9px;background:#ffffff0a;color:#eee;font-size:8px;font-weight:900}.alv-pro-fixture-actions button:disabled{opacity:.25}.alv-pro-range-callout{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;margin-top:11px;padding:10px 11px;border-radius:13px;background:var(--soft)}.alv-pro-range-callout b,.alv-pro-range-callout small{display:block}.alv-pro-range-callout small{margin-top:3px;color:var(--mut);font-size:8px}.alv-pro-range-callout button{min-height:42px;padding:7px 11px;border:0;border-radius:10px;background:var(--pro-dark);color:#fff;font-size:9px;font-weight:900}
    .alv-pro-live-chip{display:inline-flex;align-items:center;justify-content:center;min-height:28px;padding:5px 8px;border-radius:8px;background:#e7e9e6;color:#68706a;font-size:7px;font-weight:950;letter-spacing:.08em}.alv-pro-live-chip.live{background:var(--pro-red);color:#fff;box-shadow:0 0 0 5px #ce504815}.alv-pro-programmer{display:grid;gap:9px;padding:13px;border-radius:19px;background:var(--pro-dark);color:#f4f4f0;box-shadow:0 15px 40px #08090820}.alv-pro-programmer>header{display:flex;justify-content:space-between;align-items:flex-start}.alv-pro-programmer>header small,.alv-pro-programmer>header h2{display:block}.alv-pro-programmer>header small{color:#9da19c;font-size:7px;font-weight:950;letter-spacing:.11em}.alv-pro-programmer>header h2{margin:2px 0 0;font-size:18px}.alv-pro-programmer .alv-pro-selection{border-color:var(--pro-line);background:#ffffff08}.alv-pro-programmer .alv-pro-selection button{border-color:var(--pro-line);background:#ffffff0a;color:#d8dad6}.alv-pro-programmer .alv-pro-selection button.on{background:var(--pro-red);color:#fff}.alv-pro-programmer .alv-pro-selection>em{background:#f0efeb;color:#171918}.alv-pro-fader-bank{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.alv-pro-fader{display:grid;gap:8px;padding:9px;border:1px solid var(--pro-line);border-radius:13px;background:var(--pro-dark-2)}.alv-pro-fader>span{display:grid;grid-template-columns:9px minmax(0,1fr);gap:7px;align-items:start}.alv-pro-fader>span>i{grid-row:1/3;width:7px;height:32px;border-radius:99px;background:linear-gradient(0deg,var(--pro-red) var(--level),#ffffff10 var(--level))}.alv-pro-fader b,.alv-pro-fader small{display:block}.alv-pro-fader b{font-size:9px}.alv-pro-fader small{margin-top:2px;color:#9fa39e;font-size:7px}.alv-pro-fader>div{display:grid;grid-template-columns:minmax(50px,1fr) 52px 19px;gap:5px;align-items:center}.alv-pro-fader input[type=range]{width:100%;accent-color:var(--pro-red)}.alv-pro-fader input[type=number]{width:52px;min-height:34px;padding:4px;border:1px solid var(--pro-line);border-radius:8px;background:#101210;color:#fff;text-align:center;font-size:8px}.alv-pro-fader em{font-size:7px;font-style:normal}.alv-pro-quick-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;padding-top:3px}.alv-pro-quick-row>span b,.alv-pro-quick-row>span small{display:block}.alv-pro-quick-row>span b{font-size:9px}.alv-pro-quick-row>span small{color:#999e98;font-size:7px}.alv-pro-open-view{min-height:42px;padding:7px 10px;border:1px solid var(--pro-line);border-radius:10px;background:#ffffff0c;color:#fff;font-size:8px;font-weight:900}
    .alv-pro-palettes{display:flex;gap:6px;flex-wrap:wrap}.alv-pro-palettes>button{position:relative;display:grid;grid-template-columns:31px minmax(0,1fr) auto;gap:7px;align-items:center;min-width:130px;min-height:47px;padding:6px;border:1px solid var(--line);border-radius:11px;background:var(--panel);color:var(--ink);text-align:left}.alv-pro-palettes>button>i{display:grid;place-items:center;width:31px;height:31px;border-radius:9px;background:var(--palette);box-shadow:inset 0 0 0 1px #fff9,0 0 9px color-mix(in srgb,var(--palette),transparent 55%);font-style:normal}.alv-pro-palettes>button>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:8px;font-weight:900}.alv-pro-palettes>button>em{display:grid;place-items:center;width:29px;height:29px;border-radius:8px;background:var(--soft);font-size:7px;font-style:normal}.alv-pro-palettes>button.create>i{background:var(--pro-dark);color:#fff;box-shadow:none}.alv-pro-palettes.compact{flex-wrap:nowrap;overflow:auto;padding:2px}.alv-pro-palettes.compact>button{grid-template-columns:31px;min-width:43px;width:43px}.alv-pro-palettes.compact>button>span,.alv-pro-palettes.compact>button>em{display:none}.alv-pro-programmer .alv-pro-palettes>button{border-color:var(--pro-line);background:#ffffff09;color:#fff}.alv-pro-palette-review{display:grid;grid-template-columns:54px 1fr;gap:11px;align-items:center;margin:14px 0;padding:11px;border-radius:14px;background:var(--soft)}.alv-pro-palette-review>i{width:54px;height:54px;border-radius:15px;background:var(--palette);box-shadow:0 0 18px color-mix(in srgb,var(--palette),transparent 45%)}.alv-pro-palette-review b,.alv-pro-palette-review small{display:block}.alv-pro-palette-review small{margin-top:4px;color:var(--mut)}
    .alv-pro-palettes>button.selected{border-color:var(--pro-red);box-shadow:inset 0 0 0 1px var(--pro-red)}.alv-pro-palettes>button.selected:after{content:'✓';position:absolute;right:4px;top:4px;display:grid;place-items:center;width:15px;height:15px;border-radius:6px;background:var(--pro-red);color:#fff;font-size:8px;font-weight:950}
    .alv-pro-effects-head,.alv-pro-show-top{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:end;padding:15px;border-radius:19px;background:var(--pro-dark);color:#f4f4f1}.alv-pro-effects-head small,.alv-pro-show-top small{color:#a6aaa4;font-size:8px;font-weight:950;letter-spacing:.12em}.alv-pro-effects-head h2,.alv-pro-show-top h2{margin:3px 0;font-size:clamp(22px,3vw,34px);letter-spacing:-.035em}.alv-pro-effects-head p,.alv-pro-show-top p{max-width:680px;margin:0;color:#afb2ad;font-size:9px}.alv-pro-effects-head>div{display:flex;gap:7px;align-items:center}.alv-pro-effects-head input{width:min(270px,34vw);min-height:43px;padding:7px 11px;border:1px solid var(--pro-line);border-radius:11px;background:#ffffff0a;color:#fff;font-size:9px}.alv-pro-categories{display:flex;gap:6px;overflow:auto;padding:2px 0;scrollbar-width:none}.alv-pro-categories button{flex:0 0 auto;min-height:42px;padding:7px 12px;border:1px solid var(--line);border-radius:11px;background:var(--panel);color:var(--mut);font-size:8px;font-weight:900}.alv-pro-categories button.on{border-color:var(--pro-red);background:var(--pro-red);color:#fff}.alv-pro-static,.alv-pro-effect-browser{padding:14px;border:1px solid var(--line);border-radius:19px;background:var(--panel)}.alv-pro-static>div{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px}.alv-pro-effect-browser header>em{max-width:260px;overflow:hidden;padding:6px 9px;border-radius:8px;background:var(--soft);color:var(--mut);font-size:8px;font-style:normal;text-overflow:ellipsis;white-space:nowrap}.alv-pro-effect-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.alv-pro-effect-card{display:grid;grid-template-columns:minmax(0,1fr) 19px;gap:7px;min-height:152px;padding:7px;border:1px solid var(--line);border-radius:14px;background:var(--panel);color:var(--ink);text-align:left;transition:transform .15s,border-color .15s,box-shadow .15s}.alv-pro-effect-card:hover{transform:translateY(-2px)}.alv-pro-effect-card.selected{border-color:var(--pro-red);box-shadow:inset 0 0 0 1px var(--pro-red),0 7px 18px #ce504814}.alv-pro-effect-card canvas,.alv-pro-rgbw-visual{grid-column:1/-1;display:block;width:100%;height:78px;border-radius:10px;background:#101210}.alv-pro-effect-card>span{display:block}.alv-pro-effect-card>span small,.alv-pro-effect-card>span b,.alv-pro-effect-card>span em{display:block}.alv-pro-effect-card>span small{color:var(--pro-red);font-size:6px;font-weight:950;letter-spacing:.08em;text-transform:uppercase}.alv-pro-effect-card>span b{margin-top:2px;font-size:9px}.alv-pro-effect-card>span em{margin-top:2px;overflow:hidden;color:var(--mut);font-size:7px;font-style:normal;line-height:1.25}.alv-pro-effect-card>strong{color:var(--pro-red);font-size:15px}.alv-pro-rgbw-visual{position:relative;overflow:hidden}.alv-pro-rgbw-visual:before{content:'';position:absolute;inset:27px 9px;border-radius:99px;background:#2f3230}.alv-pro-rgbw-visual>i{position:absolute;left:9px;right:9px;top:27px;height:24px;border-radius:99px;background:linear-gradient(90deg,var(--effect-colour),var(--effect-second));box-shadow:0 0 16px var(--effect-colour);animation:alvProRgbwFade 2.1s ease-in-out infinite}.alv-pro-rgbw-visual>i:nth-child(2),.alv-pro-rgbw-visual>i:nth-child(3){display:none}.alv-pro-rgbw-visual.engine-sparkle>i{animation:alvProRgbwFlash 1.25s steps(1) infinite}.alv-pro-rgbw-visual.engine-chase>i{left:8%;right:auto;width:38%;animation:alvProRgbwTravel 2.3s ease-in-out infinite}.alv-pro-rgbw-visual.lines:before{inset:9px;background:repeating-linear-gradient(0deg,#303330 0 12px,#101210 12px 20px)}.alv-pro-rgbw-visual.lines>i{display:block;left:9px;right:9px;height:12px;top:9px;animation:alvProRgbwLines 2.5s ease-in-out infinite}.alv-pro-rgbw-visual.lines>i:nth-child(2){top:33px;animation-delay:-.8s}.alv-pro-rgbw-visual.lines>i:nth-child(3){top:57px;animation-delay:-1.6s}.alv-pro-more{width:100%;min-height:45px;margin-top:10px;border:1px dashed var(--line);border-radius:12px;background:var(--soft);color:var(--ink);font-size:9px;font-weight:900}.alv-pro-palette-library>header button{min-height:40px;padding:6px 10px;border:0;border-radius:10px;background:var(--pro-dark);color:#fff;font-size:8px;font-weight:900}
    .alv-pro-effect-card>span small{font-size:8px}.alv-pro-effect-card>span b{font-size:10px}.alv-pro-effect-card>span em{font-size:8px;line-height:1.3}.alv-pro-rgbw-visual.engine-chase:not(.lines)>i{left:9px;right:9px;width:auto;animation:alvProRgbwChase 1.8s ease-in-out infinite}
    .alv-pro-executor{display:grid;grid-template-columns:100px minmax(170px,240px) 100px minmax(230px,1fr) auto;gap:7px;padding:10px;border-radius:17px;background:var(--pro-dark);color:#fff}.alv-pro-executor>button,.alv-pro-executor>div button{min-height:48px;padding:7px 10px;border:1px solid var(--pro-line);border-radius:11px;background:#ffffff0b;color:#fff;font-size:8px;font-weight:900}.alv-pro-executor>button.go{display:grid;grid-template-columns:39px 1fr;gap:9px;align-items:center;background:var(--pro-red);border-color:var(--pro-red);text-align:left}.alv-pro-executor>button.go>i{display:grid;place-items:center;width:39px;height:39px;border-radius:10px;background:#ffffff18;font-style:normal}.alv-pro-executor>button.go b,.alv-pro-executor>button.go small{display:block}.alv-pro-executor>button.go b{font-size:13px}.alv-pro-executor>button.go small{font-size:7px;opacity:.78}.alv-pro-executor>div{display:flex;gap:5px}.alv-pro-executor>div button.on{background:#f3f2ee;color:#171918}.alv-pro-executor>button.save-cue{background:#f3f2ee;color:#171918}.alv-pro-timeline-card{padding:13px;border-radius:18px;background:var(--pro-dark);color:#fff}.alv-pro-timeline-card>header label{display:flex;align-items:center;gap:5px;color:#aaa;font-size:8px}.alv-pro-timeline-card>header input{width:65px;min-height:36px;padding:5px;border:1px solid var(--pro-line);border-radius:8px;background:#242725;color:#fff}.alv-pro-ruler>div{position:relative;height:25px;margin:0 8px}.alv-pro-ruler>div span{position:absolute;bottom:4px;transform:translateX(-50%);color:#858984;font-size:7px}.alv-pro-ruler>section{position:relative;height:78px;margin:0 8px;border-radius:10px;background:repeating-linear-gradient(90deg,#ffffff06 0 1px,transparent 1px 12.5%)}.alv-pro-ruler>section>button{position:absolute;z-index:2;top:9px;width:44px;height:58px;border:0;background:none;transform:translateX(-50%);color:#fff}.alv-pro-ruler>section>button i{display:block;width:17px;height:17px;margin:0 auto 5px;transform:rotate(45deg);border:2px solid #fff;border-radius:3px;background:var(--pro-red)}.alv-pro-ruler>section>button span{display:grid;place-items:center;width:25px;height:19px;margin:auto;border-radius:7px;background:#ffffff10;font-size:7px}.alv-pro-ruler>section>em{position:absolute;z-index:1;top:0;bottom:0;width:2px;background:#fff;box-shadow:0 0 9px #fff}.alv-pro-cue-stack{display:grid;gap:7px}.alv-pro-cue{display:grid;grid-template-columns:minmax(190px,1fr) auto auto;gap:8px;align-items:center;padding:7px;border:1px solid var(--line);border-radius:14px;background:var(--panel)}.alv-pro-cue.selected{border-color:var(--pro-red);box-shadow:inset 3px 0 var(--pro-red)}.alv-pro-cue-main{display:grid;grid-template-columns:38px minmax(0,1fr) 38px;gap:8px;align-items:center;border:0;background:none;color:var(--ink);text-align:left}.alv-pro-cue-main>i{display:grid;place-items:center;width:38px;height:38px;border-radius:10px;background:var(--soft);font-style:normal;font-weight:950}.alv-pro-cue-main b,.alv-pro-cue-main small{display:block}.alv-pro-cue-main b{font-size:10px}.alv-pro-cue-main small{margin-top:2px;color:var(--mut);font-size:8px}.alv-pro-cue-main>em{display:grid;place-items:center;width:38px;height:38px;border-radius:10px;background:var(--pro-red);color:#fff;font-size:8px;font-style:normal;font-weight:950}.alv-pro-cue-time{display:flex;gap:5px;align-items:end}.alv-pro-cue-time label{display:grid;gap:2px;color:var(--mut);font-size:8px;font-weight:900}.alv-pro-cue-time input{width:82px;min-height:36px;padding:4px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--ink);text-align:center;font-size:9px}.alv-pro-cue-actions{display:flex;gap:4px}.alv-pro-cue-actions button{width:36px;height:36px;border:1px solid var(--line);border-radius:8px;background:var(--soft);color:var(--ink);font-size:8px;font-weight:900}.alv-pro-cue-actions button:disabled{opacity:.25}.alv-pro-truth{display:grid;grid-template-columns:31px 1fr;gap:9px;align-items:start;margin:0;padding:10px;border-radius:13px;background:#e8e5dc;color:#695f4f}.alv-pro-truth>i{display:grid;place-items:center;width:31px;height:31px;border-radius:9px;background:#ffffff7d;font-style:normal;font-weight:950}.alv-pro-truth b,.alv-pro-truth small{display:block}.alv-pro-truth b{font-size:9px}.alv-pro-truth small{margin-top:2px;font-size:8px;line-height:1.35}
    .alv-pro-output-hero{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(170px,250px);gap:14px;align-items:center;padding:15px;border-radius:19px;background:var(--pro-dark);color:#fff}.alv-pro-output-hero small{color:#a5a9a4;font-size:8px;font-weight:950;letter-spacing:.1em}.alv-pro-output-hero h2{margin:3px 0;font-size:28px}.alv-pro-output-hero p{margin:0;color:#b1b4af;font-size:9px}.alv-pro-health{display:grid;justify-items:center;padding:8px 13px;border-left:1px solid var(--pro-line);border-right:1px solid var(--pro-line)}.alv-pro-health strong{font-size:25px}.alv-pro-health span{color:#a7aaa6;font-size:7px}.alv-pro-live-button{display:grid;grid-template-columns:12px 1fr;gap:9px;align-items:center;min-height:52px;padding:8px 10px;border:1px solid var(--pro-line);border-radius:12px;background:#ffffff0c;color:#fff;text-align:left}.alv-pro-live-button>i{width:10px;height:10px;border-radius:50%;background:#888d88}.alv-pro-live-button.live{background:var(--pro-red);border-color:var(--pro-red)}.alv-pro-live-button.live>i{background:#fff;box-shadow:0 0 0 5px #ffffff20}.alv-pro-live-button b,.alv-pro-live-button small{display:block}.alv-pro-live-button b{font-size:10px}.alv-pro-live-button small{font-size:7px;opacity:.74}.alv-pro-master-desk{display:grid;grid-template-columns:150px minmax(120px,1fr) 130px;gap:12px;align-items:center;padding:13px;border:1px solid var(--line);border-radius:16px;background:var(--panel)}.alv-pro-master-desk>span small,.alv-pro-master-desk>span b{display:block}.alv-pro-master-desk>span small{color:var(--mut);font-size:7px;font-weight:950;letter-spacing:.1em}.alv-pro-master-desk>span b{font-size:20px}.alv-pro-master-desk input{width:100%;accent-color:var(--pro-red)}.alv-pro-master-desk button{min-height:44px;border:1px solid var(--line);border-radius:11px;background:var(--soft);color:var(--ink);font-size:8px;font-weight:950}.alv-pro-master-desk button.on{background:var(--pro-red);border-color:var(--pro-red);color:#fff}.alv-pro-monitor>div{display:grid;gap:7px}.alv-pro-output-line{display:grid;grid-template-columns:38px minmax(130px,1fr) minmax(100px,.6fr) 95px auto;gap:9px;align-items:center;padding:8px;border:1px solid var(--line);border-radius:13px}.alv-pro-output-line>span:nth-child(2) b,.alv-pro-output-line>span:nth-child(2) small{display:block}.alv-pro-output-line>span:nth-child(2) b{font-size:10px}.alv-pro-output-line>span:nth-child(2) small{color:var(--mut);font-size:8px}.alv-pro-confirm{display:flex;align-items:center;gap:6px;color:var(--mut);font-size:8px;font-weight:850}.alv-pro-confirm>i{width:8px;height:8px;border-radius:50%;background:#9c9f9b}.alv-pro-confirm.online>i{background:#54b47b;box-shadow:0 0 0 4px #54b47b18}.alv-pro-output-line>b{font-size:8px}.alv-pro-output-line>div{display:flex;gap:4px}.alv-pro-output-line>div button{min-height:38px;padding:5px 8px;border:1px solid var(--line);border-radius:9px;background:var(--soft);color:var(--ink);font-size:7px;font-weight:900}.alv-pro-patch-table{overflow:hidden;border:1px solid var(--line);border-radius:16px;background:var(--panel)}.alv-pro-patch-table summary{display:flex;justify-content:space-between;align-items:center;min-height:60px;padding:10px 13px;cursor:pointer;list-style:none}.alv-pro-patch-table summary b,.alv-pro-patch-table summary small{display:block}.alv-pro-patch-table summary b{font-size:10px}.alv-pro-patch-table summary small{margin-top:3px;color:var(--mut);font-size:8px}.alv-pro-patch-table summary>i{font-style:normal;transition:transform .2s}.alv-pro-patch-table[open] summary>i{transform:rotate(90deg)}.alv-pro-patch-table>div{padding:0 13px 13px;overflow:auto}.alv-pro-patch-table p{color:var(--mut);font-size:8px}.alv-pro-patch-table table{width:100%;min-width:500px;border-collapse:collapse}.alv-pro-patch-table th,.alv-pro-patch-table td{padding:8px;border-bottom:1px solid var(--line);font-size:8px;text-align:left}.alv-pro-patch-table th{color:var(--mut);font-size:7px;text-transform:uppercase}
    .alv-pro-empty{display:grid;place-items:center;gap:7px;min-height:170px;padding:18px;color:var(--mut);text-align:center}.alv-pro-empty>i{display:grid;place-items:center;width:50px;height:50px;border-radius:14px;background:#ffffff0d;color:#fff;font-size:20px;font-style:normal}.alv-pro-empty b{color:inherit}.alv-pro-empty small{font-size:8px}.alv-pro-empty button{min-height:42px;padding:7px 11px;border:0;border-radius:10px;background:var(--pro-red);color:#fff;font-size:8px;font-weight:900}
    body.dark .alv-pro-card,body.dark .alv-pro-selection,body.dark .alv-pro-static,body.dark .alv-pro-effect-browser,body.dark .alv-pro-effect-card,body.dark .alv-pro-cue,body.dark .alv-pro-master-desk,body.dark .alv-pro-patch-table{background:#202220}body.dark .alv-pro-palettes>button{background:#252725}body.dark .alv-pro-truth{background:#39332b;color:#e1d3bd}
    @keyframes alvProContinuous{to{transform:translateX(80px)}}@keyframes alvProRows{0%,100%{top:13px}33%{top:31px}66%{top:49px}}@keyframes alvProStrip{0%,100%{left:6px}50%{left:calc(76% - 6px)}}@keyframes alvProRgbwFade{0%,100%{opacity:.12;transform:scaleX(.28)}50%{opacity:1;transform:scaleX(1)}}@keyframes alvProRgbwFlash{0%,72%,100%{opacity:.08}73%,88%{opacity:1}}@keyframes alvProRgbwTravel{0%,100%{transform:translateX(0);opacity:.25}50%{transform:translateX(145%);opacity:1}}@keyframes alvProRgbwChase{0%,100%{opacity:.14}50%{opacity:1}}@keyframes alvProRgbwLines{0%,100%{opacity:.1;transform:scaleX(.25);transform-origin:left}50%{opacity:1;transform:scaleX(1)}}
    @media(max-width:1180px){.alv-pro-effect-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.alv-pro-executor{grid-template-columns:82px minmax(150px,210px) 82px 1fr}.alv-pro-executor>button.save-cue{grid-column:1/-1}.alv-pro-output-line{grid-template-columns:38px minmax(130px,1fr) 110px 85px}.alv-pro-output-line>div{grid-column:2/-1;justify-content:flex-end}}
    @media(max-width:820px){.alv-pro-nav button{grid-template-columns:1fr;justify-items:center;text-align:center}.alv-pro-nav button>span small{display:none}.alv-pro-patch-grid{grid-template-columns:1fr}.alv-pro-fader-bank{grid-template-columns:1fr 1fr}.alv-pro-effect-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.alv-pro-executor{grid-template-columns:1fr 1.6fr 1fr}.alv-pro-executor>div,.alv-pro-executor>button.save-cue{grid-column:1/-1}.alv-pro-executor>div{display:grid;grid-template-columns:repeat(3,1fr)}.alv-pro-output-hero{grid-template-columns:1fr auto}.alv-pro-output-hero .alv-pro-live-button{grid-column:1/-1}.alv-pro-output-line{grid-template-columns:38px minmax(130px,1fr) 95px}.alv-pro-output-line>.alv-pro-confirm{grid-column:2}.alv-pro-output-line>b{grid-row:1;grid-column:3}.alv-pro-output-line>div{grid-column:2/-1}.alv-pro-quick-row{grid-template-columns:1fr auto}.alv-pro-quick-row>.alv-pro-palettes{grid-row:2;grid-column:1/-1}.alv-pro-open-view{grid-row:1;grid-column:2}}
    @media(max-width:720px){.alv-pro-nav{top:4px;gap:3px;padding:4px;border-radius:15px}.alv-pro-nav button{min-height:52px;padding:4px 2px;gap:2px}.alv-pro-nav button>i{width:27px;height:26px;border-radius:8px;font-size:13px}.alv-pro-nav b{font-size:7px}.alv-pro-programmer,.alv-pro-card,.alv-pro-effects-head,.alv-pro-show-top{padding:11px;border-radius:16px}.alv-pro-selection{grid-template-columns:1fr 27px}.alv-pro-selection>div{grid-row:2;grid-column:1/-1;display:grid;grid-template-columns:repeat(5,1fr)}.alv-pro-selection button{min-height:44px;padding:4px 2px}.alv-pro-selection>em{grid-row:1;grid-column:2}.alv-pro-layout-choices>button{grid-template-columns:104px minmax(0,1fr)}.alv-pro-layout-visual{width:104px}.alv-pro-fixture-map.continuous{grid-template-columns:1fr}.alv-pro-fixture-actions button{min-height:44px}.alv-pro-range-callout{grid-template-columns:1fr}.alv-pro-range-callout button{width:100%}.alv-pro-fader-bank{grid-template-columns:1fr}.alv-pro-fader{padding:10px}.alv-pro-fader>div{grid-template-columns:minmax(80px,1fr) 58px 21px}.alv-pro-fader input[type=number]{width:58px;min-height:42px}.alv-pro-quick-row{grid-template-columns:1fr auto}.alv-pro-effect-grid{grid-template-columns:1fr 1fr;gap:7px}.alv-pro-effect-card{min-height:144px}.alv-pro-effect-card canvas,.alv-pro-rgbw-visual{height:70px}.alv-pro-effects-head,.alv-pro-show-top{grid-template-columns:1fr}.alv-pro-effects-head>div{display:grid;grid-template-columns:1fr auto}.alv-pro-effects-head input{width:100%;min-height:44px}.alv-pro-static>div{grid-template-columns:1fr}.alv-pro-palette-library>header{display:grid}.alv-pro-palette-library>header button{min-height:44px}.alv-pro-palettes:not(.compact)>button{min-width:calc(50% - 3px);flex:1}.alv-pro-executor{grid-template-columns:1fr 1.4fr 1fr;padding:7px}.alv-pro-executor>button,.alv-pro-executor>div button{min-height:50px}.alv-pro-ruler{overflow:hidden}.alv-pro-cue{grid-template-columns:1fr}.alv-pro-cue-time{grid-row:2;display:grid;grid-template-columns:repeat(4,1fr)}.alv-pro-cue-time input{width:100%;min-height:42px}.alv-pro-cue-time>button{min-height:42px}.alv-pro-cue-actions{grid-row:3;justify-content:flex-end}.alv-pro-cue-actions button{width:44px;height:44px}.alv-pro-output-hero{grid-template-columns:1fr}.alv-pro-health{grid-row:2;border:0;border-top:1px solid var(--pro-line);border-bottom:1px solid var(--pro-line)}.alv-pro-output-hero .alv-pro-live-button{grid-column:1}.alv-pro-master-desk{grid-template-columns:1fr 65px}.alv-pro-master-desk input{grid-row:2;grid-column:1/-1}.alv-pro-master-desk button{grid-row:1;grid-column:2}.alv-pro-output-line{grid-template-columns:38px minmax(0,1fr) 78px}.alv-pro-output-line>.alv-pro-confirm{grid-row:2;grid-column:2}.alv-pro-output-line>b{grid-row:1;grid-column:3}.alv-pro-output-line>div{grid-row:3;grid-column:2/-1;display:grid;grid-template-columns:1fr 1fr}.alv-pro-output-line>div button{min-height:44px}}
    @media(max-width:390px){.alv-pro-nav button>i{width:25px;height:25px}.alv-pro-nav b{font-size:6.5px}.alv-pro-layout-choices>button{grid-template-columns:88px minmax(0,1fr);padding:7px}.alv-pro-layout-visual{width:88px}.alv-pro-selection>div{grid-template-columns:repeat(3,1fr)}.alv-pro-effect-grid{grid-template-columns:1fr}.alv-pro-palettes:not(.compact)>button{min-width:100%}.alv-pro-fixture-actions{grid-template-columns:1fr 44px 44px 44px}.alv-pro-fixture-actions button span{display:none}.alv-pro-executor{grid-template-columns:72px 1fr 72px}.alv-pro-executor>button{padding:5px}.alv-pro-executor>button.go{grid-template-columns:32px 1fr}.alv-pro-executor>button.go>i{width:32px;height:32px}.alv-pro-cue-time{grid-template-columns:1fr 1fr}.alv-pro-cue-time>button{grid-column:1/-1}}
    @media(prefers-reduced-motion:reduce){.alv-pro-layout-visual b,.alv-pro-line-strip>b,.alv-pro-rgbw-visual>i{animation:none!important}.alv-pro-effect-card{transition:none}}
  `;
  document.head.appendChild(style);
})();
