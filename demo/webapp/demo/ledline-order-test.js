(function(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LightningLedlineOrderTest = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  const MAX_LINES = 128, MAX_RUN_MS = 300000, MAX_BLINK_MS = 5000;
  const HOLD_MS = 1200, TTL_GUARD_MS = 50;
  const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
  function error(code) { const value = new Error(code); value.code = code; return value; }
  function validId(value) { return typeof value === 'string' && ID.test(value); }
  function context(value) {
    if (!value || !validId(value.session) || !validId(value.standId) || !validId(value.zoneId) ||
        typeof value.ready !== 'boolean' || typeof value.preview !== 'boolean' ||
        !Array.isArray(value.lineIds) || !value.lineIds.length || value.lineIds.length > MAX_LINES) return null;
    const ids = [];
    for (let index = 0; index < value.lineIds.length; index++) {
      if (!Object.prototype.hasOwnProperty.call(value.lineIds, index) || !validId(value.lineIds[index])) return null;
      ids.push(value.lineIds[index]);
    }
    if (new Set(ids).size !== ids.length) return null;
    return Object.freeze({ session: value.session, standId: value.standId, zoneId: value.zoneId,
      lineIds: Object.freeze(ids), ready: value.ready, preview: value.preview,
      signature: JSON.stringify([value.session, value.standId, value.zoneId, ids, value.preview]) });
  }
  function receipt(value, ctx, lineId, enabled) {
    try {
      if (value === null || typeof value !== 'object' || Array.isArray(value) ||
          ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
      const fields = ['confirmed', 'session', 'lineId', 'enabled', 'ttlMs'], descriptors = Object.getOwnPropertyDescriptors(value);
      if (Reflect.ownKeys(descriptors).length !== fields.length || !fields.every(key => descriptors[key] && Object.prototype.hasOwnProperty.call(descriptors[key], 'value'))) return null;
      const reply = Object.fromEntries(fields.map(key => [key, descriptors[key].value]));
      return reply.confirmed === true && reply.session === ctx.session && reply.lineId === lineId && reply.enabled === enabled &&
        Number.isInteger(reply.ttlMs) && (enabled ? reply.ttlMs >= 1 && reply.ttlMs <= MAX_BLINK_MS : reply.ttlMs === 0) ? Object.freeze(reply) : null;
    } catch (_) { return null; }
  }
  // This module owns no DOM, transport, persistence or normal playback state.
  // ready=true is supplied ONLY for the adapter's exact active, physically
  // confirmed identification lease. Preview is a separate visual-only mode.
  // clock is monotonic milliseconds; timers must schedule asynchronously.
  function create({ clock, setTimer, clearTimer, getContext, blink, onState } = {}) {
    if ([clock, setTimer, clearTimer, getContext, blink, onState].some(fn => typeof fn !== 'function')) throw error('ORDER_TEST_DEPENDENCIES');
    let lastNow = -Infinity, active = null, shown = null, flight = null, cleanup = null;

    function now() {
      const value = clock();
      if (!Number.isFinite(value) || value < 0 || value < lastNow) throw error('ORDER_TEST_CLOCK');
      lastNow = value; return value;
    }
    function current() { try { return context(getContext()); } catch (_) { return null; } }
    function same(ctx) { return current()?.signature === ctx.signature; }
    function state() {
      const run = shown;
      return { status: run?.status || 'idle', session: run?.ctx.session || null, zoneId: run?.ctx.zoneId || null,
        index: run?.index || 0, count: run?.ctx.lineIds.length || 0, lineId: run?.lineId || null,
        preview: run?.ctx.preview === true, error: run?.error || null,
        busy: !!active || !!flight || !!cleanup, cleanupUnconfirmed: !!cleanup };
    }
    function emit() { try { onState(Object.freeze(state())); } catch (_) {} }
    function clear(holder, key) {
      const timer = holder[key]; holder[key] = null;
      if (timer !== null) try { clearTimer(timer); } catch (_) {}
    }
    function cancelTimers(run) {
      clear(run, 'deadlineTimer');
      for (const wait of Array.from(run.waits)) {
        clear(wait, 'timer'); run.waits.delete(wait); wait.resolve({ cancelled: true });
      }
    }
    function settle(run) {
      if (!run.settled) { run.settled = true; run.resolve(Object.freeze(state())); }
    }
    function finalizeCleanup(record) {
      if (cleanup !== record) return;
      clear(record, 'timer'); cleanup = null;
      if (shown === record.run && record.run.status === 'stopping') record.run.status = record.run.terminal;
      if (shown === record.run) { emit(); settle(record.run); }
    }
    function refreshCleanup(time) {
      if (cleanup && (!same(cleanup.ctx) || time >= cleanup.expiresAt)) finalizeCleanup(cleanup);
    }
    function cleanupFailure(record, code) {
      if (cleanup !== record) return;
      if (shown === record.run) {
        record.run.status = 'failed'; record.run.error = code; emit(); settle(record.run);
      }
    }
    function armCleanup(record, time) {
      if (cleanup !== record || record.timer !== null) return;
      try {
        record.timer = setTimer(() => {
          record.timer = null;
          if (cleanup !== record) return;
          try { refreshCleanup(now()); if (cleanup === record) armCleanup(record, lastNow); }
          catch (_) { cleanupFailure(record, 'ORDER_TEST_CLOCK'); }
        }, Math.max(1, Math.ceil(record.expiresAt - time)));
      } catch (_) { cleanupFailure(record, 'ORDER_TEST_TIMER'); }
    }
    function beginCleanup(record) {
      if (cleanup !== record) return;
      let time;
      try { time = now(); } catch (_) { cleanupFailure(record, 'ORDER_TEST_CLOCK'); return; }
      refreshCleanup(time);
      if (cleanup !== record) return;
      armCleanup(record, time);
      if (cleanup !== record || flight || record.attempting) return;
      record.attempting = true;
      const operation = { run: record.run, record, enabled: false };
      flight = operation;
      const payload = Object.freeze({ session: record.ctx.session, lineId: record.lineId, enabled: false });
      Promise.resolve().then(() => {
        // A queued cleanup can be invalidated before the adapter is entered.
        if (cleanup !== record || !same(record.ctx)) return null;
        return blink(payload);
      }).then(reply => {
        if (flight === operation) flight = null;
        record.attempting = false;
        if (cleanup !== record) { emit(); return; }
        let at;
        try { at = now(); } catch (_) { cleanupFailure(record, 'ORDER_TEST_CLOCK'); return; }
        refreshCleanup(at);
        if (cleanup !== record) return;
        if (receipt(reply, record.ctx, record.lineId, false)) finalizeCleanup(record);
        else cleanupFailure(record, 'ORDER_TEST_CLEANUP_UNCONFIRMED');
      }, () => {
        if (flight === operation) flight = null;
        record.attempting = false;
        if (cleanup === record) cleanupFailure(record, 'ORDER_TEST_CLEANUP_UNCONFIRMED');
        else emit();
      });
    }
    function finish(run, terminal, code = null) {
      if (run.ended) return;
      run.ended = true; run.terminal = terminal; run.error = code;
      cancelTimers(run); if (active === run) active = null;
      const record = run.record;
      let time = lastNow;
      try { time = now(); } catch (_) { terminal = 'failed'; run.terminal = terminal; run.error = 'ORDER_TEST_CLOCK'; }
      if (record && record.issued && !run.ctx.preview && same(run.ctx) && time < record.expiresAt) {
        cleanup = record;
        run.status = terminal === 'cancelled' ? 'stopping' : terminal;
        emit();
        if (terminal === 'failed') settle(run);
        beginCleanup(record);
      } else {
        run.status = terminal; emit(); settle(run);
      }
    }
    function verify(run) {
      const time = now(), ctx = current();
      if (active !== run || run.ended) throw error('ORDER_TEST_CANCELLED');
      if (!ctx || ctx.signature !== run.ctx.signature) throw error('ORDER_TEST_CONTEXT_CHANGED');
      if (!run.ctx.preview && !ctx.ready) throw error('ORDER_TEST_NOT_READY');
      if (time >= run.deadline) throw error('ORDER_TEST_DEADLINE');
      return time;
    }
    function wait(run, delay, operation) {
      return new Promise(resolve => {
        if (run.ended) { resolve({ cancelled: true }); return; }
        const item = { timer: null, resolve };
        run.waits.add(item);
        try {
          item.timer = setTimer(() => {
            item.timer = null; run.waits.delete(item); resolve({ timeout: true });
          }, Math.max(1, Math.ceil(delay)));
        } catch (_) { run.waits.delete(item); resolve({ timerFailed: true }); }
        if (operation) operation.then(reply => {
          if (!run.waits.has(item)) return;
          clear(item, 'timer'); run.waits.delete(item); resolve({ reply });
        }, () => {
          if (!run.waits.has(item)) return;
          clear(item, 'timer'); run.waits.delete(item); resolve({ rejected: true });
        });
      });
    }
    async function send(run, enabled) {
      const sentAt = verify(run);
      if (flight) throw error('ORDER_TEST_BUSY');
      const record = enabled ? { run, ctx: run.ctx, lineId: run.lineId, sentAt,
        expiresAt: sentAt + MAX_BLINK_MS, timer: null, attempting: false, issued: false } : run.record;
      if (enabled) run.record = record;
      const operation = { run, record, enabled };
      flight = operation;
      const payload = Object.freeze({ session: run.ctx.session, lineId: run.lineId, enabled });
      const job = Promise.resolve().then(() => {
        verify(run); if (enabled) record.issued = true; return blink(payload);
      });
      const settled = job.then(reply => {
        if (flight === operation) flight = null;
        if (run.ended) {
          if (cleanup === record) {
            // Late ON evidence consumes TTL from the original send, never ACK time.
            const parsed = enabled ? receipt(reply, run.ctx, record.lineId, true) : null;
            if (parsed) {
              record.expiresAt = Math.min(record.expiresAt, sentAt + parsed.ttlMs);
              clear(record, 'timer');
            }
            if (!enabled && receipt(reply, run.ctx, record.lineId, false)) finalizeCleanup(record);
            else beginCleanup(record);
          } else emit();
        }
        return reply;
      }, () => {
        if (flight === operation) flight = null;
        if (run.ended && cleanup === record) beginCleanup(record); else if (run.ended) emit();
        throw error('ORDER_TEST_BLINK_FAILED');
      });
      const result = await wait(run, Math.min(MAX_BLINK_MS, run.deadline - sentAt), settled);
      if (run.ended || result.cancelled) throw error('ORDER_TEST_CANCELLED');
      if (result.timerFailed) throw error('ORDER_TEST_TIMER');
      const at = verify(run);
      if (result.timeout) throw error('ORDER_TEST_ACK_TIMEOUT');
      if (result.rejected) throw error('ORDER_TEST_BLINK_FAILED');
      const parsed = receipt(result.reply, run.ctx, run.lineId, enabled);
      if (!parsed) throw error('ORDER_TEST_BLINK_UNCONFIRMED');
      if (enabled) {
        record.expiresAt = sentAt + parsed.ttlMs;
        if (record.expiresAt <= at + TTL_GUARD_MS) throw error('ORDER_TEST_BLINK_EXPIRED');
      } else run.record = null;
      return { at, record };
    }
    async function sequence(run) {
      try {
        for (let index = 0; index < run.ctx.lineIds.length; index++) {
          verify(run); run.index = index; run.lineId = run.ctx.lineIds[index];
          run.status = run.ctx.preview ? 'running' : 'preparing'; emit();
          let hold = HOLD_MS;
          if (!run.ctx.preview) {
            const sent = await send(run, true);
            hold = Math.min(HOLD_MS, Math.floor(sent.record.expiresAt - sent.at - TTL_GUARD_MS));
            run.status = 'running'; emit();
          }
          const waited = await wait(run, Math.min(hold, run.deadline - verify(run)));
          if (run.ended || waited.cancelled) return;
          if (waited.timerFailed) throw error('ORDER_TEST_TIMER');
          const at = verify(run);
          if (!run.ctx.preview && at >= run.record.expiresAt) throw error('ORDER_TEST_BLINK_EXPIRED');
          if (!run.ctx.preview) await send(run, false);
        }
        verify(run); run.index = run.ctx.lineIds.length; run.lineId = null; finish(run, 'complete');
      } catch (cause) {
        if (run.ended) return;
        const code = ['ORDER_TEST_CLOCK', 'ORDER_TEST_CONTEXT_CHANGED', 'ORDER_TEST_NOT_READY', 'ORDER_TEST_DEADLINE',
          'ORDER_TEST_BUSY', 'ORDER_TEST_TIMER', 'ORDER_TEST_ACK_TIMEOUT', 'ORDER_TEST_BLINK_FAILED',
          'ORDER_TEST_BLINK_UNCONFIRMED', 'ORDER_TEST_BLINK_EXPIRED'].includes(cause?.code) ? cause.code : 'ORDER_TEST_BLINK_FAILED';
        finish(run, code === 'ORDER_TEST_CONTEXT_CHANGED' ? 'cancelled' : 'failed', code);
      }
    }
    function getState() {
      try {
        const time = now(); refreshCleanup(time);
        if (active) {
          const ctx = current();
          if (!ctx || ctx.signature !== active.ctx.signature) finish(active, 'cancelled', 'ORDER_TEST_CONTEXT_CHANGED');
          else if (!active.ctx.preview && !ctx.ready) finish(active, 'failed', 'ORDER_TEST_NOT_READY');
          else if (time >= active.deadline) finish(active, 'failed', 'ORDER_TEST_DEADLINE');
        }
      } catch (_) { if (active) finish(active, 'failed', 'ORDER_TEST_CLOCK'); }
      return Object.freeze(state());
    }
    function start() {
      const time = now(); refreshCleanup(time);
      if (active || flight) throw error('ORDER_TEST_BUSY');
      if (cleanup) throw error('ORDER_TEST_CLEANUP_PENDING');
      const ctx = current();
      if (!ctx) throw error('ORDER_TEST_CONTEXT');
      if (!ctx.preview && !ctx.ready) throw error('ORDER_TEST_NOT_READY');
      let resolve;
      const done = new Promise(value => { resolve = value; });
      const run = { ctx, index: 0, lineId: null, status: 'preparing', error: null, deadline: time + MAX_RUN_MS,
        ended: false, settled: false, record: null, deadlineTimer: null, waits: new Set(), resolve, done };
      active = shown = run; emit();
      if (run.ended) return done;
      try {
        run.deadlineTimer = setTimer(() => {
          run.deadlineTimer = null;
          if (active !== run || run.ended) return;
          try { if (now() < run.deadline) throw error('ORDER_TEST_TIMER'); finish(run, 'failed', 'ORDER_TEST_DEADLINE'); }
          catch (cause) { finish(run, 'failed', cause?.code === 'ORDER_TEST_TIMER' ? cause.code : 'ORDER_TEST_CLOCK'); }
        }, MAX_RUN_MS);
      } catch (_) { finish(run, 'failed', 'ORDER_TEST_TIMER'); }
      if (!run.ended) void sequence(run);
      return done;
    }
    function stop() {
      if (active) finish(active, 'cancelled');
      else if (cleanup) beginCleanup(cleanup);
      return shown?.done || Promise.resolve(getState());
    }
    function contextChanged() {
      if (active) finish(active, 'cancelled', 'ORDER_TEST_CONTEXT_CHANGED');
      try { refreshCleanup(now()); } catch (_) { if (cleanup) cleanupFailure(cleanup, 'ORDER_TEST_CLOCK'); }
      return getState();
    }
    // stop() may be called again to retry only the same scoped cleanup. No API
    // mutates the installation or declares that its physical order is correct.
    return Object.freeze({ start, stop, contextChanged, getState, retryCleanup: stop });
  }
  return Object.freeze({ create, MAX_LINES, MAX_RUN_MS, HOLD_MS, TTL_GUARD_MS });
}));
