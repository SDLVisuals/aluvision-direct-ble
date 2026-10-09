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
    var feedback = typeof options.onFeedback === 'function' ? options.onFeedback : function () {};
    var messageDefaults = {
      orderDragUnconfirmed: 'De volgorde is nog niet bevestigd.',
      orderDragSubmitted: 'Volgorde doorgegeven.',
      orderDragUnchanged: 'Volgorde niet gewijzigd.',
      orderDragCancelled: 'Verplaatsen geannuleerd.',
      orderDragPicked: 'Ledline opgepakt. Plaats {position} van {count}.',
      orderDragPosition: 'Plaats {position} van {count}.'
    };
    function message(key, params) {
      var translated;
      try { if (typeof options.message === 'function') translated = options.message(key, params || {}); }
      catch (_) { /* Copy failure never changes interaction/persistence authority. */ }
      var text = typeof translated === 'string' && translated && translated !== key ? translated : messageDefaults[key];
      return text.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, function (match, name) {
        return params && ['string', 'number'].includes(typeof params[name]) ? String(params[name]) : match;
      });
    }
    var scrollTop = typeof options.getScrollTop === 'function' ? options.getScrollTop : function () { return view.scrollY; };
    var scrollBy = typeof options.scrollBy === 'function' ? options.scrollBy : function (delta) { view.scrollBy({ top: delta, left: 0, behavior: 'instant' }); };
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
    function slots(ids) {
      if (typeof options.getSlotElements !== 'function') return null;
      var values = Array.from(options.getSlotElements() || []);
      if (values.length !== ids.length || values.some(function (slot, index) {
        return !contains(slot) || slot.getAttribute('data-order-position') !== String(index + 1);
      })) throw new TypeError('ORDER_SLOTS_CHANGED');
      return values;
    }
    function captureLayout(state) {
      if (!state.slots) return;
      // Read the untransformed cards once. Slot height and hit geometry stay
      // attached to their positions for the whole gesture, including scroll.
      var boxes = state.rows.map(function (row) { return row.getBoundingClientRect(); });
      if (boxes.some(function (box) { return !Number.isFinite(box.top) || !Number.isFinite(box.height) || box.height <= 0; })) {
        throw new TypeError('ORDER_LAYOUT_INVALID');
      }
      state.layout = boxes.map(function (box) { return { top: box.top, height: box.height }; });
      state.slots.forEach(function (slot, index) {
        slot.style.height = boxes[index].height + 'px';
      });
      state.slotLayout = state.slots.map(function (slot) { return slot.getBoundingClientRect(); });
      if (state.slotLayout.some(function (box) { return !Number.isFinite(box.top) || !Number.isFinite(box.height) || box.height <= 0; })) {
        throw new TypeError('ORDER_SLOT_LAYOUT_INVALID');
      }
      previewCards(state);
    }
    function previewCards(state) {
      if (!state.slots || !state.layout) return;
      var order = previewOrder(state);
      order.forEach(function (id, index) {
        var originalIndex = state.ids.indexOf(id), row = state.rows[originalIndex], box = state.layout[originalIndex], target = state.slotLayout[index];
        row.style.setProperty('--order-preview-y', (target.top - box.top) + 'px');
        row.style.setProperty('--order-preview-clip', Math.max(0, box.height - target.height) + 'px');
        row.setAttribute('data-order-preview', 'true');
        // Keep the DOM and settings state intact. A taller card is clipped
        // only for this preview so it fits its fixed target without overlap.
      });
    }
    function announce(text) { try { status(text); } catch (_) { /* Status never grants authority or retries a drop. */ } }
    function notify(value, state) { interaction(value, { id: state.id, input: state.input }); }
    function previewOrder(state) {
      var order = state.ids.slice(), moved = order.splice(state.fromIndex, 1)[0];
      order.splice(state.toIndex, 0, moved); return order;
    }
    function emitFeedback(phase, state) {
      // A proposed order is a presentation copy. Neither callbacks nor the
      // ghost grant persistence/transport authority or mutate the item list.
      try { feedback(Object.freeze({ phase: phase, active: phase === 'start' || phase === 'update',
        id: state.id, fromIndex: state.fromIndex, toIndex: state.toIndex, input: state.input,
        previewOrder: Object.freeze(previewOrder(state)) })); } catch (_) {}
    }
    function positionGhost(state) {
      if (!state.ghost || !view || !Number.isFinite(view.innerWidth) || !Number.isFinite(view.innerHeight)) return;
      var box = state.row.getBoundingClientRect(), width = Math.max(0, Math.min(box.width, view.innerWidth - 24));
      if (!Number.isFinite(width) || !width) return;
      var left = Math.max(12, Math.min(box.left, view.innerWidth - width - 12));
      state.ghost.style.width = width + 'px';
      var height = state.ghost.getBoundingClientRect().height;
      var target = (state.slots || state.rows)[state.toIndex].getBoundingClientRect();
      var y = state.input === 'pointer' && Number.isFinite(state.pointerY) ? state.pointerY : target.top;
      // The sheet may have a fixed title above its scrolling content. Keep
      // the ghost inside that content viewport even for an offscreen target.
      var minimumTop = 12, maximumTop = Math.max(12, view.innerHeight - height - 12);
      try {
        var bounds = typeof options.getScrollBounds === 'function' ? options.getScrollBounds() : null;
        if (bounds && Number.isFinite(bounds.top) && Number.isFinite(bounds.bottom) &&
            bounds.top >= 0 && bounds.bottom <= view.innerHeight && bounds.bottom > bounds.top) {
          minimumTop = Math.min(maximumTop, Math.max(12, bounds.top + 12));
        }
      } catch (_) { /* Overlay geometry does not change interaction authority. */ }
      var top = Math.max(minimumTop, Math.min(y - height - 16, maximumTop));
      state.ghost.style.transform = 'translate(' + left + 'px,' + top + 'px)';
      state.ghostRoute.textContent = state.fromPosition + ' → ' + (state.toIndex + 1);
    }
    function createGhost(state) {
      if (!document.body || typeof document.createElement !== 'function' || typeof state.row.querySelector !== 'function') return;
      try {
        var ghost = document.createElement('div'), number = document.createElement('span');
        var copy = document.createElement('span'), title = document.createElement('b'), detail = document.createElement('small');
        var route = document.createElement('span'), originalCopy = state.row.querySelector('.scope-copy');
        ghost.className = 'v50-order-drag-ghost'; ghost.setAttribute('aria-hidden', 'true');
        // Essential overlay geometry is inline so a delayed/missing stylesheet
        // cannot turn presentation feedback into a layout/scroll mutation.
        ghost.style.position = 'fixed'; ghost.style.left = '0'; ghost.style.top = '0';
        ghost.style.pointerEvents = 'none'; ghost.style.zIndex = '1012';
        ghost.setAttribute('data-order-ghost-id', state.id); ghost.setAttribute('data-order-ghost-input', state.input);
        number.className = 'v50-order-ghost-number'; number.textContent = String(state.fromPosition);
        if (state.slots) ghost.setAttribute('data-order-ghost-slots', 'true');
        copy.className = 'v50-order-ghost-copy';
        title.textContent = originalCopy?.querySelector('.scope-option-title')?.textContent || originalCopy?.querySelector('b')?.textContent || state.id;
        detail.textContent = originalCopy?.querySelector('small')?.textContent || '';
        copy.appendChild(title); copy.appendChild(detail);
        route.className = 'v50-order-ghost-route';
        var badge = state.row.querySelector('.order-number');
        state.colour = view?.getComputedStyle ? view.getComputedStyle(badge || state.row).getPropertyValue('--identify-colour').trim() : '';
        if (state.colour) ghost.style.setProperty('--order-drag-colour', state.colour);
        if (!state.slots) ghost.appendChild(number);
        ghost.appendChild(copy); ghost.appendChild(route);
        state.ghost = ghost; state.ghostRoute = route; document.body.appendChild(ghost);
        positionGhost(state);
      } catch (_) { if (state.ghost) state.ghost.remove(); state.ghost = null; }
    }
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
      var state = active, delta = scrollDelta(state.pointerY), before = scrollTop();
      if (active !== state || !valid() || !delta || !Number.isFinite(before)) return;
      // Viewport only, one bounded scroll per frame. No flush, navigation or model mutation.
      try { scrollBy(delta); } catch (_) { return; }
      if (active !== state || !valid()) return;
      point({ clientY: state.pointerY }); // Rows have moved even when the captured pointer has not.
      if (active === state && scrollTop() !== before) queueScroll(); // Stop at a saturated viewport.
    }
    function clean(state) {
      stopScroll();
      state.handle.removeAttribute('aria-grabbed');
      state.row.removeAttribute('data-order-grabbed');
      state.rows.forEach(function (row) {
        row.removeAttribute('data-order-drop'); row.removeAttribute('data-order-drop-index'); row.removeAttribute('data-order-drop-position');
        row.removeAttribute('data-order-preview');
        if (state.slots) { row.style.removeProperty('--order-preview-y'); row.style.removeProperty('--order-preview-clip'); }
      });
      if (state.slots) state.slots.forEach(function (slot) {
        slot.removeAttribute('data-order-drop'); slot.removeAttribute('data-order-drop-index'); slot.removeAttribute('data-order-drop-position');
        slot.removeAttribute('data-order-slot-target');
      });
      if (state.ghost) { state.ghost.remove(); state.ghost = null; }
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
      emitFeedback(commit && state.toIndex !== state.fromIndex ? 'drop' : 'cancel', state);
      try {
        if (commit && state.toIndex !== state.fromIndex) {
          dropped = true;
          var result = options.onDrop({ id: state.id, toIndex: state.toIndex });
          // Report failure only, never retry or label persistence as confirmed.
          if (result && typeof result.then === 'function') Promise.resolve(result).catch(function () {
            announce(message('orderDragUnconfirmed'));
          });
        }
      } catch (_) { failed = true; }
      finally { try { notify(false, state); } catch (_) {} }
      announce(message(failed ? 'orderDragUnconfirmed' : commit ?
        (dropped ? 'orderDragSubmitted' : 'orderDragUnchanged') : 'orderDragCancelled'));
    }
    function valid() {
      if (!active) return false;
      try {
        var fresh = items();
        if (!contains(active.handle) || !contains(active.row) ||
            fresh.length !== active.ids.length || fresh.some(function (id, i) { return id !== active.ids[i]; }) ||
            rows(fresh).some(function (row, i) { return row !== active.rows[i]; })) throw new Error('ORDER_CHANGED');
        if (active.slots && slots(fresh).some(function (slot, i) { return slot !== active.slots[i]; })) throw new Error('ORDER_SLOTS_CHANGED');
        return true;
      } catch (_) { finish(false); return false; }
    }
    function begin(handle, input, pointerId) {
      if (destroyed || active || handle.disabled || handle.getAttribute('aria-disabled') === 'true') return false;
      try {
        var ids = items(), row = handle.closest('[data-order-item]'), allRows = rows(ids);
        var id = options.getRowId(row), index = ids.indexOf(id);
        if (index < 0 || !contains(row)) return false;
        var allSlots = slots(ids), originalPosition = Number(row.dataset && row.dataset.orderPosition);
        active = { handle: handle, row: row, rows: allRows, slots: allSlots, id: id, ids: ids,
          fromIndex: index, fromPosition: Number.isInteger(originalPosition) && originalPosition > 0 ? originalPosition : index + 1,
          toIndex: index, input: input, pointerId: pointerId, pointerY: null };
        allRows.forEach(function (item) { item.removeAttribute('data-order-settled'); });
        captureLayout(active);
        handle.setAttribute('aria-grabbed', 'true'); row.setAttribute('data-order-grabbed', 'true');
        if (typeof handle.focus === 'function') handle.focus({ preventScroll: true });
        if (pointerId !== null) handle.setPointerCapture(pointerId);
        notify(true, active);
        if (!valid()) return false; // caller may change the scope in onInteraction.
        var state = active; createGhost(state); emitFeedback('start', state);
        if (!valid()) return false; // Feedback may close its own presentation.
        announce(message('orderDragPicked', { position: index + 1, count: ids.length }));
        return true;
      } catch (_) { finish(false); return false; }
    }
    function mark(row, edge, index) {
      var state = active, changed = state.toIndex !== index;
      (state.slots || state.rows).forEach(function (item) {
        item.removeAttribute('data-order-drop'); item.removeAttribute('data-order-drop-index'); item.removeAttribute('data-order-drop-position');
        if (state.slots) item.removeAttribute('data-order-slot-target');
      });
      state.toIndex = index;
      if (state.slots) { row = state.slots[index]; row.setAttribute('data-order-slot-target', 'true'); }
      row.setAttribute('data-order-drop', edge);
      row.setAttribute('data-order-drop-index', String(index));
      row.setAttribute('data-order-drop-position', String(index + 1));
      if (changed) previewCards(state);
      positionGhost(state); if (changed) emitFeedback('update', state);
      if (changed && active === state) announce(message('orderDragPosition', { position: index + 1, count: state.ids.length }));
    }
    function point(event) {
      if (!valid() || !Number.isFinite(event.clientY)) return;
      var nearest, distance = Infinity;
      (active.slots || active.rows).forEach(function (row, index) {
        var box = row.getBoundingClientRect(), middle = box.top + box.height / 2;
        if (!Number.isFinite(middle) || box.height <= 0) return;
        var next = Math.abs(event.clientY - middle);
        if (next < distance) { distance = next; nearest = { row: row, index: index, middle: middle }; }
      });
      if (!nearest) { finish(false); return; }
      var edge = event.clientY < nearest.middle ? 'before' : 'after';
      if (active.slots) { mark(nearest.row, edge, nearest.index); return; }
      var boundary = nearest.index + (edge === 'after' ? 1 : 0);
      var to = boundary > active.fromIndex ? boundary - 1 : boundary;
      mark(nearest.row, edge, Math.max(0, Math.min(active.ids.length - 1, to)));
    }
    function pointerDown(event) {
      var handle = handleOf(event.target);
      if (!handle || event.button !== 0 || event.isPrimary === false) return;
      if (begin(handle, 'pointer', event.pointerId) && active) {
        event.preventDefault(); active.pointerY = event.clientY; positionGhost(active); queueScroll();
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
