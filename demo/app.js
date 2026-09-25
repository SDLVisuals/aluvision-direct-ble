/* V30 interface: browser fixtures and native installation data stay separate.
 * Only narrowly supported light changes use confirmed native live control;
 * other changes remain visibly preview-only until their transport exists. */
(function () {
  'use strict';
  const M = window.LightningModel, P = window.LightningPreview, C = window.LightningColour, S = window.LightningPresets;
  const Colours = window.LightningColoursLibrary, Scenes = window.LightningScenes;
  const Preferences=window.LightningPreferences;
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
  const brandColours = new Map();
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
  try { presetStore = S.createStore(appStorage); } catch (_) { presetStore = S.createStore(null); }
  try { colourStore = Colours.createStore(appStorage); sceneStore=Scenes.createStore(appStorage); }
  catch (_) { colourStore=Colours.createStore(null);sceneStore=Scenes.createStore(null); }
  let savedPresets = presetStore.load();
  let savedColours=colourStore.load(),savedScenes=sceneStore.load(),sceneDraft=null;
  let sceneDetailSearch='';
  let dragOrder=null;
  let receiverAssignment=null,nameDialog=null,zoneDeletion=null,managementBusy=false;
  let standControlOpen=false;
  // Everyday controls share one zone screen. Keep the light mode local to
  // that screen so changing between colour and movement never sends users
  // through an intermediate page or clears their selected ledline.
  let controlMode='colour',showControlAnimationGallery=true,controlPreviewSize='small';
  let pinProtection=null,pinProtectionLoading=false,pinProtectionBusy=false,pinProtectionError='',pinProtectionReconnect=null;
  const liveStates=new Map();
  const liveController=nativeContext&&runtime?.native===true&&typeof runtime.services?.applyLive==='function'
    ?window.LightningLiveControl?.create({send:request=>runtime.services.applyLive(request),
      sendBatch:typeof runtime.services.applyLiveBatch==='function'?requests=>runtime.services.applyLiveBatch({requests}):undefined,
      onState:(id,state)=>{liveStates.set(id,state);syncLiveStatus();}}):null;
  let colourOrderMode=false,colourLibraryNotice='',removedColour=null;
  let preferenceStore;try{preferenceStore=Preferences.createStore(appStorage);}catch(_){preferenceStore=Preferences.createStore(null);}
  let uiPreferences=preferenceStore.load();
  const t=(key,params)=>Preferences.t(key,uiPreferences.preferences.language,params);
  let dialogReturnFocus = null,colourManagerReturn=null;
  let settingsOpen = false, toastTimer, contextObserver, dialogHeaderObserver;
  const main = document.getElementById('main');
  document.getElementById('effect-dialog').addEventListener('cancel',event=>{if(colourManagerReturn){event.preventDefault();closeColourManager();}});
  if(webDemoContext){
    document.getElementById('web-demo-banner').hidden=false;
    document.body.dataset.webDemo='true';
    const status=document.querySelector('.connection-status');
    status.lastChild.textContent=' Demo · niet verbonden';
    status.setAttribute('aria-label','Demo met fictieve receivers. Er is geen verbinding met echte verlichting.');
  }
  const receiverUpdates=window.LightningReceiverUpdateUI.create({services:runtime?.native===true?runtime.services||{}:{}});
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
    services:webDemo||(runtime?.native===true?runtime.services||{}:{}),
    onManage:request=>manageSetupZones(request),
    onComplete:nextModel=>{model=nextModel;},
    onExit:result=>{
      const returnZone=stand()?.zones.find(z=>z.id===route.setupReturnZoneId);
      if(returnZone)return navigate('layout',{zoneId:returnZone.id,setupReturnZoneId:null});
      navigate(result?.stand||route.setupFrom==='stand'||!stand()?'stand':'receivers',{setupReturnZoneId:null});
    }});
  const previews = new Map();
  let previewKey = 0;
  const copy = object => JSON.parse(JSON.stringify(object));
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const iconPaths = {
    stand:'M3 21V4h18v17M3 8h18M7 21V12h10v9M1 21h22',
    zones:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    light:'M3 9h18v6H3zM6 11v2M10 11v2M14 11v2M18 11v2M1 12h2M21 12h2',
    receiver:'M4 5h16v15H4zM8 2v3M16 2v3M7 9h10M7 13h2M11 13h2M15 13h2M7 17h10',
    back:'m14 6-6 6 6 6M8 12h13', chevron:'m9 5 7 7-7 7', close:'m6 6 12 12M6 18 18 6',
    edit:'m16 3 5 5-12 12-6 1 1-6ZM14 5l5 5',
    trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
    sliders:'M5 3v5M5 13v8M12 3v10M12 18v3M19 3v2M19 10v11M2 8h6v5H2zM9 13h6v5H9zM16 5h6v5h-6z',
    animation:'M3 9v6M7 5v14M12 2v20M17 6v12M21 9v6',
    power:'M12 2v10M6 5a9 9 0 1 0 12 0',
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
    return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${iconPaths[name] || iconPaths.light}"/></svg>`;
  }
  const stand = () => model.stands[0];
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
      const name=white>0 && rgb.every(v=>v===0)?'Wit':`Kleur ${i+1}`;
      const swatch=`<span role="img" aria-label="${name}" title="${name}" style="--swatch:${C.hex(C.mixWhite(rgb,white))}"></span>`;
      return activeEffect()?.paletteEditable === false ? swatch : `<div class="palette-item"><button class="palette-colour" data-action="palette-edit" data-id="${i}" aria-label="${name} aanpassen">${swatch}<small>${name}</small></button>${activeEffect()?.colorCountRange&&count>activeEffect().colorCountRange.min?`<button class="palette-remove" data-action="palette-remove" data-id="${i}" aria-label="Kleur ${i+1} verwijderen">−</button>`:''}</div>`;
    }).join('')+(activeEffect()?.colorCountRange&&count<activeEffect().colorCountRange.max?'<button class="palette-add" data-action="palette-add" aria-label="Animatiekleur toevoegen">＋ Kleur</button>':'');
  }
  function addPreview(list, layout, css = '', options = {}) {
    const key = String(++previewKey);
    previews.set(key, {receivers:list, layout, ...options});
    return `<canvas class="${css}" data-preview="${key}" data-preview-line-count="${list.length}" role="img" aria-label="${esc(options.label || 'Lichtvoorbeeld')}" width="400" height="160"></canvas>`;
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
    if(continuousZone())return `<section class="selection continuous-scope" data-continuous-scope aria-label="Je bedient alle ledlines samen">${icon('light')}<div><strong>Je bedient alle ledlines samen</strong><small>Alles verandert tegelijk.</small></div><p class="mixed-note" ${mixedSelection()?'':'hidden'}>De ledlines hebben verschillende instellingen. Je volgende wijziging geldt voor allemaal.</p></section>`;
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
        <button class="scope-lines-toggle" data-action="scope-toggle-lines" aria-label="${esc(scopeToggleLabel)}" aria-expanded="${expanded}" aria-controls="${esc(panelId)}"><span class="scope-toggle-icon" aria-hidden="true">${all?icon('together'):icon('light')}</span><span class="scope-copy"><span class="scope-option-title">${esc(scopeToggleLabel)}</span><small>${esc(scopeToggleHint)}</small></span><span class="scope-toggle-chevron" aria-hidden="true">${icon('chevron')}</span></button>
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
    return `<section class="control-context${list.length>=5?' many-receivers':''}">${integratedControlHeading?'':contextTitle(title,atRoot ? `${list.length} ledline${list.length===1?'':'s'} · in ${standLabel()}` : z.name,backLabel,backAction)}${atRoot ? `<div class="section-tabs" role="tablist" aria-label="Zonepagina"><button role="tab" data-action="controls" aria-selected="${screen === 'controls'}">${icon('sun')}Bediening</button><button role="tab" data-action="layout" aria-selected="${screen === 'layout'}">${icon('zones')}Opstelling</button></div>` : ''}</section>${controlPreviewDock(screen,modeTabs)}`;
  }
  function controlPreviewDock(screen,modeTabs='') {
    const z=zone(),list=receivers(),pixels=z.type==='SPI'?P.geometry(list,z.layout).totalPixels:0;
    const integratedControlHeading=screen==='controls';
    const canTapLines=list.length>1&&!continuousZone()&&['controls','colour','animations'].includes(screen);
    const effectChosen=screen==='controls'&&controlMode==='animations'&&Boolean(activeEffect());
    const total=z.type==='SPI'?t(list.length===1?'scopeTotalSpiOne':'scopeTotalSpiMany',{count:list.length,pixels}):t(list.length===1?'scopeCountOne':'scopeCountMany',{count:list.length});
    const scope=selection().kind==='all'?total:t('scopeSelectedTap',{name:nameOfSelection()});
    const modeName=screen==='controls'?(controlMode==='colour'?'Kleur':'Effecten'):screen==='layout'?'Opstelling':screen==='colour'?'Kleur':screen==='animations'?'Effecten':'Bediening';
    const label=`LED-overzicht van ${z.name} · ${total}${selection().kind==='all'?'':` · ${nameOfSelection()} gekozen`}`;
    return `<section class="control-preview-dock" aria-label="LED-overzicht en bediening">
      ${integratedControlHeading?`<div class="control-dock-context-line"><div class="control-dock-location"><small>JE LICHT · ${esc(modeName)}</small><b>${esc(z.name)}</b></div><span class="pill control-dock-type-badge">${zoneTypeLabel(z)}</span></div><div class="control-dock-actions"><button class="back back-to-zones control-dock-back" data-action="stand" aria-label="Terug naar zones" title="Terug naar zones">${icon('back')}<span>Zones</span></button>${modeTabs}</div>`:''}
      ${integratedControlHeading?'':`<div class="control-dock-heading"><div class="control-dock-location"><small>JE LICHT · ${esc(modeName)}</small><b>${esc(z.name)}</b></div>${modeTabs||`<span class="control-dock-mode">${esc(modeName)}</span>`}</div>`}
      <div class="preview-wrap${canTapLines?' preview-selectable':''}"><div class="preview-top"><span>Hele zone</span><span class="preview-summary">${esc(scope)}</span></div>${zonePreview(z,'',{selection:selection(),main:true,lineNumbers:Object.fromEntries(list.map((receiver,index)=>[receiver.id,index+1])),label})}${screen==='animations'||effectChosen?`<div class="preview-live-controls"><span>Voorbeeld volgt je keuze direct</span></div>`:''}</div>
      <p class="live-confirmation" data-live-status="zone" role="status" aria-live="polite"></p>
    </section>`;
  }
  function zoneTypeLabel(z) { return z.type==='SPI'?'Pixel LED · SPI':z.type==='RGBW'?'RGBW':'Nog geen verlichting'; }
  function previewSizePickerMarkup(){
    return `<div class="preview-size-row"><span>Voorbeeld</span><div class="preview-size-picker" role="group" aria-label="Grootte van het ledlinevoorbeeld">${[['small','Klein'],['medium','Groter'],['large','Heel groot']].map(([size,title])=>`<button type="button" data-action="preview-size" data-id="${size}" aria-label="${title} voorbeeld" aria-pressed="${controlPreviewSize===size}">${title}</button>`).join('')}</div></div>`;
  }
  function zoneDeleteButton(z,css=''){return `<button type="button" class="zone-delete-shortcut ${css}" data-action="zone-delete" data-id="${esc(z.id)}" aria-label="Zone ${esc(z.name)} verwijderen">${icon('trash')}<span>Zone verwijderen</span></button>`;}
  function renderEmptyZone() {
    const z=zone();
    return `<div class="page empty-zone-page"><div class="topline"><button class="back back-to-zones" data-action="stand">${icon('back')}<span>Terug naar zones</span></button><span class="context-name">${esc(standLabel())}</span></div><header class="page-heading"><div><div class="eyebrow">LEGE ZONE</div><h1>${esc(z.name)}</h1></div><button class="icon-button" data-action="zone-rename" data-id="${esc(z.id)}" aria-label="Naam van deze zone wijzigen">${icon('edit')}</button></header><section class="card empty empty-zone"><h2>Voeg verlichting toe</h2><p>Verplaats een receiver uit je stand. Zijn instellingen blijven bewaard.</p><button class="button full" data-action="zone-assign" data-id="${esc(z.id)}">Bestaande receiver kiezen</button><small>${z.type?`Deze zone is voor ${esc(z.type)}.`:'Voeg nieuwe verlichting toe via Receivers. De eerste receiver bepaalt het zonetype: RGBW of SPI.'}</small></section>${zoneDeleteButton(z)}</div>`;
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
    return `<div class="power-card"><div><strong>${icon('power')}Hele ${scope}</strong></div><button class="switch" role="switch" aria-label="${value==='mixed'?`Deels aan; zet de hele ${scope} aan`:`Hele ${scope} aan of uit`}" aria-checked="${value===true}" data-mixed="${value==='mixed'}" data-action="power" ${states.length?'':'disabled'}><span>${value === 'mixed' ? 'Deels aan' : value ? 'Aan' : 'Uit'}</span><i aria-hidden="true"></i></button></div>`;
  }
  function renderControls() {
    const colour=controlMode==='colour';
    const oneLine=receivers().length===1;
    const modeContent=colour
      ?`<section class="bediening-workspace" aria-labelledby="bediening-colour-title"><header class="bediening-workspace-heading"><span class="menu-icon">${icon('sun')}</span><div><h2 id="bediening-colour-title">Vaste kleur</h2><p>${oneLine?'Kies een kleur voor deze ledline.':'Kies ledlines om samen te bedienen.'}</p></div></header>${selector()}${colourPickerMarkup()}</section>`
      :`<section class="bediening-workspace" aria-labelledby="bediening-animation-title"><header class="bediening-workspace-heading"><span class="menu-icon">${icon('animation')}</span><div><h2 id="bediening-animation-title">Animaties</h2><p>${oneLine?'Kies een animatie voor deze ledline.':'Kies ledlines om samen te bedienen. Kies daarna een animatie.'}</p></div></header>${selector()}${controlAnimationPanel()}</section>`;
    return `<div class="editor-grid">${controlContext('controls')}<section class="editor-controls">${powerControl()}<section class="control-workspace"><div class="control-mode-panel" role="region" aria-label="${colour?'Vaste kleur':'Animaties'}" data-control-mode="${controlMode}">${modeContent}</div></section></section></div>`;
  }

  function controlAnimationPanel(){
    const effect=activeEffect();
    if(effect&&!showControlAnimationGallery)return animationEditorMarkup(effect);
    const current=effect?`<button class="current-animation-shortcut" data-action="animation-current-edit"><span class="menu-icon">${icon('animation')}</span><span><small>NU ACTIEF</small><b>${esc(Library.displayName(effect))}</b></span><span class="current-animation-edit">Aanpassen ${icon('chevron')}</span></button>`:'';
    return `<div class="control-animation-choices">${current}${animationLibraryContent()}</div>`;
  }
  function slider(key,label,min,max,value,unit='',hint='',guide=null) {
    const title=guide?.icon?`<span class="setting-label-icon">${icon(guide.icon)}</span><span class="setting-label-copy">${esc(label)}</span>`:esc(label);
    const description=guide?.description||hint;
    return `<div class="slider-row${guide?.icon?' has-setting-icon':''}"><label for="setting-${key}">${title}<output data-value-for="${key}">${Math.round(value)}${unit}</output></label><input id="setting-${key}" type="range" min="${min}" max="${max}" step="1" value="${value}" data-setting="${key}" data-unit="${unit}">${description ? `<small>${esc(description)}</small>` : ''}</div>`;
  }
  function renderColour() {
    return `<div class="editor-grid">${controlContext('colour')}<section class="editor-controls">${selector()}${colourPickerMarkup()}</section></div>`;
  }
  function myColoursMarkup() {
    return `<section class="my-colours"><div class="section-heading"><h3>${esc(t('myColours'))}</h3><div class="colour-library-actions"><button class="icon-button colour-manager-button" data-action="colours-manager" aria-label="Kleurpresets beheren" title="Kleurpresets beheren" ${savedColours.colors.length?'':'disabled'}>${icon('trash')}</button><button class="text-button" data-action="colours-manage" aria-pressed="${colourOrderMode}" ${savedColours.colors.length<2&&!colourOrderMode?'disabled':''}>${esc(t(colourOrderMode?'done':'colourOrder'))}</button></div></div><p class="colour-library-hint">${colourOrderMode?'Sleep een kleur naar haar nieuwe plek. De volgorde wordt meteen bewaard.':'＋ bewaart je ingestelde kleur. Tik op het prullenbakje om presets te beheren.'}</p><div class="saved-colour-grid ${colourOrderMode?'is-ordering':''}">${savedColours.colors.map(entry=>`<div class="saved-colour-item" data-colour-id="${esc(entry.id)}"><button class="saved-colour" data-action="swatch" data-id="${esc(entry.id)}" data-rgb="${entry.color.r},${entry.color.g},${entry.color.b}" data-white="${entry.color.w}" style="--swatch:${C.hex(C.mixWhite([entry.color.r,entry.color.g,entry.color.b],entry.color.w))}" aria-label="${esc(entry.name)}"><i></i><span>${esc(entry.name)}</span></button>${colourOrderMode?`<button class="colour-drag-handle" data-colour-drag="${esc(entry.id)}" aria-label="${esc(entry.name)} verslepen" title="Versleep om de volgorde te wijzigen"><span aria-hidden="true">⠿</span><small>Sleep</small></button>`:''}</div>`).join('')}<button class="saved-colour add-colour" data-action="colour-new" aria-label="${esc(t('saveCurrentColour'))}"><i aria-hidden="true">＋</i><span>${esc(t('saveColour'))}</span></button></div><div class="colour-library-feedback"><p class="colour-library-status" role="status">${esc(colourLibraryNotice)}</p></div>${savedColours.error?`<p role="alert">${esc(savedColours.error.message)}</p>`:''}</section>`;
  }
  function showColourManager(notice=colourLibraryNotice) {
    if(!colourManagerReturn){
      const dialog=document.getElementById('effect-dialog');
      colourManagerReturn={open:dialog.open,title:dialog.querySelector('#effect-dialog-title')?.textContent||'',content:document.getElementById('effect-dialog-content').innerHTML,scrollTop:dialog.scrollTop};
    }
    colourLibraryNotice=notice;
    const rows=savedColours.colors.map(entry=>`<div class="colour-manager-row"><span class="colour-manager-swatch" style="--swatch:${C.hex(C.mixWhite([entry.color.r,entry.color.g,entry.color.b],entry.color.w))}" aria-hidden="true"><i></i></span><span class="colour-manager-copy"><b>${esc(entry.name)}</b><small>RGB ${entry.color.r} · ${entry.color.g} · ${entry.color.b} · W ${entry.color.w}</small></span><button class="icon-button colour-manager-remove" data-action="colour-remove" data-id="${esc(entry.id)}" aria-label="${esc(entry.name)} verwijderen">${icon('trash')}</button></div>`).join('');
    const body=`<section class="colour-manager" data-colour-manager><p>Je kleurpresets blijven hier bewaard. Verwijderen kan direct ongedaan gemaakt worden.</p>${rows?`<div class="colour-manager-list">${rows}</div>`:`<div class="colour-manager-empty"><span class="menu-icon">${icon('trash')}</span><b>Nog geen kleurpresets</b><small>Stel eerst een kleur in en tik op ＋ om die te bewaren.</small></div>`}<p class="colour-library-status" role="status">${esc(colourLibraryNotice)}</p>${removedColour?'<button class="button secondary full" data-action="colour-undo">Ongedaan maken</button>':''}</section>`;
    showEffectDialog('Kleurpresets beheren',body);
    document.querySelector('#effect-dialog [data-action="colour-remove"],#effect-dialog [data-action="effect-dialog-close"]')?.focus({preventScroll:true});
  }
  function closeColourManager(){
    const previous=colourManagerReturn;colourManagerReturn=null;
    if(!previous?.open){
      document.querySelectorAll('main .my-colours').forEach(section=>section.outerHTML=myColoursMarkup());
      closeEffectDialog();return;
    }
    showEffectDialog(previous.title,previous.content);
    document.querySelectorAll('#effect-dialog .my-colours').forEach(section=>section.outerHTML=myColoursMarkup());
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
    const values=pickerChannels(root),color={r:values[0],g:values[1],b:values[2],w:values[3],bri:root.dataset.colourPicker==='background'?(selectedState().bgBrightness??10):(selectedState().bri??100)};
    const current=colourStore.load();if(current.error)return refreshColourLibraries(button,current.error.message);
    const base=Colours.suggestName(color);let name=base,suffix=2;
    while(current.colors.some(entry=>entry.name===name))name=`${base} ${suffix++}`;
    const result=colourStore.save(Colours.capture(name,color));
    if(result.error)return refreshColourLibraries(button,result.error.message);
    savedColours=result;refreshColourLibraries(button,`${name} toegevoegd aan Kleurpresets.`);
  }
  window.LightningColourLibraryDrag?.install({document,onMove:({id,toIndex,source})=>{
    const result=colourStore.move(id,toIndex);if(result.error)return refreshColourLibraries(source,result.error.message);
    savedColours=result;refreshColourLibraries(source,'Volgorde bewaard.');
  }});
  function colourPickerMarkup(slot=null) {
    const s=selectedState(),background=slot==='background',values=background?backgroundChannels():effectiveColourChannels(slot??0),rgb=values.slice(0,3),white=values[3];
    const prefix=slot===null?'static':'palette-'+slot;
    return `<section class="card colour-card shared-colour-picker" data-colour-picker="${background?'background':slot===null?'static':'animation'}" data-slot="${slot??''}">
      <div class="section-heading"><h2>${background?'Achtergrondkleur':'Kleur kiezen'}</h2></div>
      <div class="colour-tools"><div class="wheel-wrap"><canvas class="wheel" id="colour-wheel" tabindex="0" role="img" aria-label="Kleurenwiel. Gebruik de pijltjestoetsen of de regelaars onder Fijn instellen voor exacte waarden." width="260" height="260"></canvas><span class="wheel-cursor"></span></div><div class="colour-values"><div class="colour-swatch" aria-label="Gekozen kleur"></div><p class="setting-hint">Tik of sleep naar je kleur.</p>${slot===null?'':'<small>Je animatie blijft actief.</small>'}</div></div>
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
    return `<section class="animation-background" aria-label="Achtergrondkleur"><div class="background-control-heading"><span class="setting-label-icon">${icon('layers')}</span><span class="background-control-copy"><b>Achtergrondkleur</b><small>Achter de bewegende lichtpunten</small></span><button class="switch" data-action="background-toggle" aria-label="Achtergrondkleur aan of uit" aria-pressed="${on}" aria-checked="${on}" role="switch"><span>${on?'Aan':'Uit'}</span><i aria-hidden="true"></i></button></div><p class="background-explanation">Aan: kies een vaste kleur achter de animatie. Uit: alleen de animatiekleuren.</p><div class="background-details" data-background-details ${on?'':'hidden'}><button class="background-colour" data-action="background-edit"><span class="background-swatch" style="background:${C.hex(C.mixWhite(channels.slice(0,3),channels[3]))}"></span><span>Kies achtergrondkleur</span>${icon('chevron')}</button>${animationSlider('bgBrightness','Helderheid achtergrond',0,100,s.bgBrightness??10,'%')}${resetMarkup('bgBrightness','Helderheid achtergrond')}</div></section>`;
  }
  const animationSettingGuides={
    bri:{icon:'sun',description:'Hoe fel de bewegende kleuren branden.'},
    speed:{icon:'animation',description:'Hoe snel het licht over de ledlines beweegt.'},
    bgBrightness:{icon:'sun',description:'Hoe fel de vaste achtergrondkleur brandt.'},
    smooth:{icon:'sparkle',description:'Animaties lopen altijd op maximale vloeiendheid.'},
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
    const smoothness=available.includes('smooth')?`<div class="fixed-animation-setting" data-fixed-setting="smooth" aria-label="Vloeiendheid altijd 100 procent"><span class="setting-label-icon">${icon(animationSettingGuides.smooth.icon)}</span><span class="fixed-animation-copy"><b>Vloeiendheid</b><small>${esc(animationSettingGuides.smooth.description)}</small></span><strong>100%</strong></div>`:'';
    if(!controls.length&&!smoothness&&!['direction','bounce','mirror'].some(key=>available.includes(key)))return '';
    return `<button class="settings-toggle" data-action="settings-toggle" aria-expanded="${settingsOpen}" aria-controls="animation-settings">${icon('sliders')}<span>${settingsOpen?'Instellingen verbergen':'Beweging instellen'}</span>${icon(settingsOpen?'close':'chevron')}</button><section id="animation-settings" class="card settings-panel" ${settingsOpen?'':'hidden'}><p class="animation-preview-feedback"><span class="preview-feedback-icon">${icon('animation')}</span><span>Kijk bovenaan: het ledline-voorbeeld beweegt meteen mee.</span></p>${controls.map(spec=>`<div class="animation-setting">${animationSlider(...spec)}${resetMarkup(spec[0],spec[1])}</div>`).join('')}${smoothness}${available.includes('direction') ? `<div class="direction-setting"><p class="direction-setting-label"><span class="setting-label-icon">${icon('back')}</span><span><b>Richting</b><small>Kies welke kant het licht op beweegt.</small></span></p><div class="compact-direction" aria-label="Bewegingsrichting">${(effect.directions||['right','left']).map(value=>`<button data-action="direction" data-value="${value}" aria-pressed="${(s.direction||effect.state.direction)===value}">${esc(directionMap[value]||value)}</button>`).join('')}</div></div>`:''}</section>`;
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
    const galleryAction=route.screen==='controls'?'animation-gallery':'animations-gallery';
    const galleryButton=['controls','animations'].includes(route.screen)?`<button class="button secondary animation-gallery-return" data-action="${galleryAction}" aria-label="Terug naar animatiegalerij">${icon('back')}<span>Galerij</span></button>`:'';
    const paletteTitle=effect.category==='brand'?effect.id==='v30-brand-focus'?'Merkkleuren · tik om te wijzigen':'Accentkleur · tik om te wijzigen':effect.paletteEditable===false?'Kleurenreeks':'Animatiekleuren · tik om te wijzigen';
    const paletteHelp=effect.id==='v30-brand-focus'?'<p class="palette-guidance">Voeg kleuren toe voor je merkaccent. De gloed laat ze na elkaar zien langs de ledlines.</p>':'';
    const content = `<div class="current-effect"><span class="menu-icon">${icon('animation')}</span><div><small>Actieve animatie · ${esc(categoryLabel(effect.category))}</small><b>${esc(Library.displayName(effect))}</b><small>${esc(effect.description)}</small></div>${galleryButton}</div><section class="card palette-section"><h2>${paletteTitle}</h2>${paletteHelp}<div class="palette" aria-label="Animatiekleuren">${paletteMarkup(s)}</div>${animationSlider('bri','Kleurhelderheid',0,100,s.bri??100,'%')}${resetMarkup('bri','Kleurhelderheid')}${backgroundControls(effect)}${effect.controls.includes('speed')?`${animationSlider('speed','Snelheid',0,100,s.speed??30,'%')}${resetMarkup('speed','Snelheid')}`:''}</section>${animationControls(effect)}<button class="button secondary full" data-action="preset-save">＋ Animatie bewaren</button>`;
    return `<section class="active-animation-workspace" aria-label="Animatie aanpassen">${content}</section>`;
  }
  function renderAnimations() {
    const effect=activeEffect();
    if(!effect)return renderEffects();
    return `<div class="editor-grid">${controlContext('animations')}<section class="editor-controls">${selector()}${animationEditorMarkup(effect)}</section></div>`;
  }
  function brandTonePicker() {
    const selected=brandColours.get(route.zoneId)||'#C94E46';
    return `<section class="brand-tone-picker" aria-label="Merkaccent kiezen"><div class="brand-tone-heading"><b>Merkaccent</b><small>Kies een kleur voor de merkvoorbeelden</small></div><div class="brand-tone-options" role="group" aria-label="Beschikbare merkkleuren">${BRAND_TONES.map(tone=>`<button class="brand-tone-option" type="button" data-action="brand-tone" data-id="${tone.id}" aria-label="${tone.name}" aria-pressed="${selected.toLowerCase()===tone.value.toLowerCase()}" title="${tone.name}" style="--brand-tone:${tone.value}"><i aria-hidden="true"></i><span>${tone.name}</span></button>`).join('')}</div><small class="brand-tone-note">Je verlichting verandert pas wanneer je een animatie kiest.</small></section>`;
  }
  function categoryLabel(key) {
    return Library.categories.find(category=>category.key===key)?.title||({catalogue:'Alle',presets:'Mijn animaties'})[key]||'Animaties';
  }
  function libraryTabLabel(key) { return key==='whole'&&zone()?.type==='SPI'?'RGBW-stijl':categoryLabel(key); }
  function initialAnimationLibrary() { return zone()?.type==='SPI'?'pixels':'catalogue'; }
  function libraryTab() { return route.library==='all'?'catalogue':route.library||initialAnimationLibrary(); }
  function backgroundDefaults(){return {backgroundOn:false,background:'#000000',backgroundWhite:0,bgBrightness:10,backgroundRgbEnabled:true,backgroundWhiteEnabled:true};}
  function effectState(effect) {
    const state={...backgroundDefaults(),...copy(effect.state),category:effect.category,v30Effect:effect.state.v30Effect||null,previewFamily:effect.state.previewFamily||null,legacySpi:effect.state.legacySpi===true,bounce:effect.state.bounce===true,mirror:effect.state.mirror===true,on:true,power:true};
    if(effect.controls.includes('smooth'))state.smooth=100;
    if(effect.category==='brand'){
      const accent=brandColours.get(route.zoneId)||state.brandColor||state.colors?.[0]||'#C94E46';
      state.brandColor=accent;
      if(effect.id==='v30-brand-focus'||effect.id.startsWith('spi-')&&effect.state.engine!=='WARM'&&!/white/i.test(effect.name)){
        state.colors=[accent];state.colorCount=1;state.whiteChannels=[0];state.rgbEnabled=[true];state.whiteEnabled=[false];
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
  function motionSignature(effect) {
    const key=effectMotionKey(effect),lanes=effect.category==='tunnel'
      ? `<svg viewBox="0 0 160 38" focusable="false"><path class="motion-floor" d="M12 35 80 25 148 35"/><path class="motion-rail rail-back" d="M59 28C59 20 101 20 101 28"/><path class="motion-rail rail-mid" d="M36 32C36 13 124 13 124 32"/><path class="motion-rail rail-front" d="M12 35C12 3 148 3 148 35"/><path class="motion-flow-line" d="M12 35C12 3 148 3 148 35"/><circle class="motion-marker marker-one" cx="20" cy="22" r="3.3"/><circle class="motion-marker marker-two" cx="80" cy="5" r="3.3"/><circle class="motion-marker marker-three" cx="140" cy="22" r="3.3"/></svg>`
      : `<span class="motion-lanes">${Array.from({length:3},()=>`<i class="motion-lane">${Array.from({length:7},()=>'<b></b>').join('')}</i>`).join('')}</span>`;
    return `<span class="motion-signature motion-signature--${key}${effect.category==='tunnel'?' is-tunnel':''}" data-motion-signature="${key}" aria-hidden="true">${lanes}</span>`;
  }
  function effectPreview(effect) {
    const tunnel=effect.category==='tunnel';
    // Gallery cards explain the motion on one representative line, not by
    // duplicating the animation across the customer's whole installation.
    // This sample never enters the model or changes ports/pixels/targets.
    // Older stored effects default to very slow cycles (up to ~100 seconds),
    // which makes distinct animations look frozen and alike while browsing.
    // Accelerate only these disposable gallery samples; the selected effect,
    // its settings and the main installation preview keep their real speed.
    const previewState={...effectState(effect),speed:Math.max(effect.category==='brand'?58:75,Number(effect.state.speed)||0)};
    const sampleType=zone().type||'RGBW',oneLine=effect.category!=='tunnel';
    const list=oneLine?[{id:'library-sample-strip',type:sampleType,name:'LED-voorbeeld',
      outputs:sampleType==='SPI'?[{port:1,enabled:true,pixels:32,reversed:false}]:[],state:previewState}]
      :receivers().map(r=>({...r,state:previewState}));
    // Tunnel effects remain the only gallery examples that show several lines.
    const layout=oneLine?'stacked':zone().layout;
    return addPreview(list,layout,'',{label:Library.displayName(effect),effectId:effect.id,brand:effect.category==='brand',labels:!oneLine});
  }
  function tunnelIllustration() {
    // Product-inspired teaching model, not a CAD model or the user's actual
    // receiver geometry: a broad circular fascia and a continuous curved wall.
    const outer=[[60,224],[20,190,12,148,18,110],[24,47,72,14,132,14],[194,14,241,59,244,116],[246,159,230,194,206,224]];
    const inner=[[82,224],[55,196,40,162,43,122],[46,76,82,40,132,40],[181,40,216,73,220,123],[221,163,206,195,182,224]];
    const rim=outer.map((points,i)=>points.map((value,j)=>(value+inner[i][j])/2));
    // Extend the constant-width fascia below the ground, then cut both feet
    // on one horizontal plane. Perspective and floor share one projection.
    const fascia=copy(rim);fascia[0]=[83,240];fascia[1][0]=57;fascia[1][1]=211;fascia[4][2]=207;fascia[4][3]=211;fascia[4][4]=183;fascia[4][5]=240;
    const depths=[1,.84,.70,.58,.48],vp=[164,108];
    const project=(x,y,s)=>[vp[0]+(x-vp[0])*s,vp[1]+(y-vp[1])*s];
    const point=(x,y,s)=>`${(vp[0]+(x-vp[0])*s).toFixed(2)} ${(vp[1]+(y-vp[1])*s).toFixed(2)}`;
    const floor=(left,right,front=1.1,rear=.48)=>`M${point(left,224,front)}L${point(right,224,front)}L${point(right,224,rear)}L${point(left,224,rear)}Z`;
    function curve(points,s,reverse=false,join=false){
      if(!reverse)return (join?'L':'M')+point(...points[0],s)+points.slice(1).map(p=>'C'+point(p[0],p[1],s)+' '+point(p[2],p[3],s)+' '+point(p[4],p[5],s)).join('');
      return (join?'L':'M')+point(...points.at(-1).slice(-2),s)+points.slice(1).map((p,i)=>'C'+point(p[2],p[3],s)+' '+point(p[0],p[1],s)+' '+point(...points[i].slice(-2),s)).reverse().join('');
    }
    const band=(a,b,front=inner,back=inner)=>curve(front,a)+curve(back,b,true,true)+'Z';
    const panels=depths.slice(0,-1).map((depth,i)=>{
      const rear=depths[i+1],middle=(depth+rear)/2;
      return `<g class="tunnel-light-section" data-depth="${i}"><path class="tunnel-panel" d="${band(depth,rear)}"/><path class="tunnel-panel-light arch-${i}" d="${band(depth,rear)}"/><path class="tunnel-panel-seam" d="${curve(inner,rear)}"/><path class="tunnel-arch arch-${i}" d="${curve(inner,middle)}" style="--light-width:${(3.2*depth).toFixed(1)}px"/><path class="tunnel-ribbon arch-${i}" d="${curve(inner,depth-.025)}"/></g>`;
    }).reverse().join('');
    const reflections=depths.slice(0,-1).map((depth,i)=>{
      const rear=depths[i+1];
      return `<path class="tunnel-reflection arch-${i}" d="${floor(109,155,depth,rear)}"/>`;
    }).join('');
    return `<svg viewBox="0 0 360 260" role="img" aria-label="Uitlegvoorbeeld in 3D: een ronde ledtunnel met vier bewegende lichtzones en een reflecterend looppad"><defs>
      <linearGradient id="tunnel-shell" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#d1d5d5"/><stop offset=".4" stop-color="#bdc2c3"/><stop offset="1" stop-color="#a8aeb1"/></linearGradient>
      <linearGradient id="tunnel-face" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#d5d8d8"/><stop offset=".5" stop-color="#c6cacb"/><stop offset="1" stop-color="#b4b9bc"/></linearGradient>
      <linearGradient id="tunnel-lining" x1="0" y1="0" x2="1" y2=".8"><stop stop-color="#202226"/><stop offset=".36" stop-color="#090c10"/><stop offset=".7" stop-color="#25272b"/><stop offset="1" stop-color="#111316"/></linearGradient>
      <linearGradient id="tunnel-light" x1="0" y1="1" x2=".6" y2="0"><stop stop-color="#de6559" stop-opacity=".3"/><stop offset=".4" stop-color="#d15148" stop-opacity=".12"/><stop offset=".75" stop-color="#f5dfd8" stop-opacity=".18"/><stop offset="1" stop-color="#e36559" stop-opacity=".2"/></linearGradient>
      <linearGradient id="tunnel-walkway" x1="0" y1="1" x2=".7" y2="0"><stop stop-color="#a3a09a"/><stop offset=".5" stop-color="#767573"/><stop offset="1" stop-color="#424345"/></linearGradient>
      <linearGradient id="tunnel-reflect" x1="0" y1="1" x2="0" y2="0"><stop stop-color="#dfafa5" stop-opacity="0"/><stop offset=".42" stop-color="#dfafa5" stop-opacity=".14"/><stop offset=".58" stop-color="#e9e0da" stop-opacity=".2"/><stop offset="1" stop-color="#e9e0da" stop-opacity="0"/></linearGradient>
      <linearGradient id="tunnel-exit" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#777d81" stop-opacity=".08"/><stop offset=".65" stop-color="#888e90" stop-opacity=".16"/><stop offset="1" stop-color="#a5a4a0" stop-opacity=".3"/></linearGradient>
      <radialGradient id="tunnel-exit-glow"><stop stop-color="#d7d9d8" stop-opacity=".23"/><stop offset="1" stop-color="#d7d9d8" stop-opacity="0"/></radialGradient>
      <clipPath id="tunnel-opening"><path d="${curve(inner,1)}Z"/></clipPath>
      <clipPath id="tunnel-exit-boundary"><path d="${curve(inner,.48)}Z"/></clipPath>
      <clipPath id="tunnel-ground-cut"><rect x="-20" y="-20" width="330" height="244"/></clipPath>
    </defs><g transform="translate(44 5)"><ellipse class="tunnel-ground-shadow" cx="132" cy="231" rx="131" ry="12"/>
      <path class="tunnel-exit-opening" d="${curve(inner,.48)}Z" fill="url(#tunnel-exit)"/><ellipse cx="${project(132,129,.48)[0]}" cy="${project(132,129,.48)[1]}" rx="39" ry="43" fill="url(#tunnel-exit-glow)"/>
      <g clip-path="url(#tunnel-exit-boundary)" opacity=".4"><path d="${floor(82,182,.48,.08)}" fill="url(#tunnel-walkway)"/><path d="${floor(109,155,.48,.08)}" fill="#44474a"/></g>
      <path class="tunnel-shell" d="${band(1,.48,outer,outer)}"/><g class="tunnel-interior" clip-path="url(#tunnel-opening)"><path class="tunnel-back-face" d="${band(.48,.48,outer,inner)}"/>
      <path class="tunnel-inner-wall" d="${band(1,.48)}"/>${panels}</g>
      <path class="tunnel-walkway" d="${floor(82,182)}"/><path class="tunnel-floor-edge" d="M${point(82,224,1.1)}L${point(82,224,.48)}M${point(182,224,1.1)}L${point(182,224,.48)}"/>
      <path class="tunnel-floor-inlay" d="${floor(109,155)}"/>${reflections}
      <g class="tunnel-fascia" clip-path="url(#tunnel-ground-cut)"><path class="tunnel-front-side" d="${curve(fascia,1)}" transform="translate(2 1)"/><path class="tunnel-front-edge" d="${curve(fascia,1)}"/><path class="tunnel-front-face" d="${curve(fascia,1)}"/></g><path class="tunnel-inner-bevel" d="${curve(inner,1)}"/>
    </g></svg>`;
  }
  function tunnelGuide() {
    const count=receivers().length,together=selection().kind==='all';
    const status=count<2?`Nog ${2-count} ${count===1?'ledline':'ledlines'} nodig`:together?'Klaar voor tunneleffecten':'Selecteer alle ledlines';
    const detail=count<2?`${ledlineCount(count)} in ${zone().name}`:together?`${ledlineCount(count)} · in de volgorde van Opstelling`:`${ledlineCount(count)} · een tunnel bedien je samen`;
    const action=count<2?`<button class="button full" data-action="layout-receiver-add" data-zone="${esc(zone().id)}"><span aria-hidden="true">＋</span> Ledline toevoegen</button>`:!together?'<button class="button full" data-action="tunnel-together">Alle ledlines samen bedienen</button>':'';
    // A teaching illustration, never a substitute for the actual installation.
    // Effect cards below still use its real receiver count, order and layout.
    return `<section class="tunnel-guide" aria-label="Tunneleffecten"><header class="tunnel-guide-heading"><div><h2>Licht door de tunnel</h2><p>Van voor naar achter, in één beweging.</p></div><span class="tunnel-motion-symbol" aria-hidden="true">${icon('chevron')}${icon('chevron')}</span></header><figure class="tunnel-visual">${tunnelIllustration()}<figcaption><span>Tunnelvoorbeeld · 4 lichtzones</span><span class="tunnel-sequence" aria-hidden="true">${[0,1,2,3].map(i=>`<i class="arch-${i}"></i>`).join('')}</span></figcaption></figure><div class="tunnel-status"><div><strong>${status}</strong><small>${esc(detail)}</small></div>${action}</div></section>`;
  }
  function presetContext() { return {type:zone().type,receiverCount:receivers().length,selection:selection(),layout:zone().layout}; }
  function renderPresets() {
    savedPresets=presetStore.load();
    if(savedPresets.error)return `<div class="card"><h2>Mijn animaties konden niet worden gelezen</h2><p>${esc(savedPresets.error.message)} Je bestaande opslag is niet gewijzigd.</p></div>`;
    if(!savedPresets.presets.length)return `<section class="card empty"><h2>Mijn animaties</h2><p>Kies eerst een animatie, stel de kleuren en beweging in en tik op <b>Animatie bewaren</b>.</p><button class="button" data-action="library" data-id="all">Een animatie kiezen</button></section>`;
    return `<div class="preset-list">${savedPresets.presets.map(preset=>{const restored=S.restore(preset,presetContext(),catalogue());return `<article class="preset-card"><div><b>${esc(preset.name)}</b><small>${esc(categoryLabel(preset.category))} · ${esc(restored.compatible?'Voor je huidige selectie':restored.reason)}</small></div><button class="button" data-action="preset-apply" data-id="${esc(preset.id)}" ${restored.compatible?'':'disabled'}>Toepassen</button><button class="icon-button" data-action="preset-delete" data-id="${esc(preset.id)}" aria-label="${esc(preset.name)} verwijderen">${icon('close')}</button></article>`;}).join('')}</div>`;
  }
  function effectCards(effects,extraClass='') {
    const together=selection().kind==='all'&&receivers().length>=2,selectedCount=selected().length;
    const className=`effect-card${extraClass?` ${extraClass}`:''}`;
    return effects.map(effect=>{const needsAll=effect.requireTogether||effect.category==='tunnel',tooFew=selectedCount<(effect.minimumReceivers||1),locked=needsAll?!together:tooFew;return `<button class="${className}" data-action="effect" data-id="${esc(effect.id)}" data-motion="${effectMotionKey(effect)}" aria-pressed="${activeEffect()?.id===effect.id}" ${locked?'disabled':''}>${motionSignature(effect)}${effectPreview(effect)}<b>${esc(Library.displayName(effect))}</b><small>${esc(categoryLabel(effect.category))} · ${esc(effect.description)}</small>${locked?`<small>${needsAll?'Kies Alle ledlines samen':'Selecteer minstens '+(effect.minimumReceivers||1)+' ledlines'}</small>`:''}</button>`;}).join('');
  }
  function animationFamilyCard(group,expandedKey=null) {
    const expanded=expandedKey===group.key,panelId=`animation-variants-${group.key.replace(/[^a-z0-9_-]/gi,'-')}`;
    const countLabel=`${group.count} ${group.count===1?'voorbeeld':'varianten'}`;
    const type=zone()?.type==='SPI'?'SPI':'RGBW';
    return `<article class="animation-family-card${expanded?' is-expanded':''}"><button class="animation-family-trigger" data-action="family" data-id="${esc(group.key)}" data-ledline-type="${type}" aria-expanded="${expanded}" aria-controls="${panelId}"><span class="animation-family-preview">${motionSignature(group.preview)}${effectPreview(group.preview)}</span><span class="family-copy"><span class="family-kicker"><span class="family-kicker-label">Animatiegroep</span><span class="animation-type-badge" aria-label="Animaties voor ${type}-ledlines">${type}</span><span class="family-count">${countLabel}</span></span><b class="family-title">${esc(group.title)}</b><small class="family-summary">${esc(group.summary)}</small><span class="family-variants"><span>${expanded?'Varianten verbergen':group.count===1?'Voorbeeld bekijken':'Bekijk varianten'}</span>${icon('chevron')}</span></span></button><div class="family-variants-panel" id="${panelId}" ${expanded?'':'hidden'}><div class="family-variants-heading"><b>Kies een variant</b><small>${countLabel}</small></div><div class="family-variant-grid">${effectCards(group.effects,'family-variant-card')}</div></div></article>`;
  }
  function animationCategorySection(section,expandedKey=null) {
    return `<section class="animation-family-section" aria-labelledby="animation-category-${esc(section.key)}"><header class="animation-family-heading"><div><h2 id="animation-category-${esc(section.key)}">${esc(section.title)}</h2><p>${esc(section.summary)}</p></div><small>${section.count} ${section.count===1?'animatie':'animaties'}</small></header>${section.key==='tunnel'?`<p class="animation-category-note">Tunnelanimaties werken met minimaal twee ledlines. Kies daarna <b>Alle ledlines samen</b>.</p>`:''}<div class="animation-family-grid">${section.groups.map(group=>animationFamilyCard(group,expandedKey)).join('')}</div></section>`;
  }
  function animationCategorySections(items,expandedKey=null) {
    const sections=[...Library.sections(items)];
    if(zone()?.type==='SPI')sections.sort((left,right)=>(left.key==='pixels'?-1:right.key==='pixels'?1:0));
    return sections.map(section=>animationCategorySection(section,expandedKey)).join('');
  }
  function animationCategoryFamilyList(items,categoryKey,expandedKey=null) {
    const section=Library.sections(items).find(item=>item.key===categoryKey);
    return section?animationCategorySection(section,expandedKey):'';
  }
  function effectResults(query='') {
    const results=Library.search(catalogue(),query);
    return `<p class="library-result-count" role="status">${results.length} ${results.length===1?'animatie':'animaties'} gevonden in de volledige bibliotheek</p>${results.length?`<div class="effect-grid">${effectCards(results)}</div>`:'<section class="card empty animation-search-empty"><h2>Geen animaties gevonden</h2><p>Probeer een andere naam of bekijk alle effectfamilies.</p><button class="button secondary" data-action="animation-search-clear">Zoekopdracht wissen</button></section>'}`;
  }
  function renderEffects() {
    const currentEffect=activeEffect(),returnToEditor=Boolean(currentEffect)&&route.effectsReturn!=='controls',tab=libraryTab();
    const title=tab==='catalogue'?'Alle animaties':tab==='tunnel'||tab==='brand'||tab==='presets'?categoryLabel(tab):'Animatie kiezen';
    const editCurrent=currentEffect&&route.effectsReturn==='controls'?`<button class="button secondary full" data-action="animations">Actieve animatie bewerken · ${esc(Library.displayName(currentEffect))}</button>`:'';
    return `<div class="page">${contextTitle(title,`${zone().name} · ${nameOfSelection()}`,returnToEditor?'Terug naar instellingen':'Terug naar bediening',returnToEditor?'animations':'controls')}${tab==='tunnel'&&receivers().length<2?'':selector()}${editCurrent}${animationLibraryContent()}</div>`;
  }
  function animationLibraryContent(){
    savedPresets=presetStore.load();
    const items=catalogue(),tab=libraryTab(),active=route.family?Library.group(items,route.family):null;
    const isSpi=zone().type==='SPI',canTunnel=receivers().length>=2&&selection().kind==='all',tabs=isSpi?['pixels','whole','catalogue','tunnel','brand','presets']:['catalogue','whole','tunnel','brand','presets'],counts={catalogue:items.length,...Object.fromEntries(Library.sections(items).map(section=>[section.key,section.count])),presets:savedPresets.presets.length};
    const intro=tab==='whole'&&isSpi?`<p class="library-intro">Rustige kleurwissels en pulsen, zoals RGBW-effecten. Ook op SPI-ledlines.</p>`:tab==='whole'||tab==='pixels'?`<p class="library-intro">${esc(Library.categories.find(category=>category.key===tab).summary)} Open een groep en kies een voorbeeld.</p>`:tab==='brand'?`${brandTonePicker()}<p class="library-intro">Kies een merkbeweging en vergelijk de voorbeelden. Je accentkleur zie je meteen terug.</p>`:tab==='tunnel'?tunnelGuide():tab==='catalogue'?`<p class="library-intro">${items.length} animaties. Kies een groep en vergelijk de voorbeelden.</p>`:'';
    const tunnelUnavailable=tab==='tunnel'&&!canTunnel;
    const results=tab==='presets'?renderPresets():tunnelUnavailable?'':tab==='catalogue'?animationCategorySections(items,active?.key):animationCategoryFamilyList(items,tab,active?.key);
    // The tunnel guide already explains its requirements and provides the one
    // relevant action. Do not duplicate that status and CTA in a second card.
    const previewNote=tab==='presets'?'':'<p class="animation-preview-note">Voorbeelden bewegen versneld zodat je ze goed kunt vergelijken. Je verlichting verandert pas als je kiest.</p>';
    return `<section class="animation-library-inline" aria-label="Animatiegalerij">${intro}${previewNote}<div class="library-filter-block"><div class="library-filter-heading"><b>Soort animatie</b><small>Kies een groep om de varianten te bekijken</small></div><div class="filter-row" role="tablist" aria-label="Animatiecategorie">${tabs.map(key=>`<button role="tab" data-action="library" data-id="${key}" aria-selected="${tab===key}"><span>${libraryTabLabel(key)}</span><small aria-label="${counts[key]||0} animaties">${counts[key]||0}</small></button>`).join('')}</div></div>${tab!=='presets'&&!tunnelUnavailable?'<label class="animation-search"><span>Zoek in animaties</span><input type="search" id="animation-search" placeholder="Zoek een groep of beweging" autocomplete="off"></label>':''}<div id="animation-results">${results}</div></section>`;
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
  function renderLayout() {
    const type = zone().type, choices=[['stacked','Onder elkaar','Een ledline per rij.'],['vertical','Verticaal','Ledlines rechtop naast elkaar.']];
    if(type==='SPI')choices.push(['continuous','Doorlopend','Pixels vormen samen één lijn.']);
    return `<div class="editor-grid">${controlContext('layout')}<section class="editor-controls"><div><div class="section-heading"><h2>Hoe staan je ledlines?</h2></div>${type==='SPI'?'<p class="layout-demo-help">Zo kan licht door je opstelling bewegen. Je huidige kleur of animatie blijft behouden.</p>':''}<div class="layout-grid">${choices.map(([id,name,desc])=>`<button class="layout-choice ${type==='SPI'?'layout-choice-spi':''}" data-action="set-layout" data-id="${id}" aria-pressed="${zone().layout===id}">${type==='SPI'?spiLayoutPreview(id):`<span class="layout-art ${id}" aria-hidden="true"><i></i><i></i><i></i></span>`}<b>${name}</b><small>${desc}</small></button>`).join('')}</div></div><section class="layout-receiver-section"><h3>Volgorde van ledlines</h3>${receiverOrderMarkup()}<p class="order-help">${type==='RGBW'?'RGBW stuurt de hele ledline als één geheel aan.':'De preview gebruikt alle actieve pixels en de ingestelde aansluitzijde per uitgang.'}</p></section></section></div>`;
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
    return `<div class="receiver-management"><button class="button secondary" data-action="receiver-move" data-id="${esc(r.id)}">${icon('zones')}Zone wijzigen</button><small>Je koppeling, kleuren en aansluitingen blijven bewaard.</small></div>`;
  }
  function renderReceivers() {
    const all=standReceivers(),unassigned=all.filter(r=>!r.zoneId);
    const shown=receiverFilter==='unassigned'?unassigned:all,cards=shown.map(r=>receiverCard(r)).join('');
    return `<div class="page"><header class="page-heading"><div><div class="eyebrow">${esc(standLabel())}</div><h1>Receivers</h1><p>Je receivers en hun plek in de stand.</p></div></header><button class="button" data-action="receiver-add">＋ Receiver toevoegen</button><div class="receiver-filters" role="group" aria-label="Receivers filteren">${[['all','Alle receivers',all.length],['unassigned','Niet in een zone',unassigned.length]].map(([id,label,count])=>`<button data-action="receiver-filter" data-id="${id}" aria-pressed="${receiverFilter===id}">${label}<span>${count}</span></button>`).join('')}</div><div class="receiver-list">${cards||`<section class="card empty connection-empty"><h2>${receiverFilter==='unassigned'&&all.length?'Alles heeft een plek':'Nog geen receivers'}</h2><p>${receiverFilter==='unassigned'&&all.length?'Alle receivers zijn aan een zone toegewezen.':stand()?'Voeg je eerste receiver toe om deze stand te verlichten.':'Begin met een naam voor je stand en een zone. Daarna zoek je je eerste receiver.'}</p>${receiverFilter==='unassigned'?'<button class="button secondary" data-action="receiver-filter" data-id="all">Alle receivers bekijken</button>':''}</section>`}</div></div>`;
  }
  function renderReceiverAdd() {
    return '<div id="receiver-onboarding"></div>';
  }
  function renderScenes() {
    if(!stand())return `<div class="page"><header class="page-heading"><h1>Scènes</h1><p>Stel eerst je stand en verlichting in. Daarna kun je de gewenste sfeer bewaren.</p></header><button class="button full" data-action="receiver-add">Mijn stand instellen</button></div>`;
    const list=savedScenes.scenes.filter(s=>s.standId===stand().id);
    const ready=stand().zones.some(z=>M.zoneReceivers(model,z.id).length);
    return `<div class="page scenes-page"><header class="page-heading"><div><div class="eyebrow">${esc(standLabel())}</div><h1>Scènes</h1><p>Je ingestelde verlichting bewaren en later weer gebruiken.</p></div></header>${list.length?'':sceneWorkflow()}<button class="button red" data-action="scene-new" ${ready?'':'disabled'}>＋ Huidig licht bewaren</button>${savedScenes.error?`<p class="card" role="alert">${esc(savedScenes.error.message)}</p>`:''}<div class="section-heading scene-list-heading"><h2>Jouw scènes</h2><small>${list.length} ${list.length===1?'scène':'scènes'}</small></div><div class="scene-list">${list.map(scene=>{
      const count=scene.zones.reduce((n,z)=>n+z.receivers.length,0),names=scene.zones.slice(0,2).map(z=>z.name).join(' · '),extra=scene.zones.length-2;
      return `<button class="scene-card" data-action="scene-open" data-id="${esc(scene.id)}">${scenePreview(scene)}<span class="scene-card-copy"><b>${esc(scene.name)}</b><small class="scene-card-count">${zoneCount(scene.zones.length)} · ${receiverCount(count)}</small><small class="scene-card-names">${esc(names)}${extra>0?' …':''}</small><span class="scene-open-label">Bekijk ${zoneCount(scene.zones.length)} ${icon('chevron')}</span></span></button>`;
    }).join('')||`<section class="card empty">${icon('scenes')}<h2>Bewaar je eerste sfeer</h2><p>${ready?'Zijn je kleuren en animaties ingesteld? Kies Huidig licht bewaren en selecteer de zones die je wilt bewaren.':'Voeg eerst verlichting aan een zone toe via Stand. Daarna kun je een scène bewaren.'}</p></section>`}</div>${list.length?`<details class="scene-workflow-help"><summary>Hoe werkt dit?</summary>${sceneWorkflow()}</details>`:''}<p class="scene-reading-note">Bekijken en opslaan veranderen niets. Alleen ‘Scène activeren’ past de opgeslagen verlichting toe.</p></div>`;
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
  function standScenesMarkup(compact=false) {
    const list=savedScenes.scenes.filter(scene=>scene.standId===stand()?.id);
    if(compact){
      const summary=list.length?`${list.length} bewaarde ${list.length===1?'scène':'scènes'}`:'Bekijk en bewaar lichtinstellingen';
      return `<button class="stand-scenes-entry" data-action="stand-scenes"><span class="stand-scenes-entry-icon">${icon('scenes')}</span><span class="stand-scenes-entry-copy"><b>Scènes</b><small>${esc(summary)}</small></span><span class="stand-scenes-entry-open">Openen</span>${icon('chevron')}</button>`;
    }
    const shown=list.slice(0,4);
    const cards=shown.map(scene=>`<button class="stand-scene-card" data-action="scene-open" data-id="${esc(scene.id)}">${scenePreview(scene)}<span><b>${esc(scene.name)}</b><small>${zoneCount(scene.zones.length)} · ${receiverCount(scene.zones.reduce((count,item)=>count+item.receivers.length,0))}</small><i>Bekijken ${icon('chevron')}</i></span></button>`).join('');
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
    return `<div class="page scene-draft-page">${contextTitle('Sfeer bewaren','Bewaar het licht zoals het nu is ingesteld.','Scènes','scenes')}<label class="dialog-field scene-name-field">Geef je sfeer een naam<input id="scene-name" maxlength="64" value="${esc(sceneDraft.name)}" placeholder="Bijvoorbeeld: warm welkom"></label><section class="scene-zone-picker" aria-labelledby="scene-zone-picker-title"><div class="section-heading"><h2 id="scene-zone-picker-title">Welke zones wil je bewaren?</h2></div><div class="scene-bulk-actions"><button class="text-button" data-action="scene-select-all">Alle zones kiezen</button><button class="text-button" data-action="scene-clear-selection">Selectie wissen</button></div>${sceneSearch('draft',stand().zones.length)}<div class="scene-zone-list">${stand().zones.map(z=>{
      const count=M.zoneReceivers(model,z.id).length;
      return `<button class="scene-zone" data-action="scene-zone" data-id="${esc(z.id)}" data-scene-filter-name="${esc(z.name+' '+(z.type||''))}" aria-pressed="${sceneDraft.zoneIds.includes(z.id)}" ${count?'':'disabled'}>${count?zonePreview(z,'scene-preview',{label:`Huidig licht · ${z.name} · ${z.type}`}):`<span class="scene-preview scene-preview-unavailable">${icon('zones')}</span>`}<span><b>${esc(z.name)}</b><small>${count?`${receiverCount(count)} · ${z.type}`:'Nog geen verlichting'}</small></span><i aria-hidden="true">${sceneDraft.zoneIds.includes(z.id)?'✓':'+'}</i></button>`;
    }).join('')}</div><p class="scene-search-empty card" hidden>Geen zones gevonden. Pas je zoekopdracht aan; je selectie blijft bewaard.</p></section><div class="scene-save-bar"><p data-scene-selection-summary role="status" aria-live="polite"></p><p class="scene-save-error" data-scene-save-error role="alert" hidden></p><button class="button red full" data-action="scene-save" disabled>Scène opslaan</button><small>Opslaan verandert je verlichting niet.</small></div><button class="button secondary full" data-action="scenes">Annuleren</button></div>`;
  }
  function renderSceneDetail() {
    if(!stand())return renderScenes();
    const scene=savedScenes.scenes.find(s=>s.id===route.sceneId&&s.standId===stand().id);if(!scene)return renderScenes();
    const check=Scenes.compatibility(model,scene),zones=Scenes.previewZones(model,scene),count=zones.reduce((n,z)=>n+z.receiverCount,0);
    return `<div class="page scene-detail-page">${contextTitle(scene.name,'Opgeslagen scène · bekijken verandert niets.','Scènes','scenes')}<div class="scene-scope-summary"><span>${icon('zones')}<b>${zoneCount(zones.length)}</b></span><span>${icon('receiver')}<b>${receiverCount(count)}</b></span></div><section class="scene-detail"><div class="section-heading"><h2>Zones in deze scène</h2><small>Opgeslagen licht</small></div>${check.ok?'':`<p class="card scene-zone-warning" role="alert">${esc(check.reason)} Er wordt niets gedeeltelijk geactiveerd.</p>`}${sceneSearch('detail',zones.length)}<div class="scene-saved-zones">${zones.map((z,i)=>`<article class="scene-saved-zone" data-scene-zone="${esc(z.id)}" data-scene-zone-type="${z.type}" data-scene-filter-name="${esc(z.name+' '+z.type)}"><header><span class="scene-zone-number">${i+1}</span><div><h3>${esc(z.name)}</h3><small>${z.type} · ${receiverCount(z.receiverCount)}</small></div></header>${savedZonePreview(z)}${z.available?'':`<p class="scene-zone-warning">${esc(z.reason)}</p>`}</article>`).join('')}</div><p class="scene-search-empty card" hidden>Geen zones gevonden. Pas je zoekopdracht aan om je opgeslagen zones te zien.</p></section><div class="scene-save-bar scene-activate-bar"><p>${zoneCount(zones.length)} · samen toepassen</p><button class="button full" data-action="scene-apply" data-id="${esc(scene.id)}" ${check.ok?'':'disabled'}>Scène activeren</button><small>Andere zones blijven ongewijzigd.</small></div><button class="button secondary" data-action="scene-delete" data-id="${esc(scene.id)}">Scène verwijderen</button></div>`;
  }
  function renderPinLogin() {
    if(!pinRequired())return renderSettings();
    // Keep the requested entry visible, but do not collect a secret or reuse
    // new-receiver commissioning as login. Existing-installation SRP, trusted
    // import and atomic restore are not connected to the V30 native bridge yet.
    return `<div class="page pin-login-page">${contextTitle('Inloggen met PIN','Je bestaande installatie openen','Instellingen','settings')}<section class="card pin-login-status" aria-labelledby="pin-login-status-title"><span class="menu-icon" aria-hidden="true">${icon('lock')}</span><h2 id="pin-login-status-title" data-pin-login-status>Nog niet beschikbaar in deze versie</h2><p>Veilig inloggen en je bewaarde installatie terughalen worden nog aangesloten. Je kunt hier daarom nog geen PIN invoeren.</p><p>Je huidige stand en receivers blijven ongewijzigd.</p></section><section class="card pin-login-guide"><h2>Waarvoor is deze optie?</h2><p>Je bestaande stand weer openen op een ander toestel of nadat je de app opnieuw hebt geïnstalleerd. Je gebruikt dan je bestaande installatie-PIN; je maakt geen nieuwe PIN of nieuwe stand aan.</p><ol><li><b>Verbind met het wifi van je installatie</b><span>Kies het ALUVISION-netwerk via de wifi-instellingen van je telefoon.</span></li><li><b>Open je installatie met je PIN</b><span>Zodra deze functie beschikbaar is, wordt je PIN veilig gecontroleerd voordat je bewaarde installatie wordt teruggehaald.</span></li></ol></section><button class="button full" data-action="settings">Terug naar Instellingen</button></div>`;
  }
  function pinProtectionCard() {
    const selected=securityStand(),current=pinProtection?.standId===selected?.id?pinProtection:null;
    const available=nativeContext&&typeof runtime?.services?.securityStatus==='function'&&typeof runtime?.services?.setPinProtection==='function';
    const ready=!!current&&!pinProtectionLoading&&!pinProtectionBusy&&!pinProtectionReconnect&&!pinProtectionError;
    const message=!nativeContext?'Beschikbaar in de iPhone-app.':!selected?'Geef je stand eerst een naam.':pinProtectionLoading?'Beveiliging controleren…':pinProtectionError||(pinProtectionReconnect?'Verbind opnieuw met het wifi van je installatie.':!available?'De verbindingsdienst is niet beschikbaar.':current?.scope==='new-installation'?'Kies een PIN tijdens het instellen van je stand.':'Eén PIN voor wifi en netwerk verwijderen.');
    return `<section class="card pin-protection-card" data-pin-protection><div class="pin-protection-heading"><span class="menu-icon" aria-hidden="true">${icon('lock')}</span><div><h2>PIN-beveiliging</h2><small>Tijdelijke testinstelling</small></div><button class="switch" role="switch" aria-label="PIN-beveiliging" aria-checked="${current?.pinRequired===true}" data-action="pin-protection-toggle" ${ready?'':'disabled'}><span>${current?current.pinRequired?'Aan':'Uit':'—'}</span><i aria-hidden="true"></i></button></div><p data-pin-protection-status role="status">${esc(message)}</p>${pinProtectionReconnect?'<button class="text-button" data-action="pin-protection-reconnect">Opnieuw verbinden</button>':pinProtectionError&&available&&selected?'<button class="text-button" data-action="pin-protection-refresh">Opnieuw controleren</button>':''}</section>`;
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
    return `<div class="page demo-wifi-page"><header class="page-heading"><div><h1>Wifi-instellingen</h1><p>${esc(t('settings'))} · V31</p></div></header>${demoSettingsTabs(true)}<section class="card demo-wifi-notice" aria-labelledby="demo-wifi-title"><span class="pill red">DEMO · niet verbonden</span><h2 id="demo-wifi-title">Alleen een voorbeeld</h2><p>Hier bekijk je de wifi-instellingen. Deze demo zoekt geen echte netwerken, maakt geen verbinding en bewaart geen wifi-wachtwoorden.</p></section><section class="card demo-wifi-network"><div class="demo-wifi-heading"><span class="menu-icon" aria-hidden="true">${icon('wifi')}</span><div><h2>Wifi van je installatie</h2><p>Je telefoon bedient de verlichting via dit netwerk.</p></div></div><dl class="demo-wifi-details"><div><dt>Netwerk</dt><dd>Aluvision-DEMO</dd></div><div><dt>Status</dt><dd>Voorbeeld · geen echte verbinding</dd></div></dl><button class="button full" disabled aria-describedby="demo-wifi-disabled">Verbinding controleren</button><p id="demo-wifi-disabled" class="demo-wifi-caption">Alleen beschikbaar met een echte receiver in de iPhone-app.</p></section><section class="card demo-wifi-guide"><h2>Verbinden in de echte app</h2><ol><li>Open <b>Instellingen → Wifi</b> op je iPhone.</li><li>Kies het ALUVISION-wifi van je installatie.</li><li>Ga terug naar de app om je verlichting te bedienen.</li></ol><p>Je hoeft voor deze demo niets aan je wifi te veranderen.</p></section></div>`;
  }
  function renderSettings() {
    return `<div class="page"><header class="page-heading"><div><h1>${esc(t('more'))}</h1><p>${esc(t('settings'))} · V31</p></div></header><section class="card"><h2>${esc(t('appearance'))}</h2><h3 class="preference-label">${esc(t('language'))}</h3><div class="preference-grid">${Preferences.languages.map(language=>`<button data-action="language" data-id="${language.code}" lang="${language.code}" aria-pressed="${uiPreferences.preferences.language===language.code}">${language.name}</button>`).join('')}</div><p class="preference-note">${esc(t('wipNotice'))}</p><h3 class="preference-label">${esc(t('theme'))}</h3><div class="preference-grid">${['light','dark'].map(theme=>`<button data-action="theme" data-id="${theme}" aria-pressed="${uiPreferences.preferences.theme===theme}">${esc(t(theme))}</button>`).join('')}</div>${uiPreferences.error?`<p role="alert">${esc(uiPreferences.error.message)}</p>`:''}</section><button class="menu-card" data-action="help"><span class="menu-icon">${icon('info')}</span><div><b>Stand en zones uitgelegd</b><small>Een eenvoudige weg naar je verlichting</small></div>${icon('chevron')}</button><section class="card connection-info" id="connection-info"><span class="pill">Niet verbonden</span><h2>Verbinding en gegevens</h2><p>Je bekijkt momenteel een voorbeeldstand met fictieve receivers. Er worden geen opdrachten naar echte verlichting verstuurd.</p><p>Indeling, poorten en lichtstanden zijn tijdelijk en beginnen na herladen opnieuw. Kleurpresets, animatiepresets, scènes en voorkeuren worden alleen op dit apparaat bewaard.</p><details class="technical-status"><summary>Technische gereedheid</summary><ul class="readiness-list"><li><b>Dezelfde bediening</b><span>Alle schermformaten volgen dezelfde compacte bediening voor zones, receivers, kleuren en animaties.</span></li><li><b>Nog aansluiten en fysiek testen</b><span>${pinRequired()?'Echte koppeling, beveiliging, ESP-NOW, herstel, veilig verwijderen en OTA moeten nog fysiek worden getest.':'Deze demo werkt zonder toegangscode. ESP-NOW, veilig verwijderen en OTA moeten nog fysiek worden getest.'} De app en receiver moeten bij elkaar passende software gebruiken.</span></li><li><b>Receiverbeelden</b><span>RGBW volgt de aangeleverde productreferentie. Het SPI-beeld is een concept; fysieke poortplaatsing moet nog worden bevestigd.</span></li><li><b>Bestaande functies behouden</b><span>Volledige vertalingen, Academy en overige bestaande beheerfuncties blijven in de overdrachtscontrole staan.${pinRequired()?' De bestaande beveiliging blijft behouden.':''}</span></li></ul></details></section></div>`;
  }
  function render({top=false,preserveScroll=true}={}) {
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
    const animationEditorOpen=route.screen==='animations'||(route.screen==='controls'&&controlMode==='animations'&&!showControlAnimationGallery);
    const visibleEffect=animationEditorOpen?activeEffect():null;
    if(visibleEffect?.controls.includes('smooth')&&selected().some(receiver=>Number(receiver.state.smooth)!==100))apply({smooth:100});
    // No empty animation landing page. This also covers switching from an
    // animated receiver to a static one while its editor is already open.
    if(route.screen==='animations'&&zone()&&receivers().length&&!activeEffect()){
      route={...route,screen:'effects',family:null,library:initialAnimationLibrary(),effectsReturn:'controls'};top=true;
    }
    const focused=document.activeElement,focusKey=focused?.dataset?.id;
    previews.clear();
    const views = {stand:renderStand,controls:renderControls,colour:renderColour,animations:renderAnimations,effects:renderEffects,layout:renderLayout,receivers:renderReceivers,settings:renderSettings,'demo-wifi':renderDemoWifi,'pin-login':renderPinLogin,scenes:renderScenes,'scene-draft':renderSceneDraft,'scene-detail':renderSceneDetail,'receiver-add':renderReceiverAdd};
    const zoneScreen=['controls','colour','animations','effects','layout'].includes(route.screen);
    main.innerHTML = (zoneScreen&&zone()&&!receivers().length?renderEmptyZone:(views[route.screen] || renderStand))();
    const previewDock=main.querySelector('.control-preview-dock');
    if(previewDock){previewDock.dataset.previewSize=controlPreviewSize;previewDock.querySelector('.preview-top')?.insertAdjacentHTML('afterend',previewSizePickerMarkup());}
    main.classList.toggle('gallery-scroll-stable',Boolean(main.querySelector('#animation-results')));
    if(route.screen==='scene-detail')main.querySelector('.scene-activate-bar')?.insertAdjacentHTML('afterbegin','<p class="live-confirmation" data-live-status="scene" role="status" aria-live="polite"></p>');
    if(route.screen==='settings')main.querySelector('.page-heading')?.insertAdjacentHTML('afterend',pinProtectionCard());
    if(pinRequired()&&route.screen==='settings')main.querySelector('[data-action="help"]')?.insertAdjacentHTML('afterend',
      `<button class="menu-card pin-login-entry" data-action="pin-login"><span class="menu-icon">${icon('lock')}</span><div><b>Inloggen met PIN</b><small>Je bestaande installatie openen</small><small class="pin-login-availability">Nog niet beschikbaar</small></div>${icon('chevron')}</button>`);
    if(route.screen==='settings')main.querySelector('[data-action="help"]')?.insertAdjacentHTML('afterend',`<button class="menu-card" data-action="preferences-reset"><span class="menu-icon">${icon('settings')}</span><div><b>Taal en thema herstellen</b><small>Alleen taal en thema van deze app</small></div>${icon('chevron')}</button>`);
    if(route.screen==='settings')main.querySelector('#connection-info')?.insertAdjacentHTML('afterend',`<section class="card app-erase-section"><h2>Gegevens op deze telefoon</h2><p>Dit verwijdert alleen de gegevens in de app. De fysieke receivers blijven gekoppeld en zijn daarna mogelijk pas na een afzonderlijke reset en nieuwe koppeling weer bedienbaar.</p><button class="button secondary full" data-action="app-erase">Verwijder alles uit de app</button></section>`);
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
      const info=main.querySelector('#connection-info'),paragraphs=info?.querySelectorAll(':scope > p');
      if(paragraphs?.[0])paragraphs[0].textContent='Dit is alleen een interactieve demo. Alle gevonden receivers zijn fictief; niets wordt gekoppeld of naar echte verlichting gestuurd.';
      if(paragraphs?.[1])paragraphs[1].textContent='Je demostand, zones, receivers en instellingen verdwijnen bij herladen. Gegevens van de gewone site en je iPhone blijven onaangeroerd.';
      const readiness=info?.querySelectorAll('.readiness-list li')[1];
      if(readiness){readiness.querySelector('b').textContent='Alleen een koppeloefening';readiness.querySelector('span').textContent='Zoeken, knipperen en toevoegen zijn op deze demopagina nagebootst. Echte wifi, ESP-NOW, LED-reacties en OTA test je later met de iPhone en fysieke receivers.';}
      const erase=main.querySelector('.app-erase-section');
      if(erase)erase.querySelector('p').textContent='Alleen deze tijdelijke demopagina wordt leeg gemaakt. Echte receivers en gegevens op de gewone site blijven onaangeroerd.';
    }else if(nativeContext&&route.screen==='settings'){
      const info=main.querySelector('#connection-info'),paragraphs=info?.querySelectorAll(':scope > p');
      if(paragraphs?.[0])paragraphs[0].textContent=runtime?.native===true?'Deze V31-versie gebruikt de iPhone-verbindingsdienst. Kies voorlopig zelf het receiver-wifinetwerk in Instellingen → Wifi en keer daarna terug. Alleen zoeken voegt niets toe.':'De iPhone-verbindingsdienst is niet beschikbaar. Er worden geen receiveropdrachten verstuurd.';
      if(paragraphs?.[1])paragraphs[1].textContent=pinRequired()?'Je stand en instellingen worden lokaal bewaard. Een receiver verschijnt pas na beveiligde bevestiging. Een back-up via je PIN is een aparte functie en is nog niet aangesloten; er wordt niets uit een bestaande installatie overgenomen of gewist.':'Je stand en instellingen worden lokaal bewaard. Een receiver verschijnt pas nadat de toevoeging is bevestigd. Deze versie vraagt geen toegangscode; er wordt niets uit een bestaande installatie overgenomen of gewist.';
      const readiness=info?.querySelectorAll('.readiness-list li')[1];
      if(readiness){readiness.querySelector('b').textContent=runtime?.native===true?'Zoeken beschikbaar · receiverbeheer ingebouwd':'Verbindingsdienst niet beschikbaar';readiness.querySelector('span').textContent=runtime?.native===true?(pinRequired()?'Receiver koppelen, hervatten, draadloos bijwerken en verwijderen zijn aangesloten op de app. Je telefoon moet verbonden zijn met het ALUVISION-wifi van je installatie. Fysieke acceptatie moet nog gebeuren. Een softwaretest is geen fysieke verbindingstest.':'Receiver koppelen en hervatten gebruiken de iPhone-verbindingsdienst. PIN-beveiliging staat tijdelijk uit; je kunt haar hierboven aanzetten. Het verwijderen van receivers verloopt via de beveiligde app-verbinding. Fysieke acceptatie van koppeling, ESP-NOW en reset moet nog gebeuren; een softwaretest is geen fysieke verbindingstest.'):'Deze app laadt geen voorbeeldreceivers als de verbindingsdienst ontbreekt. Er worden geen receiveropdrachten uitgevoerd; de bestaande installatie blijft intact.';}
    }else if(!previewContext&&route.screen==='settings'){
      const info=main.querySelector('#connection-info'),paragraphs=info?.querySelectorAll(':scope > p');
      if(paragraphs?.[0])paragraphs[0].textContent='Je opent dezelfde interface als op de iPhone. Er is geen receiververbinding actief en er zijn geen voorbeeldreceivers toegevoegd.';
      const readiness=info?.querySelectorAll('.readiness-list li')[1];
      if(readiness){readiness.querySelector('b').textContent='Verbindingsdienst niet beschikbaar';readiness.querySelector('span').textContent=`Er worden geen receiveropdrachten verstuurd en geen koppelingen nagebootst. Bestaande installaties${pinRequired()?' en toegangscodes':''} op je receivers blijven intact.`;}
    }
    main.querySelectorAll('[data-receiver-detail]').forEach(card=>{
      const r=model.receivers.find(receiver=>receiver.id===card.dataset.receiverDetail);
      if(r.type==='SPI'&&!r.outputs.some(output=>output.enabled))card.querySelector('[data-action="visual-identify"]').disabled=true;
      card.querySelector('summary small').insertAdjacentHTML('afterend',`<small class="receiver-status">${statusText(r)}</small>`);
      card.querySelector('.receiver-manage-content').insertAdjacentHTML('beforeend',`<section class="receiver-service-section" aria-label="Receiver en software"><h3>Software</h3><p>Bekijk en installeer beschikbare updates voor deze receiver.</p><button class="button secondary full" data-action="receiver-update" data-id="${esc(r.id)}">Softwareversie en updates</button></section>`);
      card.querySelector('.receiver-manage-content').insertAdjacentHTML('beforeend',`<section class="receiver-danger-section" aria-label="Receiver verwijderen"><h3>${r.role==='main'?'Alle receivers ontkoppelen':'Deze receiver ontkoppelen'}</h3><p>${r.role==='main'?'Hiermee verwijder je het volledige receivernetwerk.':'Hiermee verwijder je alleen deze receiver uit het netwerk.'}</p><button class="button secondary full" data-action="receiver-remove" data-id="${esc(r.id)}">${r.role==='main'?'Alle receivers ontkoppelen':'Deze receiver ontkoppelen'}</button></section>`);
    });
    if(zoneScreen&&zone()?.type===null)main.querySelector('.page-heading .pill')?.remove();
    if(route.screen==='layout'&&receivers().length){
      main.querySelector('.editor-controls').insertAdjacentHTML('afterbegin',layoutReceiverActions());
      main.querySelector('.editor-controls').insertAdjacentHTML('beforeend',`<div class="zone-management-actions"><button class="text-button" data-action="zone-rename" data-id="${esc(zone().id)}">Naam van deze zone wijzigen</button>${zoneDeleteButton(zone())}</div>`);
    }
    document.documentElement.lang=uiPreferences.preferences.language;
    document.body.dataset.theme=uiPreferences.preferences.theme;
    document.querySelector('meta[name="theme-color"]').content=uiPreferences.preferences.theme==='dark'?'#171817':'#f8f8f5';
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
    if(top){window.scrollTo({top:0,left:0,behavior:'instant'});main.focus({preventScroll:true});}
    else {
      if(preserveScroll)window.scrollTo({top:savedScroll,left:0,behavior:'instant'});
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
  function navigate(screen, extra={}) {
    if(screen!==route.screen)visualPlugMotions.clear();
    if(!pinRequired()&&screen==='pin-login')screen='settings';
    if(screen==='receiver-add'&&route.screen!=='receiver-add')extra={setupFrom:!stand()||!standReceivers().some(receiver=>receiver.role==='main')||route.screen!=='receivers'?'stand':'receivers',setupReturnZoneId:null,...extra};
    if(route.screen==='receiver-add')onboarding.suspend();route = {...route,screen,...extra}; render({top:true});
    if(screen==='settings')void refreshPinProtection();
  }
  function resetMarkup(key,label) { return `<button class="setting-reset" data-action="setting-reset" data-id="${key}" aria-label="${esc(label)} terug naar standaard" ${settingChanged(key)?'':'hidden'}>↺ Standaard</button>`; }
  function translateMainControls() {
    // Only known UI controls: never walk and replace arbitrary text or names.
    const titles={colour:'staticColour',animations:'animations',scenes:'scenes','scene-draft':'saveScene',receivers:'receivers',settings:'more','receiver-add':'addReceiver'};
    if(titles[route.screen]&&main.querySelector('h1'))main.querySelector('h1').textContent=t(titles[route.screen]);
    const actions={'scene-new':'newScene','scene-save':'saveScene','receiver-add':'addReceiver'};
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
  function liveRequest(receiver) {
    const targetZone=model.stands.find(item=>item.id===receiver.standId)?.zones.find(item=>item.id===receiver.zoneId);
    return window.LightningLiveControl?.requestFor?.(receiver,{zone:targetZone,receivers:targetZone?M.zoneReceivers(model,targetZone.id):[receiver]})||null;
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
  function sendReceiverStates(ids){
    for(const id of ids){
      const receiver=model.receivers.find(item=>item.id===id);if(!receiver)continue;
      const request=liveRequest(receiver);
      if(nativeLoaded&&liveController&&request)liveController.request(request);
      else if(liveController)liveController.preview(id);
      else liveStates.set(id,{kind:'preview'});
    }
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
    sendReceiverStates(targets.map(item=>item.id));
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
    const ids=standControlOpen?standReceivers().map(receiver=>receiver.id):selectedReceiverIds(scope);
    if(activeEffect()?.controls.includes('smooth'))patch={...patch,smooth:100};
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
  function pickerChannels(root) { return root?.dataset.colourPicker==='background'?backgroundChannels():effectiveColourChannels(root?.dataset.colourPicker==='animation'?Number(root.dataset.slot):0); }
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
      const zoneList=spec.zoneId?M.zoneReceivers(model,spec.zoneId):null;
      const list=zoneList?(spec.visibleReceiverIds?zoneList.filter(receiver=>spec.visibleReceiverIds.includes(receiver.id)):zoneList):spec.brand?spec.receivers.map(r=>({...r,state:{...r.state,brandColor:brandColours.get(route.zoneId)||r.state.brandColor}})):spec.receivers;
      P.draw(canvas,{...spec,receivers:list,selection:spec.main?selection():spec.selection,
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
  }
  function closeEffectDialog() { if(pinProtectionBusy)return;const wasStand=standControlOpen;dialogHeaderObserver?.disconnect();document.getElementById('effect-dialog').close();document.querySelectorAll('#effect-dialog canvas[data-preview]').forEach(canvas=>previews.delete(canvas.dataset.preview));document.getElementById('effect-dialog-content').replaceChildren();standControlOpen=false;zoneDeletion=null;if(wasStand)render();restoreControlFocus(dialogReturnFocus);dialogReturnFocus=null; }
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
    showEffectDialog(`Kleur ${index+1} aanpassen`,`${dialogAnimationPreview()}${colourPickerMarkup(index)}`);
    paintWheel();syncColour();
  }
  function dialogAnimationPreview(){return `<div class="preview-wrap dialog-live-preview"><div class="preview-top">Live LED-voorbeeld</div>${zonePreview(zone(),'',{main:true,label:'Live voorbeeld met jouw animatiekleuren'})}</div>`;}
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
    showEffectDialog('Animatie bewaren',`<p>${esc(Library.displayName(effect))} · alle gekozen kleuren en instellingen worden bewaard in Mijn animaties. Je kiest later zelf op welke ledlines de animatie komt.</p><label class="dialog-field">Naam van je animatie<input id="preset-name" type="text" maxlength="64" placeholder="Bijvoorbeeld: zacht welkom" autocomplete="off"></label><p class="dialog-error" role="alert" hidden></p><button class="button full" data-action="preset-confirm" disabled>Animatie bewaren</button>`);
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
    showEffectDialog('Zone wijzigen',`<p><b>${esc(r.name)}</b> · ${esc(r.type)} · nu ${r.zoneId?`in ${esc(M.getZone(model,r.zoneId).name)}`:'nog niet aan een zone toegewezen'}. De koppeling en lichtinstellingen blijven bewaard.</p><div class="assignment-choices" aria-label="Zone kiezen">${stand().zones.map(z=>{
      const compatible=!z.type||z.type===r.type,chosen=z.id===receiverAssignment.zoneId;
      return `<button class="assignment-choice" data-action="assignment-zone" data-id="${esc(z.id)}" aria-pressed="${chosen}" ${compatible?'':'disabled'}>${icon('zones')}<span><b>${esc(z.name)}</b><small>${z.id===r.zoneId?'Huidige zone':compatible?`${zoneTypeLabel(z)}${z.type?` · ${receiverCount(z.receiverIds.length)}`:''}`:`Alleen ${z.type} · past niet bij deze receiver`}</small></span><i aria-hidden="true">${chosen?'✓':''}</i></button>`;
    }).join('')}<button class="assignment-choice" data-action="assignment-zone" data-id="" aria-pressed="${!receiverAssignment.zoneId}">${icon('receiver')}<span><b>Nog geen zone</b><small>Blijft gekoppeld aan je stand</small></span><i aria-hidden="true">${!receiverAssignment.zoneId?'✓':''}</i></button></div><button class="button secondary full" data-action="assignment-new-zone">＋ Nieuwe zone maken</button><p class="dialog-error" role="alert" hidden></p><button class="button full" data-action="assignment-confirm" ${receiverAssignment.zoneId===r.zoneId?'disabled':''}>Zone wijzigen</button>`);
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
    showEffectDialog('Ledlines toewijzen',`<section class="assignment-many" data-assignment-many><p class="assignment-many-destination">Naar <b>${esc(z.name)}</b></p><p class="assignment-many-note">Ledlines uit een andere zone worden verplaatst. Hun instellingen blijven bewaard.</p>${familyChoices}${list}<p class="assignment-many-summary" data-assignment-many-summary role="status">${count?`${ledlineCount(count)} gekozen`:'Kies één of meer ledlines.'}</p><button class="button full" data-action="assignment-many-confirm" ${count?'':'disabled'}>${count?`${ledlineCount(count)} toewijzen`:'Ledlines toewijzen'}</button><button class="button secondary full" data-action="assignment-add-receiver">＋ Nieuwe ledline zoeken</button></section>`);
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
    model=next;selections.delete(zoneId);brandColours.delete(zoneId);
    if(sceneDraft)sceneDraft.zoneIds=sceneDraft.zoneIds.filter(id=>id!==zoneId);
    receiverAssignment=null;nameDialog=null;closeEffectDialog();
    if(count){receiverFilter='unassigned';navigate('receivers',{zoneId:null});}
    else navigate('stand',{zoneId:null});
    toast(count?`Zone verwijderd. ${count} ${count===1?'receiver staat':'receivers staan'} bij Niet in een zone.`:'Zone verwijderd.');
  }
  function keepLocalPreviewStates(stored) {
    const next=copy(M.assertValid(stored)),previous=new Map(model.receivers.map(r=>[r.id,r]));
    for(const r of next.receivers){
      const old=previous.get(r.id);
      if(old&&typeof r.rid==='string'&&r.rid&&typeof r.deviceFingerprint==='string'&&r.deviceFingerprint&&
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
      model=next;retainSetupSelections();zoneDeletion=null;receiverAssignment=null;nameDialog=null;
      if(request.kind==='delete'){
        brandColours.delete(request.zoneId);
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
    const progress=document.createElement('p');progress.className='management-status';progress.setAttribute('role','status');progress.textContent='Wijziging opslaan…';host.prepend(progress);host.setAttribute('aria-busy','true');
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
        model=keepLocalPreviewStates(error.reconciledView.model);selections.clear();zoneDeletion=null;receiverAssignment=null;nameDialog=null;
        closeEffectDialog();navigate('stand',{zoneId:null});toast(message);
      }else{
        const notice=document.querySelector('#effect-dialog[open] .dialog-error');
        if(notice){notice.textContent=message;notice.hidden=false;}else toast(message);
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
    model=next;closeEffectDialog();receiverAssignment=null;nameDialog=null;render();
    openIds.forEach(id=>{const detail=main.querySelector(`[data-receiver-detail="${CSS.escape(id)}"]`);if(detail)detail.open=true;});
    toast(message);return true;
  }
  async function moveReceiver(id,toIndex) {
    const receiver=receivers().find(r=>r.id===id);if(!receiver)return;
    if(receivers().findIndex(r=>r.id===id)===toIndex)return;
    const keyboardMove=document.activeElement?.classList.contains('order-handle')&&document.activeElement.closest('[data-receiver-detail]')?.dataset.receiverDetail===id;
    const next=M.moveReceiver(model,route.zoneId,id,toIndex),saved=await persistManagement(next,{kind:'reorder',zoneId:route.zoneId,receiverIds:M.getZone(next,route.zoneId).receiverIds});
    if(!saved)return;model=saved;
    if(nativeContext)sendReceiverStates(M.zoneReceivers(model,route.zoneId).map(item=>item.id));
    render();
    if(keyboardMove)main.querySelector(`[data-receiver-detail="${CSS.escape(id)}"] .order-handle`)?.focus({preventScroll:true});
    const status=document.querySelector('.order-status');if(status)status.textContent=`${receiver.name} staat nu op plaats ${toIndex+1}.`;
  }
  document.getElementById('effect-dialog').addEventListener('cancel',event=>{event.preventDefault();if(!managementBusy)closeEffectDialog();});
  main.addEventListener('click',event=>{
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
    if(managementBusy||pinProtectionBusy)return;
    const action=button.dataset.action,id=button.dataset.id;
    try {
      if(action==='preview-size'){
        if(!['small','medium','large'].includes(id)||controlPreviewSize===id)return;
        controlPreviewSize=id;return render({preserveScroll:true});
      }
      if(action==='nav')return navigate(id);
      if(action==='demo-settings-tab'&&webDemoContext)return navigate(id==='wifi'?'demo-wifi':'settings');
      if(action==='pin-protection-toggle')return openPinProtection();
      if(action==='pin-protection-refresh')return refreshPinProtection();
      if(action==='pin-protection-reconnect'&&pinProtectionReconnect)return showPinReconnect(pinProtectionReconnect);
      if(action==='pin-protection-recheck')return refreshPinProtection({afterReconnect:true});
      if(action==='pin-protection-save')return savePinProtection(button);
      if(action==='live-retry'){sendReceiverStates(liveTargets(button.dataset.scope).filter(receiver=>liveStates.get(receiver.id)?.kind==='failed').map(receiver=>receiver.id));return;}
      if(action==='connection-status'){navigate('settings');document.getElementById('connection-info')?.scrollIntoView({block:'start',behavior:'instant'});return;}
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
          selections.clear();brandColours.clear();visualPorts.clear();visualPlugMotions.clear();identifying.clear();expandedReceivers.clear();expandedConnections.clear();
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
      if(action==='receiver-update'){const receiver=model.receivers.find(r=>r.id===id);if(receiver)return receiverUpdates.open(receiver);return;}
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
        return navigate('receiver-add',{zoneId:target.id,setupReturnZoneId:target.id});
      }
      if(action==='assignment-add-receiver'){receiverAssignment=null;closeEffectDialog();return navigate('receiver-add',route.screen==='layout'?{setupReturnZoneId:route.zoneId}:{});}
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
      if(action==='colour'&&route.screen==='controls'){controlMode='colour';return render({top:true});}
      if(action==='animation-gallery'&&route.screen==='controls'&&activeEffect()){
        controlMode='animations';showControlAnimationGallery=true;return render({top:true});
      }
      if(action==='animations'&&route.screen==='controls'){
        controlMode='animations';showControlAnimationGallery=!activeEffect();route={...route,family:null,library:initialAnimationLibrary(),effectsReturn:'controls'};return render({top:true});
      }
      if(action==='animation-current-edit'&&route.screen==='controls'&&activeEffect()){
        showControlAnimationGallery=false;return render({preserveScroll:true});
      }
      if(action==='animations-gallery'&&route.screen==='animations'&&activeEffect()){
        controlMode='animations';showControlAnimationGallery=true;
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
      if(action==='swatch'){
        if(colourOrderMode)return;
        const root=button.closest('[data-colour-picker]'),entry=savedColours.colors.find(c=>c.id===id);if(!entry)return;
        if(['animation','background'].includes(root?.dataset.colourPicker))writePicker(root,[entry.color.r,entry.color.g,entry.color.b],entry.color.w);
        else {apply({...Colours.restore(entry),rgbwLast:rememberedChannels(root,[entry.color.r,entry.color.g,entry.color.b],entry.color.w)});syncColour();const slider=document.querySelector('[data-setting="bri"]'),out=document.querySelector('[data-value-for="bri"]');if(slider)slider.value=entry.color.bri;if(out)out.textContent=entry.color.bri+'%';}return;
      }
      if(action==='colour-new')return saveCurrentColour(button);
      if(action==='colours-manager'){savedColours=colourStore.load();return showColourManager();}
      if(action==='colours-manage'){colourOrderMode=!colourOrderMode;return refreshColourLibraries(button);}
      if(action==='colour-remove'){
        const current=colourStore.load();if(current.error)return refreshColourLibraries(button,current.error.message);
        const index=current.colors.findIndex(entry=>entry.id===id);if(index<0)return;
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
      if(action==='scene-new'){if(!stand())return;sceneDraft={zoneIds:[],name:'',search:''};return navigate('scene-draft');}
      if(action==='scene-zone'){
        if(!sceneDraft||!stand()?.zones.some(z=>z.id===id)||!M.zoneReceivers(model,id).length)return;
        sceneDraft.zoneIds=sceneDraft.zoneIds.includes(id)?sceneDraft.zoneIds.filter(z=>z!==id):[...sceneDraft.zoneIds,id];return syncSceneDraft();
      }
      if(action==='scene-select-all'||action==='scene-clear-selection'){
        if(!sceneDraft||!stand())return;sceneDraft.zoneIds=action==='scene-select-all'?stand().zones.filter(z=>M.zoneReceivers(model,z.id).length).map(z=>z.id):[];return syncSceneDraft();
      }
      if(action==='scene-save'){
        if(!sceneDraft||!stand())return;
        const scene=Scenes.capture(model,stand().id,sceneDraft.zoneIds,sceneDraft.name),result=sceneStore.save(scene);if(result.error){sceneDraft.error='Opslaan is niet gelukt. Je naam en gekozen zones blijven bewaard. Probeer opnieuw.';syncSceneDraft();return toast(result.error.message);}
        savedScenes=result;sceneDraft=null;navigate('scenes');toast('Scène opgeslagen. Je verlichting is niet veranderd.');return;
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
      if(action==='scene-apply'){const scene=savedScenes.scenes.find(s=>s.id===id&&s.standId===stand().id);if(!scene)return;model=Scenes.apply(model,scene);sendReceiverStates(scene.zones.flatMap(item=>item.receivers.map(receiver=>receiver.id)));render();toast(nativeContext?'Scène wordt naar de geselecteerde ledlines verstuurd.':'Scène geactiveerd in het voorbeeld.');return;}
      if(action==='scene-delete'){const scene=savedScenes.scenes.find(s=>s.id===id&&s.standId===stand().id);if(!scene)return;showEffectDialog('Scène verwijderen?',`<p>“${esc(scene.name)}” wordt uit je opgeslagen scènes verwijderd. Je verlichting verandert niet.</p><button class="button full" data-action="scene-delete-confirm" data-id="${esc(id)}">Scène verwijderen</button><button class="button secondary full" data-action="effect-dialog-close">Behouden</button>`);return;}
      if(action==='scene-delete-confirm'){const result=sceneStore.remove(id);if(result.error)return toast(result.error.message);savedScenes=result;closeEffectDialog();return navigate('scenes');}
      if(action==='effects'||action==='effects-root'||action==='animations-gallery'){
        if(route.screen==='controls'){
          controlMode='animations';showControlAnimationGallery=true;route={...route,family:null,library:initialAnimationLibrary(),effectsReturn:'controls'};return render({preserveScroll:true});
        }
        const returnScreen=route.screen==='controls'||route.effectsReturn==='controls'?'controls':'animations';
        return navigate('effects',{family:null,library:initialAnimationLibrary(),effectsReturn:returnScreen});
      }
      if(action==='animation-search-clear'){const search=document.getElementById('animation-search');if(search){search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));}return;}
      if(action==='family'){
        const group=Library.group(catalogue(),id);if(!group)return;
        const familyScrollY=window.scrollY,familyViewportTop=button.getBoundingClientRect().top;
        const article=button.closest('.animation-family-card'),open=route.family!==id;
        main.querySelectorAll('.animation-family-card.is-expanded').forEach(previous=>{
          if(previous===article)return;
          const trigger=previous.querySelector('[data-action="family"]'),panel=previous.querySelector('.family-variants-panel');
          const previousGroup=trigger&&Library.group(catalogue(),trigger.dataset.id);
          previous.classList.remove('is-expanded');trigger?.setAttribute('aria-expanded','false');
          const label=trigger?.querySelector('.family-variants span');
          if(label&&previousGroup)label.textContent=previousGroup.count===1?'Voorbeeld bekijken':'Bekijk varianten';
          if(panel)panel.hidden=true;
        });
        const panel=article?.querySelector('.family-variants-panel'),label=button.querySelector('.family-variants span');
        route={...route,family:open?id:null};article?.classList.toggle('is-expanded',open);
        button.setAttribute('aria-expanded',String(open));if(panel)panel.hidden=!open;
        if(label)label.textContent=open?'Varianten verbergen':group.count===1?'Voorbeeld bekijken':'Bekijk varianten';
        button.focus({preventScroll:true});if(open)paint(performance.now()/1000);
        // Expanding a long family inserts several cards. Preserve the reader's
        // viewport while the browser recalculates sticky elements/scroll anchors.
        const restoreFamilyViewport=()=>{
          const delta=button.getBoundingClientRect().top-familyViewportTop;
          if(Math.abs(window.scrollY-familyScrollY)>1||Math.abs(delta)>1){
            const scroller=document.scrollingElement||document.documentElement;
            scroller.scrollTop=Math.max(0,scroller.scrollTop+delta);
          }
        };
        restoreFamilyViewport();
        requestAnimationFrame(()=>{restoreFamilyViewport();requestAnimationFrame(restoreFamilyViewport);});
        return;
      }
      if(action==='brand-tone'){
        const tone=BRAND_TONES.find(item=>item.id===id);if(!tone)return;
        brandColours.set(route.zoneId,tone.value);return render({preserveScroll:true});
      }
      if(action==='library'){
        if(route.screen==='controls'&&button.closest('[data-control-mode="animations"]')){
          route={...route,family:null,library:id,effectsReturn:'controls'};showControlAnimationGallery=true;return render({preserveScroll:true});
        }
        if(route.screen!=='effects')return navigate('effects',{family:null,library:id});
        route={...route,family:null,library:id};return render();
      }
      if(action==='tunnel-together'){selections.set(route.zoneId,{kind:'all'});return render();}
      if(action==='effect'){
        const effect=catalogue().find(e=>e.id===id);if(!effect)return;
        const requiresWholeZone=effect.requireTogether||effect.category==='tunnel';
        if(selected().length<(effect.minimumReceivers||1)||requiresWholeZone&&selection().kind!=='all')return;
        apply(effectState(effect));settingsOpen=false;
        if(route.screen==='controls'&&button.closest('[data-control-mode="animations"]')){controlMode='animations';showControlAnimationGallery=false;return render({preserveScroll:true});}
        if(route.screen==='effects'&&route.effectsReturn==='controls'){controlMode='animations';return navigate('controls',{zoneId:route.zoneId});}
        return navigate('animations');
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
      if(action==='effect-dialog-close'){if(colourManagerReturn)return closeColourManager();return closeEffectDialog();}
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
        apply({...backgroundDefaults(),...restored.state,...(restored.effect.controls.includes('smooth')?{smooth:100}:{}),v30Effect:restored.state.v30Effect||null,previewFamily:restored.state.previewFamily||null});settingsOpen=false;
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
        if(nativeContext)sendReceiverStates(M.zoneReceivers(model,route.zoneId).map(item=>item.id));
        return render();
      }
    }catch(error){const message=error.message||'Dit kon nog niet worden toegepast.',notice=document.querySelector('#effect-dialog[open] .dialog-error');if(notice){notice.textContent=message;notice.hidden=false;}else toast(message);}
  });
  document.addEventListener('input',event=>{
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
        const value=input.value;if(!value.trim()){render();document.getElementById('animation-search')?.focus({preventScroll:true});return;}
        const results=document.getElementById('animation-results');results.querySelectorAll('canvas[data-preview]').forEach(c=>previews.delete(c.dataset.preview));results.innerHTML=effectResults(value);paint(performance.now()/1000);return;
      }
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
    if(event.target.matches?.('[data-receiver-connections]')&&event.target.isConnected){
      const id=event.target.dataset.receiverConnections;event.target.open?expandedConnections.add(id):expandedConnections.delete(id);return;
    }
    const details=event.target;if(!details.matches?.('[data-receiver-detail]')||!details.isConnected)return;
    details.open?expandedReceivers.add(details.dataset.receiverDetail):expandedReceivers.delete(details.dataset.receiverDetail);
    if(!details.open)visualPlugMotions.delete(details.dataset.receiverDetail);
  },true);
  function resumePinConnection(){if(pinProtectionReconnect&&document.visibilityState==='visible')void refreshPinProtection({afterReconnect:true});}
  window.addEventListener('focus',resumePinConnection);document.addEventListener('visibilitychange',resumePinConnection);
  window.LightningV30=Object.freeze({snapshot:()=>copy({model,route,selection:selection()}),version:'31.0.0-stability',hardwareEnabled:false});
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
      model=restored;nativeLoaded=true;
      // Only a successful load can establish that this is a first installation.
      // An existing stand with no receivers is not a reason to restart setup.
      if(state.draft||!restored.stands.length){route.screen='receiver-add';route.setupFrom='stand';}
    }catch(_){nativeLoadError=true;}
    finally{nativeLoading=false;render({top:true});}
  }
  render({top:true});if(nativeContext)loadNativeState();requestAnimationFrame(frame);
})();
