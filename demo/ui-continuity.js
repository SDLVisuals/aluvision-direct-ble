/* Presentation continuity only. No model, storage, transport or events.
   Never substitute a positional neighbour when the original control is gone. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LightningUIContinuity = api;
})(typeof window === 'object' ? window : this, function () {
  'use strict';
  const owners = ['data-order-item', 'data-draft-receiver', 'data-receiver-detail',
    'data-receiver-connections', 'data-scene-zone', 'data-line-id', 'data-colour-picker', 'data-slot',
    'data-onboarding-stage', 'data-setup-origin'];
  function key(element, host, kind) {
    if (!element || !host?.contains(element)) return null;
    const context = [];
    for (let ancestor = element.parentElement; ancestor && ancestor !== host; ancestor = ancestor.parentElement) {
      const identity = owners.filter(name => ancestor.hasAttribute(name)).map(name => [name, ancestor.getAttribute(name)]);
      if (ancestor.id) identity.push(['id', ancestor.id]);
      if (identity.length) context.push(identity);
    }
    const data = Object.keys(element.dataset || {}).filter(name => name !== 'interfacePress').sort().map(name => [name, element.dataset[name]]);
    return JSON.stringify([kind, element.tagName, element.id || '', element.type || '',
      element.getAttribute('name') || '', data,
      kind === 'disclosure' ? String(element.className || '').split(/\s+/).filter(Boolean).sort() : [], context]);
  }
  function groups(host, selector, kind) {
    const result = new Map();
    for (const element of host.querySelectorAll(selector)) {
      const identity = key(element, host, kind);
      if (!identity) continue;
      if (!result.has(identity)) result.set(identity, []);
      result.get(identity).push(element);
    }
    return result;
  }
  function unique(host, selector, kind, identity) {
    if (!identity) return null;
    const matches = groups(host, selector, kind).get(identity);
    return matches?.length === 1 ? matches[0] : null;
  }
  function captureDisclosures(host) {
    return Array.from(groups(host, 'details', 'disclosure'), ([identity, elements]) =>
      elements.length === 1 ? {key: identity, open: elements[0].open === true} : null).filter(Boolean);
  }
  function restoreDisclosures(host, previous, selector = 'details') {
    const targets = groups(host, selector, 'disclosure');
    for (const entry of previous) {
      const matches = targets.get(entry.key);
      if (matches?.length === 1) matches[0].open = entry.open;
    }
  }
  function restoreOnboardingHelp(host, previous) {
    // These passive help panels are mounted after the outer page. Never
    // replay destination details here: those own a modal dialog lifecycle.
    restoreDisclosures(host, previous, 'details.onboarding-wifi-help,details.onboarding-recovery');
  }
  function captureEditor(host, element) {
    if (!host.contains(element) || !element.matches('input,textarea,select')) return null;
    const identity = key(element, host, 'editor');
    if (unique(host, 'input,textarea,select', 'editor', identity) !== element) return null;
    // Credential controls may regain focus, but their values are never read,
    // copied or replayed, including a suggested PIN displayed as plain text.
    const sensitive = element.matches('[type="password"],[data-stand-code],[data-first-stand-code],'+
      '[data-first-stand-code-confirm],[data-recovery-pin],[autocomplete="one-time-code"],'+
      '[autocomplete="current-password"],[autocomplete="new-password"]');
    const editable = !sensitive && (['text', 'search', 'number'].includes(element.type) || element.tagName === 'TEXTAREA');
    return {key: identity, ...(editable ? {value: element.value,
      start: element.selectionStart, end: element.selectionEnd, direction: element.selectionDirection} : {})};
  }
  function restoreEditor(host, previous) {
    if (!previous) return false;
    const next = unique(host, 'input,textarea,select', 'editor', previous.key);
    if (!next || next.disabled || next.closest('[hidden],[inert]')) return false;
    if (Object.prototype.hasOwnProperty.call(previous, 'value')) next.value = previous.value;
    next.focus({preventScroll: true});
    if (previous.start != null) try { next.setSelectionRange(previous.start, previous.end, previous.direction); } catch (_) {}
    return true;
  }
  function captureAction(host, element) {
    if (!element?.matches?.('button[data-action]')) return null;
    const identity = key(element, host, 'action');
    return unique(host, 'button[data-action]', 'action', identity) === element ? identity : null;
  }
  function restoreCapturedAction(host, identity) {
    const next = unique(host, 'button[data-action]', 'action', identity);
    if (!next || next.disabled || next.closest('[hidden],[inert]')) return false;
    next.focus({preventScroll: true});
    return true;
  }
  return Object.freeze({captureDisclosures, restoreDisclosures, restoreOnboardingHelp, captureEditor, restoreEditor,
    captureAction, restoreCapturedAction});
});
