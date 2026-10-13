/* Passive presentation only. One bounded press and explicit entry hooks,
   no click synthesis, scroll interception, model access, observers, network
   or receiver operations. The app retains close/focus/state authority. */
(function () {
  'use strict';
  if (window.InterfaceMotion) return;
  const root = document.documentElement;
  const selector = [
    'button.button', 'button.icon-button', 'button.text-button', 'button.menu-card',
    'button.settings-toggle', 'button.spatial-choice-toggle', 'button.ledline-setup-toggle',
    'button.ledline-add-action', 'button.ledline-settings-toggle', 'button.ledline-reuse-action',
    'button.animation-category-trigger', 'button.animation-category-choice',
    'button.animation-gallery-return', 'button.animation-settings-return',
    'button.current-effect-gallery', 'button.assignment-choice',
    'button.assignment-family-choice', 'button.back', '.navigation > button',
    '.control-mode-tabs > button', '.section-tabs > button', '.filter-row > button',
    '.preference-grid > button', '.compact-direction > button',
    '.physical-port-picker > button', '.family-spatial-options > button',
    '.spatial-preview-switch > button', '.channel-row > button', '.preview-size-picker > button'
  ].join(',');
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const listeners = [];
  const surfaces = new Map();
  let press = null, destroyed = false, pageContext = null;
  function cancel() {
    if (!press) return;
    clearTimeout(press.timer);
    if (press.target.getAttribute('data-interface-press') === 'held') press.target.removeAttribute('data-interface-press');
    press = null;
  }
  function targetFor(event) {
    if (destroyed || reduced?.matches || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
    const target = event.target?.closest?.(selector);
    if (!target || !target.isConnected || target.disabled || target.getAttribute('aria-disabled') === 'true' ||
        target.closest('[inert]') || target.matches('[role="switch"],.switch') || target.querySelector('canvas') ||
        target.closest('.order-handle,.colour-drag-handle,[data-interface-motion="off"]')) return null;
    return target;
  }
  function begin(target, input, x, y) {
    cancel();
    // Never take over an attribute supplied by another component.
    if (target.hasAttribute('data-interface-press')) return;
    press = {target, input, x, y, timer: setTimeout(cancel, 2500)};
    target.setAttribute('data-interface-press', 'held');
  }
  function pointerDown(event) {
    if (event.button !== 0 || event.isPrimary === false) return;
    const target = targetFor(event);
    if (target) begin(target, 'pointer:' + event.pointerId, event.clientX, event.clientY);
  }
  function pointerEnd(event) {
    if (press?.input === 'pointer:' + event.pointerId) cancel();
  }
  function pointerMove(event) {
    if (press?.input === 'pointer:' + event.pointerId &&
        Math.hypot(event.clientX - press.x, event.clientY - press.y) > 10) cancel();
  }
  function keyDown(event) {
    if (event.repeat || ![' ', 'Enter'].includes(event.key)) return;
    const target = targetFor(event);
    if (target) begin(target, 'key:' + event.key);
  }
  function keyUp(event) {
    if (press?.input === 'key:' + event.key) cancel();
  }
  function visibility() { if (document.hidden) { cancel(); cancelEntries(); } }
  function windowBlur(event) { if (event.target === window) cancel(); }
  function preference() { if (reduced?.matches) { cancel(); cancelEntries(); } }
  function cancelEntry(target) {
    const surface = surfaces.get(target);
    if (!surface) return;
    if (surface.entryAttribute === null) target.removeAttribute('data-interface-entry');
    else target.setAttribute('data-interface-entry', surface.entryAttribute);
    if (!surface.animation) return;
    const animation = surface.animation;
    surface.animation = null;
    // An aborted animation must immediately reveal the authoritative DOM,
    // not retain a faded/translated fill while settings are rerendered.
    try { animation.cancel(); } catch (_) {}
  }
  function cancelEntries() {
    for (const target of surfaces.keys()) cancelEntry(target);
  }
  function releaseSurface(target) {
    const surface = surfaces.get(target);
    if (!surface) return;
    cancelEntry(target);
    if (surface.close) target.removeEventListener('close', surface.close);
    if (surface.attribute === null) target.removeAttribute('data-interface-sheet');
    else target.setAttribute('data-interface-sheet', surface.attribute);
    surfaces.delete(target);
  }
  function manageSurface(target, kind) {
    // Status rerenders can replace a spatial picker. Release detached nodes
    // on the next explicit hook; no DOM observer or permanent node retention.
    for (const previous of surfaces.keys()) if (!previous.isConnected) releaseSurface(previous);
    let surface = surfaces.get(target);
    if (surface) return surface;
    surface = {kind, attribute: target.getAttribute('data-interface-sheet'),
      entryAttribute: target.getAttribute('data-interface-entry'), animation: null};
    surfaces.set(target, surface);
    target.setAttribute('data-interface-sheet', kind);
    if (kind === 'dialog') {
      surface.close = () => {
        // Native close events are queued. A rapid reopen must not be
        // cancelled by the previous session's late close notification.
        if (!target.open) cancelEntry(target);
      };
      target.addEventListener('close', surface.close);
    }
    return surface;
  }
  function enterSurface(target, kind, wasOpen) {
    if (destroyed || !target?.isConnected || kind === 'dialog' && !target.open ||
        kind === 'panel' && target.hidden) return false;
    const surface = manageSurface(target, kind);
    cancelEntry(target);
    // An open dialog's content may change on every colour/status update.
    // The caller passes its prior open state (also for a restored new node),
    // so those updates never replay a menu entrance or move its viewport.
    if (wasOpen || reduced?.matches || document.hidden || typeof target.animate !== 'function') return false;
    const translated = kind === 'dialog' && !target.classList?.contains('v50-fullscreen-preview') &&
      !target.querySelector?.('[data-stand-control-sheet], .v50-full-preview');
    const frames = translated
      ? [{opacity: .55, transform: 'translate3d(0,6px,0)'}, {opacity: 1, transform: 'none'}]
      : [{opacity: .65}, {opacity: 1}];
    let animation;
    try {
      animation = target.animate(frames, {duration: kind === 'dialog' ? 220 : 160,
        easing: 'cubic-bezier(.22,.72,.25,1)', fill: 'both'});
    } catch (_) { return false; }
    surface.animation = animation;
    target.setAttribute('data-interface-entry', 'true');
    const finish = () => {
      // Completion/cancellation of an old session cannot clear a new entry.
      if (surface.animation !== animation) return;
      surface.animation = null;
      if (surface.entryAttribute === null) target.removeAttribute('data-interface-entry');
      else target.setAttribute('data-interface-entry', surface.entryAttribute);
      try { animation.cancel(); } catch (_) {}
    };
    if (animation.finished?.then) animation.finished.then(finish, finish);
    else {
      // A partial WAAPI implementation is safer as an instant reveal than
      // an indefinite fill with an unobservable completion lifecycle.
      finish();
    }
    return true;
  }
  function listen(surface, name, handler) {
    const options = {capture: true, passive: true};
    surface.addEventListener(name, handler, options);
    listeners.push(() => surface.removeEventListener(name, handler, options));
  }
  for (const [name, handler] of [['pointerdown', pointerDown], ['pointerup', pointerEnd],
    ['pointercancel', pointerEnd], ['pointermove', pointerMove], ['keydown', keyDown],
    ['keyup', keyUp], ['visibilitychange', visibility]]) listen(document, name, handler);
  // Capture also sees ordinary element focus changes; those must not erase
  // the pointer press which just gave this button its accessible focus.
  listen(window, 'blur', windowBlur);
  listen(window, 'pagehide', () => { cancel(); cancelEntries(); });
  if (reduced?.addEventListener) {
    reduced.addEventListener('change', preference);
    listeners.push(() => reduced.removeEventListener('change', preference));
  } else if (reduced?.addListener) {
    reduced.addListener(preference);
    listeners.push(() => reduced.removeListener(preference));
  }
  root.classList.add('interface-polish');
  window.InterfaceMotion = Object.freeze({
    cancel,
    showPage(page, context) {
      if(context===pageContext)return false;
      const initial=pageContext===null;pageContext=context;
      return enterSurface(page,'panel',initial);
    },
    openDialog(dialog, wasOpen = false) { return enterSurface(dialog, 'dialog', wasOpen); },
    cancelDialog: cancelEntry,
    openPanel(panel, wasOpen = false) { return enterSurface(panel, 'panel', wasOpen); },
    cancelPanel: cancelEntry,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancel();
      for (const target of [...surfaces.keys()]) releaseSurface(target);
      for (const remove of listeners) remove();
      root.classList.remove('interface-polish');
    }
  });
})();
