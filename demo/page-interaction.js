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
