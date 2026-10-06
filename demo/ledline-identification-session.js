(function(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LightningLedlineIdentificationSession = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/;
  const MAX_LINES = 128;
  const PALETTE = [
    ['Blauw', [0, 112, 255]], ['Groen', [0, 200, 83]],
    ['Rood', [255, 48, 48]], ['Oranje', [255, 128, 0]],
    ['Geel', [255, 220, 0]], ['Paars', [157, 78, 221]],
    ['Cyaan', [0, 210, 220]], ['Magenta', [225, 0, 225]],
    ['Mint', [56, 230, 166]], ['Roze', [255, 100, 170]],
    ['Limoen', [151, 223, 0]], ['Wit', [240, 240, 240]]
  ];
  function fail(code) { const error = new Error(code); error.code = code; return error; }
  function plain(value) {
    return value !== null && typeof value === 'object' &&
      (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
  }
  function keys(value, allowed) {
    return plain(value) && Object.keys(value).every(key => allowed.includes(key));
  }
  function id(value) { return typeof value === 'string' && ID.test(value); }
  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function colour(index, used) {
    if (index < PALETTE.length) {
      const [colorName, rgb] = PALETTE[index];
      used.add(rgb.join(','));
      return { colorName, rgb: rgb.slice() };
    }
    // Extra lines still have unique fixed markers. Number and name remain essential:
    // many nearby hues cannot be distinguished by colour alone on physical LEDs.
    let hue = ((index - PALETTE.length) * 137.508 + 15) % 360;
    const saturation = index % 2 ? 0.72 : 1, value = index % 3 ? 1 : 0.82;
    let rgb;
    do {
      const c = value * saturation, x = c * (1 - Math.abs((hue / 60) % 2 - 1)), m = value - c;
      const sector = Math.floor(hue / 60);
      const v = [[c,x,0], [x,c,0], [0,c,x], [0,x,c], [x,0,c], [c,0,x]][sector];
      rgb = v.map(channel => Math.round((channel + m) * 255));
      hue = (hue + 1) % 360;
    } while (used.has(rgb.join(',')));
    used.add(rgb.join(','));
    const names = ['Rood', 'Oranje', 'Geel', 'Limoen', 'Groen', 'Mint', 'Cyaan', 'Blauw', 'Blauw', 'Paars', 'Magenta', 'Roze'];
    return { colorName: names[Math.floor(((hue + 359) % 360) / 30)] + ' ' + (index + 1), rgb };
  }
  function validateOpen(input) {
    if (!keys(input, ['standId', 'zoneId', 'lines']) || !id(input.standId) || !id(input.zoneId) ||
        !Array.isArray(input.lines) || input.lines.length < 1 || input.lines.length > MAX_LINES) throw fail('IDENTIFICATION_INPUT');
    for(let index=0;index<input.lines.length;index++)
      if(!Object.prototype.hasOwnProperty.call(input.lines,index))throw fail('IDENTIFICATION_LINES');
    const ids = new Set(), endpoints = new Set();
    return {
      standId: input.standId, zoneId: input.zoneId,
      lines: input.lines.map(line => {
        if (!keys(line, ['id', 'receiverId', 'port']) || !id(line.id) || !id(line.receiverId) ||
            !Number.isInteger(line.port) || line.port < 0 || line.port > 4 || ids.has(line.id) ||
            endpoints.has(line.receiverId + ':' + line.port)) throw fail('IDENTIFICATION_LINES');
        ids.add(line.id); endpoints.add(line.receiverId + ':' + line.port);
        return { id: line.id, receiverId: line.receiverId, port: line.port };
      })
    };
  }
  // clock must be monotonic milliseconds, and setTimer/clearTimer must behave like
  // asynchronous timeout scheduling. sendLease is a temporary full-line overlay,
  // not normal playback or persistence. Its adapter must clamp queued TTL again
  // at physical dispatch; hardware must expire the lease without this app running.
  function create({ clock, setTimer, clearTimer, sendLease, sendStop, sendBlink, onState, idFactory, idleMs = 30000 } = {}) {
    if ([clock, setTimer, clearTimer, sendLease, sendStop, onState, idFactory].some(fn => typeof fn !== 'function') ||
        sendBlink !== undefined && typeof sendBlink !== 'function' ||
        !Number.isInteger(idleMs) || idleMs < 1 || idleMs > 300000) throw fail('IDENTIFICATION_DEPENDENCIES');

    let active = null, timer = null, lastNow = -Infinity, closedReason = 'not-opened';
    const issued = new Set();
    function now() {
      const value = clock();
      if (!Number.isFinite(value) || value < 0 || value < lastNow) throw fail('IDENTIFICATION_CLOCK');
      lastNow = value;
      return value;
    }
    function snapshot(at = lastNow) {
      if (!active) return {
        active: false, session: null, standId: null, zoneId: null, lines: [],
        status: 'closed', reason: closedReason, previewOnly: false, physicalConfirmed: false,
        remainingMs: 0, expiresAtMs: null, confirmation: null, error: null
      };
      const c = active.confirmation;
      const physicalConfirmed = !!c && at < c.validUntilMs && at < active.deadline;
      return {
        active: true, session: active.session, standId: active.standId, zoneId: active.zoneId,
        lines: active.lines.map((line, index) => ({ ...copy(line), number: index + 1 })),
        status: physicalConfirmed ? 'confirmed' : (active.flight ? 'pending' : 'preview'),
        reason: null, previewOnly: !physicalConfirmed, physicalConfirmed,
        remainingMs: Math.max(0, Math.floor(active.deadline - at)), expiresAtMs: active.deadline,
        confirmation: physicalConfirmed ? copy(c) : null, error: active.error
      };
    }
    function emit(at) {
      // An observer is not part of the lease or cleanup authority.
      try { onState(snapshot(at)); } catch (_) {}
    }
    function clear() {
      const old = timer; timer = null;
      if (old !== null) try { clearTimer(old); } catch (_) {}
    }
    function stop(ctx) {
      // The adapter/hardware must apply STOP only to this exact active token.
      // A STOP reply is deliberately not proof that the previous animation resumed.
      const payload = { session: ctx.session, standId: ctx.standId, zoneId: ctx.zoneId, lineIds: ctx.lines.map(line => line.id) };
      try { return Promise.resolve(sendStop(copy(payload))).then(() => undefined, () => undefined); }
      catch (_) { return Promise.resolve(); }
    }
    function end(ctx, reason) {
      if (active !== ctx || ctx.closed) return Promise.resolve();
      ctx.closed = true; ctx.queued = false; ctx.confirmation = null;
      for (const blink of ctx.blinks.splice(0)) blink.reject(fail('IDENTIFICATION_BLINK_CANCELLED'));
      clear(); active = null; closedReason = reason;
      emit(lastNow);
      return stop(ctx);
    }
    function read(ctx) {
      try { return now(); }
      catch (_) { if (ctx && active === ctx) void end(ctx, 'clock-invalid'); return null; }
    }
    function arm(ctx, at) {
      if (active !== ctx || ctx.closed) return;
      clear();
      const until = ctx.confirmation ? Math.min(ctx.deadline, ctx.confirmation.validUntilMs) : ctx.deadline;
      try {
        timer = setTimer(() => {
          if (active !== ctx || ctx.closed) return;
          timer = null;
          const time = read(ctx);
          if (time === null) return;
          if (time >= ctx.deadline) { void end(ctx, 'idle'); return; }
          if (ctx.confirmation && time >= ctx.confirmation.validUntilMs) {
            ctx.confirmation = null; ctx.error = 'IDENTIFICATION_LEASE_EXPIRED'; emit(time);
          }
          arm(ctx, time);
        }, Math.max(1, Math.ceil(until - at)));
      } catch (_) { void end(ctx, 'timer-unavailable'); }
    }
    function validReceipt(reply, payload, at, sentAt) {
      if (!keys(reply, ['confirmed', 'session', 'lineIds', 'ttlMs']) || reply.confirmed !== true ||
          reply.session !== payload.session || !Array.isArray(reply.lineIds) ||
          reply.lineIds.length !== payload.lines.length || new Set(reply.lineIds).size !== reply.lineIds.length ||
          ![...reply.lineIds].every(lineId => payload.lines.some(line => line.id === lineId)) ||
          !Number.isInteger(reply.ttlMs) || reply.ttlMs <= 0 || reply.ttlMs > payload.ttlMs || reply.ttlMs > idleMs ||
          sentAt + reply.ttlMs <= at) return false;
      return true;
    }
    function request(ctx) {
      ctx.queued = true;
      if (ctx.flight) return ctx.flight.then(() => getState());
      const completedBlinks=[];
      // This microtask allows flight to be installed before an injected adapter is called.
      ctx.flight = Promise.resolve().then(async () => {
        while ((ctx.queued || ctx.blinks.length) && active === ctx && !ctx.closed) {
          if (!ctx.queued) {
            // The same flight owns TOUCH and blink. New real interaction may
            // queue a TOUCH, but can never create a second radio operation.
            const blink=ctx.blinks.shift();
            const sentAt=read(ctx);
            if(sentAt===null || active!==ctx || ctx.closed || sentAt>=ctx.deadline){
              blink.reject(fail('IDENTIFICATION_BLINK_CANCELLED'));
              if(active===ctx&&!ctx.closed)void end(ctx,'idle');
              break;
            }
            const payload={session:ctx.session,standId:ctx.standId,zoneId:ctx.zoneId,lineId:blink.lineId,enabled:blink.enabled};
            try {
              if(!ctx.lines.some(line=>line.id===blink.lineId))throw fail('IDENTIFICATION_BLINK_CANCELLED');
              const reply=await sendBlink(copy(payload));
              if(active!==ctx || ctx.closed){void stop(ctx);throw fail('IDENTIFICATION_BLINK_CANCELLED');}
              const time=read(ctx);
              if(time===null || active!==ctx || ctx.closed || time>=ctx.deadline){
                if(active===ctx&&!ctx.closed)void end(ctx,'idle');
                throw fail('IDENTIFICATION_BLINK_CANCELLED');
              }
              if(!keys(reply,['confirmed','session','lineId','enabled','ttlMs']) || reply.confirmed!==true ||
                 reply.session!==payload.session || reply.lineId!==payload.lineId || reply.enabled!==payload.enabled ||
                 !Number.isInteger(reply.ttlMs) || (payload.enabled ? reply.ttlMs<1 || reply.ttlMs>5000 ||
                   sentAt+reply.ttlMs<=time || sentAt+reply.ttlMs>ctx.deadline : reply.ttlMs!==0))throw fail('IDENTIFICATION_BLINK_UNCONFIRMED');
              completedBlinks.push(()=>blink.resolve(copy(reply)));
            } catch(error) {
              const code=['IDENTIFICATION_BLINK_CANCELLED','IDENTIFICATION_BLINK_UNCONFIRMED'].includes(error?.code)?error.code:'IDENTIFICATION_BLINK_FAILED';
              if(active===ctx&&!ctx.closed){ctx.error=code;emit(lastNow);}
              completedBlinks.push(()=>blink.reject(fail(code)));
            }
            continue;
          }
          ctx.queued = false;
          const sentAt = read(ctx);
          if (sentAt === null) break;
          const ttlMs = Math.min(idleMs, Math.floor(ctx.deadline - sentAt));
          if (ttlMs <= 0) { void end(ctx, 'idle'); break; }
          const revision = ctx.revision;
          const payload = { session: ctx.session, standId: ctx.standId, zoneId: ctx.zoneId, lines: copy(ctx.lines), ttlMs };
          emit(sentAt);
          let reply, rejected = false, rejectionCode = 'IDENTIFICATION_LEASE_FAILED';
          try { reply = await sendLease(copy(payload)); } catch (error) {
            rejected = true;
            // Expose only this closed capability hint, never transport text or
            // authority failures. It does not confirm a lease or any line.
            if (error?.code === 'IDENTIFY_UNSUPPORTED' ||
                error?.code === undefined && error?.message === 'IDENTIFY_UNSUPPORTED') rejectionCode = 'IDENTIFY_UNSUPPORTED';
          }
          if (active !== ctx || ctx.closed) {
            // A write may reach hardware after an earlier STOP. End that old token again;
            // never stop a newer token, restore saved state, or resurrect this overlay.
            void stop(ctx); break;
          }
          const time = read(ctx);
          if (time === null) { void stop(ctx); break; }
          if (time >= ctx.deadline) { void end(ctx, 'idle'); break; }
          if (revision !== ctx.revision) continue;
          if (!rejected && validReceipt(reply, payload, time, sentAt)) {
            ctx.confirmation = {
              session: ctx.session, lineIds: payload.lines.map(line => line.id), ttlMs: reply.ttlMs,
              validUntilMs: Math.min(ctx.deadline, sentAt + reply.ttlMs)
            };
            ctx.error = null;
          } else {
            ctx.confirmation = null;
            ctx.error = rejected ? rejectionCode : 'IDENTIFICATION_UNCONFIRMED';
          }
          emit(time); arm(ctx, time);
        }
      }).finally(() => {
        ctx.flight = null;
        if (active === ctx && !ctx.closed) emit(lastNow);
        // A consumer may immediately click again after its result. Publish
        // only after releasing the pump, never into a finishing old flight.
        for(const complete of completedBlinks)complete();
      });
      return ctx.flight.then(() => getState());
    }
    function getState() {
      const ctx = active, time = read(ctx);
      if (time === null) return snapshot(lastNow);
      if (ctx && time >= ctx.deadline) void end(ctx, 'idle');
      return snapshot(time);
    }
    function open(input) {
      const parsed = validateOpen(input);
      const time = read(active);
      if (time === null) throw fail('IDENTIFICATION_CLOCK');
      const session = idFactory();
      if (!id(session) || issued.has(session)) throw fail('IDENTIFICATION_SESSION');
      issued.add(session);
      if (active) void end(active, 'reopened');
      const used = new Set();
      const ctx = { ...parsed, session, lines: parsed.lines.map((line, i) => ({ ...line, ...colour(i, used) })),
        deadline: time + idleMs, confirmation: null, revision: 1, queued: false, blinks: [], flight: null, closed: false, error: null };
      active = ctx; emit(time); arm(ctx, time);
      if (active !== ctx) return Promise.resolve(getState());
      return request(ctx);
    }
    function interaction() {
      const ctx = active;
      if (!ctx) return Promise.resolve(getState());
      const time = read(ctx);
      if (time === null) return Promise.resolve(snapshot(lastNow));
      if (time >= ctx.deadline) { void end(ctx, 'idle'); return Promise.resolve(snapshot(time)); }
      ctx.deadline = time + idleMs; ctx.revision++; ctx.error = null;
      emit(time); arm(ctx, time);
      if (active !== ctx) return Promise.resolve(getState());
      return request(ctx);
    }
    function reorder(lineIds) {
      const ctx = active;
      if (!ctx || !Array.isArray(lineIds) || lineIds.length !== ctx.lines.length ||
          new Set(lineIds).size !== lineIds.length || !lineIds.every(lineId => ctx.lines.some(line => line.id === lineId))) throw fail('IDENTIFICATION_ORDER');
      const time = read(ctx);
      if (time === null) return Promise.resolve(snapshot(lastNow));
      if (time >= ctx.deadline) { void end(ctx, 'idle'); return Promise.resolve(snapshot(time)); }
      const byId = new Map(ctx.lines.map(line => [line.id, line]));
      ctx.lines = lineIds.map(lineId => byId.get(lineId));
      return interaction();
    }
    function settle() {
      // A local metadata commit must not race the current radio operation.
      // Waiting is not user activity: never renew a lease or send a keepalive.
      const ctx=active;
      return Promise.resolve(ctx?.flight).then(()=>getState());
    }
    function blink(lineId,enabled) {
      const ctx=active;
      if(!id(lineId) || typeof enabled!=='boolean' || !ctx || ctx.closed ||
         !ctx.lines.some(line=>line.id===lineId))throw fail('IDENTIFICATION_BLINK_INPUT');
      if(typeof sendBlink!=='function')throw fail('IDENTIFICATION_BLINK_UNAVAILABLE');
      if(ctx.blinks.length>=16)throw fail('IDENTIFICATION_BLINK_BUSY');
      // One click is one actual interaction. Queue its TOUCH before installing
      // the blink; never call interaction/request from inside their own flight.
      void interaction();
      if(active!==ctx || ctx.closed)return Promise.reject(fail('IDENTIFICATION_BLINK_CANCELLED'));
      return new Promise((resolve,reject)=>{ctx.blinks.push({lineId,enabled,resolve,reject});});
    }
    function close(reason = 'closed') {
      if (typeof reason !== 'string' || reason.length > 96) throw fail('IDENTIFICATION_REASON');
      const ctx = active;
      if (!ctx) return Promise.resolve(getState());
      return end(ctx, reason).then(() => getState());
    }
    // No saved model/state is accepted by this API. A newer valid writer owns the
    // normal light state; cleanup only releases the matching temporary overlay.
    return Object.freeze({ open, interaction, reorder, settle, blink, getState, close,
      hide: () => close('hidden'), offline: () => close('offline'),
      supersede: () => close('superseded') });
  }
  return Object.freeze({ create, MAX_LINES });
}));
