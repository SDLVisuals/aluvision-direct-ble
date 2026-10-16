(function(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LightningLedlineOrderFocus = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  const MAX_LINES = 128, MAX_TTL_MS = 5000, RENEW_MS = 3750, GUARD_MS = 50;
  const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
  const validId = value => typeof value === 'string' && ID.test(value);
  const fail = code => Object.assign(new Error(code), { code });
  function fields(value, names) {
    try {
      if (!value || typeof value !== 'object' || Array.isArray(value) ||
          ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
      const own = Object.getOwnPropertyDescriptors(value);
      if (Reflect.ownKeys(own).length !== names.length || !names.every(key => own[key] && 'value' in own[key])) return null;
      return Object.fromEntries(names.map(key => [key, own[key].value]));
    } catch (_) { return null; }
  }
  function context(value) {
    try {
    const ctx = fields(value, ['session', 'standId', 'zoneId', 'lineIds', 'visible', 'ready', 'previewOnly']);
    if (!ctx || !validId(ctx.session) || !validId(ctx.standId) || !validId(ctx.zoneId) ||
        ['visible', 'ready', 'previewOnly'].some(key => typeof ctx[key] !== 'boolean') ||
        !Array.isArray(ctx.lineIds) || !ctx.lineIds.length || ctx.lineIds.length > MAX_LINES) return null;
    const ids = [];
    for (let index = 0; index < ctx.lineIds.length; index++) {
      const item = Object.getOwnPropertyDescriptor(ctx.lineIds, index);
      if (!item || !('value' in item) || !validId(item.value)) return null;
      ids.push(item.value);
    }
    if (new Set(ids).size !== ids.length) return null;
    return Object.freeze({ ...ctx, lineIds: Object.freeze(ids),
      scope: JSON.stringify([ctx.session, ctx.standId, ctx.zoneId, ctx.previewOnly]) });
    } catch (_) { return null; }
  }
  function receipt(value, record, enabled, at, sentAt) {
    const reply = fields(value, ['confirmed', 'session', 'lineId', 'enabled', 'ttlMs']);
    return reply && reply.confirmed === true && reply.session === record.ctx.session &&
      reply.lineId === record.lineId && reply.enabled === enabled && Number.isInteger(reply.ttlMs) &&
      (enabled ? reply.ttlMs >= 1 && reply.ttlMs <= MAX_TTL_MS && sentAt + reply.ttlMs > at + GUARD_MS : reply.ttlMs === 0) ? reply : null;
  }

  // A place is selected, never a cached physical line ID. After a swap update()
  // supplies the committed place -> endpoint mapping. The old endpoint is
  // stopped and confirmed before another one may blink. This is the existing
  // finite recognition blink; it does not claim a new smooth firmware pulse.
  function create({ sendBlink, clock, setTimer, clearTimer, onState, onUncertain } = {}) {
    if ([sendBlink, clock, setTimer, clearTimer, onState, onUncertain].some(fn => typeof fn !== 'function'))
      throw fail('ORDER_FOCUS_DEPENDENCIES');
    let ctx = null, selected = null, paused = false, fault = null, holder = null;
    let timer = null, transport = null, pump = null, epoch = 0, revision = 0, renew = false, lastNow = -Infinity;
    let retiredBlock = false;

    function now() {
      const value = clock();
      if (!Number.isFinite(value) || value < 0 || value < lastNow) throw fail('ORDER_FOCUS_CLOCK');
      lastNow = value; return value;
    }
    function target() {
      return ctx && ctx.visible && ctx.ready && selected !== null && selected < ctx.lineIds.length && !paused && !fault && !retiredBlock ?
        { ctx, lineId: ctx.lineIds[selected] } : null;
    }
    function matches(record, next) { return !!record && !!next && record.ctx.scope === next.ctx.scope && record.lineId === next.lineId; }
    function state() {
      const next = target(), confirmed = !transport && !fault && matches(holder, next) &&
        holder.confirmed && lastNow < holder.expiresAt;
      const status = fault ? 'failed' : transport ? transport.enabled ? 'pending' : 'stopping' :
        paused ? 'paused' : next?.ctx.previewOnly ? 'preview' : confirmed ? 'running' : next ? 'pending' : 'idle';
      return Object.freeze({ status, session: ctx?.session || null, standId: ctx?.standId || null, zoneId: ctx?.zoneId || null,
        selectedPosition: selected, lineId: next?.lineId || null, activeLineId: holder?.lineId || null,
        confirmed: !!confirmed, previewOnly: ctx?.previewOnly === true, busy: !!pump || !!transport,
        error: fault, validUntilMs: confirmed ? holder.expiresAt : null });
    }
    function emit() { try { onState(state()); } catch (_) {} }
    function cancelTimer() {
      const pending = timer; timer = null;
      if (pending !== null) try { clearTimer(pending); } catch (_) {}
    }
    function uncertain(code, record, enabled) {
      if (fault) return;
      fault = code; paused = true; renew = false; cancelTimer(); emit();
      if (record) try {
        onUncertain(Object.freeze({ session: record.ctx.session, standId: record.ctx.standId, zoneId: record.ctx.zoneId,
          lineId: record.lineId, enabled, error: code }));
      } catch (_) {}
    }
    function arm(record) {
      cancelTimer();
      if (!matches(record, target()) || fault || paused || transport) return;
      let at;
      try { at = now(); } catch (_) { uncertain('ORDER_FOCUS_CLOCK', record, true); return; }
      const token = epoch, rev = revision, remaining = record.expiresAt - at, renewAt = record.sentAt + RENEW_MS;
      // Never tighten the radio cadence to compensate for a short receiver TTL.
      // Short confirmations expire locally and stop; another user update is
      // needed to start again. A normal 5s blink renews once per 3.75s at most.
      const canRenew = record.expiresAt > renewAt + GUARD_MS;
      try {
        timer = setTimer(() => {
          timer = null;
          if (epoch !== token || revision !== rev || holder !== record || !matches(record, target())) return;
          let time;
          try { time = now(); } catch (_) { uncertain('ORDER_FOCUS_CLOCK', record, true); return; }
          if (canRenew && time < record.expiresAt - GUARD_MS) renew = true; else paused = true;
          revision++; void kick();
        }, Math.max(1, Math.ceil(canRenew ? renewAt - at : remaining)));
      } catch (_) { uncertain('ORDER_FOCUS_TIMER', record, true); }
    }
    async function send(record, enabled) {
      let sentAt;
      try { sentAt = now(); } catch (_) { uncertain('ORDER_FOCUS_CLOCK', record, enabled); return false; }
      if (transport) { uncertain('ORDER_FOCUS_BUSY', record, enabled); return false; }
      const operation = { enabled, record, epoch, sentAt, timeout: null };
      transport = operation;
      const payload = Object.freeze({ session: record.ctx.session, standId: record.ctx.standId,
        zoneId: record.ctx.zoneId, lineId: record.lineId, enabled });
      let finish;
      const result = new Promise(resolve => { finish = resolve; });
      try { operation.timeout = setTimer(() => finish({ timeout: true }), MAX_TTL_MS); }
      catch (_) { transport = null; uncertain('ORDER_FOCUS_TIMER', record, enabled); return false; }
      // Install the ownership token before entering any injected adapter.
      const job = Promise.resolve().then(() => {
        if (epoch !== operation.epoch) return { cancelled: true };
        return sendBlink(payload);
      });
      job.then(value => { if (transport === operation) transport = null; finish({ value }); },
        () => { if (transport === operation) transport = null; finish({ rejected: true }); });
      emit();
      const resultValue = await result;
      if (operation.timeout !== null) { try { clearTimer(operation.timeout); } catch (_) {} operation.timeout = null; }
      // External full-session cleanup owns this retired token. A late reply
      // never arms a timer, sends a guessed STOP, or resumes a new selection.
      if (epoch !== operation.epoch) return false;
      let at;
      try { at = now(); } catch (_) { uncertain('ORDER_FOCUS_CLOCK', record, enabled); return false; }
      const parsed = !resultValue.timeout && !resultValue.rejected && receipt(resultValue.value, record, enabled, at, sentAt);
      if (!parsed) {
        uncertain(resultValue.timeout ? 'ORDER_FOCUS_ACK_TIMEOUT' : 'ORDER_FOCUS_UNCONFIRMED', record, enabled);
        return false;
      }
      if (enabled) { record.confirmed = true; record.sentAt = sentAt; record.expiresAt = sentAt + parsed.ttlMs; }
      return true;
    }
    async function run() {
      while (!fault && !transport) {
        const next = target();
        if (holder && (!matches(holder, next) || next?.ctx.previewOnly)) {
          const old = holder;
          cancelTimer(); renew = false;
          if (!await send(old, false)) return;
          if (holder === old) holder = null;
          continue;
        }
        if (!next || next.ctx.previewOnly) { cancelTimer(); emit(); return; }
        if (!holder) holder = { ctx: next.ctx, lineId: next.lineId, confirmed: false, expiresAt: 0 };
        const record = holder;
        if (record.confirmed) {
          let time;
          try { time = now(); } catch (_) { uncertain('ORDER_FOCUS_CLOCK', record, true); return; }
          if (time >= record.expiresAt - GUARD_MS) { paused = true; renew = false; continue; }
        }
        if (!record.confirmed || renew) {
          renew = false; cancelTimer();
          if (!await send(record, true)) return;
          if (holder !== record) return;
          // A newer click, swap, pause or clear is observed before ANY next ON.
          if (!matches(record, target())) continue;
        }
        arm(record); emit(); return;
      }
    }
    function kick() {
      if (pump) return pump;
      if (transport) { emit(); return Promise.resolve(state()); }
      let observed = revision;
      pump = Promise.resolve().then(async () => {
        do { observed = revision; await run(); } while (!fault && !transport && observed !== revision);
      }).catch(() => uncertain('ORDER_FOCUS_INTERNAL', holder, true)).finally(() => { pump = null; emit(); });
      return pump.then(() => state());
    }
    function update(value) {
      const next = context(value);
      if (!next) {
        ctx = null; selected = null; paused = true; renew = false; revision++; cancelTimer();
        return kick();
      }
      if (!ctx || next.scope !== ctx.scope || !next.visible) selected = null;
      if (selected !== null && selected >= next.lineIds.length) selected = null;
      ctx = next; paused = false; renew = false; revision++; cancelTimer();
      if (!transport) retiredBlock = false;
      return kick();
    }
    function select(position) {
      if (!ctx || !ctx.visible || !Number.isInteger(position) || position < 0 || position >= ctx.lineIds.length)
        throw fail('ORDER_FOCUS_POSITION');
      selected = position; paused = false; revision++; renew = false; cancelTimer();
      if (!transport) retiredBlock = false;
      return kick();
    }
    function pause() {
      paused = true; revision++; renew = false; cancelTimer();
      return kick();
    }
    function clear(options = {}) {
      const parsed = fields(options, Object.keys(options));
      if (!parsed || Object.keys(parsed).some(key => key !== 'releaseExternal') ||
          'releaseExternal' in parsed && typeof parsed.releaseExternal !== 'boolean') throw fail('ORDER_FOCUS_CLEAR');
      ctx = null; selected = null; paused = false; revision++; renew = false; cancelTimer();
      if (parsed.releaseExternal === true) {
        retiredBlock = !!transport; epoch++; holder = null; fault = null;
      }
      return kick();
    }
    function getState() {
      try { now(); } catch (_) { uncertain('ORDER_FOCUS_CLOCK', holder, true); }
      return state();
    }
    return Object.freeze({ update, select, pause, clear, getState });
  }
  return Object.freeze({ create });
}));
