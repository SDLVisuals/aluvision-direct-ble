/* V30 interface: browser fixtures and native installation data stay separate.
 * Only narrowly supported light changes use confirmed native live control;
 * other changes remain visibly preview-only until their transport exists. */
(function () {
  'use strict';
  const M = window.LightningModel, P = window.LightningPreview, C = window.LightningColour, S = window.LightningPresets;
  const Colours = window.LightningColoursLibrary, Scenes = window.LightningScenes;
  const Preferences=window.LightningPreferences;
  const Backup=window.LightningBackup;
  const Library=window.LightningAnimationLibrary;
  const runtime=window.LightningNativeRuntime;
  function pinRequired(){return window.AluvisionSecurityMode?.pinRequired!==false;}
  // An absent/failed native script must never turn the real app into a demo.
  const nativeContext=window.__lightningV30NativeHost===true||window.location.protocol==='file:'||runtime?.native===true;
  // Only the separate /demo/ path may invent receivers. The public root,
  // query flags and native iPhone bundle keep their non-demo paths.
  const webDemoContext=!nativeContext&&window.LightningWebDemo?.available===true;
  const webDemo=webDemoContext?window.LightningWebDemo.create():null;
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
  const backupTransaction=Backup?.transaction(appStorage);
  let selectedBackup=null,backupNotice='',lightSaveTimer=null,lightIntentDirty=false;
  const receiverContextStates=new Map(),receiverContextReads=new Set();
  try { presetStore = S.createStore(appStorage); } catch (_) { presetStore = S.createStore(null); }
  try { colourStore = Colours.createStore(appStorage); sceneStore=Scenes.createStore(appStorage); }
  catch (_) { colourStore=Colours.createStore(null);sceneStore=Scenes.createStore(null); }
  let savedPresets = presetStore.load();
  let savedColours=colourStore.load(),savedScenes=sceneStore.load(),sceneDraft=null;
  let sceneDetailSearch='';
  let dragOrder=null;
  let receiverAssignment=null,nameDialog=null,zoneDeletion=null,managementBusy=false;
  let arrangementDraft=null,arrangementApplying=false,setupReturnContext=null;
  const openLineSetup=new Set(),openLineManagement=new Set();
  const openSpatialChoices=new Set(),spatialViews=new Map();
  let standControlOpen=false;
  // Everyday controls share one zone screen. Keep the light mode local to
  // that screen so changing between colour and movement never sends users
  // through an intermediate page or clears their selected ledline.
  let controlMode='colour',showControlAnimationGallery=true,controlPreviewSize='small';
  let pinProtection=null,pinProtectionLoading=false,pinProtectionBusy=false,pinProtectionError='',pinProtectionReconnect=null;
  let pinLoginAvailable=false,pinLoginChecking=false,pinLoginBusy=false,pinLoginError='',pinRecoveryAbort=null;
  const liveStates=new Map();
  const liveController=nativeContext&&runtime?.native===true&&typeof runtime.services?.applyLive==='function'
    ?window.LightningLiveControl?.create({send:request=>runtime.services.applyLive(request),
      sendBatch:typeof runtime.services.applyLiveBatch==='function'?requests=>runtime.services.applyLiveBatch({requests}):undefined,
      onState:(id,state)=>{liveStates.set(id,state);syncLiveStatus();}}):null;
  let colourOrderMode=false,colourLibraryNotice='',removedColour=null;
  let preferenceStore;try{preferenceStore=Preferences.createStore(appStorage);}catch(_){preferenceStore=Preferences.createStore(null);}
  let uiPreferences=preferenceStore.load();
  const t=(key,params)=>Preferences.t(key,uiPreferences.preferences.language,params);
  let dialogReturnFocus = null,colourManagerReturn=null,colourManagerVisible=false;
  let settingsOpen = false, toastTimer, contextObserver, dialogHeaderObserver;
  const main = document.getElementById('main');
  function updateControlPreviewDensity(){
    const dock=main.querySelector('.control-preview-dock');
    if(!dock)return;
    const compact=dock.dataset.scrolled==='true';
    // Separate the enter/exit thresholds so small iOS scroll corrections at
    // the top do not repeatedly expand and collapse the sticky preview.
    if(!compact&&window.scrollY>64)dock.dataset.scrolled='true';
    else if(compact&&window.scrollY<24)delete dock.dataset.scrolled;
    const settingsShortcut=dock.querySelector('[data-editor-return-shortcut]');
    const shortcut=settingsShortcut||dock.querySelector('[data-editor-shortcut]');
    const inline=settingsShortcut?main.querySelector('[data-editor-return-inline]'):main.querySelector('.current-effect-gallery');
    if(shortcut&&inline){
      // Keep the route available unless the complete inline button is inside
      // the unobstructed area between the sticky preview and bottom navigation.
      // Checking only its center let the sticky preview cover the top half.
      const top=dock.querySelector('.control-dock-surface').getBoundingClientRect().bottom;
      const bottom=main.querySelector('#navigation')?.getBoundingClientRect().top??innerHeight;
      const box=inline.getBoundingClientRect();
      const setup=main.querySelector('.ledline-setup'),setupBox=setup?.getBoundingClientRect();
      // Measure after making the shortcut visible. Hide it only when it would
      // physically cover arrangement controls, not because they are nearby.
      shortcut.hidden=false;
      const floating=shortcut.querySelector('button')?.getBoundingClientRect();
      const overlapsSetup=!!setupBox&&!!floating&&setupBox.height>0&&floating.height>0&&floating.left<setupBox.right&&floating.right>setupBox.left&&floating.top<setupBox.bottom&&floating.bottom>setupBox.top;
      const inlineFullyReachable=box.height>0&&box.top>=top&&box.bottom<=bottom;
      shortcut.hidden=overlapsSetup||inlineFullyReachable;
    }else if(shortcut){
      const setup=main.querySelector('.ledline-setup'),setupBox=setup?.getBoundingClientRect();
      const floating=shortcut.querySelector('button')?.getBoundingClientRect();
      const overlapsSetup=!!setupBox&&!!floating&&setupBox.height>0&&floating.height>0&&floating.left<setupBox.right&&floating.right>setupBox.left&&floating.top<setupBox.bottom&&floating.bottom>setupBox.top;
      shortcut.hidden=overlapsSetup;
    }
  }
  window.addEventListener('scroll',updateControlPreviewDensity,{passive:true});
  function revealAnimationStart(){
    // Do not carry a deep gallery scroll position into the settings. Align
    // their heading below the visible dock, including its compacted height.
    const workspace=main.querySelector('.active-animation-workspace');if(!workspace)return;
    // Start at the chosen animation, not the (potentially long) arrangement
    // form above it. The arrangement remains accessible by scrolling up.
    const target=workspace;
    const align=()=>{
      if(!target.isConnected)return;
      updateControlPreviewDensity();
      const surface=main.querySelector('.control-dock-surface'),bottom=Math.max(0,surface?.getBoundingClientRect().height||0);
      window.scrollTo({top:Math.max(0,window.scrollY+target.getBoundingClientRect().top-bottom-12),behavior:'instant'});
      updateControlPreviewDensity();
    };
    align();requestAnimationFrame(()=>{align();workspace.querySelector('.current-effect b')?.focus({preventScroll:true});});
  }
  function rememberAnimationGallery(){
    if(!main.querySelector('.animation-library-inline'))return;
    animationGalleryPositions.set(route.zoneId,{library:libraryTab(),family:route.family});
  }
  function revealAnimationGallery(){
    const target=main.querySelector('.animation-context')||main.querySelector('.animation-library-inline');if(!target)return;
    const align=()=>{
      if(!target.isConnected)return;
      updateControlPreviewDensity();
      const bottom=Math.max(0,main.querySelector('.control-dock-surface')?.getBoundingClientRect().height||0);
      window.scrollTo({top:Math.max(0,window.scrollY+target.getBoundingClientRect().top-bottom-8),behavior:'instant'});
      updateControlPreviewDensity();
    };
    align();requestAnimationFrame(align);
  }
  function revealAnimationFamily(){
    const target=main.querySelector('.family-detail-back');if(!target)return;
    const align=()=>{
      if(!target.isConnected)return;
      updateControlPreviewDensity();
      const bottom=Math.max(0,main.querySelector('.control-dock-surface')?.getBoundingClientRect().bottom||0);
      window.scrollTo({top:Math.max(0,window.scrollY+target.getBoundingClientRect().top-bottom-8),behavior:'instant'});
      updateControlPreviewDensity();
    };
    align();requestAnimationFrame(align);
  }
  function restoreAnimationFamilyList(){
    const saved=animationFamilyReturnPositions.get(route.zoneId);
    if(!saved)return revealAnimationGallery();
    const trigger=Array.from(main.querySelectorAll('[data-action="family"]')).find(item=>item.dataset.id===saved.family);
    if(!trigger)return revealAnimationGallery();
    const restore=()=>{
      if(!trigger.isConnected)return;
      const delta=trigger.getBoundingClientRect().top-saved.viewportTop;
      if(Math.abs(delta)>1)window.scrollTo({top:Math.max(0,window.scrollY+delta),left:0,behavior:'instant'});
    };
    restore();requestAnimationFrame(()=>{restore();requestAnimationFrame(restore);});
    trigger.focus({preventScroll:true});
  }
  function chooseAnimationCategory(value){
    if(!['catalogue','whole','pixels','tunnel','brand','presets'].includes(value)||value==='pixels'&&zone()?.type!=='SPI')return;
    animationQueries.delete(route.zoneId);
    route={...route,family:null,library:value,effectsReturn:'controls'};showControlAnimationGallery=true;setSpatialPreviewCategory(value);
    animationGalleryPositions.delete(route.zoneId);render({top:true});revealAnimationGallery();
  }
  document.getElementById('effect-dialog').addEventListener('cancel',event=>{
    if(colourManagerReturn){event.preventDefault();if(colourManagerVisible)closeColourManager();else{brandEditor=colourManagerReturn.brandEditor||null;savedColours=colourStore.load();showColourManager();}}
    else if(document.querySelector('#effect-dialog [data-animation-categories]')){event.preventDefault();closeEffectDialog();}
  });
  document.getElementById('effect-dialog').addEventListener('click',event=>{
    const dialog=event.currentTarget;if(event.target!==dialog||!dialog.querySelector('[data-animation-categories]'))return;
    const rect=dialog.getBoundingClientRect();
    if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeEffectDialog();
  });
  if(webDemoContext){
    document.getElementById('web-demo-banner').hidden=false;
    document.body.dataset.webDemo='true';
  }
  const receiverUpdates=window.LightningReceiverUpdateUI.create({services:runtime?.native===true?runtime.services||{}:{},translate:(key,params)=>t(key,params)});
  const receiverRemoval=window.LightningReceiverRemovalUI.create({services:runtime?.native===true?runtime.services||{}:{},getModel:()=>model,
    onRemoved:nextModel=>{model=M.assertValid(nextModel);selections.clear();visualPorts.clear();visualPlugMotions.clear();identifying.clear();navigate('receivers');}});
  const pixelSetup=window.LightningPixelSetup.create({mode:previewContext?'preview':nativeContext&&typeof runtime?.services?.configureOutputs==='function'?'native':'native-unavailable',
    onPreview:runtime?.native===true&&typeof runtime.services?.previewPixels==='function'?request=>runtime.services.previewPixels({...request,mainReceiverId:request.role==='node'?model.receivers.find(r=>r.standId===request.standId&&r.role==='main'&&r.lifecycle==='added')?.id:null}):undefined,
    onClose:()=>{document.querySelector(`[data-action="receiver-pixel-setup"][data-id="${CSS.escape(pixelSetupReceiverId||'')}"]`)?.focus({preventScroll:true});pixelSetupReceiverId=null;},
    onSave:async({receiverId,outputs})=>{
      const receiver=model.receivers.find(r=>r.id===receiverId&&r.lifecycle==='added'&&r.type==='SPI');
      if(!receiver||outputs.length!==4)throw Error('Deze receiver is niet beschikbaar.');
      if(nativeContext){
        if(typeof runtime?.services?.configureOutputs!=='function')throw Error('Verbind je telefoon met het ALUVISION-wifi van je installatie om de instellingen te bewaren.');
        try{const view=await runtime.services.configureOutputs({standId:receiver.standId,receiverId,outputs});refreshSuspendedSetup(view);model=keepLocalPreviewStates(view.model);}
        catch(error){throw Error(outputConfigurationErrorMessage(error));}
      }else{
        if(!previewContext)throw Error('Verbind je telefoon met het ALUVISION-wifi van je installatie om de instellingen te bewaren.');
        const next=JSON.parse(JSON.stringify(model));
        next.receivers.find(r=>r.id===receiverId).outputs=outputs.map(({port,enabled,pixels,reversed})=>({port,enabled,pixels,reversed}));
        model=M.assertValid(next);
      }
      resumeConfiguredLighting(receiverId);
      expandedReceivers.add(receiverId);
      const blink=identifying.get(receiverId);
      if(blink){const active=model.receivers.find(r=>r.id===receiverId).outputs.filter(o=>o.enabled).map(o=>o.port);blink.ports=blink.scope==='all'?active:blink.ports.filter(p=>active.includes(p));if(!blink.ports.length)identifying.delete(receiverId);}
      render({preserveScroll:true});toast(nativeContext?'Pixels en aansluiting bewaard op de receiver.':'Pixels en aansluitzijde aangepast in het voorbeeld.');
    }});
  function outputConfigurationErrorMessage(error){
    if(error?.code==='OTA_PENDING')return 'De software-update van deze receiver is nog niet afgerond. Controleer die eerst bij Softwareversie en updates. Je keuzes blijven staan.';
    if(error?.code==='OTA_BUSY')return 'Er wordt software bijgewerkt. Wacht tot de update klaar is en bewaar dan opnieuw. Je keuzes blijven staan.';
    return 'Nog niet bevestigd door de receiver. Je keuzes blijven staan. Controleer de verbinding en probeer opnieuw.';
  }
  const onboarding=window.LightningOnboardingUI.create({getModel:()=>model,
    allowPinLogin:nativeContext,
    services:webDemo||(runtime?.native===true?runtime.services||{}:{}),
    onManage:request=>manageSetupZones(request),
    onComplete:(nextModel,{receiverId}={})=>{applyJoinedZonePlayback(nextModel,receiverId?[receiverId]:[]);},
    onExit:result=>{
      const returnZone=stand()?.zones.find(z=>z.id===route.setupReturnZoneId);
      if(returnZone){
        const context=setupReturnContext;setupReturnContext=null;
        openLineSetup.add(returnZone.id);openLineManagement.add(returnZone.id);arrangementDraft=null;
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
    scenes:'M7 3h14v14H7zM3 7v14h14M11 7h6M11 11h6',
    check:'m5 12 4 4L19 6', sun:'M12 2v2M12 20v2M2 12h2M20 12h2M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 7v5l3 2',
    layers:'M12 3 2 8l10 5 10-5-10-5ZM2 12l10 5 10-5M2 16l10 5 10-5',
    sparkle:'m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3ZM19 16l.7 2.3 2.3.7-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z'
  };
  function icon(name) {
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
      '<path d="M4 35V20a16 16 0 0 1 32 0v15M10 35V20a10 10 0 0 1 20 0v15M16 35V20a4 4 0 0 1 8 0v15M17 35l3-13 3 13"/>';
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
  const continuousZone = () => zone()?.type==='SPI'&&zone()?.layout==='continuous';
  // A continuous SPI installation is a single control target. Normalize here,
  // not only in the chips, so colours, power, effects and presets cannot retain
  // an invisible old individual selection after a layout change.
  const selection = () => continuousZone()?{kind:'all'}:selections.get(route.zoneId)||{kind:'all'};
  const standReceivers=()=>model.receivers.filter(r=>r.standId===stand()?.id&&r.lifecycle==='added');
  function selectedReceiverIds(value=selection()) {
    const list=receivers();
    if(value?.kind==='all')return list.map(receiver=>receiver.id);
    if(value?.kind==='receiver')return list.some(receiver=>receiver.id===value.receiverId)?[value.receiverId]:[];
    if(value?.kind==='receivers'&&Array.isArray(value.receiverIds)){
      const ids=new Set(value.receiverIds);return list.filter(receiver=>ids.has(receiver.id)).map(receiver=>receiver.id);
    }
    return [];
  }
  function selected() { if(standControlOpen)return standReceivers();const ids=new Set(selectedReceiverIds());return receivers().filter(receiver=>ids.has(receiver.id)); }
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
    const numbers=receivers().map((receiver,index)=>ids.includes(receiver.id)?String(index+1):null).filter(Boolean);
    try{return new Intl.ListFormat(uiPreferences.preferences.language||'nl',{style:'short',type:'conjunction'}).format(numbers);}
    catch(_){return numbers.join(', ');}
  }
  // The overview has no individual-line selector: its power switch always
  // controls the entire zone, without forgetting the selection in its editors.
  function powerTargets() { return standControlOpen?standReceivers():receivers(); }
  function selectedState() { return selected()[0]?.state || M.defaultState(); }
  function ledlineName(receiver,index) { return `Ledline ${index+1} · ${receiver.type==='RGBW'?'RGBW':'SPI'}`; }
  function nameOfSelection() {
    if(continuousZone())return 'Eén doorlopende ledline';
    if(selection().kind==='all')return `${t('together')} · ${receivers().length} ledline${receivers().length===1?'':'s'}`;
    const ids=selectedReceiverIds();
    if(selection().kind==='receivers')return t('scopeSelectedLines',{count:ids.length,numbers:formatLineNumbers(ids)});
    const index=receivers().findIndex(receiver=>receiver.id===ids[0]);
    return index<0?'Geen ledline':ledlineName(receivers()[index],index);
  }
  function statusText(receiver) { return receiver.connection === 'offline' ? 'Offline' : ''; }
  function catalogue() { return P.catalog(zone()?.type || 'RGBW'); }
  function activeEffect() {
    if(standControlOpen)return null;
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
      const swatch=`<span role="img" aria-label="${name}" title="${name}" style="--swatch:${C.hex(C.mixWhite(rgb,white))}"></span>`;
      return activeEffect()?.paletteEditable === false ? swatch : `<div class="palette-item"><button class="palette-colour" data-action="palette-edit" data-id="${i}" aria-label="${name} aanpassen">${swatch}<small>${name}</small></button>${activeEffect()?.colorCountRange&&count>activeEffect().colorCountRange.min?`<button class="palette-remove" data-action="palette-remove" data-id="${i}" aria-label="Kleur ${i+1} verwijderen">−</button>`:''}</div>`;
    }).join('')+(activeEffect()?.colorCountRange&&count<activeEffect().colorCountRange.max?'<button class="palette-add" data-action="palette-add" aria-label="Animatiekleur toevoegen">＋ Kleur</button>':'');
  }
  function addPreview(list, layout, css = '', options = {}) {
    const key = String(++previewKey);
    previews.set(key, {receivers:list, layout, ...options});
    const accessibility=options.decorative?'aria-hidden="true"':`role="img" aria-label="${esc(options.label || 'Lichtvoorbeeld')}"`;
    return `<canvas class="${css}" data-preview="${key}" data-preview-line-count="${list.length}" ${accessibility} width="400" height="160"></canvas>`;
  }
  function zonePreview(z, css, options) { return addPreview(M.zoneReceivers(model,z.id),z.layout,css,{zoneId:z.id,...options}); }
  function contextTitle(title, subtitle, backLabel = zone()?.name, back = 'controls') {
    const backToZones=back==='stand';
    return `<div class="topline"><button class="back${backToZones?' back-to-zones':''}" data-action="${back}">${icon('back')}<span>${esc(backLabel)}</span></button><span class="context-name">${esc(standLabel())}</span></div><header class="page-heading"><div><h1>${esc(title)}</h1><p>${esc(subtitle || '')}</p></div>${['controls','colour','animations','effects','layout'].includes(route.screen) && zone() ? `<span class="pill">${zone().type === 'SPI' ? 'Pixel LED · SPI' : 'RGBW'}</span>` : ''}</header>`;
  }
  function mixedSelection(ignoreSmooth=false) {
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
    if(continuousZone())return `<section class="selection continuous-scope" data-continuous-scope aria-label="${esc(t('scopeAllAria'))}"><span class="scope-toggle-icon" aria-hidden="true">${icon('together')}</span><div><strong>${esc(t('scopeAllAria'))}</strong><small>${esc(t('spatialTopologyOneHint'))}</small></div><p class="mixed-note" ${mixedSelection()?'':'hidden'}>De ledlines hebben verschillende instellingen. Je volgende wijziging geldt voor allemaal.</p></section>`;
    const list=receivers(),count=list.length,ids=selectedReceiverIds(),selectedIndex=list.findIndex(receiver=>receiver.id===ids[0]),selectedReceiver=selectedIndex>=0?list[selectedIndex]:null;
    const typeOf=receiver=>receiver?.type==='RGBW'?'RGBW':'SPI';
    if(count===1)return `<section class="selection single-scope" aria-label="Geselecteerde ledline"><span class="scope-line-icon" aria-hidden="true">${icon('light')}</span><span class="scope-single-copy"><b>${esc(t('scopeLine',{number:1}))}</b><small>${typeOf(list[0])==='SPI'?'Pixel LED · SPI':'RGBW'}</small></span></section>`;
    const summary=all?t(count===1?'scopeCountOne':'scopeCountMany',{count}):ids.length>1?t('scopeSelectedLines',{count:ids.length,numbers:formatLineNumbers(ids)}):selectedReceiver?t('scopeSelectedLine',{number:selectedIndex+1,type:typeOf(selectedReceiver)}):'';
    // Selection opens the list when a line is first chosen, but the explicit
    // disclosure state must remain authoritative so customers can collapse it
    // without losing their selected line or group.
    const expanded=expandedScopeZones.has(route.zoneId),panelId=`scope-lines-${route.zoneId}`;
    const scopeToggleLabel=all?t('together'):ids.length>1?t('scopeSelectedLines',{count:ids.length,numbers:formatLineNumbers(ids)}):selectedReceiver?t('scopeSelectedLine',{number:selectedIndex+1,type:typeOf(selectedReceiver)}):t('scopeSeparate');
    const scopeToggleHint=expanded?t('scopeCloseHint'):all?t(count===1?'scopeTogetherOne':'scopeTogetherMany',{count}):ids.length>1?t('scopeMultiHint',{count:ids.length}):t('scopeSingleHint',{count});
    return `<section class="selection${ids.length>1?' has-multiple-selection':''}" data-selection-mode="${all?'all':ids.length>1?'multiple':'single'}" aria-label="Ledlines kiezen">
      <header><h2>${esc(t('scopePrompt'))}</h2><span class="selection-summary" role="status">${esc(summary)}</span></header>
      <div class="receiver-chips receiver-scope-grid" data-count="${count}">
        <button class="scope-lines-toggle" data-action="scope-toggle-lines" aria-label="${esc(scopeToggleLabel)}" aria-expanded="${expanded}" aria-controls="${esc(panelId)}"><span class="scope-toggle-icon" aria-hidden="true">${all?icon('together'):icon('light')}</span><span class="scope-copy"><span class="scope-option-title">${esc(scopeToggleLabel)}</span><small>${esc(scopeToggleHint)}</small></span>${all?`<span class="scope-all-status" aria-hidden="true">${icon('check')}</span>`:''}<span class="scope-toggle-chevron" aria-hidden="true">${icon('chevron')}</span></button>
        <div class="scope-lines-reveal ${expanded?'is-open':''}" id="${esc(panelId)}" aria-hidden="${!expanded}" ${expanded?'':'inert'}><div class="scope-lines-inner"><div class="scope-choice-label"><span>${esc(t('scopeIndividual'))}</span></div><button class="selection-together scope-all-choice" data-action="select" data-id="all" aria-label="${esc(t('scopeAllAria'))}" aria-pressed="${all}">${icon('together')}<span class="scope-copy"><span class="scope-option-title">${esc(t('together'))}</span><small>${esc(t(count===1?'scopeTogetherOne':'scopeTogetherMany',{count}))}</small></span><span class="scope-selected-mark" aria-hidden="true">${icon('check')}</span></button><div class="scope-lines-list">${list.map((r,i)=>{const pressed=all||ids.includes(r.id);return `<button class="scope-line" data-action="select" data-id="${esc(r.id)}" aria-label="${esc(t('scopeLineAria',{type:typeOf(r),number:i+1}))}" aria-pressed="${pressed}"><span class="scope-line-icon" aria-hidden="true">${icon('light')}</span><span class="scope-copy"><span class="scope-option-title">${esc(t('scopeLine',{number:i+1}))}</span><small>${r.type==='RGBW'?'RGBW':'Pixel LED · SPI'}</small></span><span class="scope-selected-mark" aria-hidden="true">${icon('check')}</span></button>`;}).join('')}</div></div></div>
      </div><p class="mixed-note" ${mixedSelection()?'':'hidden'}>De gekozen ledlines hebben verschillende instellingen. Je volgende wijziging geldt voor allemaal.</p></section>`;
  }
  function controlContext(screen) {
    const z = zone(), title = screen === 'colour' ? 'Vaste kleur' : screen === 'animations' ? 'Animaties' : z.name;
    const atRoot = screen === 'controls' || screen === 'layout';
    const list=receivers();
    const modeTabs=screen==='controls'?`<div class="section-tabs control-mode-tabs" role="group" aria-label="Kleur of animatie"><button data-action="colour" aria-pressed="${controlMode==='colour'}">${icon('sun')}Kleur</button><button data-action="animations" aria-label="Effecten" aria-pressed="${controlMode==='animations'}">${icon('animation')}Effecten</button></div>`:'';
    const galleryBack=screen==='animations'&&Boolean(activeEffect()),backLabel=atRoot?'Terug naar zones':galleryBack?'Animatiegalerij':`Bediening · ${z.name}`,backAction=atRoot?'stand':galleryBack?'animations-gallery':'controls';
    const integratedControlHeading=screen==='controls'&&atRoot;
    return `${integratedControlHeading?'':`<section class="control-context${list.length>=5?' many-receivers':''}">${contextTitle(title,atRoot ? `${list.length} ledline${list.length===1?'':'s'} · in ${standLabel()}` : z.name,backLabel,backAction)}</section>`}${controlPreviewDock(screen,modeTabs)}`;
  }
  function controlPreviewDock(screen,modeTabs='') {
    const z=zone(),list=receivers(),pixels=z.type==='SPI'?P.geometry(list,z.layout).totalPixels:0;
    const draft=previewArrangement(z),previewLayout=draft?.layout||z.layout;
    const integratedControlHeading=screen==='controls';
    const effectChosen=screen==='controls'&&controlMode==='animations'&&Boolean(activeEffect());
    const galleryBrowsing=screen==='controls'&&controlMode==='animations'&&(!effectChosen||showControlAnimationGallery);
    const galleryTunnel=screen==='controls'&&controlMode==='animations'&&galleryBrowsing&&libraryTab()==='tunnel';
    const canTapLines=list.length>1&&!continuousZone()&&!draft&&!galleryTunnel&&['controls','colour','animations'].includes(screen);
    // While browsing tunnel & wall effects, show a four-line example or the
    // currently opened family's recipe across the actual zone members. This
    // is presentation only; the selected animation is applied only on a tap.
    const tunnelSettingsOpen=activeEffect()?.category==='tunnel'&&!galleryBrowsing&&(screen==='controls'||screen==='animations');
    const spatialView=(tunnelSettingsOpen||galleryTunnel)?spatialMode(previewLayout,z):'normal';
    const spatialPreview=(tunnelSettingsOpen||galleryTunnel)&&['tunnel','wall'].includes(spatialView);
    const previewMode=spatialPreview?(spatialView==='wall'?'Wall':'Tunnel'):previewLayout==='continuous'?'Continuous':'Normal';
    const spatialPreviewLabel=spatialPreview?spatialPreviewText('Preview',spatialView):'';
    const total=z.type==='SPI'?t(list.length===1?'scopeTotalSpiOne':'scopeTotalSpiMany',{count:list.length,pixels}):t(list.length===1?'scopeCountOne':'scopeCountMany',{count:list.length});
    const scope=galleryTunnel?(route.family?`${Library.group(catalogue(),route.family)?.title||t('animationAcross')} · ${ledlineCount(list.length)}`:t('animationTunnelSampleLines')):selection().kind==='all'?total:t('scopeSelectedTap',{name:nameOfSelection()});
    const modeName=screen==='controls'?(controlMode==='colour'?'Kleur':'Effecten'):screen==='layout'?'Opstelling':screen==='colour'?'Kleur':screen==='animations'?'Effecten':'Bediening';
    const label=`LED-overzicht van ${z.name} · ${total}${selection().kind==='all'?'':` · ${nameOfSelection()} gekozen`}`;
    return `<section class="control-preview-dock${galleryBrowsing?' animation-gallery-dock':''}" aria-label="LED-overzicht en bediening"><div class="control-dock-surface">
      ${integratedControlHeading?`<div class="control-dock-context-line"><div class="control-dock-location"><small>JE LICHT · ${esc(modeName)}</small><b>${esc(z.name)}</b></div><span class="pill control-dock-type-badge">${zoneTypeLabel(z)}</span></div><div class="control-dock-actions"><button class="back back-to-zones control-dock-back" data-action="stand" aria-label="Terug naar zones" title="Terug naar zones">${icon('back')}<span>Zones</span></button>${modeTabs}</div>`:''}
      ${integratedControlHeading?'':`<div class="control-dock-heading"><div class="control-dock-location"><small>JE LICHT · ${esc(modeName)}</small><b>${esc(z.name)}</b></div>${modeTabs||`<span class="control-dock-mode">${esc(modeName)}</span>`}</div>`}
      <div class="preview-wrap${canTapLines?' preview-selectable':''}${spatialPreview?' spatial-preview-wrap':''}" data-preview-layout="${previewLayout}"><div class="preview-top"><span>${galleryTunnel?esc(t(spatialView==='wall'?'animationWallSampleTitle':'animationTunnelSampleTitle')):spatialPreview?esc(spatialPreviewLabel):esc(t('lineSetup'+previewMode))}</span><span class="preview-summary">${esc(scope)}</span></div>${spatialPreview?'':previewSizePickerMarkup(controlPreviewSize)}${galleryTunnel?tunnelGalleryPreviewMarkup(route.family?Library.group(catalogue(),route.family):null,'spatial-dock-preview'):zonePreview(z,spatialPreview?'spatial-dock-preview':'',{selection:selection(),main:true,arrangementPreview:true,lineNumbers:Object.fromEntries(list.map((receiver,index)=>[receiver.id,index+1])),...(spatialPreview?{spatialShape:spatialView,presentation:'receivers'}:{}),label:spatialPreview?`${spatialPreviewLabel} · ${z.name} · ${total}`:label})}</div>
      ${animationWayfinding(screen)}<p class="live-confirmation" data-live-status="zone" role="status" aria-live="polite"></p>
    </div></section>`;
  }
  function zoneTypeLabel(z) { return z.type==='SPI'?'Pixel LED · SPI':z.type==='RGBW'?'RGBW':'Nog geen verlichting'; }
  function animationWayfinding(screen){
    if(!(screen==='animations'||screen==='controls'&&controlMode==='animations'))return '';
    const browsing=screen==='controls'&&showControlAnimationGallery;
    if(browsing&&activeEffect()&&!route.family)return `<nav class="animation-wayfinding" data-editor-return-shortcut hidden aria-label="${esc(t('animationNavigation'))}">${animationSettingsReturnMarkup('sticky')}</nav>`;
    if(!activeEffect()||browsing)return '';
    const action=screen==='controls'?'animation-gallery':'animations-gallery';
    return `<nav class="animation-wayfinding" data-editor-shortcut hidden aria-label="${esc(t('animationNavigation'))}"><button type="button" class="animation-gallery-return animation-chooser-action" data-action="${action}" aria-label="${esc(t('animationChooseAnother'))}"><span class="gallery-action-label"><span class="gallery-action-icon" aria-hidden="true">${icon('animation')}</span><span class="gallery-action-copy"><b>${esc(t('animationChooseAnother'))}</b><small>${esc(t('animationChooseAnotherHint'))}</small></span></span><span class="gallery-action-next" aria-hidden="true">${icon('chevron')}</span></button></nav>`;
  }
  function previewSizePickerMarkup(size=controlPreviewSize,spatial=false){
    const sizes=[['small','Klein'],['medium','Middel'],['large','Groot']],current=sizes.find(([value])=>value===size)?.[1]||'Klein',subject=spatial?'3D-voorbeeld':'ledlinevoorbeeld';
    return `<div class="preview-size-row"><details class="preview-size-control"><summary aria-label="Grootte van het ${subject} ${current}. Tik om te wijzigen"><span>${spatial?'3D-voorbeeld':'Voorbeeld'}</span><b>${current}</b>${icon('chevron')}</summary><div class="preview-size-picker" role="group" aria-label="Grootte van het ${subject}">${sizes.map(([value,title])=>`<button type="button" data-action="preview-size" data-id="${value}" aria-label="${title} ${spatial?'3D-voorbeeld':'voorbeeld'}" aria-pressed="${size===value}">${title}</button>`).join('')}</div></details></div>`;
  }
  function zoneDeleteButton(z,css=''){return `<button type="button" class="zone-delete-shortcut ${css}" data-action="zone-delete" data-id="${esc(z.id)}" aria-label="Zone ${esc(z.name)} verwijderen">${icon('trash')}<span>Zone verwijderen</span></button>`;}
  function renderEmptyZone() {
    const z=zone();
    return `<div class="page empty-zone-page"><div class="topline"><button class="back back-to-zones" data-action="stand">${icon('back')}<span>Terug naar zones</span></button><span class="context-name">${esc(standLabel())}</span></div><header class="page-heading"><div><div class="eyebrow">LEGE ZONE</div><h1>${esc(z.name)}</h1></div><button class="icon-button" data-action="zone-rename" data-id="${esc(z.id)}" aria-label="Naam van deze zone wijzigen">${icon('edit')}</button></header><section class="card empty empty-zone"><h2>Voeg verlichting toe</h2><p>Kies nieuwe verlichting of verplaats een receiver die al bij je stand hoort.</p><button class="button full" data-action="layout-new-receiver" data-zone="${esc(z.id)}">Nieuwe receiver toevoegen</button><button class="button secondary full" data-action="zone-assign" data-id="${esc(z.id)}">Bestaande receiver kiezen</button><small>${z.type?`Deze zone is voor ${esc(z.type)}.`:'De eerste receiver bepaalt het zonetype: RGBW of SPI.'}</small></section>${zoneDeleteButton(z)}</div>`;
  }
  function renderStand() {
    if(!stand()){
      const pending=onboarding.summary(),step=!pending?.stand||pending.stage==='stand'?1:pending.stage==='zones'?2:3;
      return `<div class="page onboarding-welcome"><header class="page-heading"><div><div class="eyebrow">SETUP ${pending?.stand?'NIET AFGEROND':''}</div><h1>${esc(pending?.stand?.name||'Je stand instellen')}</h1></div></header><section class="stand-setup-overview" aria-label="Je stand instellen">${['Standnaam','Zones maken','Receivers toevoegen'].map((label,i)=>`<div class="stand-setup-row ${i+1===step?'active':''}"><i>${i+1<step?'✓':i+1}</i><span><small>STAP ${i+1}</small><b>${label}</b></span><small>${i+1<step?'Klaar':i+1===step?'Volgende':''}</small></div>`).join('')}</section>${pending?.zones.length?`<div class="stand-draft-zones">${pending.zones.map(z=>`<div>${icon('zones')}<b>${esc(z.name)}</b><small>Nog geen receiver toegevoegd</small></div>`).join('')}</div>`:''}<button class="button full onboarding-next-action" data-setup-resume data-action="receiver-add">${pending?.stand?'Setup verderzetten':'Mijn stand instellen'}</button></div>`;
    }
    const s = stand(), added = standReceivers();
    return `<div class="page"><header class="page-heading"><div><div class="eyebrow">JOUW STAND</div><h1>${esc(standLabel())}</h1><p>Kies een zone om je ledlines te bedienen.</p></div><button class="icon-button circle" data-action="help" aria-label="Uitleg over stand en zones">${icon('info')}</button></header><div class="stand-summary"><div>${icon('zones')}<span><b>${s.zones.length}</b><small>Zones</small></span></div><div>${icon('light')}<span><b>${added.length}</b><small>Ledlines</small></span></div></div><section><div class="section-heading"><h2>Zones in deze stand</h2><button class="text-button" data-action="zone-new">＋ Nieuwe zone</button></div><div class="zone-grid">${s.zones.map(z=>`<article class="zone-entry"><button class="zone-card" data-action="zone" data-id="${esc(z.id)}">${zonePreview(z,'',{label:`Voorbeeld van ${z.name}`})}<div class="zone-copy"><div><b>${esc(z.name)}</b><span>${zoneTypeLabel(z)}${z.type?` · ${ledlineCount(M.zoneReceivers(model,z.id).length)}`:''}</span></div><span class="open-label">${M.zoneReceivers(model,z.id).length?'Bedienen':'Instellen'} ${icon('chevron')}</span></div></button><button class="zone-options-button" data-action="zone-options" data-id="${esc(z.id)}" aria-label="Opties voor zone ${esc(z.name)}">•••</button></article>`).join('')}</div></section>${standScenesMarkup(false)}</div>`;
  }
  function powerControl() {
    const states = powerTargets().map(r => r.state.on !== false && r.state.power !== false);
    const value = states.length&&states.every(Boolean) ? true : states.some(Boolean) ? 'mixed' : false;
    const scope=standControlOpen?'stand':'zone';
    return `<div class="power-card power-card-${scope}"><div><strong>${icon('power')}Hele ${scope}</strong></div><button class="switch" role="switch" aria-label="${value==='mixed'?`Deels aan; zet de hele ${scope} aan`:`Hele ${scope} aan of uit`}" aria-checked="${value===true}" data-mixed="${value==='mixed'}" data-action="power" ${states.length?'':'disabled'}><span>${value === 'mixed' ? 'Deels aan' : value ? 'Aan' : 'Uit'}</span><i aria-hidden="true"></i></button></div>`;
  }
  function renderControls() {
    const colour=controlMode==='colour';
    const oneLine=receivers().length===1;
    const spatialGallery=!colour&&showControlAnimationGallery&&libraryTab()==='tunnel';
    const modeContent=colour
      ?`<section class="bediening-workspace" aria-labelledby="bediening-colour-title"><header class="bediening-workspace-heading"><span class="menu-icon">${icon('sun')}</span><div><h2 id="bediening-colour-title">Vaste kleur</h2><p>${oneLine?'Kies een kleur voor deze ledline.':'Kies ledlines om samen te bedienen.'}</p></div></header><div class="animation-context">${selector()}${powerControl()}</div>${colourPickerMarkup()}</section>`
      :`<section class="bediening-workspace animation-simple-workspace" aria-labelledby="bediening-effects-title"><header class="bediening-workspace-heading"><span class="menu-icon">${icon('animation')}</span><div><h2 id="bediening-effects-title">${esc(t('effects'))}</h2><p>Kies een animatie of pas je huidige effect aan.</p></div></header>${spatialGallery?'':`<div class="animation-context">${selector()}${powerControl()}</div>`}${controlAnimationPanel()}</section>`;
    return `<div class="editor-grid${colour?'':' animation-simple-page'}">${controlContext('controls')}<section class="editor-controls editor-controls-zone">${ledlineSetupMarkup()}<section class="control-workspace"><div class="control-mode-panel" role="region" aria-label="${colour?'Vaste kleur':'Animaties'}" data-control-mode="${controlMode}">${modeContent}</div></section></section></div>`;
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
    return `<div class="editor-grid">${controlContext('colour')}<section class="editor-controls">${ledlineSetupMarkup()}${selector()}${colourPickerMarkup()}</section></div>`;
  }
  function myColoursMarkup() {
    const entries=savedColours.colors;
    return `<section class="my-colours"><div class="section-heading"><h3>${esc(t('myColours'))}</h3><div class="colour-library-actions"><button class="icon-button colour-manager-button" data-action="colours-manager" aria-label="${esc(t('colourManagerTitle'))}" title="${esc(t('colourManagerTitle'))}" ${entries.length?'':'disabled'}>${icon('trash')}</button><button class="text-button" data-action="colours-manage" aria-pressed="${colourOrderMode}" ${entries.length<2&&!colourOrderMode?'disabled':''}>${esc(t(colourOrderMode?'done':'colourOrder'))}</button></div></div><p class="colour-library-hint">${esc(t(colourOrderMode?'colourLibraryOrderHint':'colourLibraryHint'))}</p><div class="saved-colour-grid ${colourOrderMode?'is-ordering':''}">${entries.map(entry=>`<div class="saved-colour-item${entry.group==='brand'?' is-brand':''}" data-colour-id="${esc(entry.id)}"><button class="saved-colour" data-action="swatch" data-id="${esc(entry.id)}" data-rgb="${entry.color.r},${entry.color.g},${entry.color.b}" data-white="${entry.color.w}" style="--swatch:${C.hex(C.mixWhite([entry.color.r,entry.color.g,entry.color.b],entry.color.w))}" aria-label="${esc(entry.name)}${entry.group==='brand'?` · ${esc(t('brandTag'))}`:''}"><i></i><span>${esc(entry.name)}</span>${entry.group==='brand'?`<small class="saved-colour-kind">${esc(t('brandTag'))}</small>`:''}</button>${colourOrderMode?`<button class="colour-drag-handle" data-colour-drag="${esc(entry.id)}" aria-label="${esc(entry.name)} verslepen" title="Versleep om de volgorde te wijzigen"><span aria-hidden="true">⠿</span><small>Sleep</small></button>`:''}</div>`).join('')}<button class="saved-colour add-colour" data-action="colour-new" aria-label="${esc(t('saveCurrentColour'))}"><i aria-hidden="true">＋</i><span>${esc(t('saveColour'))}</span></button></div><div class="colour-library-feedback"><p class="colour-library-status" role="status">${esc(colourLibraryNotice)}</p></div>${savedColours.error?`<p role="alert">${esc(savedColours.error.message)}</p>`:''}</section>`;
  }
  function showColourManager(notice=colourLibraryNotice) {
    if(!colourManagerReturn){
      const dialog=document.getElementById('effect-dialog');
      colourManagerReturn={open:dialog.open,title:dialog.querySelector('#effect-dialog-title')?.textContent||'',content:document.getElementById('effect-dialog-content').innerHTML,scrollTop:dialog.scrollTop,brandEditor:brandEditor?{...brandEditor,color:{...brandEditor.color},memory:{...brandEditor.memory}}:null};
    }
    colourManagerVisible=true;
    colourLibraryNotice=notice;
    const brands=savedColours.colors.filter(entry=>entry.group==='brand'),brandIndex=new Map(brands.map((entry,index)=>[entry.id,index]));
    const rows=savedColours.colors.map(entry=>{const brand=entry.group==='brand',index=brandIndex.get(entry.id);return `<div class="colour-manager-row${brand?' is-brand':''}"><span class="colour-manager-swatch" style="--swatch:${C.hex(C.mixWhite([entry.color.r,entry.color.g,entry.color.b],entry.color.w))}" aria-hidden="true"><i></i></span><span class="colour-manager-copy"><b>${esc(entry.name)}</b><small>${brand?`${esc(t('brandTag'))} · `:''}RGB ${entry.color.r} · ${entry.color.g} · ${entry.color.b} · W ${entry.color.w}</small></span>${brand?`<button class="text-button colour-manager-edit" data-action="brand-colour-edit" data-id="${index}" aria-label="${esc(t('brandEdit',{number:index+1}))}">${esc(t('brandEditAction'))}</button>`:''}<button class="icon-button colour-manager-remove" data-action="colour-remove" data-id="${esc(entry.id)}" aria-label="${esc(entry.name)} verwijderen" ${brand&&brands.length<=1?`disabled title="${esc(t('brandLastColorHint'))}"`:''}>${icon('trash')}</button></div>`;}).join('');
    const body=`<section class="colour-manager" data-colour-manager><p>${esc(t('colourManagerIntro'))}</p>${rows?`<div class="colour-manager-list">${rows}</div>`:`<div class="colour-manager-empty"><span class="menu-icon">${icon('trash')}</span><b>${esc(t('colourManagerEmpty'))}</b><small>${esc(t('colourManagerEmptyHint'))}</small></div>`}${brands.length<4?`<button class="button secondary full" data-action="brand-colour-add">＋ ${esc(t('brandAdd'))}</button>`:''}<p class="colour-library-status" role="status">${esc(colourLibraryNotice)}</p>${removedColour?`<button class="button secondary full" data-action="colour-undo">${esc(t('colourManagerUndo'))}</button>`:''}</section>`;
    showEffectDialog(t('colourManagerTitle'),body);
    document.querySelector('#effect-dialog [data-action="colour-remove"],#effect-dialog [data-action="effect-dialog-close"]')?.focus({preventScroll:true});
  }
  function closeColourManager(){
    const previous=colourManagerReturn;colourManagerReturn=null;colourManagerVisible=false;brandEditor=previous?.brandEditor||null;
    if(!previous?.open){
      document.querySelectorAll('main .my-colours').forEach(section=>section.outerHTML=myColoursMarkup());
      closeEffectDialog();return;
    }
    showEffectDialog(previous.title,previous.content);
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
  function saveCurrentColour(button) {
    const root=button.closest('[data-colour-picker]');if(!root)return;
    const values=pickerChannels(root),color={r:values[0],g:values[1],b:values[2],w:values[3],bri:root.dataset.colourPicker==='brand'?100:root.dataset.colourPicker==='background'?(selectedState().bgBrightness??10):(selectedState().bri??100)};
    const current=colourStore.load();if(current.error)return refreshColourLibraries(button,current.error.message);
    const base=Colours.suggestName(color);let name=base,suffix=2;
    while(current.colors.some(entry=>entry.name===name))name=`${base} ${suffix++}`;
    const result=colourStore.save(Colours.capture(name,color));
    if(result.error)return refreshColourLibraries(button,result.error.message);
    savedColours=result;refreshColourLibraries(button,`${name} toegevoegd aan Kleurpresets.`);
  }
  window.LightningColourLibraryDrag?.install({document,onMove:({id,toIndex,source})=>{
    // The one visible grid now represents the complete shared library.
    const target=savedColours.colors[toIndex];
    if(!target)return;
    const result=colourStore.move(id,savedColours.colors.findIndex(entry=>entry.id===target.id));if(result.error)return refreshColourLibraries(source,result.error.message);
    savedColours=result;refreshColourLibraries(source,'Volgorde bewaard.');
  }});
  function colourPickerMarkup(slot=null) {
    const s=selectedState(),brand=slot==='brand',background=slot==='background',values=brand?brandEditorChannels():background?backgroundChannels():effectiveColourChannels(slot??0),rgb=values.slice(0,3),white=values[3];
    const prefix=slot===null?'static':'palette-'+slot;
    return `<section class="card colour-card shared-colour-picker" data-colour-picker="${brand?'brand':background?'background':slot===null?'static':'animation'}" data-slot="${brand?brandEditor.index:slot??''}">
      <div class="section-heading"><h2>${background?'Achtergrondkleur':'Kleur kiezen'}</h2></div>
      <div class="colour-tools"><div class="wheel-wrap"><canvas class="wheel" id="colour-wheel" tabindex="0" role="img" aria-label="Kleurenwiel. Gebruik de pijltjestoetsen of de regelaars onder Fijn instellen voor exacte waarden." width="260" height="260"></canvas><span class="wheel-cursor"></span></div><div class="colour-values"><div class="colour-swatch" aria-label="Gekozen kleur"></div><p class="setting-hint">Tik of sleep naar je kleur.</p>${brand?`<small class="brand-picker-note">${esc(t(brandEditor.isNew?'brandPickerNewHint':'brandPickerHint'))}</small>`:slot===null?'':'<small>Je animatie blijft actief.</small>'}</div></div>
      ${brand?`<label class="dialog-field brand-name-field">${esc(t('brandNameLabel'))}<input type="text" data-brand-name maxlength="64" autocomplete="off" value="${esc(brandEditor.name)}"></label><p class="brand-picker-status" role="status" aria-live="polite"></p>`:''}
      ${slot===null?slider('bri','Helderheid',0,100,s.bri??100,'%'):''}
      <div class="fine-controls" data-colour-fine><h3>Fijn instellen</h3><div class="fine-controls-body"><p class="channel-help">Tik op een letter om het kanaal aan of uit te zetten. Tik op een getal voor een exacte waarde. W voegt wit licht toe.</p>${['r','g','b','w'].map((channel,i)=>{const value=i===3?white:rgb[i];return `<div class="channel-row" style="--channel:${['#c4473f','#258461','#3f69c7','#747670'][i]}"><button class="channel-toggle" data-action="channel-toggle" data-channel="${channel}" aria-label="Kanaal ${channel.toUpperCase()} ${value>0?'uitschakelen':'inschakelen'}" aria-pressed="${value>0}">${channel.toUpperCase()}</button><button data-action="channel-step" data-channel="${channel}" data-step="-1" aria-label="${channel.toUpperCase()} verminderen">−</button><input id="${prefix}-${channel}" type="range" min="0" max="255" value="${value}" data-channel="${channel}" aria-label="Kanaal ${channel.toUpperCase()} waarde"><button data-action="channel-step" data-channel="${channel}" data-step="1" aria-label="${channel.toUpperCase()} verhogen">+</button><input class="channel-number" type="number" inputmode="numeric" min="0" max="255" step="1" value="${value}" data-channel-number="${channel}" aria-label="Kanaal ${channel.toUpperCase()} exact instellen"></div>`;}).join('')}</div></div>
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
    const description=t(zone().type==='RGBW'||effect.category==='whole'?'animationBackgroundWhole':'animationBackgroundPixels');
    return `<section class="animation-background" aria-label="${esc(t('animationBackground'))}"><div class="background-control-heading"><span class="setting-label-icon">${icon('layers')}</span><span class="background-control-copy"><b>${esc(t('animationBackground'))}</b></span><button class="switch" data-action="background-toggle" aria-label="${esc(t('animationBackground'))}" aria-pressed="${on}" aria-checked="${on}" role="switch"><span>${on?'Aan':'Uit'}</span><i aria-hidden="true"></i></button></div><div class="background-details" data-background-details ${on?'':'hidden'}><p class="background-explanation">${esc(description)}</p><button class="background-colour" data-action="background-edit"><span class="background-swatch" style="background:${C.hex(C.mixWhite(channels.slice(0,3),channels[3]))}"></span><span>${esc(t('animationBackgroundChoose'))}</span>${icon('chevron')}</button>${animationSlider('bgBrightness',t('animationBackgroundBrightness'),0,100,s.bgBrightness??10,'%')}${resetMarkup('bgBrightness',t('animationBackgroundBrightness'))}</div></section>`;
  }
  const animationSettingGuides={
    bri:{icon:'sun',description:'Hoe fel de bewegende kleuren branden.'},
    speed:{icon:'animation',description:'Hoe snel het licht over de ledlines beweegt.'},
    bgBrightness:{icon:'sun',description:'Hoe fel de vaste achtergrondkleur brandt.'},
    smooth:{icon:'sparkle',description:'100% is het meest vloeiend. Je kunt dit zelf aanpassen.'},
    widthPixels:{icon:'light',description:'Hoeveel pixels één lichtpunt inneemt.'},
    objectCount:{icon:'together',description:'Hoeveel lichtpunten tegelijk bewegen.'},
    trailLength:{icon:'animation',description:'Hoe lang de lichtstaart achter een lichtpunt is.'},
    spacing:{icon:'zones',description:'Hoeveel ruimte er tussen lichtpunten zit.'},
    lineDelayMs:{icon:'clock',description:'Hoe lang elke volgende ledline wacht met starten.'},
    delayMs:{icon:'clock',description:'Hoe lang het licht wacht voor de volgende beweging.'},
    fadeAmount:{icon:'sun',description:'Hoe geleidelijk het licht aan en uit gaat.'},
    width:{icon:'light',description:'Hoe breed de lichtbundel op de ledline is.'},
    spread:{icon:'zones',description:'Hoe ver de beweging zich over de ledlines verspreidt.'},
    randomness:{icon:'sparkle',description:'Voegt kleine verschillen aan de beweging toe.'}
  };
  function animationControls(effect) {
    if (!effect) return '';
    const s = selectedState(), available = effect.controls;
    const specs = [
      ['widthPixels','Breedte',1,60,s.widthPixels??8,' px',''],
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
    const directionLabels=zone().layout==='vertical'?['→ Naar rechts','← Naar links']:effect.category==='tunnel'?['↓ Volgorde 1 → 2','↑ Volgorde 2 → 1']:['→ Vooruit','← Achteruit'];
    const directionMap={right:directionLabels[0],left:directionLabels[1],forward:directionLabels[0],reverse:directionLabels[1],bounce:'↔ Heen en weer','center-out':'← · → Vanuit het midden','outside-in':'→ · ← Naar het midden'};
    // A line-to-line delay cannot change a single selected line. Keep the
    // saved setting intact, but don't offer an inactive control in that scope.
    const controls=specs.filter(spec=>available.includes(spec[0])&&!(spec[0]==='lineDelayMs'&&selected().length<2));
    const smoothness=available.includes('smooth')?`<div class="animation-setting">${animationSlider('smooth','Vloeiendheid',0,100,s.smooth??100,'%',animationSettingGuides.smooth.description)}${resetMarkup('smooth','Vloeiendheid')}</div>`:'';
    if(!controls.length&&!smoothness&&!['direction','bounce','mirror'].some(key=>available.includes(key)))return '';
    return `<button class="settings-toggle" data-action="settings-toggle" aria-expanded="${settingsOpen}" aria-controls="animation-settings">${icon('sliders')}<span>${esc(t(settingsOpen?'animationHideSettings':'animationMoreSettings'))}</span>${icon(settingsOpen?'close':'chevron')}</button><section id="animation-settings" class="card settings-panel" ${settingsOpen?'':'hidden'}><p class="animation-preview-feedback"><span class="preview-feedback-icon">${icon('animation')}</span><span>Kijk bovenaan: het ledline-voorbeeld beweegt meteen mee.</span></p>${controls.map(spec=>`<div class="animation-setting">${animationSlider(...spec)}${resetMarkup(spec[0],spec[1])}</div>`).join('')}${smoothness}${available.includes('direction') ? `<div class="direction-setting"><p class="direction-setting-label"><span class="setting-label-icon">${icon('back')}</span><span><b>Richting</b><small>Kies welke kant het licht op beweegt.</small></span></p><div class="compact-direction" aria-label="Bewegingsrichting">${(effect.directions||['right','left']).map(value=>`<button data-action="direction" data-value="${value}" aria-pressed="${(s.direction||effect.state.direction)===value}">${esc(directionMap[value]||value)}</button>`).join('')}</div></div>`:''}</section>`;
  }
  function animationSettingValue(key,value,unit='') { return ['delayMs','lineDelayMs'].includes(key)?`${Number((Number(value)/1000).toFixed(3)).toLocaleString('nl-BE',{maximumFractionDigits:3})} s`:Math.round(value)+unit; }
  function animationSlider(key,label,min,max,value,unit='',hint='') {
    return slider(key,label,min,max,value,unit,hint,animationSettingGuides[key]||{icon:'sliders',description:hint||'Pas dit aan en bekijk meteen het voorbeeld.'}).replace(`${Math.round(value)}${unit}</output>`,`${animationSettingValue(key,value,unit)}</output>`);
  }
  function settingDefault(key) { return key==='smooth'?100:activeEffect()?.state[key]??(key==='bri'?100:key==='bgBrightness'?10:['bounce','mirror'].includes(key)?false:undefined); }
  function settingChanged(key) { const fallback=settingDefault(key);return fallback!==undefined&&(selectedState()[key]??fallback)!==fallback; }
  function syncSettingResets() { document.querySelectorAll('[data-action="setting-reset"]').forEach(button=>{button.hidden=!settingChanged(button.dataset.id);}); }
  function animationEditorMarkup(effect) {
    const s = selectedState();
    // Place the change action next to the current animation as well as in
    // the persistent dock, where it stays reachable deep in the settings.
    const galleryAction=route.screen==='controls'?'animation-gallery':'animations-gallery';
    const paletteTitle=effect.whiteMixPreset?'Witmix · tik om aan te passen':effect.category==='brand'?(effect.id==='v30-brand-focus'||effect.id.startsWith('v31-ref-'))?'Merkkleuren · tik om te wijzigen':'Accentkleur · tik om te wijzigen':effect.paletteEditable===false?'Kleurenreeks':'Animatiekleuren · tik om te wijzigen';
    const paletteHelp=effect.whiteMixPreset?'<p class="palette-guidance">W geeft wit licht; rood en een beetje groen maken de mix warmer. Pas de mengkleur aan terwijl je naar je ledline kijkt.</p>':effect.id==='v30-brand-focus'?'<p class="palette-guidance">Voeg kleuren toe voor je merkaccent. De gloed laat ze na elkaar zien langs de ledlines.</p>':'';
    const content = `<div class="current-effect"><div><small>${esc(t('animationSettings'))}</small><b tabindex="-1" role="heading" aria-level="2">${esc(Library.displayName(effect,t))}</b></div><button type="button" class="current-effect-gallery animation-gallery-return animation-chooser-action" data-action="${galleryAction}" aria-label="${esc(t('animationChooseAnother'))}"><span class="gallery-action-label"><span class="gallery-action-icon" aria-hidden="true">${icon('animation')}</span><span class="gallery-action-copy"><b>${esc(t('animationChooseAnother'))}</b><small>${esc(t('animationChooseAnotherHint'))}</small></span></span><span class="gallery-action-next" aria-hidden="true">${icon('chevron')}</span></button></div><section class="card palette-section animation-daily-controls"><h2>${effect.whiteMixPreset||effect.paletteEditable===false?paletteTitle:esc(t('animationColours'))}</h2>${paletteHelp}<div class="palette" aria-label="${esc(t('animationColours'))}">${paletteMarkup(s)}</div>${backgroundControls(effect)}${effect.controls.includes('speed')?`${animationSlider('speed',t('animationSpeed'),0,100,s.speed??30,'%')}${resetMarkup('speed',t('animationSpeed'))}`:''}${animationSlider('bri',t('animationBrightness'),0,100,s.bri??100,'%')}${resetMarkup('bri',t('animationBrightness'))}</section>${animationControls(effect)}<button class="button secondary full animation-save-recipe" data-action="preset-save">＋ ${esc(t('animationSaveOwn'))}</button>`;
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
  function brandSwatch(color){return C.hex(C.mixWhite([color.r,color.g,color.b],color.w));}
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
    const galleryTunnel=libraryTab()==='tunnel'&&(route.screen==='effects'||route.screen==='controls'&&controlMode==='animations'&&showControlAnimationGallery);
    return editorTunnel||galleryTunnel;
  }
  function setSpatialPreviewCategory(value){
    if(!route.zoneId)return;
    // Tunnel is the default sample even for wall/vertical installations. Keep
    // a wall view only when the customer explicitly chose it in the preview UI.
    if(value==='tunnel')spatialViews.set(route.zoneId,spatialViews.get(route.zoneId)==='wall'?'wall':'tunnel');
    else spatialViews.delete(route.zoneId);
  }
  function spatialMode(layout=zone()?.layout,z=zone()){
    if(z&&spatialViews.has(z.id))return spatialViews.get(z.id);
    if(tunnelSpatialContext())return 'tunnel';
    if(layout==='vertical')return 'wall';
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
    const view=spatialMode();
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
    return addPreview(list,representativeOnly?'stacked':zone().layout,tunnel?'tunnel-effect-preview':reference?'reference-preview':'',{label:Library.displayName(effect,t),effectId:effect.id,brand:effect.category==='brand'&&!effect.whiteMixPreset,brandPaletteLimit:effect.paletteEditable===false?0:effect.colorCountRange?.max||4,labels:!representativeOnly,lineNumbers,...(tunnel?{...tunnelPreviewOptions(Library.displayName(effect,t)+' · '+ledlineCount(list.length)),geometryReceivers:receivers()}:{} )});
  }
  function tunnelGalleryPreviewMarkup(group=null,css='tunnel-live-preview') {
    const connected=receivers(),example=group?.preview||catalogue().find(effect=>effect.category==='tunnel'&&Number(effect.state.variant)===93)||catalogue().find(effect=>effect.category==='tunnel');
    if(!example)return '';
    const state={...effectState(example),speed:Math.max(75,Number(example.state.speed)||0)},sampleType=zone()?.type||'RGBW';
    const illustrative=!group;
    const base=connected[0]||model.receivers.find(receiver=>receiver.type===sampleType);
    const list=illustrative?Array.from({length:4},(_,index)=>({
      ...(base?copy(base):{}),id:`tunnel-gallery-example-${index+1}`,name:`Ledline ${index+1}`,type:sampleType,order:index,
      outputs:sampleType==='SPI'?[{port:1,enabled:true,pixels:48,reversed:false}]:[],state:copy(state)
    })):connected.map(receiver=>({...receiver,state:copy(state)}));
    const view=spatialMode('stacked',zone());
    const label=illustrative?t(view==='wall'?'animationWallSampleAccessible':'animationTunnelSampleAccessible'):t('animationTunnelGroupAccessible',{name:group.title,count:list.length});
    const lineNumbers=Object.fromEntries(list.map((receiver,index)=>[receiver.id,index+1]));
    return addPreview(list,'stacked',`${css} tunnel-effect-preview`,{
      main:true,selection:{kind:'all'},selectionFeedback:false,geometryReceivers:list,presentation:'receivers',lineNumbers,
      ...(['tunnel','wall'].includes(view)?{spatialShape:view}:{}),tunnelPreview:true,
      spatialLabelPrefix:label,label,illustrativeTunnel:illustrative
    });
  }
  function tunnelGuide({compact=false}={}) {
    const count=receivers().length;
    const status=count<2?t('animationAcrossMinimum'):t('animationAcrossAutoApply');
    const explanation=t('animationAcrossIndividualHint');
    if(compact)return `<section class="tunnel-guide tunnel-guide-compact" aria-label="${esc(t('animationAcross'))}"><strong>${esc(status)}</strong><small>${esc(explanation)}</small></section>`;
    const visual=tunnelGalleryPreviewMarkup(null,'tunnel-live-preview'),sampleTitle=t(spatialMode('stacked',zone())==='wall'?'animationWallSampleTitle':'animationTunnelSampleTitle');
    return `<section class="tunnel-guide" aria-label="${esc(t('animationAcross'))}"><figure class="tunnel-visual"><figcaption><b>${esc(sampleTitle)}</b><small>${esc(t('animationTunnelSampleLines'))}</small></figcaption>${visual}</figure><div class="tunnel-status"><strong>${esc(status)}</strong><small>${esc(explanation)}</small></div></section>`;
  }
  function presetContext() { return {type:zone().type,receiverCount:receivers().length,selection:selection(),layout:zone().layout}; }
  function renderPresets() {
    savedPresets=presetStore.load();
    if(savedPresets.error)return `<div class="card"><h2>Mijn animaties konden niet worden gelezen</h2><p>${esc(savedPresets.error.message)} Je bestaande opslag is niet gewijzigd.</p></div>`;
    if(!savedPresets.presets.length)return `<section class="card empty"><h2>Mijn animaties</h2><p>Kies eerst een animatie, stel de kleuren en beweging in en tik op <b>Animatie bewaren</b>.</p><button class="button" data-action="library" data-id="all">Een animatie kiezen</button></section>`;
    return `<div class="preset-list">${savedPresets.presets.map(preset=>{const restored=S.restore(preset,presetContext(),catalogue());return `<article class="preset-card"><div><b>${esc(preset.name)}</b><small>${esc(categoryLabel(preset.category))} · ${esc(restored.compatible?'Voor je huidige selectie':restored.reason)}</small></div><button class="button" data-action="preset-apply" data-id="${esc(preset.id)}" ${restored.compatible?'':'disabled'}>Toepassen</button><button class="icon-button" data-action="preset-delete" data-id="${esc(preset.id)}" aria-label="${esc(preset.name)} verwijderen">${icon('close')}</button></article>`;}).join('')}</div>`;
  }
  function effectCards(effects,extraClass='',variantTotal=0) {
    const selectedCount=selected().length;
    const className=`effect-card${extraClass?` ${extraClass}`:''}`;
    return effects.map((effect,index)=>{const needsAll=effect.requireTogether||effect.category==='tunnel',minimum=effect.minimumReceivers||1,tooFew=selectedCount<minimum,locked=needsAll?receivers().length<minimum:tooFew;return `<button class="${className}" data-action="effect" data-id="${esc(effect.id)}" data-motion="${effectMotionKey(effect)}" aria-pressed="${activeEffect()?.id===effect.id}" ${locked?'disabled':''}>${effectPreview(effect,needsAll?{tunnelLines:'all'}:{})}<b>${esc(Library.displayName(effect,t))}</b>${variantTotal>1?`<small class="animation-variant-position">${esc(t('animationVariantPosition',{current:index+1,total:variantTotal}))}</small>`:''}<small>${esc(categoryLabel(effect.category))} · ${esc(effect.description)}</small>${locked?`<small>${needsAll?t('animationAcrossMinimum'):t('animationSelectMinimum',{count:minimum})}</small>`:''}</button>`;}).join('');
  }
  function animationFamilyCard(group) {
    const type=zone()?.type==='SPI'?'SPI':'RGBW',openLabel=t('animationOpenGroup'),countLabel=t(group.count===1?'animationCountOne':'animationCountMany',{count:group.count}),nextStep=t('animationGroupNextStep');
    const tunnel=group.preview.category==='tunnel';
    return `<article class="animation-family-card${tunnel?' tunnel-family-card':''}"><button class="animation-family-trigger" data-action="family" data-id="${esc(group.key)}" data-ledline-type="${type}" aria-label="${esc(`${group.title}. ${openLabel}. ${countLabel}. ${nextStep}`)}">${tunnel?'':`<span class="animation-family-preview" data-motion-preview="${effectMotionKey(group.preview)}"><span class="animation-family-preview-label">${esc(t('animationPreview'))}</span>${effectPreview(group.preview)}</span>`}<span class="family-copy">${tunnel?'':`<span class="family-kicker"><span class="animation-type-badge" aria-label="${esc(t('animationBadgeForType',{type}))}">${type}</span></span>`}<b class="family-title">${esc(group.title)}</b><small class="family-summary">${esc(group.summary)}</small><span class="family-variants"><span class="family-variants-copy"><b>${esc(openLabel)}</b><small>${esc(nextStep)}</small></span><span class="family-variants-action"><small>${esc(countLabel)}</small>${icon('chevron')}</span></span></span></button></article>`;
  }
  function animationFamilyDetail(group,tab) {
    const countLabel=t(group.count===1?'animationCountOne':'animationCountMany',{count:group.count});
    const tunnel=group.preview.category==='tunnel',groupHint=tunnel?t('animationTunnelGroupAccessible',{name:group.title,count:receivers().length}):t('animationGroupPreviewHint');
    const backLabel=animationFamilyBackLabel(tab);
    return `<section class="animation-family-detail" aria-labelledby="animation-family-title"><button type="button" class="animation-gallery-return family-back-action family-detail-back" data-action="family-back" aria-label="${esc(backLabel)}"><span class="gallery-action-label"><span class="gallery-action-icon" aria-hidden="true">${icon('back')}</span><span class="gallery-action-copy"><b>${esc(backLabel)}</b></span></span></button><header class="family-detail-heading"><div><small class="family-detail-step">${esc(t('animationFamilyStep'))}</small><h2 id="animation-family-title" tabindex="-1">${esc(group.title)}</h2><p>${esc(group.summary)}</p></div><span class="family-detail-count">${esc(countLabel)}</span></header><figure class="family-detail-preview"><figcaption><b>${esc(t('animationFamilyPreview'))}</b><small>${esc(groupHint)}</small></figcaption>${effectPreview(group.preview,tunnel?{tunnelLines:'all'}:{})}</figure><section class="family-variants-panel" aria-labelledby="animation-family-choices"><header class="family-variants-heading"><div><b id="animation-family-choices">${esc(t('animationFamilyChoose'))}</b><small>${esc(t('animationChooseVariant'))}</small></div><small class="family-variants-count">${esc(countLabel)}</small></header><div class="family-variant-grid">${effectCards(group.effects,'family-variant-card',group.count)}</div></section></section>`;
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
    const items=catalogue(),tab=libraryTab(),active=route.family?Library.group(items,route.family):null;
    const query=animationQueries.get(route.zoneId)||'';
    const counts={catalogue:items.length,...Object.fromEntries(Library.sections(items).map(section=>[section.key,section.count])),presets:savedPresets.presets.length};
    const intro=tab==='brand'?brandTonePicker():tab==='tunnel'?tunnelGuide({compact:route.screen==='controls'&&controlMode==='animations'}):'';
    const inFamily=Boolean(active),results=inFamily?animationFamilyDetail(active,tab):tab==='presets'?renderPresets():query.trim()?effectResults(query):tab==='catalogue'?animationCategorySections(items):animationCategoryFamilyList(items,tab);
    // The tunnel guide already explains its requirements and provides the one
    // relevant action. Keep the gallery free of extra preview disclaimers.
    return `<section class="animation-library-inline" aria-label="${esc(t('animationSelector'))}">${animationLibraryHeading()}${inFamily?'':`<button type="button" id="animation-category" class="animation-category-trigger" data-action="animation-categories" data-category="${esc(tab)}" aria-haspopup="dialog" aria-expanded="false"><span class="animation-category-art">${animationCategoryIcon(tab)}</span><span class="animation-category-copy"><small>${esc(t('animationFilter'))}</small><b>${esc(libraryTabLabel(tab))}</b></span><span class="animation-category-count" aria-label="${esc(t('animationCountMany',{count:counts[tab]||0}))}">${counts[tab]||0}</span>${icon('chevron')}</button>${tab!=='presets'?`<label class="animation-search"><span>${esc(t('animationSearch'))}</span><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></svg><input type="search" id="animation-search" value="${esc(query)}" placeholder="${esc(t('animationSearchHint'))}" autocomplete="off"></label>`:''}${intro}` }<div id="animation-results">${results}</div></section>`;
  }
  function animationLibraryHeading(){
    const current=activeEffect(),canReturn=current&&route.screen==='controls';
    return `<header class="animation-library-heading"><div class="animation-library-title-copy"><small class="animation-library-kicker"><span aria-hidden="true">${icon('animation')}</span>${esc(t('animationSelector'))}</small><h2>${esc(t('chooseAnimation'))}</h2><p class="animation-library-guidance">${esc(t('animationPickerIntro'))}</p></div></header>${canReturn?animationSettingsReturnMarkup('inline'):''}`;
  }
  function animationSettingsReturnMarkup(location){
    const current=activeEffect();
    if(!current||route.screen!=='controls')return '';
    const name=Library.displayName(current,t),label=t('animationCurrentSettingsTitle');
    const attribute=location==='sticky'?'data-editor-return-sticky':'data-editor-return-inline';
    return `<button type="button" class="animation-gallery-return animation-settings-return" ${attribute} data-action="animation-current-edit" aria-label="${esc(t('animationCurrentSettingsAccessible',{name}))}"><span class="gallery-action-label"><span class="gallery-action-icon" aria-hidden="true">${icon('sliders')}</span><span class="gallery-action-copy"><small class="animation-settings-return-kicker">${esc(t('animationSettingsReturnKicker'))}</small><b>${esc(label)}</b><small class="animation-settings-return-name">${esc(name)}</small></span></span><span class="gallery-action-next" aria-hidden="true">${icon('chevron')}</span></button>`;
  }
  function animationCategoryIcon(key){
    return key==='tunnel'?arrangementIcon('stacked'):icon(({catalogue:'zones',whole:'sun',pixels:'animation',brand:'sparkle',presets:'scenes'})[key]||'zones');
  }
  function showAnimationCategories(){
    const tab=libraryTab(),keys=['catalogue','whole',...(zone().type==='SPI'?['pixels']:[]),'tunnel','brand','presets'];
    savedPresets=presetStore.load();
    const items=catalogue(),counts={catalogue:items.length,...Object.fromEntries(Library.sections(items).map(section=>[section.key,section.count])),presets:savedPresets.presets.length};
    const titleKey={catalogue:'animationAllHint',whole:'animationWholeHint',pixels:'animationMovingHint',tunnel:'animationAcrossHint',brand:'animationBrandHint',presets:'animationOwnHint'};
    showEffectDialog(t('animationFilter'),`<div class="animation-category-options" data-animation-categories>${keys.map(key=>`<button type="button" class="animation-category-choice" data-action="animation-category-choice" data-id="${key}" aria-pressed="${tab===key}"><span class="animation-category-art">${animationCategoryIcon(key)}</span><span class="animation-category-copy"><b>${esc(libraryTabLabel(key))}</b><small>${esc(t(titleKey[key]))}</small></span><span class="animation-category-meta"><span>${counts[key]||0}</span>${tab===key?icon('check'):icon('chevron')}</span></button>`).join('')}</div>`);
    // Touch Safari does not focus the invoking button automatically.
    // Restore this exact control on dismiss, not a stale gallery/back button.
    dialogReturnFocus=main.querySelector('[data-action="animation-categories"]');
    dialogReturnFocus?.setAttribute('aria-expanded','true');
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
  function arrangementSignature(z=zone()) {return JSON.stringify([z.id,z.name,z.type,z.receiverIds,z.layout]);}
  function arrangementDirty(){return Boolean(arrangementDraft&&JSON.stringify([arrangementDraft.layout,arrangementDraft.receiverIds])!==arrangementDraft.initial);}
  // Preview receiver order while its atomic metadata update is in flight.
  // Only a confirmed update changes saved geometry or resends receiver state.
  function previewArrangement(z){
    return z&&openLineSetup.has(z.id)&&arrangementDraft?.zoneId===z.id&&
      arrangementDraft.signature===arrangementSignature(z)?arrangementDraft:null;
  }
  function beginArrangement(){
    const z=zone();if(!z)return;
    arrangementDraft={zoneId:z.id,layout:z.layout,receiverIds:[...z.receiverIds],signature:arrangementSignature(z),initial:JSON.stringify([z.layout,z.receiverIds]),error:''};
  }
  async function applyArrangement(){
    const draft=arrangementDraft;if(!draft||arrangementApplying||(!arrangementDirty()&&!draft.error))return false;
    const zoneId=draft.zoneId;
    const browsing=arrangementBrowsing();
    if(zoneId!==route.zoneId||draft.signature!==arrangementSignature()){
      beginArrangement();arrangementDraft.error=t('lineSetupChanged');renderArrangement();return false;
    }
    arrangementApplying=true;
    let failure='',succeeded=false;
    try{
      const next=M.arrangeZone(model,zoneId,{layout:draft.layout,receiverIds:draft.receiverIds});
      draft.error='';renderArrangement({...browsing,focus:null});
      const saved=await persistManagement(next,{kind:'arrange',zoneId,layout:draft.layout,receiverIds:[...draft.receiverIds]},draft.signature);
      if(saved){
        model=saved;
        succeeded=true;
        if(continuousZone())selections.set(zoneId,{kind:'all'});
        if(nativeContext)sendReceiverStates(M.zoneReceivers(model,zoneId).map(r=>r.id),{remember:false});
      }else failure=t('lineSetupSaveFailed');
    }catch(error){failure=error.message||t('lineSetupSaveFailed');}
    finally{
      arrangementApplying=false;
      // Failed or uncertain requests show the last authoritative model, not
      // an unconfirmed selection. Tapping a choice again is a fresh retry.
      if(zone()&&route.zoneId===zoneId){beginArrangement();arrangementDraft.error=failure;}
      else arrangementDraft=null;
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
  function arrangementBrowsing(){const active=document.activeElement;return {route:{...route},controlMode,showGallery:showControlAnimationGallery,query:main.querySelector('#animation-search')?.value||'',scroll:window.scrollY,focus:active?.dataset?.action?{action:active.dataset.action,id:active.dataset.id||'',receiver:active.dataset.receiver||'',delta:active.dataset.delta||''}:null};}
  function restoreArrangementBrowsing(context){
    const search=main.querySelector('#animation-search');
    if(search&&context.query){search.value=context.query;const results=main.querySelector('#animation-results');if(results)results.innerHTML=effectResults(context.query);paint(performance.now()/1000);}
    window.scrollTo({top:context.scroll,left:0,behavior:'instant'});updateControlPreviewDensity();
    if(context.focus){const target=[...main.querySelectorAll('[data-action]')].find(element=>element.dataset.action===context.focus.action&&(element.dataset.id||'')===context.focus.id&&(element.dataset.receiver||'')===context.focus.receiver&&(element.dataset.delta||'')===context.focus.delta);const closedSpatialOption=target?.closest('.spatial-choice-panel[hidden]');(closedSpatialOption?closedSpatialOption.parentElement?.querySelector('.spatial-choice-toggle'):target)?.focus({preventScroll:true});}
  }
  function renderArrangement(context=arrangementBrowsing()){render();restoreArrangementBrowsing(context);}
  function revealLineSetup(){
    const target=main.querySelector('.ledline-setup');if(!target)return;
    const align=()=>{if(!target.isConnected)return;const bottom=Math.max(0,main.querySelector('.control-dock-surface')?.getBoundingClientRect().bottom||0);window.scrollTo({top:Math.max(0,window.scrollY+target.getBoundingClientRect().top-bottom-12),behavior:'instant'});updateControlPreviewDensity();};
    align();requestAnimationFrame(align);target.querySelector('.ledline-setup-toggle')?.focus({preventScroll:true});
  }
  function ledlineSetupMarkup(){
    const z=zone(),open=openLineSetup.has(z.id);
    if(open&&(!arrangementDraft||arrangementDraft.zoneId!==z.id||(!arrangementApplying&&arrangementDraft.signature!==arrangementSignature(z))))beginArrangement();
    const draft=open?arrangementDraft:null;
    const summary=t('lineSetup'+arrangementModeKey(z.layout,z))+' · '+t(z.receiverIds.length===1?'scopeCountOne':'scopeCountMany',{count:z.receiverIds.length});
    const horizontalOrder=['vertical','continuous'].includes(z.layout);
    return `<section class="ledline-setup card" aria-label="${esc(t('spatialPreviewTitle'))}">${spatialPreviewChoice()}<button class="ledline-setup-toggle" data-action="layout" aria-label="${esc(t('lineSetupOrient'))} · ${esc(summary)}" aria-expanded="${open}" aria-controls="ledline-setup-body">${lineOrderIcon()}<span><b>${esc(t('lineSetupOrient'))}</b><small>${esc(t('lineSetupOrientHint'))}</small></span>${icon('chevron')}</button><div class="ledline-setup-body" id="ledline-setup-body" ${open?'':'hidden'}>${open?`
      <section class="ledline-arrangement" aria-label="${esc(t('lineSetupOrder'))}" aria-busy="${arrangementApplying}"><div class="ledline-order-heading"><h3>${esc(t('lineSetupOrder'))}</h3><small>${esc(t('lineSetup'+arrangementModeKey(draft.layout,z)+'Hint'))}</small></div><p class="ledline-setup-hint">${esc(t('lineSetupOrderHint'))}</p>
      <ol class="ledline-draft-order">${draft.receiverIds.map((id,index)=>{const r=model.receivers.find(r=>r.id===id);if(!r)return '';const blinking=identifying.get(id)?.scope==='all';return `<li data-draft-receiver="${esc(id)}"><span class="order-number" aria-hidden="true">${index+1}</span><span class="scope-line-icon" aria-hidden="true">${icon('light')}</span><span class="scope-copy"><span class="scope-option-title">${esc(t('scopeLine',{number:index+1}))}</span><small>${esc(r.name)} · ${r.type==='RGBW'?'RGBW':'Pixel LED · SPI'}</small></span><div class="ledline-order-tools"><button class="receiver-blink" data-action="visual-identify" data-receiver="${esc(id)}" aria-pressed="${blinking}" aria-label="${esc(r.name)} · ${blinking?'stoppen met knipperen':'laten knipperen'}">${icon('sun')}<span>${blinking?'Stop':'Knipperen'}</span></button><div class="ledline-draft-arrows"><button class="icon-button" data-action="draft-order" data-id="${esc(id)}" data-delta="-1" aria-label="${esc(t(horizontalOrder?'lineSetupLeft':'lineSetupUp',{name:r.name}))}" ${index===0?'disabled':''}>${horizontalOrder?'←':'↑'}</button><button class="icon-button" data-action="draft-order" data-id="${esc(id)}" data-delta="1" aria-label="${esc(t(horizontalOrder?'lineSetupRight':'lineSetupDown',{name:r.name}))}" ${index===draft.receiverIds.length-1?'disabled':''}>${horizontalOrder?'→':'↓'}</button></div></div></li>`;}).join('')}</ol>
      </section><details class="ledline-management" ${openLineManagement.has(z.id)?'open':''}><summary>${icon('light')}<span><b>${esc(t('lineSetupManage'))}</b><small>${esc(t('lineSetupManageHint'))}</small></span>${icon('chevron')}</summary><div class="ledline-management-body">${layoutReceiverActions()}<div class="receiver-list">${receivers().map(r=>receiverCard(r)).join('')}</div></div></details>`:''}</div></section>`;
  }
  function layoutReceiverActions() {
    const z=zone(),list=receivers();
    return `<section class="layout-receiver-actions" aria-label="Ledlines in ${esc(z.name)}"><div class="label-row"><h2>Ledlines in deze zone</h2><small>${ledlineCount(list.length)} · ${z.type}</small></div><button class="button full" data-action="layout-receiver-add" data-zone="${esc(z.id)}"><span aria-hidden="true">＋</span> Ledline toevoegen</button></section>`;
  }
  function receiverOrderMarkup() {
    const list=receivers();
    return `<p class="order-help">Laat een ledline knipperen om haar te herkennen. Sleep aan de stippen om de volgorde te wijzigen. Open een ledline voor de instellingen.</p><div class="receiver-list receiver-order combined-receiver-order" aria-label="Volgorde van ledlines">${list.map((r,i)=>receiverCard(r,i)).join('')}</div><p class="order-status" role="status" aria-live="polite"></p>`;
  }
  function productVisual(receiver,compact=false) {
    return `<div class="receiver-product ${compact?'compact list-product':''}"><canvas data-product-receiver="${esc(receiver.id)}" data-compact="${compact}" width="400" height="240" role="img" aria-label="${receiver.type==='RGBW'?'RGBW: één uitgang met vier kleurkanalen':'SPI: schematische receiver met vier uitgangen'}"></canvas>${compact?'':`<p class="receiver-product-caption"><strong>${receiver.type==='RGBW'?'Eén RGBW-uitgang · vier kanalen':`Uitgang ${visualPorts.get(receiver.id)||1} geselecteerd`}</strong>${receiver.type==='RGBW'?'Rood, groen, blauw en wit sturen samen één ledline aan.':'Kies de uitgang die je wilt instellen.'}</p>`}</div>`;
  }
  function receiverCard(r,orderIndex=null) {
    const z=M.getZone(model,r.zoneId),rid=esc(r.id),port=visualPorts.get(r.id)||1;
    const wholeBlink=identifying.get(r.id)?.scope==='all';
    const ordered=route.screen==='layout'&&Number.isInteger(orderIndex);
    return `<details data-receiver-detail="${rid}" ${ordered?`data-order-receiver="${rid}"`:''} ${expandedReceivers.has(r.id)?'open':''}><summary>${ordered?`<button class="order-handle" aria-label="${esc(r.name)} verslepen" title="Sleep om te verplaatsen">⠿</button><span class="order-number">${orderIndex+1}</span>`:productVisual(r,true)}<div class="receiver-heading-copy"><b>${esc(r.name)}</b><small>${r.type} · ${esc(z?.name||'Nog geen zone')}</small>${ordered&&r.type==='SPI'?`<small>${r.outputs.filter(o=>o.enabled).reduce((n,o)=>n+o.pixels,0)} pixels</small>`:''}</div><button type="button" class="receiver-blink ${ordered?'order-identify':''}" data-action="visual-identify" data-receiver="${rid}" aria-pressed="${wholeBlink}" aria-label="${esc(r.name)} · ${r.type==='SPI'?'alle actieve uitgangen samen':'hele receiver'} ${wholeBlink?'stoppen met knipperen':'laten knipperen'}">${icon('sun')}<span>${wholeBlink?'Stop':'Knipperen'}</span></button>${icon('chevron')}</summary><div class="receiver-details">${receiverAssignmentActions(r)}${r.type==='SPI'?`<details class="receiver-connections" data-receiver-connections="${rid}" ${expandedConnections.has(r.id)?'open':''}><summary><span><b>Aansluitingen</b><small>${r.outputs.filter(o=>o.enabled).length} van 4 uitgangen · ${r.outputs.filter(o=>o.enabled).reduce((n,o)=>n+o.pixels,0)} pixels</small></span>${icon('chevron')}</summary><div class="receiver-connections-content">${productVisual(r)}<div class="receiver-ports-heading"><h3>Uitgangen</h3><small>Alle ingeschakelde uitgangen lichten op in het voorbeeld.</small></div><div class="receiver-port-list" aria-label="Uitgang bekijken">${r.outputs.map(o=>`<div class="receiver-port-row ${o.port===port?'port-focused':''}" data-port-row="${o.port}"><button type="button" class="receiver-port-select" data-action="visual-port" data-receiver="${rid}" data-id="${o.port}" aria-pressed="${o.port===port}"><b>P${o.port}</b><span>Uitgang ${o.port}</span></button><button type="button" class="switch receiver-port-switch" role="switch" data-action="receiver-port-enabled" data-receiver="${rid}" data-port="${o.port}" aria-checked="${o.enabled}" aria-label="Uitgang ${o.port} gebruiken" ${nativeContext&&typeof runtime?.services?.configureOutputs!=='function'?'disabled title="Verbind met je installatie-wifi om uitgangen te wijzigen"':''}><span>${o.enabled?'Aan':'Uit'}</span><i aria-hidden="true"></i></button><button type="button" class="receiver-blink" data-action="port-identify" data-receiver="${rid}" data-port="${o.port}" aria-pressed="${identifying.get(r.id)?.scope===String(o.port)}" aria-label="${esc(r.name)} uitgang ${o.port} laten knipperen" ${o.enabled?'':'disabled'}>${icon('sun')}<span>${identifying.get(r.id)?.scope===String(o.port)?'Stop':'Knipperen'}</span></button></div>`).join('')}</div><button class="button full pixel-setup-shortcut" data-action="receiver-pixel-setup" data-id="${rid}">${icon('sliders')}Pixels / aansluiting instellen ${icon('chevron')}</button><p class="port-preview-note">Stel per poort de pixels in en kies waar de stroom binnenkomt.</p></div></details>`:productVisual(r)}${z&&route.screen==='receivers'?`<button class="text-button" data-action="zone" data-id="${esc(z.id)}">Bedien ${esc(z.name)} →</button>`:''}<details class="receiver-manage-menu"><summary>Meer receiveropties ${icon('chevron')}</summary><div class="receiver-manage-content"><button class="text-button" data-action="receiver-rename" data-id="${rid}">Naam wijzigen</button></div></details></div></details>`;
  }
  function receiverAssignmentActions(r) {
    return `<div class="receiver-management"><button class="button secondary" data-action="receiver-move" data-id="${esc(r.id)}">${icon('zones')}Zone wijzigen</button><small>Je koppeling en aansluitingen blijven bewaard.</small></div>`;
  }
  function renderReceivers() {
    const all=standReceivers(),unassigned=all.filter(r=>!r.zoneId);
    const shown=receiverFilter==='unassigned'?unassigned:all,cards=shown.map(r=>receiverCard(r)).join('');
    const canUpdate=nativeContext&&runtime?.native===true&&typeof runtime.services?.otaPlan==='function'&&all.length>0;
    const updateEntry=canUpdate?`<button class="button secondary receiver-update-entry" data-action="receiver-update-all" aria-label="${esc(t('softwareUpdateButton'))}">${icon('update')}<span>${esc(t('softwareUpdates'))}</span></button>`:'';
    return `<div class="page receivers-page"><header class="page-heading"><div><div class="eyebrow">${esc(standLabel())}</div><h1>Receivers</h1><p>Je receivers en hun plek in de stand.</p></div></header><div class="receiver-toolbar${canUpdate?' has-updates':''}"><button class="button" data-action="receiver-add"><span aria-hidden="true">＋</span><span>${esc(t('addReceiver'))}</span></button>${updateEntry}</div><div class="receiver-filters" role="group" aria-label="Receivers filteren">${[['all','Alle receivers',all.length],['unassigned','Niet in een zone',unassigned.length]].map(([id,label,count])=>`<button data-action="receiver-filter" data-id="${id}" aria-pressed="${receiverFilter===id}">${label}<span>${count}</span></button>`).join('')}</div><div class="receiver-list">${cards||`<section class="card empty connection-empty"><h2>${receiverFilter==='unassigned'&&all.length?'Alles heeft een plek':'Nog geen receivers'}</h2><p>${receiverFilter==='unassigned'&&all.length?'Alle receivers zijn aan een zone toegewezen.':stand()?'Voeg je eerste receiver toe om deze stand te verlichten.':'Begin met een naam voor je stand en een zone. Daarna zoek je je eerste receiver.'}</p>${receiverFilter==='unassigned'?'<button class="button secondary" data-action="receiver-filter" data-id="all">Alle receivers bekijken</button>':''}</section>`}</div></div>`;
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
    return `<div class="page scenes-page"><header class="page-heading"><div><div class="eyebrow">${esc(standLabel())}</div><h1>Scènes</h1><p>Je ingestelde verlichting bewaren en later weer gebruiken.</p></div></header>${list.length?'':sceneWorkflow()}<button class="button red" data-action="scene-new" ${ready?'':'disabled'}>＋ Huidig licht bewaren</button>${savedScenes.error?`<p class="card" role="alert">${esc(savedScenes.error.message)}</p>`:''}<div class="section-heading scene-list-heading"><h2>Jouw scènes</h2><small>${list.length} ${list.length===1?'scène':'scènes'}</small></div><div class="scene-list">${cards||`<section class="card empty">${icon('scenes')}<h2>Bewaar je eerste sfeer</h2><p>${ready?'Zijn je kleuren en animaties ingesteld? Kies Huidig licht bewaren en selecteer de zones die je wilt bewaren.':'Voeg eerst verlichting aan een zone toe via Stand. Daarna kun je een scène bewaren.'}</p></section>`}</div>${list.length?`<details class="scene-workflow-help"><summary>Hoe werkt dit?</summary>${sceneWorkflow()}</details>`:''}<p class="scene-reading-note">Tik op <b>Activeren</b> om de scène meteen toe te passen. Open de details om zones te bekijken of de scène aan te passen.</p></div>`;
  }
  function receiverCount(count) { return `${count} ${count===1?'receiver':'receivers'}`; }
  function ledlineCount(count) { return `${count} ${count===1?'ledline':'ledlines'}`; }
  function zoneCount(count) { return `${count} ${count===1?'zone':'zones'}`; }
  function sceneWorkflow() {
    return `<section class="card scene-workflow" aria-labelledby="scene-workflow-title"><h2 id="scene-workflow-title">Eerst instellen, dan bewaren</h2><ol><li><i>${icon('stand')}</i><b>1 · Stel je licht in</b><small>Kleuren en animaties bij Stand</small></li><li><i>${icon('zones')}</i><b>2 · Kies je zones</b><small>Neem alleen mee wat je wilt</small></li><li><i>${icon('scenes')}</i><b>3 · Bewaar je scène</b><small>Geef je sfeer een naam</small></li></ol><button class="text-button" data-action="stand">Naar Stand · verlichting instellen ${icon('chevron')}</button></section>`;
  }
  function savedZonePreview(saved,css='') {
    if(!saved.available)return `<span class="scene-preview scene-preview-unavailable ${css}" role="img" aria-label="${esc(saved.name)}: voorbeeld niet beschikbaar">${icon('info')}<small>Indeling gewijzigd</small></span>`;
    // No zoneId here: paint must retain the captured scene state instead of
    // substituting the currently edited zone's live light settings.
    return addPreview(saved.receivers,saved.layout,`scene-preview ${css}`,{label:`Opgeslagen licht · ${saved.name} · ${saved.type}`});
  }
  function scenePreview(scene) {
    const zones=Scenes.previewZones(model,scene),shown=zones.slice(0,4),extra=zones.length-shown.length;
    return `<span class="scene-mosaic" data-zone-count="${zones.length}" aria-label="${zoneCount(zones.length)} in ${esc(scene.name)}">${shown.map(z=>`<span class="scene-mosaic-tile" data-scene-thumbnail-zone="${esc(z.id)}">${savedZonePreview(z)}</span>`).join('')}${extra?`<span class="scene-mosaic-overflow">+${zoneCount(extra)}</span>`:''}</span>`;
  }
  function sceneActivateButtonMarkup(scene){
    const check=Scenes.compatibility(model,scene),label=check.ok?'Activeren':'Niet beschikbaar';
    const explanation=check.ok?`Scène ${scene.name} direct activeren`:`Scène ${scene.name} niet beschikbaar: ${check.reason}`;
    return `<button type="button" class="button red scene-quick-activate" data-action="scene-apply" data-id="${esc(scene.id)}" aria-label="${esc(explanation)}" title="${esc(check.ok?'Past deze scène direct toe.':check.reason)}" ${check.ok?'':'disabled'}>${icon('power')}<span>${label}</span></button>`;
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
    const editing=Boolean(sceneDraft.sceneId),subtitle=editing?'Kies de zones die in de scène horen. Bij bewaren worden hun huidige lichtinstellingen opgeslagen. Er wordt niets meteen geactiveerd.':'Bewaar het licht zoals het nu is ingesteld.';
    const omitted=sceneDraft.omittedZoneCount?`<p class="card scene-edit-warning" role="status">${sceneDraft.omittedZoneCount} zone${sceneDraft.omittedZoneCount===1?' is':'s zijn'} niet meer beschikbaar en ${sceneDraft.omittedZoneCount===1?'wordt':'worden'} niet opgenomen in de bijgewerkte scène.</p>`:'';
    return `<div class="page scene-draft-page">${contextTitle(editing?'Scène aanpassen':'Sfeer bewaren',subtitle,'Scènes','scenes')}${omitted}<label class="dialog-field scene-name-field">Geef je scène een naam<input id="scene-name" maxlength="64" value="${esc(sceneDraft.name)}" placeholder="Bijvoorbeeld: warm welkom"></label><section class="scene-zone-picker" aria-labelledby="scene-zone-picker-title"><div class="section-heading"><h2 id="scene-zone-picker-title">Welke zones wil je bewaren?</h2></div><div class="scene-bulk-actions"><button class="text-button" data-action="scene-select-all">Alle zones kiezen</button><button class="text-button" data-action="scene-clear-selection">Selectie wissen</button></div>${sceneSearch('draft',stand().zones.length)}<div class="scene-zone-list">${stand().zones.map(z=>{
      const count=M.zoneReceivers(model,z.id).length;
      return `<button class="scene-zone" data-action="scene-zone" data-id="${esc(z.id)}" data-scene-filter-name="${esc(z.name+' '+(z.type||''))}" aria-pressed="${sceneDraft.zoneIds.includes(z.id)}" ${count?'':'disabled'}>${count?zonePreview(z,'scene-preview',{label:`Huidig licht · ${z.name} · ${z.type}`}):`<span class="scene-preview scene-preview-unavailable">${icon('zones')}</span>`}<span><b>${esc(z.name)}</b><small>${count?`${receiverCount(count)} · ${z.type}`:'Nog geen verlichting'}</small></span><i aria-hidden="true">${sceneDraft.zoneIds.includes(z.id)?'✓':'+'}</i></button>`;
    }).join('')}</div><p class="scene-search-empty card" hidden>Geen zones gevonden. Pas je zoekopdracht aan; je selectie blijft bewaard.</p></section><div class="scene-save-bar"><p data-scene-selection-summary role="status" aria-live="polite"></p><p class="scene-save-error" data-scene-save-error role="alert" hidden></p><button class="button red full" data-action="scene-save" disabled>${editing?'Scène bijwerken':'Scène opslaan'}</button><small>${editing?'Het huidige licht wordt opgeslagen; je verlichting wordt niet aangepast.':'Opslaan verandert je verlichting niet.'}</small></div><button class="button secondary full" data-action="scenes">Annuleren</button></div>`;
  }
  function renderSceneDetail() {
    if(!stand())return renderScenes();
    const scene=savedScenes.scenes.find(s=>s.id===route.sceneId&&s.standId===stand().id);if(!scene)return renderScenes();
    const check=Scenes.compatibility(model,scene),zones=Scenes.previewZones(model,scene),count=zones.reduce((n,z)=>n+z.receiverCount,0);
    return `<div class="page scene-detail-page">${contextTitle(scene.name,'Opgeslagen scène · bekijken verandert niets.','Scènes','scenes')}<button class="button secondary full scene-edit-button" data-action="scene-edit" data-id="${esc(scene.id)}">${icon('edit')} Scène aanpassen</button><div class="scene-scope-summary"><span>${icon('zones')}<b>${zoneCount(zones.length)}</b></span><span>${icon('receiver')}<b>${receiverCount(count)}</b></span></div><section class="scene-detail"><div class="section-heading"><h2>Zones in deze scène</h2><small>Opgeslagen licht</small></div>${check.ok?'':`<p class="card scene-zone-warning" role="alert">${esc(check.reason)} Er wordt niets gedeeltelijk geactiveerd.</p>`}${sceneSearch('detail',zones.length)}<div class="scene-saved-zones">${zones.map((z,i)=>`<article class="scene-saved-zone" data-scene-zone="${esc(z.id)}" data-scene-zone-type="${z.type}" data-scene-filter-name="${esc(z.name+' '+z.type)}"><header><span class="scene-zone-number">${i+1}</span><div><h3>${esc(z.name)}</h3><small>${z.type} · ${receiverCount(z.receiverCount)}</small></div></header>${savedZonePreview(z)}${z.available?'':`<p class="scene-zone-warning">${esc(z.reason)}</p>`}</article>`).join('')}</div><p class="scene-search-empty card" hidden>Geen scènes gevonden. Pas je zoekopdracht aan om je opgeslagen zones te zien.</p></section><div class="scene-save-bar scene-activate-bar"><p>${zoneCount(zones.length)} · samen toepassen</p><button class="button full" data-action="scene-apply" data-id="${esc(scene.id)}" ${check.ok?'':'disabled'}>Scène activeren</button><small>Andere zones blijven ongewijzigd.</small></div><button class="button secondary" data-action="scene-delete" data-id="${esc(scene.id)}">Scène verwijderen</button></div>`;
  }
  function renderPinLogin() {
    if(pinLoginAvailable&&nativeContext)return `<div class="page pin-login-page">${contextTitle('Bestaande stand openen','Met je installatie-PIN','Instellingen','settings')}<section class="card"><h2>Verbind met je stand</h2><p>Kies eerst het <b>ALUVISION-wifi</b> van je stand in Instellingen → Wifi. Het wifi-wachtwoord is dezelfde PIN.</p><p>Je maakt geen nieuwe stand en reset geen receivers.</p><label class="dialog-field">Installatie-PIN<input data-recovery-pin type="password" inputmode="numeric" autocomplete="off" minlength="8" maxlength="12" pattern="[0-9]{8,12}" spellcheck="false" ${pinLoginBusy?'disabled':''}></label><p data-recovery-status role="status">${pinLoginBusy?'PIN controleren en je stand ophalen… Laat de receivers aan.':esc(pinLoginError)}</p><button class="button full" data-action="pin-login-submit" ${pinLoginBusy?'disabled':''}>${pinLoginBusy?'Stand ophalen…':'Stand openen'}</button>${pinLoginBusy?'<button class="button secondary full" data-action="pin-login-cancel">Ophalen stoppen</button>':''}</section><p>Je stand verschijnt pas nadat de receivers en de bewaarde instellingen veilig zijn gecontroleerd.</p></div>`;
    if(!pinRequired()&&!nativeContext)return renderSettings();
    // An older or unvalidated native host must never collect a recovery PIN.
    // New-installation commissioning is not a substitute for authenticated recovery.
    return `<div class="page pin-login-page">${contextTitle('Inloggen met PIN','Je bestaande installatie openen','Instellingen','settings')}<section class="card pin-login-status" aria-labelledby="pin-login-status-title"><span class="menu-icon" aria-hidden="true">${icon('lock')}</span><h2 id="pin-login-status-title" data-pin-login-status>Nog niet beschikbaar in deze versie</h2><p>Veilig inloggen en je bewaarde installatie terughalen worden nog aangesloten. Je kunt hier daarom nog geen PIN invoeren.</p><p>Je huidige stand en receivers blijven ongewijzigd.</p></section><section class="card pin-login-guide"><h2>Waarvoor is deze optie?</h2><p>Je bestaande stand weer openen op een ander toestel of nadat je de app opnieuw hebt geïnstalleerd. Je gebruikt dan je bestaande installatie-PIN; je maakt geen nieuwe PIN of nieuwe stand aan.</p><ol><li><b>Verbind met het wifi van je installatie</b><span>Kies het ALUVISION-netwerk via de wifi-instellingen van je telefoon.</span></li><li><b>Open je installatie met je PIN</b><span>Zodra deze functie beschikbaar is, wordt je PIN veilig gecontroleerd voordat je bewaarde installatie wordt teruggehaald.</span></li></ol></section><button class="button full" data-action="settings">Terug naar Instellingen</button></div>`;
  }
  async function openPinLogin(){
    navigate('pin-login');if(!nativeContext||typeof runtime?.services?.recoverInstallation!=='function'||pinLoginChecking)return;
    pinLoginChecking=true;
    try{const caps=await runtime.capabilities();pinLoginAvailable=caps?.pinLogin===true&&caps?.installationRestore===true;}
    catch(_){pinLoginAvailable=false;}
    finally{pinLoginChecking=false;if(route.screen==='pin-login')render({top:true});}
  }
  async function submitPinLogin(){
    const input=main.querySelector('[data-recovery-pin]');if(!pinLoginAvailable||pinLoginBusy||!input)return;
    let pin=input.value;input.value='';
    if(!/^\d{8,12}$/.test(pin)){pinLoginError='Vul je bestaande PIN van 8–12 cijfers in.';render();return;}
    pinLoginBusy=true;pinLoginError='';pinRecoveryAbort=new AbortController();render();
    try{
      const result=await runtime.services.recoverInstallation({pin,signal:pinRecoveryAbort.signal});pin='';
      model=keepLocalPreviewStates(result.playbackModel,{exceptStandId:result.standId});nativeLoaded=true;selections.clear();liveStates.clear();
      lightIntentDirty=true;saveLightIntent();
      window.AluvisionSecurityMode?.updateFromNative?.({pinRequired:true});
      route={...route,screen:'stand',standId:result.standId,zoneId:null};render({top:true});toast('Je stand is geopend. Kies een zone om je licht te bedienen.');
    }catch(error){
      const messages={PIN_RECOVERY_PIN_INVALID:'Deze PIN klopt niet. Controleer je installatie-PIN.',PIN_RECOVERY_LOCKED:'Er zijn te veel pogingen gedaan. Wacht even voordat je opnieuw probeert.',PIN_RECOVERY_EXPIRED:'De controle is verlopen. Controleer je wifi en probeer opnieuw.',PIN_RECOVERY_UNAVAILABLE:'Je stand kan nog niet volledig worden opgehaald. Controleer de receiverupdates en je wifi.',PIN_RECOVERY_CANCELLED:'Het ophalen is onderbroken. Je bestaande gegevens zijn niet vervangen.'};
      pinLoginError=error?.code==='CANCELLED'?'Het ophalen is gestopt. Je kunt het opnieuw proberen.':messages[error?.code]||'Je stand is nog niet veilig hersteld. Laat de receivers aan, controleer het ALUVISION-wifi en probeer opnieuw.';
    }finally{pin='';pinLoginBusy=false;pinRecoveryAbort=null;if(route.screen==='pin-login')render({top:true});}
  }
  function pinProtectionCard() {
    const selected=securityStand(),current=pinProtection?.standId===selected?.id?pinProtection:null;
    const available=nativeContext&&typeof runtime?.services?.securityStatus==='function'&&typeof runtime?.services?.setPinProtection==='function';
    const ready=!!current&&!pinProtectionLoading&&!pinProtectionBusy&&!pinProtectionReconnect&&!pinProtectionError;
    const message=!nativeContext?'Beschikbaar in de iPhone-app.':!selected?'Geef je stand eerst een naam.':pinProtectionLoading?'Beveiliging controleren…':pinProtectionError||(pinProtectionReconnect?'Verbind opnieuw met het wifi van je installatie.':!available?'De verbindingsdienst is niet beschikbaar.':current?.scope==='new-installation'?'Kies een PIN tijdens het instellen van je stand.':'Eén PIN voor wifi en netwerk verwijderen.');
    return `<section class="card pin-protection-card" data-pin-protection><div class="pin-protection-heading"><span class="menu-icon" aria-hidden="true">${icon('lock')}</span><div><h2>PIN-beveiliging</h2><small>Je PIN is ook je wifi-wachtwoord</small></div><button class="switch" role="switch" aria-label="PIN-beveiliging" aria-checked="${current?.pinRequired===true}" data-action="pin-protection-toggle" ${ready?'':'disabled'}><span>${current?current.pinRequired?'Aan':'Uit':'—'}</span><i aria-hidden="true"></i></button></div><p data-pin-protection-status role="status">${esc(message)}</p>${pinProtectionReconnect?'<button class="text-button" data-action="pin-protection-reconnect">Opnieuw verbinden</button>':pinProtectionError&&available&&selected?'<button class="text-button" data-action="pin-protection-refresh">Opnieuw controleren</button>':''}</section>`;
  }
  function syncPinProtectionCard(){
    const old=main.querySelector('[data-pin-protection]'),focused=document.activeElement;
    if(old){old.outerHTML=pinProtectionCard();restoreControlFocus(focused);}
  }
  function verifiedPinStatus(result){
    return !!result&&['applied','reconnect-required'].includes(result.status)&&typeof result.pinRequired==='boolean'&&typeof result.hasPin==='boolean'&&['installation','new-installation'].includes(result.scope);
  }
  async function refreshPinProtection({afterReconnect=false}={}){
    const standId=securityStand()?.id;
    if(!standId||pinProtectionLoading||pinProtectionBusy||typeof runtime?.services?.securityStatus!=='function')return;
    pinProtectionLoading=true;pinProtectionError='';syncPinProtectionCard();
    try{
      const result=await runtime.services.securityStatus({standId});
      if(!verifiedPinStatus(result))throw Error('SECURITY_UNCONFIRMED');
      if(securityStand()?.id!==standId)return;
      pinProtection={...result,standId};
      if(result.status==='applied')window.AluvisionSecurityMode?.updateFromNative?.({pinRequired:result.pinRequired});
      if(afterReconnect&&result.status==='applied'&&result.pinRequired===pinProtectionReconnect?.pinRequired){pinProtectionReconnect=null;closeEffectDialog();render();toast(result.pinRequired?'PIN-beveiliging staat aan.':'PIN-beveiliging staat uit.');return;}
      if(result.status==='reconnect-required')pinProtectionReconnect={...result,standId};
    }catch(_){pinProtectionError='Nog niet bevestigd. Verbind met het wifi van je installatie en probeer opnieuw.';}
    finally{pinProtectionLoading=false;syncPinProtectionCard();}
  }
  function openPinProtection(){
    const current=pinProtection?.standId===securityStand()?.id?pinProtection:null;if(!current||pinProtectionBusy)return;
    const enabled=!current.pinRequired,needsPin=enabled&&current.scope==='installation'&&!current.hasPin;
    showEffectDialog(enabled?'PIN-beveiliging aanzetten?':'PIN-beveiliging uitzetten?',`<section class="pin-protection-dialog" data-pin-protection-dialog data-enabled="${enabled}" data-stand="${esc(current.standId)}"><p>${enabled?(current.scope==='new-installation'?'Je kiest je PIN tijdens het instellen van je stand.':current.hasPin?'Je bestaande PIN wordt opnieuw gebruikt voor wifi en netwerk verwijderen.':'Beveilig het wifi van je installatie met één PIN.'):'Het receiver-wifinetwerk wordt open. Je stand, zones en koppelingen blijven bewaard.'}</p>${needsPin?'<label class="dialog-field">Kies je PIN · 8–12 cijfers<input data-security-pin type="password" inputmode="numeric" autocomplete="off" minlength="8" maxlength="12" pattern="[0-9]{8,12}" autocapitalize="off" spellcheck="false"></label><label class="dialog-field">Herhaal je PIN<input data-security-pin-repeat type="password" inputmode="numeric" autocomplete="off" minlength="8" maxlength="12" pattern="[0-9]{8,12}" autocapitalize="off" spellcheck="false"></label><small>Bewaar je PIN: voor wifi en netwerk verwijderen.</small>':''}<p class="dialog-error" role="alert" hidden></p><div class="pin-protection-actions"><button class="button secondary full" data-action="effect-dialog-close">Annuleren</button><button class="button full" data-action="pin-protection-save" ${needsPin?'disabled':''}>${enabled?'Aanzetten':'Uitzetten'}</button></div></section>`);
  }
  function showPinReconnect(result){
    showEffectDialog('Verbind opnieuw met wifi',`<section class="pin-protection-dialog" data-pin-reconnect><span class="menu-icon" aria-hidden="true">${icon('lock')}</span><p>Het wifi van je installatie wordt aangepast. Je stand en receivers blijven bewaard.</p><ol><li>Open <b>Instellingen → Wifi</b>.</li><li>Kies ${result.ssid?`<b>${esc(result.ssid)}</b>`:'het ALUVISION-wifi van je installatie'}${result.pinRequired?' en gebruik je PIN':' zonder wachtwoord'}.</li><li>Kom terug naar de app.</li></ol><p role="status">We controleren de verbinding zodra je terugkomt.</p><button class="button secondary full" data-action="pin-protection-recheck">Verbinding controleren</button></section>`);
  }
  async function savePinProtection(button){
    const panel=document.querySelector('[data-pin-protection-dialog]');if(!panel||pinProtectionBusy)return;
    const enabled=panel.dataset.enabled==='true',standId=panel.dataset.stand,pin=panel.querySelector('[data-security-pin]')?.value;
    if(standId!==securityStand()?.id)return;
    if(pin!==undefined&&(!/^\d{8,12}$/.test(pin)||pin!==panel.querySelector('[data-security-pin-repeat]')?.value))return;
    pinProtectionBusy=true;button.disabled=true;button.textContent='Beveiliging aanpassen…';
    panel.querySelectorAll('input').forEach(input=>{input.disabled=true;});
    try{
      const result=await runtime.services.setPinProtection({standId,enabled,...(pin===undefined?{}:{pin}),...(enabled?{}:{confirmation:'DISABLE_PIN'})});
      if(!verifiedPinStatus(result)||result.pinRequired!==enabled)throw Error('SECURITY_UNCONFIRMED');
      panel.querySelectorAll('input').forEach(input=>{input.value='';});
      pinProtection={...result,standId};
      if(result.status==='reconnect-required'||result.requiresWifiReconnect===true){pinProtectionReconnect={...result,standId};showPinReconnect(result);}
      else {pinProtectionBusy=false;window.AluvisionSecurityMode?.updateFromNative?.({pinRequired:result.pinRequired});closeEffectDialog();render();toast(enabled?'PIN-beveiliging staat aan.':'PIN-beveiliging staat uit.');}
    }catch(cause){
      const error=panel.querySelector('.dialog-error');error.textContent=cause?.code==='OTA_PENDING'
        ?'Er is nog een software-update in deze stand niet afgerond. Controleer die eerst bij Receivers → Softwareversie en updates. De PIN-beveiliging is niet gewijzigd.'
        :cause?.code==='OTA_BUSY'?'Er wordt software bijgewerkt. Wacht tot de update klaar is. De PIN-beveiliging is niet gewijzigd.'
        :'De wijziging is nog niet bevestigd. Je stand en receivers zijn niet gewist. Controleer de verbinding en probeer opnieuw.';error.hidden=false;
      panel.querySelectorAll('input').forEach(input=>{input.disabled=false;});button.disabled=false;button.textContent='Opnieuw proberen';
    }finally{pinProtectionBusy=false;syncPinProtectionCard();}
  }
  // Browser walkthrough only: no network service, credential field or native
  // bridge call is exposed by these example settings.
  function demoSettingsTabs(wifi=false){
    return `<div class="section-tabs demo-settings-tabs" role="group" aria-label="Instellingen"><button data-action="demo-settings-tab" data-id="settings" aria-pressed="${!wifi}">${icon('settings')}Algemeen</button><button data-action="demo-settings-tab" data-id="wifi" aria-pressed="${wifi}">${icon('wifi')}Wifi</button></div>`;
  }
  function renderDemoWifi(){
    if(!webDemoContext)return renderSettings();
    return `<div class="page demo-wifi-page"><header class="page-heading"><div><h1>Wifi-instellingen</h1><p>${esc(t('settings'))} · V32</p></div></header>${demoSettingsTabs(true)}<section class="card demo-wifi-notice" aria-labelledby="demo-wifi-title"><span class="pill red">DEMO · niet verbonden</span><h2 id="demo-wifi-title">Alleen een voorbeeld</h2><p>Hier bekijk je de wifi-instellingen. Deze demo zoekt geen echte netwerken, maakt geen verbinding en bewaart geen wifi-wachtwoorden.</p></section><section class="card demo-wifi-network"><div class="demo-wifi-heading"><span class="menu-icon" aria-hidden="true">${icon('wifi')}</span><div><h2>Wifi van je installatie</h2><p>Je telefoon bedient de verlichting via dit netwerk.</p></div></div><dl class="demo-wifi-details"><div><dt>Netwerk</dt><dd>Aluvision-DEMO</dd></div><div><dt>Status</dt><dd>Voorbeeld · geen echte verbinding</dd></div></dl><button class="button full" disabled aria-describedby="demo-wifi-disabled">Verbinding controleren</button><p id="demo-wifi-disabled" class="demo-wifi-caption">Alleen beschikbaar met een echte receiver in de iPhone-app.</p></section><section class="card demo-wifi-guide"><h2>Verbinden in de echte app</h2><ol><li>Open <b>Instellingen → Wifi</b> op je iPhone.</li><li>Kies het ALUVISION-wifi van je installatie.</li><li>Ga terug naar de app om je verlichting te bedienen.</li></ol><p>Je hoeft voor deze demo niets aan je wifi te veranderen.</p></section></div>`;
  }
  function renderSettings() {
    return `<div class="page"><header class="page-heading"><div><h1>${esc(t('more'))}</h1><p>${esc(t('settings'))} · V32</p></div></header><section class="card"><h2>${esc(t('appearance'))}</h2><h3 class="preference-label">${esc(t('language'))}</h3><div class="preference-grid">${Preferences.languages.map(language=>`<button data-action="language" data-id="${language.code}" lang="${language.code}" aria-pressed="${uiPreferences.preferences.language===language.code}">${language.name}</button>`).join('')}</div><p class="preference-note">${esc(t('wipNotice'))}</p><h3 class="preference-label">${esc(t('theme'))}</h3><div class="preference-grid">${['light','dark'].map(theme=>`<button data-action="theme" data-id="${theme}" aria-pressed="${uiPreferences.preferences.theme===theme}">${esc(t(theme))}</button>`).join('')}</div>${uiPreferences.error?`<p role="alert">${esc(uiPreferences.error.message)}</p>`:''}</section><button class="menu-card" data-action="help"><span class="menu-icon">${icon('info')}</span><div><b>Stand en zones uitgelegd</b><small>Een eenvoudige weg naar je verlichting</small></div>${icon('chevron')}</button></div>`;
  }
  function render({top=false,preserveScroll=true}={}) {
    // Apply local presentation before loading/error early returns as well.
    // The optional native appearance acknowledgement remains in the loaded
    // path below; this does not start any native or receiver work earlier.
    document.documentElement.lang=uiPreferences.preferences.language;
    document.body.dataset.theme=uiPreferences.preferences.theme;
    document.querySelector('meta[name="theme-color"]').content=uiPreferences.preferences.theme==='dark'?'#171817':'#f8f8f5';
    // A replaced handle no longer represents an active drag. Cancel before
    // rebuilding the page, so a later pointerup cannot save a stale position.
    if(dragOrder)finishOrder({pointerId:dragOrder.pointerId},true);
    const savedScroll=window.scrollY;
    if(!nativeLoaded){
      main.innerHTML=`<div class="page"><header class="page-heading"><div><h1>${nativeLoadError?'Je gegevens openen':'Je stand openen…'}</h1><p>${nativeLoadError?'Je bewaarde instellingen konden nog niet veilig worden gelezen. Er is niets vervangen of gewist.':'Je bewaarde stand en instellingen worden geladen.'}</p></div></header>${nativeLoadError?'<button class="button full" data-action="native-load-retry">Opnieuw proberen</button>':''}</div>`;
      document.getElementById('navigation').replaceChildren();return;
    }
    if(route.screen==='demo-wifi'&&!webDemoContext)route.screen='settings';
    if(!model.stands.length&&!['stand','scenes','settings','demo-wifi','pin-login','receivers','receiver-add'].includes(route.screen))route.screen='stand';
    if(['controls','colour','animations','effects','layout'].includes(route.screen)&&!zone()){
      // Another client may have removed the zone while a native edit was in
      // flight. Never leave an impossible draft trapping the user here.
      openLineSetup.delete(route.zoneId);openLineManagement.delete(route.zoneId);arrangementDraft=null;
      route={...route,screen:'stand',zoneId:null};toast(t('lineSetupChanged'));
    }
    const animationEditorOpen=route.screen==='animations'||(route.screen==='controls'&&controlMode==='animations'&&!showControlAnimationGallery);
    const visibleEffect=animationEditorOpen?activeEffect():null;
    // No empty animation landing page. This also covers switching from an
    // animated receiver to a static one while its editor is already open.
    if(route.screen==='animations'&&zone()&&receivers().length&&!activeEffect()){
      route={...route,screen:'effects',family:null,library:initialAnimationLibrary(),effectsReturn:'controls'};top=true;
    }
    const focused=document.activeElement,focusKey=focused?.dataset?.id;
    previews.clear();
    const views = {stand:renderStand,controls:renderControls,colour:renderColour,animations:renderAnimations,effects:renderEffects,receivers:renderReceivers,settings:renderSettings,'demo-wifi':renderDemoWifi,'pin-login':renderPinLogin,scenes:renderScenes,'scene-draft':renderSceneDraft,'scene-detail':renderSceneDetail,'receiver-add':renderReceiverAdd};
    const zoneScreen=['controls','colour','animations','effects','layout'].includes(route.screen);
    main.innerHTML = (zoneScreen&&zone()&&!receivers().length?renderEmptyZone:(views[route.screen] || renderStand))();
    const previewDock=main.querySelector('.control-preview-dock');
    if(previewDock){const spatial=previewDock.querySelector('.spatial-preview-wrap')!==null;previewDock.dataset.previewSize=spatial?'large':controlPreviewSize;previewDock.dataset.spatialPreview=spatial?'true':'false';}
    main.classList.toggle('gallery-scroll-stable',Boolean(main.querySelector('#animation-results')));
    if(route.screen==='scene-detail')main.querySelector('.scene-activate-bar')?.insertAdjacentHTML('afterbegin','<p class="live-confirmation" data-live-status="scene" role="status" aria-live="polite"></p>');
    if(route.screen==='settings')main.querySelector('.page-heading')?.insertAdjacentHTML('afterend',pinProtectionCard());
    if(route.screen==='settings'&&Backup)main.querySelector('[data-action="help"]')?.insertAdjacentHTML('afterend',backupPanel());
    if(route.screen==='stand'&&!stand()&&nativeContext)main.querySelector('.onboarding-next-action')?.insertAdjacentHTML('afterend',`<button class="menu-card" data-action="pin-login"><span class="menu-icon">${icon('lock')}</span><span><b>Al een stand? Open met PIN</b><small>Je bestaande receivers en zones terughalen</small></span>${icon('chevron')}</button>`);
    if(route.screen==='stand'&&model.stands.length>1)main.querySelector('.page-heading')?.insertAdjacentHTML('afterend','<button class="text-button" data-action="stand-switch-open">Andere stand openen</button>');
    if(route.screen==='settings'&&nativeContext&&window.__lightningV32ReceiverContext===true&&standReceivers().length){
      main.querySelector('[data-backup-panel]')?.insertAdjacentHTML('afterend',receiverContextPanel());
      syncReceiverContextPanel();readReceiverContextStatus();
    }
    if((pinRequired()||nativeContext)&&route.screen==='settings')main.querySelector('[data-action="help"]')?.insertAdjacentHTML('afterend',
      `<button class="menu-card pin-login-entry" data-action="pin-login"><span class="menu-icon">${icon('lock')}</span><div><b>Inloggen met PIN</b><small>Je bestaande installatie openen</small><small class="pin-login-availability">${pinLoginAvailable?'Je PIN is ook je wifi-wachtwoord':'Controleer de toegang tot je stand'}</small></div>${icon('chevron')}</button>`);
    if(route.screen==='settings')main.querySelector('[data-action="help"]')?.insertAdjacentHTML('afterend',`<button class="menu-card" data-action="preferences-reset"><span class="menu-icon">${icon('settings')}</span><div><b>Taal en thema herstellen</b><small>Alleen taal en thema van deze app</small></div>${icon('chevron')}</button>`);
    if(route.screen==='settings')main.querySelector('[data-action="preferences-reset"]')?.insertAdjacentHTML('afterend',`<section class="card app-erase-section"><h2>Gegevens op deze telefoon</h2><p>Dit verwijdert alleen de gegevens in de app. De fysieke receivers blijven gekoppeld en zijn daarna mogelijk pas na een afzonderlijke reset en nieuwe koppeling weer bedienbaar.</p><button class="button secondary full" data-action="app-erase">Verwijder alles uit de app</button></section>`);
    if(route.screen==='stand')main.querySelectorAll('.stand-summary>div').forEach((tile,index)=>{
      const button=document.createElement('button');button.type='button';button.className='stand-info-tile';
      button.dataset.action=index?'stand-receivers-info':'stand-zones-info';
      button.setAttribute('aria-label',index?'Ledlines in deze stand bekijken':'Zones in deze stand bekijken');
      button.innerHTML=tile.innerHTML+icon('chevron');tile.replaceWith(button);
    });
    if(route.screen==='stand'&&standReceivers().length)main.querySelector('.stand-summary')?.insertAdjacentHTML('afterend',
      `<button class="menu-card stand-control-shortcut" data-action="stand-controls"><span class="menu-icon colour-icon" aria-hidden="true"></span><span><b>Alles bedienen</b><small>Alle zones · kleur en aan/uit</small></span>${icon('chevron')}</button>`);
    if(route.screen==='stand'&&stand()&&!stand().zones.length)main.querySelector('.zone-grid')?.insertAdjacentHTML('beforeend',
      '<section class="card empty"><h2>Nog geen zones</h2><p>Maak een nieuwe zone voor een plek in je stand. Daarna kun je bestaande receivers aan die zone toewijzen of een nieuwe receiver toevoegen.</p></section>');
    if(webDemoContext&&route.screen==='settings'){
      main.querySelector('.page-heading')?.insertAdjacentHTML('afterend',demoSettingsTabs());
      const erase=main.querySelector('.app-erase-section');
      if(erase)erase.querySelector('p').textContent='Alleen deze tijdelijke demopagina wordt leeg gemaakt. Echte receivers en gegevens op de gewone site blijven onaangeroerd.';
    }
    main.querySelectorAll('[data-receiver-detail]').forEach(card=>{
      const r=model.receivers.find(receiver=>receiver.id===card.dataset.receiverDetail);
      if(r.type==='SPI'&&!r.outputs.some(output=>output.enabled))card.querySelector('[data-action="visual-identify"]').disabled=true;
      card.querySelector('summary small').insertAdjacentHTML('afterend',`<small class="receiver-status">${statusText(r)}</small>`);
      if(nativeContext&&runtime?.native===true&&typeof runtime.services?.otaPlan==='function')card.querySelector('.receiver-manage-content').insertAdjacentHTML('beforeend',`<section class="receiver-service-section" aria-label="Receiver en software"><h3>${esc(t('softwareUpdateSection'))}</h3><p>${esc(t('softwareUpdateSubtitle'))}</p><button class="button secondary full" data-action="receiver-update" data-id="${esc(r.id)}">${esc(t('softwareUpdates'))}</button></section>`);
      card.querySelector('.receiver-manage-content').insertAdjacentHTML('beforeend',`<section class="receiver-danger-section" aria-label="Receiver verwijderen"><h3>${r.role==='main'?'Alle receivers ontkoppelen':'Deze receiver ontkoppelen'}</h3><p>${r.role==='main'?'Hiermee verwijder je het volledige receivernetwerk.':'Hiermee verwijder je alleen deze receiver uit het netwerk.'}</p><button class="button secondary full" data-action="receiver-remove" data-id="${esc(r.id)}">${r.role==='main'?'Alle receivers ontkoppelen':'Deze receiver ontkoppelen'}</button></section>`);
    });
    if(zoneScreen&&zone()?.type===null)main.querySelector('.page-heading .pill')?.remove();
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
    const measureContext=()=>document.documentElement.style.setProperty('--sticky-height',previewDock&&getComputedStyle(previewDock).position==='sticky'?`${Math.ceil(previewDock.getBoundingClientRect().height)}px`:'0px');
    measureContext();
    if(previewDock){contextObserver=new ResizeObserver(measureContext);contextObserver.observe(previewDock);}
    const current = route.screen.startsWith('scene')?'scenes':route.screen==='receiver-add'?route.setupFrom||'stand':['pin-login','demo-wifi'].includes(route.screen)?'settings':['receivers','settings'].includes(route.screen)?route.screen:'stand';
    document.getElementById('navigation').innerHTML=[['stand','stand','stand'],['scenes','scenes','scenes'],['receivers','receivers','receiver'],['settings','more','settings']].map(([id,label,glyph])=>`<button data-action="nav" data-id="${id}" ${current===id?'aria-current="page"':''}>${icon(glyph)}<span>${esc(t(label))}</span></button>`).join('');
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
    for(const id of identifyPending.keys())syncIdentifyControls(id);
    syncLiveStatus();
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
      if(!restoreControlFocus(focused)&&focusKey)document.querySelector(`[data-order-receiver="${CSS.escape(focusKey)}"] .order-handle`)?.focus({preventScroll:true});
    }
  }
  function restoreControlFocus(previous) {
    if(!previous?.matches?.('button[data-action]'))return false;
    const keys=['action','id','receiver','port'];
    const same=previous.isConnected?previous:Array.from(document.querySelectorAll('button[data-action]')).find(button=>keys.every(key=>button.dataset[key]===previous.dataset[key]));
    if(!same||same.disabled)return false;
    same.focus({preventScroll:true});return true;
  }
  function navigate(screen, extra={}, {restoreControls=false}={}) {
    // Compatibility for internal callers; layout is now a panel, not a page.
    if(screen==='layout'){screen='controls';openLineSetup.add(extra.zoneId||route.zoneId);}
    if(arrangementApplying)return;
    const previousRoute=route;
    if(screen!==route.screen)visualPlugMotions.clear();
    if(!pinRequired()&&!nativeContext&&screen==='pin-login')screen='settings';
    if(screen==='receiver-add'&&route.screen!=='receiver-add')extra={setupFrom:!stand()||!standReceivers().some(receiver=>receiver.role==='main')||route.screen!=='receivers'?'stand':'receivers',setupReturnZoneId:null,...extra};
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
    if(enteredZone&&activeEffect()&&!restoreControls){controlMode='animations';showControlAnimationGallery=false;}
    render({top:true});
    if(enteredZone&&controlMode==='animations'&&!showControlAnimationGallery&&!restoreControls)revealAnimationStart();
    if(screen==='settings')void refreshPinProtection();
  }
  function resetMarkup(key,label) { return `<button class="setting-reset" data-action="setting-reset" data-id="${key}" aria-label="${esc(label)} terug naar standaard" ${settingChanged(key)?'':'hidden'}>↺ Standaard</button>`; }
  function translateMainControls() {
    // Only known UI controls: never walk and replace arbitrary text or names.
    const titles={colour:'staticColour',animations:'animations',scenes:'scenes','scene-draft':'saveScene',receivers:'receivers',settings:'more','receiver-add':'addReceiver'};
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
    if(scope==='stand')return standReceivers();
    if(scope==='scene'){
      const scene=savedScenes.scenes.find(item=>item.id===route.sceneId&&item.standId===stand()?.id);
      const ids=new Set(scene?.zones.flatMap(item=>item.receivers.map(receiver=>receiver.id))||[]);
      return standReceivers().filter(receiver=>ids.has(receiver.id));
    }
    const ids=new Set(selectedReceiverIds());return receivers().filter(receiver=>ids.has(receiver.id));
  }
  function sendReceiverStates(ids,{remember=true}={}){
    if(remember)scheduleLightIntentSave();
    const time=performance.now()/1000;
    for(const id of ids){
      const receiver=model.receivers.find(item=>item.id===id);if(!receiver)continue;
      const request=liveRequest(receiver,time);
      if(nativeLoaded&&liveController&&request)liveController.request(request);
      else if(liveController)liveController.preview(id);
      else liveStates.set(id,{kind:'preview'});
    }
  }
  function applyJoinedZonePlayback(next,receiverIds){
    const plan=window.LightningLiveControl.joinZonePlayback(model,next,receiverIds);
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
    return `<section class="card" data-backup-panel><h2>Backup en herstellen</h2><p>Bewaar je stand, zones, lichtkeuzes, scènes en presets in één bestand.</p><p class="muted">Je PIN en beveiligingssleutels staan nooit in dit bestand.</p>${backupNotice?`<p role="alert">${esc(backupNotice)}</p>`:''}<div class="actions"><button class="button full" data-action="backup-export">Backup bewaren</button><button class="button secondary full" data-action="backup-import">Backup openen</button></div></section>`;
  }
  function receiverContextPanel(){
    return `<section class="card" data-receiver-context-panel><h2>Instellingen op je receivers</h2><p>Bewaar je standnaam en zones ook op de receivers, zodat je ze later op een andere telefoon kunt terugvinden.</p><p role="status" data-receiver-context-status></p><button class="button secondary full" data-action="receiver-context-sync">Instellingen bewaren op receivers</button></section>`;
  }
  function syncReceiverContextPanel(){
    const panel=document.querySelector('[data-receiver-context-panel]');if(!panel)return;
    const state=receiverContextStates.get(stand()?.id),busy=state?.status==='syncing';
    panel.querySelector('[data-receiver-context-status]').textContent=busy?'Instellingen worden op de receivers bewaard…':state?.status==='synced'?`Bewaard op alle ${state.total} receivers.`:state?.status==='pending'?'Nog niet op alle receivers bewaard. Verbind met het ALUVISION-wifi en probeer opnieuw.':'De bewaarstatus wordt gecontroleerd…';
    const button=panel.querySelector('button');button.disabled=busy;button.textContent=busy?'Even wachten…':state?.status==='synced'?'Opnieuw controleren en bewaren':'Instellingen bewaren op receivers';
  }
  async function readReceiverContextStatus(){
    const standId=stand()?.id;
    if(!standId||receiverContextStates.has(standId)||receiverContextReads.has(standId)||typeof runtime?.services?.receiverContextStatus!=='function')return;
    receiverContextReads.add(standId);
    try{receiverContextStates.set(standId,await runtime.services.receiverContextStatus({standId}));}
    catch(_){receiverContextStates.set(standId,{status:'pending'});}
    finally{receiverContextReads.delete(standId);syncReceiverContextPanel();}
  }
  async function syncReceiverContext(){
    const standId=stand()?.id;if(!standId||receiverContextStates.get(standId)?.status==='syncing')return;
    receiverContextStates.set(standId,{status:'syncing'});syncReceiverContextPanel();
    try{receiverContextStates.set(standId,await runtime.services.syncInstallationContext({standId}));}
    catch(_){receiverContextStates.set(standId,{status:'pending'});}
    syncReceiverContextPanel();
  }
  window.addEventListener('lightning:receiver-context',event=>{
    if(!nativeContext||!event.detail||typeof event.detail.standId!=='string')return;
    receiverContextStates.set(event.detail.standId,event.detail);syncReceiverContextPanel();
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
    // Continuous neighbours also need their new global lengths/offsets. The
    // native owner derives those from storage; JS never supplies geometry.
    const targets=targetZone?.type==='SPI'&&targetZone.layout==='continuous'
      ?M.zoneReceivers(model,targetZone.id):[receiver];
    sendReceiverStates(targets.map(item=>item.id),{remember:false});
    // The queue reports LIVE failures separately. A failed resume must never
    // roll back confirmed outputs, reconfigure them, or turn an OFF light on.
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
        let reason='Je receiver antwoordt niet. Controleer de verbinding en probeer opnieuw.';
        if(codes.has('OUTPUT_CONFIGURATION_PENDING'))reason='De gewijzigde poortinstellingen zijn nog niet bevestigd. Controleer Pixels / kant instellen bij je receiver.';
        else if(codes.has('LIVE_CONTROL_PROFILE'))reason='Deze receiver komt niet overeen met je opgeslagen installatie. Open Receivers om dit te controleren.';
        else if(codes.has('LIVE_CONTROL_FIRMWARE_UPDATE'))reason='Deze animatie heeft SPI-software 21.1.45 of nieuwer nodig op alle gekozen receivers. Je huidige verlichting is niet gewijzigd.';
        else if(['LIVE_CONTROL_BUSY','NATIVE_BUSY','OTA_BUSY','REMOVAL_BUSY'].some(code=>codes.has(code)))reason='Er loopt nog een receiveractie. Probeer zo opnieuw.';
        else if(['LIVE_CONTROL_CANCELLED','CANCELLED'].some(code=>codes.has(code)))reason='Versturen is onderbroken. Je keuze staat nog in het voorbeeld.';
        message=applied?`${targets.length-applied} van ${targets.length} receivers antwoordt nog niet. ${reason}`:reason;
      }
      else if(states.includes('pending')){kind='pending';}
      else if(states.includes('preview')){kind='preview';message=applied?`Deels bevestigd (${applied}/${targets.length}) · overige wijziging alleen in voorbeeld.`:'Alleen voorbeeld · deze wijziging is niet naar de receiver verstuurd.';}
      else if(applied===targets.length){kind='applied';}
      node.dataset.state=kind;node.textContent=message;
      node.setAttribute('aria-live',failed?'polite':'off');
      if(failed&&nativeContext&&liveController)node.insertAdjacentHTML('beforeend',` <button class="text-button" data-action="live-retry" data-scope="${esc(node.dataset.liveStatus)}">Opnieuw versturen</button>`);
    });
  }
  function apply(patch,scope=selection()) {
    if(managementBusy)return;
    const ids=standControlOpen?standReceivers().map(receiver=>receiver.id):selectedReceiverIds(scope);
    if(Object.hasOwn(patch,'bri')&&!Object.hasOwn(patch,'brightness'))patch={...patch,brightness:patch.bri};
    else if(Object.hasOwn(patch,'brightness')&&!Object.hasOwn(patch,'bri'))patch={...patch,bri:patch.brightness};
    model=standControlOpen?M.applyStandState(model,stand().id,patch):M.applyState(model,route.zoneId,scope,patch);
    if(Object.keys(patch).some(key=>key!=='rgbwLast'))sendReceiverStates(ids);
    const note=document.querySelector('.mixed-note');if(note)note.hidden=!mixedSelection();
    if(standControlOpen)syncStandPower();
    syncLiveStatus();
    paint(performance.now()/1000);
  }
  function toast(text) { const el=document.getElementById('toast');el.textContent=text;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.hidden=true;},3500); }
  function staticColour(rgb,w=0,memory=null) { apply({...C.state(rgb,w),...(memory?{rgbwLast:memory}:{}),engine:'STATIC',variant:0,v30Effect:null,category:null,animation:'Vaste kleur',previewFamily:null,legacySpi:false,bounce:false,mirror:false,on:true,power:true});syncColour(); }
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
      const status=root.querySelector('.brand-picker-status');if(status)status.textContent=t('brandSaved');
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
      const swatch=root.querySelector('.colour-swatch');if(swatch)swatch.style.background=C.hex(C.mixWhite(rgb,w));
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
        const index=(y*size+x)*4,rgb=C.fromPoint(x+.5,y+.5,size),inside=Math.hypot(x+.5-size/2,y+.5-size/2)<=size/2;
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
    if(secondary)pixelSetup.paint(time);
    for(const [id,blink] of identifying)if(time>=blink.until){identifying.delete(id);syncIdentifyControls(id);}
    if(route.screen==='receiver-add')onboarding.paint(time);
    const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelectorAll('canvas[data-preview]').forEach(canvas=>{
      const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height||rect.bottom<0||rect.top>innerHeight)return;
      const spec=previews.get(canvas.dataset.preview);if(!spec)return;
      if(!secondary&&!spec.main)return;
      const savedZone=spec.zoneId?M.getZone(model,spec.zoneId):null;
      const draft=spec.arrangementPreview?previewArrangement(savedZone):null;
      const savedList=savedZone?M.zoneReceivers(model,spec.zoneId):null;
      const zoneList=draft?draft.receiverIds.map(id=>savedList.find(receiver=>receiver.id===id)).filter(Boolean):savedList;
      const list=zoneList?(spec.visibleReceiverIds?zoneList.filter(receiver=>spec.visibleReceiverIds.includes(receiver.id)):zoneList):spec.brand?spec.receivers.map(r=>{
        const palette=currentBrandColors().slice(0,spec.brandPaletteLimit||0);
        return {...r,state:{...r.state,brandColor:currentBrandPalette()[0],...(palette.length?{colors:palette.map(color=>C.hex([color.r,color.g,color.b])),colorCount:palette.length,whiteChannels:palette.map(color=>color.w),rgbEnabled:palette.map(()=>true),whiteEnabled:palette.map(color=>color.w>0)}:{})}};
      }):spec.receivers;
      P.draw(canvas,{...spec,layout:draft?.layout||spec.layout,receivers:list,geometryReceivers:spec.preserveZoneGeometry?zoneList:spec.geometryReceivers,selection:spec.main?selection():spec.selection,
        ...(draft?{lineNumbers:Object.fromEntries(zoneList.map((receiver,index)=>[receiver.id,index+1]))}:{}),
        selectionFeedback:spec.main===true,identifying:spec.main?identifying:undefined,identificationTime:time,reducedMotion:reduce,
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
      const metadata=window.LightningReceiverVisual.draw(canvas,{type:r.type,selectedPort:visualPorts.get(r.id)||1,enabledPorts:r.outputs.filter(p=>p.enabled).map(p=>p.port),plugProgress,compact:canvas.dataset.compact==='true',identifying:!!blink,identifyingPorts:blink?.ports||[],time:blink?time-blink.startedAt:time,reducedMotion:reduce});
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
      button.disabled=waiting||!enabled;button.setAttribute('aria-busy',String(waiting));
      button.setAttribute('aria-pressed',String(pressed));button.querySelector('span').textContent=waiting?'Even wachten…':pressed?'Stop knipperen':'Knipperen';
      button.setAttribute('aria-label',`${receiver.name} · ${scope==='all'?(receiver.type==='SPI'?'alle actieve uitgangen samen':'hele receiver'):'uitgang '+scope} ${pressed?'stoppen met knipperen':'laten knipperen'}`);
    });
  }
  async function toggleIdentification(receiver,scope){
    if(identifyPending.has(receiver.id))return;
    const ports=receiver.type==='SPI'?receiver.outputs.filter(o=>o.enabled&&(scope==='all'||String(o.port)===scope)).map(o=>o.port):[];
    if(receiver.type==='SPI'&&!ports.length)return;
    const stopping=identifying.get(receiver.id)?.scope===scope;
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
    document.getElementById('help-content').innerHTML=`<header><h2>Kies de plek.<br>Bedien het licht.</h2></header><section>${icon('stand')}<div><h3>Stand → je hele installatie</h3><p>Alles wat bij jouw beursstand hoort, bij elkaar.</p></div></section><section>${icon('zones')}<div><h3>Zone → een plek in je stand</h3><p>Bijvoorbeeld Demohoek, Balie of Plafond. Open een zone om meteen het licht te bedienen.</p></div></section><section>${icon('together')}<div><h3>Alle ledlines of één ledline</h3><p>Kies Alle ledlines samen voor de hele zone. Je kunt ook één ledline kiezen; de actieve lijn wordt gemarkeerd. Doorlopende SPI bedien je altijd samen.</p></div></section><aside class="guide"><p>RGBW en Pixel LED (SPI) krijgen ieder hun eigen zone. Zo zie je alleen de passende bediening.</p></aside><button class="button" data-action="close-help">Begrepen</button>`;
    document.getElementById('help').showModal();
  }
  function showEffectDialog(title,content) {
    if(!document.getElementById('effect-dialog').open)dialogReturnFocus=document.activeElement;
    const dialog=document.getElementById('effect-dialog');
    document.getElementById('effect-dialog-content').innerHTML=`<header><h2 id="effect-dialog-title">${esc(title)}</h2><button class="icon-button" data-action="effect-dialog-close" aria-label="Venster sluiten">${icon('close')}</button></header>${content}`;
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
  function closeEffectDialog() {
    if(pinProtectionBusy)return;
    const wasStand=standControlOpen,brandIndex=brandEditor?.index;
    dialogHeaderObserver?.disconnect();document.getElementById('effect-dialog').close();
    document.querySelector('[data-action="animation-categories"]')?.setAttribute('aria-expanded','false');
    document.querySelectorAll('#effect-dialog canvas[data-preview]').forEach(canvas=>previews.delete(canvas.dataset.preview));
    document.getElementById('effect-dialog-content').replaceChildren();standControlOpen=false;zoneDeletion=null;brandEditor=null;
    if(wasStand)render();
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
      const count=M.zoneReceivers(model,z.id).length;
      return `<button class="stand-overview-row" data-action="overview-zone" data-id="${esc(z.id)}">${icon('zones')}<span><b>${esc(z.name)}</b><small>${count?ledlineCount(count):'Nog geen verlichting toegevoegd'}${z.type?' · '+z.type:''}</small></span>${icon('chevron')}</button>`;
    }).join(''):list.map(r=>`<button class="stand-overview-row receiver-zone-row" data-action="receiver-move" data-id="${esc(r.id)}" aria-label="${esc(r.name)} · ${esc(current.zones.find(z=>z.id===r.zoneId)?.name||'Niet in een zone')} · zone wijzigen">${icon('receiver')}<span><b>${esc(r.name)}</b><small>${r.type} · ${esc(current.zones.find(z=>z.id===r.zoneId)?.name||'Niet in een zone')}</small></span><span class="receiver-zone-change" aria-hidden="true"><span class="receiver-zone-change-icon">${icon('zones')}</span><small>Zone wijzigen</small></span></button>`).join('');
    showEffectDialog(zoneOverview?'Zones in je stand':'Ledlines in je stand',`<section data-stand-overview="${kind}"><p>${zoneOverview?'Tik op een zone om die ledlines te bedienen.':'Tik op een ledline om die aan een andere zone toe te wijzen.'}</p><div class="stand-overview-list">${entries||`<p>${zoneOverview?'Je hebt nog geen zones.':'Je hebt nog geen ledlines toegevoegd.'}</p>`}</div>${!zoneOverview&&unassigned.length?`<p>${unassigned.length} ${unassigned.length===1?'ledline heeft':'ledlines hebben'} nog geen zone.</p><button class="button secondary full" data-action="overview-receivers" data-id="unassigned">Ledlines zonder zone bekijken</button>`:''}<button class="button full" data-action="${zoneOverview?'overview-zone-new':'overview-receivers'}">${zoneOverview?'＋ Zone toevoegen':'Ledlines beheren'}</button></section>`);
  }
  function showStandControls(){
    if(!standReceivers().length)return;
    standControlOpen=true;
    showEffectDialog('Alles bedienen',`<p class="stand-control-scope"><b>${esc(standLabel())}</b> · ${stand().zones.length} zone${stand().zones.length===1?'':'s'} · ${receiverCount(standReceivers().length)}</p><p>Een vaste kleur voor je hele stand, zowel RGBW als SPI. Aan/uit bewaart je huidige kleuren en animaties.</p>${powerControl()}<p class="live-confirmation" data-live-status="stand" role="status" aria-live="polite"></p><p id="stand-control-mixed" class="mixed-note" ${mixedSelection()?'':'hidden'}>Je verlichting heeft verschillende instellingen. Een kleur kiezen maakt alles dezelfde vaste kleur.</p>${colourPickerMarkup()}${standScenesMarkup(true)}`);
    syncLiveStatus();
    paintWheel();syncColour();
  }
  function showPaletteEditor(index) {
    const s=selectedState();if(!Number.isInteger(index)||index<0||index>=Math.min(colours(s).length,s.colorCount||colours(s).length)||activeEffect()?.paletteEditable===false)return;
    const label=activeEffect()?.whiteMixPreset?'Witmix':'Kleur';
    showEffectDialog(`${label} ${index+1} aanpassen`,`${dialogAnimationPreview()}${colourPickerMarkup(index)}`);
    paintWheel();syncColour();
  }
  function dialogAnimationPreview(){
    const view=tunnelSpatialContext()?spatialMode():null,spatial=['tunnel','wall'].includes(view);
    const title=spatial?spatialPreviewText('Preview',view):'Live LED-voorbeeld';
    const label=spatial?`${title} · ${zone().name} · ${ledlineCount(receivers().length)}`:'Live voorbeeld met jouw animatiekleuren';
    const options={main:true,label,...(spatial?{spatialShape:view,presentation:'receivers',geometryReceivers:receivers()}: {})};
    return `<div class="preview-wrap dialog-live-preview${spatial?' is-spatial-preview':''}"><div class="preview-top">${esc(spatial?`${title} · live`:title)}</div>${zonePreview(zone(),spatial?'dialog-spatial-preview':'',options)}</div>`;
  }
  function syncBackground(){
    const on=Boolean(selectedState().backgroundOn),button=main.querySelector('[data-action="background-toggle"]');
    if(button){button.setAttribute('aria-pressed',on);button.setAttribute('aria-checked',on);button.querySelector('span').textContent=on?'Aan':'Uit';}
    const details=main.querySelector('[data-background-details]');if(details)details.hidden=!on;
    const swatch=main.querySelector('.background-swatch'),channels=backgroundChannels();
    if(swatch)swatch.style.background=C.hex(C.mixWhite(channels.slice(0,3),channels[3]));
  }
  function changePalette(removeIndex=null){
    const range=activeEffect()?.colorCountRange;if(!range||activeEffect()?.paletteEditable===false)return;
    const s=selectedState(),count=Math.min(colours(s).length,s.colorCount||colours(s).length);
    if(removeIndex===null&&count>=range.max||removeIndex!==null&&(!Number.isInteger(removeIndex)||removeIndex<0||removeIndex>=count||count<=range.min))return;
    const palette=colours(s).slice(0,count),whites=palette.map((_,i)=>s.whiteChannels?.[i]??0),rgbFlags=palette.map((_,i)=>s.rgbEnabled?.[i]!==false),whiteFlags=palette.map((_,i)=>s.whiteEnabled?.[i]!==false);
    if(removeIndex===null){palette.push(['#C94E46','#F0B95F','#669CC6','#72B894','#BB8CC8','#F5DCA8','#73C9CE'][count%7]);whites.push(0);rgbFlags.push(true);whiteFlags.push(true);}
    else [palette,whites,rgbFlags,whiteFlags].forEach(values=>values.splice(removeIndex,1));
    apply({colors:palette,whiteChannels:whites,rgbEnabled:rgbFlags,whiteEnabled:whiteFlags,colorCount:palette.length});
    const row=main.querySelector('.palette'),focused=document.activeElement,restoreFocus=row?.contains(focused);
    if(row)row.innerHTML=paletteMarkup(selectedState());
    if(restoreFocus&&!restoreControlFocus(focused)){
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
    const row=document.querySelector('.palette');if(row)row.innerHTML=paletteMarkup(selectedState());
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
    showEffectDialog('Zone wijzigen',`<p><b>${esc(r.name)}</b> · ${esc(r.type)} · nu ${r.zoneId?`in ${esc(M.getZone(model,r.zoneId).name)}`:'nog niet aan een zone toegewezen'}. De koppeling en aansluitingen blijven bewaard. Speelt in de nieuwe zone één gezamenlijke animatie? Dan doet deze ledline automatisch mee.</p><div class="assignment-choices" aria-label="Zone kiezen">${stand().zones.map(z=>{
      const compatible=!z.type||z.type===r.type,chosen=z.id===receiverAssignment.zoneId;
      return `<button class="assignment-choice" data-action="assignment-zone" data-id="${esc(z.id)}" aria-pressed="${chosen}" ${compatible?'':'disabled'}>${icon('zones')}<span><b>${esc(z.name)}</b><small>${z.id===r.zoneId?'Huidige zone':compatible?`${zoneTypeLabel(z)}${z.type?` · ${receiverCount(z.receiverIds.length)}`:''}`:`Alleen ${z.type} · past niet bij deze receiver`}</small></span><i aria-hidden="true">${chosen?'✓':''}</i></button>`;
    }).join('')}<button class="assignment-choice" data-action="assignment-zone" data-id="" aria-pressed="${!receiverAssignment.zoneId}">${icon('unassigned')}<span><b>Nog geen zone</b><small>Blijft gekoppeld aan je stand</small></span><i aria-hidden="true">${!receiverAssignment.zoneId?'✓':''}</i></button></div><button class="button secondary full" data-action="assignment-new-zone">＋ Nieuwe zone maken</button><p class="dialog-error" role="alert" hidden></p><button class="button full" data-action="assignment-confirm" ${receiverAssignment.zoneId===r.zoneId?'disabled':''}>Zone wijzigen</button>`);
  }
  function showLayoutReceiverAdd(zoneId) {
    const z=M.getZone(model,zoneId);if(!z)return;
    showEffectDialog('Receiver toevoegen',`<p>Voeg verlichting toe aan <b>${esc(z.name)}</b>.</p><button class="button full" data-action="layout-new-receiver" data-zone="${esc(z.id)}">Nieuwe receiver zoeken</button><button class="button secondary full" data-action="zone-assign" data-id="${esc(z.id)}">Bestaande receiver kiezen</button>`);
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
    showEffectDialog('Ledlines toewijzen',`<section class="assignment-many" data-assignment-many><p class="assignment-many-destination">Naar <b>${esc(z.name)}</b></p><p class="assignment-many-note">Ledlines uit een andere zone worden verplaatst. Speelt hier één gezamenlijke animatie? Dan doen ze automatisch mee. Hun aansluitingen blijven bewaard.</p>${familyChoices}${list}<p class="assignment-many-summary" data-assignment-many-summary role="status">${count?`${ledlineCount(count)} gekozen`:'Kies één of meer ledlines.'}</p><button class="button full" data-action="assignment-many-confirm" ${count?'':'disabled'}>${count?`${ledlineCount(count)} toewijzen`:'Ledlines toewijzen'}</button><button class="button secondary full" data-action="assignment-add-receiver">＋ Nieuwe ledline zoeken</button></section>`);
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
    showEffectDialog(creating?'Nieuwe zone':kind==='zone-rename'?'Zone hernoemen':'Receiver hernoemen',`<p>${creating?'Geef de plek een herkenbare naam, zoals Balie of Demohoek.':'Alle koppelingen en lichtinstellingen blijven behouden.'}</p><label class="dialog-field">${kind==='receiver-rename'?'Naam receiver':'Naam zone'}<input id="management-name" maxlength="64" autocomplete="off" value="${esc(target?.name||'')}" placeholder="${kind==='receiver-rename'?'Bijvoorbeeld: links bij de balie':'Bijvoorbeeld: Balie'}"></label><p class="dialog-error" role="alert" hidden></p><button class="button full" data-action="management-name-save" ${creating?'disabled':''}>${receiverId?'Zone maken en receiver verplaatsen':creating?'Zone maken':'Naam opslaan'}</button>${receiverId?'<button class="button secondary full" data-action="assignment-back">Terug naar zones</button>':''}`);
    document.getElementById('management-name').focus();
  }
  function showUnassign(receiverId) {
    const r=model.receivers.find(item=>item.id===receiverId);if(!r?.zoneId)return;
    showEffectDialog('Uit deze zone halen?',`<p><b>${esc(r.name)}</b> blijft in je stand, maar hoort niet meer bij ${esc(M.getZone(model,r.zoneId).name)}.</p><p>Kleuren en poortinstellingen blijven bewaard${pinRequired()?', net als je PIN':''}. Je kunt deze receiver daarna aan een andere zone toewijzen.</p><p class="dialog-error" role="alert" hidden></p><button class="button full" data-action="receiver-unassign-confirm" data-id="${esc(r.id)}">Uit zone halen</button><button class="button secondary full" data-action="effect-dialog-close">Annuleren</button>`);
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
    const count=M.zoneReceivers(model,z.id).length,next=await persistManagement(M.deleteZone(model,z.id),{kind:'delete',zoneId},consent.signature);
    if(!next)return;
    // This is zone membership only; never invoke receiver removal, reset or PIN services.
    model=next;selections.delete(zoneId);
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
        if(typeof runtime?.services?.editZones!=='function')throw reject('ZONE_STORAGE_UNAVAILABLE');
        confirmedView=await runtime.services.editZones({standId:s.id,operation,...(['delete','rename'].includes(request.kind)?{expectedZoneSignature:request.expectedZoneSignature}:{})});
        next=keepLocalPreviewStates(confirmedView.model);
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
    if(!nativeContext)return next;
    if(managementBusy)return null;
    managementBusy=true;
    const controls=Array.from(document.querySelectorAll('#main button,#main input,#main select,#navigation button,#effect-dialog button,#effect-dialog input'),el=>({el,disabled:el.disabled}));
    controls.forEach(({el})=>{el.disabled=true;});
    const dialog=document.getElementById('effect-dialog'),host=dialog.open?document.getElementById('effect-dialog-content'):main;
    const progress=document.createElement('p');progress.className='management-status';progress.setAttribute('role','status');progress.textContent='Wijziging opslaan…';if(operation?.kind!=='arrange')host.prepend(progress);host.setAttribute('aria-busy','true');
    try{
      if(typeof runtime?.services?.editZones!=='function')throw Error('ZONE_STORAGE_UNAVAILABLE');
      const view=await runtime.services.editZones({standId:stand().id,operation,...(expectedZoneSignature===undefined?{}:{expectedZoneSignature})});
      // Metadata edits also refresh an unfinished, receiver-less setup in the
      // native store. Resume that exact draft instead of later saving stale
      // zone geometry or membership from the suspended receiver search.
      refreshSuspendedSetup(view);
      return keepLocalPreviewStates(view.model);
    }catch(error){
      const message='Opslaan is niet bevestigd. Controleer de indeling en probeer opnieuw.';
      if(error.reconciledView?.model){
        refreshSuspendedSetup(error.reconciledView);
        if(operation?.kind==='arrange'){
          // Reconcile only the authoritative model. The automatic arrangement
          // update then resets its preview to this state and offers a retry.
          model=keepLocalPreviewStates(error.reconciledView.model);retainSetupSelections();
          return null;
        }
        model=keepLocalPreviewStates(error.reconciledView.model);selections.clear();zoneDeletion=null;receiverAssignment=null;nameDialog=null;
        closeEffectDialog();navigate('stand',{zoneId:null});toast(message);
      }else{
        const notice=document.querySelector('#effect-dialog[open] .dialog-error');
        if(notice){notice.textContent=message;notice.hidden=false;}else if(operation?.kind!=='arrange')toast(message);
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
  document.getElementById('effect-dialog').addEventListener('cancel',event=>{event.preventDefault();if(!managementBusy)closeEffectDialog();});
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
    const button=event.target.closest('button[data-action]');if(!button||button.disabled)return;
    if(button.dataset.action==='pin-login-cancel'&&pinLoginBusy){pinRecoveryAbort?.abort();return;}
    if(managementBusy||arrangementApplying||pinProtectionBusy||pinLoginBusy)return;
    const action=button.dataset.action,id=button.dataset.id;
    try {
      if(action==='layout'||action==='line-setup-open'){
        if(!zone()||!receivers().length)return;
        const closing=action==='layout'&&openLineSetup.has(route.zoneId);
        if(closing){openLineSetup.delete(route.zoneId);arrangementDraft=null;}
        else {openLineSetup.add(route.zoneId);beginArrangement();}
        renderArrangement();
        // Safari can anchor the collapsed summary behind the sticky preview
        // when removing a long receiver list. Keep that return target visible.
        if(closing||action==='line-setup-open')revealLineSetup();
        main.querySelector('.ledline-setup-toggle')?.focus({preventScroll:true});return;
      }
      if(action==='spatial-toggle'){
        const z=zone();if(!z)return;
        const browsing=arrangementBrowsing();
        if(openSpatialChoices.has(z.id))openSpatialChoices.delete(z.id);else openSpatialChoices.add(z.id);
        renderArrangement(browsing);main.querySelector('.spatial-choice-toggle')?.focus({preventScroll:true});return;
      }
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
      if(action==='draft-order'){
        if(!arrangementDraft||arrangementDraft.zoneId!==route.zoneId)return;
        const ids=arrangementDraft.receiverIds,index=ids.indexOf(id),delta=Number(button.dataset.delta),target=index+delta;
        if(![-1,1].includes(delta)||index<0||target<0||target>=ids.length)return;
        ids.splice(index,1);ids.splice(target,0,id);await applyArrangement();
        const moved=main.querySelector(`[data-draft-receiver="${CSS.escape(id)}"]`);
        (moved?.querySelector(`[data-delta="${delta}"]:not(:disabled)`)||moved?.querySelector('[data-action="draft-order"]:not(:disabled)'))?.focus({preventScroll:true});return;
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
      if(action==='nav')return navigate(id);
      if(action==='pin-login')return await openPinLogin();
      if(action==='pin-login-submit')return await submitPinLogin();
      if(action==='stand-switch-open')return showEffectDialog('Kies je stand',model.stands.map(item=>`<button class="menu-card" data-action="stand-switch" data-id="${esc(item.id)}" aria-pressed="${item.id===stand()?.id}"><span class="menu-icon">${icon('stand')}</span><span><b>${esc(item.name)}</b><small>${item.zones.length} zones${item.id===stand()?.id?' · Nu geopend':''}</small></span>${icon('chevron')}</button>`).join(''));
      if(action==='stand-switch'){
        if(!model.stands.some(item=>item.id===id))return;
        closeEffectDialog();return navigate('stand',{standId:id,zoneId:null});
      }
      if(action==='backup-export')return await exportBackup();
      if(action==='backup-import')return await chooseBackup();
      if(action==='receiver-context-sync')return await syncReceiverContext();
      if(action==='backup-confirm')return await restoreBackup(button);
      if(action==='demo-settings-tab'&&webDemoContext)return navigate(id==='wifi'?'demo-wifi':'settings');
      if(action==='pin-protection-toggle')return openPinProtection();
      if(action==='pin-protection-refresh')return refreshPinProtection();
      if(action==='pin-protection-reconnect'&&pinProtectionReconnect)return showPinReconnect(pinProtectionReconnect);
      if(action==='pin-protection-recheck')return refreshPinProtection({afterReconnect:true});
      if(action==='pin-protection-save')return savePinProtection(button);
      if(action==='live-retry'){sendReceiverStates(liveTargets(button.dataset.scope).filter(receiver=>liveStates.get(receiver.id)?.kind==='failed').map(receiver=>receiver.id));return;}
      if(action==='language'||action==='theme'){
        const result=preferenceStore.save({[action]:id});if(result.error)return toast(result.error.message);uiPreferences=result;return render();
      }
      if(action==='preferences-reset')return showEffectDialog('Taal en thema herstellen?',`<section data-preferences-reset><p>Alleen de appvoorkeuren veranderen: <b>Nederlands</b> en het <b>lichte thema</b>.</p><p>Je ${pinRequired()?'PIN, ':''}receivers, zones, scènes, kleurpresets en animatiepresets blijven bewaard. Dit is geen fabrieksreset van je receivers.</p><p class="dialog-error" role="alert" hidden></p><button class="button full" data-action="preferences-reset-confirm">Taal en thema herstellen</button><button class="button secondary full" data-action="effect-dialog-close">Annuleren</button></section>`);
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
      if(action==='overview-zone'){closeEffectDialog();return navigate('controls',{zoneId:id});}
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
          pixelSetup.open(pending.status==='pending'?{...receiver,outputs:pending.outputs}:receiver,{initialPort:visualPorts.get(id)||1,resumePending:pending.status==='pending'});
        }catch(_){toast('De vorige poortwijziging kon niet worden gelezen. Probeer opnieuw; er is niets gewist.');}
        finally{managementBusy=false;button.disabled=false;}return;
      }
      if(action==='zone')return navigate('controls',{zoneId:id});
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
      if(action==='layout-receiver-add'){
        const target=stand()?.zones.find(z=>z.id===button.dataset.zone);if(!target)return;
        return showLayoutReceiverAdd(target.id);
      }
      if(action==='layout-new-receiver'){
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
      if(action==='colour'&&route.screen==='controls'){rememberAnimationGallery();controlMode='colour';return render({top:true});}
      if(action==='animation-gallery'&&route.screen==='controls'&&activeEffect()){
        const saved=animationGalleryPositions.get(route.zoneId);
        if(saved)route={...route,library:saved.library,family:saved.family};
        setSpatialPreviewCategory(libraryTab());
        controlMode='animations';showControlAnimationGallery=true;return render({top:true});
      }
      if(action==='animations'&&route.screen==='controls'){
        rememberAnimationGallery();
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
      if(action==='close-help')return document.getElementById('help').close();
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
        const result=colourStore.remove(id);if(result.error)return refreshColourLibraries(button,result.error.message);
        removedColour={entry:current.colors[index],index};savedColours=result;
        if(button.closest('[data-colour-manager]'))return showColourManager(`${removedColour.entry.name} verwijderd. Je kunt dit ongedaan maken.`);
        return refreshColourLibraries(button,`${removedColour.entry.name} verwijderd.`);
      }
      if(action==='colour-undo'){
        if(!removedColour)return;
        const {entry,index}=removedColour,result=colourStore.save(entry);if(result.error)return refreshColourLibraries(button,result.error.message);
        const ordered=colourStore.move(entry.id,Math.min(index,result.colors.length-1));
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
        savedScenes=result;sceneDraft=null;if(editingId)navigate('scene-detail',{sceneId:editingId});else navigate('scenes');toast(editingId?'Scène bijgewerkt met het huidige licht. Er is niets geactiveerd.':'Scène opgeslagen. Je verlichting is niet veranderd.');return;
      }
      if(action==='scene-open'){sceneDetailSearch='';if(button.closest('#effect-dialog'))closeEffectDialog();return navigate('scene-detail',{sceneId:id});}
      if(action==='stand-scenes'){if(document.getElementById('effect-dialog').open)closeEffectDialog();return navigate('scenes');}
      if(action==='scene-rename')return showSceneNameDialog(id);
      if(action==='scene-rename-save'){
        if(!savedScenes.scenes.some(scene=>scene.id===id&&scene.standId===stand()?.id))return;
        const input=document.getElementById('scene-rename-name');if(!input)return;
        const result=sceneStore.rename(id,input.value);
        if(result.error)throw Error(result.error.message);
        savedScenes=result;closeEffectDialog();render({preserveScroll:true});toast('Scènenaam gewijzigd. Je verlichting blijft hetzelfde.');return;
      }
      if(action==='scene-apply'){
        const scene=savedScenes.scenes.find(item=>item.id===id&&item.standId===stand()?.id);if(!scene)return;
        const check=Scenes.compatibility(model,scene);if(!check.ok){toast(`${check.reason} Er is niets gewijzigd.`);return;}
        try{model=Scenes.apply(model,scene);}catch(error){toast(`${error.message} Er is niets gewijzigd.`);return;}
        sendReceiverStates(scene.zones.flatMap(item=>item.receivers.map(receiver=>receiver.id)));render();toast(nativeContext?'Scène wordt naar de receivers verstuurd.':'Scène direct geactiveerd in het voorbeeld.');return;
      }
      if(action==='scene-delete'){const scene=savedScenes.scenes.find(s=>s.id===id&&s.standId===stand().id);if(!scene)return;showEffectDialog('Scène verwijderen?',`<p>“${esc(scene.name)}” wordt uit je opgeslagen scènes verwijderd. Je verlichting verandert niet.</p><button class="button full" data-action="scene-delete-confirm" data-id="${esc(id)}">Scène verwijderen</button><button class="button secondary full" data-action="effect-dialog-close">Behouden</button>`);return;}
      if(action==='scene-delete-confirm'){const result=sceneStore.remove(id);if(result.error)return toast(result.error.message);savedScenes=result;closeEffectDialog();return navigate('scenes');}
      if(action==='effects'||action==='effects-root'||action==='animations-gallery'){
        if(route.screen==='controls'){
          controlMode='animations';showControlAnimationGallery=true;route={...route,family:null,library:initialAnimationLibrary(),effectsReturn:'controls'};setSpatialPreviewCategory(initialAnimationLibrary());return render({top:true});
        }
        const returnScreen=route.screen==='controls'||route.effectsReturn==='controls'?'controls':'animations';
        return navigate('effects',{family:null,library:initialAnimationLibrary(),effectsReturn:returnScreen});
      }
      if(action==='animation-search-clear'){const search=document.getElementById('animation-search');if(search){search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));}return;}
      if(action==='family'){
        const group=Library.group(catalogue(),id);if(!group)return;
        animationFamilyReturnPositions.set(route.zoneId,{family:id,scrollY:window.scrollY,viewportTop:button.getBoundingClientRect().top});
        route={...route,family:id};render();
        paint(performance.now()/1000);revealAnimationFamily();
        main.querySelector('#animation-family-title')?.focus({preventScroll:true});
        return;
      }
      if(action==='family-back'){
        route={...route,family:null};render();restoreAnimationFamilyList();
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
        const available=requiresWholeZone?receivers().length:selected().length;
        if(available<(effect.minimumReceivers||1))return;
        // A spatial animation is a zone effect: include every connected
        // ledline as a single playback group automatically. Users can still
        // choose one line later in the editor to make its colour different.
        if(requiresWholeZone&&selection().kind!=='all')storeLineSelection(receivers().map(receiver=>receiver.id));
        setSpatialPreviewCategory(effect.category==='tunnel'?'tunnel':'');
        rememberAnimationGallery();apply(effectState(effect));settingsOpen=false;
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
        const next=copy(model);next.receivers.find(r=>r.id===receiver.id).outputs.find(o=>o.port===port).enabled=!output.enabled;
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
      if(action==='effect-dialog-close'){if(colourManagerReturn){if(colourManagerVisible)return closeColourManager();brandEditor=colourManagerReturn.brandEditor||null;savedColours=colourStore.load();return showColourManager();}return closeEffectDialog();}
      if(action==='preset-save')return showSavePreset();
      if(action==='preset-confirm'){
        try {
          const preset=S.capture(document.getElementById('preset-name').value,activeEffect(),selectedState());
          const result=presetStore.save(preset);if(result.error)throw Error(result.error.message);
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
        savedPresets=result;closeEffectDialog();return render();
      }
      if(action==='setting-reset'){
        const effect=activeEffect();if(!effect||(!effect.controls.includes(id)&&id!=='bri'&&!(id==='bgBrightness'&&effect.backgroundEditable)))return;
        const value=settingDefault(id);if(value===undefined)return;
        apply({[id]:value});const input=document.querySelector(`[data-setting="${CSS.escape(id)}"]`);if(input){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));}else render();return;
      }
      if(action==='settings-toggle'){settingsOpen=!settingsOpen;button.setAttribute('aria-expanded',settingsOpen);button.querySelector('span').textContent=settingsOpen?'Instellingen verbergen':'Beweging instellen';button.lastElementChild.outerHTML=icon(settingsOpen?'close':'chevron');document.getElementById('animation-settings').hidden=!settingsOpen;return;}
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
        const value=input.value;animationQueries.set(route.zoneId,value);
        if(!value.trim()){render();document.getElementById('animation-search')?.focus({preventScroll:true});return;}
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
      if(saveBrandColors(colors)){brandEditor.name=name;brandName.value=name;if(status)status.textContent=t('brandSaved');}
      return;
    }
    const number=event.target.closest?.('input[data-channel-number]');if(!number)return;
    const root=number.closest('[data-colour-picker]'),range=root?.querySelector(`input[data-channel="${number.dataset.channelNumber}"]`);if(!range)return;
    const raw=Number(number.value),value=number.value.trim()===''?Number(range.value):Math.max(0,Math.min(255,Math.round(Number.isFinite(raw)?raw:Number(range.value))));
    number.value=String(value);range.value=String(value);range.dispatchEvent(new Event('input',{bubbles:true}));
  });
  document.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.matches?.('input[data-channel-number]'))event.target.blur();});
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
  document.addEventListener('toggle',event=>{
    if(event.target.matches?.('.ledline-management')&&event.target.isConnected){
      event.target.open?openLineManagement.add(route.zoneId):openLineManagement.delete(route.zoneId);return;
    }
    if(event.target.matches?.('[data-receiver-connections]')&&event.target.isConnected){
      const id=event.target.dataset.receiverConnections;event.target.open?expandedConnections.add(id):expandedConnections.delete(id);return;
    }
    const details=event.target;if(!details.matches?.('[data-receiver-detail]')||!details.isConnected)return;
    details.open?expandedReceivers.add(details.dataset.receiverDetail):expandedReceivers.delete(details.dataset.receiverDetail);
    if(!details.open)visualPlugMotions.delete(details.dataset.receiverDetail);
  },true);
  function resumePinConnection(){if(pinProtectionReconnect&&document.visibilityState==='visible')void refreshPinProtection({afterReconnect:true});}
  window.addEventListener('focus',resumePinConnection);document.addEventListener('visibilitychange',resumePinConnection);
  window.LightningV30=Object.freeze({snapshot:()=>copy({model,route,selection:selection()}),version:'32.0.0-stability',hardwareEnabled:false});
  async function loadNativeState(){
    if(nativeLoading)return;nativeLoading=true;nativeLoadError=false;render();
    try{
      if(typeof runtime?.services?.loadState!=='function')throw Error('NATIVE_UNAVAILABLE');
      const state=await runtime.services.loadState();
      if(state.model?.demo!==false)throw Error('NATIVE_MODEL_INVALID');
      const restored=M.assertValid(state.model);
      const standId=restored.stands[0]?.id||state.draft?.stand?.id;
      if(standId&&typeof runtime.services.securityPreference==='function'){
        const preference=await runtime.services.securityPreference({standId});
        if(typeof preference?.pinRequired!=='boolean')throw Error('SECURITY_PREFERENCE_UNCONFIRMED');
        window.AluvisionSecurityMode?.updateFromNative?.({pinRequired:preference.pinRequired});
      }
      if(state.draft)onboarding.restore(state.draft);
      model=restored;
      if(Backup)try{
        const journal=backupTransaction.pending();
        if(journal){
          if(Backup.key(Backup.publicModel(restored))===journal.afterModel){backupTransaction.finish(restored);reloadBackupLibraries();}
          else backupTransaction.discard(restored);
        }
        model=Backup.restoreLight(restored,appStorage.getItem(Backup.LIGHT_KEY));
      }catch(_){backupNotice='Je bewaarde lichtkeuze of een onderbroken herstelactie kon niet volledig worden gelezen. Er is niets naar je receivers verstuurd.';}
      nativeLoaded=true;
      // Only a successful load can establish that this is a first installation.
      // An existing stand with no receivers is not a reason to restart setup.
      if(state.draft||!restored.stands.length){route.screen='receiver-add';route.setupFrom='stand';}
    }catch(_){nativeLoadError=true;}
    finally{nativeLoading=false;render({top:true});}
  }
  render({top:true});if(nativeContext)loadNativeState();requestAnimationFrame(frame);
})();
