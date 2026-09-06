/*
 * Aluvision Lighting V21 - cohesive customer runtime.
 *
 * V20.7 remains the visual and protocol compatibility base. This final layer
 * owns the V21 invariants that must be identical on iPhone, iPad and desktop:
 * stable logical LED Line selection, Static Color quick control, exact RGBW
 * routing, modal continuity and safe mobile navigation.
 */
(() => {
  'use strict';

  if (window.__aluvisionV21System) return;
  window.__aluvisionV21System = true;

  const VERSION = '21.0.3';
  const CORE = window.AluvisionV21Model;
  const ANIMATION_CATALOG = window.AluvisionV21AnimationCatalog;
  const rgbwLiveTimers = new Map();
  const commandGeneration = new Map();
  const modalPositions = new Map();
  let lastModalKey = '';
  let canonicalModel = null;
  let canonicalError = '';
  let observerQueued = false;
  let lineScopeRefreshQueued = false;
  let lineScopeRefreshGroup = null;
  let animationNameMigrationRan = false;
  let lastCustomerPanel = 'light';
  let canonicalSaveTimer = 0;
  let canonicalSaveStarted = 0;

  const array = value => Array.isArray(value) ? value : [];
  const duplicate = value => {
    if (value === undefined) return undefined;
    return typeof structuredClone === 'function'
      ? structuredClone(value)
      : JSON.parse(JSON.stringify(value));
  };
  const clamp = (value, minimum, maximum, fallback = minimum) => {
    const number = Number(value);
    return Math.max(minimum, Math.min(maximum, Number.isFinite(number) ? number : fallback));
  };
  const safe = value => typeof window.esc === 'function'
    ? window.esc(String(value ?? ''))
    : String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  const language = () => {
    let selected = 'nl';
    try { selected = String(db?.settings?.language || document.documentElement.lang || 'nl').slice(0, 2).toLowerCase(); }
    catch (_) { /* Dutch remains the customer fallback. */ }
    return ['nl', 'en', 'fr', 'de'].includes(selected) ? selected : 'nl';
  };
  const text = (nl, en, fr, de) => ({ nl, en, fr, de })[language()] || nl;
  const currentDatabase = () => {
    try { return db; }
    catch (_) { return null; }
  };
  const currentLocation = () => {
    try { return install; }
    catch (_) { return null; }
  };
  const currentZone = () => {
    try { return zone; }
    catch (_) { return null; }
  };
  const currentGroup = () => {
    try { return group; }
    catch (_) { return null; }
  };
  const isGuideActive = () => {
    try { return Boolean(realGuide?.active); }
    catch (_) { return false; }
  };
  const receiverType = value => {
    try {
      if (typeof window.groupReceiverType === 'function' && value?.receivers) {
        return String(window.groupReceiverType(value) || value.receiverType || 'SPI').toUpperCase() === 'RGBW' ? 'RGBW' : 'SPI';
      }
      if (typeof window.receiverTypeOf === 'function') return String(window.receiverTypeOf(value)).toUpperCase() === 'RGBW' ? 'RGBW' : 'SPI';
    } catch (_) { /* fall through */ }
    return String(value?.receiverType || value?.type || 'SPI').toUpperCase() === 'RGBW' ? 'RGBW' : 'SPI';
  };
  const toastMessage = value => {
    if (typeof window.toast === 'function') window.toast(value);
  };

  /* This is deliberately a single startup transaction.  The pure catalogue
     migration runs once, and local storage is only touched when its canonical
     JSON differs.  Rebinding the active objects keeps the V20 compatibility
     layer on the migrated tree before any V21 rendering or save wrapper runs. */
  function migrateLegacyAnimationNamesOnce() {
    if (animationNameMigrationRan) return false;
    animationNameMigrationRan = true;
    const database = currentDatabase();
    if (!database || typeof ANIMATION_CATALOG?.migrateLegacyNames !== 'function') return false;
    try {
      const before = JSON.stringify(database);
      const migrated = ANIMATION_CATALOG.migrateLegacyNames(database);
      const after = JSON.stringify(migrated);
      if (after === before) {
        document.documentElement.dataset.v21AnimationNames = 'unchanged';
        return false;
      }
      const locationId = currentLocation()?.id || database.activeInstallationId;
      const zoneId = currentZone()?.id;
      const groupId = currentGroup()?.id;
      db = migrated;
      install = array(db.installations).find(item => item.id === locationId) || array(db.installations)[0] || null;
      zone = array(install?.zones).find(item => item.id === zoneId) || array(install?.zones)[0] || null;
      group = array(zone?.groups).find(item => item.id === groupId) || array(zone?.groups)[0] || null;
      localStorage.setItem('aluv12', after);
      document.documentElement.dataset.v21AnimationNames = 'migrated';
      return true;
    } catch (error) {
      document.documentElement.dataset.v21AnimationNames = 'error';
      return false;
    }
  }

  function updateVersionMarkers() {
    document.documentElement.dataset.aluvisionVersion = VERSION;
    document.body?.classList.add('v21');
    const build = document.querySelector('meta[name="aluvision-build"]');
    if (build) build.content = VERSION;
  }

  function syncCanonicalModel(reason = 'runtime') {
    if (!CORE || typeof CORE.migrate !== 'function') return null;
    const database = currentDatabase();
    if (!database) return null;
    try {
      canonicalModel = CORE.migrate(database, {
        installationName: currentLocation()?.name || 'Aluvision Lighting',
        migratedAt: new Date().toISOString()
      });
      CORE.validateModel(canonicalModel);
      localStorage.setItem(CORE.storageKey, JSON.stringify(canonicalModel));
      canonicalError = '';
      document.documentElement.dataset.v21Model = String(CORE.schemaVersion);
      document.documentElement.dataset.v21ModelReason = reason;
      return canonicalModel;
    } catch (error) {
      canonicalError = String(error?.message || error);
      document.documentElement.dataset.v21Model = 'error';
      return null;
    }
  }

  function installCanonicalMirror() {
    const previousSave = window.save;
    if (typeof previousSave === 'function' && !previousSave.__v21Wrapped) {
      const wrapped = function v21Save(...args) {
        const result = previousSave.apply(this, args);
        // This is a derived cache, not the authoritative installation save.
        // Do not repeatedly migrate/stringify the complete installation while
        // a user drags a live slider. The original save still runs immediately.
        scheduleCanonicalSave();
        return result;
      };
      wrapped.__v21Wrapped = true;
      window.save = wrapped;
      try { save = wrapped; } catch (_) { /* Global lexical binding is optional. */ }
    }
    window.addEventListener('pagehide', flushCanonicalSave);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushCanonicalSave();
    });
    syncCanonicalModel('startup');
  }

  function flushCanonicalSave() {
    if (!canonicalSaveTimer) return;
    clearTimeout(canonicalSaveTimer);
    canonicalSaveTimer = 0;
    canonicalSaveStarted = 0;
    syncCanonicalModel('save');
  }

  function scheduleCanonicalSave() {
    const now = Date.now();
    if (!canonicalSaveStarted) canonicalSaveStarted = now;
    clearTimeout(canonicalSaveTimer);
    canonicalSaveTimer = setTimeout(flushCanonicalSave, Math.min(140, Math.max(0, 600 - (now - canonicalSaveStarted))));
  }

  function modalKeyFromHtml(html) {
    const source = String(html || '');
    const explicit = source.match(/data-(?:v21-view|phase|v1811)=["']([^"']+)/i)?.[1];
    if (explicit) return explicit;
    const heading = source.match(/<h1[^>]*>(.*?)<\/h1>/is)?.[1]
      ?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return heading || 'modal';
  }

  function installStableModal() {
    const previousModal = window.modal;
    if (typeof previousModal !== 'function' || previousModal.__v21Wrapped) return;
    let modalGeneration = 0;
    let opener = null;
    let openerBookmark = null;
    const wrapped = function v21Modal(html, options = {}) {
      const generation = ++modalGeneration;
      const host = document.getElementById('modal');
      const body = document.getElementById('modalBody');
      const active = document.activeElement;
      const wasOpen = host && !host.hidden;
      if (!wasOpen) {
        opener = active;
        openerBookmark = active ? { id: active.id, action: active.getAttribute('onclick'), page: active.closest('.page')?.id } : null;
      }
      const bookmark = body?.contains(active) ? { id: active.id, action: active.getAttribute('onclick'), start: active.selectionStart, end: active.selectionEnd } : null;
      if (body && lastModalKey) modalPositions.set(lastModalKey, body.scrollTop || 0);
      const nextKey = options?.viewKey || modalKeyFromHtml(html);
      const keep = Boolean(body && nextKey === lastModalKey && !isGuideActive());
      const wanted = keep ? modalPositions.get(nextKey) || 0 : 0;
      body?.classList.add('v21-modal-updating');
      const result = previousModal.call(this, html);
      lastModalKey = nextKey;
      const nextBody = document.getElementById('modalBody');
      const nextHost = document.getElementById('modal');
      if (nextHost && nextBody && !isGuideActive()) {
        nextHost.setAttribute('role', 'dialog');
        nextHost.setAttribute('aria-modal', 'true');
        const title = nextBody.querySelector('h1,h2');
        if (title) {
          if (!title.id) title.id = 'v21-dialog-title';
          nextHost.setAttribute('aria-labelledby', title.id);
        } else nextHost.removeAttribute('aria-labelledby');
        nextBody.tabIndex = -1;
        let focus = keep && bookmark?.id ? document.getElementById(bookmark.id) : null;
        if (!focus && keep && bookmark?.action) focus = [...nextBody.querySelectorAll('button[onclick]')].find(button => button.getAttribute('onclick') === bookmark.action);
        if (!nextBody.contains(focus)) focus = nextBody;
        focus.focus({ preventScroll: true });
        if (focus !== nextBody && bookmark?.start != null && typeof focus.setSelectionRange === 'function') {
          try { focus.setSelectionRange(bookmark.start, bookmark.end); } catch (_) { /* number/range inputs do not expose a selection */ }
        }
      }
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (generation !== modalGeneration) return;
        const nextBody = document.getElementById('modalBody');
        if (!nextBody) return;
        const maximum = Math.max(0, nextBody.scrollHeight - nextBody.clientHeight);
        nextBody.scrollTop = Math.min(wanted, maximum);
        nextBody.classList.remove('v21-modal-updating');
      }));
      return result;
    };
    wrapped.__v21Wrapped = true;
    window.modal = wrapped;
    try { modal = wrapped; } catch (_) { /* Global lexical binding is optional. */ }

    const previousClose = window.closeModal;
    if (typeof previousClose === 'function' && !previousClose.__v21Wrapped) {
      const close = function v21CloseModal(...args) {
        const generation = ++modalGeneration;
        const body = document.getElementById('modalBody');
        if (body && lastModalKey) modalPositions.set(lastModalKey, body.scrollTop || 0);
        lastModalKey = '';
        const result = previousClose.apply(this, args);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (generation !== modalGeneration || !document.getElementById('modal')?.hidden) return;
          let target = opener?.isConnected ? opener : null;
          if (!target && openerBookmark?.id) target = document.getElementById(openerBookmark.id);
          const page = document.querySelector('.page.on');
          if (!target && openerBookmark?.action && page?.id === openerBookmark.page) {
            target = [...page.querySelectorAll('button[onclick]')].find(button => button.getAttribute('onclick') === openerBookmark.action);
          }
          if (!target?.getClientRects().length) {
            target = page;
            if (target) target.tabIndex = -1;
          }
          target?.focus({ preventScroll: true });
          opener = null;
          openerBookmark = null;
        }));
        return result;
      };
      close.__v21Wrapped = true;
      window.closeModal = close;
      try { closeModal = close; } catch (_) { /* Global lexical binding is optional. */ }
    }
    document.addEventListener('keydown', event => {
      const host = document.getElementById('modal');
      const body = document.getElementById('modalBody');
      if (!host || host.hidden || !body || isGuideActive()) return;
      if (event.key === 'Tab') {
        const focusable = [...body.querySelectorAll('button,a[href],input,select,textarea,[tabindex]')]
          .filter(node => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length && !node.closest('[hidden],[inert]'));
        const first = focusable[0], last = focusable.at(-1), active = document.activeElement;
        if (!first) { event.preventDefault(); body.focus({ preventScroll: true }); }
        else if (!body.contains(active) || active === body || (event.shiftKey && active === first) || (!event.shiftKey && active === last)) {
          event.preventDefault(); (event.shiftKey ? last : first).focus({ preventScroll: true });
        }
      }
    }, true);
  }

  function allGroups(scope = 'all') {
    const location = currentLocation();
    const selectedZone = currentZone();
    if (!location) return [];
    if (scope === 'zone') return array(selectedZone?.groups);
    if (scope === 'group') return currentGroup() ? [currentGroup()] : [];
    return array(location.zones).flatMap(item => array(item?.groups));
  }

  function forceStaticState(state) {
    if (!state) return;
    state.animation = 'Static Color';
    state.engine = 'STATIC';
    state.variant = 0;
    state.colorCount = 1;
    state.backgroundOn = false;
    state.background = '#000000';
    state.backgroundWhite = 0;
    state.backgroundRgbEnabled = false;
    state.backgroundWhiteEnabled = false;
    state.bgBrightness = 0;
    state.restartToken = (Number(state.restartToken) || 0) + 1;
    state.previewStartedAt = (window.performance?.now?.() || Date.now()) / 1000;
  }

  function installQuickColourInvariant() {
    const previous = window.applyUnifiedBatch;
    if (typeof previous !== 'function' || previous.__v21Wrapped) return;
    const wrapped = function v21ApplyUnifiedBatch(scope = 'all') {
      const selected = typeof window.unifiedScopeGroups === 'function'
        ? window.unifiedScopeGroups(scope)
        : allGroups(scope);
      array(selected).forEach(item => {
        forceStaticState(item?.state);
        if (item?.parallelLineStates) {
          Object.keys(item.parallelLineStates).forEach(id => forceStaticState(item.parallelLineStates[id]));
        }
      });
      const result = previous.apply(this, arguments);
      queueMicrotask(() => syncCanonicalModel('quick-static-colour'));
      return result;
    };
    wrapped.__v21Wrapped = true;
    window.applyUnifiedBatch = wrapped;
    try { applyUnifiedBatch = wrapped; } catch (_) { /* Global lexical binding is optional. */ }
  }

  function deviceForLine(line) {
    const database = currentDatabase();
    return array(database?.devices).find(device => String(device?.id) === String(line?.deviceId)) || null;
  }

  function linkedDevice(device) {
    const mode = String(device?.rgbwOutputMode || '').toLowerCase();
    return mode === 'linked' || device?.rgbwLinked === true;
  }

  function logicalRgbwLines(selectedGroup) {
    const source = array(selectedGroup?.receivers).filter(line => line && line.active !== false);
    const result = [];
    const consumed = new Set();
    source.forEach((line, index) => {
      if (!line || consumed.has(line.id)) return;
      const device = deviceForLine(line);
      const siblings = source.filter(item => item?.deviceId === line.deviceId);
      if (linkedDevice(device) && siblings.length > 1) {
        siblings.forEach(item => consumed.add(item.id));
        result.push({
          key: `linked:${line.deviceId}`,
          lineIds: siblings.map(item => item.id),
          label: `${text('LED Line', 'LED Line', 'LED Line', 'LED Line')} ${result.length + 1}`,
          detail: text('Twee poorten samen', 'Two ports linked', 'Deux ports liés', 'Zwei Ports gekoppelt'),
          linked: true
        });
        return;
      }
      consumed.add(line.id);
      result.push({
        key: String(line.id),
        lineIds: [line.id],
        label: `${text('LED Line', 'LED Line', 'LED Line', 'LED Line')} ${result.length + 1}`,
        detail: `${text('Receiver', 'Receiver', 'Récepteur', 'Receiver')} ${device?.number || index + 1} · P${Number(line.port) || 1}`,
        linked: false
      });
    });
    return result;
  }

  function rgbwPreviewTopology(selectedGroup) {
    const logical = logicalRgbwLines(selectedGroup);
    const rawLayout = String(selectedGroup?.layout || '').toLowerCase();
    const panel = rawLayout === 'parallel' || rawLayout === 'panel' || rawLayout === 'stacked';
    const orientation = panel && String(selectedGroup?.parallelOrientation || '').toLowerCase() === 'vertical'
      ? 'vertical'
      : 'horizontal';
    return {
      logical,
      panel,
      orientation,
      layout: panel ? `panel-${orientation}` : 'single',
      renderCount: logical.length ? (panel ? logical.length : 1) : 0
    };
  }

  function selectedRgbwIds(selectedGroup) {
    const available = new Set(array(selectedGroup?.receivers)
      .filter(line => line && line.active !== false)
      .map(line => String(line.id)));
    if (!rgbwPreviewTopology(selectedGroup).panel) return [...available];
    const stored = array(selectedGroup?.v21SelectedLineIds).map(String).filter(id => available.has(id));
    return stored.length ? stored : [...available];
  }

  function rgbwEffectUsesEveryLine(effectOrState) {
    const runtimeEffects = array(window.AluvisionAnimationRuntime?.rgbwEffects);
    const source = effectOrState && typeof effectOrState === 'object' ? effectOrState : {};
    if (source.line === true || source.kind === 'tunnel-lines') return true;
    const name = typeof effectOrState === 'string'
      ? effectOrState
      : source.name || source.animation || '';
    const variant = Number(source.variant);
    const engine = String(source.engine || '').toUpperCase();
    const effect = runtimeEffects.find(item => item?.name === name)
      || (Number.isFinite(variant)
        ? runtimeEffects.find(item => Number(item?.variant) === variant
          && (!engine || String(item?.engine || '').toUpperCase() === engine))
        : null);
    return Boolean(effect?.line === true || effect?.kind === 'tunnel-lines');
  }

  function selectAllRgbwLinesForEffect(selectedGroup, effectOrState) {
    if (!selectedGroup || receiverType(selectedGroup) !== 'RGBW'
      || !rgbwEffectUsesEveryLine(effectOrState)) return false;
    const everyLine = array(selectedGroup.receivers)
      .filter(line => line && line.active !== false)
      .map(line => line.id);
    selectedGroup.v21SelectedLineIds = everyLine;
    /* Keep the V20 parallel editor in the same scope. Its empty legacy list
       means all lines whenever parallelApplyAll is true. */
    selectedGroup.parallelApplyAll = true;
    selectedGroup.parallelSelectedIds = [];
    return true;
  }

  function isAllRgbwSelected(selectedGroup) {
    const available = array(selectedGroup?.receivers)
      .filter(line => line && line.active !== false)
      .map(line => String(line.id));
    const selected = selectedRgbwIds(selectedGroup);
    return available.length === selected.length && available.every(id => selected.includes(id));
  }

  function rgbwStateSwatch(stateValue) {
    const state = stateValue || {};
    const first = (value, fallback) => Array.isArray(value) ? (value[0] ?? fallback) : (value ?? fallback);
    const rgbOn = first(state.rgbEnabled, true) !== false;
    const whiteOn = first(state.whiteEnabled, true) !== false && Number(first(state.whiteChannels, 0)) > 0;
    if (!rgbOn && whiteOn) return '#fff1d2';
    if (!rgbOn && !whiteOn) return '#111311';
    const raw = String(first(state.colors, '#ffffff')).trim();
    return /^(?:#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\))$/i.test(raw) ? raw : '#ffffff';
  }

  function rgbwStateColourLabel(stateValue) {
    const state = stateValue || {};
    const first = (value, fallback) => Array.isArray(value) ? (value[0] ?? fallback) : (value ?? fallback);
    const rgbOn = first(state.rgbEnabled, true) !== false;
    const whiteOn = first(state.whiteEnabled, true) !== false && Number(first(state.whiteChannels, 0)) > 0;
    if (!rgbOn && !whiteOn) return text('Uit', 'Off', 'Éteint', 'Aus');
    if (!rgbOn && whiteOn) return text('Alleen wit', 'White only', 'Blanc uniquement', 'Nur Weiß');
    const colour = rgbwStateSwatch(state).toUpperCase();
    return whiteOn ? `${colour} + W` : colour;
  }

  function logicalRgbwTargetSelected(item, selectedIds) {
    return item.lineIds.length > 0 && item.lineIds.every(id => selectedIds.has(String(id)));
  }

  function activeRgbwTargetLabel(selectedGroup, topology = rgbwPreviewTopology(selectedGroup)) {
    if (!topology.panel || topology.logical.length <= 1) {
      return text('Hele LED Line', 'Complete LED Line', 'LED Line complète', 'Ganze LED Line');
    }
    if (isAllRgbwSelected(selectedGroup)) {
      return text('Alle LED Lines', 'All LED Lines', 'Toutes les LED Lines', 'Alle LED Lines');
    }
    const selected = new Set(selectedRgbwIds(selectedGroup));
    const active = topology.logical.find(item => logicalRgbwTargetSelected(item, selected));
    return active?.label || text('Eén LED Line', 'One LED Line', 'Une LED Line', 'Eine LED Line');
  }

  function rgbwPreviewGuideLines(selectedGroup, topology = rgbwPreviewTopology(selectedGroup)) {
    if (topology.panel) return topology.logical;
    return [{
      key: 'all',
      lineIds: array(selectedGroup?.receivers).filter(line => line && line.active !== false).map(line => line.id),
      label: text('Eén doorlopende LED Line', 'One continuous LED Line', 'Une LED Line continue', 'Eine durchgehende LED Line')
    }];
  }

  function syncRgbwPreviewTargets(selectedGroup) {
    if (!selectedGroup || receiverType(selectedGroup) !== 'RGBW') return;
    const topology = rgbwPreviewTopology(selectedGroup);
    const selected = new Set(selectedRgbwIds(selectedGroup));
    const selectedKeys = new Set(topology.logical.filter(item => logicalRgbwTargetSelected(item, selected)).map(item => String(item.key)));
    const all = isAllRgbwSelected(selectedGroup);
    const activeLabel = activeRgbwTargetLabel(selectedGroup, topology);
    document.querySelectorAll('#zones [data-v21-primary-preview][data-v21-preview-type="whole-line"]').forEach(preview => {
      preview.dataset.v21TargetMode = all ? 'all' : 'one';
      preview.dataset.v21TargetLabel = activeLabel;
      preview.setAttribute('aria-label', `${text('Live preview van volledige LED Lines', 'Live preview of complete LED Lines', 'Aperçu des LED Lines complètes', 'Live-Vorschau vollständiger LED Lines')} · ${activeLabel}`);
      const guide = preview.querySelector('.v21-whole-line-guide');
      if (!guide) return;
      guide.dataset.v21Selection = all ? 'all' : 'one';
      guide.querySelectorAll('[data-v21-preview-line-key]').forEach(item => {
        const target = item.dataset.v21PreviewLineKey === 'all'
          ? true
          : selectedKeys.has(item.dataset.v21PreviewLineKey);
        item.classList.toggle('is-target', target);
        item.classList.toggle('is-muted', !target);
        item.querySelector('button')?.setAttribute('aria-pressed', String(target));
      });
    });
  }

  function rgbwLineSelectorMarkup(selectedGroup, context = 'colour') {
    const topology = rgbwPreviewTopology(selectedGroup);
    const logical = topology.logical;
    if (!logical.length) return '';
    const selected = new Set(selectedRgbwIds(selectedGroup));
    const all = isAllRgbwSelected(selectedGroup);
    const storedStates = parallelStates(selectedGroup);
    const lineState = item => storedStates[item.lineIds[0]] || selectedGroup.state || {};
    const allColours = [...new Set(logical.map(item => rgbwStateSwatch(lineState(item))))];
    const allAnimations = [...new Set(logical.map(item => lineState(item).animation || text('Vaste kleur', 'Solid colour', 'Couleur fixe', 'Feste Farbe')))];
    const allSwatch = allColours.length > 1
      ? `linear-gradient(90deg,${allColours.map((colour, index) => `${colour} ${Math.round(index * 100 / allColours.length)}%,${colour} ${Math.round((index + 1) * 100 / allColours.length)}%`).join(',')})`
      : allColours[0];
    const colourContext = context === 'colour';
    const allState = colourContext
      ? allColours.length === 1
        ? rgbwStateColourLabel(lineState(logical[0]))
        : text('Meerdere kleuren', 'Multiple colours', 'Plusieurs couleurs', 'Mehrere Farben')
      : allAnimations.length === 1
        ? allAnimations[0]
        : text('Meerdere animaties', 'Multiple animations', 'Plusieurs animations', 'Mehrere Animationen');
    const oneLogicalTarget = !topology.panel || logical.length === 1;
    const activeLabel = activeRgbwTargetLabel(selectedGroup, topology);
    const heading = context === 'colour'
      ? text('Kleur voor', 'Colour for', 'Couleur pour', 'Farbe für')
      : text('Animatie voor', 'Animation for', 'Animation pour', 'Animation für');
    const contextKey = context === 'animation-picker' ? 'animation-picker' : context === 'animation' ? 'animation' : 'colour';
    const allTitle = oneLogicalTarget
      ? text('Hele doorlopende LED Line', 'Complete continuous LED Line', 'LED Line continue complète', 'Ganze durchgehende LED Line')
      : text('Alle LED Lines', 'All LED Lines', 'Toutes les LED Lines', 'Alle LED Lines');
    const allDetail = oneLogicalTarget
      ? `${logical.length} ${text('uitgangen als één lijn', 'outputs as one line', 'sorties comme une ligne', 'Ausgänge als eine Linie')}`
      : `${logical.length} ${text('LED Lines samen', 'LED Lines together', 'LED Lines ensemble', 'LED Lines zusammen')}`;
    const buttons = [
      `<button type="button" class="${all ? 'on' : ''}" data-v21-line-key="all" role="radio" aria-checked="${all}" aria-pressed="${all}" onclick="v21SelectRgbwLines('${safe(selectedGroup.id)}','all','${contextKey}')"><i>∞<em style="background:${safe(allSwatch)}"></em></i><span><b>${allTitle}</b><small class="v21-line-state">${safe(allState)}</small><small>${allDetail}</small></span></button>`,
      ...(!oneLogicalTarget ? logical.map((item, index) => {
        const active = !all && item.lineIds.every(id => selected.has(String(id))) && selected.size === item.lineIds.length;
        const remembered = lineState(item);
        const colour = rgbwStateSwatch(remembered);
        const animation = remembered.animation || text('Vaste kleur', 'Solid colour', 'Couleur fixe', 'Feste Farbe');
        const stateLabel = colourContext ? rgbwStateColourLabel(remembered) : animation;
        return `<button type="button" class="${active ? 'on' : ''}" data-v21-line-key="${safe(item.key)}" role="radio" aria-checked="${active}" aria-pressed="${active}" onclick="v21SelectRgbwLines('${safe(selectedGroup.id)}','${safe(item.key)}','${contextKey}')"><i>${index + 1}<em style="background:${safe(colour)}"></em></i><span><b>${text('LED Line', 'LED Line', 'LED Line', 'LED Line')} ${index + 1}</b><small class="v21-line-state">${safe(stateLabel)}</small><small>${safe(item.detail)}</small></span></button>`;
      }) : [])
    ];
    return `<section class="v21-rgbw-line-scope" data-v21-view="rgbw-line-scope" data-v21-line-scope-context="${contextKey}"><div class="v21-line-scope-head"><span><small>${text('BEDIEN', 'CONTROL', 'COMMANDER', 'STEUERN')}</small><h3>${heading}</h3></span><span class="scope">${safe(activeLabel)}</span></div><div class="v21-line-selector" data-v21-line-count="${logical.length}" data-v21-many="${logical.length > 4}" role="radiogroup" aria-label="${heading}">${buttons.join('')}</div></section>`;
  }

  function refreshRgbwLineScopes(selectedGroup) {
    if (!selectedGroup || receiverType(selectedGroup) !== 'RGBW') return;
    const modalBody = document.getElementById('modalBody');
    const modalScroll = modalBody?.scrollTop || 0;
    document.querySelectorAll('[data-v21-line-scope-context]').forEach(scope => {
      const context = scope.dataset.v21LineScopeContext || 'colour';
      const template = document.createElement('template');
      template.innerHTML = rgbwLineSelectorMarkup(selectedGroup, context);
      const replacement = template.content.firstElementChild;
      if (!replacement || scope.outerHTML === replacement.outerHTML) return;
      const existingButtons = [...scope.querySelectorAll('.v21-line-selector > button')];
      const newButtons = [...replacement.querySelectorAll('.v21-line-selector > button')];
      const sameTargets = existingButtons.length === newButtons.length &&
        existingButtons.every((button, index) => button.dataset.v21LineKey === newButtons[index].dataset.v21LineKey);
      if (!sameTargets) { scope.replaceWith(replacement); return; }
      // Keep actual target buttons alive while a colour slider is moving:
      // focus, touch gestures and keyboard navigation must not be discarded.
      const heading = scope.querySelector('.v21-line-scope-head');
      const newHeading = replacement.querySelector('.v21-line-scope-head');
      if (heading && newHeading && heading.innerHTML !== newHeading.innerHTML) heading.innerHTML = newHeading.innerHTML;
      existingButtons.forEach((button, index) => {
        const next = newButtons[index];
        for (const attribute of ['class', 'aria-checked', 'aria-pressed']) {
          if (button.getAttribute(attribute) !== next.getAttribute(attribute)) button.setAttribute(attribute, next.getAttribute(attribute));
        }
        if (button.innerHTML !== next.innerHTML) button.innerHTML = next.innerHTML;
      });
    });
    if (modalBody) modalBody.scrollTop = modalScroll;
    syncRgbwPreviewTargets(selectedGroup);
  }

  function queueRgbwLineScopeRefresh(selectedGroup) {
    lineScopeRefreshGroup = selectedGroup;
    if (lineScopeRefreshQueued) return;
    lineScopeRefreshQueued = true;
    requestAnimationFrame(() => {
      lineScopeRefreshQueued = false;
      const pending = lineScopeRefreshGroup;
      lineScopeRefreshGroup = null;
      if (pending === currentGroup()) refreshRgbwLineScopes(pending);
    });
  }

  function selectedRgbwAnimationNames(selectedGroup) {
    const selected = new Set(selectedRgbwIds(selectedGroup));
    const storedStates = parallelStates(selectedGroup);
    const names = rgbwPreviewTopology(selectedGroup).logical
      .filter(item => logicalRgbwTargetSelected(item, selected))
      .map(item => storedStates[item.lineIds[0]]?.animation || selectedGroup.state?.animation || '')
      .filter(Boolean);
    return [...new Set(names)];
  }

  function syncRgbwAnimationPicker(selectedGroup) {
    const body = document.getElementById('modalBody');
    if (!body?.querySelector('[data-v21-line-scope-context="animation-picker"]')) return;
    const names = selectedRgbwAnimationNames(selectedGroup);
    const activeName = names.length === 1 && names[0] !== 'Static Color' ? names[0] : '';
    const mixed = names.length > 1;
    body.querySelectorAll('.rgbw-effect-card').forEach(card => {
      const match = (card.getAttribute('onclick') || '').match(/setRgbwEffect\(['"]([^'"]+)/);
      const active = Boolean(activeName && match?.[1] === activeName);
      card.classList.toggle('on', active);
      card.setAttribute('aria-pressed', String(active));
      const marker = card.querySelector('.v1811-selected-mark');
      if (!active) marker?.remove();
      else if (!marker) card.insertAdjacentHTML('beforeend', '<strong class="v1811-selected-mark">✓</strong>');
    });
    const hero = body.querySelector('.v1811-library-current');
    if (!hero) return;
    const name = activeName
      || (mixed
        ? text('Verschillende animaties', 'Multiple animations', 'Plusieurs animations', 'Mehrere Animationen')
        : text('Kies een animatie', 'Choose an animation', 'Choisir une animation', 'Animation wählen'));
    const title = hero.querySelector('span > b');
    const eyebrow = hero.querySelector('span > small');
    const description = hero.querySelector('span > em');
    const mark = hero.querySelector(':scope > strong');
    if (title) title.textContent = name;
    if (eyebrow) eyebrow.textContent = activeName
      ? text('ACTIEF OP DEZE SELECTIE', 'ACTIVE ON THIS SELECTION', 'ACTIF SUR CETTE SÉLECTION', 'AKTIV FÜR DIESE AUSWAHL')
      : mixed
        ? text('VERSCHILT PER LED LINE', 'DIFFERS BY LED LINE', 'DIFFÈRE PAR LED LINE', 'JE LED LINE UNTERSCHIEDLICH')
        : text('KLAAR OM TE KIEZEN', 'READY TO CHOOSE', 'PRÊT À CHOISIR', 'BEREIT ZUR AUSWAHL');
    if (mark) mark.textContent = activeName ? '✓' : '…';
    const effect = array(window.AluvisionAnimationRuntime?.rgbwEffects).find(item => item?.name === activeName);
    if (description) {
      const copy = effect?.description;
      description.textContent = activeName
        ? (typeof copy === 'string' ? copy : copy?.[language()] || copy?.nl || activeName)
        : mixed
          ? text('Kies een animatie om de geselecteerde LED Lines gelijk te maken.', 'Choose an animation to match the selected LED Lines.', 'Choisissez une animation pour harmoniser les LED Lines sélectionnées.', 'Wähle eine Animation für die ausgewählten LED Lines.')
          : text('De gekozen animatie wordt alleen op deze selectie toegepast.', 'The chosen animation is applied only to this selection.', 'L’animation choisie s’applique uniquement à cette sélection.', 'Die gewählte Animation gilt nur für diese Auswahl.');
    }
    const canvas = hero.querySelector('canvas');
    if (canvas && effect) {
      const index = array(window.AluvisionAnimationRuntime?.rgbwEffects).indexOf(effect);
      canvas.dataset.rgbwEffect = String(index);
      canvas.dataset.previewLive = '1';
    }
  }

  function groupById(id) {
    const database = currentDatabase();
    for (const location of array(database?.installations)) {
      for (const selectedZone of array(location?.zones)) {
        const found = array(selectedZone?.groups).find(item => String(item?.id) === String(id));
        if (found) return found;
      }
    }
    return null;
  }

  function parallelStates(selectedGroup) {
    if (!selectedGroup.parallelLineStates || typeof selectedGroup.parallelLineStates !== 'object') {
      selectedGroup.parallelLineStates = {};
    }
    array(selectedGroup.receivers).forEach(line => {
      if (!selectedGroup.parallelLineStates[line.id]) selectedGroup.parallelLineStates[line.id] = duplicate(selectedGroup.state || {});
    });
    return selectedGroup.parallelLineStates;
  }

  window.v21SelectRgbwLines = function v21SelectRgbwLines(groupId, key, context = '') {
    const selectedGroup = groupById(groupId);
    if (!selectedGroup || receiverType(selectedGroup) !== 'RGBW') return;
    const topology = rgbwPreviewTopology(selectedGroup);
    const logical = topology.logical;
    const choice = logical.find(item => item.key === key);
    selectedGroup.v21SelectedLineIds = key === 'all' || !topology.panel
      ? array(selectedGroup.receivers).filter(line => line && line.active !== false).map(line => line.id)
      : array(choice?.lineIds);
    selectedGroup.parallelApplyAll = isAllRgbwSelected(selectedGroup);
    selectedGroup.parallelSelectedIds = selectedGroup.parallelApplyAll
      ? [] : selectedRgbwIds(selectedGroup);
    const states = parallelStates(selectedGroup);
    if (choice?.lineIds?.length) {
      const remembered = states[choice.lineIds[0]];
      if (remembered) selectedGroup.state = duplicate(remembered);
    }
    if (typeof window.save === 'function') window.save('queued');
    if (context === 'animation-picker') {
      refreshRgbwLineScopes(selectedGroup);
      syncRgbwAnimationPicker(selectedGroup);
      return;
    }
    if (typeof window.renderModal === 'function') {
      window.renderModal();
      requestAnimationFrame(() => syncRgbwPreviewTargets(selectedGroup));
    }
  };

  function rawTargets(selectedGroup) {
    try {
      if (typeof window.targets === 'function') return array(window.targets(selectedGroup));
      if (typeof targets === 'function') return array(targets(selectedGroup));
    } catch (_) { /* no target builder */ }
    return [];
  }

  function exactRgbwTargets(selectedGroup) {
    const selected = new Set(selectedRgbwIds(selectedGroup));
    const linesById = new Map(array(selectedGroup.receivers).map(line => [String(line.id), line]));
    const originals = rawTargets(selectedGroup).filter(target => linesById.get(String(target.id))?.active !== false);
    const byDevice = new Map();
    originals.forEach(target => {
      const key = String(target.deviceId || target.physicalRid || target.rid || '');
      const bucket = byDevice.get(key) || [];
      bucket.push(target);
      byDevice.set(key, bucket);
    });
    const routed = [];
    byDevice.forEach(bucket => {
      const device = deviceForLine(linesById.get(String(bucket[0]?.id)));
      const ports = new Set(bucket.map(item => Number(item.port || item.outputPort) || 1));
      if (linkedDevice(device) && ports.has(1) && ports.has(2)) {
        const first = bucket[0];
        routed.push({ ...first, id: `v21-linked-${first.deviceId}`, port: 0, outputPort: 0,
          portMask: 3, linkedPorts: [1, 2], logicalLineIds: bucket.map(item => item.id) });
      } else {
        bucket.forEach(item => routed.push({ ...item, logicalLineIds: [item.id] }));
      }
    });
    const sharedTimeline = rgbwEffectUsesEveryLine(selectedGroup.state);
    const selectedTargets = routed.map((target, index) => ({ ...target, topologyIndex: index }))
      .filter(target => target.logicalLineIds.some(id => selected.has(String(id))));
    const count = Math.max(1, sharedTimeline ? routed.length : selectedTargets.length);
    return selectedTargets.map((target, index) => {
      // A colour edit on tunnel row 4 must keep row 4's phase, not turn it into
      // row 1 of a new single-row tunnel or recolour all the other rows.
      const lineIndex = sharedTimeline ? target.topologyIndex : index;
      const { topologyIndex, ...wireTarget } = target;
      return { ...wireTarget, lineIndex, lineCount: count,
        layoutParallel: rgbwPreviewTopology(selectedGroup).panel, pixels: 1,
        offset: lineIndex, groupPixels: count };
    });
  }

  function captureSelectedLineState(selectedGroup) {
    const selected = selectedRgbwIds(selectedGroup);
    const states = parallelStates(selectedGroup);
    selected.forEach(id => { states[id] = duplicate(selectedGroup.state || {}); });
  }

  function nextGeneration(groupId) {
    const next = (commandGeneration.get(groupId) || 0) + 1;
    commandGeneration.set(groupId, next);
    return next;
  }

  async function sendExactRgbw(selectedGroup, action = 'live', quiet = true) {
    const selectedTargets = exactRgbwTargets(selectedGroup);
    if (!selectedTargets.length) return { results: [] };
    const generation = nextGeneration(selectedGroup.id);
    let commandState;
    try { commandState = typeof window.state === 'function' ? window.state(selectedGroup) : state(selectedGroup); }
    catch (_) { commandState = duplicate(selectedGroup.state || {}); }
    commandState = {
      ...commandState,
      receiverType: 'RGBW',
      commandGeneration: generation,
      transitionMs: clamp(commandState.transitionMs, 0, 1800000, 240)
    };
    try {
      const response = await window.api('/api/command', {
        action,
        timelineId: `${currentLocation()?.id || 'installation'}:${selectedGroup.id}:rgbw:v21`,
        generation,
        synchronize: action === 'live',
        scheduleDelayMs: 160,
        state: commandState,
        targets: selectedTargets
      });
      const results = array(response?.results);
      const confirmed = results.length === selectedTargets.length && results.every(result => result?.confirmed === true || result?.applied === true);
      if (!quiet) toastMessage(confirmed
        ? text('Live toegepast', 'Applied live', 'Appliqué en direct', 'Live angewendet')
        : text('Wijziging verzonden; bevestiging volgt', 'Change sent; confirmation pending', 'Modification envoyée ; confirmation en attente', 'Änderung gesendet; Bestätigung folgt'));
      return response;
    } catch (error) {
      if (!quiet) toastMessage(text('Verbinding onderbroken · wijziging blijft bewaard', 'Connection interrupted · change remains saved', 'Connexion interrompue · modification conservée', 'Verbindung unterbrochen · Änderung bleibt gespeichert'));
      return { results: [], error: String(error?.message || error) };
    }
  }

  function installExactRgbwRouting() {
    const previousQueue = window.queueLive;
    if (typeof previousQueue === 'function' && !previousQueue.__v21Wrapped) {
      const queue = function v21QueueLive(selectedGroup = currentGroup()) {
        if (!selectedGroup || receiverType(selectedGroup) !== 'RGBW') {
          return previousQueue.apply(this, arguments);
        }
        captureSelectedLineState(selectedGroup);
        queueRgbwLineScopeRefresh(selectedGroup);
        if (typeof window.save === 'function') window.save('queued');
        const key = String(selectedGroup.id);
        clearTimeout(rgbwLiveTimers.get(key));
        rgbwLiveTimers.set(key, setTimeout(() => {
          rgbwLiveTimers.delete(key);
          sendExactRgbw(selectedGroup, 'live', true);
        }, 28));
      };
      queue.__v21Wrapped = true;
      window.queueLive = queue;
      try { queueLive = queue; } catch (_) { /* Global lexical binding is optional. */ }
    }

    const previousLive = window.live;
    if (typeof previousLive === 'function' && !previousLive.__v21Wrapped) {
      const liveNow = function v21Live(selectedGroup = currentGroup(), quiet = false) {
        if (!selectedGroup || receiverType(selectedGroup) !== 'RGBW') {
          return previousLive.apply(this, arguments);
        }
        captureSelectedLineState(selectedGroup);
        return sendExactRgbw(selectedGroup, 'live', quiet);
      };
      liveNow.__v21Wrapped = true;
      window.live = liveNow;
      try { live = liveNow; } catch (_) { /* Global lexical binding is optional. */ }
    }
  }

  function installRgbwEffectScopeGuard() {
    const previous = window.setRgbwEffect;
    if (typeof previous !== 'function' || previous.__v21ScopeWrapped) return;
    const wrapped = function v21SetRgbwEffectScoped(name) {
      const selectedGroup = currentGroup();
      const effect = array(window.AluvisionAnimationRuntime?.rgbwEffects)
        .find(item => item?.name === name) || name;
      const forcedAll = selectAllRgbwLinesForEffect(selectedGroup, effect);
      const result = previous.apply(this, arguments);
      if (forcedAll && selectedGroup === currentGroup()) {
        queueRgbwLineScopeRefresh(selectedGroup);
      }
      return result;
    };
    wrapped.__v21ScopeWrapped = true;
    window.setRgbwEffect = wrapped;
    try { setRgbwEffect = wrapped; } catch (_) { /* Global lexical binding is optional. */ }
  }

  function contextMarkup() {
    const location = currentLocation();
    const selectedZone = currentZone();
    const selectedGroup = currentGroup();
    return `<nav class="v21-context-bar" aria-label="${text('Huidige plaats', 'Current location', 'Emplacement actuel', 'Aktueller Ort')}"><button type="button" onclick="closeModal();go('home')">${safe(location?.name || text('Locatie', 'Location', 'Emplacement', 'Standort'))}</button><span>›</span><button type="button" onclick="closeModal();openZone('${safe(selectedZone?.id || '')}')">${safe(selectedZone?.name || text('Zone', 'Zone', 'Zone', 'Zone'))}</button><span>›</span><strong>${safe(selectedGroup?.name || text('Groep', 'Group', 'Groupe', 'Gruppe'))}</strong></nav>`;
  }

  function ensureGroupEditorStructure(root, selectedGroup) {
    const shell = root.querySelector('.customer-group-page,.rgbw-group-ui') || (root.querySelector('.controls') ? root : null);
    const controls = shell?.querySelector('.controls');
    if (!shell || !controls) return;

    shell.querySelector(':scope > .v187-static-choice')?.remove();
    shell.querySelector(':scope > .rgbw-animation-card')?.remove();
    [...shell.children].forEach(node => {
      if (node === controls || node.classList?.contains('v1811-mode-card')) return;
      const legacyBrowser = node.classList?.contains('card') && node.querySelector('button[onclick*="animationBrowser()"]') && node.querySelector('.effectgrid,.rgbw-effect-grid');
      if (legacyBrowser) node.remove();
    });

    /* A catalogue effect may be installed after the V18 editor wrappers took
       their snapshots.  Keep the final customer editor structural instead of
       falling back to two unlabelled legacy cards for those late effects. */
    controls.classList.add('v1811-editor-stack');
    const cards = [...controls.children].filter(node => node.classList?.contains('card'));
    const colour = cards.find(card => card.classList.contains('v1811-colour-card') || card.classList.contains('effect-color-card') || card.querySelector('.unified-color-picker')) || cards[0];
    const settings = cards.find(card => card !== colour && card.classList.contains('v1811-settings-card')) || cards.find(card => card !== colour);
    cards.forEach(card => {
      if (card !== colour) card.classList.remove('v1811-colour-card');
      if (card !== settings) card.classList.remove('v1811-settings-card', 'v21-primary-settings');
    });
    if (colour) colour.classList.add('v1811-colour-card');
    if (settings) {
      settings.classList.add('v1811-settings-card', 'v21-primary-settings');
      if (controls.firstElementChild !== settings) controls.prepend(settings);
    }

    if (!shell.querySelector('.v1811-mode-card')) {
      let modeMarkup = '';
      try {
        if (receiverType(selectedGroup) === 'RGBW' && typeof v1811RgbwModeMarkup === 'function') modeMarkup = v1811RgbwModeMarkup();
        else if (typeof v1811SpiModeMarkup === 'function') modeMarkup = v1811SpiModeMarkup();
      } catch (_) { /* The compact fallback below remains fully usable. */ }
      if (!modeMarkup) {
        const isStatic = selectedGroup.state?.animation === 'Static Color';
        modeMarkup = `<section class="card v1811-mode-card"><div class="row v1811-section-heading"><span><small>1 · ${text('LICHTMODUS', 'LIGHT MODE', 'MODE LUMIÈRE', 'LICHTMODUS')}</small><h2>${safe(selectedGroup.state?.animation || text('Licht', 'Light', 'Lumière', 'Licht'))}</h2></span></div><div class="v1811-mode-options"><button type="button" class="v1811-mode-option ${isStatic ? 'on' : ''}" data-v1814-group-action="colour" onclick="setEffect('Static Color')"><span><b>${text('Vaste kleur', 'Solid colour', 'Couleur fixe', 'Feste Farbe')}</b><small>${text('Zonder beweging', 'No movement', 'Sans mouvement', 'Ohne Bewegung')}</small></span><strong>${isStatic ? '✓' : '›'}</strong></button><button type="button" class="v1811-mode-option ${isStatic ? '' : 'on'}" data-v1814-group-action="animation" onclick="animationBrowser()"><span><b>${text('Animatie kiezen', 'Choose animation', 'Choisir une animation', 'Animation wählen')}</b><small>${safe(selectedGroup.state?.animation || '')}</small></span><strong>${isStatic ? '›' : '✓'}</strong></button></div></section>`;
      }
      const template = document.createElement('template');
      template.innerHTML = modeMarkup;
      const mode = template.content.firstElementChild;
      const anchor = shell.querySelector(':scope > .parallel-scope,:scope > .stacked-layout-summary,:scope > .preview');
      if (mode) (anchor || shell.firstElementChild)?.after(mode);
    }
    const mode = shell.querySelector('.v1811-mode-card');
    if (mode && controls.parentElement === shell && mode.nextElementSibling !== controls) mode.after(controls);
  }

  function installGroupPolish() {
    const previous = window.groupUI;
    if (typeof previous !== 'function' || previous.__v21Wrapped) return;
    const wrapped = function v21GroupUI(...args) {
      const markup = previous.apply(this, args);
      const selectedGroup = currentGroup();
      if (isGuideActive() || !selectedGroup || typeof markup !== 'string') return markup;
      const template = document.createElement('template');
      template.innerHTML = markup;
      const root = template.content;
      const shell = root.querySelector('.customer-group-page,.rgbw-group-ui');
      shell?.classList.add('v21-group-page');
      ensureGroupEditorStructure(root, selectedGroup);
      const existingContext = root.querySelector('.customer-structure-route,.alv-context-path,.v21-context-bar');
      if (shell && !existingContext) shell.insertAdjacentHTML('afterbegin', contextMarkup());

      if (receiverType(selectedGroup) === 'RGBW') {
        root.querySelectorAll('.rgbw207-group-scope,:scope > .v21-rgbw-line-scope').forEach(scope => scope.remove());
        const colourCard = root.querySelector('.v1811-colour-card,.effect-color-card');
        const settingsCard = root.querySelector('.v1811-settings-card');
        const insertContextScope = (card, context) => {
          if (!card || card.querySelector(`[data-v21-line-scope-context="${context}"]`)) return;
          const scopeTemplate = document.createElement('template');
          scopeTemplate.innerHTML = rgbwLineSelectorMarkup(selectedGroup, context);
          const selector = scopeTemplate.content.firstElementChild;
          if (!selector) return;
          const heading = card.querySelector(':scope > .row,:scope > header');
          if (heading) heading.after(selector);
          else card.prepend(selector);
        };
        insertContextScope(settingsCard, 'animation');
        insertContextScope(colourCard, 'colour');
        root.querySelectorAll('[data-v188-control="width"], [data-v20-setting="width"], #tune-width')
          .forEach(element => element.closest('.setting-visual-panel,.control,.v1811-rgbw-setting')?.remove());
      }

      const settings = root.querySelector('.v1811-settings-card');
      settings?.classList.add('v21-primary-settings');
      root.querySelectorAll('button:not([type])').forEach(button => button.type = 'button');
      return template.innerHTML;
    };
    wrapped.__v21Wrapped = true;
    window.groupUI = wrapped;
    try { groupUI = wrapped; } catch (_) { /* Global lexical binding is optional. */ }
  }

  function familyCounts(scope = 'all') {
    const counts = { SPI: 0, RGBW: 0 };
    allGroups(scope).forEach(item => {
      if (!array(item?.receivers).length) return;
      const type = receiverType(item);
      counts[type] += type === 'RGBW'
        ? logicalRgbwLines(item).length
        : array(item.receivers).filter(line => line && line.active !== false).length;
    });
    return counts;
  }

  function findEffect(type, name) {
    const runtime = window.AluvisionAnimationRuntime;
    if (type === 'RGBW') return array(runtime?.rgbwEffects).find(item => item?.name === name) || null;
    return array(runtime?.effects).find(item => item?.[0] === name) || null;
  }

  function applyEffectDefaults(selectedGroup, type, effect) {
    const stateValue = selectedGroup.state || (selectedGroup.state = {});
    const defaults = type === 'RGBW' ? effect?.defaults || {} : effect?.[4] || {};
    Object.assign(stateValue, duplicate(defaults));
    if (type === 'RGBW') {
      stateValue.animation = effect.name;
      stateValue.engine = effect.engine;
      stateValue.variant = Number(effect.variant) || 0;
      stateValue.colorCount = clamp(effect.colors, 1, 4, 1);
      stateValue.receiverType = 'RGBW';
      selectAllRgbwLinesForEffect(selectedGroup, effect);
    } else {
      stateValue.animation = effect[0];
      stateValue.engine = effect[1];
      stateValue.variant = Number(effect[3]) || 0;
      stateValue.receiverType = 'SPI';
    }
    stateValue.previewStartedAt = (window.performance?.now?.() || Date.now()) / 1000;
    stateValue.restartToken = (Number(stateValue.restartToken) || 0) + 1;
  }

  window.v21ApplyQuickEffect = function v21ApplyQuickEffect(type, name, scope = 'all') {
    const normalized = type === 'RGBW' ? 'RGBW' : 'SPI';
    const effect = findEffect(normalized, name);
    if (!effect) return;
    const selected = allGroups(scope).filter(item => receiverType(item) === normalized && array(item.receivers).length);
    selected.forEach(item => {
      applyEffectDefaults(item, normalized, effect);
      if (typeof window.queueLive === 'function') window.queueLive(item);
    });
    if (typeof window.save === 'function') window.save('queued');
    if (typeof window.closeModal === 'function') window.closeModal();
    toastMessage(`${name} · ${selected.length} ${text('groep', 'group', 'groupe', 'Gruppe')}${selected.length === 1 ? '' : text('en', 's', 's', 'n')}`);
  };

  function quickEffectDescription(engine) {
    const normalized = String(engine || '').toUpperCase();
    if (normalized === 'BREATHE' || normalized === 'PULSE') return text('Zachte pulse', 'Gentle pulse', 'Pulsation douce', 'Sanfter Puls');
    if (normalized === 'GRADIENT' || normalized === 'FLOW' || normalized === 'FADE') return text('Zachte overgang', 'Smooth transition', 'Transition douce', 'Weicher Übergang');
    if (normalized === 'WAVE') return text('Vloeiende beweging', 'Flowing movement', 'Mouvement fluide', 'Fließende Bewegung');
    if (normalized === 'SPARKLE') return text('Subtiele fonkeling', 'Subtle sparkle', 'Scintillement subtil', 'Dezentes Funkeln');
    if (normalized === 'SCANNER' || normalized === 'CHASE' || normalized === 'COMET') return text('Bewegend licht', 'Moving light', 'Lumière mobile', 'Bewegtes Licht');
    if (normalized === 'SEQUENCE' || normalized === 'CASCADE') return text('Ritmische beweging', 'Rhythmic movement', 'Mouvement rythmé', 'Rhythmische Bewegung');
    return text('Sfeervolle beweging', 'Ambient movement', 'Mouvement d’ambiance', 'Stimmungsvolle Bewegung');
  }

  function quickEffectCard(type, effect, scope) {
    const name = type === 'RGBW' ? effect.name : effect[0];
    const engine = type === 'RGBW' ? effect.engine : effect[1];
    const variant = type === 'RGBW' ? effect.variant : effect[3];
    const canvas = type === 'RGBW'
      ? `<canvas class="v1811-rgbw-effect-canvas" data-rgbw-effect="${array(window.AluvisionAnimationRuntime?.rgbwEffects).indexOf(effect)}" aria-hidden="true"></canvas>`
      : `<canvas class="effect-mini" data-engine="${safe(engine)}" data-index="${array(window.AluvisionAnimationRuntime?.effects).indexOf(effect)}" aria-hidden="true"></canvas>`;
    void variant;
    return `<button type="button" class="effect v21-quick-effect" onclick="v21ApplyQuickEffect('${type}','${safe(name)}','${scope}')">${canvas}<span><b>${safe(name)}</b><small>${quickEffectDescription(engine)}</small></span><strong>›</strong></button>`;
  }

  window.v21OpenQuickEffects = function v21OpenQuickEffects(type, scope = 'all') {
    const normalized = type === 'RGBW' ? 'RGBW' : 'SPI';
    const runtime = window.AluvisionAnimationRuntime;
    const source = normalized === 'RGBW'
      ? array(runtime?.rgbwEffects).filter(item => item?.engine !== 'STATIC')
      : array(runtime?.effects).filter(item => item?.[1] !== 'STATIC' && item?.[0] !== 'Static Color');
    const unique = [];
    const seen = new Set();
    source.forEach(effect => {
      const name = normalized === 'RGBW' ? effect.name : effect[0];
      if (!name || seen.has(name)) return;
      seen.add(name);
      unique.push(effect);
    });
    const recommended = unique.slice(-12);
    window.modal(`<section class="v21-effect-picker" data-v21-view="quick-effects-${normalized}"><button type="button" class="button soft" onclick="closeModal()">← ${text('Terug', 'Back', 'Retour', 'Zurück')}</button><div class="v21-effect-hero"><i>${normalized}</i><span><div class="eyebrow">${scope === 'zone' ? text('DEZE ZONE', 'THIS ZONE', 'CETTE ZONE', 'DIESE ZONE') : text('DEZE LOCATIE', 'THIS LOCATION', 'CET EMPLACEMENT', 'DIESER STANDORT')}</div><h1>${normalized === 'RGBW' ? text('Zachte volledige-lijneffecten', 'Smooth whole-line effects', 'Effets fluides de ligne entière', 'Weiche Ganzlinien-Effekte') : text('Pixelanimaties', 'Pixel animations', 'Animations pixel', 'Pixelanimationen')}</h1><p>${normalized === 'RGBW' ? text('Iedere LED Line verandert als één geheel.', 'Every LED Line changes as one whole.', 'Chaque LED Line change comme un tout.', 'Jede LED Line verändert sich als Ganzes.') : text('Beweging loopt vloeiend over de echte pixels.', 'Motion flows smoothly across the physical pixels.', 'Le mouvement parcourt les pixels physiques.', 'Bewegung läuft weich über die echten Pixel.')}</p></span></div><div class="v21-quick-effect-grid">${recommended.map(effect => quickEffectCard(normalized, effect, scope)).join('')}</div></section>`);
  };

  function quickFamilyEffects(type, limit = 4) {
    const runtime = window.AluvisionAnimationRuntime;
    const source = type === 'RGBW'
      ? array(runtime?.rgbwEffects).filter(item => item?.engine !== 'STATIC' && !item?.line)
      : array(runtime?.effects).filter(item => item?.[1] !== 'STATIC' && item?.[0] !== 'Static Color'
        && !(typeof runtime?.isMultiLineEffect === 'function' && runtime.isMultiLineEffect(item)));
    const unique = [];
    const names = new Set();
    source.forEach(effect => {
      const name = type === 'RGBW' ? effect?.name : effect?.[0];
      if (!name || names.has(name)) return;
      names.add(name);
      unique.push(effect);
    });
    return unique.slice(Math.max(0, unique.length - limit));
  }

  function quickFamilyKey(scope) {
    // Counts alone cannot invalidate an empty panel when the effect catalogue
    // becomes ready later, or when the app language changes.
    return JSON.stringify([familyCounts(scope), language(),
      quickFamilyEffects('SPI').map(effect => effect[0]),
      quickFamilyEffects('RGBW').map(effect => effect.name)]);
  }

  function quickFamilyEmpty(kind = 'lines') {
    const missingLines = kind === 'lines';
    return `<div class="v21-atmosphere-empty" role="status"><b>${missingLines
      ? text('Stel eerst je LED Lines in', 'Set up your LED Lines first', 'Configurez d’abord vos LED Lines', 'Richte zuerst deine LED Lines ein')
      : text('Sferen zijn nog niet beschikbaar', 'Moods are not available yet', 'Les ambiances ne sont pas encore disponibles', 'Stimmungen sind noch nicht verfügbar')}</b><p>${missingLines
      ? text('Voeg een LED Line aan een groep toe. Daarna verschijnen hier de passende sferen.', 'Add an LED Line to a group. Its matching moods will appear here.', 'Ajoutez une LED Line à un groupe. Les ambiances adaptées apparaîtront ici.', 'Füge eine LED Line zu einer Gruppe hinzu. Danach erscheinen hier die passenden Stimmungen.')
      : text('Probeer de sfeerkeuze opnieuw te laden.', 'Try loading the mood selection again.', 'Essayez de recharger le choix d’ambiances.', 'Versuche, die Stimmungsauswahl erneut zu laden.')}</p><button type="button" class="button soft" onclick="${missingLines ? "go('devices')" : 'AluvisionV21.refine()'}">${missingLines
      ? text('Receivers instellen', 'Set up receivers', 'Configurer les récepteurs', 'Receiver einrichten')
      : text('Opnieuw proberen', 'Try again', 'Réessayer', 'Erneut versuchen')}</button></div>`;
  }

  function quickFamilyMarkup(scope = 'all') {
    const counts = familyCounts(scope);
    const entries = [];
    const section = type => {
      const count = counts[type];
      if (!count) return;
      const rgbw = type === 'RGBW';
      const effects = quickFamilyEffects(type);
      const iconName = rgbw ? 'ledlines' : 'animation';
      const icon = window.AluvisionIcons?.markup?.(iconName) || '';
      entries.push(`<section class="v21-atmosphere-family" data-v21-family="${type}"><header><i data-alv-icon="${iconName}" aria-hidden="true">${icon}</i><span><b>${rgbw ? text('Sferen voor volledige LED Lines', 'Whole-line moods', 'Ambiances pour lignes entières', 'Stimmungen für ganze LED Lines') : text('Sferen met pixelbeweging', 'Pixel-motion moods', 'Ambiances avec mouvement pixel', 'Stimmungen mit Pixelbewegung')}</b><small>${count} LED Line${count === 1 ? '' : 's'} · ${rgbw ? text('fade en pulse', 'fade and pulse', 'fondu et pulse', 'Fade und Pulse') : text('vloeiende animaties', 'smooth animations', 'animations fluides', 'weiche Animationen')}</small></span>${effects.length ? `<button type="button" class="button soft" onclick="v21OpenQuickEffects('${type}','${scope}')">${text('Alle', 'All', 'Toutes', 'Alle')} →</button>` : ''}</header>${effects.length ? `<div class="v21-family-effect-grid">${effects.map(effect => quickEffectCard(type, effect, scope)).join('')}</div>` : quickFamilyEmpty('catalogue')}</section>`);
    };
    if (counts.SPI) section('SPI');
    if (counts.RGBW) section('RGBW');
    return `<div class="v21-atmosphere-families" data-v21-families="${scope}" data-v21-family-count="${entries.length}">${entries.length ? entries.join('') : quickFamilyEmpty()}</div>`;
  }

  function refineHome() {
    const root = document.getElementById('home');
    if (!root || !root.classList.contains('on')) return;
    root.classList.add('v21-home');
    const allCard = root.querySelector('.customer-all-location,[data-ui="all-lighting"]');
    const counts = familyCounts('all');
    const lineCount = counts.SPI + counts.RGBW;
    root.querySelectorAll('.v18152-scope-counts > span').forEach(item => {
      if (/^LED Lines?$/i.test(item.querySelector('small')?.textContent?.trim() || '')) {
        const value = item.querySelector('b');
        if (value && value.textContent !== String(lineCount)) value.textContent = String(lineCount);
      }
    });
    const panel = allCard?.querySelector('#uxAllControlPanel');
    root.querySelectorAll('[data-v21-families]').forEach(item => {
      if (!panel?.contains(item)) item.remove();
    });
    const looksOpen = Boolean(panel && !panel.hidden && allCard?.querySelector('[data-v1814-home-action="looks"].on'));
    if (looksOpen) {
      const familyKey = quickFamilyKey('all');
      if (panel.dataset.v21AtmosphereKey !== familyKey || !panel.querySelector('[data-v21-families="all"]')) {
        panel.innerHTML = quickFamilyMarkup('all');
        panel.dataset.v21AtmosphereKey = familyKey;
      }
    }
    const colourCopy = allCard?.querySelector('[data-v1814-home-action="colour"] small,.v1814-home-action-copy small');
    if (colourCopy && /behoud|preserv|conserv|beibehalt/i.test(colourCopy.textContent)) {
      colourCopy.textContent = text('Maakt direct een vaste kleur', 'Immediately sets a solid colour', 'Applique directement une couleur fixe', 'Setzt sofort eine feste Farbe');
    }
    const receiverButtons = [...root.querySelectorAll('button')].filter(button =>
      /receiver toevoegen|add receiver|ajouter un récepteur|receiver hinzufügen/i.test(button.textContent || '')
    );
    if (receiverButtons.length) receiverButtons[0].dataset.v21AddReceiver = '';
    receiverButtons.slice(1).forEach(button => {
      if (button.hasAttribute('data-v21-add-receiver')) button.remove();
    });
    if (!root.querySelector('[data-v21-add-receiver]')) {
      const heading = root.querySelector('.ux-page-intro,.customer-page-header,.page-head,.hero');
      const button = `<button type="button" class="button v21-add-receiver" data-v21-add-receiver onclick="openAddReceiver()">＋ ${text('Receiver toevoegen', 'Add receiver', 'Ajouter un récepteur', 'Receiver hinzufügen')}</button>`;
      heading?.insertAdjacentHTML('beforeend', button);
    }
  }

  function refineZone() {
    const root = document.getElementById('zones');
    if (!root || !root.classList.contains('on')) return;
    const wholeZone = root.querySelector('.customer-all-zone,[data-ui="all-zone-lighting"],.v18152-zone-master,.v18152-zone-scope-control');
    const panel = wholeZone?.querySelector('#customerZoneControlPanel');
    root.querySelectorAll('[data-v21-families]').forEach(item => {
      if (!panel?.contains(item)) item.remove();
    });
    const looksOpen = Boolean(panel && !panel.hidden && wholeZone?.querySelector('[data-v18152-zone-action="looks"].on'));
    if (looksOpen) {
      const familyKey = quickFamilyKey('zone');
      if (panel.dataset.v21AtmosphereKey !== familyKey || !panel.querySelector('[data-v21-families="zone"]')) {
        panel.innerHTML = quickFamilyMarkup('zone');
        panel.dataset.v21AtmosphereKey = familyKey;
      }
    }
    const colourCopy = wholeZone?.querySelector('[data-v18152-zone-action="colour"] small');
    if (colourCopy) colourCopy.textContent = text('Vaste kleur voor deze zone', 'Solid colour for this zone', 'Couleur fixe pour cette zone', 'Feste Farbe für diese Zone');
  }

  function refineCustomerHierarchy() {
    const homeRoot = document.getElementById('home');
    const zonesRoot = document.getElementById('zones');
    const devicesRoot = document.getElementById('devices');
    [homeRoot, zonesRoot, devicesRoot].forEach(root => {
      if (root?.classList.contains('on')) root.dataset.v21CustomerView = root.id;
    });

    document.querySelectorAll('#home .customer-zone-card, #zones .customer-zone-card, #zones .customer-zone-explorer')
      .forEach(card => card.dataset.v21Card = 'zone');
    document.querySelectorAll('#zones .structure-group-card > button:first-child, #zones .customer-group-explorer[role="button"], #zones .customer-group-explorer[onclick*="openGroup("], #zones .customer-group-explorer .group-open, #zones .customer-group-explorer button[onclick*="openGroup("]')
      .forEach(button => {
        button.dataset.v21Card = 'group';
        button.setAttribute('aria-haspopup', 'false');
      });

    document.querySelectorAll('#zones .customer-group-explorer[data-open-group]').forEach(card => {
      const selectedGroup = groupById(card.dataset.openGroup);
      if (!selectedGroup || receiverType(selectedGroup) !== 'RGBW') return;
      const topology = rgbwPreviewTopology(selectedGroup);
      card.dataset.v21RgbwLayout = topology.layout;
      card.dataset.v21RgbwRenderCount = String(topology.renderCount);
      const copy = card.querySelector('.customer-group-explorer-copy p span');
      const topologyTitle = card.querySelector('.v188-group-topology > span > b');
      const topologyCount = card.querySelector('.v188-group-topology > span > small');
      const countCopy = `${topology.renderCount} LED Line${topology.renderCount === 1 ? '' : 's'}`;
      const layoutCopy = topology.panel
        ? topology.orientation === 'vertical'
          ? text('Paneel · verticale beweging', 'Panel · vertical motion', 'Panneau · mouvement vertical', 'Panel · vertikale Bewegung')
          : text('Paneel · horizontale beweging', 'Panel · horizontal motion', 'Panneau · mouvement horizontal', 'Panel · horizontale Bewegung')
        : text('Één doorlopende LED Line', 'One continuous LED Line', 'Une LED Line continue', 'Eine durchgehende LED Line');
      if (copy) copy.textContent = `${layoutCopy} · ${countCopy}`;
      if (topologyTitle) topologyTitle.textContent = layoutCopy;
      if (topologyCount) topologyCount.textContent = countCopy;
    });

    document.querySelectorAll('#zones .customer-breadcrumb, #zones .customer-structure-route, #zones .alv-context-path')
      .forEach(route => route.classList.add('v21-context-route'));

    const shell = zonesRoot?.querySelector('.customer-group-page,.rgbw-group-ui');
    if (!shell) return;
    if (zonesRoot.querySelector('.customer-structure-route,.alv-context-path')) {
      shell.querySelectorAll('.v21-context-bar').forEach(route => route.remove());
    }
    ensureGroupEditorStructure(zonesRoot, currentGroup());
    try {
      const editor = shell.querySelector(':scope > .v1811-editor-stack');
      const settingsReady = editor?.querySelector(':scope > .v1811-settings-card')?.id === 'v1814-group-settings';
      const coloursReady = editor?.querySelector(':scope > .v1811-colour-card')?.id === 'v1814-group-colors';
      if ((!settingsReady || !coloursReady) && typeof v1814EnhanceGroup === 'function') v1814EnhanceGroup(zonesRoot);
    } catch (_) { /* The structural repair remains available without V18.14. */ }
    shell.dataset.v21CustomerView = 'group';
    const nav = shell.querySelector('.v1814-group-nav');
    if (nav) {
      nav.dataset.v21Panel = lastCustomerPanel;
      nav.querySelectorAll('[data-v1814-group-tab]').forEach(button => {
        if (button.classList.contains('on')) lastCustomerPanel = button.dataset.v1814GroupTab || lastCustomerPanel;
      });
    }
    const previews = [...shell.querySelectorAll('.v18162-main-preview,.rgbw-main-preview,:scope > .preview')]
      .filter((item, index, items) => items.indexOf(item) === index);
    previews.forEach((preview, index) => {
      preview.toggleAttribute('data-v21-primary-preview', index === 0);
      if (index) preview.dataset.v21AuxiliaryPreview = '';
    });
    const primary = previews[0];
    if (primary) {
      const type = receiverType(currentGroup());
      const topology = type === 'RGBW' ? rgbwPreviewTopology(currentGroup()) : null;
      primary.dataset.v21PreviewType = type === 'RGBW'
        ? 'whole-line'
        : currentGroup()?.layout === 'parallel' ? 'pixel-tunnel' : 'physical-pixels';
      if (topology) {
        primary.dataset.v21RgbwLayout = topology.layout;
        primary.dataset.v21RgbwRenderCount = String(topology.renderCount);
      } else {
        delete primary.dataset.v21RgbwLayout;
        delete primary.dataset.v21RgbwRenderCount;
      }
      primary.setAttribute('role', type === 'RGBW' ? 'group' : 'img');
      const activeTarget = type === 'RGBW' ? activeRgbwTargetLabel(currentGroup(), topology) : '';
      primary.setAttribute('aria-label', type === 'RGBW'
        ? `${text('Live preview van volledige LED Lines', 'Live preview of complete LED Lines', 'Aperçu des LED Lines complètes', 'Live-Vorschau vollständiger LED Lines')} · ${activeTarget}`
        : text('Live preview van de echte pixels', 'Live preview of the physical pixels', 'Aperçu des pixels physiques', 'Live-Vorschau der echten Pixel'));
      const existingGuide = primary.querySelector('.v21-whole-line-guide');
      if (type === 'RGBW' && topology?.renderCount) {
        const lines = rgbwPreviewGuideLines(currentGroup(), topology);
        const selected = new Set(selectedRgbwIds(currentGroup()));
        const all = isAllRgbwSelected(currentGroup());
        primary.dataset.v21TargetMode = all ? 'all' : 'one';
        primary.dataset.v21TargetLabel = activeTarget;
        // Keep the target controls outside the canvas, whose renderer retains
        // its own header/rail/footer geometry. Dense panels get enough stage
        // height for distinct rails; no animation or colour math changes.
        const columns = Math.min(5, lines.length);
        const guideHeight = Math.ceil(lines.length / columns) * 44 + (Math.ceil(lines.length / columns) - 1) * 5;
        const stageHeight = topology.panel && topology.orientation === 'vertical'
          ? 230 : Math.max(138, topology.panel ? 94 + lines.length * 11 : 138);
        primary.style.setProperty('--v21-rgbw-stage-height', `${stageHeight}px`);
        primary.style.setProperty('--v21-rgbw-guide-height', `${guideHeight}px`);
        primary.style.setProperty('--v21-rgbw-guide-columns', String(columns));
        const guideSignature = JSON.stringify([language(), currentGroup().id, lastCustomerPanel, topology.layout, lines, [...selected], all]);
        if (existingGuide?.dataset.v21GuideSignature !== guideSignature) {
          existingGuide?.remove();
          primary.insertAdjacentHTML('beforeend', `<span class="v21-whole-line-guide ${lines.length >= 4 ? 'is-many' : ''}" data-v21-rgbw-layout="${topology.layout}" data-v21-line-count="${lines.length}" data-v21-selection="${all ? 'all' : 'one'}" role="group" aria-label="${text('LED Line kiezen', 'Choose LED Line', 'Choisir une LED Line', 'LED Line wählen')}">${lines.map((line, index) => {
          const target = line.key === 'all' || logicalRgbwTargetSelected(line, selected);
          const action = `v21SelectRgbwLines(${JSON.stringify(String(currentGroup().id))},${JSON.stringify(String(line.key))},${JSON.stringify(lastCustomerPanel === 'colors' ? 'colour' : 'animation')})`;
          return `<i class="${target ? 'is-target' : 'is-muted'}" data-v21-preview-line-key="${safe(line.key)}" data-v21-preview-line-ids="${safe(line.lineIds.map(String).join(','))}"><button type="button" aria-label="${safe(line.label)}" aria-pressed="${target}" title="${safe(line.label)}" onclick="${safe(action)}"><b aria-hidden="true">${index + 1}</b><em>${safe(line.label)}</em></button></i>`;
          }).join('')}</span>`);
          primary.querySelector('.v21-whole-line-guide').dataset.v21GuideSignature = guideSignature;
        }
      } else existingGuide?.remove();
      if (type === 'RGBW') {
        const panelControls = topology?.panel && topology.renderCount > 1;
        shell.querySelectorAll('.rgbw-live-setting').forEach(setting => {
          const panelOnly = /rgbwRange\(['"]spread['"]/.test(setting.querySelector('input')?.getAttribute('oninput') || '');
          if (!panelOnly) return;
          setting.dataset.v21PanelOnly = '';
          setting.hidden = !panelControls;
        });
        shell.querySelectorAll('.rgbw-direction').forEach(direction => {
          direction.dataset.v21PanelOnly = '';
          direction.hidden = !panelControls;
        });
      }
    }
    shell.querySelector('.v1811-settings-card')?.setAttribute('data-v21-primary-settings', '');
  }

  function setSemanticIcon(node, iconId, role = '') {
    if (!node || !window.AluvisionIcons?.markup) return;
    if (node.dataset.v21IconId !== iconId || !node.querySelector('svg[data-alv-icon-name]')) {
      node.innerHTML = window.AluvisionIcons.markup(iconId);
    }
    node.dataset.alvIcon = iconId;
    node.dataset.v21IconId = iconId;
    if (role) node.dataset.v21IconRole = role;
    node.setAttribute('aria-hidden', 'true');
  }

  function refineHierarchyIcons() {
    // Resolve the meaning of the displayed label, never its position in a route.
    // One authority also prevents a late legacy redraw from undoing the icon.
    window.AluvisionIcons?.refineHierarchy?.(document);
  }

  function refineCompactEditor() {
    // Short visual label only: the original status text and accessible detail
    // remain owned by the connection layers, which can update independently.
    const statusBadge = document.getElementById('status');
    if (statusBadge) {
      const statusCopy = statusBadge.textContent || '';
      const offline = /offline|niet bereikbaar|unreachable|inaccessible|nicht erreichbar|non joignable|0\/\d+\s+(?:bereikbaar|reachable|joignables|erreichbar)/i.test(statusCopy);
      const recovering = /verbinding herstellen|reconnect|verbindung wird wiederhergestellt|verbinden…|connecting…|connexion…/i.test(statusCopy);
      if (offline || recovering) statusBadge.dataset.v21CompactStatus = `● ${offline
        ? text('Offline', 'Offline', 'Hors ligne', 'Offline')
        : text('Verbinden…', 'Connecting…', 'Connexion…', 'Verbinden…')}`;
      else delete statusBadge.dataset.v21CompactStatus;
    }
    const activeEditor = document.querySelector('#zones.page.on .customer-group-page');
    document.body.classList.toggle('v21-in-group', Boolean(activeEditor));
    document.body.classList.toggle('v21-editor-colour', Boolean(activeEditor?.querySelector('[data-v1814-group-tab="colors"].on')));
    document.querySelectorAll('#zones .customer-group-page,.page.on .rgbw-group-ui').forEach(editor => {
      [...editor.children].find(node => node.matches('.row,.rgbw-group-head') && node.querySelector('h1'))?.classList.add('v21-compact-group-heading');
      editor.querySelectorAll('.controls > .card > .row h2').forEach(heading => {
        const label = heading.textContent.replace(/^\s*\d+\s*[·.]\s*/, '');
        if (label !== heading.textContent) heading.textContent = label;
      });
      editor.querySelectorAll('.rgbw-live-setting.setting-visual-panel').forEach(setting => {
        if (setting.querySelector(':scope > input[type="range"]') && setting.querySelector(':scope > .v20-direct-value')) {
          setting.classList.add('v21-tidy-setting');
        }
      });
      editor.querySelectorAll('.v1811-settings-card').forEach(card => {
        const heading = card.querySelector(':scope > .row');
        if (heading?.querySelector('h2') && !heading.querySelector('button,input,select')) {
          heading.classList.add('v21-setting-repeat-heading');
        }
        const palette = card.querySelector(':scope > .v1816-settings-palette');
        if (palette && !palette.querySelector('button,input,select')) palette.classList.add('v21-setting-repeat-heading');
      });
      editor.querySelectorAll('.v1811-colour-card').forEach(card => {
        // The active Colours tab already names this workbench. Retain the
        // legacy labels/IDs for accessibility and live updates, but do not
        // spend the phone viewport repeating them above the actual picker.
        const heading = card.querySelector(':scope > .row');
        if (heading?.querySelector('h2') && !heading.querySelector('button,input,select')) {
          heading.classList.add('v21-colour-repeat-heading');
        }
        card.querySelectorAll('.unified-color-picker').forEach(picker => {
          picker.querySelector(':scope > .unified-color-head')?.classList.add('v21-colour-repeat-heading');
          const targets = picker.querySelector(':scope > .effect-picker-targets');
          targets?.classList.toggle('v21-single-colour-target', targets.children.length === 1 && targets.firstElementChild.classList.contains('on'));
        });
        const scope = card.querySelector(':scope > [data-v21-line-scope-context="colour"]');
        const count = card.querySelector(':scope > .rgbw-colour-heading');
        if (scope && count && (scope.compareDocumentPosition(count) & Node.DOCUMENT_POSITION_PRECEDING)) {
          count.before(scope);
        }
      });
    });
  }

  function refineSpiParameterCopy() {
    const selected = currentGroup();
    const editor = document.querySelector('#zones.page.on #v1814-group-settings');
    if (!editor || receiverType(selected) !== 'SPI') return;
    const variant = Number(selected?.state?.variant);
    if (![129, 130, 131].includes(variant)) return;
    const put = (node, value) => { if (node && node.textContent !== value) node.textContent = value; };
    const fields = {
      objectCount: {
        label: variant === 129 ? text('Aantal lichtblokken', 'Light blocks', 'Blocs lumineux', 'Lichtblöcke')
          : variant === 130 ? text('Aantal rimpels', 'Ripples', 'Ondulations', 'Wellenringe')
            : text('Aantal kometen', 'Comets', 'Comètes', 'Kometen'),
        description: text('Kies hoeveel er tegelijk over de LED Line bewegen.', 'Choose how many move along the LED Line together.',
          'Choisissez combien se déplacent ensemble sur la LED Line.', 'Wähle, wie viele sich gleichzeitig auf der LED Line bewegen.')
      },
      spacing: variant === 129 ? {
        label: text('Afstand tussen blokken', 'Gap between blocks', 'Espace entre les blocs', 'Abstand zwischen Blöcken'),
        description: text('Meer afstand geeft meer donkere ruimte tussen de lichtblokken.', 'Increase the gap for more dark space between light blocks.',
          'Augmentez l’espace sombre entre les blocs lumineux.', 'Mehr Abstand erzeugt mehr dunklen Raum zwischen den Lichtblöcken.'),
        minimum: text('Dicht bij elkaar', 'Close together', 'Rapprochés', 'Dicht zusammen'),
        maximum: text('Ver uit elkaar', 'Far apart', 'Espacés', 'Weit auseinander')
      } : variant === 130 ? {
        label: text('Uitdoving naar buiten', 'Outward fade', 'Atténuation vers l’extérieur', 'Abklingen nach außen'),
        description: text('Bij 0 blijven de rimpels even helder. Hoger dooft het licht sterker naar de uiteinden.',
          'At 0 the ripples stay equally bright. Higher values fade more strongly towards the ends.',
          'À 0, les ondulations gardent leur luminosité. Augmentez pour les atténuer vers les extrémités.',
          'Bei 0 bleiben die Wellen gleich hell. Höhere Werte lassen sie zu den Enden stärker abklingen.'),
        minimum: text('Even helder', 'Equal brightness', 'Luminosité égale', 'Gleich hell'),
        maximum: text('Sterk uitdoven', 'Strong fade', 'Forte atténuation', 'Stark abklingen')
      } : {
        label: text('Staartverloop', 'Tail fade', 'Atténuation de la traînée', 'Schweifverlauf'),
        description: text('Kies hoe de staart uitdooft: van een lang, zacht verloop tot een korte, duidelijke kern.',
          'Choose how the tail fades: from a long gentle falloff to a short defined core.',
          'Choisissez une traînée qui s’atténue doucement ou un noyau court et marqué.',
          'Wähle zwischen einem langen sanften Verlauf und einem kurzen deutlichen Kern.'),
        minimum: text('Lang en zacht', 'Long and gentle', 'Long et doux', 'Lang und sanft'),
        maximum: text('Sneller uitdoven', 'Faster fade', 'Atténuation rapide', 'Schneller abklingen')
      }
    };
    if (variant === 131) fields.trailLength = {
      label: text('Staartlengte', 'Tail length', 'Longueur de traînée', 'Schweiflänge'),
      description: text('Verleng of verkort het licht achter iedere komeet.', 'Lengthen or shorten the light behind each comet.',
        'Allongez ou raccourcissez la lumière derrière chaque comète.', 'Verlängere oder verkürze das Licht hinter jedem Kometen.')
    };
    Object.entries(fields).forEach(([key, copy]) => {
      const input = editor.querySelector(`#tune-${key}`);
      const panel = input?.closest('.setting-visual-panel');
      if (!panel) return;
      put(panel.querySelector('.setting-title b'), copy.label);
      put(panel.querySelector('.control label'), copy.label);
      put(panel.querySelector('.setting-description'), copy.description);
      if (input.getAttribute('aria-label') !== copy.label) input.setAttribute('aria-label', copy.label);
      if (copy.minimum) {
        put(panel.querySelector('.width-range-labels span:first-child'), copy.minimum);
        put(panel.querySelector('.width-range-labels span:last-child'), copy.maximum);
        // The legacy meaning uses spacing wording even when this parameter
        // controls decay. Keep the live value but describe the real behaviour.
        if (variant !== 129) {
          put(panel.querySelector(`#tune-${key}-meaning`), Number(input.value) === 0 ? copy.minimum : copy.label);
          put(panel.querySelector('[data-v20-pro-demo] > em'), `${input.value}% · ${copy.label}`);
        }
      }
    });
    if (variant === 130) {
      editor.querySelectorAll('.direction-route-tabs button').forEach(button => {
        const inward = /(?:'left'|"left")/.test(button.getAttribute('onclick') || '');
        const label = inward ? text('Naar binnen', 'Inwards', 'Vers le centre', 'Nach innen')
          : text('Naar buiten', 'Outwards', 'Vers l’extérieur', 'Nach außen');
        // Preserve the visual track, which is the button's first span.
        // Its customer label is a direct text node after that track.
        const labelNode = [...button.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
        if (labelNode && labelNode.textContent !== label) labelNode.textContent = label;
        if (button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label);
      });
    }
  }

  function refineColourWorkbench() {
    const roots = [document.getElementById('home'), document.getElementById('zones'), document.getElementById('modalBody')]
      .filter(Boolean);
    roots.forEach(root => {
      root.querySelectorAll('[data-v1815-tool="cmyk"]').forEach(element => element.remove());
      root.querySelectorAll('.unified-color-picker').forEach(picker => {
        picker.classList.add('v21-colour-workbench');
        const fine = picker.querySelector('.v1814-colour-fine-fixed');
        if (fine) {
          fine.dataset.v21DefaultVisible = '';
          fine.removeAttribute('hidden');
        }
        picker.querySelectorAll('details').forEach(detail => {
          if (detail.closest('.v1814-colour-fine-fixed')) return;
          detail.classList.add('v21-optional-colour-method');
          if (!detail.hasAttribute('data-v21-colour-method')) {
            detail.dataset.v21ColourMethod = '';
            detail.open = false;
          }
        });
      });
    });
  }

  function firmwareRelease(device) {
    try {
      if (typeof window.AluvisionFirmwareUi?.releaseFor === 'function') return window.AluvisionFirmwareUi.releaseFor(device);
      return typeof window.firmwareReleaseFor === 'function' ? window.firmwareReleaseFor(device) : null;
    } catch (_) { return null; }
  }

  function currentFirmwareVersion(device, release) {
    const reported = String(release?.currentVersion || '').trim();
    if (reported && !/^(onbekend|unknown|inconnu|unbekannt)$/i.test(reported)) return reported;
    try {
      if (typeof window.AluvisionFirmwareUi?.versionLabel === 'function') return window.AluvisionFirmwareUi.versionLabel(device);
      if (typeof window.firmwareVersionLabel === 'function') return window.firmwareVersionLabel(device);
    } catch (_) { /* Fall back to the receiver record. */ }
    return String(device?.firmwareVersion || device?.firmware || device?.build || '').replace(/^V/i, '').trim()
      || text('Onbekend', 'Unknown', 'Inconnu', 'Unbekannt');
  }

  /* The transport already validates every embedded catalogue entry before it
     reaches the page. The customer button still requires an exact, complete
     match between that validated entry, the release decision and this one
     physical receiver. A stale release summary can therefore never expose an
     Update action by itself. */
  function verifiedFirmwareArtifact(device, release) {
    if (!device || release?.state !== 'update_available' || release?.updateAvailable !== true || !release.latest) return null;
    let artifacts = [];
    try { artifacts = array(window.AluvisionFirmwareUi?.catalogue?.()?.artifacts); }
    catch (_) { return null; }
    const latest = release.latest;
    const exactRid = value => String(value || '').trim().toUpperCase();
    const upper = value => String(value || '').trim().toUpperCase();
    const type = receiverType(device);
    const rid = exactRid(device.rid);
    const model = upper(device.model);
    const board = upper(device.board);
    const version = String(latest.version || '').trim();
    const variant = upper(latest.variant);
    if (!/^[0-9A-F]{16}$/.test(rid) || exactRid(release.receiverRid) !== rid ||
        upper(release.receiverType) !== type || !model || !board ||
        upper(release.model) !== model || upper(release.board) !== board ||
        upper(latest.receiverType) !== type || upper(latest.model) !== model ||
        upper(latest.board) !== board || !/^\d+\.\d+\.\d+$/.test(version) ||
        !['NFC_ONLY', 'LOCAL_SETUP'].includes(variant)) return null;
    const identity = `ALUVISION_FW_ID_V1|TYPE=${type}|MODEL=${model}|BOARD=${board}|VERSION=${version}|VARIANT=${variant}|END`;
    return artifacts.find(artifact => {
      const size = Number(artifact?.size);
      return String(artifact?.id || '').toLowerCase() === String(latest.id || '').toLowerCase() &&
        upper(artifact.receiverType) === type && upper(artifact.model) === model && upper(artifact.board) === board &&
        String(artifact.version || '') === version && upper(artifact.variant) === variant &&
        String(artifact.sha256 || '').toLowerCase() === String(latest.sha256 || '').toLowerCase() &&
        /^[0-9a-f]{64}$/.test(String(artifact.sha256 || '').toLowerCase()) &&
        String(artifact.file || '') === String(latest.file || '') && /^artifacts\/[A-Za-z0-9._-]+\.app\.bin$/.test(String(artifact.file || '')) &&
        Number.isSafeInteger(size) && size >= 64 * 1024 && size <= 2 * 1024 * 1024 && size === Number(latest.size) &&
        artifact.identityMarker === identity && artifact.identityMarker === latest.identityMarker &&
        ['stable', 'release-candidate'].includes(String(artifact.channel || '').toLowerCase()) &&
        artifact.trusted === true && latest.trusted === true && artifact.applicationImage === true && latest.applicationImage === true &&
        Number(artifact.otaWireVersion) === 1 && Number(latest.otaWireVersion) === 1 &&
        Number(artifact.dataPayloadBytes) === 128 && Number(latest.dataPayloadBytes) === 128;
    }) || null;
  }

  function firmwareView(device) {
    const release = firmwareRelease(device);
    let job = null;
    try { job = typeof window.AluvisionFirmwareUi?.jobFor === 'function' ? window.AluvisionFirmwareUi.jobFor(device) : null; }
    catch (_) { /* No running update. */ }
    const artifact = job ? null : verifiedFirmwareArtifact(device, release);
    let copy = null;
    try { copy = typeof window.AluvisionFirmwareUi?.stateCopy === 'function' ? window.AluvisionFirmwareUi.stateCopy(release) : null; }
    catch (_) { /* Use the V21 fallback below. */ }
    let status = copy?.[0] || text('Geen update-informatie', 'No update information', 'Aucune information de mise à jour', 'Keine Update-Information');
    let tone = copy?.[1] || 'neutral';
    if (job) {
      status = job.detail || text('Firmware bijwerken…', 'Updating firmware…', 'Mise à jour du firmware…', 'Firmware wird aktualisiert…');
      tone = 'running';
    } else if (release?.state === 'update_available' && !artifact) {
      status = text('Geen geverifieerde update', 'No verified update', 'Aucune mise à jour vérifiée', 'Kein geprüftes Update');
      tone = 'blocked';
    }
    let reachable = false;
    try { reachable = typeof receiverReachable === 'function' ? receiverReachable(device) : Boolean(device?.online); }
    catch (_) { reachable = Boolean(device?.online); }
    return { release, artifact, job, reachable, status, tone, version: currentFirmwareVersion(device, release) };
  }

  function decorateReceiverFirmware(host, afterNode, device, surface, name) {
    if (!host || !afterNode || !device) return;
    const view = firmwareView(device);
    const container = afterNode.parentElement || host;
    const panels = [...container.querySelectorAll(`:scope > .v21-receiver-firmware[data-v21-firmware-surface="${surface}"]`)];
    let panel = panels.shift();
    panels.forEach(duplicatePanel => duplicatePanel.remove());
    if (!panel) {
      panel = document.createElement('section');
      panel.className = 'v21-receiver-firmware';
      panel.dataset.v21FirmwareSurface = surface;
      panel.setAttribute('aria-live', 'polite');
      afterNode.after(panel);
    }
    const targetVersion = String(view.artifact?.version || '');
    const key = JSON.stringify([language(), device.id, view.version, view.status, view.tone, view.reachable,
      view.artifact?.id || '', targetVersion, view.job?.id || '', view.job?.progress || 0]);
    if (panel.dataset.v21FirmwareKey === key) return;
    panel.dataset.v21FirmwareKey = key;
    panel.dataset.v21FirmwareState = view.artifact ? 'update_available' : view.release?.state === 'up_to_date' ? 'up_to_date' : view.tone;
    const action = view.artifact
      ? `<button type="button" class="v21-receiver-firmware-update" data-v21-firmware-update="${safe(device.id)}" onclick="openFirmwareUpdate('${safe(device.id)}')" ${view.reachable ? '' : `disabled title="${safe(text('Receiver niet bereikbaar', 'Receiver not reachable', 'Récepteur inaccessible', 'Receiver nicht erreichbar'))}"`}>${text('Update', 'Update', 'Mettre à jour', 'Update')}<small>${safe(text(`naar ${targetVersion}`, `to ${targetVersion}`, `vers ${targetVersion}`, `auf ${targetVersion}`))}</small></button>`
      : '';
    panel.innerHTML = `<div class="v21-receiver-firmware-version"><small>${text('HUIDIGE FIRMWARE', 'CURRENT FIRMWARE', 'FIRMWARE ACTUEL', 'AKTUELLE FIRMWARE')}</small><b>${safe(view.version)}</b></div><div class="v21-receiver-firmware-status ${safe(view.tone)}"><small>${text('STATUS', 'STATUS', 'STATUT', 'STATUS')}</small><b>${safe(view.status)}</b></div>${action}`;
    panel.setAttribute('aria-label', `${name}. ${text('Huidige firmware', 'Current firmware', 'Firmware actuel', 'Aktuelle Firmware')} ${view.version}. ${text('Status', 'Status', 'Statut', 'Status')}: ${view.status}.`);
  }

  function refineReceiverViews() {
    const devicesRoot = document.getElementById('devices');
    const database = currentDatabase();
    const location = currentLocation();
    const setCopy = (node, value) => { if (node && node.textContent !== value) node.textContent = value; };
    const receiverName = device => {
      const number = device.number || array(database?.devices).findIndex(item => item.id === device.id) + 1;
      const stored = String(device.customName || device.displayName || device.name || '').trim();
      return stored && !/^LED[\s-]*Lines?\s*\d+$/i.test(stored)
        ? stored : `${text('Receiver', 'Receiver', 'Récepteur', 'Receiver')} ${number}`;
    };
    const assignments = array(location?.zones).flatMap(selectedZone => array(selectedZone.groups).flatMap(selectedGroup =>
      array(selectedGroup.receivers).filter(line => line && line.active !== false).map(line => ({ zone: selectedZone, group: selectedGroup, line }))));
    const allAssignments = array(database?.installations).flatMap(item => array(item.zones).flatMap(selectedZone =>
      array(selectedZone.groups).flatMap(selectedGroup => array(selectedGroup.receivers).map(line => ({ locationId: item.id, line })))));
    const locationDevices = array(database?.devices).filter(device => {
      const uses = allAssignments.filter(entry => entry.line?.deviceId === device.id);
      return !uses.length || uses.some(entry => entry.locationId === location?.id);
    });
    const physicalPorts = device => {
      const type = receiverType(device);
      const spi = window.AluvisionSpiFourPort;
      const capacity = type === 'RGBW' ? 2 : spi?.capacityOf?.(device)
        || (Number(device?.portCapacity ?? device?.portCapability ?? device?.PORTCAP ?? device?.spiPortCapability) === 4 ? 4 : 1);
      const rawMask = type === 'RGBW' ? device?.portMask : spi?.maskOf?.(device) ?? device?.portMask;
      const mask = Number.isFinite(Number(rawMask)) ? Number(rawMask) & ((1 << capacity) - 1) : type === 'RGBW' ? 3 : 1;
      return { type, capacity, mask, ports: Array.from({ length: capacity }, (_, index) => index + 1) };
    };
    const lineKeys = new Set();
    assignments.forEach(({ line }) => {
      const device = deviceForLine(line);
      lineKeys.add(receiverType(device || line) === 'RGBW' && linkedDevice(device)
        ? `linked:${device.id}` : String(line.id || `${line.deviceId}:${Number(line.port) || 1}`));
    });
    const configuredPorts = locationDevices.reduce((sum, device) => {
      const physical = physicalPorts(device);
      return sum + physical.ports.filter(port => physical.mask & (1 << (port - 1))).length;
    }, 0);
    const summary = devicesRoot?.querySelector('.customer-device-summary');
    const summaryKey = `${language()}:${locationDevices.length}:${lineKeys.size}:${configuredPorts}`;
    if (summary && (summary.dataset.v21ReceiverCounts !== summaryKey || !summary.querySelector('[data-v21-count="receivers"]'))) {
      summary.dataset.v21ReceiverCounts = summaryKey;
      const receiversLabel = locationDevices.length === 1 ? text('receiver', 'receiver', 'récepteur', 'Receiver') : text('receivers', 'receivers', 'récepteurs', 'Receiver');
      const portsLabel = configuredPorts === 1 ? text('poort ingesteld', 'configured port', 'port configuré', 'Port eingerichtet') : text('poorten ingesteld', 'configured ports', 'ports configurés', 'Ports eingerichtet');
      summary.innerHTML = `<span data-v21-count="receivers"><b>${locationDevices.length}</b> ${receiversLabel}</span><span data-v21-count="lines"><b>${lineKeys.size}</b> LED Line${lineKeys.size === 1 ? '' : 's'}</span><span data-v21-count="ports"><b>${configuredPorts}</b> ${portsLabel}</span>`;
    }
    setCopy(devicesRoot?.querySelector(':scope > .eyebrow'), `${location?.name || ''} · ${text('RECEIVERS', 'RECEIVERS', 'RÉCEPTEURS', 'RECEIVER')}`);
    devicesRoot?.querySelectorAll('.customer-device-card[data-device-id]').forEach(card => {
      const device = deviceForLine({ deviceId: card.dataset.deviceId });
      if (!device) return;
      const physical = physicalPorts(device);
      const ownAssignments = assignments.filter(entry => entry.line.deviceId === device.id);
      const name = receiverName(device);
      card.dataset.v21ReceiverCard = physical.type.toLowerCase();
      card.dataset.v21PhysicalPorts = String(physical.capacity);
      setCopy(card.querySelector('.customer-device-title b'), name);
      const groupNames = [...new Set(ownAssignments.map(entry => entry.group.name).filter(Boolean))];
      const destination = groupNames.length === 0 ? text('Nog niet ingedeeld', 'Not assigned yet', 'Pas encore affecté', 'Noch nicht zugeordnet')
        : groupNames.length === 1 ? groupNames[0] : `${groupNames.length} ${text('groepen', 'groups', 'groupes', 'Gruppen')}`;
      setCopy(card.querySelector('.customer-device-title small'), destination);
      let board = card.querySelector(':scope > .v21-receiver-port-overview');
      if (!board) {
        board = document.createElement('div');
        board.className = 'v21-receiver-port-overview';
        board.addEventListener('click', event => {
          if (event.target.closest('button[data-v21-overview-port]')) window.deviceDiag?.(device.id);
        });
        card.querySelector('.customer-device-head')?.after(board);
      }
      const ports = physical.ports.map(port => {
        const enabled = Boolean(physical.mask & (1 << (port - 1)));
        const routes = ownAssignments.filter(entry => {
          const lineMask = Number(entry.line.portMask);
          return physical.type === 'RGBW' && linkedDevice(device) && lineMask === 3
            || (Number(entry.line.port || entry.line.outputPort) || 1) === port;
        });
        const state = enabled ? routes.length ? 'assigned' : 'configured' : routes.length ? 'disabled' : 'free';
        const label = state === 'assigned' ? text('In groep', 'Assigned', 'Affecté', 'Zugeordnet')
          : state === 'configured' ? text('Ingesteld', 'Configured', 'Configuré', 'Eingerichtet')
          : state === 'disabled' ? text('Uit', 'Off', 'Désactivé', 'Aus') : text('Vrij', 'Free', 'Libre', 'Frei');
        const routeNames = [...new Set(routes.map(entry => entry.group.name))].join(', ');
        return { port, enabled, state, label, routeNames };
      });
      const activeCount = ports.filter(port => port.enabled).length;
      const linked = physical.type === 'RGBW' && linkedDevice(device) && activeCount === 2;
      const boardKey = JSON.stringify([language(), name, physical.type, linked, ports]);
      if (board.dataset.v21PortKey !== boardKey) {
        board.dataset.v21PortKey = boardKey;
        board.dataset.v21PortMode = linked ? 'linked' : 'separate';
        const portsLabel = physical.capacity === 1 ? text('poort ingesteld', 'port configured', 'port configuré', 'Port eingerichtet') : text('poorten ingesteld', 'ports configured', 'ports configurés', 'Ports eingerichtet');
        board.innerHTML = `<div class="v21-receiver-port-heading"><b>${physical.type}</b><span>${activeCount} / ${physical.capacity} ${portsLabel}</span></div><div class="v21-receiver-port-map" style="--v21-port-count:${physical.capacity}">${ports.map(port => `<button type="button" data-v21-overview-port="${port.port}" data-v21-port-state="${port.state}" aria-label="${safe(`${name} · ${text('Poort', 'Port', 'Port', 'Port')} ${port.port} · ${port.label}${port.routeNames ? ` · ${port.routeNames}` : ''} · ${text('Instellen', 'Settings', 'Régler', 'Einstellen')}`)}"><i aria-hidden="true">${port.port}</i><span class="v21-receiver-port-rail" aria-hidden="true"></span><small>${port.label}</small></button>`).join('')}</div>${linked ? `<div class="v21-receiver-linked-note">${window.AluvisionIcons?.markup?.('ledlines') || ''}<span>${text('Poort 1 + 2 samen · één LED Line', 'Ports 1 + 2 linked · one LED Line', 'Ports 1 + 2 liés · une LED Line', 'Ports 1 + 2 verbunden · eine LED Line')}</span></div>` : ''}`;
      }
      card.querySelectorAll(':scope > .firmware-strip').forEach(legacy => legacy.remove());
      decorateReceiverFirmware(card, board, device, 'overview', name);
      const settings = card.querySelector('button[onclick^="deviceDiag("]');
      if (settings) settings.setAttribute('aria-label', `${settings.textContent.trim()} · ${name}`);
    });

    const modalBody = document.getElementById('modalBody');
    const receiverHeader = modalBody?.querySelector('.v207-device-head,.rgbw207-device .rgbw-device-head');
    if (receiverHeader) {
      const deleteAction = modalBody.querySelector('button[onclick^="requestDeleteDevice("]')?.getAttribute('onclick');
      const deviceId = deleteAction?.match(/requestDeleteDevice\(['"]([^'"]+)['"]\)/)?.[1];
      const device = deviceForLine({ deviceId });
      if (device) {
        const name = receiverName(device);
        setCopy(receiverHeader.querySelector('h1'), name);
        decorateReceiverFirmware(modalBody, receiverHeader, device, 'detail', name);
      }
    }
    const rgbwDevice = modalBody?.querySelector('.rgbw207-device');
    if (!rgbwDevice) return;
    modalBody.dataset.v21ReceiverView = 'rgbw-ports';
    rgbwDevice.querySelectorAll('[data-rgbw-mode]').forEach(button => {
      const label = button.querySelector('small');
      const mode = button.dataset.rgbwMode;
      if (!label) return;
      if (mode === 'linked') label.textContent = text('Spiegelt één state op Poort 1 + 2', 'Mirrors one state to Ports 1 + 2', 'Reproduit un état sur les ports 1 + 2', 'Spiegelt einen Zustand auf Port 1 + 2');
      else label.textContent = text('Deze poort blijft apart bedienbaar', 'This port remains independently controllable', 'Ce port reste pilotable séparément', 'Dieser Port bleibt separat steuerbar');
    });
    const free = rgbwDevice.querySelectorAll('.rgbw207-assignment:not(.on)');
    const selectedMode = rgbwDevice.querySelector('[data-rgbw-mode][aria-checked="true"]')?.dataset.rgbwMode;
    free.forEach((item, index) => {
      item.classList.add('v21-free-port');
      const rawPort = item.querySelector(':scope > b')?.textContent?.match(/\d+/)?.[0];
      const port = Number(rawPort) || index + 1;
      const title = item.querySelector('strong');
      const status = item.querySelector('small');
      const action = item.querySelector(':scope > button');
      if (title) title.textContent = `${text('Poort', 'Port', 'Port', 'Port')} ${port}`;
      if (status) status.textContent = text('Vrij', 'Free', 'Libre', 'Frei');
      if (action) {
        const match = (action.getAttribute('onclick') || '').match(/identifyRgbwPort\('([^']+)'/);
        const deviceId = action.dataset.v21DeviceId || match?.[1] || '';
        if (deviceId) action.dataset.v21DeviceId = deviceId;
        action.className = 'v21-free-port-add';
        action.textContent = text('Toevoegen', 'Add', 'Ajouter', 'Hinzufügen');
        action.setAttribute('aria-label', `${text('Poort', 'Port', 'Port', 'Port')} ${port} · ${text('Toevoegen', 'Add', 'Ajouter', 'Hinzufügen')}`);
        action.setAttribute('onclick', `v21StageSecondRgbwPort('${safe(deviceId)}')`);
      }
    });
    if ((free.length || selectedMode === 'port1' || selectedMode === 'port2') && !rgbwDevice.querySelector('.v21-free-port-note')) {
      const footer = rgbwDevice.querySelector('.rgbw207-device-footer');
      footer?.insertAdjacentHTML('beforebegin', `<aside class="v21-free-port-note"><i>＋</i><span><b>${text('Vrije tweede poort', 'Free second port', 'Deuxième port libre', 'Freier zweiter Port')}</b><small>${text('Je bestaande LED Line en instellingen blijven behouden wanneer je deze later toevoegt.', 'Your existing LED Line and settings remain intact when you add it later.', 'Votre LED Line et ses réglages restent intacts lors d’un ajout ultérieur.', 'Deine bestehende LED Line und Einstellungen bleiben beim späteren Hinzufügen erhalten.')}</small></span></aside>`);
    }
  }

  window.v21StageSecondRgbwPort = function v21StageSecondRgbwPort(deviceId) {
    if (!deviceId || typeof window.rgbw207SetDeviceMode !== 'function') return;
    window.rgbw207SetDeviceMode(deviceId, 'linked');
    document.querySelectorAll('.rgbw207-device-mode-grid [data-rgbw-mode]').forEach(button => {
      const selected = button.dataset.rgbwMode === 'linked';
      button.classList.toggle('on', selected);
      button.setAttribute('aria-checked', String(selected));
    });
  };

  function refineBrandAssets() {
    let source = '';
    try { source = new URL('assets/aluvision-logo.png', document.baseURI).href; }
    catch (_) { return; }
    document.querySelectorAll('.brand-lockup img,.nav-brand img').forEach(image => {
      if (image.getAttribute('src') !== source) image.src = source;
      image.removeAttribute('srcset');
      image.dataset.v21BrandAsset = 'bundled';
    });
  }

  function refineAnimationLibraryCount() {
    const body = document.getElementById('modalBody');
    const library = body?.querySelector('#animationLibrary');
    const rgbwFamilies = body?.querySelector('[data-rgbw-family]');
    const heading = body?.querySelector('h1');
    if ((!library && !rgbwFamilies) || !heading) return;
    const runtime = window.AluvisionAnimationRuntime;
    const selectedGroup = currentGroup();
    let count = 0;
    if (receiverType(selectedGroup) === 'RGBW') {
      const topology = rgbwPreviewTopology(selectedGroup);
      const panelEffectsAvailable = topology.panel && topology.renderCount > 1;
      if (!body.querySelector('[data-v21-line-scope-context="animation-picker"]')) {
        const scopeTemplate = document.createElement('template');
        scopeTemplate.innerHTML = rgbwLineSelectorMarkup(selectedGroup, 'animation-picker');
        const selector = scopeTemplate.content.firstElementChild;
        const firstFamily = body.querySelector('[data-rgbw-family]');
        if (selector && firstFamily) firstFamily.before(selector);
      }
      const between = body.querySelector('[data-rgbw-family="between"]');
      if (between) {
        between.hidden = !panelEffectsAvailable;
        between.dataset.v21PanelOnly = '';
      }
      count = array(runtime?.rgbwEffects).filter(item => item?.engine !== 'STATIC'
        && (!item?.line || panelEffectsAvailable)).length;
    } else {
      const ordinary = array(runtime?.effects).filter(effect => !(typeof runtime?.isMultiLineEffect === 'function' && runtime.isMultiLineEffect(effect)));
      const parallel = selectedGroup?.layout === 'parallel' && array(selectedGroup?.receivers).length > 1;
      count = ordinary.length + (parallel ? array(runtime?.multiLineEffects).length : 0);
    }
    const countLead = /^\s*\d+\s/.test(heading.textContent || '');
    if (countLead) heading.textContent = heading.textContent.replace(/^\s*\d+/, String(count));
    const eyebrow = body.querySelector('.eyebrow');
    if (!countLead && receiverType(selectedGroup) === 'RGBW' && eyebrow && /RGBW/i.test(eyebrow.textContent || '')) {
      eyebrow.textContent = eyebrow.textContent.replace(/RGBW\s*·\s*\d+/i, `RGBW · ${count}`);
    }
    heading.dataset.v21AnimationCount = String(count);
  }

  function currentPairDraft() {
    try { return pairDraft; }
    catch (_) { return null; }
  }

  function rgbwPairMode(draft = currentPairDraft()) {
    const explicit = String(draft?.rgbwOutputMode || '').toLowerCase();
    if (['port1', 'port2', 'linked', 'separate'].includes(explicit)) return explicit;
    const device = array(currentDatabase()?.devices).find(item => item.id === draft?.deviceId);
    if (['port1', 'port2', 'linked', 'separate'].includes(device?.rgbwOutputMode)) return device.rgbwOutputMode;
    const mask = Number(draft?.portMask) || 1;
    return mask === 2 ? 'port2' : mask === 3 ? 'linked' : 'port1';
  }

  function rgbwPairMask(mode) {
    return mode === 'port1' ? 1 : mode === 'port2' ? 2 : 3;
  }

  function rgbwPairModeCopy(mode) {
    if (mode === 'port1') return {
      title: text('Alleen Poort 1', 'Port 1 only', 'Port 1 uniquement', 'Nur Port 1'),
      detail: text('Poort 2 blijft vrij voor later', 'Port 2 remains free for later', 'Le port 2 reste libre', 'Port 2 bleibt später frei')
    };
    if (mode === 'port2') return {
      title: text('Alleen Poort 2', 'Port 2 only', 'Port 2 uniquement', 'Nur Port 2'),
      detail: text('Poort 1 blijft vrij voor later', 'Port 1 remains free for later', 'Le port 1 reste libre', 'Port 1 bleibt später frei')
    };
    if (mode === 'separate') return {
      title: text('Beide apart', 'Both separate', 'Les deux séparément', 'Beide getrennt'),
      detail: text('Twee volledige LED Lines, elk apart bedienbaar', 'Two complete LED Lines, each controlled separately', 'Deux LED Lines complètes pilotables séparément', 'Zwei vollständige LED Lines, getrennt steuerbar')
    };
    return {
      title: text('Beide gekoppeld', 'Both linked', 'Les deux liées', 'Beide gekoppelt'),
      detail: text('Eén instelling wordt gespiegeld op Poort 1 en 2', 'One setting is mirrored to Ports 1 and 2', 'Un réglage est reproduit sur les ports 1 et 2', 'Eine Einstellung wird auf Port 1 und 2 gespiegelt')
    };
  }

  function rgbwPairBoard(mode) {
    const mask = rgbwPairMask(mode);
    return `<div class="v21-rgbw-pair-board" data-mode="${safe(mode)}" aria-label="${text('RGBW-poorten', 'RGBW ports', 'Ports RGBW', 'RGBW-Ports')}"><span class="v21-rgbw-pair-receiver"><small>ALUVISION</small><b>RGBW</b><em>2 PORT</em></span><div>${[1, 2].map(port => {
      const active = Boolean(mask & (1 << (port - 1)));
      return `<span class="${active ? 'on' : ''}"><b>P${port}</b><i></i><em>LED Line ${port}</em><button type="button" onclick="identifyRgbwDraftPort(${port})" aria-label="${text('Deze poort laten knipperen', 'Flash this port', 'Faire clignoter ce port', 'Diesen Port blinken lassen')}">✦</button></span>`;
    }).join('')}</div></div>`;
  }

  function rgbwPairModeCards(mode) {
    return `<div class="v21-rgbw-pair-modes" role="radiogroup" aria-label="${text('Gebruik van de poorten', 'How the ports are used', 'Utilisation des ports', 'Verwendung der Ports')}">${['port1', 'port2', 'linked', 'separate'].map(value => {
      const selected = mode === value;
      const copy = rgbwPairModeCopy(value);
      return `<button type="button" class="${selected ? 'on' : ''}" data-v21-rgbw-pair-mode="${value}" role="radio" aria-checked="${selected}" onclick="v21SetRgbwPairMode('${value}')"><i>${value === 'linked' ? '∞' : value === 'separate' ? 'Ⅱ' : value === 'port2' ? '2' : '1'}</i><span><b>${safe(copy.title)}</b><small>${safe(copy.detail)}</small></span><strong>${selected ? '✓' : '›'}</strong></button>`;
    }).join('')}</div>`;
  }

  function compatibleRgbwGroups(selectedZone) {
    return array(selectedZone?.groups).filter(item => {
      const type = receiverType(item);
      return !array(item?.receivers).length || type === 'RGBW';
    });
  }

  function savedRgbwAssignments(deviceId) {
    return array(currentDatabase()?.installations).flatMap(location => array(location.zones).flatMap(selectedZone =>
      array(selectedZone.groups).flatMap(selectedGroup => array(selectedGroup.receivers)
        .map((line, index) => ({ line, index, selectedGroup, selectedZone }))
        .filter(item => item.line.deviceId === deviceId))));
  }

  function rgbwPairDestinations(draft = currentPairDraft()) {
    const location = currentLocation();
    const saved = savedRgbwAssignments(draft?.deviceId);
    const selectedZone = array(location?.zones).find(item => item.id === draft?.zoneId) || location?.zones?.[0];
    const selectedGroup = compatibleRgbwGroups(selectedZone).find(item => item.id === draft?.groupId) || compatibleRgbwGroups(selectedZone)[0];
    draft.rgbwPortDestinations ||= {};
    return [1, 2].filter(port => rgbwPairMask(rgbwPairMode(draft)) & (1 << (port - 1))).map(port => {
      const previous = saved.find(item => Number(item.line.port) === port);
      if (!draft.rgbwPortDestinations[port]) draft.rgbwPortDestinations[port] = {
        zoneId: draft.presetGroup ? draft.zoneId : previous?.selectedZone.id || selectedZone?.id || '',
        groupId: draft.presetGroup ? draft.groupId : previous?.selectedGroup.id || selectedGroup?.id || ''
      };
      const destination = rgbwPairMode(draft) === 'separate' ? draft.rgbwPortDestinations[port]
        : { zoneId: selectedZone?.id, groupId: selectedGroup?.id };
      const zone = array(location?.zones).find(item => item.id === destination.zoneId);
      const group = array(zone?.groups).find(item => item.id === destination.groupId);
      return { port, selectedZone: zone, selectedGroup: group, previous };
    });
  }

  function rgbwPortDestinationMarkup(draft) {
    const options = array(currentLocation()?.zones).flatMap(zone => compatibleRgbwGroups(zone).map(group => ({ zone, group })));
    return `<div class="v21-rgbw-destination-list">${rgbwPairDestinations(draft).map(item =>
      `<label class="card v21-rgbw-port-destination"><b>${text('Poort', 'Port', 'Port', 'Port')} ${item.port} · LED Line ${item.port}</b><select class="field" data-v21-rgbw-destination="${item.port}" onchange="v21SetRgbwPortDestination(${item.port},this.value)">${options.map(option =>
        `<option value="${safe(`${option.zone.id}::${option.group.id}`)}" ${option.zone.id === item.selectedZone?.id && option.group.id === item.selectedGroup?.id ? 'selected' : ''}>${safe(option.zone.name)} → ${safe(option.group.name)}</option>`).join('')}</select></label>`).join('')}</div>`;
  }

  function renderRgbwPairStep(step) {
    const draft = currentPairDraft();
    const database = currentDatabase();
    const location = currentLocation();
    const device = array(database?.devices).find(item => String(item?.id) === String(draft?.deviceId));
    if (!draft || !device || receiverType(device) !== 'RGBW') return false;
    const mode = rgbwPairMode(draft);
    draft.rgbwOutputMode = mode;
    draft.portMask = rgbwPairMask(mode);
    const direct = Boolean(draft.presetGroup && draft.zoneId && draft.groupId);
    const nextFromPorts = direct ? (mode === 'separate' ? 3 : 4) : 2;
    const dots = active => `<ol class="v21-rgbw-pair-progress" aria-label="${text('Voortgang', 'Progress', 'Progression', 'Fortschritt')}">${[
      text('Poorten', 'Ports', 'Ports', 'Ports'),
      text('Zone', 'Zone', 'Zone', 'Zone'),
      text('Groep', 'Group', 'Groupe', 'Gruppe'),
      text('Controleren', 'Review', 'Vérifier', 'Prüfen')
    ].map((label, index) => `<li class="${index < active ? 'done' : index === active ? 'on' : ''}"><i>${index < active ? '✓' : index + 1}</i><span>${label}</span></li>`).join('')}</ol>`;

    if (Number(step) <= 1) {
      window.modal(`<section class="v21-rgbw-pair" data-phase="rgbw-ports">${dots(0)}<header><span><div class="eyebrow">RGBW · ${text('POORTEN', 'PORTS', 'PORTS', 'PORTS')}</div><h1>${text('Hoe wil je de twee poorten gebruiken?', 'How do you want to use the two ports?', 'Comment utiliser les deux ports ?', 'Wie möchtest du die beiden Ports nutzen?')}</h1><p>${text('RGBW gebruikt altijd volledige LED Lines. Kies één poort, twee gekoppelde poorten of twee aparte lijnen.', 'RGBW always uses complete LED Lines. Choose one port, two linked ports, or two separate lines.', 'RGBW utilise toujours des LED Lines complètes. Choisissez un port, deux ports liés ou deux lignes séparées.', 'RGBW verwendet immer vollständige LED Lines. Wähle einen Port, zwei gekoppelte Ports oder zwei getrennte Linien.')}</p></span><b class="live-indicator">LIVE</b></header>${rgbwPairBoard(mode)}${rgbwPairModeCards(mode)}<footer><button type="button" class="button soft" onclick="closeModal()">${text('Annuleren', 'Cancel', 'Annuler', 'Abbrechen')}</button><button type="button" class="button" onclick="pairStep(${nextFromPorts})">${nextFromPorts === 4 ? text('Controleren', 'Review', 'Vérifier', 'Prüfen') : nextFromPorts === 3 ? text('Groepen kiezen', 'Choose groups', 'Choisir les groupes', 'Gruppen wählen') : text('Zone kiezen', 'Choose zone', 'Choisir la zone', 'Zone wählen')} →</button></footer></section>`, { viewKey: 'v21-rgbw-pair-ports' });
      return true;
    }

    if (Number(step) === 2) {
      window.modal(`<section class="v21-rgbw-pair" data-phase="rgbw-zone">${dots(1)}<header><span><div class="eyebrow">${text('INDELEN', 'ASSIGN', 'AFFECTER', 'ZUORDNEN')}</div><h1>${text('In welke zone staan deze LED Lines?', 'Which zone contains these LED Lines?', 'Dans quelle zone se trouvent ces LED Lines ?', 'In welcher Zone stehen diese LED Lines?')}</h1><p>${text('De locatie blijft zichtbaar in iedere volgende stap.', 'The location remains visible in every following step.', 'L’emplacement reste visible à chaque étape.', 'Der Standort bleibt in jedem nächsten Schritt sichtbar.')}</p></span></header><div class="v21-rgbw-destination-list">${array(location?.zones).map(item => `<button type="button" onclick="v21ChooseRgbwPairZone('${safe(item.id)}')"><i>${safe(item.icon || '▦')}</i><span><b>${safe(item.name)}</b><small>${array(item.groups).length} ${text('groepen', 'groups', 'groupes', 'Gruppen')}</small></span><strong>›</strong></button>`).join('')}</div><footer><button type="button" class="button soft" onclick="pairStep(1)">← ${text('Poorten', 'Ports', 'Ports', 'Ports')}</button></footer></section>`, { viewKey: 'v21-rgbw-pair-zone' });
      return true;
    }

    if (Number(step) === 3) {
      if (mode === 'separate') {
        window.modal(`<section class="v21-rgbw-pair" data-phase="rgbw-groups">${dots(2)}<header><span><h1>${text('Kies een groep per LED Line', 'Choose a group for each LED Line', 'Choisissez un groupe par LED Line', 'Wähle eine Gruppe pro LED Line')}</h1><p>${text('Beide mogen in dezelfde groep. Kies een andere groep als je ze apart wilt indelen.', 'Both may share a group. Choose a different group to assign them separately.', 'Les deux peuvent partager un groupe. Choisissez un autre groupe pour les séparer.', 'Beide dürfen in derselben Gruppe sein. Wähle eine andere Gruppe für eine getrennte Zuordnung.')}</p></span></header>${rgbwPortDestinationMarkup(draft)}<footer><button type="button" class="button soft" onclick="pairStep(${direct ? 1 : 2})">← ${text('Terug', 'Back', 'Retour', 'Zurück')}</button><button type="button" class="button" onclick="pairStep(4)">${text('Controleren', 'Review', 'Vérifier', 'Prüfen')} →</button></footer></section>`, { viewKey: 'v21-rgbw-pair-groups' });
        return true;
      }
      const selectedZone = array(location?.zones).find(item => String(item.id) === String(draft.zoneId));
      const groups = compatibleRgbwGroups(selectedZone);
      window.modal(`<section class="v21-rgbw-pair" data-phase="rgbw-group">${dots(2)}<header><span><div class="eyebrow">${safe(selectedZone?.name || text('ZONE', 'ZONE', 'ZONE', 'ZONE'))}</div><h1>${text('Kies een RGBW-groep', 'Choose an RGBW group', 'Choisissez un groupe RGBW', 'RGBW-Gruppe wählen')}</h1><p>${text('RGBW en SPI blijven automatisch in aparte groepen.', 'RGBW and SPI remain in separate groups automatically.', 'RGBW et SPI restent automatiquement séparés.', 'RGBW und SPI bleiben automatisch getrennt.')}</p></span></header><div class="v21-rgbw-destination-list">${groups.map(item => `<button type="button" onclick="v21ChooseRgbwPairGroup('${safe(item.id)}')"><i>W</i><span><b>${safe(item.name)}</b><small>${array(item.receivers).length} LED Line${array(item.receivers).length === 1 ? '' : 's'}</small></span><strong>›</strong></button>`).join('') || `<p class="empty">${text('Maak eerst een lege RGBW-groep in deze zone.', 'First create an empty RGBW group in this zone.', 'Créez d’abord un groupe RGBW vide dans cette zone.', 'Erstelle zuerst eine leere RGBW-Gruppe in dieser Zone.')}</p>`}</div><footer><button type="button" class="button soft" onclick="pairStep(2)">← ${text('Zone', 'Zone', 'Zone', 'Zone')}</button></footer></section>`, { viewKey: 'v21-rgbw-pair-group' });
      return true;
    }

    const destinations = rgbwPairDestinations(draft);
    if (destinations.some(item => !item.selectedGroup || !compatibleRgbwGroups(item.selectedZone).includes(item.selectedGroup))) return renderRgbwPairStep(mode === 'separate' ? 3 : 2);
    const { selectedZone, selectedGroup } = destinations[0];
    draft.zoneId = selectedZone.id; draft.groupId = selectedGroup.id;
    const modeCopy = rgbwPairModeCopy(mode);
    window.modal(`<section class="v21-rgbw-pair v21-rgbw-pair-review" data-phase="rgbw-review">${dots(3)}<header><span><div class="eyebrow">${text('CONTROLEREN', 'REVIEW', 'VÉRIFIER', 'PRÜFEN')}</div><h1>${text('Klaar om toe te voegen', 'Ready to add', 'Prêt à ajouter', 'Bereit zum Hinzufügen')}</h1><p>${text('Controleer de poorten en bestemming. Bestaande instellingen blijven intact.', 'Check the ports and destination. Existing settings remain intact.', 'Vérifiez les ports et la destination. Les réglages existants restent intacts.', 'Prüfe Ports und Ziel. Bestehende Einstellungen bleiben erhalten.')}</p></span></header>${rgbwPairBoard(mode)}<div class="v21-rgbw-review-mode"><i>${mode === 'linked' ? '∞' : mode === 'separate' ? 'Ⅱ' : mode === 'port2' ? '2' : '1'}</i><span><b>${safe(modeCopy.title)}</b><small>${safe(modeCopy.detail)}</small></span></div><nav class="v21-rgbw-review-route"><span><small>${text('LOCATIE', 'LOCATION', 'EMPLACEMENT', 'STANDORT')}</small><b>${safe(location?.name || '')}</b></span><em>›</em><span><small>ZONE</small><b>${safe(selectedZone.name)}</b></span><em>›</em><span><small>${text('GROEP', 'GROUP', 'GROUPE', 'GRUPPE')}</small><b>${safe(selectedGroup.name)}</b></span></nav><footer><button type="button" class="button soft" onclick="pairStep(${direct ? 1 : 3})">← ${direct ? text('Poorten', 'Ports', 'Ports', 'Ports') : text('Groep', 'Group', 'Groupe', 'Gruppe')}</button><button type="button" class="button" onclick="v21ConfirmRgbwPair()">＋ ${text('Receiver toevoegen', 'Add receiver', 'Ajouter le récepteur', 'Receiver hinzufügen')}</button></footer></section>`, { viewKey: 'v21-rgbw-pair-review' });
    if (mode === 'separate') {
      const route = document.querySelector('.v21-rgbw-pair-review .v21-rgbw-review-route');
      if (route) route.innerHTML = destinations.map(item => `<span><small>${text('POORT', 'PORT', 'PORT', 'PORT')} ${item.port}</small><b>${safe(item.selectedZone.name)} → ${safe(item.selectedGroup.name)}</b></span>`).join('');
      document.querySelector('.v21-rgbw-pair-review footer .button.soft')?.setAttribute('onclick', 'pairStep(3)');
    }
    return true;
  }

  function installPairingPolish() {
    const previousPairStep = window.pairStep;
    if (typeof previousPairStep !== 'function' || previousPairStep.__v21Wrapped) return;
    const wrappedStep = function v21PairStep(step) {
      if (!isGuideActive() && renderRgbwPairStep(step)) return;
      return previousPairStep.apply(this, arguments);
    };
    wrappedStep.__v21Wrapped = true;
    window.pairStep = wrappedStep;
    try { pairStep = wrappedStep; } catch (_) { /* Global lexical binding is optional. */ }

    window.v21SetRgbwPairMode = function v21SetRgbwPairMode(mode) {
      const draft = currentPairDraft();
      if (!draft || !['port1', 'port2', 'linked', 'separate'].includes(mode)) return;
      draft.rgbwOutputMode = mode;
      draft.portMask = rgbwPairMask(mode);
      renderRgbwPairStep(1);
    };
    window.v21ChooseRgbwPairZone = function v21ChooseRgbwPairZone(zoneId) {
      const draft = currentPairDraft();
      if (!draft) return;
      draft.zoneId = String(zoneId);
      draft.groupId = '';
      renderRgbwPairStep(3);
    };
    window.v21ChooseRgbwPairGroup = function v21ChooseRgbwPairGroup(groupId) {
      const draft = currentPairDraft();
      if (!draft) return;
      draft.groupId = String(groupId);
      renderRgbwPairStep(4);
    };
    window.v21SetRgbwPortDestination = function v21SetRgbwPortDestination(port, value) {
      const draft = currentPairDraft();
      if (!draft || ![1, 2].includes(Number(port))) return;
      const match = array(currentLocation()?.zones).flatMap(zone => compatibleRgbwGroups(zone).map(group => ({ zone, group })))
        .find(item => `${item.zone.id}::${item.group.id}` === value);
      if (!match) return;
      draft.rgbwPortDestinations ||= {};
      draft.rgbwPortDestinations[port] = { zoneId: match.zone.id, groupId: match.group.id };
    };
    let rgbwPairCommitBusy = false;
    window.v21ConfirmRgbwPair = async function v21ConfirmRgbwPair() {
      const draft = currentPairDraft();
      if (!draft || rgbwPairCommitBusy || !document.querySelector('.v21-rgbw-pair-review')) {
        toastMessage(text('Open Receiver toevoegen opnieuw om verder te gaan.', 'Open Add receiver again to continue.', 'Ouvrez à nouveau Ajouter le récepteur.', 'Öffne Receiver hinzufügen erneut.'));
        return;
      }
      const button = document.querySelector('[onclick="v21ConfirmRgbwPair()"]');
      if (button?.disabled) return;
      const requested = rgbwPairMode(draft);
      const deviceId = draft.deviceId;
      const database = currentDatabase();
      const device = array(database?.devices).find(item => String(item.id) === String(deviceId));
      if (!device) return;
      const destinations = rgbwPairDestinations(draft);
      if (destinations.some(item => !item.selectedGroup || !compatibleRgbwGroups(item.selectedZone).includes(item.selectedGroup))) {
        return renderRgbwPairStep(requested === 'separate' ? 3 : 2);
      }
      const destinationSignature = destinations.map(item => `${item.port}:${item.selectedZone.id}:${item.selectedGroup.id}`).join('|');
      rgbwPairCommitBusy = true;
      if (button) { button.disabled = true; button.setAttribute('aria-busy', 'true'); }
      document.querySelector('[data-v21-pair-error]')?.remove();
      try {
        // One final CONFIG stores membership and mode together. The legacy
        // finisher used to send a second CONFIG without the chosen port mode.
        const mode = requested === 'linked' ? 'LINKED' : 'SEPARATE';
        const response = await window.api('/api/command', {
          action: 'config', state: { receiverType: 'RGBW' },
          targets: [{ id: `v21-port-mode-${deviceId}`, deviceId,
            rid: device.rid, physicalRid: device.rid, hardwareId: device.hardwareId,
            receiverType: 'RGBW', port: 0, portMask: rgbwPairMask(requested), portMode: mode }]
        });
        const confirmation = array(response?.results)[0];
        if (!confirmation?.confirmed || confirmation.portModeMatch === false ||
            (confirmation.portMode && confirmation.portMode.toUpperCase() !== mode) ||
            (confirmation.portMask != null && Number(confirmation.portMask) !== rgbwPairMask(requested))) {
          throw new Error(text('De receiver heeft de poorten nog niet bevestigd. Controleer je verbinding en probeer opnieuw.', 'The receiver has not confirmed the ports. Check your connection and try again.', 'Le récepteur n’a pas confirmé les ports. Vérifiez la connexion et réessayez.', 'Der Receiver hat die Ports nicht bestätigt. Prüfe die Verbindung und versuche es erneut.'));
        }
        if (currentPairDraft() !== draft || currentDatabase() !== database || rgbwPairMode(draft) !== requested ||
            rgbwPairDestinations(draft).map(item => `${item.port}:${item.selectedZone?.id}:${item.selectedGroup?.id}`).join('|') !== destinationSignature) {
          throw new Error(text('Je keuze is gewijzigd. Controleer de poorten en tik opnieuw op Toevoegen.', 'Your selection changed. Check the ports and tap Add again.', 'Votre choix a changé. Vérifiez les ports puis ajoutez à nouveau.', 'Deine Auswahl hat sich geändert. Prüfe die Ports und tippe erneut auf Hinzufügen.'));
        }
        const affected = new Set();
        const planned = destinations.map(item => ({ ...item,
          lineState: item.previous?.selectedGroup.parallelLineStates?.[item.previous.line.id] }));
        array(database.installations).forEach(location => array(location.zones).forEach(zone => array(zone.groups).forEach(group => {
          if (!array(group.receivers).some(line => line.deviceId === deviceId)) return;
          affected.add(group);
          group.receivers = array(group.receivers).filter(line => line.deviceId !== deviceId);
          if (!group.receivers.length && group.receiverType === 'RGBW') group.receiverType = null;
        })));
        planned.sort((a, b) => (a.previous?.selectedGroup === a.selectedGroup ? a.previous.index : Infinity) - (b.previous?.selectedGroup === b.selectedGroup ? b.previous.index : Infinity));
        planned.forEach(({ port, selectedZone, selectedGroup, previous, lineState }) => {
          selectedGroup.receiverType = 'RGBW';
          selectedGroup.state = { ...selectedGroup.state, receiverType: 'RGBW', widthPixels: 1, width: 1 };
          if (selectedGroup.state.animation !== 'All Off' && !array(window.AluvisionAnimationRuntime?.rgbwEffects).some(effect => effect.name === selectedGroup.state.animation)) {
            Object.assign(selectedGroup.state, { animation: 'Static Color', engine: 'STATIC', variant: 0 });
          }
          selectedGroup.receivers ||= [];
          const line = { ...previous?.line, id: previous?.line.id || `r-${deviceId}-p${port}`, deviceId,
            name: previous?.line.name || `${device.name || 'Receiver'} · ${text('Poort', 'Port', 'Port', 'Port')} ${port}`,
            rid: String((port === 2 ? device.port2Rid : device.port1Rid) || device.rid || '').toUpperCase(),
            physicalRid: device.rid, hardwareId: device.hardwareId, receiverType: 'RGBW', port, pixels: 1, reversed: false };
          if (previous?.selectedGroup === selectedGroup) selectedGroup.receivers.splice(Math.min(previous.index, selectedGroup.receivers.length), 0, line);
          else selectedGroup.receivers.push(line);
          if (lineState && previous.selectedGroup !== selectedGroup) {
            selectedGroup.parallelLineStates ||= {};
            selectedGroup.parallelLineStates[line.id] = duplicate(lineState);
          }
          selectedGroup.rgbwOutputScope = 'both';
          if (!selectedZone.mainReceiverId) selectedZone.mainReceiverId = deviceId;
          affected.add(selectedGroup);
        });
        Object.assign(device, { receiverType: 'RGBW', portCount: 2, portMask: rgbwPairMask(requested), pixels: 1,
          rgbwOutputMode: requested, rgbwLinked: requested === 'linked', configurationStoredAt: Date.now() });
        affected.forEach(group => {
          const ids = new Set(group.receivers.map(line => line.id));
          for (const key of ['v21SelectedLineIds', 'parallelSelectedIds']) if (Array.isArray(group[key])) group[key] = group[key].filter(id => ids.has(id));
          if (group.parallelLineStates) Object.keys(group.parallelLineStates).forEach(id => { if (!ids.has(id)) delete group.parallelLineStates[id]; });
        });
        const first = destinations[0];
        const location = currentLocation();
        location.activeZoneId = first.selectedZone.id; location.activeGroupId = first.selectedGroup.id;
        database.activeGroupByZone ||= {}; database.activeGroupByZone[first.selectedZone.id] = first.selectedGroup.id;
        try { zone = first.selectedZone; group = first.selectedGroup; receiverAddTarget = null; receiverMoveContext = null; } catch (_) {}
        window.save?.('queued');
        affected.forEach(group => {
          if (!group.receivers.length) return;
          // Commissioning changes the route, not the customer's colour edit.
          // queueLive captures the editor colour into selected line states;
          // replay a detached all-lines view instead so existing colours survive.
          const replay = duplicate(group);
          replay.v21SelectedLineIds = replay.receivers.map(line => line.id);
          Promise.resolve(sendExactRgbw(replay, 'live', true)).catch(() => {});
        });
        window.modal(`<section class="v20-complete v21-rgbw-pair-complete"><div class="v20-success">✓</div><h1>${safe(device.name || 'Receiver')} ${text('is toegevoegd', 'has been added', 'a été ajouté', 'wurde hinzugefügt')}</h1>${rgbwPairBoard(requested)}<div class="rgbw-port-summary"><b>1 receiver → ${requested === 'linked' ? '1' : destinations.length} LED Line${requested !== 'linked' && destinations.length > 1 ? 's' : ''}</b><small>${planned.map(item => `P${item.port} · ${safe(item.selectedZone.name)} → ${safe(item.selectedGroup.name)}`).join('<br>')}</small></div><button type="button" class="button" onclick="openPairedGroup('${safe(first.selectedZone.id)}','${safe(first.selectedGroup.id)}')">${text('Verlichting openen', 'Open lighting', 'Ouvrir l’éclairage', 'Beleuchtung öffnen')}</button></section>`, { viewKey: 'v21-rgbw-pair-complete' });
        return { confirmed: true };
      } catch (error) {
        draft.rgbwOutputMode = requested;
        const footer = document.querySelector('.v21-rgbw-pair-review footer');
        if (footer) {
          const message = document.createElement('p');
          message.dataset.v21PairError = '';
          message.setAttribute('role', 'alert');
          message.textContent = error?.message || text('Toevoegen is niet gelukt. Probeer opnieuw.', 'Could not add the receiver. Try again.', 'Ajout impossible. Réessayez.', 'Hinzufügen fehlgeschlagen. Versuche es erneut.');
          footer.before(message);
        }
        return { error: String(error?.message || error), confirmed: false };
      } finally {
        rgbwPairCommitBusy = false;
        if (button?.isConnected) { button.disabled = false; button.removeAttribute('aria-busy'); }
      }
    };
  }

  function refinePairingWizard() {
    const body = document.getElementById('modalBody');
    const wizard = body?.querySelector('.v20-commission,.v21-rgbw-pair');
    if (!wizard) return;
    body.dataset.v21ReceiverView = 'pairing';
    wizard.querySelectorAll('input[type="range"],input[type="number"],button[onclick*="identify"],button[onclick*="ReceiverSide"]')
      .forEach(control => control.dataset.noSwipe = '');
  }

  const inspectedCustomerText = new WeakMap();
  function stripCustomerTechnicalText(root = document) {
    root.querySelectorAll?.('*:not(script):not(style):not(template):not(noscript)').forEach(node => {
      if (node.childElementCount || !node.textContent) return;
      const value = node.textContent;
      if (inspectedCustomerText.get(node) === value) return;
      if (/\bMAV\b/g.test(value)) node.textContent = value.replace(/\bMAV\b/g, '').replace(/\s{2,}/g, ' ').trim();
      inspectedCustomerText.set(node, node.textContent);
    });
  }

  function normalizeInteractiveElements(root = document) {
    root.querySelectorAll?.('[data-v1815-tool="cmyk"]').forEach(element => element.remove());
    root.querySelectorAll?.('button:not([type])').forEach(button => { button.type = 'button'; });
    root.querySelectorAll?.('img:not([alt])').forEach(image => { image.alt = ''; });
    root.querySelectorAll?.('input[type="range"]').forEach(input => {
      if (!input.getAttribute('aria-label')) {
        const label = input.closest('.control,.setting-visual-panel,.rgbw-live-setting')?.querySelector('label,b')?.textContent?.trim();
        if (label) input.setAttribute('aria-label', label);
      }
    });
    stripCustomerTechnicalText(root);
  }

  function refineProductSettings() {
    const root = document.getElementById('settings');
    if (!root) return;
    /* V21 is delivered as a self-contained iPhone app. Old cards that taught
       users how to leave the product and reopen a Mac-hosted browser copy are
       no longer part of the customer journey. Keep the underlying helpers for
       service compatibility, but never show those stale routes in Settings. */
    root.querySelectorAll('[data-customer-phone]').forEach(node => node.remove());
    root.querySelectorAll('button[onclick*="showIphoneInstructions"],button[onclick*="showIphoneAtHome"],button[onclick*="showRemoteAccess"]').forEach(button => {
      const card = button.closest('.customer-settings-link,.card');
      if (card?.closest('#settings')) card.remove();
      else button.remove();
    });
  }

  function installPresetGroupChoice() {
    window.v21ChoosePresetGroup = function () {
      const location = currentLocation();
      if (!location) return;
      const groups = array(location.zones).flatMap(zone => array(zone.groups));
      const lineCount = group => receiverType(group) === 'RGBW' ? logicalRgbwLines(group).length : array(group.receivers).length;
      window.modal(`<section class="v21-preset-destination" data-v21-view="preset-group-choice"><div class="eyebrow">PRESETS</div><h1>${text('Welke groep wil je bedienen?', 'Which group do you want to control?', 'Quel groupe voulez-vous contrôler ?', 'Welche Gruppe möchtest du steuern?')}</h1><p class="sub">${text('Kies een groep. Je blijft hier bij je presets.', 'Choose a group without leaving your presets.', 'Choisissez un groupe sans quitter vos presets.', 'Wähle eine Gruppe, ohne deine Presets zu verlassen.')}</p>${array(location.zones).filter(zone => array(zone.groups).length).map(zone => `<section><h2>${safe(zone.name)}</h2><div class="v21-destination-grid">${zone.groups.map(group => `<button type="button" class="v21-destination-choice ${group.id === currentGroup()?.id ? 'on' : ''}" aria-pressed="${group.id === currentGroup()?.id}" onclick="${safe(`v21SetPresetGroup(${JSON.stringify(location.id)},${JSON.stringify(zone.id)},${JSON.stringify(group.id)})`)}"><i data-alv-icon="groups" aria-hidden="true">${window.AluvisionIcons?.markup?.('groups') || ''}</i><span><b>${safe(group.name)}</b><small>${lineCount(group)} LED Line${lineCount(group) === 1 ? '' : 's'} · ${receiverType(group)}</small></span><em aria-hidden="true">${group.id === currentGroup()?.id ? '✓' : '›'}</em></button>`).join('')}</div></section>`).join('')}${groups.length ? '' : `<p class="sub">${text('Maak eerst een groep in Zones.', 'Create a group in Zones first.', 'Créez d’abord un groupe dans Zones.', 'Erstelle zuerst eine Gruppe unter Zonen.')}</p>`}<button type="button" class="button soft" onclick="closeModal()">${text('Annuleren', 'Cancel', 'Annuler', 'Abbrechen')}</button></section>`, { viewKey: 'preset-group-choice' });
    };
    window.v21SetPresetGroup = function (locationId, zoneId, groupId) {
      const location = currentLocation();
      const selectedZone = array(location?.zones).find(item => item.id === zoneId);
      const selectedGroup = array(selectedZone?.groups).find(item => item.id === groupId);
      if (location?.id !== locationId || !selectedGroup) {
        toastMessage(text('Deze groep is niet meer beschikbaar.', 'This group is no longer available.', 'Ce groupe n’est plus disponible.', 'Diese Gruppe ist nicht mehr verfügbar.'));
        return;
      }
      zone = selectedZone;
      group = selectedGroup;
      if (typeof rememberActiveGroup === 'function') rememberActiveGroup();
      // Choosing a destination never changes its lighting or leaves Presets.
      window.closeModal();
      window.render();
      queueRefinement();
    };
  }

  function refineSavedLighting() {
    const library = document.getElementById('lighting');
    if (library?.classList.contains('on')) {
      const choose = library.querySelector('.active-context-bar button');
      if (choose) {
        choose.id = 'v21-preset-group-choice';
        choose.setAttribute('onclick', 'v21ChoosePresetGroup()');
        choose.setAttribute('aria-haspopup', 'dialog');
      }
    }
    document.querySelectorAll('#lighting.page.on .preset-card button[onclick],#scenes.page.on .scene-card button[onclick],#home.page.on .home-scene-card button[onclick]').forEach(button => {
      const action = button.getAttribute('onclick') || '';
      const presetId = action.match(/^presetMenu\(['"]([^'"]+)['"]\)/)?.[1];
      const sceneId = action.match(/^sceneMenu\(['"]([^'"]+)['"]\)/)?.[1];
      const item = presetId ? array(currentDatabase()?.presets).find(p => p.id === presetId)
        : sceneId ? array(currentLocation()?.scenes).find(s => s.id === sceneId) : null;
      if (item) {
        button.setAttribute('aria-label', `${presetId ? text('Preset beheren', 'Manage preset', 'Gérer le preset', 'Preset verwalten') : text('Scène beheren', 'Manage scene', 'Gérer la scène', 'Szene verwalten')}: ${item.name}`);
        button.setAttribute('aria-haspopup', 'dialog');
      }
    });
    const body = document.getElementById('modalBody');
    if (!body || document.getElementById('modal')?.hidden || !body.querySelector('#sceneName')) return;
    body.querySelectorAll('.scene-group-pick').forEach(button => {
      button.setAttribute('role', 'checkbox');
      button.setAttribute('aria-checked', String(button.classList.contains('selected')));
    });
    body.querySelectorAll('.scene-zone-head').forEach(button => {
      const groups = [...button.closest('.scene-zone-pick').querySelectorAll('.scene-group-pick')];
      const count = groups.filter(group => group.classList.contains('selected')).length;
      button.setAttribute('role', 'checkbox');
      button.setAttribute('aria-checked', count && count < groups.length ? 'mixed' : String(Boolean(count)));
    });
    const steps = [...body.querySelectorAll('.scene-builder-step')];
    if (steps.length === 3) {
      const put = (node, value) => { if (node && node.textContent !== value) node.textContent = value; };
      put(steps[0].querySelector('b'), text('Kies zones en groepen', 'Choose zones and groups', 'Choisissez les zones et les groupes', 'Zonen und Gruppen wählen'));
      put(steps[0].querySelector('small'), text('Tik een groep aan, of kies een hele zone.', 'Select a group, or choose a whole zone.', 'Sélectionnez un groupe ou une zone entière.', 'Wähle eine Gruppe oder eine ganze Zone.'));
      // Group choices already appear under their zone. Keep the summary but
      // remove the separate, empty second selection step.
      steps[1].classList.add('v21-scene-repeat-step');
      put(steps[2].querySelector('i'), '2');
    }
  }

  let initialUiNormalized = false;
  function refineVisibleUi() {
    observerQueued = false;
    updateVersionMarkers();
    refineBrandAssets();
    if (!initialUiNormalized) {
      normalizeInteractiveElements(document);
      initialUiNormalized = true;
    } else {
      // Hidden effect libraries and inactive pages need no repeated full-tree
      // walk while a user drags a live control. They are normalized on opening.
      document.querySelectorAll('.page.on,#modal:not([hidden]) #modalBody,.top,#activeLocationStrip,.nav')
        .forEach(normalizeInteractiveElements);
    }
    refineHome();
    refineZone();
    refineCustomerHierarchy();
    refineHierarchyIcons();
    refineColourWorkbench();
    refineCompactEditor();
    refineSpiParameterCopy();
    refineReceiverViews();
    refinePairingWizard();
    refineAnimationLibraryCount();
    refineProductSettings();
    refineSavedLighting();
  }

  function queueRefinement() {
    if (observerQueued) return;
    observerQueued = true;
    requestAnimationFrame(refineVisibleUi);
  }

  function installUiObserver() {
    const semanticIconSelector = [
      '.customer-location-mark', '.v18152-location-mark', '.v1814-all-scope-badge>i',
      '.customer-zone-icon', '.customer-zone-detail-icon', '.v18152-zone-scope-mark',
      '.customer-structure-route', '.v188-structure-route',
      '[data-v1814-group-tab="light"]>i', '[data-v1814-group-tab="lines"]>i',
      '.customer-group-empty-preview>i'
    ].join(',');
    const observer = new MutationObserver(records => {
      const needsRefinement = records.some(record => {
        if ([...record.addedNodes].some(node => node?.nodeType === 1)) return true;
        const target = record.target?.nodeType === 1 ? record.target : record.target?.parentElement;
        return Boolean(target?.matches?.(semanticIconSelector) || target?.closest?.(semanticIconSelector));
      });
      if (needsRefinement) queueRefinement();
    });
    observer.observe(document.documentElement, { childList: true, characterData: true, subtree: true });
    document.addEventListener('input', event => {
      if (event.target?.matches?.('input[type="range"],input[type="color"],input[type="number"]')) {
        document.documentElement.dataset.v21LastInput = event.target.id || event.target.name || 'control';
      }
    }, true);
    document.addEventListener('click', event => {
      const tab = event.target?.closest?.('[data-v1814-group-tab]');
      if (tab) lastCustomerPanel = tab.dataset.v1814GroupTab || lastCustomerPanel;
      if (event.target?.closest?.('[data-v1814-home-action="looks"],[data-v18152-zone-action="looks"]')) {
        // Legacy quick controls open in the next animation frame. Refining
        // only their inserted markup can run while the panel is still hidden.
        requestAnimationFrame(() => requestAnimationFrame(queueRefinement));
      }
    }, true);

    /* Some native WebView restores repaint the active-location strip after
       the first DOMContentLoaded render by replacing only its text node. The
       mutation observer above catches that path; the bounded load retries
       cover a late icon-runtime hand-off without creating a permanent timer. */
    window.addEventListener('load', () => {
      refineVisibleUi();
      requestAnimationFrame(() => requestAnimationFrame(refineVisibleUi));
      setTimeout(refineVisibleUi, 160);
    }, { once: true });
  }

  function installSwipeBack() {
    let gesture = null;
    const begin = event => {
      const point = event.touches?.[0] || event;
      if (!point || point.clientX > 34 || event.target?.closest?.('input,select,textarea,[data-no-swipe]')) return;
      gesture = { x: point.clientX, y: point.clientY, time: Date.now() };
    };
    const finish = event => {
      if (!gesture) return;
      const point = event.changedTouches?.[0] || event;
      const dx = point.clientX - gesture.x;
      const dy = Math.abs(point.clientY - gesture.y);
      const elapsed = Date.now() - gesture.time;
      gesture = null;
      if (dx < 72 || dy > 54 || elapsed > 750) return;
      const modalHost = document.getElementById('modal');
      if (modalHost && !modalHost.hidden && typeof window.closeModal === 'function') {
        window.closeModal();
        return;
      }
      const zonesPage = document.getElementById('zones');
      if (!zonesPage?.classList.contains('on')) return;
      if (zonesPage.querySelector('.customer-group-page') && typeof window.showZonePage === 'function') {
        window.showZonePage();
        return;
      }
      if (zonesPage.querySelector('.customer-zone-detail,.customer-zone-control-v2,.structure-group-grid') && typeof window.showZonesOverview === 'function') {
        window.showZonesOverview();
        return;
      }
      if (typeof window.go === 'function') window.go('zones');
    };
    document.addEventListener('touchstart', begin, { passive: true });
    document.addEventListener('touchend', finish, { passive: true });
  }

  function installNavigationCleanup() {
    const previousGo = window.go;
    if (typeof previousGo !== 'function' || previousGo.__v21Wrapped) return;
    const wrapped = function v21Go(page, ...rest) {
      const previousPage = document.querySelector('.page.on')?.id || '';
      if (previousPage !== page && document.activeElement?.closest?.(`#${previousPage}`)) {
        document.activeElement.blur();
      }
      document.querySelectorAll('.page').forEach(node => {
        if (node.id !== page) {
          node.classList.remove('on');
          node.setAttribute('aria-hidden', 'true');
        }
      });
      const result = previousGo.call(this, page, ...rest);
      document.querySelectorAll('.page').forEach(node => {
        const active = node.id === page && node.classList.contains('on');
        node.setAttribute('aria-hidden', String(!active));
      });
      if (previousPage !== page) {
        const resetMainScroll = () => {
          const app = document.querySelector('.app');
          if (app) app.scrollTop = 0;
          document.scrollingElement?.scrollTo?.(0, 0);
        };
        resetMainScroll();
        requestAnimationFrame(() => {
          resetMainScroll();
          requestAnimationFrame(resetMainScroll);
        });
      }
      queueRefinement();
      return result;
    };
    wrapped.__v21Wrapped = true;
    window.go = wrapped;
    try { go = wrapped; } catch (_) { /* Global lexical binding is optional. */ }
  }

  function exposeDiagnostics() {
    window.AluvisionV21 = Object.freeze({
      version: VERSION,
      get canonicalModel() { flushCanonicalSave(); return canonicalModel ? duplicate(canonicalModel) : null; },
      get canonicalError() { return canonicalError; },
      syncCanonicalModel,
      logicalRgbwLines,
      rgbwPreviewTopology,
      selectedRgbwIds,
      exactRgbwTargets,
      familyCounts,
      forceStaticState,
      sendExactRgbw,
      get activePanel() { return lastCustomerPanel; },
      refine: refineVisibleUi
    });
  }

  function start() {
    migrateLegacyAnimationNamesOnce();
    updateVersionMarkers();
    installCanonicalMirror();
    installStableModal();
    installPresetGroupChoice();
    installQuickColourInvariant();
    installExactRgbwRouting();
    installRgbwEffectScopeGuard();
    installGroupPolish();
    installPairingPolish();
    installNavigationCleanup();
    installSwipeBack();
    installUiObserver();
    exposeDiagnostics();
    refineVisibleUi();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
