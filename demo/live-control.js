/* A single radio queue for firmware-confirmed light changes. The preview is
 * immediate; a relay or late reply never proves that LEDs emitted light. */
(function (root, factory) {
  const model = typeof module === 'object' && module.exports ? require('./model.js') : root.LightningModel;
  const preview = typeof module === 'object' && module.exports ? require('./preview.js') : root.LightningPreview;
  const api = factory(model,root,preview);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LightningLiveControl = api;
})(typeof globalThis === 'object' ? globalThis : this, function (model,root,preview) {
  'use strict';
  const SPI_ENGINES=['STATIC','GRADIENT','BREATHE','CHASE','COMET','SCANNER','SPARKLE','WAVE','SEQUENCE','ALL','MIRROR','ALTERNATE','CASCADE','DUAL','FLOW','WARM','MINIMAL'];
  const RGBW_ENGINES=[...SPI_ENGINES,'PULSE','STROBE','SMOOTH'];
  const V30_EFFECTS=['rgb-jumping','seven-jumping','rgb-gradient','seven-gradient','tunnel-travel','tunnel-bounce','tunnel-center','tunnel-outside','tunnel-cascade','tunnel-handoff','tunnel-pulse','tunnel-echo','tunnel-pixel-curtain','tunnel-pixel-cross','brand-white-breathe','brand-warm-white','brand-accent','brand-sweep','brand-focus','brand-soft-gradient'].map(id=>'v30-'+id);
  const SPI_TIMED_VARIANTS=new Set([...Array(13)].map((_,i)=>90+i).concat([104,105,106,107,108,109,110,111,128]));
  const SHARED_TUNNEL_VARIANTS=new Set([5,6,7,8,9,10,11,12,13,14,15,16,21,22,23,24,26,27,28,29,30,31]);
  // Interpolate static wheel/dimmer targets on the receiver, without delaying
  // dispatch or storing a history of pointer movements. Keep explicit off and
  // animation changes immediate; animation smoothness is its own setting.
  const STATIC_TRANSITION_MS=240;
  const clone=value=>JSON.parse(JSON.stringify(value));
  function spiPhaseLineDelay(state,variant,lineCount,parallel) {
    if(!parallel||lineCount<=1)return 0;
    const shared=variant>=150&&SHARED_TUNNEL_VARIANTS.has(variant-150);
    const timed=SPI_TIMED_VARIANTS.has(variant)||shared;
    if(timed)return Math.min(5080,Math.round(Math.max(0,Math.min(5000,Number(state.lineDelayMs)||0))/40)*40);
    const speed=Math.max(0.5,Math.min(100,Number(state.speed)||0));
    const normalized=speed/100,rate=0.002+normalized*normalized*0.80;
    const delay=Number(state.spread??50)/100*0.65*1000/((lineCount-1)*rate);
    return Math.min(5080,Math.round(Math.max(0,Math.min(5080,delay))/40)*40);
  }
  // Full lighting intent. Geometry is deliberately not accepted from this
  // object; the native owner resolves it against its persisted receiver list.
  function requestFor(receiver,{zone,receivers,time}={}) {
    if(!receiver||!['RGBW','SPI'].includes(receiver.type))return null;
    const state=receiver.state||{},spi=receiver.type==='SPI';
    let extension=state.engine==='V30'||state.v30Effect;
    const reference=typeof module==='object'&&module.exports?require('./reference-animations.js'):globalThis.LightningReferenceAnimations;
    let extensionId=extension?(reference.wireId(state.v30Effect)||V30_EFFECTS.indexOf(state.v30Effect)+1):0;
    if(extension&&(!extensionId||!spi&&([13,14].includes(extensionId)||extensionId>=31)))return null;
    let engine=state.engine||'STATIC',variant=Number(state.variant??0);
    if(extension){engine='BREATHE';variant=0;}
    if(!(spi?SPI_ENGINES:RGBW_ENGINES).includes(engine)||!Number.isInteger(variant)||variant<0||variant>(spi?181:31))return null;
    if(spi&&state.previewFamily==='RGBW') {
      const whole=[0,1,2,3,4,17,18,19,20,25].indexOf(variant);
      if(whole<0)return null;
      extension=true;extensionId=21+whole;engine='BREATHE';variant=0;
    }
    const number=(value,fallback,min,max)=>{
      const n=Number(value??fallback);return Number.isFinite(n)&&n>=min&&n<=max?Math.round(n):null;
    };
    const colour=(hex,white,rgb=true,w=true)=>{
      if(typeof hex!=='string'||!/^#[a-f\d]{6}$/i.test(hex))return null;
      const neutral=number(white,0,0,255);if(neutral===null)return null;
      return [...(rgb===false?[0,0,0]:[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16))),w===false?0:neutral];
    };
    const hex=state.colors?.length?state.colors:['#'+[state.r??0,state.g??0,state.b??0].map(n=>Math.max(0,Math.min(255,Number(n)||0)).toString(16).padStart(2,'0')).join('')];
    const count=engine==='STATIC'?1:number(state.colorCount,hex.length,1,extension&&extensionId<=20?7:4);
    if(count===null||count>hex.length)return null;
    const palette=hex.slice(0,count).map((c,i)=>colour(c,state.whiteChannels?.[i]??(i===0?state.w:0),state.rgbEnabled?.[i],state.whiteEnabled?.[i]));
    const background=colour(typeof state.background==='object'?state.background?.rgb:state.background??'#000000',state.backgroundWhite??state.background?.white??0,state.backgroundRgbEnabled,state.backgroundWhiteEnabled);
    if(palette.some(c=>!c)||!background)return null;
    const brightness=number(state.bri??state.brightness,100,0,100);
    const scene={engine,variant,palette,background,
      speed:number(state.speed,30,0,100),smooth:number(state.smooth,100,0,100),
      backgroundBrightness:number(state.bgBrightness,0,0,100),backgroundOn:state.backgroundOn===true,
      motionReverse:['left','reverse'].includes(state.direction),widthPixels:number(state.widthPixels,
        engine==='STATIC'&&!extension?4:preview.defaultWidthPixels(receiver),1,8192),
      spacing:number(state.spacing,50,0,100),objectCount:number(state.objectCount,1,1,8),
      trailLength:number(state.trailLength,45,0,100),spread:number(state.spread,50,0,100),
      randomness:number(state.randomness,25,0,100),bounce:state.bounce===true,mirror:state.mirror===true,
      lineDelayMs:number(state.lineDelayMs,0,0,5000)};
    if(state.on===false||state.power===false)scene.backgroundOn=false;
    if(!extension&&engine!=='STATIC'){
      const clock=Number.isFinite(Number(time))?Number(time):performance.now()/1000;
      const parallel=zone?.layout!=='continuous';
      const lineCount=parallel?Math.max(1,model.ledlines(receivers||[receiver]).length):1;
      const phaseState={...state,speed:Math.max(0.5,Number(state.speed)||0),lineCount,
        lineDelayMs:spi?spiPhaseLineDelay(state,variant,lineCount,parallel):(Number(state.lineDelayMs)||0)};
      const family=spi?'SPI':'RGBW';
      const phase=globalThis.AluvisionV21AnimationCatalog?.phaseFor?.(phaseState,clock,family);
      if(Number.isFinite(phase))scene.phaseMs=Math.round((((phase%1)+1)%1)*1000)%1000;
      const rate=globalThis.AluvisionV21AnimationCatalog?.cyclesPerSecond?.(phaseState,family);
      if(Number.isFinite(rate)&&rate>=0&&rate<=20)scene.phaseRateMicroHz=Math.round(rate*1000000);
    }
    if(extension){
      const brand=state.v30Effect==='v30-brand-focus'?palette[0]:
        colour(state.brandColor||hex[0]||'#C94E46',state.whiteChannels?.[0]??state.w??0,true,state.whiteEnabled?.[0]);
      scene.v30={effect:extensionId,fadeAmount:number(extensionId>=21&&extensionId<=30?state.spacing:state.fadeAmount,90,0,100),
        width:number(state.width,65,0,100),delayMs:number(state.delayMs,300,0,10000),brand};
      if(Object.values(scene.v30).some(value=>value===null))return null;
      if(state.on===false||state.power===false)scene.backgroundOn=false;
    }
    // Stand recipes are lighting intent only. Native independently resolves
    // every physical line from its saved installation; JS sends no geometry.
    if(state.standAnimation){
      const marker=state.standAnimation,kind=marker.mode,clockId=marker.clockId;
      if(!['whole','coordinated'].includes(kind)||typeof marker.effectId!=='string'||
         typeof clockId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(clockId))return null;
      scene.standAnimation={effectId:marker.effectId,kind,clockId};
      if(marker.effectId.startsWith('rgbw-')){
        const canonical=marker.state||state,canonicalVariant=Number(canonical.variant);
        const clock=Number.isFinite(Number(time))?Number(time):performance.now()/1000;
        const phaseState={...canonical,previewStartedAt:state.previewStartedAt,phaseMs:state.phaseMs,
          speed:Math.max(0.5,Number(canonical.speed)||0),lineCount:1,lineDelayMs:0};
        const catalog=globalThis.AluvisionV21AnimationCatalog;
        const phase=catalog?.phaseFor?.(phaseState,clock,'RGBW'),rate=catalog?.cyclesPerSecond?.(phaseState,'RGBW');
        if(![0,1,2,3,4,17,18,19,20,25].includes(canonicalVariant)||
           !Number.isFinite(phase)||!Number.isFinite(rate)||rate<0||rate>20)return null;
        Object.assign(scene.standAnimation,{variant:canonicalVariant,
          phaseMs:Math.round((((phase%1)+1)%1)*1000)%1000,phaseRateMicroHz:Math.round(rate*1000000)});
      }
    }
    if(brightness===null||Object.values(scene).some(value=>value===null))return null;
    const powered=state.on!==false&&state.power!==false;
    return {standId:receiver.standId,receiverId:receiver.id,kind:spi?'SPI_SCENE':'RGBW_SCENE',
      brightness:powered?brightness:0,
      transitionMs:powered&&scene.engine==='STATIC'&&!extension?STATIC_TRANSITION_MS:0,channels:[],scene};
  }
  // Membership has already been confirmed by native storage. A new line can
  // join an unambiguous running animation, but never choose between separately
  // controlled/mixed lines. Copy light intent only; physical geometry, identity
  // and enrollment remain the confirmed next model's exclusive authority.
  function joinZonePlayback(previous,next,receiverIds,options={}) {
    // Removal authority is supplied only by the validated, terminal native
    // removal route. Ordinary zone joins must never infer it from missing IDs.
    if(!options||typeof options!=='object'||Array.isArray(options)||
       ![Object.prototype,null].includes(Object.getPrototypeOf(options))||
       Object.keys(options).some(key=>key!=='confirmedRemovedIds'))throw Error('LIVE_JOIN_INVALID');
    const removedIds=options.confirmedRemovedIds===undefined?[]:options.confirmedRemovedIds;
    if(!Array.isArray(removedIds)||new Set(removedIds).size!==removedIds.length||
       Array.from(removedIds).some(id=>typeof id!=='string'||!id||
         !previous.receivers.some(receiver=>receiver.id===id&&receiver.lifecycle==='added')||
         next.receivers.some(receiver=>receiver.id===id))||
       removedIds.length&&(receiverIds||[]).length)throw Error('LIVE_JOIN_INVALID');
    const model=clone(next),inheritedIds=[],refreshIds=new Set(),changedZones=new Set();
    const before=new Map(previous.receivers.map(receiver=>[receiver.id,receiver]));
    const zones=new Map(model.stands.flatMap(stand=>stand.zones.map(zone=>[zone.id,{...zone,standId:stand.id}])));
    // Confirmed zone placement changes the whole stand's physical ordinals,
    // even when its destination is empty or the receiver becomes unzoned.
    // Preserve a coherent existing clock and intent; never infer a new shared
    // recipe from a partial marker, changed board identity or mixed power.
    const standAnimations=typeof module==='object'&&module.exports?require('./stand-animations.js'):globalThis.LightningStandAnimations;
    const changedStands=new Set(),sharedBefore=new Map(),handledStands=new Set(),unsafeStands=new Set();
    const members=(value,standId)=>value.receivers.filter(receiver=>receiver.standId===standId&&receiver.lifecycle==='added');
    const powered=receiver=>receiver.state?.on!==false&&receiver.state?.power!==false;
    const sameIdentity=(a,b)=>a&&b&&['rid','deviceFingerprint','physicalId','standId','type','role','lifecycle'].every(key=>a[key]===b[key]);
    const clearShared=standId=>{
      for(const receiver of members(model,standId)){delete receiver.state.standAnimation;refreshIds.delete(receiver.id);}
    };
    const coherentAfter=(standId,prior)=>{
      const marker=standAnimations?.active(model,standId),current=members(model,standId);
      return marker&&JSON.stringify(marker)===JSON.stringify(prior.marker)&&current.length&&
        current.every(receiver=>powered(receiver)===prior.powered);
    };
    for(const standId of new Set(removedIds.map(id=>before.get(id).standId))){
      const oldMembers=members(previous,standId),current=members(model,standId);
      if(!oldMembers.some(receiver=>receiver.state?.standAnimation)&&!current.some(receiver=>receiver.state?.standAnimation))continue;
      const authorized=new Set(removedIds),survivors=previous.receivers.filter(receiver=>
        receiver.standId===standId&&!authorized.has(receiver.id)),retainedMembers=model.receivers.filter(receiver=>receiver.standId===standId);
      const marker=standAnimations?.active(previous,standId),oldPower=oldMembers.length?powered(oldMembers[0]):null;
      const exactSurvivors=retainedMembers.length===survivors.length&&survivors.every(old=>{
        const retained=retainedMembers.find(receiver=>receiver.id===old.id);
        return sameIdentity(old,retained)&&old.onboardingTransactionId===retained.onboardingTransactionId&&
          old.state?.previewStartedAt===retained.state?.previewStartedAt&&old.state?.phaseMs===retained.state?.phaseMs;
      });
      if(!marker||!exactSurvivors||!oldMembers.every(receiver=>powered(receiver)===oldPower)||
         !coherentAfter(standId,{marker,powered:oldPower})){
        // A changed authority, partial recipe or newer light state is not an
        // invitation to replay the pre-removal scene. Keep the authoritative
        // geometry and every current light value; dissolve only shared scope.
        unsafeStands.add(standId);clearShared(standId);continue;
      }
      handledStands.add(standId);current.forEach(receiver=>refreshIds.add(receiver.id));
    }
    for(const id of new Set(receiverIds||[])){
      const receiver=model.receivers.find(item=>item.id===id),old=before.get(id);
      if(receiver?.lifecycle==='added'&&old?.zoneId!==receiver.zoneId&&(!old||old.standId===receiver.standId))changedStands.add(receiver.standId);
    }
    for(const standId of changedStands){
      const oldMembers=members(previous,standId),current=members(model,standId);
      if(!oldMembers.some(receiver=>receiver.state?.standAnimation)&&!current.some(receiver=>receiver.state?.standAnimation))continue;
      const marker=standAnimations?.active(previous,standId),oldPower=oldMembers.length?powered(oldMembers[0]):null;
      if(!marker||!oldMembers.every(receiver=>powered(receiver)===oldPower&&sameIdentity(receiver,current.find(item=>item.id===receiver.id)))){
        unsafeStands.add(standId);clearShared(standId);continue;
      }
      const prior={marker,powered:oldPower};sharedBefore.set(standId,prior);
      if(coherentAfter(standId,prior)){
        handledStands.add(standId);current.forEach(receiver=>refreshIds.add(receiver.id));
      }
    }
    const joined=new Map();
    for(const id of new Set(receiverIds||[])){
      const receiver=model.receivers.find(item=>item.id===id),old=before.get(id);
      if(!receiver||receiver.lifecycle!=='added'||old?.zoneId===receiver.zoneId||
         old&&old.standId!==receiver.standId)continue;
      if(handledStands.has(receiver.standId)||unsafeStands.has(receiver.standId))continue;
      if(old?.zoneId)changedZones.add(old.zoneId);
      const target=zones.get(receiver.zoneId);
      if(!target||target.standId!==receiver.standId||target.type!==receiver.type||!target.receiverIds.includes(id))continue;
      changedZones.add(target.id);
      if(!joined.has(target.id))joined.set(target.id,[]);
      joined.get(target.id).push(receiver);
    }
    for(const [zoneId,incoming]of joined){
      const zone=zones.get(zoneId),oldZone=previous.stands.find(stand=>stand.id===zone.standId)?.zones.find(item=>item.id===zoneId);
      const incomingIds=new Set(incoming.map(receiver=>receiver.id));
      const peers=(oldZone?.receiverIds||[]).map(id=>before.get(id)).filter(receiver=>
        receiver&&receiver.lifecycle==='added'&&receiver.type===zone.type&&receiver.standId===zone.standId&&
        zone.receiverIds.includes(receiver.id)&&!incomingIds.has(receiver.id));
      if(!peers.length)continue;
      if(!peers.every(receiver=>{
        const current=model.receivers.find(item=>item.id===receiver.id);
        return current&&['rid','deviceFingerprint','physicalId','standId','type','role','lifecycle'].every(key=>current[key]===receiver[key]);
      }))continue;
      const intent=receiver=>{
        const request=requestFor(receiver,{zone:oldZone,receivers:peers,time:0});
        if(!request||request.brightness===0||request.scene.engine==='STATIC'&&!request.scene.v30)return null;
        const {phaseMs,phaseRateMicroHz,...scene}=request.scene;
        // Identical effects can still have deliberately independent clocks.
        // A time-zero sample cannot distinguish two later start anchors, so
        // compare their origins as well before choosing a group's leader.
        const started=Number(receiver.state?.previewStartedAt),phase=Number(receiver.state?.phaseMs);
        const timing={startedAt:Number.isFinite(started)&&started>0?started:0,
          phaseMs:Number.isFinite(phase)?((phase%1000)+1000)%1000:0};
        return JSON.stringify({brightness:request.brightness,scene,timing});
      };
      const common=intent(peers[0]);if(!common||!peers.every(receiver=>intent(receiver)===common))continue;
      for(const receiver of incoming){receiver.state=clone(peers[0].state);inheritedIds.push(receiver.id);}
    }
    // Every surviving member needs the new line count/continuous offset. A
    // single batch uses one phase sample, also when moving between two zones.
    for(const zoneId of inheritedIds.length?changedZones:[]){
      const zone=zones.get(zoneId);if(!zone)continue;
      for(const id of zone.receiverIds)if(model.receivers.some(receiver=>receiver.id===id&&receiver.lifecycle==='added'))refreshIds.add(id);
    }
    // A newly enrolled same-family line may first inherit its zone's proven
    // intent above. Refresh every member only if that result really preserves
    // the prior shared marker and power; no unmarked newcomer is a fake ACK.
    for(const [standId,prior]of sharedBefore){
      if(coherentAfter(standId,prior))members(model,standId).forEach(receiver=>refreshIds.add(receiver.id));
      else clearShared(standId);
    }
    return {model,inheritedIds,receiverIds:[...refreshIds]};
  }
  function create({send,sendBatch,sendGesture,onState,onRoute,waitBeforeSend,delay=0,setTimer=setTimeout,clearTimer=clearTimeout}) {
    if (typeof send !== 'function' || typeof onState !== 'function') throw Error('LIVE_QUEUE_INVALID');
    if (sendBatch!==undefined && typeof sendBatch!=='function') throw Error('LIVE_QUEUE_INVALID');
    if (sendGesture!==undefined && typeof sendGesture!=='function') throw Error('LIVE_QUEUE_INVALID');
    if (waitBeforeSend!==undefined && typeof waitBeforeSend!=='function') throw Error('LIVE_QUEUE_INVALID');
    const queue=new Map(), desired=new Map(), states=new Map(),idleWaiters=new Set();
    let active=null,draining=false,timer=null,version=0,epoch=0,idleLease=null;
    let gestureHeld=false,gestureEpoch=0,failedGesture=null;
    const emit=(id,kind,code='')=>{const value={kind,code};states.set(id,value);onState(id,value);};
    const observeRoute=(reason,count)=>{try{
      const flag=Object.getOwnPropertyDescriptor(root,'__lightningV41GestureDiagnostics');
      if(flag?.value===true&&flag.writable===false&&flag.configurable===false&&typeof onRoute==='function'&&
         ['QUEUE_NO_PROVIDER','QUEUE_INELIGIBLE','QUEUE_ELIGIBLE'].includes(reason)&&Number.isInteger(count)&&count>=1&&count<=30)
        onRoute(Object.freeze({stage:'queue',reason,count}));
    }catch(_){/* Observation must never alter delivery. */}};
    const signature=request=>JSON.stringify(request);
    function staticGestureShape(request){
      const scene=request?.scene;
      if(!['RGBW_SCENE','SPI_SCENE'].includes(request?.kind)||
         !Number.isInteger(request.brightness)||request.brightness<1||request.brightness>100||
         !Number.isInteger(request.transitionMs)||request.transitionMs<1||request.transitionMs>5000||
         !Array.isArray(request.channels)||request.channels.length||
         !scene||scene.engine!=='STATIC'||scene.variant!==0||scene.backgroundOn!==false||
         'v30' in scene||'standAnimation' in scene||
         !Array.isArray(scene.palette)||scene.palette.length!==1||
         !Array.isArray(scene.palette[0])||scene.palette[0].length!==4||
         !scene.palette[0].every(n=>Number.isInteger(n)&&n>=0&&n<=255))return null;
      const shape=clone(request);shape.brightness=1;shape.scene.palette=[];
      return signature(shape);
    }
    const idleError=code=>Object.assign(Error(code),{code});
    function otherStand(standId){
      return !!standId&&(idleLease&&idleLease.standId!==standId||[...queue.values(),...(active?.items.values()||[])].some(item=>item.request.standId!==standId));
    }
    function finishWaiter(waiter,error,value){
      if(!idleWaiters.delete(waiter))return;
      clearTimer(waiter.timer);waiter.signal?.removeEventListener('abort',waiter.abort);
      if(error)waiter.reject(error);else waiter.resolve(value);
    }
    function lease(standId){
      const held={standId,epoch,onLiveIntent:null};idleLease=held;
      return Object.freeze({onPendingLiveIntent(callback){
        if(typeof callback!=='function'||idleLease!==held||held.epoch!==epoch)return;
        held.onLiveIntent=callback;
        if([...queue.values()].some(item=>item.request.standId===standId))callback();
      },release(){
        if(idleLease!==held)return;
        idleLease=null;schedule();settleIdle();
      }});
    }
    function settleIdle(){
      for(const waiter of [...idleWaiters]){
        if(waiter.signal?.aborted)finishWaiter(waiter,idleError('LIVE_QUEUE_CANCELLED'));
        else if(waiter.epoch!==epoch)finishWaiter(waiter,idleError('LIVE_QUEUE_CLEARED'));
        else if(otherStand(waiter.standId))finishWaiter(waiter,idleError('LIVE_QUEUE_SCOPE_BUSY'));
        else if(!idleLease&&!draining&&!active&&!queue.size&&(!waiter.waitForGesture||!gestureHeld))finishWaiter(waiter,null,waiter.acquire?lease(waiter.standId):undefined);
      }
    }
    function waitIdle({standId,timeoutMs=35000,signal,waitForGesture=false}={},acquire=false){
      if(standId!==undefined&&(typeof standId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(standId))||
         acquire&&standId===undefined||typeof waitForGesture!=='boolean'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>35000||
         signal!==undefined&&(!signal||typeof signal.aborted!=='boolean'||typeof signal.addEventListener!=='function'||typeof signal.removeEventListener!=='function'))return Promise.reject(idleError('LIVE_QUEUE_INVALID'));
      if(signal?.aborted)return Promise.reject(idleError('LIVE_QUEUE_CANCELLED'));
      if(active&&active.epoch!==epoch||idleLease&&idleLease.epoch!==epoch)return Promise.reject(idleError('LIVE_QUEUE_CLEARED'));
      if(otherStand(standId))return Promise.reject(idleError('LIVE_QUEUE_SCOPE_BUSY'));
      if(!idleLease&&!draining&&!active&&!queue.size&&(!waitForGesture||!gestureHeld))return Promise.resolve(acquire?lease(standId):undefined);
      if(idleWaiters.size>=8)return Promise.reject(idleError('LIVE_QUEUE_BUSY'));
      return new Promise((resolve,reject)=>{
        const waiter={standId,epoch,acquire,signal,waitForGesture,resolve,reject,timer:null,abort:null};idleWaiters.add(waiter);
        waiter.abort=()=>finishWaiter(waiter,idleError('LIVE_QUEUE_CANCELLED'));signal?.addEventListener('abort',waiter.abort,{once:true});
        waiter.timer=setTimer(()=>finishWaiter(waiter,idleError('LIVE_QUEUE_BUSY')),timeoutMs);
      });
    }
    const whenIdle=options=>waitIdle(options),acquireIdle=options=>waitIdle(options,true);
    function schedule(){
      if(draining||idleLease||timer!==null||!queue.size)return;
      timer=setTimer(()=>{timer=null;void drain();},delay);
    }
    function considerPreparingSupersession(){
      const held=active;
      if(held?.stream){considerStaticGestureUpdate(held);return;}
      if(!held||held.epoch!==epoch||held.supersessionCheck||held.supersessionRequested||
         typeof held.operation?.supersedePreparing!=='function')return;
      held.supersessionCheck=true;
      // A group gesture enqueues its members synchronously. Never replace a
      // six-member preparation just because the first member was enqueued.
      Promise.resolve().then(()=>{
        held.supersessionCheck=false;
        if(active!==held||epoch!==held.epoch||held.supersessionRequested||queue.size!==held.items.size)return;
        const replacement=[];
        for(const [id,item] of held.items){
          const latest=queue.get(id);
          if(!latest||desired.get(id)?.signature!==latest.signature||
             latest.request.standId!==item.request.standId||latest.request.kind!==item.request.kind)return;
          replacement.push(latest.request);
        }
        // A continuously moving colour wheel must not cancel every cold
        // calibration before it can publish a single colour. Finish one
        // already-running ordinary STATIC wave; queue.set retains only the
        // newest successor, not a history. All native witnesses/receipts and
        // post-await fences remain untouched. Off, animation, scope, geometry
        // and other recipe changes still use the existing supersession path.
        if(replacement.every(request=>{
          const before=staticGestureShape(held.items.get(request.receiverId).request);
          return before!==null&&before===staticGestureShape(request);
        })){
          considerPreparingStaticReplacement(held,replacement);
          return;
        }
        if(!replacement.some(request=>signature(request)!==held.items.get(request.receiverId).signature))return;
        held.supersessionRequested=true;
        const unavailable=()=>{
          if(active!==held||epoch!==held.epoch)return;
          held.supersessionRequested=false;
          for(const [id,item] of held.items)if(queue.get(id)?.signature===item.signature&&
            desired.get(id)?.signature===item.signature)queue.delete(id);
        };
        let result;try{result=held.operation.supersedePreparing(replacement);}catch(_){unavailable();return;}
        Promise.resolve(result).then(accepted=>{
          if(accepted||active!==held||epoch!==held.epoch)return;
          unavailable();
        },unavailable);
      });
    }
    function considerPreparingStaticReplacement(held,replacement){
      if(active!==held||held.preparingClosed||held.preparingInFlight||
         typeof held.operation?.replacePreparingStatic!=='function')return;
      if(held.preparingAccepted&&replacement.every(request=>
         held.preparingAccepted.get(request.receiverId)?.signature===signature(request)))return;
      const attempted=new Map(replacement.map(request=>[request.receiverId,queue.get(request.receiverId)]));
      held.preparingTouched=true;held.preparingInFlight=attempted;
      let operation;
      try{operation=held.operation.replacePreparingStatic(replacement);}catch(_){operation=Promise.resolve({status:'unknown',submitted:true});}
      Promise.resolve(operation).then(result=>{
        if(active!==held||epoch!==held.epoch)return;
        held.preparingInFlight=null;
        if(result?.status==='accepted'&&Number.isInteger(result.sequence)&&result.sequence>0){
          held.preparingAccepted=attempted;
          // Acknowledge only local staging. Keep every desired item pending
          // until the original terminal receipt binds its chosen sequence.
          considerPreparingSupersession();
        }else{
          held.preparingClosed=true;
          if(result?.status!=='unavailable')held.preparingUnknown=attempted;
        }
      },()=>{
        if(active!==held||epoch!==held.epoch)return;
        held.preparingInFlight=null;held.preparingUnknown=attempted;held.preparingClosed=true;
      });
    }
    function streamEligible(requests){
      return requests.length>=1&&requests.length<=6&&requests.every(request=>staticGestureShape(request)!==null&&
        request.brightness===requests[0].brightness&&request.transitionMs===requests[0].transitionMs&&
        signature(request.scene.palette)===signature(requests[0].scene.palette));
    }
    function considerStaticGestureUpdate(held){
      if(active!==held||held.epoch!==epoch||held.streamClosed||held.streamCheck||held.streamInFlight)return;
      held.streamCheck=true;
      Promise.resolve().then(()=>{
        held.streamCheck=false;
        if(active!==held||held.epoch!==epoch||held.streamClosed||held.streamInFlight)return;
        const latest=new Map();
        for(const [id,item]of held.items){
          const candidate=queue.get(id)||held.streamStaged?.get(id)||item;
          if(desired.get(id)?.signature!==candidate.signature||candidate.gesture!==held.gesture){finishStream(held);return;}
          latest.set(id,candidate);
        }
        const baseline=held.streamStaged||held.items,changed=[...latest].some(([id,item])=>item.signature!==baseline.get(id).signature);
        if(!changed){if(!gestureHeld||gestureEpoch!==held.gesture)finishStream(held);return;}
        const requests=[...latest.values()].map(item=>item.request);
        if(!streamEligible(requests)||requests.some(request=>staticGestureShape(request)!==staticGestureShape(held.items.get(request.receiverId).request))){finishStream(held);return;}
        held.streamTouched=true;held.streamInFlight=latest;
        let result;try{result=held.operation.updateStaticGesture(requests);}catch(_){result=Promise.resolve({status:'unknown',submitted:true});}
        Promise.resolve(result).then(answer=>{
          if(active!==held||epoch!==held.epoch)return;
          held.streamInFlight=null;
          if(answer?.status==='staged'&&Number.isInteger(answer.sequence)&&answer.sequence>1){
            held.streamStaged=latest;
            for(const [id,item]of latest)if(desired.get(id)?.version===item.version)emit(id,'staged');
            considerStaticGestureUpdate(held);
          }else{
            held.streamClosed=true;
            if(answer?.submitted)held.streamUnknown=latest;
            // An explicit local rejection is not a firmware success. Closing
            // this series never replays its attempted intent automatically.
            if(answer?.submitted)held.operation.stopStaticGesture?.();
            else finishStream(held);
          }
        },()=>{held.streamInFlight=null;held.streamUnknown=latest;held.streamClosed=true;held.operation.stopStaticGesture?.();});
      });
    }
    function finishStream(held){
      if(held.streamEnded||active!==held)return;
      held.streamEnded=true;
      Promise.resolve(held.operation.endStaticGesture?.()).then(answer=>{
        if(active!==held||epoch!==held.epoch)return;
        if(answer?.status==='unknown'){held.streamClosed=true;held.operation.stopStaticGesture?.();}
      },()=>{held.streamClosed=true;held.operation.stopStaticGesture?.();});
    }
    function beginGesture(){gestureHeld=true;gestureEpoch++;failedGesture=null;}
    function endGesture(){gestureHeld=false;if(active?.stream)considerStaticGestureUpdate(active);settleIdle();}
    function cancelGesture(){
      gestureHeld=false;
      if(active?.stream){
        active.streamClosed=true;failedGesture=active.gesture;active.operation?.stopStaticGesture?.();
        for(const [id,item]of queue)if(item.gesture===active.gesture){queue.delete(id);emit(id,'failed','LIVE_CONTROL_CANCELLED');}
      }
      settleIdle();
    }
    async function drain(){
      if(draining||idleLease)return;
      draining=true;
      try{
        while(queue.size){
          // A local write may keep the native boundary unavailable. Leave
          // intents coalescible until that read-only readiness wait finishes;
          // the native send retains its own write/view/authority checks.
          const readyEpoch=epoch;let readinessError=null;
          if(waitBeforeSend)try{await waitBeforeSend();}catch(cause){readinessError=cause?.code||cause?.message||'LIVE_UNCONFIRMED';}
          if(epoch!==readyEpoch)continue;
          if(idleLease)break;
          // App colour-wheel handlers enqueue the selected receivers together.
          // Take their latest values in insertion order, with one native owner
          // operation per stand. Never accumulate a gesture history.
          const items=new Map();let stand;
          for(const [id,item] of queue){
            if(desired.get(id)?.signature!==item.signature){queue.delete(id);continue;}
            if(items.size && (!sendBatch || item.request.standId!==stand))break;
            stand=item.request.standId;items.set(id,item);queue.delete(id);
            if(items.size===(sendBatch?30:1))break;
          }
          if(!items.size)continue;
          const runEpoch=epoch;
          active={items,epoch:runEpoch,gesture:[...items.values()][0].gesture};
          const held=active;
          let error=null,results,superseded=false,completedItems=items;
          let streamComplete=false;
          try{
            if(readinessError)throw Object.assign(Error(readinessError),{code:readinessError});
            const initial=[...items.values()].map(item=>item.request);
            const eligible=sendGesture&&streamEligible(initial);
            observeRoute(!sendGesture?'QUEUE_NO_PROVIDER':eligible?'QUEUE_ELIGIBLE':'QUEUE_INELIGIBLE',initial.length);
            if(eligible){
              held.stream=true;active.operation=sendGesture(initial,{held:gestureHeld&&gestureEpoch===held.gesture});
              const reply=await active.operation;
              if(reply?.status==='static-gesture-unavailable-before-open'&&Object.keys(reply).length===1){held.stream=false;}
              else{
                if(reply?.status!=='static-gesture-complete'||!Number.isInteger(reply.sequence)||reply.sequence<1||reply.sequence>65535||
                   !Array.isArray(reply.requests)||reply.requests.length!==items.size||!Array.isArray(reply.receiverIds)||reply.receiverIds.length!==items.size||
                   reply.receiverIds.some((id,index)=>id!==initial[index].receiverId)||!Number.isInteger(reply.ports)||reply.ports<items.size||reply.ports>24||
                   !/^[A-F0-9]{64}$/.test(reply.witness||''))throw Error('LIVE_UNCONFIRMED');
                const candidates=reply.sequence===1?[items]:[held.streamStaged,held.streamInFlight,held.streamUnknown].filter(Boolean);
                const chosen=candidates.find(candidate=>reply.requests.every(request=>candidate.get(request?.receiverId)?.signature===signature(request)));
                if(!chosen||new Set(reply.requests.map(request=>request.receiverId)).size!==items.size)throw Error('LIVE_UNCONFIRMED');
                completedItems=chosen;streamComplete=true;
                results=new Map([...chosen].map(([id])=>[id,{receiverId:id,status:'applied-in-firmware'}]));
              }
            }
            if(!streamComplete&&sendBatch && items.size>1){
              active.operation=sendBatch([...items.values()].map(item=>item.request));
              const reply=await active.operation;
              if(reply?.status==='batch-superseded-before-dispatch'){
                if(Object.keys(reply).length!==2||!Array.isArray(reply.receiverIds)||reply.receiverIds.length!==items.size||
                   new Set(reply.receiverIds).size!==items.size||reply.receiverIds.some(id=>!items.has(id)))throw Error('LIVE_UNCONFIRMED');
                superseded=true;
              }else{
              if(reply?.status!=='batch-complete'||!Array.isArray(reply.results)||reply.results.length!==items.size)
                throw Error('LIVE_UNCONFIRMED');
              if('preparingSequence' in reply||'preparingRequests' in reply){
                if(!Number.isInteger(reply.preparingSequence)||reply.preparingSequence<0||reply.preparingSequence>65535||
                   !Array.isArray(reply.preparingRequests)||reply.preparingRequests.length!==items.size)throw Error('LIVE_UNCONFIRMED');
                const candidates=reply.preparingSequence===0?[items]:
                  [held.preparingAccepted,held.preparingInFlight,held.preparingUnknown].filter(Boolean);
                const selected=candidates.find(candidate=>reply.preparingRequests.every(request=>
                  candidate.get(request?.receiverId)?.signature===signature(request)));
                if(!selected||new Set(reply.preparingRequests.map(request=>request.receiverId)).size!==items.size||
                   reply.results.some(result=>result?.status!=='applied-in-firmware'))throw Error('LIVE_UNCONFIRMED');
                completedItems=selected;
              }
              results=new Map();
              for(const result of reply.results){
                if(!items.has(result?.receiverId)||results.has(result.receiverId))throw Error('LIVE_UNCONFIRMED');
                if(result.status==='applied-in-firmware'){
                  if(!Number.isSafeInteger(result.generation)||result.generation<1)throw Error('LIVE_UNCONFIRMED');
                }else if(!['unconfirmed','not-sent'].includes(result.status)||typeof result.code!=='string'||
                         !/^[A-Z][A-Z0-9_]{0,79}$/.test(result.code))throw Error('LIVE_UNCONFIRMED');
                results.set(result.receiverId,result);
              }
              }
            }else if(!streamComplete){
              const [id,item]=items.entries().next().value,reply=await send(item.request);
              if(reply?.status!=='applied-in-firmware'||reply.receiverId!==id||
                 !Number.isSafeInteger(reply.generation)||reply.generation<1)throw Error('LIVE_UNCONFIRMED');
              results=new Map([[id,reply]]);
            }
          }catch(cause){error=cause?.code||cause?.message||'LIVE_UNCONFIRMED';}
          active=null;
          if(error&&held.stream){
            failedGesture=held.gesture;
            for(const [id,item]of queue)if(item.gesture===held.gesture){queue.delete(id);if(desired.get(id)?.version===item.version)emit(id,'failed',error);}
          }
          if(!error&&held.stream)for(const candidate of [held.streamInFlight,held.streamUnknown].filter(Boolean))if(candidate!==completedItems){
            for(const [id,item]of candidate)if(queue.get(id)?.version===item.version){
              queue.delete(id);failedGesture=held.gesture;
              if(desired.get(id)?.version===item.version)emit(id,'failed','LIVE_UNCONFIRMED');
            }
          }
          if(superseded){
            // A same-colour reversion may match the old preparation again.
            // It still needs a fresh wave: superseded means zero LIVE, not ACK.
            if(epoch===runEpoch)for(const [id,item] of items)if(!queue.has(id)&&desired.get(id)?.signature===item.signature)queue.set(id,item);
            continue;
          }
          if(error&&held.preparingTouched){
            // A lost replacement ACK/FINAL may already have changed the LEDs.
            // Never automatically replay that submitted version. A genuinely
            // later never-submitted gesture remains a separate pending intent.
            for(const candidate of [held.preparingAccepted,held.preparingInFlight,held.preparingUnknown].filter(Boolean)){
              for(const [id,item]of candidate)if(queue.get(id)?.version===item.version){
                queue.delete(id);
                if(desired.get(id)?.version===item.version)emit(id,'failed',error);
              }
            }
          }
          if(!error){
            // A FINAL for the original/another version does not resolve a
            // missing local replacement ACK. Fail that attempted version
            // rather than automatically dispatching it again.
            for(const candidate of [held.preparingInFlight,held.preparingUnknown].filter(Boolean))if(candidate!==completedItems){
              for(const [id,item]of candidate)if(queue.get(id)?.version===item.version){
                queue.delete(id);
                if(desired.get(id)?.version===item.version)emit(id,'failed','LIVE_UNCONFIRMED');
              }
            }
          }
          for(const [id,item] of completedItems){
            if(epoch!==runEpoch||desired.get(id)?.signature!==item.signature)continue;
            if(!error&&queue.get(id)?.signature===item.signature)queue.delete(id);
            const result=results?.get(id),code=error||(result.status==='applied-in-firmware'?'':result.code);
            emit(id,code?'failed':'applied',code||'');
          }
        }
      }finally{active=null;draining=false;schedule();settleIdle();}
    }
    function request(input){
      const copied=clone(input),id=copied.receiverId,sig=signature(copied);
      const intentVersion=++version;desired.set(id,{signature:sig,version:intentVersion});
      if(active?.epoch===epoch&&active.items.get(id)?.signature===sig&&!active.supersessionRequested&&!active.preparingTouched&&!active.streamTouched){queue.delete(id);emit(id,'pending');return;}
      if(gestureHeld&&failedGesture===gestureEpoch){queue.delete(id);emit(id,'failed','LIVE_UNCONFIRMED');return;}
      queue.set(id,{request:copied,signature:sig,version:intentVersion,gesture:gestureEpoch});emit(id,'pending');
      // Only an explicitly registered automatic archive may yield this lease.
      // The callback cannot release it; actual native cleanup owns that proof.
      if(idleLease?.epoch===epoch&&idleLease.standId===copied.standId)idleLease.onLiveIntent?.();
      schedule();
      considerPreparingSupersession();
      // A newly selected other installation cannot inherit an existing idle
      // barrier. Fail it closed rather than silently waiting for foreign work.
      for(const waiter of [...idleWaiters])if(otherStand(waiter.standId))finishWaiter(waiter,idleError('LIVE_QUEUE_SCOPE_BUSY'));
    }
    function preview(id){
      desired.set(id,{signature:null,version:++version});queue.delete(id);emit(id,'preview');
    }
    function clear(){
      active?.operation?.stopStaticGesture?.();gestureHeld=false;gestureEpoch++;failedGesture=null;
      epoch++;if(timer!==null)clearTimer(timer);timer=null;queue.clear();desired.clear();states.clear();
      for(const waiter of [...idleWaiters])finishWaiter(waiter,idleError('LIVE_QUEUE_CLEARED'));
    }
    return Object.freeze({request,preview,clear,beginGesture,endGesture,cancelGesture,whenIdle,acquireIdle,state:id=>states.get(id)||{kind:'idle',code:''}});
  }
  return Object.freeze({create,requestFor,joinZonePlayback});
});
