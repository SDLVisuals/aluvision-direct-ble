/* Durable final LIVE intent is separate from immediate physical CONTROL.
 * Observe only local changes, coalesce by receiver/property after idle, and
 * never republish another phone's stale complete light state. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.LightningStandLiveCheckpoint=factory();
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const FIELDS=new Set(('engine animation effectId category variant r g b w brightness speed smooth power colors whiteChannels rgbEnabled whiteEnabled direction widthPixels transitionMs background backgroundOn bgBrightness fadeAmount width delayMs brandColor motionReverse spacing objectCount trailLength spread randomness bounce mirror phaseMs phaseRateMicroHz previewStartedAt standAnimation rgbwLast previewFamily backgroundBrightness backgroundRgbEnabled backgroundWhite backgroundWhiteEnabled colorCount legacySpi lineDelayMs v30Effect').split(' '));
  const NULLABLE=new Set(('effectId category v30Effect previewFamily rgbwLast standAnimation brandColor speed smooth colorCount widthPixels objectCount trailLength spacing direction lineDelayMs spread randomness fadeAmount delayMs width').split(' '));
  const copy=value=>JSON.parse(JSON.stringify(value));
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const key=operation=>operation.id+'\u0000'+operation.setting;
  const error=code=>Object.assign(Error('Je laatste lichtkeuze is nog niet bevestigd opgeslagen.'),{code});
  function state(value){
    const result=copy(value||{});
    if(result.brightness===undefined&&result.bri!==undefined)result.brightness=result.bri;
    if(result.power===undefined&&result.on!==undefined)result.power=result.on;
    delete result.bri;delete result.on;
    return result;
  }
  function difference(before,after,{standId,receiverId}){
    if(typeof standId!=='string'||!standId||typeof receiverId!=='string'||!receiverId||new TextEncoder().encode(receiverId).length>160)throw error('STAND_STATE_TARGET_INVALID');
    const old=state(before),next=state(after),operations=[];
    for(const setting of FIELDS){
      if(equal(old[setting],next[setting]))continue;
      const value=Object.hasOwn(next,setting)?next[setting]:null;
      if(value===null&&!NULLABLE.has(setting))throw error('STAND_STATE_DELETE_INVALID');
      operations.push({op:'put',kind:'live',id:receiverId,parent:standId,targetKind:'receiver',setting,value:copy(value)});
    }
    return operations;
  }
  function batches(operations){
    const result=[];let batch=[],bytes=0;
    for(const operation of operations){
      const size=new TextEncoder().encode(JSON.stringify(operation)+'\n').length;
      if(size>128*1024)throw error('STAND_STORAGE_LIMIT');
      if(batch.length===128||bytes+size>128*1024){result.push(batch);batch=[];bytes=0;}
      batch.push(operation);bytes+=size;
    }
    if(batch.length)result.push(batch);return result;
  }
  function create({send,afterSaved=async()=>{},waitBeforeFlush,onState=()=>{},setTimer=setTimeout,clearTimer=clearTimeout,idFactory=()=>crypto.randomUUID(),idleMs=1200}={}){
    if(typeof send!=='function'||waitBeforeFlush!==undefined&&typeof waitBeforeFlush!=='function')throw error('STAND_CONNECTION_UNAVAILABLE');
    let baseline=new Map(),pending=new Map(),originals=new Map(),standId=null,timer=null,job=null,generation=0,disposed=false;
    let intentGeneration=0,confirmedFence=null,unconfirmed=null;
    let status={status:'idle',pending:0,busy:false,error:null};
    const publish=patch=>{status={...status,...patch,pending:pending.size,busy:!!job};onState({...status});};
    const cancelTimer=()=>{if(timer!==null)clearTimer(timer);timer=null;};
    function arm(){cancelTimer();if(!disposed&&pending.size&&!job)timer=setTimer(()=>{timer=null;void flush().catch(()=>{});},idleMs);}
    function seed(model,id,fence){
      if(job||pending.size)throw error('STAND_STATE_EDITING');
      if(standId!==id)unconfirmed=null;
      standId=id;baseline=new Map(model.receivers.filter(receiver=>receiver.standId===id).map(receiver=>[receiver.id,state(receiver.state)]));
      confirmedFence=fence&&typeof fence.bootId==='string'&&Number.isSafeInteger(fence.stateRevision)&&fence.stateRevision>=0?{bootId:fence.bootId,stateRevision:fence.stateRevision}:null;
    }
    function observe(model,receiverIds){
      if(disposed||!standId)return;
      const changes=[],observed=[];
      for(const receiverId of new Set(receiverIds)){
        const receiver=model.receivers.find(item=>item.id===receiverId&&item.standId===standId);
        if(!receiver)throw error('STAND_STATE_TARGET_INVALID');
        if(!baseline.has(receiverId))throw error('STAND_STATE_TARGET_INVALID');
        const previous=baseline.get(receiverId);
        for(const operation of difference(previous,receiver.state,{standId,receiverId}))changes.push({operation,original:Object.hasOwn(previous,operation.setting)?previous[operation.setting]:null});
        observed.push([receiverId,state(receiver.state)]);
      }
      batches(changes.map(item=>item.operation));observed.forEach(([id,value])=>baseline.set(id,value));
      changes.forEach(({operation,original})=>{
        const id=key(operation);if(!originals.has(id))originals.set(id,copy(original));
        if(equal(originals.get(id),operation.value)){pending.delete(id);originals.delete(id);}
        else pending.set(id,operation);
      });
      if(changes.length){intentGeneration++;unconfirmed=null;publish({status:pending.size?'pending':job?'saving':'idle',error:null});arm();}
    }
    function flush(){
      cancelTimer();if(job)return job;if(disposed||!pending.size)return Promise.resolve(null);
      const epoch=generation;let operations,submittedIntent,baseFence,submitted=false;
      const task=(async()=>{
        // The held picker must keep its mailbox. Waiting is passive: no idle
        // lease, packet or frozen intermediate checkpoint owns the radio.
        if(waitBeforeFlush)await waitBeforeFlush({standId,receiverIds:()=>[...new Set([...pending.values()].map(operation=>operation.id))]});
        if(disposed||epoch!==generation)throw error('STAND_CONNECTION_CANCELLED');
        operations=[...pending.values()];submittedIntent=intentGeneration;baseFence=confirmedFence&&{...confirmedFence};pending.clear();originals.clear();submitted=true;
        if(!operations.length)return null;
        let receipt=null;
        for(const batch of batches(operations)){
          if(disposed||epoch!==generation)throw error('STAND_CONNECTION_CANCELLED');
          const transactionId=idFactory();receipt=await send({op:'live',payload:{operations:batch},transactionId});
          if(disposed||epoch!==generation)throw error('STAND_CONNECTION_CANCELLED');
          if(receipt?.status!=='saved'||receipt.requestId!==transactionId)throw error('STAND_SAVE_UNCONFIRMED');
        }
        await afterSaved(receipt);
        if(disposed||epoch!==generation)throw error('STAND_CONNECTION_CANCELLED');return receipt;
      })();job=task;publish({status:'saving',error:null});
      return task.then(receipt=>{if(epoch===generation&&!disposed){unconfirmed=null;publish({status:pending.size?'pending':operations.length?'saved':'idle',error:null});}return receipt;},failure=>{
        // A lost reply is reconciled by reading, never replayed with a new ID.
        if(epoch===generation&&!disposed){unconfirmed=baseFence?{...baseFence,standId,intentGeneration:submittedIntent,operations}:null;publish({status:'unconfirmed',error:failure?.code||'STAND_SAVE_UNCONFIRMED'});}throw failure;
      }).finally(()=>{if(job===task)job=null;if(epoch===generation&&!disposed){publish({});if(submitted)arm();}});
    }
    function projectionModel(next,readIntentGeneration){
      if(!unconfirmed)return next.view.model;
      // Only an already older read may preserve an unconfirmed local preview.
      // New reads (even unchanged), a newer remote state or boot always win.
      if(next.standId!==unconfirmed.standId||next.bootId!==unconfirmed.bootId||
         next.stateRevision>unconfirmed.stateRevision||!Number.isSafeInteger(readIntentGeneration)||readIntentGeneration>=unconfirmed.intentGeneration){unconfirmed=null;return next.view.model;}
      const model=copy(next.view.model);
      for(const operation of unconfirmed.operations){
        const receiver=model.receivers.find(x=>x.id===operation.id&&x.standId===unconfirmed.standId);if(!receiver)continue;
        if(operation.value===null)delete receiver.state[operation.setting];else receiver.state[operation.setting]=copy(operation.value);
        if(operation.setting==='brightness')receiver.state.bri=operation.value;
        if(operation.setting==='power')receiver.state.on=operation.value;
      }
      return model;
    }
    function reset(){++generation;++intentGeneration;cancelTimer();pending.clear();originals.clear();baseline.clear();standId=null;job=null;unconfirmed=null;confirmedFence=null;publish({status:'idle',error:null});}
    function dispose(){reset();disposed=true;}
    return Object.freeze({seed,observe,flush,reset,dispose,projectionModel,reconciliationPending:()=>!!unconfirmed,intentGeneration:()=>intentGeneration,state:()=>({...status}),editing:()=>!!job||pending.size>0});
  }
  return Object.freeze({create,difference,batches,FIELDS:Object.freeze([...FIELDS]),NULLABLE:Object.freeze([...NULLABLE])});
});
