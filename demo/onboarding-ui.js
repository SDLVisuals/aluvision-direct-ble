/* Consumer onboarding shell. No discovery, pairing, credentials persistence or
 * simulated devices are built in. A trusted service must be injected by the
 * native composition root; tests inject their own service into this factory.
 * A receipt reference is not success: the draft committer verifies its exact
 * receiver, transaction, configuration and final zone before membership exists.
 * Services: search({standId,mainReceiverId,signal}) -> {receivers}; optional
 * identify({receiver,enabled,ttlMs}) -> {confirmed:true}; secure and read-only
 * reconcileSecurity({configuration,pin?,onProgress}) -> {receiptRef}; idempotent
 * finalize({configuration,securityReceiptRef}) -> {receiptRef}; and the draft's
 * verifyFinalReceipt dependency. Finalize/reconcile must preserve the exact
 * transaction after a timeout, never turn a retry into a new claim. Cold-start
 * recovery and atomic durable app publication belong to native integration;
 * this module only retains non-secret choices/opaque refs in this page closure.
 */
(function(root,factory){'use strict';root.LightningOnboardingUI=factory();}(window,function(){
  'use strict';
  const pinRequired=window.AluvisionSecurityMode?.pinRequired!==false;
  const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const button=(action,label,extra='')=>`<button type="button" class="${extra.includes('class="button secondary"')?'button secondary':'button'}" data-onboarding-action="${action}" ${extra.replace('class="button secondary"','')}>${label}</button>`;
  const labels={stand:'Je stand',zones:'Zones maken',receiver:'Receiver zoeken',outputs:'Kies je uitgangen',pixels:'Stel je lengte in',connection:'Kies het beginpunt',pin:'Kies je installatie-PIN',security:pinRequired?'Verbinding bevestigen':'Receiver verbinden',zone:'Kies de zone',review:'Klaar om toe te voegen',done:'Je receiver is klaar'};
  const phaseLabels={configuring:'Instellingen bewaren',claiming:'Receiver beveiligen',reconnecting:'Opnieuw met wifi verbinden',verifying:'Verbinding controleren',resuming:'Beveiliging controleren'};
  const unavailable='Er is nog geen verbindingsdienst beschikbaar. Je keuzes blijven bewaard.';
  const clone=value=>JSON.parse(JSON.stringify(value));
  const canonical=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
  function bounded(promise,milliseconds=15000){let timer;return Promise.race([Promise.resolve(promise),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(Error('TIMEOUT'),{code:'TIMEOUT'})),milliseconds);})]).finally(()=>clearTimeout(timer));}
  // Native errors contain only bounded codes. Never render an exception's raw
  // message: network responses can contain credentials or untrusted content.
  function connectionFailure(failure,{viaMain=false}={}){
    const code=typeof failure?.code==='string'?failure.code:'';
    if(!pinRequired&&['MAIN_RECOVERY_UNAVAILABLE','MAIN_RECOVERY_CONFLICT','MAIN_REGISTRATION_UNCONFIRMED','REMOVAL_PIN_REQUIRED'].includes(code))return {message:'De receiver antwoordt nog niet. Laat hem aan en controleer dezelfde verbinding opnieuw. Je keuzes blijven bewaard.'};
    if(code==='DISCOVERY_EXPIRED')return {expired:true,message:'De vorige verbindingscontrole is verlopen. Tik op Verbinding controleren om je receiver opnieuw te zoeken. Je keuzes blijven bewaard.'};
    if(['DISCOVERY_UNAVAILABLE','MAIN_MANUAL_WIFI_REQUIRED','MAIN_CONNECTION_UNAVAILABLE','NATIVE_TIMEOUT','TIMEOUT'].includes(code))return {message:viaMain?'Je hoofdreceiver antwoordt nog niet. Controleer of je iPhone met het ALUVISION-wifi van je hoofdreceiver verbonden is. Laat de extra receiver aan en probeer opnieuw; verbind je iPhone niet met zijn eigen wifi. Je keuzes blijven bewaard.':'De receiver antwoordt nog niet. Controleer op je iPhone via Instellingen → Wifi of je met het ALUVISION-netwerk van jouw receiver verbonden bent. Ga terug en tik op Verbinding controleren. Je keuzes blijven bewaard.'};
    if(code==='OWNED_DISCOVERY_UNSUPPORTED')return {message:'Extra receivers zoeken via je hoofdreceiver is in deze appversie nog niet beschikbaar. Je bestaande installatie en keuzes blijven bewaard; je hoeft niets te resetten.'};
    if(['MAIN_PROTOCOL_UNSUPPORTED','ACTION_UNSUPPORTED'].includes(code))return {message:'Deze app en receiver ondersteunen deze verbindingsstap nog niet samen. Gebruik bij elkaar passende app- en receiverupdates. Je keuzes blijven bewaard; reset je receiver niet.'};
    if(['MAIN_IDENTITY_UNCONFIRMED','IDENTITY_MISMATCH','DISCOVERY_INVALID'].includes(code))return {message:viaMain?'De identiteit van deze extra receiver is nog niet bevestigd via je hoofdreceiver. Laat beide receivers aan en controleer de verbinding met het wifi van je hoofdreceiver. Er is niets toegevoegd of gereset.':'De identiteit van deze receiver is nog niet bevestigd. Controleer of je het ALUVISION-wifinetwerk van de juiste receiver hebt gekozen en tik op Verbinding controleren. Er is niets toegevoegd of gereset.'};
    if(['NATIVE_BUSY','MAIN_BUSY','OTA_BUSY','REMOVAL_BUSY'].includes(code))return {message:'De app is nog bezig met een andere receiveractie. Wacht tot die klaar is en probeer opnieuw. Je keuzes blijven bewaard.'};
    if(['MAIN_STORAGE_UNCONFIRMED','V30_STORAGE_UNAVAILABLE','V30_STORAGE_UNCONFIRMED','V30_CHECKPOINT_CONFLICT'].includes(code))return {message:'De app kon de verbindingsgegevens nog niet veilig bewaren. Je keuzes blijven op dit scherm staan. Probeer opnieuw; reset je receiver niet.'};
    if(code==='MAIN_RECOVERY_UNAVAILABLE')return {message:'Je PIN is niet opnieuw ingesteld. De receiver kon de toegang voor dit toestel nog niet bewaren. Laat hem aan en controleer opnieuw.'};
    if(code==='MAIN_RECOVERY_CONFLICT')return {message:'De bewaarde toegang op deze receiver komt niet overeen met deze koppeling. Er is niets overschreven. Bewaar je PIN; reset je receiver niet.'};
    if(code==='MAIN_REGISTRATION_UNCONFIRMED')return {message:'De receiver is nog bezig met de toegang voor deze app. Je PIN en keuzes blijven bewaard. Controleer opnieuw om af te ronden.'};
    if(['NATIVE_UNAVAILABLE','NATIVE_DOCUMENT_UNAVAILABLE'].includes(code))return {message:'De verbinding met de receiverdienst in de app is niet beschikbaar. Probeer opnieuw vanuit de iPhone-app. Je receiver wordt niet gereset.'};
    return {message:'Deze receiver kon nog niet veilig worden gecontroleerd. Je keuzes blijven staan. Tik op Verbinding controleren om opnieuw te proberen; reset je receiver niet.'};
  }

  function create({draftApi=window.LightningOnboardingDraft,visual=window.LightningReceiverVisual,pixelSetup=window.LightningPixelSetup,services={},getModel,onComplete=()=>{},onManage=null,onExit=()=>{}}={}){
    if(!draftApi||!pixelSetup||typeof getModel!=='function')throw Error('Onboarding dependencies are required.');
    let draft=null,container=null,results=[],searchState='idle',error='',notice='',busy=false,operation=0;
    let securityReceiptRef=null,finalReceiptRef=null,securityUncertain=false,finalizationStarted=false,completeModel=null,manualRejoinSSID=null;
    let returningFromWifi=false,rejoinTimer=null,registrationPending=false;
    let rejoinSession=0,rejoinAttempts=0,rejoinRunning=false,rejoinExhausted=false,rejoinBlocked=false,automaticFinalizing=false;
    let identifying=new Map(),identifyPending=new Set(),zoneNameOpen=false,searchAbort=null,resumeSelection=null;
    let standNameInput=null,zoneNameInput='',draftSaving=false,pendingChoices=null,saveFailed=false,origin='stand';
    let zoneExtraNames=[],zoneRemoval=null,zoneRename=null,receiverMove=null,managementBusy=false;
    const visualEntrances=new Map(),presentedStages=new Set(),plugMotion=visual.createPlugMotion();
    let selectedOutput=null;
    const saveNotice='Je keuzes zijn nog niet bewaard. Probeer opnieuw; je hoeft niets opnieuw in te vullen.';
    const committer=draftApi.createCommitter({verifyFinalReceipt:request=>{
      if(typeof services.verifyFinalReceipt!=='function')throw Error('VERIFIER_UNAVAILABLE');
      return services.verifyFinalReceipt(request);
    }});
    const active=()=>draft?.outputs.filter(output=>output.enabled)||[];
    const canSecure=()=>['secure','reconcileSecurity','finalize','verifyFinalReceipt'].every(name=>typeof services[name]==='function');
    const canIdentify=receiver=>receiver.canVerifyIdentity===true&&(
      draft?.role==='node'&&typeof services.identifyCandidate==='function'||
      draft?.role==='main'&&typeof services.identifyFactoryMain==='function')||
      typeof services.identify==='function'&&receiver.canConfigure!==false;
    const manualWifi=()=>services.connectionMode==='manual-wifi'&&!draft.mainReceiverId;
    const config=()=>draftApi.configuration(draft);
    const persist=()=>typeof services.persistDraft==='function'&&draft&&draft.stage!=='done'?services.persistDraft({draft:draftApi.snapshot(draft)}):Promise.resolve();
    function refreshNotice(){
      const region=container?.querySelector('.onboarding-notice');
      if(region){region.hidden=!notice&&!draftSaving;region.textContent=draftSaving?'Je keuzes bewaren…':notice;}
      updateGuidance();
    }
    function keepDraft(){persist().catch(()=>{saveFailed=true;notice=saveNotice;refreshNotice();});}
    function captureNames(){
      const stand=container?.querySelector('#onboarding-stand-name'),zone=container?.querySelector('#onboarding-zone-name');
      if(stand)standNameInput=stand.value;if(zone)zoneNameInput=zone.value;
      if(zone)zoneExtraNames=Array.from(container.querySelectorAll('[data-zone-extra]'),field=>field.value);
      const rename=container?.querySelector('#onboarding-zone-rename');if(rename&&zoneRename)zoneRename.name=rename.value;
    }
    const canManageZones=()=>!!draft&&!draft.receiver&&!draft.cancelled&&draft.security.status==='not-started'&&['zones','receiver'].includes(draft.stage);
    const zoneMembers=id=>getModel().receivers.filter(receiver=>receiver.standId===draft.stand?.id&&receiver.zoneId===id&&receiver.lifecycle==='added');
    const currentZone=id=>getModel().stands.find(stand=>stand.id===draft.stand?.id)?.zones.find(zone=>zone.id===id);
    const zoneSignature=zone=>JSON.stringify([zone.id,zone.name,zone.type,zone.receiverIds]);
    function resetZoneNames(){zoneNameInput='';zoneExtraNames=[];container?.querySelectorAll('#onboarding-zone-name,[data-zone-extra]').forEach(field=>{if(field.hasAttribute('data-zone-extra'))field.remove();else field.value='';});}
    function zoneNames(){return [zoneNameInput,...zoneExtraNames];}
    function validZoneNames(){const names=zoneNames(),keys=names.map(name=>name.trim().normalize('NFKC').toLowerCase());return names.every(validName)&&new Set(keys).size===keys.length&&draft.zones.length+names.length<=256;}
    // Commit the entire small setup step, including its destination screen, as
    // one native draft. Retrying uses the exact same IDs and candidate after an
    // uncertain storage response; it cannot create a second stand or zone.
    async function saveChoices(events=[],afterSave=()=>{},{top=true}={}){
      if(draftSaving)return false;
      captureNames();
      if(!pendingChoices){
        let candidate=draft;
        for(const event of events){const result=draftApi.transition(candidate,event);if(result.error){error=result.error.message;paintPage(false);return false;}candidate=result.draft;}
        pendingChoices={draft:candidate,afterSave,top,focusedZone:container?.contains(document.activeElement)&&document.activeElement.dataset.onboardingAction==='active-zone'?document.activeElement.dataset.id:null};
      }
      draftSaving=true;error='';paintPage(false);
      const pending=pendingChoices;
      try{
        if(typeof services.persistDraft==='function')await services.persistDraft({draft:draftApi.snapshot(pending.draft)});
        draft=pending.draft;pendingChoices=null;saveFailed=false;notice='';pending.afterSave();return true;
      }catch(_){saveFailed=true;notice=saveNotice;return false;}
      finally{
        draftSaving=false;paintPage(!pendingChoices&&pending.top);
        if(!pendingChoices&&!pending.top&&pending.focusedZone)container?.querySelector(`[data-onboarding-action="active-zone"][data-id="${CSS.escape(pending.focusedZone)}"]`)?.focus({preventScroll:true});
      }
    }
    function verifyAgain(value){
      resumeSelection=clone(value);resumeSelection.security=pinRequired?{status:'not-started',phase:'idle'}:{status:'pending',phase:'configuring'};
      if(['security','zone','review'].includes(resumeSelection.stage))resumeSelection.stage=pinRequired?'pin':'security';
      draft=draftApi.snapshot({...clone(value),stage:'receiver',receiver:null,outputs:[],port:null,zoneId:null,security:{status:'not-started',phase:'idle'},cancelled:false});
      securityUncertain=false;securityReceiptRef=null;finalReceiptRef=null;manualRejoinSSID=null;searchState='idle';results=[];
    }
    function restore(value){
      if(container||busy)throw Error('FLOW_ACTIVE');
      const saved=draftApi.snapshot(value);if(saved.membership==='added')throw Error('ALREADY_ADDED');
      if(!pinRequired&&saved.stage==='pin'){
        draft=draftApi.snapshot({...clone(saved),stage:'security',security:{status:'pending',phase:'configuring'}});
        securityUncertain=false;return;
      }
      if(saved.security.status!=='not-started'){
        draft=draftApi.snapshot({...clone(saved),stage:'security',security:{status:'pending',phase:'resuming'},cancelled:false});securityUncertain=true;
      }else if(saved.receiver)verifyAgain(saved);else draft=saved;
    }
    function cancelSearch(){
      // Invalidate before abort callbacks can settle; late answers must not
      // replace a newer page or a newer discovery operation.
      operation++;searchAbort?.abort();searchAbort=null;
      if(searchState==='searching')searchState='idle';
    }
    function change(event,{render=true,top=true}={}){
      const result=draftApi.transition(draft,event);
      if(result.error){error=result.error.message||'Controleer je keuze.';if(render)paintPage(false);return false;}
      draft=result.draft;error='';if(event.type!=='SECURITY_PROGRESS')keepDraft();if(render)paintPage(top);return true;
    }
    function start({activeZoneId}={}){
      if(!draft||draft.stage==='done'){
        draft=draftApi.create({model:getModel(),activeZoneId,transactionId:'onboarding-'+crypto.randomUUID()});
        results=[];searchState='idle';securityReceiptRef=null;finalReceiptRef=null;completeModel=null;
        securityUncertain=false;finalizationStarted=false;manualRejoinSSID=null;resumeSelection=null;error='';notice='';zoneNameOpen=false;
        stopAutomaticRejoin();rejoinExhausted=false;rejoinBlocked=false;automaticFinalizing=false;registrationPending=false;returningFromWifi=false;
        standNameInput=null;zoneNameInput='';pendingChoices=null;saveFailed=false;
        zoneExtraNames=[];zoneRemoval=null;zoneRename=null;receiverMove=null;managementBusy=false;
        visualEntrances.clear();presentedStages.clear();plugMotion.clear();selectedOutput=null;
      }else if(draft.cancelled)change({type:'RETRY'},{render:false});
    }
    const automaticMain=()=>pinRequired&&!!draft&&draft.role==='main'&&manualWifi();
    const pendingMain=()=>automaticMain()&&((draft.stage==='security'&&securityUncertain)||(['zone','review'].includes(draft.stage)&&draft.security.status==='confirmed'&&!!draft.zoneId));
    const transientRejoin=failure=>['DISCOVERY_UNAVAILABLE','MAIN_MANUAL_WIFI_REQUIRED','MAIN_CONNECTION_UNAVAILABLE','NATIVE_TIMEOUT','TIMEOUT','NATIVE_BUSY','MAIN_BUSY','MAIN_REGISTRATION_UNCONFIRMED','MAIN_RECOVERY_UNAVAILABLE'].includes(failure?.code);
    function stopAutomaticRejoin(){clearTimeout(rejoinTimer);rejoinTimer=null;rejoinSession++;rejoinRunning=false;}
    function resumeAfterWifiReturn({force=false}={}){
      if(container&&!document.hidden&&busy&&automaticMain()&&draft.stage==='security'){returningFromWifi=true;return;}
      if(!container||document.hidden||!pendingMain()||(!force&&rejoinBlocked))return;
      if(busy){returningFromWifi=true;return;}
      if(rejoinRunning)return;
      returningFromWifi=false;rejoinRunning=true;rejoinExhausted=false;rejoinBlocked=false;rejoinAttempts=0;
      const session=++rejoinSession;
      rejoinTimer=setTimeout(()=>void automaticRejoin(session),0);
    }
    async function automaticRejoin(session){
      rejoinTimer=null;
      if(session!==rejoinSession||!container||document.hidden||busy||!pendingMain()){if(session===rejoinSession)rejoinRunning=false;return;}
      rejoinAttempts++;
      let outcome='stop';
      if(draft.stage==='security')outcome=await secure(undefined,undefined,{reconcile:true,automatic:true});
      if(session!==rejoinSession||!container||document.hidden)return;
      // The zone was already chosen before the PIN. Preserve that choice, but
      // still traverse the normal validators and the authenticated finalizer.
      if(draft.security.status==='confirmed'&&draft.zoneId&&['zone','review'].includes(draft.stage)){
        if(draft.stage==='zone'&&!change({type:'NEXT'},{render:false}))outcome='stop';
        else if(draft.stage==='review')outcome=await finish({automatic:true});
      }
      if(session!==rejoinSession||!container||document.hidden)return;
      if(outcome==='retry'&&pendingMain()&&rejoinAttempts<3){
        rejoinTimer=setTimeout(()=>void automaticRejoin(session),rejoinAttempts*1500);paintPage(false);return;
      }
      rejoinRunning=false;
      if(outcome==='retry'){
        rejoinExhausted=true;
        error=registrationPending?'Je receiver is nog bezig. Laat hem aan; je PIN en keuzes blijven bewaard.':'Je receiver is nog niet bereikbaar. Kies zijn ALUVISION-netwerk in Instellingen → Wifi, met je gekozen PIN. Terug in de app gaan we automatisch verder.';
      }else if(outcome==='stop'&&draft.stage==='security')rejoinBlocked=true;
      paintPage(false);
    }
    function visibilityChanged(){
      if(document.hidden){if(pendingMain())returningFromWifi=true;stopAutomaticRejoin();}
      else if(returningFromWifi)resumeAfterWifiReturn();
    }
    function nativeActive(){resumeAfterWifiReturn();}
    function pageShown(event){if(event.persisted||returningFromWifi)resumeAfterWifiReturn();}
    function mount(element,options){start(options);origin=options?.origin==='receivers'&&draft.mainReceiverId?'receivers':'stand';container=element;container.addEventListener('click',click);container.addEventListener('input',input);container.addEventListener('keydown',keydown);document.addEventListener('visibilitychange',visibilityChanged);window.addEventListener('lightning:native-active',nativeActive);window.addEventListener('pageshow',pageShown);paintPage(false);if(pendingMain())resumeAfterWifiReturn();}
    function suspend(){
      // Leaving this screen must never discard an uncertain claim. PIN inputs
      // are destroyed; only non-secret choices and opaque receipts stay private.
      captureNames();container?.querySelectorAll('[data-onboarding-pin]').forEach(input=>{input.value='';});
      if(container){container.removeEventListener('click',click);container.removeEventListener('input',input);container.removeEventListener('keydown',keydown);}
      document.removeEventListener('visibilitychange',visibilityChanged);window.removeEventListener('lightning:native-active',nativeActive);window.removeEventListener('pageshow',pageShown);stopAutomaticRejoin();returningFromWifi=false;
      container=null;cancelSearch();plugMotion.clear();selectedOutput=null;
      for(const id of identifying.keys())stopIdentify(id);
    }
    function reset(){
      suspend();draft=null;results=[];securityReceiptRef=null;finalReceiptRef=null;
      securityUncertain=false;finalizationStarted=false;completeModel=null;pendingChoices=null;
      resumeSelection=null;manualRejoinSSID=null;error='';notice='';busy=false;
    }
    function heading(){
      const firstSetup=origin==='stand';
      const step=draft.stage==='stand'?1:draft.stage==='zones'?2:3;
      const title=draft.stage==='stand'?'Hoe heet je stand?':draft.stage==='zones'?(zoneRemoval?'Zones beheren':zoneRename?'Zone hernoemen':receiverMove?'Receiver verplaatsen':zoneNames().length>1?'Maak je zones':zoneNameOpen&&draft.zones.length?'Nieuwe zone':draft.zones.length?'Je zones':'Maak je eerste zone'):draft.stage==='receiver'?(busy?'Receiver controleren':searchState==='searching'?'Receiver zoeken…':results.length===1?'Receiver gevonden':results.length>1?'Kies je receiver':'Receiver zoeken'):automaticMain()&&draft.stage==='security'?(busy||rejoinRunning?'Je receiver toevoegen':'Verbind opnieuw met wifi'):automaticMain()&&automaticFinalizing&&draft.stage==='review'?'Je receiver toevoegen':labels[draft.stage]||'Receiver toevoegen';
      return `<header class="onboarding-setup-header"><div><span class="onboarding-setup-label">Setup</span><b>${firstSetup?'Je stand instellen':'Receiver toevoegen'}</b></div><button type="button" class="back" data-onboarding-action="exit">Later verder <span aria-hidden="true">×</span></button></header>${firstSetup?`<ol class="onboarding-setup-steps" aria-label="Je stand instellen">${['Standnaam','Zones','Receivers'].map((label,i)=>`<li data-setup-step="${i+1}" ${i+1===step?'aria-current="step"':''} class="${i+1<step||draft.stage==='done'?'completed':''}"><span>${i+1<step||draft.stage==='done'?'✓':i+1}</span><b>${label}</b></li>`).join('')}</ol>`:''}<header class="onboarding-heading"><div class="onboarding-step-caption"><span>${firstSetup?`Stap ${step} van 3`:'Receiver toevoegen'}</span>${draft.stand&&draft.stage!=='stand'?`<small>${escape(draft.stand.name)}</small>`:''}</div><h1>${title}</h1></header>${!['stand','zones','receiver','done'].includes(draft.stage)?zoneContext():''}`;
    }
    function zoneVisual(index){
      return `<span class="onboarding-zone-number" aria-hidden="true">${index+1}</span>`;
    }
    function setupZones({editable=false}={}){
      return `<div class="onboarding-zone-list onboarding-zone-tiles" aria-label="Jouw zones">${draft.zones.map((zone,index)=>{const count=zoneMembers(zone.id).length;return `<div class="onboarding-zone-row" data-setup-zone-row="${escape(zone.id)}"><button type="button" class="onboarding-zone" data-setup-zone="${escape(zone.id)}" data-onboarding-action="active-zone" data-id="${escape(zone.id)}" aria-pressed="${draft.activeZoneId===zone.id}">${zoneVisual(index)}<span><b>${escape(zone.name)}</b><small>${count?`${count} ${count===1?'receiver':'receivers'} · ${zone.type}`:'Nog geen receivers'}${draft.activeZoneId===zone.id?' · Gekozen':''}</small></span><i aria-hidden="true">${draft.activeZoneId===zone.id?'✓':''}</i></button>${editable&&canManageZones()?`<div class="onboarding-zone-tools"><button type="button" class="onboarding-rename-zone" data-onboarding-action="zone-rename" data-id="${escape(zone.id)}" aria-label="${escape(zone.name)} hernoemen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14z"/></svg></button><button type="button" class="onboarding-remove-zone" data-onboarding-action="zone-remove" data-id="${escape(zone.id)}" aria-label="${escape(zone.name)} verwijderen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/></svg></button></div>`:''}</div>`;}).join('')}</div>`;
    }
    function zoneRenamePanel(){
      const zone=draft.zones.find(zone=>zone.id===zoneRename?.zoneId);if(!zone)return '';
      return `<section class="card onboarding-zone-confirm" data-setup-rename-zone="${escape(zone.id)}"><h2>${escape(zone.name)}</h2><p>Alleen de naam verandert. Receivers${pinRequired?', PIN':''} en opgeslagen licht blijven bewaard.</p>${nameField('onboarding-zone-rename','Zonenaam','Bijvoorbeeld: Demohoek',zoneRename.name)}<div class="onboarding-actions">${button('zone-rename-cancel','Annuleren','class="button secondary"')}${button('zone-rename-confirm','Naam opslaan','disabled')}</div></section>`;
    }
    function zoneNameFields(){
      return `<section class="card onboarding-name-card onboarding-batch-zones"><div class="onboarding-zone-inputs">${zoneNames().map((name,index)=>`<div class="onboarding-zone-input">${index===0?nameField('onboarding-zone-name',zoneNames().length===1?'Zonenaam':'Zone 1','Bijvoorbeeld: Demohoek',name):`<label class="onboarding-field">Zone ${index+1}<input id="onboarding-zone-name-${index}" data-zone-extra="${index}" maxlength="64" autocomplete="off" value="${escape(name)}" placeholder="Bijvoorbeeld: Balie"></label>`}${zoneNames().length>1?`<button type="button" data-onboarding-action="zone-drop-row" data-index="${index}" aria-label="Naamveld ${index+1} verwijderen">×</button>`:''}</div>`).join('')}</div>${button('zone-add-row','＋ Nog een zone','class="button secondary" '+(zoneNames().length>=12||draft.zones.length+zoneNames().length>=256?'disabled':''))}<small class="onboarding-batch-hint">Eén zone is genoeg. Meer kan later.</small></section>`;
    }
    function zoneRemovalPanel(){
      const zone=draft.zones.find(zone=>zone.id===zoneRemoval?.zoneId);if(!zone)return '';
      const count=zoneMembers(zone.id).length;
      return `<section class="card onboarding-zone-confirm" data-setup-delete-zone="${escape(zone.id)}"><h2>${escape(zone.name)} verwijderen?</h2><p>${count?`${count} ${count===1?'receiver blijft':'receivers blijven'} gekoppeld en komt bij <b>Niet in een zone</b>. Je kunt ze meteen opnieuw indelen.`:'Je verwijdert alleen deze zone.'}</p><small>Je receivers${pinRequired?' en PIN':''} worden niet gereset.</small><div class="onboarding-actions">${button('zone-remove-cancel','Annuleren','class="button secondary"')}${button('zone-remove-confirm','Zone verwijderen')}</div></section>`;
    }
    function receiverPlacement(){
      if(!canManageZones())return '';
      const chosen=draft.zones.find(zone=>zone.id===draft.activeZoneId),members=zoneMembers(chosen?.id),unassigned=getModel().receivers.filter(receiver=>receiver.standId===draft.stand?.id&&receiver.lifecycle==='added'&&!receiver.zoneId);
      const rows=list=>list.map(receiver=>`<div class="onboarding-member" data-setup-receiver="${escape(receiver.id)}"><span class="onboarding-member-type">${receiver.type}</span><span><b>${escape(receiver.name)}</b><small>${receiver.role==='main'?'Hoofdreceiver · ':''}${receiver.zoneId?'Toegevoegd':'Nog geen zone'}</small></span>${button('receiver-move',receiver.zoneId?'Verplaatsen':'Zone kiezen',`data-id="${escape(receiver.id)}" class="button secondary"`)}</div>`).join('');
      return `${members.length?`<section class="onboarding-members"><h2>In ${escape(chosen.name)} <span>${members.length}</span></h2>${rows(members)}</section>`:''}${unassigned.length?`<section class="onboarding-members"><h2>Niet in een zone <span>${unassigned.length}</span></h2>${rows(unassigned)}</section>`:''}`;
    }
    function movePanel(){
      const receiver=getModel().receivers.find(receiver=>receiver.id===receiverMove?.receiverId);if(!receiver)return '';
      return `<section class="card onboarding-move-panel" data-setup-move-receiver="${escape(receiver.id)}"><h2>Waar hoort ${escape(receiver.name)}?</h2><p>Kies een zone. Zijn lichtinstellingen blijven bewaard.</p><div class="onboarding-zone-list">${draft.zones.map((zone,index)=>{const compatible=!zone.type||zone.type===receiver.type;return `<button type="button" class="onboarding-zone" data-onboarding-action="move-zone" data-id="${escape(zone.id)}" aria-pressed="${receiverMove.zoneId===zone.id}" ${compatible?'':'disabled'}>${zoneVisual(index)}<span><b>${escape(zone.name)}</b><small>${!compatible?`Alleen ${zone.type}`:receiver.zoneId===zone.id?'Huidige zone':`${zoneMembers(zone.id).length} receivers`}</small></span><i aria-hidden="true">${receiverMove.zoneId===zone.id?'✓':''}</i></button>`;}).join('')}</div><div class="onboarding-actions">${button('move-cancel','Annuleren','class="button secondary"')}${button('move-confirm',receiver.zoneId?'Verplaatsen':'Toewijzen',!receiverMove.zoneId||receiverMove.zoneId===receiver.zoneId?'disabled':'')}</div></section>`;
    }
    function setupIcon(name){
      const paths={phone:'<rect x="12" y="3" width="20" height="38" rx="5"/><path d="M18 8h8M19 36h6"/>',wifi:'<path d="M5 16a25 25 0 0 1 34 0M11 23a16 16 0 0 1 22 0M17 30a7 7 0 0 1 10 0"/><circle cx="22" cy="37" r="1.5"/>',return:'<rect x="12" y="3" width="20" height="38" rx="5"/><path d="M5 23h20m-6-6 6 6-6 6M19 36h6"/>'};
      return `<svg viewBox="0 0 44 44" aria-hidden="true">${paths[name]||paths.phone}</svg>`;
    }
    function searchContext(){
      if(!draft.mainReceiverId)return '';
      const main=getModel().receivers.find(receiver=>receiver.id===draft.mainReceiverId);
      return `<p class="onboarding-main-context" data-onboarding-search-via="${escape(main?.type||'main')}">Via je hoofdreceiver${main?` · ${escape(main.type)} <b>${escape(main.name)}</b>`:''}</p>`;
    }
    function receiverAction(receiver){
      const zone=draft.zones.find(item=>item.id===draft.activeZoneId);
      const compatible=zone&&(!zone.type||zone.type===receiver.type);
      const label=!pinRequired&&receiver.type==='RGBW'?(compatible?`Toevoegen aan ${escape(zone.name)}`:'Zone kiezen en toevoegen'):'Deze receiver instellen';
      return button('receiver',busy?'Controleren…':label,`data-id="${escape(receiver.id)}" ${busy||!(receiver.canConfigure||receiver.canVerifyIdentity)?'disabled':''}`);
    }
    function receiverSearchView(){
      const single=results.length===1,found=results.length>0;
      const searching=searchState==='searching';
      let content='';
      if(searching)content=`<div class="card onboarding-searching" role="status"><span></span>${manualWifi()?'Je receiver controleren…':'Zoeken naar receivers…'}</div>`;
      else if(searchState==='unavailable')content=`<section class="card onboarding-search-empty"><h2>Zoeken nog niet beschikbaar</h2><p>${unavailable}</p></section>`;
      else if(searchState==='ready'&&!found)content=`<section class="card onboarding-search-empty"><h2>Nog niets gevonden</h2><p>${manualWifi()?'Controleer of je iPhone met jouw ALUVISION-netwerk verbonden is.':'Staat de nieuwe receiver aan? Zet hem in de buurt van je hoofdreceiver.'}</p></section>`;
      else if(!found&&searchState==='idle'&&!manualWifi())content=`<p class="onboarding-search-help">${draft.mainReceiverId?'Zet de receiver die je wilt toevoegen aan.':'Zet één receiver aan. RGBW of SPI kan je hoofdreceiver zijn.'}</p>`;
      if(found)content+=`<div class="onboarding-results" aria-label="Gevonden receivers">${results.map(receiver=>`<article class="card onboarding-result" data-onboarding-result="${escape(receiver.id)}" data-discovery-status="found"><div class="onboarding-found-status"><b>Gevonden</b><span>Nog niet toegevoegd</span></div><header><h2>${escape(receiver.name||`${receiver.type}-receiver`)}</h2><span class="pill">${receiver.type}</span></header>${product(receiver,{compact:true})}<div class="onboarding-recognition"><span>${identifying.has(receiver.id)?'Dit licht knippert nu.':'Herken jouw verlichting'}</span>${button('identify',identifying.has(receiver.id)?'Stop knipperen':'Laat knipperen',`data-id="${escape(receiver.id)}" class="button secondary" aria-pressed="${identifying.has(receiver.id)}" ${busy||identifyPending.has(receiver.id)||!canIdentify(receiver)?'disabled':''}`)}</div>${!canIdentify(receiver)?`<small class="onboarding-identify-unavailable">${draft.role==='main'?'Deze eerste hoofdreceiver kan vóór toevoegen nog niet knipperen.':'Knipperen via de hoofdreceiver is nu niet beschikbaar.'}</small>`:''}${single?'':`<div class="onboarding-actions">${receiverAction(receiver)}</div>`}</article>`).join('')}</div><div class="onboarding-search-again">${button('search',manualWifi()?'Verbinding opnieuw controleren':'Opnieuw zoeken','class="button secondary" '+(busy?'disabled':''))}</div>`;
      return `<p class="onboarding-later-hint">Meer receivers toevoegen kan later.</p>${searchContext()}${found?'':manualWifiGuide()}${content}${found?manualWifiGuide():''}<div class="onboarding-actions onboarding-footer">${button('back','← Zones',`class="button secondary" ${busy?'disabled':''}`)}${single?receiverAction(results[0]):found?'':button('search',searchLabel(),searching||busy?'disabled':'')}</div>`;
    }
    function lightExample(type){
      // Independent teaching motion. Physical identification stays exclusively
      // on the product canvas and requires the existing confirmed identify path.
      return `<figure class="onboarding-light-example" data-setup-visual="${type==='SPI'?'pixels':'whole-line'}" aria-label="${type==='SPI'?'Voorbeeld: licht beweegt per pixel. Geen live weergave.':'Voorbeeld: de RGBW-ledline verandert als geheel van kleur. Geen live weergave.'}"><div aria-hidden="true">${type==='SPI'?Array.from({length:20},(_,i)=>`<i style="--pixel:${i}"></i>`).join(''):'<i></i>'}</div><figcaption>Voorbeeld · ${type==='SPI'?'licht per pixel':'één RGBW-ledline'}</figcaption></figure>`;
    }
    function zoneContext(){
      const zone=draft.zones.find(zone=>zone.id===(draft.zoneId||draft.activeZoneId));
      return zone?`<div class="onboarding-zone-context">${zoneVisual(draft.zones.indexOf(zone))}<span><small>${draft.receiver&&zone.type&&zone.type!==draft.receiver.type?'Kies straks een passende zone':'Toevoegen aan'}</small><b>${escape(zone.name)}</b></span>${draft.receiver?`<em class="onboarding-role">${draft.role==='main'?'Hoofdreceiver':'Extra receiver'}</em>`:''}</div>`:'';
    }
    function product(receiver,{compact=false,port=null}={}){
      return `<div class="onboarding-product ${compact?'compact':''}"><canvas data-onboarding-visual="${escape(receiver.id)}" data-type="${receiver.type}" data-port="${port||''}" data-compact="${compact}" role="img" aria-label="${receiver.type}-receiver${port?` · uitgang ${port}`:''}" width="400" height="210"></canvas></div>`;
    }
    function pinNetwork(){
      return `<figure class="onboarding-pin-network" data-setup-visual="pin-network" aria-label="Schema: je telefoon, de gekozen ${escape(draft.receiver.type)}-hoofdreceiver en extra receivers die je later kunt toevoegen. Geen live netwerkstatus."><div class="onboarding-pin-network-route"><div class="onboarding-pin-phone">${setupIcon('phone')}<b>Je telefoon</b></div><span class="onboarding-pin-link" aria-hidden="true">→</span><div class="onboarding-pin-main">${product(draft.receiver,{compact:true})}<b>Hoofdreceiver</b><span>${escape(draft.receiver.type)} · deze receiver</span></div><span class="onboarding-pin-link future" aria-hidden="true">⇢</span><div class="onboarding-pin-future"><i aria-hidden="true">＋</i><b>Extra receivers</b><span>Later toevoegen</span></div></div><figcaption>Zo bouw je je installatie op · schema</figcaption></figure>`;
    }
    function pinForm(){
      return `${pinNetwork()}<p class="onboarding-task-hint">Eén PIN voor je hele installatie.</p><section class="card onboarding-pin-card"><label class="onboarding-field">PIN · 8–12 cijfers<input id="onboarding-pin" data-onboarding-pin="first" type="password" inputmode="numeric" autocomplete="new-password" minlength="8" maxlength="12" aria-describedby="onboarding-pin-help" spellcheck="false"></label><label class="onboarding-field">Herhaal dezelfde PIN<input id="onboarding-pin-repeat" data-onboarding-pin="repeat" type="password" inputmode="numeric" autocomplete="new-password" minlength="8" maxlength="12" aria-describedby="onboarding-pin-error onboarding-pin-match" spellcheck="false"></label><p id="onboarding-pin-error" class="onboarding-error" role="alert" hidden></p><p id="onboarding-pin-match" class="onboarding-pin-match" role="status" hidden>✓ Beide PINs komen overeen</p><p id="onboarding-pin-help" class="onboarding-hint">Bewaar je PIN: je wifi-wachtwoord en toegang op een ander toestel.</p><p class="onboarding-pin-rejoin-note">Daarna kies je het receiver-wifi opnieuw in Instellingen, met deze PIN.</p></section><details class="onboarding-recovery"><summary>App gewist of PIN vergeten?</summary><p>Bewaar je PIN ook buiten de app. Voor toegang na herinstallatie of op een ander toestel gebruik je dezelfde PIN zodra de hersteloptie beschikbaar is. PIN vergeten? Dan is een ondersteunde fabrieksreset op de receiver nodig.</p></details>${footerPin()}`;
    }
    function reviewCard(){
      return `<section class="card onboarding-review onboarding-review-product">${product(draft.receiver,{compact:true,port:null})}<dl><div><dt>Receiver</dt><dd>${escape(draft.receiver.name||draft.receiver.type)}</dd></div><div><dt>Zone</dt><dd>${escape(draft.zones.find(zone=>zone.id===draft.zoneId)?.name)}</dd></div><div><dt>Verbinding</dt><dd>${draft.role==='main'?(pinRequired?'Hoofdreceiver · beveiligd':'Hoofdreceiver · open netwerk'):'Via hoofdreceiver'}</dd></div></dl>${draft.receiver.type==='SPI'?`<ul>${active().map(output=>`<li><b>P${output.port}</b><span>${output.pixels} pixels<small>${pixelSetup.endpointLabel(output)}</small></span></li>`).join('')}</ul>`:lightExample('RGBW')}</section><div class="onboarding-actions onboarding-footer">${pinRequired?button('back','← Zone kiezen',busy||finalizationStarted?'disabled':''):''}${button('finish',busy?'Toevoegen…':!pinRequired&&finalizationStarted?'Opnieuw proberen':'Receiver toevoegen',busy?'disabled':'')}</div>`;
    }
    function addingPanel(){
      return `<section class="card onboarding-security" role="status"><span class="onboarding-security-icon">${setupIcon('wifi')}</span><h2>Receiver toevoegen…</h2><p>We controleren de verbinding en bewaren je receiver in ${escape(draft.zones.find(zone=>zone.id===draft.zoneId)?.name)}.</p></section>`;
    }
    function completeCard(){
      const zone=draft.zones.find(zone=>zone.id===draft.zoneId),count=getModel().receivers.filter(receiver=>receiver.zoneId===draft.zoneId&&receiver.lifecycle==='added').length;
      return `<section class="card onboarding-done">${product(draft.receiver,{compact:true})}<span class="onboarding-success-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="m8 16 5 5 11-11"/></svg></span><h2>Receiver toegevoegd</h2><p>${escape(zone?.name)} · ${count} ${count===1?'receiver':'receivers'}</p></section>${button('done','Klaar · naar mijn stand')}<p class="onboarding-later-hint">Meer receivers toevoegen kan later.</p><section class="onboarding-followup"><h2>Verder uitbreiden?</h2>${button('another',`＋ Nog een receiver in ${escape(zone?.name)}`,'class="button secondary"')}${button('another-zone','Andere zone kiezen','class="button secondary"')}</section>`;
    }
    function errorBox(){return `<p class="onboarding-error" role="alert" ${error?'':'hidden'}>${escape(error)}</p><p class="onboarding-notice" role="status" ${notice||draftSaving?'':'hidden'}>${draftSaving?'Je keuzes bewaren…':escape(notice)}</p>${pendingChoices&&saveFailed?button('save-retry',draftSaving?'Bewaren…':'Opnieuw bewaren',draftSaving?'disabled':''):''}`;}
    function footer(next='Volgende',disabled=false){return `<div class="onboarding-actions onboarding-footer">${button('back','← Terug',`class="button secondary" ${draft.stage==='zones'&&!draft.stand.isNew?'disabled':''}`)}${button('next',next,disabled?'disabled':'')}</div>`;}
    function nameField(id,label,placeholder,value=''){return `<label class="onboarding-field">${label}<input id="${id}" ${id==='onboarding-zone-name'?'data-zone-name':''} maxlength="64" autocomplete="off" value="${escape(value)}" placeholder="${placeholder}"></label>`;}
    function manualWifiGuide(){
      if(!manualWifi())return '';
      const instructions=`<ol class="onboarding-wifi-tiles onboarding-wifi-steps" data-setup-visual="wifi-instructions"><li><span><b>Zet één receiver aan</b><small>RGBW of SPI · wordt je hoofdreceiver</small></span></li><li><span><b>Instellingen → Wifi</b><small>Kies jouw ALUVISION-netwerk</small></span></li><li><span><b>Terug naar de app</b><small>Tik op <b>Verbinding controleren</b></small></span></li></ol>`;
      return results.length?`<details class="card onboarding-manual-wifi onboarding-wifi-help"><summary>Wifi-stappen</summary>${instructions}</details>`:`<section class="card onboarding-manual-wifi" aria-label="Wifi met de hand verbinden">${instructions}</section>`;
    }
    function securityPanel(){
      if(!pinRequired)return `${draft.role==='main'?pinNetwork():''}<section class="card onboarding-security" data-security-busy="${busy}" role="status"><span class="onboarding-security-icon">${setupIcon('wifi')}</span><h2>${busy?'Receiver verbinden':'Verbinding controleren'}</h2><p>${busy?'Je receiver wordt aan je stand toegevoegd. Blijf op dit scherm.':'De verbinding is nog niet bevestigd. Je instellingen blijven bewaard.'}</p></section>${busy?'':button('security-retry','Opnieuw controleren')}`;
      if(automaticMain())return mainWifiReturn();
      if(manualRejoinSSID&&!registrationPending)return `<section class="card onboarding-manual-wifi" aria-label="Met beveiligde wifi verbinden"><h2>${busy?'Verbinding controleren…':'Verbind met je beveiligde wifi'}</h2><ol class="onboarding-wifi-tiles" data-setup-visual="wifi-rejoin"><li>${setupIcon('wifi')}<span><b>Instellingen → Wifi</b><small>Kies ${escape(manualRejoinSSID)}</small></span></li><li>${setupIcon('phone')}<span><b>Vul je eigen PIN in</b><small>Dit is nu je wifi-wachtwoord.</small></span></li><li>${setupIcon('return')}<span><b>Terug naar de app</b><small>We controleren dezelfde koppeling bij je terugkeer.</small></span></li></ol></section>${button('security-retry',busy?'Verbinding controleren…':'Ik ben verbonden · controleren',busy?'disabled':'')}<small class="onboarding-hint">Dezelfde receiver en PIN. Je keuzes blijven bewaard.</small>`;
      if(registrationPending)return `<section class="card onboarding-security" role="status"><h2>Je receiver rondt af</h2><p>De toegang voor dit toestel wordt bewaard. Je hoeft geen nieuwe PIN te kiezen.</p></section>${button('security-retry',busy?'Afronden…':'Verder controleren',busy?'disabled':'')}`;
      const phase=draft.security.phase,step={configuring:0,claiming:1,reconnecting:2,verifying:2}[phase];
      return `<section class="card onboarding-security" data-security-busy="${busy}"><span class="onboarding-security-icon"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M10 14V9a6 6 0 0 1 12 0v5"/><rect x="6" y="14" width="20" height="15" rx="4"/><path d="M16 20v3"/></svg></span><h2>${phaseLabels[phase]||'Verbinding bevestigen'}</h2><ol class="onboarding-security-stages" data-setup-visual="security" aria-label="Verbindingsstappen">${['Bewaren','Beveiligen','Verbinden'].map((label,i)=>`<li ${busy&&step===i?'aria-current="step"':''}><i aria-hidden="true"></i>${label}</li>`).join('')}</ol><p>${busy?'Je keuzes blijven bewaard.':'Nog niet bevestigd. Controleer opnieuw.'}</p></section>${busy?'':button('security-retry','Verbinding opnieuw controleren')}<details class="onboarding-recovery"><summary>Meer uitleg</summary><p>We controleren dezelfde receiver. Er wordt niets opnieuw ingesteld. Hij verschijnt pas in je stand na de laatste stap.</p></details>`;
    }
    function mainWifiReturn(){
      const progressing=busy||rejoinRunning;
      const retry=(rejoinExhausted||rejoinBlocked||!!error)&&!progressing;
      const network=manualRejoinSSID||`jouw ALUVISION-${draft.receiver.type}-netwerk`;
      const instructions=`<ol class="onboarding-wifi-tiles onboarding-wifi-return-steps" data-setup-visual="wifi-rejoin"><li><i aria-hidden="true">1</i><span><b>Open Instellingen → Wifi</b><small>Kies <strong>${escape(network)}</strong></small></span></li><li><i aria-hidden="true">2</i><span><b>Vul je gekozen PIN in</b><small>Dit is nu ook je wifi-wachtwoord.</small></span></li><li><i aria-hidden="true">3</i><span><b>Ga terug naar deze app</b><small>Je receiver wordt automatisch toegevoegd.</small></span></li></ol>`;
      return `<section class="card onboarding-manual-wifi onboarding-wifi-return" aria-label="Met beveiligde wifi verbinden"><div class="onboarding-wifi-return-symbol" aria-hidden="true">${setupIcon('wifi')}</div><h2>${automaticFinalizing?'Even afronden…':registrationPending?'Je receiver rondt af':progressing?'We verbinden automatisch…':'Nog één keer naar Wifi'}</h2>${progressing?`<p class="onboarding-auto-progress" role="status"><span aria-hidden="true"></span>${automaticFinalizing?'Je receiver veilig toevoegen…':registrationPending?'Je toegang wordt bewaard…':'Je receiver zoeken en verbinden…'}</p>`:instructions}<p class="onboarding-auto-note">${progressing?'Blijf even in de app. Je hoeft niets te doen.':'Je hoeft hier niets meer te bevestigen.'}</p></section>${retry?`<div class="onboarding-auto-retry">${button('security-retry','Opnieuw proberen','class="button secondary"')}</div>`:''}`;
    }
    function searchLabel(){
      if(manualWifi())return searchState==='searching'?'Controleren…':'Verbinding controleren';
      return searchState==='searching'?'Zoeken…':searchState==='idle'?'Receivers zoeken':'Opnieuw zoeken';
    }
    function zoneChoices(){return draft.zones.map(zone=>{
      const compatible=!zone.type||zone.type===draft.receiver.type;
      return `<button type="button" class="onboarding-zone" data-onboarding-action="zone" data-id="${escape(zone.id)}" aria-pressed="${draft.zoneId===zone.id}" ${compatible?'':'disabled'}><span><b>${escape(zone.name)}</b><small>${compatible?(zone.type||'Lege zone'):`${zone.type} · ander type verlichting`}</small></span><i>${draft.zoneId===zone.id?'✓':'→'}</i></button>`;
    }).join('');}
    function body(){
      switch(draft.stage){
        case 'stand':return `<section class="card onboarding-name-card">${nameField('onboarding-stand-name','Standnaam','Bijvoorbeeld: Aluvision beursstand',standNameInput??draft.stand?.name??'')}</section>${button('stand-save','Verder · zones maken','disabled')}`;
        case 'zones':{
          if(zoneRemoval)return zoneRemovalPanel();
          if(zoneRename)return zoneRenamePanel();
          if(receiverMove)return movePanel();
          const editing=!draft.zones.length||zoneNameOpen;
          return `${draft.zones.length?'':`<p class="onboarding-task-hint">Zone = plek in je stand, zoals de balie.</p>`}${setupZones({editable:true})}${draft.zones.length?`<p class="onboarding-zone-count" role="status">${draft.zones.length} ${draft.zones.length===1?'zone':'zones'} · Kies waar je begint.</p>`:''}${editing?`${zoneNameFields()}<div class="onboarding-actions onboarding-footer">${button(draft.zones.length?'zone-cancel':'back',draft.zones.length?'Annuleren':'← Terug','class="button secondary"')}${button('zone-create',zoneNames().length>1?`${zoneNames().length} zones maken`:'Zone maken','disabled')}</div>`:`${button('zone-new','＋ Voeg nog een zone toe','class="button secondary"')}${receiverPlacement()}<div class="onboarding-actions onboarding-footer onboarding-zones-continue">${button('next','Verder →','aria-label="Verder naar receivers toevoegen"')}<div class="onboarding-zones-footer-row">${button('back','← Terug',`class="button secondary" ${!draft.stand.isNew?'disabled':''}`)}<p class="onboarding-later-hint">Meer zones toevoegen kan ook later.</p></div></div>`}`;
        }
        case 'receiver':return receiverSearchView();
        case 'outputs':return `${pixelSetup.renderOutputs(draft.outputs,{onboarding:true})}<p class="onboarding-hint">Extra uitgangen inschakelen kan later.</p>${footer()}`;
        case 'pixels':{
          const output=draft.outputs.find(output=>output.port===draft.port);
          return `${pixelSetup.renderPortContext(draft.outputs,draft.port)}${pixelSetup.renderPixels(output,{inputId:'onboarding-pixels',onboarding:true})}${footer(pixelSetup.nextPortLabel(draft.outputs,draft.port))}`;
        }
        case 'connection':{
          const output=draft.outputs.find(output=>output.port===draft.port);
          return `${pixelSetup.renderPortContext(draft.outputs,draft.port,{stage:'connection'})}${pixelSetup.renderSide(output,{onboarding:true})}${footer(pixelSetup.nextPortLabel(draft.outputs,draft.port,{stage:'connection'}))}`;
        }
        case 'pin':return pinRequired?pinForm():securityPanel();
        case 'security':return securityPanel();
        case 'zone':return `${!pinRequired?'<p class="onboarding-task-hint">Kies een passende zone om deze receiver toe te voegen.</p>':''}<div class="onboarding-zone-list">${zoneChoices()}</div>${zoneNameOpen?`<section class="card">${nameField('onboarding-zone-name','Naam van de nieuwe zone','Bijvoorbeeld: Lichttunnel',zoneNameInput)}${button('zone-create','Zone maken','disabled')}</section>`:button('zone-new','＋ Nieuwe zone','class="button secondary"')}${pinRequired?button('next','Verder naar overzicht',draft.zoneId?'':'disabled'):''}<small class="onboarding-hint">RGBW en SPI apart. Verplaatsen kan later.</small>`;
        case 'review':return automaticMain()&&automaticFinalizing?mainWifiReturn():!pinRequired&&automaticFinalizing&&busy?addingPanel():reviewCard();
        case 'done':return completeCard();
        default:return '';
      }
    }
    function footerPin(){return `<div class="onboarding-actions onboarding-footer">${button('back','← Terug')}${button('secure','Beveiligen en verbinden','disabled')}</div>`;}
    function paintPage(top=true,capture=true){
      if(!container)return;
      if(capture)captureNames();
      const stageKey=[draft.transactionId,draft.stage,draft.receiver?.id||''].join(':'),entering=!presentedStages.has(stageKey);
      const focusedPort=container.contains(document.activeElement)&&document.activeElement.dataset.onboardingAction==='output'?document.activeElement.dataset.port:null;
      const focusedZone=container.contains(document.activeElement)&&document.activeElement.dataset.onboardingAction==='active-zone'?document.activeElement.dataset.id:null;
      const zoneScroll=container.querySelector('.onboarding-destination .onboarding-zone-list')?.scrollTop||0;
      const zonePickerOpen=container.querySelector('.onboarding-destination')?.open===true;
      presentedStages.add(stageKey);
      container.innerHTML=`<div class="page onboarding-page${entering?' onboarding-stage-enter':''}" data-setup-origin="${origin}" data-onboarding-stage="${draft.stage}" aria-busy="${draftSaving||busy}">${heading()}${['outputs','pixels','connection'].includes(draft.stage)?pixelSetup.renderProgress(draft.stage):''}${body()}${errorBox()}</div>`;
      if(draft.stage==='receiver'){
        const heading=container.querySelector('.onboarding-heading');
        const destination=draft.zones.find(zone=>zone.id===draft.activeZoneId);
        const destinationCount=zoneMembers(destination?.id).length;
        heading.insertAdjacentHTML('afterend',`<details class="onboarding-destination" ${zonePickerOpen?'open':''}><summary>${zoneVisual(Math.max(0,draft.zones.indexOf(destination)))}<span class="onboarding-destination-name"><small>Toevoegen aan · ${destinationCount} ${destinationCount===1?'receiver':'receivers'}</small><b>${escape(destination?.name||'Kies een zone')}</b></span><em>Wijzig zone⌄</em></summary><div class="onboarding-destination-title"><h2>Kies je zone</h2>${button('zone-add-from-receiver','＋ Nieuwe zone','class="button secondary"')}</div>${setupZones()}<div class="onboarding-existing-members" data-existing-receivers>${receiverPlacement()}</div>${button('zone-manage','Zones beheren','class="button secondary"')}</details>`);
        const intro=container.querySelector('.onboarding-heading~p');
        if(intro){intro.className='onboarding-later-hint';heading.insertAdjacentElement('afterend',intro);}
        const destinationCard=container.querySelector('.onboarding-destination');
        // Failed checks belong next to the active task, not below a fixed
        // footer where they look like an unresponsive button.
        const connectionError=container.querySelector('.onboarding-error:not([hidden])');
        if(connectionError)destinationCard.insertAdjacentElement('afterend',connectionError);
        if(receiverMove){
          for(const element of Array.from(container.querySelector('.onboarding-page').children))if(!element.matches('.onboarding-setup-header,.onboarding-setup-steps,.onboarding-heading,.onboarding-destination'))element.remove();
          destinationCard.insertAdjacentHTML('afterend',movePanel()+errorBox());
        }
      }
      // Read-only native discovery can show the real product without pretending
      // that an unauthenticated observation is ready for a PIN or membership.
      for(const receiver of results.filter(receiver=>receiver.canConfigure===false)){
        const card=container.querySelector(`[data-onboarding-result="${CSS.escape(receiver.id)}"]`);
        if(!card)continue;
        container.querySelectorAll(`button[data-id="${CSS.escape(receiver.id)}"]`).forEach(button=>{button.disabled=!(button.dataset.onboardingAction==='receiver'&&receiver.canVerifyIdentity&&!busy);});
        const hint=document.createElement('p');hint.className='onboarding-hint';
        hint.textContent=receiver.unavailableReason;card.insertBefore(hint,card.querySelector('.onboarding-recognition'));
      }
      for(const [id,action] of [['onboarding-stand-name','stand-save'],['onboarding-zone-name','zone-create']]){
        const field=container.querySelector('#'+id);if(field)container.querySelector(`[data-onboarding-action="${action}"]`).disabled=action==='zone-create'?!validZoneNames():!validName(field.value);
      }
      const rename=container.querySelector('#onboarding-zone-rename');if(rename)container.querySelector('[data-onboarding-action="zone-rename-confirm"]').disabled=!validName(rename.value)||rename.value.trim()===draft.zones.find(zone=>zone.id===zoneRename.zoneId)?.name;
      if(draft.stage==='pixels'){const input=container.querySelector('#onboarding-pixels');input.inputMode='numeric';container.querySelector('[data-onboarding-action="next"]').disabled=!pixelSetup.validateInput(container,input.value);}
      if(draftSaving||pendingChoices)container.querySelectorAll('button,input').forEach(control=>{
        if(draftSaving||!['save-retry','exit'].includes(control.dataset.onboardingAction))control.disabled=true;
      });
      if(managementBusy)container.querySelectorAll('button,input,summary').forEach(control=>{if(control.tagName==='SUMMARY')control.setAttribute('aria-disabled','true');else control.disabled=true;});
      updateGuidance();
      if(!top){const list=container.querySelector('.onboarding-destination .onboarding-zone-list');if(list)list.scrollTop=zoneScroll;}
      if(top){window.scrollTo({top:0,left:0,behavior:'instant'});container.querySelector('h1').setAttribute('tabindex','-1');container.querySelector('h1').focus({preventScroll:true});}
      else if(focusedPort)container.querySelector(`[data-onboarding-action="output"][data-port="${focusedPort}"]`)?.focus({preventScroll:true});
      else if(focusedZone)container.querySelector(`[data-onboarding-action="active-zone"][data-id="${CSS.escape(focusedZone)}"]`)?.focus({preventScroll:true});
      paint(performance.now()/1000);
    }
    function validName(value){const name=String(value).trim();return name.length>0&&name.length<=64&&!/[<>\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/.test(name);}
    function updateGuidance(){
      if(!container)return;
      container.querySelectorAll('[data-setup-next]').forEach(control=>{control.classList.remove('onboarding-next-action');delete control.dataset.setupNext;});
      if(busy||draftSaving||pendingChoices||saveFailed||error||zoneRemoval||zoneRename||receiverMove)return;
      let action=null;
      switch(draft.stage){
        case 'stand':action='stand-save';break;
        case 'zones':action=container.querySelector('#onboarding-zone-name')?'zone-create':'next';break;
        case 'receiver':{
          const choices=container.querySelectorAll('[data-onboarding-action="receiver"]:not(:disabled)');
          if(choices.length===1)action='receiver';else if(!choices.length&&searchState!=='searching')action='search';break;
        }
        case 'pin':action='secure';break;
        case 'security':action='security-retry';break;
        case 'outputs':case 'pixels':case 'connection':action='next';break;
        case 'zone':action=zoneNameOpen?'zone-create':draft.zoneId?'next':'zone-new';break;
        case 'review':action='finish';break;
      }
      const control=action&&container.querySelector(`[data-onboarding-action="${action}"]:not(:disabled)`);
      if(control){control.classList.add('onboarding-next-action');control.dataset.setupNext='true';}
    }
    function paint(time){
      if(!container)return;
      const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if(draft.stage==='outputs'){
        const key=[draft.transactionId,draft.stage,draft.receiver.id].join(':');
        if(!visualEntrances.has(key))visualEntrances.set(key,time);
        const entranceProgress=reducedMotion?1:Math.max(0,Math.min(1,(time-visualEntrances.get(key))/.7));
        pixelSetup.paintOutputs(container,draft.outputs,{time,reducedMotion,visual,entranceProgress,selectedPort:selectedOutput,plugProgress:plugMotion.sample(time,reducedMotion)});
        const canvas=container.querySelector('[data-pixel-outputs-visual]');
        if(canvas){canvas.dataset.entranceKey=key;canvas.dataset.entranceProgress=entranceProgress.toFixed(3);}
      }
      if(['pixels','connection'].includes(draft.stage))pixelSetup.paintOutputs(container,draft.outputs,{time,reducedMotion,visual,selectedPort:draft.port});
      for(const [id,until] of identifying)if(until<=time){
        identifying.delete(id);const control=container.querySelector(`[data-onboarding-action="identify"][data-id="${CSS.escape(id)}"]`);
        if(control){control.textContent='Laat knipperen';control.setAttribute('aria-pressed','false');const label=control.closest('.onboarding-recognition')?.querySelector('span');if(label)label.textContent='Herken jouw verlichting';}
      }
      container.querySelectorAll('[data-onboarding-visual]').forEach(canvas=>{
        const rect=canvas.getBoundingClientRect();if(!rect.width||rect.bottom<0||rect.top>innerHeight)return;
        // Stable by transaction, step and receiver: a port toggle or save
        // response can rebuild the DOM without restarting the presentation.
        const key=[draft.transactionId,draft.stage,canvas.dataset.onboardingVisual].join(':');
        if(!visualEntrances.has(key))visualEntrances.set(key,time);
        const entranceProgress=reducedMotion?1:Math.max(0,Math.min(1,(time-visualEntrances.get(key))/.7));
        // A shorter card is not a tiny thumbnail. Keep the complete product
        // finish on phone-width discovery cards, without premature port labels.
        const compact=rect.width<140,hidePortLabels=canvas.dataset.compact==='true';
        const metadata=visual.draw(canvas,{type:canvas.dataset.type,selectedPort:Number(canvas.dataset.port)||null,enabledPorts:active().map(output=>output.port),compact,hidePortLabels,identifying:identifying.has(canvas.dataset.onboardingVisual),time,reducedMotion,entranceProgress});
        canvas.dataset.detailLevel=compact?'thumbnail':'full';
        canvas.dataset.entranceKey=key;canvas.dataset.entranceProgress=entranceProgress.toFixed(3);
        canvas.dataset.activePorts=metadata.activePorts.join(',');canvas.dataset.portLabelsVisible=String(metadata.portLabelsVisible===true);
      });
    }
    function input(event){
      const element=event.target;
      if(element.hasAttribute('data-onboarding-pin')){
        const pin=container.querySelector('#onboarding-pin').value,repeat=container.querySelector('#onboarding-pin-repeat').value;
        const validation=draftApi.validatePin(pin,repeat),feedback=container.querySelector('#onboarding-pin-error');
        feedback.hidden=!repeat||validation.valid;feedback.textContent=validation.valid?'':validation.message;
        container.querySelector('#onboarding-pin-match').hidden=!validation.valid;
        container.querySelector('#onboarding-pin-repeat').setAttribute('aria-invalid',String(!!repeat&&!validation.valid));
        container.querySelector('[data-onboarding-action="secure"]').disabled=!validation.valid;updateGuidance();return;
      }
      const action=element.id==='onboarding-stand-name'?'stand-save':element.id==='onboarding-zone-name'||element.hasAttribute('data-zone-extra')?'zone-create':null;
      if(action){captureNames();container.querySelector(`[data-onboarding-action="${action}"]`).disabled=action==='zone-create'?!validZoneNames():!validName(element.value);}
      if(element.id==='onboarding-zone-rename'){captureNames();container.querySelector('[data-onboarding-action="zone-rename-confirm"]').disabled=!validName(element.value)||element.value.trim()===draft.zones.find(zone=>zone.id===zoneRename.zoneId)?.name;}
      if(element.matches('[data-pixel-count],[data-pixel-range]')){
        updatePixelCount(element.value,element);
      }
      updateGuidance();
    }
    function updatePixelCount(value,source){
      if(draft.stage!=='pixels')return;
      const valid=pixelSetup.validateInput(container,value);container.querySelector('[data-onboarding-action="next"]').disabled=!valid;
      if(valid&&change({type:'SET_PIXELS',port:draft.port,pixels:Number(value)},{render:false}))pixelSetup.updatePixels(container,draft.outputs.find(output=>output.port===draft.port),{source});
      updateGuidance();
    }
    function keydown(event){if(event.key==='Enter'&&event.target.matches('input:not([data-onboarding-pin])')){const button=container.querySelector('[data-onboarding-action="stand-save"], [data-onboarding-action="zone-create"], [data-onboarding-action="zone-rename-confirm"]');if(button&&!button.disabled){event.preventDefault();button.click();}}}
    async function search(){
      if(searchState==='searching'||busy)return;
      // No discovery or claim is started while the stand/zone choices are not
      // durably retained. Retrying a failed save remains a local operation.
      const beforeSave=operation;
      if(!(await saveChoices()))return;
      if(beforeSave!==operation||!container||draft.stage!=='receiver')return;
      if(typeof services.search!=='function'){searchState='unavailable';results=[];error='';paintPage(false);return;}
      for(const id of identifying.keys())stopIdentify(id);
      const token=++operation;searchAbort=new AbortController();searchState='searching';results=[];error='';paintPage(false);
      try{
        const result=await bounded(services.search({standId:draft.stand.id,mainReceiverId:draft.mainReceiverId,signal:searchAbort.signal}),draft.role==='node'?35000:15000);
        if(token!==operation||searchAbort?.signal.aborted)return;
        const identities=new Set(),localIds=new Set(),fingerprints=new Set(),existing=getModel().receivers;
        results=(Array.isArray(result?.receivers)?result.receivers:[]).filter(receiver=>{
          const observation=receiver?.reachabilityOnly===true&&receiver.canConfigure===false&&receiver.deviceFingerprint===null;
          if(!receiver||!['SPI','RGBW'].includes(receiver.type)||typeof receiver.id!=='string'||!/^[\w-]{1,96}$/.test(receiver.id)||!/^[\da-f]{16}$/i.test(receiver.rid)||(!observation&&!/^[\da-f]{64}$/i.test(receiver.deviceFingerprint)))return false;
          const rid=receiver.rid.toUpperCase(),fingerprint=receiver.deviceFingerprint?.toUpperCase();if(identities.has(rid)||localIds.has(receiver.id)||(fingerprint&&fingerprints.has(fingerprint))||existing.some(item=>item.id===receiver.id||item.rid?.toUpperCase()===rid||(fingerprint&&item.deviceFingerprint?.toUpperCase()===fingerprint)))return false;identities.add(rid);localIds.add(receiver.id);if(fingerprint)fingerprints.add(fingerprint);return true;
        }).map(receiver=>({id:receiver.id,rid:receiver.rid.toUpperCase(),type:receiver.type,name:String(receiver.name||`${receiver.type}-receiver`).slice(0,64),deviceFingerprint:receiver.deviceFingerprint?.toUpperCase()||null,canConfigure:receiver.canConfigure!==false,canVerifyIdentity:receiver.canVerifyIdentity===true&&typeof services.select==='function',unavailableReason:receiver.canConfigure===false?(receiver.canVerifyIdentity===true&&typeof services.select==='function'?'Tik op Deze receiver instellen om de verbinding veilig te controleren.':'Receiver gevonden. Beveiligd toevoegen is in deze V30-bouw nog niet beschikbaar.'):''}));
        searchState='ready';
      }catch(failure){if(token!==operation)return;searchState='failed';results=[];error=connectionFailure(failure,{viaMain:draft.role==='node'}).message;}
      finally{if(token===operation){searchAbort=null;paintPage(false);}}
    }
    function identifyService(receiver,enabled){
      if(draft?.role==='node'&&receiver.canVerifyIdentity===true&&typeof services.identifyCandidate==='function')return services.identifyCandidate({standId:draft.stand.id,mainReceiverId:draft.mainReceiverId,receiverId:receiver.id,rid:receiver.rid,action:enabled?'START':'STOP'});
      if(draft?.role==='main'&&receiver.canVerifyIdentity===true&&typeof services.identifyFactoryMain==='function')return services.identifyFactoryMain({standId:draft.stand.id,transactionId:draft.transactionId,receiverId:receiver.id,rid:receiver.rid,type:receiver.type,action:enabled?'START':'STOP'});
      return services.identify({receiver:clone(receiver),enabled,ttlMs:10000});
    }
    async function stopIdentify(id,knownReceiver=null){
      const receiver=knownReceiver||results.find(receiver=>receiver.id===id)||draft?.receiver;
      identifying.delete(id);
      if(receiver&&canIdentify(receiver))try{const answer=await bounded(identifyService(receiver,false));if(answer?.confirmed!==true)throw Error('UNCONFIRMED');}catch(_){notice='Stoppen is nog niet bevestigd. Controleer de receiver; verder instellen blijft mogelijk.';}
    }
    async function identify(id){
      const receiver=results.find(receiver=>receiver.id===id);if(!receiver||identifyPending.has(id))return;
      if(!canIdentify(receiver)){notice='Knipperen is voor deze receiver nog niet beschikbaar.';paintPage(false);return;}
      identifyPending.add(id);const stopping=identifying.has(id),identifyOperation=operation;paintPage(false);
      try{
        if(stopping)await stopIdentify(id);
        else {
          const answer=await bounded(identifyService(receiver,true));if(answer?.confirmed!==true)throw Error('UNCONFIRMED');
          if(identifyOperation!==operation||!container||draft.stage!=='receiver')await stopIdentify(id,receiver);
          else identifying.set(id,performance.now()/1000+(Number.isInteger(answer.ttlMs)&&answer.ttlMs>0?answer.ttlMs/1000:10));
        }
      }catch(_){if(identifyOperation===operation)notice='Knipperen is niet bevestigd. Je kunt de receiver wel verder instellen.';}
      finally{identifyPending.delete(id);paintPage(false);}
    }
    async function secure(pin,repeat,{reconcile=false,automatic=false}={}){
      if(busy)return 'stop';
      registrationPending=false;
      if(!canSecure()){pin='';repeat='';error=unavailable;paintPage(false);return;}
      if(draft.stage==='pin'){
        const result=draftApi.providePin(draft,pin,repeat);if(result.error){error=result.error.message;paintPage(false);return;}draft=result.draft;
      }
      // Erase both visible PIN inputs before the first await. Only this call's
      // short-lived closure passes the credential to the trusted service.
      container?.querySelectorAll('[data-onboarding-pin]').forEach(element=>{element.value='';});
      repeat='';busy=true;error='';const token=++operation;let finishSelectedZone=false;paintPage();
      const method=reconcile||securityUncertain?'reconcileSecurity':'secure';
      let attempted=false;
      try{
        await persist();if(token!==operation)throw Error('SUSPENDED');
        securityUncertain=true;
        let response;
        if(method==='reconcileSecurity'&&securityReceiptRef)response={receiptRef:securityReceiptRef};
        else {
          if(typeof services[method]!=='function')throw Error('UNAVAILABLE');
          attempted=true;const request=services[method]({configuration:config(),...(pinRequired&&method==='secure'&&draft.role==='main'?{pin}:{}),...(pinRequired?{onProgress:phase=>{
            if(token===operation&&busy&&draft.stage==='security'&&phaseLabels[phase])change({type:'SECURITY_PROGRESS',phase},{top:false});
          }}:{})});
          pin='';repeat='';response=await bounded(request,draft.role==='node'?125000:50000);
        }
        pin='';repeat='';
        // The first demo claim may have committed while its reply was lost.
        // Reconcile that same transaction read-only; never send secure twice.
        if(!pinRequired&&response?.status==='demo-reconcile-required')response=await bounded(services.reconcileSecurity({configuration:config()}),50000);
        // A radio change is expected after the first claim, not a failed PIN.
        // This is NOT a proof: keep the transaction uncertain and reconcile it
        // after the user selects protected wifi. Never submit the claim twice.
        if(token!==operation)throw Error('SUSPENDED');
        if(response?.status==='verification-required'){
          verifyAgain(draft);notice='Controleer dezelfde receiver opnieuw. Je stand en zonekeuzes blijven bewaard.';return;
        }
        if(response?.status==='pin-required'){
          if(!pinRequired)throw Object.assign(Error('PIN_DISABLED'),{code:'PIN_DISABLED'});
          if(method!=='reconcileSecurity'||draft.role!=='main')throw Error('INVALID_RESUME');
          draft=draftApi.snapshot({...clone(draft),stage:'pin',security:{status:'not-started',phase:'idle'}});
          securityUncertain=false;manualRejoinSSID=null;notice='De receiver is nog niet beveiligd. Vul je gekozen PIN opnieuw in om verder te gaan.';return;
        }
        if(response?.status==='manual-rejoin'){
          if(!pinRequired)throw Object.assign(Error('UNEXPECTED_REJOIN'),{code:'UNEXPECTED_REJOIN'});
          if(!manualWifi()||draft.role!=='main'||typeof response.ssid!=='string'||!/^ALUVISION-(RGBW|SPI)-[A-F0-9]{12}$/.test(response.ssid)||!response.ssid.startsWith('ALUVISION-'+draft.receiver.type+'-'))throw Error('INVALID_REJOIN');
          manualRejoinSSID=response.ssid;return 'retry';
        }
        if(response?.status==='registration-pending'){
          if(draft.role!=='main'||method!=='reconcileSecurity')throw Error('INVALID_RESUME');
          registrationPending=true;return 'retry';
        }
        if(!response?.receiptRef)throw Error('NO_RECEIPT');
        securityReceiptRef=response.receiptRef;
        if(token!==operation)throw Error('SUSPENDED');
        const confirmed=await bounded(committer.confirmSecurity(draft,response.receiptRef));
        if(confirmed.error){securityReceiptRef=null;throw Error('UNCONFIRMED');}
        if(token!==operation)throw Error('SUSPENDED');
        draft=confirmed.draft;securityReceiptRef=response.receiptRef;securityUncertain=false;manualRejoinSSID=null;
        // The customer already picked a destination while naming zones. The
        // trusted security receipt may choose it only when it is compatible;
        // the final receiver receipt still gates actual app membership.
        if(!pinRequired&&draft.zoneId){
          const reviewed=draftApi.transition(draft,{type:'NEXT'});
          if(reviewed.error)throw Error('ZONE_UNCONFIRMED');
          draft=reviewed.draft;finishSelectedZone=true;
        }
        return 'confirmed';
      }catch(failure){
        if(token!==operation)return 'stop';
        if(pinRequired&&!attempted&&!securityUncertain&&draft.role==='main')draft=draftApi.snapshot({...clone(draft),stage:'pin',security:{status:'not-started',phase:'idle'}});
        if(automaticMain()&&transientRejoin(failure))return 'retry';
        error=typeof failure?.code==='string'?connectionFailure(failure,{viaMain:draft.role==='node'}).message:`We konden deze receiver nog niet toevoegen. Je ${pinRequired?'PIN en ':''}keuzes blijven bewaard; er is niets opnieuw ingesteld.`;
        if(automaticMain())rejoinBlocked=true;
        return 'stop';
      }
      finally{
        pin='';repeat='';busy=false;
        if(token===operation){
          if(finishSelectedZone&&container)void finish({automatic:true});
          else {keepDraft();paintPage(!automatic);if((returningFromWifi&&!rejoinRunning)||(!automatic&&draft.security.status==='confirmed'))resumeAfterWifiReturn();}
        }
      }
    }
    function finishChosenZone(){
      if(!container||draft.stage!=='zone'||!draft.zoneId)return;
      const reviewed=draftApi.transition(draft,{type:'NEXT'});
      if(reviewed.error){error=reviewed.error.message;paintPage(false);return;}
      draft=reviewed.draft;void finish({automatic:true});
    }
    async function finish({automatic=false}={}){
      if(busy)return 'stop';busy=true;finalizationStarted=true;automaticFinalizing=automatic;error='';notice='';const token=++operation;paintPage(false);
      try{
        await persist();if(token!==operation)throw Error('SUSPENDED');
        let response;
        if(finalReceiptRef)response={receiptRef:finalReceiptRef};
        else {if(typeof services.finalize!=='function')throw Error('UNAVAILABLE');response=await bounded(services.finalize({configuration:config(),securityReceiptRef}),50000);}
        if(!response?.receiptRef)throw Error('NO_RECEIPT');finalReceiptRef=response.receiptRef;
        if(token!==operation)throw Error('SUSPENDED');
        if(automatic&&document.hidden){notice='Toevoegen is onderbroken. Kom terug en tik op Opnieuw proberen.';return 'stop';}
        const currentModel=getModel();
        const completed=await bounded(committer.finish(currentModel,draft,finalReceiptRef));
        if(completed.error){finalReceiptRef=null;throw Error('UNCONFIRMED');}
        // Verification may await native storage/radio. Never overwrite edits
        // made elsewhere in the meantime, nor publish after this flow closed.
        // The private receipt can be reverified against the new model on retry.
        if(token!==operation||getModel()!==currentModel)throw Error('MODEL_CHANGED');
        if(automatic&&document.hidden){notice='Toevoegen is onderbroken. Kom terug en tik op Opnieuw proberen.';return 'stop';}
        if(typeof services.publishModel==='function'){
          const saved=await bounded(services.publishModel({model:completed.model,configuration:config(),receiptRef:finalReceiptRef}));
          if(!saved?.model||canonical(saved.model)!==canonical(completed.model))throw Error('MODEL_UNCONFIRMED');
          if(token!==operation||getModel()!==currentModel)throw Error('MODEL_CHANGED');
        }
        draft=completed.draft;completeModel=completed.model;onComplete(completeModel,{zoneId:draft.zoneId,receiverId:draft.receiver.id});
        return 'done';
      }catch(failure){
        if(token!==operation)return 'stop';
        if(automatic&&pinRequired&&transientRejoin(failure))return 'retry';
        error=`Je receiver kon nog niet worden toegevoegd. Je ${pinRequired?'PIN en ':''}keuzes blijven bewaard. Er is niets opnieuw ingesteld.`;
        if(automatic)rejoinBlocked=true;
        return 'stop';
      }
      finally{busy=false;paintPage();}
    }
    async function manageSetup(request){
      if(!canManageZones()||managementBusy)return;
      if(typeof onManage!=='function'){error='Deze indeling kan nog niet worden opgeslagen. Je receivers blijven ongewijzigd.';paintPage(false);return;}
      const beforeSave=operation;
      if(!(await saveChoices())||beforeSave!==operation||!container)return;
      cancelSearch();const token=operation;
      managementBusy=true;busy=true;error='';notice='Indeling bewaren…';paintPage(false);
      try{
        const model=await bounded(onManage(request),20000);
        if(token!==operation||!container)return;
        const refreshed=draftApi.refreshZones(draft,model);
        if(refreshed.error)throw Error('DRAFT_REFRESH');
        draft=refreshed.draft;zoneRemoval=null;zoneRename=null;receiverMove=null;notice='';
        if(request.kind==='assign'){
          const selected=draftApi.transition(draft,{type:'SELECT_ACTIVE_ZONE',zoneId:request.zoneId});if(!selected.error)draft=selected.draft;
        }
        await saveChoices([],()=>{},{top:false});
      }catch(failure){
        if(token!==operation||!container)return;
        if(failure.reconciledModel){
          const refreshed=draftApi.refreshZones(draft,failure.reconciledModel);
          if(!refreshed.error){
            draft=refreshed.draft;
            // A rejected write can return an unchanged, authoritative view.
            // Keep the user's destination so retry never means choosing again.
            if(zoneRemoval){const zone=currentZone(zoneRemoval.zoneId);if(!zone||zoneSignature(zone)!==zoneRemoval.signature)zoneRemoval=null;}
            if(zoneRename){const zone=currentZone(zoneRename.zoneId);if(!zone||zoneSignature(zone)!==zoneRename.signature)zoneRename=null;}
            if(receiverMove){
              const receiver=failure.reconciledModel.receivers.find(item=>item.id===receiverMove.receiverId&&item.standId===draft.stand.id&&item.lifecycle==='added');
              const destination=draft.zones.find(zone=>zone.id===receiverMove.zoneId);
              if(!receiver||!destination||(destination.type&&destination.type!==receiver.type)||receiver.zoneId===receiverMove.zoneId)receiverMove=null;
            }
          }
        }
        error='De indeling is nog niet bevestigd. Controleer je zones en probeer opnieuw. Je receivers worden niet gereset.';notice='';
      }finally{managementBusy=false;busy=false;paintPage(false);}
    }
    async function click(event){
      const target=event.target.closest('[data-onboarding-action]');if(!target||target.disabled)return;
      const action=target.dataset.onboardingAction;
      if(draftSaving||managementBusy)return;
      if(action==='save-retry')return saveChoices();
      if(action==='exit'){
        const beforeSave=operation;
        const name=container.querySelector('#onboarding-stand-name')?.value;
        const events=draft.stage==='stand'&&validName(name||'')?[{type:'SET_STAND',id:draft.stand?.id||'stand-'+crypto.randomUUID(),name}]:[];
        if((pendingChoices||['stand','zones'].includes(draft.stage))&&!(await saveChoices(events)))return;
        if(beforeSave!==operation||!container)return;
        suspend();onExit();return;
      }
      if(pendingChoices)return;
      if(action==='search')return search();
      if(action==='identify')return identify(target.dataset.id);
      if(busy)return;
      if(action==='stand-save'){
        return saveChoices([{type:'SET_STAND',id:draft.stand?.id||'stand-'+crypto.randomUUID(),name:container.querySelector('#onboarding-stand-name').value},{type:'NEXT'}]);
      }
      if(action==='zone-create'){
        captureNames();if(!validZoneNames())return;
        // Creating zones and leaving this step are separate choices. Keep
        // every saved batch here so the customer can add another zone first.
        const newReceiverZone=draft.stage==='zone'&&!pinRequired;
        const events=zoneNames().map(name=>({type:'ADD_ZONE',id:'zone-'+crypto.randomUUID(),name}));
        return saveChoices(events,()=>{
          zoneNameOpen=false;resetZoneNames();
          if(newReceiverZone)queueMicrotask(()=>finishChosenZone());
        });
      }
      if(action==='zone-add-row'){
        captureNames();if(zoneNames().length>=12||draft.zones.length+zoneNames().length>=256)return;
        zoneExtraNames.push('');paintPage(false,false);container.querySelectorAll('#onboarding-zone-name,[data-zone-extra]').item(zoneExtraNames.length)?.focus();return;
      }
      if(action==='zone-drop-row'){
        captureNames();const names=zoneNames(),index=Number(target.dataset.index);if(names.length<=1||!Number.isInteger(index)||index<0||index>=names.length)return;
        names.splice(index,1);zoneNameInput=names[0];zoneExtraNames=names.slice(1);paintPage(false,false);container.querySelector('#onboarding-zone-name')?.focus({preventScroll:true});return;
      }
      if(action==='zone-new'){zoneNameOpen=true;paintPage(false);container.querySelector('#onboarding-zone-name').focus();return;}
      if(action==='zone-rename'){
        if(!canManageZones())return;const zone=draft.zones.find(zone=>zone.id===target.dataset.id);if(!zone)return;
        const stored=currentZone(zone.id);if(!zone.isNew&&!stored){error='Deze zone is intussen gewijzigd. Open de setup opnieuw om je actuele indeling te zien.';paintPage(false);return;}
        captureNames();zoneRename={zoneId:zone.id,name:zone.name,signature:zone.isNew?null:zoneSignature(stored)};zoneRemoval=null;receiverMove=null;error='';paintPage(false);
        const input=container.querySelector('#onboarding-zone-rename');input?.focus();input?.select();return;
      }
      if(action==='zone-rename-cancel'){zoneRename=null;error='';paintPage(false);return;}
      if(action==='zone-rename-confirm'){
        if(!canManageZones()||!zoneRename)return;captureNames();const zone=draft.zones.find(zone=>zone.id===zoneRename.zoneId);if(!zone||!validName(zoneRename.name))return;
        if(zone.isNew)return saveChoices([{type:'RENAME_ZONE',zoneId:zone.id,name:zoneRename.name}],()=>{zoneRename=null;},{top:false});
        return manageSetup({kind:'rename',zoneId:zone.id,name:zoneRename.name,expectedZoneSignature:zoneRename.signature});
      }
      if(action==='zone-remove'){
        if(!canManageZones())return;const zone=draft.zones.find(zone=>zone.id===target.dataset.id);if(!zone)return;
        const stored=currentZone(zone.id);if(!zone.isNew&&!stored){error='Deze zone is intussen gewijzigd. Open de setup opnieuw om je actuele indeling te zien.';paintPage(false);return;}
        zoneRemoval={zoneId:zone.id,signature:zone.isNew?null:zoneSignature(stored)};error='';paintPage(false);container.querySelector('[data-setup-delete-zone] h2')?.scrollIntoView({block:'nearest'});return;
      }
      if(action==='zone-remove-cancel'){zoneRemoval=null;error='';paintPage(false);return;}
      if(action==='zone-remove-confirm'){
        if(!canManageZones()||!zoneRemoval)return;const zone=draft.zones.find(zone=>zone.id===zoneRemoval.zoneId);if(!zone)return;
        if(zone.isNew)return saveChoices([{type:'REMOVE_ZONE',zoneId:zone.id}],()=>{zoneRemoval=null;},{top:false});
        return manageSetup({kind:'delete',zoneId:zone.id,expectedZoneSignature:zoneRemoval.signature});
      }
      if(action==='receiver-move'){
        if(!canManageZones())return;const receiver=getModel().receivers.find(receiver=>receiver.id===target.dataset.id&&receiver.standId===draft.stand.id&&receiver.lifecycle==='added');if(!receiver)return;
        receiverMove={receiverId:receiver.id,zoneId:receiver.zoneId};error='';paintPage(false);container.querySelector('[data-setup-move-receiver] h2')?.scrollIntoView({block:'nearest'});return;
      }
      if(action==='move-zone'){if(receiverMove){receiverMove.zoneId=target.dataset.id;paintPage(false);}return;}
      if(action==='move-cancel'){receiverMove=null;error='';paintPage(false);return;}
      if(action==='move-confirm'){
        if(!canManageZones()||!receiverMove)return;const zone=draft.zones.find(zone=>zone.id===receiverMove.zoneId);if(!zone)return;
        return manageSetup({kind:'assign',receiverId:receiverMove.receiverId,zoneId:zone.id,...(zone.isNew?{zone:{id:zone.id,name:zone.name}}:{})});
      }
      if(action==='zone-manage'){if(!canManageZones())return;cancelSearch();for(const id of identifying.keys())stopIdentify(id);return saveChoices([{type:'BACK'}]);}
      if(action==='zone-add-from-receiver'){
        cancelSearch();for(const id of identifying.keys())stopIdentify(id);
        zoneNameOpen=true;if(change({type:'BACK'}))container.querySelector('#onboarding-zone-name')?.focus();return;
      }
      if(action==='zone-cancel'){zoneNameOpen=false;resetZoneNames();paintPage(false);return;}
      if(action==='active-zone')return saveChoices([{type:'SELECT_ACTIVE_ZONE',zoneId:target.dataset.id}],()=>{},{top:false});
      if(action==='receiver'){
        let receiver=results.find(receiver=>receiver.id===target.dataset.id);if(!receiver)return;
        if(receiver.canConfigure===false&&receiver.canVerifyIdentity){
          const token=++operation,expected=receiver;busy=true;error='';notice='Receiver veilig controleren…';paintPage(false);
          try{
            const verified=await bounded(services.select({standId:draft.stand.id,transactionId:draft.transactionId,receiver:clone(expected)}),50000);
            if(token!==operation||!container||draft.stage!=='receiver')return;
            if(!verified||verified.id!==expected.id||verified.rid!==expected.rid||verified.type!==expected.type||!/^[A-F0-9]{64}$/.test(verified.deviceFingerprint))throw Object.assign(Error('IDENTITY_MISMATCH'),{code:'IDENTITY_MISMATCH'});
            receiver={id:verified.id,rid:verified.rid,type:verified.type,name:expected.name,deviceFingerprint:verified.deviceFingerprint,canConfigure:true,canVerifyIdentity:true};
            results=results.map(item=>item.id===receiver.id?receiver:item);
          }catch(failure){if(token===operation){const problem=connectionFailure(failure,{viaMain:draft.role==='node'});error=problem.message;if(problem.expired){results=[];searchState='idle';}}return;}
          finally{busy=false;notice='';paintPage(false);}
        }
        if(receiver.canConfigure===false){error=receiver.unavailableReason;paintPage(false);return;}
        if(receiver.type==='RGBW'&&draft.role==='node'&&!canSecure()){error=unavailable;paintPage(false);return;}
        const candidate={id:receiver.id,rid:receiver.rid,type:receiver.type,name:receiver.name,deviceFingerprint:receiver.deviceFingerprint};
        if(resumeSelection&&['id','rid','type','deviceFingerprint'].every(key=>resumeSelection.receiver?.[key]===candidate[key])){
          draft=draftApi.snapshot(resumeSelection);resumeSelection=null;notice='Je vorige instellingen staan klaar.';keepDraft();paintPage();return;
        }
        resumeSelection=null;
        if(change({type:'SELECT_RECEIVER',receiver:candidate},{render:false})){plugMotion.clear();selectedOutput=null;for(const id of identifying.keys())stopIdentify(id);change({type:'NEXT'});if(draft.stage==='security')return secure();}return;
      }
      if(action==='count')return change({type:'SET_OUTPUT_COUNT',count:Number(target.dataset.count)});
      if(action==='output'){
        const output=draft.outputs.find(o=>o.port===Number(target.dataset.port));if(!output)return;
        const enabled=!output.enabled;
        if(change({type:'SET_OUTPUT_ENABLED',port:output.port,enabled},{render:false})){selectedOutput=output.port;plugMotion.trigger(output.port,performance.now()/1000,enabled);}
        return paintPage(false);
      }
      if(['pixel-less','pixel-more','meter-less','meter-more'].includes(action)){
        const step=action.startsWith('meter')?pixelSetup.pixelLimits().pixelsPerMeter:1;
        return updatePixelCount(pixelSetup.stepPixels(draft.outputs.find(output=>output.port===draft.port).pixels,action.endsWith('less')?-step:step));
      }
      if(action==='side')return change({type:'SET_SIDE',port:draft.port,side:target.dataset.side},{top:false});
      if(action==='zone'){
        if(pinRequired)return change({type:'SELECT_ZONE',zoneId:target.dataset.id});
        const selected=draftApi.transition(draft,{type:'SELECT_ZONE',zoneId:target.dataset.id});
        if(selected.error){error=selected.error.message;paintPage(false);return;}
        draft=selected.draft;return finishChosenZone();
      }
      if(action==='back'){
        if(finalizationStarted)return;
        if(draft.stage==='receiver'){cancelSearch();for(const id of identifying.keys())stopIdentify(id);}
        return change({type:'BACK'});
      }
      if(action==='next'){
        if(draft.stage==='zones')return saveChoices([{type:'NEXT'}],()=>{
          // Search only after an explicit Continue and a successful save.
          // Manual Wi-Fi still needs the customer's Settings trip first.
          if(!draft.mainReceiverId&&!pinRequired&&!manualWifi())queueMicrotask(()=>{if(container&&draft.stage==='receiver')void search();});
        });
        if(draft.stage==='connection'&&draft.port===active().at(-1).port&&draft.role==='node'&&!canSecure()){error=unavailable;paintPage(false);return;}
        if(change({type:'NEXT'})&&draft.stage==='security')return secure();return;
      }
      if(action==='secure')return secure(container.querySelector('#onboarding-pin').value,container.querySelector('#onboarding-pin-repeat').value);
      if(action==='security-retry')return automaticMain()?resumeAfterWifiReturn({force:true}):secure(undefined,undefined,{reconcile:true});
      if(action==='finish')return finish();
      if(action==='done'){suspend();onExit({stand:true});return;}
      if(action==='another'){const activeZoneId=draft.zoneId;draft=null;start({activeZoneId});paintPage();return;}
      if(action==='another-zone'){const activeZoneId=draft.zoneId;draft=null;start({activeZoneId});change({type:'BACK'});return;}
    }
    // Only names, counts and the pending step for the Stand resume card; never
    // expose credentials, security receipts or unconfirmed receiver membership.
    function summary(){return draft&&draft.stage!=='done'?{stand:clone(draft.stand),zones:clone(draft.zones),stage:draft.stage,activeZoneId:draft.activeZoneId,canManageZones:canManageZones()}:null;}
    return Object.freeze({mount,suspend,reset,paint,restore,summary});
  }
  return Object.freeze({create});
}));
