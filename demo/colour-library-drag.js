/* Pointer and keyboard ordering for Mijn kleuren. This module only reports
 * positions: storage and lighting state remain owned by the caller. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LightningColourLibraryDrag = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const ITEM = '.saved-colour-item[data-colour-id]';
  const GRID = '.saved-colour-grid.is-ordering';
  const SOURCE = '.colour-drag-handle, [data-action="swatch"]';

  function center(rect) {
    return {x:rect.left + rect.width / 2,y:rect.top + rect.height / 2};
  }
  function targetIndex(point, rects) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || !Array.isArray(rects)) return -1;
    let nearest = -1, distance = Infinity;
    rects.forEach((rect, index) => {
      if (!rect || ![rect.left,rect.top,rect.width,rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) return;
      const next = center(rect), delta = (point.x - next.x) ** 2 + (point.y - next.y) ** 2;
      if (delta < distance) { nearest = index; distance = delta; }
    });
    return nearest;
  }

  function install(options) {
    const doc = options && options.document, onMove = options && options.onMove;
    if (!doc || typeof doc.addEventListener !== 'function' || typeof onMove !== 'function') throw new TypeError('A document and onMove callback are required.');
    let active = null, suppressClick = null;
    const listeners = [];
    const items = grid => Array.from(grid.querySelectorAll(ITEM)).filter(item => item.closest(GRID) === grid);
    const valid = state => state.grid.isConnected && state.grid.matches(GRID) && state.item.isConnected && state.item.closest(GRID) === state.grid;
    function sourceFor(target) {
      const source = target && typeof target.closest === 'function' ? target.closest(SOURCE) : null;
      if (!source || source.disabled) return null;
      const item = source.closest(ITEM), grid = source.closest(GRID);
      if (!item || !grid || item.closest(GRID) !== grid || !item.dataset.colourId) return null;
      return {source,item,grid};
    }
    function highlight(state) {
      const list = items(state.grid);
      list.forEach((item, index) => {
        item.classList.toggle('colour-drag-source', item === state.item);
        item.classList.toggle('colour-drag-target', index === state.toIndex);
      });
      state.handle?.setAttribute('aria-pressed','true');
    }
    function clear(state) {
      state.grid.querySelectorAll(ITEM).forEach(item => item.classList.remove('colour-drag-source','colour-drag-target'));
      state.item.classList.remove('colour-drag-source','colour-drag-target');
      state.ghost?.remove();
      if (state.handle) {
        if (state.pressed === null) state.handle.removeAttribute('aria-pressed');
        else state.handle.setAttribute('aria-pressed',state.pressed);
      }
    }
    function moveGhost(state,event) {
      if (!doc.createElement) return;
      if (!state.ghost) {
        const swatch=state.item.querySelector('[data-action="swatch"]'),ghost=doc.createElement('div'),dot=doc.createElement('i'),label=doc.createElement('span');
        ghost.className='colour-drag-ghost';ghost.setAttribute('aria-hidden','true');ghost.style.pointerEvents='none';
        dot.style.background=swatch?.style.getPropertyValue('--swatch') || 'currentColor';
        label.textContent=swatch?.getAttribute('aria-label') || state.id;
        ghost.append(dot,label);(state.source.closest('dialog') || doc.body).append(ghost);state.ghost=ghost;
      }
      state.ghost.style.left=event.clientX-45+'px';state.ghost.style.top=event.clientY-76+'px';
    }
    function focusHandle(state) {
      const scope = state.scope?.isConnected ? state.scope : doc;
      const handle = Array.from(scope.querySelectorAll('[data-colour-drag]')).find(node => node.dataset.colourDrag === state.id);
      handle?.focus({preventScroll:true});
    }
    function finish(cancel) {
      const state = active;if (!state) return;
      active = null;
      const commit = !cancel && state.dragging && valid(state) && state.toIndex >= 0 && state.toIndex < items(state.grid).length;
      clear(state);
      if (state.kind === 'pointer') {
        if (state.dragging) suppressClick = {id:state.id,source:state.source,grid:state.grid,until:Date.now()+800};
        try { if (state.source.hasPointerCapture?.(state.pointerId)) state.source.releasePointerCapture(state.pointerId); } catch (_) { /* The source may have been detached. */ }
      }
      if (commit && state.toIndex !== state.fromIndex) onMove({id:state.id,toIndex:state.toIndex,source:state.source});
      if (commit || state.kind === 'keyboard') focusHandle(state);
    }
    function begin(found, kind) {
      const list = items(found.grid), fromIndex = list.indexOf(found.item);
      if (fromIndex < 0) return null;
      const handle = found.item.querySelector('[data-colour-drag]');
      return {...found,kind,id:found.item.dataset.colourId,fromIndex,toIndex:fromIndex,dragging:kind === 'keyboard',
        scope:found.source.closest('[data-colour-picker]') || found.grid.parentElement,handle,pressed:handle?.getAttribute('aria-pressed') ?? null};
    }
    function pointerDown(event) {
      // A fresh press is a new intention. The generated click after a drag has
      // no pointerdown of its own, so it remains the only click to suppress.
      if (event.button === 0 && event.isPrimary !== false) suppressClick = null;
      if (active || event.button !== 0 || event.isPrimary === false) return;
      const found = sourceFor(event.target);if (!found) return;
      active = begin(found,'pointer');if (!active) return;
      Object.assign(active,{pointerId:event.pointerId,x:event.clientX,y:event.clientY});
      try { active.source.setPointerCapture?.(event.pointerId); } catch (_) { /* Document listeners still track this pointer. */ }
    }
    function pointerMove(event) {
      if (!active || active.kind !== 'pointer' || active.pointerId !== event.pointerId) return;
      if (!valid(active)) return finish(true);
      if (!active.dragging && Math.hypot(event.clientX-active.x,event.clientY-active.y) < 6) return;
      active.dragging = true;event.preventDefault();
      active.toIndex = targetIndex({x:event.clientX,y:event.clientY},items(active.grid).map(item => item.getBoundingClientRect()));
      highlight(active);moveGhost(active,event);
    }
    function pointerEnd(event, cancel) {
      if (!active || active.kind !== 'pointer' || active.pointerId !== event.pointerId) return;
      if (active.dragging && !cancel) { pointerMove(event);event.preventDefault(); }
      finish(cancel);
    }
    function keyboardIndex(state, key) {
      const list = items(state.grid), index = state.toIndex;
      if (key === 'ArrowLeft') return Math.max(0,index-1);
      if (key === 'ArrowRight') return Math.min(list.length-1,index+1);
      if (key === 'Home') return 0;
      if (key === 'End') return list.length-1;
      const rects = list.map(item => item.getBoundingClientRect()), origin = center(rects[index]);
      let next = index, distance = Infinity;
      rects.forEach((rect, candidate) => {
        const point = center(rect), dy = point.y-origin.y;
        if (key === 'ArrowUp' ? dy >= -1 : dy <= 1) return;
        const delta = (point.x-origin.x) ** 2 + dy ** 2;
        if (delta < distance) { next = candidate;distance = delta; }
      });
      return next;
    }
    function keyDown(event) {
      const found = sourceFor(event.target);
      if (!found || !found.source.matches('.colour-drag-handle')) return;
      const pick = event.key === ' ' || event.key === 'Enter';
      if (!active) {
        if (!pick || event.repeat) return;
        event.preventDefault();event.stopPropagation();active = begin(found,'keyboard');if (active) highlight(active);return;
      }
      if (active.kind !== 'keyboard' || active.source !== found.source) return;
      if (!valid(active)) return finish(true);
      if (pick || event.key === 'Escape' || ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) {
        event.preventDefault();event.stopPropagation();
        if (pick) { if (!event.repeat) finish(false); }
        else if (event.key === 'Escape') finish(true);
        else { active.toIndex = keyboardIndex(active,event.key);highlight(active); }
      }
    }
    function click(event) {
      if (!suppressClick) return;
      if (Date.now() > suppressClick.until) { suppressClick = null;return; }
      const target = event.target, item = target?.closest?.(ITEM);
      if (event.detail !== 0 && (target === suppressClick.source || item?.dataset.colourId === suppressClick.id || target?.closest?.(GRID) === suppressClick.grid)) {
        event.preventDefault();event.stopImmediatePropagation();suppressClick = null;
      }
    }
    function listen(type, handler, options) { doc.addEventListener(type,handler,options);listeners.push([type,handler,options]); }
    listen('pointerdown',pointerDown);
    listen('pointermove',pointerMove,{passive:false});
    listen('pointerup',event => pointerEnd(event,false));
    listen('pointercancel',event => pointerEnd(event,true));
    listen('lostpointercapture',event => pointerEnd(event,true));
    listen('keydown',keyDown,true);
    listen('click',click,true);
    listen('dragstart',event => { if (sourceFor(event.target)) event.preventDefault(); });
    listen('focusin',event => { if (active?.kind === 'keyboard' && event.target !== active.source) finish(true); });
    return function cleanup() {
      finish(true);suppressClick = null;
      listeners.forEach(([type,handler,options]) => doc.removeEventListener(type,handler,options));
    };
  }
  return Object.freeze({targetIndex,install});
}));
