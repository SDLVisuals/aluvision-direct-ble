/* One standcode, one authoritative MAIN. No phone-owned database or user lock.
 * This coordinator never stores credentials, enrolls a phone, or publishes a
 * local snapshot during refresh. Transport and secure storage stay native. */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const api=factory(node?require('./model.js'):root.LightningModel,node?require('./installation-libraries.js'):root.LightningInstallationLibraries);
  if(node)module.exports=api;else root.LightningStandConnection=api;
})(typeof globalThis==='object'?globalThis:this,function(Model,Libraries){
  'use strict';
  const MAX_BYTES=128*1024,MAX_ENTITIES=128,POLL_MS=30000;
  // Native emits these only before the chosen code is saved or submitted.
  const migrationStoreErrors=new Set(['STAND_MIGRATION_PAYLOAD_INVALID','STAND_MIGRATION_STORE_UNAVAILABLE','STAND_MIGRATION_UPLOAD_BUSY','STAND_MIGRATION_UPLOAD_EXPIRED','STAND_MIGRATION_CAPACITY','STAND_MIGRATION_MEMORY_PRESSURE']);
  const copy=value=>JSON.parse(JSON.stringify(value));
  // Local presentation provenance only, never wire/storage/authority.
  const readFences=new WeakMap();
  const fencedRead=(value,fence)=>{const result=copy(value);readFences.set(result,fence);return result;};
  const plain=value=>value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
  const bytes=value=>new TextEncoder().encode(value).length;
  const canonical=value=>JSON.stringify(value,(_,item)=>plain(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
  const fail=code=>{throw Object.assign(Error('Je stand is nog niet bevestigd.'),{code});};
  const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(value);
  const entityId=value=>typeof value==='string'&&bytes(value)>=1&&bytes(value)<=160&&!/[\u0000-\u001f\u007f]/.test(value);
  const revision=value=>Number.isSafeInteger(value)&&value>=0;
  const boot=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(value);
  function newCode(value){
    // New customer PINs are also WPA passphrases. Never trim, coerce to a
    // number or lose leading zeroes. Existing WPA codes retain their separate
    // 8–63 character sign-in policy below.
    if(typeof value!=='string'||! /^[0-9]{8,12}$/.test(value))fail('STAND_NEW_CODE_INVALID');
    return value;
  }
  function suggestCode(random=globalThis.crypto){
    if(typeof random?.getRandomValues!=='function')fail('STAND_CODE_RANDOM_UNAVAILABLE');
    const alphabet='0123456789';
    let result='';
    // Rejection sampling, not modulo-biased Math.random. This is a proposal
    // only: no store, receiver write or password switch occurs here.
    for(let attempt=0;result.length<12&&attempt<16;attempt++){
      const values=new Uint8Array(24);random.getRandomValues(values);
      for(const value of values)if(value<250&&result.length<12)result+=alphabet[value%10];
    }
    if(result.length!==12)fail('STAND_CODE_RANDOM_UNAVAILABLE');return result;
  }
  function publicData(value,depth=0){
    if(depth>20)fail('STAND_DATA_INVALID');
    if(value&&typeof value==='object'){
      if(!Array.isArray(value)&&!plain(value))fail('STAND_DATA_INVALID');
      for(const key of Object.keys(value)){
        if(['__proto__','prototype','constructor','standCode','password','pin','privateKey','ownerKey','sessionKey'].includes(key))fail('STAND_DATA_INVALID');
        publicData(value[key],depth+1);
      }
    }else if(typeof value==='number'&&!Number.isFinite(value))fail('STAND_DATA_INVALID');
  }
  function connectionInput(value){
    if(!plain(value)||Object.keys(value).some(key=>!['ssid','standCode','expectedStandId','joinWifi'].includes(key)))fail('STAND_CONNECTION_INVALID');
    // Neither SSID nor WPA passphrase is trimmed, case-folded or made numeric.
    if(typeof value.ssid!=='string'||bytes(value.ssid)<1||bytes(value.ssid)>32||/[\u0000-\u001f\u007f]/.test(value.ssid)||
       typeof value.standCode!=='string'||! /^[\x20-\x7e]{8,63}$/.test(value.standCode)||
       value.expectedStandId!==undefined&&!id(value.expectedStandId)||
       value.joinWifi!==undefined&&typeof value.joinWifi!=='boolean')fail('STAND_CONNECTION_INVALID');
    return {...value};
  }
  function inspectionInput(value){
    if(!plain(value)||Object.keys(value).some(key=>!['ssid','expectedStandId'].includes(key))||
       value.ssid!==undefined&&(typeof value.ssid!=='string'||bytes(value.ssid)<1||bytes(value.ssid)>32||/[\u0000-\u001f\u007f]/.test(value.ssid))||
       value.expectedStandId!==undefined&&!id(value.expectedStandId))fail('STAND_CONNECTION_INVALID');
    return {...value};
  }
  function resumeInput(value={}){
    if(!plain(value)||Object.keys(value).some(key=>!['expectedStandId','joinWifi'].includes(key))||
       value.expectedStandId!==undefined&&!id(value.expectedStandId)||
       value.joinWifi!==undefined&&typeof value.joinWifi!=='boolean')fail('STAND_CONNECTION_INVALID');
    return {...value};
  }
  function wifiInput(value={}){
    if(!plain(value)||Object.keys(value).some(key=>key!=='expectedStandId')||
       value.expectedStandId!==undefined&&!id(value.expectedStandId))fail('STAND_CONNECTION_INVALID');
    return {...value};
  }
  function resumeIntent(value){
    if(!plain(value))fail('STAND_DATA_UNCONFIRMED');
    if(value.status==='available'&&Object.keys(value).sort().join(',')==='standId,status'&&id(value.standId))return {status:'available',standId:value.standId};
    if(['none','ambiguous','unavailable'].includes(value.status)&&Object.keys(value).join(',')==='status')return {status:value.status};
    fail('STAND_DATA_UNCONFIRMED');
  }
  function inspectionResult(value,ssid){
    if(!plain(value)||!['setup-required','migration-required','code-required','wifi-ready'].includes(value.status)||
       value.initialized!==(value.status!=='setup-required')||typeof value.ssid!=='string'||bytes(value.ssid)<1||bytes(value.ssid)>32||/[\u0000-\u001f\u007f]/.test(value.ssid)||
       ssid!==undefined&&value.ssid!==ssid||
       Object.keys(value).some(key=>!['status','initialized','ssid'].includes(key)))fail('STAND_DATA_UNCONFIRMED');
    return copy(value);
  }
  function sessionStatus(value){
    if(!plain(value))fail('STAND_DATA_UNCONFIRMED');
    if(value.status==='disconnected'&&Object.keys(value).join(',')==='status')return {status:'disconnected'};
    if(value.status!=='connected'||Object.keys(value).sort().join(',')!=='bootId,configRevision,ssid,standId,stateRevision,status'||
       typeof value.ssid!=='string'||bytes(value.ssid)<1||bytes(value.ssid)>32||/[\u0000-\u001f\u007f]/.test(value.ssid))fail('STAND_DATA_UNCONFIRMED');
    // A transient native channel is availability, not a downloaded stand or
    // authority for a write. Only full authenticated resume accepts a view.
    return {...stamp(value),status:'connected',ssid:value.ssid};
  }
  function codeChangeInput(value){
    if(!plain(value)||Object.keys(value).sort().join(',')!=='currentCode,newCode,standId'||!id(value.standId)||
       typeof value.currentCode!=='string'||! /^[\x20-\x7e]{8,63}$/.test(value.currentCode))fail('STAND_CONNECTION_INVALID');
    newCode(value.newCode);
    if(value.currentCode===value.newCode)fail('STAND_CODE_UNCHANGED');return {...value};
  }
  function stamp(value,expectedStandId){
    if(!plain(value)||!id(value.standId)||expectedStandId&&value.standId!==expectedStandId||
       !revision(value.configRevision)||!revision(value.stateRevision)||!boot(value.bootId))fail('STAND_IDENTITY_UNCONFIRMED');
    return {standId:value.standId,configRevision:value.configRevision,stateRevision:value.stateRevision,bootId:value.bootId};
  }
  function projection(value,expectedStandId,confirmedSSID){
    const current=stamp(value,expectedStandId);
    const ssid=value.ssid===undefined?confirmedSSID:value.ssid;
    if(ssid!==undefined&&(typeof ssid!=='string'||bytes(ssid)<1||bytes(ssid)>32||/[\u0000-\u001f\u007f]/.test(ssid)))fail('STAND_DATA_UNCONFIRMED');
    if(!plain(value.view)||value.view.draft!==null||value.view.revision!==current.configRevision||value.view.model?.demo!==false)fail('STAND_DATA_UNCONFIRMED');
    publicData(value.view.model);publicData(value.libraries);
    const model=Model.assertValid(value.view.model);
    if(model.stands.length!==1||model.stands[0].id!==current.standId||model.receivers.length>64)fail('STAND_DATA_UNCONFIRMED');
    const libraries=Libraries.validate(value.libraries,current.standId);
    return {...current,...(ssid===undefined?{}:{ssid}),view:{revision:current.configRevision,draft:null,model:copy(model)},libraries};
  }
  function managementTransition(value,before,after,intent){
    // Only the native proof-bearing membership route may cross an intentional
    // MAIN authority rotation. A generic refresh or arbitrary new boot cannot.
    return plain(value)&&Object.keys(value).sort().join(',')==='fromBootId,kind,receiverId,standId,toBootId,transactionId'&&
      ['receiver-added','receiver-removed'].includes(value.kind)&&id(value.receiverId)&&id(value.transactionId)&&
      value.standId===before.standId&&after.standId===before.standId&&(value.fromBootId===before.bootId||after.bootId===before.bootId)&&value.toBootId===after.bootId&&
      value.toBootId!==value.fromBootId&&after.configRevision>=before.configRevision&&after.stateRevision>=before.stateRevision&&
      (!intent||value.kind===intent.kind&&value.receiverId===intent.receiverId&&value.transactionId===intent.transactionId);
  }
  function entities(model,libraries,standId,{migration=false}={}){
    Model.assertValid(model);const source=model.stands.find(stand=>stand.id===standId);
    if(!source||!id(standId))fail('STAND_DATA_INVALID');
    const library=Libraries.validate(libraries,standId),result=[];
    const put=(kind,item,parent)=>{
      if(!entityId(item.id))fail('STAND_ENTITY_ID_INVALID');publicData(item);
      result.push({op:'put',kind,id:item.id,parent,value:copy(item)});
    };
    const {zones,...stand}=source;
    put('stand',{...stand,zoneIds:zones.map(zone=>zone.id),libraryOrder:{presets:library.presets.map(item=>item.id),scenes:library.scenes.map(item=>item.id),colors:library.colors.map(item=>item.id)}},null);
    for(const zone of zones)put('zone',zone,standId);
    for(const receiver of model.receivers.filter(item=>item.standId===standId)){
      const {state,connection,...config}=receiver;
      // Only a one-time import carries an initial LIVE baseline. Later config
      // writes cannot overwrite another phone's chosen colour or animation.
      put('receiver',migration?{...config,state}:config,standId);
    }
    for(const [field,kind] of [['presets','preset'],['scenes','scene'],['colors','color']])for(const item of library[field])put(kind,item,standId);
    if(result.length>MAX_ENTITIES||bytes(encodeOperations(result))>MAX_BYTES)fail('STAND_STORAGE_LIMIT');
    return result;
  }
  function encodeOperations(operations){return operations.map(operation=>JSON.stringify(operation)).join('\n')+'\n';}
  function changes(before,after,standId){
    const old=entities(before.view.model,before.libraries,standId),next=entities(after.model,after.libraries,standId);
    const keyed=list=>new Map(list.map(item=>[item.kind+':'+item.id,item]));
    const previous=keyed(old),current=keyed(next),operations=[];
    for(const [key,item] of current)if(canonical(previous.get(key))!==canonical(item))operations.push(item);
    for(const [key,item] of previous)if(!current.has(key))operations.push({op:'delete',kind:item.kind,id:item.id,parent:item.parent});
    if(bytes(encodeOperations(operations))>MAX_BYTES)fail('STAND_STORAGE_LIMIT');return operations;
  }
  function create({services,onProjection=()=>{},onUnchangedProjection=()=>{},onState=()=>{},captureProjectionFence=()=>undefined,setTimer=setTimeout,clearTimer=clearTimeout,visible=()=>true,idFactory=()=>crypto.randomUUID()}={}){
    if(!services)fail('STAND_CONNECTION_UNAVAILABLE');
    // A durable ACK advances the write head, not the installed projection.
    // Otherwise an unchanged check at that revision would hide the data that
    // has just been saved, leaving this phone on its old local contents.
    let current=null,head=null,resumeStandId=null,inspected=null,generation=0,refreshJob=null,connectJob=null,wakeJob=null,timer=null,disposed=false,paused=false,writeQueue=Promise.resolve(),pendingWrites=0;
    let state={status:'disconnected',phase:null,standId:null,error:null,pendingWrites:0};
    let liveReadyJob=null;
    const publish=patch=>{state={...state,...patch,pendingWrites};onState(copy(state));};
    function stopTimer(){if(timer!==null)clearTimer(timer);timer=null;}
    function arm(){stopTimer();if(!disposed&&!paused&&current&&visible())timer=setTimer(()=>{timer=null;void refresh().catch(()=>{});},POLL_MS);}
    async function accept(result,expected,epoch=generation,projectionFence){
      const next=projection(result,expected,current&&current.standId===expected?current.ssid:undefined);
      // Apply local cache transaction before accepting the new revision. A
      // cache fault must not present a partly installed stand as connected.
      if(epoch!==generation||disposed)fail('STAND_CONNECTION_CANCELLED');
      if(head&&next.bootId===head.bootId&&(next.configRevision<head.configRevision||next.stateRevision<head.stateRevision))fail('STAND_REVISION_STALE');
      await onProjection(copy(next),{readIntentGeneration:projectionFence,projectionCurrent:()=>epoch===generation&&!disposed});
      if(epoch!==generation||disposed)fail('STAND_CONNECTION_CANCELLED');current=next;head=stamp(next);resumeStandId=null;inspected=null;
      publish({status:'connected',phase:'connected',standId:next.standId,error:null,...stamp(next)});return copy(next);
    }
    async function connect(input,{migration=false,resume=false,wifi=false}={}){
      if(disposed)fail('STAND_CONNECTION_CLOSED');if(connectJob)fail('STAND_CONNECTION_BUSY');
      const {payload:importData,...credentials}=input||{};
      const payload=wifi?wifiInput(input):resume?resumeInput(input):connectionInput(credentials);
      // Retain only an admitted pinned presentation intent on an unsuccessful
      // cold resume. Busy/invalid calls cannot replace another pending intent.
      if(resume&&payload.expectedStandId)resumeStandId=payload.expectedStandId;
      if(migration){
        // Explicit OS joining belongs only to opening an existing shared
        // stand. A password transition uses the native committed handoff.
        if(payload.joinWifi!==undefined)fail('STAND_CONNECTION_INVALID');
        newCode(payload.standCode);
        if(!plain(importData)||!Array.isArray(importData.operations)||importData.operations.length<1||importData.operations.length>MAX_ENTITIES)fail('STAND_MIGRATION_INVALID');
        publicData(importData);if(bytes(encodeOperations(importData.operations))>MAX_BYTES)fail('STAND_STORAGE_LIMIT');payload.payload=copy(importData);
      }else if(importData!==undefined)fail('STAND_CONNECTION_INVALID');
      const previousInspection=inspected;
      const epoch=++generation;paused=false;stopTimer();current=null;head=null;inspected=null;if(!resume)resumeStandId=null;
      publish({status:'connecting',phase:'reach-main',error:null,standId:payload.expectedStandId||null});
      const method=wifi?'standOpenWifi':resume?'standResume':migration?'standMigrate':'standConnect';
      const job=(async()=>{
        if(typeof services[method]!=='function')fail('STAND_CONNECTION_UNAVAILABLE');
        const result=await services[method](payload);
        if(epoch!==generation||disposed)fail('STAND_CONNECTION_CANCELLED');
        if(['setup-required','migration-required'].includes(result?.status)){
          // This explicit receiver response is not inferred from an empty
          // phone cache or a failed network request. No automatic setup.
          if(result.initialized!==(result.status==='migration-required')||typeof result.ssid!=='string')fail('STAND_DATA_UNCONFIRMED');
          publish({status:result.status,phase:null,error:null,standId:payload.expectedStandId||null});return {status:result.status,ssid:result.ssid};
        }
        if(migration&&result?.status==='reconnect-required'){
          const next=stamp(result,payload.expectedStandId);
          if(result.initialized!==true||result.ssid!==payload.ssid||result.view!==undefined||result.libraries!==undefined)fail('STAND_MIGRATION_UNCONFIRMED');
          resumeStandId=next.standId;
          publish({status:'reconnect-required',phase:null,error:null,...next});return {...next,status:'reconnect-required',ssid:result.ssid};
        }
        if(result?.status!=='connected')fail('STAND_CONNECTION_UNCONFIRMED');
        publish({phase:'load-stand'});return await accept(result,payload.expectedStandId,epoch);
      })();connectJob=job;
      try{return await job;}catch(error){
        if(epoch===generation&&!disposed){
          if(migration&&error?.code==='STAND_MIGRATION_CODE_UNCONFIRMED'&&id(payload.expectedStandId)){
            // Native has already durably retained the chosen code. This is
            // presentation only; resume still needs pinned proof + readback.
            resumeStandId=payload.expectedStandId;
            publish({status:'reconnect-required',phase:null,standId:resumeStandId,error:error.code});
          }else if(migration&&migrationStoreErrors.has(error?.code)&&previousInspection?.status==='migration-required'){
            // Keep the existing PIN screen, not a misleading sign-in screen.
            // No retry or code replay. Native repeats all identity/readback
            // checks on an explicit next attempt; fields are cleared by UI.
            inspected={...previousInspection,epoch};
            publish({status:'migration-required',phase:null,standId:payload.expectedStandId||null,error:error.code});
          }else publish({status:'offline',phase:null,error:error?.code||'STAND_CONNECTION_FAILED'});
        }
        throw error;
      }
      finally{if(!wifi&&!resume)payload.standCode='';if(connectJob===job)connectJob=null;arm();}
    }
    async function inspect(input){
      if(disposed)fail('STAND_CONNECTION_CLOSED');if(connectJob)fail('STAND_CONNECTION_BUSY');
      const request=inspectionInput(input),epoch=++generation;stopTimer();current=null;head=null;resumeStandId=null;inspected=null;
      publish({status:'checking',phase:'reach-main',error:null,standId:null});
      const job=(async()=>{
        if(typeof services.standInspect!=='function')fail('STAND_CONNECTION_UNAVAILABLE');
        const result=inspectionResult(await services.standInspect(request),request.ssid);
        if(epoch!==generation||disposed)fail('STAND_CONNECTION_CANCELLED');
        // Public readiness is not authentication. Never install a stand,
        // persist credentials, or accept mutations from this response.
        inspected={...result,epoch,...(request.expectedStandId===undefined?{}:{expectedStandId:request.expectedStandId})};
        publish({status:result.status,phase:null,error:null,standId:null});return result;
      })();connectJob=job;
      try{return await job;}catch(error){if(epoch===generation&&!disposed)publish({status:'offline',phase:null,error:error?.code||'STAND_CONNECTION_FAILED'});throw error;}
      finally{if(connectJob===job)connectJob=null;}
    }
    // The visible manual flow discovers the MAIN first. Never borrow an SSID
    // from a local stand, a hidden form field, a failed probe or a QR's identity
    // assertion. The following connect still performs its full native proof.
    function connectDetected(input,{migration=false}={}){
      if(!plain(input)||Object.keys(input).some(key=>!['standCode','expectedStandId','payload'].includes(key)))fail('STAND_CONNECTION_INVALID');
      if(!inspected||inspected.epoch!==generation||inspected.status!==(migration?'migration-required':'code-required'))fail('STAND_INSPECTION_REQUIRED');
      if(inspected.expectedStandId!==undefined&&input.expectedStandId!==undefined&&inspected.expectedStandId!==input.expectedStandId)fail('STAND_IDENTITY_UNCONFIRMED');
      const expectedStandId=input.expectedStandId??inspected.expectedStandId;
      return connect({ssid:inspected.ssid,standCode:input.standCode,...(expectedStandId===undefined?{}:{expectedStandId}),
        ...(input.payload===undefined?{}:{payload:input.payload})},{migration});
    }
    async function changeCode(input){
      if(disposed||!current)fail('STAND_NOT_CONNECTED');if(connectJob||pendingWrites||refreshJob)fail('STAND_CONNECTION_BUSY');
      const request=codeChangeInput(input);if(request.standId!==current.standId)fail('STAND_IDENTITY_UNCONFIRMED');
      const before=current,epoch=++generation;inspected=null;stopTimer();publish({status:'changing-code',phase:null,error:null});
      const job=(async()=>{
        if(typeof services.standCodeChange!=='function')fail('STAND_CONNECTION_UNAVAILABLE');
        const result=await services.standCodeChange(request);if(epoch!==generation||disposed)fail('STAND_CONNECTION_CANCELLED');
        const next=stamp(result,before.standId);
        if(result.status!=='reconnect-required'||result.initialized!==true||typeof result.ssid!=='string'||
           bytes(result.ssid)<1||bytes(result.ssid)>32||result.view!==undefined||result.libraries!==undefined)fail('STAND_CODE_CHANGE_UNCONFIRMED');
        current=null;head=null;resumeStandId=before.standId;
        publish({status:'reconnect-required',phase:null,error:null,...next});return {...next,status:'reconnect-required',ssid:result.ssid};
      })();connectJob=job;
      try{return await job;}catch(error){
        if(epoch===generation&&!disposed){
          if(error?.code==='STAND_CODE_CHANGE_UNCONFIRMED'){current=null;head=null;resumeStandId=before.standId;publish({status:'reconnect-required',phase:null,error:error.code,standId:before.standId});}
          else publish({status:'connected',phase:'connected',error:error?.code||'STAND_CODE_CHANGE_FAILED'});
        }throw error;
      }finally{request.currentCode='';request.newCode='';if(connectJob===job)connectJob=null;arm();}
    }
    function refresh(){
      if(disposed||!current)return Promise.reject(Object.assign(Error('Verbind eerst met je stand.'),{code:'STAND_NOT_CONNECTED'}));
      if(refreshJob)return refreshJob;
      const epoch=generation,before=copy(current),writeFence=writeQueue;stopTimer();
      const job=(async()=>{
        // Config writes and refresh cannot install two competing projections.
        await writeFence.catch(()=>{});if(epoch!==generation)fail('STAND_CONNECTION_CANCELLED');
        const projectionFence=captureProjectionFence(),readMetadata={readIntentGeneration:projectionFence,projectionCurrent:()=>epoch===generation&&!disposed};
        const result=await services.standRefresh(stamp(current));
        if(epoch!==generation||disposed)fail('STAND_CONNECTION_CANCELLED');
        const next=stamp(result,before.standId);
        if(result.status==='unchanged'){
          if(canonical(next)!==canonical(stamp(current))||canonical(next)!==canonical(head)||result.view!==undefined||result.libraries!==undefined)fail('STAND_DATA_UNCONFIRMED');
          await onUnchangedProjection(copy(current),readMetadata);
          if(epoch!==generation||disposed)fail('STAND_CONNECTION_CANCELLED');
          publish({status:'connected',phase:'connected',error:null});return fencedRead(current,readMetadata);
        }
        if(result.status!=='updated')fail('STAND_DATA_UNCONFIRMED');
        if(next.bootId===current.bootId&&(next.configRevision<current.configRevision||next.stateRevision<current.stateRevision))fail('STAND_REVISION_STALE');
        return fencedRead(await accept(result,before.standId,epoch,projectionFence),readMetadata);
      })();refreshJob=job;
      return job.catch(error=>{if(epoch===generation&&!disposed)publish({status:'offline',phase:null,error:error?.code||'STAND_REFRESH_FAILED'});throw error;}).finally(()=>{if(refreshJob===job)refreshJob=null;arm();});
    }
    function mutate({op,payload,transactionId,expectedRevision}={}){
      if(!current||disposed)return Promise.reject(Object.assign(Error('Verbind eerst met je stand.'),{code:'STAND_NOT_CONNECTED'}));
      if(paused||!visible())return Promise.reject(Object.assign(Error('Versturen is onderbroken.'),{code:'STAND_CONNECTION_CANCELLED'}));
      if(!['config','live'].includes(op)||!plain(payload)||expectedRevision!==undefined&&!revision(expectedRevision))return Promise.reject(Object.assign(Error('Ongeldige wijziging.'),{code:'STAND_MUTATION_INVALID'}));
      publicData(payload);const requestId=transactionId||idFactory();if(!id(requestId))fail('STAND_MUTATION_INVALID');
      const epoch=generation,standId=current.standId,data=copy(payload),readFence=refreshJob;pendingWrites++;publish({});
      const job=writeQueue.catch(()=>{}).then(async()=>{
        // A refresh already in flight finishes first. A later refresh waits
        // for this write instead; capturing fences prevents circular waits.
        if(readFence)await readFence.catch(()=>{});
        if(epoch!==generation||!current||current.standId!==standId)fail('STAND_CONNECTION_CANCELLED');
        const base=head.configRevision;
        if(expectedRevision!==undefined&&expectedRevision!==base)fail('STAND_CONFIG_CONFLICT');
        // One stable request ID, one attempt. Lost replies are reconciled by
        // reading; the UI does not regenerate a duplicate creation request.
        const result=await services.standMutation({standId,op,expectedRevision:base,payload:data,transactionId:requestId});
        if(epoch!==generation||disposed)fail('STAND_CONNECTION_CANCELLED');
        const next=stamp(result,standId);
        if(result.status!=='saved'||result.requestId!==requestId||next.bootId!==head.bootId||next.configRevision<base||next.stateRevision<head.stateRevision)fail('STAND_SAVE_UNCONFIRMED');
        if(result.view!==undefined)await accept(result,standId,epoch);
        else{head=next;publish({status:'connected',error:null,...next});}
        return {...next,status:'saved',requestId};
      });writeQueue=job;
      return job.catch(error=>{
        if(epoch===generation)publish({error:error?.code||'STAND_SAVE_UNCONFIRMED',status:error?.code==='STAND_CONFIG_CONFLICT'?'connected':'offline'});
        throw error;
      }).finally(()=>{pendingWrites--;publish({});arm();});
    }
    function resume(options={}){
      // User-initiated rejoining may request an OS prompt, but credentials and
      // receiver identity remain pinned natively. Foreground wake calls this
      // without options and must never implicitly prompt for a network join.
      const checked=resumeInput(options),known=current?.standId||resumeStandId;
      if(known&&checked.expectedStandId!==undefined&&checked.expectedStandId!==known)fail('STAND_IDENTITY_UNCONFIRMED');
      const expectedStandId=known||checked.expectedStandId;
      return connect({...checked,...(expectedStandId?{expectedStandId}:{})},{resume:true});
    }
    function openWifi(options={}){return connect(wifiInput(options),{wifi:true});}
    function acceptMembership(value){
      // This snapshot comes from the typed native membership service after
      // both physical receipt and central storage. Serialize its installation
      // with our own writes/reads; never rebuild it from the phone cache.
      if(disposed||!current||paused||!visible())return Promise.reject(Object.assign(Error('Open je stand opnieuw.'),{code:'STAND_NOT_CONNECTED'}));
      const data=copy(value),epoch=generation,standId=current.standId,bootId=current.bootId,read=refreshJob;
      projection(data,standId,current.ssid);pendingWrites++;publish({});stopTimer();
      const job=writeQueue.catch(()=>{}).then(async()=>{
        if(read)await read.catch(()=>{});
        const rotated=managementTransition(data.managementTransition,{...current,standId,bootId},data);
        if(disposed||paused||epoch!==generation||!current||current.standId!==standId||current.bootId!==bootId||(data.bootId!==bootId||data.managementTransition!==undefined)&&!rotated)fail('STAND_CONNECTION_CANCELLED');
        return accept(data,standId,epoch,captureProjectionFence());
      });writeQueue=job;
      return job.finally(()=>{pendingWrites--;publish({});arm();});
    }
    function prepareLive(){
      if(liveReadyJob)return liveReadyJob;
      if(disposed||paused||!visible()||!current&&!resumeStandId)return Promise.reject(Object.assign(Error('Open je stand opnieuw.'),{code:'STAND_NOT_CONNECTED'}));
      const epoch=generation,pinned=current?copy(current):null,expected=pinned?.standId||resumeStandId;
      const task=(async()=>{
        if(pinned){
          if(typeof services.standSessionStatus!=='function')fail('STAND_CONNECTION_UNAVAILABLE');
          const native=sessionStatus(await services.standSessionStatus());
          if(disposed||paused||epoch!==generation||!visible())fail('STAND_CONNECTION_CANCELLED');
          if(native.status==='connected'){
            if(native.standId!==pinned.standId||native.ssid!==pinned.ssid)fail('STAND_IDENTITY_UNCONFIRMED');
            return copy(current);
          }
        }
        // A new, not-yet-dispatched control may re-open only an explicitly
        // disconnected native session. wake retains the original pinned
        // stand, waits existing writes and performs a fresh native proof.
        // Never retry a failed control, OPEN, or mutation here.
        const result=await wake();
        if(disposed||paused||!visible())fail('STAND_CONNECTION_CANCELLED');
        if(!result||result.standId!==expected||pinned&&result.ssid!==pinned.ssid)fail('STAND_IDENTITY_UNCONFIRMED');
        return result;
      })();liveReadyJob=task;
      return task.finally(()=>{if(liveReadyJob===task)liveReadyJob=null;});
    }
    function pause(){
      paused=true;++generation;stopTimer();
      // Retire the presentation as well as the old result epoch. Otherwise a
      // cancelled first admission would leave `connecting` blocking all wakes.
      if(connectJob||refreshJob||wakeJob||pendingWrites)publish({status:'offline',phase:null,error:'STAND_CONNECTION_CANCELLED'});
    }
    function wake(){
      if(disposed||!visible())return Promise.resolve(null);
      if(connectJob)return connectJob;if(wakeJob)return wakeJob;
      paused=false;
      if(!current)return resumeStandId?resume():Promise.resolve(null);
      // Foreground is only a hint. Re-open stored access solely after the
      // native provider explicitly reports its transient channel disconnected.
      // No failed write, timeout or identity error is a reconnect proof.
      const epoch=generation,pinned=copy(current),writes=writeQueue,read=refreshJob;
      const task=(async()=>{
        await writes.catch(()=>{});if(read)await read.catch(()=>{});
        if(disposed||paused||epoch!==generation||!visible())fail('STAND_CONNECTION_CANCELLED');
        if(typeof services.standSessionStatus!=='function')return refresh();
        const native=sessionStatus(await services.standSessionStatus());
        if(disposed||paused||epoch!==generation||!visible())fail('STAND_CONNECTION_CANCELLED');
        if(native.status==='connected'){
          if(native.standId!==pinned.standId||native.ssid!==pinned.ssid)fail('STAND_IDENTITY_UNCONFIRMED');
          return refresh();
        }
        ++generation;resumeStandId=pinned.standId;current=null;head=null;inspected=null;stopTimer();
        publish({status:'reconnect-required',phase:null,error:null,standId:resumeStandId});
        return resume();
      })();wakeJob=task;
      return task.catch(error=>{if(epoch===generation&&!disposed&&!paused)publish({status:'offline',phase:null,error:error?.code||'STAND_REFRESH_FAILED'});throw error;})
        .finally(()=>{if(wakeJob===task)wakeJob=null;arm();});
    }
    async function disconnect(){
      ++generation;current=null;head=null;resumeStandId=null;inspected=null;stopTimer();publish({status:'disconnected',phase:null,standId:null,error:null});
      if(typeof services.standDisconnect==='function')await services.standDisconnect({});
    }
    function dispose(){disposed=true;++generation;current=null;head=null;resumeStandId=null;inspected=null;stopTimer();}
    return Object.freeze({connect,connectDetected:input=>connectDetected(input),inspect,changeCode,migrate:input=>connect(input,{migration:true}),migrateDetected:input=>connectDetected(input,{migration:true}),resume,openWifi,refresh,mutate,acceptMembership,prepareLive,pause,wake,disconnect,dispose,canResume:()=>!!resumeStandId,
      snapshot:()=>current?copy(current):null,state:()=>copy(state)});
  }
  return Object.freeze({connectionInput,resumeInput,resumeIntent,wifiInput,inspectionInput,inspectionResult,sessionStatus,codeChangeInput,newCode,suggestCode,projection,managementTransition,entities,changes,encodeOperations,create,readFence:result=>readFences.get(result),MAX_BYTES,MAX_ENTITIES,POLL_MS});
});
