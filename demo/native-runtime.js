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
  const actions=new Set(['capabilities','securityPreference','securityStatus','setPinProtection','discover','discoverMesh','select','secure','reconcileSecurity','finalize','verifyFinalReceipt','loadView','saveDraft','parkDraft','resumeDraft','publishModel','editZones','configureOutputs','previewPixels','eraseAppData','applyLive','applyLiveBatch','otaPlan','otaStart','otaStatus','otaResume','otaCancel','removalPlan','removalStart','removalResume','identify','identifyCandidate','identifyFactoryMain']);
  actions.add('outputConfigurationStatus');
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
        if(pending.has(id)&&!['capabilities','loadView','saveDraft','parkDraft','resumeDraft','publishModel','editZones'].includes(action))try{handler.postMessage({version:1,id:'v30-'+documentId+'-'+(++serial),action:action==='discover'?'cancelDiscover':'cancelOnboarding',payload:{requestId:id}});}catch(_){}
      },abort=()=>{
        cancelNative();
        receive({id,ok:false,code:'CANCELLED'});
      };
      // MAIN verification has its own 12 s handshake deadline. The bridge must
      // leave room for native key storage and delivering that bounded result.
      const timeout=action==='applyLiveBatch'?30000:action==='applyLive'?20000:action==='configureOutputs'?90000:['discoverMesh','securityStatus','setPinProtection'].includes(action)?30000:
        ['secure','reconcileSecurity'].includes(action)&&payload.configuration?.role==='node'?120000:
        ['select','secure','reconcileSecurity','finalize','otaPlan','removalPlan','removalStart','removalResume','identify','identifyCandidate','identifyFactoryMain'].includes(action)?45000:12000;
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
  function moveDraft(action,payload){
    const next=writeQueue.catch(()=>{}).then(async()=>{
      if(!viewLoaded)throw fail('VIEW_NOT_LOADED');
      const previousModel=viewModelKey,revision=viewRevision;
      const matches=view=>view?.model&&canonical(view.model)===previousModel&&[revision,revision+1].includes(view.revision)&&
        (action==='parkDraft'?view.draft===null:view.draft===null||view.draft.receiver===null||
          view.draft.stand?.id===payload.standId&&view.draft.receiver.id===payload.receiverId&&view.draft.receiver.rid===payload.rid&&
          (!payload.fingerprint||view.draft.receiver.deviceFingerprint===payload.fingerprint));
      try{
        const view=await call(action,{...payload,expectedRevision:revision});
        if(!matches(view))throw fail('VIEW_INVALID');
        return acceptView(view);
      }catch(error){
        // A local CAS may have committed before its reply was lost. Recover
        // only the exact result, never replay a receiver claim or mutation.
        try{const view=acceptView(await call('loadView'));if(view.revision===revision+1&&matches(view))return view;}catch(_){}
        throw error;
      }
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
            !(['delete','rename','assign','layout','reorder'].includes(kind)||kind==='create'&&Object.prototype.hasOwnProperty.call(payload.operation,'receiverId')))
            throw fail('V30_CHECKPOINT_CONFLICT');
          const checked=root.LightningOnboardingDraft?.refreshZones(previousDraft,JSON.parse(viewModelKey));
          if(!checked||checked.error||canonical(checked.draft)!==viewDraftKey)throw fail('VIEW_INVALID');
          // A setup edit has a deliberately narrow graph result. Compare the
          // confirmed reply against that exact metadata edit as well as the
          // refreshed draft; a different MAIN/fingerprint/output is no success.
          const Model=root.LightningModel,cached=JSON.parse(viewModelKey),op=payload.operation;
          if(!Model)throw fail('VIEW_INVALID');
          const stand=cached.stands?.find(item=>item.id===standId),receiver=cached.receivers?.find(item=>item.id===op.receiverId);
          if(['delete','rename','layout','reorder'].includes(kind)?!stand?.zones.some(zone=>zone.id===op.zoneId):receiver?.standId!==standId||kind==='assign'&&op.zoneId!==null&&!stand?.zones.some(zone=>zone.id===op.zoneId))throw fail('V30_CHECKPOINT_CONFLICT');
          if(kind==='delete')expectedSetupModel=Model.deleteZone(cached,op.zoneId);
          else if(kind==='rename')expectedSetupModel=Model.renameZone(cached,op.zoneId,op.name);
          else if(kind==='layout')expectedSetupModel=Model.setLayout(cached,op.zoneId,op.layout);
          else if(kind==='reorder')expectedSetupModel=Model.reorderReceivers(cached,op.zoneId,op.receiverIds);
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
  function configureOutputs(request){
    const validId=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value);
    if(!request||typeof request!=='object'||Array.isArray(request)||Object.keys(request).some(key=>!['standId','receiverId','outputs','expectedRevision'].includes(key))||
      !validId(request.standId)||!validId(request.receiverId)||request.expectedRevision!==undefined&&(!Number.isSafeInteger(request.expectedRevision)||request.expectedRevision<0)||
      !Array.isArray(request.outputs)||request.outputs.length!==4||!request.outputs.every((port,index)=>port&&Object.keys(port).sort().join(',')==='enabled,pixels,port,reversed'&&port.port===index+1&&typeof port.enabled==='boolean'&&typeof port.reversed==='boolean'&&Number.isInteger(port.pixels)&&port.pixels>=1&&port.pixels<=163)||!request.outputs.some(port=>port.enabled))return Promise.reject(fail('OUTPUT_CONFIGURATION_INVALID'));
    const {standId,receiverId,expectedRevision}=request,outputs=request.outputs.map(port=>({...port,pixels:port.enabled?port.pixels:1,reversed:port.enabled&&port.reversed}));
    const next=writeQueue.catch(()=>{}).then(async()=>{
      if(!viewLoaded)throw fail('VIEW_NOT_LOADED');
      const previousDraft=JSON.parse(viewDraftKey);
      if(expectedRevision!==undefined&&expectedRevision!==viewRevision)throw fail('V30_CHECKPOINT_CONFLICT');
      if(previousDraft!==null){
        if(previousDraft.stand?.id!==standId||previousDraft.receiver!==null||previousDraft.cancelled!==false||
          previousDraft.security?.status!=='not-started'||previousDraft.security?.phase!=='idle'||!['zones','receiver'].includes(previousDraft.stage))throw fail('V30_CHECKPOINT_CONFLICT');
        const checked=root.LightningOnboardingDraft?.refreshZones(previousDraft,JSON.parse(viewModelKey));
        if(!checked||checked.error||canonical(checked.draft)!==viewDraftKey)throw fail('VIEW_INVALID');
      }
      const revision=viewRevision,expected=JSON.parse(viewModelKey),receiver=expected.receivers?.find(item=>item.id===receiverId&&item.standId===standId&&item.type==='SPI'&&item.lifecycle==='added');
      if(!receiver)throw fail('OUTPUT_CONFIGURATION_PROFILE');
      receiver.outputs=outputs;
      const refreshed=previousDraft===null?null:root.LightningOnboardingDraft?.refreshZones(previousDraft,expected);
      if(previousDraft!==null&&(!refreshed||refreshed.error))throw fail('VIEW_INVALID');
      const expectedDraft=refreshed?.draft||null;
      const unchanged=canonical(expected)===viewModelKey&&canonical(expectedDraft)===viewDraftKey;
      const matches=view=>canonical(view?.draft)===canonical(expectedDraft)&&(view?.revision===revision+1||unchanged&&view?.revision===revision)&&canonical(view.model)===canonical(expected);
      try{
        const view=await call('configureOutputs',{standId,receiverId,outputs,expectedRevision:revision});
        if(!matches(view))throw fail('VIEW_INVALID');
        return acceptView(view);
      }catch(error){
        // The public geometry may have committed while journal cleanup failed.
        // A local view cannot prove that the native pending intent was closed;
        // retain the error and let an explicit same-configuration retry finish it.
        try{error.reconciledView=acceptView(await call('loadView'));}catch(_){}
        throw error;
      }
    });writeQueue=next;return next;
  }
  function livePayload({standId,receiverId,kind,brightness,transitionMs,channels,scene}={}){
    const validID=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(value);
    const byte=value=>Number.isInteger(value)&&value>=0&&value<=255;
    const full=['RGBW_SCENE','SPI_SCENE'].includes(kind);
    if(!validID(standId)||!validID(receiverId)||!['RGBW_STATIC','SPI_BRIGHTNESS','RGBW_SCENE','SPI_SCENE'].includes(kind)||
      !Number.isInteger(brightness)||brightness<0||brightness>100||!Number.isInteger(transitionMs)||transitionMs<0||transitionMs>750||
      !Array.isArray(channels)||(kind==='RGBW_STATIC'?channels.length!==4||!channels.every(byte):channels.length!==0)||full!==(scene!==undefined))throw fail('LIVE_INVALID');
    if(full){
      const keys=['engine','variant','palette','background','speed','smooth','backgroundBrightness','backgroundOn','motionReverse','widthPixels','spacing','objectCount','trailLength','spread','randomness','bounce','mirror','lineDelayMs'];
      const bounds={variant:[0,255],speed:[0,100],smooth:[0,100],backgroundBrightness:[0,100],widthPixels:[1,8192],spacing:[0,100],objectCount:[1,8],trailLength:[0,100],spread:[0,100],randomness:[0,100],lineDelayMs:[0,5000]};
      const colour=value=>Array.isArray(value)&&value.length===4&&value.every(byte);
      const extended=scene&&Object.prototype.hasOwnProperty.call(scene,'v30');
      if(!scene||typeof scene!=='object'||Array.isArray(scene)||Object.keys(scene).length!==keys.length+(extended?1:0)||!keys.every(key=>Object.prototype.hasOwnProperty.call(scene,key))||
        typeof scene.engine!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(scene.engine)||!colour(scene.background)||!Array.isArray(scene.palette)||scene.palette.length<1||scene.palette.length>(extended?7:4)||!scene.palette.every(colour)||
        !Object.entries(bounds).every(([key,[min,max]])=>Number.isInteger(scene[key])&&scene[key]>=min&&scene[key]<=max)||
        !['backgroundOn','motionReverse','bounce','mirror'].every(key=>typeof scene[key]==='boolean'))throw fail('LIVE_INVALID');
      if(extended){
        const v30=scene.v30,limits={effect:[1,kind==='SPI_SCENE'?30:20],fadeAmount:[0,100],width:[0,100],delayMs:[0,10000]};
        if(!v30||typeof v30!=='object'||Array.isArray(v30)||Object.keys(v30).sort().join(',')!=='brand,delayMs,effect,fadeAmount,width'||!colour(v30.brand)||
          !Object.entries(limits).every(([key,[min,max]])=>Number.isInteger(v30[key])&&v30[key]>=min&&v30[key]<=max))throw fail('LIVE_INVALID');
      }
    }
    return {standId,receiverId,kind,brightness,transitionMs,channels:[...channels],...(full?{scene:JSON.parse(JSON.stringify(scene))}:{})};
  }
  const services=Object.freeze(native?{
    connectionMode:'manual-wifi',
    async securityPreference({standId}){
      const result=await call('securityPreference',{standId});
      if(typeof result?.pinRequired!=='boolean')throw fail('PIN_MODE_UNCONFIRMED');
      return {pinRequired:result.pinRequired};
    },
    async securityStatus({standId}){
      await writeQueue.catch(()=>{});
      const result=await call('securityStatus',{standId});
      if(!['applied','reconnect-required'].includes(result?.status)||typeof result.pinRequired!=='boolean'||typeof result.hasPin!=='boolean'||!['installation','new-installation'].includes(result.scope))throw fail('PIN_MODE_UNCONFIRMED');
      return result;
    },
    async setPinProtection({standId,enabled,pin,confirmation}){
      if(typeof standId!=='string'||typeof enabled!=='boolean'||pin!==undefined&&(typeof pin!=='string'||!/^\d{8,12}$/.test(pin))||
        (enabled?confirmation!==undefined:confirmation!=='DISABLE_PIN'||pin!==undefined))throw fail('PIN_MODE_INVALID');
      await writeQueue.catch(()=>{});
      const result=await call('setPinProtection',{standId,enabled,...(pin===undefined?{}:{pin}),...(confirmation===undefined?{}:{confirmation})});
      if(!['applied','reconnect-required'].includes(result?.status)||result.pinRequired!==enabled||typeof result.hasPin!=='boolean'||!['installation','new-installation'].includes(result.scope))throw fail('PIN_MODE_UNCONFIRMED');
      return result;
    },
    async loadState(){return acceptView(await call('loadView'));},
    async persistDraft({draft}){return writeView('saveDraft',{draft});},
    async parkDraft({transactionId}){return moveDraft('parkDraft',{transactionId});},
    async resumeDraft({standId,receiverId,rid,fingerprint=null}){return moveDraft('resumeDraft',{standId,receiverId,rid,fingerprint});},
    async publishModel({model,configuration,receiptRef}){return writeView('publishModel',{model,configuration,receiptRef});},
    async editZones(request){return editZones(request);},
    async configureOutputs(request){return configureOutputs(request);},
    async outputConfigurationStatus({standId,receiverId}){
      if(root.__lightningV31OutputRecovery!==true)return {status:'none'};
      const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value);
      if(!id(standId)||!id(receiverId))throw fail('OUTPUT_CONFIGURATION_INVALID');
      await writeQueue.catch(()=>{});
      const result=await call('outputConfigurationStatus',{standId,receiverId});
      if(result?.status==='none'&&Object.keys(result).length===1)return {status:'none'};
      if(result?.status!=='pending'||Object.keys(result).sort().join(',')!=='outputs,status'||!Array.isArray(result.outputs)||result.outputs.length!==4||
        !result.outputs.every((port,index)=>port&&Object.keys(port).sort().join(',')==='enabled,pixels,port,reversed'&&port.port===index+1&&typeof port.enabled==='boolean'&&typeof port.reversed==='boolean'&&Number.isInteger(port.pixels)&&port.pixels>=1&&port.pixels<=163)||!result.outputs.some(port=>port.enabled))throw fail('OUTPUT_CONFIGURATION_UNCONFIRMED');
      return JSON.parse(JSON.stringify(result));
    },
    async previewPixels(request){
      if(!request||!['start','update','stop'].includes(request.action)||request.receiver?.type!=='SPI'||
        !Number.isInteger(request.port)||request.port<1||request.port>4||!Number.isInteger(request.pixels)||request.pixels<0||request.pixels>163)throw fail('PIXEL_PREVIEW_INVALID');
      const payload=JSON.parse(JSON.stringify(request));
      const answer=await call('previewPixels',payload);
      if(answer?.applied!==true||answer.port!==request.port||answer.pixels!==request.pixels||
        (request.action==='stop'?answer.previewTTLMS!==0:!Number.isInteger(answer.previewTTLMS)||answer.previewTTLMS<1||answer.previewTTLMS>15000))throw fail('PIXEL_PREVIEW_UNCONFIRMED');
      return answer;
    },
    async select({standId,transactionId,receiver}){return call('select',{standId,transactionId,receiver:{id:receiver.id,rid:receiver.rid,type:receiver.type}});},
    async secure({configuration,pin,signal}){return call('secure',{configuration,...(root.AluvisionSecurityMode?.pinRequired===false||configuration?.role==='node'?{}:{pin})},signal);},
    async reconcileSecurity({configuration,signal}){return call('reconcileSecurity',{configuration},signal);},
    async eraseAppData({confirmation}){
      if(confirmation!=='Alles verwijderen')throw fail('CONFIRMATION_REQUIRED');
      const next=writeQueue.catch(()=>{}).then(()=>call('eraseAppData',{confirmation}));writeQueue=next;
      const answer=await next;
      if(answer?.status!=='erased-local-only')throw fail('ERASE_UNCONFIRMED');
      viewRevision=0;viewLoaded=false;viewModelKey=null;viewDraftKey='null';
      return answer;
    },
    async applyLive(request){
      const payload=livePayload(request),{receiverId}=payload;
      await writeQueue.catch(()=>{});
      if(!viewLoaded)throw fail('VIEW_NOT_LOADED');
      const result=await call('applyLive',payload);
      if(result?.status!=='applied-in-firmware'||result.receiverId!==receiverId||!Number.isSafeInteger(result.generation)||result.generation<1)throw fail('LIVE_UNCONFIRMED');
      return {status:'applied-in-firmware',receiverId,generation:result.generation};
    },
    async applyLiveBatch({requests}={}){
      if(!Array.isArray(requests)||requests.length<1||requests.length>30||requests.some(request=>!request||typeof request!=='object'||Array.isArray(request)))throw fail('LIVE_INVALID');
      const payload=requests.map(livePayload),ids=new Set(payload.map(request=>request.receiverId));
      if(ids.size!==payload.length||payload.some(request=>request.standId!==payload[0].standId))throw fail('LIVE_INVALID');
      await writeQueue.catch(()=>{});
      if(!viewLoaded)throw fail('VIEW_NOT_LOADED');
      const answer=await call('applyLiveBatch',{requests:payload});
      if(answer?.status!=='batch-complete'||!Array.isArray(answer.results)||answer.results.length!==payload.length)throw fail('LIVE_UNCONFIRMED');
      const results=answer.results.map(result=>{
        if(!result||!ids.delete(result.receiverId))throw fail('LIVE_UNCONFIRMED');
        if(result.status==='applied-in-firmware'&&Number.isSafeInteger(result.generation)&&result.generation>=1)return {receiverId:result.receiverId,status:result.status,generation:result.generation};
        if(['unconfirmed','not-sent'].includes(result.status)&&typeof result.code==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(result.code))return {receiverId:result.receiverId,status:result.status,code:result.code};
        throw fail('LIVE_UNCONFIRMED');
      });
      return {status:'batch-complete',results};
    },
    async finalize({configuration,securityReceiptRef,signal}){return call('finalize',{configuration,securityReceiptRef},signal);},
    async verifyFinalReceipt({receiptRef,purpose,expected}){return call('verifyFinalReceipt',{receiptRef,purpose,expected});},
    async otaPlan({standId,receiverId}){return call('otaPlan',{standId,receiverId});},
    async otaStart({standId,receiverId,artifactId}){return call('otaStart',{standId,receiverId,artifactId});},
    async otaStatus({standId,receiverId,jobId}){return call('otaStatus',{standId,receiverId,jobId});},
    async otaResume({standId,receiverId,jobId}){return call('otaResume',{standId,receiverId,jobId});},
    async otaCancel({standId,receiverId,jobId}){return call('otaCancel',{standId,receiverId,jobId});},
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
    async identifyCandidate({standId,mainReceiverId,receiverId,rid,action,signal}){
      const validID=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(value);
      if(!validID(standId)||!validID(mainReceiverId)||receiverId!=='receiver-'+rid||!validID(receiverId)||!/^[A-F0-9]{16}$/.test(rid)||!['START','STOP'].includes(action))throw fail('IDENTIFY_INVALID');
      await writeQueue.catch(()=>{});
      if(!viewLoaded)throw fail('VIEW_NOT_LOADED');
      const result=await call('identifyCandidate',{standId,mainReceiverId,receiverId,rid,action},signal);
      if(result?.confirmed!==true||!Number.isInteger(result.ttlMs)||result.ttlMs<0||result.ttlMs>5000||(action==='START'?result.ttlMs===0:result.ttlMs!==0))throw fail('IDENTIFY_UNCONFIRMED');
      return {confirmed:true,ttlMs:result.ttlMs};
    },
    async identifyFactoryMain({standId,transactionId,receiverId,rid,type,action,signal}){
      const validID=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(value);
      if(!validID(standId)||!validID(transactionId)||receiverId!=='receiver-'+rid||!validID(receiverId)||!/^[A-F0-9]{16}$/.test(rid)||!['RGBW','SPI'].includes(type)||!['START','STOP'].includes(action))throw fail('IDENTIFY_INVALID');
      await writeQueue.catch(()=>{});
      if(!viewLoaded)throw fail('VIEW_NOT_LOADED');
      const result=await call('identifyFactoryMain',{standId,transactionId,receiverId,rid,type,action},signal);
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
