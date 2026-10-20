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
  // Recognition swatches are designed in display sRGB. Receiver channels
  // are linear PWM; decode only these temporary identity markers once.
  // Palette numbers/names, normal light state and physical channel maps stay.
  function recognitionWireRGB(srgb) {
    return srgb.map(channel => {
      const encoded = channel / 255;
      const linear = encoded <= .04045 ? encoded / 12.92 :
        Math.pow((encoded + .055) / 1.055, 2.4);
      return Math.round(linear * 255);
    });
  }
  function colour(index, used) {
    if (index < PALETTE.length) {
      const [colorName, srgb] = PALETTE[index];
      const rgb = recognitionWireRGB(srgb);
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
      rgb = recognitionWireRGB(v.map(channel => Math.round((channel + m) * 255)));
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
  function create({ clock, setTimer, clearTimer, sendLease, sendStop, sendBlink, onState, idFactory, idleMs = 30000,
    canRecover, recoverySignature, onResumeConnection } = {}) {
    if ([clock, setTimer, clearTimer, sendLease, sendStop, onState, idFactory].some(fn => typeof fn !== 'function') ||
        sendBlink !== undefined && typeof sendBlink !== 'function' ||
        !Number.isInteger(idleMs) || idleMs < 1 || idleMs > 300000) throw fail('IDENTIFICATION_DEPENDENCIES');
    const automatic=[canRecover,recoverySignature,onResumeConnection];
    if(automatic.some(fn=>fn!==undefined)&&automatic.some(fn=>typeof fn!=='function'))throw fail('IDENTIFICATION_DEPENDENCIES');

    let active = null, timer = null, lastNow = -Infinity, closedReason = 'not-opened', cleanup = null;
    let recovery=null,recoveryTimer=null,recoveryAttempts=0,recoveryEpoch=0,recoveryJob=null;
    let menuResumeAllowed=false;
    const issued = new Set();
    function now() {
      const value = clock();
      if (!Number.isFinite(value) || value < 0 || value < lastNow) throw fail('IDENTIFICATION_CLOCK');
      lastNow = value;
      return value;
    }
    function snapshot(at = lastNow) {
      if (!active) return {
        active: false, session: recovery?.ctx.session||null, standId: recovery?.ctx.standId||null, zoneId: recovery?.ctx.zoneId||null,
        lines: recovery ? recovery.ctx.lines.map((line,index)=>({...copy(line),number:index+1})) : [],
        status: recovery?'recovering':'closed', reason: closedReason, previewOnly: !!recovery, physicalConfirmed: false,
        remainingMs: 0, expiresAtMs: null, confirmation: null, error: null,
        ...(recovery?{recovering:true}:{}),
        cleanup: cleanup ? { session: cleanup.ctx.session, standId: cleanup.ctx.standId, zoneId: cleanup.ctx.zoneId, status: cleanup.status } : null
      };
      const c = active.confirmation;
      const physicalConfirmed = !!c && at < c.validUntilMs && at < active.deadline;
      const expired = (!active.error || active.error === 'IDENTIFICATION_LEASE_EXPIRED') &&
        (!!c && at >= c.validUntilMs || active.error === 'IDENTIFICATION_LEASE_EXPIRED');
      return {
        active: true, session: active.session, standId: active.standId, zoneId: active.zoneId,
        lines: active.lines.map((line, index) => ({ ...copy(line), number: index + 1 })),
        status: physicalConfirmed ? 'confirmed' : active.flight ? 'pending' : expired ? 'expired' : active.error ? 'failed' : 'preview',
        reason: null, previewOnly: !physicalConfirmed, physicalConfirmed,
        ...(active.recoveryStarting?{recovering:true}:{}),
        remainingMs: Math.max(0, Math.floor(active.deadline - at)), expiresAtMs: active.deadline,
        confirmation: physicalConfirmed ? copy(c) : null, error: active.error, cleanup: null
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
    function scope(ctx){return {session:ctx.session,standId:ctx.standId,zoneId:ctx.zoneId,lineIds:ctx.lines.map(line=>line.id)};}
    function recoveryAllowed(ctx){try{return typeof canRecover==='function'&&canRecover(copy(scope(ctx)))===true;}catch(_){return false;}}
    function sameRecoverySource(ctx){try{return typeof ctx.sourceKey==='string'&&ctx.sourceKey.length>0&&recoverySignature(copy(scope(ctx)))===ctx.sourceKey;}catch(_){return false;}}
    function clearRecovery(){
      if(recoveryTimer!==null)try{clearTimer(recoveryTimer);}catch(_){}
      recoveryTimer=null;recovery=null;recoveryEpoch++;
    }
    function recoverable(ctx){return ctx.error&&ctx.error!=='IDENTIFY_UNSUPPORTED'&&ctx.error!=='IDENTIFICATION_CLOCK';}
    function beginRecovery(ctx){
      if(recovery||active!==ctx||ctx.closed||!recoverable(ctx)||!recoveryAllowed(ctx)||!sameRecoverySource(ctx))return;
      recovery={ctx,epoch:++recoveryEpoch};
      void end(ctx,'recovering');scheduleRecovery();
    }
    function scheduleRecovery(){
      const wanted=recovery;
      if(!wanted||recoveryTimer!==null||recoveryJob||!recoveryAllowed(wanted.ctx))return;
      if(!sameRecoverySource(wanted.ctx)){clearRecovery();emit(lastNow);return;}
      const delays=[750,2000,5000],immediate=wanted.menuReturn===true,
        delay=immediate?0:(recoveryAttempts<delays.length?delays[recoveryAttempts]:30000);
      try{recoveryTimer=setTimer(()=>{
        recoveryTimer=null;
        if(recovery!==wanted||wanted.epoch!==recoveryEpoch||!recoveryAllowed(wanted.ctx))return;
        if(!sameRecoverySource(wanted.ctx)){clearRecovery();emit(lastNow);return;}
        wanted.menuReturn=false;
        if(!immediate)recoveryAttempts=Math.min(recoveryAttempts+1,delays.length);
        // Retain this actual promise through every await. A timeout/hide must
        // never create a second pinned resume, STOP or START underneath it.
        const job=Promise.resolve().then(()=>recover(wanted));recoveryJob=job;
        void job.catch(()=>{}).finally(()=>{if(recoveryJob===job)recoveryJob=null;scheduleRecovery();});
      },delay);}catch(_){clearRecovery();emit(lastNow);}
    }
    async function recover(wanted){
      const ctx=wanted.ctx,epoch=wanted.epoch,valid=()=>recovery===wanted&&epoch===recoveryEpoch&&!active&&recoveryAllowed(ctx)&&sameRecoverySource(ctx);
      if(!valid())return;
      try{
        // Finish a possible old write and its first STOP before retrying exact
        // cleanup. No local TTL or transport exception is a positive receipt.
        await Promise.resolve(ctx.flight).catch(()=>{});if(!valid())return;
        await Promise.resolve(ctx.stopFlight).catch(()=>{});if(!valid())return;
        await onResumeConnection(copy(scope(ctx)));if(!valid())return;
        if(cleanup?.ctx!==ctx)return;
        if(cleanup.status!=='confirmed')await stop(ctx);
        if(!valid()||cleanup?.ctx!==ctx||cleanup.status!=='confirmed')return;
        const time=read(null);if(time===null)return;
        const session=idFactory();if(!id(session)||issued.has(session))return;
        issued.add(session);
        const next={...ctx,session,lines:copy(ctx.lines),deadline:time+idleMs,confirmation:null,revision:1,recoveryStarting:true,
          queued:false,renewMarginMs:5000,blinks:[],flight:null,stopFlight:null,closed:false,error:null};
        // New UUID, ordinary START and exact old physical RGB-per-line-ID.
        // Cleanup is not a preview acknowledgement or a configuration save.
        recovery=null;active=next;cleanup=null;emit(time);arm(next,time);
        if(active===next)await request(next);
      }catch(_){/* Remain visibly paused; the capped foreground lane retries. */}
    }
    function stop(ctx) {
      if(ctx.stopFlight)return ctx.stopFlight;
      // The adapter/hardware must apply STOP only to this exact active token.
      // A STOP reply is deliberately not proof that the previous animation resumed.
      const payload = { session: ctx.session, standId: ctx.standId, zoneId: ctx.zoneId, lineIds: ctx.lines.map(line => line.id) };
      const record = !active && cleanup?.ctx === ctx ? cleanup : null;
      const attempt = record ? ++record.attempt : null;
      if (record && record.status !== 'pending') { record.status = 'pending'; emit(lastNow); }
      function completed(reply) {
        // Cleanup from an older token/attempt can never change a newer session.
        if (!record || active || cleanup !== record || record.attempt !== attempt) return;
        record.status = keys(reply, ['stopped']) && Object.getPrototypeOf(reply) === Object.prototype && Object.keys(reply).length === 1 && reply.stopped === true ? 'confirmed' : 'unconfirmed';
        emit(lastNow);
      }
      try {
        // Keep the UI close immediate, but do not retire the native holder
        // underneath its own in-flight TOUCH. The pump's late STOP shares this
        // job and never awaits it, so this cannot wait on itself.
        const flight=ctx.flight;
        const job=Promise.resolve(flight).catch(()=>{}).then(()=>sendStop(copy(payload))).then(completed,()=>completed(null));ctx.stopFlight=job;
        void job.finally(()=>{if(ctx.stopFlight===job)ctx.stopFlight=null;});return job;
      }
      catch (_) { completed(null); return Promise.resolve(); }
    }
    function end(ctx, reason) {
      if (active !== ctx || ctx.closed) return Promise.resolve();
      ctx.closed = true; ctx.queued = false; ctx.confirmation = null;
      for (const blink of ctx.blinks.splice(0)) blink.reject(fail('IDENTIFICATION_BLINK_CANCELLED'));
      clear(); active = null; closedReason = reason;
      menuResumeAllowed=reason==='spi-directions';
      cleanup = { ctx, status: 'pending', attempt: 0 };
      emit(lastNow);
      return stop(ctx);
    }
    function read(ctx) {
      try { return now(); }
      catch (_) { clearRecovery();if (ctx && active === ctx) void end(ctx, 'clock-invalid'); return null; }
    }
    function idle(ctx){
      if(recoveryAllowed(ctx)&&sameRecoverySource(ctx)){
        ctx.error='IDENTIFICATION_LEASE_EXPIRED';beginRecovery(ctx);
        if(recovery?.ctx===ctx)return;
      }
      void end(ctx,'idle');
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
          if (time >= ctx.deadline) { idle(ctx); return; }
          if (ctx.confirmation && time >= ctx.confirmation.validUntilMs) {
            ctx.confirmation = null; ctx.error = 'IDENTIFICATION_LEASE_EXPIRED'; emit(time);
            beginRecovery(ctx);
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
    function request(ctx,refresh=true,renewMarginMs=5000) {
      if(refresh){
        ctx.queued = true;
        // Coalesce foreground presence and clicks into the same radio pump.
        // A new ACK may already cover activity queued during that flight.
        ctx.renewMarginMs=Math.max(ctx.renewMarginMs,renewMarginMs);
      }
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
              if(active===ctx&&!ctx.closed)idle(ctx);
              break;
            }
            const payload={session:ctx.session,standId:ctx.standId,zoneId:ctx.zoneId,lineId:blink.lineId,enabled:blink.enabled};
            try {
              if(!ctx.lines.some(line=>line.id===blink.lineId))throw fail('IDENTIFICATION_BLINK_CANCELLED');
              const reply=await sendBlink(copy(payload));
              if(active!==ctx || ctx.closed){void stop(ctx);throw fail('IDENTIFICATION_BLINK_CANCELLED');}
              const time=read(ctx);
              if(time===null || active!==ctx || ctx.closed || time>=ctx.deadline){
                if(active===ctx&&!ctx.closed)idle(ctx);
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
          const renewMarginMs=ctx.renewMarginMs;ctx.renewMarginMs=5000;
          const sentAt = read(ctx);
          if (sentAt === null) break;
          const ttlMs = Math.min(idleMs, Math.floor(ctx.deadline - sentAt));
          if (ttlMs <= 0) { idle(ctx); break; }
          // Only real payload changes retire a receipt. Activity queued while
          // this same payload was in flight may already be covered by its ACK.
          // Reuse its original finite expiry, never extend it locally. An order
          // assignment changes numbering only, not these physical RGB markers.
          if (ctx.confirmation && ctx.confirmation.validUntilMs - sentAt > renewMarginMs) continue;
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
          if (time >= ctx.deadline) { idle(ctx); break; }
          if (revision !== ctx.revision) continue;
          if (!rejected && validReceipt(reply, payload, time, sentAt)) {
            ctx.confirmation = {
              session: ctx.session, lineIds: payload.lines.map(line => line.id), ttlMs: reply.ttlMs,
              validUntilMs: Math.min(ctx.deadline, sentAt + reply.ttlMs)
            };
            ctx.error = null;
            ctx.recoveryStarting=false;
            recoveryAttempts=0;
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
        if(active===ctx&&!ctx.closed)beginRecovery(ctx);
      });
      return ctx.flight.then(() => getState());
    }
    function getState() {
      const ctx = active, time = read(ctx);
      if (time === null) return snapshot(lastNow);
      if (ctx && time >= ctx.deadline) idle(ctx);
      return snapshot(time);
    }
    function open(input) {
      menuResumeAllowed=false;
      const parsed = validateOpen(input);
      const time = read(active);
      if (time === null) throw fail('IDENTIFICATION_CLOCK');
      const session = idFactory();
      if (!id(session) || issued.has(session)) throw fail('IDENTIFICATION_SESSION');
      issued.add(session);
      clearRecovery();recoveryAttempts=0;
      if (active) void end(active, 'reopened');
      const used = new Set();
      const ctx = { ...parsed, session, lines: parsed.lines.map((line, i) => ({ ...line, ...colour(i, used) })),
        deadline: time + idleMs, confirmation: null, revision: 1, queued: false, renewMarginMs:5000, blinks: [], flight: null, closed: false, error: null };
      if(typeof recoverySignature==='function')try{ctx.sourceKey=recoverySignature(copy(scope(ctx)));}catch(_){}
      active = ctx; cleanup = null; emit(time); arm(ctx, time);
      if (active !== ctx) return Promise.resolve(getState());
      return request(ctx);
    }
    function activity(renewMarginMs) {
      if(recovery){scheduleRecovery();return Promise.resolve(getState());}
      const ctx = active;
      if (!ctx) return Promise.resolve(getState());
      const time = read(ctx);
      if (time === null) return Promise.resolve(snapshot(lastNow));
      if (time >= ctx.deadline) { idle(ctx); return Promise.resolve(snapshot(time)); }
      ctx.deadline = time + idleMs; ctx.error = null;
      emit(time); arm(ctx, time);
      if (active !== ctx) return Promise.resolve(getState());
      // Local activity is not a new physical receipt. Reuse only a still-valid
      // exact lease, with a renewal margin; never extend validUntilMs locally.
      if(!ctx.flight&&!ctx.queued&&ctx.confirmation&&ctx.confirmation.validUntilMs-time>renewMarginMs)return Promise.resolve(getState());
      return request(ctx,true,renewMarginMs);
    }
    function interaction() { return activity(5000); }
    function renewForeground(options={}) {
      if(!keys(options,['force']) || Object.prototype.hasOwnProperty.call(options,'force') && typeof options.force!=='boolean')
        throw fail('IDENTIFICATION_FOREGROUND_INPUT');
      // The caller must invoke this only while this exact ordering panel is
      // visible, in the foreground and permitted to use the native radio.
      // Presence is explicit ongoing UI consent, not a fabricated receiver ACK.
      // With the normal 30s lease and a 5s UI heartbeat, renew around every 10s:
      // enough margin for multiple sequential targets, still one finite lease.
      // No internal interval survives close/hide/offline or reopens a session.
      // A caller may explicitly renew once before its serialized metadata
      // commit, after settle(), to obtain a fresh finite lease runway. This is
      // not a configurable TTL and still cannot bypass the single-flight pump.
      return activity(options.force===true?Infinity:Math.min(idleMs,20000));
    }
    function reorder(lineIds) {
      const ctx = active;
      if (!ctx || !Array.isArray(lineIds) || lineIds.length !== ctx.lines.length ||
          new Set(lineIds).size !== lineIds.length || !lineIds.every(lineId => ctx.lines.some(line => line.id === lineId))) throw fail('IDENTIFICATION_ORDER');
      const time = read(ctx);
      if (time === null) return Promise.resolve(snapshot(lastNow));
      if (time >= ctx.deadline) { idle(ctx); return Promise.resolve(snapshot(time)); }
      const byId = new Map(ctx.lines.map(line => [line.id, line]));
      // The customer assigns the colours seen on the real installation to
      // numbered places. A physical endpoint therefore keeps its exact colour
      // for this entire session, regardless of its newly assigned position.
      ctx.lines = lineIds.map(lineId => byId.get(lineId));
      // The same receipt still confirms the same endpoints and RGB values.
      // Do not recolour, retire a valid ACK or restart an in-flight overlay.
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
      return new Promise((resolve,reject)=>{ctx.blinks.push({lineId,enabled,resolve,reject});void request(ctx,false);});
    }
    function close(reason = 'closed') {
      if (typeof reason !== 'string' || reason.length > 96) throw fail('IDENTIFICATION_REASON');
      if(reason!=='spi-directions')menuResumeAllowed=false;
      if(active&&['focus-unconfirmed','order-test-unconfirmed'].includes(reason)&&recoveryAllowed(active)&&sameRecoverySource(active)){
        active.error='IDENTIFICATION_LEASE_FAILED';beginRecovery(active);return Promise.resolve(getState());
      }
      const recovering=recovery?.ctx;clearRecovery();recoveryAttempts=0;
      const ctx = active;
      if (!ctx) return recovering?stop(recovering).then(()=>getState()):Promise.resolve(getState());
      return end(ctx, reason).then(() => getState());
    }
    function resumeAfterMenu(input){
      if(!keys(input,['standId','zoneId','lineIds'])||!id(input.standId)||!id(input.zoneId)||
         !Array.isArray(input.lineIds)||new Set(input.lineIds).size!==input.lineIds.length||input.lineIds.some(lineId=>!id(lineId)))
        throw fail('IDENTIFICATION_MENU_INPUT');
      const record=cleanup,ctx=record?.ctx;
      if(!menuResumeAllowed||active||recovery||closedReason!=='spi-directions'||!ctx||input.standId!==ctx.standId||input.zoneId!==ctx.zoneId||
         input.lineIds.length!==ctx.lines.length||!input.lineIds.every(lineId=>ctx.lines.some(line=>line.id===lineId))||!recoveryAllowed(ctx))
        return Promise.resolve(getState());
      // Only the app's separately fenced, confirmed edge-cleanup continuation
      // calls this. Retain physical endpoint colours and unsaved order, not a
      // new palette. recover() still requires exact old-order STOP confirmation
      // before a fresh UUID and the ordinary native START/admission.
      let sourceKey;try{sourceKey=recoverySignature(copy(scope(ctx)));}catch(_){}
      if(typeof sourceKey!=='string'||!sourceKey.length)return Promise.resolve(getState());
      menuResumeAllowed=false;ctx.sourceKey=sourceKey;clearRecovery();recoveryAttempts=0;
      recovery={ctx,epoch:++recoveryEpoch,menuReturn:true};closedReason='recovering';emit(lastNow);scheduleRecovery();
      return Promise.resolve(getState());
    }
    function pause(reason){
      if(typeof canRecover!=='function')return close(reason);
      const ctx=active||recovery?.ctx;
      if(!ctx)return Promise.resolve(getState());
      if(ctx.error==='IDENTIFY_UNSUPPORTED')return close(reason);
      if(recoveryTimer!==null)try{clearTimer(recoveryTimer);}catch(_){}
      recoveryTimer=null;recovery={ctx,epoch:++recoveryEpoch};
      if(active===ctx)return end(ctx,reason).then(()=>getState());
      emit(lastNow);return Promise.resolve(getState());
    }
    // No saved model/state is accepted by this API. A newer valid writer owns the
    // normal light state; cleanup only releases the matching temporary overlay.
    return Object.freeze({ open, interaction, renewForeground, reorder, settle, blink, getState, close, resumeAfterMenu,
      hide: () => pause('hidden'), offline: () => pause('offline'),
      supersede: () => close('superseded') });
  }
  // Pure palette helper for initial marker assignment. Once a lease opens,
  // those markers belong to physical line IDs, never to numbered positions.
  // This helper never opens a session or sends anything to a receiver.
  function positionColours(count) {
    if (!Number.isInteger(count) || count < 1 || count > MAX_LINES) throw fail('IDENTIFICATION_LINES');
    const used = new Set();
    return Array.from({length:count}, (_,index) => colour(index,used));
  }
  return Object.freeze({ create, MAX_LINES, positionColours });
}));
