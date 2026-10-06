(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LightningLedlineOrderDrag = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // Presentation only. The caller owns physical line identity, stable colours,
  // persistence/CAS, native authority and deferral of ordinary status renders.
  function install(options) {
    options = options || {};
    var host = options.root || (typeof document !== 'undefined' ? document : null);
    if (!host || typeof host.addEventListener !== 'function' ||
        typeof options.getItems !== 'function' || typeof options.getRowId !== 'function' ||
        typeof options.onDrop !== 'function') throw new TypeError('ORDER_INSTALL_INVALID');
    var document = host.ownerDocument || host;
    var view = document.defaultView, active = null, destroyed = false, scrollFrame = null;
    var interaction = typeof options.onInteraction === 'function' ? options.onInteraction : function () {};
    var status = typeof options.onStatus === 'function' ? options.onStatus : function () {};
    function items() {
      var values = options.getItems();
      if (!Array.isArray(values) || values.length > 1024 || values.some(function (id) {
        return typeof id !== 'string' || !id.length;
      }) || new Set(values).size !== values.length) throw new TypeError('ORDER_ITEMS_INVALID');
      return values.slice();
    }
    function contains(element) { return !!element && element.isConnected && host.contains(element); }
    function handleOf(target) {
      var handle = target && typeof target.closest === 'function' ? target.closest('[data-order-handle]') : null;
      return contains(handle) ? handle : null;
    }
    function rows(ids) {
      var values = Array.from(host.querySelectorAll('[data-order-item]'));
      if (values.length !== ids.length || values.some(function (row, index) {
        return !contains(row) || options.getRowId(row) !== ids[index];
      })) throw new TypeError('ORDER_ROWS_CHANGED');
      return values;
    }
    function announce(text) { try { status(text); } catch (_) { /* Status never grants authority or retries a drop. */ } }
    function notify(value, state) { interaction(value, { id: state.id, input: state.input }); }
    function activity() {
      var state = active;
      if (!state || typeof options.onActivity !== 'function') return;
      try { options.onActivity({ id: state.id, input: state.input }); }
      catch (_) { finish(false); return; }
      if (active === state) valid(); // Real-gesture callback may change the caller's scope.
    }
    function stopScroll() {
      if (scrollFrame !== null && view && typeof view.cancelAnimationFrame === 'function') view.cancelAnimationFrame(scrollFrame);
      scrollFrame = null;
    }
    function scrollDelta(y) {
      if (!view || !Number.isFinite(y) || !Number.isFinite(view.innerHeight) || view.innerHeight <= 0) return 0;
      try {
        var bounds = typeof options.getScrollBounds === 'function' ? options.getScrollBounds() : { top: 0, bottom: view.innerHeight };
        if (!bounds || !Number.isFinite(bounds.top) || !Number.isFinite(bounds.bottom) ||
            bounds.top < 0 || bounds.bottom > view.innerHeight || bounds.bottom <= bounds.top) return 0;
        var edge = Math.min(80, (bounds.bottom - bounds.top) / 2);
        if (y < bounds.top + edge) return -Math.min(12, 12 * (bounds.top + edge - y) / edge);
        if (y > bounds.bottom - edge) return Math.min(12, 12 * (y - bounds.bottom + edge) / edge);
      } catch (_) { /* Invalid bounds disable scrolling, not the caller's persistence guards. */ }
      return 0;
    }
    function queueScroll() {
      if (!active || active.input !== 'pointer' || !view || typeof view.requestAnimationFrame !== 'function' ||
          typeof view.scrollBy !== 'function') return;
      var state = active, delta = scrollDelta(state.pointerY);
      if (active !== state || !valid()) return;
      if (!delta) { stopScroll(); return; }
      if (scrollFrame === null) scrollFrame = view.requestAnimationFrame(scrollTick);
    }
    function scrollTick() {
      scrollFrame = null;
      if (!active || active.input !== 'pointer' || !valid()) return;
      var state = active, delta = scrollDelta(state.pointerY), before = view.scrollY;
      if (active !== state || !valid() || !delta || !Number.isFinite(before)) return;
      // Viewport only, one bounded scroll per frame. No flush, navigation or model mutation.
      try { view.scrollBy({ top: delta, left: 0, behavior: 'instant' }); } catch (_) { return; }
      if (active !== state || !valid()) return;
      point({ clientY: state.pointerY }); // Rows have moved even when the captured pointer has not.
      if (active === state && view.scrollY !== before) queueScroll(); // Stop at a saturated viewport.
    }
    function clean(state) {
      stopScroll();
      state.handle.removeAttribute('aria-grabbed');
      state.row.removeAttribute('data-order-grabbed');
      state.rows.forEach(function (row) {
        row.removeAttribute('data-order-drop'); row.removeAttribute('data-order-drop-index');
      });
      if (state.pointerId !== null && typeof state.handle.hasPointerCapture === 'function' &&
          state.handle.hasPointerCapture(state.pointerId)) {
        try { state.handle.releasePointerCapture(state.pointerId); } catch (_) {}
      }
    }
    function finish(commit) {
      var state = active;
      if (!state) return;
      active = null; // releasePointerCapture can synchronously dispatch a lost event.
      clean(state);
      var dropped = false, failed = false;
      try {
        if (commit && state.toIndex !== state.fromIndex) {
          dropped = true;
          var result = options.onDrop({ id: state.id, toIndex: state.toIndex });
          // Report failure only, never retry or label persistence as confirmed.
          if (result && typeof result.then === 'function') Promise.resolve(result).catch(function () {
            announce('De volgorde is nog niet bevestigd.');
          });
        }
      } catch (_) { failed = true; }
      finally { try { notify(false, state); } catch (_) {} }
      announce(failed ? 'De volgorde is nog niet bevestigd.' : commit ?
        (dropped ? 'Volgorde doorgegeven.' : 'Volgorde niet gewijzigd.') : 'Verplaatsen geannuleerd.');
    }
    function valid() {
      if (!active) return false;
      try {
        var fresh = items();
        if (!contains(active.handle) || !contains(active.row) ||
            fresh.length !== active.ids.length || fresh.some(function (id, i) { return id !== active.ids[i]; }) ||
            rows(fresh).some(function (row, i) { return row !== active.rows[i]; })) throw new Error('ORDER_CHANGED');
        return true;
      } catch (_) { finish(false); return false; }
    }
    function begin(handle, input, pointerId) {
      if (destroyed || active || handle.disabled || handle.getAttribute('aria-disabled') === 'true') return false;
      try {
        var ids = items(), row = handle.closest('[data-order-item]'), allRows = rows(ids);
        var id = options.getRowId(row), index = ids.indexOf(id);
        if (index < 0 || !contains(row)) return false;
        active = { handle: handle, row: row, rows: allRows, id: id, ids: ids,
          fromIndex: index, toIndex: index, input: input, pointerId: pointerId, pointerY: null };
        handle.setAttribute('aria-grabbed', 'true'); row.setAttribute('data-order-grabbed', 'true');
        if (typeof handle.focus === 'function') handle.focus({ preventScroll: true });
        if (pointerId !== null) handle.setPointerCapture(pointerId);
        notify(true, active);
        if (!valid()) return false; // caller may change the scope in onInteraction.
        announce('Ledline opgepakt. Plaats ' + (index + 1) + ' van ' + ids.length + '.');
        return true;
      } catch (_) { finish(false); return false; }
    }
    function mark(row, edge, index) {
      active.rows.forEach(function (item) {
        item.removeAttribute('data-order-drop'); item.removeAttribute('data-order-drop-index');
      });
      active.toIndex = index;
      row.setAttribute('data-order-drop', edge);
      row.setAttribute('data-order-drop-index', String(index));
      announce('Plaats ' + (index + 1) + ' van ' + active.ids.length + '.');
    }
    function point(event) {
      if (!valid() || !Number.isFinite(event.clientY)) return;
      var nearest, distance = Infinity;
      active.rows.forEach(function (row, index) {
        var box = row.getBoundingClientRect(), middle = box.top + box.height / 2;
        if (!Number.isFinite(middle) || box.height <= 0) return;
        var next = Math.abs(event.clientY - middle);
        if (next < distance) { distance = next; nearest = { row: row, index: index, middle: middle }; }
      });
      if (!nearest) { finish(false); return; }
      var edge = event.clientY < nearest.middle ? 'before' : 'after';
      var boundary = nearest.index + (edge === 'after' ? 1 : 0);
      var to = boundary > active.fromIndex ? boundary - 1 : boundary;
      mark(nearest.row, edge, Math.max(0, Math.min(active.ids.length - 1, to)));
    }
    function pointerDown(event) {
      var handle = handleOf(event.target);
      if (!handle || event.button !== 0 || event.isPrimary === false) return;
      if (begin(handle, 'pointer', event.pointerId) && active) {
        event.preventDefault(); active.pointerY = event.clientY; queueScroll();
      }
    }
    function pointerMove(event) {
      if (!active || active.input !== 'pointer' || active.pointerId !== event.pointerId) return;
      event.preventDefault(); active.pointerY = event.clientY; point(event);
      if (active && Number.isFinite(event.clientY)) activity();
      queueScroll();
    }
    function pointerUp(event) {
      if (!active || active.input !== 'pointer' || active.pointerId !== event.pointerId) return;
      event.preventDefault(); point(event); if (valid()) finish(true);
    }
    function pointerCancel(event) {
      if (active && active.input === 'pointer' && active.pointerId === event.pointerId) finish(false);
    }
    function keyDown(event) {
      if (event.key === 'Escape' && active) { event.preventDefault(); finish(false); return; }
      var handle = handleOf(event.target);
      if (!handle) return;
      if (!active && (event.key === ' ' || event.key === 'Spacebar')) {
        event.preventDefault(); begin(handle, 'keyboard', null); return;
      }
      if (!active || active.input !== 'keyboard' || active.handle !== handle || !valid()) return;
      if (event.key === 'Enter') { event.preventDefault(); finish(true); return; }
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
      event.preventDefault();
      var next = Math.max(0, Math.min(active.ids.length - 1, active.toIndex + (event.key === 'ArrowUp' ? -1 : 1)));
      mark(active.rows[next], next < active.fromIndex ? 'before' : 'after', next);
      activity();
    }
    function click(event) {
      if (handleOf(event.target)) { event.preventDefault(); event.stopPropagation(); }
    }
    var listeners = [['pointerdown', pointerDown], ['pointermove', pointerMove], ['pointerup', pointerUp],
      ['pointercancel', pointerCancel], ['lostpointercapture', pointerCancel], ['keydown', keyDown], ['click', click]];
    listeners.forEach(function (pair) { host.addEventListener(pair[0], pair[1], true); });
    var observer = view && typeof view.MutationObserver === 'function' ? new view.MutationObserver(function () {
      if (active) valid();
    }) : null;
    if (observer) observer.observe(host.nodeType === 9 ? host.documentElement : host, { childList: true, subtree: true });
    return Object.freeze({
      isActive: function () { return !!active; },
      refresh: function () { return active ? valid() : false; },
      cancel: function () { finish(false); },
      destroy: function () {
        if (destroyed) return; destroyed = true; finish(false);
        listeners.forEach(function (pair) { host.removeEventListener(pair[0], pair[1], true); });
        if (observer) observer.disconnect();
      }
    });
  }
  return Object.freeze({ install: install });
}));
