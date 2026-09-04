/* Aluvision V20 Studio Console
 * A dedicated, customer-facing lighting desk for SPI and RGBW groups.
 * It deliberately keeps receiver addresses and transport details out of view.
 */
(() => {
  'use strict';

  const STUDIO_CONSOLE_VERSION = 1;
  const sessionId = `console-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const baseStudio = window.studio;
  const baseCompileStudioDraft = window.compileStudioDraft;
  const baseStudioLayerEffect = window.studioLayerEffect;
  const baseApplyPresetById = window.applyPresetById;
  const baseLoadCustomPreset = window.loadCustomPreset;
  const basePresetMenu = window.presetMenu;
  const baseOverwritePreset = window.overwritePreset;
  const baseRenamePreset = window.renamePreset;
  const baseDuplicatePreset = window.duplicatePreset;
  let saveTimer = 0;
  let liveTimer = 0;
  let rgbwFrame = 0;
  const rgbwRuntime = new Map();

  /* The catalogue is deliberately shared with the normal RGBW editor so the
     Studio can never drift away from receiver-supported effects. */
  const sharedRgbwRuntime = window.AluvisionRgbwRuntime || {};
  const RGBW_EFFECTS = Array.isArray(sharedRgbwRuntime.effects) ? sharedRgbwRuntime.effects : [];

  function tx(nl, en, fr, de) {
    const language = String(db?.language || document.documentElement.lang || 'nl').toLowerCase();
    if (language.startsWith('en')) return en;
    if (language.startsWith('fr')) return fr;
    if (language.startsWith('de')) return de;
    return nl;
  }

  function h(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function clamp(value, minimum, maximum, fallback = minimum) {
    const parsed = Number(value);
    return Math.max(minimum, Math.min(maximum, Number.isFinite(parsed) ? parsed : fallback));
  }

  function clone(value) {
    return typeof structuredClone === 'function'
      ? structuredClone(value)
      : JSON.parse(JSON.stringify(value));
  }

  function uid(prefix) {
    return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  }

  function receiverType(currentGroup = group) {
    const declared = String(currentGroup?.receiverType || '').toUpperCase();
    if (declared === 'RGBW') return 'RGBW';
    if (declared === 'SPI') return 'SPI';
    const line = currentGroup?.receivers?.[0];
    const device = (db?.devices || []).find((item) => item.id === line?.deviceId);
    return String(line?.receiverType || device?.receiverType || device?.deviceType || 'SPI').toUpperCase() === 'RGBW'
      ? 'RGBW'
      : 'SPI';
  }

  function physicalPixels(currentGroup = group) {
    if (!currentGroup) return 0;
    if (receiverType(currentGroup) === 'RGBW') return Math.max(0, currentGroup.receivers?.length || 0);
    return Math.max(0, Math.round(total(currentGroup) || 0));
  }

  function reachableCount(currentGroup = group) {
    return (currentGroup?.receivers || []).filter((line) => {
      const device = (db?.devices || []).find((item) => item.id === line.deviceId);
      return !!device?.online;
    }).length;
  }

  function persistSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => save('queued'), 120);
  }

  function getSpiDraft() {
    return db?.studioDraft && db.studioDraft.groupId === group?.id ? db.studioDraft : null;
  }

  function selectedLayer(draft = getSpiDraft()) {
    return draft?.layers?.find((item) => item.id === draft.selectedLayer) || draft?.layers?.[0] || null;
  }

  function ensureSpiDraft(draft) {
    if (!draft) return draft;
    const firstVisit = draft.consoleVersion !== STUDIO_CONSOLE_VERSION;
    draft.consoleVersion = STUDIO_CONSOLE_VERSION;
    draft.master = clamp(draft.master, 0, 100, 100);
    draft.blackout = !!draft.blackout;
    draft.smooth = clamp(draft.smooth, 0, 100, clamp(group?.state?.smooth, 0, 100, 90));
    draft.inspectorTab = ['look', 'area', 'output'].includes(draft.inspectorTab) ? draft.inspectorTab : 'look';
    draft.advanced = !!draft.advanced;
    if (firstVisit && innerWidth <= 720) draft.mobilePanel = 'settings';
    return draft;
  }

  function warmPreview(hex, white, rgbOn = true, whiteOn = false) {
    const source = /^#[0-9a-f]{6}$/i.test(String(hex || '')) ? String(hex).slice(1) : '000000';
    const rgb = [0, 2, 4].map((offset) => parseInt(source.slice(offset, offset + 2), 16));
    const w = whiteOn ? clamp(white, 0, 255, 0) / 255 : 0;
    const warm = [255, 214, 166];
    return rgb.map((value, index) => Math.round(Math.min(255, (rgbOn ? value : 0) + warm[index] * w)));
  }

  function cssColor(layer) {
    const color = warmPreview(layer?.color, layer?.white, layer?.rgbEnabled !== false, layer?.whiteEnabled !== false);
    return `rgb(${color.join(',')})`;
  }

  function compatibilityBadge(kind) {
    const labels = {
      receiver: tx('RECEIVER', 'RECEIVER', 'RÉCEPTEUR', 'RECEIVER'),
      live: tx('APP LIVE', 'APP LIVE', 'APP LIVE', 'APP LIVE'),
      preview: tx('ONTWERP', 'DESIGN', 'PROJET', 'ENTWURF')
    };
    return `<span class="alv-cap ${kind === 'preview' ? 'design' : kind}">${labels[kind] || labels.receiver}</span>`;
  }

  function layerRange(draft, layer) {
    return draft?.ranges?.[Number(layer?.range) || 0] || draft?.ranges?.[0] || { start: 1, end: physicalPixels() || 1, name: 'LED Line' };
  }

  function settingVisual(kind, value, maximum, color) {
    const level = clamp((Number(value) / Math.max(1, Number(maximum))) * 100, 0, 100, 0);
    if (kind === 'blend') {
      return `<span class="alv-fader-demo blend" style="--level:${level}%;--light:${color}"><i></i><b></b></span>`;
    }
    return `<span class="alv-fader-demo ${kind}" style="--level:${level}%;--light:${color};--motion:${Math.max(.8, 7 - level * .055)}s"><i></i>${Array.from({ length: 14 }, () => '<b></b>').join('')}</span>`;
  }

  function fader(key, label, value, maximum, unit, help, kind, capability = 'receiver') {
    const color = cssColor(selectedLayer());
    const minimum = key === 'widthPixels' ? 1 : 0;
    return `<label class="alv-fader" data-setting="${key}">
      <span class="alv-fader-head"><span><b>${h(label)}</b><small>${h(help)}</small></span>${compatibilityBadge(capability)}<output id="alv-${key}-out">${Math.round(value)}${h(unit)}</output></span>
      ${settingVisual(kind, value, maximum, color)}
      <span class="alv-range-row"><input type="range" aria-label="${h(label)}" min="${minimum}" max="${maximum}" step="1" value="${Math.round(value)}" onpointerdown="studioConsoleBeginEdit(this)" onfocus="studioConsoleBeginEdit(this)" onblur="studioConsoleEndEdit(this)" oninput="studioConsoleLayerValue('${key}',this.value,'${unit}')"><input class="alv-number" aria-label="${h(label)}" type="number" min="${minimum}" max="${maximum}" value="${Math.round(value)}" onfocus="studioConsoleBeginEdit(this)" onblur="studioConsoleEndEdit(this)" onchange="studioConsoleLayerValue('${key}',this.value,'${unit}',true)"><em>${h(unit.trim() || '%')}</em></span>
    </label>`;
  }

  function masterControl(draft, compact = false) {
    return `<section class="alv-master ${compact ? 'compact' : ''}" style="--master:${draft.blackout ? 0 : draft.master}%">
      <span class="alv-master-copy"><small>${tx('HOOFDREGELAAR', 'MASTER OUTPUT', 'SORTIE GÉNÉRALE', 'MASTER-AUSGANG')}</small><b>${tx('Master', 'Master', 'Master', 'Master')}</b></span>
      <input aria-label="${tx('Master helderheid', 'Master brightness', 'Luminosité générale', 'Master-Helligkeit')}" type="range" min="0" max="100" value="${draft.master}" onpointerdown="studioConsoleBeginEdit(this)" onfocus="studioConsoleBeginEdit(this)" onblur="studioConsoleEndEdit(this)" oninput="studioConsoleMaster(this.value)">
      <output class="alv-master-output">${draft.master}%</output>
      <button class="alv-blackout ${draft.blackout ? 'on' : ''}" aria-pressed="${draft.blackout}" onclick="studioConsoleBlackout()"><i></i><span>${draft.blackout ? tx('Licht herstellen', 'Restore light', 'Rétablir', 'Licht wiederherstellen') : tx('Alles donker', 'Blackout', 'Tout éteindre', 'Alles dunkel')}</span></button>
    </section>`;
  }

  function studioHeader(draft, isRgbw = false) {
    const receivers = group?.receivers?.length || 0;
    const reachable = reachableCount();
    const live = !!draft.liveMode;
    const title = draft.name || (isRgbw ? `${group.name} · Studio` : tx('Eigen animatie', 'Custom animation', 'Animation personnalisée', 'Eigene Animation'));
    return `<header class="alv-studio-header">
      <div class="alv-studio-heading">
        <div class="eyebrow">${tx('LICHTSTUDIO', 'LIGHTING STUDIO', 'STUDIO LUMIÈRE', 'LICHTSTUDIO')}</div>
        <button class="alv-target" onclick="studioChooseGroup()"><span>${h(zone?.name || '')}</span><i>›</i><b>${h(group?.name || '')}</b><em>${tx('Wijzigen', 'Change', 'Changer', 'Ändern')}</em></button>
        <h1>${h(title)}</h1>
        <p>${isRgbw ? tx('Volledige LED Lines als lichtkanalen', 'Whole LED Lines as light channels', 'LED Lines complètes comme canaux', 'Ganze LED Lines als Lichtkanäle') : tx('Bouw licht met lagen, gebieden en cues', 'Build light with layers, areas and cues', 'Créez avec calques, zones et cues', 'Licht mit Ebenen, Bereichen und Cues bauen')}</p>
      </div>
      <div class="alv-studio-commands">
        ${!isRgbw ? `<button class="alv-command quiet" onclick="studioNewProject()" title="${tx('Nieuw ontwerp', 'New design', 'Nouveau projet', 'Neuer Entwurf')}"><i>＋</i><span>${tx('Nieuw', 'New', 'Nouveau', 'Neu')}</span></button>
        <button class="alv-command quiet" onclick="studioUndo()" ${db.studioUndo?.length ? '' : 'disabled'} title="Undo"><i>↶</i><span>${tx('Terug', 'Undo', 'Annuler', 'Zurück')}</span></button>
        <button class="alv-command quiet" onclick="studioRedo()" ${db.studioRedo?.length ? '' : 'disabled'} title="Redo"><i>↷</i><span>${tx('Opnieuw', 'Redo', 'Rétablir', 'Wiederholen')}</span></button>` : `<button class="alv-command quiet" onclick="studioConsoleRgbwUndo()" ${draft.undo?.length ? '' : 'disabled'}><i>↶</i><span>${tx('Terug', 'Undo', 'Annuler', 'Zurück')}</span></button>
        <button class="alv-command quiet" onclick="studioConsoleRgbwRedo()" ${draft.redo?.length ? '' : 'disabled'}><i>↷</i><span>${tx('Opnieuw', 'Redo', 'Rétablir', 'Wiederholen')}</span></button>`}
        <button class="alv-command live ${live ? 'on' : ''}" onclick="${isRgbw ? 'studioConsoleRgbwToggleLive()' : 'studioToggleLive()'}" ${receivers ? '' : 'disabled'}><i></i><span>${live ? tx('Live', 'Live', 'Live', 'Live') : tx('Preview', 'Preview', 'Aperçu', 'Vorschau')}</span></button>
        <button class="alv-command save" onclick="${isRgbw ? 'studioConsoleRgbwSave()' : 'saveStudioAnimation()'}"><i>◇</i><span>${tx('Bewaren', 'Save', 'Enregistrer', 'Speichern')}</span></button>
      </div>
      <div class="alv-studio-status">
        <span class="${reachable === receivers && receivers ? 'ok' : ''}"><i></i>${receivers ? `${reachable}/${receivers} ${tx('bereikbaar', 'reachable', 'joignables', 'erreichbar')}` : tx('Geen LED Line', 'No LED Line', 'Aucune LED Line', 'Keine LED Line')}</span>
        <span>${isRgbw ? `${receivers} ${tx('lichtkanalen', 'light channels', 'canaux lumière', 'Lichtkanäle')}` : `${physicalPixels()} pixels`}</span>
        <span>${live ? tx('Wijzigingen gaan direct live', 'Changes go live immediately', 'Modifications envoyées en direct', 'Änderungen sofort live') : tx('Veilig ontwerpen', 'Safe editing', 'Édition sécurisée', 'Sicher bearbeiten')}</span>
      </div>
    </header>`;
  }

  function mobileTabs(draft, isRgbw = false) {
    const tabs = isRgbw
      ? [['settings', '◐', tx('Look', 'Look', 'Look', 'Look')], ['layers', '≡', tx('Kanalen', 'Channels', 'Canaux', 'Kanäle')], ['timeline', '◇', 'Cues'], ['pixels', '◉', tx('Uitvoer', 'Output', 'Sortie', 'Ausgang')]]
      : [['settings', '◐', tx('Look', 'Look', 'Look', 'Look')], ['layers', '☰', tx('Lagen', 'Layers', 'Calques', 'Ebenen')], ['timeline', '◇', 'Cues'], ['pixels', '▦', tx('Uitvoer', 'Output', 'Sortie', 'Ausgang')]];
    return `<nav class="alv-studio-tabs" aria-label="Studio"><div>${tabs.map(([panel, icon, label]) => `<button class="${draft.mobilePanel === panel ? 'on' : ''}" onclick="${isRgbw ? `studioConsoleRgbwPanel('${panel}')` : `studioConsolePanel('${panel}')`}"><i>${icon}</i><span>${label}</span></button>`).join('')}</div></nav>`;
  }

  function inspectorTabs(draft, isRgbw = false) {
    const output = draft.inspectorTab !== 'look';
    return `<nav class="alv-inspector-tabs"><button class="${output ? '' : 'on'}" onclick="studioConsoleInspector('look',${isRgbw})"><i>◐</i><span>${tx('Look', 'Look', 'Look', 'Look')}</span></button><button class="${output ? 'on' : ''}" onclick="studioConsoleInspector('output',${isRgbw})"><i>▦</i><span>${isRgbw ? tx('Uitvoer', 'Output', 'Sortie', 'Ausgang') : tx('Gebied & uitvoer', 'Area & output', 'Zone & sortie', 'Bereich & Ausgang')}</span></button></nav>`;
  }

  function spiLayerList(draft) {
    return `<section class="alv-panel alv-layers" data-mobile="layers">
      <header><span><small>${tx('LICHTOPBOUW', 'LIGHT BUILD', 'CONSTRUCTION', 'LICHTAUFBAU')}</small><h2>${tx('Lagen', 'Layers', 'Calques', 'Ebenen')}</h2></span><em>${draft.layers.length}/12</em></header>
      <div class="alv-layer-list">${draft.layers.map((layer, index) => {
        const range = layerRange(draft, layer);
        return `<article class="alv-layer ${layer.id === draft.selectedLayer ? 'selected' : ''} ${layer.visible ? '' : 'muted'}">
          <button class="alv-layer-main" onclick="studioSelectLayer('${h(layer.id)}')"><i style="--swatch:${cssColor(layer)}"></i><span><b>${h(layer.name)}</b><small>${h(layer.animation)} · ${range.start}–${range.end}</small></span><em>${index + 1}</em></button>
          <div><button class="${layer.visible ? 'on' : ''}" aria-label="${tx('Zichtbaar', 'Visible', 'Visible', 'Sichtbar')}" aria-pressed="${layer.visible}" onclick="studioToggleLayer('${h(layer.id)}','visible')"><i>◉</i></button><button class="${layer.locked ? 'on' : ''}" aria-label="${tx('Vergrendeld', 'Locked', 'Verrouillé', 'Gesperrt')}" aria-pressed="${layer.locked}" onclick="studioToggleLayer('${h(layer.id)}','locked')"><i>${layer.locked ? '■' : '□'}</i></button></div>
        </article>`;
      }).join('')}</div>
      <button class="alv-add" onclick="studioAddLayerDialog()"><i>＋</i><span><b>${tx('Effectlaag toevoegen', 'Add effect layer', 'Ajouter un calque', 'Effektebene hinzufügen')}</b><small>${tx('Kleur, beweging of achtergrond', 'Colour, motion or background', 'Couleur, mouvement ou fond', 'Farbe, Bewegung oder Hintergrund')}</small></span></button>
      <div class="alv-order"><button onclick="studioMoveLayer(-1)">↑ ${tx('Omhoog', 'Up', 'Monter', 'Hoch')}</button><button onclick="studioMoveLayer(1)">↓ ${tx('Omlaag', 'Down', 'Descendre', 'Runter')}</button></div>
    </section>`;
  }

  function spiPreview(draft, compiled) {
    const range = layerRange(draft, selectedLayer(draft));
    return `<section class="alv-preview-card">
      <header><span class="alv-output-state ${draft.liveMode ? 'live' : ''}"><i></i>${draft.liveMode ? tx('LIVE OP LED LINES', 'LIVE ON LED LINES', 'LIVE SUR LED LINES', 'LIVE AUF LED LINES') : tx('LOKALE PREVIEW', 'LOCAL PREVIEW', 'APERÇU LOCAL', 'LOKALE VORSCHAU')}</span><span id="studioTimeLabel">${Number(draft.playhead).toFixed(2)}s / ${Number(draft.duration).toFixed(1)}s</span><div class="alv-view-switch"><button class="${draft.previewMode === 'receiver' ? 'on' : ''}" onclick="studioSetPreviewMode('receiver')">${tx('LED-uitvoer', 'LED output', 'Sortie LED', 'LED-Ausgang')}</button><button class="${draft.previewMode === 'design' ? 'on' : ''}" onclick="studioSetPreviewMode('design')">${tx('Ontwerp', 'Design', 'Projet', 'Entwurf')}</button></div></header>
      <div class="alv-canvas" style="--master:${draft.blackout ? 0 : draft.master}%;--blackout:${draft.blackout ? 1 : 0}"><canvas id="studioPreview" role="img" aria-label="${tx('Live voorbeeld van de animatie', 'Live animation preview', 'Aperçu de l’animation', 'Live-Vorschau der Animation')}"></canvas><span class="alv-preview-grid"></span>${draft.blackout ? `<strong>${tx('UITVOER DONKER', 'OUTPUT BLACKED OUT', 'SORTIE ÉTEINTE', 'AUSGANG DUNKEL')}</strong>` : ''}</div>
      <div class="alv-preview-tools"><div><button onclick="studioPlay('${draft.playing ? 'pause' : 'play'}')" aria-label="Play">${draft.playing ? 'Ⅱ' : '▶'}</button><button onclick="studioPlay('stop')" aria-label="Stop">■</button><button class="${draft.loop ? 'on' : ''}" onclick="studioToggleLoop()" aria-pressed="${draft.loop}">↻</button></div><span><b>${h(range.name)}</b><small>${range.start}–${range.end} · ${physicalPixels()} px</small></span></div>
      ${masterControl(draft, true)}
      <footer class="${compiled.exact ? 'exact' : ''}"><i>${compiled.exact ? '✓' : 'i'}</i><span><b>${draft.previewMode === 'receiver' ? tx('Dit is de echte LED-uitvoer', 'This is the real LED output', 'Ceci est la sortie LED réelle', 'Das ist der echte LED-Ausgang') : tx('Volledig ontwerp', 'Complete design', 'Projet complet', 'Vollständiger Entwurf')}</b><small>${h(compiled.exact ? tx('De preview en receiver gebruiken dezelfde instellingen.', 'Preview and receiver use the same settings.', 'L’aperçu et le récepteur utilisent les mêmes réglages.', 'Vorschau und Receiver nutzen dieselben Einstellungen.') : compiled.warnings.join(' '))}</small></span></footer>
    </section>`;
  }

  function effectOptions(layer) {
    return effects.map((effect, index) => `<option value="${index}" ${Number(layer.variant) === index ? 'selected' : ''}>${h(effect[0])} · ${h(effect[2])}</option>`).join('');
  }

  function spiLookPanel(draft) {
    const layer = selectedLayer(draft);
    const n = Math.max(1, physicalPixels());
    if (!layer) return '';
    return `<section class="alv-panel alv-inspector" data-mobile="settings" data-inspector="look">${inspectorTabs(draft)}
      <header><span><small>${tx('GESELECTEERDE LAAG', 'SELECTED LAYER', 'CALQUE SÉLECTIONNÉ', 'GEWÄHLTE EBENE')}</small><h2>${h(layer.name)}</h2></span><em>${draft.layers.indexOf(layer) + 1}/${draft.layers.length}</em></header>
      ${layer.locked ? `<div class="alv-locked"><i>■</i><span>${tx('Deze laag is vergrendeld', 'This layer is locked', 'Ce calque est verrouillé', 'Diese Ebene ist gesperrt')}</span><button onclick="studioToggleLayer('${h(layer.id)}','locked')">${tx('Ontgrendel', 'Unlock', 'Déverrouiller', 'Entsperren')}</button></div>` : ''}
      <div class="alv-look-primary">
        <label><span><b>${tx('Animatie', 'Animation', 'Animation', 'Animation')}</b>${compatibilityBadge('receiver')}</span><select ${layer.locked ? 'disabled' : ''} onchange="studioCheckpoint();studioConsoleEffect(this.value)">${effectOptions(layer)}</select></label>
        <button class="alv-effect-browser" ${layer.locked ? 'disabled' : ''} onclick="studioConsoleChooseEffect()"><i>✦</i><span><b>${tx('Visueel kiezen', 'Choose visually', 'Choisir visuellement', 'Visuell wählen')}</b><small>${tx('Bekijk alle animaties', 'Browse all animations', 'Voir toutes les animations', 'Alle Animationen ansehen')}</small></span><em>›</em></button>
        <button class="alv-colour-button" ${layer.locked ? 'disabled' : ''} onclick="openStudioColorWheel()"><i style="--swatch:${cssColor(layer)}"></i><span><b>${tx('Kleur en wit', 'Colour and white', 'Couleur et blanc', 'Farbe und Weiß')}</b><small>${h(String(layer.color || '#000000').toUpperCase())} · W ${Math.round(layer.white || 0)}</small></span><em>›</em></button>
      </div>
      <div class="alv-faders">
        ${fader('intensity', tx('Animatiehelderheid', 'Animation brightness', 'Luminosité', 'Animationshelligkeit'), layer.intensity, 100, '%', tx('Lichtsterkte van deze laag', 'Light output of this layer', 'Puissance de ce calque', 'Lichtstärke dieser Ebene'), 'brightness')}
        ${layer.engine !== 'STATIC' ? fader('speed', tx('Animatiesnelheid', 'Animation speed', 'Vitesse', 'Animationsgeschwindigkeit'), layer.speed, 100, '%', tx('Van heel traag en vloeiend tot snel', 'From very slow and smooth to fast', 'De très lent et fluide à rapide', 'Von sehr langsam und weich bis schnell'), 'speed') : ''}
        ${layer.engine !== 'STATIC' ? fader('widthPixels', tx('Animatiedikte', 'Effect width', 'Épaisseur', 'Effektbreite'), layer.widthPixels, n, ' px', tx('Exact aantal echte leds', 'Exact number of physical LEDs', 'Nombre exact de LED physiques', 'Exakte Anzahl echter LEDs'), 'width') : ''}
        ${layer.engine !== 'STATIC' ? `<label class="alv-fader" data-setting="smooth"><span class="alv-fader-head"><span><b>${tx('Vloeiendheid', 'Smoothness', 'Fluidité', 'Weichheit')}</b><small>${tx('Zachte overgangen, ook bij lage snelheid', 'Soft motion, even at low speed', 'Mouvement doux, même lent', 'Weiche Bewegung, auch langsam')}</small></span>${compatibilityBadge('receiver')}<output id="alv-smooth-out">${draft.smooth}%</output></span>${settingVisual('smooth', draft.smooth, 100, cssColor(layer))}<span class="alv-range-row"><input type="range" min="0" max="100" value="${draft.smooth}" onpointerdown="studioConsoleBeginEdit(this)" onfocus="studioConsoleBeginEdit(this)" onblur="studioConsoleEndEdit(this)" oninput="studioConsoleSmooth(this.value)"><input class="alv-number" type="number" min="0" max="100" value="${draft.smooth}" onchange="studioConsoleSmooth(this.value,true)"><em>%</em></span></label>` : ''}
      </div>
      ${layer.engine !== 'STATIC' ? `<section class="alv-direction"><header><span><b>${tx('Richting', 'Direction', 'Direction', 'Richtung')}</b><small>${tx('Begin van de beweging', 'Start of the movement', 'Début du mouvement', 'Start der Bewegung')}</small></span>${compatibilityBadge('receiver')}</header><div><button class="${layer.direction !== 'left' ? 'on' : ''}" onclick="studioCheckpoint();studioLayerSet('direction','right');studio()"><i>→</i><span>${tx('Naar rechts', 'To the right', 'Vers la droite', 'Nach rechts')}</span></button><button class="${layer.direction === 'left' ? 'on' : ''}" onclick="studioCheckpoint();studioLayerSet('direction','left');studio()"><i>←</i><span>${tx('Naar links', 'To the left', 'Vers la gauche', 'Nach links')}</span></button></div></section>` : ''}
      <details class="alv-advanced" ${draft.advanced ? 'open' : ''} ontoggle="studioConsoleAdvanced(this.open)"><summary><span><b>${tx('Geavanceerd', 'Advanced', 'Avancé', 'Erweitert')}</b><small>${tx('Naam, menging en laagbeheer', 'Name, blend and layer tools', 'Nom, fusion et outils', 'Name, Mischung und Werkzeuge')}</small></span><i>›</i></summary><div><label class="alv-text-field"><span>${tx('Naam van laag', 'Layer name', 'Nom du calque', 'Ebenenname')}</span><input value="${h(layer.name)}" ${layer.locked ? 'disabled' : ''} onfocus="studioConsoleBeginEdit(this)" onblur="studioConsoleEndEdit(this)" onchange="studioLayerSet('name',this.value);studio()"></label>${fader('opacity', tx('Overvloeiing', 'Blend', 'Fusion', 'Mischung'), layer.opacity, 100, '%', tx('Hoe sterk deze laag mengt', 'How strongly this layer blends', 'Force de fusion du calque', 'Stärke der Ebenenmischung'), 'blend', 'receiver')}<div class="alv-danger-actions"><button onclick="studioDuplicateLayer()">${tx('Dupliceren', 'Duplicate', 'Dupliquer', 'Duplizieren')}</button><button class="danger" onclick="studioRequestDeleteLayer()" ${draft.layers.length <= 1 ? 'disabled' : ''}>${tx('Verwijderen', 'Delete', 'Supprimer', 'Löschen')}</button></div></div></details>
    </section>`;
  }

  function pixelMap(draft, range, n) {
    const count = Math.max(12, Math.min(60, n));
    return `<div class="alv-pixel-map" aria-hidden="true">${Array.from({ length: count }, (_, index) => {
      const pixel = Math.floor(index * n / count) + 1;
      return `<i class="${pixel >= range.start && pixel <= range.end ? 'on' : ''}"></i>`;
    }).join('')}</div>`;
  }

  function physicalLineMap(currentGroup = group) {
    let offset = 0;
    const lines = currentGroup?.receivers || [];
    if (!lines.length) return `<div class="alv-empty-inline"><i>＋</i><span><b>${tx('Nog geen receiver', 'No receiver yet', 'Aucun récepteur', 'Noch kein Receiver')}</b><small>${tx('Voeg eerst een Receiver toe aan deze groep.', 'Add a receiver to this group first.', 'Ajoutez d’abord un récepteur.', 'Füge zuerst einen Receiver hinzu.')}</small></span></div>`;
    return `<div class="alv-physical-lines">${lines.map((line, index) => {
      const pixels = receiverType(currentGroup) === 'RGBW' ? 1 : Math.max(1, Math.round(Number(line.pixels) || 1));
      const start = offset + 1;
      offset += pixels;
      return `<span><i>${index + 1}</i><b>${tx('LED Line', 'LED Line', 'LED Line', 'LED Line')} ${index + 1}</b><small>${receiverType(currentGroup) === 'RGBW' ? tx('Volledige lijn', 'Whole line', 'Ligne complète', 'Ganze Linie') : `${start}–${offset} px`}</small><em class="${line.reversed ? 'reverse' : ''}">${line.reversed ? '←' : '→'}</em></span>`;
    }).join('')}</div>`;
  }

  function spiOutputPanel(draft) {
    const n = Math.max(1, physicalPixels());
    const layer = selectedLayer(draft);
    const range = draft.ranges?.[draft.selectedRange] || draft.ranges?.[0] || { name: 'LED Line', start: 1, end: n };
    return `<section class="alv-panel alv-output-panel" data-mobile="pixels" data-inspector="output">${inspectorTabs(draft)}
      <header><span><small>${tx('UITVOER EN GEBIED', 'OUTPUT AND AREA', 'SORTIE ET ZONE', 'AUSGANG UND BEREICH')}</small><h2>${tx('Waar werkt deze laag?', 'Where does this layer work?', 'Où agit ce calque ?', 'Wo wirkt diese Ebene?')}</h2></span>${compatibilityBadge('preview')}</header>
      <div class="alv-range-list">${draft.ranges.map((item, index) => `<button class="${index === draft.selectedRange ? 'on' : ''}" onclick="studioSelectRange(${index})"><b>${h(item.name)}</b><small>${item.start}–${item.end}</small></button>`).join('')}<button class="add" onclick="studioAddRange()"><b>＋</b><small>${tx('Nieuw', 'New', 'Nouveau', 'Neu')}</small></button></div>
      ${pixelMap(draft, range, n)}
      <div class="alv-range-fields"><label><span>${tx('Eerste pixel', 'First pixel', 'Premier pixel', 'Erster Pixel')}</span><input type="number" min="1" max="${n}" value="${range.start}" ${draft.selectedRange === 0 ? 'disabled' : ''} onchange="studioRangeSet('start',this.value)"></label><i>→</i><label><span>${tx('Laatste pixel', 'Last pixel', 'Dernier pixel', 'Letzter Pixel')}</span><input type="number" min="1" max="${n}" value="${range.end}" ${draft.selectedRange === 0 ? 'disabled' : ''} onchange="studioRangeSet('end',this.value)"></label></div>
      <div class="alv-range-quick"><button onclick="studioLogicalRange('${tx('Volledige LED Line', 'Complete LED Line', 'LED Line complète', 'Ganze LED Line')}',1,${n})">${tx('Alles', 'All', 'Tout', 'Alles')}</button><button onclick="studioLogicalRange('${tx('Links', 'Left', 'Gauche', 'Links')}',1,${Math.ceil(n / 2)})">${tx('Links', 'Left', 'Gauche', 'Links')}</button><button onclick="studioLogicalRange('${tx('Midden', 'Centre', 'Centre', 'Mitte')}',${Math.max(1, Math.ceil(n * .25))},${Math.max(1, Math.ceil(n * .75))})">${tx('Midden', 'Centre', 'Centre', 'Mitte')}</button><button onclick="studioLogicalRange('${tx('Rechts', 'Right', 'Droite', 'Rechts')}',${Math.max(1, Math.floor(n / 2) + 1)},${n})">${tx('Rechts', 'Right', 'Droite', 'Rechts')}</button></div>
      <button class="alv-primary-wide" onclick="studioAssignRange()">✓ ${tx('Gebruik voor', 'Use for', 'Utiliser pour', 'Verwenden für')} ${h(layer?.name || '')}</button>
      <p class="alv-honesty"><i>i</i><span><b>${tx('Gebieden zijn deel van het ontwerp', 'Areas are part of the design', 'Les zones font partie du projet', 'Bereiche sind Teil des Entwurfs')}</b><small>${tx('De huidige receiver speelt dezelfde animatie over de volledige LED Line. In Ontwerp zie je het exacte gebied.', 'The current receiver plays the same animation across the complete LED Line. Design shows the exact area.', 'Le récepteur joue la même animation sur toute la LED Line. Le projet montre la zone exacte.', 'Der Receiver spielt dieselbe Animation auf der ganzen LED Line. Der Entwurf zeigt den exakten Bereich.')}</small></span></p>
      <section class="alv-output-block"><header><span><b>${tx('Fysieke opstelling', 'Physical setup', 'Installation physique', 'Physischer Aufbau')}</b><small>${group.layout === 'parallel' ? tx('LED Lines onder elkaar', 'Stacked LED Lines', 'LED Lines superposées', 'LED Lines untereinander') : tx('Eén doorlopende LED Line', 'One continuous LED Line', 'Une LED Line continue', 'Eine fortlaufende LED Line')}</small></span><button onclick="go('zones');manageGroup()">${tx('Beheren', 'Manage', 'Gérer', 'Verwalten')}</button></header>${physicalLineMap()}</section>
      <section class="alv-output-block alv-output-safety"><header><span><b>${tx('Live uitvoer', 'Live output', 'Sortie live', 'Live-Ausgang')}</b><small>${draft.liveMode ? tx('Studio stuurt nu direct naar deze groep.', 'Studio is sending directly to this group.', 'Studio envoie directement à ce groupe.', 'Studio sendet direkt an diese Gruppe.') : tx('Alle wijzigingen blijven veilig in de preview.', 'All changes remain safely in preview.', 'Les modifications restent dans l’aperçu.', 'Alle Änderungen bleiben in der Vorschau.')}</small></span><button class="${draft.liveMode ? 'on' : ''}" onclick="studioToggleLive()" ${group.receivers?.length ? '' : 'disabled'}>${draft.liveMode ? tx('Live stoppen', 'Stop live', 'Arrêter', 'Live stoppen') : tx('Live inschakelen', 'Enable live', 'Activer', 'Live aktivieren')}</button></header>${masterControl(draft)}</section>
    </section>`;
  }

  function cueGroups(draft) {
    const groups = new Map();
    (draft.keyframes || []).forEach((key) => {
      const fixed = Number(key.time).toFixed(2);
      if (!groups.has(fixed)) groups.set(fixed, []);
      groups.get(fixed).push(key);
    });
    return [...groups.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));
  }

  function cueProperty(key) {
    const names = {
      intensity: tx('Helderheid', 'Brightness', 'Luminosité', 'Helligkeit'),
      opacity: tx('Menging', 'Blend', 'Fusion', 'Mischung'),
      speed: tx('Snelheid', 'Speed', 'Vitesse', 'Geschwindigkeit'),
      widthPixels: tx('Dikte', 'Width', 'Épaisseur', 'Breite')
    };
    return `${names[key.property] || key.property} ${Math.round(key.value)}${key.property === 'widthPixels' ? ' px' : '%'}`;
  }

  function spiTimeline(draft) {
    const cues = cueGroups(draft);
    const innerWidth = Math.round(720 * clamp(draft.zoom, .75, 4, 1));
    const ticks = Array.from({ length: 9 }, (_, index) => `<span style="left:${index * 12.5}%">${(draft.duration * index / 8).toFixed(draft.duration < 10 ? 1 : 0)}s</span>`).join('');
    return `<section class="alv-panel alv-timeline" data-mobile="timeline">
      <header><span><small>${tx('LICHTVERLOOP', 'LIGHT SEQUENCE', 'SÉQUENCE LUMIÈRE', 'LICHTABLAUF')}</small><h2>Cues</h2><p>${tx('Laat instellingen op exacte momenten veranderen', 'Change settings at exact moments', 'Modifiez les réglages à des moments précis', 'Einstellungen zu genauen Zeitpunkten ändern')}</p></span><em>${compatibilityBadge('live')}</em></header>
      <div class="alv-timeline-tools"><span><button class="primary" onclick="studioPlay('${draft.playing ? 'pause' : 'play'}')">${draft.playing ? 'Ⅱ' : '▶'} <b>${draft.playing ? tx('Pauze', 'Pause', 'Pause', 'Pause') : tx('Afspelen', 'Play', 'Lecture', 'Abspielen')}</b></button><button onclick="studioPlay('stop')">■</button><button class="${draft.loop ? 'on' : ''}" onclick="studioToggleLoop()">↻</button><button onclick="studioOpenAddKeyframe()">＋ <b>${tx('Cuepunt', 'Cue point', 'Point cue', 'Cue-Punkt')}</b></button></span><span><label>${tx('Duur', 'Duration', 'Durée', 'Dauer')}<input type="number" min="1" max="120" step=".5" value="${draft.duration}" onchange="studioSetDuration(this.value)"></label><button onclick="studioZoom(-.25)">−</button><em>${Number(draft.zoom).toFixed(2)}×</em><button onclick="studioZoom(.25)">＋</button><button onclick="studioFitTimeline()">${tx('Passend', 'Fit', 'Ajuster', 'Einpassen')}</button></span></div>
      <input id="studioScrub" class="alv-scrub" type="range" min="0" max="${draft.duration}" step=".01" value="${draft.playhead}" oninput="studioScrub(this.value)">
      <div class="alv-cue-list">${cues.length ? cues.map(([time, keys], index) => `<article><button class="alv-cue-time" onclick="studioConsoleGoCue(${time})"><i>${index + 1}</i><span><b>${Number(time).toFixed(2)} s</b><small>${keys.length} ${keys.length === 1 ? tx('wijziging', 'change', 'modification', 'Änderung') : tx('wijzigingen', 'changes', 'modifications', 'Änderungen')}</small></span></button><div>${keys.map((key) => `<button onclick="studioKeyframeMenu('${h(key.id)}')"><b>${h(draft.layers.find((item) => item.id === key.layerId)?.name || '')}</b><small>${h(cueProperty(key))} · ${h(key.easing || '')}</small><em>›</em></button>`).join('')}</div></article>`).join('') : `<div class="alv-empty-inline"><i>◇</i><span><b>${tx('Nog geen cuepunten', 'No cue points yet', 'Aucun point cue', 'Noch keine Cue-Punkte')}</b><small>${tx('Zet de tijd op een moment en voeg daar een wijziging toe.', 'Move to a moment and add a change there.', 'Placez le temps puis ajoutez une modification.', 'Zeitpunkt wählen und dort eine Änderung hinzufügen.')}</small></span></div>`}</div>
      <div class="alv-timeline-scroll"><div class="alv-timeline-inner" style="min-width:${innerWidth}px"><div class="alv-ruler">${ticks}</div>${draft.layers.map((layer) => `<div class="alv-track"><button onclick="studioSelectLayer('${h(layer.id)}')"><i style="--track:${cssColor(layer)}"></i><span>${h(layer.name)}</span></button><div>${(draft.keyframes || []).filter((key) => key.layerId === layer.id).map((key) => `<button class="alv-key" style="left:${clamp(key.time / draft.duration * 100, 0, 100, 0)}%" onclick="studioKeyframeMenu('${h(key.id)}')" aria-label="${h(cueProperty(key))}"></button>`).join('')}<span class="studio-playhead-v186 playhead" style="left:${clamp(draft.playhead / draft.duration * 100, 0, 100, 0)}%"></span></div></div>`).join('')}</div></div>
      <p class="alv-honesty compact"><i>i</i><span><b>${tx('Cues spelen live via deze app', 'Cues play live through this app', 'Les cues sont jouées via cette app', 'Cues laufen live über diese App')}</b><small>${tx('De basisanimatie blijft zelfstandig op de receiver draaien.', 'The base animation keeps running independently on the receiver.', 'L’animation de base continue sur le récepteur.', 'Die Basisanimation läuft selbstständig auf dem Receiver.')}</small></span></p>
    </section>`;
  }

  function renderSpi(root) {
    const draft = ensureSpiDraft(getSpiDraft());
    if (!draft) return;
    const compiled = window.compileStudioDraft(draft, group, draft.playhead);
    root.innerHTML = `<div class="alv-studio" data-mobile-panel="${draft.mobilePanel}" data-inspector-tab="${draft.inspectorTab}">${studioHeader(draft)}<main class="alv-studio-grid">${spiPreview(draft, compiled)}${mobileTabs(draft)}${spiLayerList(draft)}${spiLookPanel(draft)}${spiOutputPanel(draft)}${spiTimeline(draft)}</main></div>`;
    requestAnimationFrame(() => {
      const canvas = document.getElementById('studioPreview');
      if (canvas) canvas.style.filter = `brightness(${draft.blackout ? 0 : draft.master}%)`;
    });
  }

  function emptyStudio(root) {
    root.innerHTML = `<section class="alv-studio-empty"><i>◇</i><div class="eyebrow">${tx('LICHTSTUDIO', 'LIGHTING STUDIO', 'STUDIO LUMIÈRE', 'LICHTSTUDIO')}</div><h1>${tx('Kies eerst een groep', 'Choose a group first', 'Choisissez d’abord un groupe', 'Wähle zuerst eine Gruppe')}</h1><p>${tx('Daarna bouw je eenvoudig een look met lagen en cues.', 'Then build a look with layers and cues.', 'Créez ensuite un look avec des calques et des cues.', 'Danach baust du einen Look mit Ebenen und Cues.')}</p><button onclick="go('zones')">${tx('Naar Zones', 'Go to Zones', 'Aller aux zones', 'Zu Zonen')} →</button></section>`;
  }

  window.compileStudioDraft = function compileStudioConsoleDraft(draft, currentGroup, time = draft?.playhead || 0) {
    const result = baseCompileStudioDraft(draft, currentGroup, time);
    if (!draft || !result?.state) return result;
    const master = clamp(draft.master, 0, 100, 100);
    const factor = draft.blackout ? 0 : master / 100;
    result.state.brightness = Math.round(clamp(result.state.brightness, 0, 100, 0) * factor);
    result.state.bgBrightness = Math.round(clamp(result.state.bgBrightness, 0, 100, 0) * factor);
    result.state.smooth = Math.round(clamp(draft.smooth, 0, 100, clamp(result.state.smooth, 0, 100, 90)));
    result.state.studioMaster = master;
    result.state.studioBlackout = !!draft.blackout;
    return result;
  };

  window.studioLayerEffect = function studioConsoleLayerEffect(index) {
    const draft = getSpiDraft();
    const layer = selectedLayer(draft);
    const layerId = layer?.id;
    const previous = effects[Number(layer?.variant)] || effects.find((item) => item[1] === layer?.engine);
    const automaticName = !!layer && (layer.name === layer.animation || layer.name === previous?.[0]);
    const next = effects[Math.round(clamp(index, 0, effects.length - 1, 0))];
    const result = baseStudioLayerEffect(index);
    const currentLayer = getSpiDraft()?.layers?.find((item) => item.id === layerId);
    if (automaticName && currentLayer && next) {
      currentLayer.name = next[0];
      currentLayer.animation = next[0];
      persistSoon();
      window.studio();
    }
    return result;
  };

  window.studio = function studioConsoleRender(...args) {
    const result = baseStudio(...args);
    const root = document.getElementById('studio');
    if (!root) return result;
    if (!group) {
      emptyStudio(root);
      return result;
    }
    if (receiverType() === 'RGBW') renderRgbw(root);
    else renderSpi(root);
    return result;
  };

  window.studioConsolePanel = function studioConsolePanel(panel) {
    const draft = getSpiDraft();
    if (!draft || !['settings', 'layers', 'timeline', 'pixels'].includes(panel)) return;
    draft.mobilePanel = panel;
    persistSoon();
    window.studio();
    requestAnimationFrame(() => document.querySelector(`.alv-studio [data-mobile="${panel}"]`)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));
  };

  window.studioConsoleInspector = function studioConsoleInspector(tab, rgbw = false) {
    const draft = rgbw ? getRgbwDraft() : getSpiDraft();
    if (!draft) return;
    draft.inspectorTab = tab === 'look' ? 'look' : 'output';
    if (rgbw) rgbwPersist(draft);
    else persistSoon();
    window.studio();
  };

  window.studioConsoleBeginEdit = function studioConsoleBeginEdit(input) {
    if (!input || input.dataset.studioTransaction === '1') return;
    input.dataset.studioTransaction = '1';
    if (receiverType() === 'RGBW') rgbwCheckpoint();
    else window.studioCheckpoint?.();
  };

  window.studioConsoleEndEdit = function studioConsoleEndEdit(input) {
    if (input) delete input.dataset.studioTransaction;
  };

  window.studioConsoleLayerValue = function studioConsoleLayerValue(key, value, unit, rerender = false) {
    const draft = getSpiDraft();
    const layer = selectedLayer(draft);
    if (!draft || !layer) return;
    const maximum = key === 'widthPixels' ? Math.max(1, physicalPixels()) : 100;
    const minimum = key === 'widthPixels' ? 1 : 0;
    const next = Math.round(clamp(value, minimum, maximum, layer[key]));
    document.querySelectorAll(`[data-setting="${key}"] input`).forEach((input) => { input.value = next; });
    const output = document.getElementById(`alv-${key}-out`);
    if (output) output.textContent = `${next}${unit}`;
    window.studioLayerSet(key, next);
    if (rerender) requestAnimationFrame(() => window.studio());
  };

  window.studioConsoleEffect = function studioConsoleEffect(index) {
    window.studioLayerEffect(Number(index));
  };

  window.studioConsoleSmooth = function studioConsoleSmooth(value, rerender = false) {
    const draft = getSpiDraft();
    if (!draft) return;
    draft.smooth = Math.round(clamp(value, 0, 100, draft.smooth));
    const output = document.getElementById('alv-smooth-out');
    if (output) output.textContent = `${draft.smooth}%`;
    document.querySelectorAll('[data-setting="smooth"] input').forEach((input) => { input.value = draft.smooth; });
    studioConsolePushSpiLive();
    if (rerender) requestAnimationFrame(() => window.studio());
  };

  function studioConsolePushSpiLive() {
    const draft = getSpiDraft();
    const layer = selectedLayer(draft);
    persistSoon();
    if (!draft?.liveMode || !layer) return;
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => window.studioLayerSet('intensity', layer.intensity), 34);
  }

  window.studioConsoleMaster = function studioConsoleMaster(value) {
    const draft = getSpiDraft();
    if (!draft) return;
    draft.master = Math.round(clamp(value, 0, 100, draft.master));
    document.querySelectorAll('.alv-master-output').forEach((output) => { output.textContent = `${draft.master}%`; });
    document.querySelectorAll('.alv-master input[type="range"]').forEach((input) => { input.value = draft.master; });
    document.querySelectorAll('.alv-master').forEach((node) => node.style.setProperty('--master', `${draft.blackout ? 0 : draft.master}%`));
    const canvas = document.getElementById('studioPreview');
    if (canvas) canvas.style.filter = `brightness(${draft.blackout ? 0 : draft.master}%)`;
    studioConsolePushSpiLive();
  };

  window.studioConsoleBlackout = function studioConsoleBlackout() {
    const draft = getSpiDraft();
    if (!draft) return;
    window.studioCheckpoint?.();
    draft.blackout = !draft.blackout;
    studioConsolePushSpiLive();
    window.studio();
  };

  window.studioConsoleAdvanced = function studioConsoleAdvanced(open) {
    const draft = getSpiDraft();
    if (!draft) return;
    draft.advanced = !!open;
    persistSoon();
  };

  window.studioConsoleGoCue = function studioConsoleGoCue(time) {
    window.studioScrub(Number(time));
    window.studio();
  };

  window.studioSelectRange = function studioConsoleSelectRange(index) {
    const draft = getSpiDraft();
    if (!draft?.ranges?.length) return;
    draft.selectedRange = Math.round(clamp(index, 0, draft.ranges.length - 1, 0));
    draft.mobilePanel = 'pixels';
    persistSoon();
    window.studio();
  };

  window.studioAddRange = function studioConsoleAddRange() {
    const draft = getSpiDraft();
    if (!draft) return;
    window.studioCheckpoint?.();
    draft.ranges.push({ id: uid('range-'), name: tx('Nieuw gebied', 'New area', 'Nouvelle zone', 'Neuer Bereich'), start: 1, end: Math.max(1, physicalPixels()) });
    draft.selectedRange = draft.ranges.length - 1;
    draft.mobilePanel = 'pixels';
    persistSoon();
    window.studio();
  };

  window.studioLogicalRange = function studioConsoleLogicalRange(name, start, end) {
    const draft = getSpiDraft();
    if (!draft) return;
    const n = Math.max(1, physicalPixels());
    if (draft.selectedRange === 0 && Number(start) === 1 && Number(end) === n) {
      persistSoon();
      window.studio();
      return;
    }
    window.studioCheckpoint?.();
    if (draft.selectedRange === 0) {
      draft.ranges.push({ id: uid('range-'), name: tx('Nieuw gebied', 'New area', 'Nouvelle zone', 'Neuer Bereich'), start: 1, end: Math.max(1, physicalPixels()) });
      draft.selectedRange = draft.ranges.length - 1;
    }
    const range = draft.ranges[draft.selectedRange];
    range.name = String(name).slice(0, 44);
    range.start = Math.round(clamp(start, 1, n, 1));
    range.end = Math.round(clamp(end, 1, n, n));
    if (range.start > range.end) [range.start, range.end] = [range.end, range.start];
    persistSoon();
    window.studio();
  };

  window.studioScrub = function studioConsoleScrub(value) {
    const draft = getSpiDraft();
    if (!draft) return;
    draft.playing = false;
    draft.playhead = clamp(value, 0, draft.duration, 0);
    document.querySelectorAll('.studio-playhead-v186').forEach((item) => { item.style.left = `${draft.playhead / draft.duration * 100}%`; });
    const label = document.getElementById('studioTimeLabel');
    if (label) label.textContent = `${draft.playhead.toFixed(2)}s / ${Number(draft.duration).toFixed(1)}s`;
    persistSoon();
    if (draft.liveMode) studioConsolePushSpiLive();
  };

  window.studioConsoleChooseEffect = function studioConsoleChooseEffect() {
    const layer = selectedLayer();
    if (!layer) return;
    const staticEffects = effects.map((effect, index) => ({ effect, index })).filter(({ effect }) => effect[1] === 'STATIC');
    const moving = effects.map((effect, index) => ({ effect, index })).filter(({ effect }) => effect[1] !== 'STATIC');
    const card = ({ effect, index }) => `<button class="alv-effect-choice ${Number(layer.variant) === index ? 'on' : ''}" data-studio-effect="${h((effect[0] + ' ' + effect[2]).toLowerCase())}" data-engine="${h(effect[1])}" onclick="studioConsolePickEffect(${index})"><canvas class="effect-mini alv-effect-mini" data-index="${index}" data-engine="${h(effect[1])}" aria-label="${h(effect[0])}"></canvas><span><b>${h(effect[0])}</b><small>${h(effect[2])}</small></span><em>${Number(layer.variant) === index ? '✓' : '›'}</em></button>`;
    modal(`<div class="alv-effect-modal"><button class="button soft" onclick="closeModal()">← ${tx('Studio', 'Studio', 'Studio', 'Studio')}</button><div class="eyebrow">${tx('ANIMATIE KIEZEN', 'CHOOSE ANIMATION', 'CHOISIR UNE ANIMATION', 'ANIMATION WÄHLEN')}</div><h1>${tx('Wat wil je laten bewegen?', 'What should move?', 'Que voulez-vous animer ?', 'Was soll sich bewegen?')}</h1><input class="field" type="search" placeholder="${tx('Zoek op naam', 'Search by name', 'Rechercher par nom', 'Nach Name suchen')}" oninput="studioConsoleFilterEffects(this.value)"><section><h2>${tx('Vaste kleur', 'Solid colour', 'Couleur fixe', 'Feste Farbe')}</h2><div class="alv-effect-grid">${staticEffects.map(card).join('')}</div></section><section><h2>${tx('Animaties', 'Animations', 'Animations', 'Animationen')}</h2><div class="alv-effect-grid">${moving.map(card).join('')}</div></section></div>`);
  };

  window.studioConsoleFilterEffects = function studioConsoleFilterEffects(query) {
    const value = String(query || '').trim().toLowerCase();
    document.querySelectorAll('#modalBody [data-studio-effect]').forEach((button) => { button.hidden = !!value && !button.dataset.studioEffect.includes(value); });
  };

  window.studioConsolePickEffect = function studioConsolePickEffect(index) {
    window.studioCheckpoint?.();
    window.studioLayerEffect(index);
    closeModal();
    go('studio');
  };

  window.studioAddLayerDialog = function studioConsoleAddLayerDialog() {
    const draft = getSpiDraft();
    if (!draft || draft.layers.length >= 12) return toast(tx('Maximaal 12 lagen per ontwerp.', 'Maximum 12 layers per design.', 'Maximum 12 calques par projet.', 'Maximal 12 Ebenen pro Entwurf.'));
    const original = draft.selectedLayer;
    window.studioConsoleChooseEffect();
    const title = document.querySelector('#modalBody .alv-effect-modal h1');
    if (title) title.textContent = tx('Welke laag wil je toevoegen?', 'Which layer do you want to add?', 'Quel calque voulez-vous ajouter ?', 'Welche Ebene möchtest du hinzufügen?');
    document.querySelectorAll('#modalBody [data-studio-effect]').forEach((button) => {
      const index = Number((button.getAttribute('onclick') || '').match(/\((\d+)\)/)?.[1]);
      button.setAttribute('onclick', `studioConsoleAddEffectLayer(${Number.isFinite(index) ? index : 0},'${h(original)}')`);
    });
  };

  window.studioConsoleAddEffectLayer = function studioConsoleAddEffectLayer(index) {
    if (typeof window.confirmStudioLayer === 'function') window.confirmStudioLayer(Number(index));
  };

  /* RGBW Studio: whole LED Lines are channels. Cues store complete looks. */
  function rgbwEffectByName(name, source = group?.state) {
    return RGBW_EFFECTS.find((item) => item.name === name)
      || RGBW_EFFECTS.find((item) => item.engine === source?.engine && Number(item.variant) === Number(source?.variant))
      || RGBW_EFFECTS[0];
  }

  function normaliseRgbwState(source = {}) {
    const sourceEffect = rgbwEffectByName(source?.animation, source);
    const seeded = sourceEffect ? {
      ...source,
      animation: sourceEffect.name,
      engine: sourceEffect.engine,
      variant: sourceEffect.variant
    } : source;
    const state = typeof sharedRgbwRuntime.defaultState === 'function'
      ? clone(sharedRgbwRuntime.defaultState(seeded || {}))
      : clone(seeded || {});
    const effect = rgbwEffectByName(state.animation, state);
    state.animation = effect.name;
    state.engine = effect.engine;
    state.variant = effect.variant;
    state.receiverType = 'RGBW';
    state.colors = Array.isArray(state.colors) ? state.colors.slice(0, 4) : ['#ffffff'];
    state.whiteChannels = Array.isArray(state.whiteChannels) ? state.whiteChannels.slice(0, 4) : [255];
    state.rgbEnabled = Array.isArray(state.rgbEnabled) ? state.rgbEnabled.slice(0, 4) : [false];
    state.whiteEnabled = Array.isArray(state.whiteEnabled) ? state.whiteEnabled.slice(0, 4) : [true];
    const defaults = ['#ffffff', '#873ada', '#42c7a2', '#f0a43c'];
    while (state.colors.length < 4) state.colors.push(defaults[state.colors.length]);
    while (state.whiteChannels.length < 4) state.whiteChannels.push(0);
    while (state.rgbEnabled.length < 4) state.rgbEnabled.push(true);
    while (state.whiteEnabled.length < 4) state.whiteEnabled.push(false);
    state.colorCount = effect.variable ? Math.round(clamp(state.colorCount, 1, 4, effect.colors)) : effect.colors;
    state.speed = clamp(state.speed, 0, 100, 18);
    state.smooth = clamp(state.smooth, 0, 100, 92);
    state.brightness = clamp(state.brightness, 0, 100, 100);
    state.spread = clamp(state.spread, 0, 100, 45);
    state.lineDelayMs = Math.round(clamp(state.lineDelayMs, 0, 5080, effect.defaults?.lineDelayMs ?? 240) / 40) * 40;
    state.direction = state.direction === 'left' ? 'left' : 'right';
    return state;
  }

  function getRgbwDraft() {
    db.studioRgbwDrafts = db.studioRgbwDrafts && typeof db.studioRgbwDrafts === 'object' ? db.studioRgbwDrafts : {};
    let draft = db.studioRgbwDrafts[group.id];
    if (!draft) {
      draft = { version: 1, groupId: group.id, name: `${group.name} · Studio`, state: normaliseRgbwState(group.state), master: 100, blackout: false, liveMode: false, playing: false, mobilePanel: innerWidth <= 720 ? 'settings' : 'layers', cues: [], selectedCue: null, undo: [], redo: [], updatedAt: Date.now(), sessionId };
      db.studioRgbwDrafts[group.id] = draft;
    }
    draft.state = normaliseRgbwState(draft.state);
    draft.master = clamp(draft.master, 0, 100, 100);
    draft.blackout = !!draft.blackout;
    draft.inspectorTab = draft.inspectorTab === 'output' ? 'output' : 'look';
    draft.cues = Array.isArray(draft.cues) ? draft.cues : [];
    draft.undo = Array.isArray(draft.undo) ? draft.undo.slice(-30) : [];
    draft.redo = Array.isArray(draft.redo) ? draft.redo.slice(-30) : [];
    if (draft.sessionId !== sessionId) {
      draft.sessionId = sessionId;
      draft.liveMode = false;
      draft.playing = false;
    }
    return draft;
  }

  function rgbwCheckpoint() {
    const draft = getRgbwDraft();
    draft.undo.push({ state: clone(draft.state), cues: clone(draft.cues), master: draft.master, blackout: draft.blackout });
    draft.undo = draft.undo.slice(-30);
    draft.redo = [];
  }

  function rgbwPersist(draft = getRgbwDraft()) {
    draft.updatedAt = Date.now();
    persistSoon();
  }

  function rgbwManualChange(draft = getRgbwDraft()) {
    draft.playing = false;
    delete draft.previewState;
    delete draft.previewMaster;
    delete draft.previewBlackout;
    const runtime = rgbwRuntime.get(group?.id);
    if (runtime) {
      delete runtime.pausedElapsed;
      runtime.index = 0;
      runtime.started = 0;
    }
  }

  function rgbwLiveState(draft = getRgbwDraft(), source = draft.state) {
    const state = normaliseRgbwState(source);
    const factor = draft.blackout ? 0 : draft.master / 100;
    state.brightness = Math.round(state.brightness * factor);
    state.studioMaster = draft.master;
    state.studioBlackout = !!draft.blackout;
    return state;
  }

  function pushRgbwLive(immediate = false, source = null) {
    const draft = getRgbwDraft();
    rgbwPersist(draft);
    if (!draft.liveMode || !group) return;
    clearTimeout(liveTimer);
    const send = () => {
      group.state = rgbwLiveState(draft, source || draft.state);
      save('queued');
      queueLive(group);
    };
    if (immediate) send();
    else liveTimer = setTimeout(send, 40);
  }

  function rgbwDescription(effect) {
    const description = effect?.description;
    if (typeof description === 'string') return description;
    const language = String(db?.language || 'nl').slice(0, 2).toLowerCase();
    return description?.[language] || description?.nl || effect?.name || '';
  }

  function rgbwPalette(draft) {
    const effect = rgbwEffectByName(draft.state.animation);
    const count = draft.state.colorCount;
    return `<section class="alv-rgbw-colours"><header><span><b>${tx('Kleuren', 'Colours', 'Couleurs', 'Farben')}</b><small>${tx('Iedere LED Line blijft volledig egaal', 'Every LED Line remains completely even', 'Chaque LED Line reste uniforme', 'Jede LED Line bleibt gleichmäßig')}</small></span>${effect.variable ? `<select onchange="studioConsoleRgbwColorCount(this.value)">${[1, 2, 3, 4].map((number) => `<option value="${number}" ${number === count ? 'selected' : ''}>${number} ${number === 1 ? tx('kleur', 'colour', 'couleur', 'Farbe') : tx('kleuren', 'colours', 'couleurs', 'Farben')}</option>`).join('')}</select>` : ''}</header><div>${Array.from({ length: count }, (_, index) => {
      const color = warmPreview(draft.state.colors[index], draft.state.whiteChannels[index], draft.state.rgbEnabled[index] !== false, draft.state.whiteEnabled[index] !== false);
      return `<article><label><input type="color" value="${h(draft.state.colors[index])}" onfocus="studioConsoleRgbwBegin(this)" onblur="studioConsoleRgbwEnd(this)" oninput="studioConsoleRgbwColor(${index},this.value)"><i style="--swatch:rgb(${color.join(',')})"></i><span><b>${tx('Kleur', 'Colour', 'Couleur', 'Farbe')} ${index + 1}</b><small>${h(String(draft.state.colors[index]).toUpperCase())}</small></span></label><div><button class="${draft.state.rgbEnabled[index] !== false ? 'on' : ''}" onclick="studioConsoleRgbwToggleChannel(${index},'rgb')">RGB</button><button class="${draft.state.whiteEnabled[index] !== false ? 'on' : ''}" onclick="studioConsoleRgbwToggleChannel(${index},'white')">W</button><input aria-label="W" type="range" min="0" max="255" value="${draft.state.whiteChannels[index]}" onpointerdown="studioConsoleRgbwBegin(this)" onfocus="studioConsoleRgbwBegin(this)" onblur="studioConsoleRgbwEnd(this)" oninput="studioConsoleRgbwWhite(${index},this.value)"><output>${Math.round(draft.state.whiteChannels[index])}</output></div></article>`;
    }).join('')}</div></section>`;
  }

  function rgbwLookPanel(draft) {
    const effect = rgbwEffectByName(draft.state.animation);
    const multiple = (group.receivers?.length || 0) > 1;
    const settings = new Set(effect.settings || []);
    const speed = effect.engine !== 'STATIC' && (!effect.settings || settings.has('speed'));
    const smooth = effect.engine !== 'STATIC' && (!effect.settings || settings.has('smooth'));
    const staticEffect = RGBW_EFFECTS.find((item) => item.engine === 'STATIC');
    const animated = RGBW_EFFECTS.filter((item) => item.engine !== 'STATIC' && (!item.line || multiple));
    const staticChoice = staticEffect ? `<button class="alv-rgbw-static ${effect.engine === 'STATIC' ? 'on' : ''}" onclick="studioConsoleRgbwEffect('${h(staticEffect.name)}')"><span class="alv-rgbw-mini static"><i></i><i></i><i></i></span><span><small>${tx('VASTE KLEUR', 'SOLID COLOUR', 'COULEUR FIXE', 'FESTE FARBE')}</small><b>${h(staticEffect.name)}</b></span><em>${effect.engine === 'STATIC' ? '✓' : '›'}</em></button>` : '';
    return `<section class="alv-panel alv-inspector alv-rgbw-look" data-mobile="settings" data-inspector="look">${inspectorTabs(draft, true)}<header><span><small>RGBW · ${tx('VOLLEDIGE LIJN', 'WHOLE LINE', 'LIGNE COMPLÈTE', 'GANZE LINIE')}</small><h2>${h(effect.name)}</h2></span>${compatibilityBadge('receiver')}</header>${staticChoice}<div class="alv-rgbw-effects">${animated.map((item) => `<button class="${item.name === effect.name ? 'on' : ''}" onclick="studioConsoleRgbwEffect('${h(item.name)}')"><span class="alv-rgbw-mini ${h(item.engine.toLowerCase())}"><i></i><i></i><i></i></span><i>${item.icon}</i><span><b>${h(item.name)}</b><small>${h(rgbwDescription(item))}</small></span></button>`).join('')}</div>${rgbwPalette(draft)}<div class="alv-faders">${speed ? rgbwFader('speed', tx('Snelheid', 'Speed', 'Vitesse', 'Geschwindigkeit'), draft.state.speed, tx('Van heel traag tot snel', 'From very slow to fast', 'De très lent à rapide', 'Von sehr langsam bis schnell'), 'speed') : ''}${smooth ? rgbwFader('smooth', effect.engine === 'SPARKLE' ? tx('Flitsduur', 'Flash duration', 'Durée du flash', 'Blitzdauer') : tx('Vloeiendheid', 'Smoothness', 'Fluidité', 'Weichheit'), draft.state.smooth, tx('Zachte, continue overgang', 'Soft continuous transition', 'Transition douce et continue', 'Weicher, durchgehender Übergang'), 'smooth') : ''}${rgbwFader('brightness', tx('Animatiehelderheid', 'Animation brightness', 'Luminosité', 'Animationshelligkeit'), draft.state.brightness, tx('Lichtsterkte van deze look', 'Light output of this look', 'Puissance de ce look', 'Lichtstärke dieses Looks'), 'brightness')}${effect.line && multiple ? rgbwFader('lineDelayMs', tx('Timing tussen LED Lines', 'Timing between LED Lines', 'Timing entre les LED Lines', 'Timing zwischen LED Lines'), draft.state.lineDelayMs, tx('Exacte wachttijd van lijn 1 naar 2, 3, enz.', 'Exact delay from line 1 to 2, 3, and so on', 'Délai exact de la ligne 1 vers 2, 3, etc.', 'Exakte Verzögerung von Linie 1 zu 2, 3 usw.'), 'width', 5080, ' ms', 40) : ''}</div>${effect.line && multiple ? `<section class="alv-direction"><header><span><b>${tx('Volgorde', 'Order', 'Ordre', 'Reihenfolge')}</b><small>${tx('Welke lijn start eerst?', 'Which line starts first?', 'Quelle ligne commence ?', 'Welche Linie startet?')}</small></span></header><div><button class="${draft.state.direction !== 'left' ? 'on' : ''}" onclick="studioConsoleRgbwDirection('right')"><i>1 → ${group.receivers.length}</i><span>${tx('Vooruit', 'Forward', 'Avant', 'Vorwärts')}</span></button><button class="${draft.state.direction === 'left' ? 'on' : ''}" onclick="studioConsoleRgbwDirection('left')"><i>${group.receivers.length} → 1</i><span>${tx('Terug', 'Reverse', 'Retour', 'Zurück')}</span></button></div></section>` : ''}</section>`;
  }

  function rgbwFader(key, label, value, help, kind, maximum = 100, unit = '%', step = 1) {
    return `<label class="alv-fader" data-rgbw-setting="${key}"><span class="alv-fader-head"><span><b>${h(label)}</b><small>${h(help)}</small></span>${compatibilityBadge('receiver')}<output>${Math.round(value)}${h(unit)}</output></span>${settingVisual(kind, value, maximum, '#fff1db')}<span class="alv-range-row"><input type="range" min="0" max="${maximum}" step="${step}" value="${Math.round(value)}" onpointerdown="studioConsoleRgbwBegin(this)" onfocus="studioConsoleRgbwBegin(this)" onblur="studioConsoleRgbwEnd(this)" oninput="studioConsoleRgbwValue('${key}',this.value)"><input class="alv-number" type="number" min="0" max="${maximum}" step="${step}" value="${Math.round(value)}" onfocus="studioConsoleRgbwBegin(this)" onblur="studioConsoleRgbwEnd(this)" onchange="studioConsoleRgbwValue('${key}',this.value,true)"><em>${h(unit.trim())}</em></span></label>`;
  }

  function rgbwChannels(draft) {
    const lines = group.receivers || [];
    return `<section class="alv-panel alv-layers alv-rgbw-channels" data-mobile="layers"><header><span><small>${tx('LICHTKANALEN', 'LIGHT CHANNELS', 'CANAUX LUMIÈRE', 'LICHTKANÄLE')}</small><h2>LED Lines</h2></span><em>${lines.length}</em></header>${physicalLineMap()}<div class="alv-rgbw-routing"><span><i></i><b>${tx('Zelfde look', 'Same look', 'Même look', 'Gleicher Look')}</b><small>${tx('Iedere lijn krijgt dezelfde kleur en animatie.', 'Every line gets the same colour and animation.', 'Chaque ligne reçoit la même animation.', 'Jede Linie erhält dieselbe Animation.')}</small></span><span><i></i><b>${tx('Fase per lijn', 'Phase per line', 'Phase par ligne', 'Phase pro Linie')}</b><small>${tx('Bij lijnanimaties start iedere volgende lijn later.', 'For line effects each next line starts later.', 'Pour les effets de ligne, chaque ligne démarre plus tard.', 'Bei Linieneffekten startet jede nächste Linie später.')}</small></span></div><button class="alv-primary-wide" onclick="go('zones');manageGroup()">${tx('Volgorde en LED Lines beheren', 'Manage order and LED Lines', 'Gérer l’ordre et les LED Lines', 'Reihenfolge und LED Lines verwalten')}</button></section>`;
  }

  function rgbwPreview(draft) {
    return `<section class="alv-preview-card alv-rgbw-preview"><header><span class="alv-output-state ${draft.liveMode ? 'live' : ''}"><i></i>${draft.liveMode ? tx('LIVE OP LED LINES', 'LIVE ON LED LINES', 'LIVE SUR LED LINES', 'LIVE AUF LED LINES') : tx('LOKALE PREVIEW', 'LOCAL PREVIEW', 'APERÇU LOCAL', 'LOKALE VORSCHAU')}</span><span>${h(rgbwEffectByName(draft.state.animation).name)}</span><div class="alv-view-switch"><button class="on">RGBW</button><button>${group.layout === 'parallel' ? tx('Onder elkaar', 'Stacked', 'Superposées', 'Untereinander') : tx('Na elkaar', 'In sequence', 'En séquence', 'Nacheinander')}</button></div></header><div class="alv-canvas" style="--master:${draft.blackout ? 0 : draft.master}%"><canvas id="alvStudioRgbwPreview" role="img" aria-label="RGBW Studio"></canvas>${draft.blackout ? `<strong>${tx('UITVOER DONKER', 'OUTPUT BLACKED OUT', 'SORTIE ÉTEINTE', 'AUSGANG DUNKEL')}</strong>` : ''}</div><div class="alv-preview-tools"><div><button onclick="studioConsoleRgbwPlay('${draft.playing ? 'pause' : 'play'}')">${draft.playing ? 'Ⅱ' : '▶'}</button><button onclick="studioConsoleRgbwPlay('stop')">■</button><button class="${draft.loop !== false ? 'on' : ''}" onclick="studioConsoleRgbwLoop()">↻</button></div><span><b>${group.receivers?.length || 0} LED Lines</b><small>${tx('Iedere lijn is één kanaal', 'Each line is one channel', 'Chaque ligne est un canal', 'Jede Linie ist ein Kanal')}</small></span></div>${masterControl(draft, true)}<footer class="exact"><i>✓</i><span><b>${tx('Egaal RGBW-licht', 'Even RGBW light', 'Lumière RGBW uniforme', 'Gleichmäßiges RGBW-Licht')}</b><small>${tx('Geen pixelbeweging: de volledige LED Line fadet of pulst samen.', 'No pixel motion: the complete LED Line fades or pulses together.', 'Aucun mouvement de pixel : toute la LED Line varie ensemble.', 'Keine Pixelbewegung: die ganze LED Line fadet oder pulsiert gemeinsam.')}</small></span></footer></section>`;
  }

  function rgbwCuePanel(draft) {
    return `<section class="alv-panel alv-timeline alv-rgbw-cues" data-mobile="timeline"><header><span><small>${tx('LICHTVERLOOP', 'LIGHT SEQUENCE', 'SÉQUENCE LUMIÈRE', 'LICHTABLAUF')}</small><h2>Cues</h2><p>${tx('Bewaar volledige looks en speel ze na elkaar', 'Save complete looks and play them in sequence', 'Enregistrez des looks et jouez-les en séquence', 'Ganze Looks speichern und nacheinander abspielen')}</p></span>${compatibilityBadge('live')}</header><div class="alv-cue-actions"><button class="primary" onclick="studioConsoleRgbwAddCue()">＋ ${tx('Huidige look als cue', 'Current look as cue', 'Look actuel comme cue', 'Aktuellen Look als Cue')}</button><button onclick="studioConsoleRgbwPlay('${draft.playing ? 'pause' : 'play'}')">${draft.playing ? 'Ⅱ' : '▶'} ${draft.playing ? tx('Pauze', 'Pause', 'Pause', 'Pause') : tx('Afspelen', 'Play', 'Lecture', 'Abspielen')}</button><button onclick="studioConsoleRgbwPlay('stop')">■</button></div><div class="alv-rgbw-cue-list">${draft.cues.length ? draft.cues.map((cue, index) => `<article class="${cue.id === draft.selectedCue ? 'on' : ''}"><button class="alv-rgbw-cue-main" onclick="studioConsoleRgbwApplyCue('${h(cue.id)}')"><i>${index + 1}</i><span><b>${h(cue.name || `Cue ${index + 1}`)}</b><small>${h(cue.state.animation)} · ${Number(cue.fade ?? 1).toFixed(1)}s ${tx('fade', 'fade', 'fondu', 'Fade')} · ${Number(cue.hold ?? 2).toFixed(1)}s</small></span><em>▶</em></button><div><label>${tx('Fade', 'Fade', 'Fondu', 'Fade')}<input type="number" min="0" max="30" step=".1" value="${Number(cue.fade ?? 0)}" onfocus="studioConsoleRgbwBegin(this)" onblur="studioConsoleRgbwEnd(this)" onchange="studioConsoleRgbwCueTime('${h(cue.id)}','fade',this.value)"></label><label>${tx('Wachten', 'Hold', 'Attente', 'Halten')}<input type="number" min=".1" max="120" step=".1" value="${Number(cue.hold ?? 2)}" onfocus="studioConsoleRgbwBegin(this)" onblur="studioConsoleRgbwEnd(this)" onchange="studioConsoleRgbwCueTime('${h(cue.id)}','hold',this.value)"></label><button onclick="studioConsoleRgbwMoveCue('${h(cue.id)}',-1)">↑</button><button onclick="studioConsoleRgbwMoveCue('${h(cue.id)}',1)">↓</button><button class="danger" onclick="studioConsoleRgbwDeleteCue('${h(cue.id)}')">×</button></div></article>`).join('') : `<div class="alv-empty-inline"><i>◇</i><span><b>${tx('Nog geen cues', 'No cues yet', 'Aucune cue', 'Noch keine Cues')}</b><small>${tx('Maak eerst een look en bewaar die met de knop hierboven.', 'Create a look and save it with the button above.', 'Créez un look puis enregistrez-le ci-dessus.', 'Erstelle einen Look und speichere ihn oben.')}</small></span></div>`}</div><p class="alv-honesty compact"><i>i</i><span><b>${tx('Cue-afspeellijst gebruikt deze app', 'Cue playback uses this app', 'La lecture des cues utilise cette app', 'Cue-Wiedergabe nutzt diese App')}</b><small>${tx('De actieve basisanimatie blijft zelfstandig op de receiver draaien.', 'The active base animation remains autonomous on the receiver.', 'L’animation active reste autonome sur le récepteur.', 'Die aktive Basisanimation bleibt autonom auf dem Receiver.')}</small></span></p></section>`;
  }

  function rgbwOutputPanel(draft) {
    return `<section class="alv-panel alv-output-panel alv-rgbw-output" data-mobile="pixels" data-inspector="output">${inspectorTabs(draft, true)}<header><span><small>${tx('LIVE UITVOER', 'LIVE OUTPUT', 'SORTIE LIVE', 'LIVE-AUSGANG')}</small><h2>${tx('Naar de installatie', 'To the installation', 'Vers l’installation', 'Zur Installation')}</h2></span><em>${reachableCount()}/${group.receivers?.length || 0}</em></header><div class="alv-output-meter"><span><i style="width:${draft.blackout ? 0 : draft.master}%"></i></span><b>${draft.blackout ? '0' : draft.master}%</b></div>${masterControl(draft)}<button class="alv-live-wide ${draft.liveMode ? 'on' : ''}" onclick="studioConsoleRgbwToggleLive()" ${group.receivers?.length ? '' : 'disabled'}><i></i><span><b>${draft.liveMode ? tx('Live stoppen', 'Stop live', 'Arrêter le live', 'Live stoppen') : tx('Live inschakelen', 'Enable live', 'Activer le live', 'Live aktivieren')}</b><small>${draft.liveMode ? tx('De laatste look blijft zichtbaar.', 'The last look remains visible.', 'Le dernier look reste visible.', 'Der letzte Look bleibt sichtbar.') : tx('Daarna gaat iedere wijziging direct naar de LED Lines.', 'Then every change goes directly to the LED Lines.', 'Chaque modification ira ensuite aux LED Lines.', 'Danach geht jede Änderung direkt zu den LED Lines.')}</small></span></button>${physicalLineMap()}</section>`;
  }

  function renderRgbw(root) {
    const draft = getRgbwDraft();
    root.innerHTML = `<div class="alv-studio alv-studio-rgbw" data-mobile-panel="${draft.mobilePanel}" data-inspector-tab="${draft.inspectorTab}">${studioHeader(draft, true)}<main class="alv-studio-grid">${rgbwPreview(draft)}${mobileTabs(draft, true)}${rgbwChannels(draft)}${rgbwLookPanel(draft)}${rgbwOutputPanel(draft)}${rgbwCuePanel(draft)}</main></div>`;
    startRgbwPreview();
  }

  window.studioConsoleRgbwPanel = function studioConsoleRgbwPanel(panel) {
    const draft = getRgbwDraft();
    draft.mobilePanel = panel;
    rgbwPersist(draft);
    window.studio();
    requestAnimationFrame(() => document.querySelector(`.alv-studio [data-mobile="${panel}"]`)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }));
  };

  window.studioConsoleRgbwBegin = function studioConsoleRgbwBegin(input) {
    if (input?.dataset.studioTransaction === '1') return;
    if (input) input.dataset.studioTransaction = '1';
    rgbwCheckpoint();
  };

  window.studioConsoleRgbwEnd = function studioConsoleRgbwEnd(input) {
    if (input) delete input.dataset.studioTransaction;
  };

  window.studioConsoleRgbwEffect = function studioConsoleRgbwEffect(name) {
    const draft = getRgbwDraft();
    const effect = rgbwEffectByName(name);
    if (effect.line && (group.receivers?.length || 0) < 2) return toast(tx('Deze animatie heeft minstens 2 LED Lines nodig.', 'This animation needs at least 2 LED Lines.', 'Cette animation nécessite au moins 2 LED Lines.', 'Diese Animation braucht mindestens 2 LED Lines.'));
    rgbwCheckpoint();
    rgbwManualChange(draft);
    const defaults = typeof sharedRgbwRuntime.defaults === 'function'
      ? sharedRgbwRuntime.defaults(effect)
      : (effect.defaults || {});
    ['speed', 'smooth', 'spread', 'lineDelayMs', 'direction'].forEach((key) => {
      if (defaults[key] != null) draft.state[key] = defaults[key];
    });
    Object.assign(draft.state, { animation: effect.name, engine: effect.engine, variant: effect.variant, colorCount: effect.variable ? Math.max(effect.colors, draft.state.colorCount || effect.colors) : effect.colors, previewStartedAt: performance.now() / 1000, restartToken: Number(draft.state.restartToken || 0) + 1 });
    if (effect.engine === 'SPARKLE') draft.state.smooth = 18;
    pushRgbwLive(true);
    window.studio();
  };

  window.studioConsoleRgbwValue = function studioConsoleRgbwValue(key, value, rerender = false) {
    const draft = getRgbwDraft();
    rgbwManualChange(draft);
    const maximum = key === 'lineDelayMs' ? 5080 : 100;
    const step = key === 'lineDelayMs' ? 40 : 1;
    draft.state[key] = Math.round(clamp(value, 0, maximum, draft.state[key]) / step) * step;
    const unit = key === 'lineDelayMs' ? ' ms' : '%';
    document.querySelectorAll(`[data-rgbw-setting="${key}"] input`).forEach((input) => { input.value = draft.state[key]; });
    document.querySelectorAll(`[data-rgbw-setting="${key}"] output`).forEach((output) => { output.textContent = `${Math.round(draft.state[key])}${unit}`; });
    document.querySelectorAll(`[data-rgbw-setting="${key}"] .alv-fader-demo`).forEach((demo) => {
      const level = clamp(draft.state[key] / maximum * 100, 0, 100, 0);
      demo.style.setProperty('--level', `${level}%`);
      demo.style.setProperty('--motion', `${Math.max(.8, 7 - level * .055)}s`);
    });
    pushRgbwLive();
    if (rerender) requestAnimationFrame(() => window.studio());
  };

  window.studioConsoleRgbwColor = function studioConsoleRgbwColor(index, value) {
    const draft = getRgbwDraft();
    if (!/^#[0-9a-f]{6}$/i.test(String(value))) return;
    rgbwManualChange(draft);
    draft.state.colors[index] = value;
    draft.state.rgbEnabled[index] = true;
    const article = document.querySelectorAll('.alv-rgbw-colours article')[index];
    const colour = warmPreview(value, draft.state.whiteChannels[index], true, draft.state.whiteEnabled[index] !== false);
    article?.querySelector('label i')?.style.setProperty('--swatch', `rgb(${colour.join(',')})`);
    const copy = article?.querySelector('label small');
    if (copy) copy.textContent = value.toUpperCase();
    article?.querySelector('button:first-child')?.classList.add('on');
    pushRgbwLive();
  };

  window.studioConsoleRgbwWhite = function studioConsoleRgbwWhite(index, value) {
    const draft = getRgbwDraft();
    rgbwManualChange(draft);
    draft.state.whiteChannels[index] = Math.round(clamp(value, 0, 255, 0));
    if (draft.state.whiteChannels[index] > 0) draft.state.whiteEnabled[index] = true;
    const article = document.querySelectorAll('.alv-rgbw-colours article')[index];
    const output = article?.querySelector('output');
    if (output) output.textContent = draft.state.whiteChannels[index];
    const colour = warmPreview(draft.state.colors[index], draft.state.whiteChannels[index], draft.state.rgbEnabled[index] !== false, draft.state.whiteEnabled[index] !== false);
    article?.querySelector('label i')?.style.setProperty('--swatch', `rgb(${colour.join(',')})`);
    article?.querySelector('button:nth-child(2)')?.classList.toggle('on', draft.state.whiteEnabled[index] !== false);
    pushRgbwLive();
  };

  window.studioConsoleRgbwToggleChannel = function studioConsoleRgbwToggleChannel(index, channel) {
    const draft = getRgbwDraft();
    rgbwCheckpoint();
    rgbwManualChange(draft);
    if (channel === 'rgb') draft.state.rgbEnabled[index] = draft.state.rgbEnabled[index] === false;
    else {
      draft.state.whiteEnabled[index] = draft.state.whiteEnabled[index] === false;
      if (draft.state.whiteEnabled[index] && !draft.state.whiteChannels[index]) draft.state.whiteChannels[index] = 255;
    }
    pushRgbwLive(true);
    window.studio();
  };

  window.studioConsoleRgbwColorCount = function studioConsoleRgbwColorCount(value) {
    const draft = getRgbwDraft();
    rgbwCheckpoint();
    rgbwManualChange(draft);
    draft.state.colorCount = Math.round(clamp(value, 1, 4, 1));
    pushRgbwLive(true);
    window.studio();
  };

  window.studioConsoleRgbwDirection = function studioConsoleRgbwDirection(value) {
    const draft = getRgbwDraft();
    rgbwCheckpoint();
    rgbwManualChange(draft);
    draft.state.direction = value === 'left' ? 'left' : 'right';
    draft.state.previewStartedAt = performance.now() / 1000;
    pushRgbwLive(true);
    window.studio();
  };

  window.studioConsoleRgbwToggleLive = function studioConsoleRgbwToggleLive() {
    const draft = getRgbwDraft();
    if (draft.liveMode) {
      draft.liveMode = false;
      draft.playing = false;
      rgbwPersist(draft);
      window.studio();
      return toast(tx('Live gestopt. De laatste look blijft zichtbaar.', 'Live stopped. The last look remains visible.', 'Live arrêté. Le dernier look reste visible.', 'Live gestoppt. Der letzte Look bleibt sichtbar.'));
    }
    if (!group.receivers?.length) return toast(tx('Voeg eerst een Receiver toe.', 'Add a receiver first.', 'Ajoutez d’abord un récepteur.', 'Füge zuerst einen Receiver hinzu.'));
    modal(`<div class="eyebrow">${tx('LIVE INSCHAKELEN', 'ENABLE LIVE', 'ACTIVER LE LIVE', 'LIVE AKTIVIEREN')}</div><h1>${h(group.name)}</h1><p class="sub">${tx('Vanaf nu gaan wijzigingen en cues onmiddellijk naar alle LED Lines van deze groep.', 'Changes and cues will now go directly to every LED Line in this group.', 'Les modifications et cues iront directement aux LED Lines de ce groupe.', 'Änderungen und Cues gehen ab jetzt direkt an alle LED Lines dieser Gruppe.')}</p><div class="row"><button class="button soft" onclick="closeModal()">${tx('Annuleren', 'Cancel', 'Annuler', 'Abbrechen')}</button><button class="button" onclick="studioConsoleRgbwConfirmLive()">${tx('Live op deze groep', 'Live on this group', 'Live sur ce groupe', 'Live auf dieser Gruppe')}</button></div>`);
  };

  window.studioConsoleRgbwConfirmLive = function studioConsoleRgbwConfirmLive() {
    const draft = getRgbwDraft();
    draft.liveMode = true;
    pushRgbwLive(true);
    closeModal();
    window.studio();
  };

  window.studioConsoleRgbwUndo = function studioConsoleRgbwUndo() {
    const draft = getRgbwDraft();
    const previous = draft.undo.pop();
    if (!previous) return;
    draft.redo.push({ state: clone(draft.state), cues: clone(draft.cues), master: draft.master, blackout: draft.blackout });
    Object.assign(draft, clone(previous), { liveMode: draft.liveMode, playing: false, sessionId });
    delete draft.previewState;
    delete draft.previewMaster;
    delete draft.previewBlackout;
    pushRgbwLive(true);
    window.studio();
  };

  window.studioConsoleRgbwRedo = function studioConsoleRgbwRedo() {
    const draft = getRgbwDraft();
    const next = draft.redo.pop();
    if (!next) return;
    draft.undo.push({ state: clone(draft.state), cues: clone(draft.cues), master: draft.master, blackout: draft.blackout });
    Object.assign(draft, clone(next), { liveMode: draft.liveMode, playing: false, sessionId });
    delete draft.previewState;
    delete draft.previewMaster;
    delete draft.previewBlackout;
    pushRgbwLive(true);
    window.studio();
  };

  window.studioConsoleRgbwAddCue = function studioConsoleRgbwAddCue() {
    const draft = getRgbwDraft();
    rgbwCheckpoint();
    const cue = { id: uid('cue-'), name: `Cue ${draft.cues.length + 1}`, state: clone(draft.state), master: draft.master, blackout: draft.blackout, fade: 1, hold: 2 };
    draft.cues.push(cue);
    draft.selectedCue = cue.id;
    rgbwPersist(draft);
    window.studio();
  };

  window.studioConsoleRgbwApplyCue = function studioConsoleRgbwApplyCue(id) {
    const draft = getRgbwDraft();
    const cue = draft.cues.find((item) => item.id === id);
    if (!cue) return;
    rgbwCheckpoint();
    draft.state = normaliseRgbwState(clone(cue.state));
    rgbwManualChange(draft);
    draft.master = clamp(cue.master, 0, 100, draft.master);
    draft.blackout = !!cue.blackout;
    draft.selectedCue = id;
    pushRgbwLive(true);
    window.studio();
  };

  window.studioConsoleRgbwCueTime = function studioConsoleRgbwCueTime(id, key, value) {
    const draft = getRgbwDraft();
    const cue = draft.cues.find((item) => item.id === id);
    if (!cue) return;
    cue[key] = clamp(value, key === 'fade' ? 0 : .1, key === 'fade' ? 30 : 120, cue[key]);
    rgbwPersist(draft);
    requestAnimationFrame(() => window.studio());
  };

  window.studioConsoleRgbwMoveCue = function studioConsoleRgbwMoveCue(id, delta) {
    const draft = getRgbwDraft();
    const index = draft.cues.findIndex((item) => item.id === id);
    const next = index + Number(delta);
    if (index < 0 || next < 0 || next >= draft.cues.length) return;
    rgbwCheckpoint();
    [draft.cues[index], draft.cues[next]] = [draft.cues[next], draft.cues[index]];
    rgbwPersist(draft);
    window.studio();
  };

  window.studioConsoleRgbwDeleteCue = function studioConsoleRgbwDeleteCue(id) {
    const draft = getRgbwDraft();
    rgbwCheckpoint();
    draft.cues = draft.cues.filter((item) => item.id !== id);
    if (draft.selectedCue === id) draft.selectedCue = null;
    rgbwPersist(draft);
    window.studio();
  };

  window.studioConsoleRgbwLoop = function studioConsoleRgbwLoop() {
    const draft = getRgbwDraft();
    draft.loop = draft.loop === false;
    rgbwPersist(draft);
    window.studio();
  };

  window.studioConsoleRgbwPlay = function studioConsoleRgbwPlay(mode) {
    const draft = getRgbwDraft();
    const runtime = rgbwRuntime.get(group.id) || {};
    if (mode === 'stop') {
      draft.playing = false;
      delete draft.previewState;
      delete draft.previewMaster;
      delete draft.previewBlackout;
      runtime.index = 0;
      runtime.started = 0;
      delete runtime.pausedElapsed;
    } else if (mode === 'pause') {
      draft.playing = false;
      runtime.pausedElapsed = Math.max(0, performance.now() - (runtime.started || performance.now()));
    }
    else {
      if (!draft.cues.length) return toast(tx('Voeg eerst minstens één cue toe.', 'Add at least one cue first.', 'Ajoutez d’abord une cue.', 'Füge zuerst einen Cue hinzu.'));
      draft.playing = true;
      runtime.index = clamp(runtime.index, 0, draft.cues.length - 1, 0);
      if (Number.isFinite(runtime.pausedElapsed)) {
        runtime.started = performance.now() - runtime.pausedElapsed;
        delete runtime.pausedElapsed;
      } else {
        runtime.started = performance.now();
        runtime.from = clone(draft.state);
        runtime.fromMaster = draft.master;
        runtime.fromBlackout = draft.blackout;
      }
    }
    rgbwRuntime.set(group.id, runtime);
    rgbwPersist(draft);
    window.studio();
  };

  function interpolateHex(a, b, amount) {
    const parse = (value) => /^#[0-9a-f]{6}$/i.test(value) ? [0, 2, 4].map((start) => parseInt(value.slice(1 + start, 3 + start), 16)) : [0, 0, 0];
    const one = parse(a), two = parse(b);
    return `#${one.map((value, index) => Math.round(value + (two[index] - value) * amount).toString(16).padStart(2, '0')).join('')}`;
  }

  function interpolateRgbwState(from, to, amount) {
    const result = normaliseRgbwState(clone(to));
    ['speed', 'smooth', 'brightness', 'spread'].forEach((key) => { result[key] = Number(from[key] || 0) + (Number(to[key] || 0) - Number(from[key] || 0)) * amount; });
    result.colors = result.colors.map((color, index) => interpolateHex(from.colors?.[index] || color, color, amount));
    result.whiteChannels = result.whiteChannels.map((value, index) => Number(from.whiteChannels?.[index] || 0) + (value - Number(from.whiteChannels?.[index] || 0)) * amount);
    return result;
  }

  function advanceRgbwCues(now) {
    if (receiverType() !== 'RGBW' || !group) return;
    const draft = getRgbwDraft();
    if (!draft.playing || !draft.cues.length) return;
    const runtime = rgbwRuntime.get(group.id) || { index: 0, started: now, from: clone(draft.state), lastSend: 0 };
    const cue = draft.cues[runtime.index] || draft.cues[0];
    const elapsed = (now - (runtime.started || now)) / 1000;
    const fade = clamp(cue.fade, 0, 30, 1);
    const hold = clamp(cue.hold, .1, 120, 2);
    const amount = fade <= 0 ? 1 : clamp(elapsed / fade, 0, 1, 1);
    const shown = interpolateRgbwState(runtime.from || draft.state, cue.state, amount * amount * (3 - 2 * amount));
    const eased = amount * amount * (3 - 2 * amount);
    draft.previewState = shown;
    draft.previewMaster = Number(runtime.fromMaster ?? draft.master) + (Number(cue.master ?? 100) - Number(runtime.fromMaster ?? draft.master)) * eased;
    draft.previewBlackout = eased >= 1 ? !!cue.blackout : !!runtime.fromBlackout;
    draft.selectedCue = cue.id;
    if (draft.liveMode && now - (runtime.lastSend || 0) > 85) {
      runtime.lastSend = now;
      group.state = rgbwLiveState({ ...draft, master: draft.previewMaster, blackout: draft.previewBlackout }, shown);
      queueLive(group);
    }
    if (elapsed >= fade + hold) {
      draft.state = normaliseRgbwState(clone(cue.state));
      draft.master = clamp(cue.master, 0, 100, draft.master);
      draft.blackout = !!cue.blackout;
      runtime.from = clone(draft.state);
      runtime.fromMaster = draft.master;
      runtime.fromBlackout = draft.blackout;
      runtime.index += 1;
      runtime.started = now;
      if (runtime.index >= draft.cues.length) {
        if (draft.loop === false) {
          draft.playing = false;
          runtime.index = draft.cues.length - 1;
        } else runtime.index = 0;
      }
    }
    rgbwRuntime.set(group.id, runtime);
  }

  function rgbwSample(state, effect, lineIndex, lineCount, seconds) {
    const speed = clamp(state.speed, 0, 100, 18) / 100;
    const cycle = effect.engine === 'SPARKLE' ? .5 + speed * speed * 11.5 : .03 + speed * speed * 1.45;
    let phase = (seconds * cycle) % 1;
    if (state.direction === 'left') phase = (1 - phase) % 1;
    const offset = effect.line ? lineIndex / Math.max(1, lineCount - 1) * clamp(state.spread, 0, 100, 45) / 100 : 0;
    const local = (phase - offset + 4) % 1;
    let amount = 1;
    if (effect.engine === 'BREATHE') amount = effect.variant === 1 ? Math.pow(1 - Math.abs(2 * phase - 1), 2) : .1 + .9 * (.5 - .5 * Math.cos(phase * Math.PI * 2));
    else if (effect.engine === 'SPARKLE') amount = phase < .05 + state.smooth / 450 ? 1 : .03;
    else if (effect.engine === 'SEQUENCE' || effect.engine === 'WAVE') amount = .1 + .9 * (.5 - .5 * Math.cos(local * Math.PI * 2));
    else if (effect.engine === 'CASCADE') amount = Math.max(.05, Math.sin(local * Math.PI));
    else if (effect.engine === 'CHASE') amount = Math.max(.03, 1 - Math.min(local, 1 - local) / (.08 + state.smooth / 300));
    const count = Math.max(1, Math.min(4, state.colorCount || effect.colors));
    const colorPosition = (effect.engine === 'GRADIENT' || effect.engine === 'FLOW' || effect.line ? local : phase) * count;
    const first = Math.floor(colorPosition) % count;
    const next = (first + 1) % count;
    const mix = colorPosition - Math.floor(colorPosition);
    const colorA = warmPreview(state.colors[first], state.whiteChannels[first], state.rgbEnabled[first] !== false, state.whiteEnabled[first] !== false);
    const colorB = warmPreview(state.colors[next], state.whiteChannels[next], state.rgbEnabled[next] !== false, state.whiteEnabled[next] !== false);
    return { color: colorA.map((value, index) => Math.round(value + (colorB[index] - value) * mix)), amount: amount * clamp(state.brightness, 0, 100, 100) / 100 };
  }

  function paintRgbwPreview(canvas, draft, now) {
    if (!canvas?.isConnected) return;
    const box = canvas.getBoundingClientRect();
    if (box.width < 2 || box.height < 2) return;
    const ratio = devicePixelRatio || 1;
    if (canvas.width !== Math.round(box.width * ratio) || canvas.height !== Math.round(box.height * ratio)) {
      canvas.width = Math.round(box.width * ratio);
      canvas.height = Math.round(box.height * ratio);
    }
    const context = canvas.getContext('2d');
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, box.width, box.height);
    const background = context.createLinearGradient(0, 0, box.width, box.height);
    background.addColorStop(0, '#121413');
    background.addColorStop(1, '#080909');
    context.fillStyle = background;
    context.fillRect(0, 0, box.width, box.height);
    const state = draft.previewState || draft.state;
    const effect = rgbwEffectByName(state.animation);
    const lineCount = Math.max(1, group.receivers?.length || 1);
    const stacked = group.layout === 'parallel';
    const gap = 8;
    for (let index = 0; index < lineCount; index += 1) {
      const sample = typeof sharedRgbwRuntime.previewSample === 'function'
        ? sharedRgbwRuntime.previewSample({ ...state, lineDelayMs: state.lineDelayMs }, index, lineCount, now / 1000)
        : rgbwSample(state, effect, index, lineCount, now / 1000);
      const css = `rgb(${sample.color.join(',')})`;
      const x = stacked ? 34 : 18 + index * ((box.width - 36 + gap) / lineCount);
      const y = stacked ? 18 + index * ((box.height - 36 + gap) / lineCount) : box.height * .37;
      const width = stacked ? box.width - 50 : (box.width - 36 + gap) / lineCount - gap;
      const height = stacked ? (box.height - 36 + gap) / lineCount - gap : box.height * .26;
      const previewMaster = Number(draft.previewMaster ?? draft.master);
      const previewBlackout = draft.previewBlackout ?? draft.blackout;
      context.globalAlpha = clamp(sample.amount * (previewBlackout ? 0 : previewMaster / 100), 0, 1, 0);
      context.fillStyle = css;
      context.shadowColor = css;
      context.shadowBlur = 10 + 18 * sample.amount;
      context.beginPath();
      context.roundRect(x, y, Math.max(4, width), Math.max(5, height), Math.min(10, height / 2));
      context.fill();
      context.globalAlpha = 1;
      context.shadowBlur = 0;
      context.fillStyle = '#b8bab5';
      context.font = '800 9px system-ui';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      if (stacked) context.fillText(String(index + 1), 17, y + height / 2);
    }
    context.globalAlpha = 1;
  }

  function startRgbwPreview() {
    cancelAnimationFrame(rgbwFrame);
    const loop = (now) => {
      if (receiverType() !== 'RGBW') return;
      advanceRgbwCues(now);
      const draft = getRgbwDraft();
      paintRgbwPreview(document.getElementById('alvStudioRgbwPreview'), draft, now);
      rgbwFrame = requestAnimationFrame(loop);
    };
    rgbwFrame = requestAnimationFrame(loop);
  }

  window.studioConsoleRgbwMaster = function studioConsoleRgbwMaster(value) {
    const draft = getRgbwDraft();
    draft.master = Math.round(clamp(value, 0, 100, draft.master));
    pushRgbwLive();
    document.querySelectorAll('.alv-master-output').forEach((output) => { output.textContent = `${draft.master}%`; });
    document.querySelectorAll('.alv-master input[type="range"]').forEach((input) => { input.value = draft.master; });
    document.querySelectorAll('.alv-master').forEach((node) => node.style.setProperty('--master', `${draft.blackout ? 0 : draft.master}%`));
  };

  window.studioConsoleRgbwBlackout = function studioConsoleRgbwBlackout() {
    const draft = getRgbwDraft();
    rgbwCheckpoint();
    draft.blackout = !draft.blackout;
    pushRgbwLive(true);
    window.studio();
  };

  window.studioConsoleRgbwSave = function studioConsoleRgbwSave() {
    const draft = getRgbwDraft();
    const existing = db.presets.find((item) => item.id === draft.sourcePresetId && item.customRgbwStudio);
    modal(`<div class="eyebrow">${tx('STUDIO-PRESET BEWAREN', 'SAVE STUDIO PRESET', 'ENREGISTRER LE PRESET', 'STUDIO-PRESET SPEICHERN')}</div><h1>${existing ? tx('Preset bijwerken', 'Update preset', 'Mettre à jour', 'Preset aktualisieren') : tx('Nieuw lichtrecept', 'New light recipe', 'Nouvelle recette lumière', 'Neues Lichtrezept')}</h1><label class="studio-field-label">${tx('Naam', 'Name', 'Nom', 'Name')}<input id="alvRgbwPresetName" class="field" maxlength="80" value="${h(draft.name)}"></label><div class="alv-preset-summary"><span><b>${h(draft.state.animation)}</b><small>${draft.state.colorCount} ${tx('kleuren', 'colours', 'couleurs', 'Farben')}</small></span><span><b>${draft.cues.length} cues</b><small>${group.receivers?.length || 0} LED Lines</small></span></div><div class="row"><button class="button soft" onclick="closeModal()">${tx('Annuleren', 'Cancel', 'Annuler', 'Abbrechen')}</button>${existing ? `<button class="button soft" onclick="studioConsoleRgbwConfirmSave(true)">${tx('Als kopie', 'Save as copy', 'Comme copie', 'Als Kopie')}</button>` : ''}<button class="button" onclick="studioConsoleRgbwConfirmSave(false)">${existing ? tx('Preset bijwerken', 'Update preset', 'Mettre à jour', 'Aktualisieren') : tx('Preset bewaren', 'Save preset', 'Enregistrer', 'Preset speichern')}</button></div>`);
  };

  window.studioConsoleRgbwConfirmSave = function studioConsoleRgbwConfirmSave(asCopy = false) {
    const draft = getRgbwDraft();
    const name = String(document.getElementById('alvRgbwPresetName')?.value || '').trim().slice(0, 80);
    if (!name) return toast(tx('Geef de preset een naam.', 'Give the preset a name.', 'Donnez un nom au preset.', 'Gib dem Preset einen Namen.'));
    const existing = !asCopy && db.presets.find((item) => item.id === draft.sourcePresetId && item.customRgbwStudio);
    const id = existing?.id || uid('p-');
    const state = rgbwLiveState({ ...draft, blackout: false }, draft.state);
    const preset = { id, name, receiverType: 'RGBW', state, customRgbwStudio: { version: 2, state: clone(draft.state), cues: clone(draft.cues), master: draft.master, sourceAnimation: draft.state.animation }, favorite: existing?.favorite || false, createdAt: existing?.createdAt || Date.now(), updatedAt: Date.now() };
    if (existing) Object.assign(existing, preset);
    else db.presets.unshift(preset);
    draft.name = name;
    draft.sourcePresetId = id;
    rgbwPersist(draft);
    save();
    closeModal();
    window.studio();
    toast(existing ? tx('Studio-preset bijgewerkt', 'Studio preset updated', 'Preset Studio mis à jour', 'Studio-Preset aktualisiert') : tx('Studio-preset bewaard', 'Studio preset saved', 'Preset Studio enregistré', 'Studio-Preset gespeichert'));
  };

  window.applyPresetById = function studioConsoleApplyPreset(id) {
    const preset = db.presets.find((item) => item.id === id);
    if (!preset?.customRgbwStudio || receiverType() !== 'RGBW') return baseApplyPresetById(id);
    if (!group) return;
    const stored = preset.customRgbwStudio;
    const draft = getRgbwDraft();
    rgbwCheckpoint();
    draft.state = normaliseRgbwState(clone(stored.state || preset.state));
    draft.cues = clone(stored.cues || []);
    draft.master = clamp(stored.master, 0, 100, 100);
    draft.blackout = false;
    draft.playing = false;
    draft.sourcePresetId = id;
    draft.name = preset.name;
    delete draft.previewState;
    delete draft.previewMaster;
    delete draft.previewBlackout;
    group.state = clone(preset.state);
    save();
    render();
    queueLive(group);
    toast(tx('Studio-preset actief op ', 'Studio preset active on ', 'Preset Studio actif sur ', 'Studio-Preset aktiv auf ') + group.name);
  };

  window.loadCustomPreset = function studioConsoleLoadPreset(id) {
    const preset = db.presets.find((item) => item.id === id);
    if (!preset?.customRgbwStudio) return baseLoadCustomPreset(id);
    if (!group || receiverType() !== 'RGBW') return toast(tx('Kies eerst een RGBW-groep.', 'Choose an RGBW group first.', 'Choisissez d’abord un groupe RGBW.', 'Wähle zuerst eine RGBW-Gruppe.'));
    const stored = preset.customRgbwStudio;
    const draft = getRgbwDraft();
    Object.assign(draft, { state: normaliseRgbwState(clone(stored.state || preset.state)), cues: clone(stored.cues || []), master: clamp(stored.master, 0, 100, 100), blackout: false, playing: false, liveMode: false, sourcePresetId: id, name: preset.name, undo: [], redo: [], sessionId });
    delete draft.previewState;
    delete draft.previewMaster;
    delete draft.previewBlackout;
    rgbwPersist(draft);
    closeModal();
    go('studio');
    toast(tx('Preset geopend in Studio', 'Preset opened in Studio', 'Preset ouvert dans Studio', 'Preset in Studio geöffnet'));
  };

  window.presetMenu = function studioConsolePresetMenu(id) {
    const result = basePresetMenu(id);
    const preset = db.presets.find((item) => item.id === id);
    if (!preset?.customRgbwStudio) return result;
    const stack = document.querySelector('#modalBody .stack');
    if (!stack || stack.querySelector('[data-rgbw-studio-open]')) return result;
    const button = document.createElement('button');
    button.className = 'zone';
    button.dataset.rgbwStudioOpen = '1';
    button.setAttribute('onclick', `loadCustomPreset('${h(id)}')`);
    button.innerHTML = `<b>${tx('Openen in Lichtstudio', 'Open in Lighting Studio', 'Ouvrir dans le Studio', 'Im Lichtstudio öffnen')}</b><small>${tx('Looks en cues verder bewerken', 'Continue editing looks and cues', 'Modifier les looks et cues', 'Looks und Cues weiter bearbeiten')}</small>`;
    stack.children[1]?.after(button);
    return result;
  };

  window.overwritePreset = function studioConsoleOverwritePreset(id) {
    const preset = db.presets.find((item) => item.id === id);
    const custom = preset?.customRgbwStudio && receiverType() === 'RGBW';
    const result = baseOverwritePreset(id);
    if (custom && preset) {
      const draft = getRgbwDraft();
      preset.state = rgbwLiveState({ ...draft, blackout: false }, draft.state);
      preset.receiverType = 'RGBW';
      preset.customRgbwStudio = { version: 2, state: clone(draft.state), cues: clone(draft.cues), master: draft.master, sourceAnimation: draft.state.animation };
      preset.updatedAt = Date.now();
      save();
    }
    return result;
  };

  window.renamePreset = function studioConsoleRenamePreset(id) {
    const result = baseRenamePreset(id);
    const preset = db.presets.find((item) => item.id === id);
    if (preset?.customRgbwStudio && db.studioRgbwDrafts) {
      Object.values(db.studioRgbwDrafts).forEach((draft) => {
        if (draft.sourcePresetId === id) draft.name = preset.name;
      });
      save();
    }
    return result;
  };

  window.duplicatePreset = function studioConsoleDuplicatePreset(id) {
    const before = new Set(db.presets.map((item) => item.id));
    const result = baseDuplicatePreset(id);
    const created = db.presets.find((item) => !before.has(item.id));
    if (created?.customRgbwStudio) {
      created.customRgbwStudio = clone(created.customRgbwStudio);
      created.updatedAt = Date.now();
      save();
    }
    return result;
  };

  /* Reuse the common master markup while preserving the correct draft type. */
  const originalMaster = window.studioConsoleMaster;
  const originalBlackout = window.studioConsoleBlackout;
  window.studioConsoleMaster = function studioConsoleMasterRouter(value) {
    if (receiverType() === 'RGBW') return window.studioConsoleRgbwMaster(value);
    return originalMaster(value);
  };
  window.studioConsoleBlackout = function studioConsoleBlackoutRouter() {
    if (receiverType() === 'RGBW') return window.studioConsoleRgbwBlackout();
    return originalBlackout();
  };

  const style = document.createElement('style');
  style.id = 'alv-studio-console-style';
  style.textContent = `
  .alv-studio{--desk:#151716;--desk-2:#202220;--desk-3:#292b29;--desk-line:#ffffff16;--desk-copy:#f7f7f3;--desk-muted:#a9ada8;--studio-accent:#cf4f48;display:grid;gap:12px;min-width:0;padding-bottom:8px}.alv-studio *{box-sizing:border-box;min-width:0}.alv-studio button,.alv-studio input,.alv-studio select{font:inherit}.alv-studio-header{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px 20px;align-items:end}.alv-studio-heading h1{margin:7px 0 2px;font-size:clamp(27px,3.3vw,42px);line-height:.98;letter-spacing:-.04em}.alv-studio-heading>p{margin:0;color:var(--mut);font-size:11px;font-weight:650}.alv-target{display:inline-flex;align-items:center;gap:7px;max-width:100%;margin-top:4px;padding:0;border:0;background:none;color:var(--mut);cursor:pointer;font-size:11px}.alv-target b{color:var(--ink)}.alv-target em{padding:5px 7px;border-radius:99px;background:var(--soft);color:var(--ink);font-size:8px;font-style:normal;font-weight:900}.alv-studio-commands{display:flex;justify-content:flex-end;gap:6px;flex-wrap:wrap}.alv-command{display:grid;grid-template-columns:25px auto;gap:5px;align-items:center;min-height:45px;padding:5px 11px 5px 7px;border:1px solid var(--line);border-radius:13px;background:var(--panel);color:var(--ink);cursor:pointer;font-size:10px;font-weight:900}.alv-command i{display:grid;place-items:center;width:25px;height:25px;border-radius:8px;background:var(--soft);font-size:14px;font-style:normal}.alv-command:disabled{opacity:.38;cursor:not-allowed}.alv-command.live i{border-radius:50%;background:#959b96;box-shadow:0 0 0 5px #8b918b18;width:9px;height:9px;margin:0 8px}.alv-command.live.on{background:var(--studio-accent);border-color:var(--studio-accent);color:#fff}.alv-command.live.on i{background:#fff;box-shadow:0 0 0 5px #ffffff21}.alv-command.save{background:#171918;border-color:#171918;color:#fff}.alv-command.save i{background:#ffffff14}.alv-studio-status{grid-column:1/-1;display:flex;gap:7px;overflow:hidden}.alv-studio-status span{display:inline-flex;align-items:center;gap:6px;padding:6px 9px;border-radius:99px;background:var(--soft);color:var(--mut);font-size:8px;font-weight:850;white-space:nowrap}.alv-studio-status span:first-child i{width:7px;height:7px;border-radius:50%;background:#a9aca8}.alv-studio-status span:first-child.ok i{background:#5ca678;box-shadow:0 0 0 4px #5ca67818}.alv-studio-grid{display:grid;grid-template-columns:250px minmax(360px,1fr) 335px;grid-template-areas:'layers preview look' 'layers timeline output';gap:12px;align-items:start;min-width:0}.alv-panel{padding:13px;border:1px solid var(--line);border-radius:18px;background:var(--panel);box-shadow:var(--shadow)}.alv-panel>header{display:flex;align-items:flex-start;justify-content:space-between;gap:9px;margin-bottom:11px}.alv-panel>header small{display:block;color:var(--mut);font-size:8px;font-weight:950;letter-spacing:.13em}.alv-panel>header h2{margin:2px 0 0;font-size:18px;letter-spacing:-.025em}.alv-panel>header p{margin:3px 0 0;color:var(--mut);font-size:9px}.alv-panel>header>em{padding:5px 7px;border-radius:8px;background:var(--soft);color:var(--mut);font-size:8px;font-style:normal;font-weight:900}.alv-layers{grid-area:layers;position:sticky;top:8px}.alv-layer-list{display:grid;gap:7px}.alv-layer{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px;padding:6px;border:1px solid var(--line);border-radius:13px;background:var(--panel);transition:border-color .18s,box-shadow .18s,opacity .18s}.alv-layer.selected{border-color:var(--studio-accent);box-shadow:inset 3px 0 var(--studio-accent),0 0 0 2px color-mix(in srgb,var(--studio-accent),transparent 90%)}.alv-layer.muted{opacity:.5}.alv-layer-main{display:grid;grid-template-columns:34px minmax(0,1fr) 19px;gap:8px;align-items:center;padding:0;border:0;background:none;color:var(--ink);text-align:left;cursor:pointer}.alv-layer-main>i{width:34px;height:34px;border-radius:9px;background:var(--swatch);box-shadow:inset 0 0 0 1px #fff8,0 0 11px color-mix(in srgb,var(--swatch),transparent 62%)}.alv-layer-main span b,.alv-layer-main span small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.alv-layer-main span b{font-size:11px}.alv-layer-main span small{margin-top:2px;color:var(--mut);font-size:8px}.alv-layer-main>em{color:var(--mut);font-size:8px;font-style:normal;font-weight:900}.alv-layer>div{display:grid;grid-template-columns:36px 36px;gap:4px}.alv-layer>div button{display:grid;place-items:center;width:36px;height:36px;border:0;border-radius:9px;background:var(--soft);color:var(--mut);cursor:pointer}.alv-layer>div button.on{background:#191b1a;color:#fff}.alv-add{display:grid;grid-template-columns:36px minmax(0,1fr);gap:9px;align-items:center;width:100%;min-height:52px;margin-top:9px;padding:7px;border:1px dashed color-mix(in srgb,var(--studio-accent),var(--line) 58%);border-radius:13px;background:color-mix(in srgb,var(--studio-accent),transparent 96%);color:var(--ink);text-align:left;cursor:pointer}.alv-add>i{display:grid;place-items:center;width:36px;height:36px;border-radius:10px;background:var(--studio-accent);color:white;font-size:18px;font-style:normal}.alv-add b,.alv-add small{display:block}.alv-add b{font-size:10px}.alv-add small{margin-top:2px;color:var(--mut);font-size:8px}.alv-order{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:7px}.alv-order button{min-height:40px;border:1px solid var(--line);border-radius:10px;background:var(--soft);color:var(--ink);font-size:9px;font-weight:900}.alv-preview-card{grid-area:preview;overflow:hidden;border-radius:20px;background:var(--desk);color:var(--desk-copy);box-shadow:0 18px 52px #05060524}.alv-preview-card>header{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;padding:9px 11px;border-bottom:1px solid var(--desk-line);font-size:9px;color:var(--desk-muted)}.alv-output-state{display:inline-flex;align-items:center;gap:6px;font-size:8px;font-weight:950;letter-spacing:.05em}.alv-output-state i{width:7px;height:7px;border-radius:50%;background:#858985}.alv-output-state.live i{background:#f06a61;box-shadow:0 0 0 5px #f06a6122}.alv-view-switch{justify-self:end;display:flex;gap:3px;padding:3px;border-radius:10px;background:#090a09}.alv-view-switch button{min-height:31px;padding:0 8px;border:0;border-radius:8px;background:transparent;color:#aeb1ac;font-size:8px;font-weight:900}.alv-view-switch button.on{background:#f2f1ed;color:#1b1c1b}.alv-canvas{position:relative;height:clamp(230px,29vw,365px);padding:9px}.alv-canvas canvas{display:block;width:100%;height:100%;border-radius:13px;background:#090a09;transition:filter .15s}.alv-canvas>strong{position:absolute;inset:0;display:grid;place-items:center;color:#fff;font-size:10px;letter-spacing:.12em;background:#08090899}.alv-preview-grid{position:absolute;inset:9px;border-radius:13px;pointer-events:none;background-image:linear-gradient(#ffffff05 1px,transparent 1px),linear-gradient(90deg,#ffffff05 1px,transparent 1px);background-size:24px 24px;mix-blend-mode:screen}.alv-preview-tools{display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px;align-items:center;padding:8px 11px;border-top:1px solid var(--desk-line)}.alv-preview-tools>div{display:flex;gap:5px}.alv-preview-tools button{display:grid;place-items:center;width:40px;height:40px;border:0;border-radius:11px;background:#ffffff12;color:#fff;font-weight:950;cursor:pointer}.alv-preview-tools button.on{background:#f2f1ed;color:#181a18}.alv-preview-tools>span{display:block;text-align:right}.alv-preview-tools>span b,.alv-preview-tools>span small{display:block}.alv-preview-tools>span b{font-size:9px}.alv-preview-tools>span small{margin-top:2px;color:var(--desk-muted);font-size:8px}.alv-preview-card>footer{display:grid;grid-template-columns:27px 1fr;gap:8px;align-items:start;padding:9px 11px;border-top:1px solid var(--desk-line);background:#23201d;color:#d9d0c8}.alv-preview-card>footer.exact{background:#1c2420;color:#cbdad1}.alv-preview-card>footer>i{display:grid;place-items:center;width:27px;height:27px;border-radius:8px;background:#ffffff0d;font-style:normal;font-weight:950}.alv-preview-card>footer b,.alv-preview-card>footer small{display:block}.alv-preview-card>footer b{font-size:9px}.alv-preview-card>footer small{margin-top:2px;font-size:8px;line-height:1.38;opacity:.75}.alv-master{display:grid;grid-template-columns:auto minmax(80px,1fr) 42px auto;gap:8px;align-items:center;padding:11px;border:1px solid var(--line);border-radius:14px;background:var(--panel)}.alv-preview-card .alv-master{border:0;border-top:1px solid var(--desk-line);border-radius:0;background:#1c1e1c;color:white}.alv-master-copy small,.alv-master-copy b{display:block}.alv-master-copy small{color:var(--mut);font-size:7px;font-weight:950;letter-spacing:.08em}.alv-preview-card .alv-master-copy small{color:#9da19c}.alv-master-copy b{font-size:10px}.alv-master input{width:100%;accent-color:var(--studio-accent)}.alv-master output{font-size:10px;font-weight:950;text-align:right}.alv-blackout{display:flex;align-items:center;gap:7px;min-height:38px;padding:6px 9px;border:1px solid var(--line);border-radius:10px;background:var(--soft);color:var(--ink);font-size:8px;font-weight:950}.alv-preview-card .alv-blackout{border-color:#ffffff17;background:#ffffff0d;color:#fff}.alv-blackout i{width:10px;height:10px;border:2px solid currentColor;border-radius:50%}.alv-blackout.on{background:var(--studio-accent)!important;border-color:var(--studio-accent)!important;color:#fff}.alv-inspector{grid-area:look}.alv-look-primary{display:grid;gap:7px}.alv-look-primary>label{display:grid;gap:5px}.alv-look-primary>label>span{display:flex;align-items:center;justify-content:space-between}.alv-look-primary label b{font-size:10px}.alv-look-primary select,.alv-text-field input{width:100%;min-height:44px;padding:8px 10px;border:1px solid var(--line);border-radius:11px;background:var(--panel);color:var(--ink);font-size:10px;font-weight:800}.alv-effect-browser,.alv-colour-button{display:grid;grid-template-columns:39px minmax(0,1fr) auto;gap:9px;align-items:center;min-height:54px;padding:7px;border:1px solid var(--line);border-radius:12px;background:var(--panel);color:var(--ink);text-align:left}.alv-effect-browser>i,.alv-colour-button>i{display:grid;place-items:center;width:39px;height:39px;border-radius:10px;background:#171918;color:#fff;font-style:normal}.alv-colour-button>i{background:var(--swatch);box-shadow:inset 0 0 0 1px #fff9,0 0 11px color-mix(in srgb,var(--swatch),transparent 58%)}.alv-effect-browser b,.alv-effect-browser small,.alv-colour-button b,.alv-colour-button small{display:block}.alv-effect-browser b,.alv-colour-button b{font-size:10px}.alv-effect-browser small,.alv-colour-button small{margin-top:2px;color:var(--mut);font-size:8px}.alv-effect-browser>em,.alv-colour-button>em{font-style:normal}.alv-faders{display:grid;gap:8px;margin-top:10px}.alv-fader{display:grid;gap:7px;padding:10px;border:1px solid var(--line);border-radius:13px;background:color-mix(in srgb,var(--panel),var(--bg) 26%)}.alv-fader-head{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:7px;align-items:start}.alv-fader-head b,.alv-fader-head small{display:block}.alv-fader-head b{font-size:10px}.alv-fader-head small{margin-top:2px;color:var(--mut);font-size:8px;line-height:1.3}.alv-fader-head output{color:var(--studio-accent);font-size:10px;font-weight:950}.alv-cap{align-self:start;padding:4px 6px;border-radius:6px;background:#e9ece9;color:#5b635e;font-size:6px;font-weight:950;letter-spacing:.07em}.alv-cap.live{background:#eee9df;color:#806f52}.alv-cap.preview{background:#efe7e5;color:#945850}.alv-fader-demo{position:relative;display:flex;align-items:center;gap:3px;height:35px;padding:7px 8px;overflow:hidden;border-radius:10px;background:#161817}.alv-fader-demo>b{flex:1;height:20px;border-radius:4px;background:#ffffff0d}.alv-fader-demo:not(.blend)>b:nth-of-type(-n+7){background:color-mix(in srgb,var(--light),transparent calc(96% - var(--level)*.72))}.alv-fader-demo>i{position:absolute;z-index:2;top:8px;bottom:8px;left:calc(7px + var(--level)*.72);width:42px;max-width:35%;border-radius:99px;background:var(--light);box-shadow:0 0 14px color-mix(in srgb,var(--light),transparent 35%);transform:translateX(-50%)}.alv-fader-demo.speed>i{animation:alvStudioMove var(--motion) linear infinite}.alv-fader-demo.smooth>i{filter:blur(calc((100% - var(--level)) * 0));box-shadow:0 0 calc(5px + var(--level)*.12) var(--light)}.alv-fader-demo.blend{display:block}.alv-fader-demo.blend:before,.alv-fader-demo.blend:after{content:'';position:absolute;top:8px;bottom:8px;width:55%;border-radius:99px}.alv-fader-demo.blend:before{left:8px;background:#6f4fd5}.alv-fader-demo.blend:after{right:8px;background:var(--light);opacity:calc(.2 + var(--level)/125)}.alv-fader-demo.blend i{left:50%;width:30%;background:#fff;opacity:calc(.05 + var(--level)/120);box-shadow:none}.alv-range-row{display:grid;grid-template-columns:minmax(0,1fr) 58px 22px;gap:6px;align-items:center}.alv-range-row>input[type=range]{width:100%;height:30px;accent-color:var(--studio-accent)}.alv-number{width:58px;min-height:34px;padding:5px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--ink);text-align:center;font-size:9px;font-weight:900}.alv-range-row>em{color:var(--mut);font-size:8px;font-style:normal;font-weight:900}.alv-direction{margin-top:10px;padding-top:10px;border-top:1px solid var(--line)}.alv-direction>header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:7px}.alv-direction>header b,.alv-direction>header small{display:block}.alv-direction>header b{font-size:10px}.alv-direction>header small{margin-top:2px;color:var(--mut);font-size:8px}.alv-direction>div{display:grid;grid-template-columns:1fr 1fr;gap:6px}.alv-direction button{display:grid;grid-template-columns:35px 1fr;gap:6px;align-items:center;min-height:44px;padding:5px;border:1px solid var(--line);border-radius:11px;background:var(--panel);color:var(--ink);font-size:9px;font-weight:900}.alv-direction button i{display:grid;place-items:center;height:34px;border-radius:8px;background:var(--soft);font-style:normal}.alv-direction button.on{border-color:var(--studio-accent);box-shadow:inset 0 0 0 1px var(--studio-accent)}.alv-direction button.on i{background:var(--studio-accent);color:#fff}.alv-advanced{margin-top:10px;border-top:1px solid var(--line)}.alv-advanced summary{display:flex;align-items:center;justify-content:space-between;min-height:48px;cursor:pointer;list-style:none}.alv-advanced summary b,.alv-advanced summary small{display:block}.alv-advanced summary b{font-size:10px}.alv-advanced summary small{margin-top:2px;color:var(--mut);font-size:8px}.alv-advanced summary>i{font-style:normal;transition:transform .2s}.alv-advanced[open] summary>i{transform:rotate(90deg)}.alv-advanced>div{display:grid;gap:8px}.alv-text-field{display:grid;gap:5px;color:var(--mut);font-size:8px;font-weight:900}.alv-danger-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px}.alv-danger-actions button{min-height:42px;border:1px solid var(--line);border-radius:10px;background:var(--soft);color:var(--ink);font-size:9px;font-weight:900}.alv-danger-actions button.danger{color:var(--studio-accent)}.alv-locked{display:grid;grid-template-columns:31px 1fr auto;gap:7px;align-items:center;margin-bottom:9px;padding:7px;border-radius:10px;background:var(--soft);font-size:9px}.alv-locked>i{display:grid;place-items:center;width:31px;height:31px;border-radius:8px;background:#1a1b1a;color:#fff;font-style:normal}.alv-locked button{border:0;background:none;color:var(--studio-accent);font-size:8px;font-weight:900}.alv-output-panel{grid-area:output}.alv-range-list{display:flex;gap:5px;overflow-x:auto;padding-bottom:5px}.alv-range-list button{flex:0 0 auto;min-height:43px;padding:6px 9px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--ink);text-align:left}.alv-range-list button.on{border-color:var(--studio-accent);box-shadow:inset 0 0 0 1px var(--studio-accent)}.alv-range-list b,.alv-range-list small{display:block}.alv-range-list b{font-size:8px}.alv-range-list small{margin-top:2px;color:var(--mut);font-size:7px}.alv-range-list button.add{display:grid;grid-template-columns:20px auto;gap:5px;align-items:center}.alv-pixel-map{display:flex;gap:2px;height:39px;margin:9px 0;padding:7px;border-radius:10px;background:#171918}.alv-pixel-map i{flex:1;border-radius:3px;background:#ffffff10}.alv-pixel-map i.on{background:var(--studio-accent);box-shadow:0 0 7px #cf4f4877}.alv-range-fields{display:grid;grid-template-columns:1fr 20px 1fr;gap:6px;align-items:end}.alv-range-fields label{display:grid;gap:4px;color:var(--mut);font-size:8px;font-weight:900}.alv-range-fields input{width:100%;min-height:40px;padding:6px;border:1px solid var(--line);border-radius:9px;background:var(--panel);color:var(--ink);text-align:center;font-weight:900}.alv-range-fields>i{padding-bottom:12px;color:var(--mut);font-style:normal}.alv-range-quick{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:7px}.alv-range-quick button{min-height:38px;border:1px solid var(--line);border-radius:9px;background:var(--soft);color:var(--ink);font-size:8px;font-weight:900}.alv-primary-wide{width:100%;min-height:45px;margin-top:8px;padding:8px;border:0;border-radius:11px;background:#1b1d1b;color:#fff;font-size:9px;font-weight:950}.alv-honesty{display:grid;grid-template-columns:27px 1fr;gap:8px;margin:9px 0 0;padding:9px;border-radius:11px;background:#f1ece9;color:#6f5c55}.alv-honesty>i{display:grid;place-items:center;width:27px;height:27px;border-radius:8px;background:#ffffff99;font-style:normal;font-weight:950}.alv-honesty b,.alv-honesty small{display:block}.alv-honesty b{font-size:8px}.alv-honesty small{margin-top:2px;font-size:7px;line-height:1.4}.alv-output-block{margin-top:10px;padding-top:10px;border-top:1px solid var(--line)}.alv-output-block>header{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:7px}.alv-output-block>header b,.alv-output-block>header small{display:block}.alv-output-block>header b{font-size:9px}.alv-output-block>header small{margin-top:2px;color:var(--mut);font-size:7px}.alv-output-block>header button{min-height:35px;padding:5px 8px;border:1px solid var(--line);border-radius:9px;background:var(--soft);color:var(--ink);font-size:8px;font-weight:900}.alv-output-block>header button.on{background:var(--studio-accent);color:#fff}.alv-physical-lines{display:grid;gap:5px}.alv-physical-lines>span{display:grid;grid-template-columns:29px minmax(0,1fr) auto 26px;gap:7px;align-items:center;min-height:42px;padding:6px;border-radius:10px;background:var(--soft)}.alv-physical-lines>span>i{display:grid;place-items:center;width:29px;height:29px;border-radius:8px;background:#1b1d1b;color:#fff;font-size:9px;font-style:normal;font-weight:950}.alv-physical-lines b{font-size:8px}.alv-physical-lines small{color:var(--mut);font-size:7px}.alv-physical-lines em{font-style:normal;font-weight:900}.alv-physical-lines em.reverse{color:var(--studio-accent)}.alv-empty-inline{display:grid;grid-template-columns:38px 1fr;gap:9px;align-items:center;padding:12px;border:1px dashed var(--line);border-radius:12px}.alv-empty-inline>i{display:grid;place-items:center;width:38px;height:38px;border-radius:10px;background:var(--soft);color:var(--mut);font-style:normal}.alv-empty-inline b,.alv-empty-inline small{display:block}.alv-empty-inline b{font-size:9px}.alv-empty-inline small{margin-top:2px;color:var(--mut);font-size:8px;line-height:1.4}.alv-timeline{grid-area:timeline;background:var(--desk);border-color:transparent;color:var(--desk-copy);box-shadow:0 15px 45px #0506051c}.alv-timeline>header small,.alv-timeline>header p{color:var(--desk-muted)}.alv-timeline>header>em{background:#ffffff0c}.alv-timeline-tools{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}.alv-timeline-tools>span{display:flex;align-items:center;gap:5px;flex-wrap:wrap}.alv-timeline-tools button{min-width:40px;min-height:40px;padding:6px 9px;border:1px solid var(--desk-line);border-radius:10px;background:#ffffff0b;color:#fff;font-size:8px}.alv-timeline-tools button.primary,.alv-timeline-tools button.on{background:#f2f1ed;color:#181a18}.alv-timeline-tools label{display:flex;align-items:center;gap:5px;color:var(--desk-muted);font-size:8px;font-weight:900}.alv-timeline-tools input{width:62px;min-height:37px;padding:5px;border:1px solid var(--desk-line);border-radius:9px;background:#262826;color:#fff}.alv-timeline-tools em{font-size:8px;font-style:normal}.alv-scrub{width:100%;height:31px;margin:7px 0;accent-color:var(--studio-accent)}.alv-cue-list{display:none}.alv-timeline-scroll{width:100%;overflow-x:auto;overscroll-behavior-x:contain}.alv-timeline-inner{padding-bottom:4px}.alv-ruler{position:relative;height:24px;margin-left:119px;border-bottom:1px solid var(--desk-line)}.alv-ruler span{position:absolute;bottom:4px;transform:translateX(-50%);color:#8c908b;font-size:7px}.alv-track{display:grid;grid-template-columns:112px minmax(540px,1fr);min-height:46px;border-bottom:1px solid #ffffff0b}.alv-track>button{display:flex;align-items:center;gap:7px;overflow:hidden;border:0;background:none;color:#e5e6e2;text-align:left;font-size:8px;font-weight:900}.alv-track>button i{width:9px;height:9px;flex:0 0 auto;border-radius:50%;background:var(--track);box-shadow:0 0 8px var(--track)}.alv-track>button span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.alv-track>div{position:relative;margin:7px 7px 7px 0;border-radius:7px;background:linear-gradient(90deg,#ffffff09,#ffffff02)}.alv-key{position:absolute;z-index:2;top:50%;width:44px;height:44px;border:0;background:none;transform:translate(-50%,-50%)}.alv-key:after{content:'';display:block;width:12px;height:12px;margin:auto;transform:rotate(45deg);border:2px solid #fff;border-radius:2px;background:var(--studio-accent)}.alv-track .studio-playhead-v186{position:absolute;top:0;bottom:0;width:2px;background:#fff;box-shadow:0 0 8px #fff}.alv-honesty.compact{background:#ffffff08;color:#c6c9c4}.alv-honesty.compact>i{background:#ffffff0a}.alv-studio-tabs{display:none}.alv-effect-modal>.eyebrow{margin-top:15px}.alv-effect-modal>section{margin-top:16px}.alv-effect-modal h2{margin-bottom:8px}.alv-effect-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.alv-effect-choice{display:grid;grid-template-columns:78px minmax(0,1fr) auto;gap:9px;align-items:center;min-height:70px;padding:8px;border:1px solid var(--line);border-radius:13px;background:var(--panel);color:var(--ink);text-align:left}.alv-effect-choice.on{border-color:var(--studio-accent);box-shadow:inset 0 0 0 1px var(--studio-accent)}.alv-effect-choice b,.alv-effect-choice small{display:block}.alv-effect-choice b{font-size:10px}.alv-effect-choice small{margin-top:3px;color:var(--mut);font-size:8px}.alv-effect-mini{position:relative;display:block;height:48px;overflow:hidden;border-radius:10px;background:#171918}.alv-effect-mini i{position:absolute;top:17px;width:30%;height:14px;border-radius:99px;background:#fff;box-shadow:0 0 12px #fff}.alv-effect-mini i:nth-child(1){left:7%;animation:alvStudioMove 3.2s linear infinite}.alv-effect-mini i:nth-child(2){left:38%;opacity:.45}.alv-effect-mini i:nth-child(3){right:7%;opacity:.16}.alv-preset-summary{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:12px 0}.alv-preset-summary span{padding:10px;border-radius:11px;background:var(--soft)}.alv-preset-summary b,.alv-preset-summary small{display:block}.alv-preset-summary b{font-size:10px}.alv-preset-summary small{margin-top:2px;color:var(--mut);font-size:8px}.alv-studio-empty{display:grid;place-items:center;min-height:460px;padding:34px;border:1px dashed var(--line);border-radius:22px;background:var(--panel);text-align:center}.alv-studio-empty>i{display:grid;place-items:center;width:70px;height:70px;border-radius:21px;background:#171918;color:#fff;font-size:27px;font-style:normal}.alv-studio-empty h1{margin:8px 0}.alv-studio-empty p{max-width:390px;margin:0;color:var(--mut)}.alv-studio-empty button{min-height:46px;margin-top:16px;padding:8px 14px;border:0;border-radius:12px;background:#171918;color:#fff;font-weight:900}.alv-rgbw-effects{display:grid;grid-template-columns:1fr 1fr;gap:6px;max-height:274px;overflow:auto}.alv-rgbw-effects>button{display:grid;grid-template-columns:54px 19px minmax(0,1fr);gap:6px;align-items:center;min-height:58px;padding:6px;border:1px solid var(--line);border-radius:11px;background:var(--panel);color:var(--ink);text-align:left}.alv-rgbw-effects>button.on{border-color:var(--studio-accent);box-shadow:inset 0 0 0 1px var(--studio-accent)}.alv-rgbw-effects>button>i{font-style:normal}.alv-rgbw-effects b,.alv-rgbw-effects small{display:block}.alv-rgbw-effects b{font-size:9px}.alv-rgbw-effects small{margin-top:2px;color:var(--mut);font-size:7px}.alv-rgbw-mini{position:relative;display:block;width:54px;height:39px;overflow:hidden;border-radius:8px;background:#171918}.alv-rgbw-mini i{position:absolute;left:7px;right:7px;height:7px;border-radius:99px;background:#fff;box-shadow:0 0 8px #fff}.alv-rgbw-mini i:nth-child(1){top:6px}.alv-rgbw-mini i:nth-child(2){top:16px;opacity:.65}.alv-rgbw-mini i:nth-child(3){top:26px;opacity:.32}.alv-rgbw-effects>button:not(.on) .alv-rgbw-mini i{animation:alvRgbwFade 2.3s ease-in-out infinite alternate}.alv-rgbw-colours{margin-top:10px;padding-top:10px;border-top:1px solid var(--line)}.alv-rgbw-colours>header{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:7px}.alv-rgbw-colours header b,.alv-rgbw-colours header small{display:block}.alv-rgbw-colours header b{font-size:10px}.alv-rgbw-colours header small{margin-top:2px;color:var(--mut);font-size:8px}.alv-rgbw-colours select{min-height:36px;padding:5px;border:1px solid var(--line);border-radius:9px;background:var(--panel);color:var(--ink);font-size:8px}.alv-rgbw-colours>div{display:grid;gap:6px}.alv-rgbw-colours article{display:grid;grid-template-columns:minmax(0,1fr);gap:5px;padding:6px;border:1px solid var(--line);border-radius:11px}.alv-rgbw-colours article>label{display:grid;grid-template-columns:38px minmax(0,1fr);gap:8px;align-items:center}.alv-rgbw-colours article>label input{position:absolute;opacity:0;pointer-events:none}.alv-rgbw-colours article>label i{width:38px;height:38px;border-radius:10px;background:var(--swatch);box-shadow:inset 0 0 0 1px #fff9,0 0 10px color-mix(in srgb,var(--swatch),transparent 56%)}.alv-rgbw-colours article b,.alv-rgbw-colours article small{display:block}.alv-rgbw-colours article b{font-size:9px}.alv-rgbw-colours article small{color:var(--mut);font-size:7px}.alv-rgbw-colours article>div{display:grid;grid-template-columns:42px 42px minmax(60px,1fr) 29px;gap:4px;align-items:center}.alv-rgbw-colours article>div button{min-height:34px;border:1px solid var(--line);border-radius:8px;background:var(--soft);color:var(--mut);font-size:8px;font-weight:900}.alv-rgbw-colours article>div button.on{background:#1a1c1a;color:#fff}.alv-rgbw-colours article>div input{width:100%;accent-color:var(--studio-accent)}.alv-rgbw-colours article>div output{font-size:8px;font-weight:900}.alv-rgbw-routing{display:grid;gap:6px;margin:9px 0}.alv-rgbw-routing>span{display:grid;grid-template-columns:30px minmax(0,1fr);gap:8px;padding:8px;border-radius:11px;background:var(--soft)}.alv-rgbw-routing>span>i{grid-row:1/3;width:30px;height:30px;border-radius:9px;background:linear-gradient(90deg,#fff2,#fff);box-shadow:0 0 9px #fff5}.alv-rgbw-routing b,.alv-rgbw-routing small{display:block}.alv-rgbw-routing b{font-size:9px}.alv-rgbw-routing small{color:var(--mut);font-size:7px}.alv-rgbw-cues{grid-area:timeline}.alv-cue-actions{display:flex;gap:6px;flex-wrap:wrap}.alv-cue-actions button{min-height:42px;padding:7px 10px;border:1px solid var(--desk-line);border-radius:10px;background:#ffffff0b;color:#fff;font-size:8px;font-weight:900}.alv-cue-actions button.primary{background:#f1f0ec;color:#181a18}.alv-rgbw-cue-list{display:grid;gap:6px;margin-top:9px}.alv-rgbw-cue-list article{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;padding:6px;border:1px solid var(--desk-line);border-radius:12px}.alv-rgbw-cue-list article.on{border-color:var(--studio-accent)}.alv-rgbw-cue-main{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:8px;align-items:center;border:0;background:none;color:#fff;text-align:left}.alv-rgbw-cue-main>i{display:grid;place-items:center;width:34px;height:34px;border-radius:9px;background:#ffffff0d;font-style:normal;font-weight:900}.alv-rgbw-cue-main b,.alv-rgbw-cue-main small{display:block}.alv-rgbw-cue-main b{font-size:9px}.alv-rgbw-cue-main small{margin-top:2px;color:var(--desk-muted);font-size:7px}.alv-rgbw-cue-main>em{font-style:normal}.alv-rgbw-cue-list article>div{display:flex;gap:4px;align-items:center}.alv-rgbw-cue-list article>div label{display:grid;gap:2px;color:var(--desk-muted);font-size:6px}.alv-rgbw-cue-list article>div input{width:51px;min-height:34px;padding:4px;border:1px solid var(--desk-line);border-radius:8px;background:#242624;color:#fff}.alv-rgbw-cue-list article>div button{width:34px;height:34px;border:1px solid var(--desk-line);border-radius:8px;background:#ffffff0b;color:#fff}.alv-rgbw-cue-list article>div button.danger{color:#ff8e86}.alv-live-wide{display:grid;grid-template-columns:12px minmax(0,1fr);gap:9px;align-items:center;width:100%;min-height:54px;margin:9px 0;padding:9px 11px;border:1px solid var(--line);border-radius:12px;background:var(--soft);color:var(--ink);text-align:left}.alv-live-wide>i{width:10px;height:10px;border-radius:50%;background:#8d928e}.alv-live-wide.on{background:var(--studio-accent);border-color:var(--studio-accent);color:#fff}.alv-live-wide.on>i{background:#fff;box-shadow:0 0 0 5px #ffffff20}.alv-live-wide b,.alv-live-wide small{display:block}.alv-live-wide b{font-size:9px}.alv-live-wide small{margin-top:2px;font-size:7px;opacity:.72}.alv-output-meter{display:grid;grid-template-columns:1fr 38px;gap:7px;align-items:center;margin-bottom:8px}.alv-output-meter>span{height:12px;overflow:hidden;border-radius:99px;background:var(--soft)}.alv-output-meter>span i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#7b3732,var(--studio-accent))}.alv-output-meter b{font-size:9px}.body-dark-placeholder{display:none}body.dark .alv-cap{background:#303430;color:#c7cec8}body.dark .alv-cap.live{background:#3a3329;color:#e0cda9}body.dark .alv-cap.preview{background:#3a2d2b;color:#edbbb6}body.dark .alv-honesty{background:#352c29;color:#e1c8bf}body.dark .alv-command.save,body.dark .alv-primary-wide{background:#eeeeea;color:#171918}body.dark .alv-layer>div button.on,body.dark .alv-rgbw-colours article>div button.on{background:#efefeb;color:#171918}
  .alv-effect-choice canvas.alv-effect-mini{width:100%;max-width:100%;height:48px}
  .alv-rgbw-mini.static i{animation:none!important}.alv-rgbw-mini.breathe i{animation:alvRgbwFade 2.2s ease-in-out infinite alternate!important}.alv-rgbw-mini.breathe i:nth-child(2),.alv-rgbw-mini.breathe i:nth-child(3){animation-delay:0s!important}
  .alv-rgbw-mini.gradient i,.alv-rgbw-mini.flow i{background:linear-gradient(90deg,#f05d55,#8a42df,#43c7a1);background-size:220% 100%;animation:alvRgbwColour 2.5s linear infinite!important}.alv-rgbw-mini.gradient i:nth-child(2),.alv-rgbw-mini.flow i:nth-child(2){animation-delay:-.45s!important}.alv-rgbw-mini.gradient i:nth-child(3),.alv-rgbw-mini.flow i:nth-child(3){animation-delay:-.9s!important}
  .alv-rgbw-mini.sparkle i{animation:alvRgbwFlash 1.15s steps(1) infinite!important}.alv-rgbw-mini.sparkle i:nth-child(2){animation-delay:-.38s!important}.alv-rgbw-mini.sparkle i:nth-child(3){animation-delay:-.76s!important}
  .alv-rgbw-mini.sequence i,.alv-rgbw-mini.cascade i,.alv-rgbw-mini.wave i,.alv-rgbw-mini.chase i{animation:alvRgbwLine 1.8s ease-in-out infinite!important}.alv-rgbw-mini.sequence i:nth-child(2),.alv-rgbw-mini.cascade i:nth-child(2),.alv-rgbw-mini.wave i:nth-child(2),.alv-rgbw-mini.chase i:nth-child(2){animation-delay:-.6s!important}.alv-rgbw-mini.sequence i:nth-child(3),.alv-rgbw-mini.cascade i:nth-child(3),.alv-rgbw-mini.wave i:nth-child(3),.alv-rgbw-mini.chase i:nth-child(3){animation-delay:-1.2s!important}
  @keyframes alvStudioMove{0%{left:4%}100%{left:96%}}@keyframes alvRgbwFade{0%{opacity:.12;filter:brightness(.45)}100%{opacity:1;filter:brightness(1.25)}}@keyframes alvRgbwColour{to{background-position:-220% 0}}@keyframes alvRgbwFlash{0%,18%{opacity:1}19%,100%{opacity:.09}}@keyframes alvRgbwLine{0%,100%{opacity:.1;transform:scaleX(.58)}45%{opacity:1;transform:scaleX(1)}}
  @media(max-width:1180px){.alv-studio-grid{grid-template-columns:225px minmax(330px,1fr);grid-template-areas:'preview preview' 'layers look' 'layers output' 'timeline timeline'}.alv-layers{position:static}.alv-canvas{height:280px}}
  @media(max-width:720px){body:has(#studio.page.on) .app{padding-bottom:138px!important}.alv-studio{padding-bottom:68px}.alv-studio-header{display:grid;grid-template-columns:1fr;gap:8px}.alv-studio-heading h1{font-size:28px}.alv-studio-heading>p{font-size:10px}.alv-studio-commands{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px}.alv-studio-rgbw .alv-studio-commands{grid-template-columns:repeat(4,minmax(0,1fr))}.alv-command{display:grid;grid-template-columns:1fr;justify-items:center;gap:2px;min-height:52px;padding:5px 2px;font-size:8px}.alv-command i{width:25px;height:23px}.alv-command.live i{margin:7px 0;width:9px;height:9px}.alv-studio-status{gap:4px}.alv-studio-status span{padding:5px 7px;font-size:7px}.alv-studio-status span:nth-child(3){display:none}.alv-studio-grid{display:grid;grid-template-columns:1fr;grid-template-areas:'tabs' 'preview' 'look' 'layers' 'timeline' 'output';gap:9px}.alv-preview-card{position:relative}.alv-canvas{height:174px;padding:6px}.alv-preview-grid{inset:6px}.alv-preview-card>header{grid-template-columns:auto 1fr;padding:7px 8px}.alv-preview-card>header>span:nth-child(2){text-align:right}.alv-view-switch{grid-column:1/-1;justify-self:stretch}.alv-view-switch button{flex:1;min-height:34px}.alv-preview-tools{padding:6px 8px}.alv-preview-tools button{width:44px;height:44px}.alv-preview-card>footer{padding:7px 9px}.alv-preview-card>footer small{font-size:7px}.alv-master{grid-template-columns:auto minmax(60px,1fr) 38px}.alv-master.compact{padding:8px}.alv-master.compact .alv-blackout{grid-column:1/-1;justify-content:center}.alv-studio-tabs{grid-area:tabs;display:block;position:sticky;top:5px;z-index:8;padding:4px;border:1px solid var(--line);border-radius:15px;background:color-mix(in srgb,var(--bg),transparent 5%);box-shadow:0 7px 22px #00000012;backdrop-filter:blur(18px)}.alv-studio-tabs>div{display:grid;grid-template-columns:repeat(4,1fr);gap:3px}.alv-studio-tabs button{display:grid;grid-template-columns:1fr;place-items:center;gap:2px;min-height:48px;border:0;border-radius:11px;background:transparent;color:var(--mut);font-size:8px;font-weight:950}.alv-studio-tabs button i{font-size:14px;font-style:normal}.alv-studio-tabs button.on{background:var(--panel);color:var(--ink);box-shadow:0 2px 9px #0001}.alv-studio-grid>[data-mobile]{display:none!important;scroll-margin-top:78px}.alv-studio[data-mobile-panel='settings'] [data-mobile='settings'],.alv-studio[data-mobile-panel='layers'] [data-mobile='layers'],.alv-studio[data-mobile-panel='timeline'] [data-mobile='timeline'],.alv-studio[data-mobile-panel='pixels'] [data-mobile='pixels']{display:block!important}.alv-layers,.alv-inspector,.alv-output-panel,.alv-timeline{grid-area:auto}.alv-panel{padding:11px;border-radius:16px}.alv-panel>header h2{font-size:17px}.alv-fader-head b{font-size:11px}.alv-fader-head small{font-size:9px}.alv-cap{font-size:7px}.alv-layer-main span b{font-size:11px}.alv-layer-main span small{font-size:9px}.alv-layer>div{grid-template-columns:44px 44px}.alv-layer>div button{width:44px;height:44px}.alv-layer{grid-template-columns:minmax(0,1fr) 92px}.alv-order button{min-height:44px}.alv-cue-list{display:grid;gap:6px}.alv-cue-list>article{display:grid;grid-template-columns:100px minmax(0,1fr);gap:6px;padding:6px;border:1px solid var(--desk-line);border-radius:12px}.alv-cue-time{display:grid;grid-template-columns:32px 1fr;gap:6px;align-items:center;border:0;background:none;color:#fff;text-align:left}.alv-cue-time>i{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;background:#ffffff0d;font-size:8px;font-style:normal}.alv-cue-time b,.alv-cue-time small{display:block}.alv-cue-time b{font-size:8px}.alv-cue-time small{color:var(--desk-muted);font-size:7px}.alv-cue-list article>div{display:grid;gap:4px}.alv-cue-list article>div button{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px;min-height:42px;padding:6px 7px;border:1px solid var(--desk-line);border-radius:9px;background:#ffffff09;color:#fff;text-align:left}.alv-cue-list article>div b,.alv-cue-list article>div small{display:block}.alv-cue-list article>div b{font-size:8px}.alv-cue-list article>div small{grid-column:1;color:var(--desk-muted);font-size:7px}.alv-cue-list article>div em{grid-row:1/3;grid-column:2;align-self:center;font-style:normal}.alv-timeline-scroll{display:none}.alv-timeline-tools{display:grid}.alv-timeline-tools>span{display:grid;grid-template-columns:repeat(4,1fr)}.alv-timeline-tools>span:nth-child(2){grid-template-columns:minmax(0,1fr) 42px auto 42px}.alv-timeline-tools>span:nth-child(2) button:last-child{display:none}.alv-timeline-tools button{min-height:44px}.alv-timeline-tools label{grid-column:1}.alv-timeline-tools label input{width:100%}.alv-rgbw-effects{max-height:none}.alv-rgbw-cue-list article{grid-template-columns:1fr}.alv-rgbw-cue-list article>div{justify-content:flex-end;flex-wrap:wrap}.alv-effect-grid{grid-template-columns:1fr}.alv-effect-choice{grid-template-columns:68px minmax(0,1fr) auto}.alv-honesty small{font-size:8px}.alv-output-safety .alv-master{display:none}}
  @media(max-width:390px){.alv-studio-commands{grid-template-columns:repeat(3,1fr)}.alv-studio-commands .alv-command:nth-child(2),.alv-studio-commands .alv-command:nth-child(3){display:none}.alv-studio-rgbw .alv-studio-commands{grid-template-columns:repeat(3,1fr)}.alv-studio-rgbw .alv-studio-commands .alv-command:nth-child(3){display:grid}.alv-studio-status span:nth-child(2){display:none}.alv-canvas{height:158px}.alv-output-state{font-size:7px}.alv-master-copy small{display:none}.alv-master.compact{grid-template-columns:47px minmax(50px,1fr) 38px}.alv-rgbw-effects{grid-template-columns:1fr}.alv-range-quick{grid-template-columns:1fr 1fr}.alv-cue-list>article{grid-template-columns:1fr}.alv-fader-head{grid-template-columns:minmax(0,1fr) auto}.alv-fader-head .alv-cap{display:none}.alv-range-row{grid-template-columns:minmax(0,1fr) 55px 18px}}
  @media(prefers-reduced-motion:reduce){.alv-studio *{animation:none!important;transition:none!important}}
  `;
  document.head.appendChild(style);

  const layoutStyle = document.createElement('style');
  layoutStyle.id = 'alv-studio-console-layout';
  layoutStyle.textContent = `
    .alv-inspector-tabs{display:grid;grid-template-columns:1fr 1fr;gap:3px;margin:-4px -4px 11px;padding:3px;border-radius:12px;background:var(--soft)}
    .alv-inspector-tabs button{display:flex;align-items:center;justify-content:center;gap:6px;min-height:38px;padding:5px;border:0;border-radius:9px;background:transparent;color:var(--mut);font-size:8px;font-weight:950}
    .alv-inspector-tabs button i{font-size:12px;font-style:normal}.alv-inspector-tabs button.on{background:var(--panel);color:var(--ink);box-shadow:0 2px 8px #0001}
    .alv-effect-choice[hidden]{display:none!important}
    .alv-rgbw-static{display:grid;grid-template-columns:54px minmax(0,1fr) auto;gap:9px;align-items:center;width:100%;min-height:60px;margin-bottom:8px;padding:7px;border:1px solid var(--line);border-radius:12px;background:color-mix(in srgb,var(--panel),var(--bg) 22%);color:var(--ink);text-align:left}
    .alv-rgbw-static.on{border-color:var(--studio-accent);box-shadow:inset 0 0 0 1px var(--studio-accent)}
    .alv-rgbw-static>span:nth-child(2) b,.alv-rgbw-static>span:nth-child(2) small{display:block}.alv-rgbw-static>span:nth-child(2) b{font-size:10px}.alv-rgbw-static>span:nth-child(2) small{margin-bottom:2px;color:var(--mut);font-size:7px;font-weight:950;letter-spacing:.08em}.alv-rgbw-static>em{font-style:normal;font-weight:950}
    .alv-cap.design{background:#efe7e5;color:#945850}
    body.dark .alv-cap.design{background:#3a2d2b;color:#edbbb6}
    @media(min-width:1321px){
      .alv-studio-grid{grid-template-areas:none!important;grid-template-rows:auto auto!important}
      .alv-studio-grid>.alv-preview-card{grid-area:auto!important;grid-column:2!important;grid-row:1!important}
      .alv-studio-grid>.alv-layers{grid-area:auto!important;grid-column:1!important;grid-row:1/3!important}
      .alv-studio-grid>.alv-inspector,.alv-studio-grid>.alv-output-panel{grid-area:auto!important;grid-column:3!important;grid-row:1/3!important}
      .alv-studio-grid>.alv-timeline{grid-area:auto!important;grid-column:2!important;grid-row:2!important}
    }
    @media(min-width:721px) and (max-width:1320px){
      .alv-studio-grid{grid-template-areas:none!important;grid-template-columns:225px minmax(330px,1fr)!important;grid-template-rows:auto auto!important}
      .alv-studio-grid>.alv-preview-card{grid-area:auto!important;grid-column:1/3!important;grid-row:1!important}
      .alv-studio-grid>.alv-layers{grid-area:auto!important;grid-column:1!important;grid-row:2/4!important}
      .alv-studio-grid>.alv-inspector,.alv-studio-grid>.alv-output-panel{grid-area:auto!important;grid-column:2!important;grid-row:2/4!important}
      .alv-studio-grid>.alv-timeline{grid-area:auto!important;grid-column:1/3!important;grid-row:4!important}
    }
    @media(min-width:721px){
      .alv-studio[data-inspector-tab='look'] .alv-output-panel{display:none}
      .alv-studio[data-inspector-tab='output'] .alv-inspector{display:none}
    }
    @media(max-width:720px){
      .alv-inspector-tabs{display:none}
      .alv-target{min-height:44px}
      .alv-view-switch button{min-height:40px}
      .alv-range-quick button,.alv-output-block>header button{min-height:44px}
    }
  `;
  document.head.appendChild(layoutStyle);

  if (document.getElementById('studio')) window.studio();
})();
