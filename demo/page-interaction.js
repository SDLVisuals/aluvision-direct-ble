'use strict';

// WebKit exposes these gesture events for page magnification. Restrict only
// that gesture: do not intercept touchmove, wheel, key, click or selection.
// Native WKWebView also enforces a fixed scale in V30App.swift.
(() => {
  const preventPageMagnification = event => {
    if (event.cancelable) event.preventDefault();
  };
  for (const type of ['gesturestart', 'gesturechange']) {
    document.addEventListener(type, preventPageMagnification, { passive: false });
  }
})();

// A browser's visual viewport can shrink without changing 100dvh (Safari),
// while the native app instead resizes its whole WKWebView. Handle both so
// fields and their existing actions remain in the visible part of the page.
(() => {
  const root = document.documentElement;
  const viewport = window.visualViewport;
  const touchInput = window.matchMedia?.('(hover: none) and (pointer: coarse)');
  let restingHeight = window.innerHeight, restingWidth = window.innerWidth, frame = 0;
  const editable = element => element?.matches?.('textarea,[contenteditable="true"],input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):not([type="hidden"])') && !element.disabled && !element.readOnly;
  function revealField(field, top, bottom) {
    // Move only existing scrolling surfaces, never recreate/refocus an input:
    // its text selection and the platform keyboard must stay undisturbed.
    const dialog = field.closest?.('dialog[open]');
    for (let parent = field.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      if (parent.scrollHeight <= parent.clientHeight + 1 || !/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) continue;
      const bounds = parent.getBoundingClientRect(), rect = field.getBoundingClientRect();
      const header = parent === dialog ? parent.querySelector(':scope > header,:scope > #effect-dialog-content > header') : null;
      const stickyHeaderBottom = header && getComputedStyle(header).position === 'sticky' ? header.getBoundingClientRect().bottom + 12 : 0;
      const footer = parent === dialog ? parent.querySelector(':scope > footer,:scope > #effect-dialog-content > footer') : null;
      const stickyFooterTop = footer && getComputedStyle(footer).position === 'sticky' ? footer.getBoundingClientRect().top - 12 : Infinity;
      const visibleTop = Math.max(top + 12, bounds.top + 12, stickyHeaderBottom);
      const visibleBottom = Math.min(bottom - 20, bounds.bottom - 12, stickyFooterTop);
      const delta = rect.bottom > visibleBottom ? rect.bottom - visibleBottom : rect.top < visibleTop ? rect.top - visibleTop : 0;
      if (Math.abs(delta) > 1) parent.scrollBy({top: delta, behavior: 'auto'});
      if (parent === dialog) return;
    }
    if (dialog) return;
    const rect = field.getBoundingClientRect();
    const delta = rect.bottom > bottom - 20 ? rect.bottom - bottom + 20 : rect.top < top + 12 ? rect.top - top - 12 : 0;
    if (Math.abs(delta) > 1) window.scrollBy({top: delta, behavior: 'auto'});
  }
  function updateViewport() {
    frame = 0;
    const field = document.activeElement;
    const typing = editable(field);
    const height = viewport?.height || window.innerHeight;
    const top = viewport?.offsetTop || 0;
    // Never interpret pinch/accessibility zoom, or ordinary browser chrome,
    // as a keyboard. Native resizing is compared with the last resting frame.
    const scale = viewport?.scale || 1;
    if (window.innerWidth !== restingWidth) {
      restingWidth = window.innerWidth;
      restingHeight = window.innerHeight;
    } else if (!typing) restingHeight = Math.max(restingHeight, window.innerHeight);
    const keyboard = Boolean(typing && touchInput?.matches !== false && Math.abs(scale - 1) < .05 &&
      Math.max(restingHeight - height, window.innerHeight - height) > 120);
    root.classList.toggle('keyboard756', keyboard);
    if (!keyboard) {
      root.style.removeProperty('--keyboard-visible-height756');
      root.style.removeProperty('--keyboard-visible-top756');
      return;
    }
    root.style.setProperty('--keyboard-visible-height756', `${Math.round(height)}px`);
    root.style.setProperty('--keyboard-visible-top756', `${Math.round(top)}px`);
    revealField(field, top, top + height);
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(updateViewport); }
  // The input itself intentionally remains focused after touch. Only its
  // decorative outline changes; hardware keyboard navigation stays visible.
  document.addEventListener('pointerdown', () => { root.dataset.inputModality756 = 'pointer'; }, {capture: true, passive: true});
  document.addEventListener('keydown', event => {
    if (['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(event.key)) root.dataset.inputModality756 = 'keyboard';
  }, {capture: true, passive: true});
  document.addEventListener('focusin', schedule, {passive: true});
  document.addEventListener('focusout', schedule, {passive: true});
  window.addEventListener('resize', schedule, {passive: true});
  viewport?.addEventListener('resize', schedule, {passive: true});
  viewport?.addEventListener('scroll', schedule, {passive: true});
  window.addEventListener('pageshow', schedule, {passive: true});
  schedule();
})();
