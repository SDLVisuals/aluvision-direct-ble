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
  let legacyStandAnimationsAvailable=null,standSessionAnimationsAvailable=null,atomicPreviewExitAvailable=false;
  let standSessionOutputsAvailable=false,standSessionReceiverManagementAvailable=false;
  let centralFlowEntered=false,standSessionObserved=false;
  let staticPreparingAvailable=null;
  let staticGestureAvailable=null;
  let standSessionStaticGestureAvailable=null;
  let spiPortScenesAvailable=null;
  let simpleStandAvailable=null,standMigrationReady=false,standMigrationBlockedReason='NONE',firstStandAccessDiagnosticsAvailable=false,standWifiOpenAvailable=false,standSharingAvailable=false,standScanAvailable=false,standLinkAvailable=false,standShareSheetAvailable=false,centralStamp=null;
  let standSharingEpoch=0,centralProjectionModel=null,managementPreparedStand=null;
  let centralConnectionAttempt=0,centralConnectionAttemptExhausted=false;
  root.document?.addEventListener?.('visibilitychange',()=>{if(root.document.hidden)standSharingEpoch++;});
  root.addEventListener?.('pagehide',()=>{standSharingEpoch++;});
  const actions=new Set(['capabilities','securityPreference','securityStatus','setPinProtection','discover','discoverMesh','select','secure','reconcileSecurity','finalize','verifyFinalReceipt','loadView','saveDraft','parkDraft','resumeDraft','publishModel','editZones','configureOutputs','previewPixels','eraseAppData','applyLive','applyLiveBatch','otaPlan','otaStart','otaStatus','otaResume','otaCancel','otaMainRecoveryPlan','otaMainRecoveryStart','removalPlan','removalStart','removalResume','identify','identifyCandidate','identifyFactoryMain']);
  actions.add('checkpointPreviewExit');
  actions.add('outputConfigurationStatus');
  actions.add('previewSPIZoneDirections');
  actions.add('configureOutputDirections');
  actions.add('prepareReceiverManagement');
  ['exportBackup','chooseBackup','importInstallationView','recoverInstallation'].forEach(action=>actions.add(action));
  ['receiverContextStatus','syncInstallationContext','interruptAutomaticContext'].forEach(action=>actions.add(action));
  actions.add('setAppearance');
  actions.add('selectionFeedback');
  actions.add('interfaceFeedback');
  ['standSessionStatus','standSessionShare','standInspect','standOpenWifi','standConnect','standMigrate','standResume','standRefresh','standMutation','standDisconnect','standForget','standCodeChange','shareStandWifi'].forEach(action=>actions.add(action));
  actions.add('standFirstAccessPreflight');
  actions.add('standFirstAccessDiagnosticFailure');
  actions.add('pixelReceiptDiagnostic692');
  ['prepareFirstPinV2','claimFirstPinV2','reconcileFirstPinV2','showFirstPinV2','firstPinV2Ready'].forEach(action=>actions.add(action));
  const firstAccessDiagnosticCodes=new Set(['OTHER','FIRST_ACCESS_IDENTITY','FIRST_ACCESS_STORAGE','FIRST_ACCESS_UNCONFIRMED','ACTION_UNSUPPORTED','NATIVE_UNAVAILABLE','NATIVE_DOCUMENT_UNAVAILABLE','NATIVE_BUSY','NATIVE_TIMEOUT','CANCELLED','TIMEOUT','LOCAL_NETWORK_DENIED','STAND_CONNECTION_CLOSED','STAND_CONNECTION_BUSY','STAND_CONNECTION_UNAVAILABLE','STAND_CONNECTION_INVALID','STAND_CONNECTION_CANCELLED','STAND_DATA_INVALID','STAND_DATA_UNCONFIRMED','STAND_INVALID_REQUEST','STAND_STORAGE_LIMIT','STAND_MIGRATION_INVALID','STAND_PREFLIGHT_INVALID','STAND_PREFLIGHT_UNCONFIRMED','STAND_PREFLIGHT_NOT_REQUIRED','STAND_MIGRATION_NOT_READY','STAND_RECEIVER_SAVED_ELSEWHERE','STAND_CURRENT_ACCESS_CONFLICT','STAND_UNAVAILABLE','STAND_WIFI_UNREACHABLE','STAND_WRONG_WIFI','STAND_BUSY','STAND_CANCELLED','STAND_IDENTITY_MISMATCH','STAND_AUTH_FAILED','STAND_UNCONFIRMED','STAND_CREDENTIAL_UNCONFIRMED']);
  ['scanStandShare','takeStandShareLink','shareStandLink'].forEach(action=>actions.add(action));
  let selectionHaptics=false,selectionFeedbackPending=false,interfaceHaptics=false,interfaceFeedbackPending=false,pixelPreviewV50=false,spiZoneDirectionPreview=false,pixelEditorIsolationAvailable=false,setupZoneIsolationAvailable=false;
  let pixelReceiptDiagnostics692=false;
  function pixelDiagnostic692(phase,bits){
    if(!pixelReceiptDiagnostics692||!['RUNTIME_EDITOR_RECEIPT','RUNTIME_PREVIEW_RECEIPT','STOP_RECEIPT','STOP_SUPERSEDED'].includes(phase)||!Number.isInteger(bits)||bits<0||bits>31)return;
    // Failure-only, local DEBUG Mac observation. Never awaited by control or
    // STOP, and never sends a request/reply object, target, ID or credential.
    void call('pixelReceiptDiagnostic692',{phase,bits}).catch(()=>{});
  }
  actions.add('supersedeLivePreparing');
  actions.add('yieldEarlyAnimation');
  actions.add('replacePreparingStatic');
  ['applyStaticGesture','updateStaticGesture','endStaticGesture'].forEach(action=>actions.add(action));
  actions.add('identifyLayout');actions.add('stopLayoutIdentification');actions.add('blinkLayoutIdentification');
  const layoutSessions=new Map();
  const layoutNow=()=>root.performance?.now?.()??Date.now();
  const pruneLayoutSessions=()=>{const now=layoutNow();for(const [id,s] of layoutSessions)if(s.closed&&s.retireAfter<=now)layoutSessions.delete(id);};
  const layoutId=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(value);
  const layoutUUID=value=>typeof value==='string'&&/^[A-Fa-f0-9]{8}(-[A-Fa-f0-9]{4}){3}-[A-Fa-f0-9]{12}$/.test(value)&&!/^0{8}(-0{4}){3}-0{12}$/.test(value);
  const layoutTextBytes=value=>Array.from(value).reduce((bytes,c)=>{const n=c.codePointAt(0);return bytes+(n<=0x7f?1:n<=0x7ff?2:n<=0xffff?3:4);},0);
  const layoutKeys=(value,names)=>value&&Object.getPrototypeOf(value)===Object.prototype&&Object.keys(value).sort().join(',')===names.slice().sort().join(',');
  // Optional DEBUG observation, never an acknowledgement or authority field.
  const spiDiagnosticPhases679=new Set(['BRIDGE_ADMISSION','PIXEL_STOP','SERVICE_ADMISSION','WITNESS','OWNER_OPEN','MAIN_IDENTITY','TARGET_IDENTITY','OUTPUT_STATUS','MAIN_BOOT','ROUND_BUDGET','SETUP_BEGIN','TEST','CONFIRMATION','APPLICATION_INACTIVE']);
  const spiDiagnosticCodes679=new Set(('NATIVE_UNCONFIRMED TASK_CANCELLED APPLICATION_INACTIVE '+
    'SPI_ZONE_DIRECTION_INVALID SPI_ZONE_DIRECTION_PROFILE SPI_ZONE_DIRECTION_UPDATE_REQUIRED SPI_ZONE_DIRECTION_UNCONFIRMED SPI_ZONE_DIRECTION_CANCELLED SPI_ZONE_DIRECTION_BUSY '+
    'OWNER_SESSION_UNAVAILABLE OWNER_SESSION_BUSY OWNER_REQUEST_INVALID OWNER_REPLY_INVALID OWNER_SESSION_CANCELLED OWNER_SESSION_DEADLINE OWNER_EXCHANGE_UNCERTAIN '+
    'TRUST_INVALID_TARGET TRUST_INVALID_KEY TRUST_BUSY TRUST_CANCELLED TRUST_DEADLINE TRUST_UNAVAILABLE TRUST_LOCAL_NETWORK_DENIED TRUST_TRANSPORT TRUST_REPLY TRUST_IDENTITY TRUST_WRONG_RECEIVER_NETWORK TRUST_SIGNATURE TRUST_SERVER_FINISH '+
    'TRUST_TRANSPORT_REQUEST TRUST_TRANSPORT_REPLY TRUST_TRANSPORT_IDENTITY TRUST_TRANSPORT_WRONG_RECEIVER_NETWORK TRUST_TRANSPORT_BUSY TRUST_TRANSPORT_DEADLINE TRUST_TRANSPORT_CANCELLED TRUST_TRANSPORT_UNAVAILABLE TRUST_TRANSPORT_LOCAL_NETWORK_DENIED '+
    'MAIN_CONFIGURATION_INVALID MAIN_PROTOCOL_UNSUPPORTED MAIN_BUSY MAIN_CANCELLED MAIN_IDENTITY_UNCONFIRMED MAIN_CONNECTION_UNAVAILABLE MAIN_MANAGEMENT_REFUSED MAIN_WRONG_RECEIVER_NETWORK MAIN_STORAGE_UNCONFIRMED MAIN_ACTION_UNCERTAIN MAIN_CONFIGURATION_UNCONFIRMED MAIN_CLAIM_UNCONFIRMED MAIN_MANUAL_WIFI_REQUIRED MAIN_REGISTRATION_UNCONFIRMED MAIN_RECEIPT_INVALID MAIN_EXPLICIT_RETRY_REQUIRED DISCOVERY_EXPIRED MAIN_RECOVERY_UNAVAILABLE MAIN_RECOVERY_CONFLICT PIXEL_GUIDE_UPDATE_REQUIRED '+
    'OUTPUT_CONFIGURATION_INVALID OUTPUT_CONFIGURATION_PROFILE OUTPUT_CONFIGURATION_BUSY OUTPUT_CONFIGURATION_PENDING OUTPUT_CONFIGURATION_UNCONFIRMED OUTPUT_CONFIGURATION_CANCELLED OUTPUT_CONFIGURATION_CONFLICT '+
    'V30_BINDING_INVALID V30_CHECKPOINT_INVALID V30_CHECKPOINT_CONFLICT V30_CHECKPOINT_ROLLBACK V30_STORAGE_UNAVAILABLE V30_STORAGE_CORRUPT V30_STORAGE_UNCONFIRMED V30_STORAGE_FULL V30_CREDENTIAL_INVALID V30_CREDENTIAL_IMMUTABLE V30_PIN_FORMAT V30_RECEIPT_UNVERIFIED').split(' '));
  function spiDiagnosticValid679(value){return layoutKeys(value,['version','operation','phase','code','targetOrdinal','elapsedMS','phaseElapsedMS','preflightMS','applyMS'])&&value.version===1&&
    ['start','update','test','renew'].includes(value.operation)&&spiDiagnosticPhases679.has(value.phase)&&spiDiagnosticCodes679.has(value.code)&&Number.isInteger(value.targetOrdinal)&&value.targetOrdinal>=0&&value.targetOrdinal<=30&&
    ['elapsedMS','phaseElapsedMS','preflightMS','applyMS'].every(key=>Number.isInteger(value[key])&&value[key]>=0&&value[key]<=180000);}
  function spiDiagnosticReplyKeys679(value,keys){return Object.prototype.hasOwnProperty.call(value||{},'diagnostic')?
    layoutKeys(value,[...keys,'diagnostic'])&&spiDiagnosticValid679(value.diagnostic):layoutKeys(value,keys);}
  // The full physical path is part of the native contract, not an optional UI
  // hint. Admit a dense bijection only; Swift still fences its canonical order.
  function spiDirectionPathValid682(lines,order){
    if(!Array.isArray(lines)||!lines.length||lines.length>120||Array.from(lines).some(line=>
      !layoutKeys(line,['receiverId','port','reversed'])||!layoutId(line.receiverId)||!Number.isInteger(line.port)||line.port<1||line.port>4||typeof line.reversed!=='boolean'))return false;
    const keys=new Set(lines.map(line=>line.receiverId+':'+line.port));
    return keys.size===lines.length&&Array.isArray(order)&&order.length===lines.length&&
      new Set(order).size===order.length&&Array.from(order).every(key=>typeof key==='string'&&keys.has(key));
  }
  let appearanceTheme=null,appearanceRequest=null,appearanceSerial=0;
  const contextTimers=new Map(),contextEpochs=new Map(),contextJobs=new Map(),contextControls=new Map();let contextQueue=Promise.resolve(),contextResetEpoch=0;
  const contextDiscoveries=new Map(),incompleteLibraryRecovery=new Set();let contextDiscoveryTimer=null,incompleteLibraryRecoveryStorageBlocked=false;
  const incompleteLibraryRecoveryKey='aluvision.v32.incomplete-library-recovery.v1';
  const contextVisible=()=>root.document?.visibilityState!=='hidden';
  // Implementing StandSession is not using it. Existing Owner installations
  // retain their archive until a genuine central flow/session is selected;
  // an uncertain or disconnected selected flow never borrows Owner fallback.
  const legacyContextAllowed=()=>!centralFlowEntered&&!standSessionObserved&&centralStamp===null;
  function observeStaticRoute(reason,count){try{
    const flag=Object.getOwnPropertyDescriptor(root,'__lightningV41GestureDiagnostics');
    if(flag?.value!==true||flag.writable!==false||flag.configurable!==false||
       !['STATIC_PROFILE','LEGACY_CAP_OFF','LEGACY_CONTEXT_SELECTED','CENTRAL_CAP_OFF','CENTRAL_BINDING','CENTRAL_RECHECK',
         'RECHECK_CAP_OFF','RECHECK_CONTEXT','NATIVE_ENTRY','NATIVE_RETURNED_UNAVAILABLE'].includes(reason)||
       !Number.isInteger(count)||count<1||count>30)return;
    root.dispatchEvent?.(new root.CustomEvent('lightning:static-route',{detail:Object.freeze({stage:'facade',reason,count})}));
  }catch(_){/* Bench observation is not delivery or receiver authority. */}}
  let contextWriteBarrier=null;
  let viewRevision=0,viewLoaded=false,viewModelKey=null,viewDraftKey='null',writeQueue=Promise.resolve(),settledWriteQueue=writeQueue;
  const fail=code=>Object.assign(new Error('De verbinding is nog niet beschikbaar.'),{code});
  function receive(message,fromNative=false){
    if(!message||typeof message.id!=='string')return;
    if(!pending.has(message.id)){
      // A local cleanup failure is not task completion. Retain only the exact
      // original task observer; a late native finish releases its lease, but
      // never supplies a storage ACK to a newer request or generation.
      if(fromNative)contextControls.get(message.id)?.nativeFinished(message);
      return;
    }
    const request=pending.get(message.id);pending.delete(message.id);
    if(fromNative)request.automatic?.nativeFinished(message);
    root.clearTimeout(request.timer);request.removeAbort();
    if(message.ok===true&&message.result&&typeof message.result==='object')request.resolve(message.result);
    else request.reject(fail(typeof message.code==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(message.code)?message.code:'NATIVE_FAILED'));
  }
  function call(action,payload={},signal,automatic,posted){
    if(!native||!transportReady)return Promise.reject(fail('NATIVE_UNAVAILABLE'));
    if(!documentId||!/^[A-F0-9]{32}$/.test(documentId))return Promise.reject(fail('NATIVE_DOCUMENT_UNAVAILABLE'));
    if(!actions.has(action))return Promise.reject(fail('ACTION_UNSUPPORTED'));
    if(signal?.aborted)return Promise.reject(fail('CANCELLED'));
    if(pending.size>=8)return Promise.reject(fail('NATIVE_BUSY'));
    return new Promise((resolve,reject)=>{
      const id='v30-'+documentId+'-'+(++serial),cancelNative=()=>{
        if(automatic){automatic.interrupt();return;}
        if(action==='previewSPIZoneDirections'){
          if(payload.action!=='stop')try{handler.postMessage({version:1,id:'v30-'+documentId+'-'+(++serial),action:'previewSPIZoneDirections',payload:{action:'stop',standId:payload.standId,zoneId:payload.zoneId,sessionId:payload.sessionId}});}catch(_){}
          return;
        }
        if(pending.has(id)&&!['interruptAutomaticContext','setAppearance','selectionFeedback','interfaceFeedback','capabilities','loadView','saveDraft','parkDraft','checkpointPreviewExit','resumeDraft','publishModel','editZones','exportBackup','chooseBackup','importInstallationView'].includes(action))try{handler.postMessage({version:1,id:'v30-'+documentId+'-'+(++serial),action:action==='discover'?'cancelDiscover':'cancelOnboarding',payload:{requestId:id}});}catch(_){}
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
      const timeout=['exportBackup','chooseBackup','recoverInstallation'].includes(action)?300000:['scanStandShare','shareStandLink','shareStandWifi','standOpenWifi','standConnect','standMigrate','standResume','standRefresh','standMutation','standCodeChange','prepareReceiverManagement'].includes(action)||action==='publishModel'&&centralStamp!==null?90000:action==='checkpointPreviewExit'?30000:action==='previewPixels'?45000:action==='syncInstallationContext'?180000:['otaPlan','otaMainRecoveryPlan'].includes(action)?120000:action==='applyLiveBatch'?30000:action==='applyLive'?20000:action==='configureOutputs'?90000:['discoverMesh','securityStatus','setPinProtection'].includes(action)?30000:
        ['secure','reconcileSecurity'].includes(action)&&payload.configuration?.role==='node'?120000:
        action==='identifyLayout'?35000:['select','secure','reconcileSecurity','finalize','removalPlan','removalStart','removalResume','identify','identifyCandidate','identifyFactoryMain'].includes(action)?45000:12000;
      const deadline=['claimFirstPinV2','showFirstPinV2'].includes(action)?300000:['prepareFirstPinV2','reconcileFirstPinV2'].includes(action)?50000:action==='previewSPIZoneDirections'?(payload.action==='stop'?20000:90000):action==='configureOutputDirections'?90000:['applyStaticGesture','standFirstAccessPreflight'].includes(action)?45000:timeout;
      const timer=root.setTimeout(()=>{cancelNative();if(!automatic)receive({id,ok:false,code:'NATIVE_TIMEOUT'});},deadline);
      pending.set(id,{resolve,reject,timer,automatic,removeAbort:()=>signal?.removeEventListener('abort',abort)});
      posted?.(id);
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
    let requestId=null,settle,requested=false,interruption=null,afterCleanup;
    const control={started:false,cleaned:false,errorCode:null,
      start(id,finish){requestId=id;settle=finish;control.started=true;contextControls.set(id,control);if(requested)control.interrupt();},
      nativeFinished(message){
        if(control.cleaned)return;
        if(message){
          if(message.ok===true&&message.result&&typeof message.result==='object'){
            try{contextResult(message.result,standId);}catch(error){control.errorCode=error.code;}
          }else control.errorCode=typeof message.code==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(message.code)?message.code:'NATIVE_FAILED';
        }
        control.cleaned=true;contextControls.delete(requestId);
        if(afterCleanup){const finished=afterCleanup;afterCleanup=null;finished();}
      },
      afterCleanup(callback){afterCleanup=callback;if(control.cleaned){afterCleanup=null;callback();}},
      interrupt(){
        requested=true;if(!requestId||interruption)return;
        // Post only after the original message turn. Request IDs bind one
        // document and one archive; no retry, owner reopening or metadata ACK.
        interruption=Promise.resolve().then(()=>call('interruptAutomaticContext',{standId,requestId})).then(result=>{
          if(!result||Object.keys(result).sort().join(',')!=='requestId,standId,status'||result.status!=='context-cleaned'||result.standId!==standId||result.requestId!==requestId)throw fail('RECEIVER_CONTEXT_CANCEL_UNCONFIRMED');
          control.nativeFinished();settle('CANCELLED');
        }).catch(()=>settle('RECEIVER_CONTEXT_CANCEL_UNCONFIRMED'));
      }
    };return control;
  }
  async function receiverContext(action,standId,current,signal,automatic=false,continuation){
    if(!legacyContextAllowed())throw fail('STAND_LEGACY_ACCESS_RETIRED');
    if(root.__lightningV32ReceiverContext!==true)throw fail('RECEIVER_CONTEXT_UNAVAILABLE');
    if(typeof standId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(standId))throw fail('RECEIVER_CONTEXT_INVALID');
    if(action==='syncInstallationContext'&&libraryRecoveryBlocked(standId))throw fail('LIBRARIES_RECOVERY_INCOMPLETE');
    await writeQueue.catch(()=>{});
    if(!legacyContextAllowed())throw fail('STAND_LEGACY_ACCESS_RETIRED');
    if(signal?.aborted)throw fail('CANCELLED');
    if(current&&!current())throw fail('RECEIVER_CONTEXT_STALE');
    if(action==='syncInstallationContext'&&libraryRecoveryBlocked(standId))throw fail('LIBRARIES_RECOVERY_INCOMPLETE');
    if(action==='syncInstallationContext'&&contextControls.size)throw fail('RECEIVER_CONTEXT_CANCEL_UNCONFIRMED');
    let ticket,control=automatic?automaticContextControl(standId):null;
    try{
      if(action==='syncInstallationContext'){
        // Hold one atomic idle lease through this single bounded native RPC.
        // New gestures still preview/coalesce, then dispatch after its finally.
        // No mutation is retried and the native foreground guard stays intact.
        ticket=continuation?.ticket||await waitForContextWrite(standId,signal);
        await writeQueue.catch(()=>{});
        if(signal?.aborted)throw fail('CANCELLED');
        if(current&&!current())throw fail('RECEIVER_CONTEXT_STALE');
        if(libraryRecoveryBlocked(standId))throw fail('LIBRARIES_RECOVERY_INCOMPLETE');
      }
      if(!legacyContextAllowed())throw fail('STAND_LEGACY_ACCESS_RETIRED');
      const libraries=typeof root.LightningInstallationLibraries?.capture==='function'?root.LightningInstallationLibraries.capture(standId):undefined;
      if(continuation?.libraries!==undefined&&canonical(libraries)!==continuation.libraries)throw fail('RECEIVER_CONTEXT_STALE');
      if(control)ticket?.onPendingLiveIntent?.(()=>control.interrupt());
      const result=await call(action,{standId,...(libraries===undefined?{}:{libraries}),...(control?{automatic:true}:{})},signal,control);
      if(!legacyContextAllowed())throw fail('STAND_LEGACY_ACCESS_RETIRED');
      return contextResult(result,standId);
    }finally{
      // A local abort or timeout is not cleanup. An unconfirmed interrupt
      // deliberately retains the lease; later gestures cannot overlap radio.
      const cleaned=!control||!control.started||control.cleaned;
      if(cleaned)ticket?.release();
      else control.afterCleanup(()=>{ticket?.release();continuation?.lateFinished?.(control.errorCode);wakeContextContinuations();});
      continuation?.finished?.(cleaned,control?.started===true);
    }
  }
  function contextInstallation(standId){
    if(!viewLoaded||viewDraftKey!=='null')return null;
    const model=JSON.parse(viewModelKey),stand=model.stands?.find(item=>item.id===standId);
    const receivers=model.receivers?.filter(item=>item.standId===standId&&item.lifecycle==='added');
    if(!stand||model.demo===true||!receivers?.length)return null;
    const {name,zones,...identity}=stand;
    return canonical({stand:identity,receivers:receivers.map(receiver=>({id:receiver.id,rid:receiver.rid??null,
      physicalId:receiver.physicalId??null,deviceFingerprint:receiver.deviceFingerprint??null,type:receiver.type,
      role:receiver.role??null,lifecycle:receiver.lifecycle,onboardingTransactionId:receiver.onboardingTransactionId??null})).sort((a,b)=>a.id.localeCompare(b.id))});
  }
  function contextJobCurrent(job){
    return legacyContextAllowed()&&contextJobs.get(job.standId)===job&&contextEpochs.get(job.standId)===job.epoch&&contextResetEpoch===job.reset;
  }
  function contextCanContinue(job){
    return contextJobCurrent(job)&&contextVisible()&&typeof contextWriteBarrier==='function'&&job.installation!==null&&!libraryRecoveryBlocked(job.standId)&&
      contextInstallation(job.standId)===job.installation&&contextControls.size===0;
  }
  function armContextContinuation(job){
    if(!contextJobCurrent(job)||job.state!=='paused'||contextTimers.has(job.standId)||!contextVisible())return;
    // Clean pending work reconciles at a bounded rate, not by replaying a
    // mutation. Later rounds outlive the original 300s library staging lifetime.
    contextTimers.set(job.standId,root.setTimeout(()=>{
      contextTimers.delete(job.standId);enqueueContextContinuation(job);
    },job.attempts===0?20000:300000));
  }
  function wakeContextContinuations(){
    for(const job of contextJobs.values())if(job.state==='paused')armContextContinuation(job);
  }
  function pauseContext(job){
    if(!contextJobCurrent(job))return;
    job.state='paused';armContextContinuation(job);
  }
  function stopContext(job,error,cleaned){
    job.state=cleaned?'stopped':'blocked';
    // Only closed transport failures with confirmed native cleanup may be
    // reconciled automatically at app return. Deadlines, uncertain exchanges,
    // authentication/identity failures and invalid receipts stay closed.
    job.recheckOnReturn=cleaned&&['TRUST_TRANSPORT','MAIN_CONNECTION_UNAVAILABLE'].includes(error?.code);
  }
  function lateContextFinished(job,code){
    if(!contextJobCurrent(job)||job.state!=='blocked')return;
    // Exact late task completion releases its lease, not error policy. Only
    // confirmed clean cancellation/busy or a valid old receipt may park;
    // deadlines, identity failures and malformed replies still stay closed.
    if(code===null||['CANCELLED','OWNER_SESSION_CANCELLED','TRUST_CANCELLED','MAIN_BUSY'].includes(code))pauseContext(job);
    else stopContext(job,{code},true);
  }
  function enqueueContextContinuation(job){
    if(!contextCanContinue(job)||job.state!=='paused')return;
    job.epoch=(contextEpochs.get(job.standId)||0)+1;contextEpochs.set(job.standId,job.epoch);
    job.state='queued';job.attempts=Math.min(2,job.attempts+1);
    contextEvent({standId:job.standId,status:'pending'},job.epoch,job.reset,'queued');
    contextQueue=contextQueue.catch(()=>{}).then(async()=>{
      if(!contextCanContinue(job)){if(contextJobCurrent(job))job.state='paused';return;}
      let ticket,handedToWriter=false,revoked=false,cleaned=true,writerStarted=false;
      try{
        // Acquire the original LIVE idle lease first. A gesture arriving during
        // the local status read revokes this round before any writer is started.
        ticket=await waitForContextWrite(job.standId);
        ticket?.onPendingLiveIntent?.(()=>{revoked=true;});
        const writes=writeQueue;await writes.catch(()=>{});
        if(!contextCanContinue(job)||revoked)return;
        if(typeof root.LightningInstallationLibraries?.capture!=='function')throw fail('LIBRARIES_RECOVERY_UNAVAILABLE');
        const revision=viewRevision,model=viewModelKey,draft=viewDraftKey;
        const libraries=canonical(root.LightningInstallationLibraries.capture(job.standId));
        const current=()=>contextCanContinue(job)&&!revoked&&writeQueue===writes&&viewRevision===revision&&viewModelKey===model&&viewDraftKey===draft;
        contextEvent({standId:job.standId,status:'syncing'},job.epoch,job.reset,'writing');
        // This is the exact-desired local ledger read, not a new receiver ACK.
        // The unchanged native writer then performs its authenticated remote
        // STATUS reconciliation before BEGIN; firmware rejects a foreign TXN.
        const status=await receiverContext('receiverContextStatus',job.standId,current);
        if(!current())return;
        const total=JSON.parse(model).receivers.filter(item=>item.standId===job.standId&&item.lifecycle==='added').length;
        if(status.total!==total||typeof status.librariesComplete!=='boolean')throw fail('RECEIVER_CONTEXT_UNCONFIRMED');
        if(status.status==='synced'){
          contextEvent(status,job.epoch,job.reset,'complete');contextJobs.delete(job.standId);return;
        }
        const result=await receiverContext('syncInstallationContext',job.standId,current,undefined,true,
          {ticket,libraries,finished(value,started){handedToWriter=true;cleaned=value;writerStarted=started;},lateFinished(code){lateContextFinished(job,code);}});
        if(contextJobCurrent(job)){
          contextEvent(result,job.epoch,job.reset,'complete');
          if(result.status==='synced')contextJobs.delete(job.standId);else pauseContext(job);
        }
      }catch(error){
        if(contextJobCurrent(job)){
          contextEvent({standId:job.standId,status:'pending'},job.epoch,job.reset,'complete');
          // Completed cancellation or exact pre-admission writer busy may park.
          // Invalid reads and unconfirmed cleanup cannot start another round.
          if(cleaned&&(['CANCELLED','OWNER_SESSION_CANCELLED','TRUST_CANCELLED'].includes(error?.code)||writerStarted&&error?.code==='MAIN_BUSY'||!writerStarted&&['RECEIVER_CONTEXT_BUSY','LIVE_QUEUE_BUSY','NATIVE_BUSY'].includes(error?.code)))pauseContext(job);
          else stopContext(job,error,cleaned);
        }
      }finally{
        if(!handedToWriter)ticket?.release();
        if(contextJobCurrent(job)&&job.state==='queued'){
          contextEvent({standId:job.standId,status:'pending'},job.epoch,job.reset,'complete');pauseContext(job);
        }
      }
    });
  }
  function libraryRecoveryMarker(){
    let storage;
    try{storage=root.localStorage;}catch(_){incompleteLibraryRecoveryStorageBlocked=true;return null;}
    if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function'||typeof storage.removeItem!=='function'){incompleteLibraryRecoveryStorageBlocked=true;return null;}
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
    const marker=libraryRecoveryMarker();if(marker?.stands.has(standId))incompleteLibraryRecovery.add(standId);
    return incompleteLibraryRecoveryStorageBlocked||incompleteLibraryRecovery.has(standId);
  }
  function setLibraryRecoveryBlock(standId,blocked){
    if(blocked)incompleteLibraryRecovery.add(standId);
    const marker=libraryRecoveryMarker();if(!marker)return;
    if(blocked)marker.stands.add(standId);else marker.stands.delete(standId);
    try{
      if(marker.stands.size>20)throw fail('RECEIVER_CONTEXT_INVALID');
      const raw=marker.stands.size?JSON.stringify([...marker.stands].sort()):null;
      if(raw===null)marker.storage.removeItem(incompleteLibraryRecoveryKey);else marker.storage.setItem(incompleteLibraryRecoveryKey,raw);
      if(marker.storage.getItem(incompleteLibraryRecoveryKey)!==raw)throw fail('RECEIVER_CONTEXT_UNCONFIRMED');
      if(!blocked)incompleteLibraryRecovery.delete(standId);
    }catch(_){incompleteLibraryRecoveryStorageBlocked=true;}
  }
  function discoverContext(standId,allowSettledJob=false,returnMode){
    if(contextDiscoveries.has(standId))return contextDiscoveries.get(standId);
    const discovery=Promise.resolve().then(async()=>{
      const previousJob=contextJobs.get(standId);
      const automaticReturn=returnMode==='return'||returnMode==='idle';
      const settledAllowed=allowSettledJob||automaticReturn&&(previousJob?.state==='stopped'&&previousJob.recheckOnReturn===true||returnMode==='idle'&&previousJob?.state==='paused');
      if(!legacyContextAllowed()||!contextVisible()||contextControls.size||previousJob&&(!settledAllowed||!['paused','stopped'].includes(previousJob.state))||writeQueue!==settledWriteQueue||typeof contextWriteBarrier!=='function'||
        typeof root.LightningInstallationLibraries?.capture!=='function'||!libraryRecoveryMarker()||libraryRecoveryBlocked(standId))return null;
      const installation=contextInstallation(standId);if(installation===null)return null;
      if(automaticReturn&&previousJob&&installation!==previousJob.installation)return null;
      try{root.LightningModel.assertValid(JSON.parse(viewModelKey));}catch(_){return null;}
      const epoch=contextEpochs.get(standId),reset=contextResetEpoch,writes=writeQueue,revision=viewRevision,model=viewModelKey,draft=viewDraftKey;
      const current=()=>legacyContextAllowed()&&contextVisible()&&!contextControls.size&&contextJobs.get(standId)===previousJob&&writeQueue===writes&&writeQueue===settledWriteQueue&&
        viewRevision===revision&&viewModelKey===model&&viewDraftKey===draft&&contextResetEpoch===reset&&contextEpochs.get(standId)===epoch&&
        contextInstallation(standId)===installation&&!libraryRecoveryBlocked(standId);
      let ticket,revoked=false,readStarted=false;
      try{
        ticket=await waitForContextWrite(standId);ticket?.onPendingLiveIntent?.(()=>{revoked=true;});
        if(!current()||revoked)return null;
        const libraries=canonical(root.LightningInstallationLibraries.capture(standId));
        readStarted=true;
        const result=await receiverContext('receiverContextStatus',standId,()=>current()&&!revoked);
        if(!current()||revoked||canonical(root.LightningInstallationLibraries.capture(standId))!==libraries)return null;
        const total=JSON.parse(model).receivers.filter(item=>item.standId===standId&&item.lifecycle==='added').length;
        if(result.total!==total||typeof result.librariesComplete!=='boolean')throw fail('RECEIVER_CONTEXT_UNCONFIRMED');
        if(previousJob&&result.status==='pending'&&(previousJob.state==='stopped'||previousJob.attempts>=2||returnMode==='idle')){
          // This current return/manual recheck owns a
          // new current job only after current status and exact idle cleanup.
          // Queued/writing/uncertain tasks were refused before the first read.
          root.clearTimeout(contextTimers.get(standId));contextTimers.delete(standId);
          const job={standId,epoch:epoch||0,reset,installation,state:'paused',attempts:0};contextJobs.set(standId,job);
          Promise.resolve().then(()=>enqueueContextContinuation(job));
        }else if(previousJob){
          // An eligible paused job keeps its existing backoff tier. The fresh
          // read changes UI lineage, not cleanup proof or its timer allowance.
          const next=(contextEpochs.get(standId)||0)+1;previousJob.epoch=next;contextEpochs.set(standId,next);contextEvent(result,next,reset,'complete');
          if(result.status==='synced'){contextJobs.delete(standId);root.clearTimeout(contextTimers.get(standId));contextTimers.delete(standId);}
        }else if(result.status==='synced'){
          const next=(contextEpochs.get(standId)||0)+1;contextEpochs.set(standId,next);contextEvent(result,next,reset,'complete');
        }else{
          const job={standId,epoch:epoch||0,reset,installation,state:'paused',attempts:0};contextJobs.set(standId,job);
          if(epoch===undefined)contextEpochs.set(standId,job.epoch);
          // A new owned round, never a replay of an old mutation. It performs
          // another current read after reacquiring LIVE and before its writer.
          Promise.resolve().then(()=>enqueueContextContinuation(job));
        }
        return result;
      }catch(error){
        if(automaticReturn&&previousJob&&current()&&(readStarted||!['RECEIVER_CONTEXT_BUSY','LIVE_QUEUE_BUSY','NATIVE_BUSY','CANCELLED'].includes(error?.code))){
          // A newer failed reconciliation supersedes older retry eligibility.
          // Do not let an earlier busy/transport state hide a new deadline,
          // identity failure or malformed ledger and retain its old timer.
          root.clearTimeout(contextTimers.get(standId));contextTimers.delete(standId);
          stopContext(previousJob,error,true);
        }
        throw error;
      }finally{ticket?.release();}
    }).finally(()=>{if(contextDiscoveries.get(standId)===discovery)contextDiscoveries.delete(standId);});
    contextDiscoveries.set(standId,discovery);return discovery;
  }
  function wakeAndDiscoverContexts(){
    if(!legacyContextAllowed())return;
    wakeContextContinuations();
    if(contextDiscoveryTimer!==null||!contextVisible()||!viewLoaded||viewDraftKey!=='null'||contextControls.size)return;
    contextDiscoveryTimer=root.setTimeout(()=>{
      contextDiscoveryTimer=null;
      const stands=viewLoaded&&viewDraftKey==='null'?JSON.parse(viewModelKey).stands||[]:[];
      // Serial local discovery prevents multi-stand startup from flooding the
      // existing eight-request boundary. Rejections create no timer loop.
      let reads=Promise.resolve();
      for(const stand of stands)reads=reads.then(()=>discoverContext(stand.id,false,'return')).catch(()=>{});
    },0);
  }
  root.addEventListener?.('online',wakeAndDiscoverContexts);
  root.addEventListener?.('focus',wakeAndDiscoverContexts);
  root.document?.addEventListener?.('visibilitychange',()=>{if(contextVisible())wakeAndDiscoverContexts();});
  root.addEventListener?.('lightning:receiver-work-idle',event=>{
    const detail=event?.detail,standId=detail?.standId;
    if(!detail||typeof detail!=='object'||Array.isArray(detail)||Object.keys(detail).join(',')!=='standId'||
      typeof standId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(standId))return;
    // Closing the management sheet is merely a wake-up, never OTA completion
    // or native cleanup proof. Existing live leases and fresh status own work.
    discoverContext(standId,false,'idle').catch(()=>{});
  });
  function scheduleContext(view,standId,{immediate=false}={}){
    if(!legacyContextAllowed())return view;
    if(root.__lightningV32ReceiverContext!==true||!view?.model?.receivers?.some(receiver=>receiver.standId===standId&&receiver.lifecycle==='added'))return view;
    root.clearTimeout(contextTimers.get(standId));
    const epoch=(contextEpochs.get(standId)||0)+1,reset=contextResetEpoch;
    contextEpochs.set(standId,epoch);
    const current=()=>legacyContextAllowed()&&contextEpochs.get(standId)===epoch&&contextResetEpoch===reset;
    const job={standId,epoch,reset,installation:contextInstallation(standId),state:'queued',attempts:0};contextJobs.set(standId,job);
    contextEvent({standId,status:'pending'},epoch,reset,'queued');
    const enqueue=()=>{
      if(!current())return;
      contextTimers.delete(standId);
      contextQueue=contextQueue.catch(()=>{}).then(async()=>{
        if(!current())return;
        if(libraryRecoveryBlocked(standId)){job.state='stopped';contextEvent({standId,status:'pending'},epoch,reset,'complete');return;}
        if(!contextVisible()||contextControls.size){contextEvent({standId,status:'pending'},epoch,reset,'complete');pauseContext(job);return;}
        job.state='writing';let cleaned=true,writerStarted=false;
        contextEvent({standId,status:'syncing'},epoch,reset,'writing');
        try{
          const result=await receiverContext('syncInstallationContext',standId,current,undefined,true,
            {finished(value,started){cleaned=value;writerStarted=started;},lateFinished(code){lateContextFinished(job,code);}});
          if(current()){
            contextEvent(result,epoch,reset,'complete');
            if(result.status==='synced')contextJobs.delete(standId);else pauseContext(job);
          }
        }catch(error){if(current()){
          contextEvent({standId,status:'pending'},epoch,reset,'complete');
          if(cleaned&&(['CANCELLED','OWNER_SESSION_CANCELLED','TRUST_CANCELLED'].includes(error?.code)||writerStarted&&error?.code==='MAIN_BUSY'||!writerStarted&&['RECEIVER_CONTEXT_BUSY','LIVE_QUEUE_BUSY','NATIVE_BUSY'].includes(error?.code)))pauseContext(job);
          else stopContext(job,error,cleaned);
        }}
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
  function verifiedPendingPinStatus(result){
    return !!result&&typeof result==='object'&&[Object.prototype,null].includes(Object.getPrototypeOf(result))&&
      Object.keys(result).sort().join(',')==='desiredPinRequired,hasPin,pinRequired,scope,ssid,status'&&
      result.status==='pending'&&result.scope==='installation'&&typeof result.pinRequired==='boolean'&&
      typeof result.hasPin==='boolean'&&typeof result.desiredPinRequired==='boolean'&&
      typeof result.ssid==='string'&&/^[A-Za-z0-9][A-Za-z0-9 _.-]{0,31}$/.test(result.ssid);
  }
  function canonical(value){
    if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
    if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
    return JSON.stringify(value);
  }
  function trackWrite(next){
    writeQueue=next;const settled=()=>{if(writeQueue===next)settledWriteQueue=next;};next.then(settled,settled);return next;
  }
  function acceptView(view){
    if(!view||!Number.isSafeInteger(view.revision)||view.revision<viewRevision||!view.model||typeof view.model!=='object'||Array.isArray(view.model)||
      !(view.draft===null||(view.draft&&typeof view.draft==='object'&&!Array.isArray(view.draft))))throw fail('VIEW_INVALID');
    viewRevision=view.revision;viewModelKey=canonical(view.model);viewDraftKey=canonical(view.draft);viewLoaded=true;return view;
  }
  function publicationModel(incoming,stored,central=false,configuration=null){
    if(!incoming||!Array.isArray(incoming.receivers)||!stored||!Array.isArray(stored.receivers))throw fail('VIEW_INVALID');
    if(central){
      // A compact draft may omit central-only descriptors, never replace them.
      // If supplied, rich fields must still match their authenticated baseline.
      const baseline=centralProjectionModel;
      if(!baseline)throw fail('STAND_NOT_CONNECTED');
      const oldReceivers=new Map(baseline.receivers.map(r=>[r.id,r]));
      for(const r of incoming.receivers){const old=oldReceivers.get(r.id);if(!old)continue;
        for(const key of Object.keys(r))if(!['state','connection'].includes(key)&&Object.hasOwn(old,key)&&canonical(r[key])!==canonical(old[key]))throw fail('V30_BINDING_INVALID');
      }
      const oldZones=new Map(baseline.stands.flatMap(s=>s.zones).map(z=>[z.id,z]));
      for(const s of incoming.stands)for(const z of s.zones){const old=oldZones.get(z.id);if(!old)continue;
        const initialize=old.type===null&&old.receiverIds.length===0&&z.id===configuration?.zoneId&&z.type===configuration.type&&
          z.layout===(configuration.type==='SPI'?'continuous':'stacked')&&z.receiverIds.length===1&&z.receiverIds[0]===configuration.receiverId;
        for(const key of Object.keys(z))if(!['receiverIds','lineOrder',...(initialize?['type','layout']:[])].includes(key)&&Object.hasOwn(old,key)&&canonical(z[key])!==canonical(old[key]))throw fail('V30_BINDING_INVALID');
      }
      incoming=root.LightningModel.membershipStructure(incoming);
    }
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
  function membershipKey(model){
    if(!model||!Array.isArray(model.receivers))throw fail('VIEW_INVALID');
    return canonical(root.LightningModel.membershipStructure(model));
  }
  function matchesPublicationView(model,expected,previous,configuration,receiptRef){
    if(canonical(model)===canonical(expected))return true;
    // A finalized native new-MAIN context adds its public physical MAC. This
    // is metadata from the authenticated native publication/readback, never
    // discovery, a supplied browser MAC or authority inferred from the RID.
    const c=configuration;
    if(c?.role!=='main'||c.mainReceiverId!==null||typeof receiptRef!=='string'||!/^receipt:[A-Za-z0-9._-]{8,128}$/.test(receiptRef)||
       !Array.isArray(model?.receivers)||!Array.isArray(expected?.receivers)||!Array.isArray(previous?.receivers))return false;
    const next=JSON.parse(JSON.stringify(model)),rows=next.receivers,
      incoming=rows.filter(r=>r.id===c.receiverId),wanted=expected.receivers.filter(r=>r.id===c.receiverId);
    if(incoming.length!==1||wanted.length!==1||previous.receivers.some(r=>r.id===c.receiverId||r.rid===c.rid||r.deviceFingerprint===c.deviceFingerprint))return false;
    const receiver=incoming[0],old=wanted[0];
    if(Object.hasOwn(old,'physicalId')||old.role!=='main'||old.lifecycle!=='added'||old.id!==c.receiverId||old.rid!==c.rid||
       old.deviceFingerprint!==c.deviceFingerprint||old.type!==c.type||old.standId!==c.standId||old.zoneId!==c.zoneId||
       old.onboardingTransactionId!==c.transactionId||canonical(old.outputs)!==canonical(c.outputs)||
       typeof receiver.physicalId!=='string'||!/^[0-9A-F]{12}$/.test(receiver.physicalId)||/^0+$/.test(receiver.physicalId)||
       rows.some(r=>r!==receiver&&r.physicalId===receiver.physicalId))return false;
    delete receiver.physicalId;
    return canonical(next)===canonical(expected);
  }
  function writeView(action,payload){
    // Capture publication intent before entering the serial write queue. The
    // UI may continue painting, but cannot change the graph being verified.
    if(action==='publishModel')payload=JSON.parse(JSON.stringify(payload));
    const next=writeQueue.catch(()=>{}).then(async()=>{
      if(!viewLoaded)throw fail('VIEW_NOT_LOADED');
      const publication=action==='publishModel',localModel=publication?canonical(payload.model):null;
      const central=publication&&!legacyContextAllowed()?centralStamp&&{...centralStamp}:null,epoch=standSharingEpoch;
      if(publication&&!legacyContextAllowed()&&(!central||!standSessionReceiverManagementAvailable||!contextVisible()||central.standId!==payload.configuration?.standId))throw fail('STAND_NOT_CONNECTED');
      const sent=publication?{...payload,model:publicationModel(payload.model,JSON.parse(viewModelKey),!!central,payload.configuration),...(central?{expectedCentralRevision:central.configRevision}:{})}:payload;
      const previousModel=viewModelKey,requested=canonical(action==='saveDraft'?sent.draft:sent.model);
      // acceptView always retains the exact neutral native result. Only this
      // caller receives its unchanged local light overlay, and only after the
      // complete projected graph and finished draft have been acknowledged.
      const matches=view=>central?canonical(view.model)===requested:matchesPublicationView(view.model,sent.model,JSON.parse(previousModel),payload.configuration,payload.receiptRef);
      const present=view=>{
        if(!publication||central)return view;
        const visible=JSON.parse(localModel),added=view.model.receivers.find(r=>r.id===payload.configuration.receiverId),receiver=visible.receivers.find(r=>r.id===payload.configuration.receiverId);
        if(receiver&&added&&Object.hasOwn(added,'physicalId'))receiver.physicalId=added.physicalId;
        return {...view,model:visible};
      };
      try{
        const view=await call(action,{...sent,expectedRevision:viewRevision});
        if(publication&&(view?.draft!==null||!matches(view)))throw fail('VIEW_INVALID');
        if(central){
          if(epoch!==standSharingEpoch||!contextVisible()||!centralStamp||centralStamp.standId!==central.standId||centralStamp.bootId!==central.bootId)throw fail('STAND_CONNECTION_CANCELLED');
          return acceptManagementView(view,central,{kind:'receiver-added',receiverId:payload.configuration.receiverId,transactionId:payload.configuration.transactionId});
        }
        return present(acceptView(view));
      }
      catch(error){
        if(central){
          // A local journal is not central storage. After a lost publication
          // reply, only an authenticated MAIN read can confirm this exact
          // completed membership; do not replay the claim or the mutation.
          try{
            if(epoch!==standSharingEpoch||!contextVisible()||!centralStamp||centralStamp.standId!==central.standId||centralStamp.bootId!==central.bootId)throw fail('STAND_CONNECTION_CANCELLED');
            const fresh=await call('standRefresh',central);
            if(epoch!==standSharingEpoch||fresh?.status!=='updated'||membershipKey(fresh.view?.model)!==membershipKey(sent.model))throw fail('STAND_SAVE_UNCONFIRMED');
            // The confirmed central membership does not clear a private draft
            // by inference. Also read its exact completed local journal.
            const local=await call('loadView');
            if(epoch!==standSharingEpoch||local?.draft!==null||canonical(local?.model)!==requested)throw fail('STAND_SAVE_UNCONFIRMED');
            return acceptManagementView({...local,central:fresh},central,{kind:'receiver-added',receiverId:payload.configuration.receiverId,transactionId:payload.configuration.transactionId});
          }catch(_){}throw error;
        }
        // A Keychain CAS can commit while its WebKit reply is lost. Re-read
        // local state only: never repeat a claim, finalize, or storage write.
        // A matching draft alone must not accept an unrelated changed model.
        try{
          const view=acceptView(await call('loadView'));
          if(action==='saveDraft'&&viewModelKey===previousModel&&canonical(view.draft)===requested)return view;
          if(publication&&view.draft===null&&matches(view))return present(view);
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
      const central=!legacyContextAllowed()?centralStamp&&{...centralStamp}:null,epoch=standSharingEpoch;
      if(!legacyContextAllowed()&&(!central||!standSessionReceiverManagementAvailable||!contextVisible()||central.standId!==payload.standId))throw fail('STAND_NOT_CONNECTED');
      if(central&&payload.pin!==undefined)throw fail('STAND_LEGACY_ACCESS_RETIRED');
      if(central&&managementPreparedStand!==central.standId){
        // Removal can be opened without first adding a receiver. Seed its own
        // private journal explicitly; an old phone-cache revision is not CAS.
        installPreparedManagementView(await call('prepareReceiverManagement',{standId:central.standId}),central,epoch);
      }
      const result=await call(action,payload);
      if(central){
        if(epoch!==standSharingEpoch||!contextVisible()||!centralStamp||centralStamp.standId!==central.standId||centralStamp.bootId!==central.bootId)throw fail('STAND_CONNECTION_CANCELLED');
        if(result?.view?.centralClosed){
          const closed=result.view.centralClosed;
          if(!layoutKeys(closed,['standId','bootId','configRevision','resetConfirmed'])||closed.standId!==central.standId||closed.bootId!==central.bootId||!Number.isSafeInteger(closed.configRevision)||closed.configRevision<central.configRevision||closed.resetConfirmed!==true||
             result.status!=='removed'||result.scope!=='installation'||result.requiresPin!==false||!Array.isArray(result.targets)||!result.targets.some(target=>target.role==='main'&&target.receiverId===payload.receiverId)||result.count!==result.targets.length||result.progress?.completed!==result.count||result.progress?.total!==result.count||
             result.view.draft!==null||result.view.model?.demo!==false||result.view.model.stands?.length!==0||result.view.model.receivers?.length!==0)throw fail('STAND_SAVE_UNCONFIRMED');
          root.LightningModel.assertValid(result.view.model);acceptView(result.view);centralStamp=null;managementPreparedStand=null;
        }else if(result?.view)result.view=acceptManagementView(result.view,central,{kind:'receiver-removed',receiverId:payload.receiverId,transactionId:result.jobId});
        else if(result?.status==='removed')throw fail('STAND_SAVE_UNCONFIRMED');
        if(result?.requiresPin!==false)throw fail('STAND_LEGACY_ACCESS_RETIRED');
      }else if(result?.view)acceptView(result.view);
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
      assign:['kind','receiverId','zoneId'],assignMany:['kind','receiverIds','zoneId'],reorder:['kind','zoneId','receiverIds'],layout:['kind','zoneId','layout'],arrange:['kind','zoneId','layout','receiverIds'],arrangeLines:['kind','zoneId','layout','lineOrder'],scenePresentation:['kind','zones']};
    const fields=typeof operation?.kind==='string'&&Object.prototype.hasOwnProperty.call(kinds,operation.kind)?kinds[operation.kind]:null;
    const boundedId=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(value);
    const denseArray=value=>Array.isArray(value)&&value.length<=240&&Array.from({length:value.length},(_,index)=>Object.prototype.hasOwnProperty.call(value,index)).every(Boolean);
    const validScenePresentation=op=>{
      if(!denseArray(op.zones)||!op.zones.length||op.zones.length>100||new Set(op.zones.map(zone=>zone?.zoneId)).size!==op.zones.length)return false;
      try{return op.zones.every(zone=>zone&&Object.keys(zone).sort().join(',')==='arrangement,identities,type,zoneId'&&boundedId(zone.zoneId)&&['RGBW','SPI'].includes(zone.type)&&
        root.LightningScenes?.arrangement(zone.arrangement,zone.type)&&denseArray(zone.identities)&&zone.identities.length>0&&zone.identities.length<=30&&
        new Set(zone.identities.map(identity=>identity?.id)).size===zone.identities.length&&zone.identities.every(identity=>
          identity&&Object.keys(identity).sort().join(',')==='deviceFingerprint,id,rid'&&boundedId(identity.id)&&
          root.LightningScenes.identity({rid:identity.rid,deviceFingerprint:identity.deviceFingerprint})));}catch(_){return false;}
    };
    if(typeof standId!=='string'||expectedRevision!==undefined&&(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)||!fields||
      !operation||typeof operation!=='object'||Array.isArray(operation)||
      operation.kind==='assignMany'&&(!Array.isArray(operation.receiverIds)||!operation.receiverIds.length||operation.receiverIds.length>128||
        operation.receiverIds.some(id=>!boundedId(id))||new Set(operation.receiverIds).size!==operation.receiverIds.length||
        !(operation.zoneId===null||boundedId(operation.zoneId)))||
      operation.kind==='arrange'&&(typeof expectedZoneSignature!=='string'||!boundedId(operation.zoneId)||
        !['stacked','vertical','continuous'].includes(operation.layout)||!Array.isArray(operation.receiverIds)||operation.receiverIds.length>128||
        Array.from(operation.receiverIds).some(id=>!boundedId(id))||new Set(operation.receiverIds).size!==operation.receiverIds.length)||
      operation.kind==='arrangeLines'&&(typeof root.LightningModel?.lineIds!=='function'||typeof expectedZoneSignature!=='string'||!boundedId(operation.zoneId)||
        !['stacked','vertical','continuous'].includes(operation.layout)||!denseArray(operation.lineOrder)||operation.lineOrder.length>240||
        Array.from(operation.lineOrder).some(id=>typeof id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}:[0-4]$/.test(id))||new Set(operation.lineOrder).size!==operation.lineOrder.length)||
      operation.kind==='scenePresentation'&&!validScenePresentation(operation)||
      expectedZoneSignature!==undefined&&(!['delete','rename','arrange','arrangeLines'].includes(operation.kind)||typeof expectedZoneSignature!=='string'||expectedZoneSignature.length>16384)||
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
          if(signature&&payload.operation.kind==='arrangeLines'){
            if(!root.LightningModel?.lineIds)throw fail('ZONE_EDIT_INVALID');
            signature.push(zone.layout,root.LightningModel.lineIds(cached,zone.id));
          }
          if(!zone||JSON.stringify(signature)!==expectedZoneSignature)throw fail('V30_CHECKPOINT_CONFLICT');
        }
        if(['arrange','arrangeLines'].includes(payload.operation.kind)){
          const op=payload.operation,Model=root.LightningModel,cached=JSON.parse(viewModelKey),stand=cached.stands?.find(item=>item.id===standId);
          if(!Model||!stand?.zones.some(zone=>zone.id===op.zoneId))throw fail('V30_CHECKPOINT_CONFLICT');
          try{expectedArrangementModel=op.kind==='arrangeLines'?Model.arrangeLines(cached,op.zoneId,{layout:op.layout,lineOrder:op.lineOrder}):Model.arrangeZone(cached,op.zoneId,{layout:op.layout,receiverIds:op.receiverIds});}catch(_){throw fail('ZONE_EDIT_INVALID');}
        }
        if(payload.operation.kind==='scenePresentation'){
          if(previousDraft!==null||!root.LightningModel)throw fail('V30_CHECKPOINT_CONFLICT');
          let expected=JSON.parse(viewModelKey);const Model=root.LightningModel,stand=expected.stands?.find(item=>item.id===standId);
          for(const saved of payload.operation.zones){
            const zone=stand?.zones.find(zone=>zone.id===saved.zoneId&&zone.type===saved.type);
            if(!zone||zone.receiverIds.length!==saved.identities.length||saved.identities.some(identity=>{
              const receiver=expected.receivers.find(receiver=>receiver.id===identity.id);
              return !zone.receiverIds.includes(identity.id)||!receiver||receiver.lifecycle!=='added'||receiver.standId!==standId||receiver.zoneId!==zone.id||
                (receiver.rid||null)!==identity.rid||(receiver.deviceFingerprint||null)!==identity.deviceFingerprint;
            }))throw fail('V30_CHECKPOINT_CONFLICT');
            // Match native's semantic no-op: absent explicit order already
            // means this canonical path. Do not manufacture a CONFIG change.
            if(zone.layout!==saved.arrangement.layout||JSON.stringify(Model.lineIds(expected,zone.id))!==JSON.stringify(saved.arrangement.lineOrder))
              try{expected=Model.arrangeLines(expected,saved.zoneId,{layout:saved.arrangement.layout,lineOrder:saved.arrangement.lineOrder});}catch(_){throw fail('ZONE_EDIT_INVALID');}
          }
          expectedArrangementModel=expected;
        }
        if(previousDraft!==null){
          const kind=payload.operation.kind;
          if(previousDraft.stand?.id!==standId||previousDraft.receiver!==null||previousDraft.cancelled!==false||
            previousDraft.security?.status!=='not-started'||previousDraft.security?.phase!=='idle'||
            !['zones','receiver'].includes(previousDraft.stage)||
            !(['delete','rename','assign','assignMany','layout','reorder','arrange','arrangeLines'].includes(kind)||kind==='create'&&Object.prototype.hasOwnProperty.call(payload.operation,'receiverId')))
            throw fail('V30_CHECKPOINT_CONFLICT');
          const checked=root.LightningOnboardingDraft?.refreshZones(previousDraft,JSON.parse(viewModelKey));
          if(!checked||checked.error||canonical(checked.draft)!==viewDraftKey)throw fail('VIEW_INVALID');
          // A setup edit has a deliberately narrow graph result. Compare the
          // confirmed reply against that exact metadata edit as well as the
          // refreshed draft; a different MAIN/fingerprint/output is no success.
          const Model=root.LightningModel,cached=JSON.parse(viewModelKey),op=payload.operation;
          if(!Model)throw fail('VIEW_INVALID');
          const stand=cached.stands?.find(item=>item.id===standId),receiver=cached.receivers?.find(item=>item.id===op.receiverId);
          if(['delete','rename','layout','reorder','arrange','arrangeLines'].includes(kind)&&!stand?.zones.some(zone=>zone.id===op.zoneId))throw fail('V30_CHECKPOINT_CONFLICT');
          if(kind==='assign'&&(receiver?.standId!==standId||op.zoneId!==null&&!stand?.zones.some(zone=>zone.id===op.zoneId)))throw fail('V30_CHECKPOINT_CONFLICT');
          if(kind==='assignMany'&&(!stand||!Array.isArray(op.receiverIds)||!op.receiverIds.length||op.receiverIds.length>128||
            op.receiverIds.some(id=>typeof id!=='string'||!cached.receivers?.some(item=>item.id===id&&item.standId===standId&&item.lifecycle==='added'))||
            new Set(op.receiverIds).size!==op.receiverIds.length||op.zoneId!==null&&!stand?.zones.some(zone=>zone.id===op.zoneId)))throw fail('V30_CHECKPOINT_CONFLICT');
          if(kind==='delete')expectedSetupModel=Model.deleteZone(cached,op.zoneId);
          else if(kind==='rename')expectedSetupModel=Model.renameZone(cached,op.zoneId,op.name);
          else if(kind==='layout')expectedSetupModel=Model.setLayout(cached,op.zoneId,op.layout);
          else if(kind==='reorder')expectedSetupModel=Model.reorderReceivers(cached,op.zoneId,op.receiverIds);
          else if(['arrange','arrangeLines'].includes(kind))expectedSetupModel=expectedArrangementModel;
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
  function configureOutputs(request,{directionsOnly=false}={}){
    const validId=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value);
    if(!request||typeof request!=='object'||Array.isArray(request)||Object.keys(request).some(key=>!['standId','receiverId','outputs','expectedRevision'].includes(key))||
      !validId(request.standId)||!validId(request.receiverId)||request.expectedRevision!==undefined&&(!Number.isSafeInteger(request.expectedRevision)||request.expectedRevision<0)||
      !Array.isArray(request.outputs)||request.outputs.length!==4||!request.outputs.every((port,index)=>port&&Object.keys(port).sort().join(',')==='enabled,pixels,port,reversed'&&port.port===index+1&&typeof port.enabled==='boolean'&&typeof port.reversed==='boolean'&&Number.isInteger(port.pixels)&&port.pixels>=1&&port.pixels<=(directionsOnly&&!port.enabled?1024:163))||!request.outputs.some(port=>port.enabled))return Promise.reject(fail('OUTPUT_CONFIGURATION_INVALID'));
    // Disabled rows are retained physical geometry, not an instruction to
    // rewrite them. Native only configures active outputs and independently
    // compares all four saved rows at its readback/CAS boundary.
    const {standId,receiverId,expectedRevision}=request,outputs=request.outputs.map(port=>({...port}));
    const next=writeQueue.catch(()=>{}).then(async()=>{
      if(!viewLoaded)throw fail('VIEW_NOT_LOADED');
      const central=centralStamp&&{...centralStamp},epoch=standSharingEpoch;
      if(central&&(central.standId!==standId||!contextVisible()||standSessionOutputsAvailable!==true))throw fail('STAND_NOT_CONNECTED');
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
      // Direction-only saves may never silently enable, resize or normalise a
      // different port. Native repeats this comparison against its fresh view.
      if(directionsOnly&&(!spiZoneDirectionPreview||!central&&!legacyContextAllowed()||outputs.some((output,index)=>{
        const before=receiver.outputs[index];return !before||before.port!==output.port||before.enabled!==output.enabled||before.pixels!==output.pixels||!before.enabled&&before.reversed!==output.reversed;
      })))throw fail('OUTPUT_CONFIGURATION_PROFILE');
      const zone=expected.stands?.find(stand=>stand.id===standId)?.zones?.find(zone=>zone.id===receiver.zoneId);
      if(zone&&Object.prototype.hasOwnProperty.call(zone,'lineOrder')){
        const Model=root.LightningModel;
        try{
          if(typeof Model?.assertValid!=='function'||typeof Model?.ledlines!=='function')throw fail('OUTPUT_CONFIGURATION_PROFILE');
          Model.assertValid(expected);
          const oldOrder=zone.lineOrder.slice();
          // The permit replaces all four outputs atomically. Do not validate
          // intermediate enable/disable steps: only the complete final layout
          // must fit. Surviving identities stay in place; new ports append.
          receiver.outputs=outputs;
          const enabled=Model.ledlines(zone.receiverIds.map(id=>expected.receivers.find(item=>item.id===id))).map(line=>line.id);
          const members=new Set(enabled),retained=oldOrder.filter(id=>members.has(id));
          zone.lineOrder=retained.concat(enabled.filter(id=>!retained.includes(id)));
          Model.assertValid(expected);
        }catch(_){throw fail('OUTPUT_CONFIGURATION_PROFILE');}
      }else receiver.outputs=outputs;
      const refreshed=previousDraft===null?null:root.LightningOnboardingDraft?.refreshZones(previousDraft,expected);
      if(previousDraft!==null&&(!refreshed||refreshed.error))throw fail('VIEW_INVALID');
      const expectedDraft=refreshed?.draft||null;
      const unchanged=canonical(expected)===viewModelKey&&canonical(expectedDraft)===viewDraftKey;
      const matches=view=>canonical(view?.draft)===canonical(expectedDraft)&&(view?.revision===revision+1||unchanged&&view?.revision===revision)&&canonical(view.model)===canonical(expected);
      try{
        const answer=await call(directionsOnly?'configureOutputDirections':'configureOutputs',{standId,receiverId,outputs,expectedRevision:revision});
        if(central){
          const configOnly=model=>{const next=JSON.parse(JSON.stringify(model));for(const r of next.receivers||[]){delete r.state;delete r.connection;}return canonical(next);};
          if(epoch!==standSharingEpoch||!contextVisible()||!centralStamp||canonical(centralStamp)!==canonical(central)||
             answer?.status!=='applied'||answer.standId!==standId||answer.receiverId!==receiverId||canonical(answer.outputs)!==canonical(outputs)||
             !validCentralStamp(answer)||answer.bootId!==central.bootId||answer.configRevision!==revision+1&&!(unchanged&&answer.configRevision===revision)||
             answer.stateRevision<central.stateRevision||answer.view?.draft!==null||answer.view?.revision!==answer.configRevision||
             configOnly(answer.view.model)!==configOnly(expected))throw fail('OUTPUT_CONFIGURATION_UNCONFIRMED');
          return acceptCentral(answer,standId).view;
        }
        const view=answer;
        if(directionsOnly&&(epoch!==standSharingEpoch||!contextVisible()||!legacyContextAllowed()))throw fail('STAND_CONNECTION_CANCELLED');
        if(!matches(view))throw fail('VIEW_INVALID');
        return acceptView(view);
      }catch(error){
        // The public geometry may have committed while journal cleanup failed.
        // A local view cannot prove that the native pending intent was closed;
        // retain the error and let an explicit same-configuration retry finish it.
        if(!central&&(!directionsOnly||epoch===standSharingEpoch&&contextVisible()&&legacyContextAllowed()))try{
          const reconciled=await call('loadView');
          if(!directionsOnly||epoch===standSharingEpoch&&contextVisible()&&legacyContextAllowed())error.reconciledView=acceptView(reconciled);
        }catch(_){}
        throw error;
      }
    });return trackWrite(next);
  }
  function livePayload(input={}){
    if(input?.kind==='SPI_PORTS'){
      if(!input||Object.getPrototypeOf(input)!==Object.prototype||Object.keys(input).sort().join(',')!=='kind,portScenes,receiverId,standId'||
         !Array.isArray(input.portScenes)||!input.portScenes.length||input.portScenes.length>4||Array.from(input.portScenes).some((child,index)=>
           !child||Object.getPrototypeOf(child)!==Object.prototype||!Number.isInteger(child.port)||child.port<1||child.port>4||index>0&&child.port<=input.portScenes[index-1].port||
           !['SPI_SCENE','SPI_BRIGHTNESS'].includes(child.kind)||Object.keys(child).sort().join(',')!==(child.kind==='SPI_SCENE'?'brightness,channels,kind,port,scene,transitionMs':'brightness,channels,kind,port,transitionMs')))throw fail('LIVE_INVALID');
      const portScenes=input.portScenes.map(child=>{
        const {port,...settings}=child,request=livePayload({standId:input.standId,receiverId:input.receiverId,...settings});
        if(request.scene?.standAnimation)throw fail('LIVE_INVALID');
        const {standId,receiverId,...intent}=request;return {port,...intent};
      });
      return {standId:input.standId,receiverId:input.receiverId,kind:'SPI_PORTS',portScenes};
    }
    const {standId,receiverId,kind,brightness,transitionMs,channels,scene}=input;
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
      const stand=scene&&Object.prototype.hasOwnProperty.call(scene,'standAnimation');
      if(!scene||typeof scene!=='object'||Array.isArray(scene)||Object.keys(scene).length!==keys.length+(extended?1:0)+(phased?2:0)+(stand?1:0)||!keys.every(key=>Object.prototype.hasOwnProperty.call(scene,key))||
        typeof scene.engine!=='string'||!/^[A-Za-z0-9_-]{1,64}$/.test(scene.engine)||!colour(scene.background)||!Array.isArray(scene.palette)||scene.palette.length<1||scene.palette.length>(extended?7:4)||!scene.palette.every(colour)||
        !Object.entries(bounds).every(([key,[min,max]])=>Number.isInteger(scene[key])&&scene[key]>=min&&scene[key]<=max)||
        !['backgroundOn','motionReverse','bounce','mirror'].every(key=>typeof scene[key]==='boolean'))throw fail('LIVE_INVALID');
      // Ordinary RGBW/SPI share a bounded phase pair. V30 retains its
      // separate frozen app-time contract, never a dual phase authority.
      if(phased&&(!['SPI_SCENE','RGBW_SCENE'].includes(kind)||extended||!Number.isInteger(scene.phaseMs)||scene.phaseMs<0||scene.phaseMs>999||
        !Number.isInteger(scene.phaseRateMicroHz)||scene.phaseRateMicroHz<0||scene.phaseRateMicroHz>20000000))throw fail('LIVE_INVALID');
      if(extended){
        const v30=scene.v30,limits={effect:[1,kind==='SPI_SCENE'?43:20],fadeAmount:[0,100],width:[0,100],delayMs:[0,10000]};
        if(!v30||typeof v30!=='object'||Array.isArray(v30)||Object.keys(v30).sort().join(',')!=='brand,delayMs,effect,fadeAmount,width'||!colour(v30.brand)||
          !Object.entries(limits).every(([key,[min,max]])=>Number.isInteger(v30[key])&&v30[key]>=min&&v30[key]<=max))throw fail('LIVE_INVALID');
      }
      if(stand){
        const marker=scene.standAnimation,variants=[0,1,2,3,4,17,18,19,20,25],engines=['BREATHE','BREATHE','GRADIENT','FLOW','SPARKLE','BREATHE','BREATHE','GRADIENT','SPARKLE','BREATHE'];
        const extensions=['rgb-jumping','seven-jumping','rgb-gradient','seven-gradient','tunnel-travel','tunnel-bounce','tunnel-center','tunnel-outside','tunnel-cascade','tunnel-handoff','tunnel-pulse','tunnel-echo','tunnel-pixel-curtain','tunnel-pixel-cross','brand-white-breathe','brand-warm-white','brand-accent','brand-sweep','brand-focus','brand-soft-gradient'].map(id=>'v30-'+id);
        if(!marker||typeof marker!=='object'||Array.isArray(marker)||!validID(marker.clockId)||typeof marker.effectId!=='string')throw fail('LIVE_INVALID');
        const index=variants.findIndex((variant,i)=>marker.effectId==='rgbw-'+engines[i].toLowerCase()+'-'+variant);
        if(index>=0){
          const speed=Math.max(.5,scene.speed)/100,rate=([4,20].includes(variants[index])?.5+speed*speed*11.5:.003+speed*speed*1.497)*1000000;
          if(Object.keys(marker).sort().join(',')!=='clockId,effectId,kind,phaseMs,phaseRateMicroHz,variant'||marker.kind!=='whole'||marker.variant!==variants[index]||
             !Number.isInteger(marker.phaseMs)||marker.phaseMs<0||marker.phaseMs>999||!Number.isInteger(marker.phaseRateMicroHz)||Math.abs(marker.phaseRateMicroHz-Math.round(rate))>1||
             scene.lineDelayMs!==0||(kind==='RGBW_SCENE'?(extended||scene.variant!==variants[index]||scene.engine!==engines[index]):scene.v30?.effect!==21+index))throw fail('LIVE_INVALID');
        }else{
          const id=extensions.indexOf(marker.effectId),mode=id>=4&&id<=11||id>=17&&id<=19?'coordinated':'whole';
          if(Object.keys(marker).sort().join(',')!=='clockId,effectId,kind'||id<0||[12,13].includes(id)||scene.v30?.effect!==id+1||marker.kind!==mode)throw fail('LIVE_INVALID');
        }
      }
    }
    return {standId,receiverId,kind,brightness,transitionMs,channels:[...channels],...(full?{scene:JSON.parse(JSON.stringify(scene))}:{})};
  }
  function firstPinSSID686(value,type){
    const prefix=type==='SPI'?'SPI HQ ':type==='RGBW'?'RGBW HQ ':'';
    if(!prefix||typeof value!=='string'||value.length>32||!value.startsWith(prefix))return false;
    const suffix=value.slice(prefix.length);return /^[A-Za-z0-9 ._-]+$/.test(suffix)&&suffix.trim()===suffix&&!suffix.includes('  ');
  }
  function pixelEditorScope686(value){
    return layoutId(value?.standId)&&layoutId(value.transactionId)&&layoutKeys(value.receiver,['id','rid','type','deviceFingerprint'])&&layoutId(value.receiver.id)&&value.receiver.type==='SPI'&&
      /^[A-F0-9]{16}$/.test(value.receiver.rid)&&!/^0+$/.test(value.receiver.rid)&&/^[A-F0-9]{64}$/.test(value.receiver.deviceFingerprint)&&!/^0+$/.test(value.receiver.deviceFingerprint)&&
      ['main','node'].includes(value.role)&&(value.role==='main'?value.mainReceiverId===null:layoutId(value.mainReceiverId)&&value.mainReceiverId!==value.receiver.id)&&
      layoutUUID(value.editorSession)&&value.editorSession===value.editorSession.toLowerCase();
  }
  function firstPinConfiguration686(value){
    return layoutKeys(value,['version','transactionId','standId','receiverId','rid','deviceFingerprint','type','role','mainReceiverId','outputs','zoneId'])&&value.version===1&&
      ['transactionId','standId','receiverId'].every(key=>layoutId(value[key]))&&/^[A-F0-9]{16}$/.test(value.rid)&&!/^0+$/.test(value.rid)&&/^[A-F0-9]{64}$/.test(value.deviceFingerprint)&&!/^0+$/.test(value.deviceFingerprint)&&
      ['SPI','RGBW'].includes(value.type)&&value.role==='main'&&value.mainReceiverId===null&&(value.zoneId===null||layoutId(value.zoneId))&&
      Array.isArray(value.outputs)&&(value.type==='RGBW'?value.outputs.length===0:value.outputs.length===4&&Array.from(value.outputs).every((output,index)=>
        layoutKeys(output,['port','enabled','pixels','reversed'])&&output.port===index+1&&output.enabled===(index===0)&&output.pixels===163&&output.reversed===false));
  }
  function firstPinReply686(value,type,action){
    if(!value||Object.getPrototypeOf(value)!==Object.prototype)return false;
    if(value.status==='pin-required')return action!=='claim'&&layoutKeys(value,['status','ssid','standName'])&&firstPinSSID686(value.ssid,type)&&typeof value.standName==='string'&&!!value.standName.trim()&&value.standName.length<=64;
    if(value.status==='manual-rejoin'||value.status==='registration-pending')return action!=='prepare'&&(action==='reconcile'||value.status==='manual-rejoin')&&layoutKeys(value,['status','ssid'])&&firstPinSSID686(value.ssid,type);
    if(value.status==='cancelled')return action==='claim'&&layoutKeys(value,['status']);
    if(value.status==='verification-required')return action==='reconcile'&&layoutKeys(value,['status']);
    return action==='reconcile'&&layoutKeys(value,['receiptRef','ssid'])&&typeof value.receiptRef==='string'&&/^receipt:[A-F0-9]{64}$/.test(value.receiptRef)&&firstPinSSID686(value.ssid,type);
  }
  const serviceSet=native?{
    connectionMode:'manual-wifi',
    // Dedicated first protected MAIN only. These actions never accept or
    // return a PIN in JavaScript; old owned stands retain their normal route.
    FirstPinV2:Object.freeze({
      async ready({standId}){
        if(!layoutId(standId))throw fail('FIRST_PIN_V2_INVALID');
        const answer=await call('firstPinV2Ready',{standId});
        if(layoutKeys(answer,['ready'])&&answer.ready===false)return answer;
        if(!layoutKeys(answer,['ready','standId','receiverId','rid','deviceFingerprint','transactionId','ssid'])||answer.ready!==true||answer.standId!==standId||!['receiverId','transactionId'].every(key=>layoutId(answer[key]))||!/^[A-F0-9]{16}$/.test(answer.rid)||/^0+$/.test(answer.rid)||!/^[A-F0-9]{64}$/.test(answer.deviceFingerprint)||/^0+$/.test(answer.deviceFingerprint)||!['SPI','RGBW'].some(type=>firstPinSSID686(answer.ssid,type)))throw fail('FIRST_PIN_V2_UNCONFIRMED');
        return answer;
      },
      async prepare({configuration,standName,signal}){
        if(!firstPinConfiguration686(configuration)||typeof standName!=='string'||!standName.trim()||standName.length>64||/[<>\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(standName))throw fail('FIRST_PIN_V2_INVALID');
        const answer=await call('prepareFirstPinV2',{configuration:JSON.parse(JSON.stringify(configuration)),standName},signal);
        if(!firstPinReply686(answer,configuration.type,'prepare'))throw fail('FIRST_PIN_V2_UNCONFIRMED');return answer;
      },
      async claim({configuration,signal}){
        if(!firstPinConfiguration686(configuration))throw fail('FIRST_PIN_V2_INVALID');
        const answer=await call('claimFirstPinV2',{configuration:JSON.parse(JSON.stringify(configuration))},signal);
        if(!firstPinReply686(answer,configuration.type,'claim'))throw fail('FIRST_PIN_V2_UNCONFIRMED');return answer;
      },
      async reconcile({configuration,signal}){
        if(!firstPinConfiguration686(configuration))throw fail('FIRST_PIN_V2_INVALID');
        const answer=await call('reconcileFirstPinV2',{configuration:JSON.parse(JSON.stringify(configuration))},signal);
        if(!firstPinReply686(answer,configuration.type,'reconcile'))throw fail('FIRST_PIN_V2_UNCONFIRMED');return answer;
      },
      async show({configuration,signal}){
        if(!firstPinConfiguration686(configuration))throw fail('FIRST_PIN_V2_INVALID');
        const answer=await call('showFirstPinV2',{configuration:JSON.parse(JSON.stringify(configuration))},signal);
        if(!layoutKeys(answer,['status'])||answer.status!=='shown')throw fail('FIRST_PIN_V2_UNCONFIRMED');return answer;
      }
    }),
    // Native contract availability, never evidence of receiver support. The
    // actual request requires that receiver's authenticated guide capability.
    get atomicPreviewExit579(){return atomicPreviewExitAvailable===true&&legacyContextAllowed()&&contextVisible();},
    get previewCapabilities(){return Object.freeze({identifyPorts:pixelPreviewV50,power:pixelPreviewV50,editorIsolation:pixelEditorIsolationAvailable&&legacyContextAllowed()});},
    async prepareReceiverManagement({standId}){
      await writeQueue.catch(()=>{});
      const before=centralStamp&&{...centralStamp},epoch=standSharingEpoch;
      if(!layoutId(standId)||!before||standId!==before.standId||!standSessionReceiverManagementAvailable||!contextVisible())throw fail('STAND_NOT_CONNECTED');
      const view=await call('prepareReceiverManagement',{standId});
      installPreparedManagementView(view,before,epoch);
      return JSON.parse(JSON.stringify(view));
    },
    async standSessionStatus(){
      await requireSimpleStand();
      const result=root.LightningStandConnection.sessionStatus(await call('standSessionStatus'));
      if(result.status==='connected')standSessionObserved=true;
      return result;
    },
    async standInspect(input){
      await requireSimpleStand();
      const request=root.LightningStandConnection.inspectionInput(input);
      const result=await call('standInspect',request);
      return root.LightningStandConnection.inspectionResult(result,request.ssid);
    },
    get firstStandAccessDiagnosticsAvailable(){return firstStandAccessDiagnosticsAvailable;},
    async standFirstAccessDiagnosticFailure(input){
      await requireSimpleStand();
      if(!firstStandAccessDiagnosticsAvailable)throw fail('ACTION_UNSUPPORTED');
      if(!layoutKeys(input,['code']))throw fail('STAND_PREFLIGHT_INVALID');
      // Only closed codes cross the explicit DEBUG recorder boundary. Do not
      // forward messages, stacks, arbitrary code strings or a model snapshot.
      const code=typeof input.code==='string'&&firstAccessDiagnosticCodes.has(input.code)?input.code:'OTHER';
      const result=await call('standFirstAccessDiagnosticFailure',{code});
      if(!layoutKeys(result,['status'])||result.status!=='diagnostic-recorded')throw fail('STAND_PREFLIGHT_UNCONFIRMED');
      return {status:'diagnostic-recorded'};
    },
    async standFirstAccessPreflight(input){
      await requireSimpleStand();
      // Explicit native DEBUG launch only. This read-only probe cannot accept
      // credentials, select a session or create a receiver configuration.
      if(!firstStandAccessDiagnosticsAvailable)throw fail('ACTION_UNSUPPORTED');
      if(!contextVisible()||!layoutKeys(input,['ssid','expectedStandId','payload'])||
         !layoutKeys(input.payload,['operations'])||!Array.isArray(input.payload.operations)||
         input.payload.operations.length<1||input.payload.operations.length>128)throw fail('STAND_PREFLIGHT_INVALID');
      const identity=root.LightningStandConnection.inspectionInput({ssid:input.ssid,expectedStandId:input.expectedStandId});
      if(typeof identity.ssid!=='string'||typeof identity.expectedStandId!=='string')throw fail('STAND_PREFLIGHT_INVALID');
      function publicOnly(value,depth=0){
        if(depth>20)throw fail('STAND_PREFLIGHT_INVALID');
        if(value&&typeof value==='object'){
          if(!Array.isArray(value)&&Object.getPrototypeOf(value)!==Object.prototype)throw fail('STAND_PREFLIGHT_INVALID');
          for(const key of Object.keys(value)){
            if(['__proto__','prototype','constructor','standCode','password','pin','privateKey','ownerKey','sessionKey'].includes(key))throw fail('STAND_PREFLIGHT_INVALID');
            publicOnly(value[key],depth+1);
          }
        }else if(typeof value==='number'&&!Number.isFinite(value))throw fail('STAND_PREFLIGHT_INVALID');
      }
      publicOnly(input.payload);
      if(new TextEncoder().encode(root.LightningStandConnection.encodeOperations(input.payload.operations)).length>root.LightningStandConnection.MAX_BYTES)throw fail('STAND_STORAGE_LIMIT');
      const result=await call('standFirstAccessPreflight',{...identity,payload:JSON.parse(JSON.stringify(input.payload))});
      if(!layoutKeys(result,['status','localGraphValidated','ownerStatusValidated','ready','configRevision','configBytes'])||
         result.status!=='first-access-preflight-complete'||result.localGraphValidated!==true||result.ownerStatusValidated!==true||typeof result.ready!=='boolean'||
         !Number.isSafeInteger(result.configRevision)||result.configRevision<0||!Number.isSafeInteger(result.configBytes)||result.configBytes<0||result.configBytes>root.LightningStandConnection.MAX_BYTES)throw fail('STAND_PREFLIGHT_UNCONFIRMED');
      return {...result};
    },
    async standCodeChange(input){
      await requireSimpleStand();
      const request=root.LightningStandConnection.codeChangeInput(input);
      if(!centralStamp||request.standId!==centralStamp.standId)throw fail('STAND_NOT_CONNECTED');
      try{
        const result=await call('standCodeChange',request);
        if(result?.status!=='reconnect-required'||result.initialized!==true||result.standId!==request.standId||!validCentralStamp(result)||
           typeof result.ssid!=='string'||new TextEncoder().encode(result.ssid).length<1||new TextEncoder().encode(result.ssid).length>32||
           result.view!==undefined||result.libraries!==undefined)throw fail('STAND_CODE_CHANGE_UNCONFIRMED');
        centralStamp=null;return result;
      }catch(error){if(error?.code==='STAND_CODE_CHANGE_UNCONFIRMED')centralStamp=null;throw error;}
      finally{request.currentCode='';request.newCode='';}
    },
    async standConnect(input){return connectCentral('standConnect',input);},
    async standOpenWifi(input={}){
      await requireSimpleStand();
      if(!standWifiOpenAvailable)throw fail('STAND_WIFI_UNSUPPORTED');
      if(!contextVisible())throw fail('STAND_CONNECTION_CANCELLED');
      return connectCentral('standOpenWifi',input);
    },
    async standSessionShare(input){
      await requireSimpleStand();
      if(!standSharingAvailable||!centralStamp||!input||Object.keys(input).join(',')!=='standId'||input.standId!==centralStamp.standId)throw fail('STAND_NOT_CONNECTED');
      return root.LightningStandSharing.validate(await call('standSessionShare',{standId:input.standId}),input.standId);
    },
    async scanStandShare(input={},signal){
      await requireSimpleStand();
      if(!standScanAvailable)throw fail('STAND_SHARE_SCAN_UNAVAILABLE');
      if(!layoutKeys(input,[])||!contextVisible())throw fail('STAND_CONNECTION_CANCELLED');
      const epoch=standSharingEpoch,result=await call('scanStandShare',{},signal);
      if(epoch!==standSharingEpoch||!contextVisible())throw fail('STAND_CONNECTION_CANCELLED');
      if(layoutKeys(result,['status'])&&result.status==='cancelled')return {status:'cancelled'};
      if(!layoutKeys(result,['status','text'])||result.status!=='scanned')throw fail('STAND_SHARE_INVALID');
      root.LightningStandSharing.parse(result.text);return {status:'scanned',text:result.text};
    },
    async takeStandShareLink(input={}){
      await requireSimpleStand();
      if(!standLinkAvailable)throw fail('STAND_SHARE_LINK_UNAVAILABLE');
      if(!layoutKeys(input,[])||!contextVisible())throw fail('STAND_CONNECTION_CANCELLED');
      const epoch=standSharingEpoch,result=await call('takeStandShareLink',{});
      if(epoch!==standSharingEpoch||!contextVisible())throw fail('STAND_CONNECTION_CANCELLED');
      if(layoutKeys(result,['status'])&&result.status==='none')return {status:'none'};
      if(!layoutKeys(result,['status','text'])||result.status!=='received')throw fail('STAND_SHARE_INVALID');
      root.LightningStandSharing.parse(result.text);return {status:'received',text:result.text};
    },
    async shareStandLink(input={},signal){
      await requireSimpleStand();
      if(!standShareSheetAvailable)throw fail('STAND_SHARE_LINK_UNAVAILABLE');
      if(!layoutKeys(input,['text'])||!contextVisible()||!centralStamp)throw fail('STAND_NOT_CONNECTED');
      root.LightningStandSharing.parse(input.text,centralStamp.standId);
      const epoch=standSharingEpoch,result=await call('shareStandLink',{text:input.text},signal);
      if(epoch!==standSharingEpoch||!contextVisible())throw fail('STAND_CONNECTION_CANCELLED');
      if(!layoutKeys(result,['status'])||!['shared','cancelled'].includes(result.status))throw fail('STAND_SHARE_UNCONFIRMED');
      return {status:result.status};
    },
    async shareStandWifi(input={},signal){
      await requireSimpleStand();
      if(!standShareSheetAvailable||!layoutKeys(input,['standId'])||!contextVisible()||!centralStamp||input.standId!==centralStamp.standId)throw fail('STAND_NOT_CONNECTED');
      const before={...centralStamp},epoch=standSharingEpoch,result=await call('shareStandWifi',{standId:input.standId},signal);
      if(epoch!==standSharingEpoch||!contextVisible()||canonical(centralStamp)!==canonical(before))throw fail('STAND_CONNECTION_CANCELLED');
      if(!layoutKeys(result,['status'])||!['shared','cancelled'].includes(result.status))throw fail('STAND_SHARE_UNCONFIRMED');
      return {status:result.status};
    },
    async standMigrate(input){await requireSimpleStand();if(!standMigrationReady)throw fail(standMigrationBlockedReason==='CURRENT_RECEIVER_OTHER_STAND'?'STAND_RECEIVER_SAVED_ELSEWHERE':standMigrationBlockedReason==='CURRENT_STAND_CREDENTIAL_CONFLICT'?'STAND_CURRENT_ACCESS_CONFLICT':'STAND_MIGRATION_NOT_READY');return connectCentral('standMigrate',input);},
    async standResume(input={}){return connectCentral('standResume',input);},
    async standRefresh(input){
      input=JSON.parse(JSON.stringify(input));
      await requireSimpleStand();
      if(!centralStamp||input?.standId!==centralStamp.standId||!validCentralStamp(input))throw fail('STAND_NOT_CONNECTED');
      const result=await call('standRefresh',JSON.parse(JSON.stringify(input)));
      if(result?.status==='unchanged'){
        if(result.standId!==input.standId||result.configRevision!==input.configRevision||result.stateRevision!==input.stateRevision||result.bootId!==input.bootId||result.view!==undefined||result.libraries!==undefined)throw fail('STAND_DATA_UNCONFIRMED');
        return result;
      }
      if(result?.status!=='updated')throw fail('STAND_DATA_UNCONFIRMED');
      if(!validCentralStamp(result)||result.bootId===centralStamp.bootId&&(result.configRevision<centralStamp.configRevision||result.stateRevision<centralStamp.stateRevision))throw fail('STAND_REVISION_STALE');
      return acceptCentral(result,input.standId);
    },
    async standMutation(input){
      input=JSON.parse(JSON.stringify(input));
      await requireSimpleStand();
      if(!centralStamp||input?.standId!==centralStamp.standId||!['config','live'].includes(input.op)||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0||
         typeof input.transactionId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(input.transactionId)||!input.payload||typeof input.payload!=='object'||Array.isArray(input.payload))throw fail('STAND_MUTATION_INVALID');
      const result=await call('standMutation',JSON.parse(JSON.stringify(input)));
      if(result?.status!=='saved'||result.requestId!==input.transactionId||result.standId!==input.standId||!validCentralStamp(result)||!centralStamp||result.bootId!==centralStamp.bootId||
         result.configRevision<input.expectedRevision||result.configRevision<centralStamp.configRevision||result.stateRevision<centralStamp.stateRevision)throw fail('STAND_SAVE_UNCONFIRMED');
      if(result.view!==undefined)return acceptCentral(result,input.standId);
      centralStamp={standId:result.standId,configRevision:result.configRevision,stateRevision:result.stateRevision,bootId:result.bootId};return result;
    },
    async standDisconnect(){
      await requireSimpleStand();const result=await call('standDisconnect');
      if(result?.status!=='disconnected')throw fail('STAND_DISCONNECT_UNCONFIRMED');centralStamp=null;return result;
    },
    async standForget({standId,confirmation}){
      await requireSimpleStand();if(!layoutId(standId)||confirmation!=='FORGET_LOCAL_STAND')throw fail('STAND_FORGET_INVALID');
      const result=await call('standForget',{standId,confirmation});if(result?.status!=='forgotten-local-only'||result.standId!==standId)throw fail('STAND_FORGET_UNCONFIRMED');centralStamp=null;return result;
    },
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
    resumeInstallationContext({standId}){return discoverContext(standId,true);},
    scheduleInstallationContext({standId}){
      if(!viewLoaded||typeof standId!=='string')return;
      scheduleContext({model:JSON.parse(viewModelKey)},standId);
    },
    async syncInstallationContext({standId,signal}){
      if(!legacyContextAllowed())throw fail('STAND_LEGACY_ACCESS_RETIRED');
      root.clearTimeout(contextTimers.get(standId));contextTimers.delete(standId);
      contextJobs.delete(standId);
      const epoch=(contextEpochs.get(standId)||0)+1,reset=contextResetEpoch;contextEpochs.set(standId,epoch);
      const result=contextQueue.catch(()=>{}).then(async()=>{
        if(!legacyContextAllowed()||contextEpochs.get(standId)!==epoch||reset!==contextResetEpoch)throw fail('RECEIVER_CONTEXT_STALE');
        contextEvent({standId,status:'syncing'},epoch,reset,'writing');
        let result;
        try{result=await receiverContext('syncInstallationContext',standId,()=>contextEpochs.get(standId)===epoch&&reset===contextResetEpoch,signal);}
        catch(error){
          if(!legacyContextAllowed()||contextEpochs.get(standId)!==epoch||reset!==contextResetEpoch)throw fail('RECEIVER_CONTEXT_STALE');
          contextEvent({standId,status:'pending'},epoch,reset,'complete');throw error;
        }
        if(!legacyContextAllowed()||contextEpochs.get(standId)!==epoch||reset!==contextResetEpoch)throw fail('RECEIVER_CONTEXT_STALE');
        contextEvent(result,epoch,reset,'complete');
        return result;
      });contextQueue=result;
      return result;
    },
    async recoverInstallation({pin,signal}){
      if(simpleStandAvailable===null)await runtimeCapabilities();
      if(simpleStandAvailable===true)throw fail('STAND_LEGACY_ACCESS_RETIRED');
      if(typeof pin!=='string'||!/^\d{8,12}$/.test(pin))throw fail('PIN_RECOVERY_INVALID');
      const next=writeQueue.catch(()=>{}).then(async()=>{
        const result=await call('recoverInstallation',{pin},signal);
        if(result?.status!=='restored'||typeof result.standId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(result.standId)||result.view?.model?.demo!==false||result.view?.draft!==null)throw fail('PIN_RECOVERY_UNCONFIRMED');
        setLibraryRecoveryBlock(result.standId,true);
        if(result.lightStateComplete!==true||typeof root.LightningReceiverPlayback?.restore!=='function')throw fail('PLAYBACK_UNCONFIRMED');
        const playbackModel=root.LightningReceiverPlayback.restore(result.view.model,result.liveStatuses,{standId:result.standId});
        if(result.librariesComplete===true){
          if(typeof root.LightningInstallationLibraries?.restore!=='function')throw fail('LIBRARIES_RECOVERY_UNAVAILABLE');
          const stored=await root.LightningInstallationLibraries.restore(result.libraries,result.standId);
          if(stored?.restored!==true)throw fail('LIBRARIES_RECOVERY_UNCONFIRMED');
        }
        const view=acceptView(result.view);if(result.librariesComplete===true)setLibraryRecoveryBlock(result.standId,false);
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
      if(verifiedPendingPinStatus(result))return result;
      if(!['applied','reconnect-required'].includes(result?.status)||typeof result.pinRequired!=='boolean'||typeof result.hasPin!=='boolean'||!['installation','new-installation'].includes(result.scope))throw fail('PIN_MODE_UNCONFIRMED');
      return result;
    },
    async setPinProtection({standId,enabled,pin,confirmation}){
      if(simpleStandAvailable===null)await runtimeCapabilities();
      if(simpleStandAvailable===true)throw fail('STAND_LEGACY_ACCESS_RETIRED');
      if(typeof standId!=='string'||typeof enabled!=='boolean'||pin!==undefined&&(typeof pin!=='string'||!/^\d{8,12}$/.test(pin))||
        (enabled?confirmation!==undefined:confirmation!=='DISABLE_PIN'||pin!==undefined))throw fail('PIN_MODE_INVALID');
      await writeQueue.catch(()=>{});
      const result=await call('setPinProtection',{standId,enabled,...(pin===undefined?{}:{pin}),...(confirmation===undefined?{}:{confirmation})});
      if(verifiedPendingPinStatus(result))return result;
      if(!['applied','reconnect-required'].includes(result?.status)||result.pinRequired!==enabled||typeof result.hasPin!=='boolean'||!['installation','new-installation'].includes(result.scope))throw fail('PIN_MODE_UNCONFIRMED');
      return result;
    },
    async loadState(){const view=acceptView(await call('loadView'));wakeAndDiscoverContexts();return view;},
    async checkpointPreviewExit({draft}){
      // Explicit native capability only: method presence/demo services never
      // authorizes a native local exception or a modern STAND fallback.
      if(!services.atomicPreviewExit579)throw fail('ACTION_UNSUPPORTED');
      const chosen=root.LightningOnboardingDraft.snapshot(draft),input=canonical(chosen);
      const next=writeQueue.catch(()=>{}).then(async()=>{
        if(!services.atomicPreviewExit579||!viewLoaded||viewDraftKey==='null')throw fail('NATIVE_STORAGE_BINDING');
        const previousModel=viewModelKey,previousDraft=viewDraftKey,revision=viewRevision,epoch=standSharingEpoch;
        const current=()=>services.atomicPreviewExit579&&epoch===standSharingEpoch&&viewModelKey===previousModel&&viewDraftKey===previousDraft&&viewRevision===revision;
        const payload={intent:'EXIT_PREVIEW_LOCAL',draft:chosen,expectedRevision:revision};
        const valid=result=>layoutKeys(result,['view','checkpoint'])&&layoutKeys(result.checkpoint,['kind','draft'])&&
          result.checkpoint.kind==='pixel-preview-exit-local'&&canonical(result.checkpoint.draft)===input&&
          layoutKeys(result.view,['model','draft','revision'])&&result.view.draft===null&&result.view.revision===revision+1&&canonical(result.view.model)===previousModel;
        let result;try{result=await call('checkpointPreviewExit',payload);}catch(error){
          // Only an exact lost local reply is reconciled by this same endpoint.
          // No generic loadView inference, membership/STOP receipt or radio retry.
          if(!['NATIVE_TIMEOUT','NATIVE_UNAVAILABLE','NATIVE_UNCONFIRMED'].includes(error?.code)||!current())throw error;
          result=await call('checkpointPreviewExit',payload);
        }
        if(!current()||!valid(result))throw fail('NATIVE_STORAGE_UNCONFIRMED');
        root.LightningModel.assertValid(result.view.model);root.LightningOnboardingDraft.snapshot(result.checkpoint.draft);
        acceptView(result.view);return JSON.parse(JSON.stringify(result));
      });return trackWrite(next);
    },
    async persistDraft({draft}){return writeView('saveDraft',{draft});},
    async parkDraft({transactionId}){return moveDraft('parkDraft',{transactionId});},
    async resumeDraft({standId,receiverId,rid,fingerprint=null}){return moveDraft('resumeDraft',{standId,receiverId,rid,fingerprint});},
    async publishModel({model,configuration,receiptRef}){
      const reset=contextResetEpoch;
      return writeView('publishModel',{model,configuration,receiptRef}).then(view=>reset===contextResetEpoch?scheduleContext(view,configuration.standId,{immediate:true}):view);
    },
    async editZones(request){return editZones(request).then(view=>scheduleContext(view,request.standId));},
    async configureOutputs(request){return configureOutputs(request).then(view=>scheduleContext(view,request.standId));},
    async configureOutputDirections(request){return configureOutputs(request,{directionsOnly:true}).then(view=>scheduleContext(view,request.standId));},
    get spiZoneDirectionPreview(){return spiZoneDirectionPreview===true;},
    async previewSPIZoneDirections(request){
      const stop=request?.action==='stop',observe=request?.action==='status',test=request?.action==='test',scopeOnly=stop||observe;
      if(!layoutKeys(request,scopeOnly?['action','standId','zoneId','sessionId']:['action','standId','zoneId','sessionId','lines','focus','lineOrder'])||
         !['start','update','test','stop','status'].includes(request.action)||!['standId','zoneId','sessionId'].every(key=>layoutId(request[key]))||test&&request.focus!==null||
         !scopeOnly&&(!spiDirectionPathValid682(request.lines,request.lineOrder)||request.focus!==null&&
           (!layoutKeys(request.focus,['receiverId','port'])||!request.lines.some(line=>line.receiverId===request.focus.receiverId&&line.port===request.focus.port))))throw fail('SPI_DIRECTION_INVALID');
      if(!spiZoneDirectionPreview)throw fail('SPI_ZONE_DIRECTION_UPDATE_REQUIRED');
      if(!viewLoaded||(centralStamp?(centralStamp.standId!==request.standId||!standSessionOutputsAvailable):!legacyContextAllowed()))throw fail('STAND_NOT_CONNECTED');
      if(!contextVisible()&&!stop)throw fail('STAND_NOT_CONNECTED');
      const stamp=centralStamp&&{...centralStamp},epoch=standSharingEpoch;
      const answer=await call('previewSPIZoneDirections',JSON.parse(JSON.stringify(request)));
      if(answer?.standId!==request.standId||answer.zoneId!==request.zoneId||answer.sessionId!==request.sessionId)throw fail('SPI_DIRECTION_UNCONFIRMED');
      if(stop){
        if(typeof answer.stopped!=='boolean'||(answer.stopped?answer.ttlFallbackMS!==0:answer.ttlFallbackMS!==15000&&!(setupZoneIsolationAvailable&&answer.ttlFallbackMS===38000)))throw fail('SPI_DIRECTION_UNCONFIRMED');
        return answer;
      }
      if(observe){
        if(epoch!==standSharingEpoch||!contextVisible()||canonical(centralStamp)!==canonical(stamp)||!stamp&&!legacyContextAllowed())throw fail('SPI_DIRECTION_UNCONFIRMED');
        if(answer.applied===false){
          if(!spiDiagnosticReplyKeys679(answer,['applied','standId','zoneId','sessionId','reason','previewTTLMS'])||!['inactive','expired','busy'].includes(answer.reason)||answer.previewTTLMS!==0)throw fail('SPI_DIRECTION_UNCONFIRMED');
        }else if(answer.applied!==true||!spiDiagnosticReplyKeys679(answer,['applied','standId','zoneId','sessionId','lines','focus','lineOrder','previewTTLMS','renewAfterMS',...(Object.prototype.hasOwnProperty.call(answer,'pathTestRemainingMS')?['pathTestRemainingMS']:[])])||
          !spiDirectionPathValid682(answer.lines,answer.lineOrder)||answer.focus!==null&&
            (!layoutKeys(answer.focus,['receiverId','port'])||!answer.lines.some(line=>line.receiverId===answer.focus.receiverId&&line.port===answer.focus.port))||
          Object.prototype.hasOwnProperty.call(answer,'pathTestRemainingMS')&&(!Number.isInteger(answer.pathTestRemainingMS)||answer.pathTestRemainingMS<0||answer.pathTestRemainingMS>6000||answer.pathTestRemainingMS>0&&answer.focus!==null)||
          !Number.isInteger(answer.previewTTLMS)||answer.previewTTLMS<1||answer.previewTTLMS>15000||!Number.isInteger(answer.renewAfterMS)||answer.renewAfterMS<1||answer.renewAfterMS>7000)throw fail('SPI_DIRECTION_UNCONFIRMED');
        return answer;
      }
      if(epoch!==standSharingEpoch||!contextVisible()||canonical(centralStamp)!==canonical(stamp)||!stamp&&!legacyContextAllowed()||answer.applied!==true||
         !spiDiagnosticReplyKeys679(answer,['applied','standId','zoneId','sessionId','lines','focus','lineOrder','previewTTLMS','renewAfterMS',...(test?['pathTestMS']:[])])||test&&answer.pathTestMS!==6000||
         canonical(answer.lineOrder)!==canonical(request.lineOrder)||canonical(answer.lines)!==canonical(request.lines)||canonical(answer.focus)!==canonical(request.focus)||
         !Number.isInteger(answer.previewTTLMS)||answer.previewTTLMS<=7000||answer.previewTTLMS>15000||!Number.isInteger(answer.renewAfterMS)||answer.renewAfterMS<1||answer.renewAfterMS>7000||answer.renewAfterMS>=answer.previewTTLMS)throw fail('SPI_DIRECTION_UNCONFIRMED');
      return answer;
    },
    async outputConfigurationStatus({standId,receiverId}){
      if(!centralStamp&&root.__lightningV31OutputRecovery!==true)return {status:'none'};
      const id=value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value);
      if(!id(standId)||!id(receiverId))throw fail('OUTPUT_CONFIGURATION_INVALID');
      await writeQueue.catch(()=>{});
      const central=centralStamp&&{...centralStamp},epoch=standSharingEpoch;
      if(central&&(central.standId!==standId||!contextVisible()||!standSessionOutputsAvailable))throw fail('STAND_NOT_CONNECTED');
      const result=await call('outputConfigurationStatus',{standId,receiverId});
      if(central&&(epoch!==standSharingEpoch||!contextVisible()||canonical(centralStamp)!==canonical(central)))throw fail('STAND_CONNECTION_CANCELLED');
      if(result?.status==='none'&&Object.keys(result).length===1)return {status:'none'};
      if(result?.status!=='pending'||Object.keys(result).sort().join(',')!=='outputs,status'||!Array.isArray(result.outputs)||result.outputs.length!==4||
        !result.outputs.every((port,index)=>port&&Object.keys(port).sort().join(',')==='enabled,pixels,port,reversed'&&port.port===index+1&&typeof port.enabled==='boolean'&&typeof port.reversed==='boolean'&&Number.isInteger(port.pixels)&&port.pixels>=1&&port.pixels<=(port.enabled?163:1024))||!result.outputs.some(port=>port.enabled))throw fail('OUTPUT_CONFIGURATION_UNCONFIRMED');
      return JSON.parse(JSON.stringify(result));
    },
    pixelReceiptDiagnostic692({phase,bits}={}){pixelDiagnostic692(phase,bits);},
    async previewPixels(request){
      const editor=request?.editorSession!==undefined;
      if(request?.action==='hold'){
        if(!pixelEditorIsolationAvailable||!legacyContextAllowed()||!layoutKeys(request,['action','standId','transactionId','receiver','role','mainReceiverId','editorSession'])||!pixelEditorScope686(request))throw fail('PIXEL_PREVIEW_INVALID');
        if(centralStamp&&(centralStamp.standId!==request.standId||!standSessionOutputsAvailable||!contextVisible()))throw fail('STAND_NOT_CONNECTED');
        const answer=await call('previewPixels',JSON.parse(JSON.stringify(request)));
        if(!layoutKeys(answer,['held','editorSession','isolationTTLMS'])||answer.held!==true||answer.editorSession!==request.editorSession||!Number.isInteger(answer.isolationTTLMS)||answer.isolationTTLMS<0||answer.isolationTTLMS>30000)throw fail('PIXEL_PREVIEW_UNCONFIRMED');
        return answer;
      }
      if(editor&&(!pixelEditorIsolationAvailable||!legacyContextAllowed()||!pixelEditorScope686(request))||request?.keepSession!==undefined&&(!editor||request.keepSession!==true||request.action!=='stop'))throw fail('PIXEL_PREVIEW_INVALID');
      const ports=request?.guide==='ports',palettes=[['#0000ff','#ff8000','#8000ff','#00ffff'],['#0000ff','#ff6000','#00ff00','#ff00ff'],['#0000ff','#ffa000','#00ff00','#ff00ff'],['#ff0000','#7800c0','#0000ff','#ff5000'],['#ff0000','#0000ff','#ffff00','#ff1700']],palette=outputs=>[1,2,3,4,5].find(version=>Array.isArray(outputs)&&outputs.length===4&&Array.from(outputs).every((item,index)=>item?.colour===palettes[version-1][index]))||null;
      if(!request||!['start','update','stop'].includes(request.action)||request.receiver?.type!=='SPI'||
        !Number.isInteger(request.pixels)||request.pixels<0||request.pixels>163||request.guide!==undefined&&!['length','power','ports'].includes(request.guide)||
        (ports?request.port!==null||request.pixels!==0||request.reversed!==undefined||request.previewTTLMS!==12000||palette(request.outputs)===null||request.outputs.some((item,index)=>
          !layoutKeys(item,['port','enabled','pixels','reversed','colour'])||item.port!==index+1||typeof item.enabled!=='boolean'||typeof item.reversed!=='boolean'||!Number.isInteger(item.pixels)||item.pixels<0||item.pixels>163)
        :!Number.isInteger(request.port)||request.port<1||request.port>4||request.outputs!==undefined||
          (request.guide==='power'?(request.pixels===0||typeof request.reversed!=='boolean'):request.reversed!==undefined))||
        request.previewTTLMS!==undefined&&(request.guide==='length'||request.guide===undefined||request.previewTTLMS!==12000))throw fail('PIXEL_PREVIEW_INVALID');
      if(ports&&!pixelPreviewV50)throw fail('PIXEL_GUIDE_UPDATE_REQUIRED');
      const payload=JSON.parse(JSON.stringify(request));
      if(centralStamp&&(centralStamp.standId!==request.standId||!standSessionOutputsAvailable||!contextVisible()))throw fail('STAND_NOT_CONNECTED');
      const answer=await call('previewPixels',payload);
      if(editor&&(!layoutKeys(answer,['applied','previewTTLMS','port','pixels','guide','isolationTTLMS',...(ports?['paletteVersion','outputs']:request.guide==='power'?['reversed']:[])])||answer.guide!==(request.guide||'length')||!Number.isInteger(answer.isolationTTLMS)||answer.isolationTTLMS<0||answer.isolationTTLMS>30000||request.action==='stop'&&request.keepSession!==true&&answer.isolationTTLMS!==0)){pixelDiagnostic692('RUNTIME_EDITOR_RECEIPT',(answer?.guide===(request.guide||'length')?1:0)|(Number.isInteger(answer?.isolationTTLMS)&&answer.isolationTTLMS>=0&&answer.isolationTTLMS<=30000?2:0)|(answer?.isolationTTLMS===0?4:0));throw fail('PIXEL_PREVIEW_UNCONFIRMED');}
      if(answer?.applied!==true||answer.port!==request.port||answer.pixels!==request.pixels||
        (request.action==='stop'?answer.previewTTLMS!==0:!Number.isInteger(answer.previewTTLMS)||answer.previewTTLMS<((ports?request.outputs.some(item=>item.enabled&&item.pixels>0):request.pixels>0)?1:0)||answer.previewTTLMS>15000)||
        !(ports?request.outputs.some(item=>item.enabled&&item.pixels>0):request.pixels>0)&&answer.previewTTLMS!==0||
        request.guide==='power'&&(answer.guide!=='power'||answer.reversed!==request.reversed)||
        ports&&(answer.guide!=='ports'||![1,2,3,4,5].includes(answer.paletteVersion)||palette(answer.outputs)!==answer.paletteVersion||answer.outputs.some((item,index)=>
          !layoutKeys(item,['port','enabled','pixels','reversed','colour'])||['port','enabled','pixels','reversed'].some(key=>item[key]!==request.outputs[index][key])))){pixelDiagnostic692('RUNTIME_PREVIEW_RECEIPT',(answer?.applied===true?1:0)|(answer?.port===request.port?2:0)|(answer?.pixels===request.pixels?4:0)|(answer?.previewTTLMS===0?8:0)|(answer?.guide===(request.guide||'length')?16:0));throw fail('PIXEL_PREVIEW_UNCONFIRMED');}
      return answer;
    },
    async select({standId,transactionId,receiver}){return call('select',{standId,transactionId,receiver:{id:receiver.id,rid:receiver.rid,type:receiver.type}});},
    async secure({configuration,pin,signal}){return call('secure',{configuration,...(root.AluvisionSecurityMode?.pinRequired===false||configuration?.role==='node'?{}:{pin})},signal);},
    async reconcileSecurity({configuration,signal}){return call('reconcileSecurity',{configuration},signal);},
    async eraseAppData({confirmation}){
      if(confirmation!=='Alles verwijderen')throw fail('CONFIRMATION_REQUIRED');
      contextTimers.forEach(timer=>root.clearTimeout(timer));contextTimers.clear();contextEpochs.clear();contextJobs.clear();contextResetEpoch++;
      root.clearTimeout(contextDiscoveryTimer);contextDiscoveryTimer=null;
      const next=writeQueue.catch(()=>{}).then(()=>call('eraseAppData',{confirmation}));trackWrite(next);
      const answer=await next;
      if(answer?.status!=='erased-local-only')throw fail('ERASE_UNCONFIRMED');
      viewRevision=0;viewLoaded=false;viewModelKey=null;viewDraftKey='null';
      return answer;
    },
    async whenLiveReady(){
      // No radio, cancellation or authority grant: only settle the current
      // local persistence queue before the LIVE queue freezes its latest intent.
      // applyLive/Batch keep the original independent wait and native guards.
      while(true){
        const writes=writeQueue;await writes.catch(()=>{});
        if(writes!==writeQueue)continue;
        if(!viewLoaded)throw fail('VIEW_NOT_LOADED');
        return;
      }
    },
    applyStaticGesture({requests,held=false}={}){
      let requestId=null,settled=false,closed=false,inFlight=false,endRequested=!held,postedHeld=false,sequence=1,payload,stagedSequence=1,expectedPorts,geometry,centralBinding=null;
      const ledger=new Map(),controller=new AbortController(),copy=value=>JSON.parse(JSON.stringify(value));
      let openingTimer=null,resolveOpening;
      const openingReady=new Promise(resolve=>{resolveOpening=resolve;});
      const finishOpening=()=>{if(openingTimer!==null)root.clearTimeout(openingTimer);openingTimer=null;resolveOpening();};
      const shape=request=>{
        const scene=request?.scene;
        if(!['RGBW_SCENE','SPI_SCENE'].includes(request?.kind)||request.brightness<1||request.brightness>100||
           request.transitionMs<0||request.transitionMs>750||!scene||scene.engine!=='STATIC'||scene.variant!==0||
           scene.palette.length!==1||scene.backgroundOn||scene.v30!==undefined||scene.standAnimation!==undefined||
           scene.phaseMs!==undefined||scene.phaseRateMicroHz!==undefined)return null;
        const normalized=copy(request);normalized.brightness=1;normalized.scene.palette=[];return JSON.stringify(normalized);
      };
      const uniform=members=>members.every(item=>shape(item)!==null&&item.brightness===members[0].brightness&&
        item.transitionMs===members[0].transitionMs&&JSON.stringify(item.scene.palette)===JSON.stringify(members[0].scene.palette));
      const selection=()=>{
        let model;if(centralBinding){model=centralProjectionModel;if(!model)throw fail('VIEW_NOT_LOADED');}
        else try{model=JSON.parse(viewModelKey);}catch(_){throw fail('VIEW_NOT_LOADED');}
        const rows=payload.map(request=>{
          const matches=model.receivers.filter(row=>row.id===request.receiverId&&row.standId===request.standId&&row.lifecycle==='added');
          if(matches.length!==1||matches[0].type!==(request.kind==='SPI_SCENE'?'SPI':'RGBW'))throw fail('LIVE_INVALID');
          const row=matches[0];return {id:row.id,rid:row.rid,standId:row.standId,type:row.type,role:row.role,lifecycle:row.lifecycle,deviceFingerprint:row.deviceFingerprint,outputs:row.outputs};
        });
        const ports=rows.reduce((n,row)=>n+(row.type==='RGBW'?1:Array.isArray(row.outputs)?row.outputs.filter(output=>output.enabled===true).length:0),0);
        if(ports<rows.length||ports>24)throw fail('LIVE_INVALID');
        const zones=model.stands.find(stand=>stand.id===payload[0].standId)?.zones?.map(zone=>({id:zone.id,receiverIds:zone.receiverIds,layout:zone.layout,lineOrder:zone.lineOrder}));
        return {ports,geometry:canonical({rows,zones})};
      };
      const end=()=>{
        endRequested=true;
        if(settled||closed)return Promise.resolve({status:'ended',submitted:false});
        if(inFlight)return Promise.resolve({status:'deferred',submitted:false});
        if(!requestId||!postedHeld)return Promise.resolve({status:'ended',submitted:false});
        postedHeld=false;
        return call('endStaticGesture',{requestId,standId:payload[0].standId,receiverIds:payload.map(item=>item.receiverId)}).then(answer=>{
          if(!answer||Object.keys(answer).length!==1||answer.status!=='static-gesture-ended')throw fail('LIVE_UNCONFIRMED');
          return {status:'ended',submitted:true};
        }).catch(()=>{closed=true;controller.abort();return {status:'unknown',submitted:true};});
      };
      const operation=(async()=>{
        if(typeof held!=='boolean'||!Array.isArray(requests)||requests.length<1||requests.length>6)throw fail('LIVE_INVALID');
        payload=requests.map(livePayload);
        if(new Set(payload.map(item=>item.receiverId)).size!==payload.length||payload.some(item=>item.standId!==payload[0].standId)||!uniform(payload)){
          observeStaticRoute('STATIC_PROFILE',payload.length);return {status:'static-gesture-unavailable-before-open'};
        }
        if(staticGestureAvailable===null||standSessionStaticGestureAvailable===null)await runtimeCapabilities();
        if(centralStamp){
          if(standSessionStaticGestureAvailable!==true){observeStaticRoute('CENTRAL_CAP_OFF',payload.length);return {status:'static-gesture-unavailable-before-open'};}
          if(payload[0].standId!==centralStamp.standId||centralStamp.configRevision>4294967295||
             !(/^[A-F0-9]{16}$/.test(centralStamp.bootId))||/^0+$/.test(centralStamp.bootId)){
            observeStaticRoute('CENTRAL_BINDING',payload.length);return {status:'static-gesture-unavailable-before-open'};
          }
          centralBinding={...centralStamp};
        }else if(staticGestureAvailable!==true){observeStaticRoute('LEGACY_CAP_OFF',payload.length);return {status:'static-gesture-unavailable-before-open'};}
        else if(!legacyContextAllowed()){observeStaticRoute('LEGACY_CONTEXT_SELECTED',payload.length);return {status:'static-gesture-unavailable-before-open'};}
        await writeQueue.catch(()=>{});if(!viewLoaded||!contextVisible())throw fail('VIEW_NOT_LOADED');
        if(centralBinding){
          if(standSessionStaticGestureAvailable!==true||!centralStamp||centralStamp.standId!==centralBinding.standId||centralStamp.configRevision!==centralBinding.configRevision||centralStamp.bootId!==centralBinding.bootId){
            observeStaticRoute('CENTRAL_RECHECK',payload.length);return {status:'static-gesture-unavailable-before-open'};
          }
        }else if(staticGestureAvailable!==true){observeStaticRoute('RECHECK_CAP_OFF',payload.length);return {status:'static-gesture-unavailable-before-open'};}
        else if(!legacyContextAllowed()){observeStaticRoute('RECHECK_CONTEXT',payload.length);return {status:'static-gesture-unavailable-before-open'};}
        ({ports:expectedPorts,geometry}=selection());
        ledger.set(1,copy(payload));postedHeld=!endRequested||inFlight;
        try{
          observeStaticRoute('NATIVE_ENTRY',payload.length);
          const answer=await call('applyStaticGesture',{requests:payload,held:postedHeld},controller.signal,undefined,id=>{requestId=id;Promise.resolve().then(finishOpening);});
          if(answer?.status==='static-gesture-unavailable-before-open'&&Object.keys(answer).length===1){observeStaticRoute('NATIVE_RETURNED_UNAVAILABLE',payload.length);return answer;}
          if(!answer||Object.keys(answer).length!==(centralBinding?8:5)||answer.status!=='static-gesture-complete'||
             !Number.isInteger(answer.sequence)||!ledger.has(answer.sequence)||answer.sequence<stagedSequence||
             !Array.isArray(answer.receiverIds)||answer.receiverIds.length!==payload.length||
             answer.receiverIds.some((id,index)=>id!==payload[index].receiverId)||
             answer.ports!==expectedPorts||selection().geometry!==geometry||!contextVisible()||
             (centralBinding?(!centralStamp||centralStamp.standId!==centralBinding.standId||centralStamp.configRevision!==centralBinding.configRevision||centralStamp.bootId!==centralBinding.bootId||
               answer.standId!==centralBinding.standId||answer.configRevision!==centralBinding.configRevision||answer.bootId!==centralBinding.bootId):!legacyContextAllowed())||
             centralBinding&&/^0+$/.test(answer.witness||'')||
             typeof answer.witness!=='string'||!/^([A-F0-9]{64})$/.test(answer.witness))throw fail('LIVE_UNCONFIRMED');
          return {...answer,requests:copy(ledger.get(answer.sequence))};
        }finally{settled=true;requestId=null;}
      })().finally(()=>{settled=true;requestId=null;finishOpening();});
      Object.defineProperty(operation,'updateStaticGesture',{value:replacement=>{
        if(settled||closed||inFlight||endRequested||sequence>=65535||!Array.isArray(replacement)||replacement.length!==payload?.length)
          return Promise.resolve({status:'unavailable',submitted:false});
        let normalized;try{normalized=replacement.map(livePayload);}catch(_){return Promise.resolve({status:'unavailable',submitted:false});}
        if(!uniform(normalized)||normalized.some((item,index)=>shape(item)!==shape(payload[index])))return Promise.resolve({status:'unavailable',submitted:false});
        // A cold capability/local-write wait is not a closed stream. Reserve
        // one replacement, retain the queue's newest successor, and wait only
        // for the original native ticket; no sequence or staged ACK is invented.
        inFlight=true;
        return (async()=>{
          if(!requestId){
            openingTimer=root.setTimeout(()=>{closed=true;controller.abort();finishOpening();},45000);
            await openingReady;
          }
          if(settled||closed||!requestId)return {status:'unavailable',submitted:false};
          const submitted=++sequence;ledger.set(submitted,copy(normalized));
          return call('updateStaticGesture',{requestId,sequence:submitted,requests:normalized}).then(answer=>{
            if(!answer||Object.keys(answer).length!==2||answer.sequence!==submitted||!['static-gesture-staged','static-gesture-unavailable'].includes(answer.status))throw fail('LIVE_UNCONFIRMED');
            if(answer.status==='static-gesture-unavailable'){ledger.delete(submitted);closed=true;controller.abort();return {status:'unavailable',sequence:submitted,submitted:true};}
            stagedSequence=submitted;for(const key of ledger.keys())if(key>1&&key<submitted)ledger.delete(key);
            return {status:'staged',sequence:submitted,submitted:true};
          }).catch(()=>{closed=true;controller.abort();return {status:'unknown',sequence:submitted,submitted:true};});
        })().finally(()=>{inFlight=false;if(endRequested&&!closed)void end();});
      }});
      Object.defineProperty(operation,'endStaticGesture',{value:end});
      Object.defineProperty(operation,'stopStaticGesture',{value:()=>{closed=true;controller.abort();finishOpening();}});
      return operation;
    },
    async applyLive(request){
      const payload=livePayload(request),{receiverId}=payload;
      if(payload.kind==='SPI_PORTS'){if(spiPortScenesAvailable===null)await runtimeCapabilities();if(spiPortScenesAvailable!==true)throw fail('SPI_PORT_SCENES_UNSUPPORTED');}
      if(payload.scene?.standAnimation){if(standAnimationCapability()===null)await runtimeCapabilities();if(standAnimationCapability()!==true)throw fail('LIVE_CONTROL_STAND_UNAVAILABLE');}
      await writeQueue.catch(()=>{});
      if(!viewLoaded)throw fail('VIEW_NOT_LOADED');
      const result=await call('applyLive',payload);
      if(result?.status!=='applied-in-firmware'||result.receiverId!==receiverId||!Number.isSafeInteger(result.generation)||result.generation<1)throw fail('LIVE_UNCONFIRMED');
      return {status:'applied-in-firmware',receiverId,generation:result.generation};
    },
    applyLiveBatch({requests}={}){
      let requestId=null,settled=false,payload,ids,preparing=false,sequence=0,replacementClosed=false,replacementInFlight=false,acceptedSequence=0;
      let retirementSequence=0,retirementInFlight=false,retirementNoticeId=null,posted;
      const retirementLedger=new Set(),postedReady=new Promise(resolve=>{posted=resolve;});
      const ledger=new Map();
      const copy=value=>JSON.parse(JSON.stringify(value));
      const staticShape=request=>{
        const scene=request?.scene;
        if(!['RGBW_SCENE','SPI_SCENE'].includes(request?.kind)||request.brightness<1||request.brightness>100||
           !scene||scene.engine!=='STATIC'||scene.variant!==0||scene.palette.length!==1||scene.backgroundOn||
           scene.v30!==undefined||scene.standAnimation!==undefined||scene.phaseMs!==undefined||scene.phaseRateMicroHz!==undefined)return null;
        const shape=copy(request);shape.brightness=1;shape.scene.palette=[];return JSON.stringify(shape);
      };
      const scopedMoving=request=>{
        if(request?.kind!=='SPI_PORTS'||!Array.isArray(request.portScenes)||!request.portScenes.length||request.portScenes.length>4)return false;
        let previous=0,common=null;
        return request.portScenes.every(child=>{
          const {port,...recipe}=child,scene=child.scene;
          if(!Number.isInteger(port)||port<=previous||port>4||child.kind!=='SPI_SCENE'||child.brightness<=0||
             !scene||!['CHASE','WAVE','BREATHE'].includes(scene.engine)||scene.backgroundOn!==false||
             scene.v30!==undefined||scene.standAnimation!==undefined||
             !Number.isInteger(scene.phaseMs)||!Number.isInteger(scene.phaseRateMicroHz)||scene.phaseRateMicroHz<=0)return false;
          previous=port;const shape=JSON.stringify(recipe);
          if(common!==null&&shape!==common)return false;common=shape;return true;
        });
      };
      // Intent classification only. Native independently chooses/admit the
      // guarded mixed bank; no capability, mask, clock or authority is granted.
      const mixedFixedBank=values=>{
        if(!values.some(r=>r.kind==='RGBW_SCENE')||!values.some(r=>r.kind==='SPI_SCENE'||r.kind==='SPI_PORTS'))return false;
        // A complete bare mixed STATIC group with one exact foreground uses
        // native's quoted immediate lane, including its existing pre-cut latest
        // replacement. Brightness, SMOOTH and transition remain each receiver's
        // original intent. Native independently rechecks every identity/GEN;
        // this routing hint never enables the disabled iOS gesture stream.
        if(values.length>=2&&values.length<=30&&values.every(request=>
          ['RGBW_SCENE','SPI_SCENE'].includes(request.kind)&&staticShape(request)!==null&&
          JSON.stringify(request.scene.palette)===JSON.stringify(values[0].scene.palette)))return false;
        // Match native canonicalFixedStaticDelivery, without changing the
        // original payload. This narrow STATIC profile does not render the
        // previous animation's speed/background/motion/geometry parameters.
        // Each receiver keeps its own foreground (including W), SMOOTH,
        // brightness and transition. Only selected SPI children WITHIN one
        // receiver must agree. Native independently admits the exact-recipe
        // groups/common clock and retains all original identity/port scopes.
        const recipe=r=>JSON.stringify([r.scene.palette,r.scene.smooth,r.brightness,r.transitionMs,r.channels]);
        // Shipping bound only: three or more distinct visible recipes retain
        // the previous preparing/envelope route instead of reserving a long
        // multi-bank start. This grants no native clock or delivery authority.
        const recipes=new Set();
        return values.every(request=>{
          const children=request.kind==='SPI_PORTS'?(request.portScenes||[]).map(({port,...child})=>child):[request];
          if(!children.length||children.some(r=>!['RGBW_SCENE','SPI_SCENE'].includes(r.kind)||staticShape(r)===null))return false;
          const key=recipe(children[0]);
          if(!children.every(r=>recipe(r)===key))return false;
          recipes.add(key);return recipes.size<=2;
        });
      };
      const operation=(async()=>{
        if(!Array.isArray(requests)||requests.length<1||requests.length>30||requests.some(request=>!request||typeof request!=='object'||Array.isArray(request)))throw fail('LIVE_INVALID');
        payload=requests.map(livePayload);ids=new Set(payload.map(request=>request.receiverId));
        if(payload.some(request=>request.kind==='SPI_PORTS')){if(spiPortScenesAvailable===null)await runtimeCapabilities();if(spiPortScenesAvailable!==true)throw fail('SPI_PORT_SCENES_UNSUPPORTED');}
        if(payload.some(request=>request.scene?.standAnimation)){if(standAnimationCapability()===null)await runtimeCapabilities();if(standAnimationCapability()!==true)throw fail('LIVE_CONTROL_STAND_UNAVAILABLE');}
        if(ids.size!==payload.length||payload.some(request=>request.standId!==payload[0].standId))throw fail('LIVE_INVALID');
        if(staticPreparingAvailable===null)await runtimeCapabilities();
        preparing=staticPreparingAvailable===true&&centralStamp===null&&payload.length>1&&
          !mixedFixedBank(payload)&&payload.every(request=>staticShape(request)!==null);
        if(preparing)ledger.set(0,copy(payload));
        await writeQueue.catch(()=>{});
        if(!viewLoaded)throw fail('VIEW_NOT_LOADED');
        try{
          const answer=await call('applyLiveBatch',{requests:payload,...(preparing?{preparingStatic:true}:{})},undefined,undefined,id=>{requestId=id;posted();});
          if(answer?.status==='early-animation-retired'){
            if(Object.keys(answer).sort().join(',')!=='receiverIds,requestId,sequence,status'||
               answer.requestId!==requestId||!retirementLedger.has(answer.sequence)||
               !Array.isArray(answer.receiverIds)||answer.receiverIds.length!==ids.size||
               new Set(answer.receiverIds).size!==ids.size||answer.receiverIds.some(id=>!ids.has(id)))throw fail('LIVE_UNCONFIRMED');
            return {status:'early-animation-retired',receiverIds:[...ids],sequence:answer.sequence};
          }
          if(answer?.status==='batch-superseded-before-dispatch'){
            if(Object.keys(answer).length!==2||!Array.isArray(answer.receiverIds)||answer.receiverIds.length!==ids.size||
               new Set(answer.receiverIds).size!==ids.size||answer.receiverIds.some(id=>!ids.has(id)))throw fail('LIVE_UNCONFIRMED');
            return {status:'batch-superseded-before-dispatch',receiverIds:[...ids]};
          }
          if(answer?.status!=='batch-complete'||!Array.isArray(answer.results)||answer.results.length!==payload.length)throw fail('LIVE_UNCONFIRMED');
          if(preparing&&(!Number.isInteger(answer.preparingSequence)||!ledger.has(answer.preparingSequence)||
             answer.preparingSequence<acceptedSequence||Object.keys(answer).length!==3||
             answer.results.some(result=>result?.status!=='applied-in-firmware')))throw fail('LIVE_UNCONFIRMED');
          const results=answer.results.map(result=>{
            if(!result||!ids.delete(result.receiverId))throw fail('LIVE_UNCONFIRMED');
            if(result.status==='applied-in-firmware'&&Number.isSafeInteger(result.generation)&&result.generation>=1)return {receiverId:result.receiverId,status:result.status,generation:result.generation};
            if(['unconfirmed','not-sent'].includes(result.status)&&typeof result.code==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(result.code))return {receiverId:result.receiverId,status:result.status,code:result.code};
            throw fail('LIVE_UNCONFIRMED');
          });
          return {status:'batch-complete',results,...(preparing?{
            preparingSequence:answer.preparingSequence,preparingRequests:copy(ledger.get(answer.preparingSequence))}:{})};
        }finally{
          settled=true;requestId=null;posted();
          // The original task has settled. Retire only its exact local notice
          // observer/timer; no native cancellation, Owner release or success.
          if(retirementNoticeId!==null){const id=retirementNoticeId;retirementNoticeId=null;receive({id,ok:false,code:'CANCELLED'});}
        }
      })();
      operation.then(()=>posted(),()=>posted());
      Object.defineProperty(operation,'retireEarlyAnimation',{value:replacement=>{
        if(settled||retirementInFlight||retirementSequence>=65535)return Promise.resolve({status:'unavailable'});
        let normalized;
        try{normalized=replacement.map(livePayload);}catch(_){return Promise.resolve({status:'unavailable'});}
        retirementInFlight=true;
        return postedReady.then(()=>{
          if(settled||!requestId||!payload||preparing||centralStamp!==null||normalized.length!==payload.length||
             payload.some(r=>!scopedMoving(r)&&(!r.scene||r.brightness<=0||r.kind==='SPI_PORTS'||r.scene.engine==='STATIC'&&!r.scene.v30)))return {status:'unavailable'};
          const expected=new Set(payload.map(r=>r.receiverId));
          // livePayload already closed-validates each SPI child and port list.
          // This is only a yield notice: native independently checks the fresh
          // original full physical coverset before retiring its active task.
          if(normalized.some(r=>r.standId!==payload[0].standId||!['RGBW_SCENE','SPI_SCENE','SPI_PORTS'].includes(r.kind)||
             (r.kind!=='SPI_PORTS'&&!r.scene)||!expected.delete(r.receiverId))||expected.size)return {status:'unavailable'};
          const submitted=++retirementSequence;retirementLedger.add(submitted);
          // This is a local yield notice, never a submitted lighting version.
          // Lost notice ACK cannot discard the queue's newer desired intent.
          let noticeId=null;
          return call('yieldEarlyAnimation',{requestId,sequence:submitted,requests:normalized},undefined,undefined,id=>{noticeId=id;retirementNoticeId=id;}).then(answer=>{
            if(!answer||Object.keys(answer).length!==2||answer.sequence!==submitted||
               !['early-animation-retirement-requested','early-animation-retirement-unavailable'].includes(answer.status))throw fail('LIVE_UNCONFIRMED');
            return {status:answer.status==='early-animation-retirement-requested'?'requested':'unavailable',sequence:submitted};
          }).catch(()=>({status:'unknown',sequence:submitted})).finally(()=>{if(retirementNoticeId===noticeId)retirementNoticeId=null;});
        }).finally(()=>{retirementInFlight=false;});
      }});
      Object.defineProperty(operation,'supersedePreparing',{value:replacement=>{
        if(settled||!requestId||!payload||!Array.isArray(replacement)||replacement.length!==payload.length)return Promise.resolve(false);
        const expected=new Set(payload.map(request=>request.receiverId));
        if(replacement.some(request=>!request||request.standId!==payload[0].standId||!expected.delete(request.receiverId))||expected.size)return Promise.resolve(false);
        return call('supersedeLivePreparing',{requestId,standId:payload[0].standId,receiverIds:payload.map(request=>request.receiverId)})
          .then(answer=>answer?.status==='preparing-supersession-requested',()=>false);
      }});
      Object.defineProperty(operation,'replacePreparingStatic',{value:replacement=>{
        if(settled||replacementClosed||replacementInFlight||!preparing||!requestId||sequence>=65535||!Array.isArray(replacement)||replacement.length!==payload.length)
          return Promise.resolve({status:'unavailable',submitted:false});
        let normalized;
        try{normalized=replacement.map(livePayload);}catch(_){return Promise.resolve({status:'unavailable',submitted:false});}
        if(normalized.some((request,index)=>staticShape(request)===null||staticShape(request)!==staticShape(payload[index])))
          return Promise.resolve({status:'unavailable',submitted:false});
        const submittedSequence=++sequence;replacementInFlight=true;ledger.set(submittedSequence,copy(normalized));
        return call('replacePreparingStatic',{requestId,sequence:submittedSequence,requests:normalized}).then(answer=>{
          if(!answer||Object.keys(answer).length!==2||answer.sequence!==submittedSequence||
             !['preparing-static-accepted','preparing-static-unavailable'].includes(answer.status))throw fail('LIVE_UNCONFIRMED');
          if(answer.status==='preparing-static-unavailable'){
            ledger.delete(submittedSequence);replacementClosed=true;
            return {status:'unavailable',sequence:submittedSequence,submitted:true};
          }
          // A newer accepted sequence proves an older one cannot be chosen at
          // the single native cut. Retain only original/latest/in-flight data.
          for(const key of ledger.keys())if(key>0&&key<submittedSequence)ledger.delete(key);
          acceptedSequence=submittedSequence;
          return {status:'accepted',sequence:submittedSequence,submitted:true};
        }).catch(()=>{replacementClosed=true;return {status:'unknown',sequence:submittedSequence,submitted:true};})
          .finally(()=>{replacementInFlight=false;});
      }});
      return operation;
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
    async identifyLayout(payload){
      if(!layoutKeys(payload,['session','standId','zoneId','lines','ttlMs'])||!layoutUUID(payload.session)||
          !layoutId(payload.standId)||!layoutId(payload.zoneId)||!Number.isInteger(payload.ttlMs)||payload.ttlMs<1||payload.ttlMs>30000||
          !Array.isArray(payload.lines)||payload.lines.length<1||payload.lines.length>120)throw fail('IDENTIFY_INVALID');
      const ids=new Set();
      for(let i=0;i<payload.lines.length;i++){
        if(!Object.prototype.hasOwnProperty.call(payload.lines,i))throw fail('IDENTIFY_INVALID');
        const line=payload.lines[i];
        if(!layoutKeys(line,['id','receiverId','port','rgb','colorName'])||!layoutId(line.receiverId)||!Number.isInteger(line.port)||line.port<0||line.port>4||
            !layoutId(line.id)||line.id!==line.receiverId+':'+line.port||ids.has(line.id)||typeof line.colorName!=='string'||!line.colorName||layoutTextBytes(line.colorName)>96||
            !Array.isArray(line.rgb)||line.rgb.length!==3||![0,1,2].every(i=>Object.prototype.hasOwnProperty.call(line.rgb,i)&&Number.isInteger(line.rgb[i])&&line.rgb[i]>=0&&line.rgb[i]<=255))throw fail('IDENTIFY_INVALID');
        ids.add(line.id);
      }
      const began=layoutNow(),deadline=began+payload.ttlMs;
      pruneLayoutSessions();
      let session=layoutSessions.get(payload.session);
      if(!session){if(layoutSessions.size>=1024)throw fail('IDENTIFY_BUSY');session={closed:false,standId:payload.standId,zoneId:payload.zoneId,ids:[...ids].sort().join('|')};layoutSessions.set(payload.session,session);}
      if(session.closed||session.standId!==payload.standId||session.zoneId!==payload.zoneId||session.ids!==[...ids].sort().join('|'))throw fail('IDENTIFY_CANCELLED');
      const copied=JSON.parse(JSON.stringify(payload));
      await writeQueue.catch(()=>{});
      if(!viewLoaded)throw fail('VIEW_NOT_LOADED');
      const now=layoutNow(),ttlMs=Math.min(payload.ttlMs,Math.floor(deadline-now));
      if(session.closed||!Number.isFinite(now)||now<began||ttlMs<=0)throw fail('IDENTIFY_CANCELLED');
      const result=await call('identifyLayout',{...copied,ttlMs});
      if(session.closed)throw fail('IDENTIFY_CANCELLED');
      if(!layoutKeys(result,['confirmed','session','lineIds','ttlMs'])||result.confirmed!==true||result.session!==payload.session||
          !Array.isArray(result.lineIds)||result.lineIds.length!==ids.size||new Set(result.lineIds).size!==ids.size||
          ![...result.lineIds].every(id=>ids.has(id))||!Number.isInteger(result.ttlMs)||result.ttlMs<=0||result.ttlMs>ttlMs)throw fail('IDENTIFY_UNCONFIRMED');
      return result;
    },
    async stopLayoutIdentification(payload){
      if(!layoutKeys(payload,['session','standId','zoneId','lineIds'])||!layoutUUID(payload.session)||!layoutId(payload.standId)||!layoutId(payload.zoneId)||
          !Array.isArray(payload.lineIds)||payload.lineIds.length<1||payload.lineIds.length>120||new Set(payload.lineIds).size!==payload.lineIds.length||
          ![...payload.lineIds].every(layoutId))throw fail('IDENTIFY_INVALID');
      const session=layoutSessions.get(payload.session);
      if(session){
        if(session.standId!==payload.standId||session.zoneId!==payload.zoneId||session.ids!==[...payload.lineIds].sort().join('|'))throw fail('IDENTIFY_INVALID');
        session.closed=true;session.retireAfter=layoutNow()+60000;
      }else{
        pruneLayoutSessions();if(layoutSessions.size>=1024)throw fail('IDENTIFY_BUSY');
        layoutSessions.set(payload.session,{closed:true,retireAfter:layoutNow()+60000,standId:payload.standId,zoneId:payload.zoneId,ids:[...payload.lineIds].sort().join('|')});
      }
      const result=await call('stopLayoutIdentification',JSON.parse(JSON.stringify(payload)));
      if(!layoutKeys(result,['stopped'])||typeof result.stopped!=='boolean')throw fail('IDENTIFY_UNCONFIRMED');
      return result;
    },
    async blinkLayoutIdentification(payload){
      if(!layoutKeys(payload,['session','standId','zoneId','lineId','enabled'])||!layoutUUID(payload.session)||
          !layoutId(payload.standId)||!layoutId(payload.zoneId)||!layoutId(payload.lineId)||typeof payload.enabled!=='boolean')throw fail('IDENTIFY_INVALID');
      const copied=JSON.parse(JSON.stringify(payload)),session=layoutSessions.get(copied.session),began=layoutNow();
      if(!session||session.closed||session.standId!==copied.standId||session.zoneId!==copied.zoneId||
          !session.ids.split('|').includes(copied.lineId)||!Number.isFinite(began))throw fail('IDENTIFY_CANCELLED');
      await writeQueue.catch(()=>{});
      if(!viewLoaded)throw fail('VIEW_NOT_LOADED');
      const before=layoutNow();
      if(session.closed||layoutSessions.get(copied.session)!==session||!Number.isFinite(before)||before<began)throw fail('IDENTIFY_CANCELLED');
      const result=await call('blinkLayoutIdentification',copied);
      const after=layoutNow();
      if(session.closed||layoutSessions.get(copied.session)!==session||!Number.isFinite(after)||after<before)throw fail('IDENTIFY_CANCELLED');
      if(!layoutKeys(result,['confirmed','session','lineId','enabled','ttlMs'])||result.confirmed!==true||
          result.session!==copied.session||result.lineId!==copied.lineId||result.enabled!==copied.enabled||
          !Number.isInteger(result.ttlMs)||(copied.enabled?result.ttlMs<1||result.ttlMs>5000:result.ttlMs!==0))throw fail('IDENTIFY_UNCONFIRMED');
      return result;
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
  async function runtimeCapabilities(){const value=await call('capabilities');selectionHaptics=value?.selectionHaptics===true;interfaceHaptics=value?.interfaceHaptics===true;simpleStandAvailable=value?.simpleStand===true;pixelPreviewV50=value?.pixelPreviewV50===true;spiZoneDirectionPreview=value?.spiZoneDirectionPreview===true;atomicPreviewExitAvailable=value?.atomicPreviewExit579===true;pixelEditorIsolationAvailable=value?.pixelEditorIsolation===true;setupZoneIsolationAvailable=value?.setupZoneIsolation===true;
    pixelReceiptDiagnostics692=value?.pixelReceiptDiagnostics692===true;
    spiPortScenesAvailable=value?.spiPortScenes===true;
    standSessionReceiverManagementAvailable=simpleStandAvailable&&value?.standSessionReceiverManagement===true;
    standSessionOutputsAvailable=simpleStandAvailable&&value?.standSessionOutputs===true;
    standMigrationReady=simpleStandAvailable&&value?.simpleStandMigrationReady===true;
    standMigrationBlockedReason=['CURRENT_RECEIVER_OTHER_STAND','CURRENT_STAND_CREDENTIAL_CONFLICT'].includes(value?.simpleStandMigrationBlockedReason)?value.simpleStandMigrationBlockedReason:'NONE';
    firstStandAccessDiagnosticsAvailable=simpleStandAvailable&&value?.firstStandAccessDiagnostics===true;
    standWifiOpenAvailable=simpleStandAvailable&&value?.standWifiOpen===true;
    standSharingAvailable=simpleStandAvailable&&value?.simpleStandShare===true;
    standScanAvailable=simpleStandAvailable&&value?.simpleStandScan===true;
    standLinkAvailable=simpleStandAvailable&&value?.simpleStandLink===true;
    standShareSheetAvailable=simpleStandAvailable&&value?.simpleStandShareSheet===true;
    legacyStandAnimationsAvailable=simpleStandAvailable?value?.legacyStandAnimations===true:value?.standAnimations===true;
    standSessionAnimationsAvailable=value?.standSessionAnimations===true;
    staticPreparingAvailable=value?.staticPreparingReplacement===true;staticGestureAvailable=value?.nativeStaticGesture===true;standSessionStaticGestureAvailable=value?.standSessionStaticGesture===true;return value;}
  function standAnimationCapability(){
    if(centralStamp)return standSessionAnimationsAvailable;
    // Merely implementing the new connection service does not select it. But
    // entering a real connection/migration or observing an existing session
    // can never silently fall back after disconnect or an uncertain reply.
    if(centralFlowEntered||standSessionObserved)return false;
    return legacyStandAnimationsAvailable;
  }
  async function requireSimpleStand(){if(simpleStandAvailable===null)await runtimeCapabilities();if(simpleStandAvailable!==true||!root.LightningStandConnection)throw fail('STAND_CONNECTION_UNAVAILABLE');}
  function validCentralStamp(value){return value&&Number.isSafeInteger(value.configRevision)&&value.configRevision>=0&&Number.isSafeInteger(value.stateRevision)&&value.stateRevision>=0&&
    typeof value.bootId==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,95}$/.test(value.bootId);}
  function acceptCentral(result,expectedStandId){
    const projection=root.LightningStandConnection.projection(result,expectedStandId);
    // Local old journals and central revisions are different namespaces. A
    // new MAIN boot/download is allowed only after this verified projection.
    centralStamp={standId:projection.standId,configRevision:projection.configRevision,stateRevision:projection.stateRevision,bootId:projection.bootId};
    centralProjectionModel=projection.view.model;
    viewLoaded=true;
    return JSON.parse(JSON.stringify(result));
  }
  function acceptManagementView(view,before,intent){
    const incoming=view?.central;
    const transition=incoming?.managementTransition;
    const bootOK=incoming?.bootId===before.bootId&&transition===undefined || root.LightningStandConnection.managementTransition(transition,before,incoming,intent);
    if(!incoming||!validCentralStamp(incoming)||incoming.standId!==before.standId||!bootOK||incoming.configRevision<before.configRevision||incoming.stateRevision<before.stateRevision||
       !centralStamp||incoming.configRevision<centralStamp.configRevision||incoming.stateRevision<centralStamp.stateRevision||view.draft!==null||membershipKey(view.model)!==membershipKey(incoming.view?.model))throw fail('STAND_SAVE_UNCONFIRMED');
    acceptCentral(incoming,before.standId);
    acceptView(view);
    return JSON.parse(JSON.stringify({...view,model:incoming.view.model}));
  }
  function installPreparedManagementView(view,before,epoch){
    const standId=before.standId;
    if(epoch!==standSharingEpoch||!centralStamp||centralStamp.standId!==standId||centralStamp.bootId!==before.bootId||!contextVisible()||
       !Number.isSafeInteger(view?.revision)||view.revision<0||view.draft!==null&&(!view.draft||typeof view.draft!=='object'||Array.isArray(view.draft)))throw fail('STAND_CONNECTION_CANCELLED');
    const incoming=view.central;
    if(!incoming||incoming.standId!==standId||incoming.bootId!==before.bootId||incoming.configRevision<before.configRevision||incoming.stateRevision<before.stateRevision||membershipKey(view.model)!==membershipKey(incoming.view?.model))throw fail('STAND_SAVE_UNCONFIRMED');
    acceptCentral(incoming,standId);
    // The proof-bound local draft journal has its own revision namespace.
    viewRevision=view.revision;viewModelKey=canonical(view.model);viewDraftKey=canonical(view.draft);viewLoaded=true;managementPreparedStand=standId;
  }
  async function connectCentral(action,input){
    if(input!==undefined&&(!input||typeof input!=='object'||Array.isArray(input)))throw fail('STAND_CONNECTION_INVALID');
    await requireSimpleStand();
    input=JSON.parse(JSON.stringify(input||{}));
    const {payload:migration,...credentials}=input||{};
    const payload=action==='standOpenWifi'?root.LightningStandConnection.wifiInput(input):action==='standResume'?root.LightningStandConnection.resumeInput(input):root.LightningStandConnection.connectionInput(credentials);
    if(action==='standMigrate'){
      if(payload.joinWifi!==undefined)throw fail('STAND_CONNECTION_INVALID');
      root.LightningStandConnection.newCode(payload.standCode);
      if(!migration||Object.keys(migration).join(',')!=='operations'||!Array.isArray(migration.operations)||migration.operations.length<1||migration.operations.length>128)throw fail('STAND_MIGRATION_INVALID');
      payload.payload=JSON.parse(JSON.stringify(migration));
    }else if(migration!==undefined)throw fail('STAND_CONNECTION_INVALID');
    const epoch=standSharingEpoch;
    if(action==='standOpenWifi'&&!contextVisible())throw fail('STAND_CONNECTION_CANCELLED');
    if(centralConnectionAttemptExhausted||!Number.isSafeInteger(centralConnectionAttempt)||centralConnectionAttempt<0||centralConnectionAttempt>=Number.MAX_SAFE_INTEGER){
      centralConnectionAttemptExhausted=true;centralFlowEntered=true;throw fail('STAND_CONNECTION_CANCELLED');
    }
    const attempt=++centralConnectionAttempt,priorLegacy=legacyContextAllowed()&&contextVisible();
    if(action==='standOpenWifi'){centralStamp=null;centralProjectionModel=null;}
    centralFlowEntered=true;managementPreparedStand=null;
    try{
      const result=await call(action,payload);
      if(action==='standOpenWifi'&&(epoch!==standSharingEpoch||!contextVisible()))throw fail('STAND_CONNECTION_CANCELLED');
      if(['setup-required','migration-required'].includes(result?.status)){
        if(['standResume','standOpenWifi'].includes(action)){
          const inspection=root.LightningStandConnection.inspectionResult(result);
          // A first read-only inspection selected no session or mutation. Only
          // its current attempt may retain the previously available Owner UX;
          // native admission remains authoritative for every later command.
          if(priorLegacy&&!centralConnectionAttemptExhausted&&attempt===centralConnectionAttempt&&epoch===standSharingEpoch&&contextVisible()&&centralFlowEntered&&!standSessionObserved&&centralStamp===null)centralFlowEntered=false;
          return inspection;
        }
        if(result.initialized!==(result.status==='migration-required')||typeof result.ssid!=='string'||new TextEncoder().encode(result.ssid).length>32)throw fail('STAND_DATA_UNCONFIRMED');return result;
      }
      if(action==='standMigrate'&&result?.status==='reconnect-required'){
        if(result.initialized!==true||result.ssid!==payload.ssid||result.standId!==payload.expectedStandId||!validCentralStamp(result)||result.view!==undefined||result.libraries!==undefined)throw fail('STAND_MIGRATION_UNCONFIRMED');
        centralStamp=null;return result;
      }
      if(result?.status!=='connected')throw fail('STAND_CONNECTION_UNCONFIRMED');return acceptCentral(result,payload.expectedStandId);
    }finally{if(['standConnect','standMigrate'].includes(action))payload.standCode='';}
  }
  return Object.freeze({native,emptyModel,services,registerContextWriteBarrier,
    capabilities:runtimeCapabilities,
    get standAnimationsAvailable(){return standAnimationCapability();},
    get simpleStandAvailable(){return simpleStandAvailable;},
    selectionFeedback:()=>{
      if(!selectionHaptics||!transportReady)return false;
      // Presentation only; one outstanding tick cannot fill the bridge queue.
      if(!selectionFeedbackPending&&!interfaceFeedbackPending){selectionFeedbackPending=true;call('selectionFeedback').catch(()=>{}).finally(()=>{selectionFeedbackPending=false;});}
      return true;
    },
    interfaceFeedback:kind=>{
      // Never borrow a receiver/authentication action for optional feedback.
      // Leave at least six of the eight bridge slots free for actual work.
      if(!interfaceHaptics||!transportReady||!contextVisible()||
         !['selection','impact','success','warning'].includes(kind)||
         selectionFeedbackPending||interfaceFeedbackPending||pending.size>=2)return false;
      interfaceFeedbackPending=true;
      call('interfaceFeedback',{kind}).catch(()=>{}).finally(()=>{interfaceFeedbackPending=false;});
      return true;
    }});
});
