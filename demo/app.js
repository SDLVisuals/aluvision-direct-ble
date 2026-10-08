/* V30 interface: browser fixtures and native installation data stay separate.
 * Only narrowly supported light changes use confirmed native live control;
 * other changes remain visibly preview-only until their transport exists. */
(function () {
  'use strict';
  const M = window.LightningModel, P = window.LightningPreview, C = window.LightningColour, S = window.LightningPresets;
  const Colours = window.LightningColoursLibrary, Scenes = window.LightningScenes;
  const Preferences=window.LightningPreferences;
  const UIContinuity=window.LightningUIContinuity;
  const Backup=window.LightningBackup;
  const Library=window.LightningAnimationLibrary;
  const StandAnimations=window.LightningStandAnimations;
  const runtime=window.LightningNativeRuntime;
  const SimpleStand=window.LightningStandConnection;
  let standSharingController=null,standSharingMode=null,standSharingAvailable=false,standWifiOpenAvailable=false,standScanAvailable=false,standLinkAvailable=false,standShareSheetAvailable=false,standReceiverManagementAvailable=false,standLinkPending=false,standLinkJob=null;
  const standReceiverActions=new Set(['receiver-add','layout-receiver-add','layout-new-receiver','assignment-add-receiver','receiver-remove','receiver-update-all','receiver-update','receiver-pixel-setup','receiver-port-enabled','visual-identify','port-identify']);
  let standReceiverCapabilities=Object.freeze({});
  let standReceiverNotice=window.LightningStandManagementCapabilities.notice(standReceiverCapabilities);
  function standReceiverManagementUnavailable(){return simpleStandMode&&!!(centralApplied||centralPending||standSession?.snapshot()||standSession?.canResume())&&!standReceiverManagementAvailable;}
  function standReceiverActionUnavailable(action,button=null){
    if(['visual-identify','port-identify'].includes(action)&&button?.closest('.ledline-row-actions')){
      const r=model.receivers.find(receiver=>receiver.id===button.dataset.receiver),layout=orderIdentificationState;
      const port=r?.type==='RGBW'?0:Number(button.dataset.port),lineId=r?.id+':'+port;
      if(layout?.active&&layout.standId===r?.standId&&layout.zoneId===route.zoneId&&layout.lines.some(line=>line.id===lineId))action='order-identify';
    }
    return simpleStandMode&&!!(centralApplied||centralPending||standSession?.snapshot()||standSession?.canResume())&&window.LightningStandManagementCapabilities.blocked(action,standReceiverCapabilities);
  }
  let simpleStandMode=false,simpleStandSupported=false,standMigrationReady=false,standSession=null,centralApplied=null,centralPending=null;
  let centralPendingReadFence=null,standConnectionIntent='open',standManualEntry=false,firstFactorySetup=false;
  let legacyStandLandingId=null,legacyStandReturn=null;
  let centralLiveCheckpoint=null,centralLiveState={status:'idle',pending:0,busy:false,error:null};
  let standConnectionState={status:'disconnected',error:null},standNetworkName='',standInspectedNetworkName='',standConnectionBusy=false,standNetworkProbeAttempted=false,standNetworkLastProbeAt=-Infinity;
  // A local import-preparation failure is not receiver authentication state.
  // Keep its fixed, non-secret explanation across automatic public probes.
  let standMigrationPreflightError=null;
  let centralLibraryPending=null,centralLibraryTimer=null,centralLibraryWriting=false,centralLibraryStatusTicket=0;
  function pinRequired(){return window.AluvisionSecurityMode?.pinRequired!==false;}
  // An absent/failed native script must never turn the real app into a demo.
  const nativeContext=window.__lightningV30NativeHost===true||window.location.protocol==='file:'||runtime?.native===true;
  // Only the separate /demo/ path may invent receivers. The public root,
  // query flags and native iPhone bundle keep their non-demo paths.
  const webDemoContext=!nativeContext&&window.LightningWebDemo?.available===true;
  const webDemo=webDemoContext?window.LightningWebDemo.create():null;
  // The browser walkthrough has no PIN/share/open authority, even if an
  // obsolete action is injected. Fake onboarding remains the only setup.
  const demoAccessActions=new Set(['pin-login','pin-login-submit','pin-login-cancel','pin-protection-toggle','pin-protection-refresh','pin-protection-reconnect','pin-protection-recheck','pin-protection-save','stand-connect','stand-open-options','stand-connect-submit','stand-wifi-open','stand-join-open','stand-share-open','stand-code-suggest','stand-code-change','stand-code-change-submit','stand-setup-start','stand-migrate-submit','stand-inspect-submit','stand-find-submit','stand-show-loaded','stand-resume-submit','stand-refresh','stand-forget','stand-forget-confirm']);
  const localPreviewContext=!nativeContext&&['localhost','127.0.0.1','[::1]','::1'].includes(window.location.hostname)&&!webDemoContext;
  const previewContext=localPreviewContext||webDemoContext;
  let model = localPreviewContext ? window.LightningFixtures.create() : M.assertValid({schemaVersion:30,demo:webDemoContext,stands:[],receivers:[],scenes:[],presets:[]});
  let nativeLoaded=!nativeContext,nativeLoadError=false,nativeLoading=false;
  let route = {screen:'stand', zoneId:'zone-rgbw', family:null, library:'catalogue'};
  if(!nativeContext&&(!previewContext||webDemoContext))route={...route,screen:'receiver-add',setupFrom:'stand'};
  const selections = new Map();
  const expandedScopeZones = new Set();
  // A gallery search is browsing context, not a receiver setting. Keep it
  // through scope changes and editor returns, independently for each zone.
  const animationQueries = new Map();
  const animationGalleryPositions = new Map();
  const animationFamilyReturnPositions = new Map();
  // Brand presets share the colour library, independently of zone/receiver
  // state. Editing a brand swatch must never send light to a receiver.
  let brandEditor=null;
  const BRAND_TONES = Object.freeze([
    Object.freeze({id:'aluvision-rood',name:'Aluvision rood',value:'#C94E46'}),
    Object.freeze({id:'warm-amber',name:'Warm amber',value:'#E9A04B'}),
    Object.freeze({id:'zacht-roze',name:'Zacht roze',value:'#D97F9B'}),
    Object.freeze({id:'diep-blauw',name:'Diep blauw',value:'#4865C8'}),
    Object.freeze({id:'fris-turquoise',name:'Fris turquoise',value:'#36AFA4'}),
    Object.freeze({id:'zacht-violet',name:'Zacht violet',value:'#9272C8'})
  ]);
  const visualPorts = new Map(), visualPlugMotions=new Map(), identifying = new Map(), identifyPending = new Map(), expandedReceivers = new Set();
  function receiverPlugMotion(id){if(!visualPlugMotions.has(id))visualPlugMotions.set(id,window.LightningReceiverVisual.createPlugMotion());return visualPlugMotions.get(id);}
  let receiverFilter='all';
  const expandedConnections=new Set();
  let pixelSetupReceiverId=null;
  let presetStore, colourStore, sceneStore;
  // Merely browsing must work even when a privacy policy denies local storage.
  // The demo shares an origin with the public root but never shares storage.
  const appStorage=webDemoContext?webDemo.storage:(()=>{try{return window.localStorage;}catch(_){return null;}})();
  const FIRST_ACCESS_KEY='aluvision.first-wifi-pin.v1';
  const LOCAL_STAND_KEY='aluvision.local-stand-concept.v1';
  const localStandBase=M.assertValid({schemaVersion:30,demo:false,stands:[],receivers:[],scenes:[],presets:[]});
  let localStandConceptId=null;
  function localStandConcept(){return !!localStandConceptId&&model.stands.length===1&&model.stands[0].id===localStandConceptId&&model.receivers.length===0;}
  function canStartLocalStand(){return nativeLoaded&&!nativeLoadError&&!nativeLoading&&!model.stands.length&&!model.receivers.length&&!onboarding.summary()&&!firstAccessCheckpoint&&!centralApplied&&!centralPending&&!standSession?.snapshot()&&!standSession?.canResume();}
  function allowPendingLocalConcept(){return nativeLoaded&&!nativeLoadError&&!nativeLoading&&!model.stands.length&&!model.receivers.length&&!firstAccessCheckpoint&&!centralApplied&&!centralPending&&!standConnectionBusy&&!standSession?.snapshot()&&!standSession?.canResume();}
  function canContinuePendingLocalStand(){return allowPendingLocalConcept()&&onboarding.canContinueLocalConcept();}
  function storeLocalStandConcept(next,standId=localStandConceptId){
    M.assertValid(next);if(next.stands.length!==1||next.stands[0].id!==standId||next.receivers.length||next.scenes.length||next.presets.length)throw Error('LOCAL_CONCEPT_INVALID');
    const text=JSON.stringify({schema:1,model:next});
    if(!appStorage)throw Error('LOCAL_CONCEPT_STORAGE');appStorage.setItem(LOCAL_STAND_KEY,text);
    if(appStorage.getItem(LOCAL_STAND_KEY)!==text)throw Error('LOCAL_CONCEPT_STORAGE');
  }
  function retireLocalStandConcept(){localStandConceptId=null;try{appStorage?.removeItem(LOCAL_STAND_KEY);}catch(_){};}
  function restoreLocalStandConcept(){
    try{const value=JSON.parse(appStorage?.getItem(LOCAL_STAND_KEY)||'null'),next=value?.model;
      if(!value||Object.keys(value).sort().join(',')!=='model,schema'||value.schema!==1||!next||next.demo!==false||next.stands?.length!==1||next.receivers?.length!==0||next.scenes?.length!==0||next.presets?.length!==0)return false;
      M.assertValid(next);localStandConceptId=next.stands[0].id;model=next;simpleStandMode=false;return true;
    }catch(_){return false;}
  }
  function prepareLocalStandReceiver(activeZoneId){
    if(!localStandConcept()||onboarding.summary())return;
    let draft=window.LightningOnboardingDraft.create({model:localStandBase,transactionId:'onboarding-'+crypto.randomUUID()});
    function step(event){const next=window.LightningOnboardingDraft.transition(draft,event);if(next.error)throw Error(next.error.code);draft=next.draft;}
    step({type:'SET_STAND',id:stand().id,name:stand().name});step({type:'NEXT'});
    for(const z of stand().zones)step({type:'ADD_ZONE',id:z.id,name:z.name});
    step({type:stand().zones.length?'NEXT':'SKIP_ZONES'});
    if(stand().zones.some(z=>z.id===activeZoneId))step({type:'SELECT_ACTIVE_ZONE',zoneId:activeZoneId});
    onboarding.restore(draft);
  }
  let firstAccessCheckpoint=null;
  function firstAccessMarker(next,receiverId){
    const receiver=next.receivers.find(item=>item.id===receiverId);
    if(next.stands.length!==1||!receiver||receiver.role!=='main'||receiver.lifecycle!=='added'||!receiver.onboardingTransactionId)throw Object.assign(Error(),{code:'FIRST_ACCESS_IDENTITY'});
    return {schema:1,stage:'wifi-pin',standId:receiver.standId,receiverId:receiver.id,rid:receiver.rid,fingerprint:receiver.deviceFingerprint,transactionId:receiver.onboardingTransactionId};
  }
  function storeFirstAccessMarker(value){
    const text=JSON.stringify(value);
    try{if(!appStorage)throw Error();appStorage.setItem(FIRST_ACCESS_KEY,text);if(appStorage.getItem(FIRST_ACCESS_KEY)!==text)throw Error();}
    catch(_){throw Object.assign(Error(),{code:'FIRST_ACCESS_STORAGE'});}
    firstAccessCheckpoint=copy(value);
  }
  function readFirstAccessMarker(next){
    try{
      const text=appStorage?.getItem(FIRST_ACCESS_KEY);if(!text)return null;const value=JSON.parse(text),expected=firstAccessMarker(next,value?.receiverId);
      if(Object.keys(value).sort().join(',')!==Object.keys(expected).sort().join(',')||JSON.stringify(Object.entries(value).sort())!==JSON.stringify(Object.entries(expected).sort()))return null;
      return expected;
    }catch(_){return null;}
  }
  async function firstStandAccess({kind,identity,model:published,standCode}){
    if(kind==='prepare'){
      // This graph came from exact native publication, not a factory guess.
      // Holding it never sends lighting or grants authority from local cache.
      model=M.assertValid(published);retireLocalStandConcept();simpleStandMode=true;firstFactorySetup=false;firstAccessCheckpoint=copy(identity);
    }
    if(!firstAccessCheckpoint||JSON.stringify(firstAccessCheckpoint)!==JSON.stringify(identity))throw Object.assign(Error(),{code:'FIRST_ACCESS_IDENTITY'});
    storeFirstAccessMarker(identity);ensureStandSession();
    await refreshStandCapabilities();
    if(kind==='set-code'){
      SimpleStand.newCode(standCode);
      const inspection=await standSession.inspect({expectedStandId:identity.standId});
      if(inspection.status!=='migration-required')throw Object.assign(Error(),{code:'STAND_MIGRATION_UNCONFIRMED'});
      const request={expectedStandId:identity.standId,standCode,payload:{operations:SimpleStand.entities(model,installationLibraries.capture(identity.standId),identity.standId,{migration:true})}};
      try{
        const result=await standSession.migrateDetected(request);
        if(result?.status!=='reconnect-required')throw Object.assign(Error(),{code:'STAND_MIGRATION_UNCONFIRMED'});
        return {phase:'reconnect',ssid:result.ssid};
      }finally{request.standCode='';standCode='';}
    }
    const inspection=await standSession.inspect({expectedStandId:identity.standId});
    if(inspection.status==='migration-required')return {phase:'pin',ssid:inspection.ssid};
    if(inspection.status!=='wifi-ready')throw Object.assign(Error(),{code:'STAND_WIFI_UNSUPPORTED'});
    if(kind==='prepare')return {phase:'reconnect',ssid:inspection.ssid};
    // The native pending code was durable before WPA switched. Only complete
    // authenticated readback can finish setup; public inspection cannot.
    return {...await standSession.resume({expectedStandId:identity.standId}),status:'connected'};
  }
  const backupTransaction=Backup?.transaction(appStorage);
  let selectedBackup=null,backupNotice='',lightSaveTimer=null,lightIntentDirty=false;
  const receiverContextStates=new Map(),receiverContextReads=new Set(),receiverContextVersions=new Map(),receiverContextWrites=new Map(),receiverContextEventVersions=new Map();
  let contextWriteBarrierInstalled=false;
  try { presetStore = S.createStore(appStorage); } catch (_) { presetStore = S.createStore(null); }
  try { colourStore = Colours.createStore(appStorage); sceneStore=Scenes.createStore(appStorage); }
  catch (_) { colourStore=Colours.createStore(null);sceneStore=Scenes.createStore(null); }
  const installationLibraries=window.LightningInstallationLibraries?.create?.(appStorage,{onRestore:()=>{
    savedPresets=presetStore.load();savedColours=colourStore.load();savedScenes=sceneStore.load();
  }});
  if(installationLibraries)window.LightningInstallationLibraries=installationLibraries;
  function scheduleLibraryContext(field,result){
    if(simpleStandMode){
      if(result?.error)return;
      const promise=queueCentralLibraryChange();
      Object.defineProperty(result,'centralPromise',{value:promise,enumerable:false});void promise.catch(()=>{});return;
    }
    if(!nativeContext||result?.error||typeof runtime?.services?.scheduleInstallationContext!=='function')return;
    const stands=field==='scenes'?[stand()?.id]:model.stands.map(item=>item.id);
    for(const standId of new Set(stands.filter(Boolean))){try{Promise.resolve(runtime.services.scheduleInstallationContext({standId})).catch(()=>{});}catch(_){}}
  }
  function trackedLibraryStore(store,field){
    return Object.freeze(Object.fromEntries(Object.entries(store).map(([method,implementation])=>[method,(...args)=>{
      if(simpleStandMode&&method!=='load'&&standConnectionState.status!=='connected')return {...store.load(),error:{code:'STAND_NOT_CONNECTED',message:'Verbind met je stand voordat je dit opslaat.'}};
      try{installationLibraries?.recover();}catch(error){return {[field]:[],error:{code:'LIBRARY_STORAGE',message:error.message}};}
      const result=implementation(...args);if(method!=='load')scheduleLibraryContext(field,result);return result;
    }])));
  }
  presetStore=trackedLibraryStore(presetStore,'presets');colourStore=trackedLibraryStore(colourStore,'colors');sceneStore=trackedLibraryStore(sceneStore,'scenes');
  let savedPresets = presetStore.load();
  let savedColours=colourStore.load(),savedScenes=sceneStore.load(),sceneDraft=null;
  let sceneDetailSearch='';
  let dragOrder=null;
  let inlineOrderDrag=null,orderRenderDeferred=false;
  let activeControlPointer=null,controlRenderDeferred=false;
  let activeStaticGesturePointer=null;
  // Recognition follows the ordered position, never the saved playback state.
  // This map is deliberately presentation-only; it never enters the model,
  // colour library, a scene or an animation preset.
  const orderColours=new Map();
  let orderIdentification=null,orderIdentificationState=null,orderCleanupResumedSession=null;
  let orderRecognitionDirty=true;
  function beginOrderColours(){
    if(!zone()||!orderIdentification)return;
    void orderIdentification.open({standId:stand().id,zoneId:zone().id,lines:M.zoneLedlines(model,zone().id).map(({id,receiverId,port})=>({id,receiverId,port}))});
  }
  function closeZoneMenus(){
    openLineSetup.clear();openLineSettings.clear();openSpatialChoices.clear();expandedScopeZones.clear();
    expandedReceivers.clear();expandedConnections.clear();settingsOpen=false;advancedSettingsRevision++;
    arrangementDraft=null;orderColours.clear();inlineOrderDrag?.cancel();void orderIdentification?.close();
  }
  let receiverAssignment=null,nameDialog=null,zoneDeletion=null,managementBusy=false;
  let managementConnectionReturn=null;
  let arrangementDraft=null,arrangementApplying=false,arrangementReapplyIds=[],setupReturnContext=null;
  let familySpatialSwitch=null;
  const openLineSetup=new Set(),openLineSettings=new Set();
  const openSpatialChoices=new Set(),spatialViews=new Map();
  let standControlOpen=false;
  let standControlEpoch=0,lastStandControlContext=null;
  function standControlIntent(){return {epoch:++standControlEpoch,standId:stand()?.id};}
  function currentStandControlIntent(intent){return standControlOpen&&standControlMode==='animations'&&intent.epoch===standControlEpoch&&intent.standId===stand()?.id;}
  let standControlMode='colour',standAnimationGallery=true,standAnimationFamily=null,standAnimationTab='catalogue';
  let standAnimationFamilyReturn=null;
  let standDialogNested=null,buildingStandDialog=false;
  const standAnimationQueries=new Map();
  function animationQueryKey(){return standControlOpen?stand()?.id:route.zoneId;}
  function animationQueryStore(){return standControlOpen?standAnimationQueries:animationQueries;}
  function animationFamilyKey(){return standControlOpen?standAnimationFamily:route.family;}
  function standAnimationMarker(){
    return stand()?.id?StandAnimations.active(model,stand().id):null;
  }
  // Everyday controls share one zone screen. Keep the light mode local to
  // that screen so changing between colour and movement never sends users
  // through an intermediate page or clears their selected ledline.
  let controlMode='colour',showControlAnimationGallery=true,controlPreviewSize='small';
  let pinProtection=null,pinProtectionLoading=false,pinProtectionBusy=false,pinProtectionError='',pinProtectionReconnect=null;
  let pinProtectionRead=null,pinProtectionWaitingForLive=false;
  let pinProtectionDeferredStandId=null;
  let pinProtectionGeneration=0,pinProtectionPendingCheckStandId=null,pinProtectionRefreshNeeded=null,pinProtectionWrite=null;
  let pinLoginAvailable=false,pinLoginChecking=false,pinLoginBusy=false,pinLoginError='',pinRecoveryAbort=null;
  const liveStates=new Map();
  const staticRouteLabels=Object.freeze({queue:Object.freeze({QUEUE_NO_PROVIDER:'geen streamprovider',QUEUE_INELIGIBLE:'kleurprofiel niet geschikt',QUEUE_ELIGIBLE:'kleurprofiel geschikt'}),
    facade:Object.freeze({STATIC_PROFILE:'verzoekprofiel niet geschikt',LEGACY_CAP_OFF:'legacy-capability uit',LEGACY_CONTEXT_SELECTED:'centrale verbinding geselecteerd',
      CENTRAL_CAP_OFF:'centrale capability uit',CENTRAL_BINDING:'centrale binding niet geschikt',CENTRAL_RECHECK:'centrale binding gewijzigd',
      RECHECK_CAP_OFF:'capability gewijzigd',RECHECK_CONTEXT:'verbindingscontext gewijzigd',NATIVE_ENTRY:'native stream aangeroepen',NATIVE_RETURNED_UNAVAILABLE:'native stream niet beschikbaar'})});
  let staticRouteDiagnostic=null;
  function staticRouteBenchEnabled(){const flag=Object.getOwnPropertyDescriptor(window,'__lightningV41GestureDiagnostics');return flag?.value===true&&flag.writable===false&&flag.configurable===false;}
  function observeStaticRoute(value){try{
    if(!staticRouteBenchEnabled()||!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).sort().join(',')!=='count,reason,stage')return;
    const {stage,reason,count}=value;
    if(typeof stage!=='string'||typeof reason!=='string'||!Object.hasOwn(staticRouteLabels,stage)||!Object.hasOwn(staticRouteLabels[stage],reason)||
       !Number.isInteger(count)||count<1||count>30)return;
    staticRouteDiagnostic={stage,reason,count};syncStaticRouteStatus();
  }catch(_){/* A failed bench observer must not affect lighting. */}}
  function syncStaticRouteStatus(){try{
    if(!staticRouteBenchEnabled())return;
    document.querySelectorAll('[data-live-status]').forEach(node=>{
      let output=node.nextElementSibling;
      if(!output?.matches('[data-static-route-diagnostic]')){
        output=document.createElement('output');output.dataset.staticRouteDiagnostic='';output.setAttribute('aria-live','off');
        output.style.cssText='display:block;height:16px;min-height:16px;margin:0;font-size:11px;line-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
        node.after(output);
      }
      output.textContent=staticRouteDiagnostic?`Testroute: ${staticRouteLabels[staticRouteDiagnostic.stage][staticRouteDiagnostic.reason]} · ${staticRouteDiagnostic.count}`:'Testroute: wacht op bediening.';
    });
  }catch(_){/* Diagnostic rendering is never an ACK or queue gate. */}}
  window.addEventListener('lightning:static-route',event=>observeStaticRoute(event.detail));
  const liveController=nativeContext&&runtime?.native===true&&typeof runtime.services?.applyLive==='function'
    ?window.LightningLiveControl?.create({send:request=>runtime.services.applyLive(request),
      sendBatch:typeof runtime.services.applyLiveBatch==='function'?requests=>runtime.services.applyLiveBatch({requests}):undefined,
      sendGesture:typeof runtime.services.applyStaticGesture==='function'?(requests,options)=>runtime.services.applyStaticGesture({requests,...options}):undefined,
      waitBeforeSend:typeof runtime.services.whenLiveReady==='function'?()=>runtime.services.whenLiveReady():undefined,
      onRoute:observeStaticRoute,
      onState:(id,state)=>{liveStates.set(id,state);syncLiveStatus();syncArrangementControls();
        if(state.kind==='applied'&&centralLiveCheckpoint?.state().status==='unconfirmed'&&centralLiveCheckpoint.state().pending)void centralLiveCheckpoint.flush().catch(()=>{});}}):null;
  let colourOrderMode=false,colourLibraryNotice='',removedColour=null;
  let preferenceStore;try{preferenceStore=Preferences.createStore(appStorage);}catch(_){preferenceStore=Preferences.createStore(null);}
  let uiPreferences=preferenceStore.load();
  const t=(key,params)=>Preferences.t(key,uiPreferences.preferences.language,params);
  let dialogReturnFocus = null,dialogActionOpener=null,helpReturnFocus=null,colourManagerReturn=null,colourManagerVisible=false;
  let settingsOpen = false, advancedSettingsRevision = 0, toastTimer, contextObserver, dialogHeaderObserver;
  const main = document.getElementById('main');
  orderIdentification=window.LightningLedlineIdentificationSession?.create({
    clock:()=>performance.now(),setTimer:(callback,ms)=>setTimeout(callback,ms),clearTimer:timer=>clearTimeout(timer),
    idFactory:()=>crypto.randomUUID(),
    sendLease:request=>{
      // A browser illustration is NEVER an acknowledgement from a receiver.
      // Fixed-colour leases have their own capability, not the white blink API.
      if(standReceiverActionUnavailable('order-identify')||previewContext||typeof runtime?.services?.identifyLayout!=='function')return Promise.reject(Error('IDENTIFICATION_NOT_CONNECTED'));
      return runtime.services.identifyLayout(request);
    },
    sendStop:request=>{
      if(typeof runtime?.services?.stopLayoutIdentification!=='function')return Promise.resolve();
      return runtime.services.stopLayoutIdentification(request);
    },
    sendBlink:request=>{
      if(previewContext||typeof runtime?.services?.blinkLayoutIdentification!=='function')return Promise.reject(Error('IDENTIFICATION_NOT_CONNECTED'));
      return runtime.services.blinkLayoutIdentification(request);
    },
    onState:state=>{
      orderIdentificationState=state;orderColours.clear();
      // Only the current exact-token STOP receipt may resume existing context
      // work. Old, pending or unknown cleanup never opens another radio writer.
      if(!state.active&&state.cleanup?.status==='confirmed'&&state.cleanup.session!==orderCleanupResumedSession&&nativeContext&&contextWriteBarrierInstalled&&typeof runtime?.services?.resumeInstallationContext==='function'){
        orderCleanupResumedSession=state.cleanup.session;
        try{Promise.resolve(runtime.services.resumeInstallationContext({standId:state.cleanup.standId})).catch(()=>{});}catch(_){}
      }
      for(const line of state.lines)orderColours.set(line.id,{name:line.colorName,hex:C.hex(line.rgb),rgb:line.rgb});
      for(const [receiverId,blink] of identifying){
        if(blink.layoutSession&&(!state.active||blink.layoutSession!==state.session||(!previewContext&&!state.physicalConfirmed))){
          identifying.delete(receiverId);syncIdentifyControls(receiverId);
        }
      }
      orderRecognitionDirty=true;
      // An active holder enables only its subtle row blink. Expiry/close
      // disables it again; unrelated legacy blink buttons stay unavailable.
      for(const receiver of model.receivers)syncIdentifyControls(receiver.id);
      syncOrderRecognition();
    }
  });
  function syncOrderRecognition(){
    if(!main)return;
    for(const row of main.querySelectorAll('[data-order-item]')){
      const colour=orderColours.get(row.dataset.orderItem);
      row.querySelector('.order-number')?.style.setProperty('--identify-colour',colour?.hex||'transparent');
      const name=row.querySelector('[data-order-colour-name]');if(name)name.textContent=colour?' · '+colour.name:'';
    }
    for(const port of main.querySelectorAll('[data-line-id]')){
      const colour=orderColours.get(port.dataset.lineId);port.style.setProperty('--identify-colour',colour?.hex||'transparent');
      const name=port.querySelector('.line-colour-name');if(name)name.textContent=colour?.name||'';
    }
    const status=main.querySelector('[data-order-recognition-status]');
    if(status){
      const unsupportedHint={nl:'Werk de receivers bij om herkenningskleuren te gebruiken.',en:'Update the receivers to use identification colours.',fr:'Mettez les receivers à jour pour utiliser les couleurs d’identification.',de:'Aktualisiere die Receiver, um Erkennungsfarben zu verwenden.'}[uiPreferences.preferences.language]||'Werk de receivers bij om herkenningskleuren te gebruiken.';
      status.textContent=!orderIdentificationState?.active?previewContext?'Voorbeeldherkenning gestopt':orderIdentificationState?.cleanup?.status==='pending'?'Herkenning afsluiten…':orderIdentificationState?.cleanup?.status==='unconfirmed'?'Stoppen is nog niet bevestigd.':orderIdentificationState?.cleanup?.status==='confirmed'&&orderIdentificationState.reason==='idle'?'Herkenning automatisch gestopt.':'Herkenning gestopt':previewContext?'Voorbeeldkleuren · niet verbonden':orderIdentificationState.physicalConfirmed?'Ledlines tonen hun herkenningskleur':orderIdentificationState.status==='pending'?'Herkenningskleuren instellen…':orderIdentificationState.status==='expired'?'Herkenningskleuren verlopen. Tik of sleep om opnieuw te herkennen.':orderIdentificationState.error==='IDENTIFY_UNSUPPORTED'?unsupportedHint:'Herkenningskleuren niet bevestigd';
      status.dataset.confirmed=String(orderIdentificationState?.physicalConfirmed===true);
    }
    orderRecognitionDirty=false;
  }
  const pendingDialogDismissals=new WeakMap();
  const pendingPanelDismissals=new WeakMap();
  let lastRenderedMotionContext=null;
  function motionContextKey(){
    const parts=[route.screen,route.zoneId||''];
    if(route.screen==='controls'){
      parts.push(controlMode);
      if(controlMode==='animations')parts.push(showControlAnimationGallery?'gallery':`editor:${activeEffect()?.id||''}`,libraryTab());
    }
    if(route.screen==='animation-family')parts.push(route.family||'');
    if(route.screen==='effects')parts.push(libraryTab(),route.family||'');
    if(route.screen.startsWith('scene'))parts.push(route.sceneId||'');
    if(route.screen==='receiver-add')parts.push(route.setupFrom||'',route.setupReturnZoneId||'');
    return parts.join('|');
  }
  function measureControlPreviewDock(){
    const dock=main.querySelector('.control-preview-dock');
    const style=dock&&getComputedStyle(dock);
    // Scroll-to-control margins include the unsafe screen edge as well as
    // the dock itself. Use the resolved inset, never an iPhone-size constant.
    const height=style?.position==='sticky'?dock.getBoundingClientRect().height+Math.max(0,parseFloat(style.top)||0):0;
    document.documentElement.style.setProperty('--sticky-height',`${Math.ceil(height)}px`);
  }
  function shortcutOverlapsControls(floating){
    if(!floating||floating.height<=0)return false;
    // Floating gallery shortcuts are secondary to scope/power and setup.
    // Do not let an absolute sticky button cover those controls on short
    // screens, including immediately after the scope list expands.
    return ['.animation-context','.ledline-setup'].some(selector=>{
      const box=main.querySelector(selector)?.getBoundingClientRect();
      return !!box&&box.height>0&&floating.left<box.right&&floating.right>box.left&&floating.top<box.bottom&&floating.bottom>box.top;
    });
  }
  function updateControlPreviewDensity(){
    const dock=main.querySelector('.control-preview-dock');
    if(!dock)return;
    const compact=dock.dataset.scrolled==='true';
    // The dock gets shorter when compacted. Keep the threshold gap larger
    // than that height change so scroll anchoring cannot bounce it across
    // both thresholds and trap controls below the fold.
    // The full mobile dock can lose 139px when compacted. The old 120px
    // hysteresis let browser scroll anchoring switch it back every frame.
    // Freeze density while its size picker is being used, too.
    if(!dock.querySelector('.preview-size-control[open]')){
      if(!compact&&window.scrollY>224)dock.dataset.scrolled='true';
      else if(compact&&window.scrollY<8)delete dock.dataset.scrolled;
    }
    const familyShortcut=dock.querySelector('[data-family-back-shortcut]');
    const familySlot=main.querySelector('[data-family-back-slot]');
    const familyBack=familySlot?.querySelector('.family-detail-back')||familyShortcut?.querySelector('.family-detail-back');
    if(familyShortcut&&familySlot&&familyBack){
      const slot=familySlot.getBoundingClientRect();
      const top=dock.querySelector('.control-dock-surface').getBoundingClientRect().bottom;
      const bottom=document.getElementById('navigation')?.getBoundingClientRect().top??innerHeight;
      const inlineFullyReachable=slot.height>0&&slot.top>=top&&slot.bottom<=bottom;
      if(inlineFullyReachable){
        if(familyBack.parentElement!==familySlot)familySlot.append(familyBack);
        familySlot.style.minHeight='';familyShortcut.hidden=true;
      }else{
        familySlot.style.minHeight=`${Math.ceil(familyBack.getBoundingClientRect().height)}px`;
        familyShortcut.hidden=false;
        if(familyBack.parentElement!==familyShortcut)familyShortcut.append(familyBack);
        const box=familyShortcut.getBoundingClientRect();
        if(box.height===0||box.bottom>bottom){
          familyShortcut.hidden=true;
          familySlot.append(familyBack);familySlot.style.minHeight='';
        }
      }
      return;
    }
    const settingsShortcut=dock.querySelector('[data-editor-return-shortcut]');
    const settingsSlot=main.querySelector('[data-editor-return-slot]');
    const settingsAction=settingsSlot?.querySelector('[data-editor-return-inline]')||settingsShortcut?.querySelector('[data-editor-return-inline]');
    if(settingsShortcut&&settingsSlot&&settingsAction){
      // There is one live button. It moves into the preview dock only when its
      // inline position is obscured; a measured spacer keeps the page still.
      const slot=settingsSlot.getBoundingClientRect();
      const top=dock.querySelector('.control-dock-surface').getBoundingClientRect().bottom;
      const bottom=document.getElementById('navigation')?.getBoundingClientRect().top??innerHeight;
      const inlineFullyReachable=slot.height>0&&slot.top>=top&&slot.bottom<=bottom;
      if(inlineFullyReachable){
        if(settingsAction.parentElement!==settingsSlot)settingsSlot.append(settingsAction);
        settingsSlot.style.minHeight='';settingsShortcut.hidden=true;
      }else{
        settingsSlot.style.minHeight=`${Math.ceil(settingsAction.getBoundingClientRect().height)}px`;
        settingsShortcut.hidden=false;
        if(settingsAction.parentElement!==settingsShortcut)settingsShortcut.append(settingsAction);
        const floating=settingsAction.getBoundingClientRect();
        if(shortcutOverlapsControls(floating)){
          settingsSlot.append(settingsAction);settingsSlot.style.minHeight='';settingsShortcut.hidden=true;
        }
      }
      return;
    }
    const shortcut=settingsShortcut||dock.querySelector('[data-editor-shortcut]');
    const editorGallerySlot=main.querySelector('[data-editor-gallery-slot]');
    const editorGalleryAction=editorGallerySlot?.querySelector('.current-effect-gallery')||shortcut?.querySelector('.current-effect-gallery');
    if(shortcut?.matches('[data-editor-shortcut]')&&editorGallerySlot&&editorGalleryAction){
      // The inline and sticky locations are two places for one DOM button.
      // Moving it prevents a duplicate or a half-visible copy under the nav.
      const slot=editorGallerySlot.getBoundingClientRect();
      const top=dock.querySelector('.control-dock-surface').getBoundingClientRect().bottom;
      const bottom=document.getElementById('navigation')?.getBoundingClientRect().top??innerHeight;
      const inlineFullyReachable=slot.height>0&&slot.top>=top&&slot.bottom<=bottom;
      if(inlineFullyReachable){
        if(editorGalleryAction.parentElement!==editorGallerySlot)editorGallerySlot.append(editorGalleryAction);
        editorGallerySlot.style.minHeight='';shortcut.hidden=true;
      }else{
        editorGallerySlot.style.minHeight=`${Math.ceil(editorGalleryAction.getBoundingClientRect().height)}px`;
        shortcut.hidden=false;
        if(editorGalleryAction.parentElement!==shortcut)shortcut.append(editorGalleryAction);
        const floating=editorGalleryAction.getBoundingClientRect();
        if(floating.height===0||floating.bottom>bottom||shortcutOverlapsControls(floating)){
          editorGallerySlot.append(editorGalleryAction);editorGallerySlot.style.minHeight='';shortcut.hidden=true;
        }
      }
      return;
    }
    const inline=main.querySelector('.current-effect-gallery');
    if(shortcut&&inline){
      const top=dock.querySelector('.control-dock-surface').getBoundingClientRect().bottom;
      const bottom=document.getElementById('navigation')?.getBoundingClientRect().top??innerHeight;
      const box=inline.getBoundingClientRect();
      shortcut.hidden=box.height>0&&box.top>=top&&box.bottom<=bottom;
    }else if(shortcut){
      const floating=shortcut.querySelector('button')?.getBoundingClientRect();
      shortcut.hidden=shortcutOverlapsControls(floating);
    }
  }
  window.addEventListener('scroll',updateControlPreviewDensity,{passive:true});
  window.addEventListener('resize',()=>{measureControlPreviewDock();updateControlPreviewDensity();},{passive:true});
  function revealAnimationStart(){
    // Do not carry a deep gallery scroll position into the settings. Align
    // their heading below the visible dock, including its compacted height.
    const workspace=main.querySelector('.active-animation-workspace');if(!workspace)return;
    // Start at the chosen animation, not the (potentially long) arrangement
    // form above it. The arrangement remains accessible by scrolling up.
    const target=workspace;
    revealBelowControlPreview(target,12);
    requestAnimationFrame(()=>workspace.querySelector('.current-effect b')?.focus({preventScroll:true}));
  }
  function revealColourControls(){
    const picker=main.querySelector('[data-control-mode="colour"] .shared-colour-picker');if(!picker)return;
    revealBelowControlPreview(picker,12);
    requestAnimationFrame(()=>{
      if(!picker.isConnected)return;
      // An instant scroll can compact the rebuilt dock after the first
      // measurement. Re-align before paint so larger previews cannot leave
      // the wheel partly behind the bottom navigation in reduced motion.
      if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
        revealBelowControlPreview(picker,12);
      picker.querySelector('h2')?.focus({preventScroll:true});
    });
  }
  function rememberAnimationGallery(){
    if(route.screen==='animation-family'&&route.family){
      animationGalleryPositions.set(route.zoneId,{library:libraryTab(),family:route.family});
      return;
    }
    if(!main.querySelector('.animation-library-inline'))return;
    animationGalleryPositions.set(route.zoneId,{library:libraryTab(),family:route.family});
  }
  function revealAnimationGallery(){
    const target=main.querySelector('.animation-context')||main.querySelector('.animation-library-inline');if(!target)return;
    revealBelowControlPreview(target,8);
  }
  function revealAnimationFamily(){
    const target=main.querySelector('[data-family-back-slot]');if(!target)return;
    revealBelowControlPreview(target,8);
  }
  function revealBelowControlPreview(target,gap=8){
    if(!target?.isConnected)return;
    updateControlPreviewDensity();
    const dock=main.querySelector('.control-preview-dock'),surface=dock?.querySelector('.control-dock-surface');
    const compactHeight=Math.max(0,surface?.getBoundingClientRect().height||0);
    const projected=Math.max(0,window.scrollY+target.getBoundingClientRect().top-compactHeight-gap);
    if(projected>224)dock.dataset.scrolled='true';
    else if(projected<8)delete dock.dataset.scrolled;
    updateControlPreviewDensity();
    const bottom=Math.max(0,surface?.getBoundingClientRect().bottom||0);
    const next=Math.max(0,window.scrollY+target.getBoundingClientRect().top-bottom-gap);
    if(Math.abs(next-window.scrollY)>1){
      const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({top:next,left:0,behavior:reduce?'instant':'smooth'});
      requestAnimationFrame(updateControlPreviewDensity);
    }
  }
  function restoreAnimationFamilyList(){
    const saved=animationFamilyReturnPositions.get(route.zoneId);
    if(!saved)return revealAnimationGallery();
    const trigger=Array.from(main.querySelectorAll('[data-action="family"]')).find(item=>item.dataset.id===saved.family);
    if(!trigger)return revealAnimationGallery();
    const restore=()=>{
      if(!trigger.isConnected)return;
      const delta=trigger.getBoundingClientRect().top-saved.viewportTop;
      if(Math.abs(delta)>1){
        const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({top:Math.max(0,window.scrollY+delta),left:0,behavior:reduce?'instant':'smooth'});
      }
      // Restoring a deep list position can move the active-settings return
      // action out of the viewport without producing a scroll event before
      // the next paint (notably with reduced motion enabled). Re-evaluate its
      // single inline/sticky slot now so it never appears lost after Back.
      updateControlPreviewDensity();
    };
    const entering=main.querySelector('.app-page-enter');
    if(entering&&!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
      entering.addEventListener('animationend',()=>requestAnimationFrame(restore),{once:true});
    else requestAnimationFrame(restore);
    trigger.focus({preventScroll:true});
  }
  function chooseAnimationCategory(value){
    if(standControlOpen){
      if(!['catalogue','whole','pixels','tunnel','brand','presets'].includes(value))return;
      standControlEpoch++;
      standAnimationTab=value;standAnimationFamily=null;standAnimationGallery=true;standAnimationQueries.delete(stand()?.id);
      standDialogNested=null;return renderStandControls({preserveScroll:false});
    }
    if(!['catalogue','whole','pixels','tunnel','brand','presets'].includes(value)||value==='pixels'&&zone()?.type!=='SPI')return;
    animationQueries.delete(route.zoneId);
    route={...route,family:null,library:value,effectsReturn:'controls'};showControlAnimationGallery=true;setSpatialPreviewCategory(value);
    animationGalleryPositions.delete(route.zoneId);render({top:true});revealAnimationGallery();
  }
  document.getElementById('effect-dialog').addEventListener('click',event=>{
    const dialog=event.currentTarget;if(event.target!==dialog||!dialog.querySelector('[data-animation-categories]'))return;
    const rect=dialog.getBoundingClientRect();
    if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dismissEffectDialog();
  });
  if(webDemoContext){
    document.getElementById('web-demo-banner').hidden=false;
    document.body.dataset.webDemo='true';
  }
  const receiverUpdates=window.LightningReceiverUpdateUI.create({services:runtime?.native===true?runtime.services||{}:{},translate:(key,params)=>t(key,params)});
  const receiverRemoval=window.LightningReceiverRemovalUI.create({services:runtime?.native===true?runtime.services||{}:{},getModel:()=>model,standCodeAccess:()=>simpleStandMode,
    onRemoved:async(nextModel,{status,central,centralClosed}={})=>{
      if(simpleStandMode&&(central||centralClosed)){
        if(central)await ensureStandSession().acceptMembership(central);
        else{await standSession?.disconnect();centralApplied=null;centralPending=null;centralLiveCheckpoint?.reset();}
        model=M.assertValid(nextModel);flushCentralProjection();
        selections.clear();visualPorts.clear();visualPlugMotions.clear();identifying.clear();navigate(centralClosed?'stand-connect':'receivers');return;
      }
      const next=keepLocalPreviewStates(nextModel),remaining=new Set(next.receivers.map(receiver=>receiver.id)),
        removedIds=model.receivers.filter(receiver=>!remaining.has(receiver.id)).map(receiver=>receiver.id);
      if(status==='removed'&&removedIds.length)applyJoinedZonePlayback(next,[],{confirmedRemovedIds:removedIds});
      else model=M.assertValid(next);
      selections.clear();visualPorts.clear();visualPlugMotions.clear();identifying.clear();navigate('receivers');}});
  const pixelSetup=window.LightningPixelSetup.create({mode:previewContext?'preview':nativeContext&&typeof runtime?.services?.configureOutputs==='function'?'native':'native-unavailable',
    onPreview:runtime?.native===true&&typeof runtime.services?.previewPixels==='function'?request=>runtime.services.previewPixels({...request,mainReceiverId:request.role==='node'?model.receivers.find(r=>r.standId===request.standId&&r.role==='main'&&r.lifecycle==='added')?.id:null}):undefined,
    onClose:()=>{document.querySelector(`[data-action="receiver-pixel-setup"][data-id="${CSS.escape(pixelSetupReceiverId||'')}"]`)?.focus({preventScroll:true});pixelSetupReceiverId=null;},
    onSave:async({receiverId,outputs})=>{
      const receiver=model.receivers.find(r=>r.id===receiverId&&r.lifecycle==='added'&&r.type==='SPI');
      if(!receiver||outputs.length!==4)throw Error('Deze receiver is niet beschikbaar.');
      void orderIdentification?.supersede();
      if(nativeContext){
        if(typeof runtime?.services?.configureOutputs!=='function')throw Error('Verbind je telefoon met het ALUVISION-wifi van je installatie om de instellingen te bewaren.');
        try{const view=await runtime.services.configureOutputs({standId:receiver.standId,receiverId,outputs});refreshSuspendedSetup(view);model=keepLocalPreviewStates(view.model);}
        catch(error){throw Error(outputConfigurationErrorMessage(error));}
      }else{
        if(!previewContext)throw Error('Verbind je telefoon met het ALUVISION-wifi van je installatie om de instellingen te bewaren.');
        let next=model;
        for(const {port,enabled,pixels,reversed} of outputs)next=M.configureSpiOutput(next,receiverId,port,{enabled,pixels,reversed});
        model=next;
      }
      resumeConfiguredLighting(receiverId);
      expandedReceivers.add(receiverId);
      const blink=identifying.get(receiverId);
      if(blink){const active=model.receivers.find(r=>r.id===receiverId).outputs.filter(o=>o.enabled).map(o=>o.port);blink.ports=blink.scope==='all'?active:blink.ports.filter(p=>active.includes(p));if(!blink.ports.length)identifying.delete(receiverId);}
      render({preserveScroll:true});toast(nativeContext?'Pixels en aansluiting bewaard op de receiver.':'Pixels en aansluitzijde aangepast in het voorbeeld.');
    }});
  function outputConfigurationErrorMessage(error){
    if(error?.code==='OTA_PENDING')return 'De software-update van deze receiver is nog niet afgerond. Controleer die eerst bij Softwareversie en updates. Je keuzes blijven staan.';
    if(['OTA_BUSY','OUTPUT_CONFIGURATION_BUSY','LIVE_CONTROL_BUSY','NATIVE_BUSY','MAIN_BUSY','REMOVAL_BUSY'].includes(error?.code))return 'Er loopt nog een receiveractie. Wacht tot die klaar is en bewaar dan opnieuw. Je keuzes blijven staan.';
    return 'Nog niet bevestigd door de receiver. Je keuzes blijven staan. Controleer de verbinding en probeer opnieuw.';
  }
  const onboarding=window.LightningOnboardingUI.create({getModel:()=>localStandConcept()?localStandBase:model,
    allowLocalConcept:allowPendingLocalConcept,
    onPreserveLocalConcept:next=>storeLocalStandConcept(next,next.stands[0].id),
    allowPinLogin:false,
    automaticFirstReceiver:()=>firstFactorySetup,
    firstStandAccessRequired:()=>nativeContext,
    onFirstStandAccess:firstStandAccess,
    services:webDemo||(runtime?.native===true?runtime.services||{}:{}),
    onManage:request=>manageSetupZones(request),
    onComplete:async(nextModel,{receiverId,central}={})=>{
      if(simpleStandMode&&central)await ensureStandSession().acceptMembership(central);
      if(firstAccessCheckpoint&&central){
        const expected=firstAccessCheckpoint,receiver=nextModel.receivers.find(item=>item.id===expected.receiverId);
        if(central.standId!==expected.standId||receiver?.rid!==expected.rid||receiver?.deviceFingerprint!==expected.fingerprint)throw Object.assign(Error(),{code:'FIRST_ACCESS_IDENTITY'});
        model=M.assertValid(nextModel);appStorage?.removeItem(FIRST_ACCESS_KEY);firstAccessCheckpoint=null;
      }else applyJoinedZonePlayback(nextModel,receiverId?[receiverId]:[]);
      flushCentralProjection();if(central)firstFactorySetup=false;
    },
    onExit:result=>{
      const returnZone=stand()?.zones.find(z=>z.id===route.setupReturnZoneId);
      if(returnZone){
        const context=setupReturnContext;setupReturnContext=null;
        openLineSetup.add(returnZone.id);arrangementDraft=null;
        if(context&&context.route.zoneId===returnZone.id){
          controlMode=context.controlMode;showControlAnimationGallery=context.showGallery;
          navigate(context.route.screen,{...context.route,setupReturnZoneId:null},{restoreControls:true});
          restoreArrangementBrowsing(context);return;
        }
        return navigate('controls',{zoneId:returnZone.id,setupReturnZoneId:null});
      }
      navigate(result?.stand||route.setupFrom==='stand'||!stand()?'stand':'receivers',{setupReturnZoneId:null});
    }});
  const previews = new Map();
  let previewKey = 0;
  const copy = object => JSON.parse(JSON.stringify(object));
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const iconPaths = {
    stand:'M3 21V4h18v17M3 8h18M7 21V12h10v9M1 21h22',
    zones:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    gallery:'M3 4h8v7H3zM13 4h8v7h-8zM3 13h8v7H3zM13 13h8v7h-8zM6 6v3l3-1.5z',
    tunnel:'M4 21V10a8 8 0 0 1 16 0v11M8 21V10a4 4 0 0 1 8 0v11',
    wall:'M5 4v16M12 4v16M19 4v16',
    unassigned:'M12 22s7-4.35 7-12a7 7 0 1 0-14 0c0 7.65 7 12 7 12ZM9 10h6',
    light:'M3 9h18v6H3zM6 11v2M10 11v2M14 11v2M18 11v2M1 12h2M21 12h2',
    receiver:'M4 5h16v15H4zM8 2v3M16 2v3M7 9h10M7 13h2M11 13h2M15 13h2M7 17h10',
    back:'m14 6-6 6 6 6M8 12h13', chevron:'m9 5 7 7-7 7', close:'m6 6 12 12M6 18 18 6',
    edit:'m16 3 5 5-12 12-6 1 1-6ZM14 5l5 5',
    trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
    sliders:'M5 3v5M5 13v8M12 3v10M12 18v3M19 3v2M19 10v11M2 8h6v5H2zM9 13h6v5H9zM16 5h6v5h-6z',
    animation:'M3 9v6M7 5v14M12 2v20M17 6v12M21 9v6',
    power:'M12 2v10M6 5a9 9 0 1 0 12 0',
    update:'M20 7a9 9 0 0 0-15-2L2 8M2 3v5h5M4 17a9 9 0 0 0 15 2l3-3M22 21v-5h-5',
    info:'M12 10v7M12 6v1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
    settings:'M4 7h16M4 17h16M8 4v6M16 14v6',
    wifi:'M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8 16a6 6 0 0 1 8 0M12 20h.01',
    lock:'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5zM12 14v3',
    qr:'M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h2v2h-2zM19 15h2v6h-6v-2M11 3v3M11 10v3H3M3 11v2M15 11h6M11 15v6',
    scenes:'M7 3h14v14H7zM3 7v14h14M11 7h6M11 11h6',
    check:'m5 12 4 4L19 6', sun:'M12 2v2M12 20v2M2 12h2M20 12h2M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    moon:'M20.2 15.4A8.7 8.7 0 0 1 8.6 3.8a8.8 8.8 0 1 0 11.6 11.6Z',
    clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7v5l3 2',
    layers:'M12 3 2 8l10 5 10-5-10-5ZM2 12l10 5 10-5M2 16l10 5 10-5',
    sparkle:'m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3ZM19 16l.7 2.3 2.3.7-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z'
  };
  function icon(name) {
    if(name==='share')return '<svg class="icon icon-share" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4m-6.8 7 6.8 4"/></svg>';
    if(name==='advanced-settings')return `<svg class="icon icon-gear" data-icon="advanced-settings" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19.61 9.53L21.85 10.26L21.85 13.74L19.61 14.47L19.13 15.63L20.19 17.74L17.74 20.19L15.63 19.13L14.47 19.61L13.74 21.85L10.26 21.85L9.53 19.61L8.37 19.13L6.26 20.19L3.81 17.74L4.87 15.63L4.39 14.47L2.15 13.74L2.15 10.26L4.39 9.53L4.87 8.37L3.81 6.26L6.26 3.81L8.37 4.87L9.53 4.39L10.26 2.15L13.74 2.15L14.47 4.39L15.63 4.87L17.74 3.81L20.19 6.26L19.13 8.37Z"/><circle cx="12" cy="12" r="3.2"/></svg>`;
    // Three diffuser profiles on one connection: lighting selected together,
    // not a menu, receiver or reorder symbol. The check follows aria-pressed.
    if(name==='together')return `<svg class="icon icon-together" viewBox="0 0 40 32" aria-hidden="true" focusable="false"><path class="together-link" d="M5 5.5H2v18h3M2 14.5h3"/>${[3,12,21].map(y=>`<rect class="together-line" x="7" y="${y}" width="21" height="5" rx="2.5"/>`).join('')}<path class="together-check" d="m30 24 3 3 5-7"/></svg>`;
    if(name==='receiver')name='light';
    const unassigned=name==='unassigned';
    return `<svg class="icon${unassigned?' icon-unassigned':''}"${unassigned?' data-icon="unassigned"':''} viewBox="0 0 24 24" aria-hidden="true"><path d="${iconPaths[name] || iconPaths.light}"/></svg>`;
  }
  function arrangementIcon(layout=zone()?.layout){
    const kind=layout==='vertical'?'wall':layout==='continuous'?'continuous':layout==='normal'?'normal':layout==='separate'?'separate':'tunnel';
    const shapes=kind==='wall'?'<rect x="4.5" y="5.5" width="31" height="29" rx="3"/><rect x="10" y="10" width="4" height="20" rx="2"/><rect x="18" y="10" width="4" height="20" rx="2"/><rect x="26" y="10" width="4" height="20" rx="2"/>':
      kind==='continuous'?'<rect x="3.5" y="14" width="33" height="12" rx="6"/><path d="M12 15v10M20 15v10M28 15v10M8 20h24"/>':
      kind==='normal'?'<rect x="4" y="14" width="32" height="12" rx="6"/><path d="M13 15v10M21 15v10M29 15v10"/>':
      kind==='separate'?'<rect x="7" y="6" width="26" height="6" rx="3"/><rect x="7" y="17" width="26" height="6" rx="3"/><rect x="7" y="28" width="26" height="6" rx="3"/>':
      '<path d="M5 34V20a15 15 0 0 1 30 0v14M11 34V20a9 9 0 0 1 18 0v14M17 34V20a3 3 0 0 1 6 0v14"/>';
    return `<svg class="icon arrangement-icon" data-icon="layout-${kind}" viewBox="0 0 40 40" aria-hidden="true" focusable="false">${shapes}</svg>`;
  }
  function lineOrderIcon(){
    return '<svg class="icon line-order-icon" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><circle cx="7" cy="9" r="1.5"/><circle cx="7" cy="19" r="1.5"/><circle cx="7" cy="29" r="1.5"/><path d="M12 9h13M12 19h13M12 29h13M32 15V5m0 0-3 3m3-3 3 3M32 25v10m0 0-3-3m3 3 3-3"/></svg>';
  }
  function zoneLayoutIcon(layout,z=zone()){
    if(layout==='stacked')return arrangementIcon(spatialMode(layout,z)==='normal'?'separate':'stacked');
    return arrangementIcon(layout);
  }
  const stand = () => model.stands.find(item=>item.id===route.standId)||model.stands[0];
  // Before the first receiver is confirmed, the named stand exists only in
  // the persisted setup draft. PIN preference belongs to that same stand ID.
  function securityStand(){
    const existing=stand();if(existing)return existing;
    const pending=onboarding.summary()?.stand;
    return pending?.id&&pending.name?.trim()?pending:null;
  }
  const standLabel = () => model.demo && stand()?.name === 'Demo stand' ? 'Mijn stand' : stand()?.name || 'Je stand';
  const zone = () => M.getZone(model, route.zoneId);
  const receivers = () => M.zoneReceivers(model, route.zoneId);
  // A SPI receiver is a device, not a line: each used output is one physical
  // ledline. Keep identity/selection receiver-scoped, but count port lines for
  // installation examples and spatial-effect requirements.
  const physicalLineCount = (list=receivers()) => P.ledlineCount(list);
  const continuousZone = () => zone()?.type==='SPI'&&zone()?.layout==='continuous';
  // A continuous SPI installation is a single control target. Normalize here,
  // not only in the chips, so colours, power, effects and presets cannot retain
  // an invisible old individual selection after a layout change.
  const selection = () => continuousZone()?{kind:'all'}:selections.get(route.zoneId)||{kind:'all'};
  const standReceivers=()=>model.receivers.filter(r=>r.standId===stand()?.id&&r.lifecycle==='added');
  const standControlReceivers=()=>stand()?.id?M.standZoneReceivers(model,stand().id):[];
  const standControlZoneCount=()=>stand()?.zones.filter(zone=>M.zoneReceivers(model,zone.id).length).length||0;
  function selectedReceiverIds(value=selection()) {
    const list=receivers();
    if(value?.kind==='all')return list.map(receiver=>receiver.id);
    if(value?.kind==='receiver')return list.some(receiver=>receiver.id===value.receiverId)?[value.receiverId]:[];
    if(value?.kind==='receivers'&&Array.isArray(value.receiverIds)){
      const ids=new Set(value.receiverIds);return list.filter(receiver=>ids.has(receiver.id)).map(receiver=>receiver.id);
    }
    return [];
  }
  function selected() { if(standControlOpen)return standControlReceivers();const ids=new Set(selectedReceiverIds());return receivers().filter(receiver=>ids.has(receiver.id)); }
  function storeLineSelection(ids,list=receivers(),zoneId=route.zoneId) {
    const requested=new Set(ids),ordered=list.filter(receiver=>requested.has(receiver.id)).map(receiver=>receiver.id);
    const next=!ordered.length||ordered.length===list.length?{kind:'all'}:ordered.length===1?{kind:'receiver',receiverId:ordered[0]}:{kind:'receivers',receiverIds:ordered};
    selections.set(zoneId,next);return next;
  }
  function toggleLineSelection(id) {
    if(continuousZone()||!receivers().some(receiver=>receiver.id===id))return;
    const current=selection(),ids=selectedReceiverIds(current);
    if(current.kind==='all')storeLineSelection([id]);
    else if(ids.includes(id)){if(ids.length>1)storeLineSelection(ids.filter(value=>value!==id));}
    else storeLineSelection([...ids,id]);
    expandedScopeZones.add(route.zoneId);
  }
  function formatLineNumbers(ids) {
    const numbers=M.zoneLedlines(model,zone().id).filter(line=>ids.includes(line.receiverId)).map(line=>String(line.lineIndex+1));
    try{return new Intl.ListFormat(uiPreferences.preferences.language||'nl',{style:'short',type:'conjunction'}).format(numbers);}
    catch(_){return numbers.join(', ');}
  }
  // The overview has no individual-line selector: its power switch always
  // controls the entire zone, without forgetting the selection in its editors.
  function powerTargets() { return standControlOpen?standControlReceivers():receivers(); }
  function selectedState() {
    const first=selected()[0]?.state,marker=standControlOpen?standAnimationMarker():null;
    // Channel-toggle memory belongs to each receiver, not to the shared
    // animation descriptor. Reading it must not create another live command.
    return marker?{...marker.state,...(first?.rgbwLast?{rgbwLast:first.rgbwLast}:{})}:first||M.defaultState();
  }
  function receiverLineLabel(receiver,index,list=receivers()) {
    const z=zone(),lines=z?M.zoneLedlines(model,z.id).filter(line=>line.receiverId===receiver.id):[];
    if(lines.length)return lines.length===1?t('scopeLine',{number:lines[0].lineIndex+1}):`${t('scopeCountMany',{count:lines.length})} · ${formatLineNumbers([receiver.id])}`;
    const count=physicalLineCount([receiver]),first=physicalLineCount(list.slice(0,index))+1;
    return count>1?`${t('scopeCountMany',{count})} · ${first}–${first+count-1}`:t('scopeLine',{number:first});
  }
  function ledlineName(receiver,index) { return `${receiverLineLabel(receiver,index)} · ${receiver.type==='RGBW'?'RGBW':'SPI'}`; }
  function nameOfSelection() {
    if(continuousZone())return 'Eén doorlopende ledline';
    if(selection().kind==='all')return `${t('together')} · ${ledlineCount(physicalLineCount())}`;
    const ids=selectedReceiverIds();
    if(selection().kind==='receivers')return t('scopeSelectedLines',{count:physicalLineCount(selected()),numbers:formatLineNumbers(ids)});
    const index=receivers().findIndex(receiver=>receiver.id===ids[0]);
    return index<0?'Geen ledline':ledlineName(receivers()[index],index);
  }
  function statusText(receiver) { return receiver.connection === 'offline' ? 'Offline' : ''; }
  function catalogue() { return standControlOpen?StandAnimations.catalogFor(standControlReceivers()):P.catalog(zone()?.type || 'RGBW'); }
  function activeEffect() {
    if(standControlOpen){const marker=standAnimationMarker();return marker?catalogue().find(effect=>effect.id===marker.effectId)||null:null;}
    // Smoothness is a fixed 100% rule for effects that support it. Older
    // installations may differ only in their saved smoothness value; treat
    // those lines as one effect so opening the editor can normalize them.
    if(selected().length>1&&mixedSelection(true))return null;
    const s = selectedState();
    if(!s.engine||String(s.engine).toUpperCase()==='STATIC')return null;
    return catalogue().find(e => s.v30Effect ? e.state.v30Effect === s.v30Effect : !e.state.v30Effect && e.state.engine === s.engine && e.state.variant === s.variant && (e.state.previewFamily || null) === (s.previewFamily || null));
  }
  function effectName(state) { return (!state.engine || state.engine === 'STATIC') ? 'Vaste kleur' : state.animation || state.engine; }
  function colours(state) {
    if (state.colors?.length) return state.colors;
    return [C.hex([state.r || 0, state.g || 0, state.b || 0])];
  }
  function rgbOf(state) {
    const hex = colours(state)[0].replace('#','');
    return [0,2,4].map(i => parseInt(hex.slice(i,i+2),16) || 0);
  }
  function paletteMarkup(state) {
    const palette=state.brandColor && activeEffect()?.controls.includes('brandColor')?[state.brandColor]:colours(state),count=Math.max(1,Math.min(8,state.colorCount||palette.length));
    return Array.from({length:count},(_,i)=>{
      const rgb=state.rgbEnabled?.[i]===false?[0,0,0]:rgbOf({colors:[palette[i%palette.length]]});
      const white=state.whiteEnabled?.[i]===false?0:(state.whiteChannels?.[i]||0);
      const name=activeEffect()?.whiteMixPreset?(count===1?'Witmix':`Witmix ${i+1}`):white>0 && rgb.every(v=>v===0)?'Wit':`Kleur ${i+1}`;
      const swatch=`<span role="img" aria-label="${name}" title="${name}" style="--swatch:${C.screenHex(rgb,white)}"></span>`;
      return activeEffect()?.paletteEditable === false ? swatch : `<div class="palette-item"><button class="palette-colour" data-action="palette-edit" data-id="${i}" aria-label="${name} aanpassen">${swatch}<small>${name}</small></button>${activeEffect()?.colorCountRange&&count>activeEffect().colorCountRange.min?`<button class="palette-remove" data-action="palette-remove" data-id="${i}" aria-label="Kleur ${i+1} verwijderen">−</button>`:''}</div>`;
    }).join('')+(activeEffect()?.colorCountRange&&count<activeEffect().colorCountRange.max?'<button class="palette-add" data-action="palette-add" aria-label="Animatiekleur toevoegen">＋ Kleur</button>':'');
  }
  function addPreview(list, layout, css = '', options = {}) {
    const key = String(++previewKey);
    previews.set(key, {receivers:list, layout, ...options});
    const accessibility=options.decorative?'aria-hidden="true"':`role="img" aria-label="${esc(options.label || 'Lichtvoorbeeld')}"`;
    return `<canvas class="${css}" data-preview="${key}" data-preview-line-count="${physicalLineCount(list)}" ${accessibility} width="400" height="160"></canvas>`;
  }
  function zonePreview(z, css, options) {
    // A live zone can still participate in one stand recipe. Resolve that
    // geometry at paint time, not only when this canvas was first opened.
    // Ordinary zone/arrangement views retain their existing fallback below.
    return addPreview(M.zoneReceivers(model,z.id),z.layout,css,{zoneId:z.id,lineOrder:M.lineIds(model,z.id),standLiveZoneId:z.id,...options});
  }
  function contextTitle(title, subtitle, backLabel = zone()?.name, back = 'controls') {
    const backToZones=back==='stand';
    return `<div class="topline"><button class="back${backToZones?' back-to-zones':''}" data-action="${back}" aria-label="${esc(backLabel.startsWith('Terug')?backLabel:'Terug naar '+backLabel)}">${icon('back')}<span>${esc(backLabel)}</span></button><span class="context-name">${esc(standLabel())}</span></div><header class="page-heading"><div><h1>${esc(title)}</h1><p>${esc(subtitle || '')}</p></div>${['controls','colour','animations','effects','animation-family','layout'].includes(route.screen) && zone() ? `<span class="pill">${zone().type === 'SPI' ? 'Pixel LED · SPI' : 'RGBW'}</span>` : ''}</header>`;
  }
  function mixedSelection(ignoreSmooth=false) {
    if(standControlOpen&&standAnimationMarker())return false;
    const signatures = selected().map(receiver => {
      const s = P.normalizeState(receiver);
      const signature = {on:s.on !== false && s.power !== false,engine:s.engine,variant:s.variant || 0,
        bri:s.brightness,colors:s.colors.map((c,i)=>s.rgbEnabled?.[i] === false?'#000000':c.toUpperCase()),
        whites:s.whiteChannels.map((w,i)=>s.whiteEnabled?.[i] === false?0:w)};
      if(s.engine !== 'STATIC')for(const key of ['v30Effect','previewFamily','legacySpi','speed','smooth','colorCount','widthPixels','objectCount','trailLength','spacing','direction','lineDelayMs','spread','randomness','fadeAmount','delayMs','width','brandColor','bounce','mirror','background','backgroundOn','backgroundWhite','backgroundRgbEnabled','backgroundWhiteEnabled','bgBrightness'])if(!(ignoreSmooth&&key==='smooth'))signature[key]=s[key]??null;
      return JSON.stringify(signature);
    });
    return signatures.some(value=>value!==signatures[0]);
  }
  function selector() {
    const all = selection().kind === 'all';
    if(continuousZone())return `<section class="selection continuous-scope" data-continuous-scope aria-label="${esc(t('scopeAllAria'))}"><span class="scope-toggle-icon" aria-hidden="true">${icon('together')}</span><div><strong>${esc(t('together'))}</strong><small>${esc(t('lineSetupContinuousHint'))}</small></div><p class="mixed-note" ${mixedSelection()?'':'hidden'}>De ledlines hebben verschillende instellingen. Je volgende wijziging geldt voor allemaal.</p></section>`;
    const list=receivers(),count=list.length,ids=selectedReceiverIds(),selectedIndex=list.findIndex(receiver=>receiver.id===ids[0]),selectedReceiver=selectedIndex>=0?list[selectedIndex]:null;
    const typeOf=receiver=>receiver?.type==='RGBW'?'RGBW':'SPI';
    if(count===1){const lines=physicalLineCount(list);return `<section class="selection single-scope" data-port-lines="${lines}" aria-label="Geselecteerde verlichting"><span class="scope-line-icon" aria-hidden="true">${icon('light')}</span><span class="scope-single-copy"><b>${esc(lines>1?ledlineCount(lines):t('scopeLine',{number:1}))}</b><small>${typeOf(list[0])==='SPI'?`Pixel LED · SPI${lines>1?' · 1 receiver':''}`:'RGBW'}</small></span></section>`;}
    const lines=physicalLineCount(list),chosenLines=physicalLineCount(selected());
    const summary=all?t(lines===1?'scopeCountOne':'scopeCountMany',{count:lines}):ids.length>1?t('scopeSelectedLines',{count:chosenLines,numbers:formatLineNumbers(ids)}):selectedReceiver?ledlineName(selectedReceiver,selectedIndex):'';
    // Selection opens the list when a line is first chosen, but the explicit
    // disclosure state must remain authoritative so customers can collapse it
    // without losing their selected line or group.
    const expanded=expandedScopeZones.has(route.zoneId),panelId=`scope-lines-${route.zoneId}`;
    const scopeToggleLabel=all?t('together'):ids.length>1?t('scopeSelectedLines',{count:chosenLines,numbers:formatLineNumbers(ids)}):selectedReceiver?ledlineName(selectedReceiver,selectedIndex):t('scopeSeparate');
    const scopeToggleHint=expanded?t('scopeCloseHint'):all?t(lines===1?'scopeTogetherOne':'scopeTogetherMany',{count:lines}):chosenLines>1?t('scopeMultiHint',{count:chosenLines}):t('scopeSingleHint',{count:lines});
    return `<section class="selection${ids.length>1?' has-multiple-selection':''}" data-selection-mode="${all?'all':ids.length>1?'multiple':'single'}" aria-label="Ledlines kiezen">
      <header><h2>${esc(t('scopePrompt'))}</h2><span class="selection-summary" role="status">${esc(summary)}</span></header>
      <div class="receiver-chips receiver-scope-grid" data-count="${count}">
        <button class="scope-lines-toggle" data-action="scope-toggle-lines" aria-label="${esc(scopeToggleLabel)}" aria-expanded="${expanded}" aria-controls="${esc(panelId)}"><span class="scope-toggle-icon" aria-hidden="true">${all?icon('together'):icon('light')}</span><span class="scope-copy"><span class="scope-option-title">${esc(scopeToggleLabel)}</span><small>${esc(scopeToggleHint)}</small></span>${all?`<span class="scope-all-status" aria-hidden="true">${icon('check')}</span>`:''}<span class="scope-toggle-chevron" aria-hidden="true">${icon('chevron')}</span></button>
        <div class="scope-lines-reveal ${expanded?'is-open':''}" id="${esc(panelId)}" aria-hidden="${!expanded}" ${expanded?'':'inert'}><div class="scope-lines-inner"><div class="scope-choice-label"><span>${esc(t('scopeIndividual'))}</span></div><button class="selection-together scope-all-choice" data-action="select" data-id="all" aria-label="${esc(t('scopeAllAria'))}" aria-pressed="${all}">${icon('together')}<span class="scope-copy"><span class="scope-option-title">${esc(t('together'))}</span><small>${esc(t(lines===1?'scopeTogetherOne':'scopeTogetherMany',{count:lines}))}</small></span><span class="scope-selected-mark" aria-hidden="true">${icon('check')}</span></button><div class="scope-lines-list">${list.map((r,i)=>{const pressed=all||ids.includes(r.id);return `<button class="scope-line" data-action="select" data-id="${esc(r.id)}" aria-label="${esc(`${receiverLineLabel(r,i,list)} · ${typeOf(r)} bedienen`)}" aria-pressed="${pressed}"><span class="scope-line-icon" aria-hidden="true">${icon('light')}</span><span class="scope-copy"><span class="scope-option-title">${esc(receiverLineLabel(r,i,list))}</span><small>${r.type==='RGBW'?'RGBW':'Pixel LED · SPI'}</small></span><span class="scope-selected-mark" aria-hidden="true">${icon('check')}</span></button>`;}).join('')}</div></div></div>
      </div><p class="mixed-note" ${mixedSelection()?'':'hidden'}>De gekozen ledlines hebben verschillende instellingen. Je volgende wijziging geldt voor allemaal.</p></section>`;
  }
  function controlContext(screen) {
    const z = zone(), title = screen === 'colour' ? 'Vaste kleur' : screen === 'animations' ? 'Animaties' : z.name;
    const atRoot = screen === 'controls' || screen === 'layout';
    const list=receivers();
    const modeTabs=screen==='controls'?`<div class="section-tabs control-mode-tabs" role="group" aria-label="Kleur of animatie"><button data-action="colour" aria-pressed="${controlMode==='colour'}">${icon('sun')}Kleur</button><button data-action="animations" aria-label="Effecten" aria-pressed="${controlMode==='animations'}">${icon('animation')}Effecten</button></div>`:'';
    const galleryBack=screen==='animations'&&Boolean(activeEffect()),backLabel=atRoot?'Terug naar zones':galleryBack?'Animatiegalerij':`Bediening · ${z.name}`,backAction=atRoot?'stand':galleryBack?'animations-gallery':'controls';
    const integratedControlHeading=screen==='controls'&&atRoot;
    const pickerDetail=screen==='animation-family';
    return `${integratedControlHeading||pickerDetail?'':`<section class="control-context${list.length>=5?' many-receivers':''}">${contextTitle(title,atRoot ? `${ledlineCount(physicalLineCount(list))} · in ${standLabel()}` : z.name,backLabel,backAction)}</section>`}${controlPreviewDock(screen,modeTabs)}`;
  }
  function currentLightLabel(){
    const effect=activeEffect();return mixedSelection()?'Verschillende instellingen':effect?Library.displayName(effect,t):'Vaste kleur';
  }
  function syncControlLocation(){
    if(!zone())return;
    for(const label of main.querySelectorAll('[data-current-light]'))label.textContent=currentLightLabel();
  }
  function controlPreviewDock(screen,modeTabs='') {
    const z=zone(),list=receivers(),pixels=z.type==='SPI'?P.geometry(list,z.layout).totalPixels:0;
    const draft=previewArrangement(z),previewLayout=draft?.layout||z.layout;
    const integratedControlHeading=screen==='controls';
    const familyGroup=screen==='animation-family'&&route.family?Library.group(catalogue(),route.family):null;
    const effectChosen=screen==='controls'&&controlMode==='animations'&&Boolean(activeEffect());
    const galleryBrowsing=Boolean(familyGroup)||screen==='controls'&&controlMode==='animations'&&(!effectChosen||showControlAnimationGallery);
    // Keep the tunnel/wall hero out of the category list. It appears when the
    // customer opens a spatial effect group, and remains on the active effect.
    const galleryTunnel=Boolean(familyGroup&&familyGroup.preview.category==='tunnel');
    const canTapLines=list.length>1&&!continuousZone()&&!draft&&!galleryTunnel&&['controls','colour','animations'].includes(screen);
    // While browsing tunnel & wall effects, show a four-line example or the
    // currently opened family's recipe across the actual zone members. This
    // is presentation only; the selected animation is applied only on a tap.
    const tunnelSettingsOpen=activeEffect()?.category==='tunnel'&&!galleryBrowsing&&(screen==='controls'||screen==='animations');
    const spatialView=galleryTunnel?spatialEffectView(z):tunnelSettingsOpen?spatialMode(previewLayout,z):'normal';
    const spatialPreview=(tunnelSettingsOpen||galleryTunnel)&&['tunnel','wall'].includes(spatialView);
    const previewMode=spatialPreview?(spatialView==='wall'?'Wall':'Tunnel'):previewLayout==='continuous'?'Continuous':'Normal';
    const spatialPreviewLabel=spatialPreview?spatialPreviewText('Preview',spatialView):'';
    const count=physicalLineCount(list);
    const total=z.type==='SPI'?t(count===1?'scopeTotalSpiOne':'scopeTotalSpiMany',{count,pixels}):t(count===1?'scopeCountOne':'scopeCountMany',{count});
    const scope=galleryTunnel?(route.family?`${Library.group(catalogue(),route.family)?.title||t('animationAcross')} · ${ledlineCount(count)}`:t('animationTunnelSampleLines')):selection().kind==='all'?total:t('scopeSelectedTap',{name:nameOfSelection()});
    const modeName=screen==='controls'?(controlMode==='colour'?'Kleur':'Effecten'):screen==='animation-family'?'Animatiegroep':screen==='layout'?'Opstelling':screen==='colour'?'Kleur':screen==='animations'?'Effecten':'Bediening';
    const label=`LED-overzicht van ${z.name} · ${total}${selection().kind==='all'?'':` · ${nameOfSelection()} gekozen`}`;
    const currentEffect=activeEffect(),currentLight=currentLightLabel();
    const screenLabel=screen==='animation-family'?'Animatiegroep':galleryBrowsing?'Animaties kiezen':currentEffect&&modeName==='Effecten'?'Animatie instellen':modeName;
    return `<section class="control-preview-dock${galleryBrowsing?' animation-gallery-dock':''}" aria-label="LED-overzicht en bediening"><div class="control-dock-surface">
      ${integratedControlHeading?`<div class="control-dock-context-line"><div class="control-dock-location"><small>JE LICHT · ${esc(modeName)}</small><b>${esc(z.name)}</b></div><span class="pill control-dock-type-badge">${zoneTypeLabel(z)}</span></div><div class="control-dock-actions"><button class="back back-to-zones control-dock-back" data-action="stand" aria-label="Terug naar zones" title="Terug naar zones">${icon('back')}<span>Zones</span></button>${modeTabs}</div>`:''}
      ${integratedControlHeading?'':`<div class="control-dock-heading"><div class="control-dock-location"><small>JE LICHT · ${esc(screenLabel)}</small><b>${esc(z.name)}</b></div>${modeTabs||`<span class="control-dock-mode">${zoneTypeLabel(z)}</span>`}</div>`}
      <div class="control-location-summary" aria-label="Huidige bediening"><span>${esc(screenLabel)}</span><span data-current-light>${esc(currentLight)}</span></div>
      <div class="preview-wrap${canTapLines?' preview-selectable':''}${spatialPreview?' spatial-preview-wrap':''}" data-preview-layout="${previewLayout}"><div class="preview-top"><span>${galleryTunnel?esc(t(spatialView==='wall'?'animationWallSampleTitle':'animationTunnelSampleTitle')):spatialPreview?esc(spatialPreviewLabel):esc(t('lineSetup'+previewMode))}</span><span class="preview-summary">${esc(scope)}</span></div>${spatialPreview?'':previewSizePickerMarkup(controlPreviewSize)}${galleryTunnel?tunnelGalleryPreviewMarkup(route.family?Library.group(catalogue(),route.family):null,'spatial-dock-preview'):zonePreview(z,spatialPreview?'spatial-dock-preview':'',{selection:selection(),main:true,arrangementPreview:true,lineNumbers:Object.fromEntries(list.map((receiver,index)=>[receiver.id,index+1])),...(spatialPreview?{spatialShape:spatialView,presentation:'receivers'}:{}),label:spatialPreview?`${spatialPreviewLabel} · ${z.name} · ${total}`:label})}</div>
      ${galleryTunnel?familySpatialChoice():''}${animationWayfinding(screen)}<p class="live-confirmation" data-live-status="zone" role="status" aria-live="polite"></p>
    </div></section>`;
  }
  function zoneTypeLabel(z) { return z.type==='SPI'?'Pixel LED · SPI':z.type==='RGBW'?'RGBW':'Nog geen verlichting'; }
  function animationWayfinding(screen){
    if(screen==='animation-family'&&route.family)return `<nav class="animation-wayfinding family-wayfinding" data-family-back-shortcut hidden aria-label="${esc(t('animationNavigation'))}"></nav>`;
    if(!(screen==='animations'||screen==='controls'&&controlMode==='animations'))return '';
    const browsing=screen==='controls'&&showControlAnimationGallery;
    if(browsing&&activeEffect()&&!route.family)return `<nav class="animation-wayfinding" data-editor-return-shortcut hidden aria-label="${esc(t('animationNavigation'))}"></nav>`;
    if(!activeEffect()||browsing)return '';
    return `<nav class="animation-wayfinding" data-editor-shortcut hidden aria-label="${esc(t('animationNavigation'))}"></nav>`;
  }
  function previewSizePickerMarkup(size=controlPreviewSize,spatial=false){
    const sizes=[['small','Klein'],['medium','Middel'],['large','Groot']],current=sizes.find(([value])=>value===size)?.[1]||'Klein',subject=spatial?'3D-voorbeeld':'ledlinevoorbeeld';
    return `<div class="preview-size-row"><details class="preview-size-control"><summary aria-label="Grootte van het ${subject} ${current}. Tik om te wijzigen"><span>${spatial?'3D-voorbeeld':'Voorbeeld'}</span><b>${current}</b>${icon('chevron')}</summary><div class="preview-size-picker" role="group" aria-label="Grootte van het ${subject}">${sizes.map(([value,title])=>`<button type="button" data-action="preview-size" data-id="${value}" aria-label="${title} ${spatial?'3D-voorbeeld':'voorbeeld'}" aria-pressed="${size===value}">${title}</button>`).join('')}</div></details></div>`;
  }
  function zoneDeleteButton(z,css=''){return `<button type="button" class="zone-delete-shortcut ${css}" data-action="zone-delete" data-id="${esc(z.id)}" aria-label="Zone ${esc(z.name)} verwijderen">${icon('trash')}<span>Zone verwijderen</span></button>`;}
  function renderEmptyZone() {
    const z=zone();
    const reusable=standReceivers().some(receiver=>receiver.zoneId!==z.id&&(!z.type||receiver.type===z.type));
    return `<div class="page empty-zone-page"><div class="topline"><button class="back back-to-zones" data-action="stand">${icon('back')}<span>Terug naar zones</span></button><span class="context-name">${esc(standLabel())}</span></div><header class="page-heading overview-heading"><div><div class="eyebrow">LEGE ZONE</div><h1>${esc(z.name)}</h1></div><button class="icon-button" data-action="zone-rename" data-id="${esc(z.id)}" aria-label="Naam van deze zone wijzigen">${icon('edit')}</button></header><section class="card empty empty-zone zone-start-card"><span class="menu-icon" aria-hidden="true">${icon('receiver')}</span><h2>Voeg verlichting toe</h2><p>${reusable?'Nieuwe receiver, of eentje uit je stand.':'Begin met een receiver in deze zone.'}</p><button class="button full zone-primary-action" data-action="layout-new-receiver" data-zone="${esc(z.id)}">${icon('receiver')}Nieuwe receiver toevoegen</button>${reusable?`<button class="button secondary full" data-action="zone-assign" data-id="${esc(z.id)}">Bestaande receiver kiezen</button>`:''}<small class="zone-family-note">${z.type?`Voor ${esc(z.type)}-verlichting.`:'RGBW of SPI · je eerste receiver bepaalt het type.'}</small></section>${zoneDeleteButton(z)}</div>`;
  }
  function renderStand() {
    if(!stand()){
      const pending=onboarding.summary(),step=!pending?.stand||pending.stage==='stand'?1:pending.stage==='zones'?2:3;
      if(!pending?.stand)return `<div class="page onboarding-welcome onboarding-entry"><header class="page-heading"><div><h1>Je stand</h1></div></header><section class="stand-entry-choices" aria-label="Beginnen met je stand"><button type="button" class="stand-entry-choice" data-action="stand-create-open" data-stand-entry="setup"><span class="menu-icon" aria-hidden="true">${icon('zones')}</span><span><b>Stand instellen</b><small>Voeg receivers toe.</small></span>${icon('chevron')}</button>${webDemoContext?'':`<button type="button" class="stand-entry-choice" data-action="stand-connect" data-stand-entry="open"><span class="menu-icon" aria-hidden="true">${icon('wifi')}</span><span><b>Stand openen</b><small>Via je standwifi.</small></span>${icon('chevron')}</button>`}</section>${canStartLocalStand()?'<button type="button" class="text-button stand-skip-setup" data-action="stand-continue-local">Verder zonder setup</button><p class="stand-skip-note">Maak alvast je zones. Je verbindt later je eerste receiver.</p>':''}</div>`;
      return `<div class="page onboarding-welcome"><header class="page-heading"><div><div class="eyebrow">${pending?.stand?'SETUP NIET AFGEROND':'WELKOM'}</div><h1>${esc(pending?.stand?.name||'Je stand instellen')}</h1></div></header><section class="stand-setup-overview" aria-label="Je stand instellen">${['Standnaam','Zones maken','Receivers toevoegen'].map((label,i)=>`<div class="stand-setup-row ${i+1===step?'active':''}"><i>${i+1<step?'✓':i+1}</i><span><small>STAP ${i+1}</small><b>${label}</b></span><small>${i+1<step?'Klaar':i+1===step?'Volgende':''}</small></div>`).join('')}</section>${pending?.zones.length?`<div class="stand-draft-zones">${pending.zones.map(z=>`<div>${icon('zones')}<b>${esc(z.name)}</b><small>Nog geen receiver toegevoegd</small></div>`).join('')}</div>`:''}<button class="button full onboarding-next-action" data-setup-resume data-action="receiver-add">${pending?.stand?'Setup verderzetten':'Mijn stand instellen'}</button>${canContinuePendingLocalStand()?'<button type="button" class="text-button stand-skip-setup" data-action="stand-continue-local">Verder zonder setup</button><p class="stand-skip-note">Je standnaam en zones blijven op dit toestel bewaard.</p>':''}</div>`;
    }
    const s = stand(), added = standReceivers();
    return `<div class="page stand-page"><header class="page-heading overview-heading"><div><div class="eyebrow">${localStandConcept()?'LOKAAL CONCEPT':'JOUW STAND'}</div><h1>${esc(standLabel())}</h1></div><button class="icon-button circle" data-action="help" aria-label="Uitleg over stand en zones">${icon('info')}</button></header>${localStandConcept()?'<p class="local-stand-notice" role="status">Alleen op dit toestel. Er is nog geen receiver verbonden. Bij je eerste receiver kies je de wifi-PIN.</p>':''}<div class="stand-summary overview-summary"><div>${icon('zones')}<span><b>${s.zones.length}</b><small>Zones</small></span></div><div>${icon('light')}<span><b>${physicalLineCount(added)}</b><small>Ledlines</small></span></div></div><section class="zone-section"><div class="section-heading"><h2>${esc(t('zones'))}</h2><button class="text-button" data-action="zone-new">＋ Nieuwe zone</button></div><div class="zone-grid">${s.zones.map(z=>`<article class="zone-entry"><button class="zone-card" data-action="zone" data-id="${esc(z.id)}">${zonePreview(z,'',{label:`Voorbeeld van ${z.name}`})}<div class="zone-copy"><div class="zone-card-heading"><b>${esc(z.name)}</b><span class="zone-meta"><span class="zone-family-badge">${zoneTypeLabel(z)}</span>${z.type?` · <span class="zone-line-count">${ledlineCount(physicalLineCount(M.zoneReceivers(model,z.id)))}</span>`:''}</span></div><span class="open-label">${M.zoneReceivers(model,z.id).length?'Bedienen':'Instellen'} ${icon('chevron')}</span></div></button><button class="zone-options-button" data-action="zone-options" data-id="${esc(z.id)}" aria-label="Opties voor zone ${esc(z.name)}">•••</button></article>`).join('')}</div></section>${standScenesMarkup(false)}</div>`;
  }
  function powerControl() {
    const states = powerTargets().map(r => r.state.on !== false && r.state.power !== false);
    const value = states.length&&states.every(Boolean) ? true : states.some(Boolean) ? 'mixed' : false;
    const scope=standControlOpen?'stand':'zone';
    return `<div class="power-card power-card-${scope}"><div><strong>${icon('power')}Hele ${scope}</strong></div><button class="switch" role="switch" aria-label="${value==='mixed'?`Deels aan; zet de hele ${scope} aan`:`Hele ${scope} aan of uit`}" aria-checked="${value===true}" data-mixed="${value==='mixed'}" data-action="power" ${states.length?'':'disabled'}><span>${value === 'mixed' ? 'Deels aan' : value ? 'Aan' : 'Uit'}</span><i aria-hidden="true"></i></button></div>`;
  }
  function renderControls() {
    const colour=controlMode==='colour';
    const activeAnimationEditor=!colour&&Boolean(activeEffect())&&!showControlAnimationGallery;
    const spatialGallery=!colour&&showControlAnimationGallery&&libraryTab()==='tunnel';
    const workspaceHeadingId=colour?'bediening-colour-title':activeAnimationEditor?'active-animation-title':'animation-selector-heading';
    const modeContent=colour
      ?`<section class="bediening-workspace" aria-labelledby="${workspaceHeadingId}"><div class="animation-context">${selector()}${powerControl()}</div>${colourPickerMarkup()}</section>`
      :`<section class="bediening-workspace animation-simple-workspace${activeAnimationEditor?' has-active-animation':''}" aria-labelledby="${workspaceHeadingId}">${spatialGallery?'':`<div class="animation-context">${selector()}${powerControl()}</div>`}${controlAnimationPanel()}</section>`;
    return `<div class="editor-grid${colour?' editor-grid-colour':' animation-simple-page'}">${controlContext('controls')}<section class="editor-controls editor-controls-zone">${ledlineSetupMarkup()}<section class="control-workspace"><div class="control-mode-panel" role="region" aria-label="${colour?'Vaste kleur':'Animaties'}" data-control-mode="${controlMode}">${modeContent}</div></section></section></div>`;
  }

  function controlAnimationPanel(){
    const effect=activeEffect();
    if(effect&&!showControlAnimationGallery)return animationEditorMarkup(effect);
    return `<div class="control-animation-choices">${animationLibraryContent()}</div>`;
  }
  function slider(key,label,min,max,value,unit='',hint='',guide=null) {
    const title=guide?.icon?`<span class="setting-label-icon">${icon(guide.icon)}</span><span class="setting-label-copy">${esc(label)}</span>`:esc(label);
    const description=guide?.description||hint;
    return `<div class="slider-row${guide?.icon?' has-setting-icon':''}"><label for="setting-${key}">${title}<output data-value-for="${key}">${Math.round(value)}${unit}</output></label><input id="setting-${key}" type="range" min="${min}" max="${max}" step="1" value="${value}" data-setting="${key}" data-unit="${unit}">${description ? `<small>${esc(description)}</small>` : ''}</div>`;
  }
  function renderColour() {
    return `<div class="editor-grid editor-grid-colour">${controlContext('colour')}<section class="editor-controls">${ledlineSetupMarkup()}${selector()}${colourPickerMarkup()}</section></div>`;
  }
  function myColoursMarkup() {
    const entries=savedColours.colors;
    return `<section class="my-colours"><div class="section-heading"><h3>${esc(t('myColours'))}</h3><div class="colour-library-actions"><button class="icon-button colour-manager-button" data-action="colours-manager" aria-label="${esc(t('colourManagerTitle'))}" title="${esc(t('colourManagerTitle'))}" ${entries.length?'':'disabled'}>${icon('settings')}</button><button class="text-button" data-action="colours-manage" aria-pressed="${colourOrderMode}" ${entries.length<2&&!colourOrderMode?'disabled':''}>${esc(t(colourOrderMode?'done':'colourOrder'))}</button></div></div>${colourOrderMode?`<p class="colour-library-hint">${esc(t('colourLibraryOrderHint'))}</p>`:''}<div class="saved-colour-grid ${colourOrderMode?'is-ordering':''}">${entries.map(entry=>`<div class="saved-colour-item${entry.group==='brand'?' is-brand':''}" data-colour-id="${esc(entry.id)}"><button class="saved-colour" data-action="swatch" data-id="${esc(entry.id)}" data-rgb="${entry.color.r},${entry.color.g},${entry.color.b}" data-white="${entry.color.w}" style="--swatch:${C.screenHex([entry.color.r,entry.color.g,entry.color.b],entry.color.w)}" aria-label="${esc(entry.name)}${entry.group==='brand'?` · ${esc(t('brandTag'))}`:''}"><i></i><span>${esc(entry.name)}</span>${entry.group==='brand'?`<small class="saved-colour-kind">${esc(t('brandTag'))}</small>`:''}</button>${colourOrderMode?`<button class="colour-drag-handle" data-colour-drag="${esc(entry.id)}" aria-label="${esc(entry.name)} verslepen" title="Versleep om de volgorde te wijzigen"><span aria-hidden="true">⠿</span><small>Sleep</small></button>`:''}</div>`).join('')}<button class="saved-colour add-colour" data-action="colour-new" aria-label="${esc(t('saveCurrentColour'))}"><i aria-hidden="true">＋</i><span>${esc(t('saveColour'))}</span></button></div><div class="colour-library-feedback"><p class="colour-library-status" role="status">${esc(colourLibraryNotice)}</p></div>${savedColours.error?`<p role="alert">${esc(savedColours.error.message)}</p>`:''}</section>`;
  }
  function showColourManager(notice=colourLibraryNotice) {
    if(!colourManagerReturn){
      const dialog=document.getElementById('effect-dialog');
      colourManagerReturn={open:dialog.open,title:dialog.querySelector('#effect-dialog-title')?.textContent||'',content:document.getElementById('effect-dialog-content').innerHTML,scrollTop:dialog.scrollTop,brandEditor:brandEditor?{...brandEditor,color:{...brandEditor.color},memory:{...brandEditor.memory}}:null};
    }
    colourManagerVisible=true;
    colourLibraryNotice=notice;
    const brands=savedColours.colors.filter(entry=>entry.group==='brand'),brandIndex=new Map(brands.map((entry,index)=>[entry.id,index]));
    const rows=savedColours.colors.map(entry=>{const brand=entry.group==='brand',index=brandIndex.get(entry.id);return `<div class="colour-manager-row${brand?' is-brand':''}"><span class="colour-manager-swatch" style="--swatch:${C.screenHex([entry.color.r,entry.color.g,entry.color.b],entry.color.w)}" aria-hidden="true"><i></i></span><span class="colour-manager-copy"><b>${esc(entry.name)}</b><small>${brand?`${esc(t('brandTag'))} · `:''}RGB ${entry.color.r} · ${entry.color.g} · ${entry.color.b} · W ${entry.color.w}</small></span>${brand?`<button class="text-button colour-manager-edit" data-action="brand-colour-edit" data-id="${index}" aria-label="${esc(t('brandEdit',{number:index+1}))}">${esc(t('brandEditAction'))}</button>`:''}<button class="icon-button colour-manager-remove" data-action="colour-remove" data-id="${esc(entry.id)}" aria-label="${esc(entry.name)} verwijderen" ${brand&&brands.length<=1?`disabled title="${esc(t('brandLastColorHint'))}"`:''}>${icon('trash')}</button></div>`;}).join('');
    const body=`<section class="colour-manager" data-colour-manager><p>${esc(t('colourManagerIntro'))}</p>${rows?`<div class="colour-manager-list">${rows}</div>`:`<div class="colour-manager-empty"><span class="menu-icon">${icon('trash')}</span><b>${esc(t('colourManagerEmpty'))}</b><small>${esc(t('colourManagerEmptyHint'))}</small></div>`}${brands.length<4?`<button class="button secondary full" data-action="brand-colour-add">＋ ${esc(t('brandAdd'))}</button>`:''}<p class="colour-library-status" role="status">${esc(colourLibraryNotice)}</p>${removedColour?`<button class="button secondary full" data-action="colour-undo">${esc(t('colourManagerUndo'))}</button>`:''}</section>`;
    showEffectDialog(t('colourManagerTitle'),body);
    document.querySelector('#effect-dialog [data-action="colour-remove"],#effect-dialog [data-action="effect-dialog-close"]')?.focus({preventScroll:true});
  }
  function closeColourManager(){
    const previous=colourManagerReturn;colourManagerReturn=null;colourManagerVisible=false;brandEditor=previous?.brandEditor||null;
    if(standControlOpen&&previous?.content?.includes('data-stand-control-sheet'))standDialogNested=null;
    if(!previous?.open){
      document.querySelectorAll('main .my-colours').forEach(section=>section.outerHTML=myColoursMarkup());
      closeEffectDialog();return;
    }
    const wasBuilding=buildingStandDialog;buildingStandDialog=standControlOpen;
    try{showEffectDialog(previous.title,previous.content);}finally{buildingStandDialog=wasBuilding;}
    document.querySelectorAll('#effect-dialog .my-colours').forEach(section=>section.outerHTML=myColoursMarkup());
    document.querySelectorAll('#effect-dialog .brand-tone-picker').forEach(section=>{
      const open=section.querySelector('details')?.open,wrapper=document.createElement('div');wrapper.innerHTML=brandTonePicker();
      const next=wrapper.firstElementChild;if(open)next.querySelector('details').open=true;section.replaceWith(next);
    });
    const dialog=document.getElementById('effect-dialog');dialog.scrollTop=previous.scrollTop;
    paintWheel();syncColour();
    document.querySelector('#effect-dialog [data-action="colours-manager"]')?.focus({preventScroll:true});
  }
  function refreshColourLibraries(source,notice='') {
    colourLibraryNotice=notice;
    const root=source?.closest('[data-colour-picker]'),action=source?.dataset.action,id=source?.dataset.id;
    const scroll=window.scrollY,dialog=document.getElementById('effect-dialog'),dialogScroll=dialog.scrollTop;
    document.querySelectorAll('.my-colours').forEach(section=>section.outerHTML=myColoursMarkup());
    const same=root&&Array.from(root.querySelectorAll('button[data-action]')).find(button=>button.dataset.action===action&&button.dataset.id===id&&!button.disabled);
    (same||root?.querySelector('[data-action="colour-new"]'))?.focus({preventScroll:true});
    window.scrollTo({top:scroll,left:0,behavior:'instant'});dialog.scrollTop=dialogScroll;
  }
  async function saveCurrentColour(button) {
    const root=button.closest('[data-colour-picker]');if(!root)return;
    const values=pickerChannels(root),color={r:values[0],g:values[1],b:values[2],w:values[3],bri:root.dataset.colourPicker==='brand'?100:root.dataset.colourPicker==='background'?(selectedState().bgBrightness??10):(selectedState().bri??100)};
    const current=colourStore.load();if(current.error)return refreshColourLibraries(button,current.error.message);
    const base=Colours.suggestName(color);let name=base,suffix=2;
    while(current.colors.some(entry=>entry.name===name))name=`${base} ${suffix++}`;
    const result=colourStore.save(Colours.capture(name,color));
    if(result.error)return refreshColourLibraries(button,result.error.message);
    try{await confirmCentralLibrary(result);}catch(_){return refreshColourLibraries(button,'Opslaan bij de hoofdreceiver is niet bevestigd.');}
    savedColours=result;refreshColourLibraries(button,`${name} toegevoegd aan Kleurpresets.`);
  }
  window.LightningColourLibraryDrag?.install({document,onMove:async({id,toIndex,source})=>{
    // The one visible grid now represents the complete shared library.
    const target=savedColours.colors[toIndex];
    if(!target)return;
    const result=colourStore.move(id,savedColours.colors.findIndex(entry=>entry.id===target.id));if(result.error)return refreshColourLibraries(source,result.error.message);
    savedColours=result;refreshColourLibraries(source,simpleStandMode?'Volgorde bewaren…':'Volgorde bewaard.');
    try{await confirmCentralLibrary(result);refreshColourLibraries(source,'Volgorde bewaard.');}
    catch(_){refreshColourLibraries(source,'Opslaan bij de hoofdreceiver is niet bevestigd.');}
  }});
  function colourPickerMarkup(slot=null,compact=false) {
    const s=selectedState(),brand=slot==='brand',background=slot==='background',values=brand?brandEditorChannels():background?backgroundChannels():effectiveColourChannels(slot??0),rgb=values.slice(0,3),white=values[3];
    const prefix=slot===null?'static':'palette-'+slot;
    const channels=['r','g','b','w'].map((channel,i)=>{const value=i===3?white:rgb[i];return `<div class="channel-row" style="--channel:${['#c4473f','#258461','#3f69c7','#747670'][i]}"><button class="channel-toggle" data-action="channel-toggle" data-channel="${channel}" aria-label="Kanaal ${channel.toUpperCase()} ${value>0?'uitschakelen':'inschakelen'}" aria-pressed="${value>0}">${channel.toUpperCase()}</button><button data-action="channel-step" data-channel="${channel}" data-step="-1" aria-label="${channel.toUpperCase()} verminderen">−</button><input id="${prefix}-${channel}" type="range" min="0" max="255" value="${value}" data-channel="${channel}" aria-label="Kanaal ${channel.toUpperCase()} waarde"><button data-action="channel-step" data-channel="${channel}" data-step="1" aria-label="${channel.toUpperCase()} verhogen">+</button><input class="channel-number" type="number" inputmode="numeric" min="0" max="255" step="1" value="${value}" data-channel-number="${channel}" aria-label="Kanaal ${channel.toUpperCase()} exact instellen"></div>`;}).join('');
    const fineControls=`<div class="fine-controls${compact?' stand-fine-controls':''}" data-colour-fine><h3>Fijn instellen</h3><div class="fine-controls-body"><p class="channel-help">${esc(t('channelHelp'))}</p>${channels}</div></div>`;
    const warmth=slot===null?C.warmthOf(values):null;
    const warmControls=slot===null?`<div class="warm-white-controls"><button type="button" class="warm-white-choice" data-action="warm-white" aria-pressed="${warmth!==null}"><span class="warm-white-swatch" aria-hidden="true"></span><span><b>Warmwit</b><small>RGB + W</small></span>${icon('sun')}</button><div class="slider-row warmth-row"><label for="${prefix}-warmth">Warmte <output data-warmth-value>${warmth===null?'Kies Warmwit':warmth+'%'}</output></label><input id="${prefix}-warmth" type="range" min="0" max="100" step="1" value="${warmth??50}" data-warmth aria-label="Warmte van de witmix" ${warmth===null?'disabled':''}><div class="warmth-scale"><span>Neutraler</span><span>Warmer</span></div><small class="warmth-help">${warmth===null?'Kies Warmwit om in te stellen.':'Helderheid stel je apart in.'}</small></div></div>`:'';
    return `<section class="card colour-card shared-colour-picker" data-colour-picker="${brand?'brand':background?'background':slot===null?'static':'animation'}" data-slot="${brand?brandEditor.index:slot??''}">
      <div class="section-heading"><h2 ${slot===null?'id="bediening-colour-title" ':''}tabindex="-1">${background?'Achtergrondkleur':'Kleur kiezen'}</h2></div>
      <div class="colour-tools"><div class="wheel-wrap"><canvas class="wheel" id="colour-wheel" tabindex="0" role="img" aria-label="Kleurenwiel. Gebruik de pijltjestoetsen of de regelaars onder Fijn instellen voor exacte waarden." width="260" height="260"></canvas><span class="wheel-cursor"></span></div><div class="colour-values"><div class="colour-swatch" aria-label="Gekozen kleur"></div><p class="setting-hint">${esc(t('colourWheelHint'))}</p>${brand?`<small class="brand-picker-note">${esc(t(brandEditor.isNew?'brandPickerNewHint':'brandPickerHint'))}</small>`:slot===null?'':'<small>Je animatie blijft actief.</small>'}</div></div>
      ${brand?`<label class="dialog-field brand-name-field">${esc(t('brandNameLabel'))}<input type="text" data-brand-name maxlength="64" autocomplete="off" value="${esc(brandEditor.name)}"></label><p class="brand-picker-status" role="status" aria-live="polite"></p>`:''}
      ${slot===null?slider('bri','Helderheid',0,100,s.bri??100,'%'):''}
      ${warmControls}
      ${fineControls}
      ${myColoursMarkup()}
    </section>`;
  }
  function backgroundChannels(){
    const s=selectedState(),background=s.background;
    const rgb=s.backgroundRgbEnabled===false?[0,0,0]:rgbOf({colors:[typeof background==='string'?background:background?.rgb||'#000000']});
    return [...rgb,s.backgroundWhiteEnabled===false?0:(s.backgroundWhite??background?.white??0)];
  }
  function backgroundControls(effect){
    if(!effect.backgroundEditable)return '';
    const s=selectedState(),channels=backgroundChannels(),on=Boolean(s.backgroundOn);
    const description=t(standControlOpen||zone()?.type==='RGBW'||effect.category==='whole'?'animationBackgroundWhole':'animationBackgroundPixels');
    return `<section class="animation-background" aria-label="${esc(t('animationBackground'))}"><div class="background-control-heading"><span class="setting-label-icon">${icon('layers')}</span><span class="background-control-copy"><b>${esc(t('animationBackground'))}</b></span><button class="switch" data-action="background-toggle" aria-label="${esc(t('animationBackground'))}" aria-pressed="${on}" aria-checked="${on}" role="switch"><span>${on?'Aan':'Uit'}</span><i aria-hidden="true"></i></button></div><div class="background-details" data-background-details ${on?'':'hidden'}><p class="background-explanation">${esc(description)}</p><button class="background-colour" data-action="background-edit"><span class="background-swatch" style="background:${C.screenHex(channels.slice(0,3),channels[3])}"></span><span>${esc(t('animationBackgroundChoose'))}</span>${icon('chevron')}</button>${animationSlider('bgBrightness',t('animationBackgroundBrightness'),0,100,s.bgBrightness??10,'%')}${resetMarkup('bgBrightness',t('animationBackgroundBrightness'))}</div></section>`;
  }
  const animationSettingGuides={
    bri:{icon:'sun',description:''},
    speed:{icon:'animation',description:''},
    bgBrightness:{icon:'sun',description:''},
    smooth:{icon:'sparkle',description:'100% = meest vloeiend.'},
    widthPixels:{icon:'light',description:'Pixels per lichtpunt.'},
    objectCount:{icon:'together',description:'Gelijktijdige lichtpunten.'},
    trailLength:{icon:'animation',description:'Lengte achter het lichtpunt.'},
    spacing:{icon:'zones',description:'Ruimte tussen lichtpunten.'},
    lineDelayMs:{icon:'clock',description:'Wachttijd per volgende ledline.'},
    delayMs:{icon:'clock',description:'Pauze tussen bewegingen.'},
    fadeAmount:{icon:'sun',description:'Zachter aan- en uitvloeien.'},
    width:{icon:'light',description:'Breedte van de lichtbundel.'},
    spread:{icon:'zones',description:'Bereik over de ledlines.'},
    randomness:{icon:'sparkle',description:'Variatie in de beweging.'}
  };
  function animationControls(effect) {
    if (!effect) return '';
    const s = selectedState(), available = effect.controls;
    const specs = [
      ['widthPixels','Breedte',1,60,s.widthPixels??M.DEFAULT_ANIMATION_WIDTH,' px',''],
      ['objectCount','Aantal lichtpunten',1,8,s.objectCount??1,'',''],
      ['trailLength','Staart',0,100,s.trailLength??12,'%',''],
      ['spacing','Afstand',0,100,s.spacing??30,'%',''],
      ['lineDelayMs','Startverschil tussen ledlines',0,5000,s.lineDelayMs??160,' ms','Bepaalt hoeveel later elke volgende ledline begint.'],
      ['delayMs','Minimale tijd tussen ledlines',0,10000,s.delayMs??300,' ms','Bepaalt hoe lang het licht minimaal wacht voor de volgende ledline.'],
      ['fadeAmount','Zacht aan en uit',0,100,s.fadeAmount??90,'%',''],
      ['width','Breedte van het licht',0,100,s.width??65,'%',''],
      ['spread','Spreiding',0,100,s.spread??30,'%',''],
      ['randomness','Variatie',0,100,s.randomness??20,'%','']
    ];
    const directionLabels=!standControlOpen&&zone()?.layout==='vertical'?['→ Naar rechts','← Naar links']:effect.category==='tunnel'?['↓ Volgorde 1 → 2','↑ Volgorde 2 → 1']:['→ Vooruit','← Achteruit'];
    const directionMap={right:directionLabels[0],left:directionLabels[1],forward:directionLabels[0],reverse:directionLabels[1],bounce:'↔ Heen en weer','center-out':'← · → Vanuit het midden','outside-in':'→ · ← Naar het midden'};
    // A line-to-line delay cannot change a single selected line. Keep the
    // saved setting intact, but don't offer an inactive control in that scope.
    const controls=specs.filter(spec=>available.includes(spec[0])&&!(spec[0]==='lineDelayMs'&&physicalLineCount(selected())<2));
    const smoothness=available.includes('smooth')?`<div class="animation-setting">${animationSlider('smooth','Vloeiendheid',0,100,s.smooth??100,'%',animationSettingGuides.smooth.description)}${resetMarkup('smooth','Vloeiendheid')}</div>`:'';
    if(!controls.length&&!smoothness&&!['direction','bounce','mirror'].some(key=>available.includes(key)))return '';
    const advancedKeys=new Set([...controls.map(spec=>spec[0]),...['smooth','direction','bounce','mirror'].filter(key=>available.includes(key))]);
    const hintKeys=[['smooth','Smooth'],['direction','Direction'],['trailLength','Trail'],['widthPixels','Width'],['width','Width'],['objectCount','Points'],['spacing','Spacing'],['lineDelayMs','Timing'],['delayMs','Timing'],['fadeAmount','Fade'],['spread','Spread'],['randomness','Variation'],['bounce','Bounce'],['mirror','Mirror']].filter(([key])=>advancedKeys.has(key)).map(([,label])=>'animationAdvanced'+label);
    const hintOptions=[...new Set(hintKeys)],hint=hintOptions.slice(0,3).map(key=>t(key)).join(' · ')+(hintOptions.length>3?' · '+t('animationAdvancedMore'):'');
    return `<button type="button" class="settings-toggle advanced-settings-toggle" data-action="settings-toggle" aria-expanded="${settingsOpen}" aria-controls="animation-settings" aria-label="${esc(t(settingsOpen?'animationAdvancedClose':'animationAdvancedOpen'))}" aria-describedby="animation-advanced-hint"><span class="advanced-settings-icon" aria-hidden="true">${icon('advanced-settings')}</span><span class="advanced-settings-copy"><b id="animation-advanced-title">${esc(t('animationMoreSettings'))}</b><small id="animation-advanced-hint">${esc(hint)}</small></span><span class="advanced-settings-next" aria-hidden="true">${icon('chevron')}</span></button><section id="animation-settings" class="card settings-panel" role="region" aria-labelledby="animation-advanced-title" ${settingsOpen?'':'hidden'}><p class="animation-preview-feedback"><span class="preview-feedback-icon">${icon('animation')}</span><span>Kijk bovenaan: het ledline-voorbeeld beweegt meteen mee.</span></p>${controls.map(spec=>`<div class="animation-setting">${animationSlider(...spec)}${resetMarkup(spec[0],spec[1])}</div>`).join('')}${smoothness}${available.includes('direction') ? `<div class="direction-setting"><p class="direction-setting-label"><span class="setting-label-icon">${icon('back')}</span><span><b>Richting</b><small>Kies welke kant het licht op beweegt.</small></span></p><div class="compact-direction" aria-label="Bewegingsrichting">${(effect.directions||['right','left']).map(value=>`<button data-action="direction" data-value="${value}" aria-pressed="${(s.direction||effect.state.direction)===value}">${esc(directionMap[value]||value)}</button>`).join('')}</div></div>`:''}</section>`;
  }
  function animationSettingValue(key,value,unit='') { return ['delayMs','lineDelayMs'].includes(key)?`${Number((Number(value)/1000).toFixed(3)).toLocaleString('nl-BE',{maximumFractionDigits:3})} s`:Math.round(value)+unit; }
  function animationSlider(key,label,min,max,value,unit='',hint='') {
    return slider(key,label,min,max,value,unit,hint,animationSettingGuides[key]||{icon:'sliders',description:hint||'Pas dit aan en bekijk meteen het voorbeeld.'}).replace(`${Math.round(value)}${unit}</output>`,`${animationSettingValue(key,value,unit)}</output>`);
  }
  function settingDefault(key) { return key==='smooth'?100:activeEffect()?.state[key]??(key==='bri'?100:key==='bgBrightness'?10:['bounce','mirror'].includes(key)?false:undefined); }
  function settingChanged(key) { const fallback=settingDefault(key);return fallback!==undefined&&(selectedState()[key]??fallback)!==fallback; }
  function syncSettingResets() { document.querySelectorAll('[data-action="setting-reset"]').forEach(button=>{button.hidden=!settingChanged(button.dataset.id);}); }
  function syncPresetAvailability() {
    const button=main.querySelector('[data-action="preset-save"]');if(!button)return;
    const mixed=mixedSelection();
    button.disabled=mixed;
    let hint=main.querySelector('[data-preset-save-help]');
    if(!hint){
      hint=document.createElement('p');hint.className='animation-save-help';hint.id='preset-save-help';hint.dataset.presetSaveHelp='';
      hint.textContent='Kies één ledline of geef je selectie dezelfde instellingen om deze animatie te bewaren.';
      button.insertAdjacentElement('afterend',hint);
    }
    hint.hidden=!mixed;
    if(mixed)button.setAttribute('aria-describedby',hint.id);else button.removeAttribute('aria-describedby');
  }
  function animationEditorMarkup(effect) {
    const s = selectedState();
    // Place the change action next to the current animation as well as in
    // the persistent dock, where it stays reachable deep in the settings.
    const galleryAction=standControlOpen?'stand-animation-gallery':route.screen==='controls'?'animation-gallery':'animations-gallery';
    const paletteTitle=effect.whiteMixPreset?'Witmix · tik om aan te passen':effect.category==='brand'?(effect.id==='v30-brand-focus'||effect.id.startsWith('v31-ref-'))?'Merkkleuren · tik om te wijzigen':'Accentkleur · tik om te wijzigen':effect.paletteEditable===false?'Kleurenreeks':'Animatiekleuren · tik om te wijzigen';
    const paletteHelp=effect.whiteMixPreset?'<p class="palette-guidance">W geeft wit licht; rood en een beetje groen maken de mix warmer. Pas de mengkleur aan terwijl je naar je ledline kijkt.</p>':effect.id==='v30-brand-focus'?'<p class="palette-guidance">Voeg kleuren toe voor je merkaccent. De gloed laat ze na elkaar zien langs de ledlines.</p>':'';
    const content = `<div class="current-effect"><div class="current-effect-heading"><small class="active-animation-kicker">${esc(t('animationSettingsReturnKicker'))}</small><b id="active-animation-title" tabindex="-1" role="heading" aria-level="2">${esc(Library.displayName(effect,t))}</b></div><div class="current-effect-gallery-slot" data-editor-gallery-slot><button type="button" class="current-effect-gallery animation-gallery-return animation-chooser-action" data-action="${galleryAction}" aria-label="${esc(t('animationChooseAnother'))}"><span class="gallery-action-label"><span class="gallery-action-icon" aria-hidden="true">${icon('animation')}</span><span class="gallery-action-copy"><b>${esc(t('animationChooseAnother'))}</b><small>${esc(t('animationChooseAnotherHint'))}</small></span></span><span class="gallery-action-next" aria-hidden="true">${icon('chevron')}</span></button></div></div><section class="card palette-section animation-daily-controls"><h2>${effect.whiteMixPreset||effect.paletteEditable===false?paletteTitle:esc(t('animationColours'))}</h2>${paletteHelp}<div class="palette" aria-label="${esc(t('animationColours'))}">${paletteMarkup(s)}</div>${backgroundControls(effect)}${effect.controls.includes('speed')?`${animationSlider('speed',t('animationSpeed'),0,100,s.speed??30,'%')}${resetMarkup('speed',t('animationSpeed'))}`:''}${animationSlider('bri',t('animationBrightness'),0,100,s.bri??100,'%')}${resetMarkup('bri',t('animationBrightness'))}</section>${animationControls(effect)}<button class="button secondary full animation-save-recipe" data-action="preset-save">＋ ${esc(t('animationSaveOwn'))}</button>`;
    return `<section class="active-animation-workspace" aria-label="Animatie aanpassen">${content}</section>`;
  }
  function renderAnimations() {
    const effect=activeEffect();
    if(!effect)return renderEffects();
    return `<div class="editor-grid">${controlContext('animations')}<section class="editor-controls">${ledlineSetupMarkup()}${selector()}${animationEditorMarkup(effect)}</section></div>`;
  }
  function currentBrandPalette(){
    return currentBrandColors().map(color=>C.hex([color.r,color.g,color.b]));
  }
  function currentBrandColors(){
    const saved=savedColours.colors.filter(entry=>entry.group==='brand').map(entry=>({...entry.color}));
    return saved.length?saved:[{r:201,g:78,b:70,w:0,bri:100}];
  }
  function brandSwatch(color){return C.screenHex([color.r,color.g,color.b],color.w);}
  function saveBrandColors(colors){
    const existing=savedColours.colors.filter(entry=>entry.group==='brand');
    const named=colors.map((color,index)=>({name:color.name||existing[index]?.name||t('brandColour',{number:index+1}),color:{r:color.r,g:color.g,b:color.b,w:color.w,bri:color.bri??100}}));
    const result=colourStore.setBrandColors(named);
    if(result.error){
      const status=document.querySelector('#effect-dialog .brand-picker-status');
      if(status)status.textContent=result.error.message;else toast(result.error.message);
      return false;
    }
    savedColours=result;
    observeCentralLibraryStatus(result,document.querySelector('#effect-dialog .brand-picker-status'));
    document.querySelectorAll('.my-colours').forEach(section=>section.outerHTML=myColoursMarkup());
    // Update the gallery beneath the sheet without replacing its scroll or
    // the picker canvas which owns the user's active pointer gesture.
    document.querySelectorAll('.brand-tone-picker').forEach(section=>{
      const open=section.querySelector('details')?.open;
      const wrapper=document.createElement('div');wrapper.innerHTML=brandTonePicker();
      const next=wrapper.firstElementChild;if(open)next.querySelector('details').open=true;
      section.replaceWith(next);
    });
    paint(performance.now()/1000);
    return true;
  }
  function brandEditorChannels(){
    const color=brandEditor?.color||currentBrandColors()[0];
    return [color.r,color.g,color.b,color.w];
  }
  function showBrandEditor(index){
    const colors=currentBrandColors();
    if(!Number.isInteger(index)||index<0||index>colors.length||index>=4)return;
    const color=colors[index]||{r:240,g:185,b:95,w:0,bri:100};
    const entry=savedColours.colors.filter(item=>item.group==='brand')[index];
    brandEditor={index,color:{...color},name:entry?.name||t('brandColour',{number:index+1}),isNew:!entry,memory:{}};
    colourManagerVisible=false;
    showEffectDialog(t('brandEdit',{number:index+1}),colourPickerMarkup('brand'));
    paintWheel();syncColour();
  }
  function brandTonePicker() {
    const palette=currentBrandColors(),selected=currentBrandPalette()[0];
    return `<section class="brand-tone-picker" aria-label="${esc(t('brandColours'))}"><div class="brand-tone-heading"><b>${esc(t('brandColours'))}</b><small>${esc(t('brandPaletteHint'))}</small></div><div class="brand-palette-slots">${palette.map((color,i)=>{const entry=savedColours.colors.filter(item=>item.group==='brand')[i];return `<div class="brand-palette-slot"><button type="button" class="brand-colour-edit" data-action="brand-colour-edit" data-id="${i}" aria-label="${esc(t('brandEdit',{number:i+1}))}" title="${esc(t('brandEdit',{number:i+1}))}"><i class="brand-colour-dot" style="--swatch:${brandSwatch(color)}" aria-hidden="true"></i><span>${esc(entry?.name||t('brandColour',{number:i+1}))}<small>${esc(t('brandEditAction'))}</small></span></button>${palette.length>1?`<button class="brand-colour-remove" type="button" data-action="brand-colour-remove" data-id="${i}" aria-label="${esc(t('brandRemove',{number:i+1}))}" title="${esc(t('brandRemove',{number:i+1}))}">${icon('trash')}</button>`:''}</div>`;}).join('')}${palette.length<4?`<button class="button secondary" data-action="brand-colour-add">＋ ${esc(t('brandAdd'))}</button>`:''}</div><details class="brand-suggestions"><summary>${esc(t('brandIdeas'))}</summary><div class="brand-tone-options" role="group" aria-label="${esc(t('brandIdeas'))}">${BRAND_TONES.map(tone=>`<button class="brand-tone-option" type="button" data-action="brand-tone" data-id="${tone.id}" aria-label="${tone.name}" aria-pressed="${selected.toLowerCase()===tone.value.toLowerCase()}" title="${tone.name}" style="--brand-tone:${tone.value}"><i aria-hidden="true"></i><span>${tone.name}</span></button>`).join('')}</div></details><small class="brand-tone-note">${esc(t('brandApplyHint'))}</small></section>`;
  }
  function tunnelSpatialContext(){
    const editorTunnel=!showControlAnimationGallery&&activeEffect()?.category==='tunnel';
    const familyTunnel=route.screen==='animation-family'&&Library.group(catalogue(),route.family)?.preview.category==='tunnel';
    const galleryTunnel=familyTunnel||libraryTab()==='tunnel'&&(route.screen==='effects'||route.screen==='controls'&&controlMode==='animations'&&showControlAnimationGallery);
    return editorTunnel||galleryTunnel;
  }
  function setSpatialPreviewCategory(value){
    if(!route.zoneId)return;
    // A saved wall arrangement must survive category changes and app reloads.
    // Other arrangements use the tunnel camera for spatial gallery samples.
    if(value==='tunnel')spatialViews.set(route.zoneId,spatialEffectView());
    else spatialViews.delete(route.zoneId);
  }
  function spatialEffectView(z=zone()){
    if(z&&familySpatialSwitch?.zoneId===z.id)return familySpatialSwitch.previousView;
    return z?.layout==='vertical'||spatialViews.get(z?.id)==='wall'?'wall':'tunnel';
  }
  function familySpatialChoice(){
    const z=zone(),view=spatialEffectView(z),busy=Boolean(familySpatialSwitch?.zoneId===z.id||arrangementApplying||managementBusy);
    const error=arrangementDraft?.zoneId===z.id?arrangementDraft.error:'';
    return `<section class="family-spatial-choice" aria-label="${esc(t('lineSetupTitle'))}" aria-busy="${busy}"><div class="family-spatial-options" role="group" aria-label="${esc(t('lineSetupChoose'))}">${['tunnel','wall'].map(mode=>`<button type="button" data-action="family-spatial-layout" data-id="${mode}" aria-pressed="${view===mode}" title="${esc(t('spatialPreviewApplied'))}" ${busy?'disabled':''}><span aria-hidden="true">${arrangementIcon(mode==='wall'?'vertical':'stacked')}</span><b>${esc(t(mode==='wall'?'spatialWall':'spatialTunnel'))}</b><span class="family-spatial-selected" aria-hidden="true">${icon('check')}</span></button>`).join('')}</div><p class="family-spatial-status" role="status" aria-live="polite" ${busy?'':'hidden'}>${busy?esc(t('spatialLayoutSaving')):''}</p><p class="family-spatial-error" role="alert" ${error&&!busy?'':'hidden'}>${esc(error||'')}</p></section>`;
  }
  function spatialMode(layout=zone()?.layout,z=zone()){
    if(z&&spatialViews.has(z.id))return spatialViews.get(z.id);
    if(layout==='vertical')return 'wall';
    if(tunnelSpatialContext())return 'tunnel';
    if(layout==='continuous')return 'normal';
    return 'normal';
  }
  function spatialPreviewText(part,mode=spatialMode()){
    return t(`spatial${mode[0].toUpperCase()}${mode.slice(1)}${part}`);
  }
  function spatialOptionArt(mode,z=zone()){
    const list=receivers(),layout=mode==='wall'?'vertical':mode==='normal'&&z?.type==='SPI'?'continuous':'stacked';
    const shape=mode==='tunnel'?'tunnel':mode==='wall'?'wall':undefined;
    const label=spatialPreviewText('Preview',mode);
    const lineNumbers=Object.fromEntries(list.map((receiver,index)=>[receiver.id,index+1]));
    // Use the production renderer in the chooser too. The former hand-drawn
    // SVGs were unrelated to the large preview: they had a fixed three lines,
    // made up colours and a different tunnel/wall camera. These are the same
    // receiver samples, projected through the exact view the button selects.
    return addPreview(list,layout,'spatial-choice-preview',{
      ...(shape?{spatialShape:shape}:{}),presentation:layout==='continuous'?'combined':'receivers',
      selection:{kind:'all'},selectionFeedback:false,lineNumbers,decorative:true,label
    });
  }
  function spatialPreviewChoice(){
    const z=zone(),view=spatialMode(z.layout,z),open=openSpatialChoices.has(z.id);
    const title=view==='tunnel'?t('spatialTunnel'):view==='wall'?t('spatialWall'):t('lineSetupNormal');
    const topology=z.type==='SPI'?(z.layout==='continuous'?'continuous':'stacked'):null;
    const currentHint=view==='normal'&&z.type==='SPI'?t(topology==='continuous'?'spatialTopologyOne':'spatialTopologySeparate'):'';
    const choices=[
      {mode:'tunnel',layout:'stacked',title:t('spatialTunnel'),hint:t('spatialTunnelHint'),action:'draft-layout'},
      {mode:'wall',layout:'vertical',title:t('spatialWall'),hint:t('spatialWallHint'),action:'draft-layout'},
      {mode:'normal',layout:z.type==='SPI'?'continuous':'stacked',title:t('lineSetupNormal'),hint:z.type==='SPI'?t('spatialNormalSpiHint'):t('spatialNormalHint'),action:z.type==='SPI'?'draft-layout':'spatial-mode'}
    ];
    const selectedChoice=(mode)=>view===mode;
    const choicesMarkup=choices.map(choice=>`<button type="button" class="spatial-choice-option" data-action="${choice.action}" data-id="${choice.action==='spatial-mode'?choice.mode:choice.layout}" data-view="${choice.mode}" aria-pressed="${selectedChoice(choice.mode)}" aria-label="${esc(choice.title)}. ${esc(choice.hint)}" ${arrangementApplying||managementBusy?'disabled':''}><span class="spatial-choice-art">${spatialOptionArt(choice.mode,z)}</span><span class="spatial-choice-copy"><b>${esc(choice.title)}</b><small>${esc(choice.hint)}</small></span><span class="spatial-choice-check" aria-hidden="true">${icon('check')}</span></button>`).join('');
    const topologyMarkup=z.type==='SPI'&&view==='normal'?`<fieldset class="spatial-topology-choice" aria-label="${esc(t('spatialTopologyTitle'))}"><legend>${esc(t('spatialTopologyTitle'))}</legend><button type="button" data-action="spatial-topology" data-id="continuous" aria-pressed="${topology==='continuous'}" ${arrangementApplying||managementBusy?'disabled':''}><span class="spatial-topology-glyph">${arrangementIcon('continuous')}</span><span><b>${esc(t('spatialTopologyOne'))}</b><small>${esc(t('spatialTopologyOneHint'))}</small></span></button><button type="button" data-action="spatial-topology" data-id="stacked" aria-pressed="${topology==='stacked'}" ${arrangementApplying||managementBusy?'disabled':''}><span class="spatial-topology-glyph">${arrangementIcon('stacked')}</span><span><b>${esc(t('spatialTopologySeparate'))}</b><small>${esc(t('spatialTopologySeparateHint'))}</small></span></button></fieldset>`:'';
    const error=arrangementDraft?.zoneId===z.id?arrangementDraft.error:'';
    return `<section class="spatial-preview-choice" aria-label="${esc(t('spatialPreviewTitle'))}" aria-busy="${arrangementApplying}"><button type="button" class="spatial-choice-toggle" data-action="spatial-toggle" aria-expanded="${open}" aria-controls="spatial-choice-options"><span class="spatial-choice-current-icon">${arrangementIcon(view==='normal'?(z.type==='SPI'&&topology==='continuous'?'continuous':z.type==='SPI'?'separate':'normal'):view==='wall'?'vertical':'stacked')}</span><span class="spatial-choice-current"><small>${esc(t('spatialPreviewTitle'))}</small><b>${esc(title)}</b>${currentHint?`<small class="spatial-choice-topology">${esc(currentHint)}</small>`:''}</span>${icon('chevron')}</button><div class="spatial-choice-panel" id="spatial-choice-options" ${open?'':'hidden'}><p class="spatial-choice-help">${esc(t('spatialChoiceHint'))}</p><div class="spatial-choice-options" role="group" aria-label="${esc(t('spatialPreviewTitle'))}">${choicesMarkup}</div>${topologyMarkup}<small class="spatial-preview-only">${esc(t('spatialPreviewApplied'))}</small><p class="arrangement-error" role="alert" ${error?'':'hidden'}>${esc(error)}</p></div></section>`;
  }
  function tunnelPreviewOptions(prefix){
    const view=spatialEffectView();
    return {tunnelPreview:true,spatialLabelPrefix:prefix,...(['tunnel','wall'].includes(view)?{spatialShape:view}:{}),label:`${prefix} · ${spatialPreviewText('Preview',view)}`};
  }
  function categoryLabel(key) {
    if(key==='tunnel')return t('animationAcross');
    return Library.categories.find(category=>category.key===key)?.title||({catalogue:'Alle',presets:'Mijn animaties'})[key]||'Animaties';
  }
  function libraryTabLabel(key) { return t(({catalogue:'animationAll',whole:'animationWhole',pixels:'animationMoving',tunnel:'animationAcross',brand:'animationBrand',presets:'animationOwn'})[key]); }
  function animationFamilyBackLabel(tab=libraryTab()) { return tab==='catalogue'?t('animationFamilyBackAll'):t('animationFamilyBackCategory',{name:libraryTabLabel(tab)}); }
  function initialAnimationLibrary() { return zone()?.type==='SPI'?'pixels':'catalogue'; }
  function libraryTab() {
    if(standControlOpen)return standAnimationTab;
    const value=route.library==='all'?'catalogue':route.library||initialAnimationLibrary();
    return value==='start'?initialAnimationLibrary():value;
  }
  function backgroundDefaults(){return {backgroundOn:false,background:'#000000',backgroundWhite:0,bgBrightness:10,backgroundRgbEnabled:true,backgroundWhiteEnabled:true};}
  function effectState(effect) {
    const state={...backgroundDefaults(),...copy(effect.state),category:effect.category,v30Effect:effect.state.v30Effect||null,previewFamily:effect.state.previewFamily||null,legacySpi:effect.state.legacySpi===true,bounce:effect.state.bounce===true,mirror:effect.state.mirror===true,on:true,power:true};
    if(effect.controls.includes('smooth'))state.smooth=100;
    if(effect.category==='brand'&&!effect.whiteMixPreset){
      const accent=currentBrandPalette()[0];
      state.brandColor=accent;
      if(effect.paletteEditable!==false){
        const chosen=currentBrandColors().slice(0,effect.colorCountRange?.max||4);
        state.colors=chosen.map(color=>C.hex([color.r,color.g,color.b]));state.colorCount=chosen.length;state.whiteChannels=chosen.map(color=>color.w);state.rgbEnabled=chosen.map(()=>true);state.whiteEnabled=chosen.map(color=>color.w>0);
      }
    }
    return state;
  }
  function effectMotionKey(effect) {
    const id=effect.id,variant=Number(effect.state?.variant),engine=String(effect.state?.engine||'').toUpperCase();
    if(effect.category==='tunnel'){
      const named={'v30-tunnel-travel':'waves','v30-tunnel-bounce':'bounce','v30-tunnel-center':'mirror','v30-tunnel-outside':'mirror','v30-tunnel-cascade':'sequence','v30-tunnel-handoff':'flow','v30-tunnel-pulse':'pulse','v30-tunnel-echo':'comet','v30-tunnel-pixel-curtain':'sequence','v30-tunnel-pixel-cross':'cross'};
      if(named[id])return named[id];
      if(variant===93)return 'wave';if(variant===94)return 'chase';if(variant===95)return 'mirror';if(variant===96)return 'alternate';if(variant===97)return 'flow';
      return variant===90||variant===91||variant===92?'sequence':({WAVE:'wave',CHASE:'chase',COMET:'comet',SCANNER:'scanner',MIRROR:'mirror',DUAL:'cross',CASCADE:'sequence',SEQUENCE:'sequence',FLOW:'flow',GRADIENT:'flow',BREATHE:'pulse',SPARKLE:'sparkle',ALTERNATE:'alternate'})[engine]||'flow';
    }
    if(effect.category==='brand'){
      if(id==='v30-brand-warm-white'||engine==='WARM')return 'warm';
      if(id==='v30-brand-white-breathe'||/white|ambient/i.test(effect.name))return 'pulse';
      if(id==='v30-brand-focus'||id==='spi-chase-75'||id==='spi-chase-80')return 'focus';
      if(id==='v30-brand-sweep')return 'scanner';
      if(id==='v30-brand-soft-gradient')return 'flow';
      if(id==='v30-brand-accent')return 'accent';
    }
    return ({FLOW:'flow',GRADIENT:'flow',BREATHE:'pulse',WAVE:'wave',CHASE:'chase',COMET:'comet',SCANNER:'scanner',MIRROR:'mirror',DUAL:'cross',SPARKLE:'sparkle',SEQUENCE:'sequence',CASCADE:'sequence',ALTERNATE:'alternate',MINIMAL:'accent',WARM:'warm'})[engine]||({Kleurverloop:'flow','Ademen':'pulse',Golven:'wave','Lopend licht':'chase',Komeet:'comet',Scanner:'scanner',Spiegel:'mirror',Twinkelen:'sparkle','Stap voor stap':'sequence',Afwisseling:'alternate',Accent:'accent','Warm wit':'warm'})[effect.family]||'flow';
  }
  function effectPreview(effect,{tunnelLines='selection'}={}) {
    if(standControlOpen)return standAnimationPreview(effect,{compact:true});
    const tunnel=effect.category==='tunnel';
    // Together mode and a single selected line use one representative strip.
    // When several ledlines are selected individually, show exactly those
    // physical ledlines separately so the preview matches the chosen target.
    // Tunnel previews show the selected scope in the same camera as the main
    // example. Geometry retains setup order; browsing never selects extra lines.
    // Older stored effects default to very slow cycles (up to ~100 seconds),
    // which makes distinct animations look frozen and alike while browsing.
    // Accelerate only these disposable gallery samples; the selected effect,
    // its settings and the main installation preview keep their real speed.
    const reference=effect.id.startsWith('v31-ref-');
    const previewState={...effectState(effect),speed:reference?effect.state.speed:Math.max(effect.category==='brand'?58:75,Number(effect.state.speed)||0)};
    const separateSelection=selection().kind==='receivers',representativeOnly=!tunnel&&!separateSelection;
    const sampleType=zone().type||'RGBW';
    const physicalLines=tunnel&&tunnelLines==='all'?receivers():selected();
    const list=representativeOnly?[{id:'library-sample-strip',type:sampleType,name:'LED-voorbeeld',
      outputs:sampleType==='SPI'?[{port:1,enabled:true,pixels:32,reversed:false}]:[],state:previewState}]
      :physicalLines.map(r=>({...r,state:previewState}));
    const lineNumbers=Object.fromEntries(receivers().map((receiver,index)=>[receiver.id,index+1]));
    return addPreview(list,representativeOnly?'stacked':zone().layout,tunnel?'tunnel-effect-preview':reference?'reference-preview':'',{label:Library.displayName(effect,t),effectId:effect.id,brand:effect.category==='brand'&&!effect.whiteMixPreset,brandPaletteLimit:effect.paletteEditable===false?0:effect.colorCountRange?.max||4,labels:!representativeOnly,lineNumbers,...(tunnel?{...tunnelPreviewOptions(Library.displayName(effect,t)+' · '+ledlineCount(physicalLineCount(list))),geometryReceivers:receivers()}:{} )});
  }
  function tunnelGalleryPreviewMarkup(group=null,css='tunnel-live-preview',{illustrative=!group,main=true}={}) {
    const connected=receivers(),example=group?.preview||catalogue().find(effect=>effect.category==='tunnel'&&Number(effect.state.variant)===93)||catalogue().find(effect=>effect.category==='tunnel');
    if(!example)return '';
    const state={...effectState(example),speed:Math.max(75,Number(example.state.speed)||0)},sampleType=zone()?.type||'RGBW';
    const base=connected[0]||model.receivers.find(receiver=>receiver.type===sampleType);
    const list=illustrative?Array.from({length:4},(_,index)=>({
      ...(base?copy(base):{}),id:`tunnel-gallery-example-${index+1}`,name:`Ledline ${index+1}`,type:sampleType,order:index,
      outputs:sampleType==='SPI'?[{port:1,enabled:true,pixels:48,reversed:false}]:[],state:copy(state)
    })):connected.map(receiver=>({...receiver,state:copy(state)}));
    const view=spatialEffectView();
    const label=illustrative?`${group?group.title+' · ':''}${t(view==='wall'?'animationWallSampleAccessible':'animationTunnelSampleAccessible')}`:`${spatialPreviewText('Preview',view)} · ${t('animationTunnelGroupAccessible',{name:group.title,count:physicalLineCount(list)})}`;
    const lineNumbers=Object.fromEntries(list.map((receiver,index)=>[receiver.id,index+1]));
    return addPreview(list,view==='wall'?'vertical':'stacked',`${css} tunnel-effect-preview`,{
      main,effectId:example.id,selection:{kind:'all'},selectionFeedback:false,geometryReceivers:list,presentation:'receivers',lineNumbers,
      ...(['tunnel','wall'].includes(view)?{spatialShape:view}:{}),tunnelPreview:true,
      spatialLabelPrefix:label,label,illustrativeTunnel:illustrative
    });
  }
  function tunnelGuide({compact=false}={}) {
    const count=physicalLineCount();
    const status=count<2?t('animationAcrossMinimum'):t('animationAcrossAutoApply');
    const explanation=t('animationAcrossIndividualHint');
    if(compact)return `<section class="tunnel-guide tunnel-guide-compact" aria-label="${esc(t('animationAcross'))}"><strong>${esc(status)}</strong><small>${esc(explanation)}</small></section>`;
    const visual=tunnelGalleryPreviewMarkup(null,'tunnel-live-preview'),sampleTitle=t(spatialEffectView()==='wall'?'animationWallSampleTitle':'animationTunnelSampleTitle');
    return `<section class="tunnel-guide" aria-label="${esc(t('animationAcross'))}"><figure class="tunnel-visual"><figcaption><b>${esc(sampleTitle)}</b><small>${esc(t('animationTunnelSampleLines'))}</small></figcaption>${visual}</figure><div class="tunnel-status"><strong>${esc(status)}</strong><small>${esc(explanation)}</small></div></section>`;
  }
  function presetContext() { return standControlOpen?{type:standControlReceivers().every(receiver=>receiver.type==='SPI')?'SPI':'RGBW',receiverCount:standControlReceivers().length,lineCount:physicalLineCount(standControlReceivers()),selection:{kind:'all'},layout:'stacked'}:{type:zone().type,receiverCount:receivers().length,lineCount:physicalLineCount(),selection:selection(),layout:zone().layout}; }
  function renderPresets() {
    savedPresets=presetStore.load();
    if(savedPresets.error)return `<div class="card"><h2>Mijn animaties konden niet worden gelezen</h2><p>${esc(savedPresets.error.message)} Je bestaande opslag is niet gewijzigd.</p></div>`;
    if(!savedPresets.presets.length)return `<section class="card empty"><span class="menu-icon" aria-hidden="true">${icon('animation')}</span><h2>Mijn animaties</h2><p>Stel een animatie in en kies <b>${esc(t('animationSaveOwn'))}</b>.</p><button class="button" data-action="library" data-id="all">Een animatie kiezen</button></section>`;
    return `<div class="preset-list">${savedPresets.presets.map(preset=>{const restored=S.restore(preset,presetContext(),catalogue());return `<article class="preset-card"><div><b>${esc(preset.name)}</b><small>${esc(categoryLabel(preset.category))} · ${esc(restored.compatible?'Voor je huidige selectie':restored.reason)}</small></div><button class="button" data-action="preset-apply" data-id="${esc(preset.id)}" ${restored.compatible?'':'disabled'}>Toepassen</button><button class="icon-button" data-action="preset-delete" data-id="${esc(preset.id)}" aria-label="${esc(preset.name)} verwijderen">${icon('trash')}</button></article>`;}).join('')}</div>`;
  }
  function effectCards(effects,extraClass='',variantTotal=0) {
    const selectedCount=physicalLineCount(selected());
    const className=`effect-card${extraClass?` ${extraClass}`:''}`;
    return effects.map((effect,index)=>{const needsAll=effect.requireTogether||effect.category==='tunnel',minimum=effect.minimumReceivers||1,tooFew=selectedCount<minimum,locked=needsAll?(standControlOpen?selectedCount:physicalLineCount())<minimum:tooFew;return `<button class="${className}" data-action="effect" data-id="${esc(effect.id)}" data-motion="${effectMotionKey(effect)}" aria-pressed="${activeEffect()?.id===effect.id}" ${locked?'disabled':''}>${effectPreview(effect,needsAll?{tunnelLines:'all'}:{})}<b>${esc(Library.displayName(effect,t))}</b>${variantTotal>1?`<small class="animation-variant-position">${esc(t('animationVariantPosition',{current:index+1,total:variantTotal}))}</small>`:''}<small class="animation-variant-description">${esc(categoryLabel(effect.category))} · ${esc(effect.description)}</small>${locked?`<small>${needsAll?t('animationAcrossMinimum'):t('animationSelectMinimum',{count:minimum})}</small>`:''}</button>`;}).join('');
  }
  function animationFamilyCard(group) {
    const type=standControlOpen?[...new Set(standControlReceivers().map(receiver=>receiver.type))].join(' + '):zone()?.type==='SPI'?'SPI':'RGBW',openLabel=t('animationOpenGroup'),countLabel=t(group.count===1?'animationCountOne':'animationCountMany',{count:group.count}),nextStep=t('animationGroupNextStep');
    const tunnel=group.preview.category==='tunnel';
    const previewLabel=t(tunnel?(spatialEffectView()==='wall'?'animationWallSampleTitle':'animationTunnelSampleTitle'):'animationPreview');
    const preview=standControlOpen?effectPreview(group.preview):tunnel?tunnelGalleryPreviewMarkup(group,'animation-spatial-sample',{illustrative:true,main:false}):effectPreview(group.preview);
    return `<article class="animation-family-card${tunnel?' tunnel-family-card':''}"><button class="animation-family-trigger" data-action="family" data-id="${esc(group.key)}" data-ledline-type="${type}" aria-label="${esc(`${group.title}. ${openLabel}. ${countLabel}. ${nextStep}`)}"><span class="animation-family-preview${tunnel?' animation-family-spatial-preview':''}" data-motion-preview="${effectMotionKey(group.preview)}"><span class="animation-family-preview-label">${esc(previewLabel)}</span>${preview}</span><span class="family-copy">${tunnel?'':`<span class="family-kicker"><span class="animation-type-badge" aria-label="${esc(t('animationBadgeForType',{type}))}">${type}</span></span>`}<b class="family-title">${esc(group.title)}</b><small class="family-summary">${esc(group.summary)}</small><span class="family-variants"><span class="family-variants-copy"><b>${esc(openLabel)}</b></span><span class="family-variants-action"><small aria-label="${esc(countLabel)}">${group.count}</small>${icon('chevron')}</span></span></span></button></article>`;
  }
  function animationFamilyDetail(group,tab,{includePreview=true}={}) {
    const countLabel=t(group.count===1?'animationCountOne':'animationCountMany',{count:group.count});
    const tunnel=group.preview.category==='tunnel',groupHint=tunnel?t('animationTunnelGroupAccessible',{name:group.title,count:physicalLineCount(standControlOpen?standControlReceivers():receivers())}):t('animationGroupPreviewHint');
    const backLabel=animationFamilyBackLabel(tab);
    return `<section class="animation-family-detail" aria-labelledby="animation-family-title"><div class="family-back-slot" data-family-back-slot><button type="button" class="animation-gallery-return family-back-action family-detail-back" data-action="family-back" aria-label="${esc(backLabel)}"><span class="gallery-action-label"><span class="gallery-action-icon" aria-hidden="true">${icon('back')}</span><span class="gallery-action-copy"><b>${esc(backLabel)}</b></span></span></button></div><header class="family-detail-heading"><div><small class="family-detail-step">${esc(t('animationFamilyStep'))}</small><h2 id="animation-family-title" tabindex="-1">${esc(group.title)}</h2><p>${esc(group.summary)}</p></div><span class="family-detail-count">${esc(countLabel)}</span></header>${includePreview?`<figure class="family-detail-preview"><figcaption><b>${esc(t('animationFamilyPreview'))}</b><small>${esc(groupHint)}</small></figcaption>${effectPreview(group.preview,tunnel?{tunnelLines:'all'}:{})}</figure>`:''}<section class="family-variants-panel" aria-labelledby="animation-family-choices"><header class="family-variants-heading"><div><b id="animation-family-choices">${esc(t('animationFamilyChoose'))}</b><small>${esc(t('animationChooseVariant'))}</small></div></header><div class="family-variant-grid">${effectCards(group.effects,'family-variant-card',group.count)}</div>${standControlOpen?`<details class="stand-animation-explanation" data-continuity-id="stand-variant-explanation"><summary>Uitleg bij de varianten</summary>${group.effects.map(effect=>`<p><b>${esc(Library.displayName(effect,t))}</b> · ${esc(effect.description)}</p>`).join('')}</details>`:''}</section></section>`;
  }
  function renderAnimationFamily(){
    const group=Library.group(catalogue(),route.family);
    if(!group){
      const screen=route.familyReturnScreen||'controls';
      route={...route,screen,family:null,familyReturnScreen:null};
      return screen==='effects'?renderEffects():renderControls();
    }
    return `<div class="editor-grid animation-family-screen">${controlPreviewDock('animation-family')}<section class="editor-controls animation-family-controls">${animationFamilyDetail(group,libraryTab(),{includePreview:false})}</section></div>`;
  }
  function animationCategorySection(section) {
    const title=section.key==='tunnel'?t('animationAcross'):section.title,summary=section.key==='tunnel'?t('animationAcrossSummary'):section.summary;
    return `<section class="animation-family-section" aria-labelledby="animation-category-${esc(section.key)}"><header class="animation-family-heading"><div><h2 id="animation-category-${esc(section.key)}">${esc(title)}</h2><p>${esc(summary)}</p></div><small>${section.count} ${section.count===1?'animatie':'animaties'}</small></header><div class="animation-family-grid">${section.groups.map(animationFamilyCard).join('')}</div></section>`;
  }
  function animationCategorySections(items) {
    const sections=[...Library.sections(items)];
    if(zone()?.type==='SPI')sections.sort((left,right)=>(left.key==='pixels'?-1:right.key==='pixels'?1:0));
    return sections.map(animationCategorySection).join('');
  }
  function animationCategoryFamilyList(items,categoryKey) {
    const section=Library.sections(items).find(item=>item.key===categoryKey);
    return section?animationCategorySection(section):'';
  }
  function effectResults(query='') {
    const results=Library.search(catalogue(),query);
    return `<p class="library-result-count" role="status">${results.length} ${results.length===1?'animatie':'animaties'} gevonden in de volledige bibliotheek</p>${results.length?`<div class="effect-grid">${effectCards(results)}</div>`:'<section class="card empty animation-search-empty"><h2>Geen animaties gevonden</h2><p>Probeer een andere naam of bekijk alle effectfamilies.</p><button class="button secondary" data-action="animation-search-clear">Zoekopdracht wissen</button></section>'}`;
  }
  function renderEffects() {
    const currentEffect=activeEffect(),returnToEditor=Boolean(currentEffect)&&route.effectsReturn!=='controls',tab=libraryTab();
    const title=libraryTabLabel(tab);
    const editCurrent=currentEffect&&route.effectsReturn==='controls'?`<button class="button secondary full" data-action="animations">Actieve animatie bewerken · ${esc(Library.displayName(currentEffect,t))}</button>`:'';
    return `<div class="page">${contextTitle(title,`${zone().name} · ${nameOfSelection()}`,returnToEditor?'Terug naar instellingen':'Terug naar bediening',returnToEditor?'animations':'controls')}${ledlineSetupMarkup()}${selector()}${editCurrent}${animationLibraryContent()}</div>`;
  }
  function animationLibraryContent(){
    savedPresets=presetStore.load();
    const items=catalogue(),tab=libraryTab(),family=animationFamilyKey(),active=family?Library.group(items,family):null;
    const query=animationQueryStore().get(animationQueryKey())||'';
    const counts={catalogue:items.length,...Object.fromEntries(Library.sections(items).map(section=>[section.key,section.count])),presets:savedPresets.presets.length};
    const intro=tab==='brand'?brandTonePicker():tab==='tunnel'?(standControlOpen?`<p class="stand-animation-guidance">${esc(standAnimationGuidance())}</p>`:tunnelGuide({compact:route.screen==='controls'&&controlMode==='animations'})):'';
    const inFamily=Boolean(active),results=inFamily?animationFamilyDetail(active,tab):tab==='presets'?renderPresets():query.trim()?effectResults(query):tab==='catalogue'?animationCategorySections(items):animationCategoryFamilyList(items,tab);
    // The tunnel guide already explains its requirements and provides the one
    // relevant action. Keep the gallery free of extra preview disclaimers.
    return `<section class="animation-library-inline" aria-label="${esc(t('animationSelector'))}">${animationLibraryHeading()}${inFamily?'':`<button type="button" id="animation-category" class="animation-category-trigger" data-action="animation-categories" data-category="${esc(tab)}" aria-haspopup="dialog" aria-expanded="false"><span class="animation-category-art">${animationCategoryIcon(tab)}</span><span class="animation-category-copy"><small>${esc(t('animationFilter'))}</small><b>${esc(libraryTabLabel(tab))}</b></span><span class="animation-category-count" aria-label="${esc(t('animationCountMany',{count:counts[tab]||0}))}">${counts[tab]||0}</span>${icon('chevron')}</button>${tab!=='presets'?`<label class="animation-search"><span>${esc(t('animationSearch'))}</span><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></svg><input type="search" id="animation-search" value="${esc(query)}" placeholder="${esc(t('animationSearchHint'))}" autocomplete="off"></label>`:''}${intro}` }<div id="animation-results">${results}</div></section>`;
  }
  function animationLibraryHeading(){
    const current=activeEffect(),canReturn=current&&(standControlOpen||route.screen==='controls');
    const query=(animationQueryStore().get(animationQueryKey())||'').trim(),inFamily=Boolean(animationFamilyKey()),groupsVisible=!query&&!inFamily&&libraryTab()!=='presets';
    const heading=groupsVisible?t('animationGroupChooserTitle'):t('chooseAnimation');
    const guidance=groupsVisible?t('animationGroupChooserIntro'):query||inFamily?t('animationSearchChooseHint'):t('animationOwnChooseHint');
    return `<header class="animation-library-heading"><div class="animation-library-title-copy"><small class="animation-library-kicker"><span aria-hidden="true">${icon('animation')}</span>${esc(t('animationSelector'))}</small><h2 id="animation-selector-heading">${esc(heading)}</h2><p class="animation-library-guidance">${esc(guidance)}</p></div></header>${canReturn?`<div class="animation-settings-return-slot" data-editor-return-slot>${animationSettingsReturnMarkup('inline')}</div>`:''}`;
  }
  function animationSettingsReturnMarkup(location){
    const current=activeEffect();
    if(!current||!standControlOpen&&route.screen!=='controls')return '';
    const name=Library.displayName(current,t),label=t('animationCurrentSettingsTitle');
    const attribute=location==='sticky'?'data-editor-return-sticky':'data-editor-return-inline';
    return `<button type="button" class="animation-gallery-return animation-settings-return" ${attribute} data-action="animation-current-edit" aria-label="${esc(t('animationCurrentSettingsAccessible',{name}))}"><span class="gallery-action-label"><span class="gallery-action-icon" aria-hidden="true">${icon('advanced-settings')}</span><span class="gallery-action-copy"><small class="animation-settings-return-kicker">${esc(t('animationSettingsReturnKicker'))}</small><b class="animation-settings-return-name">${esc(name)}</b><small class="animation-settings-return-action">${esc(label)}</small></span></span><span class="gallery-action-next" aria-hidden="true">${icon('chevron')}</span></button>`;
  }
  function animationCategoryIcon(key){
    return key==='tunnel'?arrangementIcon('stacked'):icon(({catalogue:'zones',whole:'sun',pixels:'animation',brand:'sparkle',presets:'scenes'})[key]||'zones');
  }
  function showAnimationCategories(){
    const tab=libraryTab(),keys=['catalogue','whole',...((standControlOpen?catalogue().some(effect=>effect.category==='pixels'):zone().type==='SPI')?['pixels']:[]),'tunnel','brand','presets'];
    savedPresets=presetStore.load();
    const items=catalogue(),counts={catalogue:items.length,...Object.fromEntries(Library.sections(items).map(section=>[section.key,section.count])),presets:savedPresets.presets.length};
    const titleKey={catalogue:'animationAllHint',whole:'animationWholeHint',pixels:'animationMovingHint',tunnel:'animationAcrossHint',brand:'animationBrandHint',presets:'animationOwnHint'};
    showEffectDialog(t('animationFilter'),`<div class="animation-category-options" data-animation-categories>${keys.map(key=>`<button type="button" class="animation-category-choice" data-action="animation-category-choice" data-id="${key}" aria-pressed="${tab===key}"><span class="animation-category-art">${animationCategoryIcon(key)}</span><span class="animation-category-copy"><b>${esc(libraryTabLabel(key))}</b><small>${esc(t(titleKey[key]))}</small></span><span class="animation-category-meta"><span>${counts[key]||0}</span>${tab===key?icon('check'):icon('chevron')}</span></button>`).join('')}</div>`);
    // Touch Safari does not focus the invoking button automatically.
    // Restore this exact control on dismiss, not a stale gallery/back button.
    const categoryOpener=(standControlOpen?document.getElementById('effect-dialog-content'):main).querySelector('[data-action="animation-categories"]');
    if(!standControlOpen)dialogReturnFocus=categoryOpener;
    categoryOpener?.setAttribute('aria-expanded','true');
    document.querySelector('#effect-dialog [data-action="effect-dialog-close"]')?.setAttribute('aria-label',t('close'));
    const selectedChoice=document.querySelector(`#effect-dialog [data-action="animation-category-choice"][data-id="${tab}"]`);
    selectedChoice?.focus({preventScroll:true});
    selectedChoice?.scrollIntoView({block:'nearest',behavior:'instant'});
  }
  function spiLayoutPreview(layout) {
    // These small teaching examples are separate from the installation. They
    // must move even when the real lights are static/off, without replacing
    // the main preview, writing a state or sending an animation to a receiver.
    const continuous=layout==='continuous';
    const effect=P.catalog('SPI').find(item=>item.id===(continuous?'spi-chase-8':'v30-tunnel-handoff'));
    const state={...copy(effect.state),colors:['#F4D5B3'],colorCount:1,whiteChannels:[0],
      rgbEnabled:[true],whiteEnabled:[false],on:true,power:true,bri:100,brightness:100,
      speed:continuous?48:65,smooth:100,fadeAmount:100,widthPixels:9,objectCount:1,
      backgroundOn:true,background:'#7D5640',backgroundWhite:0,bgBrightness:16,delayMs:0};
    const list=Array.from({length:3},(_,index)=>({id:`layout-example-${index+1}`,type:'SPI',
      outputs:[{port:1,enabled:true,pixels:24,reversed:false}],state:copy(state)}));
    const label=continuous?'Licht loopt door over één aaneengesloten pixelrij':layout==='vertical'
      ?'Licht gaat van de linker naar de rechter staande LED-line':'Licht gaat van de bovenste naar de onderste LED-line';
    return `<span class="layout-demo" data-layout-demo="${layout}" aria-hidden="true">${addPreview(list,layout,'layout-demo-preview',{labels:false,label})}</span>`;
  }
  const arrangementModes={stacked:['Tunnel','tunnel'],vertical:['Wall','wall'],continuous:['Continuous','light']};
  function arrangementModeKey(layout,z=zone()){
    if(layout==='continuous')return 'Continuous';
    const mode=spatialMode(layout,z);
    return mode==='wall'?'Wall':mode==='normal'?'Normal':'Tunnel';
  }
  function arrangementSignature(z=zone()) {return JSON.stringify([z.id,z.name,z.type,z.receiverIds,z.layout,M.lineIds(model,z.id)]);}
  function arrangementDirty(){return Boolean(arrangementDraft&&JSON.stringify([arrangementDraft.layout,arrangementDraft.lineOrder])!==arrangementDraft.initial);}
  function arrangementPlaybackPending(){return arrangementReapplyIds.some(id=>['pending','staged'].includes(liveStates.get(id)?.kind));}
  function arrangementInteractionBusy(){return arrangementApplying||managementBusy||arrangementPlaybackPending();}
  function arrangementNeedsStandOpen(){
    return simpleStandMode&&(!centralApplied||standConnectionState.status!=='connected'||!standSession?.snapshot());
  }
  function syncArrangementControls(){
    if(!main)return;
    const busy=arrangementInteractionBusy(),needsStandOpen=arrangementNeedsStandOpen(),handles=[...main.querySelectorAll('[data-order-handle]')];
    for(const handle of handles)handle.disabled=busy||needsStandOpen||handles.length<2;
    main.querySelector('.ledline-arrangement')?.setAttribute('aria-busy',String(busy));
    const status=main.querySelector('[data-order-apply-status]');
    if(status){
      const pending=arrangementApplying||arrangementPlaybackPending(),error=arrangementDraft?.error||'';
      status.hidden=!(pending||error||needsStandOpen);status.textContent=pending?'Volgorde toepassen op de verlichting…':error||(needsStandOpen?'Open je stand om de volgorde te wijzigen.':'');
    }
    const openStand=main.querySelector('[data-order-stand-open]');
    if(openStand)openStand.hidden=busy||!(needsStandOpen||arrangementDraft?.needsStandOpen&&arrangementDraft.error);
  }
  // Preview receiver order while its atomic metadata update is in flight.
  // Only a confirmed update changes saved geometry or resends receiver state.
  function previewArrangement(z){
    return z&&openLineSetup.has(z.id)&&arrangementDraft?.zoneId===z.id&&
      arrangementDraft.signature===arrangementSignature(z)?arrangementDraft:null;
  }
  function beginArrangement(){
    const z=zone();if(!z)return;
    const lineOrder=M.lineIds(model,z.id);
    arrangementDraft={zoneId:z.id,layout:z.layout,lineOrder,signature:arrangementSignature(z),initial:JSON.stringify([z.layout,lineOrder]),error:'',needsStandOpen:false};
  }
  async function applyArrangement(){
    const draft=arrangementDraft;if(!draft||arrangementInteractionBusy()||(!arrangementDirty()&&!draft.error))return false;
    if(arrangementNeedsStandOpen()){beginArrangement();syncArrangementControls();return false;}
    const zoneId=draft.zoneId;
    const browsing=arrangementBrowsing();
    if(zoneId!==route.zoneId||draft.signature!==arrangementSignature()){
      beginArrangement();arrangementDraft.error=t('lineSetupChanged');renderArrangement();return false;
    }
    arrangementApplying=true;draft.needsStandOpen=false;
    syncArrangementControls();
    let failure='',succeeded=false;
    try{
      const identification=orderIdentificationState?.active&&orderIdentificationState.zoneId===zoneId?orderIdentificationState.session:null;
      if(identification){
        const ready=await orderIdentification.settle();
        if(!ready.active||ready.session!==identification||nativeContext&&!ready.physicalConfirmed)throw Error('Herkenning niet bevestigd. Open de volgorde opnieuw en controleer de verbinding.');
      }
      // The radio wait does not grant permission to save an obsolete draft.
      if(zoneId!==route.zoneId||draft.signature!==arrangementSignature())throw Error(t('lineSetupChanged'));
      const next=M.arrangeLines(model,zoneId,{layout:draft.layout,lineOrder:draft.lineOrder});
      draft.error='';renderArrangement({...browsing,focus:null});
      const saved=await persistManagement(next,{kind:'arrangeLines',zoneId,layout:draft.layout,lineOrder:[...draft.lineOrder]},draft.signature);
      if(saved){
        model=saved;
        succeeded=true;
        let canResume=!identification;
        if(identification&&orderIdentificationState?.active&&orderIdentificationState.session===identification){
          const ready=await orderIdentification.reorder(M.lineIds(model,zoneId));
          canResume=ready.active&&ready.session===identification&&ready.physicalConfirmed;
        }
        if(continuousZone())selections.set(zoneId,{kind:'all'});
        if(nativeContext&&canResume){
          // Keep the order interaction locked until the original queue has
          // actually settled. A saved CAS alone is not a lighting receipt.
          arrangementReapplyIds=sendReceiverStates(M.zoneReceivers(model,zoneId).map(r=>r.id),{remember:false});
          syncArrangementControls();
          if(!liveController?.whenIdle)throw Error('Volgorde bewaard. Het hervatten van de verlichting is nog niet bevestigd.');
          try{await liveController.whenIdle({standId:model.receivers.find(r=>arrangementReapplyIds.includes(r.id))?.standId});}
          catch(_){throw Error('Volgorde bewaard. Het hervatten van de verlichting is nog niet bevestigd. Controleer de verbinding.');}
          if(!arrangementReapplyIds.length||arrangementReapplyIds.some(id=>liveStates.get(id)?.kind!=='applied'))
            failure='Volgorde bewaard. Niet alle receivers hebben het hervatten van de verlichting bevestigd. Controleer de verbinding.';
        }
        else if(nativeContext)failure='Volgorde bewaard. De hervatting is nog niet bevestigd; open de volgorde opnieuw en controleer de verbinding.';
      }else failure=draft.error||t('lineSetupSaveFailed');
    }catch(error){failure=error.message||t('lineSetupSaveFailed');}
    finally{
      arrangementApplying=false;
      // A bounded idle wait may expire before the native operation returns.
      // Its genuine pending states keep only the order interaction disabled;
      // never renew the lease or replay the unknown effect automatically.
      if(!arrangementPlaybackPending())arrangementReapplyIds=[];
      // Failed or uncertain requests show the last authoritative model, not
      // an unconfirmed selection. Tapping a choice again is a fresh retry.
      if(arrangementDraft===draft){
        if(zone()&&route.zoneId===zoneId&&openLineSetup.has(zoneId)){beginArrangement();arrangementDraft.error=failure;arrangementDraft.needsStandOpen=Boolean(failure&&draft.needsStandOpen);}
        else arrangementDraft=null;
      }
      renderArrangement(browsing);
    }
    return succeeded;
  }
  async function chooseSpatialLayout(view,layout,{keepOpen=false}={}){
    const z=zone();if(!z)return false;
    const previousView=spatialMode(z.layout,z),browsing=arrangementBrowsing();
    if(keepOpen)openSpatialChoices.add(z.id);else openSpatialChoices.delete(z.id);
    spatialViews.set(z.id,view);
    if(layout===z.layout){renderArrangement(browsing);return true;}
    if(!arrangementDraft||arrangementDraft.zoneId!==z.id||arrangementDraft.signature!==arrangementSignature(z))beginArrangement();
    arrangementDraft.layout=layout;
    const saved=await applyArrangement();
    if(!saved){spatialViews.set(z.id,previousView);openSpatialChoices.add(z.id);renderArrangement(browsing);}
    return saved;
  }
  async function chooseFamilySpatialLayout(view){
    const z=zone(),group=route.screen==='animation-family'&&Library.group(catalogue(),route.family);
    if(!z||group?.preview?.category!=='tunnel'||!['tunnel','wall'].includes(view)||familySpatialSwitch)return false;
    const previousView=spatialEffectView(z);
    if(view===previousView)return true;
    const previousLayout=z.layout,layout=view==='wall'?'vertical':'stacked',browsing={...arrangementBrowsing(),focus:{action:'family-spatial-layout',id:view,receiver:'',delta:''}};
    // A previous uncertain edit can leave only the local camera stale.
    // The stored layout already matches: repair the view without replaying it.
    if(layout===previousLayout){
      spatialViews.set(z.id,view);beginArrangement();renderArrangement(browsing);return true;
    }
    // Keep every group example on the confirmed camera while the atomic
    // layout edit is pending. Choosing a camera never applies group.preview.
    familySpatialSwitch={zoneId:z.id,previousView};
    beginArrangement();arrangementDraft.layout=layout;
    let saved=false;
    try{saved=await applyArrangement();}
    finally{
      familySpatialSwitch=null;
      const current=zone();
      if(current?.id===z.id){
        // An uncertain ACK may still return a reconciled, committed model.
        // Follow that authoritative layout, not a stale previous RAM camera.
        spatialViews.set(z.id,saved||current.layout!==previousLayout?(current.layout==='vertical'?'wall':'tunnel'):previousView);
        if(route.screen==='animation-family'&&route.family===browsing.route.family)renderArrangement(browsing);
      }
    }
    return saved;
  }
  function arrangementBrowsing(){const active=document.activeElement;return {route:{...route},controlMode,showGallery:showControlAnimationGallery,query:main.querySelector('#animation-search')?.value||'',scroll:window.scrollY,focus:active?.dataset?.action?{action:active.dataset.action,id:active.dataset.id||'',receiver:active.dataset.receiver||'',delta:active.dataset.delta||''}:null};}
  function restoreArrangementBrowsing(context){
    const search=main.querySelector('#animation-search');
    if(search&&context.query){search.value=context.query;const results=main.querySelector('#animation-results');if(results)results.innerHTML=effectResults(context.query);paint(performance.now()/1000);}
    window.scrollTo({top:context.scroll,left:0,behavior:'instant'});updateControlPreviewDensity();
    if(context.focus){const target=[...main.querySelectorAll('[data-action]')].find(element=>element.dataset.action===context.focus.action&&(element.dataset.id||'')===context.focus.id&&(element.dataset.receiver||'')===context.focus.receiver&&(element.dataset.delta||'')===context.focus.delta);const closedSpatialOption=target?.closest('.spatial-choice-panel[hidden]');(closedSpatialOption?closedSpatialOption.parentElement?.querySelector('.spatial-choice-toggle'):target)?.focus({preventScroll:true});}
  }
  function renderArrangement(context=arrangementBrowsing()){render();restoreArrangementBrowsing(context);}
  function revealLineSetup(){
    const target=main.querySelector('.ledline-setup-toggle');if(!target)return;
    revealBelowControlPreview(target,12);target.focus({preventScroll:true});
  }
  function receiverPortOverview(receiver,list){
    if(receiver.type!=='SPI')return '';
    const lines=M.ledlines(list).filter(line=>line.receiverId===receiver.id);
    if(!lines.length)return '';
    return `<div class="ledline-output-overview" data-output-count="${lines.length}" role="list" aria-label="${esc(t('lineActivePorts'))}">${lines.map(line=>{
      const number=line.lineIndex+1,side=t(line.reversed?'lineStartRight':'lineStartLeft');
      const label=t('linePortInfo',{number,port:line.port,pixels:line.pixels,side});
      const colour=orderColours.get(line.id);
      return `<div class="ledline-output" role="listitem" data-ledline-output data-receiver="${esc(receiver.id)}" data-port="${line.port}" data-line-id="${esc(line.id)}" data-line-number="${number}" data-pixels="${line.pixels}" data-start-side="${line.reversed?'right':'left'}" style="--identify-colour:${colour?.hex||'transparent'}" aria-label="${esc(label)}${colour?' · '+esc(colour.name):''}"><div class="ledline-output-heading"><b>P${line.port}</b><small>L${number}</small></div><span class="ledline-output-strip" aria-hidden="true"><i></i></span><span class="ledline-output-pixels">${line.pixels} px</span><small class="ledline-output-side">${esc(side)}</small>${colour?`<span class="line-colour-name">${esc(colour.name)}</span>`:''}</div>`;
    }).join('')}</div>`;
  }
  function ledlineSetupMarkup(){
    const z=zone(),open=openLineSetup.has(z.id);
    if(open&&(!arrangementDraft||arrangementDraft.zoneId!==z.id||(!arrangementApplying&&arrangementDraft.signature!==arrangementSignature(z))))beginArrangement();
    const draft=open?arrangementDraft:null,needsStandOpen=arrangementNeedsStandOpen();
    const count=physicalLineCount(),singleLine=count===1,title=t(singleLine?'lineSetupSingle':'lineSetupOrient'),hint=t(singleLine?'lineSetupSingleHint':'lineSetupOrientHint');
    const summary=t('lineSetup'+arrangementModeKey(z.layout,z))+' · '+t(count===1?'scopeCountOne':'scopeCountMany',{count});
    const lineCount=t(count===1?'scopeCountOne':'scopeCountMany',{count});
    const context=t('lineSetupOpenContext',{zone:z.name,count:lineCount});
    const toggleLabel=open?t('lineSetupCloseAccessible',{title,zone:z.name}):`${title} · ${summary}`;
    const horizontalOrder=['vertical','continuous'].includes(z.layout);
    const family=z.type||receivers()[0]?.type,reusable=standReceivers().some(r=>r.zoneId!==z.id&&r.type===family);
    const ordered=open?M.ledlines(receivers(),draft.lineOrder):[];
    const rows=ordered.map((line,index)=>{
      const r=model.receivers.find(item=>item.id===line.receiverId),name=`Ledline ${index+1}`;
      const blinking=identifying.get(r.id)?.scope===(line.port?String(line.port):'all'),settingsOpen=openLineSettings.has(line.id),settingsId='ledline-settings-'+line.id,headingId=settingsId+'-heading';
      const colour=orderColours.get(line.id);
      return `<li data-draft-receiver="${esc(r.id)}" data-order-item="${esc(line.id)}" data-settings-open="${settingsOpen}">
        <span class="order-number" aria-label="Plaats ${index+1}" style="--identify-colour:${colour?.hex||'transparent'}">${index+1}</span>
        <span class="scope-copy"><span class="scope-option-title">${esc(name)}</span><small>${esc(r.name)} · ${line.port?`P${line.port} · ${line.pixels} px`:'RGBW'}<span data-order-colour-name>${colour?' · '+esc(colour.name):''}</span></small></span>
        <button type="button" class="line-order-handle" data-order-handle aria-label="${esc(name)} · ${esc(r.name)}${line.port?' · P'+line.port:''} verslepen" title="Sleep naar de juiste plaats" aria-describedby="ledline-order-help" ${ordered.length<2||arrangementInteractionBusy()||needsStandOpen?'disabled':''}><span aria-hidden="true">⠿</span></button>
        ${line.port?`<div class="ledline-output-overview" data-output-count="1"><div class="ledline-output" data-line-id="${esc(line.id)}" data-port="${line.port}" data-line-number="${index+1}" data-pixels="${line.pixels}" style="--identify-colour:${colour?.hex||'transparent'}"><span class="ledline-output-strip" aria-hidden="true"><i></i></span><small class="ledline-output-side">${esc(t(line.reversed?'lineStartRight':'lineStartLeft'))}</small></div></div>`:''}
        <div class="ledline-order-tools"><div class="ledline-row-actions">
          <button class="receiver-blink order-blink-subtle" data-action="${line.port?'port-identify':'visual-identify'}" data-receiver="${esc(r.id)}" data-port="${line.port}" aria-pressed="${blinking}" aria-label="${esc(name)} · ${esc(t(blinking?'lineSetupBlinkStopAccessible':'lineSetupBlinkAccessible'))}">${icon('sun')}<span>${esc(t(blinking?'lineSetupBlinkStop':'lineSetupBlink'))}</span></button>
          <button class="ledline-settings-toggle" data-action="layout-receiver-settings" data-id="${esc(line.id)}" data-receiver="${esc(r.id)}" data-port="${line.port}" aria-label="${esc(t('lineSetupSettingsAccessible',{name}))}" aria-expanded="${settingsOpen}" aria-controls="${esc(settingsId)}">${icon('sliders')}<span>${esc(t('lineSetupSettings'))}</span>${icon('chevron')}</button>
        </div></div>
        <div class="ledline-row-settings" id="${esc(settingsId)}" role="region" aria-labelledby="${esc(headingId)}" ${settingsOpen?'':'hidden'}>${settingsOpen?`<h4 id="${esc(headingId)}" tabindex="-1">${esc(t('lineSetupSettings'))} · ${esc(name)}</h4><p class="ledline-settings-context">${esc(r.name)}${line.port?' · P'+line.port:''} · ${esc(z.name)}</p><div class="receiver-details">${receiverDetailMarkup(r)}</div>`:''}</div>
      </li>`;
    }).join('');
    return `<section class="ledline-setup card" data-order-open="${open}" aria-label="${esc(t('lineSetupTitle'))}">${spatialPreviewChoice()}<button class="ledline-setup-toggle" data-action="layout" aria-label="${esc(toggleLabel)}" aria-expanded="${open}" aria-controls="ledline-setup-body">${lineOrderIcon()}<span class="ledline-setup-copy">${open?`<span class="ledline-menu-label">${esc(t('lineSetupMenu'))}</span>`:''}<b>${esc(title)}</b><small id="ledline-setup-context">${esc(open?context:hint)}</small></span><span class="ledline-setup-disclosure-action">${open?`<span class="ledline-setup-close-label">${esc(t('close'))}</span>`:''}${icon('chevron')}</span></button><div class="ledline-setup-body" id="ledline-setup-body" role="region" ${open?'aria-labelledby="ledline-setup-heading" aria-describedby="ledline-setup-context"':'hidden'}>${open?`
      ${layoutReceiverActions()}
      <section class="ledline-arrangement" aria-label="${esc(singleLine?title:t('lineSetupOrder'))}" aria-busy="${arrangementInteractionBusy()}"><div class="ledline-order-heading"><h3 id="ledline-setup-heading">${esc(singleLine?t('scopeCountOne'):t('lineSetupCurrentOrder'))}</h3><small class="ledline-family-label">${esc(family||'')}</small></div><p class="ledline-setup-hint" id="ledline-order-help">${esc(singleLine?hint:t('lineSetupOrderHint'))}</p><p class="order-recognition-status" data-order-recognition-status role="status"></p><p class="order-drop-status" role="status" aria-live="polite"></p><p data-order-apply-status role="status" ${arrangementApplying||arrangementPlaybackPending()||draft?.error||needsStandOpen?'':'hidden'}>${arrangementApplying||arrangementPlaybackPending()?'Volgorde toepassen op de verlichting…':esc(draft?.error||(needsStandOpen?'Open je stand om de volgorde te wijzigen.':''))}</p><button type="button" class="button secondary full" data-order-stand-open data-action="management-stand-open" ${!arrangementInteractionBusy()&&(needsStandOpen||draft?.needsStandOpen&&draft.error)?'':'hidden'}>Stand openen</button>
      <ol class="ledline-draft-order">${rows}</ol>
      </section>${reusable?`<button class="ledline-reuse-action" data-action="zone-assign" data-id="${esc(z.id)}">${icon('receiver')}<span>${esc(t('lineSetupReuse'))}</span>${icon('chevron')}</button>`:''}`:''}</div></section>`;
  }
  function layoutReceiverActions() {
    const z=zone();
    return `<section class="layout-receiver-actions" aria-label="${esc(t('lineSetupAddContext',{zone:z.name}))}"><button class="ledline-add-action" data-action="layout-receiver-add" data-zone="${esc(z.id)}"><span class="ledline-add-icon" aria-hidden="true">＋</span><span class="ledline-add-copy"><b>${esc(t('addReceiver'))}</b><small>${esc(t('lineSetupAddContext',{zone:z.name}))}</small></span>${icon('chevron')}</button></section>`;
  }
  function receiverOrderMarkup() {
    const list=receivers();
    return `<p class="order-help">Laat een ledline knipperen om haar te herkennen. Sleep aan de stippen om de volgorde te wijzigen. Open een ledline voor de instellingen.</p><div class="receiver-list receiver-order combined-receiver-order" aria-label="Volgorde van ledlines">${list.map((r,i)=>receiverCard(r,i)).join('')}</div><p class="order-status" role="status" aria-live="polite"></p>`;
  }
  function selectedVisualPort(receiver) {
    return visualPorts.get(receiver.id)||receiver.outputs.find(output=>output.enabled)?.port||1;
  }
  function productVisual(receiver,compact=false) {
    return `<div class="receiver-product ${compact?'compact list-product':''}"><canvas data-product-receiver="${esc(receiver.id)}" data-compact="${compact}" width="400" height="240" role="img" aria-label="${receiver.type==='RGBW'?'RGBW: één uitgang met vier kleurkanalen':'SPI: schematische receiver met vier uitgangen'}"></canvas>${compact?'':`<p class="receiver-product-caption"><strong>${receiver.type==='RGBW'?'Eén RGBW-uitgang · vier kanalen':`Uitgang ${selectedVisualPort(receiver)} geselecteerd`}</strong>${receiver.type==='RGBW'?'Rood, groen, blauw en wit sturen samen één ledline aan.':'Kies de uitgang die je wilt instellen.'}</p>`}</div>`;
  }
  function receiverCard(r,orderIndex=null) {
    const z=M.getZone(model,r.zoneId),rid=esc(r.id);
    const wholeBlink=identifying.get(r.id)?.scope==='all';
    const ordered=route.screen==='layout'&&Number.isInteger(orderIndex);
    return `<details class="receiver-overview-card" data-receiver-detail="${rid}" ${ordered?`data-order-receiver="${rid}"`:''} ${expandedReceivers.has(r.id)?'open':''}><summary>${ordered?`<button class="order-handle" aria-label="${esc(r.name)} verslepen" title="Sleep om te verplaatsen">⠿</button><span class="order-number">${orderIndex+1}</span>`:productVisual(r,true)}<div class="receiver-heading-copy"><b>${esc(r.name)}</b><small class="receiver-heading-meta"><span class="receiver-family-badge">${r.type}</span> · ${esc(z?.name||'Nog geen zone')}</small>${r.type==='SPI'?`<small class="receiver-geometry-summary">${ordered?'':`${r.outputs.filter(o=>o.enabled).length} ${r.outputs.filter(o=>o.enabled).length===1?'uitgang':'uitgangen'} · `}${r.outputs.filter(o=>o.enabled).reduce((n,o)=>n+o.pixels,0)} ${r.outputs.filter(o=>o.enabled).reduce((n,o)=>n+o.pixels,0)===1?'pixel':'pixels'}</small>`:ordered?'':'<small class="receiver-geometry-summary">Eén uitgang · R · G · B · W</small>'}</div><button type="button" class="receiver-blink ${ordered?'order-identify':''}" data-action="visual-identify" data-receiver="${rid}" aria-pressed="${wholeBlink}" aria-label="${esc(r.name)} · ${r.type==='SPI'?'alle actieve uitgangen samen':'hele receiver'} ${wholeBlink?'stoppen met knipperen':'laten knipperen'}">${icon('sun')}<span>${wholeBlink?'Stop':'Knipperen'}</span></button>${icon('chevron')}</summary><div class="receiver-details">${receiverDetailMarkup(r)}</div></details>`;
  }
  function receiverDetailMarkup(r) {
    const z=M.getZone(model,r.zoneId),rid=esc(r.id),port=selectedVisualPort(r);
    return `${receiverAssignmentActions(r)}${r.type==='SPI'?`<details class="receiver-connections" data-receiver-connections="${rid}" ${expandedConnections.has(r.id)?'open':''}><summary><span><b>Aansluitingen</b><small>${r.outputs.filter(o=>o.enabled).length} van 4 uitgangen · ${r.outputs.filter(o=>o.enabled).reduce((n,o)=>n+o.pixels,0)} ${r.outputs.filter(o=>o.enabled).reduce((n,o)=>n+o.pixels,0)===1?'pixel':'pixels'}</small></span>${icon('chevron')}</summary><div class="receiver-connections-content">${productVisual(r)}<div class="receiver-ports-heading"><h3>Uitgangen</h3><small>Alle ingeschakelde uitgangen lichten op in het voorbeeld.</small></div><div class="receiver-port-list" aria-label="Uitgang bekijken">${r.outputs.map(o=>`<div class="receiver-port-row ${o.port===port?'port-focused':''}" data-port-row="${o.port}"><button type="button" class="receiver-port-select" data-action="visual-port" data-receiver="${rid}" data-id="${o.port}" aria-pressed="${o.port===port}"><b>P${o.port}</b><span>Uitgang ${o.port}</span></button><button type="button" class="switch receiver-port-switch" role="switch" data-action="receiver-port-enabled" data-receiver="${rid}" data-port="${o.port}" aria-checked="${o.enabled}" aria-label="Uitgang ${o.port} gebruiken" ${nativeContext&&typeof runtime?.services?.configureOutputs!=='function'?'disabled title="Verbind met je installatie-wifi om uitgangen te wijzigen"':''}><span>${o.enabled?'Aan':'Uit'}</span><i aria-hidden="true"></i></button><button type="button" class="receiver-blink" data-action="port-identify" data-receiver="${rid}" data-port="${o.port}" aria-pressed="${identifying.get(r.id)?.scope===String(o.port)}" aria-label="${esc(r.name)} uitgang ${o.port} laten knipperen" ${o.enabled?'':'disabled'}>${icon('sun')}<span>${identifying.get(r.id)?.scope===String(o.port)?'Stop':'Knipperen'}</span></button></div>`).join('')}</div><button class="button full pixel-setup-shortcut" data-action="receiver-pixel-setup" data-id="${rid}">${icon('sliders')}Pixels / aansluiting instellen ${icon('chevron')}</button><p class="port-preview-note">Stel per poort de pixels in en kies waar de stroom binnenkomt.</p></div></details>`:productVisual(r)}${z&&route.screen==='receivers'?`<button class="text-button" data-action="zone" data-id="${esc(z.id)}">Bedien ${esc(z.name)} →</button>`:''}<details class="receiver-manage-menu"><summary>Meer receiveropties ${icon('chevron')}</summary><div class="receiver-manage-content"><button class="text-button" data-action="receiver-rename" data-id="${rid}">Naam wijzigen</button></div></details>`;
  }
  function receiverAssignmentActions(r) {
    return `<div class="receiver-management"><button class="button secondary" data-action="receiver-move" data-id="${esc(r.id)}">${icon('zones')}Zone wijzigen</button><small>Je koppeling en aansluitingen blijven bewaard.</small></div>`;
  }
  function renderReceivers() {
    const all=standReceivers(),unassigned=all.filter(r=>!r.zoneId);
    const shown=receiverFilter==='unassigned'?unassigned:all,cards=shown.map(r=>receiverCard(r)).join('');
    const canUpdate=nativeContext&&runtime?.native===true&&typeof runtime.services?.otaPlan==='function'&&all.length>0;
    const updateEntry=canUpdate?`<button class="button secondary receiver-update-entry" data-action="receiver-update-all" aria-label="${esc(t('softwareUpdateButton'))}">${icon('update')}<span>${esc(t('softwareUpdates'))}</span></button>`:'';
    return `<div class="page receivers-page"><header class="page-heading overview-heading"><div><div class="eyebrow">${esc(standLabel())}</div><h1>Receivers</h1><p>Kies een receiver voor zone of aansluitingen.</p>${all.length?`<div class="receiver-overview-summary">${['RGBW','SPI'].filter(type=>all.some(receiver=>receiver.type===type)).map(type=>`<span><b>${all.filter(receiver=>receiver.type===type).length}</b> ${type}</span>`).join('')}${unassigned.length?`<span class="receiver-unassigned-summary">${unassigned.length} zonder zone</span>`:''}</div>`:''}</div></header><div class="receiver-toolbar${canUpdate?' has-updates':''}"><button class="button receiver-primary-action" data-action="receiver-add"><span aria-hidden="true">＋</span><span>${esc(t('addReceiver'))}</span></button>${updateEntry}</div><div class="receiver-filters" role="group" aria-label="Receivers filteren">${[['all','Alle receivers',all.length],['unassigned','Niet in een zone',unassigned.length]].map(([id,label,count])=>`<button data-action="receiver-filter" data-id="${id}" aria-pressed="${receiverFilter===id}">${label}<span>${count}</span></button>`).join('')}</div><div class="receiver-list">${cards||`<section class="card empty connection-empty receiver-empty-card"><span class="menu-icon" aria-hidden="true">${icon('receiver')}</span><h2>${receiverFilter==='unassigned'&&all.length?'Alles heeft een plek':'Nog geen receivers'}</h2><p>${receiverFilter==='unassigned'&&all.length?'Elke receiver is aan een zone toegewezen.':stand()?'Begin hierboven met Receiver toevoegen.':'Begin met Receiver toevoegen: eerst je stand, dan je zone.'}</p>${receiverFilter==='unassigned'?'<button class="button secondary" data-action="receiver-filter" data-id="all">Alle receivers bekijken</button>':''}</section>`}</div></div>`;
  }
  function renderReceiverAdd() {
    return '<div id="receiver-onboarding"></div>';
  }
  function renderScenes() {
    if(!stand())return `<div class="page"><header class="page-heading"><h1>Scènes</h1><p>Stel eerst je stand en verlichting in. Daarna kun je de gewenste sfeer bewaren.</p></header><button class="button full" data-action="receiver-add">Mijn stand instellen</button></div>`;
    const list=savedScenes.scenes.filter(s=>s.standId===stand().id);
    const ready=stand().zones.some(z=>M.zoneReceivers(model,z.id).length);
    const cards=list.map(scene=>{
      const count=scene.zones.reduce((n,z)=>n+z.receivers.length,0),names=scene.zones.slice(0,2).map(z=>z.name).join(' · '),extra=scene.zones.length-2;
      return `<article class="scene-card-row"><button class="scene-card" data-action="scene-open" data-id="${esc(scene.id)}">${scenePreview(scene)}<span class="scene-card-copy"><b>${esc(scene.name)}</b><small class="scene-card-count">${zoneCount(scene.zones.length)} · ${receiverCount(count)}</small><small class="scene-card-names">${esc(names)}${extra>0?' …':''}</small><span class="scene-open-label">Details ${icon('chevron')}</span></span></button>${sceneActivateButtonMarkup(scene)}</article>`;
    }).join('');
    return `<div class="page scenes-page"><header class="page-heading"><div><div class="eyebrow">${esc(standLabel())}</div><h1>Scènes</h1><p>Bewaar en wissel van sfeer.</p></div></header>${list.length?'':sceneWorkflow()}<button class="button red" data-action="scene-new" ${ready?'':'disabled'}>＋ Huidig licht bewaren</button>${savedScenes.error?`<p class="card" role="alert">${esc(savedScenes.error.message)}</p>`:''}<div class="section-heading scene-list-heading"><h2>Jouw scènes</h2><small>${list.length} ${list.length===1?'scène':'scènes'}</small></div><div class="scene-list">${cards||`<section class="card empty">${icon('scenes')}<h2>Bewaar je eerste sfeer</h2><p>${ready?'Stel je licht in en kies Huidig licht bewaren.':'Voeg eerst verlichting toe via Stand.'}</p></section>`}</div>${list.length?`<details class="scene-workflow-help"><summary>Hoe werkt dit?</summary>${sceneWorkflow()}</details><p class="scene-reading-note"><b>Activeren</b> past de scène toe. <b>Details</b> verandert niets.</p>`:''}</div>`;
  }
  function receiverCount(count) { return `${count} ${count===1?'receiver':'receivers'}`; }
  function ledlineCount(count) { return `${count} ${count===1?'ledline':'ledlines'}`; }
  function zoneCount(count) { return `${count} ${count===1?'zone':'zones'}`; }
  function sceneWorkflow() {
    return `<section class="card scene-workflow" aria-labelledby="scene-workflow-title"><h2 id="scene-workflow-title">Eerst instellen, dan bewaren</h2><ol><li><i>${icon('stand')}</i><b>1 · Stel je licht in</b><small>Kleuren en animaties bij Stand</small></li><li><i>${icon('zones')}</i><b>2 · Kies je zones</b><small>Neem alleen mee wat je wilt</small></li><li><i>${icon('scenes')}</i><b>3 · Bewaar je scène</b><small>Geef je sfeer een naam</small></li></ol><button class="text-button" data-action="stand">Naar Stand · verlichting instellen ${icon('chevron')}</button></section>`;
  }
  function savedSceneStandPlan(scene) {
    // A scene is an immutable light snapshot. Reconstruct its full stand
    // against current, compatible physical geometry without changing model,
    // writing storage or substituting today's active animation/colour.
    try{
      if(!scene?.zones?.some(zone=>zone.receivers.some(receiver=>receiver.state?.standAnimation)))return null;
      return StandAnimations.current(Scenes.apply(copy(model),scene),scene.standId);
    }
    catch(_){return null;}
  }
  function savedZonePreview(saved,css='',standPlan=null) {
    if(!saved.available)return `<span class="scene-preview scene-preview-unavailable ${css}" role="img" aria-label="${esc(saved.name)}: voorbeeld niet beschikbaar">${icon('info')}<small>Indeling gewijzigd</small></span>`;
    if(saved.receivers.some(receiver=>receiver.state?.standAnimation)){
      if(!standPlan)return `<span class="scene-preview scene-preview-unavailable ${css}" role="img" aria-label="${esc(saved.name)}: gezamenlijk voorbeeld niet beschikbaar">${icon('info')}<small>Opstelling gewijzigd</small></span>`;
      return addPreview(saved.receivers,'stacked',`scene-preview ${css}`,{capturedStandPlan:standPlan,capturedStandZoneId:saved.id,label:`Opgeslagen licht · ${saved.name} · ${saved.type}`});
    }
    // No zoneId here: paint must retain the captured scene state instead of
    // substituting the currently edited zone's live light settings.
    return addPreview(saved.receivers,saved.layout,`scene-preview ${css}`,{label:`Opgeslagen licht · ${saved.name} · ${saved.type}`});
  }
  function scenePreview(scene) {
    const zones=Scenes.previewZones(model,scene),shown=zones.slice(0,4),extra=zones.length-shown.length,standPlan=savedSceneStandPlan(scene);
    return `<span class="scene-mosaic" data-zone-count="${zones.length}" aria-label="${zoneCount(zones.length)} in ${esc(scene.name)}">${shown.map(z=>`<span class="scene-mosaic-tile" data-scene-thumbnail-zone="${esc(z.id)}">${savedZonePreview(z,'',standPlan)}</span>`).join('')}${extra?`<span class="scene-mosaic-overflow">+${zoneCount(extra)}</span>`:''}</span>`;
  }
  function sceneActivateButtonMarkup(scene){
    const check=Scenes.compatibility(model,scene),label=check.ok?'Activeren':'Niet beschikbaar';
    const explanation=check.ok?`Scène ${scene.name} direct activeren`:`Scène ${scene.name} niet beschikbaar: ${check.reason}`;
    // A disabled control cannot reveal a hover tooltip on a phone. Show why
    // the scene is unavailable without allowing partial activation.
    return `<button type="button" class="button red scene-quick-activate" data-action="scene-apply" data-id="${esc(scene.id)}" aria-label="${esc(explanation)}" title="${esc(check.ok?'Past deze scène direct toe.':check.reason)}" ${check.ok?'':'disabled'}>${icon('power')}<span>${label}</span></button>${check.ok?'':`<p class="scene-unavailable-note">${icon('info')}<span>${esc(check.reason)}</span></p>`}`;
  }
  function standScenesMarkup(compact=false) {
    const list=savedScenes.scenes.filter(scene=>scene.standId===stand()?.id);
    if(compact){
      const summary=list.length?`${list.length} bewaarde ${list.length===1?'scène':'scènes'}`:'Bekijk en bewaar lichtinstellingen';
      return `<button class="stand-scenes-entry" data-action="stand-scenes"><span class="stand-scenes-entry-icon">${icon('scenes')}</span><span class="stand-scenes-entry-copy"><b>Scènes</b><small>${esc(summary)}</small></span><span class="stand-scenes-entry-open">Openen</span>${icon('chevron')}</button>`;
    }
    const shown=list.slice(0,4);
    const cards=shown.map(scene=>`<article class="stand-scene-row"><button class="stand-scene-card" data-action="scene-open" data-id="${esc(scene.id)}">${scenePreview(scene)}<span><b>${esc(scene.name)}</b><small>${zoneCount(scene.zones.length)} · ${receiverCount(scene.zones.reduce((count,item)=>count+item.receivers.length,0))}</small><i>Details ${icon('chevron')}</i></span></button>${sceneActivateButtonMarkup(scene)}</article>`).join('');
    return `<section class="stand-scenes${compact?' stand-scenes-compact':''}"><div class="section-heading"><div><h2>Scènes</h2><small>${list.length?`${list.length} bewaarde ${list.length===1?'sfeer':'sferen'}`:'Bewaar een lichtinstelling om die later terug te halen.'}</small></div><button class="text-button" data-action="stand-scenes">${list.length?'Alle scènes':'Scènes openen'} ${icon('chevron')}</button></div>${cards?`<div class="stand-scene-list">${cards}</div>`:`<button class="stand-scenes-empty" data-action="stand-scenes">${icon('scenes')}<span><b>Nog geen scènes bewaard</b><small>Open Scènes om je eerste lichtinstelling op te slaan.</small></span>${icon('chevron')}</button>`}</section>`;
  }
  function sceneSearch(mode,count) {
    if(count<6)return '';
    const id=mode==='draft'?'scene-zone-search':'scene-detail-search',value=mode==='draft'?sceneDraft.search||'':sceneDetailSearch;
    return `<label class="scene-search" for="${id}"><span>Zoek een zone</span><input type="search" id="${id}" maxlength="64" autocomplete="off" placeholder="Bijvoorbeeld: balie" value="${esc(value)}"></label><p class="scene-filter-count" data-scene-filter-count role="status" aria-live="polite"></p>`;
  }
  function filterSceneZones(mode) {
    const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
    const query=normalized(mode==='draft'?sceneDraft?.search:sceneDetailSearch),rows=Array.from(main.querySelectorAll('[data-scene-filter-name]'));
    let visible=0;
    rows.forEach(row=>{row.hidden=!normalized(row.dataset.sceneFilterName).includes(query);if(!row.hidden)visible++;});
    const count=main.querySelector('[data-scene-filter-count]');if(count)count.textContent=query?`${visible} van ${zoneCount(rows.length)} zichtbaar`:`${zoneCount(rows.length)} · zoek op naam of type`;
    const empty=main.querySelector('.scene-search-empty');if(empty)empty.hidden=visible>0;
    paint(performance.now()/1000);
  }
  function syncSceneDraft() {
    if(!sceneDraft||route.screen!=='scene-draft')return;
    const available=stand().zones.filter(z=>M.zoneReceivers(model,z.id).length),chosen=available.filter(z=>sceneDraft.zoneIds.includes(z.id));
    const total=chosen.reduce((n,z)=>n+M.zoneReceivers(model,z.id).length,0);
    main.querySelector('.scene-draft-page').dataset.hasSelection=String(chosen.length>0);
    main.querySelectorAll('[data-action="scene-zone"]').forEach(row=>{
      const selected=sceneDraft.zoneIds.includes(row.dataset.id);row.setAttribute('aria-pressed',String(selected));row.querySelector('i').textContent=selected?'✓':'+';
    });
    const summary=main.querySelector('[data-scene-selection-summary]');if(summary)summary.textContent=`${zoneCount(chosen.length)} gekozen · ${receiverCount(total)}`;
    const save=main.querySelector('[data-action="scene-save"]');if(save)save.disabled=!chosen.length||!sceneDraft.name.trim();
    const all=main.querySelector('[data-action="scene-select-all"]');if(all)all.disabled=!available.length||chosen.length===available.length;
    const clear=main.querySelector('[data-action="scene-clear-selection"]');if(clear)clear.disabled=!chosen.length;
    const error=main.querySelector('[data-scene-save-error]');if(error){error.hidden=!sceneDraft.error;error.textContent=sceneDraft.error||'';}
  }
  function renderSceneDraft() {
    if(!stand())return renderScenes();
    if(!sceneDraft)sceneDraft={zoneIds:[],name:'',search:''};
    const editing=Boolean(sceneDraft.sceneId),subtitle=editing?'Vervang deze scène met het huidige licht van je gekozen zones.':'Bewaar het licht zoals het nu is ingesteld.';
    const omitted=sceneDraft.omittedZoneCount?`<p class="card scene-edit-warning" role="status">${sceneDraft.omittedZoneCount} zone${sceneDraft.omittedZoneCount===1?' is':'s zijn'} niet meer beschikbaar en ${sceneDraft.omittedZoneCount===1?'wordt':'worden'} niet opgenomen in de bijgewerkte scène.</p>`:'';
    return `<div class="page scene-draft-page">${contextTitle(editing?'Scène aanpassen':'Sfeer bewaren',subtitle,'Scènes','scenes')}${omitted}<label class="dialog-field scene-name-field">Geef je scène een naam<input id="scene-name" maxlength="64" value="${esc(sceneDraft.name)}" placeholder="Bijvoorbeeld: warm welkom"></label><section class="scene-zone-picker" aria-labelledby="scene-zone-picker-title"><div class="section-heading"><h2 id="scene-zone-picker-title">Welke zones wil je bewaren?</h2></div><div class="scene-bulk-actions"><button class="text-button" data-action="scene-select-all">Alle zones kiezen</button><button class="text-button" data-action="scene-clear-selection">Selectie wissen</button></div>${sceneSearch('draft',stand().zones.length)}<div class="scene-zone-list">${stand().zones.map(z=>{
      const count=M.zoneReceivers(model,z.id).length;
      return `<button class="scene-zone" data-action="scene-zone" data-id="${esc(z.id)}" data-scene-filter-name="${esc(z.name+' '+(z.type||''))}" aria-pressed="${sceneDraft.zoneIds.includes(z.id)}" ${count?'':'disabled'}>${count?zonePreview(z,'scene-preview',{label:`Huidig licht · ${z.name} · ${z.type}`}):`<span class="scene-preview scene-preview-unavailable">${icon('zones')}</span>`}<span><b>${esc(z.name)}</b><small>${count?`${receiverCount(count)} · ${z.type}`:'Nog geen verlichting'}</small></span><i aria-hidden="true">${sceneDraft.zoneIds.includes(z.id)?'✓':'+'}</i></button>`;
    }).join('')}</div><p class="scene-search-empty card" hidden>Geen zones gevonden. Pas je zoekopdracht aan; je selectie blijft bewaard.</p></section><div class="scene-save-bar"><p data-scene-selection-summary role="status" aria-live="polite"></p><p class="scene-save-error" data-scene-save-error role="alert" hidden></p><button class="button red full" data-action="scene-save" disabled>${editing?'Scène bijwerken':'Scène opslaan'}</button><small>${editing?'Vervangt het opgeslagen licht. Je verlichting verandert niet.':'Opslaan verandert je verlichting niet.'}</small></div><button class="button secondary full" data-action="scenes">Annuleren</button></div>`;
  }
  function renderSceneDetail() {
    if(!stand())return renderScenes();
    const scene=savedScenes.scenes.find(s=>s.id===route.sceneId&&s.standId===stand().id);if(!scene)return renderScenes();
    const check=Scenes.compatibility(model,scene),zones=Scenes.previewZones(model,scene),count=zones.reduce((n,z)=>n+z.receiverCount,0),standPlan=savedSceneStandPlan(scene);
    return `<div class="page scene-detail-page">${contextTitle(scene.name,'Opgeslagen scène · bekijken verandert niets.','Scènes','scenes')}<button class="button secondary full scene-edit-button" data-action="scene-edit" data-id="${esc(scene.id)}">${icon('edit')} ${esc(t('updateScene'))}</button><div class="scene-scope-summary"><span>${icon('zones')}<b>${zoneCount(zones.length)}</b></span><span>${icon('receiver')}<b>${receiverCount(count)}</b></span></div><section class="scene-detail"><div class="section-heading"><h2>Zones in deze scène</h2><small>Opgeslagen licht</small></div>${check.ok?'':`<p class="card scene-zone-warning" role="alert">${esc(check.reason)} Er wordt niets gedeeltelijk geactiveerd.</p>`}${sceneSearch('detail',zones.length)}<div class="scene-saved-zones">${zones.map((z,i)=>`<article class="scene-saved-zone" data-scene-zone="${esc(z.id)}" data-scene-zone-type="${z.type}" data-scene-filter-name="${esc(z.name+' '+z.type)}"><header><span class="scene-zone-number">${i+1}</span><div><h3>${esc(z.name)}</h3><small>${z.type} · ${receiverCount(z.receiverCount)}</small></div></header>${savedZonePreview(z,'',standPlan)}${z.available?'':`<p class="scene-zone-warning">${esc(z.reason)}</p>`}</article>`).join('')}</div><p class="scene-search-empty card" hidden>Geen zones gevonden. Pas je zoekopdracht aan om je opgeslagen zones te zien.</p></section><div class="scene-save-bar scene-activate-bar"><p>${zoneCount(zones.length)} · samen toepassen</p><button class="button full" data-action="scene-apply" data-id="${esc(scene.id)}" ${check.ok?'':'disabled'}>Scène activeren</button><small>Andere zones blijven ongewijzigd.</small></div><button class="button secondary" data-action="scene-delete" data-id="${esc(scene.id)}">Scène verwijderen</button></div>`;
  }
  function standConnectionMessage(){
    const state=standConnectionState;
    if(route.screen==='stand-connect'&&standMigrationPreflightError)return standMigrationPreflightError==='STAND_STORAGE_LIMIT'?
      'Je stand is te groot voor deze overdracht. Controleer je opgeslagen onderdelen en probeer opnieuw.':
      'De standgegevens kunnen nog niet worden overgedragen. Controleer je inrichting en probeer opnieuw.';
    if(['STAND_BUSY','STAND_CONNECTION_BUSY'].includes(state.error)){
      if(state.status==='connecting')return state.phase==='load-stand'?'Actuele stand laden…':'Je stand veilig openen…';
      if(state.status==='checking')return 'Je stand herkennen…';
      if(state.status==='changing-code')return 'Nieuwe standcode veilig instellen…';
      if(state.status==='offline')return 'Je vorige poging kon niet starten. Open je stand opnieuw.';
    }
    const codeMessages={STAND_MIGRATION_NOT_READY:'De nieuwe toegang wordt nog afgewerkt. Je huidige stand, verlichting en toegang blijven behouden.',STAND_MIGRATION_CODE_UNCONFIRMED:'De nieuwe standcode is nog niet bevestigd. Verbind met de gekozen code en laad je stand opnieuw; stel niet nogmaals een code in.',STAND_CODE_UNCHANGED:'Kies een andere nieuwe standcode.',STAND_CODE_CHANGE_UNCONFIRMED:'De codewijziging is nog niet bevestigd. Verbind met de gekozen nieuwe code en laad je stand opnieuw; stel niet nogmaals een code in.',STAND_CONNECTION_BUSY:'Er loopt nog een actie. Wacht tot die klaar is en probeer opnieuw.'};
    const storageMessages={STAND_UNCONFIRMED:'De actie is niet bevestigd. Controleer de verbinding en de actuele standstatus.',STAND_STORAGE:'De opslag is niet bevestigd. Controleer de actuele standstatus.',STAND_STORAGE_LIMIT:'Je stand is te groot voor deze overdracht. Controleer je opgeslagen onderdelen.',STAND_CREDENTIAL_UNCONFIRMED:'De standcode kon niet veilig op dit toestel worden bewaard. Controleer de actuele standstatus.'};
    if(storageMessages[state.error])return storageMessages[state.error];
    if(state.error==='LOCAL_NETWORK_DENIED')return t('softwareErrorLocalNetwork');
    if(['WIFI_JOIN_UNSUPPORTED','WIFI_JOIN_DENIED','WIFI_JOIN_TIMEOUT','WIFI_JOIN_UNAVAILABLE'].includes(state.error))return 'Kies het wifi van je stand in Instellingen en kom terug. Je stand blijft bewaard.';
    if(codeMessages[state.error])return codeMessages[state.error];
    const messages={STAND_CREDENTIAL_MISSING:'Open je stand met je standcode.',STAND_CODE_INVALID:'De standcode klopt niet. Controleer het wifiwachtwoord.',STAND_AUTH_FAILED:'De standcode is niet bevestigd. Controleer je huidige wifiwachtwoord.',STAND_MAIN_UNREACHABLE:'Je stand is niet bereikbaar. Controleer je wifi en probeer opnieuw.',STAND_UNAVAILABLE:'Je stand is niet bereikbaar. Controleer je wifi en probeer opnieuw.',STAND_WIFI_UNREACHABLE:'Verbind eerst met het wifi van je stand en probeer opnieuw.',STAND_WRONG_WIFI:'Je bent niet met het gekozen standnetwerk verbonden. Controleer Instellingen → Wifi.',STAND_IDENTITY_UNCONFIRMED:'Dit is niet de verwachte stand. Er zijn geen gegevens vervangen.',STAND_IDENTITY_MISMATCH:'Dit is niet de verwachte stand. Er zijn geen gegevens vervangen.',STAND_CONFIG_CONFLICT:'De inrichting is intussen gewijzigd. Haal de actuele stand op en probeer opnieuw.',STAND_REVISION_CONFLICT:'De inrichting is intussen gewijzigd. Haal de actuele stand op en probeer opnieuw.',STAND_CONNECTION_CANCELLED:'Verbinden is gestopt. Je eerdere stand blijft bewaard.',STAND_CANCELLED:'Verbinden is gestopt. Je eerdere stand blijft bewaard.',STAND_BUSY:'Er loopt nog een actie. Wacht tot die klaar is en probeer opnieuw.'};
    if(messages[state.error])return messages[state.error];
    if(state.status==='connected'){
      if(centralLiveState.status==='unconfirmed'&&!centralLiveState.busy)return centralLiveState.error==='STAND_PHYSICAL_UNCONFIRMED'?'Verbonden · laatste lichtkeuze niet bevestigd op de receivers':'Verbonden · opslag van de laatste lichtkeuze niet bevestigd';
      return state.pendingWrites||centralLiveState.busy||centralLiveState.pending?'Laatste keuze bewaren…':'Verbonden · actuele stand geladen';
    }
    if(state.status==='connecting')return state.phase==='load-stand'?'Actuele stand laden…':'Je stand veilig openen…';
    if(state.status==='checking')return 'Je stand herkennen…';
    if(state.status==='changing-code')return 'Nieuwe standcode veilig instellen…';
    if(state.status==='code-required')return 'Deze receiver ondersteunt openen via verbonden wifi nog niet.';
    if(state.status==='wifi-ready')return 'Stand gevonden. Open je actuele stand zonder extra appcode.';
    if(state.status==='migration-required')return canMigrateCurrentStand()?'Kies je wifi-PIN. Je stand blijft behouden.':'Stel de wifi-PIN eerst in op het toestel waarmee je deze stand instelde. Kom daarna terug.';
    if(state.status==='reconnect-required')return 'Je stand is bewaard. Verbind in Instellingen → Wifi opnieuw met je stand en de gekozen standcode.';
    if(state.status==='setup-required')return 'Je kunt deze receiver gebruiken om je stand in te stellen.';
    return messages[state.error]||(state.error?'Verbinding niet bevestigd. Je eerdere gegevens blijven bewaard. Controleer je wifi en probeer opnieuw.':'Kies eerst het wifi van je stand.');
  }
  function standConnectionCard(){
    return `<section class="card" data-stand-connection><div class="section-heading"><h2>Verbinding met je stand</h2>${icon('lock')}</div><p data-stand-connection-status role="status">${esc(standConnectionMessage())}</p><div class="actions"><button class="button full" data-action="stand-connect">Stand openen</button>${standConnectionState.status==='connected'?`<button class="button secondary full" data-action="stand-share-open">${icon('share')} Deel deze stand</button><button class="text-button" data-action="stand-code-change">Stand-PIN wijzigen</button>`:''}${standSession?.snapshot()?`<button class="text-button" data-action="stand-refresh">Nu verversen</button>`:''}</div><small>Je stand-PIN is ook je wifiwachtwoord.</small></section>`;
  }
  function ensureStandSharing(){
    if(standSharingController)return standSharingController;
    standSharingController=window.LightningStandSharing.create({services:runtime.services,
      capabilities:()=>({simpleStandShare:standSharingAvailable,simpleStandScan:standScanAvailable,simpleStandShareSheet:standShareSheetAvailable,standSessionReceiverManagement:standReceiverManagementAvailable}),
      standConnection:ensureStandSession(),document,window,onManual:showStandCodeEntry,onConnected:result=>{
        simpleStandMode=true;route={...route,screen:'stand',standId:result.standId,zoneId:null};render({top:true});
      },onChange:state=>{if(!state.busy&&standLinkPending)queueMicrotask(consumeStandShareLink);}});
    return standSharingController;
  }
  function renderStandSharing(){
    if(standSharingMode!=='share')return renderStandConnection();
    return `<div class="page stand-connect-page">${contextTitle('Deel deze stand','','Je stand','stand')}<div data-stand-sharing-host></div></div>`;
  }
  async function refreshStandCapabilities(){
    const capabilities=await runtime.capabilities();
    simpleStandSupported=capabilities?.simpleStand===true;
    standMigrationReady=simpleStandSupported&&capabilities?.simpleStandMigrationReady===true;
    standSharingAvailable=simpleStandSupported&&capabilities?.simpleStandShare===true;
    standWifiOpenAvailable=simpleStandSupported&&capabilities?.standWifiOpen===true;
    // The customer's only credential is the wifi PIN. Historical codecs are
    // not a second opening route and cannot consume an unsolicited link.
    standScanAvailable=false;standLinkAvailable=false;
    standShareSheetAvailable=simpleStandSupported&&capabilities?.simpleStandShareSheet===true;
    standReceiverManagementAvailable=simpleStandSupported&&capabilities?.standSessionReceiverManagement===true;
    standReceiverCapabilities=Object.freeze(simpleStandSupported?{
      standSessionReceiverManagement:standReceiverManagementAvailable,
      standSessionIdentification:capabilities?.standSessionIdentification===true,
      standSessionOutputs:capabilities?.standSessionOutputs===true,
      standSessionOTA:capabilities?.standSessionOTA===true
    }:{});
    standReceiverNotice=window.LightningStandManagementCapabilities.notice(standReceiverCapabilities);
    return capabilities;
  }
  async function openCentralStandConnection({intent='open'}={}){
    if(standConnectionBusy)return;
    standMigrationPreflightError=null;
    try{await refreshStandCapabilities();}catch(_){return toast('De verbinding is nog niet bevestigd. Probeer opnieuw.');}
    if(!simpleStandSupported)return toast('Stand openen is niet beschikbaar in deze appversie. Je bestaande stand blijft behouden.');
    standConnectionIntent=intent;
    standManualEntry=standConnectionState.status==='migration-required';
    legacyStandReturn=!simpleStandMode&&!standMigrationReady&&!centralApplied&&!centralPending&&legacyStandLandingId===stand()?.id?{standId:legacyStandLandingId}:null;
    simpleStandMode=true;standNetworkProbeAttempted=false;ensureStandSession();
    standSharingMode=null;
    route={...route,screen:'stand-connect'};render({top:true});
  }
  function showStandCodeEntry(){
    standManualEntry=true;render({preserveScroll:true});
    main.querySelector('[data-stand-manual-open]')?.scrollIntoView({block:'start',behavior:'auto'});
    main.querySelector('[data-stand-code]')?.focus({preventScroll:true});
  }
  async function openManagementStandConnection(){
    if(managementBusy||standConnectionBusy)return;
    const standId=stand()?.id;
    managementConnectionReturn=standId&&receiverAssignment?{standId,assignment:copy(receiverAssignment)}:null;
    closeEffectDialog();
    await openCentralStandConnection();
  }
  function restoreManagementAssignment(standId){
    const pending=managementConnectionReturn,current=standSession?.snapshot();
    if(!pending||standConnectionState.status!=='connected'||current?.standId!==standId)return;
    managementConnectionReturn=null;
    if(pending.standId!==standId)return;
    flushCentralProjection();
    const assignment=pending.assignment;
    if(assignment.mode==='many'){
      const target=model.stands.find(s=>s.id===standId)?.zones.find(z=>z.id===assignment.zoneId);if(!target)return;
      navigate('receivers',{standId,zoneId:null});receiverAssignment=assignment;renderZoneReceiverPicker();return;
    }
    const receiver=model.receivers.find(r=>r.id===assignment.receiverId&&r.standId===standId&&r.lifecycle==='added');
    if(!receiver)return;
    const target=assignment.zoneId?model.stands.find(s=>s.id===standId)?.zones.find(z=>z.id===assignment.zoneId):null;
    const validTarget=!assignment.zoneId||target&&(!target.type||target.type===receiver.type);
    navigate('receivers',{standId,zoneId:null});showReceiverAssignment(receiver.id,validTarget?assignment.zoneId:receiver.zoneId);
    if(!validTarget)toast('Je eerdere zonekeuze is niet meer beschikbaar. Kies de zone opnieuw.');
  }
  function verifiedUnsetStand(){
    return simpleStandMode&&standConnectionState.status==='setup-required'&&!standConnectionState.error&&!standConnectionBusy&&
      !!standInspectedNetworkName&&standInspectedNetworkName===standNetworkName&&standSession?.state().status==='setup-required';
  }
  async function consumeStandShareLink(){
    if(!standLinkPending||standLinkJob||nativeLoading||document.hidden||!standLinkAvailable||typeof runtime.services.takeStandShareLink!=='function'||standConnectionBusy||standSharingController?.state().busy)return;
    standLinkPending=false;
    const job=Promise.resolve().then(async()=>{try{
      const reply=await runtime.services.takeStandShareLink({});
      if(reply.status==='none')return;
      // Parsing alone is not authentication. No connection, setup, cache
      // publication or expected identity change happens before confirmation.
      const checked=window.LightningStandSharing.parse(reply.text);
      if(document.hidden)return;
      standConnectionIntent='open';standManualEntry=false;simpleStandMode=true;
      standSharingMode='join';const sharing=ensureStandSharing();sharing.open('join');sharing.parseLink(window.LightningStandSharing.format(checked));navigate('stand-connect');
    }catch(_){if(!document.hidden)toast('De gedeelde stand is niet bevestigd. Vraag een nieuwe link of gebruik de standcode.');}
    finally{if(standLinkJob===job)standLinkJob=null;}});standLinkJob=job;await job;
    if(standLinkPending)queueMicrotask(consumeStandShareLink);
  }
  function renderStandCodeChange(){
    if(!standSession?.snapshot()||standConnectionState.status!=='connected'&&standConnectionState.status!=='changing-code')return renderStandConnection();
    const field=(attribute,label,fresh=false)=>`<label class="dialog-field">${label}<input ${attribute} type="password" minlength="8" maxlength="${fresh?12:63}" ${fresh?'inputmode="numeric" pattern="[0-9]{8,12}"':''} autocomplete="off" spellcheck="false" autocapitalize="none" ${standConnectionBusy?'disabled':''}></label>`;
    return `<div class="page stand-connect-page">${contextTitle('Stand-PIN wijzigen','Je stand blijft behouden','Instellingen','settings')}<section class="card">${field('data-stand-current-code','Huidige standcode')}${field('data-stand-new-code','Nieuwe stand-PIN · 8–12 cijfers',true)}${field('data-stand-new-code-confirm','Herhaal je nieuwe stand-PIN',true)}<p>Dit wordt ook je wifiwachtwoord. Verbind daarna ieder toestel opnieuw. Oude QR-codes en links werken dan niet meer.</p><p data-stand-connection-status role="status" aria-live="polite">${esc(standConnectionMessage())}</p><button class="button full" data-action="stand-code-change-submit" ${standConnectionBusy?'disabled':''}>${standConnectionBusy?'PIN instellen…':'Stand-PIN wijzigen'}</button></section></div>`;
  }
  function canMigrateCurrentStand(){
    return !localStandConcept()&&standConnectionState.status==='migration-required'&&model.stands.length===1&&standMigrationReady;
  }
  function renderStandConnection(){
    const settingUp=standConnectionIntent==='setup',fromWelcome=!stand();
    const migrated=standConnectionState.status==='migration-required',unset=standConnectionState.status==='setup-required',reconnect=standSession?.canResume(),connected=standConnectionState.status==='connected'&&standSession?.snapshot();
    const canMigrate=canMigrateCurrentStand(),migrationElsewhere=migrated&&!canMigrate;
    const codeFields=canMigrate?`<label class="dialog-field">Wifi-PIN · 8–12 cijfers<input data-stand-code type="password" minlength="8" maxlength="12" inputmode="numeric" pattern="[0-9]{8,12}" autocomplete="off" spellcheck="false" ${standConnectionBusy?'disabled':''}></label><label class="dialog-field">Herhaal je wifi-PIN<input data-stand-code-confirm type="password" inputmode="numeric" minlength="8" maxlength="12" pattern="[0-9]{8,12}" autocomplete="off" spellcheck="false" ${standConnectionBusy?'disabled':''}></label><button class="text-button" data-action="stand-code-suggest" ${standConnectionBusy?'disabled':''}>Stel een PIN voor</button><p>Je bestaande stand blijft behouden.</p>`:'';
    const submit=migrationElsewhere?`<button class="button full" data-action="stand-find-submit" ${standConnectionBusy?'disabled':''}>${standConnectionBusy?'Wifi controleren…':'Opnieuw controleren'}</button>`:connected?'<button class="button full" data-action="stand-show-loaded">Ga naar je stand</button>':reconnect?`<button class="button full" data-action="stand-resume-submit" ${standConnectionBusy?'disabled':''}>${standConnectionBusy?'Stand openen…':'Stand openen'}</button>`:canMigrate?`<button class="button full" data-action="stand-migrate-submit" ${standConnectionBusy?'disabled':''}>${standConnectionBusy?'PIN bewaren…':'Stand behouden en PIN instellen'}</button>`:settingUp?`<button class="button full" data-action="stand-find-submit" ${standConnectionBusy?'disabled':''}>${standConnectionBusy?'Wifi controleren…':'Wifi controleren'}</button>`:`<button class="button full" data-action="stand-wifi-open" ${standConnectionBusy||!standWifiOpenAvailable?'disabled':''}>${standConnectionBusy?'Stand openen…':'Stand openen'}</button>`;
    return `<div class="page stand-connect-page" data-stand-connection-intent="${settingUp?'setup':'open'}">${contextTitle(canMigrate?'Kies je wifi-PIN':migrationElsewhere?'Wifi-PIN afronden':settingUp?'Stand instellen':'Stand openen','','Welkom','stand')}${settingUp?'<ol class="stand-simple-steps" aria-label="Stand instellen in drie stappen"><li aria-current="step"><i>1</i><b>Wifi verbinden</b></li><li><i>2</i><b>PIN kiezen</b><small>8–12 cijfers</small></li><li><i>3</i><b>Klaar</b></li></ol>':''}<section class="card stand-code-entry" data-stand-manual-open>${canMigrate||migrationElsewhere?'':`<h2>${settingUp?'Verbind met wifi':'Open je stand'}</h2><p>${settingUp?'Zet je eerste receiver aan. Kies zijn ALUVISION-wifi in Instellingen en kom terug.':'Kies je standwifi in Instellingen → Wifi en kom terug.'}</p>`}${standNetworkName?`<p data-stand-detected-network>Wifi: <b>${esc(standNetworkName)}</b></p>`:''}${codeFields}<p data-stand-connection-status role="status" aria-live="polite">${esc(standConnectionMessage())}</p>${standConnectionState.status==='code-required'?'<p>Werk je receiver bij om je stand zonder extra appcode te openen. Er wordt niets opnieuw ingesteld.</p>':''}${!standWifiOpenAvailable&&!migrated&&!settingUp?'<p>Stand openen via verbonden wifi is nog niet beschikbaar in deze appversie.</p>':''}${unset&&verifiedUnsetStand()?'<button class="button full" data-action="stand-setup-start">Verder · stand instellen</button>':submit}${canMigrate?'<button class="text-button" data-action="stand-find-submit">Wifi opnieuw controleren</button>':''}</section></div>`;
  }
  async function openStandOnWifi(){
    if(standConnectionBusy||!simpleStandMode||!standWifiOpenAvailable)return;
    standMigrationPreflightError=null;standNetworkProbeAttempted=true;standNetworkLastProbeAt=performance.now();standConnectionBusy=true;render({preserveScroll:true});
    let openedStandId=null;
    try{
      // A local concept ID is not a pinned MAIN identity.
      const existing=!localStandConcept()&&model.stands.length===1?model.stands[0].id:undefined;
      const inspection=await ensureStandSession().inspect(existing?{expectedStandId:existing}:{});
      standNetworkName=inspection.ssid;standInspectedNetworkName=inspection.ssid;
      if(inspection.status==='migration-required')standManualEntry=true;
      if(inspection.status!=='wifi-ready')return;
      const result=await standSession.openWifi(existing?{expectedStandId:existing}:{});
      openedStandId=result.standId;route={...route,screen:'stand',standId:result.standId,zoneId:null};
    }catch(error){standConnectionState={...standConnectionState,error:error?.code||'STAND_CONNECTION_FAILED'};}
    finally{standConnectionBusy=false;render({preserveScroll:true});}
    if(openedStandId)restoreManagementAssignment(openedStandId);
  }
  function syncStandConnectionStatus(){
    for(const node of document.querySelectorAll('[data-stand-connection-status]'))node.textContent=standConnectionMessage();
    syncArrangementControls();
  }
  function centralEditing(){
    return !!receiverSetupPreparation||route.screen==='stand-sharing'||route.screen==='receiver-add'&&!!onboarding.summary()||!!document.querySelector('.receiver-removal-sheet[open]')||!!centralLibraryPending||centralLibraryWriting||centralLiveCheckpoint?.editing()||!!activeControlPointer||inlineOrderDrag?.isActive()||managementBusy||arrangementApplying||
      !!document.querySelector('#effect-dialog[open] input:not([data-stand-code])');
  }
  function installCentralProjection(next,{redraw=true,readIntentGeneration,projectionCurrent}={}){
    if(projectionCurrent&&!projectionCurrent())return;
    // Authenticated contents retire the former landing permanently, even if
    // installing the view must wait for an active editor to finish.
    legacyStandLandingId=null;legacyStandReturn=null;
    if(next.ssid){standNetworkName=next.ssid;standInspectedNetworkName=next.ssid;}
    if(centralEditing()){centralPending=next;centralPendingReadFence={readIntentGeneration,projectionCurrent};return;}
    installationLibraries.replaceFromCentral(next.libraries,next.standId);
    const preview=centralLiveCheckpoint?.projectionModel(next,readIntentGeneration) || next.view.model;
    centralApplied=copy(next);centralPending=null;centralPendingReadFence=null;model=M.assertValid(preview);
    if(localStandConceptId)retireLocalStandConcept();
    centralLiveCheckpoint?.seed(model,next.standId,{bootId:next.bootId,stateRevision:next.stateRevision});
    retainSetupSelections();nativeLoaded=true;
    if(redraw)render({preserveScroll:true});
  }
  function flushCentralProjection(){
    if(centralPendingReadFence?.projectionCurrent&&!centralPendingReadFence.projectionCurrent()){centralPending=null;centralPendingReadFence=null;return;}
    if(centralPending&&!centralEditing())installCentralProjection(centralPending,{redraw:false,...centralPendingReadFence});
  }
  function reconcileCentralUnchanged(next,fence){
    // A normal unchanged poll is a no-op. Reconcile only a retained preview
    // or deferred projection, using this actual fresh read's local fence.
    if(centralLiveCheckpoint?.reconciliationPending()||centralPending)installCentralProjection(next,fence);
  }
  function ensureStandSession(){
    if(standSession)return standSession;
    standSession=SimpleStand.create({services:runtime.services,captureProjectionFence:()=>centralLiveCheckpoint?.intentGeneration(),onProjection:(next,fence)=>installCentralProjection(next,fence),onUnchangedProjection:reconcileCentralUnchanged,
      onState:state=>{standConnectionState=state;syncStandConnectionStatus();},visible:()=>!document.hidden});
    centralLiveCheckpoint=window.LightningStandLiveCheckpoint.create({
      waitBeforeFlush:async({standId,receiverIds})=>{
        await liveController?.whenIdle({standId,waitForGesture:true});
        if(receiverIds().some(id=>liveController?.state(id).kind!=='applied'))throw Object.assign(Error('Laatste lichtkeuze nog niet bevestigd op de receivers.'),{code:'STAND_PHYSICAL_UNCONFIRMED'});
      },
      send:request=>standSession.mutate(request),afterSaved:()=>standSession.refresh(),
      onState:state=>{centralLiveState=state;syncStandConnectionStatus();if(!state.busy&&!state.pending)flushCentralProjection();}
    });
    return standSession;
  }
  async function submitStandConnection({migration=false}={}){
    if(standConnectionBusy||!simpleStandMode)return;
    standMigrationPreflightError=null;syncStandConnectionStatus();
    if(migration&&!standMigrationReady)return toast('De nieuwe toegang wordt nog afgewerkt. Je huidige stand blijft behouden.');
    if(centralLibraryPending||centralLibraryWriting||centralLiveCheckpoint?.editing())return toast('Je laatste wijziging wordt nog bewaard. Probeer daarna opnieuw.');
    const code=main.querySelector('[data-stand-code]');if(!code)return;
    if(standNetworkName!==standInspectedNetworkName)return toast('Controleer eerst deze hoofdreceiver opnieuw.');
    const confirmation=main.querySelector('[data-stand-code-confirm]');
    if(migration&&(!confirmation||confirmation.value!==code.value))return toast('De twee standcodes zijn niet hetzelfde.');
    if(migration){try{SimpleStand.newCode(code.value);}catch(_){return toast('Kies een stand-PIN van 8–12 cijfers.');}}
    let standCode=code.value;code.value='';if(confirmation)confirmation.value='';
    let request={standCode};
    try{
      if(migration){
        const existing=model.stands[0];if(localStandConcept()||model.stands.length!==1||!existing)throw Object.assign(Error(),{code:'STAND_MIGRATION_INVALID'});
        request={...request,expectedStandId:existing.id,payload:{operations:SimpleStand.entities(model,installationLibraries.capture(existing.id),existing.id,{migration:true})}};
      }
    }catch(error){
      // No native request or authority reset has happened. Never display an
      // arbitrary library/model exception, which could contain private data.
      standMigrationPreflightError=['STAND_STORAGE_LIMIT','LIBRARY_LIMIT'].includes(error?.code)?'STAND_STORAGE_LIMIT':'STAND_MIGRATION_INVALID';
      standCode='';request.standCode='';render({preserveScroll:true});return;
    }
    // An authentication/migration attempt is never allowed to turn a failure
    // into old access. The return witness is only for credential-free browsing.
    legacyStandLandingId=null;legacyStandReturn=null;
    centralLiveCheckpoint?.reset();standConnectionBusy=true;render({preserveScroll:true});
    let openedStandId=null;
    try{
      const result=await (migration?ensureStandSession().migrateDetected(request):ensureStandSession().connectDetected(request));
      if(result?.view){openedStandId=result.standId;route={...route,screen:'stand',standId:result.standId,zoneId:null};toast('Je actuele stand is geopend.');}
    }catch(error){
      standConnectionState={...standConnectionState,error:error?.code||'STAND_CONNECTION_FAILED'};
    }finally{standCode='';request.standCode='';standConnectionBusy=false;render({preserveScroll:true});}
    if(openedStandId)restoreManagementAssignment(openedStandId);
  }
  async function inspectCentralStand({automatic=false,userInitiated=false}={}){
    if(standConnectionBusy||!simpleStandMode)return;
    if(!automatic||userInitiated)standMigrationPreflightError=null;
    if(centralLibraryPending||centralLibraryWriting||centralLiveCheckpoint?.editing())return toast('Je laatste wijziging wordt nog bewaard. Probeer daarna opnieuw.');
    const network=main.querySelector('[data-stand-ssid]');if(!automatic&&!network)return;
    const request=automatic?{}:{ssid:network.value};
    if(!automatic)standNetworkName=network.value;
    standNetworkProbeAttempted=true;standNetworkLastProbeAt=performance.now();standInspectedNetworkName='';standConnectionBusy=true;render({preserveScroll:true});
    try{const result=await ensureStandSession().inspect(request);standNetworkName=result.ssid;standInspectedNetworkName=result.ssid;}
    catch(error){standConnectionState={...standConnectionState,error:error?.code||'STAND_CONNECTION_FAILED'};}
    finally{standConnectionBusy=false;render({preserveScroll:true});}
  }
  async function resumeCentralStand(){
    if(standConnectionBusy||!simpleStandMode||!standSession?.canResume())return;
    standConnectionBusy=true;render({preserveScroll:true});
    let openedStandId=null;
    try{const result=await standSession.resume();if(result?.view){openedStandId=result.standId;route={...route,screen:'stand',standId:result.standId,zoneId:null};toast('Je bewaarde stand is geopend.');}}
    catch(error){standConnectionState={...standConnectionState,error:error?.code||'STAND_CONNECTION_FAILED'};}
    finally{standConnectionBusy=false;render({preserveScroll:true});}
    if(openedStandId)restoreManagementAssignment(openedStandId);
  }
  function wakeCentralStand(){
    if(!simpleStandMode||!standSession||standConnectionBusy)return;
    if(['connecting','checking','changing-code'].includes(standConnectionState.status))return;
    if(standSession.canResume())void resumeCentralStand();
    else if(route.screen==='stand-connect'&&(standConnectionIntent==='setup'||standManualEntry)&&!standSession.snapshot()&&!document.hidden&&!main.querySelector('[data-stand-code]')?.value&&!main.querySelector('.stand-manual-connection[open]')&&performance.now()-standNetworkLastProbeAt>=7000)void inspectCentralStand({automatic:true});
    else void standSession.wake().catch(()=>{});
  }
  async function changeCentralStandCode(){
    if(standConnectionBusy||!simpleStandMode||!standSession?.snapshot())return;
    if(centralLibraryPending||centralLibraryWriting||centralLiveCheckpoint?.editing())return toast('Je laatste wijziging wordt nog bewaard. Probeer daarna opnieuw.');
    const old=main.querySelector('[data-stand-current-code]'),next=main.querySelector('[data-stand-new-code]'),confirmation=main.querySelector('[data-stand-new-code-confirm]');
    if(!old||!next||!confirmation)return;
    if(next.value!==confirmation.value)return toast('De twee nieuwe standcodes zijn niet hetzelfde.');
    try{SimpleStand.newCode(next.value);}catch(_){return toast('Kies een stand-PIN van 8–12 cijfers.');}
    const current=standSession.snapshot();
    standNetworkName=current.ssid;
    const request={standId:current.standId,currentCode:old.value,newCode:next.value};
    old.value='';next.value='';confirmation.value='';standConnectionBusy=true;render({preserveScroll:true});
    try{const result=await standSession.changeCode(request);standNetworkName=result.ssid;route={...route,screen:'stand-connect'};}
    catch(error){standConnectionState={...standConnectionState,error:error?.code||'STAND_CODE_CHANGE_FAILED'};if(standSession.canResume())route={...route,screen:'stand-connect'};else toast(standConnectionMessage());}
    finally{request.currentCode='';request.newCode='';standConnectionBusy=false;render({preserveScroll:true});}
  }
  async function refreshCentralStand(){
    if(!standSession)return;
    try{const next=await standSession.refresh();installCentralProjection(next,SimpleStand.readFence(next));flushCentralProjection();render({preserveScroll:true});}
    catch(_){syncStandConnectionStatus();toast(standConnectionMessage());}
  }
  async function saveCentralModel(next){
    if(!centralApplied||!standSession?.snapshot())throw Object.assign(Error('Open eerst je stand.'),{code:'STAND_NOT_CONNECTED'});
    const before=copy(centralApplied),libraries=installationLibraries.capture(before.standId);
    const operations=SimpleStand.changes(before,{model:next,libraries},before.standId);
    if(!operations.length)return before.view;
    await standSession.mutate({op:'config',expectedRevision:before.configRevision,payload:{operations},transactionId:crypto.randomUUID()});
    await standSession.refresh();const saved=standSession.snapshot();
    return saved.view;
  }
  function queueCentralLibraryChange(){
    if(!centralApplied||!standSession?.snapshot())return Promise.reject(Object.assign(Error('Open eerst je stand.'),{code:'STAND_NOT_CONNECTED'}));
    if(!centralLibraryPending)centralLibraryPending={before:copy(centralApplied),waiters:[],libraries:null};
    centralLibraryPending.libraries=copy(installationLibraries.capture(centralLibraryPending.before.standId));
    clearTimeout(centralLibraryTimer);centralLibraryTimer=setTimeout(()=>void flushCentralLibraryChange(),600);
    const job=centralLibraryPending;return new Promise((resolve,reject)=>job.waiters.push({resolve,reject}));
  }
  async function flushCentralLibraryChange(){
    clearTimeout(centralLibraryTimer);centralLibraryTimer=null;
    if(centralLibraryWriting||!centralLibraryPending)return;
    const job=centralLibraryPending;centralLibraryPending=null;centralLibraryWriting=true;let ownCommit=null;
    try{
      const before=job.before,operations=SimpleStand.changes(before,{model:before.view.model,libraries:job.libraries},before.standId);
      if(operations.length){
        ownCommit=await standSession.mutate({op:'config',expectedRevision:before.configRevision,payload:{operations},transactionId:crypto.randomUUID()});
        await standSession.refresh();
      }
      for(const waiter of job.waiters)waiter.resolve();
    }catch(error){
      for(const waiter of job.waiters)waiter.reject(error);
      const status=document.querySelector('#effect-dialog .brand-picker-status');if(status)status.textContent='Opslaan bij de hoofdreceiver is niet bevestigd.';
    }finally{
      centralLibraryWriting=false;
      // Rapid edits queued while our own checkpoint was in progress can use
      // its confirmed base. Never rebase across another phone's revision.
      const fresh=standSession?.snapshot();
      if(centralLibraryPending&&ownCommit&&fresh&&fresh.bootId===ownCommit.bootId&&fresh.configRevision===ownCommit.configRevision&&
         centralLibraryPending.before.bootId===job.before.bootId&&centralLibraryPending.before.configRevision===job.before.configRevision)
        centralLibraryPending.before=copy(fresh);
      if(centralLibraryPending)centralLibraryTimer=setTimeout(()=>void flushCentralLibraryChange(),600);
      else flushCentralProjection();
    }
  }
  async function confirmCentralLibrary(result){
    if(!simpleStandMode||!result?.centralPromise)return;
    void flushCentralLibraryChange();
    try{await result.centralPromise;}
    catch(error){
      const message=error?.code==='STAND_CONFIG_CONFLICT'
        ?'Opslaan bij de hoofdreceiver is niet bevestigd. De stand is intussen gewijzigd; haal de actuele stand op en probeer opnieuw.'
        :'Opslaan bij de hoofdreceiver is niet bevestigd. Je invoer blijft bewaard; controleer de verbinding en probeer opnieuw.';
      throw Object.assign(Error(message),{code:error?.code||'STAND_SAVE_UNCONFIRMED'});
    }
  }
  function observeCentralLibraryStatus(result,status){
    if(!status)return;
    if(!simpleStandMode||!result?.centralPromise){status.textContent=t('brandSaved');return;}
    const ticket=String(++centralLibraryStatusTicket);status.dataset.centralLibraryTicket=ticket;status.textContent='Bewaren…';
    result.centralPromise.then(()=>{
      if(status.isConnected&&status.dataset.centralLibraryTicket===ticket)status.textContent=t('brandSaved');
    },()=>{
      if(status.isConnected&&status.dataset.centralLibraryTicket===ticket)status.textContent='Opslaan bij de hoofdreceiver is niet bevestigd.';
    });
  }
  function renderPinLogin() {
    if(simpleStandSupported)return renderStandConnection();
    if(pinLoginAvailable&&nativeContext)return `<div class="page pin-login-page">${contextTitle('Bestaande stand openen','Met je installatie-PIN','Instellingen','settings')}<section class="card"><h2>Verbind met je stand</h2><p>Kies eerst het <b>ALUVISION-wifi</b> van je stand in Instellingen → Wifi. Het wifi-wachtwoord is dezelfde PIN.</p><p>Je maakt geen nieuwe stand en reset geen receivers.</p><label class="dialog-field">Installatie-PIN<input data-recovery-pin type="password" inputmode="numeric" autocomplete="off" minlength="8" maxlength="12" pattern="[0-9]{8,12}" spellcheck="false" ${pinLoginBusy?'disabled':''}></label><p data-recovery-status role="status">${pinLoginBusy?'PIN controleren en je stand ophalen… Laat de receivers aan.':esc(pinLoginError)}</p><button class="button full" data-action="pin-login-submit" ${pinLoginBusy?'disabled':''}>${pinLoginBusy?'Stand ophalen…':'Stand openen'}</button>${pinLoginBusy?'<button class="button secondary full" data-action="pin-login-cancel">Ophalen stoppen</button>':''}</section><p>Je stand verschijnt pas nadat de receivers en de bewaarde instellingen veilig zijn gecontroleerd.</p></div>`;
    if(!pinRequired()&&!nativeContext)return renderSettings();
    // An older or unvalidated native host must never collect a recovery PIN.
    // New-installation commissioning is not a substitute for authenticated recovery.
    return `<div class="page pin-login-page">${contextTitle('Inloggen met PIN','Je bestaande installatie openen','Instellingen','settings')}<section class="card pin-login-status" aria-labelledby="pin-login-status-title"><span class="menu-icon" aria-hidden="true">${icon('lock')}</span><h2 id="pin-login-status-title" data-pin-login-status>Nog niet beschikbaar in deze versie</h2><p>Veilig inloggen en je bewaarde installatie terughalen worden nog aangesloten. Je kunt hier daarom nog geen PIN invoeren.</p><p>Je huidige stand en receivers blijven ongewijzigd.</p></section><section class="card pin-login-guide"><h2>Waarvoor is deze optie?</h2><p>Je bestaande stand weer openen op een ander toestel of nadat je de app opnieuw hebt geïnstalleerd. Je gebruikt dan je bestaande installatie-PIN; je maakt geen nieuwe PIN of nieuwe stand aan.</p><ol><li><b>Verbind met het wifi van je installatie</b><span>Kies het ALUVISION-netwerk via de wifi-instellingen van je telefoon.</span></li><li><b>Open je installatie met je PIN</b><span>Zodra deze functie beschikbaar is, wordt je PIN veilig gecontroleerd voordat je bewaarde installatie wordt teruggehaald.</span></li></ol></section><button class="button full" data-action="settings">Terug naar Instellingen</button></div>`;
  }
  async function openPinLogin(){
    if(simpleStandSupported)return openCentralStandConnection();
    navigate('pin-login');if(!nativeContext||typeof runtime?.services?.recoverInstallation!=='function'||pinLoginChecking)return;
    pinLoginChecking=true;
    try{const caps=await runtime.capabilities();pinLoginAvailable=caps?.pinLogin===true&&caps?.installationRestore===true;}
    catch(_){pinLoginAvailable=false;}
    finally{pinLoginChecking=false;if(route.screen==='pin-login')render({top:true});}
  }
  async function submitPinLogin(){
    if(simpleStandSupported)return;
    const input=main.querySelector('[data-recovery-pin]');if(!pinLoginAvailable||pinLoginBusy||!input)return;
    let pin=input.value;input.value='';
    if(!/^\d{8,12}$/.test(pin)){pinLoginError='Vul je bestaande PIN van 8–12 cijfers in.';render();return;}
    pinLoginBusy=true;pinLoginError='';pinRecoveryAbort=new AbortController();render();
    try{
      const result=await runtime.services.recoverInstallation({pin,signal:pinRecoveryAbort.signal});pin='';
      reloadBackupLibraries();
      model=keepLocalPreviewStates(result.playbackModel,{exceptStandId:result.standId});nativeLoaded=true;selections.clear();liveStates.clear();
      lightIntentDirty=true;saveLightIntent();
      window.AluvisionSecurityMode?.updateFromNative?.({pinRequired:true});
      route={...route,screen:'stand',standId:result.standId,zoneId:null};render({top:true});toast(result.librariesComplete===false?'Receivers en zones hersteld. Op deze receiver waren nog geen scènes, animatiepresets of kleuren bewaard.':'Je stand is geopend. Kies een zone om je licht te bedienen.');
    }catch(error){
      const messages={PIN_RECOVERY_PIN_INVALID:'Deze PIN klopt niet. Controleer je installatie-PIN.',PIN_RECOVERY_LOCKED:'Er zijn te veel pogingen gedaan. Wacht even voordat je opnieuw probeert.',PIN_RECOVERY_EXPIRED:'De controle is verlopen. Controleer je wifi en probeer opnieuw.',PIN_RECOVERY_UNAVAILABLE:'Je stand kan nog niet volledig worden opgehaald. Controleer de receiverupdates en je wifi.',PIN_RECOVERY_CANCELLED:'Het ophalen is onderbroken. Je bestaande gegevens zijn niet vervangen.'};
      pinLoginError=error?.code==='CANCELLED'?'Het ophalen is gestopt. Je kunt het opnieuw proberen.':messages[error?.code]||'Je stand is nog niet veilig hersteld. Laat de receivers aan, controleer het ALUVISION-wifi en probeer opnieuw.';
    }finally{pin='';pinLoginBusy=false;pinRecoveryAbort=null;if(route.screen==='pin-login')render({top:true});}
  }
  function pinProtectionCard() {
    if(webDemoContext)return `<section class="card" data-stand-connection><div class="section-heading"><h2>Eén gebruiker</h2>${icon('wifi')}</div><p>Deze demo gebruikt fictieve receivers en verbindt niet met wifi of echte verlichting.</p><p>In de tijdelijke testversie staan PIN, standcode en delen via QR-code uit.</p><small>Probeer de bediening met de voorbeeldreceivers. Je hoeft je wifi niet te veranderen.</small></section>`;
    if(simpleStandSupported)return standConnectionCard();
    const selected=securityStand(),current=pinProtection?.standId===selected?.id?pinProtection:null;
    const available=nativeContext&&typeof runtime?.services?.securityStatus==='function'&&typeof runtime?.services?.setPinProtection==='function';
    const contextBusy=receiverContextStates.get(selected?.id)?.status==='syncing';
    const pending=current?.status==='pending',needsCheck=pinProtectionPendingCheckStandId===selected?.id||!!pinProtectionNeedsRefresh();
    const ready=!!current&&!pending&&!needsCheck&&!contextBusy&&!pinProtectionLoading&&!pinProtectionBusy&&!pinProtectionReconnect&&!pinProtectionError;
    const message=!nativeContext?'Beschikbaar in de iPhone-app.':!selected?'Geef je stand eerst een naam.':pinProtectionLoading?(pinProtectionWaitingForLive?'Laatste lichtinstelling afronden…':'Beveiliging controleren…'):contextBusy?'Instellingen worden eerst op de receivers bewaard…':pinProtectionError||(pending?'Je eerdere beveiligingswijziging wordt nog bevestigd. Controleer opnieuw.':needsCheck?'Controleer de actuele beveiligingsstatus.':pinProtectionReconnect?'Verbind opnieuw met het wifi van je installatie.':!available?'De verbindingsdienst is niet beschikbaar.':current?.scope==='new-installation'?'Kies een PIN tijdens het instellen van je stand.':'Eén PIN voor wifi en netwerk verwijderen.');
    return `<section class="card pin-protection-card" data-pin-protection><div class="pin-protection-heading"><span class="menu-icon" aria-hidden="true">${icon('lock')}</span><div><h2>PIN-beveiliging</h2><small>Je PIN is ook je wifi-wachtwoord</small></div><button class="switch" role="switch" aria-label="PIN-beveiliging" aria-checked="${current?.pinRequired===true}" data-action="pin-protection-toggle" ${ready?'':'disabled'}><span>${current?current.pinRequired?'Aan':'Uit':'—'}</span><i aria-hidden="true"></i></button></div><p data-pin-protection-status role="status">${esc(message)}</p>${pinProtectionReconnect?'<button class="text-button" data-action="pin-protection-reconnect">Opnieuw verbinden</button>':(pinProtectionError||pending||needsCheck)&&available&&selected?`<button class="text-button" data-action="pin-protection-refresh" ${pinProtectionLoading||pinProtectionBusy?'disabled':''}>Opnieuw controleren</button>`:''}</section>`;
  }
  function syncPinProtectionCard(){
    const old=main.querySelector('[data-pin-protection]'),focused=document.activeElement;
    if(old){old.outerHTML=pinProtectionCard();restoreControlFocus(focused);}
  }
  function verifiedPendingPinStatus(result){
    return !!result&&typeof result==='object'&&[Object.prototype,null].includes(Object.getPrototypeOf(result))&&
      Object.keys(result).sort().join(',')==='desiredPinRequired,hasPin,pinRequired,scope,ssid,status'&&
      result.status==='pending'&&result.scope==='installation'&&typeof result.pinRequired==='boolean'&&
      typeof result.hasPin==='boolean'&&typeof result.desiredPinRequired==='boolean'&&
      typeof result.ssid==='string'&&/^[A-Za-z0-9][A-Za-z0-9 _.-]{0,31}$/.test(result.ssid);
  }
  function pinProtectionScopeKey(standId){
    return JSON.stringify(model.receivers.filter(receiver=>receiver.standId===standId&&receiver.role==='main'&&receiver.lifecycle==='added')
      .map(receiver=>[receiver.id,receiver.rid||null,receiver.deviceFingerprint||null,receiver.physicalId||null]));
  }
  function pinProtectionNeedsRefresh(){
    const cue=pinProtectionRefreshNeeded;
    return cue&&cue.epoch===pinProtectionGeneration&&securityStand()?.id===cue.standId&&
      pinProtectionScopeKey(cue.standId)===cue.scope?cue:null;
  }
  function rememberPinProtectionRead(read,{queue=false}={}){
    if(!read||securityStand()?.id!==read.standId)return;
    // Only a reread cue. No policy, desired PIN, reply or native authority is retained.
    const previous=pinProtectionNeedsRefresh();
    pinProtectionRefreshNeeded={standId:read.standId,scope:pinProtectionScopeKey(read.standId),
      epoch:pinProtectionGeneration,queued:queue||!!previous?.queued};
  }
  function invalidatePinProtectionRead(){
    const cue=pinProtectionNeedsRefresh();pinProtectionGeneration++;
    if(pinProtectionRead)rememberPinProtectionRead(pinProtectionRead);
    if(pinProtectionWrite)rememberPinProtectionRead(pinProtectionWrite);
    if(!pinProtectionRead&&!pinProtectionWrite&&cue)pinProtectionRefreshNeeded={...cue,epoch:pinProtectionGeneration,queued:false};
  }
  function resumeQueuedPinProtectionRead(){
    const cue=pinProtectionNeedsRefresh();
    if(cue?.queued&&!pinProtectionLoading&&!pinProtectionBusy&&document.visibilityState==='visible'&&route.screen==='settings'){
      cue.queued=false;void refreshPinProtection();
    }
  }
  function currentPinProtectionOperation(operation){
    // This is a local stale-UI fence, never native ownership authority.
    return operation.epoch===pinProtectionGeneration&&document.visibilityState==='visible'&&route.screen==='settings'&&
      securityStand()?.id===operation.standId&&pinProtectionScopeKey(operation.standId)===operation.scope;
  }
  function showPinPending(result){
    showEffectDialog('Beveiliging nog in afwachting',`<section class="pin-protection-dialog" data-pin-pending><p>Je eerdere wijziging wordt nog bevestigd. Er wordt geen nieuwe wijziging verstuurd.</p><p>De laatst bevestigde beveiliging staat <b>${result.pinRequired?'aan':'uit'}</b>. De aangevraagde instelling is <b>${result.desiredPinRequired?'aan':'uit'}</b>.</p><p role="status">Controleer opnieuw om de bevestigde status op te halen. Je stand en receivers blijven bewaard.</p><button class="button full" data-action="pin-protection-refresh">Opnieuw controleren</button><button class="button secondary full" data-action="effect-dialog-close">Sluiten</button></section>`);
  }
  function verifiedPinStatus(result){
    return !!result&&['applied','reconnect-required'].includes(result.status)&&typeof result.pinRequired==='boolean'&&typeof result.hasPin==='boolean'&&['installation','new-installation'].includes(result.scope);
  }
  function scheduleContextAfterConfirmedPin(operation){
    if(!operation||typeof runtime?.services?.scheduleInstallationContext!=='function'||!currentPinProtectionOperation(operation)||
      pinProtectionLoading||pinProtectionBusy||pinProtectionRead||pinProtectionWrite||pinProtectionReconnect||
      pinProtectionPendingCheckStandId===operation.standId||pinProtectionNeedsRefresh()||
      pinProtection?.standId!==operation.standId||pinProtection.status!=='applied'||pinProtection.scope!=='installation'||
      pinProtection.pinRequired!==true||pinProtection.hasPin!==true||pinProtection.requiresWifiReconnect===true)return;
    // Only the current, confirmed status reaches the existing archive scheduler.
    // Its queue, debounce, generation and native write barriers remain unchanged.
    try{Promise.resolve(runtime.services.scheduleInstallationContext({standId:operation.standId})).catch(()=>{});}catch(_){}
  }
  async function refreshPinProtection({afterReconnect=false}={}){
    if(simpleStandSupported)return;
    const standId=securityStand()?.id;
    if(!standId||typeof runtime?.services?.securityStatus!=='function')return;
    if(pinProtectionBusy){
      if(pinProtectionWrite&&!currentPinProtectionOperation(pinProtectionWrite)){
        rememberPinProtectionRead({standId},{queue:document.visibilityState==='visible'&&route.screen==='settings'});
        syncPinProtectionCard();
      }
      return;
    }
    if(pinProtectionLoading){
      if(pinProtectionRead&&!currentPinProtectionOperation(pinProtectionRead)){
        rememberPinProtectionRead({standId},{queue:document.visibilityState==='visible'&&route.screen==='settings'});
        syncPinProtectionCard();
      }
      return;
    }
    if(receiverContextStates.get(standId)?.status==='syncing'){pinProtectionDeferredStandId=standId;return;}
    let finishRead,ticket,contextOperation;
    const previousPending=pinProtection?.standId===standId&&pinProtection.status==='pending'?pinProtection:null;
    const form=pinProtectionNeedsRefresh()?document.querySelector('[data-pin-protection-dialog]'):null;
    const obsoleteForm=form?.dataset.stand===standId&&form.querySelector('[data-action="pin-protection-save"]')?.disabled===true?form:null;
    const read={standId,epoch:pinProtectionGeneration,scope:pinProtectionScopeKey(standId),promise:new Promise(resolve=>{finishRead=resolve;})};pinProtectionRead=read;
    const current=()=>pinProtectionRead===read&&currentPinProtectionOperation(read);
    const obsoleteFormCurrent=()=>current()&&obsoleteForm?.isConnected&&obsoleteForm.dataset.stand===standId&&
      document.querySelector('[data-pin-protection-dialog]')===obsoleteForm;
    pinProtectionLoading=true;pinProtectionError='';syncPinProtectionCard();
    try{
      pinProtectionWaitingForLive=true;syncPinProtectionCard();
      ticket=await liveController?.acquireIdle({standId});
      pinProtectionWaitingForLive=false;syncPinProtectionCard();
      if(!current()){rememberPinProtectionRead(read);return;}
      const result=await runtime.services.securityStatus({standId});
      if(!verifiedPinStatus(result)&&!verifiedPendingPinStatus(result))throw Error('SECURITY_UNCONFIRMED');
      if(!current()){rememberPinProtectionRead(read);return;}
      pinProtectionRefreshNeeded=null;
      pinProtection={...result,standId};
      if(verifiedPendingPinStatus(result)){
        pinProtectionPendingCheckStandId=standId;pinProtectionReconnect=null;
        if(obsoleteFormCurrent()||document.querySelector('[data-pin-pending]'))showPinPending(result);
        return;
      }
      if(result.status==='applied'&&result.scope==='installation'&&result.pinRequired===true&&result.hasPin===true)contextOperation=read;
      if(pinProtectionPendingCheckStandId===standId)pinProtectionPendingCheckStandId=null;
      if(obsoleteFormCurrent()){closeEffectDialog();render();}
      if(result.status==='applied')window.AluvisionSecurityMode?.updateFromNative?.({pinRequired:result.pinRequired});
      if(previousPending&&result.status==='applied'){
        if(document.querySelector('[data-pin-pending]')){closeEffectDialog();render();}
        if(result.pinRequired===previousPending.desiredPinRequired)toast(result.pinRequired?'PIN-beveiliging staat aan.':'PIN-beveiliging staat uit.');
      }
      if(afterReconnect&&result.status==='applied'&&result.pinRequired===pinProtectionReconnect?.pinRequired){pinProtectionReconnect=null;closeEffectDialog();render();toast(result.pinRequired?'PIN-beveiliging staat aan.':'PIN-beveiliging staat uit.');return;}
      if(result.status==='reconnect-required')pinProtectionReconnect={...result,standId};
    }catch(error){if(current())pinProtectionError=['LIVE_QUEUE_BUSY','LIVE_QUEUE_SCOPE_BUSY','LIVE_QUEUE_CLEARED'].includes(error?.code)?'Er loopt nog een receiveractie. Laat die eerst afronden en controleer daarna opnieuw.':previousPending?'Nog niet bevestigd. Controleer later opnieuw; je eerdere wijziging wordt niet opnieuw verstuurd.':'Nog niet bevestigd. Verbind met het wifi van je installatie en probeer opnieuw.';else rememberPinProtectionRead(read);}
    finally{
      ticket?.release();if(pinProtectionRead===read)pinProtectionRead=null;
      pinProtectionWaitingForLive=false;pinProtectionLoading=false;finishRead();syncPinProtectionCard();
      scheduleContextAfterConfirmedPin(contextOperation);
      resumeQueuedPinProtectionRead();
    }
  }
  function openPinProtection(){
    if(simpleStandSupported)return;
    const current=pinProtection?.standId===securityStand()?.id?pinProtection:null;if(!current||pinProtectionBusy||current.status==='pending'||pinProtectionPendingCheckStandId===current.standId||pinProtectionNeedsRefresh())return;
    const enabled=!current.pinRequired,needsPin=enabled&&current.scope==='installation'&&!current.hasPin;
    showEffectDialog(enabled?'PIN-beveiliging aanzetten?':'PIN-beveiliging uitzetten?',`<section class="pin-protection-dialog" data-pin-protection-dialog data-enabled="${enabled}" data-stand="${esc(current.standId)}"><p>${enabled?(current.scope==='new-installation'?'Je kiest je PIN tijdens het instellen van je stand.':current.hasPin?'Je bestaande PIN wordt opnieuw gebruikt voor wifi en netwerk verwijderen.':'Beveilig het wifi van je installatie met één PIN.'):'Het receiver-wifinetwerk wordt open. Je stand, zones en koppelingen blijven bewaard.'}</p>${needsPin?'<label class="dialog-field">Kies je PIN · 8–12 cijfers<input data-security-pin type="password" inputmode="numeric" autocomplete="off" minlength="8" maxlength="12" pattern="[0-9]{8,12}" autocapitalize="off" spellcheck="false"></label><label class="dialog-field">Herhaal je PIN<input data-security-pin-repeat type="password" inputmode="numeric" autocomplete="off" minlength="8" maxlength="12" pattern="[0-9]{8,12}" autocapitalize="off" spellcheck="false"></label><small>Bewaar je PIN: voor wifi en netwerk verwijderen.</small>':''}<p class="dialog-error" role="alert" hidden></p><div class="pin-protection-actions"><button class="button secondary full" data-action="effect-dialog-close">Annuleren</button><button class="button full" data-action="pin-protection-save" ${needsPin?'disabled':''}>${enabled?'Aanzetten':'Uitzetten'}</button></div></section>`);
  }
  function showPinReconnect(result){
    showEffectDialog('Verbind opnieuw met wifi',`<section class="pin-protection-dialog" data-pin-reconnect><span class="menu-icon" aria-hidden="true">${icon('lock')}</span><p>${result.unconfirmed===true?'De wijziging is nog niet bevestigd. Tijdens het aanpassen van wifi kan de verbinding even wegvallen.':'Het wifi van je installatie wordt aangepast.'} Je stand en receivers blijven bewaard.</p><ol><li>Open <b>Instellingen → Wifi</b>.</li><li>Kies ${result.ssid?`<b>${esc(result.ssid)}</b>`:'het ALUVISION-wifi van je installatie'}${result.pinRequired?' en gebruik je PIN':' zonder wachtwoord'}.</li><li>Kom terug naar de app.</li></ol><p role="status">We controleren de verbinding zodra je terugkomt.${result.unconfirmed===true?' De beveiliging staat pas bevestigd aan of uit na die controle.':''}</p><button class="button secondary full" data-action="pin-protection-recheck">Verbinding controleren</button></section>`);
  }
  async function savePinProtection(button){
    if(simpleStandSupported)return;
    const panel=document.querySelector('[data-pin-protection-dialog]');if(!panel||pinProtectionBusy||pinProtection?.status==='pending'||pinProtectionPendingCheckStandId===securityStand()?.id||pinProtectionNeedsRefresh())return;
    const enabled=panel.dataset.enabled==='true',standId=panel.dataset.stand,pin=panel.querySelector('[data-security-pin]')?.value;
    if(standId!==securityStand()?.id)return;
    if(pin!==undefined&&(!/^\d{8,12}$/.test(pin)||pin!==panel.querySelector('[data-security-pin-repeat]')?.value))return;
    const operation={standId,epoch:pinProtectionGeneration,scope:pinProtectionScopeKey(standId)};pinProtectionWrite=operation;
    const current=()=>pinProtectionWrite===operation&&currentPinProtectionOperation(operation)&&panel.isConnected;
    let contextOperation;
    pinProtectionBusy=true;button.disabled=true;button.textContent='Beveiliging aanpassen…';
    panel.querySelectorAll('input').forEach(input=>{input.disabled=true;});
    try{
      const result=await runtime.services.setPinProtection({standId,enabled,...(pin===undefined?{}:{pin}),...(enabled?{}:{confirmation:'DISABLE_PIN'})});
      const pending=verifiedPendingPinStatus(result);
      if(!pending&&(!verifiedPinStatus(result)||result.pinRequired!==enabled))throw Error('SECURITY_UNCONFIRMED');
      panel.querySelectorAll('input').forEach(input=>{input.value='';});
      if(!current()){rememberPinProtectionRead(operation);return;}
      if(pending)pinProtectionPendingCheckStandId=standId;
      if(pending){pinProtection={...result,standId};pinProtectionReconnect=null;pinProtectionError='';showPinPending(result);return;}
      pinProtection={...result,standId};
      if(result.status==='reconnect-required'||result.requiresWifiReconnect===true){pinProtectionReconnect={...result,standId};showPinReconnect(result);}
      else {
        if(result.status==='applied'&&result.scope==='installation'&&result.pinRequired===true&&result.hasPin===true)contextOperation=operation;
        pinProtectionBusy=false;window.AluvisionSecurityMode?.updateFromNative?.({pinRequired:result.pinRequired});closeEffectDialog();render();toast(enabled?'PIN-beveiliging staat aan.':'PIN-beveiliging staat uit.');
      }
    }catch(cause){
      if(!current()){rememberPinProtectionRead(operation);return;}
      if(cause?.code==='PIN_MODE_RECONNECT_UNCONFIRMED'&&pinProtection?.standId===standId&&pinProtection.scope==='installation'){
        // Native confirms only the saved intent + dispatched uncertain SET,
        // never its result. Do not flip the switch or repeat the mutation.
        panel.querySelectorAll('input').forEach(input=>{input.value='';});
        pinProtectionReconnect={standId,pinRequired:enabled,ssid:pinProtection.ssid,unconfirmed:true};
        showPinReconnect(pinProtectionReconnect);return;
      }
      const error=panel.querySelector('.dialog-error');error.textContent=cause?.code==='OTA_PENDING'
        ?'Er is nog een software-update in deze stand niet afgerond. Controleer die eerst bij Receivers → Softwareversie en updates. De PIN-beveiliging is niet gewijzigd.'
        :cause?.code==='OTA_BUSY'?'Er wordt software bijgewerkt. Wacht tot de update klaar is. De PIN-beveiliging is niet gewijzigd.'
        :'De wijziging is nog niet bevestigd. Je stand en receivers zijn niet gewist. Controleer de verbinding en probeer opnieuw.';error.dataset.closedCategory=['OTA_PENDING','OTA_BUSY','PIN_MODE_UNCONFIRMED','PIN_MODE_UPDATE_REQUIRED','PIN_MODE_INVALID','PIN_MODE_PROFILE','PIN_MODE_PENDING'].includes(cause?.code)?cause.code:'NATIVE_UNCONFIRMED';error.hidden=false;
      panel.querySelectorAll('input').forEach(input=>{input.disabled=false;});button.disabled=false;button.textContent='Opnieuw proberen';
    }finally{
      if(pinProtectionWrite===operation)pinProtectionWrite=null;
      pinProtectionBusy=false;syncPinProtectionCard();scheduleContextAfterConfirmedPin(contextOperation);resumeQueuedPinProtectionRead();
    }
  }
  // Browser walkthrough only: no network service, credential field or native
  // bridge call is exposed by these example settings.
  function demoSettingsTabs(wifi=false){
    return `<div class="section-tabs demo-settings-tabs" role="group" aria-label="Instellingen"><button data-action="demo-settings-tab" data-id="settings" aria-pressed="${!wifi}">${icon('settings')}Algemeen</button><button data-action="demo-settings-tab" data-id="wifi" aria-pressed="${wifi}">${icon('wifi')}Wifi</button></div>`;
  }
  function renderDemoWifi(){
    if(!webDemoContext)return renderSettings();
    return `<div class="page demo-wifi-page"><header class="page-heading"><div><h1>Wifi-instellingen</h1><p>${esc(t('settings'))} · V41</p></div></header>${demoSettingsTabs(true)}<section class="card demo-wifi-notice" aria-labelledby="demo-wifi-title"><span class="pill red">DEMO · niet verbonden</span><h2 id="demo-wifi-title">Alleen een voorbeeld</h2><p>Hier bekijk je de wifi-instellingen. Deze demo zoekt geen echte netwerken, maakt geen verbinding en bewaart geen wifi-wachtwoorden. PIN en delen via QR-code staan in deze tijdelijke ééngebruikerstest uit.</p></section><section class="card demo-wifi-network"><div class="demo-wifi-heading"><span class="menu-icon" aria-hidden="true">${icon('wifi')}</span><div><h2>Wifi van je installatie</h2><p>Je telefoon bedient de verlichting via dit netwerk.</p></div></div><dl class="demo-wifi-details"><div><dt>Netwerk</dt><dd>Aluvision-DEMO</dd></div><div><dt>Status</dt><dd>Voorbeeld · geen echte verbinding</dd></div></dl><button class="button full" disabled aria-describedby="demo-wifi-disabled">Verbinding controleren</button><p id="demo-wifi-disabled" class="demo-wifi-caption">Alleen beschikbaar met een echte receiver in een ondersteunde app.</p></section><section class="card demo-wifi-guide"><h2>Verbinden in de echte app</h2><ol><li>Open <b>Instellingen → Wifi</b> op je iPhone.</li><li>Kies het ALUVISION-wifi van je installatie.</li><li>Ga terug naar de app om je verlichting te bedienen.</li></ol><p>Je hoeft voor deze demo niets aan je wifi te veranderen.</p></section></div>`;
  }
  function renderSettings() {
    return `<div class="page settings-page"><header class="page-heading overview-heading settings-overview-heading"><div><h1>${esc(t('settings'))}</h1></div></header><section class="card settings-appearance"><h2 class="settings-appearance-heading">${icon('settings')}<span>${esc(t('appearance'))}</span></h2><h3 class="preference-label">${esc(t('language'))}</h3><div class="preference-grid">${Preferences.languages.map(language=>`<button data-action="language" data-id="${language.code}" lang="${language.code}" aria-pressed="${uiPreferences.preferences.language===language.code}">${language.name}</button>`).join('')}</div>${uiPreferences.preferences.language==='nl'?'':`<p class="preference-note">${esc(t('wipNotice'))}</p>`}<h3 class="preference-label">${esc(t('theme'))}</h3><div class="preference-grid">${['light','dark'].map(theme=>`<button data-action="theme" data-id="${theme}" aria-pressed="${uiPreferences.preferences.theme===theme}">${icon(theme==='dark'?'moon':'sun')}${esc(t(theme))}</button>`).join('')}</div>${uiPreferences.error?`<p role="alert">${esc(uiPreferences.error.message)}</p>`:''}</section><button class="menu-card settings-help-entry" data-action="help"><span class="menu-icon">${icon('info')}</span><div><b>Stand en zones uitgelegd</b><small>Zo organiseer je je verlichting</small></div>${icon('chevron')}</button></div>`;
  }
  function organizeSettings() {
    const page=main.querySelector('.settings-page');if(!page)return;
    const group=(className,key,selectors)=>{
      const section=document.createElement('section');section.className=className;
      const title=document.createElement('h2');title.className='settings-group-title settings-group-heading';title.id=className+'-title';title.textContent=t(key);
      section.setAttribute('aria-labelledby',title.id);section.append(title);
      for(const selector of selectors){const item=page.querySelector(selector);if(item)section.append(item);}
      page.append(section);
    };
    // Move the existing controls rather than duplicating them. Their native
    // status/disabled guards and async save lifecycle stay authoritative.
    group('settings-installation','settingsInstallation',['[data-stand-connection]','[data-pin-protection]','.pin-login-entry','[data-backup-panel]','[data-action="help"]']);
    group('settings-app-tools','settingsThisApp',['.settings-appearance','[data-action="preferences-reset"]']);
    const erase=page.querySelector('.app-erase-section');if(erase)page.append(erase);
  }
  function render({top=false,preserveScroll=true}={}) {
    if(firstAccessCheckpoint)route={...route,screen:'receiver-add',standId:firstAccessCheckpoint.standId,zoneId:null,setupFrom:'stand'};
    const sharingVisible=route.screen==='stand-sharing'&&standSharingMode==='share'||route.screen==='stand-connect'&&standConnectionIntent==='open'&&standSharingMode==='join';
    if(!sharingVisible&&standSharingMode!==null){standSharingMode=null;void standSharingController?.cancel().catch(()=>{});}
    if(simpleStandMode)flushCentralProjection();
    // Apply local presentation before loading/error early returns as well.
    // The optional native appearance acknowledgement remains in the loaded
    // path below; this does not start any native or receiver work earlier.
    document.documentElement.lang=uiPreferences.preferences.language;
    document.body.dataset.theme=uiPreferences.preferences.theme;
    document.querySelector('meta[name="theme-color"]').content=uiPreferences.preferences.theme==='dark'?'#171817':'#f8f8f5';
    if(activeControlPointer){
      if(!top&&activeControlPointer.context===motionContextKey()&&activeControlPointer.target.isConnected){controlRenderDeferred=true;return;}
      activeControlPointer=null;controlRenderDeferred=false;
    }
    // A replaced handle no longer represents an active drag. Cancel before
    // rebuilding the page, so a later pointerup cannot save a stale position.
    inlineOrderDrag?.refresh();
    if(inlineOrderDrag?.isActive()){
      // An ordinary status redraw must not replace the captured handle or
      // close the active editor. Navigation still cancels the interaction.
      if(!top&&lastRenderedMotionContext===motionContextKey()){orderRenderDeferred=true;return;}
      inlineOrderDrag.cancel();
    }
    if(dragOrder)finishOrder({pointerId:dragOrder.pointerId},true);
    // A real navigation/rebuild ends only this explicit STATIC gesture. A
    // status repaint above still defers while its captured wheel is active.
    if(activeStaticGesturePointer!==null){activeStaticGesturePointer=null;releaseStaticFeedbackHold();liveController?.endGesture();}
    const savedScroll=window.scrollY;
    // These native <details> are not model data. A status repaint in the
    // SAME screen must not close them; real navigation starts closed.
    const keepDisclosures=!top&&lastRenderedMotionContext===motionContextKey();
    const keepCompactPreview=keepDisclosures&&main.querySelector('.control-preview-dock')?.dataset.scrolled==='true';
    const disclosureState=keepDisclosures?Array.from(main.querySelectorAll('details')).map(details=>({
      classes:details.className,receiver:details.closest('[data-receiver-detail]')?.dataset.receiverDetail||'',
      open:details.open
    })):[];
    if(!nativeLoaded){
      main.innerHTML=`<div class="page"><header class="page-heading"><div><h1>${nativeLoadError?'Je gegevens openen':'Je stand openen…'}</h1><p>${nativeLoadError?'Je bewaarde instellingen konden nog niet veilig worden gelezen. Er is niets vervangen of gewist.':'Je bewaarde stand en instellingen worden geladen.'}</p></div></header>${nativeLoadError?'<button class="button full" data-action="native-load-retry">Opnieuw proberen</button>':''}</div>`;
      document.getElementById('navigation').replaceChildren();return;
    }
    if(route.screen==='demo-wifi'&&!webDemoContext)route.screen='settings';
    if(!model.stands.length&&!['stand','scenes','settings','demo-wifi','pin-login','stand-connect','stand-sharing','receivers','receiver-add'].includes(route.screen))route.screen='stand';
    if(['controls','colour','animations','effects','animation-family','layout'].includes(route.screen)&&!zone()){
      // Another client may have removed the zone while a native edit was in
      // flight. Never leave an impossible draft trapping the user here.
      openLineSetup.delete(route.zoneId);arrangementDraft=null;
      route={...route,screen:'stand',zoneId:null};toast(t('lineSetupChanged'));
    }
    const animationEditorOpen=route.screen==='animations'||(route.screen==='controls'&&controlMode==='animations'&&!showControlAnimationGallery);
    const visibleEffect=animationEditorOpen?activeEffect():null;
    // No empty animation landing page. This also covers switching from an
    // animated receiver to a static one while its editor is already open.
    if(route.screen==='animations'&&zone()&&receivers().length&&!activeEffect()){
      route={...route,screen:'effects',family:null,library:initialAnimationLibrary(),effectsReturn:'controls'};top=true;
    }
    const nextMotionContext=motionContextKey();
    const animatePage=lastRenderedMotionContext!==null&&nextMotionContext!==lastRenderedMotionContext&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    lastRenderedMotionContext=nextMotionContext;
    const focused=document.activeElement,focusKey=focused?.dataset?.id;
    const activeEditor=keepDisclosures&&main.contains(focused)&&focused.matches?.('input,textarea,select')?{
      tag:focused.tagName,id:focused.id,type:focused.type,dataset:JSON.stringify(focused.dataset),value:focused.value,
      start:focused.selectionStart,end:focused.selectionEnd,direction:focused.selectionDirection
    }:null;
    previews.clear();
    const views = {stand:renderStand,controls:renderControls,colour:renderColour,animations:renderAnimations,effects:renderEffects,'animation-family':renderAnimationFamily,receivers:renderReceivers,settings:renderSettings,'demo-wifi':renderDemoWifi,'pin-login':renderPinLogin,'stand-connect':renderStandConnection,'stand-sharing':renderStandSharing,'stand-code-change':renderStandCodeChange,scenes:renderScenes,'scene-draft':renderSceneDraft,'scene-detail':renderSceneDetail,'receiver-add':renderReceiverAdd};
    const zoneScreen=['controls','colour','animations','effects','animation-family','layout'].includes(route.screen);
    main.innerHTML = (zoneScreen&&zone()&&!receivers().length?renderEmptyZone:(views[route.screen] || renderStand))();
    if(route.screen==='stand'&&stand()&&standSharingAvailable&&standConnectionState.status==='connected'){
      main.querySelector('.stand-page .overview-heading')?.insertAdjacentHTML('afterend',`<button class="button secondary full stand-share-entry" data-action="stand-share-open">${icon('share')} Deel deze stand</button>`);
    }
    const sharingHost=main.querySelector('[data-stand-sharing-host]');
    if(sharingHost)ensureStandSharing().mount(sharingHost);
    if(keepDisclosures){
      const used=new Set();
      for(const previous of disclosureState){
        const matching=Array.from(main.querySelectorAll('details')).find(details=>!used.has(details)&&
          details.className===previous.classes&&(details.closest('[data-receiver-detail]')?.dataset.receiverDetail||'')===previous.receiver);
        if(matching){matching.open=previous.open;used.add(matching);}
      }
    }
    orderRecognitionDirty=true;
    if(animatePage){
      const entering=main.firstElementChild;
      if(entering){
        entering.classList.add('app-page-enter');
        const finishEntering=event=>{
          if(event.target!==entering)return;
          entering.classList.remove('app-page-enter');entering.removeEventListener('animationend',finishEntering);
          measureControlPreviewDock();
        };
        entering.addEventListener('animationend',finishEntering);
      }
    }
    const previewDock=main.querySelector('.control-preview-dock');
    if(previewDock){const spatial=previewDock.querySelector('.spatial-preview-wrap')!==null;previewDock.dataset.previewSize=spatial?'large':controlPreviewSize;previewDock.dataset.spatialPreview=spatial?'true':'false';if(keepCompactPreview)previewDock.dataset.scrolled='true';}
    main.classList.toggle('gallery-scroll-stable',Boolean(main.querySelector('#animation-results')));
    if(route.screen==='scene-detail')main.querySelector('.scene-activate-bar')?.insertAdjacentHTML('afterbegin','<p class="live-confirmation" data-live-status="scene" role="status" aria-live="polite"></p>');
    if(route.screen==='settings')main.querySelector('.page-heading')?.insertAdjacentHTML('afterend',pinProtectionCard());
    if(route.screen==='settings'&&Backup)main.querySelector('[data-action="help"]')?.insertAdjacentHTML('afterend',backupPanel());
    if(route.screen==='stand'&&model.stands.length>1)main.querySelector('.page-heading')?.insertAdjacentHTML('afterend','<button class="text-button" data-action="stand-switch-open">Andere stand openen</button>');
    if(!simpleStandMode&&route.screen==='settings'&&nativeContext&&window.__lightningV32ReceiverContext===true&&standReceivers().length){
      main.querySelector('[data-backup-panel]')?.insertAdjacentHTML('afterend',receiverContextPanel());
      syncReceiverContextPanel();readReceiverContextStatus();
    }
    if(!simpleStandSupported&&(pinRequired()||nativeContext)&&route.screen==='settings')main.querySelector('[data-action="help"]')?.insertAdjacentHTML('afterend',
      `<button class="menu-card pin-login-entry" data-action="pin-login"><span class="menu-icon">${icon('lock')}</span><div><b>Inloggen met PIN</b><small>Je bestaande installatie openen</small><small class="pin-login-availability">${pinLoginAvailable?'Je PIN is ook je wifi-wachtwoord':'Controleer de toegang tot je stand'}</small></div>${icon('chevron')}</button>`);
    if(route.screen==='settings')main.querySelector('[data-action="help"]')?.insertAdjacentHTML('afterend',`<button class="menu-card" data-action="preferences-reset"><span class="menu-icon">${icon('settings')}</span><div><b>Taal en thema herstellen</b><small>Alleen taal en thema van deze app</small></div>${icon('chevron')}</button>`);
    if(route.screen==='settings')main.querySelector('[data-action="preferences-reset"]')?.insertAdjacentHTML('afterend',simpleStandMode?`<section class="card app-erase-section"><h2>Op deze telefoon</h2><p>Vergeten wist niets op de hoofdreceiver.</p><button class="button secondary full" data-action="stand-forget" ${stand()?'':'disabled'}>Stand vergeten op deze telefoon</button></section>`:`<section class="card app-erase-section"><h2>Gegevens op deze telefoon</h2><p>Dit verwijdert alleen de gegevens in de app. De fysieke receivers blijven gekoppeld en zijn daarna mogelijk pas na een afzonderlijke reset en nieuwe koppeling weer bedienbaar.</p><button class="button secondary full" data-action="app-erase">Verwijder alles uit de app</button></section>`);
    if(route.screen==='stand')main.querySelectorAll('.stand-summary>div').forEach((tile,index)=>{
      const button=document.createElement('button');button.type='button';button.className='stand-info-tile';
      button.dataset.action=index?'stand-receivers-info':'stand-zones-info';
      button.setAttribute('aria-label',index?'Ledlines in deze stand bekijken':'Zones in deze stand bekijken');
      button.innerHTML=tile.innerHTML+icon('chevron');tile.replaceWith(button);
    });
    if(route.screen==='stand-connect'&&(standConnectionIntent==='setup'||standManualEntry)&&simpleStandMode&&simpleStandSupported&&!nativeLoading&&!standNetworkProbeAttempted&&!standConnectionBusy&&!standSession?.canResume()&&!standSession?.snapshot()&&!['connecting','checking','changing-code'].includes(standConnectionState.status)){
      standNetworkProbeAttempted=true;
      queueMicrotask(()=>{if(route.screen==='stand-connect'&&simpleStandMode&&!document.hidden)void inspectCentralStand({automatic:true});});
    }
    if(route.screen==='stand'&&standControlReceivers().length)main.querySelector('.stand-summary')?.insertAdjacentHTML('afterend',
      `<button class="menu-card stand-control-shortcut" data-action="stand-controls"><span class="menu-icon colour-icon" aria-hidden="true"></span><span><b>Alles bedienen</b><small>Alle zones · kleur en animaties</small></span>${icon('chevron')}</button>`);
    if(route.screen==='stand'&&stand()&&!stand().zones.length)main.querySelector('.zone-grid')?.insertAdjacentHTML('beforeend',
      '<section class="card empty"><h2>Nog geen zones</h2><p>Maak een nieuwe zone voor een plek in je stand. Daarna kun je bestaande receivers aan die zone toewijzen of een nieuwe receiver toevoegen.</p></section>');
    if(webDemoContext&&route.screen==='settings'){
      main.querySelector('.page-heading')?.insertAdjacentHTML('afterend',demoSettingsTabs());
      const erase=main.querySelector('.app-erase-section');
      if(erase)erase.querySelector('p').textContent='Alleen deze tijdelijke demopagina wordt leeg gemaakt. Echte receivers en gegevens op de gewone site blijven onaangeroerd.';
    }
    if(route.screen==='settings')organizeSettings();
    main.querySelectorAll('[data-receiver-detail], .ledline-row-settings:not([hidden])').forEach(card=>{
      const inline=card.matches('.ledline-row-settings'),receiverId=inline?card.closest('[data-draft-receiver]')?.dataset.draftReceiver:card.dataset.receiverDetail;
      const r=model.receivers.find(receiver=>receiver.id===receiverId);if(!r)return;
      if(r.type==='SPI'&&!r.outputs.some(output=>output.enabled)){
        const blink=(inline?card.parentElement:card).querySelector('[data-action="visual-identify"]');if(blink)blink.disabled=true;
      }
      if(inline)card.querySelector('.ledline-settings-context').insertAdjacentHTML('afterend',`<p class="receiver-status">${esc(statusText(r))}</p>`);
      else card.querySelector('summary small').insertAdjacentHTML('afterend',`<small class="receiver-status">${statusText(r)}</small>`);
      if(nativeContext&&runtime?.native===true&&typeof runtime.services?.otaPlan==='function')card.querySelector('.receiver-manage-content').insertAdjacentHTML('beforeend',`<section class="receiver-service-section" aria-label="Receiver en software"><h3>${esc(t('softwareUpdateSection'))}</h3><p>${esc(t('softwareUpdateSubtitle'))}</p><button class="button secondary full" data-action="receiver-update" data-id="${esc(r.id)}">${esc(t('softwareUpdates'))}</button></section>`);
      card.querySelector('.receiver-manage-content').insertAdjacentHTML('beforeend',`<section class="receiver-danger-section" aria-label="Receiver verwijderen"><h3>${r.role==='main'?'Alle receivers ontkoppelen':'Deze receiver ontkoppelen'}</h3><p>${r.role==='main'?'Hiermee verwijder je het volledige receivernetwerk.':'Hiermee verwijder je alleen deze receiver uit het netwerk.'}</p><button class="button secondary full" data-action="receiver-remove" data-id="${esc(r.id)}">${r.role==='main'?'Alle receivers ontkoppelen':'Deze receiver ontkoppelen'}</button></section>`);
    });
    if(zoneScreen&&zone()?.type===null)main.querySelector('.page-heading .pill')?.remove();
    if(route.screen==='stand-connect'&&standConnectionState.status==='migration-required'&&standMigrationReady&&!standReceiverManagementAvailable)
      main.querySelector('[data-action="stand-migrate-submit"]')?.insertAdjacentHTML('beforebegin',`<p data-stand-receiver-management-notice role="status">${esc(standReceiverNotice)}</p>`);
    if(standReceiverManagementUnavailable()){
      for(const button of main.querySelectorAll('button[data-action]'))if(standReceiverActions.has(button.dataset.action)&&standReceiverActionUnavailable(button.dataset.action,button)){
        button.disabled=true;button.title=standReceiverNotice;
      }
      const target=main.querySelector('.receiver-toolbar,.ledline-setup-body,.empty-zone-page .zone-start-card');
      if(target)target.insertAdjacentHTML('afterbegin',`<p data-stand-receiver-management-notice role="status">${esc(standReceiverNotice)}</p>`);
    }
    if(nativeContext&&window.__lightningV32Appearance===true)
      runtime?.services?.setAppearance?.({theme:uiPreferences.preferences.theme}).catch(()=>{});
    // Replace the old fixed shortcuts and read-only order list with their
    // interactive counterparts, without rebuilding the established editors.

    if(route.screen==='animations'||(route.screen==='controls'&&controlMode==='animations'&&activeEffect()&&!showControlAnimationGallery)){
      const effect=activeEffect(),state=selectedState(),panel=main.querySelector('#animation-settings');
      if(panel){
        panel.insertAdjacentHTML('beforeend',['bounce','mirror'].filter(key=>effect?.controls.includes(key)).map(key=>`<div class="boolean-setting"><button class="option-toggle" data-action="effect-boolean" data-id="${key}" aria-pressed="${state[key]===true}"><span>${key==='bounce'?'↔ Heen en weer':'← · → Spiegelen'}</span><b>${state[key]===true?'Aan':'Uit'}</b></button>${resetMarkup(key,key==='bounce'?'Heen en weer':'Spiegelen')}</div>`).join(''));
        panel.querySelector('.compact-direction')?.insertAdjacentHTML('afterend',resetMarkup('direction','Bewegingsrichting'));
      }
    }
    contextObserver?.disconnect();
    const context=main.querySelector('.control-context');
    if(context)context.dataset.page=route.screen;
    measureControlPreviewDock();
    // Compacting animates the dock's padding as well as its content. Observe
    // its whole box so the final scroll margin follows both animations.
    if(previewDock){contextObserver=new ResizeObserver(measureControlPreviewDock);contextObserver.observe(previewDock,{box:'border-box'});}
    const current = route.screen.startsWith('scene')?'scenes':route.screen==='receiver-add'?route.setupFrom||'stand':['pin-login','stand-connect','stand-sharing','stand-code-change','demo-wifi'].includes(route.screen)?'settings':['receivers','settings'].includes(route.screen)?route.screen:'stand';
    document.getElementById('navigation').toggleAttribute('data-first-entry',!stand()&&!onboarding.summary()?.stand&&['stand','stand-connect','stand-sharing'].includes(route.screen));
    const connectionEntry=route.screen==='stand-connect'&&standConnectionState.status!=='connected';
    const hideNavigation=!!firstAccessCheckpoint||connectionEntry||!stand()&&!onboarding.summary()?.stand&&route.screen==='stand';
    document.getElementById('navigation').hidden=hideNavigation;
    document.getElementById('navigation').innerHTML=hideNavigation?'':[['stand','stand','stand'],['scenes','scenes','scenes'],['receivers','receivers','receiver'],['settings','more','settings']].map(([id,label,glyph])=>`<button data-action="nav" data-id="${id}" ${current===id?'aria-current="page"':''}>${icon(glyph)}<span>${esc(t(label))}</span></button>`).join('');
    translateMainControls();
    if(route.screen==='receiver-add')onboarding.mount(main.querySelector('#receiver-onboarding'),{origin:route.setupReturnZoneId?'layout':current,activeZoneId:stand()?.zones.some(z=>z.id===route.zoneId)?route.zoneId:undefined,autoSearch:!!route.setupReturnZoneId});
    if(route.screen==='stand'&&stand())main.querySelector('.page').classList.add('stand-page');
    if(route.screen==='scene-draft'){syncSceneDraft();filterSceneZones('draft');}
    if(route.screen==='scene-detail'){
      filterSceneZones('detail');
      if(savedScenes.scenes.some(scene=>scene.id===route.sceneId&&scene.standId===stand()?.id))
        main.querySelector('.page-heading')?.insertAdjacentHTML('afterend',`<button class="text-button scene-rename" data-action="scene-rename" data-id="${esc(route.sceneId)}">${icon('edit')} Naam wijzigen</button>`);
    }
    document.title = `${main.querySelector('h1')?.textContent || 'Aluvision'} · Aluvision Lighting`;
    // The colour picker now also lives inline on the zone-control screen.
    // Initialise whichever picker is actually present instead of tying its
    // canvas drawing to the old, standalone colour route.
    if(main.querySelector('[data-colour-picker] canvas.wheel')){paintWheel();syncColour();}
    syncPresetAvailability();
    for(const id of identifyPending.keys())syncIdentifyControls(id);
    syncLiveStatus();
    syncControlLocation();
    paint(performance.now()/1000);
    // Rebuilding a category row must not hide its selected tab offscreen.
    // Adjust only its horizontal scroll, never the surrounding document.
    main.querySelectorAll('.filter-row [aria-selected="true"],.receiver-chips [aria-pressed="true"]').forEach(selected=>{
      const row=selected.closest('.filter-row,.receiver-chips'),bounds=row.getBoundingClientRect(),item=selected.getBoundingClientRect();
      if(item.left<bounds.left+4)row.scrollLeft-=bounds.left+4-item.left;
      else if(item.right>bounds.right-4)row.scrollLeft+=item.right-bounds.right+4;
    });
    if(top){window.scrollTo({top:0,left:0,behavior:'instant'});updateControlPreviewDensity();main.focus({preventScroll:true});}
    else {
      if(preserveScroll)window.scrollTo({top:savedScroll,left:0,behavior:'instant'});
      updateControlPreviewDensity();
      if(activeEditor){
        const next=Array.from(main.querySelectorAll('input,textarea,select')).find(element=>element.tagName===activeEditor.tag&&element.id===activeEditor.id&&element.type===activeEditor.type&&JSON.stringify(element.dataset)===activeEditor.dataset);
        if(next&&!next.disabled){
          // Preserve unfinished text, never replay a lighting/model mutation.
          if(['text','search','number'].includes(next.type)||next.tagName==='TEXTAREA')next.value=activeEditor.value;
          next.focus({preventScroll:true});
          if(activeEditor.start!==null)try{next.setSelectionRange(activeEditor.start,activeEditor.end,activeEditor.direction);}catch(_){}
        }
      }else if(!restoreControlFocus(focused)&&focusKey)document.querySelector(`[data-order-receiver="${CSS.escape(focusKey)}"] .order-handle`)?.focus({preventScroll:true});
    }
  }
  function restoreControlFocus(previous,host=document) {
    if(!previous?.matches?.('button[data-action]'))return false;
    const keys=['action','id','receiver','port'];
    const same=previous.isConnected&&host.contains(previous)?previous:Array.from(host.querySelectorAll('button[data-action]')).find(button=>keys.every(key=>button.dataset[key]===previous.dataset[key]));
    if(!same||same.disabled)return false;
    same.focus({preventScroll:true});return true;
  }
  let receiverSetupPreparation=null;
  async function openManagedReceiverSetup(extra,options){
    if(receiverSetupPreparation||managementBusy)return;
    const standId=stand()?.id,previous=route;
    if(!standId||typeof runtime.services?.prepareReceiverManagement!=='function')return toast('Open eerst je stand opnieuw.');
    const token={standId};receiverSetupPreparation=token;
    toast('Actuele receivers en inrichting laden…');
    try{
      const view=await runtime.services.prepareReceiverManagement({standId});
      if(receiverSetupPreparation!==token||route!==previous||stand()?.id!==standId||document.hidden)return;
      await ensureStandSession().acceptMembership(view.central);
      if(receiverSetupPreparation!==token||route!==previous||document.hidden)return;
      receiverSetupPreparation=null;flushCentralProjection();
      if(view.draft)onboarding.restore(view.draft);
      navigate('receiver-add',extra,{...options,managedPrepared:true});
    }catch(error){
      if(route===previous&&!document.hidden)toast(error?.code==='STAND_CONFIG_CONFLICT'?'De stand is op een ander toestel veranderd. Open hem opnieuw; er is niets toegevoegd.':'De actuele receiverlijst is nog niet bevestigd. Controleer de verbinding en probeer opnieuw.');
    }finally{if(receiverSetupPreparation===token)receiverSetupPreparation=null;flushCentralProjection();}
  }
  function navigate(screen, extra={}, {restoreControls=false,managedPrepared=false}={}) {
    if(firstAccessCheckpoint&&screen!=='receiver-add')return;
    if(screen==='receiver-add'&&localStandConcept())prepareLocalStandReceiver(extra.setupReturnZoneId||extra.zoneId||route.zoneId);
    if(screen==='receiver-add'&&route.screen!=='receiver-add'&&simpleStandMode&&centralApplied&&!managedPrepared){void openManagedReceiverSetup(extra,{restoreControls});return;}
    // Compatibility for internal callers; layout is now a panel, not a page.
    const requestedLayout=screen==='layout';if(requestedLayout)screen='controls';
    if(arrangementApplying)return;
    if(route.screen==='stand-connect'&&screen!=='stand-connect')standMigrationPreflightError=null;
    if(route.screen==='stand-connect'&&screen!=='stand-connect'&&legacyStandReturn&&!standMigrationReady&&!standConnectionBusy&&
       !standSession?.snapshot()&&!standSession?.canResume()&&!centralApplied&&!centralPending&&
       legacyStandReturn.standId===legacyStandLandingId&&legacyStandReturn.standId===stand()?.id){
      // Only restore the exact pre-existing presentation after leaving a
      // public check. This does not open a channel, dispatch or grant access.
      simpleStandMode=false;legacyStandReturn=null;
    }
    const previousRoute=route;
    if(screen!==route.screen||extra.standId&&extra.standId!==route.standId)invalidatePinProtectionRead();
    if(screen!==route.screen||(extra.zoneId&&extra.zoneId!==route.zoneId))closeZoneMenus();
    if(screen!==route.screen)visualPlugMotions.clear();
    if(!pinRequired()&&!nativeContext&&screen==='pin-login')screen='settings';
    if(screen==='receiver-add'&&route.screen!=='receiver-add')extra={setupFrom:!stand()||!standReceivers().some(receiver=>receiver.role==='main')||route.screen!=='receivers'?'stand':'receivers',setupReturnZoneId:null,...extra};
    if(screen!=='animation-family')extra={family:null,familyReturnScreen:null,...extra};
    if(route.screen==='receiver-add')onboarding.suspend();route = {...route,screen,...extra};
    const changedZone=route.zoneId!==previousRoute.zoneId;
    if(changedZone){
      // Filters belong to the zone being browsed, not the last zone opened.
      // Do not touch receiver selection, saved light or same-zone navigation.
      route={...route,family:null,library:initialAnimationLibrary()};
      settingsOpen=false;showControlAnimationGallery=!activeEffect();
      arrangementDraft=null;
    }
    const enteredZone=screen==='controls'&&(changedZone||!['controls','colour','animations','effects','layout'].includes(previousRoute.screen));
    if(enteredZone&&!restoreControls){settingsOpen=false;++advancedSettingsRevision;}
    if(enteredZone&&activeEffect()&&!restoreControls){controlMode='animations';showControlAnimationGallery=false;}
    if(requestedLayout){openLineSetup.add(route.zoneId);beginArrangement();beginOrderColours();}
    render({top:true});
    if(enteredZone&&controlMode==='animations'&&!showControlAnimationGallery&&!restoreControls)revealAnimationStart();
    if(screen==='settings')void refreshPinProtection();
  }
  function resetMarkup(key,label) { return `<button class="setting-reset" data-action="setting-reset" data-id="${key}" aria-label="${esc(label)} terug naar standaard" ${settingChanged(key)?'':'hidden'}>↺ Standaard</button>`; }
  function translateMainControls() {
    // Only known UI controls: never walk and replace arbitrary text or names.
    main.querySelector('.scene-draft-page')?.classList.toggle('is-editing',Boolean(sceneDraft?.sceneId));
    const titles={colour:'staticColour',animations:'animations',scenes:'scenes','scene-draft':sceneDraft?.sceneId?'updateScene':'saveScene',receivers:'receivers',settings:'settings','receiver-add':'addReceiver'};
    if(titles[route.screen]&&main.querySelector('h1'))main.querySelector('h1').textContent=t(titles[route.screen]);
    const actions={'scene-new':'newScene','scene-save':sceneDraft?.sceneId?'updateScene':'saveScene','receiver-add':'addReceiver'};
    main.querySelectorAll('button[data-action]').forEach(button=>{
      if(button.hasAttribute('data-setup-resume')&&onboarding.summary()?.stand)return;
      const key=button.dataset.action==='receiver-add'&&!stand()?'setupStand':actions[button.dataset.action];if(!key)return;
      const glyphs=Array.from(button.children).filter(node=>node.tagName.toLowerCase()==='svg');button.replaceChildren(...glyphs,document.createTextNode(t(key)));
    });
    for(const [action,key]of [['colour','staticColour'],['animations','animations']])main.querySelector(`.menu-card[data-action="${action}"] b`)?.replaceChildren(document.createTextNode(t(key)));
    for(const [action,key]of [['controls','controls'],['layout','layout']]){
      const button=main.querySelector(`.section-tabs [data-action="${action}"]`);if(button){const glyph=button.querySelector('svg');button.replaceChildren(...(glyph?[glyph]:[]),document.createTextNode(t(key)));}
    }
    main.querySelectorAll('.my-colours h3').forEach(node=>node.textContent=t('myColours'));
  }
  function liveRequest(receiver,time=performance.now()/1000) {
    const targetZone=model.stands.find(item=>item.id===receiver.standId)?.zones.find(item=>item.id===receiver.zoneId);
    return window.LightningLiveControl?.requestFor?.(receiver,{zone:targetZone,receivers:targetZone?M.zoneReceivers(model,targetZone.id):[receiver],time})||null;
  }
  function liveTargets(scope){
    if(scope==='stand')return standControlReceivers();
    if(scope==='scene'){
      const scene=savedScenes.scenes.find(item=>item.id===route.sceneId&&item.standId===stand()?.id);
      const ids=new Set(scene?.zones.flatMap(item=>item.receivers.map(receiver=>receiver.id))||[]);
      return standReceivers().filter(receiver=>ids.has(receiver.id));
    }
    const ids=new Set(selectedReceiverIds());return receivers().filter(receiver=>ids.has(receiver.id));
  }
  function sendReceiverStates(ids,{remember=true}={}){
    const requested=new Set(ids),standIds=new Set(model.receivers.filter(receiver=>requested.has(receiver.id)).map(receiver=>receiver.standId));
    for(const standId of standIds){
      const members=M.standZoneReceivers(model,standId);
      if(!members.some(receiver=>receiver.state.standAnimation))continue;
      const marker=StandAnimations.active(model,standId);
      const powered=new Set(members.map(receiver=>receiver.state.on!==false&&receiver.state.power!==false));
      if(marker&&powered.size===1){
        // A topology/port change or a lighting resume must refresh the entire
        // shared geometry in one batch, never restart only one zone.
        members.forEach(receiver=>requested.add(receiver.id));
      }else{
        // Individual-zone power or a stale/incoherent recipe is ordinary
        // control again. Keep every other light state; remove only the scope.
        members.forEach(receiver=>{delete receiver.state.standAnimation;});
      }
    }
    if(remember)scheduleLightIntentSave();
    const time=performance.now()/1000;
    for(const id of requested){
      const receiver=model.receivers.find(item=>item.id===id);if(!receiver)continue;
      const request=liveRequest(receiver,time);
      if(nativeLoaded&&liveController&&request)liveController.request(request);
      else if(liveController)liveController.preview(id);
      else liveStates.set(id,{kind:'preview'});
    }
    observeCentralLight(requested);
    return [...requested];
  }
  function observeCentralLight(ids){
    if(!simpleStandMode||!standSession?.snapshot()||!centralLiveCheckpoint)return;
    try{centralLiveCheckpoint.observe(model,[...ids]);}
    catch(error){centralLiveState={...centralLiveState,status:'unconfirmed',error:error?.code||'STAND_SAVE_UNCONFIRMED'};syncStandConnectionStatus();}
  }
  function applyJoinedZonePlayback(next,receiverIds,options){
    const plan=window.LightningLiveControl.joinZonePlayback(model,next,receiverIds,options);
    model=M.assertValid(plan.model);
    if(plan.receiverIds.length)sendReceiverStates(plan.receiverIds);
    return plan;
  }
  function scheduleLightIntentSave(){
    if(!nativeContext||!nativeLoaded||!Backup)return;
    lightIntentDirty=true;
    clearTimeout(lightSaveTimer);lightSaveTimer=setTimeout(saveLightIntent,180);
  }
  function saveLightIntent(){
    if(!nativeContext||!nativeLoaded||!Backup||!lightIntentDirty)return;
    clearTimeout(lightSaveTimer);lightSaveTimer=null;
    try{if(backupTransaction.pending())return;appStorage.setItem(Backup.LIGHT_KEY,JSON.stringify(Backup.lightRecord(model)));lightIntentDirty=false;}
    catch(_){backupNotice='Je laatste lichtkeuze kon niet worden bewaard. Controleer of er opslagruimte vrij is.';}
  }
  window.addEventListener('pagehide',saveLightIntent);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveLightIntent();});
  function backupError(error){
    if(error?.code?.startsWith('BACKUP_')&&error.message&&!['BACKUP_INVALID','BACKUP_UNCONFIRMED'].includes(error.code))return error.message;
    return 'De backup kon niet volledig worden verwerkt. Je bestand is niet gewist. Probeer opnieuw nadat alle receiveracties klaar zijn.';
  }
  function backupPanel(){
    return `<section class="card" data-backup-panel><h2>Backup en herstellen</h2><p>Bewaar je stand, zones, lichtkeuzes, scènes en presets in één bestand.</p><p class="muted">Je ${simpleStandMode||webDemoContext?'standcode':'PIN'} en beveiligingssleutels staan nooit in dit bestand.</p>${backupNotice?`<p role="alert">${esc(backupNotice)}</p>`:''}<div class="actions"><button class="button full" data-action="backup-export">Backup bewaren</button><button class="button secondary full" data-action="backup-import">Backup openen</button></div></section>`;
  }
  function receiverContextPanel(){
    return `<section class="card" data-receiver-context-panel><h2>Bewaring</h2><p class="muted">Wijzigingen worden automatisch bewaard.</p><p role="status" data-receiver-context-status></p><button class="button secondary full" data-action="receiver-context-sync" hidden>Opnieuw controleren</button></section>`;
  }
  function syncReceiverContextPanel(){
    const panel=document.querySelector('[data-receiver-context-panel]');if(!panel)return;
    const state=receiverContextStates.get(stand()?.id),busy=state?.status==='syncing'||state?.contextPhase==='queued';
    panel.querySelector('[data-receiver-context-status]').textContent=busy?'Bezig met bewaren…':state?.status==='synced'?'Bewaard op receivers.':state?.status==='pending'?'Bewaren nog niet bevestigd.':'Bewaarstatus controleren…';
    const button=panel.querySelector('button');button.hidden=busy||state?.status!=='pending';button.disabled=busy;button.textContent='Opnieuw controleren';
  }
  function receiverWorkBusy(){
    return managementBusy||arrangementApplying||pinProtectionBusy||pinLoginBusy||orderIdentificationState?.active===true||identifyPending.size>0||pixelSetup.isOpen()||
      !!document.querySelector('.receiver-removal-sheet[open],.receiver-update-sheet[open]');
  }
  async function waitForReceiverContextWrite({standId,signal}){
    if(receiverWorkBusy())throw Object.assign(Error('RECEIVER_CONTEXT_BUSY'),{code:'RECEIVER_CONTEXT_BUSY'});
    const read=pinProtectionRead;
    if(read&&read.standId!==standId)throw Object.assign(Error('RECEIVER_CONTEXT_BUSY'),{code:'RECEIVER_CONTEXT_BUSY'});
    const controller=new AbortController();let timer,abort,ticket,finished=false;
    const acquisition=(async()=>{
      if(read)await read.promise;
      if(controller.signal.aborted)throw Object.assign(Error('LIVE_QUEUE_CANCELLED'),{code:'LIVE_QUEUE_CANCELLED'});
      const held=await liveController?.acquireIdle({standId,signal:controller.signal});
      if(finished){held?.release();return;}
      return held;
    })();
    try{
      ticket=await Promise.race([acquisition,new Promise((_,reject)=>{
        abort=()=>{finished=true;controller.abort();reject(Object.assign(Error('CANCELLED'),{code:'CANCELLED'}));};
        signal?.addEventListener('abort',abort,{once:true});
        timer=setTimeout(()=>{finished=true;controller.abort();reject(Object.assign(Error('RECEIVER_CONTEXT_BUSY'),{code:'RECEIVER_CONTEXT_BUSY'}));},35000);
        if(signal?.aborted)abort();
      })]);
      if(receiverWorkBusy())throw Object.assign(Error('RECEIVER_CONTEXT_BUSY'),{code:'RECEIVER_CONTEXT_BUSY'});
      if(receiverContextWrites.has(standId)&&stand()?.id!==standId)throw Object.assign(Error('RECEIVER_CONTEXT_STALE'),{code:'RECEIVER_CONTEXT_STALE'});
      if(receiverContextWrites.has(standId)){receiverContextStates.set(standId,{status:'syncing'});syncReceiverContextPanel();}
      return ticket;
    }catch(error){ticket?.release();controller.abort();throw error;}
    finally{finished=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  }
  if(typeof runtime?.registerContextWriteBarrier==='function'){runtime.registerContextWriteBarrier(waitForReceiverContextWrite);contextWriteBarrierInstalled=true;}
  function resumeDeferredPinRead(){
    if(!pinProtectionDeferredStandId||route.screen!=='settings'||pinProtectionLoading||pinProtectionBusy)return;
    const standId=pinProtectionDeferredStandId;
    if(receiverContextStates.get(standId)?.status==='syncing'||receiverContextEventVersions.get(standId)?.detail.contextPhase==='queued')return;
    pinProtectionDeferredStandId=null;
    if(securityStand()?.id===standId)void refreshPinProtection();
  }
  async function readReceiverContextStatus(){
    const standId=stand()?.id;
    if(!standId||receiverContextStates.has(standId)||receiverContextReads.has(standId)||typeof runtime?.services?.receiverContextStatus!=='function')return;
    const version=receiverContextVersions.get(standId)||0;receiverContextReads.add(standId);
    const current=()=>!receiverContextWrites.has(standId)&&(receiverContextVersions.get(standId)||0)===version;
    try{const state=await runtime.services.receiverContextStatus({standId});if(current())receiverContextStates.set(standId,state);}
    catch(_){if(current())receiverContextStates.set(standId,{status:'pending'});}
    finally{receiverContextReads.delete(standId);syncReceiverContextPanel();}
  }
  async function syncReceiverContext(){
    const standId=stand()?.id;if(!standId||receiverContextWrites.has(standId)||receiverContextStates.get(standId)?.status==='syncing')return;
    const version=(receiverContextVersions.get(standId)||0)+1;receiverContextVersions.set(standId,version);receiverContextWrites.set(standId,version);
    const current=()=>receiverContextWrites.get(standId)===version&&receiverContextVersions.get(standId)===version;
    receiverContextStates.set(standId,{status:'syncing',phase:'waiting'});syncReceiverContextPanel();syncPinProtectionCard();
    let ticket;
    try{
      // The production service claims its context generation before waiting,
      // superseding an older auto-save without dispatching two archives. Older
      // fixture hosts still cross the exact same UI barrier before their call.
      if(!contextWriteBarrierInstalled)ticket=await waitForReceiverContextWrite({standId});
      if(!current()||stand()?.id!==standId)throw Object.assign(Error('RECEIVER_CONTEXT_STALE'),{code:'RECEIVER_CONTEXT_STALE'});
      const result=await runtime.services.syncInstallationContext({standId});
      if(current())receiverContextStates.set(standId,result);
    }catch(error){if(current())receiverContextStates.set(standId,error?.code==='RECEIVER_CONTEXT_STALE'&&receiverContextEventVersions.get(standId)?.detail||
      {status:'pending',busy:['RECEIVER_CONTEXT_BUSY','LIVE_QUEUE_BUSY','LIVE_QUEUE_SCOPE_BUSY','LIVE_QUEUE_CLEARED','NATIVE_BUSY'].includes(error?.code)});}
    finally{ticket?.release();if(receiverContextWrites.get(standId)===version)receiverContextWrites.delete(standId);syncReceiverContextPanel();syncPinProtectionCard();resumeDeferredPinRead();}
  }
  window.addEventListener('lightning:receiver-context',event=>{
    if(!nativeContext||!event.detail||typeof event.detail.standId!=='string')return;
    const detail=event.detail,standId=detail.standId,previous=receiverContextEventVersions.get(standId);
    if(Number.isSafeInteger(detail.contextGeneration)&&detail.contextGeneration>0&&Number.isSafeInteger(detail.contextResetGeneration)&&detail.contextResetGeneration>=0){
      if(previous&&(detail.contextResetGeneration<previous.reset||detail.contextResetGeneration===previous.reset&&
        (detail.contextGeneration<previous.generation||detail.contextGeneration===previous.generation&&previous.complete)))return;
      receiverContextEventVersions.set(standId,{generation:detail.contextGeneration,reset:detail.contextResetGeneration,complete:detail.contextPhase==='complete',detail});
    }else if(previous)return;
    if(receiverContextWrites.has(standId))return;
    receiverContextVersions.set(standId,(receiverContextVersions.get(standId)||0)+1);
    receiverContextStates.set(standId,detail);syncReceiverContextPanel();syncPinProtectionCard();
    if(detail.contextPhase==='complete')resumeDeferredPinRead();
  });
  function reloadBackupLibraries(){savedPresets=presetStore.load();savedScenes=sceneStore.load();savedColours=colourStore.load();uiPreferences=preferenceStore.load();}
  async function exportBackup(){
    if(!Backup)return;const loaded=[savedPresets,savedScenes,savedColours,uiPreferences];
    if(loaded.some(item=>item.error))throw Error('Een bibliotheek kan niet worden gelezen. Herstel die eerst voordat je een backup bewaart.');
    if(onboarding.summary()||backupTransaction.pending())throw Error('Rond eerst de lopende toevoeging of herstelactie af.');
    const json=Backup.create({model,presets:savedPresets.presets,scenes:savedScenes.scenes,colors:savedColours.colors,preferences:uiPreferences.preferences});
    const name='Aluvision-backup-'+new Date().toISOString().slice(0,10)+'.json';
    if(nativeContext){const result=await runtime.services.exportBackup({name,json});if(result.status==='shared')toast('Backup gedeeld. Bewaar het bestand op een veilige plek.');}
    else{const url=URL.createObjectURL(new Blob([json],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);toast('Backupbestand aangeboden om te bewaren.');}
  }
  function inspectBackup(raw){
    const saved=Backup.read(raw);
    if(saved.model.demo!==model.demo)throw Error('Een demobackup kan niet worden gebruikt voor echte receivers, of omgekeerd.');
    selectedBackup=saved;
    const zones=saved.model.stands.reduce((count,s)=>count+s.zones.length,0);
    showEffectDialog('Backup herstellen?',`<section data-backup-confirm><h3>${esc(saved.model.stands.map(s=>s.name).join(', ')||'Lege stand')}</h3><p>${zones} zones · ${saved.model.receivers.length} receivers</p><p>${saved.libraries.scenes.length} scènes · ${saved.libraries.presets.length} animatiepresets · ${saved.libraries.colors.length} kleuren</p><p>Dit vervangt de indeling en bewaarde keuzes in deze app. Er wordt nu geen licht verstuurd.</p>${nativeContext?'<p>Alleen de reeds gekoppelde receivers kunnen worden hersteld. Poortinstellingen moeten overeenkomen. Gebruik je een andere telefoon? Open daar eerst dezelfde installatie.</p>':''}<p class="dialog-error" role="alert" hidden></p><button class="button full" data-action="backup-confirm">Instellingen herstellen</button><button class="button secondary full" data-action="effect-dialog-close">Annuleren</button></section>`);
  }
  async function chooseBackup(){
    if(nativeContext){const result=await runtime.services.chooseBackup();if(result.status==='selected')inspectBackup(result.json);return;}
    const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.hidden=true;document.body.append(input);
    input.addEventListener('change',async()=>{try{const file=input.files?.[0];if(!file)return;if(file.size>Backup.MAX_BYTES)throw Error('Kies een backup van maximaal 4 MB.');inspectBackup(await file.text());}catch(error){toast(backupError(error));}finally{input.remove();}},{once:true});
    input.addEventListener('cancel',()=>input.remove(),{once:true});input.click();
  }
  async function restoreBackup(button){
    if(!selectedBackup||!document.querySelector('#effect-dialog[open] [data-backup-confirm]'))return;
    const saved=selectedBackup;button.disabled=true;managementBusy=true;let before=null;
    try{
      clearTimeout(lightSaveTimer);lightSaveTimer=null;lightIntentDirty=false;
      if(nativeContext){
        const view=await runtime.services.loadState();if(view.draft)throw Error('Rond eerst het toevoegen van je receiver af.');before=view.model;
        const target=Backup.nativeModel(saved.model,before);backupTransaction.prepare(saved,before,target);
        const restored=await runtime.services.importInstallationView({model:target,confirmation:'RESTORE_LOCAL_SETTINGS'});
        backupTransaction.finish(restored.model);model=Backup.restoreLight(restored.model,appStorage.getItem(Backup.LIGHT_KEY));
      }else{before=model;backupTransaction.prepare(saved,before,saved.model);backupTransaction.finish(saved.model);model=copy(saved.model);}
      reloadBackupLibraries();selections.clear();liveStates.clear();selectedBackup=null;backupNotice='';closeEffectDialog();route={...route,screen:'settings',zoneId:null};render({top:true});toast('Backup hersteld. Je lichtkeuzes staan klaar; er is nog niets verstuurd.');
    }catch(error){
      // A failed native reply can mean the commit happened. Reconcile by
      // reading; never retry a mutation or discard a committed transaction.
      if(nativeContext&&before)try{const view=await runtime.services.loadState();const journal=backupTransaction.pending();if(journal){
        if(Backup.key(Backup.publicModel(view.model))===journal.afterModel){const done=backupTransaction.finish(view.model);model=Backup.restoreLight(view.model,appStorage.getItem(Backup.LIGHT_KEY));reloadBackupLibraries();selectedBackup=null;closeEffectDialog();render({top:true});toast('Backup hersteld na het controleren van de opslag.');return done;}
        backupTransaction.discard(view.model);
      }}catch(_){}
      backupNotice=backupError(error);const note=document.querySelector('[data-backup-confirm] .dialog-error');if(note){note.hidden=false;note.textContent=backupNotice;}else toast(backupNotice);
    }finally{managementBusy=false;button.disabled=false;}
  }
  function resumeConfiguredLighting(receiverId){
    if(!nativeContext)return;
    const receiver=model.receivers.find(item=>item.id===receiverId&&item.type==='SPI'&&item.lifecycle==='added');
    if(!receiver)return;
    const targetZone=M.getZone(model,receiver.zoneId);
    // CONFIG clears the receiver's transient animation and MAIN recovery
    // cache. Only after confirmed geometry, restore the current light intent.
    // Neighbours need the confirmed new geometry too: continuous lengths and
    // offsets, or spatial port-row ordinals/count. Keep each receiver's own
    // light intent; native storage alone supplies geometry for every layout.
    const targets=targetZone?.type==='SPI'
      ?M.zoneReceivers(model,targetZone.id):[receiver];
    sendReceiverStates(targets.map(item=>item.id),{remember:false});
    // The queue reports LIVE failures separately. A failed resume must never
    // roll back confirmed outputs, reconfigure them, or turn an OFF light on.
  }
  function holdStaticFeedback(control) {
    const sheet=control.closest('[data-stand-control-sheet][data-stand-control-mode="colour"]');
    if(!sheet)return;
    // Capture only local presentation before the wheel consumes pointerdown.
    // Empty pending text or a new multi-line error must not move its hit area.
    // Keep the quiet reserve until this dialog closes; later gestures measure
    // fresh layout again. Status, error text and aria-live continue to update.
    sheet.querySelectorAll('[data-live-status],#stand-control-mixed').forEach(node=>{
      if(node.getBoundingClientRect().height<=0)return;
      const style=getComputedStyle(node),extra=style.boxSizing==='border-box'?0:
        ['paddingTop','paddingBottom','borderTopWidth','borderBottomWidth'].reduce((sum,key)=>sum+(parseFloat(style[key])||0),0);
      const height=parseFloat(style.height)+extra;
      if(!Number.isFinite(height)||height<=0)return;
      node.style.setProperty('--static-feedback-height',`${height}px`);
      node.dataset.staticFeedbackSpace='';node.dataset.staticFeedbackHeld='';
    });
  }
  function releaseStaticFeedbackHold() {
    document.querySelectorAll('[data-static-feedback-held]').forEach(node=>delete node.dataset.staticFeedbackHeld);
  }
  function syncLiveStatus() {
    document.querySelectorAll('[data-live-status]').forEach(node=>{
      const targets=liveTargets(node.dataset.liveStatus);
      const states=targets.map(receiver=>liveStates.get(receiver.id)?.kind||'idle');
      const applied=states.filter(kind=>kind==='applied').length,failed=states.filter(kind=>kind==='failed').length;
      let kind='idle',message='';
      if(!nativeContext||!liveController){kind='preview';message='Alleen voorbeeld · geen receiververbinding.';}
      else if(!targets.length){message='Geen ledline geselecteerd.';}
      else if(failed){
        kind='failed';
        // Native error codes are untrusted input. Only these fixed, known
        // reasons get a customer-facing explanation; never render raw errors.
        const codes=new Set(targets.map(receiver=>liveStates.get(receiver.id)).filter(state=>state?.kind==='failed').map(state=>state.code));
        let reason='Niet alle receivers hebben deze wijziging bevestigd. Controleer de verbinding.';
        if(codes.has('OUTPUT_CONFIGURATION_PENDING'))reason='De gewijzigde poortinstellingen zijn nog niet bevestigd. Controleer Pixels / kant instellen bij je receiver.';
        else if(codes.has('LIVE_CONTROL_PROFILE'))reason='Deze receiver komt niet overeen met je opgeslagen installatie. Open Receivers om dit te controleren.';
        else if(codes.has('LIVE_CONTROL_FIRMWARE_UPDATE'))reason='Deze animatie heeft SPI-software 21.1.45 of nieuwer nodig op alle gekozen receivers. Je huidige verlichting is niet gewijzigd.';
        else if(codes.has('LIVE_CONTROL_STAND_UNAVAILABLE'))reason='Gezamenlijke standanimaties zijn nog niet beschikbaar voor deze verbinding. Je verlichting is niet gewijzigd.';
        else if(['LIVE_CONTROL_BUSY','NATIVE_BUSY','OTA_BUSY','REMOVAL_BUSY'].some(code=>codes.has(code)))reason='Er loopt nog een receiveractie. Deze wijziging is nog niet bevestigd.';
        else if(['LIVE_CONTROL_CANCELLED','CANCELLED'].some(code=>codes.has(code)))reason='Versturen is onderbroken. Je keuze staat nog in het voorbeeld.';
        message=applied?`${targets.length-applied} van ${targets.length} receivers hebben deze wijziging nog niet bevestigd. ${reason}`:reason;
        if(window.__lightningV41GestureDiagnostics===true){
          // Explicit bench-only, exact closed codes. Never display raw native
          // error text, IDs, palette, credentials or a pattern-matched string.
          const allowed=new Set(['VIEW_NOT_LOADED','LIVE_INVALID','LIVE_UNCONFIRMED','NATIVE_TIMEOUT','CANCELLED',
            'LIVE_CONTROL_INVALID','LIVE_CONTROL_PROFILE','LIVE_CONTROL_SETUP_PENDING','LIVE_CONTROL_UNAVAILABLE','LIVE_CONTROL_UNCONFIRMED','LIVE_CONTROL_CANCELLED','LIVE_CONTROL_BUSY','LIVE_CONTROL_FIRMWARE_UPDATE',
            'OWNER_SESSION_UNAVAILABLE','OWNER_SESSION_BUSY','OWNER_REQUEST_INVALID','OWNER_REPLY_INVALID','OWNER_SESSION_CANCELLED','OWNER_SESSION_DEADLINE','OWNER_EXCHANGE_UNCERTAIN',
            'TRUST_INVALID_TARGET','TRUST_INVALID_KEY','TRUST_BUSY','TRUST_CANCELLED','TRUST_DEADLINE','TRUST_UNAVAILABLE','TRUST_TRANSPORT','TRUST_REPLY','TRUST_IDENTITY','TRUST_WRONG_RECEIVER_NETWORK','TRUST_SIGNATURE','TRUST_SERVER_FINISH',
            'TRUST_TRANSPORT_REQUEST','TRUST_TRANSPORT_REPLY','TRUST_TRANSPORT_IDENTITY','TRUST_TRANSPORT_WRONG_RECEIVER_NETWORK','TRUST_TRANSPORT_BUSY','TRUST_TRANSPORT_DEADLINE','TRUST_TRANSPORT_CANCELLED','TRUST_TRANSPORT_UNAVAILABLE',
            'STATIC_GESTURE_BUSY','STATIC_GESTURE_RETIRED','STATIC_GESTURE_STALE','STATIC_GESTURE_UNCONFIRMED','STATIC_GESTURE_SHAPE','STATIC_GESTURE_RECEIPT','STAND_SESSION_EXPIRED']);
          const known=[...codes].filter(code=>allowed.has(code)).sort();
          if(known.length)message+=` Testdiagnose: ${known.join(', ')}.`;
        }
      }
      else if(states.includes('pending')){kind='pending';}
      // Local staging is still pending, not applied. Keep the same quiet
      // pending footprint while a pointer is held; text must not move its wheel.
      else if(states.includes('staged')){kind='pending';}
      else if(states.includes('preview')){kind='preview';message=applied?`Deels bevestigd (${applied}/${targets.length}) · overige wijziging alleen in voorbeeld.`:'Alleen voorbeeld · deze wijziging is niet naar de receiver verstuurd.';}
      else if(applied===targets.length){kind='applied';}
      node.dataset.state=kind;node.textContent=message;
      node.setAttribute('aria-live',failed?'polite':'off');
    });
    syncStaticRouteStatus();
  }
  function apply(patch,scope=selection(),{freshRecipe=false}={}) {
    if(orderIdentificationState?.active)void orderIdentification?.supersede();
    if(managementBusy)return;
    const ids=standControlOpen?standControlReceivers().map(receiver=>receiver.id):selectedReceiverIds(scope);
    if(Object.hasOwn(patch,'bri')&&!Object.hasOwn(patch,'brightness'))patch={...patch,brightness:patch.bri};
    else if(Object.hasOwn(patch,'brightness')&&!Object.hasOwn(patch,'bri'))patch={...patch,bri:patch.brightness};
    const memoryOnly=Object.keys(patch).every(key=>key==='rgbwLast');
    if(memoryOnly){
      const targets=new Set(ids);
      model.receivers.filter(receiver=>targets.has(receiver.id)).forEach(receiver=>{
        if(patch.rgbwLast)receiver.state.rgbwLast=copy(patch.rgbwLast);
      });
      scheduleLightIntentSave();
      observeCentralLight(ids);
      return;
    }
    if(standControlOpen&&standAnimationMarker()&&patch.engine!=='STATIC'){
      const marker=standAnimationMarker();
      const {rgbwLast,...lightingPatch}=patch;
      const plan=StandAnimations.plan(model,stand().id,marker.effectId,{state:{...marker.state,...lightingPatch},time:performance.now()/1000});
      if(rgbwLast)plan.receivers.forEach(receiver=>{receiver.state.rgbwLast=copy(rgbwLast);});
      model=plan.model;sendReceiverStates(ids);syncStandPower();syncLiveStatus();paint(performance.now()/1000);return;
    }
    const next=freshRecipe===true?copy(model):model;
    // A line/zone edit ends the stand recipe for the entire stand. The other
    // lines keep their light state, but must not later send a partial stand batch.
    // Power-only changes preserve its current animation and shared timeline.
    if(Object.keys(patch).some(key=>!['on','power','rgbwLast'].includes(key))){
      const targetStands=new Set(next.receivers.filter(receiver=>ids.includes(receiver.id)).map(receiver=>receiver.standId));
      next.receivers.filter(receiver=>targetStands.has(receiver.standId)&&receiver.zoneId!==null).forEach(receiver=>{delete receiver.state.standAnimation;});
    }
    if(freshRecipe===true){
      // A new built-in recipe replaces old animation controls, not memory,
      // geometry or clocks. Absence retains the existing recipe fallbacks.
      const controls=['speed','smooth','colorCount','widthPixels','objectCount','trailLength','spacing','direction','lineDelayMs','spread','randomness','fadeAmount','delayMs','width','brandColor'];
      const targets=new Set(ids);
      next.receivers.filter(receiver=>targets.has(receiver.id)).forEach(receiver=>{
        controls.forEach(key=>{if(!Object.hasOwn(patch,key))delete receiver.state[key];});
      });
    }
    model=standControlOpen?M.applyStandState(next,stand().id,patch):M.applyState(next,route.zoneId,scope,patch);
    if(Object.keys(patch).some(key=>key!=='rgbwLast'))sendReceiverStates(ids);
    const note=document.querySelector('.mixed-note');if(note)note.hidden=!mixedSelection();
    if(standControlOpen)syncStandPower();
    syncLiveStatus();
    syncPresetAvailability();
    syncControlLocation();
    paint(performance.now()/1000);
  }
  function toast(text) { const el=document.getElementById('toast');el.textContent=text;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.hidden=true;},3500); }
  function staticColour(rgb,w=0,memory=null) { apply({...C.state(rgb,w),...(memory?{rgbwLast:memory}:{}),engine:'STATIC',variant:0,backgroundOn:false,v30Effect:null,category:null,animation:'Vaste kleur',previewFamily:null,legacySpi:false,bounce:false,mirror:false,on:true,power:true});syncColour(); }
  function effectiveColourChannels(slot) {
    const state=selectedState(),isBrand=slot===0&&activeEffect()?.controls.includes('brandColor');
    const rgb=state.rgbEnabled?.[slot]===false?[0,0,0]:rgbOf({colors:[isBrand?state.brandColor||'#C94E46':colours(state)[slot]||'#000000']});
    const white=state.whiteEnabled?.[slot]===false?0:(state.whiteChannels?.[slot]??state.w??0);
    return [...rgb,white];
  }
  function pickerChannels(root) { return root?.dataset.colourPicker==='brand'?brandEditorChannels():root?.dataset.colourPicker==='background'?backgroundChannels():effectiveColourChannels(root?.dataset.colourPicker==='animation'?Number(root.dataset.slot):0); }
  function pickerMemoryKey(root){return root?.dataset.colourPicker==='animation'?`palette${Number(root.dataset.slot)}`:root?.dataset.colourPicker||'static';}
  function rememberedChannels(root,rgb,w){
    const previous=selectedState().rgbwLast||{},key=pickerMemoryKey(root),last={...(previous[key]||{})};
    const remember=values=>values.forEach((value,index)=>{if(Number(value)>0)last['rgbw'[index]]=Math.round(Number(value));});
    // Loaded colours may not have memory yet. Seed the value being replaced
    // before writing a zero, then let new non-zero values become the latest.
    remember(pickerChannels(root));remember([...rgb,w]);
    return {...previous,[key]:last};
  }
  function restoreChannelValue(root,channel){
    if(root?.dataset.colourPicker==='brand')return brandEditor?.memory[channel]||255;
    const remembered=selectedState().rgbwLast?.[pickerMemoryKey(root)]?.[channel];
    if(Number.isInteger(remembered)&&remembered>0&&remembered<=255)return remembered;
    const state=selectedState(),slot=Number(root?.dataset.slot)||0;
    const raw=root?.dataset.colourPicker==='background'
      ? [...rgbOf({colors:[typeof state.background==='string'?state.background:state.background?.rgb||'#000000']}),state.backgroundWhite??state.background?.white??0]
      : root?.dataset.colourPicker==='animation'
        ? [...rgbOf({colors:[colours(state)[slot]||'#000000']}),state.whiteChannels?.[slot]??0]
        : [...rgbOf({colors:[colours(state)[0]]}),state.whiteChannels?.[0]??state.w??0];
    const value=raw['rgbw'.indexOf(channel)];return Number.isInteger(value)&&value>0?value:255;
  }
  function writePicker(root,rgb,w,changed='both') {
    if(managementBusy)return;
    if(root?.dataset.colourPicker==='brand'){
      if(!brandEditor||Number(root.dataset.slot)!==brandEditor.index)return;
      const colors=currentBrandColors(),previous=brandEditor.color;
      if(brandEditor.index>colors.length||brandEditor.index>=4)return;
      const next={r:rgb[0],g:rgb[1],b:rgb[2],w,bri:100,name:brandEditor.name};
      if(changed==='white')Object.assign(next,{r:previous.r,g:previous.g,b:previous.b});
      if(changed==='rgb')next.w=previous.w;
      for(const color of [previous,next])for(const channel of ['r','g','b','w'])if(color[channel]>0)brandEditor.memory[channel]=color[channel];
      colors[brandEditor.index]=next;
      if(!saveBrandColors(colors))return syncColour();
      brandEditor.color=next;brandEditor.isNew=false;
      const note=root.querySelector('.brand-picker-note');if(note)note.textContent=t('brandPickerHint');
      syncColour();return;
    }
    if(root?.dataset.colourPicker==='animation'){
      const slot=Number(root.dataset.slot),state=selectedState(),count=Math.min(colours(state).length,state.colorCount||colours(state).length);
      if(!Number.isInteger(slot)||slot<0||slot>=count||activeEffect()?.paletteEditable===false)return;
    }
    const rgbwLast=rememberedChannels(root,rgb,w);
    if(root?.dataset.colourPicker==='background'){
      if(!activeEffect()?.backgroundEditable)return;
      const s=selectedState(),rawBackground=typeof s.background==='string'?s.background:s.background?.rgb||'#000000',rawWhite=s.backgroundWhite??s.background?.white??0;
      apply({background:changed==='white'?rawBackground:C.hex(rgb),backgroundWhite:changed==='rgb'?rawWhite:w,
        ...(changed==='white'?{}:{backgroundRgbEnabled:true}),...(changed==='rgb'?{}:{backgroundWhiteEnabled:true}),rgbwLast});
      syncBackground();syncColour();
    }else if(root?.dataset.colourPicker==='animation'){
      const slot=Number(root.dataset.slot);
      updatePalette(slot,changed==='white'?undefined:C.hex(rgb),changed==='rgb'?undefined:w);
      apply({rgbwLast});
      if(changed!=='white'&&slot===0&&activeEffect()?.controls.includes('brandColor'))apply({brandColor:C.hex(rgb)});
      const row=document.querySelector('.palette');if(row)row.innerHTML=paletteMarkup(selectedState());
      syncColour();
    } else staticColour(rgb,w,rgbwLast);
  }
  function syncColour() {
    document.querySelectorAll('[data-colour-picker]').forEach(root=>{
      const values=pickerChannels(root),rgb=values.slice(0,3),w=values[3],point=C.position(rgb);
      const cursor=root.querySelector('.wheel-cursor');if(cursor){cursor.style.left=point.x+'%';cursor.style.top=point.y+'%';}
      const swatch=root.querySelector('.colour-swatch');if(swatch)swatch.style.background=C.screenHex(rgb,w);
      const warmthControl=root.querySelector('[data-warmth]');
      if(warmthControl){
        const warmth=C.warmthOf(values),chosen=warmth!==null;
        warmthControl.disabled=!chosen;warmthControl.value=String(warmth??50);
        root.querySelector('[data-action="warm-white"]')?.setAttribute('aria-pressed',String(chosen));
        root.querySelector('[data-warmth-value]').textContent=chosen?warmth+'%':'Kies Warmwit';
        root.querySelector('.warmth-help').textContent=chosen?'De witmix verandert; helderheid stel je apart in.':'Kies Warmwit om de warmte af te stemmen.';
      }
      ['r','g','b','w'].forEach((key,i)=>{
        const input=root.querySelector(`input[data-channel="${key}"]`),number=root.querySelector(`input[data-channel-number="${key}"]`),toggle=root.querySelector(`[data-action="channel-toggle"][data-channel="${key}"]`);
        if(input)input.value=values[i];
        if(number&&document.activeElement!==number)number.value=values[i];
        if(toggle){toggle.setAttribute('aria-pressed',String(values[i]>0));toggle.setAttribute('aria-label',`Kanaal ${key.toUpperCase()} ${values[i]>0?'uitschakelen':'inschakelen'}`);}
      });
    });
  }
  function paintWheel() {
    document.querySelectorAll('[data-colour-picker] canvas.wheel').forEach(canvas=>{
      if(canvas.dataset.bound)return;canvas.dataset.bound='true';
      const root=canvas.closest('[data-colour-picker]'),ctx=canvas.getContext('2d'),size=260,pixels=ctx.createImageData(size,size);
      for(let y=0;y<size;y++)for(let x=0;x<size;x++){
        const index=(y*size+x)*4,rgb=C.screenRGB(C.fromPoint(x+.5,y+.5,size)),inside=Math.hypot(x+.5-size/2,y+.5-size/2)<=size/2;
        pixels.data[index]=rgb[0];pixels.data[index+1]=rgb[1];pixels.data[index+2]=rgb[2];pixels.data[index+3]=inside?255:0;
      }
      ctx.putImageData(pixels,0,0);
      let pointer=null;
      const move=event=>{const rect=canvas.getBoundingClientRect();writePicker(root,C.fromPoint((event.clientX-rect.left)/rect.width*size,(event.clientY-rect.top)/rect.height*size,size),pickerChannels(root)[3],'rgb');};
      canvas.addEventListener('pointerdown',event=>{if(event.button!==0||pointer!==null)return;pointer=event.pointerId;canvas.setPointerCapture(pointer);move(event);});
      canvas.addEventListener('pointermove',event=>{if(event.pointerId===pointer)move(event);});
      canvas.addEventListener('pointerup',event=>{if(event.pointerId===pointer){move(event);pointer=null;}});
      canvas.addEventListener('pointercancel',()=>{pointer=null;});
      canvas.addEventListener('lostpointercapture',()=>{pointer=null;});
      canvas.addEventListener('keydown',event=>{
        if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();
        const values=pickerChannels(root),hsv=C.toHsv(values.slice(0,3));
        if(event.key==='ArrowLeft')hsv.h-=3;if(event.key==='ArrowRight')hsv.h+=3;
        if(event.key==='ArrowUp')hsv.s+=.03;if(event.key==='ArrowDown')hsv.s-=.03;
        writePicker(root,C.hsv(hsv.h,hsv.s,hsv.v||1),values[3],'rgb');
      });
    });
  }
  function paint(time,{secondary=true}={}) {
    if(document.hidden)return;
    if(orderRecognitionDirty)syncOrderRecognition();
    if(secondary)pixelSetup.paint(time);
    for(const [id,blink] of identifying)if(time>=blink.until){identifying.delete(id);syncIdentifyControls(id);}
    if(route.screen==='receiver-add')onboarding.paint(time);
    const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const standPlayback=standControlOpen?StandAnimations.current(model,stand().id):null;
    const zoneStandPlans=new Map();
    const liveZoneStandPlan=zoneId=>{
      const owner=model.stands.find(item=>item.zones.some(zone=>zone.id===zoneId));
      if(!owner)return null;
      if(!zoneStandPlans.has(owner.id))zoneStandPlans.set(owner.id,StandAnimations.current(model,owner.id));
      return zoneStandPlans.get(owner.id);
    };
    document.querySelectorAll('canvas[data-preview]').forEach(canvas=>{
      const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height||rect.bottom<0||rect.top>innerHeight)return;
      const spec=previews.get(canvas.dataset.preview);if(!spec)return;
      if(!secondary&&!spec.main)return;
      if(spec.capturedStandPlan){
        const zone=spec.capturedStandPlan.zones.find(item=>item.zoneId===spec.capturedStandZoneId);
        if(!zone)return;
        // Saved scenes never sample the active model. Their captured plan
        // supplies the shared clock and full stand geometry to each tile.
        P.draw(canvas,{...spec,...StandAnimations.previewOptions(spec.capturedStandPlan,reduce?1.5:time),
          receivers:zone.receivers,presentation:'receivers',reducedMotion:reduce});
        return;
      }
      if(spec.standEffectId){
        const plan=spec.main&&standPlayback?.effectId===spec.standEffectId?standPlayback:spec.standPlan;
        if(!plan)return;
        StandAnimations.draw(canvas,plan,{zoneId:spec.standZoneId,labels:false,time:reduce&&!spec.main?1.5:time,reducedMotion:reduce});
        return;
      }
      const savedZone=spec.zoneId?M.getZone(model,spec.zoneId):null;
      const draft=spec.arrangementPreview?previewArrangement(savedZone):null;
      const savedList=savedZone?M.zoneReceivers(model,spec.zoneId):null;
      const zoneList=savedList;
      const list=zoneList?(spec.visibleReceiverIds?zoneList.filter(receiver=>spec.visibleReceiverIds.includes(receiver.id)):zoneList):spec.brand?spec.receivers.map(r=>{
        const palette=currentBrandColors().slice(0,spec.brandPaletteLimit||0);
        return {...r,state:{...r.state,brandColor:currentBrandPalette()[0],...(palette.length?{colors:palette.map(color=>C.hex([color.r,color.g,color.b])),colorCount:palette.length,whiteChannels:palette.map(color=>color.w),rgbEnabled:palette.map(()=>true),whiteEnabled:palette.map(color=>color.w>0)}:{})}};
      }):spec.receivers;
      const globalPlan=spec.standLiveZoneId?liveZoneStandPlan(spec.standLiveZoneId):null;
      const globalOptions=globalPlan?StandAnimations.previewOptions(globalPlan,time):null;
      P.draw(canvas,{...spec,...globalOptions,layout:globalPlan?'stacked':draft?.layout||spec.layout,receivers:list,
        geometryReceivers:globalPlan?globalPlan.receivers:spec.preserveZoneGeometry?zoneList:spec.geometryReceivers,selection:spec.main?selection():spec.selection,
        ...(savedZone&&!globalPlan?{lineOrder:draft?.lineOrder||M.lineIds(model,savedZone.id)}:{}),
        ...(draft?{lineNumbers:Object.fromEntries(draft.lineOrder.map((id,index)=>[id,index+1]))}:{}),
        selectionFeedback:spec.main===true,identifying:spec.main?identifying:undefined,identificationTime:time,reducedMotion:reduce,
        identificationColours:spec.main&&openLineSetup.has(route.zoneId)?new Map([...orderColours].map(([id,colour])=>[id,colour.rgb])):undefined,
        time:reduce&&!spec.main?1.5:time});
    });
    document.querySelectorAll('canvas[data-product-receiver]').forEach(canvas=>{
      if(!secondary&&canvas.dataset.compact==='true')return;
      const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height||rect.bottom<0||rect.top>innerHeight)return;
      const r=model.receivers.find(r=>r.id===canvas.dataset.productReceiver);if(!r)return;
      const blink=identifying.get(r.id);
      // Connector motion uses the shared monotonic clock, independently of a
      // blink session. Neither selecting nor animating a connector edits output state.
      const plugProgress=visualPlugMotions.get(r.id)?.sample(time,reduce)||{};
      const metadata=window.LightningReceiverVisual.draw(canvas,{type:r.type,selectedPort:selectedVisualPort(r),enabledPorts:r.outputs.filter(p=>p.enabled).map(p=>p.port),plugProgress,compact:canvas.dataset.compact==='true',identifying:!!blink,identifyingPorts:blink?.ports||[],time:blink?time-blink.startedAt:time,reducedMotion:reduce});
      canvas.dataset.activePorts=metadata.activePorts.join(',');canvas.dataset.highlightedPorts=(metadata.highlightedPorts||[]).join(',');canvas.dataset.selectedPort=String(metadata.selectedPort||'');
      canvas.dataset.identifyingPorts=(metadata.identifyingPorts||[]).join(',');canvas.dataset.identifying=String(!!blink);
      canvas.dataset.portLabelsVisible=String(metadata.portLabelsVisible===true);
      canvas.dataset.plugProgress=JSON.stringify(plugProgress);
    });
  }
  function syncIdentifyControls(receiverId){
    const receiver=model.receivers.find(r=>r.id===receiverId),blink=identifying.get(receiverId);if(!receiver)return;
    document.querySelectorAll(`[data-action="visual-identify"][data-receiver="${CSS.escape(receiverId)}"], [data-action="port-identify"][data-receiver="${CSS.escape(receiverId)}"]`).forEach(button=>{
      const scope=button.dataset.action==='visual-identify'?'all':button.dataset.port,pressed=blink?.scope===scope;
      const waiting=identifyPending.has(receiverId);
      const enabled=receiver.type!=='SPI'||receiver.outputs.some(o=>o.enabled&&(scope==='all'||String(o.port)===scope));
      button.disabled=waiting||!enabled||standReceiverActionUnavailable(button.dataset.action,button);button.setAttribute('aria-busy',String(waiting));
      const inline=button.closest('.ledline-row-actions');
      // Keep the compact row label stable: a longer stop/wait label would wrap
      // and move the focused button while identifying this line.
      button.setAttribute('aria-pressed',String(pressed));button.querySelector('span').textContent=inline?t(waiting?'lineSetupBlinkWaiting':pressed?'lineSetupBlinkStop':'lineSetupBlink'):waiting?'Even wachten…':pressed?'Stop knipperen':'Knipperen';
      button.setAttribute('aria-label',inline?`${receiver.name} · ${t(pressed?'lineSetupBlinkStopAccessible':'lineSetupBlinkAccessible')}`:`${receiver.name} · ${scope==='all'?(receiver.type==='SPI'?'alle actieve uitgangen samen':'hele receiver'):'uitgang '+scope} ${pressed?'stoppen met knipperen':'laten knipperen'}`);
    });
  }
  async function toggleIdentification(receiver,scope){
    if(identifyPending.has(receiver.id))return;
    const ports=receiver.type==='SPI'?receiver.outputs.filter(o=>o.enabled&&(scope==='all'||String(o.port)===scope)).map(o=>o.port):[];
    if(receiver.type==='SPI'&&!ports.length)return;
    const stopping=identifying.get(receiver.id)?.scope===scope;
    const layout=orderIdentificationState;
    const lineId=receiver.id+':'+(receiver.type==='RGBW'?0:Number(scope));
    if(layout?.active&&layout.standId===receiver.standId&&layout.zoneId===route.zoneId&&
       layout.lines.some(line=>line.id===lineId)){
      const layoutStopping=stopping&&identifying.get(receiver.id)?.layoutSession===layout.session;
      if(previewContext){
        void orderIdentification?.interaction();
        if(layoutStopping)identifying.delete(receiver.id);
        else {const now=performance.now()/1000;identifying.set(receiver.id,{scope,ports,startedAt:now,until:now+5,layoutSession:layout.session});toast('Voorbeeld · knipperen wordt niet verstuurd.');}
        syncIdentifyControls(receiver.id);paint(performance.now()/1000);return;
      }
      if(typeof orderIdentification?.blink!=='function'){toast('Knipperen is niet beschikbaar voor deze herkenning.');return;}
      identifyPending.set(receiver.id,{layoutSession:layout.session,lineId});syncIdentifyControls(receiver.id);
      try{
        // Use the same bounded holder, never the legacy white-blink bootstrap.
        // The controller serializes the real interaction/TOUCH and this pulse.
        const reply=await orderIdentification.blink(lineId,!layoutStopping);
        const current=orderIdentificationState;
        if(reply?.confirmed!==true||reply.session!==layout.session||reply.lineId!==lineId||
           reply.enabled!==!layoutStopping||!Number.isInteger(reply.ttlMs)||
           (layoutStopping?reply.ttlMs!==0:reply.ttlMs<=0||reply.ttlMs>5000))throw Error('UNCONFIRMED');
        if(!current?.active||current.session!==layout.session||current.zoneId!==route.zoneId||
           !model.receivers.some(r=>r.id===receiver.id&&r.rid===receiver.rid&&r.standId===receiver.standId&&r.deviceFingerprint===receiver.deviceFingerprint))return;
        if(layoutStopping)identifying.delete(receiver.id);
        else {const now=performance.now()/1000;identifying.set(receiver.id,{scope,ports,startedAt:now,until:now+reply.ttlMs/1000,layoutSession:layout.session});}
      }catch(_){toast('Knipperen niet bevestigd. De vaste herkenningskleuren blijven tijdelijk actief.');}
      finally{identifyPending.delete(receiver.id);syncIdentifyControls(receiver.id);paint(performance.now()/1000);}
      return;
    }
    if(previewContext){
      if(stopping)identifying.delete(receiver.id);
      else {const now=performance.now()/1000;identifying.set(receiver.id,{scope,ports,startedAt:now,until:now+15});toast('Niet verbonden · knipperen wordt niet verstuurd.');}
      syncIdentifyControls(receiver.id);paint(performance.now()/1000);return;
    }
    if(typeof runtime?.services?.identify!=='function'){toast('Knipperen is nog niet beschikbaar via de receiververbinding.');return;}
    const request={standId:receiver.standId,receiverId:receiver.id,port:scope==='all'?0:Number(scope),enabled:!stopping};
    identifyPending.set(receiver.id,request);syncIdentifyControls(receiver.id);
    let awaitingStop=stopping;
    const stillPresent=()=>model.receivers.some(r=>r.id===receiver.id&&r.rid===receiver.rid&&r.standId===receiver.standId&&r.deviceFingerprint===receiver.deviceFingerprint);
    async function confirm(operation){
      const reply=await runtime.services.identify(operation);
      if(reply?.confirmed!==true||!Number.isInteger(reply.ttlMs)||reply.ttlMs<0||reply.ttlMs>5000||(operation.enabled?reply.ttlMs===0:reply.ttlMs!==0))throw Error('UNCONFIRMED');
      return reply;
    }
    try{
      const prior=identifying.get(receiver.id);
      if(prior&&!stopping){
        // Firmware can identify disjoint ports simultaneously. This UI shows
        // one scope, so stop its previous scope before starting another one.
        awaitingStop=true;
        await confirm({...request,port:prior.scope==='all'?0:Number(prior.scope),enabled:false});
        if(!stillPresent())return;
        identifying.delete(receiver.id);syncIdentifyControls(receiver.id);paint(performance.now()/1000);
        awaitingStop=false;
      }
      const reply=await confirm(request);
      // A late ACK cannot restore a receiver removed while the request ran.
      if(!stillPresent())return;
      if(stopping)identifying.delete(receiver.id);
      else {const now=performance.now()/1000;identifying.set(receiver.id,{scope,ports,startedAt:now,until:now+reply.ttlMs/1000});}
    }catch(_){toast(awaitingStop?'Stoppen is nog niet bevestigd. De herkenning stopt vanzelf; probeer opnieuw.':'Knipperen is niet bevestigd. Controleer de verbinding en probeer opnieuw.');}
    finally{identifyPending.delete(receiver.id);syncIdentifyControls(receiver.id);paint(performance.now()/1000);}
  }
  let lastPaint=0,lastSecondaryPaint=0;
  function frame(now){
    // Full-size, visible previews follow a 60 Hz display. Gallery cards and
    // thumbnails keep a lighter 30 Hz cadence; no extra timers or radio writes.
    if(!document.hidden&&now-lastPaint>=1000/60-.75){
      const secondary=now-lastSecondaryPaint>=1000/30-.75;
      paint(now/1000,{secondary});lastPaint=now;if(secondary)lastSecondaryPaint=now;
    }
    requestAnimationFrame(frame);
  }
  function showHelp() {
    const help=document.getElementById('help');cancelDialogDismissal(help);
    if(!help.open)helpReturnFocus=dialogActionOpener||document.activeElement;
    document.getElementById('help-content').innerHTML=`<header><h2 id="help-title" tabindex="-1" autofocus>Kies de plek.<br>Bedien het licht.</h2></header><section>${icon('stand')}<div><h3>Stand → je hele installatie</h3><p>Alles op één plek.</p></div></section><section>${icon('zones')}<div><h3>Zone → een plek in je stand</h3><p>Bijvoorbeeld Balie of Plafond. Open een zone om te bedienen.</p></div></section><section>${icon('together')}<div><h3>Alle ledlines of één ledline</h3><p>Kies de hele zone of één lijn. Doorlopende SPI bedien je samen.</p></div></section><aside class="guide"><p>RGBW en SPI hebben elk een eigen zone.</p></aside><button class="button" data-action="close-help">Begrepen</button>`;
    help.setAttribute('aria-labelledby','help-title');help.showModal();
    // Start the explanation at its title, not at the only button at the end.
    document.getElementById('help-title').focus({preventScroll:true});help.scrollTop=0;
  }
  function closeHelp(){
    document.getElementById('help').close();restoreControlFocus(helpReturnFocus);helpReturnFocus=null;
  }
  function showEffectDialog(title,content,headerContent='') {
    if(standControlOpen&&!buildingStandDialog&&!standDialogNested&&!colourManagerReturn){
      standControlEpoch++;
      const focused=dialogActionOpener||document.activeElement;
      standDialogNested={scrollTop:document.getElementById('effect-dialog').scrollTop,action:focused?.dataset?.action,id:focused?.dataset?.id};
    }
    if(!document.getElementById('effect-dialog').open)dialogReturnFocus=dialogActionOpener||document.activeElement;
    const dialog=document.getElementById('effect-dialog');
    cancelDialogDismissal(dialog);
    document.getElementById('effect-dialog-content').innerHTML=`<header><h2 id="effect-dialog-title">${esc(title)}</h2><button class="icon-button" data-action="effect-dialog-close" aria-label="Venster sluiten">${icon('close')}</button>${headerContent}</header>${content}`;
    if(!dialog.open)dialog.showModal();dialog.scrollTop=0;
    // Keep a way out visible even while the shared colour picker is scrolled.
    // Measure instead of guessing: translated/long titles can wrap to 2 lines.
    dialogHeaderObserver?.disconnect();
    const header=dialog.querySelector('#effect-dialog-content > header');
    const measureHeader=()=>dialog.style.setProperty('--dialog-header-height',`${Math.ceil(header.getBoundingClientRect().height)}px`);
    measureHeader();dialogHeaderObserver=new ResizeObserver(measureHeader);dialogHeaderObserver.observe(header);
    // Draw a newly opened live preview before returning to the tap handler.
    // Otherwise the continuously scheduled frame can arrive after the colour
    // editor is already visible, briefly leaving its spatial preview blank or
    // on a stale frame while the rest of the dialog is ready.
    if(dialog.querySelector('canvas[data-preview]'))paint(performance.now()/1000);
  }
  function cancelDialogDismissal(dialog){pendingDialogDismissals.get(dialog)?.();}
  function dismissDialog(dialog,close){
    if(!dialog.open||pendingDialogDismissals.has(dialog))return;
    if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return close();
    // Only user dismissal waits for its short exit. Save/apply/navigation
    // workflows keep their synchronous close and authoritative state order.
    let timeout;const wasInert=dialog.inert;
    const cancel=()=>{
      clearTimeout(timeout);dialog.removeEventListener('animationend',onEnd);
      dialog.classList.remove('is-closing');dialog.inert=wasInert;pendingDialogDismissals.delete(dialog);
    };
    const finish=()=>{cancel();if(dialog.open)close();};
    const onEnd=event=>{if(event.target===dialog&&event.animationName==='app-dialog-exit')finish();};
    pendingDialogDismissals.set(dialog,cancel);
    dialog.addEventListener('animationend',onEnd);dialog.classList.add('is-closing');dialog.inert=true;
    if(!getComputedStyle(dialog).animationName.split(',').some(name=>name.trim()==='app-dialog-exit'))return finish();
    timeout=setTimeout(finish,220);
  }
  function dismissEffectDialog(){
    if(managementBusy||pinProtectionBusy)return;
    if(colourManagerReturn){
      if(colourManagerVisible)return closeColourManager();
      brandEditor=colourManagerReturn.brandEditor||null;savedColours=colourStore.load();return showColourManager();
    }
    if(standControlOpen&&standDialogNested)return restoreStandDialog();
    dismissDialog(document.getElementById('effect-dialog'),closeEffectDialog);
  }
  function closeEffectDialog() {
    if(pinProtectionBusy)return;
    cancelDialogDismissal(document.getElementById('effect-dialog'));
    const wasStand=standControlOpen,brandIndex=brandEditor?.index;
    dialogHeaderObserver?.disconnect();document.getElementById('effect-dialog').close();
    document.querySelector('[data-action="animation-categories"]')?.setAttribute('aria-expanded','false');
    document.querySelectorAll('#effect-dialog canvas[data-preview]').forEach(canvas=>previews.delete(canvas.dataset.preview));
    document.getElementById('effect-dialog-content').replaceChildren();standControlOpen=false;standControlEpoch++;lastStandControlContext=null;standDialogNested=null;zoneDeletion=null;brandEditor=null;
    if(wasStand||(centralPending&&!centralEditing()))render({preserveScroll:true});
    if(!restoreControlFocus(dialogReturnFocus)&&Number.isInteger(brandIndex))
      main.querySelector(`[data-action="brand-colour-edit"][data-id="${brandIndex}"]`)?.focus({preventScroll:true});
    dialogReturnFocus=null;
  }
  function syncStandPower(){
    const focused=document.activeElement,card=document.querySelector('#effect-dialog .power-card');if(card)card.outerHTML=powerControl();
    restoreControlFocus(focused);
    const note=document.querySelector('#stand-control-mixed');if(note)note.hidden=!mixedSelection();
  }
  function showStandOverview(kind){
    const current=stand();if(!current)return;
    const list=standReceivers(),unassigned=list.filter(r=>!r.zoneId),zoneOverview=kind==='zones';
    const entries=zoneOverview?current.zones.map(z=>{
      const count=physicalLineCount(M.zoneReceivers(model,z.id));
      return `<button class="stand-overview-row" data-action="overview-zone" data-id="${esc(z.id)}">${icon('zones')}<span><b>${esc(z.name)}</b><small>${count?ledlineCount(count):'Nog geen verlichting toegevoegd'}${z.type?' · '+z.type:''}</small></span>${icon('chevron')}</button>`;
    }).join(''):list.map(r=>`<button class="stand-overview-row receiver-zone-row" data-action="receiver-move" data-id="${esc(r.id)}" aria-label="${esc(r.name)} · ${esc(current.zones.find(z=>z.id===r.zoneId)?.name||'Niet in een zone')} · zone wijzigen">${icon('receiver')}<span><b>${esc(r.name)}</b><small>${r.type} · ${esc(current.zones.find(z=>z.id===r.zoneId)?.name||'Niet in een zone')}</small></span><span class="receiver-zone-change" aria-hidden="true"><span class="receiver-zone-change-icon">${icon('zones')}</span><small>Zone wijzigen</small></span></button>`).join('');
    showEffectDialog(zoneOverview?'Zones in je stand':'Ledlines in je stand',`<section data-stand-overview="${kind}"><p>${zoneOverview?'Tik op een zone om die ledlines te bedienen.':'Tik op een ledline om die aan een andere zone toe te wijzen.'}</p><div class="stand-overview-list">${entries||`<p>${zoneOverview?'Je hebt nog geen zones.':'Je hebt nog geen ledlines toegevoegd.'}</p>`}</div>${!zoneOverview&&unassigned.length?`<p>${unassigned.length} ${unassigned.length===1?'ledline heeft':'ledlines hebben'} nog geen zone.</p><button class="button secondary full" data-action="overview-receivers" data-id="unassigned">Ledlines zonder zone bekijken</button>`:''}<button class="button full" data-action="${zoneOverview?'overview-zone-new':'overview-receivers'}">${zoneOverview?'＋ Zone toevoegen':'Ledlines beheren'}</button></section>`);
  }
  function showStandControls(){
    if(!standControlReceivers().length)return toast('Voeg eerst verlichting toe aan een zone. Losse receivers worden niet meebediend.');
    standControlOpen=true;standControlEpoch++;lastStandControlContext=null;standDialogNested=null;standAnimationFamily=null;standAnimationFamilyReturn=null;standAnimationTab='catalogue';
    standControlMode=standAnimationMarker()?'animations':'colour';standAnimationGallery=!standAnimationMarker();settingsOpen=false;
    renderStandControls();
  }
  async function standAnimationsAvailable(){
    try{
      if(runtime.standAnimationsAvailable===true)return true;
      await runtime.capabilities();
      if(runtime.standAnimationsAvailable===true)return true;
      toast('Gezamenlijke standanimaties zijn nog niet beschikbaar in deze appversie. Je verlichting blijft ongewijzigd.');
    }catch(_){toast('De gezamenlijke animatiebediening kon nog niet worden gecontroleerd. Je verlichting blijft ongewijzigd.');}
    return false;
  }
  function restoreStandDialog(){
    const saved=standDialogNested;standControlEpoch++;standDialogNested=null;renderStandControls();
    const dialog=document.getElementById('effect-dialog');dialog.scrollTop=saved?.scrollTop||0;
    if(saved?.action)dialog.querySelector(`[data-action="${CSS.escape(saved.action)}"]${saved.id?`[data-id="${CSS.escape(saved.id)}"]`:''}`)?.focus({preventScroll:true});
  }
  function standAnimationPreview(effect,{compact=false}={}){
    const sample=copy(model);sample.receivers.forEach(receiver=>{delete receiver.state.standAnimation;});
    let plan;try{plan=StandAnimations.plan(sample,stand().id,effect.id,{state:{...effectState(effect),...(compact?{speed:Math.max(58,effect.state.speed||0)}:{})},time:0});}
    catch(error){if(error.code==='STAND_EFFECT_MINIMUM')return '<p class="stand-animation-guidance">Minstens twee ledlines nodig.</p>';throw error;}
    let groups=plan.zones.filter(group=>group.receivers.length);
    if(compact){const types=new Set();groups=groups.filter(group=>{if(types.has(group.type))return false;types.add(group.type);return true;});}
    return `<div class="stand-animation-preview${compact?' is-compact':''}" ${compact?'':'data-stand-animation-preview'} aria-label="Voorbeeld van alle zones">${groups.map(group=>{
      const types=[...new Set(group.receivers.map(receiver=>receiver.type))],type=types.length===1?types[0]:group.type;
      return `<div class="stand-animation-zone" ${compact?'':`data-stand-animation-zone="${esc(group.zoneId||'unassigned')}"`}><div class="stand-animation-zone-label"><b>${esc(group.zoneName)}</b><span>${esc(type||'RGBW / SPI')}</span></div>${!compact?`<small class="stand-animation-role">${esc(effect.standRoleLabels?.[type]||'In dezelfde animatie')}</small>`:''}${addPreview(group.receivers,'stacked','',{main:!compact,standEffectId:effect.id,standZoneId:group.zoneId,standPlan:plan,decorative:compact,label:`${group.zoneName} · ${type||'Ledlines'} · ${Library.displayName(effect,t)}`})}</div>`;
    }).join('')}</div>`;
  }
  function standAnimationGuidance(effect=activeEffect()){
    if(effect?.standGuidance)return effect.standGuidance;
    const types=new Set(standControlReceivers().map(receiver=>receiver.type));
    if(types.size>1)return 'SPI beweegt over de pixels. RGBW volgt als volledige ledline, in de volgorde van je zones.';
    return types.has('SPI')?'Het effect loopt over de pixels, in de volgorde van je zones en ledlines.':'Het effect gaat van ledline naar ledline, in de volgorde van je zones.';
  }
  function standAnimationModeLabel(effect){
    if(effect.standMode==='whole')return 'Overal hetzelfde · samen';
    const types=new Set(standControlReceivers().map(receiver=>receiver.type));
    return types.size>1?'SPI beweegt · RGBW volgt':types.has('SPI')?'SPI · samen over je stand':'RGBW · lijn voor lijn';
  }
  function renderStandControls({preserveScroll=true}={}){
    const dialog=document.getElementById('effect-dialog');
    const context=JSON.stringify([stand()?.id,standControlMode,standAnimationGallery,standAnimationFamily,standAnimationTab]);
    const keep=preserveScroll&&dialog.open&&lastStandControlContext===context,scrollTop=keep?dialog.scrollTop:0;
    const disclosures=keep?UIContinuity.captureDisclosures(dialog):[],editor=keep?UIContinuity.captureEditor(dialog,document.activeElement):null,action=keep?UIContinuity.captureAction(dialog,document.activeElement):null;
    dialog.querySelectorAll('canvas[data-preview]').forEach(canvas=>previews.delete(canvas.dataset.preview));
    const effect=activeEffect(),family=standAnimationFamily?Library.group(catalogue(),standAnimationFamily):null;
    const shown=family?.preview||(!standAnimationGallery&&effect?effect:null)||catalogue().find(effect=>(effect.minimumReceivers||1)<=physicalLineCount(standControlReceivers()));
    const animationContent=standControlMode==='animations'?`${shown&&!standAnimationGallery?`<section class="stand-animation-live"><div class="stand-animation-live-title"><b>${esc(Library.displayName(shown,t))}</b><small>${standAnimationModeLabel(shown)}</small></div>${standAnimationPreview(shown,{compact:true})}<details class="stand-animation-explanation" data-continuity-id="stand-zone-previews"><summary>Alle zones bekijken</summary>${standAnimationPreview(shown)}</details></section>`:''}${!standAnimationGallery&&effect?animationEditorMarkup(effect):animationLibraryContent()}`:'';
    const zoneCount=standControlZoneCount();
    // Title and mode tabs share one opaque sticky surface, including the
    // safe area. Two separate sticky layers leaked scrolling previews at
    // the rounded tab corners and could diverge when the title wrapped.
    const tabs=`<div class="stand-controls-tabs section-tabs" role="tablist" aria-label="Alles bedienen"><button type="button" role="tab" data-action="stand-control-mode" data-id="colour" aria-selected="${standControlMode==='colour'}" aria-controls="stand-controls-panel">${icon('sun')}Kleur</button><button type="button" role="tab" data-action="stand-control-mode" data-id="animations" aria-selected="${standControlMode==='animations'}" aria-controls="stand-controls-panel">${icon('animation')}Animaties</button></div>`;
    const content=`<div class="stand-controls-sheet" data-stand-control-sheet data-stand-control-mode="${standControlMode}"><p class="stand-control-scope"><b>${esc(standLabel())}</b> · ${zoneCount} zone${zoneCount===1?'':'s'} · ${ledlineCount(physicalLineCount(standControlReceivers()))}</p><div id="stand-controls-panel" role="tabpanel"><p class="stand-control-description">${standControlMode==='colour'?'Kleur voor RGBW en SPI.':'Animaties over alle zones · RGBW en SPI.'}<small>Receivers zonder zone doen niet mee.</small></p>${powerControl()}<p class="live-confirmation" data-live-status="stand" role="status" aria-live="polite"></p>${standControlMode==='colour'?`<p id="stand-control-mixed" class="mixed-note" ${mixedSelection()?'':'hidden'}>Instellingen verschillen. Een nieuwe kleur geldt voor alle zones.</p>${colourPickerMarkup(null,true)}${standScenesMarkup(true)}`:animationContent}</div></div>`;
    buildingStandDialog=true;try{showEffectDialog('Alles bedienen',content,tabs);}finally{buildingStandDialog=false;}
    // A first colour edit may hide the mixed-settings explanation. Keep only
    // this dialog's initially visible footprint, so its wheel cannot move
    // underneath the active pointer. A fresh uniform dialog has no reserve.
    const mixedHint=dialog.querySelector('#stand-control-mixed');
    if(mixedHint&&!mixedHint.hidden)mixedHint.dataset.preserveMixedSpace='';
    syncLiveStatus();paintWheel();syncColour();paint(performance.now()/1000);
    if(keep){UIContinuity.restoreDisclosures(dialog,disclosures);if(editor)UIContinuity.restoreEditor(dialog,editor);else UIContinuity.restoreCapturedAction(dialog,action);}
    dialog.scrollTop=scrollTop;lastStandControlContext=context;
  }
  function showPaletteEditor(index) {
    const s=selectedState();if(!Number.isInteger(index)||index<0||index>=Math.min(colours(s).length,s.colorCount||colours(s).length)||activeEffect()?.paletteEditable===false)return;
    const label=activeEffect()?.whiteMixPreset?'Witmix':'Kleur';
    showEffectDialog(`${label} ${index+1} aanpassen`,`${dialogAnimationPreview()}${colourPickerMarkup(index)}`);
    paintWheel();syncColour();
  }
  function dialogAnimationPreview(){
    if(standControlOpen&&activeEffect())return standAnimationPreview(activeEffect());
    const view=tunnelSpatialContext()?spatialMode():null,spatial=['tunnel','wall'].includes(view);
    const title=spatial?spatialPreviewText('Preview',view):'Live LED-voorbeeld';
    const label=spatial?`${title} · ${zone().name} · ${ledlineCount(physicalLineCount())}`:'Live voorbeeld met jouw animatiekleuren';
    const options={main:true,label,...(spatial?{spatialShape:view,presentation:'receivers',geometryReceivers:receivers()}: {})};
    return `<div class="preview-wrap dialog-live-preview${spatial?' is-spatial-preview':''}"><div class="preview-top">${esc(spatial?`${title} · live`:title)}</div>${zonePreview(zone(),spatial?'dialog-spatial-preview':'',options)}</div>`;
  }
  function syncBackground(){
    const host=standControlOpen?document.getElementById('effect-dialog-content'):main;
    const on=Boolean(selectedState().backgroundOn),button=host.querySelector('[data-action="background-toggle"]');
    if(button){button.setAttribute('aria-pressed',on);button.setAttribute('aria-checked',on);button.querySelector('span').textContent=on?'Aan':'Uit';}
    const details=host.querySelector('[data-background-details]');if(details)setPanelHidden(details,!on);
    const swatch=host.querySelector('.background-swatch'),channels=backgroundChannels();
    if(swatch)swatch.style.background=C.screenHex(channels.slice(0,3),channels[3]);
  }
  function setPanelHidden(panel,hidden,onHidden){
    if(!panel||hidden&&pendingPanelDismissals.has(panel)||panel.hidden===hidden&&!pendingPanelDismissals.has(panel))return;
    pendingPanelDismissals.get(panel)?.();
    if(!hidden){panel.hidden=false;return;}
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){panel.hidden=true;onHidden?.();return;}
    let timeout;const wasInert=panel.inert;
    const cancel=()=>{
      clearTimeout(timeout);panel.classList.remove('is-closing');panel.inert=wasInert;pendingPanelDismissals.delete(panel);
    };
    const finish=()=>{
      if(pendingPanelDismissals.get(panel)!==cancel)return;
      cancel();panel.hidden=true;onHidden?.();
    };
    pendingPanelDismissals.set(panel,cancel);panel.classList.add('is-closing');panel.inert=true;
    const animation=panel.getAnimations().find(animation=>animation.animationName==='app-disclosure-exit');
    if(!animation)return finish();
    // A live reduced-motion preference change cancels CSS animation rather
    // than ending it. Both completion paths finish only their own dismissal;
    // a reopened panel cannot be hidden by an old animation or deadline.
    animation.finished.then(finish,finish);timeout=setTimeout(finish,280);
  }
  function keepAdvancedSettingsActionVisible(button,panel,revision,expanded=false){
    requestAnimationFrame(()=>{
      if(revision!==advancedSettingsRevision||settingsOpen!==expanded||!panel||panel.hidden!==!expanded||!button.isConnected||main.querySelector('#animation-settings')!==panel||main.querySelector('[data-action="settings-toggle"]')!==button)return;
      updateControlPreviewDensity();
      const dock=main.querySelector('.control-preview-dock'),surface=dock?.querySelector('.control-dock-surface');
      const surfaceBottom=Math.max(0,surface?.getBoundingClientRect().bottom||0);
      // The gallery shortcut floats below the surface and is not included in
      // its measured height. Keep the whole action clear of both overlays.
      const shortcut=dock?.querySelector('[data-editor-shortcut]');
      const top=Math.max(surfaceBottom,shortcut&&!shortcut.hidden?shortcut.getBoundingClientRect().bottom:0),bottom=document.getElementById('navigation')?.getBoundingClientRect().top??innerHeight;
      const box=button.getBoundingClientRect();
      if(box.top<top+8||box.bottom>bottom-8){
        // Bringing this action up can itself move the gallery into the dock.
        // Reserve its measured height now, rather than chase it mid-scroll.
        const gallery=main.querySelector('.current-effect-gallery'),style=shortcut&&getComputedStyle(shortcut);
        const shortcutHeight=shortcut?Math.max(shortcut.getBoundingClientRect().height,(gallery?.getBoundingClientRect().height||0)+(parseFloat(style.paddingTop)||0)+(parseFloat(style.paddingBottom)||0)):0;
        revealBelowControlPreview(button,8+Math.max(top-surfaceBottom,shortcutHeight));
      }
    });
  }
  // Animate only these native disclosure summaries. Their bodies and controls
  // stay in the existing DOM; receiver toggle bookkeeping remains native.
  const detailFolds=new WeakMap(),activeDetailFolds=new Set();
  const detailFoldMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  function cancelDetailFold(details){
    const fold=detailFolds.get(details);if(!fold)return;
    detailFolds.delete(details);activeDetailFolds.delete(details);clearTimeout(fold.timeout);
    fold.animation?.cancel();
    if(fold.style===null)details.removeAttribute('style');else details.setAttribute('style',fold.style);
    for(const [child,inert] of fold.children){if(inert===null)child.removeAttribute('inert');else child.setAttribute('inert',inert);}
  }
  function finishDetailFold(details,fold){
    if(!fold||detailFolds.get(details)!==fold)return;
    cancelDetailFold(details);details.open=fold.open;
  }
  function animateDetailFold(details){
    const previous=detailFolds.get(details),open=previous?!previous.open:!details.open;
    const summary=details.querySelector(':scope > summary');
    // Carry the first exact attributes through reversal; do not recapture a
    // browser's transient CSSOM serialization while cancelling that motion.
    const style=previous?previous.style:details.getAttribute('style');
    const children=previous?previous.children:Array.from(details.children).filter(child=>child!==summary).map(child=>[child,child.getAttribute('inert')]);
    const from=details.getBoundingClientRect().height;
    cancelDetailFold(details);
    // A navigation/render may detach a closing card before its native close
    // event. Remember the requested presentation state now, not that delay.
    if(details.matches('[data-receiver-detail]')){
      const id=details.dataset.receiverDetail;open?expandedReceivers.add(id):expandedReceivers.delete(id);
      if(!open)visualPlugMotions.delete(id);
    }
    // Measure both real native endpoints, including padding/borders and the
    // compact colour picker's existing open-dependent layout. No guessed max.
    details.open=open;const to=details.getBoundingClientRect().height;
    if(!open)details.open=true;
    const fold={open,style,children};
    detailFolds.set(details,fold);activeDetailFolds.add(details);
    if(!open)for(const [child] of fold.children)child.inert=true;
    // Keep the exact attribute snapshot rather than normalizing CSS text
    // through a retained CSSStyleDeclaration during rapid reversals.
    details.setAttribute('style',`${style||''};overflow:hidden!important;`);
    const duration=open?240:180,styles=getComputedStyle(details);
    const easing=styles.getPropertyValue(open?'--motion-spring':'--motion-ease').trim()||(open?'cubic-bezier(.2,.82,.24,1.08)':'cubic-bezier(.22,.72,.25,1)');
    if(Math.abs(to-from)<.5)return finishDetailFold(details,fold);
    try{fold.animation=details.animate([{height:`${from}px`},{height:`${to}px`}],{duration,easing,fill:'both'});}
    catch(_){return finishDetailFold(details,fold);}
    fold.animation.finished.then(()=>finishDetailFold(details,fold),()=>finishDetailFold(details,fold));
    fold.timeout=setTimeout(()=>finishDetailFold(details,fold),duration+100);
  }
  function finishReducedDetailFolds(){
    if(detailFoldMotion.matches)for(const details of Array.from(activeDetailFolds))finishDetailFold(details,detailFolds.get(details));
  }
  if(typeof detailFoldMotion.addEventListener==='function')detailFoldMotion.addEventListener('change',finishReducedDetailFolds);
  else detailFoldMotion.addListener(finishReducedDetailFolds);
  function changePalette(removeIndex=null){
    const range=activeEffect()?.colorCountRange;if(!range||activeEffect()?.paletteEditable===false)return;
    const s=selectedState(),count=Math.min(colours(s).length,s.colorCount||colours(s).length);
    if(removeIndex===null&&count>=range.max||removeIndex!==null&&(!Number.isInteger(removeIndex)||removeIndex<0||removeIndex>=count||count<=range.min))return;
    const palette=colours(s).slice(0,count),whites=palette.map((_,i)=>s.whiteChannels?.[i]??0),rgbFlags=palette.map((_,i)=>s.rgbEnabled?.[i]!==false),whiteFlags=palette.map((_,i)=>s.whiteEnabled?.[i]!==false);
    if(removeIndex===null){palette.push(['#C94E46','#F0B95F','#669CC6','#72B894','#BB8CC8','#F5DCA8','#73C9CE'][count%7]);whites.push(0);rgbFlags.push(true);whiteFlags.push(true);}
    else [palette,whites,rgbFlags,whiteFlags].forEach(values=>values.splice(removeIndex,1));
    apply({colors:palette,whiteChannels:whites,rgbEnabled:rgbFlags,whiteEnabled:whiteFlags,colorCount:palette.length});
    const host=standControlOpen?document.getElementById('effect-dialog'):main;
    const row=host.querySelector('.palette'),focused=document.activeElement,restoreFocus=row?.contains(focused);
    if(row)row.innerHTML=paletteMarkup(selectedState());
    if(restoreFocus&&!restoreControlFocus(focused,host)){
      const index=removeIndex===null?palette.length-1:Math.min(removeIndex,palette.length-1);
      row.querySelector(`[data-action="palette-edit"][data-id="${index}"]`)?.focus({preventScroll:true});
    }
  }
  function updatePalette(index,color,white) {
    const s=selectedState(),palette=copy(colours(s)),whites=copy(s.whiteChannels||palette.map(()=>0));
    if(!Number.isInteger(index)||index<0||index>=Math.min(palette.length,s.colorCount||palette.length)||activeEffect()?.paletteEditable===false)return;
    if(color!==undefined&&!/^#[0-9a-f]{6}$/i.test(color))return;
    if(white!==undefined&&(!Number.isInteger(white)||white<0||white>255))return;
    if(color!==undefined)palette[index]=color;if(white!==undefined)whites[index]=white;
    const rgbFlags=palette.map((_,i)=>i===index&&color!==undefined?true:s.rgbEnabled?.[i]!==false),whiteFlags=palette.map((_,i)=>i===index&&white!==undefined?true:s.whiteEnabled?.[i]!==false);
    apply({colors:palette,whiteChannels:whites,rgbEnabled:rgbFlags,whiteEnabled:whiteFlags,
      ...(color!==undefined&&index===0&&activeEffect()?.controls.includes('brandColor')?{brandColor:color}:{})});
    const host=standControlOpen?document.getElementById('effect-dialog'):main;
    const row=host.querySelector('.palette');if(row)row.innerHTML=paletteMarkup(selectedState());
  }
  function showSavePreset() {
    const effect=activeEffect();if(!effect)return;
    if(mixedSelection())return toast('Kies één ledline, of geef alle ledlines eerst dezelfde instellingen. Zo is duidelijk wat je bewaart.');
    showEffectDialog('Animatie bewaren',`<p>${esc(Library.displayName(effect,t))} · alle gekozen kleuren en instellingen worden bewaard in Mijn animaties. Je kiest later zelf op welke ledlines de animatie komt.</p><label class="dialog-field">Naam van je animatie<input id="preset-name" type="text" maxlength="64" placeholder="Bijvoorbeeld: zacht welkom" autocomplete="off"></label><p class="dialog-error" role="alert" hidden></p><button class="button full" data-action="preset-confirm" disabled>Animatie bewaren</button>`);
    document.getElementById('preset-name').focus();
  }
  function showSceneNameDialog(id) {
    const scene=savedScenes.scenes.find(s=>s.id===id&&s.standId===stand()?.id);if(!scene)return;
    showEffectDialog('Scènenaam wijzigen',`<p>Alleen de naam verandert. Je opgeslagen licht blijft hetzelfde.</p><label class="dialog-field">Naam van de scène<input id="scene-rename-name" maxlength="64" autocomplete="off" value="${esc(scene.name)}"></label><p class="dialog-error" role="alert" hidden></p><button class="button full" data-action="scene-rename-save" data-id="${esc(id)}" disabled>Naam opslaan</button><button class="button secondary full" data-action="effect-dialog-close">Annuleren</button>`);
    const input=document.getElementById('scene-rename-name');input.focus();input.select();
  }
  function showReceiverAssignment(receiverId,targetZoneId=undefined) {
    const r=model.receivers.find(item=>item.id===receiverId&&item.lifecycle==='added'&&item.standId===stand().id);if(!r)return;
    receiverAssignment={receiverId,zoneId:targetZoneId===undefined?r.zoneId:targetZoneId};
    showEffectDialog('Zone wijzigen',`<p class="assignment-context"><b>${esc(r.name)}</b><br><span>${esc(r.type)} · ${r.zoneId?esc(M.getZone(model,r.zoneId).name):'Nog geen zone'}</span></p><p class="assignment-retention-note">Doet mee met de groepsanimatie in de gekozen zone.</p><div class="assignment-choices" aria-label="Zone kiezen">${stand().zones.map(z=>{
      const compatible=!z.type||z.type===r.type,chosen=z.id===receiverAssignment.zoneId;
      return `<button class="assignment-choice" data-action="assignment-zone" data-id="${esc(z.id)}" aria-pressed="${chosen}" ${compatible?'':'disabled'}>${icon('zones')}<span><b>${esc(z.name)}</b><small>${z.id===r.zoneId?'Huidige zone':compatible?`${zoneTypeLabel(z)}${z.type?` · ${receiverCount(z.receiverIds.length)}`:''}`:`Alleen ${z.type} · past niet bij deze receiver`}</small></span><i aria-hidden="true">${chosen?'✓':''}</i></button>`;
    }).join('')}<button class="assignment-choice" data-action="assignment-zone" data-id="" aria-pressed="${!receiverAssignment.zoneId}">${icon('unassigned')}<span><b>Nog geen zone</b><small>Blijft gekoppeld aan je stand</small></span><i aria-hidden="true">${!receiverAssignment.zoneId?'✓':''}</i></button></div><button class="button secondary full" data-action="assignment-new-zone">＋ Nieuwe zone maken</button><p class="dialog-error" role="alert" hidden></p><button class="button full" data-action="assignment-confirm" ${receiverAssignment.zoneId===r.zoneId?'disabled':''}>Zone wijzigen</button>`);
  }
  function showZoneReceiverPicker(zoneId) {
    const z=M.getZone(model,zoneId);if(!z)return;
    receiverAssignment={mode:'many',receiverIds:[],zoneId:z.id,type:z.type};
    renderZoneReceiverPicker();
  }
  function renderZoneReceiverPicker(focusType=null) {
    const assignment=receiverAssignment,z=assignment?.mode==='many'?M.getZone(model,assignment.zoneId):null;
    if(!assignment||!z)return;
    const available=model.receivers.filter(r=>r.lifecycle==='added'&&r.standId===stand().id&&r.zoneId!==z.id);
    const types=[...new Set(available.map(r=>r.type))];
    if(!z.type&&!assignment.type&&types.length===1)assignment.type=types[0];
    const selectedType=z.type||assignment.type;
    const eligible=selectedType?available.filter(r=>r.type===selectedType):[];
    assignment.receiverIds=assignment.receiverIds.filter(id=>eligible.some(r=>r.id===id));
    const familyChoices=!z.type&&types.length>1?`<div class="assignment-family-picker" role="group" aria-label="Kies soort ledline">${types.map(type=>{
      const count=available.filter(r=>r.type===type).length;
      return `<button class="assignment-family-choice" data-action="assignment-many-type" data-id="${esc(type)}" aria-pressed="${selectedType===type}"><b>${esc(type)}</b><small>${ledlineCount(count)}</small></button>`;
    }).join('')}</div>`:'';
    const list=selectedType?`<div class="assignment-many-tools"><span>${esc(selectedType)} · ${ledlineCount(eligible.length)}</span><button class="text-button" data-action="assignment-many-select-all" ${eligible.length?'':'disabled'}>${eligible.length&&assignment.receiverIds.length===eligible.length?'Selectie wissen':'Alles kiezen'}</button></div><div class="assignment-choices assignment-many-list" aria-label="Ledlines kiezen">${eligible.map(r=>{
      const chosen=assignment.receiverIds.includes(r.id);
      return `<button class="assignment-choice assignment-many-choice" data-action="assignment-many-toggle" data-id="${esc(r.id)}" aria-pressed="${chosen}">${icon('receiver')}<span><b>${esc(r.name)}</b><small>${esc(r.type)} · ${esc(M.getZone(model,r.zoneId)?.name||'Nog geen zone')}</small></span><i aria-hidden="true">${chosen?'✓':''}</i></button>`;
    }).join('')||`<p class="assignment-many-empty">${available.length?`Er zijn geen andere passende ${esc(selectedType)}-ledlines om toe te wijzen.`:'Er zijn nog geen andere ledlines om toe te wijzen.'}</p>`}</div>`:`<p class="assignment-many-empty">${available.length?'Kies RGBW of SPI. Per zone kun je één soort ledline combineren.':'Er zijn nog geen andere ledlines om toe te wijzen.'}</p>`;
    const count=assignment.receiverIds.length;
    showEffectDialog('Ledlines toewijzen',`<section class="assignment-many" data-assignment-many><p class="assignment-many-destination">Naar <b>${esc(z.name)}</b></p><p class="assignment-many-note">De gekozen ledlines verplaatsen naar deze zone.</p>${familyChoices}${list}<p class="assignment-many-summary" data-assignment-many-summary role="status">${count?`${ledlineCount(count)} gekozen`:'Kies ledlines.'}</p><button class="button full" data-action="assignment-many-confirm" ${count?'':'disabled'}>${count?`${ledlineCount(count)} toewijzen`:'Ledlines toewijzen'}</button><button class="button secondary full" data-action="assignment-add-receiver">＋ Nieuwe ledline zoeken</button></section>`);
    if(focusType)document.querySelector(`[data-action="assignment-many-type"][data-id="${CSS.escape(focusType)}"]`)?.focus({preventScroll:true});
  }
  function syncZoneReceiverPicker() {
    const assignment=receiverAssignment;if(assignment?.mode!=='many')return;
    const chosen=new Set(assignment.receiverIds),eligible=Array.from(document.querySelectorAll('[data-action="assignment-many-toggle"]'));
    eligible.forEach(row=>{const selected=chosen.has(row.dataset.id);row.setAttribute('aria-pressed',String(selected));row.querySelector('i').textContent=selected?'✓':'';});
    const selectedAll=eligible.length>0&&eligible.every(row=>chosen.has(row.dataset.id)),count=chosen.size;
    const bulk=document.querySelector('[data-action="assignment-many-select-all"]');if(bulk)bulk.textContent=selectedAll?'Selectie wissen':'Alles kiezen';
    const summary=document.querySelector('[data-assignment-many-summary]');if(summary)summary.textContent=count?`${ledlineCount(count)} gekozen`:'Kies één of meer ledlines.';
    const confirm=document.querySelector('[data-action="assignment-many-confirm"]');if(confirm){confirm.disabled=!count;confirm.textContent=count?`${ledlineCount(count)} toewijzen`:'Ledlines toewijzen';}
  }
  function showNameDialog(kind,id=null) {
    const target=kind==='receiver-rename'?model.receivers.find(r=>r.id===id):kind==='zone-rename'?M.getZone(model,id):null;
    const creating=kind==='zone-create',receiverId=creating?id:null;
    nameDialog={kind,id};
    showEffectDialog(creating?'Nieuwe zone':kind==='zone-rename'?'Zone hernoemen':'Receiver hernoemen',`<p>${creating?'Kies een herkenbare pleknaam.':'Alleen de naam wijzigt.'}</p><label class="dialog-field">${kind==='receiver-rename'?'Naam receiver':'Naam zone'}<input id="management-name" maxlength="64" autocomplete="off" value="${esc(target?.name||'')}" placeholder="${kind==='receiver-rename'?'Bijvoorbeeld: links bij de balie':'Bijvoorbeeld: Balie'}"></label><p class="dialog-error" role="alert" hidden></p><button class="button full" data-action="management-name-save" ${creating?'disabled':''}>${receiverId?'Zone maken en receiver verplaatsen':creating?'Zone maken':'Naam opslaan'}</button>${receiverId?'<button class="button secondary full" data-action="assignment-back">Terug naar zones</button>':''}`);
    document.getElementById('management-name').focus();
  }
  function showUnassign(receiverId) {
    const r=model.receivers.find(item=>item.id===receiverId);if(!r?.zoneId)return;
    showEffectDialog('Uit deze zone halen?',`<p><b>${esc(r.name)}</b> blijft in je stand, maar hoort niet meer bij ${esc(M.getZone(model,r.zoneId).name)}.</p><p>Instellingen blijven behouden.</p><p class="dialog-error" role="alert" hidden></p><button class="button full" data-action="receiver-unassign-confirm" data-id="${esc(r.id)}">Uit zone halen</button><button class="button secondary full" data-action="effect-dialog-close">Annuleren</button>`);
  }
  function zoneDeletionSignature(z) { return JSON.stringify([z.id,z.name,z.type,z.receiverIds]); }
  function showZoneDelete(zoneId,changed=false) {
    const s=stand(),z=s?.zones.find(item=>item.id===zoneId);if(!z)return;
    const count=M.zoneReceivers(model,z.id).length;
    zoneDeletion={standId:s.id,zoneId:z.id,signature:zoneDeletionSignature(z)};
    const affectedScenes=savedScenes.scenes.some(scene=>scene.standId===s.id&&scene.zones.some(item=>item.id===z.id));
    showEffectDialog('Zone verwijderen?',`<p>Je verwijdert alleen de zone <b>${esc(z.name)}</b>.</p>${count?`<div class="zone-delete-destination">${icon('receiver')}<span><b>${count} ${count===1?'receiver blijft':'receivers blijven'} gekoppeld</b><small>Verplaatsen naar <strong>Niet in een zone</strong></small></span></div><p>Je kunt ze daar opnieuw aan een zone toewijzen. Kleuren en poorten blijven bewaard${pinRequired()?', net als je PIN':''}. De receivers blijven onderdeel van je stand.</p>`:'<p>Deze zone bevat geen receivers. Je stand blijft bestaan.</p>'}${affectedScenes?'<p class="zone-delete-scene-note">Scènes met deze zone blijven bewaard, maar kunnen niet meer worden geactiveerd. Bewaar na het opnieuw indelen een nieuwe scène.</p>':''}<p class="dialog-error" role="alert" ${changed?'':'hidden'}>${changed?'Deze zone is ondertussen gewijzigd. Controleer hierboven welke receivers je losmaakt.':''}</p><div class="zone-delete-actions"><button class="button red full" data-action="zone-delete-confirm" data-id="${esc(z.id)}">Zone verwijderen</button><button class="button secondary full" data-action="effect-dialog-close">Annuleren</button></div>`);
  }
  async function confirmZoneDelete(zoneId) {
    const consent=zoneDeletion,s=stand(),z=s?.zones.find(item=>item.id===zoneId);
    if(!document.getElementById('effect-dialog').open||!consent||consent.zoneId!==zoneId||consent.standId!==s?.id||!z)return;
    if(consent.signature!==zoneDeletionSignature(z))return showZoneDelete(zoneId,true);
    const releasedIds=M.zoneReceivers(model,z.id).map(receiver=>receiver.id),count=releasedIds.length,
      next=await persistManagement(M.deleteZone(model,z.id),{kind:'delete',zoneId},consent.signature);
    if(!next)return;
    // This is zone membership only; never invoke receiver removal, reset or PIN services.
    applyJoinedZonePlayback(next,releasedIds);selections.delete(zoneId);
    if(sceneDraft)sceneDraft.zoneIds=sceneDraft.zoneIds.filter(id=>id!==zoneId);
    receiverAssignment=null;nameDialog=null;closeEffectDialog();
    if(count){receiverFilter='unassigned';navigate('receivers',{zoneId:null});}
    else navigate('stand',{zoneId:null});
    toast(count?`Zone verwijderd. ${count} ${count===1?'receiver staat':'receivers staan'} bij Niet in een zone.`:'Zone verwijderd.');
  }
  function keepLocalPreviewStates(stored,{exceptStandId=null}={}) {
    const next=copy(M.assertValid(stored)),previous=new Map(model.receivers.map(r=>[r.id,r]));
    for(const r of next.receivers){
      const old=previous.get(r.id);
      if(r.standId!==exceptStandId&&old&&typeof r.rid==='string'&&r.rid&&typeof r.deviceFingerprint==='string'&&r.deviceFingerprint&&
        ['rid','deviceFingerprint','standId','type','role','lifecycle'].every(key=>old[key]===r[key]))r.state=copy(old.state);
    }
    // Preview-only colour edits remain local. Never merge identity, role, ports,
    // membership or credentials back over the authoritative native view.
    return M.assertValid(next);
  }
  async function manageSetupZones(request) {
    const reject=code=>Object.assign(Error('De zonewijziging is nog niet bevestigd. Je keuzes blijven bewaard.'),{code});
    const summary=onboarding.summary(),s=model.stands.find(item=>item.id===summary?.stand?.id);
    if(managementBusy)throw reject('MAIN_BUSY');
    if(route.screen!=='receiver-add'||summary?.canManageZones!==true||!s||!request||typeof request!=='object'||Array.isArray(request)||
      ![Object.prototype,null].includes(Object.getPrototypeOf(request)))throw reject('ZONE_EDIT_INVALID');
    const keys=request.kind==='delete'?['kind','zoneId','expectedZoneSignature']:request.kind==='rename'?['kind','zoneId','name','expectedZoneSignature']:request.kind==='assign'?['kind','receiverId','zoneId',...(request.zone===undefined?[]:['zone'])]:[];
    if(!keys.length||Object.keys(request).length!==keys.length||!keys.every(key=>Object.prototype.hasOwnProperty.call(request,key)))throw reject('ZONE_EDIT_INVALID');
    const existing=s.zones.find(zone=>zone.id===request.zoneId);
    let next,operation;
    if(request.kind==='delete'||request.kind==='rename'){
      if(!existing||typeof request.expectedZoneSignature!=='string'||request.expectedZoneSignature!==zoneDeletionSignature(existing))throw reject('V30_CHECKPOINT_CONFLICT');
      if(request.kind==='rename'){next=M.renameZone(model,existing.id,request.name);operation={kind:'rename',zoneId:existing.id,name:request.name};}
      else{next=M.deleteZone(model,existing.id);operation={kind:'delete',zoneId:existing.id};}
    }else{
      const receiver=model.receivers.find(item=>item.id===request.receiverId&&item.standId===s.id&&item.lifecycle==='added');
      if(!receiver||typeof request.zoneId!=='string')throw reject('ZONE_EDIT_INVALID');
      if(request.zone!==undefined){
        const pending=summary.zones.find(zone=>zone.id===request.zoneId&&zone.isNew===true),zone=request.zone;
        if(existing||!pending||!zone||typeof zone!=='object'||Array.isArray(zone)||
          ![Object.prototype,null].includes(Object.getPrototypeOf(zone))||Object.keys(zone).length!==2||!Object.hasOwn(zone,'id')||!Object.hasOwn(zone,'name')||
          zone.id!==pending.id||zone.name!==pending.name)throw reject('V30_CHECKPOINT_CONFLICT');
        next=M.assignReceiverToZone(M.createZone(model,s.id,{id:zone.id,name:zone.name}),receiver.id,zone.id);
        operation={kind:'create',zoneId:zone.id,name:zone.name,receiverId:receiver.id};
      }else{
        if(!existing)throw reject('ZONE_EDIT_INVALID');
        next=M.assignReceiverToZone(model,receiver.id,existing.id);operation={kind:'assign',receiverId:receiver.id,zoneId:existing.id};
      }
    }
    managementBusy=true;
    let confirmedView=null;
    try{
      if(nativeContext){
        if(typeof runtime?.services?.[simpleStandMode?'standMutation':'editZones']!=='function')throw reject('ZONE_STORAGE_UNAVAILABLE');
        confirmedView=simpleStandMode?await saveCentralModel(next):await runtime.services.editZones({standId:s.id,operation,...(['delete','rename'].includes(request.kind)?{expectedZoneSignature:request.expectedZoneSignature}:{})});
        next=simpleStandMode?M.assertValid(confirmedView.model):keepLocalPreviewStates(confirmedView.model);
      }
      if(request.kind==='assign')applyJoinedZonePlayback(next,[request.receiverId]);else model=next;
      retainSetupSelections();zoneDeletion=null;receiverAssignment=null;nameDialog=null;
      if(request.kind==='delete'){
        if(sceneDraft)sceneDraft.zoneIds=sceneDraft.zoneIds.filter(id=>id!==request.zoneId);
      }
      // Setup owns its current panel and focus. No navigate/render, receiver
      // release or PIN operation is part of local zone placement.
      return copy(model);
    }catch(error){
      const view=error.reconciledView||confirmedView;
      if(view?.model){
        model=keepLocalPreviewStates(view.model);retainSetupSelections();zoneDeletion=null;receiverAssignment=null;nameDialog=null;
        error.reconciledModel=copy(model);
      }
      throw error;
    }finally{managementBusy=false;}
  }
  function retainSetupSelections(){
    for(const [zoneId,selection] of selections){
      const current=M.getZone(model,zoneId);
      if(!current)selections.delete(zoneId);
      else if(current.layout==='continuous'||selection.kind==='receiver'&&!current.receiverIds.includes(selection.receiverId))selections.set(zoneId,{kind:'all'});
      else if(selection.kind==='receivers')storeLineSelection(selection.receiverIds,M.zoneReceivers(model,zoneId),zoneId);
    }
  }
  function refreshSuspendedSetup(view){
    if(route.screen!=='receiver-add'&&view?.draft?.receiver===null)onboarding.restore(view.draft);
  }
  async function persistManagement(next,operation,expectedZoneSignature) {
    if(localStandConcept()){
      // A concept edits only its receiver-less local graph. It is never a
      // central config, native Owner view or successful device save.
      try{storeLocalStandConcept(next);return next;}catch(_){toast('Je lokale concept kon niet worden bewaard. Er is niets naar receivers verstuurd.');return null;}
    }
    if(!nativeContext)return next;
    if(managementBusy)return null;
    managementBusy=true;
    const controls=Array.from(document.querySelectorAll('#main button,#main input,#main select,#navigation button,#effect-dialog button,#effect-dialog input'),el=>({el,disabled:el.disabled}));
    controls.forEach(({el})=>{el.disabled=true;});
    const dialog=document.getElementById('effect-dialog'),host=dialog.open?document.getElementById('effect-dialog-content'):main;
    host.querySelector('[data-action="management-stand-open"]')?.remove();
    const isArrangement=['arrange','arrangeLines'].includes(operation?.kind);
    const arrangement=isArrangement?arrangementDraft:null;
    const progress=document.createElement('p');progress.className='management-status';progress.setAttribute('role','status');progress.textContent='Wijziging opslaan…';if(!isArrangement)host.prepend(progress);host.setAttribute('aria-busy','true');
    try{
      if(typeof runtime?.services?.[simpleStandMode?'standMutation':'editZones']!=='function')throw Object.assign(Error('ZONE_STORAGE_UNAVAILABLE'),{code:'ZONE_STORAGE_UNAVAILABLE'});
      const view=simpleStandMode?await saveCentralModel(next):await runtime.services.editZones({standId:stand().id,operation,...(expectedZoneSignature===undefined?{}:{expectedZoneSignature})});
      // Metadata edits also refresh an unfinished, receiver-less setup in the
      // native store. Resume that exact draft instead of later saving stale
      // zone geometry or membership from the suspended receiver search.
      refreshSuspendedSetup(view);
      return simpleStandMode?M.assertValid(view.model):keepLocalPreviewStates(view.model);
    }catch(error){
      // Diagnostics contain only reviewed constant codes, never the exception,
      // message, receiver response or caller's connection/configuration data.
      const diagnosticCode=error?.code;
      const diagnosticCodes=new Set(['ZONE_STORAGE_UNAVAILABLE','ZONE_EDIT_INVALID','VIEW_NOT_LOADED','VIEW_INVALID','STAND_NOT_CONNECTED','STAND_CONFIG_CONFLICT','STAND_SAVE_UNCONFIRMED','STAND_MUTATION_INVALID','STAND_DATA_INVALID','STAND_CONNECTION_CANCELLED','STAND_LEGACY_ACCESS_RETIRED','STAND_INVALID_REQUEST','STAND_UNAVAILABLE','STAND_WIFI_UNREACHABLE','STAND_WRONG_WIFI','STAND_AUTH_FAILED','STAND_SESSION_EXPIRED','STAND_CANCELLED','STAND_BUSY','STAND_UNCONFIRMED','STAND_IDENTITY_MISMATCH','STAND_MIGRATION_REQUIRED','STAND_NOT_CONFIGURED','STAND_REVISION_CONFLICT','MAIN_BUSY','MAIN_CONNECTION_UNAVAILABLE','MAIN_STORAGE_UNCONFIRMED','MAIN_ACTION_UNCERTAIN','V30_BINDING_INVALID','V30_CHECKPOINT_INVALID','V30_CHECKPOINT_CONFLICT','V30_CHECKPOINT_ROLLBACK','V30_STORAGE_UNAVAILABLE','V30_STORAGE_CORRUPT','V30_STORAGE_UNCONFIRMED','V30_STORAGE_FULL','V30_RECEIPT_UNVERIFIED','LOCAL_NETWORK_DENIED','NATIVE_BUSY','NATIVE_TIMEOUT','NATIVE_UNCONFIRMED']);
      console.warn('V41_MANAGEMENT_SAVE_FAILED '+(diagnosticCodes.has(diagnosticCode)?diagnosticCode:'UNCLASSIFIED'));
      if(diagnosticCode==='STAND_NOT_CONNECTED'||diagnosticCode==='STAND_CONNECTION_CANCELLED'){
        const message='Open eerst je stand om de indeling te wijzigen. Je wijziging is nog niet bevestigd.',notice=document.querySelector('#effect-dialog[open] .dialog-error');
        if(arrangement){arrangement.error=message;arrangement.needsStandOpen=true;}
        else{
          if(notice){notice.textContent=message;notice.hidden=false;}else toast(message);
          const action=document.createElement('button');action.type='button';action.className='button secondary full';action.dataset.action='management-stand-open';action.textContent='Stand openen';host.append(action);
        }
        return null;
      }
      const message='Opslaan is niet bevestigd. Controleer de indeling en probeer opnieuw.';
      if(error.reconciledView?.model){
        refreshSuspendedSetup(error.reconciledView);
        if(isArrangement){
          // Reconcile only the authoritative model. The automatic arrangement
          // update then resets its preview to this state and offers a retry.
          model=keepLocalPreviewStates(error.reconciledView.model);retainSetupSelections();
          return null;
        }
        model=keepLocalPreviewStates(error.reconciledView.model);selections.clear();zoneDeletion=null;receiverAssignment=null;nameDialog=null;
        closeEffectDialog();navigate('stand',{zoneId:null});toast(message);
      }else{
        const notice=document.querySelector('#effect-dialog[open] .dialog-error');
        if(notice){notice.textContent=message;notice.hidden=false;}else if(!isArrangement)toast(message);
      }
      return null;
    }finally{
      managementBusy=false;progress.remove();host.removeAttribute('aria-busy');
      controls.forEach(({el,disabled})=>{if(el.isConnected)el.disabled=disabled;});
    }
  }
  async function updateManagement(next,message,receiverId=null,operation=null) {
    next=await persistManagement(next,operation);if(!next)return false;
    const openIds=Array.from(main.querySelectorAll('[data-receiver-detail][open]'),el=>el.dataset.receiverDetail);
    const movedIds=Array.isArray(receiverId)?receiverId:receiverId?[receiverId]:[],affectedZones=new Set(movedIds.map(id=>model.receivers.find(r=>r.id===id)?.zoneId).filter(Boolean));
    for(const zoneId of affectedZones){
      const selected=selections.get(zoneId),remaining=M.zoneReceivers(next,zoneId);
      if(selected?.kind==='receiver'&&!remaining.some(r=>r.id===selected.receiverId)){
        if(remaining.length)selections.set(zoneId,{kind:'receiver',receiverId:remaining[0].id});
        else selections.delete(zoneId);
      }else if(selected?.kind==='receivers'){
        const retained=selected.receiverIds.filter(id=>remaining.some(receiver=>receiver.id===id));
        if(retained.length)storeLineSelection(retained,remaining,zoneId);else selections.delete(zoneId);
      }
    }
    applyJoinedZonePlayback(next,movedIds);closeEffectDialog();receiverAssignment=null;nameDialog=null;renderArrangement();
    openIds.forEach(id=>{const detail=main.querySelector(`[data-receiver-detail="${CSS.escape(id)}"]`);if(detail)detail.open=true;});
    toast(message);return true;
  }
  async function moveReceiver(id,toIndex) {
    const receiver=receivers().find(r=>r.id===id);if(!receiver)return;
    if(receivers().findIndex(r=>r.id===id)===toIndex)return;
    const keyboardMove=document.activeElement?.classList.contains('order-handle')&&document.activeElement.closest('[data-receiver-detail]')?.dataset.receiverDetail===id;
    const next=M.moveReceiver(model,route.zoneId,id,toIndex),saved=await persistManagement(next,{kind:'reorder',zoneId:route.zoneId,receiverIds:M.getZone(next,route.zoneId).receiverIds});
    if(!saved)return;model=saved;
    if(nativeContext)sendReceiverStates(M.zoneReceivers(model,route.zoneId).map(item=>item.id),{remember:false});
    render();
    if(keyboardMove)main.querySelector(`[data-receiver-detail="${CSS.escape(id)}"] .order-handle`)?.focus({preventScroll:true});
    const status=document.querySelector('.order-status');if(status)status.textContent=`${receiver.name} staat nu op plaats ${toIndex+1}.`;
  }
  document.getElementById('effect-dialog').addEventListener('cancel',event=>{event.preventDefault();dismissEffectDialog();});
  document.getElementById('help').addEventListener('cancel',event=>{
    event.preventDefault();dismissDialog(event.currentTarget,closeHelp);
  });
  main.addEventListener('click',event=>{
    if(managementBusy||arrangementApplying)return;
    const canvas=event.target.closest?.('canvas[data-preview]');
    if(!canvas||!['controls','colour','animations'].includes(route.screen)||continuousZone())return;
    const preview=previews.get(canvas.dataset.preview);
    if(!preview?.main||preview.zoneId!==route.zoneId)return;
    let regions=[];try{regions=JSON.parse(canvas.dataset.lineHitRegions||'[]');}catch(_){return;}
    if(!regions.length)return;
    const bounds=canvas.getBoundingClientRect(),x=(event.clientX-bounds.left)/bounds.width,y=(event.clientY-bounds.top)/bounds.height;
    const hit=regions.find(region=>x>=region.x&&x<=region.x+region.width&&y>=region.y&&y<=region.y+region.height);
    if(!hit||!receivers().some(receiver=>receiver.id===hit.receiverId))return;
    if(selection().kind==='receiver'&&selection().receiverId===hit.receiverId)return;
    event.preventDefault();
    if(selection().kind==='receivers')toggleLineSelection(hit.receiverId);
    else storeLineSelection([hit.receiverId]);
    expandedScopeZones.add(route.zoneId);render({preserveScroll:true});
  });
  document.addEventListener('click',async event=>{
    if(firstAccessCheckpoint&&event.target.closest?.('[data-action]'))return;
    const button=event.target.closest('button[data-action]');if(!button||button.disabled)return;
    if(button.dataset.action==='pin-login-cancel'&&pinLoginBusy){pinRecoveryAbort?.abort();return;}
    if(managementBusy||arrangementApplying||pinProtectionBusy||pinLoginBusy)return;
    const action=button.dataset.action,id=button.dataset.id;
    if(webDemoContext&&demoAccessActions.has(action))return;
    if(standReceiverActions.has(action)&&standReceiverActionUnavailable(action,button))return toast(standReceiverNotice);
    // Safari does not focus every pointer-activated button. Remember the
    // actual synchronous opener, not an unrelated heading that kept focus.
    // Clear at this event's microtask boundary so async workflows cannot
    // accidentally reuse a stale action as their return target.
    dialogActionOpener=button;
    queueMicrotask(()=>{if(dialogActionOpener===button)dialogActionOpener=null;});
    try {
      if(standControlOpen){
        if(action==='stand-control-mode'){
          if(!['colour','animations'].includes(id))return;
          standControlEpoch++;
          standControlMode=id;standAnimationFamily=null;standAnimationFamilyReturn=null;standDialogNested=null;renderStandControls();
          document.querySelector(`[data-action="stand-control-mode"][data-id="${id}"]`)?.focus({preventScroll:true});return;
        }
        if(action==='family'){
          standControlEpoch++;
          standAnimationFamilyReturn={id,scrollTop:document.getElementById('effect-dialog').scrollTop};
          standAnimationFamily=id;renderStandControls();document.querySelector('#animation-family-title')?.focus({preventScroll:true});return;
        }
        if(action==='family-back'){
          standControlEpoch++;
          const saved=standAnimationFamilyReturn;standAnimationFamily=null;standAnimationFamilyReturn=null;renderStandControls();
          const dialog=document.getElementById('effect-dialog');dialog.scrollTop=saved?.scrollTop||0;
          if(saved?.id)dialog.querySelector(`[data-action="family"][data-id="${CSS.escape(saved.id)}"]`)?.focus({preventScroll:true});
          return;
        }
        if(['stand-animation-gallery','animation-gallery','animations-gallery','library'].includes(action)){
          standControlEpoch++;
          standAnimationGallery=true;standAnimationFamily=null;
          if(action==='library')standAnimationTab=id==='all'?'catalogue':id;
          renderStandControls({preserveScroll:false});return;
        }
        if(action==='animation-current-edit'){standControlEpoch++;standAnimationGallery=false;standAnimationFamily=null;renderStandControls({preserveScroll:false});return;}
        if(action==='animation-category-choice'&&button.closest('[data-animation-categories]'))return chooseAnimationCategory(id);
        if(action==='effect'){
          const effect=catalogue().find(effect=>effect.id===id);if(!effect)return;
          const intent=standControlIntent();
          if(nativeContext&&!(await standAnimationsAvailable()))return;
          if(!currentStandControlIntent(intent))return;
          void orderIdentification?.supersede();
          const plan=StandAnimations.plan(model,stand().id,id,{state:effectState(effect),time:performance.now()/1000});
          model=plan.model;sendReceiverStates(plan.receivers.map(receiver=>receiver.id));
          standAnimationGallery=false;standAnimationFamily=null;settingsOpen=false;renderStandControls({preserveScroll:false});return;
        }
        if(action==='preset-confirm'){
          const epoch=standControlEpoch,standId=stand()?.id;
          try{const result=presetStore.save(S.capture(document.getElementById('preset-name').value,activeEffect(),selectedState()));
            if(result.error)throw Error(result.error.message);await confirmCentralLibrary(result);savedPresets=result;
            if(!standControlOpen||epoch!==standControlEpoch||standId!==stand()?.id)return;
            standDialogNested=null;renderStandControls();toast('Animatie bewaard in Mijn animaties.');
          }catch(error){if(!standControlOpen||epoch!==standControlEpoch||standId!==stand()?.id)return;const el=document.querySelector('.dialog-error');if(el){el.textContent=error.message;el.hidden=false;}}return;
        }
        if(action==='preset-apply'){
          const preset=savedPresets.presets.find(preset=>preset.id===id),effect=catalogue().find(effect=>effect.id===preset?.effectId);
          if(!effect)return toast('Deze animatie past niet bij alle ledlines in je stand.');
          const intent=standControlIntent();
          if(nativeContext&&!(await standAnimationsAvailable()))return;
          if(!currentStandControlIntent(intent))return;
          const plan=StandAnimations.plan(model,stand().id,effect.id,{state:preset.state,time:performance.now()/1000});model=plan.model;
          sendReceiverStates(plan.receivers.map(receiver=>receiver.id));standAnimationGallery=false;standAnimationFamily=null;renderStandControls({preserveScroll:false});return;
        }
        if(action==='preset-delete-confirm'){const epoch=standControlEpoch,standId=stand()?.id,result=presetStore.remove(id);if(result.error)return toast(result.error.message);await confirmCentralLibrary(result);savedPresets=result;if(standControlOpen&&epoch===standControlEpoch&&standId===stand()?.id){standDialogNested=null;renderStandControls();}return;}
      }
      if(openLineSetup.has(route.zoneId)&&button.closest('.ledline-setup')&&action!=='layout'&&!['visual-identify','port-identify'].includes(action)){
        if(orderIdentificationState?.active)void orderIdentification?.interaction();else beginOrderColours();
      }
      if(action==='layout'||action==='line-setup-open'){
        if(!zone()||!receivers().length)return;
        const closing=action==='layout'&&openLineSetup.has(route.zoneId);
        if(closing){openLineSetup.delete(route.zoneId);openLineSettings.clear();arrangementDraft=null;orderColours.clear();void orderIdentification?.close();}
        else {openLineSetup.add(route.zoneId);beginArrangement();beginOrderColours();}
        renderArrangement();
        // Safari can anchor the collapsed summary behind the sticky preview
        // when removing a long receiver list. Keep that return target visible.
        if(closing||action==='line-setup-open')revealLineSetup();
        main.querySelector('.ledline-setup-toggle')?.focus({preventScroll:true});return;
      }
      if(action==='layout-receiver-settings'){
        const r=receivers().find(r=>r.id===button.dataset.receiver);if(!r)return;
        const browsing=arrangementBrowsing(),opening=!openLineSettings.has(id);
        openLineSettings.clear();if(opening)openLineSettings.add(id);
        if(opening&&r.type==='SPI')visualPorts.set(r.id,Number(button.dataset.port));
        renderArrangement(browsing);
        const target=opening?document.getElementById('ledline-settings-'+id)?.querySelector('h4'):main.querySelector(`[data-action="layout-receiver-settings"][data-id="${CSS.escape(id)}"]`);
        // Opening may reveal the new fields. Closing is not navigation and
        // must not drag the page back to a far-away row under the sticky dock.
        if(target){if(opening)revealBelowControlPreview(target,12);target.focus({preventScroll:true});}return;
      }
      if(action==='spatial-toggle'){
        const z=zone();if(!z)return;
        const browsing=arrangementBrowsing();
        if(openSpatialChoices.has(z.id))openSpatialChoices.delete(z.id);else openSpatialChoices.add(z.id);
        renderArrangement(browsing);main.querySelector('.spatial-choice-toggle')?.focus({preventScroll:true});return;
      }
      if(action==='family-spatial-layout')return await chooseFamilySpatialLayout(id);
      if(action==='spatial-mode'){
        const z=zone();if(!z||id!=='normal')return;
        const layout=z.type==='SPI'?(spatialMode(z.layout,z)==='normal'?z.layout:'continuous'):'stacked';
        return await chooseSpatialLayout('normal',layout,{keepOpen:z.type==='SPI'});
      }
      if(action==='spatial-topology'){
        const z=zone();if(!z||z.type!=='SPI'||!['continuous','stacked'].includes(id))return;
        return await chooseSpatialLayout('normal',id);
      }
      if(action==='draft-layout'){
        const z=zone(),choices=z?.type==='SPI'?['stacked','vertical','continuous']:['stacked','vertical'];
        if(!z||!choices.includes(id))return;
        const view=button.dataset.view||(id==='vertical'?'wall':id==='continuous'?'normal':'tunnel');
        return await chooseSpatialLayout(view,id,{keepOpen:view==='normal'&&z.type==='SPI'});
      }
      if(action==='preview-size'){
        if(!['small','medium','large'].includes(id))return;
        const dock=button.closest('.control-preview-dock'),picker=button.closest('.preview-size-control'),summary=picker?.querySelector('summary');
        const names={small:'Klein',medium:'Middel',large:'Groot'},current=controlPreviewSize;
        if(current===id){picker?.removeAttribute('open');summary?.focus({preventScroll:true});return;}
        controlPreviewSize=id;
        if(dock){
          // Update this small control in place so its canvas can glide to the
          // chosen size. Rebuilding the full page here made the preview snap.
          dock.dataset.previewSize=id;
          dock.querySelectorAll('.preview-size-picker [data-action="preview-size"]').forEach(option=>option.setAttribute('aria-pressed',String(option.dataset.id===id)));
          if(summary){summary.querySelector('b').textContent=names[id];summary.setAttribute('aria-label',`Grootte van het ledlinevoorbeeld ${names[id]}. Tik om te wijzigen`);}
        }
        picker?.removeAttribute('open');summary?.focus({preventScroll:true});paint(performance.now()/1000);return;
      }
      if(action==='nav'){
        if(id==='receivers'&&route.screen!=='receivers'&&!arrangementApplying)expandedReceivers.clear();
        return navigate(id);
      }
      if(action==='pin-login')return await openPinLogin();
      if(action==='stand-create-open'){
        if(nativeContext)return await openCentralStandConnection({intent:'setup'});
        return navigate('receiver-add',{setupFrom:'stand'});
      }
      if(action==='stand-continue-local'){
        if(onboarding.summary()){
          if(!canContinuePendingLocalStand())return;
          try{
            const next=await onboarding.continueLocalConcept();localStandConceptId=next.stands[0].id;
            model=next;simpleStandMode=false;firstFactorySetup=false;route={...route,screen:'stand',standId:localStandConceptId,zoneId:null};render({top:true});
          }catch(_){toast('Omzetten is nog niet bevestigd. Je namen blijven bewaard. Probeer opnieuw.');}
          return;
        }
        if(!canStartLocalStand())return;
        const next=M.localStand('stand-'+crypto.randomUUID(),'Mijn stand');localStandConceptId=next.stands[0].id;
        try{storeLocalStandConcept(next);}catch(_){localStandConceptId=null;toast('Je lokale concept kon niet worden bewaard.');return;}
        model=next;simpleStandMode=false;route={...route,screen:'stand',standId:localStandConceptId,zoneId:null};render({top:true});return;
      }
      if(action==='stand-connect'){
        return await openCentralStandConnection();
      }
      if(action==='stand-open-options'){
        if(standConnectionBusy)return;
        standMigrationPreflightError=null;standManualEntry=false;render({top:true});return;
      }
      if(action==='management-stand-open')return await openManagementStandConnection();
      if(action==='stand-setup-start'){
        if(!verifiedUnsetStand())return;
        firstFactorySetup=true;
        simpleStandMode=false;legacyStandReturn=null;return navigate('receiver-add',{setupFrom:'stand'});
      }
      if(action==='stand-code-suggest'){
        if(!standMigrationReady||standConnectionState.status!=='migration-required'||standConnectionBusy)return;
        const code=main.querySelector('[data-stand-code]'),confirm=main.querySelector('[data-stand-code-confirm]');if(!code||!confirm)return;
        try{code.value=SimpleStand.suggestCode();confirm.value='';code.type='text';confirm.focus({preventScroll:true});}
        catch(_){toast('Een veilige standcode kon niet worden voorgesteld. Vul zelf een code in.');}return;
      }
      if(action==='stand-connect-submit')return await submitStandConnection();
      if(action==='stand-wifi-open')return await openStandOnWifi();
      if(action==='stand-join-open')return await openCentralStandConnection();
      if(action==='stand-share-open'){
        if(!simpleStandSupported)return;
        if(!standSession?.snapshot())return toast('Open eerst je stand voordat je haar deelt.');
        standSharingMode='share';const sharing=ensureStandSharing();sharing.open('share');navigate('stand-sharing');
        try{await sharing.load();}catch(_){}return;
      }
      if(action==='stand-migrate-submit')return await submitStandConnection({migration:true});
      if(action==='stand-inspect-submit')return await inspectCentralStand();
      if(action==='stand-find-submit')return await inspectCentralStand({automatic:true,userInitiated:true});
      if(action==='stand-show-loaded'){const current=standSession?.snapshot();if(current&&standConnectionState.status==='connected'){navigate('stand',{standId:current.standId,zoneId:null});restoreManagementAssignment(current.standId);}return;}
      if(action==='stand-resume-submit')return await resumeCentralStand();
      if(action==='stand-code-change'){if(standSession?.snapshot())return navigate('stand-code-change');return;}
      if(action==='stand-code-change-submit')return await changeCentralStandCode();
      if(action==='stand-refresh')return await refreshCentralStand();
      if(action==='stand-forget')return showEffectDialog('Stand vergeten op deze telefoon?',`<section><p>Alleen deze telefoon wordt losgekoppeld. Je stand blijft op de hoofdreceiver.</p><button class="button full" data-action="stand-forget-confirm">Alleen op deze telefoon vergeten</button><button class="button secondary full" data-action="effect-dialog-close">Annuleren</button></section>`);
      if(action==='stand-forget-confirm'){
        const current=stand();if(!current)return;
        try{centralLiveCheckpoint?.reset();await runtime.services.standForget({standId:current.id,confirmation:'FORGET_LOCAL_STAND'});await standSession.disconnect();centralApplied=null;centralPending=null;model=runtime.emptyModel();closeEffectDialog();route={...route,screen:'stand-connect',standId:null,zoneId:null};render({top:true});}
        catch(_){toast('Vergeten is niet bevestigd. Je gegevens zijn niet vervangen.');}return;
      }
      if(action==='pin-login-submit')return await submitPinLogin();
      if(action==='stand-switch-open')return showEffectDialog('Kies je stand',model.stands.map(item=>`<button class="menu-card" data-action="stand-switch" data-id="${esc(item.id)}" aria-pressed="${item.id===stand()?.id}"><span class="menu-icon">${icon('stand')}</span><span><b>${esc(item.name)}</b><small>${item.zones.length} zones${item.id===stand()?.id?' · Nu geopend':''}</small></span>${icon('chevron')}</button>`).join(''));
      if(action==='stand-switch'){
        if(!model.stands.some(item=>item.id===id))return;
        closeEffectDialog();return navigate('stand',{standId:id,zoneId:null});
      }
      if(action==='backup-export')return await exportBackup();
      if(action==='backup-import')return await chooseBackup();
      if(action==='receiver-context-sync'){
        if(typeof runtime?.services?.resumeInstallationContext==='function'){
          try{await runtime.services.resumeInstallationContext({standId:stand()?.id});}catch(_){/* No confirmed status or mutation is invented. */}
          return;
        }
        return await readReceiverContextStatus();
      }
      if(action==='backup-confirm')return await restoreBackup(button);
      if(action==='demo-settings-tab'&&webDemoContext)return navigate(id==='wifi'?'demo-wifi':'settings');
      if(action==='pin-protection-toggle')return openPinProtection();
      if(action==='pin-protection-refresh')return refreshPinProtection();
      if(action==='pin-protection-reconnect'&&pinProtectionReconnect)return showPinReconnect(pinProtectionReconnect);
      if(action==='pin-protection-recheck')return refreshPinProtection({afterReconnect:true});
      if(action==='pin-protection-save')return savePinProtection(button);
      if(action==='language'||action==='theme'){
        const result=preferenceStore.save({[action]:id});if(result.error)return toast(result.error.message);uiPreferences=result;return render();
      }
      if(action==='preferences-reset')return showEffectDialog('Taal en thema herstellen?',`<section data-preferences-reset><p>Stelt Nederlands en het lichte thema in.</p><p>Je stand en receivers blijven ongewijzigd.</p><p class="dialog-error" role="alert" hidden></p><button class="button full" data-action="preferences-reset-confirm">Taal en thema herstellen</button><button class="button secondary full" data-action="effect-dialog-close">Annuleren</button></section>`);
      if(action==='app-erase')return showEffectDialog('Alles verwijderen?',`<section data-app-erase><p>${webDemoContext?'Alleen de tijdelijke demogegevens op deze pagina worden verwijderd. Gegevens van de gewone site en fysieke receivers blijven onaangeroerd.':'Alle opgeslagen gegevens en configuraties worden uit de app verwijderd. Dit kan niet ongedaan worden gemaakt. De fysieke receivers worden niet teruggezet naar de fabrieksinstellingen.'}</p><p class="dialog-error" role="alert" hidden></p><button class="button secondary full" data-action="effect-dialog-close">Annuleren</button><button class="button red full" data-action="app-erase-confirm">Alles verwijderen</button></section>`);
      if(action==='app-erase-confirm'){
        const panel=document.querySelector('[data-app-erase]');
        if(!document.getElementById('effect-dialog').open||!panel)return;
        button.disabled=true;
        try{
          if(nativeContext){
            if(typeof runtime?.services?.eraseAppData!=='function')throw Error('NATIVE_UNAVAILABLE');
            const result=await runtime.services.eraseAppData({confirmation:'Alles verwijderen'});
            if(result?.status!=='erased-local-only')throw Error('ERASE_UNCONFIRMED');
          }
          if(webDemoContext)webDemo.storage.clear();
          else {window.localStorage.clear();window.sessionStorage.clear();}
          if(nativeContext){window.location.reload();return;}
          onboarding.reset();model=M.assertValid(runtime?.emptyModel?.()||{schemaVersion:30,demo:webDemoContext,stands:[],receivers:[],scenes:[],presets:[]});
          savedPresets=presetStore.load();savedColours=colourStore.load();savedScenes=sceneStore.load();uiPreferences=preferenceStore.load();
          selections.clear();brandEditor=null;visualPorts.clear();visualPlugMotions.clear();identifying.clear();expandedReceivers.clear();expandedConnections.clear();
          sceneDraft=null;receiverFilter='all';route={screen:'receiver-add',setupFrom:'stand',zoneId:null,family:null,library:'all'};
          closeEffectDialog();render({top:true});return;
        }catch(failure){
          button.disabled=false;const feedback=panel.querySelector('.dialog-error');
          feedback.hidden=false;feedback.textContent=failure?.code==='LOCAL_ERASE_REMOVAL_PENDING'?'Rond eerst de openstaande receiververwijdering af. Je appgegevens zijn niet gewist.':'Verwijderen is niet volledig bevestigd. Controleer de app opnieuw voordat je verdergaat.';return;
        }
      }
      if(action==='preferences-reset-confirm'){
        if(!document.getElementById('effect-dialog').open||!document.querySelector('[data-preferences-reset]'))return;
        const result=preferenceStore.reset();
        if(result.error){const feedback=document.querySelector('[data-preferences-reset] .dialog-error');feedback.hidden=false;feedback.textContent=result.error.message;return;}
        uiPreferences=result;closeEffectDialog();render();
        document.querySelector('[data-action="preferences-reset"]')?.focus({preventScroll:true});
        return toast('Taal en thema hersteld. Je installatie en opgeslagen licht blijven bewaard.');
      }
      if(action==='native-load-retry')return loadNativeState();
      if(action==='stand-controls')return showStandControls();
      if(action==='stand-zones-info'||action==='stand-receivers-info')return showStandOverview(action==='stand-zones-info'?'zones':'receivers');
      if(action==='zone'||action==='overview-zone'){
        if(action==='overview-zone')closeEffectDialog();
        // Only explicit zone entry starts closed; same-zone browsing, sync and
        // internal edit/add returns keep the order panel and its scroll state.
        if(!arrangementApplying&&(route.zoneId!==id||!['controls','colour','animations','effects','layout','animation-family'].includes(route.screen)))openLineSetup.delete(id);
        return navigate('controls',{zoneId:id});
      }
      if(action==='overview-receivers'){closeEffectDialog();receiverFilter=id==='unassigned'?'unassigned':'all';return navigate('receivers');}
      if(action==='overview-zone-new'){closeEffectDialog();return showNameDialog('zone-create');}
      if(action==='receiver-update-all')return receiverUpdates.openAll(standReceivers());
      if(action==='receiver-update'){const receiver=model.receivers.find(r=>r.id===id&&r.lifecycle==='added');if(receiver)return receiverUpdates.open(receiver);return;}
      if(action==='receiver-remove'){const receiver=model.receivers.find(r=>r.id===id);if(receiver)return receiverRemoval.open(receiver);return;}
      if(action==='receiver-filter'){if(!['all','unassigned'].includes(id))return;receiverFilter=id;return render({preserveScroll:true});}
      if(action==='receiver-pixel-setup'){
        const receiver=model.receivers.find(r=>r.id===id&&r.type==='SPI'&&r.lifecycle==='added');if(!receiver||managementBusy||pixelSetup.isOpen())return;
        managementBusy=true;button.disabled=true;
        try{
          const pending=nativeContext&&typeof runtime?.services?.outputConfigurationStatus==='function'
            ?await runtime.services.outputConfigurationStatus({standId:receiver.standId,receiverId:id}):{status:'none'};
          pixelSetupReceiverId=id;
          pixelSetup.open(pending.status==='pending'?{...receiver,outputs:pending.outputs}:receiver,{initialPort:selectedVisualPort(receiver),resumePending:pending.status==='pending'});
        }catch(_){toast('De vorige poortwijziging kon niet worden gelezen. Probeer opnieuw; er is niets gewist.');}
        finally{managementBusy=false;button.disabled=false;}return;
      }
      if(action==='zone-new')return showNameDialog('zone-create');
      if(action==='zone-options'){
        const z=M.getZone(model,id);if(!z)return;
        return showEffectDialog(z.name,`<button class="button secondary full" data-action="zone-rename" data-id="${esc(z.id)}">Naam wijzigen</button><button class="button secondary full" data-action="zone-delete" data-id="${esc(z.id)}">Zone verwijderen</button>`);
      }
      if(action==='zone-delete')return showZoneDelete(id);
      if(action==='zone-delete-confirm')return await confirmZoneDelete(id);
      if(action==='zone-rename'||action==='receiver-rename')return showNameDialog(action,id);
      if(action==='receiver-move')return showReceiverAssignment(id);
      if(action==='zone-assign')return showZoneReceiverPicker(id);
      if(action==='assignment-receiver')return showReceiverAssignment(id,button.dataset.zone);
      if(action==='assignment-many-type'){
        if(receiverAssignment?.mode!=='many')return;
        const z=M.getZone(model,receiverAssignment.zoneId);if(!z||z.type||!['RGBW','SPI'].includes(id))return;
        receiverAssignment.type=id;receiverAssignment.receiverIds=[];return renderZoneReceiverPicker(id);
      }
      if(action==='assignment-many-toggle'){
        if(receiverAssignment?.mode!=='many')return;
        const row=model.receivers.find(r=>r.id===id&&r.lifecycle==='added'&&r.standId===stand().id),z=M.getZone(model,receiverAssignment.zoneId);
        if(!row||!z||row.zoneId===z.id||row.type!==(z.type||receiverAssignment.type))return;
        receiverAssignment.receiverIds=receiverAssignment.receiverIds.includes(id)?receiverAssignment.receiverIds.filter(item=>item!==id):[...receiverAssignment.receiverIds,id];
        return syncZoneReceiverPicker();
      }
      if(action==='assignment-many-select-all'){
        if(receiverAssignment?.mode!=='many')return;
        const eligible=Array.from(document.querySelectorAll('[data-action="assignment-many-toggle"]'),row=>row.dataset.id);
        if(!eligible.length)return;
        receiverAssignment.receiverIds=eligible.every(id=>receiverAssignment.receiverIds.includes(id))?[]:eligible;
        return syncZoneReceiverPicker();
      }
      if(action==='assignment-many-confirm'){
        const assignment=receiverAssignment;if(assignment?.mode!=='many'||!assignment.receiverIds.length)return;
        const ids=[...assignment.receiverIds],zoneId=assignment.zoneId,target=M.getZone(model,zoneId);if(!target)return;
        const next=M.moveReceivers(model,ids,zoneId);
        return await updateManagement(next,`${ledlineCount(ids.length)} toegewezen aan ${target.name}.`,ids,{kind:'assignMany',receiverIds:ids,zoneId});
      }
      if(action==='layout-receiver-add'||action==='layout-new-receiver'){
        const target=stand()?.zones.find(z=>z.id===button.dataset.zone);if(!target)return;closeEffectDialog();
        setupReturnContext=arrangementBrowsing();arrangementDraft=null;
        return navigate('receiver-add',{zoneId:target.id,setupReturnZoneId:target.id});
      }
      if(action==='assignment-add-receiver'){
        const returnInline=main.querySelector('.ledline-setup');receiverAssignment=null;closeEffectDialog();
        if(returnInline){setupReturnContext=arrangementBrowsing();arrangementDraft=null;}
        return navigate('receiver-add',returnInline?{setupReturnZoneId:route.zoneId}:{});
      }
      if(action==='assignment-zone'){
        if(!receiverAssignment)return;receiverAssignment.zoneId=id||null;
        const r=model.receivers.find(r=>r.id===receiverAssignment.receiverId);
        document.querySelectorAll('[data-action="assignment-zone"]').forEach(el=>{el.setAttribute('aria-pressed',el.dataset.id===id);el.querySelector('i').textContent=el.dataset.id===id?'✓':'';});
        const confirm=document.querySelector('[data-action="assignment-confirm"]');confirm.disabled=receiverAssignment.zoneId===r.zoneId;confirm.textContent='Zone wijzigen';return;
      }
      if(action==='assignment-new-zone')return showNameDialog('zone-create',receiverAssignment?.receiverId);
      if(action==='assignment-back')return showReceiverAssignment(receiverAssignment.receiverId,receiverAssignment.zoneId);
      if(action==='assignment-confirm'){
        if(!receiverAssignment)return;const {receiverId,zoneId}=receiverAssignment;
        return await updateManagement(zoneId?M.assignReceiverToZone(model,receiverId,zoneId):M.unassignReceiver(model,receiverId),zoneId?`Verplaatst naar ${M.getZone(model,zoneId).name}.`:'Receiver staat bij Nog geen zone; hij blijft gekoppeld aan je stand.',receiverId,{kind:'assign',receiverId,zoneId});
      }
      if(action==='receiver-unassign')return showUnassign(id);
      if(action==='receiver-unassign-confirm')return await updateManagement(M.unassignReceiver(model,id),'Receiver uit de zone gehaald; hij blijft in je stand.',id,{kind:'assign',receiverId:id,zoneId:null});
      if(action==='management-name-save'){
        const name=document.getElementById('management-name').value.trim(),{kind,id:targetId}=nameDialog;
        if(kind==='zone-create'){
          const zoneId='zone-'+crypto.randomUUID();let next=M.createZone(model,stand().id,{id:zoneId,name});
          if(targetId)next=M.assignReceiverToZone(next,targetId,zoneId);
          const saved=await updateManagement(next,targetId?`Verplaatst naar ${name}.`:`Zone ${name} gemaakt.`,targetId,{kind:'create',zoneId,name,...(targetId?{receiverId:targetId}:{})});
          if(saved&&!targetId)navigate('controls',{zoneId});return;
        }
        return await updateManagement(kind==='zone-rename'?M.renameZone(model,targetId,name):M.renameReceiver(model,targetId,name),'Naam aangepast.',null,kind==='zone-rename'?{kind:'rename',zoneId:targetId,name}:{kind:'renameReceiver',receiverId:targetId,name});
      }
      if(action==='colour'&&route.screen==='controls'){
        rememberAnimationGallery();closeZoneMenus();controlMode='colour';render({top:true});return revealColourControls();
      }
      if(action==='animation-gallery'&&route.screen==='controls'&&activeEffect()){
        closeZoneMenus();
        const saved=animationGalleryPositions.get(route.zoneId);
        if(saved?.family){
          route={...route,screen:'animation-family',library:saved.library,family:saved.family,familyReturnScreen:'controls'};
          setSpatialPreviewCategory(libraryTab());controlMode='animations';showControlAnimationGallery=true;render({top:true});
          paint(performance.now()/1000);revealAnimationFamily();main.querySelector('#animation-family-title')?.focus({preventScroll:true});return;
        }
        route={...route,library:saved?.library||initialAnimationLibrary(),family:null,familyReturnScreen:null};
        setSpatialPreviewCategory(libraryTab());
        controlMode='animations';showControlAnimationGallery=true;return render({top:true});
      }
      if(action==='animations'&&route.screen==='controls'){
        rememberAnimationGallery();
        closeZoneMenus();
        const saved=animationGalleryPositions.get(route.zoneId);
        controlMode='animations';showControlAnimationGallery=!activeEffect();route={...route,family:saved?.family||null,library:saved?.library||initialAnimationLibrary(),effectsReturn:'controls'};setSpatialPreviewCategory(libraryTab());render({top:true});
        if(!showControlAnimationGallery)return revealAnimationStart();
        return;
      }
      if(action==='animation-current-edit'&&route.screen==='controls'&&activeEffect()){
        rememberAnimationGallery();showControlAnimationGallery=false;render({top:true});return revealAnimationStart();
      }
      if(action==='animations-gallery'&&route.screen==='animations'&&activeEffect()){
        controlMode='animations';showControlAnimationGallery=true;
        setSpatialPreviewCategory(initialAnimationLibrary());
        return navigate('controls',{zoneId:route.zoneId,family:null,library:initialAnimationLibrary(),effectsReturn:'controls'});
      }
      if(action==='animations'&&route.screen==='effects'&&route.effectsReturn==='controls'){controlMode='animations';showControlAnimationGallery=false;return navigate('controls',{zoneId:route.zoneId});}
      if(['stand','controls','colour','animations','layout','scenes','receivers','receiver-add','settings','pin-login'].includes(action))return navigate(action);
      if(action==='help')return showHelp();
      if(action==='close-help')return dismissDialog(document.getElementById('help'),closeHelp);
      if(action==='select'){
        if(continuousZone()&&id!=='all')return;
        if(id!=='all'&&!receivers().some(r=>r.id===id))return;
        if(id==='all')selections.set(route.zoneId,{kind:'all'});else toggleLineSelection(id);
        if(id==='all')expandedScopeZones.delete(route.zoneId);else expandedScopeZones.add(route.zoneId);
        // Keep the chosen line list open without moving the document; a
        // scrollIntoView here would pull the whole page away from the user.
        return render();
      }
      if(action==='scope-toggle-lines'){
        if(expandedScopeZones.has(route.zoneId))expandedScopeZones.delete(route.zoneId);else expandedScopeZones.add(route.zoneId);
        return render({preserveScroll:true});
      }
      if(action==='power'){const on=!powerTargets().every(r=>r.state.on!==false && r.state.power!==false);apply({on,power:on},{kind:'all'});if(standControlOpen)return;return render();}
      if(action==='warm-white'){
        const root=button.closest('[data-colour-picker]');if(root?.dataset.colourPicker!=='static')return;
        const values=C.warmWhite(C.warmthOf(pickerChannels(root))??50);
        return writePicker(root,values.slice(0,3),values[3]);
      }
      if(action==='swatch'||action==='brand-swatch'){
        if(colourOrderMode)return;
        const root=button.closest('[data-colour-picker]'),brandIndex=Number(id);
        const entry=action==='brand-swatch'&&Number.isInteger(brandIndex)&&brandIndex>=0&&brandIndex<currentBrandColors().length
          ?Colours.capture(t('brandColour',{number:brandIndex+1}),currentBrandColors()[brandIndex])
          :action==='swatch'?savedColours.colors.find(c=>c.id===id):null;
        if(!entry)return;
        if(['animation','background','brand'].includes(root?.dataset.colourPicker))writePicker(root,[entry.color.r,entry.color.g,entry.color.b],entry.color.w);
        else {apply({...Colours.restore(entry),rgbwLast:rememberedChannels(root,[entry.color.r,entry.color.g,entry.color.b],entry.color.w)});syncColour();const slider=document.querySelector('[data-setting="bri"]'),out=document.querySelector('[data-value-for="bri"]');if(slider)slider.value=entry.color.bri;if(out)out.textContent=entry.color.bri+'%';}return;
      }
      if(action==='colour-new')return saveCurrentColour(button);
      if(action==='colours-manager'){savedColours=colourStore.load();return showColourManager();}
      if(action==='colours-manage'){colourOrderMode=!colourOrderMode;return refreshColourLibraries(button);}
      if(action==='colour-remove'){
        const current=colourStore.load();if(current.error)return refreshColourLibraries(button,current.error.message);
        const index=current.colors.findIndex(entry=>entry.id===id);if(index<0)return;
        const entry=current.colors[index];if(entry.group==='brand'&&current.colors.filter(color=>color.group==='brand').length<=1)return toast('Bewaar minstens één merkkleur.');
        const result=colourStore.remove(id);if(result.error)return refreshColourLibraries(button,result.error.message);await confirmCentralLibrary(result);
        removedColour={entry:current.colors[index],index};savedColours=result;
        if(button.closest('[data-colour-manager]'))return showColourManager(`${removedColour.entry.name} verwijderd. Je kunt dit ongedaan maken.`);
        return refreshColourLibraries(button,`${removedColour.entry.name} verwijderd.`);
      }
      if(action==='colour-undo'){
        if(!removedColour)return;
        const {entry,index}=removedColour,result=colourStore.save(entry);if(result.error)return refreshColourLibraries(button,result.error.message);
        const ordered=colourStore.move(entry.id,Math.min(index,result.colors.length-1));
        await confirmCentralLibrary(ordered);
        savedColours=ordered.error?result:ordered;removedColour=null;
        if(button.closest('[data-colour-manager]'))return showColourManager(`${entry.name} teruggezet.`);
        return refreshColourLibraries(button,`${entry.name} teruggezet.${ordered.error?' De oorspronkelijke volgorde kon niet worden hersteld.':''}`);
      }
      if(action==='channel-step'){
        const input=button.closest('[data-colour-picker]').querySelector(`input[data-channel="${button.dataset.channel}"]`);input.value=Number(input.value)+Number(button.dataset.step);input.dispatchEvent(new Event('input',{bubbles:true}));return;
      }
      if(action==='channel-toggle'){
        const root=button.closest('[data-colour-picker]'),channel=button.dataset.channel,values=pickerChannels(root),index='rgbw'.indexOf(channel);
        if(index<0)return;
        values[index]=values[index]>0?0:restoreChannelValue(root,channel);
        writePicker(root,values.slice(0,3),values[3],channel==='w'?'white':'rgb');
        return;
      }
      if(action==='order-up'||action==='order-down'){const index=receivers().findIndex(r=>r.id===id),next=index+(action==='order-up'?-1:1);if(next<0||next>=receivers().length)return;return moveReceiver(id,next);}
      if(action==='scene-new'){if(!stand())return;sceneDraft={zoneIds:[],name:'',search:'',error:''};return navigate('scene-draft');}
      if(action==='scene-edit'){
        const scene=savedScenes.scenes.find(item=>item.id===id&&item.standId===stand()?.id);if(!scene)return;
        const validZones=new Set(stand().zones.filter(zone=>M.zoneReceivers(model,zone.id).length).map(zone=>zone.id));
        const zoneIds=scene.zones.filter(saved=>validZones.has(saved.id)&&stand().zones.some(zone=>zone.id===saved.id&&zone.type===saved.type)).map(saved=>saved.id);
        sceneDraft={sceneId:scene.id,zoneIds,name:scene.name,search:'',error:'',omittedZoneCount:scene.zones.length-zoneIds.length};
        return navigate('scene-draft');
      }
      if(action==='scene-zone'){
        if(!sceneDraft||!stand()?.zones.some(z=>z.id===id)||!M.zoneReceivers(model,id).length)return;
        sceneDraft.zoneIds=sceneDraft.zoneIds.includes(id)?sceneDraft.zoneIds.filter(z=>z!==id):[...sceneDraft.zoneIds,id];return syncSceneDraft();
      }
      if(action==='scene-select-all'||action==='scene-clear-selection'){
        if(!sceneDraft||!stand())return;sceneDraft.zoneIds=action==='scene-select-all'?stand().zones.filter(z=>M.zoneReceivers(model,z.id).length).map(z=>z.id):[];return syncSceneDraft();
      }
      if(action==='scene-save'){
        if(!sceneDraft||!stand())return;
        const editingId=sceneDraft.sceneId,scene=Scenes.capture(model,stand().id,sceneDraft.zoneIds,sceneDraft.name,{id:editingId}),result=sceneStore.save(scene);if(result.error){sceneDraft.error='Opslaan is niet gelukt. Je naam en gekozen zones blijven bewaard. Probeer opnieuw.';syncSceneDraft();return toast(result.error.message);}
        await confirmCentralLibrary(result);savedScenes=result;sceneDraft=null;if(editingId)navigate('scene-detail',{sceneId:editingId});else navigate('scenes');toast(editingId?'Scène bijgewerkt met het huidige licht. Er is niets geactiveerd.':'Scène opgeslagen. Je verlichting is niet veranderd.');return;
      }
      if(action==='scene-open'){sceneDetailSearch='';if(button.closest('#effect-dialog'))closeEffectDialog();return navigate('scene-detail',{sceneId:id});}
      if(action==='stand-scenes'){if(document.getElementById('effect-dialog').open)closeEffectDialog();return navigate('scenes');}
      if(action==='scene-rename')return showSceneNameDialog(id);
      if(action==='scene-rename-save'){
        if(!savedScenes.scenes.some(scene=>scene.id===id&&scene.standId===stand()?.id))return;
        const input=document.getElementById('scene-rename-name');if(!input)return;
        const result=sceneStore.rename(id,input.value);
        if(result.error)throw Error(result.error.message);
        await confirmCentralLibrary(result);
        savedScenes=result;closeEffectDialog();render({preserveScroll:true});toast('Scènenaam gewijzigd. Je verlichting blijft hetzelfde.');return;
      }
      if(action==='scene-apply'){
        const scene=savedScenes.scenes.find(item=>item.id===id&&item.standId===stand()?.id);if(!scene)return;
        const check=Scenes.compatibility(model,scene);if(!check.ok){toast(`${check.reason} Er is niets gewijzigd.`);return;}
        try{model=Scenes.apply(model,scene);}catch(error){toast(`${error.message} Er is niets gewijzigd.`);return;}
        sendReceiverStates(scene.zones.flatMap(item=>item.receivers.map(receiver=>receiver.id)));render();toast(nativeContext?'Scène wordt naar de receivers verstuurd.':'Scène direct geactiveerd in het voorbeeld.');return;
      }
      if(action==='scene-delete'){const scene=savedScenes.scenes.find(s=>s.id===id&&s.standId===stand().id);if(!scene)return;showEffectDialog('Scène verwijderen?',`<p>“${esc(scene.name)}” wordt uit je opgeslagen scènes verwijderd. Je verlichting verandert niet.</p><button class="button full" data-action="scene-delete-confirm" data-id="${esc(id)}">Scène verwijderen</button><button class="button secondary full" data-action="effect-dialog-close">Behouden</button>`);return;}
      if(action==='scene-delete-confirm'){const result=sceneStore.remove(id);if(result.error)return toast(result.error.message);await confirmCentralLibrary(result);savedScenes=result;closeEffectDialog();return navigate('scenes');}
      if(action==='effects'||action==='effects-root'||action==='animations-gallery'){
        closeZoneMenus();
        if(route.screen==='controls'){
          controlMode='animations';showControlAnimationGallery=true;route={...route,family:null,familyReturnScreen:null,library:initialAnimationLibrary(),effectsReturn:'controls'};setSpatialPreviewCategory(initialAnimationLibrary());return render({top:true});
        }
        const returnScreen=route.screen==='controls'||route.effectsReturn==='controls'?'controls':'animations';
        return navigate('effects',{family:null,library:initialAnimationLibrary(),effectsReturn:returnScreen});
      }
      if(action==='animation-search-clear'){const search=document.getElementById('animation-search');if(search){search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));}return;}
      if(action==='family'){
        closeZoneMenus();
        const group=Library.group(catalogue(),id);if(!group)return;
        animationFamilyReturnPositions.set(route.zoneId,{family:id,screen:route.screen,scrollY:window.scrollY,viewportTop:button.getBoundingClientRect().top});
        route={...route,screen:'animation-family',family:id,familyReturnScreen:route.screen};render({top:true});
        paint(performance.now()/1000);revealAnimationFamily();
        main.querySelector('#animation-family-title')?.focus({preventScroll:true});
        return;
      }
      if(action==='family-back'){
        closeZoneMenus();
        const savedGallery=animationGalleryPositions.get(route.zoneId);
        if(savedGallery)animationGalleryPositions.set(route.zoneId,{...savedGallery,family:null});
        route={...route,screen:route.familyReturnScreen||'controls',family:null,familyReturnScreen:null};render();restoreAnimationFamilyList();
        return;
      }
      if(action==='animation-categories')return showAnimationCategories();
      if(action==='animation-category-choice'){
        if(!button.closest('[data-animation-categories]'))return;
        const previous=libraryTab();closeEffectDialog();
        if(id!==previous)chooseAnimationCategory(id);
        main.querySelector('[data-action="animation-categories"]')?.focus({preventScroll:true});
        return;
      }
      if(action==='brand-tone'){
        const tone=BRAND_TONES.find(item=>item.id===id);if(!tone)return;
        const [r,g,b]=rgbOf({colors:[tone.value]});
        if(saveBrandColors([{r,g,b,w:0,bri:100}]))main.querySelector(`[data-action="brand-tone"][data-id="${CSS.escape(id)}"]`)?.focus({preventScroll:true});
        return;
      }
      if(action==='brand-colour-edit')return showBrandEditor(Number(id));
      if(action==='brand-colour-add')return showBrandEditor(currentBrandColors().length);
      if(action==='brand-colour-remove'){
        const palette=currentBrandColors(),index=Number(id);
        if(palette.length<=1||!Number.isInteger(index)||index<0||index>=palette.length)return;
        palette.splice(index,1);
        if(saveBrandColors(palette))main.querySelector(`[data-action="brand-colour-edit"][data-id="${Math.min(index,palette.length-1)}"]`)?.focus({preventScroll:true});
        return;
      }
      if(action==='library'){
        if(route.screen==='controls'&&button.closest('[data-control-mode="animations"]'))return chooseAnimationCategory(id==='all'?'catalogue':id);
        animationQueries.delete(route.zoneId);
        if(route.screen!=='effects'){setSpatialPreviewCategory(id);return navigate('effects',{family:null,library:id});}
        route={...route,family:null,library:id};setSpatialPreviewCategory(id);return render();
      }
      if(action==='effect'){
        const effect=catalogue().find(e=>e.id===id);if(!effect)return;
        const requiresWholeZone=effect.requireTogether||effect.category==='tunnel';
        const available=physicalLineCount(requiresWholeZone?receivers():selected());
        if(available<(effect.minimumReceivers||1))return;
        // A spatial animation is a zone effect: include every connected
        // ledline as a single playback group automatically. Users can still
        // choose one line later in the editor to make its colour different.
        if(requiresWholeZone&&selection().kind!=='all')storeLineSelection(receivers().map(receiver=>receiver.id));
        setSpatialPreviewCategory(effect.category==='tunnel'?'tunnel':'');
        rememberAnimationGallery();apply(effectState(effect),selection(),{freshRecipe:true});settingsOpen=false;
        if(route.screen==='animation-family'){
          controlMode='animations';showControlAnimationGallery=false;
          route={...route,screen:'controls',familyReturnScreen:null,effectsReturn:'controls'};
          render({top:true});return revealAnimationStart();
        }
        if(route.screen==='controls'&&button.closest('[data-control-mode="animations"]')){controlMode='animations';showControlAnimationGallery=false;render({top:true});return revealAnimationStart();}
        if(route.screen==='effects'&&route.effectsReturn==='controls'){controlMode='animations';showControlAnimationGallery=false;navigate('controls',{zoneId:route.zoneId});return revealAnimationStart();}
        navigate('animations');return revealAnimationStart();
      }
      if(action==='palette-edit')return showPaletteEditor(Number(id));
      if(action==='palette-add')return changePalette();
      if(action==='palette-remove')return changePalette(Number(id));
      if(action==='background-toggle'){if(!activeEffect()?.backgroundEditable)return;apply({backgroundOn:!selectedState().backgroundOn});syncBackground();return;}
      if(action==='background-edit'){
        if(!activeEffect()?.backgroundEditable)return;
        showEffectDialog('Achtergrondkleur',`${dialogAnimationPreview()}${colourPickerMarkup('background')}`);
        paintWheel();syncColour();return;
      }
      if(action==='visual-port'){
        const rid=button.dataset.receiver,r=model.receivers.find(r=>r.id===rid);if(r?.type!=='SPI')return;
        event.preventDefault();const scroll=window.scrollY;
        visualPorts.set(rid,Number(id));
        const motion=receiverPlugMotion(rid);motion.clear();motion.trigger(Number(id),performance.now()/1000,true);
        const details=button.closest('details');details.querySelectorAll('[data-action="visual-port"]').forEach(el=>el.setAttribute('aria-pressed',el===button));
        details.querySelectorAll('[data-port-row]').forEach(el=>el.classList.toggle('port-focused',Number(el.dataset.portRow)===Number(id)));
        details.querySelector('.receiver-product-caption strong').textContent=`Uitgang ${id} geselecteerd`;
        paint(performance.now()/1000);button.focus({preventScroll:true});if(window.scrollY!==scroll)window.scrollTo({top:scroll,behavior:'instant'});return;
      }
      if(action==='receiver-port-enabled'){
        const receiver=model.receivers.find(r=>r.id===button.dataset.receiver&&r.type==='SPI'&&r.lifecycle==='added'),port=Number(button.dataset.port),output=receiver?.outputs.find(o=>o.port===port);if(!output)return;
        if(output.enabled&&receiver.outputs.filter(o=>o.enabled).length===1)return toast('Gebruik minstens één uitgang.');
        if(!output.enabled&&!window.LightningPixelSetup.editablePixels(output.pixels))return toast('Stel eerst de lengte in via Pixels / aansluiting instellen. Maximaal 6,3 meter per strip.');
        const next=M.configureSpiOutput(model,receiver.id,port,{enabled:!output.enabled});
        void orderIdentification?.supersede();
        if(nativeContext){
          if(typeof runtime?.services?.configureOutputs!=='function')return toast('Verbind je telefoon met het wifi van je installatie om de uitgangen te wijzigen.');
          if(managementBusy)return;managementBusy=true;button.disabled=true;
          try{const view=await runtime.services.configureOutputs({standId:receiver.standId,receiverId:receiver.id,outputs:next.receivers.find(r=>r.id===receiver.id).outputs});refreshSuspendedSetup(view);model=keepLocalPreviewStates(view.model);}
          catch(error){toast(outputConfigurationErrorMessage(error));return;}
          finally{managementBusy=false;button.disabled=false;}
        }else model=M.assertValid(next);
        resumeConfiguredLighting(receiver.id);
        receiverPlugMotion(receiver.id).trigger(port,performance.now()/1000,!output.enabled);
        const blink=identifying.get(receiver.id),enabled=model.receivers.find(r=>r.id===receiver.id).outputs.filter(o=>o.enabled).map(o=>o.port);
        if(blink){blink.ports=blink.scope==='all'?enabled:blink.ports.filter(p=>enabled.includes(p));if(!blink.ports.length)identifying.delete(receiver.id);}
        expandedReceivers.add(receiver.id);render({preserveScroll:true});
        main.querySelector(`[data-action="receiver-port-enabled"][data-receiver="${CSS.escape(receiver.id)}"][data-port="${port}"]`)?.focus({preventScroll:true});return;
      }
      if(action==='visual-identify'||action==='port-identify'){
        event.preventDefault();const receiver=model.receivers.find(r=>r.id===button.dataset.receiver&&r.lifecycle==='added');
        if(receiver)toggleIdentification(receiver,action==='visual-identify'?'all':button.dataset.port);return;
      }
      if(action==='effect-dialog-close')return dismissEffectDialog();
      if(action==='preset-save')return showSavePreset();
      if(action==='preset-confirm'){
        try {
          const preset=S.capture(document.getElementById('preset-name').value,activeEffect(),selectedState());
          const result=presetStore.save(preset);if(result.error)throw Error(result.error.message);
          await confirmCentralLibrary(result);
          savedPresets=result;closeEffectDialog();
          if(route.screen==='controls'){controlMode='animations';render({preserveScroll:true});toast('Animatie bewaard in Mijn animaties.');return;}
          navigate('effects',{library:'presets',family:null,effectsReturn:'animations'});toast('Animatie bewaard in Mijn animaties.');
        }catch(error){const el=document.querySelector('.dialog-error');el.textContent=error.message;el.hidden=false;}
        return;
      }
      if(action==='preset-apply'){
        const preset=savedPresets.presets.find(p=>p.id===id);if(!preset)return;
        const restored=S.restore(preset,presetContext(),catalogue());if(!restored.compatible)return toast(restored.reason);
        apply({...backgroundDefaults(),...restored.state,v30Effect:restored.state.v30Effect||null,previewFamily:restored.state.previewFamily||null});settingsOpen=false;
        if(route.screen==='controls'&&button.closest('[data-control-mode="animations"]')){controlMode='animations';showControlAnimationGallery=false;return render({preserveScroll:true});}
        if(route.screen==='effects'&&route.effectsReturn==='controls'){controlMode='animations';return navigate('controls',{zoneId:route.zoneId});}
        return navigate('animations');
      }
      if(action==='preset-delete'){
        const preset=savedPresets.presets.find(p=>p.id===id);if(!preset)return;
        showEffectDialog('Animatie verwijderen?',`<p>“${esc(preset.name)}” verdwijnt uit Mijn animaties. Het huidige licht verandert niet.</p><button class="button full" data-action="preset-delete-confirm" data-id="${esc(id)}">Animatie verwijderen</button><button class="button secondary full" data-action="effect-dialog-close">Behouden</button>`);return;
      }
      if(action==='preset-delete-confirm'){
        const result=presetStore.remove(id);if(result.error)return toast(result.error.message);
        await confirmCentralLibrary(result);
        savedPresets=result;closeEffectDialog();return render();
      }
      if(action==='setting-reset'){
        const effect=activeEffect();if(!effect||(!effect.controls.includes(id)&&id!=='bri'&&!(id==='bgBrightness'&&effect.backgroundEditable)))return;
        const value=settingDefault(id);if(value===undefined)return;
        apply({[id]:value});const input=document.querySelector(`[data-setting="${CSS.escape(id)}"]`);if(input){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}else render();return;
      }
      if(action==='settings-toggle'){
        settingsOpen=!settingsOpen;const revision=++advancedSettingsRevision,panel=document.getElementById('animation-settings');
        button.setAttribute('aria-expanded',settingsOpen);button.setAttribute('aria-label',t(settingsOpen?'animationAdvancedClose':'animationAdvancedOpen'));
        setPanelHidden(panel,!settingsOpen,()=>keepAdvancedSettingsActionVisible(button,panel,revision));
        if(settingsOpen)keepAdvancedSettingsActionVisible(button,panel,revision,true);return;
      }
      if(action==='direction'){apply({direction:button.dataset.value});document.querySelectorAll('[data-action="direction"]').forEach(el=>el.setAttribute('aria-pressed',el===button));syncSettingResets();return;}
      if(action==='effect-boolean'){if(!['bounce','mirror'].includes(id)||!activeEffect()?.controls.includes(id))return;const value=!selectedState()[id];apply({[id]:value});button.setAttribute('aria-pressed',value);button.querySelector('b').textContent=value?'Aan':'Uit';syncSettingResets();return;}
      if(action==='set-layout'){
        // A different explicit control interrupts an unfinished reorder even
        // when the chosen layout is already active and needs no storage write.
        if(dragOrder)finishOrder({pointerId:dragOrder.pointerId},true);
        if(zone()?.layout===id)return;
        const next=await persistManagement(M.setLayout(model,route.zoneId,id),{kind:'layout',zoneId:route.zoneId,layout:id});
        if(!next)return;model=next;if(continuousZone())selections.set(route.zoneId,{kind:'all'});
        // Saving layout is local metadata. Re-send unchanged light intent so
        // the native owner applies that confirmed geometry to every member.
        if(nativeContext)sendReceiverStates(M.zoneReceivers(model,route.zoneId).map(item=>item.id),{remember:false});
        return render();
      }
    }catch(error){const message=error.message||'Dit kon nog niet worden toegepast.',notice=document.querySelector('#effect-dialog[open] .dialog-error');if(notice){notice.textContent=message;notice.hidden=false;}else toast(message);}
  });
  document.addEventListener('input',event=>{
    if(arrangementApplying)return;
    const input=event.target;
    try {
      if(input.matches('[data-security-pin],[data-security-pin-repeat]')){
        const panel=input.closest('[data-pin-protection-dialog]'),first=panel?.querySelector('[data-security-pin]'),repeat=panel?.querySelector('[data-security-pin-repeat]');
        if(panel)panel.querySelector('[data-action="pin-protection-save"]').disabled=!/^\d{8,12}$/.test(first.value)||first.value!==repeat.value;
        return;
      }
      if(input.id==='management-name'){document.querySelector('[data-action="management-name-save"]').disabled=!input.value.trim();return;}
      if(input.id==='preset-name'){document.querySelector('[data-action="preset-confirm"]').disabled=!input.value.trim();return;}
      if(input.id==='animation-search'){
        const value=input.value;animationQueryStore().set(animationQueryKey(),value);
        // Preserve the input focus, caret and scroll while filtering.
        const library=input.closest('.animation-library-inline'),heading=library?.querySelector('#animation-selector-heading'),guidance=library?.querySelector('.animation-library-guidance');
        if(heading)heading.textContent=value.trim()?t('chooseAnimation'):t('animationGroupChooserTitle');
        if(guidance)guidance.textContent=value.trim()?t('animationSearchChooseHint'):t('animationGroupChooserIntro');
        if(!value.trim()){standControlOpen?renderStandControls():render();document.getElementById('animation-search')?.focus({preventScroll:true});return;}
        const results=document.getElementById('animation-results');results.querySelectorAll('canvas[data-preview]').forEach(c=>previews.delete(c.dataset.preview));results.innerHTML=effectResults(value);paint(performance.now()/1000);return;
      }
      if(input.id==='animation-category')return chooseAnimationCategory(input.value);
      if(input.id==='scene-name'){if(sceneDraft){sceneDraft.name=input.value;syncSceneDraft();}return;}
      if(input.id==='scene-rename-name'){
        const save=document.querySelector('[data-action="scene-rename-save"]');
        const scene=savedScenes.scenes.find(scene=>scene.id===save?.dataset.id);
        if(save)save.disabled=!input.value.trim()||input.value.trim()===scene?.name;
        return;
      }
      if(input.id==='scene-zone-search'){if(sceneDraft){sceneDraft.search=input.value;filterSceneZones('draft');}return;}
      if(input.id==='scene-detail-search'){sceneDetailSearch=input.value;filterSceneZones('detail');return;}
      if(input.dataset.effectColour!==undefined)return updatePalette(Number(input.dataset.effectColour),input.value);
      if(input.dataset.effectWhite!==undefined){document.getElementById('palette-white-value').textContent=input.value;return updatePalette(Number(input.dataset.effectWhite),undefined,Number(input.value));}
      if(input.matches('input[data-channel-number]')){
        if(!/^\d{1,3}$/.test(input.value)||Number(input.value)>255)return;
        const range=input.closest('[data-colour-picker]')?.querySelector(`input[data-channel="${input.dataset.channelNumber}"]`);
        if(!range)return;
        range.value=input.value;range.dispatchEvent(new Event('input',{bubbles:true}));return;
      }
      if(input.matches('input[data-channel]')){
        const root=input.closest('[data-colour-picker]'),rgb=['r','g','b'].map(key=>Number(root.querySelector(`input[data-channel="${key}"]`).value));
        return writePicker(root,rgb,Number(root.querySelector('input[data-channel="w"]').value),input.dataset.channel==='w'?'white':'rgb');
      }
      if(input.matches('input[data-warmth]')){
        const root=input.closest('[data-colour-picker]');if(input.disabled||root?.dataset.colourPicker!=='static')return;
        const values=C.warmWhite(Number(input.value));return writePicker(root,values.slice(0,3),values[3]);
      }
      if(input.dataset.setting){const key=input.dataset.setting;apply({[key]:Number(input.value)});document.querySelector(`[data-value-for="${key}"]`).textContent=animationSettingValue(key,input.value,input.dataset.unit||'');syncSettingResets();}
    }catch(error){toast(error.message);}
  });
  document.addEventListener('change',event=>{
    const brandName=event.target.closest?.('input[data-brand-name]');
    if(brandName){
      if(!brandEditor)return;
      const name=brandName.value.trim(),status=brandName.closest('[data-colour-picker]')?.querySelector('.brand-picker-status');
      if(!name||name.length>64){brandName.value=brandEditor.name; if(status)status.textContent=t('brandNameInvalid');return;}
      const colors=currentBrandColors();colors[brandEditor.index]={...colors[brandEditor.index],name};
      if(saveBrandColors(colors)){brandEditor.name=name;brandName.value=name;}
      return;
    }
    const number=event.target.closest?.('input[data-channel-number]');if(!number)return;
    const root=number.closest('[data-colour-picker]'),range=root?.querySelector(`input[data-channel="${number.dataset.channelNumber}"]`);if(!range)return;
    const raw=Number(number.value),value=number.value.trim()===''?Number(range.value):Math.max(0,Math.min(255,Math.round(Number.isFinite(raw)?raw:Number(range.value))));
    number.value=String(value);
    if(range.value!==String(value)){range.value=String(value);range.dispatchEvent(new Event('input',{bubbles:true}));}
  });
  document.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.matches?.('input[data-channel-number]'))event.target.blur();});
  document.addEventListener('pointerdown',event=>{
    const control=event.target.closest?.('input[type="range"],canvas.wheel');
    if(event.button===0&&control?.closest('[data-colour-picker="static"]')&&activeStaticGesturePointer===null){
      holdStaticFeedback(control);activeStaticGesturePointer=event.pointerId;liveController?.beginGesture();
    }
  },true);
  document.addEventListener('pointerdown',event=>{
    const handle=event.target.closest('.order-handle');if(!handle||handle.disabled||managementBusy||route.screen!=='layout'||event.button!==0||event.isPrimary===false||dragOrder)return;
    const row=handle.closest('[data-order-receiver]');event.preventDefault();handle.setPointerCapture(event.pointerId);
    dragOrder={id:row.dataset.orderReceiver,index:receivers().findIndex(r=>r.id===row.dataset.orderReceiver),zoneId:route.zoneId,pointerId:event.pointerId,handle};row.classList.add('drag-source');
  });
  document.addEventListener('pointermove',event=>{
    if(!dragOrder||dragOrder.pointerId!==event.pointerId)return;event.preventDefault();
    if(!dragOrder.handle.isConnected||route.screen!=='layout'||route.zoneId!==dragOrder.zoneId||managementBusy)return finishOrder(event,true);
    const rows=Array.from(document.querySelectorAll('[data-order-receiver]'));if(!rows.length)return;
    const closest=rows.reduce((a,b)=>Math.abs(event.clientY-(a.getBoundingClientRect().top+a.offsetHeight/2))<Math.abs(event.clientY-(b.getBoundingClientRect().top+b.offsetHeight/2))?a:b);
    dragOrder.index=rows.indexOf(closest);rows.forEach(row=>row.classList.toggle('drag-target',row===closest));
  });
  function finishOrder(event,cancel=false){
    if(!dragOrder||dragOrder.pointerId!==event.pointerId)return;const drag=dragOrder;dragOrder=null;
    if(drag.handle.hasPointerCapture(event.pointerId))drag.handle.releasePointerCapture(event.pointerId);
    document.querySelectorAll('.drag-source,.drag-target').forEach(el=>el.classList.remove('drag-source','drag-target'));
    if(!cancel&&route.screen==='layout'&&route.zoneId===drag.zoneId)moveReceiver(drag.id,drag.index);
  }
  document.addEventListener('pointerup',event=>finishOrder(event));
  document.addEventListener('pointercancel',event=>finishOrder(event,true));
  document.addEventListener('lostpointercapture',event=>finishOrder(event,true));
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&dragOrder){event.preventDefault();finishOrder({pointerId:dragOrder.pointerId},true);}
    const handle=event.target.closest?.('.order-handle');
    if(handle&&route.screen==='layout'&&!managementBusy&&['ArrowUp','ArrowDown'].includes(event.key)){
      event.preventDefault();const id=handle.closest('[data-order-receiver]').dataset.orderReceiver,index=receivers().findIndex(r=>r.id===id),next=index+(event.key==='ArrowUp'?-1:1);
      if(next>=0&&next<receivers().length)moveReceiver(id,next);
    }
  });
  document.addEventListener('click',event=>{
    const summary=event.target.closest?.('summary'),details=summary?.parentElement;
    if(!details?.matches('.stand-fine-controls,details[data-receiver-detail]')||summary!==details.querySelector(':scope > summary'))return;
    // Buttons such as Knipperen, drag handles and their keyboard activation
    // belong to their own action, never to the enclosing disclosure.
    if(event.target.closest?.('button,a,input,select,textarea,[role="button"]'))return;
    if(event.defaultPrevented||event.button!==0)return;
    if(event.metaKey||event.ctrlKey||event.altKey||event.shiftKey){cancelDetailFold(details);return;}
    if(detailFoldMotion.matches||typeof details.animate!=='function')return;
    event.preventDefault();animateDetailFold(details);summary.focus({preventScroll:true});
  });
  document.addEventListener('toggle',event=>{
    if(event.target.matches?.('[data-receiver-connections]')&&event.target.isConnected){
      const id=event.target.dataset.receiverConnections;event.target.open?expandedConnections.add(id):expandedConnections.delete(id);return;
    }
    const details=event.target;if(!details.matches?.('[data-receiver-detail]')||!details.isConnected)return;
    const open=detailFolds.get(details)?.open??details.open;
    open?expandedReceivers.add(details.dataset.receiverDetail):expandedReceivers.delete(details.dataset.receiverDetail);
    if(!open)visualPlugMotions.delete(details.dataset.receiverDetail);
  },true);
  inlineOrderDrag=window.LightningLedlineOrderDrag?.install({
    root:document,
    getItems:()=>!arrangementInteractionBusy()&&!arrangementNeedsStandOpen()&&openLineSetup.has(route.zoneId)&&arrangementDraft?.zoneId===route.zoneId?[...arrangementDraft.lineOrder]:[],
    getRowId:row=>row.dataset.orderItem,
    getScrollBounds:()=>({top:Math.max(0,main.querySelector('.control-dock-surface')?.getBoundingClientRect().bottom||0)+8,bottom:Math.min(innerHeight,document.getElementById('navigation')?.getBoundingClientRect().top||innerHeight)-8}),
    onActivity:()=>{if(!arrangementInteractionBusy()&&orderIdentificationState?.active)void orderIdentification?.interaction();},
    onStatus:text=>{const status=main.querySelector('.order-drop-status');if(status)status.textContent=text;},
    onInteraction:active=>{
      if(active&&!arrangementInteractionBusy()){if(orderIdentificationState?.active)void orderIdentification?.interaction();else beginOrderColours();}
      if(!active&&orderRenderDeferred){orderRenderDeferred=false;queueMicrotask(()=>renderArrangement());}
    },
    onDrop:async({id,toIndex})=>{
      const draft=arrangementDraft;
      if(!draft||!openLineSetup.has(route.zoneId)||draft.zoneId!==route.zoneId||arrangementInteractionBusy()||arrangementNeedsStandOpen())return syncArrangementControls();
      if(draft.signature!==arrangementSignature())return renderArrangement();
      const from=draft.lineOrder.indexOf(id);
      if(from<0||toIndex<0||toIndex>=draft.lineOrder.length||from===toIndex)return;
      draft.lineOrder.splice(from,1);draft.lineOrder.splice(toIndex,0,id);
      const saved=await applyArrangement();
      const handle=main.querySelector(`[data-order-item="${CSS.escape(id)}"] [data-order-handle]`);
      handle?.focus({preventScroll:true});
      const physical=M.zoneLedlines(model,route.zoneId).find(line=>line.id===id),receiver=model.receivers.find(r=>r.id===physical?.receiverId);
      const status=main.querySelector('.order-drop-status');if(status)status.textContent=saved?`${receiver?.name||'Ledline'}${physical?.port?' · P'+physical.port:''} · plaats ${toIndex+1}`:'';
    }
  });
  document.addEventListener('pointerdown',event=>{
    const target=event.target.closest?.('input[type="range"],canvas.wheel');
    if(event.button===0&&target&&main.contains(target)&&!activeControlPointer)activeControlPointer={id:event.pointerId,target,context:motionContextKey()};
  });
  for(const name of ['pointerup','pointercancel','lostpointercapture'])document.addEventListener(name,event=>{
    if(activeStaticGesturePointer===event.pointerId){activeStaticGesturePointer=null;releaseStaticFeedbackHold();liveController?.endGesture();}
    if(activeControlPointer?.id!==event.pointerId)return;
    activeControlPointer=null;
    if(controlRenderDeferred){controlRenderDeferred=false;queueMicrotask(()=>render({preserveScroll:true}));}
  });
  function resumePinConnection(){
    if(simpleStandMode)return;
    if(document.visibilityState!=='visible')return;
    const standId=securityStand()?.id;
    if(pinProtectionRead&&!currentPinProtectionOperation(pinProtectionRead))rememberPinProtectionRead(pinProtectionRead);
    if(pinProtectionWrite&&!currentPinProtectionOperation(pinProtectionWrite))rememberPinProtectionRead(pinProtectionWrite);
    const cue=pinProtectionNeedsRefresh();
    if(cue||(pinProtection&&pinProtection.standId===standId&&pinProtection.status==='pending')||pinProtectionPendingCheckStandId===standId){
      if(route.screen==='settings'){
        if(pinProtectionLoading||pinProtectionBusy){if(cue)cue.queued=true;}
        else void refreshPinProtection();
      }
      return;
    }
    if(pinProtectionReconnect)void refreshPinProtection({afterReconnect:true});
  }
  window.addEventListener('pagehide',invalidatePinProtectionRead);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')invalidatePinProtectionRead();});
  window.addEventListener('online',()=>{if(pinProtection?.status==='pending'||pinProtectionPendingCheckStandId||pinProtectionNeedsRefresh())resumePinConnection();});
  window.addEventListener('focus',resumePinConnection);document.addEventListener('visibilitychange',resumePinConnection);
  window.addEventListener('offline',()=>void orderIdentification?.offline());
  window.addEventListener('focus',wakeCentralStand);
  window.addEventListener('lightning:native-active',wakeCentralStand);
  window.addEventListener('online',wakeCentralStand);
  window.addEventListener('lightning:stand-share-available',()=>{standLinkPending=true;void consumeStandShareLink();});
  window.addEventListener('focus',()=>{if(standLinkPending)void consumeStandShareLink();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&standLinkPending)void consumeStandShareLink();});
  document.addEventListener('visibilitychange',()=>{if(!simpleStandMode||!standSession)return;if(document.hidden)standSession.pause();else wakeCentralStand();});
  window.addEventListener('pagehide',()=>standSession?.pause());
  window.addEventListener('pagehide',()=>void orderIdentification?.hide());
  window.addEventListener('pagehide',()=>{activeControlPointer=null;controlRenderDeferred=false;activeStaticGesturePointer=null;releaseStaticFeedbackHold();liveController?.cancelGesture();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){activeControlPointer=null;controlRenderDeferred=false;activeStaticGesturePointer=null;releaseStaticFeedbackHold();liveController?.cancelGesture();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)void orderIdentification?.hide();});
  window.LightningV30=Object.freeze({snapshot:()=>copy({model,route,selection:selection()}),version:'32.0.0-stability',hardwareEnabled:false});
  async function loadNativeState(){
    if(nativeLoading)return;nativeLoading=true;nativeLoadError=false;render();
    legacyStandLandingId=null;legacyStandReturn=null;
    try{
      if(typeof runtime?.services?.loadState!=='function')throw Error('NATIVE_UNAVAILABLE');
      const startupCapabilities=await refreshStandCapabilities();simpleStandMode=simpleStandSupported;
      const state=await runtime.services.loadState();
      if(state.model?.demo!==false)throw Error('NATIVE_MODEL_INVALID');
      const restored=M.assertValid(state.model);
      const standId=restored.stands[0]?.id||state.draft?.stand?.id;
      let startupSession=null,startupError=null;
      if(simpleStandSupported&&!standMigrationReady){
        try{startupSession=await runtime.services.standSessionStatus();}
        catch(error){startupError=error?.code||'STAND_CONNECTION_UNAVAILABLE';}
        // Until migration is available, an explicitly disconnected native
        // channel must not displace the customer's existing GEN0 landing.
        // This cache is still never authority for a new StandSession write.
        if(startupSession?.status==='disconnected'&&restored.stands.length){simpleStandMode=false;legacyStandLandingId=standId;}
      }
      if(!simpleStandSupported&&standId&&typeof runtime.services.securityPreference==='function'){
        const preference=await runtime.services.securityPreference({standId});
        if(typeof preference?.pinRequired!=='boolean')throw Error('SECURITY_PREFERENCE_UNCONFIRMED');
        window.AluvisionSecurityMode?.updateFromNative?.({pinRequired:preference.pinRequired});
      }
      if(state.draft)onboarding.restore(state.draft);
      model=restored;
      if(simpleStandSupported&&standMigrationReady){
        let marker=readFirstAccessMarker(restored),inspection=null;
        const singleMain=restored.receivers.length===1&&restored.receivers[0].role==='main'&&restored.receivers[0].lifecycle==='added'&&restored.receivers[0].onboardingTransactionId;
        // Recover the crash gap after native publication but before the
        // local presentation marker. Neither cache nor network failure can
        // classify a receiver as factory/new or complete the customer flow.
        if(marker||singleMain){
          try{inspection=await ensureStandSession().inspect({expectedStandId:standId});}
          catch(_){/* Retain published setup; unavailable is neither fresh nor complete. */}
          // This is only a presentation hold for an already published MAIN.
          // No cached identity authorizes writes or declares factory status.
          // A fresh wifi-ready observation leaves a completed stand on its
          // ordinary reconnect path; all other results need explicit proof.
          if(!marker&&singleMain&&inspection?.status!=='wifi-ready')marker=firstAccessMarker(restored,restored.receivers[0].id);
        }
        if(marker){
          firstAccessCheckpoint=copy(marker);simpleStandMode=true;nativeLoaded=true;
          let phase=inspection?.status==='migration-required'?'pin':inspection?.status==='wifi-ready'?'reconnect':'checking';
          try{storeFirstAccessMarker(marker);}catch(_){phase='checking';}
          onboarding.restoreFirstStandAccess(marker,{phase});
          route={...route,screen:'receiver-add',standId:marker.standId,zoneId:null,setupFrom:'stand'};
          return;
        }
      }
      if(simpleStandMode){
        nativeLoaded=true;ensureStandSession();
        route={...route,screen:startupError&&restored.stands.length||!restored.stands.length&&!startupError?'stand':'stand-connect',standId:standId||null,zoneId:null};
        if(route.screen==='stand-connect'){
          standConnectionIntent='open';standManualEntry=false;standSharingMode=null;
        }
        if(startupError)standConnectionState={...standConnectionState,error:startupError};
        if(startupCapabilities?.legacyStandAnimations===true){
          if(restored.stands.length)route={...route,screen:'stand',standId:standId||null,zoneId:null};
        }else if(standMigrationReady||startupSession?.status==='connected'){
          try{await standSession.resume();route={...route,screen:'stand',standId:standSession.snapshot().standId,zoneId:null};}
          catch(_){/* Keep the former cache. Only explicit MAIN-unset status may start setup. */}
        }
        if(!state.draft&&!model.stands.length&&!standSession.snapshot()&&!standSession.canResume()&&restoreLocalStandConcept())route={...route,screen:'stand',standId:localStandConceptId,zoneId:null};
        return;
      }
      if(Backup)try{
        const journal=backupTransaction.pending();
        if(journal){
          if(Backup.key(Backup.publicModel(restored))===journal.afterModel){backupTransaction.finish(restored);reloadBackupLibraries();}
          else backupTransaction.discard(restored);
        }
        model=Backup.restoreLight(restored,appStorage.getItem(Backup.LIGHT_KEY));
      }catch(_){backupNotice='Je bewaarde lichtkeuze of een onderbroken herstelactie kon niet volledig worden gelezen. Er is niets naar je receivers verstuurd.';}
      nativeLoaded=true;
      if(!state.draft&&!restored.stands.length&&restoreLocalStandConcept())route={...route,screen:'stand',standId:localStandConceptId,zoneId:null};
      // Only a successful load can establish that this is a first installation.
      // An existing stand with no receivers is not a reason to restart setup.
      if(state.draft){route.screen='receiver-add';route.setupFrom='stand';}
      else if(!restored.stands.length&&!localStandConcept()){route.screen='stand';route.standId=null;route.zoneId=null;}
    }catch(_){nativeLoadError=true;}
    finally{nativeLoading=false;render({top:true});if(standLinkAvailable){standLinkPending=true;void consumeStandShareLink();}}
  }
  render({top:true});if(nativeContext)loadNativeState();requestAnimationFrame(frame);
})();
