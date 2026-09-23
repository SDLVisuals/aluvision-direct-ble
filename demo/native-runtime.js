/* Actual V30 native boundary. No V21 bridge, simulated success or secret storage.
 * A discovery observation is reachability only, never ownership or membership.
 * Unsupported commissioning stays closed until the verified protocol is wired.
 */
(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory;
  else root.LightningNativeRuntime=factory(root);
})(typeof window==='object'?window:globalThis,function(root){
  'use strict';
  const handler=root.webkit?.messageHandlers?.lightningV30;
  // A missing/failed native injection must not turn an installed app into a
  // populated example stand. Local bundles stay empty and fail closed; only a
  // confirmed host plus the V30 handler may send native messages.
  const native=root.__lightningV30NativeHost===true||root.location?.protocol==='file:';
  const transportReady=root.__lightningV30NativeHost===true&&!!handler&&typeof handler.postMessage==='function';
  // Distinct document namespace prevents an already queued WebKit reply from
  // being consumed by a newly loaded page with a reset local sequence counter.
  let documentId=null;
  try{if(native&&typeof root.crypto?.randomUUID==='function')documentId=root.crypto.randomUUID().replace(/-/g,'').toUpperCase();}catch(_){}
  const pending=new Map();let serial=0;
  const actions=new Set(['capabilities','discover','discoverMesh','select','secure','reconcileSecurity','finalize','verifyFinalReceipt','loadView','saveDraft','publishModel','editZones','eraseAppData','applyLive','otaPlan','otaStart','otaStatus','otaResume','otaCancel','removalPlan','removalStart','removalResume','identify','identifyCandidate','identifyFactoryMain']);
  let viewRevision=0,viewLoaded=false,viewModelKey=null,viewDraftKey='null',writeQueue=Promise.resolve();
  const fail=code=>Object.assign(new Error('De verbinding is nog niet beschikbaar.'),{code});
  function receive(message){
    if(!message||typeof message.id!=='string'||!pending.has(message.id))return;
    const request=pending.get(message.id);pending.delete(message.id);
    root.clearTimeout(request.timer);request.removeAbort();
    if(message.ok===true&&message.result&&typeof message.result==='object')request.resolve(message.result);
    else request.reject(fail(typeof message.code==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(message.code)?message.code:'NATIVE_FAILED'));
  }
  function call(action,payload={},signal){
    if(!native||!transportReady)return Promise.reject(fail('NATIVE_UNAVAILABLE'));
    if(!documentId||!/^[A-F0-9]{32}$/.test(documentId))return Promise.reject(fail('NATIVE_DOCUMENT_UNAVAILABLE'));
    if(!actions.has(action))return Promise.reject(fail('ACTION_UNSUPPORTED'));
    if(signal?.aborted)return Promise.reject(fail('CANCELLED'));
    if(pending.size>=8)return Promise.reject(fail('NATIVE_BUSY'));
    return new Promise((resolve,reject)=>{
      const id='v30-'+documentId+'-'+(++serial),cancelNative=()=>{
        if(pending.has(id)&&!['capabilities','loadView','saveDraft','publishModel','editZones'].includes(action))try{handler.postMessage({version:1,id:'v30-'+documentId+'-'+(++serial),action:action==='discover'?'cancelDiscover':'cancelOnboarding',payload:{requestId:id}});}catch(_){}
      },abort=()=>{
        cancelNative();
        receive({id,ok:false,code:'CANCELLED'});
      };
      // MAIN verification has its own 12 s handshake deadline. The bridge must
      // leave room for native key storage and delivering that bounded result.
      const timeout=['discoverMesh','applyLive'].includes(action)?30000:
        ['secure','reconcileSecurity'].includes(action)&&payload.configuration?.role==='node'?120000:
        ['select','secure','reconcileSecurity','finalize','otaPlan','removalPlan','removalStart','removalResume','identify'].includes(action)?45000:12000;
      const timer=root.setTimeout(()=>{cancelNative();receive({id,ok:false,code:'NATIVE_TIMEOUT'});},timeout);
      pending.set(id,{resolve,reject,timer,removeAbort:()=>signal?.removeEventListener('abort',abort)});
      signal?.addEventListener('abort',abort,{once:true});
      try{handler.postMessage({version:1,id,action,payload});}
      catch(_){receive({id,ok:false,code:'NATIVE_UNAVAILABLE'});}
    });
  }
  if(native)Object.defineProperty(root,'__lightningV30Reply',{value:receive,configurable:false,writable:false});
  function emptyModel(){return {schemaVersion:30,demo:false,stands:[],receivers:[],scenes:[],presets:[]};}
  function canonical(value){
    if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
    if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
    return JSON.stringify(value);
  }
  function acceptView(view){
    if(!view||!Number.isSafeInteger(view.revision)||view.revision<viewRevision||!view.model||typeof view.model!=='object'||Array.isArray(view.model)||
      !(view.draft===null||(view.draft&&typeof view.draft==='object'&&!Array.isArray(view.draft))))throw fail('VIEW_INVALID');
    viewRevision=view.revision;viewModelKey=canonical(view.model);viewDraftKey=canonical(view.draft);viewLoaded=true;return view;
  }
  function writeView(action,payload){
    const next=writeQueue.catch(()=>{}).then(async()=>{
      if(!viewLoaded)throw fail('VIEW_NOT_LOADED');
      const previousModel=viewModelKey,requested=canonical(action==='saveDraft'?payload.draft:payload.model);
      try{return acceptView(await call(action,{...payload,expectedRevision:viewRevision}));}
      catch(error){
        // A Keychain CAS can commit while its WebKit reply is lost. Re-read
        // local state only: never repeat a claim, finalize, or storage write.
        // A matching draft alone must not accept an unrelated changed model.
        try{
          const view=acceptView(await call('loadView'));
          if(action==='saveDraft'&&viewModelKey===previousModel&&canonical(view.draft)===requested)return view;
          if(action==='publishModel'&&view.draft===null&&viewModelKey===requested)return view;
        }catch(_){}
        throw error;
      }
    });writeQueue=next;return next;
  }
  function removal(action,payload){
    // Serialize destructive model cleanup with ordinary local writes. Native
    // code remains the only source of release authority and the resulting graph.
    const next=writeQueue.catch(()=>{}).then(async()=>{
      if(!viewLoaded)throw fail('VIEW_NOT_LOADED');
      const result=await call(action,payload);
      if(result?.view)acceptView(result.view);
      else if(result?.status==='removed')throw fail('VIEW_INVALID');
      return result;
    });writeQueue=next;return next;
  }
  function editZones(request){
    if(!request||typeof request!=='object'||Array.isArray(request))return Promise.reject(fail('ZONE_EDIT_INVALID'));
    const {standId,expectedRevision,operation,expectedZoneSignature}=request;
    // Snapshot the bounded operation before it enters the queue. Native CAS
    // uses the most recent accepted view. Callers may bind an explicit earlier
    // revision when their UI decision depends on that exact snapshot.
    const kinds={create:operation&&Object.prototype.hasOwnProperty.call(operation,'receiverId')?['kind','zoneId','name','receiverId']:['kind','zoneId','name'],rename:['kind','zoneId','name'],renameReceiver:['kind','receiverId','name'],delete:['kind','zoneId'],
      assign:['kind','receiverId','zoneId'],reorder:['kind','zoneId','receiverIds'],layout:['kind','zoneId','layout']};
    const fields=typeof operation?.kind==='string'&&Object.prototype.hasOwnProperty.call(kinds,operation.kind)?kinds[operation.kind]:null;
    if(typeof standId!=='string'||expectedRevision!==undefined&&(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)||!fields||
      !operation||typeof operation!=='object'||Array.isArray(operation)||
      expectedZoneSignature!==undefined&&(!['delete','rename'].includes(operation.kind)||typeof expectedZoneSignature!=='string'||expectedZoneSignature.length>16384)||
      Object.keys(operation).length!==fields.length||!fields.every(key=>Object.prototype.hasOwnProperty.call(operation,key)))return Promise.reject(fail('ZONE_EDIT_INVALID'));
    let payload;
    try{payload={standId,operation:JSON.parse(JSON.stringify(operation))};}catch(_){return Promise.reject(fail('ZONE_EDIT_INVALID'));}
    const next=writeQueue.catch(()=>{}).then(async()=>{
      if(!viewLoaded)throw fail('VIEW_NOT_LOADED');
      if(expectedRevision!==undefined&&expectedRevision!==viewRevision)throw fail('V30_CHECKPOINT_CONFLICT');
      const revision=viewRevision,previousDraft=JSON.parse(viewDraftKey);
      let expectedSetupModel=null;
      try{
        if(previousDraft!==null){
          const kind=payload.operation.kind;
          if(previousDraft.stand?.id!==standId||previousDraft.receiver!==null||previousDraft.cancelled!==false||
            previousDraft.security?.status!=='not-started'||previousDraft.security?.phase!=='idle'||
            !['zones','receiver'].includes(previousDraft.stage)||
            !(['delete','rename','assign'].includes(kind)||kind==='create'&&Object.prototype.hasOwnProperty.call(payload.operation,'receiverId')))
            throw fail('V30_CHECKPOINT_CONFLICT');
          const checked=root.LightningOnboardingDraft?.refreshZones(previousDraft,JSON.parse(viewModelKey));
          if(!checked||checked.error||canonical(checked.draft)!==viewDraftKey)throw fail('VIEW_INVALID');
          // A setup edit has a deliberately narrow graph result. Compare the
          // confirmed reply against that exact metadata edit as well as the
          // refreshed draft; a different MAIN/fingerprint/output is no success.
          const Model=root.LightningModel,cached=JSON.parse(viewModelKey),op=payload.operation;
          if(!Model)throw fail('VIEW_INVALID');
          const stand=cached.stands?.find(item=>item.id===standId),receiver=cached.receivers?.find(item=>item.id===op.receiverId);
          if(['delete','rename'].includes(kind)?!stand?.zones.some(zone=>zone.id===op.zoneId):receiver?.standId!==standId||kind==='assign'&&op.zoneId!==null&&!stand?.zones.some(zone=>zone.id===op.zoneId))throw fail('V30_CHECKPOINT_CONFLICT');
          if(kind==='delete')expectedSetupModel=Model.deleteZone(cached,op.zoneId);
          else if(kind==='rename')expectedSetupModel=Model.renameZone(cached,op.zoneId,op.name);
          else {
            const base=kind==='create'?Model.createZone(cached,standId,{id:op.zoneId,name:op.name}):cached;
            expectedSetupModel=op.zoneId===null?Model.unassignReceiver(base,op.receiverId):Model.assignReceiverToZone(base,op.receiverId,op.zoneId);
          }
        }
        // The destructive confirmation names the exact visible zone/members.
        // Compare after preceding queued writes, then let native CAS protect
        // the gap between this snapshot and the actual durable mutation.
        if(expectedZoneSignature!==undefined){
          const cached=JSON.parse(viewModelKey),zone=cached.stands?.find(stand=>stand.id===standId)?.zones?.find(zone=>zone.id===payload.operation.zoneId);
          if(!zone||JSON.stringify([zone.id,zone.name,zone.type,zone.receiverIds])!==expectedZoneSignature)throw fail('V30_CHECKPOINT_CONFLICT');
        }
        const view=await call('editZones',{...payload,expectedRevision:revision});
        let expectedDraft=null;
        if(previousDraft!==null){
          if(canonical(view?.model)!==canonical(expectedSetupModel))throw fail('VIEW_INVALID');
          const refreshed=root.LightningOnboardingDraft?.refreshZones(previousDraft,view?.model);
          if(!refreshed||refreshed.error)throw fail('VIEW_INVALID');
          expectedDraft=refreshed.draft;
        }
        if(canonical(view?.draft)!==canonical(expectedDraft)||![revision,revision+1].includes(view?.revision)||
          view.revision===revision&&(canonical(view.model)!==viewModelKey||canonical(view.draft)!==viewDraftKey))throw fail('VIEW_INVALID');
        return acceptView(view);
      }catch(error){
        // A timed-out mutation might already be durable. Reconcile only; never
        // repeat it and never convert an uncertain reply into claimed success.
        try{error.reconciledView=acceptView(await call('loadView'));}catch(_){}
        throw error;
      }
    });writeQueue=next;return next;
  }
  const services=Object.freeze(native?{
    connectionMode:'manual-wifi',
    async loadState(){return acceptView(await call('loadView'));},
    async persistDraft({draft}){return writeView('saveDraft',{draft});},
    async publishModel({model,configuration,receiptRef}){return writeView('publishModel',{model,configuration,receiptRef});},
    async editZones(request){return editZones(request);},
    async select({standId,transactionId,receiver}){return call('select',{standId,transactionId,receiver:{id:receiver.id,rid:receiver.rid,type:receiver.type}});},
    async secure({configuration,pin}){return call('secure',{configuration,...(root.AluvisionSecurityMode?.pinRequired===false||configuration?.role==='node'?{}:{pin})});},
    async reconcileSecurity({configuration}){return call('reconcileSecurity',{configuration});},
    async eraseAppData({confirmation}){
      if(confirmation!=='Alles verwijderen')throw fail('CONFIRMATION_REQUIRED');
      const next=writeQueue.catch(()=>{}).then(()=>call('eraseAppData',{confirmation}));writeQueue=next;
      const answer=await next;
      if(answer?.status!=='erased-local-only')throw fail('ERASE_UNCONFIRMED');
      viewRevision=0;viewLoaded=false;viewModelKey=null;viewDraftKey='null';
      return answer;
    },
    async applyLive({standId,receiverId,kind,brightness,transitionMs,channels}){
      const validID=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(value);
      const byte=value=>Number.isInteger(value)&&value>=0&&value<=255;
      if(!validID(standId)||!validID(receiverId)||!['RGBW_STATIC','SPI_BRIGHTNESS'].includes(kind)||
        !Number.isInteger(brightness)||brightness<0||brightness>100||!Number.isInteger(transitionMs)||transitionMs<0||transitionMs>750||
        !Array.isArray(channels)||(kind==='RGBW_STATIC'?channels.length!==4||!channels.every(byte):channels.length!==0))throw fail('LIVE_INVALID');
      await writeQueue.catch(()=>{});
      if(!viewLoaded)throw fail('VIEW_NOT_LOADED');
      const result=await call('applyLive',{standId,receiverId,kind,brightness,transitionMs,channels:[...channels]});
      if(result?.status!=='applied-in-firmware'||result.receiverId!==receiverId||!Number.isSafeInteger(result.generation)||result.generation<1)throw fail('LIVE_UNCONFIRMED');
      return {status:'applied-in-firmware',receiverId,generation:result.generation};
    },
    async finalize({configuration,securityReceiptRef}){return call('finalize',{configuration,securityReceiptRef});},
    async verifyFinalReceipt({receiptRef,purpose,expected}){return call('verifyFinalReceipt',{receiptRef,purpose,expected});},
    async otaPlan({standId}){return call('otaPlan',{standId});},
    async otaStart({standId,artifactId}){return call('otaStart',{standId,artifactId});},
    async otaStatus({standId,jobId}){return call('otaStatus',{standId,jobId});},
    async otaResume({standId,jobId}){return call('otaResume',{standId,jobId});},
    async otaCancel({standId,jobId}){return call('otaCancel',{standId,jobId});},
    async removalPlan({standId,receiverId}){return removal('removalPlan',{standId,receiverId});},
    async removalStart({standId,receiverId,planId,pin}){return removal('removalStart',{standId,receiverId,planId,...(pin===undefined?{}:{pin})});},
    async removalResume({standId,receiverId,jobId,pin}){return removal('removalResume',{standId,receiverId,jobId,...(pin===undefined?{}:{pin})});},
    async identify({standId,receiverId,port,enabled}){
      if(!Number.isInteger(port)||port<0||port>4||typeof enabled!=='boolean'||typeof standId!=='string'||typeof receiverId!=='string')throw fail('IDENTIFY_INVALID');
      await writeQueue.catch(()=>{});
      if(!viewLoaded)throw fail('VIEW_NOT_LOADED');
      const result=await call('identify',{standId,receiverId,port,enabled});
      if(result?.confirmed!==true||!Number.isInteger(result.ttlMs)||result.ttlMs<0||result.ttlMs>5000||(enabled?result.ttlMs===0:result.ttlMs!==0))throw fail('IDENTIFY_UNCONFIRMED');
      return {confirmed:true,ttlMs:result.ttlMs};
    },
    async identifyCandidate({standId,mainReceiverId,receiverId,rid,action}){
      const validID=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(value);
      if(!validID(standId)||!validID(mainReceiverId)||receiverId!=='receiver-'+rid||!validID(receiverId)||!/^[A-F0-9]{16}$/.test(rid)||!['START','STOP'].includes(action))throw fail('IDENTIFY_INVALID');
      await writeQueue.catch(()=>{});
      if(!viewLoaded)throw fail('VIEW_NOT_LOADED');
      const result=await call('identifyCandidate',{standId,mainReceiverId,receiverId,rid,action});
      if(result?.confirmed!==true||!Number.isInteger(result.ttlMs)||result.ttlMs<0||result.ttlMs>5000||(action==='START'?result.ttlMs===0:result.ttlMs!==0))throw fail('IDENTIFY_UNCONFIRMED');
      return {confirmed:true,ttlMs:result.ttlMs};
    },
    async identifyFactoryMain({standId,transactionId,receiverId,rid,type,action}){
      const validID=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(value);
      if(!validID(standId)||!validID(transactionId)||receiverId!=='receiver-'+rid||!validID(receiverId)||!/^[A-F0-9]{16}$/.test(rid)||!['RGBW','SPI'].includes(type)||!['START','STOP'].includes(action))throw fail('IDENTIFY_INVALID');
      await writeQueue.catch(()=>{});
      if(!viewLoaded)throw fail('VIEW_NOT_LOADED');
      const result=await call('identifyFactoryMain',{standId,transactionId,receiverId,rid,type,action});
      if(result?.confirmed!==true||!Number.isInteger(result.ttlMs)||result.ttlMs<0||result.ttlMs>5000||(action==='START'?result.ttlMs===0:result.ttlMs!==0))throw fail('IDENTIFY_UNCONFIRMED');
      return {confirmed:true,ttlMs:result.ttlMs};
    },
    async search({standId,mainReceiverId,signal}={}){
      if(mainReceiverId!==undefined&&mainReceiverId!==null){
        // This names only the saved installation and its MAIN. Native resolves
        // the pinned gateway and owns the radio scan; no URL, keys or peer
        // credentials cross into the page. Never fall back to factory Wi-Fi.
        const validID=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(value);
        if(!validID(standId)||!validID(mainReceiverId))throw fail('DISCOVERY_INVALID');
        const response=await call('discoverMesh',{standId,mainReceiverId},signal);
        if(!Array.isArray(response.receivers)||response.receivers.length>64)throw fail('DISCOVERY_INVALID');
        const identities=new Set();
        const receivers=response.receivers.map(observation=>{
          if(!observation||typeof observation!=='object'||Array.isArray(observation)||
            !/^[A-F0-9]{16}$/.test(observation.rid)||/^0{16}$/.test(observation.rid)||
            observation.id!=='receiver-'+observation.rid||observation.id===mainReceiverId||
            !['SPI','RGBW'].includes(observation.type)||identities.has(observation.rid))throw fail('DISCOVERY_INVALID');
          identities.add(observation.rid);
          // An authenticated scan response from the MAIN is not yet proof of
          // the NODE's own device key. Only explicit select may establish it.
          return {id:observation.id,rid:observation.rid,type:observation.type,name:observation.type+'-receiver',
            deviceFingerprint:null,canConfigure:false,canVerifyIdentity:true,reachabilityOnly:true};
        });
        return {receivers};
      }
      const response=await call('discover',{},signal),observation=response.observation;
      if(!observation||observation.reachabilityOnly!==true||observation.identityAuthenticated!==false||
        !/^[A-F0-9]{16}$/.test(observation.receiverId)||!['SPI','RGBW'].includes(observation.receiverType))throw fail('DISCOVERY_INVALID');
      // Fingerprints are NOT synthesized from a MAC or RID. The authenticated
      // bootstrap will supply the real key fingerprint in a later protocol step.
      return {receivers:[{id:'receiver-'+observation.receiverId,rid:observation.receiverId,
        type:observation.receiverType,name:observation.receiverType+'-receiver',
        deviceFingerprint:null,canConfigure:false,canVerifyIdentity:response.canVerifyIdentity===true,reachabilityOnly:true,
        unavailableReason:'Receiver gevonden. Beveiligd toevoegen is in deze V30-bouw nog niet beschikbaar.'}]};
    }
  }:{});
  return Object.freeze({native,emptyModel,services,capabilities:()=>call('capabilities')});
});
