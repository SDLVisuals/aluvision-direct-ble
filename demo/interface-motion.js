/* Passive presentation only. One bounded press, no click synthesis, scroll
   interception, model access, observers, network or receiver operations. */
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
  let press = null, destroyed = false;
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
  function visibility() { if (document.hidden) cancel(); }
  function windowBlur(event) { if (event.target === window) cancel(); }
  function preference() { if (reduced?.matches) cancel(); }
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
  listen(window, 'pagehide', cancel);
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
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancel();
      for (const remove of listeners) remove();
      root.classList.remove('interface-polish');
    }
  });
})();
