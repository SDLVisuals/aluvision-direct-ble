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
  const actions=new Set(['capabilities','securityPreference','securityStatus','setPinProtection','discover','discoverMesh','select','secure','reconcileSecurity','finalize','verifyFinalReceipt','loadView','saveDraft','parkDraft','resumeDraft','publishModel','editZones','configureOutputs','previewPixels','eraseAppData','applyLive','applyLiveBatch','otaPlan','otaStart','otaStatus','otaResume','otaCancel','otaMainRecoveryPlan','otaMainRecoveryStart','removalPlan','removalStart','removalResume','identify','identifyCandidate','identifyFactoryMain']);
  actions.add('outputConfigurationStatus');
  ['exportBackup','chooseBackup','importInstallationView','recoverInstallation'].forEach(action=>actions.add(action));
  ['receiverContextStatus','syncInstallationContext','interruptAutomaticContext'].forEach(action=>actions.add(action));
  actions.add('setAppearance');
  let appearanceTheme=null,appearanceRequest=null,appearanceSerial=0;
  const contextTimers=new Map(),contextEpochs=new Map(),contextJobs=new Map(),contextResumes=new Map();let contextQueue=Promise.resolve(),contextResetEpoch=0;
  // Public availability marker only: never a PIN, library, key or receiver
  // credential. An incomplete recovery must not make a fresh empty local
  // library the automatic cold-start/PIN replacement for its remote archive.
  const incompleteLibraryRecoveryKey='aluvision.v32.incomplete-library-recovery.v1',incompleteLibraryRecovery=new Set();
  let incompleteLibraryRecoveryStorageBlocked=false;
  let contextWriteBarrier=null;
  let viewRevision=0,viewLoaded=false,viewModelKey=null,viewDraftKey='null',writeQueue=Promise.resolve();
  let settledWriteQueue=writeQueue;
  const fail=code=>Object.assign(new Error('De verbinding is nog niet beschikbaar.'),{code});
  function receive(message,fromNative=false){
    if(!message||typeof message.id!=='string'||!pending.has(message.id))return;
    const request=pending.get(message.id);pending.delete(message.id);
    if(fromNative)request.automatic?.nativeFinished();
    root.clearTimeout(request.timer);request.removeAbort();
    if(message.ok===true&&message.result&&typeof message.result==='object')request.resolve(message.result);
    else request.reject(fail(typeof message.code==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(message.code)?message.code:'NATIVE_FAILED'));
  }
  function call(action,payload={},signal,automatic){
    if(!native||!transportReady)return Promise.reject(fail('NATIVE_UNAVAILABLE'));
    if(!documentId||!/^[A-F0-9]{32}$/.test(documentId))return Promise.reject(fail('NATIVE_DOCUMENT_UNAVAILABLE'));
    if(!actions.has(action))return Promise.reject(fail('ACTION_UNSUPPORTED'));
    if(signal?.aborted)return Promise.reject(fail('CANCELLED'));
    if(pending.size>=8)return Promise.reject(fail('NATIVE_BUSY'));
    return new Promise((resolve,reject)=>{
      const id='v30-'+documentId+'-'+(++serial),cancelNative=()=>{
        if(automatic){automatic.interrupt();return;}
        if(pending.has(id)&&!['interruptAutomaticContext','setAppearance','capabilities','loadView','saveDraft','parkDraft','resumeDraft','publishModel','editZones','exportBackup','chooseBackup','importInstallationView'].includes(action))try{handler.postMessage({version:1,id:'v30-'+documentId+'-'+(++serial),action:action==='discover'?'cancelDiscover':'cancelOnboarding',payload:{requestId:id}});}catch(_){}
      },abort=()=>{
        cancelNative();
        if(!automatic)receive({id,ok:false,code:'CANCELLED'});
      };
      // MAIN verification has its own 12 s handshake deadline. The bridge must
      // leave room for native key storage and delivering that bounded result.
      // A routed OTA plan also checks journal/security/topology. Its bounded
      // native checks may take up to 100s; let the read-only result arrive.
      // A cold SPI guide performs pinned MAIN/NODE proofs and may encounter a
      // retained proxy reply before its guide packet. This bounded allowance
      // cancels an uncertain operation once; it never retries that mutation.
      const timeout=['exportBackup','chooseBackup','recoverInstallation'].includes(action)?300000:action==='previewPixels'?45000:action==='syncInstallationContext'?180000:['otaPlan','otaMainRecoveryPlan'].includes(action)?120000:action==='applyLiveBatch'?30000:action==='applyLive'?20000:action==='configureOutputs'?90000:['discoverMesh','securityStatus','setPinProtection'].includes(action)?30000:
        ['secure','reconcileSecurity'].includes(action)&&payload.configuration?.role==='node'?120000:
        ['select','secure','reconcileSecurity','finalize','removalPlan','removalStart','removalResume','identify','identifyCandidate','identifyFactoryMain'].includes(action)?45000:12000;
      const timer=root.setTimeout(()=>{cancelNative();if(!automatic)receive({id,ok:false,code:'NATIVE_TIMEOUT'});},timeout);
      pending.set(id,{resolve,reject,timer,automatic,removeAbort:()=>signal?.removeEventListener('abort',abort)});
      automatic?.start(id,code=>receive({id,ok:false,code}));
      signal?.addEventListener('abort',abort,{once:true});
      try{handler.postMessage({version:1,id,action,payload});}
      catch(_){receive({id,ok:false,code:'NATIVE_UNAVAILABLE'});}
    });
  }
  if(native)Object.defineProperty(root,'__lightningV30Reply',{value:message=>receive(message,true),configurable:false,writable:false});
  function emptyModel(){return {schemaVersion:30,demo:false,stands:[],receivers:[],scenes:[],presets:[]};}
  function contextEvent(detail,epoch,reset,phase){
    if(typeof root.dispatchEvent==='function'&&typeof root.CustomEvent==='function')root.dispatchEvent(new root.CustomEvent('lightning:receiver-context',{
      detail:{...detail,contextGeneration:epoch,contextResetGeneration:reset,contextPhase:phase}}));
  }
  function registerContextWriteBarrier(barrier){
    if(typeof barrier!=='function'||contextWriteBarrier&&contextWriteBarrier!==barrier)throw fail('RECEIVER_CONTEXT_INVALID');
    contextWriteBarrier=barrier;
  }
  async function waitForContextWrite(standId,signal){
    if(!contextWriteBarrier)return;
    const controller=new AbortController();let timer,finished=false,succeeded=false,abort;
    const acquisition=Promise.resolve().then(()=>contextWriteBarrier({standId,signal:controller.signal})).then(ticket=>{
      if(ticket!==undefined&&(!ticket||typeof ticket.release!=='function'))throw fail('RECEIVER_CONTEXT_INVALID');
      // A timed-out/cancelled provider may still finish. It cannot leave LIVE
      // held, nor may its late acquisition start a receiver mutation.
      if(finished){ticket?.release();return;}
      return ticket;
    });
    try{
      const ticket=await Promise.race([acquisition,new Promise((_,reject)=>{
        abort=()=>{finished=true;controller.abort();reject(fail('CANCELLED'));};
        signal?.addEventListener('abort',abort,{once:true});
        timer=root.setTimeout(()=>{finished=true;controller.abort();reject(fail('RECEIVER_CONTEXT_BUSY'));},35000);
        if(signal?.aborted)abort();
      })]);succeeded=true;return ticket;
    }finally{finished=true;root.clearTimeout(timer);signal?.removeEventListener('abort',abort);if(!succeeded)controller.abort();}
  }
  function contextResult(result,standId){
    if(!result||result.standId!==standId||!['synced','pending'].includes(result.status)||!Number.isInteger(result.synced)||!Number.isInteger(result.total)||result.total<1||result.total>30||result.synced<0||result.synced>result.total||(result.status==='synced'&&(result.synced!==result.total||result.librariesComplete===false)))throw fail('RECEIVER_CONTEXT_UNCONFIRMED');
    return {standId,status:result.status,synced:result.synced,total:result.total,...(typeof result.librariesComplete==='boolean'?{librariesComplete:result.librariesComplete}:{})};
  }
  function automaticContextControl(standId){
    let requestId=null,settle,requested=false,interruption=null;
    const control={started:false,cleaned:false,
      start(id,finish){requestId=id;settle=finish;control.started=true;if(requested)control.interrupt();},
      nativeFinished(){control.cleaned=true;},
      interrupt(){
        requested=true;if(!requestId||interruption)return;
        // Post only after the original message turn. Request IDs bind one
        // document and one archive; no retry, owner reopening or metadata ACK.
        interruption=Promise.resolve().then(()=>call('interruptAutomaticContext',{standId,requestId})).then(result=>{
          if(!result||Object.keys(result).sort().join(',')!=='requestId,standId,status'||result.status!=='context-cleaned'||result.standId!==standId||result.requestId!==requestId)throw fail('RECEIVER_CONTEXT_CANCEL_UNCONFIRMED');
          control.cleaned=true;settle('CANCELLED');
        }).catch(()=>settle('RECEIVER_CONTEXT_CANCEL_UNCONFIRMED'));
      }
    };return control;
  }
  async function receiverContext(action,standId,current,signal,automatic=false){
    if(root.__lightningV32ReceiverContext!==true)throw fail('RECEIVER_CONTEXT_UNAVAILABLE');
    if(typeof standId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(standId))throw fail('RECEIVER_CONTEXT_INVALID');
    await writeQueue.catch(()=>{});
    if(signal?.aborted)throw fail('CANCELLED');
    if(current&&!current())throw fail('RECEIVER_CONTEXT_STALE');
    let ticket,control=automatic?automaticContextControl(standId):null;
    try{
      if(action==='syncInstallationContext'){
        // Hold one atomic idle lease through this single bounded native RPC.
        // New gestures still preview/coalesce, then dispatch after its finally.
        // No mutation is retried and the native foreground guard stays intact.
        ticket=await waitForContextWrite(standId,signal);
        await writeQueue.catch(()=>{});
        if(signal?.aborted)throw fail('CANCELLED');
        if(current&&!current())throw fail('RECEIVER_CONTEXT_STALE');
      }
      const libraries=typeof root.LightningInstallationLibraries?.capture==='function'?root.LightningInstallationLibraries.capture(standId):undefined;
      if(control)ticket?.onPendingLiveIntent?.(()=>control.interrupt());
      return contextResult(await call(action,{standId,...(libraries===undefined?{}:{libraries}),...(control?{automatic:true}:{})},signal,control),standId);
    }finally{
      // A local abort or timeout is not cleanup. An unconfirmed interrupt
      // deliberately retains the lease; later gestures cannot overlap radio.
      if(!control||!control.started||control.cleaned)ticket?.release();
    }
  }
  function scheduleContext(view,standId,{immediate=false,currentView}={}){
    if(root.__lightningV32ReceiverContext!==true||!view?.model?.receivers?.some(receiver=>receiver.standId===standId&&receiver.lifecycle==='added'))return view;
    root.clearTimeout(contextTimers.get(standId));
    const epoch=(contextEpochs.get(standId)||0)+1,reset=contextResetEpoch;
    contextEpochs.set(standId,epoch);contextJobs.set(standId,epoch);
    const owned=()=>contextEpochs.get(standId)===epoch&&contextResetEpoch===reset;
    const current=()=>owned()&&(!currentView||currentView());
    const finish=()=>{
      // A local write can invalidate this pinned snapshot without scheduling
      // a replacement epoch. Close its queued/writing UI state, but never
      // confirm the stale edit or overwrite a newer/reset generation.
      if(owned()&&currentView&&!currentView())contextEvent({standId,status:'pending'},epoch,reset,'complete');
      if(contextJobs.get(standId)===epoch)contextJobs.delete(standId);
    };
    contextEvent({standId,status:'pending'},epoch,reset,'queued');
    const enqueue=()=>{
      if(!current()){finish();return;}
      contextTimers.delete(standId);
      contextQueue=contextQueue.catch(()=>{}).then(async()=>{
        if(!current()){finish();return;}
        contextEvent({standId,status:'syncing'},epoch,reset,'writing');
        try{const result=await receiverContext('syncInstallationContext',standId,current,undefined,true);if(current())contextEvent(result,epoch,reset,'complete');}
        catch(_){if(current())contextEvent({standId,status:'pending'},epoch,reset,'complete');}
        finally{finish();}
      });
    };
    // A confirmed receiver addition is a discrete durable boundary. Launch its
    // archive from the current reply turn: a backgrounded WebKit document may
    // suspend its timers before the ordinary edit debounce can ever fire.
    // Libraries/continuous edits still coalesce, and reads never start radio.
    if(immediate)Promise.resolve().then(enqueue);
    else contextTimers.set(standId,root.setTimeout(enqueue,1400));
    return view;
  }
  function contextStandReady(standId){
    if(root.__lightningV32ReceiverContext!==true||!viewLoaded||viewDraftKey!=='null'||
      typeof standId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(standId))return false;
    const model=JSON.parse(viewModelKey);
    return model.stands?.some(stand=>stand.id===standId)&&model.receivers?.some(receiver=>receiver.standId===standId&&receiver.lifecycle==='added');
  }
  function libraryRecoveryMarker(){
    let storage;
    try{storage=root.localStorage;}catch(_){return null;}
    if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function'||typeof storage.removeItem!=='function')return null;
    try{
      const raw=storage.getItem(incompleteLibraryRecoveryKey);
      if(raw===null)return {storage,stands:new Set()};
      const ids=typeof raw==='string'&&raw.length<=2048?JSON.parse(raw):null;
      if(!Array.isArray(ids)||ids.length>20||ids.some(id=>typeof id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(id))||
        new Set(ids).size!==ids.length||JSON.stringify([...ids].sort())!==raw)throw fail('RECEIVER_CONTEXT_INVALID');
      return {storage,stands:new Set(ids)};
    }catch(_){incompleteLibraryRecoveryStorageBlocked=true;return null;}
  }
  function libraryRecoveryBlocked(standId){
    const marker=libraryRecoveryMarker();
    if(marker?.stands.has(standId))incompleteLibraryRecovery.add(standId);
    return incompleteLibraryRecoveryStorageBlocked||incompleteLibraryRecovery.has(standId);
  }
  function setLibraryRecoveryBlock(standId,blocked){
    if(blocked)incompleteLibraryRecovery.add(standId);
    const marker=libraryRecoveryMarker();
    if(!marker){if(!blocked&&!incompleteLibraryRecoveryStorageBlocked)incompleteLibraryRecovery.delete(standId);return;}
    if(blocked)marker.stands.add(standId);else marker.stands.delete(standId);
    try{
      if(marker.stands.size>20)throw fail('RECEIVER_CONTEXT_INVALID');
      const raw=marker.stands.size?JSON.stringify([...marker.stands].sort()):null;
      if(raw===null)marker.storage.removeItem(incompleteLibraryRecoveryKey);else marker.storage.setItem(incompleteLibraryRecoveryKey,raw);
      if(marker.storage.getItem(incompleteLibraryRecoveryKey)!==raw)throw fail('RECEIVER_CONTEXT_UNCONFIRMED');
      if(!blocked)incompleteLibraryRecovery.delete(standId);
    }catch(_){incompleteLibraryRecoveryStorageBlocked=true;}
  }
  function resumeContext(standId){
    if(contextResumes.has(standId))return contextResumes.get(standId);
    const resume=Promise.resolve().then(async()=>{
      if(!contextStandReady(standId)||writeQueue!==settledWriteQueue||contextJobs.has(standId)||libraryRecoveryBlocked(standId))return null;
      if(typeof root.LightningInstallationLibraries?.capture!=='function')throw fail('LIBRARIES_RECOVERY_UNAVAILABLE');
      const writes=writeQueue;await writes.catch(()=>{});
      if(writeQueue!==writes||!contextStandReady(standId)||contextJobs.has(standId))return null;
      const revision=viewRevision,model=viewModelKey,draft=viewDraftKey,reset=contextResetEpoch,epoch=contextEpochs.get(standId);
      const currentView=()=>writeQueue===writes&&viewRevision===revision&&viewModelKey===model&&viewDraftKey===draft&&
        contextResetEpoch===reset&&contextStandReady(standId)&&!libraryRecoveryBlocked(standId)&&typeof root.LightningInstallationLibraries?.capture==='function';
      const current=()=>currentView()&&contextEpochs.get(standId)===epoch&&!contextJobs.has(standId);
      // This first RPC is a local exact-desired ledger read, with current
      // libraries. Only its verified pending result may admit one archive.
      const result=await receiverContext('receiverContextStatus',standId,current);
      if(!current())return null;
      if(result.status==='pending')scheduleContext({model:JSON.parse(model)},standId,{immediate:true,currentView});
      return result;
    }).finally(()=>{if(contextResumes.get(standId)===resume)contextResumes.delete(standId);});
    contextResumes.set(standId,resume);return resume;
  }
  function trackWrite(next){
    // Observe settlement only; the original queue, returned promise and its
    // failures remain unchanged. Resume never enters a pending local write.
    writeQueue=next;
    const settled=()=>{if(writeQueue===next)settledWriteQueue=next;};
    next.then(settled,settled);return next;
  }
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
  function publicationModel(incoming,stored){
    if(!incoming||!Array.isArray(incoming.receivers)||!stored||!Array.isArray(stored.receivers))throw fail('VIEW_INVALID');
    const known=new Map(stored.receivers.map(receiver=>[receiver.id,receiver])),seen=new Set();
    const next={...incoming,receivers:incoming.receivers.map(receiver=>{
      const old=known.get(receiver?.id);
      if(!old)return receiver; // The new receiver remains subject to native final proof and full validation.
      if(seen.has(old.id))throw fail('V30_BINDING_INVALID');seen.add(old.id);
      // Colours/animations and observed connectivity belong to the visible
      // light model, not the neutral native membership journal. Preserve its
      // exact stored baseline, including legacy state, for existing receivers.
      // Every other field must still match: never conceal an identity, port,
      // zone, name, role or membership change behind this projection.
      const projected={...receiver,state:old.state,connection:old.connection};
      if(canonical(projected)!==canonical(old))throw fail('V30_BINDING_INVALID');
      return projected;
    })};
    if(seen.size!==known.size)throw fail('V30_BINDING_INVALID');
    return next;
  }
  function writeView(action,payload){
    // Capture publication intent before entering the serial write queue. The
    // UI may continue painting, but cannot change the graph being verified.
    if(action==='publishModel')payload=JSON.parse(JSON.stringify(payload));
    const next=writeQueue.catch(()=>{}).then(async()=>{
      if(!viewLoaded)throw fail('VIEW_NOT_LOADED');
      const publication=action==='publishModel',localModel=publication?canonical(payload.model):null;
      const sent=publication?{...payload,model:publicationModel(payload.model,JSON.parse(viewModelKey))}:payload;
      const previousModel=viewModelKey,requested=canonical(action==='saveDraft'?sent.draft:sent.model);
      // acceptView always retains the exact neutral native result. Only this
      // caller receives its unchanged local light overlay, and only after the
      // complete projected graph and finished draft have been acknowledged.
      const present=view=>publication?{...view,model:JSON.parse(localModel)}:view;
      try{
        const view=await call(action,{...sent,expectedRevision:viewRevision});
        if(publication&&(view?.draft!==null||canonical(view?.model)!==requested))throw fail('VIEW_INVALID');
        return present(acceptView(view));
      }
      catch(error){
        // A Keychain CAS can commit while its WebKit reply is lost. Re-read
        // local state only: never repeat a claim, finalize, or storage write.
        // A matching draft alone must not accept an unrelated changed model.
        try{
          const view=acceptView(await call('loadView'));
          if(action==='saveDraft'&&viewModelKey===previousModel&&canonical(view.draft)===requested)return view;
          if(publication&&view.draft===null&&viewModelKey===requested)return present(view);
        }catch(_){}
        throw error;
      }
    });return trackWrite(next);
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
    });return trackWrite(next);
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
    });return trackWrite(next);
  }
  function editZones(request){
    if(!request||typeof request!=='object'||Array.isArray(request))return Promise.reject(fail('ZONE_EDIT_INVALID'));
    const {standId,expectedRevision,operation,expectedZoneSignature}=request;
    // Snapshot the bounded operation before it enters the queue. Native CAS
    // uses the most recent accepted view. Callers may bind an explicit earlier
    // revision when their UI decision depends on that exact snapshot.
    const kinds={create:operation&&Object.prototype.hasOwnProperty.call(operation,'receiverId')?['kind','zoneId','name','receiverId']:['kind','zoneId','name'],rename:['kind','zoneId','name'],renameReceiver:['kind','receiverId','name'],delete:['kind','zoneId'],
      assign:['kind','receiverId','zoneId'],assignMany:['kind','receiverIds','zoneId'],reorder:['kind','zoneId','receiverIds'],layout:['kind','zoneId','layout'],arrange:['kind','zoneId','layout','receiverIds']};
    const fields=typeof operation?.kind==='string'&&Object.prototype.hasOwnProperty.call(kinds,operation.kind)?kinds[operation.kind]:null;
    const boundedId=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(value);
    if(typeof standId!=='string'||expectedRevision!==undefined&&(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)||!fields||
      !operation||typeof operation!=='object'||Array.isArray(operation)||
      operation.kind==='assignMany'&&(!Array.isArray(operation.receiverIds)||!operation.receiverIds.length||operation.receiverIds.length>128||
        operation.receiverIds.some(id=>!boundedId(id))||new Set(operation.receiverIds).size!==operation.receiverIds.length||
        !(operation.zoneId===null||boundedId(operation.zoneId)))||
      operation.kind==='arrange'&&(typeof expectedZoneSignature!=='string'||!boundedId(operation.zoneId)||
        !['stacked','vertical','continuous'].includes(operation.layout)||!Array.isArray(operation.receiverIds)||operation.receiverIds.length>128||
        Array.from(operation.receiverIds).some(id=>!boundedId(id))||new Set(operation.receiverIds).size!==operation.receiverIds.length)||
      expectedZoneSignature!==undefined&&(!['delete','rename','arrange'].includes(operation.kind)||typeof expectedZoneSignature!=='string'||expectedZoneSignature.length>16384)||
      Object.keys(operation).length!==fields.length||!fields.every(key=>Object.prototype.hasOwnProperty.call(operation,key)))return Promise.reject(fail('ZONE_EDIT_INVALID'));
    let payload;
    try{payload={standId,operation:JSON.parse(JSON.stringify(operation))};}catch(_){return Promise.reject(fail('ZONE_EDIT_INVALID'));}
    const next=writeQueue.catch(()=>{}).then(async()=>{
      if(!viewLoaded)throw fail('VIEW_NOT_LOADED');
      if(expectedRevision!==undefined&&expectedRevision!==viewRevision)throw fail('V30_CHECKPOINT_CONFLICT');
      const revision=viewRevision,previousDraft=JSON.parse(viewDraftKey);
      let expectedSetupModel=null,expectedArrangementModel=null;
      if(payload.operation.kind==='assignMany'){
        const op=payload.operation,Model=root.LightningModel,cached=JSON.parse(viewModelKey),stand=cached.stands?.find(item=>item.id===standId);
        if(!Model||!stand||op.receiverIds.some(id=>!cached.receivers?.some(item=>item.id===id&&item.standId===standId&&item.lifecycle==='added'))||
          op.zoneId!==null&&!stand.zones.some(zone=>zone.id===op.zoneId))throw fail('V30_CHECKPOINT_CONFLICT');
        try{Model.moveReceivers(cached,op.receiverIds,op.zoneId);}catch(_){throw fail('ZONE_EDIT_INVALID');}
      }
      try{
        // Bind the visible draft to the full accepted arrangement after any
        // earlier queued write. Native CAS then protects the durable commit.
        // Old delete/rename callers retain their existing four-field guard.
        if(expectedZoneSignature!==undefined){
          const cached=JSON.parse(viewModelKey),zone=cached.stands?.find(stand=>stand.id===standId)?.zones?.find(zone=>zone.id===payload.operation.zoneId);
          const signature=zone&&[zone.id,zone.name,zone.type,zone.receiverIds];
          if(signature&&payload.operation.kind==='arrange')signature.push(zone.layout);
          if(!zone||JSON.stringify(signature)!==expectedZoneSignature)throw fail('V30_CHECKPOINT_CONFLICT');
        }
        if(payload.operation.kind==='arrange'){
          const op=payload.operation,Model=root.LightningModel,cached=JSON.parse(viewModelKey),stand=cached.stands?.find(item=>item.id===standId);
          if(!Model||!stand?.zones.some(zone=>zone.id===op.zoneId))throw fail('V30_CHECKPOINT_CONFLICT');
          try{expectedArrangementModel=Model.arrangeZone(cached,op.zoneId,{layout:op.layout,receiverIds:op.receiverIds});}catch(_){throw fail('ZONE_EDIT_INVALID');}
        }
        if(previousDraft!==null){
          const kind=payload.operation.kind;
          if(previousDraft.stand?.id!==standId||previousDraft.receiver!==null||previousDraft.cancelled!==false||
            previousDraft.security?.status!=='not-started'||previousDraft.security?.phase!=='idle'||
            !['zones','receiver'].includes(previousDraft.stage)||
            !(['delete','rename','assign','assignMany','layout','reorder','arrange'].includes(kind)||kind==='create'&&Object.prototype.hasOwnProperty.call(payload.operation,'receiverId')))
            throw fail('V30_CHECKPOINT_CONFLICT');
          const checked=root.LightningOnboardingDraft?.refreshZones(previousDraft,JSON.parse(viewModelKey));
          if(!checked||checked.error||canonical(checked.draft)!==viewDraftKey)throw fail('VIEW_INVALID');
          // A setup edit has a deliberately narrow graph result. Compare the
          // confirmed reply against that exact metadata edit as well as the
          // refreshed draft; a different MAIN/fingerprint/output is no success.
          const Model=root.LightningModel,cached=JSON.parse(viewModelKey),op=payload.operation;
          if(!Model)throw fail('VIEW_INVALID');
          const stand=cached.stands?.find(item=>item.id===standId),receiver=cached.receivers?.find(item=>item.id===op.receiverId);
          if(['delete','rename','layout','reorder','arrange'].includes(kind)&&!stand?.zones.some(zone=>zone.id===op.zoneId))throw fail('V30_CHECKPOINT_CONFLICT');
          if(kind==='assign'&&(receiver?.standId!==standId||op.zoneId!==null&&!stand?.zones.some(zone=>zone.id===op.zoneId)))throw fail('V30_CHECKPOINT_CONFLICT');
          if(kind==='assignMany'&&(!stand||!Array.isArray(op.receiverIds)||!op.receiverIds.length||op.receiverIds.length>128||
            op.receiverIds.some(id=>typeof id!=='string'||!cached.receivers?.some(item=>item.id===id&&item.standId===standId&&item.lifecycle==='added'))||
            new Set(op.receiverIds).size!==op.receiverIds.length||op.zoneId!==null&&!stand?.zones.some(zone=>zone.id===op.zoneId)))throw fail('V30_CHECKPOINT_CONFLICT');
          if(kind==='delete')expectedSetupModel=Model.deleteZone(cached,op.zoneId);
          else if(kind==='rename')expectedSetupModel=Model.renameZone(cached,op.zoneId,op.name);
          else if(kind==='layout')expectedSetupModel=Model.setLayout(cached,op.zoneId,op.layout);
          else if(kind==='reorder')expectedSetupModel=Model.reorderReceivers(cached,op.zoneId,op.receiverIds);
          else if(kind==='arrange')expectedSetupModel=expectedArrangementModel;
          else if(kind==='assignMany')expectedSetupModel=Model.moveReceivers(cached,op.receiverIds,op.zoneId);
          else {
            const base=kind==='create'?Model.createZone(cached,standId,{id:op.zoneId,name:op.name}):cached;
            expectedSetupModel=op.zoneId===null?Model.unassignReceiver(base,op.receiverId):Model.assignReceiverToZone(base,op.receiverId,op.zoneId);
          }
        }
        const view=await call('editZones',{...payload,expectedRevision:revision});
        if(expectedArrangementModel&&canonical(view?.model)!==canonical(expectedArrangementModel))throw fail('VIEW_INVALID');
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
    });return trackWrite(next);
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
    });return trackWrite(next);
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
      const phased=scene&&(Object.prototype.hasOwnProperty.call(scene,'phaseMs')||Object.prototype.hasOwnProperty.call(scene,'phaseRateMicroHz'));
      if(!scene||typeof scene!=='object'||Array.isArray(scene)||Object.keys(scene).length!==keys.length+(extended?1:0)+(phased?2:0)||!keys.every(key=>Object.prototype.hasOwnProperty.call(scene,key))||
        typeof scene.engine!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(scene.engine)||!colour(scene.background)||!Array.isArray(scene.palette)||scene.palette.length<1||scene.palette.length>(extended?7:4)||!scene.palette.every(colour)||
        !Object.entries(bounds).every(([key,[min,max]])=>Number.isInteger(scene[key])&&scene[key]>=min&&scene[key]<=max)||
        !['backgroundOn','motionReverse','bounce','mirror'].every(key=>typeof scene[key]==='boolean'))throw fail('LIVE_INVALID');
      // Keep the same bounded pair as V30LiveControlService. Legacy SPI effects
      // use it to resume a group's shared phase; RGBW and V30 effects do not.
      if(phased&&(kind!=='SPI_SCENE'||extended||!Number.isInteger(scene.phaseMs)||scene.phaseMs<0||scene.phaseMs>999||
        !Number.isInteger(scene.phaseRateMicroHz)||scene.phaseRateMicroHz<0||scene.phaseRateMicroHz>20000000))throw fail('LIVE_INVALID');
      if(extended){
        const v30=scene.v30,limits={effect:[1,kind==='SPI_SCENE'?43:20],fadeAmount:[0,100],width:[0,100],delayMs:[0,10000]};
        if(!v30||typeof v30!=='object'||Array.isArray(v30)||Object.keys(v30).sort().join(',')!=='brand,delayMs,effect,fadeAmount,width'||!colour(v30.brand)||
          !Object.entries(limits).every(([key,[min,max]])=>Number.isInteger(v30[key])&&v30[key]>=min&&v30[key]<=max))throw fail('LIVE_INVALID');
      }
    }
    return {standId,receiverId,kind,brightness,transitionMs,channels:[...channels],...(full?{scene:JSON.parse(JSON.stringify(scene))}:{})};
  }
  const serviceSet=native?{
    connectionMode:'manual-wifi',
    async setAppearance(request){
      if(root.__lightningV32Appearance!==true)throw fail('APPEARANCE_UNAVAILABLE');
      if(!request||Object.keys(request).length!==1||!['light','dark'].includes(request.theme))throw fail('APPEARANCE_INVALID');
      const {theme}=request;
      if(appearanceRequest?.theme===theme)return appearanceRequest.promise;
      if(!appearanceRequest&&appearanceTheme===theme)return {status:'applied-local',theme};
      const sequence=++appearanceSerial;
      const promise=call('setAppearance',{theme}).then(result=>{
        if(result?.status!=='applied-local'||result.theme!==theme)throw fail('APPEARANCE_UNCONFIRMED');
        if(sequence===appearanceSerial)appearanceTheme=theme;
        return result;
      }).finally(()=>{if(appearanceRequest?.sequence===sequence)appearanceRequest=null;});
      appearanceRequest={sequence,theme,promise};return promise;
    },
    async receiverContextStatus({standId}){return receiverContext('receiverContextStatus',standId);},
    scheduleInstallationContext({standId,immediate=false,reason}){
      if(!viewLoaded||typeof standId!=='string'||typeof immediate!=='boolean'||reason!==undefined&&reason!=='pin-confirmed')return;
      let currentView;
      if(reason==='pin-confirmed'){
        if(!contextStandReady(standId)||writeQueue!==settledWriteQueue||contextJobs.has(standId)||libraryRecoveryBlocked(standId)||
          typeof root.LightningInstallationLibraries?.capture!=='function')return;
        const writes=writeQueue,revision=viewRevision,model=viewModelKey,draft=viewDraftKey,reset=contextResetEpoch;
        currentView=()=>writeQueue===writes&&viewRevision===revision&&viewModelKey===model&&viewDraftKey===draft&&
          contextResetEpoch===reset&&contextStandReady(standId)&&!libraryRecoveryBlocked(standId)&&typeof root.LightningInstallationLibraries?.capture==='function';
      }
      scheduleContext({model:JSON.parse(viewModelKey)},standId,{immediate,currentView});
    },
    resumeInstallationContext({standId}){return resumeContext(standId);},
    async syncInstallationContext({standId,signal}){
      root.clearTimeout(contextTimers.get(standId));contextTimers.delete(standId);
      const epoch=(contextEpochs.get(standId)||0)+1,reset=contextResetEpoch;contextEpochs.set(standId,epoch);contextJobs.set(standId,epoch);
      const result=contextQueue.catch(()=>{}).then(async()=>{
        if(contextEpochs.get(standId)!==epoch||reset!==contextResetEpoch)throw fail('RECEIVER_CONTEXT_STALE');
        contextEvent({standId,status:'syncing'},epoch,reset,'writing');
        let result;
        try{result=await receiverContext('syncInstallationContext',standId,()=>contextEpochs.get(standId)===epoch&&reset===contextResetEpoch,signal);}
        catch(error){
          if(contextEpochs.get(standId)!==epoch||reset!==contextResetEpoch)throw fail('RECEIVER_CONTEXT_STALE');
          contextEvent({standId,status:'pending'},epoch,reset,'complete');throw error;
        }
        if(contextEpochs.get(standId)!==epoch||reset!==contextResetEpoch)throw fail('RECEIVER_CONTEXT_STALE');
        contextEvent(result,epoch,reset,'complete');
        return result;
      }).finally(()=>{if(contextJobs.get(standId)===epoch)contextJobs.delete(standId);});contextQueue=result;
      return result;
    },
    async recoverInstallation({pin,signal}){
      if(typeof pin!=='string'||!/^\d{8,12}$/.test(pin))throw fail('PIN_RECOVERY_INVALID');
      const next=writeQueue.catch(()=>{}).then(async()=>{
        const result=await call('recoverInstallation',{pin},signal);
        if(result?.status!=='restored'||typeof result.standId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(result.standId)||result.view?.model?.demo!==false||result.view?.draft!==null)throw fail('PIN_RECOVERY_UNCONFIRMED');
        if(result.lightStateComplete!==true||typeof root.LightningReceiverPlayback?.restore!=='function')throw fail('PLAYBACK_UNCONFIRMED');
        const playbackModel=root.LightningReceiverPlayback.restore(result.view.model,result.liveStatuses,{standId:result.standId});
        if(result.librariesComplete===true){
          if(typeof root.LightningInstallationLibraries?.restore!=='function')throw fail('LIBRARIES_RECOVERY_UNAVAILABLE');
          const stored=await root.LightningInstallationLibraries.restore(result.libraries,result.standId);
          if(stored?.restored!==true)throw fail('LIBRARIES_RECOVERY_UNCONFIRMED');
        }
        if(result.librariesComplete!==true)setLibraryRecoveryBlock(result.standId,true);
        const view=acceptView(result.view);
        if(result.librariesComplete===true)setLibraryRecoveryBlock(result.standId,false);
        return {status:'restored',standId:result.standId,view,playbackModel,librariesComplete:result.librariesComplete===true};
      });return trackWrite(next);
    },
    async exportBackup({name,json}){
      if(typeof name!=='string'||!/^[A-Za-z0-9._-]{1,100}\.json$/.test(name)||typeof json!=='string'||new TextEncoder().encode(json).length>4*1024*1024)throw fail('BACKUP_INVALID');
      const result=await call('exportBackup',{name,json});
      if(!['shared','cancelled'].includes(result?.status))throw fail('BACKUP_UNCONFIRMED');return result;
    },
    async chooseBackup(){
      const result=await call('chooseBackup');
      if(result?.status==='cancelled')return result;
      if(result?.status!=='selected'||typeof result.json!=='string'||new TextEncoder().encode(result.json).length>4*1024*1024)throw fail('BACKUP_INVALID');return result;
    },
    async importInstallationView({model,confirmation}){
      if(confirmation!=='RESTORE_LOCAL_SETTINGS'||!model||model.demo!==false)throw fail('BACKUP_INVALID');
      const snapshot=JSON.parse(JSON.stringify(model));
      const next=writeQueue.catch(()=>{}).then(async()=>{
        if(!viewLoaded)throw fail('VIEW_NOT_LOADED');
        const expectedRevision=viewRevision,previous=viewModelKey;
        const matches=view=>view?.draft===null&&canonical(view.model)===canonical(snapshot)&&Number.isSafeInteger(view.revision)&&view.revision>=expectedRevision&&view.revision<=expectedRevision+1&&(view.revision!==expectedRevision||canonical(snapshot)===previous);
        try{const view=await call('importInstallationView',{model:snapshot,confirmation,expectedRevision});if(!matches(view))throw fail('BACKUP_UNCONFIRMED');return acceptView(view);}
        catch(error){
          // A lost acknowledgement is reconciled read-only, never by replaying.
          try{const view=acceptView(await call('loadView'));
            if(matches(view))return view;
            error.reconciledView=view;error.unchanged=canonical(view.model)===previous&&view.revision===expectedRevision;
          }catch(_){}throw error;
        }
      });trackWrite(next);return next.then(view=>{for(const stand of view.model.stands)scheduleContext(view,stand.id);return view;});
    },
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
    async publishModel({model,configuration,receiptRef}){
      const reset=contextResetEpoch;
      return writeView('publishModel',{model,configuration,receiptRef}).then(view=>reset===contextResetEpoch?scheduleContext(view,configuration.standId,{immediate:true}):view);
    },
    async editZones(request){return editZones(request).then(view=>scheduleContext(view,request.standId));},
    async configureOutputs(request){return configureOutputs(request).then(view=>scheduleContext(view,request.standId));},
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
        !Number.isInteger(request.port)||request.port<1||request.port>4||!Number.isInteger(request.pixels)||request.pixels<0||request.pixels>163||
        request.guide!==undefined&&!['length','power'].includes(request.guide)||
        (request.guide==='power'?(request.pixels===0||typeof request.reversed!=='boolean'):request.reversed!==undefined))throw fail('PIXEL_PREVIEW_INVALID');
      const payload=JSON.parse(JSON.stringify(request));
      const answer=await call('previewPixels',payload);
      if(answer?.applied!==true||answer.port!==request.port||answer.pixels!==request.pixels||
        (request.action==='stop'?answer.previewTTLMS!==0:!Number.isInteger(answer.previewTTLMS)||answer.previewTTLMS<(request.pixels===0?0:1)||answer.previewTTLMS>15000)||
        request.guide==='power'&&(answer.guide!=='power'||answer.reversed!==request.reversed))throw fail('PIXEL_PREVIEW_UNCONFIRMED');
      return answer;
    },
    async select({standId,transactionId,receiver}){return call('select',{standId,transactionId,receiver:{id:receiver.id,rid:receiver.rid,type:receiver.type}});},
    async secure({configuration,pin,signal}){return call('secure',{configuration,...(root.AluvisionSecurityMode?.pinRequired===false||configuration?.role==='node'?{}:{pin})},signal);},
    async reconcileSecurity({configuration,signal}){return call('reconcileSecurity',{configuration},signal);},
    async eraseAppData({confirmation}){
      if(confirmation!=='Alles verwijderen')throw fail('CONFIRMATION_REQUIRED');
      contextTimers.forEach(timer=>root.clearTimeout(timer));contextTimers.clear();contextEpochs.clear();contextJobs.clear();contextResetEpoch++;
      const next=writeQueue.catch(()=>{}).then(()=>call('eraseAppData',{confirmation}));trackWrite(next);
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
    async otaMainRecoveryPlan({standId,receiverId}){return call('otaMainRecoveryPlan',{standId,receiverId});},
    async otaMainRecoveryStart({standId,receiverId,artifactId}){return call('otaMainRecoveryStart',{standId,receiverId,artifactId});},
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
  }:{};
  const services=Object.freeze(serviceSet);
  return Object.freeze({native,emptyModel,services,registerContextWriteBarrier,capabilities:()=>call('capabilities')});
});
